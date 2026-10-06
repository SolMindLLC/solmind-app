import { describe, expect, it } from "vitest";

import {
  classifySuggestedWaypointGuideSchedulePullBackRescheduleStatus,
  SUGGESTED_WAYPOINT_GUIDE_SCHEDULE_PULL_BACK_RESCHEDULE_FAILURE_REASONS,
  SuggestedWaypointGuideSchedulePullBackRescheduleFailure,
  type SuggestedWaypointGuideSchedulePullBackRescheduleCheck,
} from "./suggestedWaypointWholePathGuideScheduleDiagnostics";

const SCHEDULE_WORDING = [
  ["Submitting Schedule send.", "heading_timeout"],
  ["Schedule send was accepted. Refreshing the authoritative suggestion detail.", "heading_timeout"],
  ["Schedule send completed. The authoritative suggestion status is updated.", "completed_heading_missing"],
  ["Schedule send was accepted, but current status could not be confirmed. Load the detail again; do not submit Schedule send again.", "detail_refresh_failed"],
  ["Schedule send was accepted, but the pending state is not visible yet. Refresh the authoritative detail again.", "detail_not_updated"],
  ["Schedule send could not use the current send policy.", "policy_unavailable"],
  ["Schedule send could not be completed. Checking the current suggestion detail.", "command_failed"],
  ["Schedule send is unavailable in the current Guide workspace.", "unavailable"],
  ["The suggestion changed before Schedule send completed. Review the refreshed detail.", "stale"],
  ["Schedule send no longer applies to the current suggestion state.", "invalid_transition"],
  ["A different request already used this Schedule send operation. Review the refreshed detail.", "operation_conflict"],
  ["Schedule send could not be confirmed. Review the authoritative detail.", "unconfirmed"],
  ["SolMind could not confirm whether Schedule send completed. Check current status before retrying the exact same request.", "transport_uncertain"],
  ["Schedule send could not be started. Nothing was changed.", "not_started"],
  ["Schedule send could not be prepared. Nothing was changed.", "not_started"],
] as const;

const PULL_BACK_WORDING = [
  ["Submitting Pull Back.", "heading_timeout"],
  ["Pull Back was accepted. Refreshing the authoritative suggestion detail.", "heading_timeout"],
  ["Pull Back completed. The Guide-only draft is ready to review and edit.", "completed_heading_missing"],
  ["Pull Back was accepted, but current detail could not be refreshed. Load the detail again; do not submit Pull Back again.", "detail_refresh_failed"],
  ["Pull Back was accepted. Refresh the detail again if the current state has not appeared yet.", "detail_not_updated"],
  ["The Pull Back period ended before the command reached the server.", "too_late"],
  ["Pull Back could not be completed. Checking the current suggestion detail.", "command_failed"],
  ["Pull Back is unavailable in the current Guide workspace.", "unavailable"],
  ["The suggestion changed before Pull Back completed. Review the refreshed detail.", "stale"],
  ["Pull Back no longer applies to the current suggestion state.", "invalid_transition"],
  ["A different request already used this Pull Back operation. Review the refreshed detail.", "operation_conflict"],
  ["Pull Back could not be confirmed. Review the authoritative detail.", "unconfirmed"],
  ["SolMind could not confirm whether Pull Back completed. Check current status before retrying the exact same request.", "transport_uncertain"],
  ["Pull Back could not be started. Nothing was changed.", "not_started"],
  ["Pull Back could not be prepared. Nothing was changed.", "not_started"],
] as const;

const CASES: ReadonlyArray<
  readonly [SuggestedWaypointGuideSchedulePullBackRescheduleCheck, string, string]
> = [
  ...SCHEDULE_WORDING.map(([text, statusClass]) => ["schedule", text, `schedule_${statusClass}`] as const),
  ...PULL_BACK_WORDING.map(([text, statusClass]) => ["pull_back", text, `pull_back_${statusClass}`] as const),
  ...SCHEDULE_WORDING.map(([text, statusClass]) => ["reschedule", text, `reschedule_${statusClass}`] as const),
];

function classify(
  check: SuggestedWaypointGuideSchedulePullBackRescheduleCheck,
  statusTexts: unknown,
) {
  return classifySuggestedWaypointGuideSchedulePullBackRescheduleStatus(
    check,
    statusTexts,
  );
}

describe("Suggested Waypoint Guide schedule/Pull Back/reschedule diagnostics", () => {
  it.each(CASES)(
    "classifies the %s check's fixed action status %j",
    (check, text, reason) => {
      expect(classify(check, ["Suggestion detail loaded.", text])).toBe(reason);
    },
  );

  it("reaches exactly the closed reason set", () => {
    const reached = new Set<string>(CASES.map(([, , reason]) => reason));
    for (const check of ["schedule", "pull_back", "reschedule"] as const) {
      reached.add(`${check}_status_unrecognized`);
    }
    reached.add("pending_selector_mismatch");
    expect([...reached].sort()).toEqual(
      [...SUGGESTED_WAYPOINT_GUIDE_SCHEDULE_PULL_BACK_RESCHEDULE_FAILURE_REASONS].sort(),
    );
    expect(SUGGESTED_WAYPOINT_GUIDE_SCHEDULE_PULL_BACK_RESCHEDULE_FAILURE_REASONS).toHaveLength(43);
  });

  it.each([
    ["schedule", ["Suggestion detail loaded.", "Draft changes saved and confirmed from the authoritative detail."]],
    ["pull_back", ["Schedule send completed. The authoritative suggestion status is updated."]],
    ["pull_back", ["Schedule send could not use the current send policy."]],
    ["reschedule", ["Pull Back completed. The Guide-only draft is ready to review and edit."]],
    ["schedule", ["The Pull Back period ended before the command reached the server."]],
    ["schedule", ["Schedule send could not use the current send policy. protected-extra"]],
    ["pull_back", ["pull back is unavailable in the current guide workspace."]],
    ["schedule", []],
  ] as const)(
    "maps %s check leftover, cross-check, near-match, or absent wording to its unrecognized reason",
    (check, texts) => {
      expect(classify(check, texts)).toBe(`${check}_status_unrecognized`);
    },
  );

  it("matches only after trimming surrounding whitespace", () => {
    expect(
      classify("pull_back", ["  The Pull Back period ended before the command reached the server.\n"]),
    ).toBe("pull_back_too_late");
  });

  it("collapses malformed and hostile status reads to the check's unrecognized reason", () => {
    const hostileArray = new Proxy(["Submitting Schedule send."], {
      get(target, property, receiver) {
        if (property === Symbol.iterator) throw new Error("protected status detail");
        return Reflect.get(target, property, receiver);
      },
    });
    for (const value of [
      null,
      undefined,
      "Submitting Schedule send.",
      { 0: "Submitting Schedule send.", length: 1 },
      [42, null, { text: "Submitting Schedule send." }],
      hostileArray,
    ]) {
      expect(classify("schedule", value)).toBe("schedule_status_unrecognized");
    }
  });

  it("returns no subclass for an unknown check", () => {
    expect(
      classify(
        "protected-check" as SuggestedWaypointGuideSchedulePullBackRescheduleCheck,
        ["Submitting Schedule send."],
      ),
    ).toBeNull();
  });

  it("keeps a listed reason and drops an arbitrary constructor reason", () => {
    const listed = new SuggestedWaypointGuideSchedulePullBackRescheduleFailure(
      "pull_back_too_late",
    );
    expect(listed.message).toBe("whole_path_guide_schedule_pull_back_reschedule_failed");
    expect(listed.reason).toBe("pull_back_too_late");
    expect(listed.cause).toBeUndefined();
    for (const value of ["protected-arbitrary-reason", "heading_timeout", null, 7, {}]) {
      const failure = new SuggestedWaypointGuideSchedulePullBackRescheduleFailure(value);
      expect(failure.message).toBe("whole_path_guide_schedule_pull_back_reschedule_failed");
      expect(failure.reason).toBeNull();
    }
  });
});
