// SolMind MVP0 Supabase service-role auth query client (dumb scoped loader).
//
// Purpose:
//   - implement the existing SolMindAuthQueryClient port over a narrow,
//     injectable query executor, so the real service-role Supabase client and a
//     deterministic test mock both satisfy the same contract.
//
// Architecture notes (MVP0):
//   - This module imports NO Supabase client. It depends only on the narrow
//     SupabaseQueryExecutor interface below; serviceRoleClient.ts adapts the real
//     @supabase/supabase-js client to it. That keeps this loader dependency-free
//     and unit-testable with a plain mock (no network, DB, env, or cookies).
//   - It LOADS records only and authorizes nothing. deriveTrustedServerAuthContext
//     and the guard layer remain the authority and re-validate everything.
//   - Fail closed: a query error, a non-array result, an invalid row shape, a
//     missing row, or ambiguity (more rows than expected, or multiple valid
//     active sessions) all return null rather than failing open.
//   - Active SolMind session selection is delegated to selectActiveUserSession,
//     which enforces single-active, expiration-wins, and deny-on-ambiguity. The
//     session query selects ALL active candidates (no limit/single) so ambiguity
//     stays visible.

import {
  type AuthProviderIdentityRow,
  type ExplorerProfileRow,
  type GuideExplorerRelationshipRow,
  type GuideProfileRow,
  type SolMindAuthQueryClient,
  type UserAccountRow,
  type UserRoleAssignmentRow,
  type UserSessionRow,
} from "./serverAuthSourceAdapter";
import {
  SOLMIND_ACTIVE_SESSION_STATUS,
  selectActiveUserSession,
  type UserSessionSelectionCandidate,
} from "./sessionSelection";

// --- Narrow query executor (the only IO boundary) ---

export type SupabaseQueryFilter = {
  column: string;
  value: string;
};

export type SupabaseQuerySpec = {
  schema: string;
  table: string;
  columns: string[];
  filters: SupabaseQueryFilter[];
};

export type SupabaseQueryResult = {
  data: unknown[] | null;
  error: unknown;
};

// A minimal scoped-select interface. The real implementation (serviceRoleClient)
// wraps a server-only service-role Supabase client; tests pass a mock.
export interface SupabaseQueryExecutor {
  select(spec: SupabaseQuerySpec): Promise<SupabaseQueryResult>;
}

// --- Row validation helpers ---

// Validate that value is an object whose listed keys are all strings, returning
// a typed record or null (deny-by-default on any invalid/missing field).
function pickStrings<K extends string>(
  value: unknown,
  keys: readonly K[],
): Record<K, string> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const obj = value as Record<string, unknown>;
  const out = {} as Record<K, string>;
  for (const key of keys) {
    const raw = obj[key];
    if (typeof raw !== "string") {
      return null;
    }
    out[key] = raw;
  }
  return out;
}

// Return the result rows when the query succeeded and produced an array, else
// null (fail closed on error or non-array data).
function okRows(result: SupabaseQueryResult): unknown[] | null {
  if (result.error !== null && result.error !== undefined) {
    return null;
  }
  if (!Array.isArray(result.data)) {
    return null;
  }
  return result.data;
}

// Validate a result expected to hold exactly one row, returning the typed row or
// null. Zero rows or more than one row (ambiguous) both fail closed.
function singleRow<K extends string>(
  result: SupabaseQueryResult,
  keys: readonly K[],
): Record<K, string> | null {
  const rows = okRows(result);
  if (rows === null || rows.length !== 1) {
    return null;
  }
  return pickStrings(rows[0], keys);
}

// Sentinel error returned when the executor throws/rejects. It carries no detail
// from the underlying failure, so a connection string, key, or other secret can
// never leak through the returned error.
const QUERY_FAILED_ERROR = "solmind_query_failed";

// Run a scoped select and fail closed on ANY failure mode. A thrown or rejected
// executor failure is converted into the same returned-error path used for an
// executor that returns { error }, so every finder denies by default. The
// original error is swallowed (not logged, not propagated) to avoid leaking
// secrets.
async function safeSelect(
  client: SupabaseQueryExecutor,
  spec: SupabaseQuerySpec,
): Promise<SupabaseQueryResult> {
  try {
    return await client.select(spec);
  } catch {
    return { data: null, error: QUERY_FAILED_ERROR };
  }
}

const AUTH_PROVIDER_IDENTITY_KEYS = [
  "user_account_id",
  "provider_name",
  "provider_user_id",
  "status",
] as const;

const USER_ACCOUNT_KEYS = ["user_account_id", "account_status"] as const;

const USER_SESSION_KEYS = [
  "user_account_id",
  "active_role_context",
  "session_status",
  "expires_at",
] as const;

const USER_ROLE_ASSIGNMENT_KEYS = [
  "user_account_id",
  "role_code",
  "role_status",
] as const;

const GUIDE_PROFILE_KEYS = [
  "guide_profile_id",
  "user_account_id",
  "status",
] as const;

const EXPLORER_PROFILE_KEYS = [
  "explorer_profile_id",
  "user_account_id",
  "status",
] as const;

const GUIDE_EXPLORER_RELATIONSHIP_KEYS = [
  "guide_explorer_relationship_id",
  "guide_profile_id",
  "explorer_profile_id",
  "relationship_status",
] as const;

// Create a SolMindAuthQueryClient backed by the injected query executor.
//   - client: narrow scoped-select executor (real service-role client or mock).
//   - now: server-supplied current-time provider, called per session lookup so
//     the expiration rule stays deterministic and testable.
export function createSupabaseAuthQueryClient(args: {
  client: SupabaseQueryExecutor;
  now: () => Date;
}): SolMindAuthQueryClient {
  const { client, now } = args;

  return {
    async findAuthProviderIdentity({
      providerName,
      providerUserId,
    }): Promise<AuthProviderIdentityRow | null> {
      const result = await safeSelect(client, {
        schema: "identity",
        table: "auth_provider_identity",
        columns: [...AUTH_PROVIDER_IDENTITY_KEYS],
        filters: [
          { column: "provider_name", value: providerName },
          { column: "provider_user_id", value: providerUserId },
          { column: "status", value: "active" },
        ],
      });
      return singleRow(result, AUTH_PROVIDER_IDENTITY_KEYS);
    },

    async findUserAccountById({
      userAccountId,
    }): Promise<UserAccountRow | null> {
      const result = await safeSelect(client, {
        schema: "identity",
        table: "user_account",
        columns: [...USER_ACCOUNT_KEYS],
        filters: [{ column: "user_account_id", value: userAccountId }],
      });
      return singleRow(result, USER_ACCOUNT_KEYS);
    },

    async findActiveSessionByUserAccountId({
      userAccountId,
    }): Promise<UserSessionRow | null> {
      // Select ALL active sessions for the account (no limit/single) so that
      // multiple-active ambiguity remains visible to selectActiveUserSession.
      const result = await safeSelect(client, {
        schema: "identity",
        table: "user_session",
        columns: [...USER_SESSION_KEYS],
        filters: [
          { column: "user_account_id", value: userAccountId },
          { column: "session_status", value: SOLMIND_ACTIVE_SESSION_STATUS },
        ],
      });

      const rows = okRows(result);
      if (rows === null) {
        return null;
      }

      const candidates: UserSessionSelectionCandidate[] = [];
      for (const row of rows) {
        const picked = pickStrings(row, USER_SESSION_KEYS);
        if (picked === null) {
          // Fail closed on any invalid session row shape.
          return null;
        }
        candidates.push(picked);
      }

      const selected = selectActiveUserSession({ candidates, now: now() });
      if (selected === null) {
        return null;
      }

      // Project to the UserSessionRow shape the adapter expects (drop expires_at).
      return {
        user_account_id: selected.user_account_id,
        active_role_context: selected.active_role_context,
        session_status: selected.session_status,
      };
    },

    async findActiveRoleAssignment({
      userAccountId,
      roleCode,
    }): Promise<UserRoleAssignmentRow | null> {
      const result = await safeSelect(client, {
        schema: "identity",
        table: "user_role_assignment",
        columns: [...USER_ROLE_ASSIGNMENT_KEYS],
        filters: [
          { column: "user_account_id", value: userAccountId },
          { column: "role_code", value: roleCode },
          { column: "role_status", value: "active" },
        ],
      });
      return singleRow(result, USER_ROLE_ASSIGNMENT_KEYS);
    },

    async findGuideProfileByUserAccountId({
      userAccountId,
    }): Promise<GuideProfileRow | null> {
      const result = await safeSelect(client, {
        schema: "core",
        table: "guide_profile",
        columns: [...GUIDE_PROFILE_KEYS],
        filters: [
          { column: "user_account_id", value: userAccountId },
          { column: "status", value: "active" },
        ],
      });
      return singleRow(result, GUIDE_PROFILE_KEYS);
    },

    async findExplorerProfileByUserAccountId({
      userAccountId,
    }): Promise<ExplorerProfileRow | null> {
      const result = await safeSelect(client, {
        schema: "core",
        table: "explorer_profile",
        columns: [...EXPLORER_PROFILE_KEYS],
        filters: [
          { column: "user_account_id", value: userAccountId },
          { column: "status", value: "active" },
        ],
      });
      return singleRow(result, EXPLORER_PROFILE_KEYS);
    },

    async findGuideExplorerRelationshipById({
      relationshipId,
    }): Promise<GuideExplorerRelationshipRow | null> {
      const result = await safeSelect(client, {
        schema: "core",
        table: "guide_explorer_relationship",
        columns: [...GUIDE_EXPLORER_RELATIONSHIP_KEYS],
        filters: [
          {
            column: "guide_explorer_relationship_id",
            value: relationshipId,
          },
        ],
      });
      return singleRow(result, GUIDE_EXPLORER_RELATIONSHIP_KEYS);
    },
  };
}
