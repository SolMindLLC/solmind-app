import { describe, expect, it } from "vitest";

import { EXPLORER_CONVERSATION_VERSION, type ExplorerConversationState } from "./explorerConversationContract";
import { CALM_REPLY_PROMPTS, REPLY_CHOICES_GROUP_LABEL, SOMETHING_ELSE_LABEL, latestReplyChoices, nextCalmReplyPrompt } from "./explorerReplyChoices";

const EXPLORER_MESSAGE = "20000000-0000-4000-8000-000000000001";
const GUIDE_MESSAGE = "30000000-0000-4000-8000-000000000001";
const CHOICES = [{ label: "Show me around" }, { label: "I have a question" }, { label: "Let's begin" }];

function state(overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  return {
    version: EXPLORER_CONVERSATION_VERSION,
    conversationId: "10000000-0000-4000-8000-000000000001",
    revision: 3,
    pendingTurn: false,
    turnedDownLimitReached: false,
    providerState: "available",
    compassSuggestionReplies: "available",
    messages: [
      { id: EXPLORER_MESSAGE, role: "explorer", body: "A synthetic first message", createdAt: "2026-11-05T08:00:00.000Z" },
      { id: GUIDE_MESSAGE, role: "virtualGuide", body: "A synthetic reply", createdAt: "2026-11-05T08:00:01.000Z", choices: CHOICES },
    ],
    compassItems: [],
    priorityId: null,
    attentionId: null,
    waypoints: [],
    waypointDraft: null,
    route: [],
    sessionStatus: "active",
    ending: null,
    ...overrides,
  };
}

describe("reply choices as buttons (round r2)", () => {
  it("returns the latest saved Virtual Guide reply's choices in order, frozen", () => {
    const latest = latestReplyChoices(state());
    expect(latest).toEqual({ messageId: GUIDE_MESSAGE, labels: ["Show me around", "I have a question", "Let's begin"] });
    expect(Object.isFrozen(latest)).toBe(true);
    expect(Object.isFrozen(latest?.labels)).toBe(true);
    expect(REPLY_CHOICES_GROUP_LABEL).toBe("Suggested replies");
  });

  it("offers nothing once a later message is saved, so a tap or a typed message ends the offer", () => {
    const original = state();
    expect(latestReplyChoices(state({ messages: [...original.messages,
      { id: "20000000-0000-4000-8000-000000000002", role: "explorer", body: "Show me around", createdAt: "2026-11-05T08:01:00.000Z" }] }))).toBeNull();
    expect(latestReplyChoices(state({ messages: [...original.messages,
      { id: "30000000-0000-4000-8000-000000000002", role: "virtualGuide", body: "A later reply", createdAt: "2026-11-05T08:01:01.000Z" }] }))).toBeNull();
  });

  it("offers nothing for a reply without choices, an empty conversation or an Explorer message last", () => {
    expect(latestReplyChoices(state({ messages: [state().messages[0],
      { id: GUIDE_MESSAGE, role: "virtualGuide", body: "A synthetic reply", createdAt: "2026-11-05T08:00:01.000Z" }] }))).toBeNull();
    expect(latestReplyChoices(state({ messages: [] }))).toBeNull();
    expect(latestReplyChoices(state({ messages: [state().messages[0]] }))).toBeNull();
  });

  it.each(["support", "adult_policy", "unavailable", undefined] as const)(
    "offers nothing when the conversation's reply availability is %s", availability => {
      expect(latestReplyChoices(state({ compassSuggestionReplies: availability }))).toBeNull();
    });

  it("offers nothing while a turn is pending or after the conversation ended", () => {
    expect(latestReplyChoices(state({ pendingTurn: true }))).toBeNull();
    expect(latestReplyChoices(state({ sessionStatus: "ended" }))).toBeNull();
  });
});

describe("Something else calm wording", () => {
  it("keeps Paul's exact 20 draft lines in one frozen list", () => {
    expect(SOMETHING_ELSE_LABEL).toBe("Something else");
    expect(CALM_REPLY_PROMPTS).toEqual([
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
    expect(Object.isFrozen(CALM_REPLY_PROMPTS)).toBe(true);
    expect(new Set(CALM_REPLY_PROMPTS).size).toBe(20);
    expect(CALM_REPLY_PROMPTS.every(line => /^[\x20-\x7e]+$/.test(line))).toBe(true);
  });

  it("can choose every line for a first press", () => {
    const chosen = CALM_REPLY_PROMPTS.map((_, index) =>
      nextCalmReplyPrompt(null, () => (index + 0.5) / CALM_REPLY_PROMPTS.length));
    expect(new Set(chosen)).toEqual(new Set(CALM_REPLY_PROMPTS));
  });

  it("can choose each other line without repeating the previous line, including both list edges", () => {
    for (const previous of CALM_REPLY_PROMPTS) {
      const chosen = Array.from({ length: CALM_REPLY_PROMPTS.length - 1 }, (_, index) =>
        nextCalmReplyPrompt(previous, () => (index + 0.5) / (CALM_REPLY_PROMPTS.length - 1)));
      expect(new Set(chosen)).toEqual(new Set(CALM_REPLY_PROMPTS.filter(line => line !== previous)));
      expect(nextCalmReplyPrompt(previous, () => 0)).not.toBe(previous);
      expect(nextCalmReplyPrompt(previous, () => 1 - Number.EPSILON)).not.toBe(previous);
    }
  });

  it("still rotates when repeated presses receive the same random value", () => {
    let previous: string | null = null;
    for (let press = 0; press < 50; press += 1) {
      const next = nextCalmReplyPrompt(previous, () => 0);
      expect(CALM_REPLY_PROMPTS).toContain(next);
      expect(next).not.toBe(previous);
      previous = next;
    }
  });
});
