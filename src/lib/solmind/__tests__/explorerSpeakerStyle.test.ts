import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import S01R2Page from "../../../app/explorer/compass-comparison/page";
import { ConversationTurnView } from "../../../components/solmind/ExplorerCompassComparisonParts";
import { SpeakerIcon } from "../../../components/solmind/ExplorerSpeakerIcon";
import { createInitialExplorerConversationState } from "../explorerCompassComparison";
import {
  SPEAKER_LABEL_STYLE,
  SPEAKER_LOGO_COLOURS,
  SPEAKER_LOGO_MIND_ORANGE,
  SPEAKER_LOGO_TEXT_CLASS,
  speakerLabelClass,
  type Speaker,
  type SpeakerLabelStyle,
} from "../explorerSpeakerStyle";

const appRoot = path.resolve(__dirname, "..", "..", "..", "..");
const SPEAKERS: readonly Speaker[] = ["virtualGuide", "explorer"];

function channels(hex: string): number[] {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

// Hue in degrees (0-360) of an #RRGGBB colour.
function hue(hex: string): number {
  const [r, g, b] = channels(hex);
  const max = Math.max(r, g, b);
  const spread = max - Math.min(r, g, b);
  if (spread === 0) return 0;
  const sector = max === r ? ((g - b) / spread + 6) % 6 : max === g ? (b - r) / spread + 2 : (r - g) / spread + 4;
  return sector * 60;
}

function hueDistance(a: string, b: string): number {
  const gap = Math.abs(hue(a) - hue(b));
  return Math.min(gap, 360 - gap);
}

const PAGE = "#0C0A08";
const GUIDE_BUBBLE = "#15110D";
const EXPLORER_BUBBLE = "#22190F";
const AMBER_200 = "#FDE68A";

function icon(speaker: Speaker, size?: "small" | "large"): string {
  return renderToStaticMarkup(createElement(SpeakerIcon, { speaker, ...(size ? { size } : {}) }));
}

function renderTurn(index: number, speakerStyle?: SpeakerLabelStyle): string {
  const turn = createInitialExplorerConversationState().turns[index];
  return renderToStaticMarkup(
    createElement(ConversationTurnView, {
      turn,
      virtualGuideName: "Mary",
      isActive: true,
      inactiveHint: null,
      selectedChoiceId: null,
      highlight: null,
      onSelectChoice: () => undefined,
      onAnswer: () => undefined,
      onReturnToQuotation: () => undefined,
      ...(speakerStyle ? { speakerStyle } : {}),
    }),
  );
}

function speakerParagraph(html: string): string {
  const match = /<p class="flex items-center gap-2 text-xs font-semibold[^"]*" id="[^"]*-speaker">[\s\S]*?<\/p>/.exec(html);
  return match ? match[0] : "";
}

describe("speaker label style switch", () => {
  it("SS01 the switch holds one of exactly two styles (\"logo\" as delivered)", () => {
    expect(["logo", "original"]).toContain(SPEAKER_LABEL_STYLE);
    for (const speaker of SPEAKERS) {
      expect(speakerLabelClass("original", speaker)).toBe("text-amber-200");
      expect(speakerLabelClass("logo", speaker)).toBe(SPEAKER_LOGO_TEXT_CLASS[speaker]);
      expect(SPEAKER_LOGO_TEXT_CLASS[speaker]).toBe(`text-[${SPEAKER_LOGO_COLOURS[speaker]}]`);
    }
    expect(SPEAKER_LOGO_TEXT_CLASS.virtualGuide).toBe("text-[#F57602]");
  });

  it("SS02 the Virtual Guide keeps the measured Mind orange; You is a readable sky blue, its complement", () => {
    const { virtualGuide, explorer } = SPEAKER_LOGO_COLOURS;
    expect(virtualGuide).toBe(SPEAKER_LOGO_MIND_ORANGE);
    expect(SPEAKER_LOGO_MIND_ORANGE).toBe("#F57602");
    expect(/^#[0-9A-F]{6}$/.test(explorer)).toBe(true);
    // Label text reaches 4.5:1 on its bubble; the icons (same colours) reach 3:1 on the page too.
    expect(contrast(virtualGuide, GUIDE_BUBBLE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(explorer, EXPLORER_BUBBLE)).toBeGreaterThanOrEqual(4.5);
    for (const colour of [virtualGuide, explorer]) expect(contrast(colour, PAGE)).toBeGreaterThanOrEqual(3);
    // Sky blue: a blue hue, light, clearly coloured, roughly opposite the orange and far from the gold.
    expect(hue(explorer)).toBeGreaterThanOrEqual(190);
    expect(hue(explorer)).toBeLessThanOrEqual(220);
    expect(luminance(explorer)).toBeGreaterThan(0.35);
    expect(Math.max(...channels(explorer)) - Math.min(...channels(explorer))).toBeGreaterThan(0.25);
    expect(hueDistance(explorer, virtualGuide)).toBeGreaterThanOrEqual(150);
    expect(hueDistance(explorer, AMBER_200)).toBeGreaterThanOrEqual(120);
  });

  it("SS03 each icon is decorative inline SVG with no ids, drawn in its speaker's colour", () => {
    const shapes: string[] = [];
    for (const speaker of SPEAKERS) {
      for (const [size, sizeClass] of [["small", "h-6 w-6"], ["large", "h-9 w-9"]] as const) {
        const html = icon(speaker, size);
        expect(html.startsWith(
          `<svg aria-hidden="true" class="${sizeClass} shrink-0 ${SPEAKER_LOGO_TEXT_CLASS[speaker]}" data-speaker-icon="${speaker}" focusable="false" viewBox="0 0 24 24">`,
        )).toBe(true);
        expect(/\sid=|<defs|<filter|<mask|<clipPath|gradient|<image|<text|<style|\sstyle=|<a\b|href|<title/i.test(html)).toBe(false);
        expect(html).toContain("currentColor");
        expect(html.split("<svg").length - 1).toBe(1);
      }
      expect(icon(speaker)).toBe(icon(speaker, "small"));
      shapes.push(icon(speaker).replace(/^<svg[^>]*>/, ""));
    }
    expect(shapes[0]).not.toBe(shapes[1]);
    // Each speaker gets its own drawing: the eclipse ring for the Virtual Guide, the profile for You.
    expect(icon("virtualGuide")).toContain('r="8" stroke="currentColor" stroke-width="2"');
    expect(icon("virtualGuide")).not.toContain('d="M8 21.8C');
    expect(icon("explorer")).toContain('d="M8 21.8C');
    expect(icon("explorer")).not.toContain("<circle");
    const source = readFileSync(path.join(appRoot, "src/components/solmind/ExplorerSpeakerIcon.tsx"), "utf8");
    expect(source.split("\n").length).toBeLessThanOrEqual(120);
    expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(source)).toBe(true);
    expect(source.startsWith('"use client"')).toBe(false);
    expect([...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1])).toEqual(["@/lib/solmind/explorerSpeakerStyle"]);
  });

  it("SS04 the S01R2 screen follows the constant", () => {
    const html = renderToStaticMarkup(createElement(S01R2Page));
    const logo = SPEAKER_LABEL_STYLE === "logo";
    expect(html.includes('data-speaker-icon="virtualGuide"')).toBe(logo);
    expect(html.includes('data-speaker-icon="explorer"')).toBe(logo);
    expect(html.includes(">VG</span>")).toBe(!logo);
    expect(html).toContain(`class="flex items-center gap-2 text-xs font-semibold ${speakerLabelClass(SPEAKER_LABEL_STYLE, "virtualGuide")}"`);
    expect(html).toContain(`class="flex items-center gap-2 text-xs font-semibold ${speakerLabelClass(SPEAKER_LABEL_STYLE, "explorer")}"`);
    // Accessible names are unchanged: the visible labels still name each speaker.
    expect(html).toContain("Mary (Virtual Guide)</p>");
    expect(html).toContain("You</p>");
  });

  it("SS05 each style renders the exact expected S01R2 speaker markup; original is the earlier one", () => {
    expect(speakerParagraph(renderTurn(0, "original"))).toBe(
      '<p class="flex items-center gap-2 text-xs font-semibold text-amber-200" id="conversation-turn-1-speaker"><span aria-hidden="true" class="grid shrink-0 place-items-center rounded-full border border-amber-300/60 bg-amber-300/10 font-semibold tracking-wide text-amber-100 shadow-[0_0_14px_rgba(245,158,11,0.25)] h-6 w-6 text-[9px]">VG</span>Mary (Virtual Guide)</p>',
    );
    expect(speakerParagraph(renderTurn(1, "original"))).toBe(
      '<p class="flex items-center gap-2 text-xs font-semibold text-amber-200" id="conversation-turn-2-speaker"><span aria-hidden="true" class="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-stone-500 bg-stone-800 font-serif text-[11px] text-stone-100">A</span>You</p>',
    );
    expect(speakerParagraph(renderTurn(0, "logo"))).toBe(
      `<p class="flex items-center gap-2 text-xs font-semibold ${SPEAKER_LOGO_TEXT_CLASS.virtualGuide}" id="conversation-turn-1-speaker">${icon("virtualGuide")}Mary (Virtual Guide)</p>`,
    );
    expect(speakerParagraph(renderTurn(1, "logo"))).toBe(
      `<p class="flex items-center gap-2 text-xs font-semibold ${SPEAKER_LOGO_TEXT_CLASS.explorer}" id="conversation-turn-2-speaker">${icon("explorer")}You</p>`,
    );
    // Without a style prop the turn follows the constant.
    expect(renderTurn(0)).toBe(renderTurn(0, SPEAKER_LABEL_STYLE));
    expect(renderTurn(1)).toBe(renderTurn(1, SPEAKER_LABEL_STYLE));
  });

  it("SS06 the shared module is small, ASCII-only and imports nothing", () => {
    const source = readFileSync(path.join(appRoot, "src/lib/solmind/explorerSpeakerStyle.ts"), "utf8");
    expect(source.split("\n").length).toBeLessThanOrEqual(120);
    expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(source)).toBe(true);
    expect(/^import\s/m.test(source)).toBe(false);
  });
});
