import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectedConversationActions } from "../ExplorerConversationConnectedScreen";
import type { ExplorerConversationState } from "../../../lib/solmind/explorerConversationContract";
import { EXPLORER_PRIVATE_RESPONSE_VERSION } from "../../../lib/solmind/explorerPrivateConversationResponse";
import { ExplorerConversation } from "../ExplorerConversation";
import { cardStateAtWaypointLimit } from "../../../../tests/browser/connectedCardFixture";

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
  return { waypointCapacity: { activeCount: 0, activeLimit: 20, historyRoom: true }, waypointProjection: { kind: "current_heads" as const, limit: 20 as const, totalHeads: 0, hasMore: false }, version: "explorer-conversation.v1", conversationId: id(1), revision: 3,
    pendingTurn: false, turnedDownLimitReached, waypointDraft: null, providerState: "available", compassSuggestionReplies: "available",
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
async function loaded(turnedDownLimitReached: boolean, overrides: Partial<ExplorerConversationState> = {}) {
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({
    version: EXPLORER_PRIVATE_RESPONSE_VERSION,
    result: { ok: true, state: { ...state(turnedDownLimitReached), ...overrides }, error: null }, assistance: null,
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

const WAYPOINT_DRAFT = { id: id(4), title: "Make room for a calm conversation", destination: "Talk without rushing",
  whyItMatters: "I want to feel heard", arrivalSignal: "We each finish our thought", suggestionMessageId: id(2) };
const success = (next: ExplorerConversationState) => new Response(JSON.stringify({
  version: EXPLORER_PRIVATE_RESPONSE_VERSION, result: { ok: true, state: next, error: null }, assistance: null,
}), { headers: { "Content-Type": "application/json" } });

describe("S7a Waypoint draft reply command ownership", () => {
  const capacityState = () => {
    const saved = cardStateAtWaypointLimit();
    return { ...saved, providerState: "available" as const, compassSuggestionReplies: "available" as const,
      waypointDraft: { ...WAYPOINT_DRAFT, suggestionMessageId: saved.messages.at(-1)!.id } };
  };

  it("refuses confirmation locally at the account-wide active limit without sending a request", async () => {
    const f = await loaded(false, capacityState());
    f.actions.onCommand({ kind: "respond_waypoint_draft", draftId: WAYPOINT_DRAFT.id, response: "right" });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetch).not.toHaveBeenCalled();
  });

  it.each(["close", "not_it"] as const)("keeps %s and its ordinary follow-up available at the limit", async response => {
    const saved = capacityState();
    const f = await loaded(false, saved);
    f.fetch.mockImplementation(async (_url, init) => {
      const command = JSON.parse(init!.body as string) as { kind: string };
      return success({ ...saved, revision: saved.revision + (command.kind === "send" ? 2 : 1),
        waypointDraft: response === "close" ? saved.waypointDraft : null });
    });
    f.actions.onCommand({ kind: "respond_waypoint_draft", draftId: WAYPOINT_DRAFT.id, response });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(f.fetch.mock.calls[0][1]!.body as string)).toMatchObject({ kind: "respond_waypoint_draft", response });
    expect(JSON.parse(f.fetch.mock.calls[1][1]!.body as string)).toMatchObject({ kind: "send",
      body: `${response === "close" ? "Close, not quite" : "That's not it"}: "${WAYPOINT_DRAFT.title}"` });
  });

  it("keeps a server refusal after a capacity race on the definite-conflict path without a follow-up", async () => {
    const saved = capacityState();
    const f = await loaded(false, { ...saved, waypointCapacity: { ...saved.waypointCapacity, activeCount: 19 } });
    f.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ version: EXPLORER_PRIVATE_RESPONSE_VERSION,
      result: { ok: false, state: null, error: "refresh_required" }, assistance: null,
    }), { status: 409, headers: { "Content-Type": "application/json" } }));
    f.actions.onCommand({ kind: "respond_waypoint_draft", draftId: WAYPOINT_DRAFT.id, response: "right" });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(f.fetch.mock.calls[0][1]!.body as string)).toMatchObject({ kind: "respond_waypoint_draft", response: "right" });
    f.actions.onCommand({ kind: "respond_waypoint_draft", draftId: WAYPOINT_DRAFT.id, response: "right" });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetch).toHaveBeenCalledOnce();
  });

  it.each(["right", "close", "not_it"] as const)("uses the exact stored title for %s and sends a follow-up only after a confirmed answer", async response => {
    const f = await loaded(true, { waypointDraft: WAYPOINT_DRAFT });
    const after = { ...state(true), revision: 4,
      waypointDraft: response === "close" ? WAYPOINT_DRAFT : null, providerState: "unavailable" as const };
    f.fetch.mockImplementation(async (_url, init) => {
      const command = JSON.parse(init!.body as string) as { kind: string };
      return success(command.kind === "send" ? { ...after, revision: 5, providerState: "available" } : after);
    });
    f.actions.onCommand({ kind: "respond_waypoint_draft", draftId: WAYPOINT_DRAFT.id, response });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetch).toHaveBeenCalledTimes(response === "right" ? 1 : 2);
    const first = JSON.parse(f.fetch.mock.calls[0][1]!.body as string);
    expect(first).toEqual({ kind: "respond_waypoint_draft", draftId: WAYPOINT_DRAFT.id,
      response, operationId: expect.any(String), expectedRevision: 3 });
    if (response !== "right") {
      const second = JSON.parse(f.fetch.mock.calls[1][1]!.body as string);
      expect(second).toEqual({ kind: "send", expectedRevision: 4, operationId: expect.any(String),
        body: `${response === "close" ? "Close, not quite" : "That's not it"}: "${WAYPOINT_DRAFT.title}"` });
      expect(second.operationId).not.toBe(first.operationId);
    }
  });

  it("holds the follow-up after uncertain outcome and retries the identical answer bytes first", async () => {
    const f = await loaded(false, { waypointDraft: WAYPOINT_DRAFT });
    f.fetch.mockResolvedValueOnce(new Response("malformed", { headers: { "Content-Type": "application/json" } }));
    f.actions.onCommand({ kind: "respond_waypoint_draft", draftId: WAYPOINT_DRAFT.id, response: "close" });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetch).toHaveBeenCalledOnce();
    const bytes = f.fetch.mock.calls[0][1]!.body;
    f.fetch.mockImplementation(async (_url, init) => {
      const command = JSON.parse(init!.body as string) as { kind: string };
      return success({ ...state(false), waypointDraft: WAYPOINT_DRAFT,
        revision: command.kind === "send" ? 5 : 4 });
    });
    f.actions.onRetry();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetch).toHaveBeenCalledTimes(3);
    expect(f.fetch.mock.calls[1][1]!.body).toBe(bytes);
    expect(JSON.parse(f.fetch.mock.calls[2][1]!.body as string)).toMatchObject({ kind: "send", expectedRevision: 4 });
  });

  it("starts no follow-up after a definite conflict", async () => {
    const f = await loaded(false, { waypointDraft: WAYPOINT_DRAFT });
    f.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ version: EXPLORER_PRIVATE_RESPONSE_VERSION,
      result: { ok: false, state: null, error: "refresh_required" }, assistance: null,
    }), { status: 409, headers: { "Content-Type": "application/json" } }));
    f.actions.onCommand({ kind: "respond_waypoint_draft", draftId: WAYPOINT_DRAFT.id, response: "not_it" });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetch).toHaveBeenCalledOnce();
  });

  it.each([
    { waypointDraft: null },
    { waypointDraft: { ...WAYPOINT_DRAFT, title: null } },
    { waypointDraft: { ...WAYPOINT_DRAFT, arrivalSignal: null } },
    { waypointDraft: WAYPOINT_DRAFT, compassSuggestionReplies: "support" as const },
    { waypointDraft: WAYPOINT_DRAFT, compassSuggestionReplies: "adult_policy" as const },
    { waypointDraft: WAYPOINT_DRAFT, compassSuggestionReplies: undefined },
    { waypointDraft: WAYPOINT_DRAFT, pendingTurn: true },
  ])("refuses a direct confirmation locally when the stored draft is incomplete or held: %j", async overrides => {
    const f = await loaded(false, overrides);
    f.actions.onCommand({ kind: "respond_waypoint_draft", draftId: WAYPOINT_DRAFT.id, response: "right" });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetch).not.toHaveBeenCalled();
  });
});
