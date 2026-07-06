// SolMind MVP0 server-only Supabase service-role client factory.
//
// Purpose:
//   - construct the server-only Supabase client that uses the service-role key. The
//     /admin-access transport adapts this client to the narrow SupabaseQueryExecutor via the
//     enumerated RPC executor (serviceRoleRpcExecutor.ts). This module holds only the client
//     factory; the generic scoped-select executor has been retired (Option B, AUTH-RLS-DEC-026)
//     so no dormant broad-query capability remains.
//
// Server-only boundary (critical):
//   - The service-role key BYPASSES RLS. This module must never run in the
//     browser. The `server-only` package is now a direct dependency, so the
//     boundary is enforced at IMPORT time by the `import "server-only";` marker
//     below (AUTH-RLS-DEC-023), backed by the runtime browser guard and by keeping
//     this module OFF the shared src/lib/solmind/supabase index barrel. Import it
//     only from explicit server paths.
//   - Authorization is NOT done here. Every service-role read must run behind
//     deriveTrustedServerAuthContext and the guard layer, which stay the
//     authority. This module is a small factory only.

import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { readSupabaseServiceRoleEnv } from "./serverEnv";

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
