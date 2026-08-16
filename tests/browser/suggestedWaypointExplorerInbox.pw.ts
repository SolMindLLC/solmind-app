import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

const UNREAD_ID = "66666666-6666-4666-8666-666666666666";
const READ_ID = "77777777-7777-4777-8777-777777777777";
const VERSION_ID = "99999999-9999-4999-8999-999999999999";
const OTHER_VERSION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const success = (items: readonly Record<string, unknown>[], nextCursor: string | null, totalCount: number) => ({
  ok: true,
  data: { items, next_cursor: nextCursor, total_count: totalCount },
  error: null,
});

const item = (overrides: Record<string, unknown> = {}) => ({
  suggested_waypoint_id: UNREAD_ID,
  current_version_id: VERSION_ID,
  destination_preview: "Protect one evening each week for recovery",
  received_at: "2026-08-16T06:00:00.000Z",
  read: false,
  receipt_acknowledged: false,
  acknowledged_at: null,
  channel_category: "open",
  ...overrides,
});

const fulfillJson = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

const expectNoSeriousAxeViolations = async (page: Page) => {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    result.violations
      .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
      .map(({ id, impact, help }) => ({ id, impact, help })),
  ).toEqual([]);
};

test.describe("authenticated Explorer Suggested Waypoint inbox", () => {
  test("shows delivered states, opens by keyboard, and restores row focus", async ({ page }) => {
    await page.route("**/explorer/waypoints/suggestions?**", (route) => fulfillJson(route, success([
      item(),
      item({
        suggested_waypoint_id: READ_ID,
        current_version_id: OTHER_VERSION_ID,
        destination_preview: "Try a shorter Monday planning routine",
        read: true,
        receipt_acknowledged: true,
        acknowledged_at: "2026-08-16T06:05:00.000Z",
      }),
    ], null, 2)));

    await page.goto("/explorer/waypoints");
    await expect(page.getByText("Unread", { exact: false })).toBeVisible();
    await expect(page.getByText("You acknowledged receipt Aug 16", { exact: false })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Pull Back");
    await expect(page.locator("body")).not.toContainText("Pending send");

    const row = page.getByRole("link", { name: /Protect one evening each week for recovery/ });
    await row.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/explorer/waypoints/${UNREAD_ID}$`));
    await expect(page.getByRole("heading", { name: "Suggestion detail" })).toBeVisible();
    await page.getByRole("link", { name: "Back to Waypoint Suggestions" }).click();
    await expect(page).toHaveURL(new RegExp(`/explorer/waypoints\\?focus=${UNREAD_ID}$`));
    await expect(row).toBeFocused();
    await expectNoSeriousAxeViolations(page);
  });

  test("keeps the last safe page when a later page fails", async ({ page }) => {
    await page.route("**/explorer/waypoints/suggestions?**", (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.has("cursor")) {
        return fulfillJson(route, {
          ok: false,
          data: null,
          error: "SolMind Waypoint Suggestions could not be loaded.",
        });
      }
      return fulfillJson(route, success([item()], "bmV4dA==", 6));
    });
    await page.goto("/explorer/waypoints");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "The requested page could not be loaded. The current page remains available.",
    );
    await expect(page.getByText("Protect one evening each week for recovery")).toBeVisible();
  });

  test("renders empty, denied, and failed states without suggestion leakage", async ({ page }) => {
    let responseMode: "empty" | "denied" | "failed" = "empty";
    await page.route("**/explorer/waypoints/suggestions?**", (route) => {
      if (responseMode === "empty") return fulfillJson(route, success([], null, 0));
      return fulfillJson(route, {
        ok: false,
        data: null,
        error: responseMode === "denied"
          ? "SolMind Waypoint Suggestions are unavailable."
          : "SolMind Waypoint Suggestions could not be loaded.",
      });
    });
    await page.goto("/explorer/waypoints");
    await expect(page.getByRole("heading", { name: "No suggestions yet" })).toBeVisible();
    responseMode = "denied";
    await page.reload();
    await expect(page.getByRole("heading", { name: "Waypoint Suggestions unavailable" })).toBeVisible();
    responseMode = "failed";
    await page.reload();
    await expect(page.getByRole("heading", { name: "Could not load Waypoint Suggestions" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(UNREAD_ID);
    await expectNoSeriousAxeViolations(page);
  });

  test("opens and closes the Explorer navigation at narrow width", async ({ page }) => {
    await page.route("**/explorer/waypoints/suggestions?**", (route) => fulfillJson(route, success([], null, 0)));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/explorer/waypoints");
    const menu = page.getByRole("navigation", { name: "Explorer navigation" });
    await expect(menu).toBeHidden();
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(menu).toBeVisible();
    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(menu).toBeHidden();
  });
});
