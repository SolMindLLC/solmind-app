import { Socket, createServer, type Server } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LOCAL_SMTP_EHLO_NAME,
  LOCAL_SMTP_VERIFICATION_CODE_ERROR_CODES,
  LOCAL_SMTP_VERIFICATION_CODE_LIMITS,
  LocalSmtpVerificationCodeDeliveryError,
  createLocalSmtpVerificationCodeTransport,
  type LocalSmtpVerificationCodeTransportConfiguration,
} from "../localSmtpVerificationCodeDelivery";
import {
  VerificationCodeDeliveryError,
  deliverVerificationCode,
  prepareVerificationCodeDelivery,
  type PreparedVerificationCodeDelivery,
  type VerificationCodeDeliveryRequest,
  type VerificationCodeDeliveryTransport,
} from "../verificationCodeDelivery";
import {
  VERIFICATION_CODE_EMAIL_CODE_TOKEN,
  VERIFICATION_CODE_EMAIL_SENDER,
  VERIFICATION_CODE_EMAIL_WORDING,
} from "../verificationCodeEmailWording";

// Every test talks to an in-process `node:net` server bound to 127.0.0.1 on
// an operating-system-assigned port. Nothing here touches the local Supabase
// stack or its mail catcher.

const CODE = "481926";
const CONTACT = "explorer.p4@synthetic.invalid";
const PHONE = "+15555550142";
const CHALLENGE_ID = "6f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const SERVER_MARKER = "FAKE-SMTP-REPLY-TEXT-7d1c";

const CLOSE = Symbol("close");
const SILENT = Symbol("silent");
type FakeReply = string | typeof CLOSE | typeof SILENT;

type FakeSmtpScript = Readonly<{
  greeting?: FakeReply;
  replies?: Readonly<
    Partial<Record<"EHLO" | "MAIL" | "RCPT" | "DATA", FakeReply>>
  >;
  afterMessage?: FakeReply;
  // Answer QUIT with a TCP reset instead of 221.
  resetOnQuit?: boolean;
}>;

type FakeSmtpServer = Readonly<{
  port: number;
  connections: () => number;
  commands: string[];
  messages: string[];
  received: () => string;
  sockets: Socket[];
  // Resolves once the server holds at least one complete message.
  messageReceived: () => Promise<void>;
}>;

const openServers: Server[] = [];
const openSockets = new Set<Socket>();

afterEach(async () => {
  for (const socket of openSockets) {
    socket.destroy();
  }
  openSockets.clear();
  await Promise.all(
    openServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
});

function respond(socket: Socket, reply: FakeReply): void {
  if (reply === CLOSE) {
    socket.destroy();
  } else if (reply !== SILENT) {
    socket.write(`${reply}\r\n`);
  }
}

async function startFakeSmtpServer(
  script: FakeSmtpScript = {},
): Promise<FakeSmtpServer> {
  const commands: string[] = [];
  const messages: string[] = [];
  const sockets: Socket[] = [];
  const messageWaiters: Array<() => void> = [];
  let connections = 0;
  let received = "";

  const server = createServer((socket) => {
    connections += 1;
    sockets.push(socket);
    openSockets.add(socket);
    socket.on("error", () => {});
    socket.on("close", () => {
      openSockets.delete(socket);
    });
    let buffer = "";
    let inData = false;
    socket.on("data", (chunk: Buffer) => {
      const text = chunk.toString("latin1");
      received += text;
      buffer += text;
      for (;;) {
        if (inData) {
          const end = buffer.indexOf("\r\n.\r\n");
          if (end === -1) {
            return;
          }
          messages.push(buffer.slice(0, end + 2));
          for (const waiter of messageWaiters.splice(0)) {
            waiter();
          }
          buffer = buffer.slice(end + 5);
          inData = false;
          respond(
            socket,
            script.afterMessage ?? `250 2.0.0 Ok: queued ${SERVER_MARKER}`,
          );
          continue;
        }
        const newline = buffer.indexOf("\r\n");
        if (newline === -1) {
          return;
        }
        const command = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);
        commands.push(command);
        const verb = command.split(" ")[0];
        if (verb === "EHLO") {
          respond(
            socket,
            script.replies?.EHLO ??
              `250-fake.invalid greets ${SERVER_MARKER}\r\n250-PIPELINING\r\n250 8BITMIME`,
          );
        } else if (verb === "MAIL") {
          respond(socket, script.replies?.MAIL ?? `250 2.1.0 Ok ${SERVER_MARKER}`);
        } else if (verb === "RCPT") {
          respond(socket, script.replies?.RCPT ?? `250 2.1.5 Ok ${SERVER_MARKER}`);
        } else if (verb === "DATA") {
          const reply =
            script.replies?.DATA ?? `354 End data with <CR><LF>.<CR><LF> ${SERVER_MARKER}`;
          inData = typeof reply === "string" && reply.startsWith("354");
          respond(socket, reply);
        } else if (verb === "QUIT") {
          if (script.resetOnQuit) {
            socket.resetAndDestroy();
            return;
          }
          socket.end(`221 2.0.0 Bye ${SERVER_MARKER}\r\n`);
        } else {
          respond(socket, `502 5.5.2 Unknown command ${SERVER_MARKER}`);
        }
      }
    });
    respond(socket, script.greeting ?? `220 fake.invalid ESMTP ${SERVER_MARKER}`);
  });
  openServers.push(server);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("fake SMTP server has no port");
  }
  return {
    port: address.port,
    connections: () => connections,
    commands,
    messages,
    received: () => received,
    sockets,
    messageReceived: () =>
      messages.length > 0
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            messageWaiters.push(resolve);
          }),
  };
}

function configuration(
  port: number,
  overrides: Record<string, unknown> = {},
): LocalSmtpVerificationCodeTransportConfiguration {
  return {
    host: "127.0.0.1",
    port,
    sender: VERIFICATION_CODE_EMAIL_SENDER,
    wording: VERIFICATION_CODE_EMAIL_WORDING,
    timeoutMilliseconds: 2_000,
    ...overrides,
  } as LocalSmtpVerificationCodeTransportConfiguration;
}

function prepared(
  overrides: Record<string, unknown> = {},
): PreparedVerificationCodeDelivery {
  return prepareVerificationCodeDelivery({
    issuanceOutcome: "issued",
    channel: "email",
    normalizedContact: CONTACT,
    code: CODE,
    purpose: "login",
    challengeId: CHALLENGE_ID,
    ...overrides,
  } as Parameters<typeof prepareVerificationCodeDelivery>[0]);
}

async function deliver(
  transport: VerificationCodeDeliveryTransport,
  timeoutMilliseconds = 5_000,
  delivery: PreparedVerificationCodeDelivery = prepared(),
) {
  const result = await deliverVerificationCode({
    delivery,
    transport,
    timeoutMilliseconds,
  });
  expectValueFree(result);
  return result;
}

function expectValueFree(value: unknown): void {
  const text = [
    JSON.stringify(value),
    String(value),
    value instanceof Error
      ? `${value.name} ${value.message} ${value.stack ?? ""} ${String(value.cause ?? "")}`
      : "",
  ].join(" ");
  for (const secret of [CODE, CONTACT, PHONE, CHALLENGE_ID, SERVER_MARKER]) {
    expect(text).not.toContain(secret);
  }
}

// Hostile inputs: every read they run throws an Error that carries the code
// and the contact, so a leak would show up in expectValueFree.
function hostileError(): Error {
  return new Error(`hostile ${CODE} ${CONTACT}`);
}

function throwingAccessor<T extends object>(target: T, key: string): T {
  return Object.defineProperty(target, key, {
    enumerable: true,
    configurable: true,
    get: () => {
      throw hostileError();
    },
  });
}

const PROXY_TRAPS = [
  "getPrototypeOf",
  "ownKeys",
  "getOwnPropertyDescriptor",
  "get",
  "has",
] as const;

function hostileProxy<T extends object>(
  target: T,
  traps: ReadonlyArray<(typeof PROXY_TRAPS)[number]> = PROXY_TRAPS,
): T {
  const handler: ProxyHandler<T> = {};
  for (const trap of traps) {
    handler[trap] = () => {
      throw hostileError();
    };
  }
  return new Proxy(target, handler);
}

function expectConfigurationError(
  value: unknown,
  code: (typeof LOCAL_SMTP_VERIFICATION_CODE_ERROR_CODES)[number],
): void {
  let error: unknown;
  try {
    createLocalSmtpVerificationCodeTransport(
      value as LocalSmtpVerificationCodeTransportConfiguration,
    );
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(LocalSmtpVerificationCodeDeliveryError);
  expect((error as LocalSmtpVerificationCodeDeliveryError).code).toBe(code);
  expect((error as Error).message).toBe(code);
  expectValueFree(error);
  expect(String(error)).not.toMatch(/10\.0\.0\.1|localhost|Bcc/i);
}

function splitMessage(message: string): { head: string; body: string } {
  const separator = message.indexOf("\r\n\r\n");
  return {
    head: message.slice(0, separator),
    body: message.slice(separator + 4),
  };
}

async function waitFor(predicate: () => boolean, milliseconds = 1_000): Promise<void> {
  const deadline = Date.now() + milliseconds;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error("condition not reached");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

async function settleNetwork(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30));
}

// The real timers, kept by a test before it installs fake ones.
type RealTimers = Readonly<{
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
}>;

// Shorter than Vitest's default 5,000 ms test timeout, so under fake timers a
// watchdog, not Vitest, ends a stuck wait, and the `finally` that restores
// real timers runs.
const WATCHDOG_MILLISECONDS = 3_000;

// A failure exit for waits that would otherwise have none. It runs on real
// timers kept before any fake ones were installed, so it fires in real time
// whatever the fake clock does. Its rejection is handled up front, so it
// matters only to a race that includes it. `clear` belongs in a `finally`.
function startWatchdog(
  timers: RealTimers,
): Readonly<{ expired: Promise<never>; clear: () => void }> {
  let handle: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    handle = timers.setTimeout(() => {
      reject(new Error(`watchdog fired after ${WATCHDOG_MILLISECONDS} ms of real time`));
    }, WATCHDOG_MILLISECONDS);
  });
  expired.catch(() => {});
  return { expired, clear: () => timers.clearTimeout(handle) };
}

// Resolves once the server holds a message. Fails instead of waiting for ever
// when the delivery settles first, because no message can then arrive, or
// when the watchdog fires.
function messageReceivedOrFailure(
  server: FakeSmtpServer,
  delivery: Promise<unknown>,
  watchdog: Promise<never>,
): Promise<void> {
  return Promise.race([
    server.messageReceived(),
    delivery.then((settled) => {
      throw new Error(
        `the delivery settled before the server held a message: ${JSON.stringify(settled)}`,
      );
    }),
    watchdog,
  ]);
}

function email(overrides: Record<string, unknown> = {}): VerificationCodeDeliveryRequest {
  return {
    channel: "email",
    normalizedContact: CONTACT,
    code: CODE,
    purpose: "login",
    challengeId: null,
    ...overrides,
  } as VerificationCodeDeliveryRequest;
}

describe("localSmtpVerificationCodeDelivery - SMTP dialogue", () => {
  it("LSMTP-001 sends one plain-text message to the loopback catcher and reports accepted, never delivered", async () => {
    const server = await startFakeSmtpServer();
    const transport = createLocalSmtpVerificationCodeTransport(configuration(server.port));
    expect(Reflect.ownKeys(transport)).toEqual(["send"]);
    expect(Object.isFrozen(transport)).toBe(true);
    // The spend ceiling is this local transport's own.
    expect(LOCAL_SMTP_VERIFICATION_CODE_LIMITS.spendCeilingMinorUnits).toBe(0);

    await expect(deliver(transport)).resolves.toEqual({ outcome: "accepted" });
    expect(server.connections()).toBe(1);
    expect(server.commands.slice(0, 4)).toEqual([
      `EHLO ${LOCAL_SMTP_EHLO_NAME}`,
      `MAIL FROM:<${VERIFICATION_CODE_EMAIL_SENDER}>`,
      `RCPT TO:<${CONTACT}>`,
      "DATA",
    ]);
    expect(server.messages).toHaveLength(1);

    const { head, body } = splitMessage(server.messages[0]);
    expect(head).toMatch(
      /^Date: [^\r\n]+\r\nFrom: no-reply@solmind\.invalid\r\nTo: explorer\.p4@synthetic\.invalid\r\nSubject: Your SolMind code\r\nMIME-Version: 1\.0\r\nContent-Type: text\/plain; charset=us-ascii\r\nContent-Transfer-Encoding: 7bit$/,
    );
    expect(head).not.toContain(CODE);
    expect(body).toBe(
      VERIFICATION_CODE_EMAIL_WORDING.bodyLines
        .map((line) => line.split(VERIFICATION_CODE_EMAIL_CODE_TOKEN).join(CODE))
        .join("\r\n") + "\r\n",
    );
    expect(server.messages[0].replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    expect(server.received()).not.toContain(CHALLENGE_ID);
    expect(server.received()).not.toMatch(/AUTH|STARTTLS/);

    // The polite QUIT is best-effort and arrives after the result.
    await waitFor(() => server.commands.includes("QUIT"));
    expect(server.commands.filter((command) => command === "DATA")).toHaveLength(1);
  });

  it("LSMTP-002 dot-stuffs body lines so no line can end the message early", async () => {
    const server = await startFakeSmtpServer();
    const transport = createLocalSmtpVerificationCodeTransport(
      configuration(server.port, {
        wording: {
          subject: "Dot test",
          bodyLines: [
            ".leading dot",
            ".",
            "..two dots",
            `code ${VERIFICATION_CODE_EMAIL_CODE_TOKEN}`,
            "not.leading",
            "last line",
          ],
        },
      }),
    );

    await expect(deliver(transport)).resolves.toEqual({ outcome: "accepted" });
    expect(server.messages).toHaveLength(1);
    const { body } = splitMessage(server.messages[0]);
    const lines = body.split("\r\n").slice(0, -1);
    expect(lines).toEqual([
      "..leading dot",
      "..",
      "...two dots",
      `code ${CODE}`,
      "not.leading",
      "last line",
    ]);
    expect(lines.map((line) => (line.startsWith(".") ? line.slice(1) : line))).toEqual([
      ".leading dot",
      ".",
      "..two dots",
      `code ${CODE}`,
      "not.leading",
      "last line",
    ]);
  });

  it("LSMTP-003 rejects CR/LF and other unsafe header values before any connection", async () => {
    const server = await startFakeSmtpServer();
    for (const sender of [
      `${VERIFICATION_CODE_EMAIL_SENDER}\r\nBcc: x@y.invalid`,
      `${VERIFICATION_CODE_EMAIL_SENDER}\n`,
      "No-Reply@solmind.invalid",
      "no reply@solmind.invalid",
      "<no-reply@solmind.invalid>",
      "",
    ]) {
      expectConfigurationError(
        configuration(server.port, { sender }),
        "local_smtp_delivery_invalid_sender",
      );
    }

    const token = VERIFICATION_CODE_EMAIL_CODE_TOKEN;
    for (const wording of [
      { subject: "Code\r\nBcc: x@y.invalid", bodyLines: [token] },
      { subject: "Code\n", bodyLines: [token] },
      { subject: "Code\r", bodyLines: [token] },
      { subject: "Code\tcode", bodyLines: [token] },
      { subject: `Code ${String.fromCharCode(0x2013)} SolMind`, bodyLines: [token] },
      { subject: "", bodyLines: [token] },
      { subject: `Code ${token}`, bodyLines: [token] },
      { subject: "Code", bodyLines: [`${token}\r\nBcc: x@y.invalid`] },
      { subject: "Code", bodyLines: [token, "line\nsplit"] },
      { subject: "Code", bodyLines: [token, `${String.fromCharCode(0x2019)}curly`] },
      { subject: "Code", bodyLines: ["no code here"] },
      { subject: "Code", bodyLines: [token, token] },
      { subject: "Code", bodyLines: [] },
      { subject: "Code", bodyLines: `${token}` },
      { subject: "Code", bodyLines: [token], extra: true },
      { subject: "Code", bodyLines: [token, "x".repeat(901)] },
    ]) {
      expectConfigurationError(
        configuration(server.port, { wording }),
        "local_smtp_delivery_invalid_wording",
      );
    }

    const transport = createLocalSmtpVerificationCodeTransport(configuration(server.port));
    for (const request of [
      email({ normalizedContact: `${CONTACT}\r\nRCPT TO:<x@y.invalid>` }),
      email({ normalizedContact: `${CONTACT}\n` }),
      email({ normalizedContact: "x@y.invalid>\r\nDATA" }),
      email({ code: `${CODE}\r\n.\r\nMAIL FROM:<x@y.invalid>` }),
      email({ channel: "fax" }),
      null as unknown as VerificationCodeDeliveryRequest,
    ]) {
      await expect(transport.send(request, new AbortController().signal)).resolves.toBe(
        "terminal_failure",
      );
    }
    await settleNetwork();
    expect(server.connections()).toBe(0);

    expect(() => prepared({ normalizedContact: `${CONTACT}\r\nBcc: x@y.invalid` })).toThrow(
      VerificationCodeDeliveryError,
    );
  });

  it("LSMTP-004 returns timeout when the server stalls before the message", async () => {
    const silentGreeting = await startFakeSmtpServer({ greeting: SILENT });
    await expect(
      deliver(
        createLocalSmtpVerificationCodeTransport(
          configuration(silentGreeting.port, { timeoutMilliseconds: 150 }),
        ),
      ),
    ).resolves.toEqual({ outcome: "timeout" });

    const silentMail = await startFakeSmtpServer({ replies: { MAIL: SILENT } });
    await expect(
      deliver(
        createLocalSmtpVerificationCodeTransport(
          configuration(silentMail.port, { timeoutMilliseconds: 150 }),
        ),
      ),
    ).resolves.toEqual({ outcome: "timeout" });
    expect(silentMail.commands).not.toContain("DATA");

    // The boundary's own elapsed-time ceiling also holds when it is shorter.
    const boundaryCeiling = await startFakeSmtpServer({ greeting: SILENT });
    const started = Date.now();
    await expect(
      deliver(
        createLocalSmtpVerificationCodeTransport(
          configuration(boundaryCeiling.port, { timeoutMilliseconds: 5_000 }),
        ),
        100,
      ),
    ).resolves.toEqual({ outcome: "timeout" });
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it.each([
    ["the greeting", { greeting: `421 4.3.2 Service not available ${SERVER_MARKER}` }],
    ["RCPT TO", { replies: { RCPT: `450 4.2.1 Mailbox busy ${SERVER_MARKER}` } }],
    ["MAIL FROM", { replies: { MAIL: `451 4.3.0 Try later ${SERVER_MARKER}` } }],
    ["DATA", { replies: { DATA: `451 4.3.0 Try later ${SERVER_MARKER}` } }],
  ] as const)("LSMTP-005 maps a 4xx reply to %s, before the message, to retryable_failure", async (_label, script) => {
    const server = await startFakeSmtpServer(script);
    await expect(
      deliver(createLocalSmtpVerificationCodeTransport(configuration(server.port))),
    ).resolves.toEqual({ outcome: "retryable_failure" });
    expect(server.connections()).toBe(1);
    expect(server.messages).toHaveLength(0);
  });

  it.each([
    ["the greeting", { greeting: `554 5.3.2 No service ${SERVER_MARKER}` }],
    ["MAIL FROM", { replies: { MAIL: `553 5.1.8 Bad sender ${SERVER_MARKER}` } }],
    ["RCPT TO", { replies: { RCPT: `550 5.1.1 No such user ${SERVER_MARKER}` } }],
    ["DATA", { replies: { DATA: `554 5.5.1 No valid recipients ${SERVER_MARKER}` } }],
  ] as const)("LSMTP-006 maps a 5xx reply to %s, before the message, to terminal_failure", async (_label, script) => {
    const server = await startFakeSmtpServer(script);
    await expect(
      deliver(createLocalSmtpVerificationCodeTransport(configuration(server.port))),
    ).resolves.toEqual({ outcome: "terminal_failure" });
    expect(server.messages).toHaveLength(0);
  });

  it.each([
    ["an unexpected greeting code", { greeting: `250 wrong ${SERVER_MARKER}` }],
    ["an unexpected EHLO code", { replies: { EHLO: `354 odd ${SERVER_MARKER}` } }],
    ["a malformed greeting", { greeting: `hello ${SERVER_MARKER}` }],
    ["a mixed multi-line code", { greeting: `220-first ${SERVER_MARKER}\r\n221 second` }],
    ["an over-long reply line", { replies: { EHLO: `250 ${"x".repeat(600)}` } }],
    [
      // 4,335 bytes: small enough to pass the chunk guard, so the whole-reply
      // limit (4,096 counted characters) is what refuses it.
      "an over-long multi-line reply",
      { replies: { EHLO: `${`250-${"x".repeat(200)}\r\n`.repeat(21)}250 end` } },
    ],
    [
      "replies sent ahead of the commands",
      {
        greeting: `220 hi ${SERVER_MARKER}\r\n250 ehlo\r\n250 mail\r\n250 rcpt\r\n354 data`,
        replies: { EHLO: SILENT, MAIL: SILENT, RCPT: SILENT, DATA: SILENT },
      },
    ],
  ] as const)("LSMTP-007 treats %s before the message as terminal_failure", async (_label, script) => {
    const server = await startFakeSmtpServer(script);
    await expect(
      deliver(createLocalSmtpVerificationCodeTransport(configuration(server.port))),
    ).resolves.toEqual({ outcome: "terminal_failure" });
    expect(server.messages).toHaveLength(0);
  });

  it.each([
    ["the connection closes", { afterMessage: CLOSE }, 2_000],
    ["the server stays silent", { afterMessage: SILENT }, 300],
    ["the reply is unreadable", { afterMessage: `garbage ${SERVER_MARKER}` }, 2_000],
    ["the reply code is unexpected", { afterMessage: `221 odd ${SERVER_MARKER}` }, 2_000],
    // A failure reply does not prove the server did not queue the message.
    ["the reply is 4xx", { afterMessage: `451 4.3.0 Try later ${SERVER_MARKER}` }, 2_000],
    ["the reply is 5xx", { afterMessage: `554 5.6.0 Rejected ${SERVER_MARKER}` }, 2_000],
  ] as const)(
    "LSMTP-008 reports ambiguous, with no second attempt, when after the message %s",
    async (_label, script, timeoutMilliseconds) => {
      const server = await startFakeSmtpServer(script);
      const transport = createLocalSmtpVerificationCodeTransport(
        configuration(server.port, { timeoutMilliseconds }),
      );
      const delivery = prepared();

      await expect(deliver(transport, 5_000, delivery)).resolves.toEqual({
        outcome: "ambiguous",
      });
      await expect(
        deliverVerificationCode({ delivery, transport, timeoutMilliseconds: 5_000 }),
      ).rejects.toMatchObject({ code: "verification_code_delivery_already_attempted" });
      await settleNetwork();
      expect(server.connections()).toBe(1);
      expect(server.messages).toHaveLength(1);
      expect(server.commands.filter((command) => command === "DATA")).toHaveLength(1);
      expect(server.commands).not.toContain("QUIT");
    },
  );

  it("LSMTP-009 maps a refused or dropped connection before the message to retryable_failure", async () => {
    const dropped = await startFakeSmtpServer({ greeting: CLOSE });
    await expect(
      deliver(createLocalSmtpVerificationCodeTransport(configuration(dropped.port))),
    ).resolves.toEqual({ outcome: "retryable_failure" });

    const probe = createServer();
    await new Promise<void>((resolve) => {
      probe.listen(0, "127.0.0.1", () => resolve());
    });
    const address = probe.address();
    if (address === null || typeof address === "string") {
      throw new Error("probe server has no port");
    }
    await new Promise<void>((resolve) => {
      probe.close(() => resolve());
    });
    await expect(
      deliver(createLocalSmtpVerificationCodeTransport(configuration(address.port))),
    ).resolves.toEqual({ outcome: "retryable_failure" });
  });

  it("LSMTP-010 returns a fixed terminal outcome for SMS without touching the network", async () => {
    const server = await startFakeSmtpServer();
    const transport = createLocalSmtpVerificationCodeTransport(configuration(server.port));
    await expect(
      deliver(transport, 5_000, prepared({ channel: "sms", normalizedContact: PHONE })),
    ).resolves.toEqual({ outcome: "terminal_failure" });
    await expect(
      transport.send(
        email({ channel: "sms", normalizedContact: PHONE }),
        new AbortController().signal,
      ),
    ).resolves.toBe("terminal_failure");
    await settleNetwork();
    expect(server.connections()).toBe(0);
  });

  it("LSMTP-014 refuses one oversized incoming chunk before it is appended or decoded", async () => {
    const limit =
      LOCAL_SMTP_VERIFICATION_CODE_LIMITS.replyCharacters +
      LOCAL_SMTP_VERIFICATION_CODE_LIMITS.replyLineCharacters;
    // The server stays silent, and the test hands one 16 KiB Buffer straight to
    // the client socket's own data listener, so how TCP splits data cannot
    // change what the guard sees.
    const server = await startFakeSmtpServer({ greeting: SILENT });
    const transport = createLocalSmtpVerificationCodeTransport(configuration(server.port));
    const oversized = Buffer.from(`220-${"Z".repeat(16_384)}`, "latin1");
    expect(oversized.length).toBeGreaterThan(limit);

    const onSpy = vi.spyOn(Socket.prototype, "on");
    const clientSocket = (): Socket | undefined => {
      const index = onSpy.mock.calls.findIndex(
        (call, callIndex) =>
          (call as ReadonlyArray<unknown>)[0] === "data" &&
          !server.sockets.includes(onSpy.mock.contexts[callIndex] as Socket),
      );
      return index === -1 ? undefined : (onSpy.mock.contexts[index] as Socket);
    };
    let decodedContexts: unknown[] = [];
    try {
      const pending = deliver(transport);
      await waitFor(() => clientSocket() !== undefined && server.connections() === 1);
      const socket = clientSocket() as Socket;
      expect(socket.listenerCount("data")).toBeGreaterThan(0);
      const decodeSpy = vi.spyOn(Buffer.prototype, "toString");
      try {
        socket.emit("data", oversized);
      } finally {
        decodedContexts = [...decodeSpy.mock.contexts];
        decodeSpy.mockRestore();
      }
      await expect(pending).resolves.toEqual({ outcome: "terminal_failure" });
    } finally {
      onSpy.mockRestore();
    }
    expect(decodedContexts).not.toContain(oversized);
    expect(server.commands).toHaveLength(0);
    expect(server.messages).toHaveLength(0);
  });

  it("LSMTP-015 absorbs a socket error that arrives after the outcome is settled", async () => {
    // The client settles `accepted`, then sends QUIT; the server answers the
    // QUIT with a TCP reset, so the client's socket errors after settlement.
    const server = await startFakeSmtpServer({ resetOnQuit: true });
    const transport = createLocalSmtpVerificationCodeTransport(configuration(server.port));
    const emitSpy = vi.spyOn(Socket.prototype, "emit");
    const clientErrorSeen = (): boolean =>
      emitSpy.mock.calls.some(
        (call, index) =>
          (call as ReadonlyArray<unknown>)[0] === "error" &&
          !server.sockets.includes(emitSpy.mock.contexts[index] as Socket),
      );
    try {
      await expect(deliver(transport)).resolves.toEqual({ outcome: "accepted" });
      expect(clientErrorSeen()).toBe(false);
      await waitFor(() => server.commands.includes("QUIT"));
      await waitFor(clientErrorSeen);
      await settleNetwork();
    } finally {
      emitSpy.mockRestore();
    }
    expect(server.messages).toHaveLength(1);
    expect(server.connections()).toBe(1);
  });

  it("LSMTP-016 gives exactly ambiguous when the boundary's ceiling fires after the message is written, and exactly timeout before", async () => {
    const server = await startFakeSmtpServer({ afterMessage: SILENT });
    const transport = createLocalSmtpVerificationCodeTransport(
      configuration(server.port, { timeoutMilliseconds: 5_000 }),
    );
    const delivery = prepared();
    // Controlled timers: the boundary's ceiling fires only once the server
    // holds the message, however slow the machine is. Only setTimeout and
    // clearTimeout are faked; the sockets run for real. The real timers are
    // kept first, so the watchdog still runs in real time: every wait below
    // has a failure exit, and the `finally` that restores them always runs.
    const realTimers: RealTimers = {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    };
    const watchdog = startWatchdog(realTimers);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let result: unknown;
    try {
      const pending = deliver(transport, 1_000, delivery);
      await messageReceivedOrFailure(server, pending, watchdog.expired);
      await vi.advanceTimersByTimeAsync(1_000);
      result = await Promise.race([pending, watchdog.expired]);
    } finally {
      watchdog.clear();
      vi.useRealTimers();
    }
    expect(result).toEqual({ outcome: "ambiguous" });
    expect(server.messages).toHaveLength(1);
    await expect(
      deliverVerificationCode({ delivery, transport, timeoutMilliseconds: 1_000 }),
    ).rejects.toMatchObject({ code: "verification_code_delivery_already_attempted" });
    await settleNetwork();
    expect(server.connections()).toBe(1);
    expect(server.commands).not.toContain("QUIT");

    // The transport itself, aborted once the message has arrived, reports
    // exactly `ambiguous`.
    const direct = await startFakeSmtpServer({ afterMessage: SILENT });
    const directTransport = createLocalSmtpVerificationCodeTransport(
      configuration(direct.port, { timeoutMilliseconds: 5_000 }),
    );
    const controller = new AbortController();
    const outcome = directTransport.send(email(), controller.signal);
    const directWatchdog = startWatchdog(realTimers);
    try {
      await messageReceivedOrFailure(direct, outcome, directWatchdog.expired);
    } finally {
      directWatchdog.clear();
    }
    controller.abort();
    await expect(outcome).resolves.toBe("ambiguous");
    await settleNetwork();
    expect(direct.connections()).toBe(1);
    expect(direct.messages).toHaveLength(1);
    expect(direct.commands).not.toContain("QUIT");

    // Before the message, the boundary's ceiling gives exactly `timeout`: the
    // server never greets, so nothing can have been sent.
    const silent = await startFakeSmtpServer({ greeting: SILENT });
    const silentTransport = createLocalSmtpVerificationCodeTransport(
      configuration(silent.port, { timeoutMilliseconds: 5_000 }),
    );
    await expect(deliver(silentTransport, 200)).resolves.toEqual({ outcome: "timeout" });
    await settleNetwork();
    expect(silent.connections()).toBe(1);
    expect(silent.messages).toHaveLength(0);
    expect(silent.commands).toHaveLength(0);
  });

  it("LSMTP-018 returns a fixed terminal_failure with no connection for getters and hostile Proxies given to send", async () => {
    const server = await startFakeSmtpServer();
    const transport = createLocalSmtpVerificationCodeTransport(configuration(server.port));
    const signal = (): AbortSignal => new AbortController().signal;

    for (const request of [
      throwingAccessor(email(), "channel"),
      throwingAccessor(email(), "normalizedContact"),
      throwingAccessor(email(), "code"),
      // A getter is refused even when it would return a valid value.
      Object.defineProperty(email(), "code", { enumerable: true, get: () => CODE }),
      hostileProxy(email()),
      hostileProxy(email(), ["getPrototypeOf"]),
      hostileProxy(email(), ["getOwnPropertyDescriptor"]),
    ]) {
      const outcome = await transport.send(request, signal());
      expect(outcome).toBe("terminal_failure");
      expectValueFree(outcome);
    }

    for (const hostileSignal of [
      hostileProxy(signal()),
      throwingAccessor(signal(), "aborted"),
      Object.defineProperty(signal(), "addEventListener", {
        value: () => {
          throw hostileError();
        },
      }),
    ]) {
      const outcome = await transport.send(email(), hostileSignal);
      expect(outcome).toBe("terminal_failure");
      expectValueFree(outcome);
    }
    await settleNetwork();
    expect(server.connections()).toBe(0);

    // The request is read only through own data descriptors, so hostile
    // `get` and `has` traps never run.
    await expect(
      transport.send(hostileProxy(email(), ["get", "has"]), signal()),
    ).resolves.toBe("accepted");
    expect(server.connections()).toBe(1);
  });
});

describe("localSmtpVerificationCodeDelivery - configuration", () => {
  it("LSMTP-011 accepts only the literal loopback addresses", () => {
    for (const host of ["127.0.0.1", "::1"]) {
      expect(() =>
        createLocalSmtpVerificationCodeTransport(configuration(2525, { host })),
      ).not.toThrow();
    }
    for (const host of [
      "localhost",
      "LOCALHOST",
      "localhost.",
      "[::1]",
      " 127.0.0.1",
      "127.0.0.1 ",
      "127.0.0.2",
      "127.1",
      "::ffff:127.0.0.1",
      "0.0.0.0",
      "10.0.0.1",
      "mail.example.com",
      "",
      2130706433,
      undefined,
    ]) {
      expectConfigurationError(
        configuration(2525, { host }),
        "local_smtp_delivery_non_loopback_host",
      );
    }
  });

  it("LSMTP-012 requires every setting explicitly, with no defaults", () => {
    for (const port of [0, 65_536, 1.5, -25, "2525", Number.NaN]) {
      expectConfigurationError(
        configuration(2525, { port }),
        "local_smtp_delivery_invalid_port",
      );
    }
    for (const timeoutMilliseconds of [9, 15_001, 1.5, "100"]) {
      expectConfigurationError(
        configuration(2525, { timeoutMilliseconds }),
        "local_smtp_delivery_invalid_timeout",
      );
    }
    for (const key of ["host", "port", "sender", "wording", "timeoutMilliseconds"]) {
      const partial: Record<string, unknown> = { ...configuration(2525) };
      delete partial[key];
      expectConfigurationError(partial, "local_smtp_delivery_invalid_configuration");
    }
    expectConfigurationError(
      { ...configuration(2525), transport: "fake" },
      "local_smtp_delivery_invalid_configuration",
    );
    for (const value of [undefined, null, "127.0.0.1:2525", []]) {
      expectConfigurationError(value, "local_smtp_delivery_invalid_configuration");
    }
    for (const code of LOCAL_SMTP_VERIFICATION_CODE_ERROR_CODES) {
      const error = new LocalSmtpVerificationCodeDeliveryError(code);
      expect(error.message).toBe(code);
      expectValueFree(error);
    }
  });

  it("LSMTP-017 refuses getters and hostile Proxies in the configuration with its own fixed value-free error", () => {
    for (const key of ["host", "port", "sender", "wording", "timeoutMilliseconds"]) {
      expectConfigurationError(
        throwingAccessor(configuration(2525), key),
        "local_smtp_delivery_invalid_configuration",
      );
    }
    for (const traps of [
      PROXY_TRAPS,
      ["getPrototypeOf"],
      ["ownKeys"],
      ["getOwnPropertyDescriptor"],
    ] as const) {
      expectConfigurationError(
        hostileProxy(configuration(2525), traps),
        "local_smtp_delivery_invalid_configuration",
      );
    }

    const token = VERIFICATION_CODE_EMAIL_CODE_TOKEN;
    const wording = () => ({ subject: "Code", bodyLines: [token] });
    for (const hostileWording of [
      throwingAccessor(wording(), "subject"),
      throwingAccessor(wording(), "bodyLines"),
      hostileProxy(wording()),
      hostileProxy(wording(), ["ownKeys"]),
      { subject: "Code", bodyLines: throwingAccessor([token], "0") },
      { subject: "Code", bodyLines: hostileProxy([token]) },
      { subject: "Code", bodyLines: hostileProxy([token], ["getOwnPropertyDescriptor"]) },
      {
        // A Proxy that reports a huge length is refused before any item is
        // read.
        subject: "Code",
        bodyLines: new Proxy([token], {
          getOwnPropertyDescriptor: (target, key) =>
            key === "length"
              ? { value: 2 ** 40, writable: true, enumerable: false, configurable: false }
              : Reflect.getOwnPropertyDescriptor(target, key),
        }),
      },
    ]) {
      expectConfigurationError(
        configuration(2525, { wording: hostileWording }),
        "local_smtp_delivery_invalid_wording",
      );
    }

    // Values are read only through own data descriptors, so hostile `get`
    // and `has` traps never run.
    expect(() =>
      createLocalSmtpVerificationCodeTransport(
        hostileProxy(
          configuration(2525, {
            wording: hostileProxy(
              { subject: "Code", bodyLines: hostileProxy([token], ["get", "has"]) },
              ["get", "has"],
            ),
          }),
          ["get", "has"],
        ),
      ),
    ).not.toThrow();
  });

  it("LSMTP-013 keeps the approved wording: the exact subject, the code line first, purpose-neutral and reasoned", () => {
    const { subject, bodyLines } = VERIFICATION_CODE_EMAIL_WORDING;
    const body = bodyLines.join("\n");
    expect(subject).toBe("Your SolMind code");
    expect(bodyLines[0]).toBe(`Your SolMind code is: ${VERIFICATION_CODE_EMAIL_CODE_TOKEN}`);
    expect(VERIFICATION_CODE_EMAIL_SENDER.endsWith(".invalid")).toBe(true);
    expect(subject).not.toContain(VERIFICATION_CODE_EMAIL_CODE_TOKEN);
    expect(body.split(VERIFICATION_CODE_EMAIL_CODE_TOKEN)).toHaveLength(2);
    expect(body).toContain("10 minutes");
    expect(body).toMatch(/only once/);
    expect(body).toMatch(/because someone asked SolMind/);
    expect(body).toMatch(/so that/);
    expect(`${subject}\n${body}`).not.toMatch(/sign[ -]?in|log[ -]?in|account/i);
    expect(`${subject}\n${body}`).toMatch(/^[\x20-\x7e\n]*$/);
    expect(Object.isFrozen(VERIFICATION_CODE_EMAIL_WORDING)).toBe(true);
    expect(Object.isFrozen(bodyLines)).toBe(true);
  });

  it("LSMTP-019 keeps the whole approved body exactly, blank lines included, against an independent copy", () => {
    // The approved body is written out here, not derived from the wording
    // module, so that a change to any of its lines, or to its blank lines,
    // fails this test.
    expect(VERIFICATION_CODE_EMAIL_WORDING.bodyLines).toEqual([
      "Your SolMind code is: {{code}}",
      "",
      "Enter it on the SolMind screen that asked for it within 10 minutes.",
      "It works only once and then expires, so that an old or copied code",
      "cannot be used later.",
      "",
      "You are getting this email because someone asked SolMind to send a",
      "code to this email address.",
      "",
      "If you did not ask for a code, you can ignore this email. Do not share",
      "the code with anyone, so that nobody else can use it.",
    ]);
  });
});
