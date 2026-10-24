// Synthetic ports prove composition behavior only; actual runs are recorded separately.
// No real request-auth, database, provider, network or persistence proof is claimed.
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  commandExplorerConversation,
  readExplorerConversation,
  explorerConversationCommandFingerprint,
  type ExplorerConversationActor,
  type ExplorerConversationDependencies,
  type ExplorerConversationRepository,
  type ExplorerConversationRpcRow,
} from "./explorerConversationComposition";
import {
  VIRTUAL_GUIDE_CONVERSATION_CONTRACT_VERSION,
  type VirtualGuideConversationRequest,
  type VirtualGuideConversationTransport,
} from "./virtualGuideConversationContract";
import {
  EXPLORER_CONVERSATION_VERSION,
  type ExplorerConversationCommand,
  type ExplorerConversationState,
} from "../explorerConversationContract";

const ID = Object.freeze({
  account: "10000000-0000-4000-8000-000000000001",
  otherAccount: "10000000-0000-4000-8000-000000000002",
  applicationSession: "20000000-0000-4000-8000-000000000001",
  otherSession: "20000000-0000-4000-8000-000000000002",
  explorer: "30000000-0000-4000-8000-000000000001",
  conversation: "40000000-0000-4000-8000-000000000001",
  sourceMessage: "50000000-0000-4000-8000-000000000001",
  providerMessage: "50000000-0000-4000-8000-000000000002",
  operation: "60000000-0000-4000-8000-000000000001",
  item: "70000000-0000-4000-8000-000000000001",
  waypoint: "80000000-0000-4000-8000-000000000001",
});
const actor: ExplorerConversationActor = Object.freeze({ accountId: ID.account, applicationSessionId: ID.applicationSession });
const denied = { ok: false, state: null, error: "denied" };
const unavailable = { ok: false, state: null, error: "unavailable" };
const send: ExplorerConversationCommand = Object.freeze({ kind: "send", operationId: ID.operation, expectedRevision: 4, body: "A new synthetic question" });
function state(): ExplorerConversationState {
  return {
    version: EXPLORER_CONVERSATION_VERSION, conversationId: ID.conversation,
    revision: 4, providerState: "available", pendingTurn: false,
    messages: [{ id: ID.sourceMessage, role: "explorer", body: "An earlier saved question", createdAt: "2026-10-24T06:00:00.000Z" }],
    compassItems: [{ id: ID.item, sourceMessageId: ID.sourceMessage, label: "An Explorer-selected focus" }],
    priorityId: null, attentionId: ID.item, waypoints: [],
  };
}
function row(conversation = state(), outcome = "ok"): ExplorerConversationRpcRow {
  return { outcome, conversation_state: conversation, authority_context: { synthetic: "not authenticated production authority" } };
}
function providerResponse(request: VirtualGuideConversationRequest) {
  return {
    contractVersion: VIRTUAL_GUIDE_CONVERSATION_CONTRACT_VERSION,
    invocationId: request.invocationId,
    assistantMessage: { messageId: ID.providerMessage, role: "solmind_virtual_guide", content: "A synthetic provider-port reply" },
    finishReason: "completed",
  };
}
function fixture() {
  const authenticate = vi.fn<ExplorerConversationDependencies["authenticate"]>().mockResolvedValue(actor);
  const read = vi.fn<ExplorerConversationRepository["read"]>().mockResolvedValue(row());
  const prepare = vi.fn<ExplorerConversationRepository["prepare"]>().mockResolvedValue({ ...row(), dispatch_permitted: true });
  const mutate = vi.fn<ExplorerConversationRepository["mutate"]>().mockResolvedValue(row({ ...state(), revision: 5 }));
  const complete = vi.fn<ExplorerConversationRepository["complete"]>().mockImplementation(async parameters => {
    if (parameters.p_status !== "completed") return row();
    const prepared = prepare.mock.calls[0]?.[0];
    return row({ ...state(), revision: 6, messages: [
      ...state().messages,
      { id: String(prepared?.p_message_id), role: "explorer", body: String(prepared?.p_body), createdAt: "2026-10-24T06:00:01.000Z" },
      { id: String(parameters.p_reply_message_id), role: "virtualGuide", body: String(parameters.p_reply_body), createdAt: "2026-10-24T06:00:02.000Z" },
    ] });
  });
  const generate = vi.fn<VirtualGuideConversationTransport["generate"]>().mockImplementation(async request => providerResponse(request));
  const buildContext = vi.fn<NonNullable<ExplorerConversationDependencies["buildContext"]>>().mockImplementation(async input => {
    const authorizedContext = JSON.stringify({ syntheticContext: true, immediateExplorerMessage: { content: input.command.body } });
    return {
      request: {
        contractVersion: VIRTUAL_GUIDE_CONVERSATION_CONTRACT_VERSION,
        invocationId: input.ids.invocationId, explorerId: ID.explorer,
        sessionId: input.ids.conversationId, contextSnapshotId: input.ids.snapshotId,
        contextFingerprint: createHash("sha256").update(authorizedContext).digest("hex").toUpperCase(),
        authorizedContext,
      },
      evidence: { p_synthetic_context_proof: "test-only" },
    };
  });
  const dependencies: ExplorerConversationDependencies = {
    authenticate, repository: { read, prepare, complete, mutate }, provider: { generate }, buildContext,
  };
  return { dependencies, authenticate, read, prepare, complete, mutate, generate, buildContext };
}
function noWrite(f: ReturnType<typeof fixture>) {
  expect(f.prepare).not.toHaveBeenCalled();
  expect(f.complete).not.toHaveBeenCalled();
  expect(f.mutate).not.toHaveBeenCalled();
  expect(f.generate).not.toHaveBeenCalled();
}

beforeEach(() => { vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected_network_effect")); });
afterEach(() => { expect(globalThis.fetch).not.toHaveBeenCalled(); vi.restoreAllMocks(); });

describe("Explorer conversation composition with synthetic ports", () => {
  it("E01 derives every read from a fresh authenticated actor and disables held provider", async () => {
    const f = fixture();
    const held: ExplorerConversationDependencies = { authenticate: f.authenticate, repository: f.dependencies.repository };
    const first = await readExplorerConversation(held);
    f.authenticate.mockResolvedValueOnce({ accountId: ID.otherAccount, applicationSessionId: ID.otherSession });
    const second = await readExplorerConversation(held);
    expect(first.ok && first.state.providerState).toBe("unavailable");
    expect(second.ok).toBe(true);
    expect(f.authenticate).toHaveBeenCalledTimes(2);
    expect(f.read.mock.calls).toEqual([[actor], [{ accountId: ID.otherAccount, applicationSessionId: ID.otherSession }]]);
    noWrite(f);
  });

  it.each([null, { accountId: "not-a-uuid", applicationSessionId: ID.applicationSession }])("E02 denies missing or invalid identity without repository IO (%j)", async candidate => {
    const f = fixture();
    f.authenticate.mockResolvedValue(candidate);
    expect(await readExplorerConversation(f.dependencies)).toEqual(denied);
    expect(await commandExplorerConversation({ command: send, dependencies: f.dependencies })).toEqual(denied);
    expect(f.read).not.toHaveBeenCalled(); noWrite(f);
  });

  it("E03 auth failures stay value-free and do not reach repository", async () => {
    const f = fixture(); f.authenticate.mockRejectedValue(new Error("private_auth_diagnostic"));
    expect(await commandExplorerConversation({ command: send, dependencies: f.dependencies })).toEqual(unavailable);
    expect(f.read).not.toHaveBeenCalled(); noWrite(f);
  });

  it.each([
    { ...send, actorAccountId: ID.otherAccount }, { ...send, sessionId: ID.otherSession },
    { ...send, roleContext: "admin" }, { ...send, conversationId: ID.conversation },
    { ...send, operationId: "not-an-id" }, { ...send, expectedRevision: -1 },
  ])("E04 rejects malformed browser authority before authentication (%j)", async command => {
    const f = fixture();
    expect(await commandExplorerConversation({ command, dependencies: f.dependencies })).toEqual(denied);
    expect(f.authenticate).not.toHaveBeenCalled(); expect(f.read).not.toHaveBeenCalled(); noWrite(f);
  });

  it.each(["provider", "buildContext", "both"] as const)("E05 held %s makes no context, write or dispatch", async missing => {
    const f = fixture();
    const dependencies: ExplorerConversationDependencies = {
      authenticate: f.authenticate, repository: f.dependencies.repository,
      ...(missing !== "provider" && missing !== "both" ? { provider: f.dependencies.provider } : {}),
      ...(missing !== "buildContext" && missing !== "both" ? { buildContext: f.buildContext } : {}),
    };
    expect(await commandExplorerConversation({ command: send, dependencies })).toEqual({ ok: false, state: null, error: "provider_unavailable" });
    expect(f.authenticate).toHaveBeenCalledOnce(); expect(f.read).toHaveBeenCalledWith(actor,
      { operationId: send.operationId, fingerprint: explorerConversationCommandFingerprint(send) });
    expect(f.buildContext).not.toHaveBeenCalled(); noWrite(f);
  });

  it.each(["denied", "stale_revision", "operation_conflict", "unexpected_outcome"])("E06 read admission outcome %s prevents follow-on effects", async outcome => {
    const f = fixture(); f.read.mockResolvedValue(row(state(), outcome));
    const result = await commandExplorerConversation({ command: send, dependencies: f.dependencies });
    expect(result).toEqual({ ok: false, state: null, error: outcome === "denied" ? "denied" : ["stale_revision", "operation_conflict"].includes(outcome) ? "refresh_required" : "unavailable" });
    expect(f.buildContext).not.toHaveBeenCalled(); noWrite(f);
  });

  it("E07 malformed repository state never reaches context or provider", async () => {
    const f = fixture(); f.read.mockResolvedValue({ outcome: "ok", conversation_state: { ...state(), authority: ID.account } });
    expect(await commandExplorerConversation({ command: send, dependencies: f.dependencies })).toEqual(unavailable);
    expect(f.buildContext).not.toHaveBeenCalled(); noWrite(f);
  });

  it("E08 formation uses authenticated server identity and forwards exact source/confirmation", async () => {
    const f = fixture();
    const command: ExplorerConversationCommand = { kind: "confirm_waypoint", operationId: ID.operation, expectedRevision: 4,
      sourceMessageId: ID.sourceMessage, destination: "Have the conversation", meaning: "Say what matters", arrivalSignal: "I have said it clearly" };
    const result = await commandExplorerConversation({ command, dependencies: f.dependencies });
    expect(result.ok).toBe(true);
    expect(f.mutate).toHaveBeenCalledExactlyOnceWith({
      p_actor_user_account_id: ID.account, p_user_session_id: ID.applicationSession,
      p_conversation_id: ID.conversation, p_operation_id: ID.operation, p_expected_revision: 4,
      p_command_fingerprint: explorerConversationCommandFingerprint(command),
      p_kind: "confirm_waypoint", p_source_message_id: ID.sourceMessage,
      p_item_id: null, p_waypoint_id: null, p_label: null, p_destination: command.destination,
      p_meaning: command.meaning, p_arrival_signal: command.arrivalSignal, p_evidence: null,
    });
    expect(f.buildContext).not.toHaveBeenCalled(); expect(f.generate).not.toHaveBeenCalled();
    expect(f.prepare).not.toHaveBeenCalled(); expect(f.complete).not.toHaveBeenCalled();
  });

  it("E09 reached forwards fresh evidence without an invented reply", async () => {
    const f = fixture();
    await commandExplorerConversation({ command: { kind: "confirm_reached", operationId: ID.operation, expectedRevision: 4,
      waypointId: ID.waypoint, evidence: "I had the conversation and said what mattered" }, dependencies: f.dependencies });
    expect(f.mutate.mock.calls[0]?.[0]).toMatchObject({ p_kind: "confirm_reached", p_waypoint_id: ID.waypoint,
      p_evidence: "I had the conversation and said what mattered", p_source_message_id: null });
    expect(f.generate).not.toHaveBeenCalled(); expect(f.prepare).not.toHaveBeenCalled();
  });

  it("E10 formation without a server-owned conversation is denied", async () => {
    const f = fixture(); f.read.mockResolvedValue(row({ ...state(), conversationId: null, revision: 0,
      messages: [], compassItems: [], attentionId: null }));
    expect(await commandExplorerConversation({ command: { kind: "confirm_priority", operationId: ID.operation, expectedRevision: 0, itemId: ID.item }, dependencies: f.dependencies })).toEqual(denied);
    noWrite(f);
  });

  it.each(["stale_revision", "operation_conflict"])("E11 formation %s stays refresh-required without provider effects", async outcome => {
    const f = fixture(); f.mutate.mockResolvedValue(row(state(), outcome));
    expect(await commandExplorerConversation({ command: { kind: "set_attention", operationId: ID.operation, expectedRevision: 1, itemId: ID.item }, dependencies: f.dependencies })).toEqual({ ok: false, state: null, error: "refresh_required" });
    expect(f.mutate.mock.calls[0]?.[0].p_expected_revision).toBe(1);
    expect(f.generate).not.toHaveBeenCalled(); expect(f.buildContext).not.toHaveBeenCalled();
  });

  it("E12 real S03B contract accepts the injected synthetic response and server reply ID", async () => {
    const f = fixture();
    const result = await commandExplorerConversation({ command: send, dependencies: f.dependencies });
    expect(result.ok).toBe(true);
    expect(f.generate).toHaveBeenCalledOnce(); expect(f.prepare).toHaveBeenCalledOnce();
    expect(f.complete).toHaveBeenCalledOnce();
    const ids = f.buildContext.mock.calls[0][0].ids;
    expect(ids.logicalOperationId).not.toBe(send.operationId);
    expect(f.prepare.mock.calls[0][0]).toMatchObject({ p_actor_user_account_id: ID.account,
      p_logical_operation_id: ids.logicalOperationId,
      p_user_session_id: ID.applicationSession, p_message_id: ids.messageId,
      p_snapshot_id: ids.snapshotId, p_invocation_id: ids.invocationId, p_body: send.body });
    expect(f.complete.mock.calls[0][0]).toMatchObject({ p_status: "completed", p_reply_message_id: ids.replyId,
      p_reply_body: "A synthetic provider-port reply" });
    expect(ids.replyId).not.toBe(ID.providerMessage);
    expect(result.ok && result.state.messages.at(-1)?.body).toBe("A synthetic provider-port reply");
  });

  it("E13 server-scoped identities are stable for exact retry and change with authenticated bindings", async () => {
    const run = async (boundActor: ExplorerConversationActor) => {
      const f = fixture(); f.authenticate.mockResolvedValue(boundActor);
      f.prepare.mockResolvedValue(row(state(), "exact_replay"));
      await commandExplorerConversation({ command: send, dependencies: f.dependencies });
      expect(f.generate).not.toHaveBeenCalled();
      return f.buildContext.mock.calls[0][0].ids;
    };
    const first = await run(actor), repeat = await run(actor);
    expect(repeat).toEqual(first);
    expect(new Set([first.messageId, first.snapshotId, first.invocationId, first.replyId]).size).toBe(4);
    expect(await run({ ...actor, accountId: ID.otherAccount })).not.toEqual(first);
    expect(await run({ ...actor, applicationSessionId: ID.otherSession })).not.toEqual(first);
  });

  it("E14 exact replay returns stored state without redispatch or terminal write", async () => {
    const f = fixture(); f.prepare.mockResolvedValue({ ...row({ ...state(), revision: 8 }, "exact_replay"), dispatch_permitted: true });
    const result = await commandExplorerConversation({ command: send, dependencies: f.dependencies });
    expect(result.ok && result.state.revision).toBe(8);
    expect(f.prepare).toHaveBeenCalledOnce(); expect(f.generate).not.toHaveBeenCalled(); expect(f.complete).not.toHaveBeenCalled();
  });

  it.each(["stale_revision", "operation_conflict", "denied"])("E15 prepare %s prevents provider IO", async outcome => {
    const f = fixture(); f.prepare.mockResolvedValue({ ...row(state(), outcome), dispatch_permitted: true });
    const result = await commandExplorerConversation({ command: send, dependencies: f.dependencies });
    expect(result).toEqual({ ok: false, state: null, error: outcome === "denied" ? "denied" : "refresh_required" });
    expect(f.generate).not.toHaveBeenCalled(); expect(f.complete).not.toHaveBeenCalled();
  });

  it("E16 lack of an explicit dispatch grant never calls the provider", async () => {
    const f = fixture(); f.prepare.mockResolvedValue({ ...row(), dispatch_permitted: false });
    await commandExplorerConversation({ command: send, dependencies: f.dependencies });
    expect(f.generate).not.toHaveBeenCalled(); expect(f.complete).not.toHaveBeenCalled();
  });

  it.each(["invocationId", "sessionId", "contextSnapshotId"] as const)("E17 context %s mismatch stops before preparation", async key => {
    const f = fixture(); const original = f.buildContext.getMockImplementation()!;
    f.buildContext.mockImplementation(async input => {
      const context = await original(input);
      return { ...context, request: { ...context.request, [key]: ID.otherSession } };
    });
    expect(await commandExplorerConversation({ command: send, dependencies: f.dependencies })).toEqual(unavailable);
    noWrite(f);
  });

  it("E18 provider transport failure records only a closed terminal failure", async () => {
    const f = fixture(); f.generate.mockRejectedValue(new Error("private_provider_body"));
    expect(await commandExplorerConversation({ command: send, dependencies: f.dependencies })).toEqual(unavailable);
    expect(f.generate).toHaveBeenCalledOnce();
    expect(f.complete.mock.calls).toHaveLength(1);
    expect(f.complete.mock.calls[0][0]).toMatchObject({ p_status: "failed", p_reply_message_id: null, p_reply_body: null });
    expect(JSON.stringify(f.complete.mock.calls)).not.toContain("private_provider_body");
  });

  it("E19 malformed provider response cannot be persisted as a reply", async () => {
    const f = fixture(); f.generate.mockResolvedValue({ assistantMessage: { role: "virtualGuide", content: "An invalid envelope" } });
    expect(await commandExplorerConversation({ command: send, dependencies: f.dependencies })).toEqual(unavailable);
    expect(f.complete.mock.calls[0][0]).toMatchObject({ p_status: "failed", p_reply_body: null });
    expect(f.complete.mock.calls.some(([parameters]) => parameters.p_status === "completed")).toBe(false);
  });

  it.each(["completed", "refused", "safety_redirect"])("E19A oversized %s reply settles failed without content, retry or a success write", async finishReason => {
    const f = fixture();
    const oversized = Array.from({ length: 301 }, () => "privateoversizedreply").join(" ");
    f.generate.mockImplementation(async request => ({ ...providerResponse(request), finishReason,
      assistantMessage: { messageId: ID.providerMessage, role: "solmind_virtual_guide", content: oversized } }));
    expect(await commandExplorerConversation({ command: send, dependencies: f.dependencies })).toEqual(unavailable);
    expect(f.generate).toHaveBeenCalledOnce();
    expect(f.complete.mock.calls).toHaveLength(1);
    expect(f.complete.mock.calls[0][0]).toMatchObject({ p_status: "failed", p_reply_message_id: null, p_reply_body: null });
    expect(JSON.stringify(f.complete.mock.calls)).not.toContain("privateoversizedreply");
    f.read.mockResolvedValueOnce(row({ ...state(), revision: 5 }, "exact_replay"));
    const replay = await commandExplorerConversation({ command: send, dependencies: f.dependencies });
    expect(replay.ok).toBe(true);
    expect(f.generate).toHaveBeenCalledOnce();
    expect(f.complete).toHaveBeenCalledOnce();
  });

  it("E19B exactly300 words reach successful persistence unchanged", async () => {
    const f = fixture(); const content = Array.from({ length: 300 }, () => "calm").join(" ");
    f.generate.mockImplementation(async request => ({ ...providerResponse(request),
      assistantMessage: { messageId: ID.providerMessage, role: "solmind_virtual_guide", content } }));
    expect((await commandExplorerConversation({ command: send, dependencies: f.dependencies })).ok).toBe(true);
    expect(f.complete.mock.calls).toHaveLength(1);
    expect(f.complete.mock.calls[0][0]).toMatchObject({ p_status: "completed", p_reply_body: content });
  });

  it("E20 failed terminal persistence stays unavailable without a fabricated saved reply", async () => {
    const f = fixture(); f.complete.mockRejectedValue(new Error("private_database_failure"));
    expect(await commandExplorerConversation({ command: send, dependencies: f.dependencies })).toEqual(unavailable);
    expect(f.generate).toHaveBeenCalledOnce();
    expect(f.complete.mock.calls[0][0].p_status).toBe("completed");
    expect(f.complete.mock.calls.at(-1)?.[0]).toMatchObject({ p_status: "failed", p_reply_body: null });
  });

  it("E21 already-aborted request reaches neither repository nor provider", async () => {
    const f = fixture(); const controller = new AbortController(); controller.abort();
    expect(await commandExplorerConversation({ command: send, dependencies: f.dependencies, signal: controller.signal })).toEqual(unavailable);
    expect(f.read).not.toHaveBeenCalled(); expect(f.buildContext).not.toHaveBeenCalled(); noWrite(f);
  });

  it.each(["send", "formation"] as const)("E22 abort during read prevents the next %s effect", async kind => {
    const f = fixture(); const controller = new AbortController();
    f.read.mockImplementation(async () => { controller.abort(); return row(); });
    const command: ExplorerConversationCommand = kind === "send" ? send : { kind: "set_attention", operationId: ID.operation, expectedRevision: 4, itemId: ID.item };
    expect(await commandExplorerConversation({ command, dependencies: f.dependencies, signal: controller.signal })).toEqual(unavailable);
    expect(f.buildContext).not.toHaveBeenCalled(); noWrite(f);
  });

  it("E23 abort during context build prevents preparation", async () => {
    const f = fixture(); const controller = new AbortController(); const original = f.buildContext.getMockImplementation()!;
    f.buildContext.mockImplementation(async input => { const context = await original(input); controller.abort(); return context; });
    expect(await commandExplorerConversation({ command: send, dependencies: f.dependencies, signal: controller.signal })).toEqual(unavailable);
    noWrite(f);
  });

  it("E24 caller cancellation at provider dispatch records canceled with no reply", async () => {
    const f = fixture(); const controller = new AbortController();
    f.generate.mockImplementation(async () => { controller.abort(); throw new Error("synthetic_cancellation"); });
    expect(await commandExplorerConversation({ command: send, dependencies: f.dependencies, signal: controller.signal })).toEqual(unavailable);
    expect(f.generate).toHaveBeenCalledOnce();
    expect(f.complete.mock.calls.at(-1)?.[0]).toMatchObject({ p_status: "canceled", p_reply_message_id: null, p_reply_body: null });
  });
  it("E25 recovers an already saved turn before context composition, even with provider held", async () => {
    const f = fixture(); f.read.mockResolvedValue(row({ ...state(), revision: 8, pendingTurn: true }, "exact_replay"));
    const held = { authenticate: f.authenticate, repository: f.dependencies.repository };
    const response = await commandExplorerConversation({ command: send, dependencies: held });
    expect(response.ok && response.state.pendingTurn).toBe(true);
    expect(f.buildContext).not.toHaveBeenCalled(); noWrite(f);
  });
  it("E26 does not start a new command while an earlier turn is pending", async () => {
    const f = fixture(); f.read.mockResolvedValue(row({ ...state(), pendingTurn: true }));
    expect(await commandExplorerConversation({ command: send, dependencies: f.dependencies })).toEqual({ ok: false, state: null, error: "refresh_required" });
    expect(f.buildContext).not.toHaveBeenCalled(); noWrite(f);
  });
  it.each([99, 100])("E28 refuses a new send at %i messages before context or effects", async count => {
    const f = fixture();
    const messages = Array.from({ length: count }, (_, index) => ({ ...state().messages[0],
      id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}` }));
    f.read.mockResolvedValue(row({ ...state(), messages }));
    expect(await commandExplorerConversation({ command: send, dependencies: f.dependencies })).toEqual({ ok: false, state: null, error: "refresh_required" });
    expect(f.buildContext).not.toHaveBeenCalled(); noWrite(f);
  });
  it("E27 command fingerprints preserve text bytes and bind the exact operation/revision", () => {
    const first = explorerConversationCommandFingerprint(send);
    expect(first).toMatch(/^[A-F0-9]{64}$/);
    expect(explorerConversationCommandFingerprint({ body: send.body, expectedRevision: send.expectedRevision, operationId: send.operationId, kind: "send" })).toBe(first);
    for (const changed of [{ ...send, body: `${send.body} ` }, { ...send, expectedRevision: 5 }, { ...send, operationId: ID.otherSession }]) {
      expect(explorerConversationCommandFingerprint(changed)).not.toBe(first);
    }
  });
});
