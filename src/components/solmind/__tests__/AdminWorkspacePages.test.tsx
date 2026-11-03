import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AdminWorkspaceView } from "@/lib/solmind/adminWorkspaceContract";

import { AdminWorkspacePage } from "../AdminWorkspacePages";

// Static markup of the four minimal Admin screens (decision queue 2026-11-03 11:56:14 and 12:19:09). The pages
// need a sign-in, so as for GuideHome.test.tsx this proves their markup; interaction is checked on the demo.
const STOP = "44444444-4444-4444-8444-444444444444";
const STOP_TWO = "66666666-6666-4666-8666-666666666666";
const draw = (view: AdminWorkspaceView, pending = false) =>
  renderToStaticMarkup(createElement(AdminWorkspacePage, { view, pending, warning: false, onSignOut: () => undefined }));
// One table cell with exactly this text.
const CELL = (text: string) => `<td[^>]*>${text}</td>`;

const VIEWS: Readonly<Record<AdminWorkspaceView["page"], AdminWorkspaceView>> = {
  dashboard: { page: "dashboard", overview: { guides: 2, explorers: 1500, explorersSignedInLast7Days: 7, accountsPausedNow: 3 } },
  people: { page: "people", guides: [
    { name: "Synthetic Guide", explorers: [
      { name: "Synthetic Explorer", relationshipStatus: "active", lastSignIn: "Nov 2, 2026, 11:05 AM CST", pausedNow: "own_limit" },
      { name: "Synthetic Second", relationshipStatus: "paused", lastSignIn: null, pausedNow: "shared" },
      { name: "Synthetic Third", relationshipStatus: "active", lastSignIn: null, pausedNow: "none" }] },
    { name: "Synthetic Lone Guide", explorers: [] }] },
  aiUse: { page: "aiUse", aiUse: {
    pauses: [
      { kind: "recorded", stopId: STOP, explorerName: "Synthetic Explorer", stopDay: "Nov 3, 2026", reachedAt: "Nov 3, 2026, 10:00 AM CST", dayTotal: 500, limit: 400, inCrisisAtStop: true },
      { kind: "recorded", stopId: STOP_TWO, explorerName: "Synthetic Calm", stopDay: "Nov 2, 2026", reachedAt: "Nov 2, 2026, 9:00 PM CST", dayTotal: 450, limit: 450, inCrisisAtStop: false },
      { kind: "not_recorded", explorerName: "Synthetic Lowered", stopDay: "Nov 3, 2026", dayTotal: 30, limit: 20 }],
    sharedStop: { stopDay: "Nov 3, 2026", reachedAt: "Nov 3, 2026, 11:30 AM CST", dayTotal: 1200, limit: 1200 } } },
  settings: { page: "settings", settings: [
    { key: "explorer_ai_use_individual_daily_call_limit", value: 500, minimum: 1, defaultValue: 500, maximum: 2000, version: 3 }] },
};

describe("minimal Admin screens", () => {
  it("draws every page in the Admin workspace frame with four working menu links and the Admin profile chip", () => {
    for (const view of Object.values(VIEWS)) {
      const html = draw(view);
      expect(html).toContain('aria-label="Admin workspace"');
      for (const href of ["/admin/home", "/admin/people", "/admin/ai-use", "/admin/settings"]) expect(html, view.page).toContain(`href="${href}"`);
      // The rail is drawn; the phone menu panel is not drawn while closed.
      expect(html.match(/aria-current="page"/g)?.length, view.page).toBe(1);
      expect(html).toContain("Admin<span class=\"sr-only\"> profile</span>");
      expect(html).toContain("Sign out");
      // The People page says what it never shows; no page shows a message date or count.
      expect(html, view.page).not.toMatch(/last message|messages sent|message date:/i);
    }
  });

  it("shows each Dashboard count under its own card", () => {
    const html = draw(VIEWS.dashboard);
    for (const [id, title, value] of [["guides", "Guides", "2"], ["explorers", "Explorers", "1,500"],
      ["active", "Explorers active in the last 7 days", "7"], ["paused", "Accounts paused now", "3"]]) {
      expect(html, id).toMatch(new RegExp(`id="admin-dashboard-${id}-title">${title}</h2></div><p[^>]*>${value}</p>`));
    }
    expect(html).toContain("Counted by sign-ins.");
    expect(html).toContain("Paused by their own daily AI-use limit. A shared pause for everyone shows under AI use and pauses.");
  });

  it("shows each Guide with their Explorers by name, sign-ins only, and each Explorer's paused-now value", () => {
    const html = draw(VIEWS.people);
    for (const text of ["Synthetic Guide", "Nov 2, 2026, 11:05 AM CST", "No Explorers yet.",
      "Sign-ins only: no conversation content, message dates or message counts.",
      "Paused now: &quot;Yes&quot; means paused by the Explorer&#x27;s own daily AI-use limit. &quot;Yes, shared pause&quot; means only today&#x27;s shared pause for everyone applies; it lifts at midnight, Chicago time. &quot;No&quot; means not paused."]) {
      expect(html).toContain(text);
    }
    expect(html).toMatch(new RegExp(`${CELL("Synthetic Explorer")}${CELL("Active")}${CELL("Nov 2, 2026, 11:05 AM CST")}${CELL("Yes")}</tr>`));
    expect(html).toMatch(new RegExp(`${CELL("Synthetic Second")}${CELL("Paused")}${CELL("Never")}${CELL("Yes, shared pause")}</tr>`));
    expect(html).toMatch(new RegExp(`${CELL("Synthetic Third")}${CELL("Active")}${CELL("Never")}${CELL("No")}</tr>`));
  });

  it("shows who is paused with the crisis status recorded at the limit, a Lift pause button per recorded stop, a pause not recorded yet and today's shared stop", () => {
    const html = draw(VIEWS.aiUse);
    for (const text of ["Crisis or urgent at the limit", "Lifting a pause is recorded as Paul&#x27;s lift.",
      "Shared pause today: reached at Nov 3, 2026, 11:30 AM CST with 1,200 calls of 1,200."]) expect(html).toContain(text);
    expect(html).toMatch(new RegExp(
      `<tr>${CELL("Synthetic Explorer")}${CELL("Nov 3, 2026")}${CELL("Nov 3, 2026, 10:00 AM CST")}${CELL("500")}${CELL("400")}${CELL("Yes")}<td[^>]*><div[^>]*><button[^>]*>Lift pause</button>`));
    expect(html).toMatch(new RegExp(
      `<tr>${CELL("Synthetic Calm")}${CELL("Nov 2, 2026")}${CELL("Nov 2, 2026, 9:00 PM CST")}${CELL("450")}${CELL("450")}${CELL("No")}<td[^>]*><div[^>]*><button[^>]*>Lift pause</button>`));
    expect(html).toMatch(new RegExp(`<tr>${CELL("Synthetic Lowered")}${CELL("Nov 3, 2026")}${CELL("Not recorded yet")}${CELL("30")}${CELL("20")}` +
      `${CELL("Not recorded yet")}${CELL("No stop is recorded for this pause, so it cannot be lifted here. To end it now, raise the limit on the Settings page above this Explorer&#x27;s calls today; otherwise it ends at midnight, Chicago time.")}</tr>`));
    expect(html.match(/>Lift pause<\/button>/g)?.length).toBe(2);
    expect(html).not.toContain("No one is paused now by their own daily limit.");
    expect(draw(VIEWS.aiUse, true)).toMatch(/<button[^>]*disabled=""[^>]*>Lift pause<\/button>/);
  });

  it("says no one is paused only when the list is empty, and that there is no shared pause", () => {
    const html = draw({ page: "aiUse", aiUse: { pauses: [], sharedStop: null } });
    expect(html).toContain("No one is paused now by their own daily limit.");
    expect(html).toContain("No shared pause today.");
    expect(html).not.toContain("Lift pause");
  });

  it("shows each setting with its value, range and a one-setting form", () => {
    const html = draw(VIEWS.settings);
    for (const text of ["AI calls per Explorer per day", "explorer_ai_use_individual_daily_call_limit", "Allowed range: 1 to 2,000.",
      "Default: 500.", "New value", ">Save<",
      "Reaching it pauses that Explorer until the pause is lifted. A change takes effect at once.</p>",
      "The six protected settings. Each change is saved one setting at a time and recorded as approved by Paul."]) expect(html).toContain(text);
    expect(html.match(/<form/g)?.length).toBe(1);
  });

  it("says a failed read plainly instead of showing a session end", () => {
    expect(draw({ page: "settings", settings: null })).toContain("This information could not be loaded. Reload the page to try again.");
  });

  it("keeps the new Admin components ASCII and free of browser storage", () => {
    for (const file of ["AdminWorkspacePages.tsx", "AdminWorkspaceActions.tsx", "AdminDashboardHome.tsx", "AdminHome.tsx"]) {
      const source = readFileSync(path.resolve(__dirname, "..", file), "utf8");
      expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(source), file).toBe(true);
      expect(/localStorage|sessionStorage|indexedDB|process\.env/.test(source), file).toBe(false);
    }
  });
});
