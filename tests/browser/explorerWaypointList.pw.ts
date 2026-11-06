// The compact Waypoint list (lane 8; Paul's decision, decision queue 2026-11-05 19:38:45 CST, point 4, and his
// design approval, 2026-11-06 08:59:55 CST): three compact rows at first, then five, then all; one row open at a
// time; a forming draft in the first row; the newest first; Reached and Released Waypoints in a closed group.
// Layout only: nothing here sends a command. Invented Waypoints only.
import { expect, test, type Locator, type Page } from "@playwright/test";

import type { ExplorerConversationState } from "../../src/lib/solmind/explorerConversationContract";
import { cardState } from "./connectedCardFixture";
import { expectNoSeriousAxeViolations, expectNoSidewaysScroll } from "./conversationPreviewHelpers";

test.use({ trace: "off", screenshot: "off", video: "off" });

const success = (state: ExplorerConversationState) => ({
  version: "explorer-private-conversation-response.v1", result: { ok: true, state, error: null }, assistance: null,
});
const isWide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

// Five more chosen Waypoints; manyWaypoints returns SQL's active-first, newest-first projection.
const EXTRA = [
  ["Plan the first two sentences", "Know how I will start the talk", "So I do not freeze at the start", "I can say the first two sentences"],
  ["Pick a quiet place to talk", "Pick a quiet place to talk", "Noise makes me lose my point", "We have a place we both like"],
  ["Take one rest evening this week", "Take one evening off this week", "I am tired before the talk", "One evening with no work"],
  ["Ask a friend to listen first", "Practise with a friend", "Saying it once makes it easier", "A friend has heard it once"],
  ["Write one money question", "Write one money question", "So money does not take over the talk", "One question on paper"],
] as const;
const DRAFT_TITLE = "Choose a day that suits us both";

function manyWaypoints(withDraft: boolean): ExplorerConversationState {
  const base = cardState();
  const source = base.messages[0].id;
  const extra = EXTRA.map(([title, destination, meaning, arrivalSignal], index) => ({
    id: `60000000-0000-4000-8000-0000000000e${index}`, isCurrent: true, createdAt: `2026-11-03T15:0${index}:00.000Z`,
    sourceMessageId: source, title, destination, meaning, arrivalSignal,
    status: "chosen" as const,
  }));
  const draft = withDraft ? {
    id: "80000000-0000-4000-8000-000000000001", title: DRAFT_TITLE,
    destination: "Agree on a day with my sister", whyItMatters: "So neither of us is rushed",
    arrivalSignal: "We both said yes to a day", suggestionMessageId: base.messages[3].id,
  } : null;
  const formed = base.waypoints.filter(waypoint => waypoint.status === "chosen" && !waypoint.release);
  const closed = base.waypoints.filter(waypoint => waypoint.status === "reached" || waypoint.release).reverse();
  const waypoints = [...extra.reverse(), ...formed, ...closed];
  return { ...base, waypoints, waypointDraft: draft,
    waypointCapacity: { activeCount: formed.length + extra.length, activeLimit: 20, historyRoom: true },
    waypointProjection: { kind: "current_heads", limit: 20, totalHeads: waypoints.length, hasMore: false } };
}

// The Waypoints region in the wide panel, or on a phone inside the opened Compass & Waypoint drawer.
async function openList(page: Page, state: ExplorerConversationState): Promise<Locator> {
  // The list is layout only: any command would be a defect, so commands are refused.
  await page.route("**/explorer/conversation/commands", route => route.abort());
  await page.route("**/explorer/conversation/state", route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(state)) }));
  await page.goto("/explorer/conversation");
  await expect(page.getByRole("heading", { level: 1, name: "Your conversation", exact: true })).toBeFocused();
  let scope: Locator = page.locator("#conversation-preview-panel");
  if (!isWide(page)) {
    await page.locator("#conversation-preview-drawer-opener").click();
    scope = page.getByRole("dialog", { name: "Compass & Waypoint" });
  }
  const list = scope.getByRole("region", { name: "Waypoints", exact: true });
  await expect(list).toBeVisible();
  return list;
}

const rowButtons = (list: Locator) => list.locator("article h4 button");

test("SQL newest-first projection: three rows show first, the forming draft first and then the newest; then five; then all; then three again", async ({ page }) => {
  const list = await openList(page, manyWaypoints(true));
  await expect(rowButtons(list)).toHaveCount(3);
  await expect(rowButtons(list).nth(0)).toHaveAccessibleName(`${DRAFT_TITLE} Forming`);
  await expect(rowButtons(list).nth(1)).toHaveAccessibleName("Write one money question Formed");
  await expect(rowButtons(list).nth(2)).toHaveAccessibleName("Ask a friend to listen first Formed");
  for (const button of await rowButtons(list).all()) await expect(button).toHaveAttribute("aria-expanded", "false");
  // The forming draft's row is drawn dashed, like a forming point.
  await expect(list.locator("article").first()).toHaveClass(/border-dashed/);
  await list.getByRole("button", { name: "Show 2 more", exact: true }).click();
  await expect(rowButtons(list)).toHaveCount(5);
  await list.getByRole("button", { name: "Show all 7", exact: true }).click();
  await expect(rowButtons(list)).toHaveCount(7);
  await expect(rowButtons(list).nth(6)).toHaveAccessibleName("Ask my sister for a calm evening Formed");
  await expect(list.getByRole("button", { name: /^Show (\d+ more|all)/ })).toHaveCount(0);
  await list.getByRole("button", { name: "Show fewer", exact: true }).click();
  await expect(rowButtons(list)).toHaveCount(3);
  await expectNoSidewaysScroll(page);
  await expectNoSeriousAxeViolations(page);
});

test("one row is open at a time, and an open row shows its details", async ({ page }) => {
  const list = await openList(page, manyWaypoints(true));
  const first = list.getByRole("button", { name: /Write one money question/ });
  const second = list.getByRole("button", { name: /Ask a friend to listen first/ });
  await first.click();
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await expect(list.getByText("So money does not take over the talk", { exact: true })).toBeVisible();
  await second.click();
  await expect(second).toHaveAttribute("aria-expanded", "true");
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await expect(list.getByText("So money does not take over the talk", { exact: true })).toHaveCount(0);
  await expect(list.getByText("Saying it once makes it easier", { exact: true })).toBeVisible();
  await second.click();
  await expect(second).toHaveAttribute("aria-expanded", "false");
  // The forming draft opens to its wording.
  await list.getByRole("button", { name: new RegExp(DRAFT_TITLE) }).click();
  await expect(list.getByText("So neither of us is rushed", { exact: true })).toBeVisible();
});

test("Reached and Released Waypoints are in a closed group that names their count", async ({ page }) => {
  const list = await openList(page, manyWaypoints(false));
  const group = list.getByRole("button", { name: /Reached and released \(2\)/ });
  await expect(group).toHaveAttribute("aria-expanded", "false");
  await expect(list.getByRole("button", { name: /Say what I need in one sentence/ })).toHaveCount(0);
  await group.click();
  await expect(group).toHaveAttribute("aria-expanded", "true");
  await expect(rowButtons(list).nth(3)).toHaveAccessibleName("Fix the budget this month Released");
  await expect(rowButtons(list).nth(4)).toHaveAccessibleName("Say what I need in one sentence Reached");
  const reached = list.getByRole("button", { name: /Say what I need in one sentence/ });
  await expect(reached).toHaveAccessibleName(/Reached$/);
  await expect(list.getByRole("button", { name: /Fix the budget this month/ })).toHaveAccessibleName(/Released$/);
  await reached.click();
  await expect(list.getByText("I can say it out loud once", { exact: true })).toBeVisible();
  // The current-head projection has no earlier versions until the private history screen exists.
  await expect(list.getByText(/^Earlier version/)).toHaveCount(0);
});

test("a conversation with three or fewer Waypoints has no Show buttons", async ({ page }) => {
  const list = await openList(page, cardState());
  await expect(rowButtons(list)).toHaveCount(1);
  await expect(list.getByRole("button", { name: /^Show/ })).toHaveCount(0);
});

test("keyboard: Show more and Show all move focus to the first row they reveal, Show fewer back to Show more", async ({ page }) => {
  const list = await openList(page, manyWaypoints(true));
  await list.getByRole("button", { name: "Show 2 more", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(list.getByRole("button", { name: /Take one rest evening this week/ })).toBeFocused();
  await list.getByRole("button", { name: "Show all 7", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(list.getByRole("button", { name: /Plan the first two sentences/ })).toBeFocused();
  await list.getByRole("button", { name: "Show fewer", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(list.getByRole("button", { name: "Show 2 more", exact: true })).toBeFocused();
});
