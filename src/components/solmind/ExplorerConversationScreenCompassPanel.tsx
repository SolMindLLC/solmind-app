import type { ScreenCompass, ScreenCompassPoint } from "@/lib/solmind/explorerConversationScreenDisplay";

import { CompassDial } from "./ExplorerConversationScreenCompassDial";
import { IconCompass, IconDashedCircle } from "./ExplorerConversationScreenIcons";
import {
  FOCUS_RING,
  LayoutOnlyTag,
  NotYetImplementedNote,
  QUIET_BUTTON,
  SampleTag,
  UnwiredButton,
  joinClasses,
  noteId,
} from "./ExplorerConversationScreenNotYetImplemented";

export type CompassView = "full" | "compact";

export function findCompassPoint(compass: ScreenCompass, id: string): ScreenCompassPoint | null {
  return compass.points.find((point) => point.id === id) ?? null;
}

function FormingBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-stone-400 px-2 py-0.5 text-[11px] font-semibold text-stone-200">
      <IconDashedCircle className="h-3.5 w-3.5" />
      Forming
    </span>
  );
}

function AttentionList({ scope, compass }: Readonly<{ scope: string; compass: ScreenCompass }>) {
  const attentionNote = noteId(scope, "attention");
  const formingNote = noteId(scope, "formingPoint");
  const labelId = `${scope}-compass-paths-label`;

  return (
    <div aria-labelledby={labelId} className="mt-3 grid gap-2" role="group">
      <p className="text-xs text-stone-300" id={labelId}>
        Move your attention
      </p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {compass.points.map((point) => {
          const isAttention = point.id === compass.attentionId;
          const isPriority = point.id === compass.priorityId;

          return (
            <li key={point.id}>
              <UnwiredButton
                className={joinClasses(
                  "flex w-full flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left text-sm",
                  isAttention ? "border-orange-300/70 bg-orange-300/10 text-orange-50" : "border-stone-700 bg-black/25 text-stone-200",
                  FOCUS_RING,
                )}
                noteId={point.forming ? `${attentionNote} ${formingNote}` : attentionNote}
                pressed={isAttention}
              >
                <span className="font-medium">{point.label}</span>
                <span className="text-[11px] text-stone-300">
                  {isAttention ? "Current attention" : point.category}
                  {isAttention && isPriority ? " - Priority" : ""}
                </span>
                {point.forming ? <FormingBadge /> : null}
              </UnwiredButton>
            </li>
          );
        })}
      </ul>
      <NotYetImplementedNote id={attentionNote} noteKey="attention" />
    </div>
  );
}

function FullCompass({ scope, compass }: Readonly<{ scope: string; compass: ScreenCompass }>) {
  const priority = findCompassPoint(compass, compass.priorityId);
  const attention = findCompassPoint(compass, compass.attentionId);

  return (
    <>
      <CompassDial
        attentionId={compass.attentionId}
        points={compass.points}
        priorityId={compass.priorityId}
        scope={scope}
      />
      <dl className="mt-3 grid gap-1 text-sm">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-stone-400">Priority:</dt>
          <dd className="font-medium text-amber-100">
            {priority?.label} <span className="text-xs text-stone-400">(confirmed by you)</span>
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-stone-400">Current attention:</dt>
          <dd className="font-medium text-orange-100">{attention?.label}</dd>
        </div>
      </dl>
      <AttentionList compass={compass} scope={scope} />
    </>
  );
}

function CompactCompass({ compass }: Readonly<{ compass: ScreenCompass }>) {
  const { compact } = compass;
  const priority = findCompassPoint(compass, compass.priorityId);

  return (
    <div className="mt-3">
      <ol
        aria-label="Current and recent Compass orientations"
        className="divide-y divide-stone-800 rounded-2xl border border-stone-800 bg-black/25"
      >
        <li className="px-3 py-2">
          <p className="text-sm font-semibold text-orange-50">{compact.current}</p>
          <p className="text-[11px] text-orange-200">Current orientation</p>
        </li>
        <li className="px-3 py-2">
          <p className="text-sm text-stone-200">{compact.previous}</p>
          <p className="text-[11px] text-stone-400">Previous orientation</p>
        </li>
        <li className="px-3 py-2">
          <p className="text-sm text-stone-200">{compact.earlier}</p>
          <p className="text-[11px] text-stone-400">Earlier orientation</p>
        </li>
      </ol>
      <p className="mt-2 text-xs text-stone-400">and {compact.moreCount} earlier orientation not shown</p>
      <p className="mt-2 text-xs text-stone-400">
        Priority: <span className="text-amber-100">{priority?.label}</span> (confirmed by you)
      </p>
    </div>
  );
}

type CompassSectionProps = Readonly<{
  scope: string;
  compass: ScreenCompass;
  view: CompassView;
  onToggleView: () => void;
}>;

// The Compass keeps the accepted S01R2 order (dial, Priority and attention,
// then the attention list with its own note) so the Waypoint card follows it
// closely. Its other "Not yet implemented" notes (the Compass as a whole,
// Forming points, the needle and the compact view) are gathered under "What
// you will be able to do", below the card.
export function CompassSection({ scope, compass, view, onToggleView }: CompassSectionProps) {
  const titleId = `${scope}-compass-title`;
  const viewId = `${scope}-compass-view`;

  return (
    <section aria-labelledby={titleId} className="px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 font-serif text-lg text-stone-50" id={titleId}>
          <IconCompass className="text-amber-300" />
          Current Compass
        </h3>
        <SampleTag />
      </div>
      <p className="mt-1 text-xs text-stone-400">Before any point is confirmed, this reads: Discovering what matters</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          aria-controls={viewId}
          className={joinClasses(QUIET_BUTTON, "border border-stone-700")}
          data-preview-control="layout"
          onClick={onToggleView}
          type="button"
        >
          {view === "full" ? "Compact view" : "Full view"}
          <span className="sr-only"> of the Compass</span>
        </button>
        <LayoutOnlyTag />
      </div>
      <div id={viewId}>{view === "full" ? <FullCompass compass={compass} scope={scope} /> : <CompactCompass compass={compass} />}</div>
    </section>
  );
}
