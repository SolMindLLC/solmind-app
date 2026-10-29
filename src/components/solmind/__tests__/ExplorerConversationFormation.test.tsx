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


  it("renders fixed saved positions and keeps a ninth point reviewable in Other paths", () => {
    const anchors = ["apex", "upper_left", "upper_right", "side_left", "side_right", "lower_left", "lower_center", "lower_right"] as const;
    const source = { id: "message-a", role: "explorer" as const, body: "An exact saved source.", createdAt: "2026-10-29T07:00:00Z" };
    const points = anchors.map((anchor, index) => ({ id: `point-${index}`, sourceMessageId: source.id,
      label: `Saved anchored choice ${index}`, anchor, emphasis: (index % 3 + 1) as 1 | 2 | 3 }));
    const overflow = { id: "point-other", sourceMessageId: source.id, label: "A ninth preserved path", anchor: null, emphasis: 2 as const };
    const onCommand = vi.fn();
    const html = renderToStaticMarkup(createElement(ExplorerConversationFormation, { state: state({
      conversationId: "conversation-a", messages: [source], compassItems: [overflow, ...points.toReversed()],
      priorityId: "point-0", attentionId: "point-3",
    }), busy: false, onCommand }));
    const saved = html.slice(html.indexOf('aria-label="Saved Compass arrangement"'), html.indexOf("Other paths ("));
    const other = html.slice(html.indexOf("Other paths ("));
    expect(saved).toContain("Top position");
    expect(saved).toContain("Detour — left");
    expect(saved).toContain("Excursion — lower center");
    for (let index = 0; index < points.length - 1; index += 1) {
      expect(saved.indexOf(points[index].label)).toBeLessThan(saved.indexOf(points[index + 1].label));
    }
    expect(saved).not.toContain(overflow.label);
    expect(other).toContain("Other paths (1)");
    expect(other).toContain(overflow.label);
    expect(other).toContain(source.body);
    expect(other).toContain("Arrange this point visibly before moving attention here.");
    expect(other).toMatch(/<button[^>]*disabled=""[^>]*>Attend to: A ninth preserved path<\/button>/);
    expect(html).toContain("Relative emphasis: Light.");
    expect(html).toContain("Relative emphasis: Regular.");
    expect(html).toContain("Relative emphasis: Strong.");
    expect(html).toContain("Current attention: Saved anchored choice 3");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("leaves legacy and new unarranged points unplaced instead of deriving a layout from array order", () => {
    const current = state({ conversationId: "conversation-a", compassItems: [
      { id: "point-a", sourceMessageId: "message-a", label: "Legacy point" },
      { id: "point-b", sourceMessageId: "message-a", label: "New unarranged point", anchor: null, emphasis: null },
    ], priorityId: "point-a", attentionId: "point-b" });
    const onCommand = vi.fn();
    const html = renderToStaticMarkup(createElement(ExplorerConversationFormation, { state: current, busy: false, onCommand }));
    const saved = html.slice(html.indexOf('aria-label="Saved Compass arrangement"'), html.indexOf("Other paths ("));
    expect(saved).not.toContain("Legacy point");
    expect(saved).not.toContain("New unarranged point");
    expect(saved.match(/No point placed here/g)).toHaveLength(8);
    expect(html).toContain("Other paths (2)");
    expect(html.match(/Placement and relative emphasis have not been recorded./g)).toHaveLength(2);
    expect(html).toContain("Current attention: New unarranged point");
    expect(html).toContain("New points stay in Other paths with no recorded placement or emphasis");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("allows saved apex placement in Discovery without inventing a confirmed Priority", () => {
    const onCommand = vi.fn();
    const html = renderToStaticMarkup(createElement(ExplorerConversationFormation, { state: state({
      conversationId: "conversation-a", compassItems: [
        { id: "point-a", sourceMessageId: "message-a", label: "An Explorer-placed top point", anchor: "apex", emphasis: 3 },
      ],
    }), busy: false, onCommand }));
    expect(html).toContain("An Explorer-placed top point");
    expect(html).toContain("No Priority confirmed — placement alone does not confirm it.");
    expect(html).not.toContain("Confirmed Priority. ");
    expect(html).toContain("No attention point chosen");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("renders arrangement Route facts from captured labels and preserves the existing event order", () => {
    const onCommand = vi.fn();
    const current = state({ conversationId: "conversation-a", revision: 8, compassItems: [
      { id: "point-a", sourceMessageId: "message-a", label: "Today's first label", anchor: "side_left", emphasis: 1 },
      { id: "point-b", sourceMessageId: "message-a", label: "Today's second label", anchor: "apex", emphasis: 3 },
    ], priorityId: "point-b", attentionId: "point-a", route: [
      { operationId: "route-original", revision: 2, kind: "priority_confirmed", compassItemId: "point-a", label: "The first captured Priority", recordedAt: "2026-10-29T07:01:00Z" },
      { operationId: "route-arranged", revision: 4, kind: "arrangement_confirmed", previousPriorityId: "point-a", priorityId: "point-b", items: [
        { compassItemId: "point-a", label: "Captured first <choice>", anchor: "side_left", emphasis: 1 },
        { compassItemId: "point-b", label: "Captured second choice", anchor: "apex", emphasis: 3 },
      ], recordedAt: "2026-10-29T07:02:00.123456+00:00" },
      { operationId: "route-attention", revision: 7, kind: "attention_changed", compassItemId: "point-a", label: "Captured attention afterward", recordedAt: "2026-10-29T07:03:00Z" },
    ] });
    const html = renderToStaticMarkup(createElement(ExplorerConversationFormation, { state: current, busy: false, onCommand }));
    const route = html.slice(html.indexOf("Compass arrangement confirmed"), html.indexOf("Add a point you choose"));
    expect(html.indexOf("The first captured Priority")).toBeLessThan(html.indexOf("Compass arrangement confirmed"));
    expect(html.indexOf("Compass arrangement confirmed")).toBeLessThan(html.indexOf("Captured attention afterward"));
    expect(route).toContain("Priority changed from “Captured first &lt;choice&gt;” to “Captured second choice”.");
    expect(route).toContain("Captured first &lt;choice&gt; — Detour — left; Light.");
    expect(route).toContain("Captured second choice — Top position; Strong.");
    expect(route).toContain("2026-10-29T07:02:00.123456+00:00");
    expect(route).not.toContain("Today&#x27;s");
    expect(route).not.toContain("<choice>");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("discloses the private-demo storage bound while retaining every saved overflow point", () => {
    const onCommand = vi.fn();
    const points = Array.from({ length: 24 }, (_, index) => ({ id: `point-${index}`, sourceMessageId: "message-a",
      label: `Retained path ${index}`, anchor: null, emphasis: null }));
    const html = renderToStaticMarkup(createElement(ExplorerConversationFormation, { state: state({
      conversationId: "conversation-a", compassItems: points,
      messages: [{ id: "message-a", role: "explorer", body: "A saved source for these retained points.", createdAt: "2026-10-29T07:00:00Z" }],
    }), busy: false, onCommand }));
    expect(html).toContain("Other paths (24)");
    expect(html).toContain("This private demo stores at most 24 points.");
    expect(html).toContain("All saved points remain available; another cannot be added here.");
    for (const point of points) expect(html).toContain(`>${point.label}</h4>`);
    expect(html).toContain('<fieldset disabled=""');
    expect(onCommand).not.toHaveBeenCalled();
  });
});
