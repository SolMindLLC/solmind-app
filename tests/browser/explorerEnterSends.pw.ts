// Part 2 of Paul's screen wording, approved 2026-11-12: Enter sends.
// Mocked private-response endpoints prove mounted keyboard behaviour only;
// they prove no authentication, SQL persistence, provider call or genuine AI reply.
import { expect, test, type Page } from "@playwright/test";
import { COMMANDS_URL, holdNextRequest, privacyButton } from "./compactHeaderHelpers";

import {
  EXPLORER_CONVERSATION_VERSION,
  type ExplorerConversationState,
} from "../../src/lib/solmind/explorerConversationContract";

test.use({ trace: "off", screenshot: "off", video: "off" });

const CONVERSATION = "10000000-0000-4000-8000-000000000001";
const HINT = "To send your message, press Enter. To start a new line, press Shift+Enter or Alt+Enter.";
const message = (index: number, role: "explorer" | "virtualGuide", body: string) => ({
  id: `${role === "explorer" ? "2" : "3"}0000000-0000-4000-8000-00000000000${index}`,
  role,
  body,
  createdAt: `2026-10-30T14:0${index}:00.000Z`,
});
const savedState = (): ExplorerConversationState => ({ waypointCapacity: { activeCount: 0, activeLimit: 20, historyRoom: true, conversationRoom: true }, waypointProjection: { kind: "current_heads" as const, limit: 20 as const, totalHeads: 0, hasMore: false },
  version: EXPLORER_CONVERSATION_VERSION, conversationId: CONVERSATION, revision: 2, pendingTurn: false, turnedDownLimitReached: false, waypointDraft: null,
  providerState: "available", compassItems: [], priorityId: null, attentionId: null, waypoints: [], route: [],
  sessionStatus: "active", ending: null,
  messages: [
    message(1, "explorer", "A synthetic saved message for the keyboard test."),
    message(2, "virtualGuide", "A synthetic saved reply for the keyboard test."),
  ],
});
const success = (state: ExplorerConversationState) => ({
  version: "explorer-private-conversation-response.v1", result: { ok: true, state, error: null }, assistance: null,
});

async function open(page: Page, state: ExplorerConversationState, afterSend: ExplorerConversationState = state) {
  const commands: unknown[] = [];
  await page.route("**/explorer/conversation/state", route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(state)) }));
  await page.route("**/explorer/conversation/commands", route => {
    commands.push(route.request().postDataJSON());
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(afterSend)) });
  });
  await page.goto("/explorer/conversation");
  await expect(page.getByRole("heading", { level: 1, name: "Your conversation", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeEnabled();
  return commands;
}

test("Enter sends a typed message through one command request", async ({ page }) => {
  const body = "A synthetic typed message sent with Enter.";
  const state = savedState();
  const afterSend: ExplorerConversationState = {
    ...state, revision: 4,
    messages: [...state.messages, message(3, "explorer", body), message(4, "virtualGuide", "A synthetic reply after Enter.")],
  };
  const commands = await open(page, state, afterSend);
  const field = page.getByLabel("Continue the conversation", { exact: true });
  await field.fill(body);
  await field.press("Enter");
  await expect(page.getByRole("list", { name: "Saved conversation", exact: true }).getByRole("listitem")).toHaveCount(4);
  await expect(field).toHaveValue("");
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeEnabled();
  expect(commands).toEqual([{ kind: "send", body, operationId: expect.any(String), expectedRevision: state.revision }]);
});

test("Shift+Enter starts a new line and sends no command", async ({ page }) => {
  const commands = await open(page, savedState());
  const field = page.getByLabel("Continue the conversation", { exact: true });
  const draft = "A synthetic draft kept for another line.";
  await field.fill(draft);
  await field.press("Shift+Enter");
  await expect(field).toHaveValue(`${draft}\n`);
  expect(commands).toEqual([]);
});

test("Alt+Enter replaces the selection with a new line, keeps the caret, and sends no command", async ({ page }) => {
  const commands = await open(page, savedState());
  const field = page.getByLabel("Continue the conversation", { exact: true });
  const before = "A synthetic";
  const selected = " selected";
  const after = " draft.";
  await field.fill(before + selected + after);
  await field.evaluate((element, selection) => {
    (element as HTMLTextAreaElement).setSelectionRange(selection.start, selection.end);
  }, { start: before.length, end: before.length + selected.length });
  await field.press("Alt+Enter");
  await expect(field).toHaveValue(`${before}\n${after}`);
  await page.keyboard.type("new");
  await expect(field).toHaveValue(`${before}\nnew${after}`);
  expect(commands).toEqual([]);
});

test("Enter in an empty box keeps the browser's new line and sends no command", async ({ page }) => {
  const commands = await open(page, savedState());
  const field = page.getByLabel("Continue the conversation", { exact: true });
  await expect(field).toHaveValue("");
  await field.press("Enter");
  await expect(field).toHaveValue("\n");
  expect(commands).toEqual([]);
});

test("the available composer shows the exact approved hint", async ({ page }) => {
  const commands = await open(page, savedState());
  const hint = page.getByText(HINT, { exact: true });
  await expect(hint).toHaveCount(1);
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText(HINT);
  expect(commands).toEqual([]);
});

const composer = (page: Page) => page.getByLabel("Continue the conversation", { exact: true });
const log = (page: Page) => page.getByRole("log", { name: "Conversation transcript", exact: true });
const focusReply = "A new reply about the next step.";
const focusMessage = "A message about the next step.";
function withReply(state: ExplorerConversationState): ExplorerConversationState {
  return { ...state, revision: state.revision + 2, messages: [...state.messages,
    message(3, "explorer", focusMessage), message(4, "virtualGuide", focusReply)] };
}

async function startSend(page: Page, state = savedState()) {
  await open(page, state, withReply(state));
  const held = await holdNextRequest(page, COMMANDS_URL);
  await composer(page).fill(focusMessage);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await held.arrived;
  await expect(composer(page)).toBeDisabled();
  return held;
}

async function replyShown(page: Page) {
  // A native modal can hide the background log from the accessibility tree.
  await expect(page.locator('[role="log"]').getByText(focusReply, { exact: true })).toBeAttached();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

test("the new Guide reply is already in the live log when desktop focus returns to the box", async ({ page }) => {
  const held = await startSend(page);
  await composer(page).evaluate((field, reply) => {
    field.addEventListener("focus", () => {
      const log = document.querySelector('[role="log"]');
      field.dataset.replyReady = String(!!log?.textContent?.includes(reply) &&
        !log.closest('[aria-busy="true"], [aria-live="off"]'));
    }, { once: true });
  }, focusReply);
  held.release();
  await expect(composer(page)).toBeFocused();
  await expect(composer(page)).toHaveAttribute("data-reply-ready", "true");
});

for (const [device, width] of [["phone", 390], ["tablet", 820]] as const) {
  test.describe(device, () => {
    test.use({ hasTouch: true, viewport: { width, height: 844 } });
    test("a reply leaves the message box unfocused", async ({ page }) => {
      const held = await startSend(page);
      expect(await page.evaluate(() => matchMedia("(hover: none) and (pointer: coarse)").matches)).toBe(true);
      held.release();
      await replyShown(page);
      await expect(composer(page)).not.toBeFocused();
    });
  });
}

test("a tablet with a fine primary pointer, hover and a touch screen leaves the box unfocused", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 844 });
  await page.addInitScript(() => {
    const matchMedia = window.matchMedia.bind(window);
    // Keep the desktop primary pointer and add a touch screen as a second pointer.
    window.matchMedia = query => matchMedia(query.replace("(any-pointer: coarse)", "(any-pointer: fine)"));
    Object.defineProperty(navigator, "maxTouchPoints", { value: 5 });
  });
  const held = await startSend(page);
  expect(await page.evaluate(() =>
    matchMedia("(hover: hover) and (pointer: fine) and (any-pointer: coarse)").matches)).toBe(true);
  held.release();
  await replyShown(page);
  await expect(composer(page)).not.toBeFocused();
});

test("clicking the conversation heading during Send keeps focus there after the reply", async ({ page }) => {
  const held = await startSend(page);
  const heading = page.getByRole("heading", { level: 1, name: "Your conversation", exact: true });
  await heading.click();
  await expect(heading).toBeFocused();
  held.release();
  await replyShown(page);
  await expect(heading).toBeFocused();
});

test("focusing the transcript directly during Send keeps focus there until typing begins", async ({ page }) => {
  const held = await startSend(page);
  await log(page).focus();
  held.release();
  await replyShown(page);
  await expect(log(page)).toBeFocused();
  await page.keyboard.type("a");
  await expect(composer(page)).toBeFocused();
  await expect(composer(page)).toHaveValue("a");
});

test("a control visited since Send wins for that reply even after focus returns to the transcript", async ({ page }) => {
  const held = await startSend(page);
  await privacyButton(page).focus();
  await log(page).focus();
  held.release();
  await replyShown(page);
  await expect(log(page)).toBeFocused();

  const state = withReply(savedState());
  const secondMessage = "Another message.";
  const secondReply = "Another Guide reply.";
  await page.route(COMMANDS_URL, route => route.fulfill({ json: success({ ...state, revision: state.revision + 2,
    messages: [...state.messages, message(5, "explorer", secondMessage), message(6, "virtualGuide", secondReply)] }) }));
  await composer(page).fill(secondMessage);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(log(page)).toContainText(secondReply);
  await expect(composer(page)).toBeFocused();
});

test("a reply preserves focus and typing in another field", async ({ page }) => {
  const held = await startSend(page);
  const field = await log(page).evaluateHandle(element => element.appendChild(document.createElement("input")));
  await field.focus();
  held.release();
  await replyShown(page);
  await page.keyboard.type("abc");
  expect(await field.inputValue()).toBe("abc");
  await expect(composer(page)).toHaveValue("");
});

test("the first background or transcript letter enters the box and typing continues there", async ({ page }) => {
  await open(page, savedState());
  await page.getByText("Private conversation", { exact: true }).click();
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await page.keyboard.type("Ab");
  await expect(composer(page)).toBeFocused();
  await expect(composer(page)).toHaveValue("Ab");
  await log(page).focus();
  await page.keyboard.type("cd");
  await expect(composer(page)).toHaveValue("Abcd");
  await expect(composer(page)).toBeFocused();
});

test("slash, navigation and modified keys retain their browser defaults on the transcript", async ({ page }) => {
  await open(page, savedState());
  await page.evaluate(() => window.addEventListener("keydown", event => {
    document.body.dataset.keyCancelled = String(event.defaultPrevented);
  }));
  for (const key of ["/", "Control+b", "Alt+b", "Meta+b", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "PageUp", "PageDown", "Home", "End", "Space", "Enter", "Escape", "Tab"]) {
    await log(page).focus();
    await page.keyboard.press(key);
    await expect(page.locator("body"), key).toHaveAttribute("data-key-cancelled", "false");
    await expect(composer(page), key).toHaveValue("");
    if (key !== "Tab") await expect(log(page), key).toBeFocused();
  }
});

test("letters on buttons, links, editable text and other controls stay with the control", async ({ page }) => {
  await open(page, savedState());
  await log(page).evaluate(element => {
    const controls = document.createElement("div");
    controls.id = "focus-test-controls";
    controls.innerHTML = '<a href="#next">Next</a><span contenteditable="true"></span><span role="checkbox" tabindex="0"></span>';
    element.appendChild(controls);
  });
  for (const control of [privacyButton(page), ...await page.locator("#focus-test-controls > *").all()]) {
    await control.focus();
    await page.keyboard.type("a");
    await expect(control).toBeFocused();
    await expect(composer(page)).toHaveValue("");
  }
  await expect(page.locator("#focus-test-controls [contenteditable]")).toHaveText("a");
});

test("the open tour keeps focus and letters when the first reply arrives", async ({ page }) => {
  const held = await startSend(page, { ...savedState(), messages: [] });
  await page.getByRole("button", { name: "Show me around", exact: true }).click();
  const title = page.getByRole("dialog").getByRole("heading", { name: "A look around your conversation" });
  await expect(title).toBeFocused();
  held.release();
  await replyShown(page);
  await page.keyboard.type("a");
  await expect(title).toBeFocused();
  await expect(composer(page)).toHaveValue("");
});

test("End Session review keeps focus and letters when opened as the Send reply arrives", async ({ page }) => {
  const held = await startSend(page);
  const opener = page.getByRole("button", { name: "End this conversation", exact: true });
  await expect(opener).toBeDisabled();
  await composer(page).evaluate(field => field.addEventListener("focus", () => {
    field.dataset.tookFocus = "true";
  }, { once: true }));
  // End becomes available with the reply. Open the review before the deferred composer focus runs.
  await opener.evaluate(element => {
    const button = element as HTMLButtonElement;
    const observer = new MutationObserver(() => {
      if (button.disabled) return;
      observer.disconnect();
      button.click();
    });
    observer.observe(button, { attributes: true, attributeFilter: ["disabled"] });
  });
  held.release();
  await replyShown(page);
  const review = page.getByRole("group", { name: "Review End Session", exact: true });
  await expect(review).toBeFocused();
  await expect(composer(page)).not.toHaveAttribute("data-took-focus", "true");
  await page.keyboard.type("a");
  await expect(review).toBeFocused();
  await expect(composer(page)).toHaveValue("");
});

for (const kind of ["dialog", "alertdialog"] as const) {
  test(`an open ${kind} keeps the reply and printable keys from drawing focus away`, async ({ page }) => {
    const held = await startSend(page);
    // Open a nonmodal dialog without moving focus. This isolates the open-dialog
    // rule from both focus tracking and the browser's native modal focus trap.
    await page.evaluate(role => {
      const dialog = role === "dialog" ? document.createElement("dialog") : document.createElement("div");
      if (dialog instanceof HTMLDialogElement) dialog.open = true;
      else dialog.setAttribute("role", role);
      dialog.tabIndex = -1;
      dialog.textContent = "Open dialog";
      document.querySelector("main")!.appendChild(dialog);
    }, kind);
    held.release();
    await replyShown(page);
    await expect(composer(page)).not.toBeFocused();
    const dialog = page.getByRole(kind).filter({ hasText: "Open dialog" });
    await dialog.focus();
    await page.keyboard.type("a");
    await expect(dialog).toBeFocused();
    await expect(composer(page)).toHaveValue("");
  });
}
