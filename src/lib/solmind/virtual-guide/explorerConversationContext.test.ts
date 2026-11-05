import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  createExplorerConversationContextBuilder,
  createGovernedExplorerConversationContextBuilder,
  createPrivateExplorerConversationContextBuilder,
  createPrivateGovernedExplorerConversationContextBuilder,
  EXPLORER_CONVERSATION_CONTEXT_SELECTION_VERSION,
  EXPLORER_PRIVATE_CONVERSATION_CONTEXT_SELECTION_VERSION,
  type ExplorerConversationContextConfiguration,
} from "./explorerConversationContext";
import { commandExplorerConversation } from "./explorerConversationComposition";
import type { EffectiveMethodologySelection, EffectiveMethodologySource } from "./effectiveMethodologyContext";
import type {
  ExplorerConversationDependencies,
  ExplorerConversationRepository,
  ExplorerConversationRpcRow,
  PrivateExplorerConversationContextBuilder,
} from "./explorerConversationComposition";
import {
  selectExplorerSafetyRequestMode,
  type ExplorerConversationPolicy,
  type ExplorerFallbackObservation,
} from "./explorerConversationSafety";
import { EXPLORER_CONVERSATION_VERSION, parseExplorerConversationState, type ExplorerConversationState } from "../explorerConversationContract";
import {
  EXPLORER_CONTEXT_EXCLUSION_MATCHER_VERSION,
  inspectExplorerContextExclusions,
} from "./explorerContextExclusionGuard";
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
        usefulOutcome: "I want to find one useful next step.", supportStyle: "Reflection with a gentle pace.",
        guideContext: "I prefer to start with my own words.", communicationPreference: "Brief and clear.",
        doNotEmphasize: "Please do not focus on productivity.",
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

describe("Held exclusion matcher with actual S03A/S03C assembly (injected test wrapper only)", () => {
  const canary = "GUIDE_PRIVATE_CANARY_58E2";
  const manifest = Object.freeze({
    contractVersion: EXPLORER_CONTEXT_EXCLUSION_MATCHER_VERSION,
    explorerId: authority().explorerId, relationshipId: authority().relationshipId,
    entries: Object.freeze([Object.freeze({ entityType: "private_note" as const, entityId: uuid(901),
      normalizedContentSha256: createHash("sha256").update(canary).digest("hex").toUpperCase() })]),
  });
  function wrapper(build: NonNullable<ExplorerConversationDependencies["buildContext"]>) {
    return async (turn: BuildInput) => {
      const context = await build(turn);
      const inspection = inspectExplorerContextExclusions({ serializedContext: context.request.authorizedContext,
        includedSourceIds: context.evidence.p_context_source_ids,
        expectedBinding: { explorerId: authority().explorerId, sessionId: turn.ids.conversationId,
          relationshipId: authority().relationshipId }, manifest });
      if (inspection.status !== "clear") throw new Error("explorer_conversation_context_unavailable");
      return context;
    };
  }

  it.each(["supportNow", "usefulOutcome", "supportStyle", "guideContext", "communicationPreference", "doNotEmphasize"])(
    "blocks an allowed onboarding field contaminated with private content (%s) before writes or provider",
    async (field) => {
      const facts = authority(); facts.onboarding.answers[field as keyof typeof facts.onboarding.answers] = canary;
      const f = fixture({ facts }); const generate = vi.fn();
      const result = await commandExplorerConversation({ command: f.input.command, dependencies: {
        authenticate: async () => actor, repository: { read: f.read, prepare: f.prepare, complete: f.complete, mutate: f.mutate },
        buildContext: wrapper(f.build), provider: { generate },
      } });
      expect(result).toEqual({ ok: false, state: null, error: "unavailable" });
      expect(JSON.stringify(result)).not.toContain(canary);
      expect(f.prepare).not.toHaveBeenCalled(); expect(f.complete).not.toHaveBeenCalled(); expect(generate).not.toHaveBeenCalled();
    },
  );

  it.each(["methodology", "history", "immediate"])(
    "blocks whole-field contamination in %s through the actual builder",
    async (layer) => {
      const original = configuration();
      const config = layer === "methodology" ? { ...original, methodologyContext: { ...original.methodologyContext, text: canary } } : original;
      const previous = state();
      const history = layer === "history" ? { ...previous, messages: previous.messages.map((message, index) => index === 0 ? { ...message, body: canary } : message) } : previous;
      const f = fixture({ config, history });
      const command = layer === "immediate" ? { ...f.input.command, body: canary } : f.input.command;
      const generate = vi.fn();
      const result = await commandExplorerConversation({ command, dependencies: {
        authenticate: async () => actor, repository: { read: f.read, prepare: f.prepare, complete: f.complete, mutate: f.mutate },
        buildContext: wrapper(f.build), provider: { generate },
      } });
      expect(result).toEqual({ ok: false, state: null, error: "unavailable" });
      expect(f.prepare).not.toHaveBeenCalled(); expect(generate).not.toHaveBeenCalled();
    },
  );

  it("allows a clean actual assembly to reach the existing refused preparation gate", async () => {
    const f = fixture(); const prepare = vi.fn<ExplorerConversationRepository["prepare"]>().mockResolvedValue({ outcome: "denied", conversation_state: null });
    const generate = vi.fn();
    const result = await commandExplorerConversation({ command: f.input.command, dependencies: {
      authenticate: async () => actor, repository: { read: f.read, prepare, complete: f.complete, mutate: f.mutate },
      buildContext: wrapper(f.build), provider: { generate },
    } });
    expect(result).toEqual({ ok: false, state: null, error: "denied" });
    expect(prepare).toHaveBeenCalledOnce(); expect(generate).not.toHaveBeenCalled();
  });

  it("settles exact replay without invoking the injected guard wrapper or provider", async () => {
    const f = fixture(); f.read.mockResolvedValue({ ...f.row, outcome: "exact_replay" });
    const build = vi.fn(wrapper(f.build)); const generate = vi.fn();
    const result = await commandExplorerConversation({ command: f.input.command, dependencies: {
      authenticate: async () => actor, repository: { read: f.read, prepare: f.prepare, complete: f.complete, mutate: f.mutate },
      buildContext: build, provider: { generate },
    } });
    expect(result.ok).toBe(true); expect(build).not.toHaveBeenCalled();
    expect(f.prepare).not.toHaveBeenCalled(); expect(generate).not.toHaveBeenCalled();
  });
});

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

  it("includes the six submitted continuity fields under one real response-set source", async () => {
    const f = fixture();
    const result = await f.build(f.input);
    const context = assembled(result.request.authorizedContext);
    expect(context.approvedContinuity).toEqual(Object.entries(authority().onboarding.answers).map(([field, content], order) => ({
      kind: "onboarding_answer", sourceId: authority().onboarding.responseId,
      order, field, content,
    })));
    expect(context.contractVersion).toBe(EXPLORER_CONVERSATION_CONTEXT_SELECTION_VERSION);
    expect((result.evidence.p_context_source_ids as string[]).filter(id => id === authority().onboarding.responseId)).toHaveLength(1);
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
    expect(context.approvedContinuity).toHaveLength(6);
  });

  it("skips blank optional answers and assigns dense banked order independently of JSON key order", async () => {
    const facts = authority();
    facts.onboarding.answers = {
      doNotEmphasize: "Keep the focus on reflection.", communicationPreference: " \r\n\t ", guideContext: "",
      supportStyle: facts.onboarding.answers.supportStyle, usefulOutcome: facts.onboarding.answers.usefulOutcome,
      supportNow: facts.onboarding.answers.supportNow,
    };
    const f = fixture({ facts });
    const result = await f.build(f.input);
    const context = assembled(result.request.authorizedContext);
    expect(context.approvedContinuity.map(item => [item.field, item.order])).toEqual([
      ["supportNow", 0], ["usefulOutcome", 1], ["supportStyle", 2], ["doNotEmphasize", 3],
    ]);
    expect(context.sessionContext.explorerSafeGuardrail).toBeNull();
  });

  it("binds changes in every included preference to new exact context bytes and fingerprint", async () => {
    const original = fixture();
    const prior = await original.build(original.input);
    for (const field of Object.keys(authority().onboarding.answers)) {
      const facts = authority();
      facts.onboarding.answers[field as keyof typeof facts.onboarding.answers] += " Changed selection.";
      const changed = fixture({ facts });
      const next = await changed.build(changed.input);
      expect(next.request.authorizedContext).not.toBe(prior.request.authorizedContext);
      expect(next.request.contextFingerprint).not.toBe(prior.request.contextFingerprint);
      expect(next.evidence.p_context_source_ids).toEqual(prior.evidence.p_context_source_ids);
    }
  });

  it("fails closed on oversized optional preferences without truncating or omitting them", async () => {
    for (const field of ["guideContext", "communicationPreference", "doNotEmphasize"] as const) {
      const facts = authority(); facts.onboarding.answers[field] = "x".repeat(2_001);
      const f = fixture({ facts });
      await expect(f.build(f.input)).rejects.toMatchObject({ code: "authorized_virtual_guide_context_invalid_context" });
      expect(f.read).not.toHaveBeenCalled();
    }
  });

  it("rejects a changed preference during final authority revalidation", async () => {
    const initial = authority();
    const changed = authority(); changed.onboarding.answers.doNotEmphasize = "Changed concurrently.";
    const f = fixture({ facts: initial, current: { outcome: "ok", authority_context: changed, conversation_state: state() } });
    await expect(f.build(f.input)).rejects.toMatchObject({ code: "authorized_virtual_guide_context_source_failed" });
    expect(f.read).toHaveBeenCalledOnce();
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

  it("lets S03A reject missing or excessive required answers instead of inventing continuity text", async () => {
    for (const field of ["supportNow", "usefulOutcome", "supportStyle"] as const) {
      for (const content of [" ", "x".repeat(2_001)]) {
        const facts = authority(); facts.onboarding.answers[field] = content;
        const f = fixture({ facts });
        await expect(f.build(f.input)).rejects.toMatchObject({ code: "authorized_virtual_guide_context_invalid_context" });
        expect(f.read).not.toHaveBeenCalled();
      }
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

function governedSelection(): EffectiveMethodologySelection {
  const contentMarkdown = "Synthetic methodology: ask reflectively and preserve the Explorer's agency.\nThis is test data only.";
  return {
    packId: uuid(80), scopeType: "guide", scopeId: authority().guideId, versionId: uuid(81), versionNumber: 1,
    contentMarkdown, contentSha256: createHash("sha256").update(contentMarkdown, "utf8").digest("hex").toUpperCase(),
    methodologyAuthorizationVersion: `MV1:${"A".repeat(64)}`,
  };
}
function governedFixture(options: Parameters<typeof fixture>[0] = {}) {
  const f = fixture(options);
  const selected = governedSelection();
  const methodologyRead = vi.fn<EffectiveMethodologySource["read"]>().mockResolvedValue(selected);
  const higherConfiguration = {
    promptVersion: f.config.promptVersion, instructionVersion: f.config.instructionVersion, roleVersion: f.config.roleVersion,
    globalPolicy: structuredClone(f.config.globalPolicy), roleBehavior: structuredClone(f.config.roleBehavior),
    crisisBehavior: structuredClone(f.config.crisisBehavior),
  };
  const factoryInput = {
    repository: { read: f.read, prepare: f.prepare, complete: f.complete, mutate: f.mutate },
    configuration: higherConfiguration, packId: selected.packId,
    expectedScope: { type: "guide" as const, id: selected.scopeId },
    methodologySource: { read: methodologyRead },
  };
  const build = createGovernedExplorerConversationContextBuilder(factoryInput);
  return { ...f, selected, methodologyRead, factoryInput, build };
}

describe("governed Explorer context (synthetic SQL-shaped source and policy only)", () => {
  it("uses exact selected content/version, retains all existing context sources and adds the three governed bindings", async () => {
    const f = governedFixture(); const result = await f.build(f.input);
    const context = assembled(result.request.authorizedContext);
    expect(context.methodologyContext).toEqual({ version: `methodology:${f.selected.versionId}`, text: f.selected.contentMarkdown });
    expect(context.approvedContinuity).toHaveLength(6); expect(context.currentSessionMessages).toHaveLength(2);
    expect(context.sessionContext.explorerSafeGuardrail).toBeNull();
    expect(result.evidence).toMatchObject({
      p_methodology_context_pack_id: f.selected.packId,
      p_methodology_context_pack_version_id: f.selected.versionId,
      p_methodology_content_sha256: f.selected.contentSha256,
      p_methodology_authorization_version: f.selected.methodologyAuthorizationVersion,
      p_authorization_version: authorizationVersion,
    });
    expect(result.evidence.p_context_source_ids).toEqual([
      ids.messageId, authority().onboarding.responseId, f.selected.versionId, ...state().messages.map(message => message.id),
    ].sort());
    expect(result.request.contextFingerprint).toBe(createHash("sha256").update(result.request.authorizedContext, "utf8").digest("hex").toUpperCase());
    expect(f.methodologyRead).toHaveBeenCalledTimes(2); expect(f.read).toHaveBeenCalledExactlyOnceWith(actor);
    expect(f.methodologyRead.mock.calls.map(([request]) => request)).toEqual([
      { actor, packId: f.selected.packId, expectedScope: f.factoryInput.expectedScope },
      { actor, packId: f.selected.packId, expectedScope: f.factoryInput.expectedScope },
    ]);
    expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.evidence)).toBe(true);
    expect(f.prepare).not.toHaveBeenCalled(); expect(f.complete).not.toHaveBeenCalled(); expect(f.mutate).not.toHaveBeenCalled();
    for (const identifier of [f.selected.packId, f.selected.methodologyAuthorizationVersion, f.selected.contentSha256, authority().guideId]) {
      expect(result.request.authorizedContext).not.toContain(identifier);
    }
  });

  it("selects a newly current version on the next response without restarting the conversation", async () => {
    const f = governedFixture(); const first = await f.build(f.input);
    const nextText = "A changed synthetic method, effective for the next turn.";
    const next = { ...f.selected, versionId: uuid(82), versionNumber: 2, contentMarkdown: nextText,
      contentSha256: createHash("sha256").update(nextText, "utf8").digest("hex").toUpperCase(),
      methodologyAuthorizationVersion: `MV1:${"B".repeat(64)}` };
    f.methodologyRead.mockResolvedValue(next);
    const second = await f.build({ ...f.input, command: { ...f.input.command, operationId: uuid(83), body: "Another synthetic turn." } });
    expect(second.request.sessionId).toBe(first.request.sessionId);
    expect(second.request.contextFingerprint).not.toBe(first.request.contextFingerprint);
    expect(second.evidence.p_methodology_context_pack_version_id).toBe(next.versionId);
    expect(assembled(second.request.authorizedContext).methodologyContext.text).toBe(nextText);
    expect(first.evidence.p_methodology_context_pack_version_id).toBe(f.selected.versionId);
    expect(assembled(first.request.authorizedContext).methodologyContext.text).toBe(f.selected.contentMarkdown);
    expect(f.methodologyRead).toHaveBeenCalledTimes(4);
  });

  it.each([
    { versionId: uuid(82) }, { versionNumber: 2 }, { methodologyAuthorizationVersion: `MV1:${"B".repeat(64)}` },
  ])("refuses final selected-version/proof drift before releasing context: %#", async (change) => {
    const f = governedFixture();
    f.methodologyRead.mockResolvedValueOnce(f.selected).mockResolvedValueOnce({ ...f.selected, ...change });
    await expect(f.build(f.input)).rejects.toThrow("explorer_conversation_context_unavailable");
    expect(f.methodologyRead).toHaveBeenCalledTimes(2); expect(f.prepare).not.toHaveBeenCalled();
  });

  it("refuses a newly edited content/digest pair during final selection rather than silently rebuilding", async () => {
    const f = governedFixture(); const changed = "Different exact synthetic content.";
    f.methodologyRead.mockResolvedValueOnce(f.selected).mockResolvedValueOnce({ ...f.selected, contentMarkdown: changed,
      contentSha256: createHash("sha256").update(changed, "utf8").digest("hex").toUpperCase() });
    await expect(f.build(f.input)).rejects.toThrow("explorer_conversation_context_unavailable");
    expect(f.methodologyRead).toHaveBeenCalledTimes(2);
  });

  it.each([
    { packId: uuid(99) }, { scopeId: uuid(99) }, { scopeType: "practice" },
    { contentSha256: "F".repeat(64) }, { methodologyAuthorizationVersion: "MV1:invalid" },
  ])("rejects false scope/digest/authorization data on the first resolver read: %#", async change => {
    const f = governedFixture(); f.methodologyRead.mockResolvedValue({ ...f.selected, ...change } as EffectiveMethodologySelection);
    await expect(f.build(f.input)).rejects.toThrow("explorer_conversation_context_unavailable");
    expect(f.read).not.toHaveBeenCalled(); expect(f.prepare).not.toHaveBeenCalled();
  });

  it("refuses source failures on initial and final reads without leaking their detail", async () => {
    for (const final of [false, true]) {
      const f = governedFixture();
      if (final) f.methodologyRead.mockResolvedValueOnce(f.selected);
      f.methodologyRead.mockRejectedValueOnce(new Error("PRIVATE_GOVERNANCE_DETAIL"));
      await expect(f.build(f.input)).rejects.toThrow("explorer_conversation_context_unavailable");
      expect(f.prepare).not.toHaveBeenCalled();
    }
  });

  it("refuses another Guide's configured scope and a mismatched actor before any methodology lookup", async () => {
    const f = governedFixture();
    const otherScope = createGovernedExplorerConversationContextBuilder({ ...f.factoryInput, expectedScope: { type: "guide", id: uuid(99) } });
    await expect(otherScope(f.input)).rejects.toThrow("explorer_conversation_context_unavailable");
    await expect(f.build({ ...f.input, actor: { ...actor, accountId: uuid(98) } })).rejects.toThrow("explorer_conversation_context_unavailable");
    expect(f.methodologyRead).not.toHaveBeenCalled(); expect(f.read).not.toHaveBeenCalled();
  });

  it("preserves existing authority/history final revalidation and never accepts a revoked result", async () => {
    const f = governedFixture({ current: { outcome: "denied", conversation_state: null } });
    await expect(f.build(f.input)).rejects.toThrow("explorer_conversation_context_unavailable");
    expect(f.methodologyRead).toHaveBeenCalledTimes(1); expect(f.read).toHaveBeenCalledOnce();
    expect(f.prepare).not.toHaveBeenCalled();
  });

  it("copies higher policy and trusted scope at construction while selecting methodology per turn", async () => {
    const f = governedFixture();
    const originalPolicy = structuredClone(f.factoryInput.configuration.globalPolicy);
    (f.factoryInput.configuration.globalPolicy as { text: string }).text = "Changed caller-owned policy";
    f.factoryInput.expectedScope.id = uuid(99);
    const result = await f.build(f.input);
    expect(assembled(result.request.authorizedContext).globalPolicy).toEqual(originalPolicy);
    expect(f.methodologyRead.mock.calls[0][0].expectedScope.id).toBe(f.selected.scopeId);
  });

  it("rejects configuration-supplied methodology and executable configuration fields", () => {
    const f = governedFixture();
    expect(() => createGovernedExplorerConversationContextBuilder({ ...f.factoryInput,
      configuration: { ...f.factoryInput.configuration, methodologyContext: { version: "fake", text: "Unreviewed" } } as never,
    })).toThrow("explorer_conversation_context_unavailable");
    const getter = vi.fn(() => f.factoryInput.configuration.globalPolicy);
    const hostile = Object.defineProperty({ ...f.factoryInput.configuration }, "globalPolicy", { enumerable: true, get: getter });
    expect(() => createGovernedExplorerConversationContextBuilder({ ...f.factoryInput, configuration: hostile })).toThrow("explorer_conversation_context_unavailable");
    expect(getter).not.toHaveBeenCalled(); expect(f.methodologyRead).not.toHaveBeenCalled();
  });

  it("cancels before initial lookup and after a resolved lookup without continuing assembly", async () => {
    const before = governedFixture(); const first = new AbortController(); first.abort();
    await expect(before.build({ ...before.input, signal: first.signal })).rejects.toThrow("explorer_conversation_context_unavailable");
    expect(before.methodologyRead).not.toHaveBeenCalled();
    const after = governedFixture(); const second = new AbortController();
    after.methodologyRead.mockImplementationOnce(async () => { second.abort(); return after.selected; });
    await expect(after.build({ ...after.input, signal: second.signal })).rejects.toThrow("explorer_conversation_context_unavailable");
    expect(after.read).not.toHaveBeenCalled(); expect(after.methodologyRead).toHaveBeenCalledOnce();
  });

  it("settles exact old-command replay before builder, methodology, prepare or provider work", async () => {
    const f = governedFixture(); f.read.mockResolvedValue({ ...f.row, outcome: "exact_replay" });
    f.methodologyRead.mockRejectedValue(new Error("The current methodology must not be needed for old replay"));
    const generate = vi.fn(); const build = vi.fn(f.build);
    const result = await commandExplorerConversation({ command: f.input.command, dependencies: {
      authenticate: async () => actor, repository: f.factoryInput.repository, buildContext: build, provider: { generate },
    } });
    expect(result.ok).toBe(true); expect(build).not.toHaveBeenCalled(); expect(f.methodologyRead).not.toHaveBeenCalled();
    expect(f.prepare).not.toHaveBeenCalled(); expect(f.complete).not.toHaveBeenCalled(); expect(generate).not.toHaveBeenCalled();
  });

  it("passes the real builder's governed evidence to preparation and stops on a refused gate", async () => {
    const f = governedFixture();
    const prepare = vi.fn<ExplorerConversationRepository["prepare"]>().mockResolvedValue({ outcome: "denied", conversation_state: null });
    const generate = vi.fn();
    const result = await commandExplorerConversation({ command: f.input.command, dependencies: {
      authenticate: async () => actor,
      repository: { ...f.factoryInput.repository, prepare }, buildContext: f.build, provider: { generate },
    } });
    expect(result).toEqual({ ok: false, state: null, error: "denied" });
    expect(prepare).toHaveBeenCalledOnce();
    expect(prepare.mock.calls[0][0]).toMatchObject({
      p_methodology_context_pack_id: f.selected.packId, p_methodology_context_pack_version_id: f.selected.versionId,
      p_methodology_content_sha256: f.selected.contentSha256, p_methodology_authorization_version: f.selected.methodologyAuthorizationVersion,
    });
    expect(f.methodologyRead).toHaveBeenCalledTimes(2); expect(generate).not.toHaveBeenCalled();
  });

  it("a final pointer drift produces no preparation, invocation or invented reply in actual composition", async () => {
    const f = governedFixture();
    f.methodologyRead.mockResolvedValueOnce(f.selected).mockResolvedValueOnce({ ...f.selected, versionId: uuid(82), versionNumber: 2 });
    const generate = vi.fn();
    const result = await commandExplorerConversation({ command: f.input.command, dependencies: {
      authenticate: async () => actor, repository: f.factoryInput.repository, buildContext: f.build, provider: { generate },
    } });
    expect(result).toEqual({ ok: false, state: null, error: "unavailable" });
    expect(f.prepare).not.toHaveBeenCalled(); expect(f.complete).not.toHaveBeenCalled(); expect(generate).not.toHaveBeenCalled();
  });
});

describe("Explicit held private AV3 context entry points", () => {
  const privateVersion = `AV3:${"B".repeat(64)}`;
  it("uses AV3 current proof with the private input envelope revision (chat step slice S3)", async () => {
    const f = fixture({ facts: { ...authority(), authorizationVersion: privateVersion } });
    const build = createPrivateExplorerConversationContextBuilder({ repository: { read: f.read }, configuration: f.config });
    const result = await build({ ...f.input, mode: "classification_and_reply" });
    expect(result.evidence.p_authorization_version).toBe(privateVersion);
    expect(assembled(result.request.authorizedContext).contractVersion).toBe(EXPLORER_PRIVATE_CONVERSATION_CONTEXT_SELECTION_VERSION);
    expect(assembled(result.request.authorizedContext).compassContext).toEqual({ version: "explorer-compass-context.v1",
      points: [], priorityId: null, attentionId: null, recentRoute: [], waypoints: [], drafts: [] });
    expect(f.read).toHaveBeenCalledOnce();
    expect(f.prepare).not.toHaveBeenCalled(); expect(f.complete).not.toHaveBeenCalled();
  });
  it("refuses AV2 at the private entry and AV3 at the legacy entry", async () => {
    const legacy = fixture();
    const privateBuild = createPrivateExplorerConversationContextBuilder({ repository: { read: legacy.read }, configuration: legacy.config });
    await expect(privateBuild({ ...legacy.input, mode: "classification_and_reply" })).rejects.toThrow("explorer_conversation_context_unavailable");
    const successor = fixture({ facts: { ...authority(), authorizationVersion: privateVersion } });
    await expect(successor.build(successor.input)).rejects.toThrow("explorer_conversation_context_unavailable");
    expect(legacy.read).not.toHaveBeenCalled(); expect(successor.read).not.toHaveBeenCalled();
  });
  it("does not downgrade a final private read to an AV2 token", async () => {
    const f = fixture({ facts: { ...authority(), authorizationVersion: privateVersion } });
    f.read.mockResolvedValueOnce({ ...f.row, authority_context: authority() });
    const build = createPrivateExplorerConversationContextBuilder({ repository: { read: f.read }, configuration: f.config });
    await expect(build({ ...f.input, mode: "classification_and_reply" })).rejects.toThrow("authorized_virtual_guide_context_source_failed");
    expect(f.read).toHaveBeenCalledOnce(); expect(f.prepare).not.toHaveBeenCalled();
  });
  it("resolves and revalidates actual injected methodology under explicit AV3", async () => {
    const f = governedFixture();
    (f.row.authority_context as ReturnType<typeof authority>).authorizationVersion = privateVersion;
    const build = createPrivateGovernedExplorerConversationContextBuilder(f.factoryInput);
    const result = await build({ ...f.input, mode: "classification_and_reply" });
    expect(result.evidence.p_authorization_version).toBe(privateVersion);
    expect(result.evidence.p_methodology_context_pack_version_id).toBe(f.selected.versionId);
    expect(assembled(result.request.authorizedContext).methodologyContext.text).toBe(f.selected.contentMarkdown);
    expect(f.methodologyRead).toHaveBeenCalledTimes(2);
    expect(f.prepare).not.toHaveBeenCalled(); expect(f.complete).not.toHaveBeenCalled();
  });
  it("refuses private governed AV2 before methodology access", async () => {
    const f = governedFixture();
    const build = createPrivateGovernedExplorerConversationContextBuilder(f.factoryInput);
    await expect(build({ ...f.input, mode: "classification_and_reply" })).rejects.toThrow("explorer_conversation_context_unavailable");
    expect(f.methodologyRead).not.toHaveBeenCalled(); expect(f.prepare).not.toHaveBeenCalled();
  });
});

// Chat step slice S3 (2026-11-03): the saved Compass and Waypoint section. These rows are the
// same synthetic rows as the "S3 golden vector" block of supabase/tests/explorer_source_exclusion_test.sql,
// where the database rebuild must equal GOLDEN's content, compared as jsonb, and that content, set into the
// context, must inspect clear.
const sx = (n: number) => `f5120000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const GOLDEN = '{"version":"explorer-compass-context.v1","points":[{"id":"f5120000-0000-4000-8000-000000000401","label":"Money worries","order":0,"formation":"saved","anchor":"apex","emphasis":3},{"id":"f5120000-0000-4000-8000-000000000402","label":"Sleep","order":1,"formation":"saved","anchor":null,"emphasis":null},{"id":"f5120000-0000-4000-8000-000000000404","label":"Family","order":2,"formation":"saved","anchor":null,"emphasis":1}],"priorityId":"f5120000-0000-4000-8000-000000000401","attentionId":"f5120000-0000-4000-8000-000000000402","recentRoute":[{"kind":"attention_changed","pointId":"f5120000-0000-4000-8000-000000000404","label":"Family","actor":"explorer","awaitingReply":false},{"kind":"attention_changed","pointId":"f5120000-0000-4000-8000-000000000401","label":"Money worries","actor":"explorer","awaitingReply":false},{"kind":"attention_changed","pointId":"f5120000-0000-4000-8000-000000000402","label":"Sleep","actor":"explorer","awaitingReply":false},{"kind":"attention_changed","pointId":"f5120000-0000-4000-8000-000000000404","label":"Family","actor":"explorer","awaitingReply":false},{"kind":"attention_changed","pointId":"f5120000-0000-4000-8000-000000000402","label":"Sleep","actor":"explorer","awaitingReply":true}],"waypoints":[{"id":"f5120000-0000-4000-8000-000000000421","title":"Find a calmer morning","destination":"Find a calmer morning","meaning":"Mornings set\\nmy whole day","arrivalSignal":"I start two mornings a week without rushing","stage":"formed","reachedEvidence":null},{"id":"f5120000-0000-4000-8000-000000000422","title":"Walk after dinner","destination":"Walk after dinner","meaning":"It clears my head","arrivalSignal":"I walk three evenings in one week","stage":"reached","reachedEvidence":"I walked four evenings last week"},{"id":"f5120000-0000-4000-8000-000000000423","title":"Call my sister","destination":"Call my sister","meaning":"We have drifted apart","arrivalSignal":"We talk once a week for a month","stage":"released","reachedEvidence":null},{"id":"f5120000-0000-4000-8000-000000000425","title":"Read before bed","destination":"Read before bed","meaning":"Screens keep me awake","arrivalSignal":"I read on three nights","stage":"formed","reachedEvidence":null}],"drafts":[]}';
function s3State(): ExplorerConversationState {
  const base = state(); const source = base.messages[0].id;
  const at = (minute: number) => `2026-11-03T09:${String(minute).padStart(2, "0")}:00.000Z`;
  return { ...base,
    compassItems: [
      { id: sx(401), sourceMessageId: source, label: "  Money worries ", anchor: "apex", emphasis: 3, mergedIntoItemId: null },
      { id: sx(402), sourceMessageId: source, label: "Sleep", anchor: null, emphasis: null, mergedIntoItemId: null },
      { id: sx(403), sourceMessageId: source, label: "Work stress", anchor: "upper_left", emphasis: 2, mergedIntoItemId: sx(401) },
      { id: sx(404), sourceMessageId: source, label: "Family", anchor: null, emphasis: 1, mergedIntoItemId: null },
    ],
    priorityId: sx(401), attentionId: sx(402),
    // Round 2 (2026-11-03): needle moves only, with each point's current label. The needle move on the
    // combined-away point 403 is among the newest five needle moves; leaving it out lets the oldest one (on 404) in.
    route: [
      { operationId: sx(411), revision: 2, kind: "attention_changed", compassItemId: sx(404), label: "Family", recordedAt: at(1) },
      { operationId: sx(412), revision: 3, kind: "priority_confirmed", compassItemId: sx(404), label: "Family", recordedAt: at(2) },
      { operationId: sx(413), revision: 4, kind: "attention_changed", compassItemId: sx(401), label: "  Money worries ", recordedAt: at(3) },
      { operationId: sx(414), revision: 5, kind: "attention_changed", compassItemId: sx(402), label: "Sleep", recordedAt: at(4) },
      { operationId: sx(415), revision: 6, kind: "attention_changed", compassItemId: sx(403), label: "Work stress", recordedAt: at(5) },
      { operationId: sx(416), revision: 7, kind: "priority_reoriented", compassItemId: sx(401), label: "  Money worries ", recordedAt: at(6) },
      { operationId: sx(417), revision: 8, kind: "attention_changed", compassItemId: sx(404), label: "Family", recordedAt: at(7) },
      { operationId: sx(418), revision: 9, kind: "attention_changed", compassItemId: sx(402), label: "Sleep", recordedAt: at(8) },
    ],
    waypoints: [
      { id: sx(421), sourceMessageId: source, destination: "Find a calmer morning", meaning: "Mornings set\r\nmy whole day",
        arrivalSignal: "I start two mornings a week without rushing", status: "chosen", reachedEvidence: null, reachedAt: null },
      { id: sx(422), sourceMessageId: source, destination: "Walk after dinner", meaning: "It clears my head",
        arrivalSignal: "I walk three evenings in one week", status: "reached", reachedEvidence: "  I walked four evenings last week ",
        reachedAt: "2026-11-03T11:00:00.000Z" },
      { id: sx(423), sourceMessageId: source, destination: "Call my sister", meaning: "We have drifted apart",
        arrivalSignal: "We talk once a week for a month", status: "chosen", reachedEvidence: null, reachedAt: null,
        release: { operationId: sx(431), releasedAt: "2026-11-03T12:00:00.000Z" } },
      { id: sx(424), sourceMessageId: source, destination: "Read before bed", meaning: "Screens keep me awake",
        arrivalSignal: "I read on five nights", status: "chosen", reachedEvidence: null, reachedAt: null },
      { id: sx(425), sourceMessageId: source, destination: "Read before bed", meaning: "Screens keep me awake",
        arrivalSignal: "I read on three nights", status: "chosen", reachedEvidence: null, reachedAt: null,
        lifecycle: { predecessorWaypointId: sx(424), creationReason: "revision", clarifications: [{ component: "arrivalSignal",
          questionKey: "waypoint.arrivalSignal.v1", answer: "I read on three nights", recordedAt: "2026-11-03T10:04:00.000Z" }] } },
    ],
  };
}
function privateFixture(history: ExplorerConversationState) {
  const f = fixture({ facts: { ...authority(), authorizationVersion: `AV3:${"B".repeat(64)}` }, history });
  return { ...f, input: { ...f.input, mode: "classification_and_reply" as const },
    build: createPrivateExplorerConversationContextBuilder({ repository: { read: f.read }, configuration: f.config }) };
}

describe("Chat step slice S3 saved Compass and Waypoint section (private AV3 entries)", () => {
  it("S4 marks only the latest unanswered Explorer move for one brief acknowledgment", async () => {
    const f = privateFixture(s3State());
    const route = assembled((await f.build(f.input)).request.authorizedContext).compassContext!.recentRoute;
    expect(route.map(event => event.actor)).toEqual(Array(5).fill("explorer"));
    expect(route.map(event => event.awaitingReply)).toEqual([false, false, false, false, true]);
    const answered = s3State();
    const next = privateFixture({ ...answered, messages: [...answered.messages, {
      id: sx(601), role: "virtualGuide", body: "Let's turn to sleep.", createdAt: "2026-11-03T09:08:01.000Z",
    }] });
    expect(assembled((await next.build(next.input)).request.authorizedContext).compassContext!.recentRoute
      .every(event => event.awaitingReply === false)).toBe(true);
  });

  it("S4 distinguishes a saved Virtual Guide move without acknowledging it as an Explorer move", async () => {
    const history = s3State();
    const f = privateFixture({ ...history, route: history.route!.map((event, index, all) => index === all.length - 1 &&
      event.kind === "attention_changed" ? { ...event, actor: "virtual_guide" } : event) });
    const route = assembled((await f.build(f.input)).request.authorizedContext).compassContext!.recentRoute;
    expect(route.at(-1)).toMatchObject({ actor: "virtual_guide", awaitingReply: false });
    expect(route.every(event => event.awaitingReply === false)).toBe(true);
  });

  it.each([
    ["2026-11-03T09:08:00.000000+00:00", "2026-11-03T09:08:00.000001+00:00", true],
    ["2026-11-03T09:08:00.000001+00:00", "2026-11-03T09:08:00.000000+00:00", false],
    ["2026-11-03T09:08:00.000Z", "2026-11-03T09:08:00.000000+00:00", false],
  ] as const)("S4 compares reply %s and move %s with microsecond precision", async (replyAt, moveAt, awaitingReply) => {
    const history = s3State();
    const f = privateFixture({ ...history,
      messages: history.messages.map(message => message.role === "virtualGuide" ? { ...message, createdAt: replyAt } : message),
      route: history.route!.map((event, index, all) => index === all.length - 1 ? { ...event, recordedAt: moveAt } : event),
    });
    expect(assembled((await f.build(f.input)).request.authorizedContext).compassContext!.recentRoute.at(-1)?.awaitingReply)
      .toBe(awaitingReply);
  });

  it("S4 does not resurrect an older acknowledgment when the latest move is on a retired point", async () => {
    const history = s3State();
    const f = privateFixture({ ...history, route: [...history.route!, {
      operationId: sx(602), revision: 10, kind: "attention_changed", compassItemId: sx(403),
      label: "Work stress", recordedAt: "2026-11-03T09:09:00.000Z",
    }] });
    expect(assembled((await f.build(f.input)).request.authorizedContext).compassContext!.recentRoute
      .every(event => event.awaitingReply === false)).toBe(true);
  });

  it("S4 marks a first reply's latest Explorer move without sending stored choice labels into history", async () => {
    const history = s3State();
    const noReply = privateFixture({ ...history, messages: history.messages.filter(message => message.role === "explorer") });
    expect(assembled((await noReply.build(noReply.input)).request.authorizedContext).compassContext!.recentRoute.at(-1)?.awaitingReply)
      .toBe(true);
    const f = privateFixture({ ...history, messages: history.messages.map(message => message.role === "virtualGuide"
      ? { ...message, choices: [{ label: "Synthetic stored choice" }] } : message) });
    expect((await f.build(f.input)).request.authorizedContext).not.toContain("Synthetic stored choice");
  });

  it("S3 golden vector extended in S4: serializes actor and next-reply eligibility with exact sources", async () => {
    const f = privateFixture(s3State()); const result = await f.build(f.input);
    const serialized = result.request.authorizedContext;
    const context = assembled(serialized);
    expect(context.contractVersion).toBe("wi007-v0.1+onboarding-fields-v2+compass-v1");
    expect(JSON.stringify(context.compassContext)).toBe(GOLDEN);
    expect(serialized).toContain(`,"compassContext":${GOLDEN},"currentSessionMessages":`);
    expect(Object.keys(context)).toEqual(["contractVersion", "aiRole", "actorRoleContext", "globalPolicy", "roleBehavior",
      "crisisBehavior", "methodologyContext", "sessionContext", "approvedContinuity", "compassContext",
      "currentSessionMessages", "immediateExplorerMessage", "outputRequirements"]);
    expect(result.evidence.p_context_source_ids).toEqual([ids.messageId, authority().onboarding.responseId,
      f.config.methodologyContextPackVersionId, ...f.input.state.messages.map(message => message.id),
      sx(401), sx(402), sx(404), sx(421), sx(422), sx(423), sx(425)].sort());
    expect(result.request.contextFingerprint).toBe(createHash("sha256").update(serialized, "utf8").digest("hex").toUpperCase());
  });

  it("leaves out combined-away points, earlier Waypoint versions and needle moves on them", async () => {
    const f = privateFixture(s3State()); const result = await f.build(f.input);
    const serialized = result.request.authorizedContext;
    for (const absent of ["Work stress", sx(403), sx(424), "I read on five nights", sx(411), sx(431)]) {
      expect(serialized).not.toContain(absent);
    }
    expect(result.evidence.p_context_source_ids).not.toContain(sx(403));
    expect(result.evidence.p_context_source_ids).not.toContain(sx(424));
  });

  it("omits a needle move on a combined-away point inside the newest five and fills the window from the next older one", async () => {
    const history = s3State();
    const newestFive = history.route!.filter(event => event.kind === "attention_changed").slice(-5);
    expect(newestFive.map(event => "compassItemId" in event ? event.compassItemId : null)).toContain(sx(403));
    const f = privateFixture(history); const section = assembled((await f.build(f.input)).request.authorizedContext).compassContext!;
    // The oldest needle move (revision 2, on 404) is given only because the move on 403 is left out before the cap.
    expect(section.recentRoute.map(event => event.pointId)).toEqual([sx(404), sx(401), sx(402), sx(404), sx(402)]);
  });

  it("gives no Priority change in the recent Route, only needle moves", async () => {
    const history = s3State();
    expect(history.route!.filter(event => event.kind === "priority_confirmed" || event.kind === "priority_reoriented")).toHaveLength(2);
    const f = privateFixture(history); const serialized = (await f.build(f.input)).request.authorizedContext;
    expect(assembled(serialized).compassContext!.recentRoute.map(event => event.kind)).toEqual(Array(5).fill("attention_changed"));
    expect(serialized).not.toContain("priority_confirmed"); expect(serialized).not.toContain("priority_reoriented");
    const onlyPriority = privateFixture({ ...history, route: history.route!.filter(event => event.kind !== "attention_changed") });
    expect(assembled((await onlyPriority.build(onlyPriority.input)).request.authorizedContext).compassContext!.recentRoute).toEqual([]);
  });

  it("keeps the needle on an unplaced point and the stages formed, reached and released", async () => {
    const f = privateFixture(s3State()); const section = assembled((await f.build(f.input)).request.authorizedContext).compassContext!;
    expect(section.attentionId).toBe(sx(402));
    expect(section.points.find(point => point.id === section.attentionId)).toMatchObject({ anchor: null, emphasis: null });
    expect(section.waypoints.map(waypoint => [waypoint.id, waypoint.stage, waypoint.reachedEvidence])).toEqual([
      [sx(421), "formed", null], [sx(422), "reached", "I walked four evenings last week"],
      [sx(423), "released", null], [sx(425), "formed", null]]);
    expect(section.drafts).toEqual([]);
  });

  it("never gives arrangement or category Route events or their before-labels", async () => {
    const history = s3State();
    const withSnapshots: ExplorerConversationState = { ...history, route: [...history.route!,
      { operationId: sx(419), revision: 10, kind: "arrangement_confirmed", previousPriorityId: sx(404), priorityId: sx(401),
        items: [{ compassItemId: sx(401), anchor: "apex", emphasis: 3, label: "Arranged label snapshot" }], recordedAt: "2026-11-03T09:09:00.000Z" },
      { operationId: sx(420), revision: 11, kind: "category_confirmed", change: { targetItemId: sx(401), memberItemIds: [sx(401), sx(403)],
        beforeItems: [{ compassItemId: sx(401), sourceMessageId: history.messages[0].id, label: "Old money wording", mergedIntoItemId: null,
          anchor: "apex", emphasis: 3 }, { compassItemId: sx(403), sourceMessageId: history.messages[0].id, label: "Old work wording",
          mergedIntoItemId: null, anchor: "upper_left", emphasis: 2 }], label: "Money worries" }, recordedAt: "2026-11-03T09:10:00.000Z" }] };
    const f = privateFixture(withSnapshots); const serialized = (await f.build(f.input)).request.authorizedContext;
    expect(JSON.stringify(assembled(serialized).compassContext)).toBe(GOLDEN);
    for (const absent of ["Arranged label snapshot", "Old money wording", "Old work wording", "arrangement_confirmed", "category_confirmed"]) {
      expect(serialized).not.toContain(absent);
    }
  });

  it("after a real category rename, gives only the point's current label, never the wording a needle move captured", async () => {
    const history = s3State(); const source = history.messages[0].id;
    // The same rows as the rename block of supabase/tests/explorer_source_exclusion_test.sql: a needle move on 402
    // captured as "Sleep", then a confirmed category rename of 402 to "Evening rest".
    const renamed: ExplorerConversationState = { ...history, revision: 13,
      compassItems: history.compassItems.map(item => item.id === sx(402) ? { ...item, label: "Evening rest" } : item),
      route: [...history.route!,
        { operationId: sx(441), revision: 11, kind: "attention_changed", compassItemId: sx(402), label: "Sleep",
          recordedAt: "2026-11-03T13:00:00.000Z" },
        { operationId: sx(442), revision: 12, kind: "category_confirmed", change: { targetItemId: sx(402), memberItemIds: [sx(402)],
          beforeItems: [{ compassItemId: sx(402), sourceMessageId: source, label: "Sleep", mergedIntoItemId: null, anchor: null,
            emphasis: null }], label: "Evening rest" }, recordedAt: "2026-11-03T13:01:00.000Z" }] };
    expect(parseExplorerConversationState(renamed)).not.toBeNull();
    const f = privateFixture(renamed); const result = await f.build(f.input);
    const serialized = result.request.authorizedContext;
    expect(assembled(serialized).compassContext!.recentRoute).toEqual([
      { kind: "attention_changed", pointId: sx(401), label: "Money worries" },
      { kind: "attention_changed", pointId: sx(402), label: "Evening rest" },
      { kind: "attention_changed", pointId: sx(404), label: "Family" },
      { kind: "attention_changed", pointId: sx(402), label: "Evening rest" },
      { kind: "attention_changed", pointId: sx(402), label: "Evening rest" }]
      .map((event, index, all) => ({ ...event, actor: "explorer", awaitingReply: index === all.length - 1 })));
    expect(serialized).not.toContain("Sleep");
    // The dormant matcher, given the old wording as excluded content, inspects the context clear.
    expect(inspectExplorerContextExclusions({ serializedContext: serialized, includedSourceIds: result.evidence.p_context_source_ids,
      expectedBinding: { explorerId: authority().explorerId, sessionId: ids.conversationId, relationshipId: authority().relationshipId },
      manifest: { contractVersion: EXPLORER_CONTEXT_EXCLUSION_MATCHER_VERSION, explorerId: authority().explorerId,
        relationshipId: authority().relationshipId, entries: [{ entityType: "private_note", entityId: uuid(901),
          normalizedContentSha256: createHash("sha256").update("Sleep").digest("hex").toUpperCase() }] } })).toEqual({ status: "clear" });
  });

  it("gives only the last five needle moves, oldest first, each with its point's current label", async () => {
    const history = s3State();
    const cycle = [sx(402), sx(404), sx(401)];
    const many: ExplorerConversationState = { ...history, route: Array.from({ length: 9 }, (_, index) => ({ operationId: sx(500 + index),
      revision: index + 2, kind: "attention_changed" as const, compassItemId: cycle[index % 3],
      label: `Captured wording ${index}`, recordedAt: "2026-11-03T09:00:00.000Z" })) };
    const f = privateFixture(many);
    const section = assembled((await f.build(f.input)).request.authorizedContext).compassContext!;
    expect(section.recentRoute.map(event => event.pointId)).toEqual([sx(404), sx(401), sx(402), sx(404), sx(401)]);
    expect(section.recentRoute.map(event => event.label)).toEqual(["Family", "Money worries", "Sleep", "Family", "Money worries"]);
  });

  it("the governed private entry carries the same section and source ids", async () => {
    const f = governedFixture({ history: s3State() });
    (f.row.authority_context as ReturnType<typeof authority>).authorizationVersion = `AV3:${"B".repeat(64)}`;
    const result = await createPrivateGovernedExplorerConversationContextBuilder(f.factoryInput)({ ...f.input, mode: "classification_and_reply" });
    expect(JSON.stringify(assembled(result.request.authorizedContext).compassContext)).toBe(GOLDEN);
    expect(result.evidence.p_context_source_ids).toEqual(expect.arrayContaining([sx(401), sx(402), sx(404), sx(421), sx(422), sx(423), sx(425)]));
    // Immediate message, intake, methodology version and two saved messages, then the seven Compass records.
    expect(result.evidence.p_context_source_ids).toHaveLength(5 + 7);
  });

  it("the older AV2 entries stay byte-for-byte unchanged: no section, the earlier revision, no Compass sources", async () => {
    const f = fixture({ history: s3State() }); const result = await f.build(f.input);
    const context = assembled(result.request.authorizedContext);
    expect(context.contractVersion).toBe(EXPLORER_CONVERSATION_CONTEXT_SELECTION_VERSION);
    expect(Object.hasOwn(context, "compassContext")).toBe(false);
    expect(result.request.authorizedContext).not.toContain("Money worries");
    expect(result.evidence.p_context_source_ids).toEqual([ids.messageId, authority().onboarding.responseId,
      f.config.methodologyContextPackVersionId, ...f.input.state.messages.map(message => message.id)].sort());
  });
});

describe("Private AV3 classification-only context scope", () => {
  const knownPolicy = { status: "known", restrictedLevel: null, adultReflectionStopped: false, safetyVersion: 1 } as const;
  const clearFallback = { status: "available", policyVersion: "synthetic-fallback-v1",
    classification: { level: 0, minorIndicated: false } } as const;
  const causes: ReadonlyArray<Readonly<{
    name: string; policy: ExplorerConversationPolicy; fallback: ExplorerFallbackObservation;
  }>> = [
    { name: "existing restricted level 3", policy: { ...knownPolicy, restrictedLevel: 3 }, fallback: clearFallback },
    { name: "existing restricted level 4", policy: { ...knownPolicy, restrictedLevel: 4 }, fallback: clearFallback },
    { name: "existing adult-reflection stop", policy: { ...knownPolicy, adultReflectionStopped: true }, fallback: clearFallback },
    { name: "current fallback level 3", policy: knownPolicy,
      fallback: { ...clearFallback, classification: { level: 3, minorIndicated: false } } },
    { name: "current fallback level 4", policy: knownPolicy,
      fallback: { ...clearFallback, classification: { level: 4, minorIndicated: false } } },
    { name: "current fallback minor indication", policy: knownPolicy,
      fallback: { ...clearFallback, classification: { level: 0, minorIndicated: true } } },
  ];

  function scopedFixture(governed: boolean, history = s3State()) {
    const f = governedFixture({ facts: { ...authority(), authorizationVersion: `AV3:${"B".repeat(64)}` }, history });
    const build = governed ? createPrivateGovernedExplorerConversationContextBuilder(f.factoryInput)
      : createPrivateExplorerConversationContextBuilder({ repository: { read: f.read }, configuration: f.config });
    const legacy = governed ? governedFixture({ history }) : fixture({ history });
    return { ...f, build, legacy };
  }

  describe.each([false, true])("governed=%s", (governed) => {
    it.each(causes)("omits populated saved Compass and Waypoints for $name before exact fingerprinting", async ({ policy, fallback }) => {
      const f = scopedFixture(governed);
      const mode = selectExplorerSafetyRequestMode(policy, fallback);
      expect(mode).toBe("classification_only");
      if (mode === null) throw new Error("unexpected_unknown_mode");
      const result = await f.build({ ...f.input, mode });
      const legacy = await f.legacy.build(f.legacy.input);
      const serialized = result.request.authorizedContext;
      const context = assembled(serialized);
      expect(context.contractVersion).toBe(EXPLORER_CONVERSATION_CONTEXT_SELECTION_VERSION);
      expect(Object.hasOwn(context, "compassContext")).toBe(false);
      expect(serialized).toBe(legacy.request.authorizedContext);
      expect(result.evidence.p_context_source_ids).toEqual(legacy.evidence.p_context_source_ids);
      for (const id of [...f.input.state.compassItems, ...f.input.state.waypoints].map(item => item.id)) {
        expect(serialized).not.toContain(id);
        expect(result.evidence.p_context_source_ids).not.toContain(id);
      }
      for (const text of ["Money worries", "Sleep", "Family", "Find a calmer morning", "Mornings set", "I walked four evenings last week"]) {
        expect(serialized).not.toContain(text);
      }
      expect(result.request.contextFingerprint).toBe(createHash("sha256").update(serialized, "utf8").digest("hex").toUpperCase());
      expect(result.request.contextFingerprint).toBe(legacy.request.contextFingerprint);
      expect(f.read).toHaveBeenCalledOnce();
      expect(f.methodologyRead).toHaveBeenCalledTimes(governed ? 2 : 0);
      expect(f.prepare).not.toHaveBeenCalled(); expect(f.complete).not.toHaveBeenCalled();
    });

    it("keeps ordinary golden bytes and exact source ids unchanged while each mode hashes only its own envelope", async () => {
      const f = scopedFixture(governed);
      const ordinary = await f.build({ ...f.input, mode: "classification_and_reply" });
      const reduced = await f.build({ ...f.input, mode: "classification_only" });
      const legacy = await f.legacy.build(f.legacy.input);
      const expected = legacy.request.authorizedContext
        .replace(`"contractVersion":"${EXPLORER_CONVERSATION_CONTEXT_SELECTION_VERSION}"`,
          `"contractVersion":"${EXPLORER_PRIVATE_CONVERSATION_CONTEXT_SELECTION_VERSION}"`)
        .replace(',"currentSessionMessages":', `,"compassContext":${GOLDEN},"currentSessionMessages":`);
      expect(ordinary.request.authorizedContext).toBe(expected);
      expect(ordinary.request.contextFingerprint).toBe(createHash("sha256").update(expected, "utf8").digest("hex").toUpperCase());
      expect(ordinary.evidence.p_context_source_ids).toEqual([
        ...(legacy.evidence.p_context_source_ids as string[]), sx(401), sx(402), sx(404), sx(421), sx(422), sx(423), sx(425),
      ].sort());
      expect(reduced.request.authorizedContext).toBe(legacy.request.authorizedContext);
      expect(reduced.request.contextFingerprint).toBe(legacy.request.contextFingerprint);
      expect(reduced.request.contextFingerprint).not.toBe(ordinary.request.contextFingerprint);
    });

    it.each([undefined, null, "reply_only", "classification_only ", {}, 0])("rejects malformed or absent mode %j before source reads", async (mode) => {
      const f = scopedFixture(governed);
      await expect(f.build({ ...f.input, mode } as Parameters<PrivateExplorerConversationContextBuilder>[0]))
        .rejects.toThrow("explorer_conversation_context_unavailable");
      expect(f.read).not.toHaveBeenCalled(); expect(f.methodologyRead).not.toHaveBeenCalled();
    });

    it("never assembles excluded Compass text, while ordinary mode still enforces its text checks", async () => {
      const history = s3State();
      const f = scopedFixture(governed, { ...history,
        compassItems: history.compassItems.map(item => ({ ...item, label: `${item.label}\tinvalid` })) });
      const reduced = await f.build({ ...f.input, mode: "classification_only" });
      expect(reduced.request.authorizedContext).toBe((await f.legacy.build(f.legacy.input)).request.authorizedContext);
      await expect(f.build({ ...f.input, mode: "classification_and_reply" })).rejects.toThrow();
    });

    it.each(["classification_only", "classification_and_reply"] as const)("preserves caller cancellation in %s mode", async (mode) => {
      const f = scopedFixture(governed); const cancellation = new AbortController(); cancellation.abort();
      await expect(f.build({ ...f.input, mode, signal: cancellation.signal })).rejects.toThrow("explorer_conversation_context_unavailable");
      expect(f.read).not.toHaveBeenCalled(); expect(f.methodologyRead).not.toHaveBeenCalled();
    });
  });
});
