export type SolMindConsentDisclosureKey =
  | "adultAffirmation"
  | "aiDisclosure"
  | "adminVisibilityDisclosure"
  | "crisisLimitationDisclosure"
  | "consentDocuments";

export type SolMindOnboardingStepKey =
  | "welcome"
  | "identityContact"
  | "codeVerification"
  | SolMindConsentDisclosureKey
  | "conversationHub";

export type SolMindConsentDocumentReference = {
  key: string;
  title: string;
  version: string;
  requiredForMvp0: boolean;
};

export type SolMindOnboardingStep = {
  key: SolMindOnboardingStepKey;
  title: string;
  description: string;
  route: string;
  requiredForMvp0: boolean;
  blocksAiAccessUntilComplete?: boolean;
  consentDocumentReferences?: SolMindConsentDocumentReference[];
};

export const SOLMIND_MVP0_CONSENT_DOCUMENT_REFERENCES: SolMindConsentDocumentReference[] =
  [
    {
      key: "mvp0-participant-consent",
      title: "MVP0 Participant Consent",
      version: "v1.0",
      requiredForMvp0: true,
    },
    {
      key: "mvp0-privacy-notice",
      title: "MVP0 Privacy Notice",
      version: "v1.0",
      requiredForMvp0: true,
    },
    {
      key: "mvp0-ai-and-crisis-limits",
      title: "MVP0 AI and Crisis Limits Disclosure",
      version: "v1.0",
      requiredForMvp0: true,
    },
  ];

export const SOLMIND_EXPLORER_ONBOARDING_STEPS: SolMindOnboardingStep[] = [
  {
    key: "welcome",
    title: "Welcome",
    description:
      "Introduce SolMind and orient the Explorer to AI-assisted reflective support.",
    route: "/",
    requiredForMvp0: true,
  },
  {
    key: "identityContact",
    title: "Name and contact",
    description:
      "Collect the Explorer name and preferred login contact method.",
    route: "/login",
    requiredForMvp0: true,
  },
  {
    key: "codeVerification",
    title: "Code verification",
    description:
      "Verify the Explorer login code before continuing onboarding.",
    route: "/login",
    requiredForMvp0: true,
  },
  {
    key: "adultAffirmation",
    title: "Adult affirmation",
    description:
      "Confirm the Explorer affirms they are 18 or older before MVP0 participation.",
    route: "/explorer",
    requiredForMvp0: true,
    blocksAiAccessUntilComplete: true,
  },
  {
    key: "aiDisclosure",
    title: "AI disclosure",
    description:
      "Confirm the Explorer understands that SolMind includes AI-assisted reflective support and is not a human-only service.",
    route: "/explorer",
    requiredForMvp0: true,
    blocksAiAccessUntilComplete: true,
  },
  {
    key: "adminVisibilityDisclosure",
    title: "Admin visibility disclosure",
    description:
      "Confirm the Explorer understands that Admins may access MVP0 data for setup, QA, safety, and support purposes.",
    route: "/explorer",
    requiredForMvp0: true,
    blocksAiAccessUntilComplete: true,
  },
  {
    key: "crisisLimitationDisclosure",
    title: "Crisis limitation disclosure",
    description:
      "Confirm the Explorer understands SolMind is not an emergency service or crisis-response substitute.",
    route: "/explorer",
    requiredForMvp0: true,
    blocksAiAccessUntilComplete: true,
  },
  {
    key: "consentDocuments",
    title: "Consent documents",
    description:
      "Record the Explorer's acceptance of the required MVP0 consent and disclosure documents by version.",
    route: "/explorer",
    requiredForMvp0: true,
    blocksAiAccessUntilComplete: true,
    consentDocumentReferences: SOLMIND_MVP0_CONSENT_DOCUMENT_REFERENCES,
  },
  {
    key: "conversationHub",
    title: "Conversation hub",
    description:
      "Show the Explorer the main conversation space, suggested topics, onboarding progress, and profile preview.",
    route: "/explorer",
    requiredForMvp0: true,
  },
];

export const SOLMIND_EXPLORER_ONBOARDING_REQUIRED_STEP_COUNT =
  SOLMIND_EXPLORER_ONBOARDING_STEPS.filter(
    (step) => step.requiredForMvp0,
  ).length;

export const SOLMIND_EXPLORER_ONBOARDING_AI_BLOCKING_STEP_COUNT =
  SOLMIND_EXPLORER_ONBOARDING_STEPS.filter(
    (step) => step.blocksAiAccessUntilComplete,
  ).length;
