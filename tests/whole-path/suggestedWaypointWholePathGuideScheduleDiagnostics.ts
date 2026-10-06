export const SUGGESTED_WAYPOINT_GUIDE_SCHEDULE_PULL_BACK_RESCHEDULE_FAILURE_REASONS =
  Object.freeze([
    "schedule_heading_timeout",
    "schedule_completed_heading_missing",
    "schedule_detail_refresh_failed",
    "schedule_detail_not_updated",
    "schedule_policy_unavailable",
    "schedule_command_failed",
    "schedule_unavailable",
    "schedule_stale",
    "schedule_invalid_transition",
    "schedule_operation_conflict",
    "schedule_unconfirmed",
    "schedule_transport_uncertain",
    "schedule_not_started",
    "schedule_status_unrecognized",
    "pull_back_heading_timeout",
    "pull_back_completed_heading_missing",
    "pull_back_detail_refresh_failed",
    "pull_back_detail_not_updated",
    "pull_back_too_late",
    "pull_back_command_failed",
    "pull_back_unavailable",
    "pull_back_stale",
    "pull_back_invalid_transition",
    "pull_back_operation_conflict",
    "pull_back_unconfirmed",
    "pull_back_transport_uncertain",
    "pull_back_not_started",
    "pull_back_status_unrecognized",
    "reschedule_heading_timeout",
    "reschedule_completed_heading_missing",
    "reschedule_detail_refresh_failed",
    "reschedule_detail_not_updated",
    "reschedule_policy_unavailable",
    "reschedule_command_failed",
    "reschedule_unavailable",
    "reschedule_stale",
    "reschedule_invalid_transition",
    "reschedule_operation_conflict",
    "reschedule_unconfirmed",
    "reschedule_transport_uncertain",
    "reschedule_not_started",
    "reschedule_status_unrecognized",
    "pending_selector_mismatch",
  ] as const);

export type SuggestedWaypointGuideSchedulePullBackRescheduleFailureReason =
  (typeof SUGGESTED_WAYPOINT_GUIDE_SCHEDULE_PULL_BACK_RESCHEDULE_FAILURE_REASONS)[number];

export type SuggestedWaypointGuideSchedulePullBackRescheduleCheck =
  | "schedule"
  | "pull_back"
  | "reschedule";

type GuideCommandLabel = "Schedule send" | "Pull Back";

type GuideCommandStatusClass =
  | "heading_timeout"
  | "completed_heading_missing"
  | "detail_refresh_failed"
  | "detail_not_updated"
  | "policy_unavailable"
  | "too_late"
  | "command_failed"
  | "unavailable"
  | "stale"
  | "invalid_transition"
  | "operation_conflict"
  | "unconfirmed"
  | "transport_uncertain"
  | "not_started";

type GuideCommandCheckOwner = Readonly<{
  label: GuideCommandLabel;
  unrecognized: SuggestedWaypointGuideSchedulePullBackRescheduleFailureReason;
  classes: Readonly<
    Partial<
      Record<
        GuideCommandStatusClass,
        SuggestedWaypointGuideSchedulePullBackRescheduleFailureReason
      >
    >
  >;
}>;

// Fixed action-status wording of src/components/solmind/GuideSuggestedWaypointDetail.tsx
// (beginCommand, runCommand, commandResultNotice, settleAfterConclusive, startSchedule,
// and startPullBack). Only the class leaves this module; the page text never does.
function guideCommandStatusWording(
  label: GuideCommandLabel,
): ReadonlyMap<string, GuideCommandStatusClass> {
  const wording: Array<readonly [string, GuideCommandStatusClass]> = [
    [`Submitting ${label}.`, "heading_timeout"],
    [`${label} was accepted. Refreshing the authoritative suggestion detail.`, "heading_timeout"],
    [`${label} could not be started. Nothing was changed.`, "not_started"],
    [`${label} could not be prepared. Nothing was changed.`, "not_started"],
    [`SolMind could not confirm whether ${label} completed. Check current status before retrying the exact same request.`, "transport_uncertain"],
    [`${label} is unavailable in the current Guide workspace.`, "unavailable"],
    [`${label} could not be completed. Checking the current suggestion detail.`, "command_failed"],
    [`The suggestion changed before ${label} completed. Review the refreshed detail.`, "stale"],
    [`${label} no longer applies to the current suggestion state.`, "invalid_transition"],
    [`A different request already used this ${label} operation. Review the refreshed detail.`, "operation_conflict"],
    [`${label} could not be confirmed. Review the authoritative detail.`, "unconfirmed"],
  ];
  if (label === "Schedule send") {
    wording.push(
      ["Schedule send could not use the current send policy.", "policy_unavailable"],
      ["Schedule send completed. The authoritative suggestion status is updated.", "completed_heading_missing"],
      ["Schedule send was accepted, but current status could not be confirmed. Load the detail again; do not submit Schedule send again.", "detail_refresh_failed"],
      ["Schedule send was accepted, but the pending state is not visible yet. Refresh the authoritative detail again.", "detail_not_updated"],
    );
  } else {
    wording.push(
      ["The Pull Back period ended before the command reached the server.", "too_late"],
      ["Pull Back completed. The Guide-only draft is ready to review and edit.", "completed_heading_missing"],
      ["Pull Back was accepted, but current detail could not be refreshed. Load the detail again; do not submit Pull Back again.", "detail_refresh_failed"],
      ["Pull Back was accepted. Refresh the detail again if the current state has not appeared yet.", "detail_not_updated"],
    );
  }
  return new Map(wording);
}

const GUIDE_COMMAND_STATUS_WORDING: Readonly<
  Record<GuideCommandLabel, ReadonlyMap<string, GuideCommandStatusClass>>
> = Object.freeze({
  "Schedule send": guideCommandStatusWording("Schedule send"),
  "Pull Back": guideCommandStatusWording("Pull Back"),
});

const GUIDE_COMMAND_CHECK_OWNERS: Readonly<
  Record<SuggestedWaypointGuideSchedulePullBackRescheduleCheck, GuideCommandCheckOwner>
> = Object.freeze({
  schedule: Object.freeze({
    label: "Schedule send",
    unrecognized: "schedule_status_unrecognized",
    classes: Object.freeze({
      heading_timeout: "schedule_heading_timeout",
      completed_heading_missing: "schedule_completed_heading_missing",
      detail_refresh_failed: "schedule_detail_refresh_failed",
      detail_not_updated: "schedule_detail_not_updated",
      policy_unavailable: "schedule_policy_unavailable",
      command_failed: "schedule_command_failed",
      unavailable: "schedule_unavailable",
      stale: "schedule_stale",
      invalid_transition: "schedule_invalid_transition",
      operation_conflict: "schedule_operation_conflict",
      unconfirmed: "schedule_unconfirmed",
      transport_uncertain: "schedule_transport_uncertain",
      not_started: "schedule_not_started",
    }),
  }),
  pull_back: Object.freeze({
    label: "Pull Back",
    unrecognized: "pull_back_status_unrecognized",
    classes: Object.freeze({
      heading_timeout: "pull_back_heading_timeout",
      completed_heading_missing: "pull_back_completed_heading_missing",
      detail_refresh_failed: "pull_back_detail_refresh_failed",
      detail_not_updated: "pull_back_detail_not_updated",
      too_late: "pull_back_too_late",
      command_failed: "pull_back_command_failed",
      unavailable: "pull_back_unavailable",
      stale: "pull_back_stale",
      invalid_transition: "pull_back_invalid_transition",
      operation_conflict: "pull_back_operation_conflict",
      unconfirmed: "pull_back_unconfirmed",
      transport_uncertain: "pull_back_transport_uncertain",
      not_started: "pull_back_not_started",
    }),
  }),
  reschedule: Object.freeze({
    label: "Schedule send",
    unrecognized: "reschedule_status_unrecognized",
    classes: Object.freeze({
      heading_timeout: "reschedule_heading_timeout",
      completed_heading_missing: "reschedule_completed_heading_missing",
      detail_refresh_failed: "reschedule_detail_refresh_failed",
      detail_not_updated: "reschedule_detail_not_updated",
      policy_unavailable: "reschedule_policy_unavailable",
      command_failed: "reschedule_command_failed",
      unavailable: "reschedule_unavailable",
      stale: "reschedule_stale",
      invalid_transition: "reschedule_invalid_transition",
      operation_conflict: "reschedule_operation_conflict",
      unconfirmed: "reschedule_unconfirmed",
      transport_uncertain: "reschedule_transport_uncertain",
      not_started: "reschedule_not_started",
    }),
  }),
});

function isGuideCommandCheck(
  value: unknown,
): value is SuggestedWaypointGuideSchedulePullBackRescheduleCheck {
  return value === "schedule" || value === "pull_back" || value === "reschedule";
}

export function classifySuggestedWaypointGuideSchedulePullBackRescheduleStatus(
  check: SuggestedWaypointGuideSchedulePullBackRescheduleCheck,
  statusTexts: unknown,
): SuggestedWaypointGuideSchedulePullBackRescheduleFailureReason | null {
  if (!isGuideCommandCheck(check)) return null;
  const owner = GUIDE_COMMAND_CHECK_OWNERS[check];
  try {
    if (!Array.isArray(statusTexts)) return owner.unrecognized;
    const wording = GUIDE_COMMAND_STATUS_WORDING[owner.label];
    for (const text of statusTexts) {
      if (typeof text !== "string") continue;
      const statusClass = wording.get(text.trim());
      if (statusClass === undefined) continue;
      return owner.classes[statusClass] ?? owner.unrecognized;
    }
    return owner.unrecognized;
  } catch {
    return owner.unrecognized;
  }
}

export class SuggestedWaypointGuideSchedulePullBackRescheduleFailure extends Error {
  readonly reason: SuggestedWaypointGuideSchedulePullBackRescheduleFailureReason | null;

  constructor(reason: unknown) {
    super("whole_path_guide_schedule_pull_back_reschedule_failed");
    this.name = "SuggestedWaypointGuideSchedulePullBackRescheduleFailure";
    this.reason =
      typeof reason === "string" &&
      SUGGESTED_WAYPOINT_GUIDE_SCHEDULE_PULL_BACK_RESCHEDULE_FAILURE_REASONS.includes(
        reason as SuggestedWaypointGuideSchedulePullBackRescheduleFailureReason,
      )
        ? (reason as SuggestedWaypointGuideSchedulePullBackRescheduleFailureReason)
        : null;
  }
}
