// SolMind MVP0 actor role-context resolution helper.
//
// Purpose:
//   - resolve a trusted SolMind actor context from already-fetched DB records
//   - prove that a browser-supplied role + user account selector is backed by
//     an active SolMind role assignment AND an active, matching login session
//   - deny by default on any expired, revoked, superseded, inactive, pending,
//     suspended, or mismatched session/role/account data
//
// Architecture notes (MVP0):
//   - Supabase Auth proves authentication only. SolMind DB identity/session/
//     role records are the source of truth for SolMind authorization.
//   - Browser-supplied role and user account IDs are SELECTORS only, not
//     authority. They are matched against server-fetched records here; the
//     records win.
//   - This helper is pure and deterministic. It makes NO Supabase, network,
//     filesystem, or environment calls. Callers fetch records server-side and
//     pass plain objects in.
//
// String values mirror the canonical schema constraints in
// ../../../../../solmind-docs/execution/03_SolMind_Phase0_Data_Model_Spec_v1_1.md:
//   - identity.user_account.account_status
//   - identity.user_role_assignment.role_status / .role_code
//   - identity.user_session.session_status / .active_role_context

import { SOLMIND_ROLES, type SolMindRole } from "../roles";

// --- Canonical status vocabularies (mirror the data model spec) ---

// identity.user_account.account_status
export type SolMindAccountStatus =
  | "pending"
  | "active"
  | "suspended"
  | "locked"
  | "inactive"
  | "deleted";

// identity.user_role_assignment.role_status
export type SolMindRoleStatus = "pending" | "active" | "suspended" | "revoked";

// identity.user_session.session_status
export type SolMindSessionStatus =
  | "active"
  | "expired"
  | "logged_out"
  | "revoked";

// --- Server-fetched record shapes (source of truth) ---
//
// These are intentionally minimal projections of the canonical tables: only the
// fields this authorization decision needs. Status fields are typed as plain
// strings so that an unexpected/unknown status from the database is still
// accepted as input and then denied by the deny-by-default checks below.

export type SolMindUserAccountRecord = {
  userAccountId: string;
  accountStatus: string;
};

export type SolMindRoleAssignmentRecord = {
  userAccountId: string;
  roleCode: string;
  roleStatus: string;
};

export type SolMindSessionRecord = {
  userAccountId: string;
  activeRoleContext: string;
  sessionStatus: string;
};

// --- Resolution input ---
//
// requestedRole and requestedUserAccountId are browser-supplied selectors. The
// remaining fields are records the caller already fetched server-side. Any
// record the caller could not find should be passed as null.

export type ResolveActorContextInput = {
  requestedRole: string;
  requestedUserAccountId: string;
  userAccount: SolMindUserAccountRecord | null;
  roleAssignment: SolMindRoleAssignmentRecord | null;
  session: SolMindSessionRecord | null;
};

// --- Resolved actor (returned only on allow) ---

export type SolMindActor = {
  userAccountId: string;
  role: SolMindRole;
};

// --- Deny reason codes ---

export const ACTOR_DENY_REASONS = {
  UNKNOWN_ROLE: "unknown_role",
  MISSING_USER_ACCOUNT: "missing_user_account",
  USER_ACCOUNT_ID_MISMATCH: "user_account_id_mismatch",
  USER_ACCOUNT_NOT_ACTIVE: "user_account_not_active",
  MISSING_ROLE_ASSIGNMENT: "missing_role_assignment",
  ROLE_ASSIGNMENT_USER_MISMATCH: "role_assignment_user_mismatch",
  ROLE_ASSIGNMENT_ROLE_MISMATCH: "role_assignment_role_mismatch",
  ROLE_ASSIGNMENT_NOT_ACTIVE: "role_assignment_not_active",
  MISSING_SESSION: "missing_session",
  SESSION_USER_MISMATCH: "session_user_mismatch",
  SESSION_ROLE_CONTEXT_MISMATCH: "session_role_context_mismatch",
  SESSION_NOT_ACTIVE: "session_not_active",
} as const;

export type ActorDenyReason =
  (typeof ACTOR_DENY_REASONS)[keyof typeof ACTOR_DENY_REASONS];

// --- Result shape ---

export type ResolveActorContextResult =
  | { allowed: true; actor: SolMindActor }
  | { allowed: false; reason: ActorDenyReason };

const KNOWN_ROLES: ReadonlySet<string> = new Set(Object.values(SOLMIND_ROLES));

// The only statuses that count as usable. Everything else (including unknown
// values) is denied by default.
const ACTIVE_ACCOUNT_STATUS: SolMindAccountStatus = "active";
const ACTIVE_ROLE_STATUS: SolMindRoleStatus = "active";
const ACTIVE_SESSION_STATUS: SolMindSessionStatus = "active";

export function isSolMindRole(value: string): value is SolMindRole {
  return KNOWN_ROLES.has(value);
}

function deny(reason: ActorDenyReason): ResolveActorContextResult {
  return { allowed: false, reason };
}

// Resolve a trusted SolMind actor from already-fetched records.
//
// Deny-by-default: the function returns an allow result ONLY when every check
// passes. The checks run in a fixed order so the returned reason is the first
// failure encountered.
export function resolveActorContext(
  input: ResolveActorContextInput,
): ResolveActorContextResult {
  const { requestedRole, requestedUserAccountId, userAccount, roleAssignment, session } =
    input;

  // 1. The requested role must be a known SolMind role.
  if (!isSolMindRole(requestedRole)) {
    return deny(ACTOR_DENY_REASONS.UNKNOWN_ROLE);
  }

  // 2. The user account must exist, match the selector, and be active.
  if (userAccount === null) {
    return deny(ACTOR_DENY_REASONS.MISSING_USER_ACCOUNT);
  }
  if (userAccount.userAccountId !== requestedUserAccountId) {
    return deny(ACTOR_DENY_REASONS.USER_ACCOUNT_ID_MISMATCH);
  }
  if (userAccount.accountStatus !== ACTIVE_ACCOUNT_STATUS) {
    return deny(ACTOR_DENY_REASONS.USER_ACCOUNT_NOT_ACTIVE);
  }

  // 3. There must be an active role assignment for THIS user and the
  //    requested role.
  if (roleAssignment === null) {
    return deny(ACTOR_DENY_REASONS.MISSING_ROLE_ASSIGNMENT);
  }
  if (roleAssignment.userAccountId !== userAccount.userAccountId) {
    return deny(ACTOR_DENY_REASONS.ROLE_ASSIGNMENT_USER_MISMATCH);
  }
  if (roleAssignment.roleCode !== requestedRole) {
    return deny(ACTOR_DENY_REASONS.ROLE_ASSIGNMENT_ROLE_MISMATCH);
  }
  if (roleAssignment.roleStatus !== ACTIVE_ROLE_STATUS) {
    return deny(ACTOR_DENY_REASONS.ROLE_ASSIGNMENT_NOT_ACTIVE);
  }

  // 4. There must be an active session for THIS user whose immutable
  //    active_role_context matches the requested role.
  if (session === null) {
    return deny(ACTOR_DENY_REASONS.MISSING_SESSION);
  }
  if (session.userAccountId !== userAccount.userAccountId) {
    return deny(ACTOR_DENY_REASONS.SESSION_USER_MISMATCH);
  }
  if (session.activeRoleContext !== requestedRole) {
    return deny(ACTOR_DENY_REASONS.SESSION_ROLE_CONTEXT_MISMATCH);
  }
  if (session.sessionStatus !== ACTIVE_SESSION_STATUS) {
    return deny(ACTOR_DENY_REASONS.SESSION_NOT_ACTIVE);
  }

  // All checks passed. The role is a known SolMindRole because isSolMindRole
  // narrowed it above.
  return {
    allowed: true,
    actor: {
      userAccountId: userAccount.userAccountId,
      role: requestedRole,
    },
  };
}
