import { headers } from "next/headers";
import { ExplorerHome, ExplorerSessionOutcome } from "@/components/solmind/ExplorerHome";
import { resolveExplorerHomeAccess } from "@/lib/solmind/auth/explorerHomeAccess";
import { noopCookieSetAll } from "@/lib/solmind/auth/requestCookieAccessor";
import { readRawRequestCookies } from "@/lib/solmind/auth/readRawRequestCookies";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ExplorerHomePage() {
  let access: Awaited<ReturnType<typeof resolveExplorerHomeAccess>> | null = null;
  try {
    const snapshot = readRawRequestCookies((await headers()).get("cookie"));
    if (snapshot !== null) {
      access = await resolveExplorerHomeAccess({ cookies: {
        getAll: () => snapshot.map(({ name, value }) => ({ name, value })), setAll: noopCookieSetAll,
      } });
    }
  } catch { /* Do not disclose header, configuration or authentication failures. */ }
  if (access?.allowed) return <ExplorerHome session={{ expiresAt: access.expiresAt, observedAt: access.observedAt }} />;
  return <ExplorerSessionOutcome outcome="session_ended" />;
}
