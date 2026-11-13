import { describe, expect, it } from "vitest";
import { mapExplorerCompassTopics } from "../explorerPrivateConversationComposition";
import { parseExplorerSafetyReplyBody } from "../explorerSafetyReplyContract";

const topicId = "11111111-1111-5111-8111-111111111111";
const topic = { topicId: null, label: "Time for myself", supportRefs: ["now"], ready: false };
function reply(compass: unknown, mode: "classification_and_reply" | "classification_only" = "classification_and_reply") {
  return parseExplorerSafetyReplyBody(JSON.stringify({ protocol: "explorer-safety-reply.v2",
    classification: { level: 0, minorIndicated: false }, candidateReply: { content: "What would that time make possible?" }, compass }), mode);
}
describe("automatic Compass optional protocol", () => {
  it("keeps frozen topics and permits an existing topic without new evidence", () => {
    const topics = [topic, { ...topic, topicId, supportRefs: [], ready: true }];
    const result = reply({ topics });
    expect(result.compass).toEqual({ topics });
    expect(Object.isFrozen(result.compass?.topics?.[0].supportRefs)).toBe(true);
  });
  it.each([{}, null, { ...topic, ready: "yes" }, { ...topic, label: " padded " },
    { ...topic, label: "x".repeat(161) }, { ...topic, label: "Two\nlines" },
    { ...topic, supportRefs: [] }, { ...topic, supportRefs: ["now", "now"] },
    { ...topic, supportRefs: ["h01"] }, { ...topic, supportRefs: ["h24"] },
    { ...topic, supportRefs: ["now", "h0", "h1", "h2"] }, { ...topic, extra: true }])(
    "malformed optional topics preserve classification and prose: %j", invalid => {
      const sibling = { ...topic, label: "Time outdoors" };
      const result = reply({ topics: [invalid, sibling] });
      expect(result.compass?.topics).toEqual([sibling]);
      expect(result.classification).toEqual({ level: 0, minorIndicated: false });
      expect(result.candidate.kind).toBe("usable");
    });
  it("rejects repeated targets and overlong batches without truncation", () => {
    for (const topics of [[topic, topic], [{ ...topic, topicId }, { ...topic, topicId, label: "Other" }],
      Array.from({ length: 4 }, (_, i) => ({ ...topic, label: "Topic " + i }))]) {
      expect(reply({ attention: null, topics }).compass).toEqual({ attention: null });
    }
  });
  it("retired Compass fields authorize no new transition", () => {
    expect(reply({ suggestions: [{ label: "Time for myself" }], responses: [{ pointId: topicId, response: "right" }] }).compass).toBeUndefined();
    expect(reply({ suggestions: { arbitrary: true }, responses: 42, topics: [topic] }).compass).toEqual({ topics: [topic] });
  });
  it("unknown Compass key drops Compass but not valid prose", () => {
    const result = reply({ topics: [topic], correction: true });
    expect(result.compass).toBeUndefined(); expect(result.candidate.kind).toBe("usable");
  });
  it("classification-only ignores every proposal", () => {
    expect(reply({ topics: [topic] }, "classification_only")).toEqual({
      classification: { level: 0, minorIndicated: false }, candidate: { kind: "not_requested" } });
  });
  it("one message may support two different topics", () => {
    expect(reply({ topics: [topic, { ...topic, label: "Time outdoors" }] }).compass?.topics).toHaveLength(2);
  });
  it("structural validation does not certify the meaning of evidence", () => {
    // Whether now supports this wording is the model's assertion, not a semantic proof.
    expect(reply({ topics: [{ ...topic, ready: true }] }).compass?.topics?.[0].ready).toBe(true);
  });
});

describe("automatic topics mapped from the invocation", () => {
  function current() {
    return { contractVersion: "wi007-v0.1+onboarding-fields-v2+compass-v8",
      immediateExplorerMessage: { messageId: "22222222-2222-5222-8222-222222222222" },
      currentSessionMessages: [
        { order: 0, messageId: "33333333-3333-5333-8333-333333333333", role: "explorer" },
        { order: 1, messageId: "44444444-4444-5444-8444-444444444444", role: "solmind_virtual_guide" },
      ], compassContext: { mode: "automatic", topics: [{ id: topicId, label: topic.label }],
        messageRefs: { history: [{ ref: "h0", order: 0 }], immediate: "now" } } };
  }
  it("references resolve against the invocation window and are copied once", () => {
    const context = current();
    context.compassContext.topics = [];
    const topics = [{ ...topic, supportRefs: ["h0", "now"] }];
    const mapped = mapExplorerCompassTopics(JSON.stringify(context), topics);
    expect(mapped).toEqual([{ topicId: null, label: topic.label, ready: false, supports: [
      { ref: "h0", messageId: context.currentSessionMessages[0].messageId },
      { ref: "now", messageId: context.immediateExplorerMessage.messageId },
    ] }]);
    topics[0].supportRefs[0] = "h1";
    expect(mapped![0].supports[0].ref).toBe("h0");
    expect(Object.isFrozen(mapped![0].supports[0])).toBe(true);
  });
  it("new topic requires evidence and existing topic requires exact identity", () => {
    const context = current();
    expect(mapExplorerCompassTopics(JSON.stringify(context), [{ ...topic, topicId, supportRefs: [] }]))
      .toEqual([{ topicId, label: topic.label, ready: false, supports: [] }]);
    for (const proposal of [{ ...topic, topicId, label: "Renamed" },
      { ...topic, topicId: context.immediateExplorerMessage.messageId }, topic,
      { ...topic, topicId, supportRefs: ["h1"] }, { ...topic, topicId, supportRefs: ["h23"] }]) {
      expect(mapExplorerCompassTopics(JSON.stringify(context), [proposal])).toBeNull();
    }
  });
  it("unrelated and disputing controlled replies add no support", () => {
    const context = current();
    for (const controlled of [reply({ topics: [] }), reply({ topics: [{ ...topic, topicId, supportRefs: [] }] })]) {
      const mapped = mapExplorerCompassTopics(JSON.stringify(context), controlled.compass?.topics);
      expect(mapped?.flatMap(entry => entry.supports) ?? []).toEqual([]);
    }
  });
  it("legacy, absent and older context cannot authorize topics", () => {
    for (const context of [{}, { ...current(), contractVersion: "wi007-v0.1+onboarding-fields-v2+compass-v7" },
      { ...current(), compassContext: { ...current().compassContext, mode: "legacy_read_only" } }]) {
      expect(mapExplorerCompassTopics(JSON.stringify(context), [{ ...topic, topicId }])).toBeNull();
    }
  });
  it("duplicate malformed target invalidates the batch before individually dropping entries", () => {
    expect(reply({ attention: null, topics: [topic, { ...topic, extra: true }] }).compass).toEqual({ attention: null });
  });
});
