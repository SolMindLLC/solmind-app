// Login step 6, sub-slice S6-8: the Explorer "verify the code and sign in"
// route.
//
// A thin POST-only handler. In order: it loads the trusted origin (the guard
// takes it as an input), runs the same-origin JSON guard before any other
// work, denies any query parameter, checks the body shape, reads the
// request's cookies once, captures an optional cleanup-only candidate, keeps
// only names for the cookie writer, and makes one call into the
// server composition, which owns everything from there to the outward
// result. Every answer is HTTP 200 with one of the closed results in its JSON
// body and the same fixed headers.
//
// The request's cookies. Names-only writer input clears old chunks. A separate
// format-checked candidate reaches only the optional old-session cleanup
// closure, which runs after independent fresh authentication and accepted
// SolMind session creation. An incoming auth or binding cookie can never
// select or satisfy this new sign-in.
//
// The success response. This file hands the composition a function that
// makes it. The composition calls that function only after the SolMind
// session exists, writes both cookies onto the response, and returns it only
// when the write succeeded. For every other outcome this file sends a fresh
// answer built from a fixed constant, so no response that might carry a
// cookie is sent on a failure.
//
// Nothing here reads a role, an account id, a session id, a purpose or a
// return address: the body parser refuses a body that carries any key but
// the three it lists, and the destination a success names is one server
// constant.

import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { readSameOriginJsonWriteRequest } from "@/lib/solmind/auth/sameOriginJsonWriteRequest";
import { readSessionAuthCookieCleanupCandidate, resolveSessionCookiePolicy } from "@/lib/solmind/auth/sessionCookiePolicy";
import { loadTrustedApplicationOrigin } from "@/lib/solmind/auth/trustedApplicationOrigin";
import { verifyExplorerSignInCode } from "@/lib/solmind/supabase/explorerSignInComposition";
import {
  EXPLORER_SIGN_IN_CODE_NOT_ACCEPTED,
  EXPLORER_SIGN_IN_DENIED,
  EXPLORER_SIGN_IN_RESPONSE_HEADERS,
  EXPLORER_SIGN_IN_SIGNED_IN,
  parseExplorerSignInVerifyBody,
  type ExplorerSignInVerifyBodyResult,
} from "@/lib/solmind/supabase/explorerSignInRouteContract";

export const dynamic = "force-dynamic";

function json(result: ExplorerSignInVerifyBodyResult): NextResponse {
  return NextResponse.json(result, {
    status: 200,
    headers: EXPLORER_SIGN_IN_RESPONSE_HEADERS,
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  let trustedOrigin: string;
  try {
    trustedOrigin = loadTrustedApplicationOrigin();
  } catch {
    return json(EXPLORER_SIGN_IN_DENIED);
  }

  const guarded = await readSameOriginJsonWriteRequest({
    request,
    trustedOrigin,
  });
  if (!guarded.ok) {
    return json(EXPLORER_SIGN_IN_DENIED);
  }

  if ([...request.nextUrl.searchParams.keys()].length > 0) {
    return json(EXPLORER_SIGN_IN_DENIED);
  }

  const body = parseExplorerSignInVerifyBody(guarded.value);
  if (body === null) {
    return json(EXPLORER_SIGN_IN_DENIED);
  }

  try {
    const cookieStore = await cookies();
    const incoming = cookieStore.getAll().map(({ name, value }) => ({ name, value }));
    const policy = resolveSessionCookiePolicy(trustedOrigin);
    // Capture before independent fresh authentication. This candidate reaches
    // only the optional accepted-login cleanup closure, never an auth lookup.
    const priorCleanupCandidate = policy === null ? null : readSessionAuthCookieCleanupCandidate(policy, incoming);
    const requestCookies = incoming.map((cookie) => ({ name: cookie.name, value: "" }));
    const result = await verifyExplorerSignInCode({
      trustedOrigin,
      identifier: body.identifier,
      ...("flowId" in body ? { flowId: body.flowId } : { challengeId: body.challengeId }),
      code: body.code,
      requestCookies,
      priorCleanupCandidate,
      createSuccessResponse: () => json(EXPLORER_SIGN_IN_SIGNED_IN),
    });
    if (result.outcome === "signed_in") {
      return result.response;
    }
    return json(
      result.outcome === "code_not_accepted"
        ? EXPLORER_SIGN_IN_CODE_NOT_ACCEPTED
        : EXPLORER_SIGN_IN_DENIED,
    );
  } catch {
    // Reachable only if reading the cookies throws, or if the composition
    // breaks its promise never to throw.
    return json(EXPLORER_SIGN_IN_DENIED);
  }
}
