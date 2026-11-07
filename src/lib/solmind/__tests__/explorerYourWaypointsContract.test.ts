// Browser contract for the private Your Waypoints section: closed shapes only, synthetic data.
import { describe, expect, it } from "vitest";
import {
  EXPLORER_YOUR_WAYPOINTS_VERSION as VERSION,
  parseExplorerYourWaypointsCloseCommand,
  parseExplorerYourWaypointsCloseResult,
  parseExplorerYourWaypointsHistoryResult,
  parseExplorerYourWaypointsListResult,
} from "../explorerYourWaypointsContract";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const waypoint = (n: number, extra: Record<string, unknown> = {}) => ({
  id: id(n), sourceMessageId: id(900), isCurrent: true, createdAt: "2026-11-06T10:00:00.000Z",
  title: `Title ${n}`, destination: `Destination ${n}`, meaning: "Reason", arrivalSignal: "Arrival", status: "chosen", ...extra,
});
const item = (n: number, extra: Record<string, unknown> = {}) => ({ ...waypoint(n), conversationId: id(500), conversationEnded: true, ...extra });
const list = (items: unknown[], more: Partial<{ hasMore: boolean; nextOffset: number | null }> = {}) => ({
  version: VERSION, kind: "list", ok: true, items, hasMore: false, nextOffset: null, error: null, ...more,
});

describe("list result", () => {
  it("accepts a bounded page and keeps the ended flag per item, frozen", () => {
    const result = parseExplorerYourWaypointsListResult(list([item(1), item(2, { conversationEnded: false })]));
    expect(result?.ok && result.items.map(entry => entry.conversationEnded)).toEqual([true, false]);
    expect(Object.isFrozen(result) && result?.ok && Object.isFrozen(result.items[0])).toBe(true);
  });
  it("accepts a full page with more to load at the next offset", () => {
    const items = Array.from({ length: 20 }, (_, index) => item(index + 1));
    expect(parseExplorerYourWaypointsListResult(list(items, { hasMore: true, nextOffset: 20 }))?.ok).toBe(true);
  });
  it.each([
    ["a missing ended flag", list([waypoint(1)])],
    ["a non-boolean ended flag", list([{ ...item(1), conversationEnded: "yes" }])],
    ["an extra field", list([{ ...item(1), transcript: [] }])],
    ["an earlier version on the current page", list([item(1, { isCurrent: false })])],
    ["a duplicate", list([item(1), item(1)])],
    ["more than one page", list(Array.from({ length: 21 }, (_, index) => item(index + 1)))],
    ["more without a full page", list([item(1)], { hasMore: true, nextOffset: 20 })],
    ["a wrong version", { ...list([]), version: "explorer-your-waypoints.v0" }],
    ["an extra top-level key", { ...list([]), actorAccountId: id(1) }],
    ["failure with items", { version: VERSION, kind: "list", ok: false, items: [], hasMore: false, nextOffset: null, error: "denied" }],
    ["an unknown error", { version: VERSION, kind: "list", ok: false, items: null, hasMore: false, nextOffset: null, error: "secret" }],
  ])("refuses %s", (_name, value) => {
    expect(parseExplorerYourWaypointsListResult(value)).toBeNull();
  });
  it("accepts the closed failures", () => {
    for (const error of ["denied", "unavailable"]) {
      expect(parseExplorerYourWaypointsListResult({ version: VERSION, kind: "list", ok: false, items: null,
        hasMore: false, nextOffset: null, error })).toEqual({ version: VERSION, kind: "list", ok: false, items: null,
        hasMore: false, nextOffset: null, error });
    }
  });
});

describe("history result", () => {
  // A revisit keeps the wording of a Released predecessor (no clarification answers).
  const same = { destination: "Destination", meaning: "Reason", arrivalSignal: "Arrival" };
  const released = (n: number) => ({ release: { operationId: id(700 + n), releasedAt: "2026-11-06T09:00:00.000Z" } });
  const head = waypoint(3, { ...same, lifecycle: { predecessorWaypointId: id(2), creationReason: "revisit", clarifications: [] } });
  const middle = waypoint(2, { ...same, ...released(2), isCurrent: false,
    lifecycle: { predecessorWaypointId: id(1), creationReason: "revisit", clarifications: [] } });
  const first = waypoint(1, { ...same, ...released(1), isCurrent: false });
  const history = (versions: unknown[], complete: boolean) => ({
    version: VERSION, kind: "history", ok: true, waypointId: id(3), versions, complete, error: null,
  });
  it("accepts the current Waypoint followed by its predecessors", () => {
    const result = parseExplorerYourWaypointsHistoryResult(history([head, middle, first], true));
    expect(result?.ok && result.versions.map(version => version.id)).toEqual([id(3), id(2), id(1)]);
  });
  it("accepts an incomplete chain only when marked incomplete", () => {
    expect(parseExplorerYourWaypointsHistoryResult(history([head, middle], false))?.ok).toBe(true);
    expect(parseExplorerYourWaypointsHistoryResult(history([head, middle], true))).toBeNull();
    expect(parseExplorerYourWaypointsHistoryResult(history([head, middle, first], false))).toBeNull();
  });
  it.each([
    ["a different first Waypoint", () => history([middle, first], true)],
    ["a non-current first Waypoint", () => ({ ...history([{ ...head, isCurrent: false }, middle, first], true) })],
    ["a broken chain", () => history([head, first], true)],
    ["a current earlier version", () => history([head, { ...middle, isCurrent: true }, first], true)],
    ["no versions", () => history([], true)],
  ])("refuses %s", (_name, value) => {
    expect(parseExplorerYourWaypointsHistoryResult(value())).toBeNull();
  });
});

describe("close command", () => {
  it("accepts exact Reached and Release requests", () => {
    expect(parseExplorerYourWaypointsCloseCommand({ kind: "release_waypoint", operationId: id(7), waypointId: id(1) }))
      .toEqual({ kind: "release_waypoint", operationId: id(7), waypointId: id(1) });
    expect(parseExplorerYourWaypointsCloseCommand({ kind: "reach_waypoint", operationId: id(7), waypointId: id(1),
      reachedEvidence: "I walked the trail\nevery week." })?.kind).toBe("reach_waypoint");
  });
  it.each([
    { kind: "release_waypoint", operationId: id(7), waypointId: id(1), reachedEvidence: "x" },
    { kind: "reach_waypoint", operationId: id(7), waypointId: id(1) },
    { kind: "reach_waypoint", operationId: id(7), waypointId: id(1), reachedEvidence: "   " },
    { kind: "reach_waypoint", operationId: id(7), waypointId: id(1), reachedEvidence: " untrimmed" },
    { kind: "reach_waypoint", operationId: id(7), waypointId: id(1), reachedEvidence: "x".repeat(1001) },
    { kind: "reach_waypoint", operationId: id(7), waypointId: id(1), reachedEvidence: "bad\u0000byte" },
    { kind: "release_waypoint", operationId: "not-a-uuid", waypointId: id(1) },
    { kind: "release_waypoint", operationId: id(7), waypointId: id(1), actorAccountId: id(2) },
    { kind: "revise_waypoint", operationId: id(7), waypointId: id(1) },
    null, [], "release",
  ])("refuses %j", value => {
    expect(parseExplorerYourWaypointsCloseCommand(value)).toBeNull();
  });
});

describe("close result", () => {
  const released = item(1, { release: { operationId: id(7), releasedAt: "2026-11-06T11:00:00.000Z" } });
  it("accepts one closed Waypoint from an ended conversation", () => {
    const result = parseExplorerYourWaypointsCloseResult({ version: VERSION, kind: "close", ok: true, replay: true, item: released, error: null });
    expect(result?.ok && result.replay && result.item.release?.operationId).toBe(id(7));
  });
  it.each([
    ["an open conversation", { ...released, conversationEnded: false }],
    ["a Waypoint that is not closed", item(1)],
    ["an earlier version", { ...released, isCurrent: false }],
  ])("refuses %s", (_name, value) => {
    expect(parseExplorerYourWaypointsCloseResult({ version: VERSION, kind: "close", ok: true, replay: false, item: value, error: null })).toBeNull();
  });
  it("accepts only the closed failures", () => {
    for (const error of ["denied", "conflict", "unavailable"]) {
      expect(parseExplorerYourWaypointsCloseResult({ version: VERSION, kind: "close", ok: false, replay: false, item: null, error })?.ok).toBe(false);
    }
    expect(parseExplorerYourWaypointsCloseResult({ version: VERSION, kind: "close", ok: false, replay: false, item: null, error: "stale" })).toBeNull();
  });
});
