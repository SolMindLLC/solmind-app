import { headers } from "next/headers";
import { AdminHome, AdminSessionOutcome } from "@/components/solmind/AdminHome";
import { resolveAdminPeopleAccess } from "@/lib/solmind/auth/adminWorkspaceAccess";
import { noopCookieSetAll } from "@/lib/solmind/auth/requestCookieAccessor";
import { readRawRequestCookies } from "@/lib/solmind/auth/readRawRequestCookies";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Guides and Explorers (minimal Admin screens, decision queue 2026-11-03
// 11:56:14 and 12:19:09: sign-ins only), guarded and read in this request.
export default async function AdminPeoplePage() {
  let access: Awaited<ReturnType<typeof resolveAdminPeopleAccess>> | null = null;
  try {
    const snapshot = readRawRequestCookies((await headers()).get("cookie"));
    if (snapshot !== null) {
      access = await resolveAdminPeopleAccess({ cookies: {
        getAll: () => snapshot.map(({ name, value }) => ({ name, value })), setAll: noopCookieSetAll,
      } });
    }
  } catch { /* Do not disclose header, configuration or authentication failures. */ }
  if (access?.allowed) {
    return <AdminHome session={{ expiresAt: access.expiresAt, observedAt: access.observedAt }} view={access.view} />;
  }
  return <AdminSessionOutcome outcome="session_ended" />;
}
