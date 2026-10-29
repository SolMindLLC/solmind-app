// Login step 6, sub-slice S6-8: the Explorer "send a code" route.
//
// A thin POST-only handler. In order: it loads the trusted origin (the guard
// takes it as an input), runs the same-origin JSON guard before any other
// work, denies any query parameter, checks the body shape, and makes one call
// into the server composition, which owns everything from there to the
// outward result. Every answer is HTTP 200 with one of the closed results in
// its JSON body and the same fixed headers. No answer of this route sets a
// cookie.
//
// Nothing here reads a role, an account id, a session id, a purpose or a
// return address: the body parser refuses a body that carries any key but
// the one it lists.

import { type NextRequest, NextResponse } from "next/server";

import { readSameOriginJsonWriteRequest } from "@/lib/solmind/auth/sameOriginJsonWriteRequest";
import { loadTrustedApplicationOrigin } from "@/lib/solmind/auth/trustedApplicationOrigin";
import { requestExplorerSignInCode } from "@/lib/solmind/supabase/explorerSignInComposition";
import {
  EXPLORER_SIGN_IN_DENIED,
  EXPLORER_SIGN_IN_RESPONSE_HEADERS,
  parseExplorerSignInSendBody,
  type ExplorerSignInSendResult,
} from "@/lib/solmind/supabase/explorerSignInRouteContract";

export const dynamic = "force-dynamic";

function json(result: ExplorerSignInSendResult): Response {
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

  const body = parseExplorerSignInSendBody(guarded.value);
  if (body === null) {
    return json(EXPLORER_SIGN_IN_DENIED);
  }

  try {
    return json(
      await requestExplorerSignInCode({
        trustedOrigin,
        identifier: body.identifier,
        ...("flowId" in body ? { flowId: body.flowId } : {}),
      }),
    );
  } catch {
    // Reachable only if the composition breaks its promise never to throw.
    return json(EXPLORER_SIGN_IN_DENIED);
  }
}
