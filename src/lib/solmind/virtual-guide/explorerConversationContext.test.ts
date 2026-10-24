import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  createExplorerConversationContextBuilder,
  type ExplorerConversationContextConfiguration,
} from "./explorerConversationContext";
import type {
  ExplorerConversationDependencies,
  ExplorerConversationRepository,
  ExplorerConversationRpcRow,
} from "./explorerConversationComposition";
import { EXPLORER_CONVERSATION_VERSION, type ExplorerConversationState } from "../explorerConversationContract";
import type { ExplorerSafeContext } from "../context/explorerSafeContext";

const uuid = (number: number) => `00000000-0000-4000-8000-${number.toString(16).padStart(12, "0")}`;
const ids = Object.freeze({ conversationId: uuid(1), messageId: uuid(2), snapshotId: uuid(3), invocationId: uuid(4), replyId: uuid(5), logicalOperationId: uuid(18) });
const actor = Object.freeze({ accountId: uuid(6), applicationSessionId: uuid(7) });
const authorizationVersion = `AV2:${"A".repeat(64)}`;
function configuration(): ExplorerConversationContextConfiguration {
  return {
    methodologyContextPackVersionId: uuid(8), promptVersion: "conversation-prompt-v1",
    instructionVersion: "conversation-instructions-v1", roleVersion: "explorer-role-v1",
    globalPolicy: { version: "global-policy-v1", text: "Synthetic global policy for this pure test." },
    roleBehavior: { version: "virtual-guide-behavior-v1", text: "Support Explorer reflection and choice." },
    crisisBehavior: { version: "crisis-behavior-v1", text: "Use the approved safety boundary." },
    methodologyContext: { version: "methodology-v1", text: "Use the synthetic approved reflection method." },
  };
}
function authority() {
  return {
    accountId: actor.accountId, explorerId: uuid(9), relationshipId: uuid(10),
    guideId: uuid(11), practiceId: uuid(12), organizationId: uuid(13),
    applicationSessionId: actor.applicationSessionId,
    applicationSessionExpiresAt: "2100-01-01T00:00:00.000Z",
    relationshipStatus: "active", onboardingStatus: "active", adultAffirmation: true,
    authorizationVersion, onboarding: {
      responseId: uuid(14), answers: {
        supportNow: "I want to make room for a calmer morning.",
        usefulOutcome: "OMITTED_USEFUL_OUTCOME", supportStyle: "OMITTED_SUPPORT_STYLE",
        guideContext: "OMITTED_GUIDE_CONTEXT", communicationPreference: "OMITTED_COMMUNICATION_PREFERENCE",
        doNotEmphasize: "OMITTED_DO_NOT_EMPHASIZE",
      },
    }, requiredConsentDocumentIds: [uuid(16), uuid(15)],
  };
}
function state(count = 2): ExplorerConversationState {
  return {
    version: EXPLORER_CONVERSATION_VERSION, conversationId: ids.conversationId,
    revision: 7, providerState: "available", pendingTurn: false, messages: Array.from({ length: count }, (_, index) => ({
      id: uuid(100 + index), role: index % 2 === 0 ? "explorer" as const : "virtualGuide" as const,
      body: `Saved message ${index}`, createdAt: "2026-10-24T05:00:00.000Z",
    })), compassItems: [], priorityId: null, attentionId: null, waypoints: [],
  };
}
type BuildInput = Parameters<NonNullable<ExplorerConversationDependencies["buildContext"]>>[0];
function fixture(options: {
  facts?: unknown; current?: ExplorerConversationRpcRow; currentRead?: () => Promise<ExplorerConversationRpcRow>;
  history?: ExplorerConversationState; config?: ExplorerConversationContextConfiguration;
} = {}) {
  const facts = options.facts === undefined ? authority() : options.facts;
  const history = options.history ?? state();
  const row: ExplorerConversationRpcRow = { outcome: "ok", authority_context: facts, conversation_state: history };
  const read = vi.fn(options.currentRead ?? (async () => options.current ?? structuredClone(row)));
  const prepare = vi.fn(async () => { throw new Error("unexpected_prepare"); });
  const complete = vi.fn(async () => { throw new Error("unexpected_complete"); });
  const mutate = vi.fn(async () => { throw new Error("unexpected_mutate"); });
  const repository: ExplorerConversationRepository = { read, prepare, complete, mutate };
  const config = options.config ?? configuration();
  const build = createExplorerConversationContextBuilder({ repository, configuration: config });
  const input: BuildInput = {
    actor, row, state: history,
    command: { kind: "send", operationId: uuid(17), expectedRevision: history.revision, body: "What might a calmer morning look like?" },
    ids,
  };
  return { build, input, row, read, prepare, complete, mutate, config };
}
function assembled(serialization: string): ExplorerSafeContext {
  return JSON.parse(serialization) as ExplorerSafeContext;
}

describe("Explorer conversation actual S03A/S03C context composition (synthetic repository only)", () => {
  it("builds a real bound request and exact evidence without provider or write capabilities", async () => {
    const f = fixture();
    const result = await f.build(f.input);
    expect(result.request).toMatchObject({
      invocationId: ids.invocationId, explorerId: authority().explorerId,
      sessionId: ids.conversationId, contextSnapshotId: ids.snapshotId,
    });
    expect(result.evidence).toEqual({
      p_context_source_ids: [ids.messageId, authority().onboarding.responseId,
        f.config.methodologyContextPackVersionId, ...f.input.state.messages.map(message => message.id)].sort(),
      p_authorization_version: authorizationVersion, p_intake_response_set_id: authority().onboarding.responseId,
      p_methodology_context_pack_version_id: f.config.methodologyContextPackVersionId,
      p_prompt_version: f.config.promptVersion, p_policy_version: f.config.globalPolicy.version,
      p_behavior_version: f.config.roleBehavior.version, p_crisis_version: f.config.crisisBehavior.version,
      p_role_version: f.config.roleVersion, p_instruction_version: f.config.instructionVersion,
    });
    expect(f.read).toHaveBeenCalledExactlyOnceWith(actor);
    expect(f.prepare).not.toHaveBeenCalled();
    expect(f.complete).not.toHaveBeenCalled();
    expect(f.mutate).not.toHaveBeenCalled();
  });

  it("includes actual supportNow with its one response-set source and omits the other five intake answers", async () => {
    const f = fixture();
    const result = await f.build(f.input);
    const context = assembled(result.request.authorizedContext);
    expect(context.approvedContinuity).toEqual([{
      kind: "onboarding_answer", sourceId: authority().onboarding.responseId,
      order: 0, field: "supportNow", content: authority().onboarding.answers.supportNow,
    }]);
    expect(result.request.authorizedContext).not.toContain("OMITTED_");
    expect(context.sessionContext).toMatchObject({
      explorerId: authority().explorerId, sessionId: ids.conversationId,
      continuityBindingId: authority().relationshipId, activeFocusItems: [],
      nextAppointment: null, explorerSafeGuardrail: null,
    });
    for (const forbidden of [authority().accountId, authority().applicationSessionId,
      authority().guideId, authority().practiceId, authority().organizationId]) {
      expect(result.request.authorizedContext).not.toContain(forbidden);
    }
    expect(context).not.toHaveProperty("guidePrivate");
    expect(context).not.toHaveProperty("reflections");
    expect(context).not.toHaveProperty("summaries");
  });

  it("takes only the last twenty-four saved messages with exact provenance and a distinct immediate turn", async () => {
    const history = state(30);
    const f = fixture({ history });
    const result = await f.build(f.input);
    const context = assembled(result.request.authorizedContext);
    expect(context.currentSessionMessages).toHaveLength(24);
    expect(context.currentSessionMessages.map(message => message.messageId)).toEqual(history.messages.slice(-24).map(message => message.id));
    expect(context.currentSessionMessages.map(message => message.order)).toEqual(Array.from({ length: 24 }, (_, index) => index));
    expect(context.currentSessionMessages[0]).toEqual({
      messageId: history.messages[6].id, order: 0, explorerId: authority().explorerId,
      sessionId: ids.conversationId, role: "explorer", content: history.messages[6].body,
    });
    expect(context.currentSessionMessages[1].role).toBe("solmind_virtual_guide");
    expect(context.immediateExplorerMessage).toEqual({
      messageId: ids.messageId, explorerId: authority().explorerId, sessionId: ids.conversationId,
      role: "explorer", content: f.input.command.body,
    });
    const sources = result.evidence.p_context_source_ids as string[];
    for (const old of history.messages.slice(0, 6)) {
      expect(sources).not.toContain(old.id);
      expect(context.currentSessionMessages.some(message => message.content === old.body)).toBe(false);
    }
    expect(sources).toEqual([...new Set([ids.messageId, authority().onboarding.responseId,
      f.config.methodologyContextPackVersionId, ...history.messages.slice(-24).map(message => message.id)])].sort());
  });

  it("can compose the first turn without inventing prior messages or per-answer source IDs", async () => {
    const history: ExplorerConversationState = { ...state(0), conversationId: null, revision: 0 };
    const f = fixture({ history });
    const result = await f.build(f.input);
    const context = assembled(result.request.authorizedContext);
    expect(context.currentSessionMessages).toEqual([]);
    expect(context.sessionContext.sessionId).toBe(ids.conversationId);
    expect(result.evidence.p_context_source_ids).toEqual([
      ids.messageId, f.config.methodologyContextPackVersionId, authority().onboarding.responseId,
    ].sort());
    expect(context.approvedContinuity).toHaveLength(1);
  });

  it("requires valid snapshot/invocation identities and a distinct immediate-message source", async () => {
    for (const changedIds of [
      { ...ids, snapshotId: "invalid-snapshot" }, { ...ids, invocationId: "invalid-invocation" },
      { ...ids, conversationId: "invalid-conversation" },
      { ...ids, messageId: state().messages[0].id },
    ]) {
      const f = fixture();
      await expect(f.build({ ...f.input, ids: changedIds })).rejects.toBeInstanceOf(Error);
      expect(f.read).not.toHaveBeenCalled();
    }
  });

  it("hashes the exact compact S03A bytes rather than raw input or a separately reconstructed object", async () => {
    const f = fixture();
    const result = await f.build(f.input);
    const expected = createHash("sha256").update(result.request.authorizedContext, "utf8").digest("hex").toUpperCase();
    expect(result.request.contextFingerprint).toBe(expected);
    expect(result.request.authorizedContext).toBe(JSON.stringify(assembled(result.request.authorizedContext)));
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.request)).toBe(true);
    expect(Object.isFrozen(result.evidence)).toBe(true);
    expect(Object.isFrozen(result.evidence.p_context_source_ids)).toBe(true);
  });

  it("uses the banked assembler's text normalization before fingerprinting", async () => {
    const facts = authority();
    facts.onboarding.answers.supportNow = "  My own words\r\nA second paragraph  ";
    const f = fixture({ facts });
    const result = await f.build({ ...f.input, command: { ...f.input.command, body: "  My new message\r\nA second line  " } });
    const context = assembled(result.request.authorizedContext);
    expect(context.approvedContinuity[0].content).toBe("My own words\nA second paragraph");
    expect(context.immediateExplorerMessage.content).toBe("My new message\nA second line");
    expect(result.request.contextFingerprint).toBe(createHash("sha256").update(result.request.authorizedContext, "utf8").digest("hex").toUpperCase());
  });

  it("accepts an explicitly paused relationship without treating it as revoked", async () => {
    const f = fixture({ facts: { ...authority(), relationshipStatus: "paused" } });
    await expect(f.build(f.input)).resolves.toHaveProperty("evidence.p_authorization_version", authorizationVersion);
    expect(f.read).toHaveBeenCalledOnce();
  });

  it("rejects actor-account or application-session mismatch before final source IO", async () => {
    for (const changedActor of [{ ...actor, accountId: uuid(90) }, { ...actor, applicationSessionId: uuid(91) }]) {
      const f = fixture();
      await expect(f.build({ ...f.input, actor: changedActor })).rejects.toThrow("explorer_conversation_context_unavailable");
      expect(f.read).not.toHaveBeenCalled();
    }
  });

  it("rejects missing authority and private or unknown authority keys rather than carrying them through", async () => {
    for (const facts of [null, {}, { ...authority(), guidePrivateDraft: "DO_NOT_SEND_GUIDE_PRIVATE" },
      { ...authority(), privateSummary: "DO_NOT_SEND_PRIVATE_SUMMARY" },
      { ...authority(), onboarding: { ...authority().onboarding, guidePrivateDraft: "DO_NOT_SEND_GUIDE_PRIVATE" } },
      { ...authority(), onboarding: { ...authority().onboarding, answers: { ...authority().onboarding.answers, extraAnswer: "DO_NOT_SEND_UNKNOWN" } } }]) {
      const f = fixture({ facts });
      await expect(f.build(f.input)).rejects.toThrow("explorer_conversation_context_unavailable");
      expect(f.read).not.toHaveBeenCalled();
    }
  });

  it("requires exact active intake, adult affirmation, current authorization version and required consent IDs", async () => {
    for (const facts of [
      { ...authority(), onboardingStatus: "draft" }, { ...authority(), adultAffirmation: false },
      { ...authority(), relationshipStatus: "ended" }, { ...authority(), authorizationVersion: `AV1:${"A".repeat(64)}` },
      { ...authority(), authorizationVersion: `AV2:${"a".repeat(64)}` },
      { ...authority(), requiredConsentDocumentIds: [] },
      { ...authority(), requiredConsentDocumentIds: [uuid(15), uuid(15)] },
      { ...authority(), requiredConsentDocumentIds: ["invalid-consent"] },
      { ...authority(), onboarding: { ...authority().onboarding, responseId: "invalid-intake" } },
    ]) {
      const f = fixture({ facts });
      await expect(f.build(f.input)).rejects.toThrow("explorer_conversation_context_unavailable");
      expect(f.read).not.toHaveBeenCalled();
    }
  });

  it("lets S03A reject missing or excessive actual supportNow instead of inventing continuity text", async () => {
    for (const supportNow of [" ", "x".repeat(2_001)]) {
      const facts = authority(); facts.onboarding.answers.supportNow = supportNow;
      const f = fixture({ facts });
      await expect(f.build(f.input)).rejects.toMatchObject({ code: "authorized_virtual_guide_context_invalid_context" });
      expect(f.read).not.toHaveBeenCalled();
    }
  });

  it("detects revoked, unavailable or changed authority in the required final read", async () => {
    const history = state();
    const initial = authority();
    const changes = [
      { outcome: "denied", authority_context: initial, conversation_state: history },
      { outcome: "unavailable", authority_context: initial, conversation_state: history },
      { outcome: "ok", authority_context: { ...initial, authorizationVersion: `AV2:${"B".repeat(64)}` }, conversation_state: history },
      { outcome: "ok", authority_context: { ...initial, relationshipStatus: "ended" }, conversation_state: history },
      { outcome: "ok", authority_context: { ...initial, requiredConsentDocumentIds: [uuid(15)] }, conversation_state: history },
      { outcome: "ok", authority_context: { ...initial, applicationSessionExpiresAt: "2099-01-01T00:00:00.000Z" }, conversation_state: history },
      { outcome: "ok", authority_context: { ...initial, onboarding: { ...initial.onboarding, responseId: uuid(92) } }, conversation_state: history },
    ];
    for (const current of changes) {
      const f = fixture({ history, facts: initial, current });
      await expect(f.build(f.input)).rejects.toMatchObject({ code: "authorized_virtual_guide_context_source_failed" });
      expect(f.read).toHaveBeenCalledExactlyOnceWith(actor);
    }
  });

  it("rejects conversation revision or saved-byte drift during final revalidation", async () => {
    const history = state();
    const facts = authority();
    for (const changed of [
      { ...history, revision: history.revision + 1 },
      { ...history, messages: [{ ...history.messages[0], body: "changed concurrently" }, history.messages[1]] },
      { ...history, conversationId: uuid(93) },
    ]) {
      const f = fixture({ history, facts, current: { outcome: "ok", authority_context: facts, conversation_state: changed } });
      await expect(f.build(f.input)).rejects.toMatchObject({ code: "authorized_virtual_guide_context_source_failed" });
      expect(f.read).toHaveBeenCalledOnce();
    }
  });

  it("fails closed on a final repository read exception with value-free outward error", async () => {
    const f = fixture({ currentRead: async () => { throw new Error("PRIVATE_REPOSITORY_FAILURE"); } });
    await expect(f.build(f.input)).rejects.toMatchObject({ code: "authorized_virtual_guide_context_source_failed", message: "authorized_virtual_guide_context_source_failed" });
    expect(f.read).toHaveBeenCalledOnce();
  });

  it("honors cancellation before composition and during final source revalidation", async () => {
    const early = fixture(); const earlyAbort = new AbortController(); earlyAbort.abort();
    await expect(early.build({ ...early.input, signal: earlyAbort.signal })).rejects.toThrow("explorer_conversation_context_unavailable");
    expect(early.read).not.toHaveBeenCalled();
    const laterAbort = new AbortController();
    const f = fixture({ currentRead: async () => { laterAbort.abort(); return structuredClone(f.row); } });
    await expect(f.build({ ...f.input, signal: laterAbort.signal })).rejects.toMatchObject({ code: "authorized_virtual_guide_context_cancelled" });
    expect(f.read).toHaveBeenCalledOnce();
  });

  it("pins its typed server configuration against later input mutation", async () => {
    const config = { ...configuration(), globalPolicy: { ...configuration().globalPolicy } };
    const f = fixture({ config });
    config.globalPolicy.text = "MUTATED_AFTER_CONFIGURATION";
    config.methodologyContextPackVersionId = uuid(94);
    const result = await f.build(f.input);
    expect(result.request.authorizedContext).not.toContain("MUTATED_AFTER_CONFIGURATION");
    expect(result.evidence.p_methodology_context_pack_version_id).toBe(uuid(8));
  });

  it("requires all exact configuration/evidence identity and version bindings", async () => {
    const valid = configuration();
    for (const config of [
      { ...valid, methodologyContextPackVersionId: "not-a-uuid" },
      { ...valid, promptVersion: " " }, { ...valid, instructionVersion: "x".repeat(129) },
      { ...valid, roleVersion: "bad\u0000version" },
      { ...valid, providerSecret: "NOT_A_CONFIGURATION_CAPABILITY" },
      { ...valid, globalPolicy: { ...valid.globalPolicy, guidePrivate: "DO_NOT_SEND_GUIDE_PRIVATE" } },
    ]) {
      expect(() => fixture({ config: config as ExplorerConversationContextConfiguration })).toThrow("explorer_conversation_context_unavailable");
    }
    const tooLongBankedVersion = fixture({ config: { ...valid, methodologyContext: { ...valid.methodologyContext, version: "x".repeat(65) } } });
    await expect(tooLongBankedVersion.build(tooLongBankedVersion.input)).rejects.toMatchObject({ code: "authorized_virtual_guide_context_invalid_context" });
  });

  it("never publishes version evidence with bytes different from the assembled policy/behavior/crisis versions", async () => {
    const valid = configuration();
    const outcome = await (async () => {
      const f = fixture({ config: { ...valid,
        globalPolicy: { ...valid.globalPolicy, version: ` ${valid.globalPolicy.version} ` },
        roleBehavior: { ...valid.roleBehavior, version: ` ${valid.roleBehavior.version} ` },
        crisisBehavior: { ...valid.crisisBehavior, version: ` ${valid.crisisBehavior.version} ` },
      } });
      return f.build(f.input);
    })().then(result => ({ result, error: null }), error => ({ result: null, error }));
    if (outcome.result) {
      const context = assembled(outcome.result.request.authorizedContext);
      expect(outcome.result.evidence.p_policy_version).toBe(context.globalPolicy.version);
      expect(outcome.result.evidence.p_behavior_version).toBe(context.roleBehavior.version);
      expect(outcome.result.evidence.p_crisis_version).toBe(context.crisisBehavior.version);
    } else {
      expect(outcome.error).toBeInstanceOf(Error);
      expect(["explorer_conversation_context_unavailable", "authorized_virtual_guide_context_invalid_context"])
        .toContain((outcome.error as Error).message);
    }
  });
});
