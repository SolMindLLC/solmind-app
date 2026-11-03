// Mounted UI checks with synthetic intercepted replies only. Every sign-in
// response and the fixed home marker are mocked. No provider authentication,
// cookie release, protected-home authorization, database effect or logout proof.
// The Admin screens are Paul's approved A3A and A4, drawn through the shared view.
import { expect, test, type Page } from "@playwright/test";

test.use({ trace: "off", screenshot: "off", video: "off" });
const IDENTIFIER_LABEL = "Email, or the Admin username";
const PASSWORD = "  synthetic-mounted-password  ";
const CODE = "123456";
const NEW_CODE = "654321";
const NOT_MATCHED = "Couldn't sign you in. Check your password and latest code. You can request a new code or try again later.";
const HELP_LINE = "To re-enter your password, choose 'Use a different email'.";
const HOME_MARKER = "Fixed Admin navigation observed; authorization not tested";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const cases = [
  { name: "email", identifier: "mounted-admin@example.invalid", shown: "mounted-admin@example.invalid" },
  { name: "restricted username", identifier: " Mounted.Admin_01-2 ", shown: "your email" },
] as const;

type Seen = { sends: Array<Record<string, unknown>>; verifies: Array<Record<string, unknown>>; unexpected: number };

async function mockAdmin(page: Page, origin: string, verifyReplies: ReadonlyArray<Record<string, unknown>>): Promise<Seen> {
  const seen: Seen = { sends: [], verifies: [], unexpected: 0 };
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) { seen.unexpected += 1; return route.abort(); }
    if (url.pathname === "/login/admin/send") {
      const body = JSON.parse(request.postData() ?? "null") as Record<string, unknown>;
      seen.sends.push(body);
      if (request.method() !== "POST" || url.search !== "") seen.unexpected += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ acknowledgment: "verification_code_requested", flowId: body.flowId }) });
    }
    if (url.pathname === "/login/admin/verify") {
      const body = JSON.parse(request.postData() ?? "null") as Record<string, unknown>;
      seen.verifies.push(body);
      if (request.method() !== "POST" || url.search !== "") seen.unexpected += 1;
      const reply = verifyReplies[seen.verifies.length - 1] ?? { outcome: "signed_in", destination: "/admin/home" };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reply) });
    }
    if (url.pathname === "/admin/home") {
      if (request.method() !== "GET" || url.search !== "") seen.unexpected += 1;
      return route.fulfill({ status: 200, contentType: "text/html", body: `<h1>${HOME_MARKER}</h1>` });
    }
    if (request.method() !== "GET" && request.method() !== "HEAD") { seen.unexpected += 1; return route.abort(); }
    return route.continue();
  });
  return seen;
}

for (const entry of cases) {
  test(`Admin ${entry.name}: approved A3A, neutral A4 wording, the held raw password and one fixed navigation`, async ({ page, baseURL }) => {
    if (!baseURL) throw new Error("missing_test_origin");
    const origin = new URL(baseURL).origin;
    const seen = await mockAdmin(page, origin, [{ outcome: "not_matched" }]);
    await page.goto("/login/admin");
    await expect(page.getByText("Signing in as the Admin", { exact: true })).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    const identifier = page.getByLabel(IDENTIFIER_LABEL, { exact: true });
    await expect(identifier).toHaveAttribute("type", "text");
    await expect(identifier).toHaveAttribute("maxlength", "512");
    await identifier.fill(entry.identifier);
    const password = page.getByLabel("Password", { exact: true });
    await password.fill(PASSWORD);
    await expect(page.getByRole("button", { name: "Show password", exact: true })).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "Show password", exact: true }).click();
    await expect(page.getByRole("button", { name: "Hide password", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password", exact: true }).click();
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Send my code", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Check your email", exact: true })).toBeFocused();
    await expect(page.getByText(`Check ${entry.shown} for a sign-in code. If one arrives, enter the latest code below.`, { exact: true })).toBeVisible();
    // Settled on A4 after a requested code: no status and no help line before any refusal.
    await expect(page.getByRole("status")).toBeEmpty();
    await expect(page.getByText(HELP_LINE, { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
    const code = page.getByLabel("Your code", { exact: true });
    await page.getByRole("button", { name: "Verify and sign in", exact: true }).click();
    expect(seen.verifies.length === 0, "an empty code sends nothing").toBe(true);
    await code.fill(CODE);
    await page.getByRole("button", { name: "Verify and sign in", exact: true }).click();
    await expect(page.getByText(NOT_MATCHED, { exact: true })).toBeVisible();
    await expect(page.getByRole("status").getByText(HELP_LINE, { exact: true })).toBeVisible();
    expect(await code.inputValue() === CODE, "a refusal keeps the code").toBe(true);
    expect(!(await page.content()).includes(PASSWORD.trim()), "the held password is not in the page").toBe(true);
    await page.getByRole("button", { name: "Send a new code", exact: true }).click();
    await expect.poll(() => seen.sends.length).toBe(2);
    // The status empties only once the new-code request has settled successfully.
    await expect(page.getByRole("status")).toBeEmpty();
    await expect(page.getByText(HELP_LINE, { exact: true })).toHaveCount(0);
    await code.fill(NEW_CODE);
    await page.getByRole("button", { name: "Verify and sign in", exact: true }).click();
    await page.waitForURL(`${origin}/admin/home`);
    await expect(page.getByRole("heading", { name: HOME_MARKER, exact: true })).toBeVisible();
    const flowId = seen.sends[0]?.flowId;
    expect(typeof flowId === "string" && UUID.test(flowId), "lowercase flow id").toBe(true);
    expect(JSON.stringify(seen.sends) === JSON.stringify([{ identifier: entry.identifier, flowId }, { identifier: entry.identifier, flowId }]), "send carries no password; resend keeps the flow").toBe(true);
    expect(JSON.stringify(seen.verifies) === JSON.stringify([
      { identifier: entry.identifier, password: PASSWORD, flowId, code: CODE },
      { identifier: entry.identifier, password: PASSWORD, flowId, code: NEW_CODE },
    ]), "verify carries the unchanged held password across a refusal and a new code").toBe(true);
    expect(seen.unexpected === 0, "only the exact fixed Admin requests were made").toBe(true);
  });
}

test("Admin: after a refusal the help line names Use a different email, which returns to an empty A3A", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("missing_test_origin");
  const origin = new URL(baseURL).origin;
  const seen = await mockAdmin(page, origin, [{ outcome: "not_matched" }]);
  await page.goto("/login/admin");
  await page.getByLabel(IDENTIFIER_LABEL, { exact: true }).fill(" Mounted.Admin_01-2 ");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Send my code", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your email", exact: true })).toBeFocused();
  const status = page.getByRole("status");
  await expect(status).toBeEmpty();
  await page.getByLabel("Your code", { exact: true }).fill(CODE);
  await page.getByRole("button", { name: "Verify and sign in", exact: true }).click();
  await expect(status).toHaveText(`${NOT_MATCHED}${HELP_LINE}`);
  await page.getByRole("button", { name: "Use a different email", exact: true }).click();
  await expect(page.getByText(HELP_LINE, { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Your code", { exact: true })).toHaveCount(0);
  expect(await page.getByLabel(IDENTIFIER_LABEL, { exact: true }).inputValue() === "" && await page.getByLabel("Password", { exact: true }).inputValue() === "", "the help line's button starts the Admin sign-in again, empty").toBe(true);
  expect(seen.verifies.length === 1 && seen.unexpected === 0, "one verify, and only the exact fixed Admin requests").toBe(true);
});

test("Admin role departure clears identifier, password, code and shown-password state before re-entry", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("missing_test_origin");
  const origin = new URL(baseURL).origin;
  const identifierValue = " Mounted.Admin_01-2 ";
  const seen = await mockAdmin(page, origin, []);
  await page.goto("/login");
  await page.getByRole("button", { name: /I'm the Admin/ }).click();
  await page.getByLabel(IDENTIFIER_LABEL, { exact: true }).fill(identifierValue);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await page.getByRole("button", { name: "Send my code", exact: true }).click();
  await page.getByLabel("Your code", { exact: true }).fill(CODE);
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
  expect(seen.sends.length === 1 && seen.verifies.length === 0 && seen.unexpected === 0, "role departure causes no verify or other write").toBe(true);
});
