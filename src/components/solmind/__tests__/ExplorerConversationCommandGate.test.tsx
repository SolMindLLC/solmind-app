import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectedConversationActions } from "../ExplorerConversationConnectedScreen";
import type { ExplorerConversationState } from "../../../lib/solmind/explorerConversationContract";
import { EXPLORER_PRIVATE_RESPONSE_VERSION } from "../../../lib/solmind/explorerPrivateConversationResponse";
import { ExplorerConversation } from "../ExplorerConversation";

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
const POINT = id(3);
function state(turnedDownLimitReached: boolean): ExplorerConversationState {
  return { version: "explorer-conversation.v1", conversationId: id(1), revision: 3,
    pendingTurn: false, turnedDownLimitReached, providerState: "available", compassSuggestionReplies: "available",
    messages: [{ id: id(2), role: "virtualGuide", body: "A synthetic suggestion.", createdAt: "2026-11-05T12:00:00Z" }],
    compassItems: [{ id: POINT, sourceMessageId: id(2), wordingMessageId: id(2), label: "A tentative point", formation: "forming" }],
    priorityId: null, attentionId: null, waypoints: [] };
}
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
async function loaded(turnedDownLimitReached: boolean) {
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({
    version: EXPLORER_PRIVATE_RESPONSE_VERSION,
    result: { ok: true, state: state(turnedDownLimitReached), error: null }, assistance: null,
  }), { headers: { "Content-Type": "application/json" } }));
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
  return { fetch, actions: captured.actions! };
}

describe("Explorer conversation turned-down limit command gate", () => {
  it("refuses a direct not_it intent locally after loading the limit, without sending a request", async () => {
    const f = await loaded(true);
    f.actions.onCommand({ kind: "respond_compass_suggestion", itemId: POINT, response: "not_it" });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetch).not.toHaveBeenCalled();
  });

  it.each([
    [false, "not_it"], [true, "right"], [true, "close"],
  ] as const)("permits response %s / %s through the same gate", async (limit, response) => {
    const f = await loaded(limit);
    f.actions.onCommand({ kind: "respond_compass_suggestion", itemId: POINT, response });
    expect(f.fetch).toHaveBeenCalledOnce();
    expect(f.fetch.mock.calls[0][0]).toBe("/explorer/conversation/commands");
    expect(JSON.parse(f.fetch.mock.calls[0][1]!.body as string)).toMatchObject({
      kind: "respond_compass_suggestion", itemId: POINT, response, expectedRevision: 3,
    });
  });
});
