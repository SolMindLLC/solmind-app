import "server-only";
import {
  AUTHORIZED_VIRTUAL_GUIDE_CONTEXT_CONTRACT_VERSION,
  composeAuthorizedVirtualGuideContext,
} from "./authorizedVirtualGuideContext";
import type { ExplorerConversationDependencies } from "./explorerConversationComposition";
import { EXPLORER_ONBOARDING_CONTINUITY_FIELDS } from "../context/explorerSafeContext";
import { SOLMIND_EXPLORER_STRUCTURED_FORM_FIELDS } from "../onboarding";

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
function authority(value: unknown): Authority {
  const ids = ["accountId", "explorerId", "relationshipId", "guideId", "practiceId", "organizationId", "applicationSessionId"];
  if (!record(value) || !exact(value, [...ids, "applicationSessionExpiresAt", "relationshipStatus", "onboardingStatus",
    "adultAffirmation", "authorizationVersion", "onboarding", "requiredConsentDocumentIds"]) ||
    !ids.every((key) => typeof value[key] === "string" && UUID.test(value[key] as string)) ||
    !["active", "paused"].includes(value.relationshipStatus as string) || value.onboardingStatus !== "active" ||
    value.adultAffirmation !== true || typeof value.authorizationVersion !== "string" ||
    !/^AV2:[A-F0-9]{64}$/.test(value.authorizationVersion) ||
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

export function createExplorerConversationContextBuilder(input: {
  repository: ExplorerConversationDependencies["repository"];
  configuration: ExplorerConversationContextConfiguration;
}): NonNullable<ExplorerConversationDependencies["buildContext"]> {
  const config = configuration(input.configuration);
  return async ({ actor, row, state, command, ids, signal }) => {
    const facts = authority(row.authority_context);
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
              JSON.stringify(authority(current.authority_context)) !== JSON.stringify(facts) ||
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
