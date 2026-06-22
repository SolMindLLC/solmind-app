// SolMind MVP0 server-only Supabase service-role client factory.
//
// Purpose:
//   - construct the server-only Supabase client that uses the service-role key,
//     and adapt it to the narrow SupabaseQueryExecutor the auth query client
//     consumes.
//
// Server-only boundary (critical):
//   - The service-role key BYPASSES RLS. This module must never run in the
//     browser. The `server-only` package is not a dependency in this slice, so
//     the boundary is enforced by a runtime guard and by keeping this module OFF
//     the shared src/lib/solmind/supabase index barrel. Import it only from
//     explicit server paths.
//   - Authorization is NOT done here. Every service-role read must run behind
//     deriveTrustedServerAuthContext and the guard layer, which stay the
//     authority. This module is a small factory/adapter only.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { readSupabaseServiceRoleEnv } from "./serverEnv";
import {
  type SupabaseQueryExecutor,
  type SupabaseQueryResult,
} from "./supabaseAuthQueryClient";

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: serviceRoleClient must not be imported in browser code.",
  );
}

// Create the server-only service-role Supabase client. Sessions are not
// persisted or refreshed; this client is for server-side data access only.
export function createServiceRoleClient(): SupabaseClient {
  const { supabaseUrl, serviceRoleKey } = readSupabaseServiceRoleEnv();
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Adapt a Supabase client to the narrow scoped-select executor. Each call runs a
// schema-qualified select with equality filters and returns rows or an error.
export function createServiceRoleQueryExecutor(
  client: SupabaseClient,
): SupabaseQueryExecutor {
  return {
    async select({ schema, table, columns, filters }): Promise<SupabaseQueryResult> {
      let query = client.schema(schema).from(table).select(columns.join(", "));
      for (const filter of filters) {
        query = query.eq(filter.column, filter.value);
      }
      const { data, error } = await query;
      return { data: (data as unknown[] | null) ?? null, error: error ?? null };
    },
  };
}
