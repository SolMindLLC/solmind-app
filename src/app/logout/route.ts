import { readRawRequestCookies } from "@/lib/solmind/auth/readRawRequestCookies";
import { loadTrustedApplicationOrigin } from "@/lib/solmind/auth/trustedApplicationOrigin";
import { handleLogout } from "@/lib/solmind/supabase/logoutComposition";
import {
  createLogoutDatabaseDependencies, createLogoutProviderCleanupDependencies,
} from "@/lib/solmind/supabase/logoutDependencies";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleLogout(request, {
    loadOrigin: loadTrustedApplicationOrigin,
    // Called only after the existing same-origin guard. Preserve owned raw
    // duplicates and malformed framing so it cannot masquerade as absence.
    readCookies: async () => readRawRequestCookies(request.headers.get("cookie")),
    createDatabase: createLogoutDatabaseDependencies,
    createProvider: createLogoutProviderCleanupDependencies,
    report: (category) => { console.warn(category); },
  });
}
