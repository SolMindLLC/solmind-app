import "server-only";
import {
  AUTHORIZED_VIRTUAL_GUIDE_CONTEXT_CONTRACT_VERSION,
  composeAuthorizedVirtualGuideContext,
} from "./authorizedVirtualGuideContext";
import type {
  ExplorerConversationContextBuilder, ExplorerConversationDependencies,
  PrivateExplorerConversationContextBuilder,
} from "./explorerConversationComposition";
import {
  EXPLORER_COMPASS_CONTEXT_CONTRACT_VERSION,
  EXPLORER_COMPASS_CONTEXT_ROUTE_KINDS,
  EXPLORER_COMPASS_CONTEXT_VERSION,
  EXPLORER_ONBOARDING_CONTINUITY_FIELDS,
  EXPLORER_SAFE_CONTEXT_LIMITS,
} from "../context/explorerSafeContext";
import { SOLMIND_EXPLORER_STRUCTURED_FORM_FIELDS } from "../onboarding";
import { types } from "node:util";
import {
  effectiveMethodologySignalAborted,
  parseEffectiveMethodologyReadInput,
  parseEffectiveMethodologyScope,
  parseEffectiveMethodologySelection,
  type EffectiveMethodologyScope,
  type EffectiveMethodologySource,
} from "./effectiveMethodologyContext";

// Selection revision is serialized into each new context and fingerprint.
// Historical supportNow-only snapshots keep their original version and bytes.
export const EXPLORER_CONVERSATION_CONTEXT_SELECTION_VERSION = "wi007-v0.1+onboarding-fields-v2";
// Chat step slice S3 (2026-11-03): the private (AV3) entries add the saved Compass and
// Waypoint section for ordinary replies; classification-only turns and AV2 use the base revision.
export const EXPLORER_PRIVATE_CONVERSATION_CONTEXT_SELECTION_VERSION = EXPLORER_COMPASS_CONTEXT_CONTRACT_VERSION;

type VersionedText = Readonly<{ version: string; text: string }>;
// Supplied only by a future explicitly approved server activation. This is not
// evidence that a configured pack exists in a methodology-management database.
export type ExplorerConversationContextConfiguration = Readonly<{
  methodologyContextPackVersionId: string;
  promptVersion: string;
  instructionVersion: string;
  roleVersion: string;
  globalPolicy: VersionedText;
  roleBehavior: VersionedText;
  crisisBehavior: VersionedText;
  methodologyContext: VersionedText;
}>;
export type GovernedExplorerConversationContextConfiguration = Omit<
  ExplorerConversationContextConfiguration,
  "methodologyContextPackVersionId" | "methodologyContext"
>;
type Authority = {
  accountId: string; explorerId: string; relationshipId: string; guideId: string;
  practiceId: string; organizationId: string; applicationSessionId: string;
  applicationSessionExpiresAt: string; relationshipStatus: "active" | "paused";
  onboardingStatus: "active"; adultAffirmation: true; authorizationVersion: string;
  onboarding: { responseId: string; answers: Record<string, string> };
  requiredConsentDocumentIds: string[];
  formingAttentionMove?: { pointId: string | null; revision: number; recordedAt: string };
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FIELDS = EXPLORER_ONBOARDING_CONTINUITY_FIELDS;
const REQUIRED_FIELDS = new Set(SOLMIND_EXPLORER_STRUCTURED_FORM_FIELDS.filter(field => field.required).map(field => field.key));
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function exact(value: Record<string, unknown>, names: readonly string[]): boolean {
  return Object.keys(value).length === names.length && names.every((name) => Object.hasOwn(value, name));
}
function invalid(): never { throw new Error("explorer_conversation_context_unavailable"); }
function authority(value: unknown, expectedContract: "AV2" | "AV3" = "AV2"): Authority {
  const ids = ["accountId", "explorerId", "relationshipId", "guideId", "practiceId", "organizationId", "applicationSessionId"];
  const hasFormingMove = record(value) && Object.hasOwn(value, "formingAttentionMove");
  if (!record(value) || !exact(value, [...ids, "applicationSessionExpiresAt", "relationshipStatus", "onboardingStatus",
    "adultAffirmation", "authorizationVersion", "onboarding", "requiredConsentDocumentIds",
    ...(hasFormingMove ? ["formingAttentionMove"] : [])]) ||
    !ids.every((key) => typeof value[key] === "string" && UUID.test(value[key] as string)) ||
    !["active", "paused"].includes(value.relationshipStatus as string) || value.onboardingStatus !== "active" ||
    value.adultAffirmation !== true || typeof value.authorizationVersion !== "string" ||
    !(expectedContract === "AV2" ? /^AV2:[A-F0-9]{64}$/ : /^AV3:[A-F0-9]{64}$/).test(value.authorizationVersion) ||
    typeof value.applicationSessionExpiresAt !== "string" || !Number.isFinite(Date.parse(value.applicationSessionExpiresAt)) ||
    !record(value.onboarding) || !exact(value.onboarding, ["responseId", "answers"]) ||
    typeof value.onboarding.responseId !== "string" || !UUID.test(value.onboarding.responseId) ||
    !record(value.onboarding.answers) || !exact(value.onboarding.answers, FIELDS) ||
    !FIELDS.every((field) => typeof (value.onboarding as Record<string, unknown>).answers === "object" &&
      typeof ((value.onboarding as Record<string, unknown>).answers as Record<string, unknown>)[field] === "string") ||
    !Array.isArray(value.requiredConsentDocumentIds) || value.requiredConsentDocumentIds.length === 0 ||
    value.requiredConsentDocumentIds.length > 16 || !value.requiredConsentDocumentIds.every((id) => typeof id === "string" && UUID.test(id)) ||
    new Set(value.requiredConsentDocumentIds).size !== value.requiredConsentDocumentIds.length) invalid();
  if (hasFormingMove) {
    const move = value.formingAttentionMove;
    if (expectedContract !== "AV3" || !record(move) || !exact(move, ["pointId", "revision", "recordedAt"]) ||
        !(move.pointId === null || (typeof move.pointId === "string" && UUID.test(move.pointId))) ||
        typeof move.revision !== "number" || !Number.isSafeInteger(move.revision) || move.revision < 1 || move.revision > 2_147_483_647 ||
        typeof move.recordedAt !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(move.recordedAt) ||
        !Number.isFinite(Date.parse(move.recordedAt)) || new Date(move.recordedAt).toISOString().slice(0, 19) !== move.recordedAt.slice(0, 19)) invalid();
  }
  return structuredClone(value) as Authority;
}
function configuration(value: ExplorerConversationContextConfiguration): ExplorerConversationContextConfiguration {
  if (!record(value) || !exact(value, ["methodologyContextPackVersionId", "promptVersion", "instructionVersion", "roleVersion",
    "globalPolicy", "roleBehavior", "crisisBehavior", "methodologyContext"]) || !UUID.test(value.methodologyContextPackVersionId)) invalid();
  for (const label of [value.promptVersion, value.instructionVersion, value.roleVersion]) {
    if (typeof label !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(label)) invalid();
  }
  // The banked S03A assembler owns exact versioned-text limits and Unicode rules.
  for (const part of [value.globalPolicy, value.roleBehavior, value.crisisBehavior, value.methodologyContext]) {
    if (!record(part) || !exact(part, ["version", "text"]) || typeof part.version !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(part.version) || typeof part.text !== "string") invalid();
  }
  return structuredClone(value);
}

type ConversationState = Parameters<NonNullable<ExplorerConversationDependencies["buildContext"]>>[0]["state"];
type RouteEvent = NonNullable<ConversationState["route"]>[number];
type PointRouteEvent = Extract<RouteEvent, { compassItemId: string }>;
const ROUTE_KINDS: readonly string[] = EXPLORER_COMPASS_CONTEXT_ROUTE_KINDS;
function pointRouteEvent(event: RouteEvent): event is PointRouteEvent {
  return ROUTE_KINDS.includes(event.kind) && Object.hasOwn(event, "compassItemId");
}
// State timestamps are validated UTC instants. Keep PostgreSQL's microseconds so
// a move and a reply in the same millisecond are ordered the same on both sides.
function comparableInstant(value: string): string {
  return value.slice(0, 19) + "." + (/\.(\d{1,6})/.exec(value)?.[1] ?? "").padEnd(6, "0");
}
// Chat step slice S3 (Paul's decision 4, decision queue 2026-11-03 12:38:07 CST; go-ahead
// 20:50:45 CST): the saved Compass and Waypoint section, taken from the state the final
// read returned. The safe assembler validates it, and
// supabase/migrations/20261106000000_explorer_waypoint_active_limits.sql rebuilds it from the
// saved rows and compares it exactly before any provider call. Current points only (not
// combined away), in saved display order; the saved Priority and attention (the needle
// may be on an unplaced point); the last five needle moves (attention_changed) on a
// current point, oldest first, each with that point's current label, never the label
// the Route captured, which may be wording from before a rename (Priority changes,
// arrangement and category events and their before-labels are never model context);
// at most twenty current Waypoint heads and the current proposed private Waypoint draft.
function compassContext(state: ConversationState, formingMove: Authority["formingAttentionMove"]) {
  const points = state.compassItems.filter((item) => item.mergedIntoItemId == null);
  const currentLabels = new Map(points.filter((item) => item.formation !== "forming").map((item) => [item.id, item.label]));
  const moves = (state.route ?? []).filter(pointRouteEvent);
  const latestMove = moves.at(-1);
  // State messages retain saved sequence order; timestamps can tie or arrive out of order.
  const previousReplyId = state.messages.findLast(message => message.role === "virtualGuide")?.id;
  const lastReplyAt = state.messages.filter((message) => message.role === "virtualGuide")
    .map((message) => comparableInstant(message.createdAt)).sort().at(-1);
  const formingPoint = formingMove === undefined ? undefined : points.find(point => point.id === formingMove.pointId);
  if (formingMove !== undefined) {
    // A rejected latest move retains only its chronology, preventing an older
    // acknowledgment from resurfacing without exposing the rejected point id.
    if ((formingMove.pointId === null ? state.attentionId !== null || formingMove.revision >= state.revision
      : formingPoint?.formation !== "forming" || state.attentionId !== formingMove.pointId) ||
        formingMove.revision > state.revision || moves.some(event => event.revision >= formingMove.revision) ||
        (lastReplyAt !== undefined && comparableInstant(formingMove.recordedAt) <= lastReplyAt)) invalid();
  }
  // Filtered to current points before the cap, so a combined-away point's move leaves room for an older one.
  const recentRoute = moves.flatMap((event) => {
    const label = currentLabels.get(event.compassItemId);
    const actor = event.actor ?? "explorer";
    // Only the next saved reply may acknowledge the latest Explorer move. A tie
    // is deliberately ineligible, and a newer move on a retired point still wins.
    const awaitingReply = formingMove === undefined && actor === "explorer" && event === latestMove &&
      (lastReplyAt === undefined || comparableInstant(event.recordedAt) > lastReplyAt);
    return label === undefined ? [] : [{ kind: event.kind, pointId: event.compassItemId, label, actor, awaitingReply }];
  });
  // Only the fresh server read can supply this label-free operation projection.
  // The next-reply signal uses current wording without creating a saved Route event.
  if (formingMove !== undefined && formingPoint !== undefined) recentRoute.push({ kind: "attention_changed",
    pointId: formingPoint.id, label: formingPoint.label, actor: "explorer", awaitingReply: true });
  // The partial projection marks current heads authoritatively. Missing successors
  // never establish currentness. Match SQL: active first, newest creation instant
  // first within each group, then UUID ascending, including microsecond ties.
  const heads = state.waypoints.filter((waypoint) => waypoint.isCurrent)
    .sort((left, right) => {
      const leftClosed = left.status === "reached" || left.release !== undefined;
      const rightClosed = right.status === "reached" || right.release !== undefined;
      if (leftClosed !== rightClosed) return leftClosed ? 1 : -1;
      const leftAt = comparableInstant(left.createdAt);
      const rightAt = comparableInstant(right.createdAt);
      if (leftAt !== rightAt) return leftAt > rightAt ? -1 : 1;
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    }).slice(0, EXPLORER_SAFE_CONTEXT_LIMITS.compassWaypointCount);
  return {
    section: {
      version: EXPLORER_COMPASS_CONTEXT_VERSION,
      points: points.map((item, order) => ({ id: item.id, label: item.label, order, formation: item.formation ?? "saved",
        anchor: item.anchor ?? null, emphasis: item.emphasis ?? null,
        ...(item.formation === "forming" ? { suggestedInPreviousReply:
          previousReplyId !== undefined && item.wordingMessageId === previousReplyId } : {}) })),
      priorityId: state.priorityId, attentionId: state.attentionId,
      recentRoute: recentRoute.slice(-EXPLORER_SAFE_CONTEXT_LIMITS.compassRouteEventCount),
      waypoints: heads.map((waypoint) => ({ id: waypoint.id, title: waypoint.title,
        destination: waypoint.destination, meaning: waypoint.meaning, arrivalSignal: waypoint.arrivalSignal,
        stage: waypoint.status === "reached" ? "reached" : waypoint.release === undefined ? "formed" : "released",
        reachedEvidence: waypoint.status === "reached" ? waypoint.reachedEvidence ?? null : null })),
      drafts: state.waypointDraft === null ? [] : [{ id: state.waypointDraft.id, title: state.waypointDraft.title,
        destination: state.waypointDraft.destination, whyItMatters: state.waypointDraft.whyItMatters,
        arrivalSignal: state.waypointDraft.arrivalSignal, suggestedInPreviousReply:
          previousReplyId !== undefined && state.waypointDraft.suggestionMessageId === previousReplyId }],
    },
    sourceIds: [...points.map((item) => item.id), ...heads.map((waypoint) => waypoint.id),
      ...(state.waypointDraft === null ? [] : [state.waypointDraft.id])],
  };
}

type SharedContextBuilder = (turn: Parameters<ExplorerConversationContextBuilder>[0] &
  Partial<Pick<Parameters<PrivateExplorerConversationContextBuilder>[0], "mode">>) => ReturnType<ExplorerConversationContextBuilder>;
function validatePrivateMode(authorizationContract: "AV2" | "AV3", mode: unknown): void {
  if (authorizationContract === "AV3" && mode !== "classification_only" && mode !== "classification_and_reply") invalid();
}

type ConversationContextBuilderInput = {
  repository: Pick<ExplorerConversationDependencies["repository"], "read">;
  configuration: ExplorerConversationContextConfiguration;
};
function createConversationContextBuilder(input: ConversationContextBuilderInput,
  authorizationContract: "AV2" | "AV3",
): SharedContextBuilder {
  const config = configuration(input.configuration);
  return async ({ actor, row, state, command, ids, signal, mode }) => {
    validatePrivateMode(authorizationContract, mode);
    const facts = authority(row.authority_context, authorizationContract);
    if (signal?.aborted || facts.accountId !== actor.accountId || facts.applicationSessionId !== actor.applicationSessionId) invalid();
    const binding = { explorerId: facts.explorerId, sessionId: ids.conversationId, continuityBindingId: facts.relationshipId };
    // These are the existing submitted continuity fields, in banked form order.
    // Blank optional answers carry no context. Required blanks remain candidates
    // so the assembler rejects them; neither text nor per-answer IDs are invented.
    const selectedFields = FIELDS.filter(field => REQUIRED_FIELDS.has(field) || facts.onboarding.answers[field].trim().length > 0);
    const recent = state.messages.slice(-24);
    // Classification-only AV3 omits the section and its sources before assembly and hashing; AV2 is unchanged.
    const compass = authorizationContract === "AV3" && mode === "classification_and_reply"
      ? compassContext(state, facts.formingAttentionMove) : undefined;
    const contextInput = {
      contractVersion: compass === undefined ? EXPLORER_CONVERSATION_CONTEXT_SELECTION_VERSION
        : EXPLORER_PRIVATE_CONVERSATION_CONTEXT_SELECTION_VERSION,
      aiRole: "solmind_virtual_guide", actorRoleContext: "explorer",
      explorerBinding: binding,
      globalPolicy: config.globalPolicy, roleBehavior: config.roleBehavior,
      crisisBehavior: config.crisisBehavior, methodologyContext: config.methodologyContext,
      sessionContext: { sessionType: "explorer_virtual_guide", ...binding, explorerDisplayName: null,
        activeFocusItems: [], nextAppointment: null, explorerSafeGuardrail: null },
      continuityCandidates: selectedFields.map((field, order) => ({ kind: "onboarding_answer",
        sourceId: facts.onboarding.responseId, order, ...binding, field, content: facts.onboarding.answers[field] })),
      ...(compass === undefined ? {} : { compassContext: compass.section }),
      currentSessionMessages: recent.map((message, order) => ({ messageId: message.id, order,
        explorerId: facts.explorerId, sessionId: ids.conversationId,
        role: message.role === "explorer" ? "explorer" : "solmind_virtual_guide", content: message.body })),
      immediateExplorerMessage: { messageId: ids.messageId, explorerId: facts.explorerId,
        sessionId: ids.conversationId, role: "explorer", content: command.body },
      outputRequirements: { format: "plain_text", includeCitations: false, allowMarkdown: false },
    };
    const composed = await composeAuthorizedVirtualGuideContext({
      request: { contractVersion: AUTHORIZED_VIRTUAL_GUIDE_CONTEXT_CONTRACT_VERSION, invocationId: ids.invocationId,
        requestedExplorerId: facts.explorerId, requestedSessionId: ids.conversationId, contextSnapshotId: ids.snapshotId },
      source: {
        loadAuthorizationSnapshot: async () => ({ authorizationVersion: facts.authorizationVersion,
          actor: { accountId: facts.accountId, roleContext: "explorer" },
          explorer: { explorerId: facts.explorerId, accountId: facts.accountId,
            onboardingStatus: facts.onboardingStatus, adultAffirmation: facts.adultAffirmation },
          relationship: { relationshipId: facts.relationshipId, explorerId: facts.explorerId, status: facts.relationshipStatus },
          activeRequiredConsentDocumentIds: facts.requiredConsentDocumentIds,
          acceptedRequiredConsentDocumentIds: facts.requiredConsentDocumentIds, contextInput }),
        revalidateAuthorization: async (proof) => {
          if (signal?.aborted) invalid();
          const current = await input.repository.read(actor);
          if (signal?.aborted || current.outcome !== "ok" ||
              JSON.stringify(authority(current.authority_context, authorizationContract)) !== JSON.stringify(facts) ||
              JSON.stringify(current.conversation_state) !== JSON.stringify(row.conversation_state) ||
              proof.actorAccountId !== facts.accountId || proof.relationshipId !== facts.relationshipId) invalid();
          return { authorizationVersion: facts.authorizationVersion, status: "current" };
        },
      }, signal,
    });
    // Every record the context includes is listed: the current points and Waypoint heads join
    // the private sources (the database rebuilds the same set and refuses cross-kind reuse).
    const sourceIds = [...new Set([ids.messageId, facts.onboarding.responseId,
      config.methodologyContextPackVersionId, ...recent.map((message) => message.id),
      ...(compass === undefined ? [] : compass.sourceIds)])].sort();
    return Object.freeze({ request: composed.conversationRequest, evidence: Object.freeze({
      p_context_source_ids: Object.freeze(sourceIds), p_authorization_version: facts.authorizationVersion,
      p_intake_response_set_id: facts.onboarding.responseId,
      p_methodology_context_pack_version_id: config.methodologyContextPackVersionId,
      p_prompt_version: config.promptVersion, p_policy_version: config.globalPolicy.version,
      p_behavior_version: config.roleBehavior.version, p_crisis_version: config.crisisBehavior.version,
      p_role_version: config.roleVersion, p_instruction_version: config.instructionVersion,
    }) });
  };
}

function governedConfiguration(input: GovernedExplorerConversationContextConfiguration): GovernedExplorerConversationContextConfiguration {
  function copy(value: unknown, keys: readonly string[]): Record<string, unknown> {
    if (value === null || typeof value !== "object" || Array.isArray(value) || types.isProxy(value)) invalid();
    if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid();
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length || ownKeys.some(key => typeof key !== "string" || !keys.includes(key))) invalid();
    const result: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) invalid();
      result[key] = descriptor.value;
    }
    return result;
  }
  try {
    const raw = copy(input, ["promptVersion", "instructionVersion", "roleVersion", "globalPolicy", "roleBehavior", "crisisBehavior"]);
    const label = (value: unknown): string => {
      if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(value)) invalid();
      return value;
    };
    const text = (value: unknown): VersionedText => {
      const part = copy(value, ["version", "text"]);
      if (typeof part.text !== "string") invalid();
      return Object.freeze({ version: label(part.version), text: part.text });
    };
    return Object.freeze({
      promptVersion: label(raw.promptVersion), instructionVersion: label(raw.instructionVersion), roleVersion: label(raw.roleVersion),
      globalPolicy: text(raw.globalPolicy), roleBehavior: text(raw.roleBehavior), crisisBehavior: text(raw.crisisBehavior),
    });
  } catch { return invalid(); }
}

/**
 * Prospective governed builder only. The shipped request factory intentionally
 * supplies neither this builder nor a provider. A real closed SQL source and
 * governed prepare repository are required before separate activation.
 */
type GovernedConversationContextBuilderInput = {
  repository: Pick<ExplorerConversationDependencies["repository"], "read">;
  configuration: GovernedExplorerConversationContextConfiguration;
  packId: string;
  expectedScope: EffectiveMethodologyScope;
  methodologySource: EffectiveMethodologySource;
};
function createGovernedConversationContextBuilder(input: GovernedConversationContextBuilderInput,
  authorizationContract: "AV2" | "AV3",
): SharedContextBuilder {
  const config = governedConfiguration(input.configuration);
  const expectedScope = parseEffectiveMethodologyScope(input.expectedScope);
  const packId = input.packId;
  if (typeof packId !== "string" || !UUID.test(packId)) invalid();
  return async (turn) => {
    try {
      validatePrivateMode(authorizationContract, turn.mode);
      const facts = authority(turn.row.authority_context, authorizationContract);
      if (facts.accountId !== turn.actor.accountId || facts.applicationSessionId !== turn.actor.applicationSessionId ||
          expectedScope.id !== facts.guideId || effectiveMethodologySignalAborted(turn.signal)) invalid();
      const request = parseEffectiveMethodologyReadInput({
        actor: turn.actor, packId, expectedScope, ...(turn.signal === undefined ? {} : { signal: turn.signal }),
      });
      const load = async () => {
        if (effectiveMethodologySignalAborted(turn.signal)) invalid();
        const selection = parseEffectiveMethodologySelection(await input.methodologySource.read(request), { packId, expectedScope });
        if (effectiveMethodologySignalAborted(turn.signal)) invalid();
        return selection;
      };
      // Never pin methodology to a conversation or to builder construction.
      // The old synthetic builder still owns the exact S03A/S03C assembly.
      const selected = await load();
      const build = createConversationContextBuilder({
        repository: input.repository,
        configuration: {
          ...config, methodologyContextPackVersionId: selected.versionId,
          methodologyContext: { version: `methodology:${selected.versionId}`, text: selected.contentMarkdown },
        },
      }, authorizationContract);
      const context = await build(turn);
      // S03C has just reread authority/history. Re-resolve methodology before
      // releasing context; atomic governed SQL preparation closes the remaining
      // cross-transaction race, including a change after this final read.
      const current = await load();
      if (JSON.stringify(current) !== JSON.stringify(selected)) invalid();
      return Object.freeze({ request: context.request, evidence: Object.freeze({
        ...context.evidence,
        p_methodology_context_pack_id: selected.packId,
        p_methodology_content_sha256: selected.contentSha256,
        p_methodology_authorization_version: selected.methodologyAuthorizationVersion,
      }) });
    } catch { return invalid(); }
  };
}

// Explicit entry points keep legacy AV2 meaning unchanged. AV3 means the
// successor owned/support authority plus separately bound current policy;
// accepting it here grants neither readiness nor a provider capability.
export function createExplorerConversationContextBuilder(
  input: ConversationContextBuilderInput,
): ExplorerConversationContextBuilder {
  return createConversationContextBuilder(input, "AV2");
}
export function createGovernedExplorerConversationContextBuilder(
  input: GovernedConversationContextBuilderInput,
): ExplorerConversationContextBuilder {
  return createGovernedConversationContextBuilder(input, "AV2");
}
export function createPrivateExplorerConversationContextBuilder(
  input: ConversationContextBuilderInput,
): PrivateExplorerConversationContextBuilder {
  return createConversationContextBuilder(input, "AV3");
}
export function createPrivateGovernedExplorerConversationContextBuilder(
  input: GovernedConversationContextBuilderInput,
): PrivateExplorerConversationContextBuilder {
  return createGovernedConversationContextBuilder(input, "AV3");
}
