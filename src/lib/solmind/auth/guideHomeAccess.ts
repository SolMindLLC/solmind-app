// Server-only Guide home guard used by the protected /guide/home page.
// The caller supplies request cookies, never a role, account or destination.
// Existing adapters verify identity, then load and bind current SolMind records.
// No cookie mutation, refresh, logout, feature eligibility or provider dispatch.
import "server-only";

import { GUIDE_HOME_ROUTE } from "../routeAccess";
import { createSupabaseRequestAuthPrincipalSource } from "../supabase/requestAuthClient";
import { createServiceRoleClient } from "../supabase/serviceRoleClient";
import { createServiceRoleRpcExecutor } from "../supabase/serviceRoleRpcExecutor";
import { createSupabaseAuthQueryClient } from "../supabase/supabaseAuthQueryClient";
import { createSupabaseAuthSource } from "../supabase/serverAuthSourceAdapter";
import { composeRequestAuthContext } from "./composeRequestAuthContext";
import { type RequestCookieAccessor } from "./requestCookieAccessor";
import { ROUTE_ACCESS_DENY_REASON } from "./routeAccessDecision";

if (typeof window !== "undefined") {
  throw new Error("SolMind server configuration error: Guide home access is server-only.");
}

export type GuideHomeAccessResult =
  | Readonly<{ allowed: true; expiresAt: string; observedAt: string }>
  | Readonly<{ allowed: false; reason: typeof ROUTE_ACCESS_DENY_REASON }>;

const DENIED: GuideHomeAccessResult = Object.freeze({
  allowed: false,
  reason: ROUTE_ACCESS_DENY_REASON,
});

export async function resolveGuideHomeAccess(args: {
  cookies: RequestCookieAccessor;
  // Trusted server clock/test seam; never a browser-supplied timestamp.
  now?: () => Date;
}): Promise<GuideHomeAccessResult> {
  try {
    const now = args.now ?? (() => new Date());
    const principalSource = createSupabaseRequestAuthPrincipalSource({ cookies: args.cookies });
    const authSource = createSupabaseAuthSource(createSupabaseAuthQueryClient({
      client: createServiceRoleRpcExecutor(createServiceRoleClient()),
      now,
    }));
    const result = await composeRequestAuthContext(
      { principalSource, authSource },
      { selectors: { requestedRoute: GUIDE_HOME_ROUTE } },
    );
    if (!result.allowed) return DENIED;

    // Record loading may have crossed expiry after selection. Recheck at the
    // projection boundary; future protected operations must still authenticate.
    const observed = now();
    const observedMs = observed.getTime();
    const expiresMs = Date.parse(result.context.session.expiresAt);
    if (!Number.isFinite(observedMs) || !Number.isFinite(expiresMs) || expiresMs <= observedMs) {
      return DENIED;
    }
    return Object.freeze({
      allowed: true,
      expiresAt: result.context.session.expiresAt,
      observedAt: observed.toISOString(),
    });
  } catch {
    // No token, cookie, provider error, record or configuration value escapes.
    return DENIED;
  }
}
