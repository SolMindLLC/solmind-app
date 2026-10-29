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
    expect(html).toContain("No recorded direction changes are available yet.");
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
    expect(html).toContain("Saved supporting evidence and confirmation time are unavailable for this earlier Waypoint.");
    expect(html).not.toContain("Review saved Reached confirmation");
  });

  it("renders recorded Route order and captured labels separately from current point labels", () => {
    const current = state({ conversationId: "conversation-a", revision: 8, compassItems: [
      { id: "point-a", sourceMessageId: "message-a", label: "Current point label" },
      { id: "point-b", sourceMessageId: "message-a", label: "Current second label" },
    ], priorityId: "point-b", attentionId: "point-a", route: [
      { operationId: "route-operation-first", revision: 2, kind: "priority_confirmed", compassItemId: "point-a", label: "Captured first Priority", recordedAt: "2026-10-29T07:01:00.123456+00:00" },
      { operationId: "route-operation-second", revision: 4, kind: "priority_reoriented", compassItemId: "point-b", label: "Captured reorientation", recordedAt: "2026-10-29T07:02:00Z" },
      { operationId: "route-operation-third", revision: 7, kind: "attention_changed", compassItemId: "point-a", label: "Captured attention", recordedAt: "2026-10-29T07:03:00Z" },
    ] });
    const onCommand = vi.fn();
    const html = renderToStaticMarkup(createElement(ExplorerConversationFormation, { state: current, busy: false, onCommand }));
    expect(html).toContain("Captured first Priority");
    expect(html).toContain("Captured reorientation");
    expect(html).toContain("Captured attention");
    expect(html.indexOf("Captured first Priority")).toBeLessThan(html.indexOf("Captured reorientation"));
    expect(html.indexOf("Captured reorientation")).toBeLessThan(html.indexOf("Captured attention"));
    expect(html).toContain("Priority confirmed:");
    expect(html).toContain("Priority reoriented:");
    expect(html).toContain("Attention moved:");
    expect(html).toContain("2026-10-29T07:01:00.123456+00:00");
    expect(html).not.toContain("No recorded direction changes are available yet.");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("does not infer a Route from legacy current Priority, attention or point order", () => {
    for (const route of [undefined, []]) {
      const current = state({ conversationId: "conversation-a", compassItems: [
        { id: "point-b", sourceMessageId: "message-a", label: "Current second label" },
        { id: "point-a", sourceMessageId: "message-a", label: "Current first label" },
      ], priorityId: "point-a", attentionId: "point-b", route });
      const html = renderToStaticMarkup(createElement(ExplorerConversationFormation, { state: current, busy: false, onCommand: vi.fn() }));
      expect(html).toContain("No recorded direction changes are available yet.");
      expect(html).not.toContain("Priority confirmed:");
      expect(html).not.toContain("Priority reoriented:");
      expect(html).not.toContain("Attention moved:");
    }
  });

  it("shows only saved Reached evidence and confirmation time without offering another Reached action", () => {
    const reachedAt = "2026-10-29T07:04:00.123456+00:00";
    const current = state({ conversationId: "conversation-a", waypoints: [{
      id: "waypoint-a", sourceMessageId: "message-a", destination: "A meaningful destination",
      meaning: "Why it matters", arrivalSignal: "An observable signal", status: "reached",
      reachedEvidence: "I observed the saved arrival signal.\n<script>plain text only</script>", reachedAt,
    }] });
    const onCommand = vi.fn();
    const html = renderToStaticMarkup(createElement(ExplorerConversationFormation, { state: current, busy: false, onCommand }));
    expect(html).toContain("Review saved Reached confirmation");
    expect(html).toContain("I observed the saved arrival signal.");
    expect(html).toContain("&lt;script&gt;plain text only&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain(reachedAt);
    expect(html).toContain(new Date(reachedAt).toLocaleString("en-US"));
    expect(html).not.toContain("Review Reached:");
    expect(html).not.toContain("Saved supporting evidence and confirmation time are unavailable");
    expect(onCommand).not.toHaveBeenCalled();
  });
});
