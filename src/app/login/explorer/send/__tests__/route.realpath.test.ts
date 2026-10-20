// Login step 6, sub-slice S6-8: the Explorer "send a code" route, through its
// real path.
//
// The actual handler runs with the real same-origin guard, the real body
// parser, the real composition, the real request-scoped dependency factory,
// login step 5's real issuing caller and composition root, the real local
// SMTP transport and the real Supabase client. Only true IO edges are stood
// in for, each in process:
//   - the environment (set per test and restored);
//   - the service-role client's network: the global `fetch`, replaced by a
//     fake that answers the two database functions by name and refuses every
//     other request. The configured Supabase host is a reserved name that
//     cannot resolve;
//   - the SMTP socket: `node:net`'s `createConnection`, replaced for this
//     file. The replacement accepts exactly host 127.0.0.1, port 54325 and
//     answers the SMTP dialogue from a script in memory; any other target is
//     refused. No socket is opened and no port is bound or connected to;
//   - the waiter's timer: `node:timers/promises`, so no test waits the real
//     response floor. The composition test proves the answer time itself.
// Every value is synthetic. Nothing here reaches a network, a database, the
// local mail catcher or a local Supabase stack.
//
// Contract 25 Section 15 item 9 (CSRF: no cookie and no code issued), item 5
// (the send route sets no cookie; a widened body is refused), item 10 (no
// return address is used) and item 11 (leaks), and contract 21 Section 7.1.3
// (one acknowledgment form for every account-lookup outcome).

import { inspect, isDeepStrictEqual } from "node:util";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FakeConnection = {
  options: unknown;
  written: string[];
  messages: string[];
  closed: boolean;
};

const edge = vi.hoisted(() => ({
  connections: [] as FakeConnection[],
  refusedTargets: [] as unknown[],
  // The scripted server's reply to RCPT TO, and to the message.
  smtp: { rcpt: "250 2.1.5 OK", message: "250 2.0.0 queued" },
  delays: [] as unknown[],
  events: [] as string[],
  compositionOverride: null as (() => unknown) | null,
  compositionCalls: [] as unknown[][],
}));

vi.mock("node:net", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:net")>();
  const events = await import("node:events");

  // A scripted SMTP peer, in memory. It speaks only when spoken to, one
  // reply per command, as the local mail catcher does.
  class ScriptedSmtpSocket extends events.EventEmitter {
    private readonly record: FakeConnection;
    private awaitingMessage = false;
    private ended = false;

    constructor(record: FakeConnection) {
      super();
      this.record = record;
      setImmediate(() => this.reply("220 fake.invalid ESMTP"));
    }

    private reply(line: string): void {
      if (!this.ended) {
        this.emit("data", Buffer.from(`${line}\r\n`, "latin1"));
      }
    }

    write(chunk: unknown): boolean {
      const text = String(chunk);
      this.record.written.push(text);
      setImmediate(() => {
        if (this.awaitingMessage) {
          this.awaitingMessage = false;
          this.record.messages.push(text);
          this.reply(edge.smtp.message);
          return;
        }
        const verb = text.trim().split(/[ :]/)[0].toUpperCase();
        if (verb === "EHLO" || verb === "MAIL") {
          this.reply("250 OK");
        } else if (verb === "RCPT") {
          this.reply(edge.smtp.rcpt);
        } else if (verb === "DATA") {
          this.awaitingMessage = true;
          this.reply("354 End data with <CR><LF>.<CR><LF>");
        } else {
          this.reply("502 5.5.2 Unknown command");
        }
      });
      return true;
    }

    end(chunk?: unknown): this {
      if (chunk !== undefined) {
        this.record.written.push(String(chunk));
      }
      this.close();
      return this;
    }

    destroy(): this {
      this.close();
      return this;
    }

    unref(): this {
      return this;
    }

    private close(): void {
      if (!this.ended) {
        this.ended = true;
        this.record.closed = true;
        setImmediate(() => this.emit("close"));
      }
    }
  }

  // The replacement: exactly the local mail catcher's address, or a refusal.
  const createConnection = (...args: unknown[]): unknown => {
    const options = args[0] as { host?: unknown; port?: unknown } | undefined;
    const exact =
      args.length === 1 &&
      typeof options === "object" &&
      options !== null &&
      Object.keys(options).sort().join(",") === "host,port" &&
      options.host === "127.0.0.1" &&
      options.port === 54325;
    if (!exact) {
      edge.refusedTargets.push(args);
      throw new Error("test setup: a connection to anything but the scripted mail catcher is refused");
    }
    const record: FakeConnection = { options, written: [], messages: [], closed: false };
    edge.connections.push(record);
    edge.events.push("smtp:connect");
    return new ScriptedSmtpSocket(record);
  };
  Object.defineProperty(createConnection, "isScriptedReplacement", { value: true });
  const replaced = { ...actual, createConnection, connect: createConnection };
  return { ...replaced, default: replaced };
});

vi.mock("node:timers/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:timers/promises")>();
  const setTimeoutFake = (milliseconds: unknown): Promise<void> => {
    edge.delays.push(milliseconds);
    edge.events.push("wait");
    return Promise.resolve();
  };
  return { ...actual, default: { ...actual, setTimeout: setTimeoutFake }, setTimeout: setTimeoutFake };
});

// The composition is the real one. The wrapper only records its argument and
// lets one test make it throw, to reach the handler's own last catch.
vi.mock("@/lib/solmind/supabase/explorerSignInComposition", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/solmind/supabase/explorerSignInComposition")>();
  return {
    ...actual,
    requestExplorerSignInCode: (...args: Parameters<typeof actual.requestExplorerSignInCode>) => {
      edge.compositionCalls.push(args);
      if (edge.compositionOverride !== null) {
        return edge.compositionOverride();
      }
      return actual.requestExplorerSignInCode(...args);
    },
  };
});

import * as routeModule from "../route";
import { POST } from "../route";

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

const TRUSTED_ORIGIN = "http://127.0.0.1:3000";
const ROUTE_PATH = "/login/explorer/send";
const SUPABASE_URL = "http://supabase.invalid";
const SERVICE_KEY = "synthetic-service-role-key-s68-send";
const ANON_KEY = "synthetic-anon-key-s68-send";
const PEPPER_TEXT = Buffer.alloc(32, 0x3c).toString("base64url");

const TYPED_EMAIL = "  Explorer.S68@SolMind.Example ";
const EMAIL = "explorer.s68@solmind.example";
const STORED_EMAIL = "stored.explorer.s68@solmind.example";
const ACCOUNT_ID = "1a111111-1111-4111-8111-11111111111f";
const CONTACT_ID = "2b222222-2222-4222-8222-22222222222e";
const PROVIDER_ID = "3f0c9a6e-1b2d-4c3e-8f4a-5b6c7d8e9f01";
const SENTINEL = "sentinel-s68-send-detail";
const RETURN_MARKER = "https://attacker.example/s68-return-marker";
// A fixed monotonic clock, so that the time a request's work takes on a busy
// computer cannot change the delay the real waiter asks the timer for.
const FIXED_MONOTONIC_NOW = 7_200_000;
// The response floor, as the real waiter asks it of the timer when no
// monotonic time has passed: 1,500 ms here. Paul decided on 2026-10-07
// (morning check-in packet, item 5, option 1) "a fixed wait of about one and
// a half seconds, set from the first local run"; the exact value is still
// open until that run. Record:
// `solmind-sprints/PRJ01-SPR001/Decision_Queue/Current_Action_Queue.md`,
// "The 2026-10-07 check-in: answered (first seen by the 11:30:10 clock
// read)".
const RESPONSE_FLOOR_MILLISECONDS = 1_500;

const LOOKUP = "solmind_resolve_login_account";
const ISSUE = "solmind_issue_verification_challenge";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const DENIED_BODY = '{"outcome":"denied"}';
const INVALID_EMAIL_BODY = '{"outcome":"invalid_email"}';
const FIXED_HEADERS = [
  ["cache-control", "private, no-cache, no-store, must-revalidate, max-age=0"],
  ["content-type", "application/json"],
  ["expires", "0"],
  ["pragma", "no-cache"],
  ["x-content-type-options", "nosniff"],
];

type RpcRequest = Readonly<{ functionName: string; body: Record<string, unknown>; apikey: string | null; method: string }>;
type RpcHandler = (request: RpcRequest) => Response | Promise<Response>;

let rpcHandlers: Record<string, RpcHandler> = {};
let rpcRequests: RpcRequest[] = [];
let unexpectedRequests: string[] = [];
let fetchFake: ReturnType<typeof vi.fn>;

function rows(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
}

function databaseError(message: string): Response {
  return new Response(JSON.stringify({ code: "P0001", message, details: null, hint: null }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

function accountRow(): Record<string, unknown> {
  return {
    user_account_id: ACCOUNT_ID,
    user_contact_method_id: CONTACT_ID,
    normalized_contact_value: STORED_EMAIL,
    provider_user_id: PROVIDER_ID,
  };
}

function stubNetwork(): void {
  fetchFake = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const match = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(url.pathname);
    const handler = match === null ? undefined : rpcHandlers[match[1]];
    if (url.origin !== SUPABASE_URL || url.search !== "" || match === null || handler === undefined) {
      unexpectedRequests.push(`${init?.method ?? "GET"} ${url.origin}${url.pathname}`);
      throw new Error("test setup: unexpected request");
    }
    const request: RpcRequest = Object.freeze({
      functionName: match[1],
      body: typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {},
      apikey: new Headers(init?.headers).get("apikey"),
      method: init?.method ?? "GET",
    });
    rpcRequests.push(request);
    edge.events.push(`rpc:${match[1]}`);
    return handler(request);
  });
  vi.stubGlobal("fetch", fetchFake);
}

function stubEnvironment(overrides: Record<string, string> = {}): void {
  const values: Record<string, string> = {
    SOLMIND_TRUSTED_APP_ORIGIN: TRUSTED_ORIGIN,
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    SOLMIND_VERIFICATION_PEPPER: PEPPER_TEXT,
    ...overrides,
  };
  for (const [name, value] of Object.entries(values)) {
    vi.stubEnv(name, value);
  }
  // The pepper source refuses to load while its public-name tripwire is set,
  // so the tests do not depend on this computer's own environment.
  vi.stubEnv("NEXT_PUBLIC_SOLMIND_VERIFICATION_PEPPER", undefined);
}

type PostOptions = Readonly<{
  origin?: string | null;
  secFetchSite?: string | null;
  contentType?: string | null;
  headers?: Record<string, string>;
  query?: string;
  rawBody?: string | null;
  requestOrigin?: string;
}>;

// A same-origin JSON POST as the app's own page would send it, unless an
// option says otherwise. The body is sent as an untyped blob, so no content
// type is added behind the test's back.
function post(body: unknown, options: PostOptions = {}): NextRequest {
  const headers = new Headers(options.headers);
  const origin = options.origin === undefined ? (options.requestOrigin ?? TRUSTED_ORIGIN) : options.origin;
  if (origin !== null) {
    headers.set("origin", origin);
  }
  const secFetchSite = options.secFetchSite === undefined ? "same-origin" : options.secFetchSite;
  if (secFetchSite !== null) {
    headers.set("sec-fetch-site", secFetchSite);
  }
  const contentType = options.contentType === undefined ? "application/json" : options.contentType;
  if (contentType !== null) {
    headers.set("content-type", contentType);
  }
  const raw = options.rawBody === undefined ? JSON.stringify(body) : options.rawBody;
  return new NextRequest(`${options.requestOrigin ?? TRUSTED_ORIGIN}${ROUTE_PATH}${options.query ?? ""}`, {
    method: "POST",
    headers,
    body: raw === null ? null : new Blob([raw]),
  });
}

type Answer = Readonly<{
  status: number;
  text: string;
  headers: string[][];
  setCookies: string[];
}>;

const answers: Answer[] = [];

async function send(request: NextRequest): Promise<Answer> {
  const response = await POST(request);
  const answer: Answer = Object.freeze({
    status: response.status,
    text: await response.text(),
    headers: [...response.headers.entries()].sort(([a], [b]) => a.localeCompare(b)),
    setCookies: response.headers.getSetCookie(),
  });
  answers.push(answer);
  return answer;
}

function selectorOf(answer: Answer): string {
  const parsed = JSON.parse(answer.text) as { acknowledgment?: string; challengeId?: string };
  expect(Object.keys(parsed)).toEqual(["acknowledgment", "challengeId"]);
  expect(parsed.acknowledgment).toBe("verification_code_requested");
  expect(parsed.challengeId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  return parsed.challengeId as string;
}

function expectDenied(answer: Answer, label: string): void {
  expect(answer.status, label).toBe(200);
  expect(answer.text, label).toBe(DENIED_BODY);
  expect(isDeepStrictEqual(answer.headers, FIXED_HEADERS), `${label}: the answer carries exactly the fixed headers`).toBe(true);
  expect(answer.setCookies.length === 0, `${label}: no cookie is set`).toBe(true);
}

// Nothing was looked up, issued, sent or waited for.
function expectNoEffect(label: string): void {
  expect(rpcRequests.length === 0, `${label}: no database request was recorded`).toBe(true);
  expect(fetchFake.mock.calls.length === 0, `${label}: the fetch fake was not called`).toBe(true);
  expect(edge.connections.length === 0, `${label}: no mail connection was opened`).toBe(true);
  expect(edge.delays, label).toEqual([]);
}

// --- the leak scan (contract 25 Section 15 item 11) --------------------------

// This test's known values. A value registered as a selector may appear in
// one place by design: the `challengeId` of this route's acknowledgment.
const knownValues = new Map<string, string>();
const knownSelectors = new Set<string>();
let stdoutChunks: string[] = [];
let stderrChunks: string[] = [];
const warnings: string[] = [];
const unhandled: string[] = [];
const onWarning = (warning: unknown): void => {
  warnings.push(inspect(warning));
};
const onUnhandled = (reason: unknown): void => {
  unhandled.push(inspect(reason));
};

function encodingsOf(value: string): string[] {
  const bytes = Buffer.from(value, "utf8");
  return [...new Set([value, bytes.toString("base64"), bytes.toString("base64url"), bytes.toString("hex"), encodeURIComponent(value)])];
}

function scanForLeaks(): void {
  const consoleText = CONSOLE_METHODS.flatMap((method) =>
    vi.mocked(console[method]).mock.calls.map((call) => inspect(call, { depth: 8 })),
  );
  const answerText = answers.map((answer) => {
    let body = answer.text;
    for (const selector of knownSelectors) {
      body = body.replace(`"challengeId":"${selector}"`, '"challengeId":"<selector>"');
    }
    return `${body}\n${JSON.stringify(answer.headers)}\n${answer.setCookies.join("\n")}`;
  });
  const sinks = [...consoleText, ...stdoutChunks, ...stderrChunks, ...warnings, ...unhandled, ...answerText].join("\n");
  for (const [label, value] of knownValues) {
    for (const encoded of encodingsOf(value)) {
      expect(sinks.includes(encoded), `${label} appears in a recorded sink`).toBe(false);
    }
  }
  for (const selector of knownSelectors) {
    expect(sinks.includes(selector), "a selector appears outside the acknowledgment's challengeId").toBe(false);
  }
}

let realConnect: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  for (const method of CONSOLE_METHODS) {
    vi.spyOn(console, method);
  }
  stdoutChunks = [];
  stderrChunks = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    stdoutChunks.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    stderrChunks.push(String(chunk));
    return true;
  });
  warnings.length = 0;
  unhandled.length = 0;
  process.on("warning", onWarning);
  process.on("unhandledRejection", onUnhandled);
  // The guard behind the replacement: a real socket connect, by any path,
  // is refused and recorded.
  const actualNet = await vi.importActual<typeof import("node:net")>("node:net");
  realConnect = vi.spyOn(actualNet.Socket.prototype, "connect").mockImplementation(() => {
    throw new Error("test setup: a real socket is never opened");
  });
  vi.spyOn(performance, "now").mockReturnValue(FIXED_MONOTONIC_NOW);

  edge.connections.length = 0;
  edge.refusedTargets.length = 0;
  edge.smtp.rcpt = "250 2.1.5 OK";
  edge.smtp.message = "250 2.0.0 queued";
  edge.delays.length = 0;
  edge.events.length = 0;
  edge.compositionOverride = null;
  edge.compositionCalls.length = 0;
  answers.length = 0;
  rpcRequests = [];
  unexpectedRequests = [];
  rpcHandlers = {
    [LOOKUP]: () => rows([]),
    [ISSUE]: () => rows([{ outcome: "issued" }]),
  };
  knownValues.clear();
  knownSelectors.clear();
  for (const [label, value] of [
    ["the pepper", PEPPER_TEXT],
    ["the service-role key", SERVICE_KEY],
    ["the anon key", ANON_KEY],
    ["the typed email", EMAIL],
    ["the stored email", STORED_EMAIL],
    ["the account id", ACCOUNT_ID],
    ["the contact id", CONTACT_ID],
    ["the provider user id", PROVIDER_ID],
    ["a sentinel", SENTINEL],
    ["a return address", RETURN_MARKER],
  ] as const) {
    knownValues.set(label, value);
  }
  stubEnvironment();
  stubNetwork();
});

afterEach(async () => {
  // Let a closing scripted socket finish inside the test that opened it.
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
  process.off("warning", onWarning);
  process.off("unhandledRejection", onUnhandled);

  // The checks run in `try` and the restores in `finally`, so that a failed
  // check here cannot leave a spy in place for the tests after it.
  try {
    // ESR-L-001: the leak scan, after every test. Every code and verifier
    // this test produced is added first.
    for (const request of rpcRequests) {
      if (request.functionName === ISSUE && typeof request.body.p_verifier === "string") {
        knownValues.set("a verifier", request.body.p_verifier);
      }
    }
    edge.connections.forEach((connection, index) => {
      for (const message of connection.messages) {
        const code = /Your SolMind code is: (\d{6})/.exec(message)?.[1];
        if (code !== undefined) {
          knownValues.set(`code ${index}`, code);
        }
      }
    });
    scanForLeaks();
    for (const method of CONSOLE_METHODS) {
      expect(vi.mocked(console[method]).mock.calls.length === 0, `console.${method} was not called`).toBe(true);
    }
    expect(stdoutChunks.length === 0, "nothing was written to standard output").toBe(true);
    expect(stderrChunks.length === 0, "nothing was written to standard error").toBe(true);
    expect(warnings.length === 0, "no process warning was raised").toBe(true);
    expect(unhandled.length === 0, "no rejection was left unhandled").toBe(true);

    // The control check, after every test: every connection went through
    // the replacement, to exactly the scripted address, and none reached a
    // real socket; no request left for an unexpected address.
    expect(edge.refusedTargets).toEqual([]);
    for (const connection of edge.connections) {
      expect(connection.options).toEqual({ host: "127.0.0.1", port: 54325 });
    }
    expect(realConnect).not.toHaveBeenCalled();
    expect(unexpectedRequests).toEqual([]);
    // No answer of this route ever sets a cookie.
    for (const answer of answers) {
      expect(answer.setCookies.length === 0, "no answer of the send route sets a cookie").toBe(true);
      expect(answer.status).toBe(200);
      expect(isDeepStrictEqual(answer.headers, FIXED_HEADERS), "every answer of the send route carries exactly the fixed headers").toBe(true);
    }
  } finally {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});

describe("POST /login/explorer/send - the guard first (contract 25 Section 15 item 9)", () => {
  it("ESR-S-001 a cross-site, missing or wrong Origin, a wrong Sec-Fetch-Site, a wrong content type, or a malformed body is denied with no lookup, no code issued, no mail and no cookie; Host/forwarded headers do not substitute for an acceptable Origin", async () => {
    // The lookup would find an eligible account, so a request that got past
    // the guard would issue and send.
    rpcHandlers[LOOKUP] = () => rows([accountRow()]);
    const valid = { identifier: TYPED_EMAIL };
    const CASES: ReadonlyArray<readonly [string, () => NextRequest]> = [
      ["no Origin", () => post(valid, { origin: null })],
      ["another site's Origin", () => post(valid, { origin: "https://attacker.example" })],
      ["localhost where the trusted origin is 127.0.0.1", () => post(valid, { origin: "http://localhost:3000" })],
      ["another port", () => post(valid, { origin: "http://127.0.0.1:3001" })],
      ["https where the trusted origin is http", () => post(valid, { origin: "https://127.0.0.1:3000" })],
      ["the opaque Origin", () => post(valid, { origin: "null" })],
      ["Sec-Fetch-Site cross-site", () => post(valid, { secFetchSite: "cross-site" })],
      ["Sec-Fetch-Site same-site", () => post(valid, { secFetchSite: "same-site" })],
      ["Sec-Fetch-Site none", () => post(valid, { secFetchSite: "none" })],
      ["no Sec-Fetch-Site", () => post(valid, { secFetchSite: null })],
      ["content type text/plain", () => post(valid, { contentType: "text/plain" })],
      ["a form content type", () => post(valid, { contentType: "application/x-www-form-urlencoded" })],
      ["a multipart content type", () => post(valid, { contentType: "multipart/form-data; boundary=x" })],
      ["no content type", () => post(valid, { contentType: null })],
      ["JSON in another charset", () => post(valid, { contentType: "application/json; charset=utf-16" })],
      ["a compressed body", () => post(valid, { headers: { "content-encoding": "gzip" } })],
      [
        "hostile Host and forwarded headers with no Origin",
        () =>
          post(valid, {
            origin: null,
            headers: {
              host: "127.0.0.1:3000",
              "x-forwarded-host": "127.0.0.1:3000",
              "x-forwarded-proto": "http",
              forwarded: "host=127.0.0.1:3000;proto=http",
              referer: `${TRUSTED_ORIGIN}/login`,
            },
          }),
      ],
      [
        "hostile forwarded headers beside another site's Origin",
        () =>
          post(valid, {
            origin: "https://attacker.example",
            headers: { "x-forwarded-host": "127.0.0.1:3000", "x-forwarded-proto": "http" },
          }),
      ],
      ["an empty body", () => post(valid, { rawBody: "" })],
      ["no body at all", () => post(valid, { rawBody: null })],
      ["a body over the cap", () => post(valid, { rawBody: JSON.stringify({ identifier: "a".repeat(17_000) }) })],
      ["text that is not JSON", () => post(valid, { rawBody: "identifier=explorer" })],
      ["a JSON list", () => post(valid, { rawBody: JSON.stringify([valid]) })],
      ["a JSON string", () => post(valid, { rawBody: JSON.stringify(TYPED_EMAIL) })],
      ["JSON null", () => post(valid, { rawBody: "null" })],
      ["a byte-order mark", () => post(valid, { rawBody: `${String.fromCharCode(0xfeff)}${JSON.stringify(valid)}` })],
      ["a wrong declared length", () => post(valid, { headers: { "content-length": "3" } })],
    ];
    for (const [label, build] of CASES) {
      expectDenied(await send(build()), label);
      expectNoEffect(label);
    }
    // Control: the same body, as the app's own page sends it, is not denied,
    // so each case above failed for the one thing it changed.
    const control = await send(post(valid));
    expect(control.text).not.toBe(DENIED_BODY);
    knownSelectors.add(selectorOf(control));
    expect(rpcRequests.map((request) => request.functionName)).toEqual([LOOKUP, ISSUE]);
    expect(edge.connections.length === 1, "the control request opened exactly one mail connection").toBe(true);
  });

  it("ESR-S-002 with no trusted origin configured the answer is the generic deny before the body is read", async () => {
    rpcHandlers[LOOKUP] = () => rows([accountRow()]);
    for (const configured of ["", "not-an-origin", "http://127.0.0.1:3000/path", "ftp://127.0.0.1:3000"]) {
      vi.stubEnv("SOLMIND_TRUSTED_APP_ORIGIN", configured);
      const request = post({ identifier: TYPED_EMAIL });
      expectDenied(await send(request), configured);
      expect(request.bodyUsed, configured).toBe(false);
      expectNoEffect(configured);
    }
  });

  it("ESR-S-003 the module exports only POST and dynamic: no other method has a handler", () => {
    expect(Object.keys(routeModule).sort()).toEqual(["POST", "dynamic"]);
    expect(routeModule.dynamic).toBe("force-dynamic");
    for (const method of ["GET", "HEAD", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      expect(method in routeModule, method).toBe(false);
    }
  });

  it("ESR-S-004 any query parameter is denied, a return address included, with no effect", async () => {
    rpcHandlers[LOOKUP] = () => rows([accountRow()]);
    const queries = [
      `?returnTo=${encodeURIComponent(RETURN_MARKER)}`,
      `?next=${encodeURIComponent("//attacker.example")}`,
      "?redirect=%5C%5Cattacker.example",
      "?identifier=other.s68%40solmind.example",
      "?role=admin",
      "?x",
    ];
    for (const [index, query] of queries.entries()) {
      // A fixed label, the case's number: one of the queries holds an email
      // address.
      const label = `query ${index + 1} of ${queries.length}`;
      expectDenied(await send(post({ identifier: TYPED_EMAIL }, { query })), label);
      expectNoEffect(label);
    }
  });

  it("ESR-S-005 a body that carries anything but the one identifier string is denied whole: a role, an account id, a session id, a purpose or a return address is never read", async () => {
    rpcHandlers[LOOKUP] = () => rows([accountRow()]);
    const widened: ReadonlyArray<Record<string, unknown>> = [
      { identifier: TYPED_EMAIL, role: "admin" },
      { identifier: TYPED_EMAIL, requestedRoleContext: "guide" },
      { identifier: TYPED_EMAIL, userAccountId: ACCOUNT_ID },
      { identifier: TYPED_EMAIL, userContactMethodId: CONTACT_ID },
      { identifier: TYPED_EMAIL, sessionId: "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60" },
      { identifier: TYPED_EMAIL, purpose: "role_reentry" },
      { identifier: TYPED_EMAIL, identifierType: "username" },
      { identifier: TYPED_EMAIL, returnTo: RETURN_MARKER },
      { identifier: TYPED_EMAIL, next: "//attacker.example" },
      { identifier: TYPED_EMAIL, redirect: "\\\\attacker.example" },
      { identifier: TYPED_EMAIL, challengeId: "5d0c9a6e-1b2d-4c3e-8f4a-5b6c7d8e9f01" },
      { identifier: 42 },
      { identifier: null },
      { identifier: [TYPED_EMAIL] },
      { email: TYPED_EMAIL },
      {},
    ];
    for (const [index, body] of widened.entries()) {
      // A fixed label, the case's number: the bodies hold the typed email.
      const label = `widened body ${index + 1} of ${widened.length}`;
      expectDenied(await send(post(body)), label);
      expectNoEffect(label);
    }
  });

  it("ESR-S-006 if the composition ever threw, the handler would still answer the generic deny", async () => {
    for (const fault of [
      () => {
        throw new Error(SENTINEL);
      },
      () => Promise.reject(new Error(SENTINEL)),
    ]) {
      edge.compositionOverride = fault;
      expectDenied(await send(post({ identifier: TYPED_EMAIL })), "a broken promise");
      expectNoEffect("a broken promise");
    }
    expect(edge.compositionCalls.length === 2, "the composition was called once for each fault").toBe(true);
  });
});

describe("POST /login/explorer/send - one acknowledgment form for every account-lookup outcome (contract 21 Section 7.1.3)", () => {
  it("ESR-S-007 text that is not an email is invalid_email at once: no lookup, no wait, and the same for every such text", async () => {
    rpcHandlers[LOOKUP] = () => rows([accountRow()]);
    const texts = ["", "   ", "explorer", "explorer@", "@solmind.example", "two@@solmind.example", "a..b@solmind.example", "admin.username", `${"a".repeat(600)}@solmind.example`, `expl${String.fromCharCode(0x212a)}rer@solmind.example`];
    for (const [index, typed] of texts.entries()) {
      // A fixed label, the case's number: the texts are shaped like
      // addresses.
      const label = `typed text ${index + 1} of ${texts.length}`;
      const answer = await send(post({ identifier: typed }));
      expect(answer.text, label).toBe(INVALID_EMAIL_BODY);
      expectNoEffect(label);
    }
  });

  it("ESR-S-008 an unknown or ineligible email gets the acknowledgment after exactly one read: the account lookup with the type and the Explorer role fixed; no issuance call, no mail", async () => {
    const answer = await send(post({ identifier: TYPED_EMAIL }));
    const selector = selectorOf(answer);
    knownSelectors.add(selector);
    expect(selector).toMatch(UUID_V4);
    expect(
      isDeepStrictEqual(rpcRequests, [
        {
          functionName: LOOKUP,
          method: "POST",
          apikey: SERVICE_KEY,
          body: {
            p_normalized_login_identifier: EMAIL,
            p_login_identifier_type: "email",
            p_requested_role_context: "explorer",
          },
        },
      ]),
      "exactly one database request: the account lookup, with the service key and its three arguments",
    ).toBe(true);
    expect(edge.connections.length === 0, "no mail connection was opened").toBe(true);
    // One wait, for exactly the response floor: the monotonic clock is fixed.
    expect(edge.delays).toEqual([RESPONSE_FLOOR_MILLISECONDS]);
    expect(edge.events).toEqual([`rpc:${LOOKUP}`, "wait"]);
    expect(
      isDeepStrictEqual(edge.compositionCalls, [[{ trustedOrigin: TRUSTED_ORIGIN, identifier: TYPED_EMAIL }]]),
      "the composition was called once, with the trusted origin and the text as typed",
    ).toBe(true);
  });

  it("ESR-S-009 an eligible email gets the same acknowledgment after the lookup, one issuance bound to the lookup's row, and one message to exactly the local mail catcher's address, for the row's own email", async () => {
    rpcHandlers[LOOKUP] = () => rows([accountRow()]);
    const answer = await send(post({ identifier: TYPED_EMAIL }));
    const selector = selectorOf(answer);
    knownSelectors.add(selector);
    expect(rpcRequests.map((request) => request.functionName)).toEqual([LOOKUP, ISSUE]);
    const issuance = rpcRequests[1].body;
    expect(Object.keys(issuance).sort()).toEqual([
      "p_contact_method_type",
      "p_delivery_channel",
      "p_normalized_contact_value",
      "p_purpose",
      "p_user_account_id",
      "p_user_contact_method_id",
      "p_verification_challenge_id",
      "p_verifier",
    ]);
    expect(
      issuance.p_purpose === "login" &&
        issuance.p_contact_method_type === "email" &&
        issuance.p_delivery_channel === "email" &&
        issuance.p_normalized_contact_value === STORED_EMAIL &&
        issuance.p_user_account_id === ACCOUNT_ID &&
        issuance.p_user_contact_method_id === CONTACT_ID &&
        issuance.p_verification_challenge_id === selector,
      "the issuance is bound to the lookup's row and to the acknowledged selector",
    ).toBe(true);
    expect(selector).toMatch(UUID_V4);
    // The scripted mail catcher: one connection, to exactly its address.
    expect(edge.connections.length === 1, "exactly one mail connection").toBe(true);
    const connection = edge.connections[0];
    expect(connection.options).toEqual({ host: "127.0.0.1", port: 54325 });
    const recipients = connection.written.filter((line) => line.startsWith("RCPT TO:"));
    expect(
      recipients.length === 1 && recipients[0] === `RCPT TO:<${STORED_EMAIL}>\r\n`,
      "exactly one recipient line, for the row's own email",
    ).toBe(true);
    expect(connection.messages.length === 1, "exactly one message").toBe(true);
    const code = /Your SolMind code is: (\d{6})\r\n/.exec(connection.messages[0])?.[1];
    expect(code !== undefined && /^\d{6}$/.test(code), "the message holds a six-digit code").toBe(true);
    expect(
      connection.messages[0].includes(`To: ${STORED_EMAIL}\r\n`),
      "the message is addressed to the row's own email",
    ).toBe(true);
    expect(connection.messages[0].includes(selector), "the selector appears in the message").toBe(false);
    expect(connection.closed).toBe(true);
    // The order: the lookup, the issuance, the mail, then the wait.
    expect(edge.events).toEqual([`rpc:${LOOKUP}`, `rpc:${ISSUE}`, "smtp:connect", "wait"]);
    expect(edge.delays).toEqual([RESPONSE_FLOOR_MILLISECONDS]);
  });

  it("ESR-S-010 every exit class from the account lookup on gives the same status, the same headers and, apart from the selector, the same body, with no cookie and one wait", async () => {
    type ExitClass = readonly [string, () => void, ReadonlyArray<string>, number];
    const CLASSES: ReadonlyArray<ExitClass> = [
      ["an unknown email", () => undefined, [LOOKUP], 0],
      [
        "a lookup error",
        () => {
          rpcHandlers[LOOKUP] = () => databaseError(SENTINEL);
        },
        [LOOKUP],
        0,
      ],
      [
        "a lookup server failure",
        () => {
          rpcHandlers[LOOKUP] = () => new Response(JSON.stringify({ message: SENTINEL }), { status: 500, headers: { "Content-Type": "application/json" } });
        },
        [LOOKUP],
        0,
      ],
      [
        "a lookup network failure",
        () => {
          rpcHandlers[LOOKUP] = () => Promise.reject(new TypeError(`fetch failed: ${SENTINEL}`));
        },
        [LOOKUP],
        0,
      ],
      [
        "an ambiguous lookup (two rows)",
        () => {
          rpcHandlers[LOOKUP] = () => rows([accountRow(), accountRow()]);
        },
        [LOOKUP],
        0,
      ],
      [
        "a lookup row with a provider id that is not a UUID",
        () => {
          rpcHandlers[LOOKUP] = () => rows([{ ...accountRow(), provider_user_id: "auth-user-1" }]);
        },
        [LOOKUP],
        0,
      ],
      [
        "eligible, and the budget or lockout denies",
        () => {
          rpcHandlers[LOOKUP] = () => rows([accountRow()]);
          rpcHandlers[ISSUE] = () => rows([{ outcome: "denied" }]);
        },
        [LOOKUP, ISSUE],
        0,
      ],
      [
        "eligible, and the issuance function finds the contact ineligible",
        () => {
          rpcHandlers[LOOKUP] = () => rows([accountRow()]);
          rpcHandlers[ISSUE] = () => databaseError("solmind_issue_ineligible_contact");
        },
        [LOOKUP, ISSUE],
        0,
      ],
      [
        "eligible, and the issuance call fails",
        () => {
          rpcHandlers[LOOKUP] = () => rows([accountRow()]);
          rpcHandlers[ISSUE] = () => new Response(JSON.stringify({ message: SENTINEL }), { status: 503, headers: { "Content-Type": "application/json" } });
        },
        [LOOKUP, ISSUE],
        0,
      ],
      [
        "eligible and issued, and the mail catcher refuses the recipient",
        () => {
          rpcHandlers[LOOKUP] = () => rows([accountRow()]);
          edge.smtp.rcpt = "550 5.1.1 No such user";
        },
        [LOOKUP, ISSUE],
        1,
      ],
      [
        "eligible and issued, and the mail catcher refuses the message",
        () => {
          rpcHandlers[LOOKUP] = () => rows([accountRow()]);
          edge.smtp.message = "451 4.3.0 Try again later";
        },
        [LOOKUP, ISSUE],
        1,
      ],
      [
        "eligible, issued and accepted",
        () => {
          rpcHandlers[LOOKUP] = () => rows([accountRow()]);
        },
        [LOOKUP, ISSUE],
        1,
      ],
    ];
    const bodies = new Set<string>();
    const selectors = new Set<string>();
    for (const [label, arrange, expectedCalls, expectedConnections] of CLASSES) {
      rpcRequests = [];
      edge.connections.length = 0;
      edge.delays.length = 0;
      edge.smtp.rcpt = "250 2.1.5 OK";
      edge.smtp.message = "250 2.0.0 queued";
      rpcHandlers = { [LOOKUP]: () => rows([]), [ISSUE]: () => rows([{ outcome: "issued" }]) };
      arrange();
      const answer = await send(post({ identifier: TYPED_EMAIL }));
      const selector = selectorOf(answer);
      knownSelectors.add(selector);
      expect(answer.status, label).toBe(200);
      expect(isDeepStrictEqual(answer.headers, FIXED_HEADERS), `${label}: the answer carries exactly the fixed headers`).toBe(true);
      expect(answer.setCookies.length === 0, `${label}: no cookie is set`).toBe(true);
      bodies.add(answer.text.replace(selector, "<selector>"));
      expect(selectors.has(selector), `${label}: a selector was reused`).toBe(false);
      selectors.add(selector);
      expect(rpcRequests.map((request) => request.functionName), label).toEqual(expectedCalls);
      expect(edge.connections.length === expectedConnections, `${label}: the number of mail connections`).toBe(true);
      expect(edge.delays, label).toEqual([RESPONSE_FLOOR_MILLISECONDS]);
      // Let a refused dialogue's socket close before the next class.
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
    }
    // One body form for all twelve classes.
    expect([...bodies]).toEqual(['{"acknowledgment":"verification_code_requested","challengeId":"<selector>"}']);
  });

  it("ESR-S-011 a configuration failure is the generic deny before any lookup: a missing pepper, a missing service-role key, and a trusted origin that is not a loopback origin (the local mail transport is never composed for one)", async () => {
    rpcHandlers[LOOKUP] = () => rows([accountRow()]);
    for (const [label, overrides] of [
      ["no pepper", { SOLMIND_VERIFICATION_PEPPER: "" }],
      ["a malformed pepper", { SOLMIND_VERIFICATION_PEPPER: "not-a-pepper" }],
      ["no service-role key", { SUPABASE_SERVICE_ROLE_KEY: "" }],
      ["no Supabase URL", { NEXT_PUBLIC_SUPABASE_URL: "" }],
    ] as const) {
      stubEnvironment(overrides);
      expectDenied(await send(post({ identifier: TYPED_EMAIL })), label);
      expectNoEffect(label);
      vi.unstubAllEnvs();
    }
    for (const hosted of ["https://uat.solmind.example", "http://192.168.1.10:3000", "http://solmind.example"]) {
      stubEnvironment({ SOLMIND_TRUSTED_APP_ORIGIN: hosted });
      // The request is the hosted app's own, so it passes the guard.
      expectDenied(await send(post({ identifier: TYPED_EMAIL }, { requestOrigin: hosted })), hosted);
      expectNoEffect(hosted);
      vi.unstubAllEnvs();
    }
    expect(edge.compositionCalls.length === 7, "the composition was called once for each case").toBe(true);
  });

  it("ESR-S-012 the control for the stand-ins: the transport's createConnection is the scripted replacement, both names of it; another target is refused before any socket exists; and the waiter's timer is the stand-in", async () => {
    const net = await import("node:net");
    expect((net.createConnection as unknown as { isScriptedReplacement?: boolean }).isScriptedReplacement).toBe(true);
    expect(net.connect).toBe(net.createConnection);
    expect(net.default.createConnection).toBe(net.createConnection);
    // Another port, another host, the path form and the port-number form are
    // all refused, and nothing is opened.
    for (const target of [
      [{ host: "127.0.0.1", port: 54321 }],
      [{ host: "localhost", port: 54325 }],
      [{ host: "127.0.0.1", port: 54325, family: 4 }],
      [54325, "127.0.0.1"],
      [{ path: "\\\\.\\pipe\\s68" }],
    ]) {
      expect(() => (net.createConnection as unknown as (...args: unknown[]) => unknown)(...target)).toThrow(
        "test setup: a connection to anything but the scripted mail catcher is refused",
      );
    }
    expect(edge.refusedTargets).toHaveLength(5);
    edge.refusedTargets.length = 0;
    expect(edge.connections.length === 0, "no mail connection was opened").toBe(true);
    expect(realConnect).not.toHaveBeenCalled();

    const timers = await import("node:timers/promises");
    await timers.setTimeout(60_000);
    expect(edge.delays).toEqual([60_000]);
  });
});
