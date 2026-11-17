import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  TRANSCRIPT_HEIGHT,
  connectedOpenTargetInView,
  connectedTranscriptHeight,
  connectedTranscriptScrollsToEnd,
} from "../explorerConversationConnectedScreen";

// Compact header, step B (Paul's choice "A + B", PRJ01-SPR002 decision record 2026-11-16 17:53:42 and 21:27:10
// CST): the transcript is sized to the window so the message box stays in view and the messages scroll inside
// the chat panel. The rules are pure; the browser suite (tests/browser/explorerTranscriptSize.pw.ts) measures
// the built screen.

const SCREEN = readFileSync(path.resolve(__dirname, "../../../components/solmind/ExplorerConversationConnectedScreen.tsx"), "utf8");

describe("step B: the sizing rule, height = Math.min(832, Math.max(224, availableHeight))", () => {
  it("uses 224 px as the smallest height, 832 px as the largest and a 16 px gap under the message box area", () => {
    expect({ ...TRANSCRIPT_HEIGHT }).toEqual({ smallest: 224, largest: 832, gap: 16 });
  });

  it("between its limits the transcript takes exactly the room the window leaves", () => {
    // A 900 px window, the transcript's top 350 px down the page, 200 px of message box under it: 900 - 16 - 350 - 200.
    expect(connectedTranscriptHeight({ windowHeight: 900, top: 350, below: 200 })).toBe(334);
    expect(connectedTranscriptHeight({ windowHeight: 900, top: 350, below: 310 })).toBe(224);
    expect(connectedTranscriptHeight({ windowHeight: 900, top: 350, below: 309 })).toBe(225);
    expect(connectedTranscriptHeight({ windowHeight: 1400, top: 352, below: 200 })).toBe(832);
    expect(connectedTranscriptHeight({ windowHeight: 1400, top: 353, below: 200 })).toBe(831);
  });

  it("never goes below 224 px: on a small window the message box is reached by scrolling the page", () => {
    // A 390 by 844 phone: the transcript starts about 640 px down and the message box area is about 310 px tall.
    expect(connectedTranscriptHeight({ windowHeight: 844, top: 640, below: 310 })).toBe(224);
    expect(connectedTranscriptHeight({ windowHeight: 420, top: 600, below: 300 })).toBe(224);
    expect(connectedTranscriptHeight({ windowHeight: 0, top: 0, below: 0 })).toBe(224);
  });

  it("never goes above 832 px, today's largest height", () => {
    expect(connectedTranscriptHeight({ windowHeight: 2160, top: 300, below: 200 })).toBe(832);
    expect(connectedTranscriptHeight({ windowHeight: 100000, top: 0, below: 0 })).toBe(832);
  });

  it("an ended conversation is sized against the end of its read-only explanation, the same arithmetic", () => {
    // No message box; "below" is the read-only explanation and its link.
    expect(connectedTranscriptHeight({ windowHeight: 900, top: 350, below: 140 })).toBe(394);
  });

  it("rounds to whole pixels and falls back to the smallest height for a measurement that is not a number", () => {
    expect(connectedTranscriptHeight({ windowHeight: 900, top: 350.4, below: 200.2 })).toBe(333);
    expect(connectedTranscriptHeight({ windowHeight: 900, top: 349.6, below: 200 })).toBe(334);
    expect(connectedTranscriptHeight({ windowHeight: Number.NaN, top: 350, below: 200 })).toBe(224);
    expect(connectedTranscriptHeight({ windowHeight: 900, top: Number.POSITIVE_INFINITY, below: 200 })).toBe(224);
  });

  it("with the page at its top, a sized transcript leaves the end of the message box area 16 px above the window's end", () => {
    for (const windowHeight of [700, 800, 900, 1080]) {
      const top = 350;
      const below = 200;
      const height = connectedTranscriptHeight({ windowHeight, top, below });
      if (height > TRANSCRIPT_HEIGHT.smallest && height < TRANSCRIPT_HEIGHT.largest) expect(top + height + below).toBe(windowHeight - 16);
    }
  });

  it("is monotonic: more window never gives less transcript, more above or below never gives more", () => {
    let last = 0;
    for (let windowHeight = 300; windowHeight <= 1600; windowHeight += 7) {
      const height = connectedTranscriptHeight({ windowHeight, top: 350, below: 200 });
      expect(height).toBeGreaterThanOrEqual(last);
      expect(height).toBeGreaterThanOrEqual(224);
      expect(height).toBeLessThanOrEqual(832);
      last = height;
    }
    expect(connectedTranscriptHeight({ windowHeight: 900, top: 400, below: 200 }))
      .toBeLessThan(connectedTranscriptHeight({ windowHeight: 900, top: 350, below: 200 }));
    expect(connectedTranscriptHeight({ windowHeight: 900, top: 350, below: 260 }))
      .toBeLessThan(connectedTranscriptHeight({ windowHeight: 900, top: 350, below: 200 }));
  });
});

describe("step B: the transcript's own scroll position", () => {
  it("an empty conversation with nothing being sent stays at position zero", () => {
    expect(connectedTranscriptScrollsToEnd(0, false)).toBe(false);
  });

  it("a saved conversation, a Send being awaited and the first Send of a new conversation scroll to the newest end", () => {
    expect(connectedTranscriptScrollsToEnd(1, false)).toBe(true);
    expect(connectedTranscriptScrollsToEnd(40, false)).toBe(true);
    expect(connectedTranscriptScrollsToEnd(40, true)).toBe(true);
    expect(connectedTranscriptScrollsToEnd(0, true)).toBe(true);
  });

  it("the scroll effect keeps exactly its two triggers: the message count and waiting for a reply", () => {
    expect(SCREEN).toContain("if (box && connectedTranscriptScrollsToEnd(count, view.awaitingReply)) box.scrollTop = box.scrollHeight;\n  }, [count, view.awaitingReply, scrollRef]);");
    // It is the only place that writes the transcript's scroll position: neither the sizing nor an explanation
    // opening, nor an answer to a saved offer, scrolls it.
    expect(SCREEN.split("scrollTop =").length - 1).toBe(1);
    expect(SCREEN.split("scrollTop").length - 1).toBe(1);
  });
});

describe("step B: the once-only page move on open", () => {
  it("is skipped when the end of the conversation area, with its 16 px margin, is already inside the window", () => {
    expect(connectedOpenTargetInView({ top: 884, bottom: 884, windowHeight: 900 })).toBe(true);
    expect(connectedOpenTargetInView({ top: 500, bottom: 500, windowHeight: 900 })).toBe(true);
    // Within one pixel of the sized position (rounding).
    expect(connectedOpenTargetInView({ top: 884.6, bottom: 884.6, windowHeight: 900 })).toBe(true);
  });

  it("is made when the target is below the window, also by a few pixels, or above it", () => {
    expect(connectedOpenTargetInView({ top: 887, bottom: 887, windowHeight: 900 })).toBe(false);
    expect(connectedOpenTargetInView({ top: 1500, bottom: 1500, windowHeight: 844 })).toBe(false);
    expect(connectedOpenTargetInView({ top: -20, bottom: -20, windowHeight: 900 })).toBe(false);
  });

  it("the page-open effect asks that question before its one scrollIntoView, and the other open rules are unchanged", () => {
    expect(SCREEN).toContain("if (place !== null && connectedOpenTargetInView({ top: place.top, bottom: place.bottom, windowHeight: document.documentElement.clientHeight })) return;\n    end.scrollIntoView({ behavior: \"instant\", block: \"end\" });");
    // Decided once; a notice above keeps the page at its top; an empty conversation does not move.
    expect(SCREEN).toContain("if (openedAtNewest.current || state === null) return;\n    openedAtNewest.current = true;");
    expect(SCREEN).toContain("pending.scrollIntoView({ behavior: \"instant\", block: \"nearest\" });");
    expect(SCREEN).toContain("if (state.messages.length === 0) return;");
    expect(SCREEN.split("scrollIntoView(").length - 1).toBe(3);
  });
});

describe("step B: the sizer", () => {
  const sizer = SCREEN.slice(SCREEN.indexOf("function fitTranscript("), SCREEN.indexOf("type AlertsProps"));

  it("measures the page position of the transcript, not its window position, and what must stay in view under it", () => {
    expect(sizer).toContain("windowHeight: document.documentElement.clientHeight,");
    expect(sizer).toContain("top: place.top + window.scrollY,");
    expect(sizer).toContain("below: end.getBoundingClientRect().bottom - place.bottom,");
    // An ended conversation is sized against the marker after its read-only explanation.
    expect(sizer.split("fitTranscript(transcriptRef.current, endedEndRef.current ?? conversationEndRef.current)").length - 1).toBe(2);
  });

  it("writes a height only when it differs, never a scroll position, and never calls focus", () => {
    expect(sizer).toContain("if (box.style.height !== value) box.style.height = value;");
    expect(sizer).not.toContain("scrollTop");
    expect(sizer).not.toContain("scrollIntoView");
    expect(sizer).not.toContain("scrollTo");
    expect(sizer).not.toContain(".focus(");
  });

  it("runs after every render, on a window resize and from a guarded, deferred ResizeObserver, and cleans up", () => {
    expect(sizer).toContain("useLayoutEffect(() => {\n    fitTranscript(");
    expect(sizer).toContain('window.addEventListener("resize", fit);');
    expect(sizer).toContain('window.removeEventListener("resize", fit);');
    expect(sizer).toContain('typeof ResizeObserver === "function" ? new ResizeObserver(later) : null');
    expect(sizer).toContain("frame = requestAnimationFrame(fit);");
    expect(sizer).toContain("observer?.disconnect();");
    // It also observes everything above the transcript in the page (REV494 finding 3).
    expect(sizer).toContain("for (let node: Element | null = box; node !== null && node !== document.body; node = node.parentElement) {");
    expect(sizer).toContain("for (let above = node.previousElementSibling; above !== null; above = above.previousElementSibling) watch(above);");
    // Every target is observed by its border box, so that a padding change counts (REV494b finding 1).
    expect(sizer).toContain('const watch = (element: Element) => observer.observe(element, { box: "border-box" });');
    expect(sizer.split("observer.observe(").length - 1).toBe(1);
    expect(sizer).toContain("if (element !== null) watch(element);");
    // The comment claims only what the code does (REV494 finding 3, REV494b finding 3).
    expect(SCREEN).toContain("Observer work is deferred to a frame and unchanged heights\n// are not rewritten; browser tests check settling after the covered layout changes.");
    expect(SCREEN).not.toContain("no resize loop can start");
    expect(SCREEN).not.toContain("at most one more call");
  });

  it("is drawn after the chat panel and before the focus keeper, inside the card", () => {
    const sizerAt = SCREEN.indexOf("<TranscriptSizer\n");
    expect(sizerAt).toBeGreaterThan(0);
    expect(SCREEN.indexOf("<TranscriptSizer\n", sizerAt + 1)).toBe(-1);
    for (const earlier of ["<SavedTranscript\n", "ref={conversationEndRef}", "ref={endedEndRef}", "<EndSession actions={actions}"]) {
      expect(SCREEN.lastIndexOf(earlier), earlier).toBeLessThan(sizerAt);
      expect(SCREEN.lastIndexOf(earlier), earlier).toBeGreaterThan(0);
    }
    expect(SCREEN.indexOf("<StripFocusKeeper\n")).toBeGreaterThan(sizerAt);
  });
});
