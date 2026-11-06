// Mocked HTTP exercises the mounted client only. It proves no real Auth/SQL/model/human outcome.
import { expect, test, type Page } from "@playwright/test";
import type { ExplorerConversationCommand, ExplorerConversationState } from "../../src/lib/solmind/explorerConversationContract";

test.use({ trace: "off", screenshot: "off", video: "off" });
const CONVERSATION = "a0010000-0000-4000-8000-000000000001";
const SOURCE = "a0020000-0000-4000-8000-000000000001";
const ORIGINAL = "a0030000-0000-4000-8000-000000000001";
const SUCCESSOR = "a0030000-0000-4000-8000-000000000002";
const now = "2026-10-29T15:00:00Z";
const initial = (reached = false): ExplorerConversationState => ({ waypointCapacity: { activeCount: reached ? 0 : 1, activeLimit: 20, historyRoom: true }, waypointProjection: { kind: "current_heads" as const, limit: 20 as const, totalHeads: 1, hasMore: false }, version: "explorer-conversation.v1", conversationId: CONVERSATION, revision: 5, sessionStatus: "active", ending: null, pendingTurn: false, turnedDownLimitReached: false, waypointDraft: null, providerState: "unavailable", messages: [{ id: SOURCE, role: "explorer", body: "A private synthetic source.", createdAt: now }], compassItems: [], priorityId: null, attentionId: null, route: [], waypoints: [{ isCurrent: true, createdAt: "2026-10-29T14:59:00Z", id: ORIGINAL, sourceMessageId: SOURCE, title: "A saved destination", destination: "A saved destination", meaning: "A saved meaning", arrivalSignal: "A saved signal", status: reached ? "reached" : "chosen", reachedEvidence: reached ? "An earlier actual test observation" : null, reachedAt: reached ? now : null }] });
const success = (state: ExplorerConversationState) => ({ version: "explorer-private-conversation-response.v1", result: { ok: true, state, error: null }, assistance: null });
async function setup(page: Page, current: () => ExplorerConversationState) {
  await page.route("**/explorer/conversation/state", route => route.fulfill({ json: success(current()) }));
}

test("clarification at twenty active uses one app question at a time and saves only after complete explicit review", async ({ page }) => {
  let state = { ...initial(), waypointCapacity: { activeCount: 20, activeLimit: 20, historyRoom: true } };
  const commands: ExplorerConversationCommand[] = [];
  await setup(page, () => state);
  await page.route("**/explorer/conversation/commands", async route => {
    const command = route.request().postDataJSON() as Extract<ExplorerConversationCommand, { kind: "revise_waypoint" }>;
    commands.push(command);
    expect(command.kind).toBe("revise_waypoint");
    expect(command.waypointId).toBe(ORIGINAL); expect(command.expectedRevision).toBe(5);
    expect(command.answers).toEqual([{ component: "destination", answer: "A newly clarified destination" }]);
    expect(Object.keys(command).sort()).toEqual(["answers", "expectedRevision", "kind", "operationId", "waypointId"]);
    const predecessor = state.waypoints[0];
    state = { ...state, revision: 6, waypoints: [{ ...predecessor, id: SUCCESSOR, createdAt: now,
      title: "A newly clarified destination", destination: "A newly clarified destination", lifecycle: { predecessorWaypointId: ORIGINAL, creationReason: "revision", clarifications: [{ component: "destination", questionKey: "waypoint.destination.v1", answer: "A newly clarified destination", recordedAt: now }] } }] };
    await route.fulfill({ json: success(state) });
  });
  await page.goto("/explorer/conversation");
  await page.getByRole("button", { name: "Clarify this Waypoint in the conversation", exact: true }).click();
  const thread = page.getByRole("region", { name: "Waypoint clarification — application prompt", exact: true });
  await expect(thread).toBeVisible();
  await expect(thread.getByText("Where do you want to arrive now?", { exact: true })).toBeVisible();
  await expect(thread.getByText("Why does reaching that place matter to you now?", { exact: true })).toHaveCount(0);
  await expect(thread.getByRole("button", { name: "Confirm revised Waypoint", exact: true })).toHaveCount(0);
  await thread.getByLabel("Your answer", { exact: true }).fill("  A newly clarified destination  ");
  await thread.getByRole("button", { name: "Use my answer", exact: true }).click();
  await expect(thread.getByText("Why does reaching that place matter to you now?", { exact: true })).toBeVisible();
  await thread.getByRole("button", { name: "Keep this understanding", exact: true }).click();
  await expect(thread.getByText("What observable signal would help you recognize arrival now?", { exact: true })).toBeVisible();
  await thread.getByRole("button", { name: "Keep this understanding", exact: true }).click();
  await expect(thread.getByRole("group", { name: "Review the complete understanding", exact: true })).toBeVisible();
  const confirm = thread.getByRole("button", { name: "Confirm revised Waypoint", exact: true });
  await expect(confirm).toBeDisabled(); expect(commands).toHaveLength(0);
  await thread.getByLabel("I reviewed the complete understanding and its sources, and I confirm this revision.", { exact: true }).check();
  await confirm.click();
  // Paul's question 9 decision (2026-11-03 12:41:08 CST). The current tools are scoped: since chat step slices S1 and S2 the
  // Compass & Waypoint card shows the same Waypoints on wide screens.
  const tools = page.getByLabel("Private Compass and Waypoints", { exact: true });
  await expect(tools.getByText("Earlier version - Formed", { exact: true })).toHaveCount(0);
  expect(state.waypoints[0].lifecycle?.predecessorWaypointId).toBe(ORIGINAL);
  expect(state.waypointCapacity.activeCount).toBe(20);
  await expect(page.getByText(/Superseded/)).toHaveCount(0);
  await expect(tools.getByRole("heading", { name: "A newly clarified destination", exact: true })).toBeVisible();
  expect(commands).toHaveLength(1); expect(commands.some(command => command.kind === "send")).toBe(false);
  await page.reload();
  await expect(page.getByRole("region", { name: "Waypoint clarification — application prompt", exact: true })).toHaveCount(0);
  await page.getByText("Review this revision and its clarification sources", { exact: true }).click();
  await expect(tools.getByText("You confirmed a revised understanding. The earlier definition stays saved privately. Earlier versions cannot currently be opened.", { exact: true })).toBeVisible();
  await expect(tools.getByRole("link", { name: "Review the earlier saved version", exact: true, includeHidden: true })).toHaveCount(0);
  await expect(page.getByText("Explorer clarification in this conversation — destination", { exact: true })).toBeVisible();
  expect(commands).toHaveLength(1);
});

test("all-Keep revisit starts a new chosen lifecycle without inheriting earlier Reached evidence", async ({ page }) => {
  let state = { ...initial(true), waypointCapacity: { activeCount: 19, activeLimit: 20, historyRoom: true } };
  const commands: ExplorerConversationCommand[] = [];
  await setup(page, () => state);
  await page.route("**/explorer/conversation/commands", async route => {
    const command = route.request().postDataJSON() as Extract<ExplorerConversationCommand, { kind: "revisit_waypoint" }>;
    commands.push(command); expect(command.kind).toBe("revisit_waypoint"); expect(command.answers).toEqual([]);
    const predecessor = state.waypoints[0];
    state = { ...state, revision: 6, waypointCapacity: { activeCount: 20, activeLimit: 20, historyRoom: true },
      waypoints: [{ ...predecessor, id: SUCCESSOR, createdAt: now, status: "chosen", reachedEvidence: null, reachedAt: null, lifecycle: { predecessorWaypointId: ORIGINAL, creationReason: "revisit", clarifications: [] } }] };
    await route.fulfill({ json: success(state) });
  });
  await page.goto("/explorer/conversation");
  await page.getByRole("button", { name: "Revisit this Waypoint in the conversation", exact: true }).click();
  const thread = page.getByRole("region", { name: "Waypoint clarification — application prompt", exact: true });
  for (let i = 0; i < 3; i++) await thread.getByRole("button", { name: "Keep this understanding", exact: true }).click();
  await expect(thread.getByText(/Earlier Reached evidence and release history remain historical/)).toBeVisible();
  const confirm = thread.getByRole("button", { name: "Confirm new lifecycle", exact: true });
  await expect(confirm).toBeDisabled(); expect(commands).toHaveLength(0);
  await thread.getByLabel("I reviewed the complete understanding and its sources, and I confirm this new current lifecycle.", { exact: true }).check();
  await confirm.click();
  const tools = page.getByLabel("Private Compass and Waypoints", { exact: true });
  await expect(tools.getByText("Earlier version - Reached", { exact: true })).toHaveCount(0);
  await expect(tools.getByText("An earlier actual test observation", { exact: true })).toHaveCount(0);
  expect(state.waypoints[0].lifecycle?.predecessorWaypointId).toBe(ORIGINAL);
  expect(state.waypointCapacity.activeCount).toBe(20);
  await tools.getByText("Review this new lifecycle and its clarification sources", { exact: true }).click();
  await expect(tools.getByText("You confirmed a new current lifecycle. Earlier Reached evidence or release history does not count as current arrival. The earlier definition stays saved privately. Earlier versions cannot currently be opened.", { exact: true })).toBeVisible();
  await expect(tools.getByRole("link", { name: "Review the earlier saved version", exact: true, includeHidden: true })).toHaveCount(0);
  await expect(page.getByText(/Superseded/)).toHaveCount(0);
  await expect(page.getByText("In progress — chosen by you", { exact: true })).toBeVisible();
  expect(commands).toHaveLength(1); expect(commands.some(command => command.kind === "send")).toBe(false);
});

test("lane 7 revisit needs active room and revision needs history room", async ({ page }) => {
  let state = { ...initial(true), waypointCapacity: { activeCount: 20, activeLimit: 20, historyRoom: true } };
  let writes = 0;
  await setup(page, () => state);
  await page.route("**/explorer/conversation/commands", route => { writes += 1; return route.abort(); });
  await page.goto("/explorer/conversation");
  const revisit = page.getByRole("button", { name: "Revisit this Waypoint in the conversation", exact: true });
  await expect(revisit).toBeDisabled();
  const tools = page.getByLabel("Private Compass and Waypoints", { exact: true });
  const activeReason = "You have 20 active Waypoints across your conversations. To help keep your focus manageable, your total must be below 20 before adding or bringing back another. Reached and Released Waypoints do not count. Review and confirm Reached for Waypoints you have reached, or release those you no longer want to pursue.";
  const revisitReason = tools.getByRole("listitem").filter({ has: revisit }).getByText(activeReason, { exact: true });
  await expect(revisitReason).toBeVisible();
  await expect(revisit).toHaveAttribute("aria-describedby", (await revisitReason.getAttribute("id"))!);
  await revisitReason.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(revisitReason).toBeFocused();
  await expect(revisitReason).toHaveAttribute("role", "alert");
  await revisit.evaluate(button => (button as HTMLButtonElement).click());
  expect(writes).toBe(0);
  state = { ...initial(), waypointCapacity: { activeCount: 25, activeLimit: 20, historyRoom: true } };
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
  const clarify = page.getByRole("button", { name: "Clarify this Waypoint in the conversation", exact: true });
  await expect(clarify).toBeEnabled();
  await clarify.click();
  state = { ...state, waypointCapacity: { ...state.waypointCapacity, historyRoom: false } };
  await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
  await expect(clarify).toBeDisabled();
  const historyReason = "This conversation has reached its limit of 200 saved Waypoint versions, to keep its saved history manageable. No new Waypoint or version can be saved here. Marking one Reached or Released does not make room for another version. You can still read the Waypoints shown here, use Reached or Release where available, or end an active conversation.";
  const thread = page.getByRole("region", { name: /Waypoint clarification.*application prompt/ });
  const explanation = thread.getByText(historyReason, { exact: true });
  await expect(explanation).toBeVisible();
  await expect(explanation).toHaveAttribute("role", "alert");
  await explanation.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(explanation).toBeFocused();
  await expect(thread.getByRole("group")).toHaveAttribute("aria-describedby", (await explanation.getAttribute("id"))!);
  const clarifyReason = tools.getByRole("listitem").filter({ has: clarify }).getByText(historyReason, { exact: true });
  await expect(clarifyReason).toBeVisible();
  await expect(clarify).toHaveAttribute("aria-describedby", (await clarifyReason.getAttribute("id"))!);
  await expect(tools.getByText(historyReason, { exact: true })).toHaveCount(3);
  await expect(tools.getByText(/You have 25 active Waypoints/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Keep this understanding", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Review release: A saved destination", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Review Reached: A saved destination", exact: true })).toBeEnabled();
  expect(writes).toBe(0);
});
