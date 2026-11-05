import { redirect } from "next/navigation";

import { EXPLORER_HOME_ROUTE } from "@/lib/solmind/routeAccess";

// The address /explorer opens the Explorer Overview. The June onboarding and
// sharing mockup that used to be here was removed (Paul, decision queue
// 2026-11-04 21:44:03 CST). The Overview keeps its own sign-in check.
export default function ExplorerPage(): never {
  redirect(EXPLORER_HOME_ROUTE);
}
