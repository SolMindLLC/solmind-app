import { NextResponse, type NextRequest } from "next/server";
import { readSameOriginJsonWriteRequest } from "@/lib/solmind/auth/sameOriginJsonWriteRequest";
import { loadTrustedApplicationOrigin } from "@/lib/solmind/auth/trustedApplicationOrigin";
import { createExplorerPrivateConversationRequestDependencies } from "@/lib/solmind/supabase/explorerConversationRequestDependencies";
import { closeExplorerYourWaypoint } from "@/lib/solmind/supabase/explorerYourWaypointsComposition";
import {
  EXPLORER_YOUR_WAYPOINTS_VERSION, parseExplorerYourWaypointsCloseCommand, parseExplorerYourWaypointsCloseResult,
} from "@/lib/solmind/explorerYourWaypointsContract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Marks a Waypoint from an ended conversation Reached or Released. Same order as the conversation commands: no query,
// trusted origin, the bounded same-origin JSON reader, an exact-key body, then the sign-in and one repository call.
export async function POST(request: NextRequest): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  const failure = (error: "denied" | "conflict" | "unavailable") => NextResponse.json({
    version: EXPLORER_YOUR_WAYPOINTS_VERSION, kind: "close", ok: false, replay: false, item: null, error }, { headers });
  if (request.nextUrl.search) return failure("denied");
  try {
    const guarded = await readSameOriginJsonWriteRequest({ request, trustedOrigin: loadTrustedApplicationOrigin() });
    if (!guarded.ok || !parseExplorerYourWaypointsCloseCommand(guarded.value)) return failure("denied");
    const dependencies = createExplorerPrivateConversationRequestDependencies(request.headers.get("cookie"));
    const response = parseExplorerYourWaypointsCloseResult(await closeExplorerYourWaypoint(dependencies, guarded.value));
    return response === null ? failure("unavailable") : NextResponse.json(response, { headers });
  } catch { return failure("unavailable"); }
}
