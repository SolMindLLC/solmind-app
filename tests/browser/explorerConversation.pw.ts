// Mocked private-response endpoints prove mounted UI behavior only; actual runs are recorded separately.
// They prove no authentication, SQL persistence, operational readiness, provider call or genuine AI reply.
import { expect, test, type Page } from "@playwright/test";
import {
  EXPLORER_CONVERSATION_VERSION,
  type ExplorerConversationCommand,
  type ExplorerConversationState,
} from "../../src/lib/solmind/explorerConversationContract";

test.use({ trace: "off", screenshot: "off", video: "off" });
const CONVERSATION = "10000000-0000-4000-8000-000000000001";
const EXPLORER_MESSAGE = "20000000-0000-4000-8000-000000000001";
const GUIDE_MESSAGE = "30000000-0000-4000-8000-000000000001";
const emptyState = (providerState: ExplorerConversationState["providerState"] = "available"): ExplorerConversationState => ({
  version: EXPLORER_CONVERSATION_VERSION, conversationId: null, revision: 0, providerState, pendingTurn: false,
  messages: [], compassItems: [], priorityId: null, attentionId: null, waypoints: [],
});
const savedState = (body = "A synthetic Explorer question"): ExplorerConversationState => ({
  ...emptyState(), conversationId: CONVERSATION, revision: 1,
  messages: [
    { id: EXPLORER_MESSAGE, role: "explorer", body, createdAt: "2026-10-24T06:00:00.000Z" },
    { id: GUIDE_MESSAGE, role: "virtualGuide", body: "A synthetic transport reply", createdAt: "2026-10-24T06:00:01.000Z" },
  ],
});
type SyntheticAssistance = Readonly<{
  kind: "support" | "adult_policy" | "temporarily_unavailable";
  body: string;
  persisted: false;
}>;
const privateResponse = (result: unknown, assistance: SyntheticAssistance | null = null) => ({
  version: "explorer-private-conversation-response.v1", result, assistance,
});
const success = (state: ExplorerConversationState, assistance: SyntheticAssistance | null = null) =>
  privateResponse({ ok: true, state, error: null }, assistance);
const failure = (error: "denied" | "refresh_required" | "provider_unavailable" | "unavailable") =>
  privateResponse({ ok: false, state: null, error });

async function mockState(page: Page, read: () => unknown) {
  await page.route("**/explorer/conversation/state", route => {
    expect(route.request().method()).toBe("GET");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(read()) });
  });
}

test("F02 explicit arrangement is saved once and read back after reload without Send", async ({ page }) => {
  const first = "40000000-0000-4000-8000-000000000001";
  const second = "40000000-0000-4000-8000-000000000002";
  let current: ExplorerConversationState = { ...savedState(), compassItems: [
    { id: first, sourceMessageId: EXPLORER_MESSAGE, label: "Alpha", anchor: null, emphasis: null },
    { id: second, sourceMessageId: GUIDE_MESSAGE, label: "Beta", anchor: null, emphasis: null },
  ], route: [] };
  let writes = 0;
  await mockState(page, () => success(current));
  await page.route("**/explorer/conversation/commands", route => {
    const command = route.request().postDataJSON() as ExplorerConversationCommand;
    expect(command.kind).toBe("confirm_compass_arrangement");
    if (command.kind !== "confirm_compass_arrangement") throw new Error("unexpected_command");
    expect(command.expectedRevision).toBe(1);
    expect(command.priorityId).toBe(first);
    expect(command.items).toEqual([
      { compassItemId: first, anchor: "apex", emphasis: 2 },
      { compassItemId: second, anchor: "side_right", emphasis: 1 },
    ]);
    writes += 1;
    current = { ...current, revision: 2, priorityId: first, compassItems: current.compassItems.map(point => {
      const item = command.items.find(item => item.compassItemId === point.id)!;
      return { ...point, anchor: item.anchor, emphasis: item.emphasis };
    }), route: [{ operationId: command.operationId, revision: 2, kind: "arrangement_confirmed",
      previousPriorityId: null, priorityId: first, items: command.items.map(item => ({ ...item,
        label: current.compassItems.find(point => point.id === item.compassItemId)!.label })),
      recordedAt: "2026-10-29T09:00:00.123456+00:00" }] };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(current)) });
  });
  await page.goto("/explorer/conversation");
  await page.getByRole("button", { name: "Review Compass arrangement", exact: true }).click();
  await page.getByLabel(/Location for Alpha/).selectOption("apex");
  await page.getByLabel(/Relative emphasis for Alpha/).selectOption("2");
  await page.getByLabel(/Location for Beta/).selectOption("side_right");
  await page.getByLabel(/Relative emphasis for Beta/).selectOption("1");
  await page.getByLabel(/Priority for this arrangement/).selectOption(first);
  await page.getByRole("checkbox", { name: /I reviewed the new Priority/ }).check();
  await page.getByRole("button", { name: "Confirm new Priority and arrangement", exact: true }).click();
  await expect(page.getByText("Compass arrangement confirmed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close arrangement review", exact: true }).click();
  await expect(page.getByRole("region", { name: "Saved Compass arrangement", exact: true })).toContainText("Alpha");
  await page.reload();
  await expect(page.getByText("Compass arrangement confirmed", { exact: true })).toBeVisible();
  await page.getByText("Review recorded placement and emphasis", { exact: true }).click();
  await expect(page.getByText(/Alpha — .*Regular/)).toBeVisible();
  expect(writes).toBe(1);
});

test("F01 saved Route and Reached evidence remain reviewable after reload without a command", async ({ page }) => {
  const pointId = "40000000-0000-4000-8000-000000000001";
  const state: ExplorerConversationState = { ...savedState(), revision: 5,
    compassItems: [{ id: pointId, sourceMessageId: EXPLORER_MESSAGE, label: "Current point label" }],
    priorityId: pointId, attentionId: pointId,
    route: [{ operationId: "50000000-0000-4000-8000-000000000001", revision: 3,
      kind: "priority_confirmed", compassItemId: pointId, label: "Captured earlier direction",
      recordedAt: "2026-10-29T07:00:00.123456+00:00" }],
    waypoints: [{ id: "60000000-0000-4000-8000-000000000001", sourceMessageId: GUIDE_MESSAGE,
      destination: "One calm choice", meaning: "Room for what matters", arrivalSignal: "I can name a next step",
      status: "reached", reachedEvidence: "I named a next step. <script>not markup</script>",
      reachedAt: "2026-10-29T07:01:00.123456+00:00" }] };
  let writes = 0;
  await mockState(page, () => success(state));
  await page.route("**/explorer/conversation/commands", route => { writes += 1; return route.abort(); });
  await page.goto("/explorer/conversation");
  await expect(page.getByRole("heading", { name: "Route", exact: true })).toBeVisible();
  await expect(page.getByText("Captured earlier direction", { exact: false })).toBeVisible();
  await page.getByText("Review saved Reached confirmation", { exact: true }).click();
  await expect(page.getByText(state.waypoints[0].reachedEvidence!, { exact: true })).toBeVisible();
  await expect(page.locator('time[datetime="2026-10-29T07:01:00.123456+00:00"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Review Reached: One calm choice", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Captured earlier direction", { exact: false })).toBeVisible();
  await page.getByText("Review saved Reached confirmation", { exact: true }).click();
  await expect(page.getByText(state.waypoints[0].reachedEvidence!, { exact: true })).toBeVisible();
  expect(writes).toBe(0);
});

test("C01 empty Discovery loads without a write or scripted message", async ({ page }) => {
  let writes = 0;
  await mockState(page, () => success(emptyState()));
  await page.route("**/explorer/conversation/commands", route => { writes += 1; return route.abort(); });
  await page.goto("/explorer/conversation");
  await expect(page.getByRole("heading", { name: "Your conversation", exact: true })).toBeFocused();
  await expect(page.getByText("There are no saved messages yet.", { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Saved conversation", exact: true })).toHaveCount(0);
  expect(writes).toBe(0);
});

test("C02 send renders authoritative history and reloads from GET", async ({ page }) => {
  let current = emptyState();
  let writes = 0;
  await mockState(page, () => success(current));
  await page.route("**/explorer/conversation/commands", async route => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    const command = request.postDataJSON() as ExplorerConversationCommand;
    expect(Object.keys(command).sort()).toEqual(["body", "expectedRevision", "kind", "operationId"]);
    expect(command.kind).toBe("send");
    expect(command.expectedRevision).toBe(0);
    expect(command.operationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    if (command.kind !== "send") throw new Error("unexpected_command");
    writes += 1;
    current = savedState(command.body);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(current)) });
  });
  await page.goto("/explorer/conversation");
  await page.getByLabel("Continue the conversation", { exact: true }).fill("A synthetic Explorer question");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("list", { name: "Saved conversation", exact: true })).toContainText("A synthetic transport reply");
  await expect(page.getByLabel("Continue the conversation", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
  await expect(page.getByRole("list", { name: "Saved conversation", exact: true })).toContainText("A synthetic Explorer question");
  await page.reload();
  await expect(page.getByRole("list", { name: "Saved conversation", exact: true })).toContainText("A synthetic transport reply");
  expect(writes).toBe(1);
});

test("C03 uncertain response retains exact request bytes and operation identity", async ({ page }) => {
  const bodies: string[] = [];
  await mockState(page, () => success(emptyState()));
  await page.route("**/explorer/conversation/commands", async route => {
    bodies.push(route.request().postData() ?? "");
    if (bodies.length === 1) return route.abort("failed");
    const command = JSON.parse(bodies[1]) as ExplorerConversationCommand;
    if (command.kind !== "send") throw new Error("unexpected_command");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(savedState(command.body))) });
  });
  await page.goto("/explorer/conversation");
  await page.getByLabel("Continue the conversation", { exact: true }).fill("Keep this exact operation");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry the same request", exact: true })).toBeVisible();
  await expect(page.getByLabel("Continue the conversation", { exact: true })).toHaveValue("Keep this exact operation");
  await expect(page.getByLabel("Continue the conversation", { exact: true })).toBeDisabled();
  await expect(page.getByRole("list", { name: "Saved conversation", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Retry the same request", exact: true }).click();
  await expect(page.getByRole("list", { name: "Saved conversation", exact: true })).toContainText("Keep this exact operation");
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toBe(bodies[0]);
});

test("C04 malformed command success cannot render a reply or lose retry identity", async ({ page }) => {
  const bodies: string[] = [];
  await mockState(page, () => success(emptyState()));
  await page.route("**/explorer/conversation/commands", route => {
    bodies.push(route.request().postData() ?? "");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(privateResponse({ ok: true, state: { messages: [{ role: "virtualGuide", body: "Do not display this malformed reply" }] }, error: null })) });
  });
  await page.goto("/explorer/conversation");
  await page.getByLabel("Continue the conversation", { exact: true }).fill("A bounded request");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry the same request", exact: true })).toBeVisible();
  await expect(page.getByText("Do not display this malformed reply", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Retry the same request", exact: true }).click();
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1]).toBe(bodies[0]);
});

test("C05 denied read offers reentry and reveals no history or command controls", async ({ page }) => {
  await mockState(page, () => failure("denied"));
  await page.goto("/explorer/conversation");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("not available in your current session");
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/login/explorer");
  await expect(page.getByLabel("Continue the conversation", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Saved conversation", exact: true })).toHaveCount(0);
});

test("C06 stale command requires a read and never automatically resends", async ({ page }) => {
  let current = emptyState();
  let writes = 0;
  await mockState(page, () => success(current));
  await page.route("**/explorer/conversation/commands", route => {
    writes += 1;
    current = { ...savedState(), revision: 2 };
    return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify(failure("refresh_required")) });
  });
  await page.goto("/explorer/conversation");
  await page.getByLabel("Continue the conversation", { exact: true }).fill("An unsaved stale draft");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Your conversation has changed");
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
  await expect(page.getByRole("list", { name: "Saved conversation", exact: true })).toContainText("A synthetic Explorer question");
  await expect(page.getByLabel("Continue the conversation", { exact: true })).toHaveValue("An unsaved stale draft");
  expect(writes).toBe(1);
});

test("C07 unavailable provider disables send while retaining saved history", async ({ page }) => {
  let writes = 0;
  await mockState(page, () => success({ ...savedState(), providerState: "unavailable" }));
  await page.route("**/explorer/conversation/commands", route => { writes += 1; return route.abort(); });
  await page.goto("/explorer/conversation");
  await expect(page.getByRole("list", { name: "Saved conversation", exact: true })).toContainText("A synthetic Explorer question");
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Continue the conversation", { exact: true })).toBeDisabled();
  await expect(page.getByText(/unavailable\. You can review saved messages/)).toBeVisible();
  expect(writes).toBe(0);
});

test("C08 provider unavailability after send claims neither saved message nor reply", async ({ page }) => {
  await mockState(page, () => success(emptyState()));
  await page.route("**/explorer/conversation/commands", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify(failure("provider_unavailable")) }));
  await page.goto("/explorer/conversation");
  await page.getByLabel("Continue the conversation", { exact: true }).fill("Do not invent success");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("No new message or reply has been confirmed saved");
  await expect(page.getByLabel("Continue the conversation", { exact: true })).toHaveValue("Do not invent success");
  await expect(page.getByRole("list", { name: "Saved conversation", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retry the same request", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
});

test("C09 two immediate activations have one owned pending command", async ({ page }) => {
  let writes = 0;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await mockState(page, () => success(emptyState()));
  await page.route("**/explorer/conversation/commands", async route => {
    writes += 1;
    await held;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(savedState("One command only"))) });
  });
  await page.goto("/explorer/conversation");
  await page.getByLabel("Continue the conversation", { exact: true }).fill("One command only");
  await page.getByRole("button", { name: "Send", exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect.poll(() => writes).toBe(1);
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
  release();
  await expect(page.getByRole("list", { name: "Saved conversation", exact: true })).toContainText("One command only");
  expect(writes).toBe(1);
});

test("C10 malformed initial state is refused rather than rendered", async ({ page }) => {
  await mockState(page, () => ({ ...success(savedState()), secret: "unexpected-private-field" }));
  await page.goto("/explorer/conversation");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("could not be loaded");
  await expect(page.getByText("unexpected-private-field", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Continue the conversation", { exact: true })).toHaveCount(0);
});

test("C11 a pending saved turn blocks new send and formation but permits a read", async ({ page }) => {
  let reads = 0;
  let writes = 0;
  const pending: ExplorerConversationState = { ...savedState(), pendingTurn: true,
    messages: savedState().messages.filter(message => message.role === "explorer") };
  await mockState(page, () => { reads += 1; return success(pending); });
  await page.route("**/explorer/conversation/commands", route => { writes += 1; return route.abort(); });
  await page.goto("/explorer/conversation");
  await expect(page.getByText(/A saved message is still awaiting a confirmed result/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
  await expect(page.getByRole("combobox").first()).toBeDisabled();
  await expect(page.getByText("A synthetic transport reply", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reload saved conversation", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
  await expect.poll(() => reads).toBe(2);
  expect(writes).toBe(0);
});

test("C12 saved-message capacity disables sending and keeps formation available", async ({ page }) => {
  let writes = 0;
  const full = { ...savedState(), messages: Array.from({ length: 100 }, (_, index) => ({
    ...savedState().messages[index % 2], id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  })) };
  await mockState(page, () => success(full));
  await page.route("**/explorer/conversation/commands", route => { writes += 1; return route.abort(); });
  await page.goto("/explorer/conversation");
  await expect(page.getByText(/This conversation has reached its saved-message limit/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Continue the conversation", { exact: true })).toBeDisabled();
  await expect(page.getByRole("region", { name: "Session Compass", exact: true }).getByRole("combobox", { name: "Saved conversation source", exact: true })).toBeEnabled();
  expect(writes).toBe(0);
});

test("C13 transient first-Send assistance preserves the unsaved draft and stays outside saved history", async ({ page }) => {
  let current = emptyState();
  let reads = 0;
  let writes = 0;
  const assistance: SyntheticAssistance = { kind: "support",
    body: "Synthetic transient support only. No attempted message or reply was saved.", persisted: false };
  await mockState(page, () => { reads += 1; return success(current); });
  await page.route("**/explorer/conversation/commands", route => {
    writes += 1;
    // This empty anchor and assistance are endpoint fixtures, not real SQL or safety evidence.
    current = { ...emptyState(), conversationId: CONVERSATION };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(current, assistance)) });
  });
  await page.goto("/explorer/conversation");
  await page.getByLabel("Continue the conversation", { exact: true }).fill("Keep this unaccepted first-Send draft");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(assistance.body);
  await expect(page.getByLabel("Continue the conversation", { exact: true })).toHaveValue("Keep this unaccepted first-Send draft");
  await expect(page.getByText("There are no saved messages yet.", { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Saved conversation", exact: true })).toHaveCount(0);
  await expect(page.getByText("Your saved conversation is up to date.", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
  await expect.poll(() => reads).toBe(2);
  await expect(page.getByText(assistance.body, { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Continue the conversation", { exact: true })).toHaveValue("Keep this unaccepted first-Send draft");
  await expect(page.getByRole("list", { name: "Saved conversation", exact: true })).toHaveCount(0);
  expect(writes).toBe(1);
});

test("C14 a denied reload clears stale assistance, saved private history and draft", async ({ page }) => {
  let reads = 0;
  let writes = 0;
  const assistance: SyntheticAssistance = { kind: "adult_policy",
    body: "Synthetic transient adult-policy assistance from the previous request.", persisted: false };
  await mockState(page, () => { reads += 1; return reads === 1 ? success(savedState()) : failure("denied"); });
  await page.route("**/explorer/conversation/commands", route => {
    writes += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(success(savedState(), assistance)) });
  });
  await page.goto("/explorer/conversation");
  await expect(page.getByRole("list", { name: "Saved conversation", exact: true })).toContainText("A synthetic Explorer question");
  await page.getByLabel("Continue the conversation", { exact: true }).fill("A private draft to clear after denial");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(assistance.body);
  await expect(page.getByLabel("Continue the conversation", { exact: true })).toHaveValue("A private draft to clear after denial");
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
  await expect.poll(() => reads).toBe(2);
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/login/explorer");
  await expect(page.getByText(assistance.body, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Saved conversation", exact: true })).toHaveCount(0);
  await expect(page.getByText("A synthetic Explorer question", { exact: true })).toHaveCount(0);
  await expect(page.getByText("A synthetic transport reply", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Continue the conversation", { exact: true })).toHaveCount(0);
  expect(writes).toBe(1);
});
