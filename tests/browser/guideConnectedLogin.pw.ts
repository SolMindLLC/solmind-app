// Mounted UI proof with synthetic intercepted replies only. The navigation
// marker never establishes provider authentication or protected-home access.
import { expect, test } from "@playwright/test";

test.use({ trace: "off", screenshot: "off", video: "off" });
const SELECTOR = "10000000-0000-4000-8000-000000000001";
const EMAIL = "mounted-guide@example.invalid";
const PASSWORD = "  synthetic-mounted-password  ";
const CODE = "123456";

test("Guide keeps the same code after refusal and sends the unchanged password only on verify", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("missing_test_origin");
  const origin = new URL(baseURL).origin;
  let sends = 0; let verifies = 0; let exact = true; let unexpected = 0;
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) { unexpected += 1; return route.abort(); }
    if (url.pathname === "/login/guide/send") {
      sends += 1;
      exact &&= request.method() === "POST" && url.search === "" && request.postData() === JSON.stringify({ identifier: EMAIL });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ acknowledgment: "verification_code_requested", challengeId: SELECTOR }) });
    }
    if (url.pathname === "/login/guide/verify") {
      verifies += 1;
      exact &&= request.method() === "POST" && url.search === "" && request.postData() === JSON.stringify({ identifier: EMAIL, password: PASSWORD, challengeId: SELECTOR, code: CODE });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(verifies === 1 ? { outcome: "not_matched" } : { outcome: "signed_in", destination: "/guide/home" }) });
    }
    if (url.pathname === "/guide/home") return route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Fixed Guide navigation observed; authorization not tested</h1>" });
    if (request.method() !== "GET" && request.method() !== "HEAD") { unexpected += 1; return route.abort(); }
    return route.continue();
  });
  await page.goto("/login/guide");
  await page.getByLabel("Email", { exact: true }).fill(EMAIL);
  const password = page.getByLabel("Password", { exact: true });
  await password.fill(PASSWORD);
  await page.getByRole("button", { name: "Send my code", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your email", exact: true })).toBeFocused();
  expect(await password.inputValue() === PASSWORD, "password field persists locally across code request").toBe(true);
  const code = page.getByLabel("Your code", { exact: true });
  await code.fill(CODE);
  await page.getByRole("button", { name: "Verify and sign in", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Couldn't sign you in. Check your password and latest code, or try again later.");
  expect(await code.inputValue() === CODE && await password.inputValue() === PASSWORD, "refusal preserves the current inputs").toBe(true);
  await page.getByRole("button", { name: "Verify and sign in", exact: true }).click();
  await page.waitForURL(`${origin}/guide/home`);
  expect(exact && sends === 1 && verifies === 2 && unexpected === 0, "only the exact Guide requests were made").toBe(true);
  await expect(page.getByRole("heading", { name: "Fixed Guide navigation observed; authorization not tested" })).toBeVisible();
});

test("Guide role departure clears password and code before another role can mount", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("missing_test_origin");
  const origin = new URL(baseURL).origin;
  let effects = 0;
  await page.route("**/*", async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === "/login/guide/send" && request.method() === "POST") {
      effects += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ acknowledgment: "verification_code_requested", challengeId: SELECTOR }) });
    }
    if (request.method() !== "GET" && request.method() !== "HEAD") { effects += 1; return route.abort(); }
    return route.continue();
  });
  await page.goto("/login");
  await page.getByRole("button", { name: /I'm a Guide/ }).click();
  await page.getByLabel("Email", { exact: true }).fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Send my code", exact: true }).click();
  await page.getByLabel("Your code", { exact: true }).fill(CODE);
  await page.getByRole("button", { name: "Choose a different role", exact: true }).click();
  await page.getByRole("button", { name: /I'm a Guide/ }).click();
  expect(await page.getByLabel("Password", { exact: true }).inputValue() === "", "fresh Guide view has no password").toBe(true);
  expect(await page.getByLabel("Email", { exact: true }).inputValue() === "", "fresh Guide view has no old account selector").toBe(true);
  await expect(page.getByLabel("Your code", { exact: true })).toHaveCount(0);
  expect(effects === 1, "departure performs no verification or other write").toBe(true);
});
