import { describe, expect, it } from "vitest";

import {
  SOLMIND_EXPLORER_ONBOARDING_AI_BLOCKING_STEP_COUNT,
  SOLMIND_EXPLORER_ONBOARDING_REQUIRED_STEP_COUNT,
  SOLMIND_EXPLORER_ONBOARDING_STEPS,
  SOLMIND_MVP0_CONSENT_DOCUMENT_REFERENCES,
} from "../onboarding";

describe("Explorer onboarding workflow constants", () => {
  it("requires explicit MVP0 consent and disclosure gates before AI access", () => {
    const aiBlockingStepKeys = SOLMIND_EXPLORER_ONBOARDING_STEPS.filter(
      (step) => step.blocksAiAccessUntilComplete,
    ).map((step) => step.key);

    expect(aiBlockingStepKeys).toEqual([
      "adultAffirmation",
      "aiDisclosure",
      "adminVisibilityDisclosure",
      "crisisLimitationDisclosure",
      "consentDocuments",
    ]);

    expect(SOLMIND_EXPLORER_ONBOARDING_AI_BLOCKING_STEP_COUNT).toBe(5);
  });

  it("tracks required MVP0 consent documents by version", () => {
    expect(SOLMIND_MVP0_CONSENT_DOCUMENT_REFERENCES).toHaveLength(3);
    expect(
      SOLMIND_MVP0_CONSENT_DOCUMENT_REFERENCES.every(
        (document) => document.requiredForMvp0 && document.version === "v1.0",
      ),
    ).toBe(true);
  });

  it("counts all Explorer MVP0 onboarding steps as required", () => {
    expect(SOLMIND_EXPLORER_ONBOARDING_REQUIRED_STEP_COUNT).toBe(
      SOLMIND_EXPLORER_ONBOARDING_STEPS.length,
    );
  });
});
