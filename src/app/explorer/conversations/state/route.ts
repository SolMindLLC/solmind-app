import { NextResponse, type NextRequest } from "next/server";
import { readEndedExplorerConversations } from "@/lib/solmind/virtual-guide/explorerPrivateConversationComposition";
import { createExplorerPrivateLocalRequestDependencies } from "@/lib/solmind/supabase/explorerConversationRequestDependencies";
import { isExplorerConversationId } from "@/lib/solmind/explorerConversationContract";
import { parseExplorerConversationReviewResult } from "@/lib/solmind/explorerConversationReviewContract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  const failure = (error: "denied" | "unavailable") => NextResponse.json({
    version: "explorer-conversation-review.v1", ok: false, items: null, state: null, error,
  }, { headers });
  const entries = [...request.nextUrl.searchParams.entries()];
  if (entries.length > 1 || (entries.length === 1 && entries[0][0] !== "conversationId")) return failure("denied");
  const conversationId = entries.length === 0 ? null : entries[0][1];
  if (conversationId !== null && !isExplorerConversationId(conversationId)) return failure("denied");
  try {
    const dependencies = createExplorerPrivateLocalRequestDependencies(request.headers.get("cookie"));
    const response = parseExplorerConversationReviewResult(await readEndedExplorerConversations(dependencies, conversationId));
    return response === null ? failure("unavailable") : NextResponse.json(response, { headers });
  } catch { return failure("unavailable"); }
}
