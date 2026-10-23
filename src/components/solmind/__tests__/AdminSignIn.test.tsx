import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminSignIn, createAdminSignInViewBinding } from "../AdminSignIn";

const PASSWORD = " private view password ";
const SELECTOR = "10000000-0000-0000-0000-000000000001";
const check = (condition: boolean) => expect(condition, "closed Admin view assertion").toBe(true);
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
const cleanups: Array<() => void> = [];
function setup() {
  const calls: Array<{ init: RequestInit; resolve: (reply: Response) => void }> = [];
  const navigations: string[] = [];
  let departed = 0;
  const binding = createAdminSignInViewBinding({ responseBudgetMilliseconds: 5000,
    fetcher(_path, init) { return new Promise<Response>(resolve => { calls.push({ init, resolve }); }); },
    onNavigate: destination => { navigations.push(destination); }, onDepart: () => { departed += 1; },
  });
  cleanups.push(binding.subscribe(() => undefined));
  return { binding, calls, navigations, departed: () => departed };
}
async function enterCode(f: ReturnType<typeof setup>) {
  f.binding.setIdentifier("admin@example.invalid"); const pending = f.binding.send();
  f.calls[0].resolve(json({ acknowledgment: "verification_code_requested", challengeId: SELECTOR })); await pending;
  f.binding.setCode("004209");
}
beforeEach(() => { vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }); });
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); const noTimers = vi.getTimerCount() === 0; vi.useRealTimers(); check(noTimers); });

describe("Admin view binding and static markup; no mounted browser claim", () => {
  it("takes the latest password only on verify and clears transient drafts before one fixed navigation", async () => {
    const f = setup(); await enterCode(f); const pending = f.binding.verify(PASSWORD);
    check(JSON.parse(f.calls[1].init.body as string).password === PASSWORD && !JSON.stringify(f.binding.read()).includes(PASSWORD));
    f.calls[1].resolve(json({ outcome: "signed_in", destination: "/admin/home" })); await pending;
    check(f.binding.read().codeDraft === "" && f.binding.read().flow.identifier === "" && f.navigations.join() === "/admin/home");
    await f.binding.verify(PASSWORD); check(f.navigations.length === 1);
  });
  it("departure during verify invalidates before cancellation and prevents late navigation", async () => {
    const f = setup(); await enterCode(f); const pending = f.binding.verify(PASSWORD);
    f.binding.depart(); f.binding.depart(); check(f.calls[1].init.signal?.aborted === true);
    f.calls[1].resolve(json({ outcome: "signed_in", destination: "/admin/home" })); await pending;
    check(f.departed() === 1 && f.navigations.length === 0 && f.binding.read().codeDraft === "" && !f.binding.read().ready);
  });
  it("resend clears the code and reset clears the email without publishing the selector", async () => {
    const f = setup(); await enterCode(f); const pending = f.binding.resend();
    check(f.binding.read().codeDraft === "" && !f.binding.read().flow.hasSelector && !JSON.stringify(f.binding.read()).includes(SELECTOR));
    f.binding.reset(); f.calls[1].resolve(json({ acknowledgment: "verification_code_requested", challengeId: SELECTOR })); await pending;
    check(f.binding.read().flow.stage === "identifier" && f.binding.read().flow.identifier === "");
  });
  it("page departure suspension is permanent and suppresses late results", async () => {
    const f = setup(); await enterCode(f); const pending = f.binding.verify(PASSWORD);
    f.binding.suspend(); f.calls[1].resolve(json({ outcome: "signed_in", destination: "/admin/home" })); await pending;
    await f.binding.send(); check(!f.binding.read().ready && f.navigations.length === 0 && f.calls.length === 2);
  });
  it("initial markup accepts the bounded Admin username and has a labelled uncontrolled password without deferred features", () => {
    const html = renderToStaticMarkup(createElement(AdminSignIn, { fetcher: () => { throw new Error("network prohibited"); }, responseBudgetMilliseconds: 5000, onNavigate() {}, onDepart() {} }));
    check(html.includes('id="admin-password"') && html.includes('type="password"') && html.includes('autoComplete="current-password"'));
    check(!/id="admin-password"[^>]*\bvalue=/.test(html) && !html.includes("Remember") && !html.includes("Forgot your password") && !html.includes("phone number"));
    check(html.includes("Signing in as the Admin") && html.includes("Email, or the Admin username"));
    check(html.includes('id="admin-identifier" type="text" maxLength="512"') && !html.includes('type="email"'));
  });
  it("a new subscription after invalidation starts a fresh private lifetime and ignores an old answer", async () => {
    const f = setup(); await enterCode(f); const pending = f.binding.verify(PASSWORD);
    f.binding.invalidateView(); const close = f.binding.subscribe(() => undefined); cleanups.push(close);
    check(f.calls[1].init.signal?.aborted === true && f.binding.read().flow.stage === "identifier" && f.binding.read().codeDraft === "");
    f.calls[1].resolve(json({ outcome: "signed_in", destination: "/admin/home" })); await pending;
    check(f.navigations.length === 0 && f.binding.read().flow.stage === "identifier" && !f.binding.read().flow.hasSelector);
  });
});
