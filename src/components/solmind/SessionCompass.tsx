import type {
  CompassPoint,
  CompassZone,
  SessionCompassState,
} from "@/lib/solmind/explorerExperience";

type SessionCompassProps = {
  state: SessionCompassState;
};

const ZONE_LABELS: Record<CompassZone, string> = {
  priority: "Priority area",
  detour: "Detour area",
  excursion: "Excursion area",
};

const ZONE_POSITIONS: Record<
  CompassZone,
  readonly { left: string; top: string }[]
> = {
  priority: [
    { left: "50%", top: "16%" },
    { left: "32%", top: "29%" },
    { left: "68%", top: "29%" },
  ],
  detour: [
    { left: "16%", top: "49%" },
    { left: "84%", top: "49%" },
  ],
  excursion: [
    { left: "28%", top: "73%" },
    { left: "50%", top: "82%" },
    { left: "72%", top: "73%" },
  ],
};

function placePoints(points: readonly CompassPoint[]) {
  const zoneIndexes: Record<CompassZone, number> = {
    priority: 0,
    detour: 0,
    excursion: 0,
  };

  return points.map((point) => {
    const positions = ZONE_POSITIONS[point.zone];
    const position =
      positions[zoneIndexes[point.zone] % positions.length] ?? positions[0];
    zoneIndexes[point.zone] += 1;

    return { point, position };
  });
}

export function SessionCompass({ state }: SessionCompassProps) {
  const placedPoints = placePoints(state.points);

  return (
    <section
      aria-labelledby="session-compass-title"
      className="rounded-3xl border border-slate-700 bg-slate-950/80 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Fixed Priority-up frame
          </p>
          <h2 id="session-compass-title" className="mt-2 text-2xl font-semibold">
            Session Compass
          </h2>
        </div>

        <span className="rounded-full border border-slate-600 px-3 py-1 text-sm text-slate-300">
          {state.mode === "discovery"
            ? "Discovering what matters"
            : "Priority confirmed"}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-300">
        Higher placement means higher priority. Side areas are Detours. The
        lower area holds lower-priority Excursions. The bright ring marks
        current attention; it does not change Priority.
      </p>

      <div
        aria-label="Visual Session Compass with a fixed Priority apex, side Detours, and lower Excursions"
        className="relative mx-auto mt-5 aspect-square w-full max-w-xl overflow-hidden rounded-full border border-slate-700 bg-[radial-gradient(circle_at_center,_rgba(15,23,42,0.15),_rgba(15,23,42,0.92))]"
        role="img"
      >
        <div className="absolute inset-x-0 top-3 text-center">
          <span className="inline-flex rounded-full border border-amber-300/70 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
            Priority
          </span>
        </div>

        <div className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
          Detour
        </div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
          Detour
        </div>
        <div className="absolute inset-x-0 bottom-3 text-center">
          <span className="inline-flex rounded-full border border-violet-400/40 bg-violet-400/10 px-3 py-1 text-xs font-semibold text-violet-200">
            Excursion
          </span>
        </div>

        <div className="absolute left-1/2 top-[12%] h-[76%] w-px -translate-x-1/2 bg-slate-700/50" />
        <div className="absolute left-[12%] top-1/2 h-px w-[76%] -translate-y-1/2 bg-slate-700/50" />

        {state.points.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center px-16 text-center">
            <div className="rounded-3xl border border-dashed border-slate-600 bg-slate-900/90 p-6">
              <p className="font-semibold text-slate-100">Discovery mode</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                No topic or Priority has been invented. It is valid to stay
                here for the whole conversation.
              </p>
            </div>
          </div>
        ) : null}

        {placedPoints.map(({ point, position }) => {
          const isPriority = state.priorityPointId === point.id;
          const isAttention = state.attentionPointId === point.id;

          return (
            <div
              key={point.id}
              className="absolute z-10 w-32 -translate-x-1/2 -translate-y-1/2 text-center"
              style={position}
            >
              <div
                className={[
                  "rounded-2xl border bg-slate-900/95 px-3 py-2 text-xs shadow-lg",
                  isPriority
                    ? "border-amber-300 text-amber-100"
                    : "border-slate-600 text-slate-100",
                  isAttention
                    ? "ring-4 ring-cyan-300/70 ring-offset-2 ring-offset-slate-950"
                    : "",
                ].join(" ")}
              >
                <span className="block font-semibold">{point.label}</span>
                <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-slate-400">
                  {ZONE_LABELS[point.zone]}
                  {isPriority ? " - confirmed" : ""}
                  {isAttention ? " - current attention" : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="font-semibold">Readable direction list</h3>
          {state.points.length ? (
            <ul className="mt-2 space-y-2 text-sm text-slate-300">
              {state.points.map((point) => (
                <li key={point.id}>
                  <span className="font-medium text-slate-100">
                    {point.label}
                  </span>
                  {" - "}
                  {ZONE_LABELS[point.zone]}
                  {state.priorityPointId === point.id
                    ? ", confirmed Priority"
                    : ""}
                  {state.attentionPointId === point.id
                    ? ", current attention"
                    : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-400">
              No visible points. No Priority confirmed.
            </p>
          )}
        </div>

        <div>
          <h3 className="font-semibold">Other paths</h3>
          {state.otherPaths.length ? (
            <ul className="mt-2 space-y-2 text-sm text-slate-300">
              {state.otherPaths.map((point) => (
                <li key={point.id}>{point.label}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-400">
              No overflow paths are hidden.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
