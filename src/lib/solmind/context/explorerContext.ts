// SolMind MVP0 Explorer-facing context exclusion helpers.
//
// Purpose:
//   - decide deterministically whether a piece of content may enter
//     Explorer-facing AI prompt context (the SolMind Virtual Guide)
//   - exclude Guide-only / private, safety, trigger, and escalation content
//   - exclude reflections that are not confirmed and unpaused
//   - exclude summaries that are not approved and Explorer-visible
//
// These helpers are pure, deterministic, and deny-by-default. They make no
// database, AI provider, or network calls. The string values mirror the
// canonical schema constraints:
//   - content.reflection.confirmation_status / .visibility
//   - content.summary.summary_type / .summary_status / .visibility
//
// Explorer-facing summary inclusion is an explicit allowlist of summary types,
// not "everything that is not safety/trigger". Any summary type that is not on
// the allowlist (including guide_prep, safety, and trigger_pattern) is excluded.

// --- Reflection vocabulary (mirrors content.reflection) ---

export type SolMindReflectionConfirmationStatus =
  | "proposed"
  | "confirmed"
  | "rejected"
  | "superseded"
  | "archived";

export type SolMindReflectionVisibility =
  | "explorer_and_guide"
  | "paused_from_ai_context";

export type SolMindReflectionContextInput = {
  confirmationStatus: SolMindReflectionConfirmationStatus;
  visibility: SolMindReflectionVisibility;
};

// --- Summary vocabulary (mirrors content.summary) ---

export type SolMindSummaryType =
  | "guide_prep"
  | "check_in"
  | "reflection"
  | "session"
  | "safety"
  | "trigger_pattern"
  | "general";

export type SolMindSummaryStatus =
  | "draft"
  | "ready_for_review"
  | "approved"
  | "rejected"
  | "archived";

export type SolMindSummaryVisibility =
  | "guide_only"
  | "admin_qa"
  | "explorer_visible_after_approval";

export type SolMindSummaryContextInput = {
  summaryType: SolMindSummaryType;
  summaryStatus: SolMindSummaryStatus;
  visibility: SolMindSummaryVisibility;
};

// Explicit allowlist of summary types that may become Explorer-facing for MVP0.
// guide_prep is intentionally excluded: it is Guide preparation content, not
// Explorer-facing content. safety and trigger_pattern are excluded by omission.
export const SOLMIND_SUMMARY_TYPES_EXPLORER_VISIBLE_AFTER_APPROVAL: ReadonlySet<SolMindSummaryType> =
  new Set(["check_in", "reflection", "session", "general"]);

// Content kinds that are always excluded from Explorer-facing context. These
// are existing Guide/Admin/safety review artifacts with canonical schema tables
// (content.trigger_observation, content.safety_flag, content.escalation_record).
// No speculative guide-private content kind is invented here; any future
// guide-private content is denied by the deny-by-default behavior of
// isExplorerFacingContextItemAllowed until it is explicitly modeled.
export const SOLMIND_EXPLORER_ALWAYS_EXCLUDED_CONTENT_KINDS = [
  "trigger_observation",
  "safety_flag",
  "escalation_record",
] as const;

export type SolMindExplorerAlwaysExcludedContentKind =
  (typeof SOLMIND_EXPLORER_ALWAYS_EXCLUDED_CONTENT_KINDS)[number];

const ALWAYS_EXCLUDED_KINDS: ReadonlySet<string> = new Set(
  SOLMIND_EXPLORER_ALWAYS_EXCLUDED_CONTENT_KINDS,
);

export function isAlwaysExcludedFromExplorerContext(
  contentKind: string,
): boolean {
  return ALWAYS_EXCLUDED_KINDS.has(contentKind);
}

// A reflection may enter Explorer-facing context only when it is confirmed and
// its visibility is explorer_and_guide. Proposed, rejected, superseded, and
// archived reflections are excluded, as are confirmed-but-paused reflections.
export function isReflectionExplorerVisible(
  reflection: SolMindReflectionContextInput,
): boolean {
  return (
    reflection.confirmationStatus === "confirmed" &&
    reflection.visibility === "explorer_and_guide"
  );
}

// A summary may enter Explorer-facing context only when its type is on the
// Explorer-visible allowlist, its status is approved, and its visibility is
// explorer_visible_after_approval. Everything else is excluded.
export function isSummaryExplorerVisible(
  summary: SolMindSummaryContextInput,
): boolean {
  if (
    !SOLMIND_SUMMARY_TYPES_EXPLORER_VISIBLE_AFTER_APPROVAL.has(
      summary.summaryType,
    )
  ) {
    return false;
  }

  return (
    summary.summaryStatus === "approved" &&
    summary.visibility === "explorer_visible_after_approval"
  );
}

// Unified, deny-by-default candidate for Explorer-facing context. Unknown
// kinds are excluded.
export type SolMindExplorerContextCandidate =
  | ({ kind: "reflection" } & SolMindReflectionContextInput)
  | ({ kind: "summary" } & SolMindSummaryContextInput)
  | { kind: SolMindExplorerAlwaysExcludedContentKind };

export function isExplorerFacingContextItemAllowed(
  candidate: SolMindExplorerContextCandidate,
): boolean {
  switch (candidate.kind) {
    case "reflection":
      return isReflectionExplorerVisible(candidate);
    case "summary":
      return isSummaryExplorerVisible(candidate);
    default:
      // Always-excluded kinds and any unrecognized kind are denied.
      return false;
  }
}
