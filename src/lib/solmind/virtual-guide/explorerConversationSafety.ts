import "server-only";
import type { ExplorerPrivateConfigurationCandidate } from "./explorerPrivateConfiguration";
import {
  explorerSafetyUnicodeValid, parseExplorerSafetyClassification,
  type ExplorerSafetyCandidate, type ExplorerSafetyClassification,
  type ExplorerSafetyLevel, type ExplorerSafetyRequestMode,
} from "./explorerSafetyReplyContract";

export type ExplorerFallbackObservation =
  | Readonly<{ status: "available"; policyVersion: string; classification: ExplorerSafetyClassification }>
  | Readonly<{ status: "unavailable" }>;
export type ExplorerConversationPolicy =
  | Readonly<{ status: "known"; restrictedLevel: 3 | 4 | null; adultReflectionStopped: boolean; safetyVersion: number }>
  | Readonly<{ status: "unknown" }>;
export type ExplorerCombinedSafety = Readonly<{
  coverage: "combined" | "fallback_only" | "model_only" | "none";
  currentLevel: ExplorerSafetyLevel | null; minorIndicated: boolean;
  restrictedLevel: 3 | 4 | null; adultReflectionStopped: boolean; policyKnown: boolean;
}>;
const UNAVAILABLE = Object.freeze({ status: "unavailable" as const });
const AGE_PATTERN_TEXT = "(?<![\\p{L}\\p{N}_])(?:i am|i'm) (?:[0-9]|1[0-7])(?:(?: years? old| yo)(?![\\p{L}\\p{N}_])|(?=$|[!?,;]|\\.(?![0-9])| and(?: |$)))";
// Only this static reviewed rule executes. A configuration string never becomes
// a new RegExp or executable callback.
const MINOR_AGE = /(?<![\p{L}\p{N}_])(?:i am|i'm) (?:[0-9]|1[0-7])(?:(?: years? old| yo)(?![\p{L}\p{N}_])|(?=$|[!?,;]|\.(?![0-9])| and(?: |$)))/u;
const EXPECTED_RULES = Object.freeze({
  "self-intent": [4, false], "other-intent": [4, false], "passive-ideation": [3, false],
  "ongoing-abuse": [3, false], "immediate-danger": [4, false], "minor-statement": [0, true], "minor-age": [0, true],
} as const);
const PINNED_PHRASES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "self-intent": Object.freeze(["i want to kill myself", "i am going to kill myself", "i intend to kill myself"]),
  "other-intent": Object.freeze(["i am going to hurt someone", "i intend to hurt someone"]),
  "passive-ideation": Object.freeze(["wish i wouldn't wake up"]),
  "ongoing-abuse": Object.freeze(["i am being abused", "i'm being abused"]),
  "immediate-danger": Object.freeze(["i am in immediate danger", "i'm in immediate danger"]),
  "minor-statement": Object.freeze(["i am a minor", "i'm a minor"]),
});
function object(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return typeof key === "string" && descriptor?.enumerable && "value" in descriptor;
  });
}
function exact(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value); return actual.length === expected.length && actual.every((key) => expected.includes(key));
}
export function normalizeExplorerSafetyComparison(value: string): string | null {
  if (typeof value !== "string" || value.length < 1 || value.length > 8192 || !value.trim() || !explorerSafetyUnicodeValid(value)) return null;
  return value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[\u2018\u2019]/g, "'").replace(/\r\n?/g, "\n").replace(/\s+/gu, " ").trim();
}
function literalHit(text: string, phrase: string): boolean {
  let from = 0;
  while (from <= text.length) {
    const found = text.indexOf(phrase, from);
    if (found < 0) return false;
    if (!/[\p{L}\p{N}_]$/u.test(text.slice(0, found)) && !/^[\p{L}\p{N}_]/u.test(text.slice(found + phrase.length))) return true;
    from = found + 1;
  }
  return false;
}
// The caller supplies the configuration parser's frozen candidate projection.
// Structural failures are unavailable, never a fabricated clear observation.
export function detectExplorerFallback(message: string, configuration: ExplorerPrivateConfigurationCandidate["fallback"] | null | undefined): ExplorerFallbackObservation {
  try {
    const normalized = normalizeExplorerSafetyComparison(message);
    const raw: unknown = configuration;
    if (normalized === null || !object(raw) || !exact(raw, ["version", "normalizationVersion", "normalization", "matching", "rules", "combination"]) ||
      typeof raw.version !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(raw.version) ||
      raw.normalizationVersion !== "nfkc-en-US-apostrophe-whitespace.v1" || !Array.isArray(raw.normalization) ||
      raw.normalization.length < 1 || raw.normalization.some((line) => typeof line !== "string" || !line) ||
      typeof raw.matching !== "string" || !raw.matching || typeof raw.combination !== "string" || !raw.combination ||
      !Array.isArray(raw.rules) || raw.rules.length !== 7) return UNAVAILABLE;
    let level: ExplorerSafetyLevel = 0; let minor = false;
    const seen = new Set<string>();
    for (const rule of raw.rules) {
      if (!object(rule) || typeof rule.id !== "string" || !Object.hasOwn(EXPECTED_RULES, rule.id) || seen.has(rule.id)) return UNAVAILABLE;
      seen.add(rule.id);
      const expected = EXPECTED_RULES[rule.id as keyof typeof EXPECTED_RULES];
      if (rule.level !== expected[0] || rule.minorIndicated !== expected[1] || typeof rule.source !== "string" || !rule.source) return UNAVAILABLE;
      let hit: boolean;
      if (rule.id === "minor-age") {
        if (!exact(rule, ["id", "kind", "pattern", "level", "minorIndicated", "source"]) ||
          rule.kind !== "first_person_minor_age_v1" || rule.pattern !== AGE_PATTERN_TEXT) return UNAVAILABLE;
        hit = MINOR_AGE.test(normalized);
      } else {
        if (!exact(rule, ["id", "kind", "phrases", "level", "minorIndicated", "source"]) || rule.kind !== "literal_phrases" ||
          !Array.isArray(rule.phrases) || rule.phrases.length < 1 || rule.phrases.length > 8 ||
          rule.phrases.length !== PINNED_PHRASES[rule.id].length ||
          rule.phrases.some((phrase, index) => typeof phrase !== "string" || phrase.length > 160 ||
            normalizeExplorerSafetyComparison(phrase) !== phrase || phrase !== PINNED_PHRASES[rule.id as string][index])) return UNAVAILABLE;
        hit = rule.phrases.some((phrase) => literalHit(normalized, phrase as string));
      }
      if (hit) { level = Math.max(level, expected[0]) as ExplorerSafetyLevel; minor ||= expected[1]; }
    }
    return Object.freeze({ status: "available", policyVersion: raw.version,
      classification: Object.freeze({ level, minorIndicated: minor }) });
  } catch { return UNAVAILABLE; }
}
function knownPolicy(policy: ExplorerConversationPolicy): policy is Extract<ExplorerConversationPolicy, { status: "known" }> {
  return policy.status === "known" && [null, 3, 4].includes(policy.restrictedLevel) &&
    typeof policy.adultReflectionStopped === "boolean" && Number.isSafeInteger(policy.safetyVersion) && policy.safetyVersion >= 0;
}
export function selectExplorerSafetyRequestMode(policy: ExplorerConversationPolicy, fallback: ExplorerFallbackObservation): ExplorerSafetyRequestMode | null {
  if (!knownPolicy(policy) || fallback.status !== "available") return null;
  const observed = parseExplorerSafetyClassification(fallback.classification);
  if (observed === null) return null;
  return policy.restrictedLevel !== null || policy.adultReflectionStopped || observed.level >= 3 || observed.minorIndicated
    ? "classification_only" : "classification_and_reply";
}
export function combineExplorerSafety(input: Readonly<{
  policy: ExplorerConversationPolicy; fallback: ExplorerFallbackObservation; model: ExplorerSafetyClassification | null;
}>): ExplorerCombinedSafety {
  const fallback = input.fallback.status === "available" ? parseExplorerSafetyClassification(input.fallback.classification) : null;
  const model = parseExplorerSafetyClassification(input.model);
  const policy = knownPolicy(input.policy) ? input.policy : null;
  const available = [fallback, model].filter((part): part is ExplorerSafetyClassification => part !== null);
  const currentLevel = available.length ? Math.max(...available.map((part) => part.level)) as ExplorerSafetyLevel : null;
  const minorIndicated = available.some((part) => part.minorIndicated);
  const oldFloor = policy?.restrictedLevel ?? null;
  const floor = Math.max(oldFloor ?? 0, currentLevel ?? 0);
  return Object.freeze({ coverage: fallback && model ? "combined" : fallback ? "fallback_only" : model ? "model_only" : "none",
    currentLevel, minorIndicated, restrictedLevel: floor >= 3 ? floor as 3 | 4 : null,
    adultReflectionStopped: (policy?.adultReflectionStopped ?? false) || minorIndicated, policyKnown: policy !== null });
}
export function requiresExplorerSafetyEvidence(fallback: ExplorerFallbackObservation, model: ExplorerSafetyClassification | null): boolean {
  const actualFallback = fallback.status === "available" ? parseExplorerSafetyClassification(fallback.classification) : null;
  const actualModel = parseExplorerSafetyClassification(model);
  return (actualFallback?.level ?? 0) > 0 || (actualModel?.level ?? 0) > 0;
}
export type ExplorerSafetyReplyPlan = Readonly<{
  kind: "ordinary" | "urgent" | "crisis" | "restricted_followup" | "adult_only" | "unavailable" | "uncertain";
  configurationVersion: string; ordinaryCandidate: string | null;
  beforeResources: readonly string[]; afterResources: readonly string[];
  resourceRequirement: "reviewed_adult" | "reviewed_age_appropriate" | null;
  adultBoundaryIncluded: boolean; requiredPersistenceConfirmed: boolean;
  operationalFailureSignalRequired: boolean;
}>;
// This selects intent and exact candidate segments only. It neither validates
// resource readiness nor authorizes outward delivery, persistence or activation.
export function selectExplorerSafetyReply(input: Readonly<{
  safety: ExplorerCombinedSafety; candidate: ExplorerSafetyCandidate;
  trusted: ExplorerPrivateConfigurationCandidate["trustedResponses"];
  persistence: "pending" | "confirmed" | "failed" | "unconfirmed";
}>): ExplorerSafetyReplyPlan {
  const { safety, trusted } = input;
  const critical = safety.restrictedLevel !== null || safety.adultReflectionStopped;
  const persistenceFailed = input.persistence === "failed" || input.persistence === "unconfirmed";
  const before: string[] = []; const after: string[] = [];
  let kind: ExplorerSafetyReplyPlan["kind"];
  let resources: ExplorerSafetyReplyPlan["resourceRequirement"] = null;
  let ordinaryCandidate: string | null = null;
  if (safety.currentLevel === 4 || safety.currentLevel === 3) {
    kind = safety.currentLevel === 4 ? "crisis" : "urgent";
    const response = safety.currentLevel === 4 ? trusted.crisis : trusted.urgent;
    before.push(response.acknowledgment, response.limits); after.push(response.humanConnection);
    resources = safety.adultReflectionStopped ? "reviewed_age_appropriate" : "reviewed_adult";
  } else if (safety.adultReflectionStopped) {
    kind = "adult_only"; before.push(trusted.adultOnly); resources = "reviewed_age_appropriate";
  } else if (safety.restrictedLevel !== null) {
    kind = "restricted_followup"; before.push(trusted.restrictedFollowup);
  } else if (safety.policyKnown && safety.coverage === "combined" && input.candidate.kind === "usable" && !persistenceFailed) {
    kind = "ordinary"; ordinaryCandidate = input.candidate.content;
  } else {
    kind = input.persistence === "unconfirmed" ? "uncertain" : "unavailable";
    before.push(kind === "uncertain" ? trusted.uncertainCompletion : trusted.ordinaryUnavailable);
  }
  if ((kind === "crisis" || kind === "urgent") && safety.adultReflectionStopped) after.push(trusted.adultOnly);
  if (critical && persistenceFailed) before.unshift(trusted.criticalPersistenceFailurePrefix);
  return Object.freeze({ kind, configurationVersion: trusted.version, ordinaryCandidate,
    beforeResources: Object.freeze(before), afterResources: Object.freeze(after), resourceRequirement: resources,
    adultBoundaryIncluded: safety.adultReflectionStopped, requiredPersistenceConfirmed: input.persistence === "confirmed",
    operationalFailureSignalRequired: critical && persistenceFailed });
}
