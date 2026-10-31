// Mocked endpoints prove mounted UI behavior only, never Auth/SQL/provider or human acceptance.
import { expect, test, type Page } from "@playwright/test";
import type { ExplorerConversationCommand, ExplorerConversationState } from "../../src/lib/solmind/explorerConversationContract";

test.use({ trace: "off", screenshot: "off", video: "off" });
const CONVERSATION = "10000000-0000-4000-8000-000000000001";
const OTHER_CONVERSATION = "10000000-0000-4000-8000-000000000002";
const SOURCE = "20000000-0000-4000-8000-000000000001";
const POINT = "30000000-0000-4000-8000-000000000001";
const WAYPOINT = "40000000-0000-4000-8000-000000000001";
const ROUTE_OPERATION = "50000000-0000-4000-8000-000000000001";
const END_OPERATION = "60000000-0000-4000-8000-000000000001";
const empty = (): ExplorerConversationState => ({ version: "explorer-conversation.v1", conversationId: null,
  revision: 0, pendingTurn: false, providerState: "unavailable", messages: [], compassItems: [], priorityId: null,
  attentionId: null, waypoints: [], route: [], sessionStatus: null, ending: null });
const active = (): ExplorerConversationState => ({ ...empty(), conversationId: CONVERSATION, revision: 5, sessionStatus: "active",
  messages: [{ id: SOURCE, role: "explorer", body: "A synthetic saved message.", createdAt: "2026-10-29T07:00:00Z" }],
  compassItems: [{ id: POINT, sourceMessageId: SOURCE, label: "A saved Priority", anchor: "apex", emphasis: 3 }],
  priorityId: POINT, attentionId: POINT, route: [{ operationId: ROUTE_OPERATION, revision: 3, kind: "priority_confirmed",
    compassItemId: POINT, label: "An earlier captured direction", recordedAt: "2026-10-29T07:01:00Z" }],
  waypoints: [{ id: WAYPOINT, sourceMessageId: SOURCE, destination: "A saved destination", meaning: "A saved meaning",
    arrivalSignal: "A saved arrival signal", status: "reached", reachedEvidence: "A saved Reached observation.", reachedAt: "2026-10-29T07:02:00Z" }] });
const ended = (operationId = END_OPERATION): ExplorerConversationState => ({ ...active(), revision: 6, sessionStatus: "ended",
  ending: { operationId, revision: 6, endedAt: "2026-10-29T07:03:00.123456+00:00",
    directionsTaken: "A factual saved ending. <script>plain text</script>", routeThroughRevision: 5 } });
const success = (state: ExplorerConversationState) => ({ version: "explorer-private-conversation-response.v1",
  result: { ok: true, state, error: null }, assistance: null });
const review = (items: readonly { conversationId: string; endedAt: string | null }[] | null, state: ExplorerConversationState | null) => ({
  version: "explorer-conversation-review.v1", ok: true, items, state, error: null });
async function mockCurrent(page: Page, current: () => ExplorerConversationState) {
  await page.route("**/explorer/conversation/state", route => route.fulfill({ status: 200,
    contentType: "application/json", body: JSON.stringify(success(current())) }));
}
async function mockHome(page: Page) {
  await page.route("**/explorer/home", route => route.fulfill({ status: 200,
    contentType: "text/html", body: "<html><body><h1>Controlled Explorer home</h1></body></html>" }));
}

test("E01 unsaved Discovery returns home without creating an End command", async ({ page }) => {
  let commands = 0; await mockCurrent(page, empty); await mockHome(page);
  await page.route("**/explorer/conversation/commands", route => { commands += 1; return route.abort(); });
  await page.goto("/explorer/conversation");
  await expect(page.getByRole("link", { name: "Return to Explorer home", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "End this conversation", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Return to Explorer home", exact: true }).click();
  await expect(page).toHaveURL(/\/explorer\/home$/); expect(commands).toBe(0);
});

test("E02 deliberate End sends its saved selector once and returns home only after confirmed ended state", async ({ page }) => {
  const commands: ExplorerConversationCommand[] = []; await mockCurrent(page, active); await mockHome(page);
  await page.route("**/explorer/conversation/commands", route => {
    const command = route.request().postDataJSON() as ExplorerConversationCommand; commands.push(command);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(ended(command.operationId))) });
  });
  await page.goto("/explorer/conversation");
  await page.getByRole("button", { name: "End this conversation", exact: true }).click();
  await expect(page.getByRole("group", { name: "Review End Session", exact: true })).toBeVisible();
  expect(commands).toHaveLength(0);
  await page.getByRole("button", { name: "End Session and return home", exact: true }).click();
  await expect(page).toHaveURL(/\/explorer\/home$/);
  expect(commands).toHaveLength(1);
  expect(commands[0]).toMatchObject({ kind: "end_conversation", conversationId: CONVERSATION, expectedRevision: 5 });
  expect(Object.keys(commands[0]).sort()).toEqual(["conversationId", "expectedRevision", "kind", "operationId"]);
});

test("E03 an active-shaped acknowledgement stays uncertain and exact retry can confirm another tab's legacy ending", async ({ page }) => {
  const bodies: string[] = []; await mockCurrent(page, active); await mockHome(page);
  await page.route("**/explorer/conversation/commands", route => {
    bodies.push(route.request().postData()!);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(
      bodies.length === 1 ? active() : { ...ended(), ending: null })) });
  });
  await page.goto("/explorer/conversation");
  await page.getByRole("button", { name: "End this conversation", exact: true }).click();
  await page.getByRole("button", { name: "End Session and return home", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry the same request", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/explorer\/conversation$/);
  await expect(page.getByRole("button", { name: "End this conversation", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Retry the same request", exact: true }).click();
  await expect(page).toHaveURL(/\/explorer\/home$/);
  expect(bodies).toHaveLength(2); expect(bodies[1]).toBe(bodies[0]);
});

test("E04 pending turns and stale End review never dispatch an ending", async ({ page }) => {
  let current = { ...active(), pendingTurn: true }; let writes = 0;
  await mockCurrent(page, () => current);
  await page.route("**/explorer/conversation/commands", route => { writes += 1; return route.abort(); });
  await page.goto("/explorer/conversation");
  await expect(page.getByRole("button", { name: "End this conversation", exact: true })).toBeDisabled();
  current = { ...active(), pendingTurn: false };
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
  await expect(page.getByRole("button", { name: "End this conversation", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "End this conversation", exact: true }).click();
  current = { ...current, revision: 6 };
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
  await expect(page.getByText("Your saved conversation changed. Close this review and review End Session again.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "End Session and return home", exact: true })).toBeDisabled();
  expect(writes).toBe(0);
});

test("E05 ended review uses GET only and preserves messages, Route, source and Reached readback", async ({ page }) => {
  const gets: string[] = []; let writes = 0;
  const items = [{ conversationId: CONVERSATION, endedAt: ended().ending!.endedAt }, { conversationId: OTHER_CONVERSATION, endedAt: null }];
  await page.route("**/explorer/conversations/state*", route => {
    expect(route.request().method()).toBe("GET"); const url = new URL(route.request().url());
    const id = url.searchParams.get("conversationId"); gets.push(id ?? "list");
    const selected = id === CONVERSATION ? ended() : id === OTHER_CONVERSATION ? { ...ended(), conversationId: OTHER_CONVERSATION, ending: null } : null;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(review(items, selected)) });
  });
  await page.route("**/explorer/conversation/commands", route => { writes += 1; return route.abort(); });
  await page.goto("/explorer/conversations");
  await page.getByRole("button", { name: "Review ended conversation 1", exact: true }).click();
  await expect(page.getByText("A factual saved ending. <script>plain text</script>", { exact: true })).toBeVisible();
  await expect(page.getByText("An earlier captured direction", { exact: false })).toBeVisible();
  await page.getByText("Review saved Reached confirmation", { exact: true }).click();
  await expect(page.getByText("A saved Reached observation.", { exact: true })).toBeVisible();
  await page.getByText("Review saved source", { exact: true }).first().click();
  await expect(page.locator("blockquote").first()).toContainText("A synthetic saved message.");
  await expect(page.locator("form, textarea, input, select")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^(Send|Review Priority:|Attend to:|Review Reached:|Confirm arrangement)/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Review ended conversation 2", exact: true }).click();
  await expect(page.getByText("No saved ending summary is available.", { exact: true })).toBeVisible();
  expect(gets).toEqual(["list", CONVERSATION, OTHER_CONVERSATION]); expect(writes).toBe(0);
});

test("E06 denied history reload removes earlier private content and offers sign-in", async ({ page }) => {
  let denied = false;
  await page.route("**/explorer/conversations/state*", route => {
    const selected = new URL(route.request().url()).searchParams.has("conversationId");
    return route.fulfill({ status: denied ? 403 : 200, contentType: "application/json", body: JSON.stringify(denied
      ? { version: "explorer-conversation-review.v1", ok: false, items: null, state: null, error: "denied" }
      : review([{ conversationId: CONVERSATION, endedAt: ended().ending!.endedAt }], selected ? ended() : null)) });
  });
  await page.goto("/explorer/conversations");
  await page.getByRole("button", { name: "Review ended conversation 1", exact: true }).click();
  await expect(page.getByText("A factual saved ending. <script>plain text</script>", { exact: true })).toBeVisible();
  denied = true;
  await page.getByRole("button", { name: "Reload ended conversations", exact: true }).click();
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/login/explorer");
  await expect(page.getByRole("region", { name: "Ended conversation review", exact: true })).toHaveCount(0);
  await expect(page.getByText("A factual saved ending. <script>plain text</script>", { exact: true })).toHaveCount(0);
});
