import { Fragment, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import {
  CONNECTED_COMPASS_WORDING,
  DASHED_NEEDLE_WORDING,
  bottomRow,
  bottomRowLabel,
  bottomRowMoreSuffix,
  bottomRowMoreText,
  compassPlaceText,
  connectedCompass,
  dashedNeedleText,
  describeConnectedCompass,
  dialLabelLines,
  dialPoints,
  needleHoldText,
  needleMovedText,
  type CardCompass,
  type CardCompassPoint,
  type CardCompassView,
  type CardRowEntry,
  type NeedleHold,
} from "@/lib/solmind/explorerConnectedCard";
import {
  EXPLORER_COMPASS_ANCHORS,
  type ExplorerCompassAnchor,
  type ExplorerConversationState,
} from "@/lib/solmind/explorerConversationContract";

import { IconCompass } from "./ExplorerConversationScreenIcons";
import { FOCUS_RING, QUIET_BUTTON, joinClasses } from "./ExplorerConversationScreenNotYetImplemented";

// The connected Compass card (chat step slices S1 and S2): the Explorer's
// saved Compass drawn on 8 positions in the look of the reviewed dial
// (ExplorerConversationScreenCompassDial.tsx: the glowing ring, the
// Priority-up frame that never rotates, labelled bubbles, the amber Priority
// and the orange needle), and every current point in a list. Choosing a
// point asks the parent to point the needle there with the existing
// set_attention command; this file sends nothing itself.
//
// Compact and Full views (2026-11-03; Paul's decisions, decision queue
// 16:20:29 and 16:24:39 CST): the card shows one view at a time, to save
// space, with a button to switch, as the review version does. The Full view
// is the dial with the Priority and Current attention lines; each point drawn
// on the dial is a button over its bubble that points the needle with the
// same rules, holds, reasons, live line and focus as the list. The Compact
// view is the point list with the same two lines. Which view shows is the
// parent's screen state, kept separately for the wide panel and the phone
// drawer.
//
// Fix round 2 (2026-11-03): a polite live line in the card states a hold's
// reason when it starts and the result after the saved needle moves, because
// on a narrow screen the card sits in a modal drawer and the page's own
// status line is behind it. After a move the Explorer asked for here is
// confirmed, focus goes to the "Current attention" line, since the chosen
// button is then disabled as the current point. In an ended conversation the
// card says only that the Compass is kept as it was.
//
// Fix round 3 (2026-11-03): that line is live only in the drawer. On the wide
// panel the page's own status line is not hidden and already says when a
// change, a reply or a reload is under way, so the panel shows the same line
// without announcing it.
//
// The chat card redesign (Paul's design and decision, decision queue
// 2026-11-03 18:05:33 CST, to cut clutter): the needle may point at any
// current point. The Full view puts the points without a position (not yet
// arranged, Other paths) in "the lowest positions": a row under Excursion in
// grey, each with one small yellow symbol, at most three, the third "+N more"
// (which opens the Compact view) when there are more; each is a button with
// the dial's rules. A needle on such a point is drawn dashed with the yellow
// symbol at its tip; it is a button whose tap shows one short sentence and
// whose next tap hides it. The Compact view's unplaced points are grey with
// the same symbol. The heading is "Point the needle to change topic", with no
// instruction under it, and the card no longer has the two "Not connected
// yet" notes (forming points, the needle following the conversation): Paul
// removed them, a dated exception in AGENTS.md. The SVG's acknowledgement of
// a move is a later slice (S3 and S4).

const W = CONNECTED_COMPASS_WORDING;
const CENTER = { x: 180, y: 150 };
const RING_RADIUS = 124;
const POSITION_RADIUS = 92;
const BUBBLE_RADIUS = 28;
// Clockwise from the top, 45 degrees apart; the frame never rotates.
const ANCHOR_ANGLES: Readonly<Record<ExplorerCompassAnchor, number>> = {
  apex: -90,
  upper_right: -45,
  side_right: 0,
  lower_right: 45,
  lower_center: 90,
  lower_left: 135,
  side_left: 180,
  upper_left: -135,
};

type Point = Readonly<{ x: number; y: number }>;

function positionOf(anchor: ExplorerCompassAnchor): Point {
  const radians = (ANCHOR_ANGLES[anchor] * Math.PI) / 180;
  return {
    x: Math.round((CENTER.x + POSITION_RADIUS * Math.cos(radians)) * 100) / 100,
    y: Math.round((CENTER.y + POSITION_RADIUS * Math.sin(radians)) * 100) / 100,
  };
}

function needleEnd(anchor: ExplorerCompassAnchor): Point {
  const point = positionOf(anchor);
  const dx = point.x - CENTER.x;
  const dy = point.y - CENTER.y;
  const distance = Math.hypot(dx, dy);
  const scale = (distance - BUBBLE_RADIUS - 4) / distance;
  return { x: CENTER.x + dx * scale, y: CENTER.y + dy * scale };
}

// The point `length` from the centre toward `target`, to two decimals.
function towardTarget(target: Point, length: number): Point {
  const dx = target.x - CENTER.x;
  const dy = target.y - CENTER.y;
  const distance = Math.hypot(dx, dy);
  return {
    x: Math.round((CENTER.x + (dx * length) / distance) * 100) / 100,
    y: Math.round((CENTER.y + (dy * length) / distance) * 100) / 100,
  };
}

// The dial is drawn in a 360 by 336 box: the ring and its bubbles as before,
// and under EXCURSION the bottom row. A button sits over each bubble and each
// row place at the same place, as a share of the drawn width and height.
const VIEW_WIDTH = 360;
const VIEW_HEIGHT = 336;
const share = (value: number, of: number) => `${Math.round((value / of) * 100_000) / 1000}%`;

// The bottom row: each place's yellow symbol, its grey label under it, and
// the button over both. One, two or three places, spread across the row.
const ROW_SYMBOL_Y = 308;
const ROW_TEXT_Y = 325;
const ROW_PLACE = { y: 315, width: 112, height: 30 } as const;
const ROW_PLACES_X: readonly (readonly number[])[] = [[], [180], [120, 240], [60, 180, 300]];
const SYMBOL_RADIUS = 5;
// The dashed needle stops 52 from the centre, inside the ring of bubbles
// (their inner edge is 64 out), with the symbol at its tip; its button is a
// 34 square centred 30 along it, clear of the bubbles' buttons.
const DASHED_LENGTH = 52;
const DASHED_BUTTON = { along: 30, size: 34 } as const;

function rowPlacesX(count: number): readonly number[] {
  return ROW_PLACES_X[Math.min(count, ROW_PLACES_X.length - 1)];
}

// Where the dashed needle aims: the symbol of the row place that holds the
// needle's point, when that point has no position on the dial.
function dashedTarget(compass: CardCompass, row: readonly CardRowEntry[]): Point | null {
  const attention = compass.attention;
  if (attention === null || attention.dialAnchor !== null) return null;
  const index = row.findIndex((entry) => entry.kind === "point" && entry.point.id === attention.id);
  return index < 0 ? null : { x: rowPlacesX(row.length)[index], y: ROW_SYMBOL_Y };
}

// The small yellow symbol, the same for a point not yet arranged and an
// Other paths point.
function SymbolMark({ at }: Readonly<{ at: Point }>) {
  const r = SYMBOL_RADIUS;
  return <path className="fill-yellow-300" d={`M${at.x} ${at.y - r}L${at.x + r} ${at.y}L${at.x} ${at.y + r}L${at.x - r} ${at.y}Z`} />;
}

type DialProps = Readonly<{ scope: string; compass: CardCompass; row: readonly CardRowEntry[]; children?: ReactNode }>;

// The dial picture; in the Full view the buttons (children) are laid over it.
// The picture itself is an image with its own description, so it holds no
// control.
function Dial({ scope, compass, row, children }: DialProps) {
  const titleId = `${scope}-connected-compass-dial-title`;
  const descId = `${scope}-connected-compass-dial-desc`;
  const glowId = `${scope}-connected-compass-dial-glow`;
  const byAnchor = new Map(compass.points.flatMap((point) => (point.dialAnchor === null ? [] : [[point.dialAnchor, point] as const])));
  const needleAt = compass.attention?.dialAnchor ?? null;
  const end = needleAt === null ? null : needleEnd(needleAt);
  const target = dashedTarget(compass, row);
  const dashedEnd = target === null ? null : towardTarget(target, DASHED_LENGTH);
  const places = rowPlacesX(row.length);

  return (
    <div className="relative mx-auto w-full max-w-[21rem]">
      <svg
        aria-describedby={descId}
        aria-labelledby={titleId}
        className="block h-auto w-full"
        role="img"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      >
        <title id={titleId}>{W.dialTitle}</title>
        <desc id={descId}>{describeConnectedCompass(compass)}</desc>
        <defs>
          <radialGradient cx="50%" cy="50%" id={glowId} r="50%">
            <stop offset="0%" stopColor="rgba(245,158,11,0.16)" />
            <stop offset="100%" stopColor="rgba(5,4,3,0.9)" />
          </radialGradient>
        </defs>
        <circle className="stroke-amber-200/30" cx={CENTER.x} cy={CENTER.y} fill={`url(#${glowId})`} r={RING_RADIUS} strokeWidth={1.5} />
        <line className="stroke-stone-700" x1={CENTER.x} x2={CENTER.x} y1={CENTER.y - RING_RADIUS + 4} y2={CENTER.y + RING_RADIUS - 4} />
        <line className="stroke-stone-700" x1={CENTER.x - RING_RADIUS + 4} x2={CENTER.x + RING_RADIUS - 4} y1={CENTER.y} y2={CENTER.y} />
        <text className="fill-stone-400 text-[9px] tracking-[0.18em]" textAnchor="middle" x={CENTER.x} y={16}>
          PRIORITY
        </text>
        <text className="fill-stone-400 text-[9px] tracking-[0.12em]" textAnchor="middle" x={28} y={153}>
          DETOUR
        </text>
        <text className="fill-stone-400 text-[9px] tracking-[0.12em]" textAnchor="middle" x={332} y={153}>
          DETOUR
        </text>
        <text className="fill-stone-400 text-[9px] tracking-[0.18em]" textAnchor="middle" x={CENTER.x} y={292}>
          EXCURSION
        </text>
        {/* The 8 stored positions; an empty one is a faint ring. */}
        {EXPLORER_COMPASS_ANCHORS.map((anchor) => {
          const at = positionOf(anchor);
          return byAnchor.has(anchor) ? null : (
            <circle className="fill-stone-950/40 stroke-stone-800" cx={at.x} cy={at.y} key={anchor} r={BUBBLE_RADIUS} strokeWidth={1} />
          );
        })}
        {end ? (
          <line className="stroke-orange-300" strokeLinecap="round" strokeWidth={3} x1={CENTER.x} x2={end.x} y1={CENTER.y} y2={end.y} />
        ) : null}
        {/* A needle on a point without a position: a few dashes toward its row place. */}
        {dashedEnd ? (
          <line
            className="stroke-orange-300"
            strokeDasharray="8 6"
            strokeLinecap="butt"
            strokeWidth={3}
            x1={CENTER.x}
            x2={dashedEnd.x}
            y1={CENTER.y}
            y2={dashedEnd.y}
          />
        ) : null}
        <circle className="fill-orange-200" cx={CENTER.x} cy={CENTER.y} r={4.5} />
        {dashedEnd ? <SymbolMark at={dashedEnd} /> : null}
        {[...byAnchor].map(([anchor, point]) => {
          const at = positionOf(anchor);
          const lines = dialLabelLines(point.label);
          const top = (lines.length === 1 ? at.y + 3 : at.y - 3) - (point.isForming ? 5 : 0);
          return (
            <g key={point.id}>
              <circle
                className={joinClasses(
                  point.isPriority ? "fill-amber-400/25" : "fill-stone-900/90",
                  point.isAttention ? "stroke-orange-300" : point.isPriority ? "stroke-amber-300" : "stroke-stone-600",
                )}
                cx={at.x}
                cy={at.y}
                r={BUBBLE_RADIUS}
                strokeDasharray={point.isForming ? "4 3" : undefined}
                strokeWidth={point.isAttention || point.isPriority ? 2.5 : 1.2}
              />
              <text className="fill-stone-100 text-[9px] font-medium" textAnchor="middle" x={at.x} y={top}>
                {lines.map((line, index) => (
                  <tspan dy={index === 0 ? 0 : 11} key={index} x={at.x}>
                    {line}
                  </tspan>
                ))}
              </text>
              {point.isForming ? (
                <text className="fill-stone-300 text-[8px]" textAnchor="middle" x={at.x} y={at.y + 18}>{W.forming}</text>
              ) : null}
            </g>
          );
        })}
        {/* The bottom row: the points without a position, in grey with the yellow symbol; the one the
            needle points at has an orange ring, like the attention bubble. */}
        {row.map((entry, index) => {
          const x = places[index];
          return entry.kind === "point" ? (
            <Fragment key={entry.point.id}>
              {entry.point.isForming ? (
                <rect className="fill-none stroke-stone-500" height={35} rx={6} strokeDasharray="4 3" width={108} x={x - 54} y={299} />
              ) : null}
              {entry.point.isAttention ? (
                <circle className="fill-none stroke-orange-300" cx={x} cy={ROW_SYMBOL_Y} r={8.5} strokeWidth={1.5} />
              ) : null}
              <SymbolMark at={{ x, y: ROW_SYMBOL_Y }} />
              <text className="fill-stone-400 text-[9px]" textAnchor="middle" x={x} y={entry.point.isForming ? ROW_TEXT_Y - 5 : ROW_TEXT_Y}>
                {bottomRowLabel(entry.point.label)}
              </text>
              {entry.point.isForming ? (
                <text className="fill-stone-300 text-[8px]" textAnchor="middle" x={x} y={331}>{W.forming}</text>
              ) : null}
            </Fragment>
          ) : (
            <text className="fill-stone-400 text-[9px]" key="more" textAnchor="middle" x={x} y={ROW_TEXT_Y}>
              {bottomRowMoreText(entry.count)}
            </text>
          );
        })}
      </svg>
      {children}
    </div>
  );
}

type LiveResult = Readonly<{ seen: string | null | undefined; held: boolean; text: string }>;

// What the live line says when no hold is shown: "The needle now points to X."
// once the saved attention changes while the card is shown (not when the card
// first shows a saved Compass). A new hold clears it, so an old result is not
// said again when that hold ends. The state is adjusted during render, as
// React does for a value that follows a prop.
function useNeedleResult(compass: CardCompass | null, held: boolean): string {
  const [live, setLive] = useState<LiveResult>({ seen: undefined, held, text: "" });
  let next = live;
  if (held !== next.held) next = { seen: next.seen, held, text: held ? "" : next.text };
  const attention = compass?.attention ?? null;
  const attentionId = attention?.id ?? null;
  if (compass !== null && next.seen !== attentionId) {
    next = { seen: attentionId, held: next.held, text: next.seen === undefined || attention === null ? "" : needleMovedText(attention.label) };
  }
  if (next !== live) setLive(next);
  return next.text;
}

// Whether the dashed needle's sentence shows: a tap on the dashed needle
// shows it, the next tap hides it, and it hides when the needle moves. Screen
// state only, adjusted during render like the live line.
function useDashedNeedleSentence(attention: CardCompassPoint | null) {
  const [openFor, setOpenFor] = useState<string | null>(null);
  const unplaced = attention !== null && attention.dialAnchor === null ? attention.id : null;
  if (openFor !== null && openFor !== unplaced) setOpenFor(null);
  return {
    open: openFor !== null && openFor === unplaced,
    toggle: () => setOpenFor((open) => (open === null ? unplaced : null)),
  };
}

// The ids of the card's parts, one set per scope (the wide panel or the drawer).
type CardIds = Readonly<{
  title: string;
  view: string;
  choose: string;
  hold: string;
  current: string;
  live: string;
  why: string;
}>;

function cardIds(scope: string): CardIds {
  return {
    title: `${scope}-connected-compass-title`,
    view: `${scope}-connected-compass-view`,
    choose: `${scope}-connected-needle-heading`,
    hold: `${scope}-connected-needle-hold`,
    current: `${scope}-connected-needle-current`,
    live: `${scope}-connected-needle-live`,
    why: `${scope}-connected-needle-why`,
  };
}

// Whether a point can take the needle now, and the sentence that says why
// not. The dial, the bottom row and the list use the same rule: a held
// needle and the current point cannot; any other current point can.
type NeedleChoice = Readonly<{ disabled: boolean; describedBy: string | undefined }>;

function needleChoice(point: CardCompassPoint, hold: NeedleHold | null, ids: CardIds): NeedleChoice {
  return {
    disabled: hold !== null || point.needle !== "available",
    describedBy: hold !== null ? ids.hold : undefined,
  };
}

// The small yellow symbol in the list, beside the label of a point without a
// position. Screen readers hear the point's place instead.
function UnplacedSymbol() {
  return (
    <svg aria-hidden="true" className="h-2.5 w-2.5 shrink-0 fill-yellow-300" focusable="false" viewBox="0 0 10 10">
      <path d="M5 0L10 5L5 10L0 5Z" />
    </svg>
  );
}

// A point's name: its label, where it is, and what is true of it. The list
// shows these parts; on the dial and in the bottom row, which show the label,
// they are the button's name for screen readers. The spaces between the parts
// are not drawn in the list's flex column, but they keep the words apart in
// the name.
function PointName({ point, symbol = false }: Readonly<{ point: CardCompassPoint; symbol?: boolean }>) {
  const label = <span className="font-medium [overflow-wrap:anywhere]">{point.label}</span>;
  return (
    <>
      {symbol ? (
        <span className="flex items-center gap-1.5">
          <UnplacedSymbol />
          {label}
        </span>
      ) : (
        label
      )}{" "}
      <span className="text-[11px] text-stone-300">{compassPlaceText(point)}</span>
      {point.isForming ? (
        <>
          {" "}
          <span className="text-[11px] text-stone-300">{W.forming}</span>
        </>
      ) : null}
      {point.dialAnchor === "apex" && !point.isPriority ? (
        <>
          {" "}
          <span className="text-[11px] text-amber-200">{W.apexNotPriority}</span>
        </>
      ) : null}
      {point.isAttention ? (
        <>
          {" "}
          <span className="text-[11px] font-semibold text-orange-200">{W.needleHere}</span>
        </>
      ) : null}
    </>
  );
}

type PointListProps = Readonly<{
  points: readonly CardCompassPoint[];
  labelId: string;
  label: string;
  hold: NeedleHold | null;
  ids: CardIds;
  onPoint: (itemId: string) => void;
}>;

// One group of points in the Compact view. A point that cannot take the
// needle is a disabled button, described by the hold's reason when one holds
// it. A point without a position is grey with the yellow symbol.
function PointList({ points, labelId, label, hold, ids, onPoint }: PointListProps) {
  return (
    <div className="grid gap-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400" id={labelId}>
        {label}
      </p>
      <ul aria-labelledby={labelId} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {points.map((point) => {
          const choice = needleChoice(point, hold, ids);
          const unplaced = point.dialAnchor === null;
          return (
            <li key={point.id}>
              <button
                aria-describedby={choice.describedBy}
                aria-pressed={point.isAttention}
                className={joinClasses(
                  "flex w-full flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left text-sm disabled:cursor-not-allowed",
                  point.isForming ? "border-dashed" : null,
                  point.isAttention
                    ? "border-orange-300/70 bg-orange-300/10 text-orange-50"
                    : joinClasses(
                        "border-stone-700 bg-black/25 enabled:hover:border-amber-300/60 enabled:hover:bg-amber-300/10 disabled:opacity-60",
                        unplaced ? "text-stone-400" : "text-stone-200",
                      ),
                  FOCUS_RING,
                )}
                disabled={choice.disabled}
                onClick={() => onPoint(point.id)}
                type="button"
              >
                <PointName point={point} symbol={unplaced} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// A button laid over the dial at a drawn place, as a share of the drawing.
function overlayStyle(at: Point, width: number, height: number) {
  return {
    left: share(at.x, VIEW_WIDTH),
    top: share(at.y, VIEW_HEIGHT),
    width: share(width, VIEW_WIDTH),
    height: share(height, VIEW_HEIGHT),
  };
}

type OverlayPointProps = Readonly<{
  point: CardCompassPoint;
  at: Point;
  round: boolean;
  width: number;
  height: number;
  hold: NeedleHold | null;
  ids: CardIds;
  onPoint: (itemId: string) => void;
}>;

// A point drawn on the dial (a round button over its bubble) or in the bottom
// row (a button over its place), in the Full view, with the list's rule,
// reason and name. A point that cannot take the needle, other than the
// current one, is dimmed as in the list.
function OverlayPoint({ point, at, round, width, height, hold, ids, onPoint }: OverlayPointProps) {
  const choice = needleChoice(point, hold, ids);
  return (
    <button
      aria-describedby={choice.describedBy}
      aria-pressed={point.isAttention}
      className={joinClasses(
        "absolute -translate-x-1/2 -translate-y-1/2",
        round ? "rounded-full" : "rounded-lg",
        "disabled:cursor-not-allowed",
        point.isAttention ? null : "enabled:hover:bg-amber-300/15 disabled:bg-black/35",
        FOCUS_RING,
      )}
      disabled={choice.disabled}
      onClick={() => onPoint(point.id)}
      style={overlayStyle(at, width, height)}
      type="button"
    >
      <span className="sr-only">
        <PointName point={point} />
      </span>
    </button>
  );
}

type LiveLineProps = Readonly<{ ids: CardIds; hold: NeedleHold | null; inDrawer: boolean; result: string }>;

// The live line: a hold's reason, or the result after the needle moved.
// Polite only in the drawer, where the page's status line is behind the
// modal. Each view has it once.
function LiveLine({ ids, hold, inDrawer, result }: LiveLineProps) {
  return (
    <div aria-atomic={inDrawer ? "true" : undefined} aria-live={inDrawer ? "polite" : undefined} id={ids.live}>
      {hold !== null ? (
        <p className="text-xs leading-5 text-amber-200" id={ids.hold}>
          {needleHoldText(hold, inDrawer)}
        </p>
      ) : result !== "" ? (
        <p className="text-xs leading-5 text-orange-200">{result}</p>
      ) : null}
    </div>
  );
}

type NeedleGroupProps = Readonly<{ ids: CardIds; ended: boolean; live: ReactNode; children: ReactNode }>;

// "Point the needle to change topic" and the live line, then the points that
// view offers. Once the conversation has ended the group is described by the
// line that says the needle cannot move.
function NeedleGroup({ ids, ended, live, children }: NeedleGroupProps) {
  return (
    <div aria-describedby={ended ? ids.hold : undefined} aria-labelledby={ids.choose} className="grid gap-3" role="group">
      <div className="grid gap-1">
        <h4 className="text-sm font-semibold text-stone-100" id={ids.choose}>
          {W.chooseHeading}
        </h4>
        {live}
      </div>
      {children}
    </div>
  );
}

type PriorityLinesProps = Readonly<{
  compass: CardCompass;
  ids: CardIds;
  currentRef: RefObject<HTMLDivElement | null>;
}>;

// The Priority and Current attention lines, in both views.
function PriorityLines({ compass, ids, currentRef }: PriorityLinesProps) {
  return (
    <dl className="grid gap-1 text-sm">
      <div className="flex flex-wrap gap-x-2">
        <dt className="text-stone-400">{W.priorityTerm}</dt>
        <dd className="min-w-0 font-medium text-amber-100 [overflow-wrap:anywhere]">
          {compass.priority?.label ?? W.priorityNone}
          {compass.priority ? <span className="text-xs font-normal text-stone-400"> {W.priorityConfirmed}</span> : null}
        </dd>
      </div>
      {/* Where focus goes after a confirmed move the Explorer asked for here. */}
      <div className={joinClasses("flex flex-wrap gap-x-2 rounded-md", FOCUS_RING)} id={ids.current} ref={currentRef} tabIndex={-1}>
        <dt className="text-stone-400">{W.needleTerm}</dt>
        <dd className="min-w-0 font-medium text-orange-100 [overflow-wrap:anywhere]">{compass.attention?.label ?? W.needleNone}</dd>
      </div>
    </dl>
  );
}

type ViewProps = Readonly<{
  scope: string;
  compass: CardCompass;
  ids: CardIds;
  hold: NeedleHold | null;
  live: ReactNode;
  lines: ReactNode;
  onPoint: (itemId: string) => void;
}>;

type FullViewProps = ViewProps &
  Readonly<{ inDrawer: boolean; whyOpen: boolean; onToggleWhy: () => void; onMore: () => void }>;

// The Full view: "Point the needle to change topic" and the live line, then
// the dial, where each point drawn on it and each point in its bottom row
// points the needle, a dashed needle explains itself, and "+N more" opens the
// Compact view; then the dashed needle's sentence when shown, then the two
// lines.
function FullView({ scope, compass, ids, hold, live, lines, onPoint, inDrawer, whyOpen, onToggleWhy, onMore }: FullViewProps) {
  const ended = hold === "ended";
  const row = bottomRow(compass);
  const places = rowPlacesX(row.length);
  const target = dashedTarget(compass, row);
  const attention = compass.attention;
  const shared = { hold, ids, onPoint };
  const dialButtons = dialPoints(compass).flatMap((point) =>
    point.dialAnchor === null
      ? []
      : [
          <OverlayPoint
            {...shared}
            at={positionOf(point.dialAnchor)}
            height={2 * BUBBLE_RADIUS}
            key={point.id}
            point={point}
            round
            width={2 * BUBBLE_RADIUS}
          />,
        ],
  );
  const rowButtons = row.map((entry, index) => {
    const at = { x: places[index], y: ROW_PLACE.y };
    return entry.kind === "point" ? (
      <OverlayPoint {...shared} at={at} height={ROW_PLACE.height} key={entry.point.id} point={entry.point} round={false} width={ROW_PLACE.width} />
    ) : (
      // Opening the Compact view changes nothing saved, so it is never disabled.
      <button
        aria-controls={ids.view}
        className={joinClasses("absolute -translate-x-1/2 -translate-y-1/2 rounded-lg hover:bg-amber-300/15", FOCUS_RING)}
        key="more"
        onClick={onMore}
        style={overlayStyle(at, ROW_PLACE.width, ROW_PLACE.height)}
        type="button"
      >
        <span className="sr-only">
          {bottomRowMoreText(entry.count)}
          {bottomRowMoreSuffix(entry.count)}
        </span>
      </button>
    );
  });

  return (
    <>
      <NeedleGroup ended={ended} ids={ids} live={live}>
        <Dial compass={compass} row={row} scope={scope}>
          {dialButtons}
          {target !== null ? (
            // The dashed needle explains itself; it changes nothing saved, so it is never disabled.
            <button
              aria-controls={ids.why}
              aria-expanded={whyOpen}
              className={joinClasses("absolute -translate-x-1/2 -translate-y-1/2 rounded-full hover:bg-amber-300/15", FOCUS_RING)}
              onClick={onToggleWhy}
              style={overlayStyle(towardTarget(target, DASHED_BUTTON.along), DASHED_BUTTON.size, DASHED_BUTTON.size)}
              type="button"
            >
              <span className="sr-only">{DASHED_NEEDLE_WORDING.button}</span>
            </button>
          ) : null}
          {rowButtons}
        </Dial>
        {whyOpen && target !== null && attention !== null ? (
          <p className="text-xs leading-5 text-stone-300" id={ids.why}>
            {dashedNeedleText(attention, inDrawer, ended)}
          </p>
        ) : null}
      </NeedleGroup>
      {lines}
    </>
  );
}

// The Compact view: the two lines, then every current point in its group.
function CompactView({ scope, compass, ids, hold, live, lines, onPoint }: ViewProps) {
  const ended = hold === "ended";
  const placed = compass.points.filter((point) => point.dialAnchor !== null);
  const unarranged = compass.points.filter((point) => point.dialAnchor === null && point.place === "unarranged");
  const otherPaths = compass.points.filter((point) => point.dialAnchor === null && point.place === "otherPaths");
  const groups = [
    { key: "placed", label: W.placedGroup, points: placed },
    { key: "unarranged", label: W.unarrangedGroup, points: unarranged },
    { key: "other", label: W.otherPathsGroup, points: otherPaths },
  ].filter((group) => group.points.length > 0);

  return (
    <>
      {lines}
      <NeedleGroup ended={ended} ids={ids} live={live}>
        {groups.map((group) => (
          <PointList
            hold={hold}
            ids={ids}
            key={group.key}
            label={group.label}
            labelId={`${scope}-connected-needle-${group.key}`}
            onPoint={onPoint}
            points={group.points}
          />
        ))}
      </NeedleGroup>
    </>
  );
}

type CardProps = Readonly<{
  scope: string;
  state: ExplorerConversationState | null;
  hold: NeedleHold | null;
  view: CardCompassView;
  onToggleView: () => void;
  onPoint: (itemId: string) => void;
}>;

export function ConnectedCompassCard({ scope, state, hold, view, onToggleView, onPoint }: CardProps) {
  const ids = cardIds(scope);
  const inDrawer = scope === "drawer";
  const compass = state === null ? null : connectedCompass(state);
  const attention = compass?.attention ?? null;
  const attentionId = attention?.id ?? null;
  const result = useNeedleResult(compass, hold !== null);
  const why = useDashedNeedleSentence(attention);
  // The point the Explorer last chose here, until the next hold ends.
  const requestedRef = useRef<string | null>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (hold !== null || requestedRef.current === null) return;
    const requested = requestedRef.current;
    requestedRef.current = null;
    if (requested === attentionId) currentRef.current?.focus();
  }, [hold, attentionId]);
  // "+N more" opens the Compact view and goes away with the Full view, so
  // focus moves to the view switch, which stays.
  const toggleRef = useRef<HTMLButtonElement>(null);
  const focusToggleRef = useRef(false);
  useEffect(() => {
    if (!focusToggleRef.current) return;
    focusToggleRef.current = false;
    toggleRef.current?.focus();
  }, [view]);
  const choose = (itemId: string) => {
    requestedRef.current = itemId;
    onPoint(itemId);
  };
  const showMore = () => {
    focusToggleRef.current = true;
    onToggleView();
  };
  // What both views take; the view itself also takes the loaded Compass.
  const viewProps = {
    scope,
    ids,
    hold,
    live: <LiveLine hold={hold} ids={ids} inDrawer={inDrawer} result={result} />,
    lines: compass === null ? null : <PriorityLines compass={compass} currentRef={currentRef} ids={ids} />,
    onPoint: choose,
  };

  return (
    <section aria-labelledby={ids.title} className="grid gap-3 border-b border-stone-800/80 px-4 py-4">
      <h3 className="flex items-center gap-2 font-serif text-lg text-stone-50" id={ids.title}>
        <IconCompass className="text-amber-300" />
        {W.heading}
      </h3>
      {compass === null ? (
        <p className="text-sm leading-6 text-stone-300">{W.notLoaded}</p>
      ) : compass.points.length === 0 ? (
        <div className="grid gap-1">
          <p className="text-sm font-medium text-stone-100">{W.emptyLead}</p>
          <p className="text-sm leading-6 text-stone-300">{W.empty}</p>
        </div>
      ) : (
        <>
          {/* One view at a time; the button names the view it switches to. It is never disabled:
              switching views changes nothing saved. */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              aria-controls={ids.view}
              className={joinClasses(QUIET_BUTTON, "border border-stone-700")}
              onClick={onToggleView}
              ref={toggleRef}
              type="button"
            >
              {view === "full" ? W.compactViewButton : W.fullViewButton}
              <span className="sr-only">{W.viewButtonSuffix}</span>
            </button>
          </div>
          <div className="grid gap-3" id={ids.view}>
            {view === "full" ? (
              <FullView
                {...viewProps}
                compass={compass}
                inDrawer={inDrawer}
                onMore={showMore}
                onToggleWhy={why.toggle}
                whyOpen={why.open}
              />
            ) : (
              <CompactView {...viewProps} compass={compass} />
            )}
          </div>
        </>
      )}
    </section>
  );
}
