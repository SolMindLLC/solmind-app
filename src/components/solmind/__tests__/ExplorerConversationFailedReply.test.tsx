import { createElement, createRef, type FormEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExplorerConversation } from "../ExplorerConversation";
import type { ConnectedConversationActions, ConnectedConversationView } from "../ExplorerConversationConnectedScreen";
import type { ExplorerConversationState } from "../../../lib/solmind/explorerConversationContract";
import { EXPLORER_FAILED_REPLY_BUTTON_NOTE, EXPLORER_PRIVATE_RESPONSE_VERSION } from "../../../lib/solmind/explorerPrivateConversationResponse";
import { EXPLORER_FAILED_REPLY_RETRY_DRAFT } from "../../../lib/solmind/virtual-guide/explorerPrivateConversationComposition";

const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, effects: [] as (() => void | (() => void))[],
  actions: null as ConnectedConversationActions | null, view: null as ConnectedConversationView | null,
  screen: null as typeof import("../ExplorerConversationConnectedScreen").ExplorerConversationConnectedScreen | null }));
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
vi.mock("../ExplorerConversationConnectedScreen", async original => {
  hooks.screen = (await original<typeof import("../ExplorerConversationConnectedScreen")>()).ExplorerConversationConnectedScreen;
  return {
    ExplorerConversationConnectedScreen: ({ actions, view }: { actions: ConnectedConversationActions; view: ConnectedConversationView }) => {
      hooks.actions = actions; hooks.view = view; return null;
    },
  };
});

const id = (n: number) => `80000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const state: ExplorerConversationState = { version: "explorer-conversation.v1", conversationId: id(1), revision: 0,
  pendingTurn: false, turnedDownLimitReached: false, waypointDraft: null, providerState: "available", compassSuggestionReplies: "available",
  waypointCapacity: { activeCount: 0, activeLimit: 20, historyRoom: true, conversationRoom: true },
  waypointProjection: { kind: "current_heads", limit: 20, totalHeads: 0, hasMore: false },
  messages: [], compassItems: [], priorityId: null, attentionId: null, waypoints: [] };
const draft = "My thought stays in the conversation.";
const cleanups: (() => void)[] = [];
function render() { hooks.cursor = 0; renderToStaticMarkup(createElement(ExplorerConversation)); }
function screenMarkup() {
  // Render the real presentation from the controller's current view, with separate local layout slots.
  const saved = { slots: hooks.slots, cursor: hooks.cursor, effects: hooks.effects };
  hooks.slots = []; hooks.cursor = 0; hooks.effects = [];
  try {
    return renderToStaticMarkup(createElement(hooks.screen!, { view: hooks.view!, actions: hooks.actions!,
      headingRef: createRef<HTMLHeadingElement>(), composerRef: createRef<HTMLTextAreaElement>() }));
  } finally {
    hooks.slots = saved.slots; hooks.cursor = saved.cursor; hooks.effects = saved.effects;
  }
}
const renderedText = (text: string) => renderToStaticMarkup(createElement("span", null, text)).slice(6, -7);
function expectMessageBox(html: string, text: string, disabled = false) {
  const field = html.match(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/);
  expect(field).not.toBeNull();
  expect(field![2]).toBe(renderedText(text));
  if (disabled) expect(field![1]).toContain('disabled=""');
}
function expectSending(text: string, sendingFromComposer: boolean, storedDraft = draft) {
  render();
  expect(hooks.view).toMatchObject({ awaitingReply: true, sendingMessage: text, sendingFromComposer, draft: storedDraft });
  const html = screenMarkup();
  const sending = html.indexOf('data-sending-message=""');
  const waiting = html.indexOf('data-waiting-indicator=""');
  expect(sending).toBeGreaterThan(-1);
  expect(waiting).toBeGreaterThan(sending);
  expect(html.slice(sending, waiting)).toContain(renderedText(text));
  expect(html.split(`>${renderedText(text)}</p>`)).toHaveLength(2);
  const saved = html.match(/<ol aria-label="Saved conversation"[\s\S]*?<\/ol>/)?.[0] ?? "";
  expect(saved).not.toContain(`>${renderedText(text)}</p>`);
  expectMessageBox(html, sendingFromComposer ? "" : storedDraft, true);
}
function response(result: unknown, assistance: unknown = null) {
  return new Response(JSON.stringify({ version: EXPLORER_PRIVATE_RESPONSE_VERSION, result, assistance }),
    { headers: { "Content-Type": "application/json" } });
}
beforeEach(() => {
  vi.useFakeTimers(); hooks.slots = []; hooks.cursor = 0; hooks.effects = []; hooks.actions = null; hooks.view = null;
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn(),
    location: { href: "http://localhost/explorer/conversation" } });
});
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.useRealTimers(); vi.unstubAllGlobals();
});
async function loaded(initial: ExplorerConversationState = state) {
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => response({ ok: true, state: initial, error: null }));
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
  it("pins Paul's approved failed-reply sentence (2026-11-10) and the earlier sentence kept for button Sends", () => {
    expect(EXPLORER_FAILED_REPLY_RETRY_DRAFT).toBe("Your Virtual Guide's reply didn't come through, so your message has no answer yet. Your words are still in the message box. To try again, choose Send.");
    expect(EXPLORER_FAILED_REPLY_BUTTON_NOTE).toBe("The reply did not come through. You can try again.");
  });
  it("shows the earlier sentence, not the message-box one, when a reply choice's reply fails: nothing was typed for it", async () => {
    const offered: ExplorerConversationState = { ...state, revision: 1, messages: [{
      id: id(3), role: "virtualGuide", body: "A synthetic reply", createdAt: "2026-11-10T10:00:00Z",
      choices: [{ label: "I have a question" }],
    }] };
    const fetch = await loaded(offered);
    const saved: ExplorerConversationState = { ...offered, revision: 3, messages: [...offered.messages, {
      id: id(4), role: "explorer", body: "I have a question", createdAt: "2026-11-10T10:00:05Z",
    }] };
    fetch.mockImplementation(async () => response({ ok: true, state: saved, error: null }, {
      kind: "reply_failed", body: EXPLORER_FAILED_REPLY_RETRY_DRAFT, persisted: false,
    }));
    hooks.actions!.onReplyChoice("I have a question"); await vi.advanceTimersByTimeAsync(0); render();
    expect(fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toMatchObject({ kind: "send", body: "I have a question", replyChoice: true });
    // The typed draft is kept as it was; the notice makes no claim about the message box.
    expect(hooks.view).toMatchObject({ draft, sendUnavailable: false, uncertain: false,
      state: { providerState: "available", messages: saved.messages },
      assistance: { kind: "reply_failed", body: EXPLORER_FAILED_REPLY_BUTTON_NOTE, persisted: false } });
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

describe("REV424 waiting indicator command lifetime", () => {
  const label = "I have a question";
  const offered: ExplorerConversationState = { ...state, revision: 1, messages: [{
    id: id(3), role: "virtualGuide", body: "A synthetic reply", createdAt: "2026-11-13T10:00:00Z",
    choices: [{ label }],
  }] };
  const waypointDraft = { id: id(5), title: "A calm conversation", destination: "Speak without rushing",
    whyItMatters: "We can hear each other", arrivalSignal: "We each finish a thought", suggestionMessageId: id(3) };

  function hold(fetch: Awaited<ReturnType<typeof loaded>>) {
    let resolve: (response: Response) => void = () => {};
    let reject: (reason: unknown) => void = () => {};
    let signal: AbortSignal | null = null;
    fetch.mockImplementation((_url, init) => new Promise<Response>((yes, no) => {
      resolve = yes; reject = no; signal = init!.signal!;
      signal.addEventListener("abort", () => no(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    return { resolve: (value: Response) => resolve(value), reject: (error: unknown) => reject(error),
      signal: () => signal! };
  }

  function expectWaiting(waiting: boolean) {
    render();
    expect(hooks.view!.awaitingReply).toBe(waiting);
    if (waiting) expect(hooks.view).toMatchObject({ busy: true, statusText: "" });
    else {
      expect(hooks.view!.sendingMessage).toBeNull();
      expect(hooks.view!.sendingFromComposer).toBe(false);
      expect(screenMarkup()).not.toContain('data-sending-message=""');
    }
  }

  it.each(["typed", "reply choice"] as const)("waits only while the dispatched %s Send is in flight", async kind => {
    const fetch = await loaded(offered);
    const held = hold(fetch);
    expectWaiting(false);
    if (kind === "typed") send();
    else hooks.actions!.onReplyChoice(label);
    expectWaiting(true);
    const body = kind === "typed" ? draft : label;
    expectSending(body, kind === "typed");
    expect(fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toMatchObject({ kind: "send",
      body });
    await vi.advanceTimersByTimeAsync(8_000);
    expectWaiting(true);
    expectSending(body, kind === "typed");
    const saved: ExplorerConversationState = { ...offered, revision: 3, messages: [...offered.messages,
      { id: id(6), role: "explorer", body, createdAt: "2026-11-13T10:00:08Z" },
      { id: id(7), role: "virtualGuide", body: "A saved synthetic answer.", createdAt: "2026-11-13T10:00:09Z" }] };
    held.resolve(response({ ok: true, state: saved, error: null }));
    await vi.advanceTimersByTimeAsync(0);
    expectWaiting(false);
    expect(hooks.view!.busy).toBe(false);
    expect(hooks.view!.state!.messages).toEqual(saved.messages);
    const html = screenMarkup();
    const savedList = html.match(/<ol aria-label="Saved conversation"[\s\S]*?<\/ol>/)![0];
    expect(savedList).toContain(renderedText(body));
    expect(html.split(`>${renderedText(body)}</p>`)).toHaveLength(2);
    expectMessageBox(html, kind === "typed" ? "" : draft);
    expect(hooks.view!.draft).toBe(kind === "typed" ? "" : draft);
  });

  it.each(["right", "close", "not_it"] as const)("waits for the %s suggestion follow-up, after its formation command finishes", async answer => {
    const initial = { ...offered, waypointDraft };
    const fetch = await loaded(initial);
    const held = hold(fetch);
    hooks.actions!.onCommand({ kind: "respond_waypoint_draft", draftId: waypointDraft.id, response: answer });
    expectWaiting(false);
    expect(hooks.view).toMatchObject({ busy: true, statusText: "Checking your change..." });
    const answered = { ...initial, revision: 2, waypointDraft: answer === "close" ? waypointDraft : null };
    held.resolve(response({ ok: true, state: answered, error: null }));
    await vi.advanceTimersByTimeAsync(0);
    expectWaiting(true);
    const body = `${answer === "right" ? "That's right" : answer === "close" ? "Close, not quite" : "That's not it"}: "${waypointDraft.title}"`;
    expectSending(body, false);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetch.mock.calls[1][1]!.body as string)).toMatchObject({ kind: "send", expectedRevision: 2, body });
    held.resolve(response({ ok: true, state: { ...answered, revision: 3 }, error: null }));
    await vi.advanceTimersByTimeAsync(0);
    expectWaiting(false);
    expectMessageBox(screenMarkup(), draft);
  });

  it("shows the exact first-message wire text again on an uncertain retry while retaining the original draft", async () => {
    const fetch = await loaded();
    const storedDraft = `  ${draft}\n`;
    hooks.actions!.onDraftChange(storedDraft); render();
    const held = hold(fetch);
    send();
    expectSending(draft, true, storedDraft);
    expect(screenMarkup()).not.toContain("There are no saved messages yet.");
    const bytes = fetch.mock.calls[0][1]!.body;
    expect(JSON.parse(bytes as string).body).toBe(draft);
    held.resolve(new Response("malformed", { headers: { "Content-Type": "application/json" } }));
    await vi.advanceTimersByTimeAsync(0);
    expectWaiting(false);
    expect(hooks.view!.uncertain).toBe(true);
    expectMessageBox(screenMarkup(), storedDraft);
    hooks.actions!.onRetry();
    expectSending(draft, true, storedDraft);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][1]!.body).toBe(bytes);
    held.resolve(response({ ok: true, state: { ...state, revision: 2, messages: [
      { id: id(6), role: "explorer", body: draft, createdAt: "2026-11-13T10:00:08Z" },
      { id: id(7), role: "virtualGuide", body: "A saved synthetic answer.", createdAt: "2026-11-13T10:00:09Z" },
    ] }, error: null }));
    await vi.advanceTimersByTimeAsync(0);
    expectWaiting(false);
    const html = screenMarkup();
    const savedList = html.match(/<ol aria-label="Saved conversation"[\s\S]*?<\/ol>/)![0];
    expect(savedList.split(`>${renderedText(draft)}</p>`)).toHaveLength(2);
    expectMessageBox(html, "");
  });

  it.each(["refused", "reported failed reply", "uncertain result", "fetch failure", "abort", "timeout"] as const)(
    "clears the wait when a Send ends with %s", async outcome => {
      const fetch = await loaded(offered);
      const held = hold(fetch);
      send();
      expectWaiting(true);
      expectSending(draft, true);
      if (outcome === "refused") held.resolve(response({ ok: false, state: null, error: "provider_unavailable" }));
      else if (outcome === "reported failed reply") held.resolve(response({ ok: true,
        state: { ...offered, revision: 2, messages: [...offered.messages,
          { id: id(6), role: "explorer", body: draft, createdAt: "2026-11-13T10:00:08Z" }] }, error: null },
        { kind: "reply_failed", body: EXPLORER_FAILED_REPLY_RETRY_DRAFT, persisted: false }));
      else if (outcome === "uncertain result") held.resolve(new Response("malformed", { headers: { "Content-Type": "application/json" } }));
      else if (outcome === "fetch failure") held.reject(new Error("Synthetic transport failure"));
      else if (outcome === "abort") held.reject(new DOMException("Aborted", "AbortError"));
      else {
        await vi.advanceTimersByTimeAsync(129_999);
        expectWaiting(true);
        expect(held.signal().aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        expect(held.signal().aborted).toBe(true);
      }
      await vi.advanceTimersByTimeAsync(0);
      expectWaiting(false);
      expect(hooks.view!.busy).toBe(false);
      expect(hooks.view!.draft).toBe(draft);
      const html = screenMarkup();
      expectMessageBox(html, draft);
      if (outcome === "reported failed reply") {
        const savedList = html.match(/<ol aria-label="Saved conversation"[\s\S]*?<\/ol>/)![0];
        expect(savedList.split(`>${renderedText(draft)}</p>`)).toHaveLength(2);
      } else {
        expect(hooks.view!.state!.messages).toEqual(offered.messages);
      }
      expect(fetch).toHaveBeenCalledOnce();
    });

  it("clears the wait on pagehide even before the aborted transport settles", async () => {
    const fetch = await loaded(offered);
    let finish: (response: Response) => void = () => {};
    let signal: AbortSignal | null = null;
    fetch.mockImplementation((_url, init) => new Promise(resolve => { finish = resolve; signal = init!.signal!; }));
    send();
    expectWaiting(true);
    expectSending(draft, true);
    const leave = vi.mocked(window.addEventListener).mock.calls.find(call => call[0] === "pagehide")![1] as () => void;
    leave();
    expectWaiting(false);
    expect(signal!.aborted).toBe(true);
    expect(hooks.view!.state).toBeNull();
    finish(response({ ok: true, state: { ...offered, revision: 2 }, error: null }));
    await vi.advanceTimersByTimeAsync(0);
    expectWaiting(false);
    expect(hooks.view!.state).toBeNull();
  });

  it("keeps loading, reload and End review outside the reply wait", async () => {
    render();
    expect(hooks.view).toMatchObject({ busy: true, awaitingReply: false, sendingMessage: null, sendingFromComposer: false, statusText: "Loading your saved conversation..." });
    const fetch = await loaded(offered);
    expectWaiting(false);
    hooks.actions!.onReviewEnd();
    expectWaiting(false);
    expect(hooks.view!.endReviewOpen).toBe(true);
    hooks.actions!.onKeepOpen();
    render();
    const held = hold(fetch);
    hooks.actions!.onReload();
    expectWaiting(false);
    expect(hooks.view).toMatchObject({ busy: true, statusText: "Checking your change..." });
    held.resolve(response({ ok: true, state: offered, error: null }));
    await vi.advanceTimersByTimeAsync(0);
    expectWaiting(false);
    expect(hooks.view!.busy).toBe(false);
  });
});
