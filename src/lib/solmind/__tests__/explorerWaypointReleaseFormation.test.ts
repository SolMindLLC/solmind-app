import { describe, expect, it } from "vitest";
import { EXPLORER_CONVERSATION_VERSION, type ExplorerConversationState } from "../explorerConversationContract";
import {
  buildReachedFormationIntent,
  buildWaypointFormationIntent,
  buildWaypointReleaseFormationIntent,
} from "../explorerConversationFormation";

const source = { id: "source-a", role: "explorer" as const, body: "I want calmer mornings.", createdAt: "2026-10-29T14:00:00Z" };
const waypoint = { id: "waypoint-a", sourceMessageId: source.id, destination: "A calm breakfast",
  meaning: "Connecting", arrivalSignal: "A shared unhurried breakfast", status: "chosen" as const };
const release = { operationId: "release-operation", releasedAt: "2026-10-29T15:00:00Z" };
function state(overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  return { version: EXPLORER_CONVERSATION_VERSION, conversationId: "conversation-a", revision: 4,
    providerState: "unavailable", pendingTurn: false, messages: [source], compassItems: [],
    priorityId: null, attentionId: null, waypoints: [waypoint], sessionStatus: "active", ending: null,
    ...overrides };
}

describe("review-bound private Waypoint Release intent", () => {
  it("requires an explicit review at the current revision and emits only a selected private command", () => {
    const current = state();
    expect(buildWaypointReleaseFormationIntent(current, waypoint.id, 4, false).ok).toBe(false);
    const result = buildWaypointReleaseFormationIntent(current, waypoint.id, 4, true);
    expect(result).toEqual({ ok: true, command: { kind: "release_waypoint", waypointId: waypoint.id }, error: null });
    expect(Object.isFrozen(result.command)).toBe(true);
    expect(current.waypoints[0]).toBe(waypoint);
    expect(current.messages[0]).toBe(source);
    expect(current.revision).toBe(4);
    expect(result.command).not.toHaveProperty("releasedAt");
    expect(result.command).not.toHaveProperty("operationId");
    expect(result.command).not.toHaveProperty("expectedRevision");
  });

  it("refuses stale or missing active review, pending writes and foreign or terminal choices", () => {
    for (const current of [state({ conversationId: null }), state({ sessionStatus: "ended" }),
      state({ sessionStatus: null }), state({ pendingTurn: true }),
      state({ waypoints: [{ ...waypoint, status: "reached" }] }),
      state({ waypoints: [{ ...waypoint, release }] })]) {
      expect(buildWaypointReleaseFormationIntent(current, waypoint.id, 4, true).ok).toBe(false);
    }
    for (const reviewedRevision of [3, 5, -1, 0.5, NaN, Infinity]) {
      expect(buildWaypointReleaseFormationIntent(state(), waypoint.id, reviewedRevision, true).ok).toBe(false);
    }
    expect(buildWaypointReleaseFormationIntent(state(), "other-waypoint", 4, true).ok).toBe(false);
  });

  it("does not free a saved row, erase a definition or turn release into Reached", () => {
    const current = state({ waypoints: Array.from({ length: 20 }, (_, i) => ({ ...waypoint, id: `waypoint-${i}`, ...(i ? { release } : {}) })) });
    expect(buildWaypointReleaseFormationIntent(current, "waypoint-0", 4, true).ok).toBe(true);
    expect(buildWaypointFormationIntent(current, { sourceMessageId: source.id, destination: "New",
      meaning: "New meaning", arrivalSignal: "New signal", confirmed: true }).ok).toBe(false);
    expect(current.waypoints).toHaveLength(20);
    expect(current.waypoints.every(item => item.status === "chosen")).toBe(true);
    expect(current.waypoints[0]).not.toHaveProperty("release");
    expect(buildReachedFormationIntent(state({ waypoints: [{ ...waypoint, release }] }), waypoint.id,
      "Evidence cannot silently reopen this released choice", true).ok).toBe(false);
    expect(buildReachedFormationIntent(state(), waypoint.id, "An actual calm breakfast", true).ok).toBe(true);
  });
});
