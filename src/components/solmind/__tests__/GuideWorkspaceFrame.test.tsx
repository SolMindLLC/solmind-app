import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GUIDE_MENU } from "../../../lib/solmind/workspaceMenus";
import { WORKSPACE_NOT_CONNECTED_LABEL } from "../../../lib/solmind/workspaceNavigation";
import { MENU_BUTTON_ID, MENU_PANEL_ID } from "../ExplorerConversationScreenNavigation";
import { GuideWaypointSuggestionsPage } from "../GuideWaypointSuggestionsPage";
import { GuideWorkspaceFrame } from "../GuideWorkspaceFrame";
import { WORKSPACE_MAIN_ID } from "../WorkspaceFrame";

// The Guide workspace frame (Paul's 2026-11-02 decisions, decision queue 14:07:48 and 22:19:17 CST): the
// role-neutral WorkspaceFrame.tsx with the August Guide menu, on the Guide Dashboard (GuideHome.test.tsx)
// and the three Guide Waypoint Suggestions pages, which no menu entry stands for.

const appRoot = path.resolve(__dirname, "..", "..", "..", "..");
const read = (file: string) => readFileSync(path.join(appRoot, file), "utf8");
const CURRENT = "border-amber-300/25 bg-amber-300/10 font-semibold text-amber-200";
const NEW_FILES = [
  "src/components/solmind/GuideWorkspaceFrame.tsx",
  "src/components/solmind/GuideDashboardHome.tsx",
  "src/components/solmind/GuideWaypointSuggestionsPage.tsx",
  "src/components/solmind/WorkspaceHomeParts.tsx",
];
const PAGES = {
  entry: "src/app/guide/waypoint-suggestions/page.tsx",
  list: "src/app/guide/waypoint-suggestions/[relationshipId]/page.tsx",
  detail: "src/app/guide/waypoint-suggestions/[relationshipId]/[suggestedWaypointId]/page.tsx",
};

function waypointFrame(): string {
  return renderToStaticMarkup(
    <GuideWorkspaceFrame page="waypointSuggestions">
      <p id="page-body">Page body</p>
    </GuideWorkspaceFrame>,
  );
}

function rail(html: string): string {
  const match = /<nav aria-label="Guide workspace" class="px-3">([\s\S]*?)<\/nav>/.exec(html);
  if (match === null) throw new Error("rail menu missing");
  return match[1];
}

beforeEach(() => { vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected_effect")); });
afterEach(() => { expect(globalThis.fetch).not.toHaveBeenCalled(); vi.restoreAllMocks(); });

describe("Guide workspace frame", () => {
  it("GF01 on the Waypoint Suggestions pages no entry is current and the breadcrumb names the page", () => {
    const html = waypointFrame();
    expect(html).not.toContain("aria-current");
    expect(html).not.toContain("(current section)");
    expect(rail(html)).not.toContain(CURRENT);
    expect(rail(html)).toMatch(/<a class="[^"]*" href="\/guide\/home"><svg[\s\S]*?<\/svg><span class="flex min-w-0 flex-col"><span>Dashboard<\/span><\/span><\/a>/);
    expect(html).toContain(
      '<p class="hidden text-sm text-stone-400 lg:block">Guide workspace <span aria-hidden="true">/</span> <span class="text-stone-200">Waypoint Suggestions</span></p>',
    );
    expect(html.match(/<main /g)).toHaveLength(1);
    expect(html).toContain(`id="${WORKSPACE_MAIN_ID}" tabindex="-1"><p id="page-body">Page body</p></main>`);
    // The pages' browser tests find their status region with getByRole("status") in strict mode, so the
    // frame's own parts outside <main> add none.
    expect(html.includes('role="status"') || html.includes("aria-live")).toBe(false);
    expect(/Steve|Mary|Avery|Jordan|Explorer workspace/.test(html)).toBe(false);
  });

  it("GF02 has the Menu button and a closed phone panel named for the Guide", () => {
    const html = waypointFrame();
    expect(html).toMatch(new RegExp(`<button aria-controls="${MENU_PANEL_ID}" aria-expanded="false" class="[^"]*lg:hidden[^"]*" id="${MENU_BUTTON_ID}" type="button">`));
    expect(html).toContain(`hidden="" id="${MENU_PANEL_ID}"></div>`);
    expect(html).not.toContain('aria-label="Guide workspace menu"');
    expect(html).toContain('Guide<span class="sr-only"> profile</span>');
  });

  it("GF03 marks the four Guide entries not connected yet, and the bell and profile, with a hidden sentence", () => {
    const html = waypointFrame();
    expect(/data-preview-|sky-|border-dashed|Not yet implemented|aria-disabled/.test(html)).toBe(false);
    const buttons = [...html.matchAll(/<button aria-controls="([^"]+)" aria-expanded="false"([^>]*)>([\s\S]*?)<\/button>/g)]
      .filter(([, id]) => id !== MENU_PANEL_ID);
    expect(buttons).toHaveLength(4 + 2);
    for (const [, id, attributes, inner] of buttons) {
      expect(new RegExp(`<p class="[^"]*" hidden="" id="${id}">[^<]+</p>`).test(html), id).toBe(true);
      const named = inner.includes(WORKSPACE_NOT_CONNECTED_LABEL) || attributes.includes(`(${WORKSPACE_NOT_CONNECTED_LABEL.toLowerCase()})`);
      expect(named, id).toBe(true);
    }
    for (const entry of GUIDE_MENU.slice(1)) {
      expect(html, entry.id).toContain(`hidden="" id="not-connected-rail-${entry.id}">${(entry.explanation ?? "").replaceAll("'", "&#x27;")}</p>`);
    }
    // The bell shows the blue build-note label beside its icon, as on the Explorer pages.
    const bell = buttons.find(([, id]) => id === "nyi-top-notifications");
    expect(bell).toBeDefined();
    expect(bell?.[2]).not.toContain("aria-label");
    // No control on a signed-in Guide page uses the hidden-label form.
    expect(html).not.toContain(`(${WORKSPACE_NOT_CONNECTED_LABEL.toLowerCase()})`);
    expect(bell?.[3]).toMatch(new RegExp(`</svg><span class="sr-only">Notifications </span><span class="[^"]*text-\\[#4A86FF\\]" data-build-note="label">${WORKSPACE_NOT_CONNECTED_LABEL}</span>$`));
    // Paul's build-note rule (decision queue 2026-11-03 17:59:20 and 18:00:59 CST): each label is a blue build
    // note, and the top bar has the one "Build notes" toggle.
    expect(html.split('data-build-note="label"').length - 1).toBe(buttons.length);
    expect(html.match(/<button aria-pressed="true" class="[^"]*" data-build-note="toggle" id="build-notes-toggle" type="button">/g)).toHaveLength(1);
  });

  it("GF04 the Waypoint Suggestions page sits in the frame with its back link, panel and content", () => {
    const html = renderToStaticMarkup(
      <GuideWaypointSuggestionsPage backHref="/guide/home" backLabel="Back to Guide dashboard" heading="Suggested Waypoints" intro="Intro text.">
        <p id="page-content">Content</p>
      </GuideWaypointSuggestionsPage>,
    );
    expect(html).toMatch(/<a class="[^"]*border-amber-200\/25[^"]*" href="\/guide\/home">Back to Guide dashboard<\/a>/);
    expect(html).toContain(">Guide workspace</p>");
    expect(html).toMatch(/<h1 class="[^"]*">Suggested Waypoints<\/h1>/);
    expect(html).toContain(">Intro text.</p><p id=\"page-content\">Content</p>");
    expect(html.match(/<main /g)).toHaveLength(1);
    expect(html.match(/<h1 /g)).toHaveLength(1);
  });

  it("GF05 the Guide Waypoint pages keep their routes, checks, back targets and texts; only the dashboard target moved", () => {
    const entry = read(PAGES.entry);
    expect(entry).toContain("backHref={GUIDE_HOME_ROUTE}");
    expect(entry).toContain('backLabel="Back to Guide dashboard"');
    expect(entry).not.toMatch(/href="\/guide"/);
    expect(entry).toContain("<GuideSuggestedWaypointRelationshipEntry />");
    const list = read(PAGES.list);
    expect(list).toContain("backHref={`/guide/waypoint-suggestions?focus=${encodeURIComponent(relationshipId)}`}");
    expect(list).toContain('backLabel="Back to Explorer relationships"');
    expect(list).toContain("if (!isSuggestedWaypointRelationshipId(relationshipId)) {");
    const detail = read(PAGES.detail);
    expect(detail).toContain("backHref={`/guide/waypoint-suggestions/${relationshipId}?focus=${encodeURIComponent(suggestedWaypointId)}`}");
    expect(detail).toContain('backLabel="Back to Waypoint Suggestions"');
    expect(detail).toContain("!isSuggestedWaypointId(suggestedWaypointId)");
    // Each page's heading and intro, exactly as at 5bdc16f (the JSX text there wrapped over several lines,
    // which renders as these single-spaced strings).
    const texts: [string, string, string][] = [
      [entry, "Suggested Waypoints", "Choose an Explorer with an active Guide relationship. This page only opens the relationship workspace; it does not create, send, schedule, withdraw, or deliver a suggestion."],
      [list, "Suggested Waypoints", "Review Guide-only drafts, pending sends, and suggestions already sent through this active Explorer relationship. Explorer-private activity and Waypoints never appear here."],
      [detail, "Suggestion detail", "Review the exact current Guide-visible content and lifecycle state. This page does not expose Explorer-private activity. A complete Guide-only draft can be edited, saved, reviewed, and scheduled; a pending suggestion can be pulled back during its available window. Blank-draft compose, delete, correction, and withdrawal remain separately gated."],
    ];
    for (const [source, heading, intro] of texts) {
      expect(source, heading).toContain(`heading="${heading}"`);
      expect(source, heading).toContain(`intro="${intro}"`);
      expect(source.match(/\bheading="/g), heading).toHaveLength(1);
      expect(source.match(/\bintro="/g), heading).toHaveLength(1);
    }
    for (const file of Object.values(PAGES)) {
      const source = read(file);
      expect(source, file).toContain("<GuideWaypointSuggestionsPage");
      expect(source, file).not.toMatch(/PageShell|BackLink|SectionLabel|<main/);
      expect(source.split("\n").length, file).toBeLessThanOrEqual(60);
    }
  });

  it("GF06 the new Guide presentation files stay small, plain and free of connections", () => {
    for (const file of NEW_FILES) {
      const source = read(file);
      expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(source), file).toBe(true);
      expect(source.split("\n").length, file).toBeLessThanOrEqual(300);
      expect(/\bfetch\s*\(|supabase|cookies|process\.env|localStorage|sessionStorage|@\/lib\/solmind\/auth|Steve/i.test(source), file).toBe(false);
    }
    // The Waypoint page wrapper renders inside Server Component pages, so it must not import the client-only
    // not-connected module (it uses createContext; the production build refuses it there). The guard matches
    // any import specifier whose last part starts with ExplorerConversationScreen, by any path and in either
    // quote style (static, re-export, side-effect or dynamic import).
    const clientModuleImport = /(?:\bfrom|\bimport)\s*\(?\s*["'](?:[^"'\n]*\/)?ExplorerConversationScreen[^"'\n/]*["']/;
    for (const sample of [
      'import { X } from "./ExplorerConversationScreenNotYetImplemented";',
      "import { X } from '@/components/solmind/ExplorerConversationScreenNotYetImplemented';",
      'export { X } from "../solmind/ExplorerConversationScreenIcons";',
      "import './ExplorerConversationScreenShell';",
      'const parts = import("./ExplorerConversationScreenNavigation");',
    ]) {
      expect(sample, sample).toMatch(clientModuleImport);
    }
    expect('import { GuideWorkspaceFrame } from "./GuideWorkspaceFrame";').not.toMatch(clientModuleImport);
    const wrapper = read("src/components/solmind/GuideWaypointSuggestionsPage.tsx");
    expect(wrapper).not.toMatch(clientModuleImport);
    expect(wrapper).not.toMatch(/use client/);
    // The shared frame (comments aside) still names no role: the Guide data comes in as props.
    const frameCode = read("src/components/solmind/WorkspaceFrame.tsx").replace(/\/\/.*$/gm, "");
    expect(frameCode).not.toMatch(/Guide|GUIDE_|guideWorkspaceFrame/);
  });

  // "Back to Guide dashboard" goes into the server-guarded /guide/home, so it is a full-document link: a
  // client-side move could restore the Dashboard from the router cache with no server check after a sign-out
  // (browser Back then Forward). Static markup draws next/link and a plain <a> alike, so the source is checked
  // here; tests/browser/suggestedWaypointGuideRelationshipEntry.pw.ts checks that the click loads a new document.
  it("GF07 only the entry page's back link to the Dashboard is a full-document link", () => {
    expect(read(PAGES.entry)).toMatch(/<GuideWaypointSuggestionsPage\s+backFullDocument\s+backHref=\{GUIDE_HOME_ROUTE\}/);
    expect(read(PAGES.list)).not.toContain("backFullDocument");
    expect(read(PAGES.detail)).not.toContain("backFullDocument");
    const component = read("src/components/solmind/GuideWaypointSuggestionsPage.tsx");
    expect(component).toMatch(/\{backFullDocument \? \([\s\S]*?<a className=\{BACK_LINK\} href=\{backHref\}>\s*\{backLabel\}\s*<\/a>\s*\) : \(\s*<Link className=\{BACK_LINK\} href=\{backHref\}>\s*\{backLabel\}\s*<\/Link>\s*\)\}/);
    expect(component).toContain('import Link from "next/link";');
    expect(component).toContain("backFullDocument = false");
  });
});
