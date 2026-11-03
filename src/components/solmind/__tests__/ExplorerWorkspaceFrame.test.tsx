import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EXPLORER_WORKSPACE_FRAMES, type ExplorerWorkspacePage } from "../../../lib/solmind/explorerWorkspaceFrame";
import { WORKSPACE_NOT_CONNECTED_LABEL } from "../../../lib/solmind/workspaceNavigation";
import { ExplorerConversationReview } from "../ExplorerConversationReview";
import { MENU_BUTTON_ID, MENU_PANEL_ID } from "../ExplorerConversationScreenNavigation";
import { ExplorerWorkspaceFrame } from "../ExplorerWorkspaceFrame";
import { WORKSPACE_MAIN_ID, WorkspaceFrame } from "../WorkspaceFrame";

// The Explorer workspace frame on the signed-in Explorer pages other than the conversation screen (Paul's
// 2026-11-02 decisions, decision queue 14:07:48 and 22:19:17 CST). /explorer/home is guarded on the server and
// cannot be opened in a browser test without a sign-in, so the frame's markup is proved here.

const appRoot = path.resolve(__dirname, "..", "..", "..", "..");
const FRAME_FILES = ["src/components/solmind/WorkspaceFrame.tsx", "src/components/solmind/ExplorerWorkspaceFrame.tsx"];
const CURRENT = "border-amber-300/25 bg-amber-300/10 font-semibold text-amber-200";
const BODY = '<p id="page-body">Page body</p>';

function frame(page: ExplorerWorkspacePage, linksDisabled = false): string {
  return renderToStaticMarkup(
    <ExplorerWorkspaceFrame linksDisabled={linksDisabled} page={page}>
      <p id="page-body">Page body</p>
    </ExplorerWorkspaceFrame>,
  );
}

// The rail's menu (the phone panel's list renders only while it is open).
function rail(html: string): string {
  const match = /<nav (?:aria-busy="true" )?aria-label="Explorer workspace" class="px-3">([\s\S]*?)<\/nav>/.exec(html);
  if (match === null) throw new Error("rail menu missing");
  return match[1];
}

function entry(html: string, label: string): string {
  const match = new RegExp(`<(a|span|button) [^>]*>(?:(?!</?(?:a|button)\\b)[\\s\\S])*?<span>${label}</span>`).exec(rail(html));
  if (match === null) throw new Error(`entry missing: ${label}`);
  return match[0];
}

beforeEach(() => { vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected_effect")); });
afterEach(() => { expect(globalThis.fetch).not.toHaveBeenCalled(); vi.restoreAllMocks(); });

describe("Explorer workspace frame", () => {
  it("WF01 draws the rail menu with each page's section current and a plain breadcrumb", () => {
    const pages: [ExplorerWorkspacePage, string, "page" | "section"][] = [
      ["overview", "Overview", "page"],
      ["conversations", "Conversations", "page"],
      ["waypoints", "Waypoints", "page"],
      ["waypointDetail", "Waypoints", "section"],
    ];
    for (const [page, label, kind] of pages) {
      const html = frame(page);
      const current = entry(html, label);
      expect(current, page).toContain(CURRENT);
      if (kind === "page") {
        expect(current, page).toMatch(/^<a aria-current="page" /);
      } else {
        expect(current, page).toMatch(/^<a class=/);
        expect(rail(html), page).toContain('<span class="sr-only">(current section)</span>');
      }
      for (const other of ["Overview", "Conversations", "Waypoints"].filter((name) => name !== label)) {
        expect(entry(html, other), `${page} ${other}`).not.toContain(CURRENT);
        expect(entry(html, other), `${page} ${other}`).not.toContain("aria-current");
      }
      expect(html, page).toContain(
        `<p class="hidden text-sm text-stone-400 lg:block">Explorer workspace <span aria-hidden="true">/</span> <span class="text-stone-200">${label}</span></p>`,
      );
      expect(html.match(/<main /g), page).toHaveLength(1);
      expect(html, page).toContain(`<main class="flex min-w-0 flex-1 flex-col focus:outline-none" id="${WORKSPACE_MAIN_ID}" tabindex="-1">${BODY}</main>`);
    }
  });

  it("WF02 has the September 23 Menu button and a closed phone panel", () => {
    const html = frame("waypoints");
    const button = new RegExp(`<button aria-controls="${MENU_PANEL_ID}" aria-expanded="false" class="([^"]*)" id="${MENU_BUTTON_ID}" type="button">`).exec(html);
    expect(button).not.toBeNull();
    expect(button?.[1]).toContain("lg:hidden");
    expect(html).toContain(`<div class="border-b border-amber-200/10 bg-black/90 px-3 py-3 lg:hidden" hidden="" id="${MENU_PANEL_ID}"></div>`);
    // The Menu button comes first in the top bar, before the small phone logo.
    expect(html.indexOf(`id="${MENU_BUTTON_ID}"`)).toBeLessThan(html.indexOf('class="h-auto w-20 lg:hidden"'));
    expect(html).toContain('<nav aria-label="Explorer workspace" class="px-3">');
    expect(html).not.toContain('aria-label="Explorer workspace menu"');
  });

  it("WF03 shows the conversation spaces only under Conversations, with none current", () => {
    const html = frame("conversations");
    expect(rail(html)).toContain('<ul aria-label="Conversation spaces"');
    expect(rail(html)).toContain('href="/explorer/conversation"');
    expect((rail(html).match(/aria-current="page"/g) ?? []).length).toBe(1);
    expect(rail(html)).not.toContain("bg-amber-300/10 text-amber-100");
    for (const page of ["overview", "waypoints", "waypointDetail"] as const) {
      expect(frame(page), page).not.toContain("Conversation spaces");
    }
  });

  it("WF04 marks what is not connected yet with the grey line and a hidden sentence, never a blue note", () => {
    for (const page of ["overview", "conversations", "waypoints", "waypointDetail"] as const) {
      const html = frame(page);
      expect(/data-preview-|sky-|border-dashed|Not yet implemented|aria-disabled/.test(html), page).toBe(false);
      const buttons = [...html.matchAll(/<button aria-controls="([^"]+)" aria-expanded="false"([^>]*)>([\s\S]*?)<\/button>/g)]
        .filter(([, id]) => id !== MENU_PANEL_ID);
      // Settings, the bell and the profile (and on the list, With your Guide and Start a new conversation).
      expect(buttons.length, page).toBe(page === "conversations" ? 5 : 3);
      for (const [, id, attributes, inner] of buttons) {
        expect(new RegExp(`<p class="[^"]*" hidden="" id="${id}">[^<]+</p>`).test(html), `${page} ${id}`).toBe(true);
        const named = inner.includes(WORKSPACE_NOT_CONNECTED_LABEL) || attributes.includes(`(${WORKSPACE_NOT_CONNECTED_LABEL.toLowerCase()})`);
        expect(named, `${page} ${id}`).toBe(true);
      }
      // The bell shows the grey line beside its icon, named "Notifications Not connected yet" like the menu entries.
      const bell = /<button aria-controls="nyi-top-notifications" aria-expanded="false" class="[^"]*"[^>]*>([\s\S]*?)<\/button>/.exec(html);
      expect(bell, page).not.toBeNull();
      expect(bell?.[1], page).toMatch(
        new RegExp(`</svg><span class="sr-only">Notifications </span><span class="[^"]*text-stone-400">${WORKSPACE_NOT_CONNECTED_LABEL}</span>$`),
      );
      expect(html, page).not.toContain(`(${WORKSPACE_NOT_CONNECTED_LABEL.toLowerCase()})`);
      expect(html, page).toContain('Explorer<span class="sr-only"> profile</span>');
      expect(/Mary|Avery|Jordan|Steve/.test(html), page).toBe(false);
      // The pages' browser tests find their status region with getByRole("status") in strict mode, so the
      // frame's own parts outside <main> add none.
      expect(html.includes("role=\"status\"") || html.includes("aria-live"), page).toBe(false);
    }
  });

  it("WF05 shows every menu link in its non-link form while links are disabled", () => {
    const html = frame("overview", true);
    expect(html.includes("<a ")).toBe(false);
    expect(html).toContain('<nav aria-busy="true" aria-label="Explorer workspace" class="px-3">');
    for (const label of ["Overview", "Conversations", "Waypoints"]) {
      expect(entry(html, label), label).toMatch(/^<span aria-disabled="true" class="[^"]*opacity-60">/);
    }
    // Settings stays a button: it only shows its sentence.
    expect(entry(html, "Settings")).toMatch(/^<button aria-controls=/);
  });

  it("WF06 the role-neutral frame takes all its names as data, and the frame files stay small and plain", () => {
    const data = EXPLORER_WORKSPACE_FRAMES.waypoints;
    const frameData = {
      ...data, labels: { rail: "R", phone: "P", heading: "H", spaces: "S" }, breadcrumbRoot: "Root", profile: { name: "", role: "Role" },
    };
    const html = renderToStaticMarkup(<WorkspaceFrame frame={frameData}>{null}</WorkspaceFrame>);
    expect(html).toContain('<nav aria-label="R" class="px-3">');
    expect(html).toContain("Root <span aria-hidden=\"true\">/</span>");
    expect(html).toContain('Role<span class="sr-only"> profile</span>');
    expect(html).not.toContain("Explorer workspace");
    for (const file of FRAME_FILES) {
      const source = readFileSync(path.join(appRoot, file), "utf8");
      expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(source), file).toBe(true);
      expect(source.split("\n").length, file).toBeLessThanOrEqual(300);
      expect(/\bfetch\s*\(|supabase|cookies|process\.env|localStorage|sessionStorage|@\/lib\/solmind\/auth/i.test(source), file).toBe(false);
    }
    // Only the Explorer wrapper picks Explorer data; the frame's code (comments aside) names no role.
    const frameCode = readFileSync(path.join(appRoot, FRAME_FILES[0]), "utf8").replace(/\/\/.*$/gm, "");
    expect(frameCode).not.toMatch(/Explorer(?!ConversationScreen)|EXPLORER_|workspaceMenus|explorerWorkspaceFrame/);
  });

  it("WF07 the conversation list is in the frame with Conversations current and no separate home link", () => {
    const html = renderToStaticMarkup(createElement(ExplorerConversationReview));
    expect(entry(html, "Conversations")).toMatch(/^<a aria-current="page" /);
    expect(html).toContain('href="/explorer/home"');
    expect(/>\s*Explorer home\s*</.test(html)).toBe(false);
    expect(html.match(/<main /g)).toHaveLength(1);
    expect(html).toContain('<h1 id="ended-conversations-heading" tabindex="-1"');
  });
});
