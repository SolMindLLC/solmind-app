import { formingSuggestionsForMessage } from "./explorerCompassSuggestionReplies";
import type { ExplorerConversationState } from "./explorerConversationContract";
import { formingWaypointForMessage } from "./explorerWaypointDraft";

// Paul's reply-choice decision, 2026-11-05: choices on the latest saved reply
// send their exact label as an ordinary Explorer message through the Send gate.
// These labels and calm prompts are Paul's approved wording (wording read,
// decision queue 2026-11-06 08:56:47 CST); change them only with his approval.
export const REPLY_CHOICES_GROUP_LABEL = "Suggested replies";
export const SOMETHING_ELSE_LABEL = "Something else";
export const CALM_REPLY_PROMPTS: readonly string[] = Object.freeze([
  "Take your time. What's on your mind?",
  "I'm listening. What would you like to talk about?",
  "There's no right way to begin. Start wherever feels easiest.",
  "Go ahead, in your own words.",
  "Whatever feels most important right now is a good place to start.",
  "Share as much or as little as you like.",
  "What would be most helpful to talk about?",
  "You can start anywhere. What's on your mind?",
  "Say it however it comes to you.",
  "What's been on your mind lately?",
  "We can go wherever you'd like. Where would you like to start?",
  "Put it in your own words, and we'll take it from there.",
  "What matters most to you right now?",
  "Take a moment if you need it. What would you like to talk about?",
  "It doesn't have to come out perfectly. What's on your mind?",
  "What would you like me to understand?",
  "Start with whatever is easiest to say.",
  "Is there something else you'd rather talk about?",
  "I'm here. What would you like to share?",
  "When you're ready, tell me what's on your mind.",
]);

// Pick from the remaining lines directly; no retries or saved randomness.
export function nextCalmReplyPrompt(previous: string | null, random: () => number = Math.random): string {
  const candidates = CALM_REPLY_PROMPTS.filter(prompt => prompt !== previous);
  return candidates[Math.floor(random() * candidates.length)];
}

export type LatestReplyChoices = Readonly<{ messageId: string; labels: readonly string[] }>;

// Follow the coarse S6a display value: restricted, adults-only and unconfirmed
// conversations, ended conversations and pending turns show no choices.
// One group of buttons per reply (Paul's decision, PRJ01-SPR002 decision queue,
// morning meeting entry of 2026-11-10, item 14): when the latest reply also
// carries a forming Compass suggestion or a forming Waypoint draft, those
// buttons are shown and the reply choices are held back, so the screen, the
// Send check and the composer all treat the choices as not offered.
export function latestReplyChoices(state: ExplorerConversationState): LatestReplyChoices | null {
  if (state.sessionStatus === "ended" || state.pendingTurn || state.compassSuggestionReplies !== "available") return null;
  const last = state.messages[state.messages.length - 1];
  if (last === undefined || last.role !== "virtualGuide" || last.choices === undefined || last.choices.length === 0) return null;
  if (formingSuggestionsForMessage(state, last.id).length > 0 || formingWaypointForMessage(state, last.id) !== null) return null;
  return Object.freeze({ messageId: last.id, labels: Object.freeze(last.choices.map(choice => choice.label)) });
}
