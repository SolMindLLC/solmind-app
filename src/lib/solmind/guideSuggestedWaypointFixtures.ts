import {
  acknowledgeSuggestedWaypoint,
  createSuggestedWaypointDraft,
  deliverPendingSuggestedWaypoint,
  scheduleSuggestedWaypointSend,
  type SuggestedWaypointContent,
  type SuggestedWaypointResult,
  type SuggestedWaypointState,
} from "./suggestedWaypoints";

export const GUIDE_SUGGESTED_WAYPOINT_FIXTURE_NOW_MS = Date.UTC(
  2026,
  7,
  12,
  18,
  0,
  0,
);

export type GuideSuggestedWaypointFixtureSet = Readonly<{
  draft: SuggestedWaypointState;
  pending: SuggestedWaypointState;
  open: SuggestedWaypointState;
  acknowledged: SuggestedWaypointState;
}>;

const timing = Object.freeze({
  minimumSeconds: 60,
  defaultSeconds: 300,
  maximumSeconds: 3600,
});

const requireState = (result: SuggestedWaypointResult): SuggestedWaypointState => {
  if (result.kind === "rejected") {
    throw new Error(`Invalid Guide Suggested Waypoint fixture: ${result.code}`);
  }
  return result.state;
};

const createDraft = (
  suggestionId: string,
  content: SuggestedWaypointContent,
): SuggestedWaypointState =>
  createSuggestedWaypointDraft({
    suggestionId,
    guideUserId: "guide-morgan",
    explorerUserId: "explorer-avery",
    relationshipId: "relationship-avery-morgan",
    content,
  });

const schedule = (
  state: SuggestedWaypointState,
  versionId: string,
): SuggestedWaypointState =>
  requireState(
    scheduleSuggestedWaypointSend(state, {
      operationId: `fixture-schedule-${state.suggestionId}`,
      versionId,
      expectedRevision: state.authoring.revision,
      nowMs: GUIDE_SUGGESTED_WAYPOINT_FIXTURE_NOW_MS,
      policyVersion: "guide-fixture-policy-v1",
      timing,
    }),
  );

const deliver = (
  state: SuggestedWaypointState,
): SuggestedWaypointState =>
  requireState(
    deliverPendingSuggestedWaypoint(state, {
      operationId: `fixture-deliver-${state.suggestionId}`,
      nowMs: GUIDE_SUGGESTED_WAYPOINT_FIXTURE_NOW_MS + 300_000,
    }),
  );

export function createGuideSuggestedWaypointFixtures(): GuideSuggestedWaypointFixtureSet {
  const draft = createDraft("suggestion-recovery-draft", {
    destination: "Protect one evening each week for recovery",
    why: "Create dependable room to recover without adding pressure elsewhere.",
    arrivalSignals: ["One evening stays unscheduled."],
  });

  const pending = schedule(
    createDraft("suggestion-transition-pending", {
      destination: "Plan a short transition after work",
      why: "Create a gentle boundary between the workday and the evening.",
      arrivalSignals: ["A short transition happens on three workdays."],
    }),
    "suggestion-transition-pending-v1",
  );

  const open = deliver(
    schedule(
      createDraft("suggestion-useful-meeting-open", {
        destination: "Notice what makes a meeting feel useful",
        why: "Make useful meeting patterns easier to recognize and repeat.",
        arrivalSignals: ["Avery names two conditions that make meetings useful."],
      }),
      "suggestion-useful-meeting-open-v1",
    ),
  );

  const deliveredForReceipt = deliver(
    schedule(
      createDraft("suggestion-monday-acknowledged", {
        destination: "Try a shorter Monday planning routine",
        why: "Begin the week with enough structure without creating pressure.",
        arrivalSignals: ["Monday planning takes fifteen minutes or less."],
      }),
      "suggestion-monday-acknowledged-v1",
    ),
  );
  const acknowledged = requireState(
    acknowledgeSuggestedWaypoint(deliveredForReceipt, {
      versionId: "suggestion-monday-acknowledged-v1",
      nowMs: GUIDE_SUGGESTED_WAYPOINT_FIXTURE_NOW_MS + 600_000,
    }),
  );

  return Object.freeze({ draft, pending, open, acknowledged });
}
