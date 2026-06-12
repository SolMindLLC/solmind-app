import { SOLMIND_EXPLORER_CONVERSATION_PREVIEW_MESSAGES } from "@/lib/solmind/conversation";

export function ConversationPreview() {
  return (
    <div className="mt-8 space-y-4">
      {SOLMIND_EXPLORER_CONVERSATION_PREVIEW_MESSAGES.map((message) => (
        <div key={message.id} className="rounded-2xl bg-slate-800 p-4">
          {message.body}
        </div>
      ))}
    </div>
  );
}