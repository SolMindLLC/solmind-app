export const SOLMIND_ROLES = {
    ADMIN: "admin",
    GUIDE: "guide",
    EXPLORER: "explorer",
  } as const;
  
  export type SolMindRole =
    (typeof SOLMIND_ROLES)[keyof typeof SOLMIND_ROLES];
  
  export const SOLMIND_ROLE_LABELS: Record<SolMindRole, string> = {
    admin: "Admin",
    guide: "Guide",
    explorer: "Explorer",
  };
  
  export const SOLMIND_ROLE_HOME_ROUTES: Record<SolMindRole, string> = {
    admin: "/admin",
    guide: "/guide",
    explorer: "/explorer",
  };