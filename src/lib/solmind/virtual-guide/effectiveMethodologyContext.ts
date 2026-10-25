import "server-only";
import { types } from "node:util";
import type { ExplorerConversationActor } from "./explorerConversationComposition";
import { bindMethodologySafetyScreenSubject } from "./methodologySafetyScreenContract";

export type EffectiveMethodologyScope = Readonly<{ type: "guide"; id: string }>;
export type EffectiveMethodologySelection = Readonly<{
  packId: string;
  scopeType: "guide";
  scopeId: string;
  versionId: string;
  versionNumber: number;
  contentMarkdown: string;
  contentSha256: string;
  methodologyAuthorizationVersion: string;
}>;
export type EffectiveMethodologyReadInput = Readonly<{
  actor: ExplorerConversationActor;
  packId: string;
  expectedScope: EffectiveMethodologyScope;
  signal?: AbortSignal;
}>;
export type EffectiveMethodologySource = Readonly<{
  read: (input: EffectiveMethodologyReadInput) => Promise<EffectiveMethodologySelection>;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9A-F]{64}$/;
const AUTHORIZATION_VERSION = /^MV1:[0-9A-F]{64}$/;
const UNAVAILABLE = "effective_methodology_context_unavailable";
const SELECTION_KEYS = Object.freeze([
  "packId", "scopeType", "scopeId", "versionId", "versionNumber",
  "contentMarkdown", "contentSha256", "methodologyAuthorizationVersion",
]);

function unavailable(): never { throw new Error(UNAVAILABLE); }

// Reject executable property access before reading any caller/source values.
// The selected data remains server-only; this is not approval authority.
function closedRecord(input: unknown, keys: readonly string[]): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input) || types.isProxy(input)) unavailable();
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) unavailable();
  const ownKeys = Reflect.ownKeys(input);
  if (ownKeys.length !== keys.length || ownKeys.some(key => typeof key !== "string" || !keys.includes(key))) unavailable();
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) unavailable();
    result[key] = descriptor.value;
  }
  return result;
}

export function parseEffectiveMethodologyScope(input: unknown): EffectiveMethodologyScope {
  try {
    const scope = closedRecord(input, ["type", "id"]);
    if (scope.type !== "guide" || typeof scope.id !== "string" || !UUID.test(scope.id)) unavailable();
    return Object.freeze({ type: "guide", id: scope.id });
  } catch { return unavailable(); }
}

// Use the native getter so an overridden `aborted` accessor cannot execute.
export function effectiveMethodologySignalAborted(signal: AbortSignal | undefined): boolean {
  if (signal === undefined) return false;
  try {
    if (types.isProxy(signal) || !(signal instanceof AbortSignal)) unavailable();
    const getter = Object.getOwnPropertyDescriptor(AbortSignal.prototype, "aborted")?.get;
    if (!getter) unavailable();
    return getter.call(signal) as boolean;
  } catch { return unavailable(); }
}

export function parseEffectiveMethodologyReadInput(input: unknown): EffectiveMethodologyReadInput {
  try {
    if (input === null || typeof input !== "object" || types.isProxy(input)) unavailable();
    const keys = Reflect.ownKeys(input);
    const hasSignal = keys.includes("signal");
    const raw = closedRecord(input, ["actor", "packId", "expectedScope", ...(hasSignal ? ["signal"] : [])]);
    const actor = closedRecord(raw.actor, ["accountId", "applicationSessionId"]);
    if (typeof actor.accountId !== "string" || !UUID.test(actor.accountId) ||
        typeof actor.applicationSessionId !== "string" || !UUID.test(actor.applicationSessionId) ||
        typeof raw.packId !== "string" || !UUID.test(raw.packId)) unavailable();
    const expectedScope = parseEffectiveMethodologyScope(raw.expectedScope);
    const signal = raw.signal as AbortSignal | undefined;
    effectiveMethodologySignalAborted(signal);
    return Object.freeze({
      actor: Object.freeze({ accountId: actor.accountId, applicationSessionId: actor.applicationSessionId }),
      packId: raw.packId, expectedScope,
      ...(signal === undefined ? {} : { signal }),
    });
  } catch { return unavailable(); }
}

/**
 * Validates exact selected bytes and server-choice linkage. An MV1 string or
 * digest alone proves no governance: the closed SQL resolver/prepare owns
 * actual scope, screen, Admin, Guide, activation and atomic audit validation.
 */
export function parseEffectiveMethodologySelection(
  input: unknown,
  expected: Readonly<{ packId: string; expectedScope: EffectiveMethodologyScope }>,
): EffectiveMethodologySelection {
  try {
    const raw = closedRecord(input, SELECTION_KEYS);
    const expectedRaw = closedRecord(expected, ["packId", "expectedScope"]);
    const scope = parseEffectiveMethodologyScope(expectedRaw.expectedScope);
    if (typeof expectedRaw.packId !== "string" || !UUID.test(expectedRaw.packId) ||
        raw.packId !== expectedRaw.packId || raw.scopeType !== "guide" || raw.scopeId !== scope.id ||
        typeof raw.versionId !== "string" || !UUID.test(raw.versionId) ||
        typeof raw.versionNumber !== "number" || !Number.isSafeInteger(raw.versionNumber) || raw.versionNumber < 1 ||
        typeof raw.contentSha256 !== "string" || !SHA256.test(raw.contentSha256) ||
        typeof raw.methodologyAuthorizationVersion !== "string" || !AUTHORIZATION_VERSION.test(raw.methodologyAuthorizationVersion)) unavailable();
    const subject = bindMethodologySafetyScreenSubject({
      methodologyContextPackVersionId: raw.versionId, content: raw.contentMarkdown,
    });
    if (subject.subjectSha256 !== raw.contentSha256) unavailable();
    return Object.freeze({
      packId: expectedRaw.packId, scopeType: "guide", scopeId: scope.id,
      versionId: raw.versionId, versionNumber: raw.versionNumber,
      contentMarkdown: subject.subject.content, contentSha256: raw.contentSha256,
      methodologyAuthorizationVersion: raw.methodologyAuthorizationVersion,
    });
  } catch { return unavailable(); }
}
