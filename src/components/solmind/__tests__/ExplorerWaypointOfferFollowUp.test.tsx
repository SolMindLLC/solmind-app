import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectedConversationActions } from "../ExplorerConversationConnectedScreen";
import type { ExplorerConversationState, ExplorerConversationWaypointOffer,
  ExplorerWaypointOfferOperationResult } from "../../../lib/solmind/explorerConversationContract";
import { EXPLORER_PRIVATE_RESPONSE_VERSION } from "../../../lib/solmind/explorerPrivateConversationResponse";
import { EXPLORER_FAILED_REPLY_RETRY_DRAFT } from "../../../lib/solmind/virtual-guide/explorerPrivateConversationComposition";
import { ExplorerConversation } from "../ExplorerConversation";

// Offers build, step 4: the button answer to a saved offer through the conversation's one request owner, and the
// automatic follow-up message bound to the presentation that was answered (REV473 finding 1, REV473b, REV473c and
// the binding REV473d entry). The harness is the one of ExplorerConversationCommandGate.test.tsx. Invented content only.
const captured = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[],
  actions: null as ConnectedConversationActions | null,
  updates: [] as unknown[],
}));
vi.mock("../../../lib/solmind/explorerEarlyTestNoticeRecheck", () => ({
  useExplorerEarlyTestNoticeRecheck: () => () => undefined,
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
const EARLIER_REPLY = id(11);
const REPLY = id(13);
const LATER_REPLY = id(15);
const OFFER = id(21);
const OTHER_OFFER = id(22);
const DRAFT = id(31);
const OTHER_DRAFT = id(32);
const WAYPOINT = id(41);
const NEXT_WAYPOINT = id(42);
const RESPONSES = ["right", "close", "not_it"] as const;
type Answer = typeof RESPONSES[number];
const LABELS = { right: "That's right", close: "Close, not quite", not_it: "That's not it" } as const;
const OUTCOME = { right: "confirmed", close: "kept_open", not_it: "declined" } as const;
const KINDS = ["change", "revisit"] as const;
type Offer = ExplorerConversationWaypointOffer;
const BEFORE = { title: "Walk each morning", destination: "Walk before work", whyItMatters: "I think more clearly after",
  arrivalSignal: "Five walks in one week" };
const OFFER_TITLE = "Walk before breakfast each day";
const DRAFT_TITLE = "Rest on Sundays";

function offer(kind: Offer["kind"], overrides: Record<string, unknown> = {}): Offer {
  const shared = { id: OFFER, status: "proposed", waypointId: WAYPOINT,
    targetBefore: { ...BEFORE, stage: kind === "revisit" ? "reached" : "formed" },
    suggestionMessageId: REPLY, resultWaypointId: null, targetCurrent: true, typedAnswerEligible: true, typedAnswerRefusal: null };
  return (kind === "reached" ? { ...shared, kind, evidence: "I walked five times this week", ...overrides }
    : { ...shared, kind, ...BEFORE, title: OFFER_TITLE, destination: "Walk before breakfast", ...overrides }) as Offer;
}
// The answered offer as the saved state shows it after each answer.
function answeredOffer(kind: Offer["kind"], response: Answer, overrides: Record<string, unknown> = {}): Offer {
  return response === "right" ? offer(kind, { status: "confirmed", typedAnswerEligible: false,
    resultWaypointId: kind === "reached" ? WAYPOINT : NEXT_WAYPOINT, ...overrides })
    : response === "not_it" ? offer(kind, { status: "declined", typedAnswerEligible: false, ...overrides })
      : offer(kind, { typedAnswerEligible: false, ...overrides });
}
function stored(kind: Offer["kind"], response: Answer, overrides: Partial<ExplorerWaypointOfferOperationResult> = {}): ExplorerWaypointOfferOperationResult {
  return { offerId: OFFER, kind, waypointId: WAYPOINT, suggestionMessageId: REPLY, response, typed: false, outcome: OUTCOME[response],
    resultWaypointId: response === "right" ? (kind === "reached" ? WAYPOINT : NEXT_WAYPOINT) : null, ...overrides };
}
const draft = (overrides: Record<string, unknown> = {}) => ({ id: DRAFT, title: DRAFT_TITLE, destination: "Keep Sunday free",
  whyItMatters: "I start the week calmer", arrivalSignal: "Three free Sundays", suggestionMessageId: REPLY,
  typedAnswerEligible: true, ...overrides }) as NonNullable<ExplorerConversationState["waypointDraft"]>;
const MESSAGES: ExplorerConversationState["messages"] = [
  { id: EARLIER_REPLY, role: "virtualGuide", body: "An invented earlier reply.", createdAt: "2026-11-16T09:00:00Z" },
  { id: id(12), role: "explorer", body: "An invented message.", createdAt: "2026-11-16T09:01:00Z" },
  { id: REPLY, role: "virtualGuide", body: "An invented reply.", createdAt: "2026-11-16T09:02:00Z" },
];
const LATER: ExplorerConversationState["messages"] = [...MESSAGES,
  { id: id(14), role: "explorer", body: "Another invented message.", createdAt: "2026-11-16T09:03:00Z" },
  { id: LATER_REPLY, role: "virtualGuide", body: "Another invented reply.", createdAt: "2026-11-16T09:04:00Z" }];
const THIRD: ExplorerConversationState["messages"] = [...LATER,
  { id: id(16), role: "virtualGuide", body: "A third invented reply.", createdAt: "2026-11-16T09:05:00Z" }];
function state(overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  return { version: "explorer-conversation.v1", conversationId: id(1), revision: 7, pendingTurn: false,
    turnedDownLimitReached: false, providerState: "available", compassSuggestionReplies: "available",
    messages: MESSAGES, compassItems: [], priorityId: null, attentionId: null, waypoints: [],
    waypointCapacity: { activeCount: 3, activeLimit: 20, historyRoom: true, conversationRoom: true },
    waypointProjection: { kind: "current_heads", limit: 20, hasMore: false, totalHeads: 0 },
    waypointDraft: null, waypointOffer: null, waypointOfferDrop: null, reachedOfferedWaypointIds: [], ...overrides };
}
const JSON_HEADERS = { headers: { "Content-Type": "application/json" } };
const answerOf = (next: ExplorerConversationState, result?: ExplorerWaypointOfferOperationResult | null) => new Response(JSON.stringify({
  version: EXPLORER_PRIVATE_RESPONSE_VERSION, result: { ok: true, state: next, error: null }, assistance: null,
  ...(result == null ? {} : { waypointOfferResult: result }) }), JSON_HEADERS);

const cleanups: (() => void)[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  captured.effects = [];
  captured.actions = null;
  captured.updates = [];
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function loaded(saved: ExplorerConversationState) {
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => answerOf(saved));
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
  captured.updates = [];
  return { fetch, actions: captured.actions! };
}
type Intent = Parameters<ConnectedConversationActions["onCommand"]>[0];
type Play = Readonly<{ before: ExplorerConversationState; intent: Intent; answered: ExplorerConversationState;
  result?: ExplorerWaypointOfferOperationResult | null; mode: "first" | "retry" }>;
// Presses the button and plays the server: the answer's result (lost once in "retry" mode, then given to the exact
// Retry), and a plain saved Send for any follow-up. Returns every command the screen sent, in order.
async function play({ before, intent, answered, result, mode }: Play) {
  const f = await loaded(before);
  let answers = 0;
  f.fetch.mockImplementation(async (_url, init) => {
    const command = JSON.parse(init!.body as string) as { kind: string };
    if (command.kind === "send") return answerOf({ ...answered, revision: answered.revision + 1 });
    answers += 1;
    if (mode === "retry" && answers === 1) return new Response("malformed", JSON_HEADERS);
    return answerOf(answered, result);
  });
  f.actions.onCommand(intent);
  await vi.advanceTimersByTimeAsync(0);
  if (mode === "retry") {
    expect(f.fetch).toHaveBeenCalledOnce();
    f.actions.onRetry();
    await vi.advanceTimersByTimeAsync(0);
    // Exact-bytes Retry of the answer, before anything else.
    expect(f.fetch.mock.calls[1][1]!.body).toBe(f.fetch.mock.calls[0][1]!.body);
  }
  const commands = f.fetch.mock.calls.map(call => JSON.parse(call[1]!.body as string) as Record<string, unknown>);
  const answersSent = mode === "retry" ? 2 : 1;
  expect(commands.slice(0, answersSent).every(command => command.kind === intent.kind)).toBe(true);
  return { commands, answersSent, sends: commands.filter(command => command.kind === "send"), f };
}
function expectFollowUp(played: Awaited<ReturnType<typeof play>>, response: Answer, title: string, revision: number) {
  expect(played.commands).toHaveLength(played.answersSent + 1);
  expect(played.sends).toEqual([{ kind: "send", body: `${LABELS[response]}: "${title}"`, operationId: expect.any(String), expectedRevision: revision }]);
  expect(played.sends[0].operationId).not.toBe(played.commands[0].operationId);
}
function expectNoFollowUp(played: Awaited<ReturnType<typeof play>>) {
  expect(played.commands).toHaveLength(played.answersSent);
  expect(played.sends).toEqual([]);
}
const savedStates = () => captured.updates.filter((value): value is ExplorerConversationState =>
  typeof value === "object" && value !== null && "revision" in value);
const offerIntent = (response: Answer): Intent => ({ kind: "respond_waypoint_offer", offerId: OFFER, response });
const draftIntent = (response: Answer): Intent => ({ kind: "respond_waypoint_draft", draftId: DRAFT, response });
const MODES = ["first", "retry"] as const;
const matrix = <A, B, C>(a: readonly A[], b: readonly B[], c: readonly C[]) => a.flatMap(x => b.flatMap(y => c.map(z => [x, y, z] as const)));

describe("offers build step 4: the intent a box's button sends", () => {
  it.each([["reached", "right"], ["reached", "not_it"], ...KINDS.flatMap(kind => RESPONSES.map(response => [kind, response] as const))] as const)(
    "%s offer, %s: one respond_waypoint_offer command at the saved revision, through the existing pipeline", async (kind, response) => {
      const f = await loaded(state({ waypointOffer: offer(kind) }));
      f.fetch.mockImplementation(() => new Promise<Response>(() => undefined));
      f.actions.onCommand(offerIntent(response));
      f.actions.onCommand(offerIntent(response));
      expect(f.fetch).toHaveBeenCalledOnce();
      expect(f.fetch.mock.calls[0][0]).toBe("/explorer/conversation/commands");
      expect(JSON.parse(f.fetch.mock.calls[0][1]!.body as string)).toEqual({ kind: "respond_waypoint_offer", offerId: OFFER, response,
        operationId: expect.any(String), expectedRevision: 7 });
      // Display only: the box of this offer shows "Saving..." while its answer is in flight.
      expect(captured.updates).toContain(OFFER);
    });

  it.each([
    ["no saved offer", state(), "right"],
    ["another offer id", state({ waypointOffer: offer("change", { id: OTHER_OFFER }) }), "right"],
    ["a confirmed offer", state({ waypointOffer: answeredOffer("change", "right") }), "not_it"],
    ["a declined offer", state({ waypointOffer: answeredOffer("change", "not_it") }), "right"],
    ["a yes when the Waypoint changed since the offer was shown", state({ waypointOffer: offer("change", { targetCurrent: false, typedAnswerEligible: false }) }), "right"],
    ["a yes at 200 saved versions", state({ waypointOffer: offer("change"), waypointCapacity: { activeCount: 3, activeLimit: 20, historyRoom: false, conversationRoom: true } }), "right"],
    ["a revisit yes at 20 active Waypoints", state({ waypointOffer: offer("revisit"), waypointCapacity: { activeCount: 20, activeLimit: 20, historyRoom: true, conversationRoom: true } }), "right"],
    ["Close for a Reached offer", state({ waypointOffer: offer("reached") }), "close"],
    ["a pending turn", state({ waypointOffer: offer("change"), pendingTurn: true }), "right"],
    ["the support hold", state({ waypointOffer: offer("change"), compassSuggestionReplies: "support" }), "right"],
    ["the adults-only hold", state({ waypointOffer: offer("change"), compassSuggestionReplies: "adult_policy" }), "not_it"],
    ["unconfirmed settings", state({ waypointOffer: offer("change"), compassSuggestionReplies: "unavailable" }), "right"],
    ["Close when the Virtual Guide is unavailable", state({ waypointOffer: offer("change"), providerState: "unavailable" }), "close"],
    ["That's not it when the Virtual Guide is unavailable", state({ waypointOffer: offer("revisit"), providerState: "unavailable" }), "not_it"],
  ] as const)("refuses locally, without a request: %s", async (_name, saved, response) => {
    const f = await loaded(saved);
    f.actions.onCommand(offerIntent(response));
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetch).not.toHaveBeenCalled();
  });

  it("keeps the other answers of a change offer at a limit, and Not yet without the Virtual Guide", async () => {
    const full = state({ waypointOffer: offer("change"), waypointCapacity: { activeCount: 3, activeLimit: 20, historyRoom: false, conversationRoom: true } });
    const f = await loaded(full);
    f.fetch.mockImplementation(() => new Promise<Response>(() => undefined));
    f.actions.onCommand(offerIntent("close"));
    expect(f.fetch).toHaveBeenCalledOnce();
    for (const cleanup of cleanups.splice(0)) cleanup();
    captured.effects = [];
    const g = await loaded(state({ waypointOffer: offer("reached"), providerState: "unavailable" }));
    g.fetch.mockImplementation(() => new Promise<Response>(() => undefined));
    g.actions.onCommand(offerIntent("not_it"));
    expect(g.fetch).toHaveBeenCalledOnce();
  });

  it("a stale result leaves the changed-conversation path to the page and starts no follow-up", async () => {
    const f = await loaded(state({ waypointOffer: offer("change") }));
    f.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ version: EXPLORER_PRIVATE_RESPONSE_VERSION,
      result: { ok: false, state: null, error: "refresh_required" }, assistance: null }), { status: 409, ...JSON_HEADERS }));
    f.actions.onCommand(offerIntent("right"));
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetch).toHaveBeenCalledOnce();
    expect(captured.updates).toContain("refresh_required");
  });
});

describe("offers build step 4: the automatic follow-up after a change or revisit offer", () => {
  it.each(matrix(KINDS, RESPONSES, MODES))("%s offer, %s, %s result in an unchanged conversation: the follow-up is sent once", async (kind, response, mode) => {
    const played = await play({ before: state({ waypointOffer: offer(kind) }), intent: offerIntent(response),
      answered: state({ revision: 8, waypointOffer: answeredOffer(kind, response) }), result: stored(kind, response), mode });
    expectFollowUp(played, response, OFFER_TITLE, 8);
  });

  it.each(matrix(["right", "not_it"] as const, MODES, [0] as const))("Reached offer, %s, %s result: no message is sent in the Explorer's name", async (response, mode) => {
    const played = await play({ before: state({ waypointOffer: offer("reached") }), intent: offerIntent(response),
      answered: state({ revision: 8, waypointOffer: answeredOffer("reached", response) }), result: stored("reached", response), mode });
    expectNoFollowUp(played);
    expect(savedStates().at(-1)).toMatchObject({ revision: 8, waypointOffer: { id: OFFER, status: response === "right" ? "confirmed" : "declined" } });
  });

  it.each(matrix(KINDS, RESPONSES, [0] as const))("%s offer, %s: a Retry whose state holds a newer reply sends none", async (kind, response) => {
    const played = await play({ before: state({ waypointOffer: offer(kind) }), intent: offerIntent(response),
      answered: state({ revision: 10, messages: LATER, waypointOffer: answeredOffer(kind, response) }), result: stored(kind, response), mode: "retry" });
    expectNoFollowUp(played);
  });

  it.each(matrix(KINDS, RESPONSES, [0] as const))("%s offer, %s: a Retry whose state holds a newer offer with the same title sends none, and that offer still waits", async (kind, response) => {
    // The lost response's Retry returns the original answer's stored result with a state in which another tab
    // already holds a newer offer of the same title: a "That's right" message would read as a typed yes to it.
    const newer = offer(kind, { id: OTHER_OFFER, suggestionMessageId: LATER_REPLY });
    const played = await play({ before: state({ waypointOffer: offer(kind) }), intent: offerIntent(response),
      answered: state({ revision: 10, messages: LATER, waypointOffer: newer }), result: stored(kind, response), mode: "retry" });
    expectNoFollowUp(played);
    expect(savedStates().at(-1)).toMatchObject({ revision: 10, waypointOffer: { id: OTHER_OFFER, status: "proposed", title: OFFER_TITLE } });
  });

  it.each(matrix(KINDS, RESPONSES, MODES))("%s offer, %s, %s result: a newer forming Waypoint under a newer reply sends none", async (kind, response, mode) => {
    const played = await play({ before: state({ waypointOffer: offer(kind) }), intent: offerIntent(response),
      answered: state({ revision: 8, messages: LATER, waypointOffer: answeredOffer(kind, response),
        waypointDraft: draft({ suggestionMessageId: LATER_REPLY }) }), result: stored(kind, response), mode });
    expectNoFollowUp(played);
  });

  it.each(matrix(KINDS, RESPONSES, MODES))("REV473c case 1, %s offer, %s, %s result: sent while an older forming Waypoint still waits under an earlier reply", async (kind, response, mode) => {
    const older = draft({ suggestionMessageId: EARLIER_REPLY, typedAnswerEligible: false });
    const played = await play({ before: state({ waypointOffer: offer(kind), waypointDraft: older }), intent: offerIntent(response),
      answered: state({ revision: 8, waypointOffer: answeredOffer(kind, response), waypointDraft: older }), result: stored(kind, response), mode });
    expectFollowUp(played, response, OFFER_TITLE, 8);
  });
  it.each(matrix(KINDS, RESPONSES, MODES))("REV473c case 1, %s offer, %s, %s result: a reply added after the press, or a forming Waypoint that can take a typed answer, sends none", async (kind, response, mode) => {
    const older = draft({ suggestionMessageId: EARLIER_REPLY, typedAnswerEligible: false });
    const before = state({ waypointOffer: offer(kind), waypointDraft: older });
    expectNoFollowUp(await play({ before, intent: offerIntent(response), mode, result: stored(kind, response),
      answered: state({ revision: 8, messages: LATER, waypointOffer: answeredOffer(kind, response), waypointDraft: older }) }));
    for (const cleanup of cleanups.splice(0)) cleanup();
    captured.effects = [];
    expectNoFollowUp(await play({ before, intent: offerIntent(response), mode, result: stored(kind, response),
      answered: state({ revision: 8, waypointOffer: answeredOffer(kind, response), waypointDraft: draft({ id: OTHER_DRAFT, typedAnswerEligible: true }) }) }));
  });

  it.each(matrix(KINDS, RESPONSES, MODES))("REV473c case 2, %s offer, %s, %s result: sent for an older offer answered after a later ordinary reply", async (kind, response, mode) => {
    const waiting = offer(kind, { typedAnswerEligible: false });
    const played = await play({ before: state({ messages: LATER, waypointOffer: waiting }), intent: offerIntent(response),
      answered: state({ revision: 8, messages: LATER, waypointOffer: answeredOffer(kind, response) }), result: stored(kind, response), mode });
    expectFollowUp(played, response, OFFER_TITLE, 8);
  });
  it.each(matrix(KINDS, RESPONSES, MODES))("REV473c case 2, %s offer, %s, %s result: a reply added after the press, or a waiting presentation on the latest reply, sends none", async (kind, response, mode) => {
    const before = state({ messages: LATER, waypointOffer: offer(kind, { typedAnswerEligible: false }) });
    expectNoFollowUp(await play({ before, intent: offerIntent(response), mode, result: stored(kind, response),
      answered: state({ revision: 8, messages: THIRD, waypointOffer: answeredOffer(kind, response) }) }));
    for (const cleanup of cleanups.splice(0)) cleanup();
    captured.effects = [];
    expectNoFollowUp(await play({ before, intent: offerIntent(response), mode, result: stored(kind, response),
      answered: state({ revision: 8, messages: LATER, waypointOffer: answeredOffer(kind, response),
        waypointDraft: draft({ suggestionMessageId: LATER_REPLY, typedAnswerEligible: true }) }) }));
  });

  it.each(RESPONSES)("change offer, %s: no follow-up without the answer's own stored result, or with a result for another presentation", async response => {
    const before = state({ waypointOffer: offer("change") });
    const answered = state({ revision: 8, waypointOffer: answeredOffer("change", response) });
    expectNoFollowUp(await play({ before, intent: offerIntent(response), answered, result: null, mode: "first" }));
    expect(savedStates().at(-1)).toMatchObject({ revision: 8, waypointOffer: { id: OFFER } });
    for (const cleanup of cleanups.splice(0)) cleanup();
    captured.effects = [];
    expectNoFollowUp(await play({ before, intent: offerIntent(response), answered, mode: "first",
      result: stored("change", response, { suggestionMessageId: EARLIER_REPLY }) }));
  });
});

describe("offers build step 4: a failed or skipped follow-up never changes the Saved line", () => {
  for (const gate of ["provider", "capacity", "pending", "support", "adult_policy"] as const) {
    it.each(KINDS)(`keeps the confirmed answer when the follow-up is held by ${gate}: %s offer`, async kind => {
      const before = state({ waypointOffer: offer(kind), ...(gate === "provider" ? { providerState: "unavailable" as const } : {}) });
      const answered = state({ revision: 8, waypointOffer: answeredOffer(kind, "right"),
        ...(gate === "capacity" ? { messages: Array.from({ length: 99 }, (_, index) => ({ ...MESSAGES[2], id: index === 98 ? REPLY : id(index + 500) })) } : {}),
        ...(gate === "pending" ? { pendingTurn: true } : {}),
        ...(gate === "support" || gate === "adult_policy" ? { compassSuggestionReplies: gate } : {}) });
      const played = await play({ before, intent: offerIntent("right"), answered, result: stored(kind, "right"), mode: "first" });
      expectNoFollowUp(played);
      expect(savedStates().at(-1)).toMatchObject({ revision: 8, waypointOffer: { id: OFFER, status: "confirmed", resultWaypointId: NEXT_WAYPOINT } });
    });
  }

  it.each(KINDS)("keeps the confirmed %s offer when the follow-up's reply fails", async kind => {
    const f = await loaded(state({ waypointOffer: offer(kind) }));
    const answered = state({ revision: 8, waypointOffer: answeredOffer(kind, "right") });
    const afterSend = { ...answered, revision: 9, messages: [...answered.messages,
      { id: id(60), role: "explorer" as const, body: `That's right: "${OFFER_TITLE}"`, createdAt: "2026-11-16T10:00:00Z" }] };
    f.fetch.mockImplementation(async (_url, init) => JSON.parse(init!.body as string).kind === "send"
      ? new Response(JSON.stringify({ version: EXPLORER_PRIVATE_RESPONSE_VERSION, result: { ok: true, state: afterSend, error: null },
        assistance: { kind: "reply_failed", body: EXPLORER_FAILED_REPLY_RETRY_DRAFT, persisted: false } }), JSON_HEADERS)
      : answerOf(answered, stored(kind, "right")));
    f.actions.onCommand(offerIntent("right"));
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(f.fetch.mock.calls[1][1]!.body as string)).toMatchObject({ kind: "send", body: `That's right: "${OFFER_TITLE}"`, expectedRevision: 8 });
    expect(savedStates().at(-1)).toMatchObject({ revision: 9, waypointOffer: { id: OFFER, status: "confirmed" } });
    // The message notice shows; nothing is retried by the screen itself.
    const notices = captured.updates.filter(value => typeof value === "object" && value !== null && "persisted" in value);
    expect(notices.at(-1)).toMatchObject({ kind: "reply_failed", persisted: false });
  });
});

describe("offers build step 4: the same protection for the forming Waypoint's follow-up", () => {
  const afterDraft = (response: Answer, overrides: Partial<ExplorerConversationState> = {}) =>
    state({ revision: 8, waypointDraft: response === "close" ? draft({ typedAnswerEligible: false }) : null, ...overrides });

  it.each(matrix(RESPONSES, MODES, [0] as const))("%s, %s result in an unchanged conversation: the follow-up is sent once", async (response, mode) => {
    const played = await play({ before: state({ waypointDraft: draft() }), intent: draftIntent(response), answered: afterDraft(response), mode });
    expectFollowUp(played, response, DRAFT_TITLE, 8);
  });
  it.each(RESPONSES)("%s: a Retry whose state holds a newer reply sends none", async response => {
    expectNoFollowUp(await play({ before: state({ waypointDraft: draft() }), intent: draftIntent(response),
      answered: afterDraft(response, { revision: 10, messages: LATER }), mode: "retry" }));
  });
  it.each(RESPONSES)("%s: a Retry whose state holds a newer forming Waypoint with the same title sends none, and it still waits", async response => {
    const newer = draft({ id: OTHER_DRAFT, suggestionMessageId: LATER_REPLY });
    expectNoFollowUp(await play({ before: state({ waypointDraft: draft() }), intent: draftIntent(response),
      answered: state({ revision: 10, messages: LATER, waypointDraft: newer }), mode: "retry" }));
    expect(savedStates().at(-1)).toMatchObject({ revision: 10, waypointDraft: { id: OTHER_DRAFT, title: DRAFT_TITLE } });
  });
  it.each(matrix(RESPONSES, MODES, [0] as const))("%s, %s result: a newer offer that can take a typed answer sends none", async (response, mode) => {
    expectNoFollowUp(await play({ before: state({ waypointDraft: draft() }), intent: draftIntent(response), mode,
      answered: afterDraft(response, { messages: LATER, waypointOffer: offer("change", { suggestionMessageId: LATER_REPLY }) }) }));
  });
  it.each(matrix(RESPONSES, MODES, [0] as const))("%s, %s result: an older forming Waypoint answered after a later ordinary reply gets its follow-up", async (response, mode) => {
    const older = draft({ typedAnswerEligible: false });
    const played = await play({ before: state({ messages: LATER, waypointDraft: older }), intent: draftIntent(response),
      answered: afterDraft(response, { messages: LATER }), mode });
    expectFollowUp(played, response, DRAFT_TITLE, 8);
  });

  // REV473d (binding): the read's example. An older forming Waypoint waits beside a newer change offer; the offer
  // was answered "Close, not quite" and its own follow-up failed before another reply was saved, so it still waits
  // under the latest reply, but with an answer receipt: the server says it cannot take a typed answer.
  it.each(matrix(RESPONSES, MODES, [0] as const))("REV473d, %s, %s result: the already-answered offer does not block the forming Waypoint's follow-up", async (response, mode) => {
    const answeredBefore = offer("change", { suggestionMessageId: LATER_REPLY, typedAnswerEligible: false });
    const older = draft({ typedAnswerEligible: false });
    const played = await play({ before: state({ messages: LATER, waypointDraft: older, waypointOffer: answeredBefore }), intent: draftIntent(response),
      answered: afterDraft(response, { messages: LATER, waypointOffer: answeredBefore }), mode });
    expectFollowUp(played, response, DRAFT_TITLE, 8);
  });
  it.each(matrix(RESPONSES, MODES, [0] as const))("REV473d, %s, %s result: a competing offer that can take a typed answer still blocks", async (response, mode) => {
    const competing = offer("change", { suggestionMessageId: LATER_REPLY, typedAnswerEligible: true });
    const older = draft({ typedAnswerEligible: false });
    expectNoFollowUp(await play({ before: state({ messages: LATER, waypointDraft: older, waypointOffer: competing }), intent: draftIntent(response),
      answered: afterDraft(response, { messages: LATER, waypointOffer: competing }), mode }));
  });
});

// Decision 5 of Paul's sheet of 2026-11-16 21:52:56 CST: after a button "That's right" is confirmed saved while its own
// box is no longer shown, the status line names the earlier answer and the Waypoint (by the title its box showed).
describe("offers build: the earlier answer's status line after a Retry", () => {
  const EARLIER = { change: 'Your earlier answer to change "Walk each morning" was saved.',
    revisit: 'Your earlier answer to take up "Walk each morning" again was saved.',
    reached: 'Your earlier answer to mark "Walk each morning" Reached was saved.' } as const;
  const notices = () => captured.updates.filter((value): value is string => typeof value === "string" && value.startsWith("Your earlier answer"));
  // The line must be the settled status. Since the compact header no "up to date" sentence exists to replace it
  // (the strip's light says that), so the line is the last notice written and the old sentence is never written.
  const settledOn = (line: string) => {
    const at = captured.updates.lastIndexOf(line);
    expect(at).toBeGreaterThan(-1);
    expect(captured.updates.filter(value => typeof value === "string" && value.includes("is up to date"))).toEqual([]);
    expect(captured.updates.slice(at + 1).filter(value => typeof value === "string" && value.startsWith("Your "))).toEqual([]);
  };
  it.each(["change", "revisit", "reached"] as const)("%s offer, That's right lost then retried while a newer offer waits: the line shows", async kind => {
    const newer = offer(kind, { id: OTHER_OFFER, suggestionMessageId: LATER_REPLY });
    const played = await play({ before: state({ waypointOffer: offer(kind) }), intent: offerIntent("right"),
      answered: state({ revision: 10, messages: LATER, waypointOffer: newer }), result: stored(kind, "right"), mode: "retry" });
    expectNoFollowUp(played);
    expect(notices()).toEqual([EARLIER[kind]]);
    settledOn(EARLIER[kind]);
    expect(savedStates().at(-1)).toMatchObject({ waypointOffer: { id: OTHER_OFFER, status: "proposed" } });
  });
  it.each(["close", "not_it"] as const)("change offer, %s, lost then retried while a newer offer waits: no line", async response => {
    const newer = offer("change", { id: OTHER_OFFER, suggestionMessageId: LATER_REPLY });
    await play({ before: state({ waypointOffer: offer("change") }), intent: offerIntent(response),
      answered: state({ revision: 10, messages: LATER, waypointOffer: newer }), result: stored("change", response), mode: "retry" });
    expect(notices()).toEqual([]);
  });
  it.each(matrix(["change", "revisit", "reached"] as const, MODES, [0] as const))("%s offer, That's right, %s result with its own confirmed box shown: no line (the box's Saved line says it)", async (kind, mode) => {
    await play({ before: state({ waypointOffer: offer(kind) }), intent: offerIntent("right"),
      answered: state({ revision: 8, waypointOffer: answeredOffer(kind, "right") }), result: stored(kind, "right"), mode });
    expect(notices()).toEqual([]);
  });
  it.each(["none", "other", "typed"] as const)("no line when the stored result is %s (missing, another offer's, or a typed answer's)", async which => {
    const newer = offer("change", { id: OTHER_OFFER, suggestionMessageId: LATER_REPLY });
    const result = which === "none" ? null : which === "other" ? stored("change", "right", { offerId: OTHER_OFFER })
      : stored("change", "right", { typed: true });
    await play({ before: state({ waypointOffer: offer("change") }), intent: offerIntent("right"),
      answered: state({ revision: 10, messages: LATER, waypointOffer: newer }), result, mode: "retry" });
    expect(notices()).toEqual([]);
  });
});

describe("offers build, REV488: the earlier answer's line only after a Retry, and through the automatic follow-up", () => {
  const notices = () => captured.updates.filter((value): value is string => typeof value === "string" && value.startsWith("Your earlier answer"));
  it.each(["change", "revisit", "reached"] as const)("%s offer: a first result whose state already holds a newer offer shows no line (the approved wording names a Retry)", async kind => {
    const newer = offer(kind, { id: OTHER_OFFER, suggestionMessageId: LATER_REPLY });
    await play({ before: state({ waypointOffer: offer(kind) }), intent: offerIntent("right"),
      answered: state({ revision: 10, messages: LATER, waypointOffer: newer }), result: stored(kind, "right"), mode: "first" });
    expect(notices()).toEqual([]);
  });
  it("names the title the answered box showed, not the newer offer's title", async () => {
    const newer = offer("change", { id: OTHER_OFFER, suggestionMessageId: LATER_REPLY, title: "A different newer title",
      targetBefore: { ...BEFORE, title: "Another saved title", stage: "formed" } });
    await play({ before: state({ waypointOffer: offer("change") }), intent: offerIntent("right"),
      answered: state({ revision: 10, messages: LATER, waypointOffer: newer }), result: stored("change", "right"), mode: "retry" });
    expect(notices()).toEqual(['Your earlier answer to change "Walk each morning" was saved.']);
  });
  it.each(["change", "revisit"] as const)("%s offer: a Retry shows the confirmed box, its follow-up's reply replaces it with a newer offer, and the line is the settled status", async kind => {
    const f = await loaded(state({ waypointOffer: offer(kind) }));
    const newer = offer(kind, { id: OTHER_OFFER, suggestionMessageId: LATER_REPLY });
    let answers = 0;
    f.fetch.mockImplementation(async (_url, init) => {
      const command = JSON.parse(init!.body as string) as { kind: string };
      if (command.kind === "send") return answerOf(state({ revision: 9, messages: LATER, waypointOffer: newer }));
      answers += 1;
      if (answers === 1) return new Response("malformed", JSON_HEADERS);
      return answerOf(state({ revision: 8, waypointOffer: answeredOffer(kind, "right") }), stored(kind, "right"));
    });
    f.actions.onCommand(offerIntent("right"));
    await vi.advanceTimersByTimeAsync(0);
    f.actions.onRetry();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);
    const kinds = f.fetch.mock.calls.map(call => (JSON.parse(call[1]!.body as string) as { kind: string }).kind);
    expect(kinds).toEqual(["respond_waypoint_offer", "respond_waypoint_offer", "send"]);
    const line = kind === "change" ? 'Your earlier answer to change "Walk each morning" was saved.'
      : 'Your earlier answer to take up "Walk each morning" again was saved.';
    expect(notices()).toEqual([line]);
    // Since the compact header no "up to date" sentence is written at all; the line is the last notice written.
    expect(captured.updates.filter(value => typeof value === "string" && value.includes("is up to date"))).toEqual([]);
    expect(captured.updates.slice(captured.updates.lastIndexOf(line) + 1).filter(value => typeof value === "string" && value.startsWith("Your "))).toEqual([]);
  });
  it("a first result whose follow-up's reply brings a newer offer shows no line (no Retry happened)", async () => {
    const f = await loaded(state({ waypointOffer: offer("change") }));
    const newer = offer("change", { id: OTHER_OFFER, suggestionMessageId: LATER_REPLY });
    f.fetch.mockImplementation(async (_url, init) => {
      const command = JSON.parse(init!.body as string) as { kind: string };
      if (command.kind === "send") return answerOf(state({ revision: 9, messages: LATER, waypointOffer: newer }));
      return answerOf(state({ revision: 8, waypointOffer: answeredOffer("change", "right") }), stored("change", "right"));
    });
    f.actions.onCommand(offerIntent("right"));
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetch).toHaveBeenCalledTimes(2);
    expect(notices()).toEqual([]);
  });
  it("a typed Send whose result carries a typed confirmation shows no line", async () => {
    const f = await loaded(state({ waypointOffer: offer("change") }));
    const newer = offer("change", { id: OTHER_OFFER, suggestionMessageId: LATER_REPLY });
    f.fetch.mockImplementation(async () => answerOf(state({ revision: 9, messages: LATER, waypointOffer: newer }),
      stored("change", "right", { typed: true })));
    // The owner's command path for a typed message (the static render keeps the draft from its first render).
    f.actions.onCommand({ kind: "send", body: "That's right" } as never);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(f.fetch.mock.calls[0][1]!.body as string)).toMatchObject({ kind: "send", body: "That's right" });
    expect(notices()).toEqual([]);
  });
});
