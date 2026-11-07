import { describe, expect, it } from "vitest";
import { type ExplorerConversationState } from "../explorerConversationContract";
import { waypointCapacityMessage, waypointConversationLimitNotice, WAYPOINT_ACTIVE_LIMIT_REASON, WAYPOINT_HISTORY_LIMIT_REASON,
  WAYPOINT_DRAFT_ACTIVE_LIMIT_REASON, WAYPOINT_DRAFT_HISTORY_LIMIT_REASON,
  WAYPOINT_CONVERSATION_LIMIT_REASON, WAYPOINT_DRAFT_CONVERSATION_LIMIT_REASON } from "../explorerWaypointCapacity";

const state = (activeCount: number, historyRoom = true, activeLimit = 20, conversationRoom = true) => ({
  waypointCapacity: { activeCount, activeLimit, historyRoom, conversationRoom },
});

describe("Paul's approved Waypoint capacity wording (2026-11-06 15:13:41 CST)", () => {
  it("pins all four approved sentences exactly", () => {
    expect(WAYPOINT_ACTIVE_LIMIT_REASON).toBe("You have {activeCount} active Waypoints across your conversations. To help keep your focus manageable, your total must be below {activeLimit} before adding or bringing back another. Reached and Released Waypoints do not count. Review and confirm Reached for Waypoints you have reached, or release those you no longer want to pursue.");
    expect(WAYPOINT_HISTORY_LIMIT_REASON).toBe("This conversation has reached its limit of 200 saved Waypoint versions, to keep its saved history manageable. No new Waypoint or version can be saved here. Marking one Reached or Released does not make room for another version. You can still read the Waypoints shown here, use Reached or Release where available, or end an active conversation.");
    expect(WAYPOINT_DRAFT_ACTIVE_LIMIT_REASON).toBe('"That\'s right" is unavailable because you have {activeCount} active Waypoints across your conversations. To help keep your focus manageable, your total must be below {activeLimit} before adding another. This limit does not block other replies or typing what you would change.');
    expect(WAYPOINT_DRAFT_HISTORY_LIMIT_REASON).toBe('"That\'s right" is unavailable because this conversation has reached its limit of 200 saved Waypoint versions, to keep its saved history manageable. This limit does not block other replies or typing what you would change.');
  });

  it.each([0, 19, 20, 21])("chooses history first at %i active, including when every limit applies", activeCount => {
    for (const conversationRoom of [true, false]) {
      expect(waypointCapacityMessage(state(activeCount, false, 20, conversationRoom))).toBe(WAYPOINT_HISTORY_LIMIT_REASON);
      expect(waypointCapacityMessage(state(activeCount, false, 20, conversationRoom), "revisit")).toBe(WAYPOINT_HISTORY_LIMIT_REASON);
      expect(waypointCapacityMessage(state(activeCount, false, 20, conversationRoom), "revision")).toBe(WAYPOINT_HISTORY_LIMIT_REASON);
      expect(waypointCapacityMessage(state(activeCount, false, 20, conversationRoom), "new", true)).toBe(WAYPOINT_DRAFT_HISTORY_LIMIT_REASON);
    }
  });

  it.each([20, 21])("uses the server's actual %i of 20 count for additions, revisits and draft confirmation", activeCount => {
    expect(waypointCapacityMessage(state(activeCount))).toBe(WAYPOINT_ACTIVE_LIMIT_REASON
      .replace("{activeCount}", String(activeCount)).replace("{activeLimit}", "20"));
    expect(waypointCapacityMessage(state(activeCount), "revisit")).toBe(WAYPOINT_ACTIVE_LIMIT_REASON
      .replace("{activeCount}", String(activeCount)).replace("{activeLimit}", "20"));
    expect(waypointCapacityMessage(state(activeCount), "new", true)).toBe(WAYPOINT_DRAFT_ACTIVE_LIMIT_REASON
      .replace("{activeCount}", String(activeCount)).replace("{activeLimit}", "20"));
  });

  it("fills the limit from the server rather than a browser constant or a visible-list count", () => {
    const partial = { ...state(9, true, 8), waypoints: [] };
    expect(waypointCapacityMessage(partial)).toBe(WAYPOINT_ACTIVE_LIMIT_REASON.replace("{activeCount}", "9").replace("{activeLimit}", "8"));
    expect(waypointCapacityMessage(partial, "new", true)).toBe(WAYPOINT_DRAFT_ACTIVE_LIMIT_REASON.replace("{activeCount}", "9").replace("{activeLimit}", "8"));
  });

  it.each([0, 19])("returns no explanation when no limit applies at %i active", activeCount => {
    expect(waypointCapacityMessage(state(activeCount))).toBeNull();
    expect(waypointCapacityMessage(state(activeCount), "revisit")).toBeNull();
    expect(waypointCapacityMessage(state(activeCount), "new", true)).toBeNull();
  });

  it.each([19, 20, 21])("never explains or blocks revision with the active limit at %i", activeCount => {
    expect(waypointCapacityMessage(state(activeCount), "revision")).toBeNull();
    expect(waypointCapacityMessage(state(activeCount, true, 20, false), "revision")).toBeNull();
  });

  it.each([undefined, null, {}, { activeCount: 20, activeLimit: 20, historyRoom: null, conversationRoom: true },
    { activeCount: -1, activeLimit: 20, historyRoom: false, conversationRoom: true },
    { activeCount: 20, activeLimit: 0, historyRoom: false, conversationRoom: true },
    { activeCount: "20", activeLimit: 20, historyRoom: false, conversationRoom: true },
    { activeCount: 0, activeLimit: 20, historyRoom: true },
    { activeCount: 0, activeLimit: 20, historyRoom: true, conversationRoom: "false" }])("fails closed with calm unavailable wording for invalid capacity %j", waypointCapacity => {
    const invalid = { waypointCapacity } as unknown as Pick<ExplorerConversationState, "waypointCapacity">;
    for (const purpose of ["new", "revisit", "revision"] as const) {
      expect(waypointCapacityMessage(invalid, purpose)).toBe("The conversation could not be loaded. Please try again.");
      expect(waypointCapacityMessage(invalid, purpose, true)).toBe("To keep this conversation safe, suggestion replies wait until SolMind can confirm this conversation's settings.");
    }
    expect(waypointConversationLimitNotice(invalid)).toBeNull();
  });
});

describe("lane 12: five different Waypoints per conversation (Paul's approved wording, 2026-11-07 08:02:45 CST)", () => {
  it("pins the two draft sentences, each with its reason and the recommended way to form another", () => {
    expect(WAYPOINT_CONVERSATION_LIMIT_REASON).toBe("This conversation has reached its limit of five different Waypoints, to help keep each conversation focused. Reached and Released Waypoints still count. You can keep talking here and work with your existing Waypoints. To form another Waypoint, end this conversation when you choose, then open With your Virtual Guide and send a message to start another.");
    expect(WAYPOINT_DRAFT_CONVERSATION_LIMIT_REASON).toBe('"That\'s right" is unavailable because this conversation has reached its five-Waypoint limit, to help keep each conversation focused. Reached and Released Waypoints still count. This limit does not block the other replies or typing. To form another Waypoint, end this conversation when you choose, then open With your Virtual Guide and send a message to start another.');
  });

  it.each([0, 19, 20, 21])("explains a new Waypoint with the five before the active limit at %i active", activeCount => {
    expect(waypointCapacityMessage(state(activeCount, true, 20, false))).toBe(WAYPOINT_CONVERSATION_LIMIT_REASON);
    expect(waypointCapacityMessage(state(activeCount, true, 20, false), "new", true)).toBe(WAYPOINT_DRAFT_CONVERSATION_LIMIT_REASON);
  });

  it("never uses the five for a revisit or a revision, which continue an existing Waypoint", () => {
    expect(waypointCapacityMessage(state(3, true, 20, false), "revisit")).toBeNull();
    expect(waypointCapacityMessage(state(20, true, 20, false), "revisit")).toBe(WAYPOINT_ACTIVE_LIMIT_REASON
      .replace("{activeCount}", "20").replace("{activeLimit}", "20"));
    expect(waypointCapacityMessage(state(20, true, 20, false), "revision")).toBeNull();
  });

  it("shows the card notice only for this conversation's five, after the history guard", () => {
    expect(waypointConversationLimitNotice(state(2, true, 20, false))).toBe(WAYPOINT_CONVERSATION_LIMIT_REASON);
    expect(waypointConversationLimitNotice(state(2))).toBeNull();
    expect(waypointConversationLimitNotice(state(20))).toBeNull();
    expect(waypointConversationLimitNotice(state(2, false, 20, false))).toBeNull();
  });
});
