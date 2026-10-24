import { NextResponse, type NextRequest } from "next/server";
import { readExplorerConversation } from "@/lib/solmind/virtual-guide/explorerConversationComposition";
import { createExplorerConversationRequestDependencies } from "@/lib/solmind/supabase/explorerConversationRequestDependencies";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (request.nextUrl.search) return NextResponse.json({ ok: false, state: null, error: "denied" }, { headers });
  try {
    const dependencies = createExplorerConversationRequestDependencies(request.headers.get("cookie"));
    return NextResponse.json(await readExplorerConversation(dependencies), { headers });
  } catch { return NextResponse.json({ ok: false, state: null, error: "unavailable" }, { headers }); }
}
