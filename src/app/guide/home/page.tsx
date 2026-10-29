import { headers } from "next/headers";
import { GuideHome, GuideSessionOutcome } from "@/components/solmind/GuideHome";
import { resolveGuideHomeAccess } from "@/lib/solmind/auth/guideHomeAccess";
import { noopCookieSetAll } from "@/lib/solmind/auth/requestCookieAccessor";
import { readRawRequestCookies } from "@/lib/solmind/auth/readRawRequestCookies";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function GuideHomePage() {
  let access: Awaited<ReturnType<typeof resolveGuideHomeAccess>> | null = null;
  try {
    const snapshot = readRawRequestCookies((await headers()).get("cookie"));
    if (snapshot !== null) {
      access = await resolveGuideHomeAccess({ cookies: {
        getAll: () => snapshot.map(({ name, value }) => ({ name, value })), setAll: noopCookieSetAll,
      } });
    }
  } catch { /* Do not disclose header, configuration or authentication failures. */ }
  if (access?.allowed) return <GuideHome session={{ expiresAt: access.expiresAt, observedAt: access.observedAt }} />;
  return <GuideSessionOutcome outcome="session_ended" />;
}
