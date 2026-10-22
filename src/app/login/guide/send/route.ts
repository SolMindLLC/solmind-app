import type { NextRequest } from "next/server";
import { createGuideSignInHttpPorts } from "@/lib/solmind/supabase/guideSignInHttpPorts";
import { handleGuideSignInSend } from "@/lib/solmind/supabase/passwordRoleSignInHttpHandlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: NextRequest) {
  return handleGuideSignInSend(request, createGuideSignInHttpPorts());
}
