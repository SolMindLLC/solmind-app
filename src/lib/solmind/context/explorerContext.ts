// SolMind MVP0 Explorer-facing context exclusion helpers.
//
// Purpose:
//   - decide deterministically whether a piece of content may enter
//     Explorer-facing AI prompt context (the SolMind Virtual Guide)
//   - exclude Guide-only / private, safety, trigger, and escalation content
//   - exclude reflections that are not confirmed and unpaused
//   - exclude summaries that are not present in the exact published Explorer
//     projection
//
// These helpers are pure, deterministic, and deny-by-default. They make no
// database, AI provider, or network calls. The string values mirror the
// canonical schema constraints:
//   - content.reflection.confirmation_status / .visibility
//   - content.summary.summary_type / .summary_status
//   - content.summary_publication.publication_status
//   - content.summary_revision.revision_status
//   - content.summary_section.section_type / .visibility
//   - core.guide_explorer_relationship.relationship_status
//
// Explorer-facing Summary inclusion is established only by the complete,
// target-bound publication evidence. Container labels alone never authorize
// visibility.

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

// --- Summary publication vocabulary (mirrors the banked S02 foundation) ---

export const SOLMIND_SUMMARY_TYPES = Object.freeze([
  "guide_summary",
  "pre_session_summary",
  "explorer_facing_summary",
] as const);

export type SolMindSummaryType = (typeof SOLMIND_SUMMARY_TYPES)[number];

export const SOLMIND_SUMMARY_STATUSES = Object.freeze([
  "draft",
  "in_review",
  "approved",
  "published",
  "archived",
] as const);

export type SolMindSummaryStatus = (typeof SOLMIND_SUMMARY_STATUSES)[number];

export const SOLMIND_SUMMARY_PUBLICATION_STATUSES = Object.freeze([
  "published",
  "unpublished",
  "superseded",
] as const);

export type SolMindSummaryPublicationStatus =
  (typeof SOLMIND_SUMMARY_PUBLICATION_STATUSES)[number];

export const SOLMIND_SUMMARY_REVISION_STATUSES = Object.freeze([
  "ai_generated",
  "guide_edited",
  "ai_edited",
  "guide_approved",
  "published_to_explorer",
  "superseded",
] as const);

export type SolMindSummaryRevisionStatus =
  (typeof SOLMIND_SUMMARY_REVISION_STATUSES)[number];

export const SOLMIND_SUMMARY_SECTION_TYPES = Object.freeze([
  "explorer_facing",
  "guide_only",
  "sensitive_observation",
  "trigger_observation",
  "safety_review",
] as const);

export type SolMindSummarySectionType =
  (typeof SOLMIND_SUMMARY_SECTION_TYPES)[number];

export const SOLMIND_SUMMARY_SECTION_VISIBILITIES = Object.freeze([
  "guide_only",
  "explorer_publishable",
  "published_to_explorer",
] as const);

export type SolMindSummarySectionVisibility =
  (typeof SOLMIND_SUMMARY_SECTION_VISIBILITIES)[number];

export const SOLMIND_GUIDE_EXPLORER_RELATIONSHIP_STATUSES = Object.freeze([
  "invited",
  "intake_pending",
  "active",
  "paused",
  "ended",
  "transferred",
] as const);

export type SolMindGuideExplorerRelationshipStatus =
  (typeof SOLMIND_GUIDE_EXPLORER_RELATIONSHIP_STATUSES)[number];

export type SolMindSummaryContextInput = {
  summaryType: SolMindSummaryType;
  summaryStatus: SolMindSummaryStatus;
  publicationStatus: SolMindSummaryPublicationStatus;
  relationshipStatus: SolMindGuideExplorerRelationshipStatus;
  revisionStatus: SolMindSummaryRevisionStatus;
  sectionType: SolMindSummarySectionType;
  sectionVisibility: SolMindSummarySectionVisibility;
};

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

// A Summary may enter Explorer-facing context only through the exact
// target-bound published projection. The caller separately binds the candidate
// Explorer identifier to the authenticated Explorer. Container type or status
// alone is never sufficient.
export function isSummaryExplorerVisible(
  summary: SolMindSummaryContextInput,
): boolean {
  return (
    summary.summaryStatus === "published" &&
    summary.publicationStatus === "published" &&
    (summary.relationshipStatus === "active" ||
      summary.relationshipStatus === "paused") &&
    summary.revisionStatus === "published_to_explorer" &&
    summary.sectionType === "explorer_facing" &&
    summary.sectionVisibility === "published_to_explorer"
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
