import "server-only";
import { createHash } from "node:crypto";
import {
  EXPLORER_CONVERSATION_VERSION,
  EXPLORER_CONVERSATION_LIMITS,
  parseExplorerConversationCommand,
  parseExplorerConversationResult,
  type ExplorerConversationCommand,
  type ExplorerConversationResult,
  type ExplorerConversationState,
} from "../explorerConversationContract";
import {
  invokeVirtualGuideConversation,
  type VirtualGuideConversationRequest,
  type VirtualGuideConversationTransport,
} from "./virtualGuideConversationContract";

export type ExplorerConversationActor = Readonly<{ accountId: string; applicationSessionId: string }>;
export type ExplorerConversationRpcRow = Readonly<{
  outcome: string;
  conversation_state: unknown;
  authority_context?: unknown;
  dispatch_permitted?: boolean;
}>;
export type ExplorerConversationRepository = Readonly<{
  read: (actor: ExplorerConversationActor, operation?: Readonly<{ operationId: string; fingerprint: string }>) => Promise<ExplorerConversationRpcRow>;
  prepare: (parameters: Readonly<Record<string, unknown>>) => Promise<ExplorerConversationRpcRow>;
  complete: (parameters: Readonly<Record<string, unknown>>) => Promise<ExplorerConversationRpcRow>;
  mutate: (parameters: Readonly<Record<string, unknown>>) => Promise<ExplorerConversationRpcRow>;
}>;
export type ExplorerConversationTurnIds = Readonly<{
  conversationId: string; messageId: string; snapshotId: string; invocationId: string; replyId: string; logicalOperationId: string;
}>;
export type ExplorerConversationPreparedContext = Readonly<{
  request: VirtualGuideConversationRequest;
  // Only the concrete, reviewed source builder may supply these database bindings.
  evidence: Readonly<Record<string, unknown>>;
}>;
export type ExplorerConversationDependencies = Readonly<{
  authenticate: () => Promise<ExplorerConversationActor | null>;
  repository: ExplorerConversationRepository;
  // Deliberately absent in the shipped composition root until separate runtime activation.
  provider?: VirtualGuideConversationTransport;
  buildContext?: (input: Readonly<{
    actor: ExplorerConversationActor; row: ExplorerConversationRpcRow;
    state: ExplorerConversationState; command: Extract<ExplorerConversationCommand, { kind: "send" }>;
    ids: ExplorerConversationTurnIds; signal?: AbortSignal;
  }>) => Promise<ExplorerConversationPreparedContext>;
}>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function failure(error: "denied" | "unavailable" | "refresh_required" | "provider_unavailable"): ExplorerConversationResult {
  return Object.freeze({ ok: false, state: null, error });
}
function actorValid(value: ExplorerConversationActor | null): value is ExplorerConversationActor {
  return value !== null && UUID.test(value.accountId) && UUID.test(value.applicationSessionId);
}
function result(row: ExplorerConversationRpcRow, providerAvailable: boolean): ExplorerConversationResult {
  if (["stale_revision", "operation_conflict"].includes(row.outcome)) return failure("refresh_required");
  if (row.outcome === "denied") return failure("denied");
  if (!["ok", "exact_replay"].includes(row.outcome)) return failure("unavailable");
  const parsed = parseExplorerConversationResult({ ok: true, state: row.conversation_state, error: null });
  if (!parsed?.ok) return failure("unavailable");
  return Object.freeze({ ok: true, error: null, state: Object.freeze({ ...parsed.state,
    providerState: providerAvailable ? "available" : "unavailable" }) });
}

// Stable server-side identity. Browser operation IDs select a bounded operation;
// binding them to authenticated actor/session prevents cross-account reuse.
function scopedId(actor: ExplorerConversationActor, conversationId: string, operationId: string, kind: string): string {
  const bytes = createHash("sha256").update(JSON.stringify([
    EXPLORER_CONVERSATION_VERSION, actor.accountId, actor.applicationSessionId, conversationId, operationId, kind,
  ])).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function base(actor: ExplorerConversationActor): Record<string, unknown> {
  return { p_actor_user_account_id: actor.accountId, p_user_session_id: actor.applicationSessionId };
}
export function explorerConversationCommandFingerprint(command: ExplorerConversationCommand): string {
  return createHash("sha256").update(JSON.stringify([
    EXPLORER_CONVERSATION_VERSION, command.kind, command.operationId, command.expectedRevision,
    "body" in command ? command.body : null,
    "sourceMessageId" in command ? command.sourceMessageId : null,
    "itemId" in command ? command.itemId : null,
    "waypointId" in command ? command.waypointId : null,
    "label" in command ? command.label : null,
    "destination" in command ? command.destination : null,
    "meaning" in command ? command.meaning : null,
    "arrivalSignal" in command ? command.arrivalSignal : null,
    "evidence" in command ? command.evidence : null,
  ]), "utf8").digest("hex").toUpperCase();
}
export async function readExplorerConversation(dependencies: ExplorerConversationDependencies): Promise<ExplorerConversationResult> {
  try {
    const actor = await dependencies.authenticate();
    if (!actorValid(actor)) return failure("denied");
    return result(await dependencies.repository.read(actor), Boolean(dependencies.provider && dependencies.buildContext));
  } catch { return failure("unavailable"); }
}

export async function commandExplorerConversation(input: {
  command: unknown; dependencies: ExplorerConversationDependencies; signal?: AbortSignal;
}): Promise<ExplorerConversationResult> {
  const command = parseExplorerConversationCommand(input.command);
  if (!command) return failure("denied");
  const { dependencies } = input;
  try {
    const actor = await dependencies.authenticate();
    if (!actorValid(actor)) return failure("denied");
    if (input.signal?.aborted) return failure("unavailable");
    const fingerprint = explorerConversationCommandFingerprint(command);
    const row = await dependencies.repository.read(actor, { operationId: command.operationId, fingerprint });
    const read = result(row, Boolean(dependencies.provider && dependencies.buildContext));
    if (!read.ok) return read;
    if (input.signal?.aborted) return failure("unavailable");
    // Replay is settled from current owned operation evidence before assembling
    // a new context. Current history may already contain that turn and its reply.
    if (row.outcome === "exact_replay") return read;
    if (read.state.pendingTurn) return failure("refresh_required");
    if (command.kind !== "send") {
      if (read.state.conversationId === null) return failure("denied");
      const parameters = { ...base(actor), p_conversation_id: read.state.conversationId,
        p_operation_id: command.operationId, p_expected_revision: command.expectedRevision,
        p_command_fingerprint: fingerprint,
        p_kind: command.kind, p_source_message_id: "sourceMessageId" in command ? command.sourceMessageId : null,
        p_item_id: "itemId" in command ? command.itemId : null,
        p_waypoint_id: "waypointId" in command ? command.waypointId : null,
        p_label: "label" in command ? command.label : null,
        p_destination: "destination" in command ? command.destination : null,
        p_meaning: "meaning" in command ? command.meaning : null,
        p_arrival_signal: "arrivalSignal" in command ? command.arrivalSignal : null,
        p_evidence: "evidence" in command ? command.evidence : null };
      return result(await dependencies.repository.mutate(parameters), Boolean(dependencies.provider && dependencies.buildContext));
    }
    // Reserve space for both the Explorer message and its eventual saved reply.
    if (read.state.messages.length > EXPLORER_CONVERSATION_LIMITS.messages - 2) return failure("refresh_required");
    // No message, snapshot or invocation is written while provider activation is held.
    if (!dependencies.provider || !dependencies.buildContext) return failure("provider_unavailable");
    const conversationId = read.state.conversationId ?? scopedId(actor, "new", command.operationId, "conversation");
    const ids = Object.freeze({ conversationId,
      logicalOperationId: scopedId(actor, conversationId, command.operationId, "logical-operation"),
      messageId: scopedId(actor, conversationId, command.operationId, "message"),
      snapshotId: scopedId(actor, conversationId, command.operationId, "snapshot"),
      invocationId: scopedId(actor, conversationId, command.operationId, "invocation"),
      replyId: scopedId(actor, conversationId, command.operationId, "reply") });
    const context = await dependencies.buildContext({ actor, row, state: read.state, command, ids, signal: input.signal });
    if (context.request.invocationId !== ids.invocationId || context.request.sessionId !== ids.conversationId ||
        context.request.contextSnapshotId !== ids.snapshotId || input.signal?.aborted) return failure("unavailable");
    const prepared = await dependencies.repository.prepare({ ...context.evidence, ...base(actor),
      p_conversation_id: conversationId, p_operation_id: command.operationId,
      p_expected_revision: command.expectedRevision, p_message_id: ids.messageId,
      p_command_fingerprint: fingerprint,
      p_logical_operation_id: ids.logicalOperationId,
      p_snapshot_id: ids.snapshotId, p_invocation_id: ids.invocationId, p_body: command.body,
      p_context_serialization: context.request.authorizedContext,
      p_context_fingerprint_sha256: context.request.contextFingerprint });
    if (prepared.outcome === "exact_replay") {
      // A previous transport may already have reached the provider. Never redispatch.
      return result(prepared, true);
    }
    if (prepared.outcome !== "ok") return result(prepared, true);
    if (prepared.dispatch_permitted !== true) return failure("unavailable");
    try {
      const response = await invokeVirtualGuideConversation({ request: context.request,
        transport: dependencies.provider, timeoutMilliseconds: 60_000, signal: input.signal });
      const completed = await dependencies.repository.complete({ ...base(actor), p_conversation_id: conversationId,
        p_operation_id: command.operationId, p_status: "completed", p_reply_message_id: ids.replyId,
        p_reply_body: response.assistantMessage.content });
      return result(completed, true);
    } catch {
      // The request may have reached the provider. Record only the closed terminal
      // failure; no retry or invented reply. A failed settlement remains unavailable.
      try {
        await dependencies.repository.complete({ ...base(actor), p_conversation_id: conversationId,
          p_operation_id: command.operationId, p_status: input.signal?.aborted ? "canceled" : "failed",
          p_reply_message_id: null, p_reply_body: null });
      } catch { /* Preserve opaque outward failure; durable pending state remains discoverable. */ }
      return failure("unavailable");
    }
  } catch { return failure("unavailable"); }
}
