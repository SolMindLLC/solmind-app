// In-memory request/response objects and injected fake fetch only. Fixed labels
// and boolean assertions keep raw fixture values out of reporter diagnostics.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createExplorerSignInBrowserTransport,
  EXPLORER_SIGN_IN_REQUEST_MAX_BYTES,
  EXPLORER_SIGN_IN_RESPONSE_MAX_BYTES,
  type ExplorerSignInBrowserFetch,
  type ExplorerSignInBrowserTransportResult,
} from "../explorerSignInBrowserTransport";

const PRIVATE = "private-transport-fixture-canary";
const NIL = "00000000-0000-0000-0000-000000000000";
const ACK = Object.freeze({ acknowledgment: "verification_code_requested", challengeId: NIL });
const HOME = Object.freeze({ outcome: "signed_in", destination: "/explorer/home" });
const SEND = Object.freeze({ identifier: "  Raw.Mixed@Example.Invalid  " });
const VERIFY = Object.freeze({ ...SEND, challengeId: NIL, code: " 012345 " });
const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;
const encoder = new TextEncoder();
const closed = () => new AbortController();
const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
const factory = (fetcher: ExplorerSignInBrowserFetch, budget = 100) => {
  const transport = createExplorerSignInBrowserTransport({ fetcher, responseBudgetMilliseconds: budget });
  if (transport === null) throw new Error("valid transport fixture rejected");
  return transport;
};
const failed = (value: ExplorerSignInBrowserTransportResult<unknown>, error = "sign_in_browser_transport_failed") => {
  expect(isDeepStrictEqual(value, { ok: false, error }) && Object.isFrozen(value), "fixed frozen failure only").toBe(true);
};
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (value: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  for (const name of CONSOLE_METHODS) vi.spyOn(console, name).mockImplementation(() => undefined);
  vi.stubGlobal("fetch", () => { throw new Error("uninjected network forbidden"); });
});
afterEach(() => {
  const quiet = CONSOLE_METHODS.every(name => vi.mocked(console[name]).mock.calls.length === 0);
  const timersClear = vi.getTimerCount() === 0;
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
  expect(quiet, "no console sink invoked").toBe(true);
  expect(timersClear, "owned timers disposed").toBe(true);
});

describe("factory and pre-dispatch boundary", () => {
  for (const budget of [undefined, null, 0, -1, 0.5, NaN, Infinity, 2_147_483_648, Number.MAX_SAFE_INTEGER]) {
    it("refuses an invalid explicit budget " + String(budget), () => {
      const fetcher = vi.fn<ExplorerSignInBrowserFetch>();
      expect(createExplorerSignInBrowserTransport({ fetcher, responseBudgetMilliseconds: budget as number }) === null, "budget refused").toBe(true);
      expect(fetcher.mock.calls.length === 0, "no request").toBe(true);
    });
  }
  it("requires injected fetch and snapshots valid options without a default", () => {
    expect(createExplorerSignInBrowserTransport({ fetcher: null as never, responseBudgetMilliseconds: 1 }) === null, "missing fetch refused").toBe(true);
    expect(createExplorerSignInBrowserTransport(null as never) === null, "missing options refused").toBe(true);
    const options = { fetcher: vi.fn<ExplorerSignInBrowserFetch>(), responseBudgetMilliseconds: 2_147_483_647 };
    const transport = createExplorerSignInBrowserTransport(options);
    expect(transport !== null && Object.isFrozen(transport), "maximum valid finite budget accepted").toBe(true);
  });
  it("keeps a maximum budget within the timer limit at a fractional clock", async () => {
    vi.spyOn(performance, "now").mockReturnValue(1.3);
    const schedule = vi.spyOn(globalThis, "setTimeout");
    const fetcher = vi.fn<ExplorerSignInBrowserFetch>(() => new Promise<Response>(() => undefined));
    const c = closed(); const remove = vi.spyOn(c.signal, "removeEventListener");
    const result = factory(fetcher, 2_147_483_647).send(SEND, c.signal);
    await flush();
    expect(schedule.mock.calls.length === 1 && schedule.mock.calls[0][1] === 2_147_483_647, "maximum delay never overflows").toBe(true);
    expect(fetcher.mock.calls.length === 1, "one dispatch").toBe(true);
    c.abort(); failed(await result, "sign_in_browser_transport_cancelled");
    expect(remove.mock.calls.length === 1 && fetcher.mock.calls[0][1].signal?.aborted === true, "cancellation disposes ownership").toBe(true);
  });
  it("rejects malformed shapes and pre-aborted calls without dispatch or field getters", async () => {
    const fetcher = vi.fn<ExplorerSignInBrowserFetch>(); const t = factory(fetcher); const c = closed();
    let reads = 0;
    failed(await t.send({ get identifier() { reads++; return PRIVATE; } }, c.signal));
    failed(await t.send({ ...SEND, role: "explorer" }, c.signal));
    failed(await t.verify({ identifier: PRIVATE }, c.signal));
    c.abort(); failed(await t.send(SEND, c.signal), "sign_in_browser_transport_cancelled");
    expect(fetcher.mock.calls.length === 0 && reads === 0, "zero dispatch and getter reads").toBe(true);
  });
  it("rejects a proven oversized raw or escaped request before encoding", async () => {
    const fetcher = vi.fn<ExplorerSignInBrowserFetch>(); const t = factory(fetcher);
    const encode = vi.spyOn(TextEncoder.prototype, "encode");
    failed(await t.send({ identifier: "x".repeat(20_000) }, closed().signal));
    failed(await t.send({ identifier: "\0".repeat(3_000) }, closed().signal));
    expect(fetcher.mock.calls.length === 0 && encode.mock.calls.length === 0, "no request or oversized encoding").toBe(true);
  });
  it("rechecks the deadline immediately before dispatch", async () => {
    const fetcher = vi.fn<ExplorerSignInBrowserFetch>(); const t = factory(fetcher);
    vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(100);
    failed(await t.send(SEND, closed().signal), "sign_in_browser_transport_timed_out");
    expect(fetcher.mock.calls.length === 0, "expired operation never dispatches").toBe(true);
  });
});

describe("request and response contract", () => {
  for (const operation of ["send", "verify"] as const) it("uses one exact private POST for " + operation, async () => {
    let request: Request | null = null; let path = ""; let seen: RequestInit | undefined;
    const fetcher = vi.fn<ExplorerSignInBrowserFetch>(async (p, init) => {
      path = p; seen = init; request = new Request("https://example.invalid" + p, init);
      return json(operation === "send" ? ACK : HOME);
    });
    const c = closed(); const remove = vi.spyOn(c.signal, "removeEventListener");
    const t = factory(fetcher); const result = await t[operation](operation === "send" ? SEND : VERIFY, c.signal);
    const snapshot = request as Request | null;
    expect(snapshot !== null, "request captured in memory").toBe(true);
    const body: unknown = await snapshot!.json();
    expect(isDeepStrictEqual(body, operation === "send" ? SEND : VERIFY), "raw exact body preserved").toBe(true);
    expect(path === "/login/explorer/" + operation && fetcher.mock.calls.length === 1, "one fixed endpoint").toBe(true);
    expect(seen?.method === "POST" && seen.credentials === "same-origin" && seen.cache === "no-store" && seen.redirect === "error", "fixed request options").toBe(true);
    const headers = new Headers(seen?.headers);
    expect(headers.get("content-type") === "application/json; charset=utf-8" && headers.get("accept") === "application/json" && !headers.has("origin"), "exact framing without synthesized origin").toBe(true);
    expect(seen?.signal !== c.signal && seen?.signal instanceof AbortSignal && !seen.signal.aborted, "owned request cancellation").toBe(true);
    expect(result.ok && isDeepStrictEqual(result.value, operation === "send" ? ACK : HOME) && Object.isFrozen(result), "exact parsed reply").toBe(true);
    expect(remove.mock.calls.length === 1, "caller listener removed").toBe(true);
  });
  for (const value of [ACK, { outcome: "invalid_email" }, { outcome: "denied" }]) it("accepts a closed send reply " + Object.keys(value)[0], async () => {
    const result = await factory(async () => json(value)).send(SEND, closed().signal);
    expect(result.ok && isDeepStrictEqual(result.value, value) && Object.isFrozen(result.value), "closed send reply including nil selector").toBe(true);
  });
  for (const value of [HOME, { outcome: "code_not_accepted" }, { outcome: "denied" }]) it("accepts a closed verify reply " + value.outcome, async () => {
    const result = await factory(async () => json(value)).verify(VERIFY, closed().signal);
    expect(result.ok && isDeepStrictEqual(result.value, value), "closed verify reply").toBe(true);
  });
  it("enforces exact request byte bounds and unchanged multibyte text", async () => {
    const fetcher = vi.fn<ExplorerSignInBrowserFetch>(async () => json(ACK)); const t = factory(fetcher);
    const overhead = encoder.encode(JSON.stringify({ identifier: "" })).byteLength;
    const exact = { identifier: "x".repeat(EXPLORER_SIGN_IN_REQUEST_MAX_BYTES - overhead) };
    expect((await t.send(exact, closed().signal)).ok, "exact request byte limit accepted").toBe(true);
    failed(await t.send({ identifier: exact.identifier + "x" }, closed().signal));
    failed(await t.send({ identifier: "\u20ac".repeat(6_000) }, closed().signal));
    const unicode = { identifier: "\u20ac\ud83d\ude00\ud800\0" };
    expect((await t.send(unicode, closed().signal)).ok, "raw multibyte and escaped strings accepted as shape").toBe(true);
    expect(fetcher.mock.calls.length === 2 && isDeepStrictEqual(JSON.parse(fetcher.mock.calls[1][1].body as string), unicode), "byte refusals made no request and raw text survived").toBe(true);
  });
  it("accepts exact response byte ceiling and refuses one byte over", async () => {
    const text = JSON.stringify(ACK); const padding = EXPLORER_SIGN_IN_RESPONSE_MAX_BYTES - encoder.encode(text).byteLength;
    const exact = " ".repeat(padding) + text;
    expect((await factory(async () => new Response(exact, { headers: { "content-type": "application/json" } })).send(SEND, closed().signal)).ok, "exact response ceiling accepted").toBe(true);
    failed(await factory(async () => new Response(" " + exact, { headers: { "content-type": "application/json" } })).send(SEND, closed().signal));
  });
  it("parses a streamed reply split across many byte chunks and releases its reader", async () => {
    const bytes = encoder.encode(JSON.stringify(ACK));
    const stream = new ReadableStream<Uint8Array>({ start(c) { for (const b of bytes) c.enqueue(new Uint8Array([b])); c.close(); } });
    const result = await factory(async () => new Response(stream, { headers: { "content-type": "Application/JSON; charset=UTF-8" } })).send(SEND, closed().signal);
    expect(result.ok && !stream.locked, "chunked reply and reader release").toBe(true);
  });
  const badBytes = [new Uint8Array(), encoder.encode("{"), encoder.encode("[]"), encoder.encode("null"), new Uint8Array([0xc3, 0x28]), new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d])];
  for (let n = 0; n < badBytes.length; n++) it("refuses malformed bytes case " + n, async () => {
    failed(await factory(async () => new Response(badBytes[n], { headers: { "content-type": "application/json" } })).send(SEND, closed().signal));
  });
  for (const contentType of ["text/plain", "application/jsonp", "application/json; charset=latin1", "application/json; other=yes", ""]) it("refuses unexpected media type case " + contentType.length, async () => {
    failed(await factory(async () => new Response(JSON.stringify(ACK), { headers: { "content-type": contentType } })).send(SEND, closed().signal));
  });
  it("refuses non-200, redirect, missing body and mismatched or extra reply shapes", async () => {
    const redirected = json(ACK); Object.defineProperty(redirected, "redirected", { value: true });
    for (const response of [new Response("{}", { status: 400 }), redirected, new Response(null, { headers: { "content-type": "application/json" } }), json({ ...ACK, extra: PRIVATE }), json(HOME)]) {
      failed(await factory(async () => response).send(SEND, closed().signal));
    }
    failed(await factory(async () => json({ ...HOME, destination: "https://example.invalid" })).verify(VERIFY, closed().signal));
  });
});

describe("cancellation, deadlines and resource ownership", () => {
  it("cancels a stalled fetch once and consumes its later rejection unread", async () => {
    const pending = deferred<Response>(); const fetcher = vi.fn<ExplorerSignInBrowserFetch>(() => pending.promise);
    const c = closed(); const result = factory(fetcher).send(SEND, c.signal); await flush(); c.abort();
    failed(await result, "sign_in_browser_transport_cancelled");
    let reads = 0; pending.reject(new Proxy({}, { get() { reads++; throw new Error(PRIVATE); } })); await flush();
    expect(fetcher.mock.calls.length === 1 && reads === 0 && fetcher.mock.calls[0][1].signal?.aborted === true, "one attempt, aborted owned signal, unread error").toBe(true);
  });
  it("times out a stalled fetch and disposes a late successful body without late success", async () => {
    const pending = deferred<Response>(); let cancelled = 0;
    const fetcher = vi.fn<ExplorerSignInBrowserFetch>(() => pending.promise);
    const result = factory(fetcher).send(SEND, closed().signal);
    await vi.advanceTimersByTimeAsync(100); failed(await result, "sign_in_browser_transport_timed_out");
    pending.resolve(new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { "content-type": "application/json" } }));
    await flush(); expect(cancelled === 1 && fetcher.mock.calls.length === 1, "late body cancelled without retry").toBe(true);
  });
  for (const end of ["abort", "timeout"] as const) it("settles stalled body despite nonsettling cleanup on " + end, async () => {
    let cancellations = 0;
    const stream = new ReadableStream<Uint8Array>({ pull() { return new Promise<void>(() => undefined); }, cancel() { cancellations++; return new Promise<void>(() => undefined); } });
    const c = closed(); const response = new Response(stream, { headers: { "content-type": "application/json" } });
    const result = factory(async () => response).send(SEND, c.signal); await flush();
    expect(stream.locked, "read actually began").toBe(true);
    if (end === "abort") c.abort(); else await vi.advanceTimersByTimeAsync(100);
    failed(await result, end === "abort" ? "sign_in_browser_transport_cancelled" : "sign_in_browser_transport_timed_out");
    expect(!stream.locked && cancellations === 1, "cancel attempted once and reader released without waiting").toBe(true);
  });
  it("consumes a throwing stream and failed cleanup without exposing values", async () => {
    const stream = new ReadableStream<Uint8Array>({ pull(c) { c.error(new Error(PRIVATE)); }, cancel() { return Promise.reject(new Error(PRIVATE)); } });
    failed(await factory(async () => new Response(stream, { headers: { "content-type": "application/json" } })).send(SEND, closed().signal));
    expect(!stream.locked, "failed reader released").toBe(true);
  });
  it("rechecks a strict deadline after parsing even when the timer has not fired", async () => {
    let now = 0; vi.spyOn(performance, "now").mockImplementation(() => now);
    const response = json(ACK); const parse = JSON.parse;
    vi.spyOn(JSON, "parse").mockImplementation((text: string) => { const value: unknown = parse(text); now = 100; return value; });
    failed(await factory(async () => response).send(SEND, closed().signal), "sign_in_browser_transport_timed_out");
  });
  it("rechecks cancellation after parsing and never returns an accepted stale reply", async () => {
    const c = closed(); const response = json(ACK); const parse = JSON.parse;
    vi.spyOn(JSON, "parse").mockImplementation((text: string) => { const value: unknown = parse(text); c.abort(); return value; });
    failed(await factory(async () => response).send(SEND, c.signal), "sign_in_browser_transport_cancelled");
  });
  it("fails closed on thrown fetch and malformed response metadata without inspecting exceptions", async () => {
    let reads = 0; const error = new Proxy({}, { get() { reads++; throw new Error(PRIVATE); } });
    failed(await factory(() => { throw error; }).send(SEND, closed().signal));
    const response = json(ACK); Object.defineProperty(response, "status", { get() { throw error; } });
    failed(await factory(async () => response).send(SEND, closed().signal));
    expect(reads === 0, "exception values never inspected").toBe(true);
  });
  it("checks deadline at response arrival and discards that body's resources", async () => {
    let now = 0; let cancelled = 0; vi.spyOn(performance, "now").mockImplementation(() => now);
    const response = new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { "content-type": "application/json" } });
    failed(await factory(async () => { now = 100; return response; }).send(SEND, closed().signal), "sign_in_browser_transport_timed_out");
    expect(cancelled === 1, "arrived but expired body disposed").toBe(true);
  });
});

it("imports only the browser contract and contains no UI, persistence or server dependency", () => {
  const text = fs.readFileSync(fileURLToPath(new URL("../explorerSignInBrowserTransport.ts", import.meta.url)), "utf8");
  const source = ts.createSourceFile("transport.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const imports: string[] = []; const names: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    if (ts.isIdentifier(node)) names.push(node.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  expect(isDeepStrictEqual(imports, ["./signInBrowserContract"]), "one reviewed browser contract import").toBe(true);
  const forbidden = ["process", "console", "localStorage", "sessionStorage", "document", "window", "location", "eval", "Function", "fetch"];
  expect(!names.some(name => forbidden.includes(name)), "no ambient fetch, UI, storage or logging references").toBe(true);
});
