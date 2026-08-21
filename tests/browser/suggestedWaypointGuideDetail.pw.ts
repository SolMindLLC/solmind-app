import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

const RELATIONSHIP_ID = "55555555-5555-4555-8555-555555555555";
const SUGGESTION_ID = "66666666-6666-4666-8666-666666666666";
const VERSION_ID = "77777777-7777-4777-8777-777777777777";

const base = {
  suggested_waypoint_id: SUGGESTION_ID,
  authoring_mode: "draft",
  authoring_revision: 2,
  destination_preview: "Protect one evening each week for recovery",
  pending_deadline_at: null,
  pull_back_available: false,
  channel_category: "not_delivered",
  current_version_id: null,
  pending_version_id: null,
  delivered_at: null,
  acknowledged_version_id: null,
  acknowledged_at: null,
  draft_or_pending_destination: "Protect one evening each week for recovery",
  draft_or_pending_why: "A protected evening may make the week feel more sustainable.",
  draft_or_pending_arrival_signals: ["One evening stays unscheduled."],
  delivered_destination: null,
  delivered_why: null,
  delivered_arrival_signals: null,
  policy_key: null,
  policy_version: null,
  effective_seconds: null,
};

test.use({ timezoneId: "America/Chicago" });

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

const detailUrl = `/guide/waypoint-suggestions/${RELATIONSHIP_ID}/${SUGGESTION_ID}`;
const detailPattern = `**${detailUrl}/detail`;

test.describe("Guide Suggested Waypoint detail", () => {
  test("shows exact draft, pending, and delivered Guide projections without private engagement", async ({ page }) => {
    let state: "draft" | "pending" | "delivered" = "draft";
    await page.route(detailPattern, (route) => {
      const data = state === "draft"
        ? base
        : state === "pending"
          ? {
              ...base,
              authoring_mode: "pending",
              channel_category: "pending",
              pending_deadline_at: "2026-08-16T06:30:00.000Z",
              pull_back_available: true,
              pending_version_id: VERSION_ID,
              policy_key: "suggested_waypoint_send_grace_seconds",
              policy_version: 3,
              effective_seconds: 300,
            }
          : {
              ...base,
              authoring_mode: "delivered",
              channel_category: "open",
              current_version_id: VERSION_ID,
              delivered_at: "2026-08-16T06:30:00.000Z",
              acknowledged_version_id: VERSION_ID,
              acknowledged_at: "2026-08-16T06:35:00.000Z",
              draft_or_pending_destination: null,
              draft_or_pending_why: null,
              draft_or_pending_arrival_signals: null,
              delivered_destination: base.draft_or_pending_destination,
              delivered_why: base.draft_or_pending_why,
              delivered_arrival_signals: base.draft_or_pending_arrival_signals,
            };
      return fulfillJson(route, { ok: true, data, error: null });
    });

    await page.goto(detailUrl);
    await expect(page.getByRole("heading", { name: "Guide-only draft" })).toBeVisible();
    await expect(page.getByText("One evening stays unscheduled.")).toBeVisible();

    state = "pending";
    await page.reload();
    await expect(page.getByText("Pull Back available", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pending-send window" })).toBeVisible();
    await expect(page.getByText("Explorer visibility is scheduled after Aug 16, 2026, 1:30 AM CDT.", { exact: false })).toBeVisible();
    await expect(page.getByText("300 seconds", { exact: false })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(VERSION_ID);

    state = "delivered";
    await page.reload();
    await expect(page.getByRole("heading", { name: "Version sent to Explorer" })).toBeVisible();
    await expect(page.getByText("Receipt acknowledged Aug 16, 2026, 1:35 AM CDT", { exact: false })).toBeVisible();
    await expect(page.getByText("Sent Aug 16, 2026, 1:30 AM CDT", { exact: false })).toBeVisible();
    await expect(page.getByText("Explorer-private open and read activity is not shown here.", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(page.locator("body")).not.toContainText("Explorer opened");
    await expectNoSeriousAxeViolations(page);
  });

  test("renders denied and failed states without target leakage and retries safely", async ({ page }) => {
    let mode: "denied" | "failed" | "success" = "denied";
    await page.route(detailPattern, (route) => {
      if (mode === "success") {
        return fulfillJson(route, { ok: true, data: base, error: null });
      }
      return fulfillJson(route, {
        ok: false,
        data: null,
        error: mode === "denied"
          ? "SolMind Suggested Waypoints are unavailable."
          : "SolMind Suggested Waypoints could not be loaded.",
      });
    });

    await page.goto(detailUrl);
    await expect(page.getByRole("heading", { name: "Suggestion unavailable" })).toBeVisible();
    mode = "failed";
    await page.reload();
    await expect(page.getByRole("heading", { name: "Could not load suggestion" })).toBeVisible();
    mode = "success";
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { name: "Guide-only draft" })).toBeVisible();
    await expectNoSeriousAxeViolations(page);
  });
});
