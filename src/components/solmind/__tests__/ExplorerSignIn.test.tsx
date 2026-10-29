import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isDeepStrictEqual } from "node:util";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExplorerSignIn, createExplorerSignInViewBinding, type ExplorerSignInStatus } from "../ExplorerSignIn";

const RAW = " \tprivate-ui-fixture+Explorer@Example.invalid ";
const CODE = " raw-private-code\n";
const FIRST = "10000000-0000-0000-0000-000000000001";
const SECOND = "20000000-0000-0000-0000-000000000002";
const NIL = "00000000-0000-0000-0000-000000000000";
const BUDGET = 5000;
const check = (value: boolean) => expect(value, "closed UI binding assertion").toBe(true);
const same = (value: unknown, expected: unknown) => check(isDeepStrictEqual(value, expected));
const cleanup: Array<() => void> = [];
let quiet: () => boolean;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (value: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const acknowledgment = (flowId = FIRST) => ({ acknowledgment: "verification_code_requested", flowId });
const success = () => ({ outcome: "signed_in", destination: "/explorer/home" });
async function flush() { for (let index = 0; index < 30; index += 1) await Promise.resolve(); }

function setup(budget = BUDGET, subscribe = true) {
  let generated = 0;
  const calls: Array<{ path: string; init: RequestInit; reply: ReturnType<typeof deferred<Response>> }> = [];
  const navigations: string[] = [];
  let departures = 0;
  let publications = 0;
  const binding = createExplorerSignInViewBinding({
    createFlowId: () => generated++ === 0 ? FIRST : SECOND,
    responseBudgetMilliseconds: budget,
    fetcher(path, init) {
      const reply = deferred<Response>();
      calls.push({ path, init, reply });
      return reply.promise;
    },
    onNavigate: path => { navigations.push(path); },
    onDepart: () => { departures += 1; },
  });
  const attach = () => {
    const close = binding.subscribe(() => { publications += 1; });
    cleanup.push(close);
    return close;
  };
  const close = subscribe ? attach() : () => undefined;
  return { binding, calls, navigations, departures: () => departures, publications: () => publications, attach, close };
}
async function enterCode(fixture: ReturnType<typeof setup>, selector = FIRST) {
  fixture.binding.setIdentifier(RAW);
  const pending = fixture.binding.send();
  fixture.calls.at(-1)!.reply.resolve(json(acknowledgment(selector)));
  await pending;
  same(fixture.binding.read().flow.stage, "code");
}
async function start(action: "send" | "resend" | "verify") {
  const fixture = setup();
  if (action !== "send") await enterCode(fixture);
  else fixture.binding.setIdentifier(RAW);
  fixture.binding.setCode(CODE);
  const pending = fixture.binding[action]();
  return { ...fixture, pending, last: fixture.calls.at(-1)! };
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  const sinks = ["log", "info", "warn", "error", "debug", "trace"] as const;
  const spies = sinks.map(name => vi.spyOn(console, name).mockImplementation(() => undefined));
  quiet = () => spies.every(spy => spy.mock.calls.length === 0);
  vi.stubGlobal("fetch", () => { throw new Error("Ambient network prohibited"); });
});
afterEach(async () => {
  for (const close of cleanup.splice(0)) close();
  await flush();
  const noTimers = vi.getTimerCount() === 0;
  const noConsole = quiet();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
  check(noTimers); check(noConsole);
});

describe("dormant Explorer view event binding with real controller and fake transport", () => {
  it("U01 does no work before subscription and preserves stable detached snapshots", async () => {
    const f = setup(BUDGET, false);
    const first = f.binding.read();
    same(first, f.binding.readServer());
    check(first === f.binding.read() && Object.isFrozen(first));
    f.binding.setIdentifier(RAW); await f.binding.send(); same(f.calls.length, 0);
    f.attach(); check(f.binding.read().ready); check(!first.ready);
  });
  it.each([0, -1, 0.5, NaN, Infinity, 2147483648])("U02 invalid explicit budget stays unavailable %#", async budget => {
    const f = setup(budget); check(!f.binding.read().ready);
    f.binding.setIdentifier(RAW); await f.binding.send(); same(f.calls.length, 0);
  });
  it("U03 keeps raw identifier/code in exact requests and publishes pending before settlement", async () => {
    const f = setup(); f.binding.setIdentifier(RAW);
    const sent = f.binding.send(); same(f.binding.read().flow.pending, "send");
    same(JSON.parse(f.calls[0].init.body as string), { identifier: RAW, flowId: FIRST });
    f.calls[0].reply.resolve(json(acknowledgment())); await sent;
    f.binding.setCode(CODE); const verified = f.binding.verify();
    same(f.binding.read().flow.pending, "verify");
    same(JSON.parse(f.calls[1].init.body as string), { identifier: RAW, flowId: FIRST, code: CODE });
    f.calls[1].reply.resolve(json({ outcome: "code_not_accepted" })); await verified;
    same(f.binding.read().flow.outcome, "code_not_accepted");
    same(f.binding.read().codeDraft, CODE);
    check(!JSON.stringify(f.binding.read()).includes(FIRST));
  });
  it.each(["send", "resend", "verify"] as const)("U04 duplicate and cross submissions stay single attempt %s", async action => {
    const f = await start(action); const count = f.calls.length;
    await f.binding.send(); await f.binding.resend(); await f.binding.verify(); same(f.calls.length, count);
    f.last.reply.resolve(json(action === "verify" ? { outcome: "denied" } : acknowledgment()));
    await f.pending;
  });
  it("U05 mismatched nil flow echo cannot change the owned flow or enable a verify", async () => {
    const f = setup(); f.binding.setIdentifier(RAW); const firstSend = f.binding.send();
    f.calls[0].reply.resolve(json(acknowledgment(NIL))); await firstSend;
    same(f.binding.read().flow.hasSelector, false);
    same(f.binding.read().flow.outcome, "sign_in_browser_transport_failed");
    const retry = f.binding.send();
    same(JSON.parse(f.calls[1].init.body as string).flowId, FIRST);
    f.calls[1].reply.resolve(json(acknowledgment())); await retry;
    f.binding.setCode(CODE); const p = f.binding.verify(); same(f.calls.length, 3);
    same(JSON.parse(f.calls[2].init.body as string).flowId, FIRST);
    f.calls[2].reply.resolve(json({ outcome: "code_not_accepted" })); await p;
  });
  it.each(["invalid_email", "denied"] as const)("U06 send outcome remains a semantic tag %s", async outcome => {
    const f = setup(); f.binding.setIdentifier(RAW); const p = f.binding.send();
    f.calls[0].reply.resolve(json({ outcome })); await p;
    same(f.binding.read().flow.stage, "email"); same(f.binding.read().flow.outcome, outcome);
  });
  it("U07 success clears drafts and navigates exactly once to the fixed destination", async () => {
    const f = setup(); await enterCode(f); f.binding.setCode(CODE);
    const p = f.binding.verify(); f.calls[1].reply.resolve(json(success())); await p;
    same(f.binding.read().codeDraft, ""); same(f.binding.read().flow.identifier, "");
    same(f.navigations, ["/explorer/home"]);
    await f.binding.verify(); await f.binding.send(); f.binding.reset(); f.binding.setIdentifier(RAW);
    same(f.navigations.length, 1); same(f.calls.length, 2);
  });
  it.each(["send", "resend", "verify"] as const)("U08 reset invalidates pending and late response %s", async action => {
    const f = await start(action); f.binding.reset();
    check(f.last.init.signal?.aborted === true);
    same(f.binding.read().codeDraft, ""); same(f.binding.read().flow.identifier, "");
    f.last.reply.resolve(json(action === "verify" ? success() : acknowledgment())); await f.pending;
    same(f.binding.read().flow.stage, "email"); same(f.binding.read().flow.outcome, null); same(f.navigations.length, 0);
  });
  it.each(["send", "resend", "verify"] as const)("U09 identifier edit clears secrets and invalidates pending %s", async action => {
    const f = await start(action); f.binding.setIdentifier(" replacement ");
    check(f.last.init.signal?.aborted === true); same(f.binding.read().codeDraft, "");
    f.last.reply.reject(new Error(CODE)); await f.pending;
    same(f.binding.read().flow.identifier, " replacement "); same(f.binding.read().flow.pending, null);
    same(f.navigations.length, 0);
  });
  it("U10 resend clears the draft but retains the owned flow after a lost acknowledgment", async () => {
    const f = setup(); await enterCode(f); f.binding.setCode(CODE);
    const p = f.binding.resend(); same(f.binding.read().codeDraft, ""); same(f.binding.read().flow.hasSelector, true);
    same(JSON.parse(f.calls[1].init.body as string).flowId, FIRST);
    f.calls[1].reply.reject(new Error(CODE)); await p;
    same(f.binding.read().flow.hasSelector, true);
    f.binding.setCode(CODE); const verify = f.binding.verify();
    same(JSON.parse(f.calls[2].init.body as string).flowId, FIRST);
    f.calls[2].reply.resolve(json({ outcome: "code_not_accepted" })); await verify;
  });
  it("U11 last unsubscribe clears state and ignores late success; setup replay gets a fresh controller", async () => {
    const f = await start("verify"); f.close(); const publications = f.publications();
    same(f.binding.read().codeDraft, ""); same(f.binding.read().ready, false);
    f.attach(); f.binding.setIdentifier("new-attempt"); const next = f.binding.send();
    f.last.reply.resolve(json(success())); await f.pending;
    same(f.binding.read().flow.pending, "send"); same(f.binding.read().flow.identifier, "new-attempt");
    same(f.navigations.length, 0); check(f.publications() > publications);
    f.calls.at(-1)!.reply.resolve(json(acknowledgment(SECOND))); await next;
    same(f.binding.read().flow.stage, "code");
  });
  it("U12 departure is permanent, clears secrets, and invokes its callback once", async () => {
    const f = await start("verify"); f.binding.depart(); f.binding.depart();
    same(f.departures(), 1); same(f.binding.read().codeDraft, ""); same(f.binding.read().flow.identifier, "");
    f.last.reply.resolve(json(success())); await f.pending; f.attach();
    f.binding.setIdentifier(RAW); await f.binding.send(); same(f.navigations.length, 0); same(f.calls.length, 2);
  });
  it("U13 a replacement binding models changed transport configuration without old navigation", async () => {
    const previous = await start("verify"); previous.close();
    const next = setup(8000); next.binding.setIdentifier("replacement"); const p = next.binding.send();
    previous.last.reply.resolve(json(success())); await previous.pending;
    same(previous.navigations.length, 0); same(next.binding.read().flow.pending, "send");
    next.calls[0].reply.resolve(json(acknowledgment())); await p;
  });
  it("U14 departure during completion publication suppresses navigation", async () => {
    const f = setup(); await enterCode(f); f.binding.setCode(CODE);
    cleanup.push(f.binding.subscribe(() => { if (f.binding.read().flow.stage === "complete") f.binding.depart(); }));
    const p = f.binding.verify(); f.calls[1].reply.resolve(json(success())); await p;
    same(f.navigations.length, 0); same(f.departures(), 1);
  });
  it("U15 repeated listener identity has independent ownership and idempotent close", async () => {
    const f = setup(BUDGET, false); const listener = () => undefined;
    const first = f.binding.subscribe(listener); const second = f.binding.subscribe(listener); cleanup.push(first, second);
    f.binding.setIdentifier(RAW); first(); first(); check(f.binding.read().ready);
    same(f.binding.read().flow.identifier, RAW); second(); check(!f.binding.read().ready);
  });
  it("U16 malformed draft values are ignored without coercion", () => {
    const f = setup(); let touched = false;
    const value = { toString() { touched = true; return CODE; } };
    f.binding.setIdentifier(value as unknown as string); f.binding.setCode(value as unknown as string);
    check(!touched); same(f.binding.read().flow.identifier, "");
  });
  it("U18 callback replacement preserves an active attempt and calls the current owner once", async () => {
    const f = await start("verify"); const destinations: string[] = [];
    f.binding.setCallbacks({ onNavigate: path => { destinations.push(path); }, onDepart: () => undefined });
    same(f.binding.read().flow.pending, "verify");
    f.last.reply.resolve(json(success())); await f.pending;
    same(destinations, ["/explorer/home"]); same(f.navigations.length, 0);
  });
  it.each(["send", "resend", "verify"] as const)("U19 commit invalidation stops late completion before passive unsubscribe %s", async action => {
    const f = await start(action);
    // Deliberately retain the old subscription through the committed teardown.
    f.binding.invalidateView();
    check(!f.binding.read().ready && f.last.init.signal?.aborted === true);
    same(f.binding.read().codeDraft, ""); same(f.binding.read().flow.identifier, "");
    f.last.reply.resolve(json(action === "verify" ? success() : acknowledgment()));
    await f.pending;
    check(!f.binding.read().ready); same(f.navigations.length, 0);
    // A replay/replacement subscription owns a distinct fresh controller even
    // while the old passive listener has not yet been removed.
    const freshClose = f.attach();
    f.binding.setIdentifier("fresh-view"); const fresh = f.binding.send();
    const freshCall = f.calls.at(-1)!;
    f.close();
    check(f.binding.read().ready && freshCall.init.signal?.aborted === false);
    same(f.binding.read().flow.pending, "send");
    freshCall.reply.resolve(json(acknowledgment(SECOND))); await fresh;
    same(f.binding.read().flow.stage, "code"); same(f.navigations.length, 0);
    freshClose(); check(!f.binding.read().ready);
  });
  it("U17 static rendering requires supplied status, stays dormant and hides preview additions", () => {
    let calls = 0; const statuses: ExplorerSignInStatus[] = [];
    const markup = renderToStaticMarkup(createElement(ExplorerSignIn, {
      fetcher: async () => { calls += 1; return json({}); }, responseBudgetMilliseconds: BUDGET,
      onDepart: () => undefined, onNavigate: () => undefined,
      renderStatus: status => { statuses.push(status); return createElement("p", { role: "status" }, "fixed-test-status"); },
    }));
    same(calls, 0); same(statuses.length, 1);
    same(Object.keys(statuses[0]).sort(), ["outcome", "pending", "ready", "stage"]);
    check(Object.isFrozen(statuses[0])); same(statuses[0].ready, false);
    check(markup.includes("Send my code") && markup.includes("fixed-test-status"));
    check(!markup.includes("Preview controls") && !markup.includes("Example screen"));
    check(/<input[^>]*disabled=""[^>]*id="a2email"/.test(markup));
  });
});
