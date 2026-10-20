import { cookies } from "next/headers";
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
    // Route Handlers expose Next's mutable cookies, which carry response
    // metadata such as path. The strict auth reader accepts name/value only.
    readCookies: async () => (await cookies()).getAll().map(({ name, value }) => ({ name, value })),
    createDatabase: createLogoutDatabaseDependencies,
    createProvider: createLogoutProviderCleanupDependencies,
    report: (category) => { console.warn(category); },
  });
}
