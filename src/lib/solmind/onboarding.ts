export type SolMindOnboardingStepKey =
  | "welcome"
  | "identityContact"
  | "codeVerification"
  | "transparencyConsent"
  | "conversationHub";

export type SolMindOnboardingStep = {
  key: SolMindOnboardingStepKey;
  title: string;
  description: string;
  route: string;
  requiredForMvp0: boolean;
};

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
    key: "transparencyConsent",
    title: "Transparency and consent",
    description:
      "Confirm the Explorer understands SolMind's AI-assisted role, privacy boundaries, and consent requirements.",
    route: "/explorer",
    requiredForMvp0: true,
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