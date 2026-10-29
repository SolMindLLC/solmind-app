import { test, expect } from "@playwright/test";

// Mocked private HTTP results exercise the real client review/confirmation path.
// Separate actual-COMMIT/codec proof is recorded outside this browser test.
test("category review requires confirmation and retains combined sources without Send", async ({ page }) => {
  const id = (n: number) => `f4240000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const first = { id: id(11), sourceMessageId: id(21), label: "Focus A", anchor: null, emphasis: null, mergedIntoItemId: null as string | null };
  const second = { id: id(12), sourceMessageId: id(22), label: "Focus B", anchor: null, emphasis: null, mergedIntoItemId: null as string | null };
  let state = { version: "explorer-conversation.v1", conversationId: id(1), revision: 1, pendingTurn: false, providerState: "unavailable",
    messages: [{ id: id(21), role: "explorer", body: "Exact original first source.", createdAt: "2026-10-29T10:00:00Z" },
      { id: id(22), role: "virtualGuide", body: "Exact original second source.", createdAt: "2026-10-29T10:00:01Z" }],
    compassItems: [first, second], priorityId: null, attentionId: null, waypoints: [], route: [] as object[] };
  const commands: Record<string, unknown>[] = [];
  const response = () => ({ version: "explorer-private-conversation-response.v1", result: { ok: true, state, error: null }, assistance: null });
  await page.route("**/explorer/conversation/state", route => route.fulfill({ json: response() }));
  await page.route("**/explorer/conversation/commands", async route => {
    const command = route.request().postDataJSON() as Record<string, unknown>; commands.push(command);
    expect(command.kind).toBe("confirm_compass_category"); expect(command.expectedRevision).toBe(1);
    expect(command.targetItemId).toBe(first.id); expect(command.memberItemIds).toEqual([first.id, second.id]);
    expect(command.label).toBe("Reviewed broader focus");
    const beforeItems = [first, second].map(({ id: compassItemId, ...item }) => ({ compassItemId, ...item }));
    state = { ...state, revision: 2, compassItems: [{ ...first, label: "Reviewed broader focus" }, { ...second, mergedIntoItemId: first.id }],
      route: [{ operationId: command.operationId, revision: 2, kind: "category_confirmed", recordedAt: "2026-10-29T10:01:00Z",
        change: { targetItemId: first.id, memberItemIds: [first.id, second.id], beforeItems, label: "Reviewed broader focus" } }] };
    await route.fulfill({ json: response() });
  });
  await page.goto("/explorer/conversation");
  await page.getByText("Other paths (2)", { exact: true }).click();
  await page.getByRole("button", { name: "Review wording or combine: Focus A", exact: true }).click();
  await page.getByLabel("Wording after this change", { exact: true }).fill("Reviewed broader focus");
  await page.getByLabel("Focus B", { exact: true }).check();
  const confirm = page.getByRole("button", { name: "Confirm combined category", exact: true });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("I reviewed the wording, all contributing sources, the unchanged placement and emphasis, and the Priority and current attention selections.", { exact: true }).check();
  await expect(confirm).toBeEnabled(); await confirm.click();
  await expect(page.getByRole("button", { name: "Review wording or combine: Reviewed broader focus", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review wording or combine: Focus B", exact: true })).toHaveCount(0);
  await expect(page.getByText("Categories combined", { exact: true })).toBeVisible();
  await expect(page.getByText("Combined source points (2)", { exact: true })).toBeVisible();
  expect(commands).toHaveLength(1); expect(commands.some(command => command.kind === "send")).toBe(false);
  await page.reload();
  await page.getByText("Other paths (1)", { exact: true }).click();
  await expect(page.getByText("Combined source points (2)", { exact: true })).toBeVisible();
  expect(commands).toHaveLength(1);
});
