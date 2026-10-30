// Proves the one-line revert: with SPEAKER_LABEL_STYLE set to "original",
// both screens render today's gold labels and original badges again.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import S01R2Page from "../../../app/explorer/compass-comparison/page";
import InterimPage from "../../../app/explorer/conversation-preview/page";

vi.mock("@/lib/solmind/explorerSpeakerStyle", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/solmind/explorerSpeakerStyle")>()),
  SPEAKER_LABEL_STYLE: "original",
}));

const ORIGINAL_LABEL = 'class="flex items-center gap-2 text-xs font-semibold text-amber-200"';

describe("speaker label style set to original", () => {
  it("SO01 the S01R2 screen shows the original labels and badges only", () => {
    const html = renderToStaticMarkup(createElement(S01R2Page));
    expect(html).not.toContain("data-speaker-icon");
    expect(html).not.toContain("text-[#F57602]");
    expect(html).not.toContain("text-[#F7DDC6]");
    expect(html.split(ORIGINAL_LABEL).length - 1).toBeGreaterThanOrEqual(2);
    expect(html).toContain(
      '<span aria-hidden="true" class="grid shrink-0 place-items-center rounded-full border border-amber-300/60 bg-amber-300/10 font-semibold tracking-wide text-amber-100 shadow-[0_0_14px_rgba(245,158,11,0.25)] h-9 w-9 text-[11px]">VG</span>',
    );
    expect(html).toContain(
      '<span aria-hidden="true" class="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-stone-500 bg-stone-800 font-serif text-[11px] text-stone-100">A</span>You</p>',
    );
  });

  it("SO02 the interim screen starts from the constant and shows the original badges", () => {
    const html = renderToStaticMarkup(createElement(InterimPage));
    expect(html).not.toContain("data-speaker-icon");
    expect(html).toContain(
      `<p ${ORIGINAL_LABEL} id="conversation-preview-turn-1-speaker"><span aria-hidden="true" class="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-amber-300/60 bg-amber-300/10 text-amber-100 shadow-[0_0_14px_rgba(245,158,11,0.25)]"><svg`,
    );
    expect(html).toContain(
      `<p ${ORIGINAL_LABEL} id="conversation-preview-turn-2-speaker"><span aria-hidden="true" class="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-stone-500 bg-stone-800 text-stone-100"><svg`,
    );
    expect(/aria-pressed="true"[^>]*>Original</.test(html)).toBe(true);
  });
});
