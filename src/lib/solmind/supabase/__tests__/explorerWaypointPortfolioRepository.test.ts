import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createExplorerPrivateConversationRepository } from "../explorerPrivateConversationRepository";

const ID = "00000000-0000-4000-8000-000000000001";
const ACTOR = { p_actor_user_account_id: ID, p_user_session_id: ID };
const item = { id: ID, conversationId: ID, sourceMessageId: ID, isCurrent: true,
  createdAt: "2026-11-06T10:00:00.000Z", title: "Title", destination: "Destination", meaning: "Reason",
  arrivalSignal: "Arrival", status: "chosen", release: { operationId: ID, releasedAt: "2026-11-06T11:00:00.000Z" } };
// Current-head pages carry each row's conversationEnded fact (migration 20261106050000).
const page = (kind: string) => ({ kind, limit: 20, items: [kind === "current_heads" ? { ...item, conversationEnded: true } : item],
  hasMore: false, nextOffset: null });
const closure = { ...ACTOR, p_waypoint_id: ID, p_operation_id: ID, p_command_fingerprint: "A".repeat(64),
  p_kind: "release_waypoint" as const, p_reached_evidence: null };
function fixture(row: unknown) {
  const abortSignal = vi.fn(async (signal: AbortSignal) => { void signal; return { data: [row], error: null }; });
  const rpc = vi.fn((name: string, input: unknown) => { void name; void input; return { abortSignal }; });
  return { rpc, abortSignal, repository: createExplorerPrivateConversationRepository({ rpc } as unknown as SupabaseClient) };
}

describe("closed private Waypoint repository ports", () => {
  it("uses exact read and closure capabilities with bounded, frozen pages", async () => {
    const heads = fixture({ outcome: "ok", waypoint_page: page("current_heads") });
    const result = await heads.repository.readWaypointHeads!({ ...ACTOR, p_offset: 0 });
    expect(heads.rpc).toHaveBeenCalledExactlyOnceWith("solmind_read_explorer_waypoint_heads_v1", { ...ACTOR, p_offset: 0 });
    expect(heads.abortSignal.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
    expect(Object.isFrozen(result.waypoint_page)).toBe(true);
    const history = fixture({ outcome: "ok", waypoint_page: page("history") });
    await history.repository.readWaypointHistory!({ ...ACTOR, p_conversation_id: ID, p_offset: 20 });
    expect(history.rpc).toHaveBeenCalledExactlyOnceWith("solmind_read_explorer_waypoint_history_v1",
      { ...ACTOR, p_conversation_id: ID, p_offset: 20 });
    const close = fixture({ outcome: "exact_replay", waypoint_page: page("closure") });
    expect((await close.repository.closeEndedWaypoint!(closure)).outcome).toBe("exact_replay");
    expect(close.rpc).toHaveBeenCalledExactlyOnceWith("solmind_close_ended_explorer_waypoint_v1", closure);
  });
  it.each([-1, 1.5, NaN, 2147483647, undefined, null])("refuses invalid offsets before RPC: %j", async offset => {
    const f = fixture(null);
    await expect(f.repository.readWaypointHeads!({ ...ACTOR, p_offset: offset as number })).rejects.toThrow("explorer_private_repository_unavailable");
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("rejects expanded inputs and missing Reached evidence before RPC", async () => {
    for (const input of [{ ...closure, p_guide_id: ID }, { ...closure, p_kind: "reach_waypoint", p_reached_evidence: null },
      { ...closure, p_kind: "reach_waypoint", p_reached_evidence: " " }, { ...closure, p_reached_evidence: "Release must not take evidence" }]) {
      const f = fixture(null);
      await expect(f.repository.closeEndedWaypoint!(input as typeof closure)).rejects.toThrow();
      expect(f.rpc).not.toHaveBeenCalled();
    }
  });
  it("rejects wrong page kinds, expanded results, foreign provenance and broken pagination", async () => {
    for (const row of [{ outcome: "ok", waypoint_page: page("history") },
      { outcome: "ok", waypoint_page: page("current_heads"), transcript: [] },
      { outcome: "ok", waypoint_page: null }, { outcome: "invented", waypoint_page: page("current_heads") }]) {
      const f = fixture(row);
      await expect(f.repository.readWaypointHeads!({ ...ACTOR, p_offset: 0 })).rejects.toThrow();
      expect(f.rpc).toHaveBeenCalledOnce();
    }
    const foreign = fixture({ outcome: "ok", waypoint_page: page("history") });
    await expect(foreign.repository.readWaypointHistory!({ ...ACTOR, p_conversation_id: "00000000-0000-4000-8000-000000000002", p_offset: 0 })).rejects.toThrow();
    const malformed = fixture({ outcome: "ok", waypoint_page: { ...page("current_heads"), hasMore: true,
      nextOffset: 40, items: Array.from({ length: 20 }, (_, index) => ({ ...item, conversationEnded: true, id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}` })) } });
    await expect(malformed.repository.readWaypointHeads!({ ...ACTOR, p_offset: 0 })).rejects.toThrow();
  });
  it("requires and freezes server capacity, including grandfathered counts", async () => {
    const state = { turnedDownLimitReached: false, waypointDraft: null };
    for (const waypointCapacity of [undefined, null, {}, { activeCount: 0, activeLimit: 20, historyRoom: "true" }]) {
      const f = fixture({ outcome: "ok", conversation_state: { ...state, waypointCapacity }, authority_context: null, policy_state: null });
      await expect(f.repository.read({ accountId: ID, applicationSessionId: ID })).rejects.toThrow();
    }
    const waypointCapacity = { activeCount: 21, activeLimit: 20, historyRoom: false };
    const f = fixture({ outcome: "ok", conversation_state: { ...state, waypointCapacity }, authority_context: null, policy_state: null });
    const result = await f.repository.read({ accountId: ID, applicationSessionId: ID });
    expect(result.conversation_state).toEqual({ ...state, waypointCapacity });
    expect(Object.isFrozen((result.conversation_state as { waypointCapacity: unknown }).waypointCapacity)).toBe(true);
  });
  it("does not retry a closure whose acknowledgement is unknown", async () => {
    const f = fixture(null); f.abortSignal.mockRejectedValue(new Error("Private database detail"));
    await expect(f.repository.closeEndedWaypoint!(closure)).rejects.toThrow("explorer_private_repository_unavailable");
    expect(f.rpc).toHaveBeenCalledOnce();
  });
  it("requires the receipt's terminal fact to match the exact closure request", async () => {
    const reached = { ...item, release: undefined, status: "reached", reachedEvidence: "Observed arrival", reachedAt: item.createdAt };
    const { release, ...reachedFields } = reached; void release;
    const wrongKind = fixture({ outcome: "ok", waypoint_page: { ...page("closure"), items: [reachedFields] } });
    await expect(wrongKind.repository.closeEndedWaypoint!(closure)).rejects.toThrow();
    const wrongEvidence = fixture({ outcome: "ok", waypoint_page: { ...page("closure"), items: [reachedFields] } });
    await expect(wrongEvidence.repository.closeEndedWaypoint!({ ...closure,
      p_kind: "reach_waypoint", p_reached_evidence: "Different arrival evidence" })).rejects.toThrow();
    const wrongOperation = fixture({ outcome: "ok", waypoint_page: { ...page("closure"), items: [
      { ...item, release: { ...item.release, operationId: "00000000-0000-4000-8000-000000000002" } },
    ] } });
    await expect(wrongOperation.repository.closeEndedWaypoint!(closure)).rejects.toThrow();
  });
});
