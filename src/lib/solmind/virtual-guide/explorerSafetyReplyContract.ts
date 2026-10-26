import "server-only";
import { createHash } from "node:crypto";

export const EXPLORER_SAFETY_REQUEST_VERSION = "explorer-safety-request.v2" as const;
export const EXPLORER_SAFETY_REPLY_PROTOCOL = "explorer-safety-reply.v1" as const;
export const EXPLORER_SAFETY_REPLY_LIMITS = Object.freeze({
  contextUtf8Bytes: 524_288, modelBodyUtf8Bytes: 262_144,
  candidateUtf16Units: 8_192, candidateWords: 300,
  minimumTimeoutMilliseconds: 10, maximumTimeoutMilliseconds: 60_000,
});
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
export type ExplorerSafetyReplyObservation = Readonly<{
  classification: ExplorerSafetyClassification; candidate: ExplorerSafetyCandidate;
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
export function parseExplorerSafetyReplyBody(rawText: unknown, mode: ExplorerSafetyRequestMode): ExplorerSafetyReplyObservation {
  if (mode !== "classification_only" && mode !== "classification_and_reply") fail("explorer_safety_invalid_request");
  if (typeof rawText !== "string") fail("explorer_safety_invalid_response");
  if (Buffer.byteLength(rawText, "utf8") > EXPLORER_SAFETY_REPLY_LIMITS.modelBodyUtf8Bytes) fail("explorer_safety_limit_exceeded");
  let body: unknown;
  try { body = JSON.parse(rawText) as unknown; } catch { fail("explorer_safety_invalid_response"); }
  if (!dataObject(body, ["protocol", "classification", "candidateReply"]) || body.protocol !== EXPLORER_SAFETY_REPLY_PROTOCOL) fail("explorer_safety_invalid_response");
  const classification = parseExplorerSafetyClassification(body.classification);
  if (classification === null) fail("explorer_safety_invalid_response");
  // Candidate defects cannot erase the already-accepted bounded signal.
  return Object.freeze({ classification, candidate: mode === "classification_only" ? NOT_REQUESTED : candidate(body.candidateReply) });
}
