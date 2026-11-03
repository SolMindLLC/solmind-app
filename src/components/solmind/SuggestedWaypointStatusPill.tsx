type SuggestedWaypointStatusPillProps = Readonly<{
  children: React.ReactNode;
  tone?: "attention" | "neutral" | "positive" | "private";
  // "dark" is for the signed-in Explorer and Guide Waypoint pages in the dark
  // and amber workspace frame (Paul's 2026-11-02 decisions); the fixture
  // review surfaces keep the default light pills.
  surface?: "light" | "dark";
}>;

type Tone = NonNullable<SuggestedWaypointStatusPillProps["tone"]>;

const TONE_CLASSES: Record<Tone, string> = {
  attention: "border-amber-500 bg-amber-50 text-amber-900",
  neutral: "border-slate-400 bg-slate-50 text-slate-700",
  positive: "border-emerald-600 bg-emerald-50 text-emerald-900",
  private: "border-indigo-500 bg-indigo-50 text-indigo-900",
};

const DARK_TONE_CLASSES: Record<Tone, string> = {
  attention: "border-amber-400/70 bg-amber-950/60 text-amber-100",
  neutral: "border-stone-500 bg-stone-900/70 text-stone-200",
  positive: "border-emerald-400/70 bg-emerald-950/60 text-emerald-100",
  private: "border-indigo-300/70 bg-indigo-950/60 text-indigo-100",
};

export function SuggestedWaypointStatusPill({
  children,
  tone = "neutral",
  surface = "light",
}: SuggestedWaypointStatusPillProps) {
  const toneClasses = surface === "dark" ? DARK_TONE_CLASSES[tone] : TONE_CLASSES[tone];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClasses}`}
    >
      {children}
    </span>
  );
}
