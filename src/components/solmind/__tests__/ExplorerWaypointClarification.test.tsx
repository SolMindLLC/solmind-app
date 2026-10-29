import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ExplorerWaypointClarification } from "../ExplorerWaypointClarification";
import { type ExplorerConversationState } from "../../../lib/solmind/explorerConversationContract";

const current = (): ExplorerConversationState => ({ version: "explorer-conversation.v1", conversationId: "conversation-a", revision: 3, sessionStatus: "active", pendingTurn: false, providerState: "unavailable", messages: [], compassItems: [], priorityId: null, attentionId: null, waypoints: [{ id: "waypoint-a", sourceMessageId: "message-a", destination: "Earlier destination <script>", meaning: "Earlier meaning", arrivalSignal: "Earlier signal", status: "chosen" }] });
const review = { conversationId: "conversation-a", revision: 3, waypointId: "waypoint-a", kind: "revise_waypoint" as const };

describe("Application-authored Waypoint conversation (static proof only)", () => {
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
