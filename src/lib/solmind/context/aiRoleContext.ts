// SolMind MVP0 AI role / role-context alignment helpers.
//
// Purpose:
//   - keep the SolMind Virtual Guide Explorer-facing only
//   - keep the SolMind Guide Assistant Guide-facing only
//   - keep the internal Admin AI Admin-facing only
//   - reject any AI role used in a role context it is not allowed in
//
// These helpers are pure, deterministic, and deny-by-default. They make no
// database, AI provider, or network calls. AI role and role-context string
// values mirror the canonical schema constraints:
//   - ai.ai_interaction_message.ai_role
//   - ai.ai_interaction_session.actor_role_context
//
// Role-context strings are intentionally not re-declared here; they are reused
// from the canonical role model in ../roles to avoid duplicate role literals.

import { SOLMIND_ROLES, type SolMindRole } from "../roles";

export const SOLMIND_AI_ROLES = {
  VIRTUAL_GUIDE: "solmind_virtual_guide",
  GUIDE_ASSISTANT: "solmind_guide_assistant",
  INTERNAL_ADMIN_AI: "internal_admin_ai",
} as const;

export type SolMindAiRole =
  (typeof SOLMIND_AI_ROLES)[keyof typeof SOLMIND_AI_ROLES];

// Each AI role is allowed in exactly one role context. This is the single
// source of truth for AI role / context alignment.
export const SOLMIND_AI_ROLE_REQUIRED_CONTEXT: Record<SolMindAiRole, SolMindRole> = {
  solmind_virtual_guide: SOLMIND_ROLES.EXPLORER,
  solmind_guide_assistant: SOLMIND_ROLES.GUIDE,
  internal_admin_ai: SOLMIND_ROLES.ADMIN,
};

const KNOWN_AI_ROLES: ReadonlySet<string> = new Set(
  Object.values(SOLMIND_AI_ROLES),
);

const KNOWN_ROLE_CONTEXTS: ReadonlySet<string> = new Set(
  Object.values(SOLMIND_ROLES),
);

export function isSolMindAiRole(value: string): value is SolMindAiRole {
  return KNOWN_AI_ROLES.has(value);
}

export function isSolMindRoleContext(value: string): value is SolMindRole {
  return KNOWN_ROLE_CONTEXTS.has(value);
}

// Deny-by-default alignment check. An unknown AI role or an unknown role
// context returns false. A known AI role returns true only in its single
// allowed role context.
export function isAiRoleAllowedInContext(
  aiRole: string,
  roleContext: string,
): boolean {
  if (!isSolMindAiRole(aiRole)) {
    return false;
  }

  if (!isSolMindRoleContext(roleContext)) {
    return false;
  }

  return SOLMIND_AI_ROLE_REQUIRED_CONTEXT[aiRole] === roleContext;
}
