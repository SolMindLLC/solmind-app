import type { ReactNode } from "react";

import {
  CONNECTED_WAYPOINT_WORDING,
  connectedWaypointLines,
  type CardWaypointLine,
  type CardWaypointStage,
} from "@/lib/solmind/explorerConnectedCard";
import type { ExplorerConversationState } from "@/lib/solmind/explorerConversationContract";

import { IconArchive, IconCheck, IconFlag, IconHistory, IconMapPin } from "./ExplorerConversationScreenIcons";

// The connected Waypoint card (chat step slice S1), read-only: each saved
// Waypoint in the look of Paul's reviewed short card
// (ExplorerConversationScreenWaypointCard.tsx), with the approved stage names
// Formed, Reached and Released, and its older wording under "Earlier version -
// <stage>" (Paul's question 9 decision). Nothing here can be edited; choosing,
// clarifying, Reached and Release stay in the current tools for now.

const W = CONNECTED_WAYPOINT_WORDING;
const EYEBROW = "text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300";
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

function WaypointLineCard({ scope, line }: Readonly<{ scope: string; line: CardWaypointLine }>) {
  const { current, earlier } = line;
  const titleId = `${scope}-connected-waypoint-${current.id}-title`;

  return (
    <article aria-labelledby={titleId} className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.04] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={EYEBROW}>{W.eyebrow}</p>
          <h4 className="whitespace-pre-wrap font-serif text-lg leading-snug text-stone-50 [overflow-wrap:anywhere]" id={titleId}>
            {current.title ?? current.destination}
          </h4>
        </div>
        <StageMarker label={current.label} stage={current.stage} />
      </div>
      <dl className="mt-2 grid gap-2">
        {current.title === undefined || current.title === current.destination ? null : (
          <div className="border-l-2 border-amber-300/60 pl-3">
            <dt className="text-[11px] uppercase tracking-[0.18em] text-amber-200">{W.destinationTerm}</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm leading-6 text-stone-100 [overflow-wrap:anywhere]">{current.destination}</dd>
          </div>
        )}
        <div className="border-l-2 border-amber-300/60 pl-3">
          <dt className="text-[11px] uppercase tracking-[0.18em] text-amber-200">{W.meaningTerm}</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-sm leading-6 text-stone-100 [overflow-wrap:anywhere]">{current.meaning}</dd>
        </div>
        <div className="border-l-2 border-amber-300/60 pl-3">
          <dt className="text-[11px] uppercase tracking-[0.18em] text-amber-200">{W.arrivalTerm}</dt>
          <dd className="mt-0.5 whitespace-pre-wrap font-serif text-base leading-6 text-stone-50 [overflow-wrap:anywhere]">
            {current.arrivalSignal}
          </dd>
        </div>
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
    </article>
  );
}

export function ConnectedWaypointCard({ scope, state }: Readonly<{ scope: string; state: ExplorerConversationState | null }>) {
  const titleId = `${scope}-connected-waypoint-title`;
  const lines = state === null ? [] : connectedWaypointLines(state);

  return (
    <section aria-labelledby={titleId} className="grid gap-3 border-b border-stone-800/80 px-4 py-4">
      <h3 className="flex items-center gap-2 font-serif text-lg text-stone-50" id={titleId}>
        <IconMapPin className="text-amber-300" />
        {W.heading}
      </h3>
      {state === null ? (
        <p className="text-sm leading-6 text-stone-300">{W.notLoaded}</p>
      ) : lines.length === 0 ? (
        <p className="text-sm leading-6 text-stone-300">{W.empty}</p>
      ) : (
        <ul className="grid gap-3">
          {lines.map((line) => (
            <li key={line.current.id}>
              <WaypointLineCard line={line} scope={scope} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
