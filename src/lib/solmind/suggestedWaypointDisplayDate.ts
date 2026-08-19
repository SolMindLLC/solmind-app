const SUGGESTED_WAYPOINT_DISPLAY_LOCALE = "en-US";

type SuggestedWaypointDisplayDateOptions = Readonly<{
  timeZone?: string;
}>;

function parseDisplayDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Suggested Waypoint display date must be a valid timestamp.");
  }
  return date;
}

export function formatSuggestedWaypointDate(
  value: string,
  options: SuggestedWaypointDisplayDateOptions = {},
): string {
  return new Intl.DateTimeFormat(SUGGESTED_WAYPOINT_DISPLAY_LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(options.timeZone === undefined ? {} : { timeZone: options.timeZone }),
  }).format(parseDisplayDate(value));
}

export function formatSuggestedWaypointDateTime(
  value: string,
  options: SuggestedWaypointDisplayDateOptions = {},
): string {
  return new Intl.DateTimeFormat(SUGGESTED_WAYPOINT_DISPLAY_LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    ...(options.timeZone === undefined ? {} : { timeZone: options.timeZone }),
  }).format(parseDisplayDate(value));
}
