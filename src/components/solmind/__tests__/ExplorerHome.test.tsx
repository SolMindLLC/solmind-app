import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createExplorerHomeViewBinding, ExplorerHome, ExplorerSessionOutcome } from "../ExplorerHome";
import { SESSION_WARNING, SIGNED_OUT_PRIVACY, SIGN_OUT_UNCERTAINTY } from "../../../lib/solmind/explorerLoginJourney";

const base = Date.parse("2026-10-16T12:00:00.000Z");
const session = { observedAt: new Date(base).toISOString(), expiresAt: new Date(base + 600_000).toISOString() };
const json = (outcome: string) => new Response(JSON.stringify({ outcome }), { status: 200, headers: { "Content-Type": "application/json" } });
function fixture(fetcher: typeof fetch = async () => json("signed_out")) {
  let wall = base;
  let monotonic = 0;
  const timers = new Set<() => void>();
  let scheduled = 0;
  const fetch = vi.fn(fetcher);
  const binding = createExplorerHomeViewBinding(session, {
    fetch, wall: () => wall, monotonic: () => monotonic,
    schedule: (callback, milliseconds) => {
      scheduled += 1;
      expect(milliseconds > 0 && milliseconds <= 1_000).toBe(true);
      timers.add(callback);
      return () => { timers.delete(callback); };
    },
  });
  return {
    binding, fetch, timers, scheduled: () => scheduled,
    advance(wallDelta: number, monotonicDelta: number) { wall += wallDelta; monotonic += monotonicDelta; binding.recheck(); },
  };
}
beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("unexpected_effect"); });
  for (const level of ["log", "warn", "error", "info", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => undefined);
});
afterEach(() => { expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(0); vi.restoreAllMocks(); });

describe("Explorer home operation lifetime", () => {
  it("H01 rendering constructs no network operation and contains no private projection", () => {
    const html = renderToStaticMarkup(createElement(ExplorerHome, { session }));
    expect(html.includes("Explorer home") && html.includes("Sign out")).toBe(true);
    expect(html.includes(session.expiresAt) || html.includes(session.observedAt)).toBe(false);
  });
  it("H02 only a confirmed current logout yields S1", async () => {
    const f = fixture(); const unsubscribe = f.binding.subscribe(() => undefined);
    await f.binding.signOut();
    expect(f.binding.read().screen).toBe("signed_out");
    expect(f.fetch.mock.calls.length).toBe(1);
    expect(f.timers.size).toBe(0);
    unsubscribe();
  });
  it.each(["sign_out_unconfirmed", "denied", "unknown"])("H03 an unconfirmed response stays honest (%s)", async outcome => {
    const f = fixture(async () => json(outcome)); const unsubscribe = f.binding.subscribe(() => undefined);
    await f.binding.signOut();
    expect(f.binding.read().screen).toBe("unconfirmed");
    expect(f.timers.size).toBe(0); unsubscribe();
  });
  it("H04 duplicate clicks make one request", async () => {
    let settle!: (value: Response) => void;
    const f = fixture(() => new Promise(resolve => { settle = resolve; }));
    const unsubscribe = f.binding.subscribe(() => undefined);
    const first = f.binding.signOut();
    await f.binding.signOut();
    expect(f.binding.read().pending).toBe(true);
    expect(f.fetch.mock.calls.length).toBe(1);
    settle(json("signed_out")); await first;
    expect(f.binding.read().screen).toBe("signed_out"); unsubscribe();
  });
  it("H05 setup/cleanup/setup creates a usable fresh request object", async () => {
    const f = fixture(); const first = f.binding.subscribe(() => undefined);
    f.binding.invalidateView(); first();
    const second = f.binding.subscribe(() => undefined);
    await f.binding.signOut();
    expect(f.fetch.mock.calls.length === 1 && f.binding.read().screen === "signed_out").toBe(true);
    second();
  });
  it("H06 late completion after commit invalidation cannot replace the next lifetime", async () => {
    const settlers: Array<(value: Response) => void> = [];
    const f = fixture(() => new Promise(resolve => { settlers.push(resolve); }));
    const firstUnsubscribe = f.binding.subscribe(() => undefined);
    const old = f.binding.signOut();
    f.binding.invalidateView(); firstUnsubscribe();
    const secondUnsubscribe = f.binding.subscribe(() => undefined);
    const current = f.binding.signOut();
    settlers[0](json("signed_out")); await old;
    expect(f.binding.read().screen === "home" && f.binding.read().pending).toBe(true);
    settlers[1](json("sign_out_unconfirmed")); await current;
    expect(f.binding.read().screen).toBe("unconfirmed"); secondUnsubscribe();
  });
  it("H07 expired or suspended view invalidates a pending logout before its late result", async () => {
    for (const mode of ["expiry", "pagehide"] as const) {
      let settle!: (value: Response) => void;
      const f = fixture(() => new Promise(resolve => { settle = resolve; }));
      const unsubscribe = f.binding.subscribe(() => undefined);
      const pending = f.binding.signOut();
      if (mode === "expiry") f.advance(600_000, 0); else f.binding.suspend();
      settle(json("signed_out")); await pending;
      expect(f.binding.read().screen).toBe(mode === "expiry" ? "session_ended" : "restoring");
      expect(f.timers.size).toBe(0); unsubscribe();
    }
  });
  it("H08 terminal result cannot resurrect through subscription replay", async () => {
    const f = fixture(); const unsubscribe = f.binding.subscribe(() => undefined);
    await f.binding.signOut(); unsubscribe();
    const again = f.binding.subscribe(() => undefined);
    await f.binding.signOut();
    expect(f.binding.read().screen === "signed_out" && f.fetch.mock.calls.length === 1 && f.timers.size === 0).toBe(true);
    again();
  });
  it("H09 pending listener departure prevents dispatch entirely", async () => {
    const f = fixture(); const unsubscribe = f.binding.subscribe(() => { if (f.binding.read().pending) f.binding.suspend(); });
    await f.binding.signOut();
    expect(f.fetch.mock.calls.length === 0 && f.binding.read().screen === "restoring").toBe(true); unsubscribe();
  });
  it("H10 warning updates after sleep and remains truthful at late intervals", () => {
    const f = fixture(); const unsubscribe = f.binding.subscribe(() => undefined);
    f.advance(590_000, 1);
    expect(f.binding.read().warning).toBe(true);
    expect(SESSION_WARNING.includes("within 5 minutes")).toBe(true);
    f.advance(10_000, 0);
    expect(f.binding.read().screen).toBe("session_ended"); unsubscribe();
  });
  it("H11 closed result views preserve S1/S2/uncertainty and fixed re-entry", () => {
    for (const outcome of ["signed_out", "session_ended", "unconfirmed"] as const) {
      const html = renderToStaticMarkup(createElement(ExplorerSessionOutcome, { outcome }));
      expect(html.includes('href="/login/explorer"') && !html.includes("Explorer home")).toBe(true);
      if (outcome === "signed_out") expect(html.includes(SIGNED_OUT_PRIVACY)).toBe(true);
      if (outcome === "unconfirmed") expect(html.includes("SM-OUT-01") && !html.includes("You're signed out")).toBe(true);
    }
    expect(SIGN_OUT_UNCERTAINTY.includes("administrator")).toBe(false);
  });
  it("H12 a cancelled callback cannot change or reschedule a rechecked view", () => {
    const f = fixture(); const unsubscribe = f.binding.subscribe(() => undefined);
    const stale = [...f.timers][0];
    f.binding.recheck();
    const currentTimers = [...f.timers];
    const currentState = f.binding.read();
    const scheduled = f.scheduled();
    stale();
    expect(f.binding.read() === currentState && f.scheduled() === scheduled).toBe(true);
    expect([...f.timers]).toEqual(currentTimers);
    unsubscribe();
    expect(f.timers.size).toBe(0);
  });
  it("H13 a new subscription rearms before the old passive unsubscribe", async () => {
    const f = fixture(); const oldUnsubscribe = f.binding.subscribe(() => undefined);
    const stale = [...f.timers][0];
    f.binding.invalidateView();
    const currentUnsubscribe = f.binding.subscribe(() => undefined);
    const scheduled = f.scheduled();
    expect(f.timers.size).toBe(1);
    stale(); oldUnsubscribe();
    expect(f.scheduled() === scheduled && f.timers.size === 1).toBe(true);
    await f.binding.signOut();
    expect(f.fetch.mock.calls.length === 1 && f.binding.read().screen === "signed_out").toBe(true);
    currentUnsubscribe();
    expect(f.timers.size).toBe(0);
  });
  it("H14 a listener recheck cannot create a second timer chain", () => {
    const f = fixture(); let rechecked = false;
    const unsubscribe = f.binding.subscribe(() => {
      if (f.binding.read().warning && !rechecked) { rechecked = true; f.binding.recheck(); }
    });
    const before = f.scheduled();
    f.advance(300_000, 300_000);
    expect(rechecked && f.binding.read().warning).toBe(true);
    expect(f.scheduled() - before).toBe(1);
    expect(f.timers.size).toBe(1);
    unsubscribe();
  });
  it("H15 a listener recheck during activation keeps one cancellable timer", () => {
    const f = fixture(); let rechecked = false;
    const unsubscribe = f.binding.subscribe(() => {
      if (!rechecked) { rechecked = true; f.binding.recheck(); }
    });
    expect(rechecked && f.scheduled() === 1 && f.timers.size === 1).toBe(true);
    unsubscribe();
    expect(f.timers.size).toBe(0);
  });
});


it("shows local absence without claiming remote sign-out and keeps fixed Explorer re-entry", async () => {
  const f = fixture(async () => json("no_current_sign_in"));
  const unsubscribe = f.binding.subscribe(() => undefined);
  await f.binding.signOut();
  expect(f.binding.read().screen).toBe("no_current_sign_in");
  const html = renderToStaticMarkup(createElement(ExplorerSessionOutcome, { outcome: "no_current_sign_in" }));
  expect(html.includes("No current sign-in was found at this browser address.")).toBe(true);
  expect(html.includes('href="/login/explorer"')).toBe(true);
  expect(html.includes("SM-OUT-01") || html.includes("You're signed out") || html.includes("Explorer home")).toBe(false);
  expect(f.timers.size).toBe(0);
  expect(f.fetch.mock.calls.length).toBe(1);
  await f.binding.signOut();
  expect(f.fetch.mock.calls.length).toBe(1);
  unsubscribe();
});
