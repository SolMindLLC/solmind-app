// The address /explorer opens the Explorer Overview (Paul, decision queue
// 2026-11-04 21:44:03 CST: the June onboarding mockup and the Overview's
// "Design previews" list are removed; the two older design reviews stay
// reachable by address). Without a sign-in the Overview shows its signed-out
// outcome, so this proves the address, not the signed-in Overview.
import { expect, test } from "@playwright/test";

test.use({ trace: "off", screenshot: "off", video: "off" });

test("EA01 /explorer opens the Overview address and shows no mockup", async ({ page }) => {
  const response = await page.goto("/explorer");
  await expect(page).toHaveURL(/\/explorer\/home$/);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Your session ended", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/login/explorer");
  await expect(page.getByText("Design previews", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Onboarding and sharing preview", { exact: true })).toHaveCount(0);
});

test("EA02 the two older design reviews stay reachable by address", async ({ page }) => {
  for (const address of ["/explorer/compass-comparison", "/explorer/conversation-preview"]) {
    const response = await page.goto(address);
    expect(response?.status(), address).toBe(200);
    await expect(page, address).toHaveURL(new RegExp(`${address}$`));
    await expect(page.getByRole("main").first(), address).toBeVisible();
  }
});
