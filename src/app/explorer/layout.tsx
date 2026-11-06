import type { ReactNode } from "react";
import { ExplorerEarlyTestNoticeBoundary, ExplorerEarlyTestNoticeUnavailable } from "@/components/solmind/ExplorerEarlyTestNotice";
import { resolveExplorerEarlyTestNoticeSetting } from "@/lib/solmind/auth/explorerEarlyTestNoticeAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The on boundary hides screens; each feature route independently gates data.
// Pages must remain account-data-free shells, including their RSC payloads.
// Data-free review pages share this layout; capability off returns them unchanged.
export default async function ExplorerLayout({ children }: Readonly<{ children: ReactNode }>) {
  const setting = await resolveExplorerEarlyTestNoticeSetting();
  if (setting === "off") return children;
  if (setting === "unavailable") return <ExplorerEarlyTestNoticeUnavailable />;
  return <ExplorerEarlyTestNoticeBoundary>{children}</ExplorerEarlyTestNoticeBoundary>;
}
