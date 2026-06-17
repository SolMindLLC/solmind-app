import { describe, expect, it } from "vitest";

import {
  SOLMIND_EXPLORER_ALWAYS_EXCLUDED_CONTENT_KINDS,
  SOLMIND_SUMMARY_TYPES_EXPLORER_VISIBLE_AFTER_APPROVAL,
  isAlwaysExcludedFromExplorerContext,
  isExplorerFacingContextItemAllowed,
  isReflectionExplorerVisible,
  isSummaryExplorerVisible,
  type SolMindReflectionConfirmationStatus,
  type SolMindReflectionContextInput,
  type SolMindReflectionVisibility,
  type SolMindSummaryContextInput,
  type SolMindSummaryStatus,
  type SolMindSummaryType,
  type SolMindSummaryVisibility,
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

const ALL_SUMMARY_TYPES: ReadonlyArray<SolMindSummaryType> = [
  "guide_prep",
  "check_in",
  "reflection",
  "session",
  "safety",
  "trigger_pattern",
  "general",
];

const ALLOWED_EXPLORER_SUMMARY_TYPES: ReadonlyArray<SolMindSummaryType> = [
  "check_in",
  "reflection",
  "session",
  "general",
];

const BLOCKED_EXPLORER_SUMMARY_TYPES: ReadonlyArray<SolMindSummaryType> = [
  "guide_prep",
  "safety",
  "trigger_pattern",
];

const SUMMARY_STATUSES: ReadonlyArray<SolMindSummaryStatus> = [
  "draft",
  "ready_for_review",
  "approved",
  "rejected",
  "archived",
];

const SUMMARY_VISIBILITIES: ReadonlyArray<SolMindSummaryVisibility> = [
  "guide_only",
  "admin_qa",
  "explorer_visible_after_approval",
];

describe("Explorer-facing summary inclusion", () => {
  it("uses an explicit MVP0 allowlist of Explorer-visible summary types", () => {
    expect(
      [...SOLMIND_SUMMARY_TYPES_EXPLORER_VISIBLE_AFTER_APPROVAL].sort(),
    ).toEqual(["check_in", "general", "reflection", "session"]);
    // guide_prep, safety, and trigger_pattern are deliberately not on the list.
    expect(
      SOLMIND_SUMMARY_TYPES_EXPLORER_VISIBLE_AFTER_APPROVAL.has("guide_prep"),
    ).toBe(false);
    expect(
      SOLMIND_SUMMARY_TYPES_EXPLORER_VISIBLE_AFTER_APPROVAL.has("safety"),
    ).toBe(false);
    expect(
      SOLMIND_SUMMARY_TYPES_EXPLORER_VISIBLE_AFTER_APPROVAL.has(
        "trigger_pattern",
      ),
    ).toBe(false);
  });

  const summaryCases: ReadonlyArray<{
    input: SolMindSummaryContextInput;
    allowed: boolean;
    reason: string;
  }> = [
    {
      input: {
        summaryType: "general",
        summaryStatus: "approved",
        visibility: "explorer_visible_after_approval",
      },
      allowed: true,
      reason:
        "allowlisted general summary is allowed when approved + explorer_visible_after_approval",
    },
    {
      input: {
        summaryType: "guide_prep",
        summaryStatus: "approved",
        visibility: "explorer_visible_after_approval",
      },
      allowed: false,
      reason:
        "guide_prep is blocked even when approved + explorer_visible_after_approval",
    },
    {
      input: {
        summaryType: "general",
        summaryStatus: "approved",
        visibility: "guide_only",
      },
      allowed: false,
      reason: "guide_only visibility is blocked",
    },
    {
      input: {
        summaryType: "general",
        summaryStatus: "approved",
        visibility: "admin_qa",
      },
      allowed: false,
      reason: "admin_qa visibility is blocked",
    },
    {
      input: {
        summaryType: "safety",
        summaryStatus: "approved",
        visibility: "explorer_visible_after_approval",
      },
      allowed: false,
      reason: "safety summary is blocked",
    },
    {
      input: {
        summaryType: "trigger_pattern",
        summaryStatus: "approved",
        visibility: "explorer_visible_after_approval",
      },
      allowed: false,
      reason: "trigger_pattern summary is blocked",
    },
    {
      input: {
        summaryType: "general",
        summaryStatus: "draft",
        visibility: "explorer_visible_after_approval",
      },
      allowed: false,
      reason: "draft summary is blocked",
    },
    {
      input: {
        summaryType: "general",
        summaryStatus: "ready_for_review",
        visibility: "explorer_visible_after_approval",
      },
      allowed: false,
      reason: "ready_for_review summary is blocked",
    },
    {
      input: {
        summaryType: "general",
        summaryStatus: "rejected",
        visibility: "explorer_visible_after_approval",
      },
      allowed: false,
      reason: "rejected summary is blocked",
    },
    {
      input: {
        summaryType: "general",
        summaryStatus: "archived",
        visibility: "explorer_visible_after_approval",
      },
      allowed: false,
      reason: "archived summary is blocked",
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

  it("allows each allowlisted summary type only when approved + explorer_visible_after_approval", () => {
    for (const summaryType of ALLOWED_EXPLORER_SUMMARY_TYPES) {
      for (const summaryStatus of SUMMARY_STATUSES) {
        for (const visibility of SUMMARY_VISIBILITIES) {
          const expected =
            summaryStatus === "approved" &&
            visibility === "explorer_visible_after_approval";
          expect(
            isSummaryExplorerVisible({ summaryType, summaryStatus, visibility }),
          ).toBe(expected);
        }
      }
    }
  });

  it("blocks guide_prep, safety, and trigger_pattern summaries in every state", () => {
    for (const summaryType of BLOCKED_EXPLORER_SUMMARY_TYPES) {
      for (const summaryStatus of SUMMARY_STATUSES) {
        for (const visibility of SUMMARY_VISIBILITIES) {
          expect(
            isSummaryExplorerVisible({ summaryType, summaryStatus, visibility }),
          ).toBe(false);
        }
      }
    }
  });

  it("never marks any summary Explorer-visible unless its type is allowlisted", () => {
    for (const summaryType of ALL_SUMMARY_TYPES) {
      const allowed = isSummaryExplorerVisible({
        summaryType,
        summaryStatus: "approved",
        visibility: "explorer_visible_after_approval",
      });
      expect(allowed).toBe(
        SOLMIND_SUMMARY_TYPES_EXPLORER_VISIBLE_AFTER_APPROVAL.has(summaryType),
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
