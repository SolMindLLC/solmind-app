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
  updates: [] as unknown[],
  noticeRecheck: vi.fn(),
}));
vi.mock("../../../lib/solmind/explorerEarlyTestNoticeRecheck", () => ({
  useExplorerEarlyTestNoticeRecheck: () => captured.noticeRecheck,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useEffect: (effect: () => void | (() => void)) => { captured.effects.push(effect); },
    useState: (initial: unknown) => {
      const [value, setValue] = actual.useState(initial);
      return [value, (next: unknown) => { captured.updates.push(next); setValue(next); }];
    } };
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
  return { waypointCapacity: { activeCount: 0, activeLimit: 20, historyRoom: true, conversationRoom: true }, waypointProjection: { kind: "current_heads" as const, limit: 20 as const, totalHeads: 0, hasMore: false }, version: "explorer-conversation.v1", conversationId: id(1), revision: 3,
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
  captured.updates = [];
  captured.noticeRecheck.mockClear();
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
  it.each(["denied", "unavailable"])("asks the notice boundary to recheck after a confirmed %s command response", async (error) => {
    const f = await loaded(false);
    f.fetch.mockResolvedValue(new Response(JSON.stringify({ version: EXPLORER_PRIVATE_RESPONSE_VERSION,
      result: { ok: false, state: null, error }, assistance: null,
    }), { headers: { "Content-Type": "application/json" } }));
    f.actions.onCommand({ kind: "respond_compass_suggestion", itemId: POINT, response: "right" });
    await vi.advanceTimersByTimeAsync(0);
    expect(captured.noticeRecheck).toHaveBeenCalledOnce();
    expect(f.fetch).toHaveBeenCalledOnce();
  });
  it("does not notify from a late command response after the page lifetime ends", async () => {
    const f = await loaded(false);
    let finish: (response: Response) => void = () => undefined;
    f.fetch.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    f.actions.onCommand({ kind: "respond_compass_suggestion", itemId: POINT, response: "right" });
    for (const cleanup of cleanups.splice(0)) cleanup();
    finish(new Response(JSON.stringify({ version: EXPLORER_PRIVATE_RESPONSE_VERSION,
      result: { ok: false, state: null, error: "denied" }, assistance: null,
    }), { headers: { "Content-Type": "application/json" } }));
    await vi.advanceTimersByTimeAsync(0);
    expect(captured.noticeRecheck).not.toHaveBeenCalled();
  });
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

describe("Tapped reply choice Send ownership", () => {
  const label = "Something that happened today";
  const offered = (): ExplorerConversationState => ({ ...state(false), messages: [
    { ...state(false).messages[0], choices: [{ label }] },
  ] });

  it("never dispatches the fixed tour label through the Send owner", async () => {
    const f = await loaded(false, { messages: [{ ...state(false).messages[0], choices: [{ label: "Show me around" }] }] });
    f.actions.onReplyChoice("Show me around");
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetch).not.toHaveBeenCalled();
    expect(captured.updates.filter(value => typeof value === "function")).toHaveLength(0);
  });

  it("sends the exact offered label once with the literal marker and the saved revision", async () => {
    const f = await loaded(false, offered());
    f.actions.onReplyChoice(label);
    f.actions.onReplyChoice(label);
    expect(f.fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(f.fetch.mock.calls[0][1]!.body as string)).toEqual({
      kind: "send", body: label, replyChoice: true, operationId: expect.any(String), expectedRevision: 3,
    });
    expect(f.fetch.mock.calls[0][0]).toBe("/explorer/conversation/commands");
  });

  it("retries the identical flagged Send bytes and operation after an uncertain result", async () => {
    const f = await loaded(false, offered());
    f.fetch.mockResolvedValueOnce(new Response("malformed", { headers: { "Content-Type": "application/json" } }));
    f.actions.onReplyChoice(label);
    await vi.advanceTimersByTimeAsync(0);
    const bytes = f.fetch.mock.calls[0][1]!.body;
    f.actions.onReplyChoice(label);
    expect(f.fetch).toHaveBeenCalledOnce();
    f.fetch.mockResolvedValueOnce(success({ ...offered(), revision: 4 }));
    f.actions.onRetry();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetch).toHaveBeenCalledTimes(2);
    expect(f.fetch.mock.calls[1][1]!.body).toBe(bytes);
    expect(JSON.parse(bytes as string).replyChoice).toBe(true);
  });

  it.each(["Something That Happened Today", "Something that happened today ", "An older choice"])(
    "does not send a label absent from the latest offered reply: %s", async attempted => {
      const f = await loaded(false, offered());
      f.actions.onReplyChoice(attempted);
      expect(f.fetch).not.toHaveBeenCalled();
    });

  it.each([
    { providerState: "unavailable" }, { pendingTurn: true },
    { compassSuggestionReplies: "support" }, { compassSuggestionReplies: "adult_policy" },
    { compassSuggestionReplies: undefined },
  ] as const)("keeps the existing held conversation gates for marked Send: %j", async overrides => {
    const f = await loaded(false, { ...offered(), ...overrides });
    f.actions.onReplyChoice(label);
    expect(f.fetch).not.toHaveBeenCalled();
  });

  it("holds a choice at saved-message capacity", async () => {
    const full = offered();
    const f = await loaded(false, { ...full, messages: Array.from({ length: 99 }, (_, index) => ({
      ...full.messages[0], id: id(index + 10),
    })) });
    f.actions.onReplyChoice(label);
    expect(f.fetch).not.toHaveBeenCalled();
  });

  it("does not revive an older offer after a later Explorer message", async () => {
    const saved = offered();
    const f = await loaded(false, { ...saved, messages: [...saved.messages,
      { id: id(8), role: "explorer", body: "My next thought", createdAt: "2026-11-05T12:00:01Z" },
    ] });
    f.actions.onReplyChoice(label);
    expect(f.fetch).not.toHaveBeenCalled();
  });
});

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
    expect(f.fetch).toHaveBeenCalledTimes(2);
    const first = JSON.parse(f.fetch.mock.calls[0][1]!.body as string);
    expect(first).toEqual({ kind: "respond_waypoint_draft", draftId: WAYPOINT_DRAFT.id,
      response, operationId: expect.any(String), expectedRevision: 3 });
    const second = JSON.parse(f.fetch.mock.calls[1][1]!.body as string);
    expect(second).toEqual({ kind: "send", expectedRevision: 4, operationId: expect.any(String),
      body: `${response === "right" ? "That's right" : response === "close" ? "Close, not quite" : "That's not it"}: "${WAYPOINT_DRAFT.title}"` });
    expect(second.operationId).not.toBe(first.operationId);
    expect(f.fetch.mock.calls.filter(call => JSON.parse(call[1]!.body as string).kind === "send")).toHaveLength(1);
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

describe("Confirmed That's right follow-up for both suggestion kinds", () => {
  const cases = [
    { kind: "respond_compass_suggestion" as const, itemId: POINT, response: "right" as const },
    { kind: "respond_waypoint_draft" as const, draftId: WAYPOINT_DRAFT.id, response: "right" as const },
  ];
  function confirmed(): ExplorerConversationState {
    return { ...state(false), revision: 4, waypointDraft: null,
      compassItems: [{ id: POINT, sourceMessageId: id(2), label: "A tentative point", formation: "saved" }],
      waypointCapacity: { activeCount: 1, activeLimit: 20, historyRoom: true, conversationRoom: true },
      waypointProjection: { kind: "current_heads", limit: 20, totalHeads: 1, hasMore: false },
      waypoints: [{ id: id(50), sourceMessageId: id(2), title: WAYPOINT_DRAFT.title,
        destination: WAYPOINT_DRAFT.destination, meaning: WAYPOINT_DRAFT.whyItMatters,
        arrivalSignal: WAYPOINT_DRAFT.arrivalSignal, status: "chosen", isCurrent: true, createdAt: "2026-11-06T15:00:00Z" }] };
  }

  it.each(cases)("sends once at the confirmed revision: $kind", async intent => {
    const f = await loaded(false, { waypointDraft: WAYPOINT_DRAFT });
    f.actions.onDraftChange("Keep my unsent thought");
    captured.updates = [];
    f.fetch.mockImplementation(async (_url, init) => success({ ...confirmed(),
      revision: JSON.parse(init!.body as string).kind === "send" ? 5 : 4 }));
    f.actions.onCommand(intent);
    f.actions.onCommand(intent);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetch).toHaveBeenCalledTimes(2);
    const commands = f.fetch.mock.calls.map(call => JSON.parse(call[1]!.body as string));
    expect(commands[0]).toMatchObject({ ...intent, expectedRevision: 3 });
    expect(commands[1]).toEqual({ kind: "send", expectedRevision: 4, operationId: expect.any(String),
      body: `That's right: "${intent.kind === "respond_compass_suggestion" ? "A tentative point" : WAYPOINT_DRAFT.title}"` });
    expect(commands[1].operationId).not.toBe(commands[0].operationId);
    expect(commands.filter(command => command.kind === "send")).toHaveLength(1);
  });

  for (const gate of ["provider", "capacity", "pending", "support", "adult_policy"] as const) {
    it.each(cases)(`keeps confirmation when the follow-up is held by ${gate}: $kind`, async intent => {
      const f = await loaded(false, { waypointDraft: WAYPOINT_DRAFT,
        ...(gate === "provider" ? { providerState: "unavailable" as const } : {}) });
      const after = { ...confirmed(),
        ...(gate === "capacity" ? { messages: Array.from({ length: 99 }, (_, index) => ({
          ...state(false).messages[0], id: index === 0 ? id(2) : id(index + 100),
        })) } : {}),
        ...(gate === "pending" ? { pendingTurn: true } : {}),
        ...(gate === "support" || gate === "adult_policy" ? { compassSuggestionReplies: gate } : {}),
      };
      f.fetch.mockResolvedValueOnce(success(after));
      f.actions.onCommand(intent);
      await vi.advanceTimersByTimeAsync(0);
      expect(f.fetch).toHaveBeenCalledOnce();
      const saved = captured.updates.filter(value => typeof value === "object" && value !== null && "revision" in value).at(-1);
      expect(saved).toMatchObject({ revision: 4, waypointDraft: null,
        compassItems: [{ id: POINT, formation: "saved" }], waypoints: [{ id: id(50), status: "chosen" }] });
    });
  }

  it.each(cases)("waits for exact confirmation retry before sending once: $kind", async intent => {
    const f = await loaded(false, { waypointDraft: WAYPOINT_DRAFT });
    f.fetch.mockResolvedValueOnce(new Response("malformed", { headers: { "Content-Type": "application/json" } }));
    f.actions.onCommand(intent);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetch).toHaveBeenCalledOnce();
    const bytes = f.fetch.mock.calls[0][1]!.body;
    f.fetch.mockResolvedValue(success(confirmed()));
    f.actions.onRetry();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetch).toHaveBeenCalledTimes(3);
    expect(f.fetch.mock.calls[1][1]!.body).toBe(bytes);
    expect(f.fetch.mock.calls.filter(call => JSON.parse(call[1]!.body as string).kind === "send")).toHaveLength(1);
  });
});
