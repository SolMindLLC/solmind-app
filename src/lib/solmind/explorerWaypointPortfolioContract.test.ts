import { describe, expect, it } from "vitest";
import { parseExplorerWaypointPage } from "./explorerWaypointPortfolioContract";

const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const time = "2026-11-06T10:00:00.000Z";
const item = (n = 1) => ({ id: id(n), conversationId: id(100), sourceMessageId: id(101),
  isCurrent: true, createdAt: time, title: "Saved title", destination: "Destination", meaning: "Reason",
  arrivalSignal: "Arrival", status: "chosen" });
const page = (items = [item()]) => ({ kind: "current_heads", limit: 20, items, hasMore: false, nextOffset: null });

describe("bounded owner-private Waypoint pages", () => {
  it("freezes provenance and authoritative currentness without demanding the transcript", () => {
    const parsed = parseExplorerWaypointPage(page());
    expect(parsed).toEqual(page());
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed?.items)).toBe(true);
    expect(Object.isFrozen(parsed?.items[0])).toBe(true);
  });
  it("reads an oldest version independently and a head with an omitted predecessor", () => {
    const predecessor = { ...item(), isCurrent: false };
    expect(parseExplorerWaypointPage({ ...page([predecessor]), kind: "history" })?.items[0].isCurrent).toBe(false);
    const successor = { ...item(2), destination: "New destination", lifecycle: { predecessorWaypointId: id(1),
      creationReason: "revision", clarifications: [{ component: "destination", questionKey: "waypoint.destination.v1",
        answer: "New destination", recordedAt: time }] } };
    expect(parseExplorerWaypointPage(page([successor]))?.items[0].lifecycle?.predecessorWaypointId).toBe(id(1));
    const history = { ...page([predecessor, successor]), kind: "history" };
    expect(parseExplorerWaypointPage(history)).not.toBeNull();
    expect(parseExplorerWaypointPage({ ...history, items: [item(), successor] })).toBeNull();
    expect(parseExplorerWaypointPage({ ...history, items: [{ ...predecessor, sourceMessageId: id(999) }, successor] })).toBeNull();
  });
  it("bounds maximum escaped Unicode fields and preserves exactly twenty items", () => {
    const text = '\ud83d\ude00"\\\n'.repeat(200);
    const items = Array.from({ length: 20 }, (_, n) => ({ ...item(n + 1), title: text,
      destination: text, meaning: text, arrivalSignal: text }));
    const complete = { ...page(items), hasMore: true, nextOffset: 20 };
    expect(parseExplorerWaypointPage(JSON.parse(JSON.stringify(complete)))?.items).toHaveLength(20);
    expect(JSON.stringify(complete).length).toBeLessThan(1_200_000);
    expect(parseExplorerWaypointPage(page([...items, item(21)]))).toBeNull();
  });
  it.each([
    { limit: 200 }, { hasMore: true, nextOffset: 20 }, { nextOffset: 20 }, { transcript: [] },
    { items: [item(), item()] }, { items: [{ ...item(), isCurrent: false }] },
    { items: [{ ...item(), conversationId: "bad" }] }, { items: [{ ...item(), privateActor: id(1) }] },
  ])("refuses malformed or expanded pages %j", change => {
    expect(parseExplorerWaypointPage({ ...page(), ...change })).toBeNull();
  });
  it("requires one terminal head in a closure receipt", () => {
    expect(parseExplorerWaypointPage({ ...page(), kind: "closure" })).toBeNull();
    expect(parseExplorerWaypointPage({ ...page([]), kind: "closure" })).toBeNull();
    const reached = { ...item(), status: "reached", reachedEvidence: "Explicit evidence", reachedAt: time };
    expect(parseExplorerWaypointPage({ ...page([reached]), kind: "closure" })).not.toBeNull();
    const released = { ...item(), release: { operationId: id(99), releasedAt: time } };
    expect(parseExplorerWaypointPage({ ...page([released]), kind: "closure" })).not.toBeNull();
  });
  it("refuses accessor and sparse pages without invoking their accessors", () => {
    let read = false;
    const value = page();
    Object.defineProperty(value, "items", { enumerable: true, get() { read = true; return []; } });
    expect(parseExplorerWaypointPage(value)).toBeNull(); expect(read).toBe(false);
    expect(parseExplorerWaypointPage(page(new Array(20)))).toBeNull();
  });
});
