// Chat step slices S1 and S2 (build spec 2026-11-03): the connected Compass & Waypoint card on
// /explorer/conversation, and the Explorer pointing the needle from it with the existing
// set_attention command. Since the Compact and Full views (build spec 2026-11-03; Paul's decisions,
// decision queue 16:20:29 and 16:24:39 CST) the card shows one view at a time: the Full view, first,
// is the dial, whose drawn points are the buttons; the Compact view is the point list. Since the chat
// card redesign (Paul's decision, decision queue 2026-11-03 18:05:33 CST) the needle may point at any
// current point: the Full view's bottom row holds the points without a position (three places, the
// third "+N more"), a needle on one of them is dashed and explains itself, and the instruction texts
// are gone. Mocked private-response endpoints prove mounted layout and behaviour only; they prove no
// authentication, SQL persistence, provider call or genuine AI reply.
import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  CONNECTED_COMPASS_WORDING,
  DASHED_NEEDLE_WORDING,
  NEEDLE_HOLD_DRAWER_TEXT,
  NEEDLE_HOLD_TEXT,
  bottomRowLabel,
  needleHoldText,
  needleMovedText,
} from "../../src/lib/solmind/explorerConnectedCard";
import { CURRENT_TOOLS_POINTER } from "../../src/lib/solmind/explorerConversationConnectedScreen";
import type { ExplorerConversationState } from "../../src/lib/solmind/explorerConversationContract";
import { CARD_LABELS, CARD_POINTS, cardState } from "./connectedCardFixture";
import { expectNoSeriousAxeViolations, expectNoSidewaysScroll } from "./conversationPreviewHelpers";

test.use({ trace: "off", screenshot: "off", video: "off" });

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const success = (state: ExplorerConversationState) => ({
  version: "explorer-private-conversation-response.v1", result: { ok: true, state, error: null }, assistance: null,
});
const failure = (error: "denied" | "refresh_required" | "provider_unavailable") => ({
  version: "explorer-private-conversation-response.v1", result: { ok: false, state: null, error }, assistance: null,
});
const isWide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;
const scopeOf = (page: Page) => (isWide(page) ? "panel" : "drawer");
// What the real commands route returns for any command but Send: the saved state with the Virtual
// Guide marked unavailable, because that path never checks it.
const commandResult = (state: ExplorerConversationState): ExplorerConversationState => ({ ...state, providerState: "unavailable" });

async function openPage(page: Page, read: () => ExplorerConversationState) {
  await page.route("**/explorer/conversation/state", route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(read())) }));
  await page.goto("/explorer/conversation");
  await expect(page.getByRole("heading", { level: 1, name: "Your conversation", exact: true })).toBeFocused();
}

// The wide panel, or on a phone the Compass & Waypoint drawer, opened.
async function openCard(page: Page): Promise<Locator> {
  if (isWide(page)) return page.locator("#conversation-preview-panel");
  await page.locator("#conversation-preview-drawer-opener").click();
  const drawer = page.getByRole("dialog", { name: "Compass & Waypoint" });
  await expect(drawer).toBeVisible();
  return drawer;
}

async function closeDrawer(page: Page) {
  if (isWide(page)) return;
  await page.getByRole("dialog", { name: "Compass & Waypoint" }).getByRole("button", { name: "Close Compass & Waypoint", exact: true }).click();
}

const compassOf = (card: Locator) => card.getByRole("region", { name: "Compass", exact: true });
const needleGroup = (card: Locator) => compassOf(card).getByRole("group", { name: "Point the needle to change topic", exact: true });
const point = (group: Locator, label: string) => group.getByRole("button", { name: new RegExp(`^${label}`) });
// The view switch names the view it switches to.
const viewToggle = (card: Locator) => compassOf(card).getByRole("button", { name: /^(?:Compact|Full) view of the Compass$/ });
const dialOf = (card: Locator) => compassOf(card).getByRole("img", { name: "Your Compass", exact: true });
async function showCompact(card: Locator) {
  const toggle = viewToggle(card);
  await expect(toggle).toHaveAccessibleName("Compact view of the Compass");
  await toggle.click();
  await expect(toggle).toHaveAccessibleName("Full view of the Compass");
  await expect(dialOf(card)).toHaveCount(0);
}
// A dial point's button lies over its drawn bubble (the nth point on the dial, in position order).
async function expectOverBubble(card: Locator, button: Locator, index: number) {
  const bubble = await dialOf(card).locator("g > circle").nth(index).boundingBox();
  const box = await button.boundingBox();
  expect(bubble).not.toBeNull();
  expect(box).not.toBeNull();
  if (!bubble || !box) return;
  expect(Math.abs(box.x + box.width / 2 - (bubble.x + bubble.width / 2))).toBeLessThan(1);
  expect(Math.abs(box.y + box.height / 2 - (bubble.y + bubble.height / 2))).toBeLessThan(1);
  expect(Math.abs(box.width - bubble.width)).toBeLessThan(3);
  expect(Math.abs(box.height - bubble.height)).toBeLessThan(3);
}
// A bottom-row place's button lies over its grey label (centred on it, and covering it from top to bottom).
async function expectOverRowPlace(card: Locator, button: Locator, label: string) {
  // The row shows the label cut to one line (bottomRowLabel), so it is found by that text.
  const text = await dialOf(card).locator("text", { hasText: bottomRowLabel(label) }).boundingBox();
  const box = await button.boundingBox();
  expect(text).not.toBeNull();
  expect(box).not.toBeNull();
  if (!text || !box) return;
  expect(Math.abs(box.x + box.width / 2 - (text.x + text.width / 2))).toBeLessThan(1.5);
  expect(text.y).toBeGreaterThanOrEqual(box.y - 0.5);
  expect(text.y + text.height).toBeLessThanOrEqual(box.y + box.height + 0.5);
  expect(text.width).toBeLessThanOrEqual(box.width);
}
// A drawn SVG shape is painted by its colour class (the browser's default fill would be black).
async function expectPainted(shape: Locator) {
  expect(await shape.evaluate((element) => getComputedStyle(element).fill)).not.toMatch(/^(?:rgb\(0, 0, 0\)|none)$/);
}
// The card's line: a hold's reason, or the result after the needle moved. Fix round 3: it is polite
// (live) only in the phone drawer, where the page's status line is behind the modal; on the wide
// panel the page's own status line is not hidden, so the card's line is shown but not announced.
const liveLine = (group: Locator) => group.locator('[id$="-connected-needle-live"]');
async function expectLiveOnlyInDrawer(page: Page, group: Locator) {
  const line = liveLine(group);
  await expect(line).toHaveCount(1);
  await expect(line).toHaveAttribute("id", `${scopeOf(page)}-connected-needle-live`);
  if (isWide(page)) {
    await expect(group.locator("[aria-live]")).toHaveCount(0);
  } else {
    await expect(line).toHaveAttribute("aria-live", "polite");
    await expect(line).toHaveAttribute("aria-atomic", "true");
  }
}
// The card texts the redesign removed (Paul: "there is too much text explaining things").
const REMOVED_CARD_TEXTS = [
  "To show what you want to focus on now, choose a point. The needle moves there, and your Priority stays the same.",
  /first place it on your Compass with Review Compass arrangement/,
  /not on your Compass, switch to Compact view\./,
  "New points will show as Forming until you confirm them at a natural pause.",
  "The needle will follow what you are talking about right now. It never changes your Priority.",
] as const;
async function expectNoRemovedTexts(card: Locator) {
  for (const text of REMOVED_CARD_TEXTS) {
    await expect(card.getByText(text, typeof text === "string" ? { exact: true } : undefined)).toHaveCount(0);
  }
  await expect(compassOf(card).getByText("Not connected yet", { exact: true })).toHaveCount(0);
}
// The dashed needle's button, and the needle drawn dashed.
const dashedButton = (card: Locator) => compassOf(card).getByRole("button", { name: DASHED_NEEDLE_WORDING.button, exact: true });
const dashedLine = (card: Locator) => dialOf(card).locator('line[stroke-dasharray="8 6"]');
const composer = (page: Page) => page.getByLabel("Continue the conversation", { exact: true });
const sendButton = (page: Page) => page.getByRole("button", { name: "Send", exact: true });
const unavailableNotice = (page: Page) => page.getByText(/Virtual Guide is unavailable\. You can review saved messages/);

test("S5 reply state adds and revises a dashed Forming point that survives reload and loses its marker when confirmed", async ({ page }) => {
  const original = cardState();
  let state = cardState({ providerState: "available",
    compassItems: original.compassItems.filter(item => item.id !== CARD_POINTS.unarranged) });
  let sends = 0;
  await page.route("**/explorer/conversation/commands", async route => {
    const command = route.request().postDataJSON() as { kind: string; body: string };
    expect(command.kind).toBe("send");
    sends += 1;
    const explorerId = `20000000-0000-4000-8000-0000000000a${sends}`;
    const replyId = `30000000-0000-4000-8000-0000000000a${sends}`;
    const label = sends === 1 ? "Accepting help" : "Asking for support";
    const forming = { id: CARD_POINTS.unarranged, sourceMessageId: "30000000-0000-4000-8000-0000000000a1",
      label, formation: "forming" as const, anchor: null, emphasis: null, mergedIntoItemId: null };
    state = { ...state, revision: state.revision + 1, messages: [...state.messages,
      { id: explorerId, role: "explorer", body: command.body, createdAt: "2026-11-04T22:00:00.000Z" },
      { id: replyId, role: "virtualGuide", body: `Synthetic forming reply ${sends}.`, createdAt: "2026-11-04T22:00:01.000Z" }],
    compassItems: [...state.compassItems.filter(item => item.id !== CARD_POINTS.unarranged), forming] };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(state)) });
  });
  await openPage(page, () => state);
  await composer(page).fill("A synthetic topic about accepting help.");
  await sendButton(page).click();
  await expect(page.getByText("Synthetic forming reply 1.", { exact: true })).toBeVisible();
  let card = await openCard(page);
  await expect(point(needleGroup(card), "Accepting help")).toHaveAccessibleName("Accepting help Not yet arranged Forming");
  await expect(dialOf(card).locator('rect[stroke-dasharray="4 3"]')).toHaveCount(1);
  await expect(dialOf(card).locator("text", { hasText: /^Forming$/ })).toBeVisible();
  await showCompact(card);
  await expect(point(needleGroup(card), "Accepting help")).toHaveCSS("border-top-style", "dashed");
  await expect(point(needleGroup(card), "Accepting help")).toContainText("Forming");
  await expectNoSidewaysScroll(page);
  await closeDrawer(page);

  await composer(page).fill("A synthetic clarification about asking for support.");
  await sendButton(page).click();
  await expect(page.getByText("Synthetic forming reply 2.", { exact: true })).toBeVisible();
  await page.reload();
  card = await openCard(page);
  await expect(point(needleGroup(card), "Asking for support")).toHaveAccessibleName("Asking for support Not yet arranged Forming");
  await expect(point(needleGroup(card), "Accepting help")).toHaveCount(0);
  await expect(compassOf(card).getByRole("button", { name: /That's right|That's not it/ })).toHaveCount(0);
  await expectNoSeriousAxeViolations(page);
  await closeDrawer(page);

  // Confirmation controls are S6. A subsequent saved-state read supplies the confirmed marker here.
  state = { ...state, compassItems: state.compassItems.map(item => item.id === CARD_POINTS.unarranged
    ? { ...item, formation: "saved" } : item) };
  await page.reload();
  card = await openCard(page);
  await expect(point(needleGroup(card), "Asking for support")).toHaveAccessibleName("Asking for support Not yet arranged");
  await expect(dialOf(card).locator('rect[stroke-dasharray="4 3"]')).toHaveCount(0);
  expect(sends).toBe(2);
});

test("the card draws the saved Compass and Waypoints, and tapping a point on the dial sends exactly the existing set_attention command", async ({ page }) => {
  // The Virtual Guide is unavailable in this state: pointing the needle does not need it.
  let state = cardState();
  const bodies: string[] = [];
  let respond: () => void = () => {};
  const responded = new Promise<void>(resolve => { respond = resolve; });
  await page.route("**/explorer/conversation/commands", async route => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    expect(request.headers()["content-type"]).toBe("application/json");
    bodies.push(request.postData() ?? "");
    await responded;
    const command = JSON.parse(bodies[0]) as { itemId: string; operationId: string };
    state = { ...state, revision: 13, attentionId: command.itemId, route: [{ operationId: command.operationId, revision: 13,
      kind: "attention_changed", compassItemId: command.itemId, label: CARD_LABELS.detour, recordedAt: "2026-11-03T15:00:00.000Z" }] };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(state)) });
  });
  await openPage(page, () => state);
  const card = await openCard(page);

  // S1: the saved Compass on its 8 positions, Priority at the top, the needle at the saved attention point,
  // in the Full view, which shows first.
  const compass = compassOf(card);
  const dial = dialOf(card);
  await expect(dial).toBeVisible();
  await expect(viewToggle(card)).toHaveAccessibleName("Compact view of the Compass");
  await expect(dial).toHaveAccessibleDescription(/^Priority: Talk with my sister\. .* Not yet arranged: Asking for help\. Other paths: Avoiding hard talks\. The needle points to What I need from it\.$/);
  await expect(dial.locator("circle[r='28']")).toHaveCount(8);
  const group = needleGroup(card);
  // Since the redesign: "Point the needle to change topic", with no instruction under it.
  await expect(compass.getByRole("heading", { level: 4, name: "Point the needle to change topic", exact: true })).toBeVisible();
  await expect(group).toHaveAccessibleDescription("");
  await expectNoRemovedTexts(card);
  // Each point drawn on the dial is a button over its bubble, with the list's name; each point without a
  // position is a button over its place in the bottom row.
  await expect(group.getByRole("button")).toHaveCount(7);
  const drawn = [CARD_LABELS.priority, CARD_LABELS.attention, CARD_LABELS.longLabel, CARD_LABELS.detour, CARD_LABELS.excursion];
  for (const [index, label] of drawn.entries()) await expectOverBubble(card, point(group, label), index);
  const current = point(group, CARD_LABELS.attention);
  await expect(current).toHaveAttribute("aria-pressed", "true");
  await expect(current).toBeDisabled();
  await expect(current).toHaveAccessibleName(`${CARD_LABELS.attention} Upper left The needle points here`);
  // The bottom row, under Excursion: the two points without a position, in grey, each with a yellow symbol;
  // each is an enabled button over its own place, below every bubble.
  for (const [label, place] of [[CARD_LABELS.unarranged, "Not yet arranged"], [CARD_LABELS.otherPath, "Other paths"]]) {
    const button = point(group, label);
    await expect(button).toBeEnabled();
    await expect(button).toHaveAccessibleName(`${label} ${place}`);
    await expectOverRowPlace(card, button, label);
  }
  await expect(dial.locator("text", { hasText: CARD_LABELS.unarranged })).toHaveClass("fill-stone-400 text-[9px]");
  await expect(dial.locator("path.fill-yellow-300")).toHaveCount(2);
  await expectPainted(dial.locator("path.fill-yellow-300").first());
  await expect(dashedLine(card)).toHaveCount(0);
  await expect(dashedButton(card)).toHaveCount(0);
  await expect(compass.getByText("Priority:", { exact: true })).toBeVisible();
  await expect(compass.getByText("Current attention:", { exact: true })).toBeVisible();
  await expect(card.getByText(CARD_LABELS.merged)).toHaveCount(0);
  // Nothing is said in the live line before a hold or a change, and it is live only in the drawer.
  await expect(liveLine(group)).toHaveText("");
  await expectLiveOnlyInDrawer(page, group);
  // The saved Waypoints with their stages and earlier versions.
  const waypoints = card.getByRole("region", { name: "Waypoints", exact: true });
  await expect(waypoints.getByRole("article")).toHaveCount(3);
  for (const label of ["Formed", "Reached", "Released", "Earlier version - Formed", "Earlier version - Reached", "Earlier version - Released"]) {
    await expect(waypoints.getByText(label, { exact: true })).toBeVisible();
  }
  await expectNoSidewaysScroll(page);
  await expectNoSeriousAxeViolations(page);
  expect(bodies).toHaveLength(0);

  // S2: the Explorer points the needle by tapping a point on the dial.
  const target = point(group, CARD_LABELS.detour);
  await expect(target).toBeEnabled();
  await expect(target).toHaveAccessibleName(`${CARD_LABELS.detour} Detour, left`);
  await target.click();
  // While the change is checked every point waits, with the reason on screen and in the live line
  // (polite in the drawer only).
  await expect(liveLine(group)).toHaveText(NEEDLE_HOLD_TEXT.busy);
  await expectLiveOnlyInDrawer(page, group);
  await expect(target).toBeDisabled();
  await expect(target).toHaveAccessibleDescription(NEEDLE_HOLD_TEXT.busy);
  await expect(point(group, CARD_LABELS.priority)).toBeDisabled();
  expect(bodies).toHaveLength(1);
  const sent = JSON.parse(bodies[0]) as { operationId: string };
  expect(sent.operationId).toMatch(UUID_V4);
  expect(bodies[0]).toBe(JSON.stringify({ kind: "set_attention", itemId: CARD_POINTS.detour, operationId: sent.operationId, expectedRevision: 12 }));
  respond();

  // The needle moved; the Priority did not. The live line says so, and focus is on the "Current attention" line.
  await expect(target).toHaveAttribute("aria-pressed", "true");
  await expect(liveLine(group)).toHaveText(needleMovedText(CARD_LABELS.detour));
  await expectLiveOnlyInDrawer(page, group);
  const currentLine = card.locator(`#${scopeOf(page)}-connected-needle-current`);
  await expect(currentLine).toBeFocused();
  await expect(currentLine).toHaveText(`Current attention:${CARD_LABELS.detour}`);
  await expect(dial).toHaveAccessibleDescription(/^Priority: Talk with my sister\. .* The needle points to Money worries\.$/);
  await expect(current).toHaveAttribute("aria-pressed", "false");
  await expect(current).toBeEnabled();
  await expect(point(group, CARD_LABELS.priority)).toHaveAccessibleName(`${CARD_LABELS.priority} Priority`);
  await expect(point(group, CARD_LABELS.detour)).toHaveAccessibleName(`${CARD_LABELS.detour} Detour, left The needle points here`);
  await expect(group.getByText(NEEDLE_HOLD_TEXT.busy, { exact: true })).toHaveCount(0);
  // The needle is drawn toward the new point (Detour, left: its end stops 32 short of the bubble's centre at 88, 150).
  const needle = dial.locator("line.stroke-orange-300");
  await expect(needle).toHaveCount(1);
  expect(Number(await needle.getAttribute("x2"))).toBeCloseTo(120, 2);
  expect(Number(await needle.getAttribute("y2"))).toBeCloseTo(150, 2);
  await expectNoSeriousAxeViolations(page);
  await closeDrawer(page);
  await expect(page.getByLabel("Private Compass and Waypoints", { exact: true }).getByText(`Current attention: ${CARD_LABELS.detour}`, { exact: true })).toBeVisible();
  expect(bodies).toHaveLength(1);
});

test("keyboard: Tab reaches each point on the dial and Enter points the needle; then focus is on the Current attention line", async ({ page }) => {
  let state = cardState();
  const bodies: string[] = [];
  await page.route("**/explorer/conversation/commands", async route => {
    bodies.push(route.request().postData() ?? "");
    const command = JSON.parse(bodies[0]) as { itemId: string };
    state = { ...state, revision: 13, attentionId: command.itemId };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(commandResult(state))) });
  });
  await openPage(page, () => state);
  const card = await openCard(page);
  const group = needleGroup(card);
  // From the view switch, Tab goes to the dial's points in position order, then to the bottom row's points
  // (since the redesign). The current point is disabled, so Tab passes it.
  await viewToggle(card).focus();
  for (const label of [CARD_LABELS.priority, CARD_LABELS.longLabel, CARD_LABELS.detour, CARD_LABELS.excursion, CARD_LABELS.unarranged, CARD_LABELS.otherPath]) {
    await page.keyboard.press("Tab");
    await expect(point(group, label), label).toBeFocused();
    // The focus ring shows on the round button, and on the row's buttons.
    await expect(point(group, label), label).toHaveCSS("outline-width", "2px");
  }
  for (let step = 0; step < 4; step += 1) await page.keyboard.press("Shift+Tab");
  const target = point(group, CARD_LABELS.longLabel);
  await expect(target).toBeFocused();
  expect(bodies).toHaveLength(0);
  await page.keyboard.press("Enter");
  const currentLine = card.locator(`#${scopeOf(page)}-connected-needle-current`);
  await expect(currentLine).toBeFocused();
  await expect(currentLine).toHaveText(`Current attention:${CARD_LABELS.longLabel}`);
  await expect(target).toHaveAttribute("aria-pressed", "true");
  await expect(liveLine(group)).toHaveText(needleMovedText(CARD_LABELS.longLabel));
  expect(bodies).toHaveLength(1);
  expect(JSON.parse(bodies[0])).toMatchObject({ kind: "set_attention", itemId: CARD_POINTS.longLabel, expectedRevision: 12 });
});

test("an unconfirmed needle change holds the card until the exact same request is retried (on a phone, inside the drawer, saying where Retry is)", async ({ page }) => {
  let state = cardState();
  const bodies: string[] = [];
  await page.route("**/explorer/conversation/commands", async route => {
    bodies.push(route.request().postData() ?? "");
    if (bodies.length === 1) return route.abort();
    const command = JSON.parse(bodies[1]) as { itemId: string };
    state = { ...state, revision: 13, attentionId: command.itemId };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(state)) });
  });
  await openPage(page, () => state);
  let card = await openCard(page);
  const reason = needleHoldText("uncertain", !isWide(page));
  if (!isWide(page)) expect(reason).toBe(NEEDLE_HOLD_DRAWER_TEXT.uncertain);
  await point(needleGroup(card), CARD_LABELS.excursion).click();
  // The reason is said in the card's live line; on a phone the drawer stays open and says where Retry is.
  await expect(liveLine(needleGroup(card))).toHaveText(reason);
  await expectLiveOnlyInDrawer(page, needleGroup(card));
  await expect(card).toBeVisible();
  await expect(point(needleGroup(card), CARD_LABELS.priority)).toBeDisabled();
  await expect(point(needleGroup(card), CARD_LABELS.priority)).toHaveAccessibleDescription(reason);
  await closeDrawer(page);
  await page.getByRole("button", { name: "Retry the same request", exact: true }).click();
  card = await openCard(page);
  await expect(point(needleGroup(card), CARD_LABELS.excursion)).toHaveAttribute("aria-pressed", "true");
  await expect(needleGroup(card).getByText(reason, { exact: true })).toHaveCount(0);
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toBe(bodies[0]);
});

test("phone: a refusal from the drawer closes it and moves focus to the page's alert and its action", async ({ page }) => {
  test.skip(isWide(page), "narrow layout only");
  const errors: ("refresh_required" | "denied")[] = ["refresh_required", "denied"];
  const bodies: string[] = [];
  await page.route("**/explorer/conversation/commands", async route => {
    bodies.push(route.request().postData() ?? "");
    const error = errors[bodies.length - 1];
    await route.fulfill({ status: error === "denied" ? 403 : 409, contentType: "application/json", body: JSON.stringify(failure(error)) });
  });
  await openPage(page, () => cardState());
  const drawer = page.getByRole("dialog", { name: "Compass & Waypoint" });

  // The saved conversation changed elsewhere: the existing alert, with Reload next to it.
  let card = await openCard(page);
  await point(needleGroup(card), CARD_LABELS.detour).click();
  await expect(drawer).toBeHidden();
  const changed = page.getByRole("alert").filter({ hasText: "Your conversation has changed. Reload the saved conversation before making another change." });
  await expect(changed).toBeFocused();
  const reload = page.getByRole("button", { name: "Reload saved conversation", exact: true });
  await expect(reload).toBeEnabled();
  await reload.click();
  await expect(changed).toHaveCount(0);

  // A sign-in problem: the existing alert with its Sign in link.
  card = await openCard(page);
  await point(needleGroup(card), CARD_LABELS.detour).click();
  await expect(drawer).toBeHidden();
  const denied = page.getByRole("alert").filter({ hasText: "This conversation is not available in your current session. Sign in again to continue." });
  await expect(denied).toBeFocused();
  await expect(denied.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/login/explorer");
  // The drawer still opens, and says the saved Compass is not shown now.
  card = await openCard(page);
  await expect(card.getByText(CONNECTED_COMPASS_WORDING.notLoaded, { exact: true })).toBeVisible();
  expect(bodies).toHaveLength(2);
});

test("after the needle moves, Send stays usable: the screen keeps the Virtual Guide state it last read", async ({ page }) => {
  let state = cardState({ providerState: "available" });
  const bodies: string[] = [];
  await page.route("**/explorer/conversation/commands", async route => {
    bodies.push(route.request().postData() ?? "");
    const command = JSON.parse(bodies[0]) as { itemId: string };
    state = { ...state, revision: 13, attentionId: command.itemId };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(commandResult(state))) });
  });
  await openPage(page, () => state);
  await expect(composer(page)).toBeEnabled();
  await expect(sendButton(page)).toBeEnabled();
  const card = await openCard(page);
  const group = needleGroup(card);
  await point(group, CARD_LABELS.detour).click();
  await expect(point(group, CARD_LABELS.detour)).toHaveAttribute("aria-pressed", "true");
  await closeDrawer(page);
  await expect(page.getByRole("status").first()).toHaveText("Your saved conversation is up to date.");
  await expect(composer(page)).toBeEnabled();
  await expect(sendButton(page)).toBeEnabled();
  await expect(unavailableNotice(page)).toHaveCount(0);
  expect(bodies).toHaveLength(1);
  expect(JSON.parse(bodies[0])).toMatchObject({ kind: "set_attention", itemId: CARD_POINTS.detour });
});

test("after a current-tools command (adding a point), Send stays usable too", async ({ page }) => {
  let state = cardState({ providerState: "available" });
  const source = state.messages[0].id;
  const added = "40000000-0000-4000-8000-0000000000c9";
  const bodies: string[] = [];
  await page.route("**/explorer/conversation/commands", async route => {
    bodies.push(route.request().postData() ?? "");
    const command = JSON.parse(bodies[0]) as { kind: string; sourceMessageId: string; label: string };
    state = { ...state, revision: 13, compassItems: [...state.compassItems,
      { id: added, sourceMessageId: command.sourceMessageId, label: command.label, anchor: null, emphasis: null, mergedIntoItemId: null }] };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(commandResult(state))) });
  });
  await openPage(page, () => state);
  await expect(sendButton(page)).toBeEnabled();
  const tools = page.getByRole("region", { name: "Session Compass", exact: true });
  await tools.getByRole("combobox", { name: "Saved conversation source", exact: true }).selectOption(source);
  await tools.getByLabel("Your short label", { exact: true }).fill("Asking for a calm hour");
  // The current tools keep points without a position under a collapsed "Other paths" count.
  await expect(tools.locator("summary", { hasText: "Other paths (2)" })).toBeVisible();
  await tools.getByRole("button", { name: "Save Compass point", exact: true }).click();
  await expect(page.getByRole("status").first()).toHaveText("Your saved conversation is up to date.");
  await expect(tools.locator("summary", { hasText: "Other paths (3)" })).toBeVisible();
  await expect(composer(page)).toBeEnabled();
  await expect(sendButton(page)).toBeEnabled();
  await expect(unavailableNotice(page)).toHaveCount(0);
  expect(bodies).toHaveLength(1);
  expect(JSON.parse(bodies[0])).toMatchObject({ kind: "add_compass", sourceMessageId: source, label: "Asking for a calm hour", expectedRevision: 12 });
  // The card shows the new point as not yet arranged: not on the dial but in its bottom row (now 3 places,
  // after the other point not yet arranged), and in the Compact view's list.
  const card = await openCard(page);
  const addedPoint = point(needleGroup(card), "Asking for a calm hour");
  await expect(addedPoint).toHaveAccessibleName("Asking for a calm hour Not yet arranged");
  await expect(addedPoint).toBeEnabled();
  await expectOverRowPlace(card, addedPoint, "Asking for a calm hour");
  await expect(dialOf(card).locator("path.fill-yellow-300")).toHaveCount(3);
  await showCompact(card);
  await expect(point(needleGroup(card), "Asking for a calm hour")).toHaveAccessibleName("Asking for a calm hour Not yet arranged");
});

test("after a Send refused as unavailable, a needle move keeps Send disabled with its notice", async ({ page }) => {
  // Fix round 3 (REV221b R2-ANG1-01): the refusal is the server's latest word on the Virtual Guide,
  // so the state the screen keeps says unavailable, and the needle move's result does not undo it.
  let state = cardState({ providerState: "available" });
  const typed = "A synthetic test message that is not saved";
  const bodies: string[] = [];
  await page.route("**/explorer/conversation/commands", async route => {
    bodies.push(route.request().postData() ?? "");
    if (bodies.length === 1) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify(failure("provider_unavailable")) });
      return;
    }
    const command = JSON.parse(bodies[1]) as { itemId: string };
    state = { ...state, revision: 13, attentionId: command.itemId };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(commandResult(state))) });
  });
  await openPage(page, () => state);
  await expect(sendButton(page)).toBeEnabled();
  await composer(page).fill(typed);
  await sendButton(page).click();
  const refused = page.getByRole("alert").filter({ hasText: "No new message or reply has been confirmed saved." });
  await expect(refused).toBeVisible();
  await expect(sendButton(page)).toBeDisabled();
  await expect(unavailableNotice(page)).toBeVisible();

  const card = await openCard(page);
  const group = needleGroup(card);
  await point(group, CARD_LABELS.detour).click();
  await expect(point(group, CARD_LABELS.detour)).toHaveAttribute("aria-pressed", "true");
  await closeDrawer(page);
  await expect(page.getByRole("status").first()).toHaveText("Your saved conversation is up to date.");
  // The refusal's alert is cleared by the confirmed move, so only the kept Virtual Guide state now
  // holds Send: it stays disabled, the composer keeps the typed message, and the notice stays.
  await expect(refused).toHaveCount(0);
  await expect(sendButton(page)).toBeDisabled();
  await expect(composer(page)).toBeDisabled();
  await expect(composer(page)).toHaveValue(typed);
  await expect(unavailableNotice(page)).toBeVisible();
  await expect(composer(page)).toHaveAccessibleDescription(/^The SolMind Virtual Guide is unavailable\. You can review saved messages/);
  expect(bodies).toHaveLength(2);
  expect(JSON.parse(bodies[0])).toMatchObject({ kind: "send", body: typed, expectedRevision: 12 });
  expect(JSON.parse(bodies[1])).toMatchObject({ kind: "set_attention", itemId: CARD_POINTS.detour, expectedRevision: 12 });
});

test("an ended conversation shows its Compass read-only and says why the needle cannot move", async ({ page }) => {
  let commands = 0;
  await page.route("**/explorer/conversation/commands", route => { commands += 1; return route.abort(); });
  await openPage(page, () => cardState({ sessionStatus: "ended" }));
  const card = await openCard(page);
  // Both views: the dial's 5 points and the bottom row's 2 in the Full view, then (the switch still works after
  // End) the list's 7.
  for (const shown of ["full", "compact"] as const) {
    const group = needleGroup(card);
    await expect(group.getByText(NEEDLE_HOLD_TEXT.ended, { exact: true })).toBeVisible();
    await expect(group).toHaveAccessibleDescription(NEEDLE_HOLD_TEXT.ended);
    const buttons = group.getByRole("button");
    await expect(buttons).toHaveCount(7);
    for (let index = 0; index < 7; index += 1) {
      await expect(buttons.nth(index)).toBeDisabled();
      await expect(buttons.nth(index)).toHaveAccessibleDescription(NEEDLE_HOLD_TEXT.ended);
    }
    // One read-only line: no instruction, and no pointer to the current tools, which are read-only after End.
    await expectNoRemovedTexts(card);
    await expect(page.getByText(CURRENT_TOOLS_POINTER, { exact: true })).toHaveCount(0);
    if (shown === "full") await showCompact(card);
  }
  await expect(card.getByRole("region", { name: "Waypoints", exact: true }).getByRole("article")).toHaveCount(3);
  await expectNoSidewaysScroll(page);
  expect(commands).toBe(0);
});

test("the view switch shows one view at a time and keeps the choice while the page is open", async ({ page }) => {
  let commands = 0;
  await page.route("**/explorer/conversation/commands", route => { commands += 1; return route.abort(); });
  await openPage(page, () => cardState());
  let card = await openCard(page);
  const toggle = viewToggle(card);
  const viewId = `${scopeOf(page)}-connected-compass-view`;
  await expect(toggle).toHaveAttribute("aria-controls", viewId);
  await expect(compassOf(card).locator(`#${viewId}`)).toBeVisible();
  // Full, first: the dial with the two lines, and no list.
  await expect(toggle).toHaveAccessibleName("Compact view of the Compass");
  await expect(dialOf(card)).toBeVisible();
  // (Each group of the list is a list named by its label.)
  for (const name of ["On your Compass", "Not yet arranged", "Other paths"]) {
    await expect(compassOf(card).getByRole("list", { name, exact: true })).toHaveCount(0);
  }
  await expect(compassOf(card).getByText("Current attention:", { exact: true })).toBeVisible();
  // Compact, by keyboard: the list with the two lines, and no dial; focus stays on the switch.
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAccessibleName("Full view of the Compass");
  await expect(toggle).toBeFocused();
  await expect(dialOf(card)).toHaveCount(0);
  await expectNoRemovedTexts(card);
  for (const [name, count] of [["On your Compass", 5], ["Not yet arranged", 1], ["Other paths", 1]] as const) {
    const list = compassOf(card).getByRole("list", { name, exact: true });
    await expect(list).toBeVisible();
    await expect(list.getByRole("button")).toHaveCount(count);
  }
  await expect(compassOf(card).getByText("Priority:", { exact: true })).toBeVisible();
  await expect(compassOf(card).getByText("Current attention:", { exact: true })).toBeVisible();
  const group = needleGroup(card);
  await expect(compassOf(card).getByRole("heading", { level: 4, name: "Point the needle to change topic", exact: true })).toBeVisible();
  await expect(group).toHaveAccessibleDescription("");
  await expect(group.getByRole("button")).toHaveCount(7);
  // Since the redesign the points without a position can take the needle on an arranged Compass too: they are
  // enabled, in grey with the yellow symbol, and need no explanation.
  for (const label of [CARD_LABELS.unarranged, CARD_LABELS.otherPath]) {
    await expect(point(group, label)).toBeEnabled();
    await expect(point(group, label)).toHaveAccessibleDescription("");
    await expect(point(group, label)).toHaveClass(/(?:^| )text-stone-400(?: |$)/);
    await expect(point(group, label).locator("svg.fill-yellow-300")).toHaveCount(1);
    await expectPainted(point(group, label).locator("svg.fill-yellow-300 path"));
  }
  await expect(point(group, CARD_LABELS.detour).locator("svg")).toHaveCount(0);
  await expectLiveOnlyInDrawer(page, group);
  await expectNoSidewaysScroll(page);
  await expectNoSeriousAxeViolations(page);
  // The choice is screen state: it stays while the page is open, after hiding and showing the wide panel or
  // closing and reopening the phone drawer.
  if (isWide(page)) {
    const panelToggle = page.locator("#conversation-preview-panel-toggle");
    await panelToggle.click();
    await expect(card).toBeHidden();
    await panelToggle.click();
    await expect(card).toBeVisible();
  } else {
    await closeDrawer(page);
    card = await openCard(page);
  }
  await expect(viewToggle(card)).toHaveAccessibleName("Full view of the Compass");
  await expect(dialOf(card)).toHaveCount(0);
  await viewToggle(card).click();
  await expect(dialOf(card)).toBeVisible();
  await expect(viewToggle(card)).toHaveAccessibleName("Compact view of the Compass");
  expect(commands).toBe(0);
});

test("the wide panel and the phone drawer each keep their own view", async ({ page }) => {
  test.skip(!isWide(page), "one run is enough: it changes the window size itself");
  await openPage(page, () => cardState());
  const panel = await openCard(page);
  await showCompact(panel);
  // Narrow the window: the drawer's card starts in the Full view.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#conversation-preview-drawer-opener").click();
  const drawer = page.getByRole("dialog", { name: "Compass & Waypoint" });
  await expect(drawer).toBeVisible();
  await expect(viewToggle(drawer)).toHaveAccessibleName("Compact view of the Compass");
  await expect(dialOf(drawer)).toBeVisible();
  await drawer.getByRole("button", { name: "Close Compass & Waypoint", exact: true }).click();
  // Widen it again: the panel kept the Compact view.
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(viewToggle(panel)).toHaveAccessibleName("Full view of the Compass");
  await expect(dialOf(panel)).toHaveCount(0);
});

test("Compact view: choosing a point in the list sends exactly the existing set_attention command", async ({ page }) => {
  let state = cardState();
  const bodies: string[] = [];
  let respond: () => void = () => {};
  const responded = new Promise<void>(resolve => { respond = resolve; });
  await page.route("**/explorer/conversation/commands", async route => {
    bodies.push(route.request().postData() ?? "");
    await responded;
    const command = JSON.parse(bodies[0]) as { itemId: string };
    state = { ...state, revision: 13, attentionId: command.itemId };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(commandResult(state))) });
  });
  await openPage(page, () => state);
  const card = await openCard(page);
  await showCompact(card);
  const group = needleGroup(card);
  const target = point(group, CARD_LABELS.excursion);
  await expect(target).toHaveAccessibleName(`${CARD_LABELS.excursion} Excursion, lower center`);
  await target.click();
  await expect(liveLine(group)).toHaveText(NEEDLE_HOLD_TEXT.busy);
  await expect(target).toBeDisabled();
  await expect(target).toHaveAccessibleDescription(NEEDLE_HOLD_TEXT.busy);
  expect(bodies).toHaveLength(1);
  const sent = JSON.parse(bodies[0]) as { operationId: string };
  expect(sent.operationId).toMatch(UUID_V4);
  expect(bodies[0]).toBe(JSON.stringify({ kind: "set_attention", itemId: CARD_POINTS.excursion, operationId: sent.operationId, expectedRevision: 12 }));
  respond();
  await expect(target).toHaveAttribute("aria-pressed", "true");
  await expect(liveLine(group)).toHaveText(needleMovedText(CARD_LABELS.excursion));
  const currentLine = card.locator(`#${scopeOf(page)}-connected-needle-current`);
  await expect(currentLine).toBeFocused();
  await expect(currentLine).toHaveText(`Current attention:${CARD_LABELS.excursion}`);
  // The Full view shows the same saved needle on the dial.
  await viewToggle(card).click();
  await expect(point(needleGroup(card), CARD_LABELS.excursion)).toHaveAttribute("aria-pressed", "true");
  await expect(dialOf(card)).toHaveAccessibleDescription(/ The needle points to Planning what to say\.$/);
  expect(bodies).toHaveLength(1);
});

// The chat card redesign (Paul's design and decision, decision queue 2026-11-03 18:05:33 CST).
test("redesign: tapping a point in the bottom row sends exactly set_attention, and the needle is then dashed and explains itself", async ({ page }) => {
  let state = cardState();
  const bodies: string[] = [];
  let respond: () => void = () => {};
  const responded = new Promise<void>(resolve => { respond = resolve; });
  await page.route("**/explorer/conversation/commands", async route => {
    bodies.push(route.request().postData() ?? "");
    await responded;
    const command = JSON.parse(bodies.at(-1) ?? "{}") as { itemId: string };
    state = { ...state, revision: state.revision + 1, attentionId: command.itemId };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(commandResult(state))) });
  });
  await openPage(page, () => state);
  const card = await openCard(page);
  const group = needleGroup(card);
  const dial = dialOf(card);
  // An Other paths point on an arranged Compass: the server takes it since migration 20261103180000.
  const target = point(group, CARD_LABELS.otherPath);
  await expect(target).toBeEnabled();
  await target.click();
  // While the change is checked every point waits, the row's too, with the reason on screen.
  await expect(liveLine(group)).toHaveText(NEEDLE_HOLD_TEXT.busy);
  await expect(target).toBeDisabled();
  await expect(target).toHaveAccessibleDescription(NEEDLE_HOLD_TEXT.busy);
  await expect(point(group, CARD_LABELS.unarranged)).toBeDisabled();
  expect(bodies).toHaveLength(1);
  const sent = JSON.parse(bodies[0]) as { operationId: string };
  expect(sent.operationId).toMatch(UUID_V4);
  expect(bodies[0]).toBe(JSON.stringify({ kind: "set_attention", itemId: CARD_POINTS.otherPath, operationId: sent.operationId, expectedRevision: 12 }));
  respond();

  // Confirmed: the place is pressed and ringed, with the dial's live line and focus.
  await expect(target).toHaveAttribute("aria-pressed", "true");
  await expect(target).toHaveAccessibleName(`${CARD_LABELS.otherPath} Other paths The needle points here`);
  await expect(liveLine(group)).toHaveText(needleMovedText(CARD_LABELS.otherPath));
  const currentLine = card.locator(`#${scopeOf(page)}-connected-needle-current`);
  await expect(currentLine).toBeFocused();
  await expect(currentLine).toHaveText(`Current attention:${CARD_LABELS.otherPath}`);
  await expect(point(group, CARD_LABELS.attention)).toBeEnabled();
  // The needle is drawn dashed all the way to the place (240, 308), stopping outside its orange ring; the
  // place keeps its own yellow symbol and the needle has none at its tip; no solid needle and no orange bubble remain.
  const dashed = dashedLine(card);
  await expect(dashed).toHaveCount(1);
  await expect(dial.locator("line.stroke-orange-300")).toHaveCount(1);
  expect(Number(await dashed.getAttribute("x2"))).toBeCloseTo(235.92, 2);
  expect(Number(await dashed.getAttribute("y2"))).toBeCloseTo(297.25, 2);
  await expect(dial.locator("path.fill-yellow-300")).toHaveCount(2);
  await expect(dial.locator('path.fill-yellow-300[d="M240 303L245 308L240 313L235 308Z"]')).toHaveCount(1);
  await expect(dial.locator("circle.fill-none.stroke-orange-300")).toHaveCount(1);
  await expect(dial.locator("circle.fill-none.stroke-orange-300")).toHaveAttribute("cx", "240");
  await expect(dial.locator("g > circle.stroke-orange-300")).toHaveCount(0);
  await expect(dial).toHaveAccessibleDescription(/ The needle points to Avoiding hard talks, which is in Other paths, off your Compass\.$/);

  // The dashed needle is a button over the needle, 30 along it from the centre (clear of the dial's points): a tap
  // shows one short sentence, the next tap hides it.
  const why = dashedButton(card);
  await expect(why).toBeEnabled();
  await expect(why).toHaveAttribute("aria-expanded", "false");
  await expect(why).toHaveAttribute("aria-controls", `${scopeOf(page)}-connected-needle-why`);
  const middle = await dashed.evaluate((element) => {
    const line = element as SVGLineElement;
    const [x1, y1, x2, y2] = [line.x1.baseVal.value, line.y1.baseVal.value, line.x2.baseVal.value, line.y2.baseVal.value];
    const length = Math.hypot(x2 - x1, y2 - y1);
    const at = new DOMPoint(x1 + ((x2 - x1) * 30) / length, y1 + ((y2 - y1) * 30) / length);
    const screen = at.matrixTransform(line.getScreenCTM() ?? undefined);
    return { x: screen.x, y: screen.y };
  });
  const whyBox = await why.boundingBox();
  expect(whyBox).not.toBeNull();
  if (whyBox) {
    expect(middle.x).toBeGreaterThan(whyBox.x);
    expect(middle.x).toBeLessThan(whyBox.x + whyBox.width);
    expect(middle.y).toBeGreaterThan(whyBox.y);
    expect(middle.y).toBeLessThan(whyBox.y + whyBox.height);
  }
  await why.click();
  await expect(why).toHaveAttribute("aria-expanded", "true");
  const otherSentence = compassOf(card).getByText(DASHED_NEEDLE_WORDING.otherPaths, { exact: true });
  await expect(otherSentence).toBeVisible();
  await expect(otherSentence).toHaveAttribute("id", `${scopeOf(page)}-connected-needle-why`);
  await expectNoSidewaysScroll(page);
  await expectNoSeriousAxeViolations(page);
  await why.click();
  await expect(why).toHaveAttribute("aria-expanded", "false");
  await expect(otherSentence).toHaveCount(0);
  expect(bodies).toHaveLength(1);

  // Then to the point not yet arranged, from the row: exact bytes, and the dashed needle turns toward it (120, 308).
  await point(group, CARD_LABELS.unarranged).click();
  await expect(point(group, CARD_LABELS.unarranged)).toHaveAttribute("aria-pressed", "true");
  expect(bodies).toHaveLength(2);
  const second = JSON.parse(bodies[1]) as { operationId: string };
  expect(second.operationId).toMatch(UUID_V4);
  expect(second.operationId).not.toBe(sent.operationId);
  expect(bodies[1]).toBe(JSON.stringify({ kind: "set_attention", itemId: CARD_POINTS.unarranged, operationId: second.operationId, expectedRevision: 13 }));
  await expect(dashed).toHaveAttribute("x2", "124.08");
  await expect(dashed).toHaveAttribute("y2", "297.25");
  // By keyboard: Tab reaches the dashed needle right after the dial's points; Enter shows its sentence (on a
  // phone, where the current tools are behind the panel, it says so), Enter again hides it.
  await point(group, CARD_LABELS.excursion).focus();
  await page.keyboard.press("Tab");
  await expect(why).toBeFocused();
  await expect(why).toHaveCSS("outline-width", "2px");
  await page.keyboard.press("Enter");
  const placeIt = isWide(page) ? DASHED_NEEDLE_WORDING.unarranged : DASHED_NEEDLE_WORDING.unarrangedDrawer;
  await expect(compassOf(card).getByText(placeIt, { exact: true })).toBeVisible();
  await expect(why).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Enter");
  await expect(compassOf(card).getByText(placeIt, { exact: true })).toHaveCount(0);
  // The row's current point is disabled, so the next Tab goes on to the Other paths point.
  await page.keyboard.press("Tab");
  await expect(point(group, CARD_LABELS.otherPath)).toBeFocused();
  // Back to a point on the dial: the needle is solid again, and the dashed needle and its button are gone.
  await point(group, CARD_LABELS.detour).click();
  await expect(point(group, CARD_LABELS.detour)).toHaveAttribute("aria-pressed", "true");
  await expect(dashed).toHaveCount(0);
  await expect(why).toHaveCount(0);
  await expect(dial.locator("line.stroke-orange-300")).toHaveCount(1);
  expect(bodies).toHaveLength(3);
  expect(JSON.parse(bodies[2])).toMatchObject({ kind: "set_attention", itemId: CARD_POINTS.detour, expectedRevision: 14 });
});

test("redesign: with more than three points without a position the third place is +N more, which opens the Compact view", async ({ page }) => {
  const base = cardState();
  const source = base.messages[0].id;
  const extra = [["c9", "Saying no kindly"], ["ca", "Sleep"], ["cb", "Calling an old friend"]].map(([suffix, label]) => ({
    id: `40000000-0000-4000-8000-0000000000${suffix}`, sourceMessageId: source, label, anchor: null, emphasis: null, mergedIntoItemId: null,
  }));
  let state = cardState({ compassItems: [...base.compassItems, ...extra] });
  const bodies: string[] = [];
  await page.route("**/explorer/conversation/commands", async route => {
    bodies.push(route.request().postData() ?? "");
    const command = JSON.parse(bodies.at(-1) ?? "{}") as { itemId: string };
    state = { ...state, revision: state.revision + 1, attentionId: command.itemId };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(commandResult(state))) });
  });
  await openPage(page, () => state);
  const card = await openCard(page);
  const group = needleGroup(card);
  const dial = dialOf(card);
  // Five points without a position: the first two in saved order, then "+3 more" in the third place.
  // (The bottom row's grey labels are the dial's texts on its line, y 325.)
  await expect(dial.locator('text[y="325"]')).toHaveText([CARD_LABELS.unarranged, "Saying no kindly", "+3 more"]);
  await expect(dial.locator("path.fill-yellow-300")).toHaveCount(2);
  await expect(dial).toHaveAccessibleDescription(/ Not yet arranged: Asking for help\. Not yet arranged: Saying no kindly\. 3 more points are listed in the Compact view\. The needle points to What I need from it\.$/);
  const more = compassOf(card).getByRole("button", { name: "+3 more points, shown in the Compact view", exact: true });
  await expect(more).toBeEnabled();
  await expect(more).toHaveAttribute("aria-controls", `${scopeOf(page)}-connected-compass-view`);
  await expectOverRowPlace(card, more, "+3 more");
  for (const label of [CARD_LABELS.unarranged, "Saying no kindly"]) await expectOverRowPlace(card, point(group, label), label);
  // Keyboard: after the row's two points comes "+3 more"; Enter opens the Compact view, and focus goes to the
  // view switch, since "+3 more" goes away with the Full view.
  await point(group, "Saying no kindly").focus();
  await page.keyboard.press("Tab");
  await expect(more).toBeFocused();
  await expect(more).toHaveCSS("outline-width", "2px");
  await page.keyboard.press("Enter");
  await expect(dialOf(card)).toHaveCount(0);
  const toggle = viewToggle(card);
  await expect(toggle).toHaveAccessibleName("Full view of the Compass");
  await expect(toggle).toBeFocused();
  // The Compact view lists all of them: 4 not yet arranged and 1 Other paths, grey with the yellow symbol.
  await expect(compassOf(card).getByRole("list", { name: "Not yet arranged", exact: true }).getByRole("button")).toHaveCount(4);
  await expect(compassOf(card).getByRole("list", { name: "Other paths", exact: true }).getByRole("button")).toHaveCount(1);
  await expect(group.locator("svg.fill-yellow-300")).toHaveCount(5);
  // Pointing the needle at one that the row does not show: exact bytes; back in the Full view it takes the
  // second place, and the dashed needle points straight down toward it (180, 308).
  const hidden = point(needleGroup(card), "Calling an old friend");
  await expect(hidden).toHaveAccessibleName("Calling an old friend Not yet arranged");
  await hidden.click();
  await expect(hidden).toHaveAttribute("aria-pressed", "true");
  expect(bodies).toHaveLength(1);
  const sent = JSON.parse(bodies[0]) as { operationId: string };
  expect(bodies[0]).toBe(JSON.stringify({ kind: "set_attention", itemId: extra[2].id, operationId: sent.operationId, expectedRevision: 12 }));
  await toggle.click();
  // (A label longer than 20 characters is cut to one line with ASCII dots; its button keeps the full name.)
  await expect(dial.locator('text[y="325"]')).toHaveText([CARD_LABELS.unarranged, "Calling an old...", "+3 more"]);
  await expect(point(needleGroup(card), "Calling an old friend")).toHaveAttribute("aria-pressed", "true");
  await expect(dashedLine(card)).toHaveAttribute("x2", "180");
  await expect(dashedLine(card)).toHaveAttribute("y2", "296.5");
  await expect(dashedButton(card)).toBeVisible();
  await expectNoSidewaysScroll(page);
  await expectNoSeriousAxeViolations(page);
});

test("redesign: after End the dashed needle still explains itself, without pointing to the read-only tools", async ({ page }) => {
  let commands = 0;
  await page.route("**/explorer/conversation/commands", route => { commands += 1; return route.abort(); });
  await openPage(page, () => cardState({ sessionStatus: "ended", attentionId: CARD_POINTS.unarranged }));
  const card = await openCard(page);
  const group = needleGroup(card);
  // The needle is on the point not yet arranged: dashed all the way to its place, and every point is held.
  await expect(dashedLine(card)).toHaveAttribute("x2", "124.08");
  await expect(group.getByText(NEEDLE_HOLD_TEXT.ended, { exact: true })).toBeVisible();
  await expect(point(group, CARD_LABELS.unarranged)).toBeDisabled();
  await expect(point(group, CARD_LABELS.otherPath)).toBeDisabled();
  // Explaining changes nothing saved, so the dashed needle stays usable after End.
  const why = dashedButton(card);
  await expect(why).toBeEnabled();
  await why.click();
  await expect(why).toHaveAttribute("aria-expanded", "true");
  await expect(compassOf(card).getByText(DASHED_NEEDLE_WORDING.unarrangedEnded, { exact: true })).toBeVisible();
  await expect(page.getByText(/Review Compass arrangement/)).toHaveCount(0);
  await expect(page.getByText(CURRENT_TOOLS_POINTER, { exact: true })).toHaveCount(0);
  await why.click();
  await expect(compassOf(card).getByText(DASHED_NEEDLE_WORDING.unarrangedEnded, { exact: true })).toHaveCount(0);
  await expectNoSeriousAxeViolations(page);
  expect(commands).toBe(0);
});
