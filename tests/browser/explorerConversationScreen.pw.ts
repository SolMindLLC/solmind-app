// Paul's designed layout on the connected /explorer/conversation screen.
// Mocked private-response endpoints prove mounted layout and behaviour only;
// they prove no authentication, SQL persistence, provider call or genuine AI reply.
import { expect, test, type Page } from "@playwright/test";

import {
  EXPLORER_CONVERSATION_VERSION,
  type ExplorerConversationState,
} from "../../src/lib/solmind/explorerConversationContract";
import { capture, captureFullPage, expectNoSeriousAxeViolations, expectNoSidewaysScroll } from "./conversationPreviewHelpers";

test.use({ trace: "off", screenshot: "off", video: "off" });

const CONVERSATION = "10000000-0000-4000-8000-000000000001";
const message = (index: number, role: "explorer" | "virtualGuide", body: string) => ({
  id: `${role === "explorer" ? "2" : "3"}0000000-0000-4000-8000-00000000000${index}`,
  role,
  body,
  createdAt: `2026-10-30T14:0${index}:00.000Z`,
});
const savedState = (): ExplorerConversationState => ({
  version: EXPLORER_CONVERSATION_VERSION, conversationId: CONVERSATION, revision: 4, pendingTurn: false,
  providerState: "unavailable", compassItems: [], priorityId: null, attentionId: null, waypoints: [], route: [],
  sessionStatus: "active", ending: null,
  messages: [
    message(1, "explorer", "A synthetic test message: I keep putting off a conversation I need to have."),
    message(2, "virtualGuide", "A synthetic saved reply: what feels most important to understand first?"),
    message(3, "explorer", "A synthetic test message: what I need from it, before I plan what to say."),
    message(4, "virtualGuide", "A synthetic saved reply: that sounds like a good place to begin."),
  ],
});
const success = (state: ExplorerConversationState) => ({
  version: "explorer-private-conversation-response.v1", result: { ok: true, state, error: null }, assistance: null,
});

async function open(page: Page, state: ExplorerConversationState) {
  let commands = 0;
  await page.route("**/explorer/conversation/state", route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(state)) }));
  await page.route("**/explorer/conversation/commands", route => { commands += 1; return route.abort(); });
  await page.goto("/explorer/conversation");
  await expect(page.getByRole("heading", { level: 1, name: "Your conversation", exact: true })).toBeFocused();
  return () => commands;
}

test("wide: the designed layout shows the saved conversation without preview extras", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, "wide layout only");
  const commands = await open(page, savedState());
  const saved = page.getByRole("list", { name: "Saved conversation", exact: true });
  await expect(saved.getByRole("listitem")).toHaveCount(4);
  await expect(saved.getByRole("listitem").first()).toContainText("You");
  await expect(saved.getByRole("listitem").nth(1)).toContainText("SolMind Virtual Guide");
  await expect(page.getByRole("navigation", { name: "Explorer workspace" }).first()).toBeVisible();
  await expect(page.getByText(/^Interim design review/)).toHaveCount(0);
  await expect(page.locator("[data-preview-tag]")).toHaveCount(0);
  await expect(page.locator('[data-preview-control="layout"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Explorer home", exact: true })).toHaveAttribute("href", "/explorer/home");
  await expect(page.getByRole("heading", { name: "Your current Compass and Waypoint tools", exact: true })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await expectNoSeriousAxeViolations(page);
  await page.screenshot({ path: capture("connected-wide-viewport") });
  await captureFullPage(page, "connected-wide-full", "top");

  // The panel toggle works and keeps its target in the page.
  const toggle = page.locator("#conversation-preview-panel-toggle");
  await toggle.click();
  await expect(page.locator("#conversation-preview-panel")).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(page.locator("#conversation-preview-panel")).toBeVisible();

  // Unwired controls explain themselves and do nothing.
  for (const name of ["Rename", "Pause", "Finish & Review", "Share whole conversation"]) {
    const control = page.getByRole("button", { name, exact: true }).first();
    await expect(control).toHaveAttribute("aria-disabled", "true");
    await control.click({ force: true });
  }
  await expect(page.getByRole("heading", { level: 1, name: "Your conversation", exact: true })).toBeVisible();
  expect(commands()).toBe(0);
});

test("wide: an empty conversation shows the ways-to-begin placeholder", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, "wide layout only");
  const empty: ExplorerConversationState = { ...savedState(), conversationId: null, revision: 0, messages: [], sessionStatus: null };
  await open(page, empty);
  await expect(page.getByText("There are no saved messages yet.", { exact: true })).toBeVisible();
  await expect(page.getByText("Ways to begin", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to Explorer home", exact: true })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await page.screenshot({ path: capture("connected-wide-empty-viewport") });
});

test("with Send available, the unwired composer controls neither send nor change the draft", async ({ page }) => {
  const commands = await open(page, { ...savedState(), providerState: "available" });
  const field = page.getByLabel("Continue the conversation", { exact: true });
  await expect(field).toBeEnabled();
  await field.fill("A synthetic draft that must stay unsent");
  for (const name of ["Pause", "Finish & Review", "Slow down"]) {
    const control = page.getByRole("button", { name, exact: true });
    await expect(control).toHaveAttribute("aria-disabled", "true");
    await expect(control).toHaveAttribute("type", "button");
    await control.click({ force: true });
  }
  await expect(field).toHaveValue("A synthetic draft that must stay unsent");
  expect(commands()).toBe(0);
});

test("a pending saved turn stays in view beside the composer however long the history is", async ({ page }) => {
  const long: ExplorerConversationState = {
    ...savedState(), pendingTurn: true,
    messages: Array.from({ length: 30 }, (_, index) => ({
      id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      role: index % 2 === 0 ? "explorer" as const : "virtualGuide" as const,
      body: `A synthetic saved message number ${index + 1}, long enough to fill the transcript box over many lines.`,
      createdAt: `2026-10-30T14:${String(index).padStart(2, "0")}:00.000Z`,
    })),
  };
  await open(page, long);
  const notice = page.getByText(/^A saved message is still awaiting a confirmed result\./);
  await expect(notice).toHaveCount(1);
  await expect(page.getByRole("log", { name: "Conversation transcript" }).getByText(/awaiting a confirmed result/)).toHaveCount(0);
  await page.getByLabel("Continue the conversation", { exact: true }).scrollIntoViewIfNeeded();
  await expect(notice).toBeInViewport();
  await expect(page.getByLabel("Continue the conversation", { exact: true })).toBeDisabled();
});

test("narrow: the drawer opens and closes and nothing scrolls sideways", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 1024, "narrow layout only");
  await open(page, savedState());
  await expectNoSidewaysScroll(page);
  await expectNoSeriousAxeViolations(page);
  await page.screenshot({ path: capture("connected-narrow-top-viewport") });
  await captureFullPage(page, "connected-narrow-full", "top");
  const opener = page.locator("#conversation-preview-drawer-opener");
  await opener.click();
  const drawer = page.getByRole("dialog", { name: "Compass & Waypoint" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "Compass & Waypoint", exact: true })).toBeFocused();
  await expect(drawer.getByText(/Your Compass will fill in from what you talk about/)).toBeVisible();
  await page.screenshot({ path: capture("connected-narrow-drawer-open-viewport") });
  await drawer.getByRole("button", { name: "Close Compass & Waypoint", exact: true }).click();
  await expect(drawer).toBeHidden();
  await expect(opener).toBeFocused();
});
