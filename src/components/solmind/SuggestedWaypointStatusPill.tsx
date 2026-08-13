type SuggestedWaypointStatusPillProps = Readonly<{
  children: React.ReactNode;
  tone?: "attention" | "neutral" | "positive" | "private";
}>;

const TONE_CLASSES: Record<
  NonNullable<SuggestedWaypointStatusPillProps["tone"]>,
  string
> = {
  attention: "border-amber-500 bg-amber-50 text-amber-900",
  neutral: "border-slate-400 bg-slate-50 text-slate-700",
  positive: "border-emerald-600 bg-emerald-50 text-emerald-900",
  private: "border-indigo-500 bg-indigo-50 text-indigo-900",
};

export function SuggestedWaypointStatusPill({
  children,
  tone = "neutral",
}: SuggestedWaypointStatusPillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
