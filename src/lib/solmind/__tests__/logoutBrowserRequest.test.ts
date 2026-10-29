// Fake fetch/streams only. Boolean assertions and intercepted diagnostics keep
// returned data and exception objects out of reporter output.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogoutBrowserRequest, type LogoutBrowserFetch, type LogoutBrowserResult } from "../logoutBrowserRequest";

const METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;
const encoder = new TextEncoder();
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
const signedOut = () => json({ outcome: "signed_out" });
const factory = (fetcher: LogoutBrowserFetch, responseBudgetMs = 100) => {
  const client = createLogoutBrowserRequest({ fetch: fetcher, responseBudgetMs });
  if (client === null) throw new Error("valid fixture refused");
  return client;
};
const resultIs = (result: LogoutBrowserResult, outcome: LogoutBrowserResult["outcome"]) => {
  expect(isDeepStrictEqual(result, { outcome }) && Object.isFrozen(result), "closed frozen result").toBe(true);
};
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  for (const method of METHODS) vi.spyOn(console, method).mockImplementation(() => undefined);
  vi.stubGlobal("fetch", () => { throw new Error("uninjected network forbidden"); });
});
afterEach(() => {
  const quiet = METHODS.every(method => vi.mocked(console[method]).mock.calls.length === 0);
  const timersClear = vi.getTimerCount() === 0;
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
  expect(quiet, "no console sink invoked").toBe(true);
  expect(timersClear, "all owned timers cleared").toBe(true);
});

describe("configuration and fixed dispatch", () => {
  for (const [index, budget] of [undefined, null, 0, -1, 0.5, NaN, Infinity, 2_147_483_648].entries()) {
    it("refuses invalid explicit budget " + index, () => {
      const fetcher = vi.fn<LogoutBrowserFetch>();
      expect(createLogoutBrowserRequest({ fetch: fetcher, responseBudgetMs: budget as number }) === null, "invalid config refused").toBe(true);
      expect(fetcher.mock.calls.length === 0, "no fetch during construction").toBe(true);
    });
  }
  it("fails closed on absent or throwing configuration", () => {
    expect(createLogoutBrowserRequest(null as never) === null, "null refused").toBe(true);
    expect(createLogoutBrowserRequest({ fetch: null as never, responseBudgetMs: 1 }) === null, "fetch required").toBe(true);
    expect(createLogoutBrowserRequest({ get fetch(): LogoutBrowserFetch { throw new Error("controlled"); }, responseBudgetMs: 1 }) === null, "getter throw closed").toBe(true);
  });
  it("snapshots injected capabilities and sends only the exact fixed request", async () => {
    const fetcher = vi.fn<LogoutBrowserFetch>(async () => signedOut());
    const options: { fetch: LogoutBrowserFetch; responseBudgetMs: number } = { fetch: fetcher, responseBudgetMs: 30_000 };
    const client = createLogoutBrowserRequest(options)!;
    options.fetch = async () => { throw new Error("replacement unused"); };
    options.responseBudgetMs = 0;
    resultIs(await client.request(), "signed_out");
    const [path, init] = fetcher.mock.calls[0];
    const expected = { method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
      headers: { Accept: "application/json", "Content-Type": "application/json" }, body: "{}", signal: init.signal };
    expect(fetcher.mock.calls.length === 1 && path === "/logout" && isDeepStrictEqual(init, expected), "one exact request, no extra authority fields").toBe(true);
    expect(init.signal instanceof AbortSignal && !init.signal.aborted && Object.isFrozen(client), "owned signal and immutable interface").toBe(true);
  });
  it("clamps the maximum timer at a fractional monotonic clock", async () => {
    vi.spyOn(performance, "now").mockReturnValue(1.3);
    const schedule = vi.spyOn(globalThis, "setTimeout");
    const fetcher = vi.fn<LogoutBrowserFetch>(() => new Promise(() => undefined));
    const client = factory(fetcher, 2_147_483_647);
    const pending = client.request();
    expect(schedule.mock.calls.length === 1 && schedule.mock.calls[0][1] === 2_147_483_647, "no timer overflow").toBe(true);
    client.cancel(); resultIs(await pending, "cancelled");
    expect(fetcher.mock.calls[0][1].signal?.aborted === true, "signal aborted").toBe(true);
  });
  it("refuses expiry immediately before dispatch", async () => {
    vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(100);
    const fetcher = vi.fn<LogoutBrowserFetch>();
    resultIs(await factory(fetcher).request(), "unavailable");
    expect(fetcher.mock.calls.length === 0, "expired request not started").toBe(true);
  });
  for (const now of [NaN, Infinity, -Infinity]) it("rejects nonfinite initial clock " + String(now), async () => {
    vi.spyOn(performance, "now").mockReturnValue(now);
    const fetcher = vi.fn<LogoutBrowserFetch>();
    resultIs(await factory(fetcher).request(), "unavailable");
    expect(fetcher.mock.calls.length === 0, "invalid clock no dispatch").toBe(true);
  });
});

describe("closed response", () => {
  for (const outcome of ["signed_out", "no_current_sign_in", "sign_out_unconfirmed", "denied"] as const) {
    it("preserves valid server outcome " + outcome, async () => {
      resultIs(await factory(async () => json({ outcome })).request(), outcome);
    });
  }
  for (const media of ["application/json", "Application/JSON; Charset=UTF-8", "application/json; charset = utf-8"]) {
    it("accepts supported media " + media, async () => {
      const response = signedOut(); response.headers.set("content-type", media);
      resultIs(await factory(async () => response).request(), "signed_out");
    });
  }
  for (const [index, media] of ["text/plain", "application/problem+json", "application/json; charset=latin1", "application/json; extra=yes", ""].entries()) {
    it("refuses unsupported media " + index, async () => {
      const response = signedOut(); response.headers.set("content-type", media);
      resultIs(await factory(async () => response).request(), "unavailable");
    });
  }
  for (const status of [201, 204, 302, 400, 500]) it("refuses status " + status, async () => {
    const response = new Response(status === 204 ? null : '{"outcome":"signed_out"}', { status, headers: { "content-type": "application/json" } });
    resultIs(await factory(async () => response).request(), "unavailable");
  });
  it("refuses a followed redirect and a missing body", async () => {
    const response = signedOut(); Object.defineProperty(response, "redirected", { value: true });
    resultIs(await factory(async () => response).request(), "unavailable");
    resultIs(await factory(async () => new Response(null, { headers: { "content-type": "application/json" } })).request(), "unavailable");
  });
  for (const [index, value] of [null, [], {}, { outcome: 1 }, { outcome: "success" }, { outcome: "signed_out", message: "controlled" }, { outcome: "signed_out", destination: "/explorer/home" }].entries()) {
    it("rejects malformed or expanded JSON " + index, async () => {
      resultIs(await factory(async () => json(value)).request(), "unavailable");
    });
  }
  it("does not invoke accessor fields or trust symbols or inherited outcomes", async () => {
    let reads = 0;
    const accessor = Object.defineProperty({}, "outcome", { enumerable: true, get() { reads++; return "signed_out"; } });
    const hidden = Object.defineProperty({}, "outcome", { enumerable: false, value: "signed_out" });
    const symbol = { outcome: "signed_out", [Symbol("extra")]: true };
    const inherited = Object.create({ outcome: "signed_out" });
    for (const value of [accessor, hidden, symbol, inherited]) {
      const response = signedOut();
      const parse = vi.spyOn(JSON, "parse").mockReturnValueOnce(value);
      const result = await factory(async () => response).request(); parse.mockRestore();
      resultIs(result, "unavailable");
    }
    expect(reads === 0, "accessor untouched").toBe(true);
  });
  for (const [index, bytes] of [new Uint8Array(), encoder.encode("{"), new Uint8Array([0xc0, 0xaf]), new Uint8Array([0xef, 0xbb, 0xbf, ...encoder.encode('{"outcome":"signed_out"}')])].entries()) {
    it("refuses incomplete, malformed UTF8 or BOM response " + index, async () => {
      resultIs(await factory(async () => new Response(bytes, { headers: { "content-type": "application/json" } })).request(), "unavailable");
    });
  }
  it("accepts exactly 1024 bytes split across chunks and rejects 1025 aggregate bytes", async () => {
    const text = '{"outcome":"signed_out"}';
    for (const count of [1024, 1025]) {
      const bytes = encoder.encode(text.padEnd(count, " "));
      const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes.slice(0, 15)); c.enqueue(bytes.slice(15)); c.close(); } });
      resultIs(await factory(async () => new Response(body, { headers: { "content-type": "application/json" } })).request(), count === 1024 ? "signed_out" : "unavailable");
    }
  });
});

describe("operation lifetime and resource handling", () => {
  it("starts one operation synchronously, ignores duplicates and permits only a later explicit new action", async () => {
    const response = deferred<Response>(); const fetcher = vi.fn<LogoutBrowserFetch>(() => response.promise);
    const client = factory(fetcher); const first = client.request();
    resultIs(await client.request(), "busy");
    expect(fetcher.mock.calls.length === 1, "duplicate did not dispatch").toBe(true);
    response.resolve(signedOut()); resultIs(await first, "signed_out");
    fetcher.mockImplementation(async () => json({ outcome: "denied" }));
    resultIs(await client.request(), "denied");
    expect(fetcher.mock.calls.length === 2, "one later explicit request").toBe(true);
  });
  it("invalidates before synchronous abort observers and never publishes the old late success", async () => {
    const old = deferred<Response>(); let replacement: Promise<LogoutBrowserResult> | undefined;
    let calls = 0; let cancelled = 0;
    const fetcher: LogoutBrowserFetch = (_path, init) => {
      if (++calls === 1) { init.signal!.addEventListener("abort", () => { replacement = client.request(); }, { once: true }); return old.promise; }
      return Promise.resolve(json({ outcome: "denied" }));
    };
    const client = factory(fetcher); const first = client.request(); client.cancel();
    resultIs(await first, "cancelled"); resultIs(await replacement!, "denied");
    old.resolve(new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { "content-type": "application/json" } }));
    await flush(); expect(calls === 2 && cancelled === 1, "old body discarded, replacement not overwritten").toBe(true);
  });
  it("dispose prevents all future dispatch and consumes late rejection", async () => {
    const response = deferred<Response>(); const fetcher = vi.fn<LogoutBrowserFetch>(() => response.promise);
    const client = factory(fetcher); const pending = client.request(); client.dispose();
    resultIs(await pending, "cancelled"); resultIs(await client.request(), "cancelled");
    response.reject(new Error("controlled rejection")); await flush();
    expect(fetcher.mock.calls.length === 1, "disposed no dispatch or retry").toBe(true);
  });
  it("times out a stalled fetch, aborts once and disposes its late body", async () => {
    const response = deferred<Response>(); const fetcher = vi.fn<LogoutBrowserFetch>(() => response.promise);
    const pending = factory(fetcher).request(); await vi.advanceTimersByTimeAsync(100);
    resultIs(await pending, "unavailable");
    let cancelled = 0; response.resolve(new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { "content-type": "application/json" } }));
    await flush();
    expect(fetcher.mock.calls.length === 1 && fetcher.mock.calls[0][1].signal?.aborted === true && cancelled === 1, "one timeout, late body disposed, no retry").toBe(true);
  });
  for (const kind of ["cancel", "timeout"] as const) it("settles a stalled body with nonsettling cleanup on " + kind, async () => {
    let cancels = 0;
    const body = new ReadableStream<Uint8Array>({ cancel() { cancels++; return new Promise<void>(() => undefined); } });
    const client = factory(async () => new Response(body, { headers: { "content-type": "application/json" } }));
    const pending = client.request(); await flush();
    if (kind === "cancel") client.cancel(); else await vi.advanceTimersByTimeAsync(100);
    resultIs(await pending, kind === "cancel" ? "cancelled" : "unavailable");
    expect(cancels === 1 && !body.locked, "reader cancellation and lock release without waiting for cleanup").toBe(true);
  });
  it("checks the deadline after JSON validation even when the timer has not fired", async () => {
    let now = 0; vi.spyOn(performance, "now").mockImplementation(() => now);
    const response = signedOut(); const originalParse = JSON.parse;
    const parse = vi.spyOn(JSON, "parse").mockImplementation((text: string) => { now = 100; return originalParse(text); });
    const result = await factory(async () => response).request(); parse.mockRestore();
    resultIs(result, "unavailable");
  });
  it("fails closed on a backwards clock and discards an expired arriving body", async () => {
    for (const finalNow of [-1, 100]) {
      let now = 0; const clock = vi.spyOn(performance, "now").mockImplementation(() => now); let cancels = 0;
      const body = new ReadableStream({ cancel() { cancels++; } });
      resultIs(await factory(async () => { now = finalNow; return new Response(body, { headers: { "content-type": "application/json" } }); }).request(), "unavailable");
      expect(cancels === 1, "unusable arriving body cancelled").toBe(true); clock.mockRestore();
    }
  });
  it("refuses errors without inspecting or logging thrown objects", async () => {
    let reads = 0; const error = new Proxy({}, { get() { reads++; throw new Error("controlled"); } });
    resultIs(await factory(() => { throw error; }).request(), "unavailable");
    const response = signedOut(); Object.defineProperty(response, "status", { get() { throw error; } });
    resultIs(await factory(async () => response).request(), "unavailable");
    const body = new ReadableStream<Uint8Array>({ pull(c) { c.error(error); } });
    resultIs(await factory(async () => new Response(body, { headers: { "content-type": "application/json" } })).request(), "unavailable");
    expect(reads === 0 && !body.locked, "opaque errors, released body lock").toBe(true);
  });
});

it("stays dependency-free without browser storage, credentials, server modules or logging", () => {
  const text = fs.readFileSync(fileURLToPath(new URL("../logoutBrowserRequest.ts", import.meta.url)), "utf8");
  const source = ts.createSourceFile("logout.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let imports = 0; const names: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) imports++;
    if (ts.isIdentifier(node)) names.push(node.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  expect(imports === 0, "no runtime/server dependency").toBe(true);
  expect(!names.some(name => ["process", "console", "localStorage", "sessionStorage", "document", "window", "location", "cookie", "eval", "Function"].includes(name)), "no authority storage, UI or logs").toBe(true);
});
