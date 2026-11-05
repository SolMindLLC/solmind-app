// Build notes on the signed-in screens (Paul's rule, decision queue 2026-11-03 17:59:20, 18:00:59 and
// 18:03:39 CST; build spec .validation/build-notes-20261103): the blue "Not connected yet" labels, the
// blue boxes with their X, the violet "Planned for removal" marker on the old form tools, and the one
// "Build notes" toggle in the top bar, on the connected conversation screen and on a workspace-frame page,
// at both widths (desktop-chromium 1280 and narrow-chromium 390). Mocked private-response endpoints prove
// mounted layout and behaviour only; nothing is sent.
import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

import { BUILD_NOTE_WORDING, NOT_YET_IMPLEMENTED } from "../../src/lib/solmind/explorerConversationScreen";
import { CURRENT_TOOLS_REMOVAL_REASON } from "../../src/lib/solmind/explorerConversationConnectedScreen";
import {
  EXPLORER_CONVERSATION_VERSION,
  type ExplorerConversationState,
} from "../../src/lib/solmind/explorerConversationContract";
import { withoutReviewPrefix } from "../../src/lib/solmind/workspaceNavigation";
import { expectNoSeriousAxeViolations, expectNoSidewaysScroll } from "./conversationPreviewHelpers";

test.use({ trace: "off", screenshot: "off", video: "off" });

const BLUE = "rgb(74, 134, 255)";
const VIOLET = "rgb(210, 123, 255)";
const isWide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;
const message = (index: number, role: "explorer" | "virtualGuide", body: string) => ({
  id: `${role === "explorer" ? "2" : "3"}0000000-0000-4000-8000-00000000000${index}`,
  role,
  body,
  createdAt: `2026-10-30T14:0${index}:00.000Z`,
});
const savedState = (): ExplorerConversationState => ({
  version: EXPLORER_CONVERSATION_VERSION, conversationId: "10000000-0000-4000-8000-000000000001", revision: 4, pendingTurn: false, turnedDownLimitReached: false,
  providerState: "unavailable", compassItems: [], priorityId: null, attentionId: null, waypoints: [], route: [],
  sessionStatus: "active", ending: null,
  messages: [
    message(1, "explorer", "A synthetic test message: I keep putting off a conversation I need to have."),
    message(2, "virtualGuide", "A synthetic saved reply: what feels most important to understand first?"),
  ],
});
const success = (state: ExplorerConversationState) => ({
  version: "explorer-private-conversation-response.v1", result: { ok: true, state, error: null }, assistance: null,
});

async function openConversation(page: Page) {
  let commands = 0;
  await page.route("**/explorer/conversation/state", route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(savedState())) }));
  await page.route("**/explorer/conversation/commands", route => { commands += 1; return route.abort(); });
  await page.goto("/explorer/conversation");
  await expect(page.getByRole("heading", { level: 1, name: "Your conversation", exact: true })).toBeFocused();
  return () => commands;
}

const toggleOf = (page: Page) => page.getByRole("button", { name: BUILD_NOTE_WORDING.toggle, exact: true });
const labels = (scope: Page | Locator) => scope.locator('[data-build-note="label"]');
const boxes = (scope: Page | Locator) => scope.locator('[data-build-note="box"]');
const boxOf = (page: Page, sentenceId: string) => boxes(page).filter({ has: page.locator(`[id="${sentenceId}"]`) });

// Every label that is drawn is the build-note blue.
async function expectVisibleLabelsBlue(page: Page) {
  const all = labels(page);
  let drawn = 0;
  for (let index = 0; index < (await all.count()); index += 1) {
    const label = all.nth(index);
    if (!(await label.isVisible())) continue;
    await expect(label).toHaveText("Not connected yet");
    await expect(label).toHaveCSS("color", BLUE);
    drawn += 1;
  }
  expect(drawn).toBeGreaterThan(0);
}

test("conversation screen: the toggle hides every note and marker; an X hides only its box until the toggle turns them on", async ({ page }) => {
  const commands = await openConversation(page);
  const toggle = toggleOf(page);
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveAttribute("data-build-note", "toggle");
  // The 13 controls not built yet each carry a blue label (the rail's copies are drawn on wide screens only).
  await expect(labels(page)).toHaveCount(13);
  await expectVisibleLabelsBlue(page);
  const bell = page.getByRole("button", { name: /^Notifications\s*Not connected yet$/ });
  await expect(bell).toBeVisible();
  // The latest-change area is a dashed blue box with an X in its upper corner.
  const latest = boxOf(page, "nyi-composer-latestChange");
  await expect(latest).toBeVisible();
  await expect(latest).toHaveCSS("border-top-style", "dashed");
  await expect(latest).toHaveCSS("border-top-color", BLUE);
  await expect(latest.getByText(withoutReviewPrefix(NOT_YET_IMPLEMENTED.latestChange), { exact: true })).toBeVisible();
  const close = latest.getByRole("button", { name: BUILD_NOTE_WORDING.hide, exact: true });
  await expect(close).toHaveAccessibleDescription(withoutReviewPrefix(NOT_YET_IMPLEMENTED.latestChange));
  const [boxBox, closeBox] = await Promise.all([latest.boundingBox(), close.boundingBox()]);
  if (boxBox === null || closeBox === null) throw new Error("box_not_laid_out");
  // Upper right corner, inside the box.
  expect(closeBox.y - boxBox.y).toBeLessThanOrEqual(8);
  expect(boxBox.x + boxBox.width - (closeBox.x + closeBox.width)).toBeLessThanOrEqual(8);
  const keyInsight = boxOf(page, "nyi-panel-keyInsight");
  if (isWide(page)) await expect(keyInsight).toBeVisible();
  // The old tools carry the violet removal marker.
  const tools = page.locator('section[aria-labelledby="conversation-current-tools-heading"]');
  await expect(tools).toHaveAttribute("data-removal-marker", "outline");
  await expect(tools).toHaveCSS("outline-style", "dashed");
  await expect(tools).toHaveCSS("outline-color", VIOLET);
  await expectNoSidewaysScroll(page);
  await expectNoSeriousAxeViolations(page);

  // An X hides only its box; focus moves to the control before it (Slow down), not to the page.
  await close.click();
  await expect(latest).toHaveCount(0);
  await expect(page.locator('[id="nyi-composer-latestChange"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Slow down\s*Not connected yet$/ })).toBeFocused();
  if (isWide(page)) await expect(keyInsight).toBeVisible();
  await expect(labels(page)).toHaveCount(13);
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  // Toggle off: every blue label and box and the violet marker go; every control and tool stays.
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toBeFocused();
  await expect(labels(page)).toHaveCount(0);
  await expect(boxes(page)).toHaveCount(0);
  await expect(page.locator("[data-removal-marker]")).toHaveCount(0);
  await expect(page.getByText("Not connected yet", { exact: true })).toHaveCount(0);
  await expect(tools).toBeVisible();
  await expect(tools).toHaveCSS("outline-style", "none");
  await expect(tools.getByRole("button", { name: BUILD_NOTE_WORDING.removalTag })).toHaveCount(0);
  await expect(page.locator('aside[aria-label="Private Compass and Waypoints"]')).toBeVisible();
  // The controls stay and still explain themselves.
  const pause = page.getByRole("button", { name: "Pause", exact: true });
  await expect(pause).toBeVisible();
  const pauseSentence = page.locator(`[id="${await pause.getAttribute("aria-controls")}"]`);
  await pause.click();
  await expect(pauseSentence).toBeVisible();
  await expect(pauseSentence).toHaveText(withoutReviewPrefix(NOT_YET_IMPLEMENTED.pause));
  await pause.click();
  await expect(pauseSentence).toBeHidden();
  await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await expectNoSeriousAxeViolations(page);

  // Toggle on: everything shows again, including the box closed with its X.
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(labels(page)).toHaveCount(13);
  await expect(latest).toBeVisible();
  if (isWide(page)) await expect(keyInsight).toBeVisible();
  await expect(tools).toHaveAttribute("data-removal-marker", "outline");
  await expect(bell).toBeVisible();
  await expectNoSidewaysScroll(page);
  expect(commands()).toBe(0);
});

test("conversation screen: a box closed with its X stays hidden while the toggle is off and returns when it is on", async ({ page }) => {
  await openConversation(page);
  const toggle = toggleOf(page);
  const latest = boxOf(page, "nyi-composer-latestChange");
  await latest.getByRole("button", { name: BUILD_NOTE_WORDING.hide, exact: true }).click();
  await expect(latest).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(latest).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(latest).toBeVisible();
  // Nothing is saved: a reload shows every note, with the toggle on.
  await latest.getByRole("button", { name: BUILD_NOTE_WORDING.hide, exact: true }).click();
  await toggle.click();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Your conversation", exact: true })).toBeFocused();
  await expect(toggleOf(page)).toHaveAttribute("aria-pressed", "true");
  await expect(boxOf(page, "nyi-composer-latestChange")).toBeVisible();
  await expect(labels(page)).toHaveCount(13);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  await expect(page).toHaveURL(/\/explorer\/conversation$/);
});

test("conversation screen: the violet tag says why the old tools are planned for removal, and they keep working", async ({ page }) => {
  const commands = await openConversation(page);
  const tools = page.locator('section[aria-labelledby="conversation-current-tools-heading"]');
  const tag = tools.getByRole("button", { name: BUILD_NOTE_WORDING.removalTag, exact: true });
  await tag.scrollIntoViewIfNeeded();
  await expect(tag).toBeVisible();
  await expect(tag).toHaveCSS("color", VIOLET);
  await expect(tag).toHaveCSS("border-top-style", "dashed");
  await expect(tag).toHaveAttribute("aria-expanded", "false");
  const reason = tools.locator(`[id="${await tag.getAttribute("aria-controls")}"]`);
  await expect(reason).toBeHidden();
  await tag.click();
  await expect(tag).toHaveAttribute("aria-expanded", "true");
  await expect(reason).toBeVisible();
  await expect(reason).toHaveText(CURRENT_TOOLS_REMOVAL_REASON);
  await expectNoSidewaysScroll(page);
  await tag.click();
  await expect(reason).toBeHidden();
  // Left open, the sentence does not come back open after the toggle hides and shows the notes.
  await tag.click();
  await expect(reason).toBeVisible();
  const toggle = toggleOf(page);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(tag).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(tag).toHaveAttribute("aria-expanded", "false");
  await expect(reason).toBeHidden();
  // The tools stay usable: their own controls are there and enabled, and a draft typed in them clears locally
  // with no command sent.
  const region = page.locator('aside[aria-label="Private Compass and Waypoints"]');
  await expect(region).toBeVisible();
  const first = region.getByRole("button").first();
  await expect(first).toBeEnabled();
  // Found by its label's for, so the locator does not depend on what is typed.
  const labelFor = await region.locator("label", { hasText: "Your short label" }).getAttribute("for");
  const pointLabel = region.locator(`input[id="${labelFor}"]`);
  await expect(pointLabel).toHaveCount(1);
  await expect(pointLabel).toBeEnabled();
  await pointLabel.fill("A synthetic point label");
  await expect(pointLabel).toHaveValue("A synthetic point label");
  await region.getByRole("button", { name: "Clear point draft", exact: true }).click();
  await expect(pointLabel).toHaveValue("");
  expect(commands()).toBe(0);
});

test("narrow: an X in the Compass & Waypoint drawer keeps focus in the drawer; the toggle brings the box back", async ({ page }) => {
  test.skip(isWide(page), "narrow layout only");
  await openConversation(page);
  const opener = page.locator("#conversation-preview-drawer-opener");
  await opener.click();
  const drawer = page.getByRole("dialog", { name: "Compass & Waypoint" });
  await expect(drawer).toBeVisible();
  const box = boxes(drawer).filter({ has: page.locator('[id="nyi-drawer-keyInsight"]') });
  await box.scrollIntoViewIfNeeded();
  await expect(box).toBeVisible();
  await box.getByRole("button", { name: BUILD_NOTE_WORDING.hide, exact: true }).click();
  await expect(box).toHaveCount(0);
  expect(await page.evaluate(() => {
    const active = document.activeElement;
    return active !== null && active !== document.body && active.closest("dialog") !== null;
  })).toBe(true);
  await expectNoSidewaysScroll(page);
  await drawer.getByRole("button", { name: "Close Compass & Waypoint", exact: true }).click();
  await expect(drawer).toBeHidden();
  // Still closed when the drawer opens again; off then on shows it again.
  await opener.click();
  await expect(boxes(drawer).filter({ has: page.locator('[id="nyi-drawer-keyInsight"]') })).toHaveCount(0);
  await drawer.getByRole("button", { name: "Close Compass & Waypoint", exact: true }).click();
  const toggle = toggleOf(page);
  await toggle.click();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await opener.click();
  await expect(boxes(drawer).filter({ has: page.locator('[id="nyi-drawer-keyInsight"]') })).toBeVisible();
});

const fulfillJson = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

test("workspace frame (Waypoints inbox): the toggle hides and shows the blue labels; the bell and menu keep working", async ({ page }) => {
  // One synthetic delivered suggestion, as in suggestedWaypointExplorerInbox.pw.ts.
  const item = {
    suggested_waypoint_id: "66666666-6666-4666-8666-666666666666", current_version_id: "99999999-9999-4999-8999-999999999999",
    destination_preview: "Protect one evening each week for recovery", received_at: "2026-08-16T06:00:00.000Z", read: false,
    receipt_acknowledged: false, acknowledged_at: null, channel_category: "open",
  };
  await page.route("**/explorer/waypoints/suggestions?**", (route) =>
    fulfillJson(route, { ok: true, data: { items: [item], next_cursor: null, total_count: 1 }, error: null }));
  await page.goto("/explorer/waypoints");
  await expect(page.getByRole("link", { name: /Protect one evening each week for recovery/ })).toBeVisible();
  const toggle = toggleOf(page);
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  // Settings, the bell and the profile chip.
  await expect(labels(page)).toHaveCount(3);
  await expectVisibleLabelsBlue(page);
  // The frame pages have labels only: no area box and no removal marker.
  await expect(boxes(page)).toHaveCount(0);
  await expect(page.locator("[data-removal-marker]")).toHaveCount(0);
  await expectNoSidewaysScroll(page);
  await expectNoSeriousAxeViolations(page);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(labels(page)).toHaveCount(0);
  await expect(page.getByText("Not connected yet", { exact: true })).toHaveCount(0);
  // The bell stays and still explains itself.
  const bell = page.getByRole("button", { name: "Notifications", exact: true });
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(page.locator('[id="nyi-top-notifications"]')).toHaveText(withoutReviewPrefix(NOT_YET_IMPLEMENTED.notifications));
  await bell.click();
  await expect(page.locator('[id="nyi-top-notifications"]')).toBeHidden();
  const profile = page.getByRole("button", { name: "Explorer profile", exact: true });
  await expect(profile).toBeVisible();
  // The menu keeps working: Settings, without its label, still opens and hides its sentence, and a built entry
  // is still a link (the rail at 1280; at 390 the panel the Menu button opens, which mounts with no label).
  const menuButton = page.getByRole("button", { name: "Menu", exact: true });
  let menu: Locator;
  if (isWide(page)) {
    menu = page.getByRole("navigation", { name: "Explorer workspace", exact: true });
  } else {
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    menu = page.getByRole("navigation", { name: "Explorer workspace menu", exact: true });
    await expect(menu).toBeVisible();
    await expect(labels(menu)).toHaveCount(0);
  }
  const settings = menu.getByRole("button", { name: "Settings", exact: true });
  await expect(settings).toBeVisible();
  await expect(settings).toHaveAttribute("aria-expanded", "false");
  const settingsSentence = page.locator(`[id="${await settings.getAttribute("aria-controls")}"]`);
  await expect(settingsSentence).toBeHidden();
  await settings.click();
  await expect(settings).toHaveAttribute("aria-expanded", "true");
  await expect(settingsSentence).toBeVisible();
  await expect(settingsSentence).toHaveText(withoutReviewPrefix(NOT_YET_IMPLEMENTED.settings));
  await settings.click();
  await expect(settings).toHaveAttribute("aria-expanded", "false");
  await expect(settingsSentence).toBeHidden();
  await expect(menu.getByRole("link", { name: "Overview", exact: true })).toHaveAttribute("href", "/explorer/home");
  if (!isWide(page)) {
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeHidden();
  }
  await expectNoSidewaysScroll(page);
  await expectNoSeriousAxeViolations(page);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(labels(page)).toHaveCount(3);
  await expect(page.getByRole("button", { name: /^Notifications\s*Not connected yet$/ })).toBeVisible();
  await expectNoSidewaysScroll(page);
});
