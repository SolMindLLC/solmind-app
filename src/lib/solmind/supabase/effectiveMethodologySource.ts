import "server-only";
import { types } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  effectiveMethodologySignalAborted,
  parseEffectiveMethodologyReadInput,
  parseEffectiveMethodologySelection,
  type EffectiveMethodologySource,
} from "../virtual-guide/effectiveMethodologyContext";

const UNAVAILABLE = "effective_methodology_source_unavailable";
const ROW_KEYS = Object.freeze([
  "methodology_context_pack_id", "scope_type", "scope_id",
  "methodology_context_pack_version_id", "version_number", "content_markdown",
  "content_sha256", "methodology_authorization_version",
]);
function unavailable(): never { throw new Error(UNAVAILABLE); }

function dataProperties(input: unknown, keys: readonly string[], exact: boolean): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input) || types.isProxy(input)) unavailable();
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) unavailable();
  if (exact) {
    const ownKeys = Reflect.ownKeys(input);
    if (ownKeys.length !== keys.length || ownKeys.some(key => typeof key !== "string" || !keys.includes(key))) unavailable();
  }
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) unavailable();
    result[key] = descriptor.value;
  }
  return result;
}

function oneRow(input: unknown): Record<string, unknown> {
  if (!Array.isArray(input) || types.isProxy(input)) unavailable();
  const keys = Reflect.ownKeys(input);
  const length = Object.getOwnPropertyDescriptor(input, "length");
  const row = Object.getOwnPropertyDescriptor(input, "0");
  if (keys.length !== 2 || !keys.includes("length") || !keys.includes("0") ||
      !length || !("value" in length) || length.value !== 1 ||
      !row || !row.enumerable || !("value" in row)) unavailable();
  return dataProperties(row.value, ROW_KEYS, true);
}

// Exactly one closed resolver capability. No table/query port, credential
// lookup, browser selector, fallback scope or default methodology is exposed.
export function createEffectiveMethodologySource(client: SupabaseClient): EffectiveMethodologySource {
  return Object.freeze({
    read: async (input) => {
      try {
        const request = parseEffectiveMethodologyReadInput(input);
        if (effectiveMethodologySignalAborted(request.signal)) unavailable();
        const timeout = AbortSignal.timeout(12_000);
        const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;
        const response: unknown = await client.rpc("solmind_resolve_explorer_methodology", {
          p_actor_user_account_id: request.actor.accountId,
          p_user_session_id: request.actor.applicationSessionId,
          p_methodology_context_pack_id: request.packId,
          p_scope_type: request.expectedScope.type,
          p_scope_id: request.expectedScope.id,
        }).abortSignal(signal);
        if (effectiveMethodologySignalAborted(signal)) unavailable();
        // Supabase also returns count/status/statusText; none are copied out.
        const responseData = dataProperties(response, ["data", "error"], false);
        if (responseData.error !== null) unavailable();
        const row = oneRow(responseData.data);
        return parseEffectiveMethodologySelection({
          packId: row.methodology_context_pack_id, scopeType: row.scope_type, scopeId: row.scope_id,
          versionId: row.methodology_context_pack_version_id, versionNumber: row.version_number,
          contentMarkdown: row.content_markdown, contentSha256: row.content_sha256,
          methodologyAuthorizationVersion: row.methodology_authorization_version,
        }, { packId: request.packId, expectedScope: request.expectedScope });
      } catch { return unavailable(); }
    },
  });
}
