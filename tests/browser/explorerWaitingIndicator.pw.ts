// REV424: synthetic responses prove the waiting display in both browser projects.
// Authored only; the Executor runs this suite. No provider or real conversation is used.
import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

import type { ExplorerConversationState } from "../../src/lib/solmind/explorerConversationContract";
import type { ExplorerPrivateAssistance } from "../../src/lib/solmind/explorerPrivateConversationResponse";
import { automaticId, automaticState } from "./automaticCompassFixture";
import { expectNoSidewaysScroll } from "./conversationPreviewHelpers";

test.use({ trace: "off", screenshot: "off", video: "off" });

const WAITING_TEXT = "Waiting for your Virtual Guide's reply...";
const TYPED_MESSAGE = "An invented message while the browser test waits.";
const REPLY = "An invented reply after the browser test releases the request.";
const FAILURE = "The invented reply did not come through. The browser test can try again.";
const composer = (page: Page) => page.getByLabel("Continue the conversation", { exact: true });
const indicator = (page: Page) => page.locator("[data-waiting-indicator]");
const transcript = (page: Page) => page.getByRole("list", { name: "Saved conversation", exact: true });

const fulfill = (route: Route, state: ExplorerConversationState, assistance: ExplorerPrivateAssistance | null = null) =>
  route.fulfill({ json: {
    version: "explorer-private-conversation-response.v1", result: { ok: true, state, error: null }, assistance,
  } });

function afterSend(state: ExplorerConversationState, body: string, withReply = true): ExplorerConversationState {
  const sent: ExplorerConversationState["messages"][number] = {
    id: automaticId(104), role: "explorer", body, createdAt: "2026-11-13T12:02:00.000Z",
  };
  const reply: ExplorerConversationState["messages"][number] = {
    id: automaticId(105), role: "virtualGuide", body: REPLY, createdAt: "2026-11-13T12:02:01.000Z",
  };
  return { ...state, revision: state.revision + 2, messages: [...state.messages, sent, ...(withReply ? [reply] : [])] };
}

async function open(page: Page, state: ExplorerConversationState) {
  let receive: (route: Route) => void = () => {};
  const command = new Promise<Route>(resolve => { receive = resolve; });
  await page.route("**/explorer/conversation/state", route => fulfill(route, state));
  await page.route("**/explorer/conversation/commands", route => { receive(route); });
  await page.goto("/explorer/conversation");
  await expect(composer(page)).toBeEnabled();
  await expect(indicator(page)).toHaveCount(0);
  await expect(page.locator("[data-waiting-announcement]")).toHaveCount(1);
  await expect(page.locator("[data-waiting-announcement]")).toBeEmpty();
  return { command };
}

async function expectWaiting(page: Page) {
  const row = indicator(page);
  await expect(row).toHaveCount(1);
  await expect(row).toBeVisible();
  await expect(row).toHaveText(WAITING_TEXT);
  await expect(row.getByRole("status")).toHaveCount(0);
  await expect(row.locator("svg")).toHaveAttribute("aria-hidden", "true");
  await expect(row.locator("svg")).toHaveAttribute("focusable", "false");
  await expect(page.getByText("Checking your change...", { exact: true })).toHaveCount(0);
  const announcement = page.getByRole("status").filter({ hasText: WAITING_TEXT });
  await expect(announcement).toHaveCount(1);
  await expect(announcement).toHaveAttribute("aria-atomic", "true");
  expect(await announcement.evaluate(element => element.closest('[aria-busy="true"]') === null)).toBe(true);
}

test("a typed Send shows the exact waiting row after the messages until the reply arrives", async ({ page }) => {
  type ObservedWindow = Window & { waitingAnnouncementObservation?: {
    node: Element; observer: MutationObserver; nonempty: string[];
  } };
  const state = automaticState(1);
  const pending = await open(page, state);
  await page.evaluate(() => {
    const node = document.querySelector("[data-waiting-announcement]")!;
    const nonempty: string[] = [];
    const observer = new MutationObserver(records => records.forEach(() => {
      const value = node.textContent ?? "";
      if (value !== "") nonempty.push(value);
    }));
    observer.observe(node, { childList: true, characterData: true, subtree: true });
    (window as ObservedWindow).waitingAnnouncementObservation = { node, observer, nonempty };
  });
  const observedAnnouncement = () => page.evaluate(() => {
    const observed = (window as ObservedWindow).waitingAnnouncementObservation!;
    return { sameNode: observed.node === document.querySelector("[data-waiting-announcement]"),
      text: observed.node.textContent, nonempty: observed.nonempty };
  });
  await composer(page).fill(TYPED_MESSAGE);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const route = await pending.command;
  expect(route.request().postDataJSON()).toMatchObject({ kind: "send", body: TYPED_MESSAGE });
  await expectWaiting(page);
  await expect(transcript(page).getByRole("listitem")).toHaveCount(2);
  expect(await indicator(page).evaluate(element => {
    const log = element.closest('[role="log"][aria-label="Conversation transcript"]');
    const last = log?.querySelector('ol[aria-label="Saved conversation"] > li:last-child');
    return !!last && !!(last.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  expect(await indicator(page).locator("svg").evaluate(element => {
    const box = element.getBoundingClientRect();
    return { width: box.width, height: box.height, overflow: getComputedStyle(element).overflow };
  })).toEqual({ width: 40, height: 40, overflow: "visible" });
  await expectNoSidewaysScroll(page);
  const buildNotes = page.getByRole("button", { name: "Build notes", exact: true });
  await expect(buildNotes).toHaveAttribute("aria-pressed", "true");
  await buildNotes.click();
  await expect(buildNotes).toHaveAttribute("aria-pressed", "false");
  expect(await observedAnnouncement()).toEqual({ sameNode: true, text: WAITING_TEXT, nonempty: [WAITING_TEXT] });
  await buildNotes.click();
  await expect(buildNotes).toHaveAttribute("aria-pressed", "true");
  expect(await observedAnnouncement()).toEqual({ sameNode: true, text: WAITING_TEXT, nonempty: [WAITING_TEXT] });
  await fulfill(route, afterSend(state, TYPED_MESSAGE));
  await expect(transcript(page)).toContainText(REPLY);
  await expect(indicator(page)).toHaveCount(0);
  await expect(page.locator("[data-waiting-announcement]")).toBeEmpty();
  await expect(page.getByRole("status").filter({ hasText: WAITING_TEXT })).toHaveCount(0);
  await expect(composer(page)).toHaveValue("");
  expect(await observedAnnouncement()).toEqual({ sameNode: true, text: "", nonempty: [WAITING_TEXT] });
  await page.evaluate(() => {
    const observedWindow = window as ObservedWindow;
    observedWindow.waitingAnnouncementObservation!.observer.disconnect();
    delete observedWindow.waitingAnnouncementObservation;
  });
});

test("a reported failed reply removes the waiting row and keeps the typed message", async ({ page }) => {
  const state = automaticState(1);
  const pending = await open(page, state);
  await composer(page).fill(TYPED_MESSAGE);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const route = await pending.command;
  await expectWaiting(page);
  await fulfill(route, afterSend(state, TYPED_MESSAGE, false), { kind: "reply_failed", body: FAILURE, persisted: false });
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(FAILURE);
  await expect(indicator(page)).toHaveCount(0);
  await expect(page.locator("[data-waiting-announcement]")).toBeEmpty();
  await expect(page.getByRole("status").filter({ hasText: WAITING_TEXT })).toHaveCount(0);
  await expect(composer(page)).toHaveValue(TYPED_MESSAGE);
});

test("a reply-choice tap shows the waiting row for its Send", async ({ page }) => {
  const label = "An invented next step";
  const initial = automaticState(1);
  const state: ExplorerConversationState = { ...initial, messages: initial.messages.map((message, index) =>
    index === initial.messages.length - 1 ? { ...message, choices: [{ label }] } : message) };
  const pending = await open(page, state);
  await composer(page).fill(TYPED_MESSAGE);
  await page.getByRole("group", { name: "Suggested replies", exact: true }).getByRole("button", { name: label, exact: true }).click();
  const route = await pending.command;
  expect(route.request().postDataJSON()).toMatchObject({ kind: "send", body: label, replyChoice: true });
  await expectWaiting(page);
  await fulfill(route, afterSend(state, label));
  await expect(transcript(page)).toContainText(REPLY);
  await expect(indicator(page)).toHaveCount(0);
  await expect(composer(page)).toHaveValue(TYPED_MESSAGE);
});

const runningAnimations = (svg: Locator) => svg.evaluate(element =>
  element.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length);
const frame = (svg: Locator) => svg.evaluate(element => Array.from(element.querySelectorAll("*")).map(child => {
  const style = getComputedStyle(child);
  return { transform: style.transform, opacity: style.opacity, animation: style.animationName };
}));

test("reduced motion has no running animation and switching it on restores the same still frame", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const state = automaticState(1);
  const pending = await open(page, state);
  await composer(page).fill(TYPED_MESSAGE);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const route = await pending.command;
  await expectWaiting(page);
  const svg = indicator(page).locator("svg");
  await expect.poll(() => runningAnimations(svg)).toBe(0);
  const still = await frame(svg);
  expect(still.every(layer => layer.animation === "none")).toBe(true);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => runningAnimations(svg)).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => runningAnimations(svg)).toBe(0);
  expect(await frame(svg)).toEqual(still);
  await expectWaiting(page);
  await fulfill(route, afterSend(state, TYPED_MESSAGE));
  await expect(indicator(page)).toHaveCount(0);
});
