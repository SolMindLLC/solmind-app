import { NextResponse, type NextRequest } from "next/server";
import { readSameOriginJsonWriteRequest } from "@/lib/solmind/auth/sameOriginJsonWriteRequest";
import { loadTrustedApplicationOrigin } from "@/lib/solmind/auth/trustedApplicationOrigin";
import { parseExplorerConversationCommand } from "@/lib/solmind/explorerConversationContract";
import { commandExplorerPrivateConversation } from "@/lib/solmind/virtual-guide/explorerPrivateConversationComposition";
import { createExplorerPrivateLocalRequestDependencies } from "@/lib/solmind/supabase/explorerConversationRequestDependencies";
import { EXPLORER_PRIVATE_RESPONSE_VERSION, parseExplorerPrivateConversationResponse } from "@/lib/solmind/explorerPrivateConversationResponse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: NextRequest): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  const failure = (error: "denied" | "unavailable") => NextResponse.json({ version: EXPLORER_PRIVATE_RESPONSE_VERSION,
    result: { ok: false, state: null, error }, assistance: null }, { headers });
  const denied = () => failure("denied");
  if (request.nextUrl.search) return denied();
  try {
    const guarded = await readSameOriginJsonWriteRequest({ request, trustedOrigin: loadTrustedApplicationOrigin() });
    if (!guarded.ok || !parseExplorerConversationCommand(guarded.value)) return denied();
    const dependencies = createExplorerPrivateLocalRequestDependencies(request.headers.get("cookie"));
    const output = await commandExplorerPrivateConversation({
      command: guarded.value, dependencies, signal: request.signal,
    });
    const response = parseExplorerPrivateConversationResponse({ version: EXPLORER_PRIVATE_RESPONSE_VERSION, ...output });
    return response === null ? failure("unavailable") : NextResponse.json(response, { headers });
  } catch { return failure("unavailable"); }
}
