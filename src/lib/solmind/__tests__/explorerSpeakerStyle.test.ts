import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import S01R2Page from "../../../app/explorer/compass-comparison/page";
import { ConversationTurnView } from "../../../components/solmind/ExplorerCompassComparisonParts";
import { createInitialExplorerConversationState, SOLMIND_LOGO_SRC } from "../explorerCompassComparison";
import {
  SPEAKER_LABEL_STYLE,
  SPEAKER_LOGO_COLOURS,
  SPEAKER_LOGO_ICON_CLASS,
  SPEAKER_LOGO_MEASUREMENTS,
  speakerLabelClass,
  type SpeakerLabelStyle,
} from "../explorerSpeakerStyle";

const appRoot = path.resolve(__dirname, "..", "..", "..", "..");

function channel(hex: string, start: number): number {
  const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const GUIDE_BUBBLE = "#15110D";
const EXPLORER_BUBBLE = "#22190F";
const AMBER_200 = "#FDE68A";

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
    expect(speakerLabelClass("original", "virtualGuide")).toBe("text-amber-200");
    expect(speakerLabelClass("original", "explorer")).toBe("text-amber-200");
    expect(speakerLabelClass("logo", "virtualGuide")).toBe("text-[#F57602]");
    expect(speakerLabelClass("logo", "explorer")).toBe("text-[#F7DDC6]");
  });

  it("SS02 logo colours are the measured Mind orange and a warm ivory, distinct and readable", () => {
    expect(SPEAKER_LOGO_COLOURS.virtualGuide).toBe(SPEAKER_LOGO_MEASUREMENTS.mindColour);
    expect(SPEAKER_LOGO_COLOURS.explorer).not.toBe(SPEAKER_LOGO_COLOURS.virtualGuide);
    expect(SPEAKER_LOGO_COLOURS.explorer).not.toBe(SPEAKER_LOGO_MEASUREMENTS.solColour);
    expect(contrast(SPEAKER_LOGO_COLOURS.virtualGuide, GUIDE_BUBBLE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(SPEAKER_LOGO_COLOURS.explorer, EXPLORER_BUBBLE)).toBeGreaterThanOrEqual(4.5);
    // Visibly different from the surrounding gold and from each other.
    expect(contrast(SPEAKER_LOGO_COLOURS.virtualGuide, AMBER_200)).toBeGreaterThan(2);
    expect(SPEAKER_LOGO_COLOURS.explorer.toUpperCase()).not.toBe(AMBER_200);
    expect(contrast(SPEAKER_LOGO_COLOURS.explorer, SPEAKER_LOGO_COLOURS.virtualGuide)).toBeGreaterThan(2);
  });

  it("SS03 the icon crops match the measured logo boxes and use the unchanged logo file", () => {
    const { image, ringCrop, faceCrop, ringCentre, ringRadius, faceBox } = SPEAKER_LOGO_MEASUREMENTS;
    const percent = (value: number) => `${(value * 100).toFixed(4)}%`;
    const classesFor = (crop: { left: number; top: number; size: number }) => [
      `[background-size:${percent(image.width / crop.size)}_${percent(image.height / crop.size)}]`,
      `[background-position:${percent(crop.left / (image.width - crop.size))}_${percent(crop.top / (image.height - crop.size))}]`,
    ];
    for (const expected of classesFor(ringCrop)) expect(SPEAKER_LOGO_ICON_CLASS.virtualGuide).toContain(expected);
    for (const expected of classesFor(faceCrop)) expect(SPEAKER_LOGO_ICON_CLASS.explorer).toContain(expected);
    for (const iconClass of Object.values(SPEAKER_LOGO_ICON_CLASS)) {
      expect(iconClass).toContain(`[background-image:url(${SOLMIND_LOGO_SRC})]`);
      expect(iconClass).toContain("rounded-full");
      expect(iconClass).toContain("[mask-image:radial-gradient(circle_closest-side,");
    }
    // The ring crop holds the whole ring; the face crop holds the face but stays inside the ring.
    expect(ringCrop.left + ringCrop.size / 2).toBe(ringCentre.x);
    expect(ringCrop.size / 2).toBeGreaterThan(ringRadius);
    const faceCentre = { x: faceCrop.left + faceCrop.size / 2, y: faceCrop.top + faceCrop.size / 2 };
    const reach = Math.hypot(faceCentre.x - ringCentre.x, faceCentre.y - ringCentre.y) + faceCrop.size / 2;
    expect(reach).toBeLessThan(ringRadius - 10);
    expect(faceCrop.left).toBeLessThanOrEqual(faceBox.left);
    expect(faceCrop.top).toBeLessThanOrEqual(faceBox.top);
    expect(faceCrop.left + faceCrop.size).toBeGreaterThanOrEqual(faceBox.right);
    expect(faceCrop.top + faceCrop.size).toBeGreaterThanOrEqual(faceBox.bottom);
    // The ring's mask hides everything nearer the ring centre than 70% of the
    // crop's half side (0.7 x 145 = 101.5 px). The face box's bottom edge is
    // 263 - 162 = 101 px below the centre, just inside that cut. This checks the
    // bottom edge directly below the centre only, not the box's corners.
    expect(faceBox.bottom - ringCentre.y).toBeLessThan(0.7 * (ringCrop.size / 2));
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

  it("SS05 each style renders the exact expected S01R2 speaker markup; original is today's", () => {
    expect(speakerParagraph(renderTurn(0, "original"))).toBe(
      '<p class="flex items-center gap-2 text-xs font-semibold text-amber-200" id="conversation-turn-1-speaker"><span aria-hidden="true" class="grid shrink-0 place-items-center rounded-full border border-amber-300/60 bg-amber-300/10 font-semibold tracking-wide text-amber-100 shadow-[0_0_14px_rgba(245,158,11,0.25)] h-6 w-6 text-[9px]">VG</span>Mary (Virtual Guide)</p>',
    );
    expect(speakerParagraph(renderTurn(1, "original"))).toBe(
      '<p class="flex items-center gap-2 text-xs font-semibold text-amber-200" id="conversation-turn-2-speaker"><span aria-hidden="true" class="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-stone-500 bg-stone-800 font-serif text-[11px] text-stone-100">A</span>You</p>',
    );
    expect(speakerParagraph(renderTurn(0, "logo"))).toBe(
      `<p class="flex items-center gap-2 text-xs font-semibold text-[#F57602]" id="conversation-turn-1-speaker"><span aria-hidden="true" class="h-6 w-6 ${SPEAKER_LOGO_ICON_CLASS.virtualGuide}" data-speaker-icon="virtualGuide"></span>Mary (Virtual Guide)</p>`,
    );
    expect(speakerParagraph(renderTurn(1, "logo"))).toBe(
      `<p class="flex items-center gap-2 text-xs font-semibold text-[#F7DDC6]" id="conversation-turn-2-speaker"><span aria-hidden="true" class="h-6 w-6 ${SPEAKER_LOGO_ICON_CLASS.explorer}" data-speaker-icon="explorer"></span>You</p>`,
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
