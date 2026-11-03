import { SOLMIND_ROLES, type SolMindRole } from "./roles";

export const EXPLORER_HOME_ROUTE = "/explorer/home" as const;

export const GUIDE_HOME_ROUTE = "/guide/home" as const;

export const ADMIN_HOME_ROUTE = "/admin/home" as const;

// The minimal functional Admin screens (decision queue 2026-11-03 11:56:14 and
// 12:19:09): three pages and two same-origin POST commands, each with its own
// fixed Admin-only rule, so no path borrows another path's authorization.
export const ADMIN_PEOPLE_ROUTE = "/admin/people" as const;

export const ADMIN_AI_USE_ROUTE = "/admin/ai-use" as const;

export const ADMIN_SETTINGS_ROUTE = "/admin/settings" as const;

export const ADMIN_LIFT_PAUSE_ROUTE = "/admin/ai-use/lift" as const;

export const ADMIN_CHANGE_SETTING_ROUTE = "/admin/settings/change" as const;

export type SolMindRouteAccessRule = {
  route: string;
  label: string;
  allowedRoles: SolMindRole[];
  requiresAuthentication: boolean;
};

export const SOLMIND_ROUTE_ACCESS_RULES: SolMindRouteAccessRule[] = [
  {
    route: "/admin",
    label: "Admin dashboard",
    allowedRoles: ["admin"],
    requiresAuthentication: true,
  },
  {
    route: "/guide",
    label: "Guide dashboard",
    allowedRoles: ["guide"],
    requiresAuthentication: true,
  },
  {
    route: "/explorer",
    label: "Explorer conversation hub",
    allowedRoles: ["explorer"],
    requiresAuthentication: true,
  },
  {
    route: EXPLORER_HOME_ROUTE,
    label: "Explorer home",
    allowedRoles: [SOLMIND_ROLES.EXPLORER],
    requiresAuthentication: true,
  },
  {
    route: GUIDE_HOME_ROUTE,
    label: "Guide home",
    allowedRoles: [SOLMIND_ROLES.GUIDE],
    requiresAuthentication: true,
  },
  {
    route: ADMIN_HOME_ROUTE,
    label: "Admin home",
    allowedRoles: [SOLMIND_ROLES.ADMIN],
    requiresAuthentication: true,
  },
  {
    route: ADMIN_PEOPLE_ROUTE,
    label: "Admin Guides and Explorers",
    allowedRoles: [SOLMIND_ROLES.ADMIN],
    requiresAuthentication: true,
  },
  {
    route: ADMIN_AI_USE_ROUTE,
    label: "Admin AI use and pauses",
    allowedRoles: [SOLMIND_ROLES.ADMIN],
    requiresAuthentication: true,
  },
  {
    route: ADMIN_SETTINGS_ROUTE,
    label: "Admin settings",
    allowedRoles: [SOLMIND_ROLES.ADMIN],
    requiresAuthentication: true,
  },
  {
    route: ADMIN_LIFT_PAUSE_ROUTE,
    label: "Admin lift pause",
    allowedRoles: [SOLMIND_ROLES.ADMIN],
    requiresAuthentication: true,
  },
  {
    route: ADMIN_CHANGE_SETTING_ROUTE,
    label: "Admin setting change",
    allowedRoles: [SOLMIND_ROLES.ADMIN],
    requiresAuthentication: true,
  },
];

export function getSolMindRouteAccessRule(
  route: string,
): SolMindRouteAccessRule | undefined {
  return SOLMIND_ROUTE_ACCESS_RULES.find((rule) => rule.route === route);
}

export function canSolMindRoleAccessRoute(
  role: SolMindRole,
  route: string,
): boolean {
  const rule = getSolMindRouteAccessRule(route);

  if (!rule) {
    return false;
  }

  return rule.allowedRoles.includes(role);
}