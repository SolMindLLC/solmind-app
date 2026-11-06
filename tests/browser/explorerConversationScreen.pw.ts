// Paul's designed layout on the connected /explorer/conversation screen.
// Mocked private-response endpoints prove mounted layout and behaviour only;
// they prove no authentication, SQL persistence, provider call or genuine AI reply.
import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  EXPLORER_CONVERSATION_VERSION,
  type ExplorerConversationState,
} from "../../src/lib/solmind/explorerConversationContract";
import { NOT_YET_IMPLEMENTED, UNNAMED_GUIDE, guideNotes } from "../../src/lib/solmind/explorerConversationScreen";
import { EXPLORER_MENU } from "../../src/lib/solmind/workspaceMenus";
import { withoutReviewPrefix } from "../../src/lib/solmind/workspaceNavigation";
import { capture, captureFullPage, expectNoSeriousAxeViolations, expectNoSidewaysScroll } from "./conversationPreviewHelpers";

test.use({ trace: "off", screenshot: "off", video: "off" });

const CONVERSATION = "10000000-0000-4000-8000-000000000001";
const message = (index: number, role: "explorer" | "virtualGuide", body: string) => ({
  id: `${role === "explorer" ? "2" : "3"}0000000-0000-4000-8000-00000000000${index}`,
  role,
  body,
  createdAt: `2026-10-30T14:0${index}:00.000Z`,
});
const savedState = (): ExplorerConversationState => ({ waypointCapacity: { activeCount: 0, activeLimit: 20, historyRoom: true }, waypointProjection: { kind: "current_heads" as const, limit: 20 as const, totalHeads: 0, hasMore: false },
  version: EXPLORER_CONVERSATION_VERSION, conversationId: CONVERSATION, revision: 4, pendingTurn: false, turnedDownLimitReached: false, waypointDraft: null,
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

// Paul's 2026-11-02 decision: a control that is not connected yet says so (in the blue build-note label
// since 2026-11-03) and, when activated, shows one sentence under it; activating it again
// hides the sentence. It changes nothing else.
async function expectExplains(page: Page, scope: Locator, control: Locator, sentence: string) {
  await expect(control).toHaveAttribute("aria-expanded", "false");
  await expect(control).not.toHaveAttribute("aria-disabled", /.*/);
  const explanation = scope.locator(`[id="${await control.getAttribute("aria-controls")}"]`);
  await expect(explanation).toBeHidden();
  await control.click();
  await expect(control).toHaveAttribute("aria-expanded", "true");
  await expect(explanation).toBeVisible();
  await expect(explanation).toHaveText(sentence);
  await control.click();
  await expect(control).toHaveAttribute("aria-expanded", "false");
  await expect(explanation).toBeHidden();
}

function notConnected(scope: Page | Locator, name: string) {
  return scope.getByRole("button", { name: new RegExp(`^${name}\\s*Not connected yet$`) });
}

// Paul's 2026-11-02 decision ("Same as menu entries"): the bell shows the
// "Not connected yet" line, visibly (a blue build note since 2026-11-03). The build spec for that change adds: the
// line beside its icon, the name "Notifications Not connected yet" with the
// line said once, and no taller than the profile chip, so on wide screens the
// top bar keeps the chip's height.
async function expectBellShowsLine(page: Page, wide: boolean) {
  const bell = notConnected(page, "Notifications");
  await expect(bell).toHaveCount(1);
  await expect(bell).toBeVisible();
  await expect(bell).not.toHaveAttribute("aria-label", /.*/);
  // The space between the two parts is in the text, not only in the layout.
  await expect(bell).toHaveAccessibleName("Notifications Not connected yet");
  const line = bell.getByText("Not connected yet", { exact: true });
  await expect(line).toBeVisible();
  const chip = page.getByRole("button", { name: /^Explorer profile\s*Not connected yet$/ });
  // The same small blue label as the profile chip's.
  const look = (element: Element) => {
    const style = getComputedStyle(element);
    return [style.color, style.fontSize, style.fontWeight].join(" ");
  };
  expect(await line.evaluate(look)).toBe(await chip.getByText("Not connected yet", { exact: true }).evaluate(look));
  const [bellBox, iconBox, lineBox, chipBox] = await Promise.all(
    [bell, bell.locator("svg"), line, chip].map(async (locator) => {
      const box = await locator.boundingBox();
      if (box === null) throw new Error("bell_part_not_laid_out");
      return box;
    }),
  );
  // Beside the icon, in the same row.
  expect(lineBox.x).toBeGreaterThanOrEqual(iconBox.x + iconBox.width);
  const lineMiddle = lineBox.y + lineBox.height / 2;
  expect(lineMiddle).toBeGreaterThan(iconBox.y);
  expect(lineMiddle).toBeLessThan(iconBox.y + iconBox.height);
  // Wholly inside the bell.
  expect(lineBox.x + lineBox.width).toBeLessThanOrEqual(bellBox.x + bellBox.width);
  expect(lineBox.y).toBeGreaterThanOrEqual(bellBox.y);
  expect(lineBox.y + lineBox.height).toBeLessThanOrEqual(bellBox.y + bellBox.height);
  expect(bellBox.height).toBeLessThanOrEqual(chipBox.height);
  if (wide) {
    // The top bar's row is no taller than the profile chip.
    const header = page.locator("header").filter({ has: bell });
    const row = await header.evaluate((element) => {
      const style = getComputedStyle(element);
      const edges = ["paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth"] as const;
      return element.getBoundingClientRect().height - edges.reduce((sum, edge) => sum + parseFloat(style[edge]), 0);
    });
    expect(row).toBeLessThanOrEqual(chipBox.height + 0.5);
  }
  // Tapping it shows its sentence below it, in the row under the top bar, without sideways scroll.
  const sentence = page.locator('[id="nyi-top-notifications"]');
  await bell.click();
  await expect(sentence).toBeVisible();
  const sentenceBox = await sentence.boundingBox();
  expect(sentenceBox === null ? -1 : sentenceBox.y).toBeGreaterThanOrEqual(bellBox.y + bellBox.height);
  await expectNoSidewaysScroll(page);
  await bell.click();
  await expect(sentence).toBeHidden();
}

test("wide: the designed layout shows the saved conversation without preview extras", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, "wide layout only");
  const commands = await open(page, savedState());
  const saved = page.getByRole("list", { name: "Saved conversation", exact: true });
  await expect(saved.getByRole("listitem")).toHaveCount(4);
  await expect(saved.getByRole("listitem").first()).toContainText("You");
  await expect(saved.getByRole("listitem").nth(1)).toContainText("SolMind Virtual Guide");
  const rail = page.getByRole("navigation", { name: "Explorer workspace", exact: true });
  await expect(rail).toBeVisible();
  await expect(rail.getByRole("link", { name: "Overview", exact: true })).toHaveAttribute("href", "/explorer/home");
  await expect(rail.getByRole("link", { name: /^With your Virtual Guide/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeHidden();
  await expect(page.getByText(/^Interim design review/)).toHaveCount(0);
  await expect(page.locator("[data-preview-tag]")).toHaveCount(0);
  await expect(page.locator('[data-preview-control="layout"]')).toHaveCount(0);
  await expect(page.locator("[data-preview-control], [data-preview-note]")).toHaveCount(0);
  await expect(page.getByText(/Not yet implemented:/)).toHaveCount(0);
  // Overview in the menu is the way home (September 23); the top bar has no separate home link.
  await expect(page.getByRole("link", { name: "Explorer home", exact: true })).toHaveCount(0);
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

  // Controls not connected yet explain themselves on request and do nothing else.
  const body = page.locator("body");
  await expectExplains(page, body, notConnected(rail, "Settings"), EXPLORER_MENU[3].explanation ?? "");
  await expectExplains(page, body, notConnected(rail, "With your Guide"), withoutReviewPrefix(guideNotes(UNNAMED_GUIDE).guideSpace));
  await expectExplains(page, body, notConnected(page, "Rename"), withoutReviewPrefix(NOT_YET_IMPLEMENTED.rename));
  await expectExplains(page, body, notConnected(page, "Pause"), withoutReviewPrefix(NOT_YET_IMPLEMENTED.pause));
  await expectExplains(page, body, notConnected(page, "Finish & Review"), withoutReviewPrefix(NOT_YET_IMPLEMENTED.finishReview));
  await expectExplains(page, body, notConnected(page, "Share whole conversation"),
    withoutReviewPrefix(guideNotes(UNNAMED_GUIDE).shareConversation));
  await expectBellShowsLine(page, true);
  await expectExplains(page, body, notConnected(page, "Notifications"), withoutReviewPrefix(NOT_YET_IMPLEMENTED.notifications));
  // As on September 23, the profile chip's name is its visible role and label, with "profile" for screen readers.
  await expectExplains(page, body, page.getByRole("button", { name: /^Explorer profile\s*Not connected yet$/ }),
    withoutReviewPrefix(NOT_YET_IMPLEMENTED.profile));
  // Chat step slices S1 and S2: the Compass and Waypoints areas are connected, with no label beside their
  // headings. Key Insights stay marked, since 2026-11-03 with a blue build-note box under their heading
  // (tests/browser/buildNotes.pw.ts proves its X and the toggle). Since the chat card redesign (Paul's decision,
  // decision queue 2026-11-03 18:05:33 CST) the Compass has no forming-point or needle note: Paul removed them,
  // a dated exception to the rule that unbuilt areas stay marked.
  const panel = page.locator("#conversation-preview-panel");
  const compassArea = panel.getByRole("region", { name: "Compass", exact: true });
  const waypointArea = panel.getByRole("region", { name: "Waypoints", exact: true });
  await expect(compassArea).toBeVisible();
  await expect(waypointArea).toBeVisible();
  await expect(compassArea.getByText("No Compass point is saved yet. Your Compass can stay empty while you explore.", { exact: true })).toBeVisible();
  await expect(waypointArea.getByText("No Waypoint is chosen yet. You can keep exploring without one.", { exact: true })).toBeVisible();
  await expect(waypointArea.getByText("Not connected yet", { exact: true })).toHaveCount(0);
  await expect(compassArea.getByText("Not connected yet", { exact: true })).toHaveCount(0);
  await expect(panel.getByText(withoutReviewPrefix(NOT_YET_IMPLEMENTED.formingPoint), { exact: true })).toHaveCount(0);
  await expect(panel.getByText(withoutReviewPrefix(NOT_YET_IMPLEMENTED.needle), { exact: true })).toHaveCount(0);
  await expect(panel.getByText(withoutReviewPrefix(NOT_YET_IMPLEMENTED.compass), { exact: true })).toHaveCount(0);
  const insight = panel.getByRole("region", { name: "Key Insight", exact: true });
  await expect(insight.getByText("Not connected yet", { exact: true })).toBeVisible();
  await expect(insight.locator('[data-build-note="box"]')).toHaveCount(1);
  await expect(insight.getByText(withoutReviewPrefix(NOT_YET_IMPLEMENTED.keyInsight), { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Your conversation", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/explorer\/conversation$/);
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

test("with Send available, the composer controls not connected yet neither send nor change the draft", async ({ page }) => {
  const commands = await open(page, { ...savedState(), providerState: "available" });
  const field = page.getByLabel("Continue the conversation", { exact: true });
  await expect(field).toBeEnabled();
  await field.fill("A synthetic draft that must stay unsent");
  for (const [name, key] of [["Pause", "pause"], ["Finish & Review", "finishReview"], ["Slow down", "slowDown"]] as const) {
    const control = notConnected(page, name);
    await expect(control).toHaveAttribute("type", "button");
    await expectExplains(page, page.locator("body"), control, withoutReviewPrefix(NOT_YET_IMPLEMENTED[key]));
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

test("narrow: the Menu button opens the workspace menu, Escape closes it, and nothing scrolls sideways", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 1024, "narrow layout only");
  const commands = await open(page, savedState());
  await expectNoSidewaysScroll(page);
  await expectNoSeriousAxeViolations(page);
  await page.screenshot({ path: capture("connected-narrow-top-viewport") });
  await captureFullPage(page, "connected-narrow-full", "top");
  await expectBellShowsLine(page, false);
  await expectExplains(page, page.locator("body"), notConnected(page, "Notifications"), withoutReviewPrefix(NOT_YET_IMPLEMENTED.notifications));

  // Paul's 2026-11-02 option A: the September 23 Menu button replaces the icon strip.
  await expect(page.getByRole("navigation", { name: "Explorer workspace", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: /conversation spaces/i })).toHaveCount(0);
  const menuButton = page.getByRole("button", { name: "Menu", exact: true });
  await expect(menuButton).toBeVisible();
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await menuButton.click();
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  const menu = page.getByRole("navigation", { name: "Explorer workspace menu", exact: true });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link", { name: "Overview", exact: true })).toHaveAttribute("href", "/explorer/home");
  await expectExplains(page, menu, notConnected(menu, "Settings"), EXPLORER_MENU[3].explanation ?? "");
  await expectNoSidewaysScroll(page);
  await expectNoSeriousAxeViolations(page);
  await page.screenshot({ path: capture("connected-narrow-menu-open-viewport") });
  await menu.getByRole("link", { name: "Overview", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(menuButton).toBeFocused();
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  expect(commands()).toBe(0);

  const opener = page.locator("#conversation-preview-drawer-opener");
  await opener.click();
  const drawer = page.getByRole("dialog", { name: "Compass & Waypoint" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "Compass & Waypoint", exact: true })).toBeFocused();
  await expect(drawer.getByRole("region", { name: "Compass", exact: true })).toBeVisible();
  // The Compass card's forming-point note is gone since the chat card redesign (2026-11-03); the empty
  // Compass says so in its own words.
  await expect(drawer.getByText(withoutReviewPrefix(NOT_YET_IMPLEMENTED.formingPoint), { exact: true })).toHaveCount(0);
  await expect(drawer.getByText("No Compass point is saved yet. Your Compass can stay empty while you explore.", { exact: true })).toBeVisible();
  await expect(drawer.getByText(/Your Compass will fill in from what you talk about/)).toHaveCount(0);
  await page.screenshot({ path: capture("connected-narrow-drawer-open-viewport") });
  await drawer.getByRole("button", { name: "Close Compass & Waypoint", exact: true }).click();
  await expect(drawer).toBeHidden();
  await expect(opener).toBeFocused();
});

test("narrow: the menu entry for this page keeps a typed message instead of reloading", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 1024, "narrow layout only");
  let reads = 0;
  page.on("request", (request) => { if (new URL(request.url()).pathname === "/explorer/conversation/state") reads += 1; });
  const commands = await open(page, { ...savedState(), providerState: "available" });
  const readsAtOpen = reads;
  const field = page.getByLabel("Continue the conversation", { exact: true });
  await field.fill("A synthetic draft that must survive the menu");
  const menuButton = page.getByRole("button", { name: "Menu", exact: true });
  await menuButton.click();
  const menu = page.getByRole("navigation", { name: "Explorer workspace menu", exact: true });
  const here = menu.getByRole("link", { name: /^With your Virtual Guide/ });
  await expect(here).toHaveAttribute("aria-current", "page");
  await expect(here).toHaveAttribute("href", "/explorer/conversation");
  // A click with a modifier key or another button is left to the browser, as for any link.
  const leftAlone = await here.evaluate((link) => {
    const kept: boolean[] = [];
    const stop = (event: Event) => { kept.push(!event.defaultPrevented); event.preventDefault(); };
    window.addEventListener("click", stop);
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { button: 1 }]) {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
    }
    window.removeEventListener("click", stop);
    return kept;
  });
  expect(leftAlone).toEqual([true, true, true, true]);
  await expect(menu).toBeVisible();
  await here.click();
  await expect(menu).toHaveCount(0);
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("heading", { level: 1, name: "Your conversation", exact: true })).toBeFocused();
  await expect(field).toHaveValue("A synthetic draft that must survive the menu");
  await expect(page).toHaveURL(/\/explorer\/conversation$/);
  expect(reads).toBe(readsAtOpen);
  expect(commands()).toBe(0);
});
