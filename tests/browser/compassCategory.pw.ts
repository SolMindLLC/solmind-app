import { test, expect } from "@playwright/test";

// Synthetic saved category facts remain reviewable; fresh category controls are retired.
test("ended category review retains combined sources after reload without editing or Send", async ({ page }) => {
  const id = (n: number) => `f4240000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const first = { id: id(11), sourceMessageId: id(21), label: "Focus A", anchor: null, emphasis: null, mergedIntoItemId: null as string | null };
  const second = { id: id(12), sourceMessageId: id(22), label: "Focus B", anchor: null, emphasis: null, mergedIntoItemId: null as string | null };
  const beforeItems = [first, second].map(({ id: compassItemId, ...item }) => ({ compassItemId, ...item }));
  const state = { version: "explorer-conversation.v1", conversationId: id(1), revision: 3, sessionStatus: "ended", ending: null, pendingTurn: false, turnedDownLimitReached: false, waypointDraft: null, providerState: "unavailable",
    waypointCapacity: { activeCount: 0, activeLimit: 20, historyRoom: true, conversationRoom: true },
    waypointProjection: { kind: "current_heads", limit: 20, totalHeads: 0, hasMore: false },
    messages: [{ id: id(21), role: "explorer", body: "Exact original first source.", createdAt: "2026-10-29T10:00:00Z" },
      { id: id(22), role: "virtualGuide", body: "Exact original second source.", createdAt: "2026-10-29T10:00:01Z" }],
    compassItems: [{ ...first, label: "Reviewed broader focus" }, { ...second, mergedIntoItemId: first.id }],
    priorityId: null, attentionId: null, waypoints: [], route: [{ operationId: id(30), revision: 2, kind: "category_confirmed",
      recordedAt: "2026-10-29T10:01:00Z", change: { targetItemId: first.id, memberItemIds: [first.id, second.id], beforeItems, label: "Reviewed broader focus" } }] };
  const commands: Record<string, unknown>[] = [];
  const response = () => ({ version: "explorer-private-conversation-response.v1", result: { ok: true, state, error: null }, assistance: null });
  await page.route("**/explorer/conversation/state", route => route.fulfill({ json: response() }));
  await page.route("**/explorer/conversations/state*", route => {
    expect(route.request().method()).toBe("GET");
    const selected = new URL(route.request().url()).searchParams.get("conversationId");
    return route.fulfill({ json: { version: "explorer-conversation-review.v1", ok: true,
      items: [{ conversationId: state.conversationId, endedAt: null }],
      state: selected === state.conversationId ? state : null, error: null } });
  });
  await page.route("**/explorer/conversation/commands", route => { commands.push(route.request().postDataJSON()); return route.abort(); });
  await page.goto("/explorer/conversation");
  await expect(page.getByText("This saved conversation has ended. It is available for read-only review.", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Review ended conversations", exact: true }).click();
  for (const reload of [false, true]) {
    if (reload) await page.reload();
    await page.getByRole("button", { name: "Review ended conversation 1", exact: true }).click();
    await page.getByText("Other paths (1)", { exact: true }).click();
    await page.getByText("Combined source points (2)", { exact: true }).click();
    await expect(page.getByText("Exact original second source.", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Categories combined", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Review wording or combine|Confirm combined category|Save Compass point/ })).toHaveCount(0);
  }
  expect(commands).toEqual([]);
});
