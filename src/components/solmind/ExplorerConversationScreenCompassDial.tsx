import type { ScreenCompassPoint, ScreenCompassZone } from "@/lib/solmind/explorerConversationScreenDisplay";

import { joinClasses } from "./ExplorerConversationScreenNotYetImplemented";

// Display-only Compass dial with the accepted S01R2 geometry and labelling,
// redrawn here as local presentation code (nothing is imported from S01R2):
// large labelled bubbles in a fixed Priority-up frame, Priority at the top, a
// Detour on each side and the Excursion below, with the category labels
// outside the ring. The frame never rotates, and no direction letters or
// scores appear. A point that is still Forming has a dashed edge and the word
// "Forming" in its bubble.

const CENTER = { x: 150, y: 128 };
const BUBBLE_RADIUS = 31;
const ZONE_POINTS: Readonly<Record<ScreenCompassZone, { x: number; y: number }>> = {
  priority: { x: 150, y: 62 },
  detourLeft: { x: 80, y: 128 },
  detourRight: { x: 220, y: 128 },
  excursion: { x: 150, y: 194 },
};

function needleEnd(zone: ScreenCompassZone) {
  const point = ZONE_POINTS[zone];
  const dx = point.x - CENTER.x;
  const dy = point.y - CENTER.y;
  const distance = Math.hypot(dx, dy);
  const scale = (distance - BUBBLE_RADIUS - 4) / distance;

  return { x: CENTER.x + dx * scale, y: CENTER.y + dy * scale };
}

export function describeCompass(points: readonly ScreenCompassPoint[], attentionId: string): string {
  const parts = points.map((point) => `${point.category}: ${point.label}${point.forming ? " (Forming)" : ""}`);
  const attention = points.find((point) => point.id === attentionId);

  return `${parts.join(". ")}. ${attention ? `The needle points to ${attention.label}.` : "The needle has no direction yet."}`;
}

type CompassDialProps = Readonly<{
  scope: string;
  points: readonly ScreenCompassPoint[];
  priorityId: string;
  attentionId: string;
}>;

export function CompassDial({ scope, points, priorityId, attentionId }: CompassDialProps) {
  const attention = points.find((point) => point.id === attentionId) ?? null;
  const end = attention ? needleEnd(attention.zone) : null;
  const titleId = `${scope}-compass-dial-title`;
  const descId = `${scope}-compass-dial-desc`;
  const glowId = `${scope}-compass-dial-glow`;

  return (
    <svg
      aria-describedby={descId}
      aria-labelledby={titleId}
      className="mx-auto mt-3 block h-auto w-full max-w-[17rem]"
      role="img"
      viewBox="0 0 300 256"
    >
      <title id={titleId}>Sample Compass</title>
      <desc id={descId}>{describeCompass(points, attentionId)}</desc>
      <defs>
        <radialGradient cx="50%" cy="50%" id={glowId} r="50%">
          <stop offset="0%" stopColor="rgba(245,158,11,0.16)" />
          <stop offset="100%" stopColor="rgba(5,4,3,0.9)" />
        </radialGradient>
      </defs>
      <circle className="stroke-amber-200/30" cx={CENTER.x} cy={CENTER.y} fill={`url(#${glowId})`} r={96} strokeWidth={1.5} />
      <line className="stroke-stone-700" x1={150} x2={150} y1={36} y2={220} />
      <line className="stroke-stone-700" x1={58} x2={242} y1={128} y2={128} />
      <text className="fill-stone-400 text-[9px] tracking-[0.18em]" textAnchor="middle" x={150} y={18}>
        PRIORITY
      </text>
      <text className="fill-stone-400 text-[9px] tracking-[0.12em]" textAnchor="middle" x={24} y={131}>
        DETOUR
      </text>
      <text className="fill-stone-400 text-[9px] tracking-[0.12em]" textAnchor="middle" x={276} y={131}>
        DETOUR
      </text>
      <text className="fill-stone-400 text-[9px] tracking-[0.18em]" textAnchor="middle" x={150} y={248}>
        EXCURSION
      </text>
      {end ? (
        <line className="stroke-orange-300" strokeLinecap="round" strokeWidth={3} x1={CENTER.x} x2={end.x} y1={CENTER.y} y2={end.y} />
      ) : null}
      <circle className="fill-orange-200" cx={CENTER.x} cy={CENTER.y} r={4.5} />
      {points.map((point) => {
        const at = ZONE_POINTS[point.zone];
        const isPriority = point.id === priorityId;
        const isAttention = point.id === attentionId;
        // Forming bubbles carry a third line, so their label starts higher.
        const top = point.forming ? at.y - 8 : at.y - 3;

        return (
          <g key={point.id}>
            <circle
              className={joinClasses(
                isPriority ? "fill-amber-400/25" : "fill-stone-900/90",
                isAttention
                  ? "stroke-orange-300"
                  : isPriority
                    ? "stroke-amber-300"
                    : point.forming
                      ? "stroke-stone-300"
                      : "stroke-stone-600",
              )}
              cx={at.x}
              cy={at.y}
              r={BUBBLE_RADIUS}
              strokeDasharray={point.forming ? "4 3" : undefined}
              strokeWidth={isAttention || isPriority ? 2.5 : point.forming ? 1.6 : 1.2}
            />
            <text className="fill-stone-100 text-[9.5px] font-medium" textAnchor="middle" x={at.x} y={top}>
              <tspan x={at.x}>{point.labelLines[0]}</tspan>
              <tspan dy={11} x={at.x}>
                {point.labelLines[1]}
              </tspan>
              {point.forming ? (
                <tspan className="fill-stone-300 text-[8.5px] italic" dy={11} x={at.x}>
                  Forming
                </tspan>
              ) : null}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
