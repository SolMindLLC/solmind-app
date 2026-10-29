import { describe, expect, it } from "vitest";
import {
  EXPLORER_CONVERSATION_VERSION,
  EXPLORER_WAYPOINT_QUESTION_KEYS,
  parseExplorerConversationCommand,
  parseExplorerConversationState,
  parseExplorerWaypointClarificationAnswers,
} from "../explorerConversationContract";

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const base = { operationId: uuid(8), expectedRevision: 4, waypointId: uuid(3) };
const parent = { id: uuid(3), sourceMessageId: uuid(2), destination: "A calm breakfast",
  meaning: "Connecting with family", arrivalSignal: "An unhurried meal together", status: "chosen" };
const clarification = () => ({ component: "destination", questionKey: EXPLORER_WAYPOINT_QUESTION_KEYS.destination,
  answer: "A calm evening meal", recordedAt: "2026-10-29T15:00:00.123456+00:00" });
const child = () => ({ ...parent, id: uuid(4), destination: clarification().answer,
  lifecycle: { predecessorWaypointId: parent.id, creationReason: "revision", clarifications: [clarification()] } });
function state(waypoints: readonly unknown[] = [parent, child()]) {
  return { version: EXPLORER_CONVERSATION_VERSION, conversationId: uuid(1), revision: 5,
    providerState: "unavailable", pendingTurn: false, messages: [
      { id: uuid(2), role: "explorer", body: "I want more time with my family.", createdAt: "2026-10-29T14:00:00Z" },
    ], compassItems: [], priorityId: null, attentionId: null, waypoints, sessionStatus: "active", ending: null };
}

describe("conversation clarification command contract", () => {
  it("accepts and freezes canonical Explorer answers without summary, authority or model fields", () => {
    const answers = [{ component: "destination", answer: "A calm evening meal" },
      { component: "arrivalSignal", answer: "We notice an unhurried shared meal" }];
    const input = { ...base, kind: "revise_waypoint", answers };
    const parsed = parseExplorerConversationCommand(input);
    expect(parsed).toEqual(input);
    if (parsed?.kind !== "revise_waypoint") throw new Error("expected_revision_command");
    expect(Object.isFrozen(parsed.answers)).toBe(true);
    expect(Object.isFrozen(parsed.answers[0])).toBe(true);
    answers[0].answer = "Changed after the captured review";
    expect(parsed.answers[0].answer).toBe("A calm evening meal");
    expect(parsed).not.toHaveProperty("destination");
    expect(parsed).not.toHaveProperty("questionKey");
    expect(parsed).not.toHaveProperty("sourceMessageId");
  });

  it("permits a deliberately confirmed empty revisit but requires a nonempty revision", () => {
    expect(parseExplorerConversationCommand({ ...base, kind: "revise_waypoint", answers: [] })).toBeNull();
    expect(parseExplorerConversationCommand({ ...base, kind: "revisit_waypoint", answers: [] }))
      .toEqual({ ...base, kind: "revisit_waypoint", answers: [] });
  });

  it("refuses duplicate/out-of-order components and arbitrary question, summary or attribution payloads", () => {
    const destination = { component: "destination", answer: "An evening meal" };
    const meaning = { component: "meaning", answer: "Time together" };
    for (const answers of [[destination, destination], [meaning, destination], [{ component: "notes", answer: "A note" }],
      [{ ...destination, questionKey: "an_unreviewed_question" }], [{ ...destination, role: "virtualGuide" }],
      [{ ...destination, recordedAt: "2026-10-29T15:00:00Z" }]]) {
      expect(parseExplorerConversationCommand({ ...base, kind: "revise_waypoint", answers })).toBeNull();
    }
    for (const field of ["destination", "meaning", "arrivalSignal", "sourceMessageId", "actorId", "modelName", "quotedText"]) {
      expect(parseExplorerConversationCommand({ ...base, kind: "revise_waypoint", answers: [destination], [field]: "not allowed" })).toBeNull();
    }
  });

  it("preserves paragraphs and Unicode, bounds exact trimmed answers and rejects malformed selectors", () => {
    const answer = "My own words\nA second line 🧭";
    expect(parseExplorerWaypointClarificationAnswers([{ component: "meaning", answer }]))
      .toEqual([{ component: "meaning", answer }]);
    expect(parseExplorerWaypointClarificationAnswers([{ component: "meaning", answer: "x".repeat(1000) }])).not.toBeNull();
    for (const invalid of ["", " ", " leading", "trailing ", "x".repeat(1001), "🧭".repeat(501), "bad\ud800", "bad\u0000", "bad\u009f"]) {
      expect(parseExplorerWaypointClarificationAnswers([{ component: "meaning", answer: invalid }])).toBeNull();
    }
    expect(parseExplorerConversationCommand({ ...base, kind: "revise_waypoint", waypointId: `${parent.id}\n`,
      answers: [{ component: "destination", answer: "An evening meal" }] })).toBeNull();
  });
});

describe("immutable private Waypoint version and clarification history", () => {
  it("keeps old definition/source and captures actual app-question/Explorer-answer attribution", () => {
    const newer = child();
    const parsed = parseExplorerConversationState(state([parent, newer]));
    expect(parsed?.waypoints).toEqual([parent, newer]);
    expect(parsed?.waypoints[0]).not.toHaveProperty("lifecycle");
    expect(parsed?.messages).toHaveLength(1);
    expect(parsed?.waypoints[1].sourceMessageId).toBe(parent.sourceMessageId);
    expect(Object.isFrozen(parsed?.waypoints[1].lifecycle)).toBe(true);
    expect(Object.isFrozen(parsed?.waypoints[1].lifecycle?.clarifications)).toBe(true);
    expect(Object.isFrozen(parsed?.waypoints[1].lifecycle?.clarifications[0])).toBe(true);
    newer.lifecycle.clarifications[0].answer = "A later unconfirmed change";
    expect(parsed?.waypoints[1].lifecycle?.clarifications[0].answer).toBe("A calm evening meal");
    expect(parsed?.waypoints[1].lifecycle?.clarifications[0]).not.toHaveProperty("quotedText");
    expect(parsed?.waypoints[1].lifecycle?.clarifications[0]).not.toHaveProperty("modelName");
  });

  it("inherits every unanswered component and refuses invented or misattributed derived values", () => {
    const initial = child();
    const sourceMismatch = { ...initial, sourceMessageId: uuid(99) };
    for (const newer of [{ ...initial, meaning: "Unanswered invented meaning" }, sourceMismatch,
      { ...initial, lifecycle: { ...initial.lifecycle, clarifications: [{ ...clarification(), answer: "Not its destination" }] } },
      { ...initial, lifecycle: { ...initial.lifecycle, clarifications: [{ ...clarification(), questionKey: "waypoint.meaning.v1" }] } },
      { ...initial, lifecycle: { ...initial.lifecycle, clarifications: [{ ...clarification(), recordedAt: "2026-02-30T15:00:00Z" }] } },
      { ...initial, lifecycle: { ...initial.lifecycle, clarifications: [{ ...clarification(), role: "virtualGuide" }] } },
      { ...initial, lifecycle: { ...initial.lifecycle, creationReason: "manual_edit" } },
      { ...initial, lifecycle: null }]) {
      expect(parseExplorerConversationState(state([parent, newer]))).toBeNull();
    }
    const unchanged = { ...child(), destination: parent.destination,
      lifecycle: { ...child().lifecycle, clarifications: [{ ...clarification(), answer: parent.destination }] } };
    expect(parseExplorerConversationState(state([parent, unchanged]))).toBeNull();
  });

  it("allows only one same-conversation acyclic successor for each retained predecessor", () => {
    const newer = child();
    expect(parseExplorerConversationState(state([parent, { ...newer, lifecycle: { ...newer.lifecycle, predecessorWaypointId: uuid(99) } }]))).toBeNull();
    expect(parseExplorerConversationState(state([parent, newer, { ...newer, id: uuid(5) }]))).toBeNull();
    const cycleParent = { ...parent, lifecycle: { predecessorWaypointId: newer.id, creationReason: "revision",
      clarifications: [{ ...clarification(), answer: parent.destination }] } };
    expect(parseExplorerConversationState(state([cycleParent, newer]))).toBeNull();
  });

  it("revisits terminal history into a fresh current choice without transferring Reached evidence", () => {
    const reached = { ...parent, status: "reached", reachedEvidence: "An actual earlier breakfast", reachedAt: "2026-10-29T14:30:00Z" };
    const revisited = { ...parent, id: uuid(4), reachedEvidence: null, reachedAt: null,
      lifecycle: { predecessorWaypointId: parent.id, creationReason: "revisit", clarifications: [] } };
    const parsed = parseExplorerConversationState(state([reached, revisited]));
    expect(parsed?.waypoints).toEqual([reached, revisited]);
    expect(parsed?.waypoints[1].status).toBe("chosen");
    expect(parsed?.waypoints[1].reachedEvidence).toBeNull();
    const released = { ...parent, release: { operationId: uuid(9), releasedAt: "2026-10-29T14:30:00Z" } };
    expect(parseExplorerConversationState(state([released, revisited]))?.waypoints).toEqual([released, revisited]);
    expect(parseExplorerConversationState(state([parent, revisited]))).toBeNull();
    expect(parseExplorerConversationState(state([reached, child()]))).toBeNull();
    expect(parseExplorerConversationState(state([released, child()]))).toBeNull();
    expect(parseExplorerConversationState(state([reached, { ...revisited, status: "reached", reachedEvidence: undefined, reachedAt: undefined }]))).toBeNull();
  });

  it("counts every retained version toward the existing20-row bound and preserves ended history", () => {
    const all = [parent];
    for (let n = 1; n < 20; n += 1) {
      all.push({ ...parent, id: uuid(n + 3), destination: `Version ${n}`,
        lifecycle: { predecessorWaypointId: all[n - 1].id, creationReason: "revision",
          clarifications: [{ ...clarification(), answer: `Version ${n}` }] } } as typeof parent);
    }
    expect(parseExplorerConversationState(state(all))?.waypoints).toHaveLength(20);
    expect(parseExplorerConversationState(state([...all, { ...parent, id: uuid(30) }]))).toBeNull();
    const ended = { ...state(all), sessionStatus: "ended" };
    expect(parseExplorerConversationState(ended)?.waypoints).toHaveLength(20);
  });
});
