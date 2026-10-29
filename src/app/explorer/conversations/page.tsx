import { ExplorerConversationReview } from "@/components/solmind/ExplorerConversationReview";

// Public shell only. Authenticated no-store GETs own all private review access.
export default function ExplorerConversationsPage() {
  return <ExplorerConversationReview />;
}
