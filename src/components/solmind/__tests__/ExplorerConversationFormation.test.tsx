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


it("read-only formation preserves saved Compass, Route, sources and Waypoint evidence while exposing no edit controls", () => {
  const current = state({ conversationId: "conversation-a", revision: 4, sessionStatus: "ended", ending: null,
    messages: [{ id: "message-a", role: "explorer", body: "A saved source <script>text only</script>", createdAt: "2026-10-29T07:00:00Z" }],
    compassItems: [{ id: "point-a", sourceMessageId: "message-a", label: "Saved Priority", anchor: "apex", emphasis: 3 },
      { id: "point-b", sourceMessageId: "message-a", label: "Saved Other path", anchor: null, emphasis: 1 }],
    priorityId: "point-a", attentionId: "point-a", route: [{ operationId: "operation-route", revision: 2,
      kind: "priority_confirmed", compassItemId: "point-a", label: "Captured direction", recordedAt: "2026-10-29T07:01:00Z" }],
    waypoints: [{ id: "waypoint-chosen", sourceMessageId: "message-a", destination: "Still in progress",
      meaning: "A saved meaning", arrivalSignal: "A saved signal", status: "chosen" },
    { id: "waypoint-reached", sourceMessageId: "message-a", destination: "Saved arrival",
      meaning: "A meaningful arrival", arrivalSignal: "I noticed it", status: "reached",
      reachedEvidence: "Actual saved evidence", reachedAt: "2026-10-29T07:02:00Z" }] });
  const onCommand = vi.fn();
  const html = renderToStaticMarkup(createElement(ExplorerConversationFormation, { state: current, busy: false, readOnly: true, onCommand }));
  for (const text of ["Saved Priority", "Saved Other path", "Captured direction", "Review saved source", "A saved source &lt;script&gt;text only&lt;/script&gt;",
    "Still in progress", "In progress — chosen by you", "Saved arrival", "Actual saved evidence", "Review saved Reached confirmation"]) expect(html).toContain(text);
  for (const tag of ["<form", "<button", "<input", "<select", "<textarea"]) expect(html).not.toContain(tag);
  expect(html).not.toContain("Review Reached:");
  expect(html).not.toContain("Add a point you choose");
  expect(onCommand).not.toHaveBeenCalled();
});

describe("Category presentation (static proof only)", () => {
  const messages = [
    { id: "message-a", role: "explorer" as const, body: "An exact first source <script>plain text</script>", createdAt: "2026-10-29T07:00:00Z" },
    { id: "message-b", role: "virtualGuide" as const, body: "An exact second saved source.", createdAt: "2026-10-29T07:00:01Z" },
    { id: "message-c", role: "explorer" as const, body: "An exact earlier contributing source.", createdAt: "2026-10-29T07:00:02Z" },
  ];
  const points = [
    { id: "point-a", sourceMessageId: "message-a", label: "Current combined category", anchor: "apex" as const, emphasis: 3 as const, mergedIntoItemId: null },
    { id: "point-b", sourceMessageId: "message-b", label: "Retained second point", anchor: "apex" as const, emphasis: 2 as const, mergedIntoItemId: "point-a" },
    { id: "point-c", sourceMessageId: "message-c", label: "Retained earlier point", anchor: null, emphasis: 1 as const, mergedIntoItemId: "point-b" },
    { id: "point-d", sourceMessageId: "message-a", label: "Separate current attention", anchor: "side_left" as const, emphasis: 1 as const, mergedIntoItemId: null },
  ];

  it("uses only current heads for placement and actions while exposing transitive retained source points", () => {
    const onCommand = vi.fn();
    const html = renderToStaticMarkup(createElement(ExplorerConversationFormation, { state: state({
      conversationId: "conversation-a", messages, compassItems: points, priorityId: "point-a", attentionId: "point-d",
    }), busy: false, onCommand }));
    expect(html).toContain("Current attention: Separate current attention");
    expect(html).toContain("Combined source points (3)");
    for (const source of ["Retained second point", "Retained earlier point", "An exact second saved source.", "An exact earlier contributing source."]) expect(html).toContain(source);
    expect(html).toContain("An exact first source &lt;script&gt;plain text&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("Other paths (0)");
    expect(html).toContain("Review wording or combine: Current combined category");
    for (const label of ["Retained second point", "Retained earlier point"]) {
      expect(html).not.toContain(`Review wording or combine: ${label}`);
      expect(html).not.toContain(`Attend to: ${label}`);
      expect(html).not.toContain(`>${label}</h4>`);
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("renders category Route wording, prior sources and layout from the saved capture", () => {
    const onCommand = vi.fn();
    const html = renderToStaticMarkup(createElement(ExplorerConversationFormation, { state: state({
      conversationId: "conversation-a", revision: 4, messages, compassItems: points,
      route: [{ operationId: "category-operation", revision: 3, kind: "category_confirmed", recordedAt: "2026-10-29T07:03:00Z", change: {
        targetItemId: "point-a", memberItemIds: ["point-a", "point-b"], label: "Earlier combined <wording>", beforeItems: [
          { compassItemId: "point-a", sourceMessageId: "message-a", label: "Original first wording", mergedIntoItemId: null, anchor: "apex", emphasis: 3 },
          { compassItemId: "point-b", sourceMessageId: "message-b", label: "Original second wording", mergedIntoItemId: null, anchor: "lower_right", emphasis: 2 },
          { compassItemId: "point-c", sourceMessageId: "message-c", label: "Earlier retained wording", mergedIntoItemId: "point-b", anchor: null, emphasis: null },
        ],
      } }],
    }), busy: false, onCommand }));
    const route = html.slice(html.indexOf("Categories combined"), html.indexOf("Add a point you choose"));
    expect(route).toContain("Confirmed wording: Earlier combined &lt;wording&gt;");
    expect(route).toContain("Original first wording — selected point before this change; Top position; Strong.");
    expect(route).toContain("Original second wording — selected point before this change; Excursion — lower right; Regular.");
    expect(route).toContain("Earlier retained wording — retained contributing point; Other paths; relative emphasis not recorded.");
    expect(route).toContain("An exact earlier contributing source.");
    expect(route).not.toContain("Current combined category");
    expect(route).not.toContain("Retained second point");
    expect(route).not.toContain("<wording>");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps saved combined provenance visible in an ended read-only review without edit controls", () => {
    const onCommand = vi.fn();
    const html = renderToStaticMarkup(createElement(ExplorerConversationFormation, { state: state({
      conversationId: "conversation-a", messages, compassItems: points, priorityId: "point-a",
      sessionStatus: "ended", ending: null,
    }), busy: false, readOnly: true, onCommand }));
    for (const text of ["Current combined category", "Combined source points (3)", "Retained earlier point", "An exact earlier contributing source."]) expect(html).toContain(text);
    for (const tag of ["<form", "<button", "<input", "<select", "<textarea"]) expect(html).not.toContain(tag);
    expect(html).not.toContain("Review category wording and sources");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("counts all retained originals toward the existing24-point storage bound", () => {
    const compassItems = Array.from({ length: 24 }, (_, index) => ({
      id: `retained-${index}`, sourceMessageId: "message-a", label: `Stored original ${index}`,
      anchor: null, emphasis: null, mergedIntoItemId: index === 0 ? null : "retained-0",
    }));
    const onCommand = vi.fn();
    const html = renderToStaticMarkup(createElement(ExplorerConversationFormation, { state: state({
      conversationId: "conversation-a", messages, compassItems,
    }), busy: false, onCommand }));
    expect(html).toContain("Other paths (1)");
    expect(html).toContain("Combined source points (24)");
    expect(html).toContain("This private demo stores at most 24 points.");
    expect(html).toContain("All saved points remain available; another cannot be added here.");
    expect(html).toContain('<fieldset disabled=""');
    expect(html).not.toContain("Review wording or combine: Stored original 1<");
    expect(onCommand).not.toHaveBeenCalled();
  });
  it("keeps a released chosen definition and exact source in history without offering Reached or release again", () => {
    const onCommand = vi.fn();
    const current = state({ conversationId: "conversation-a", messages: [{ id: "message-a", role: "explorer", body: "Exact private source <not markup>", createdAt: "2026-10-29T10:00:00Z" }], waypoints: [{
      id: "waypoint-a", sourceMessageId: "message-a", destination: "A retained destination", meaning: "A retained meaning", arrivalSignal: "A retained signal", status: "chosen",
      release: { operationId: "release-operation", releasedAt: "2026-10-29T15:00:00Z" },
    }] });
    for (const readOnly of [false, true]) {
      const html = renderToStaticMarkup(createElement(ExplorerConversationFormation, { state: current, busy: false, readOnly, onCommand }));
      expect(html).toContain("Released — kept in your private history");
      expect(html).toContain("A retained destination");
      expect(html).toContain("A retained meaning");
      expect(html).toContain("A retained signal");
      expect(html).toContain("Exact private source &lt;not markup&gt;");
      expect(html).toContain('dateTime="2026-10-29T15:00:00Z"');
      expect(html).not.toContain("In progress — chosen by you");
      expect(html).not.toContain("Review Reached:");
      expect(html).not.toContain("Review release:");
      expect(html).not.toContain("Reached — confirmed by you");
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("offers a deliberate release review only for a current chosen Waypoint in an active editable conversation", () => {
    const waypoint = { id: "waypoint-a", sourceMessageId: "message-a", destination: "A meaningful destination", meaning: "Why it matters", arrivalSignal: "An observable signal", status: "chosen" as const };
    const onCommand = vi.fn();
    const active = state({ conversationId: "conversation-a", sessionStatus: "active", waypoints: [waypoint] });
    const html = renderToStaticMarkup(createElement(ExplorerConversationFormation, { state: active, busy: false, onCommand }));
    expect(html).toContain("Review release: A meaningful destination");
    expect(html).not.toContain("Review before releasing this Waypoint");
    expect(html).not.toContain("Release this Waypoint</button>");
    for (const current of [state({ ...active, sessionStatus: "ended" }), state({ ...active, waypoints: [{ ...waypoint, status: "reached" }] })]) {
      expect(renderToStaticMarkup(createElement(ExplorerConversationFormation, { state: current, busy: false, onCommand }))).not.toContain("Review release:");
    }
    expect(renderToStaticMarkup(createElement(ExplorerConversationFormation, { state: active, busy: false, readOnly: true, onCommand }))).not.toContain("Review release:");
    expect(onCommand).not.toHaveBeenCalled();
  });

});
