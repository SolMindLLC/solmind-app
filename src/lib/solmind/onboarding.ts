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
  | "structuredForm"
  | "firstCompassOffer"
  | "conversationHub";

export type SolMindStructuredFormFieldKey =
  | "supportNow"
  | "usefulOutcome"
  | "supportStyle"
  | "guideContext"
  | "communicationPreference"
  | "doNotEmphasize";

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

export type SolMindStructuredFormField = {
  key: SolMindStructuredFormFieldKey;
  label: string;
  required: boolean;
  guideVisibleAfterSubmission: true;
  inputKind: "textarea" | "text";
  hint: string;
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

export const SOLMIND_EXPLORER_STRUCTURED_FORM_FIELDS: SolMindStructuredFormField[] =
  [
    {
      key: "supportNow",
      label: "What would you like support with right now?",
      required: true,
      guideVisibleAfterSubmission: true,
      inputKind: "textarea",
      hint: "A sentence or two is enough.",
    },
    {
      key: "usefulOutcome",
      label: "What would make this first experience useful?",
      required: true,
      guideVisibleAfterSubmission: true,
      inputKind: "textarea",
      hint: "Describe a useful feeling, understanding, or next step.",
    },
    {
      key: "supportStyle",
      label: "What kind of support would feel most helpful today?",
      required: true,
      guideVisibleAfterSubmission: true,
      inputKind: "textarea",
      hint: "For example: listening, reflection, structure, or a lighter check-in.",
    },
    {
      key: "guideContext",
      label: "Context you want your Guide to know.",
      required: false,
      guideVisibleAfterSubmission: true,
      inputKind: "textarea",
      hint: "Optional. Leave this blank if there is nothing more to add.",
    },
    {
      key: "communicationPreference",
      label: "Communication preference.",
      required: false,
      guideVisibleAfterSubmission: true,
      inputKind: "text",
      hint: "Optional. For example: direct, gentle, brief, or detailed.",
    },
    {
      key: "doNotEmphasize",
      label: "Anything you do not want emphasized.",
      required: false,
      guideVisibleAfterSubmission: true,
      inputKind: "textarea",
      hint: "Optional. This answer is also part of the submitted form.",
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
      "Confirm the Explorer understands that authorized Admin access to raw conversations, private drafts, excluded details, private Waypoints, or unconfirmed Reflections may occur under defined operational conditions; Admin access is not categorically impossible.",
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
    key: "structuredForm",
    title: "Structured onboarding form",
    description:
      "Submit the required support questions and any optional context as a distinct Guide-visible onboarding record.",
    route: "/explorer",
    requiredForMvp0: true,
  },
  {
    key: "firstCompassOffer",
    title: "First Compass offer",
    description:
      "Offer an encouraged but skippable First Compass after the structured form is submitted.",
    route: "/explorer",
    requiredForMvp0: false,
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
