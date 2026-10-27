import { NextResponse, type NextRequest } from "next/server";
import { readExplorerPrivateConversation } from "@/lib/solmind/virtual-guide/explorerPrivateConversationComposition";
import { createExplorerPrivateLocalRequestDependencies } from "@/lib/solmind/supabase/explorerConversationRequestDependencies";
import { EXPLORER_PRIVATE_RESPONSE_VERSION, parseExplorerPrivateConversationResponse } from "@/lib/solmind/explorerPrivateConversationResponse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  const failure = (error: "denied" | "unavailable") => NextResponse.json({ version: EXPLORER_PRIVATE_RESPONSE_VERSION,
    result: { ok: false, state: null, error }, assistance: null }, { headers });
  if (request.nextUrl.search) return failure("denied");
  try {
    const dependencies = createExplorerPrivateLocalRequestDependencies(request.headers.get("cookie"));
    const output = await readExplorerPrivateConversation(dependencies);
    const response = parseExplorerPrivateConversationResponse({ version: EXPLORER_PRIVATE_RESPONSE_VERSION, ...output });
    return response === null ? failure("unavailable") : NextResponse.json(response, { headers });
  } catch { return failure("unavailable"); }
}
