import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  CONNECTED_WAYPOINT_WORDING,
  WAYPOINT_LIST_ROWS,
  WAYPOINT_LIST_WORDING,
  waypointListGroups,
  waypointListNextSize,
  waypointRowsShown,
  type CardWaypointLine,
  type CardWaypointStage,
  type WaypointListSize,
} from "@/lib/solmind/explorerConnectedCard";
import type { ExplorerConversationState, ExplorerConversationWaypointDraft } from "@/lib/solmind/explorerConversationContract";
import { WAYPOINT_DRAFT_WORDING } from "@/lib/solmind/explorerWaypointDraft";
import { waypointConversationLimitNotice } from "@/lib/solmind/explorerWaypointCapacity";

import { IconArchive, IconCheck, IconFlag, IconHistory, IconMapPin } from "./ExplorerConversationScreenIcons";

// The connected Waypoint card (chat step slice S1), read-only: each saved
// Waypoint in the look of Paul's reviewed short card
// (ExplorerConversationScreenWaypointCard.tsx), with the approved stage names
// Formed, Reached and Released, and its older wording under "Earlier version -
// <stage>" (Paul's question 9 decision). Nothing here can be edited; choosing,
// clarifying, Reached and Release stay in the current tools for now.
// The compact list (lane 8, decision queue 2026-11-05 19:38:45 CST, point 4):
// each Waypoint is one compact row (its title and stage) that opens to that
// card, one at a time; three rows at first, then five, then all; a forming
// draft takes the first row; Reached and Released Waypoints are in a collapsed
// group. Layout state only (which row is open, how many show, the group).
// A closed title takes at most two lines; an open row shows it in full.
// Keyboard focus is kept: "Show more" and "Show all" move it to the first row
// they reveal, and "Show fewer" to the "Show more" button.

const W = CONNECTED_WAYPOINT_WORDING;
const L = WAYPOINT_LIST_WORDING;
const D = WAYPOINT_DRAFT_WORDING;
const FOCUS_RING = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";
const STAGE_ICONS: Readonly<Record<CardWaypointStage, (props: Readonly<{ className?: string }>) => ReactNode>> = {
  formed: IconCheck,
  reached: IconFlag,
  released: IconArchive,
};

// A symbol and the word, never colour alone.
function StageMarker({ stage, label }: Readonly<{ stage: CardWaypointStage; label: string }>) {
  const Icon = STAGE_ICONS[stage];
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200/50 px-2.5 py-1 text-xs font-semibold text-amber-100">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function FormingMarker() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-dashed border-amber-200/50 px-2.5 py-1 text-xs font-semibold text-amber-100">
      {D.forming}
    </span>
  );
}

function Term({ term, children, large = false }: Readonly<{ term: string; children: ReactNode; large?: boolean }>) {
  return (
    <div className="border-l-2 border-amber-300/60 pl-3">
      <dt className="text-[11px] uppercase tracking-[0.18em] text-amber-200">{term}</dt>
      <dd className={large ? "mt-0.5 whitespace-pre-wrap font-serif text-base leading-6 text-stone-50 [overflow-wrap:anywhere]" : "mt-0.5 whitespace-pre-wrap text-sm leading-6 text-stone-100 [overflow-wrap:anywhere]"}>
        {children}
      </dd>
    </div>
  );
}

function WaypointDetails({ line }: Readonly<{ line: CardWaypointLine }>) {
  const { current, earlier } = line;
  return (
    <>
      <dl className="grid gap-2">
        {current.title === undefined || current.title === current.destination ? null : <Term term={W.destinationTerm}>{current.destination}</Term>}
        <Term term={W.meaningTerm}>{current.meaning}</Term>
        <Term large term={W.arrivalTerm}>{current.arrivalSignal}</Term>
      </dl>
      {earlier.length > 0 ? (
        <div className="mt-2 border-t border-stone-800 pt-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
            <IconHistory className="h-3.5 w-3.5" />
            {W.earlierHeading}
          </p>
          <ul className="mt-1 grid gap-2">
            {earlier.map((version) => (
              <li className="grid gap-0.5 px-1 py-1 text-sm text-stone-400" key={version.id}>
                <p className="text-xs font-semibold text-stone-300">{version.label}</p>
                {version.title === undefined || version.title === version.destination ? null : <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{version.title}</p>}
                <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{version.destination}</p>
                <p className="whitespace-pre-wrap text-xs leading-5 [overflow-wrap:anywhere]">
                  {W.meaningTerm}: {version.meaning}
                </p>
                <p className="whitespace-pre-wrap text-xs leading-5 [overflow-wrap:anywhere]">
                  {W.arrivalTerm}: {version.arrivalSignal}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

function DraftDetails({ draft }: Readonly<{ draft: ExplorerConversationWaypointDraft }>) {
  const lines = ([
    [W.destinationTerm, draft.destination],
    [W.meaningTerm, draft.whyItMatters],
    [W.arrivalTerm, draft.arrivalSignal],
  ] as const).filter((entry): entry is readonly [string, string] => entry[1] !== null);
  return (
    <dl className="grid gap-2">
      {lines.map(([term, wording]) => (
        <Term key={term} term={term}>
          {wording}
        </Term>
      ))}
    </dl>
  );
}

// One compact row: a heading whose button shows the title and stage and opens
// the details below it (the disclosure pattern).
function Row({ buttonId, panelId, title, marker, forming, open, onToggle, children }: Readonly<{
  buttonId: string;
  panelId: string;
  title: string;
  marker: ReactNode;
  forming: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}>) {
  return (
    <article
      className={
        forming
          ? "rounded-2xl border border-dashed border-amber-200/50 bg-amber-300/[0.04]"
          : "rounded-2xl border border-amber-300/25 bg-amber-300/[0.04]"
      }
    >
      <h4>
        <button
          aria-controls={panelId}
          aria-expanded={open}
          className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-amber-300/[0.06] ${FOCUS_RING}`}
          id={buttonId}
          onClick={onToggle}
          type="button"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true" className={`shrink-0 text-xs text-amber-300 transition-transform ${open ? "rotate-90" : ""}`}>
              {">"}
            </span>
            <span className={`${open ? "whitespace-pre-wrap" : "line-clamp-2"} font-serif text-base leading-snug text-stone-50 [overflow-wrap:anywhere]`}>{title}</span>
          </span>
          {marker}
        </button>
      </h4>
      <div className="px-3 pb-3" hidden={!open} id={panelId}>
        {open ? children : null}
      </div>
    </article>
  );
}

type ListRow = Readonly<{ key: string; kind: "draft"; draft: ExplorerConversationWaypointDraft }> | Readonly<{ key: string; kind: "line"; line: CardWaypointLine }>;

export function ConnectedWaypointCard({ scope, state }: Readonly<{ scope: string; state: ExplorerConversationState | null }>) {
  const titleId = `${scope}-connected-waypoint-title`;
  const historyId = `${scope}-connected-waypoint-history`;
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [size, setSize] = useState<WaypointListSize>("initial");
  const [historyOpen, setHistoryOpen] = useState(false);
  // The id of the control to focus after the next render (a layout concern only).
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (pendingFocus.current === null) return;
    document.getElementById(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });
  const moreId = `${scope}-waypoint-more`;
  const rowButtonId = (key: string) => `${scope}-waypoint-row-${key}-button`;

  const groups = state === null ? { active: [], history: [] } : waypointListGroups(state);
  const draft = state === null || state.sessionStatus === "ended" ? null : state.waypointDraft;
  // Lane 12: shown while the conversation is open; an ended conversation forms nothing anyway.
  const conversationLimit = state === null || state.sessionStatus === "ended" ? null : waypointConversationLimitNotice(state);
  const rows: ListRow[] = [
    ...(draft === null ? [] : [{ key: `draft-${draft.id}`, kind: "draft" as const, draft }]),
    ...groups.active.map((line) => ({ key: line.current.id, kind: "line" as const, line })),
  ];
  const shownCount = waypointRowsShown(rows.length, size);
  const shown = rows.slice(0, shownCount);
  const next = waypointListNextSize(rows.length, size);
  const sizing = rows.length > WAYPOINT_LIST_ROWS.initial;
  const toggle = (key: string) => setOpenKey((current) => (current === key ? null : key));
  const grow = (to: WaypointListSize) => {
    const firstNew = rows[shownCount];
    pendingFocus.current = firstNew === undefined ? null : rowButtonId(firstNew.key);
    setSize(to);
  };
  const shrink = () => {
    pendingFocus.current = moreId;
    setSize("initial");
  };

  const renderRow = (row: ListRow) => {
    const panelId = `${scope}-waypoint-row-${row.key}`;
    const buttonId = rowButtonId(row.key);
    const open = openKey === row.key;
    if (row.kind === "draft") {
      return (
        <Row buttonId={buttonId} forming marker={<FormingMarker />} onToggle={() => toggle(row.key)} open={open} panelId={panelId} title={row.draft.title ?? D.unnamed}>
          <DraftDetails draft={row.draft} />
        </Row>
      );
    }
    const { current } = row.line;
    return (
      <Row
        buttonId={buttonId}
        forming={false}
        marker={<StageMarker label={current.label} stage={current.stage} />}
        onToggle={() => toggle(row.key)}
        open={open}
        panelId={panelId}
        title={current.title ?? current.destination}
      >
        <WaypointDetails line={row.line} />
      </Row>
    );
  };

  return (
    <section aria-labelledby={titleId} className="grid gap-3 border-b border-stone-800/80 px-4 py-4">
      <h3 className="flex items-center gap-2 font-serif text-lg text-stone-50" id={titleId}>
        <IconMapPin className="text-amber-300" />
        {W.heading}
      </h3>
      {conversationLimit === null ? null : (
        <p className="text-sm leading-6 text-stone-300">{conversationLimit}</p>
      )}
      {state === null ? (
        <p className="text-sm leading-6 text-stone-300">{W.notLoaded}</p>
      ) : rows.length === 0 && groups.history.length === 0 ? (
        <p className="text-sm leading-6 text-stone-300">{W.empty}</p>
      ) : (
        <>
          {rows.length > 0 ? (
            <ul className="grid gap-2">
              {shown.map((row) => (
                <li key={row.key}>{renderRow(row)}</li>
              ))}
            </ul>
          ) : null}
          {sizing ? (
            <div className="flex flex-wrap gap-2">
              {next === null ? null : (
                <button
                  className={`rounded-full border border-stone-700 px-3 py-1 text-xs font-semibold text-stone-200 hover:border-amber-300/60 ${FOCUS_RING}`}
                  id={size === "initial" ? moreId : undefined}
                  onClick={() => grow(next.size)}
                  type="button"
                >
                  {next.label}
                </button>
              )}
              {size === "initial" ? null : (
                <button
                  className={`rounded-full border border-stone-700 px-3 py-1 text-xs font-semibold text-stone-200 hover:border-amber-300/60 ${FOCUS_RING}`}
                  onClick={shrink}
                  type="button"
                >
                  {L.showFewer}
                </button>
              )}
            </div>
          ) : null}
          {groups.history.length > 0 ? (
            <div className="grid gap-2 border-t border-stone-800 pt-2">
              <button
                aria-controls={historyId}
                aria-expanded={historyOpen}
                className={`flex items-center gap-2 rounded-lg px-1 py-1 text-left text-xs font-semibold uppercase tracking-[0.16em] text-stone-400 hover:text-stone-200 ${FOCUS_RING}`}
                onClick={() => setHistoryOpen((value) => !value)}
                type="button"
              >
                <span aria-hidden="true" className={`transition-transform ${historyOpen ? "rotate-90" : ""}`}>
                  {">"}
                </span>
                {L.history(groups.history.length)}
              </button>
              <ul className="grid gap-2" hidden={!historyOpen} id={historyId}>
                {historyOpen
                  ? groups.history.map((line) => <li key={line.current.id}>{renderRow({ key: line.current.id, kind: "line", line })}</li>)
                  : null}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
