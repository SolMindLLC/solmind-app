import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { readSameOriginJsonWriteRequest } from "../auth/sameOriginJsonWriteRequest";
import { readSessionAuthCookieCleanupCandidate, readSessionCookieEntries,
  resolveSessionCookiePolicy } from "../auth/sessionCookiePolicy";
import { parsePasswordRoleSignInSendBody, parsePasswordRoleSignInVerifyBody } from "./passwordRoleSignInBodies";
import { requestGuideSignInCode, requestAdminSignInCode, verifyGuideSignIn, verifyAdminSignIn,
  type PasswordRoleSignInPorts, type PasswordRoleSendResult } from "./passwordRoleSignInCore";
import { GUIDE_SIGN_IN_ROUTE_PATHS, ADMIN_SIGN_IN_ROUTE_PATHS, GUIDE_SIGN_IN_SIGNED_IN,
  ADMIN_SIGN_IN_SIGNED_IN, GUIDE_SIGN_IN_INVALID_EMAIL, ADMIN_SIGN_IN_INVALID_IDENTIFIER,
  PASSWORD_ROLE_SIGN_IN_DENIED, PASSWORD_ROLE_SIGN_IN_NOT_MATCHED,
  PASSWORD_ROLE_SIGN_IN_RESPONSE_HEADERS, PASSWORD_ROLE_SIGN_IN_RESPONSE_STATUS,
  type GuideSignInSendResult, type AdminSignInSendResult,
  type GuideSignInVerifyBodyResult, type AdminSignInVerifyBodyResult } from "./passwordRoleSignInRouteContract";

// Adapters for adopted Guide/Admin R04, with its review clarification.
// Four fixed entry points; separate connected Guide and Admin roots register them.
// Next route registration and production factories remain separate owners. No environment defaults, provider, logging, retry or new floor.
// Trusted executable seams below are supplied only by server composition. They
// must be bounded and resolve configuration before remote work. Neither a browser
// body nor an incoming cookie can supply a port, role, account or destination.
// The shared guard bounds bytes, not elapsed stream time; this module adds no
// deadline policy and does not claim real network, GET 405 or cookie acceptance.

type CleanupCandidate = ReturnType<typeof readSessionAuthCookieCleanupCandidate>;
export type PasswordRoleSignInHttpPorts = Readonly<{
  loadTrustedOrigin(): string;
  createSendPorts(trustedOrigin: string): PasswordRoleSignInPorts;
  // This untrusted captured pair is cleanup-only. The trusted factory keeps it
  // in the actual bridge's optional accepted-login cleanup closure, never in
  // account lookup, authentication or the core request. Null also means malformed.
  createVerifyPorts(trustedOrigin: string, priorCleanupCandidate: CleanupCandidate): PasswordRoleSignInPorts;
  readCookies(): unknown | Promise<unknown>;
}>;

type Body = GuideSignInSendResult | AdminSignInSendResult |
  GuideSignInVerifyBodyResult | AdminSignInVerifyBodyResult;
function json(body: Body): NextResponse {
  return NextResponse.json(body, {
    status: PASSWORD_ROLE_SIGN_IN_RESPONSE_STATUS,
    headers: PASSWORD_ROLE_SIGN_IN_RESPONSE_HEADERS,
  });
}
function denied(): NextResponse { return json(PASSWORD_ROLE_SIGN_IN_DENIED); }

async function guardedBody(request: NextRequest, trustedOrigin: string, path: string): Promise<unknown | null> {
  const guarded = await readSameOriginJsonWriteRequest({ request, trustedOrigin });
  if (!guarded.ok || request.nextUrl.pathname !== path || request.nextUrl.searchParams.size !== 0) return null;
  return guarded.value;
}

async function send(request: NextRequest, ports: PasswordRoleSignInHttpPorts,
  path: string, run: typeof requestGuideSignInCode, invalid: typeof GUIDE_SIGN_IN_INVALID_EMAIL | typeof ADMIN_SIGN_IN_INVALID_IDENTIFIER,
): Promise<NextResponse> {
  try {
    const trustedOrigin = ports.loadTrustedOrigin();
    const body = parsePasswordRoleSignInSendBody(await guardedBody(request, trustedOrigin, path));
    if (body === null) return denied();
    const result: PasswordRoleSendResult = await run({ trustedOrigin, body }, ports.createSendPorts(trustedOrigin));
    // The actual core validates and minimizes this acknowledgment. It makes no
    // account, issuance or delivery claim. There is no success response cookie.
    if ("acknowledgment" in result) return json(result);
    return result.outcome === invalid.outcome ? json(invalid) : denied();
  } catch { return denied(); }
}

async function verify(request: NextRequest, ports: PasswordRoleSignInHttpPorts,
  path: string, run: typeof verifyGuideSignIn,
  success: typeof GUIDE_SIGN_IN_SIGNED_IN | typeof ADMIN_SIGN_IN_SIGNED_IN,
): Promise<NextResponse> {
  try {
    const trustedOrigin = ports.loadTrustedOrigin();
    const body = parsePasswordRoleSignInVerifyBody(await guardedBody(request, trustedOrigin, path));
    if (body === null) return denied();
    // Read once and snapshot own data fields before yielding to dependencies.
    const incoming = readSessionCookieEntries(await ports.readCookies(), false);
    const policy = resolveSessionCookiePolicy(trustedOrigin);
    if (incoming === null || policy === null) return denied();
    const priorCleanupCandidate = readSessionAuthCookieCleanupCandidate(policy, incoming);
    const requestCookies = Object.freeze(incoming.map(({ name }) => Object.freeze({ name, value: "" })));
    const corePorts = ports.createVerifyPorts(trustedOrigin, priorCleanupCandidate);
    const result = await run({ trustedOrigin, body, requestCookies, createSuccessResponse: () => json(success) }, corePorts);
    if (result.outcome === "signed_in") return result.response;
    // A failed writer may have partly changed its private success object. Return
    // a fresh fixed response; never serialize or recycle that object on refusal.
    return result.outcome === "not_matched" ? json(PASSWORD_ROLE_SIGN_IN_NOT_MATCHED) : denied();
  } catch { return denied(); }
}

export function handleGuideSignInSend(request: NextRequest, ports: PasswordRoleSignInHttpPorts): Promise<NextResponse> {
  return send(request, ports, GUIDE_SIGN_IN_ROUTE_PATHS.send, requestGuideSignInCode, GUIDE_SIGN_IN_INVALID_EMAIL);
}
export function handleAdminSignInSend(request: NextRequest, ports: PasswordRoleSignInHttpPorts): Promise<NextResponse> {
  return send(request, ports, ADMIN_SIGN_IN_ROUTE_PATHS.send, requestAdminSignInCode, ADMIN_SIGN_IN_INVALID_IDENTIFIER);
}
export function handleGuideSignInVerify(request: NextRequest, ports: PasswordRoleSignInHttpPorts): Promise<NextResponse> {
  return verify(request, ports, GUIDE_SIGN_IN_ROUTE_PATHS.verify, verifyGuideSignIn, GUIDE_SIGN_IN_SIGNED_IN);
}
export function handleAdminSignInVerify(request: NextRequest, ports: PasswordRoleSignInHttpPorts): Promise<NextResponse> {
  return verify(request, ports, ADMIN_SIGN_IN_ROUTE_PATHS.verify, verifyAdminSignIn, ADMIN_SIGN_IN_SIGNED_IN);
}
