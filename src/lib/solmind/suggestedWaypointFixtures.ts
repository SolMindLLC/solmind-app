import {
  createSuggestedWaypointDraft,
  deliverPendingSuggestedWaypoint,
  scheduleSuggestedWaypointSend,
  type SuggestedWaypointResult,
  type SuggestedWaypointState,
} from "./suggestedWaypoints";

export const SUGGESTED_WAYPOINT_FIXTURE_NOW_MS = Date.UTC(
  2026,
  7,
  12,
  18,
  0,
  0,
);

export type SuggestedWaypointPossibleConnectionObservation = Readonly<{
  id: string;
  suggestionVersionId: string;
  source: "virtual-guide";
  assistantDisplayName: string;
  candidateWaypointIds: readonly string[];
  observedAtMs: number;
}>;

export type ExplorerSuggestedWaypointFixture = Readonly<{
  state: SuggestedWaypointState;
  possibleConnection: SuggestedWaypointPossibleConnectionObservation;
}>;

const requireState = (result: SuggestedWaypointResult): SuggestedWaypointState => {
  if (result.kind === "rejected") {
    throw new Error(`Invalid Suggested Waypoint fixture: ${result.code}`);
  }
  return result.state;
};

export function createDeliveredSuggestedWaypointFixture(): SuggestedWaypointState {
  const draft = createSuggestedWaypointDraft({
    suggestionId: "suggestion-recovery-evening",
    guideUserId: "guide-morgan",
    explorerUserId: "explorer-avery",
    relationshipId: "relationship-avery-morgan",
    content: {
      destination: "Protect one evening each week for recovery",
      why: "Create dependable room to recover without adding pressure elsewhere.",
      arrivalSignals: ["One evening stays unscheduled."],
    },
  });
  const pending = requireState(
    scheduleSuggestedWaypointSend(draft, {
      operationId: "fixture-schedule-recovery-evening",
      versionId: "suggestion-recovery-evening-v1",
      expectedRevision: 1,
      nowMs: SUGGESTED_WAYPOINT_FIXTURE_NOW_MS,
      policyVersion: "fixture-policy-v1",
      timing: {
        minimumSeconds: 60,
        defaultSeconds: 300,
        maximumSeconds: 3600,
      },
    }),
  );

  return requireState(
    deliverPendingSuggestedWaypoint(pending, {
      operationId: "fixture-deliver-recovery-evening",
      nowMs: SUGGESTED_WAYPOINT_FIXTURE_NOW_MS + 300_000,
    }),
  );
}

export function createExplorerSuggestedWaypointFixture(): ExplorerSuggestedWaypointFixture {
  const state = createDeliveredSuggestedWaypointFixture();
  return Object.freeze({
    state,
    possibleConnection: Object.freeze({
      id: "possible-connection-recovery-evening",
      suggestionVersionId: "suggestion-recovery-evening-v1",
      source: "virtual-guide",
      assistantDisplayName: "Mary",
      candidateWaypointIds: Object.freeze([
        "waypoint-protect-tuesday-evening",
        "waypoint-end-workday-gently",
      ]),
      observedAtMs: SUGGESTED_WAYPOINT_FIXTURE_NOW_MS + 360_000,
    }),
  });
}
