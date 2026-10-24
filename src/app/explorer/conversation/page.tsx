import { ExplorerConversation } from "@/components/solmind/ExplorerConversation";

// Public shell only: no account, message, session or private state is rendered.
// Every private read/write is freshly authorized by the feature Route Handlers.
export default function ExplorerConversationPage() {
  return <ExplorerConversation />;
}
