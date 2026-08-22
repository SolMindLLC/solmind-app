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
    await expect(page.getByText("You acknowledged receipt Aug 16, 2026", { exact: false })).toBeVisible();
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
    await expect(page.getByText("Received Aug 16, 2026 as a suggestion, not an assignment.")).toBeVisible();
    await expect(page.getByText("One evening stays unscheduled.")).toBeVisible();
    await expect(page.getByText("Private Explorer view", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
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
    await expect(page.getByText("You acknowledged receipt Aug 16, 2026", { exact: false })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Pull Back");
    await expect(page.locator("body")).not.toContainText("Pending send");
    await expect(page.locator("body")).not.toContainText("Kairos");
    await expectNoSeriousAxeViolations(page);
  });

  test("does not write on open and marks the current version as read only after authoritative refresh", async ({ page }) => {
    let read = false;
    const posts: string[] = [];
    let detailReads = 0;
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/detail`, (route) => {
      detailReads += 1;
      return fulfillJson(route, {
        ok: true,
        data: detail({
          read,
          read_at: read ? "2026-08-16T06:03:00.000Z" : null,
        }),
        error: null,
      });
    });
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/commands`, (route) => {
      posts.push(route.request().postData() ?? "");
      read = true;
      return fulfillJson(route, {
        ok: true,
        outcome: "applied",
        suggestedWaypointId: UNREAD_ID,
        error: null,
      });
    });

    await page.goto(`/explorer/waypoints/${UNREAD_ID}`);
    await expect(page.getByRole("button", { name: "Mark as read" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Acknowledge receipt" })).toBeVisible();
    expect(posts).toEqual([]);
    expect(detailReads).toBe(1);

    await page.getByRole("button", { name: "Mark as read" }).click();
    await expect(page.getByText("✓ Read", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Marked as read" })).toBeDisabled();
    await expect(page.getByText("Marked as read privately.", { exact: false })).toBeVisible();
    expect(detailReads).toBe(2);
    expect(posts).toHaveLength(1);
    const body = JSON.parse(posts[0] ?? "{}") as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["kind", "operationId", "versionId"]);
    expect(body).toMatchObject({
      kind: "explorer.mark_read",
      versionId: VERSION_ID,
    });
    expect(body.operationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  test("acknowledges receipt deliberately without changing the private read state", async ({ page }) => {
    let acknowledged = false;
    const posts: string[] = [];
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/detail`, (route) =>
      fulfillJson(route, {
        ok: true,
        data: detail({
          receipt_acknowledged: acknowledged,
          acknowledged_at: acknowledged ? "2026-08-16T06:04:00.000Z" : null,
        }),
        error: null,
      }),
    );
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/commands`, (route) => {
      posts.push(route.request().postData() ?? "");
      acknowledged = true;
      return fulfillJson(route, {
        ok: true,
        outcome: "applied",
        suggestedWaypointId: UNREAD_ID,
        error: null,
      });
    });

    await page.goto(`/explorer/waypoints/${UNREAD_ID}`);
    await page.getByRole("button", { name: "Acknowledge receipt" }).click();
    await expect(page.getByText("You acknowledged receipt Aug 16, 2026", { exact: false })).toBeVisible();
    await expect(page.getByText("● Unread", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Receipt acknowledged" })).toBeDisabled();
    expect(posts).toHaveLength(1);
    const body = JSON.parse(posts[0] ?? "{}") as Record<string, unknown>;
    expect(Object.keys(body)).toEqual([
      "kind",
      "operationId",
      "expectedCurrentVersionId",
    ]);
    expect(body).toMatchObject({
      kind: "explorer.acknowledge",
      expectedCurrentVersionId: VERSION_ID,
    });
  });

  test("suppresses a second action while one Explorer command is in flight", async ({ page }) => {
    let releaseCommand!: () => void;
    const commandGate = new Promise<void>((resolve) => {
      releaseCommand = resolve;
    });
    let releaseRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    let postCount = 0;
    let read = false;
    let detailReads = 0;
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/detail`, async (route) => {
      detailReads += 1;
      if (detailReads > 1) {
        await refreshGate;
      }
      return fulfillJson(route, {
        ok: true,
        data: detail({
          read,
          read_at: read ? "2026-08-16T06:04:00.000Z" : null,
        }),
        error: null,
      });
    });
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/commands`, async (route) => {
      postCount += 1;
      await commandGate;
      read = true;
      return fulfillJson(route, {
        ok: true,
        outcome: "applied",
        suggestedWaypointId: UNREAD_ID,
        error: null,
      });
    });

    await page.goto(`/explorer/waypoints/${UNREAD_ID}`);
    const markRead = page.getByRole("button", { name: /Mark(?:ing)? as read/ });
    await markRead.click();
    await expect(markRead).toBeDisabled();
    await expect(page.getByRole("button", { name: "Acknowledge receipt" })).toBeDisabled();
    await markRead.dispatchEvent("click");
    expect(postCount).toBe(1);

    releaseCommand();
    await expect(markRead).toBeDisabled();
    await expect(page.getByRole("button", { name: "Acknowledge receipt" })).toBeDisabled();
    await markRead.dispatchEvent("click");
    expect(postCount).toBe(1);

    read = true;
    releaseRefresh();
    await expect(page.getByText("✓ Read", { exact: true })).toBeVisible();
    expect(postCount).toBe(1);
  });

  test("abandons a late Explorer command completion after leaving the detail", async ({ page }) => {
    let releaseCommand!: () => void;
    const commandGate = new Promise<void>((resolve) => {
      releaseCommand = resolve;
    });
    let postCount = 0;
    await page.route("**/explorer/waypoints/suggestions?**", (route) =>
      fulfillJson(route, success([item()], null, 1)),
    );
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/detail`, (route) =>
      fulfillJson(route, { ok: true, data: detail(), error: null }),
    );
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/commands`, async (route) => {
      postCount += 1;
      await commandGate;
      try {
        return await fulfillJson(route, {
          ok: true,
          outcome: "applied",
          suggestedWaypointId: UNREAD_ID,
          error: null,
        });
      } catch {
        return undefined;
      }
    });

    await page.goto(`/explorer/waypoints/${UNREAD_ID}`);
    await page.getByRole("button", { name: "Mark as read" }).click();
    await page.getByRole("link", { name: "Back to Waypoint Suggestions" }).click();
    await expect(page).toHaveURL(/\/explorer\/waypoints\?focus=/);
    await expect(page.getByRole("heading", { name: "Waypoint Suggestions" })).toBeVisible();

    releaseCommand();
    await page.waitForTimeout(50);
    await expect(page).toHaveURL(/\/explorer\/waypoints\?focus=/);
    await expect(page.getByText("Marked as read privately.", { exact: false })).toHaveCount(0);
    expect(postCount).toBe(1);
  });

  test("retains the safe detail and offers read retry only after conclusive success plus failed refresh", async ({ page }) => {
    let detailReads = 0;
    let postCount = 0;
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/detail`, (route) => {
      detailReads += 1;
      return detailReads === 1
        ? fulfillJson(route, { ok: true, data: detail(), error: null })
        : fulfillJson(route, {
            ok: false,
            data: null,
            error: "SolMind Waypoint Suggestions could not be loaded.",
          });
    });
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/commands`, (route) => {
      postCount += 1;
      return fulfillJson(route, {
        ok: true,
        outcome: "applied",
        suggestedWaypointId: UNREAD_ID,
        error: null,
      });
    });

    await page.goto(`/explorer/waypoints/${UNREAD_ID}`);
    await page.getByRole("button", { name: "Mark as read" }).click();
    await expect(page.getByRole("heading", { name: "Protect one evening each week for recovery" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh current status" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try action again" })).toHaveCount(0);
    await expect(page.getByText("do not submit the action again", { exact: false })).toBeVisible();
    expect(postCount).toBe(1);
  });

  test("settles transport uncertainty through the authoritative acknowledgement read without another post", async ({ page }) => {
    let acknowledged = false;
    let postCount = 0;
    let detailReads = 0;
    let releaseStatusCheck!: () => void;
    const statusCheckGate = new Promise<void>((resolve) => {
      releaseStatusCheck = resolve;
    });
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/detail`, async (route) => {
      detailReads += 1;
      if (detailReads > 1) {
        await statusCheckGate;
      }
      return fulfillJson(route, {
        ok: true,
        data: detail({
          receipt_acknowledged: acknowledged,
          acknowledged_at: acknowledged ? "2026-08-16T06:05:00.000Z" : null,
        }),
        error: null,
      });
    });
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/commands`, (route) => {
      postCount += 1;
      acknowledged = true;
      return route.fulfill({ status: 503, body: "unavailable" });
    });

    await page.goto(`/explorer/waypoints/${UNREAD_ID}`);
    await page.getByRole("button", { name: "Acknowledge receipt" }).click();
    await expect(page.getByRole("heading", { name: "Action status needs checking" })).toBeVisible();
    await expectNoSeriousAxeViolations(page);
    const checkStatus = page.getByRole("button", { name: "Check current status" });
    const retry = page.getByRole("button", { name: "Try action again" });
    await checkStatus.click();
    await expect(checkStatus).toBeDisabled();
    await expect(retry).toBeDisabled();
    await retry.dispatchEvent("click");
    expect(postCount).toBe(1);
    releaseStatusCheck();
    await expect(page.getByText("Receipt acknowledged.", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Receipt acknowledged" })).toBeDisabled();
    expect(postCount).toBe(1);
  });

  test("keeps focus in recovery when a status check does not confirm the change", async ({ page }) => {
    let postCount = 0;
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/detail`, (route) =>
      fulfillJson(route, { ok: true, data: detail(), error: null }),
    );
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/commands`, (route) => {
      postCount += 1;
      return route.fulfill({ status: 503, body: "unavailable" });
    });

    await page.goto(`/explorer/waypoints/${UNREAD_ID}`);
    await page.getByRole("button", { name: "Mark as read" }).click();
    await page.getByRole("button", { name: "Check current status" }).click();

    const status = page.getByText(
      "The change is not confirmed yet. You can safely try the action again.",
      { exact: true },
    );
    await expect(status).toBeFocused();
    await expect(page.getByRole("button", { name: "Try action again" })).toBeEnabled();
    expect(postCount).toBe(1);
  });

  test("keeps focus in recovery when current status cannot be loaded", async ({ page }) => {
    let detailReads = 0;
    let postCount = 0;
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/detail`, (route) => {
      detailReads += 1;
      return detailReads === 1
        ? fulfillJson(route, { ok: true, data: detail(), error: null })
        : fulfillJson(route, {
            ok: false,
            data: null,
            error: "SolMind Waypoint Suggestions could not be loaded.",
          });
    });
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/commands`, (route) => {
      postCount += 1;
      return route.fulfill({ status: 503, body: "unavailable" });
    });

    await page.goto(`/explorer/waypoints/${UNREAD_ID}`);
    await page.getByRole("button", { name: "Acknowledge receipt" }).click();
    await page.getByRole("button", { name: "Check current status" }).click();

    const status = page.getByText(
      "Current status could not be confirmed. You can safely try the action again.",
      { exact: true },
    );
    await expect(status).toBeFocused();
    await expect(page.getByRole("button", { name: "Try action again" })).toBeEnabled();
    expect(postCount).toBe(1);
  });

  test("retries one transport-uncertain request with byte-identical operation identity", async ({ page }) => {
    let read = false;
    const posts: string[] = [];
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/detail`, (route) =>
      fulfillJson(route, {
        ok: true,
        data: detail({
          read,
          read_at: read ? "2026-08-16T06:06:00.000Z" : null,
        }),
        error: null,
      }),
    );
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/commands`, (route) => {
      posts.push(route.request().postData() ?? "");
      if (posts.length === 1) {
        return route.fulfill({ status: 503, body: "unavailable" });
      }
      read = true;
      return fulfillJson(route, {
        ok: true,
        outcome: "idempotent",
        suggestedWaypointId: UNREAD_ID,
        error: null,
      });
    });

    await page.goto(`/explorer/waypoints/${UNREAD_ID}`);
    await page.getByRole("button", { name: "Mark as read" }).click();
    await page.getByRole("button", { name: "Try action again" }).click();
    await expect(page.getByText("✓ Read", { exact: true })).toBeVisible();
    expect(posts).toHaveLength(2);
    expect(posts[1]).toBe(posts[0]);
  });

  test("requires review of a changed delivered version after a stale acknowledgement", async ({ page }) => {
    let currentVersionId = VERSION_ID;
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/detail`, (route) =>
      fulfillJson(route, {
        ok: true,
        data: detail({ current_version_id: currentVersionId }),
        error: null,
      }),
    );
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/commands`, (route) => {
      currentVersionId = OTHER_VERSION_ID;
      return fulfillJson(route, {
        ok: false,
        outcome: "stale",
        suggestedWaypointId: null,
        error: null,
      });
    });

    await page.goto(`/explorer/waypoints/${UNREAD_ID}`);
    await page.getByRole("button", { name: "Acknowledge receipt" }).click();
    await expect(page.getByText("updated. Review the current version", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Acknowledge receipt" })).toBeEnabled();
    await expect(page.getByText("Receipt acknowledged.", { exact: false })).toHaveCount(0);
  });

  test("requires a read-only refresh when a stale version has not appeared yet", async ({ page }) => {
    let postCount = 0;
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/detail`, (route) =>
      fulfillJson(route, { ok: true, data: detail(), error: null }),
    );
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/commands`, (route) => {
      postCount += 1;
      return fulfillJson(route, {
        ok: false,
        outcome: "stale",
        suggestedWaypointId: null,
        error: null,
      });
    });

    await page.goto(`/explorer/waypoints/${UNREAD_ID}`);
    await page.getByRole("button", { name: "Acknowledge receipt" }).click();
    await expect(page.getByText("current version has not appeared yet", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh current status" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Acknowledge receipt" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Try action again" })).toHaveCount(0);
    expect(postCount).toBe(1);
  });

  test("maps a valid wrong-target success to value-free failure without state mutation", async ({ page }) => {
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/detail`, (route) =>
      fulfillJson(route, { ok: true, data: detail(), error: null }),
    );
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/commands`, (route) =>
      fulfillJson(route, {
        ok: true,
        outcome: "applied",
        suggestedWaypointId: READ_ID,
        error: null,
      }),
    );

    await page.goto(`/explorer/waypoints/${UNREAD_ID}`);
    await page.getByRole("button", { name: "Mark as read" }).click();
    await expect(page.getByText("could not be completed. Nothing was changed.", { exact: false })).toBeVisible();
    await expect(page.getByText("● Unread", { exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(READ_ID);
  });

  test("uses the authoritative applied state after a malformed command response", async ({ page }) => {
    let read = false;
    let postCount = 0;
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/detail`, (route) =>
      fulfillJson(route, {
        ok: true,
        data: detail({
          read,
          read_at: read ? "2026-08-16T06:07:00.000Z" : null,
        }),
        error: null,
      }),
    );
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/commands`, (route) => {
      postCount += 1;
      read = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{",
      });
    });

    await page.goto(`/explorer/waypoints/${UNREAD_ID}`);
    await page.getByRole("button", { name: "Mark as read" }).click();

    await expect(page.getByText("✓ Read", { exact: true })).toBeVisible();
    await expect(page.getByText("Marked as read privately.", { exact: false })).toBeVisible();
    await expect(page.getByText("Nothing was changed.", { exact: false })).toHaveCount(0);
    expect(postCount).toBe(1);
  });

  test("keeps operation-conflict recovery value-free and re-enables deliberate actions", async ({ page }) => {
    let postCount = 0;
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/detail`, (route) =>
      fulfillJson(route, { ok: true, data: detail(), error: null }),
    );
    await page.route(`**/explorer/waypoints/${UNREAD_ID}/commands`, (route) => {
      postCount += 1;
      return fulfillJson(route, {
        ok: false,
        outcome: "operation_conflict",
        suggestedWaypointId: null,
        error: null,
      });
    });

    await page.goto(`/explorer/waypoints/${UNREAD_ID}`);
    await page.getByRole("button", { name: "Mark as read" }).click();

    await expect(page.getByText("A different request already used this operation.", { exact: false })).toBeFocused();
    await expect(page.getByRole("button", { name: "Mark as read" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Acknowledge receipt" })).toBeEnabled();
    expect(postCount).toBe(1);
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

  test("keeps a legitimate empty inbox distinct from relationship denial without leakage", async ({ page }) => {
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
    await expect(page.locator("body")).not.toContainText("relationship");
    await expect(page.locator("body")).not.toContainText("Guide count");
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
