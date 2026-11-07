import { NextResponse, type NextRequest } from "next/server";
import { isExplorerConversationId } from "@/lib/solmind/explorerConversationContract";
import { createExplorerPrivateConversationRequestDependencies } from "@/lib/solmind/supabase/explorerConversationRequestDependencies";
import { readExplorerYourWaypointHistory } from "@/lib/solmind/supabase/explorerYourWaypointsComposition";
import { EXPLORER_YOUR_WAYPOINTS_VERSION, parseExplorerYourWaypointsHistoryResult } from "@/lib/solmind/explorerYourWaypointsContract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// One Waypoint's earlier versions. Exactly two opaque selectors; SQL rechecks the original owner of the conversation.
export async function GET(request: NextRequest): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  const failure = (error: "denied" | "unavailable") => NextResponse.json({ version: EXPLORER_YOUR_WAYPOINTS_VERSION,
    kind: "history", ok: false, waypointId: null, versions: null, complete: false, error }, { headers });
  const entries = [...request.nextUrl.searchParams.entries()];
  const names = entries.map(([name]) => name).sort();
  if (entries.length !== 2 || names[0] !== "conversationId" || names[1] !== "waypointId") return failure("denied");
  const conversationId = request.nextUrl.searchParams.get("conversationId");
  const waypointId = request.nextUrl.searchParams.get("waypointId");
  if (!isExplorerConversationId(conversationId) || !isExplorerConversationId(waypointId)) return failure("denied");
  try {
    const dependencies = createExplorerPrivateConversationRequestDependencies(request.headers.get("cookie"));
    const response = parseExplorerYourWaypointsHistoryResult(
      await readExplorerYourWaypointHistory(dependencies, conversationId, waypointId));
    return response === null ? failure("unavailable") : NextResponse.json(response, { headers });
  } catch { return failure("unavailable"); }
}
