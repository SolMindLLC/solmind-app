import "server-only";
import {
  AUTHORIZED_VIRTUAL_GUIDE_CONTEXT_CONTRACT_VERSION,
  composeAuthorizedVirtualGuideContext,
} from "./authorizedVirtualGuideContext";
import type { ExplorerConversationDependencies } from "./explorerConversationComposition";
import { EXPLORER_ONBOARDING_CONTINUITY_FIELDS } from "../context/explorerSafeContext";
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
  if (!record(value) || !exact(value, [...ids, "applicationSessionExpiresAt", "relationshipStatus", "onboardingStatus",
    "adultAffirmation", "authorizationVersion", "onboarding", "requiredConsentDocumentIds"]) ||
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

type ConversationContextBuilderInput = {
  repository: Pick<ExplorerConversationDependencies["repository"], "read">;
  configuration: ExplorerConversationContextConfiguration;
};
function createConversationContextBuilder(input: ConversationContextBuilderInput,
  authorizationContract: "AV2" | "AV3",
): NonNullable<ExplorerConversationDependencies["buildContext"]> {
  const config = configuration(input.configuration);
  return async ({ actor, row, state, command, ids, signal }) => {
    const facts = authority(row.authority_context, authorizationContract);
    if (signal?.aborted || facts.accountId !== actor.accountId || facts.applicationSessionId !== actor.applicationSessionId) invalid();
    const binding = { explorerId: facts.explorerId, sessionId: ids.conversationId, continuityBindingId: facts.relationshipId };
    // These are the existing submitted continuity fields, in banked form order.
    // Blank optional answers carry no context. Required blanks remain candidates
    // so the assembler rejects them; neither text nor per-answer IDs are invented.
    const selectedFields = FIELDS.filter(field => REQUIRED_FIELDS.has(field) || facts.onboarding.answers[field].trim().length > 0);
    const recent = state.messages.slice(-24);
    const contextInput = {
      contractVersion: EXPLORER_CONVERSATION_CONTEXT_SELECTION_VERSION, aiRole: "solmind_virtual_guide", actorRoleContext: "explorer",
      explorerBinding: binding,
      globalPolicy: config.globalPolicy, roleBehavior: config.roleBehavior,
      crisisBehavior: config.crisisBehavior, methodologyContext: config.methodologyContext,
      sessionContext: { sessionType: "explorer_virtual_guide", ...binding, explorerDisplayName: null,
        activeFocusItems: [], nextAppointment: null, explorerSafeGuardrail: null },
      continuityCandidates: selectedFields.map((field, order) => ({ kind: "onboarding_answer",
        sourceId: facts.onboarding.responseId, order, ...binding, field, content: facts.onboarding.answers[field] })),
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
    const sourceIds = [...new Set([ids.messageId, facts.onboarding.responseId,
      config.methodologyContextPackVersionId, ...recent.map((message) => message.id)])].sort();
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
): NonNullable<ExplorerConversationDependencies["buildContext"]> {
  const config = governedConfiguration(input.configuration);
  const expectedScope = parseEffectiveMethodologyScope(input.expectedScope);
  const packId = input.packId;
  if (typeof packId !== "string" || !UUID.test(packId)) invalid();
  return async (turn) => {
    try {
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
): NonNullable<ExplorerConversationDependencies["buildContext"]> {
  return createConversationContextBuilder(input, "AV2");
}
export function createGovernedExplorerConversationContextBuilder(
  input: GovernedConversationContextBuilderInput,
): NonNullable<ExplorerConversationDependencies["buildContext"]> {
  return createGovernedConversationContextBuilder(input, "AV2");
}
export function createPrivateExplorerConversationContextBuilder(
  input: ConversationContextBuilderInput,
): NonNullable<ExplorerConversationDependencies["buildContext"]> {
  return createConversationContextBuilder(input, "AV3");
}
export function createPrivateGovernedExplorerConversationContextBuilder(
  input: GovernedConversationContextBuilderInput,
): NonNullable<ExplorerConversationDependencies["buildContext"]> {
  return createGovernedConversationContextBuilder(input, "AV3");
}
