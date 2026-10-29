import { describe, expect, it } from "vitest";
import {
  EXPLORER_CONVERSATION_VERSION,
  parseExplorerConversationCommand,
  parseExplorerConversationState,
} from "../explorerConversationContract";

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const command = { kind: "release_waypoint", operationId: uuid(7), expectedRevision: 4, waypointId: uuid(3) };
const capture = () => ({ operationId: uuid(7), releasedAt: "2026-10-29T15:00:00.123456+00:00" });
const legacyWaypoint = {
  id: uuid(3), sourceMessageId: uuid(2), destination: "An unhurried morning",
  meaning: "Connecting with my family", arrivalSignal: "A calm breakfast together", status: "chosen",
};
function state(waypoint: unknown = legacyWaypoint) {
  return { version: EXPLORER_CONVERSATION_VERSION, conversationId: uuid(1), revision: 5,
    providerState: "unavailable", pendingTurn: false, messages: [
      { id: uuid(2), role: "explorer", body: "I want time for my family.", createdAt: "2026-10-29T14:00:00.000Z" },
    ], compassItems: [], priorityId: null, attentionId: null, waypoints: [waypoint],
    sessionStatus: "active", ending: null };
}

describe("closed private Waypoint release command", () => {
  it("accepts only the selected Waypoint, stable operation and expected revision", () => {
    const parsed = parseExplorerConversationCommand(command);
    expect(parsed).toEqual(command);
    expect(parsed).not.toBe(command);
    expect(Object.isFrozen(parsed)).toBe(true);
  });

  it("rejects missing keys, extra authority/content and malformed exact selectors", () => {
    for (const key of Object.keys(command)) {
      expect(parseExplorerConversationCommand(Object.fromEntries(Object.entries(command).filter(([k]) => k !== key)))).toBeNull();
    }
    for (const extra of ["accountId", "sessionId", "releasedAt", "release", "destination", "sourceBody", "status"]) {
      expect(parseExplorerConversationCommand({ ...command, [extra]: uuid(8) })).toBeNull();
    }
    for (const key of ["operationId", "waypointId"] as const) {
      for (const value of ["", ` ${command[key]}`, `${command[key]}\n`, command[key].toUpperCase().replace("00000000", "ABCDEF00"), null]) {
        expect(parseExplorerConversationCommand({ ...command, [key]: value })).toBeNull();
      }
    }
    for (const expectedRevision of [-1, 0.5, NaN, Infinity, 2_147_483_648]) {
      expect(parseExplorerConversationCommand({ ...command, expectedRevision })).toBeNull();
    }
  });
});

describe("saved private Waypoint release history", () => {
  it("keeps the exact legacy shape and does not manufacture a release or Reached fact", () => {
    const parsed = parseExplorerConversationState(state());
    expect(parsed?.waypoints).toEqual([legacyWaypoint]);
    expect(parsed?.waypoints[0]).not.toHaveProperty("release");
    expect(parsed?.waypoints[0].status).toBe("chosen");
  });

  it("copies and deeply freezes the release while retaining the complete definition and source", () => {
    const original = capture();
    const saved = { ...legacyWaypoint, reachedEvidence: null, reachedAt: null, release: original };
    const parsed = parseExplorerConversationState(state(saved));
    expect(parsed?.waypoints[0]).toEqual(saved);
    expect(Object.isFrozen(parsed?.waypoints[0].release)).toBe(true);
    original.releasedAt = "2026-10-29T16:00:00.000Z";
    expect(parsed?.waypoints[0].release?.releasedAt).toBe("2026-10-29T15:00:00.123456+00:00");
    expect(parsed?.messages[0].body).toBe("I want time for my family.");
    expect(parsed?.waypoints[0].status).toBe("chosen");
  });

  it("rejects malformed, unpaired or fabricated release and contradictory Reached capture", () => {
    for (const release of [null, {}, { operationId: uuid(7) }, { releasedAt: capture().releasedAt },
      { ...capture(), actorId: uuid(9) }, { ...capture(), operationId: `${uuid(7)}\n` },
      { ...capture(), releasedAt: "2026-02-30T15:00:00Z" },
      Object.assign(Object.create({ actorId: uuid(9) }), capture()),
      { ...capture(), [Symbol("authority")]: true },
    ]) {
      expect(parseExplorerConversationState(state({ ...legacyWaypoint, release }))).toBeNull();
    }
    expect(parseExplorerConversationState(state({ ...legacyWaypoint, release: capture(),
      status: "reached", reachedEvidence: "A breakfast happened", reachedAt: "2026-10-29T14:30:00Z" }))).toBeNull();
    expect(parseExplorerConversationState(state({ ...legacyWaypoint, release: capture(),
      reachedEvidence: "A breakfast happened", reachedAt: "2026-10-29T14:30:00Z" }))).toBeNull();
  });

  it("retains factual released history in an ended read-only projection", () => {
    const ended = { ...state({ ...legacyWaypoint, release: capture() }), sessionStatus: "ended" };
    const parsed = parseExplorerConversationState(ended);
    expect(parsed?.sessionStatus).toBe("ended");
    expect(parsed?.providerState).toBe("unavailable");
    expect(parsed?.waypoints[0]).toEqual({ ...legacyWaypoint, release: capture() });
  });
});
