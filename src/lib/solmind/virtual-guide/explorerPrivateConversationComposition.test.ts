import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getExplorerPrivateConfigurationCandidate } from "./explorerPrivateConfiguration";
import { EXPLORER_SAFETY_REQUEST_VERSION } from "./explorerSafetyReplyContract";
import { adaptPrivateGovernedExplorerContextBuilder, readExplorerPrivateConversation, readEndedExplorerConversations, commandExplorerPrivateConversation, deriveExplorerPrivateTurnIds, parseExplorerPrivatePolicy,
  type ExplorerPrivateConversationDependencies, type ExplorerPrivateOperationalReadiness, type ExplorerPrivateRpcRow, type ExplorerPrivateReadRow,
  type ExplorerPrivateEnsureParameters, type ExplorerPrivatePrepareParameters, type ExplorerPrivateSettleParameters, type ExplorerPrivateArrangeParameters, type ExplorerPrivateEndParameters, type ExplorerPrivateReviewParameters,
  type ExplorerPrivatePauseRow, type ExplorerPrivatePauseNotice } from "./explorerPrivateConversationComposition";
import type { ExplorerConversationState, ExplorerConversationCommand } from "../explorerConversationContract";
import type { ExplorerSafetyReplyPlan } from "./explorerConversationSafety";
import { explorerConversationCommandFingerprint, type ExplorerConversationDependencies } from "./explorerConversationComposition";

const ID = { actor: "00000000-0000-4000-8000-000000000001", app: "00000000-0000-4000-8000-000000000002",
  conversation: "00000000-0000-4000-8000-000000000003", explorer: "00000000-0000-4000-8000-000000000004",
  intake: "00000000-0000-4000-8000-000000000005", pack: "00000000-0000-4000-8000-000000000006",
  version: "00000000-0000-4000-8000-000000000007", operation: "00000000-0000-4000-8000-000000000008" };
const SHA = "A".repeat(64);
const ACTOR = { accountId: ID.actor, applicationSessionId: ID.app };
const POLICY = { known: true, contractVersion: "explorer-conversation-safety.v1", restrictedLevel: null, adultReflectionStopped: false, version: 0 };
const RAW = JSON.stringify({ protocol: "explorer-safety-reply.v1", classification: { level: 0, minorIndicated: false }, candidateReply: { content: "One saved synthetic reply." } });
function state(conversationId: string | null): ExplorerConversationState {
  return { version: "explorer-conversation.v1", conversationId, revision: 0, pendingTurn: false, providerState: "unavailable",
    messages: [], compassItems: [], priorityId: null, attentionId: null, waypoints: [] };
}
function fixture() {
  const configuration = getExplorerPrivateConfigurationCandidate(); if (!configuration) throw new Error("synthetic_candidate_missing");
  const readiness: ExplorerPrivateOperationalReadiness = { configuration, configurationFingerprint: SHA, modelName: "gpt-5.6-luna", modelPolicyVersion: "synthetic-model.v1",
    resourcePolicyVersion: "synthetic-reviewed-resources.v1", sourceVerificationReceiptSha256: SHA, resourceVerificationReceiptSha256: SHA,
    rendererVerificationReceiptSha256: SHA, signalVerificationReceiptSha256: SHA,
    methodology: { packId: ID.pack, versionId: ID.version, contentSha256: SHA, authorizationVersion: "MV1:" + SHA } };
  let current = state(null); let prepared: ExplorerPrivatePrepareParameters | null = null;
  let policy: Record<string, unknown> = { ...POLICY }; const order: string[] = [];
  const read = vi.fn(async (): Promise<ExplorerPrivateReadRow> => { order.push("read"); return { outcome: "ok", conversation_state: current,
    authority_context: { explorerId: ID.explorer, authorizationVersion: "AV3:" + SHA }, policy_state: policy }; });
  const ensure = vi.fn(async (_parameters: ExplorerPrivateEnsureParameters): Promise<ExplorerPrivateRpcRow> => { order.push("ensure"); current = state(ID.conversation);
    return { outcome: "created", conversation_state: current, authority_context: { explorerId: ID.explorer, authorizationVersion: "AV3:" + SHA }, policy_state: policy }; });
  const observe = vi.fn(async (): Promise<ExplorerPrivateRpcRow> => { order.push("observe"); return { outcome: "ok", policy_state: policy }; });
  const prepare = vi.fn(async (parameters: ExplorerPrivatePrepareParameters): Promise<ExplorerPrivateRpcRow> => {
    order.push("prepare"); prepared = parameters; current = { ...current, revision: 1, pendingTurn: true,
      messages: [{ id: parameters.p_message_id, role: "explorer", body: parameters.p_body, createdAt: "2026-10-25T18:00:00Z" }] };
    return { outcome: "ok", conversation_state: current, dispatch_permitted: true, policy_state: policy }; });
  const settle = vi.fn(async (parameters: ExplorerPrivateSettleParameters): Promise<ExplorerPrivateRpcRow> => {
    order.push("settle"); current = { ...current, revision: 2, pendingTurn: false,
      messages: parameters.p_reply_body && parameters.p_reply_message_id ? [...current.messages, { id: parameters.p_reply_message_id, role: "virtualGuide", body: parameters.p_reply_body, createdAt: "2026-10-25T18:00:01Z" }] : current.messages };
    return { outcome: "ok", conversation_state: current, policy_state: policy, saved_reply: parameters.p_reply_kind !== "none" }; });
  const mutate = vi.fn(async (): Promise<ExplorerPrivateRpcRow> => ({ outcome: "ok", conversation_state: current }));
  const arrange = vi.fn(async (_parameters: ExplorerPrivateArrangeParameters): Promise<ExplorerPrivateRpcRow> => {
    void _parameters; order.push("arrange"); return { outcome: "ok", conversation_state: current };
  });
  const end = vi.fn(async (_parameters: ExplorerPrivateEndParameters): Promise<ExplorerPrivateRpcRow> => {
    void _parameters; order.push("end"); return { outcome: "ok", conversation_state: current };
  });
  const review = vi.fn(async (_parameters: ExplorerPrivateReviewParameters): Promise<ExplorerPrivateRpcRow> => {
    void _parameters; order.push("review"); return { outcome: "ok", ended_conversations: [], conversation_state: null };
  });
  let pauseRow: ExplorerPrivatePauseRow = { outcome: "ok", notice_kind: null, crisis: false, adults_only: false };
  const pause = vi.fn(async (): Promise<ExplorerPrivatePauseRow> => { order.push("pause"); return pauseRow; });
  const pauseNotice = vi.fn((notice: ExplorerPrivatePauseNotice) => `Synthetic pause notice ${notice.kind} ${notice.crisis ?? "ordinary"} adults=${notice.adultsOnly} refused=${notice.refused}.`);
  const generate = vi.fn(async () => { order.push("model"); return RAW; });
  const signal = vi.fn(async () => { order.push("signal"); });
  const resolve = vi.fn(async () => { order.push("configuration"); return readiness; });
  const dependencies: ExplorerPrivateConversationDependencies = {
    authenticate: vi.fn(async () => ACTOR), repository: { read, ensure, observe, prepare, settle, pause, mutate, arrange, end, review },
    resolveOperationalReadiness: resolve, provider: { generate }, operationalSignal: { verificationReceiptSha256: SHA, emit: signal },
    renderer: { verificationReceiptSha256: SHA,
      // Explicit synthetic test bodies/receipts, never operational acceptance.
      failureAssistance: { support: "Synthetic support failure assistance. No saved reply is claimed.",
        adultPolicy: "Synthetic adult-policy failure assistance. No saved reply is claimed.",
        supportAndAdultPolicy: "Synthetic support plus adult-policy failure assistance. No saved reply is claimed.",
        temporarilyUnavailable: "Synthetic unavailable assistance. Reload to inspect saved state." },
      render: vi.fn(async (plan: ExplorerSafetyReplyPlan, ready: ExplorerPrivateOperationalReadiness) => ({ kind: plan.kind === "restricted_followup" ? "restricted" as const : plan.kind as "urgent" | "crisis" | "adult_only",
        body: "Synthetic reviewed support rendering.", trustedResponseVersion: ready.configuration.trustedResponses.version, resourcePolicyVersion: ready.resourcePolicyVersion })),
      pauseNotice },
    buildContext: vi.fn(async (input: Parameters<NonNullable<ExplorerPrivateConversationDependencies["buildContext"]>>[0]) => {
      order.push("context"); const authorizedContext = JSON.stringify({ contractVersion: "wi007-v0.1+onboarding-fields-v2",
        globalPolicy: { version: configuration.globalPolicy.version, text: configuration.globalPolicy.text.replace(/\r\n?/g, "\n").trim() },
        roleBehavior: { version: configuration.roleBehavior.version, text: configuration.roleBehavior.text.replace(/\r\n?/g, "\n").trim() },
        crisisBehavior: { version: configuration.crisisBehavior.version, text: configuration.crisisBehavior.text.replace(/\r\n?/g, "\n").trim() },
        immediateExplorerMessage: { messageId: input.ids.messageId, content: input.command.body }, outputRequirements: { format: "plain_text" } });
      return { request: { contractVersion: EXPLORER_SAFETY_REQUEST_VERSION, invocationId: input.ids.invocationId,
        explorerId: ID.explorer, sessionId: input.ids.conversationId, contextSnapshotId: input.ids.snapshotId,
        contextFingerprint: createHash("sha256").update(authorizedContext).digest("hex").toUpperCase(), authorizedContext, mode: input.mode,
        classificationPolicyVersion: readiness.modelPolicyVersion, fallbackPolicyVersion: configuration.fallback.version, instructionVersion: configuration.instructionVersion },
        evidence: { p_context_source_ids: [input.ids.messageId, ID.intake, ID.version].sort(), p_authorization_version: "AV3:" + SHA,
          p_intake_response_set_id: ID.intake, p_prompt_version: configuration.promptVersion, p_policy_version: configuration.globalPolicy.version,
          p_behavior_version: configuration.roleBehavior.version, p_crisis_version: configuration.crisisBehavior.version,
          p_role_version: configuration.roleVersion, p_instruction_version: configuration.instructionVersion } };
    }),
  };
  return { dependencies, read, ensure, observe, prepare, settle, pause, pauseNotice, mutate, arrange, end, review, generate, signal, resolve, order, readiness,
    getPrepared: () => prepared, setCurrent: (value: ExplorerConversationState) => { current = value; }, setPolicy: (value: Record<string, unknown>) => { policy = value; },
    setPause: (value: ExplorerPrivatePauseRow) => { pauseRow = value; } };
}
function send(body = "Synthetic ordinary message.") { return { kind: "send", operationId: ID.operation, expectedRevision: 0, body }; }
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("Held private Explorer controller: explicit synthetic ports only", () => {
  it("owns the actual ensure identity, fresh AV3 read, one model observation and one terminal", async () => {
    const f = fixture(); const output = await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(output.result.ok).toBe(true); expect(output.assistance).toBeNull(); expect(f.generate).toHaveBeenCalledOnce(); expect(f.settle).toHaveBeenCalledOnce();
    expect(f.order).toEqual(["read", "configuration", "pause", "ensure", "observe", "read", "context", "prepare", "model", "settle"]);
    const ids = deriveExplorerPrivateTurnIds(ACTOR, ID.conversation, ID.operation);
    expect(f.getPrepared()?.p_conversation_id).toBe(ID.conversation); expect(f.getPrepared()?.p_invocation_id).toBe(ids.invocationId);
    expect(f.getPrepared()?.p_request_mode).toBe("classification_and_reply");
    expect(f.settle.mock.calls[0][0]).toMatchObject({ p_status: "completed", p_reply_kind: "ordinary", p_model_level: 0, p_reply_message_id: ids.replyId });
    expect(f.ensure.mock.calls[0][0]).not.toHaveProperty("p_body");
  });
  it("resolves existing no-dispatch replay before configuration/provider/ensure", async () => {
    const f = fixture(); f.read.mockResolvedValue({ outcome: "exact_replay", conversation_state: state(ID.conversation), policy_state: null });
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: { ...f.dependencies, resolveOperationalReadiness: undefined } });
    expect(output.result.ok).toBe(true); expect(f.resolve).not.toHaveBeenCalled(); expect(f.ensure).not.toHaveBeenCalled(); expect(f.generate).not.toHaveBeenCalled();
  });
  it("candidate configuration alone or unverified renderer/signal holds before anchor", async () => {
    for (const variant of ["candidate_only", "renderer", "signal"] as const) {
      const f = fixture(); let dependencies = f.dependencies;
      if (variant === "candidate_only") f.resolve.mockResolvedValue(f.readiness.configuration as unknown as ExplorerPrivateOperationalReadiness);
      if (variant === "renderer") dependencies = { ...dependencies, renderer: undefined };
      if (variant === "signal") dependencies = { ...dependencies, operationalSignal: { verificationReceiptSha256: "unverified", emit: async () => undefined } };
      const output = await commandExplorerPrivateConversation({ command: send(), dependencies });
      expect(output.result.ok).toBe(false); expect(f.ensure).not.toHaveBeenCalled(); expect(f.prepare).not.toHaveBeenCalled(); expect(f.generate).not.toHaveBeenCalled();
    }
  });
  it("a blocked evaluation keeps a freshly authorized real empty container with transient assistance", async () => {
    const f = fixture(); f.prepare.mockResolvedValue({ outcome: "blocked", conversation_state: null, dispatch_permitted: false, policy_state: POLICY });
    const output = await commandExplorerPrivateConversation({ command: send("I want to kill myself"), dependencies: f.dependencies });
    expect(f.observe).toHaveBeenCalledOnce(); expect(f.generate).not.toHaveBeenCalled(); expect(f.settle).not.toHaveBeenCalled();
    expect(output.result.ok && output.result.state.conversationId).toBe(ID.conversation);
    expect(output.result.ok && output.result.state.messages).toEqual([]);
    expect(output.assistance).toMatchObject({ kind: "support", persisted: false }); expect(f.signal).toHaveBeenCalledOnce();
  });
  it("does not repost failed/unknown fallback observation or dispatch without its confirmation", async () => {
    const f = fixture(); f.observe.mockRejectedValue(new Error("unknown private persistence"));
    await commandExplorerPrivateConversation({ command: send("I am a minor"), dependencies: f.dependencies });
    expect(f.ensure).toHaveBeenCalledOnce(); expect(f.observe).toHaveBeenCalledOnce(); expect(f.prepare).not.toHaveBeenCalled(); expect(f.generate).not.toHaveBeenCalled();
  });
  it("uncertain completed acknowledgement triggers no contradictory second terminal or redispatch", async () => {
    const f = fixture(); f.settle.mockRejectedValue(new Error("lost acknowledgment"));
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(f.settle).toHaveBeenCalledOnce(); expect(f.generate).toHaveBeenCalledOnce(); expect(output.assistance?.persisted).toBe(false);
    expect(JSON.stringify(output)).not.toContain("One saved synthetic reply.");
    expect(output.result.ok && output.result.state.pendingTurn).toBe(true);
  });
  it("valid model classification survives unusable prose as one completed/none terminal", async () => {
    const f = fixture(); f.generate.mockResolvedValue(JSON.stringify({ protocol: "explorer-safety-reply.v1", classification: { level: 2, minorIndicated: false }, candidateReply: { content: "\ud800" } }));
    await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(f.settle).toHaveBeenCalledOnce(); expect(f.settle.mock.calls[0][0]).toMatchObject({ p_status: "completed", p_reply_kind: "none", p_model_level: 2,
      p_reply_message_id: null, p_reply_body: null });
  });
  it("browser cancellation after dispatch preserves model positives and makes one terminal without output", async () => {
    const f = fixture(); const controller = new AbortController(); let resolve!: (value: string) => void; let started!: () => void;
    const startedPromise = new Promise<void>((yes) => { started = yes; }); let ownedSignal!: AbortSignal;
    const pending = new Promise<string>((yes) => { resolve = yes; });
    const dependencies = { ...f.dependencies, provider: { generate: vi.fn((_request: unknown, signal: AbortSignal) => { ownedSignal = signal; started(); return pending; }) } };
    const run = commandExplorerPrivateConversation({ command: send(), dependencies, signal: controller.signal });
    await startedPromise; controller.abort(); expect(ownedSignal.aborted).toBe(false);
    resolve(JSON.stringify({ protocol: "explorer-safety-reply.v1", classification: { level: 4, minorIndicated: true }, candidateReply: null }));
    const output = await run;
    expect(f.settle).toHaveBeenCalledOnce(); expect(f.settle.mock.calls[0][0]).toMatchObject({ p_status: "completed", p_model_level: 4,
      p_model_minor_indicated: true, p_delivery_interested: false, p_reply_kind: "none" });
    expect(output.result.ok).toBe(false); expect(output.assistance).toBeNull();
  });
  it("SQL-withheld stale ordinary prose yields current support assistance, never the stale candidate", async () => {
    const f = fixture(); f.settle.mockImplementation(async () => { f.setPolicy({ ...POLICY, restrictedLevel: 3, version: 1 });
      return { outcome: "ok", conversation_state: null, policy_state: { ...POLICY, restrictedLevel: 3, version: 1 }, saved_reply: false }; });
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(f.settle).toHaveBeenCalledOnce(); expect(output.assistance?.kind).toBe("support"); expect(JSON.stringify(output)).not.toContain("One saved synthetic reply.");
  });
  it("retains a model-only critical observation even when logout prevents private state return", async () => {
    const f = fixture(); f.generate.mockResolvedValue(JSON.stringify({ protocol: "explorer-safety-reply.v1", classification: { level: 4, minorIndicated: false }, candidateReply: null }));
    f.settle.mockResolvedValue({ outcome: "ok", conversation_state: null, policy_state: null, saved_reply: false });
    const authenticate = vi.fn().mockResolvedValueOnce(ACTOR).mockResolvedValue(null);
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: { ...f.dependencies, authenticate } });
    expect(output.result).toMatchObject({ ok: false, state: null }); expect(output.assistance?.kind).toBe("support");
    expect(f.signal).toHaveBeenCalledOnce(); expect(f.settle).toHaveBeenCalledOnce();
  });
  it("keeps deliberate formation on its closed existing mutate port without readiness or AI", async () => {
    const f = fixture(); f.setCurrent(state(ID.conversation));
    await commandExplorerPrivateConversation({ command: { kind: "set_attention", operationId: ID.operation, expectedRevision: 0, itemId: ID.intake }, dependencies: f.dependencies });
    expect(f.mutate).toHaveBeenCalledOnce(); expect(f.resolve).not.toHaveBeenCalled(); expect(f.ensure).not.toHaveBeenCalled(); expect(f.generate).not.toHaveBeenCalled();
  });
  it("does not interpret missing/malformed old policy as clear", () => {
    expect(parseExplorerPrivatePolicy(null)).toEqual({ status: "unknown" });
    expect(parseExplorerPrivatePolicy({ ...POLICY, version: null })).toEqual({ status: "unknown" });
    expect(parseExplorerPrivatePolicy({ ...POLICY, restrictedLevel: 2 })).toEqual({ status: "unknown" });
  });
  it("adapts only AV3 governed context without changing compact input bytes", async () => {
    const f = fixture(); let exactBytes = "";
    const builder: NonNullable<ExplorerConversationDependencies["buildContext"]> = async (turn) => {
      const built = await f.dependencies.buildContext!({ ...turn, readiness: f.readiness, mode: "classification_and_reply" });
      exactBytes = built.request.authorizedContext;
      return { request: { contractVersion: "virtual-guide-conversation.v1", invocationId: built.request.invocationId,
        explorerId: built.request.explorerId, sessionId: built.request.sessionId, contextSnapshotId: built.request.contextSnapshotId,
        contextFingerprint: built.request.contextFingerprint, authorizedContext: exactBytes }, evidence: { ...built.evidence,
          p_methodology_context_pack_id: ID.pack, p_methodology_context_pack_version_id: ID.version,
          p_methodology_content_sha256: SHA, p_methodology_authorization_version: "MV1:" + SHA } };
    };
    await commandExplorerPrivateConversation({ command: send(), dependencies: { ...f.dependencies, buildContext: adaptPrivateGovernedExplorerContextBuilder(builder) } });
    expect(f.getPrepared()?.p_context_serialization).toBe(exactBytes); expect(f.getPrepared()?.p_authorization_version).toBe("AV3:" + SHA);
    expect(f.generate).toHaveBeenCalledOnce();
    const old = fixture();
    const av2: typeof builder = async (turn) => { const built = await builder(turn); return { ...built, evidence: { ...built.evidence, p_authorization_version: "AV2:" + SHA } }; };
    await commandExplorerPrivateConversation({ command: send(), dependencies: { ...old.dependencies, buildContext: adaptPrivateGovernedExplorerContextBuilder(av2) } });
    expect(old.prepare).not.toHaveBeenCalled(); expect(old.generate).not.toHaveBeenCalled();
  });
  it("a hung renderer is canceled by request and cannot prevent actual positive settlement", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const f = fixture(); f.generate.mockResolvedValue(JSON.stringify({ protocol: "explorer-safety-reply.v1", classification: { level: 3, minorIndicated: false }, candidateReply: null }));
    type Rendered = Awaited<ReturnType<NonNullable<ExplorerPrivateConversationDependencies["renderer"]>["render"]>>;
    let started!: () => void; let finish!: (value: Rendered) => void; let rendererSignal!: AbortSignal;
    const startedPromise = new Promise<void>((yes) => { started = yes; });
    const pending = new Promise<Rendered>((yes) => { finish = yes; });
    const renderer = { ...f.dependencies.renderer!, render: (_plan: ExplorerSafetyReplyPlan, _ready: ExplorerPrivateOperationalReadiness, signal: AbortSignal) => {
      rendererSignal = signal; started(); return pending; } };
    const run = commandExplorerPrivateConversation({ command: send(), dependencies: { ...f.dependencies, renderer } });
    await startedPromise; await vi.advanceTimersByTimeAsync(2000); const output = await run;
    expect(rendererSignal.aborted).toBe(true); expect(f.settle).toHaveBeenCalledOnce();
    expect(f.settle.mock.calls[0][0]).toMatchObject({ p_status: "completed", p_model_level: 3, p_reply_kind: "none" });
    expect(output.assistance?.kind).toBe("support");
    finish({ kind: "urgent", body: "Unadmitted late rendering.", trustedResponseVersion: f.readiness.configuration.trustedResponses.version, resourcePolicyVersion: f.readiness.resourcePolicyVersion });
    await Promise.resolve(); expect(JSON.stringify(output)).not.toContain("Unadmitted late");
  });
  it("a hung operational signal does not indefinitely suppress reviewed critical failure assistance", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const f = fixture(); f.prepare.mockResolvedValue({ outcome: "blocked", conversation_state: null, dispatch_permitted: false, policy_state: POLICY });
    let started!: () => void; let finish!: () => void; let ownedSignal!: AbortSignal;
    const startedPromise = new Promise<void>((yes) => { started = yes; }); const pending = new Promise<void>((yes) => { finish = yes; });
    const operationalSignal = { verificationReceiptSha256: SHA, emit: (_marker: string, signal: AbortSignal) => { ownedSignal = signal; started(); return pending; } };
    const run = commandExplorerPrivateConversation({ command: send("I am in immediate danger"), dependencies: { ...f.dependencies, operationalSignal } });
    await startedPromise; await vi.advanceTimersByTimeAsync(1000); const output = await run;
    expect(ownedSignal.aborted).toBe(true); expect(output.assistance).toMatchObject({ kind: "support", persisted: false });
    finish(); await Promise.resolve(); expect(f.generate).not.toHaveBeenCalled();
  });
});

describe("Root cycle1 pinned policy and remembered facts", () => {
  it.each(["globalPolicy", "roleBehavior", "crisisBehavior"] as const)("refuses same-version altered %s text before prepare or provider", async (key) => {
    const f = fixture(); const original = f.dependencies.buildContext!;
    const buildContext: NonNullable<ExplorerPrivateConversationDependencies["buildContext"]> = async (input) => {
      const built = await original(input); const envelope = JSON.parse(built.request.authorizedContext);
      envelope[key].text += " Altered unapproved same-version policy.";
      const authorizedContext = JSON.stringify(envelope);
      return { ...built, request: { ...built.request, authorizedContext,
        contextFingerprint: createHash("sha256").update(authorizedContext).digest("hex").toUpperCase() } };
    };
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: { ...f.dependencies, buildContext } });
    expect(output.assistance?.kind).toBe("temporarily_unavailable");
    expect(f.prepare).not.toHaveBeenCalled(); expect(f.generate).not.toHaveBeenCalled(); expect(f.settle).not.toHaveBeenCalled();
  });
  it.each([[4, false, "support"], [null, true, "adult_policy"], [4, true, "support"]] as const)(
    "retains prior floor%s/adult%s through authority-loss null projection", async (floor, adult, kind) => {
      const f = fixture(); f.setPolicy({ ...POLICY, restrictedLevel: floor, adultReflectionStopped: adult, version: 1 });
      f.generate.mockResolvedValue(JSON.stringify({ protocol: "explorer-safety-reply.v1", classification: { level: 0, minorIndicated: false }, candidateReply: null }));
      f.settle.mockResolvedValue({ outcome: "ok", conversation_state: null, policy_state: null, saved_reply: false });
      const authenticate = vi.fn().mockResolvedValueOnce(ACTOR).mockResolvedValue(null);
      const output = await commandExplorerPrivateConversation({ command: send(), dependencies: { ...f.dependencies, authenticate } });
      expect(f.signal).toHaveBeenCalledOnce(); expect(f.settle).toHaveBeenCalledOnce(); expect(f.generate).toHaveBeenCalledOnce();
      expect(f.getPrepared()?.p_request_mode).toBe("classification_only");
      expect(output.result).toMatchObject({ ok: false, state: null }); expect(output.assistance?.kind).toBe(kind);
      expect(output.assistance?.persisted).toBe(false);
    });
});

it("a caller canceled during trusted rendering admits no outward terminal body", async () => {
  const f = fixture(); const controller = new AbortController();
  f.generate.mockResolvedValue(JSON.stringify({ protocol: "explorer-safety-reply.v1", classification: { level: 3, minorIndicated: false }, candidateReply: null }));
  const renderer = { ...f.dependencies.renderer!, render: async (_plan: ExplorerSafetyReplyPlan, ready: ExplorerPrivateOperationalReadiness) => {
    controller.abort();
    return { kind: "urgent" as const, body: "Synthetic trusted rendering after known caller cancellation.",
      trustedResponseVersion: ready.configuration.trustedResponses.version, resourcePolicyVersion: ready.resourcePolicyVersion };
  } };
  const output = await commandExplorerPrivateConversation({ command: send(), dependencies: { ...f.dependencies, renderer }, signal: controller.signal });
  expect(controller.signal.aborted).toBe(true);
  expect(output.result.ok).toBe(false); expect(output.assistance).toBeNull();
  expect(f.generate).toHaveBeenCalledOnce();
  expect(f.settle).toHaveBeenCalledOnce();
  expect(f.settle.mock.calls[0][0]).toMatchObject({ p_status: "completed", p_model_level: 3, p_model_minor_indicated: false,
    p_delivery_interested: false, p_reply_kind: "none", p_reply_body: null, p_reply_message_id: null });
});

describe("private read operational availability", () => {
  it("revalidates authority after an awaited readiness check before releasing private history", async () => {
    const f = fixture(); const authenticate = vi.fn().mockResolvedValueOnce(ACTOR).mockResolvedValue(null);
    const output = await readExplorerPrivateConversation({ ...f.dependencies, authenticate });
    expect(f.resolve).toHaveBeenCalledOnce(); expect(authenticate).toHaveBeenCalledTimes(2);
    expect(output).toEqual({ result: { ok: false, state: null, error: "denied" }, assistance: null });
    expect(f.ensure).not.toHaveBeenCalled(); expect(f.generate).not.toHaveBeenCalled();
  });
  it("advertises only complete injected readiness without ensuring or dispatching", async () => {
    const f = fixture();
    const output = await readExplorerPrivateConversation(f.dependencies);
    expect(output.result).toMatchObject({ ok: true, state: { providerState: "available" } });
    expect(f.resolve).toHaveBeenCalledOnce();
    for (const port of [f.ensure, f.observe, f.prepare, f.settle, f.mutate, f.arrange, f.end, f.review, f.generate]) expect(port).not.toHaveBeenCalled();
    const held = await readExplorerPrivateConversation({ ...f.dependencies, resolveOperationalReadiness: undefined });
    expect(held.result).toMatchObject({ ok: true, state: { providerState: "unavailable" } });
  });
  it("keeps saved history readable on readiness failure and denies before readiness after auth loss", async () => {
    const f = fixture(); f.resolve.mockRejectedValue(new Error("private configuration detail"));
    expect((await readExplorerPrivateConversation(f.dependencies)).result).toMatchObject({ ok: true, state: { providerState: "unavailable" } });
    f.resolve.mockClear();
    const output = await readExplorerPrivateConversation({ ...f.dependencies, authenticate: async () => null });
    expect(output.result).toEqual({ ok: false, state: null, error: "denied" });
    expect(f.resolve).not.toHaveBeenCalled();
  });
});


describe("Private confirmed Compass arrangement routing", () => {
  const currentState = (): ExplorerConversationState => ({ ...state(ID.conversation), revision: 4,
    messages: [{ id: ID.intake, role: "explorer", body: "A saved synthetic arrangement source.", createdAt: "2026-10-29T07:00:00Z" }],
    compassItems: [
      { id: ID.pack, sourceMessageId: ID.intake, label: "An Explorer-selected Priority" },
      { id: ID.version, sourceMessageId: ID.intake, label: "An independently selected attention point" },
    ], priorityId: ID.pack, attentionId: ID.version });
  const command = (): Extract<ExplorerConversationCommand, { kind: "confirm_compass_arrangement" }> => ({
    kind: "confirm_compass_arrangement", operationId: ID.operation, expectedRevision: 4, priorityId: ID.pack,
    items: [{ compassItemId: ID.pack, anchor: "apex", emphasis: 3 },
      { compassItemId: ID.version, anchor: "side_left", emphasis: 1 }],
  });
  function noOtherEffects(f: ReturnType<typeof fixture>) {
    for (const port of [f.mutate, f.end, f.review, f.resolve, f.ensure, f.observe, f.prepare, f.settle, f.generate, f.signal,
      f.dependencies.buildContext, f.dependencies.renderer?.render]) expect(port).not.toHaveBeenCalled();
  }

  it("uses the fresh trusted actor and exact eight arrangement arguments without readiness, context or provider capabilities", async () => {
    const f = fixture(); f.setCurrent(currentState());
    const input = command();
    const output = await commandExplorerPrivateConversation({ command: input, dependencies: { ...f.dependencies,
      resolveOperationalReadiness: undefined, provider: undefined, buildContext: undefined, renderer: undefined, operationalSignal: undefined } });
    expect(output.result.ok).toBe(true); expect(output.assistance).toBeNull();
    expect(f.dependencies.authenticate).toHaveBeenCalledOnce();
    expect(f.read).toHaveBeenCalledExactlyOnceWith(ACTOR,
      { operationId: input.operationId, fingerprint: explorerConversationCommandFingerprint(input) });
    expect(f.arrange).toHaveBeenCalledExactlyOnceWith({ p_actor_user_account_id: ID.actor, p_user_session_id: ID.app,
      p_conversation_id: ID.conversation, p_operation_id: ID.operation, p_expected_revision: 4,
      p_command_fingerprint: explorerConversationCommandFingerprint(input), p_priority_id: ID.pack, p_items: input.items });
    expect(Object.keys(f.arrange.mock.calls[0][0])).toHaveLength(8);
    expect(f.order).toEqual(["read", "arrange"]);
    noOtherEffects(f);
  });

  it.each([null, { ...POLICY, known: false }, { ...POLICY, restrictedLevel: 3 },
    { ...POLICY, adultReflectionStopped: true }])("denies new arrangement under unknown/restricted/adult-stop policy (%j)", async policy_state => {
    const f = fixture(); f.read.mockResolvedValue({ outcome: "ok", conversation_state: currentState(), policy_state });
    const output = await commandExplorerPrivateConversation({ command: command(), dependencies: f.dependencies });
    expect(output).toEqual({ result: { ok: false, state: null, error: "denied" }, assistance: null });
    expect(f.arrange).not.toHaveBeenCalled(); noOtherEffects(f);
  });

  it("denies missing current conversation or arrangement port without falling back to mutate", async () => {
    for (const missing of ["conversation", "port"] as const) {
      const f = fixture(); f.setCurrent(missing === "conversation" ? state(null) : currentState());
      const dependencies = missing === "port" ? { ...f.dependencies, repository: { ...f.dependencies.repository, arrange: undefined } } : f.dependencies;
      expect((await commandExplorerPrivateConversation({ command: command(), dependencies })).result)
        .toEqual({ ok: false, state: null, error: "denied" });
      expect(f.arrange).not.toHaveBeenCalled(); noOtherEffects(f);
    }
  });

  it("resolves exact historical arrangement replay before policy, configuration or the now-absent arrangement port", async () => {
    const f = fixture(); f.read.mockResolvedValue({ outcome: "exact_replay", conversation_state: currentState(), policy_state: null });
    const output = await commandExplorerPrivateConversation({ command: command(), dependencies: { ...f.dependencies,
      repository: { ...f.dependencies.repository, arrange: undefined }, resolveOperationalReadiness: undefined,
      provider: undefined, buildContext: undefined } });
    expect(output.result).toMatchObject({ ok: true, state: { revision: 4, priorityId: ID.pack, attentionId: ID.version } });
    expect(output.assistance).toBeNull(); expect(f.read).toHaveBeenCalledOnce();
    expect(f.arrange).not.toHaveBeenCalled(); noOtherEffects(f);
  });

  it("denies browser authority before auth and absent identity before repository access", async () => {
    const malformed = fixture();
    expect((await commandExplorerPrivateConversation({ command: { ...command(), actorId: ID.actor }, dependencies: malformed.dependencies })).result)
      .toEqual({ ok: false, state: null, error: "denied" });
    expect(malformed.dependencies.authenticate).not.toHaveBeenCalled(); expect(malformed.read).not.toHaveBeenCalled();
    expect(malformed.arrange).not.toHaveBeenCalled(); noOtherEffects(malformed);
    const absent = fixture();
    expect((await commandExplorerPrivateConversation({ command: command(), dependencies: { ...absent.dependencies, authenticate: async () => null } })).result)
      .toEqual({ ok: false, state: null, error: "denied" });
    expect(absent.read).not.toHaveBeenCalled(); expect(absent.arrange).not.toHaveBeenCalled(); noOtherEffects(absent);
  });

  it.each(["stale_revision", "operation_conflict", "denied"])("returns arrangement %s once without a new model path", async outcome => {
    const f = fixture(); f.setCurrent(currentState()); f.arrange.mockResolvedValue({ outcome });
    const output = await commandExplorerPrivateConversation({ command: command(), dependencies: f.dependencies });
    expect(output.result).toEqual({ ok: false, state: null, error: outcome === "denied" ? "denied" : "refresh_required" });
    expect(f.arrange).toHaveBeenCalledOnce(); noOtherEffects(f);
  });
});


describe("Owned End and ended-review capabilities (synthetic ports)", () => {
  const endCommand = (): Extract<ExplorerConversationCommand, { kind: "end_conversation" }> => ({
    kind: "end_conversation", conversationId: ID.conversation, operationId: ID.operation, expectedRevision: 4,
  });
  const ended = (): ExplorerConversationState => ({ ...state(ID.conversation), revision: 5, sessionStatus: "ended",
    ending: { operationId: ID.operation, revision: 5, endedAt: "2026-10-29T07:00:00.123456+00:00",
      directionsTaken: "Synthetic saved ending. No Priority was confirmed. No recorded Route changes.", routeThroughRevision: 4 } });
  const items = () => [{ conversationId: ID.conversation, endedAt: ended().ending!.endedAt }];
  function noReflection(f: ReturnType<typeof fixture>) {
    for (const port of [f.read, f.mutate, f.arrange, f.resolve, f.ensure, f.observe, f.prepare, f.settle, f.generate,
      f.signal, f.dependencies.buildContext, f.dependencies.renderer?.render]) expect(port).not.toHaveBeenCalled();
  }

  it.each(["ok", "exact_replay"])("handles %s End before active-only reads and sends exactly six actor-bound arguments", async outcome => {
    const f = fixture(); f.read.mockRejectedValue(new Error("active-only path must not be used"));
    f.end.mockResolvedValue({ outcome, conversation_state: ended() });
    const command = endCommand();
    const output = await commandExplorerPrivateConversation({ command, dependencies: { ...f.dependencies,
      resolveOperationalReadiness: undefined, provider: undefined, buildContext: undefined, renderer: undefined, operationalSignal: undefined } });
    expect(output).toEqual({ result: { ok: true, state: ended(), error: null }, assistance: null });
    expect(f.dependencies.authenticate).toHaveBeenCalledOnce();
    expect(f.end).toHaveBeenCalledExactlyOnceWith({ p_actor_user_account_id: ID.actor, p_user_session_id: ID.app,
      p_conversation_id: ID.conversation, p_operation_id: ID.operation, p_expected_revision: 4,
      p_command_fingerprint: explorerConversationCommandFingerprint(command) });
    expect(Object.keys(f.end.mock.calls[0][0])).toHaveLength(6);
    expect(f.review).not.toHaveBeenCalled(); noReflection(f);
  });

  it("accepts a truthful already-ended legacy state without inventing a new ending operation", async () => {
    const f = fixture(); const legacy = { ...ended(), ending: null };
    f.end.mockResolvedValue({ outcome: "already_ended", conversation_state: legacy });
    expect(await commandExplorerPrivateConversation({ command: endCommand(), dependencies: f.dependencies }))
      .toEqual({ result: { ok: true, state: legacy, error: null }, assistance: null });
    expect(f.end).toHaveBeenCalledOnce(); expect(f.review).not.toHaveBeenCalled(); noReflection(f);
  });

  it("refuses missing or mismatched ok/replay ending evidence instead of claiming successful closure", async () => {
    const original = ended(); const ending = original.ending!;
    for (const conversation_state of [
      { ...original, conversationId: ID.pack }, { ...original, sessionStatus: "active", ending: null },
      { ...original, ending: null }, { ...original, ending: { ...ending, operationId: ID.pack } },
      { ...original, ending: { ...ending, revision: 4 } }, { ...original, ending: { ...ending, routeThroughRevision: 3 } },
    ]) {
      const f = fixture(); f.end.mockResolvedValue({ outcome: "ok", conversation_state });
      expect((await commandExplorerPrivateConversation({ command: endCommand(), dependencies: f.dependencies })).result)
        .toEqual({ ok: false, state: null, error: "unavailable" });
      expect(f.end).toHaveBeenCalledOnce(); expect(f.review).not.toHaveBeenCalled(); noReflection(f);
    }
  });

  it.each(["stale_revision", "operation_conflict", "denied", "unavailable"])("returns End %s without another port or retry", async outcome => {
    const f = fixture(); f.end.mockResolvedValue({ outcome });
    const output = await commandExplorerPrivateConversation({ command: endCommand(), dependencies: f.dependencies });
    expect(output.result).toEqual({ ok: false, state: null,
      error: outcome === "denied" ? "denied" : outcome === "unavailable" ? "unavailable" : "refresh_required" });
    expect(f.end).toHaveBeenCalledOnce(); expect(f.review).not.toHaveBeenCalled(); noReflection(f);
  });

  it("denies unavailable End authority and closes unknown acknowledgement without an active read fallback", async () => {
    const absent = fixture();
    expect((await commandExplorerPrivateConversation({ command: endCommand(), dependencies: { ...absent.dependencies,
      repository: { ...absent.dependencies.repository, end: undefined } } })).result).toEqual({ ok: false, state: null, error: "denied" });
    expect(absent.end).not.toHaveBeenCalled(); expect(absent.review).not.toHaveBeenCalled(); noReflection(absent);
    const unauthenticated = fixture();
    expect((await commandExplorerPrivateConversation({ command: endCommand(), dependencies: { ...unauthenticated.dependencies,
      authenticate: async () => null } })).result).toEqual({ ok: false, state: null, error: "denied" });
    expect(unauthenticated.end).not.toHaveBeenCalled(); expect(unauthenticated.review).not.toHaveBeenCalled(); noReflection(unauthenticated);
    const unknown = fixture(); unknown.end.mockRejectedValue(new Error("Synthetic private acknowledgement loss"));
    expect((await commandExplorerPrivateConversation({ command: endCommand(), dependencies: unknown.dependencies })).result)
      .toEqual({ ok: false, state: null, error: "unavailable" });
    expect(unknown.end).toHaveBeenCalledOnce(); expect(unknown.review).not.toHaveBeenCalled(); noReflection(unknown);
  });

  it("reads owned ended metadata and a selected state through only the three-argument review capability", async () => {
    const f = fixture(); f.review.mockResolvedValueOnce({ outcome: "ok", ended_conversations: items(), conversation_state: null })
      .mockResolvedValueOnce({ outcome: "ok", ended_conversations: items(), conversation_state: ended() });
    expect(await readEndedExplorerConversations(f.dependencies, null)).toEqual({ version: "explorer-conversation-review.v1",
      ok: true, items: items(), state: null, error: null });
    expect(await readEndedExplorerConversations(f.dependencies, ID.conversation)).toEqual({ version: "explorer-conversation-review.v1",
      ok: true, items: items(), state: ended(), error: null });
    expect(f.review.mock.calls.map(([parameters]) => parameters)).toEqual([
      { p_actor_user_account_id: ID.actor, p_user_session_id: ID.app, p_conversation_id: null },
      { p_actor_user_account_id: ID.actor, p_user_session_id: ID.app, p_conversation_id: ID.conversation },
    ]);
    expect(f.dependencies.authenticate).toHaveBeenCalledTimes(2); expect(f.end).not.toHaveBeenCalled(); noReflection(f);
  });

  it("preserves a legacy nullable review time/summary without inventing metadata or model readiness", async () => {
    const f = fixture(); const legacy = { ...ended(), ending: null }; const legacyItems = [{ conversationId: ID.conversation, endedAt: null }];
    f.review.mockResolvedValue({ outcome: "ok", ended_conversations: legacyItems, conversation_state: legacy });
    expect(await readEndedExplorerConversations(f.dependencies, ID.conversation)).toEqual({ version: "explorer-conversation-review.v1",
      ok: true, items: legacyItems, state: legacy, error: null });
    expect(f.end).not.toHaveBeenCalled(); noReflection(f);
  });

  it("denies malformed selectors/identity and leaves absent or failed review unavailable without another read", async () => {
    const f = fixture();
    for (const selector of ["bad", ` ${ID.conversation}`, `${ID.conversation}\n`]) {
      expect(await readEndedExplorerConversations(f.dependencies, selector)).toEqual({ version: "explorer-conversation-review.v1",
        ok: false, items: null, state: null, error: "denied" });
    }
    expect(f.dependencies.authenticate).not.toHaveBeenCalled(); expect(f.review).not.toHaveBeenCalled();
    expect(await readEndedExplorerConversations({ ...f.dependencies, authenticate: async () => null }, null))
      .toEqual({ version: "explorer-conversation-review.v1", ok: false, items: null, state: null, error: "denied" });
    const absent = await readEndedExplorerConversations({ ...f.dependencies, repository: { ...f.dependencies.repository, review: undefined } }, null);
    expect(absent).toEqual({ version: "explorer-conversation-review.v1", ok: false, items: null, state: null, error: "unavailable" });
    f.review.mockRejectedValue(new Error("Synthetic private review fault"));
    expect(await readEndedExplorerConversations(f.dependencies, null)).toEqual({ version: "explorer-conversation-review.v1",
      ok: false, items: null, state: null, error: "unavailable" });
    expect(f.review).toHaveBeenCalledOnce(); expect(f.end).not.toHaveBeenCalled(); noReflection(f);
  });

  it("refuses wrong/active/unselected review projections and forwards a closed owned denial", async () => {
    const projection = ended();
    for (const row of [
      { outcome: "ok", ended_conversations: items(), conversation_state: { ...projection, conversationId: ID.pack } },
      { outcome: "ok", ended_conversations: items(), conversation_state: { ...projection, sessionStatus: "active", ending: null } },
      { outcome: "ok", ended_conversations: items(), conversation_state: null },
      { outcome: "ok", ended_conversations: null, conversation_state: projection },
      { outcome: "ok", ended_conversations: [{ ...items()[0], privateText: "must not escape" }], conversation_state: projection },
    ]) {
      const f = fixture(); f.review.mockResolvedValue(row);
      expect(await readEndedExplorerConversations(f.dependencies, ID.conversation)).toEqual({ version: "explorer-conversation-review.v1",
        ok: false, items: null, state: null, error: "unavailable" });
      expect(f.review).toHaveBeenCalledOnce(); expect(f.end).not.toHaveBeenCalled(); noReflection(f);
    }
    const f = fixture(); f.review.mockResolvedValue({ outcome: "denied" });
    expect(await readEndedExplorerConversations(f.dependencies, null)).toEqual({ version: "explorer-conversation-review.v1",
      ok: false, items: null, state: null, error: "denied" });
    expect(f.end).not.toHaveBeenCalled(); noReflection(f);
  });
});


describe("private category capability", () => {
  const command = { kind: "confirm_compass_category" as const, operationId: ID.operation, expectedRevision: 0,
    targetItemId: ID.actor, memberItemIds: [ID.actor], label: "A broader focus" };
  it("forwards only the nine derived arguments, without operational readiness or provider work", async () => {
    const f = fixture(); f.setCurrent(state(ID.conversation));
    const category = vi.fn(async () => ({ outcome: "ok", conversation_state: state(ID.conversation) }));
    const dependencies = { ...f.dependencies, repository: { ...f.dependencies.repository, category } };
    expect((await commandExplorerPrivateConversation({ command, dependencies })).result.ok).toBe(true);
    expect(category).toHaveBeenCalledExactlyOnceWith({ p_actor_user_account_id: ID.actor, p_user_session_id: ID.app,
      p_conversation_id: ID.conversation, p_operation_id: ID.operation, p_expected_revision: 0,
      p_command_fingerprint: explorerConversationCommandFingerprint(command), p_target_item_id: ID.actor,
      p_member_item_ids: [ID.actor], p_label: "A broader focus" });
    for (const port of [f.ensure, f.observe, f.prepare, f.settle, f.mutate, f.arrange, f.end, f.review, f.resolve, f.generate]) expect(port).not.toHaveBeenCalled();
  });
  it("keeps exact replay before new category dispatch and policy checks", async () => {
    const f = fixture(); f.read.mockResolvedValue({ outcome: "exact_replay", conversation_state: state(ID.conversation) });
    const category = vi.fn();
    expect((await commandExplorerPrivateConversation({ command, dependencies: { ...f.dependencies,
      repository: { ...f.dependencies.repository, category } } })).result.ok).toBe(true);
    expect(category).not.toHaveBeenCalled(); expect(f.resolve).not.toHaveBeenCalled(); expect(f.generate).not.toHaveBeenCalled();
  });
  it("refuses absent capability, policy stop and pending state without mutation or provider work", async () => {
    for (const blocked of ["absent", "restricted", "unknown", "adult", "pending"] as const) {
      const f = fixture(); f.setCurrent({ ...state(ID.conversation), pendingTurn: blocked === "pending" });
      if (blocked === "restricted") f.setPolicy({ ...POLICY, restrictedLevel: 3 });
      if (blocked === "unknown") f.setPolicy({ known: false });
      if (blocked === "adult") f.setPolicy({ ...POLICY, adultReflectionStopped: true });
      const category = vi.fn();
      const result = await commandExplorerPrivateConversation({ command, dependencies: { ...f.dependencies,
        repository: { ...f.dependencies.repository, ...(blocked === "absent" ? {} : { category }) } } });
      expect(result.result.ok).toBe(false); expect(category).not.toHaveBeenCalled();
      expect(f.mutate).not.toHaveBeenCalled(); expect(f.generate).not.toHaveBeenCalled();
    }
  });
});


describe("owned private Waypoint release capability", () => {
  const command = { kind: "release_waypoint" as const, operationId: ID.operation, expectedRevision: 0, waypointId: ID.actor };
  const released = () => ({ ...state(ID.conversation), revision: 1, sessionStatus: "active" as const, ending: null,
    messages: [{ id: ID.intake, role: "explorer" as const, body: "Saved synthetic conversation source", createdAt: "2026-10-29T14:00:00Z" }],
    waypoints: [{ id: ID.actor, sourceMessageId: ID.intake, destination: "A synthetic destination", meaning: "It matters",
      arrivalSignal: "An observable signal", status: "chosen" as const,
      release: { operationId: ID.operation, releasedAt: "2026-10-29T15:00:00.000Z" } }] });
  it("forwards seven authenticated arguments as owned closure without readiness/provider or generic writes", async () => {
    const f = fixture(); f.setCurrent({ ...state(ID.conversation), sessionStatus: "active", ending: null }); f.setPolicy({ known: false });
    const release = vi.fn(async () => ({ outcome: "ok", conversation_state: released() }));
    const result = await commandExplorerPrivateConversation({ command, dependencies: { ...f.dependencies,
      repository: { ...f.dependencies.repository, release } } });
    expect(result.result.ok).toBe(true);
    expect(release).toHaveBeenCalledExactlyOnceWith({ p_actor_user_account_id: ID.actor, p_user_session_id: ID.app,
      p_conversation_id: ID.conversation, p_operation_id: ID.operation, p_expected_revision: 0,
      p_command_fingerprint: explorerConversationCommandFingerprint(command), p_waypoint_id: ID.actor });
    for (const port of [f.ensure,f.observe,f.prepare,f.settle,f.mutate,f.arrange,f.end,f.review,f.resolve,f.generate]) expect(port).not.toHaveBeenCalled();
  });
  it("resolves exact replay before dispatch, policy or provider work", async () => {
    const f = fixture(); f.read.mockResolvedValue({ outcome: "exact_replay", conversation_state: released() }); const release = vi.fn();
    expect((await commandExplorerPrivateConversation({ command, dependencies: { ...f.dependencies,
      repository: { ...f.dependencies.repository, release } } })).result.ok).toBe(true);
    expect(release).not.toHaveBeenCalled(); expect(f.generate).not.toHaveBeenCalled();
  });
  it("refuses missing capability/pending and never fabricates a saved release from an incomplete result", async () => {
    for (const reason of ["absent","pending","missing_capture","wrong_waypoint","wrong_conversation"] as const) {
      const f = fixture(); f.setCurrent({ ...state(ID.conversation), pendingTurn: reason === "pending" });
      const s = released();
      const wrong = reason === "missing_capture" ? { ...s, waypoints: [] } : reason === "wrong_waypoint" ?
        { ...s, waypoints: [{ ...s.waypoints[0], id: ID.conversation }] } : reason === "wrong_conversation" ?
        { ...s, conversationId: ID.actor } : s;
      const release = vi.fn(async () => ({ outcome: "ok", conversation_state: wrong }));
      const result = await commandExplorerPrivateConversation({ command, dependencies: { ...f.dependencies,
        repository: { ...f.dependencies.repository, ...(reason === "absent" ? {} : { release }) } } });
      expect(result.result.ok).toBe(false); expect(f.generate).not.toHaveBeenCalled(); expect(f.mutate).not.toHaveBeenCalled();
      if (reason === "absent" || reason === "pending") expect(release).not.toHaveBeenCalled();
    }
  });
});


describe("private conversation-confirmed Waypoint successor",()=>{
 const command={kind:"revise_waypoint" as const,operationId:ID.operation,expectedRevision:0,waypointId:ID.actor,
  answers:[{component:"destination" as const,answer:"A clarified destination"}]};
 const current=()=>({...state(ID.conversation),sessionStatus:"active" as const,ending:null,messages:[{id:ID.intake,role:"explorer" as const,body:"Synthetic saved source",createdAt:"2026-10-29T14:00:00Z"}],
  waypoints:[{id:ID.actor,sourceMessageId:ID.intake,destination:"Old destination",meaning:"It matters",arrivalSignal:"Visible signal",status:"chosen" as const}]});
 const saved=()=>{const before=current();return {...before,revision:1,waypoints:[...before.waypoints,{...before.waypoints[0],id:ID.operation,destination:command.answers[0].answer,
  lifecycle:{predecessorWaypointId:ID.actor,creationReason:"revision" as const,clarifications:[{...command.answers[0],questionKey:"waypoint.destination.v1" as const,recordedAt:"2026-10-29T15:30:00Z"}]}}]};};
 it("forwards only nine derived arguments, returns immutable successor, never invokes the provider",async()=>{
  const f=fixture();f.setCurrent(current());const waypointRevision=vi.fn(async()=>({outcome:"ok",conversation_state:saved()}));
  expect((await commandExplorerPrivateConversation({command,dependencies:{...f.dependencies,repository:{...f.dependencies.repository,waypointRevision}}})).result.ok).toBe(true);
  expect(waypointRevision).toHaveBeenCalledExactlyOnceWith({p_actor_user_account_id:ID.actor,p_user_session_id:ID.app,p_conversation_id:ID.conversation,
    p_operation_id:ID.operation,p_expected_revision:0,p_command_fingerprint:explorerConversationCommandFingerprint(command),p_kind:command.kind,p_waypoint_id:ID.actor,p_answers:command.answers});
  for(const port of [f.ensure,f.observe,f.prepare,f.settle,f.mutate,f.resolve,f.generate])expect(port).not.toHaveBeenCalled();
 });
 it("retains known-clear/pending/capability gates and exactreplay before new reflection",async()=>{
  for(const reason of ["unknown","restricted","adult","pending","absent","replay"] as const){
   const f=fixture();f.setCurrent({...current(),pendingTurn:reason==="pending"});
   if(reason==="unknown")f.setPolicy({known:false});if(reason==="restricted")f.setPolicy({...POLICY,restrictedLevel:3});if(reason==="adult")f.setPolicy({...POLICY,adultReflectionStopped:true});
   if(reason==="replay")f.read.mockResolvedValue({outcome:"exact_replay",conversation_state:saved()});
   const waypointRevision=vi.fn();const r=await commandExplorerPrivateConversation({command,dependencies:{...f.dependencies,repository:{...f.dependencies.repository,...(reason==="absent"?{}:{waypointRevision})}}});
   expect(r.result.ok).toBe(reason==="replay");expect(waypointRevision).not.toHaveBeenCalled();expect(f.generate).not.toHaveBeenCalled();expect(f.mutate).not.toHaveBeenCalled();
  }
 });
});

it("does not claim a confirmed successor from an unrelated well-formed repository state",async()=>{
 const command={kind:"revise_waypoint" as const,operationId:ID.operation,expectedRevision:0,waypointId:ID.actor,
  answers:[{component:"destination" as const,answer:"Clarified destination"}]};
 const source={id:ID.intake,role:"explorer" as const,body:"Synthetic saved source",createdAt:"2026-10-29T14:00:00Z"};
 const prior={id:ID.actor,sourceMessageId:ID.intake,destination:"Old destination",meaning:"It matters",arrivalSignal:"Visible signal",status:"chosen" as const};
 const current={...state(ID.conversation),sessionStatus:"active" as const,ending:null,messages:[source],waypoints:[prior]};
 const successor={...prior,id:ID.operation,destination:command.answers[0].answer,lifecycle:{predecessorWaypointId:ID.actor,creationReason:"revision" as const,
  clarifications:[{...command.answers[0],questionKey:"waypoint.destination.v1" as const,recordedAt:"2026-10-29T15:30:00Z"}]}};
 const historicalReached={...prior,status:"reached" as const,reachedEvidence:"Earlier evidence",reachedAt:"2026-10-29T15:10:00Z"};
 for(const returned of [current,{...current,revision:1,waypoints:[prior,{...successor,id:ID.explorer}]},
  {...current,revision:1,waypoints:[historicalReached,{...successor,lifecycle:{...successor.lifecycle,creationReason:"revisit" as const}}]}]){
  const f=fixture();f.setCurrent(current);const waypointRevision=vi.fn(async()=>({outcome:"ok",conversation_state:returned}));
  expect((await commandExplorerPrivateConversation({command,dependencies:{...f.dependencies,repository:{...f.dependencies.repository,waypointRevision}}})).result.ok).toBe(false);
  expect(waypointRevision).toHaveBeenCalledOnce();expect(f.generate).not.toHaveBeenCalled();expect(f.mutate).not.toHaveBeenCalled();
 }
});
describe("Send capacity after a saved Send result", () => {
  const SAVED_REPLY = "One saved synthetic reply.";
  function withCapacity(f: ReturnType<typeof fixture>, check: (() => boolean) | undefined) {
    return check === undefined ? f.dependencies : { ...f.dependencies, sendCapacityAvailable: check };
  }
  it("reports unavailable with the saved reply when the last allowed Send used the last place, and available below it", async () => {
    for (const [room, expected] of [[false, "unavailable"], [true, "available"]] as const) {
      const f = fixture(); const check = vi.fn(() => { f.order.push("capacity"); return room; });
      const output = await commandExplorerPrivateConversation({ command: send(), dependencies: withCapacity(f, check) });
      expect(output.result.ok).toBe(true); expect(output.assistance).toBeNull();
      expect(output.result.ok && output.result.state.providerState).toBe(expected);
      expect(output.result.ok && output.result.state.messages.map(message => message.body)).toContain(SAVED_REPLY);
      expect(f.generate).toHaveBeenCalledOnce(); expect(f.settle).toHaveBeenCalledOnce();
      // Checked once, after the reply is saved.
      expect(check).toHaveBeenCalledOnce(); expect(f.order.slice(-2)).toEqual(["settle", "capacity"]);
    }
  });
  it("keeps the earlier available result when no check is supplied", async () => {
    const f = fixture(); const output = await commandExplorerPrivateConversation({ command: send(), dependencies: withCapacity(f, undefined) });
    expect(output.result.ok && output.result.state.providerState).toBe("available");
  });
  it("reports unavailable, and still returns the saved reply, when the check throws or answers anything but true", async () => {
    for (const check of [() => { throw new Error("synthetic capacity failure"); }, () => 1 as unknown as boolean, () => "true" as unknown as boolean]) {
      const f = fixture(); const output = await commandExplorerPrivateConversation({ command: send(), dependencies: withCapacity(f, check) });
      expect(output.result.ok && output.result.state.providerState).toBe("unavailable");
      expect(output.result.ok && output.result.state.messages.map(message => message.body)).toContain(SAVED_REPLY);
      expect(f.generate).toHaveBeenCalledOnce();
    }
  });
  it.each(["observe", "builder", "prepare"] as const)("applies the check to an exact %s replay, which never dispatches", async stage => {
    for (const [check, expected] of [[() => false, "unavailable"], [() => true, "available"], [undefined, "available"]] as const) {
      const f = fixture(); const replay = { outcome: "exact_replay", conversation_state: state(ID.conversation), policy_state: POLICY };
      const original = f.read.getMockImplementation()!;
      if (stage === "observe") f.observe.mockResolvedValue({ outcome: "exact_replay", policy_state: POLICY });
      if (stage === "prepare") f.prepare.mockResolvedValue(replay);
      else f.read.mockImplementationOnce(original).mockImplementationOnce(async () => replay);
      const output = await commandExplorerPrivateConversation({ command: send(), dependencies: withCapacity(f, check) });
      expect(output.result.ok && output.result.state.providerState).toBe(expected);
      expect(f.generate).not.toHaveBeenCalled(); expect(f.settle).not.toHaveBeenCalled();
      expect(f.prepare).toHaveBeenCalledTimes(stage === "prepare" ? 1 : 0);
    }
  });
  it("never turns an unavailable result into available", async () => {
    // A replay found by the first read and a failed settlement both keep reporting unavailable.
    const first = fixture(); const firstCheck = vi.fn(() => true);
    first.read.mockResolvedValue({ outcome: "exact_replay", conversation_state: state(ID.conversation), policy_state: null });
    const replayed = await commandExplorerPrivateConversation({ command: send(), dependencies: withCapacity(first, firstCheck) });
    expect(replayed.result.ok && replayed.result.state.providerState).toBe("unavailable");
    const failedSettle = fixture(); const settleCheck = vi.fn(() => true);
    failedSettle.settle.mockRejectedValue(new Error("lost acknowledgment"));
    const uncertain = await commandExplorerPrivateConversation({ command: send(), dependencies: withCapacity(failedSettle, settleCheck) });
    expect(uncertain.assistance?.persisted).toBe(false);
    expect(uncertain.result.ok && uncertain.result.state.providerState).toBe("unavailable");
    expect(firstCheck).not.toHaveBeenCalled(); expect(settleCheck).not.toHaveBeenCalled();
  });
});

describe("hard-stop pause notices (product-limits slice 2b, synthetic ports)", () => {
  const INDIVIDUAL: ExplorerPrivatePauseRow = { outcome: "ok", notice_kind: "individual", crisis: false, adults_only: false };
  const SHARED: ExplorerPrivatePauseRow = { outcome: "ok", notice_kind: "shared", crisis: false, adults_only: false };
  const BOTH: ExplorerPrivatePauseRow = { outcome: "ok", notice_kind: "individual_and_shared", crisis: false, adults_only: false };
  const CLEAR: ExplorerPrivatePauseRow = { outcome: "ok", notice_kind: null, crisis: false, adults_only: false };
  function noTurn(f: ReturnType<typeof fixture>) {
    for (const port of [f.ensure, f.observe, f.prepare, f.settle, f.generate]) expect(port).not.toHaveBeenCalled();
  }
  it("refuses an ordinary message under an individual pause before ensure, keeping Send available and saving nothing", async () => {
    const f = fixture(); f.setPause(INDIVIDUAL);
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(f.order).toEqual(["read", "configuration", "pause", "read"]); noTurn(f);
    expect(output.result).toMatchObject({ ok: true, state: { conversationId: null, providerState: "available", messages: [] } });
    expect(output.assistance).toEqual({ kind: "paused", body: "Synthetic pause notice individual ordinary adults=false refused=true.", persisted: false });
    expect(f.pauseNotice).toHaveBeenCalledExactlyOnceWith({ kind: "individual", crisis: null, adultsOnly: false, refused: true }, f.readiness);
    expect(f.pause).toHaveBeenCalledExactlyOnceWith(ACTOR); expect(f.signal).not.toHaveBeenCalled();
  });
  it.each([
    ["shared", SHARED, "I want to kill myself", "crisis"],
    ["shared", SHARED, "I am being abused", "urgent"],
    ["individual_and_shared", BOTH, "I am in immediate danger", "crisis"],
    ["individual_and_shared", BOTH, "wish i wouldn't wake up", "urgent"],
  ] as const)("refuses a crisis message under a %s pause before ensure with supportive wording", async (kind, row, body, crisis) => {
    const f = fixture(); f.setPause(row);
    const output = await commandExplorerPrivateConversation({ command: send(body), dependencies: f.dependencies });
    noTurn(f); expect(output.result).toMatchObject({ ok: true, state: { providerState: "available" } });
    expect(f.pauseNotice).toHaveBeenCalledExactlyOnceWith({ kind, crisis, adultsOnly: false, refused: true }, f.readiness);
    expect(output.assistance?.kind).toBe("paused");
    // The same value-free marker as the temporary assistance, from this message's phrase check only.
    expect(f.signal).toHaveBeenCalledExactlyOnceWith("preparation_unavailable", expect.any(AbortSignal));
  });
  it("lets a crisis message under an individual-only pause reach observe, and continues when observe admits it", async () => {
    const f = fixture(); f.setPause(INDIVIDUAL);
    const output = await commandExplorerPrivateConversation({ command: send("I want to kill myself"), dependencies: f.dependencies });
    expect(f.order.slice(0, 5)).toEqual(["read", "configuration", "pause", "ensure", "observe"]);
    expect(f.observe).toHaveBeenCalledWith(expect.objectContaining({ p_fallback_level: 4 })); expect(f.prepare).toHaveBeenCalledOnce();
    expect(f.pause).toHaveBeenCalledOnce(); expect(f.pauseNotice).not.toHaveBeenCalled(); expect(output.result.ok).toBe(true);
  });
  it("shows the current pause when observe refuses a crisis message at a second stop", async () => {
    const f = fixture(); f.setPause(INDIVIDUAL); f.observe.mockResolvedValue({ outcome: "paused", policy_state: { ...POLICY, restrictedLevel: 4, version: 1 } });
    const output = await commandExplorerPrivateConversation({ command: send("I want to kill myself"), dependencies: f.dependencies });
    expect(f.pause).toHaveBeenCalledTimes(2); expect(f.prepare).not.toHaveBeenCalled(); expect(f.generate).not.toHaveBeenCalled();
    expect(f.pauseNotice).toHaveBeenCalledExactlyOnceWith({ kind: "individual", crisis: "crisis", adultsOnly: false, refused: true }, f.readiness);
    expect(output.result).toMatchObject({ ok: true, state: { conversationId: ID.conversation, providerState: "available", messages: [] } });
    expect(output.assistance?.kind).toBe("paused");
  });
  it("shows the current pause when prepare refuses, with no model call or settlement", async () => {
    const f = fixture(); f.prepare.mockImplementation(async () => { f.setPause(SHARED); return { outcome: "paused", conversation_state: null, dispatch_permitted: false, policy_state: POLICY }; });
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(f.pause).toHaveBeenCalledTimes(2); expect(f.generate).not.toHaveBeenCalled(); expect(f.settle).not.toHaveBeenCalled();
    expect(f.pauseNotice).toHaveBeenCalledExactlyOnceWith({ kind: "shared", crisis: null, adultsOnly: false, refused: true }, f.readiness);
    expect(output.assistance?.kind).toBe("paused"); expect(f.signal).not.toHaveBeenCalled();
  });
  it("falls back to the temporary assistance when the pause has already ended after a paused refusal", async () => {
    const f = fixture(); f.prepare.mockResolvedValue({ outcome: "paused", conversation_state: null, dispatch_permitted: false, policy_state: POLICY });
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(f.pause).toHaveBeenCalledTimes(2); expect(f.pauseNotice).not.toHaveBeenCalled();
    expect(output.assistance).toMatchObject({ kind: "temporarily_unavailable", persisted: false });
  });
  it("denies on a denied pause read before ensure", async () => {
    const denied = fixture(); denied.setPause({ outcome: "denied" });
    expect(await commandExplorerPrivateConversation({ command: send(), dependencies: denied.dependencies })).toEqual(
      { result: { ok: false, state: null, error: "denied" }, assistance: null });
    noTurn(denied);
  });
  it("lets the database checks decide when the first pause read fails, as before the screen step", async () => {
    const ordinary = fixture(); ordinary.pause.mockRejectedValue(new Error("private pause detail"));
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: ordinary.dependencies });
    expect(ordinary.order).toEqual(["read", "configuration", "ensure", "observe", "read", "context", "prepare", "model", "settle"]);
    expect(ordinary.pause).toHaveBeenCalledOnce();
    expect(output.result.ok).toBe(true); expect(JSON.stringify(output)).not.toContain("private pause detail");
    // A level-4 message whose observe is refused, with the re-read failing too: the temporary support and its marker.
    const crisis = fixture(); crisis.pause.mockRejectedValue(new Error("private pause detail"));
    crisis.observe.mockResolvedValue({ outcome: "paused", policy_state: POLICY });
    const refused = await commandExplorerPrivateConversation({ command: send("I want to kill myself"), dependencies: crisis.dependencies });
    expect(crisis.pause).toHaveBeenCalledTimes(2); expect(crisis.prepare).not.toHaveBeenCalled(); expect(crisis.generate).not.toHaveBeenCalled();
    expect(refused.assistance).toMatchObject({ kind: "support", persisted: false });
    expect(crisis.signal).toHaveBeenCalledExactlyOnceWith("preparation_unavailable", expect.any(AbortSignal));
  });
  it.each(["observe", "prepare"] as const)("keeps the closed result and the marker when the pause re-read after %s fails", async (step) => {
    const f = fixture(); const restricted = { ...POLICY, restrictedLevel: 4, version: 1 };
    if (step === "observe") f.observe.mockResolvedValue({ outcome: "paused", policy_state: restricted });
    else f.prepare.mockResolvedValue({ outcome: "paused", conversation_state: null, dispatch_permitted: false, policy_state: restricted });
    f.pause.mockResolvedValueOnce({ outcome: "ok", notice_kind: null, crisis: false, adults_only: false })
      .mockRejectedValueOnce(new Error("private pause detail"));
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(output.result.ok).toBe(true); expect(output.assistance).toMatchObject({ kind: "support", persisted: false });
    expect(f.signal).toHaveBeenCalledExactlyOnceWith("preparation_unavailable", expect.any(AbortSignal));
    expect(f.generate).not.toHaveBeenCalled(); expect(f.settle).not.toHaveBeenCalled();
    expect(JSON.stringify(output)).not.toContain("private pause detail");
  });
  it("reports a duplicate of this Send that committed meanwhile as its exact replay, with no refusal notice", async () => {
    const f = fixture(); f.setPause(SHARED); const saved = { ...state(ID.conversation), revision: 2 };
    f.read.mockImplementationOnce(async () => ({ outcome: "ok", conversation_state: state(null), authority_context: { explorerId: ID.explorer,
      authorizationVersion: "AV3:" + SHA }, policy_state: POLICY }))
      .mockImplementationOnce(async () => ({ outcome: "exact_replay", conversation_state: saved, policy_state: POLICY }));
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(f.read).toHaveBeenNthCalledWith(2, ACTOR, { operationId: ID.operation, fingerprint: expect.any(String) });
    expect(output.assistance).toBeNull(); expect(f.pauseNotice).not.toHaveBeenCalled();
    expect(output.result).toMatchObject({ ok: true, state: { conversationId: ID.conversation, revision: 2, providerState: "available" } }); noTurn(f);
  });
  it("checks the test allowance after the refusal's fresh read", async () => {
    const f = fixture(); f.setPause(INDIVIDUAL); let used = false; let reads = 0;
    const read = f.read.getMockImplementation()!;
    f.read.mockImplementation(async (...args) => { reads += 1; if (reads === 2) used = true; return read(...args); });
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: { ...f.dependencies, sendCapacityAvailable: () => !used } });
    expect(output.result).toMatchObject({ ok: true, state: { providerState: "unavailable" } }); expect(output.assistance?.kind).toBe("paused");
  });
  it("uses the adults-only part and the conversation's crisis state, and never passes the pause flags to the signal", async () => {
    const minor = fixture(); minor.setPause(SHARED);
    await commandExplorerPrivateConversation({ command: send("I am a minor"), dependencies: minor.dependencies });
    expect(minor.pauseNotice).toHaveBeenCalledExactlyOnceWith({ kind: "shared", crisis: null, adultsOnly: true, refused: true }, minor.readiness);
    const stored = fixture(); stored.setPolicy({ ...POLICY, restrictedLevel: 3, adultReflectionStopped: true, version: 1 });
    stored.setPause({ outcome: "ok", notice_kind: "individual", crisis: true, adults_only: true });
    await commandExplorerPrivateConversation({ command: send(), dependencies: stored.dependencies });
    expect(stored.pauseNotice).toHaveBeenCalledExactlyOnceWith({ kind: "individual", crisis: "urgent", adultsOnly: true, refused: true }, stored.readiness);
    expect(stored.signal).toHaveBeenCalledExactlyOnceWith("preparation_unavailable", expect.any(AbortSignal));
    // Clear policy and an ordinary message: the pause read's own flags never raise the operational signal, and the
    // returned conversation's known policy decides the notice.
    const flags = fixture(); flags.setPause({ outcome: "ok", notice_kind: "individual", crisis: true, adults_only: true });
    await commandExplorerPrivateConversation({ command: send(), dependencies: flags.dependencies });
    expect(flags.signal).not.toHaveBeenCalled();
    expect(flags.pauseNotice).toHaveBeenCalledExactlyOnceWith({ kind: "individual", crisis: null, adultsOnly: false, refused: true }, flags.readiness);
    // With no known policy on the returned read, the pause read's flags choose the parts.
    const unknown = fixture(); unknown.setPolicy({}); unknown.setPause({ outcome: "ok", notice_kind: "shared", crisis: true, adults_only: true });
    await commandExplorerPrivateConversation({ command: send(), dependencies: unknown.dependencies });
    expect(unknown.pauseNotice).toHaveBeenCalledExactlyOnceWith({ kind: "shared", crisis: "urgent", adultsOnly: true, refused: true }, unknown.readiness);
    expect(unknown.signal).not.toHaveBeenCalled();
    const urgent = fixture(); urgent.setPolicy({ ...POLICY, restrictedLevel: 4, version: 1 }); urgent.setPause({ outcome: "ok", notice_kind: "shared", crisis: true, adults_only: false });
    await commandExplorerPrivateConversation({ command: send(), dependencies: urgent.dependencies });
    expect(urgent.pauseNotice).toHaveBeenCalledExactlyOnceWith({ kind: "shared", crisis: "crisis", adultsOnly: false, refused: true }, urgent.readiness);
    expect(urgent.signal).toHaveBeenCalledExactlyOnceWith("preparation_unavailable", expect.any(AbortSignal));
  });
  it("reports Send unavailable on a refusal when the test allowance is used up, and keeps the notice", async () => {
    const f = fixture(); f.setPause(INDIVIDUAL);
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: { ...f.dependencies, sendCapacityAvailable: () => false } });
    expect(output.result).toMatchObject({ ok: true, state: { providerState: "unavailable" } }); expect(output.assistance?.kind).toBe("paused");
  });
  it("uses the static failure assistance when the renderer cannot write the notice", async () => {
    const f = fixture(); f.setPause(SHARED); f.pauseNotice.mockImplementation(() => { throw new Error("renderer detail"); });
    const ordinary = await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(ordinary.assistance).toMatchObject({ kind: "temporarily_unavailable" });
    const crisis = await commandExplorerPrivateConversation({ command: send("I want to kill myself"), dependencies: f.dependencies });
    expect(crisis.assistance).toMatchObject({ kind: "support" }); noTurn(f);
  });
  it("holds readiness when the renderer has no pause notice, and never reads the pause for replay", async () => {
    const f = fixture(); const { pauseNotice, ...renderer } = f.dependencies.renderer!; void pauseNotice;
    const held = await commandExplorerPrivateConversation({ command: send(), dependencies: { ...f.dependencies,
      renderer: renderer as unknown as NonNullable<ExplorerPrivateConversationDependencies["renderer"]> } });
    expect(held.result).toMatchObject({ ok: false, error: "provider_unavailable" }); expect(f.pause).not.toHaveBeenCalled();
    const replay = fixture(); replay.read.mockResolvedValue({ outcome: "exact_replay", conversation_state: state(ID.conversation), policy_state: null });
    await commandExplorerPrivateConversation({ command: send(), dependencies: replay.dependencies }); expect(replay.pause).not.toHaveBeenCalled();
  });
  it("shows the notice when the screen opens, without the unsent-message part, and keeps history readable when the read fails", async () => {
    const f = fixture(); f.setPause(BOTH);
    const output = await readExplorerPrivateConversation(f.dependencies);
    expect(f.order).toEqual(["read", "configuration", "pause", "read"]);
    expect(output.result).toMatchObject({ ok: true, state: { providerState: "available" } });
    expect(output.assistance).toEqual({ kind: "paused", body: "Synthetic pause notice individual_and_shared ordinary adults=false refused=false.", persisted: false });
    for (const port of [f.ensure, f.observe, f.prepare, f.settle, f.generate, f.signal]) expect(port).not.toHaveBeenCalled();
    const clear = fixture(); clear.setPause(CLEAR);
    expect((await readExplorerPrivateConversation(clear.dependencies)).assistance).toBeNull();
    const broken = fixture(); broken.pause.mockRejectedValue(new Error("private pause detail"));
    const readable = await readExplorerPrivateConversation(broken.dependencies);
    expect(readable.result).toMatchObject({ ok: true, state: { providerState: "available" } }); expect(readable.assistance).toBeNull();
    const denied = fixture(); denied.setPause({ outcome: "denied" });
    expect((await readExplorerPrivateConversation(denied.dependencies)).result).toMatchObject({ ok: false, error: "denied" });
    const held = fixture();
    await readExplorerPrivateConversation({ ...held.dependencies, resolveOperationalReadiness: undefined }); expect(held.pause).not.toHaveBeenCalled();
  });
  it("writes the screen-open notice from the final read's own policy, so it cannot contradict the returned conversation", async () => {
    const f = fixture(); f.setPause(SHARED);
    // Crisis and adult handling established between the pause read and the final read.
    f.pause.mockImplementation(async () => { f.order.push("pause"); f.setPolicy({ ...POLICY, restrictedLevel: 4, adultReflectionStopped: true, version: 2 }); return SHARED; });
    await readExplorerPrivateConversation(f.dependencies);
    expect(f.pauseNotice).toHaveBeenCalledExactlyOnceWith({ kind: "shared", crisis: "crisis", adultsOnly: true, refused: false }, f.readiness);
    // A known policy on the final read decides the notice; the pause flags are not used then.
    const changed = fixture(); changed.setPause({ outcome: "ok", notice_kind: "shared", crisis: true, adults_only: true });
    await readExplorerPrivateConversation(changed.dependencies);
    expect(changed.pauseNotice).toHaveBeenCalledExactlyOnceWith({ kind: "shared", crisis: null, adultsOnly: false, refused: false }, changed.readiness);
  });
});

describe("hard-stop pause notices: review round 1 cases (REV209a, REV209b)", () => {
  const INDIVIDUAL: ExplorerPrivatePauseRow = { outcome: "ok", notice_kind: "individual", crisis: false, adults_only: false };
  const SHARED: ExplorerPrivatePauseRow = { outcome: "ok", notice_kind: "shared", crisis: false, adults_only: false };
  const MARKER = ["preparation_unavailable", expect.any(AbortSignal)] as const;
  it("lets a level-3 message under an individual-only pause reach observe as well", async () => {
    const f = fixture(); f.setPause(INDIVIDUAL);
    await commandExplorerPrivateConversation({ command: send("I am being abused"), dependencies: f.dependencies });
    expect(f.observe).toHaveBeenCalledWith(expect.objectContaining({ p_fallback_level: 3 })); expect(f.pauseNotice).not.toHaveBeenCalled();
  });
  it("emits the marker once when observe refuses a crisis message at a second stop", async () => {
    const f = fixture(); f.setPause(INDIVIDUAL); f.observe.mockResolvedValue({ outcome: "paused", policy_state: { ...POLICY, restrictedLevel: 4, version: 1 } });
    await commandExplorerPrivateConversation({ command: send("I want to kill myself"), dependencies: f.dependencies });
    expect(f.signal).toHaveBeenCalledExactlyOnceWith(...MARKER);
  });
  it.each([["denied", { outcome: "denied" }], ["operation_conflict", { outcome: "operation_conflict" }]] as const)(
    "ends a %s pause re-read after observe as the temporary support with its marker", async (_name, reread) => {
      const f = fixture(); f.setPause(INDIVIDUAL);
      f.observe.mockResolvedValue({ outcome: "paused", policy_state: { ...POLICY, restrictedLevel: 4, version: 1 } });
      f.pause.mockResolvedValueOnce(INDIVIDUAL).mockResolvedValueOnce(reread);
      const output = await commandExplorerPrivateConversation({ command: send("I want to kill myself"), dependencies: f.dependencies });
      expect(output.assistance).toMatchObject({ kind: "support", persisted: false }); expect(f.pauseNotice).not.toHaveBeenCalled();
      expect(f.signal).toHaveBeenCalledExactlyOnceWith(...MARKER); expect(f.prepare).not.toHaveBeenCalled();
    });
  it("keeps the static assistance when the refusal's fresh read loses the sign-in or fails", async () => {
    const lost = fixture(); lost.setPause(SHARED);
    const authenticate = vi.fn().mockResolvedValueOnce(ACTOR).mockResolvedValue(null);
    const denied = await commandExplorerPrivateConversation({ command: send("I want to kill myself"), dependencies: { ...lost.dependencies, authenticate } });
    expect(denied).toMatchObject({ result: { ok: false, error: "denied" }, assistance: { kind: "support", persisted: false } });
    expect(lost.pauseNotice).not.toHaveBeenCalled();
    const broken = fixture(); broken.setPause(SHARED); const read = broken.read.getMockImplementation()!; let reads = 0;
    broken.read.mockImplementation(async (...args) => { reads += 1; if (reads === 2) throw new Error("private read detail"); return read(...args); });
    const failedRead = await commandExplorerPrivateConversation({ command: send(), dependencies: broken.dependencies });
    expect(failedRead).toMatchObject({ result: { ok: false, error: "unavailable" }, assistance: { kind: "temporarily_unavailable" } });
    expect(JSON.stringify(failedRead)).not.toContain("private read detail");
  });
  it("stops an aborted Send after the pause read, before ensure, with or without a pause", async () => {
    for (const row of [{ outcome: "ok", notice_kind: null, crisis: false, adults_only: false }, SHARED] as const) {
      const f = fixture(); const controller = new AbortController();
      f.pause.mockImplementation(async () => { controller.abort(); return row; });
      const output = await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies, signal: controller.signal });
      expect(output).toEqual({ result: { ok: false, state: null, error: "unavailable" }, assistance: null });
      expect(f.ensure).not.toHaveBeenCalled(); expect(f.generate).not.toHaveBeenCalled();
    }
  });
  it("writes the screen-open crisis and adults-only parts, and raises no signal", async () => {
    const flags = fixture(); flags.setPolicy({}); flags.setPause({ outcome: "ok", notice_kind: "individual", crisis: true, adults_only: true });
    await readExplorerPrivateConversation(flags.dependencies);
    expect(flags.pauseNotice).toHaveBeenCalledExactlyOnceWith({ kind: "individual", crisis: "urgent", adultsOnly: true, refused: false }, flags.readiness);
    const urgent = fixture(); urgent.setPolicy({ ...POLICY, restrictedLevel: 4, version: 1 }); urgent.setPause(SHARED);
    await readExplorerPrivateConversation(urgent.dependencies);
    expect(urgent.pauseNotice).toHaveBeenCalledExactlyOnceWith({ kind: "shared", crisis: "crisis", adultsOnly: false, refused: false }, urgent.readiness);
    expect(flags.signal).not.toHaveBeenCalled(); expect(urgent.signal).not.toHaveBeenCalled();
  });
});

describe("hard-stop pause notices: fix review cases (REV209d)", () => {
  it("uses the pause flags when the refusal's final read has no known policy, even after a known clear first read", async () => {
    const f = fixture();
    f.pause.mockImplementation(async () => { f.setPolicy({}); return { outcome: "ok", notice_kind: "shared", crisis: true, adults_only: true }; });
    await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(f.pauseNotice).toHaveBeenCalledExactlyOnceWith({ kind: "shared", crisis: "urgent", adultsOnly: true, refused: true }, f.readiness);
  });
  it("keeps facts the final read added in the static assistance when the renderer fails", async () => {
    const f = fixture(); f.pauseNotice.mockImplementation(() => { throw new Error("renderer detail"); });
    f.pause.mockImplementation(async () => {
      f.setPolicy({ ...POLICY, restrictedLevel: 4, adultReflectionStopped: true, version: 2 });
      return { outcome: "ok", notice_kind: "shared", crisis: false, adults_only: false };
    });
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(output.assistance).toEqual({ kind: "support", body: "Synthetic support plus adult-policy failure assistance. No saved reply is claimed.", persisted: false });
    // Facts learned at the final read send the marker once, and the read is repeated so it stays the last wait.
    expect(f.signal).toHaveBeenCalledExactlyOnceWith("preparation_unavailable", expect.any(AbortSignal));
    expect(f.read).toHaveBeenCalledTimes(3);
    expect(f.order.indexOf("signal")).toBeLessThan(f.order.lastIndexOf("read"));
  });
});

describe("hard-stop pause notices: remaining post-check cases (REV209d server-3)", () => {
  const SHARED: ExplorerPrivatePauseRow = { outcome: "ok", notice_kind: "shared", crisis: false, adults_only: false };
  it.each([["denied", { outcome: "denied" }], ["operation_conflict", { outcome: "operation_conflict" }]] as const)(
    "ends a %s pause re-read after prepare as the temporary support with its marker", async (_name, reread) => {
      const f = fixture();
      f.prepare.mockResolvedValue({ outcome: "paused", conversation_state: null, dispatch_permitted: false, policy_state: { ...POLICY, restrictedLevel: 4, version: 1 } });
      f.pause.mockResolvedValueOnce({ outcome: "ok", notice_kind: null, crisis: false, adults_only: false }).mockResolvedValueOnce(reread);
      const output = await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
      expect(output.assistance).toMatchObject({ kind: "support", persisted: false }); expect(f.pauseNotice).not.toHaveBeenCalled();
      expect(f.signal).toHaveBeenCalledExactlyOnceWith("preparation_unavailable", expect.any(AbortSignal));
      expect(f.generate).not.toHaveBeenCalled(); expect(f.settle).not.toHaveBeenCalled();
    });
  it("keeps the static assistance when the fresh read after a post-check refusal fails", async () => {
    const f = fixture();
    f.observe.mockResolvedValue({ outcome: "paused", policy_state: { ...POLICY, restrictedLevel: 4, version: 1 } });
    f.pause.mockResolvedValueOnce({ outcome: "ok", notice_kind: "individual", crisis: false, adults_only: false }).mockResolvedValueOnce(SHARED);
    const read = f.read.getMockImplementation()!; let reads = 0;
    f.read.mockImplementation(async (...args) => { reads += 1; if (reads === 2) throw new Error("private read detail"); return read(...args); });
    const output = await commandExplorerPrivateConversation({ command: send("I want to kill myself"), dependencies: f.dependencies });
    expect(output).toMatchObject({ result: { ok: false, error: "unavailable" }, assistance: { kind: "support", persisted: false } });
    expect(f.signal).toHaveBeenCalledExactlyOnceWith("preparation_unavailable", expect.any(AbortSignal));
    expect(f.prepare).not.toHaveBeenCalled(); expect(JSON.stringify(output)).not.toContain("private read detail");
  });
});

describe("hard-stop pause notices: which read's facts choose the notice (REV209c)", () => {
  const SHARED: ExplorerPrivatePauseRow = { outcome: "ok", notice_kind: "shared", crisis: false, adults_only: false };
  it("takes a refusal's facts from its final read, not the first read, before ensure", async () => {
    const f = fixture();
    f.pause.mockImplementation(async () => { f.setPolicy({ ...POLICY, restrictedLevel: 4, adultReflectionStopped: true, version: 2 }); return SHARED; });
    await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(f.pauseNotice).toHaveBeenCalledExactlyOnceWith({ kind: "shared", crisis: "crisis", adultsOnly: true, refused: true }, f.readiness);
  });
  it("takes a post-check refusal's facts from its final read, not observe's policy", async () => {
    const f = fixture(); f.observe.mockResolvedValue({ outcome: "paused", policy_state: { ...POLICY, restrictedLevel: 3, version: 1 } });
    f.pause.mockResolvedValueOnce({ outcome: "ok", notice_kind: null, crisis: false, adults_only: false })
      .mockImplementationOnce(async () => { f.setPolicy({ ...POLICY, restrictedLevel: 4, version: 2 }); return SHARED; });
    await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(f.pauseNotice).toHaveBeenCalledExactlyOnceWith({ kind: "shared", crisis: "crisis", adultsOnly: false, refused: true }, f.readiness);
  });
  it("keeps the pause read's flags when the final read's policy is unknown, even if the conversation changed (errs toward support)", async () => {
    const f = fixture();
    f.pause.mockImplementation(async () => {
      f.setCurrent(state(ID.conversation)); f.setPolicy({});
      return { outcome: "ok", notice_kind: "shared", crisis: true, adults_only: true };
    });
    await readExplorerPrivateConversation(f.dependencies);
    expect(f.pauseNotice).toHaveBeenCalledExactlyOnceWith({ kind: "shared", crisis: "urgent", adultsOnly: true, refused: false }, f.readiness);
  });
  it("sends the marker once and reads again when a refusal's final read first shows critical facts", async () => {
    const f = fixture();
    f.pause.mockImplementation(async () => { f.order.push("pause"); f.setPolicy({ ...POLICY, restrictedLevel: 4, version: 2 });
      return { outcome: "ok", notice_kind: "shared", crisis: false, adults_only: false }; });
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(f.order).toEqual(["read", "configuration", "pause", "read", "signal", "read"]);
    expect(f.signal).toHaveBeenCalledExactlyOnceWith("preparation_unavailable", expect.any(AbortSignal));
    expect(output.assistance?.kind).toBe("paused");
    expect(f.pauseNotice).toHaveBeenCalledExactlyOnceWith({ kind: "shared", crisis: "crisis", adultsOnly: false, refused: true }, f.readiness);
  });
  it("does not repeat the marker when the facts were already critical before the final read", async () => {
    const f = fixture(); f.setPolicy({ ...POLICY, restrictedLevel: 4, version: 1 });
    f.setPause({ outcome: "ok", notice_kind: "shared", crisis: true, adults_only: false });
    await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(f.order).toEqual(["read", "configuration", "pause", "signal", "read"]);
  });
});

describe("hard-stop pause notices: an unknown final policy keeps the earlier known facts (REV209e regression-1)", () => {
  const SHARED: ExplorerPrivatePauseRow = { outcome: "ok", notice_kind: "shared", crisis: false, adults_only: false };
  it("keeps a level-4 policy known before the final read when that read's policy is unknown", async () => {
    const f = fixture();
    f.prepare.mockResolvedValue({ outcome: "paused", conversation_state: null, dispatch_permitted: false, policy_state: { ...POLICY, restrictedLevel: 4, version: 1 } });
    f.pause.mockResolvedValueOnce({ outcome: "ok", notice_kind: null, crisis: false, adults_only: false })
      .mockImplementationOnce(async () => { f.setPolicy({}); return { outcome: "ok", notice_kind: "shared", crisis: true, adults_only: false }; });
    await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(f.pauseNotice).toHaveBeenCalledExactlyOnceWith({ kind: "shared", crisis: "crisis", adultsOnly: false, refused: true }, f.readiness);
  });
  it("keeps the first read's known facts on screen open when the final read's policy is unknown", async () => {
    const f = fixture(); f.setPolicy({ ...POLICY, restrictedLevel: 4, adultReflectionStopped: true, version: 1 });
    f.pause.mockImplementation(async () => { f.setPolicy({}); return SHARED; });
    await readExplorerPrivateConversation(f.dependencies);
    expect(f.pauseNotice).toHaveBeenCalledExactlyOnceWith({ kind: "shared", crisis: "crisis", adultsOnly: true, refused: false }, f.readiness);
  });
});

describe("hard-stop pause notices: the repeated read after a newly critical refusal read (REV209h)", () => {
  const SHARED: ExplorerPrivatePauseRow = { outcome: "ok", notice_kind: "shared", crisis: false, adults_only: false };
  const CRITICAL = { ...POLICY, restrictedLevel: 4, adultReflectionStopped: true, version: 2 };
  // Reads: 1 the first read, 2 the refusal read (first shows the critical facts), 3 the repeated read.
  function sequence(third: (read: (...args: never[]) => Promise<ExplorerPrivateReadRow>, args: never[]) => Promise<ExplorerPrivateReadRow>) {
    const f = fixture(); const read = f.read.getMockImplementation()!; let reads = 0;
    f.pause.mockImplementation(async () => { f.order.push("pause"); f.setPolicy(CRITICAL); return SHARED; });
    f.read.mockImplementation(async (...args) => { reads += 1; return reads === 3 ? third(read as never, args as never[]) : read(...args); });
    return f;
  }
  it("keeps the facts the refusal read showed when the repeated read fails", async () => {
    const f = sequence(async () => { throw new Error("private read detail"); });
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(output).toEqual({ result: { ok: false, state: null, error: "unavailable" }, assistance: { kind: "support",
      body: "Synthetic support plus adult-policy failure assistance. No saved reply is claimed.", persisted: false } });
    expect(f.signal).toHaveBeenCalledOnce();
    expect(f.read).toHaveBeenNthCalledWith(3, ACTOR, { operationId: ID.operation, fingerprint: expect.any(String) });
  });
  it("keeps the facts the refusal read showed when the repeated read's policy is unknown", async () => {
    const f = sequence(async (read, args) => ({ ...(await read(...args)), policy_state: {} }));
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(f.pauseNotice).toHaveBeenCalledExactlyOnceWith({ kind: "shared", crisis: "crisis", adultsOnly: true, refused: true }, f.readiness);
    expect(output.assistance?.kind).toBe("paused");
  });
  it("reports a duplicate that committed during the marker as its replay, without a notice", async () => {
    const f = sequence(async () => ({ outcome: "exact_replay", conversation_state: { ...state(ID.conversation), revision: 2 }, policy_state: CRITICAL }));
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(output.assistance).toBeNull(); expect(f.pauseNotice).not.toHaveBeenCalled();
    expect(output.result).toMatchObject({ ok: true, state: { revision: 2 } });
  });
  it("still makes the repeated read, with one marker attempt, when the signal port fails", async () => {
    const f = sequence(async (read, args) => read(...args)); f.signal.mockRejectedValue(new Error("signal detail"));
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(f.signal).toHaveBeenCalledOnce(); expect(f.read).toHaveBeenCalledTimes(3); expect(output.assistance?.kind).toBe("paused");
  });
  it("checks the test allowance after the repeated read, and returns nothing private after cancellation", async () => {
    let used = false;
    const f = sequence(async (read, args) => { used = true; return read(...args); });
    const late = await commandExplorerPrivateConversation({ command: send(), dependencies: { ...f.dependencies, sendCapacityAvailable: () => !used } });
    expect(late.result).toMatchObject({ ok: true, state: { providerState: "unavailable" } });
    const g = fixture(); const controller = new AbortController();
    g.pause.mockImplementation(async () => { g.setPolicy(CRITICAL); return SHARED; });
    g.signal.mockImplementation(async () => { controller.abort(); });
    const aborted = await commandExplorerPrivateConversation({ command: send(), dependencies: g.dependencies, signal: controller.signal });
    expect(aborted).toEqual({ result: { ok: false, state: null, error: "unavailable" }, assistance: null });
  });
});

describe("hard-stop pause notices: remaining repeated-read cases (REV209g)", () => {
  const SHARED: ExplorerPrivatePauseRow = { outcome: "ok", notice_kind: "shared", crisis: false, adults_only: false };
  const CRITICAL = { ...POLICY, restrictedLevel: 4, adultReflectionStopped: true, version: 2 };
  it("raises no marker when the refusal's first read is already the exact replay, even with critical facts", async () => {
    const f = fixture(); f.setPause(SHARED); const read = f.read.getMockImplementation()!; let reads = 0;
    f.read.mockImplementation(async (...args) => { reads += 1;
      return reads === 2 ? { outcome: "exact_replay", conversation_state: { ...state(ID.conversation), revision: 2 }, policy_state: CRITICAL } : read(...args); });
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(f.signal).not.toHaveBeenCalled(); expect(f.read).toHaveBeenCalledTimes(2); expect(output.assistance).toBeNull();
  });
  it("repeats the read after a post-check refusal whose final read first shows critical facts", async () => {
    const f = fixture(); f.observe.mockResolvedValue({ outcome: "paused", policy_state: POLICY });
    f.pause.mockResolvedValueOnce({ outcome: "ok", notice_kind: null, crisis: false, adults_only: false })
      .mockImplementationOnce(async () => { f.setPolicy(CRITICAL); return SHARED; });
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(f.signal).toHaveBeenCalledOnce();
    expect(f.order.slice(-3)).toEqual(["read", "signal", "read"]);
    expect(f.pauseNotice).toHaveBeenCalledExactlyOnceWith({ kind: "shared", crisis: "crisis", adultsOnly: true, refused: true }, f.readiness);
    expect(output.assistance?.kind).toBe("paused"); expect(f.prepare).not.toHaveBeenCalled();
  });
});

describe("hard-stop pause notices: the repeated read's denial, marker timeout and cancellation (REV209i)", () => {
  const SHARED: ExplorerPrivatePauseRow = { outcome: "ok", notice_kind: "shared", crisis: false, adults_only: false };
  const CRITICAL = { ...POLICY, restrictedLevel: 4, adultReflectionStopped: true, version: 2 };
  const COMBINED = { kind: "support", body: "Synthetic support plus adult-policy failure assistance. No saved reply is claimed.", persisted: false };
  it("keeps the retained facts when the repeated read loses the sign-in", async () => {
    const f = fixture(); f.pause.mockImplementation(async () => { f.setPolicy(CRITICAL); return SHARED; });
    const authenticate = vi.fn().mockResolvedValueOnce(ACTOR).mockResolvedValueOnce(ACTOR).mockResolvedValue(null);
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: { ...f.dependencies, authenticate } });
    expect(output).toEqual({ result: { ok: false, state: null, error: "denied" }, assistance: COMBINED });
    expect(authenticate).toHaveBeenCalledTimes(3); expect(f.signal).toHaveBeenCalledOnce();
  });
  it("makes the repeated selector read after a marker that times out, with one attempt", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const f = fixture(); f.pause.mockImplementation(async () => { f.setPolicy(CRITICAL); return SHARED; });
    f.signal.mockImplementation(() => new Promise<void>(() => undefined));
    const pending = commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    await vi.advanceTimersByTimeAsync(1000);
    const output = await pending;
    expect(f.signal).toHaveBeenCalledOnce(); expect(f.read).toHaveBeenCalledTimes(3);
    expect(f.read).toHaveBeenNthCalledWith(3, ACTOR, { operationId: ID.operation, fingerprint: expect.any(String) });
    expect(output.assistance?.kind).toBe("paused");
  });
  it("returns nothing private when cancelled during the repeated read", async () => {
    const f = fixture(); const controller = new AbortController(); const read = f.read.getMockImplementation()!; let reads = 0;
    f.pause.mockImplementation(async () => { f.setPolicy(CRITICAL); return SHARED; });
    f.read.mockImplementation(async (...args) => { reads += 1; if (reads === 3) controller.abort(); return read(...args); });
    const output = await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies, signal: controller.signal });
    expect(output).toEqual({ result: { ok: false, state: null, error: "unavailable" }, assistance: null }); expect(reads).toBe(3);
  });
});
