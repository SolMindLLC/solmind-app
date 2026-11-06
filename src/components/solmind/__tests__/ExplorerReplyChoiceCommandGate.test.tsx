import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectedConversationActions } from "../ExplorerConversationConnectedScreen";
import { ExplorerConversation } from "../ExplorerConversation";
import {
  EXPLORER_CONVERSATION_LIMITS,
  parseExplorerConversationState,
  type ExplorerConversationState,
} from "../../../lib/solmind/explorerConversationContract";
import { EXPLORER_PRIVATE_RESPONSE_VERSION } from "../../../lib/solmind/explorerPrivateConversationResponse";

// Exercise the real command closures after their initial read, without a DOM
// or network. The existing turned-down-limit gate uses the same effect harness.
const captured = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[],
  actions: null as ConnectedConversationActions | null,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useEffect: (effect: () => void | (() => void)) => { captured.effects.push(effect); } };
});
vi.mock("../ExplorerConversationConnectedScreen", () => ({
  ExplorerConversationConnectedScreen: ({ actions }: { actions: ConnectedConversationActions }) => {
    captured.actions = actions;
    return null;
  },
}));

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const LABEL = "I have a question";
function state(overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  return { waypointCapacity: { activeCount: 0, activeLimit: 20, historyRoom: true }, waypointProjection: { kind: "current_heads" as const, limit: 20 as const, totalHeads: 0, hasMore: false },
    version: "explorer-conversation.v1", conversationId: id(1), revision: 3,
    pendingTurn: false, turnedDownLimitReached: false, providerState: "available",
    compassSuggestionReplies: "available", sessionStatus: "active", ending: null,
    messages: [{ id: id(2), role: "virtualGuide", body: "A synthetic reply.",
      createdAt: "2026-11-05T12:00:00Z", choices: [{ label: LABEL }] }],
    compassItems: [], priorityId: null, attentionId: null, waypoints: [], waypointDraft: null,
    ...overrides,
  };
}
const json = (body: unknown) => new Response(JSON.stringify(body), {
  headers: { "Content-Type": "application/json" },
});
const cleanups: (() => void)[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  captured.effects = [];
  captured.actions = null;
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function loaded(next = state()) {
  // Each refused-send case must have a valid loaded state, not a malformed read.
  expect(parseExplorerConversationState(JSON.parse(JSON.stringify(next)))).not.toBeNull();
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => json({
    version: EXPLORER_PRIVATE_RESPONSE_VERSION,
    result: { ok: true, state: next, error: null }, assistance: null,
  }));
  vi.stubGlobal("fetch", fetch);
  renderToStaticMarkup(createElement(ExplorerConversation));
  for (const effect of captured.effects) {
    const cleanup = effect();
    if (cleanup) cleanups.push(cleanup);
  }
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch.mock.calls[0][0]).toBe("/explorer/conversation/state");
  expect(captured.actions).not.toBeNull();
  fetch.mockClear();
  // A malformed command result is deliberately uncertain, never a saved reply.
  fetch.mockImplementation(async () => json({ unconfirmed: true }));
  return { fetch, actions: captured.actions! };
}

describe("saved reply choice controller gate", () => {
  it("sends the exact label as one ordinary Send even when tapped twice immediately", async () => {
    const f = await loaded();
    f.actions.onReplyChoice(LABEL);
    f.actions.onReplyChoice(LABEL);
    expect(f.fetch).toHaveBeenCalledOnce();
    const [url, init] = f.fetch.mock.calls[0];
    expect(url).toBe("/explorer/conversation/commands");
    expect(init).toMatchObject({ method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error" });
    expect(JSON.parse(init!.body as string)).toEqual({
      kind: "send", body: LABEL, expectedRevision: 3, replyChoice: true,
      operationId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
    });
  });

  it("rejects a label the saved reply did not offer, without trimming or substitution", async () => {
    const f = await loaded();
    f.actions.onReplyChoice("An invented reply");
    f.actions.onReplyChoice(` ${LABEL} `);
    expect(f.fetch).not.toHaveBeenCalled();
  });

  it("rejects an earlier reply's choice once another saved message is latest", async () => {
    const initial = state();
    const f = await loaded(state({ messages: [...initial.messages, {
      id: id(3), role: "virtualGuide", body: "A later synthetic reply without choices.", createdAt: "2026-11-05T12:01:00Z",
    }] }));
    f.actions.onReplyChoice(LABEL);
    expect(f.fetch).not.toHaveBeenCalled();
  });

  it.each([undefined, "support", "adult_policy", "unavailable"] as const)(
    "rejects choices when reply availability is %s", async compassSuggestionReplies => {
      const f = await loaded(state({ compassSuggestionReplies }));
      f.actions.onReplyChoice(LABEL);
      expect(f.fetch).not.toHaveBeenCalled();
    });

  it.each([
    ["pending", { pendingTurn: true }],
    ["ended", { sessionStatus: "ended", providerState: "unavailable" }],
    ["provider unavailable", { providerState: "unavailable" }],
  ] as const)("rejects a choice while %s", async (_name, overrides) => {
    const f = await loaded(state(overrides));
    f.actions.onReplyChoice(LABEL);
    expect(f.fetch).not.toHaveBeenCalled();
  });

  it("requires room for both the Explorer message and reply", async () => {
    const message = state().messages[0];
    const f = await loaded(state({ messages: Array.from({ length: EXPLORER_CONVERSATION_LIMITS.messages - 1 },
      (_, index) => ({ ...message, id: id(100 + index) })) }));
    f.actions.onReplyChoice(LABEL);
    expect(f.fetch).not.toHaveBeenCalled();
  });

  it("holds new taps after an uncertain result and retries the identical serialized Send", async () => {
    const f = await loaded();
    f.actions.onReplyChoice(LABEL);
    const original = f.fetch.mock.calls[0][1]!.body;
    await vi.advanceTimersByTimeAsync(0);
    f.actions.onReplyChoice(LABEL);
    expect(f.fetch).toHaveBeenCalledOnce();
    f.actions.onRetry();
    expect(f.fetch).toHaveBeenCalledTimes(2);
    expect(f.fetch.mock.calls[1][0]).toBe("/explorer/conversation/commands");
    expect(f.fetch.mock.calls[1][1]!.body).toBe(original);
    await vi.advanceTimersByTimeAsync(0);
    f.actions.onReplyChoice(LABEL);
    expect(f.fetch).toHaveBeenCalledTimes(2);
  });
});
