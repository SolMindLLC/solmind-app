import { SOLMIND_ROLES, type SolMindRole } from "./roles";

export const EXPLORER_HOME_ROUTE = "/explorer/home" as const;

export const GUIDE_HOME_ROUTE = "/guide/home" as const;

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