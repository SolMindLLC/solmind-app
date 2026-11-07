import { NextResponse, type NextRequest } from "next/server";
import { createExplorerPrivateConversationRequestDependencies } from "@/lib/solmind/supabase/explorerConversationRequestDependencies";
import { isExplorerYourWaypointsOffset, readExplorerYourWaypoints } from "@/lib/solmind/supabase/explorerYourWaypointsComposition";
import { EXPLORER_YOUR_WAYPOINTS_VERSION, parseExplorerYourWaypointsListResult } from "@/lib/solmind/explorerYourWaypointsContract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// One page of the signed-in Explorer's own Waypoints. The only query is an optional page offset; identity, role and
// ownership come from the sign-in and SQL, never the request.
export async function GET(request: NextRequest): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  const failure = (error: "denied" | "unavailable") => NextResponse.json({ version: EXPLORER_YOUR_WAYPOINTS_VERSION,
    kind: "list", ok: false, items: null, hasMore: false, nextOffset: null, error }, { headers });
  const entries = [...request.nextUrl.searchParams.entries()];
  if (entries.length > 1 || (entries.length === 1 && entries[0][0] !== "offset")) return failure("denied");
  const raw = entries.length === 0 ? "0" : entries[0][1];
  const offset = /^(?:0|[1-9][0-9]{0,9})$/.test(raw) ? Number(raw) : -1;
  if (!isExplorerYourWaypointsOffset(offset)) return failure("denied");
  try {
    const dependencies = createExplorerPrivateConversationRequestDependencies(request.headers.get("cookie"));
    const response = parseExplorerYourWaypointsListResult(await readExplorerYourWaypoints(dependencies, offset));
    return response === null ? failure("unavailable") : NextResponse.json(response, { headers });
  } catch { return failure("unavailable"); }
}
