// The connected Compass & Waypoint card on /explorer/conversation (chat step
// slices S1 and S2, 2026-11-03): pure mapping from the saved conversation
// state, and the card's fixed wording.
//
// Nothing here fetches, stores or sends anything. The card reads only the
// saved state that ExplorerConversation.tsx already decoded. The one change
// it can ask for is the existing set_attention command (the Explorer points
// the needle), built by buildAttentionFormationIntent, which applies the
// same rule as the server (any current point); ExplorerConversation.tsx keeps
// sending it through its existing command path (hold, retry and expected
// revision).
//
// The 8 positions are the 8 stored anchors. Paul reviewed a 4-zone dial; this
// 8-position drawing is the Executor's design to show him (slice plan F10).
// Older Waypoint wording carries "Earlier version - <stage>" (Paul's
// question 9 decision, decision queue 2026-11-03 12:41:08 CST).
//
// Compact and Full views (2026-11-03; Paul's decision, decision queue
// 16:20:29 CST, and his "Yes, tap the dial" at 16:24:39 CST): the card shows
// one view at a time. The Full view is the dial, where each point drawn on it
// points the needle; the Compact view is the point list. Both show the
// Priority and Current attention lines.
//
// The chat card redesign (Paul's design and decision, decision queue
// 2026-11-03 18:05:33 CST): the needle may point at any current point, placed
// or not (migration 20261103180000 changes the server's rule to match); the
// Full view shows the points without a position in a bottom row under
// Excursion (at most three places, the third "+N more" when there are more);
// a needle on such a point is drawn dashed with the yellow symbol at its tip
// and explains itself on request; and the card's instruction sentences are
// gone, leaving the heading "Point the needle to change topic".

import {
  EXPLORER_COMPASS_ANCHORS,
  type ExplorerCompassAnchor,
  type ExplorerConversationState,
  type ExplorerConversationWaypoint,
} from "./explorerConversationContract";
import {
  buildAttentionFormationIntent,
  currentCompassHeads,
  type ExplorerConversationFormationIntent,
} from "./explorerConversationFormation";
function freeze<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

// ---------------------------------------------------------------- Compass

// Where a saved point is: one of the 8 stored anchors, not yet arranged (no
// placement and no emphasis recorded) or Other paths (emphasis recorded, no
// visible position).
export type CardCompassPlace = ExplorerCompassAnchor | "unarranged" | "otherPaths";

// Whether choosing this point would point the needle at it.
// current: the needle already points here.
// available: the existing set_attention command accepts it. Since the chat
// card redesign (2026-11-03) that is every other current point, placed or
// not, also once a Compass is arranged.
export type CardNeedleChoice = "current" | "available";

export type CardCompassPoint = Readonly<{
  id: string;
  label: string;
  place: CardCompassPlace;
  // Where the dial draws it. The Priority is always drawn at the top, also
  // before any arrangement; points without a position are not drawn.
  dialAnchor: ExplorerCompassAnchor | null;
  isPriority: boolean;
  isAttention: boolean;
  isForming: boolean;
  needle: CardNeedleChoice;
}>;

export type CardCompass = Readonly<{
  // Every current point (merged originals hidden): dial points first in
  // anchor order, then the points not yet arranged, then Other paths.
  points: readonly CardCompassPoint[];
  priority: CardCompassPoint | null;
  attention: CardCompassPoint | null;
  // Once any current point has a recorded emphasis, the Compass is arranged.
  arranged: boolean;
}>;

function placeOf(anchor: ExplorerCompassAnchor | null | undefined, emphasis: number | null | undefined): CardCompassPlace {
  if (anchor != null) return anchor;
  return emphasis == null ? "unarranged" : "otherPaths";
}

export function connectedCompass(state: ExplorerConversationState): CardCompass {
  const heads = currentCompassHeads(state);
  const arranged = heads.some((item) => item.emphasis != null);
  const mapped = heads.map((item): CardCompassPoint => {
    const place = placeOf(item.anchor, item.emphasis);
    const isPriority = item.id === state.priorityId;
    const isAttention = item.id === state.attentionId;
    const dialAnchor = place === "unarranged" || place === "otherPaths" ? (isPriority ? "apex" : null) : place;
    const needle: CardNeedleChoice = isAttention ? "current" : "available";
    return freeze({ id: item.id, label: item.label, place, dialAnchor, isPriority, isAttention, isForming: item.formation === "forming", needle });
  });
  const rank = (point: CardCompassPoint) =>
    point.dialAnchor !== null
      ? EXPLORER_COMPASS_ANCHORS.indexOf(point.dialAnchor)
      : point.place === "unarranged"
        ? EXPLORER_COMPASS_ANCHORS.length
        : EXPLORER_COMPASS_ANCHORS.length + 1;
  // A stable sort keeps the saved order inside each group.
  const points = [...mapped].sort((a, b) => rank(a) - rank(b));
  return freeze({
    points: freeze(points),
    priority: points.find((point) => point.isPriority) ?? null,
    attention: points.find((point) => point.isAttention) ?? null,
    arranged,
  });
}

// The names of the 8 positions, as the current tools name them, with an
// ASCII comma instead of their dash.
export const COMPASS_POSITION_NAMES: Readonly<Record<ExplorerCompassAnchor, string>> = freeze({
  apex: "Top position",
  upper_left: "Upper left",
  upper_right: "Upper right",
  side_left: "Detour, left",
  side_right: "Detour, right",
  lower_left: "Excursion, lower left",
  lower_center: "Excursion, lower center",
  lower_right: "Excursion, lower right",
});

// The short line under a point in the list.
export function compassPlaceText(point: CardCompassPoint): string {
  if (point.isPriority) return "Priority";
  if (point.place === "unarranged") return "Not yet arranged";
  if (point.place === "otherPaths") return "Other paths";
  return COMPASS_POSITION_NAMES[point.place];
}

// A label fitted into a dial bubble: at most two lines of `width`
// characters, broken at a space where possible, the second line shortened
// with ASCII "..." when the label is longer. The full label is always the
// start of the point's button name on the dial, and is shown whole in the
// Compact view's list.
export function dialLabelLines(label: string, width = 11): readonly string[] {
  const breakAt = (chars: readonly string[], limit: number) => {
    const space = chars.lastIndexOf(" ", limit);
    return space > 0 ? space : limit;
  };
  const chars = Array.from(label.replace(/\s+/g, " ").trim());
  if (chars.length <= width) return freeze([chars.join("")]);
  const cut = breakAt(chars, width);
  const first = chars.slice(0, cut).join("").trimEnd();
  const rest = Array.from(chars.slice(cut).join("").trimStart());
  if (rest.length <= width) return freeze([first, rest.join("")]);
  const shortened = rest.slice(0, breakAt(rest, width - 3)).join("").trimEnd();
  return freeze([first, `${shortened}...`]);
}

// The points drawn on the dial, in anchor order, and the points that are not
// (not yet arranged, or Other paths), which the bottom row and the Compact
// view show.
export function dialPoints(compass: CardCompass): readonly CardCompassPoint[] {
  return freeze(compass.points.filter((point) => point.dialAnchor !== null));
}

export function pointsOffDial(compass: CardCompass): readonly CardCompassPoint[] {
  return freeze(compass.points.filter((point) => point.dialAnchor === null));
}

// One place in the Full view's bottom row: a point without a position, or,
// in the third place when there are more than three, "+N more".
export type CardRowEntry =
  | Readonly<{ kind: "point"; point: CardCompassPoint }>
  | Readonly<{ kind: "more"; count: number }>;

export const BOTTOM_ROW_PLACES = 3;

// The bottom row (Paul's design, 2026-11-03): "the lowest positions", under
// Excursion, for the points the dial does not place, in their saved order
// (not yet arranged first, then Other paths). Up to three show; with more,
// two show and the third place is "+N more", which opens the Compact view. A
// point the needle points at always shows: when it is not one of the first
// two, it takes the second place, so the row never moves under a tap.
export function bottomRow(compass: CardCompass): readonly CardRowEntry[] {
  const off = pointsOffDial(compass);
  const entry = (point: CardCompassPoint): CardRowEntry => freeze({ kind: "point", point });
  if (off.length <= BOTTOM_ROW_PLACES) return freeze(off.map(entry));
  const needleAt = off.findIndex((point) => point.isAttention);
  const shown = needleAt < 2 ? off.slice(0, 2) : [off[0], off[needleAt]];
  return freeze([...shown.map(entry), freeze({ kind: "more", count: off.length - shown.length })]);
}

// A label fitted into one place of the bottom row: one line of `width`
// characters, cut at a space where possible and ended with ASCII "...". The
// full label is the start of the place's button name and shows whole in the
// Compact view.
export function bottomRowLabel(label: string, width = 20): string {
  const chars = Array.from(label.replace(/\s+/g, " ").trim());
  if (chars.length <= width) return chars.join("");
  const space = chars.lastIndexOf(" ", width - 3);
  return `${chars.slice(0, space > 0 ? space : width - 3).join("").trimEnd()}...`;
}

export function bottomRowMoreText(count: number): string {
  return `+${count} more`;
}

// What screen readers hear after "+N more": the button opens the Compact view.
export function bottomRowMoreSuffix(count: number): string {
  return ` ${count === 1 ? "point" : "points"}, shown in the Compact view`;
}

// What the dial picture says to a screen reader: the points on the dial, the
// bottom row's points, how many more the Compact view lists, and the needle.
export function describeConnectedCompass(compass: CardCompass): string {
  const parts: string[] = [];
  for (const point of dialPoints(compass)) {
    if (point.dialAnchor === null) continue;
    parts.push(`${point.isPriority ? "Priority" : COMPASS_POSITION_NAMES[point.dialAnchor]}: ${point.label}${point.isForming ? " (Forming)" : ""}.`);
  }
  if (compass.priority === null) parts.push("No Priority is confirmed yet.");
  for (const entry of bottomRow(compass)) {
    parts.push(
      entry.kind === "point"
        ? `${compassPlaceText(entry.point)}: ${entry.point.label}${entry.point.isForming ? " (Forming)" : ""}.`
        : `${entry.count} more ${entry.count === 1 ? "point is" : "points are"} listed in the Compact view.`,
    );
  }
  const attention = compass.attention;
  parts.push(
    attention === null
      ? "The needle has no direction yet."
      : attention.dialAnchor !== null
        ? `The needle points to ${attention.label}.`
        : attention.place === "otherPaths"
          ? `The needle points to ${attention.label}, which is in Other paths, off your Compass.`
          : `The needle points to ${attention.label}, which is not placed on your Compass yet.`,
  );
  return parts.join(" ");
}

// Which of the card's two views shows: the dial (Full) or the point list
// (Compact). Screen state only, never saved.
export type CardCompassView = "full" | "compact";

// The dashed needle (Paul's design, 2026-11-03): a needle on a point without
// a position is drawn dashed with the yellow symbol at its tip. It is a
// button; a tap shows one short sentence, and the next tap hides it. In the
// narrow drawer the current tools are behind the panel, so the sentence says
// so; after End the tools are read-only, so it gives no instruction.
export const DASHED_NEEDLE_WORDING = freeze({
  button: "Why the needle is dashed",
  unarranged: "This point isn't placed on your Compass yet. To place it, use Review Compass arrangement in your current tools.",
  unarrangedDrawer:
    "This point isn't placed on your Compass yet. To place it, close this panel, then use Review Compass arrangement in your current tools.",
  unarrangedEnded: "This point isn't placed on your Compass.",
  otherPaths: "This point is in Other paths, off your Compass.",
});

export function dashedNeedleText(point: CardCompassPoint, inDrawer: boolean, ended: boolean): string {
  const W = DASHED_NEEDLE_WORDING;
  if (point.place === "otherPaths") return W.otherPaths;
  if (ended) return W.unarrangedEnded;
  return inDrawer ? W.unarrangedDrawer : W.unarranged;
}

// Why no point can take the needle right now, if anything holds it. Each
// comes from its own flag; an unavailable Virtual Guide or a full
// conversation does not hold the needle.
export type NeedleHold = "ended" | "uncertain" | "pendingTurn" | "busy" | "endReview";

export type NeedleHoldFlags = Readonly<{
  ended: boolean;
  endReviewOpen: boolean;
  uncertain: boolean;
  busy: boolean;
  held: boolean;
}>;

// The End Session review comes last (fix round 2, 2026-11-03): its reason
// names "Keep this session open", which is disabled while a change is checked
// or unconfirmed, so a busy or uncertain hold is said first. The screen's
// `held` flag is also set while that review is open, so it only stands in
// for "busy" after the review has been checked.
export function needleHold(state: ExplorerConversationState, flags: NeedleHoldFlags): NeedleHold | null {
  if (flags.ended || state.sessionStatus === "ended") return "ended";
  if (flags.uncertain) return "uncertain";
  if (state.pendingTurn) return "pendingTurn";
  if (flags.busy) return "busy";
  if (flags.endReviewOpen) return "endReview";
  if (flags.held) return "busy";
  return null;
}

// The existing set_attention intent for a chosen point, or null when the
// needle is held, the point is already the current one, or it is not a
// current point (buildAttentionFormationIntent, which since 2026-11-03 takes
// any current point, placed or not).
export function pointNeedleIntent(
  state: ExplorerConversationState,
  flags: NeedleHoldFlags,
  itemId: string,
): ExplorerConversationFormationIntent | null {
  if (state.conversationId === null || needleHold(state, flags) !== null) return null;
  const result = buildAttentionFormationIntent(state, itemId);
  return result.ok ? result.command : null;
}

export const CONNECTED_COMPASS_WORDING = freeze({
  heading: "Compass",
  dialTitle: "Your Compass",
  emptyLead: "Discovering what matters",
  empty: "No Compass point is saved yet. Your Compass can stay empty while you explore.",
  notLoaded: "Your saved Compass is shown here when your saved conversation is available.",
  priorityTerm: "Priority:",
  priorityNone: "None confirmed yet",
  priorityConfirmed: "(confirmed by you)",
  needleTerm: "Current attention:",
  needleNone: "No point chosen yet",
  // Paul's words (2026-11-03): "Just say "Point the needle to change topic"."
  // The instruction sentence under it and the placement paragraph are gone.
  chooseHeading: "Point the needle to change topic",
  placedGroup: "On your Compass",
  unarrangedGroup: "Not yet arranged",
  otherPathsGroup: "Other paths",
  needleHere: "The needle points here",
  forming: "Forming",
  apexNotPriority: "Not your Priority until you confirm it",
  // The view switch: its visible label names the view it switches to, and
  // screen readers hear " of the Compass" after it.
  compactViewButton: "Compact view",
  fullViewButton: "Full view",
  viewButtonSuffix: " of the Compass",
});

// In an ended conversation this is the card's one line about the needle.
export const NEEDLE_HOLD_TEXT: Readonly<Record<NeedleHold, string>> = freeze({
  ended: "This conversation has ended, so its Compass is kept as it was and the needle cannot move.",
  endReview:
    "To keep your End Session review accurate, the needle cannot move while that review is open. Choose Keep this session open to move it.",
  uncertain: "To avoid making a change twice, choose Retry the same request before you move the needle.",
  pendingTurn:
    "To keep your conversation in order, the needle can move again once your last message has a confirmed result. Choose Reload saved conversation to check.",
  busy: "To keep your conversation in order, the needle can move again once your saved conversation has finished updating.",
});

// On a narrow screen the card is in the modal Compass & Waypoint drawer and
// these controls are behind it, so the reason says where they are.
export const NEEDLE_HOLD_DRAWER_TEXT: Readonly<Record<"endReview" | "uncertain" | "pendingTurn", string>> = freeze({
  endReview:
    "To keep your End Session review accurate, the needle cannot move while that review is open. Close this panel, then choose Keep this session open to move it.",
  uncertain:
    "To avoid making a change twice, close this panel, then choose Retry the same request before you move the needle.",
  pendingTurn:
    "To keep your conversation in order, the needle can move again once your last message has a confirmed result. Close this panel, then choose Reload saved conversation to check.",
});

export function needleHoldText(hold: NeedleHold, inDrawer: boolean): string {
  if (inDrawer && (hold === "endReview" || hold === "uncertain" || hold === "pendingTurn")) return NEEDLE_HOLD_DRAWER_TEXT[hold];
  return NEEDLE_HOLD_TEXT[hold];
}

// The card's live line after the saved needle moves.
export function needleMovedText(label: string): string {
  return `The needle now points to ${label}.`;
}

// --------------------------------------------------------------- Waypoints

export type CardWaypointStage = "formed" | "reached" | "released";

export const WAYPOINT_STAGE_NAMES: Readonly<Record<CardWaypointStage, string>> = freeze({
  formed: "Formed",
  reached: "Reached",
  released: "Released",
});

export type CardWaypointVersion = Readonly<{
  id: string;
  title?: string;
  destination: string;
  meaning: string;
  arrivalSignal: string;
  stage: CardWaypointStage;
  earlier: boolean;
  // "Formed", "Reached" or "Released"; "Earlier version - <stage>" for older wording.
  label: string;
}>;

export type CardWaypointLine = Readonly<{
  current: CardWaypointVersion;
  // The earlier versions, the most recent first.
  earlier: readonly CardWaypointVersion[];
}>;

// Release is checked before Reached: a released Waypoint keeps its chosen
// status with release details added.
export function waypointStage(waypoint: ExplorerConversationWaypoint): CardWaypointStage {
  if (waypoint.release !== undefined) return "released";
  return waypoint.status === "reached" ? "reached" : "formed";
}

export function earlierVersionLabel(stage: CardWaypointStage): string {
  return `Earlier version - ${WAYPOINT_STAGE_NAMES[stage]}`;
}

function version(waypoint: ExplorerConversationWaypoint, earlier: boolean): CardWaypointVersion {
  const stage = waypointStage(waypoint);
  return freeze({
    id: waypoint.id,
    ...(waypoint.title === undefined ? {} : { title: waypoint.title }),
    destination: waypoint.destination,
    meaning: waypoint.meaning,
    arrivalSignal: waypoint.arrivalSignal,
    stage,
    earlier,
    label: earlier ? earlierVersionLabel(stage) : WAYPOINT_STAGE_NAMES[stage],
  });
}

// One line per Waypoint: its current version (a version no later version
// replaced), in saved order, with the versions it replaced.
export function connectedWaypointLines(state: ExplorerConversationState): readonly CardWaypointLine[] {
  const byId = new Map(state.waypoints.map((waypoint) => [waypoint.id, waypoint]));
  const replaced = new Set(state.waypoints.flatMap((waypoint) => (waypoint.lifecycle === undefined ? [] : [waypoint.lifecycle.predecessorWaypointId])));
  const lines: CardWaypointLine[] = [];
  for (const waypoint of state.waypoints) {
    if (replaced.has(waypoint.id)) continue;
    const earlier: CardWaypointVersion[] = [];
    const seen = new Set([waypoint.id]);
    let previous = waypoint.lifecycle === undefined ? undefined : byId.get(waypoint.lifecycle.predecessorWaypointId);
    while (previous !== undefined && !seen.has(previous.id)) {
      seen.add(previous.id);
      earlier.push(version(previous, true));
      previous = previous.lifecycle === undefined ? undefined : byId.get(previous.lifecycle.predecessorWaypointId);
    }
    lines.push(freeze({ current: version(waypoint, false), earlier: freeze(earlier) }));
  }
  return freeze(lines);
}

export const CONNECTED_WAYPOINT_WORDING = freeze({
  heading: "Waypoints",
  eyebrow: "Waypoint",
  empty: "No Waypoint is chosen yet. You can keep exploring without one.",
  notLoaded: "Your saved Waypoints are shown here when your saved conversation is available.",
  meaningTerm: "Why it matters",
  destinationTerm: "Where you're heading",
  arrivalTerm: "Reached looks like",
  earlierHeading: "Earlier versions, kept in your private history",
});

// The compact Waypoint list (lane 8; Paul's decision, decision queue 2026-11-05
// 19:38:45 CST, point 4, after GPT-6 Astra's research REV276 A3): three compact
// rows at first, expandable to five, the rest on request, one detailed card open
// at a time; a forming draft takes one row; Reached and Released Waypoints sit in
// a collapsed group. Paul approved the design, with the newest first and the forming
// Waypoint shown here too, on 2026-11-06 at 08:59:55 CST.
export const WAYPOINT_LIST_ROWS = freeze({ initial: 3, expanded: 5 });
export type WaypointListSize = "initial" | "expanded" | "all";

export const WAYPOINT_LIST_WORDING = freeze({
  showMore: (count: number) => `Show ${count} more`,
  showAll: (count: number) => `Show all ${count}`,
  showFewer: "Show fewer",
  history: (count: number) => `Reached and released (${count})`,
});

export type WaypointListGroups = Readonly<{
  // Formed (still active) Waypoints, the newest first.
  active: readonly CardWaypointLine[];
  // Reached and Released Waypoints, the newest first.
  history: readonly CardWaypointLine[];
}>;

// The saved order is oldest first (by when each current version was saved), so
// the list reverses it.
export function waypointListGroups(state: ExplorerConversationState): WaypointListGroups {
  const newestFirst = [...connectedWaypointLines(state)].reverse();
  return freeze({
    active: freeze(newestFirst.filter((line) => line.current.stage === "formed")),
    history: freeze(newestFirst.filter((line) => line.current.stage !== "formed")),
  });
}

export function waypointRowsShown(total: number, size: WaypointListSize): number {
  return size === "all" ? total : Math.min(total, WAYPOINT_LIST_ROWS[size]);
}

// The next "show more" step for a list of `total` rows, or null when every row shows.
export function waypointListNextSize(total: number, size: WaypointListSize): Readonly<{ size: WaypointListSize; label: string }> | null {
  if (size === "initial" && total > WAYPOINT_LIST_ROWS.initial) {
    return freeze({ size: "expanded", label: WAYPOINT_LIST_WORDING.showMore(Math.min(total, WAYPOINT_LIST_ROWS.expanded) - WAYPOINT_LIST_ROWS.initial) });
  }
  if (size === "expanded" && total > WAYPOINT_LIST_ROWS.expanded) {
    return freeze({ size: "all", label: WAYPOINT_LIST_WORDING.showAll(total) });
  }
  return null;
}

export const CONNECTED_KEY_INSIGHT_HEADING = "Key Insight";
