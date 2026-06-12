import type { SolMindRole } from "./roles";

export type SolMindDashboardPanel = {
  title: string;
  role: Extract<SolMindRole, "admin" | "guide">;
};

export const SOLMIND_ADMIN_DASHBOARD_PANELS: SolMindDashboardPanel[] = [
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

export const SOLMIND_GUIDE_DASHBOARD_PANELS: SolMindDashboardPanel[] = [
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