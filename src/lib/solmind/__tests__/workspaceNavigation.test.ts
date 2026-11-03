import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { NOT_YET_IMPLEMENTED, NOT_YET_IMPLEMENTED_PREFIX, UNNAMED_GUIDE, guideNotes } from "../explorerConversationScreen";
import { EXPLORER_HOME_ROUTE } from "../routeAccess";
import { EXPLORER_CONVERSATION_SPACES, EXPLORER_MENU } from "../workspaceMenus";
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
    expect(EXPLORER_MENU_LABELS).toEqual({ rail: "Explorer workspace", phone: "Explorer workspace menu", heading: "Workspace" });
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
    expect(importSpecifiers(MENUS)).toEqual(["./routeAccess", "./explorerConversationScreen", "./workspaceNavigation"]);
    // Any specifier ending in workspaceMenus (alias, ./, ../ or with .ts), static or dynamic.
    const importers = sourceFiles("src").filter((file) => /(?:from|import\()\s*["'][^"']*\/workspaceMenus(?:\.ts)?["']/.test(read(file)));
    expect(importers).toEqual(["src/lib/solmind/explorerConversationConnectedScreen.ts"]);
    // No conversation-screen part imports the menu data.
    const parts = readdirSync(path.join(appRoot, "src/components/solmind"))
      .filter((name) => /^ExplorerConversationScreen\w+\.tsx$/.test(name))
      .map((name) => read(`src/components/solmind/${name}`));
    expect(parts.length).toBeGreaterThan(0);
    for (const source of parts) expect(source).not.toMatch(/workspaceMenus|routeAccess/);
  });
});
