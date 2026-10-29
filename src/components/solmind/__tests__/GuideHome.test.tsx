import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createGuideHomeViewBinding, GuideHome, GuideSessionOutcome } from "../GuideHome";

const base = Date.parse("2026-10-21T18:00:00.000Z");
const session = { observedAt: new Date(base).toISOString(), expiresAt: new Date(base + 600_000).toISOString() };
const check = (condition: boolean) => expect(condition, "closed Guide home assertion").toBe(true);
const json = (outcome: string) => new Response(JSON.stringify({ outcome }), { headers: { "Content-Type": "application/json" } });
function setup(reply: () => Promise<Response>) {
  let wall = base;
  const timers = new Set<() => void>();
  const calls: Array<{ path: string; init: RequestInit }> = [];
  const binding = createGuideHomeViewBinding(session, { wall: () => wall, monotonic: () => 0,
    fetch(path, init) { calls.push({ path, init }); return reply(); },
    schedule(callback) { timers.add(callback); return () => { timers.delete(callback); }; },
  });
  const close = binding.subscribe(() => undefined);
  return { binding, calls, timers, close, advance(milliseconds: number) { wall += milliseconds; binding.recheck(); } };
}
describe("Guide home with shared expiry and logout boundaries", () => {
  it("renders only Guide confirmation with no private session projection or request", () => {
    const html = renderToStaticMarkup(createElement(GuideHome, { session }));
    check(html.includes("Guide home") && html.includes("Sign out") && !html.includes("Explorer home"));
    check(!html.includes(session.expiresAt) && !html.includes(session.observedAt));
  });
  it.each(["signed_out", "sign_out_unconfirmed", "denied"])("keeps shared logout outcome honest and re-enters only Guide (%s)", async outcome => {
    const f = setup(async () => json(outcome));
    await f.binding.signOut();
    check(f.calls.length === 1 && f.calls[0].path === "/logout" && f.calls[0].init.method === "POST" && f.calls[0].init.body === "{}");
    const screen = f.binding.read().screen;
    check(screen === (outcome === "signed_out" ? "signed_out" : "unconfirmed") && f.timers.size === 0);
    const html = renderToStaticMarkup(createElement(GuideSessionOutcome, { outcome: screen as "signed_out" | "unconfirmed" }));
    check(html.includes('href="/login/guide"') && !html.includes("/login/explorer"));
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


it("shows local absence without claiming remote sign-out and keeps fixed Guide re-entry", async () => {
  const f = setup(async () => json("no_current_sign_in"));
  await f.binding.signOut();
  expect(f.binding.read().screen).toBe("no_current_sign_in");
  const html = renderToStaticMarkup(createElement(GuideSessionOutcome, { outcome: "no_current_sign_in" }));
  expect(html.includes("No current sign-in was found at this browser address.")).toBe(true);
  expect(html.includes('href="/login/guide"')).toBe(true);
  expect(html.includes("SM-OUT-01") || html.includes("You're signed out") || html.includes("Guide home")).toBe(false);
  expect(f.timers.size).toBe(0);
  expect(f.calls.length).toBe(1);
  await f.binding.signOut();
  expect(f.calls.length).toBe(1);
  f.close();
});
