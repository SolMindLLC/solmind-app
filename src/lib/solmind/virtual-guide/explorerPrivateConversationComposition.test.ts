import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getExplorerPrivateConfigurationCandidate } from "./explorerPrivateConfiguration";
import { EXPLORER_SAFETY_REQUEST_VERSION } from "./explorerSafetyReplyContract";
import { adaptPrivateGovernedExplorerContextBuilder, readExplorerPrivateConversation, commandExplorerPrivateConversation, deriveExplorerPrivateTurnIds, parseExplorerPrivatePolicy,
  type ExplorerPrivateConversationDependencies, type ExplorerPrivateOperationalReadiness, type ExplorerPrivateRpcRow, type ExplorerPrivateReadRow,
  type ExplorerPrivateEnsureParameters, type ExplorerPrivatePrepareParameters, type ExplorerPrivateSettleParameters } from "./explorerPrivateConversationComposition";
import type { ExplorerConversationState } from "../explorerConversationContract";
import type { ExplorerSafetyReplyPlan } from "./explorerConversationSafety";
import type { ExplorerConversationDependencies } from "./explorerConversationComposition";

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
  const generate = vi.fn(async () => { order.push("model"); return RAW; });
  const signal = vi.fn(async () => { order.push("signal"); });
  const resolve = vi.fn(async () => { order.push("configuration"); return readiness; });
  const dependencies: ExplorerPrivateConversationDependencies = {
    authenticate: vi.fn(async () => ACTOR), repository: { read, ensure, observe, prepare, settle, mutate },
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
  return { dependencies, read, ensure, observe, prepare, settle, mutate, generate, signal, resolve, order, readiness,
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
    for (const port of [f.ensure, f.observe, f.prepare, f.settle, f.mutate, f.generate]) expect(port).not.toHaveBeenCalled();
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
