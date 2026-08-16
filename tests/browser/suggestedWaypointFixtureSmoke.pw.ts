import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const expectNoSeriousAxeViolations = async (page: Page) => {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const seriousViolations = result.violations
    .filter((violation) =>
      violation.impact === "serious" || violation.impact === "critical",
    )
    .map(({ id, impact, help, nodes }) => ({
      id,
      impact,
      help,
      targets: nodes.map((node) => node.target),
    }));

  expect(seriousViolations).toEqual([]);
};

const captureBrowserErrors = (page: Page) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  return () => {
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  };
};

const verifyResponsiveNavigation = async (
  page: Page,
  navigationName: "Explorer navigation" | "Guide navigation",
) => {
  const navigation = page.getByRole("navigation", { name: navigationName });
  const viewport = page.viewportSize();

  if (viewport && viewport.width < 1024) {
    const openMenu = page.getByRole("button", { name: "Open menu" });
    await openMenu.focus();
    await expect(openMenu).toBeFocused();
    await page.keyboard.press("Enter");

    const closeMenu = page.getByRole("button", { name: "Close menu" });
    await expect(closeMenu).toBeFocused();
    await expect(navigation).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(navigation.getByRole("link").first()).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(closeMenu).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
    await expect(navigation).toBeHidden();
    return;
  }

  await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
  await expect(navigation).toBeVisible();
};

test.describe("deterministic Guide Suggested Waypoint review surface", () => {
  test("Guide opens a draft by keyboard and receives a no-effect live-region update", async ({
    page,
  }) => {
    const expectNoBrowserErrors = captureBrowserErrors(page);
    await page.goto("/guide/explorers/avery/waypoint-suggestions");

    await expect(
      page.getByRole("heading", { name: "Waypoint Suggestions" }),
    ).toBeVisible();
    await verifyResponsiveNavigation(page, "Guide navigation");

    const draftRow = page
      .getByRole("button")
      .filter({ hasText: "Avery cannot see this draft" })
      .first();
    await draftRow.focus();
    await expect(draftRow).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(
      page.getByRole("heading", {
        name: "Protect one evening each week for recovery",
      }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toContainText(
      "Opened the selected local preview. No message or notification was sent.",
    );
    await expectNoSeriousAxeViolations(page);
    expectNoBrowserErrors();
  });
});
