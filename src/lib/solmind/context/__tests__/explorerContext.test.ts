import { describe, expect, it } from "vitest";

import {
  SOLMIND_EXPLORER_ALWAYS_EXCLUDED_CONTENT_KINDS,
  SOLMIND_GUIDE_EXPLORER_RELATIONSHIP_STATUSES,
  SOLMIND_SUMMARY_PUBLICATION_STATUSES,
  SOLMIND_SUMMARY_REVISION_STATUSES,
  SOLMIND_SUMMARY_SECTION_TYPES,
  SOLMIND_SUMMARY_SECTION_VISIBILITIES,
  SOLMIND_SUMMARY_STATUSES,
  SOLMIND_SUMMARY_TYPES,
  isAlwaysExcludedFromExplorerContext,
  isExplorerFacingContextItemAllowed,
  isReflectionExplorerVisible,
  isSummaryExplorerVisible,
  type SolMindReflectionConfirmationStatus,
  type SolMindReflectionContextInput,
  type SolMindReflectionVisibility,
  type SolMindSummaryContextInput,
} from "../explorerContext";

const REFLECTION_STATUSES: ReadonlyArray<SolMindReflectionConfirmationStatus> = [
  "proposed",
  "confirmed",
  "rejected",
  "superseded",
  "archived",
];

const REFLECTION_VISIBILITIES: ReadonlyArray<SolMindReflectionVisibility> = [
  "explorer_and_guide",
  "paused_from_ai_context",
];

describe("Explorer-facing reflection inclusion", () => {
  // Only confirmed + explorer_and_guide is allowed.
  const reflectionCases: ReadonlyArray<{
    input: SolMindReflectionContextInput;
    allowed: boolean;
    reason: string;
  }> = [
    {
      input: {
        confirmationStatus: "confirmed",
        visibility: "explorer_and_guide",
      },
      allowed: true,
      reason: "confirmed + explorer_and_guide is allowed",
    },
    {
      input: {
        confirmationStatus: "proposed",
        visibility: "explorer_and_guide",
      },
      allowed: false,
      reason: "proposed is blocked",
    },
    {
      input: {
        confirmationStatus: "rejected",
        visibility: "explorer_and_guide",
      },
      allowed: false,
      reason: "rejected is blocked",
    },
    {
      input: {
        confirmationStatus: "superseded",
        visibility: "explorer_and_guide",
      },
      allowed: false,
      reason: "superseded is blocked",
    },
    {
      input: {
        confirmationStatus: "archived",
        visibility: "explorer_and_guide",
      },
      allowed: false,
      reason: "archived is blocked",
    },
    {
      input: {
        confirmationStatus: "confirmed",
        visibility: "paused_from_ai_context",
      },
      allowed: false,
      reason: "confirmed + paused_from_ai_context is blocked",
    },
  ];

  for (const { input, allowed, reason } of reflectionCases) {
    it(reason, () => {
      expect(isReflectionExplorerVisible(input)).toBe(allowed);
      expect(
        isExplorerFacingContextItemAllowed({ kind: "reflection", ...input }),
      ).toBe(allowed);
    });
  }

  it("allows exactly one reflection state across the full matrix", () => {
    for (const confirmationStatus of REFLECTION_STATUSES) {
      for (const visibility of REFLECTION_VISIBILITIES) {
        const allowed = isReflectionExplorerVisible({
          confirmationStatus,
          visibility,
        });
        expect(allowed).toBe(
          confirmationStatus === "confirmed" &&
            visibility === "explorer_and_guide",
        );
      }
    }
  });
});

function publishedSummary(
  overrides: Partial<SolMindSummaryContextInput> = {},
): SolMindSummaryContextInput {
  return {
    summaryType: "explorer_facing_summary",
    summaryStatus: "published",
    publicationStatus: "published",
    relationshipStatus: "active",
    revisionStatus: "published_to_explorer",
    sectionType: "explorer_facing",
    sectionVisibility: "published_to_explorer",
    ...overrides,
  };
}

describe("Explorer-facing summary inclusion", () => {
  const summaryCases: ReadonlyArray<{
    input: SolMindSummaryContextInput;
    allowed: boolean;
    reason: string;
  }> = [
    {
      input: publishedSummary(),
      allowed: true,
      reason: "the exact published Explorer projection is allowed",
    },
    {
      input: publishedSummary({ summaryStatus: "approved" }),
      allowed: false,
      reason: "an approved but unpublished Summary container is blocked",
    },
    {
      input: publishedSummary({ publicationStatus: "unpublished" }),
      allowed: false,
      reason: "an unpublished publication is blocked",
    },
    {
      input: publishedSummary({ publicationStatus: "superseded" }),
      allowed: false,
      reason: "a superseded publication is blocked",
    },
    {
      input: publishedSummary({ relationshipStatus: "ended" }),
      allowed: false,
      reason: "an ended Guide-Explorer relationship is blocked",
    },
    {
      input: publishedSummary({ revisionStatus: "guide_approved" }),
      allowed: false,
      reason: "a Guide-approved but unpublished revision is blocked",
    },
    {
      input: publishedSummary({ sectionType: "guide_only" }),
      allowed: false,
      reason: "a Guide-only section is blocked",
    },
    {
      input: publishedSummary({ sectionType: "sensitive_observation" }),
      allowed: false,
      reason: "a sensitive-observation section is blocked",
    },
    {
      input: publishedSummary({ sectionType: "trigger_observation" }),
      allowed: false,
      reason: "a trigger-observation section is blocked",
    },
    {
      input: publishedSummary({ sectionType: "safety_review" }),
      allowed: false,
      reason: "a safety-review section is blocked",
    },
    {
      input: publishedSummary({
        sectionVisibility: "explorer_publishable",
      }),
      allowed: false,
      reason: "an Explorer-publishable but unpublished section is blocked",
    },
  ];

  for (const { input, allowed, reason } of summaryCases) {
    it(reason, () => {
      expect(isSummaryExplorerVisible(input)).toBe(allowed);
      expect(
        isExplorerFacingContextItemAllowed({ kind: "summary", ...input }),
      ).toBe(allowed);
    });
  }

  it("allows every canonical container type only through the same exact projection", () => {
    for (const summaryType of SOLMIND_SUMMARY_TYPES) {
      expect(isSummaryExplorerVisible(publishedSummary({ summaryType }))).toBe(
        true,
      );
    }
  });

  it("pins the closed source-current Summary publication vocabulary", () => {
    expect(SOLMIND_SUMMARY_TYPES).toEqual([
      "guide_summary",
      "pre_session_summary",
      "explorer_facing_summary",
    ]);
    expect(SOLMIND_SUMMARY_STATUSES).toEqual([
      "draft",
      "in_review",
      "approved",
      "published",
      "archived",
    ]);
    expect(SOLMIND_SUMMARY_PUBLICATION_STATUSES).toEqual([
      "published",
      "unpublished",
      "superseded",
    ]);
    expect(SOLMIND_SUMMARY_REVISION_STATUSES).toEqual([
      "ai_generated",
      "guide_edited",
      "ai_edited",
      "guide_approved",
      "published_to_explorer",
      "superseded",
    ]);
    expect(SOLMIND_SUMMARY_SECTION_TYPES).toEqual([
      "explorer_facing",
      "guide_only",
      "sensitive_observation",
      "trigger_observation",
      "safety_review",
    ]);
    expect(SOLMIND_SUMMARY_SECTION_VISIBILITIES).toEqual([
      "guide_only",
      "explorer_publishable",
      "published_to_explorer",
    ]);
    expect(SOLMIND_GUIDE_EXPLORER_RELATIONSHIP_STATUSES).toEqual([
      "invited",
      "intake_pending",
      "active",
      "paused",
      "ended",
      "transferred",
    ]);
    for (const vocabulary of [
      SOLMIND_SUMMARY_TYPES,
      SOLMIND_SUMMARY_STATUSES,
      SOLMIND_SUMMARY_PUBLICATION_STATUSES,
      SOLMIND_SUMMARY_REVISION_STATUSES,
      SOLMIND_SUMMARY_SECTION_TYPES,
      SOLMIND_SUMMARY_SECTION_VISIBILITIES,
      SOLMIND_GUIDE_EXPLORER_RELATIONSHIP_STATUSES,
    ]) {
      expect(Object.isFrozen(vocabulary)).toBe(true);
    }
  });

  it("permits only active or paused relationship states in an otherwise published projection", () => {
    for (const relationshipStatus of SOLMIND_GUIDE_EXPLORER_RELATIONSHIP_STATUSES) {
      expect(
        isSummaryExplorerVisible(publishedSummary({ relationshipStatus })),
      ).toBe(
        relationshipStatus === "active" || relationshipStatus === "paused",
      );
    }
  });
});

describe("Always-excluded Explorer context content", () => {
  for (const kind of SOLMIND_EXPLORER_ALWAYS_EXCLUDED_CONTENT_KINDS) {
    it(`${kind} is always excluded`, () => {
      expect(isAlwaysExcludedFromExplorerContext(kind)).toBe(true);
      expect(isExplorerFacingContextItemAllowed({ kind })).toBe(false);
    });
  }

  it("covers exactly the canonical safety/trigger/escalation review kinds", () => {
    expect(SOLMIND_EXPLORER_ALWAYS_EXCLUDED_CONTENT_KINDS).toEqual([
      "trigger_observation",
      "safety_flag",
      "escalation_record",
    ]);
  });

  it("does not treat reflections or summaries as always-excluded kinds", () => {
    expect(isAlwaysExcludedFromExplorerContext("reflection")).toBe(false);
    expect(isAlwaysExcludedFromExplorerContext("summary")).toBe(false);
  });

  it("denies unrecognized content kinds by default, including future guide-private content", () => {
    // No canonical guide-private note kind exists yet. Until one is explicitly
    // modeled, any such kind must be denied by the deny-by-default branch.
    for (const unknownKind of [
      "mystery_kind",
      "guide_private_note",
      "guide_note",
      "",
    ]) {
      expect(isAlwaysExcludedFromExplorerContext(unknownKind)).toBe(false);
      expect(
        isExplorerFacingContextItemAllowed({
          kind: unknownKind,
        } as unknown as Parameters<typeof isExplorerFacingContextItemAllowed>[0]),
      ).toBe(false);
    }
  });
});
