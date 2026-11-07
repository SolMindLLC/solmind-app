import { createElement, type FormEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExplorerConversation } from "../ExplorerConversation";
import type { ConnectedConversationActions, ConnectedConversationView } from "../ExplorerConversationConnectedScreen";
import type { ExplorerConversationState } from "../../../lib/solmind/explorerConversationContract";
import { EXPLORER_PRIVATE_RESPONSE_VERSION } from "../../../lib/solmind/explorerPrivateConversationResponse";
import { EXPLORER_FAILED_REPLY_RETRY_DRAFT } from "../../../lib/solmind/virtual-guide/explorerPrivateConversationComposition";

const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, effects: [] as (() => void | (() => void))[],
  actions: null as ConnectedConversationActions | null, view: null as ConnectedConversationView | null }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.slots)) hooks.slots[index] = initial;
    return [hooks.slots[index], (next: unknown) => {
      hooks.slots[index] = typeof next === "function" ? next(hooks.slots[index]) : next;
    }];
  },
  useRef: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.slots)) hooks.slots[index] = { current: initial };
    return hooks.slots[index];
  },
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void)) => {
    const index = hooks.cursor++;
    if (!(index in hooks.slots)) { hooks.slots[index] = true; hooks.effects.push(effect); }
  },
}));
vi.mock("../ExplorerConversationConnectedScreen", () => ({
  ExplorerConversationConnectedScreen: ({ actions, view }: { actions: ConnectedConversationActions; view: ConnectedConversationView }) => {
    hooks.actions = actions; hooks.view = view; return null;
  },
}));

const id = (n: number) => `80000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const state: ExplorerConversationState = { version: "explorer-conversation.v1", conversationId: id(1), revision: 0,
  pendingTurn: false, turnedDownLimitReached: false, waypointDraft: null, providerState: "available", compassSuggestionReplies: "available",
  waypointCapacity: { activeCount: 0, activeLimit: 20, historyRoom: true, conversationRoom: true },
  waypointProjection: { kind: "current_heads", limit: 20, totalHeads: 0, hasMore: false },
  messages: [], compassItems: [], priorityId: null, attentionId: null, waypoints: [] };
const draft = "My thought stays in the conversation.";
const cleanups: (() => void)[] = [];
function render() { hooks.cursor = 0; renderToStaticMarkup(createElement(ExplorerConversation)); }
function response(result: unknown, assistance: unknown = null) {
  return new Response(JSON.stringify({ version: EXPLORER_PRIVATE_RESPONSE_VERSION, result, assistance }),
    { headers: { "Content-Type": "application/json" } });
}
beforeEach(() => {
  vi.useFakeTimers(); hooks.slots = []; hooks.cursor = 0; hooks.effects = []; hooks.actions = null; hooks.view = null;
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.useRealTimers(); vi.unstubAllGlobals();
});
async function loaded() {
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => response({ ok: true, state, error: null }));
  vi.stubGlobal("fetch", fetch); render();
  for (const effect of hooks.effects) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
  await vi.advanceTimersByTimeAsync(0); render();
  hooks.actions!.onDraftChange(draft); render(); fetch.mockClear();
  return fetch;
}
function send() { hooks.actions!.onSend({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>); }

describe("REV306 failed-reply controller", () => {
  it("retains the saved Explorer line and typed draft, with one counted request and an explicit retry available", async () => {
    const fetch = await loaded();
    const saved: ExplorerConversationState = { ...state, revision: 2, messages: [{
      id: id(2), role: "explorer", body: draft, createdAt: "2026-11-06T10:00:00Z",
    }] };
    fetch.mockImplementation(async () => response({ ok: true, state: saved, error: null }, {
      kind: "reply_failed", body: EXPLORER_FAILED_REPLY_RETRY_DRAFT, persisted: false,
    }));
    send(); await vi.advanceTimersByTimeAsync(0); render();
    expect(fetch).toHaveBeenCalledOnce();
    const command = JSON.parse(fetch.mock.calls[0][1]!.body as string);
    expect(command).toMatchObject({ kind: "send", body: draft, expectedRevision: 0 });
    expect(hooks.view).toMatchObject({ draft, sendSequence: 1, sendUnavailable: false, uncertain: false,
      state: { providerState: "available", messages: saved.messages },
      assistance: { kind: "reply_failed", body: EXPLORER_FAILED_REPLY_RETRY_DRAFT } });
    send();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetch.mock.calls[1][1]!.body as string)).toMatchObject({ kind: "send", body: draft, expectedRevision: 2 });
    expect(JSON.parse(fetch.mock.calls[1][1]!.body as string).operationId).not.toBe(command.operationId);
  });
  it("keeps the existing unavailable sentence and typed draft when readiness actually refuses Send", async () => {
    const fetch = await loaded();
    fetch.mockImplementation(async () => response({ ok: false, state: null, error: "provider_unavailable" }));
    send(); await vi.advanceTimersByTimeAsync(0); render();
    expect(fetch).toHaveBeenCalledOnce();
    expect(hooks.view).toMatchObject({ draft, sendUnavailable: true, state: { providerState: "unavailable", messages: [] },
      errorMessage: "The SolMind Virtual Guide is unavailable. No new message or reply has been confirmed saved." });
    send(); expect(fetch).toHaveBeenCalledOnce();
  });
});
