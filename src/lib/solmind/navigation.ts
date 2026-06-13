import {
    SOLMIND_ROLE_HOME_ROUTES,
    SOLMIND_ROLE_LABELS,
    type SolMindRole,
  } from "./roles";
  
  export type SolMindNavItem = {
    label: string;
    href: string;
    role?: SolMindRole;
    description: string;
  };
  
  export const SOLMIND_PRIMARY_NAV: SolMindNavItem[] = [
    {
      label: "Login",
      href: "/login",
      description: "Sign in with email, SMS, or Admin credentials.",
    },
    {
      label: `${SOLMIND_ROLE_LABELS.explorer} Preview`,
      href: SOLMIND_ROLE_HOME_ROUTES.explorer,
      role: "explorer",
      description: "Explorer-facing conversation and onboarding preview.",
    },
    {
      label: `${SOLMIND_ROLE_LABELS.guide} Preview`,
      href: SOLMIND_ROLE_HOME_ROUTES.guide,
      role: "guide",
      description: "Guide dashboard preview.",
    },
    {
      label: `${SOLMIND_ROLE_LABELS.admin} Preview`,
      href: SOLMIND_ROLE_HOME_ROUTES.admin,
      role: "admin",
      description: "MVP0 administration console preview.",
    },
  ];