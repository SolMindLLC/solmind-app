// Mounted UI with mocked endpoints only: no actual sign-in, SQL, provider, Send or human acceptance.
import { expect, test } from "@playwright/test";
import type { ExplorerConversationState } from "../../src/lib/solmind/explorerConversationContract";

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
