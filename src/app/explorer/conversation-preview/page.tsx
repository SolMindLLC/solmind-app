import type { Metadata } from "next";

import { ExplorerConversationScreenPreview } from "@/components/solmind/ExplorerConversationScreenPreview";
import { PREVIEW_PAGE_DESCRIPTION, PREVIEW_PAGE_TITLE } from "@/lib/solmind/explorerConversationScreen";

export const metadata: Metadata = {
  title: PREVIEW_PAGE_TITLE,
  description: PREVIEW_PAGE_DESCRIPTION,
};

// Interim design review only. No sign-in check, data, or connection is added.
export default function ExplorerConversationPreviewPage() {
  return <ExplorerConversationScreenPreview />;
}
