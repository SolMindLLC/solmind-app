// Synthetic HTTP responses prove browser behaviour only. The Executor runs this suite.
// The compact conversation header, step B (Paul's choice "A + B", PRJ01-SPR002 decision record 2026-11-16 17:53:42
// and 21:27:10 CST): the transcript is sized to the window and the messages scroll inside the chat panel. The
// approved proposal says "No scrolling to start chatting" is met at 1440 by 900 px only with step B, and only
// while the explanations are closed or one is open; it is not met at 390 by 844 px in any measured version.
// No real person's words.
import { expect, test, type Page, type Route } from "@playwright/test";

import {
  EXPLORER_CONVERSATION_VERSION,
  type ExplorerConversationState,
} from "../../src/lib/solmind/explorerConversationContract";
import {
  COMMANDS_URL,
  RELOAD_NEEDED,
  STATE_URL,
  UP_TO_DATE,
  privacyButton,
  privacyExplanation,
  reloadAndExpect,
  reloadHelpButton,
  reloadHelpLine,
  savedStatus,
} from "./compactHeaderHelpers";
import { expectNoSidewaysScroll } from "./conversationPreviewHelpers";

test.use({ trace: "off", screenshot: "off", video: "off" });

const SMALLEST = 224;
const LARGEST = 832;
const GAP = 16;
const CONVERSATION = "10000000-0000-4000-8000-0000000000d1";
const id = (role: "explorer" | "virtualGuide", index: number) =>
  `${role === "explorer" ? "2" : "3"}0000000-0000-4000-8000-0000000000${String(index).padStart(2, "0")}`;
function savedState(pairs = 20, overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  const messages: ExplorerConversationState["messages"][number][] = [];
  for (let index = 1; index <= pairs; index += 1) {
    const minute = String(index).padStart(2, "0");
    messages.push({ id: id("explorer", index), role: "explorer",
      body: `A synthetic test message number ${index}: some invented words about an ordinary day, long enough to wrap onto a second line.`,
      createdAt: `2026-11-17T08:${minute}:00.000Z` });
    messages.push({ id: id("virtualGuide", index), role: "virtualGuide",
      body: `A synthetic saved reply number ${index}: an invented reflection of a few sentences. It asks nothing.`,
      createdAt: `2026-11-17T08:${minute}:30.000Z` });
  }
  return {
    waypointCapacity: { activeCount: 0, activeLimit: 20, historyRoom: true, conversationRoom: true },
    waypointProjection: { kind: "current_heads" as const, limit: 20 as const, totalHeads: 0, hasMore: false },
    version: EXPLORER_CONVERSATION_VERSION, conversationId: CONVERSATION, revision: 1 + pairs * 2, pendingTurn: false,
    turnedDownLimitReached: false, providerState: "available", compassSuggestionReplies: "available", messages,
    compassItems: [], priorityId: null, attentionId: null, waypoints: [], waypointDraft: null, route: [],
    sessionStatus: "active", ending: null, ...overrides,
  } as ExplorerConversationState;
}
const newState = () => ({ ...savedState(0), conversationId: null, revision: 0, sessionStatus: null }) as ExplorerConversationState;
type Assistance = { kind: "support" | "paused"; body: string; persisted: false };
const success = (state: ExplorerConversationState, assistance: Assistance | null = null) => ({
  version: "explorer-private-conversation-response.v1", result: { ok: true, state, error: null }, assistance,
});
const fulfill = (route: Route, value: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(value) });

const transcript = (page: Page) => page.getByRole("log", { name: "Conversation transcript", exact: true });
const savedList = (page: Page) => page.getByRole("list", { name: "Saved conversation", exact: true });
const composer = (page: Page) => page.getByLabel("Continue the conversation", { exact: true });
const sendButton = (page: Page) => page.getByRole("button", { name: "Send", exact: true });
const title = (page: Page) => page.locator("h1#conversation-preview-heading");
const isDesktop = () => test.info().project.name === "desktop-chromium";

type Measure = { height: number; rule: number; available: number; windowHeight: number; scrollY: number; pageRange: number;
  endBottom: number; scrollTop: number; scrollRange: number; composerBottom: number | null; sendBottom: number | null };
// The transcript as built, and what the sizing rule gives for the page as it is now:
// height = Math.min(832, Math.max(224, windowHeight - 16 - top - below)).
const measure = (page: Page): Promise<Measure> => page.evaluate(([smallest, largest, gap]) => {
  const box = document.querySelector('[role="log"]') as HTMLElement;
  const ends = document.querySelectorAll("[data-conversation-end]");
  const end = ends[ends.length - 1];
  const place = box.getBoundingClientRect();
  const root = document.documentElement;
  const available = root.clientHeight - gap - (place.top + window.scrollY) - (end.getBoundingClientRect().bottom - place.bottom);
  const bar = document.querySelector("[data-composer-bar]");
  const send = bar === null ? null : bar.querySelector('button[type="submit"]');
  return {
    height: place.height, rule: Math.min(largest, Math.max(smallest, Math.round(available))), available,
    windowHeight: root.clientHeight, scrollY: Math.round(window.scrollY), pageRange: Math.round(root.scrollHeight - root.clientHeight),
    endBottom: end.getBoundingClientRect().bottom + window.scrollY, scrollTop: Math.round(box.scrollTop),
    scrollRange: Math.round(box.scrollHeight - box.clientHeight),
    composerBottom: bar === null ? null : bar.getBoundingClientRect().bottom + window.scrollY,
    sendBottom: send === null ? null : send.getBoundingClientRect().bottom + window.scrollY,
  };
}, [SMALLEST, LARGEST, GAP]);
// The built height equals the rule within one pixel (polled: an observer write lands one frame later).
async function expectRule(page: Page, moment: string): Promise<Measure> {
  await expect.poll(async () => { const now = await measure(page); return Math.abs(now.height - now.rule); }, { message: moment }).toBeLessThanOrEqual(1);
  const now = await measure(page);
  expect(now.height, moment).toBeGreaterThanOrEqual(SMALLEST - 1);
  expect(now.height, moment).toBeLessThanOrEqual(LARGEST + 1);
  return now;
}

type Answers = { read: () => unknown; command?: (route: Route) => Promise<void> | void };
// Opens the page; page errors and console errors (a "ResizeObserver loop" among them) fail the test at its end.
async function openPage(page: Page, answers: Answers) {
  const problems: string[] = [];
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`));
  page.on("console", message => { if (message.type() === "error") problems.push(`console: ${message.text()}`); });
  await page.route(COMMANDS_URL, route => (answers.command ? answers.command(route) : route.abort()));
  await page.route(STATE_URL, route => fulfill(route, answers.read()));
  await page.goto("/explorer/conversation");
  await expect(transcript(page)).toBeVisible();
  await expect(savedStatus(page)).not.toHaveText("Loading your saved conversation...");
  return problems;
}

for (const kind of ["new", "saved"] as const) {
  test(`at 1440 by 900 a ${kind} conversation opens with the whole message box and Send in view, without scrolling`, async ({ page }) => {
    test.skip(!isDesktop(), "sized inside the test; one project is enough");
    await page.setViewportSize({ width: 1440, height: 900 });
    const problems = await openPage(page, { read: () => success(kind === "new" ? newState() : savedState()) });
    const now = await expectRule(page, "after open");
    test.info().annotations.push({ type: "measured at 1440 by 900", description: JSON.stringify(now) });
    // There is room: the transcript is between its limits and the page stays at its top.
    expect(now.height).toBeGreaterThan(SMALLEST);
    expect(now.height).toBeLessThan(LARGEST);
    expect(now.scrollY).toBe(0);
    // The message box area ends 16 px above the end of the window, and Send with it.
    expect(Math.abs(now.endBottom - (now.windowHeight - GAP))).toBeLessThanOrEqual(1);
    expect(now.sendBottom!).toBeLessThanOrEqual(now.windowHeight);
    await expect(composer(page)).toBeInViewport({ ratio: 0.99 });
    await expect(sendButton(page)).toBeInViewport({ ratio: 0.99 });
    await expect(page.locator("[data-chat-panel-band]")).toBeInViewport({ ratio: 0.99 });
    if (kind === "saved") {
      // The messages scroll inside the panel: the transcript is at its newest end and the newest reply is in view.
      expect(now.scrollRange).toBeGreaterThan(0);
      expect(now.scrollRange - now.scrollTop).toBeLessThanOrEqual(2);
      await expect(savedList(page).getByRole("listitem").last()).toBeInViewport({ ratio: 0.99 });
    }
    await expectNoSidewaysScroll(page);
    expect(problems).toEqual([]);
  });
}

test("a new conversation opens at the top of its transcript with the start marker and the welcome in view; the first Send goes to the end", async ({ page }) => {
  let current = newState();
  const problems = await openPage(page, {
    read: () => success(current),
    command: route => { current = savedState(8); return fulfill(route, success(current)); },
  });
  await expect(page.getByText("There are no saved messages yet.", { exact: true })).toBeVisible();
  const opened = await expectRule(page, "after open");
  // An empty conversation never moves the page, and its transcript stays at position zero.
  expect(opened.scrollY).toBe(0);
  expect(opened.scrollTop).toBe(0);
  const inside = await page.evaluate(() => {
    const box = document.querySelector('[role="log"]')!.getBoundingClientRect();
    const mark = document.querySelector("[data-conversation-start]")!.getBoundingClientRect();
    const welcome = document.querySelector("[data-opening-greeting]")!.getBoundingClientRect();
    return { marker: mark.top >= box.top && mark.bottom <= box.bottom, welcomeTop: welcome.top >= box.top && welcome.top < box.bottom };
  });
  expect(inside).toEqual({ marker: true, welcomeTop: true });
  await expect(page.locator("[data-conversation-start]")).toBeInViewport({ ratio: 0.99 });
  // The whole first content is there, reachable inside the transcript.
  for (const text of ["Show me around", "There are no saved messages yet.", "Ways to begin"]) {
    await expect(transcript(page).getByText(text, { exact: true })).toHaveCount(1);
  }
  // Desktop: the message box is in view at once. Narrow: it is reached by scrolling the page.
  if (isDesktop()) await expect(sendButton(page)).toBeInViewport({ ratio: 0.99 });
  else expect(opened.height).toBeLessThanOrEqual(SMALLEST + 1);
  // The first Send: the transcript goes to its newest end; the page does not move.
  await composer(page).fill("A synthetic first message for this test.");
  await page.evaluate(() => window.scrollTo(0, 0));
  await sendButton(page).evaluate(button => (button as HTMLButtonElement).click());
  await expect(savedList(page).getByRole("listitem")).toHaveCount(16);
  const sent = await expectRule(page, "after the first Send");
  expect(sent.scrollRange - sent.scrollTop).toBeLessThanOrEqual(2);
  expect(sent.scrollY).toBe(0);
  expect(problems).toEqual([]);
});

test("on a 390 by 844 phone the transcript is at its smallest height, a saved conversation opens with the message box in view, and the remaining scrolling is measured", async ({ page }) => {
  test.skip(isDesktop(), "the narrow project is the phone");
  let read: () => unknown = () => success(savedState());
  const problems = await openPage(page, { read: () => read() });
  const saved = await expectRule(page, "saved conversation");
  expect(Math.abs(saved.height - SMALLEST)).toBeLessThanOrEqual(1);
  // The once-only page move brought the end of the conversation into the window.
  expect(saved.scrollY).toBeGreaterThan(0);
  await expect(composer(page)).toBeInViewport({ ratio: 0.99 });
  await expect(sendButton(page)).toBeInViewport({ ratio: 0.99 });
  await expect(savedList(page).getByRole("listitem").last()).toBeInViewport();
  expect(saved.scrollRange - saved.scrollTop).toBeLessThanOrEqual(2);
  await expectNoSidewaysScroll(page);
  // A new conversation stays at the top of the page. Paul accepted that some scrolling remains on a phone:
  // how much is needed to bring the whole message box area and Send into view is recorded, and it is less than
  // it was before step B, when the transcript was at least 512 px tall (288 px more than now).
  read = () => success(newState());
  await page.reload();
  await expect(page.getByText("There are no saved messages yet.", { exact: true })).toBeVisible();
  const fresh = await expectRule(page, "new conversation");
  expect(fresh.scrollY).toBe(0);
  expect(Math.abs(fresh.height - SMALLEST)).toBeLessThanOrEqual(1);
  const remaining = { messageBox: Math.max(0, Math.round(fresh.composerBottom! - fresh.windowHeight)), send: Math.max(0, Math.round(fresh.sendBottom! - fresh.windowHeight)) };
  test.info().annotations.push({ type: "scrolling left on a 390 by 844 phone, new conversation (px)", description: JSON.stringify({ ...remaining, measure: fresh }) });
  expect(remaining.messageBox).toBeGreaterThan(0);
  // The page can scroll that far, so the message box is reachable.
  expect(fresh.pageRange).toBeGreaterThanOrEqual(remaining.messageBox);
  await page.evaluate(distance => window.scrollTo(0, distance), remaining.messageBox + GAP);
  await expect(composer(page)).toBeInViewport({ ratio: 0.99 });
  await expect(sendButton(page)).toBeInViewport({ ratio: 0.99 });
  expect(problems).toEqual([]);
});

test("the three kinds of open: empty stays at the top; saved follows the fit; a notice above keeps priority", async ({ page }) => {
  let read: () => unknown = () => success(newState());
  const problems = await openPage(page, { read: () => read() });
  // Empty: no move.
  expect((await expectRule(page, "empty")).scrollY).toBe(0);
  // Saved, no notice: the page is at its top exactly when the end of the conversation fitted there.
  read = () => success(savedState());
  await page.reload();
  await expect(savedList(page)).toBeVisible();
  const saved = await expectRule(page, "saved");
  const fitsAtTop = saved.endBottom + GAP <= saved.windowHeight + 1;
  expect(fitsAtTop).toBe(isDesktop());
  if (fitsAtTop) expect(saved.scrollY).toBe(0);
  else {
    expect(saved.scrollY).toBeGreaterThan(0);
    // It landed with the end of the conversation area 16 px above the end of the window.
    expect(Math.abs(saved.endBottom - saved.scrollY - (saved.windowHeight - GAP))).toBeLessThanOrEqual(2);
  }
  await expect(composer(page)).toBeInViewport({ ratio: 0.99 });
  // A pause notice with a pending result: both notices in view; the strip is not pushed above the window.
  const notice = "A synthetic pause notice for this test. It stands above the saved conversation.";
  read = () => success(savedState(20, { pendingTurn: true }), { kind: "paused", body: notice, persisted: false });
  await page.reload();
  await expect(savedList(page)).toBeVisible();
  const noticed = await expectRule(page, "notice above");
  await expect(page.getByText(notice, { exact: true })).toBeInViewport({ ratio: 0.99 });
  const pending = page.getByText("A saved message is still awaiting a confirmed result.", { exact: false });
  await expect(pending).toHaveCount(1);
  await expect(pending).toBeInViewport({ ratio: 0.99 });
  const stripTop = await page.locator("[data-conversation-strip]").evaluate(node => Math.round(node.getBoundingClientRect().top));
  expect(stripTop).toBeGreaterThanOrEqual(0);
  if (isDesktop()) expect(noticed.scrollY).toBe(0);
  expect(await savedStatus(page).textContent()).toBe(RELOAD_NEEDED);
  expect(problems).toEqual([]);
});

test("an ended conversation opens with its newest message, its read-only explanation and the review link in view", async ({ page }) => {
  const problems = await openPage(page, { read: () => success(savedState(20, { sessionStatus: "ended", providerState: "unavailable" })) });
  const now = await expectRule(page, "ended");
  if (isDesktop()) expect(now.scrollY).toBe(0);
  await expect(savedList(page).getByRole("listitem").last()).toBeInViewport();
  await expect(page.getByText("This saved conversation has ended. It is available for read-only review.", { exact: true })).toBeInViewport({ ratio: 0.99 });
  await expect(page.getByRole("link", { name: "Review ended conversations", exact: true })).toBeInViewport({ ratio: 0.99 });
  await expect(composer(page)).toHaveCount(0);
  expect(problems).toEqual([]);
});

test("the rule holds after explanations open and close, a reason line and an alert arrive, the panel is hidden, the window is resized and the message box grows", async ({ page }) => {
  let current = savedState();
  const problems = await openPage(page, {
    read: () => success(current),
    command: route => {
      current = savedState(21);
      return fulfill(route, success(current, { kind: "support", body: "A synthetic support notice for this test. ".repeat(4).trim(), persisted: false }));
    },
  });
  const start = await expectRule(page, "after open");
  // Each explanation, opened and closed.
  await privacyButton(page).click();
  await expect(privacyExplanation(page)).toBeVisible();
  const withPrivacy = await expectRule(page, "Privacy and sharing open");
  if (isDesktop()) expect(withPrivacy.height).toBeLessThan(start.height);
  await reloadHelpButton(page).click();
  await expect(reloadHelpLine(page)).toBeVisible();
  await expectRule(page, "? text open");
  await reloadHelpButton(page).click();
  const closed = await expectRule(page, "both closed");
  expect(Math.abs(closed.height - start.height)).toBeLessThanOrEqual(1);
  // An alert arrives with a confirmed Send.
  await composer(page).fill("A synthetic message for this test.");
  await sendButton(page).click();
  await expect(page.getByRole("main").getByRole("alert").first()).toContainText("A synthetic support notice for this test.");
  const withAlert = await expectRule(page, "support alert shown");
  if (isDesktop()) expect(withAlert.height).toBeLessThan(start.height);
  // A reason line arrives: the Reload returns a pending result (and the alert goes).
  current = savedState(21, { pendingTurn: true });
  await reloadAndExpect(page, RELOAD_NEEDED);
  await expect(reloadHelpLine(page)).toBeVisible();
  await expectRule(page, "yellow reason line shown");
  current = savedState(21);
  await reloadAndExpect(page, UP_TO_DATE);
  await expectRule(page, "settled again");
  // The Compass panel hidden and shown (wide screens): the card gets wider, the strip shorter.
  if (isDesktop()) {
    const toggle = page.locator("#conversation-preview-panel-toggle");
    await toggle.click();
    await expect(page.locator("#conversation-preview-panel")).toBeHidden();
    await expectRule(page, "panel hidden");
    await toggle.click();
    await expect(page.locator("#conversation-preview-panel")).toBeVisible();
    await expectRule(page, "panel shown");
  }
  // The window resized, taller and shorter and narrower.
  const size = page.viewportSize()!;
  for (const [width, height] of [[size.width, size.height + 160], [size.width, size.height - 220], [Math.max(320, size.width - 200), size.height], [size.width, size.height]] as const) {
    await page.setViewportSize({ width, height });
    await expectRule(page, `window ${width} by ${height}`);
    await expectNoSidewaysScroll(page);
  }
  // The message box made taller without any render (as when the Explorer drags its corner).
  const before = await measure(page);
  await composer(page).evaluate(field => { (field as HTMLTextAreaElement).style.height = `${(field as HTMLTextAreaElement).offsetHeight + 90}px`; });
  const grown = await expectRule(page, "message box taller");
  if (before.height > SMALLEST + 90) expect(Math.abs(before.height - grown.height - 90)).toBeLessThanOrEqual(2);
  await composer(page).evaluate(field => { (field as HTMLTextAreaElement).style.height = ""; });
  await expectRule(page, "message box back");
  expect(problems).toEqual([]);
});

test("scrolling the page does not change the transcript's height, and the band stays above the scrolling messages", async ({ page }) => {
  const problems = await openPage(page, { read: () => success(savedState()) });
  const start = await expectRule(page, "after open");
  expect(start.pageRange).toBeGreaterThan(0);
  for (const position of [0, Math.min(80, start.pageRange), start.pageRange]) {
    await page.evaluate(to => window.scrollTo(0, to), position);
    const now = await expectRule(page, `page at ${position}`);
    expect(Math.abs(now.height - start.height)).toBeLessThanOrEqual(1);
    expect(now.scrollTop).toBe(start.scrollTop);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  // The band is outside the scrolling area: it does not move when the messages scroll, and at the oldest end the
  // start marker is under it, not covered by it.
  const band = page.locator("[data-chat-panel-band]");
  const bandBox = (await band.boundingBox())!;
  await transcript(page).evaluate(box => { box.scrollTop = 0; });
  expect((await band.boundingBox())!.y).toBe(bandBox.y);
  const markerBox = (await page.locator("[data-conversation-start]").boundingBox())!;
  expect(markerBox.y).toBeGreaterThanOrEqual(bandBox.y + bandBox.height);
  await transcript(page).evaluate(box => { box.scrollTop = box.scrollHeight; });
  expect((await band.boundingBox())!.y).toBe(bandBox.y);
  expect(problems).toEqual([]);
});

test("opening and closing an explanation keeps the reading position, and at the newest end the browser only brings it back inside what is left", async ({ page }) => {
  const problems = await openPage(page, { read: () => success(savedState()) });
  await page.evaluate(() => window.scrollTo(0, 0));
  const start = await expectRule(page, "after open");
  expect(start.scrollRange - start.scrollTop).toBeLessThanOrEqual(2);
  // From the middle of the history: the offset is exactly kept through open and close.
  const middle = Math.round(start.scrollRange / 2);
  await transcript(page).evaluate((box, to) => { box.scrollTop = to; }, middle);
  await privacyButton(page).evaluate(button => (button as HTMLButtonElement).click());
  await expect(privacyExplanation(page)).toBeVisible();
  const opened = await expectRule(page, "open, from the middle");
  expect(opened.scrollTop).toBe(middle);
  await privacyButton(page).evaluate(button => (button as HTMLButtonElement).click());
  await expect(privacyExplanation(page)).toBeHidden();
  expect((await expectRule(page, "closed, from the middle")).scrollTop).toBe(middle);
  // At the newest end with the explanation open (the transcript is then shorter, so there is more to scroll):
  // closing makes the transcript taller, and the offset may only come back to the new largest offset.
  await privacyButton(page).evaluate(button => (button as HTMLButtonElement).click());
  await expect(privacyExplanation(page)).toBeVisible();
  await expectRule(page, "open");
  await transcript(page).evaluate(box => { box.scrollTop = box.scrollHeight; });
  const atEnd = await measure(page);
  expect(atEnd.scrollRange - atEnd.scrollTop).toBeLessThanOrEqual(1);
  await privacyButton(page).evaluate(button => (button as HTMLButtonElement).click());
  await expect(privacyExplanation(page)).toBeHidden();
  const after = await expectRule(page, "closed, from the end");
  expect(Math.abs(after.scrollTop - Math.min(atEnd.scrollTop, after.scrollRange))).toBeLessThanOrEqual(1);
  if (isDesktop()) expect(after.scrollRange).toBeLessThan(atEnd.scrollRange);
  // The page itself was at its top throughout and stays there.
  expect(after.scrollY).toBe(0);
  expect(problems).toEqual([]);
});

test("a long conversation scrolls inside the panel: a Send, its reply and a Reload do not move the page", async ({ page }) => {
  let current = savedState();
  const problems = await openPage(page, {
    read: () => success(current),
    command: route => { current = savedState(21); return fulfill(route, success(current)); },
  });
  await expectRule(page, "after open");
  await composer(page).fill("A synthetic later message for this test.");
  const position = Math.min(60, (await measure(page)).pageRange);
  await page.evaluate(to => window.scrollTo(0, to), position);
  await sendButton(page).evaluate(button => (button as HTMLButtonElement).click());
  await expect(savedList(page).getByRole("listitem")).toHaveCount(42);
  const sent = await expectRule(page, "after the reply");
  expect(sent.scrollY).toBe(position);
  expect(sent.scrollRange - sent.scrollTop).toBeLessThanOrEqual(2);
  current = savedState(22);
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).evaluate(button => (button as HTMLButtonElement).click());
  await expect(savedList(page).getByRole("listitem")).toHaveCount(44);
  const reloaded = await expectRule(page, "after Reload");
  expect(reloaded.scrollY).toBe(position);
  expect(reloaded.scrollRange - reloaded.scrollTop).toBeLessThanOrEqual(2);
  expect(problems).toEqual([]);
});

test("the transcript stays a named, focusable scroll region that the keyboard can scroll", async ({ page }) => {
  const problems = await openPage(page, { read: () => success(savedState()) });
  await expectRule(page, "after open");
  const log = transcript(page);
  await expect(log).toHaveAttribute("tabindex", "0");
  await expect(log).toHaveAttribute("aria-label", "Conversation transcript");
  await expect(log).toHaveCSS("overflow-y", "auto");
  // Tab from the title reaches it; the focus ring shows; the keyboard scrolls it without moving the page.
  await title(page).focus();
  await page.keyboard.press("Tab");
  await expect(log).toBeFocused();
  await expect(log).toHaveCSS("outline-width", "2px");
  const before = await measure(page);
  await page.keyboard.press("Home");
  await expect.poll(async () => (await measure(page)).scrollTop).toBe(0);
  await page.keyboard.press("End");
  await expect.poll(async () => { const now = await measure(page); return now.scrollRange - now.scrollTop; }).toBeLessThanOrEqual(2);
  await page.keyboard.press("PageUp");
  await expect.poll(async () => (await measure(page)).scrollTop).toBeLessThan(before.scrollRange);
  expect((await measure(page)).scrollY).toBe(before.scrollY);
  // The next Tab stop is inside the conversation area (the message box or a control in a message), not lost.
  await page.keyboard.press("End");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement !== null && document.activeElement !== document.body
    && document.querySelector("[data-chat-panel]")!.contains(document.activeElement))).toBe(true);
  expect(problems).toEqual([]);
});

// The height has settled: over the next frames nothing writes the transcript's height again and it stays the same
// (an oscillation between two heights would not raise a "ResizeObserver loop" error, so it is looked for directly).
async function expectSettled(page: Page, moment: string) {
  const seen = await page.evaluate(() => new Promise<{ writes: number; heights: number[] }>(resolve => {
    const box = document.querySelector('[role="log"]') as HTMLElement;
    let writes = 0;
    const watcher = new MutationObserver(records => { writes += records.length; });
    watcher.observe(box, { attributes: true, attributeFilter: ["style"] });
    const heights: number[] = [];
    const step = () => {
      heights.push(box.getBoundingClientRect().height);
      if (heights.length < 8) requestAnimationFrame(step);
      else { watcher.disconnect(); resolve({ writes, heights }); }
    };
    requestAnimationFrame(step);
  }));
  expect(seen.writes, `${moment}: ${JSON.stringify(seen)}`).toBe(0);
  expect(new Set(seen.heights).size, `${moment}: ${JSON.stringify(seen)}`).toBe(1);
}
// A change made a little later from inside the page, with no render of the screen (as a late font or image does):
// the element's padding grows by the stated number of pixels, whatever padding it had.
const later = (page: Page, selector: string, property: "paddingTop" | "paddingBottom", add: number) =>
  page.evaluate(([target, name, more]) => {
    window.setTimeout(() => {
      const element = document.querySelector(target as string) as HTMLElement;
      const now = Number.parseFloat(getComputedStyle(element)[name as "paddingTop"]) || 0;
      element.style[name as "paddingTop"] = `${now + (more as number)}px`;
    }, 150);
  }, [selector, property, add] as const);
const laterMinHeight = (page: Page, selector: string, value: string) =>
  page.evaluate(([target, to]) => {
    window.setTimeout(() => { (document.querySelector(target) as HTMLElement).style.minHeight = to; }, 150);
  }, [selector, value] as const);

test("height changes that arrive late and without a render, above the transcript and in the side panel, are followed and then settle", async ({ page }) => {
  const problems = await openPage(page, { read: () => success(savedState()) });
  await page.evaluate(() => window.scrollTo(0, 0));
  const start = await expectRule(page, "after open");
  await expectSettled(page, "after open");
  // The Explorer is reading in the middle of the history, with keyboard focus on the transcript.
  const middle = Math.round(start.scrollRange / 2);
  await transcript(page).evaluate((box, to) => { box.scrollTop = to; }, middle);
  await transcript(page).focus();
  // The top bar becomes 48 px taller: everything under it moves down, the page body may keep its size.
  await later(page, "header", "paddingBottom", 48);
  await expect.poll(async () => (await measure(page)).available).toBeLessThanOrEqual(start.available - 47);
  const lower = await expectRule(page, "top bar taller");
  await expectSettled(page, "top bar taller");
  if (start.height >= SMALLEST + 48) expect(Math.abs(start.height - lower.height - 48)).toBeLessThanOrEqual(1);
  expect(lower.scrollTop).toBe(Math.min(middle, lower.scrollRange));
  await expect(transcript(page)).toBeFocused();
  expect(lower.scrollY).toBe(0);
  // The strip becomes 30 px taller.
  await later(page, "[data-conversation-strip]", "paddingTop", 30);
  await expect.poll(async () => (await measure(page)).available).toBeLessThan(lower.available - 20);
  const lowest = await expectRule(page, "strip taller");
  await expectSettled(page, "strip taller");
  expect(lowest.scrollTop).toBe(Math.min(middle, lowest.scrollRange));
  await expect(transcript(page)).toBeFocused();
  // The side panel becomes much taller (wide screens): the transcript's place does not change, so neither does
  // its height, whether or not the page body grew.
  if (isDesktop()) {
    const panelHeight = await page.locator("#conversation-preview-panel").evaluate(node => Math.round(node.getBoundingClientRect().height));
    await laterMinHeight(page, "#conversation-preview-panel", `${panelHeight + 400}px`);
    await expect.poll(async () => page.locator("#conversation-preview-panel").evaluate(node => Math.round(node.getBoundingClientRect().height))).toBeGreaterThanOrEqual(panelHeight + 399);
    const beside = await expectRule(page, "side panel taller");
    await expectSettled(page, "side panel taller");
    expect(Math.abs(beside.height - lowest.height)).toBeLessThanOrEqual(1);
    expect(beside.scrollTop).toBe(lowest.scrollTop);
  }
  // Back to where it was: the transcript returns to its first height.
  await page.evaluate(() => {
    for (const selector of ["header", "[data-conversation-strip]", "#conversation-preview-panel"]) {
      const element = document.querySelector(selector) as HTMLElement | null;
      if (element !== null) { element.style.paddingTop = ""; element.style.paddingBottom = ""; element.style.minHeight = ""; }
    }
  });
  await expect.poll(async () => Math.abs((await measure(page)).available - start.available)).toBeLessThanOrEqual(1);
  const back = await expectRule(page, "restored");
  await expectSettled(page, "restored");
  expect(Math.abs(back.height - start.height)).toBeLessThanOrEqual(1);
  expect(problems).toEqual([]);
});

test("a late height change in an ended conversation's explanation is followed and then settles", async ({ page }) => {
  const problems = await openPage(page, { read: () => success(savedState(20, { sessionStatus: "ended", providerState: "unavailable" })) });
  await page.evaluate(() => window.scrollTo(0, 0));
  const start = await expectRule(page, "after open");
  await expectSettled(page, "after open");
  await later(page, 'section[aria-label="End Session"]', "paddingBottom", 60);
  await expect.poll(async () => (await measure(page)).available).toBeLessThanOrEqual(start.available - 55);
  const after = await expectRule(page, "explanation taller");
  await expectSettled(page, "explanation taller");
  if (start.height >= SMALLEST + 60) expect(start.height - after.height).toBeGreaterThanOrEqual(55);
  // At its newest end before; the offset is inside what is left.
  expect(after.scrollTop).toBeLessThanOrEqual(after.scrollRange);
  expect(after.scrollTop).toBe(Math.min(start.scrollTop, after.scrollRange));
  expect(problems).toEqual([]);
});

// GPT-6 Astra REV494b finding 1: the side panel is made the tallest thing in the page first, so the page body
// keeps its height whatever happens in the conversation card, and only the sizer's own observation of the parts
// around the transcript can notice a late change. A padding change alters an element's border box, not its
// content box.
async function letTheSidePanelHoldThePageHeight(page: Page) {
  await page.locator("#conversation-preview-panel").evaluate(node => { (node as HTMLElement).style.minHeight = "3200px"; });
  await expect.poll(async () => page.evaluate(() => Math.round(document.body.getBoundingClientRect().height))).toBeGreaterThanOrEqual(3200);
  return () => page.evaluate(() => ({ body: document.body.getBoundingClientRect().height, document: document.documentElement.scrollHeight }));
}

test("with the side panel holding the page's height, a title band that becomes taller late is followed: the body keeps its height and the transcript is re-sized", async ({ page }) => {
  test.skip(!isDesktop(), "the side panel stands beside the conversation on wide screens only");
  await page.setViewportSize({ width: 1440, height: 1000 });
  const problems = await openPage(page, { read: () => success(savedState()) });
  const bodySize = await letTheSidePanelHoldThePageHeight(page);
  const start = await expectRule(page, "after open");
  await expectSettled(page, "after open");
  // Above the smallest height, so that the change must show in the transcript's height.
  expect(start.height).toBeGreaterThan(SMALLEST + 60);
  const middle = Math.round(start.scrollRange / 2);
  await transcript(page).evaluate((box, to) => { box.scrollTop = to; }, middle);
  await transcript(page).focus();
  const bodyBefore = await bodySize();
  await later(page, "[data-chat-panel-band]", "paddingTop", 40);
  await expect.poll(async () => (await measure(page)).available).toBeLessThanOrEqual(start.available - 39);
  const after = await expectRule(page, "title band taller");
  await expectSettled(page, "title band taller");
  expect(await bodySize()).toEqual(bodyBefore);
  expect(Math.abs(start.height - after.height - 40)).toBeLessThanOrEqual(1);
  expect(after.scrollTop).toBe(Math.min(middle, after.scrollRange));
  await expect(transcript(page)).toBeFocused();
  expect(after.scrollY).toBe(0);
  expect(problems).toEqual([]);
});

test("with the side panel holding the page's height, an ended conversation's explanation that becomes taller late is followed", async ({ page }) => {
  test.skip(!isDesktop(), "the side panel stands beside the conversation on wide screens only");
  await page.setViewportSize({ width: 1440, height: 1000 });
  const problems = await openPage(page, { read: () => success(savedState(20, { sessionStatus: "ended", providerState: "unavailable" })) });
  const bodySize = await letTheSidePanelHoldThePageHeight(page);
  const start = await expectRule(page, "after open");
  await expectSettled(page, "after open");
  expect(start.height).toBeGreaterThan(SMALLEST + 80);
  const middle = Math.round(start.scrollRange / 2);
  await transcript(page).evaluate((box, to) => { box.scrollTop = to; }, middle);
  await transcript(page).focus();
  const bodyBefore = await bodySize();
  await later(page, 'section[aria-label="End Session"]', "paddingBottom", 60);
  await expect.poll(async () => (await measure(page)).available).toBeLessThanOrEqual(start.available - 59);
  const after = await expectRule(page, "explanation taller");
  await expectSettled(page, "explanation taller");
  expect(await bodySize()).toEqual(bodyBefore);
  expect(Math.abs(start.height - after.height - 60)).toBeLessThanOrEqual(1);
  expect(after.scrollTop).toBe(Math.min(middle, after.scrollRange));
  await expect(transcript(page)).toBeFocused();
  expect(after.scrollY).toBe(0);
  expect(problems).toEqual([]);
});

// For the Executor's reading (GPT-6 Astra REV494 finding 4): what the built screen gives at each size. The figures
// are recorded as annotations; the formula is asserted, and "in view" is stated for the message box area and Send.
const RECORDED = [[1440, 900], [1280, 900], [390, 844], [1024, 800], [1023, 800]] as const;
for (const kind of ["new", "saved"] as const) {
  test(`recorded sizes: a ${kind} conversation at 1440x900, 1280x900, 390x844, 1024x800 and 1023x800`, async ({ page }) => {
    test.skip(!isDesktop(), "sized inside the test; one project is enough");
    test.setTimeout(90_000);
    const problems: string[] = [];
    page.on("pageerror", error => problems.push(`pageerror: ${error.message}`));
    page.on("console", message => { if (message.type() === "error") problems.push(`console: ${message.text()}`); });
    await page.route(COMMANDS_URL, route => route.abort());
    await page.route(STATE_URL, route => fulfill(route, success(kind === "new" ? newState() : savedState())));
    for (const [width, height] of RECORDED) {
      await page.setViewportSize({ width, height });
      await page.goto("/explorer/conversation");
      await expect(transcript(page)).toBeVisible();
      await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
      const now = await expectRule(page, `${width}x${height}`);
      await expectSettled(page, `${width}x${height}`);
      const view = await page.evaluate(() => {
        const inWindow = (element: Element | null) => {
          if (element === null) return null;
          const place = element.getBoundingClientRect();
          return place.top >= 0 && place.bottom <= document.documentElement.clientHeight;
        };
        const bar = document.querySelector("[data-composer-bar]");
        return { messageBoxAreaInView: inWindow(bar), messageFieldInView: inWindow(document.querySelector("#conversation-message")),
          sendInView: inWindow(bar === null ? null : bar.querySelector('button[type="submit"]')) };
      });
      const record = { window: `${width}x${height}`, transcriptHeight: Math.round(now.height), ruleHeight: now.rule,
        availableSpace: Math.round(now.available), pageOffset: now.scrollY, pageScrollRange: now.pageRange,
        scrollingNeededForMessageBoxArea: Math.max(0, Math.round(now.composerBottom! - now.scrollY - now.windowHeight)),
        scrollingNeededForSend: Math.max(0, Math.round(now.sendBottom! - now.scrollY - now.windowHeight)), ...view };
      test.info().annotations.push({ type: `step B ${kind} conversation at ${width}x${height}`, description: JSON.stringify(record) });
      console.log(`[step B recorded] ${kind} conversation ${JSON.stringify(record)}`);
      // The formula, from the recorded figures themselves.
      expect(Math.abs(now.height - Math.min(LARGEST, Math.max(SMALLEST, Math.round(now.available)))), JSON.stringify(record)).toBeLessThanOrEqual(1);
      // An empty conversation never moves the page. A saved one is at the top exactly when its end fitted there,
      // and otherwise has the message box and Send in view after the one move.
      if (kind === "new") expect(now.scrollY, JSON.stringify(record)).toBe(0);
      else {
        const fitsAtTop = now.endBottom + GAP <= now.windowHeight + 1;
        if (fitsAtTop) expect(now.scrollY, JSON.stringify(record)).toBe(0);
        else expect(now.scrollY, JSON.stringify(record)).toBeGreaterThan(0);
        expect(view.sendInView, JSON.stringify(record)).toBe(true);
        expect(view.messageFieldInView, JSON.stringify(record)).toBe(true);
      }
      // With room, the message box and Send are in view without scrolling, for a new conversation too.
      if (now.height > SMALLEST + 1) {
        expect(view.messageBoxAreaInView, JSON.stringify(record)).toBe(true);
        expect(view.sendInView, JSON.stringify(record)).toBe(true);
      }
      await expectNoSidewaysScroll(page);
    }
    // Paul's goal at 1440 by 900: no scrolling to start chatting.
    const first = test.info().annotations.find(note => note.type === `step B ${kind} conversation at 1440x900`);
    const atDesign = JSON.parse(first!.description!) as { pageOffset: number; sendInView: boolean; messageBoxAreaInView: boolean };
    expect(atDesign).toMatchObject({ pageOffset: 0, sendInView: true, messageBoxAreaInView: true });
    expect(problems).toEqual([]);
  });
}

test("when the newest message is taller than the transcript, its end is what is in view", async ({ page }) => {
  const long = savedState(6);
  const tall = `${"A synthetic long reply for this test, with enough invented words to run over many lines. ".repeat(24)}The end of the long reply.`;
  const messages = [...long.messages.slice(0, -1), { ...long.messages[long.messages.length - 1], body: tall }];
  const problems = await openPage(page, { read: () => success({ ...long, messages }) });
  const now = await expectRule(page, "after open");
  expect(now.scrollRange - now.scrollTop).toBeLessThanOrEqual(2);
  const place = await page.evaluate(() => {
    const box = document.querySelector('[role="log"]')!.getBoundingClientRect();
    const items = document.querySelectorAll('[role="log"] ol > li');
    const last = items[items.length - 1].getBoundingClientRect();
    const time = items[items.length - 1].querySelector("time")!.getBoundingClientRect();
    const windowHeight = document.documentElement.clientHeight;
    return { itemHeight: Math.round(last.height), boxHeight: Math.round(box.height),
      endInsideTranscript: last.bottom <= box.bottom + 1 && last.bottom > box.top,
      timeInsideTranscript: time.top >= box.top && time.bottom <= box.bottom + 1,
      timeInsideWindow: time.top >= 0 && time.bottom <= windowHeight };
  });
  test.info().annotations.push({ type: "tall newest message", description: JSON.stringify(place) });
  console.log(`[step B recorded] tall newest message ${test.info().project.name} ${JSON.stringify({ ...place, transcript: now })}`);
  // The message really is taller than the transcript on the narrow project (224 px); its end, with its time, shows.
  if (!isDesktop()) expect(place.itemHeight).toBeGreaterThan(place.boxHeight);
  expect(place).toMatchObject({ endInsideTranscript: true, timeInsideTranscript: true, timeInsideWindow: true });
  await expect(savedList(page).getByRole("listitem").last().locator("time")).toBeInViewport({ ratio: 0.99 });
  await expect(composer(page)).toBeInViewport({ ratio: 0.99 });
  expect(problems).toEqual([]);
});

// 1024 px wide with the Compass panel open is the narrowest conversation card; 1023 px is just below the breakpoint.
for (const [width, height] of [[1024, 800], [1023, 800]] as const) {
  test(`at ${width} by ${height} the rule holds, nothing scrolls sideways and the message box is reachable`, async ({ page }) => {
    test.skip(!isDesktop(), "sized inside the test; one project is enough");
    await page.setViewportSize({ width, height });
    const problems = await openPage(page, { read: () => success(savedState()) });
    const now = await expectRule(page, "after open");
    test.info().annotations.push({ type: `measured at ${width} by ${height}`, description: JSON.stringify(now) });
    await expectNoSidewaysScroll(page);
    // Whether or not the page had to move, the message box and the newest message are in view after the open.
    await expect(composer(page)).toBeInViewport({ ratio: 0.99 });
    await expect(savedList(page).getByRole("listitem").last()).toBeInViewport();
    const fitsAtTop = now.endBottom + GAP <= now.windowHeight + 1;
    if (fitsAtTop) expect(now.scrollY).toBe(0);
    else expect(Math.abs(now.height - SMALLEST)).toBeLessThanOrEqual(1);
    await privacyButton(page).click();
    await expect(privacyExplanation(page)).toBeVisible();
    await expectRule(page, "Privacy and sharing open");
    await expectNoSidewaysScroll(page);
    expect(problems).toEqual([]);
  });
}

// GPT-6 Astra review REV558, finding 2: a phone's on-screen keyboard shrinks only the visual viewport. A real
// keyboard cannot be opened here, so the visual viewport's height is stubbed and its resize event is sent, as a
// phone does; the layout window keeps its size. (null removes the stub.)
const setVisibleHeight = (page: Page, height: number | null) => page.evaluate(visible => {
  const visual = window.visualViewport!;
  if (visible === null) delete (visual as unknown as { height?: number }).height;
  else Object.defineProperty(visual, "height", { configurable: true, get: () => visible });
  visual.dispatchEvent(new Event("resize"));
}, height);
type Visible = { height: number; rule: number; boxTop: number; boxBottom: number; sendTop: number; sendBottom: number; scrollY: number; pageRange: number; bodyPadding: string };
// The transcript against the rule for a visible height, and where the message box and Send are in the window.
const measureVisible = (page: Page, visible: number): Promise<Visible> => page.evaluate(([smallest, largest, gap, seen]) => {
  const box = document.querySelector('[role="log"]') as HTMLElement;
  const ends = document.querySelectorAll("[data-conversation-end]");
  const end = ends[ends.length - 1];
  const place = box.getBoundingClientRect();
  const root = document.documentElement;
  const available = seen - gap - (place.top + window.scrollY) - (end.getBoundingClientRect().bottom - place.bottom);
  const field = document.getElementById("conversation-message") as HTMLElement;
  const send = document.querySelector('[data-composer-bar] button[type="submit"]') as HTMLElement;
  return {
    height: place.height, rule: Math.min(largest, Math.max(smallest, Math.round(available))),
    boxTop: field.getBoundingClientRect().top, boxBottom: field.getBoundingClientRect().bottom, sendTop: send.getBoundingClientRect().top, sendBottom: send.getBoundingClientRect().bottom,
    scrollY: Math.round(window.scrollY), pageRange: Math.round(root.scrollHeight - root.clientHeight),
    bodyPadding: document.body.style.paddingBottom,
  };
}, [SMALLEST, LARGEST, GAP, visible]);

for (const focused of ["the message box", "Send"] as const) {
  test(`REV558: when the on-screen keyboard shrinks what is visible, the transcript is sized to it and ${focused}, holding focus, stays above the keyboard`, async ({ page }) => {
    const problems = await openPage(page, { read: () => success(savedState()) });
    const open = await expectRule(page, "after open");
    await composer(page).fill("A synthetic draft for this test.");
    if (focused === "Send") await sendButton(page).focus(); else await composer(page).focus();
    await expect(focused === "Send" ? sendButton(page) : composer(page)).toBeFocused();
    const before = await measureVisible(page, open.windowHeight);
    // The message box is in view before the keyboard opens.
    expect(before.boxTop).toBeGreaterThanOrEqual(0);
    expect(before.boxTop).toBeLessThan(open.windowHeight);
    const visible = Math.round(open.windowHeight * 0.6);
    await setVisibleHeight(page, visible);
    // Sized to the visible height, not to the layout window.
    await expect.poll(async () => { const now = await measureVisible(page, visible); return Math.abs(now.height - now.rule); }).toBeLessThanOrEqual(1);
    const shown = await measureVisible(page, visible);
    test.info().annotations.push({ type: `keyboard open, ${visible} px visible`, description: JSON.stringify({ before, shown }) });
    expect(shown.height).toBeLessThanOrEqual(before.height);
    // The two fit in what is visible here, so both are inside it, Send with the gap under it. Reaching the end
    // of the page is no excuse (REV574 finding 1).
    expect(shown.sendBottom - shown.boxTop + GAP, JSON.stringify(shown)).toBeLessThanOrEqual(visible);
    expect(shown.boxTop, JSON.stringify(shown)).toBeGreaterThanOrEqual(-1);
    expect(shown.sendBottom + GAP, JSON.stringify(shown)).toBeLessThanOrEqual(visible + 1);
    // On the phone the page really had to move.
    if (!isDesktop()) expect(before.sendBottom).toBeGreaterThan(visible);
    // The keyboard closes: the transcript follows the whole window again, no scroll room is left behind and
    // nothing is lost from view.
    await setVisibleHeight(page, null);
    await expectRule(page, "keyboard closed");
    expect((await measureVisible(page, open.windowHeight)).bodyPadding).toBe("");
    await expect(composer(page)).toBeInViewport({ ratio: 0.99 });
    expect(problems).toEqual([]);
  });
}

test("REV558: a visible-height change while neither the message box nor Send holds focus sizes the transcript and leaves the page where it is", async ({ page }) => {
  const problems = await openPage(page, { read: () => success(savedState()) });
  const open = await expectRule(page, "after open");
  await title(page).focus();
  const at = await page.evaluate(() => Math.round(window.scrollY));
  const visible = Math.round(open.windowHeight * 0.6);
  await setVisibleHeight(page, visible);
  await expect.poll(async () => { const now = await measureVisible(page, visible); return Math.abs(now.height - now.rule); }).toBeLessThanOrEqual(1);
  // Only the browser's own clamp may move the page (a shorter transcript makes the page shorter).
  const now = await measureVisible(page, visible);
  expect(now.scrollY).toBe(Math.min(at, now.pageRange));
  await setVisibleHeight(page, null);
  await expectRule(page, "restored");
  expect(problems).toEqual([]);
});

test("REV558: with the message box focused but scrolled out of view, a visible-height change does not pull the page back", async ({ page }) => {
  test.skip(isDesktop(), "the narrow project is the phone: its page scrolls far enough");
  const problems = await openPage(page, { read: () => success(savedState()) });
  const open = await expectRule(page, "after open");
  await composer(page).focus();
  await page.evaluate(() => window.scrollTo(0, 0));
  const away = await measureVisible(page, open.windowHeight);
  expect(away.scrollY).toBe(0);
  // The message box is below the window now.
  expect(away.boxTop).toBeGreaterThan(open.windowHeight);
  await setVisibleHeight(page, Math.round(open.windowHeight * 0.6));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(0);
  await setVisibleHeight(page, null);
  expect(problems).toEqual([]);
});

// GPT-6 Astra review REV574. Everything that stands after the chat panel in the page is hidden, so the page ends
// right under the message box area and cannot scroll far enough by itself.
const endThePageUnderTheMessageBox = (page: Page) => page.evaluate(() => {
  for (let node: Element | null = document.querySelector("[data-composer-bar]"); node !== null && node !== document.body; node = node.parentElement) {
    for (let after = node.nextElementSibling; after !== null; after = after.nextElementSibling) {
      // The markers the sizer measures stay.
      if (after.matches("[data-conversation-end]") || after.querySelector("[data-conversation-end]") !== null) continue;
      (after as HTMLElement).style.display = "none";
    }
  }
  window.scrollTo(0, document.documentElement.scrollHeight);
});

for (const focused of ["the message box", "Send"] as const) {
  test(`REV574: when the page cannot scroll far enough, temporary scroll room brings the message box and Send above the keyboard (${focused} focused), and it is gone when the keyboard closes`, async ({ page }) => {
    const problems = await openPage(page, { read: () => success(savedState()) });
    await expectRule(page, "after open");
    await composer(page).fill("A synthetic draft for this test.");
    await endThePageUnderTheMessageBox(page);
    const open = await expectRule(page, "page ended under the message box");
    if (focused === "Send") await sendButton(page).focus(); else await composer(page).focus();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const before = await measureVisible(page, open.windowHeight);
    // The page is at its end: it cannot scroll further by itself, and both controls are in view.
    expect(before.pageRange - before.scrollY).toBeLessThanOrEqual(1);
    expect(before.boxTop).toBeGreaterThanOrEqual(0);
    expect(before.sendBottom).toBeLessThanOrEqual(open.windowHeight);
    expect(before.bodyPadding).toBe("");
    // A keyboard that leaves room for the two together, with 40 px to spare, and covers Send where it is now.
    const visible = Math.round(before.sendBottom - before.boxTop + GAP + 40);
    expect(visible).toBeLessThan(before.sendBottom);
    await setVisibleHeight(page, visible);
    await expect.poll(async () => (await measureVisible(page, visible)).sendBottom + GAP).toBeLessThanOrEqual(visible + 1);
    const shown = await measureVisible(page, visible);
    test.info().annotations.push({ type: `no page scroll range, ${visible} px visible`, description: JSON.stringify({ before, shown }) });
    // Both are really visible; the page was given room and moved further than it could before.
    expect(shown.boxTop, JSON.stringify(shown)).toBeGreaterThanOrEqual(-1);
    expect(shown.sendBottom + GAP, JSON.stringify(shown)).toBeLessThanOrEqual(visible + 1);
    expect(shown.bodyPadding).toMatch(/^\d+(\.\d+)?px$/);
    expect(shown.scrollY).toBeGreaterThan(before.pageRange);
    await expect(focused === "Send" ? sendButton(page) : composer(page)).toBeFocused();
    // The keyboard becomes smaller: still both visible. It closes: the room is gone.
    const smaller = visible + 60;
    await setVisibleHeight(page, smaller);
    const eased = await measureVisible(page, smaller);
    expect(eased.boxTop, JSON.stringify(eased)).toBeGreaterThanOrEqual(-1);
    expect(eased.sendBottom + GAP, JSON.stringify(eased)).toBeLessThanOrEqual(smaller + 1);
    await setVisibleHeight(page, null);
    const closed = await measureVisible(page, open.windowHeight);
    expect(closed.bodyPadding).toBe("");
    expect(closed.pageRange).toBeLessThanOrEqual(before.pageRange + 1);
    await expectRule(page, "keyboard closed");
    expect(problems).toEqual([]);
  });
}

for (const focused of ["the message box", "Send"] as const) {
  test(`REV574: when the message box and Send are taller than what is visible, ${focused}, holding focus, is the one shown`, async ({ page }) => {
    const problems = await openPage(page, { read: () => success(savedState()) });
    const open = await expectRule(page, "after open");
    await composer(page).fill("A synthetic draft for this test.");
    if (focused === "Send") await sendButton(page).focus(); else await composer(page).focus();
    const before = await measureVisible(page, open.windowHeight);
    expect(before.boxTop).toBeGreaterThanOrEqual(0);
    expect(before.sendBottom).toBeLessThanOrEqual(open.windowHeight);
    // 60 px less than the two need together.
    const visible = Math.round(before.sendBottom - before.boxTop + GAP - 60);
    expect(visible).toBeGreaterThan(Math.round(before.sendBottom - before.sendTop) + GAP);
    await setVisibleHeight(page, visible);
    const wanted = async () => {
      const now = await measureVisible(page, visible);
      return focused === "Send" ? Math.abs(now.sendBottom + GAP - visible) : Math.abs(now.boxTop);
    };
    await expect.poll(wanted).toBeLessThanOrEqual(1);
    const shown = await measureVisible(page, visible);
    test.info().annotations.push({ type: `oversized, ${visible} px visible, ${focused} focused`, description: JSON.stringify({ before, shown }) });
    if (focused === "Send") {
      // Send is whole and above the keyboard with its gap; the message box's top has left the visible area.
      expect(shown.sendTop).toBeGreaterThanOrEqual(0);
      expect(shown.sendBottom + GAP).toBeLessThanOrEqual(visible + 1);
      expect(shown.boxTop).toBeLessThan(0);
      await expect(sendButton(page)).toBeFocused();
    } else {
      // The message box starts at the top of the visible area; Send is the part that does not fit.
      expect(Math.abs(shown.boxTop)).toBeLessThanOrEqual(1);
      expect(shown.sendBottom + GAP).toBeGreaterThan(visible);
      await expect(composer(page)).toBeFocused();
    }
    await setVisibleHeight(page, null);
    await expectRule(page, "keyboard closed");
    expect((await measureVisible(page, open.windowHeight)).bodyPadding).toBe("");
    expect(problems).toEqual([]);
  });
}

test("REV574: a focused Send in view is brought above the keyboard even when the message box was above the window before", async ({ page }) => {
  const problems = await openPage(page, { read: () => success(savedState()) });
  const open = await expectRule(page, "after open");
  await composer(page).fill("A synthetic draft for this test.");
  await sendButton(page).focus();
  // Scroll until the whole message box has just left the top of the window; Send, below it, is still in view.
  // (A test-only block under the page gives it the scroll range for that.)
  await page.evaluate(() => {
    const room = document.createElement("div");
    room.style.height = "2000px";
    document.body.appendChild(room);
  });
  const start = await measureVisible(page, open.windowHeight);
  await page.evaluate(by => window.scrollBy(0, by), Math.round(start.boxBottom + 2));
  const before = await measureVisible(page, open.windowHeight);
  test.info().annotations.push({ type: "only Send in view", description: JSON.stringify({ start, before }) });
  // Asked of the message box, "was it in view before" would say no; asked of Send, yes.
  expect(before.boxBottom).toBeLessThanOrEqual(0);
  expect(before.sendTop).toBeGreaterThanOrEqual(10);
  expect(before.sendBottom).toBeLessThan(open.windowHeight);
  // A keyboard that covers the last 8 px Send needs (with its gap).
  const visible = Math.round(before.sendBottom + GAP - 8);
  await setVisibleHeight(page, visible);
  await expect.poll(async () => (await measureVisible(page, visible)).sendBottom + GAP, { message: JSON.stringify(before) }).toBeLessThanOrEqual(visible + 1);
  const shown = await measureVisible(page, visible);
  expect(shown.sendTop).toBeGreaterThanOrEqual(-1);
  await expect(sendButton(page)).toBeFocused();
  await setVisibleHeight(page, null);
  expect(problems).toEqual([]);
});

// GPT-6 Astra review REV587. A pinch zoom changes the visual viewport's height and its scale together; both are
// stubbed and the resize event is sent. (null removes a stub.)
const setVisibleZoom = (page: Page, height: number | null, scale: number | null) => page.evaluate(([visible, zoom]) => {
  const visual = window.visualViewport!;
  if (visible === null) delete (visual as unknown as { height?: number }).height;
  else Object.defineProperty(visual, "height", { configurable: true, get: () => visible });
  if (zoom === null) delete (visual as unknown as { scale?: number }).scale;
  else Object.defineProperty(visual, "scale", { configurable: true, get: () => zoom });
  visual.dispatchEvent(new Event("resize"));
}, [height, scale] as const);

test("REV587: with the keyboard open and temporary scroll room in place, pinching in and back out keeps the room and Send visible; closing the keyboard removes it and reopening gives it again", async ({ page }) => {
  const problems = await openPage(page, { read: () => success(savedState()) });
  await expectRule(page, "after open");
  await composer(page).fill("A synthetic draft for this test.");
  await endThePageUnderTheMessageBox(page);
  const open = await expectRule(page, "page ended under the message box");
  await sendButton(page).focus();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const before = await measureVisible(page, open.windowHeight);
  expect(before.pageRange - before.scrollY).toBeLessThanOrEqual(1);
  expect(before.bodyPadding).toBe("");
  // The keyboard opens: the page has no scroll range left, so room is given and both controls are visible.
  const visible = Math.round(before.sendBottom - before.boxTop + GAP + 40);
  expect(visible).toBeLessThan(before.sendBottom);
  await setVisibleHeight(page, visible);
  await expect.poll(async () => (await measureVisible(page, visible)).sendBottom + GAP).toBeLessThanOrEqual(visible + 1);
  const shown = await measureVisible(page, visible);
  expect(shown.boxTop, JSON.stringify(shown)).toBeGreaterThanOrEqual(-1);
  expect(shown.bodyPadding).toMatch(/^\d+(\.\d+)?px$/);
  // Pinch in to twice the size: half the height is visible, the scale changes. The room stays.
  await setVisibleZoom(page, Math.round(visible / 2), 2);
  const pinched = await measureVisible(page, visible);
  expect(pinched.bodyPadding).toBe(shown.bodyPadding);
  // Pinch back out to the original zoom, the keyboard still open: the room is still there, the page did not
  // snap back, and Send (which holds focus) and the message box are visible as before.
  await setVisibleZoom(page, visible, null);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const back = await measureVisible(page, visible);
  test.info().annotations.push({ type: "keyboard open, pinch in, pinch out", description: JSON.stringify({ before, shown, pinched, back }) });
  expect(back.bodyPadding).toBe(shown.bodyPadding);
  expect(back.scrollY).toBe(shown.scrollY);
  expect(back.sendTop, JSON.stringify(back)).toBeGreaterThanOrEqual(-1);
  expect(back.sendBottom + GAP, JSON.stringify(back)).toBeLessThanOrEqual(visible + 1);
  expect(back.boxTop, JSON.stringify(back)).toBeGreaterThanOrEqual(-1);
  await expect(sendButton(page)).toBeFocused();
  // The keyboard closes: the room is gone and the page is as it was.
  await setVisibleHeight(page, null);
  const closed = await measureVisible(page, open.windowHeight);
  expect(closed.bodyPadding).toBe("");
  expect(closed.pageRange).toBeLessThanOrEqual(before.pageRange + 1);
  await expectRule(page, "keyboard closed");
  // It opens again: room is given again and both are visible.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await setVisibleHeight(page, visible);
  await expect.poll(async () => (await measureVisible(page, visible)).sendBottom + GAP).toBeLessThanOrEqual(visible + 1);
  const again = await measureVisible(page, visible);
  expect(again.boxTop, JSON.stringify(again)).toBeGreaterThanOrEqual(-1);
  expect(again.bodyPadding).toMatch(/^\d+(\.\d+)?px$/);
  await setVisibleHeight(page, null);
  expect((await measureVisible(page, open.windowHeight)).bodyPadding).toBe("");
  await expectRule(page, "keyboard closed again");
  expect(problems).toEqual([]);
});
