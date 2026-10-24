import { NextResponse, type NextRequest } from "next/server";
import { readSameOriginJsonWriteRequest } from "@/lib/solmind/auth/sameOriginJsonWriteRequest";
import { loadTrustedApplicationOrigin } from "@/lib/solmind/auth/trustedApplicationOrigin";
import { parseExplorerConversationCommand } from "@/lib/solmind/explorerConversationContract";
import { commandExplorerConversation } from "@/lib/solmind/virtual-guide/explorerConversationComposition";
import { createExplorerConversationRequestDependencies } from "@/lib/solmind/supabase/explorerConversationRequestDependencies";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: NextRequest): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  const denied = () => NextResponse.json({ ok: false, state: null, error: "denied" }, { headers });
  if (request.nextUrl.search) return denied();
  try {
    const guarded = await readSameOriginJsonWriteRequest({ request, trustedOrigin: loadTrustedApplicationOrigin() });
    if (!guarded.ok || !parseExplorerConversationCommand(guarded.value)) return denied();
    const dependencies = createExplorerConversationRequestDependencies(request.headers.get("cookie"));
    return NextResponse.json(await commandExplorerConversation({
      command: guarded.value, dependencies, signal: request.signal,
    }), { headers });
  } catch { return NextResponse.json({ ok: false, state: null, error: "unavailable" }, { headers }); }
}
