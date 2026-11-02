// Mounted UI proof with synthetic intercepted replies only. The navigation
// marker never establishes provider authentication or protected-home access.
// The Guide screens are Paul's approved A3 and A4, drawn through the shared view.
import { expect, test, type Page } from "@playwright/test";

test.use({ trace: "off", screenshot: "off", video: "off" });
const EMAIL = "mounted-guide@example.invalid";
const OTHER_EMAIL = "mounted-other-guide@example.invalid";
const PASSWORD = "  synthetic-mounted-password  ";
const REPLACEMENT_PASSWORD = "  synthetic-mounted-replacement  ";
const CODE = "123456";
const NEW_CODE = "654321";
const NOT_MATCHED = "Couldn't sign you in. Check your password and latest code. You can request a new code or try again later.";
const HOME_MARKER = "Fixed Guide navigation observed; authorization not tested";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Seen = { sends: Array<Record<string, unknown>>; verifies: Array<Record<string, unknown>>; unexpected: number };

async function mockGuide(page: Page, origin: string, verifyReplies: ReadonlyArray<Record<string, unknown>>): Promise<Seen> {
  const seen: Seen = { sends: [], verifies: [], unexpected: 0 };
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) { seen.unexpected += 1; return route.abort(); }
    if (url.pathname === "/login/guide/send") {
      const body = JSON.parse(request.postData() ?? "null") as Record<string, unknown>;
      seen.sends.push(body);
      if (request.method() !== "POST" || url.search !== "") seen.unexpected += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ acknowledgment: "verification_code_requested", flowId: body.flowId }) });
    }
    if (url.pathname === "/login/guide/verify") {
      const body = JSON.parse(request.postData() ?? "null") as Record<string, unknown>;
      seen.verifies.push(body);
      if (request.method() !== "POST" || url.search !== "") seen.unexpected += 1;
      const reply = verifyReplies[seen.verifies.length - 1] ?? { outcome: "signed_in", destination: "/guide/home" };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reply) });
    }
    if (url.pathname === "/guide/home") return route.fulfill({ status: 200, contentType: "text/html", body: `<h1>${HOME_MARKER}</h1>` });
    if (request.method() !== "GET" && request.method() !== "HEAD") { seen.unexpected += 1; return route.abort(); }
    return route.continue();
  });
  return seen;
}

test("Guide A3 shows the approved parts, A4 has no password field, and the held password is sent only on verify, across a refusal and a new code", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("missing_test_origin");
  const origin = new URL(baseURL).origin;
  const seen = await mockGuide(page, origin, [{ outcome: "not_matched" }]);
  await page.goto("/login/guide");
  await expect(page.getByText("Signing in as a Guide", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  for (const [label, note] of [
    ["Forgot your password?", "Password reset is not set up yet."],
    ["Use a verified phone number instead", "Phone sign-in comes later. The first demo uses emailed codes only."],
    ["Need help?", "Help is not set up yet."],
  ] as const) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByText(note, { exact: true })).toBeVisible();
  }
  await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("type", "email");
  await page.getByLabel("Email", { exact: true }).fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Send my code", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your email", exact: true })).toBeFocused();
  await expect(page.getByText(`Check ${EMAIL} for a sign-in code. If one arrives, enter the latest code below.`, { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  const traces = await page.evaluate(() => JSON.stringify([location.href, history.state, Object.entries(localStorage), Object.entries(sessionStorage), document.documentElement.outerHTML]));
  const cookies = JSON.stringify(await page.context().cookies());
  expect(!traces.includes(PASSWORD.trim()) && !cookies.includes(PASSWORD.trim()), "the held password is not in the page, its address, history, browser storage or cookies").toBe(true);
  const code = page.getByLabel("Your code", { exact: true });
  await code.fill(CODE);
  await page.getByRole("button", { name: "Verify and sign in", exact: true }).click();
  await expect(page.getByText(NOT_MATCHED, { exact: true })).toBeVisible();
  expect(await code.inputValue() === CODE, "a refusal keeps the code").toBe(true);
  expect(!(await page.content()).includes(PASSWORD.trim()), "still nothing in the page after a refusal").toBe(true);
  await page.getByRole("button", { name: "Send a new code", exact: true }).click();
  await expect.poll(() => seen.sends.length).toBe(2);
  await code.fill(NEW_CODE);
  await page.getByRole("button", { name: "Verify and sign in", exact: true }).click();
  await page.waitForURL(`${origin}/guide/home`);
  await expect(page.getByRole("heading", { name: HOME_MARKER, exact: true })).toBeVisible();
  const flowId = seen.sends[0]?.flowId;
  expect(typeof flowId === "string" && UUID.test(flowId), "lowercase flow id").toBe(true);
  expect(seen.sends.every(body => JSON.stringify(body) === JSON.stringify({ identifier: EMAIL, flowId })), "send never carries the password; resend keeps the flow").toBe(true);
  expect(JSON.stringify(seen.verifies) === JSON.stringify([
    { identifier: EMAIL, password: PASSWORD, flowId, code: CODE },
    { identifier: EMAIL, password: PASSWORD, flowId, code: NEW_CODE },
  ]), "verify carries the unchanged held password").toBe(true);
  expect(seen.unexpected === 0, "only the exact Guide requests were made").toBe(true);
});

// Clearing the privately held password itself is checked by reading PasswordRoleSignInView; these browser
// tests show the observable results: empty fields, retired attempts and only newly typed values sent.
test("After leaving the Guide sign-in or choosing a different email, the screen starts empty and only the newly typed identifier and password are sent", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("missing_test_origin");
  const origin = new URL(baseURL).origin;
  const seen = await mockGuide(page, origin, []);
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
  expect(seen.sends.length === 1 && seen.verifies.length === 0, "departure performs no verification").toBe(true);

  await page.getByLabel("Email", { exact: true }).fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Send my code", exact: true }).click();
  await page.getByRole("button", { name: "Use a different email", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeFocused();
  expect(await page.getByLabel("Email", { exact: true }).inputValue() === "" && await page.getByLabel("Password", { exact: true }).inputValue() === "", "a different email starts empty").toBe(true);
  await page.getByLabel("Email", { exact: true }).fill(OTHER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(REPLACEMENT_PASSWORD);
  await page.getByRole("button", { name: "Send my code", exact: true }).click();
  await page.getByLabel("Your code", { exact: true }).fill(CODE);
  await page.getByRole("button", { name: "Verify and sign in", exact: true }).click();
  await page.waitForURL(`${origin}/guide/home`);
  expect(seen.verifies.length === 1 && JSON.stringify(seen.verifies[0]) === JSON.stringify({ identifier: OTHER_EMAIL, password: REPLACEMENT_PASSWORD, flowId: seen.sends[2]?.flowId, code: CODE }), "only the new identifier and newly typed password are sent").toBe(true);
  expect(seen.sends.length === 3 && seen.sends[2]?.flowId !== seen.sends[1]?.flowId, "a different email starts a new flow").toBe(true);
  expect(seen.unexpected === 0, "only the exact Guide requests were made").toBe(true);
});

test("A failed code request leaves the password field empty, and the next attempt sends only the newly typed password", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("missing_test_origin");
  const origin = new URL(baseURL).origin;
  let abortFirstSend = true;
  const seen: Seen = { sends: [], verifies: [], unexpected: 0 };
  await page.route("**/login/guide/send", async route => {
    seen.sends.push(JSON.parse(route.request().postData() ?? "null") as Record<string, unknown>);
    if (abortFirstSend) { abortFirstSend = false; return route.abort(); }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ acknowledgment: "verification_code_requested", flowId: seen.sends.at(-1)?.flowId }) });
  });
  await page.route("**/login/guide/verify", async route => {
    seen.verifies.push(JSON.parse(route.request().postData() ?? "null") as Record<string, unknown>);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ outcome: "signed_in", destination: "/guide/home" }) });
  });
  await page.route("**/guide/home", route => route.fulfill({ status: 200, contentType: "text/html", body: `<h1>${HOME_MARKER}</h1>` }));
  await page.goto("/login/guide");
  const password = page.getByLabel("Password", { exact: true });
  await page.getByLabel("Email", { exact: true }).fill(EMAIL);
  await password.fill(PASSWORD);
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await page.getByRole("button", { name: "Send my code", exact: true }).click();
  await expect(page.getByText("We couldn't confirm sign-in. Please try signing in again.", { exact: true })).toBeVisible();
  expect(await password.inputValue() === "", "the failed send leaves no password in the field").toBe(true);
  await expect(password).toHaveAttribute("type", "password");
  await page.getByLabel("Password", { exact: true }).fill(REPLACEMENT_PASSWORD);
  await page.getByRole("button", { name: "Send my code", exact: true }).click();
  await page.getByLabel("Your code", { exact: true }).fill(CODE);
  await page.getByRole("button", { name: "Verify and sign in", exact: true }).click();
  await page.waitForURL(`${origin}/guide/home`);
  expect(seen.sends.length === 2 && seen.sends.every(body => !("password" in body)), "sends never carry a password").toBe(true);
  expect(seen.verifies.length === 1 && seen.verifies[0]?.password === REPLACEMENT_PASSWORD, "the old password is never reused").toBe(true);
});

test("An identifier edit empties the password field, and an empty code never sends the password", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("missing_test_origin");
  const origin = new URL(baseURL).origin;
  const seen = await mockGuide(page, origin, []);
  await page.goto("/login/guide");
  const password = page.getByLabel("Password", { exact: true });
  await page.getByLabel("Email", { exact: true }).fill(EMAIL);
  await password.fill(PASSWORD);
  await page.getByLabel("Email", { exact: true }).fill(OTHER_EMAIL);
  expect(await password.inputValue() === "", "an identifier edit clears the password").toBe(true);
  await password.fill(PASSWORD);
  await page.getByRole("button", { name: "Send my code", exact: true }).click();
  const verify = page.getByRole("button", { name: "Verify and sign in", exact: true });
  await verify.click();
  // With the browser's own required-field check switched off, the view's guard alone must refuse.
  await page.evaluate(() => { for (const form of Array.from(document.forms)) form.noValidate = true; });
  await verify.click();
  await page.getByRole("button", { name: "Send a new code", exact: true }).click();
  await expect.poll(() => seen.sends.length).toBe(2);
  await verify.click();
  await expect(page.getByLabel("Your code", { exact: true })).toHaveValue("");
  expect(seen.verifies.length === 0, "an empty code sends nothing").toBe(true);
  expect(seen.unexpected === 0, "only the exact Guide requests were made").toBe(true);
});

test("Leaving the page on the code screen retires the attempt so nothing can be verified; a departure while a code request is pending leaves nothing behind", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("missing_test_origin");
  const origin = new URL(baseURL).origin;
  const seen = await mockGuide(page, origin, []);
  await page.goto("/login/guide");
  await page.getByLabel("Email", { exact: true }).fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Send my code", exact: true }).click();
  await page.getByLabel("Your code", { exact: true }).fill(CODE);
  await page.evaluate(() => { window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })); });
  // The attempt is retired: the code screen is gone and nothing can be sent.
  await expect(page.getByLabel("Your code", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send my code", exact: true })).toBeDisabled();
  expect(await page.getByLabel("Password", { exact: true }).inputValue() === "", "no password remains on the page").toBe(true);
  expect(seen.verifies.length === 0, "nothing is verified after the page is left").toBe(true);

  await page.unroute("**/*");
  let release: () => void = () => undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let lateSends = 0;
  let lateOther = 0;
  let lateSettled = false;
  await page.route("**/*", async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.origin !== origin) { lateOther += 1; return route.abort(); }
    if (url.pathname === "/login/guide/send") {
      lateSends += 1;
      const body = JSON.parse(request.postData() ?? "null") as Record<string, unknown>;
      await gate;
      // The departed attempt may already have cancelled the request; either way it is settled here.
      try {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ acknowledgment: "verification_code_requested", flowId: body.flowId }) });
      } catch { /* cancelled by the departed attempt */ } finally { lateSettled = true; }
      return;
    }
    if (request.method() !== "GET" && request.method() !== "HEAD") { lateOther += 1; return route.abort(); }
    return route.continue();
  });
  await page.goto("/login");
  await page.getByRole("button", { name: /I'm a Guide/ }).click();
  await page.getByLabel("Email", { exact: true }).fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Send my code", exact: true }).click();
  await expect.poll(() => lateSends).toBe(1);
  expect(await page.getByLabel("Password", { exact: true }).inputValue() === "", "the field is emptied at Send my code, while the request is pending").toBe(true);
  await page.getByRole("button", { name: "Choose a different role", exact: true }).click();
  release();
  await expect.poll(() => lateSettled).toBe(true);
  await page.getByRole("button", { name: /I'm a Guide/ }).click();
  expect(await page.getByLabel("Password", { exact: true }).inputValue() === "" && await page.getByLabel("Email", { exact: true }).inputValue() === "", "the late answer restores nothing").toBe(true);
  await expect(page.getByLabel("Your code", { exact: true })).toHaveCount(0);
  expect(page.url() === `${origin}/login` && lateOther === 0, "no navigation or other request follows").toBe(true);
});
