// Mocked HTTP exercises the mounted client only. It proves no real Auth/SQL/model/human outcome.
import { expect, test, type Page } from "@playwright/test";
import type { ExplorerConversationState } from "../../src/lib/solmind/explorerConversationContract";

test.use({ trace: "off", screenshot: "off", video: "off" });
const CONVERSATION = "a0010000-0000-4000-8000-000000000001";
const SOURCE = "a0020000-0000-4000-8000-000000000001";
const ORIGINAL = "a0030000-0000-4000-8000-000000000001";
const SUCCESSOR = "a0030000-0000-4000-8000-000000000002";
const now = "2026-10-29T15:00:00Z";
const initial = (): ExplorerConversationState => ({ waypointCapacity: { activeCount: 20, activeLimit: 20, historyRoom: true, conversationRoom: true }, waypointProjection: { kind: "current_heads" as const, limit: 20 as const, totalHeads: 1, hasMore: false }, version: "explorer-conversation.v1", conversationId: CONVERSATION, revision: 6, sessionStatus: "active", ending: null, pendingTurn: false, turnedDownLimitReached: false, waypointDraft: null, providerState: "unavailable", messages: [{ id: SOURCE, role: "explorer", body: "A private synthetic source.", createdAt: now }], compassItems: [], priorityId: null, attentionId: null, route: [], waypoints: [{ isCurrent: true, createdAt: now, id: SUCCESSOR, sourceMessageId: SOURCE, title: "A saved destination", destination: "A saved destination", meaning: "A saved meaning", arrivalSignal: "A saved signal", status: "chosen", reachedEvidence: null, reachedAt: null }] });
const success = (state: ExplorerConversationState) => ({ version: "explorer-private-conversation-response.v1", result: { ok: true, state, error: null }, assistance: null });
async function setup(page: Page, state: ExplorerConversationState) {
  await page.route("**/explorer/conversation/state", route => route.fulfill({ json: success(state) }));
}
async function openWaypoints(page: Page) {
  const narrow = (page.viewportSize()?.width ?? 0) < 1024;
  if (narrow) await page.locator("#conversation-preview-drawer-opener").click();
  const panel = page.locator(narrow ? "#conversation-preview-drawer" : "#conversation-preview-panel");
  return panel.getByRole("region", { name: "Waypoints", exact: true });
}
async function openEndedReview(page: Page, state: ExplorerConversationState) {
  await page.route("**/explorer/conversations/state*", route => {
    expect(route.request().method()).toBe("GET");
    const selected = new URL(route.request().url()).searchParams.get("conversationId") === CONVERSATION;
    return route.fulfill({ json: { version: "explorer-conversation-review.v1", ok: true,
      items: [{ conversationId: CONVERSATION, endedAt: null }],
      state: selected ? { ...state, sessionStatus: "ended" } : null, error: null } });
  });
  await page.goto("/explorer/conversations");
  await page.getByRole("button", { name: "Review ended conversation 1", exact: true }).click();
  return page.getByLabel("Private Compass and Waypoints", { exact: true });
}

test("a saved clarified Waypoint keeps its current card and revision sources in ended review", async ({ page }) => {
  const base = initial();
  const state: ExplorerConversationState = { ...base, waypoints: [{ ...base.waypoints[0],
    title: "A newly clarified destination", destination: "A newly clarified destination",
    lifecycle: { predecessorWaypointId: ORIGINAL, creationReason: "revision",
      clarifications: [{ component: "destination", questionKey: "waypoint.destination.v1",
        answer: "A newly clarified destination", recordedAt: now }] } }] };
  let writes = 0;
  await setup(page, state);
  await page.route("**/explorer/conversation/commands", route => { writes += 1; return route.abort(); });
  await page.goto("/explorer/conversation");
  let waypoints = await openWaypoints(page);
  await expect(waypoints.getByRole("heading", { name: "A newly clarified destination Formed", exact: true })).toBeVisible();
  await waypoints.getByRole("button", { name: "A newly clarified destination Formed", exact: true }).click();
  await expect(waypoints.getByText("Earlier version - Formed", { exact: true })).toHaveCount(0);
  expect(state.waypoints[0].lifecycle?.predecessorWaypointId).toBe(ORIGINAL);
  expect(state.waypointCapacity.activeCount).toBe(20);
  await expect(page.getByText(/Superseded/)).toHaveCount(0);
  await page.reload();
  waypoints = await openWaypoints(page);
  await expect(waypoints.getByRole("heading", { name: "A newly clarified destination Formed", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: /Waypoint clarification.*application prompt/ })).toHaveCount(0);
  // The removed tools were a route to saved provenance; the ended review still displays it.
  const review = await openEndedReview(page, state);
  await expect(review.getByRole("heading", { name: "A newly clarified destination", exact: true })).toBeVisible();
  await review.getByText("Review this revision and its clarification sources", { exact: true }).click();
  await expect(review.getByText("You confirmed a revised understanding. The earlier definition stays saved privately. You can open earlier versions in Your Waypoints on the Waypoints page.", { exact: true })).toBeVisible();
  await expect(review.getByRole("link", { name: "Review the earlier saved version", exact: true, includeHidden: true })).toHaveCount(0);
  await expect(review.getByText("Explorer clarification in this conversation \u2014 destination", { exact: true })).toBeVisible();
  expect(writes).toBe(0);
});

test("a saved all-Keep revisit keeps its new lifecycle without inherited Reached evidence", async ({ page }) => {
  const base = initial();
  const state: ExplorerConversationState = { ...base, waypoints: [{ ...base.waypoints[0],
    lifecycle: { predecessorWaypointId: ORIGINAL, creationReason: "revisit", clarifications: [] } }] };
  let writes = 0;
  await setup(page, state);
  await page.route("**/explorer/conversation/commands", route => { writes += 1; return route.abort(); });
  await page.goto("/explorer/conversation");
  const waypoints = await openWaypoints(page);
  await expect(waypoints.getByRole("heading", { name: "A saved destination Formed", exact: true })).toBeVisible();
  await waypoints.getByRole("button", { name: "A saved destination Formed", exact: true }).click();
  await expect(waypoints.getByText("Earlier version - Reached", { exact: true })).toHaveCount(0);
  await expect(waypoints.getByText("An earlier actual test observation", { exact: true })).toHaveCount(0);
  expect(state.waypoints[0].lifecycle?.predecessorWaypointId).toBe(ORIGINAL);
  expect(state.waypointCapacity.activeCount).toBe(20);
  const review = await openEndedReview(page, state);
  await expect(review.getByText("Earlier version - Reached", { exact: true })).toHaveCount(0);
  await expect(review.getByText("An earlier actual test observation", { exact: true })).toHaveCount(0);
  await review.getByText("Review this new lifecycle and its clarification sources", { exact: true }).click();
  await expect(review.getByText("You confirmed a new current lifecycle. Earlier Reached evidence or release history does not count as current arrival. The earlier definition stays saved privately. You can open earlier versions in Your Waypoints on the Waypoints page.", { exact: true })).toBeVisible();
  await expect(review.getByRole("link", { name: "Review the earlier saved version", exact: true, includeHidden: true })).toHaveCount(0);
  await expect(page.getByText(/Superseded/)).toHaveCount(0);
  await expect(review.getByText("In progress \u2014 chosen by you", { exact: true })).toBeVisible();
  expect(writes).toBe(0);
});
