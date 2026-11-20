// Synthetic HTTP responses prove browser behaviour only. The Executor runs this suite.
// The compact conversation header, step A (Paul's decisions, PRJ01-SPR002 decision record 2026-11-16 17:53:42
// and 21:27:10 CST): the strip, its light and Reload, one explanation at a time, the focus rules, the chat
// panel with its title band and the start marker. No real person's words; nothing real is sent.
import { expect, test, type Page, type Route } from "@playwright/test";

import {
  EXPLORER_CONVERSATION_VERSION,
  type ExplorerConversationState,
} from "../../src/lib/solmind/explorerConversationContract";
import {
  CHANGE_CHECKING,
  COMMANDS_URL,
  LOADING,
  RELOAD_CHECKING,
  RELOAD_NEEDED,
  STATE_URL,
  UP_TO_DATE,
  holdNextRequest,
  privacyButton,
  privacyExplanation,
  reloadAndExpect,
  reloadButton,
  reloadHelpButton,
  reloadHelpLine,
  savedLight,
  savedStatus,
} from "./compactHeaderHelpers";
import { expectNoSeriousAxeViolations, expectNoSidewaysScroll } from "./conversationPreviewHelpers";

test.use({ trace: "off", screenshot: "off", video: "off" });

const HELP = "This screen checks your saved conversation only when it opens, when you make a change and when you reload it. To see changes made in another tab or on another device, choose Reload saved conversation.";
const REASON_CHANGED = "To continue after your conversation has changed, choose Reload saved conversation.";
const REASON_PENDING = "To check whether your last message has a confirmed result, choose Reload saved conversation.";
const REASON_LOAD = "To try loading your conversation again, choose Reload saved conversation.";
const ASSURANCE = "Explore with the SolMind Virtual Guide. Your conversation, Compass and Waypoints stay private; nothing is shared from this screen.";
const CAN_SEE_SENTENCE = "This will explain exactly what your Virtual Guide can see, so you know what stays private.";
const SHARE_SENTENCE = "You will be able to share this whole conversation live with your Guide, until you stop.";
const START = "Start of your conversation";
const CHANGED_ALERT = "Your conversation has changed. Reload the saved conversation before making another change.";
const LOAD_ALERT = "The conversation could not be loaded. Please try again.";
const PENDING_NOTICE = "A saved message is still awaiting a confirmed result.";
const UNCERTAIN_ALERT = "We could not confirm your last change.";

const CONVERSATION = "10000000-0000-4000-8000-0000000000c1";
const id = (role: "explorer" | "virtualGuide", index: number) =>
  `${role === "explorer" ? "2" : "3"}0000000-0000-4000-8000-0000000000${String(index).padStart(2, "0")}`;
function savedState(pairs = 2, overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  const messages: ExplorerConversationState["messages"][number][] = [];
  for (let index = 1; index <= pairs; index += 1) {
    const minute = String(index).padStart(2, "0");
    messages.push({ id: id("explorer", index), role: "explorer",
      body: `A synthetic test message number ${index}: some invented words about an ordinary day, long enough to wrap onto a second line.`,
      createdAt: `2026-11-16T08:${minute}:00.000Z` });
    messages.push({ id: id("virtualGuide", index), role: "virtualGuide",
      body: `A synthetic saved reply number ${index}: an invented reflection of a few sentences. It asks nothing.`,
      createdAt: `2026-11-16T08:${minute}:30.000Z` });
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
const failure = (error: "denied" | "refresh_required" | "provider_unavailable" | "unavailable") => ({
  version: "explorer-private-conversation-response.v1", result: { ok: false, state: null, error }, assistance: null,
});
const fulfill = (route: Route, value: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(value) });
const malformed = (route: Route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ unconfirmed: true }) });

const title = (page: Page) => page.locator("h1#conversation-preview-heading");
const transcript = (page: Page) => page.getByRole("log", { name: "Conversation transcript", exact: true });
const composer = (page: Page) => page.getByLabel("Continue the conversation", { exact: true });
const sendButton = (page: Page) => page.getByRole("button", { name: "Send", exact: true });
const retryButton = (page: Page) => page.getByRole("button", { name: "Retry the same request", exact: true });
const signInLink = (page: Page) => page.getByRole("main").getByRole("link", { name: "Sign in", exact: true });
const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
const transcriptTop = (page: Page) => transcript(page).evaluate(box => Math.round(box.scrollTop));

type Answers = { read: () => unknown; command: (route: Route) => Promise<void> | void };
// Opens the page with the given answers; page errors and console errors fail the test at its end.
async function openPage(page: Page, answers: Answers) {
  const problems: string[] = [];
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`));
  page.on("console", message => { if (message.type() === "error") problems.push(`console: ${message.text()}`); });
  await page.route(COMMANDS_URL, route => answers.command(route));
  await page.route(STATE_URL, route => fulfill(route, answers.read()));
  await page.goto("/explorer/conversation");
  return problems;
}
const noCommand = (route: Route) => route.abort();
async function typeAndSend(page: Page) {
  await composer(page).fill("A synthetic message for this test.");
  await sendButton(page).click();
}

test("the strip opens with the green light, one status region, Reload's full name and both explanations closed", async ({ page }) => {
  const problems = await openPage(page, { read: () => success(savedState()), command: noCommand });
  await expect(transcript(page)).toBeVisible();
  // The title is the page's only h1, in the chat panel's band, and holds focus after the open.
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("[data-chat-panel] [data-chat-panel-band] h1#conversation-preview-heading")).toHaveText("Your conversation");
  await expect(title(page)).toBeFocused();
  // One polite status region, first of the page's status regions, with the light hidden from screen readers.
  await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
  await expect(page.getByRole("status").first()).toHaveAttribute("id", "conversation-saved-status");
  await expect(savedStatus(page)).toHaveAttribute("aria-live", "polite");
  await expect(savedStatus(page)).toHaveAttribute("aria-atomic", "true");
  await expect(savedLight(page)).toHaveAttribute("data-saved-light", "green");
  await expect(savedLight(page)).toHaveAttribute("aria-hidden", "true");
  await expect(reloadButton(page)).toBeEnabled();
  await expect(reloadButton(page)).toHaveAttribute("aria-describedby", "conversation-reload-help");
  await expect(reloadHelpButton(page)).toHaveText("?");
  await expect(reloadHelpButton(page)).toHaveAttribute("aria-expanded", "false");
  await expect(privacyButton(page)).toHaveAttribute("aria-expanded", "false");
  await expect(privacyExplanation(page)).toBeHidden();
  await expect(reloadHelpLine(page)).toBeHidden();
  await expect(reloadHelpLine(page)).toHaveText(HELP);
  // The assurance sentence is inside the closed explanation, not in view; the amber line above the title is gone.
  await expect(page.getByText(ASSURANCE, { exact: true })).toBeHidden();
  await expect(page.getByRole("main").getByText(/with your Virtual Guide$/)).toHaveCount(0);
  await expect(page.getByText("Active and private", { exact: true })).toBeVisible();
  await expect(page.getByText("Private conversation", { exact: true })).toBeVisible();
  // Every strip control is at least 32 px tall; "?" is 32 by 32 px.
  for (const control of [privacyButton(page), reloadButton(page), reloadHelpButton(page)]) {
    const box = await control.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(32);
  }
  const help = await reloadHelpButton(page).boundingBox();
  expect(Math.round(help!.width)).toBe(32);
  expect(Math.round(help!.height)).toBe(32);
  await expectNoSidewaysScroll(page);
  await expectNoSeriousAxeViolations(page);
  expect(problems).toEqual([]);
});

test("while the saved conversation loads there is no light, and the title stands in the strip", async ({ page }) => {
  const held = await (async () => {
    await page.route(COMMANDS_URL, noCommand);
    await page.route(STATE_URL, route => fulfill(route, success(savedState())));
    return holdNextRequest(page, STATE_URL);
  })();
  await page.goto("/explorer/conversation");
  await held.arrived;
  await expect(savedStatus(page)).toHaveText(LOADING);
  await expect(savedLight(page)).toHaveCount(0);
  await expect(reloadButton(page)).toBeDisabled();
  await expect(page.locator("[data-chat-panel]")).toHaveCount(0);
  await expect(page.locator("[data-conversation-strip] h1#conversation-preview-heading")).toBeFocused();
  held.release();
  // The title moves into the band and keeps keyboard focus; the page-open rules then apply as before.
  await expect(page.locator("[data-chat-panel-band] h1#conversation-preview-heading")).toBeFocused();
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
});

// Paul's rule: opening one explanation closes the other; closing one shows none. The six presses are
// Privacy, ?, ?, ?, Privacy, Privacy.
const PRESSES = ["privacy", "help", "help", "help", "privacy", "privacy"] as const;
const AFTER = ["privacy", "help", null, "help", "privacy", null] as const;
async function expectOpen(page: Page, open: "privacy" | "help" | null) {
  await expect(privacyButton(page)).toHaveAttribute("aria-expanded", String(open === "privacy"));
  await expect(reloadHelpButton(page)).toHaveAttribute("aria-expanded", String(open === "help"));
  if (open === "privacy") await expect(privacyExplanation(page)).toBeVisible(); else await expect(privacyExplanation(page)).toBeHidden();
  if (open === "help") await expect(reloadHelpLine(page)).toBeVisible(); else await expect(reloadHelpLine(page)).toBeHidden();
}

for (const how of ["pointer", "Enter", "Space"] as const) {
  test(`one explanation at a time, by ${how}: focus stays on the pressed button and nothing scrolls`, async ({ page }) => {
    const problems = await openPage(page, { read: () => success(savedState(20)), command: noCommand });
    await expect(transcript(page)).toBeVisible();
    await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
    // Put the page at its top and the transcript in the middle of its history, from inside the page.
    await page.evaluate(() => window.scrollTo(0, 0));
    await transcript(page).evaluate(box => { box.scrollTop = Math.round((box.scrollHeight - box.clientHeight) / 2); });
    const pageAt = await scrollY(page);
    const historyAt = await transcriptTop(page);
    expect(pageAt).toBe(0);
    expect(historyAt).toBeGreaterThan(0);
    await expectOpen(page, null);
    for (const [index, press] of PRESSES.entries()) {
      const control = press === "privacy" ? privacyButton(page) : reloadHelpButton(page);
      if (how === "pointer") await control.click();
      else { await control.focus(); await page.keyboard.press(how); }
      await expectOpen(page, AFTER[index]);
      await expect(control).toBeFocused();
      expect(await scrollY(page), `press ${index + 1}`).toBe(pageAt);
      expect(await transcriptTop(page), `press ${index + 1}`).toBe(historyAt);
    }
    expect(problems).toEqual([]);
  });
}

test("Privacy and sharing holds the assurance sentence and the two titled lines; nothing in it takes focus", async ({ page }) => {
  await openPage(page, { read: () => success(savedState()), command: noCommand });
  await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
  await privacyButton(page).click();
  const explanation = privacyExplanation(page);
  await expect(explanation).toBeVisible();
  await expect(explanation).toHaveAttribute("role", "group");
  await expect(explanation).toHaveAccessibleName("Privacy and sharing");
  await expect(explanation.locator("p").first()).toHaveText(ASSURANCE);
  const lines = explanation.locator("[data-privacy-line]");
  await expect(lines).toHaveCount(2);
  await expect(lines.nth(0)).toHaveText(/^What the Virtual Guide can see\s*Not connected yet\s*This will explain/);
  await expect(lines.nth(0)).toContainText(CAN_SEE_SENTENCE);
  await expect(lines.nth(1)).toHaveText(/^Share whole conversation\s*Not connected yet\s*You will be able/);
  await expect(lines.nth(1)).toContainText(SHARE_SENTENCE);
  await expect(explanation.locator("button, a, input, select, textarea, [tabindex]")).toHaveCount(0);
  // The two former buttons are gone from the page.
  await expect(page.getByRole("button", { name: /^Share whole conversation/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^What the Virtual Guide can see/ })).toHaveCount(0);
  await expectNoSidewaysScroll(page);
  await expectNoSeriousAxeViolations(page);
});

test("closing an explanation keeps the page position inside what is still scrollable", async ({ page }) => {
  await openPage(page, { read: () => success(savedState(20)), command: noCommand });
  await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
  await privacyButton(page).click();
  await expect(privacyExplanation(page)).toBeVisible();
  // At the very bottom of the page with the explanation open; closing it makes the page shorter.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const before = await scrollY(page);
  const historyAt = await transcriptTop(page);
  // Pressed from inside the page, so that the test itself never scrolls the window.
  await privacyButton(page).evaluate(button => (button as HTMLButtonElement).click());
  await expect(privacyExplanation(page)).toBeHidden();
  const limit = await page.evaluate(() => Math.round(document.documentElement.scrollHeight - document.documentElement.clientHeight));
  const after = await scrollY(page);
  // The browser may only bring the position back inside the shorter page; the app scrolls nothing itself.
  expect(after).toBeLessThanOrEqual(before);
  expect(after).toBeLessThanOrEqual(limit);
  expect(await transcriptTop(page)).toBe(historyAt);
});

test("a pending result turns the light yellow with its reason; Reload hides only the light; a settled Reload turns it green", async ({ page }) => {
  let current = savedState();
  const problems = await openPage(page, {
    read: () => success(current),
    command: route => { current = { ...savedState(3), pendingTurn: true }; return fulfill(route, success(current)); },
  });
  await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
  await typeAndSend(page);
  // Yellow: the words, the always-shown reason line, no "?", and the existing pending notice.
  await expect(savedStatus(page)).toHaveText(RELOAD_NEEDED);
  await expect(savedLight(page)).toHaveAttribute("data-saved-light", "yellow");
  await expect(reloadHelpLine(page)).toBeVisible();
  await expect(reloadHelpLine(page)).toHaveText(REASON_PENDING);
  await expect(reloadHelpButton(page)).toHaveCount(0);
  await expect(page.getByText(PENDING_NOTICE, { exact: false })).toBeVisible();
  await expect(reloadButton(page)).toBeEnabled();
  // The reason line stays when Privacy and sharing is opened and closed: it belongs to "Reload needed".
  await privacyButton(page).click();
  await expect(privacyExplanation(page)).toBeVisible();
  await expect(reloadHelpLine(page)).toBeVisible();
  await privacyButton(page).click();
  await expect(privacyExplanation(page)).toBeHidden();
  await expect(reloadHelpLine(page)).toBeVisible();
  // A Reload that still returns the pending result: only the light hides while it runs, then yellow again.
  const held = await holdNextRequest(page, STATE_URL);
  await reloadButton(page).click();
  await held.arrived;
  await expect(savedStatus(page)).toHaveText(RELOAD_CHECKING);
  await expect(savedLight(page)).toHaveCount(0);
  await expect(reloadButton(page)).toBeDisabled();
  await expect(reloadHelpLine(page)).toHaveText(REASON_PENDING);
  await expect(reloadHelpLine(page)).toBeVisible();
  await expect(reloadHelpButton(page)).toHaveCount(0);
  await expect(page.getByText(PENDING_NOTICE, { exact: false })).toBeVisible();
  held.release();
  await expect(savedStatus(page)).toHaveText(RELOAD_NEEDED);
  await expect(reloadButton(page)).toBeEnabled();
  // A Reload that returns the settled conversation: green, "?" back, help closed.
  current = savedState(4);
  await reloadAndExpect(page, UP_TO_DATE);
  await expect(savedLight(page)).toHaveAttribute("data-saved-light", "green");
  await expect(reloadHelpButton(page)).toBeVisible();
  await expect(reloadHelpLine(page)).toBeHidden();
  await expect(reloadHelpLine(page)).toHaveText(HELP);
  await expect(page.getByText(PENDING_NOTICE, { exact: false })).toHaveCount(0);
  await expectNoSidewaysScroll(page);
  expect(problems).toEqual([]);
});

test("the conversation has changed: yellow with its reason; a failed Reload shows no light; a successful Reload turns green", async ({ page }) => {
  let read: () => unknown = () => success(savedState());
  await openPage(page, { read: () => read(), command: route => fulfill(route, failure("refresh_required")) });
  await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
  await typeAndSend(page);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(CHANGED_ALERT);
  await expect(savedStatus(page)).toHaveText(RELOAD_NEEDED);
  await expect(savedLight(page)).toHaveAttribute("data-saved-light", "yellow");
  await expect(reloadHelpLine(page)).toBeVisible();
  await expect(reloadHelpLine(page)).toHaveText(REASON_CHANGED);
  await expect(reloadHelpButton(page)).toHaveCount(0);
  // No saved conversation is on screen: no chat panel, and the title stands in the strip.
  await expect(page.locator("[data-chat-panel]")).toHaveCount(0);
  await expect(page.locator("[data-conversation-strip] h1#conversation-preview-heading")).toHaveCount(1);
  await expectNoSidewaysScroll(page);
  // The Reload fails: while it runs the loading sentence shows and the reason stays; then no light, the
  // "could not be loaded" alert and its own reason line.
  read = () => failure("unavailable");
  await reloadAndExpect(page, "", LOADING);
  await expect(savedLight(page)).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(LOAD_ALERT);
  await expect(reloadHelpLine(page)).toBeVisible();
  await expect(reloadHelpLine(page)).toHaveText(REASON_LOAD);
  await expect(reloadHelpButton(page)).toHaveCount(0);
  await expectNoSidewaysScroll(page);
  // The Reload succeeds: green, the chat panel is back with the title in its band.
  read = () => success(savedState(3));
  await reloadAndExpect(page, UP_TO_DATE, LOADING);
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect(page.locator("[data-chat-panel-band] h1#conversation-preview-heading")).toHaveCount(1);
  await expect(reloadHelpButton(page)).toBeVisible();
  await expect(reloadHelpLine(page)).toBeHidden();
});

test("a change answered with a support notice shows no light; an unconfirmed change shows Retry and no Reload; sign-in refused shows Sign in", async ({ page }) => {
  let step = 0;
  await openPage(page, {
    read: () => success(savedState()),
    command: route => {
      step += 1;
      if (step === 1) return fulfill(route, success(savedState(3), { kind: "support", body: "A synthetic support notice for this test.", persisted: false }));
      if (step === 2) return malformed(route);
      return fulfill(route, failure("denied"));
    },
  });
  await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
  // A support notice came with the confirmed change: nothing reassuring beside it.
  await typeAndSend(page);
  await expect(page.getByRole("main").getByRole("alert").first()).toContainText("A synthetic support notice for this test.");
  await expect(savedStatus(page)).toHaveText("");
  await expect(savedLight(page)).toHaveCount(0);
  await expect(page.getByText(UP_TO_DATE, { exact: true })).toHaveCount(0);
  await expect(reloadButton(page)).toBeEnabled();
  await expect(reloadHelpButton(page)).toBeVisible();
  // The next change cannot be confirmed: no light, no Reload, no "?", Retry shown.
  await sendButton(page).click();
  await expect(page.getByRole("main").getByRole("alert").filter({ hasText: UNCERTAIN_ALERT })).toBeVisible();
  await expect(retryButton(page)).toBeVisible();
  await expect(savedStatus(page)).toHaveText("");
  await expect(savedLight(page)).toHaveCount(0);
  await expect(reloadButton(page)).toHaveCount(0);
  await expect(reloadHelpButton(page)).toHaveCount(0);
  await expect(reloadHelpLine(page)).toHaveCount(0);
  // The Retry is refused for sign-in: no light, no Reload, Sign in shown.
  await retryButton(page).click();
  await expect(signInLink(page)).toBeVisible();
  await expect(savedStatus(page)).toHaveText("");
  await expect(savedLight(page)).toHaveCount(0);
  await expect(reloadButton(page)).toHaveCount(0);
  await expect(reloadHelpButton(page)).toHaveCount(0);
  await expectNoSidewaysScroll(page);
});

test("a change that is not a Send shows the change sentence while it is checked, and no light when it cannot be confirmed", async ({ page }) => {
  await openPage(page, { read: () => success(savedState()), command: route => malformed(route) });
  await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
  // End Session's review and confirmation are a change that is not a Send; its answer is held to see the busy state.
  await page.getByRole("button", { name: "End this conversation", exact: true }).click();
  const held = await holdNextRequest(page, COMMANDS_URL);
  await page.getByRole("button", { name: "End Session and return home", exact: true }).click();
  await held.arrived;
  await expect(savedStatus(page)).toHaveText(CHANGE_CHECKING);
  await expect(savedLight(page)).toHaveCount(0);
  await expect(reloadButton(page)).toBeDisabled();
  held.release();
  await expect(retryButton(page)).toBeVisible();
  await expect(savedStatus(page)).toHaveText("");
});

// The focus table (BUILD_PLAN_R2.md section 4.8): the control that holds keyboard focus leaves the screen.
const focusCases = [
  { name: "a pending result", answer: (route: Route) => fulfill(route, success({ ...savedState(3), pendingTurn: true })), target: "reload", conversationStays: true },
  { name: "the conversation has changed", answer: (route: Route) => fulfill(route, failure("refresh_required")), target: "reload", conversationStays: false },
  { name: "the change could not be confirmed", answer: (route: Route) => malformed(route), target: "retry", conversationStays: true },
  { name: "sign-in refused", answer: (route: Route) => fulfill(route, failure("denied")), target: "signIn", conversationStays: false },
] as const;
const focusTarget = (page: Page, target: "reload" | "retry" | "signIn") =>
  target === "reload" ? reloadButton(page) : target === "retry" ? retryButton(page) : signInLink(page);

for (const each of focusCases) {
  test(`focus on "?" when ${each.name} arrives moves to the control the Explorer needs`, async ({ page }) => {
    // A short window, so the page still scrolls after an answer removes the conversation; and the browser's own
    // scroll anchoring is turned off, so any movement seen here would be the application's.
    await page.setViewportSize({ width: page.viewportSize()!.width, height: 420 });
    await openPage(page, { read: () => success(savedState()), command: route => each.answer(route) });
    await page.addStyleTag({ content: "html, body, body * { overflow-anchor: none !important; }" });
    await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
    await composer(page).fill("A synthetic message for this test.");
    const held = await holdNextRequest(page, COMMANDS_URL);
    await sendButton(page).click();
    await held.arrived;
    // While the reply is awaited "?" is still drawn; focus is put on it by keyboard.
    await reloadHelpButton(page).focus();
    await expect(reloadHelpButton(page)).toBeFocused();
    // A small, known page position, set from inside the page; focus stays on "?".
    await page.evaluate(() => window.scrollTo(0, 40));
    const pageAt = await scrollY(page);
    expect(pageAt).toBe(40);
    await expect(reloadHelpButton(page)).toBeFocused();
    held.release();
    await expect(reloadHelpButton(page)).toHaveCount(0);
    await expect(focusTarget(page, each.target)).toBeFocused();
    // The focus move does not scroll the page: the position is exactly where it was. Only when the page became
    // shorter than that position may the browser bring it back to the new largest position.
    const limit = await page.evaluate(() => Math.round(document.documentElement.scrollHeight - document.documentElement.clientHeight));
    expect(limit).toBeGreaterThan(0);
    const expected = Math.min(pageAt, Math.max(0, limit));
    expect(Math.abs((await scrollY(page)) - expected)).toBeLessThanOrEqual(1);
  });
}

test("focus stays where it is when the focused control is still on screen, and is not taken back from elsewhere when ? leaves", async ({ page }) => {
  let commands = 0;
  await openPage(page, { read: () => success(savedState()), command: route => {
    commands += 1;
    return fulfill(route, success(commands === 1 ? savedState(3) : { ...savedState(4), pendingTurn: true }));
  } });
  await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
  await composer(page).fill("A synthetic message for this test.");
  const held = await holdNextRequest(page, COMMANDS_URL);
  await sendButton(page).click();
  await held.arrived;
  await reloadHelpButton(page).focus();
  held.release();
  await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
  await expect(reloadHelpButton(page)).toBeFocused();
  // Focus the Explorer moved elsewhere is not taken back when "?" later leaves: a second Send is held, focus
  // goes from "?" to Privacy and sharing, and the answer (a pending result) then removes "?".
  await composer(page).fill("A second synthetic message for this test.");
  const second = await holdNextRequest(page, COMMANDS_URL);
  await sendButton(page).click();
  await second.arrived;
  await reloadHelpButton(page).focus();
  await expect(reloadHelpButton(page)).toBeFocused();
  await privacyButton(page).focus();
  await expect(privacyButton(page)).toBeFocused();
  second.release();
  await expect(savedStatus(page)).toHaveText(RELOAD_NEEDED);
  await expect(reloadHelpButton(page)).toHaveCount(0);
  await expect(reloadButton(page)).toBeEnabled();
  await expect(privacyButton(page)).toBeFocused();
});

// A press on blank space that takes no focus: the Explorer left the control on purpose (REV491b).
const blankSpace = (page: Page) => page.getByText("Private conversation", { exact: true });
const nothingFocused = (page: Page) => page.evaluate(() => document.activeElement === document.body);

test("focus left on purpose by a press on blank space is not reclaimed when ? then leaves", async ({ page }) => {
  await openPage(page, { read: () => success(savedState()), command: route => fulfill(route, success({ ...savedState(3), pendingTurn: true })) });
  await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
  await composer(page).fill("A synthetic message for this test.");
  const held = await holdNextRequest(page, COMMANDS_URL);
  await sendButton(page).click();
  await held.arrived;
  await reloadHelpButton(page).focus();
  await expect(reloadHelpButton(page)).toBeFocused();
  await blankSpace(page).click();
  await expect(reloadHelpButton(page)).not.toBeFocused();
  expect(await nothingFocused(page)).toBe(true);
  held.release();
  await expect(savedStatus(page)).toHaveText(RELOAD_NEEDED);
  await expect(reloadHelpButton(page)).toHaveCount(0);
  await expect(reloadButton(page)).toBeEnabled();
  // Reload is the control the rule would have chosen; it must not take focus now.
  await expect(reloadButton(page)).not.toBeFocused();
  expect(await nothingFocused(page)).toBe(true);
});

test("focus left on purpose by a press on blank space is not reclaimed when the title then moves into the band", async ({ page }) => {
  await page.route(COMMANDS_URL, noCommand);
  await page.route(STATE_URL, route => fulfill(route, success(savedState())));
  const held = await holdNextRequest(page, STATE_URL);
  await page.goto("/explorer/conversation");
  await held.arrived;
  await expect(page.locator("[data-conversation-strip] h1#conversation-preview-heading")).toBeFocused();
  await blankSpace(page).click();
  await expect(title(page)).not.toBeFocused();
  expect(await nothingFocused(page)).toBe(true);
  held.release();
  await expect(page.locator("[data-chat-panel-band] h1#conversation-preview-heading")).toHaveCount(1);
  await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
  await expect(title(page)).not.toBeFocused();
  expect(await nothingFocused(page)).toBe(true);
});

test("Reload chosen by keyboard and refused for sign-in: focus moves to Sign in", async ({ page }) => {
  let read: () => unknown = () => success(savedState());
  await openPage(page, { read: () => read(), command: noCommand });
  await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
  read = () => failure("denied");
  await reloadButton(page).focus();
  await page.keyboard.press("Enter");
  await expect(signInLink(page)).toBeVisible();
  await expect(reloadButton(page)).toHaveCount(0);
  await expect(signInLink(page)).toBeFocused();
});

// Retry leaves the screen as soon as it is chosen. Focus waits on the title while the request runs and moves
// on when its answer arrives (REV486 finding 6).
// The message box focus waits two frames after a reply is shown before it moves; a check made earlier would pass
// before the move.
const twoFrames = (page: Page) =>
  page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
const retryCases = [
  { name: "not confirmed again", answer: (route: Route) => malformed(route), target: "retry" },
  { name: "refused for sign-in", answer: (route: Route) => fulfill(route, failure("denied")), target: "signIn" },
  { name: "answered with a pending result", answer: (route: Route) => fulfill(route, success({ ...savedState(3), pendingTurn: true })), target: "reload" },
  { name: "answered that the conversation has changed", answer: (route: Route) => fulfill(route, failure("refresh_required")), target: "reload" },
  { name: "confirmed", answer: (route: Route) => fulfill(route, success(savedState(3))), target: "title" },
] as const;

for (const each of retryCases) {
  test(`Retry by keyboard, ${each.name}: focus waits on the title, then goes where the Explorer needs it`, async ({ page }) => {
    let commands = 0;
    await openPage(page, { read: () => success(savedState()), command: route => { commands += 1; return commands === 1 ? malformed(route) : each.answer(route); } });
    await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
    await typeAndSend(page);
    await expect(retryButton(page)).toBeVisible();
    await retryButton(page).focus();
    const held = await holdNextRequest(page, COMMANDS_URL);
    await page.keyboard.press("Enter");
    await held.arrived;
    // Retry is gone while its request runs, Reload is disabled: focus waits on the title.
    await expect(retryButton(page)).toHaveCount(0);
    await expect(reloadButton(page)).toBeDisabled();
    await expect(title(page)).toBeFocused();
    held.release();
    if (each.target === "title") {
      await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
      // No exception for a Retry chosen by keyboard: the reply takes focus to the message box.
      await twoFrames(page);
      await expect(composer(page)).toBeFocused();
    } else {
      await expect(focusTarget(page, each.target)).toBeFocused();
    }
    await expect(page.locator("h1")).toHaveCount(1);
  });
}

test("Retry by pointer, confirmed: focus waits on the title, then the reply takes it to the message box", async ({ page }) => {
  let commands = 0;
  await openPage(page, { read: () => success(savedState()), command: route => { commands += 1; return commands === 1 ? malformed(route) : fulfill(route, success(savedState(3))); } });
  await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
  await typeAndSend(page);
  await expect(retryButton(page)).toBeVisible();
  const held = await holdNextRequest(page, COMMANDS_URL);
  await retryButton(page).click();
  await held.arrived;
  await expect(retryButton(page)).toHaveCount(0);
  await expect(title(page)).toBeFocused();
  held.release();
  await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
  await twoFrames(page);
  await expect(composer(page)).toBeFocused();
  await expect(page.locator("h1")).toHaveCount(1);
});

test("keyboard order: the title holds focus after the open, Tab goes to the conversation, Shift+Tab reaches the strip's controls", async ({ page }) => {
  await openPage(page, { read: () => success(savedState()), command: noCommand });
  await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
  await expect(title(page)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(transcript(page)).toBeFocused();
  await title(page).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(reloadHelpButton(page)).toBeFocused();
  await expect(reloadHelpButton(page)).toHaveCSS("outline-width", "2px");
  await page.keyboard.press("Shift+Tab");
  await expect(reloadButton(page)).toBeFocused();
  await expect(reloadButton(page)).toHaveCSS("outline-width", "2px");
  await page.keyboard.press("Shift+Tab");
  await expect(privacyButton(page)).toBeFocused();
  await expect(privacyButton(page)).toHaveCSS("outline-width", "2px");
  // "Skip to the conversation" still lands on the title.
  await page.getByRole("button", { name: "Skip to the conversation", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(title(page)).toBeFocused();
});

test("the start marker is in view in a new conversation and stands before the oldest message in a long one", async ({ page }) => {
  let read: () => unknown = () => success(newState());
  await openPage(page, { read: () => read(), command: noCommand });
  await expect(page.getByText("There are no saved messages yet.", { exact: true })).toBeVisible();
  const marker = page.locator("[data-conversation-start]");
  await expect(marker).toHaveCount(1);
  await expect(marker).toHaveText(START);
  await expect(marker).toBeVisible();
  // Above the welcome, inside the transcript.
  const markerBox = await marker.boundingBox();
  const welcomeBox = await page.locator("[data-opening-greeting]").boundingBox();
  expect(markerBox!.y + markerBox!.height).toBeLessThanOrEqual(welcomeBox!.y);
  await expect(transcript(page).locator("[data-conversation-start]")).toHaveCount(1);
  await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
  // The transcript is at its top, the page is at its top, and the marker is inside the visible part of the
  // transcript and inside the window.
  expect(await transcriptTop(page)).toBe(0);
  expect(await scrollY(page)).toBe(0);
  const newPlace = await page.evaluate(() => {
    const box = document.querySelector('[role="log"]')!.getBoundingClientRect();
    const mark = document.querySelector("[data-conversation-start]")!.getBoundingClientRect();
    return { insideTranscript: mark.top >= box.top && mark.bottom <= box.bottom,
      insideWindow: mark.top >= 0 && mark.bottom <= window.innerHeight && mark.left >= 0 && mark.right <= window.innerWidth };
  });
  expect(newPlace).toEqual({ insideTranscript: true, insideWindow: true });
  await expect(marker).toBeInViewport({ ratio: 0.99 });
  await expect(page.locator("[data-opening-greeting]")).toBeInViewport();
  // A long saved conversation opens at its newest messages; the marker is reached by scrolling the transcript up.
  read = () => success(savedState(20));
  await reloadAndExpect(page, UP_TO_DATE);
  await expect(marker).toHaveCount(1);
  await expect.poll(async () => transcript(page).evaluate(box => Math.round(box.scrollHeight - box.clientHeight - box.scrollTop))).toBeLessThanOrEqual(2);
  const hiddenAbove = await page.evaluate(() => {
    const box = document.querySelector('[role="log"]')!.getBoundingClientRect();
    const mark = document.querySelector("[data-conversation-start]")!.getBoundingClientRect();
    return mark.bottom <= box.top;
  });
  expect(hiddenAbove).toBe(true);
  await transcript(page).evaluate(box => { box.scrollTop = 0; });
  const first = transcript(page).getByRole("listitem").first();
  const position = await page.evaluate(() => {
    const box = document.querySelector('[role="log"]')!.getBoundingClientRect();
    const mark = document.querySelector("[data-conversation-start]")!.getBoundingClientRect();
    return { inside: mark.top >= box.top && mark.bottom <= box.bottom, bottom: mark.bottom };
  });
  expect(position.inside).toBe(true);
  expect(position.bottom).toBeLessThanOrEqual((await first.boundingBox())!.y + 1);
});

// The narrowest conversation cards: 1024 px wide with the Compass panel open, and just below the breakpoint
// (REV486 finding 9). The project's own sizes (1280 and 390 px) run every other test in this file.
for (const width of [1024, 1023, 768, 390, 320] as const) {
  test(`at ${width} px wide the strip wraps without sideways scroll, in the green, yellow and could-not-load states`, async ({ page }) => {
    test.skip(test.info().project.name !== "desktop-chromium", "sized inside the test; one project is enough");
    await page.setViewportSize({ width, height: 800 });
    let read: () => unknown = () => success(savedState());
    await openPage(page, { read: () => read(), command: noCommand });
    await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
    const card = page.locator("section[aria-labelledby='conversation-preview-heading']");
    const insideCard = async (name: string) => {
      const outer = await card.boundingBox();
      for (const control of [privacyButton(page), reloadButton(page), savedStatus(page)]) {
        const box = await control.boundingBox();
        // The status region has no box while it is empty.
        if (box === null) continue;
        expect(box.x, name).toBeGreaterThanOrEqual(outer!.x);
        expect(box.x + box.width, name).toBeLessThanOrEqual(outer!.x + outer!.width + 0.5);
      }
      await expectNoSidewaysScroll(page);
    };
    await insideCard("green");
    await reloadHelpButton(page).click();
    await expect(reloadHelpLine(page)).toBeVisible();
    await insideCard("help open");
    await privacyButton(page).click();
    await expect(privacyExplanation(page)).toBeVisible();
    await expect(reloadHelpLine(page)).toBeHidden();
    await insideCard("privacy open");
    // The focus ring is drawn for keyboard focus (the button was last reached by pointer, which draws none):
    // Tab to Reload and back.
    await page.keyboard.press("Tab");
    await expect(reloadButton(page)).toBeFocused();
    await expect(reloadButton(page)).toHaveCSS("outline-width", "2px");
    await page.keyboard.press("Shift+Tab");
    await expect(privacyButton(page)).toBeFocused();
    await expect(privacyButton(page)).toHaveCSS("outline-width", "2px");
    read = () => success({ ...savedState(3), pendingTurn: true });
    await reloadAndExpect(page, RELOAD_NEEDED);
    await expect(reloadHelpLine(page)).toBeVisible();
    await expect(reloadHelpLine(page)).toHaveText(REASON_PENDING);
    await expect(privacyExplanation(page)).toBeVisible();
    await insideCard("yellow with privacy open");
    read = () => failure("unavailable");
    await reloadAndExpect(page, "");
    await expect(reloadHelpLine(page)).toHaveText(REASON_LOAD);
    await insideCard("could not be loaded");
  });
}

test("the chat panel carries the decided colours: the warmer panel, the band and the message box area", async ({ page }) => {
  await openPage(page, { read: () => success(savedState()), command: noCommand });
  await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
  await expect(page.locator("[data-chat-panel]")).toHaveCSS("background-color", "rgb(18, 16, 11)");
  await expect(page.locator("[data-chat-panel-band]")).toHaveCSS("background-color", "rgb(41, 36, 18)");
  await expect(page.locator("[data-composer-bar]")).toHaveCSS("background-color", "rgb(18, 16, 11)");
  // The band stays in place while the messages scroll.
  const bandAt = (await page.locator("[data-chat-panel-band]").boundingBox())!.y;
  await transcript(page).evaluate(box => { box.scrollTop = 0; });
  expect((await page.locator("[data-chat-panel-band]").boundingBox())!.y).toBe(bandAt);
  // The transcript, the message box and the title band are inside the panel; End Session is outside it.
  await expect(page.locator("[data-chat-panel]").getByRole("log")).toHaveCount(1);
  await expect(page.locator("[data-chat-panel]").getByLabel("Continue the conversation", { exact: true })).toHaveCount(1);
  await expect(page.locator("[data-chat-panel]").getByRole("heading", { name: "End Session", exact: true })).toHaveCount(0);
});

// GPT-6 Astra review REV558, finding 1: while Reload works it stays focusable (aria-disabled, never the native
// disabled attribute, which makes some browsers drop keyboard focus to the page), and using it again does nothing.
test("Reload chosen by keyboard keeps keyboard focus while it works and afterwards; pressing it again while it works asks nothing", async ({ page }) => {
  let reads = 0;
  const problems = await openPage(page, { read: () => { reads += 1; return success(savedState()); }, command: noCommand });
  await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
  const readsAtOpen = reads;
  await reloadButton(page).focus();
  const held = await holdNextRequest(page, STATE_URL);
  await page.keyboard.press("Enter");
  await held.arrived;
  await expect(savedStatus(page)).toHaveText(RELOAD_CHECKING);
  // Still the focused element, still in the tab order, and announced as unavailable.
  await expect(reloadButton(page)).toBeFocused();
  await expect(reloadButton(page)).toHaveAttribute("aria-disabled", "true");
  await expect(reloadButton(page)).toBeDisabled();
  expect(await reloadButton(page).evaluate(button => ({ native: (button as HTMLButtonElement).disabled, active: document.activeElement === button })))
    .toEqual({ native: false, active: true });
  // Used again while it works: no second request (it would reach the test's own route at once).
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await reloadButton(page).evaluate(button => (button as HTMLButtonElement).click());
  await expect(savedStatus(page)).toHaveText(RELOAD_CHECKING);
  expect(reads).toBe(readsAtOpen);
  held.release();
  await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
  await expect(reloadButton(page)).toBeFocused();
  await expect(reloadButton(page)).toBeEnabled();
  expect(await reloadButton(page).evaluate(button => button.hasAttribute("aria-disabled") || (button as HTMLButtonElement).disabled)).toBe(false);
  expect(reads).toBe(readsAtOpen + 1);
  // It works again afterwards, by keyboard.
  await page.keyboard.press("Enter");
  await expect.poll(() => reads).toBe(readsAtOpen + 2);
  await expect(savedStatus(page)).toHaveText(UP_TO_DATE);
  await expect(reloadButton(page)).toBeFocused();
  expect(problems).toEqual([]);
});
