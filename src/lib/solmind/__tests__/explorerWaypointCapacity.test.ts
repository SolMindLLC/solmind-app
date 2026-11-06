import { describe, expect, it } from "vitest";
import { type ExplorerConversationState } from "../explorerConversationContract";
import { waypointCapacityMessage, WAYPOINT_ACTIVE_LIMIT_REASON, WAYPOINT_HISTORY_LIMIT_REASON,
  WAYPOINT_DRAFT_ACTIVE_LIMIT_REASON, WAYPOINT_DRAFT_HISTORY_LIMIT_REASON } from "../explorerWaypointCapacity";

const state = (activeCount: number, historyRoom = true, activeLimit = 20) => ({
  waypointCapacity: { activeCount, activeLimit, historyRoom },
});

describe("Paul's approved Waypoint capacity wording (2026-11-06 15:13:41 CST)", () => {
  it("pins all four approved sentences exactly", () => {
    expect(WAYPOINT_ACTIVE_LIMIT_REASON).toBe("You have {activeCount} active Waypoints across your conversations. To help keep your focus manageable, your total must be below {activeLimit} before adding or bringing back another. Reached and Released Waypoints do not count. Review and confirm Reached for Waypoints you have reached, or release those you no longer want to pursue.");
    expect(WAYPOINT_HISTORY_LIMIT_REASON).toBe("This conversation has reached its limit of 200 saved Waypoint versions, to keep its saved history manageable. No new Waypoint or version can be saved here. Marking one Reached or Released does not make room for another version. You can still read the Waypoints shown here, use Reached or Release where available, or end an active conversation.");
    expect(WAYPOINT_DRAFT_ACTIVE_LIMIT_REASON).toBe('"That\'s right" is unavailable because you have {activeCount} active Waypoints across your conversations. To help keep your focus manageable, your total must be below {activeLimit} before adding another. This limit does not block other replies or typing what you would change.');
    expect(WAYPOINT_DRAFT_HISTORY_LIMIT_REASON).toBe('"That\'s right" is unavailable because this conversation has reached its limit of 200 saved Waypoint versions, to keep its saved history manageable. This limit does not block other replies or typing what you would change.');
  });

  it.each([0, 19, 20, 21])("chooses history first at %i active, including when both limits apply", activeCount => {
    expect(waypointCapacityMessage(state(activeCount, false))).toBe(WAYPOINT_HISTORY_LIMIT_REASON);
    expect(waypointCapacityMessage(state(activeCount, false), false)).toBe(WAYPOINT_HISTORY_LIMIT_REASON);
    expect(waypointCapacityMessage(state(activeCount, false), true, true)).toBe(WAYPOINT_DRAFT_HISTORY_LIMIT_REASON);
  });

  it.each([20, 21])("uses the server's actual %i of 20 count for additions and draft confirmation", activeCount => {
    expect(waypointCapacityMessage(state(activeCount))).toBe(WAYPOINT_ACTIVE_LIMIT_REASON
      .replace("{activeCount}", String(activeCount)).replace("{activeLimit}", "20"));
    expect(waypointCapacityMessage(state(activeCount), true, true)).toBe(WAYPOINT_DRAFT_ACTIVE_LIMIT_REASON
      .replace("{activeCount}", String(activeCount)).replace("{activeLimit}", "20"));
  });

  it("fills the limit from the server rather than a browser constant or a visible-list count", () => {
    const partial = { ...state(9, true, 8), waypoints: [] };
    expect(waypointCapacityMessage(partial)).toBe(WAYPOINT_ACTIVE_LIMIT_REASON.replace("{activeCount}", "9").replace("{activeLimit}", "8"));
    expect(waypointCapacityMessage(partial, true, true)).toBe(WAYPOINT_DRAFT_ACTIVE_LIMIT_REASON.replace("{activeCount}", "9").replace("{activeLimit}", "8"));
  });

  it.each([0, 19])("returns no explanation when neither limit applies at %i active", activeCount => {
    expect(waypointCapacityMessage(state(activeCount))).toBeNull();
    expect(waypointCapacityMessage(state(activeCount), true, true)).toBeNull();
  });

  it.each([19, 20, 21])("never explains or blocks revision with the active limit at %i", activeCount => {
    expect(waypointCapacityMessage(state(activeCount), false)).toBeNull();
  });

  it.each([undefined, null, {}, { activeCount: 20, activeLimit: 20, historyRoom: null },
    { activeCount: -1, activeLimit: 20, historyRoom: false },
    { activeCount: 20, activeLimit: 0, historyRoom: false },
    { activeCount: "20", activeLimit: 20, historyRoom: false }])("fails closed with calm unavailable wording for invalid capacity %j", waypointCapacity => {
    const invalid = { waypointCapacity } as unknown as Pick<ExplorerConversationState, "waypointCapacity">;
    for (const increasesActive of [true, false]) {
      expect(waypointCapacityMessage(invalid, increasesActive)).toBe("The conversation could not be loaded. Please try again.");
      expect(waypointCapacityMessage(invalid, increasesActive, true)).toBe("To keep this conversation safe, suggestion replies wait until SolMind can confirm this conversation's settings.");
    }
  });
});
