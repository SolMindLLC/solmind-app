import "server-only";
import { types } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EXPLORER_COMPASS_ANCHORS, EXPLORER_CONVERSATION_LIMITS, parseExplorerConversationWaypointDraft, parseExplorerWaypointClarificationAnswers, parseExplorerWaypointCapacity } from "../explorerConversationContract";
import type { ExplorerPrivateConversationRepository, ExplorerPrivatePauseRow, ExplorerPrivateRpcRow } from "../virtual-guide/explorerPrivateConversationComposition";
import { parseExplorerWaypointPage } from "../explorerWaypointPortfolioContract";

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
    "p_message_id", "p_snapshot_id", "p_invocation_id", "p_body", "p_context_serialization", "p_context_fingerprint_sha256", "p_request_mode", "p_trusted_response_version", "p_resource_policy_version", "p_expected_safety_version", "p_model_name", "p_reply_choice"],
    columns: ["outcome", "conversation_state", "dispatch_permitted", "policy_state"] }),
  settle: Object.freeze({ name: "solmind_settle_explorer_conversation_turn_v4", parameters: [...ACTOR, "p_conversation_id", "p_operation_id", "p_status", "p_reply_message_id", "p_reply_kind", "p_reply_body",
    "p_model_level", "p_model_minor_indicated", "p_protocol_version", "p_request_mode", "p_configuration_fingerprint", "p_fallback_policy_version", "p_model_policy_version", "p_trusted_response_version", "p_resource_policy_version",
    "p_fallback_level", "p_fallback_minor_indicated", "p_delivery_interested", "p_attention_item_id", "p_choices", "p_compass_suggestions", "p_compass_responses", "p_waypoint_suggestion", "p_waypoint_response", "p_failure_reason", "p_compass_topics"], columns: ["outcome", "conversation_state", "policy_state", "saved_reply"] }),
  mutate: Object.freeze({ name: "solmind_mutate_explorer_conversation_v3", parameters: [...ACTOR, "p_conversation_id", "p_operation_id", "p_expected_revision", "p_command_fingerprint", "p_kind", "p_source_message_id", "p_item_id", "p_waypoint_id", "p_label", "p_destination", "p_meaning", "p_arrival_signal", "p_evidence"],
    columns: ["outcome", "conversation_state"] }),
  arrange: Object.freeze({ name: "solmind_confirm_explorer_compass_arrangement_v1", parameters: [...ACTOR,
    "p_conversation_id", "p_operation_id", "p_expected_revision", "p_command_fingerprint", "p_priority_id", "p_items"],
    columns: ["outcome", "conversation_state"] }),
  category: Object.freeze({ name: "solmind_confirm_explorer_compass_category_v1", parameters: [...ACTOR,
    "p_conversation_id", "p_operation_id", "p_expected_revision", "p_command_fingerprint", "p_target_item_id", "p_member_item_ids", "p_label"],
    columns: ["outcome", "conversation_state"] }),
  respondCompassSuggestion: Object.freeze({ name: "solmind_respond_explorer_compass_suggestion_v1", parameters: [...ACTOR,
    "p_conversation_id", "p_operation_id", "p_expected_revision", "p_command_fingerprint", "p_item_id", "p_response"],
    columns: ["outcome", "conversation_state"] }),
  respondWaypointDraft: Object.freeze({ name: "solmind_respond_explorer_waypoint_draft_v1", parameters: [...ACTOR,
    "p_conversation_id", "p_operation_id", "p_expected_revision", "p_command_fingerprint", "p_draft_id", "p_response"],
    columns: ["outcome", "conversation_state"] }),
  waypointRevision: Object.freeze({ name: "solmind_confirm_explorer_waypoint_revision_v1", parameters: [...ACTOR,
    "p_conversation_id", "p_operation_id", "p_expected_revision", "p_command_fingerprint", "p_kind", "p_waypoint_id", "p_answers"],
    columns: ["outcome", "conversation_state"] }),
  release: Object.freeze({ name: "solmind_release_explorer_waypoint_v1", parameters: [...ACTOR,
    "p_conversation_id", "p_operation_id", "p_expected_revision", "p_command_fingerprint", "p_waypoint_id"],
    columns: ["outcome", "conversation_state"] }),
  end: Object.freeze({ name: "solmind_end_explorer_conversation_v1", parameters: [...ACTOR,
    "p_conversation_id", "p_operation_id", "p_expected_revision", "p_command_fingerprint"], columns: ["outcome", "conversation_state"] }),
  review: Object.freeze({ name: "solmind_read_ended_explorer_conversations_v1", parameters: [...ACTOR, "p_conversation_id"],
    columns: ["outcome", "ended_conversations", "conversation_state"] }),
  readWaypointHeads: Object.freeze({ name: "solmind_read_explorer_waypoint_heads_v1", parameters: [...ACTOR, "p_offset"],
    columns: ["outcome", "waypoint_page"] }),
  readWaypointHistory: Object.freeze({ name: "solmind_read_explorer_waypoint_history_v1", parameters: [...ACTOR, "p_conversation_id", "p_offset"],
    columns: ["outcome", "waypoint_page"] }),
  closeEndedWaypoint: Object.freeze({ name: "solmind_close_ended_explorer_waypoint_v1", parameters: [...ACTOR,
    "p_waypoint_id", "p_operation_id", "p_command_fingerprint", "p_kind", "p_reached_evidence"], columns: ["outcome", "waypoint_page"] }),
  // The hard-stop pause for the signed-in Explorer's screen; writes nothing.
  pause: Object.freeze({ name: "solmind_read_explorer_ai_use_pause_v1", parameters: [...ACTOR],
    columns: ["outcome", "notice_kind", "crisis", "adults_only"] }),
});
const NOTICE_KINDS: readonly unknown[] = Object.freeze([null, "individual", "shared", "individual_and_shared"]);
const FAILURE = "explorer_private_repository_unavailable";
const OUTCOMES: Readonly<Record<keyof typeof PORTS, readonly string[]>> = Object.freeze({
  read: ["ok", "exact_replay"], ensure: ["created", "reused", "held", "stale_revision"],
  observe: ["ok", "exact_replay", "stale_revision", "paused"],
  prepare: ["ok", "exact_replay", "stale_revision", "stale_policy", "blocked", "unavailable", "paused"],
  settle: ["ok", "withheld", "exact_replay"], mutate: ["ok", "exact_replay", "stale_revision", "operation_conflict", "unavailable"],
  arrange: ["ok", "exact_replay", "stale_revision", "operation_conflict", "unavailable"],
  category: ["ok", "exact_replay", "stale_revision", "operation_conflict", "unavailable"],
  respondCompassSuggestion: ["ok", "exact_replay", "stale_revision", "operation_conflict", "unavailable"],
  respondWaypointDraft: ["ok", "exact_replay", "stale_revision", "operation_conflict", "unavailable"],
  waypointRevision: ["ok", "exact_replay", "stale_revision", "operation_conflict", "unavailable"],
  release: ["ok", "exact_replay", "stale_revision", "operation_conflict", "unavailable"],
  end: ["ok", "exact_replay", "already_ended", "stale_revision", "unavailable"], review: ["ok"], pause: ["ok"],
  readWaypointHeads: ["ok"], readWaypointHistory: ["ok"], closeEndedWaypoint: ["ok", "exact_replay", "operation_conflict", "unavailable"],
});
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !types.isProxy(value) && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function closedData(value: unknown, names: readonly string[]): Record<string, unknown> {
  if (!object(value) || Reflect.ownKeys(value).length !== names.length) throw new Error(FAILURE);
  const result: Record<string, unknown> = {};
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor?.enumerable || !("value" in descriptor)) throw new Error(FAILURE);
    result[name] = descriptor.value;
  }
  return result;
}
function dataArray(value: unknown, maximum: number): unknown[] {
  if (types.isProxy(value) || !Array.isArray(value) || value.length > maximum ||
      Reflect.ownKeys(value).length !== value.length + 1) throw new Error(FAILURE);
  const result: unknown[] = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !("value" in descriptor)) throw new Error(FAILURE);
    result.push(descriptor.value);
  }
  return result;
}
function uuid(value: unknown): value is string { return typeof value === "string" && value.length === 36 && UUID.test(value); }
function compassLabel(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 160 && value === value.trim() &&
    !/[\u0000-\u001f\u007f-\u009f\u200b-\u200d\u2028-\u202e\u2060\u2066-\u2069\ufeff]/u.test(value) &&
    !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value);
}
function compassEvidence(value: unknown) {
  const ids = new Set<string>(), labels = new Set<string>(), points = new Set<string>();
  return Object.freeze(dataArray(value, 24).map(entry => {
    const topic = closedData(entry, ["id", "label", "pointId", "supportingMessageIds"]);
    const supports = dataArray(topic.supportingMessageIds, 3);
    if (!uuid(topic.id) || ids.has(topic.id) || !compassLabel(topic.label) || labels.has(topic.label) ||
        !(topic.pointId === null || uuid(topic.pointId)) || (topic.pointId !== null && points.has(topic.pointId)) ||
        supports.length === 0 || !supports.every(uuid) || new Set(supports).size !== supports.length ||
        (topic.pointId !== null && supports.length !== 3)) throw new Error(FAILURE);
    ids.add(topic.id); labels.add(topic.label);
    if (topic.pointId !== null) points.add(topic.pointId);
    return Object.freeze({ id: topic.id, label: topic.label, pointId: topic.pointId,
      supportingMessageIds: Object.freeze(supports as string[]) });
  }));
}
function mappedTopics(value: unknown) {
  const identities = new Set<string>();
  return Object.freeze(dataArray(value, 3).map(entry => {
    const topic = closedData(entry, ["topicId", "label", "supports", "ready"]);
    if (!(topic.topicId === null || uuid(topic.topicId)) || !compassLabel(topic.label) ||
        typeof topic.ready !== "boolean") throw new Error(FAILURE);
    const identity = topic.topicId ?? "new:" + topic.label;
    if (identities.has(identity)) throw new Error(FAILURE);
    identities.add(identity);
    const refs = new Set<string>(), messages = new Set<string>();
    const supports = dataArray(topic.supports, 3).map(value => {
      const support = closedData(value, ["ref", "messageId"]);
      if (typeof support.ref !== "string" || !/^(now|h(?:[0-9]|1[0-9]|2[0-3]))$/.test(support.ref) ||
          refs.has(support.ref) || !uuid(support.messageId) || messages.has(support.messageId)) throw new Error(FAILURE);
      refs.add(support.ref); messages.add(support.messageId);
      return Object.freeze({ ref: support.ref, messageId: support.messageId });
    });
    if (topic.topicId === null && supports.length === 0) throw new Error(FAILURE);
    return Object.freeze({ topicId: topic.topicId, label: topic.label, ready: topic.ready, supports: Object.freeze(supports) });
  }));
}
function parameters(input: object, expected: readonly string[]): Readonly<Record<string, unknown>> {
  if (!object(input) || Reflect.ownKeys(input).length !== expected.length) throw new Error(FAILURE);
  const copied: Record<string, unknown> = {};
  for (const key of expected) {
    const property = Object.getOwnPropertyDescriptor(input, key);
    if (!property?.enumerable || !("value" in property)) throw new Error(FAILURE);
    const value: unknown = property.value;
    if (key === "p_compass_topics" && value !== null) { copied[key] = mappedTopics(value); continue; }
    if (key === "p_failure_reason" && value !== null && !["deadline", "transport_failed", "invalid_response",
      "delivery_canceled_before_dispatch", "dispatch_not_admitted", "trusted_render_unavailable"].includes(value as string)) throw new Error(FAILURE);
    if (key === "p_reply_choice" && typeof value !== "boolean") throw new Error(FAILURE);
    if (key === "p_offset" && !(typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 2147483627)) throw new Error(FAILURE);
    if (key === "p_waypoint_response" && value !== null) {
      if (!object(value) || Reflect.ownKeys(value).length !== 2) throw new Error(FAILURE);
      const draft = Object.getOwnPropertyDescriptor(value, "draftId");
      const response = Object.getOwnPropertyDescriptor(value, "response");
      if (!draft?.enumerable || !("value" in draft) || typeof draft.value !== "string" || draft.value.length !== 36 ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(draft.value) ||
          !response?.enumerable || !("value" in response) || !["right", "close", "not_it"].includes(response.value)) throw new Error(FAILURE);
      copied[key] = Object.freeze({ draftId: draft.value, response: response.value }); continue;
    }
    if (key === "p_waypoint_suggestion" && value !== null) {
      if (!object(value) || Reflect.ownKeys(value).length !== 4) throw new Error(FAILURE);
      const suggestion: Record<string, string> = {};
      for (const name of ["title", "destination", "whyItMatters", "arrivalSignal"]) {
        const field = Object.getOwnPropertyDescriptor(value, name);
        if (!field?.enumerable || !("value" in field) || typeof field.value !== "string" || !field.value.trim() ||
            field.value !== field.value.trim() || field.value.length > 1_000 ||
            /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200d\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u.test(field.value) ||
            /[\uD800-\uDFFF]/u.test(field.value)) throw new Error(FAILURE);
        suggestion[name] = field.value;
      }
      copied[key] = Object.freeze(suggestion); continue;
    }
    if (key === "p_response" && !["right", "close", "not_it"].includes(value as string)) throw new Error(FAILURE);
    if ((key === "p_items" || key === "p_member_item_ids" || key === "p_answers") && !Array.isArray(value)) throw new Error(FAILURE);
    if (key === "p_compass_responses" && value !== null) {
      if (!Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype ||
          value.length < 1 || value.length > 3 || Reflect.ownKeys(value).length !== value.length + 1) throw new Error(FAILURE);
      const responses: Readonly<{ pointId: string; response: string }>[] = [];
      const seen = new Set<string>();
      for (let index = 0; index < value.length; index++) {
        const entry = Object.getOwnPropertyDescriptor(value, String(index));
        if (!entry?.enumerable || !("value" in entry) || !object(entry.value) || Reflect.ownKeys(entry.value).length !== 2) throw new Error(FAILURE);
        const point = Object.getOwnPropertyDescriptor(entry.value, "pointId");
        const response = Object.getOwnPropertyDescriptor(entry.value, "response");
        if (!point?.enumerable || !("value" in point) || typeof point.value !== "string" || point.value.length !== 36 ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(point.value) || seen.has(point.value) ||
            !response?.enumerable || !("value" in response) || !["right", "close", "not_it"].includes(response.value)) throw new Error(FAILURE);
        seen.add(point.value);
        responses.push(Object.freeze({ pointId: point.value, response: response.value }));
      }
      copied[key] = Object.freeze(responses); continue;
    }
    if (key === "p_compass_suggestions" && value !== null) {
      if (!Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype ||
          value.length < 1 || value.length > 3 || Reflect.ownKeys(value).length !== value.length + 1) throw new Error(FAILURE);
      const suggestions: Readonly<{ label: string; pointId?: string }>[] = [];
      for (let index = 0; index < value.length; index++) {
        const entry = Object.getOwnPropertyDescriptor(value, String(index));
        if (!entry?.enumerable || !("value" in entry) || !object(entry.value)) throw new Error(FAILURE);
        const item = entry.value;
        const hasPoint = Object.hasOwn(item, "pointId");
        if (Reflect.ownKeys(item).length !== (hasPoint ? 2 : 1)) throw new Error(FAILURE);
        const labelField = Object.getOwnPropertyDescriptor(item, "label");
        if (!labelField?.enumerable || !("value" in labelField) || typeof labelField.value !== "string") throw new Error(FAILURE);
        const label = labelField.value;
        if (!label.trim() || label !== label.trim() || label.length > 160 ||
            /[\u0000-\u001f\u007f-\u009f\u200b-\u200d\u2028-\u202e\u2060\u2066-\u2069\ufeff]/u.test(label) ||
            /[\uD800-\uDFFF]/u.test(label)) throw new Error(FAILURE);
        let pointId: string | undefined;
        if (hasPoint) {
          const field = Object.getOwnPropertyDescriptor(item, "pointId");
          if (!field?.enumerable || !("value" in field) || typeof field.value !== "string" || field.value.length !== 36 ||
              !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(field.value)) throw new Error(FAILURE);
          pointId = field.value;
        }
        suggestions.push(Object.freeze({ label, ...(pointId === undefined ? {} : { pointId }) }));
      }
      copied[key] = Object.freeze(suggestions); continue;
    }
    if (key === "p_choices" && value !== null) {
      if (!Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype ||
          value.length < 1 || value.length > 3 || Reflect.ownKeys(value).length !== value.length + 1) throw new Error(FAILURE);
      const choices: Readonly<{ label: string }>[] = [];
      for (let index = 0; index < value.length; index++) {
        const entry = Object.getOwnPropertyDescriptor(value, String(index));
        if (!entry?.enumerable || !("value" in entry) || !object(entry.value) || Reflect.ownKeys(entry.value).length !== 1) throw new Error(FAILURE);
        const field = Object.getOwnPropertyDescriptor(entry.value, "label");
        if (!field?.enumerable || !("value" in field) || typeof field.value !== "string") throw new Error(FAILURE);
        const label = field.value;
        if (!label || label !== label.trim() || [...label].length > 40 ||
            /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/u.test(label) ||
            /[\uD800-\uDFFF]/u.test(label)) throw new Error(FAILURE);
        choices.push(Object.freeze({ label }));
      }
      copied[key] = Object.freeze(choices); continue;
    }
    if (Array.isArray(value)) {
      if (key === "p_answers") {
        if (types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > 3 ||
            Reflect.ownKeys(value).length !== value.length + 1) throw new Error(FAILURE);
        const safe: Record<string, unknown>[] = [];
        for (let index = 0; index < value.length; index++) {
          const entry = Object.getOwnPropertyDescriptor(value, String(index));
          if (!entry?.enumerable || !("value" in entry) || !object(entry.value) || Reflect.ownKeys(entry.value).length !== 2) throw new Error(FAILURE);
          const copied: Record<string, unknown> = {};
          for (const name of ["component", "answer"]) {
            const field = Object.getOwnPropertyDescriptor(entry.value, name);
            if (!field?.enumerable || !("value" in field)) throw new Error(FAILURE);
            copied[name] = field.value;
          }
          safe.push(copied);
        }
        const answers = parseExplorerWaypointClarificationAnswers(safe);
        if (answers === null) throw new Error(FAILURE);
        copied[key] = answers; continue;
      }
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

// Exact ports include bounded owner-private history and post-End closure.
// There is no generic select/RPC/credential capability and no route is added here.
export function createExplorerPrivateConversationRepository(client: SupabaseClient): ExplorerPrivateConversationRepository {
  async function call(port: keyof typeof PORTS, input: object): Promise<ExplorerPrivateRpcRow> {
    try {
      const spec = PORTS[port]; const copied = parameters(input, spec.parameters);
      if (port === "settle" && copied.p_failure_reason !== null &&
          (copied.p_reply_kind !== "none" || (copied.p_model_level !== null &&
            copied.p_failure_reason !== "invalid_response" && copied.p_failure_reason !== "trusted_render_unavailable"))) throw new Error(FAILURE);
      if (port === "closeEndedWaypoint" &&
          (!(copied.p_kind === "reach_waypoint" || copied.p_kind === "release_waypoint") ||
           (copied.p_kind === "release_waypoint" ? copied.p_reached_evidence !== null :
             typeof copied.p_reached_evidence !== "string" || !copied.p_reached_evidence.trim() ||
             copied.p_reached_evidence.length > EXPLORER_CONVERSATION_LIMITS.waypointCharacters))) throw new Error(FAILURE);
      // A client timeout is only an abort REQUEST. Unknown acknowledgement does
      // not establish rollback/remote stop or authorize an automatic repost.
      const { data, error } = await client.rpc(spec.name, copied).abortSignal(AbortSignal.timeout(10_000));
      if (error?.code === "P0001") {
        if (/^solmind_(?:explorer_conversation|explorer_private|methodology)_(?:denied|invalid_input)$/.test(error.message)) return Object.freeze({ outcome: "denied" });
        if (/^solmind_(?:explorer_conversation|explorer_private|methodology)_(?:operation_conflict|evidence_conflict)$/.test(error.message)) return Object.freeze({ outcome: "operation_conflict" });
      }
      if (error || !Array.isArray(data) || data.length !== 1 || !object(data[0])) throw new Error(FAILURE);
      const row = data[0];
      let authority = row.authority_context;
      if (port === "read" && authority != null) {
        if (!object(authority)) throw new Error(FAILURE);
        const evidence = Object.getOwnPropertyDescriptor(authority, "compassEvidence");
        if (!evidence?.enumerable || !("value" in evidence)) throw new Error(FAILURE);
        const copiedAuthority: Record<string, unknown> = {};
        for (const key of Reflect.ownKeys(authority)) {
          if (typeof key !== "string") throw new Error(FAILURE);
          const property = Object.getOwnPropertyDescriptor(authority, key);
          if (!property?.enumerable || !("value" in property)) throw new Error(FAILURE);
          copiedAuthority[key] = property.value;
        }
        authority = Object.freeze({ ...copiedAuthority, compassEvidence: compassEvidence(evidence.value) });
      }
      if (row.conversation_state != null && (!object(row.conversation_state) ||
          !["legacy", "automatic"].includes(Object.getOwnPropertyDescriptor(row.conversation_state, "compassMode")?.value) ||
          !Array.isArray(Object.getOwnPropertyDescriptor(row.conversation_state, "compassChanges")?.value) ||
          typeof Object.getOwnPropertyDescriptor(row.conversation_state, "turnedDownLimitReached")?.value !== "boolean" ||
          parseExplorerWaypointCapacity(Object.getOwnPropertyDescriptor(row.conversation_state, "waypointCapacity")?.value) === null ||
          parseExplorerConversationWaypointDraft(Object.getOwnPropertyDescriptor(row.conversation_state, "waypointDraft")?.value) === undefined)) throw new Error(FAILURE);
      if (Object.keys(row).length !== spec.columns.length || !spec.columns.every((column) => Object.hasOwn(row, column)) ||
        typeof row.outcome !== "string" || !OUTCOMES[port].includes(row.outcome) ||
        (Object.hasOwn(row, "dispatch_permitted") && typeof row.dispatch_permitted !== "boolean") ||
        (Object.hasOwn(row, "saved_reply") && typeof row.saved_reply !== "boolean") ||
        // A pause row names a closed kind, and its two flags are booleans that can be true only with a pause.
        (port === "pause" && (!NOTICE_KINDS.includes(row.notice_kind) || typeof row.crisis !== "boolean" ||
          typeof row.adults_only !== "boolean" || (row.notice_kind === null && (row.crisis || row.adults_only))))) throw new Error(FAILURE);
      if (Object.hasOwn(row, "waypoint_page")) {
        if (row.waypoint_page === null) {
          if (row.outcome === "ok" || row.outcome === "exact_replay") throw new Error(FAILURE);
        } else {
          const page = parseExplorerWaypointPage(row.waypoint_page);
          const kind = port === "readWaypointHeads" ? "current_heads" : port === "readWaypointHistory" ? "history" : "closure";
          if (!page || page.kind !== kind || (port === "readWaypointHistory" &&
              page.items.some(item => item.conversationId !== copied.p_conversation_id)) ||
              (port === "closeEndedWaypoint" && page.items[0].id !== copied.p_waypoint_id) ||
              (page.hasMore && page.nextOffset !== (copied.p_offset as number) + page.limit)) throw new Error(FAILURE);
          if (port === "closeEndedWaypoint") {
            const closed = page.items[0];
            if (copied.p_kind === "reach_waypoint"
              ? closed.status !== "reached" || closed.reachedEvidence !== copied.p_reached_evidence
              : closed.status !== "chosen" || closed.release?.operationId !== copied.p_operation_id) throw new Error(FAILURE);
          }
          return Object.freeze({ ...row, waypoint_page: page }) as ExplorerPrivateRpcRow;
        }
      }
      return Object.freeze({ ...row, ...(Object.hasOwn(row, "authority_context") ? { authority_context: authority } : {}), ...(row.conversation_state == null ? {} : {
        conversation_state: Object.freeze({ ...row.conversation_state as object,
          waypointCapacity: parseExplorerWaypointCapacity((row.conversation_state as Record<string, unknown>).waypointCapacity) }),
      }) }) as ExplorerPrivateRpcRow;
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
    respondCompassSuggestion: (input) => call("respondCompassSuggestion", input),
    respondWaypointDraft: (input) => call("respondWaypointDraft", input),
    readWaypointHeads: (input) => call("readWaypointHeads", input),
    readWaypointHistory: (input) => call("readWaypointHistory", input),
    closeEndedWaypoint: (input) => call("closeEndedWaypoint", input),
    arrange: (input) => call("arrange", input), category: (input) => call("category", input), release: (input) => call("release", input), waypointRevision: (input) => call("waypointRevision", input), end: (input) => call("end", input), review: (input) => call("review", input),
    pause: async (actor) => await call("pause", { p_actor_user_account_id: actor.accountId, p_user_session_id: actor.applicationSessionId }) as ExplorerPrivatePauseRow,
  });
}
