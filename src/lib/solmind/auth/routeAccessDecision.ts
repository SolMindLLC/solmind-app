// SolMind MVP0 route access decision helper.
//
// Purpose:
//   - compose trusted server auth context derivation with the static route
//     access rules into a single deterministic allow/deny decision a future
//     route or server action can call;
//   - prove the server-mediated pattern end to end: derive trusted context
//     server-side, accept browser values as selectors only, and decide from
//     the server-derived active role, never from a client-claimed role.
//
// Architecture notes (MVP0):
//   - The decision authority is the activeRole on the TrustedServerAuthContext
//     produced by deriveTrustedServerAuthContext. The browser-supplied
//     requestedRole is a SELECTOR only; it is intentionally never consulted for
//     the access decision. A request claiming requestedRole 'admin' cannot open
//     '/admin' unless the server-derived activeRole is itself 'admin'.
//   - requestedRoute is also a selector: it names which route the client wants;
//     the route access rules decide whether the server-derived role may have it.
//   - Denial is deny-by-default and intentionally opaque. Every failure
//     (derivation failure, unknown route, role/route mismatch, selector
//     spoofing) collapses to one generic outward reason. The caller never
//     learns which record or internal derivation step failed.
//   - This helper is pure and deterministic. It makes NO Supabase, network,
//     filesystem, cookie, header, or environment calls, and performs no
//     redirects. It only composes existing pure helpers.
//
// This module adds NO new role strings or product terms, and NO relationship
// or profile authorization logic.

import { canSolMindRoleAccessRoute } from "../routeAccess";
import {
  deriveTrustedServerAuthContext,
  type DeriveTrustedServerAuthContextInput,
  type TrustedServerAuthContext,
} from "./serverAuthContext";

// --- Browser/request selectors (NOT authority) ---
//
// Raw values supplied by the request. They only SELECT which route decision to
// attempt. requestedRole is accepted but never used to authorize; it exists so
// callers can pass through what the client claimed without that claim ever
// becoming authority.
export type RouteAccessSelectors = {
  requestedRoute: string;
  requestedRole?: string;
};

// --- Decision input ---
//
// serverAuthContext is the trusted, server-loaded record set consumed by
// deriveTrustedServerAuthContext (reused wholesale). selectors are the
// browser-supplied values, kept deliberately separate from the trusted records.
export type AuthorizeRouteAccessInput = {
  serverAuthContext: DeriveTrustedServerAuthContextInput;
  selectors: RouteAccessSelectors;
};

// --- Generic outward denial reason ---
//
// Deny results expose only this single code. Internal derivation reasons and
// record-level detail are intentionally not surfaced to the caller.
export const ROUTE_ACCESS_DENY_REASON = "route_access_denied" as const;

export type RouteAccessDenyReason = typeof ROUTE_ACCESS_DENY_REASON;

// --- Result shape ---

export type AuthorizeRouteAccessResult =
  | { allowed: true; context: TrustedServerAuthContext }
  | { allowed: false; reason: RouteAccessDenyReason };

function denyRouteAccess(): AuthorizeRouteAccessResult {
  return { allowed: false, reason: ROUTE_ACCESS_DENY_REASON };
}

// Decide whether the request may access requestedRoute.
//
// Deny-by-default: returns an allow result ONLY when the trusted context
// derives successfully AND the server-derived active role is permitted on the
// requested route. Any failure returns the same generic denial.
export function authorizeRouteAccess(
  input: AuthorizeRouteAccessInput,
): AuthorizeRouteAccessResult {
  // 1. Derive the trusted server auth context. On any derivation failure, deny
  //    without surfacing the internal reason.
  const derivation = deriveTrustedServerAuthContext(input.serverAuthContext);
  if (!derivation.allowed) {
    return denyRouteAccess();
  }

  const { context } = derivation;

  // 2. Authorize the requested route using the SERVER-DERIVED active role only.
  //    input.selectors.requestedRole is never consulted here. Unknown routes
  //    and role/route mismatches both return false and deny by default.
  if (!canSolMindRoleAccessRoute(context.activeRole, input.selectors.requestedRoute)) {
    return denyRouteAccess();
  }

  return { allowed: true, context };
}
