import type { SolMindRole } from "./roles";

export type SolMindDashboardPanel<Role extends Extract<SolMindRole, "admin" | "guide">> = {
  title: string;
  role: Role;
};

export const SOLMIND_ADMIN_DASHBOARD_PANELS: SolMindDashboardPanel<"admin">[] = [
  {
    title: "Guide Invites",
    role: "admin",
  },
  {
    title: "Methodology",
    role: "admin",
  },
  {
    title: "System QA",
    role: "admin",
  },
];

export const SOLMIND_GUIDE_DASHBOARD_PANELS: SolMindDashboardPanel<"guide">[] = [
  {
    title: "Active Explorers",
    role: "guide",
  },
  {
    title: "Needs Review",
    role: "guide",
  },
  {
    title: "Safety Flags",
    role: "guide",
  },
];