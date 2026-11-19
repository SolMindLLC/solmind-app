import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  TRANSCRIPT_HEIGHT,
  connectedComposerPageMove,
  connectedKeyboardPageMove,
  connectedKeyboardSpaceGoes,
  connectedKeyboardSpaceNeeded,
  connectedOpenTargetInView,
  connectedTranscriptHeight,
  connectedVisibleArea,
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
    // Since REV558 finding 2 the window is the visible area: the visual viewport when the browser has one.
    expect(SCREEN).toContain("const area = visibleArea();\n    if (place !== null && connectedOpenTargetInView({ top: place.top, bottom: place.bottom, windowHeight: area.height, windowTop: area.top })) return;\n    end.scrollIntoView({ behavior: \"instant\", block: \"end\" });");
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
    // Since REV558 finding 2 the height is that of the visible area (the visual viewport when there is one).
    expect(sizer).toContain("windowHeight: visibleArea().height,");
    expect(sizer).toContain("top: place.top + window.scrollY,");
    expect(sizer).toContain("below: end.getBoundingClientRect().bottom - place.bottom,");
    // An ended conversation is sized against the marker after its read-only explanation.
    expect(sizer.split("fitTranscript(transcriptRef.current, endedEndRef.current ?? conversationEndRef.current)").length - 1).toBe(2);
  });

  it("writes a height only when it differs, never the transcript's scroll position, and never calls focus", () => {
    // Its one page move is the keyboard follow-up (REV558 finding 2), tested below.
    expect(sizer.split("window.scrollBy(").length - 1).toBe(1);
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

// GPT-6 Astra review REV558, finding 2: on a phone the on-screen keyboard shrinks only the visual viewport, so
// the message box and Send could stay behind it. The visible area is the visual viewport when the browser has
// one; the sizer follows its resize and scroll events and moves the page when the keyboard covered the focused
// message box or Send. A stubbed visualViewport stands for the phone's.
describe("REV558 finding 2: the visible area is the visual viewport", () => {
  const stub = (height: number, offsetTop = 0, scale = 1) => ({ height, offsetTop, scale, width: 390, offsetLeft: 0, pageTop: 0, pageLeft: 0 });

  it("uses the visual viewport's height and offsetTop when there is one, and the layout height otherwise", () => {
    expect(connectedVisibleArea(stub(508), 844)).toEqual({ top: 0, height: 508, scale: 1, layout: 844 });
    expect(connectedVisibleArea(stub(422, 120, 2), 844)).toEqual({ top: 120, height: 422, scale: 2, layout: 844 });
    // No visual viewport, or one that reports nothing usable: today's measure.
    expect(connectedVisibleArea(null, 844)).toEqual({ top: 0, height: 844, scale: 1, layout: 844 });
    expect(connectedVisibleArea(undefined, 900)).toEqual({ top: 0, height: 900, scale: 1, layout: 900 });
    expect(connectedVisibleArea(stub(Number.NaN), 844)).toEqual({ top: 0, height: 844, scale: 1, layout: 844 });
    expect(connectedVisibleArea(stub(0), 844)).toEqual({ top: 0, height: 844, scale: 1, layout: 844 });
    expect(connectedVisibleArea(stub(508, Number.NaN), 844)).toEqual({ top: 0, height: 844, scale: 1, layout: 844 });
    expect(connectedVisibleArea({ height: 508, offsetTop: 0 }, 844)).toEqual({ top: 0, height: 508, scale: 1, layout: 844 });
  });

  it("with the keyboard open the transcript is sized to what is left, down to its smallest height", () => {
    const open = connectedVisibleArea(stub(508), 844);
    expect(connectedTranscriptHeight({ windowHeight: open.height, top: 150, below: 110 })).toBe(232);
    // Not enough room for the smallest transcript: 224 px, and the page move below brings the message box in view.
    expect(connectedTranscriptHeight({ windowHeight: open.height, top: 150, below: 200 })).toBe(224);
  });

  it("the page-open check counts from where the visible area starts", () => {
    expect(connectedOpenTargetInView({ top: 480, bottom: 480, windowHeight: 508 })).toBe(true);
    expect(connectedOpenTargetInView({ top: 600, bottom: 600, windowHeight: 508 })).toBe(false);
    expect(connectedOpenTargetInView({ top: 600, bottom: 600, windowHeight: 508, windowTop: 120 })).toBe(true);
    expect(connectedOpenTargetInView({ top: 100, bottom: 100, windowHeight: 508, windowTop: 120 })).toBe(false);
  });

  it("moves the page just far enough to show the message box and Send with the gap under Send", () => {
    const area = connectedVisibleArea(stub(508), 844);
    const onBox = (top: number) => ({ top, bottom: top + 90 });
    // Already inside: no move.
    expect(connectedComposerPageMove({ top: 300, bottom: 492, focused: onBox(300), area })).toBe(0);
    // Send is 200 px below the visible area: 700 + 16 - 508.
    expect(connectedComposerPageMove({ top: 560, bottom: 700, focused: onBox(560), area })).toBe(208);
    expect(connectedComposerPageMove({ top: 560, bottom: 700, focused: { top: 660, bottom: 700 }, area })).toBe(208);
    // Above the visible area: back up to its top.
    expect(connectedComposerPageMove({ top: -40, bottom: 100, focused: onBox(-40), area })).toBe(-40);
    // A visible area that starts lower down (the zoomed view was moved).
    expect(connectedComposerPageMove({ top: 560, bottom: 700, focused: onBox(560), area: connectedVisibleArea(stub(508, 100), 844) })).toBe(108);
    expect(connectedComposerPageMove({ top: Number.NaN, bottom: 700, focused: onBox(560), area })).toBe(0);
    expect(connectedComposerPageMove({ top: 560, bottom: 700, focused: { top: Number.NaN, bottom: 700 }, area })).toBe(0);
  });

  // GPT-6 Astra review REV574, finding 2.
  it("when the message box and Send cannot both fit, the one that holds focus is shown", () => {
    const area = connectedVisibleArea(stub(508), 844);
    // The message box holds focus: its top goes to the top of the visible area.
    expect(connectedComposerPageMove({ top: 100, bottom: 700, focused: { top: 100, bottom: 190 }, area })).toBe(100);
    // Send holds focus: Send, with the gap under it, ends at the bottom of the visible area (700 + 16 - 508).
    expect(connectedComposerPageMove({ top: 100, bottom: 700, focused: { top: 660, bottom: 700 }, area })).toBe(208);
    // The review's example: message box top 100, Send bottom 400, 250 px visible, Send focused.
    const short = connectedVisibleArea(stub(250), 844);
    const move = connectedComposerPageMove({ top: 100, bottom: 400, focused: { top: 360, bottom: 400 }, area: short });
    expect(move).toBe(166);
    expect(400 - move + 16).toBeLessThanOrEqual(250);
    expect(360 - move).toBeGreaterThanOrEqual(0);
    // The same span with the message box focused keeps the message box.
    expect(connectedComposerPageMove({ top: 100, bottom: 400, focused: { top: 100, bottom: 190 }, area: short })).toBe(100);
    // A focused control that is itself taller than the visible area shows its top.
    expect(connectedComposerPageMove({ top: 100, bottom: 700, focused: { top: 100, bottom: 640 }, area: short })).toBe(100);
    // Send focused and already visible in a span that cannot fit: as much of the message box as fits, Send kept.
    expect(connectedComposerPageMove({ top: -200, bottom: 200, focused: { top: 160, bottom: 200 }, area: short })).toBe(-34);
  });

  it("moves only after a keyboard change that covered a focused control the Explorer could see", () => {
    const full = connectedVisibleArea(stub(844), 844);
    const open = connectedVisibleArea(stub(508), 844);
    const box = { top: 600, bottom: 690 };
    const after = { top: 560, bottom: 650 };
    // The keyboard opened over the focused message box.
    expect(connectedKeyboardPageMove({ before: full, now: open, focusedBefore: box, focused: after, top: 560, bottom: 700 })).toBe(208);
    // It closed again and everything is in view: no move.
    expect(connectedKeyboardPageMove({ before: open, now: full, focusedBefore: { top: 352, bottom: 442 }, focused: { top: 352, bottom: 442 }, top: 352, bottom: 492 })).toBe(0);
    // The same height (the zoomed view was only moved): never.
    expect(connectedKeyboardPageMove({ before: open, now: connectedVisibleArea(stub(508, 90), 844), focusedBefore: box, focused: after, top: 560, bottom: 700 })).toBe(0);
    // A pinch zoom changes the scale: the Explorer's own doing.
    expect(connectedKeyboardPageMove({ before: full, now: connectedVisibleArea(stub(422, 0, 2), 844), focusedBefore: box, focused: after, top: 560, bottom: 700 })).toBe(0);
    // The window itself was resized (the layout height changed too): handled as before, no page move.
    expect(connectedKeyboardPageMove({ before: connectedVisibleArea(stub(900), 900), now: connectedVisibleArea(stub(420), 420), focusedBefore: box, focused: after, top: 560, bottom: 700 })).toBe(0);
    expect(connectedKeyboardPageMove({ before: connectedVisibleArea(null, 900), now: connectedVisibleArea(null, 420), focusedBefore: box, focused: after, top: 560, bottom: 700 })).toBe(0);
    // The Explorer had scrolled the focused control out of view before the change: not pulled back.
    expect(connectedKeyboardPageMove({ before: full, now: open, focusedBefore: { top: 900, bottom: 990 }, focused: { top: 900, bottom: 990 }, top: 900, bottom: 1000 })).toBe(0);
    expect(connectedKeyboardPageMove({ before: full, now: open, focusedBefore: { top: -200, bottom: -110 }, focused: { top: -200, bottom: -110 }, top: -200, bottom: -100 })).toBe(0);
  });

  // GPT-6 Astra review REV574, finding 2: the "was in view" question is asked of the control that holds focus.
  it("a focused Send that was in view is followed even when the message box was outside the visible area before", () => {
    const full = connectedVisibleArea(stub(844), 844);
    const open = connectedVisibleArea(stub(508), 844);
    // The message box started above the window (top -150); Send (60 to 100) was in view. Both fit in what is
    // left, so the page moves back up and shows the message box too.
    expect(connectedKeyboardPageMove({ before: full, now: open, focusedBefore: { top: 60, bottom: 100 }, focused: { top: 60, bottom: 100 }, top: -150, bottom: 100 })).toBe(-150);
    // Send in view lower down, the message box above the window: Send is brought above the keyboard.
    expect(connectedKeyboardPageMove({ before: full, now: open, focusedBefore: { top: 700, bottom: 740 }, focused: { top: 700, bottom: 740 }, top: -20, bottom: 740 })).toBe(248);
    // Send itself out of view before the change (the message box in view): not pulled back.
    expect(connectedKeyboardPageMove({ before: full, now: open, focusedBefore: { top: 900, bottom: 940 }, focused: { top: 900, bottom: 940 }, top: 700, bottom: 940 })).toBe(0);
  });

  // GPT-6 Astra review REV574, finding 1.
  it("asks for temporary scroll room only for the part of a move the page cannot make", () => {
    expect(connectedKeyboardSpaceNeeded(208, 400)).toBe(0);
    expect(connectedKeyboardSpaceNeeded(208, 208)).toBe(0);
    expect(connectedKeyboardSpaceNeeded(208, 50)).toBe(159);
    expect(connectedKeyboardSpaceNeeded(208, 0)).toBe(209);
    expect(connectedKeyboardSpaceNeeded(208, -3)).toBe(209);
    expect(connectedKeyboardSpaceNeeded(207.4, 50.2)).toBe(159);
    // A move up the page, or none, needs no room.
    expect(connectedKeyboardSpaceNeeded(-40, 0)).toBe(0);
    expect(connectedKeyboardSpaceNeeded(0, 0)).toBe(0);
    expect(connectedKeyboardSpaceNeeded(Number.NaN, 0)).toBe(0);
  });

  // GPT-6 Astra review REV587: a pinch zoom out makes the visible height grow while the keyboard is still open.
  it("the temporary scroll room goes only when the visible height grew at the same zoom and layout height", () => {
    const full = connectedVisibleArea(stub(844), 844);
    const open = connectedVisibleArea(stub(508), 844);
    const pinched = connectedVisibleArea(stub(254, 0, 2), 844);
    // The keyboard closed, or became smaller.
    expect(connectedKeyboardSpaceGoes(open, full)).toBe(true);
    expect(connectedKeyboardSpaceGoes(open, connectedVisibleArea(stub(568), 844))).toBe(true);
    // The keyboard opened or grew, or nothing changed: the room stays.
    expect(connectedKeyboardSpaceGoes(full, open)).toBe(false);
    expect(connectedKeyboardSpaceGoes(open, open)).toBe(false);
    // Pinch in, then back out with the keyboard still open: the room stays both times.
    expect(connectedKeyboardSpaceGoes(open, pinched)).toBe(false);
    expect(connectedKeyboardSpaceGoes(pinched, open)).toBe(false);
    // The rule agrees with the page move: where the room would go, a move may follow; after a zoom, neither.
    expect(connectedKeyboardPageMove({ before: pinched, now: open, focusedBefore: { top: 300, bottom: 340 }, focused: { top: 300, bottom: 340 }, top: 200, bottom: 700 })).toBe(0);
    // The keyboard closes while the view is zoomed (same zoom before and after): the room goes.
    expect(connectedKeyboardSpaceGoes(pinched, connectedVisibleArea(stub(422, 0, 2), 844))).toBe(true);
    // The window itself was resized (the layout height changed): the room stays.
    expect(connectedKeyboardSpaceGoes(connectedVisibleArea(stub(420), 420), connectedVisibleArea(stub(900), 900))).toBe(false);
  });

  it("the screen measures the visual viewport, follows its resize and scroll events and cleans up", () => {
    expect(SCREEN).toContain("function visibleArea() {\n  return connectedVisibleArea(window.visualViewport, document.documentElement.clientHeight);\n}");
    // The layout height is read in that one place only.
    expect(SCREEN.split("document.documentElement.clientHeight").length - 1).toBe(1);
    const sizer = SCREEN.slice(SCREEN.indexOf("function TranscriptSizer("), SCREEN.indexOf("type AlertsProps"));
    expect(sizer).toContain("const visual = window.visualViewport ?? null;");
    expect(sizer).toContain('visual?.addEventListener("resize", visualChanged);\n    visual?.addEventListener("scroll", visualChanged);');
    expect(sizer).toContain('visual?.removeEventListener("resize", visualChanged);\n      visual?.removeEventListener("scroll", visualChanged);');
    // The message box is measured before the transcript is sized again, then the move is decided by the rule.
    const handler = sizer.slice(sizer.indexOf("const visualChanged = () => {"), sizer.indexOf('visual?.addEventListener("resize"'));
    expect(handler.indexOf("const focusedBefore = composer?.focused.getBoundingClientRect() ?? null;")).toBeGreaterThan(0);
    expect(handler.indexOf("fit();")).toBeGreaterThan(handler.indexOf("const focusedBefore ="));
    // The control that holds focus goes into the rule (REV574 finding 2).
    expect(handler).toContain("focused: { top: focused.top, bottom: focused.bottom },");
    // Temporary scroll room for the part of the move the page cannot make, then measured again (REV574 finding 1);
    // it goes when the visible height grows and when the screen leaves.
    expect(handler).toContain("const more = connectedKeyboardSpaceNeeded(move, root.scrollHeight - root.clientHeight - window.scrollY);\n        if (more > 0) {\n          giveKeyboardSpace(space, more);\n          move = measure();\n        }");
    expect(handler.indexOf("if (connectedKeyboardSpaceGoes(seen, now)) takeKeyboardSpace(space);")).toBeGreaterThan(handler.indexOf("const focusedBefore ="));
    expect(handler.indexOf("if (connectedKeyboardSpaceGoes(seen, now)) takeKeyboardSpace(space);")).toBeLessThan(handler.indexOf("fit();"));
    // Taken away in those two places only: by that rule, and when the screen leaves (REV587).
    expect(SCREEN.split("takeKeyboardSpace(space)").length - 1).toBe(2);
    expect(sizer).toContain("useEffect(() => {\n    const space = keyboardSpace.current;\n    return () => takeKeyboardSpace(space);\n  }, []);");
    expect(SCREEN).toContain("document.body.style.paddingBottom = `${space.base + space.amount}px`;");
    expect(SCREEN).toContain("document.body.style.paddingBottom = space.inline;");
    expect(SCREEN.split("paddingBottom =").length - 1).toBe(2);
    expect(handler.indexOf("connectedKeyboardPageMove({")).toBeGreaterThan(handler.indexOf("fit();"));
    expect(handler).toContain('if (move !== 0) window.scrollBy({ top: move, behavior: "instant" });');
    expect(handler).toContain("seen = now;");
    // Only the focused message box or Send is followed.
    expect(SCREEN).toContain("if (active === box) return { box, send, focused: box };\n  return send !== null && active === send ? { box, send, focused: send } : null;");
  });
});
