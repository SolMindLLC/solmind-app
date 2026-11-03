import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { NOT_YET_IMPLEMENTED, NOT_YET_IMPLEMENTED_PREFIX, UNNAMED_GUIDE, guideNotes } from "../explorerConversationScreen";
import { EXPLORER_OVERVIEW } from "../explorerOverviewHome";
import { EXPLORER_WORKSPACE_FRAMES, type ExplorerWorkspacePage } from "../explorerWorkspaceFrame";
import { GUIDE_DASHBOARD } from "../guideDashboardHome";
import { GUIDE_WORKSPACE_FRAMES, type GuideWorkspacePage } from "../guideWorkspaceFrame";
import { EXPLORER_HOME_ROUTE, GUIDE_HOME_ROUTE } from "../routeAccess";
import {
  EXPLORER_CONVERSATION_SPACES, EXPLORER_MENU, GUIDE_MENU, GUIDE_MENU_LABELS, GUIDE_WAYPOINT_SUGGESTIONS,
} from "../workspaceMenus";
import { EXPLORER_MENU_LABELS, WORKSPACE_NOT_CONNECTED_LABEL, withoutReviewPrefix } from "../workspaceNavigation";

const appRoot = path.resolve(__dirname, "..", "..", "..", "..");
const LEAF_FILE = "src/lib/solmind/workspaceNavigation.ts";
const MENUS_FILE = "src/lib/solmind/workspaceMenus.ts";
const read = (file: string) => readFileSync(path.join(appRoot, file), "utf8");
const LEAF = read(LEAF_FILE);
const MENUS = read(MENUS_FILE);
const ENTRIES = [...EXPLORER_MENU, ...EXPLORER_CONVERSATION_SPACES];

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/from ["']([^"']+)["']/g)].map((match) => match[1]);
}

// Every non-test source file under src, so a new importer is found too.
function sourceFiles(directory: string): string[] {
  return readdirSync(path.join(appRoot, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(relative);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [relative] : [];
  });
}

// Paul's 2026-11-02 Explorer menu option A (decision queue 14:07:48 and 22:19:17 CST).
describe("shared workspace menu definition", () => {
  it("WN01 keeps the September 23 order and labels", () => {
    // spaces (slice 3) names the list of conversation spaces, so the shared list takes every name as data.
    expect(EXPLORER_MENU_LABELS).toEqual({
      rail: "Explorer workspace", phone: "Explorer workspace menu", heading: "Workspace", spaces: "Conversation spaces",
    });
    expect(EXPLORER_MENU.map((entry) => [entry.id, entry.label])).toEqual([
      ["overview", "Overview"],
      ["conversations", "Conversations"],
      ["waypoints", "Waypoints"],
      ["settings", "Settings"],
    ]);
    expect(EXPLORER_CONVERSATION_SPACES.map((space) => [space.id, space.label, space.description])).toEqual([
      ["virtualGuide", "With your Virtual Guide", "Waypoint conversations, private to you"],
      ["guide", "With your Guide", null],
      ["newConversation", "Start a new conversation", null],
    ]);
    expect(WORKSPACE_NOT_CONNECTED_LABEL).toBe("Not connected yet");
  });

  it("WN02 has the decided destinations; Overview is the signed-in Explorer home", () => {
    expect(ENTRIES.map((entry) => [entry.id, entry.href])).toEqual([
      ["overview", "/explorer/home"],
      ["conversations", "/explorer/conversations"],
      ["waypoints", "/explorer/waypoints"],
      ["settings", null],
      ["virtualGuide", "/explorer/conversation"],
      ["guide", null],
      ["newConversation", null],
    ]);
    expect(EXPLORER_MENU[0].href).toBe(EXPLORER_HOME_ROUTE);
    // The home path comes from routeAccess.ts and is not written in either file again.
    for (const source of [LEAF, MENUS]) expect(source).not.toContain('"/explorer/home"');
  });

  it("WN03 each entry not connected yet has one review sentence without its prefix", () => {
    for (const entry of ENTRIES) {
      if (entry.href !== null) {
        expect(entry.explanation, entry.id).toBeNull();
        continue;
      }
      expect(entry.explanation, entry.id).not.toBeNull();
      expect(entry.explanation?.startsWith(NOT_YET_IMPLEMENTED_PREFIX), entry.id).toBe(false);
      expect(entry.explanation?.endsWith("."), entry.id).toBe(true);
      expect(entry.explanation?.split(". ").length, entry.id).toBe(1);
    }
    expect(EXPLORER_MENU[3].explanation).toBe(withoutReviewPrefix(NOT_YET_IMPLEMENTED.settings));
    expect(EXPLORER_CONVERSATION_SPACES[1].explanation).toBe("This will open your separate conversations with your Guide.");
    expect(EXPLORER_CONVERSATION_SPACES[1].explanation).toBe(withoutReviewPrefix(guideNotes(UNNAMED_GUIDE).guideSpace));
    expect(EXPLORER_CONVERSATION_SPACES[2].explanation).toBe(withoutReviewPrefix(NOT_YET_IMPLEMENTED.newConversation));
    expect(() => withoutReviewPrefix("A sentence without the prefix.")).toThrow("review_prefix_missing");
  });

  it("WN04 both files are frozen, ASCII-only presentation data under 300 lines", () => {
    expect(Object.isFrozen(EXPLORER_MENU_LABELS)).toBe(true);
    expect(Object.isFrozen(EXPLORER_MENU)).toBe(true);
    expect(Object.isFrozen(EXPLORER_CONVERSATION_SPACES)).toBe(true);
    for (const entry of ENTRIES) expect(Object.isFrozen(entry), entry.id).toBe(true);
    for (const [file, source] of [[LEAF_FILE, LEAF], [MENUS_FILE, MENUS]]) {
      expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(source), file).toBe(true);
      expect(source.split("\n").length, file).toBeLessThanOrEqual(300);
      expect(/from ["']react|["']use client["']|\bfetch\s*\(|process\.env/.test(source), file).toBe(false);
    }
  });

  it("WN05 the review route's parts reach only the labels leaf; the menu data stays with the signed-in screen", () => {
    // The leaf imports nothing but the review wording module, so it never reaches routeAccess.ts.
    expect(importSpecifiers(LEAF)).toEqual(["./explorerConversationScreen"]);
    // Slice 4 adds ./terms: the Guide menu takes its role words ("Guide", "Explorer", "SolMind Guide
    // Assistant") from the canonical terms instead of writing them again. terms.ts imports nothing.
    expect(importSpecifiers(MENUS)).toEqual(["./routeAccess", "./explorerConversationScreen", "./terms", "./workspaceNavigation"]);
    expect(importSpecifiers(read("src/lib/solmind/terms.ts"))).toEqual([]);
    // Any specifier ending in workspaceMenus (alias, ./, ../ or with .ts), static or dynamic.
    const importers = sourceFiles("src").filter((file) => /(?:from|import\()\s*["'][^"']*\/workspaceMenus(?:\.ts)?["']/.test(read(file)));
    // Fix list r1 item 4 kept the menu data for the signed-in screens: the conversation screen's wording,
    // since slice 3 the Explorer workspace frame data and the Overview home wording (card links), and
    // since slice 4 the Guide workspace frame data and the Guide Dashboard wording. All are lib files.
    expect([...importers].sort()).toEqual([
      "src/lib/solmind/explorerConversationConnectedScreen.ts",
      "src/lib/solmind/explorerOverviewHome.ts",
      "src/lib/solmind/explorerWorkspaceFrame.ts",
      "src/lib/solmind/guideDashboardHome.ts",
      "src/lib/solmind/guideWorkspaceFrame.ts",
    ]);
    // No conversation-screen part imports the menu data.
    const parts = readdirSync(path.join(appRoot, "src/components/solmind"))
      .filter((name) => /^ExplorerConversationScreen\w+\.tsx$/.test(name))
      .map((name) => read(`src/components/solmind/${name}`));
    expect(parts.length).toBeGreaterThan(0);
    for (const source of parts) expect(source).not.toMatch(/workspaceMenus|routeAccess/);
  });
});

// Slice 3: the Explorer workspace frame on the other signed-in Explorer pages (decision queue 2026-11-02
// 14:07:48 and 22:19:17 CST), and the Overview home wording ("Mockup cards, no names").
describe("Explorer workspace frame data and Overview wording", () => {
  const FRAME_FILE = "src/lib/solmind/explorerWorkspaceFrame.ts";
  const OVERVIEW_FILE = "src/lib/solmind/explorerOverviewHome.ts";
  const current = (page: ExplorerWorkspacePage) =>
    EXPLORER_WORKSPACE_FRAMES[page].navigation.filter((item) => item.current !== false).map((item) => [item.id, item.current]);

  it("WN06 each page has its section current; only the section's own page is the current page", () => {
    expect(current("overview")).toEqual([["overview", "page"]]);
    expect(current("conversations")).toEqual([["conversations", "page"]]);
    expect(current("waypoints")).toEqual([["waypoints", "page"]]);
    expect(current("waypointDetail")).toEqual([["waypoints", true]]);
    for (const page of ["overview", "conversations", "waypoints", "waypointDetail"] as const) {
      const frame = EXPLORER_WORKSPACE_FRAMES[page];
      // The same entries, names and destinations as the conversation screen's menu.
      expect(frame.navigation.map((item) => ({ ...item, current: false }))).toEqual(
        EXPLORER_MENU.map((entry) => ({ ...entry, current: false })),
      );
      expect(frame.labels).toBe(EXPLORER_MENU_LABELS);
      expect(frame.breadcrumbRoot).toBe("Explorer workspace");
      // No page receives a name: the profile chip shows the role only.
      expect(frame.profile).toEqual({ name: "", role: "Explorer" });
      // The conversation spaces show under Conversations only, and none is the page on the list.
      expect(frame.spaces.length, page).toBe(page === "conversations" ? 3 : 0);
      expect(frame.spaces.every((space) => space.current === false), page).toBe(true);
      expect(Object.isFrozen(frame) && Object.isFrozen(frame.navigation) && Object.isFrozen(frame.spaces), page).toBe(true);
    }
  });

  it("WN07 the Overview wording names no one and links the shared destinations", () => {
    expect(EXPLORER_OVERVIEW.title).toBe("Take a quiet moment with your Virtual Guide");
    expect(EXPLORER_OVERVIEW.begin.body).toBe(
      "Your SolMind Virtual Guide is AI. This conversation is private unless you later choose exactly what to share.",
    );
    expect(EXPLORER_OVERVIEW.suggestions.body).toBe(
      "Suggestions from your Guide appear in Waypoints. You decide whether any become part of your private Waypoint work.",
    );
    expect(EXPLORER_OVERVIEW.begin.talkHref).toBe(EXPLORER_CONVERSATION_SPACES[0].href);
    expect(EXPLORER_OVERVIEW.suggestions.openHref).toBe(EXPLORER_MENU[2].href);
    expect(JSON.stringify(EXPLORER_OVERVIEW)).not.toMatch(/Mary|Avery|Jordan|Steve|unread|\d/);
    expect(Object.isFrozen(EXPLORER_OVERVIEW) && Object.isFrozen(EXPLORER_OVERVIEW.begin)).toBe(true);
    for (const file of [FRAME_FILE, OVERVIEW_FILE]) {
      const source = read(file);
      expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(source), file).toBe(true);
      expect(source.split("\n").length, file).toBeLessThanOrEqual(300);
      expect(/from ["']react|["']use client["']|\bfetch\s*\(|process\.env|"\/explorer\//.test(source), file).toBe(false);
    }
  });
});

// Slice 4: the August Guide menu, the Guide workspace frame data and the Guide Dashboard wording (decision
// queue 2026-11-02 14:07:48 and 22:19:17 CST). The Guide Assistant is never given a sample name.
describe("Guide workspace menu, frame data and Dashboard wording", () => {
  const GUIDE_FRAME_FILE = "src/lib/solmind/guideWorkspaceFrame.ts";
  const DASHBOARD_FILE = "src/lib/solmind/guideDashboardHome.ts";

  it("WN08 keeps the August Guide menu order, names and destinations", () => {
    expect(GUIDE_MENU_LABELS).toEqual({
      rail: "Guide workspace", phone: "Guide workspace menu", heading: "Workspace", spaces: "Conversation spaces",
    });
    expect(GUIDE_MENU.map((entry) => [entry.id, entry.label, entry.href])).toEqual([
      ["dashboard", "Dashboard", "/guide/home"],
      ["explorers", "Explorers", null],
      ["guideAssistant", "Chat with your Guide Assistant", null],
      ["appointments", "Appointments", null],
      ["archive", "Archive", null],
    ]);
    // Dashboard is the signed-in Guide home from routeAccess.ts, not the /guide prototype.
    expect(GUIDE_MENU[0].href).toBe(GUIDE_HOME_ROUTE);
    expect(MENUS).not.toContain('"/guide/home"');
    expect(GUIDE_WAYPOINT_SUGGESTIONS).toEqual({ label: "Waypoint Suggestions", href: "/guide/waypoint-suggestions" });
  });

  it("WN09 each Guide entry not connected yet has one new draft sentence; no sample name appears", () => {
    expect(GUIDE_MENU.map((entry) => entry.explanation)).toEqual([
      null,
      "Explorers will list the Explorers you guide, so you can open each one's workspace to review shared information and your own Guide activity.",
      "This will open a Guide-private conversation with your SolMind Guide Assistant, which uses only information in your Guide workspace and cannot see what an Explorer keeps private.",
      "Appointments will show your upcoming and recent Explorer appointments.",
      "Archive will hold items removed from your active Guide lists; Explorer records keep their own lifecycle.",
    ]);
    for (const entry of GUIDE_MENU.slice(1)) {
      expect(entry.explanation?.startsWith(NOT_YET_IMPLEMENTED_PREFIX), entry.id).toBe(false);
      expect(entry.explanation?.split(". ").length, entry.id).toBe(1);
      expect(entry.description, entry.id).toBeNull();
    }
    expect(JSON.stringify([GUIDE_MENU, GUIDE_MENU_LABELS])).not.toMatch(/Steve|Mary|Avery|Jordan|Guide Assistant dashboard/);
    expect(Object.isFrozen(GUIDE_MENU) && Object.isFrozen(GUIDE_MENU_LABELS) && Object.isFrozen(GUIDE_WAYPOINT_SUGGESTIONS)).toBe(true);
    for (const entry of GUIDE_MENU) expect(Object.isFrozen(entry), entry.id).toBe(true);
  });

  it("WN10 the Guide frame data: Dashboard is the current page on the home, no entry on the Waypoint pages", () => {
    const current = (page: GuideWorkspacePage) =>
      GUIDE_WORKSPACE_FRAMES[page].navigation.filter((item) => item.current !== false).map((item) => [item.id, item.current]);
    expect(current("dashboard")).toEqual([["dashboard", "page"]]);
    expect(current("waypointSuggestions")).toEqual([]);
    expect(GUIDE_WORKSPACE_FRAMES.dashboard.breadcrumbPage).toBeUndefined();
    expect(GUIDE_WORKSPACE_FRAMES.waypointSuggestions.breadcrumbPage).toBe("Waypoint Suggestions");
    for (const page of ["dashboard", "waypointSuggestions"] as const) {
      const frame = GUIDE_WORKSPACE_FRAMES[page];
      expect(frame.navigation.map((item) => ({ ...item, current: false }))).toEqual(GUIDE_MENU.map((entry) => ({ ...entry, current: false })));
      expect(frame.labels).toBe(GUIDE_MENU_LABELS);
      expect(frame.breadcrumbRoot).toBe("Guide workspace");
      // No page receives a name: the profile chip shows the role, with the person icon.
      expect(frame.profile).toEqual({ name: "", role: "Guide", icon: "guide" });
      expect(frame.spaces).toEqual([]);
      expect(Object.isFrozen(frame) && Object.isFrozen(frame.navigation) && Object.isFrozen(frame.profile), page).toBe(true);
    }
  });

  it("WN11 the Dashboard wording names no one, reuses the menu sentences and links the Waypoint Suggestions page", () => {
    expect(GUIDE_DASHBOARD.title).toBe("Welcome back");
    expect(GUIDE_DASHBOARD.eyebrow).toBe("Guide workspace");
    expect(GUIDE_DASHBOARD.assistant).toMatchObject({
      title: "Guide Assistant",
      badge: "AI",
      body: "Your SolMind Guide Assistant is AI. Start a Guide-private conversation that uses only information in your Guide workspace.",
      action: GUIDE_MENU[2].label,
      explanation: GUIDE_MENU[2].explanation,
    });
    expect(GUIDE_DASHBOARD.explorers.explanation).toBe(GUIDE_MENU[1].explanation);
    expect(GUIDE_DASHBOARD.appointment.explanation).toBe(GUIDE_MENU[3].explanation);
    expect(GUIDE_DASHBOARD.suggestions.href).toBe(GUIDE_WAYPOINT_SUGGESTIONS.href);
    expect(JSON.stringify(GUIDE_DASHBOARD)).not.toMatch(/Steve|Mary|Avery|Jordan|Guide Assistant dashboard|\d/);
    expect(Object.isFrozen(GUIDE_DASHBOARD) && Object.isFrozen(GUIDE_DASHBOARD.assistant)).toBe(true);
    for (const file of [GUIDE_FRAME_FILE, DASHBOARD_FILE]) {
      const source = read(file);
      expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(source), file).toBe(true);
      expect(source.split("\n").length, file).toBeLessThanOrEqual(300);
      expect(/from ["']react|["']use client["']|\bfetch\s*\(|process\.env|"\/guide\//.test(source), file).toBe(false);
    }
  });
});
