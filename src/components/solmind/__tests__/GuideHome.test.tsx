import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SESSION_WARNING } from "../../../lib/solmind/explorerLoginJourney";
import { EXPLORER_OVERVIEW } from "../../../lib/solmind/explorerOverviewHome";
import { GUIDE_DASHBOARD, GUIDE_DASHBOARD_HEADING_ID } from "../../../lib/solmind/guideDashboardHome";
import { GUIDE_MENU } from "../../../lib/solmind/workspaceMenus";
import { WORKSPACE_NOT_CONNECTED_LABEL } from "../../../lib/solmind/workspaceNavigation";
import { GuideDashboardHome } from "../GuideDashboardHome";
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
    // Since 2026-11-02 the signed-in Guide home is the Dashboard: its heading "Welcome back" replaces the
    // earlier "Guide home" heading (Paul's decisions; the Dashboard tests below check the rest).
    // Nothing renders "Explorer home" any more, so the cross-role check looks for the Explorer workspace
    // menu and the Explorer Overview heading instead.
    check(html.includes(">Welcome back</h1>") && html.includes("Sign out"));
    check(!html.includes('aria-label="Explorer workspace"') && !html.includes(EXPLORER_OVERVIEW.title));
    check(!html.includes("Guide home"));
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
    // An outcome screen shows neither the Dashboard nor the workspace menu (2026-11-02).
    check(!html.includes(">Welcome back</h1>") && !html.includes("<nav"));
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
  // Nor the Dashboard (2026-11-02): an outcome screen shows no workspace.
  expect(html.includes("Welcome back") || html.includes("<nav")).toBe(false);
  expect(f.timers.size).toBe(0);
  expect(f.calls.length).toBe(1);
  await f.binding.signOut();
  expect(f.calls.length).toBe(1);
  f.close();
});

// Paul's 2026-11-02 decisions (decision queue 14:07:48 and 22:19:17 CST): the Guide home is the Dashboard,
// in the Guide workspace frame with the August Guide menu, with the Guide dashboard mockup's four cards
// and no names, counts or sample times ("Mockup cards, no names"). /guide/home is guarded on the server and
// cannot be opened in a browser test without a sign-in, so its markup is proved here.
describe("Guide home as the Dashboard", () => {
  const dashboard = (pending = false, warning = false) =>
    renderToStaticMarkup(createElement(GuideDashboardHome, { pending, warning, onSignOut: () => undefined }));
  const CURRENT = "border-amber-300/25 bg-amber-300/10 font-semibold text-amber-200";
  const GREY = `<span class="text-[11px] font-normal text-stone-400">${WORKSPACE_NOT_CONNECTED_LABEL}</span>`;
  const { explorers, assistant, appointment, suggestions } = GUIDE_DASHBOARD;
  const text = (html: string) => html.replace(/<[^>]+>/g, " ").replaceAll("&#x27;", "'").replace(/\s+/g, " ");
  const rail = (html: string) => {
    const match = /<nav (?:aria-busy="true" )?aria-label="Guide workspace" class="px-3">([\s\S]*?)<\/nav>/.exec(html);
    if (match === null) throw new Error("rail menu missing");
    return match[1];
  };

  it("GD01 shows Dashboard current in the Guide workspace menu, the breadcrumb and the header", () => {
    const html = renderToStaticMarkup(createElement(GuideHome, { session }));
    const menu = rail(html);
    expect(menu).toMatch(new RegExp(`<a aria-current="page" class="[^"]*${CURRENT.replaceAll("/", "\\/")}[^"]*" href="/guide/home">`));
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    // The August Guide menu in order: Dashboard works, the other four are not connected yet.
    const labels = [...menu.matchAll(/<span>([^<]+)<\/span>/g)].map((match) => match[1]);
    expect(labels).toEqual(["Dashboard", "Explorers", "Chat with your Guide Assistant", "Appointments", "Archive"]);
    expect(menu.split(GREY).length - 1).toBe(4);
    expect(html).toContain(`Guide workspace <span aria-hidden="true">/</span> <span class="text-stone-200">Dashboard</span>`);
    expect(html).toContain(`>${GUIDE_DASHBOARD.eyebrow}</p>`);
    expect(html).toMatch(new RegExp(`<h1 class="[^"]*" id="${GUIDE_DASHBOARD_HEADING_ID}" tabindex="-1">Welcome back</h1>`));
    expect(html).toContain(GUIDE_DASHBOARD.subtitle);
    // The profile chip shows the role with the person icon, not the Explorer's hiking boot.
    expect(html).toContain('Guide<span class="sr-only"> profile</span>');
    expect(html).toContain('<circle cx="12" cy="8" r="4"></circle>');
    expect(html).not.toContain('d="M7 3h6v7l5 2.5');
  });

  it("GD02 shows the four mockup cards in order with the one working link", () => {
    const html = dashboard();
    const titles = [explorers.title, assistant.title, appointment.title, suggestions.title].map((title) => html.indexOf(`>${title}</h2>`));
    expect(titles.every((index) => index > 0)).toBe(true);
    expect([...titles].sort((a, b) => a - b)).toEqual(titles);
    expect(html).toContain('<div class="grid gap-5 md:grid-cols-2">');
    for (const body of [explorers.body, assistant.body, appointment.body, suggestions.body]) {
      expect(html, body).toContain(body.replaceAll("'", "&#x27;"));
    }
    expect(html).toMatch(/<a class="[^"]*border-amber-200\/25[^"]*" href="\/guide\/waypoint-suggestions">View Waypoint Suggestions<\/a>/);
    // The rail's Dashboard and this card link are the page's only links.
    expect(html.match(/<a /g)).toHaveLength(2);
  });

  it("GD03 the three card buttons not connected yet explain themselves with their menu entries' sentences", () => {
    const html = dashboard();
    const cards: [string, string, string][] = [
      ["explorers", explorers.action, explorers.explanation],
      ["assistant", assistant.action, assistant.explanation],
      ["appointments", appointment.action, appointment.explanation],
    ];
    for (const [card, label, sentence] of cards) {
      const id = `not-connected-dashboard-${card}`;
      const button = new RegExp(`<button aria-controls="${id}" aria-expanded="false" class="[^"]*" type="button">([\\s\\S]*?)</button>`).exec(html);
      expect(button, card).not.toBeNull();
      expect(button?.[1], card).toContain(`>${label}</span>`);
      expect(button?.[1], card).toContain(GREY);
      expect(html, card).toContain(`<p class="text-xs leading-5 text-stone-300" hidden="" id="${id}">${sentence.replaceAll("'", "&#x27;")}</p>`);
    }
    expect(explorers.explanation).toBe(GUIDE_MENU[1].explanation);
    expect(assistant.explanation).toBe(GUIDE_MENU[2].explanation);
    expect(appointment.explanation).toBe(GUIDE_MENU[3].explanation);
    expect(/data-preview-|sky-|border-dashed|aria-disabled|Not yet implemented/.test(html)).toBe(false);
  });

  it("GD04 a pending sign-out shows every link in its non-link form", () => {
    const pending = dashboard(true);
    expect(pending.includes("<a ")).toBe(false);
    for (const label of ["Dashboard", "View Waypoint Suggestions"]) {
      expect(pending, label).toMatch(new RegExp(`<span aria-disabled="true" class="[^"]*opacity-60">(?:<svg[\\s\\S]*?</svg><span class="flex min-w-0 flex-col"><span>)?${label}<`));
    }
    expect(pending).toContain('<nav aria-busy="true" aria-label="Guide workspace" class="px-3">');
    expect(pending).toMatch(/<button class="[^"]*" disabled="" type="button">Signing out\.\.\.<\/button>/);
    // The buttons not connected yet only show their sentences, so they stay buttons.
    expect(pending.match(/<button aria-controls="not-connected-dashboard-/g)).toHaveLength(3);
  });

  it("GD05 names no one, shows no counts or sample times, and the Guide Assistant always reads as AI", () => {
    const html = dashboard(false, true);
    const visible = text(html);
    expect(/Steve|Mary|Avery|Jordan|Guide Assistant dashboard/.test(html)).toBe(false);
    // No count or time: the only number on the page is the existing session warning's "5 minutes".
    expect(/\d/.test(visible.replace(SESSION_WARNING, ""))).toBe(false);
    // The Guide Assistant card carries the AI badge right after its title and says the assistant is AI.
    expect(html).toContain(`>${assistant.title}</h2><span class="rounded-full border border-amber-300/50 px-2 py-0.5 text-[11px] font-semibold text-amber-100">AI</span>`);
    expect(assistant.body.startsWith("Your SolMind Guide Assistant is AI.")).toBe(true);
    // Every mention is the canonical "SolMind Guide Assistant", Paul's menu label "Chat with your Guide
    // Assistant" (used for the menu entry and the card button), or the card title with its AI badge.
    expect(html.match(/>AI<\/span>/g)).toHaveLength(1);
    const mentions = [...visible.matchAll(/(?:SolMind |Chat with your )?Guide Assistant(?: AI\b)?/g)].map((match) => match[0]);
    expect(mentions.length).toBeGreaterThanOrEqual(5);
    for (const mention of mentions) {
      expect(["SolMind Guide Assistant", "Chat with your Guide Assistant", "Guide Assistant AI"], mention).toContain(mention);
    }
    expect(mentions.filter((mention) => mention === "Guide Assistant AI")).toHaveLength(1);
  });

  it("GD06 keeps the order cards, session warning, sign out, in one main", () => {
    const html = dashboard(false, true);
    const order = [suggestions.body, `role="status">${SESSION_WARNING}</p>`, ">Sign out</button>"].map((part) => html.indexOf(part));
    expect(order.every((index) => index > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(dashboard().includes(SESSION_WARNING)).toBe(false);
    expect(html.match(/<main /g)).toHaveLength(1);
    expect(html.match(/role="status"/g)).toHaveLength(1);
  });

  it("GD07 the outcome screens take the dark look and keep their text and Guide re-entry link", () => {
    const html = renderToStaticMarkup(createElement(GuideSessionOutcome, { outcome: "session_ended" }));
    expect(html).toContain('<main class="min-h-dvh bg-[#050404] px-6 py-16 text-stone-100">');
    expect(html).toContain(">Your session ended</h1>");
    expect(html).toContain(">Sign in again to continue as a Guide.</p>");
    expect(html).toMatch(/<a class="[^"]*bg-amber-400[^"]*" href="\/login\/guide">Sign in<\/a>/);
    expect(html.includes("<nav")).toBe(false);
    // The focused heading shows the amber ring to a keyboard user (2026-11-03), never a removed outline.
    expect(html).toMatch(/<h1 class="[^"]*focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300[^"]*" tabindex="-1">Your session ended<\/h1>/);
    expect(html).not.toContain("focus:outline-none");
  });
});
