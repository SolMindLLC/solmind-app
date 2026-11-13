// Mounted UI with mocked endpoints only: no actual sign-in, SQL, provider, Send or human acceptance.
import { expect, test, type Locator, type Page } from "@playwright/test";
import type { ExplorerConversationCommand, ExplorerConversationState } from "../../src/lib/solmind/explorerConversationContract";

test.use({ trace: "off", screenshot: "off", video: "off" });
const CONVERSATION = "a1010000-0000-4000-8000-000000000001";
const SOURCE = "a1020000-0000-4000-8000-000000000001";
const WAYPOINT = "a1030000-0000-4000-8000-000000000001";
const RELEASE = "a1040000-0000-4000-8000-000000000001";
const END = "a1050000-0000-4000-8000-000000000001";
const RELEASED_AT = "2026-10-29T15:05:00Z";
const SOURCE_TEXT = "A retained exact private source <script>plain text only</script>.";
const currentState = (): ExplorerConversationState => ({ waypointCapacity: { activeCount: 1, activeLimit: 20, historyRoom: true, conversationRoom: true }, waypointProjection: { kind: "current_heads" as const, limit: 20 as const, totalHeads: 1, hasMore: false }, version: "explorer-conversation.v1", conversationId: CONVERSATION,
  revision: 5, sessionStatus: "active", ending: null, pendingTurn: false, turnedDownLimitReached: false, waypointDraft: null, providerState: "unavailable",
  messages: [{ id: SOURCE, role: "explorer", body: SOURCE_TEXT, createdAt: "2026-10-29T15:00:00Z" }],
  compassItems: [], priorityId: null, attentionId: null, route: [], waypoints: [{ isCurrent: true, createdAt: "2026-10-29T15:01:00Z", id: WAYPOINT, sourceMessageId: SOURCE,
    title: "A saved destination", destination: "A saved destination", meaning: "A saved meaning", arrivalSignal: "A saved arrival signal", status: "chosen",
    reachedEvidence: null, reachedAt: null }] });
const releasedState = (operationId = RELEASE): ExplorerConversationState => { const current = currentState(); return {
  ...current, revision: 6, waypointCapacity: { activeCount: 0, activeLimit: 20, historyRoom: true, conversationRoom: true },
  waypoints: current.waypoints.map(item => ({ ...item, release: { operationId, releasedAt: RELEASED_AT } })),
}; };
const REVIEW_BUTTON = "Review release: A saved destination";
const RELEASE_REVIEW = "Review before releasing this Waypoint";
const RELEASE_CONFIRM = "I reviewed this Waypoint, and I choose to release it while keeping its private history.";
const REACHED_CONFIRM = "I have reviewed my arrival signal and supporting evidence, and I confirm meaningful progress to this Waypoint.";
const success = (state: ExplorerConversationState) => ({ version: "explorer-private-conversation-response.v1",
  result: { ok: true, state, error: null }, assistance: null });
const isWide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;
const row = (card: Locator, title = "A saved destination") => card.getByRole("button", { name: new RegExp(`^${title} (Formed|Reached|Released)$`) });
const history = (card: Locator) => card.locator("ul[id$='-connected-waypoint-history']");
const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));

async function mockCurrent(page: Page, current: () => ExplorerConversationState) {
  await page.route("**/explorer/conversation/state", route => {
    expect(route.request().method()).toBe("GET"); return route.fulfill({ json: success(current()) });
  });
}

async function openCard(page: Page): Promise<Locator> {
  if (!isWide(page)) {
    await page.locator("#conversation-preview-drawer-opener").click();
    await expect(page.getByRole("dialog", { name: "Compass & Waypoint", exact: true })).toBeVisible();
  }
  const card = page.locator("section[aria-labelledby$='-connected-waypoint-title']:visible");
  await expect(card).toBeVisible();
  return card;
}

async function closeDrawer(page: Page) {
  if (!isWide(page)) await page.getByRole("button", { name: "Close Compass & Waypoint", exact: true }).click();
}

async function openRow(card: Locator) {
  if (await row(card).getAttribute("aria-expanded") !== "true") await row(card).click();
}

async function openRelease(card: Locator) {
  await openRow(card);
  await card.getByRole("button", { name: "Release", exact: true }).click();
  return card.getByRole("group", { name: RELEASE_REVIEW, exact: true });
}

test("card marks one Waypoint Reached and releases another without moving the page", async ({ page }) => {
  const second = "a1030000-0000-4000-8000-000000000002";
  let current: ExplorerConversationState = { ...currentState(),
    waypointCapacity: { activeCount: 2, activeLimit: 20, historyRoom: true, conversationRoom: true },
    waypointProjection: { kind: "current_heads", limit: 20, totalHeads: 2, hasMore: false },
    waypoints: [...currentState().waypoints, { ...currentState().waypoints[0], id: second, title: "Another saved destination",
      destination: "Another saved destination" }] };
  const commands: ExplorerConversationCommand[] = [];
  const gates = Array.from({ length: 2 }, () => {
    let finish!: () => void;
    const wait = new Promise<void>(resolve => { finish = resolve; });
    return { wait, finish };
  });
  await mockCurrent(page, () => current);
  await page.route("**/explorer/conversation/commands", async route => {
    expect(route.request().method()).toBe("POST");
    const command = route.request().postDataJSON() as ExplorerConversationCommand;
    commands.push(command);
    if (command.kind !== "confirm_reached" && command.kind !== "release_waypoint") throw new Error("unexpected_command");
    await gates[commands.length - 1].wait;
    current = { ...current, revision: current.revision + 1,
      waypointCapacity: { ...current.waypointCapacity, activeCount: current.waypointCapacity.activeCount - 1 },
      waypoints: current.waypoints.map(item => item.id !== command.waypointId ? item : command.kind === "confirm_reached"
        ? { ...item, status: "reached", reachedEvidence: command.evidence, reachedAt: RELEASED_AT }
        : { ...item, release: { operationId: command.operationId, releasedAt: RELEASED_AT } }) };
    return route.fulfill({ json: success(current) });
  });
  await page.goto("/explorer/conversation");
  const card = await openCard(page);
  for (const [index, title, action, confirm, saved, stage] of [
    [0, "A saved destination", "Mark Reached", "Confirm Reached", "Saved. This Waypoint is marked Reached.", "Reached"],
    [1, "Another saved destination", "Release", "Release this Waypoint", "Saved. This Waypoint is released.", "Released"],
  ] as const) {
    await row(card, title).click();
    await card.getByRole("button", { name: action, exact: true }).click();
    if (index === 0) {
      await card.getByRole("textbox", { name: "What supporting evidence shows arrival?", exact: true }).fill("  Invented evidence of arrival.  ");
      await card.getByLabel(REACHED_CONFIRM, { exact: true }).check();
    } else await card.getByLabel(RELEASE_CONFIRM, { exact: true }).check();
    const submit = card.getByRole("button", { name: confirm, exact: true });
    await expect(submit).toBeEnabled();
    await page.evaluate(() => window.scrollTo(0, 0));
    const before = await scrollY(page);
    // A DOM click avoids Playwright scrolling the page to reach the control.
    await submit.evaluate(button => (button as HTMLButtonElement).click());
    await expect(card.getByText("Saving...", { exact: true })).toBeVisible();
    expect(await scrollY(page)).toBe(before);
    gates[index].finish();
    await expect(card.getByText(saved, { exact: true })).toBeVisible();
    await expect(card.getByRole("button", { name: `Reached and released (${index + 1})`, exact: true })).toHaveAttribute("aria-expanded", "true");
    await expect(history(card).getByRole("button", { name: `${title} ${stage}`, exact: true })).toHaveAttribute("aria-expanded", "true");
    await expect(card.getByRole("button", { name: "Mark Reached", exact: true })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Release", exact: true })).toHaveCount(0);
    expect(await scrollY(page)).toBe(before);
  }
  expect(commands).toEqual([
    { kind: "confirm_reached", waypointId: WAYPOINT, evidence: "Invented evidence of arrival.", expectedRevision: 5,
      operationId: expect.stringMatching(/^[0-9a-f-]{36}$/) },
    { kind: "release_waypoint", waypointId: second, expectedRevision: 6, operationId: expect.stringMatching(/^[0-9a-f-]{36}$/) },
  ]);
  expect(commands[1].operationId).not.toBe(commands[0].operationId);
});

test("card release requires deliberate effect review, saves one closed command and survives reload", async ({ page }) => {
  let current = currentState(); const commands: ExplorerConversationCommand[] = [];
  await mockCurrent(page, () => current);
  await page.route("**/explorer/conversation/commands", route => {
    expect(route.request().method()).toBe("POST");
    const command = route.request().postDataJSON() as ExplorerConversationCommand; commands.push(command);
    expect(command).toEqual({ kind: "release_waypoint", waypointId: WAYPOINT, expectedRevision: 5,
      operationId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    current = releasedState(command.operationId);
    return route.fulfill({ json: success(current) });
  });
  await page.goto("/explorer/conversation");
  let card = await openCard(page);
  const review = await openRelease(card);
  await expect(review).toBeVisible();
  await expect(card.getByText("A saved meaning", { exact: true })).toBeVisible();
  await expect(card.getByText("A saved arrival signal", { exact: true })).toBeVisible();
  await expect(review).toContainText("Releasing stops treating this Waypoint as in progress. Its definition and history stay saved and private. This does not mark it Reached or share anything.");
  await expect(review).toContainText("Review this Waypoint and tick the confirmation box so you can check that you want to stop pursuing it while keeping its private history.");
  const confirm = review.getByRole("button", { name: "Release this Waypoint", exact: true });
  await expect(confirm).toBeDisabled(); expect(commands).toHaveLength(0);
  await review.getByLabel(RELEASE_CONFIRM, { exact: true }).check();
  await expect(confirm).toBeEnabled(); await confirm.click();
  await expect(card.getByText("Saved. This Waypoint is released.", { exact: true })).toBeVisible();
  await expect(history(card).getByRole("button", { name: "A saved destination Released", exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Release", exact: true })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Mark Reached", exact: true })).toHaveCount(0);
  expect(commands).toHaveLength(1); expect(commands.some(command => command.kind === "send")).toBe(false);
  await page.reload();
  card = await openCard(page);
  await card.getByRole("button", { name: "Reached and released (1)", exact: true }).click();
  await row(card).click();
  await expect(history(card).getByRole("button", { name: "A saved destination Released", exact: true })).toBeVisible();
  await expect(card.getByText("A saved meaning", { exact: true })).toBeVisible();
  await expect(card.getByText("A saved arrival signal", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Release", exact: true })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Mark Reached", exact: true })).toHaveCount(0);
  await closeDrawer(page);
  await expect(page.getByRole("list", { name: "Saved conversation", exact: true })).toContainText(SOURCE_TEXT);
  expect(commands).toHaveLength(1);
});

test("pending or stale card release review cannot dispatch a release", async ({ page }) => {
  let current = { ...currentState(), pendingTurn: true }; let writes = 0;
  await mockCurrent(page, () => current);
  await page.route("**/explorer/conversation/commands", route => { writes += 1; return route.abort(); });
  await page.goto("/explorer/conversation");
  let card = await openCard(page);
  await row(card).click();
  await expect(card.getByRole("button", { name: "Release", exact: true })).toBeDisabled();
  await expect(card.getByRole("button", { name: "Mark Reached", exact: true })).toBeDisabled();
  await closeDrawer(page);
  current = { ...currentState(), pendingTurn: false };
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
  await expect(page.getByText("The saved conversation is up to date.", { exact: true })).toBeVisible();
  card = isWide(page) ? card : await openCard(page);
  await openRow(card);
  await card.getByRole("button", { name: "Release", exact: true }).click();
  await card.getByLabel(RELEASE_CONFIRM, { exact: true }).check();
  await closeDrawer(page);
  current = { ...current, revision: 6 };
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
  await expect(page.getByText("The saved conversation is up to date.", { exact: true })).toBeVisible();
  card = isWide(page) ? card : await openCard(page);
  await expect(card.getByRole("group", { name: RELEASE_REVIEW, exact: true })).toHaveCount(0);
  expect(writes).toBe(0);
  await openRow(card);
  await card.getByRole("button", { name: "Release", exact: true }).click();
  await card.getByLabel(RELEASE_CONFIRM, { exact: true }).check();
  await closeDrawer(page);
  current = { ...current, pendingTurn: true };
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
  await expect(page.getByText("The saved conversation is up to date.", { exact: true })).toBeVisible();
  card = isWide(page) ? card : await openCard(page);
  const confirm = card.getByRole("button", { name: "Release this Waypoint", exact: true });
  if (await confirm.count()) await expect(confirm).toBeDisabled();
  await expect(row(card)).toHaveAccessibleName("A saved destination Formed");
  await expect(card.getByText("Saved. This Waypoint is released.", { exact: true })).toHaveCount(0);
  expect(writes).toBe(0);
});

test("an uncertain card release keeps Formed until the page Retry repeats identical bytes", async ({ page }) => {
  let current = currentState(); const bodies: string[] = [];
  await mockCurrent(page, () => current);
  await page.route("**/explorer/conversation/commands", route => {
    bodies.push(route.request().postData()!);
    if (bodies.length === 1) return route.abort("failed");
    const command = JSON.parse(bodies[1]) as ExplorerConversationCommand;
    current = releasedState(command.operationId);
    return route.fulfill({ json: success(current) });
  });
  await page.goto("/explorer/conversation");
  let card = await openCard(page);
  const review = await openRelease(card);
  await review.getByLabel(RELEASE_CONFIRM, { exact: true }).check();
  await review.getByRole("button", { name: "Release this Waypoint", exact: true }).click();
  await expect(review).toHaveCount(0);
  await expect(row(card)).toHaveAccessibleName("A saved destination Formed");
  await expect(card.getByText("Saved. This Waypoint is released.", { exact: true })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Release", exact: true })).toBeDisabled();
  await expect(card.getByRole("button", { name: "Mark Reached", exact: true })).toBeDisabled();
  await expect(card.getByRole("button", { name: /Retry/ })).toHaveCount(0);
  await closeDrawer(page);
  const retry = page.getByRole("button", { name: "Retry the same request", exact: true });
  await expect(retry).toBeVisible();
  expect(bodies).toHaveLength(1);
  expect(JSON.parse(bodies[0])).toEqual({ kind: "release_waypoint", waypointId: WAYPOINT, expectedRevision: 5,
    operationId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
  await retry.click();
  await expect(retry).toHaveCount(0);
  card = isWide(page) ? card : await openCard(page);
  await expect(card.getByText("Saved. This Waypoint is released.", { exact: true })).toBeVisible();
  await expect(history(card).getByRole("button", { name: "A saved destination Released", exact: true })).toBeVisible();
  expect(bodies).toHaveLength(2); expect(bodies[1]).toBe(bodies[0]);
  expect(bodies.some(body => JSON.parse(body).kind === "send")).toBe(false);
});

for (const historyRoom of [true, false]) {
  test(`card Release remains available at global twenty with historyRoom=${historyRoom}`, async ({ page }) => {
    let current = { ...currentState(), waypointCapacity: { activeCount: 20, activeLimit: 20, historyRoom, conversationRoom: true } };
    const commands: ExplorerConversationCommand[] = [];
    await mockCurrent(page, () => current);
    await page.route("**/explorer/conversation/commands", route => {
      const command = route.request().postDataJSON() as ExplorerConversationCommand; commands.push(command);
      expect(command).toEqual({ kind: "release_waypoint", waypointId: WAYPOINT, expectedRevision: 5,
        operationId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
      current = { ...current, revision: 6, waypointCapacity: { activeCount: 19, activeLimit: 20, historyRoom, conversationRoom: true },
        waypoints: current.waypoints.map(item => ({ ...item, release: { operationId: command.operationId, releasedAt: RELEASED_AT } })) };
      return route.fulfill({ json: success(current) });
    });
    await page.goto("/explorer/conversation");
    let card = await openCard(page);
    const review = await openRelease(card);
    await expect(card.getByRole("button", { name: "Mark Reached", exact: true })).toBeEnabled();
    await review.getByLabel(RELEASE_CONFIRM, { exact: true }).check();
    await expect(review.getByRole("button", { name: "Release this Waypoint", exact: true })).toBeEnabled();
    await review.getByRole("button", { name: "Release this Waypoint", exact: true }).click();
    await expect(card.getByText("Saved. This Waypoint is released.", { exact: true })).toBeVisible();
    expect(current.waypoints).toHaveLength(1);
    expect(current.waypointCapacity).toEqual({ activeCount: 19, activeLimit: 20, historyRoom, conversationRoom: true });
    expect(commands).toHaveLength(1);
    await page.reload();
    card = await openCard(page);
    await card.getByRole("button", { name: "Reached and released (1)", exact: true }).click();
    await row(card).click();
    await expect(row(card)).toHaveAccessibleName("A saved destination Released");
    await expect(card.getByRole("button", { name: "Release", exact: true })).toHaveCount(0);
    expect(commands).toHaveLength(1);
  });
}

test("ended review reads the captured release and source without offering commands", async ({ page }) => {
  const current: ExplorerConversationState = { ...releasedState(), revision: 7, sessionStatus: "ended",
    ending: { operationId: END, revision: 7, endedAt: "2026-10-29T15:10:00Z", directionsTaken: "Saved ending", routeThroughRevision: 6 } };
  let writes = 0;
  await page.route("**/explorer/conversations/state*", route => {
    expect(route.request().method()).toBe("GET");
    const selected = new URL(route.request().url()).searchParams.has("conversationId");
    return route.fulfill({ json: { version: "explorer-conversation-review.v1", ok: true,
      items: [{ conversationId: CONVERSATION, endedAt: current.ending!.endedAt }], state: selected ? current : null, error: null } });
  });
  await page.route("**/explorer/conversation/commands", route => { writes += 1; return route.abort(); });
  await page.goto("/explorer/conversations");
  await page.getByRole("button", { name: "Review ended conversation 1", exact: true }).click();
  await expect(page.getByText("Released — kept in your private history", { exact: true })).toBeVisible();
  await expect(page.locator(`time[datetime="${RELEASED_AT}"]`)).toBeVisible();
  await page.getByText("Review saved source", { exact: true }).click();
  await expect(page.locator("blockquote").filter({ hasText: SOURCE_TEXT })).toBeVisible();
  await expect(page.getByRole("button", { name: REVIEW_BUTTON, exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Review Reached: A saved destination", exact: true })).toHaveCount(0);
  await expect(page.locator("textarea, input, select")).toHaveCount(0);
  expect(writes).toBe(0);
});
