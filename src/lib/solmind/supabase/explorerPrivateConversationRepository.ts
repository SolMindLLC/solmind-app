import "server-only";
import { types } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EXPLORER_COMPASS_ANCHORS, EXPLORER_CONVERSATION_LIMITS } from "../explorerConversationContract";
import type { ExplorerPrivateConversationRepository, ExplorerPrivateRpcRow } from "../virtual-guide/explorerPrivateConversationComposition";

const ACTOR = ["p_actor_user_account_id", "p_user_session_id"] as const;
const METHODOLOGY = ["p_methodology_context_pack_id", "p_methodology_context_pack_version_id", "p_methodology_content_sha256", "p_methodology_authorization_version"] as const;
const OBSERVATION = ["p_conversation_id", "p_operation_id", "p_logical_operation_id", "p_expected_revision", "p_command_fingerprint",
  "p_protocol_version", "p_fallback_policy_version", "p_model_policy_version", "p_configuration_fingerprint", "p_fallback_level", "p_fallback_minor_indicated"] as const;
const PORTS = Object.freeze({
  read: Object.freeze({ name: "solmind_read_explorer_conversation_v3", parameters: [...ACTOR, "p_conversation_id", "p_operation_id", "p_command_fingerprint"],
    columns: ["outcome", "conversation_state", "authority_context", "policy_state"] }),
  ensure: Object.freeze({ name: "solmind_ensure_explorer_conversation_v3", parameters: [...ACTOR, ...METHODOLOGY, "p_candidate_conversation_id", "p_expected_revision", "p_configuration_fingerprint"],
    columns: ["outcome", "conversation_state", "authority_context", "policy_state"] }),
  observe: Object.freeze({ name: "solmind_observe_explorer_conversation_fallback_v3", parameters: [...ACTOR, ...OBSERVATION], columns: ["outcome", "policy_state"] }),
  prepare: Object.freeze({ name: "solmind_prepare_explorer_conversation_turn_v3", parameters: [...ACTOR, ...OBSERVATION, ...METHODOLOGY,
    "p_context_source_ids", "p_authorization_version", "p_intake_response_set_id", "p_prompt_version", "p_policy_version", "p_behavior_version", "p_crisis_version", "p_role_version", "p_instruction_version",
    "p_message_id", "p_snapshot_id", "p_invocation_id", "p_body", "p_context_serialization", "p_context_fingerprint_sha256", "p_request_mode", "p_trusted_response_version", "p_resource_policy_version", "p_expected_safety_version", "p_model_name"],
    columns: ["outcome", "conversation_state", "dispatch_permitted", "policy_state"] }),
  settle: Object.freeze({ name: "solmind_settle_explorer_conversation_turn_v3", parameters: [...ACTOR, "p_conversation_id", "p_operation_id", "p_status", "p_reply_message_id", "p_reply_kind", "p_reply_body",
    "p_model_level", "p_model_minor_indicated", "p_protocol_version", "p_request_mode", "p_configuration_fingerprint", "p_fallback_policy_version", "p_model_policy_version", "p_trusted_response_version", "p_resource_policy_version",
    "p_fallback_level", "p_fallback_minor_indicated", "p_delivery_interested"], columns: ["outcome", "conversation_state", "policy_state", "saved_reply"] }),
  mutate: Object.freeze({ name: "solmind_mutate_explorer_conversation_v3", parameters: [...ACTOR, "p_conversation_id", "p_operation_id", "p_expected_revision", "p_command_fingerprint", "p_kind", "p_source_message_id", "p_item_id", "p_waypoint_id", "p_label", "p_destination", "p_meaning", "p_arrival_signal", "p_evidence"],
    columns: ["outcome", "conversation_state"] }),
  arrange: Object.freeze({ name: "solmind_confirm_explorer_compass_arrangement_v1", parameters: [...ACTOR,
    "p_conversation_id", "p_operation_id", "p_expected_revision", "p_command_fingerprint", "p_priority_id", "p_items"],
    columns: ["outcome", "conversation_state"] }),
  category: Object.freeze({ name: "solmind_confirm_explorer_compass_category_v1", parameters: [...ACTOR,
    "p_conversation_id", "p_operation_id", "p_expected_revision", "p_command_fingerprint", "p_target_item_id", "p_member_item_ids", "p_label"],
    columns: ["outcome", "conversation_state"] }),
  release: Object.freeze({ name: "solmind_release_explorer_waypoint_v1", parameters: [...ACTOR,
    "p_conversation_id", "p_operation_id", "p_expected_revision", "p_command_fingerprint", "p_waypoint_id"],
    columns: ["outcome", "conversation_state"] }),
  end: Object.freeze({ name: "solmind_end_explorer_conversation_v1", parameters: [...ACTOR,
    "p_conversation_id", "p_operation_id", "p_expected_revision", "p_command_fingerprint"], columns: ["outcome", "conversation_state"] }),
  review: Object.freeze({ name: "solmind_read_ended_explorer_conversations_v1", parameters: [...ACTOR, "p_conversation_id"],
    columns: ["outcome", "ended_conversations", "conversation_state"] }),
});
const FAILURE = "explorer_private_repository_unavailable";
const OUTCOMES: Readonly<Record<keyof typeof PORTS, readonly string[]>> = Object.freeze({
  read: ["ok", "exact_replay"], ensure: ["created", "reused", "held", "stale_revision"],
  observe: ["ok", "exact_replay", "stale_revision"], prepare: ["ok", "exact_replay", "stale_revision", "stale_policy", "blocked", "unavailable"],
  settle: ["ok", "withheld", "exact_replay"], mutate: ["ok", "exact_replay", "stale_revision", "operation_conflict", "unavailable"],
  arrange: ["ok", "exact_replay", "stale_revision", "operation_conflict", "unavailable"],
  category: ["ok", "exact_replay", "stale_revision", "operation_conflict", "unavailable"],
  release: ["ok", "exact_replay", "stale_revision", "operation_conflict", "unavailable"],
  end: ["ok", "exact_replay", "already_ended", "stale_revision", "unavailable"], review: ["ok"],
});
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !types.isProxy(value) && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function parameters(input: object, expected: readonly string[]): Readonly<Record<string, unknown>> {
  if (!object(input) || Reflect.ownKeys(input).length !== expected.length) throw new Error(FAILURE);
  const copied: Record<string, unknown> = {};
  for (const key of expected) {
    const property = Object.getOwnPropertyDescriptor(input, key);
    if (!property?.enumerable || !("value" in property)) throw new Error(FAILURE);
    const value: unknown = property.value;
    if ((key === "p_items" || key === "p_member_item_ids") && !Array.isArray(value)) throw new Error(FAILURE);
    if (Array.isArray(value)) {
      if (key === "p_items") {
        if (types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype ||
            value.length > EXPLORER_CONVERSATION_LIMITS.compassItems || Reflect.ownKeys(value).length !== value.length + 1) throw new Error(FAILURE);
        const items: Record<string, unknown>[] = [];
        for (let index = 0; index < value.length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
          if (!descriptor?.enumerable || !("value" in descriptor) || !object(descriptor.value) ||
              Reflect.ownKeys(descriptor.value).length !== 3) throw new Error(FAILURE);
          const item: Record<string, unknown> = {};
          for (const name of ["compassItemId", "anchor", "emphasis"]) {
            const field = Object.getOwnPropertyDescriptor(descriptor.value, name);
            if (!field?.enumerable || !("value" in field)) throw new Error(FAILURE);
            item[name] = field.value;
          }
          if (typeof item.compassItemId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(item.compassItemId) ||
              !(item.anchor === null || EXPLORER_COMPASS_ANCHORS.includes(item.anchor as typeof EXPLORER_COMPASS_ANCHORS[number])) ||
              (item.emphasis !== 1 && item.emphasis !== 2 && item.emphasis !== 3)) throw new Error(FAILURE);
          items.push(Object.freeze(item));
        }
        copied[key] = Object.freeze(items);
        continue;
      }
      if ((key !== "p_context_source_ids" && key !== "p_member_item_ids") || types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype ||
        value.length < 1 || value.length > (key === "p_member_item_ids" ? EXPLORER_CONVERSATION_LIMITS.compassItems : 256) ||
        Reflect.ownKeys(value).length !== value.length + 1) throw new Error(FAILURE);
      const identifiers: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const entry = Object.getOwnPropertyDescriptor(value, String(index));
        if (!entry?.enumerable || !("value" in entry) || typeof entry.value !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(entry.value)) throw new Error(FAILURE);
        identifiers.push(entry.value);
      }
      if (key === "p_member_item_ids" && new Set(identifiers).size !== identifiers.length) throw new Error(FAILURE);
      copied[key] = Object.freeze(identifiers);
    } else {
      if (value !== null && typeof value !== "string" && typeof value !== "boolean" &&
        !(typeof value === "number" && Number.isSafeInteger(value))) throw new Error(FAILURE);
      if (typeof value === "string" && Buffer.byteLength(value, "utf8") > 524288) throw new Error(FAILURE);
      copied[key] = value;
    }
  }
  return Object.freeze(copied);
}

// The returned object exposes eleven exact ports, including deliberate
// formation, ending and owned ended review. There is no generic select/RPC/credential capability.
export function createExplorerPrivateConversationRepository(client: SupabaseClient): ExplorerPrivateConversationRepository {
  async function call(port: keyof typeof PORTS, input: object): Promise<ExplorerPrivateRpcRow> {
    try {
      const spec = PORTS[port]; const copied = parameters(input, spec.parameters);
      // A client timeout is only an abort REQUEST. Unknown acknowledgement does
      // not establish rollback/remote stop or authorize an automatic repost.
      const { data, error } = await client.rpc(spec.name, copied).abortSignal(AbortSignal.timeout(10_000));
      if (error?.code === "P0001") {
        if (/^solmind_(?:explorer_conversation|explorer_private|methodology)_(?:denied|invalid_input)$/.test(error.message)) return Object.freeze({ outcome: "denied" });
        if (/^solmind_(?:explorer_conversation|explorer_private|methodology)_(?:operation_conflict|evidence_conflict)$/.test(error.message)) return Object.freeze({ outcome: "operation_conflict" });
      }
      if (error || !Array.isArray(data) || data.length !== 1 || !object(data[0])) throw new Error(FAILURE);
      const row = data[0];
      if (Object.keys(row).length !== spec.columns.length || !spec.columns.every((column) => Object.hasOwn(row, column)) ||
        typeof row.outcome !== "string" || !OUTCOMES[port].includes(row.outcome) ||
        (Object.hasOwn(row, "dispatch_permitted") && typeof row.dispatch_permitted !== "boolean") ||
        (Object.hasOwn(row, "saved_reply") && typeof row.saved_reply !== "boolean")) throw new Error(FAILURE);
      return Object.freeze({ ...row }) as ExplorerPrivateRpcRow;
    } catch { throw new Error(FAILURE); }
  }
  return Object.freeze({
    read: async (actor, operation) => {
      const row = await call("read", { p_actor_user_account_id: actor.accountId, p_user_session_id: actor.applicationSessionId,
        p_conversation_id: null, p_operation_id: operation?.operationId ?? null, p_command_fingerprint: operation?.fingerprint ?? null });
      return Object.freeze({ ...row, conversation_state: row.conversation_state ?? null });
    },
    ensure: (input) => call("ensure", input), observe: (input) => call("observe", input), prepare: (input) => call("prepare", input),
    settle: (input) => call("settle", input), mutate: (input) => call("mutate", input),
    arrange: (input) => call("arrange", input), category: (input) => call("category", input), release: (input) => call("release", input), end: (input) => call("end", input), review: (input) => call("review", input),
  });
}
