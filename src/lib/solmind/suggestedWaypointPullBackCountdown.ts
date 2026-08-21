// PRJ01_V-WS05-WI022-S03 display-only Pull Back countdown.
//
// The browser clock can provide orientation, but it never authorizes Pull Back.
// The authenticated command route and database deadline remain authoritative.

export type SuggestedWaypointPullBackCountdown = Readonly<{
  expiredEstimate: boolean;
  label: string;
  remainingSeconds: number;
}>;

export function getSuggestedWaypointPullBackCountdown(
  deadlineAt: string,
  nowMilliseconds: number,
): SuggestedWaypointPullBackCountdown | null {
  const deadlineMilliseconds = Date.parse(deadlineAt);
  if (
    !Number.isFinite(deadlineMilliseconds) ||
    !Number.isFinite(nowMilliseconds)
  ) {
    return null;
  }

  const remainingSeconds = Math.max(
    0,
    Math.ceil((deadlineMilliseconds - nowMilliseconds) / 1_000),
  );
  if (remainingSeconds === 0) {
    return Object.freeze({
      expiredEstimate: true,
      label: "The browser estimate has reached zero. The server confirms exact availability.",
      remainingSeconds,
    });
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = String(remainingSeconds % 60).padStart(2, "0");
  return Object.freeze({
    expiredEstimate: false,
    label: `Estimated Pull Back time remaining: ${minutes}:${seconds}.`,
    remainingSeconds,
  });
}
