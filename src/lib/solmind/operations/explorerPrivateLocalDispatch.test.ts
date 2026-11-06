// Synthetic ports only: these cases prove preflight mechanics, not SQL/auth/model operation.
import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { withExplorerPrivateLocalDispatch } from "./explorerPrivateLocalDispatch";
import { deriveExplorerPrivateTurnIds } from "../virtual-guide/explorerPrivateConversationComposition";
import { getExplorerPrivateConfigurationCandidate } from "../virtual-guide/explorerPrivateConfiguration";
import { bindMethodologySafetyScreenSubject } from "../virtual-guide/methodologySafetyScreenContract";
import type { ExplorerPrivateConversationDependencies } from "../virtual-guide/explorerPrivateConversationComposition";
import type { ExplorerPrivateLocalRun } from "./explorerPrivateLocalRunProfile";
import { explorerPrivateLocalLedgerDay } from "./explorerPrivateLocalCallLedger";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SHA = "A".repeat(64), AV3 = "AV3:" + SHA, MV1 = "MV1:" + SHA;
type Build = NonNullable<ExplorerPrivateConversationDependencies["buildContext"]>;
const MODE_CASES = [
  { cause: "ordinary", options: {} },
  { cause: "restricted", options: { restricted: true } },
  { cause: "adult stop", options: { adultStopped: true } },
] as const;
// A synthetic stand-in for the shared daily ledger; several bound requests may share one.
function fakeLedger(limit: number) {
  let reserved = 0;
  const day = () => explorerPrivateLocalLedgerDay(Date.now());
  const take = () => {
    if (reserved >= limit) throw new Error("synthetic_allowance_used");
    reserved += 1; return { day: day(), slot: reserved, limit };
  };
  const reserve = vi.fn(take);
  return { reserve, take, used: () => reserved, available: () => reserved < limit,
    usage: () => ({ day: day(), reserved, limit }), limit };
}
function fixture(options: { body?: string; ledger?: ReturnType<typeof fakeLedger>; restricted?: boolean; adultStopped?: boolean } = {}) {
  const actor = { accountId: uuid(1), applicationSessionId: uuid(2) };
  const command = { kind: "send" as const, operationId: uuid(3), expectedRevision: 0, body: options.body ?? "A simple synthetic reflection." };
  const ids = deriveExplorerPrivateTurnIds(actor, uuid(4), command.operationId);
  const configuration = getExplorerPrivateConfigurationCandidate()!;
  const content = "Synthetic methodology for a bounded unit fixture.";
  const subject = bindMethodologySafetyScreenSubject({ methodologyContextPackVersionId: uuid(8), content });
  const profile = { version: "explorer-private-local-run.v2" as const, runId: uuid(9),
    expiresAt: new Date(Date.now() + 60_000).toISOString(), appOrigin: "http://127.0.0.1:4186", supabaseOrigin: "http://127.0.0.1:55431",
    actorAccountId: actor.accountId, explorerId: uuid(5), guideId: uuid(6), packId: uuid(7), methodologyVersionId: uuid(8),
    methodologyContentSha256: subject.subjectSha256, methodologyAuthorizationVersion: MV1,
    modelPolicyVersion: "synthetic-model", resourcePolicyVersion: "synthetic-resource",
    receipts: Object.fromEntries(["policy", "source", "resources", "renderer", "signal", "provider", "target"].map(key => [key, { file: key + ".json", sha256: SHA }])) as ExplorerPrivateLocalRun["profile"]["receipts"] };
  const ledger = options.ledger ?? fakeLedger(5);
  const reserve = ledger.reserve;
  const run: ExplorerPrivateLocalRun = { profile, directory: "synthetic-unused-directory", modelName: "gpt-5.6-luna",
    dailyConversationCallLimit: ledger.limit, adultResources: "Synthetic resource.",
    ageAppropriateResources: "Synthetic resource.", failureAssistance: { support: "Synthetic.", adultPolicy: "Synthetic.",
      supportAndAdultPolicy: "Synthetic.", temporarilyUnavailable: "Synthetic." },
    available: ledger.available, usage: ledger.usage, reserve };
  const policy = { contractVersion: "explorer-conversation-safety.v1", known: true, version: 1,
    restrictedLevel: options.restricted ? 4 : null, adultReflectionStopped: options.adultStopped ?? false };
  const mode = options.restricted || options.adultStopped ? "classification_only" as const : "classification_and_reply" as const;
  const initial = { version: "explorer-conversation.v1" as const, conversationId: ids.conversationId,
    revision: 0, pendingTurn: false, turnedDownLimitReached: false, waypointDraft: null, providerState: "available" as const, messages: [], compassItems: [], priorityId: null, attentionId: null, waypoints: [] };
  const authority = { accountId: actor.accountId, applicationSessionId: actor.applicationSessionId, explorerId: profile.explorerId,
    guideId: profile.guideId, authorizationVersion: AV3, applicationSessionExpiresAt: profile.expiresAt };
  const row = { outcome: "ok", authority_context: authority, policy_state: policy,
    conversation_state: { ...initial, revision: 1, pendingTurn: true,
      messages: [{ id: ids.messageId, role: "explorer", body: command.body, createdAt: new Date().toISOString() }] } };
  const serialized = JSON.stringify({ contractVersion: mode === "classification_only"
    ? "wi007-v0.1+onboarding-fields-v2" : "wi007-v0.1+onboarding-fields-v2+compass-v4",
    ...(mode === "classification_only" ? {} : { compassContext: { version: "explorer-compass-context.v4",
      points: [], priorityId: null, attentionId: null, recentRoute: [], waypoints: [], drafts: [] } }),
    immediateExplorerMessage: { content: command.body } });
  const request = { contractVersion: "explorer-safety-request.v2" as const, invocationId: ids.invocationId, explorerId: profile.explorerId,
    sessionId: ids.conversationId, contextSnapshotId: ids.snapshotId, authorizedContext: serialized,
    contextFingerprint: createHash("sha256").update(serialized).digest("hex").toUpperCase(),
    mode,
    classificationPolicyVersion: profile.modelPolicyVersion, fallbackPolicyVersion: "synthetic-fallback", instructionVersion: "synthetic-instructions" };
  const evidence = { p_authorization_version: AV3, p_context_source_ids: [ids.messageId], p_intake_response_set_id: uuid(10),
    p_prompt_version: "synthetic-prompt", p_policy_version: "synthetic-policy", p_behavior_version: "synthetic-role",
    p_crisis_version: "synthetic-crisis", p_role_version: "synthetic-role", p_instruction_version: request.instructionVersion };
  const readiness = { configuration, configurationFingerprint: SHA, modelName: "gpt-5.6-luna", modelPolicyVersion: profile.modelPolicyVersion,
    resourcePolicyVersion: profile.resourcePolicyVersion, sourceVerificationReceiptSha256: SHA, resourceVerificationReceiptSha256: SHA,
    rendererVerificationReceiptSha256: SHA, signalVerificationReceiptSha256: SHA,
    methodology: { packId: profile.packId, versionId: profile.methodologyVersionId, contentSha256: subject.subjectSha256, authorizationVersion: MV1 } };
  const caller = new AbortController();
  const args: Parameters<Build>[0] = { actor, row: { ...row, conversation_state: initial }, state: initial, command, ids, readiness, mode: request.mode, signal: caller.signal };
  const buildContext = vi.fn<Build>(async () => ({ request, evidence }));
  const authenticate = vi.fn(async () => actor);
  const read = vi.fn(async () => row);
  const repository = { read, ensure: vi.fn(), observe: vi.fn(), prepare: vi.fn(), settle: vi.fn(), pause: vi.fn() };
  const selection = { packId: profile.packId, scopeType: "guide" as const, scopeId: profile.guideId, versionId: profile.methodologyVersionId,
    versionNumber: 1, contentMarkdown: content, contentSha256: subject.subjectSha256, methodologyAuthorizationVersion: MV1 };
  const methodologySource = { read: vi.fn(async () => selection) };
  const generate = vi.fn(async () => "synthetic-model-result");
  const credentialReady = vi.fn(() => true);
  const bound = withExplorerPrivateLocalDispatch({ run, authenticate, repository, methodologySource, buildContext, credentialReady, generate });
  return { actor, args, request, row, selection, caller, profile, reserve, ledger, authenticate, read, methodologySource, credentialReady, generate, bound, buildContext };
}
async function prepared(options?: Parameters<typeof fixture>[0]) { const f = fixture(options); await f.bound.buildContext(f.args); return f; }
describe("finite local dispatch authority", () => {
  it.each(MODE_CASES)("forwards once after actual preflight ports; a duplicate attempt never reaches transport ($cause)", async ({ options }) => {
    const f = await prepared(options); expect(await f.bound.provider.generate(f.request, f.caller.signal)).toBe("synthetic-model-result");
    expect(f.buildContext).toHaveBeenCalledExactlyOnceWith(f.args);
    expect(f.buildContext.mock.calls[0][0].mode).toBe(f.request.mode);
    expect(f.generate).toHaveBeenCalledExactlyOnceWith(f.request, expect.any(AbortSignal));
    expect(createHash("sha256").update(f.request.authorizedContext).digest("hex").toUpperCase()).toBe(f.request.contextFingerprint);
    await expect(f.bound.provider.generate(f.request, f.caller.signal)).rejects.toThrow();
    expect(f.read).toHaveBeenCalledTimes(2); expect(f.reserve).toHaveBeenCalledTimes(1); expect(f.generate).toHaveBeenCalledTimes(1);
  });
  it("forwards a different invented message: the text is no longer pinned to one approved body", async () => {
    const f = await prepared({ body: "Another made-up test message about planning a week." });
    expect(await f.bound.provider.generate(f.request, f.caller.signal)).toBe("synthetic-model-result");
    expect(f.reserve).toHaveBeenCalledTimes(1);
  });
  it("refuses a missing or malformed key after the final authenticated read without reserving or generating", async () => {
    const f = await prepared(); f.credentialReady.mockImplementation(() => {
      expect(f.read).toHaveBeenCalledTimes(2);
      return false;
    });
    await expect(f.bound.provider.generate(f.request, f.caller.signal)).rejects.toThrow("explorer_private_local_dispatch_unavailable");
    expect(f.credentialReady).toHaveBeenCalledOnce();
    expect(f.reserve).not.toHaveBeenCalled(); expect(f.generate).not.toHaveBeenCalled();
  });
  it("refuses with zero transport once today's allowance is used, after every other check", async () => {
    const f = await prepared({ ledger: fakeLedger(0) });
    await expect(f.bound.provider.generate(f.request, f.caller.signal)).rejects.toThrow();
    expect(f.read).toHaveBeenCalledTimes(2); expect(f.credentialReady).toHaveBeenCalledOnce();
    expect(f.reserve).toHaveBeenCalledOnce(); expect(f.generate).not.toHaveBeenCalled();
  });
  it.each(MODE_CASES)("keeps a reserved place counted when cancellation lands after reserving, and never forwards ($cause)", async ({ options }) => {
    const ledger = fakeLedger(1);
    const f = await prepared({ ...options, ledger }); f.reserve.mockImplementationOnce(() => { const place = ledger.take(); f.caller.abort(); return place; });
    await expect(f.bound.provider.generate(f.request, f.caller.signal)).rejects.toThrow();
    expect(ledger.used()).toBe(1); expect(f.reserve).toHaveBeenCalledOnce(); expect(f.generate).not.toHaveBeenCalled();
    // The place is gone for everyone: an independently bound request sees no capacity left.
    const g = await prepared({ ...options, ledger });
    await expect(g.bound.provider.generate(g.request, g.caller.signal)).rejects.toThrow("synthetic_allowance_used");
    expect(g.generate).not.toHaveBeenCalled();
  });
  it.each(MODE_CASES)("reserves at most once per bound request, even if a later call arrives with a fresh signal ($cause)", async ({ options }) => {
    const f = await prepared(options); const first = new AbortController();
    f.reserve.mockImplementationOnce(() => { const place = f.ledger.take(); first.abort(); return place; });
    await expect(f.bound.provider.generate(f.request, first.signal)).rejects.toThrow();
    await expect(f.bound.provider.generate(f.request, new AbortController().signal)).rejects.toThrow();
    expect(f.reserve).toHaveBeenCalledOnce(); expect(f.ledger.used()).toBe(1); expect(f.generate).not.toHaveBeenCalled();
  });
  it.each(MODE_CASES)("refuses a later call on a request that already reserved, before any further read ($cause)", async ({ options }) => {
    const f = await prepared(options); const first = new AbortController();
    f.reserve.mockImplementationOnce(() => { const place = f.ledger.take(); first.abort(); return place; });
    await expect(f.bound.provider.generate(f.request, first.signal)).rejects.toThrow();
    const reads = f.read.mock.calls.length, authentications = f.authenticate.mock.calls.length;
    const methodologyReads = f.methodologySource.read.mock.calls.length;
    await expect(f.bound.provider.generate(f.request, new AbortController().signal)).rejects.toThrow("explorer_private_local_dispatch_unavailable");
    expect(f.read).toHaveBeenCalledTimes(reads); expect(f.authenticate).toHaveBeenCalledTimes(authentications);
    expect(f.methodologySource.read).toHaveBeenCalledTimes(methodologyReads); expect(f.credentialReady).toHaveBeenCalledOnce();
    expect(f.reserve).toHaveBeenCalledOnce(); expect(f.generate).not.toHaveBeenCalled();
  });
  it.each(MODE_CASES)("keeps one reservation per request when a second call overlaps a first that reserved and was cancelled ($cause)", async ({ options }) => {
    // Both calls pass the early check before either reserves; only the one-reservation latch stops the second.
    const f = await prepared(options); const a = new AbortController(), b = new AbortController();
    f.reserve.mockImplementationOnce(() => { const place = f.ledger.take(); a.abort(); return place; });
    const outcomes = await Promise.allSettled([f.bound.provider.generate(f.request, a.signal), f.bound.provider.generate(f.request, b.signal)]);
    expect(outcomes.map(outcome => outcome.status)).toEqual(["rejected", "rejected"]);
    expect(f.reserve).toHaveBeenCalledOnce(); expect(f.ledger.used()).toBe(1); expect(f.generate).not.toHaveBeenCalled();
  });
  it("never forwards against a day that ended after the place was reserved", async () => {
    const f = await prepared(); f.reserve.mockImplementationOnce(() => ({ ...f.ledger.take(), day: "2000-01-01" }));
    await expect(f.bound.provider.generate(f.request, f.caller.signal)).rejects.toThrow("explorer_private_local_dispatch_unavailable");
    expect(f.ledger.used()).toBe(1); expect(f.generate).not.toHaveBeenCalled();
  });
  it.each(MODE_CASES)("does not invoke the transport again after a failed or unknown provider outcome ($cause)", async ({ options }) => {
    const f = await prepared(options); f.generate.mockRejectedValueOnce(new Error("synthetic_unknown_outcome"));
    await expect(f.bound.provider.generate(f.request, f.caller.signal)).rejects.toThrow("synthetic_unknown_outcome");
    await expect(f.bound.provider.generate(f.request, f.caller.signal)).rejects.toThrow("explorer_private_local_dispatch_unavailable");
    expect(f.generate).toHaveBeenCalledOnce(); expect(f.reserve).toHaveBeenCalledOnce(); expect(f.ledger.used()).toBe(1);
  });
  it.each(MODE_CASES.slice(1))("counts a safety-only (classification-only) send against the same allowance ($cause)", async ({ options }) => {
    const f = await prepared(options); expect(f.request.mode).toBe("classification_only");
    expect(await f.bound.provider.generate(f.request, f.caller.signal)).toBe("synthetic-model-result");
    expect(f.reserve).toHaveBeenCalledOnce(); expect(f.ledger.used()).toBe(1);
  });
  it("lets two separately bound requests sharing a one-place ledger forward exactly once", async () => {
    const ledger = fakeLedger(1);
    const first = await prepared({ ledger }), second = await prepared({ ledger });
    const outcomes = await Promise.allSettled([first.bound.provider.generate(first.request, first.caller.signal),
      second.bound.provider.generate(second.request, second.caller.signal)]);
    expect(outcomes.filter(x => x.status === "fulfilled")).toHaveLength(1);
    expect(ledger.used()).toBe(1); expect(first.generate.mock.calls.length + second.generate.mock.calls.length).toBe(1);
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
    expect(f.reserve).not.toHaveBeenCalled(); expect(f.generate).not.toHaveBeenCalled();
  });
  it.each(MODE_CASES)("refuses cancellation during awaited methodology and expiry before transport ($cause)", async ({ options }) => {
    const f = await prepared(options); f.methodologySource.read.mockImplementation(async () => { f.caller.abort(); return f.selection; });
    await expect(f.bound.provider.generate(f.request, f.caller.signal)).rejects.toThrow(); expect(f.generate).not.toHaveBeenCalled();
    expect(f.reserve).not.toHaveBeenCalled();
    const g = await prepared(options); g.read.mockResolvedValue({ ...g.row, authority_context: { ...g.row.authority_context, applicationSessionExpiresAt: "2000-01-01T00:00:00.000Z" } });
    await expect(g.bound.provider.generate(g.request, g.caller.signal)).rejects.toThrow(); expect(g.reserve).not.toHaveBeenCalled();
  });
  it("does not accept a caller-swapped prepared identity or run two concurrent transports", async () => {
    const f = await prepared();
    await expect(f.bound.provider.generate({ ...f.request, contextSnapshotId: uuid(99) }, f.caller.signal)).rejects.toThrow();
    const outcomes = await Promise.allSettled([f.bound.provider.generate(f.request, f.caller.signal), f.bound.provider.generate(f.request, f.caller.signal)]);
    expect(outcomes.filter(x => x.status === "fulfilled")).toHaveLength(1); expect(f.generate).toHaveBeenCalledTimes(1);
  });
});
