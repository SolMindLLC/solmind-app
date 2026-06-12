export type SolMindConversationMessageRole =
  | "virtualGuide"
  | "explorer"
  | "system";

export type SolMindConversationPreviewMessage = {
  id: string;
  role: SolMindConversationMessageRole;
  body: string;
};

export const SOLMIND_EXPLORER_CONVERSATION_PREVIEW_MESSAGES: SolMindConversationPreviewMessage[] =
  [
    {
      id: "welcome",
      role: "virtualGuide",
      body: "Welcome. What would feel most helpful to explore today?",
    },
  ];