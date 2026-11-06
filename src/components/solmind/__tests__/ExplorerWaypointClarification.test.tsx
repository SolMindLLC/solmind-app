import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ExplorerWaypointClarification } from "../ExplorerWaypointClarification";
import { type ExplorerConversationState } from "../../../lib/solmind/explorerConversationContract";

const current = (): ExplorerConversationState => ({ version: "explorer-conversation.v1", conversationId: "conversation-a", revision: 3, sessionStatus: "active", pendingTurn: false, turnedDownLimitReached: false, waypointDraft: null, providerState: "unavailable", messages: [], compassItems: [], priorityId: null, attentionId: null,
  waypointCapacity: { activeCount: 1, activeLimit: 20, historyRoom: true },
  waypointProjection: { kind: "current_heads", limit: 20, hasMore: false, totalHeads: 1 },
  waypoints: [{ id: "waypoint-a", isCurrent: true, createdAt: "2026-10-29T10:00:00Z", sourceMessageId: "message-a", title: "Earlier destination <script>", destination: "Earlier destination <script>", meaning: "Earlier meaning", arrivalSignal: "Earlier signal", status: "chosen" }] });
const review = { conversationId: "conversation-a", revision: 3, waypointId: "waypoint-a", kind: "revise_waypoint" as const };

describe("Application-authored Waypoint conversation (static proof only)", () => {
  it("permits net-zero revision above the active allowance and explains exhausted history first", () => {
    const state = { ...current(), waypointCapacity: { activeCount: 25, activeLimit: 20, historyRoom: true } };
    const render = (saved: ExplorerConversationState) => renderToStaticMarkup(createElement(ExplorerWaypointClarification,
      { state: saved, review, busy: false, onCommand: vi.fn(), onClose: vi.fn() }));
    expect(render(state)).not.toContain('<fieldset disabled=""');
    const full = render({ ...state, waypointCapacity: { ...state.waypointCapacity, historyRoom: false } });
    expect(full).toContain('<fieldset disabled=""');
    expect(full).toContain("This conversation has reached its limit of 200 saved Waypoint versions, to keep its saved history manageable. No new Waypoint or version can be saved here. Marking one Reached or Released does not make room for another version. You can still read the Waypoints shown here, use Reached or Release where available, or end an active conversation.");
    expect(full).not.toContain("You have 25 active Waypoints");
    const reasonId = /<p id="([^"]+)" role="alert" tabindex="0"/.exec(full)?.[1];
    expect(reasonId).toBeDefined();
    expect(full).toContain(`<fieldset disabled="" aria-describedby="${reasonId}"`);
  });

  it("shows the server's active count for revisits and calm unavailable wording for null capacity", () => {
    const state = current();
    const closed = { ...state, waypoints: state.waypoints.map(item => ({ ...item, status: "reached" as const })),
      waypointCapacity: { activeCount: 21, activeLimit: 20, historyRoom: true } };
    const render = (saved: ExplorerConversationState, kind: "revise_waypoint" | "revisit_waypoint") => renderToStaticMarkup(createElement(ExplorerWaypointClarification,
      { state: saved, review: { ...review, kind }, busy: false, onCommand: vi.fn(), onClose: vi.fn() }));
    const html = render(closed, "revisit_waypoint");
    expect(html).toContain("You have 21 active Waypoints across your conversations. To help keep your focus manageable, your total must be below 20 before adding or bringing back another. Reached and Released Waypoints do not count. Review and confirm Reached for Waypoints you have reached, or release those you no longer want to pursue.");
    expect(html).toContain('<fieldset disabled=""');
    for (const kind of ["revise_waypoint", "revisit_waypoint"] as const) {
      const unavailable = render({ ...(kind === "revisit_waypoint" ? closed : state), waypointCapacity: null as unknown as ExplorerConversationState["waypointCapacity"] }, kind);
      expect(unavailable).toContain("The conversation could not be loaded. Please try again.");
      expect(unavailable).not.toContain("active Waypoints across your conversations");
      expect(unavailable).not.toContain("limit of 200");
      expect(unavailable).toContain('<fieldset disabled=""');
    }
  });
  it("starts with one question, an empty Explorer answer and honest local-draft/model attribution", () => {
    const onCommand = vi.fn();
    const html = renderToStaticMarkup(createElement(ExplorerWaypointClarification, { state: current(), review, busy: false, onCommand, onClose: vi.fn() }));
    expect(html).toContain("Waypoint clarification — application prompt");
    expect(html).toContain("These are fixed application questions, not a SolMind Virtual Guide reply.");
    expect(html).toContain("No AI request is made.");
    expect(html).toContain("Closing it, navigating away or reloading discards it");
    expect(html).toContain("Where do you want to arrive now?");
    expect(html).not.toContain("Why does reaching that place matter to you now?");
    expect(html).not.toContain("What observable signal would help you recognize arrival now?");
    expect(html).toContain("Earlier destination &lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("Keep this understanding");
    expect(html).not.toContain("Confirm revised Waypoint");
    expect(html).not.toContain("Review the complete understanding");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("blocks stale or ended clarification while offering non-mutating close", () => {
    const onCommand = vi.fn();
    for (const state of [{ ...current(), revision: 4 }, { ...current(), sessionStatus: "ended" as const }]) {
      const html = renderToStaticMarkup(createElement(ExplorerWaypointClarification, { state, review, busy: false, onCommand, onClose: vi.fn() }));
      expect(html).toContain("Your saved conversation or Waypoint changed.");
      expect(html).toContain('<fieldset disabled=""');
      expect(html).toContain("Close clarification without saving");
    }
    expect(onCommand).not.toHaveBeenCalled();
  });
});
