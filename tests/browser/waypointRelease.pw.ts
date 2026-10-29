// Mounted UI with mocked endpoints only: no actual sign-in, SQL, provider, Send or human acceptance.
import { expect, test, type Page } from "@playwright/test";
import type { ExplorerConversationCommand, ExplorerConversationState } from "../../src/lib/solmind/explorerConversationContract";

test.use({ trace: "off", screenshot: "off", video: "off" });
const CONVERSATION = "a1010000-0000-4000-8000-000000000001";
const SOURCE = "a1020000-0000-4000-8000-000000000001";
const WAYPOINT = "a1030000-0000-4000-8000-000000000001";
const RELEASE = "a1040000-0000-4000-8000-000000000001";
const END = "a1050000-0000-4000-8000-000000000001";
const RELEASED_AT = "2026-10-29T15:05:00Z";
const SOURCE_TEXT = "A retained exact private source <script>plain text only</script>.";
const currentState = (): ExplorerConversationState => ({ version: "explorer-conversation.v1", conversationId: CONVERSATION,
  revision: 5, sessionStatus: "active", ending: null, pendingTurn: false, providerState: "unavailable",
  messages: [{ id: SOURCE, role: "explorer", body: SOURCE_TEXT, createdAt: "2026-10-29T15:00:00Z" }],
  compassItems: [], priorityId: null, attentionId: null, route: [], waypoints: [{ id: WAYPOINT, sourceMessageId: SOURCE,
    destination: "A saved destination", meaning: "A saved meaning", arrivalSignal: "A saved arrival signal", status: "chosen",
    reachedEvidence: null, reachedAt: null }] });
const releasedState = (operationId = RELEASE): ExplorerConversationState => { const current = currentState(); return {
  ...current, revision: 6, waypoints: current.waypoints.map(item => ({ ...item, release: { operationId, releasedAt: RELEASED_AT } })),
}; };
const success = (state: ExplorerConversationState) => ({ version: "explorer-private-conversation-response.v1",
  result: { ok: true, state, error: null }, assistance: null });
async function mockCurrent(page: Page, current: () => ExplorerConversationState) {
  await page.route("**/explorer/conversation/state", route => {
    expect(route.request().method()).toBe("GET"); return route.fulfill({ json: success(current()) });
  });
}
const REVIEW_BUTTON = "Review release: A saved destination";
const CONFIRM_LABEL = "I reviewed this Waypoint and its saved source, and I choose to release it while keeping its private history.";

test("release requires deliberate source/effect review, saves one closed command and survives reload", async ({ page }) => {
  let current = currentState(); const commands: ExplorerConversationCommand[] = [];
  await mockCurrent(page, () => current);
  await page.route("**/explorer/conversation/commands", route => {
    expect(route.request().method()).toBe("POST");
    const command = route.request().postDataJSON() as ExplorerConversationCommand; commands.push(command);
    expect(command.kind).toBe("release_waypoint"); expect(command.expectedRevision).toBe(5);
    expect(Object.keys(command).sort()).toEqual(["expectedRevision", "kind", "operationId", "waypointId"]);
    if (command.kind !== "release_waypoint") throw new Error("unexpected_command");
    expect(command.waypointId).toBe(WAYPOINT);
    current = releasedState(command.operationId);
    return route.fulfill({ json: success(current) });
  });
  await page.goto("/explorer/conversation");
  await page.getByRole("button", { name: REVIEW_BUTTON, exact: true }).click();
  const review = page.getByRole("group", { name: "Review before releasing this Waypoint", exact: true });
  await expect(review).toBeVisible();
  await expect(review).toContainText("Destination: A saved destination");
  await expect(review).toContainText("Why it matters: A saved meaning");
  await expect(review).toContainText("Arrival signal: A saved arrival signal");
  await expect(review.locator("blockquote")).toContainText(SOURCE_TEXT);
  await expect(review.locator("blockquote")).toContainText("Exact saved source — You");
  await expect(review).toContainText("Its definition, saved source and history stay available and private.");
  await expect(review).toContainText("This does not mark it Reached, end the conversation or share anything.");
  const confirm = review.getByRole("button", { name: "Release this Waypoint", exact: true });
  await expect(confirm).toBeDisabled(); expect(commands).toHaveLength(0);
  await review.getByLabel(CONFIRM_LABEL, { exact: true }).check();
  await expect(confirm).toBeEnabled(); await confirm.click();
  await expect(page.getByText("Released — kept in your private history", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: REVIEW_BUTTON, exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Review Reached: A saved destination", exact: true })).toHaveCount(0);
  await expect(page.locator(`time[datetime="${RELEASED_AT}"]`)).toBeVisible();
  expect(commands).toHaveLength(1); expect(commands.some(command => command.kind === "send")).toBe(false);
  await page.reload();
  await expect(page.getByText("Released — kept in your private history", { exact: true })).toBeVisible();
  await expect(page.getByText("In progress — chosen by you", { exact: true })).toHaveCount(0);
  await page.getByText("Review saved source", { exact: true }).click();
  await expect(page.locator("blockquote").filter({ hasText: SOURCE_TEXT })).toBeVisible();
  expect(commands).toHaveLength(1);
});

test("pending or stale release review cannot dispatch a release", async ({ page }) => {
  let current = { ...currentState(), pendingTurn: true }; let writes = 0;
  await mockCurrent(page, () => current);
  await page.route("**/explorer/conversation/commands", route => { writes += 1; return route.abort(); });
  await page.goto("/explorer/conversation");
  await expect(page.getByRole("button", { name: REVIEW_BUTTON, exact: true })).toBeDisabled();
  current = { ...currentState(), pendingTurn: false };
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
  await page.getByRole("button", { name: REVIEW_BUTTON, exact: true }).click();
  const review = page.getByRole("group", { name: "Review before releasing this Waypoint", exact: true });
  await review.getByLabel(CONFIRM_LABEL, { exact: true }).check();
  current = { ...current, revision: 6 };
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
  await expect(review.getByText("Your saved conversation or Waypoint changed. Close this review and open a new one before releasing.", { exact: true })).toBeVisible();
  await expect(review.getByRole("button", { name: "Release this Waypoint", exact: true })).toBeDisabled();
  expect(writes).toBe(0);
  await page.getByRole("button", { name: "Close release review", exact: true }).click();
  await page.getByRole("button", { name: REVIEW_BUTTON, exact: true }).click();
  current = { ...current, pendingTurn: true };
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
  await expect(page.getByRole("group", { name: "Review before releasing this Waypoint", exact: true }).getByRole("button", { name: "Release this Waypoint", exact: true })).toBeDisabled();
  expect(writes).toBe(0);
  await expect(page.getByText("Released — kept in your private history", { exact: true })).toHaveCount(0);
});

test("an unknown acknowledgment preserves honest uncertainty without a false Released claim", async ({ page }) => {
  const bodies: string[] = []; await mockCurrent(page, currentState);
  await page.route("**/explorer/conversation/commands", route => { bodies.push(route.request().postData()!); return route.abort(); });
  await page.goto("/explorer/conversation");
  await page.getByRole("button", { name: REVIEW_BUTTON, exact: true }).click();
  const review = page.getByRole("group", { name: "Review before releasing this Waypoint", exact: true });
  await review.getByLabel(CONFIRM_LABEL, { exact: true }).check();
  await review.getByRole("button", { name: "Release this Waypoint", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry the same request", exact: true })).toBeVisible();
  await expect(page.getByText("Released — kept in your private history", { exact: true })).toHaveCount(0);
  await expect(page.getByText("In progress — chosen by you", { exact: true })).toBeVisible();
  expect(bodies).toHaveLength(1); expect(JSON.parse(bodies[0]).kind).toBe("release_waypoint");
  expect(bodies.some(body => JSON.parse(body).kind === "send")).toBe(false);
});

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
