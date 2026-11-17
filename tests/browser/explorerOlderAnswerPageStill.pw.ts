// Synthetic routed responses only. The Executor runs this suite on the narrow project.
import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import type { ExplorerConversationCommand, ExplorerConversationState } from "../../src/lib/solmind/explorerConversationContract";
import { cardState } from "./connectedCardFixture";
import { COMMANDS_URL, STATE_URL } from "./compactHeaderHelpers";

test.use({ trace: "off", screenshot: "off", video: "off" });

const DRAFT_ID = "80000000-0000-4000-8000-0000000000d1";
const GUIDE_ID = "30000000-0000-4000-8000-0000000000d1";
const TITLE = "Make time for a walk";
const CHOICE = "I have a question";
const LONG_REPLY = Array.from({ length: 90 }, (_, index) =>
  `Synthetic sentence ${index + 1} about an invented ordinary afternoon and a quiet walk.`).join(" ");

type AnswerKind = "waypoint" | "choice";

function startingState(kind: AnswerKind): ExplorerConversationState {
  const filler: ExplorerConversationState["messages"][number][] = [];
  for (let index = 1; index <= 8; index += 1) {
    filler.push({ id: `20000000-0000-4000-8000-0000000000e${index}`, role: "explorer",
      body: `An invented earlier message ${index} with enough ordinary words to fill the saved transcript.`,
      createdAt: `2026-11-17T07:0${index}:00.000Z` });
    filler.push({ id: `30000000-0000-4000-8000-0000000000e${index}`, role: "virtualGuide",
      body: `A synthetic earlier answer ${index} about an ordinary day.`,
      createdAt: `2026-11-17T07:0${index}:30.000Z` });
  }
  const messages: ExplorerConversationState["messages"] = [...filler,
    { id: "20000000-0000-4000-8000-0000000000d1", role: "explorer",
      body: "An invented request about a walk.", createdAt: "2026-11-17T08:00:00.000Z" },
    { id: GUIDE_ID, role: "virtualGuide", body: LONG_REPLY, createdAt: "2026-11-17T08:00:01.000Z",
      ...(kind === "choice" ? { choices: [{ label: CHOICE }] } : {}) },
  ];
  return cardState({ revision: 12, providerState: "available", compassSuggestionReplies: "available",
    messages, compassItems: [], priorityId: null, attentionId: null, waypoints: [],
    waypointCapacity: { activeCount: 0, activeLimit: 20, historyRoom: true, conversationRoom: true },
    waypointProjection: { kind: "current_heads", limit: 20, totalHeads: 0, hasMore: false },
    waypointDraft: kind === "waypoint" ? { id: DRAFT_ID, suggestionMessageId: GUIDE_ID, title: TITLE,
      destination: "Walk before lunch", whyItMatters: "An invented reason to pause",
      arrivalSignal: "One walk completed" } : null });
}

const response = (state: ExplorerConversationState) => ({
  version: "explorer-private-conversation-response.v1",
  result: { ok: true, state, error: null }, assistance: null,
});
const fulfill = (route: Route, state: ExplorerConversationState) => route.fulfill({ json: response(state) });
const transcript = (page: Page) => page.getByRole("log", { name: "Conversation transcript", exact: true });
const savedMessages = (page: Page) => page.getByRole("list", { name: "Saved conversation", exact: true });
const windowY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
const endGap = (page: Page) => transcript(page).evaluate(element =>
  Math.round(element.scrollHeight - element.clientHeight - element.scrollTop));

for (const kind of ["waypoint", "choice"] as const) for (const hiddenTop of [32, 96] as const) {
  test(`B2 a tall ${kind} answer keeps the page still with ${hiddenTop}px of transcript above the window`, async ({ page }) => {
    test.skip(test.info().project.name === "desktop-chromium", "the narrow project is 390 by 844");
    let current = startingState(kind);
    const requests: ExplorerConversationCommand[] = [];
    const waiting: { first: Route | null; send: Route | null } = { first: null, send: null };
    await page.route(STATE_URL, route => fulfill(route, current));
    await page.route(COMMANDS_URL, route => {
      const command = route.request().postDataJSON() as ExplorerConversationCommand;
      requests.push(command);
      if (command.kind === "respond_waypoint_draft") waiting.first = route;
      else if (command.kind === "send") waiting.send = route;
      else throw new Error("unexpected_command");
    });
    await page.goto("/explorer/conversation");
    const item = savedMessages(page).getByRole("listitem").nth(17);
    await expect(item).toBeVisible();
    await expect(page.getByLabel("Continue the conversation", { exact: true })).toBeInViewport({ ratio: 0.99 });
    await expect.poll(() => endGap(page)).toBeLessThanOrEqual(2);
    const tall = await item.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { height: Math.round(rect.height), above: Math.round(Math.max(0, Math.min(rect.bottom, window.innerHeight))) };
    });
    expect(tall.height, JSON.stringify(tall)).toBeGreaterThan(844);
    expect(tall.height, JSON.stringify(tall)).toBeGreaterThan(tall.above);
    const answer: Locator = kind === "waypoint"
      ? item.getByRole("group", { name: `Reply to Waypoint suggestion: ${TITLE}`, exact: true })
        .getByRole("button", { name: "That's not it", exact: true })
      : item.getByRole("group", { name: "Suggested replies", exact: true })
        .getByRole("button", { name: CHOICE, exact: true });
    // With the transcript's top above the window, plain li.focus() can move the window after
    // scrolling the tall reply inside the transcript. Keep the answer button fully in view.
    await transcript(page).evaluate((element, hidden) => {
      window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top + hidden);
    }, hiddenTop);
    const precondition = await answer.evaluate(element => {
      const row = element.closest("li")!;
      const box = element.closest('[role="log"]')!;
      const buttonRect = element.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      return { boxTop: boxRect.top, boxBottom: boxRect.bottom, rowTop: row.getBoundingClientRect().top,
        buttonTop: buttonRect.top, buttonBottom: buttonRect.bottom, windowHeight: window.innerHeight };
    });
    expect(precondition.boxTop, JSON.stringify(precondition)).toBeLessThan(-16);
    expect(Math.abs(precondition.boxTop + hiddenTop), JSON.stringify(precondition)).toBeLessThanOrEqual(2);
    expect(precondition.rowTop, JSON.stringify(precondition)).toBeLessThan(0);
    expect(precondition.buttonTop, JSON.stringify(precondition)).toBeGreaterThanOrEqual(0);
    expect(precondition.buttonBottom, JSON.stringify(precondition)).toBeLessThanOrEqual(precondition.boxBottom);
    expect(precondition.buttonBottom, JSON.stringify(precondition)).toBeLessThanOrEqual(precondition.windowHeight);
    const before = await windowY(page);
    // A DOM click preserves the measured page position before the handler runs.
    await answer.evaluate(element => (element as HTMLButtonElement).click());
    await expect.poll(() => requests.length).toBe(1);
    await expect(item).toBeFocused();
    expect(await windowY(page)).toBe(before);

    if (kind === "waypoint") {
      expect(requests[0]).toMatchObject({ kind: "respond_waypoint_draft", draftId: DRAFT_ID,
        response: "not_it", expectedRevision: 12 });
      current = { ...current, revision: 13, waypointDraft: null };
      await fulfill(waiting.first!, current);
      await expect.poll(() => requests.length).toBe(2);
    }
    const send = requests.at(-1)!;
    if (send.kind !== "send") throw new Error("expected_send");
    expect(send).toMatchObject(kind === "waypoint"
      ? { kind: "send", body: `That's not it: "${TITLE}"`, expectedRevision: 13 }
      : { kind: "send", body: CHOICE, replyChoice: true, expectedRevision: 12 });
    await expect.poll(() => endGap(page)).toBeLessThanOrEqual(2);
    expect(await windowY(page)).toBe(before);
    current = { ...current, revision: current.revision + 1, messages: [...current.messages,
      { id: "20000000-0000-4000-8000-0000000000d2", role: "explorer", body: send.body,
        createdAt: "2026-11-17T08:01:00.000Z" },
      { id: "30000000-0000-4000-8000-0000000000d2", role: "virtualGuide",
        body: "A synthetic answer after the selected response.", createdAt: "2026-11-17T08:01:01.000Z" },
    ] };
    await fulfill(waiting.send!, current);
    await expect(savedMessages(page).getByRole("listitem")).toHaveCount(20);
    await expect(item).toBeFocused();
    await expect.poll(() => endGap(page)).toBeLessThanOrEqual(2);
    expect(await windowY(page)).toBe(before);
    expect(requests).toHaveLength(kind === "waypoint" ? 2 : 1);
  });
}
