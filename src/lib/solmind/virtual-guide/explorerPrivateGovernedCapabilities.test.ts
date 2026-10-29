import { describe, expect, it, vi } from "vitest";
import { createExplorerPrivateGovernedCapabilities } from "./explorerPrivateGovernedCapabilities";
import { getExplorerPrivateConfigurationCandidate } from "./explorerPrivateConfiguration";
import { bindMethodologySafetyScreenSubject } from "./methodologySafetyScreenContract";
import type { EffectiveMethodologySelection, EffectiveMethodologySource } from "./effectiveMethodologyContext";
import type { ExplorerPrivateConversationDependencies, ExplorerPrivateReadRow } from "./explorerPrivateConversationComposition";

// The retained pinned methodology bytes are exercised with SYNTHETIC source,
// IDs, MV1 labels, receipts and authority. This is no genuine SQL governance,
// human approval, provider execution or operational activation evidence.
const METHODOLOGY = [
  "Favor reflection over prescription, orientation over control, awareness over certainty, collaboration over authority, and presence over engagement optimization. Help the Explorer notice their own emotions, values, assumptions, relationships and possibilities without imposing an identity, worldview or interpretation. Understanding develops collaboratively and remains open to correction.",
  "Build trust through low-pressure invitations and gradual pacing. Make room for silence, pauses, redirection, disagreement and uncertainty. Match the Explorer's willingness to explore; emotional safety and agency take priority over depth or conversational efficiency. Use tentative reflection and explicit confirmation rather than interpreting participation as consent, agreement or readiness for greater vulnerability.",
  "Support thoughtful connection with life and human relationships. Avoid superiority, dependency, manipulative certainty, fear, shame, ideological rigidity and emotionally coercive urgency. The Explorer remains free to accept, change or reject a reflective suggestion. No AI, Guide or methodology possesses complete understanding of another human.",
  "This methodology is subordinate guidance. It cannot change global safety policy, AI identity disclosure, Virtual Guide role limits, crisis behavior, refusal boundaries, privacy, authorized context, output rules or the Explorer's control of sharing. It does not confer access, initiate communication, establish approval, or authorize any application effect.",
].join("\n\n");
const uuid = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const PACK = uuid(1), VERSION = uuid(2), GUIDE = uuid(3);
const ACTOR = Object.freeze({ accountId: uuid(4), applicationSessionId: uuid(5) });
const EXPECTED_SCOPE = Object.freeze({ type: "guide" as const, id: GUIDE });
const SHA = "A".repeat(64);
const STATE = Object.freeze({ version: "explorer-conversation.v1" as const, conversationId: uuid(6),
  revision: 0, pendingTurn: false, providerState: "unavailable" as const,
  messages: [], compassItems: [], priorityId: null, attentionId: null, waypoints: [] });
function fixture() {
  const configuration = getExplorerPrivateConfigurationCandidate();
  if (!configuration) throw new Error("synthetic_configuration_missing");
  const subject = bindMethodologySafetyScreenSubject({ methodologyContextPackVersionId: VERSION, content: METHODOLOGY });
  const selection: EffectiveMethodologySelection = { packId: PACK, scopeType: "guide", scopeId: GUIDE,
    versionId: VERSION, versionNumber: 1, contentMarkdown: METHODOLOGY, contentSha256: subject.subjectSha256,
    methodologyAuthorizationVersion: "MV1:" + SHA };
  const source = { read: vi.fn<EffectiveMethodologySource["read"]>(async () => selection) };
  const authority = { accountId: ACTOR.accountId, applicationSessionId: ACTOR.applicationSessionId,
    explorerId: uuid(7), relationshipId: uuid(8), guideId: GUIDE, practiceId: uuid(9), organizationId: uuid(10),
    applicationSessionExpiresAt: "2100-01-01T00:00:00.000Z", relationshipStatus: "active", onboardingStatus: "active",
    adultAffirmation: true, authorizationVersion: "AV3:" + SHA,
    onboarding: { responseId: uuid(11), answers: {
      supportNow: "Synthetic wish for a quieter morning.", usefulOutcome: "Synthetic reflective next step.",
      supportStyle: "Synthetic gentle pacing.", guideContext: "Synthetic preference to start with my words.",
      communicationPreference: "Synthetic brief replies.", doNotEmphasize: "Synthetic avoidance of productivity framing.",
    } }, requiredConsentDocumentIds: [uuid(12)] };
  const row: ExplorerPrivateReadRow = { outcome: "ok", conversation_state: STATE, authority_context: authority };
  const read = vi.fn(async () => row);
  const write = vi.fn(async () => { throw new Error("unexpected_synthetic_mutation"); });
  const repository = { read, ensure: write, observe: write, prepare: write, settle: write, mutate: write };
  const provider = { generate: vi.fn(async () => "Synthetic never-requested model response.") };
  const renderer: NonNullable<ExplorerPrivateConversationDependencies["renderer"]> = {
    verificationReceiptSha256: "B".repeat(64), failureAssistance: { support: "Synthetic support.", adultPolicy: "Synthetic adult boundary.",
      supportAndAdultPolicy: "Synthetic support and boundary.", temporarilyUnavailable: "Synthetic unavailable." },
    render: vi.fn(async () => ({ kind: "urgent" as const, body: "Synthetic trusted rendering.",
      trustedResponseVersion: configuration.trustedResponses.version, resourcePolicyVersion: "synthetic-resources.v1" })),
  };
  const operationalSignal = { verificationReceiptSha256: "C".repeat(64), emit: vi.fn(async () => undefined) };
  const input = { repository, methodologySource: source, packId: PACK, expectedScope: EXPECTED_SCOPE, configuration,
    acceptanceReceiptSha256: "D".repeat(64), sourceVerificationReceiptSha256: "E".repeat(64),
    resourceVerificationReceiptSha256: "F".repeat(64), modelPolicyVersion: "synthetic-model.v1", modelName: "gpt-5.6-luna",
    resourcePolicyVersion: "synthetic-resources.v1", provider, renderer, operationalSignal };
  const capabilities = createExplorerPrivateGovernedCapabilities(input);
  return { input, capabilities, configuration, selection, source, authority, row, read, write, provider, renderer, operationalSignal };
}

describe("explicit private governed capability composition with synthetic provenance", () => {
  it("creates only five explicit ports and resolves actual selected identities rather than inventing a pack/version", async () => {
    const f = fixture();
    expect(f.source.read).not.toHaveBeenCalled();
    expect(Object.keys(f.capabilities).sort()).toEqual(["buildContext", "operationalSignal", "provider", "renderer", "resolveOperationalReadiness"]);
    expect(Object.isFrozen(f.capabilities)).toBe(true);
    const ready = await f.capabilities.resolveOperationalReadiness(ACTOR, f.row);
    expect(f.selection.contentSha256).toBe(f.configuration.methodologySubjectSha256);
    expect(ready?.methodology).toEqual({ packId: PACK, versionId: VERSION,
      contentSha256: f.selection.contentSha256, authorizationVersion: f.selection.methodologyAuthorizationVersion });
    expect(ready?.configurationFingerprint).toMatch(/^[0-9A-F]{64}$/);
    expect(f.source.read).toHaveBeenCalledExactlyOnceWith({ actor: ACTOR, packId: PACK, expectedScope: EXPECTED_SCOPE });
    expect(f.capabilities.provider.generate).toBe(f.provider.generate); expect(f.capabilities.renderer.render).toBe(f.renderer.render);
    expect(f.capabilities.operationalSignal.emit).toBe(f.operationalSignal.emit);
    expect(f.read).not.toHaveBeenCalled(); expect(f.write).not.toHaveBeenCalled(); expect(f.provider.generate).not.toHaveBeenCalled();
  });

  it("requeries on each readiness request and binds the newly selected version and MV1", async () => {
    const f = fixture(); const first = await f.capabilities.resolveOperationalReadiness(ACTOR, f.row);
    const changed = { ...f.selection, versionId: uuid(20), versionNumber: 2, methodologyAuthorizationVersion: "MV1:" + "1".repeat(64) };
    f.source.read.mockResolvedValueOnce(changed);
    const second = await f.capabilities.resolveOperationalReadiness(ACTOR, f.row);
    expect(first?.methodology.versionId).toBe(VERSION); expect(second?.methodology.versionId).toBe(changed.versionId);
    expect(second?.methodology.authorizationVersion).toBe(changed.methodologyAuthorizationVersion);
    expect(f.source.read).toHaveBeenCalledTimes(2);
    expect(Object.isFrozen(second)).toBe(true); expect(Object.isFrozen(second?.methodology)).toBe(true);
    expect(f.provider.generate).not.toHaveBeenCalled(); expect(f.write).not.toHaveBeenCalled();
  });

  it("pins supplied receipt values and port functions despite later caller mutation", async () => {
    const f = fixture(); const first = await f.capabilities.resolveOperationalReadiness(ACTOR, f.row);
    const originalGenerate = f.provider.generate; const originalEmit = f.operationalSignal.emit;
    f.operationalSignal.verificationReceiptSha256 = "7".repeat(64);
    f.operationalSignal.emit = vi.fn(async () => undefined);
    f.provider.generate = vi.fn(async () => "Changed synthetic provider.");
    const second = await f.capabilities.resolveOperationalReadiness(ACTOR, f.row);
    expect(second?.configurationFingerprint).toBe(first?.configurationFingerprint);
    expect(second?.signalVerificationReceiptSha256).toBe("C".repeat(64));
    expect(f.capabilities.operationalSignal.verificationReceiptSha256).toBe("C".repeat(64));
    expect(f.capabilities.operationalSignal.emit).toBe(originalEmit);
    expect(f.capabilities.provider.generate).toBe(originalGenerate);
  });

  it.each(["different-content", "wrong-scope", "source-failure"] as const)("holds readiness on %s without provider or mutation", async condition => {
    const f = fixture();
    if (condition === "different-content") {
      const content = "Different explicitly synthetic methodology bytes.";
      const bound = bindMethodologySafetyScreenSubject({ methodologyContextPackVersionId: VERSION, content });
      f.source.read.mockResolvedValueOnce({ ...f.selection, contentMarkdown: content, contentSha256: bound.subjectSha256 });
    } else if (condition === "wrong-scope") f.source.read.mockResolvedValueOnce({ ...f.selection, scopeId: uuid(30) });
    else f.source.read.mockRejectedValueOnce(new Error("synthetic_private_source_detail"));
    expect(await f.capabilities.resolveOperationalReadiness(ACTOR, f.row)).toBeNull();
    expect(f.source.read).toHaveBeenCalledOnce(); expect(f.provider.generate).not.toHaveBeenCalled(); expect(f.write).not.toHaveBeenCalled();
  });

  it("uses the actual AV3 governed builder and preserves selected methodology/context evidence", async () => {
    const f = fixture(); const readiness = await f.capabilities.resolveOperationalReadiness(ACTOR, f.row);
    if (!readiness) throw new Error("synthetic_readiness_missing");
    const ids = { conversationId: STATE.conversationId, logicalOperationId: uuid(40), messageId: uuid(41),
      snapshotId: uuid(42), invocationId: uuid(43), replyId: uuid(44) };
    const context = await f.capabilities.buildContext({ actor: ACTOR, row: f.row, state: STATE,
      command: { kind: "send", operationId: uuid(45), expectedRevision: 0, body: "One synthetic reflective question." },
      ids, readiness, mode: "classification_and_reply", signal: new AbortController().signal });
    expect(context.request.contractVersion).toBe("explorer-safety-request.v2");
    expect(context.request.invocationId).toBe(ids.invocationId); expect(context.request.explorerId).toBe(f.authority.explorerId);
    expect((JSON.parse(context.request.authorizedContext) as { methodologyContext: { text: string } }).methodologyContext.text).toBe(METHODOLOGY);
    expect(context.evidence.p_authorization_version).toBe("AV3:" + SHA);
    expect(context.evidence.p_context_source_ids).toContain(VERSION);
    expect(f.source.read).toHaveBeenCalledTimes(3); expect(f.read).toHaveBeenCalledOnce();
    expect(f.provider.generate).not.toHaveBeenCalled(); expect(f.write).not.toHaveBeenCalled();
    expect(f.renderer.render).not.toHaveBeenCalled(); expect(f.operationalSignal.emit).not.toHaveBeenCalled();
  });

  it("rejects predecessor AV2 authority through the actual builder rather than widening its contract", async () => {
    const f = fixture(); const readiness = await f.capabilities.resolveOperationalReadiness(ACTOR, f.row);
    if (!readiness) throw new Error("synthetic_readiness_missing");
    await expect(f.capabilities.buildContext({ actor: ACTOR,
      row: { ...f.row, authority_context: { ...f.authority, authorizationVersion: "AV2:" + SHA } }, state: STATE,
      command: { kind: "send", operationId: uuid(45), expectedRevision: 0, body: "Synthetic held question." },
      ids: { conversationId: STATE.conversationId, logicalOperationId: uuid(40), messageId: uuid(41), snapshotId: uuid(42), invocationId: uuid(43), replyId: uuid(44) },
      readiness, mode: "classification_and_reply" })).rejects.toThrow();
    expect(f.source.read).toHaveBeenCalledOnce(); expect(f.read).not.toHaveBeenCalled();
    expect(f.provider.generate).not.toHaveBeenCalled(); expect(f.write).not.toHaveBeenCalled();
  });

  it("requires a shaped acceptance binding and changes its fingerprint when that binding changes", async () => {
    const f = fixture();
    expect(() => createExplorerPrivateGovernedCapabilities({ ...f.input, acceptanceReceiptSha256: "not-an-acceptance-receipt" }))
      .toThrow("explorer_private_governed_capabilities_unavailable");
    const other = createExplorerPrivateGovernedCapabilities({ ...f.input, acceptanceReceiptSha256: "9".repeat(64) });
    const first = await f.capabilities.resolveOperationalReadiness(ACTOR, f.row);
    const second = await other.resolveOperationalReadiness(ACTOR, f.row);
    expect(first?.configurationFingerprint).not.toBe(second?.configurationFingerprint);
    const selected = createExplorerPrivateGovernedCapabilities({ ...f.input, modelName: "synthetic-compatible-model" });
    const third = await selected.resolveOperationalReadiness(ACTOR, f.row);
    expect(third?.configurationFingerprint).toMatch(/^[A-F0-9]{64}$/);
    expect(third?.configurationFingerprint).not.toBe(first?.configurationFingerprint);
    // A changed synthetic label is a changed binding, never proof of real acceptance.
    expect(f.provider.generate).not.toHaveBeenCalled(); expect(f.write).not.toHaveBeenCalled();
  });
});
