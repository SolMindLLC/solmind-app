// Mocked HTTP exercises the mounted client only. It proves no real Auth/SQL/model/human outcome.
import { expect, test, type Page } from "@playwright/test";
import type { ExplorerConversationCommand, ExplorerConversationState } from "../../src/lib/solmind/explorerConversationContract";

test.use({ trace: "off", screenshot: "off", video: "off" });
const CONVERSATION = "a0010000-0000-4000-8000-000000000001";
const SOURCE = "a0020000-0000-4000-8000-000000000001";
const ORIGINAL = "a0030000-0000-4000-8000-000000000001";
const SUCCESSOR = "a0030000-0000-4000-8000-000000000002";
const now = "2026-10-29T15:00:00Z";
const initial = (reached = false): ExplorerConversationState => ({ version: "explorer-conversation.v1", conversationId: CONVERSATION, revision: 5, sessionStatus: "active", ending: null, pendingTurn: false, providerState: "unavailable", messages: [{ id: SOURCE, role: "explorer", body: "A private synthetic source.", createdAt: now }], compassItems: [], priorityId: null, attentionId: null, route: [], waypoints: [{ id: ORIGINAL, sourceMessageId: SOURCE, destination: "A saved destination", meaning: "A saved meaning", arrivalSignal: "A saved signal", status: reached ? "reached" : "chosen", reachedEvidence: reached ? "An earlier actual test observation" : null, reachedAt: reached ? now : null }] });
const success = (state: ExplorerConversationState) => ({ version: "explorer-private-conversation-response.v1", result: { ok: true, state, error: null }, assistance: null });
async function setup(page: Page, current: () => ExplorerConversationState) {
  await page.route("**/explorer/conversation/state", route => route.fulfill({ json: success(current()) }));
}

test("clarification uses one app question at a time and saves only after complete explicit review", async ({ page }) => {
  let state = initial(); const commands: ExplorerConversationCommand[] = [];
  await setup(page, () => state);
  await page.route("**/explorer/conversation/commands", async route => {
    const command = route.request().postDataJSON() as Extract<ExplorerConversationCommand, { kind: "revise_waypoint" }>;
    commands.push(command);
    expect(command.kind).toBe("revise_waypoint");
    expect(command.waypointId).toBe(ORIGINAL); expect(command.expectedRevision).toBe(5);
    expect(command.answers).toEqual([{ component: "destination", answer: "A newly clarified destination" }]);
    expect(Object.keys(command).sort()).toEqual(["answers", "expectedRevision", "kind", "operationId", "waypointId"]);
    const predecessor = state.waypoints[0];
    state = { ...state, revision: 6, waypoints: [predecessor, { ...predecessor, id: SUCCESSOR, destination: "A newly clarified destination", lifecycle: { predecessorWaypointId: ORIGINAL, creationReason: "revision", clarifications: [{ component: "destination", questionKey: "waypoint.destination.v1", answer: "A newly clarified destination", recordedAt: now }] } }] };
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
  await expect(page.getByText("Superseded — earlier chosen definition", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "A newly clarified destination", exact: true })).toBeVisible();
  expect(commands).toHaveLength(1); expect(commands.some(command => command.kind === "send")).toBe(false);
  await page.reload();
  await expect(page.getByRole("region", { name: "Waypoint clarification — application prompt", exact: true })).toHaveCount(0);
  await page.getByText("Review this revision and its clarification sources", { exact: true }).click();
  await expect(page.getByText("Explorer clarification in this conversation — destination", { exact: true })).toBeVisible();
  expect(commands).toHaveLength(1);
});

test("all-Keep revisit starts a new chosen lifecycle without inheriting earlier Reached evidence", async ({ page }) => {
  let state = initial(true); const commands: ExplorerConversationCommand[] = [];
  await setup(page, () => state);
  await page.route("**/explorer/conversation/commands", async route => {
    const command = route.request().postDataJSON() as Extract<ExplorerConversationCommand, { kind: "revisit_waypoint" }>;
    commands.push(command); expect(command.kind).toBe("revisit_waypoint"); expect(command.answers).toEqual([]);
    const predecessor = state.waypoints[0];
    state = { ...state, revision: 6, waypoints: [predecessor, { ...predecessor, id: SUCCESSOR, status: "chosen", reachedEvidence: null, reachedAt: null, lifecycle: { predecessorWaypointId: ORIGINAL, creationReason: "revisit", clarifications: [] } }] };
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
  await expect(page.getByText("Superseded — earlier Reached confirmation", { exact: true })).toBeVisible();
  await expect(page.getByText("In progress — chosen by you", { exact: true })).toBeVisible();
  expect(commands).toHaveLength(1); expect(commands.some(command => command.kind === "send")).toBe(false);
});
