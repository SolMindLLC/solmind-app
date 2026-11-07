import { describe, expect, it } from "vitest";
import { EXPLORER_CONVERSATION_VERSION, type ExplorerConversationState,
  type ExplorerWaypointClarificationAnswer } from "../explorerConversationContract";
import { buildReachedFormationIntent, buildWaypointReleaseFormationIntent,
  buildWaypointRevisionFormationIntent, type WaypointRevisionReview } from "../explorerConversationFormation";

const parent = { id: "waypoint-a", sourceMessageId: "source-a", title: "A calm breakfast", destination: "A calm breakfast",
  isCurrent: true, createdAt: "2026-10-29T14:00:00Z",
  meaning: "Connecting", arrivalSignal: "An unhurried meal", status: "chosen" as const };
const answer = () => ({ component: "destination" as const, answer: "A calm evening meal" });
function state(overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  return { version: EXPLORER_CONVERSATION_VERSION, conversationId: "conversation-a", revision: 4,
    waypointCapacity: { activeCount: 1, activeLimit: 20, historyRoom: true, conversationRoom: true },
    waypointProjection: { kind: "current_heads", limit: 20, hasMore: false, totalHeads: 1 },
    providerState: "unavailable", pendingTurn: false, turnedDownLimitReached: false, waypointDraft: null, messages: [], compassItems: [], priorityId: null,
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

  it("keeps superseded definitions review-only and gates revision by history room only", () => {
    const child = { ...parent, id: "waypoint-b", destination: answer().answer,
      lifecycle: { predecessorWaypointId: parent.id, creationReason: "revision" as const,
        clarifications: [{ ...answer(), questionKey: "waypoint.destination.v1" as const, recordedAt: "2026-10-29T15:00:00Z" }] } };
    const current = state({ waypoints: [{ ...parent, isCurrent: false }, child] });
    expect(buildWaypointRevisionFormationIntent(current, review(), true).ok).toBe(false);
    expect(buildWaypointReleaseFormationIntent(current, parent.id, 4, true).ok).toBe(false);
    expect(buildReachedFormationIntent(current, parent.id, "Old evidence cannot advance an obsolete choice", true).ok).toBe(false);
    expect(buildWaypointRevisionFormationIntent(current, review({ waypointId: child.id,
      answers: [{ component: "meaning", answer: "A newly clarified meaning" }] }), true).ok).toBe(true);
    const full = state({ waypointCapacity: { activeCount: 20, activeLimit: 20, historyRoom: false, conversationRoom: true } });
    expect(buildWaypointRevisionFormationIntent(full, review(), true).ok).toBe(false);
    expect(buildWaypointRevisionFormationIntent(full, review(), true).error).toBe("This conversation has reached its limit of 200 saved Waypoint versions, to keep its saved history manageable. No new Waypoint or version can be saved here. Marking one Reached or Released does not make room for another version. You can still read the Waypoints shown here, use Reached or Release where available, or end an active conversation.");
    expect(buildWaypointReleaseFormationIntent(full, parent.id, 4, true).ok).toBe(true);
    expect(full.waypoints).toHaveLength(1);
  });

  it("permits revision at and above global twenty but refuses a revisit increase", () => {
    for (const activeCount of [20, 21, 25]) {
      const capacity = { activeCount, activeLimit: 20, historyRoom: true, conversationRoom: true };
      expect(buildWaypointRevisionFormationIntent(state({ waypointCapacity: capacity }), review(), true).ok).toBe(true);
      expect(buildWaypointRevisionFormationIntent(state({ waypointCapacity: capacity, waypoints: [{ ...parent, release }] }),
        review({ kind: "revisit_waypoint", answers: [] }), true).ok).toBe(false);
      expect(buildWaypointRevisionFormationIntent(state({ waypointCapacity: capacity, waypoints: [{ ...parent, release }] }),
        review({ kind: "revisit_waypoint", answers: [] }), true).error).toBe(`You have ${activeCount} active Waypoints across your conversations. To help keep your focus manageable, your total must be below 20 before adding or bringing back another. Reached and Released Waypoints do not count. Review and confirm Reached for Waypoints you have reached, or release those you no longer want to pursue.`);
    }
    expect(buildWaypointRevisionFormationIntent(state({ waypointCapacity: { activeCount: 19, activeLimit: 20, historyRoom: true, conversationRoom: true },
      waypoints: [{ ...parent, release }] }), review({ kind: "revisit_waypoint", answers: [] }), true).ok).toBe(true);
  });

  it("does not infer currentness from a successor omitted from the displayed page", () => {
    const earlier = state({ waypoints: [{ ...parent, isCurrent: false }] });
    expect(buildWaypointRevisionFormationIntent(earlier, review(), true).ok).toBe(false);
    expect(buildWaypointReleaseFormationIntent(earlier, parent.id, 4, true).ok).toBe(false);
    expect(buildReachedFormationIntent(earlier, parent.id, "Observed evidence", true).ok).toBe(false);
  });

  it("uses unavailable wording for missing capacity on both revision and revisit", () => {
    const waypointCapacity = null as unknown as ExplorerConversationState["waypointCapacity"];
    expect(buildWaypointRevisionFormationIntent(state({ waypointCapacity }), review(), true))
      .toEqual({ ok: false, command: null, error: "The conversation could not be loaded. Please try again." });
    expect(buildWaypointRevisionFormationIntent(state({ waypointCapacity, waypoints: [{ ...parent, release }] }),
      review({ kind: "revisit_waypoint", answers: [] }), true))
      .toEqual({ ok: false, command: null, error: "The conversation could not be loaded. Please try again." });
  });
});
