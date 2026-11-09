import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

// The private Your Waypoints section of the Waypoints page with every private request answered by synthetic data
// (no sign-in, database or provider). The suggestions inbox below gets an empty page.

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ENDED = id(500);
const OPEN = id(501);
const VERSION = "explorer-your-waypoints.v1";
const waypoint = (n: number, conversationId: string, conversationEnded: boolean, extra: Record<string, unknown> = {}) => ({
  id: id(n), conversationId, conversationEnded, sourceMessageId: id(900), isCurrent: true,
  createdAt: "2026-11-05T16:00:00.000Z", title: `Walk the river trail ${n}`, destination: `Walk the river trail ${n}`,
  meaning: "Time outside helps me think.", arrivalSignal: "I walk it twice a week for a month.", status: "chosen", ...extra,
});
const list = (items: unknown[], more: Partial<{ hasMore: boolean; nextOffset: number | null }> = {}) => ({
  version: VERSION, kind: "list", ok: true, items, hasMore: false, nextOffset: null, error: null, ...more,
});
const fulfillJson = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

test.use({ timezoneId: "America/Chicago" });

async function open(page: Page, state: (url: URL) => unknown) {
  await page.route("**/explorer/waypoints/suggestions?**", route =>
    fulfillJson(route, { ok: true, data: { items: [], next_cursor: null, total_count: 0 }, error: null }));
  await page.route("**/explorer/waypoints/your-waypoints/state**", route => fulfillJson(route, state(new URL(route.request().url()))));
  await page.goto("/explorer/waypoints");
}
const section = (page: Page) => page.getByRole("region", { name: "Your Waypoints" });
const notice = (page: Page) => page.locator("[data-your-waypoints-notice]");
const row = (page: Page, n: number) => section(page).getByRole("button", { name: new RegExp(`Walk the river trail ${n}\\b`) });

const expectNoSeriousAxeViolations = async (page: Page) => {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations.filter(v => v.impact === "serious" || v.impact === "critical").map(({ id: rule, help }) => ({ rule, help }))).toEqual([]);
};

test.describe("Your Waypoints on the Waypoints page", () => {
  test("shows the page title, active Waypoints first and the closed group collapsed", async ({ page }) => {
    await open(page, () => list([
      waypoint(1, ENDED, true), waypoint(2, OPEN, false),
      waypoint(3, ENDED, true, { status: "reached", reachedEvidence: "I walked it every week.", reachedAt: "2026-11-05T18:00:00.000Z" }),
    ]));
    await expect(page.getByRole("heading", { level: 1, name: "Waypoints", exact: true })).toBeVisible();
    await expect(section(page).getByRole("heading", { level: 2, name: "Your Waypoints" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Waypoint Suggestions" })).toBeVisible();
    await expect(section(page).getByRole("heading", { name: "In progress (2)" })).toBeVisible();
    await expect(section(page).getByRole("list", { name: "Waypoints in progress" }).getByRole("listitem")).toHaveCount(2);
    const closed = section(page).getByRole("button", { name: "Reached and released (1)" });
    await expect(closed).toHaveAttribute("aria-expanded", "false");
    await expect(row(page, 3)).toHaveCount(0);
    await closed.click();
    await expect(row(page, 3)).toBeVisible();
    await expectNoSeriousAxeViolations(page);
  });

  test("opens one row at a time; a Waypoint from the open conversation points to the conversation", async ({ page }) => {
    await open(page, () => list([waypoint(1, ENDED, true), waypoint(2, OPEN, false)]));
    await row(page, 2).click();
    await expect(row(page, 2)).toHaveAttribute("aria-expanded", "true");
    await expect(section(page).getByText("From a conversation that has not ended")).toBeVisible();
    await expect(section(page).getByRole("link", { name: "Go to your conversation" })).toHaveAttribute("href", "/explorer/conversation");
    await expect(section(page).getByRole("button", { name: "Mark Reached" })).toHaveCount(0);
    await row(page, 1).click();
    await expect(row(page, 2)).toHaveAttribute("aria-expanded", "false");
    await expect(section(page).getByRole("button", { name: "Mark Reached" })).toBeVisible();
    await expect(section(page).getByRole("button", { name: "Release", exact: true })).toBeVisible();
  });

  test("releases a Waypoint from an ended conversation after its review", async ({ page }) => {
    const bodies: unknown[] = [];
    await page.route("**/explorer/waypoints/your-waypoints/commands", async route => {
      const body = route.request().postDataJSON() as { operationId: string };
      bodies.push(body);
      await fulfillJson(route, { version: VERSION, kind: "close", ok: true, replay: false, error: null,
        item: waypoint(1, ENDED, true, { release: { operationId: body.operationId, releasedAt: "2026-11-06T18:00:00.000Z" } }) });
    });
    await open(page, () => list([waypoint(1, ENDED, true)]));
    await row(page, 1).click();
    await section(page).getByRole("button", { name: "Release", exact: true }).click();
    await expect(section(page).getByText("Review before releasing this Waypoint", { exact: true })).toBeFocused();
    const submit = section(page).getByRole("button", { name: "Release this Waypoint" });
    await expect(submit).toBeDisabled();
    await section(page).getByRole("checkbox").check();
    await submit.click();
    await expect(notice(page)).toHaveText("Saved. This Waypoint is released.");
    expect(bodies).toEqual([{ kind: "release_waypoint", operationId: expect.stringMatching(/^[0-9a-f-]{36}$/), waypointId: id(1) }]);
    await expect(section(page).getByRole("button", { name: "Reached and released (1)" })).toHaveAttribute("aria-expanded", "true");
    await expect(row(page, 1)).toBeFocused();
    await expect(section(page).getByText(/^Released$/)).toBeVisible();
    await expect(section(page).getByRole("button", { name: "Release", exact: true })).toHaveCount(0);
  });

  test("marks Reached with trimmed evidence, and repeats the exact request after an uncertain save", async ({ page }) => {
    const bodies: { operationId: string; reachedEvidence: string }[] = [];
    await page.route("**/explorer/waypoints/your-waypoints/commands", async route => {
      const body = route.request().postDataJSON();
      bodies.push(body);
      if (bodies.length === 1) return route.abort("failed");
      await fulfillJson(route, { version: VERSION, kind: "close", ok: true, replay: true, error: null,
        item: waypoint(1, ENDED, true, { status: "reached", reachedEvidence: body.reachedEvidence, reachedAt: "2026-11-06T18:00:00.000Z" }) });
    });
    await open(page, () => list([waypoint(1, ENDED, true)]));
    await row(page, 1).click();
    await section(page).getByRole("button", { name: "Mark Reached" }).click();
    const submit = section(page).getByRole("button", { name: "Confirm Reached" });
    const evidence = section(page).getByRole("textbox", { name: "What supporting evidence shows arrival?" });
    await section(page).getByRole("checkbox").check();
    await expect(submit).toBeDisabled();
    await evidence.fill("  I walked it every week.  ");
    // Editing the evidence clears the confirmation, so the reviewed words are the saved words.
    await expect(section(page).getByRole("checkbox")).not.toBeChecked();
    await section(page).getByRole("checkbox").check();
    await submit.click();
    await expect(notice(page)).toHaveText(/To avoid saving it twice, choose the same button again/);
    await expect(evidence).toHaveAttribute("readonly", "");
    await expect(section(page).getByRole("checkbox")).toBeDisabled();
    await submit.click();
    await expect(notice(page)).toHaveText("Saved. This Waypoint is marked Reached.");
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[0]).toEqual({ kind: "reach_waypoint", operationId: expect.any(String), waypointId: id(1), reachedEvidence: "I walked it every week." });
    await expect(section(page).getByText("I walked it every week.")).toBeVisible();
  });

  test("a conflict saves nothing and reloads the current Waypoints", async ({ page }) => {
    let reads = 0;
    await page.route("**/explorer/waypoints/your-waypoints/commands", route =>
      fulfillJson(route, { version: VERSION, kind: "close", ok: false, replay: false, item: null, error: "conflict" }));
    await open(page, () => { reads += 1; return list([waypoint(1, ENDED, true)]); });
    await row(page, 1).click();
    await section(page).getByRole("button", { name: "Release", exact: true }).click();
    await section(page).getByRole("checkbox").check();
    await section(page).getByRole("button", { name: "Release this Waypoint" }).click();
    await expect(notice(page)).toHaveText("This Waypoint changed since you opened it, so nothing was saved. Its current details are shown again.");
    await expect.poll(() => reads).toBe(2);
    await expect(section(page).getByRole("button", { name: "Release this Waypoint" })).toHaveCount(0);
  });

  test("shows earlier versions on request from the Waypoint's own conversation", async ({ page }) => {
    const same = { destination: "Walk the river trail 2", meaning: "Time outside helps me think.", arrivalSignal: "I walk it twice a week for a month." };
    const lifecycle = { predecessorWaypointId: id(1), creationReason: "revisit", clarifications: [] };
    const head = waypoint(2, ENDED, true, { ...same, lifecycle });
    const urls: URL[] = [];
    await page.route("**/explorer/waypoints/your-waypoints/history**", route => {
      urls.push(new URL(route.request().url()));
      const current = { id: head.id, sourceMessageId: head.sourceMessageId, isCurrent: true, createdAt: head.createdAt,
        title: head.title, ...same, status: "chosen", lifecycle };
      const earlier = { id: id(1), sourceMessageId: head.sourceMessageId, isCurrent: false, createdAt: "2026-11-04T16:00:00.000Z",
        title: "Walk the river trail, first try", ...same, status: "chosen",
        release: { operationId: id(700), releasedAt: "2026-11-05T17:00:00.000Z" } };
      return fulfillJson(route, { version: VERSION, kind: "history", ok: true, waypointId: id(2), complete: true, error: null,
        versions: [current, earlier] });
    });
    await open(page, () => list([head]));
    await row(page, 2).click();
    await section(page).getByRole("button", { name: "Show earlier versions" }).click();
    await expect(section(page).getByText("Earlier version - Released")).toBeVisible();
    await expect(section(page).getByText("Walk the river trail, first try")).toBeVisible();
    expect([...urls[0].searchParams.entries()].sort()).toEqual([["conversationId", ENDED], ["waypointId", id(2)]]);
  });

  test("loads more Waypoints and moves focus to the first new row", async ({ page }) => {
    const first = Array.from({ length: 20 }, (_, index) => waypoint(index + 1, ENDED, true));
    await open(page, url => (url.searchParams.get("offset") === "20" ? list([waypoint(21, ENDED, true)]) : list(first, { hasMore: true, nextOffset: 20 })));
    await expect(section(page).getByRole("heading", { name: "In progress", exact: true })).toBeVisible();
    await section(page).getByRole("button", { name: "Show more Waypoints" }).click();
    await expect(row(page, 21)).toBeFocused();
    await expect(section(page).getByRole("heading", { name: "In progress (21)" })).toBeVisible();
    await expect(section(page).getByRole("button", { name: "Show more Waypoints" })).toHaveCount(0);
  });

  test("an unavailable section leaves the suggestions working", async ({ page }) => {
    await open(page, () => ({ version: VERSION, kind: "list", ok: false, items: null, hasMore: false, nextOffset: null, error: "denied" }));
    await expect(section(page).getByRole("heading", { name: "Your Waypoints are unavailable" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No suggestions yet" })).toBeVisible();
    await expectNoSeriousAxeViolations(page);
  });

  test("labels an ended Waypoint from an earlier Guide relationship by its own conversation, and closes it", async ({ page }) => {
    // The ended fact comes from the Waypoint's own conversation (migration 20261106050000), whatever the relationship.
    const earlier = id(777);
    await page.route("**/explorer/waypoints/your-waypoints/commands", async route => {
      const body = route.request().postDataJSON() as { operationId: string };
      await fulfillJson(route, { version: VERSION, kind: "close", ok: true, replay: false, error: null,
        item: { ...waypoint(1, earlier, true), release: { operationId: body.operationId, releasedAt: "2026-11-06T18:00:00.000Z" } } });
    });
    await open(page, () => list([waypoint(1, earlier, true)]));
    await row(page, 1).click();
    await expect(section(page).getByText("From an ended conversation")).toBeVisible();
    await section(page).getByRole("button", { name: "Release", exact: true }).click();
    await section(page).getByRole("checkbox").check();
    await section(page).getByRole("button", { name: "Release this Waypoint" }).click();
    await expect(notice(page)).toHaveText("Saved. This Waypoint is released.");
  });

  test("loads earlier versions again after a failure, keeping the panel open and focus on its toggle", async ({ page }) => {
    const same = { destination: "Walk the river trail 2", meaning: "Time outside helps me think.", arrivalSignal: "I walk it twice a week for a month." };
    const lifecycle = { predecessorWaypointId: id(1), creationReason: "revisit", clarifications: [] };
    const head = waypoint(2, ENDED, true, { ...same, lifecycle });
    let calls = 0;
    await page.route("**/explorer/waypoints/your-waypoints/history**", route => {
      calls += 1;
      if (calls === 1) return route.abort("failed");
      const current = { id: head.id, sourceMessageId: head.sourceMessageId, isCurrent: true, createdAt: head.createdAt,
        title: head.title, ...same, status: "chosen", lifecycle };
      const earlierVersion = { id: id(1), sourceMessageId: head.sourceMessageId, isCurrent: false, createdAt: "2026-11-04T16:00:00.000Z",
        title: "Walk the river trail, first try", ...same, status: "chosen", release: { operationId: id(700), releasedAt: "2026-11-05T17:00:00.000Z" } };
      return fulfillJson(route, { version: VERSION, kind: "history", ok: true, waypointId: id(2), complete: true, error: null, versions: [current, earlierVersion] });
    });
    await open(page, () => list([head]));
    await row(page, 2).click();
    await section(page).getByRole("button", { name: "Show earlier versions" }).click();
    await expect(section(page).getByText("Earlier versions could not be loaded.")).toBeVisible();
    await section(page).getByRole("button", { name: "Load earlier versions again" }).click();
    await expect(section(page).getByText("Walk the river trail, first try")).toBeVisible();
    await expect(section(page).getByRole("button", { name: "Hide earlier versions" })).toBeFocused();
    expect(calls).toBe(2);
  });

  test("after a save with more pages, reads the shown pages again from the start so no Waypoint is skipped", async ({ page }) => {
    const firstPage = Array.from({ length: 20 }, (_, index) => waypoint(index + 1, ENDED, true));
    const offsets: (string | null)[] = [];
    let released = false;
    await page.route("**/explorer/waypoints/your-waypoints/commands", async route => {
      const body = route.request().postDataJSON() as { operationId: string };
      released = true;
      await fulfillJson(route, { version: VERSION, kind: "close", ok: true, replay: false, error: null,
        item: waypoint(20, ENDED, true, { release: { operationId: body.operationId, releasedAt: "2026-11-06T18:00:00.000Z" } }) });
    });
    await open(page, url => {
      offsets.push(url.searchParams.get("offset"));
      if (!released) return list(firstPage, { hasMore: true, nextOffset: 20 });
      // After the release, the released Waypoint moves to the closed rows: the first page now ends with row 21.
      const reordered = [...firstPage.slice(0, 19), waypoint(21, ENDED, true)];
      return url.searchParams.get("offset") === "20"
        ? list([waypoint(20, ENDED, true, { release: { operationId: id(7), releasedAt: "2026-11-06T18:00:00.000Z" } })])
        : list(reordered, { hasMore: true, nextOffset: 20 });
    });
    await row(page, 20).click();
    await section(page).getByRole("button", { name: "Release", exact: true }).click();
    await section(page).getByRole("checkbox").check();
    await section(page).getByRole("button", { name: "Release this Waypoint" }).click();
    await expect(notice(page)).toHaveText("Saved. This Waypoint is released.");
    await expect(row(page, 21)).toBeVisible();
    // The released Waypoint stays in view and focused, although its new place is on the next page.
    await expect(row(page, 20)).toBeFocused();
    expect(offsets).toEqual([null, null]);
    await section(page).getByRole("button", { name: "Show more Waypoints" }).click();
    await expect(section(page).getByRole("heading", { name: "In progress (20)" })).toBeVisible();
    await expect(section(page).getByRole("button", { name: "Reached and released (1)" })).toBeVisible();
    expect(offsets).toEqual([null, null, "20"]);
  });

  test("after an uncertain save, a later refusal says the outcome could not be confirmed and shows what is saved", async ({ page }) => {
    let attempts = 0;
    let reads = 0;
    await page.route("**/explorer/waypoints/your-waypoints/commands", async route => {
      attempts += 1;
      if (attempts === 1) return route.abort("failed");
      await fulfillJson(route, { version: VERSION, kind: "close", ok: false, replay: false, item: null, error: "denied" });
    });
    await open(page, () => {
      reads += 1;
      return list([reads === 1 ? waypoint(1, ENDED, true)
        : waypoint(1, ENDED, true, { release: { operationId: id(7), releasedAt: "2026-11-06T18:00:00.000Z" } })]);
    });
    await row(page, 1).click();
    await section(page).getByRole("button", { name: "Release", exact: true }).click();
    await section(page).getByRole("checkbox").check();
    const submit = section(page).getByRole("button", { name: "Release this Waypoint" });
    await submit.click();
    await expect(notice(page)).toHaveText(/To avoid saving it twice/);
    await expect(submit).toBeFocused();
    await expect(section(page).getByRole("button", { name: "Close and show what is saved" })).toBeVisible();
    await submit.click();
    await expect(notice(page)).toHaveText("We could not confirm whether your earlier request was saved. Your Waypoints are shown as they are saved now.");
    await expect(section(page).getByRole("button", { name: "Reached and released (1)" })).toBeVisible();
    expect(reads).toBe(2);
  });

  test("Show more opens the closed group when the first new Waypoint is closed, and moves focus to it", async ({ page }) => {
    const firstPage = Array.from({ length: 20 }, (_, index) => waypoint(index + 1, ENDED, true));
    await open(page, url => (url.searchParams.get("offset") === "20"
      ? list([waypoint(21, ENDED, true, { release: { operationId: id(7), releasedAt: "2026-11-06T18:00:00.000Z" } })])
      : list(firstPage, { hasMore: true, nextOffset: 20 })));
    await section(page).getByRole("button", { name: "Show more Waypoints" }).click();
    await expect(section(page).getByRole("button", { name: "Reached and released (1)" })).toHaveAttribute("aria-expanded", "true");
    await expect(row(page, 21)).toBeFocused();
  });

  test("a reload that fails after a conflict keeps the list and says it may be out of date", async ({ page }) => {
    let reads = 0;
    await page.route("**/explorer/waypoints/your-waypoints/commands", route =>
      fulfillJson(route, { version: VERSION, kind: "close", ok: false, replay: false, item: null, error: "conflict" }));
    await open(page, () => {
      reads += 1;
      return reads === 1 ? list([waypoint(1, ENDED, true)])
        : { version: VERSION, kind: "list", ok: false, items: null, hasMore: false, nextOffset: null, error: "unavailable" };
    });
    await row(page, 1).click();
    await section(page).getByRole("button", { name: "Release", exact: true }).click();
    await section(page).getByRole("checkbox").check();
    await section(page).getByRole("button", { name: "Release this Waypoint" }).click();
    // The outcome sentence stays, with the reload sentence after it, and focus stays on the Waypoint's row.
    await expect(notice(page)).toHaveText("This Waypoint changed since you opened it, so nothing was saved. Its current details are shown again. "
      + "Your Waypoints could not be loaded again, so this list may be out of date. Load the page again to see them.");
    await expect(row(page, 1)).toBeVisible();
    await expect(row(page, 1)).toBeFocused();
  });


  test("a save that answers while Show more is loading leaves Show more working, with no Waypoint skipped", async ({ page }) => {
    const firstPage = Array.from({ length: 20 }, (_, index) => waypoint(index + 1, ENDED, true));
    const offsets: (string | null)[] = [];
    let releaseHeld!: () => void;
    const held = new Promise<void>(resolve => { releaseHeld = resolve; });
    let heldOnce = false;
    let released = false;
    await page.route("**/explorer/waypoints/suggestions?**", route => fulfillJson(route, { ok: true, data: { items: [], next_cursor: null, total_count: 0 }, error: null }));
    await page.route("**/explorer/waypoints/your-waypoints/state**", async route => {
      const offset = new URL(route.request().url()).searchParams.get("offset");
      offsets.push(offset);
      if (offset === "20") {
        if (!heldOnce) { heldOnce = true; await held; }
        return fulfillJson(route, list([waypoint(21, ENDED, true)]));
      }
      return fulfillJson(route, list(released ? [...firstPage.slice(1), waypoint(21, ENDED, true)] : firstPage, { hasMore: true, nextOffset: 20 }));
    });
    await page.route("**/explorer/waypoints/your-waypoints/commands", async route => {
      const body = route.request().postDataJSON() as { operationId: string };
      released = true;
      await fulfillJson(route, { version: VERSION, kind: "close", ok: true, replay: false, error: null,
        item: waypoint(1, ENDED, true, { release: { operationId: body.operationId, releasedAt: "2026-11-06T18:00:00.000Z" } }) });
    });
    await page.goto("/explorer/waypoints");
    await row(page, 1).click();
    await section(page).getByRole("button", { name: "Release", exact: true }).click();
    await section(page).getByRole("checkbox").check();
    const more = section(page).getByRole("button", { name: "Show more Waypoints" });
    await more.click();
    await expect(more).toHaveAttribute("aria-disabled", "true");
    await section(page).getByRole("button", { name: "Release this Waypoint" }).click();
    await expect(notice(page)).toHaveText("Saved. This Waypoint is released.");
    await expect(row(page, 21)).toBeVisible();
    releaseHeld();
    await expect(more).not.toHaveAttribute("aria-disabled", "true");
    await more.click();
    await expect(section(page).getByRole("button", { name: "Show more Waypoints" })).toHaveCount(0);
    await expect(section(page).getByRole("heading", { name: "In progress (20)" })).toBeVisible();
    expect(offsets).toEqual([null, "20", null, "20"]);
  });

  test("Show more waits while the shown pages are read again after a save", async ({ page }) => {
    const firstPage = Array.from({ length: 20 }, (_, index) => waypoint(index + 1, ENDED, true));
    const offsets: (string | null)[] = [];
    let releaseReload!: () => void;
    const reloadGate = new Promise<void>(resolve => { releaseReload = resolve; });
    let released = false;
    await page.route("**/explorer/waypoints/suggestions?**", route => fulfillJson(route, { ok: true, data: { items: [], next_cursor: null, total_count: 0 }, error: null }));
    await page.route("**/explorer/waypoints/your-waypoints/state**", async route => {
      const offset = new URL(route.request().url()).searchParams.get("offset");
      offsets.push(offset);
      if (offset === "20") return fulfillJson(route, list([waypoint(21, ENDED, true)]));
      if (released) await reloadGate;
      return fulfillJson(route, list(released ? [...firstPage.slice(1), waypoint(21, ENDED, true)] : firstPage, { hasMore: true, nextOffset: 20 }));
    });
    await page.route("**/explorer/waypoints/your-waypoints/commands", async route => {
      const body = route.request().postDataJSON() as { operationId: string };
      released = true;
      await fulfillJson(route, { version: VERSION, kind: "close", ok: true, replay: false, error: null,
        item: waypoint(1, ENDED, true, { release: { operationId: body.operationId, releasedAt: "2026-11-06T18:00:00.000Z" } }) });
    });
    await page.goto("/explorer/waypoints");
    await row(page, 1).click();
    await section(page).getByRole("button", { name: "Release", exact: true }).click();
    await section(page).getByRole("checkbox").check();
    await section(page).getByRole("button", { name: "Release this Waypoint" }).click();
    await expect(notice(page)).toHaveText("Saved. This Waypoint is released.");
    const more = section(page).getByRole("button", { name: "Show more Waypoints" });
    await expect(more).toHaveAttribute("aria-disabled", "true");
    // A forced press while the reload runs is ignored: no page is read past the reload.
    await more.click({ force: true });
    expect(offsets).toEqual([null, null]);
    releaseReload();
    await expect(row(page, 21)).toBeVisible();
    await expect(more).not.toHaveAttribute("aria-disabled", "true");
  });

  test("a refused save keeps focus on the Waypoint's row", async ({ page }) => {
    await page.route("**/explorer/waypoints/your-waypoints/commands", route =>
      fulfillJson(route, { version: VERSION, kind: "close", ok: false, replay: false, item: null, error: "denied" }));
    await open(page, () => list([waypoint(1, ENDED, true)]));
    await row(page, 1).click();
    await section(page).getByRole("button", { name: "Release", exact: true }).click();
    await section(page).getByRole("checkbox").check();
    await section(page).getByRole("button", { name: "Release this Waypoint" }).click();
    await expect(notice(page)).toHaveText("This change could not be saved, so your Waypoint stays as it was. It may no longer be available to close here.");
    await expect(row(page, 1)).toBeFocused();
  });

  // Correction D-2 (2026-11-09; REV335d finding 1): an older reload must never put back what a later save changed.
  test("a second review waits while an uncertain save's reload runs, so the older read never undoes it", async ({ page }) => {
    let attempts = 0;
    let reads = 0;
    let releaseReload!: () => void;
    const reloadGate = new Promise<void>(resolve => { releaseReload = resolve; });
    await page.route("**/explorer/waypoints/suggestions?**", route => fulfillJson(route, { ok: true, data: { items: [], next_cursor: null, total_count: 0 }, error: null }));
    await page.route("**/explorer/waypoints/your-waypoints/state**", async route => {
      reads += 1;
      if (reads === 1) return fulfillJson(route, list([waypoint(1, ENDED, true), waypoint(2, ENDED, true)]));
      await reloadGate;
      // The uncertain first release did save.
      return fulfillJson(route, list([
        waypoint(1, ENDED, true, { release: { operationId: id(7), releasedAt: "2026-11-06T18:00:00.000Z" } }), waypoint(2, ENDED, true)]));
    });
    await page.route("**/explorer/waypoints/your-waypoints/commands", async route => {
      attempts += 1;
      if (attempts === 1) return route.abort("failed");
      const body = route.request().postDataJSON() as { operationId: string };
      await fulfillJson(route, { version: VERSION, kind: "close", ok: true, replay: false, error: null,
        item: waypoint(2, ENDED, true, { release: { operationId: body.operationId, releasedAt: "2026-11-06T18:05:00.000Z" } }) });
    });
    await page.goto("/explorer/waypoints");
    await row(page, 1).click();
    await section(page).getByRole("button", { name: "Release", exact: true }).click();
    await section(page).getByRole("checkbox").check();
    await section(page).getByRole("button", { name: "Release this Waypoint" }).click();
    await expect(notice(page)).toHaveText(/To avoid saving it twice/);
    await section(page).getByRole("button", { name: "Close and show what is saved" }).click();
    // The reload is held: a second review cannot start until it has finished.
    await row(page, 2).click();
    const releaseTwo = section(page).getByRole("button", { name: "Release", exact: true });
    await expect(releaseTwo).toBeDisabled();
    // The reason is shown in place, beside the buttons, and goes when the reload ends.
    const refreshing = section(page).getByText(
      "Your Waypoints are being refreshed so they show what is saved now. Mark Reached and Release will be available again when that finishes.");
    await expect(refreshing).toBeVisible();
    await expect(releaseTwo).toHaveAccessibleDescription(/being refreshed/);
    releaseReload();
    await expect(releaseTwo).toBeEnabled();
    await expect(refreshing).toHaveCount(0);
    await releaseTwo.click();
    await section(page).getByRole("checkbox").check();
    await section(page).getByRole("button", { name: "Release this Waypoint" }).click();
    await expect(notice(page)).toHaveText("Saved. This Waypoint is released.");
    await expect(section(page).getByRole("button", { name: "Reached and released (2)" })).toBeVisible();
    expect(reads).toBe(2);
    expect(attempts).toBe(2);
  });

  // Correction D-3 (2026-11-09; REV335d finding 2): whether focus was lost is judged after the reload's update.
  const conflictThenReload = async (page: Page, reloaded: unknown[], gate?: Promise<void>) => {
    let reads = 0;
    await page.route("**/explorer/waypoints/suggestions?**", route => fulfillJson(route, { ok: true, data: { items: [], next_cursor: null, total_count: 0 }, error: null }));
    await page.route("**/explorer/waypoints/your-waypoints/state**", async route => {
      reads += 1;
      if (reads === 1) return fulfillJson(route, list([waypoint(1, ENDED, true), waypoint(2, ENDED, true)]));
      if (gate !== undefined) await gate;
      return fulfillJson(route, list(reloaded));
    });
    await page.route("**/explorer/waypoints/your-waypoints/commands", route =>
      fulfillJson(route, { version: VERSION, kind: "close", ok: false, replay: false, item: null, error: "conflict" }));
    await page.goto("/explorer/waypoints");
    await row(page, 1).click();
    await section(page).getByRole("button", { name: "Release", exact: true }).click();
    await section(page).getByRole("checkbox").check();
    await section(page).getByRole("button", { name: "Release this Waypoint" }).click();
    await expect(notice(page)).toHaveText(/nothing was saved/);
    return () => reads;
  };
  const releasedOne = () => waypoint(1, ENDED, true, { release: { operationId: id(7), releasedAt: "2026-11-06T18:00:00.000Z" } });

  // Both hold the reload, so focus is first back on the row, still in place, before the update moves or removes it.
  test("after a refused save, a reload that moves the Waypoint into the closed group keeps focus on its row", async ({ page }) => {
    let releaseReload!: () => void;
    const reloadGate = new Promise<void>(resolve => { releaseReload = resolve; });
    const reads = await conflictThenReload(page, [releasedOne(), waypoint(2, ENDED, true)], reloadGate);
    await expect.poll(reads).toBe(2);
    await expect(row(page, 1)).toBeFocused();
    releaseReload();
    await expect(section(page).getByRole("button", { name: "Reached and released (1)" })).toHaveAttribute("aria-expanded", "true");
    await expect(row(page, 1)).toBeFocused();
  });

  test("after a refused save, a reload in which the Waypoint is gone moves focus to the section heading", async ({ page }) => {
    let releaseReload!: () => void;
    const reloadGate = new Promise<void>(resolve => { releaseReload = resolve; });
    const reads = await conflictThenReload(page, [waypoint(2, ENDED, true)], reloadGate);
    await expect.poll(reads).toBe(2);
    await expect(row(page, 1)).toBeFocused();
    releaseReload();
    await expect(row(page, 1)).toHaveCount(0);
    await expect(section(page).getByRole("heading", { name: "Your Waypoints", exact: true })).toBeFocused();
  });

  test("after a refused save, focus the Explorer moved elsewhere stays there when the reload moves the Waypoint", async ({ page }) => {
    let releaseReload!: () => void;
    const reloadGate = new Promise<void>(resolve => { releaseReload = resolve; });
    await conflictThenReload(page, [releasedOne(), waypoint(2, ENDED, true)], reloadGate);
    await expect(row(page, 1)).toBeFocused();
    await row(page, 2).focus();
    releaseReload();
    await expect(section(page).getByRole("button", { name: "Reached and released (1)" })).toBeVisible();
    await expect(row(page, 2)).toBeFocused();
  });

});
