// Mounted UI checks with synthetic intercepted replies only. Every sign-in
// response and the fixed home marker are mocked. No provider authentication,
// cookie release, protected-home authorization, database effect or logout proof.
import { expect, test } from "@playwright/test";

test.use({ trace: "off", screenshot: "off", video: "off" });
const SELECTOR = "10000000-0000-4000-8000-000000000001";
const IDENTIFIER_LABEL = "Email, or the Admin username";
const INITIAL_PASSWORD = "  synthetic-mounted-initial-password  ";
const LATEST_PASSWORD = "  synthetic-mounted-replacement-password  ";
const CODE = "123456";
const HOME_MARKER = "Fixed Admin navigation observed; authorization not tested";
const cases = [
  { name: "email", identifier: "mounted-admin@example.invalid", shown: "mounted-admin@example.invalid" },
  { name: "restricted username", identifier: " Mounted.Admin_01-2 ", shown: "your email" },
] as const;

for (const entry of cases) {
  test(`Admin ${entry.name} uses neutral code wording, the latest raw password and one fixed navigation`, async ({ page, baseURL }) => {
    if (!baseURL) throw new Error("missing_test_origin");
    const origin = new URL(baseURL).origin;
    let sends = 0; let verifies = 0; let exact = true; let unexpected = 0;
    await page.route("**/*", async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin) { unexpected += 1; return route.abort(); }
      if (url.pathname === "/login/admin/send") {
        sends += 1;
        exact &&= request.method() === "POST" && url.search === "" && request.postData() === JSON.stringify({ identifier: entry.identifier });
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ acknowledgment: "verification_code_requested", challengeId: SELECTOR }) });
      }
      if (url.pathname === "/login/admin/verify") {
        verifies += 1;
        exact &&= request.method() === "POST" && url.search === "" && request.postData() === JSON.stringify({ identifier: entry.identifier, password: LATEST_PASSWORD, challengeId: SELECTOR, code: CODE });
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(verifies === 1 ? { outcome: "not_matched" } : { outcome: "signed_in", destination: "/admin/home" }) });
      }
      if (url.pathname === "/admin/home") {
        exact &&= request.method() === "GET" && url.search === "";
        return route.fulfill({ status: 200, contentType: "text/html", body: `<h1>${HOME_MARKER}</h1>` });
      }
      if (request.method() !== "GET" && request.method() !== "HEAD") { unexpected += 1; return route.abort(); }
      return route.continue();
    });
    await page.goto("/login/admin");
    const identifier = page.getByLabel(IDENTIFIER_LABEL, { exact: true });
    await expect(identifier).toHaveAttribute("type", "text");
    await expect(identifier).toHaveAttribute("maxlength", "512");
    await identifier.fill(entry.identifier);
    const password = page.getByLabel("Password", { exact: true });
    await password.fill(INITIAL_PASSWORD);
    await page.getByRole("button", { name: "Send my code", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Check your email", exact: true })).toBeFocused();
    await expect(page.getByText(`If ${entry.shown} can receive a code, we've sent one. It works once and expires in 10 minutes.`, { exact: true })).toBeVisible();
    expect(await password.inputValue() === INITIAL_PASSWORD, "password remains only in its current input after send").toBe(true);
    // A new edit after send must be read at verify, without a retained first value.
    await password.fill(LATEST_PASSWORD);
    const code = page.getByLabel("Your code", { exact: true });
    await code.fill(CODE);
    await page.getByRole("button", { name: "Verify and sign in", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Couldn't sign you in. Check your password and latest code, or try again later.");
    expect(await code.inputValue() === CODE && await password.inputValue() === LATEST_PASSWORD && await identifier.inputValue() === entry.identifier, "a refusal preserves the current raw inputs").toBe(true);
    await page.getByRole("button", { name: "Verify and sign in", exact: true }).click();
    await page.waitForURL(`${origin}/admin/home`);
    expect(exact && sends === 1 && verifies === 2 && unexpected === 0, "only the exact fixed Admin requests were made").toBe(true);
    await expect(page.getByRole("heading", { name: HOME_MARKER, exact: true })).toBeVisible();
  });
}

test("Admin role departure clears identifier, password, code and shown-password state before re-entry", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("missing_test_origin");
  const origin = new URL(baseURL).origin;
  const identifierValue = " Mounted.Admin_01-2 ";
  let sends = 0; let unexpected = 0; let exact = true;
  await page.route("**/*", async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.origin !== origin) { unexpected += 1; return route.abort(); }
    if (url.pathname === "/login/admin/send") {
      sends += 1;
      exact &&= request.method() === "POST" && url.search === "" && request.postData() === JSON.stringify({ identifier: identifierValue });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ acknowledgment: "verification_code_requested", challengeId: SELECTOR }) });
    }
    if (request.method() !== "GET" && request.method() !== "HEAD") { unexpected += 1; return route.abort(); }
    return route.continue();
  });
  await page.goto("/login");
  await page.getByRole("button", { name: /I'm the Admin/ }).click();
  await page.getByLabel(IDENTIFIER_LABEL, { exact: true }).fill(identifierValue);
  await page.getByLabel("Password", { exact: true }).fill(INITIAL_PASSWORD);
  await page.getByRole("button", { name: "Send my code", exact: true }).click();
  await page.getByLabel("Your code", { exact: true }).fill(CODE);
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await page.getByRole("button", { name: "Choose a different role", exact: true }).click();
  await page.getByRole("button", { name: /I'm a Guide/ }).click();
  expect(await page.getByLabel("Email", { exact: true }).inputValue() === "" && await page.getByLabel("Password", { exact: true }).inputValue() === "", "a different role receives no Admin drafts").toBe(true);
  await expect(page.getByLabel("Your code", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Choose a different role", exact: true }).click();
  await page.getByRole("button", { name: /I'm the Admin/ }).click();
  const password = page.getByLabel("Password", { exact: true });
  expect(await password.inputValue() === "" && await page.getByLabel(IDENTIFIER_LABEL, { exact: true }).inputValue() === "", "a fresh Admin view contains no prior credentials or identifier").toBe(true);
  await expect(password).toHaveAttribute("type", "password");
  await expect(page.getByRole("button", { name: "Show password", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByLabel("Your code", { exact: true })).toHaveCount(0);
  expect(exact && sends === 1 && unexpected === 0, "role departure causes no verify or other write").toBe(true);
});
