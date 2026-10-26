import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExplorerConversationRepository } from "../../virtual-guide/explorerConversationComposition";
import { createExplorerConversationRepository, createGovernedExplorerConversationRepository } from "../explorerConversationRepository";

// Synthetic transport-only fixtures: no Supabase client construction, table
// access, authentication, database, provider or network operation occurs here.
const ACTOR = Object.freeze({
  accountId: "11111111-1111-4111-8111-111111111111",
  applicationSessionId: "22222222-2222-4222-8222-222222222222",
});


const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const CONVERSATION_ID = "44444444-4444-4444-8444-444444444444";
const MESSAGE_ID = "55555555-5555-4555-8555-555555555555";
const INTAKE_ID = "88888888-8888-4888-8888-888888888888";
const PACK_ID = "99999999-9999-4999-8999-999999999999";
const FINGERPRINT = "A".repeat(64);
const PRIVATE_DETAIL = "SYNTHETIC_INTERNAL_DETAIL_NOT_FOR_CALLERS";
const UNAVAILABLE = "explorer_conversation_repository_unavailable";
const STATE = Object.freeze({
  version: "explorer-conversation.v1", conversationId: null, revision: 0,
  pendingTurn: false, providerState: "unavailable", messages: [], compassItems: [],
  priorityId: null, attentionId: null, waypoints: [],
});
const ROW = Object.freeze({ outcome: "ok", conversation_state: STATE });
const BASE = Object.freeze({ p_actor_user_account_id: ACTOR.accountId,
  p_user_session_id: ACTOR.applicationSessionId, p_conversation_id: CONVERSATION_ID,
  p_operation_id: OPERATION_ID });
const PREPARE = Object.freeze({ ...BASE, p_expected_revision: 0, p_message_id: MESSAGE_ID,
  p_snapshot_id: "66666666-6666-4666-8666-666666666666",
  p_invocation_id: "77777777-7777-4777-8777-777777777777",
  p_body: "Synthetic Explorer message", p_context_serialization: "{}",
  p_context_fingerprint_sha256: "44136FA355B3678A1146AD16F7E8649E94FB4FC21FE77E8310C060F61CAAFF8A",
  p_context_source_ids: [MESSAGE_ID, INTAKE_ID, PACK_ID],
  p_authorization_version: `AV2:${FINGERPRINT}`,
  p_intake_response_set_id: INTAKE_ID,
  p_methodology_context_pack_version_id: PACK_ID,
  p_prompt_version: "synthetic-prompt.v1", p_policy_version: "synthetic-policy.v1",
  p_behavior_version: "synthetic-behavior.v1", p_crisis_version: "synthetic-crisis.v1",
  p_role_version: "synthetic-role.v1", p_instruction_version: "synthetic-instruction.v1",
  p_command_fingerprint: FINGERPRINT });
const COMPLETE = Object.freeze({ ...BASE, p_status: "failed", p_reply_message_id: null, p_reply_body: null });
const MUTATE = Object.freeze({ ...BASE, p_expected_revision: 2, p_kind: "add_compass",
  p_command_fingerprint: FINGERPRINT, p_source_message_id: MESSAGE_ID, p_item_id: null,
  p_waypoint_id: null, p_label: "Synthetic chosen label", p_destination: null,
  p_meaning: null, p_arrival_signal: null, p_evidence: null });

function transport(result: unknown = { data: [ROW], error: null }) {
  const abortSignal = vi.fn<(signal: AbortSignal) => Promise<unknown>>().mockResolvedValue(result);
  const rpc = vi.fn<(name: string, parameters: unknown) => { abortSignal: typeof abortSignal }>()
    .mockReturnValue({ abortSignal });
  const accesses: string[] = [];
  // A tripwire catches even attempted generic query/auth/storage access. The
  // injected synthetic client implements only rpc(...).abortSignal(...).
  const client = new Proxy({ rpc }, {
    get(target, property) {
      if (property === "rpc") return target.rpc;
      accesses.push(String(property));
      throw new Error(PRIVATE_DETAIL);
    },
  }) as unknown as SupabaseClient;
  return { client, rpc, abortSignal, accesses };
}

async function expectUnavailable(promise: Promise<unknown>) {
  let caught: unknown;
  try { await promise; } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(Error);
  expect((caught as Error).message).toBe(UNAVAILABLE);
  expect(String(caught)).not.toContain(PRIVATE_DETAIL);
  expect("cause" in (caught as Error)).toBe(false);
}

afterEach(() => { vi.restoreAllMocks(); });

const CALLS: ReadonlyArray<Readonly<{
  method: string; functionName: string; parameters: Readonly<Record<string, unknown>>;
  invoke: (repository: ExplorerConversationRepository) => Promise<unknown>;
}>> = [
  { method: "read", functionName: "solmind_read_explorer_conversation",
    parameters: { p_actor_user_account_id: ACTOR.accountId, p_user_session_id: ACTOR.applicationSessionId,
      p_conversation_id: null, p_operation_id: null, p_command_fingerprint: null },
    invoke: (repository) => repository.read(ACTOR) },
  { method: "prepare", functionName: "solmind_prepare_explorer_conversation_turn", parameters: PREPARE,
    invoke: (repository) => repository.prepare(PREPARE) },
  { method: "complete", functionName: "solmind_complete_explorer_conversation_turn", parameters: COMPLETE,
    invoke: (repository) => repository.complete(COMPLETE) },
  { method: "mutate", functionName: "solmind_mutate_explorer_conversation_v3", parameters: MUTATE,
    invoke: (repository) => repository.mutate(MUTATE) },
];

describe("explorerConversationRepository closed transport boundary", () => {
  it.each(CALLS)("$method calls only its exact RPC with a 12-second abort bound", async ({ functionName, parameters, invoke }) => {
    const fixture = transport();
    const boundedSignal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(boundedSignal);
    expect(await invoke(createExplorerConversationRepository(fixture.client))).toEqual(ROW);
    expect(fixture.rpc).toHaveBeenCalledTimes(1);
    expect(fixture.rpc).toHaveBeenCalledWith(functionName, parameters);
    expect(timeout).toHaveBeenCalledExactlyOnceWith(12_000);
    expect(fixture.abortSignal).toHaveBeenCalledExactlyOnceWith(boundedSignal);
    expect(fixture.accesses).toEqual([]);
  });

  it("read forwards exactly five arguments including the retained command fingerprint", async () => {
    const fixture = transport();
    await createExplorerConversationRepository(fixture.client).read(ACTOR, {
      operationId: OPERATION_ID, fingerprint: FINGERPRINT,
    });
    expect(fixture.rpc).toHaveBeenCalledExactlyOnceWith("solmind_read_explorer_conversation", {
      p_actor_user_account_id: ACTOR.accountId, p_user_session_id: ACTOR.applicationSessionId,
      p_conversation_id: null, p_operation_id: OPERATION_ID, p_command_fingerprint: FINGERPRINT,
    });
    expect(Object.keys(fixture.rpc.mock.calls[0][1] as object)).toHaveLength(5);
    expect(fixture.accesses).toEqual([]);
  });

  it("exposes only the frozen four-method feature port, without a generic RPC/select escape", () => {
    const fixture = transport();
    const repository = createExplorerConversationRepository(fixture.client);
    expect(Object.keys(repository).sort()).toEqual(["complete", "mutate", "prepare", "read"]);
    expect(Object.isFrozen(repository)).toBe(true);
    for (const name of ["rpc", "from", "select", "execute", "auth", "storage"]) {
      expect(name in repository).toBe(false);
    }
    expect(fixture.rpc).not.toHaveBeenCalled();
    expect(fixture.accesses).toEqual([]);
  });

  it.each([
    ["empty", []], ["multiple", [ROW, ROW]], ["null", null], ["object instead of array", ROW],
    ["null row", [null]], ["primitive row", ["ok"]], ["missing outcome", [{ conversation_state: STATE }]],
    ["non-string outcome", [{ outcome: true, conversation_state: STATE }]],
  ])("rejects %s data instead of treating it as one valid result", async (_label, data) => {
    const fixture = transport({ data, error: null });
    await expectUnavailable(createExplorerConversationRepository(fixture.client).read(ACTOR));
    expect(fixture.rpc).toHaveBeenCalledTimes(1);
    expect(fixture.accesses).toEqual([]);
  });

  it.each([
    ["solmind_explorer_conversation_denied", "denied"],
    ["solmind_explorer_conversation_invalid_input", "denied"],
    ["solmind_explorer_conversation_operation_conflict", "operation_conflict"],
  ])("maps only exact P0001 %s to a closed value-free disposition", async (message, outcome) => {
    const fixture = transport({ data: [{ ...ROW, authority_context: PRIVATE_DETAIL, dispatch_permitted: true }],
      error: { code: "P0001", message, details: PRIVATE_DETAIL, hint: PRIVATE_DETAIL } });
    const result = await createExplorerConversationRepository(fixture.client).read(ACTOR);
    expect(result).toEqual({ outcome, conversation_state: null });
    expect(JSON.stringify(result)).not.toContain(PRIVATE_DETAIL);
  });

  it.each([
    { code: "42501", message: "solmind_explorer_conversation_denied" },
    { message: "solmind_explorer_conversation_operation_conflict" },
    { code: "P0001", message: "solmind_explorer_conversation_denied " },
    { code: "P0001", message: `solmind_explorer_conversation_denied\n${PRIVATE_DETAIL}` },
    { code: "P0001", message: `${PRIVATE_DETAIL}: solmind_explorer_conversation_operation_conflict` },
    { code: "P0001", message: "solmind_explorer_conversation_unavailable" },
    { code: "P0001", message: PRIVATE_DETAIL },
    { code: "57014", message: PRIVATE_DETAIL, details: PRIVATE_DETAIL },
  ])("keeps generic or smuggled database errors opaque: %#", async (error) => {
    const fixture = transport({ data: [ROW], error });
    await expectUnavailable(createExplorerConversationRepository(fixture.client).read(ACTOR));
  });

  it.each([
    ["solmind_explorer_private_denied", "denied"],
    ["solmind_explorer_private_invalid_input", "denied"],
    ["solmind_explorer_private_operation_conflict", "operation_conflict"],
  ])("maps exact private %s only on the atomic formation capability", async (message, outcome) => {
    const fixture = transport({ data: [{ ...ROW, authority_context: PRIVATE_DETAIL, dispatch_permitted: true }],
      error: { code: "P0001", message, details: PRIVATE_DETAIL, hint: PRIVATE_DETAIL } });
    const result = await createExplorerConversationRepository(fixture.client).mutate(MUTATE);
    expect(result).toEqual({ outcome, conversation_state: null });
    expect(fixture.rpc).toHaveBeenCalledExactlyOnceWith("solmind_mutate_explorer_conversation_v3", MUTATE);
    expect(JSON.stringify(result)).not.toContain(PRIVATE_DETAIL);
    const foreignCapability = transport({ data: [ROW], error: { code: "P0001", message } });
    await expectUnavailable(createExplorerConversationRepository(foreignCapability.client).read(ACTOR));
  });

  it.each([
    { code: "42501", message: "solmind_explorer_private_denied" },
    { code: "P0001", message: "solmind_explorer_private_denied " },
    { code: "P0001", message: "solmind_explorer_private_unavailable" },
    { code: "P0001", message: `solmind_explorer_private_denied\n${PRIVATE_DETAIL}` },
  ])("keeps unrecognized atomic mutation errors opaque without another post: %#", async (error) => {
    const fixture = transport({ data: [ROW], error });
    await expectUnavailable(createExplorerConversationRepository(fixture.client).mutate(MUTATE));
    expect(fixture.rpc).toHaveBeenCalledExactlyOnceWith("solmind_mutate_explorer_conversation_v3", MUTATE);
    expect(fixture.accesses).toEqual([]);
  });

  it("keeps thrown transport errors opaque", async () => {
    const fixture = transport();
    fixture.abortSignal.mockRejectedValueOnce(new Error(PRIVATE_DETAIL));
    await expectUnavailable(createExplorerConversationRepository(fixture.client).prepare(PREPARE));
    expect(fixture.rpc).toHaveBeenCalledTimes(1);
    expect(fixture.accesses).toEqual([]);
  });

  it("settles a transport abort as value-free unavailable without another call", async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const fixture = transport();
    fixture.abortSignal.mockImplementationOnce((signal) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error(PRIVATE_DETAIL)), { once: true });
    }));
    const result = createExplorerConversationRepository(fixture.client).mutate(MUTATE);
    controller.abort();
    await expectUnavailable(result);
    expect(fixture.rpc).toHaveBeenCalledTimes(1);
    expect(fixture.accesses).toEqual([]);
  });

  it("keeps synchronous RPC failures opaque", async () => {
    const fixture = transport();
    fixture.rpc.mockImplementationOnce(() => { throw new Error(PRIVATE_DETAIL); });
    await expectUnavailable(createExplorerConversationRepository(fixture.client).complete(COMPLETE));
    expect(fixture.rpc).toHaveBeenCalledTimes(1);
  });

  it("keeps hostile response getters opaque", async () => {
    const hostile = Object.defineProperty({}, "code", { get() { throw new Error(PRIVATE_DETAIL); } });
    await expectUnavailable(createExplorerConversationRepository(transport({ data: [ROW], error: hostile }).client).read(ACTOR));
    const row = Object.defineProperty({}, "outcome", { get() { throw new Error(PRIVATE_DETAIL); } });
    await expectUnavailable(createExplorerConversationRepository(transport({ data: [row], error: null }).client).read(ACTOR));
  });
});

describe("explicit governed Explorer repository factory (synthetic transport only)", () => {
  const governedPrepare = Object.freeze({ ...PREPARE,
    p_logical_operation_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    p_methodology_context_pack_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    p_methodology_content_sha256: "B".repeat(64),
    p_methodology_authorization_version: `MV1:${"C".repeat(64)}`,
  });

  it.each(CALLS)("$method retains its closed capability; only prepare uses the governed wrapper", async ({ method, functionName, parameters, invoke }) => {
    const f = transport(); const repository = createGovernedExplorerConversationRepository(f.client);
    const expectedFunction = method === "prepare" ? "solmind_prepare_governed_explorer_conversation_turn" : functionName;
    if (method === "prepare") await repository.prepare(governedPrepare); else await invoke(repository);
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith(expectedFunction, method === "prepare" ? governedPrepare : parameters);
    expect(f.accesses).toEqual([]);
    expect(Object.isFrozen(repository)).toBe(true);
    expect(Object.keys(repository).sort()).toEqual(["complete", "mutate", "prepare", "read"]);
  });

  it("does not silently upgrade the existing factory or erase governed evidence", async () => {
    const legacy = transport(); const governed = transport();
    await createExplorerConversationRepository(legacy.client).prepare(PREPARE);
    await createGovernedExplorerConversationRepository(governed.client).prepare(governedPrepare);
    expect(legacy.rpc.mock.calls[0][0]).toBe("solmind_prepare_explorer_conversation_turn");
    expect(governed.rpc.mock.calls[0][0]).toBe("solmind_prepare_governed_explorer_conversation_turn");
    expect(governed.rpc.mock.calls[0][1]).toBe(governedPrepare);
    expect(governedPrepare.p_methodology_authorization_version).toBe(`MV1:${"C".repeat(64)}`);
  });

  it("preserves the 12-second bound and fixed transport errors without fallback", async () => {
    const f = transport(); const signal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);
    f.abortSignal.mockRejectedValueOnce(new Error(PRIVATE_DETAIL));
    await expectUnavailable(createGovernedExplorerConversationRepository(f.client).prepare(governedPrepare));
    expect(timeout).toHaveBeenCalledExactlyOnceWith(12_000);
    expect(f.abortSignal).toHaveBeenCalledExactlyOnceWith(signal);
    expect(f.rpc).toHaveBeenCalledTimes(1); expect(f.accesses).toEqual([]);
  });
});
