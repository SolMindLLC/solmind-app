// SolMind MVP0 server-only Admin auth source factory (record-load assembly).
//
// Purpose:
//   - assemble the already-built service-role loading chain into a single real
//     SolMindAuthSource for the /admin route-access path ONLY:
//       createServiceRoleClient()
//         -> createServiceRoleQueryExecutor(client)
//         -> createSupabaseAuthQueryClient({ client, now })
//         -> createSupabaseAuthSource(queryClient)
//   - give the /admin composition root a concrete, real record-load seam to inject
//     into resolveAdminRouteAccess, replacing reliance on the deferred
//     deny-by-default in-memory source for the real request path
//     (Doc 15 Sections 5-6; AUTH-RLS-DEF-009, AUTH-RLS-DEF-010).
//
// Server-only boundary (critical):
//   - The service-role key BYPASSES RLS, so this module must never run in the
//     browser. The `server-only` package is now installed
//     (AUTH-RLS-DEC-023, AUTH-RLS-DEF-001); the `import "server-only";` marker below
//     is the import-time guard, backed by the runtime browser guard, matching the
//     existing server-only family (serviceRoleClient.ts, serverEnv.ts,
//     requestAuthClient.ts, composeRequestAuthContext.ts, adminRouteAccess.ts).
//   - This module stays OFF the shared src/lib/solmind/supabase/index.ts and
//     src/lib/solmind/auth/index.ts barrels (AUTH-RLS-DEC-007, AUTH-RLS-DEC-013).
//     It is imported only from the explicit /admin server composition root.
//
// Scope discipline (Doc 15 Sections 4, 8):
//   - This is a DEDICATED admin-access assembler, not a broad/generic service-role
//     helper or a reusable data-access client. It exposes no "run any query"
//     surface; the only service-role read path remains the narrow scoped executor
//     the auth query client already defines.
//   - It LOADS records only and authorizes nothing. Authority stays in
//     deriveTrustedServerAuthContext and authorizeRouteAccess, which re-validate
//     every record link independently. Identity (WHO) stays entirely on the
//     injected principal source; this module supplies only the WHAT (records).
//   - Role separation preserved: it loads only the requester's own already-modeled
//     identity/session/role records by the server-verified principal. It assembles
//     no Explorer-private or Guide-private context and blends no AI roles.

import "server-only";

import {
  createServiceRoleClient,
  createServiceRoleQueryExecutor,
} from "./serviceRoleClient";
import {
  createSupabaseAuthQueryClient,
  type SupabaseQueryExecutor,
} from "./supabaseAuthQueryClient";
import { createSupabaseAuthSource } from "./serverAuthSourceAdapter";
import { type SolMindAuthSource } from "../auth";

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: adminAuthSource must not be imported in browser code.",
  );
}

// Assemble the real SolMindAuthSource from an INJECTED scoped-select executor.
//
// This is the deterministic, IO-free seam: it wires the existing query client and
// mapping adapter over whatever executor it is given. The production factory below
// passes the real service-role executor; tests pass a mock executor with a fixed
// clock (no network, DB, or env). Keeping the executor injectable is what makes the
// admin-access assembly unit-testable without touching Supabase.
export function createAdminAuthSourceFromExecutor(args: {
  executor: SupabaseQueryExecutor;
  now: () => Date;
}): SolMindAuthSource {
  const queryClient = createSupabaseAuthQueryClient({
    client: args.executor,
    now: args.now,
  });
  return createSupabaseAuthSource(queryClient);
}

// Construct the REAL Admin auth source for the /admin route-access path.
//
//   - now: server-supplied current-time provider, threaded into the session
//     expiration rule (deterministic; the route passes () => new Date(), tests a
//     fixed clock).
//
// It reads the service-role env and builds the server-only service-role client
// here (via createServiceRoleClient), then delegates to the injectable assembler
// above. A missing/blank service-role env throws at construction; the /admin route
// composition root catches that and denies (fail closed, no detail leaked).
export function createAdminAuthSource(args: {
  now: () => Date;
}): SolMindAuthSource {
  const client = createServiceRoleClient();
  const executor = createServiceRoleQueryExecutor(client);
  return createAdminAuthSourceFromExecutor({ executor, now: args.now });
}
