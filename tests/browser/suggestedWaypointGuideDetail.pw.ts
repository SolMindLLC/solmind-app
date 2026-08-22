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
const commandPattern = `**/guide/waypoint-suggestions/${RELATIONSHIP_ID}/commands`;

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
    await expect(page.getByText("Blank-draft compose, delete, correction, and withdrawal remain separately gated.")).toBeVisible();

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

  test("edits and saves a complete Guide-only draft through an authoritative refresh", async ({ page }) => {
    let data = { ...base };
    const bodies: unknown[] = [];
    await page.route(detailPattern, (route) => fulfillJson(route, { ok: true, data, error: null }));
    await page.route(commandPattern, async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      bodies.push(body);
      data = {
        ...data,
        authoring_revision: data.authoring_revision + 1,
        destination_preview: body.destination,
        draft_or_pending_destination: body.destination,
        draft_or_pending_why: body.why,
        draft_or_pending_arrival_signals: body.arrivalSignals,
      };
      return fulfillJson(route, { ok: true, outcome: "applied", suggestedWaypointId: SUGGESTION_ID, error: null });
    });

    await page.goto(detailUrl);
    await page.getByRole("button", { name: "Edit draft" }).click();
    await page.getByLabel("Possible Waypoint destination").fill("Protect two quiet evenings each week");
    await page.getByLabel("Why this may help").fill("Two protected evenings may make recovery more dependable.\nReview after two weeks.");
    await page.getByLabel("Arrival signal 1").fill("Two evenings stay unscheduled.");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByRole("heading", { name: "Guide-only draft" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Protect two quiet evenings each week" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "saved and confirmed" })).toBeFocused();
    expect(bodies).toEqual([{
      kind: "guide.save_draft",
      operationId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      suggestedWaypointId: SUGGESTION_ID,
      expectedRevision: 2,
      destination: "Protect two quiet evenings each week",
      why: "Two protected evenings may make recovery more dependable.\nReview after two weeks.",
      arrivalSignals: ["Two evenings stay unscheduled."],
    }]);
    await expectNoSeriousAxeViolations(page);
  });

  test("blocks invalid draft content locally and sends nothing", async ({ page }) => {
    let commandCount = 0;
    await page.route(detailPattern, (route) => fulfillJson(route, { ok: true, data: base, error: null }));
    await page.route(commandPattern, (route) => {
      commandCount += 1;
      return fulfillJson(route, { ok: true, outcome: "applied", suggestedWaypointId: SUGGESTION_ID, error: null });
    });
    await page.goto(detailUrl);
    await page.getByRole("button", { name: "Edit draft" }).click();
    await page.getByLabel("Possible Waypoint destination").fill("");
    await expect(page.getByText("Use one normalized line between 1 and 160 characters.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save and close" })).toBeDisabled();
    await page.getByRole("button", { name: "Cancel editing" }).click();
    await expect(page.getByRole("button", { name: "Review before sending" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Protect one evening each week for recovery" })).toBeVisible();
    expect(commandCount).toBe(0);
  });

  test("saves and closes only after the authoritative draft confirms the exact content", async ({ page }) => {
    let data = { ...base };
    const bodies: unknown[] = [];
    await page.route(detailPattern, (route) => fulfillJson(route, { ok: true, data, error: null }));
    await page.route(commandPattern, async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      bodies.push(body);
      data = {
        ...data,
        authoring_revision: 3,
        destination_preview: body.destination,
        draft_or_pending_destination: body.destination,
      };
      return fulfillJson(route, { ok: true, outcome: "applied", suggestedWaypointId: SUGGESTION_ID, error: null });
    });

    await page.goto(detailUrl);
    await page.getByRole("button", { name: "Edit draft" }).click();
    await page.getByLabel("Possible Waypoint destination").fill("Protect Saturday evening for recovery");
    await page.getByRole("button", { name: "Save and close" }).click();
    await page.waitForURL(new RegExp(`/guide/waypoint-suggestions/${RELATIONSHIP_ID}(?:\\?.*)?$`, "u"));
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      kind: "guide.save_draft",
      expectedRevision: 2,
      destination: "Protect Saturday evening for recovery",
    });
  });

  test("reviews then schedules the clean authoritative draft without client policy authority", async ({ page }) => {
    let data: typeof base | Record<string, unknown> = { ...base };
    const bodies: unknown[] = [];
    await page.route(detailPattern, (route) => fulfillJson(route, { ok: true, data, error: null }));
    await page.route(commandPattern, async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      bodies.push(body);
      data = {
        ...base,
        authoring_mode: "pending",
        authoring_revision: 3,
        channel_category: "pending",
        pending_deadline_at: "2099-08-21T17:05:00.000Z",
        pull_back_available: true,
        pending_version_id: VERSION_ID,
        policy_key: "suggested_waypoint_send_grace_seconds",
        policy_version: 3,
        effective_seconds: 300,
      };
      return fulfillJson(route, { ok: true, outcome: "applied", suggestedWaypointId: SUGGESTION_ID, error: null });
    });

    await page.goto(detailUrl);
    await page.getByRole("button", { name: "Review before sending" }).click();
    await expect(page.getByRole("heading", { name: "Review before sending" })).toBeVisible();
    await expect(page.getByText("The Explorer will not see the suggestion immediately.")).toBeVisible();
    await page.getByRole("button", { name: "Schedule send" }).click();
    await expect(page.getByRole("heading", { name: "Pending-send window" })).toBeVisible();
    expect(bodies).toEqual([{
      kind: "guide.schedule_send",
      operationId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      suggestedWaypointId: SUGGESTION_ID,
      expectedRevision: 2,
    }]);
    expect(JSON.stringify(bodies)).not.toContain("policy");
    expect(JSON.stringify(bodies)).not.toContain(VERSION_ID);
  });

  test("checks an uncertain save and retries identical retained bytes only after unchanged detail", async ({ page }) => {
    let data = { ...base };
    let commandCount = 0;
    const bodies: string[] = [];
    await page.route(detailPattern, (route) => fulfillJson(route, { ok: true, data, error: null }));
    await page.route(commandPattern, async (route) => {
      commandCount += 1;
      bodies.push(route.request().postData() ?? "");
      if (commandCount === 1) return route.fulfill({ status: 503, body: "" });
      const body = JSON.parse(bodies[1] ?? "{}");
      data = {
        ...data,
        authoring_revision: 3,
        destination_preview: body.destination,
        draft_or_pending_destination: body.destination,
      };
      return fulfillJson(route, { ok: true, outcome: "idempotent", suggestedWaypointId: SUGGESTION_ID, error: null });
    });

    await page.goto(detailUrl);
    await page.getByRole("button", { name: "Edit draft" }).click();
    await page.getByLabel("Possible Waypoint destination").fill("Protect Friday evening for recovery");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { name: "Save status needs confirmation" })).toBeVisible();
    await page.getByRole("button", { name: "Check current status" }).click();
    await expect(page.getByRole("status").filter({ hasText: "may retry the exact same Save request" })).toBeVisible();
    await page.getByRole("button", { name: "Retry same request" }).click();
    await expect(page.getByRole("heading", { name: "Protect Friday evening for recovery" })).toBeVisible();
    expect(commandCount).toBe(2);
    expect(bodies[1]).toBe(bodies[0]);
  });

  test("pulls a pending version back and refreshes the authoritative Guide-only draft", async ({ page }) => {
    let state: "pending" | "draft" = "pending";
    const requestBodies: string[] = [];
    await page.route(detailPattern, (route) => fulfillJson(route, {
      ok: true,
      data: state === "pending"
        ? {
            ...base,
            authoring_mode: "pending",
            authoring_revision: 3,
            channel_category: "pending",
            pending_deadline_at: "2099-08-21T17:05:00.000Z",
            pull_back_available: true,
            pending_version_id: VERSION_ID,
            policy_key: "suggested_waypoint_send_grace_seconds",
            policy_version: 3,
            effective_seconds: 300,
          }
        : { ...base, authoring_revision: 4 },
      error: null,
    }));
    await page.route(commandPattern, async (route) => {
      requestBodies.push(route.request().postData() ?? "");
      state = "draft";
      return fulfillJson(route, {
        ok: true,
        outcome: "applied",
        suggestedWaypointId: SUGGESTION_ID,
        error: null,
      });
    });

    await page.goto(detailUrl);
    await expect(page.getByRole("button", { name: "Pull Back", exact: true })).toBeVisible();
    await expect(page.getByRole("timer")).toContainText("Estimated Pull Back time remaining");
    await page.getByRole("button", { name: "Pull Back", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Guide-only draft" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Pull Back completed" })).toBeFocused();
    expect(requestBodies).toHaveLength(1);
    expect(JSON.parse(requestBodies[0] ?? "{}")).toEqual({
      kind: "guide.pull_back",
      operationId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      suggestedWaypointId: SUGGESTION_ID,
      expectedRevision: 3,
      expectedPendingVersionId: VERSION_ID,
    });
    await expect(page.locator("body")).not.toContainText(VERSION_ID);
    await expectNoSeriousAxeViolations(page);
  });

  test("keeps a conclusive success non-retriable when the authoritative refresh fails", async ({ page }) => {
    let detailMode: "pending" | "failed" = "pending";
    let commandCount = 0;
    await page.route(detailPattern, (route) => {
      if (detailMode === "failed") {
        return fulfillJson(route, {
          ok: false,
          data: null,
          error: "SolMind Suggested Waypoints could not be loaded.",
        });
      }
      return fulfillJson(route, {
        ok: true,
        data: {
          ...base,
          authoring_mode: "pending",
          authoring_revision: 3,
          channel_category: "pending",
          pending_deadline_at: "2099-08-21T17:05:00.000Z",
          pull_back_available: true,
          pending_version_id: VERSION_ID,
          policy_key: "suggested_waypoint_send_grace_seconds",
          policy_version: 3,
          effective_seconds: 300,
        },
        error: null,
      });
    });
    await page.route(commandPattern, (route) => {
      commandCount += 1;
      detailMode = "failed";
      return fulfillJson(route, {
        ok: true,
        outcome: "applied",
        suggestedWaypointId: SUGGESTION_ID,
        error: null,
      });
    });

    await page.goto(detailUrl);
    await page.getByRole("button", { name: "Pull Back", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Could not load suggestion" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "do not submit Pull Back again" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry same request" })).toHaveCount(0);
    expect(commandCount).toBe(1);
  });

  test("keeps expected non-success guidance focused after the authoritative refresh", async ({ page }) => {
    let pullBackAvailable = true;
    let commandCount = 0;
    await page.route(detailPattern, (route) => fulfillJson(route, {
      ok: true,
      data: {
        ...base,
        authoring_mode: "pending",
        authoring_revision: 3,
        channel_category: "pending",
        pending_deadline_at: "2099-08-21T17:05:00.000Z",
        pull_back_available: pullBackAvailable,
        pending_version_id: VERSION_ID,
        policy_key: "suggested_waypoint_send_grace_seconds",
        policy_version: 3,
        effective_seconds: 300,
      },
      error: null,
    }));
    await page.route(commandPattern, (route) => {
      commandCount += 1;
      pullBackAvailable = false;
      return fulfillJson(route, {
        ok: false,
        outcome: "too_late",
        suggestedWaypointId: null,
        error: null,
      });
    });

    await page.goto(detailUrl);
    await page.getByRole("button", { name: "Pull Back", exact: true }).click();

    const status = page.getByRole("status").filter({ hasText: "Pull Back period ended" });
    await expect(status).toContainText("before the command reached the server");
    await expect(status).toBeFocused();
    await expect(page.getByRole("button", { name: "Pull Back", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retry same request" })).toHaveCount(0);
    expect(commandCount).toBe(1);
  });

  test("checks status and retries identical bytes after a transport-uncertain Pull Back", async ({ page }) => {
    let state: "pending" | "draft" = "pending";
    let commandCount = 0;
    const requestBodies: string[] = [];
    await page.route(detailPattern, (route) => fulfillJson(route, {
      ok: true,
      data: state === "pending"
        ? {
            ...base,
            authoring_mode: "pending",
            authoring_revision: 3,
            channel_category: "pending",
            pending_deadline_at: "2099-08-21T17:05:00.000Z",
            pull_back_available: true,
            pending_version_id: VERSION_ID,
            policy_key: "suggested_waypoint_send_grace_seconds",
            policy_version: 3,
            effective_seconds: 300,
          }
        : { ...base, authoring_revision: 4 },
      error: null,
    }));
    await page.route(commandPattern, async (route) => {
      commandCount += 1;
      requestBodies.push(route.request().postData() ?? "");
      if (commandCount === 1) {
        return route.abort("failed");
      }
      state = "draft";
      return fulfillJson(route, {
        ok: true,
        outcome: "idempotent",
        suggestedWaypointId: SUGGESTION_ID,
        error: null,
      });
    });

    await page.goto(detailUrl);
    await page.getByRole("button", { name: "Pull Back", exact: true }).click();
    await expect(page.getByRole("button", { name: "Check current status" })).toBeVisible();
    await page.getByRole("button", { name: "Check current status" }).click();
    await expect(page.getByRole("status").filter({ hasText: "still pending" })).toBeVisible();
    await page.getByRole("button", { name: "Retry same request" }).click();

    await expect(page.getByRole("heading", { name: "Guide-only draft" })).toBeVisible();
    expect(requestBodies).toHaveLength(2);
    expect(requestBodies[1]).toBe(requestBodies[0]);
    await expect(page.locator("body")).not.toContainText(VERSION_ID);
  });

  test("keeps recovery after a failed status read and clears retry after denial", async ({ page }) => {
    let detailMode: "pending" | "failed" | "denied" = "pending";
    let commandCount = 0;
    await page.route(detailPattern, (route) => {
      if (detailMode !== "pending") {
        return fulfillJson(route, {
          ok: false,
          data: null,
          error: detailMode === "denied"
            ? "SolMind Suggested Waypoints are unavailable."
            : "SolMind Suggested Waypoints could not be loaded.",
        });
      }
      return fulfillJson(route, {
        ok: true,
        data: {
          ...base,
          authoring_mode: "pending",
          authoring_revision: 3,
          channel_category: "pending",
          pending_deadline_at: "2099-08-21T17:05:00.000Z",
          pull_back_available: true,
          pending_version_id: VERSION_ID,
          policy_key: "suggested_waypoint_send_grace_seconds",
          policy_version: 3,
          effective_seconds: 300,
        },
        error: null,
      });
    });
    await page.route(commandPattern, (route) => {
      commandCount += 1;
      return route.abort("failed");
    });

    await page.goto(detailUrl);
    await page.getByRole("button", { name: "Pull Back", exact: true }).click();
    await expect(page.getByRole("button", { name: "Check current status" })).toBeVisible();

    detailMode = "failed";
    await page.getByRole("button", { name: "Check current status" }).click();
    await expect(page.getByRole("heading", { name: "Could not load suggestion" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry same request" })).toBeVisible();

    detailMode = "denied";
    await page.getByRole("button", { name: "Check current status" }).click();
    await expect(page.getByRole("heading", { name: "Suggestion unavailable" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry same request" })).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Do not retry Pull Back" })).toBeVisible();
    expect(commandCount).toBe(1);
    await expect(page.locator("body")).not.toContainText(VERSION_ID);
    await expectNoSeriousAxeViolations(page);
  });

  test("does not let a late retry overwrite a newer authoritative denial", async ({ page }) => {
    let detailMode: "pending" | "delayed_denied" = "pending";
    let releaseDeniedDetail = () => {};
    let releaseRetry = () => {};
    const deniedDetailGate = new Promise<void>((resolve) => {
      releaseDeniedDetail = resolve;
    });
    const retryGate = new Promise<void>((resolve) => {
      releaseRetry = resolve;
    });
    let commandCount = 0;
    let detailCount = 0;

    await page.route(detailPattern, async (route) => {
      detailCount += 1;
      if (detailMode === "delayed_denied") {
        await deniedDetailGate;
        return fulfillJson(route, {
          ok: false,
          data: null,
          error: "SolMind Suggested Waypoints are unavailable.",
        });
      }
      return fulfillJson(route, {
        ok: true,
        data: {
          ...base,
          authoring_mode: "pending",
          authoring_revision: 3,
          channel_category: "pending",
          pending_deadline_at: "2099-08-21T17:05:00.000Z",
          pull_back_available: true,
          pending_version_id: VERSION_ID,
          policy_key: "suggested_waypoint_send_grace_seconds",
          policy_version: 3,
          effective_seconds: 300,
        },
        error: null,
      });
    });
    await page.route(commandPattern, async (route) => {
      commandCount += 1;
      if (commandCount === 1) {
        return route.abort("failed");
      }
      await retryGate;
      return fulfillJson(route, {
        ok: true,
        outcome: "idempotent",
        suggestedWaypointId: SUGGESTION_ID,
        error: null,
      });
    });

    await page.goto(detailUrl);
    await page.getByRole("button", { name: "Pull Back", exact: true }).click();
    await expect(page.getByRole("button", { name: "Check current status" })).toBeVisible();

    detailMode = "delayed_denied";
    await page.getByRole("button", { name: "Check current status" }).click();
    await page.getByRole("button", { name: "Retry same request" }).click();
    releaseDeniedDetail();
    await expect(page.getByRole("status").filter({ hasText: "Do not retry Pull Back" })).toBeVisible();

    releaseRetry();
    await expect(page.getByRole("status").filter({ hasText: "Do not retry Pull Back" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Pull Back completed" })).toHaveCount(0);
    await page.waitForTimeout(100);
    expect(commandCount).toBe(2);
    expect(detailCount).toBe(2);
  });
});
