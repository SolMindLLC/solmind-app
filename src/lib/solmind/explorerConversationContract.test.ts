import { describe, expect, it } from "vitest";
import {
  EXPLORER_CONVERSATION_LIMITS,
  EXPLORER_COMPASS_ANCHORS,
  EXPLORER_CONVERSATION_VERSION,
  parseExplorerConversationCommand,
  parseExplorerConversationResult,
} from "./explorerConversationContract";

const uuid = (number: number) => `00000000-0000-4000-8000-${number.toString(16).padStart(12, "0")}`;
const operationId = "abcdef12-3456-4789-8abc-def012345678";
const base = { operationId, expectedRevision: 4 };
const sourceId = uuid(2);
const pointId = uuid(4);
const waypointId = uuid(6);
const validCommands = [
  { ...base, kind: "send", body: "My own message\nA second paragraph 🧭" },
  { ...base, kind: "add_compass", sourceMessageId: sourceId, label: "Calmer mornings" },
  { ...base, kind: "confirm_priority", itemId: pointId },
  { ...base, kind: "set_attention", itemId: pointId },
  { ...base, kind: "confirm_waypoint", sourceMessageId: sourceId,
    destination: "An unhurried morning", meaning: "Connecting with my family", arrivalSignal: "A calm breakfast together" },
  { ...base, kind: "confirm_reached", waypointId, evidence: "We had an unhurried breakfast together." },
  { ...base, kind: "confirm_compass_arrangement", priorityId: pointId,
    items: [{ compassItemId: pointId, anchor: "apex", emphasis: 2 }] },
];
function without(value: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));
}
function emptyState() {
  return { version: EXPLORER_CONVERSATION_VERSION, conversationId: null, revision: 0,
    providerState: "unavailable", pendingTurn: false, messages: [], compassItems: [], priorityId: null,
    attentionId: null, waypoints: [] };
}
function populatedState() {
  return { version: EXPLORER_CONVERSATION_VERSION, conversationId: uuid(1), revision: 3,
    providerState: "unavailable", pendingTurn: false, messages: [
      { id: sourceId, role: "explorer", body: "I want an unhurried morning.\nWhat could that look like?", createdAt: "2026-10-24T05:05:00.000Z" },
      { id: uuid(3), role: "virtualGuide", body: "What would tell you that you arrived?", createdAt: "2026-10-24T05:05:01.123456+00:00" },
    ], compassItems: [{ id: pointId, sourceMessageId: sourceId, label: "Calmer mornings" }],
    priorityId: pointId, attentionId: pointId, waypoints: [{
      id: waypointId, sourceMessageId: uuid(3), destination: "An unhurried morning",
      meaning: "Connecting with my family", arrivalSignal: "A calm breakfast together", status: "chosen",
    }] };
}
const success = (state: unknown) => ({ ok: true, state, error: null });

describe("Explorer conversation command parser", () => {
  it.each(validCommands)("accepts only the exact disclosed %s command and snapshots its bytes", value => {
    const original = { ...value };
    const parsed = parseExplorerConversationCommand(original);
    expect(parsed).toEqual(original);
    expect(parsed).not.toBe(original);
    expect(Object.isFrozen(parsed)).toBe(true);
    original.expectedRevision = 5;
    expect(parsed?.expectedRevision).toBe(4);
  });

  it("rejects missing fields for every command, including operation identity and revision", () => {
    for (const command of validCommands) {
      for (const field of Object.keys(command)) {
        expect(parseExplorerConversationCommand(without(command, field)), `${command.kind} missing ${field}`).toBeNull();
      }
    }
  });

  it("rejects browser-supplied identity, authority, source-body and provider fields", () => {
    for (const command of validCommands) {
      for (const field of ["accountId", "actorId", "explorerId", "sessionId", "relationshipId", "practiceId",
        "providerId", "providerState", "bindingId", "sourceBody", "role", "consentIds", "shared", "status"]) {
        expect(parseExplorerConversationCommand({ ...command, [field]: uuid(99) }), `${command.kind} extra ${field}`).toBeNull();
      }
    }
  });

  it.each([null, undefined, [], new Date(), "send", 3, true])("rejects non-record input (%j)", value => {
    expect(parseExplorerConversationCommand(value)).toBeNull();
  });

  it("rejects inherited command records and unknown command kinds", () => {
    expect(parseExplorerConversationCommand(Object.assign(Object.create({ actorId: uuid(99) }), validCommands[0]))).toBeNull();
    expect(parseExplorerConversationCommand({ ...base, kind: "share", body: "private" })).toBeNull();
    expect(parseExplorerConversationCommand({ ...base, kind: "confirm_waypoint", waypoint: {} })).toBeNull();
  });

  it.each([-1, 0.5, NaN, Infinity, 2_147_483_648, "4", null])("rejects invalid expected revision (%j)", expectedRevision => {
    expect(parseExplorerConversationCommand({ ...validCommands[0], expectedRevision })).toBeNull();
  });

  it("accepts the bounded revision endpoints without rounding", () => {
    for (const expectedRevision of [0, 2_147_483_647]) {
      expect(parseExplorerConversationCommand({ ...validCommands[0], expectedRevision })?.expectedRevision).toBe(expectedRevision);
    }
  });

  it("requires canonical opaque UUID selections and never trims or repairs them", () => {
    for (const value of ["", "account-a", ` ${operationId}`, operationId.toUpperCase(), "00000000-0000-4000-8000-00000000000g"]) {
      expect(parseExplorerConversationCommand({ ...validCommands[0], operationId: value })).toBeNull();
      expect(parseExplorerConversationCommand({ ...validCommands[1], sourceMessageId: value })).toBeNull();
      expect(parseExplorerConversationCommand({ ...validCommands[2], itemId: value })).toBeNull();
      expect(parseExplorerConversationCommand({ ...validCommands[5], waypointId: value })).toBeNull();
    }
  });

  it("bounds message length while preserving exact text", () => {
    const body = " 🧭 My own words\n\tA second line. ";
    expect(parseExplorerConversationCommand({ ...base, kind: "send", body })).toHaveProperty("body", body);
    expect(parseExplorerConversationCommand({ ...base, kind: "send", body: "x".repeat(8_192) })).not.toBeNull();
    expect(parseExplorerConversationCommand({ ...base, kind: "send", body: "🧭".repeat(4_096) })).not.toBeNull();
    expect(parseExplorerConversationCommand({ ...base, kind: "send", body: "x".repeat(8_193) })).toBeNull();
  });

  it.each(["", " \t\n ", "bad\u0000message", "bad\u0085message", "bad\ud800message", "bad\udfffmessage"])("rejects empty or malformed message text (%j)", body => {
    expect(parseExplorerConversationCommand({ ...base, kind: "send", body })).toBeNull();
  });

  it("bounds labels and keeps them single-line with valid Unicode", () => {
    expect(parseExplorerConversationCommand({ ...validCommands[1], label: "x".repeat(160) })).not.toBeNull();
    for (const label of ["x".repeat(161), "two\nlines", "two\u2028lines", "bad\u009ftext", "bad\ud800text", " "]) {
      expect(parseExplorerConversationCommand({ ...validCommands[1], label })).toBeNull();
    }
  });

  it("requires destination, meaning and arrival without accepting an automatic reached shortcut", () => {
    const command = validCommands[4];
    for (const field of ["destination", "meaning", "arrivalSignal"]) {
      expect(parseExplorerConversationCommand({ ...command, [field]: "x".repeat(1_000) })).not.toBeNull();
      for (const value of [" ", "x".repeat(1_001), "bad\ud800text", "bad\u0000text"]) {
        expect(parseExplorerConversationCommand({ ...command, [field]: value })).toBeNull();
      }
    }
    expect(parseExplorerConversationCommand({ ...command, status: "reached" })).toBeNull();
  });

  it("preserves Explorer-entered Waypoint paragraphs and reached evidence from the formation textareas", () => {
    const paragraph = "My own words\nA second paragraph 🧭";
    for (const field of ["destination", "meaning", "arrivalSignal"]) {
      expect(parseExplorerConversationCommand({ ...validCommands[4], [field]: paragraph })).toHaveProperty(field, paragraph);
    }
    expect(parseExplorerConversationCommand({ ...validCommands[5], evidence: paragraph })).toHaveProperty("evidence", paragraph);
  });

  it("cannot confirm Reached without bounded explicit supporting evidence", () => {
    expect(parseExplorerConversationCommand(without(validCommands[5], "evidence"))).toBeNull();
    for (const evidence of [" ", "x".repeat(1_001), "bad\u0000text", "bad\udffftext"]) {
      expect(parseExplorerConversationCommand({ ...validCommands[5], evidence })).toBeNull();
    }
    expect(parseExplorerConversationCommand({ ...validCommands[5], evidence: "x".repeat(1_000) })).not.toBeNull();
  });
});

describe("Explorer conversation closed result parser", () => {
  const routeEvent = (revision: number) => ({ operationId: uuid(800 + revision), revision,
    kind: "priority_confirmed", compassItemId: pointId, label: "The label saved at that time",
    recordedAt: "2026-10-29T07:00:00.123456+00:00" });

  it("preserves ordered captured Route facts without rewriting them from today's point label", () => {
    const original = { ...populatedState(), route: [routeEvent(1), { ...routeEvent(3), kind: "attention_changed" }] };
    const parsed = parseExplorerConversationResult(success(original));
    expect(parsed).toEqual(success(original));
    if (!parsed?.ok) throw new Error("expected_route");
    expect(Object.isFrozen(parsed.state.route)).toBe(true);
    expect(Object.isFrozen(parsed.state.route?.[0])).toBe(true);
    original.route[0].label = "Changed after parsing";
    const first = parsed.state.route?.[0];
    if (first?.kind === "arrangement_confirmed") throw new Error("expected_original_route_event");
    expect(first?.label).toBe("The label saved at that time");
    expect(parseExplorerConversationResult(success({ ...emptyState(), route: [] }))).not.toBeNull();
  });

  it("refuses malformed, unordered, duplicate or foreign Route facts", () => {
    for (const route of [null, {}, [routeEvent(0)], [routeEvent(4)], [routeEvent(2), routeEvent(1)],
      [routeEvent(1), { ...routeEvent(2), operationId: routeEvent(1).operationId }],
      [{ ...routeEvent(1), compassItemId: uuid(99) }], [{ ...routeEvent(1), kind: "automatic_priority" }],
      [{ ...routeEvent(1), recordedAt: "not a date" }], [{ ...routeEvent(1), label: " " }],
      [{ ...routeEvent(1), privateDraft: "must not escape" }]]) {
      expect(parseExplorerConversationResult(success({ ...populatedState(), route }))).toBeNull();
    }
  });

  it("reads actual Reached evidence and time together while accepting unchanged legacy projections", () => {
    const original = populatedState();
    expect(parseExplorerConversationResult(success(original))).toEqual(success(original));
    const reached = { ...original.waypoints[0], status: "reached", reachedEvidence: "We ate together.\nIt felt unhurried.",
      reachedAt: "2026-10-29T07:00:00.123456+00:00" };
    expect(parseExplorerConversationResult(success({ ...original, waypoints: [reached] })))
      .toEqual(success({ ...original, waypoints: [reached] }));
    expect(parseExplorerConversationResult(success({ ...original, waypoints: [{ ...original.waypoints[0],
      reachedEvidence: null, reachedAt: null }] }))).not.toBeNull();
    for (const waypoint of [without(reached, "reachedAt"), without(reached, "reachedEvidence"),
      { ...reached, reachedEvidence: null }, { ...reached, reachedAt: null },
      { ...reached, status: "chosen" }, { ...reached, reachedAt: "not a date" },
      { ...reached, reachedEvidence: "x".repeat(1_001) }]) {
      expect(parseExplorerConversationResult(success({ ...original, waypoints: [waypoint] }))).toBeNull();
    }
  });

  it("never accepts saved Route or Reached projection fields as browser commands", () => {
    for (const command of validCommands) {
      for (const extra of [{ route: [routeEvent(1)] }, { reachedAt: "2026-10-29T07:00:00Z" },
        { reachedEvidence: "A claimed result" }]) {
        expect(parseExplorerConversationCommand({ ...command, ...extra })).toBeNull();
      }
    }
  });

  it("accepts valid empty Discovery without inventing a saved conversation or an available provider", () => {
    const parsed = parseExplorerConversationResult(success(emptyState()));
    expect(parsed).toEqual(success(emptyState()));
    expect(parsed?.ok && parsed.state.conversationId).toBeNull();
    expect(parsed?.ok && parsed.state.providerState).toBe("unavailable");
  });

  it("preserves historical guide replies while reporting the provider as unavailable now", () => {
    const original = populatedState();
    const parsed = parseExplorerConversationResult(success(original));
    expect(parsed).toEqual(success(original));
    expect(parsed?.ok && parsed.state.providerState).toBe("unavailable");
    expect(parsed?.ok && parsed.state.messages[1].role).toBe("virtualGuide");
    const available = parseExplorerConversationResult(success({ ...emptyState(), providerState: "available" }));
    expect(available?.ok && available.state.providerState).toBe("available");
  });

  it.each(["unavailable", "denied", "refresh_required", "provider_unavailable"])("accepts only value-free %s failures", error => {
    expect(parseExplorerConversationResult({ ok: false, state: null, error })).toEqual({ ok: false, state: null, error });
    expect(parseExplorerConversationResult({ ok: false, state: populatedState(), error })).toBeNull();
    expect(parseExplorerConversationResult({ ok: false, state: null, error, details: "private provider error" })).toBeNull();
  });

  it("rejects contradictory success/error forms and unknown provider states", () => {
    for (const value of [
      { ok: true, state: emptyState(), error: "unavailable" },
      { ok: false, state: null, error: "provider said private text" },
      { ok: true, state: null, error: null },
      { ok: "true", state: emptyState(), error: null },
      { ok: false, state: null, error: null },
      { ok: true, state: emptyState(), error: null, actorId: uuid(99) },
      success({ ...emptyState(), providerState: "simulated" }),
      success({ ...emptyState(), providerState: true }),
    ]) expect(parseExplorerConversationResult(value)).toBeNull();
  });

  it("rejects non-record and inherited result containers", () => {
    for (const value of [null, undefined, [], new Date(), "saved", 1, true,
      Object.assign(Object.create({ actorId: uuid(99) }), success(emptyState()))]) {
      expect(parseExplorerConversationResult(value)).toBeNull();
    }
  });

  it("rejects malformed state revisions, selectors and collection types", () => {
    const original = populatedState();
    for (const revision of [-1, 0.5, NaN, Infinity, 2_147_483_648, "3", null]) {
      expect(parseExplorerConversationResult(success({ ...original, revision }))).toBeNull();
    }
    for (const conversationId of ["", "conversation-a", 1, ` ${uuid(1)}`]) {
      expect(parseExplorerConversationResult(success({ ...original, conversationId }))).toBeNull();
    }
    for (const field of ["messages", "compassItems", "waypoints"]) {
      for (const bad of [null, {}, "[]", new Set()]) {
        expect(parseExplorerConversationResult(success({ ...original, [field]: bad }))).toBeNull();
      }
    }
    expect(parseExplorerConversationResult(success({ ...original,
      messages: [{ ...original.messages[0], id: "not-an-id" }, original.messages[1]],
    }))).toBeNull();
  });

  it("rejects extra private authority fields at every projected record boundary", () => {
    const original = populatedState();
    for (const field of ["actorId", "accountId", "relationshipId", "privateGuideDraft", "providerId", "bindingId"]) {
      expect(parseExplorerConversationResult(success({ ...original, [field]: uuid(99) }))).toBeNull();
      expect(parseExplorerConversationResult(success({ ...original, messages: [{ ...original.messages[0], [field]: uuid(99) }, original.messages[1]] }))).toBeNull();
      expect(parseExplorerConversationResult(success({ ...original, compassItems: [{ ...original.compassItems[0], [field]: uuid(99) }] }))).toBeNull();
      expect(parseExplorerConversationResult(success({ ...original, waypoints: [{ ...original.waypoints[0], [field]: uuid(99) }] }))).toBeNull();
    }
  });

  it("rejects incomplete state and record shapes rather than filling defaults", () => {
    const original = populatedState();
    for (const field of Object.keys(original)) expect(parseExplorerConversationResult(success(without(original, field)))).toBeNull();
    for (const field of Object.keys(original.messages[0])) {
      expect(parseExplorerConversationResult(success({ ...original, messages: [without(original.messages[0], field), original.messages[1]] }))).toBeNull();
    }
    for (const field of Object.keys(original.compassItems[0])) {
      expect(parseExplorerConversationResult(success({ ...original, compassItems: [without(original.compassItems[0], field)] }))).toBeNull();
    }
    for (const field of Object.keys(original.waypoints[0])) {
      expect(parseExplorerConversationResult(success({ ...original, waypoints: [without(original.waypoints[0], field)] }))).toBeNull();
    }
  });

  it("rejects duplicate record IDs and dangling source, Priority or attention selections", () => {
    const original = populatedState();
    const wrongId = uuid(99);
    for (const state of [
      { ...original, messages: [original.messages[0], { ...original.messages[1], id: original.messages[0].id }] },
      { ...original, compassItems: [original.compassItems[0], { ...original.compassItems[0] }] },
      { ...original, waypoints: [original.waypoints[0], { ...original.waypoints[0] }] },
      { ...original, compassItems: [{ ...original.compassItems[0], sourceMessageId: wrongId }] },
      { ...original, waypoints: [{ ...original.waypoints[0], sourceMessageId: wrongId }] },
      { ...original, priorityId: wrongId },
      { ...original, attentionId: wrongId },
      { ...original, priorityId: sourceId },
    ]) expect(parseExplorerConversationResult(success(state))).toBeNull();
  });

  it("allows attention distinct from Priority without inventing a Priority", () => {
    const original = populatedState();
    expect(parseExplorerConversationResult(success({ ...original, priorityId: null, attentionId: pointId }))).not.toBeNull();
    const otherPoint = { id: uuid(5), sourceMessageId: sourceId, label: "Another path" };
    const parsed = parseExplorerConversationResult(success({ ...original, compassItems: [...original.compassItems, otherPoint], attentionId: otherPoint.id }));
    expect(parsed?.ok && parsed.state.priorityId).toBe(pointId);
    expect(parsed?.ok && parsed.state.attentionId).toBe(otherPoint.id);
  });

  it("rejects content or nonzero revision attached to a null conversation", () => {
    const original = populatedState();
    expect(parseExplorerConversationResult(success({ ...original, conversationId: null }))).toBeNull();
    expect(parseExplorerConversationResult(success({ ...emptyState(), revision: 1 }))).toBeNull();
    expect(parseExplorerConversationResult(success({ ...emptyState(), priorityId: pointId }))).toBeNull();
    expect(parseExplorerConversationResult(success({ ...emptyState(), version: "explorer-conversation.v2" }))).toBeNull();
    expect(parseExplorerConversationResult(success({ ...emptyState(), pendingTurn: true }))).toBeNull();
  });

  it("requires an honest boolean pending-turn projection and preserves a real pending conversation", () => {
    const original = populatedState();
    for (const pendingTurn of ["false", "true", 0, 1, null]) {
      expect(parseExplorerConversationResult(success({ ...original, pendingTurn }))).toBeNull();
    }
    const parsed = parseExplorerConversationResult(success({ ...original, pendingTurn: true }));
    expect(parsed?.ok && parsed.state.pendingTurn).toBe(true);
    expect(parseExplorerConversationResult(success(without(original, "pendingTurn")))).toBeNull();
  });

  it("bounds all collections while retaining every item at the accepted boundary", () => {
    const original = populatedState();
    const messages = Array.from({ length: EXPLORER_CONVERSATION_LIMITS.messages }, (_, index) => ({ ...original.messages[0], id: uuid(100 + index) }));
    const compassItems = Array.from({ length: EXPLORER_CONVERSATION_LIMITS.compassItems }, (_, index) => ({ ...original.compassItems[0], id: uuid(300 + index), sourceMessageId: messages[0].id }));
    const waypoints = Array.from({ length: EXPLORER_CONVERSATION_LIMITS.waypoints }, (_, index) => ({ ...original.waypoints[0], id: uuid(400 + index), sourceMessageId: messages[1].id }));
    const maximum = { ...original, messages, compassItems, waypoints, priorityId: compassItems[0].id, attentionId: compassItems[1].id };
    const parsed = parseExplorerConversationResult(success(maximum));
    expect(parsed?.ok && parsed.state.messages.length).toBe(100);
    expect(parsed?.ok && parsed.state.compassItems.length).toBe(24);
    expect(parsed?.ok && parsed.state.waypoints.length).toBe(20);
    expect(parseExplorerConversationResult(success({ ...maximum, messages: [...messages, { ...messages[0], id: uuid(250) }] }))).toBeNull();
    expect(parseExplorerConversationResult(success({ ...maximum, compassItems: [...compassItems, { ...compassItems[0], id: uuid(350) }] }))).toBeNull();
    expect(parseExplorerConversationResult(success({ ...maximum, waypoints: [...waypoints, { ...waypoints[0], id: uuid(450) }] }))).toBeNull();
  });

  it("rejects non-Explorer conversation roles and unsupported Waypoint lifecycle states", () => {
    const original = populatedState();
    for (const role of ["guide", "admin", "assistant", "system", null]) {
      expect(parseExplorerConversationResult(success({ ...original, messages: [{ ...original.messages[0], role }, original.messages[1]] }))).toBeNull();
    }
    for (const status of ["paused", "shared", "approved", null]) {
      expect(parseExplorerConversationResult(success({ ...original, waypoints: [{ ...original.waypoints[0], status }] }))).toBeNull();
    }
    expect(parseExplorerConversationResult(success({ ...original, waypoints: [{ ...original.waypoints[0], status: "reached" }] }))).not.toBeNull();
  });

  it("requires actual UTC timestamps rather than locale strings or impossible dates", () => {
    const original = populatedState();
    for (const createdAt of ["October 24, 2026", "2026-10-24T05:00:00-05:00", "2026-10-24", "not a date", "2026-02-30T05:00:00Z"]) {
      expect(parseExplorerConversationResult(success({ ...original, messages: [{ ...original.messages[0], createdAt }, original.messages[1]] }))).toBeNull();
    }
  });

  it("preserves valid message and Waypoint Unicode/paragraphs but rejects malformed or excessive text", () => {
    const original = populatedState();
    const body = "My words\n🧭 A second paragraph";
    const messageResult = parseExplorerConversationResult(success({ ...original, messages: [{ ...original.messages[0], body }], waypoints: [] }));
    expect(messageResult?.ok && messageResult.state.messages[0].body).toBe(body);
    for (const bad of [" ", "bad\ud800text", "bad\u0000text", "x".repeat(8_193)]) {
      expect(parseExplorerConversationResult(success({ ...original, messages: [{ ...original.messages[0], body: bad }, original.messages[1]] }))).toBeNull();
    }
    for (const field of ["destination", "meaning", "arrivalSignal"]) {
      const parsed = parseExplorerConversationResult(success({ ...original, waypoints: [{ ...original.waypoints[0], [field]: body }] }));
      expect(parsed?.ok && parsed.state.waypoints[0]).toHaveProperty(field, body);
      expect(parseExplorerConversationResult(success({ ...original, waypoints: [{ ...original.waypoints[0], [field]: "x".repeat(1_001) }] }))).toBeNull();
    }
  });

  it("does not accept an invalid saved Compass label even when its provenance is valid", () => {
    const original = populatedState();
    const valid = parseExplorerConversationResult(success({ ...original,
      compassItems: [{ ...original.compassItems[0], label: "🧭".repeat(80) }],
    }));
    expect(valid?.ok && valid.state.compassItems[0].label.length).toBe(160);
    for (const label of [" ", "x".repeat(161), "two\nlines", "bad\udffftext", "bad\u009ftext"]) {
      expect(parseExplorerConversationResult(success({ ...original,
        compassItems: [{ ...original.compassItems[0], label }],
      }))).toBeNull();
    }
  });

  it("returns detached frozen projections so later input mutation cannot rewrite displayed saved facts", () => {
    const original = populatedState();
    const parsed = parseExplorerConversationResult(success(original));
    expect(parsed?.ok).toBe(true);
    if (!parsed?.ok) throw new Error("expected_parsed_state");
    for (const value of [parsed, parsed.state, parsed.state.messages, parsed.state.messages[0],
      parsed.state.compassItems, parsed.state.compassItems[0], parsed.state.waypoints, parsed.state.waypoints[0]]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
    original.messages[0].body = "changed after parsing";
    original.compassItems[0].label = "changed after parsing";
    original.waypoints[0].destination = "changed after parsing";
    original.messages.push({ ...original.messages[0], id: uuid(99) });
    expect(parsed.state.messages[0].body).not.toBe("changed after parsing");
    expect(parsed.state.compassItems[0].label).toBe("Calmer mornings");
    expect(parsed.state.waypoints[0].destination).toBe("An unhurried morning");
    expect(parsed.state.messages).toHaveLength(2);
  });
});


describe("Confirmed Compass arrangement boundaries", () => {
  const otherPointId = uuid(5);
  const selected = () => [
    { compassItemId: pointId, anchor: "apex", emphasis: 3 },
    { compassItemId: otherPointId, anchor: null, emphasis: 1 },
  ];
  const command = () => ({ ...base, kind: "confirm_compass_arrangement", priorityId: pointId, items: selected() });
  const arrangedState = () => ({ ...populatedState(), compassItems: [
    { id: pointId, sourceMessageId: sourceId, label: "Current Priority label", anchor: "apex", emphasis: 3 },
    { id: otherPointId, sourceMessageId: sourceId, label: "Current attention label", anchor: "side_left", emphasis: 1 },
  ], attentionId: otherPointId });
  const captured = () => ({ operationId: uuid(901), revision: 2, kind: "arrangement_confirmed",
    previousPriorityId: null, priorityId: pointId, items: [
      { compassItemId: pointId, label: "Priority label captured at confirmation", anchor: "apex", emphasis: 3 },
      { compassItemId: otherPointId, label: "Attention label captured at confirmation", anchor: "side_left", emphasis: 1 },
    ], recordedAt: "2026-10-29T07:02:00.123456+00:00" });

  it("detaches and freezes the exact batch items without accepting labels or renamed ID keys", () => {
    const original = command();
    const parsed = parseExplorerConversationCommand(original);
    expect(parsed).toEqual(original);
    if (parsed?.kind !== "confirm_compass_arrangement") throw new Error("expected_arrangement");
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.items)).toBe(true);
    expect(Object.isFrozen(parsed.items[0])).toBe(true);
    expect(parsed.items).not.toBe(original.items);
    expect(parsed.items[0]).not.toBe(original.items[0]);
    original.items[0].emphasis = 1;
    original.items.push({ compassItemId: uuid(20), anchor: null, emphasis: 2 });
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].emphasis).toBe(3);
    for (const item of [
      { ...selected()[0], label: "Browser-supplied label" },
      { itemId: pointId, anchor: "apex", emphasis: 3 },
      ...Object.keys(selected()[0]).map(key => without(selected()[0], key)),
    ]) expect(parseExplorerConversationCommand({ ...command(), items: [item] })).toBeNull();
  });

  it("accepts all eight explicit anchors and 24 total points, preserving Other paths and nullable Priority", () => {
    expect(EXPLORER_COMPASS_ANCHORS).toEqual([
      "apex", "upper_left", "upper_right", "side_left", "side_right", "lower_left", "lower_center", "lower_right",
    ]);
    const items = Array.from({ length: 24 }, (_, index) => ({ compassItemId: uuid(100 + index),
      anchor: index < 8 ? EXPLORER_COMPASS_ANCHORS[index] : null, emphasis: 2 }));
    const parsed = parseExplorerConversationCommand({ ...command(), priorityId: null, items });
    expect(parsed?.kind).toBe("confirm_compass_arrangement");
    if (parsed?.kind !== "confirm_compass_arrangement") throw new Error("expected_arrangement");
    expect(parsed.priorityId).toBeNull();
    expect(parsed.items).toHaveLength(24);
    expect(parsed.items.filter(item => item.anchor !== null)).toHaveLength(8);
    expect(parsed.items.filter(item => item.anchor === null)).toHaveLength(16);
    expect(parseExplorerConversationCommand({ ...command(), priorityId: null, items: [] })).not.toBeNull();
    expect(parseExplorerConversationCommand({ ...command(), priorityId: null,
      items: [...items, { compassItemId: uuid(124), anchor: null, emphasis: 2 }] })).toBeNull();
  });

  it("rejects duplicate, malformed or incoherent command selections without repairing them", () => {
    for (const items of [
      [selected()[0], { ...selected()[1], compassItemId: pointId }],
      [selected()[0], { ...selected()[1], anchor: "apex" }],
      [{ ...selected()[0], compassItemId: ` ${pointId}` }],
      [{ ...selected()[0], anchor: "north" }], [{ ...selected()[0], anchor: "apex " }],
      [{ ...selected()[0], emphasis: null }], [{ ...selected()[0], emphasis: 0 }],
      [{ ...selected()[0], emphasis: 4 }], [{ ...selected()[0], emphasis: 1.5 }],
      [{ ...selected()[0], emphasis: "3" }], [{ ...selected()[0], anchor: null }],
    ]) expect(parseExplorerConversationCommand({ ...command(), items })).toBeNull();
    expect(parseExplorerConversationCommand({ ...command(), priorityId: uuid(99) })).toBeNull();
    for (const items of [null, {}, "[]"]) {
      expect(parseExplorerConversationCommand({ ...command(), items })).toBeNull();
    }
  });

  it("preserves legacy absence, explicit unarranged pairs and selected Other paths without inferring Priority", () => {
    const legacy = populatedState();
    const parsedLegacy = parseExplorerConversationResult(success(legacy));
    expect(parsedLegacy).toEqual(success(legacy));
    if (!parsedLegacy?.ok) throw new Error("expected_legacy");
    expect(parsedLegacy.state.compassItems[0]).not.toHaveProperty("anchor");
    expect(parsedLegacy.state.compassItems[0]).not.toHaveProperty("emphasis");
    for (const placement of [{ anchor: null, emphasis: null }, { anchor: null, emphasis: 2 },
      { anchor: "apex", emphasis: 3 }]) {
      const original = { ...legacy, priorityId: null, attentionId: null,
        compassItems: [{ ...legacy.compassItems[0], ...placement }] };
      const parsed = parseExplorerConversationResult(success(original));
      expect(parsed).toEqual(success(original));
      expect(parsed?.ok && parsed.state.priorityId).toBeNull();
    }
  });

  it("rejects partial placement pairs, duplicate anchors and off-Compass Priority or attention in a saved arrangement", () => {
    const legacy = populatedState();
    for (const placement of [{ anchor: null }, { emphasis: null }, { anchor: "apex" }, { emphasis: 2 },
      { anchor: "apex", emphasis: null }, { anchor: "unknown", emphasis: 2 },
      { anchor: null, emphasis: 4 }, { anchor: null, emphasis: 1.5 }]) {
      expect(parseExplorerConversationResult(success({ ...legacy, priorityId: null, attentionId: null,
        compassItems: [{ ...legacy.compassItems[0], ...placement }] }))).toBeNull();
    }
    const original = arrangedState();
    for (const changed of [
      { ...original, compassItems: [original.compassItems[0], { ...original.compassItems[1], anchor: "apex" }] },
      { ...original, compassItems: [{ ...original.compassItems[0], anchor: "upper_left" }, original.compassItems[1]] },
      { ...original, compassItems: [original.compassItems[0], { ...original.compassItems[1], anchor: null }] },
      { ...original, compassItems: [original.compassItems[0], { ...original.compassItems[1], anchor: null, emphasis: null }] },
    ]) expect(parseExplorerConversationResult(success(changed))).toBeNull();
  });

  it("reads the exact seven-key captured Route union in revision order with detached historical labels", () => {
    const event = captured();
    const earlier = { operationId: uuid(900), revision: 1, kind: "priority_confirmed", compassItemId: otherPointId,
      label: "Earlier captured label", recordedAt: "2026-10-29T07:01:00Z" };
    const original = { ...arrangedState(), route: [earlier, event] };
    const parsed = parseExplorerConversationResult(success(original));
    expect(parsed).toEqual(success(original));
    if (!parsed?.ok) throw new Error("expected_captured_arrangement");
    const saved = parsed.state.route?.[1];
    if (saved?.kind !== "arrangement_confirmed") throw new Error("expected_arrangement_route");
    expect(Object.keys(saved)).toHaveLength(7);
    expect(Object.isFrozen(saved)).toBe(true);
    expect(Object.isFrozen(saved.items)).toBe(true);
    expect(Object.isFrozen(saved.items[0])).toBe(true);
    expect(saved.items[0].label).toBe("Priority label captured at confirmation");
    expect(saved.items[0].label).not.toBe(original.compassItems[0].label);
    event.items[0].label = "Changed after parsing";
    event.items.push({ compassItemId: uuid(98), label: "Changed later", anchor: "lower_left", emphasis: 2 });
    expect(saved.items).toHaveLength(2);
    expect(saved.items[0].label).toBe("Priority label captured at confirmation");
    expect(parsed.state.route?.map(entry => entry.operationId)).toEqual([earlier.operationId, event.operationId]);
    expect(parseExplorerConversationResult(success({ ...arrangedState(), route: [captured(), earlier] }))).toBeNull();
  });

  it("rejects foreign or malformed captured arrangement facts while allowing later additions to current state", () => {
    const event = captured();
    for (const key of Object.keys(event)) {
      expect(parseExplorerConversationResult(success({ ...arrangedState(), route: [without(event, key)] }))).toBeNull();
    }
    for (const changed of [
      { ...event, privateDraft: "must not escape" }, { ...event, arrangement: event.items },
      { ...event, previousPriorityId: uuid(99) }, { ...event, priorityId: otherPointId },
      { ...event, previousPriorityId: pointId, priorityId: null },
      { ...event, items: [event.items[0], { ...event.items[1], compassItemId: uuid(99) }] },
      { ...event, items: [event.items[0], { ...event.items[1], compassItemId: pointId }] },
      { ...event, items: [event.items[0], { ...event.items[1], anchor: "apex" }] },
      { ...event, items: [{ ...event.items[0], label: " " }, event.items[1]] },
      { ...event, items: [{ ...event.items[0], sourceMessageId: sourceId }, event.items[1]] },
      ...Object.keys(event.items[0]).map(key => ({ ...event, items: [without(event.items[0], key), event.items[1]] })),
    ]) expect(parseExplorerConversationResult(success({ ...arrangedState(), route: [changed] }))).toBeNull();
    const original = arrangedState();
    expect(parseExplorerConversationResult(success({ ...original,
      compassItems: [...original.compassItems, { id: uuid(7), sourceMessageId: sourceId, label: "Added after the recorded arrangement", anchor: null, emphasis: null }],
      route: [event] }))).not.toBeNull();
  });
});
