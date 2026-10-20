// SolMind MVP0 trusted server auth context derivation helper.
//
// Purpose:
//   - derive a single trusted server-side auth context from server-established
//     authentication plus server-loaded SolMind DB records;
//   - produce the AuthenticatedIdentity shape that accessBoundary already
//     consumes, so future routes/server actions never have to hand-build it;
//   - deny by default on any missing, mismatched, inactive, or unknown
//     authentication/identity/session/role state.
//
// Architecture notes (MVP0):
//   - Supabase Auth proves WHO authenticated (the human/session identity). The
//     SupabaseAuthenticatedUser passed in MUST already be the server-verified
//     auth principal, never a browser-supplied claim.
//   - SolMind DB records (auth_provider_identity, user_account, user_session,
//     user_role_assignment, guide_profile, explorer_profile) are the source of
//     truth for WHAT the user may do. The caller fetches them server-side and
//     passes plain projections in; any record not found is passed as null.
//   - This function accepts NO browser-supplied selectors. There is no
//     requested role, requested user id, requested profile id, or requested
//     relationship id parameter. Browser selectors belong at the accessBoundary
//     layer, where they are bound to the trusted identity this function derives.
//     Keeping selectors out of derivation is deliberate: a client value can
//     never choose the trusted context.
//   - One request-presented value does take part, as a credential to be
//     checked and never as a selector: the session UUID the request presented
//     in its session-binding cookie (login step 6, sub-slice S6-4; solmind-docs
//     `execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`
//     Sections 8 and 19, AUTH-RLS-DEC-043 and AUTH-RLS-DEC-044). It is compared
//     exactly with the UUID of the session the server selected for the
//     account, after the provider identity, the account and that session have
//     passed their checks. It can only turn an allow into a deny: it never
//     selects a session, seeds an id or changes a role, and it grants nothing
//     on its own.
//   - Trusted DB record fields are compared exactly (no trimming or case
//     folding). Normalization here is reserved for the selector layer, matching
//     the existing helpers; trusted server values are taken as-is.
//   - This helper is pure and deterministic. It makes NO Supabase, network,
//     filesystem, or environment calls.
//
// String values mirror the canonical schema constraints in
// ../../../../../solmind-docs/execution/03_SolMind_Phase0_Data_Model_Spec_v1_1.md:
//   - identity.auth_provider_identity.status
//   - identity.user_account.account_status
//   - identity.user_session.session_status / .active_role_context
//   - identity.user_role_assignment.role_status / .role_code
//   - core.guide_profile.status / core.explorer_profile.status

import { type SolMindRole } from "../roles";
import {
  isSolMindRole,
  type SolMindRoleAssignmentRecord,
  type SolMindSessionRecord,
  type SolMindUserAccountRecord,
} from "./roleContext";
import { type AuthenticatedIdentity } from "./accessBoundary";

// --- Server-established authentication principal (AUTHORITY, not browser) ---
//
// The server-verified Supabase Auth identity. providerName and providerUserId
// identify the external auth principal; they are matched against the loaded
// auth_provider_identity record below.
//
// presentedSessionId is what the SAME request presented in its session-binding
// cookie: a SolMind session UUID, or null when the request presented none. It
// is neither identity nor authority. Derivation compares it with the selected
// session's UUID and denies unless the two are equal. It is a session UUID, so
// it stays out of logs, errors and outward results (contract 25 Section 14).
export type SupabaseAuthenticatedUser = {
  providerName: string;
  providerUserId: string;
  presentedSessionId: string | null;
};

// --- Server-loaded record projections (source of truth) ---
//
// Minimal projections of the canonical tables: only the fields this derivation
// needs. Status fields are typed as plain strings so an unexpected/unknown
// status from the database is still accepted as input and then denied by the
// deny-by-default checks below.

// identity.auth_provider_identity
export type AuthProviderIdentityRecord = {
  userAccountId: string;
  providerName: string;
  providerUserId: string;
  status: string;
};

// core.guide_profile
export type GuideProfileRecord = {
  guideProfileId: string;
  userAccountId: string;
  status: string;
};

// core.explorer_profile
export type ExplorerProfileRecord = {
  explorerProfileId: string;
  userAccountId: string;
  status: string;
};

// identity.user_session, as the active-session lookup selected it: the banked
// session projection plus the session's own UUID and its expiry (expires_at,
// exactly as the lookup returned it). The UUID is what the binding comparison
// uses, and both are carried to the allow result (contract 25 Sections 7, 8
// and 19).
export type SelectedSolMindSessionRecord = SolMindSessionRecord & {
  userSessionId: string;
  expiresAt: string;
};

// --- Derivation input ---
//
// Every field is server-established or server-loaded, except
// authenticatedUser.presentedSessionId, which the request presented and which
// is only ever compared. There are intentionally NO selector fields.
// guideProfile / explorerProfile are optional server-loaded records; pass null
// when the account has no profile of that kind.
export type DeriveTrustedServerAuthContextInput = {
  authenticatedUser: SupabaseAuthenticatedUser | null;
  authProviderIdentity: AuthProviderIdentityRecord | null;
  userAccount: SolMindUserAccountRecord | null;
  session: SelectedSolMindSessionRecord | null;
  activeRoleAssignment: SolMindRoleAssignmentRecord | null;
  guideProfile: GuideProfileRecord | null;
  explorerProfile: ExplorerProfileRecord | null;
};

// --- Trusted result (returned only on allow) ---
//
// activeRole is the immutable session active_role_context, validated to a
// canonical SolMind role. identity is ready to pass straight to accessBoundary.
// session is the selected session that the request proved it presents: its
// UUID and its expiry, carried from the lookup for later server use (the
// end-of-session warning of contract 25 Section 7 reads expiresAt). Nothing
// renders or returns either value yet. The UUID must never be logged, put in
// an error, or sent to a browser by anything but the login-step cookie writer.
export type TrustedSessionBinding = {
  userSessionId: string;
  expiresAt: string;
};

export type TrustedServerAuthContext = {
  activeRole: SolMindRole;
  identity: AuthenticatedIdentity;
  session: TrustedSessionBinding;
};

// --- Deny reason codes ---

export const SERVER_AUTH_CONTEXT_DENY_REASONS = {
  MISSING_AUTHENTICATED_USER: "missing_authenticated_user",
  MISSING_PROVIDER_IDENTITY: "missing_provider_identity",
  PROVIDER_IDENTITY_USER_MISMATCH: "provider_identity_user_mismatch",
  PROVIDER_IDENTITY_NOT_ACTIVE: "provider_identity_not_active",
  MISSING_USER_ACCOUNT: "missing_user_account",
  USER_ACCOUNT_LINK_MISMATCH: "user_account_link_mismatch",
  USER_ACCOUNT_NOT_ACTIVE: "user_account_not_active",
  MISSING_SESSION: "missing_session",
  SESSION_USER_MISMATCH: "session_user_mismatch",
  SESSION_NOT_ACTIVE: "session_not_active",
  MISSING_PRESENTED_SESSION: "missing_presented_session",
  PRESENTED_SESSION_MISMATCH: "presented_session_mismatch",
  UNKNOWN_ACTIVE_ROLE: "unknown_active_role",
  MISSING_ROLE_ASSIGNMENT: "missing_role_assignment",
  ROLE_ASSIGNMENT_USER_MISMATCH: "role_assignment_user_mismatch",
  ROLE_ASSIGNMENT_ROLE_MISMATCH: "role_assignment_role_mismatch",
  ROLE_ASSIGNMENT_NOT_ACTIVE: "role_assignment_not_active",
  GUIDE_PROFILE_LINK_MISMATCH: "guide_profile_link_mismatch",
  EXPLORER_PROFILE_LINK_MISMATCH: "explorer_profile_link_mismatch",
} as const;

export type ServerAuthContextDenyReason =
  (typeof SERVER_AUTH_CONTEXT_DENY_REASONS)[keyof typeof SERVER_AUTH_CONTEXT_DENY_REASONS];

// --- Result shape ---

export type DeriveTrustedServerAuthContextResult =
  | { allowed: true; context: TrustedServerAuthContext }
  | { allowed: false; reason: ServerAuthContextDenyReason };

// The only statuses that count as usable. Everything else (including unknown
// values) is denied by default, or excluded by default for optional profiles.
const ACTIVE_PROVIDER_IDENTITY_STATUS = "active";
const ACTIVE_ACCOUNT_STATUS = "active";
const ACTIVE_SESSION_STATUS = "active";
const ACTIVE_ROLE_STATUS = "active";
const ACTIVE_PROFILE_STATUS = "active";

function deny(
  reason: ServerAuthContextDenyReason,
): DeriveTrustedServerAuthContextResult {
  return { allowed: false, reason };
}

// Resolve an optional, server-loaded profile id.
//   - null record  -> null id (the account simply has no profile of this kind).
//   - record whose userAccountId does not match the account -> mismatch (the
//     caller loaded the wrong record); reported via onMismatch.
//   - record that is not active -> null id (excluded, not a hard failure).
//   - active, matching record -> its id.
function resolveProfileId(args: {
  record: { userAccountId: string; status: string } | null;
  profileId: string | null;
  userAccountId: string;
}): { ok: true; id: string | null } | { ok: false } {
  const { record, profileId, userAccountId } = args;
  if (record === null) {
    return { ok: true, id: null };
  }
  if (record.userAccountId !== userAccountId) {
    return { ok: false };
  }
  if (record.status !== ACTIVE_PROFILE_STATUS) {
    return { ok: true, id: null };
  }
  return { ok: true, id: profileId };
}

// Derive a trusted server auth context from server-established authentication
// plus server-loaded records.
//
// Deny-by-default: returns an allow result ONLY when every check passes. The
// checks run in a fixed order so the returned reason is the first failure
// encountered.
export function deriveTrustedServerAuthContext(
  input: DeriveTrustedServerAuthContextInput,
): DeriveTrustedServerAuthContextResult {
  const {
    authenticatedUser,
    authProviderIdentity,
    userAccount,
    session,
    activeRoleAssignment,
    guideProfile,
    explorerProfile,
  } = input;

  // 1. There must be a server-verified Supabase auth principal.
  if (authenticatedUser === null) {
    return deny(SERVER_AUTH_CONTEXT_DENY_REASONS.MISSING_AUTHENTICATED_USER);
  }

  // 2. The provider identity must exist, match the authenticated principal,
  //    and be active.
  if (authProviderIdentity === null) {
    return deny(SERVER_AUTH_CONTEXT_DENY_REASONS.MISSING_PROVIDER_IDENTITY);
  }
  if (
    authProviderIdentity.providerName !== authenticatedUser.providerName ||
    authProviderIdentity.providerUserId !== authenticatedUser.providerUserId
  ) {
    return deny(
      SERVER_AUTH_CONTEXT_DENY_REASONS.PROVIDER_IDENTITY_USER_MISMATCH,
    );
  }
  if (authProviderIdentity.status !== ACTIVE_PROVIDER_IDENTITY_STATUS) {
    return deny(SERVER_AUTH_CONTEXT_DENY_REASONS.PROVIDER_IDENTITY_NOT_ACTIVE);
  }

  // 3. The user account must exist, be the one the provider identity links to,
  //    and be active.
  if (userAccount === null) {
    return deny(SERVER_AUTH_CONTEXT_DENY_REASONS.MISSING_USER_ACCOUNT);
  }
  if (authProviderIdentity.userAccountId !== userAccount.userAccountId) {
    return deny(SERVER_AUTH_CONTEXT_DENY_REASONS.USER_ACCOUNT_LINK_MISMATCH);
  }
  if (userAccount.accountStatus !== ACTIVE_ACCOUNT_STATUS) {
    return deny(SERVER_AUTH_CONTEXT_DENY_REASONS.USER_ACCOUNT_NOT_ACTIVE);
  }

  // 4. There must be an active session for THIS user.
  if (session === null) {
    return deny(SERVER_AUTH_CONTEXT_DENY_REASONS.MISSING_SESSION);
  }
  if (session.userAccountId !== userAccount.userAccountId) {
    return deny(SERVER_AUTH_CONTEXT_DENY_REASONS.SESSION_USER_MISMATCH);
  }
  if (session.sessionStatus !== ACTIVE_SESSION_STATUS) {
    return deny(SERVER_AUTH_CONTEXT_DENY_REASONS.SESSION_NOT_ACTIVE);
  }

  // 4a. The session binding (contract 25 Section 8). The request must have
  //     presented the UUID of THIS selected session. A request that presented
  //     none denies; so does one that presented any other value, which is what
  //     a browser left with a superseded or replayed session presents. The
  //     comparison is exact, with no trimming or case folding, and an empty
  //     value never matches, so a session record without a UUID can never be
  //     allowed. The UUID grants nothing on its own: this point is reached
  //     only after the provider identity, the account and the selected
  //     session have passed.
  const presentedSessionId = authenticatedUser.presentedSessionId;
  if (typeof presentedSessionId !== "string" || presentedSessionId.length === 0) {
    return deny(SERVER_AUTH_CONTEXT_DENY_REASONS.MISSING_PRESENTED_SESSION);
  }
  if (
    typeof session.userSessionId !== "string" ||
    session.userSessionId !== presentedSessionId
  ) {
    return deny(SERVER_AUTH_CONTEXT_DENY_REASONS.PRESENTED_SESSION_MISMATCH);
  }

  // 5. The session's immutable active_role_context must be a canonical role.
  if (!isSolMindRole(session.activeRoleContext)) {
    return deny(SERVER_AUTH_CONTEXT_DENY_REASONS.UNKNOWN_ACTIVE_ROLE);
  }
  const activeRole = session.activeRoleContext;

  // 6. There must be an active role assignment for THIS user matching the
  //    session's active role context.
  if (activeRoleAssignment === null) {
    return deny(SERVER_AUTH_CONTEXT_DENY_REASONS.MISSING_ROLE_ASSIGNMENT);
  }
  if (activeRoleAssignment.userAccountId !== userAccount.userAccountId) {
    return deny(SERVER_AUTH_CONTEXT_DENY_REASONS.ROLE_ASSIGNMENT_USER_MISMATCH);
  }
  if (activeRoleAssignment.roleCode !== activeRole) {
    return deny(SERVER_AUTH_CONTEXT_DENY_REASONS.ROLE_ASSIGNMENT_ROLE_MISMATCH);
  }
  if (activeRoleAssignment.roleStatus !== ACTIVE_ROLE_STATUS) {
    return deny(SERVER_AUTH_CONTEXT_DENY_REASONS.ROLE_ASSIGNMENT_NOT_ACTIVE);
  }

  // 7. Resolve optional, server-derived profile ids. A profile record loaded
  //    for the wrong account is a hard failure; an inactive profile is simply
  //    excluded.
  const guide = resolveProfileId({
    record: guideProfile,
    profileId: guideProfile?.guideProfileId ?? null,
    userAccountId: userAccount.userAccountId,
  });
  if (!guide.ok) {
    return deny(SERVER_AUTH_CONTEXT_DENY_REASONS.GUIDE_PROFILE_LINK_MISMATCH);
  }
  const explorer = resolveProfileId({
    record: explorerProfile,
    profileId: explorerProfile?.explorerProfileId ?? null,
    userAccountId: userAccount.userAccountId,
  });
  if (!explorer.ok) {
    return deny(
      SERVER_AUTH_CONTEXT_DENY_REASONS.EXPLORER_PROFILE_LINK_MISMATCH,
    );
  }

  // All checks passed. Build the trusted context. identity is exactly the
  // AuthenticatedIdentity shape accessBoundary expects. session carries the
  // selected session's UUID and expiry from the lookup, unchanged.
  return {
    allowed: true,
    context: {
      activeRole,
      identity: {
        userAccountId: userAccount.userAccountId,
        guideProfileId: guide.id,
        explorerProfileId: explorer.id,
      },
      session: {
        userSessionId: session.userSessionId,
        expiresAt: session.expiresAt,
      },
    },
  };
}
