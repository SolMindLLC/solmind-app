import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createExplorerPrivateConversationRepository } from "../explorerPrivateConversationRepository";
import type { ExplorerPrivateEnsureParameters, ExplorerPrivateObserveParameters, ExplorerPrivatePrepareParameters,
  ExplorerPrivateSettleParameters, ExplorerPrivateMutateParameters, ExplorerPrivateArrangeParameters, ExplorerPrivateEndParameters, ExplorerPrivateReviewParameters } from "../../virtual-guide/explorerPrivateConversationComposition";

const UUID = "00000000-0000-4000-8000-000000000001"; const SHA = "A".repeat(64);
const ACTOR = { p_actor_user_account_id: UUID, p_user_session_id: UUID };
const METHODOLOGY = { p_methodology_context_pack_id: UUID, p_methodology_context_pack_version_id: UUID,
  p_methodology_content_sha256: SHA, p_methodology_authorization_version: "MV1:" + SHA };
function ensure(): ExplorerPrivateEnsureParameters { return { ...ACTOR, ...METHODOLOGY, p_candidate_conversation_id: UUID, p_expected_revision: 0, p_configuration_fingerprint: SHA }; }
function observe(): ExplorerPrivateObserveParameters { return { ...ACTOR, p_conversation_id: UUID, p_operation_id: UUID,
  p_logical_operation_id: UUID, p_expected_revision: 0, p_command_fingerprint: SHA, p_protocol_version: "explorer-safety-reply.v1",
  p_fallback_policy_version: "synthetic-fallback.v1", p_model_policy_version: "synthetic-model.v1", p_configuration_fingerprint: SHA,
  p_fallback_level: 0, p_fallback_minor_indicated: false }; }
function prepare(): ExplorerPrivatePrepareParameters { return { ...observe(), ...METHODOLOGY,
  p_context_source_ids: [UUID], p_authorization_version: "AV3:" + SHA, p_intake_response_set_id: UUID,
  p_prompt_version: "synthetic.v1", p_policy_version: "synthetic.v1", p_behavior_version: "synthetic.v1", p_crisis_version: "synthetic.v1",
  p_role_version: "synthetic.v1", p_instruction_version: "synthetic.v1", p_message_id: UUID, p_snapshot_id: UUID, p_invocation_id: UUID,
  p_body: "Synthetic only.", p_context_serialization: "{}", p_context_fingerprint_sha256: SHA, p_request_mode: "classification_and_reply",
  p_trusted_response_version: "synthetic.v1", p_resource_policy_version: "synthetic.v1", p_expected_safety_version: 0, p_model_name: "gpt-5.6-luna" }; }
function settle(): ExplorerPrivateSettleParameters { return { ...ACTOR, p_conversation_id: UUID, p_operation_id: UUID,
  p_status: "completed", p_reply_message_id: null, p_reply_kind: "none", p_reply_body: null, p_model_level: 0, p_model_minor_indicated: false,
  p_protocol_version: "explorer-safety-reply.v1", p_request_mode: "classification_only", p_configuration_fingerprint: SHA,
  p_fallback_policy_version: "synthetic.v1", p_model_policy_version: "synthetic.v1", p_trusted_response_version: "synthetic.v1",
  p_resource_policy_version: "synthetic.v1", p_fallback_level: 0, p_fallback_minor_indicated: false, p_delivery_interested: false }; }
function mutate(): ExplorerPrivateMutateParameters { return { ...ACTOR, p_conversation_id: UUID, p_operation_id: UUID,
  p_expected_revision: 0, p_command_fingerprint: SHA, p_kind: "set_attention", p_source_message_id: null, p_item_id: UUID,
  p_waypoint_id: null, p_label: null, p_destination: null, p_meaning: null, p_arrival_signal: null, p_evidence: null }; }
function arrange(): ExplorerPrivateArrangeParameters { return { ...ACTOR, p_conversation_id: UUID, p_operation_id: UUID,
  p_expected_revision: 0, p_command_fingerprint: SHA, p_priority_id: UUID,
  p_items: [{ compassItemId: UUID, anchor: "apex", emphasis: 2 }] }; }
function end(): ExplorerPrivateEndParameters { return { ...ACTOR, p_conversation_id: UUID, p_operation_id: UUID,
  p_expected_revision: 0, p_command_fingerprint: SHA }; }
function review(): ExplorerPrivateReviewParameters { return { ...ACTOR, p_conversation_id: null }; }
function fixture(row: unknown) {
  const abortSignal = vi.fn(async (_signal: AbortSignal) => ({ data: [row], error: null as { code: string; message: string } | null }));
  const rpc = vi.fn((_name: string, _parameters: unknown) => ({ abortSignal }));
  const repository = createExplorerPrivateConversationRepository({ rpc } as unknown as SupabaseClient);
  return { repository, rpc, abortSignal };
}
describe("Closed private Explorer RPC repository (synthetic client)", () => {
  it("exposes twelve closed ports including category formation, End and ended review, without generic access", () => {
    const f = fixture(null);
    expect(Object.keys(f.repository).sort()).toEqual(["arrange", "category", "end", "ensure", "mutate", "observe", "prepare", "read", "release", "review", "settle", "waypointRevision"]);
    expect(Object.isFrozen(f.repository)).toBe(true);
  });
  it("read derives exact actor fields and paired operation selectors", async () => {
    const f = fixture({ outcome: "ok", conversation_state: null, authority_context: null, policy_state: null });
    await f.repository.read({ accountId: UUID, applicationSessionId: UUID }, { operationId: UUID, fingerprint: SHA });
    expect(f.rpc).toHaveBeenCalledWith("solmind_read_explorer_conversation_v3", { ...ACTOR,
      p_conversation_id: null, p_operation_id: UUID, p_command_fingerprint: SHA });
    expect(f.abortSignal.mock.calls[0][0]).toBeInstanceOf(AbortSignal); expect(f.rpc).toHaveBeenCalledOnce();
  });
  it("ensure sends no attempted body, operation row or dispatch parameter", async () => {
    const f = fixture({ outcome: "created", conversation_state: null, authority_context: null, policy_state: null });
    await f.repository.ensure(ensure());
    expect(f.rpc).toHaveBeenCalledWith("solmind_ensure_explorer_conversation_v3", ensure());
    expect(f.rpc.mock.calls[0][1]).not.toHaveProperty("p_body"); expect(f.rpc.mock.calls[0][1]).not.toHaveProperty("p_operation_id");
  });
  it("uses the exact observe, governed prepare, settlement and deliberate formation names", async () => {
    const f = fixture({ outcome: "ok", policy_state: null }); await f.repository.observe(observe());
    expect(f.rpc).toHaveBeenCalledWith("solmind_observe_explorer_conversation_fallback_v3", observe());
    const p = fixture({ outcome: "ok", conversation_state: null, dispatch_permitted: false, policy_state: null }); await p.repository.prepare(prepare());
    expect(p.rpc).toHaveBeenCalledWith("solmind_prepare_explorer_conversation_turn_v3", prepare());
    const s = fixture({ outcome: "ok", conversation_state: null, policy_state: null, saved_reply: false }); await s.repository.settle(settle());
    expect(s.rpc).toHaveBeenCalledWith("solmind_settle_explorer_conversation_turn_v3", settle());
    const m = fixture({ outcome: "ok", conversation_state: null }); await m.repository.mutate!(mutate());
    expect(m.rpc).toHaveBeenCalledWith("solmind_mutate_explorer_conversation_v3", mutate());
  });
  it("refuses extra/missing/getter parameters before any RPC", async () => {
    for (const input of [{ ...ensure(), p_unreviewed: true }, { ...ensure(), p_configuration_fingerprint: undefined }]) {
      const f = fixture(null); await expect(f.repository.ensure(input as ExplorerPrivateEnsureParameters)).rejects.toThrowError("explorer_private_repository_unavailable");
      expect(f.rpc).not.toHaveBeenCalled();
    }
    const f = fixture(null); const input = ensure(); const getter = vi.fn();
    Object.defineProperty(input, "p_configuration_fingerprint", { enumerable: true, get: getter });
    await expect(f.repository.ensure(input)).rejects.toThrow(); expect(getter).not.toHaveBeenCalled(); expect(f.rpc).not.toHaveBeenCalled();
  });
  it("copies the exact source identity array before issuing the preparation call", async () => {
    const f = fixture({ outcome: "ok", conversation_state: null, dispatch_permitted: false, policy_state: null });
    const input = prepare(); const pending = f.repository.prepare(input);
    expect(f.rpc.mock.calls[0][1]).not.toBe(input);
    expect((f.rpc.mock.calls[0][1] as ExplorerPrivatePrepareParameters).p_context_source_ids).not.toBe(input.p_context_source_ids);
    await pending;
  });
  it.each([{ outcome: "invented", policy_state: null }, { outcome: "ok", policy_state: null, extra: true },
    { outcome: "ok" }, null])("rejects malformed/expanded observe results: %j", async (row) => {
    const f = fixture(row); await expect(f.repository.observe(observe())).rejects.toThrowError("explorer_private_repository_unavailable");
  });
  it("requires real boolean dispatch/save outcomes", async () => {
    const p = fixture({ outcome: "ok", conversation_state: null, policy_state: null, dispatch_permitted: "true" });
    await expect(p.repository.prepare(prepare())).rejects.toThrow();
    const s = fixture({ outcome: "ok", conversation_state: null, policy_state: null, saved_reply: 1 });
    await expect(s.repository.settle(settle())).rejects.toThrow();
  });
  it("maps only closed private denial/conflict sentinels without leaking detail", async () => {
    for (const [message, outcome] of [["solmind_explorer_private_denied", "denied"], ["solmind_explorer_private_evidence_conflict", "operation_conflict"]]) {
      const f = fixture(null); f.abortSignal.mockResolvedValue({ data: [], error: { code: "P0001", message } });
      expect(await f.repository.ensure(ensure())).toEqual({ outcome }); expect(f.rpc).toHaveBeenCalledOnce();
    }
  });
  it("unknown acknowledgement stays opaque with one attempt", async () => {
    const f = fixture(null); f.abortSignal.mockRejectedValue(new Error("private database detail"));
    await expect(f.repository.settle(settle())).rejects.toThrowError("explorer_private_repository_unavailable");
    expect(f.rpc).toHaveBeenCalledOnce(); expect(f.abortSignal).toHaveBeenCalledOnce();
  });
});

describe("Root cycle1 source identity hostile arrays", () => {
  it("rejects index accessors without executing them or issuing any RPC", async () => {
    const f = fixture(null); const input = prepare(); const ids = [UUID]; const getter = vi.fn(() => UUID);
    Object.defineProperty(ids, "0", { enumerable: true, configurable: true, get: getter });
    await expect(f.repository.prepare({ ...input, p_context_source_ids: ids })).rejects.toThrow("explorer_private_repository_unavailable");
    expect(getter).not.toHaveBeenCalled(); expect(f.rpc).not.toHaveBeenCalled();
  });
  it("rejects proxy/sparse/expanded/subclass arrays without reading trapped elements", async () => {
    const trap = vi.fn(); class Extended extends Array<string> {}
    const proxy = new Proxy([UUID], { get: trap }); const expanded = [UUID]; Object.defineProperty(expanded, "secret", { value: UUID });
    for (const ids of [proxy, new Array<string>(1), expanded, Extended.of(UUID)]) {
      const f = fixture(null); await expect(f.repository.prepare({ ...prepare(), p_context_source_ids: ids })).rejects.toThrow(); expect(f.rpc).not.toHaveBeenCalled();
    }
    expect(trap).not.toHaveBeenCalled();
  });
});


describe("Closed Compass arrangement SDK port", () => {
  it("calls only the named eight-argument arrangement RPC with deeply detached frozen item data", async () => {
    const f = fixture({ outcome: "ok", conversation_state: null });
    const items = [...arrange().p_items]; const originalItem = items[0];
    const input = { ...arrange(), p_items: items };
    const pending = f.repository.arrange!(input);
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("solmind_confirm_explorer_compass_arrangement_v1", input);
    const copied = f.rpc.mock.calls[0][1] as ExplorerPrivateArrangeParameters;
    expect(Object.keys(copied)).toHaveLength(8);
    expect(copied).not.toBe(input); expect(copied.p_items).not.toBe(items); expect(copied.p_items[0]).not.toBe(originalItem);
    expect(Object.isFrozen(copied)).toBe(true); expect(Object.isFrozen(copied.p_items)).toBe(true);
    expect(Object.isFrozen(copied.p_items[0])).toBe(true);
    Object.assign(originalItem, { anchor: null, emphasis: 1 });
    items.push({ compassItemId: "00000000-0000-4000-8000-000000000002", anchor: null, emphasis: 1 });
    expect(copied.p_items).toEqual([{ compassItemId: UUID, anchor: "apex", emphasis: 2 }]);
    expect(await pending).toEqual({ outcome: "ok", conversation_state: null });
    expect(f.abortSignal).toHaveBeenCalledOnce(); expect(f.abortSignal.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  });

  it("refuses extra top-level/private item fields, non-array items and malformed selected data before RPC", async () => {
    const item = arrange().p_items[0];
    for (const input of [
      { ...arrange(), p_body: "Unreviewed extra text" }, { ...arrange(), p_model_name: "unreviewed-model" },
      { ...arrange(), p_items: [{ ...item, label: "Browser-supplied private label" }] },
      { ...arrange(), p_items: [{ ...item, accountId: UUID }] },
      { ...arrange(), p_items: null }, { ...arrange(), p_items: "[]" }, { ...arrange(), p_items: {} },
      { ...arrange(), p_items: [{ ...item, emphasis: null }] }, { ...arrange(), p_items: [{ ...item, emphasis: 4 }] },
      { ...arrange(), p_items: [{ ...item, anchor: "north" }] },
      { ...arrange(), p_items: [{ ...item, compassItemId: ` ${UUID}` }] },
    ]) {
      const f = fixture(null);
      await expect(f.repository.arrange!(input as unknown as ExplorerPrivateArrangeParameters)).rejects.toThrowError("explorer_private_repository_unavailable");
      expect(f.rpc).not.toHaveBeenCalled();
    }
  });

  it("does not execute top-level, index or item getters while rejecting their input", async () => {
    for (const level of ["parameters", "index", "item"] as const) {
      const f = fixture(null); const getter = vi.fn(() => UUID);
      const input = arrange(); const items = [{ ...input.p_items[0] }];
      if (level === "parameters") Object.defineProperty(input, "p_items", { enumerable: true, get: getter });
      else if (level === "index") Object.defineProperty(items, "0", { enumerable: true, get: getter });
      else Object.defineProperty(items[0], "compassItemId", { enumerable: true, get: getter });
      const candidate = level === "parameters" ? input : { ...input, p_items: items };
      await expect(f.repository.arrange!(candidate)).rejects.toThrowError("explorer_private_repository_unavailable");
      expect(getter).not.toHaveBeenCalled(); expect(f.rpc).not.toHaveBeenCalled();
    }
  });

  it("rejects sparse, expanded, subclass and proxy item arrays without reading proxy traps", async () => {
    const trap = vi.fn(); const item = arrange().p_items[0];
    class Extended extends Array<typeof item> {}
    const expanded = [item]; Object.defineProperty(expanded, "private", { value: UUID });
    for (const p_items of [new Array<typeof item>(1), expanded, Extended.of(item), new Proxy([item], { get: trap })]) {
      const f = fixture(null);
      await expect(f.repository.arrange!({ ...arrange(), p_items })).rejects.toThrowError("explorer_private_repository_unavailable");
      expect(f.rpc).not.toHaveBeenCalled();
    }
    expect(trap).not.toHaveBeenCalled();
  });

  it("rejects expanded arrangement results and never retries an unknown acknowledgement", async () => {
    const expanded = fixture({ outcome: "ok", conversation_state: null, policy_state: null });
    await expect(expanded.repository.arrange!(arrange())).rejects.toThrowError("explorer_private_repository_unavailable");
    expect(expanded.rpc).toHaveBeenCalledOnce();
    const unknown = fixture(null); unknown.abortSignal.mockRejectedValue(new Error("Synthetic acknowledgement loss"));
    await expect(unknown.repository.arrange!(arrange())).rejects.toThrowError("explorer_private_repository_unavailable");
    expect(unknown.rpc).toHaveBeenCalledOnce(); expect(unknown.abortSignal).toHaveBeenCalledOnce();
  });
});


describe("Closed End and ended-review SDK capabilities", () => {
  it("uses the exact six-argument End and three-argument review RPCs with their closed result columns", async () => {
    const e = fixture({ outcome: "ok", conversation_state: null });
    expect(await e.repository.end!(end())).toEqual({ outcome: "ok", conversation_state: null });
    expect(e.rpc).toHaveBeenCalledExactlyOnceWith("solmind_end_explorer_conversation_v1", end());
    expect(Object.keys(e.rpc.mock.calls[0][1] as object)).toHaveLength(6);
    const v = fixture({ outcome: "ok", ended_conversations: [], conversation_state: null });
    expect(await v.repository.review!(review())).toEqual({ outcome: "ok", ended_conversations: [], conversation_state: null });
    expect(v.rpc).toHaveBeenCalledExactlyOnceWith("solmind_read_ended_explorer_conversations_v1", review());
    expect(Object.keys(v.rpc.mock.calls[0][1] as object)).toHaveLength(3);
    expect(e.abortSignal).toHaveBeenCalledOnce(); expect(v.abortSignal).toHaveBeenCalledOnce();
  });

  it.each(["ok", "exact_replay", "already_ended", "stale_revision", "unavailable"])("accepts only declared End outcome %s", async outcome => {
    const f = fixture({ outcome, conversation_state: null });
    expect(await f.repository.end!(end())).toEqual({ outcome, conversation_state: null });
    expect(f.rpc).toHaveBeenCalledOnce();
  });

  it("rejects extra or getter parameters before either capability reaches RPC", async () => {
    for (const method of ["end", "review"] as const) {
      const original = method === "end" ? end() : review();
      const input = { ...original, p_body: "Unreviewed content" }; const f = fixture(null);
      if (method === "end") await expect(f.repository.end!(input as unknown as ExplorerPrivateEndParameters)).rejects.toThrowError("explorer_private_repository_unavailable");
      else await expect(f.repository.review!(input as ExplorerPrivateReviewParameters)).rejects.toThrowError("explorer_private_repository_unavailable");
      expect(f.rpc).not.toHaveBeenCalled();
      const getter = vi.fn(() => UUID); Object.defineProperty(original, "p_conversation_id", { enumerable: true, get: getter });
      const g = fixture(null);
      if (method === "end") await expect(g.repository.end!(original as ExplorerPrivateEndParameters)).rejects.toThrowError("explorer_private_repository_unavailable");
      else await expect(g.repository.review!(original as ExplorerPrivateReviewParameters)).rejects.toThrowError("explorer_private_repository_unavailable");
      expect(getter).not.toHaveBeenCalled(); expect(g.rpc).not.toHaveBeenCalled();
    }
  });

  it("rejects unknown/expanded result shapes and maps declared conflict/denial exceptions without detail", async () => {
    for (const row of [{ outcome: "invented", conversation_state: null }, { outcome: "ok", conversation_state: null, policy_state: null }]) {
      const f = fixture(row); await expect(f.repository.end!(end())).rejects.toThrowError("explorer_private_repository_unavailable");
    }
    for (const row of [{ outcome: "exact_replay", ended_conversations: [], conversation_state: null },
      { outcome: "ok", ended_conversations: [], conversation_state: null, authority_context: {} }]) {
      const f = fixture(row); await expect(f.repository.review!(review())).rejects.toThrowError("explorer_private_repository_unavailable");
    }
    const e = fixture(null); e.abortSignal.mockResolvedValue({ data: [], error: { code: "P0001", message: "solmind_explorer_private_operation_conflict" } });
    expect(await e.repository.end!(end())).toEqual({ outcome: "operation_conflict" });
    const v = fixture(null); v.abortSignal.mockResolvedValue({ data: [], error: { code: "P0001", message: "solmind_explorer_conversation_denied" } });
    expect(await v.repository.review!(review())).toEqual({ outcome: "denied" });
  });

  it("does not repost either capability after an unknown acknowledgement", async () => {
    const e = fixture(null); e.abortSignal.mockRejectedValue(new Error("Synthetic private acknowledgement loss"));
    await expect(e.repository.end!(end())).rejects.toThrowError("explorer_private_repository_unavailable");
    const v = fixture(null); v.abortSignal.mockRejectedValue(new Error("Synthetic private acknowledgement loss"));
    await expect(v.repository.review!(review())).rejects.toThrowError("explorer_private_repository_unavailable");
    expect(e.rpc).toHaveBeenCalledOnce(); expect(v.rpc).toHaveBeenCalledOnce();
  });
});


describe("closed category SDK capability", () => {
  const input = () => ({ ...ACTOR, p_conversation_id: UUID, p_operation_id: UUID, p_expected_revision: 1,
    p_command_fingerprint: SHA, p_target_item_id: UUID, p_member_item_ids: [UUID], p_label: "A broader category" });
  it("uses the exact nine-argument RPC and copies bounded member IDs", async () => {
    const f = fixture({ outcome: "ok", conversation_state: null }); const original = input();
    expect(await f.repository.category!(original)).toEqual({ outcome: "ok", conversation_state: null });
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("solmind_confirm_explorer_compass_category_v1", original);
    const sent = f.rpc.mock.calls[0][1] as typeof original;
    expect(Object.keys(sent)).toHaveLength(9); expect(sent.p_member_item_ids).not.toBe(original.p_member_item_ids);
    expect(Object.isFrozen(sent.p_member_item_ids)).toBe(true); expect(f.abortSignal).toHaveBeenCalledOnce();
  });
  it("refuses malformed member framing and extra authority before IO", async () => {
    const trap = vi.fn(); const sparse = new Array<string>(1);
    for (const ids of [[], [UUID, UUID], Array.from({ length: 25 }, () => UUID), ["bad"], sparse, new Proxy([UUID], { get: trap })]) {
      const f = fixture(null);
      await expect(f.repository.category!({ ...input(), p_member_item_ids: ids })).rejects.toThrowError("explorer_private_repository_unavailable");
      expect(f.rpc).not.toHaveBeenCalled();
    }
    expect(trap).not.toHaveBeenCalled();
    const f = fixture(null); const expanded = { ...input(), p_extra: UUID };
    await expect(f.repository.category!(expanded)).rejects.toThrowError("explorer_private_repository_unavailable"); expect(f.rpc).not.toHaveBeenCalled();
  });
  it("rejects expanded results and never reposts unknown acknowledgement", async () => {
    const f = fixture({ outcome: "ok", conversation_state: null, policy_state: null });
    await expect(f.repository.category!(input())).rejects.toThrowError("explorer_private_repository_unavailable");
    expect(f.rpc).toHaveBeenCalledOnce(); const g = fixture(null);
    g.abortSignal.mockRejectedValue(new Error("Synthetic response loss"));
    await expect(g.repository.category!(input())).rejects.toThrowError("explorer_private_repository_unavailable"); expect(g.rpc).toHaveBeenCalledOnce();
  });
});


describe("closed Waypoint release SDK capability", () => {
  const input = () => ({ ...ACTOR, p_conversation_id: UUID, p_operation_id: UUID, p_expected_revision: 1,
    p_command_fingerprint: SHA, p_waypoint_id: UUID });
  it("uses only the exact seven-argument release RPC with bounded abort", async () => {
    const f = fixture({ outcome: "ok", conversation_state: null });
    expect(await f.repository.release!(input())).toEqual({ outcome: "ok", conversation_state: null });
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("solmind_release_explorer_waypoint_v1", input());
    expect(Object.keys(f.rpc.mock.calls[0][1] as object)).toHaveLength(7);expect(f.abortSignal).toHaveBeenCalledOnce();
  });
  it("refuses extra/malformed arguments and expanded result, never replaying unknown acknowledgement", async () => {
    for (const request of [{ ...input(), p_extra: true }, { ...input(), p_waypoint_id: undefined }]) {
      const f = fixture(null);await expect(f.repository.release!(request as unknown as Parameters<NonNullable<typeof f.repository.release>>[0])).rejects.toThrowError("explorer_private_repository_unavailable");expect(f.rpc).not.toHaveBeenCalled();
    }
    const f = fixture({ outcome: "ok", conversation_state: null, policy_state: null });
    await expect(f.repository.release!(input())).rejects.toThrow();expect(f.rpc).toHaveBeenCalledOnce();
    const g = fixture(null);g.abortSignal.mockRejectedValue(new Error("Synthetic loss"));
    await expect(g.repository.release!(input())).rejects.toThrow();expect(g.rpc).toHaveBeenCalledOnce();
  });
});


describe("closed clarification successor SDK",()=>{
 const input=()=>({...ACTOR,p_conversation_id:UUID,p_operation_id:UUID,p_expected_revision:1,p_command_fingerprint:SHA,p_kind:"revise_waypoint" as const,p_waypoint_id:UUID,
   p_answers:[{component:"destination" as const,answer:"A clarified destination"}]});
 it("sends exact9arguments and copies only closed bounded answers",async()=>{
  const f=fixture({outcome:"ok",conversation_state:null});const original=input();await f.repository.waypointRevision!(original);
  expect(f.rpc).toHaveBeenCalledExactlyOnceWith("solmind_confirm_explorer_waypoint_revision_v1",original);
  const sent=f.rpc.mock.calls[0][1] as typeof original;expect(Object.keys(sent)).toHaveLength(9);expect(sent.p_answers).not.toBe(original.p_answers);expect(Object.isFrozen(sent.p_answers)).toBe(true);expect(Object.isFrozen(sent.p_answers[0])).toBe(true);
 });
 it("refuses reordered,duplicate,expanded,getter and malformed answer frames beforeIO",async()=>{
  const trap=vi.fn();const getter={component:"destination",answer:"one"};Object.defineProperty(getter,"answer",{enumerable:true,get:trap});
  for(const answers of [[{component:"meaning",answer:"why"},{component:"destination",answer:"where"}],Array(4).fill({component:"destination",answer:"where"}),
    [{component:"destination",answer:" padded "}],[{component:"destination",answer:"where",extra:true}],[getter],new Proxy([], {get:trap})]){
   const f=fixture(null);await expect(f.repository.waypointRevision!({...input(),p_answers:answers} as unknown as Parameters<NonNullable<typeof f.repository.waypointRevision>>[0])).rejects.toThrow();expect(f.rpc).not.toHaveBeenCalled();
  }expect(trap).not.toHaveBeenCalled();
 });
});
