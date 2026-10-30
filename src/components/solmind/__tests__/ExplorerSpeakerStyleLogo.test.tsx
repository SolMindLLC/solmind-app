// With SPEAKER_LABEL_STYLE set to "logo" (as delivered), both screens show the
// logo labels and icons. Mocked, so this holds whichever value the constant has.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import S01R2Page from "../../../app/explorer/compass-comparison/page";
import InterimPage from "../../../app/explorer/conversation-preview/page";

vi.mock("@/lib/solmind/explorerSpeakerStyle", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/solmind/explorerSpeakerStyle")>()),
  SPEAKER_LABEL_STYLE: "logo",
}));

const LABEL = 'class="flex items-center gap-2 text-xs font-semibold';

describe("speaker label style set to logo", () => {
  it("SL01 the S01R2 screen shows the logo labels and icons", () => {
    const html = renderToStaticMarkup(createElement(S01R2Page));
    expect(html).toContain(`${LABEL} text-[#F57602]"`);
    expect(html).toContain(`${LABEL} text-[#F7DDC6]"`);
    expect(html).not.toContain(`${LABEL} text-amber-200"`);
    expect(html).toContain('data-speaker-icon="virtualGuide"');
    expect(html).toContain('data-speaker-icon="explorer"');
    expect(html).not.toContain(">VG</span>");
    expect(html).toContain("Mary (Virtual Guide)</p>");
    expect(html).toContain('data-speaker-icon="explorer"></span>You</p>');
  });

  it("SL02 the interim screen starts from the constant with New selected", () => {
    const html = renderToStaticMarkup(createElement(InterimPage));
    expect(html).toContain(`${LABEL} text-[#F57602]" id="conversation-preview-turn-1-speaker"`);
    expect(html).toContain(`${LABEL} text-[#F7DDC6]" id="conversation-preview-turn-2-speaker"`);
    expect(html.split('data-speaker-icon="virtualGuide"').length - 1).toBe(4);
    expect(html.split('data-speaker-icon="explorer"').length - 1).toBe(3);
    expect(/aria-pressed="true"[^>]*>New</.test(html)).toBe(true);
    expect(/aria-pressed="false"[^>]*>Original</.test(html)).toBe(true);
  });
});
