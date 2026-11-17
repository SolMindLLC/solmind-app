import { createElement, type FormEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExplorerConversation } from "../ExplorerConversation";
import type { ConnectedConversationActions, ConnectedConversationView } from "../ExplorerConversationConnectedScreen";
import type { ExplorerConversationState } from "../../../lib/solmind/explorerConversationContract";
import { EXPLORER_PRIVATE_RESPONSE_VERSION } from "../../../lib/solmind/explorerPrivateConversationResponse";

// Compact header, step A: the structured status the conversation logic hands to the screen. The fact
// "last check confirmed" starts false and is set or cleared only inside the accepted-response guards of
// the read and of a change (PROPOSAL_R3.md section 3). The harness is the one of
// ExplorerConversationFailedReply.test.tsx: it captures the view the logic hands over. Invented content only.
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

const id = (n: number) => `81000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const state: ExplorerConversationState = { version: "explorer-conversation.v1", conversationId: id(1), revision: 3,
  pendingTurn: false, turnedDownLimitReached: false, waypointDraft: null, providerState: "available", compassSuggestionReplies: "available",
  waypointCapacity: { activeCount: 0, activeLimit: 20, historyRoom: true, conversationRoom: true },
  waypointProjection: { kind: "current_heads", limit: 20, totalHeads: 0, hasMore: false },
  messages: [], compassItems: [], priorityId: null, attentionId: null, waypoints: [], sessionStatus: "active", ending: null };
const saved: ExplorerConversationState = { ...state, revision: 5, messages: [
  { id: id(2), role: "explorer", body: "An invented message.", createdAt: "2026-11-16T10:00:00Z" },
  { id: id(3), role: "virtualGuide", body: "An invented reply.", createdAt: "2026-11-16T10:00:05Z" }] };
const ended: ExplorerConversationState = { ...state, revision: 4, providerState: "unavailable", sessionStatus: "ended" };
const draft = "An invented message.";
const LOADING = "Loading your saved conversation...";
const RELOADING = "Checking your saved conversation...";
const CHANGE = "Checking your change...";
const cleanups: (() => void)[] = [];
function render() { hooks.cursor = 0; renderToStaticMarkup(createElement(ExplorerConversation)); return hooks.view!; }
function response(result: unknown, assistance: unknown = null) {
  return new Response(JSON.stringify({ version: EXPLORER_PRIVATE_RESPONSE_VERSION, result, assistance }),
    { headers: { "Content-Type": "application/json" } });
}
const ok = (next: ExplorerConversationState, assistance: unknown = null) => response({ ok: true, state: next, error: null }, assistance);
const refused = (error: string) => response({ ok: false, state: null, error });
const malformed = () => new Response("not json", { headers: { "Content-Type": "application/json" } });
const makeFetch = (first: () => Promise<Response>) => vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(first);
type Fetch = ReturnType<typeof makeFetch>;
let assign: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers(); hooks.slots = []; hooks.cursor = 0; hooks.effects = []; hooks.actions = null; hooks.view = null;
  assign = vi.fn();
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn(),
    location: { href: "http://localhost/explorer/conversation", assign } });
});
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.useRealTimers(); vi.unstubAllGlobals();
});
// Mounts the logic and answers the first read.
async function opened(first: () => Promise<Response> = async () => ok(state)): Promise<Fetch> {
  const fetch = makeFetch(first);
  vi.stubGlobal("fetch", fetch); render();
  for (const effect of hooks.effects) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
  await vi.advanceTimersByTimeAsync(0); render();
  return fetch;
}
async function settle() { await vi.advanceTimersByTimeAsync(0); return render(); }
function send() {
  hooks.actions!.onDraftChange(draft); render();
  hooks.actions!.onSend({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>);
}
function hold(fetch: Fetch) {
  let resolve: (value: Response) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  fetch.mockImplementation((_url, init) => new Promise<Response>((yes, no) => {
    resolve = yes; reject = no;
    init!.signal!.addEventListener("abort", () => no(new DOMException("Aborted", "AbortError")), { once: true });
  }));
  return { resolve: (value: Response) => resolve(value), reject: (error: unknown) => reject(error) };
}
// A request whose answer still arrives after it was aborted: the abort is ignored on purpose, so the
// accepted-response guards themselves are what must throw the late answer away.
function holdIgnoringAbort(fetch: Fetch) {
  let resolve: (value: Response) => void = () => {};
  let aborted = false;
  fetch.mockImplementation((_url, init) => new Promise<Response>(yes => {
    resolve = yes;
    init!.signal!.addEventListener("abort", () => { aborted = true; }, { once: true });
  }));
  return { resolve: (value: Response) => resolve(value), aborted: () => aborted };
}
const leave = () => (vi.mocked(window.addEventListener).mock.calls.find(call => call[0] === "pagehide")![1] as () => void)();

describe("compact header: the fact 'last check confirmed' on a read", () => {
  it("starts false, with the loading sentence and no error code", () => {
    const fetch = makeFetch(async () => ok(state));
    vi.stubGlobal("fetch", fetch);
    expect(render()).toMatchObject({ lastCheckConfirmed: false, errorCode: null, busy: true, state: null, statusText: LOADING });
  });

  it("is true after a successful first read, and the status text is then empty", async () => {
    await opened();
    expect(hooks.view).toMatchObject({ lastCheckConfirmed: true, errorCode: null, busy: false, statusText: "", reloadAvailable: true });
    expect(hooks.view!.state).not.toBeNull();
  });

  it("stays true with a pause notice or a pending result on a successful read: the screen's order of precedence decides the light", async () => {
    await opened(async () => ok({ ...saved, pendingTurn: true }, { kind: "paused", body: "An invented pause notice.", persisted: false }));
    expect(hooks.view).toMatchObject({ lastCheckConfirmed: true, assistance: { kind: "paused" }, state: { pendingTurn: true } });
  });

  it.each([
    ["refused as unavailable", async () => refused("unavailable"), "unavailable"],
    ["refused as changed", async () => refused("refresh_required"), "refresh_required"],
    ["refused for sign-in", async () => refused("denied"), "denied"],
    ["unreadable", async () => malformed(), "unavailable"],
    ["a failed request", async () => { throw new Error("offline"); }, "unavailable"],
  ] as const)("is false after a first read that is %s, and the error code is handed over", async (_name, first, code) => {
    await opened(first);
    expect(hooks.view).toMatchObject({ lastCheckConfirmed: false, errorCode: code, state: null, busy: false, statusText: "" });
    expect(hooks.view!.reloadAvailable).toBe(code !== "denied");
    expect(hooks.view!.signInRequired).toBe(code === "denied");
  });

  it("a Reload: not written at its start, the Reload busy sentence while it runs, true again after it succeeds", async () => {
    const fetch = await opened();
    const held = hold(fetch);
    hooks.actions!.onReload();
    expect(render()).toMatchObject({ busy: true, lastCheckConfirmed: true, statusText: RELOADING });
    held.resolve(ok(saved));
    expect(await settle()).toMatchObject({ busy: false, lastCheckConfirmed: true, statusText: "", errorCode: null, state: { revision: 5 } });
  });

  it.each([
    ["refused as unavailable", () => refused("unavailable"), "unavailable"],
    ["refused as changed", () => refused("refresh_required"), "refresh_required"],
    ["unreadable", () => malformed(), "unavailable"],
  ] as const)("a Reload that is %s clears the fact and removes the saved conversation", async (_name, answer, code) => {
    const fetch = await opened();
    expect(hooks.view!.lastCheckConfirmed).toBe(true);
    fetch.mockImplementation(async () => answer());
    hooks.actions!.onReload();
    expect(await settle()).toMatchObject({ lastCheckConfirmed: false, errorCode: code, state: null, busy: false });
  });

  it("a Reload whose request fails clears the fact", async () => {
    const fetch = await opened();
    const held = hold(fetch);
    hooks.actions!.onReload();
    held.reject(new Error("offline"));
    expect(await settle()).toMatchObject({ lastCheckConfirmed: false, errorCode: "unavailable", state: null, busy: false });
  });

  it("a Reload after a failed read shows the loading sentence (no conversation on screen), then recovers to true", async () => {
    const fetch = await opened(async () => refused("unavailable"));
    const held = hold(fetch);
    hooks.actions!.onReload();
    // The earlier error is not cleared when the read starts, so its reason line can stay.
    expect(render()).toMatchObject({ busy: true, lastCheckConfirmed: false, errorCode: "unavailable", statusText: LOADING });
    held.resolve(ok(saved));
    expect(await settle()).toMatchObject({ lastCheckConfirmed: true, errorCode: null, busy: false });
  });
});

describe("compact header: the fact 'last check confirmed' on a change", () => {
  it("not written at the start of a change; a Send shows no status text while its reply is awaited", async () => {
    const fetch = await opened();
    const held = hold(fetch);
    send();
    expect(render()).toMatchObject({ busy: true, awaitingReply: true, lastCheckConfirmed: true, statusText: "" });
    held.resolve(ok(saved));
    expect(await settle()).toMatchObject({ busy: false, lastCheckConfirmed: true, statusText: "", state: { revision: 5 } });
  });

  it("a change that is not a Send shows the change busy sentence, not the Reload one", async () => {
    const fetch = await opened();
    hooks.actions!.onReviewEnd(); render();
    const held = hold(fetch);
    hooks.actions!.onConfirmEnd();
    expect(render()).toMatchObject({ busy: true, awaitingReply: false, statusText: CHANGE, lastCheckConfirmed: true });
    held.resolve(malformed());
    await settle();
  });

  it("confirmed without a support notice: true", async () => {
    const fetch = await opened(async () => refused("unavailable"));
    fetch.mockImplementation(async () => ok(state));
    hooks.actions!.onReload();
    await settle();
    // Bring the fact to false first, through a confirmed change that carried a support notice.
    fetch.mockImplementation(async () => ok({ ...state, revision: 4 }, { kind: "support", body: "An invented support notice.", persisted: false }));
    send();
    expect(await settle()).toMatchObject({ lastCheckConfirmed: false, uncertain: false, errorCode: null, assistance: { kind: "support" } });
    fetch.mockImplementation(async () => ok(saved));
    send();
    expect(await settle()).toMatchObject({ lastCheckConfirmed: true, uncertain: false, errorCode: null, assistance: null });
  });

  it.each(["support", "reply_failed"] as const)("confirmed with a %s notice: false", async kind => {
    const fetch = await opened();
    fetch.mockImplementation(async () => ok({ ...saved, messages: saved.messages.slice(0, 1) }, { kind, body: "An invented notice.", persisted: false }));
    send();
    expect(await settle()).toMatchObject({ lastCheckConfirmed: false, uncertain: false, errorCode: null, assistance: { kind } });
  });

  it.each([
    ["has no readable answer", () => malformed()],
    ["is answered as unavailable", () => refused("unavailable")],
    ["returns an older revision", () => ok({ ...state, revision: 2 })],
    ["returns another conversation", () => ok({ ...saved, conversationId: id(9) })],
  ] as const)("a change that %s is not confirmed: false, with Retry and no Reload", async (_name, answer) => {
    const fetch = await opened();
    fetch.mockImplementation(async () => answer());
    send();
    expect(await settle()).toMatchObject({ lastCheckConfirmed: false, uncertain: true, reloadAvailable: false, errorMessage: null });
  });

  it("a change whose request fails is not confirmed: false", async () => {
    const fetch = await opened();
    const held = hold(fetch);
    send(); render();
    held.reject(new Error("offline"));
    expect(await settle()).toMatchObject({ lastCheckConfirmed: false, uncertain: true });
  });

  it.each(["refresh_required", "provider_unavailable", "denied"] as const)("a change refused as %s: false, with the error code handed over", async code => {
    const fetch = await opened();
    fetch.mockImplementation(async () => refused(code));
    send();
    const view = await settle();
    expect(view).toMatchObject({ lastCheckConfirmed: false, uncertain: false, errorCode: code });
    // "Has changed" and sign-in remove the saved conversation; the Virtual Guide being unavailable keeps it.
    expect(view.state === null).toBe(code !== "provider_unavailable");
  });

  it("End that is not confirmed ended: false and uncertain", async () => {
    const fetch = await opened();
    hooks.actions!.onReviewEnd(); render();
    fetch.mockImplementation(async () => ok({ ...state, revision: 4 }));
    hooks.actions!.onConfirmEnd();
    expect(await settle()).toMatchObject({ lastCheckConfirmed: false, uncertain: true });
    expect(assign).not.toHaveBeenCalled();
  });

  it("End confirmed: the page leaves and no light is claimed", async () => {
    const fetch = await opened();
    hooks.actions!.onReviewEnd(); render();
    fetch.mockImplementation(async () => ok(ended));
    hooks.actions!.onConfirmEnd();
    expect(await settle()).toMatchObject({ lastCheckConfirmed: false, uncertain: false, ended: true });
    expect(assign).toHaveBeenCalledWith("/explorer/home");
  });

  it("Retry does not write the fact before its answer, and a confirmed Retry sets it", async () => {
    const fetch = await opened();
    fetch.mockImplementation(async () => malformed());
    send();
    expect(await settle()).toMatchObject({ lastCheckConfirmed: false, uncertain: true });
    const held = hold(fetch);
    hooks.actions!.onRetry();
    expect(render()).toMatchObject({ busy: true, uncertain: false, lastCheckConfirmed: false });
    held.resolve(ok(saved));
    expect(await settle()).toMatchObject({ lastCheckConfirmed: true, uncertain: false, busy: false });
  });

  it("the error code is handed over also while the last change is uncertain; the error sentence is not", async () => {
    const fetch = await opened();
    fetch.mockImplementation(async () => refused("provider_unavailable"));
    send();
    expect(await settle()).toMatchObject({ errorCode: "provider_unavailable", uncertain: false });
    expect(hooks.view!.errorMessage).not.toBeNull();
    // A later change (End) that cannot be confirmed: uncertain, with the earlier code still held by the logic.
    hooks.actions!.onReviewEnd(); render();
    fetch.mockImplementation(async () => malformed());
    hooks.actions!.onConfirmEnd();
    expect(await settle()).toMatchObject({ errorCode: "provider_unavailable", uncertain: true, errorMessage: null, lastCheckConfirmed: false });
  });
});

describe("compact header: what never writes the fact", () => {
  it("leaving the page does not write it; the saved conversation is removed and the loading sentence shows", async () => {
    await opened();
    leave();
    expect(render()).toMatchObject({ lastCheckConfirmed: true, state: null, busy: true, statusText: LOADING });
  });

  it("a late answer to a read, delivered after the page left, is thrown away by the guard: nothing changes", async () => {
    const fetch = await opened(async () => refused("unavailable"));
    expect(hooks.view).toMatchObject({ lastCheckConfirmed: false, errorCode: "unavailable", state: null });
    const held = holdIgnoringAbort(fetch);
    hooks.actions!.onReload(); render();
    leave();
    expect(held.aborted()).toBe(true);
    // The successful read arrives all the same. Without the guard it would set the fact and show the conversation.
    held.resolve(ok(saved));
    expect(await settle()).toMatchObject({ lastCheckConfirmed: false, state: null, errorCode: "unavailable", busy: true });
  });

  it("a late refusal of a change, delivered after the page left, is thrown away by the guard: nothing changes", async () => {
    const fetch = await opened();
    expect(hooks.view).toMatchObject({ lastCheckConfirmed: true, errorCode: null });
    const held = holdIgnoringAbort(fetch);
    send(); render();
    leave();
    expect(held.aborted()).toBe(true);
    // The refusal arrives all the same. Without the guard it would clear the fact and set the error.
    held.resolve(refused("refresh_required"));
    expect(await settle()).toMatchObject({ lastCheckConfirmed: true, state: null, errorCode: null, uncertain: false, busy: true });
  });

  it("a late confirmed change with a support notice, delivered after the page left, does not clear it either", async () => {
    const fetch = await opened();
    const held = holdIgnoringAbort(fetch);
    send(); render();
    leave();
    held.resolve(ok({ ...state, revision: 4 }, { kind: "support", body: "An invented support notice.", persisted: false }));
    expect(await settle()).toMatchObject({ lastCheckConfirmed: true, state: null, errorCode: null, assistance: null });
  });

  it("a read cancelled when the page left (its request aborted) does not write it", async () => {
    const fetch = await opened(async () => refused("unavailable"));
    expect(hooks.view!.lastCheckConfirmed).toBe(false);
    const held = hold(fetch);
    hooks.actions!.onReload(); render();
    leave();
    held.resolve(ok(saved));
    expect(await settle()).toMatchObject({ lastCheckConfirmed: false, state: null });
  });

  it("a change cancelled when the page left (its request aborted) does not clear it", async () => {
    const fetch = await opened();
    const held = hold(fetch);
    send(); render();
    leave();
    held.resolve(refused("refresh_required"));
    expect(await settle()).toMatchObject({ lastCheckConfirmed: true, state: null, errorCode: null });
  });

  it("opening and closing the End review, and typing, do not write it", async () => {
    const fetch = await opened(async () => refused("unavailable"));
    fetch.mockImplementation(async () => ok({ ...state, revision: 4 }, { kind: "support", body: "An invented support notice.", persisted: false }));
    hooks.actions!.onReload();
    expect(await settle()).toMatchObject({ lastCheckConfirmed: true });
    send();
    expect(await settle()).toMatchObject({ lastCheckConfirmed: false });
    hooks.actions!.onReviewEnd();
    expect(render().lastCheckConfirmed).toBe(false);
    hooks.actions!.onKeepOpen();
    hooks.actions!.onDraftChange("More invented words.");
    expect(render()).toMatchObject({ lastCheckConfirmed: false, endReviewOpen: false });
  });
});
