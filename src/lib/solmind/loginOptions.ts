import type { SolMindRole } from "./roles";

export type SolMindLoginOption = {
  role: SolMindRole;
  title: string;
  description: string;
  authenticationSummary: string;
  ctaLabel: string;
};

export const SOLMIND_LOGIN_OPTIONS: SolMindLoginOption[] = [
  {
    role: "explorer",
    title: "Explorer",
    description:
      "Continue onboarding, check in, reflect, and talk with the SolMind Virtual Guide.",
    authenticationSummary: "Passwordless email or SMS verification code.",
    ctaLabel: "Continue as Explorer",
  },
  {
    role: "guide",
    title: "Guide",
    description:
      "Review Explorer summaries, progress, flags, and suggested follow-ups.",
    authenticationSummary: "Guide password plus email or SMS verification code.",
    ctaLabel: "Continue as Guide",
  },
  {
    role: "admin",
    title: "Admin",
    description:
      "Manage Guide invites, methodology, system QA, and MVP0 setup.",
    authenticationSummary: "Admin password plus verification code.",
    ctaLabel: "Continue as Admin",
  },
];