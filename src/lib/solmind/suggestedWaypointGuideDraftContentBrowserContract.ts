// PRJ01_V-WS05-WI022-S03 browser-safe Guide draft content contract.
//
// This side-effect-free owner snapshots only plain data properties and applies
// the exact content boundary shared by Guide detail parsing, browser command
// construction, and the authenticated server route. Identity, relationship,
// lifecycle, revision, function, and result authority remain outside this file.

export const SUGGESTED_WAYPOINT_GUIDE_DRAFT_ISSUES = Object.freeze({
  invalidShape: "invalid_shape",
  destination: "destination_invalid",
  why: "why_invalid",
  arrivalSignals: "arrival_signals_invalid",
} as const);

export type SuggestedWaypointGuideDraftIssue =
  (typeof SUGGESTED_WAYPOINT_GUIDE_DRAFT_ISSUES)[keyof typeof SUGGESTED_WAYPOINT_GUIDE_DRAFT_ISSUES];

export type SuggestedWaypointGuideDraftContent = Readonly<{
  destination: string;
  why: string;
  arrivalSignals: readonly string[];
}>;

export type SuggestedWaypointGuideDraftContentResult =
  | Readonly<{
      ok: true;
      data: SuggestedWaypointGuideDraftContent;
      issues: readonly [];
    }>
  | Readonly<{
      ok: false;
      data: null;
      issues: readonly SuggestedWaypointGuideDraftIssue[];
    }>;

function readDataPropertySnapshot(value: unknown): Record<string, unknown> | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return null;
    }
    const prototype = Reflect.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return null;
    }
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== "string")) {
      return null;
    }
    const snapshot: Record<string, unknown> = Object.create(null);
    for (const key of keys as string[]) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor)
      ) {
        return null;
      }
      snapshot[key] = descriptor.value;
    }
    return snapshot;
  } catch {
    return null;
  }
}

function snapshotArray(value: unknown): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || Reflect.getPrototypeOf(value) !== Array.prototype) {
      return null;
    }
    const keys = Reflect.ownKeys(value);
    if (
      keys.some((key) => typeof key !== "string") ||
      keys.some((key) => key !== "length" && !/^(0|[1-9][0-9]*)$/u.test(key as string))
    ) {
      return null;
    }
    const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, "length");
    const length = lengthDescriptor?.value;
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(length) ||
      Number(length) < 0
    ) {
      return null;
    }
    const snapshot: unknown[] = [];
    for (let index = 0; index < Number(length); index += 1) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor)
      ) {
        return null;
      }
      snapshot.push(descriptor.value);
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function hasIsolatedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        return true;
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function hasForbiddenControl(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (
      code === 0 ||
      (code >= 1 && code <= 8) ||
      (code >= 11 && code <= 12) ||
      (code >= 14 && code <= 31) ||
      (code >= 127 && code <= 159) ||
      code === 0x2028 ||
      code === 0x2029
    ) {
      return true;
    }
  }
  return false;
}

function isBoundedText(
  value: unknown,
  maximum: number,
  singleLine: boolean,
): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const length = Array.from(value).length;
  return (
    length >= 1 &&
    length <= maximum &&
    value === value.trim() &&
    value === value.normalize("NFC") &&
    !value.includes("\r") &&
    (!singleLine || !value.includes("\n")) &&
    !hasIsolatedSurrogate(value) &&
    !hasForbiddenControl(value)
  );
}

function invalid(
  issues: readonly SuggestedWaypointGuideDraftIssue[],
): SuggestedWaypointGuideDraftContentResult {
  return Object.freeze({
    ok: false,
    data: null,
    issues: Object.freeze([...new Set(issues)]),
  });
}

export function snapshotSuggestedWaypointGuideDraftContent(
  value: unknown,
): SuggestedWaypointGuideDraftContentResult {
  const snapshot = readDataPropertySnapshot(value);
  if (
    snapshot === null ||
    Object.keys(snapshot).length !== 3 ||
    !("destination" in snapshot) ||
    !("why" in snapshot) ||
    !("arrivalSignals" in snapshot)
  ) {
    return invalid([SUGGESTED_WAYPOINT_GUIDE_DRAFT_ISSUES.invalidShape]);
  }

  const issues: SuggestedWaypointGuideDraftIssue[] = [];
  if (!isBoundedText(snapshot.destination, 160, true)) {
    issues.push(SUGGESTED_WAYPOINT_GUIDE_DRAFT_ISSUES.destination);
  }
  if (!isBoundedText(snapshot.why, 1000, false)) {
    issues.push(SUGGESTED_WAYPOINT_GUIDE_DRAFT_ISSUES.why);
  }

  const rawSignals = snapshotArray(snapshot.arrivalSignals);
  const signals: string[] = [];
  if (rawSignals === null || rawSignals.length < 1 || rawSignals.length > 8) {
    issues.push(SUGGESTED_WAYPOINT_GUIDE_DRAFT_ISSUES.arrivalSignals);
  } else {
    const seen = new Set<string>();
    for (const signal of rawSignals) {
      if (!isBoundedText(signal, 240, false) || seen.has(signal)) {
        issues.push(SUGGESTED_WAYPOINT_GUIDE_DRAFT_ISSUES.arrivalSignals);
        break;
      }
      seen.add(signal);
      signals.push(signal);
    }
  }

  if (issues.length > 0) {
    return invalid(issues);
  }

  return Object.freeze({
    ok: true,
    data: Object.freeze({
      destination: snapshot.destination as string,
      why: snapshot.why as string,
      arrivalSignals: Object.freeze(signals),
    }),
    issues: [] as const,
  });
}
