// SolMind MVP0 Supabase auth source adapter (mapping layer).
//
// Purpose:
//   - implement the existing SolMindAuthSource port against an INJECTED query
//     client, mapping database-style snake_case rows into the camelCase auth
//     projection shapes that deriveTrustedServerAuthContext and the relationship
//     guards already consume;
//   - keep this layer dependency-free and deterministic: it imports no Supabase
//     client, reads no env, and performs no IO of its own. The real
//     Supabase-backed query client (env + service-role + network) is a later,
//     separately-approved slice that implements SolMindAuthQueryClient.
//
// Architecture notes (MVP0):
//   - This adapter LOADS records only. It makes NO allow/deny decisions and
//     never calls authorizeRouteAccess, authorizeGuideRelationshipRead, or
//     deriveTrustedServerAuthContext. Authority stays in the guard layer, which
//     consumes what this adapter returns.
//   - Missing rows map to null so the guard layer denies by default. The
//     server-verified principal (request.authenticatedUser) is echoed back as
//     the authenticatedUser field because it is established server-side; the DB
//     records are looked up and may be null. When the SolMind provider identity
//     row is absent, derivation denies at the provider-identity step.
//   - Request values are lookup selectors only. The context load is keyed solely
//     by the server-verified principal; the relationship load is keyed by the
//     relationshipId selector, which the guard re-binds and authorizes. This
//     adapter never treats a selector as authority.
//   - Records are loaded in a dependency chain (provider identity -> account ->
//     session -> role assignment; account -> profiles). The chain only reflects
//     which lookup keys are available; it performs no authorization. Derivation
//     independently re-validates every link.

import {
  type AuthProviderIdentityRecord,
  type DeriveTrustedServerAuthContextInput,
  type ExplorerProfileRecord,
  type GuideProfileRecord,
  type LoadGuideRelationshipRequest,
  type LoadServerAuthContextInputRequest,
  type SolMindAuthSource,
  type SolMindRelationshipRecord,
  type SolMindRoleAssignmentRecord,
  type SolMindSessionRecord,
  type SolMindUserAccountRecord,
} from "../auth";

// --- Database-style row shapes (snake_case, as returned by the query client) ---
//
// These mirror the canonical columns in
// ../../../../../solmind-docs/execution/03_SolMind_Phase0_Data_Model_Spec_v1_1.md.
// Only the columns the auth projections need are modeled here.

// identity.auth_provider_identity
export type AuthProviderIdentityRow = {
  user_account_id: string;
  provider_name: string;
  provider_user_id: string;
  status: string;
};

// identity.user_account
export type UserAccountRow = {
  user_account_id: string;
  account_status: string;
};

// identity.user_session
export type UserSessionRow = {
  user_account_id: string;
  active_role_context: string;
  session_status: string;
};

// identity.user_role_assignment
export type UserRoleAssignmentRow = {
  user_account_id: string;
  role_code: string;
  role_status: string;
};

// core.guide_profile
export type GuideProfileRow = {
  guide_profile_id: string;
  user_account_id: string;
  status: string;
};

// core.explorer_profile
export type ExplorerProfileRow = {
  explorer_profile_id: string;
  user_account_id: string;
  status: string;
};

// core.guide_explorer_relationship
export type GuideExplorerRelationshipRow = {
  guide_explorer_relationship_id: string;
  guide_profile_id: string;
  explorer_profile_id: string;
  relationship_status: string;
};

// --- Injected query client (the only IO boundary) ---
//
// The real implementation (a later slice) wraps a server-only, service-role
// Supabase client. Each method returns the matching row or null. The methods
// load records only; they make no access decisions. A concrete implementation
// must scope every query by the provided keys and must never widen a lookup
// using a browser-supplied value.
export interface SolMindAuthQueryClient {
  findAuthProviderIdentity(args: {
    providerName: string;
    providerUserId: string;
  }): Promise<AuthProviderIdentityRow | null>;

  findUserAccountById(args: {
    userAccountId: string;
  }): Promise<UserAccountRow | null>;

  findActiveSessionByUserAccountId(args: {
    userAccountId: string;
  }): Promise<UserSessionRow | null>;

  findActiveRoleAssignment(args: {
    userAccountId: string;
    roleCode: string;
  }): Promise<UserRoleAssignmentRow | null>;

  findGuideProfileByUserAccountId(args: {
    userAccountId: string;
  }): Promise<GuideProfileRow | null>;

  findExplorerProfileByUserAccountId(args: {
    userAccountId: string;
  }): Promise<ExplorerProfileRow | null>;

  findGuideExplorerRelationshipById(args: {
    relationshipId: string;
  }): Promise<GuideExplorerRelationshipRow | null>;
}

// --- Pure snake_case -> camelCase mappers ---

function toAuthProviderIdentity(
  row: AuthProviderIdentityRow,
): AuthProviderIdentityRecord {
  return {
    userAccountId: row.user_account_id,
    providerName: row.provider_name,
    providerUserId: row.provider_user_id,
    status: row.status,
  };
}

function toUserAccount(row: UserAccountRow): SolMindUserAccountRecord {
  return {
    userAccountId: row.user_account_id,
    accountStatus: row.account_status,
  };
}

function toSession(row: UserSessionRow): SolMindSessionRecord {
  return {
    userAccountId: row.user_account_id,
    activeRoleContext: row.active_role_context,
    sessionStatus: row.session_status,
  };
}

function toRoleAssignment(
  row: UserRoleAssignmentRow,
): SolMindRoleAssignmentRecord {
  return {
    userAccountId: row.user_account_id,
    roleCode: row.role_code,
    roleStatus: row.role_status,
  };
}

function toGuideProfile(row: GuideProfileRow): GuideProfileRecord {
  return {
    guideProfileId: row.guide_profile_id,
    userAccountId: row.user_account_id,
    status: row.status,
  };
}

function toExplorerProfile(row: ExplorerProfileRow): ExplorerProfileRecord {
  return {
    explorerProfileId: row.explorer_profile_id,
    userAccountId: row.user_account_id,
    status: row.status,
  };
}

function toRelationship(
  row: GuideExplorerRelationshipRow,
): SolMindRelationshipRecord {
  return {
    guideExplorerRelationshipId: row.guide_explorer_relationship_id,
    guideProfileId: row.guide_profile_id,
    explorerProfileId: row.explorer_profile_id,
    relationshipStatus: row.relationship_status,
  };
}

// Create a SolMindAuthSource backed by the injected query client. Deterministic
// and IO-free in itself; all IO is delegated to the client.
export function createSupabaseAuthSource(
  client: SolMindAuthQueryClient,
): SolMindAuthSource {
  return {
    async loadServerAuthContextInput(
      request: LoadServerAuthContextInputRequest,
    ): Promise<DeriveTrustedServerAuthContextInput> {
      const { authenticatedUser } = request;

      // 1. Provider identity, keyed by the server-verified principal.
      const providerIdentityRow = await client.findAuthProviderIdentity({
        providerName: authenticatedUser.providerName,
        providerUserId: authenticatedUser.providerUserId,
      });
      const authProviderIdentity = providerIdentityRow
        ? toAuthProviderIdentity(providerIdentityRow)
        : null;

      // 2. User account, keyed by the provider identity's user_account_id. With
      //    no provider identity there is no key, so the account stays null.
      const userAccountRow = authProviderIdentity
        ? await client.findUserAccountById({
            userAccountId: authProviderIdentity.userAccountId,
          })
        : null;
      const userAccount = userAccountRow ? toUserAccount(userAccountRow) : null;

      // 3. Active SolMind session for the account.
      const sessionRow = userAccount
        ? await client.findActiveSessionByUserAccountId({
            userAccountId: userAccount.userAccountId,
          })
        : null;
      const session = sessionRow ? toSession(sessionRow) : null;

      // 4. Role assignment matching the session's active role context.
      const roleAssignmentRow =
        userAccount && session
          ? await client.findActiveRoleAssignment({
              userAccountId: userAccount.userAccountId,
              roleCode: session.activeRoleContext,
            })
          : null;
      const activeRoleAssignment = roleAssignmentRow
        ? toRoleAssignment(roleAssignmentRow)
        : null;

      // 5/6. Optional profiles, keyed by the account.
      const guideProfileRow = userAccount
        ? await client.findGuideProfileByUserAccountId({
            userAccountId: userAccount.userAccountId,
          })
        : null;
      const guideProfile = guideProfileRow
        ? toGuideProfile(guideProfileRow)
        : null;

      const explorerProfileRow = userAccount
        ? await client.findExplorerProfileByUserAccountId({
            userAccountId: userAccount.userAccountId,
          })
        : null;
      const explorerProfile = explorerProfileRow
        ? toExplorerProfile(explorerProfileRow)
        : null;

      // The verified principal is echoed; DB records are whatever was found.
      return {
        authenticatedUser,
        authProviderIdentity,
        userAccount,
        session,
        activeRoleAssignment,
        guideProfile,
        explorerProfile,
      };
    },

    async loadGuideRelationship(
      request: LoadGuideRelationshipRequest,
    ): Promise<SolMindRelationshipRecord | null> {
      const row = await client.findGuideExplorerRelationshipById({
        relationshipId: request.relationshipId,
      });
      return row ? toRelationship(row) : null;
    },
  };
}
