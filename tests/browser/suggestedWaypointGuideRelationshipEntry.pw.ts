import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

const RELATIONSHIP_ID = "55555555-5555-4555-8555-555555555555";
const SECOND_RELATIONSHIP_ID = "66666666-6666-4666-8666-666666666666";

const success = (items: readonly Record<string, unknown>[], nextCursor: string | null, totalCount: number) => ({
  ok: true,
  data: { items, next_cursor: nextCursor, total_count: totalCount },
  error: null,
});

const item = (id: string, displayName: string) => ({
  guide_explorer_relationship_id: id,
  explorer_display_name: displayName,
  relationship_created_at: "2026-08-14T17:00:00.000Z",
});

const fulfillJson = (route: Route, body: unknown) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

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

test.describe("authenticated Guide Suggested Waypoint relationship entry", () => {
  test("opens a relationship by keyboard and restores row focus on return", async ({ page }) => {
    await page.route("**/guide/waypoint-suggestions/relationships?**", (route) =>
      fulfillJson(route, success([item(RELATIONSHIP_ID, "Avery"), item(SECOND_RELATIONSHIP_ID, "Jordan")], null, 2)),
    );
    await page.route(`**/guide/waypoint-suggestions/${RELATIONSHIP_ID}/suggestions?**`, (route) =>
      fulfillJson(route, success([], null, 0)),
    );

    await page.goto("/guide/waypoint-suggestions");
    await expect(page.getByRole("heading", { name: "Suggested Waypoints" })).toBeVisible();
    const avery = page.getByRole("link", { name: /Avery Suggested Waypoints Open/ });
    await avery.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/guide/waypoint-suggestions/${RELATIONSHIP_ID}$`));
    await expect(page.getByRole("heading", { name: "Suggested Waypoints", exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Back to Explorer relationships" }).click();
    await expect(page).toHaveURL(new RegExp(`/guide/waypoint-suggestions\\?focus=${RELATIONSHIP_ID}$`));
    await expect(avery).toBeFocused();
    await expectNoSeriousAxeViolations(page);
  });

  test("renders empty, denied, and failed states without relationship leakage", async ({ page }) => {
    let responseMode: "empty" | "denied" | "failed" = "empty";
    await page.route("**/guide/waypoint-suggestions/relationships?**", (route) => {
      if (responseMode === "empty") {
        return fulfillJson(route, success([], null, 0));
      }
      if (responseMode === "denied") {
        return fulfillJson(route, {
          ok: false,
          data: null,
          error: "SolMind Suggested Waypoint relationships are unavailable.",
        });
      }
      return fulfillJson(route, {
        ok: false,
        data: null,
        error: "SolMind Suggested Waypoint relationships could not be loaded.",
      });
    });

    await page.goto("/guide/waypoint-suggestions");
    await expect(page.getByRole("heading", { name: "No Explorers available" })).toBeVisible();

    responseMode = "denied";
    await page.reload();
    await expect(page.getByRole("heading", { name: "Suggested Waypoints unavailable" })).toBeVisible();

    responseMode = "failed";
    await page.reload();
    await expect(page.getByRole("heading", { name: "Could not load Explorers" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Avery");
    await expect(page.locator("body")).not.toContainText(RELATIONSHIP_ID);
    await expectNoSeriousAxeViolations(page);
  });

  test("retains the last safe page when a later page fails", async ({ page }) => {
    await page.route("**/guide/waypoint-suggestions/relationships?**", (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.has("cursor")) {
        return fulfillJson(route, {
          ok: false,
          data: null,
          error: "SolMind Suggested Waypoint relationships could not be loaded.",
        });
      }
      return fulfillJson(route, success([item(RELATIONSHIP_ID, "Avery")], "bmV4dA==", 6));
    });

    await page.goto("/guide/waypoint-suggestions");
    await expect(page.getByRole("link", { name: /Avery Suggested Waypoints Open/ })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "The requested page could not be loaded. The current page remains available.",
    );
    await expect(page.getByRole("link", { name: /Avery Suggested Waypoints Open/ })).toBeVisible();
  });

  test("recovers a stale later-page cursor once and clears pagination history", async ({ page }) => {
    const requestUrls: URL[] = [];
    let firstPageCalls = 0;
    await page.route("**/guide/waypoint-suggestions/relationships?**", (route) => {
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
            item(
              RELATIONSHIP_ID,
              firstPageCalls === 1 ? "Avery" : "Avery Chen",
            ),
          ],
          firstPageCalls === 1 ? "bmV4dA==" : null,
          firstPageCalls === 1 ? 6 : 1,
        ),
      );
    });

    await page.goto("/guide/waypoint-suggestions");
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByRole("status")).toHaveText(
      "This list changed, so the first page was refreshed.",
    );
    await expect(page.getByRole("link", { name: /Avery Chen Suggested Waypoints Open/ })).toBeVisible();
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

  test("clears displayed relationships when the current request is denied", async ({ page }) => {
    let requestCount = 0;
    await page.route("**/guide/waypoint-suggestions/relationships?**", (route) => {
      requestCount += 1;
      if (requestCount === 1) {
        return fulfillJson(
          route,
          success([item(RELATIONSHIP_ID, "Avery")], "bmV4dA==", 6),
        );
      }
      return fulfillJson(route, {
        ok: false,
        data: null,
        error: "SolMind Suggested Waypoint relationships are unavailable.",
      });
    });

    await page.goto("/guide/waypoint-suggestions");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "Suggested Waypoints unavailable" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Avery Suggested Waypoints Open/ })).toHaveCount(0);
    expect(requestCount).toBe(2);
  });

  // Since 2026-11-02 (Paul's decisions) the Guide Waypoint pages are in the Guide workspace frame with the
  // August Guide menu (no entry current), and "Back to Guide dashboard" goes to the signed-in Guide home
  // /guide/home instead of the /guide prototype.
  test("shows the Guide workspace frame and links back to the Guide Dashboard", async ({ page }) => {
    await page.route("**/guide/waypoint-suggestions/relationships?**", (route) =>
      fulfillJson(route, success([item(RELATIONSHIP_ID, "Avery")], null, 1)),
    );
    await page.goto("/guide/waypoint-suggestions");
    await expect(page.getByRole("link", { name: /Avery Suggested Waypoints Open/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Guide dashboard", exact: true })).toHaveAttribute("href", "/guide/home");
    await expect(page.locator("body")).not.toContainText("Steve");
    await expect(page.locator('[aria-current="page"]')).toHaveCount(0);

    const wide = (page.viewportSize()?.width ?? 0) >= 1024;
    const button = page.getByRole("button", { name: "Menu", exact: true });
    let menu = page.getByRole("navigation", { name: "Guide workspace", exact: true });
    if (wide) {
      await expect(button).toBeHidden();
      await expect(page.getByText("Waypoint Suggestions", { exact: true })).toBeVisible();
    } else {
      menu = page.getByRole("navigation", { name: "Guide workspace menu", exact: true });
      await expect(page.getByRole("navigation", { name: "Guide workspace", exact: true })).toBeHidden();
      await expect(menu).toBeHidden();
      await expect(button).toHaveAttribute("aria-expanded", "false");
      await button.click();
      await expect(button).toHaveAttribute("aria-expanded", "true");
    }
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/guide/home");
    // An entry that is not connected yet shows its sentence when activated, and hides it again.
    const explorers = menu.getByRole("button", { name: /^Explorers\s*Not connected yet$/ });
    const sentence = menu.getByText("Explorers will list the Explorers you guide", { exact: false });
    await expect(explorers).toHaveAttribute("aria-expanded", "false");
    await expect(sentence).toBeHidden();
    await explorers.click();
    await expect(explorers).toHaveAttribute("aria-expanded", "true");
    await expect(sentence).toBeVisible();
    await expectNoSeriousAxeViolations(page);
    await explorers.click();
    await expect(sentence).toBeHidden();
    await expect(menu.getByRole("button", { name: /^Chat with your Guide Assistant\s*Not connected yet$/ })).toBeVisible();

    if (!wide) {
      // Escape inside the open menu closes it and returns focus to the Menu button.
      await menu.getByRole("link", { name: "Dashboard" }).focus();
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      await expect(button).toBeFocused();
      await expect(button).toHaveAttribute("aria-expanded", "false");
    }
  });

  // "Back to Guide dashboard" is a full-document link into the server-guarded /guide/home: a client-side
  // move could restore the Dashboard from the router cache with no server check after a sign-out. A marker on
  // window survives a client-side move and is gone after a new document loads. Without a sign-in the server
  // guard decides what /guide/home shows, so only the new document is asserted, not the page.
  test("goes back to the Guide Dashboard by loading a new document", async ({ page }) => {
    await page.route("**/guide/waypoint-suggestions/relationships?**", (route) =>
      fulfillJson(route, success([item(RELATIONSHIP_ID, "Avery")], null, 1)),
    );
    await page.goto("/guide/waypoint-suggestions");
    await expect(page.getByRole("link", { name: /Avery Suggested Waypoints Open/ })).toBeVisible();
    await page.evaluate(() => {
      (window as Window & { solmindBackMarker?: boolean }).solmindBackMarker = true;
    });
    const back = page.getByRole("link", { name: "Back to Guide dashboard", exact: true });
    await Promise.all([page.waitForURL(/\/guide\/home$/, { waitUntil: "load" }), back.click()]);
    expect(await page.evaluate(() => (window as Window & { solmindBackMarker?: boolean }).solmindBackMarker)).toBeUndefined();
  });

  test("does not loop on page-one refresh-required", async ({ page }) => {
    let requestCount = 0;
    await page.route("**/guide/waypoint-suggestions/relationships?**", (route) => {
      requestCount += 1;
      return fulfillJson(route, { ok: false, data: null, error: "refresh_required" });
    });

    await page.goto("/guide/waypoint-suggestions");
    await expect(page.getByRole("heading", { name: "Could not load Explorers" })).toBeVisible();
    expect(requestCount).toBe(1);
  });
});
