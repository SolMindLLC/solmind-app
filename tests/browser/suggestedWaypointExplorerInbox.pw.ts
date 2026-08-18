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

const detail = (overrides: Record<string, unknown> = {}) => ({
  suggested_waypoint_id: UNREAD_ID,
  current_version_id: VERSION_ID,
  destination: "Protect one evening each week for recovery",
  why: "A protected evening may make the week feel more sustainable.",
  arrival_signals: ["One evening stays unscheduled."],
  received_at: "2026-08-16T06:00:00.000Z",
  read: false,
  read_at: null,
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
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/detail`, (route) =>
      fulfillJson(route, { ok: true, data: detail(), error: null }),
    );

    await page.goto("/explorer/waypoints");
    await expect(page.getByText("Unread", { exact: false })).toBeVisible();
    await expect(page.getByText("You acknowledged receipt Aug 16", { exact: false })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Pull Back");
    await expect(page.locator("body")).not.toContainText("Pending send");

    const row = page.getByRole("link", { name: /Protect one evening each week for recovery/ });
    await row.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/explorer/waypoints/${UNREAD_ID}$`));
    await expect(
      page.getByRole("heading", {
        name: "Protect one evening each week for recovery",
      }),
    ).toBeVisible();
    await expect(page.getByText("Received Aug 16 as a suggestion, not an assignment.")).toBeVisible();
    await expect(page.getByText("One evening stays unscheduled.")).toBeVisible();
    await expect(page.getByText("Private Explorer view", { exact: false })).toBeVisible();
    await page.getByRole("link", { name: "Back to Waypoint Suggestions" }).click();
    await expect(page).toHaveURL(new RegExp(`/explorer/waypoints\\?focus=${UNREAD_ID}$`));
    await expect(row).toBeFocused();
    await expectNoSeriousAxeViolations(page);
  });

  test("shows exact read and acknowledgement states without Guide-only leakage", async ({ page }) => {
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/detail`, (route) =>
      fulfillJson(route, {
        ok: true,
        data: detail({
          read: true,
          read_at: "2026-08-16T06:01:00.000Z",
          receipt_acknowledged: true,
          acknowledged_at: "2026-08-16T06:02:00.000Z",
        }),
        error: null,
      }),
    );

    await page.goto(`/explorer/waypoints/${UNREAD_ID}`);
    await expect(page.getByText("✓ Read", { exact: true })).toBeVisible();
    await expect(page.getByText("You acknowledged receipt Aug 16", { exact: false })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Pull Back");
    await expect(page.locator("body")).not.toContainText("Pending send");
    await expect(page.locator("body")).not.toContainText("Kairos");
    await expectNoSeriousAxeViolations(page);
  });

  test("renders denied and failed detail states without suggestion leakage and retries safely", async ({ page }) => {
    let mode: "denied" | "failed" | "success" = "denied";
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/detail`, (route) => {
      if (mode === "success") {
        return fulfillJson(route, { ok: true, data: detail(), error: null });
      }
      return fulfillJson(route, {
        ok: false,
        data: null,
        error:
          mode === "denied"
            ? "SolMind Waypoint Suggestions are unavailable."
            : "SolMind Waypoint Suggestions could not be loaded.",
      });
    });

    await page.goto(`/explorer/waypoints/${UNREAD_ID}`);
    await expect(page.getByRole("heading", { name: "Suggestion unavailable" })).toBeVisible();
    mode = "failed";
    await page.reload();
    await expect(page.getByRole("heading", { name: "Could not load suggestion" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("A protected evening may make the week feel more sustainable.");
    mode = "success";
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { name: "Protect one evening each week for recovery" })).toBeVisible();
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

  test("recovers a stale later-page cursor once and clears pagination history", async ({ page }) => {
    const requestUrls: URL[] = [];
    let firstPageCalls = 0;
    await page.route("**/explorer/waypoints/suggestions?**", (route) => {
      const url = new URL(route.request().url());
      requestUrls.push(url);
      if (url.searchParams.has("cursor")) {
        return fulfillJson(route, {
          ok: false,
          data: null,
          error: "refresh_required",
        });
      }
      firstPageCalls += 1;
      return fulfillJson(
        route,
        success(
          [
            item({
              destination_preview:
                firstPageCalls === 1
                  ? "Protect one evening each week for recovery"
                  : "Protect two quiet evenings this week",
            }),
          ],
          firstPageCalls === 1 ? "bmV4dA==" : null,
          firstPageCalls === 1 ? 6 : 1,
        ),
      );
    });

    await page.goto("/explorer/waypoints");
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

  test("keeps the superseding page-size result when an older request resolves late", async ({ page }) => {
    let releaseOlderRequest: (() => void) | undefined;
    let markOlderRequestStarted: (() => void) | undefined;
    const olderRequestStarted = new Promise<void>((resolve) => {
      markOlderRequestStarted = resolve;
    });

    await page.route("**/explorer/waypoints/suggestions?**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.has("cursor")) {
        markOlderRequestStarted?.();
        await new Promise<void>((resolve) => {
          releaseOlderRequest = resolve;
        });
        try {
          await fulfillJson(
            route,
            success([
              item({ destination_preview: "An obsolete late suggestion page" }),
            ], null, 1),
          );
        } catch {
          // The superseding load aborts this request before its stale result can write.
        }
        return;
      }

      if (url.searchParams.get("pageSize") === "5") {
        return fulfillJson(
          route,
          success([
            item({ destination_preview: "The current five-item page" }),
          ], null, 1),
        );
      }

      return fulfillJson(route, success([item()], "bmV4dA==", 6));
    });

    await page.goto("/explorer/waypoints");
    await page.getByRole("button", { name: "Next" }).click();
    await olderRequestStarted;

    await page.locator("select").evaluate((element) => {
      const select = element as HTMLSelectElement;
      select.disabled = false;
      select.value = "5";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await expect(page.getByText("The current five-item page")).toBeVisible();
    releaseOlderRequest?.();
    await page.waitForTimeout(50);
    await expect(page.getByText("The current five-item page")).toBeVisible();
    await expect(page.getByText("An obsolete late suggestion page")).toHaveCount(0);
  });

  test("retains the safe page when a later-page request times out", async ({ page }) => {
    await page.route("**/explorer/waypoints/suggestions?**", async (route) => {
      const url = new URL(route.request().url());
      if (!url.searchParams.has("cursor")) {
        return fulfillJson(route, success([item()], "bmV4dA==", 6));
      }

      await page.evaluate(
        () => new Promise<void>((resolve) => window.setTimeout(resolve, 20_000)),
      );
      try {
        await fulfillJson(route, success([], null, 0));
      } catch {
        // The component aborts the timed-out fetch before this delayed route resolves.
      }
    });

    await page.goto("/explorer/waypoints");
    await page.clock.install();
    const laterRequest = page.waitForRequest((request) =>
      new URL(request.url()).searchParams.has("cursor"),
    );
    await page.getByRole("button", { name: "Next" }).click();
    await laterRequest;
    await page.clock.fastForward(15_000);

    await expect(page.getByRole("status")).toHaveText(
      "The requested page could not be loaded. The current page remains available.",
    );
    await expect(page.getByText("Protect one evening each week for recovery")).toBeVisible();
    await page.clock.fastForward(5_000);
  });

  test("supports forward and back navigation after a stale-cursor reset", async ({ page }) => {
    let firstPageCalls = 0;
    let requestCount = 0;
    await page.route("**/explorer/waypoints/suggestions?**", (route) => {
      requestCount += 1;
      const url = new URL(route.request().url());
      const cursor = url.searchParams.get("cursor");
      if (cursor === "bmV4dA==") {
        return fulfillJson(route, { ok: false, data: null, error: "refresh_required" });
      }
      if (cursor === "cmVzZXQ=") {
        return fulfillJson(
          route,
          success([
            item({ destination_preview: "A valid page after the reset" }),
          ], null, 6),
        );
      }

      firstPageCalls += 1;
      return fulfillJson(
        route,
        success(
          [
            item({
              destination_preview:
                firstPageCalls === 1
                  ? "Protect one evening each week for recovery"
                  : "The refreshed first page",
            }),
          ],
          firstPageCalls === 1 ? "bmV4dA==" : "cmVzZXQ=",
          6,
        ),
      );
    });

    await page.goto("/explorer/waypoints");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("The refreshed first page")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("A valid page after the reset")).toBeVisible();
    await page.getByRole("button", { name: "Previous" }).click();
    await expect(page.getByText("The refreshed first page")).toBeVisible();
    expect(requestCount).toBe(5);
  });

  test("clears a displayed page when the current request is denied", async ({ page }) => {
    let requestCount = 0;
    await page.route("**/explorer/waypoints/suggestions?**", (route) => {
      requestCount += 1;
      if (requestCount === 1) {
        return fulfillJson(route, success([item()], "bmV4dA==", 6));
      }
      return fulfillJson(route, {
        ok: false,
        data: null,
        error: "SolMind Waypoint Suggestions are unavailable.",
      });
    });

    await page.goto("/explorer/waypoints");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "Waypoint Suggestions unavailable" })).toBeVisible();
    await expect(page.getByText("Protect one evening each week for recovery")).toHaveCount(0);
    expect(requestCount).toBe(2);
  });

  test("clears a displayed page when the stale-cursor reset is denied", async ({ page }) => {
    let requestCount = 0;
    await page.route("**/explorer/waypoints/suggestions?**", (route) => {
      requestCount += 1;
      if (requestCount === 1) {
        return fulfillJson(route, success([item()], "bmV4dA==", 6));
      }
      if (requestCount === 2) {
        return fulfillJson(route, { ok: false, data: null, error: "refresh_required" });
      }
      return fulfillJson(route, {
        ok: false,
        data: null,
        error: "SolMind Waypoint Suggestions are unavailable.",
      });
    });

    await page.goto("/explorer/waypoints");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "Waypoint Suggestions unavailable" })).toBeVisible();
    await expect(page.getByText("Protect one evening each week for recovery")).toHaveCount(0);
    expect(requestCount).toBe(3);
  });

  test("does not loop on page-one refresh-required", async ({ page }) => {
    let requestCount = 0;
    await page.route("**/explorer/waypoints/suggestions?**", (route) => {
      requestCount += 1;
      return fulfillJson(route, {
        ok: false,
        data: null,
        error: "refresh_required",
      });
    });

    await page.goto("/explorer/waypoints");
    await expect(
      page.getByRole("heading", { name: "Could not load Waypoint Suggestions" }),
    ).toBeVisible();
    expect(requestCount).toBe(1);
  });

  test("keeps the last safe page when stale-cursor reset fails", async ({ page }) => {
    let requestCount = 0;
    await page.route("**/explorer/waypoints/suggestions?**", (route) => {
      requestCount += 1;
      const url = new URL(route.request().url());
      if (requestCount === 1) {
        return fulfillJson(route, success([item()], "bmV4dA==", 6));
      }
      if (url.searchParams.has("cursor")) {
        return fulfillJson(route, {
          ok: false,
          data: null,
          error: "refresh_required",
        });
      }
      return fulfillJson(route, {
        ok: false,
        data: null,
        error: "SolMind Waypoint Suggestions could not be loaded.",
      });
    });

    await page.goto("/explorer/waypoints");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "The requested page could not be loaded. The current page remains available.",
    );
    await expect(page.getByText("Protect one evening each week for recovery")).toBeVisible();
    expect(requestCount).toBe(3);
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
