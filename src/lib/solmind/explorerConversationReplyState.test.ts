import { describe, expect, it } from "vitest";
import { EXPLORER_CONVERSATION_VERSION, parseExplorerConversationState } from "./explorerConversationContract";

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
function state() {
  return {
    version: EXPLORER_CONVERSATION_VERSION, conversationId: id(1), revision: 4,
    pendingTurn: false, turnedDownLimitReached: false, providerState: "unavailable", messages: [
      { id: id(2), role: "explorer", body: "A synthetic question.", createdAt: "2026-11-04T10:00:00.000Z" },
      { id: id(3), role: "virtualGuide", body: "A synthetic reply.", createdAt: "2026-11-04T10:00:01.000Z" },
    ], compassItems: [{ id: id(4), sourceMessageId: id(2), label: "Money worries" }],
    priorityId: null, attentionId: id(4), waypoints: [], route: [{
      operationId: id(5), revision: 4, kind: "attention_changed", compassItemId: id(4),
      label: "Money worries", recordedAt: "2026-11-04T10:00:01.000Z",
    }],
  };
}
function withChoices(choices: unknown, role = "virtualGuide") {
  const original = state();
  return { ...original, messages: [original.messages[0], { ...original.messages[1], role, choices }] };
}

describe("S4 saved reply choices and attention provenance", () => {
  it("keeps historical state without optional keys valid", () => {
    expect(parseExplorerConversationState(state())).toEqual(state());
  });

  it("copies and freezes one to three saved choices without repairing their text", () => {
    for (const length of [1, 2, 3]) {
      const choices = Array.from({ length }, (_, index) => ({ label: `Synthetic choice ${index}` }));
      const original = withChoices(choices);
      const parsed = parseExplorerConversationState(original);
      expect(parsed).toEqual(original);
      expect(Object.isFrozen(parsed?.messages[1].choices)).toBe(true);
      expect(Object.isFrozen(parsed?.messages[1].choices?.[0])).toBe(true);
      choices[0].label = "Changed afterwards";
      expect(parsed?.messages[1].choices?.[0].label).toBe("Synthetic choice 0");
    }
  });

  it("accepts forty Unicode scalars without splitting a supplementary character", () => {
    const label = "\u{1f9ed}".repeat(40);
    expect(parseExplorerConversationState(withChoices([{ label }]))?.messages[1].choices).toEqual([{ label }]);
    expect(parseExplorerConversationState(withChoices([{ label: label + "x" }]))).toBeNull();
  });

  it.each([null, [], {}, "choices", [{ label: "a" }, { label: "b" }, { label: "c" }, { label: "d" }],
    [{ label: "" }], [{ label: " " }], [{ label: " leading" }], [{ label: "trailing " }],
    [{ label: "x".repeat(41) }], [{ label: "a\nb" }], [{ label: "a\tb" }], [{ label: "a\u0000b" }],
    [{ label: "a\u200bb" }], [{ label: "a\u200fb" }], [{ label: "a\u202eb" }], [{ label: "a\u2066b" }],
    [{ label: "a\u206fb" }], [{ label: "a\ufeffb" }],
    [{ label: "a\ud800b" }], [{ label: "a", action: "send" }], ["a"]].map(choices => [choices]))(
    "rejects malformed persisted choices instead of concealing a broken state (%j)", choices => {
      expect(parseExplorerConversationState(withChoices(choices))).toBeNull();
    });

  it("does not accept choices on an Explorer message", () => {
    expect(parseExplorerConversationState(withChoices([{ label: "Synthetic choice" }], "explorer"))).toBeNull();
  });

  it.each(["explorer", "virtual_guide"])("preserves the closed attention actor %s", actor => {
    const original = state();
    const withActor = { ...original, route: [{ ...original.route[0], actor }] };
    expect(parseExplorerConversationState(withActor)).toEqual(withActor);
  });

  it("refuses unknown provenance, provenance on Priority and private operation lineage", () => {
    const original = state();
    for (const change of [{ actor: null }, { actor: "admin" }, { actor: "virtualGuide" },
      { actor: "virtual_guide", kind: "priority_confirmed" }, { originOperationId: id(9) }, { awaitingReply: true }]) {
      expect(parseExplorerConversationState({ ...original, route: [{ ...original.route[0], ...change }] })).toBeNull();
    }
  });
});
