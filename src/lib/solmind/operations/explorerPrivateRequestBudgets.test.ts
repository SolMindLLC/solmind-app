import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withExplorerPrivateRequestBudgets } from "./explorerPrivateRequestBudgets";
import { getExplorerPrivateConfigurationCandidate } from "../virtual-guide/explorerPrivateConfiguration";
import type {
  ExplorerPrivateConversationDependencies, ExplorerPrivateConversationRepository,
  ExplorerPrivateOperationalReadiness, ExplorerPrivateReadRow,
  ExplorerPrivateEnsureParameters, ExplorerPrivateObserveParameters,
  ExplorerPrivatePrepareParameters, ExplorerPrivateSettleParameters, ExplorerPrivateMutateParameters,
} from "../virtual-guide/explorerPrivateConversationComposition";

// Explicit synthetic ports only. Local timeout outcome is not remote rollback,
// provider execution, operational adoption, SQL or whole-request deadline proof.
const FAILURE = "explorer_private_request_unavailable";
const ID = "10000000-0000-4000-8000-000000000001";
const SESSION = "20000000-0000-4000-8000-000000000002";
const SHA = "A".repeat(64);
const ACTOR = Object.freeze({ accountId: ID, applicationSessionId: SESSION });
const OPERATION = Object.freeze({ operationId: ID, fingerprint: SHA });
const STATE = Object.freeze({ version: "explorer-conversation.v1" as const, conversationId: ID,
  revision: 1, pendingTurn: false, providerState: "unavailable" as const,
  messages: [], compassItems: [], priorityId: null, attentionId: null, waypoints: [] });
const ROW: ExplorerPrivateReadRow = Object.freeze({ outcome: "ok", conversation_state: STATE });
const ACTOR_PARAMETERS = { p_actor_user_account_id: ID, p_user_session_id: SESSION };
const METHODOLOGY = { p_methodology_context_pack_id: ID, p_methodology_context_pack_version_id: ID,
  p_methodology_content_sha256: SHA, p_methodology_authorization_version: "MV1:" + SHA };
const ENSURE: ExplorerPrivateEnsureParameters = Object.freeze({ ...ACTOR_PARAMETERS, ...METHODOLOGY,
  p_candidate_conversation_id: ID, p_expected_revision: 1, p_configuration_fingerprint: SHA });
const OBSERVE: ExplorerPrivateObserveParameters = Object.freeze({ ...ACTOR_PARAMETERS, p_conversation_id: ID,
  p_operation_id: ID, p_logical_operation_id: ID, p_expected_revision: 1, p_command_fingerprint: SHA,
  p_protocol_version: "explorer-safety-reply.v1", p_fallback_policy_version: "synthetic-fallback.v1",
  p_model_policy_version: "synthetic-model.v1", p_configuration_fingerprint: SHA,
  p_fallback_level: 0, p_fallback_minor_indicated: false });
const EVIDENCE = Object.freeze({ p_context_source_ids: [ID], p_authorization_version: "AV3:" + SHA,
  p_intake_response_set_id: ID, p_prompt_version: "synthetic-prompt.v1", p_policy_version: "synthetic-policy.v1",
  p_behavior_version: "synthetic-behavior.v1", p_crisis_version: "synthetic-crisis.v1",
  p_role_version: "synthetic-role.v1", p_instruction_version: "synthetic-instruction.v1" });
const PREPARE: ExplorerPrivatePrepareParameters = Object.freeze({ ...OBSERVE, ...METHODOLOGY, ...EVIDENCE,
  p_message_id: ID, p_snapshot_id: ID, p_invocation_id: ID, p_body: "Synthetic submitted body.",
  p_context_serialization: "Synthetic context bytes.", p_context_fingerprint_sha256: SHA,
  p_request_mode: "classification_and_reply", p_trusted_response_version: "synthetic-trusted.v1",
  p_resource_policy_version: "synthetic-resources.v1", p_expected_safety_version: 0 });
const SETTLE: ExplorerPrivateSettleParameters = Object.freeze({ ...ACTOR_PARAMETERS, p_conversation_id: ID,
  p_operation_id: ID, p_status: "completed", p_reply_message_id: null, p_reply_kind: "none", p_reply_body: null,
  p_model_level: 4, p_model_minor_indicated: true, p_protocol_version: "explorer-safety-reply.v1",
  p_request_mode: "classification_only", p_configuration_fingerprint: SHA,
  p_fallback_policy_version: "synthetic-fallback.v1", p_model_policy_version: "synthetic-model.v1",
  p_trusted_response_version: "synthetic-trusted.v1", p_resource_policy_version: "synthetic-resources.v1",
  p_fallback_level: 3, p_fallback_minor_indicated: false, p_delivery_interested: false });
const MUTATE: ExplorerPrivateMutateParameters = Object.freeze({ ...ACTOR_PARAMETERS, p_conversation_id: ID,
  p_operation_id: ID, p_expected_revision: 1, p_command_fingerprint: SHA, p_kind: "confirm_reached",
  p_source_message_id: null, p_item_id: null, p_waypoint_id: ID, p_label: null, p_destination: null,
  p_meaning: null, p_arrival_signal: null, p_evidence: "Synthetic deliberate arrival evidence." });

type BuildContext = NonNullable<ExplorerPrivateConversationDependencies["buildContext"]>;
function contextInput(signal?: AbortSignal): Parameters<BuildContext>[0] {
  const configuration = getExplorerPrivateConfigurationCandidate();
  if (!configuration) throw new Error("synthetic_configuration_missing");
  const readiness: ExplorerPrivateOperationalReadiness = {
    configuration, configurationFingerprint: SHA, modelPolicyVersion: "synthetic-model.v1",
    resourcePolicyVersion: "synthetic-resources.v1", sourceVerificationReceiptSha256: SHA,
    resourceVerificationReceiptSha256: SHA, rendererVerificationReceiptSha256: SHA, signalVerificationReceiptSha256: SHA,
    methodology: { packId: ID, versionId: ID, contentSha256: SHA, authorizationVersion: "MV1:" + SHA },
  };
  return Object.freeze({ actor: ACTOR, row: ROW, state: STATE,
    command: { kind: "send" as const, operationId: ID, expectedRevision: 1, body: "Synthetic message." },
    ids: { conversationId: ID, logicalOperationId: ID, messageId: ID, snapshotId: ID, invocationId: ID, replyId: ID },
    readiness, mode: "classification_and_reply" as const, ...(signal === undefined ? {} : { signal }) });
}
const CONTEXT: Awaited<ReturnType<BuildContext>> = Object.freeze({
  request: { contractVersion: "explorer-safety-request.v2" as const, invocationId: ID, explorerId: ID,
    sessionId: ID, contextSnapshotId: ID, contextFingerprint: SHA, authorizedContext: "Synthetic context bytes.",
    mode: "classification_and_reply" as const, classificationPolicyVersion: "synthetic-model.v1",
    fallbackPolicyVersion: "synthetic-fallback.v1", instructionVersion: "synthetic-instruction.v1" },
  evidence: EVIDENCE,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
function fixture() {
  const repository = {
    read: vi.fn<ExplorerPrivateConversationRepository["read"]>(async () => ROW),
    ensure: vi.fn<ExplorerPrivateConversationRepository["ensure"]>(async () => ROW),
    observe: vi.fn<ExplorerPrivateConversationRepository["observe"]>(async () => ROW),
    prepare: vi.fn<ExplorerPrivateConversationRepository["prepare"]>(async () => ROW),
    settle: vi.fn<ExplorerPrivateConversationRepository["settle"]>(async () => ROW),
    mutate: vi.fn<NonNullable<ExplorerPrivateConversationRepository["mutate"]>>(async () => ROW),
  };
  const authenticate = vi.fn<ExplorerPrivateConversationDependencies["authenticate"]>(async () => ACTOR);
  const dependencies: ExplorerPrivateConversationDependencies = { authenticate, repository };
  return { repository, authenticate, dependencies };
}
function repositoryCalls(dependencies: ExplorerPrivateConversationDependencies) {
  return {
    read: () => dependencies.repository.read(ACTOR, OPERATION),
    ensure: () => dependencies.repository.ensure(ENSURE),
    observe: () => dependencies.repository.observe(OBSERVE),
    prepare: () => dependencies.repository.prepare(PREPARE),
    settle: () => dependencies.repository.settle(SETTLE),
    mutate: () => dependencies.repository.mutate!(MUTATE),
  };
}
const EXPECTED_ARGUMENTS = { read: [ACTOR, OPERATION], ensure: [ENSURE], observe: [OBSERVE],
  prepare: [PREPARE], settle: [SETTLE], mutate: [MUTATE] };

beforeEach(() => { vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("private request port budgets with explicit synthetic dependencies", () => {
  it("preserves held optional absence and ordinary actor/row identity without fabricating capabilities", async () => {
    const f = fixture();
    const repository = { read: f.repository.read, ensure: f.repository.ensure, observe: f.repository.observe,
      prepare: f.repository.prepare, settle: f.repository.settle };
    const wrapped = withExplorerPrivateRequestBudgets({ authenticate: f.authenticate, repository });
    expect(Object.keys(wrapped).sort()).toEqual(["authenticate", "repository"]);
    expect(Object.keys(wrapped.repository).sort()).toEqual(["ensure", "observe", "prepare", "read", "settle"]);
    expect(Object.isFrozen(wrapped)).toBe(true); expect(Object.isFrozen(wrapped.repository)).toBe(true);
    expect(await wrapped.authenticate()).toBe(ACTOR);
    expect(await wrapped.repository.read(ACTOR, OPERATION)).toBe(ROW);
    expect(f.repository.read).toHaveBeenCalledExactlyOnceWith(ACTOR, OPERATION);
    expect(f.authenticate).toHaveBeenCalledExactlyOnceWith();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["read", "ensure", "observe", "prepare", "settle", "mutate"] as const)(
    "bounds a stalled %s once with exact arguments and ignores a late success", async method => {
      const f = fixture(); const held = deferred<ExplorerPrivateReadRow>();
      f.repository[method].mockImplementation(() => held.promise);
      const wrapped = withExplorerPrivateRequestBudgets(f.dependencies);
      const pending = repositoryCalls(wrapped)[method]();
      let settled = false;
      const observed = pending.then(value => { settled = true; return value; }, error => { settled = true; return error as unknown; });
      await vi.advanceTimersByTimeAsync(9_999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      const error = await observed;
      expect(error).toBeInstanceOf(Error); expect((error as Error).message).toBe(FAILURE);
      expect(f.repository[method]).toHaveBeenCalledExactlyOnceWith(...EXPECTED_ARGUMENTS[method]);
      held.resolve(ROW); await Promise.resolve();
      expect(await observed).toBe(error); expect(f.repository[method]).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("returns only the generic failure for a stalled authentication and never retries it", async () => {
    const f = fixture(); const held = deferred<typeof ACTOR>(); f.authenticate.mockReturnValue(held.promise);
    const pending = withExplorerPrivateRequestBudgets(f.dependencies).authenticate();
    const observed = pending.catch(error => error as Error);
    await vi.advanceTimersByTimeAsync(10_000);
    const error = await observed; expect(error).toBeInstanceOf(Error); expect((error as Error).message).toBe(FAILURE);
    held.resolve(ACTOR); await Promise.resolve(); expect(f.authenticate).toHaveBeenCalledOnce();
    for (const port of Object.values(f.repository)) expect(port).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds readiness at fifteen seconds without adding arguments or retrying", async () => {
    const f = fixture(); const held = deferred<ExplorerPrivateOperationalReadiness | null>();
    const resolve = vi.fn<NonNullable<ExplorerPrivateConversationDependencies["resolveOperationalReadiness"]>>(() => held.promise);
    const wrapped = withExplorerPrivateRequestBudgets({ ...f.dependencies, resolveOperationalReadiness: resolve });
    const pending = wrapped.resolveOperationalReadiness!(ACTOR, ROW);
    let settled = false; const observed = pending.catch(error => { settled = true; return error as Error; });
    await vi.advanceTimersByTimeAsync(14_999); expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect((await observed as Error).message).toBe(FAILURE);
    expect(resolve).toHaveBeenCalledExactlyOnceWith(ACTOR, ROW);
    held.resolve(null); await Promise.resolve(); expect(resolve).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds context at thirty seconds and aborts the owned signal without changing its inputs", async () => {
    const f = fixture(); const held = deferred<Awaited<ReturnType<BuildContext>>>();
    let owned!: AbortSignal;
    const build = vi.fn<BuildContext>(input => { owned = input.signal!; return held.promise; });
    const wrapped = withExplorerPrivateRequestBudgets({ ...f.dependencies, buildContext: build });
    const input = contextInput(); const pending = wrapped.buildContext!(input);
    const observed = pending.catch(error => error as Error);
    expect(owned).toBeInstanceOf(AbortSignal); expect(owned.aborted).toBe(false);
    expect(build.mock.calls[0][0]).toEqual({ ...input, signal: owned });
    await vi.advanceTimersByTimeAsync(29_999); expect(owned.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect((await observed as Error).message).toBe(FAILURE); expect(owned.aborted).toBe(true);
    held.resolve(CONTEXT); await Promise.resolve(); expect(build).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("combines caller cancellation with the context owner and preserves a normal context return", async () => {
    const f = fixture(); const caller = new AbortController();
    let combined!: AbortSignal;
    const build = vi.fn<BuildContext>(async input => { combined = input.signal!; caller.abort(); return CONTEXT; });
    const wrapped = withExplorerPrivateRequestBudgets({ ...f.dependencies, buildContext: build });
    const input = contextInput(caller.signal);
    expect(await wrapped.buildContext!(input)).toBe(CONTEXT);
    expect(combined).not.toBe(caller.signal); expect(combined.aborted).toBe(true);
    expect(build.mock.calls[0][0]).toEqual({ ...input, signal: combined });
    expect(build).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves exact terminal arguments/values and leaves provider, renderer and signal ownership unchanged", async () => {
    const f = fixture(); const input = contextInput();
    const resolve = vi.fn(async () => input.readiness);
    const provider = { generate: vi.fn(async () => "Synthetic unrequested response.") };
    const renderer: NonNullable<ExplorerPrivateConversationDependencies["renderer"]> = {
      verificationReceiptSha256: SHA, failureAssistance: { support: "Synthetic support.", adultPolicy: "Synthetic adult policy.",
        supportAndAdultPolicy: "Synthetic support and adult policy.", temporarilyUnavailable: "Synthetic unavailable." },
      render: vi.fn(async () => ({ kind: "urgent" as const, body: "Synthetic reviewed response.",
        trustedResponseVersion: "synthetic-trusted.v1", resourcePolicyVersion: "synthetic-resources.v1" })),
    };
    const operationalSignal = { verificationReceiptSha256: SHA, emit: vi.fn(async () => undefined) };
    const wrapped = withExplorerPrivateRequestBudgets({ ...f.dependencies, resolveOperationalReadiness: resolve,
      provider, renderer, operationalSignal });
    expect(await wrapped.repository.settle(SETTLE)).toBe(ROW);
    expect(f.repository.settle).toHaveBeenCalledExactlyOnceWith(SETTLE);
    expect(f.repository.settle.mock.calls[0][0]).toBe(SETTLE);
    expect(await wrapped.resolveOperationalReadiness!(ACTOR, ROW)).toBe(input.readiness);
    expect(wrapped.provider).toBe(provider); expect(wrapped.renderer).toBe(renderer); expect(wrapped.operationalSignal).toBe(operationalSignal);
    expect(provider.generate).not.toHaveBeenCalled(); expect(renderer.render).not.toHaveBeenCalled(); expect(operationalSignal.emit).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
