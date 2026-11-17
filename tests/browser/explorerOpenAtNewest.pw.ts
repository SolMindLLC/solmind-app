// Synthetic HTTP responses prove browser behavior only. The Executor runs this suite.
// Paul's test comment (PRJ01-SPR002 decision record 2026-11-11 21:03:09 CST): when the Explorer comes back to a
// conversation, it opens at its newest messages. No real person's words; nothing is sent.
import { expect, test, type Page, type Route } from "@playwright/test";

import { holdNextRequest } from "./compactHeaderHelpers";

import {
  EXPLORER_CONVERSATION_VERSION,
  type ExplorerConversationState,
} from "../../src/lib/solmind/explorerConversationContract";

test.use({ trace: "off", screenshot: "off", video: "off" });

const CONVERSATION = "10000000-0000-4000-8000-0000000000a1";
const id = (role: "explorer" | "virtualGuide", index: number) =>
  `${role === "explorer" ? "2" : "3"}0000000-0000-4000-8000-0000000000${String(index).padStart(2, "0")}`;

// A long saved conversation: twenty exchanges, each line long enough to wrap on a narrow screen.
function longState(pairs = 20): ExplorerConversationState {
  const messages: ExplorerConversationState["messages"][number][] = [];
  for (let index = 1; index <= pairs; index += 1) {
    const minute = String(index).padStart(2, "0");
    messages.push({ id: id("explorer", index), role: "explorer",
      body: `A synthetic test message number ${index}: some invented words about an ordinary day, long enough to wrap onto a second line.`,
      createdAt: `2026-11-05T08:${minute}:00.000Z` });
    messages.push({ id: id("virtualGuide", index), role: "virtualGuide",
      body: `A synthetic saved reply number ${index}: an invented reflection of a few sentences. It is here only to fill the saved conversation. It asks nothing.`,
      createdAt: `2026-11-05T08:${minute}:30.000Z` });
  }
  return {
    waypointCapacity: { activeCount: 0, activeLimit: 20, historyRoom: true, conversationRoom: true },
    waypointProjection: { kind: "current_heads" as const, limit: 20 as const, totalHeads: 0, hasMore: false },
    version: EXPLORER_CONVERSATION_VERSION,
    conversationId: CONVERSATION,
    revision: 1 + pairs * 2,
    pendingTurn: false,
    turnedDownLimitReached: false,
    providerState: "available",
    compassSuggestionReplies: "available",
    messages,
    compassItems: [],
    priorityId: null,
    attentionId: null,
    waypoints: [],
    waypointDraft: null,
    route: [],
    sessionStatus: "active",
    ending: null,
  } as ExplorerConversationState;
}

const success = (state: ExplorerConversationState) => ({
  version: "explorer-private-conversation-response.v1", result: { ok: true, state, error: null }, assistance: null,
});
const fulfill = (route: Route, value: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
const savedList = (page: Page) => page.getByRole("list", { name: "Saved conversation", exact: true });
const transcriptBox = (page: Page) => page.getByRole("log", { name: "Conversation transcript", exact: true });
const composer = (page: Page) => page.getByLabel("Continue the conversation", { exact: true });

async function openPage(page: Page, state: ExplorerConversationState) {
  const commands: string[] = [];
  await page.route("**/explorer/conversation/commands", route => { commands.push(route.request().url()); return route.abort(); });
  await page.route("**/explorer/conversation/state", route => fulfill(route, success(state)));
  await page.goto("/explorer/conversation");
  await expect(savedList(page)).toBeVisible();
  return commands;
}

test("a long saved conversation opens at its newest messages, with the message box in view", async ({ page }) => {
  const commands = await openPage(page, longState());
  const last = savedList(page).getByRole("listitem").last();
  await expect(last).toContainText("A synthetic saved reply number 20");

  // The transcript box itself is scrolled to its end.
  await expect.poll(async () => transcriptBox(page).evaluate(box => Math.round(box.scrollHeight - box.clientHeight - box.scrollTop))).toBeLessThanOrEqual(2);
  // The newest message, the message box and Send are inside the window, without the Explorer scrolling the page.
  await expect(last).toBeInViewport({ ratio: 0.99 });
  await expect(composer(page)).toBeInViewport({ ratio: 0.99 });
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeInViewport({ ratio: 0.99 });
  // Opening moved the window only: keyboard focus is where the page puts it on every open, and nothing was sent.
  await expect(page.locator("h1#conversation-preview-heading")).toBeFocused();
  expect(commands).toEqual([]);
});

test("a short saved conversation also opens with its newest message and the message box in view", async ({ page }) => {
  const commands = await openPage(page, longState(1));
  const items = savedList(page).getByRole("listitem");
  await expect(items).toHaveCount(2);
  await expect(items.last()).toBeInViewport({ ratio: 0.99 });
  await expect(composer(page)).toBeInViewport({ ratio: 0.99 });
  await expect(page.locator("h1#conversation-preview-heading")).toBeFocused();
  expect(commands).toEqual([]);
});

test("a conversation with no saved message stays at the top of the page", async ({ page }) => {
  const state = { ...longState(1), conversationId: null, revision: 0, messages: [], sessionStatus: null } as ExplorerConversationState;
  await page.route("**/explorer/conversation/commands", route => route.abort());
  await page.route("**/explorer/conversation/state", route => fulfill(route, success(state)));
  await page.goto("/explorer/conversation");
  await expect(page.getByText("There are no saved messages yet.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(0);
});

test("a conversation that opens with a notice above it stays at the top, with the notice in view", async ({ page }) => {
  // The pause notice is written by the server; this body is an invented stand-in.
  const notice = "A synthetic pause notice for this test. It stands above the saved conversation.";
  await page.route("**/explorer/conversation/commands", route => route.abort());
  await page.route("**/explorer/conversation/state", route => fulfill(route, {
    ...success(longState()), assistance: { kind: "paused", body: notice, persisted: false },
  }));
  await page.goto("/explorer/conversation");
  await expect(savedList(page)).toBeVisible();
  await expect(page.getByText(notice, { exact: true })).toBeInViewport({ ratio: 0.99 });
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(0);
  // The transcript box itself still shows its newest messages.
  await expect.poll(async () => transcriptBox(page).evaluate(box => Math.round(box.scrollHeight - box.clientHeight - box.scrollTop))).toBeLessThanOrEqual(2);
});

test("a conversation with a pending turn opens at its end, with the pending notice in view", async ({ page }) => {
  await page.route("**/explorer/conversation/commands", route => route.abort());
  await page.route("**/explorer/conversation/state", route => fulfill(route, success({ ...longState(), pendingTurn: true })));
  await page.goto("/explorer/conversation");
  await expect(savedList(page)).toBeVisible();
  await expect(page.getByText("A saved message is still awaiting a confirmed result.", { exact: false })).toBeInViewport({ ratio: 0.99 });
  await expect(savedList(page).getByRole("listitem").last()).toBeInViewport({ ratio: 0.99 });
});

test("an ended conversation opens with its newest message and its read-only explanation in view", async ({ page }) => {
  await page.route("**/explorer/conversation/commands", route => route.abort());
  await page.route("**/explorer/conversation/state", route => fulfill(route, success({ ...longState(), sessionStatus: "ended", providerState: "unavailable" })));
  await page.goto("/explorer/conversation");
  await expect(savedList(page)).toBeVisible();
  await expect(savedList(page).getByRole("listitem").last()).toBeInViewport({ ratio: 0.99 });
  await expect(page.getByText("This saved conversation has ended. It is available for read-only review.", { exact: true })).toBeInViewport({ ratio: 0.99 });
  await expect(page.getByRole("link", { name: "Review ended conversations", exact: true })).toBeInViewport({ ratio: 0.99 });
});

// The Send button is pressed from inside the page, so that the test itself never scrolls the window.
const pressSend = (page: Page) => page.getByRole("button", { name: "Send", exact: true }).evaluate(button => (button as HTMLButtonElement).click());
const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
// Compact header step B (Paul's choice "A + B", decision record 2026-11-16): the transcript is sized to the window,
// so on a window with room the end of the conversation area (the message box, with 16 px under it) is already in
// view with the page at its top, and the once-only page move is not needed. On a small window the transcript is
// at its smallest height and the page moves as before. The desktop project has room; the narrow project has not.
const endFitsAtTop = (page: Page) => page.evaluate(() => {
  const ends = document.querySelectorAll("[data-conversation-end]");
  const end = ends[ends.length - 1];
  return end.getBoundingClientRect().bottom + window.scrollY + 16 <= document.documentElement.clientHeight + 1;
});
async function expectOpenedByRule(page: Page) {
  const fits = await endFitsAtTop(page);
  expect(fits).toBe(test.info().project.name === "desktop-chromium");
  if (fits) expect(await scrollY(page)).toBe(0);
  else expect(await scrollY(page)).toBeGreaterThan(0);
}

// Step B (GPT-6 Astra REV494 finding 1): on a window with room the end of the conversation area already fits, so
// a second page-open move would be skipped there and "the page did not move" would prove nothing. The three "page
// moves once" tests therefore shorten the window until that end is below it, hold the answer, and require the
// page to be exactly where it was while the answer is awaited and after it arrived.
async function shortenUntilEndIsBelow(page: Page, position = 0) {
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: size.width, height: 420 });
  await page.evaluate(to => window.scrollTo(0, to), position);
  const endBelow = await page.evaluate(() => {
    const ends = document.querySelectorAll("[data-conversation-end]");
    return ends[ends.length - 1].getBoundingClientRect().top > document.documentElement.clientHeight;
  });
  expect(endBelow).toBe(true);
  expect(await scrollY(page)).toBe(position);
  return size;
}

test("the page moves once: a first Send in a new conversation does not move it", async ({ page }) => {
  const empty = { ...longState(1), conversationId: null, revision: 0, messages: [], sessionStatus: null } as ExplorerConversationState;
  await page.route("**/explorer/conversation/commands", route => fulfill(route, success(longState(8))));
  await page.route("**/explorer/conversation/state", route => fulfill(route, success(empty)));
  await page.goto("/explorer/conversation");
  await expect(page.getByText("There are no saved messages yet.", { exact: true })).toBeVisible();
  await composer(page).fill("A synthetic first message for this test.");
  await shortenUntilEndIsBelow(page);
  expect(await scrollY(page)).toBe(0);
  const held = await holdNextRequest(page, "**/explorer/conversation/commands");
  await pressSend(page);
  await held.arrived;
  expect(await scrollY(page)).toBe(0);
  held.release();
  await expect(savedList(page).getByRole("listitem")).toHaveCount(16);
  expect(await scrollY(page)).toBe(0);
});

test("the page moves once: a later reply does not move it again, and opening the page again does", async ({ page }) => {
  await page.route("**/explorer/conversation/commands", route => fulfill(route, success(longState(21))));
  await page.route("**/explorer/conversation/state", route => fulfill(route, success(longState())));
  await page.goto("/explorer/conversation");
  await expect(savedList(page).getByRole("listitem")).toHaveCount(40);
  await expect(composer(page)).toBeInViewport({ ratio: 0.99 });
  // Step B: the page moved on open only where the message box did not fit with the page at its top.
  await expectOpenedByRule(page);
  await composer(page).fill("A synthetic later message for this test.");
  const size = await shortenUntilEndIsBelow(page);
  const held = await holdNextRequest(page, "**/explorer/conversation/commands");
  await pressSend(page);
  await held.arrived;
  expect(await scrollY(page)).toBe(0);
  held.release();
  await expect(savedList(page).getByRole("listitem")).toHaveCount(42);
  expect(await scrollY(page)).toBe(0);
  // The project's own window again, before the page is opened a second time.
  await page.setViewportSize(size);
  await page.reload();
  await expect(savedList(page).getByRole("listitem")).toHaveCount(40);
  await expect(composer(page)).toBeInViewport({ ratio: 0.99 });
  await expectOpenedByRule(page);
});

test("a pending turn together with a notice above opens with both notices in view, not at the newest messages", async ({ page }) => {
  const notice = "A synthetic pause notice for this test. It stands above the saved conversation.";
  await page.route("**/explorer/conversation/commands", route => route.abort());
  await page.route("**/explorer/conversation/state", route => fulfill(route, {
    ...success({ ...longState(), pendingTurn: true }), assistance: { kind: "paused", body: notice, persisted: false },
  }));
  await page.goto("/explorer/conversation");
  await expect(savedList(page)).toBeVisible();
  await expect(page.getByText(notice, { exact: true })).toBeInViewport({ ratio: 0.99 });
  const pending = page.getByText("A saved message is still awaiting a confirmed result.", { exact: false });
  await expect(pending).toHaveCount(1);
  await expect(pending).toBeInViewport({ ratio: 0.99 });
  // The pending notice stands above the transcript, and the page did not go to the message box.
  expect(await pending.evaluate(node => Boolean(node.compareDocumentPosition(document.querySelector('[role="log"]')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  // Step B: on a window with room the message box can now be in view together with both notices, so "the
  // message box is not in the window" holds on the narrow project only. What the rule promises everywhere: the
  // strip and the notices are not pushed above the window, and where the pending notice already fitted the
  // page did not move at all.
  const stripTop = await page.locator("[data-conversation-strip]").evaluate(node => Math.round(node.getBoundingClientRect().top));
  expect(stripTop).toBeGreaterThanOrEqual(0);
  if (test.info().project.name === "desktop-chromium") expect(await scrollY(page)).toBe(0);
  else await expect(composer(page)).not.toBeInViewport();
});

test("the page moves once: Reload saved conversation does not move it again", async ({ page }) => {
  let reads = 0;
  await page.route("**/explorer/conversation/commands", route => route.abort());
  await page.route("**/explorer/conversation/state", route => { reads += 1; return fulfill(route, success(longState(reads === 1 ? 20 : 21))); });
  await page.goto("/explorer/conversation");
  await expect(savedList(page).getByRole("listitem")).toHaveCount(40);
  await expectOpenedByRule(page);
  // Step B: on the desktop project the page opens at its top, so "still at the top after Reload" would prove
  // nothing there. In a shortened window the page is put at a known position that is neither its top nor where
  // an open would land, and must be exactly there while the Reload is awaited and after it.
  await shortenUntilEndIsBelow(page, 60);
  const held = await holdNextRequest(page, "**/explorer/conversation/state");
  // Pressed from inside the page, so that the test itself never scrolls the window.
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).evaluate(button => (button as HTMLButtonElement).click());
  await held.arrived;
  expect(await scrollY(page)).toBe(60);
  held.release();
  await expect(savedList(page).getByRole("listitem")).toHaveCount(42);
  expect(await scrollY(page)).toBe(60);
});

test("on a short window with a long notice and a pending turn, the notice above keeps priority", async ({ page }) => {
  const notice = "A synthetic pause notice for this test. ".repeat(14).trim();
  await page.setViewportSize({ width: 390, height: 420 });
  await page.route("**/explorer/conversation/commands", route => route.abort());
  await page.route("**/explorer/conversation/state", route => fulfill(route, {
    ...success({ ...longState(), pendingTurn: true }), assistance: { kind: "paused", body: notice, persisted: false },
  }));
  await page.goto("/explorer/conversation");
  await expect(savedList(page)).toBeVisible();
  // The start of the notice is inside the window: the move toward the pending notice never passes it.
  const top = await page.getByText(notice, { exact: true }).evaluate(node => Math.round(node.getBoundingClientRect().top));
  expect(top).toBeGreaterThanOrEqual(0);
  expect(top).toBeLessThan(420);
  await expect(composer(page)).not.toBeInViewport();
});
