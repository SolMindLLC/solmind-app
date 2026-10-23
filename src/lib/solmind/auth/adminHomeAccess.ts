// Server-only fixed Admin home guard. Reuse the audited request composition
// exactly once; return only the safe session-display projection.
import "server-only";

import { resolveAdminHomeForRequest } from "./adminAccessRequest";
import { type RequestCookieAccessor } from "./requestCookieAccessor";
import { ROUTE_ACCESS_DENY_REASON } from "./routeAccessDecision";

if (typeof window !== "undefined") {
  throw new Error("SolMind server configuration error: Admin home access is server-only.");
}

export type AdminHomeAccessResult =
  | Readonly<{ allowed: true; expiresAt: string; observedAt: string }>
  | Readonly<{ allowed: false; reason: typeof ROUTE_ACCESS_DENY_REASON }>;

const DENIED: AdminHomeAccessResult = Object.freeze({
  allowed: false, reason: ROUTE_ACCESS_DENY_REASON,
});

export async function resolveAdminHomeAccess(args: {
  cookies: RequestCookieAccessor;
  now?: () => Date;
}): Promise<AdminHomeAccessResult> {
  try {
    const result = await resolveAdminHomeForRequest(args);
    return result.allowed
      ? Object.freeze({ allowed: true, expiresAt: result.expiresAt, observedAt: result.observedAt })
      : DENIED;
  } catch {
    return DENIED;
  }
}
