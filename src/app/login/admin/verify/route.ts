import type { NextRequest } from "next/server";
import { createAdminSignInHttpPorts } from "@/lib/solmind/supabase/adminSignInHttpPorts";
import { handleAdminSignInVerify } from "@/lib/solmind/supabase/passwordRoleSignInHttpHandlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: NextRequest) {
  return handleAdminSignInVerify(request, createAdminSignInHttpPorts());
}
