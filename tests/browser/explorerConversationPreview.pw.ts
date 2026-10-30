// Interim Explorer conversation screen design review. The page is fixed sample
// content: this test proves it makes no request beyond its own page, static
// assets and logo, stores nothing, explains every unwired control and keeps
// its layout-only controls working at wide and narrow widths.
import { expect, test } from "@playwright/test";

import {
  ROUTE, SPEAKER_LABEL_STYLE, capture, captureFullPage, checkAndUseUnwiredControls, expectChoicesDoNotOverlap,
  expectLogoSpeakers, expectNoSeriousAxeViolations, expectNoSidewaysScroll, expectNothingKept, expectOriginalSpeakers,
  expectSpeakersFollowConstant, expectTabReachesControls, focusProblems, guardPage, tabThroughConversationControls,
} from "./conversationPreviewHelpers";

test.use({ trace: "off", screenshot: "off", video: "off" });

test("wide screen: unwired controls explain themselves and layout controls work", async ({ page, baseURL }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, "wide layout only");
  const guard = await guardPage(page, baseURL);
  await expect(page.getByText(/^Interim design review\. Nothing here is connected/)).toBeVisible();
  await expectNoSidewaysScroll(page);
  await expectNoSeriousAxeViolations(page);
  await expect(page.locator("#conversation-preview-drawer-opener")).toBeHidden();
  await expect(page.locator("#conversation-preview-panel-toggle")).toBeVisible();
  await expectSpeakersFollowConstant(page);
  await page.screenshot({ path: capture("interim-wide-panel-shown-viewport") });
  await captureFullPage(page, "interim-wide-panel-shown-full", "top");

  // Once the panel is in its resting place, the Waypoint summary shows without scrolling the panel.
  const panel = page.locator("#conversation-preview-panel");
  const panelTop = await panel.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
  await page.evaluate((top) => window.scrollTo(0, top - 20), panelTop);
  const view = await page.evaluate(() => {
    const panelBox = document.getElementById("conversation-preview-panel")!.getBoundingClientRect();
    const box = (id: string) => document.getElementById(id)!.getBoundingClientRect();
    const card = document.querySelector("[data-waypoint-card]")!.getBoundingClientRect();
    return { panelTop: panelBox.top, panelBottom: panelBox.bottom, title: box("panel-waypoint-title").bottom, card: card.bottom };
  });
  test.info().annotations.push({ type: "waypoint-in-panel", description: JSON.stringify(view) });
  console.log(`waypoint-in-panel ${JSON.stringify(view)}`);
  expect(view.title).toBeLessThanOrEqual(view.panelBottom);
  await page.screenshot({ path: capture("interim-wide-panel-resting-viewport") });
  await page.evaluate(() => window.scrollTo(0, 0));

  await page.locator("summary", { hasText: "supporting quotes" }).click();
  await expect(page.locator("#conversation-preview-panel li", { hasText: "I don't know how to explain what I need." })).toBeVisible();
  expect(await checkAndUseUnwiredControls(page, "body")).toBe(52);
  await expectTabReachesControls(page);
  await expect(page.locator("#conversation-preview-composer")).toHaveValue("");

  await page.getByRole("button", { name: "Compact view of the Compass" }).click();
  await expect(page.getByRole("list", { name: "Current and recent Compass orientations" })).toBeVisible();
  await page.getByRole("button", { name: "Full view of the Compass" }).click();
  await expect(page.getByRole("img", { name: "Sample Compass" })).toBeVisible();

  // Speaker labels: New / Original changes only what this preview shows.
  const speakers = page.getByRole("group", { name: "Speaker labels:" });
  for (const [name, check] of [["New", expectLogoSpeakers], ["Original", expectOriginalSpeakers]] as const) {
    await speakers.getByRole("button", { name }).click();
    await expect(speakers.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
    await check(page);
    await page.locator("#conversation-preview-turn-3-speaker").scrollIntoViewIfNeeded();
    await page.screenshot({ path: capture(`interim-wide-speakers-${name.toLowerCase()}-viewport`) });
  }
  await speakers.getByRole("button", { name: SPEAKER_LABEL_STYLE === "logo" ? "New" : "Original" }).click();
  await expectSpeakersFollowConstant(page);
  await page.evaluate(() => window.scrollTo(0, 0));

  const toggle = page.getByRole("button", { name: "Hide Compass & Waypoint" });
  await toggle.click();
  await expect(page.locator("#conversation-preview-panel")).toBeHidden();
  await expect(page.getByRole("button", { name: "Show Compass & Waypoint" }).first()).toHaveAttribute("aria-expanded", "false");
  await expectNoSidewaysScroll(page);
  await expectChoicesDoNotOverlap(page);
  await page.getByRole("button", { name: "Show Compass & Waypoint" }).first().click();
  await expect(page.locator("#conversation-preview-panel")).toBeVisible();

  const skip = page.getByRole("button", { name: /^Skip to the conversation/ });
  await skip.focus();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expectNothingKept(page, guard);
});

test("opening choices never overlap at 1023, 1024 and 1280 wide", async ({ page, baseURL }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, "runs once, in the wide project");
  const guard = await guardPage(page, baseURL);
  const seen: Record<string, unknown> = {};
  for (const width of [1023, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoSidewaysScroll(page);
    seen[width] = await expectChoicesDoNotOverlap(page);
    if (width === 1024) {
      await page.getByRole("group", { name: "Suggested starting topics" }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: capture("interim-1024-wide-viewport") });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: capture("interim-1024-wide-top-viewport") });
    }
  }
  test.info().annotations.push({ type: "choice-lanes", description: JSON.stringify(seen) });
  console.log(`choice-lanes ${JSON.stringify(seen)}`);
  expect(seen).toMatchObject({ 1023: { columns: 2 }, 1024: { columns: 1 }, 1280: { columns: 2 } });
  await expectNothingKept(page, guard);
});

test("narrow screen: strip, drawer and focus return work without sideways scroll", async ({ page, baseURL }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 1024, "narrow layout only");
  const guard = await guardPage(page, baseURL);
  await expect(page.locator("aside[aria-label='SolMind workspace']")).toBeHidden();
  await expectNoSidewaysScroll(page);
  await expectNoSeriousAxeViolations(page);
  await expect(page.locator("#conversation-preview-panel-toggle")).toBeHidden();
  await expect(page.locator("#conversation-preview-drawer-opener")).toBeVisible();
  await expectSpeakersFollowConstant(page);
  expect(await expectChoicesDoNotOverlap(page)).toMatchObject({ columns: 1 });
  await captureFullPage(page, "interim-narrow-full", "bottom");
  await page.screenshot({ path: capture("interim-narrow-top-viewport") });

  const spaces = page.getByRole("button", { name: "Show conversation spaces" });
  await spaces.click();
  await expect(page.getByRole("list", { name: "Conversation spaces" })).toBeVisible();
  expect(await checkAndUseUnwiredControls(page, "body")).toBe(36);
  await expectTabReachesControls(page);
  await expectNoSidewaysScroll(page);

  const opener = page.locator("#conversation-preview-drawer-opener");
  await opener.focus();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "Compass & Waypoint" });
  await expect(drawer).toBeVisible();
  await expect(page.locator("#conversation-preview-drawer-heading")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(opener).toBeFocused();

  await page.evaluate(() => window.scrollTo(0, 0));
  await opener.click();
  await expect(drawer).toBeVisible();
  await expectNoSeriousAxeViolations(page);
  // A modal drawer is fixed to the screen, so its capture is the screen itself.
  await page.screenshot({ path: capture("interim-narrow-drawer-open-viewport") });
  expect(await checkAndUseUnwiredControls(page, "#conversation-preview-drawer")).toBe(13);
  await drawer.getByRole("button", { name: "Close Compass & Waypoint" }).click();
  await expect(drawer).toBeHidden();
  await expect(opener).toBeFocused();
  await expectNoSidewaysScroll(page);

  // Widening the window while the drawer is open hides its opener; closing then
  // focuses the visible wide-screen panel toggle instead.
  await opener.click();
  await expect(drawer).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(opener).toBeHidden();
  await drawer.getByRole("button", { name: "Close Compass & Waypoint" }).click();
  await expect(drawer).toBeHidden();
  await expect(page.locator("#conversation-preview-panel-toggle")).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectNothingKept(page, guard);
});

// In this preview the composer bar sits in the normal page flow at every width
// (the accepted September screen pins it; pinning returns, sized from the bar's
// real height, when the composer is connected). Tabbing forward from the top of
// the page through the conversation, Shift+Tab back through it, and entering it
// with the skip link must keep every focused control on the screen and, inside
// the transcript, inside its visible area. Sizes cover short portrait and
// landscape phones and the 640-1023px tablet range.
const FOCUS_SIZES = [
  { width: 320, height: 568 },
  { width: 320, height: 844 },
  { width: 360, height: 800 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
];
const COMPOSER_STOPS = ["TEXTAREA", "Pause", "Finish & Review", "Slow down", "Send"];

test("narrow screen: the composer bar is not pinned and focus in the conversation stays on screen", async ({ page, baseURL }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 1024, "narrow layout only");
  expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
  const guard = await guardPage(page, baseURL);
  const problems: string[] = [];
  for (const size of FOCUS_SIZES) {
    const name = `${size.width}x${size.height}`;
    await page.setViewportSize(size);
    await page.goto(ROUTE);
    await expect(page.getByRole("heading", { level: 1, name: "Today's Reflection Journey" })).toBeVisible();
    const walk = await tabThroughConversationControls(page, name !== "390x844" ? undefined : async () => {
      await page.screenshot({ path: capture("interim-narrow-focus-last-transcript-control-viewport") });
    });
    test.info().annotations.push({ type: `focus-in-conversation ${name}`, description: JSON.stringify(walk) });
    const { forward, reverse, ...measured } = walk;
    console.log(`focus-in-conversation ${name} ${JSON.stringify(measured)} forward ${forward.stops.length}+${forward.composer.length} reverse ${reverse.stops.length}+${reverse.composer.length}`);
    expect(["static", "relative"], name).toContain(walk.position);
    expect(walk.scrollY, name).toBe(0);
    expect([walk.count, walk.before], name).toEqual([23, 21]);
    expect(forward.stops.map((stop) => stop.probe), name).toEqual([...Array(23).keys()]);
    expect(reverse.stops.map((stop) => stop.probe), name).toEqual([...Array(23).keys()].reverse());
    expect([forward.stops[0].label, forward.stops[20].label], name).toEqual(["Share whole conversation", "Keep it"]);
    expect(forward.stops.slice(21).map((stop) => stop.label), name).toEqual(["End this conversation", "Continue from this conversation"]);
    expect(forward.composer, name).toEqual(COMPOSER_STOPS);
    expect(reverse.composer, name).toEqual([...COMPOSER_STOPS].reverse());
    problems.push(...focusProblems(name, "Tab", forward), ...focusProblems(name, "Shift+Tab", reverse));

    // Entering the conversation with the skip link puts its heading on screen.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("button", { name: /^Skip to the conversation/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    const title = await page.evaluate(() => {
      const box = document.getElementById("conversation-preview-heading")!.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, height: window.innerHeight };
    });
    if (title.top < -1 || title.bottom > title.height + 1) problems.push(`${name} skip link heading is outside the screen`);
  }
  console.log(`focus-problems ${JSON.stringify(problems)}`);
  expect(problems).toEqual([]);
  await expectNothingKept(page, guard);
});
