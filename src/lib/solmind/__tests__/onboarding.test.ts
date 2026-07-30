import { describe, expect, it } from "vitest";

import {
  SOLMIND_EXPLORER_ONBOARDING_AI_BLOCKING_STEP_COUNT,
  SOLMIND_EXPLORER_ONBOARDING_REQUIRED_STEP_COUNT,
  SOLMIND_EXPLORER_ONBOARDING_STEPS,
  SOLMIND_EXPLORER_STRUCTURED_FORM_FIELDS,
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

  it("keeps First Compass optional and the structured form required", () => {
    const firstCompass = SOLMIND_EXPLORER_ONBOARDING_STEPS.find(
      (step) => step.key === "firstCompassOffer",
    );
    const structuredForm = SOLMIND_EXPLORER_ONBOARDING_STEPS.find(
      (step) => step.key === "structuredForm",
    );

    expect(firstCompass?.requiredForMvp0).toBe(false);
    expect(structuredForm?.requiredForMvp0).toBe(true);
    expect(SOLMIND_EXPLORER_ONBOARDING_REQUIRED_STEP_COUNT).toBe(
      SOLMIND_EXPLORER_ONBOARDING_STEPS.length - 1,
    );
  });

  it("defines exactly the approved three required and three optional questions", () => {
    expect(
      SOLMIND_EXPLORER_STRUCTURED_FORM_FIELDS.map((field) => field.label),
    ).toEqual([
      "What would you like support with right now?",
      "What would make this first experience useful?",
      "What kind of support would feel most helpful today?",
      "Context you want your Guide to know.",
      "Communication preference.",
      "Anything you do not want emphasized.",
    ]);
    expect(
      SOLMIND_EXPLORER_STRUCTURED_FORM_FIELDS.filter(
        (field) => field.required,
      ),
    ).toHaveLength(3);
    expect(
      SOLMIND_EXPLORER_STRUCTURED_FORM_FIELDS.filter(
        (field) => !field.required,
      ),
    ).toHaveLength(3);
    expect(
      SOLMIND_EXPLORER_STRUCTURED_FORM_FIELDS.every(
        (field) => field.guideVisibleAfterSubmission,
      ),
    ).toBe(true);
  });

  it("does not collect preferred name again in the structured form", () => {
    expect(
      SOLMIND_EXPLORER_STRUCTURED_FORM_FIELDS.some(
        (field) =>
          field.key.toLowerCase().includes("name") ||
          field.label.toLowerCase().includes("preferred name"),
      ),
    ).toBe(false);
  });

  it("does not claim that authorized Admin access is impossible", () => {
    const disclosure = SOLMIND_EXPLORER_ONBOARDING_STEPS.find(
      (step) => step.key === "adminVisibilityDisclosure",
    );

    expect(disclosure?.description).toContain("authorized Admin access");
    expect(disclosure?.description).toContain(
      "may occur under defined operational conditions",
    );
    expect(disclosure?.description).not.toContain("Admins cannot");
    expect(disclosure?.description).toContain("raw conversations");
    expect(disclosure?.description).toContain("private drafts");
  });
});
