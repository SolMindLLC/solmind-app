import { describe, expect, it } from "vitest";
import { EXPLORER_CONVERSATION_VERSION, type ExplorerConversationState,
  type ExplorerWaypointClarificationAnswer } from "../explorerConversationContract";
import { buildReachedFormationIntent, buildWaypointReleaseFormationIntent,
  buildWaypointRevisionFormationIntent, type WaypointRevisionReview } from "../explorerConversationFormation";

const parent = { id: "waypoint-a", sourceMessageId: "source-a", destination: "A calm breakfast",
  meaning: "Connecting", arrivalSignal: "An unhurried meal", status: "chosen" as const };
const answer = () => ({ component: "destination" as const, answer: "A calm evening meal" });
function state(overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  return { version: EXPLORER_CONVERSATION_VERSION, conversationId: "conversation-a", revision: 4,
    providerState: "unavailable", pendingTurn: false, messages: [], compassItems: [], priorityId: null,
    attentionId: null, waypoints: [parent], sessionStatus: "active", ending: null, ...overrides };
}
function review(overrides: Partial<WaypointRevisionReview> = {}): WaypointRevisionReview {
  return { conversationId: "conversation-a", revision: 4, waypointId: parent.id, kind: "revise_waypoint", answers: [answer()], ...overrides };
}
const release = { operationId: "release-a", releasedAt: "2026-10-29T14:00:00Z" };

describe("review-bound conversational Waypoint revision and revisit intents", () => {
  it("confirms only exact reviewed Explorer answers and preserves current and source state until saved", () => {
    const current = state();
    const answers = [answer()];
    const result = buildWaypointRevisionFormationIntent(current, review({ answers }), true);
    expect(result).toEqual({ ok: true, error: null, command: { kind: "revise_waypoint", waypointId: parent.id, answers } });
    if (!result.ok || result.command.kind !== "revise_waypoint") throw new Error("expected_revision");
    expect(Object.isFrozen(result.command.answers)).toBe(true);
    expect(Object.isFrozen(result.command.answers[0])).toBe(true);
    answers[0].answer = "Changed after review";
    expect(result.command.answers[0].answer).toBe("A calm evening meal");
    expect(current.waypoints).toEqual([parent]);
    expect(current.revision).toBe(4);
    for (const field of ["destination", "meaning", "arrivalSignal", "sourceMessageId", "questionKey", "recordedAt", "modelName", "operationId", "expectedRevision"]) {
      expect(result.command).not.toHaveProperty(field);
    }
  });

  it("requires an actual changed component and refuses an unconfirmed or terminal revision", () => {
    expect(buildWaypointRevisionFormationIntent(state(), review(), false).ok).toBe(false);
    for (const answers of [[], [{ component: "destination", answer: parent.destination }],
      [{ component: "destination", answer: " leading whitespace" }],
      [{ component: "meaning", answer: "New" }, answer()]]) {
      expect(buildWaypointRevisionFormationIntent(state(), review({ answers: answers as readonly ExplorerWaypointClarificationAnswer[] }), true).ok).toBe(false);
    }
    for (const waypoint of [{ ...parent, release }, { ...parent, status: "reached" as const }]) {
      expect(buildWaypointRevisionFormationIntent(state({ waypoints: [waypoint] }), review(), true).ok).toBe(false);
    }
  });

  it("permits deliberate revisit with inherited components but never carries old success into a new command", () => {
    const revisit = review({ kind: "revisit_waypoint", answers: [] });
    for (const waypoint of [{ ...parent, release }, { ...parent, status: "reached" as const,
      reachedEvidence: "Earlier real evidence", reachedAt: "2026-10-29T14:00:00Z" }]) {
      const current = state({ waypoints: [waypoint] });
      expect(buildWaypointRevisionFormationIntent(current, revisit, false).ok).toBe(false);
      expect(buildWaypointRevisionFormationIntent(current, revisit, true).command)
        .toEqual({ kind: "revisit_waypoint", waypointId: parent.id, answers: [] });
      expect(current.waypoints[0]).toBe(waypoint);
    }
    expect(buildWaypointRevisionFormationIntent(state(), revisit, true).ok).toBe(false);
  });

  it("holds stale container/revision/selection and pending or ended conversations without a new draft commit", () => {
    for (const captured of [review({ conversationId: "another-conversation" }), review({ revision: 3 }),
      review({ revision: NaN }), review({ waypointId: "foreign-waypoint" })]) {
      expect(buildWaypointRevisionFormationIntent(state(), captured, true).ok).toBe(false);
    }
    for (const current of [state({ conversationId: null }), state({ sessionStatus: "ended" }),
      state({ sessionStatus: null }), state({ pendingTurn: true })]) {
      expect(buildWaypointRevisionFormationIntent(current, review(), true).ok).toBe(false);
    }
  });

  it("keeps superseded definitions review-only and all retained versions inside the20-row bound", () => {
    const child = { ...parent, id: "waypoint-b", destination: answer().answer,
      lifecycle: { predecessorWaypointId: parent.id, creationReason: "revision" as const,
        clarifications: [{ ...answer(), questionKey: "waypoint.destination.v1" as const, recordedAt: "2026-10-29T15:00:00Z" }] } };
    const current = state({ waypoints: [parent, child] });
    expect(buildWaypointRevisionFormationIntent(current, review(), true).ok).toBe(false);
    expect(buildWaypointReleaseFormationIntent(current, parent.id, 4, true).ok).toBe(false);
    expect(buildReachedFormationIntent(current, parent.id, "Old evidence cannot advance an obsolete choice", true).ok).toBe(false);
    expect(buildWaypointRevisionFormationIntent(current, review({ waypointId: child.id,
      answers: [{ component: "meaning", answer: "A newly clarified meaning" }] }), true).ok).toBe(true);
    const full = state({ waypoints: Array.from({ length: 20 }, (_, i) => ({ ...parent, id: i ? `history-${i}` : parent.id })) });
    expect(buildWaypointRevisionFormationIntent(full, review(), true).ok).toBe(false);
    expect(buildWaypointReleaseFormationIntent(full, parent.id, 4, true).ok).toBe(true);
    expect(full.waypoints).toHaveLength(20);
  });
});
