import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createExplorerHomeViewBinding, ExplorerHome, ExplorerSessionOutcome } from "../ExplorerHome";
import { ExplorerHomeNavigation } from "../ExplorerHomeNavigation";
import { ExplorerOverviewHome } from "../ExplorerOverviewHome";
import { NOT_YET_IMPLEMENTED, NOT_YET_IMPLEMENTED_PREFIX } from "../../../lib/solmind/explorerConversationScreen";
import { SESSION_WARNING, SIGNED_OUT_PRIVACY, SIGN_OUT_UNCERTAINTY } from "../../../lib/solmind/explorerLoginJourney";
import { EXPLORER_OVERVIEW, OVERVIEW_HEADING_ID } from "../../../lib/solmind/explorerOverviewHome";
import { WORKSPACE_NOT_CONNECTED_LABEL, withoutReviewPrefix } from "../../../lib/solmind/workspaceNavigation";

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
    // Since 2026-11-02 the signed-in home is Overview (Paul's decisions), headed by its own title.
    expect(html.includes(EXPLORER_OVERVIEW.title) && html.includes("Sign out")).toBe(true);
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
      // Since 2026-11-02 nothing renders "Explorer home", so the clause above cannot fail on its own: an
      // outcome screen also shows no workspace menu and no Overview.
      expect(html.includes("<nav") || html.includes(EXPLORER_OVERVIEW.title), outcome).toBe(false);
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
  // Nor the Overview (2026-11-02): an outcome screen shows no workspace menu.
  expect(html.includes("<nav") || html.includes(EXPLORER_OVERVIEW.title)).toBe(false);
  expect(f.timers.size).toBe(0);
  expect(f.fetch.mock.calls.length).toBe(1);
  await f.binding.signOut();
  expect(f.fetch.mock.calls.length).toBe(1);
  unsubscribe();
});

describe("Explorer home design previews", () => {
  it("H16 links the conversation screen design review with its own honest line", () => {
    const html = renderToStaticMarkup(createElement(ExplorerHomeNavigation));
    expect(html.includes('href="/explorer/conversation-preview"')).toBe(true);
    expect(html.includes("Conversation screen design review")).toBe(true);
    expect(html.includes("Design review only: sample content and working layout controls; conversation features are not connected.")).toBe(true);
    expect(html.includes("nothing on this screen works yet")).toBe(false);
    // Paul approved this wording on 2026-10-31 at 01:36 ("yes to 1-4", item 4).
    expect(html.includes("These previews use a fixed local script.")).toBe(false);
    expect(html.includes(
      "The older previews use a fixed local script. The conversation design review shows sample messages and cannot reply.",
    )).toBe(true);
    expect(html.includes('href="/explorer/compass-comparison"') && html.includes('href="/explorer"')).toBe(true);
  });
  it("H17 a pending home disables the design review link like the other previews", () => {
    const html = renderToStaticMarkup(createElement(ExplorerHomeNavigation, { navigationDisabled: true }));
    expect(html.includes('href="/explorer/conversation-preview"')).toBe(false);
    // The same non-link form, in the dark and amber look of the Overview home (2026-11-02).
    expect(html.includes('<span aria-disabled="true" class="block rounded-xl border border-amber-200/15 bg-white/[0.03] p-4 text-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 opacity-60">Conversation screen design review</span>')).toBe(true);
    expect(html.includes("<a ")).toBe(false);
  });
  it("H18 the signed-in home renders the design review link", () => {
    const html = renderToStaticMarkup(createElement(ExplorerHome, { session }));
    expect(html.includes('href="/explorer/conversation-preview"')).toBe(true);
  });
});

// Paul's 2026-11-02 decisions (decision queue 14:07:48 and 22:19:17 CST): Overview is the Explorer home, in
// the Explorer workspace frame, with the Option A mockup's cards and wording and no names or counts.
describe("Explorer home as Overview", () => {
  const overview = (pending = false, warning = false) =>
    renderToStaticMarkup(createElement(ExplorerOverviewHome, { pending, warning, onSignOut: () => undefined }));
  const SENTENCE_ID = "nyi-overview-virtualGuideCanSee";

  it("H19 shows Overview current in the Explorer workspace menu and the Overview header", () => {
    const html = renderToStaticMarkup(createElement(ExplorerHome, { session }));
    expect(html).toContain('<nav aria-label="Explorer workspace" class="px-3">');
    expect(html).toMatch(/<a aria-current="page" class="[^"]*border-amber-300\/25 bg-amber-300\/10[^"]*" href="\/explorer\/home">/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain("Explorer workspace <span aria-hidden=\"true\">/</span> <span class=\"text-stone-200\">Overview</span>");
    expect(html).toContain(`>${EXPLORER_OVERVIEW.eyebrow}</p>`);
    expect(html).toMatch(new RegExp(`<h1 class="[^"]*" id="${OVERVIEW_HEADING_ID}" tabindex="-1">${EXPLORER_OVERVIEW.title}</h1>`));
    expect(html).toContain(EXPLORER_OVERVIEW.subtitle);
    // The earlier list of three links and its heading are replaced by the menu and the cards.
    expect(html).not.toContain("Your Explorer workspace");
    expect(html).not.toContain("Review ended conversations");
    expect(html).not.toContain(">Explorer home<");
  });
  it("H20 shows the two mockup cards with working links", () => {
    const html = overview();
    expect(html).toContain(`>${EXPLORER_OVERVIEW.begin.title}</h2><span class="rounded-full border border-amber-300/50 px-2 py-0.5 text-[11px] font-semibold text-amber-100">AI</span>`);
    expect(html).toContain(EXPLORER_OVERVIEW.begin.body);
    expect(html).toMatch(/<a class="[^"]*bg-amber-400[^"]*" href="\/explorer\/conversation">Talk with your Virtual Guide<\/a>/);
    expect(html).toContain(`>${EXPLORER_OVERVIEW.suggestions.title}</h2>`);
    expect(html).toContain(EXPLORER_OVERVIEW.suggestions.body);
    expect(html).toMatch(/<a class="[^"]*border-amber-200\/25[^"]*" href="\/explorer\/waypoints">Open suggestions<\/a>/);
    expect(html.indexOf(EXPLORER_OVERVIEW.begin.title)).toBeLessThan(html.indexOf(EXPLORER_OVERVIEW.suggestions.title));
  });
  it("H21 the not-connected secondary action explains itself with the review sentence, no blue note", () => {
    const html = overview();
    const button = new RegExp(`<button aria-controls="${SENTENCE_ID}" aria-expanded="false" class="[^"]*" type="button">([\\s\\S]*?)</button>`).exec(html);
    expect(button).not.toBeNull();
    expect(button?.[1]).toContain(EXPLORER_OVERVIEW.begin.canSee);
    expect(button?.[1]).toContain(`<span class="text-[11px] font-normal text-stone-400">${WORKSPACE_NOT_CONNECTED_LABEL}</span>`);
    const sentence = withoutReviewPrefix(NOT_YET_IMPLEMENTED.virtualGuideCanSee).replaceAll("'", "&#x27;");
    expect(html).toContain(`<p class="text-xs leading-5 text-stone-300" hidden="" id="${SENTENCE_ID}">${sentence}</p>`);
    expect(html).not.toContain(NOT_YET_IMPLEMENTED_PREFIX);
    expect(/data-preview-|sky-|border-dashed|aria-disabled/.test(html)).toBe(false);
  });
  it("H22 a pending sign-out shows every link on the page in its non-link form", () => {
    const ready = overview();
    // Overview, Conversations and Waypoints in the rail, the two card links and the three design previews.
    expect(ready.match(/<a /g)).toHaveLength(3 + 2 + 3);
    const pending = overview(true);
    expect(pending.includes("<a ")).toBe(false);
    for (const label of ["Overview", "Conversations", "Waypoints", "Talk with your Virtual Guide", "Open suggestions", "Conversation screen design review"]) {
      expect(pending, label).toMatch(new RegExp(`<span aria-disabled="true" class="[^"]*opacity-60">(?:<svg[\\s\\S]*?</svg><span class="flex min-w-0 flex-col"><span>)?${label}<`));
    }
    expect(pending).toContain('<nav aria-busy="true" aria-label="Explorer workspace" class="px-3">');
    expect(pending).toMatch(/<button class="[^"]*" disabled="" type="button">Signing out\.\.\.<\/button>/);
  });
  it("H23 keeps the order cards, session warning, design previews, sign out, and names no one", () => {
    const html = overview(false, true);
    const order = [EXPLORER_OVERVIEW.suggestions.body, `role="status">${SESSION_WARNING}</p>`, "Design previews", ">Sign out</button>"]
      .map((text) => html.indexOf(text));
    expect(order.every((index) => index > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(overview().includes(SESSION_WARNING)).toBe(false);
    expect(/Mary|Avery|Jordan|Steve|unread/.test(html)).toBe(false);
    expect(html.match(/<main/g)).toHaveLength(1);
  });
  // The Explorer twin of GuideHome.test.tsx GD07.
  it("H24 the outcome screens take the dark look and keep their text and Explorer re-entry link", () => {
    const html = renderToStaticMarkup(createElement(ExplorerSessionOutcome, { outcome: "session_ended" }));
    expect(html).toContain('<main class="min-h-dvh bg-[#050404] px-6 py-16 text-stone-100">');
    expect(html).toContain(">Your session ended</h1>");
    expect(html).toContain(">Sign in again to continue as an Explorer.</p>");
    expect(html).toMatch(/<a class="[^"]*bg-amber-400[^"]*" href="\/login\/explorer">Sign in<\/a>/);
    expect(html.includes("<nav")).toBe(false);
    // The focused heading shows the amber ring to a keyboard user (2026-11-03), never a removed outline.
    expect(html).toMatch(/<h1 class="[^"]*focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300[^"]*" tabindex="-1">Your session ended<\/h1>/);
    expect(html).not.toContain("focus:outline-none");
  });
});
