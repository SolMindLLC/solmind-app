// Server composition for Your Waypoints with injected auth and repository ports only: no real login, SQL or provider.
import { describe, expect, it, vi } from "vitest";
import {
  closeExplorerYourWaypoint,
  explorerYourWaypointsCloseFingerprint,
  readExplorerYourWaypointHistory,
  readExplorerYourWaypoints,
} from "../explorerYourWaypointsComposition";
import type { ExplorerPrivateConversationDependencies } from "../../virtual-guide/explorerPrivateConversationComposition";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ACTOR = { accountId: id(101), applicationSessionId: id(102) };
const BASE = { p_actor_user_account_id: id(101), p_user_session_id: id(102) };
const ENDED = id(500);
const OPEN = id(501);
const row = (n: number, conversationId: string, extra: Record<string, unknown> = {}) => ({
  id: id(n), conversationId, sourceMessageId: id(900), isCurrent: true, createdAt: "2026-11-06T10:00:00.000Z",
  title: `Title ${n}`, destination: `Destination ${n}`, meaning: "Reason", arrivalSignal: "Arrival", status: "chosen", ...extra,
});
const page = (kind: string, items: unknown[], more: Partial<{ hasMore: boolean; nextOffset: number | null }> = {}) =>
  ({ kind, limit: 20, items, hasMore: false, nextOffset: null, ...more });

function dependencies(ports: Record<string, unknown>, actor: unknown = ACTOR) {
  return { authenticate: vi.fn(async () => actor), repository: ports } as unknown as ExplorerPrivateConversationDependencies;
}

describe("readExplorerYourWaypoints", () => {
  // Each current-head row carries SQL's own ended fact (migration 20261106050000), in any Guide relationship.
  const head = (n: number, ended: boolean) => ({ ...row(n, ended ? ENDED : OPEN), conversationEnded: ended });
  it("keeps each Waypoint's own ended fact and reads nothing else", async () => {
    const readWaypointHeads = vi.fn(async () => ({ outcome: "ok", waypoint_page: page("current_heads", [head(1, true), head(2, false)]) }));
    const review = vi.fn();
    const result = await readExplorerYourWaypoints(dependencies({ readWaypointHeads, review }), 0);
    expect(result.ok && result.items.map(item => [item.id, item.conversationEnded])).toEqual([[id(1), true], [id(2), false]]);
    expect(readWaypointHeads).toHaveBeenCalledExactlyOnceWith({ ...BASE, p_offset: 0 });
    expect(review).not.toHaveBeenCalled();
  });
  it("passes the next offset and reports more", async () => {
    const items = Array.from({ length: 20 }, (_, index) => head(index + 1, true));
    const readWaypointHeads = vi.fn(async () => ({ outcome: "ok", waypoint_page: page("current_heads", items, { hasMore: true, nextOffset: 40 }) }));
    const result = await readExplorerYourWaypoints(dependencies({ readWaypointHeads }), 20);
    expect(result.ok && [result.hasMore, result.nextOffset]).toEqual([true, 40]);
    expect(readWaypointHeads).toHaveBeenCalledExactlyOnceWith({ ...BASE, p_offset: 20 });
  });
  it.each([-20, 5, 1.5, 2147483640])("refuses offset %s before authentication", async offset => {
    const deps = dependencies({});
    expect((await readExplorerYourWaypoints(deps, offset)).error).toBe("denied");
    expect(deps.authenticate).not.toHaveBeenCalled();
  });
  it("is denied without an actor, and value-free on every failure", async () => {
    expect((await readExplorerYourWaypoints(dependencies({}, null), 0)).error).toBe("denied");
    const denied = vi.fn(async () => ({ outcome: "denied" }));
    expect((await readExplorerYourWaypoints(dependencies({ readWaypointHeads: denied }), 0)).error).toBe("denied");
    const thrown = vi.fn(async () => { throw new Error("private_secret"); });
    const result = await readExplorerYourWaypoints(dependencies({ readWaypointHeads: thrown }), 0);
    expect(result).toEqual({ version: "explorer-your-waypoints.v1", kind: "list", ok: false, items: null, hasMore: false, nextOffset: null, error: "unavailable" });
    expect((await readExplorerYourWaypoints(dependencies({}), 0)).error).toBe("unavailable");
    const noFact = vi.fn(async () => ({ outcome: "ok", waypoint_page: page("current_heads", [row(1, ENDED)]) }));
    expect((await readExplorerYourWaypoints(dependencies({ readWaypointHeads: noFact }), 0)).error).toBe("unavailable");
    const wrong = vi.fn(async () => ({ outcome: "ok", waypoint_page: page("history", [row(1, ENDED)]) }));
    expect((await readExplorerYourWaypoints(dependencies({ readWaypointHeads: wrong }), 0)).error).toBe("unavailable");
  });
});

describe("readExplorerYourWaypointHistory", () => {
  // A revisit keeps the wording of a Released predecessor (no clarification answers).
  const same = { destination: "Destination", meaning: "Reason", arrivalSignal: "Arrival" };
  const releasedAt = (n: number) => ({ release: { operationId: id(700 + n), releasedAt: "2026-11-06T09:00:00.000Z" } });
  const head = row(3, ENDED, { ...same, lifecycle: { predecessorWaypointId: id(2), creationReason: "revisit", clarifications: [] } });
  const middle = row(2, ENDED, { ...same, ...releasedAt(2), isCurrent: false,
    lifecycle: { predecessorWaypointId: id(1), creationReason: "revisit", clarifications: [] } });
  const first = row(1, ENDED, { ...same, ...releasedAt(1), isCurrent: false });
  it("walks pages until the lineage is complete and returns it newest first, without the conversation field", async () => {
    const fillers = Array.from({ length: 18 }, (_, index) => row(10 + index, ENDED));
    const readWaypointHistory = vi.fn(async ({ p_offset }: { p_offset: number }) => (p_offset === 0
      ? { outcome: "ok", waypoint_page: page("history", [head, middle, ...fillers], { hasMore: true, nextOffset: 20 }) }
      : { outcome: "ok", waypoint_page: page("history", [first]) }));
    const result = await readExplorerYourWaypointHistory(dependencies({ readWaypointHistory }), ENDED, id(3));
    expect(result.ok && result.versions.map(version => version.id)).toEqual([id(3), id(2), id(1)]);
    expect(result.ok && result.complete).toBe(true);
    expect(result.ok && Object.hasOwn(result.versions[0], "conversationId")).toBe(false);
    expect(readWaypointHistory.mock.calls.map(([input]) => input)).toEqual([
      { ...BASE, p_conversation_id: ENDED, p_offset: 0 }, { ...BASE, p_conversation_id: ENDED, p_offset: 20 }]);
  });
  it("stops reading once the lineage is complete", async () => {
    const readWaypointHistory = vi.fn(async () => ({ outcome: "ok",
      waypoint_page: page("history", [head, middle, first, ...Array.from({ length: 17 }, (_, index) => row(10 + index, ENDED))], { hasMore: true, nextOffset: 20 }) }));
    expect((await readExplorerYourWaypointHistory(dependencies({ readWaypointHistory }), ENDED, id(3))).ok).toBe(true);
    expect(readWaypointHistory).toHaveBeenCalledOnce();
  });
  it("skips a row that comes twice when a version saved during the walk shifts the pages", async () => {
    const fillers = Array.from({ length: 18 }, (_, index) => row(10 + index, ENDED));
    const readWaypointHistory = vi.fn(async ({ p_offset }: { p_offset: number }) => (p_offset === 0
      ? { outcome: "ok", waypoint_page: page("history", [head, middle, ...fillers], { hasMore: true, nextOffset: 20 }) }
      : { outcome: "ok", waypoint_page: page("history", [fillers[17], first]) }));
    const result = await readExplorerYourWaypointHistory(dependencies({ readWaypointHistory }), ENDED, id(3));
    expect(result.ok && result.versions.map(version => version.id)).toEqual([id(3), id(2), id(1)]);
  });
  it("reports an incomplete lineage when the predecessor is not found", async () => {
    const readWaypointHistory = vi.fn(async () => ({ outcome: "ok", waypoint_page: page("history", [head, middle]) }));
    const result = await readExplorerYourWaypointHistory(dependencies({ readWaypointHistory }), ENDED, id(3));
    expect(result.ok && [result.versions.length, result.complete]).toEqual([2, false]);
  });
  it("denies a Waypoint that is not a current head of that conversation", async () => {
    const readWaypointHistory = vi.fn(async () => ({ outcome: "ok", waypoint_page: page("history", [head, middle, first]) }));
    expect((await readExplorerYourWaypointHistory(dependencies({ readWaypointHistory }), ENDED, id(2))).error).toBe("denied");
    expect((await readExplorerYourWaypointHistory(dependencies({ readWaypointHistory }), ENDED, id(99))).error).toBe("denied");
  });
  it("never reads more than eleven pages", async () => {
    let next = 1000;
    const readWaypointHistory = vi.fn(async ({ p_offset }: { p_offset: number }) => ({ outcome: "ok",
      waypoint_page: page("history", Array.from({ length: 20 }, () => row(next++, ENDED)), { hasMore: true, nextOffset: p_offset + 20 }) }));
    expect((await readExplorerYourWaypointHistory(dependencies({ readWaypointHistory }), ENDED, id(3))).error).toBe("denied");
    expect(readWaypointHistory).toHaveBeenCalledTimes(11);
  });
  it("refuses bad selectors before authentication and stays value-free", async () => {
    const deps = dependencies({});
    expect((await readExplorerYourWaypointHistory(deps, "x", id(3))).error).toBe("denied");
    expect(deps.authenticate).not.toHaveBeenCalled();
    const thrown = vi.fn(async () => { throw new Error("private_secret"); });
    expect(await readExplorerYourWaypointHistory(dependencies({ readWaypointHistory: thrown }), ENDED, id(3))).toEqual({
      version: "explorer-your-waypoints.v1", kind: "history", ok: false, waypointId: null, versions: null, complete: false, error: "unavailable" });
  });
});

describe("closeExplorerYourWaypoint", () => {
  const release = { kind: "release_waypoint", operationId: id(7), waypointId: id(1) } as const;
  const reach = { kind: "reach_waypoint", operationId: id(8), waypointId: id(1), reachedEvidence: "I did it." } as const;
  const released = row(1, ENDED, { release: { operationId: id(7), releasedAt: "2026-11-06T11:00:00.000Z" } });
  it("sends the exact closure with a server-computed fingerprint", async () => {
    const closeEndedWaypoint = vi.fn(async () => ({ outcome: "ok", waypoint_page: page("closure", [released]) }));
    const result = await closeExplorerYourWaypoint(dependencies({ closeEndedWaypoint }), release);
    expect(result.ok && [result.replay, result.item.conversationEnded]).toEqual([false, true]);
    expect(closeEndedWaypoint).toHaveBeenCalledExactlyOnceWith({ ...BASE, p_waypoint_id: id(1), p_operation_id: id(7),
      p_command_fingerprint: explorerYourWaypointsCloseFingerprint(release), p_kind: "release_waypoint", p_reached_evidence: null });
  });
  it("reports an exact replay", async () => {
    const closeEndedWaypoint = vi.fn(async () => ({ outcome: "exact_replay", waypoint_page: page("closure", [released]) }));
    expect((await closeExplorerYourWaypoint(dependencies({ closeEndedWaypoint }), release)).replay).toBe(true);
  });
  it("binds every reviewed field into the fingerprint", () => {
    const values = new Set([release, reach, { ...reach, reachedEvidence: "I did it!" }, { ...reach, operationId: id(9) },
      { ...release, waypointId: id(2) }].map(command => explorerYourWaypointsCloseFingerprint(command)));
    expect(values.size).toBe(5);
    expect(explorerYourWaypointsCloseFingerprint(reach)).toMatch(/^[0-9A-F]{64}$/);
  });
  it.each([["denied", "denied"], ["operation_conflict", "conflict"], ["unavailable", "unavailable"]])("maps %s to %s", async (outcome, error) => {
    const closeEndedWaypoint = vi.fn(async () => ({ outcome, waypoint_page: null }));
    expect((await closeExplorerYourWaypoint(dependencies({ closeEndedWaypoint }), reach)).error).toBe(error);
  });
  it("refuses a malformed command before authentication, and a mismatched page", async () => {
    const deps = dependencies({});
    expect((await closeExplorerYourWaypoint(deps, { ...release, actorAccountId: id(1) })).error).toBe("denied");
    expect(deps.authenticate).not.toHaveBeenCalled();
    const other = vi.fn(async () => ({ outcome: "ok", waypoint_page: page("closure", [{ ...released, id: id(2) }]) }));
    expect((await closeExplorerYourWaypoint(dependencies({ closeEndedWaypoint: other }), release)).error).toBe("unavailable");
    const thrown = vi.fn(async () => { throw new Error("private_secret"); });
    expect(await closeExplorerYourWaypoint(dependencies({ closeEndedWaypoint: thrown }), release)).toEqual({
      version: "explorer-your-waypoints.v1", kind: "close", ok: false, replay: false, item: null, error: "unavailable" });
  });
});
