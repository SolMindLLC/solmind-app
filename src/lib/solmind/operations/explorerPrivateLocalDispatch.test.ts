// Synthetic ports only: these cases prove preflight mechanics, not SQL/auth/model operation.
import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { withExplorerPrivateLocalDispatch } from "./explorerPrivateLocalDispatch";
import { deriveExplorerPrivateTurnIds } from "../virtual-guide/explorerPrivateConversationComposition";
import { getExplorerPrivateConfigurationCandidate } from "../virtual-guide/explorerPrivateConfiguration";
import { bindMethodologySafetyScreenSubject } from "../virtual-guide/methodologySafetyScreenContract";
import type { ExplorerPrivateConversationDependencies } from "../virtual-guide/explorerPrivateConversationComposition";
import type { ExplorerPrivateLocalRun } from "./explorerPrivateLocalRunProfile";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SHA = "A".repeat(64), AV3 = "AV3:" + SHA, MV1 = "MV1:" + SHA;
type Build = NonNullable<ExplorerPrivateConversationDependencies["buildContext"]>;
function fixture() {
  const actor = { accountId: uuid(1), applicationSessionId: uuid(2) };
  const command = { kind: "send" as const, operationId: uuid(3), expectedRevision: 0, body: "A simple synthetic reflection." };
  const ids = deriveExplorerPrivateTurnIds(actor, uuid(4), command.operationId);
  const configuration = getExplorerPrivateConfigurationCandidate()!;
  const content = "Synthetic methodology for a bounded unit fixture.";
  const subject = bindMethodologySafetyScreenSubject({ methodologyContextPackVersionId: uuid(8), content });
  const profile = { version: "explorer-private-local-run.v1" as const, runId: uuid(9),
    expiresAt: new Date(Date.now() + 60_000).toISOString(), appOrigin: "http://127.0.0.1:4186", supabaseOrigin: "http://127.0.0.1:55431",
    actorAccountId: actor.accountId, explorerId: uuid(5), guideId: uuid(6), packId: uuid(7), methodologyVersionId: uuid(8),
    methodologyContentSha256: subject.subjectSha256, methodologyAuthorizationVersion: MV1,
    explorerMessageSha256: createHash("sha256").update(command.body).digest("hex").toUpperCase(),
    modelPolicyVersion: "synthetic-model", resourcePolicyVersion: "synthetic-resource",
    receipts: Object.fromEntries(["policy", "source", "resources", "renderer", "signal", "provider", "target"].map(key => [key, { file: key + ".json", sha256: SHA }])) as ExplorerPrivateLocalRun["profile"]["receipts"] };
  let claimed = false;
  const claim = vi.fn(() => { if (claimed) throw new Error("synthetic_already_claimed"); claimed = true; });
  const run: ExplorerPrivateLocalRun = { profile, directory: "synthetic-unused-directory", adultResources: "Synthetic resource.",
    ageAppropriateResources: "Synthetic resource.", failureAssistance: { support: "Synthetic.", adultPolicy: "Synthetic.",
      supportAndAdultPolicy: "Synthetic.", temporarilyUnavailable: "Synthetic." }, available: () => !claimed, claim };
  const policy = { contractVersion: "explorer-conversation-safety.v1", known: true, version: 1, restrictedLevel: null, adultReflectionStopped: false };
  const initial = { version: "explorer-conversation.v1" as const, conversationId: ids.conversationId,
    revision: 0, pendingTurn: false, providerState: "available" as const, messages: [], compassItems: [], priorityId: null, attentionId: null, waypoints: [] };
  const authority = { accountId: actor.accountId, applicationSessionId: actor.applicationSessionId, explorerId: profile.explorerId,
    guideId: profile.guideId, authorizationVersion: AV3, applicationSessionExpiresAt: profile.expiresAt };
  const row = { outcome: "ok", authority_context: authority, policy_state: policy,
    conversation_state: { ...initial, revision: 1, pendingTurn: true,
      messages: [{ id: ids.messageId, role: "explorer", body: command.body, createdAt: new Date().toISOString() }] } };
  const serialized = JSON.stringify({ immediateExplorerMessage: { content: command.body } });
  const request = { contractVersion: "explorer-safety-request.v2" as const, invocationId: ids.invocationId, explorerId: profile.explorerId,
    sessionId: ids.conversationId, contextSnapshotId: ids.snapshotId, authorizedContext: serialized,
    contextFingerprint: createHash("sha256").update(serialized).digest("hex").toUpperCase(), mode: "classification_and_reply" as const,
    classificationPolicyVersion: profile.modelPolicyVersion, fallbackPolicyVersion: "synthetic-fallback", instructionVersion: "synthetic-instructions" };
  const evidence = { p_authorization_version: AV3, p_context_source_ids: [ids.messageId], p_intake_response_set_id: uuid(10),
    p_prompt_version: "synthetic-prompt", p_policy_version: "synthetic-policy", p_behavior_version: "synthetic-role",
    p_crisis_version: "synthetic-crisis", p_role_version: "synthetic-role", p_instruction_version: request.instructionVersion };
  const readiness = { configuration, configurationFingerprint: SHA, modelPolicyVersion: profile.modelPolicyVersion,
    resourcePolicyVersion: profile.resourcePolicyVersion, sourceVerificationReceiptSha256: SHA, resourceVerificationReceiptSha256: SHA,
    rendererVerificationReceiptSha256: SHA, signalVerificationReceiptSha256: SHA,
    methodology: { packId: profile.packId, versionId: profile.methodologyVersionId, contentSha256: subject.subjectSha256, authorizationVersion: MV1 } };
  const caller = new AbortController();
  const args: Parameters<Build>[0] = { actor, row: { ...row, conversation_state: initial }, state: initial, command, ids, readiness, mode: request.mode, signal: caller.signal };
  const buildContext = vi.fn<Build>(async () => ({ request, evidence }));
  const authenticate = vi.fn(async () => actor);
  const read = vi.fn(async () => row);
  const repository = { read, ensure: vi.fn(), observe: vi.fn(), prepare: vi.fn(), settle: vi.fn() };
  const selection = { packId: profile.packId, scopeType: "guide" as const, scopeId: profile.guideId, versionId: profile.methodologyVersionId,
    versionNumber: 1, contentMarkdown: content, contentSha256: subject.subjectSha256, methodologyAuthorizationVersion: MV1 };
  const methodologySource = { read: vi.fn(async () => selection) };
  const generate = vi.fn(async () => "synthetic-model-result");
  const credentialReady = vi.fn(() => true);
  const bound = withExplorerPrivateLocalDispatch({ run, authenticate, repository, methodologySource, buildContext, credentialReady, generate });
  return { actor, args, request, row, selection, caller, profile, claim, authenticate, read, methodologySource, credentialReady, generate, bound };
}
async function prepared() { const f = fixture(); await f.bound.buildContext(f.args); return f; }
describe("finite local dispatch authority", () => {
  it("forwards once after actual preflight ports; a duplicate attempt never reaches transport", async () => {
    const f = await prepared(); expect(await f.bound.provider.generate(f.request, f.caller.signal)).toBe("synthetic-model-result");
    await expect(f.bound.provider.generate(f.request, f.caller.signal)).rejects.toThrow();
    expect(f.read).toHaveBeenCalledTimes(2); expect(f.claim).toHaveBeenCalledTimes(1); expect(f.generate).toHaveBeenCalledTimes(1);
  });
  it("refuses a missing or malformed key after the final authenticated read without claiming or generating", async () => {
    const f = await prepared(); f.credentialReady.mockImplementation(() => {
      expect(f.read).toHaveBeenCalledTimes(2);
      return false;
    });
    await expect(f.bound.provider.generate(f.request, f.caller.signal)).rejects.toThrow("explorer_private_local_dispatch_unavailable");
    expect(f.credentialReady).toHaveBeenCalledOnce();
    expect(f.claim).not.toHaveBeenCalled(); expect(f.generate).not.toHaveBeenCalled();
  });
  it.each(["actor", "authority", "policy", "pending", "message", "methodology", "last-read"])("refuses %s drift with zero transport", async kind => {
    const f = await prepared();
    if (kind === "actor") f.authenticate.mockResolvedValue({ ...f.actor, applicationSessionId: uuid(99) });
    if (kind === "authority") f.read.mockResolvedValue({ ...f.row, authority_context: { ...f.row.authority_context, authorizationVersion: "AV3:" + "B".repeat(64) } });
    if (kind === "policy") f.read.mockResolvedValue({ ...f.row, policy_state: { ...f.row.policy_state, known: false } });
    if (kind === "pending") f.read.mockResolvedValue({ ...f.row, conversation_state: { ...f.row.conversation_state, pendingTurn: false } });
    if (kind === "message") f.read.mockResolvedValue({ ...f.row, conversation_state: { ...f.row.conversation_state, messages: [] } });
    if (kind === "methodology") f.methodologySource.read.mockResolvedValue({ ...f.selection, methodologyAuthorizationVersion: "MV1:" + "B".repeat(64) });
    if (kind === "last-read") f.read.mockResolvedValueOnce(f.row).mockResolvedValueOnce({ ...f.row, policy_state: { ...f.row.policy_state, version: 2 } });
    await expect(f.bound.provider.generate(f.request, f.caller.signal)).rejects.toThrow();
    expect(f.claim).not.toHaveBeenCalled(); expect(f.generate).not.toHaveBeenCalled();
  });
  it("refuses cancellation during awaited methodology and expiry before transport", async () => {
    const f = await prepared(); f.methodologySource.read.mockImplementation(async () => { f.caller.abort(); return f.selection; });
    await expect(f.bound.provider.generate(f.request, f.caller.signal)).rejects.toThrow(); expect(f.generate).not.toHaveBeenCalled();
    const g = await prepared(); g.read.mockResolvedValue({ ...g.row, authority_context: { ...g.row.authority_context, applicationSessionExpiresAt: "2000-01-01T00:00:00.000Z" } });
    await expect(g.bound.provider.generate(g.request, g.caller.signal)).rejects.toThrow(); expect(g.claim).not.toHaveBeenCalled();
  });
  it("does not accept a caller-swapped prepared identity or run two concurrent transports", async () => {
    const f = await prepared();
    await expect(f.bound.provider.generate({ ...f.request, contextSnapshotId: uuid(99) }, f.caller.signal)).rejects.toThrow();
    const outcomes = await Promise.allSettled([f.bound.provider.generate(f.request, f.caller.signal), f.bound.provider.generate(f.request, f.caller.signal)]);
    expect(outcomes.filter(x => x.status === "fulfilled")).toHaveLength(1); expect(f.generate).toHaveBeenCalledTimes(1);
  });
});
