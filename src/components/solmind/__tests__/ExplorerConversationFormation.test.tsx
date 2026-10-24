import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ExplorerConversationFormation } from "../ExplorerConversationFormation";
import { EXPLORER_CONVERSATION_VERSION, type ExplorerConversationState } from "../../../lib/solmind/explorerConversationContract";

function state(overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  return { version: EXPLORER_CONVERSATION_VERSION, conversationId: null, revision: 0,
    providerState: "unavailable", pendingTurn: false, messages: [], compassItems: [], priorityId: null,
    attentionId: null, waypoints: [], ...overrides };
}

describe("Formation presentation (static proof only)", () => {
  it("renders valid empty Discovery and no Waypoint without dispatching or inventing a choice", () => {
    const onCommand = vi.fn();
    const html = renderToStaticMarkup(createElement(ExplorerConversationFormation, { state: state(), busy: false, onCommand }));
    expect(html).toContain("No Priority confirmed");
    expect(html).toContain("No attention point chosen");
    expect(html).toContain("No Waypoint chosen");
    expect(html).toContain("A saved conversation message is needed");
    expect(html).toContain('<fieldset disabled=""');
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps saved Priority, attention and Waypoint lifecycle distinct and escapes source text", () => {
    const source = { id: "message-a", role: "explorer" as const, body: "<script>not markup</script>", createdAt: "2026-10-24T05:00:00Z" };
    const current = state({ conversationId: "conversation-a", messages: [source], compassItems: [
      { id: "point-a", sourceMessageId: source.id, label: "Priority choice" },
      { id: "point-b", sourceMessageId: source.id, label: "Attention choice" },
    ], priorityId: "point-a", attentionId: "point-b", waypoints: [{
      id: "waypoint-a", sourceMessageId: source.id, destination: "A meaningful destination",
      meaning: "Why it matters", arrivalSignal: "An observable signal", status: "chosen",
    }] });
    const html = renderToStaticMarkup(createElement(ExplorerConversationFormation, { state: current, busy: false, onCommand: vi.fn() }));
    expect(html).toContain("Priority choice");
    expect(html).toContain("Current attention: Attention choice");
    expect(html).toContain("In progress — chosen by you");
    expect(html).toContain("Review Reached: A meaningful destination");
    expect(html).toContain("&lt;script&gt;not markup&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("Reached — confirmed by you");
  });

  it("offers no second Reached operation for an already reached saved Waypoint", () => {
    const current = state({ conversationId: "conversation-a", waypoints: [{
      id: "waypoint-a", sourceMessageId: "message-a", destination: "A meaningful destination",
      meaning: "Why it matters", arrivalSignal: "An observable signal", status: "reached",
    }] });
    const html = renderToStaticMarkup(createElement(ExplorerConversationFormation, { state: current, busy: true, onCommand: vi.fn() }));
    expect(html).toContain("Reached — confirmed by you");
    expect(html).not.toContain("Review Reached:");
    expect(html).toContain("Meaningful progress does not mean your journey is over.");
  });
});
