import {
  parseSuggestedWaypointCommandBrowserResult,
  type SuggestedWaypointCommandExpectedOutcome,
} from "@/lib/solmind/suggestedWaypointCommandBrowserContract";

export const SUGGESTED_WAYPOINT_GUIDE_DRAFT_CREATE_FAILURE_REASONS =
  Object.freeze([
    "request_failed",
    "http_failed",
    "response_parse_failed",
    "response_contract_failed",
    "command_denied",
    "command_failed",
    "outcome_invalid_transition",
    "outcome_operation_conflict",
    "outcome_relationship_unavailable",
    "outcome_stale",
  ] as const);

export type SuggestedWaypointGuideDraftCreateFailureReason =
  (typeof SUGGESTED_WAYPOINT_GUIDE_DRAFT_CREATE_FAILURE_REASONS)[number];

export type SuggestedWaypointGuideDraftCreateRequestResult =
  | Readonly<{ kind: "request_failed" }>
  | Readonly<{ kind: "http_failed" }>
  | Readonly<{ kind: "response_parse_failed" }>
  | Readonly<{ kind: "response"; value: unknown }>;

export type SuggestedWaypointGuideDraftCreateDiagnostic =
  | Readonly<{ status: "created"; suggestedWaypointId: string }>
  | Readonly<{
      status: "failed";
      reason: SuggestedWaypointGuideDraftCreateFailureReason;
    }>;

const CREATE_DRAFT_EXPECTED_OUTCOMES = Object.freeze([
  "invalid_transition",
  "operation_conflict",
  "relationship_unavailable",
  "stale",
] as const satisfies readonly SuggestedWaypointCommandExpectedOutcome[]);

function failed(
  reason: SuggestedWaypointGuideDraftCreateFailureReason,
): SuggestedWaypointGuideDraftCreateDiagnostic {
  return Object.freeze({ status: "failed", reason });
}

export function classifySuggestedWaypointGuideDraftCreateResult(
  requestResult: SuggestedWaypointGuideDraftCreateRequestResult,
): SuggestedWaypointGuideDraftCreateDiagnostic {
  try {
    if (requestResult.kind !== "response") {
      return failed(requestResult.kind);
    }
    const result = parseSuggestedWaypointCommandBrowserResult(
      requestResult.value,
      CREATE_DRAFT_EXPECTED_OUTCOMES,
    );
    if (result === null) return failed("response_contract_failed");
    if (result.ok) {
      return Object.freeze({
        status: "created",
        suggestedWaypointId: result.suggestedWaypointId,
      });
    }
    if (result.error === "command_denied") return failed("command_denied");
    if (result.error === "command_failed") return failed("command_failed");
    switch (result.outcome) {
      case "invalid_transition":
      case "operation_conflict":
      case "relationship_unavailable":
      case "stale":
        return failed(`outcome_${result.outcome}`);
      default:
        return failed("response_contract_failed");
    }
  } catch {
    return failed("response_contract_failed");
  }
}

export class SuggestedWaypointGuideDraftCreateFailure extends Error {
  readonly reason: SuggestedWaypointGuideDraftCreateFailureReason;

  constructor(reason: unknown) {
    super("whole_path_guide_draft_create_failed");
    this.name = "SuggestedWaypointGuideDraftCreateFailure";
    this.reason =
      typeof reason === "string" &&
      SUGGESTED_WAYPOINT_GUIDE_DRAFT_CREATE_FAILURE_REASONS.includes(
        reason as SuggestedWaypointGuideDraftCreateFailureReason,
      )
        ? (reason as SuggestedWaypointGuideDraftCreateFailureReason)
        : "response_contract_failed";
  }
}
