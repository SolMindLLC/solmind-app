import "server-only";

import { createConnection } from "node:net";

import {
  isCanonicalVerificationEmail,
  isSixDigitVerificationCode,
  type VerificationCodeDeliveryOutcome,
  type VerificationCodeDeliveryRequest,
  type VerificationCodeDeliveryTransport,
} from "./verificationCodeDelivery";
import {
  VERIFICATION_CODE_EMAIL_CODE_TOKEN,
  type VerificationCodeEmailWording,
} from "./verificationCodeEmailWording";

// Login step 4: the local development implementation of the verification-code
// delivery transport. It emails the code to the local test mailbox (the local
// Supabase stack's mail catcher) over plain SMTP, using Node's built-in
// `node:net` and no new dependency.
//
// Dormant: nothing composes it yet. The future server composition root
// injects the host, port, sender, wording and timeout explicitly. This module
// reads no environment variables, has no defaults, and never falls back to a
// fake transport.
//
// Safety posture:
//   - Loopback only: the host must be the literal "127.0.0.1" or "::1".
//     "localhost" and every other name or address are refused, because a name
//     does not prove how the operating system will resolve it (the same rule
//     as src/lib/solmind/supabase/__tests__/providerProbeConfig.ts; `node:net`
//     takes the bare "::1" where a URL hostname would be "[::1]").
//   - No header injection: the sender, recipient, subject and body accept
//     printable ASCII only, so CR, LF and other control characters can never
//     reach an SMTP command or a header. The message is sent as 7bit.
//   - Dot-stuffing: every body line that starts with "." gets a second ".", so
//     no line can end the message early.
//   - One overall deadline covers connecting, every reply and the message, so
//     a slow server cannot extend it.
//   - Incoming replies are bounded: a chunk that would take the unread reply
//     text past one whole reply (4,096 characters) plus one line (512) is
//     refused before it is appended or decoded. Each send opens one socket
//     and closes it by its deadline (after `accepted`, within the one-second
//     QUIT grace), but nothing here bounds how many sends run at once; that
//     is an obligation of the login step 5 composition root.
//   - Outcomes before the message bytes start to be written: a 4xx reply or a
//     refused or dropped connection is `retryable_failure`; a 5xx, unexpected
//     or malformed reply is `terminal_failure`; a timeout is `timeout`.
//   - Outcomes from the moment the message bytes start to be written: a 250
//     is `accepted`, never `delivered` (the catcher only took it). Every other
//     reply, including 4xx and 5xx, is `ambiguous`, because a failure reply
//     does not prove the server did not queue the message; a lost, late or
//     unreadable reply is `ambiguous` too. Nothing is ever retried here.
//   - Spend ceiling 0: the local mail catcher costs nothing.
//   - SMS is disabled locally
//     (execution/02_SolMind_Technology_Stack_And_Hosting_Decision_v1_0.md
//     section 17.4: "Local: SMS disabled or mocked"), so an SMS request returns
//     a fixed `terminal_failure` without touching the network.
//   - Results and errors never contain the code, the contact, the challenge
//     id, or any text from the server's replies; only the three-digit reply
//     code is read.
//   - Inputs (the configuration, its wording and body lines, and the request
//     given to `send`) are read only through own data property descriptors;
//     getters and setters on the fields read are refused, and extra fields
//     that the request given to `send` tolerates are never read. The signal
//     given to `send` is used
//     only inside guards, and the dialogue listens to a module-owned relay
//     signal instead. Any exception while reading an input, for example from
//     a hostile Proxy trap, is dropped unread. It becomes a fixed error when
//     the transport is created, or a fixed `terminal_failure` from `send`
//     before any connection opens; one from removing the relay listener after
//     the dialogue is ignored, because the outcome is already decided.

export const LOCAL_SMTP_LOOPBACK_HOSTS = Object.freeze([
  "127.0.0.1",
  "::1",
] as const);

type LocalSmtpLoopbackHost = (typeof LOCAL_SMTP_LOOPBACK_HOSTS)[number];

// The spend ceiling is this transport's own: the local mail catcher costs
// nothing. A provider adapter must state and prove its own.
export const LOCAL_SMTP_VERIFICATION_CODE_LIMITS = Object.freeze({
  spendCeilingMinorUnits: 0,
  minimumTimeoutMilliseconds: 10,
  maximumTimeoutMilliseconds: 15_000,
  subjectCharacters: 200,
  bodyLines: 50,
  bodyLineCharacters: 900,
  replyLineCharacters: 512,
  replyCharacters: 4_096,
  quitGraceMilliseconds: 1_000,
} as const);

// SMS is disabled locally.
export const LOCAL_SMTP_SMS_OUTCOME = "terminal_failure" as const;

export const LOCAL_SMTP_EHLO_NAME = "solmind.invalid" as const;

export const LOCAL_SMTP_VERIFICATION_CODE_ERROR_CODES = Object.freeze([
  "local_smtp_delivery_invalid_configuration",
  "local_smtp_delivery_non_loopback_host",
  "local_smtp_delivery_invalid_port",
  "local_smtp_delivery_invalid_sender",
  "local_smtp_delivery_invalid_wording",
  "local_smtp_delivery_invalid_timeout",
] as const);

export type LocalSmtpVerificationCodeErrorCode =
  (typeof LOCAL_SMTP_VERIFICATION_CODE_ERROR_CODES)[number];

// Fixed, value-free configuration errors, thrown only when the transport is
// created. Sending never throws.
export class LocalSmtpVerificationCodeDeliveryError extends Error {
  readonly code: LocalSmtpVerificationCodeErrorCode;

  constructor(code: LocalSmtpVerificationCodeErrorCode) {
    super(code);
    this.name = "LocalSmtpVerificationCodeDeliveryError";
    this.code = code;
  }
}

export type LocalSmtpVerificationCodeTransportConfiguration = Readonly<{
  host: string;
  port: number;
  sender: string;
  wording: VerificationCodeEmailWording;
  timeoutMilliseconds: number;
}>;

type ParsedConfiguration = Readonly<{
  host: LocalSmtpLoopbackHost;
  port: number;
  sender: string;
  subject: string;
  bodyLines: ReadonlyArray<string>;
  timeoutMilliseconds: number;
}>;

const CONFIGURATION_KEYS = Object.freeze([
  "host",
  "port",
  "sender",
  "wording",
  "timeoutMilliseconds",
] as const);
const WORDING_KEYS = Object.freeze(["subject", "bodyLines"] as const);
// The request fields `send` reads; its other fields are not read.
const REQUEST_KEYS = Object.freeze(["channel", "normalizedContact", "code"] as const);
const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;
const REPLY_LINE = /^([0-9]{3})([ -]|$)/;
const CRLF = "\r\n";

// Reply codes that let the dialogue continue, in order: greeting, EHLO,
// MAIL FROM, RCPT TO, DATA.
const EXPECTED_REPLY_CODES: ReadonlyArray<ReadonlyArray<number>> = Object.freeze([
  Object.freeze([220]),
  Object.freeze([250]),
  Object.freeze([250]),
  Object.freeze([250, 251]),
  Object.freeze([354]),
]);

function fail(code: LocalSmtpVerificationCodeErrorCode): never {
  throw new LocalSmtpVerificationCodeDeliveryError(code);
}

// Reads the listed keys of a plain object through own data property
// descriptors only, so no getter, setter or Proxy `get` trap ever runs.
// Returns null when the value is not a plain object, when a listed key holds
// an accessor, or when any reflection call throws (for example in a hostile
// Proxy trap). The exception is dropped unread, so it can never carry the
// code or the contact out of this module. Absent keys are missing from the
// map; other own keys are not read here.
function readOwnDataProperties(
  value: unknown,
  keys: ReadonlyArray<string>,
): ReadonlyMap<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return null;
    }
    const fields = new Map<string, unknown>();
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined) {
        continue;
      }
      // A data descriptor always has its own `value`; an accessor never has.
      if (!Object.prototype.hasOwnProperty.call(descriptor, "value")) {
        return null;
      }
      fields.set(key, descriptor.value);
    }
    return fields;
  } catch {
    return null;
  }
}

// True when the own keys are exactly `keys`, all strings and enumerable. Any
// exception from a reflection call gives false and is dropped unread.
function hasExactKeys(value: object, keys: ReadonlyArray<string>): boolean {
  try {
    const ownKeys = Reflect.ownKeys(value);
    return (
      ownKeys.length === keys.length &&
      ownKeys.every(
        (key) =>
          typeof key === "string" &&
          keys.includes(key) &&
          Object.prototype.propertyIsEnumerable.call(value, key),
      )
    );
  } catch {
    return false;
  }
}

// Reads an array's items through own data property descriptors only, after
// bounding its length, so no iterator, getter or Proxy `get` trap runs.
// Returns null when the value is not an array, is longer than `maximumLength`,
// has a hole or an accessor, or when any reflection call throws.
function readDataArray(
  value: unknown,
  maximumLength: number,
): ReadonlyArray<unknown> | null {
  try {
    if (!Array.isArray(value)) {
      return null;
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
      lengthDescriptor === undefined ||
      !Object.prototype.hasOwnProperty.call(lengthDescriptor, "value")
    ) {
      return null;
    }
    const length: unknown = lengthDescriptor.value;
    if (
      typeof length !== "number" ||
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > maximumLength
    ) {
      return null;
    }
    const items: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        descriptor === undefined ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value")
      ) {
        return null;
      }
      items.push(descriptor.value);
    }
    return items;
  } catch {
    return null;
  }
}

function isSafeHeaderValue(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && PRINTABLE_ASCII.test(value);
}

function countCodeTokens(text: string): number {
  return text.split(VERIFICATION_CODE_EMAIL_CODE_TOKEN).length - 1;
}

function parseWording(value: unknown): Pick<ParsedConfiguration, "subject" | "bodyLines"> {
  const fields = readOwnDataProperties(value, WORDING_KEYS);
  if (fields === null || !hasExactKeys(value as object, WORDING_KEYS)) {
    fail("local_smtp_delivery_invalid_wording");
  }
  const subject = fields.get("subject");
  const bodyLines = readDataArray(
    fields.get("bodyLines"),
    LOCAL_SMTP_VERIFICATION_CODE_LIMITS.bodyLines,
  );
  if (
    !isSafeHeaderValue(subject) ||
    subject.length > LOCAL_SMTP_VERIFICATION_CODE_LIMITS.subjectCharacters ||
    countCodeTokens(subject) !== 0 ||
    bodyLines === null ||
    bodyLines.length === 0
  ) {
    fail("local_smtp_delivery_invalid_wording");
  }
  let tokens = 0;
  const lines: string[] = [];
  for (const line of bodyLines) {
    if (
      typeof line !== "string" ||
      line.length > LOCAL_SMTP_VERIFICATION_CODE_LIMITS.bodyLineCharacters ||
      !PRINTABLE_ASCII.test(line)
    ) {
      fail("local_smtp_delivery_invalid_wording");
    }
    tokens += countCodeTokens(line);
    lines.push(line);
  }
  if (tokens !== 1) {
    fail("local_smtp_delivery_invalid_wording");
  }
  return { subject, bodyLines: Object.freeze(lines) };
}

function parseConfiguration(value: unknown): ParsedConfiguration {
  const fields = readOwnDataProperties(value, CONFIGURATION_KEYS);
  if (fields === null || !hasExactKeys(value as object, CONFIGURATION_KEYS)) {
    fail("local_smtp_delivery_invalid_configuration");
  }
  const host = fields.get("host");
  const port = fields.get("port");
  const sender = fields.get("sender");
  const wording = fields.get("wording");
  const timeoutMilliseconds = fields.get("timeoutMilliseconds");
  if (
    typeof host !== "string" ||
    !(LOCAL_SMTP_LOOPBACK_HOSTS as ReadonlyArray<string>).includes(host)
  ) {
    fail("local_smtp_delivery_non_loopback_host");
  }
  if (
    typeof port !== "number" ||
    !Number.isSafeInteger(port) ||
    port < 1 ||
    port > 65_535
  ) {
    fail("local_smtp_delivery_invalid_port");
  }
  if (!isCanonicalVerificationEmail(sender) || !isSafeHeaderValue(sender)) {
    fail("local_smtp_delivery_invalid_sender");
  }
  const parsedWording = parseWording(wording);
  if (
    typeof timeoutMilliseconds !== "number" ||
    !Number.isSafeInteger(timeoutMilliseconds) ||
    timeoutMilliseconds < LOCAL_SMTP_VERIFICATION_CODE_LIMITS.minimumTimeoutMilliseconds ||
    timeoutMilliseconds > LOCAL_SMTP_VERIFICATION_CODE_LIMITS.maximumTimeoutMilliseconds
  ) {
    fail("local_smtp_delivery_invalid_timeout");
  }
  return Object.freeze({
    host: host as LocalSmtpLoopbackHost,
    port,
    sender,
    ...parsedWording,
    timeoutMilliseconds,
  });
}

function dotStuff(line: string): string {
  return line.startsWith(".") ? `.${line}` : line;
}

// Builds the complete DATA payload, ending with CRLF but without the final
// "." line. Returns null when any header value is unsafe.
function buildMessage(
  configuration: ParsedConfiguration,
  recipient: string,
  code: string,
): string | null {
  const headers: ReadonlyArray<readonly [string, string]> = [
    ["Date", new Date().toUTCString()],
    ["From", configuration.sender],
    ["To", recipient],
    ["Subject", configuration.subject],
    ["MIME-Version", "1.0"],
    ["Content-Type", "text/plain; charset=us-ascii"],
    ["Content-Transfer-Encoding", "7bit"],
  ];
  if (!headers.every(([, value]) => isSafeHeaderValue(value))) {
    return null;
  }
  const body = configuration.bodyLines.map((line) =>
    dotStuff(line.split(VERIFICATION_CODE_EMAIL_CODE_TOKEN).join(code)),
  );
  return (
    headers.map(([name, value]) => `${name}: ${value}`).join(CRLF) +
    CRLF +
    CRLF +
    body.join(CRLF) +
    CRLF
  );
}

function runSmtpDialogue(
  configuration: ParsedConfiguration,
  recipient: string,
  message: string,
  signal: AbortSignal,
): Promise<VerificationCodeDeliveryOutcome> {
  return new Promise((resolve) => {
    // Sent after each accepted reply, in order; the message follows the reply
    // to DATA.
    const commands = [
      `EHLO ${LOCAL_SMTP_EHLO_NAME}`,
      `MAIL FROM:<${configuration.sender}>`,
      `RCPT TO:<${recipient}>`,
      "DATA",
    ];
    let settled = false;
    let messageWritten = false;
    let step = 0;
    let pending = "";
    let replyCode: string | null = null;
    let replyCharacters = 0;

    const socket = createConnection({
      host: configuration.host,
      port: configuration.port,
    });
    const deadline = setTimeout(() => {
      finishWithoutReply("timeout");
    }, configuration.timeoutMilliseconds);

    function settle(outcome: VerificationCodeDeliveryOutcome): void {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(deadline);
      signal.removeEventListener("abort", onAbort);
      socket.removeListener("data", onData);
      socket.removeListener("close", onClose);
      if (outcome === "accepted") {
        // Best-effort polite close. It cannot change the outcome and cannot
        // keep the process alive.
        const closer = setTimeout(() => {
          socket.destroy();
        }, LOCAL_SMTP_VERIFICATION_CODE_LIMITS.quitGraceMilliseconds);
        closer.unref();
        socket.once("close", () => {
          clearTimeout(closer);
        });
        socket.end(`QUIT${CRLF}`);
        socket.unref();
      } else {
        socket.destroy();
      }
      resolve(outcome);
    }

    function finishWithoutReply(reason: "timeout" | "closed" | "malformed"): void {
      if (messageWritten) {
        settle("ambiguous");
      } else if (reason === "timeout") {
        settle("timeout");
      } else if (reason === "closed") {
        settle("retryable_failure");
      } else {
        settle("terminal_failure");
      }
    }

    function onReply(code: number): void {
      if (messageWritten) {
        // Only a 250 means anything once the message bytes have started to
        // be written. A 4xx or 5xx reply does not prove the server did not
        // queue the message, so it is `ambiguous`, like any other reply.
        settle(code === 250 ? "accepted" : "ambiguous");
        return;
      }
      if (!EXPECTED_REPLY_CODES[step].includes(code)) {
        settle(code >= 400 && code < 500 ? "retryable_failure" : "terminal_failure");
        return;
      }
      if (step < commands.length) {
        socket.write(`${commands[step]}${CRLF}`, "latin1");
        step += 1;
      } else {
        // From here on, a missing reply means the code may have been sent.
        messageWritten = true;
        socket.write(`${message}.${CRLF}`, "latin1");
      }
    }

    // Two known limits of this parser, accepted for a loopback-only
    // development transport: it accepts a reply line that ends in a bare LF,
    // and it detects a reply sent ahead of the next command only when that
    // reply arrives in the same chunk as the reply before it. An early reply
    // that arrives in a later chunk is read as the reply to the next command.
    function onData(chunk: Buffer): void {
      if (settled) {
        return;
      }
      // Refuse a chunk that would take the unread text past one whole reply
      // plus one line before it is appended or decoded, so memory stays
      // bounded whatever size of chunk the socket delivers. Latin-1 decoding
      // gives one character per byte.
      if (
        pending.length + chunk.length >
        LOCAL_SMTP_VERIFICATION_CODE_LIMITS.replyCharacters +
          LOCAL_SMTP_VERIFICATION_CODE_LIMITS.replyLineCharacters
      ) {
        finishWithoutReply("malformed");
        return;
      }
      pending += chunk.toString("latin1");
      for (;;) {
        const newline = pending.indexOf("\n");
        if (newline === -1) {
          if (pending.length > LOCAL_SMTP_VERIFICATION_CODE_LIMITS.replyLineCharacters) {
            finishWithoutReply("malformed");
          }
          return;
        }
        let line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        if (line.endsWith("\r")) {
          line = line.slice(0, -1);
        }
        replyCharacters += line.length + CRLF.length;
        const match = REPLY_LINE.exec(line);
        if (
          line.length > LOCAL_SMTP_VERIFICATION_CODE_LIMITS.replyLineCharacters ||
          replyCharacters > LOCAL_SMTP_VERIFICATION_CODE_LIMITS.replyCharacters ||
          match === null ||
          (replyCode !== null && match[1] !== replyCode)
        ) {
          finishWithoutReply("malformed");
          return;
        }
        if (match[2] === "-") {
          replyCode = match[1];
          continue;
        }
        replyCode = null;
        replyCharacters = 0;
        if (pending.length > 0) {
          // The dialogue is strictly one command, one reply. Anything sent
          // ahead of the next command is a protocol violation.
          finishWithoutReply("malformed");
          return;
        }
        onReply(Number(match[1]));
        return;
      }
    }

    function onClose(): void {
      finishWithoutReply("closed");
    }

    function onAbort(): void {
      finishWithoutReply("timeout");
    }

    // Stays attached for the socket's whole life so a late reset cannot throw.
    socket.on("error", () => {
      finishWithoutReply("closed");
    });
    socket.on("data", onData);
    socket.on("close", onClose);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function sendVerificationCodeEmail(
  configuration: ParsedConfiguration,
  request: unknown,
  signal: unknown,
): Promise<VerificationCodeDeliveryOutcome> {
  const fields = readOwnDataProperties(request, REQUEST_KEYS);
  if (fields === null) {
    return "terminal_failure";
  }
  const channel = fields.get("channel");
  const normalizedContact = fields.get("normalizedContact");
  const code = fields.get("code");
  if (channel === "sms") {
    return LOCAL_SMTP_SMS_OUTCOME;
  }
  // `send` is a public capability, so it re-checks its own input rather than
  // trusting the delivery boundary.
  if (
    channel !== "email" ||
    !isCanonicalVerificationEmail(normalizedContact) ||
    !isSafeHeaderValue(normalizedContact) ||
    !isSixDigitVerificationCode(code)
  ) {
    return "terminal_failure";
  }
  // The caller's signal is touched only inside guards: this check, and the
  // relay listener below, which is added before any connection opens.
  // Anything other than an AbortSignal is ignored; an exception while
  // checking it is dropped unread.
  let callerSignal: AbortSignal | undefined;
  try {
    callerSignal = signal instanceof AbortSignal ? signal : undefined;
    if (callerSignal?.aborted) {
      return "timeout";
    }
  } catch {
    return "terminal_failure";
  }
  const message = buildMessage(configuration, normalizedContact, code);
  if (message === null) {
    return "terminal_failure";
  }
  // The dialogue listens only to this module-owned relay, so a hostile
  // signal can never throw inside it.
  const relay = new AbortController();
  const relayAbort = (): void => {
    relay.abort();
  };
  try {
    callerSignal?.addEventListener("abort", relayAbort, { once: true });
  } catch {
    return "terminal_failure";
  }
  try {
    if (relay.signal.aborted) {
      return "timeout";
    }
    return await runSmtpDialogue(configuration, normalizedContact, message, relay.signal);
  } finally {
    try {
      callerSignal?.removeEventListener("abort", relayAbort);
    } catch {
      // Dropped unread: the outcome is already decided.
    }
  }
}

// The returned `send` is for deliverVerificationCode() only. The login step 5
// composition root must never call it directly: the one-send-per-handle
// guarantee lives in the boundary, not here.
export function createLocalSmtpVerificationCodeTransport(
  input: LocalSmtpVerificationCodeTransportConfiguration,
): VerificationCodeDeliveryTransport {
  const configuration = parseConfiguration(input);
  return Object.freeze({
    send: (request: VerificationCodeDeliveryRequest, signal: AbortSignal) =>
      sendVerificationCodeEmail(configuration, request, signal),
  });
}
