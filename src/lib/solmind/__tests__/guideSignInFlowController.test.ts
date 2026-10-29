import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGuideSignInFlowController } from "../guideSignInFlowController";

const IDENTIFIER = " Raw-Guide@Example.invalid ";
const PASSWORD = " private raw password ";
const CODE = "004209";
const SELECTOR = "10000000-0000-0000-0000-000000000001";
const NEXT = "20000000-0000-0000-0000-000000000002";
const check = (condition: boolean) => expect(condition, "closed Guide flow assertion").toBe(true);
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
function setup() {
  let generated = 0;
  const calls: Array<{ path: string; init: RequestInit; resolve: (reply: Response) => void }> = [];
  const controller = createGuideSignInFlowController({ responseBudgetMilliseconds: 5000, createFlowId: () => generated++ === 0 ? SELECTOR : NEXT, fetcher(path, init) {
    return new Promise<Response>(resolve => { calls.push({ path, init, resolve }); });
  } })!;
  return { controller, calls };
}
async function enterCode(f: ReturnType<typeof setup>) {
  f.controller.setIdentifier(IDENTIFIER);
  const pending = f.controller.send();
  f.calls[0].resolve(json({ acknowledgment: "verification_code_requested", flowId: SELECTOR }));
  await pending;
}
beforeEach(() => { vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }); });
afterEach(() => { const noTimers = vi.getTimerCount() === 0; vi.useRealTimers(); check(noTimers); });

describe("Guide flow using real browser contract/transport with fake HTTP", () => {
  it("sends no password and preserves every raw verify string without publishing credentials or selector", async () => {
    const f = setup(); await enterCode(f);
    const sent = JSON.parse(f.calls[0].init.body as string);
    check(f.calls[0].path === "/login/guide/send" && Object.keys(sent).join() === "identifier,flowId" && sent.flowId === SELECTOR && sent.identifier === IDENTIFIER);
    const pending = f.controller.verify(PASSWORD, CODE);
    const verified = JSON.parse(f.calls[1].init.body as string);
    check(f.calls[1].path === "/login/guide/verify" && verified.identifier === IDENTIFIER && verified.password === PASSWORD && verified.code === CODE && verified.flowId === SELECTOR);
    const projection = JSON.stringify(f.controller.read());
    check(!projection.includes(PASSWORD) && !projection.includes(CODE) && !projection.includes(SELECTOR));
    f.calls[1].resolve(json({ outcome: "not_matched" })); await pending;
    check(f.controller.read().stage === "code" && f.controller.read().hasSelector && f.controller.read().outcome === "not_matched");
    const retried = f.controller.verify(" replacement password ", CODE);
    check(JSON.parse(f.calls[2].init.body as string).flowId === SELECTOR);
    f.calls[2].resolve(json({ outcome: "signed_in", destination: "/guide/home" })); await retried;
    check(f.controller.read().stage === "complete" && f.controller.read().destination === "/guide/home" && f.controller.read().identifier === "" && !f.controller.read().hasSelector);
    f.controller.dispose();
  });
  it("invalidates before abort and ignores a late accepted success after different email", async () => {
    const f = setup(); await enterCode(f);
    const pending = f.controller.verify(PASSWORD, CODE);
    f.controller.useDifferentEmail();
    check(f.calls[1].init.signal?.aborted === true);
    f.calls[1].resolve(json({ outcome: "signed_in", destination: "/guide/home" })); await pending;
    check(f.controller.read().stage === "email" && f.controller.read().identifier === "" && f.controller.read().destination === null);
    f.controller.dispose();
  });
  it("keeps one flow across an uncertain resend and the next explicit verify", async () => {
    const f = setup(); await enterCode(f);
    const pending = f.controller.resend(); check(f.controller.read().hasSelector);
    await f.controller.verify(PASSWORD, CODE); check(f.calls.length === 2);
    check(JSON.parse(f.calls[1].init.body as string).flowId === SELECTOR);
    f.calls[1].resolve(new Response("unusable", { headers: { "Content-Type": "text/plain" } })); await pending;
    check(f.controller.read().hasSelector);
    const verify = f.controller.verify(PASSWORD, CODE);
    check(JSON.parse(f.calls[2].init.body as string).flowId === SELECTOR);
    f.calls[2].resolve(json({ outcome: "denied" })); await verify; f.controller.dispose();
  });
  it("never accepts an Explorer or Admin destination and suppresses duplicate submissions", async () => {
    const f = setup(); await enterCode(f);
    const pending = f.controller.verify(PASSWORD, CODE);
    await f.controller.verify(PASSWORD, CODE); await f.controller.resend(); check(f.calls.length === 2);
    f.calls[1].resolve(json({ outcome: "signed_in", destination: "/explorer/home" })); await pending;
    check(f.controller.read().stage === "code" && f.controller.read().destination === null);
    f.controller.dispose();
  });
  it("bounds local waiting and consumes a late network rejection without another attempt", async () => {
    let reject!: (error: unknown) => void;
    let calls = 0;
    const controller = createGuideSignInFlowController({ responseBudgetMilliseconds: 25, createFlowId: () => SELECTOR, fetcher() { calls += 1; return new Promise<Response>((_resolve, no) => { reject = no; }); } })!;
    controller.setIdentifier(IDENTIFIER); const pending = controller.send();
    await vi.advanceTimersByTimeAsync(25); await pending;
    check(controller.read().outcome === "sign_in_browser_transport_timed_out" && calls === 1);
    reject(new Error("test-only late rejection")); await Promise.resolve(); controller.dispose();
  });
  it("refuses malformed factor values without coercion or transport", async () => {
    const f = setup(); await enterCode(f); let touched = false;
    const value = { toString() { touched = true; return PASSWORD; } };
    await f.controller.verify(value, CODE); await f.controller.verify(PASSWORD, value);
    check(!touched && f.calls.length === 1); f.controller.dispose();
  });
});
