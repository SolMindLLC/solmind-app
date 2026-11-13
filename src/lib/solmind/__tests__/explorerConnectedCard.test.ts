import { describe, expect, it } from "vitest";

import { CARD_LABELS, CARD_POINTS, CARD_WAYPOINTS, cardState, cardHistoryState } from "../../../../tests/browser/connectedCardFixture";
import { parseExplorerWaypointPage } from "../explorerWaypointPortfolioContract";
import {
  BOTTOM_ROW_PLACES,
  CONNECTED_COMPASS_WORDING,
  DASHED_NEEDLE_WORDING,
  NEEDLE_HOLD_DRAWER_TEXT,
  NEEDLE_HOLD_TEXT,
  bottomRow,
  bottomRowLabel,
  bottomRowMoreSuffix,
  bottomRowMoreText,
  compassPlaceText,
  connectedCompass,
  connectedWaypointLines,
  dashedNeedleText,
  describeConnectedCompass,
  dialLabelLines,
  dialPoints,
  pointsOffDial,
  earlierVersionLabel,
  needleHold,
  needleHoldText,
  needleMovedText,
  pointNeedleIntent,
  waypointListGroups,
  waypointStage,
  type NeedleHoldFlags,
} from "../explorerConnectedCard";
import {
  EXPLORER_CONVERSATION_VERSION,
  parseExplorerConversationState,
  type ExplorerConversationCompassItem,
  type ExplorerConversationState,
  type ExplorerConversationWaypoint,
} from "../explorerConversationContract";

// Chat step slices S1 and S2 (build spec 2026-11-03): the connected Compass & Waypoint card's
// mapping from the saved state, and when the Explorer can point the needle.

const OPEN: NeedleHoldFlags = { ended: false, endReviewOpen: false, uncertain: false, busy: false, held: false };
const SOURCE = "20000000-0000-4000-8000-000000000001";
const POINT = (index: number) => `40000000-0000-4000-8000-00000000000${index}`;

function bare(compassItems: ExplorerConversationCompassItem[], overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  return { waypointCapacity: { activeCount: 0, activeLimit: 20, historyRoom: true, conversationRoom: true }, waypointProjection: { kind: "current_heads" as const, limit: 20 as const, totalHeads: 0, hasMore: false },
    version: EXPLORER_CONVERSATION_VERSION, conversationId: "10000000-0000-4000-8000-000000000001", revision: 3, pendingTurn: false, turnedDownLimitReached: false, waypointDraft: null,
    providerState: "available", messages: [{ id: SOURCE, role: "explorer", body: "A synthetic message", createdAt: "2026-11-03T14:00:00.000Z" }],
    compassItems, priorityId: null, attentionId: null, waypoints: [], route: [], sessionStatus: "active", ending: null, ...overrides,
  };
}

describe("connected Compass & Waypoint card mapping", () => {
  it("ECC13 legacy forming points stay out of the dial, descriptions and needle controls", () => {
    const original = cardState();
    const state = cardState({ compassItems: original.compassItems.map(item => ({ ...item,
      formation: item.id === CARD_POINTS.detour || item.id === CARD_POINTS.unarranged ? "forming" : "saved" })) });
    const compass = connectedCompass(state);
    expect(compass.points).toEqual(connectedCompass(original).points.filter(point =>
      point.id !== CARD_POINTS.detour && point.id !== CARD_POINTS.unarranged));
    expect(describeConnectedCompass(compass)).not.toMatch(/Forming|Priority|Money worries|Asking for help/);
    expect(pointNeedleIntent(state, OPEN, CARD_POINTS.unarranged)).toBeNull();
    expect(dialPoints(compass).some(point => point.id === CARD_POINTS.detour)).toBe(false);
  });

  it("ECC01 the browser-test and screenshot fixture normalizes legacy fields while preserving every saved fact", () => {
    const state = cardState();
    expect(parseExplorerConversationState(JSON.parse(JSON.stringify(state)))).toEqual({ ...state, compassMode: "legacy", compassChanges: [] });
    expect(parseExplorerConversationState(JSON.parse(JSON.stringify({ ...state, attentionId: CARD_POINTS.priority })))).not.toBeNull();
    // Since the chat card redesign the server may save the needle on a point without a position, and the
    // browser reads that state (the dashed needle's screenshots and browser tests use it).
    for (const attentionId of [CARD_POINTS.otherPath, CARD_POINTS.unarranged]) {
      const moved = cardState({ attentionId });
      expect(parseExplorerConversationState(JSON.parse(JSON.stringify(moved))), attentionId).toEqual({ ...moved, compassMode: "legacy", compassChanges: [] });
    }
    expect(parseExplorerConversationState(JSON.parse(JSON.stringify({ ...state, attentionId: CARD_POINTS.merged })))).toBeNull();
  });

  it("ECC02 an arranged Compass: every current point once, merged originals hidden, Priority at the top and the needle choices", () => {
    const compass = connectedCompass(cardState());
    expect(compass.arranged).toBe(true);
    // Since the chat card redesign (Paul's decision, 2026-11-03 18:05:33 CST) the points without a position can
    // take the needle too, also on an arranged Compass.
    expect(compass.points.map((point) => [point.label, point.place, point.dialAnchor, point.needle])).toEqual([
      [CARD_LABELS.priority, "apex", "apex", "available"],
      [CARD_LABELS.attention, "upper_left", "upper_left", "current"],
      [CARD_LABELS.longLabel, "upper_right", "upper_right", "available"],
      [CARD_LABELS.detour, "side_left", "side_left", "available"],
      [CARD_LABELS.excursion, "lower_center", "lower_center", "available"],
      [CARD_LABELS.unarranged, "unarranged", null, "available"],
      [CARD_LABELS.otherPath, "otherPaths", null, "available"],
    ]);
    expect(compass.points.some((point) => point.id === CARD_POINTS.merged)).toBe(false);
    expect(compass.priority).toBeNull();
    expect(compass.attention?.id).toBe(CARD_POINTS.attention);
    expect(compass.points.map(compassPlaceText)).toEqual([
      "Straight ahead", "Upper left", "Upper right", "Detour, left", "Excursion, lower center", "Not yet arranged", "Other paths",
    ]);
    // Compact and Full views (2026-11-03): the dial draws the 5 placed points; since the redesign the other 2 are in
    // its bottom row, which the description names.
    expect(dialPoints(compass).map((point) => point.id)).toEqual(compass.points.slice(0, 5).map((point) => point.id));
    expect(pointsOffDial(compass).map((point) => point.label)).toEqual([CARD_LABELS.unarranged, CARD_LABELS.otherPath]);
    expect(describeConnectedCompass(compass)).toBe(
      "Straight ahead: Talk with my sister. Upper left: What I need from it. Upper right: Making room to rest after a long work week. " +
      "Detour, left: Money worries. Excursion, lower center: Planning what to say. Not yet arranged: Asking for help. " +
      "Other paths: Avoiding hard talks. The needle points to What I need from it.");
    // A needle on either kind of point without a position is said so.
    expect(describeConnectedCompass(connectedCompass(cardState({ attentionId: CARD_POINTS.otherPath })))).toMatch(
      / The needle points to Avoiding hard talks, which is in Other paths, off your Compass\.$/);
    expect(describeConnectedCompass(connectedCompass(cardState({ attentionId: CARD_POINTS.unarranged })))).toMatch(
      / The needle points to Asking for help, which is not placed on your Compass yet\.$/);
  });

  it("ECC10 the view switch keeps its wording, and the removed instruction texts are gone", () => {
    expect(CONNECTED_COMPASS_WORDING.compactViewButton).toBe("Compact view");
    expect(CONNECTED_COMPASS_WORDING.fullViewButton).toBe("Full view");
    expect(CONNECTED_COMPASS_WORDING.viewButtonSuffix).toBe(" of the Compass");
    // Paul's words (2026-11-03): "Just say "Point the needle to change topic"."
    expect(CONNECTED_COMPASS_WORDING.chooseHeading).toBe("Point the needle to change topic");
    // The instruction sentence, the placement paragraph and the Full view's line about the Compact view are gone.
    const wording = JSON.stringify(CONNECTED_COMPASS_WORDING);
    for (const removed of ["To show what you want to focus on now", "Once a Compass is arranged, the needle points only to placed points",
      "first place it on your Compass with Review Compass arrangement", "not on your Compass, switch to Compact view"]) {
      expect(wording).not.toContain(removed);
    }
    expect(Object.keys(CONNECTED_COMPASS_WORDING)).not.toContain("chooseHelp");
    expect(Object.keys(CONNECTED_COMPASS_WORDING)).not.toContain("needsPlacement");
    // A Compass with no point on the dial (nothing arranged, no Priority) draws none and puts them all in the row.
    const none = connectedCompass(bare([
      { id: POINT(1), sourceMessageId: SOURCE, label: "First" },
      { id: POINT(2), sourceMessageId: SOURCE, label: "Second" },
    ], { attentionId: POINT(2) }));
    expect(dialPoints(none)).toEqual([]);
    expect(pointsOffDial(none).map((point) => point.label)).toEqual(["First", "Second"]);
    expect(describeConnectedCompass(none)).toBe(
      "Not yet arranged: First. Not yet arranged: Second. " +
      "The needle points to Second, which is not placed on your Compass yet.");
    expect(describeConnectedCompass(connectedCompass(bare([{ id: POINT(1), sourceMessageId: SOURCE, label: "Only" }])))).toBe(
      "Not yet arranged: Only. The needle has no direction yet.");
  });

  it("ECC11 the bottom row: up to three points, then two and +N more, keeping the needle's point and its place", () => {
    expect(BOTTOM_ROW_PLACES).toBe(3);
    // k points without a position, all not yet arranged, on a Compass with nothing on the dial.
    const row = (count: number, attention: number | null = null) => {
      const items = Array.from({ length: count }, (_, index) => ({ id: POINT(index + 1), sourceMessageId: SOURCE, label: `Point ${index + 1}` }));
      return bottomRow(connectedCompass(bare(items, { attentionId: attention === null ? null : POINT(attention) })))
        .map((entry) => (entry.kind === "point" ? entry.point.label : bottomRowMoreText(entry.count)));
    };
    expect(row(0)).toEqual([]);
    expect(row(1)).toEqual(["Point 1"]);
    expect(row(2)).toEqual(["Point 1", "Point 2"]);
    expect(row(3)).toEqual(["Point 1", "Point 2", "Point 3"]);
    expect(row(4)).toEqual(["Point 1", "Point 2", "+2 more"]);
    expect(row(5)).toEqual(["Point 1", "Point 2", "+3 more"]);
    // The needle's point always shows: in its own place when it is one of the first two (or of three), otherwise
    // in the second place, so the row does not move under a tap.
    expect(row(3, 3)).toEqual(["Point 1", "Point 2", "Point 3"]);
    expect(row(5, 1)).toEqual(["Point 1", "Point 2", "+3 more"]);
    expect(row(5, 2)).toEqual(["Point 1", "Point 2", "+3 more"]);
    expect(row(5, 4)).toEqual(["Point 1", "Point 4", "+3 more"]);
    expect(row(5, 5)).toEqual(["Point 1", "Point 5", "+3 more"]);
    // In the fixture: not yet arranged first, then Other paths, and the dial's points are not in the row.
    expect(bottomRow(connectedCompass(cardState())).map((entry) => (entry.kind === "point" ? entry.point.id : entry.kind)))
      .toEqual([CARD_POINTS.unarranged, CARD_POINTS.otherPath]);
    // The Priority before any arrangement is drawn at the top, so it is not in the row.
    const before = connectedCompass(bare([
      { id: POINT(1), sourceMessageId: SOURCE, label: "First" },
      { id: POINT(2), sourceMessageId: SOURCE, label: "Second" },
    ], { priorityId: POINT(2) }));
    expect(bottomRow(before).map((entry) => (entry.kind === "point" ? entry.point.label : "more"))).toEqual(["First", "Second"]);
    // "+N more" and what screen readers hear after it.
    expect(bottomRowMoreText(2)).toBe("+2 more");
    expect(`${bottomRowMoreText(2)}${bottomRowMoreSuffix(2)}`).toBe("+2 more points, shown in the Compact view");
    expect(`${bottomRowMoreText(1)}${bottomRowMoreSuffix(1)}`).toBe("+1 more point, shown in the Compact view");
    // The description says how many more the Compact view lists.
    const five = connectedCompass(bare(Array.from({ length: 5 }, (_, index) => ({ id: POINT(index + 1), sourceMessageId: SOURCE, label: `Point ${index + 1}` }))));
    expect(describeConnectedCompass(five)).toBe(
      "Not yet arranged: Point 1. Not yet arranged: Point 2. 3 more points are listed in the Compact view. " +
      "The needle has no direction yet.");
    // Row labels fit one line of 20 characters, cut at a space where they can, with ASCII dots.
    expect(bottomRowLabel(CARD_LABELS.unarranged)).toBe("Asking for help");
    expect(bottomRowLabel("Making room to rest after a long work week")).toBe("Making room to...");
    expect(bottomRowLabel("Supercalifragilisticexpialidocious")).toBe("Supercalifragilis...");
    expect(bottomRowLabel("  Spaced   out \t label  ")).toBe("Spaced out label");
    for (const label of [CARD_LABELS.longLabel, "x".repeat(160), "word ".repeat(40)]) {
      expect(Array.from(bottomRowLabel(label)).length).toBeLessThanOrEqual(20);
    }
  });

  it("ECC12 the legacy dashed needle explains its saved place without retired tool instructions", () => {
    const compass = connectedCompass(cardState());
    const unarranged = compass.points.find(point => point.id === CARD_POINTS.unarranged)!;
    const otherPath = compass.points.find(point => point.id === CARD_POINTS.otherPath)!;
    expect(DASHED_NEEDLE_WORDING.button).toBe("Why the needle is dashed");
    expect(dashedNeedleText(unarranged)).toBe("This point isn't placed on your Compass.");
    expect(dashedNeedleText(otherPath)).toBe("This point is in Other paths, off your Compass.");
    expect(Object.values(DASHED_NEEDLE_WORDING).join(" ")).not.toContain("Review Compass arrangement");
    for (const text of Object.values(DASHED_NEEDLE_WORDING)) expect(/^[\x20-\x7e]*$/.test(text), text).toBe(true);
  });

  it("ECC03 legacy unarranged points keep their saved order without deriving placement from historical Priority", () => {
    const state = bare([
      { id: POINT(1), sourceMessageId: SOURCE, label: "First" },
      { id: POINT(2), sourceMessageId: SOURCE, label: "Second", anchor: null, emphasis: null },
      { id: POINT(3), sourceMessageId: SOURCE, label: "Third" },
    ], { priorityId: POINT(3), attentionId: POINT(1) });
    expect(parseExplorerConversationState(state)).not.toBeNull();
    const compass = connectedCompass(state);
    expect(compass.arranged).toBe(false);
    expect(compass.points.map((point) => [point.label, point.place, point.dialAnchor, point.isPriority, point.needle])).toEqual([
      ["First", "unarranged", null, false, "current"],
      ["Second", "unarranged", null, false, "available"],
      ["Third", "unarranged", null, false, "available"],
    ]);
    // The points the dial does not place are in its bottom row, and the needle on one of them is said so.
    expect(describeConnectedCompass(compass)).toBe(
      "Not yet arranged: First. Not yet arranged: Second. Not yet arranged: Third. The needle points to First, which is not placed on your Compass yet.");
    expect(dialPoints(compass)).toEqual([]);
    expect(pointsOffDial(compass).map((point) => point.label)).toEqual(["First", "Second", "Third"]);
    expect(pointNeedleIntent(state, OPEN, POINT(2))).toEqual({ kind: "set_attention", itemId: POINT(2) });
    expect(pointNeedleIntent(state, OPEN, POINT(3))).toEqual({ kind: "set_attention", itemId: POINT(3) });
  });

  it("ECC04 Priority and attention may be null; a point at the top is not called the Priority", () => {
    const state = bare([
      { id: POINT(1), sourceMessageId: SOURCE, label: "At the top", anchor: "apex", emphasis: 2 },
      { id: POINT(2), sourceMessageId: SOURCE, label: "Lower right", anchor: "lower_right", emphasis: 1 },
    ]);
    expect(parseExplorerConversationState(state)).not.toBeNull();
    const compass = connectedCompass(state);
    expect(compass.priority).toBeNull();
    expect(compass.attention).toBeNull();
    expect(compass.points.map((point) => [compassPlaceText(point), point.isPriority, point.needle])).toEqual([
      ["Straight ahead", false, "available"],
      ["Excursion, lower right", false, "available"],
    ]);
    expect(describeConnectedCompass(compass)).toBe(
      "Straight ahead: At the top. Excursion, lower right: Lower right. The needle has no direction yet.");
    const empty = connectedCompass(bare([]));
    expect(empty.points).toEqual([]);
    expect(empty.priority).toBeNull();
  });

  it("ECC05 dial labels fit two short lines, break at a space where they can and end with ASCII dots when cut", () => {
    expect(dialLabelLines("Rest")).toEqual(["Rest"]);
    expect(dialLabelLines("What I need from it")).toEqual(["What I need", "from it"]);
    expect(dialLabelLines(CARD_LABELS.longLabel)).toEqual(["Making room", "to rest..."]);
    expect(dialLabelLines("Supercalifragilistic expialidocious")).toEqual(["Supercalifr", "agilisti..."]);
    expect(dialLabelLines("  Spaced   out \t label  ")).toEqual(["Spaced out", "label"]);
    for (const label of [CARD_LABELS.longLabel, "x".repeat(160), "word ".repeat(40)]) {
      for (const line of dialLabelLines(label)) expect(Array.from(line).length).toBeLessThanOrEqual(11);
    }
  });

  it("ECC06 Waypoints: one line per current version with its stage, earlier versions most recent first as Earlier version", () => {
    expect(connectedWaypointLines(cardState()).every(line => line.earlier.length === 0)).toBe(true);
    const lines = connectedWaypointLines(cardHistoryState());
    expect(lines.map((line) => [line.current.id, line.current.label, line.earlier.map((version) => [version.id, version.label])])).toEqual([
      [CARD_WAYPOINTS.formed, "Formed", [[CARD_WAYPOINTS.formedEarlier, "Earlier version - Formed"]]],
      [CARD_WAYPOINTS.reached, "Reached", [[CARD_WAYPOINTS.reachedEarlier, "Earlier version - Reached"]]],
      [CARD_WAYPOINTS.released, "Released", [[CARD_WAYPOINTS.releasedEarlier, "Earlier version - Released"]]],
    ]);
    expect(earlierVersionLabel("formed")).toBe("Earlier version - Formed");
    // Release is checked before Reached.
    const released = cardState().waypoints.find((waypoint) => waypoint.id === CARD_WAYPOINTS.released);
    expect(released && waypointStage(released)).toBe("released");
    // A longer line: every earlier version, the most recent first.
    const base = { isCurrent: true, createdAt: "2026-11-03T14:00:00.000Z", sourceMessageId: SOURCE, meaning: "Meaning", arrivalSignal: "Signal", status: "chosen" as const };
    const clarify = (answer: string) => [{ component: "destination" as const, questionKey: "waypoint.destination.v1" as const, answer, recordedAt: "2026-11-03T14:00:00.000Z" }];
    const W = (index: number) => `60000000-0000-4000-8000-00000000000${index}`;
    const chain = bare([], { waypoints: [
      { ...base, isCurrent: false, id: W(1), title: "One", destination: "One" },
      { ...base, isCurrent: false, id: W(2), title: "Two", destination: "Two", lifecycle: { predecessorWaypointId: W(1), creationReason: "revision", clarifications: clarify("Two") } },
      { ...base, id: W(3), title: "Three", destination: "Three", lifecycle: { predecessorWaypointId: W(2), creationReason: "revision", clarifications: clarify("Three") } },
      { ...base, id: W(4), title: "Alone", destination: "Alone" },
    ] });
    expect(parseExplorerWaypointPage({ kind: "history", limit: 20, hasMore: false, nextOffset: null,
      items: chain.waypoints.map(item => ({ ...item, conversationId: chain.conversationId })) })).not.toBeNull();
    expect(connectedWaypointLines(chain).map((line) => [line.current.destination, line.earlier.map((version) => version.destination)])).toEqual([
      ["Three", ["Two", "One"]],
      ["Alone", []],
    ]);
  });

  it("ECC14 compact groups show newest heads first regardless of wire order, preserving microseconds and UUID ties", () => {
    const W = (index: number) => `60000000-0000-4000-8000-00000000000${index}`;
    const waypoint = (index: number, createdAt: string): ExplorerConversationWaypoint => ({
      id: W(index), isCurrent: true, createdAt, sourceMessageId: SOURCE,
      title: `Waypoint ${index}`, destination: `Destination ${index}`, meaning: "Meaning", arrivalSignal: "Signal", status: "chosen",
    });
    // Match SQL: active newest first, then closed newest first, UUID ascending on ties.
    const wireOrder: readonly ExplorerConversationWaypoint[] = Object.freeze([
      waypoint(4, "2026-11-03T14:00:00.123451Z"),
      waypoint(2, "2026-11-03T14:00:00.12345Z"),
      waypoint(3, "2026-11-03T14:00:00.123450+00:00"),
      waypoint(1, "2026-11-03T14:00:00.12Z"),
      { ...waypoint(7, "2026-11-03T14:10:00.000001Z"), status: "reached", reachedEvidence: "Arrived", reachedAt: "2026-11-03T15:00:00Z" },
      { ...waypoint(5, "2026-11-03T14:10:00Z"), status: "reached", reachedEvidence: "Arrived", reachedAt: "2026-11-03T15:00:00Z" },
      { ...waypoint(6, "2026-11-03T14:10:00.000000+00:00"), release: { operationId: "70000000-0000-4000-8000-000000000001", releasedAt: "2026-11-03T15:00:00Z" } },
    ]);
    for (const waypoints of [wireOrder, [...wireOrder].reverse(), [wireOrder[5], wireOrder[2], wireOrder[3], wireOrder[6], wireOrder[0], wireOrder[4], wireOrder[1]]]) {
      const originalIds = waypoints.map(item => item.id);
      const state = bare([], { waypoints, waypointCapacity: { activeCount: 4, activeLimit: 20, historyRoom: true, conversationRoom: true },
        waypointProjection: { kind: "current_heads", limit: 20, totalHeads: 7, hasMore: false } });
      expect(parseExplorerConversationState(state)).not.toBeNull();
      const groups = waypointListGroups(state);
      expect(groups.active.map(line => line.current.id)).toEqual([W(4), W(2), W(3), W(1)]);
      expect(groups.history.map(line => line.current.id)).toEqual([W(7), W(5), W(6)]);
      expect(waypoints.map(item => item.id)).toEqual(originalIds);
      expect(Object.isFrozen(groups.active) && Object.isFrozen(groups.history)).toBe(true);
    }
  });

  it("ECC07 the needle is held by its own flags in a fixed order, never by an unavailable Virtual Guide", () => {
    const state = cardState();
    expect(needleHold(state, OPEN)).toBeNull();
    expect(needleHold({ ...state, providerState: "unavailable" }, OPEN)).toBeNull();
    expect(needleHold(state, { ...OPEN, busy: true })).toBe("busy");
    expect(needleHold(state, { ...OPEN, held: true })).toBe("busy");
    expect(needleHold({ ...state, pendingTurn: true }, { ...OPEN, busy: true })).toBe("pendingTurn");
    expect(needleHold({ ...state, pendingTurn: true }, { ...OPEN, busy: true, uncertain: true })).toBe("uncertain");
    // Fix round 2: ended, uncertain, pending turn and busy come before the End Session review, because
    // "Keep this session open" is disabled while a change is checked or unconfirmed. The screen's held
    // flag is set while that review is open, so it must not come before it.
    expect(needleHold(state, { ...OPEN, uncertain: true, endReviewOpen: true, held: true })).toBe("uncertain");
    expect(needleHold({ ...state, pendingTurn: true }, { ...OPEN, endReviewOpen: true, held: true })).toBe("pendingTurn");
    expect(needleHold(state, { ...OPEN, busy: true, endReviewOpen: true, held: true })).toBe("busy");
    expect(needleHold(state, { ...OPEN, endReviewOpen: true, held: true })).toBe("endReview");
    expect(needleHold(state, { ...OPEN, endReviewOpen: true })).toBe("endReview");
    expect(needleHold(state, { ...OPEN, endReviewOpen: true, ended: true, uncertain: true, busy: true, held: true })).toBe("ended");
    expect(needleHold({ ...state, sessionStatus: "ended" }, OPEN)).toBe("ended");
    expect(Object.keys(NEEDLE_HOLD_TEXT).sort()).toEqual(["busy", "endReview", "ended", "pendingTurn", "uncertain"]);
  });

  it("ECC09 in the narrow drawer a reason that names a control behind it says where it is, with the control's exact label", () => {
    // The controls' labels on the screen: "Retry the same request", "Reload saved conversation", "Keep this session open".
    expect(NEEDLE_HOLD_TEXT.uncertain).toContain("choose Retry the same request");
    expect(NEEDLE_HOLD_TEXT.pendingTurn).toContain("Choose Reload saved conversation to check.");
    expect(NEEDLE_HOLD_TEXT.endReview).toContain("Choose Keep this session open to move it.");
    expect(NEEDLE_HOLD_DRAWER_TEXT).toEqual({
      endReview: "To keep your End Session review accurate, the needle cannot move while that review is open. Close this panel, then choose Keep this session open to move it.",
      uncertain: "To avoid making a change twice, close this panel, then choose Retry the same request before you move the needle.",
      pendingTurn: "To keep your conversation in order, the needle can move again once your last message has a confirmed result. Close this panel, then choose Reload saved conversation to check.",
    });
    for (const hold of ["ended", "uncertain", "pendingTurn", "busy", "endReview"] as const) {
      expect(needleHoldText(hold, false), hold).toBe(NEEDLE_HOLD_TEXT[hold]);
      expect(needleHoldText(hold, true), hold).toBe(hold === "ended" || hold === "busy" ? NEEDLE_HOLD_TEXT[hold] : NEEDLE_HOLD_DRAWER_TEXT[hold]);
    }
    // One reason true for a Reload, a Send and a change alike.
    expect(NEEDLE_HOLD_TEXT.busy).toBe("To keep your conversation in order, the needle can move again once your saved conversation has finished updating.");
    expect(Object.values(NEEDLE_HOLD_TEXT).join(" ")).not.toMatch(/Reload the saved conversation|last change is confirmed/);
    expect(needleMovedText(CARD_LABELS.detour)).toBe("The needle now points to Money worries.");
  });

  it("ECC08 pointing the needle builds exactly the existing set_attention intent, and only for a point that can take it", () => {
    const state = cardState();
    const intent = pointNeedleIntent(state, OPEN, CARD_POINTS.detour);
    expect(intent).toEqual({ kind: "set_attention", itemId: CARD_POINTS.detour });
    expect(Object.keys(intent ?? {}).sort()).toEqual(["itemId", "kind"]);
    // Since the chat card redesign any current point can take the needle, also one without a position on an
    // arranged Compass (the server's rule since migration 20261103180000).
    for (const itemId of [CARD_POINTS.unarranged, CARD_POINTS.otherPath]) {
      const unplaced = pointNeedleIntent(state, OPEN, itemId);
      expect(unplaced, itemId).toEqual({ kind: "set_attention", itemId });
      expect(Object.keys(unplaced ?? {}).sort()).toEqual(["itemId", "kind"]);
    }
    // Already there; a hidden (combined-away) original; an unknown point.
    for (const itemId of [CARD_POINTS.attention, CARD_POINTS.merged, POINT(9)]) {
      expect(pointNeedleIntent(state, OPEN, itemId), itemId).toBeNull();
    }
    // The current point without a position is not offered again.
    expect(pointNeedleIntent({ ...state, attentionId: CARD_POINTS.otherPath }, OPEN, CARD_POINTS.otherPath)).toBeNull();
    for (const flags of [{ ...OPEN, busy: true }, { ...OPEN, uncertain: true }, { ...OPEN, endReviewOpen: true }, { ...OPEN, ended: true }, { ...OPEN, held: true }]) {
      expect(pointNeedleIntent(state, flags, CARD_POINTS.detour)).toBeNull();
      // The same holds apply to the points without a position.
      expect(pointNeedleIntent(state, flags, CARD_POINTS.unarranged)).toBeNull();
      expect(pointNeedleIntent(state, flags, CARD_POINTS.otherPath)).toBeNull();
    }
    expect(pointNeedleIntent({ ...state, pendingTurn: true }, OPEN, CARD_POINTS.detour)).toBeNull();
    expect(pointNeedleIntent({ ...state, sessionStatus: "ended" }, OPEN, CARD_POINTS.detour)).toBeNull();
    expect(pointNeedleIntent({ ...state, conversationId: null }, OPEN, CARD_POINTS.detour)).toBeNull();
    // An unavailable Virtual Guide does not stop it.
    expect(pointNeedleIntent({ ...state, providerState: "unavailable" }, OPEN, CARD_POINTS.priority)).toEqual({ kind: "set_attention", itemId: CARD_POINTS.priority });
  });
});
