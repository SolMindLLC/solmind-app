import {
  SUGGESTED_WAYPOINT_GUIDE_LIST_DENIED,
  SUGGESTED_WAYPOINT_GUIDE_LIST_FAILED,
  parseSuggestedWaypointGuideListBrowserResult,
} from "@/lib/solmind/suggestedWaypointGuideListBrowserContract";
import { SUGGESTED_WAYPOINT_REFRESH_REQUIRED } from "@/lib/solmind/suggestedWaypointPaginationSharedContract";

export const SUGGESTED_WAYPOINT_GUIDE_RELATIONSHIP_ENTRY_FAILURE_REASONS =
  Object.freeze([
    "request_failed",
    "http_failed",
    "response_parse_failed",
    "response_contract_failed",
    "relationship_denied",
    "relationship_failed",
    "refresh_required",
    "unexpected_existing_suggestions",
    "ui_projection_failed",
  ] as const);

export type SuggestedWaypointGuideRelationshipEntryFailureReason =
  (typeof SUGGESTED_WAYPOINT_GUIDE_RELATIONSHIP_ENTRY_FAILURE_REASONS)[number];

export type SuggestedWaypointGuideRelationshipEntryRequestResult =
  | Readonly<{ kind: "request_failed" }>
  | Readonly<{ kind: "http_failed" }>
  | Readonly<{ kind: "response_parse_failed" }>
  | Readonly<{ kind: "response"; value: unknown }>;

export type SuggestedWaypointGuideRelationshipEntryDiagnostic =
  | Readonly<{ status: "ready" }>
  | Readonly<{
      status: "failed";
      reason: SuggestedWaypointGuideRelationshipEntryFailureReason;
    }>;

function failed(
  reason: SuggestedWaypointGuideRelationshipEntryFailureReason,
): SuggestedWaypointGuideRelationshipEntryDiagnostic {
  return Object.freeze({ status: "failed", reason });
}

export function classifySuggestedWaypointGuideRelationshipEntryResult(
  requestResult: SuggestedWaypointGuideRelationshipEntryRequestResult,
): SuggestedWaypointGuideRelationshipEntryDiagnostic {
  try {
    if (requestResult.kind !== "response") {
      return failed(requestResult.kind);
    }
    const result = parseSuggestedWaypointGuideListBrowserResult(
      requestResult.value,
    );
    if (result === null) return failed("response_contract_failed");
    if (!result.ok) {
      if (result.error === SUGGESTED_WAYPOINT_GUIDE_LIST_DENIED) {
        return failed("relationship_denied");
      }
      if (result.error === SUGGESTED_WAYPOINT_GUIDE_LIST_FAILED) {
        return failed("relationship_failed");
      }
      if (result.error === SUGGESTED_WAYPOINT_REFRESH_REQUIRED) {
        return failed("refresh_required");
      }
      return failed("response_contract_failed");
    }
    if (
      result.data.items.length !== 0 ||
      result.data.total_count !== 0 ||
      result.data.next_cursor !== null
    ) {
      return failed("unexpected_existing_suggestions");
    }
    return Object.freeze({ status: "ready" });
  } catch {
    return failed("response_contract_failed");
  }
}

export class SuggestedWaypointGuideRelationshipEntryFailure extends Error {
  readonly reason: SuggestedWaypointGuideRelationshipEntryFailureReason;

  constructor(reason: unknown) {
    super("whole_path_guide_relationship_entry_failed");
    this.name = "SuggestedWaypointGuideRelationshipEntryFailure";
    this.reason =
      typeof reason === "string" &&
      SUGGESTED_WAYPOINT_GUIDE_RELATIONSHIP_ENTRY_FAILURE_REASONS.includes(
        reason as SuggestedWaypointGuideRelationshipEntryFailureReason,
      )
        ? (reason as SuggestedWaypointGuideRelationshipEntryFailureReason)
        : "response_contract_failed";
  }
}
