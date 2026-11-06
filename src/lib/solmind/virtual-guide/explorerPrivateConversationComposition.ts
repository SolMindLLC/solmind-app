import "server-only";
import { createHash } from "node:crypto";
import { types } from "node:util";
import { parseOpenAiModelName } from "./openAiModelConfiguration";
import { EXPLORER_COMPASS_CONTEXT_CONTRACT_VERSION } from "../context/explorerSafeContext";
import {
  EXPLORER_CONVERSATION_VERSION, EXPLORER_CONVERSATION_LIMITS,
  parseExplorerConversationCommand, parseExplorerConversationResult, isExplorerConversationId,
  type ExplorerConversationCommand, type ExplorerConversationResult, type ExplorerConversationState, type ExplorerCompassArrangementItem, type ExplorerWaypointClarificationAnswer,
  type ExplorerCompassSuggestionResponse, type ExplorerCompassSuggestionReplies,
} from "../explorerConversationContract";
import { parseExplorerConversationReviewResult } from "../explorerConversationReviewContract";
import { explorerConversationCommandFingerprint, type ExplorerConversationActor, type ExplorerConversationTurnIds, type PrivateExplorerConversationContextBuilder } from "./explorerConversationComposition";
import { parseExplorerPrivateConfigurationCandidate, type ExplorerPrivateConfigurationCandidate } from "./explorerPrivateConfiguration";
import {
  EXPLORER_SAFETY_REQUEST_VERSION, EXPLORER_SAFETY_REPLY_PROTOCOL, explorerSafetyUnicodeValid, parseExplorerSafetyReplyRequest,
  type ExplorerSafetyReplyRequest, type ExplorerSafetyClassification, type ExplorerSafetyCompassSuggestion, type ExplorerSafetyCompassResponse,
  type ExplorerSafetyWaypointSuggestion,
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
  p_fallback_level: number; p_fallback_minor_indicated: boolean; p_delivery_interested: boolean;
  p_attention_item_id: string | null; p_choices: readonly Readonly<{ label: string }>[] | null;
  p_compass_suggestions: readonly ExplorerSafetyCompassSuggestion[] | null;
  p_compass_responses: readonly ExplorerSafetyCompassResponse[] | null;
  p_waypoint_suggestion: ExplorerSafetyWaypointSuggestion | null }>;
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
export type ExplorerPrivateCompassSuggestionParameters = ActorParameters & Readonly<{
  p_conversation_id: string; p_operation_id: string; p_expected_revision: number; p_command_fingerprint: string;
  p_item_id: string; p_response: ExplorerCompassSuggestionResponse }>;
export type ExplorerPrivateWaypointDraftParameters = ActorParameters & Readonly<{
  p_conversation_id: string; p_operation_id: string; p_expected_revision: number; p_command_fingerprint: string;
  p_draft_id: string; p_response: ExplorerCompassSuggestionResponse }>;
export type ExplorerPrivateWaypointRevisionParameters = ActorParameters & Readonly<{
  p_conversation_id: string; p_operation_id: string; p_expected_revision: number; p_command_fingerprint: string;
  p_kind: "revise_waypoint" | "revisit_waypoint"; p_waypoint_id: string; p_answers: readonly ExplorerWaypointClarificationAnswer[] }>;
export type ExplorerPrivateReleaseParameters = ActorParameters & Readonly<{
  p_conversation_id: string; p_operation_id: string; p_expected_revision: number; p_command_fingerprint: string;
  p_waypoint_id: string }>;
export type ExplorerPrivateEndParameters = ActorParameters & Readonly<{
  p_conversation_id: string; p_operation_id: string; p_expected_revision: number; p_command_fingerprint: string }>;
export type ExplorerPrivateReviewParameters = ActorParameters & Readonly<{ p_conversation_id: string | null }>;
export type ExplorerPrivateConversationReviewResult = NonNullable<ReturnType<typeof parseExplorerConversationReviewResult>>;
export type ExplorerPrivateRpcRow = Readonly<{ outcome: string; ended_conversations?: unknown; conversation_state?: unknown; authority_context?: unknown;
  policy_state?: unknown; dispatch_permitted?: boolean; saved_reply?: boolean }>;
export type ExplorerPrivateReadRow = ExplorerPrivateRpcRow & Readonly<{ conversation_state: unknown }>;
export type ExplorerPrivatePauseNoticeKind = "individual" | "shared" | "individual_and_shared";
// crisis and adults_only are private facts for the Explorer's own screen: never log them or pass them to signals.
export type ExplorerPrivatePauseRow = Readonly<{ outcome: string; notice_kind?: ExplorerPrivatePauseNoticeKind | null; crisis?: boolean; adults_only?: boolean }>;
// What the reviewed renderer needs to write a pause notice: the pause, the trusted crisis parts to lead with
// (decision queue 2026-11-01 00:39:51 and 13:26:32), the adults-only part, and whether a typed message was refused.
export type ExplorerPrivatePauseNotice = Readonly<{ kind: ExplorerPrivatePauseNoticeKind; crisis: "crisis" | "urgent" | null;
  adultsOnly: boolean; refused: boolean }>;
export type ExplorerPrivateConversationRepository = Readonly<{
  read: (actor: ExplorerConversationActor, operation?: Readonly<{ operationId: string; fingerprint: string }>) => Promise<ExplorerPrivateReadRow>;
  ensure: (parameters: ExplorerPrivateEnsureParameters) => Promise<ExplorerPrivateRpcRow>;
  observe: (parameters: ExplorerPrivateObserveParameters) => Promise<ExplorerPrivateRpcRow>;
  prepare: (parameters: ExplorerPrivatePrepareParameters) => Promise<ExplorerPrivateRpcRow>;
  settle: (parameters: ExplorerPrivateSettleParameters) => Promise<ExplorerPrivateRpcRow>;
  pause: (actor: ExplorerConversationActor) => Promise<ExplorerPrivatePauseRow>;
  mutate?: (parameters: ExplorerPrivateMutateParameters) => Promise<ExplorerPrivateRpcRow>;
  arrange?: (parameters: ExplorerPrivateArrangeParameters) => Promise<ExplorerPrivateRpcRow>;
  category?: (parameters: ExplorerPrivateCategoryParameters) => Promise<ExplorerPrivateRpcRow>;
  respondCompassSuggestion?: (parameters: ExplorerPrivateCompassSuggestionParameters) => Promise<ExplorerPrivateRpcRow>;
  respondWaypointDraft?: (parameters: ExplorerPrivateWaypointDraftParameters) => Promise<ExplorerPrivateRpcRow>;
  waypointRevision?: (parameters: ExplorerPrivateWaypointRevisionParameters) => Promise<ExplorerPrivateRpcRow>;
  release?: (parameters: ExplorerPrivateReleaseParameters) => Promise<ExplorerPrivateRpcRow>;
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
      trustedResponseVersion: string; resourcePolicyVersion: string }>>;
    pauseNotice: (notice: ExplorerPrivatePauseNotice, readiness: ExplorerPrivateOperationalReadiness) => string }>;
  operationalSignal?: Readonly<{ verificationReceiptSha256: string;
    emit: (marker: ExplorerPrivateSignalMarker, signal: AbortSignal) => Promise<void> }>;
  // Optional synchronous check made where a Send would otherwise report the Virtual Guide available
  // after the readiness check (a saved reply, a later exact replay, or a Send refused because sending
  // is paused, checked after that refusal's fresh read): is there room for another
  // Send now? Anything but true reports it unavailable. It can only turn "available" into
  // "unavailable", never the reverse; when absent, the earlier "available" result is unchanged.
  sendCapacityAvailable?: () => boolean;
}>;
// Only an explicit AV3 governed builder can satisfy this adapter. It reuses
// exact assembled context BYTES; it never invokes the old prose-first runtime.
export function adaptPrivateGovernedExplorerContextBuilder(
  builder: PrivateExplorerConversationContextBuilder,
): NonNullable<ExplorerPrivateConversationDependencies["buildContext"]> {
  return async (input) => {
    const built = await builder({ actor: input.actor,
      row: { ...input.row, conversation_state: input.row.conversation_state }, state: input.state,
      command: input.command, ids: input.ids, mode: input.mode, ...(input.signal === undefined ? {} : { signal: input.signal }) });
    const evidence = built.evidence;
    if (built.request.contractVersion !== "virtual-guide-conversation.v1" ||
      !pinnedPolicyText(built.request.authorizedContext, input.readiness.configuration, input.mode) ||
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
// The selected mode fixes both the revision and section presence before prepare.
// Classification-only input is assembled without Compass data, never stripped here.
function pinnedPolicyText(serialization: string, configuration: ExplorerPrivateConfigurationCandidate,
  mode: ExplorerSafetyReplyRequest["mode"]): boolean {
  try {
    const envelope: unknown = JSON.parse(serialization);
    if (envelope === null || typeof envelope !== "object" || Array.isArray(envelope)) return false;
    const context = envelope as Record<string, unknown>;
    if (mode === "classification_only") {
      if (context.contractVersion !== "wi007-v0.1+onboarding-fields-v2" || Object.hasOwn(context, "compassContext")) return false;
    } else if (mode === "classification_and_reply") {
      if (context.contractVersion !== EXPLORER_COMPASS_CONTEXT_CONTRACT_VERSION ||
        !Object.hasOwn(context, "compassContext") || context.compassContext === null ||
        typeof context.compassContext !== "object" || Array.isArray(context.compassContext)) return false;
    } else return false;
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
function stateResult(row: ExplorerPrivateRpcRow, available = false, fallbackPolicy?: unknown): ExplorerConversationResult {
  if (row.outcome === "denied") return failed("denied").result;
  if (["stale_revision", "stale_policy", "operation_conflict"].includes(row.outcome)) return failed("refresh_required").result;
  if (!["ok", "exact_replay"].includes(row.outcome)) return failed().result;
  const parsed = parseExplorerConversationResult({ ok: true, state: row.conversation_state, error: null });
  const policy = parseExplorerPrivatePolicy(Object.hasOwn(row, "policy_state") ? row.policy_state : fallbackPolicy);
  const compassSuggestionReplies: ExplorerCompassSuggestionReplies = policy.status !== "known" ? "unavailable"
    : policy.restrictedLevel !== null ? "support" : policy.adultReflectionStopped ? "adult_policy" : "available";
  return parsed?.ok ? Object.freeze({ ok: true, error: null, state: Object.freeze({ ...parsed.state,
    providerState: available ? "available" : "unavailable", compassSuggestionReplies }) }) : failed().result;
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
    typeof dependencies.renderer.render !== "function" || typeof dependencies.renderer.pauseNotice !== "function" ||
    typeof dependencies.operationalSignal.emit !== "function" ||
    !Object.values(dependencies.renderer.failureAssistance).every(bodyValid) ||
    Object.keys(dependencies.renderer.failureAssistance).sort().join("|") !== "adultPolicy|support|supportAndAdultPolicy|temporarilyUnavailable") return null;
  return Object.freeze({ ...value, configuration, modelName, methodology: Object.freeze({ ...value.methodology }) });
}
async function freshState(dependencies: ExplorerPrivateConversationDependencies, actor: ExplorerConversationActor): Promise<ExplorerConversationResult> {
  return (await freshRead(dependencies, actor)).result;
}
// A fresh authenticated read that also keeps its row, for a caller that needs the row's server-only policy or an
// exact replay of the same operation. The row is null whenever the result is not a successful read.
async function freshRead(dependencies: ExplorerPrivateConversationDependencies, actor: ExplorerConversationActor,
  operation?: Readonly<{ operationId: string; fingerprint: string }>): Promise<Readonly<{ result: ExplorerConversationResult; row: ExplorerPrivateReadRow | null }>> {
  try {
    const freshActor = await dependencies.authenticate();
    if (!actorValid(freshActor) || freshActor.accountId !== actor.accountId || freshActor.applicationSessionId !== actor.applicationSessionId) {
      return Object.freeze({ result: failed("denied").result, row: null });
    }
    const row = await dependencies.repository.read(freshActor, operation);
    const result = stateResult(row);
    return Object.freeze({ result, row: result.ok ? row : null });
  } catch { return Object.freeze({ result: failed().result, row: null }); }
}
type FailureAssistance = NonNullable<ExplorerPrivateConversationDependencies["renderer"]>["failureAssistance"];
// Static temporary assistance for a refused or failed Send: support when the safety facts are critical.
function failureAssistanceFor(safety: ReturnType<typeof combineExplorerSafety>, messages: FailureAssistance): ExplorerPrivateAssistance {
  const critical = safety.restrictedLevel !== null || safety.adultReflectionStopped;
  const body = safety.adultReflectionStopped ? (safety.restrictedLevel !== null ? messages.supportAndAdultPolicy : messages.adultPolicy)
    : critical ? messages.support : messages.temporarilyUnavailable;
  return Object.freeze({
    kind: critical ? safety.adultReflectionStopped && safety.restrictedLevel === null ? "adult_policy" : "support" : "temporarily_unavailable",
    body, persisted: false });
}
// The pause notice for the Explorer's own screen, or null when there is no pause or the renderer cannot write it.
// Its safety facts come from the returned conversation's own policy (the final fresh read), falling back to the
// pause read's flags only when that policy is unknown, plus this refused message's phrase check. Crisis or urgent
// handling, or level 3 or 4, chooses the trusted parts (existing reply mapping: level 4 the crisis parts, level 3
// the urgent parts). Adults-only where the Explorer may be under 18 (decision queue 2026-11-01 01:07:27).
// When the final read's policy is unknown, the facts are the policy known before it (earlier) together with the pause
// read's flags. The pause read returns no conversation reference, so both are kept even if the conversation may have
// changed between the reads: that errs toward the supportive wording.
function pauseAssistance(dependencies: ExplorerPrivateConversationDependencies, readiness: ExplorerPrivateOperationalReadiness,
  row: ExplorerPrivatePauseRow, policy: ExplorerConversationPolicy, earlier: ExplorerConversationPolicy,
  observation: ExplorerFallbackObservation | null, refused: boolean): ExplorerPrivateAssistance | null {
  try {
    if (row.notice_kind === null || row.notice_kind === undefined || !dependencies.renderer) return null;
    const before = earlier.status === "known" ? { level: earlier.restrictedLevel ?? 0, adultsOnly: earlier.adultReflectionStopped }
      : { level: 0, adultsOnly: false };
    const stored = policy.status === "known" ? { level: policy.restrictedLevel ?? 0, adultsOnly: policy.adultReflectionStopped }
      : { level: Math.max(before.level, row.crisis === true ? 3 : 0), adultsOnly: before.adultsOnly || row.adults_only === true };
    const message = observation?.status === "available" ? observation.classification : null;
    const level = Math.max(stored.level, message !== null && message.level >= 3 ? message.level : 0);
    const adultsOnly = stored.adultsOnly || message?.minorIndicated === true;
    const body = dependencies.renderer.pauseNotice(Object.freeze({ kind: row.notice_kind,
      crisis: level >= 4 ? "crisis" : level >= 3 ? "urgent" : null, adultsOnly, refused }), readiness);
    return bodyValid(body) ? Object.freeze({ kind: "paused", body, persisted: false }) : null;
  } catch { return null; }
}
export async function readExplorerPrivateConversation(dependencies: ExplorerPrivateConversationDependencies): Promise<ExplorerPrivateConversationResult> {
  try { const actor = await dependencies.authenticate(); if (!actorValid(actor)) return failed("denied");
    const row = await dependencies.repository.read(actor);
    const state = stateResult(row);
    if (!state.ok) return Object.freeze({ result: state, assistance: null });
    if (dependencies.resolveOperationalReadiness === undefined) return Object.freeze({ result: state, assistance: null });
    // A GET never ensures an anchor or writes evidence. Readiness is a fresh
    // server capability, not a browser flag or the inert candidate getter.
    let readiness: ExplorerPrivateOperationalReadiness | null = null;
    try { readiness = verifiedReadiness(await dependencies.resolveOperationalReadiness(actor, row), dependencies); }
    catch { /* Saved history remains readable while operational inputs are held. */ }
    const available = readiness !== null;
    // The hard-stop pause, read before the fresh read below so that read stays the last wait.
    let pause: ExplorerPrivatePauseRow | null = null;
    if (readiness !== null) {
      try {
        const read = await dependencies.repository.pause(actor);
        if (read.outcome === "denied") return failed("denied");
        if (read.outcome === "ok") pause = read;
      } catch { /* Saved history remains readable without the notice; a Send checks the pause again. */ }
    }
    // Readiness may await external governance/storage. Never release the old
    // private projection after that wait without fresh identity and authority.
    const fresh = await freshRead(dependencies, actor);
    const current = fresh.result;
    // Written after the final read, from the returned conversation's own policy, so the notice cannot contradict it.
    const notice = readiness !== null && pause !== null && fresh.row !== null
      ? pauseAssistance(dependencies, readiness, pause, parseExplorerPrivatePolicy(fresh.row.policy_state),
        parseExplorerPrivatePolicy(row.policy_state), null, false) : null;
    return Object.freeze({ result: current.ok ? Object.freeze({ ...current,
      state: Object.freeze({ ...current.state, providerState: available ? "available" : "unavailable" }) }) : current,
      assistance: current.ok ? notice : null });
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
    if (command.kind === "release_waypoint") {
      // Owned closure introduces no reflection: SQL retains all current private
      // authority, pending/revision checks and safety state, like deliberate End.
      if (!read.state.conversationId || !dependencies.repository.release) return failed("denied");
      const row = await dependencies.repository.release({ ...base(actor), p_conversation_id: read.state.conversationId,
        p_operation_id: command.operationId, p_expected_revision: command.expectedRevision,
        p_command_fingerprint: fingerprint, p_waypoint_id: command.waypointId });
      const released = stateResult(row, false, readRow.policy_state);
      if (!released.ok) return Object.freeze({ result: released, assistance: null });
      const waypoint = released.state.waypoints.find(item => item.id === command.waypointId);
      if (released.state.conversationId !== read.state.conversationId || released.state.sessionStatus !== "active" ||
          waypoint?.release?.operationId !== command.operationId) return failed();
      return Object.freeze({ result: released, assistance: null });
    }
    let policy = parseExplorerPrivatePolicy(readRow.policy_state);
    if (command.kind !== "send") {
      if (!read.state.conversationId || policy.status !== "known" || policy.restrictedLevel !== null || policy.adultReflectionStopped) return failed("denied");
      if (command.kind === "respond_compass_suggestion") {
        if (!dependencies.repository.respondCompassSuggestion) return failed("denied");
        const row = await dependencies.repository.respondCompassSuggestion({ ...base(actor), p_conversation_id: read.state.conversationId,
          p_operation_id: command.operationId, p_expected_revision: command.expectedRevision,
          p_command_fingerprint: fingerprint, p_item_id: command.itemId, p_response: command.response });
        return Object.freeze({ result: stateResult(row, false, readRow.policy_state), assistance: null });
      }
      if (command.kind === "respond_waypoint_draft") {
        if (!dependencies.repository.respondWaypointDraft) return failed("denied");
        const row = await dependencies.repository.respondWaypointDraft({ ...base(actor), p_conversation_id: read.state.conversationId,
          p_operation_id: command.operationId, p_expected_revision: command.expectedRevision,
          p_command_fingerprint: fingerprint, p_draft_id: command.draftId, p_response: command.response });
        return Object.freeze({ result: stateResult(row, false, readRow.policy_state), assistance: null });
      }
      if (command.kind === "revise_waypoint" || command.kind === "revisit_waypoint") {
        if (!dependencies.repository.waypointRevision) return failed("denied");
        const row = await dependencies.repository.waypointRevision({ ...base(actor), p_conversation_id: read.state.conversationId,
          p_operation_id: command.operationId, p_expected_revision: command.expectedRevision,
          p_command_fingerprint: fingerprint, p_kind: command.kind, p_waypoint_id: command.waypointId, p_answers: command.answers });
        const saved = stateResult(row, false, readRow.policy_state);
        if (!saved.ok) return Object.freeze({ result: saved, assistance: null });
        const successor = saved.state.waypoints.find(item => item.id === command.operationId);
        if (saved.state.conversationId !== read.state.conversationId ||
            successor?.lifecycle?.predecessorWaypointId !== command.waypointId ||
            successor.lifecycle.creationReason !== (command.kind === "revise_waypoint" ? "revision" : "revisit")) return failed();
        return Object.freeze({ result: saved, assistance: null });
      }
      if (command.kind === "confirm_compass_arrangement") {
        if (!dependencies.repository.arrange) return failed("denied");
        const row = await dependencies.repository.arrange({ ...base(actor), p_conversation_id: read.state.conversationId,
          p_operation_id: command.operationId, p_expected_revision: command.expectedRevision,
          p_command_fingerprint: fingerprint, p_priority_id: command.priorityId, p_items: command.items });
        return Object.freeze({ result: stateResult(row, false, readRow.policy_state), assistance: null });
      }
      if (command.kind === "confirm_compass_category") {
        if (!dependencies.repository.category) return failed("denied");
        const row = await dependencies.repository.category({ ...base(actor), p_conversation_id: read.state.conversationId,
          p_operation_id: command.operationId, p_expected_revision: command.expectedRevision,
          p_command_fingerprint: fingerprint, p_target_item_id: command.targetItemId,
          p_member_item_ids: command.memberItemIds, p_label: command.label });
        return Object.freeze({ result: stateResult(row, false, readRow.policy_state), assistance: null });
      }
      if (!dependencies.repository.mutate) return failed("denied");
      const row = await dependencies.repository.mutate({ ...base(actor), p_conversation_id: read.state.conversationId,
        p_operation_id: command.operationId, p_expected_revision: command.expectedRevision, p_command_fingerprint: fingerprint,
        p_kind: command.kind, p_source_message_id: "sourceMessageId" in command ? command.sourceMessageId : null,
        p_item_id: "itemId" in command ? command.itemId : null, p_waypoint_id: "waypointId" in command ? command.waypointId : null,
        p_label: "label" in command ? command.label : null, p_destination: "destination" in command ? command.destination : null,
        p_meaning: "meaning" in command ? command.meaning : null, p_arrival_signal: "arrivalSignal" in command ? command.arrivalSignal : null,
        p_evidence: "evidence" in command ? command.evidence : null });
      return Object.freeze({ result: stateResult(row, false, readRow.policy_state), assistance: null });
    }
    if (read.state.messages.length > EXPLORER_CONVERSATION_LIMITS.messages - 2) return failed("refresh_required");
    if (!dependencies.resolveOperationalReadiness) return failed("provider_unavailable");
    const readiness = verifiedReadiness(await dependencies.resolveOperationalReadiness(actor, readRow), dependencies);
    if (!readiness || input.signal?.aborted) return failed("provider_unavailable");
    // Checked wherever this Send would otherwise report available (a saved reply, a later exact
    // replay, or a paused refusal), so the reply to the last allowed Send already reports the Virtual Guide unavailable.
    const capacity = (): boolean => {
      if (dependencies.sendCapacityAvailable === undefined) return true;
      try { return dependencies.sendCapacityAvailable() === true; } catch { return false; }
    };
    const failureAssistance = Object.freeze({ ...dependencies.renderer!.failureAssistance });
    const render = dependencies.renderer!.render;
    const emitSignal = dependencies.operationalSignal!.emit;
    const methodology: MethodologyParameters = { p_methodology_context_pack_id: readiness.methodology.packId,
      p_methodology_context_pack_version_id: readiness.methodology.versionId, p_methodology_content_sha256: readiness.methodology.contentSha256,
      p_methodology_authorization_version: readiness.methodology.authorizationVersion };
    // A refusal because sending is paused: the message's words are never saved and nothing is counted, so the
    // browser keeps the typed message. The value-free marker follows transient(): conversation policy and this
    // message only, never the pause flags. The fresh read carries this operation, so a duplicate of this Send that
    // committed meanwhile is reported as its exact replay, never as "not sent or saved". If that read shows newly
    // critical facts, the marker is sent then and the read is repeated, so a fresh read is always the last wait
    // before the projection. Availability is checked after the last read; Send stays usable while paused.
    // Accepted: in the duplicate race a critical duplicate can raise the marker for an operation then returned as
    // its replay, because the marker comes before the final read.
    const ready = readiness;
    const sendOperation = Object.freeze({ operationId: command.operationId, fingerprint });
    async function pausedResult(row: ExplorerPrivatePauseRow, known: ExplorerConversationPolicy,
      observation: ExplorerFallbackObservation): Promise<ExplorerPrivateConversationResult> {
      const critical = (facts: ReturnType<typeof combineExplorerSafety>) => facts.restrictedLevel !== null || facts.adultReflectionStopped;
      async function mark(): Promise<void> {
        try { await ownedCapability((signal) => emitSignal("preparation_unavailable", signal), 1000); }
        catch { /* The notice is not suppressed by signal failure or a hung signal port. */ }
      }
      // Every policy fact a read has shown is kept (retained policy), so a later read that fails or has an unknown
      // policy cannot lose it. The pause flags never enter these facts; they only help write the notice.
      let retained = known;
      const safetyNow = () => combineExplorerSafety({ policy: retained, fallback: observation, model: null });
      let signalled = critical(safetyNow());
      if (signalled) await mark();
      let fresh = await freshRead(dependencies, actor, sendOperation);
      if (input.signal?.aborted) return failed();
      if (fresh.row !== null && fresh.row.outcome !== "exact_replay") {
        retained = retainKnownPolicy(retained, parseExplorerPrivatePolicy(fresh.row.policy_state));
        if (!signalled && critical(safetyNow())) {
          signalled = true;
          await mark();
          fresh = await freshRead(dependencies, actor, sendOperation);
          if (input.signal?.aborted) return failed();
          if (fresh.row !== null && fresh.row.outcome !== "exact_replay") {
            retained = retainKnownPolicy(retained, parseExplorerPrivatePolicy(fresh.row.policy_state));
          }
        }
      }
      // A lost or failed fresh read keeps the static assistance, as transient() does.
      if (fresh.row === null) return Object.freeze({ result: fresh.result, assistance: failureAssistanceFor(safetyNow(), failureAssistance) });
      const current = stateResult(fresh.row, capacity());
      if (fresh.row.outcome === "exact_replay") return Object.freeze({ result: current, assistance: null });
      // The notice follows the last read's own known policy; when it is unknown, the retained policy together with the
      // pause flags. If the renderer cannot write it, the static assistance uses the retained policy facts and the
      // phrase check (never the pause flags).
      const notice = pauseAssistance(dependencies, ready, row, parseExplorerPrivatePolicy(fresh.row.policy_state), retained, observation, true);
      return Object.freeze({ result: current, assistance: notice ?? failureAssistanceFor(safetyNow(), failureAssistance) });
    }
    // The phrase check runs before the pause is read: a crisis or urgent message (level 3 or 4) can unlock a
    // first-stop pause (decision queue 2026-11-01 13:24:41), and it chooses the supportive crisis wording of a
    // refusal (13:26:32). The pause read cannot tell a first stop from a second, so for an individual-only
    // pause such a message goes on to observe, which decides; every other reported pause is refused before
    // ensure, so that refusal creates no conversation. The read is advisory: if it fails, the Send goes on to
    // ensure, observe and prepare, which enforce the stops, as before the screen step (a first Send can then
    // leave an empty conversation when observe or prepare refuses it).
    const phrase = detectExplorerFallback(command.body, readiness.configuration.fallback);
    let pauseRow: ExplorerPrivatePauseRow | null = null;
    try { pauseRow = await dependencies.repository.pause(actor); } catch { /* observe and prepare still enforce the stops */ }
    if (pauseRow?.outcome === "denied") return failed("denied");
    if (pauseRow?.outcome === "ok" && pauseRow.notice_kind !== null && pauseRow.notice_kind !== undefined &&
        !(pauseRow.notice_kind === "individual" && phrase.status === "available" && phrase.classification.level >= 3)) {
      return await pausedResult(pauseRow, policy, phrase);
    }
    if (input.signal?.aborted) return failed();
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
      // No generated candidate, saved-record claim or private state without a
      // separate fresh authenticated read. Static assistance remains transient.
      void persistence;
      return Object.freeze({ result: current, assistance: failureAssistanceFor(safety, failureAssistance) });
    }
    // Observe or prepare refused the Send as paused: keep the policy it returned, so a failure from here still has
    // the critical facts, then read the pause again for its current kind. A failed re-read rejects into the
    // caller's catch; a denied one, another outcome, or a pause that has already ended gets transient() directly.
    // Either way the Send ends as it did before the screen step: the temporary assistance, its marker when the
    // facts are critical, and transient()'s own fresh read (which reports a lost sign-in as denied).
    async function pausedAfterCheck(policyState: unknown): Promise<ExplorerPrivateConversationResult> {
      policy = parseExplorerPrivatePolicy(policyState);
      rememberedPolicy = retainKnownPolicy(rememberedPolicy, policy);
      const row = await dependencies.repository.pause(actor);
      if (row.outcome !== "ok" || row.notice_kind === null || row.notice_kind === undefined) return await transient("preparation_unavailable");
      return await pausedResult(row, rememberedPolicy, fallback);
    }
    try {
      fallback = phrase;
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
        return replay.outcome === "exact_replay" ? Object.freeze({ result: stateResult(replay, capacity()), assistance: null }) : transient("preparation_unavailable");
      }
      if (observed.outcome === "paused") return await pausedAfterCheck(observed.policy_state);
      if (observed.outcome !== "ok") return transient("preparation_unavailable");
      policy = parseExplorerPrivatePolicy(observed.policy_state);
      rememberedPolicy = retainKnownPolicy(rememberedPolicy, policy);
      // AV3 includes policy/anchor facts. Observe may advance them, so neither
      // a preanchor read nor ensure's authority is reused as current authority.
      const builderRow = await dependencies.repository.read(actor, { operationId: command.operationId, fingerprint });
      const builderState = stateResult(builderRow, true);
      if (!builderState.ok || builderState.state.conversationId !== ids.conversationId) return transient("preparation_unavailable");
      if (builderRow.outcome === "exact_replay") return Object.freeze({ result: stateResult(builderRow, capacity()), assistance: null });
      if (builderState.state.pendingTurn || builderState.state.revision !== command.expectedRevision) return transient("preparation_unavailable");
      policy = parseExplorerPrivatePolicy(builderRow.policy_state);
      rememberedPolicy = retainKnownPolicy(rememberedPolicy, policy);
      const mode = selectExplorerSafetyRequestMode(policy, fallback);
      if (mode === null || policy.status !== "known" || input.signal?.aborted) return transient("preparation_unavailable");
      const context = await dependencies.buildContext!({ actor, row: builderRow, state: builderState.state, command, ids, readiness, mode, signal: input.signal });
      const request = parseExplorerSafetyReplyRequest(context.request);
      const authority = builderRow.authority_context;
      if (!pinnedPolicyText(request.authorizedContext, readiness.configuration, mode) || request.invocationId !== ids.invocationId || request.sessionId !== ids.conversationId || request.contextSnapshotId !== ids.snapshotId ||
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
      if (prepared.outcome === "exact_replay") return Object.freeze({ result: stateResult(prepared, capacity()), assistance: null });
      if (prepared.outcome === "paused") return await pausedAfterCheck(prepared.policy_state);
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
      // Optional proposals are never authority. Settle rechecks saved-head ownership,
      // safety and delivery atomically; a rejected proposal must not lose the reply.
      const ordinaryExtras = replyKind === "ordinary" && terminalDeliveryInterested && mode === "classification_and_reply" &&
        safety.policyKnown && safety.restrictedLevel === null && !safety.adultReflectionStopped;
      const proposedAttention = observedModel?.observation?.compass?.attention;
      const attentionItemId = ordinaryExtras && typeof proposedAttention === "string" &&
        builderState.state.compassItems.some((item) => item.id === proposedAttention && !item.mergedIntoItemId)
        ? proposedAttention : null;
      const choices = ordinaryExtras && safety.currentLevel !== null && safety.currentLevel < 2
        ? observedModel?.observation?.choices ?? null : null;
      const proposedPoints = ordinaryExtras && safety.currentLevel !== null && safety.currentLevel < 2
        ? observedModel?.observation?.compass?.suggestions?.filter((suggestion) => suggestion.pointId === undefined ||
          builderState.state.compassItems.some((item) => item.id === suggestion.pointId &&
            item.formation === "forming" && !item.mergedIntoItemId)) : undefined;
      const previousReply = [...builderState.state.messages].reverse().find((message) => message.role === "virtualGuide");
      const waypointSuggestion = ordinaryExtras && safety.currentLevel !== null && safety.currentLevel < 2
        ? observedModel?.observation?.waypointSuggestion ?? null : null;
      const proposedResponses = ordinaryExtras && safety.currentLevel !== null && safety.currentLevel < 2 && previousReply
        ? observedModel?.observation?.compass?.responses?.filter((response) =>
          builderState.state.compassItems.some((item) => item.id === response.pointId && item.formation === "forming" &&
            !item.mergedIntoItemId && item.wordingMessageId === previousReply.id) &&
          !proposedPoints?.some((suggestion) => suggestion.pointId === response.pointId)) : undefined;
      const settlement: ExplorerPrivateSettleParameters = { ...base(actor), p_conversation_id: ids.conversationId,
        p_operation_id: command.operationId, p_status: model !== null ? "completed" : terminalDeliveryInterested ? "failed" : "canceled",
        p_reply_message_id: replyKind === "none" ? null : ids.replyId, p_reply_kind: replyKind, p_reply_body: replyBody,
        p_model_level: model?.level ?? null, p_model_minor_indicated: model?.minorIndicated ?? null,
        p_protocol_version: EXPLORER_SAFETY_REPLY_PROTOCOL, p_request_mode: mode, p_configuration_fingerprint: readiness.configurationFingerprint,
        p_fallback_policy_version: fallback.policyVersion, p_model_policy_version: readiness.modelPolicyVersion,
        p_trusted_response_version: readiness.configuration.trustedResponses.version, p_resource_policy_version: readiness.resourcePolicyVersion,
        p_fallback_level: fallback.classification.level, p_fallback_minor_indicated: fallback.classification.minorIndicated,
        p_delivery_interested: terminalDeliveryInterested, p_attention_item_id: attentionItemId, p_choices: choices,
        p_compass_suggestions: proposedPoints?.length ? Object.freeze(proposedPoints) : null,
        p_compass_responses: proposedResponses?.length ? Object.freeze(proposedResponses) : null,
        p_waypoint_suggestion: waypointSuggestion };
      let settled: ExplorerPrivateRpcRow;
      try { settled = await dependencies.repository.settle(settlement); }
      catch { policy = safety.policyKnown ? { status: "known", restrictedLevel: safety.restrictedLevel, adultReflectionStopped: safety.adultReflectionStopped,
        safetyVersion: policy.status === "known" ? policy.safetyVersion : 0 } : policy; return transient("settlement_unconfirmed", "unconfirmed"); }
      if (!["ok", "exact_replay", "withheld"].includes(settled.outcome)) return transient("settlement_unconfirmed", "unconfirmed");
      policy = parseExplorerPrivatePolicy(settled.policy_state);
      rememberedPolicy = retainKnownPolicy(rememberedPolicy, policy);
      if (!deliveryInterested || input.signal?.aborted) return failed();
      const completed = stateResult(settled, capacity());
      if (settled.saved_reply === true && completed.ok) return Object.freeze({ result: completed, assistance: null });
      return transient(renderFailed ? "trusted_render_unavailable" : "preparation_unavailable");
    } catch { return transient("preparation_unavailable"); }
  } catch { return failed(); }
}
