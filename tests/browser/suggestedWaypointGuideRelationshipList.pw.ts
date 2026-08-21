import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

const RELATIONSHIP_ID = "55555555-5555-4555-8555-555555555555";
const DRAFT_ID = "66666666-6666-4666-8666-666666666666";
const PENDING_ID = "77777777-7777-4777-8777-777777777777";
const OPEN_ID = "88888888-8888-4888-8888-888888888888";
const VERSION_ID = "99999999-9999-4999-8999-999999999999";

const success = (items: readonly Record<string, unknown>[], nextCursor: string | null, totalCount: number) => ({
  ok: true,
  data: { items, next_cursor: nextCursor, total_count: totalCount },
  error: null,
});

const draft = (id: string, destination: string) => ({
  suggested_waypoint_id: id,
  authoring_mode: "draft",
  authoring_revision: 1,
  destination_preview: destination,
  pending_deadline_at: null,
  pull_back_available: false,
  channel_category: "not_delivered",
  current_version_id: null,
  delivered_at: null,
  acknowledged_version_id: null,
  acknowledged_at: null,
});

const fulfillJson = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

test.use({ timezoneId: "America/Chicago" });

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

test.describe("relationship-scoped Guide Suggested Waypoint list", () => {
  test("shows distinct states and opens the bounded detail destination", async ({ page }) => {
    const pending = {
      ...draft(PENDING_ID, "Plan a short transition after work"),
      authoring_mode: "pending",
      authoring_revision: 2,
      pending_deadline_at: "2026-08-16T06:00:00.000Z",
      pull_back_available: true,
      channel_category: "pending",
    };
    const open = {
      ...draft(OPEN_ID, "Notice what makes a meeting feel useful"),
      authoring_mode: "delivered",
      authoring_revision: 3,
      channel_category: "open",
      current_version_id: VERSION_ID,
      delivered_at: "2026-08-16T06:00:00.000Z",
      acknowledged_version_id: VERSION_ID,
      acknowledged_at: "2026-08-16T06:05:00.000Z",
    };
    await page.route(`**/guide/waypoint-suggestions/${RELATIONSHIP_ID}/suggestions?**`, (route) =>
      fulfillJson(route, success([
        draft(DRAFT_ID, "Protect one evening each week for recovery"),
        pending,
        open,
      ], null, 3)),
    );
    await page.route(
      `**/guide/waypoint-suggestions/${RELATIONSHIP_ID}/${DRAFT_ID}/detail`,
      (route) => fulfillJson(route, {
        ok: true,
        data: {
          ...draft(DRAFT_ID, "Protect one evening each week for recovery"),
          pending_version_id: null,
          draft_or_pending_destination: "Protect one evening each week for recovery",
          draft_or_pending_why: "A protected evening may support recovery.",
          draft_or_pending_arrival_signals: ["One evening stays unscheduled."],
          delivered_destination: null,
          delivered_why: null,
          delivered_arrival_signals: null,
          policy_key: null,
          policy_version: null,
          effective_seconds: null,
        },
        error: null,
      }),
    );

    await page.goto(`/guide/waypoint-suggestions/${RELATIONSHIP_ID}`);
    await expect(page.getByText(/Draft$/, { exact: false })).toBeVisible();
    await expect(page.getByText("Pull Back available", { exact: false })).toBeVisible();
    await expect(page.getByText("Receipt acknowledged Aug 16, 2026", { exact: false })).toBeVisible();
    await expect(page.getByText("Scheduled for Aug 16, 2026", { exact: true })).toBeVisible();
    await expect(page.getByText("Sent Aug 16, 2026", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    const row = page.getByRole("link", { name: /Protect one evening each week for recovery/ });
    await row.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/${RELATIONSHIP_ID}/${DRAFT_ID}$`));
    await expect(page.getByRole("heading", { name: "Suggestion detail" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Guide-only draft" })).toBeVisible();
    await page.getByRole("link", { name: "Back to Waypoint Suggestions" }).click();
    await expect(page).toHaveURL(new RegExp(`/${RELATIONSHIP_ID}\\?focus=${DRAFT_ID}$`));
    await expect(row).toBeFocused();
    await expectNoSeriousAxeViolations(page);
  });

  test("keeps the last safe page when a later page fails", async ({ page }) => {
    await page.route(`**/guide/waypoint-suggestions/${RELATIONSHIP_ID}/suggestions?**`, (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.has("cursor")) {
        return fulfillJson(route, {
          ok: false,
          data: null,
          error: "SolMind Suggested Waypoints could not be loaded.",
        });
      }
      return fulfillJson(route, success([
        draft(DRAFT_ID, "Protect one evening each week for recovery"),
      ], "bmV4dA==", 6));
    });

    await page.goto(`/guide/waypoint-suggestions/${RELATIONSHIP_ID}`);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "The requested page could not be loaded. The current page remains available.",
    );
    await expect(page.getByText("Protect one evening each week for recovery")).toBeVisible();
  });

  test("recovers a stale later-page cursor once and clears pagination history", async ({ page }) => {
    const requestUrls: URL[] = [];
    let firstPageCalls = 0;
    await page.route(`**/guide/waypoint-suggestions/${RELATIONSHIP_ID}/suggestions?**`, (route) => {
      const url = new URL(route.request().url());
      requestUrls.push(url);
      if (url.searchParams.has("cursor")) {
        return fulfillJson(route, { ok: false, data: null, error: "refresh_required" });
      }
      firstPageCalls += 1;
      return fulfillJson(
        route,
        success(
          [
            draft(
              DRAFT_ID,
              firstPageCalls === 1
                ? "Protect one evening each week for recovery"
                : "Protect two quiet evenings this week",
            ),
          ],
          firstPageCalls === 1 ? "bmV4dA==" : null,
          firstPageCalls === 1 ? 6 : 1,
        ),
      );
    });

    await page.goto(`/guide/waypoint-suggestions/${RELATIONSHIP_ID}`);
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByRole("status")).toHaveText(
      "This list changed, so the first page was refreshed.",
    );
    await expect(page.getByText("Protect two quiet evenings this week")).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(requestUrls).toHaveLength(3);
    expect(requestUrls.map((url) => url.searchParams.get("pageSize"))).toEqual([
      "10",
      "10",
      "10",
    ]);
    expect(requestUrls[1]?.searchParams.get("cursor")).toBe("bmV4dA==");
    expect(requestUrls[2]?.searchParams.has("cursor")).toBe(false);
  });

  test("clears displayed suggestions when the current request is denied", async ({ page }) => {
    let requestCount = 0;
    await page.route(`**/guide/waypoint-suggestions/${RELATIONSHIP_ID}/suggestions?**`, (route) => {
      requestCount += 1;
      if (requestCount === 1) {
        return fulfillJson(
          route,
          success([
            draft(DRAFT_ID, "Protect one evening each week for recovery"),
          ], "bmV4dA==", 6),
        );
      }
      return fulfillJson(route, {
        ok: false,
        data: null,
        error: "SolMind Suggested Waypoints are unavailable.",
      });
    });

    await page.goto(`/guide/waypoint-suggestions/${RELATIONSHIP_ID}`);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "Suggested Waypoints unavailable" })).toBeVisible();
    await expect(page.getByText("Protect one evening each week for recovery")).toHaveCount(0);
    expect(requestCount).toBe(2);
  });

  test("does not loop on page-one refresh-required", async ({ page }) => {
    let requestCount = 0;
    await page.route(`**/guide/waypoint-suggestions/${RELATIONSHIP_ID}/suggestions?**`, (route) => {
      requestCount += 1;
      return fulfillJson(route, { ok: false, data: null, error: "refresh_required" });
    });

    await page.goto(`/guide/waypoint-suggestions/${RELATIONSHIP_ID}`);
    await expect(page.getByRole("heading", { name: "Could not load suggestions" })).toBeVisible();
    expect(requestCount).toBe(1);
  });

  test("renders empty, denied, and failed states without suggestion leakage", async ({ page }) => {
    let responseMode: "empty" | "denied" | "failed" = "empty";
    await page.route(`**/guide/waypoint-suggestions/${RELATIONSHIP_ID}/suggestions?**`, (route) => {
      if (responseMode === "empty") {
        return fulfillJson(route, success([], null, 0));
      }
      return fulfillJson(route, {
        ok: false,
        data: null,
        error: responseMode === "denied"
          ? "SolMind Suggested Waypoints are unavailable."
          : "SolMind Suggested Waypoints could not be loaded.",
      });
    });

    await page.goto(`/guide/waypoint-suggestions/${RELATIONSHIP_ID}`);
    await expect(page.getByRole("heading", { name: "No suggestions yet" })).toBeVisible();
    responseMode = "denied";
    await page.reload();
    await expect(page.getByRole("heading", { name: "Suggested Waypoints unavailable" })).toBeVisible();
    responseMode = "failed";
    await page.reload();
    await expect(page.getByRole("heading", { name: "Could not load suggestions" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(DRAFT_ID);
    await expectNoSeriousAxeViolations(page);
  });
});
