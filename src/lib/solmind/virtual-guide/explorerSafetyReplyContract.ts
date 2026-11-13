import "server-only";
import { createHash } from "node:crypto";

export const EXPLORER_SAFETY_REQUEST_VERSION = "explorer-safety-request.v2" as const;
export const EXPLORER_SAFETY_REPLY_PROTOCOL = "explorer-safety-reply.v2" as const;
export const EXPLORER_SAFETY_REPLY_LIMITS = Object.freeze({
  contextUtf8Bytes: 524_288, modelBodyUtf8Bytes: 262_144,
  candidateUtf16Units: 8_192, candidateWords: 300,
  choices: 3, choiceLabelCharacters: 40, compassTopics: 3, compassSupportRefs: 3, compassLabelCharacters: 160,
  minimumTimeoutMilliseconds: 10, maximumTimeoutMilliseconds: 60_000,
});
// Correction D-12 (2026-11-09; REV341b finding 3): one overall deadline for a Send, set when the Send starts: the setup
// allowance (every step before the reply) plus the provider model's reply limit plus a reserve for the steps after
// the reply (trusted rendering and settlement), capped at the ceiling. Every step keeps its own limit but never waits
// past the time left, and the reply gets the smaller of its limit and the time left before the reserve. The screen
// waits the ceiling plus a margin (EXPLORER_SEND_SCREEN_LIMIT_MILLISECONDS), which leaves the server time to answer first.
// Paul's decisions, PRJ01-SPR002 decision queue, meeting part 2 entry, items 4, 6 and 7; the values are the Executor's
// proposal, shown to Paul with the change. The clock starts when the server receives the request, before it reads the
// message. Prepare saves and counts the message, so it starts only while the time before the reserve still covers its
// own alarm (prepareAllowanceMilliseconds, at least the prepare port's limit) plus a minimum reply window; otherwise the
// Send is refused before the message is saved or the Send counted (review of D-12, finding 2).
export const EXPLORER_SEND_TIME_LIMITS = Object.freeze({
  setupAllowanceMilliseconds: 25_000,
  savingReserveMilliseconds: 15_000,
  prepareAllowanceMilliseconds: 10_000,
  minimumReplyMilliseconds: 15_000,
  ceilingMilliseconds: 120_000,
  screenMarginMilliseconds: 10_000,
});
export function explorerSendDeadlineMilliseconds(replyLimitMilliseconds: number): number {
  return Math.min(EXPLORER_SEND_TIME_LIMITS.ceilingMilliseconds,
    EXPLORER_SEND_TIME_LIMITS.setupAllowanceMilliseconds + replyLimitMilliseconds + EXPLORER_SEND_TIME_LIMITS.savingReserveMilliseconds);
}
export type ExplorerSafetyLevel = 0 | 1 | 2 | 3 | 4;
export type ExplorerSafetyClassification = Readonly<{ level: ExplorerSafetyLevel; minorIndicated: boolean }>;
export type ExplorerSafetyRequestMode = "classification_and_reply" | "classification_only";
export type ExplorerSafetyReplyRequest = Readonly<{
  contractVersion: typeof EXPLORER_SAFETY_REQUEST_VERSION;
  invocationId: string; explorerId: string; sessionId: string; contextSnapshotId: string;
  contextFingerprint: string; authorizedContext: string; mode: ExplorerSafetyRequestMode;
  classificationPolicyVersion: string; fallbackPolicyVersion: string; instructionVersion: string;
}>;
export type ExplorerSafetyCandidate =
  | Readonly<{ kind: "usable"; content: string }>
  | Readonly<{ kind: "unusable" }>
  | Readonly<{ kind: "not_requested" }>;
export type ExplorerSafetyCompassSuggestion = Readonly<{ label: string; pointId?: string }>;
export type ExplorerSafetyCompassResponse = Readonly<{ pointId: string; response: "right" | "close" | "not_it" }>;
export type ExplorerSafetyWaypointSuggestion = Readonly<{
  title: string; destination: string; whyItMatters: string; arrivalSignal: string;
}>;
export type ExplorerSafetyWaypointResponse = Readonly<{ draftId: string; response: "right" | "close" | "not_it" }>;
export type ExplorerSafetyCompassTopic = Readonly<{
  topicId: string | null; label: string; supportRefs: readonly string[]; ready: boolean;
}>;
export type ExplorerSafetyCompass = Readonly<{
  attention?: string | null; topics?: readonly ExplorerSafetyCompassTopic[];
}>;
export type ExplorerSafetyChoice = Readonly<{ label: string }>;
export type ExplorerSafetyReplyObservation = Readonly<{
  classification: ExplorerSafetyClassification; candidate: ExplorerSafetyCandidate;
  compass?: ExplorerSafetyCompass; choices?: readonly ExplorerSafetyChoice[];
  waypointSuggestion?: ExplorerSafetyWaypointSuggestion;
  waypointResponse?: ExplorerSafetyWaypointResponse;
}>;
export type ExplorerSafetyReplyErrorCode =
  | "explorer_safety_invalid_request" | "explorer_safety_invalid_response"
  | "explorer_safety_limit_exceeded" | "explorer_safety_invalid_transport";
export class ExplorerSafetyReplyError extends Error {
  constructor(readonly code: ExplorerSafetyReplyErrorCode) { super(code); this.name = "ExplorerSafetyReplyError"; }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const SHA = /^[0-9a-f]{64}$/i;
const PROHIBITED = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200d\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;
const WORDS = new Intl.Segmenter("en", { granularity: "word" });
const UNUSABLE = Object.freeze({ kind: "unusable" as const });
const NOT_REQUESTED = Object.freeze({ kind: "not_requested" as const });

function fail(code: ExplorerSafetyReplyErrorCode): never { throw new ExplorerSafetyReplyError(code); }
// No property values are read until the closed own-data shape is established.
function dataObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const actual = Reflect.ownKeys(value);
  return actual.length === keys.length && actual.every((key) => {
    if (typeof key !== "string" || !keys.includes(key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && descriptor.enumerable && "value" in descriptor;
  });
}
export function explorerSafetyUnicodeValid(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}
export function parseExplorerSafetyClassification(input: unknown): ExplorerSafetyClassification | null {
  try {
    if (!dataObject(input, ["level", "minorIndicated"]) || !Number.isInteger(input.level) ||
      (input.level as number) < 0 || (input.level as number) > 4 || typeof input.minorIndicated !== "boolean") return null;
    return Object.freeze({ level: input.level as ExplorerSafetyLevel, minorIndicated: input.minorIndicated });
  } catch { return null; }
}
export function parseExplorerSafetyReplyRequest(input: unknown): ExplorerSafetyReplyRequest {
  try {
    if (!dataObject(input, ["contractVersion", "invocationId", "explorerId", "sessionId", "contextSnapshotId",
      "contextFingerprint", "authorizedContext", "mode", "classificationPolicyVersion", "fallbackPolicyVersion", "instructionVersion"]) ||
      input.contractVersion !== EXPLORER_SAFETY_REQUEST_VERSION ||
      !["classification_and_reply", "classification_only"].includes(input.mode as string) ||
      ![input.invocationId, input.explorerId, input.sessionId, input.contextSnapshotId].every((id) => typeof id === "string" && UUID.test(id)) ||
      ![input.classificationPolicyVersion, input.fallbackPolicyVersion, input.instructionVersion].every((version) => typeof version === "string" && VERSION.test(version)) ||
      typeof input.contextFingerprint !== "string" || !SHA.test(input.contextFingerprint) ||
      typeof input.authorizedContext !== "string" || !explorerSafetyUnicodeValid(input.authorizedContext)) fail("explorer_safety_invalid_request");
    if (Buffer.byteLength(input.authorizedContext, "utf8") > EXPLORER_SAFETY_REPLY_LIMITS.contextUtf8Bytes) fail("explorer_safety_limit_exceeded");
    const context: unknown = JSON.parse(input.authorizedContext);
    if (context === null || typeof context !== "object" || Array.isArray(context) || JSON.stringify(context) !== input.authorizedContext ||
      createHash("sha256").update(input.authorizedContext, "utf8").digest("hex").toUpperCase() !== input.contextFingerprint.toUpperCase()) fail("explorer_safety_invalid_request");
    return Object.freeze({
      contractVersion: EXPLORER_SAFETY_REQUEST_VERSION, invocationId: input.invocationId as string,
      explorerId: input.explorerId as string, sessionId: input.sessionId as string,
      contextSnapshotId: input.contextSnapshotId as string, contextFingerprint: input.contextFingerprint.toUpperCase(),
      authorizedContext: input.authorizedContext, mode: input.mode as ExplorerSafetyRequestMode,
      classificationPolicyVersion: input.classificationPolicyVersion as string,
      fallbackPolicyVersion: input.fallbackPolicyVersion as string, instructionVersion: input.instructionVersion as string,
    });
  } catch (error) {
    if (error instanceof ExplorerSafetyReplyError) throw error;
    fail("explorer_safety_invalid_request");
  }
}
function candidate(input: unknown): ExplorerSafetyCandidate {
  if (!dataObject(input, ["content"]) || typeof input.content !== "string" || !explorerSafetyUnicodeValid(input.content)) return UNUSABLE;
  const content = input.content.replace(/\r\n?/g, "\n").trim();
  if (!content || content.length > EXPLORER_SAFETY_REPLY_LIMITS.candidateUtf16Units || PROHIBITED.test(content)) return UNUSABLE;
  let words = 0;
  for (const segment of WORDS.segment(content)) {
    if (segment.isWordLike && ++words > EXPLORER_SAFETY_REPLY_LIMITS.candidateWords) return UNUSABLE;
  }
  return Object.freeze({ kind: "usable", content });
}
export function parseExplorerSafetyCompassTopics(input: unknown): readonly ExplorerSafetyCompassTopic[] | undefined {
  try {
    if (!Array.isArray(input) || input.length > EXPLORER_SAFETY_REPLY_LIMITS.compassTopics) return undefined;
    const result: ExplorerSafetyCompassTopic[] = [];
    const identities = new Set<string>();
    for (const item of input) {
      if (item === null || typeof item !== "object" || Array.isArray(item) ||
          !dataObject(item, Reflect.ownKeys(item) as string[])) continue;
      // Duplicate targets invalidate the batch, even if another field of an entry is malformed.
      const identity = typeof item.topicId === "string" && UUID.test(item.topicId) ? item.topicId
        : item.topicId === null && typeof item.label === "string" ? "new:" + item.label : null;
      if (identity !== null) {
        if (identities.has(identity)) return undefined;
        identities.add(identity);
      }
      if (!dataObject(item, ["topicId", "label", "supportRefs", "ready"])) continue;
      if (!(item.topicId === null || (typeof item.topicId === "string" && UUID.test(item.topicId))) ||
          typeof item.label !== "string" || !explorerSafetyUnicodeValid(item.label) ||
          !item.label.trim() || item.label !== item.label.trim() ||
          item.label.length > EXPLORER_SAFETY_REPLY_LIMITS.compassLabelCharacters ||
          PROHIBITED.test(item.label) || /[\n\u2028\u2029]/u.test(item.label) ||
          typeof item.ready !== "boolean" || !Array.isArray(item.supportRefs) ||
          item.supportRefs.length > EXPLORER_SAFETY_REPLY_LIMITS.compassSupportRefs ||
          (item.topicId === null && item.supportRefs.length === 0) ||
          item.supportRefs.some(ref => typeof ref !== "string" || !/^(now|h(?:[0-9]|1[0-9]|2[0-3]))$/.test(ref)) ||
          new Set(item.supportRefs).size !== item.supportRefs.length) continue;
      result.push(Object.freeze({ topicId: item.topicId, label: item.label,
        supportRefs: Object.freeze([...item.supportRefs]), ready: item.ready }));
    }
    return Object.freeze(result);
  } catch { return undefined; }
}
function compass(input: unknown): ExplorerSafetyCompass | undefined {
  try {
    if (input === null || typeof input !== "object" || Array.isArray(input)) return undefined;
    const keys = Reflect.ownKeys(input);
    if (keys.some(key => typeof key !== "string" || !["attention", "topics", "suggestions", "responses"].includes(key)) ||
        !dataObject(input, keys as string[])) return undefined;
    // Retired values are deliberately not interpreted; optional siblings remain independent.
    const validAttention = input.attention === null ||
      (typeof input.attention === "string" && input.attention.length === 36 && UUID.test(input.attention));
    const topics = parseExplorerSafetyCompassTopics(input.topics);
    if (!validAttention && topics === undefined) return undefined;
    return Object.freeze({ ...(validAttention ? { attention: input.attention as string | null } : {}),
      ...(topics === undefined ? {} : { topics }) });
  } catch { return undefined; }
}
function choices(input: unknown): readonly ExplorerSafetyChoice[] | undefined {
  try {
    if (!Array.isArray(input) || input.length < 1 || input.length > EXPLORER_SAFETY_REPLY_LIMITS.choices) return undefined;
    const result: ExplorerSafetyChoice[] = [];
    for (const item of input) {
      if (!dataObject(item, ["label"]) || typeof item.label !== "string" || !explorerSafetyUnicodeValid(item.label)) return undefined;
      // Reject hidden/control characters before trimming; normalization must not
      // hide a forbidden input. Bounds count Unicode scalars like SQL char_length.
      if (/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/u.test(item.label)) return undefined;
      const label = item.label.trim();
      if (!label || Array.from(label).length > EXPLORER_SAFETY_REPLY_LIMITS.choiceLabelCharacters) return undefined;
      result.push(Object.freeze({ label }));
    }
    return Object.freeze(result);
  } catch { return undefined; }
}
export function parseExplorerSafetyWaypointSuggestion(input: unknown): ExplorerSafetyWaypointSuggestion | undefined {
  try {
    if (!dataObject(input, ["title", "destination", "whyItMatters", "arrivalSignal"])) return undefined;
    for (const value of Object.values(input)) {
      if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.length > 1_000 ||
          !explorerSafetyUnicodeValid(value) ||
          /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200d\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u.test(value)) return undefined;
    }
    return Object.freeze({ title: input.title as string, destination: input.destination as string,
      whyItMatters: input.whyItMatters as string, arrivalSignal: input.arrivalSignal as string });
  } catch { return undefined; }
}
// The inner text of one whole reply wrapped in a Markdown code fence (```json or ```), else the text unchanged.
function unwrappedCodeFence(rawText: string): string {
  const fenced = /^\s*```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```\s*$/u.exec(rawText);
  return fenced ? fenced[1] : rawText;
}
// A plain data object holding only the listed keys that the parsed value owns as data properties; null when the
// value is not a plain object or one of those keys is an accessor.
function knownOuterKeys(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const kept: Record<string, unknown> = {};
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) return null;
    kept[key] = descriptor.value;
  }
  return kept;
}
// True when a dropped outer key could be a competing safety signal or a misspelled known key (the same name ignoring
// case, underscores, dashes and spaces, or a level, minorIndicated or classification field at the top): such a reply
// is rejected whole, as before the reply fix, so the classification is never chosen between two signals.
const EXPLORER_SAFETY_REPLY_OUTER_KEYS = Object.freeze(["protocol", "classification", "candidateReply", "compass", "choices",
  "waypointSuggestion", "waypointResponse"]);
export function explorerSafetyReplyHasConflictingOuterKey(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const normal = (key: string) => key.replace(/[\s_-]/gu, "").toLowerCase();
  const normalKnown = EXPLORER_SAFETY_REPLY_OUTER_KEYS.map(normal);
  return Object.keys(value).some(key => !EXPLORER_SAFETY_REPLY_OUTER_KEYS.includes(key) &&
    (normalKnown.includes(normal(key)) || ["level", "minorindicated", "classification"].includes(normal(key))));
}
export function parseExplorerSafetyReplyBody(rawText: unknown, mode: ExplorerSafetyRequestMode): ExplorerSafetyReplyObservation {
  if (mode !== "classification_only" && mode !== "classification_and_reply") fail("explorer_safety_invalid_request");
  if (typeof rawText !== "string") fail("explorer_safety_invalid_response");
  if (Buffer.byteLength(rawText, "utf8") > EXPLORER_SAFETY_REPLY_LIMITS.modelBodyUtf8Bytes) fail("explorer_safety_limit_exceeded");
  let parsed: unknown;
  // Reply fix (2026-11-10; PRJ01-SPR002 decision queue, morning meeting entry, items 14 and 15): one whole reply
  // wrapped in a Markdown code fence is read as its inner text; anything else must still be exactly one JSON value.
  try { parsed = JSON.parse(unwrappedCodeFence(rawText)) as unknown; } catch { fail("explorer_safety_invalid_response"); }
  // The three required keys and any of the four optional keys are kept; any other outer key is dropped instead of
  // rejecting the whole reply (three replies were lost on 2026-11-10 to a failed outer check). Every kept value is
  // checked exactly as before, so the protocol, the classification and the reply text stay strict.
  const required = ["protocol", "classification", "candidateReply"];
  const optional = ["compass", "choices", "waypointSuggestion", "waypointResponse"];
  const body = knownOuterKeys(parsed, [...required, ...optional]);
  if (body === null || !required.every(key => Object.hasOwn(body, key)) ||
    body.protocol !== EXPLORER_SAFETY_REPLY_PROTOCOL || explorerSafetyReplyHasConflictingOuterKey(parsed)) fail("explorer_safety_invalid_response");
  const classification = parseExplorerSafetyClassification(body.classification);
  if (classification === null) fail("explorer_safety_invalid_response");
  // Optional proposal defects cannot erase the accepted signal or usable prose.
  if (mode === "classification_only") return Object.freeze({ classification, candidate: NOT_REQUESTED });
  const parsedCompass = compass(body.compass); const parsedChoices = choices(body.choices);
  const waypointSuggestion = parseExplorerSafetyWaypointSuggestion(body.waypointSuggestion);
  const waypointResponse = parseExplorerSafetyWaypointResponse(body.waypointResponse);
  return Object.freeze({ classification, candidate: candidate(body.candidateReply),
    ...(parsedCompass === undefined ? {} : { compass: parsedCompass }),
    ...(waypointSuggestion === undefined ? {} : { waypointSuggestion }),
    ...(waypointResponse === undefined ? {} : { waypointResponse }),
    ...(parsedChoices === undefined ? {} : { choices: parsedChoices }) });
}

export function parseExplorerSafetyWaypointResponse(input: unknown): ExplorerSafetyWaypointResponse | undefined {
  try {
    if (!dataObject(input, ["draftId", "response"]) || typeof input.draftId !== "string" ||
        input.draftId.length !== 36 || !UUID.test(input.draftId) ||
        (input.response !== "right" && input.response !== "close" && input.response !== "not_it")) return undefined;
    return Object.freeze({ draftId: input.draftId, response: input.response });
  } catch { return undefined; }
}
