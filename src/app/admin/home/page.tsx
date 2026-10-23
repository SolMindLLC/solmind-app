import { headers } from "next/headers";
import { AdminHome, AdminSessionOutcome } from "@/components/solmind/AdminHome";
import { resolveAdminHomeAccess } from "@/lib/solmind/auth/adminHomeAccess";
import { noopCookieSetAll, type RequestCookie } from "@/lib/solmind/auth/requestCookieAccessor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Next RequestCookies uses a Map and URI decoding. Read the wire header instead
// so duplicate names or malformed owned values cannot disappear before the
// reviewed authentication adapter. Do not decode, merge or trim cookie values.
function rawCookies(raw: string | null): RequestCookie[] | null {
  if (raw === null || raw === "") return [];
  if (raw.length > 16_384) return null;
  const parts = raw.split(";");
  if (parts.length > 128) return null;
  const result: RequestCookie[] = [];
  for (const segment of parts) {
    const pair = segment.replace(/^[\t ]+/, "");
    const equals = pair.indexOf("=");
    if (equals < 1) return null;
    const name = pair.slice(0, equals);
    const value = pair.slice(equals + 1);
    if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name) ||
        !/^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]*$/.test(value)) return null;
    result.push({ name, value });
  }
  return result;
}

export default async function AdminHomePage() {
  let access: Awaited<ReturnType<typeof resolveAdminHomeAccess>> | null = null;
  try {
    const snapshot = rawCookies((await headers()).get("cookie"));
    if (snapshot !== null) {
      access = await resolveAdminHomeAccess({ cookies: {
        getAll: () => snapshot.map(({ name, value }) => ({ name, value })), setAll: noopCookieSetAll,
      } });
    }
  } catch { /* Do not disclose header, configuration or authentication failures. */ }
  if (access?.allowed) return <AdminHome session={{ expiresAt: access.expiresAt, observedAt: access.observedAt }} />;
  return <AdminSessionOutcome outcome="session_ended" />;
}
