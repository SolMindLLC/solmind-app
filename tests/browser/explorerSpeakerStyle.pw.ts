// Logo speaker labels on the accepted September screen and the interim
// conversation screen: the September screen follows SPEAKER_LABEL_STYLE, and
// close-ups at three times the pixel density let the small icons be judged.
import { expect, test } from "@playwright/test";

import {
  ROUTE, SEPTEMBER_ROUTE, SPEAKER_LABEL_STYLE, capture, captureFullPage, expectNoSidewaysScroll, expectNothingKept,
  expectSpeakersFollowConstant, guardPage,
} from "./conversationPreviewHelpers";

test.use({ trace: "off", screenshot: "off", video: "off" });

const CONSTANT_NAME = SPEAKER_LABEL_STYLE === "logo" ? "new" : "original";

test("speaker label close-ups on both screens", async ({ browser, baseURL }) => {
  test.skip(test.info().project.name !== "desktop-chromium", "runs once, in the wide project");
  for (const [route, name] of [[ROUTE, "interim"], [SEPTEMBER_ROUTE, "september"]] as const) {
    const context = await browser.newContext({ deviceScaleFactor: 3, viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const guard = await guardPage(page, baseURL, route);
    // The interim screen can show both styles; the September screen shows the constant's.
    const styles = route === ROUTE ? ["New", "Original"] : [CONSTANT_NAME];
    for (const style of styles) {
      if (route === ROUTE) await page.getByRole("group", { name: "Speaker labels:" }).getByRole("button", { name: style }).click();
      for (const turn of ["1", "2"]) {
        const label = page.locator(`article p[id$='turn-${turn}-speaker']`);
        await label.scrollIntoViewIfNeeded();
        await label.screenshot({ path: capture(`${name}-speaker-closeup-${style.toLowerCase()}-turn${turn}`) });
      }
    }
    expect(guard.blocked).toEqual([]);
    expect(guard.errors).toEqual([]);
    await context.close();
  }
});

test("September screen: speaker labels follow the constant and nothing else changes", async ({ page, baseURL }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, "wide layout only");
  const guard = await guardPage(page, baseURL, SEPTEMBER_ROUTE);
  await expectSpeakersFollowConstant(page);
  await expect(page.getByText("Mary (Virtual Guide)").first()).toBeVisible();
  await expectNoSidewaysScroll(page);
  await page.screenshot({ path: capture(`september-compass-comparison-${CONSTANT_NAME}-viewport`) });
  await captureFullPage(page, `september-compass-comparison-${CONSTANT_NAME}-full`, "top");
  await expectNothingKept(page, guard, SEPTEMBER_ROUTE);
});
