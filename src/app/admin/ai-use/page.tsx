import { headers } from "next/headers";
import { AdminHome, AdminSessionOutcome } from "@/components/solmind/AdminHome";
import { resolveAdminAiUseAccess } from "@/lib/solmind/auth/adminWorkspaceAccess";
import { noopCookieSetAll } from "@/lib/solmind/auth/requestCookieAccessor";
import { readRawRequestCookies } from "@/lib/solmind/auth/readRawRequestCookies";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// AI use and pauses (minimal Admin screens, decision queue 2026-11-03
// 11:56:14), guarded and read in this request.
export default async function AdminAiUsePage() {
  let access: Awaited<ReturnType<typeof resolveAdminAiUseAccess>> | null = null;
  try {
    const snapshot = readRawRequestCookies((await headers()).get("cookie"));
    if (snapshot !== null) {
      access = await resolveAdminAiUseAccess({ cookies: {
        getAll: () => snapshot.map(({ name, value }) => ({ name, value })), setAll: noopCookieSetAll,
      } });
    }
  } catch { /* Do not disclose header, configuration or authentication failures. */ }
  if (access?.allowed) {
    return <AdminHome session={{ expiresAt: access.expiresAt, observedAt: access.observedAt }} view={access.view} />;
  }
  return <AdminSessionOutcome outcome="session_ended" />;
}
