// Real public-page hydration/navigation only; no sign-in, Send, database or provider proof.
import { test, expect } from "@playwright/test";
test.use({ trace: "off", screenshot: "off", video: "off" });
test("local-address warning hydrates and deliberately links every fixed role without authentication", async ({ page }) => {
  const port = process.env.SOLMIND_BROWSER_TEST_PORT;
  if (!port) throw new Error("owned_test_port_required");
  let authRequests = 0;
  page.on("request", request => { if (/\/login\/(explorer|guide|admin)\/(send|verify)$/.test(new URL(request.url()).pathname)) authRequests++; });
  for (const role of ["explorer", "guide", "admin"]) {
    await page.goto(`http://localhost:${port}/login/${role}`);
    const link = page.getByRole("link", { name: "Use the configured sign-in address", exact: true });
    await expect(link).toBeVisible();
    await expect(page.getByRole("note")).toContainText("localhost and 127.0.0.1 keep separate sign-ins. Use the configured SolMind address.");
    await expect(link).toHaveAttribute("href", `http://127.0.0.1:${port}/login/${role}`);
    await link.click();
    await expect(page).toHaveURL(`http://127.0.0.1:${port}/login/${role}`);
    await expect(page.getByRole("link", { name: "Use the configured sign-in address", exact: true })).toHaveCount(0);
  }
  expect(authRequests).toBe(0);
});
