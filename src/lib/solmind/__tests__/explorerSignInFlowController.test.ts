import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isDeepStrictEqual } from "node:util";
import { readFileSync } from "node:fs";
import ts from "typescript";
import {
  createExplorerSignInFlowController,
  type ExplorerSignInFlowController,
  type ExplorerSignInFlowAction,
} from "../explorerSignInFlowController";

const RAW = "  private-flow-fixture-canary+Explorer@Example.invalid\t";
const RAW_CODE = "  private-flow-fixture-canary-code\n";
const FIRST = "10000000-0000-0000-0000-000000000001";
const SECOND = "20000000-0000-0000-0000-000000000002";
const NIL = "00000000-0000-0000-0000-000000000000";
const BUDGET = 250;
const flows: ExplorerSignInFlowController[] = [];
const sinks = ["log", "info", "warn", "error", "debug", "trace"] as const;
let consoleQuiet: () => boolean;
const check = (value: boolean) => expect(value).toBe(true);
const same = (actual: unknown, expected: unknown) => check(isDeepStrictEqual(actual, expected));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}
const acknowledgment = (flowId = FIRST) => ({ acknowledgment: "verification_code_requested", flowId });
const success = () => ({ outcome: "signed_in", destination: "/explorer/home" });

function setup(budget = BUDGET) {
  let generated = 0;
  const calls: Array<{ path: string; init: RequestInit; reply: ReturnType<typeof deferred<Response>> }> = [];
  const flow = createExplorerSignInFlowController({
    createFlowId: () => generated++ === 0 ? FIRST : SECOND,
    responseBudgetMilliseconds: budget,
    fetcher: (path, init) => {
      const reply = deferred<Response>();
      calls.push({ path, init, reply });
      return reply.promise;
    },
  });
  if (flow === null) throw new Error("Flow fixture construction failed");
  flows.push(flow);
  flow.setIdentifier(RAW);
  return { flow, calls };
}
async function enterCode(fixture: ReturnType<typeof setup>, selector = FIRST) {
  const completion = fixture.flow.send();
  fixture.calls.at(-1)!.reply.resolve(json(acknowledgment(selector)));
  same(await completion, "settled");
}
async function begin(action: ExplorerSignInFlowAction) {
  const fixture = setup();
  if (action !== "send") await enterCode(fixture);
  const completion = action === "verify" ? fixture.flow.verify(RAW_CODE) : fixture.flow[action]();
  return { ...fixture, completion, call: fixture.calls.at(-1)! };
}
async function flush() { for (let i = 0; i < 20; i += 1) await Promise.resolve(); }
function cleanProjection(flow: ExplorerSignInFlowController) {
  const view = flow.read();
  same(Object.keys(view).sort(), ["destination", "hasSelector", "identifier", "outcome", "pending", "stage"]);
  check(Object.isFrozen(view));
  const serialized = JSON.stringify(view);
  check(!serialized.includes(FIRST) && !serialized.includes(SECOND) && !serialized.includes(RAW_CODE));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  const spies = sinks.map(name => vi.spyOn(console, name).mockImplementation(() => undefined));
  consoleQuiet = () => spies.every(spy => spy.mock.calls.length === 0);
  vi.stubGlobal("fetch", () => { throw new Error("Uninjected network forbidden"); });
});
afterEach(async () => {
  for (const flow of flows.splice(0)) flow.dispose();
  await flush();
  const quiet = consoleQuiet();
  const noTimers = vi.getTimerCount() === 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  check(quiet);
  check(noTimers);
});

describe("Explorer flow configuration and projection", () => {
  it.each([0, -1, 0.5, NaN, Infinity, 2_147_483_648, undefined, null])("F01 rejects invalid explicit budget %#", budget => {
    const value = createExplorerSignInFlowController({
    createFlowId: () => FIRST, fetcher: async () => json({}), responseBudgetMilliseconds: budget as number });
    same(value, null);
  });
  it("F02 fails closed on missing or hostile configuration without inspecting thrown values", () => {
    let touched = false;
    const failure = Object.defineProperty({}, "message", { get() { touched = true; return RAW_CODE; } });
    const options = Object.defineProperty({}, "fetcher", { get() { throw failure; } });
    same(createExplorerSignInFlowController(options as Parameters<typeof createExplorerSignInFlowController>[0]), null);
    same(createExplorerSignInFlowController(null as unknown as Parameters<typeof createExplorerSignInFlowController>[0]), null);
    check(!touched);
  });
  it("F03 exposes only detached frozen projections and a frozen closed API", () => {
    const { flow } = setup();
    check(Object.isFrozen(flow));
    cleanProjection(flow);
    const first = flow.read();
    flow.setIdentifier("replacement");
    same(first.identifier, RAW);
    same(flow.read(), { stage: "email", identifier: "replacement", pending: null, outcome: null, hasSelector: false, destination: null });
    check(first !== flow.read());
  });
  it("F04 ignores non-string input without invoking accessors or coercion", async () => {
    const { flow, calls } = setup();
    let touched = false;
    const hostile = { get identifier() { touched = true; return RAW; }, toString() { touched = true; return RAW_CODE; } };
    for (const value of [undefined, null, 1, false, {}, [], hostile, Symbol("fixed")]) {
      same(flow.setIdentifier(value), "ignored");
      same(await flow.verify(value), "ignored");
    }
    check(!touched && calls.length === 0 && flow.read().identifier === RAW);
  });
  it("F05 adds no React, DOM, storage, logs, environment, timers, navigation or ambient network seam", () => {
    const source = readFileSync(new URL("../explorerSignInFlowController.ts", import.meta.url), "utf8");
    const ast = ts.createSourceFile("controller.ts", source, ts.ScriptTarget.Latest, true);
    const imports: string[] = [];
    const identifiers: string[] = [];
    function visit(node: ts.Node) {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
      if (ts.isIdentifier(node)) identifiers.push(node.text);
      ts.forEachChild(node, visit);
    }
    visit(ast);
    same(imports, ["./signInBrowserContract", "./explorerSignInBrowserTransport"]);
    check(!identifiers.some(name => ["fetch", "window", "document", "location", "localStorage", "sessionStorage", "console", "process", "setTimeout", "setInterval", "require", "eval"].includes(name)));
  });
});

describe("Explorer send, resend and verify", () => {
  it("F06 sets pending before dispatch and suppresses all duplicate and cross-operation calls", async () => {
    const { flow, calls } = setup();
    const pending = flow.send();
    same(flow.read().pending, "send");
    same(await flow.send(), "ignored");
    same(await flow.resend(), "ignored");
    same(await flow.verify(RAW_CODE), "ignored");
    same(calls.length, 1);
    same(calls[0].path, "/login/explorer/send");
    same(JSON.parse(calls[0].init.body as string), { identifier: RAW, flowId: FIRST });
    calls[0].reply.resolve(json(acknowledgment()));
    same(await pending, "settled");
    same(flow.read().stage, "code");
    same(flow.read().outcome, "verification_code_requested");
    cleanProjection(flow);
  });
  it("F07 accepts an empty raw identifier without a new client semantic rule", async () => {
    const fixture = setup();
    fixture.flow.setIdentifier("");
    const pending = fixture.flow.send();
    same(JSON.parse(fixture.calls[0].init.body as string), { identifier: "", flowId: FIRST });
    fixture.calls[0].reply.resolve(json({ outcome: "invalid_email" }));
    same(await pending, "settled");
  });
  it.each(["invalid_email", "denied"])("F08 preserves the actual send refusal %s", async outcome => {
    const { flow, calls } = setup();
    const pending = flow.send();
    calls[0].reply.resolve(json({ outcome }));
    same(await pending, "settled");
    same(flow.read(), { stage: "email", identifier: RAW, pending: null, outcome, hasSelector: false, destination: null });
    same(calls.length, 1);
    await vi.advanceTimersByTimeAsync(BUDGET * 2);
    same(calls.length, 1);
  });
  it("F09 refuses a nil or unrelated echoed flow without replacing the owned ID", async () => {
    const fixture = setup();
    await enterCode(fixture, NIL);
    same(fixture.flow.read().stage, "email");
    same(fixture.flow.read().outcome, "sign_in_browser_transport_failed");
    const retry = fixture.flow.send();
    same(JSON.parse(fixture.calls.at(-1)!.init.body as string), { identifier: RAW, flowId: FIRST });
    fixture.calls.at(-1)!.reply.resolve(json(acknowledgment())); await retry;
    const pending = fixture.flow.verify(RAW_CODE);
    const call = fixture.calls.at(-1)!;
    same(call.path, "/login/explorer/verify");
    same(JSON.parse(call.init.body as string), { identifier: RAW, flowId: FIRST, code: RAW_CODE });
    cleanProjection(fixture.flow);
    call.reply.resolve(json({ outcome: "code_not_accepted" }));
    same(await pending, "settled");
    cleanProjection(fixture.flow);
  });
  it("F10 retains the same owned flow across resend and never replaces it with a private challenge", async () => {
    const fixture = setup();
    await enterCode(fixture);
    const pending = fixture.flow.resend();
    same(fixture.flow.read().pending, "resend");
    check(fixture.flow.read().hasSelector);
    same(await fixture.flow.verify(RAW_CODE), "ignored");
    same(await fixture.flow.send(), "ignored");
    same(await fixture.flow.resend(), "ignored");
    fixture.calls.at(-1)!.reply.resolve(json(acknowledgment()));
    same(await pending, "settled");
    const verify = fixture.flow.verify(RAW_CODE);
    same(JSON.parse(fixture.calls.at(-1)!.init.body as string), { identifier: RAW, flowId: FIRST, code: RAW_CODE });
    fixture.calls.at(-1)!.reply.resolve(json({ outcome: "denied" }));
    same(await verify, "settled");
    cleanProjection(fixture.flow);
  });
  it.each(["denied", "invalid_email", "network", "malformed", "timeout"])("F11 uncertain resend retains the same flow for the next explicit verification: %s", async failure => {
    const fixture = setup();
    await enterCode(fixture);
    const pending = fixture.flow.resend();
    const call = fixture.calls.at(-1)!;
    if (failure === "network") call.reply.reject({ private: RAW_CODE });
    else if (failure === "malformed") call.reply.resolve(json({ outcome: "signed_in", destination: "/explorer/home" }));
    else if (failure === "timeout") await vi.advanceTimersByTimeAsync(BUDGET);
    else call.reply.resolve(json({ outcome: failure }));
    same(await pending, "settled");
    same(fixture.flow.read().stage, "code");
    check(fixture.flow.read().hasSelector);
    same(fixture.calls.length, 2);
    const retry = fixture.flow.verify(RAW_CODE);
    same(JSON.parse(fixture.calls.at(-1)!.init.body as string), { identifier: RAW, flowId: FIRST, code: RAW_CODE });
    fixture.calls.at(-1)!.reply.resolve(json({ outcome: "code_not_accepted" }));
    same(await retry, "settled");
    check(fixture.flow.read().hasSelector);
  });
  it.each(["code_not_accepted", "denied"])("F12 keeps opaque verify refusal without choosing UI copy: %s", async outcome => {
    const fixture = setup();
    await enterCode(fixture);
    const pending = fixture.flow.verify(RAW_CODE);
    same(await fixture.flow.verify("another"), "ignored");
    same(await fixture.flow.resend(), "ignored");
    fixture.calls.at(-1)!.reply.resolve(json({ outcome }));
    same(await pending, "settled");
    same(fixture.flow.read().outcome, outcome);
    check(fixture.flow.read().hasSelector && fixture.flow.read().stage === "code");
    const retry = fixture.flow.verify("corrected raw value");
    same(JSON.parse(fixture.calls.at(-1)!.init.body as string), { identifier: RAW, flowId: FIRST, code: "corrected raw value" });
    fixture.calls.at(-1)!.reply.resolve(json({ outcome }));
    same(await retry, "settled");
    cleanProjection(fixture.flow);
  });
  it("F13 successful completion clears attempt data and exposes the one destination without navigation", async () => {
    const fixture = setup();
    await enterCode(fixture);
    const pending = fixture.flow.verify(RAW_CODE);
    fixture.calls.at(-1)!.reply.resolve(json(success()));
    same(await pending, "settled");
    same(fixture.flow.read(), { stage: "complete", identifier: "", pending: null, outcome: "signed_in", hasSelector: false, destination: "/explorer/home" });
    same(fixture.flow.setIdentifier(RAW), "ignored");
    same(fixture.flow.useDifferentEmail(), "ignored");
    same(await fixture.flow.send(), "ignored");
    same(await fixture.flow.resend(), "ignored");
    same(await fixture.flow.verify(RAW_CODE), "ignored");
    same(fixture.calls.length, 2);
    same(fixture.flow.dispose(), "settled");
    same(fixture.flow.read().stage, "disposed");
  });
  it("F14 rejects caller identifier and selector overrides without reading them", async () => {
    const fixture = setup();
    await enterCode(fixture);
    let touched = false;
    const override = { get code() { touched = true; return RAW_CODE; }, identifier: "other", flowId: SECOND };
    same(await fixture.flow.verify(override), "ignored");
    check(!touched && fixture.calls.length === 1);
  });
  it("F15 does not publish an unapproved success destination", async () => {
    const fixture = setup();
    await enterCode(fixture);
    const pending = fixture.flow.verify(RAW_CODE);
    fixture.calls.at(-1)!.reply.resolve(json({ outcome: "signed_in", destination: "https://example.invalid" }));
    same(await pending, "settled");
    same(fixture.flow.read().stage, "code");
    same(fixture.flow.read().destination, null);
    same(fixture.flow.read().outcome, "sign_in_browser_transport_failed");
  });
});

describe("Explorer invalidation and uncertain cancellation", () => {
  for (const action of ["send", "resend", "verify"] as const) {
    for (const invalidation of ["identifier", "different", "dispose"] as const) {
      it(`F16 invalidates ${action} before ${invalidation} abort and ignores a late successful response`, async () => {
        const fixture = await begin(action);
        let observed = false;
        fixture.call.init.signal!.addEventListener("abort", () => {
          const view = fixture.flow.read();
          observed = view.pending === null && !view.hasSelector && view.outcome === null &&
            view.stage === (invalidation === "dispose" ? "disposed" : "email") &&
            view.identifier === (invalidation === "identifier" ? "replacement" : "");
        });
        if (invalidation === "identifier") fixture.flow.setIdentifier("replacement");
        else if (invalidation === "different") fixture.flow.useDifferentEmail();
        else fixture.flow.dispose();
        check(observed && fixture.call.init.signal!.aborted);
        same(await fixture.completion, "ignored");
        const current = fixture.flow.read();
        fixture.call.reply.resolve(json(action === "verify" ? success() : acknowledgment(SECOND)));
        await flush();
        same(fixture.flow.read(), current);
        cleanProjection(fixture.flow);
      });
    }
    it(`F17 late ${action} rejection cannot replace a newer pending operation`, async () => {
      const fixture = await begin(action);
      fixture.flow.setIdentifier("replacement");
      const next = fixture.flow.send();
      same(await fixture.completion, "ignored");
      same(fixture.flow.read().pending, "send");
      fixture.call.reply.reject({ private: RAW_CODE });
      await flush();
      same(fixture.flow.read().pending, "send");
      fixture.calls.at(-1)!.reply.resolve(json(acknowledgment(SECOND)));
      same(await next, "settled");
      same(fixture.flow.read().identifier, "replacement");
      same(fixture.flow.read().outcome, "verification_code_requested");
    });
  }
  it("F18 completion returns only a fixed marker even if current state changed before awaiting it", async () => {
    const fixture = setup();
    const completed = fixture.flow.send();
    fixture.calls[0].reply.resolve(json(acknowledgment()));
    await flush();
    same(fixture.flow.read().stage, "code");
    fixture.flow.useDifferentEmail();
    const value = await completed;
    same(value, "settled");
    check(typeof value === "string");
    same(fixture.flow.read().stage, "email");
  });
  it("F19 same raw identifier does not cancel a current operation", async () => {
    const fixture = await begin("send");
    same(fixture.flow.setIdentifier(RAW), "ignored");
    check(!fixture.call.init.signal!.aborted && fixture.flow.read().pending === "send");
    fixture.call.reply.resolve(json(acknowledgment()));
    same(await fixture.completion, "settled");
  });
  it("F20 disposal is permanent and clears all exposed attempt fields", async () => {
    const fixture = setup();
    await enterCode(fixture);
    same(fixture.flow.dispose(), "settled");
    same(fixture.flow.dispose(), "ignored");
    same(fixture.flow.setIdentifier(RAW), "ignored");
    same(fixture.flow.useDifferentEmail(), "ignored");
    same(await fixture.flow.send(), "ignored");
    same(await fixture.flow.resend(), "ignored");
    same(await fixture.flow.verify(RAW_CODE), "ignored");
    same(fixture.flow.read(), { stage: "disposed", identifier: "", pending: null, outcome: null, hasSelector: false, destination: null });
    same(fixture.calls.length, 1);
  });
  it("F21 the supplied budget stops local waiting without promising remote rollback", async () => {
    const fixture = setup(17);
    await enterCode(fixture);
    const pending = fixture.flow.verify(RAW_CODE);
    const call = fixture.calls.at(-1)!;
    await vi.advanceTimersByTimeAsync(16);
    same(fixture.flow.read().pending, "verify");
    await vi.advanceTimersByTimeAsync(1);
    same(await pending, "settled");
    same(fixture.flow.read().outcome, "sign_in_browser_transport_timed_out");
    check(call.init.signal!.aborted);
    call.reply.resolve(json(success()));
    await flush();
    same(fixture.flow.read().stage, "code");
    same(fixture.flow.read().destination, null);
    same(fixture.calls.length, 2);
  });
  it("F22 consumes late private rejection after disposal without a result or state leak", async () => {
    const fixture = await begin("verify");
    let touched = false;
    const thrown = Object.defineProperty({}, "message", { get() { touched = true; return RAW_CODE; } });
    fixture.flow.dispose();
    same(await fixture.completion, "ignored");
    fixture.call.reply.reject(thrown);
    await flush();
    check(!touched);
    cleanProjection(fixture.flow);
    same(fixture.flow.read().identifier, "");
  });
  it("F23 ignores a stale reply even when identifier changes away and then back", async () => {
    const fixture = await begin("send");
    fixture.flow.setIdentifier("replacement");
    fixture.flow.setIdentifier(RAW);
    const pending = fixture.flow.send();
    fixture.call.reply.resolve(json(acknowledgment()));
    same(await fixture.completion, "ignored");
    await flush();
    same(fixture.flow.read().pending, "send");
    check(!fixture.flow.read().hasSelector);
    fixture.calls.at(-1)!.reply.resolve(json(acknowledgment(SECOND)));
    same(await pending, "settled");
  });
  it("F24 preserves a reentrant replacement started by an abort observer", async () => {
    const fixture = await begin("send");
    let replacement: Promise<unknown> | null = null;
    fixture.call.init.signal!.addEventListener("abort", () => { replacement = fixture.flow.send(); });
    fixture.flow.setIdentifier("replacement");
    check(replacement !== null && fixture.calls.length === 2);
    same(await fixture.completion, "ignored");
    same(fixture.flow.read().pending, "send");
    fixture.calls.at(-1)!.reply.resolve(json(acknowledgment(SECOND)));
    same(await replacement, "settled");
    same(fixture.flow.read().identifier, "replacement");
  });
  it("F25 publishes pending before injected fetch can reenter the controller", async () => {
    const reply = deferred<Response>();
    let flow: ExplorerSignInFlowController | null = null;
    let calls = 0;
    let observed = false;
    let duplicate: Promise<unknown> | null = null;
    flow = createExplorerSignInFlowController({
    createFlowId: () => FIRST,
      responseBudgetMilliseconds: BUDGET,
      fetcher: () => {
        calls += 1;
        observed = flow?.read().pending === "send";
        if (calls === 1) duplicate = flow!.send();
        return reply.promise;
      },
    });
    if (flow === null) throw new Error("Flow fixture construction failed");
    flows.push(flow);
    const pending = flow.send();
    check(observed && calls === 1);
    same(await duplicate, "ignored");
    reply.resolve(json(acknowledgment()));
    same(await pending, "settled");
  });

  it("F26 keeps the first flow ID after a lost first acknowledgment and generates anew only for a new identifier", async () => {
    const fixture = setup();
    const first = fixture.flow.send();
    same(JSON.parse(fixture.calls[0].init.body as string).flowId, FIRST);
    fixture.calls[0].reply.reject(new Error("synthetic lost acknowledgment")); await first;
    same(fixture.flow.read().stage, "email");
    const retry = fixture.flow.send();
    same(JSON.parse(fixture.calls[1].init.body as string).flowId, FIRST);
    fixture.calls[1].reply.resolve(json(acknowledgment())); await retry;
    fixture.flow.useDifferentEmail(); fixture.flow.setIdentifier("replacement");
    const next = fixture.flow.send();
    same(JSON.parse(fixture.calls[2].init.body as string).flowId, SECOND);
    fixture.calls[2].reply.resolve(json(acknowledgment(SECOND))); await next;
    cleanProjection(fixture.flow);
  });

  it("F27 refuses an unavailable or malformed UUID port without a fetch or exposed underlying value", async () => {
    for (const createFlowId of [() => NIL, () => "", () => "ABCDEF01-2345-6789-abcd-ef0123456789", () => { throw new Error(RAW_CODE); }]) {
      let called = false;
      const flow = createExplorerSignInFlowController({ responseBudgetMilliseconds: BUDGET, createFlowId,
        fetcher: async () => { called = true; return json(acknowledgment()); } });
      if (flow === null) throw new Error("Flow fixture construction failed");
      flows.push(flow); flow.setIdentifier(RAW);
      same(await flow.send(), "settled");
      check(!called && flow.read().outcome === "sign_in_browser_transport_failed" && !flow.read().hasSelector && flow.read().pending === null);
    }
  });
});
