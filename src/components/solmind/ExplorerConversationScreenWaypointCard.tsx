import { MIDDLE_DOT } from "@/lib/solmind/explorerConversationScreen";
import type { ScreenWaypoint } from "@/lib/solmind/explorerConversationScreenDisplay";

import { IconDashedCircle, IconEyeOff, IconHistory, IconLightbulb } from "./ExplorerConversationScreenIcons";
import {
  FOCUS_RING,
  LayoutOnlyTag,
  NotYetImplementedNote,
  SampleTag,
  SECONDARY_BUTTON,
  UnwiredButton,
  UnwiredControl,
  joinClasses,
  noteId,
} from "./ExplorerConversationScreenNotYetImplemented";

const EYEBROW = "text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300";

// A symbol and the word, never colour alone.
function StatusMarker({ status }: Readonly<{ status: string }>) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-amber-200/50 px-2.5 py-1 text-xs font-semibold text-amber-100">
      <IconDashedCircle className="h-3.5 w-3.5" />
      {status}
    </span>
  );
}

type QuotesProps = Readonly<{
  scope: string;
  waypoint: ScreenWaypoint;
  explorerSpeakerLabel: string;
  open: boolean;
  onToggle: (open: boolean) => void;
}>;

function SupportingQuotes({ scope, waypoint, explorerSpeakerLabel, open, onToggle }: QuotesProps) {
  const quoteNote = noteId(scope, "quote");

  return (
    <div className="mt-2 grid gap-1.5">
      <details onToggle={(event) => onToggle(event.currentTarget.open)} open={open}>
        <summary
          className={joinClasses("cursor-pointer rounded-md text-xs font-medium text-amber-200", FOCUS_RING)}
          data-preview-control="layout"
        >
          {waypoint.quotes.length} supporting quotes
        </summary>
        <ul className="mt-2 grid gap-1">
          {waypoint.quotes.map((quote) => (
            <li key={quote}>
              <UnwiredButton
                className={joinClasses(
                  "w-full rounded-xl border border-stone-700 px-2.5 py-2 text-left text-sm text-stone-200",
                  FOCUS_RING,
                )}
                noteId={quoteNote}
              >
                <span className="block italic">&ldquo;{quote}&rdquo;</span>
                <span className="mt-1 block text-[11px] not-italic text-amber-200">
                  {explorerSpeakerLabel} {MIDDLE_DOT} Show in the conversation
                </span>
              </UnwiredButton>
            </li>
          ))}
        </ul>
        <NotYetImplementedNote className="mt-2" id={quoteNote} noteKey="quote" />
        <div className="mt-2 border-t border-stone-800 pt-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
            <IconHistory className="h-3.5 w-3.5" />
            Replaced quotes, kept in history
          </p>
          <ul className="mt-1 grid gap-1">
            {waypoint.replacedQuotes.map((quote) => (
              <li className="px-2.5 py-1 text-sm italic text-stone-400" key={quote}>
                &ldquo;{quote}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      </details>
      <LayoutOnlyTag className="justify-self-start" />
    </div>
  );
}

type WaypointSectionProps = Readonly<{
  scope: string;
  waypoint: ScreenWaypoint;
  explorerSpeakerLabel: string;
  quotesOpen: boolean;
  onQuotesToggle: (open: boolean) => void;
}>;

// Paul's short Waypoint card, kept contiguous: name, status, where and why,
// what Reached looks like, supporting quotes and the share line. No part of it
// can be edited directly. Future actions sit under "What you will be able to
// do", below it.
export function WaypointSection({ scope, waypoint, explorerSpeakerLabel, quotesOpen, onQuotesToggle }: WaypointSectionProps) {
  const titleId = `${scope}-waypoint-title`;

  return (
    <section aria-labelledby={titleId} className="border-t border-stone-800/80 px-4 py-4">
      <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.04] p-3" data-waypoint-card="">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={EYEBROW}>Waypoint</p>
            <h3 className="font-serif text-lg leading-snug text-stone-50" id={titleId}>
              {waypoint.name}
            </h3>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusMarker status={waypoint.status} />
            <SampleTag />
          </div>
        </div>
        <dl className="mt-2 grid gap-2">
          <div className="border-l-2 border-amber-300/60 pl-3">
            <dt className="text-[11px] uppercase tracking-[0.18em] text-amber-200">Where and why</dt>
            <dd className="mt-0.5 text-sm leading-6 text-stone-100">{waypoint.whereAndWhy}</dd>
          </div>
          <div className="border-l-2 border-amber-300/60 pl-3">
            <dt className="text-[11px] uppercase tracking-[0.18em] text-amber-200">Reached looks like</dt>
            <dd className="mt-0.5 font-serif text-base leading-6 text-stone-50">{waypoint.reachedLooksLike}</dd>
          </div>
        </dl>
        <SupportingQuotes
          explorerSpeakerLabel={explorerSpeakerLabel}
          onToggle={onQuotesToggle}
          open={quotesOpen}
          scope={scope}
          waypoint={waypoint}
        />
        <p className="mt-2 flex flex-wrap items-center gap-2 border-t border-stone-800 pt-2 text-sm font-semibold text-stone-100">
          <IconEyeOff />
          {waypoint.shareLine}
        </p>
      </div>
      <div className="mt-2 grid gap-1.5">
        <NotYetImplementedNote id={noteId(scope, "waypointCard")} noteKey="waypointCard" />
        <NotYetImplementedNote id={noteId(scope, "shareLine")} noteKey="shareLine" />
      </div>
    </section>
  );
}

type KeyInsightProps = Readonly<{ scope: string; keyInsight: string; nextDirection: string }>;

// A Key Insight is progress in its own right, not a Waypoint.
export function KeyInsightSection({ scope, keyInsight, nextDirection }: KeyInsightProps) {
  const titleId = `${scope}-key-insight-title`;

  return (
    <section aria-labelledby={titleId} className="border-t border-stone-800/80 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 font-serif text-lg text-stone-50" id={titleId}>
          <IconLightbulb className="text-amber-300" />
          Key Insight
        </h3>
        <SampleTag />
      </div>
      <p className="mt-2 text-sm font-medium leading-6 text-stone-100">{keyInsight}</p>
      <NotYetImplementedNote className="mt-2" id={noteId(scope, "keyInsight")} noteKey="keyInsight" />
      <div className="mt-4 grid gap-2 rounded-2xl border border-dashed border-stone-700 px-3 py-2.5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400">
          Possible next direction {MIDDLE_DOT} not part of this Waypoint
        </p>
        <p className="text-sm font-medium text-stone-200">{nextDirection}</p>
        <UnwiredControl className={SECONDARY_BUTTON} noteKey="exploreNext" scope={scope}>
          Explore this next
        </UnwiredControl>
      </div>
    </section>
  );
}
