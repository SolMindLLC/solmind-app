// Closed, token-free evidence schema for future local Supabase Auth probes.
// Arbitrary strings and extra properties are rejected so raw Auth responses,
// emails, UUIDs, action links, OTPs, credentials, and tokens have nowhere to land.

export type ProviderProbeId =
  | "PP-00"
  | "PP-01"
  | "PP-02"
  | "PP-03"
  | "PP-04"
  | "PP-05"
  | "PP-06"
  | "PP-07"
  | "PP-08"
  | "PP-09"
  | "PP-10"
  | "PP-11"
  | "PP-12";

export type ProviderProbeOutcome = "pass" | "fail" | "blocked";
export type ProviderProbeProfile = "current-config" | "locked-down";
export type ProviderProbeCleanupOutcome =
  | "not-needed"
  | "not-attempted"
  | "complete"
  | "failed";
export type ProviderProbeErrorClass =
  | "none"
  | "invalid-request"
  | "identity-mismatch"
  | "rate-limited"
  | "provider-denied"
  | "cleanup-failed"
  | "sensitive-material-detected"
  | "unexpected";

export type ProviderProbeEvidence = Readonly<{
  probeId: ProviderProbeId;
  profile: ProviderProbeProfile;
  outcome: ProviderProbeOutcome;
  errorClass: ProviderProbeErrorClass;
  userDelta: number;
  sessionDelta: number;
  messageDelta: number;
  requestCount: number;
  identityMatched: boolean | null;
  cookieWriteCount: number;
  providerLifetimeSeconds: number | null;
  cleanupOutcome: ProviderProbeCleanupOutcome;
  sensitiveMaterialScanPassed: boolean;
}>;

const EXACT_KEYS = [
  "probeId",
  "profile",
  "outcome",
  "errorClass",
  "userDelta",
  "sessionDelta",
  "messageDelta",
  "requestCount",
  "identityMatched",
  "cookieWriteCount",
  "providerLifetimeSeconds",
  "cleanupOutcome",
  "sensitiveMaterialScanPassed",
] as const;

const PROBE_IDS = new Set<ProviderProbeId>([
  "PP-00", "PP-01", "PP-02", "PP-03", "PP-04", "PP-05", "PP-06",
  "PP-07", "PP-08", "PP-09", "PP-10", "PP-11", "PP-12",
]);
const PROFILES = new Set<ProviderProbeProfile>(["current-config", "locked-down"]);
const OUTCOMES = new Set<ProviderProbeOutcome>(["pass", "fail", "blocked"]);
const ERROR_CLASSES = new Set<ProviderProbeErrorClass>([
  "none", "invalid-request", "identity-mismatch", "rate-limited",
  "provider-denied", "cleanup-failed", "sensitive-material-detected",
  "unexpected",
]);
const CLEANUP_OUTCOMES = new Set<ProviderProbeCleanupOutcome>([
  "not-needed", "not-attempted", "complete", "failed",
]);

function isBoundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}

function hasExactKeys(input: Record<string, unknown>): boolean {
  const keys = Object.keys(input).sort();
  return keys.length === EXACT_KEYS.length &&
    keys.every((key, index) => key === [...EXACT_KEYS].sort()[index]);
}

function hasMaterialEffect(value: Record<string, unknown>): boolean {
  return value.userDelta !== 0 ||
    value.sessionDelta !== 0 ||
    value.messageDelta !== 0 ||
    value.cookieWriteCount !== 0;
}

function hasCoherentOutcome(value: Record<string, unknown>): boolean {
  if (value.outcome === "pass") {
    return value.errorClass === "none" &&
      value.sensitiveMaterialScanPassed === true &&
      value.cookieWriteCount === 0 &&
      (value.cleanupOutcome === "complete" ||
        value.cleanupOutcome === "not-needed");
  }

  if (value.errorClass === "none") {
    return false;
  }

  if (
    (value.cleanupOutcome === "failed") !==
    (value.errorClass === "cleanup-failed")
  ) {
    return false;
  }

  if (
    (value.sensitiveMaterialScanPassed === false) !==
    (value.errorClass === "sensitive-material-detected")
  ) {
    return false;
  }

  if (value.outcome === "blocked") {
    return !hasMaterialEffect(value) &&
      value.identityMatched === null &&
      value.providerLifetimeSeconds === null &&
      (value.cleanupOutcome === "not-needed" ||
        value.cleanupOutcome === "not-attempted");
  }

  return true;
}

export function createProviderProbeEvidence(input: unknown): ProviderProbeEvidence {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("provider_probe_evidence_invalid_shape");
  }

  const value = input as Record<string, unknown>;
  if (!hasExactKeys(value)) {
    throw new Error("provider_probe_evidence_unapproved_field");
  }

  if (
    !PROBE_IDS.has(value.probeId as ProviderProbeId) ||
    !PROFILES.has(value.profile as ProviderProbeProfile) ||
    !OUTCOMES.has(value.outcome as ProviderProbeOutcome) ||
    !ERROR_CLASSES.has(value.errorClass as ProviderProbeErrorClass) ||
    !CLEANUP_OUTCOMES.has(value.cleanupOutcome as ProviderProbeCleanupOutcome) ||
    !isBoundedInteger(value.userDelta, 0, 10) ||
    !isBoundedInteger(value.sessionDelta, 0, 10) ||
    !isBoundedInteger(value.messageDelta, 0, 100) ||
    !isBoundedInteger(value.requestCount, 0, 100) ||
    !isBoundedInteger(value.cookieWriteCount, 0, 10) ||
    !(value.identityMatched === null || typeof value.identityMatched === "boolean") ||
    !(value.providerLifetimeSeconds === null ||
      isBoundedInteger(value.providerLifetimeSeconds, 1, 86400)) ||
    typeof value.sensitiveMaterialScanPassed !== "boolean"
  ) {
    throw new Error("provider_probe_evidence_invalid_value");
  }

  if (
    !hasCoherentOutcome(value) ||
    (value.cleanupOutcome === "not-needed" &&
      (value.userDelta !== 0 ||
        value.sessionDelta !== 0 ||
        value.messageDelta !== 0))
  ) {
    throw new Error("provider_probe_evidence_incoherent_outcome");
  }

  return Object.freeze(value) as ProviderProbeEvidence;
}

export function serializeProviderProbeEvidence(evidence: ProviderProbeEvidence): string {
  const serialized = JSON.stringify(evidence);
  if (
    /@/.test(serialized) ||
    /\bBearer\b/i.test(serialized) ||
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(serialized) ||
    /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(serialized) ||
    /(?:access|refresh|hashed|token_hash|action_link|email_otp|password|secret|apikey)/i.test(serialized)
  ) {
    throw new Error("provider_probe_evidence_secret_pattern");
  }
  return serialized;
}
