export const SOLMIND_EXPLORER_TOPICS = [
  "Getting to know you",
  "Self-sabotage patterns",
  "Today's check-in",
  "Goals and next steps",
  "Something difficult",
  "Just talk",
] as const;

export type SolMindExplorerTopic =
  (typeof SOLMIND_EXPLORER_TOPICS)[number];