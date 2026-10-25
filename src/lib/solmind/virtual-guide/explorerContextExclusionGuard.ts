import "server-only";
import { createHash } from "node:crypto";
import { types } from "node:util";
import { EXPLORER_SAFE_CONTEXT_LIMITS } from "../context/explorerSafeContext";

export const EXPLORER_CONTEXT_EXCLUSION_MATCHER_VERSION =
  "explorer-context-exclusion-matcher.v1" as const;
export type ExplorerExclusionEntityType =
  | "private_note"
  | "trigger_observation"
  | "summary_revision";
export type ExplorerExclusionBinding = Readonly<{
  explorerId: string;
  sessionId: string;
  relationshipId: string;
}>;
export type ExplorerExclusionManifest = Readonly<{
  contractVersion: typeof EXPLORER_CONTEXT_EXCLUSION_MATCHER_VERSION;
  explorerId: string;
  relationshipId: string;
  entries: ReadonlyArray<Readonly<{
    entityType: ExplorerExclusionEntityType;
    entityId: string;
    normalizedContentSha256: string;
  }>>;
}>;
export type ExplorerExclusionInspection = Readonly<
  | { status: "clear" }
  | {
      status: "blocked";
      reason: "excluded_identifier" | "excluded_content";
      entityType: ExplorerExclusionEntityType;
      entityId: string;
    }
>;

const UNAVAILABLE = "explorer_context_exclusion_unavailable";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9A-F]{64}$/;
const ENTITY_TYPES: readonly string[] = ["private_note", "trigger_observation", "summary_revision"];
const ROOT_KEYS = Object.freeze([
  "contractVersion", "aiRole", "actorRoleContext", "globalPolicy", "roleBehavior", "crisisBehavior",
  "methodologyContext", "sessionContext", "approvedContinuity", "currentSessionMessages",
  "immediateExplorerMessage", "outputRequirements",
]);

function unavailable(): never { throw new Error(UNAVAILABLE); }

function record(input: unknown, keys?: readonly string[]): Record<string, unknown> {
  if (input === null || typeof input !== "object" || types.isProxy(input) || Array.isArray(input)) unavailable();
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) unavailable();
  const ownKeys = Reflect.ownKeys(input);
  if (ownKeys.some(key => typeof key !== "string") ||
      (keys && (ownKeys.length !== keys.length || ownKeys.some(key => !keys.includes(key as string))))) unavailable();
  const copied: Record<string, unknown> = Object.create(null);
  for (const key of ownKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) unavailable();
    copied[key as string] = descriptor.value;
  }
  return copied;
}

function array(input: unknown, maximum: number): readonly unknown[] {
  if (input === null || typeof input !== "object" || types.isProxy(input) || !Array.isArray(input) ||
      Object.getPrototypeOf(input) !== Array.prototype) unavailable();
  const length = Object.getOwnPropertyDescriptor(input, "length");
  if (!length || !("value" in length) || !Number.isSafeInteger(length.value) || length.value < 0 || length.value > maximum) unavailable();
  if (Reflect.ownKeys(input).length !== length.value + 1) unavailable();
  const copied: unknown[] = [];
  for (let index = 0; index < length.value; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) unavailable();
    copied.push(descriptor.value);
  }
  return copied;
}

function uuid(input: unknown): string {
  if (typeof input !== "string" || !UUID.test(input)) unavailable();
  return input;
}

function binding(input: unknown): ExplorerExclusionBinding {
  const value = record(input, ["explorerId", "sessionId", "relationshipId"]);
  return {
    explorerId: uuid(value.explorerId), sessionId: uuid(value.sessionId), relationshipId: uuid(value.relationshipId),
  };
}

function manifest(input: unknown, expected: ExplorerExclusionBinding): ExplorerExclusionManifest {
  const value = record(input, ["contractVersion", "explorerId", "relationshipId", "entries"]);
  if (value.contractVersion !== EXPLORER_CONTEXT_EXCLUSION_MATCHER_VERSION ||
      uuid(value.explorerId) !== expected.explorerId || uuid(value.relationshipId) !== expected.relationshipId) unavailable();
  const identities = new Set<string>();
  const entries = array(value.entries, 128).map(candidate => {
    const entry = record(candidate, ["entityType", "entityId", "normalizedContentSha256"]);
    if (typeof entry.entityType !== "string" || !ENTITY_TYPES.includes(entry.entityType) ||
        typeof entry.normalizedContentSha256 !== "string" || !SHA256.test(entry.normalizedContentSha256)) unavailable();
    const entityId = uuid(entry.entityId);
    if (identities.has(entityId)) unavailable();
    identities.add(entityId);
    return {
      entityType: entry.entityType as ExplorerExclusionEntityType,
      entityId, normalizedContentSha256: entry.normalizedContentSha256,
    };
  });
  return {
    contractVersion: EXPLORER_CONTEXT_EXCLUSION_MATCHER_VERSION,
    explorerId: expected.explorerId, relationshipId: expected.relationshipId, entries,
  };
}

function contextStrings(serialized: unknown, expected: ExplorerExclusionBinding): readonly string[] {
  if (typeof serialized !== "string" || serialized.length === 0 ||
      new TextEncoder().encode(serialized).byteLength > EXPLORER_SAFE_CONTEXT_LIMITS.serializedUtf8Bytes) unavailable();
  const parsed: unknown = JSON.parse(serialized);
  const root = record(parsed, ROOT_KEYS);
  if (typeof root.contractVersion !== "string" || root.contractVersion.length === 0 ||
      root.aiRole !== "solmind_virtual_guide" || root.actorRoleContext !== "explorer") unavailable();
  // S03A remains the full layer/schema authority. This guard checks only its
  // compact envelope, roles and exact binding; it does not authorize assembly.
  const session = record(root.sessionContext);
  if (uuid(session.explorerId) !== expected.explorerId || uuid(session.sessionId) !== expected.sessionId ||
      uuid(session.continuityBindingId) !== expected.relationshipId) unavailable();

  const strings: string[] = [];
  const pending: Array<{ value: unknown; parentDepth: number }> = [{ value: parsed, parentDepth: 0 }];
  while (pending.length > 0) {
    const next = pending.pop()!;
    if (typeof next.value === "string") {
      strings.push(next.value);
    } else if (next.value !== null && typeof next.value === "object") {
      const depth = next.parentDepth + 1;
      if (depth > 64) unavailable();
      // JSON.parse created this tree: no caller references or executable
      // properties survive. Array/record helpers still enforce plain shapes.
      const children = Array.isArray(next.value)
        ? array(next.value, EXPLORER_SAFE_CONTEXT_LIMITS.serializedUtf8Bytes)
        : Object.values(record(next.value));
      for (let index = children.length - 1; index >= 0; index -= 1) {
        pending.push({ value: children[index], parentDepth: depth });
      }
    }
  }
  if (JSON.stringify(parsed) !== serialized) unavailable();
  return strings;
}

/**
 * Request-local pure defense in depth. A clear result does not prove index
 * completeness/freshness, authorization, screening or full runtime safety.
 * Whole normalized field hashes miss embedded passages, paraphrases, encoded
 * or Unicode-equivalent variants. No source/audit/provider capability exists.
 */
export function inspectExplorerContextExclusions(input: unknown): ExplorerExclusionInspection {
  try {
    const value = record(input, ["serializedContext", "includedSourceIds", "expectedBinding", "manifest"]);
    const expected = binding(value.expectedBinding);
    const index = manifest(value.manifest, expected);
    const sourceIds = array(value.includedSourceIds, 256).map(uuid);
    const included = new Set(sourceIds);
    if (included.size !== sourceIds.length) unavailable();
    const strings = contextStrings(value.serializedContext, expected);
    const lowerStrings = strings.map(text => text.toLowerCase());
    // Identifier precedence is global; manifest order wins within each phase.
    for (const entry of index.entries) {
      if (included.has(entry.entityId) || lowerStrings.some(text => text.includes(entry.entityId))) {
        return Object.freeze({ status: "blocked", reason: "excluded_identifier",
          entityType: entry.entityType, entityId: entry.entityId });
      }
    }
    const fingerprints = new Set(strings.map(text => createHash("sha256")
      .update(text.replace(/\r\n?/g, "\n").trim(), "utf8").digest("hex").toUpperCase()));
    for (const entry of index.entries) {
      if (fingerprints.has(entry.normalizedContentSha256)) {
        return Object.freeze({ status: "blocked", reason: "excluded_content",
          entityType: entry.entityType, entityId: entry.entityId });
      }
    }
    return Object.freeze({ status: "clear" });
  } catch { return unavailable(); }
}
