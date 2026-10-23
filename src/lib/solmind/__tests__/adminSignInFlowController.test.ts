import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminSignInFlowController } from "../adminSignInFlowController";

const IDENTIFIER = " Raw-Admin@Example.invalid ";
const PASSWORD = " private raw password ";
const CODE = "004209";
const SELECTOR = "10000000-0000-0000-0000-000000000001";
const NEXT = "20000000-0000-0000-0000-000000000002";
const check = (condition: boolean) => expect(condition, "closed Admin flow assertion").toBe(true);
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
function setup() {
  const calls: Array<{ path: string; init: RequestInit; resolve: (reply: Response) => void }> = [];
  const controller = createAdminSignInFlowController({ responseBudgetMilliseconds: 5000, fetcher(path, init) {
    return new Promise<Response>(resolve => { calls.push({ path, init, resolve }); });
  } })!;
  return { controller, calls };
}
async function enterCode(f: ReturnType<typeof setup>, identifier = IDENTIFIER) {
  f.controller.setIdentifier(identifier);
  const pending = f.controller.send();
  f.calls[0].resolve(json({ acknowledgment: "verification_code_requested", challengeId: SELECTOR }));
  await pending;
}
beforeEach(() => { vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }); });
afterEach(() => { const noTimers = vi.getTimerCount() === 0; vi.useRealTimers(); check(noTimers); });

describe("Admin flow using real browser contract/transport with fake HTTP", () => {
  it.each([IDENTIFIER, " Founder.Admin_01-2 "])("preserves a raw email or username and raw factors with no password on send (%s)", async identifier => {
    const f = setup(); await enterCode(f, identifier);
    const sent = JSON.parse(f.calls[0].init.body as string);
    check(f.calls[0].path === "/login/admin/send" && Object.keys(sent).join() === "identifier" && sent.identifier === identifier);
    const pending = f.controller.verify(PASSWORD, CODE);
    const verified = JSON.parse(f.calls[1].init.body as string);
    check(f.calls[1].path === "/login/admin/verify" && verified.identifier === identifier && verified.password === PASSWORD && verified.code === CODE && verified.challengeId === SELECTOR);
    const projection = JSON.stringify(f.controller.read());
    check(!projection.includes(PASSWORD) && !projection.includes(CODE) && !projection.includes(SELECTOR));
    f.calls[1].resolve(json({ outcome: "not_matched" })); await pending;
    check(f.controller.read().stage === "code" && f.controller.read().hasSelector && f.controller.read().outcome === "not_matched");
    const retried = f.controller.verify(" replacement password ", CODE);
    check(JSON.parse(f.calls[2].init.body as string).challengeId === SELECTOR);
    f.calls[2].resolve(json({ outcome: "signed_in", destination: "/admin/home" })); await retried;
    check(f.controller.read().stage === "complete" && f.controller.read().destination === "/admin/home" && f.controller.read().identifier === "" && !f.controller.read().hasSelector);
    f.controller.dispose();
  });
  it("invalidates before abort and ignores a late accepted success after different identifier", async () => {
    const f = setup(); await enterCode(f);
    const pending = f.controller.verify(PASSWORD, CODE);
    f.controller.useDifferentIdentifier();
    check(f.calls[1].init.signal?.aborted === true);
    f.calls[1].resolve(json({ outcome: "signed_in", destination: "/admin/home" })); await pending;
    check(f.controller.read().stage === "identifier" && f.controller.read().identifier === "" && f.controller.read().destination === null);
    f.controller.dispose();
  });
  it("retires the old selector before resend and never restores it after uncertainty", async () => {
    const f = setup(); await enterCode(f);
    const pending = f.controller.resend(); check(!f.controller.read().hasSelector);
    await f.controller.verify(PASSWORD, CODE); check(f.calls.length === 2);
    f.calls[1].resolve(new Response("unusable", { headers: { "Content-Type": "text/plain" } })); await pending;
    await f.controller.verify(PASSWORD, CODE); check(f.calls.length === 2 && !f.controller.read().hasSelector);
    const next = f.controller.resend(); f.calls[2].resolve(json({ acknowledgment: "verification_code_requested", challengeId: NEXT })); await next;
    const verify = f.controller.verify(PASSWORD, CODE); check(JSON.parse(f.calls[3].init.body as string).challengeId === NEXT);
    f.calls[3].resolve(json({ outcome: "denied" })); await verify; f.controller.dispose();
  });
  it.each(["/explorer/home", "/guide/home", "https://example.invalid/admin/home"])("rejects every non-fixed destination and suppresses duplicate submissions (%s)", async destination => {
    const f = setup(); await enterCode(f);
    const pending = f.controller.verify(PASSWORD, CODE);
    await f.controller.verify(PASSWORD, CODE); await f.controller.resend(); check(f.calls.length === 2);
    f.calls[1].resolve(json({ outcome: "signed_in", destination })); await pending;
    check(f.controller.read().stage === "code" && f.controller.read().destination === null);
    f.controller.dispose();
  });
  it("bounds local waiting and consumes a late network rejection without another attempt", async () => {
    let reject!: (error: unknown) => void;
    let calls = 0;
    const controller = createAdminSignInFlowController({ responseBudgetMilliseconds: 25, fetcher() { calls += 1; return new Promise<Response>((_resolve, no) => { reject = no; }); } })!;
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
  it.each(["invalid_identifier", "denied"])("keeps a refused identifier in the entry step without inventing a challenge (%s)", async outcome => {
    const f = setup(); f.controller.setIdentifier(" Raw.Name "); const pending = f.controller.send();
    f.calls[0].resolve(json({ outcome })); await pending;
    check(f.controller.read().stage === "identifier" && f.controller.read().identifier === " Raw.Name " &&
      f.controller.read().outcome === outcome && !f.controller.read().hasSelector);
    f.controller.dispose();
  });
  it("an old send completion cannot clear a replacement operation or restore its challenge", async () => {
    const f = setup(); f.controller.setIdentifier(IDENTIFIER); const previous = f.controller.send();
    f.controller.setIdentifier(" Next.Admin "); const replacement = f.controller.send();
    check(f.calls[0].init.signal?.aborted === true && f.controller.read().pending === "send");
    f.calls[0].resolve(json({ acknowledgment: "verification_code_requested", challengeId: SELECTOR })); await previous;
    check(f.controller.read().pending === "send" && !f.controller.read().hasSelector);
    f.calls[1].resolve(json({ acknowledgment: "verification_code_requested", challengeId: NEXT })); await replacement;
    const verify = f.controller.verify(PASSWORD, CODE);
    const body = JSON.parse(f.calls[2].init.body as string);
    check(body.identifier === " Next.Admin " && body.challengeId === NEXT);
    f.calls[2].resolve(json({ outcome: "not_matched" })); await verify; f.controller.dispose();
  });
  it("rejects an oversized request before any fetch and exposes only a closed failure", async () => {
    const f = setup(); f.controller.setIdentifier("x".repeat(16_385)); await f.controller.send();
    check(f.calls.length === 0 && f.controller.read().outcome === "sign_in_browser_transport_failed" && !f.controller.read().hasSelector);
    f.controller.dispose();
  });
  it("rejects an oversized response without interpreting it or issuing a retry", async () => {
    const f = setup(); f.controller.setIdentifier(IDENTIFIER); const pending = f.controller.send();
    f.calls[0].resolve(new Response("x".repeat(16_385), { headers: { "Content-Type": "application/json" } })); await pending;
    check(f.calls.length === 1 && f.controller.read().outcome === "sign_in_browser_transport_failed" && !f.controller.read().hasSelector);
    f.controller.dispose();
  });
  it("bounds an unfinished response body as well as fetch waiting", async () => {
    let signal: AbortSignal | null = null;
    const controller = createAdminSignInFlowController({ responseBudgetMilliseconds: 25, fetcher: async (_path, init) => {
      signal = init.signal as AbortSignal;
      return new Response(new ReadableStream<Uint8Array>({ start() {} }), { headers: { "Content-Type": "application/json" } });
    } })!;
    controller.setIdentifier(IDENTIFIER); const pending = controller.send();
    await vi.advanceTimersByTimeAsync(25); await pending;
    check(controller.read().outcome === "sign_in_browser_transport_timed_out" && signal !== null && (signal as AbortSignal).aborted);
    controller.dispose();
  });
});
