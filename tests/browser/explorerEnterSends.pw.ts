// Part 2 of Paul's screen wording, approved 2026-11-12: Enter sends.
// Mocked private-response endpoints prove mounted keyboard behaviour only;
// they prove no authentication, SQL persistence, provider call or genuine AI reply.
import { expect, test, type Page } from "@playwright/test";

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
