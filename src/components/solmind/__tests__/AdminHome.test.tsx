import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createAdminHomeViewBinding, AdminHome, AdminSessionOutcome } from "../AdminHome";

const base = Date.parse("2026-10-21T18:00:00.000Z");
const session = { observedAt: new Date(base).toISOString(), expiresAt: new Date(base + 600_000).toISOString() };
const check = (condition: boolean) => expect(condition, "closed Admin home assertion").toBe(true);
const json = (outcome: string) => new Response(JSON.stringify({ outcome }), { headers: { "Content-Type": "application/json" } });
function setup(reply: () => Promise<Response>) {
  let wall = base;
  const timers = new Set<() => void>();
  const calls: Array<{ path: string; init: RequestInit }> = [];
  const binding = createAdminHomeViewBinding(session, { wall: () => wall, monotonic: () => 0,
    fetch(path, init) { calls.push({ path, init }); return reply(); },
    schedule(callback) { timers.add(callback); return () => { timers.delete(callback); }; },
  });
  const close = binding.subscribe(() => undefined);
  return { binding, calls, timers, close, advance(milliseconds: number) { wall += milliseconds; binding.recheck(); } };
}
describe("Admin home with shared expiry and logout boundaries", () => {
  it("renders only Admin confirmation with no private session projection or request", () => {
    const html = renderToStaticMarkup(createElement(AdminHome, { session }));
    check(html.includes("Admin home") && html.includes("Sign out") && !html.includes("Explorer home"));
    check(!html.includes(session.expiresAt) && !html.includes(session.observedAt));
  });
  it.each(["signed_out", "sign_out_unconfirmed", "denied"])("keeps shared logout outcome honest and re-enters only Admin (%s)", async outcome => {
    const f = setup(async () => json(outcome));
    await f.binding.signOut();
    check(f.calls.length === 1 && f.calls[0].path === "/logout" && f.calls[0].init.method === "POST" && f.calls[0].init.body === "{}");
    const screen = f.binding.read().screen;
    check(screen === (outcome === "signed_out" ? "signed_out" : "unconfirmed") && f.timers.size === 0);
    const html = renderToStaticMarkup(createElement(AdminSessionOutcome, { outcome: screen as "signed_out" | "unconfirmed" }));
    check(html.includes('href="/login/admin"') && !html.includes("/login/explorer"));
    if (outcome !== "signed_out") check(html.includes("SM-OUT-01") && !html.includes("You're signed out"));
    f.close();
  });
  it("warns after sleep then ends locally without renewing or dispatching logout", () => {
    const f = setup(async () => json("signed_out"));
    f.advance(300_000); check(f.binding.read().warning);
    f.advance(300_000); check(f.binding.read().screen === "session_ended" && f.calls.length === 0 && f.timers.size === 0);
    f.close();
  });
  it("suspension removes protected content and ignores a late logout answer", async () => {
    let resolve!: (reply: Response) => void;
    const f = setup(() => new Promise<Response>(yes => { resolve = yes; }));
    const pending = f.binding.signOut(); f.binding.suspend();
    resolve(json("signed_out")); await pending;
    check(f.binding.read().screen === "restoring" && f.timers.size === 0 && f.calls.length === 1);
    f.close();
  });
});
