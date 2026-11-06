// The default run leaves the server capability SOLMIND_EARLY_TEST_NOTICE unset;
// the server then makes no notice setting or agreement reads.
// For the on-only cases the Executor starts the app server separately with
// SOLMIND_EARLY_TEST_NOTICE=enabled and a readable, supported protected setting on,
// then selects these cases with SOLMIND_BROWSER_NOTICE_SETTING=on. That test-only
// selector does not enable the server capability or change the protected setting.
// On-only HTTP fixtures prove mounted notice behavior, not authentication or SQL.
import { expect, test, type Page } from "@playwright/test";
import {
  EARLY_TEST_NOTICE_AGREE, EARLY_TEST_NOTICE_BULLETS, EARLY_TEST_NOTICE_DECLINED_BODY,
  EARLY_TEST_NOTICE_HEADING, EARLY_TEST_NOTICE_NOT_NOW, EARLY_TEST_NOTICE_UNAVAILABLE,
  EXPLORER_EARLY_TEST_NOTICE_VERSION,
} from "../../src/lib/solmind/explorerEarlyTestNotice";

test.use({ trace: "off", screenshot: "off", video: "off" });
const SERVER_NOTICE_ON = process.env.SOLMIND_BROWSER_NOTICE_SETTING === "on";
const deniedConversation = {
  version: "explorer-private-conversation-response.v1",
  result: { ok: false, state: null, error: "denied" }, assistance: null,
};

test("F6 server capability off keeps existing pages and makes no notice requests", async ({ page }) => {
  test.skip(SERVER_NOTICE_ON, "Requires the app server's SOLMIND_EARLY_TEST_NOTICE capability to be unset.");
  const noticeRequests: string[] = [];
  let stateReads = 0;
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/explorer/early-test-notice/")) {
      noticeRequests.push(request.url());
    }
  });
  // Only feature responses are mocked. The layout and capability check are real;
  // there is deliberately no notice status or agreement interception here.
  await page.route("**/explorer/conversation/state", route => {
    stateReads += 1;
    return route.fulfill({ json: deniedConversation });
  });
  await page.route("**/explorer/conversations/state", route => route.fulfill({ json: {
    version: "explorer-conversation-review.v1", ok: false, items: null, state: null, error: "denied",
  } }));
  await page.goto("/explorer/conversation");
  const denied = page.getByRole("main").getByRole("alert");
  await expect(denied).toContainText("not available in your current session");
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/login/explorer");
  await expect(page.getByLabel("Continue the conversation", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Saved conversation", exact: true })).toHaveCount(0);
  expect(stateReads).toBe(1);
  expect(noticeRequests).toEqual([]);

  await page.goto("/explorer/conversations");
  await expect(page.getByRole("heading", { name: "Your ended conversations", exact: true })).toBeVisible();
  await expect(page.getByText("These conversations are not available in your current session. Sign in again to review them.", { exact: true })).toBeVisible();
  expect(noticeRequests).toEqual([]);
  await page.goBack();
  await expect(page).toHaveURL(/\/explorer\/conversation$/);
  await expect(denied).toContainText("not available in your current session");
  await expect.poll(() => stateReads).toBeGreaterThan(1);
  expect(noticeRequests).toEqual([]);

  // The conversation's existing restore owner reloads on persisted pageshow.
  // Off must preserve that behavior without introducing any notice request.
  const readsBeforeRestore = stateReads;
  await Promise.all([
    page.waitForEvent("load"),
    page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }))),
  ]);
  await expect(denied).toContainText("not available in your current session");
  await expect.poll(() => stateReads).toBe(readsBeforeRestore + 1);
  await expect(page.getByRole("heading", { name: EARLY_TEST_NOTICE_HEADING })).toHaveCount(0);
  expect(noticeRequests).toEqual([]);
});

async function mockNotice(page: Page) {
  let agreements = 0;
  let stateReads = 0;
  await page.route("**/explorer/early-test-notice/status", route => route.fulfill({ json: {
    status: agreements ? "allowed" : "required", noticeVersion: agreements ? null : EXPLORER_EARLY_TEST_NOTICE_VERSION,
  } }));
  await page.route("**/explorer/early-test-notice/agree", route => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({ noticeVersion: EXPLORER_EARLY_TEST_NOTICE_VERSION, adultAffirmation: true });
    agreements += 1;
    return route.fulfill({ json: { status: "allowed", noticeVersion: null } });
  });
  await page.route("**/explorer/conversation/state", route => {
    stateReads += 1;
    return route.fulfill({ json: deniedConversation });
  });
  return { agreements: () => agreements, stateReads: () => stateReads };
}

test.describe("protected server setting on", () => {
  test.skip(!SERVER_NOTICE_ON, "Executor must start the app server with SOLMIND_EARLY_TEST_NOTICE=enabled, enable the protected setting, and select SOLMIND_BROWSER_NOTICE_SETTING=on.");

  test("notice hides the app, focuses its heading, and agreement continues", async ({ page }) => {
    const fixture = await mockNotice(page);
    await page.goto("/explorer/conversation");
    const region = page.getByRole("region", { name: EARLY_TEST_NOTICE_HEADING });
    await expect(region).toBeVisible();
    await expect(page.getByRole("heading", { name: EARLY_TEST_NOTICE_HEADING })).toBeFocused();
    for (const bullet of EARLY_TEST_NOTICE_BULLETS) await expect(region.getByText(bullet, { exact: true })).toBeVisible();
    expect(fixture.stateReads()).toBe(0);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: EARLY_TEST_NOTICE_AGREE, exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(region).toHaveCount(0);
    await expect.poll(fixture.stateReads).toBe(1);
    expect(fixture.agreements()).toBe(1);
    await page.reload();
    await expect.poll(fixture.stateReads).toBe(2);
    expect(fixture.agreements()).toBe(1);
  });

  test("Not now records nothing and offers the existing sign-out", async ({ page }) => {
    const fixture = await mockNotice(page);
    await page.route("**/logout", route => {
      expect(route.request().postDataJSON()).toEqual({});
      return route.fulfill({ json: { outcome: "signed_out" } });
    });
    await page.goto("/explorer/conversation");
    await page.getByRole("button", { name: EARLY_TEST_NOTICE_NOT_NOW, exact: true }).click();
    await expect(page.getByText(EARLY_TEST_NOTICE_DECLINED_BODY, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "You can come back later" })).toBeFocused();
    expect(fixture.agreements()).toBe(0);
    expect(fixture.stateReads()).toBe(0);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("heading", { name: "You're signed out" })).toBeVisible();
    expect(fixture.agreements()).toBe(0);
    // Same account still has no agreement when a later sign-in returns here.
    await page.goto("/explorer/conversation");
    await expect(page.getByRole("heading", { name: EARLY_TEST_NOTICE_HEADING })).toBeVisible();
  });

  test("an unavailable notice status exposes no app controls", async ({ page }) => {
    const fixture = await mockNotice(page);
    await page.route("**/explorer/early-test-notice/status", route => route.fulfill({ json: { status: "unavailable", noticeVersion: null } }));
    await page.goto("/explorer/conversation");
    await expect(page.getByText(EARLY_TEST_NOTICE_UNAVAILABLE, { exact: true })).toBeVisible();
    expect(fixture.stateReads()).toBe(0);
    expect(fixture.agreements()).toBe(0);
  });

  test("a feature refusal rechecks current agreement status while the server setting is on", async ({ page }) => {
    let agreementRequired = false;
    let statusReads = 0;
    let stateReads = 0;
    await page.route("**/explorer/early-test-notice/status", route => {
      statusReads += 1;
      return route.fulfill({ json: {
        status: agreementRequired ? "required" : "allowed", noticeVersion: agreementRequired ? EXPLORER_EARLY_TEST_NOTICE_VERSION : null,
      } });
    });
    await page.route("**/explorer/conversation/state", route => {
      stateReads += 1;
      agreementRequired = true;
      return route.fulfill({ json: deniedConversation });
    });
    await page.goto("/explorer/conversation");
    await expect(page.getByRole("heading", { name: EARLY_TEST_NOTICE_HEADING })).toBeFocused();
    await expect(page.getByRole("button", { name: EARLY_TEST_NOTICE_AGREE, exact: true })).toBeVisible();
    expect(statusReads).toBe(2);
    expect(stateReads).toBe(1);
  });
});
