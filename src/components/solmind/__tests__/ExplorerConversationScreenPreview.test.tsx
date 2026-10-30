import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ExplorerConversationPreviewPage, { metadata } from "../../../app/explorer/conversation-preview/page";
import {
  CONVERSATION_FOOTER,
  LAYOUT_ONLY_LABEL,
  NOT_YET_IMPLEMENTED,
  NOT_YET_IMPLEMENTED_PREFIX,
  PREVIEW_BAND_TEXT,
  PREVIEW_PAGE_TITLE,
  SAMPLE_TAG_LABEL,
  aiDisclosure, guideNotes, notYetImplementedNotes, type GuideNoteKey,
} from "../../../lib/solmind/explorerConversationScreen";
import { SAMPLE_CONVERSATION_SCREEN } from "../../../lib/solmind/explorerConversationScreenSample";
import { SPEAKER_LABEL_STYLE, type SpeakerLabelStyle } from "../../../lib/solmind/explorerSpeakerStyle";
import { ConversationHeader, VirtualGuideRow } from "../ExplorerConversationScreenHeader";
import { ExplorerConversationScreenShell } from "../ExplorerConversationScreenShell";
import { SupportPanel } from "../ExplorerConversationScreenSupportPanel";
import { ConversationTranscript } from "../ExplorerConversationScreenTranscript";
import { ExplorerConversationScreenPreview } from "../ExplorerConversationScreenPreview";

const appRoot = path.resolve(__dirname, "..", "..", "..", "..");
const PREVIEW_FILE = "src/components/solmind/ExplorerConversationScreenPreview.tsx";
const WORDING_FILE = "src/lib/solmind/explorerConversationScreen.ts";
// Every ExplorerConversationScreen part except the composition boundary, found on disk so new parts are scanned too.
const PRESENTATION_FILES = readdirSync(path.join(appRoot, "src/components/solmind"))
  .filter((name) => /^ExplorerConversationScreen\w+\.tsx$/.test(name) && name !== "ExplorerConversationScreenPreview.tsx")
  .sort().map((name) => `src/components/solmind/${name}`);
const NEW_SOURCE_FILES = [
  "src/app/explorer/conversation-preview/page.tsx",
  PREVIEW_FILE,
  ...PRESENTATION_FILES,
  "src/lib/solmind/explorerConversationScreen.ts",
  "src/lib/solmind/explorerConversationScreenDisplay.ts",
  "src/lib/solmind/explorerConversationScreenSample.ts",
  "src/lib/solmind/explorerSpeakerStyle.ts",
  "src/components/solmind/ExplorerSpeakerIcon.tsx",
];
const ALL_NOTES = Object.values(notYetImplementedNotes(SAMPLE_CONVERSATION_SCREEN.support.guideName));

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
}

function unescapeHtml(text: string): string {
  return text.replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return match ? match[1] : null;
}

// Every control element the page renders: buttons, summaries and form fields.
function controlTags(html: string): string[] {
  return [...html.matchAll(/<(?:button|summary|textarea|input|select)\b[^>]*>/g)].map((match) => match[0]);
}

function openingTags(html: string, marker: string): string[] {
  return controlTags(html).filter((tag) => tag.includes(marker));
}

function noteTextById(html: string, id: string): string | null {
  const match = new RegExp(`<p[^>]*\\sid="${id}"[^>]*>([\\s\\S]*?)</p>`).exec(html);
  return match ? unescapeHtml(match[1].replace(/<[^>]+>/g, "")) : null;
}

// Wording declarations built from a SAMPLE_* value, directly or through another
// wording declaration. SAMPLE_TAG_LABEL is the fixed "Sample" tag, not content.
function sampleDerivedNames(source: string): string[] {
  const isSample = (name: string) => name.startsWith("SAMPLE_") && name !== "SAMPLE_TAG_LABEL";
  const code = source.replace(/^\s*\/\/.*$/gm, "");
  const bodies = new Map<string, string>();
  for (const chunk of code.split(/^(?=(?:export\s+)?(?:const|function|type|import)\b)/m)) {
    const name = /^(?:export\s+)?(?:const|function)\s+(\w+)/.exec(chunk)?.[1];
    if (name && !isSample(name)) bodies.set(name, chunk.slice(chunk.indexOf(name) + name.length));
  }
  const derived = new Set<string>();
  for (let grew = true; grew; ) {
    grew = false;
    for (const [name, body] of bodies) {
      if (derived.has(name) || !(body.match(/\w+/g) ?? []).some((ref) => isSample(ref) || derived.has(ref))) continue;
      derived.add(name);
      grew = true;
    }
  }
  return [...derived].sort();
}

// Value (not type-only) names a file imports from the wording module.
function wordingValueImports(source: string): string[] {
  const pattern = /import\s*\{([^}]*)\}\s*from ["'](?:@\/lib\/solmind|\.)\/explorerConversationScreen["']/g;
  return [...source.matchAll(pattern)].flatMap((match) =>
    match[1].split(",").map((entry) => entry.trim()).filter((entry) => entry && !entry.startsWith("type "))
      .map((entry) => entry.split(/\s+as\s+/)[0]));
}

let html = "";

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("unexpected_effect"); });
  html = renderToStaticMarkup(createElement(ExplorerConversationScreenPreview));
});
afterEach(() => { expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(0); vi.restoreAllMocks(); });

describe("interim Explorer conversation screen", () => {
  it("SP01 shows every Not yet implemented sentence at least once", () => {
    for (const sentence of ALL_NOTES) {
      const body = escapeHtml(sentence.slice(NOT_YET_IMPLEMENTED_PREFIX.length));
      expect(html.includes(body), sentence).toBe(true);
    }
  });

  it("SP02 each unwired control is aria-disabled, never disabled, and described by a visible note", () => {
    const controls = openingTags(html, 'data-preview-control="unwired"');
    expect(controls.length).toBe(56);
    for (const tag of controls) {
      expect(attribute(tag, "aria-disabled"), tag).toBe("true");
      expect(/\sdisabled=""/.test(tag), tag).toBe(false);
      const describedBy = attribute(tag, "aria-describedby");
      expect(describedBy, tag).not.toBeNull();
      for (const id of (describedBy ?? "").split(" ")) {
        const text = noteTextById(html, id);
        expect(text, `${tag} -> ${id}`).not.toBeNull();
        expect(text?.startsWith(NOT_YET_IMPLEMENTED_PREFIX), id).toBe(true);
        expect(ALL_NOTES).toContain(text);
      }
    }
    const message = controls.find((tag) => tag.startsWith("<textarea"));
    expect(message).toBeDefined();
    expect(/\sreadOnly=""/.test(message ?? "")).toBe(true);
    expect(noteTextById(html, attribute(message ?? "", "aria-describedby") ?? "")).toBe(NOT_YET_IMPLEMENTED.message);
  });

  it("SP03 layout-only controls work, carry no note and the layout tag is shown", () => {
    const controls = openingTags(html, 'data-preview-control="layout"');
    expect(controls.length).toBe(8);
    for (const tag of controls) {
      expect(attribute(tag, "aria-disabled"), tag).toBeNull();
      const describedBy = attribute(tag, "aria-describedby") ?? "";
      expect(describedBy.includes("nyi-"), tag).toBe(false);
    }
    // Skip button text plus one tag beside each visible group of layout controls.
    expect(html.split(LAYOUT_ONLY_LABEL).length - 1).toBe(6);
  });

  it("SP04 shows the preview band, AI disclosure, footer and Sample tags", () => {
    expect(html.includes(escapeHtml(PREVIEW_BAND_TEXT))).toBe(true);
    expect(html.includes(aiDisclosure(SAMPLE_CONVERSATION_SCREEN.header.virtualGuideName))).toBe(true);
    expect(html).toContain("Mary is an AI companion, not your Guide, a therapist or a crisis service.");
    expect(html.includes(CONVERSATION_FOOTER)).toBe(true);
    expect(html.split(`data-preview-tag="sample">${SAMPLE_TAG_LABEL}<`).length - 1).toBeGreaterThanOrEqual(8);
    expect(html.includes("Not connected yet")).toBe(false);
    expect(/prototype/i.test(html)).toBe(false);
  });

  it("SP05 has unique ids, no links, no form action and no disabled controls", () => {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(/<a\b/.test(html)).toBe(false);
    expect(/<form\b[^>]*\saction=/.test(html)).toBe(false);
    expect(/<(?:button|input|textarea|select)\b[^>]*\sdisabled=""/.test(html)).toBe(false);
  });

  it("SP06 the route is thin with honest metadata and renders the preview", () => {
    expect(metadata.title).toBe(PREVIEW_PAGE_TITLE);
    expect(String(metadata.description)).toContain("Nothing is connected");
    const page = renderToStaticMarkup(createElement(ExplorerConversationPreviewPage));
    expect(page).toBe(html);
    const source = readFileSync(path.join(appRoot, "src/app/explorer/conversation-preview/page.tsx"), "utf8");
    expect(/headers\(|cookies\(|export const dynamic/.test(source)).toBe(false);
  });

  it("SP07 new source files stay small, ASCII-only and free of connections", () => {
    const forbidden: RegExp[] = [
      /\bfetch\s*\(/, /supabase/i, /\bcookies\b/, /next\/headers/, /process\.env/, /["']use server["']/,
      /localStorage/, /sessionStorage/, /indexedDB/i, /\bsetTimeout\b/, /\bsetInterval\b/, /requestAnimationFrame/,
      /useRouter|useSearchParams|usePathname|next\/navigation/, /\blocation\.(hash|href|assign|replace|search)/,
      /\bhistory\.(push|replace|back|go|state)/, /WebSocket|EventSource|sendBeacon|XMLHttpRequest/,
      /\saction=\{/, /@\/lib\/solmind\/auth/, /virtual-guide\//, /matchMedia/, /\bstyle=\{/,
    ];
    const allowedImports = new Set([
      "react", "next", "next/image", "@/lib/solmind/terms", "@/lib/solmind/explorerCompassComparison",
      "@/lib/solmind/explorerConversationScreen", "@/lib/solmind/explorerConversationScreenDisplay",
      "@/lib/solmind/explorerConversationScreenSample", "@/lib/solmind/explorerSpeakerStyle",
      "./terms", "./explorerConversationScreen", "./explorerConversationScreenDisplay",
      "@/components/solmind/ExplorerConversationScreenPreview", "./ExplorerSpeakerIcon",
    ]);
    for (const file of NEW_SOURCE_FILES) {
      const source = readFileSync(path.join(appRoot, file), "utf8");
      expect(source.split("\n").length, file).toBeLessThanOrEqual(301);
      expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(source), file).toBe(true);
      for (const pattern of forbidden) {
        expect(pattern.test(source), `${pattern} in ${file}`).toBe(false);
      }
      for (const match of source.matchAll(/from ["']([^"']+)["']/g)) {
        const specifier = match[1];
        const local = specifier.startsWith("./ExplorerConversationScreen");
        expect(local || allowedImports.has(specifier), `${specifier} in ${file}`).toBe(true);
      }
      const s01r2 = /import\s*\{([^}]*)\}\s*from "@\/lib\/solmind\/explorerCompassComparison"/.exec(source);
      if (s01r2) expect(s01r2[1].trim()).toBe("SOLMIND_LOGO_SRC");
    }
    const clientFiles = NEW_SOURCE_FILES.filter((file) => readFileSync(path.join(appRoot, file), "utf8").startsWith('"use client"'));
    expect(clientFiles).toEqual([PREVIEW_FILE]);
  });

  it("SP08 every control on the page is classified as unwired or layout only", () => {
    const controls = controlTags(html);
    expect(controls.length).toBe(56 + 8);
    for (const tag of controls) {
      expect(["unwired", "layout"], tag).toContain(attribute(tag, "data-preview-control"));
    }
  });

  it("SP09 only the composition boundary imports the sample; the parts take read-only props", () => {
    const sampleImport = /from ["'](?:@\/lib\/solmind|\.)\/explorerConversationScreenSample["']/;
    expect(sampleImport.test(readFileSync(path.join(appRoot, PREVIEW_FILE), "utf8"))).toBe(true);
    for (const file of PRESENTATION_FILES) {
      const source = readFileSync(path.join(appRoot, file), "utf8");
      expect(sampleImport.test(source), file).toBe(false);
      // No sample singleton (such as SAMPLE_GUIDE_NAME) is read directly either.
      expect(/\bSAMPLE_(?!TAG_LABEL\b)\w+/.test(source), file).toBe(false);
    }
    const dataProps = /import type \{[^}]*\} from "@\/lib\/solmind\/explorerConversationScreenDisplay"/;
    expect(dataProps.test(readFileSync(path.join(appRoot, "src/components/solmind/ExplorerConversationScreenTranscript.tsx"), "utf8"))).toBe(true);
    // The wording module never imports the sample, and no part renders wording built from a
    // SAMPLE_* value. The detector catches the earlier AI_DISCLOSURE constant and anything on it.
    const wordingSource = readFileSync(path.join(appRoot, WORDING_FILE), "utf8");
    expect(sampleImport.test(wordingSource)).toBe(false);
    expect(sampleDerivedNames("export const A = `${SAMPLE_VIRTUAL_GUIDE_NAME} is an AI`;\nconst B = note(A);\n")).toEqual(["A", "B"]);
    const derived = sampleDerivedNames(wordingSource);
    expect(derived).not.toContain("aiDisclosure");
    const rendered = PRESENTATION_FILES.flatMap((file) =>
      wordingValueImports(readFileSync(path.join(appRoot, file), "utf8"))
        .filter((name) => derived.includes(name))
        .map((name) => `${name} in ${file}`));
    expect(rendered).toEqual([]);
    // No fixed note names a sample person; the five naming the Guide follow the name each part is passed.
    const { shell, header, support } = SAMPLE_CONVERSATION_SCREEN;
    const names = [support.guideName, header.virtualGuideName, shell.profile.name];
    expect(Object.values(NOT_YET_IMPLEMENTED).filter((text) => names.some((name) => text.includes(name)))).toEqual([]);
    const nivan = renderToStaticMarkup(createElement("div", null,
      <ExplorerConversationScreenShell drawer={null} onSkip={() => {}} onToggleSpaces={() => {}} shell={{ ...shell, guideName: "Nivan" }} spacesOpen>{null}</ExplorerConversationScreenShell>,
      createElement(ConversationHeader, { header: { ...header, guideName: "Nivan" } }),
      <SupportPanel compassView="full" onQuotesToggle={() => {}} onToggleCompassView={() => {}} quotesOpen={false} support={{ ...support, guideName: "Nivan" }} visible />));
    const notes = [...nivan.matchAll(/<p[^>]*data-preview-note="(\w+)"[^>]*>([\s\S]*?)<\/p>/g)].filter(([, key]) => key in guideNotes("Nivan"));
    expect(notes.map(([, key]) => key).sort()).toEqual(["guideInput", "guideSpace", "guideSpace", "guideSpace", "shareConversation", "shareForming", "shareReason"]);
    for (const [, key, body] of notes) expect(unescapeHtml(body.replace(/<[^>]+>/g, "")), key).toBe(guideNotes("Nivan")[key as GuideNoteKey]);
    expect(notes.every(([, , body]) => body.includes("Nivan") && !body.includes("Jordan"))).toBe(true);
    const display = readFileSync(path.join(appRoot, "src/lib/solmind/explorerConversationScreenDisplay.ts"), "utf8");
    expect(/\bSAMPLE_|^import (?!type\b)|^export (?!type\b)/m.test(display)).toBe(false);
    // The disclosure follows the Virtual Guide name it is passed.
    const row = renderToStaticMarkup(createElement(VirtualGuideRow, {
      drawerId: "d", drawerOpen: false, onOpenDrawer: () => {}, onTogglePanel: () => {}, panelId: "p",
      panelVisible: true, speakerStyle: SPEAKER_LABEL_STYLE, virtualGuideName: "Nivan",
      virtualGuidePrimaryLabel: "Nivan (SolMind Virtual Guide)",
    }));
    expect(row).toContain(aiDisclosure("Nivan"));
    expect(row).not.toContain("Mary");
  });

  it("SP10 speaker labels start from the constant and the transcript renders both styles", () => {
    const logoDefault = SPEAKER_LABEL_STYLE === "logo";
    expect(html.includes('data-speaker-icon="virtualGuide"')).toBe(logoDefault);
    expect(/aria-pressed="true"[^>]*>New</.test(html)).toBe(logoDefault);
    expect(/aria-pressed="true"[^>]*>Original</.test(html)).toBe(!logoDefault);
    expect(html.includes('p-3 @container"><p') && html.includes('aria-label="Where to go next" class="grid gap-2 @sm:grid-cols-2"')).toBe(true);
    const render = (speakerStyle: SpeakerLabelStyle) =>
      renderToStaticMarkup(createElement(ConversationTranscript, { speakerStyle, transcript: SAMPLE_CONVERSATION_SCREEN.transcript }));
    const logo = render("logo");
    expect(logo).toContain('class="flex items-center gap-2 text-xs font-semibold text-[#F57602]" id="conversation-preview-turn-1-speaker"');
    expect(logo).toContain('class="flex items-center gap-2 text-xs font-semibold text-[#8BC6EE]" id="conversation-preview-turn-2-speaker"');
    expect(logo.split('data-speaker-icon="virtualGuide"').length - 1).toBe(3);
    expect(logo.split('data-speaker-icon="explorer"').length - 1).toBe(3);
    const original = render("original");
    expect(original).not.toContain("data-speaker-icon");
    expect(original.split('class="flex items-center gap-2 text-xs font-semibold text-amber-200"').length - 1).toBe(6);
  });

  it("SP11 the Waypoint card is contiguous and future actions sit below it", () => {
    const card = /<div class="[^"]*" data-waypoint-card="">([\s\S]*?)<\/section>/.exec(html)?.[1] ?? "";
    expect(card).toContain("Name what I need before talking");
    expect(card).toContain("Private. Not shared with Jordan.");
    expect(card).toContain("Before the difficult conversation, so I can explain myself without rushing.");
    expect(card).toContain("I can say the one need I most want understood.");
    expect(card).toContain("2 supporting quotes");
    for (const future of ["Confirm Reached", "Release", "Revisit", "Stop sharing", "my Priority"]) {
      expect(card.includes(future), future).toBe(false);
    }
    const waypointAt = html.indexOf('id="panel-waypoint-title"');
    const futureAt = html.indexOf('id="panel-future-actions-title"');
    expect(waypointAt).toBeGreaterThan(0);
    expect(futureAt).toBeGreaterThan(waypointAt);
    expect(html.indexOf("Confirm Reached", waypointAt)).toBeGreaterThan(futureAt);
  });
});
