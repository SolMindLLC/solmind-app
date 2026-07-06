// SolMind MVP0 server-only Supabase RPC executor (Option B enumerated-function transport).
//
// Purpose:
//   - implement the narrow, injectable SupabaseQueryExecutor over the six banked
//     public.solmind_find_* lookup functions (AUTH-RLS-DEC-026), replacing the retired
//     generic PostgREST scoped-select executor. Each scoped-select spec is dispatched to
//     exactly one enumerated function via a closed allowlist, so a leaked service-role key
//     can invoke only these six fixed lookups and no arbitrary table/column read remains.
//
// Server-only boundary (critical):
//   - The service-role key BYPASSES RLS and every enumerated function is service_role-only,
//     so this module must never run in the browser. The `import "server-only";` marker is the
//     import-time guard (AUTH-RLS-DEC-023), backed by the runtime browser guard below, and this
//     module stays OFF the shared src/lib/solmind/supabase/index.ts barrel (AUTH-RLS-DEC-007).
//     It is imported only from the explicit /admin server composition root (adminAuthSource.ts).
//
// Scope discipline (transport swap only; contract Sections 6, 10, 11):
//   - This executor LOADS records and decides nothing. deriveTrustedServerAuthContext and the
//     guard layer stay the authority and re-validate status/role/account exactly. The SQL status
//     predicates baked into the functions are row-selection defense-in-depth, not a second
//     authorization authority, so they are NOT re-asserted here (that would duplicate a check the
//     contract reserves for the derivation layer).
//   - Fail closed: an unknown or mismatched spec (including the deliberately-absent Guide-Explorer
//     relationship lookup, AUTH-RLS-DEF-018), a missing required argument, or any .rpc() failure
//     resolves to a detail-free sentinel error that the upstream query client turns into a null
//     record and a deny. No error body, URL, argument, or credential leaves the server.

import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import {
  type SupabaseQueryExecutor,
  type SupabaseQueryFilter,
  type SupabaseQueryResult,
  type SupabaseQuerySpec,
} from "./supabaseAuthQueryClient";

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: serviceRoleRpcExecutor must not be imported in browser code.",
  );
}

// Detail-free sentinel errors. They carry no dynamic value from the spec or the underlying
// failure, so a connection string, key, argument, or error body can never leak through the
// returned error. Any non-null error causes the query client to fail closed (deny).
export const RPC_UNMAPPED_SPEC_ERROR = "solmind_rpc_unmapped_spec";
export const RPC_FAILED_ERROR = "solmind_rpc_failed";

// One allowlist entry per approved lookup. buildArgs reads only the DYNAMIC filter values
// (by column name) and maps them to the function's named parameters; the baked status
// predicates and the spec.columns list are intentionally not forwarded, because the function
// bakes `status = 'active'` (etc.) and fixes its RETURNS TABLE columns. buildArgs returns null
// when a required filter is absent, which fails the spec closed (mismatched/malformed spec).
type RpcAllowlistEntry = {
  functionName: string;
  buildArgs: (
    filters: readonly SupabaseQueryFilter[],
  ) => Record<string, string> | null;
};

// Return the first filter value for the given column, or null when it is absent.
function filterValue(
  filters: readonly SupabaseQueryFilter[],
  column: string,
): string | null {
  for (const filter of filters) {
    if (filter.column === column) {
      return filter.value;
    }
  }
  return null;
}

// Build named RPC args from a fixed list of [rpcParam, specColumn] pairs; null if any is absent.
function requireArgs(
  filters: readonly SupabaseQueryFilter[],
  pairs: ReadonlyArray<readonly [string, string]>,
): Record<string, string> | null {
  const args: Record<string, string> = {};
  for (const [param, column] of pairs) {
    const value = filterValue(filters, column);
    if (value === null) {
      return null;
    }
    args[param] = value;
  }
  return args;
}

// Closed allowlist keyed by `${schema}.${table}`. There is deliberately no entry for
// core.guide_explorer_relationship (AUTH-RLS-DEF-018) or any other lookup, so every
// unrecognized spec falls through to the unmapped-spec sentinel and denies.
const RPC_ALLOWLIST: Record<string, RpcAllowlistEntry> = {
  "identity.auth_provider_identity": {
    functionName: "solmind_find_auth_provider_identity",
    buildArgs: (filters) =>
      requireArgs(filters, [
        ["p_provider_name", "provider_name"],
        ["p_provider_user_id", "provider_user_id"],
      ]),
  },
  "identity.user_account": {
    functionName: "solmind_find_user_account",
    buildArgs: (filters) =>
      requireArgs(filters, [["p_user_account_id", "user_account_id"]]),
  },
  "identity.user_session": {
    functionName: "solmind_find_active_user_sessions",
    buildArgs: (filters) =>
      requireArgs(filters, [["p_user_account_id", "user_account_id"]]),
  },
  "identity.user_role_assignment": {
    functionName: "solmind_find_active_role_assignment",
    buildArgs: (filters) =>
      requireArgs(filters, [
        ["p_user_account_id", "user_account_id"],
        ["p_role_code", "role_code"],
      ]),
  },
  "core.guide_profile": {
    functionName: "solmind_find_guide_profile",
    buildArgs: (filters) =>
      requireArgs(filters, [["p_user_account_id", "user_account_id"]]),
  },
  "core.explorer_profile": {
    functionName: "solmind_find_explorer_profile",
    buildArgs: (filters) =>
      requireArgs(filters, [["p_user_account_id", "user_account_id"]]),
  },
};

// Adapt a server-only service-role Supabase client to the narrow scoped-select executor by
// dispatching each spec to its enumerated public.solmind_find_* function. The client's default
// `public` profile is used (createServiceRoleClient sets no db.schema), which is where the
// functions live. Fails closed on any unknown/mismatched spec, missing argument, or .rpc() error.
export function createServiceRoleRpcExecutor(
  client: SupabaseClient,
): SupabaseQueryExecutor {
  return {
    async select(spec: SupabaseQuerySpec): Promise<SupabaseQueryResult> {
      const entry = RPC_ALLOWLIST[`${spec.schema}.${spec.table}`];
      if (entry === undefined) {
        return { data: null, error: RPC_UNMAPPED_SPEC_ERROR };
      }

      const args = entry.buildArgs(spec.filters);
      if (args === null) {
        return { data: null, error: RPC_UNMAPPED_SPEC_ERROR };
      }

      try {
        const { data, error } = await client.rpc(entry.functionName, args);
        if (error !== null && error !== undefined) {
          // Swallow the underlying error; return only a value-free sentinel so no URL,
          // key, or error body can leak. Upstream okRows treats this as a deny.
          return { data: null, error: RPC_FAILED_ERROR };
        }
        // A non-array result (never expected from a RETURNS TABLE function) fails closed.
        return { data: Array.isArray(data) ? data : null, error: null };
      } catch {
        return { data: null, error: RPC_FAILED_ERROR };
      }
    },
  };
}
