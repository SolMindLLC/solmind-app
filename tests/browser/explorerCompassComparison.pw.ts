import { expect, test } from "@playwright/test";

import { guardPage, SEPTEMBER_ROUTE } from "./conversationPreviewHelpers";

test("widening after an intervening render restores drawer focus to the toggle", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const matchMedia = window.matchMedia.bind(window);
    const layout = matchMedia("(min-width: 64rem)");
    // Allow matches to change, but deliver the notification after a React commit.
    layout.addEventListener("change", event => {
      if (event.isTrusted) event.stopImmediatePropagation();
    });
    window.matchMedia = query => query === layout.media ? layout : matchMedia(query);
  });
  await guardPage(page, baseURL, SEPTEMBER_ROUTE);
  const toggle = page.locator("#compass-waypoint-toggle");
  await expect(toggle).toHaveAttribute("aria-haspopup", "dialog");
  // The browser's own dialog focus return would go to the composer.
  await page.locator("#journey-composer").focus();
  await toggle.dispatchEvent("click");
  await expect(page.locator("#compass-waypoint-drawer-heading")).toBeFocused();

  await page.setViewportSize({ width: 1280, height: 900 });
  const menu = page.locator("#explorer-menu-button");
  await menu.dispatchEvent("click");
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await page.evaluate(() => {
    const layout = window.matchMedia("(min-width: 64rem)");
    layout.dispatchEvent(new MediaQueryListEvent("change", { matches: layout.matches }));
  });

  await expect(page.locator("#compass-waypoint-drawer")).toHaveCount(0);
  await expect(toggle).toBeFocused();
});
