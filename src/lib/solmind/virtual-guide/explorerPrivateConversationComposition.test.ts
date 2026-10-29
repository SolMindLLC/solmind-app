import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getExplorerPrivateConfigurationCandidate } from "./explorerPrivateConfiguration";
import { EXPLORER_SAFETY_REQUEST_VERSION } from "./explorerSafetyReplyContract";
import { adaptPrivateGovernedExplorerContextBuilder, readExplorerPrivateConversation, readEndedExplorerConversations, commandExplorerPrivateConversation, deriveExplorerPrivateTurnIds, parseExplorerPrivatePolicy,
  type ExplorerPrivateConversationDependencies, type ExplorerPrivateOperationalReadiness, type ExplorerPrivateRpcRow, type ExplorerPrivateReadRow,
  type ExplorerPrivateEnsureParameters, type ExplorerPrivatePrepareParameters, type ExplorerPrivateSettleParameters, type ExplorerPrivateArrangeParameters, type ExplorerPrivateEndParameters, type ExplorerPrivateReviewParameters } from "./explorerPrivateConversationComposition";
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
  const generate = vi.fn(async () => { order.push("model"); return RAW; });
  const signal = vi.fn(async () => { order.push("signal"); });
  const resolve = vi.fn(async () => { order.push("configuration"); return readiness; });
  const dependencies: ExplorerPrivateConversationDependencies = {
    authenticate: vi.fn(async () => ACTOR), repository: { read, ensure, observe, prepare, settle, mutate, arrange, end, review },
    resolveOperationalReadiness: resolve, provider: { generate }, operationalSignal: { verificationReceiptSha256: SHA, emit: signal },
    renderer: { verificationReceiptSha256: SHA,
      // Explicit synthetic test bodies/receipts, never operational acceptance.
      failureAssistance: { support: "Synthetic support failure assistance. No saved reply is claimed.",
        adultPolicy: "Synthetic adult-policy failure assistance. No saved reply is claimed.",
        supportAndAdultPolicy: "Synthetic support plus adult-policy failure assistance. No saved reply is claimed.",
        temporarilyUnavailable: "Synthetic unavailable assistance. Reload to inspect saved state." },
      render: vi.fn(async (plan: ExplorerSafetyReplyPlan, ready: ExplorerPrivateOperationalReadiness) => ({ kind: plan.kind === "restricted_followup" ? "restricted" as const : plan.kind as "urgent" | "crisis" | "adult_only",
        body: "Synthetic reviewed support rendering.", trustedResponseVersion: ready.configuration.trustedResponses.version, resourcePolicyVersion: ready.resourcePolicyVersion })) },
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
  return { dependencies, read, ensure, observe, prepare, settle, mutate, arrange, end, review, generate, signal, resolve, order, readiness,
    getPrepared: () => prepared, setCurrent: (value: ExplorerConversationState) => { current = value; }, setPolicy: (value: Record<string, unknown>) => { policy = value; } };
}
function send(body = "Synthetic ordinary message.") { return { kind: "send", operationId: ID.operation, expectedRevision: 0, body }; }
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("Held private Explorer controller: explicit synthetic ports only", () => {
  it("owns the actual ensure identity, fresh AV3 read, one model observation and one terminal", async () => {
    const f = fixture(); const output = await commandExplorerPrivateConversation({ command: send(), dependencies: f.dependencies });
    expect(output.result.ok).toBe(true); expect(output.assistance).toBeNull(); expect(f.generate).toHaveBeenCalledOnce(); expect(f.settle).toHaveBeenCalledOnce();
    expect(f.order).toEqual(["read", "configuration", "ensure", "observe", "read", "context", "prepare", "model", "settle"]);
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
