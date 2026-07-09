// SolMind MVP0 server-only Admin audit event writer factory (AUD-3 write-chain assembly).
//
// Purpose:
//   - assemble the already-built audit write chain into a single real
//     AuthRlsAuditEventWriter for the /admin/access composition path ONLY:
//       createServiceRoleClient()
//         -> createAuditEventWriteExecutor(client)
//         -> createAuthRlsAuditEventWriter({ executor })
//   - give the /admin composition root a concrete, real audit persistence seam to
//     resolve as its default, retiring the default-off / no-op posture for the
//     production /admin/access boundary (audit persistence contract Doc 22
//     Section 11; AUTH-RLS-DEC-028 write transport; AUTH-RLS-DEC-029/030 timing
//     and ordering are applied by the caller, adminAccessRequest.ts).
//   - mirror the banked read-chain assembler (adminAuthSource.ts): this is the
//     sibling server-only chain assembled at the same composition root as the
//     banked read chain; the read chain itself is untouched.
//
// Server-only boundary (critical):
//   - The service-role key BYPASSES RLS and the audit writer function is
//     service_role-only, so this module must never run in the browser. The
//     `import "server-only";` marker is the import-time guard (AUTH-RLS-DEC-023),
//     backed by the runtime browser guard below, and this module stays OFF the
//     shared src/lib/solmind/supabase/index.ts and src/lib/solmind/auth/index.ts
//     barrels (AUTH-RLS-DEC-007). It is imported only from the explicit /admin
//     server composition path.
//
// Scope discipline:
//   - This is a DEDICATED admin-access audit assembler, not a broad/generic audit
//     or service-role helper. The only write path it exposes is the banked AUD-2
//     closed-allowlist seam over the single enumerated AUD-1 function
//     public.solmind_record_audit_event; there is no other intent, function, or
//     table reachable from it.
//   - It WRITES bounded audit rows only and decides nothing. The per-class
//     write-failure posture (fail-closed vs best-effort, Doc 22 Section 10) is
//     applied by the composition boundary (adminAccessRequest.ts), which consumes
//     the writer's result-based, never-throwing persist contract.
//   - A missing/blank service-role env throws at construction (inside
//     createServiceRoleClient); the /admin composition root guards that
//     construction and treats audit persistence as unavailable (fail-closed for
//     the allow path), leaking no detail.

import "server-only";

import { createServiceRoleClient } from "./serviceRoleClient";
import { createAuditEventWriteExecutor } from "./auditEventWriteExecutor";
import {
  createAuthRlsAuditEventWriter,
  type AuthRlsAuditEventWriter,
} from "../auth/auditEventWriter";

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: adminAuditEventWriter must not be imported in browser code.",
  );
}

// Construct the REAL Admin audit event writer for the /admin/access path.
//
// It reads the service-role env and builds the server-only service-role client
// here (via createServiceRoleClient), adapts it to the closed-allowlist audit
// write executor, then wraps it in the banked AUD-2 writer. A missing/blank
// service-role env throws at construction; the /admin composition root catches
// that and treats audit persistence as unavailable (the allow path then fails
// closed, best-effort paths proceed unchanged, and no detail leaks).
export function createAdminAuditEventWriter(): AuthRlsAuditEventWriter {
  const client = createServiceRoleClient();
  const executor = createAuditEventWriteExecutor(client);
  return createAuthRlsAuditEventWriter({ executor });
}
