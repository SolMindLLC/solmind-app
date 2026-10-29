import "server-only";
import { createHash } from "node:crypto";
import { types } from "node:util";
import { parseOpenAiModelName } from "./openAiModelConfiguration";
import {
  EXPLORER_CONVERSATION_VERSION, EXPLORER_CONVERSATION_LIMITS,
  parseExplorerConversationCommand, parseExplorerConversationResult, isExplorerConversationId,
  type ExplorerConversationCommand, type ExplorerConversationResult, type ExplorerConversationState, type ExplorerCompassArrangementItem,
} from "../explorerConversationContract";
import { parseExplorerConversationReviewResult } from "../explorerConversationReviewContract";
import { explorerConversationCommandFingerprint, type ExplorerConversationActor, type ExplorerConversationTurnIds, type ExplorerConversationDependencies } from "./explorerConversationComposition";
import { parseExplorerPrivateConfigurationCandidate, type ExplorerPrivateConfigurationCandidate } from "./explorerPrivateConfiguration";
import {
  EXPLORER_SAFETY_REQUEST_VERSION, EXPLORER_SAFETY_REPLY_PROTOCOL, explorerSafetyUnicodeValid, parseExplorerSafetyReplyRequest,
  type ExplorerSafetyReplyRequest, type ExplorerSafetyClassification,
} from "./explorerSafetyReplyContract";
import { invokeExplorerSafetyReply, type ExplorerSafetyReplyTransport } from "./explorerSafetyReplyInvocation";
import type { ExplorerPrivateAssistance } from "../explorerPrivateConversationResponse";
import {
  combineExplorerSafety, detectExplorerFallback, selectExplorerSafetyReply, selectExplorerSafetyRequestMode,
  type ExplorerConversationPolicy, type ExplorerFallbackObservation, type ExplorerSafetyReplyPlan,
} from "./explorerConversationSafety";

type ActorParameters = Readonly<{ p_actor_user_account_id: string; p_user_session_id: string }>;
type MethodologyParameters = Readonly<{ p_methodology_context_pack_id: string; p_methodology_context_pack_version_id: string;
  p_methodology_content_sha256: string; p_methodology_authorization_version: string }>;
export type ExplorerPrivateEnsureParameters = ActorParameters & MethodologyParameters & Readonly<{
  p_candidate_conversation_id: string; p_expected_revision: number; p_configuration_fingerprint: string }>;
export type ExplorerPrivateObserveParameters = ActorParameters & Readonly<{
  p_conversation_id: string; p_operation_id: string; p_logical_operation_id: string; p_expected_revision: number;
  p_command_fingerprint: string; p_protocol_version: string; p_fallback_policy_version: string;
  p_model_policy_version: string; p_configuration_fingerprint: string; p_fallback_level: number; p_fallback_minor_indicated: boolean }>;
export type ExplorerPrivateContextEvidence = Readonly<{
  p_context_source_ids: readonly string[]; p_authorization_version: string; p_intake_response_set_id: string;
  p_prompt_version: string; p_policy_version: string; p_behavior_version: string; p_crisis_version: string;
  p_role_version: string; p_instruction_version: string }>;
export type ExplorerPrivatePrepareParameters = ExplorerPrivateObserveParameters & MethodologyParameters & ExplorerPrivateContextEvidence & Readonly<{
  p_message_id: string; p_snapshot_id: string; p_invocation_id: string; p_body: string;
  p_context_serialization: string; p_context_fingerprint_sha256: string; p_request_mode: string;
  p_trusted_response_version: string; p_resource_policy_version: string; p_expected_safety_version: number; p_model_name: string }>;
export type ExplorerPrivateReplyKind = "ordinary" | "urgent" | "crisis" | "restricted" | "adult_only" | "none";
export type ExplorerPrivateSettleParameters = ActorParameters & Readonly<{
  p_conversation_id: string; p_operation_id: string; p_status: "completed" | "failed" | "canceled";
  p_reply_message_id: string | null; p_reply_kind: ExplorerPrivateReplyKind; p_reply_body: string | null;
  p_model_level: number | null; p_model_minor_indicated: boolean | null; p_protocol_version: string;
  p_request_mode: string; p_configuration_fingerprint: string; p_fallback_policy_version: string;
  p_model_policy_version: string; p_trusted_response_version: string; p_resource_policy_version: string;
  p_fallback_level: number; p_fallback_minor_indicated: boolean; p_delivery_interested: boolean }>;
export type ExplorerPrivateMutateParameters = ActorParameters & Readonly<{
  p_conversation_id: string; p_operation_id: string; p_expected_revision: number; p_command_fingerprint: string;
  p_kind: string; p_source_message_id: string | null; p_item_id: string | null; p_waypoint_id: string | null;
  p_label: string | null; p_destination: string | null; p_meaning: string | null; p_arrival_signal: string | null; p_evidence: string | null }>;
export type ExplorerPrivateArrangeParameters = ActorParameters & Readonly<{
  p_conversation_id: string; p_operation_id: string; p_expected_revision: number; p_command_fingerprint: string;
  p_priority_id: string | null; p_items: readonly ExplorerCompassArrangementItem[] }>;
export type ExplorerPrivateCategoryParameters = ActorParameters & Readonly<{
  p_conversation_id: string; p_operation_id: string; p_expected_revision: number; p_command_fingerprint: string;
  p_target_item_id: string; p_member_item_ids: readonly string[]; p_label: string }>;
export type ExplorerPrivateEndParameters = ActorParameters & Readonly<{
  p_conversation_id: string; p_operation_id: string; p_expected_revision: number; p_command_fingerprint: string }>;
export type ExplorerPrivateReviewParameters = ActorParameters & Readonly<{ p_conversation_id: string | null }>;
export type ExplorerPrivateConversationReviewResult = NonNullable<ReturnType<typeof parseExplorerConversationReviewResult>>;
export type ExplorerPrivateRpcRow = Readonly<{ outcome: string; ended_conversations?: unknown; conversation_state?: unknown; authority_context?: unknown;
  policy_state?: unknown; dispatch_permitted?: boolean; saved_reply?: boolean }>;
export type ExplorerPrivateReadRow = ExplorerPrivateRpcRow & Readonly<{ conversation_state: unknown }>;
export type ExplorerPrivateConversationRepository = Readonly<{
  read: (actor: ExplorerConversationActor, operation?: Readonly<{ operationId: string; fingerprint: string }>) => Promise<ExplorerPrivateReadRow>;
  ensure: (parameters: ExplorerPrivateEnsureParameters) => Promise<ExplorerPrivateRpcRow>;
  observe: (parameters: ExplorerPrivateObserveParameters) => Promise<ExplorerPrivateRpcRow>;
  prepare: (parameters: ExplorerPrivatePrepareParameters) => Promise<ExplorerPrivateRpcRow>;
  settle: (parameters: ExplorerPrivateSettleParameters) => Promise<ExplorerPrivateRpcRow>;
  mutate?: (parameters: ExplorerPrivateMutateParameters) => Promise<ExplorerPrivateRpcRow>;
  arrange?: (parameters: ExplorerPrivateArrangeParameters) => Promise<ExplorerPrivateRpcRow>;
  category?: (parameters: ExplorerPrivateCategoryParameters) => Promise<ExplorerPrivateRpcRow>;
  end?: (parameters: ExplorerPrivateEndParameters) => Promise<ExplorerPrivateRpcRow>;
  review?: (parameters: ExplorerPrivateReviewParameters) => Promise<ExplorerPrivateRpcRow>;
}>;
export type ExplorerPrivateConversationResult = Readonly<{ result: ExplorerConversationResult; assistance: ExplorerPrivateAssistance | null }>;
export type ExplorerPrivateOperationalReadiness = Readonly<{
  configuration: ExplorerPrivateConfigurationCandidate; configurationFingerprint: string; modelPolicyVersion: string; modelName: string;
  resourcePolicyVersion: string; sourceVerificationReceiptSha256: string; resourceVerificationReceiptSha256: string;
  rendererVerificationReceiptSha256: string; signalVerificationReceiptSha256: string;
  methodology: Readonly<{ packId: string; versionId: string; contentSha256: string; authorizationVersion: string }>;
}>;
export type ExplorerPrivateSignalMarker = "preparation_unavailable" | "trusted_render_unavailable" | "settlement_unconfirmed";
export type ExplorerPrivateConversationDependencies = Readonly<{
  authenticate: () => Promise<ExplorerConversationActor | null>; repository: ExplorerPrivateConversationRepository;
  // None of these capabilities is supplied by a candidate getter/default factory.
  resolveOperationalReadiness?: (actor: ExplorerConversationActor, row: ExplorerPrivateRpcRow) => Promise<ExplorerPrivateOperationalReadiness | null>;
  provider?: ExplorerSafetyReplyTransport;
  buildContext?: (input: Readonly<{ actor: ExplorerConversationActor; row: ExplorerPrivateRpcRow; state: ExplorerConversationState;
    command: Extract<ExplorerConversationCommand, { kind: "send" }>; ids: ExplorerConversationTurnIds;
    readiness: ExplorerPrivateOperationalReadiness; mode: ExplorerSafetyReplyRequest["mode"]; signal?: AbortSignal }>) => Promise<Readonly<{
      request: ExplorerSafetyReplyRequest; evidence: ExplorerPrivateContextEvidence }>>;
  renderer?: Readonly<{ verificationReceiptSha256: string;
    failureAssistance: Readonly<{ support: string; adultPolicy: string; supportAndAdultPolicy: string; temporarilyUnavailable: string }>;
    render: (plan: ExplorerSafetyReplyPlan, readiness: ExplorerPrivateOperationalReadiness, signal: AbortSignal) => Promise<Readonly<{
      kind: Exclude<ExplorerPrivateReplyKind, "ordinary" | "none">; body: string;
      trustedResponseVersion: string; resourcePolicyVersion: string }>> }>;
  operationalSignal?: Readonly<{ verificationReceiptSha256: string;
    emit: (marker: ExplorerPrivateSignalMarker, signal: AbortSignal) => Promise<void> }>;
}>;
// Only an explicit AV3 governed builder can satisfy this adapter. It reuses
// exact assembled context BYTES; it never invokes the old prose-first runtime.
export function adaptPrivateGovernedExplorerContextBuilder(
  builder: NonNullable<ExplorerConversationDependencies["buildContext"]>,
): NonNullable<ExplorerPrivateConversationDependencies["buildContext"]> {
  return async (input) => {
    const built = await builder({ actor: input.actor,
      row: { ...input.row, conversation_state: input.row.conversation_state }, state: input.state,
      command: input.command, ids: input.ids, ...(input.signal === undefined ? {} : { signal: input.signal }) });
    const evidence = built.evidence;
    if (built.request.contractVersion !== "virtual-guide-conversation.v1" ||
      !pinnedPolicyText(built.request.authorizedContext, input.readiness.configuration) ||
      typeof evidence.p_authorization_version !== "string" || !/^AV3:[0-9A-F]{64}$/.test(evidence.p_authorization_version) ||
      evidence.p_methodology_context_pack_id !== input.readiness.methodology.packId ||
      evidence.p_methodology_context_pack_version_id !== input.readiness.methodology.versionId ||
      evidence.p_methodology_content_sha256 !== input.readiness.methodology.contentSha256 ||
      evidence.p_methodology_authorization_version !== input.readiness.methodology.authorizationVersion ||
      !Array.isArray(evidence.p_context_source_ids) || evidence.p_context_source_ids.some((id) => typeof id !== "string") ||
      ![evidence.p_intake_response_set_id, evidence.p_prompt_version, evidence.p_policy_version, evidence.p_behavior_version,
        evidence.p_crisis_version, evidence.p_role_version, evidence.p_instruction_version].every((value) => typeof value === "string")) {
      throw new Error("explorer_private_context_unavailable");
    }
    return Object.freeze({ request: parseExplorerSafetyReplyRequest({
      contractVersion: EXPLORER_SAFETY_REQUEST_VERSION, invocationId: built.request.invocationId,
      explorerId: built.request.explorerId, sessionId: built.request.sessionId, contextSnapshotId: built.request.contextSnapshotId,
      contextFingerprint: built.request.contextFingerprint, authorizedContext: built.request.authorizedContext,
      mode: input.mode, classificationPolicyVersion: input.readiness.modelPolicyVersion,
      fallbackPolicyVersion: input.readiness.configuration.fallback.version, instructionVersion: input.readiness.configuration.instructionVersion,
    }), evidence: Object.freeze({ p_context_source_ids: Object.freeze([...evidence.p_context_source_ids]) as readonly string[],
      p_authorization_version: evidence.p_authorization_version, p_intake_response_set_id: evidence.p_intake_response_set_id as string,
      p_prompt_version: evidence.p_prompt_version as string, p_policy_version: evidence.p_policy_version as string,
      p_behavior_version: evidence.p_behavior_version as string, p_crisis_version: evidence.p_crisis_version as string,
      p_role_version: evidence.p_role_version as string, p_instruction_version: evidence.p_instruction_version as string }) });
  };
}
// Match the existing safe assembler's exact text normalization. Versions alone
// cannot bind the reviewed behavior to the bytes that will actually be sent.
function pinnedPolicyText(serialization: string, configuration: ExplorerPrivateConfigurationCandidate): boolean {
  try {
    const envelope: unknown = JSON.parse(serialization);
    if (envelope === null || typeof envelope !== "object" || Array.isArray(envelope) ||
      (envelope as Record<string, unknown>).contractVersion !== "wi007-v0.1+onboarding-fields-v2") return false;
    for (const key of ["globalPolicy", "roleBehavior", "crisisBehavior"] as const) {
      const part = (envelope as Record<string, unknown>)[key];
      if (part === null || typeof part !== "object" || Array.isArray(part) ||
        Object.keys(part).sort().join("|") !== "text|version") return false;
      const layer = part as Record<string, unknown>; const pinned = configuration[key];
      if (layer.version !== pinned.version || layer.text !== pinned.text.replace(/\r\n?/g, "\n").trim()) return false;
    }
    return true;
  } catch { return false; }
}
function retainKnownPolicy(previous: ExplorerConversationPolicy, current: ExplorerConversationPolicy): ExplorerConversationPolicy {
  if (previous.status !== "known") return current;
  if (current.status !== "known") return previous;
  const floor = Math.max(previous.restrictedLevel ?? 0, current.restrictedLevel ?? 0);
  return Object.freeze({ status: "known", restrictedLevel: floor >= 3 ? floor as 3 | 4 : null,
    adultReflectionStopped: previous.adultReflectionStopped || current.adultReflectionStopped,
    safetyVersion: Math.max(previous.safetyVersion, current.safetyVersion) });
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA = /^[0-9A-F]{64}$/;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const UNKNOWN: ExplorerConversationPolicy = Object.freeze({ status: "unknown" });
function actorValid(actor: ExplorerConversationActor | null): actor is ExplorerConversationActor {
  return actor !== null && typeof actor.accountId === "string" && UUID.test(actor.accountId) && typeof actor.applicationSessionId === "string" && UUID.test(actor.applicationSessionId);
}
function failed(error: "denied" | "unavailable" | "refresh_required" | "provider_unavailable" = "unavailable"): ExplorerPrivateConversationResult {
  return Object.freeze({ result: Object.freeze({ ok: false, state: null, error }), assistance: null });
}
function stateResult(row: ExplorerPrivateRpcRow, available = false): ExplorerConversationResult {
  if (row.outcome === "denied") return failed("denied").result;
  if (["stale_revision", "stale_policy", "operation_conflict"].includes(row.outcome)) return failed("refresh_required").result;
  if (!["ok", "exact_replay"].includes(row.outcome)) return failed().result;
  const parsed = parseExplorerConversationResult({ ok: true, state: row.conversation_state, error: null });
  return parsed?.ok ? Object.freeze({ ok: true, error: null, state: Object.freeze({ ...parsed.state, providerState: available ? "available" : "unavailable" }) }) : failed().result;
}
export function parseExplorerPrivatePolicy(value: unknown): ExplorerConversationPolicy {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value) || types.isProxy(value)) return UNKNOWN;
    const row = value as Record<string, unknown>;
    if (![Object.prototype, null].includes(Object.getPrototypeOf(row)) ||
      Reflect.ownKeys(row).length !== 5 || Object.keys(row).sort().join("|") !== "adultReflectionStopped|contractVersion|known|restrictedLevel|version" ||
      Object.keys(row).some((key) => { const descriptor = Object.getOwnPropertyDescriptor(row, key); return !descriptor || !("value" in descriptor); }) ||
      row.known !== true || row.contractVersion !== "explorer-conversation-safety.v1" || ![null, 3, 4].includes(row.restrictedLevel as number | null) ||
      typeof row.adultReflectionStopped !== "boolean" || !Number.isSafeInteger(row.version) || (row.version as number) < 0) return UNKNOWN;
    return Object.freeze({ status: "known", restrictedLevel: row.restrictedLevel as 3 | 4 | null,
      adultReflectionStopped: row.adultReflectionStopped, safetyVersion: row.version as number });
  } catch { return UNKNOWN; }
}
function scoped(actor: ExplorerConversationActor, conversation: string, operation: string, kind: string): string {
  const bytes = createHash("sha256").update(JSON.stringify([EXPLORER_CONVERSATION_VERSION, actor.accountId, actor.applicationSessionId, conversation, operation, kind])).digest();
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.subarray(0, 16).toString("hex");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}
export function deriveExplorerPrivateTurnIds(actor: ExplorerConversationActor, conversationId: string, operationId: string): ExplorerConversationTurnIds {
  return Object.freeze({ conversationId, logicalOperationId: scoped(actor, conversationId, operationId, "logical-operation"),
    messageId: scoped(actor, conversationId, operationId, "message"), snapshotId: scoped(actor, conversationId, operationId, "snapshot"),
    invocationId: scoped(actor, conversationId, operationId, "invocation"), replyId: scoped(actor, conversationId, operationId, "reply") });
}
function base(actor: ExplorerConversationActor): ActorParameters { return { p_actor_user_account_id: actor.accountId, p_user_session_id: actor.applicationSessionId }; }
function bodyValid(body: unknown): body is string {
  return typeof body === "string" && body.trim().length > 0 && body.length <= 8192 && explorerSafetyUnicodeValid(body) && !/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/u.test(body);
}
async function ownedCapability<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMilliseconds: number): Promise<T> {
  const controller = new AbortController(); const deadlineAt = performance.now() + timeoutMilliseconds;
  const sentinel = new Error("explorer_private_capability_unavailable");
  let rejectDeadline!: (reason: unknown) => void;
  const deadline = new Promise<never>((_resolve, reject) => { rejectDeadline = reject; });
  void deadline.catch(() => undefined);
  const timer = setTimeout(() => { controller.abort(); rejectDeadline(sentinel); }, timeoutMilliseconds);
  try {
    const pending = operation(controller.signal);
    if (!types.isPromise(pending) || Object.getPrototypeOf(pending) !== Promise.prototype || Object.getOwnPropertyDescriptor(pending, "then") !== undefined) throw sentinel;
    const constructor = Object.getOwnPropertyDescriptor(pending, "constructor");
    if (constructor !== undefined && (!("value" in constructor) || constructor.value !== Promise)) throw sentinel;
    const value = await Promise.race([pending, deadline]);
    if (performance.now() >= deadlineAt) throw sentinel;
    return value;
  } catch { controller.abort(); throw sentinel; }
  finally { clearTimeout(timer); }
}
function verifiedReadiness(value: ExplorerPrivateOperationalReadiness | null, dependencies: ExplorerPrivateConversationDependencies): ExplorerPrivateOperationalReadiness | null {
  if (!value || !dependencies.provider || !dependencies.buildContext || !dependencies.renderer || !dependencies.operationalSignal) return null;
  const configuration = parseExplorerPrivateConfigurationCandidate(value.configuration);
  const modelName = parseOpenAiModelName(value.modelName);
  if (!configuration || ![value.configurationFingerprint, value.sourceVerificationReceiptSha256, value.resourceVerificationReceiptSha256,
    value.rendererVerificationReceiptSha256, value.signalVerificationReceiptSha256].every((hash) => typeof hash === "string" && SHA.test(hash)) ||
    !VERSION.test(value.modelPolicyVersion) || !VERSION.test(value.resourcePolicyVersion) ||
    !UUID.test(value.methodology.packId) || !UUID.test(value.methodology.versionId) || !SHA.test(value.methodology.contentSha256) ||
    !/^MV1:[0-9A-F]{64}$/.test(value.methodology.authorizationVersion) ||
    dependencies.renderer.verificationReceiptSha256 !== value.rendererVerificationReceiptSha256 ||
    dependencies.operationalSignal.verificationReceiptSha256 !== value.signalVerificationReceiptSha256 ||
    typeof dependencies.renderer.render !== "function" || typeof dependencies.operationalSignal.emit !== "function" ||
    !Object.values(dependencies.renderer.failureAssistance).every(bodyValid) ||
    Object.keys(dependencies.renderer.failureAssistance).sort().join("|") !== "adultPolicy|support|supportAndAdultPolicy|temporarilyUnavailable") return null;
  return Object.freeze({ ...value, configuration, modelName, methodology: Object.freeze({ ...value.methodology }) });
}
async function freshState(dependencies: ExplorerPrivateConversationDependencies, actor: ExplorerConversationActor): Promise<ExplorerConversationResult> {
  try {
    const freshActor = await dependencies.authenticate();
    if (!actorValid(freshActor) || freshActor.accountId !== actor.accountId || freshActor.applicationSessionId !== actor.applicationSessionId) return failed("denied").result;
    return stateResult(await dependencies.repository.read(freshActor));
  } catch { return failed().result; }
}
export async function readExplorerPrivateConversation(dependencies: ExplorerPrivateConversationDependencies): Promise<ExplorerPrivateConversationResult> {
  try { const actor = await dependencies.authenticate(); if (!actorValid(actor)) return failed("denied");
    const row = await dependencies.repository.read(actor);
    const state = stateResult(row);
    if (!state.ok) return Object.freeze({ result: state, assistance: null });
    if (dependencies.resolveOperationalReadiness === undefined) return Object.freeze({ result: state, assistance: null });
    // A GET never ensures an anchor or writes evidence. Readiness is a fresh
    // server capability, not a browser flag or the inert candidate getter.
    let available = false;
    try { available = verifiedReadiness(await dependencies.resolveOperationalReadiness(actor, row), dependencies) !== null; }
    catch { /* Saved history remains readable while operational inputs are held. */ }
    // Readiness may await external governance/storage. Never release the old
    // private projection after that wait without fresh identity and authority.
    const current = await freshState(dependencies, actor);
    return Object.freeze({ result: current.ok ? Object.freeze({ ...current,
      state: Object.freeze({ ...current.state, providerState: available ? "available" : "unavailable" }) }) : current, assistance: null });
  } catch { return failed(); }
}
function reviewFailure(error: "denied" | "unavailable" = "unavailable"): ExplorerPrivateConversationReviewResult {
  return Object.freeze({ version: "explorer-conversation-review.v1", ok: false, items: null, state: null, error });
}

// This read uses only the current owned ended-review capability. It never
// consults the active selector, configuration, context or provider path.
export async function readEndedExplorerConversations(
  dependencies: ExplorerPrivateConversationDependencies,
  conversationId: string | null,
): Promise<ExplorerPrivateConversationReviewResult> {
  if (conversationId !== null && !isExplorerConversationId(conversationId)) {
    return reviewFailure("denied");
  }
  try {
    const actor = await dependencies.authenticate();
    if (!actorValid(actor)) return reviewFailure("denied");
    if (dependencies.repository.review === undefined) return reviewFailure();
    const row = await dependencies.repository.review({ ...base(actor), p_conversation_id: conversationId });
    if (row.outcome === "denied") return reviewFailure("denied");
    if (row.outcome !== "ok") return reviewFailure();
    const parsed = parseExplorerConversationReviewResult({ version: "explorer-conversation-review.v1", ok: true,
      items: row.ended_conversations, state: row.conversation_state, error: null });
    if (!parsed?.ok || (conversationId === null ? parsed.state !== null
      : parsed.state === null || parsed.state.conversationId !== conversationId || parsed.state.sessionStatus !== "ended") ||
      (parsed.state !== null && parsed.state.providerState !== "unavailable")) return reviewFailure();
    return parsed;
  } catch { return reviewFailure(); }
}

export async function commandExplorerPrivateConversation(input: Readonly<{ command: unknown; dependencies: ExplorerPrivateConversationDependencies; signal?: AbortSignal }>): Promise<ExplorerPrivateConversationResult> {
  let command: ReturnType<typeof parseExplorerConversationCommand>;
  try { command = parseExplorerConversationCommand(input.command); } catch { return failed("denied"); }
  if (!command) return failed("denied");
  const { dependencies } = input;
  try {
    const authenticated = await dependencies.authenticate(); if (!actorValid(authenticated)) return failed("denied");
    const actor: ExplorerConversationActor = authenticated;
    if (input.signal?.aborted) return failed();
    const fingerprint = explorerConversationCommandFingerprint(command);
    if (command.kind === "end_conversation") {
      // End and its replay cannot use the active-only preflight after commit.
      // SQL owns fresh current authority, pending state and atomic closure.
      if (dependencies.repository.end === undefined) return failed("denied");
      const row = await dependencies.repository.end({ ...base(actor), p_conversation_id: command.conversationId,
        p_operation_id: command.operationId, p_expected_revision: command.expectedRevision, p_command_fingerprint: fingerprint });
      const ended = stateResult(row.outcome === "already_ended" ? { ...row, outcome: "ok" } : row);
      if (!ended.ok) return Object.freeze({ result: ended, assistance: null });
      if (ended.state.conversationId !== command.conversationId || ended.state.sessionStatus !== "ended") return failed();
      if (row.outcome !== "already_ended") {
        const ending = ended.state.ending;
        if (ending == null || ending.operationId !== command.operationId || ending.revision !== ended.state.revision ||
            ending.revision !== command.expectedRevision + 1 || ending.routeThroughRevision !== command.expectedRevision) return failed();
      }
      return Object.freeze({ result: ended, assistance: null });
    }
    const readRow = await dependencies.repository.read(actor, { operationId: command.operationId, fingerprint });
    const read = stateResult(readRow); if (!read.ok) return Object.freeze({ result: read, assistance: null });
    // Historical exact command replay precedes new configuration/source/model work.
    if (readRow.outcome === "exact_replay") return Object.freeze({ result: read, assistance: null });
    if (read.state.pendingTurn || input.signal?.aborted) return failed("refresh_required");
    let policy = parseExplorerPrivatePolicy(readRow.policy_state);
    if (command.kind !== "send") {
      if (!read.state.conversationId || policy.status !== "known" || policy.restrictedLevel !== null || policy.adultReflectionStopped) return failed("denied");
      if (command.kind === "confirm_compass_arrangement") {
        if (!dependencies.repository.arrange) return failed("denied");
        const row = await dependencies.repository.arrange({ ...base(actor), p_conversation_id: read.state.conversationId,
          p_operation_id: command.operationId, p_expected_revision: command.expectedRevision,
          p_command_fingerprint: fingerprint, p_priority_id: command.priorityId, p_items: command.items });
        return Object.freeze({ result: stateResult(row), assistance: null });
      }
      if (command.kind === "confirm_compass_category") {
        if (!dependencies.repository.category) return failed("denied");
        const row = await dependencies.repository.category({ ...base(actor), p_conversation_id: read.state.conversationId,
          p_operation_id: command.operationId, p_expected_revision: command.expectedRevision,
          p_command_fingerprint: fingerprint, p_target_item_id: command.targetItemId,
          p_member_item_ids: command.memberItemIds, p_label: command.label });
        return Object.freeze({ result: stateResult(row), assistance: null });
      }
      if (!dependencies.repository.mutate) return failed("denied");
      const row = await dependencies.repository.mutate({ ...base(actor), p_conversation_id: read.state.conversationId,
        p_operation_id: command.operationId, p_expected_revision: command.expectedRevision, p_command_fingerprint: fingerprint,
        p_kind: command.kind, p_source_message_id: "sourceMessageId" in command ? command.sourceMessageId : null,
        p_item_id: "itemId" in command ? command.itemId : null, p_waypoint_id: "waypointId" in command ? command.waypointId : null,
        p_label: "label" in command ? command.label : null, p_destination: "destination" in command ? command.destination : null,
        p_meaning: "meaning" in command ? command.meaning : null, p_arrival_signal: "arrivalSignal" in command ? command.arrivalSignal : null,
        p_evidence: "evidence" in command ? command.evidence : null });
      return Object.freeze({ result: stateResult(row), assistance: null });
    }
    if (read.state.messages.length > EXPLORER_CONVERSATION_LIMITS.messages - 2) return failed("refresh_required");
    if (!dependencies.resolveOperationalReadiness) return failed("provider_unavailable");
    const readiness = verifiedReadiness(await dependencies.resolveOperationalReadiness(actor, readRow), dependencies);
    if (!readiness || input.signal?.aborted) return failed("provider_unavailable");
    const failureAssistance = Object.freeze({ ...dependencies.renderer!.failureAssistance });
    const render = dependencies.renderer!.render;
    const emitSignal = dependencies.operationalSignal!.emit;
    const methodology: MethodologyParameters = { p_methodology_context_pack_id: readiness.methodology.packId,
      p_methodology_context_pack_version_id: readiness.methodology.versionId, p_methodology_content_sha256: readiness.methodology.contentSha256,
      p_methodology_authorization_version: readiness.methodology.authorizationVersion };
    const ensuredRow = await dependencies.repository.ensure({ ...base(actor), ...methodology,
      p_candidate_conversation_id: scoped(actor, "new", command.operationId, "conversation"),
      p_expected_revision: command.expectedRevision, p_configuration_fingerprint: readiness.configurationFingerprint });
    const ensured = stateResult(["created", "reused"].includes(ensuredRow.outcome) ? { ...ensuredRow, outcome: "ok" } : ensuredRow, true);
    if (!ensured.ok || !ensured.state.conversationId) return Object.freeze({ result: ensured.ok ? failed().result : ensured, assistance: null });
    const ids = deriveExplorerPrivateTurnIds(actor, ensured.state.conversationId, command.operationId);
    policy = parseExplorerPrivatePolicy(ensuredRow.policy_state);
    let fallback: ExplorerFallbackObservation = { status: "unavailable" };
    let knownModel: ExplorerSafetyClassification | null = null;
    // Retained positive facts serve failure assistance only, never dispatch permission.
    let rememberedPolicy = policy;
    async function transient(marker: ExplorerPrivateSignalMarker, persistence: "failed" | "unconfirmed" = "failed") : Promise<ExplorerPrivateConversationResult> {
      const safety = combineExplorerSafety({ policy: retainKnownPolicy(rememberedPolicy, policy), fallback, model: knownModel });
      const critical = safety.restrictedLevel !== null || safety.adultReflectionStopped;
      if (critical) {
        try { await ownedCapability((signal) => emitSignal(marker, signal), 1000); }
        catch { /* Assistance is not suppressed by signal failure or a hung signal port. */ }
      }
      const current = await freshState(dependencies, actor);
      if (input.signal?.aborted) return failed();
      const messages = failureAssistance;
      const body = safety.adultReflectionStopped ? (safety.restrictedLevel !== null ? messages.supportAndAdultPolicy : messages.adultPolicy)
        : critical ? messages.support : messages.temporarilyUnavailable;
      // No generated candidate, saved-record claim or private state without a
      // separate fresh authenticated read. Static assistance remains transient.
      void persistence;
      return Object.freeze({ result: current, assistance: Object.freeze({
        kind: critical ? safety.adultReflectionStopped && safety.restrictedLevel === null ? "adult_policy" : "support" : "temporarily_unavailable",
        body, persisted: false }) });
    }
    try {
      fallback = detectExplorerFallback(command.body, readiness.configuration.fallback);
      if (fallback.status !== "available" || input.signal?.aborted) return transient("preparation_unavailable");
      const observationParameters: ExplorerPrivateObserveParameters = { ...base(actor), p_conversation_id: ids.conversationId,
        p_operation_id: command.operationId, p_logical_operation_id: ids.logicalOperationId, p_expected_revision: command.expectedRevision,
        p_command_fingerprint: fingerprint, p_protocol_version: EXPLORER_SAFETY_REPLY_PROTOCOL,
        p_fallback_policy_version: fallback.policyVersion, p_model_policy_version: readiness.modelPolicyVersion,
        p_configuration_fingerprint: readiness.configurationFingerprint,
        p_fallback_level: fallback.classification.level, p_fallback_minor_indicated: fallback.classification.minorIndicated };
      const observed = await dependencies.repository.observe(observationParameters);
      if (observed.outcome === "exact_replay") {
        const replay = await dependencies.repository.read(actor, { operationId: command.operationId, fingerprint });
        return replay.outcome === "exact_replay" ? Object.freeze({ result: stateResult(replay, true), assistance: null }) : transient("preparation_unavailable");
      }
      if (observed.outcome !== "ok") return transient("preparation_unavailable");
      policy = parseExplorerPrivatePolicy(observed.policy_state);
      rememberedPolicy = retainKnownPolicy(rememberedPolicy, policy);
      // AV3 includes policy/anchor facts. Observe may advance them, so neither
      // a preanchor read nor ensure's authority is reused as current authority.
      const builderRow = await dependencies.repository.read(actor, { operationId: command.operationId, fingerprint });
      const builderState = stateResult(builderRow, true);
      if (!builderState.ok || builderState.state.conversationId !== ids.conversationId) return transient("preparation_unavailable");
      if (builderRow.outcome === "exact_replay") return Object.freeze({ result: builderState, assistance: null });
      if (builderState.state.pendingTurn || builderState.state.revision !== command.expectedRevision) return transient("preparation_unavailable");
      policy = parseExplorerPrivatePolicy(builderRow.policy_state);
      rememberedPolicy = retainKnownPolicy(rememberedPolicy, policy);
      const mode = selectExplorerSafetyRequestMode(policy, fallback);
      if (mode === null || policy.status !== "known" || input.signal?.aborted) return transient("preparation_unavailable");
      const context = await dependencies.buildContext!({ actor, row: builderRow, state: builderState.state, command, ids, readiness, mode, signal: input.signal });
      const request = parseExplorerSafetyReplyRequest(context.request);
      const authority = builderRow.authority_context;
      if (!pinnedPolicyText(request.authorizedContext, readiness.configuration) || request.invocationId !== ids.invocationId || request.sessionId !== ids.conversationId || request.contextSnapshotId !== ids.snapshotId ||
        authority === null || typeof authority !== "object" || Array.isArray(authority) || request.explorerId !== (authority as Record<string, unknown>).explorerId ||
        request.mode !== mode || request.classificationPolicyVersion !== readiness.modelPolicyVersion || request.fallbackPolicyVersion !== fallback.policyVersion ||
        request.instructionVersion !== readiness.configuration.instructionVersion || !/^AV3:[0-9A-F]{64}$/.test(context.evidence.p_authorization_version) ||
        context.evidence.p_prompt_version !== readiness.configuration.promptVersion || context.evidence.p_instruction_version !== readiness.configuration.instructionVersion ||
        context.evidence.p_policy_version !== readiness.configuration.globalPolicy.version || context.evidence.p_behavior_version !== readiness.configuration.roleBehavior.version ||
        context.evidence.p_crisis_version !== readiness.configuration.crisisBehavior.version || context.evidence.p_role_version !== readiness.configuration.roleVersion ||
        input.signal?.aborted) return transient("preparation_unavailable");
      const prepared = await dependencies.repository.prepare({ ...context.evidence, ...observationParameters, ...methodology,
        p_message_id: ids.messageId, p_snapshot_id: ids.snapshotId, p_invocation_id: ids.invocationId, p_body: command.body,
        p_context_serialization: request.authorizedContext, p_context_fingerprint_sha256: request.contextFingerprint, p_request_mode: mode,
        p_trusted_response_version: readiness.configuration.trustedResponses.version, p_resource_policy_version: readiness.resourcePolicyVersion,
        p_expected_safety_version: policy.safetyVersion, p_model_name: readiness.modelName });
      if (prepared.outcome === "exact_replay") return Object.freeze({ result: stateResult(prepared, true), assistance: null });
      if (prepared.outcome !== "ok" || prepared.dispatch_permitted !== true) return transient("preparation_unavailable");
      const currentPolicy = parseExplorerPrivatePolicy(prepared.policy_state);
      const preparedState = stateResult(prepared, true);
      const dispatchAdmitted = currentPolicy.status === "known" && selectExplorerSafetyRequestMode(currentPolicy, fallback) === mode &&
        preparedState.ok && preparedState.state.conversationId === ids.conversationId && preparedState.state.pendingTurn;
      if (currentPolicy.status === "known") policy = currentPolicy;
      rememberedPolicy = retainKnownPolicy(rememberedPolicy, policy);
      // Dispatch observation and terminal persistence have separate try blocks:
      // an uncertain settlement can never trigger a contradictory second post.
      let observedModel = null as Awaited<ReturnType<typeof invokeExplorerSafetyReply>> | null;
      try { if (dispatchAdmitted) observedModel = await invokeExplorerSafetyReply({ request, transport: dependencies.provider!, timeoutMilliseconds: 60_000, signal: input.signal }); }
      catch { /* Exact prepared operation will receive one failed terminal intent. */ }
      const model = observedModel?.observation?.classification ?? null;
      knownModel = model;
      const candidate = observedModel?.observation?.candidate ?? { kind: "unusable" as const };
      const safety = combineExplorerSafety({ policy, fallback, model });
      const deliveryInterested = observedModel?.deliveryInterested !== false && !input.signal?.aborted;
      const plan = selectExplorerSafetyReply({ safety, candidate, trusted: readiness.configuration.trustedResponses, persistence: "pending" });
      let replyKind: ExplorerPrivateReplyKind = "none"; let replyBody: string | null = null; let renderFailed = false;
      if (model !== null && deliveryInterested) {
        if (plan.kind === "ordinary") { replyKind = "ordinary"; replyBody = plan.ordinaryCandidate; }
        else if (["urgent", "crisis", "restricted_followup", "adult_only"].includes(plan.kind)) {
          try {
            const rendered = await ownedCapability((signal) => render(plan, readiness, signal), 2000);
            const expected = plan.kind === "restricted_followup" ? "restricted" : plan.kind;
            if (rendered.kind !== expected || !bodyValid(rendered.body) || rendered.trustedResponseVersion !== readiness.configuration.trustedResponses.version ||
              rendered.resourcePolicyVersion !== readiness.resourcePolicyVersion) throw new Error("private_renderer_unavailable");
            replyKind = rendered.kind; replyBody = rendered.body;
          } catch { renderFailed = true; }
        }
      }
      // Rendering may await caller cancellation after the earlier admission check.
      // Freeze current delivery interest once before the single terminal intent.
      const terminalDeliveryInterested = deliveryInterested && !input.signal?.aborted;
      if (!terminalDeliveryInterested) { replyKind = "none"; replyBody = null; }
      const settlement: ExplorerPrivateSettleParameters = { ...base(actor), p_conversation_id: ids.conversationId,
        p_operation_id: command.operationId, p_status: model !== null ? "completed" : terminalDeliveryInterested ? "failed" : "canceled",
        p_reply_message_id: replyKind === "none" ? null : ids.replyId, p_reply_kind: replyKind, p_reply_body: replyBody,
        p_model_level: model?.level ?? null, p_model_minor_indicated: model?.minorIndicated ?? null,
        p_protocol_version: EXPLORER_SAFETY_REPLY_PROTOCOL, p_request_mode: mode, p_configuration_fingerprint: readiness.configurationFingerprint,
        p_fallback_policy_version: fallback.policyVersion, p_model_policy_version: readiness.modelPolicyVersion,
        p_trusted_response_version: readiness.configuration.trustedResponses.version, p_resource_policy_version: readiness.resourcePolicyVersion,
        p_fallback_level: fallback.classification.level, p_fallback_minor_indicated: fallback.classification.minorIndicated,
        p_delivery_interested: terminalDeliveryInterested };
      let settled: ExplorerPrivateRpcRow;
      try { settled = await dependencies.repository.settle(settlement); }
      catch { policy = safety.policyKnown ? { status: "known", restrictedLevel: safety.restrictedLevel, adultReflectionStopped: safety.adultReflectionStopped,
        safetyVersion: policy.status === "known" ? policy.safetyVersion : 0 } : policy; return transient("settlement_unconfirmed", "unconfirmed"); }
      if (!["ok", "exact_replay", "withheld"].includes(settled.outcome)) return transient("settlement_unconfirmed", "unconfirmed");
      policy = parseExplorerPrivatePolicy(settled.policy_state);
      rememberedPolicy = retainKnownPolicy(rememberedPolicy, policy);
      if (!deliveryInterested || input.signal?.aborted) return failed();
      const completed = stateResult(settled, true);
      if (settled.saved_reply === true && completed.ok) return Object.freeze({ result: completed, assistance: null });
      return transient(renderFailed ? "trusted_render_unavailable" : "preparation_unavailable");
    } catch { return transient("preparation_unavailable"); }
  } catch { return failed(); }
}
