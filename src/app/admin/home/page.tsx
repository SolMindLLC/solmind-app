import { headers } from "next/headers";
import { AdminHome, AdminSessionOutcome } from "@/components/solmind/AdminHome";
import { resolveAdminHomeAccess } from "@/lib/solmind/auth/adminHomeAccess";
import { noopCookieSetAll } from "@/lib/solmind/auth/requestCookieAccessor";
import { readRawRequestCookies } from "@/lib/solmind/auth/readRawRequestCookies";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminHomePage() {
  let access: Awaited<ReturnType<typeof resolveAdminHomeAccess>> | null = null;
  try {
    const snapshot = readRawRequestCookies((await headers()).get("cookie"));
    if (snapshot !== null) {
      access = await resolveAdminHomeAccess({ cookies: {
        getAll: () => snapshot.map(({ name, value }) => ({ name, value })), setAll: noopCookieSetAll,
      } });
    }
  } catch { /* Do not disclose header, configuration or authentication failures. */ }
  if (access?.allowed) return <AdminHome session={{ expiresAt: access.expiresAt, observedAt: access.observedAt }} />;
  return <AdminSessionOutcome outcome="session_ended" />;
}
