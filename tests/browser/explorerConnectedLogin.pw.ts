// PREPARED, NOT RUN. These mocked responses prove mounted client behavior only;
// the destination marker deliberately does not prove protected-home access.
// Execution requires the separately reviewed local browser/server method.
import { expect, test } from "@playwright/test";

test.use({ trace: "off", screenshot: "off", video: "off" });

test("Explorer connected entry uses fixed requests and fresh destination", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("missing_test_origin");
  const origin = new URL(baseURL).origin;
  let sendShape = false;
  let verifyShape = false;
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === "/login/explorer/send") {
      const body: unknown = request.postDataJSON();
      sendShape = request.method() === "POST" && JSON.stringify(Object.keys(body as object)) === '["identifier"]';
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ acknowledgment: "verification_code_requested", challengeId: "00000000-0000-0000-0000-000000000000" }) });
    }
    if (url.pathname === "/login/explorer/verify") {
      const body: unknown = request.postDataJSON();
      verifyShape = request.method() === "POST" && JSON.stringify(Object.keys(body as object).sort()) === '["challengeId","code","identifier"]';
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ outcome: "signed_in", destination: "/explorer/home" }) });
    }
    if (url.pathname === "/explorer/home") return route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Fixed navigation observed; authorization not tested</h1>" });
    return route.continue();
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "Need help?", exact: true }).click();
  await expect(page.getByText("Help is not set up yet.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /I'm an Explorer/ }).click();
  await expect(page.getByText("Help is not set up yet.", { exact: true })).not.toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await page.getByLabel("Email", { exact: true }).fill("candidate@example.invalid");
  await page.getByRole("button", { name: "Send my code", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your email", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Check your email", exact: true })).toBeFocused();
  await page.getByLabel("Your code", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Verify and sign in", exact: true }).click();
  await page.waitForURL(`${origin}/explorer/home`);
  expect(sendShape && verifyShape).toBe(true);
  await expect(page.getByRole("heading", { name: "Fixed navigation observed; authorization not tested" })).toBeVisible();
});

test("Guide and Admin remain previews and departure returns to chooser", async ({ page }) => {
  let effects = 0;
  await page.route("**/login/*/*", route => { effects += 1; return route.abort(); });
  await page.goto("/login");
  for (const name of [/I'm a Guide/, /I'm the Admin/]) {
    await page.getByRole("button", { name }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await expect(page.getByText(/Sign-in preview: not connected yet/)).toBeVisible();
    await page.getByRole("button", { name: "Choose a different role", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeFocused();
  }
  expect(effects).toBe(0);
});

// M1-M3 are prepared source only, NOT RUN. All replies below are synthetic.
// Request cancellation proves local invalidation, never remote rollback.
type LoginRoute = import("@playwright/test").Route;
type LoginPage = import("@playwright/test").Page;
type LoginLocator = import("@playwright/test").Locator;
const FIRST_SELECTOR = "10000000-0000-0000-0000-000000000001";
const REPLACEMENT_SELECTOR = "20000000-0000-0000-0000-000000000002";
const SYNTHETIC_CODE = "123456";
const ackBody = (challengeId: string) => JSON.stringify({ acknowledgment: "verification_code_requested", challengeId });
const refusedBody = JSON.stringify({ outcome: "code_not_accepted" });
const signedInBody = JSON.stringify({ outcome: "signed_in", destination: "/explorer/home" });

// These wrappers narrow outward assertion/action failures only. Playwright can
// retain filled values in step metadata; a reviewed filtered reporter/config and
// intentional failing controls remain required before any mounted execution.
async function checkMounted(read: () => Promise<boolean>, label: string) {
  await expect.poll(async () => {
    try { return await read(); } catch { return false; }
  }, { message: label }).toBe(true);
}
async function actMounted(action: () => Promise<unknown>, label: string) {
  try { await action(); } catch { throw new Error(label); }
}
async function mountedTextIs(field: LoginLocator, expected: string) {
  const actual = await field.textContent();
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
  return actual !== null && normalize(actual) === normalize(expected);
}

// Deadlines are hang/failure bounds, not waits or ordering assumptions.
async function boundedRoute<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("held_login_route_did_not_settle")), 2_000);
    })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

function heldLoginReply(body: string) {
  let giveRoute!: (route: LoginRoute) => void;
  const received = new Promise<LoginRoute>(resolve => { giveRoute = resolve; });
  let giveCommand!: (command: "fulfill" | "abort") => void;
  const command = new Promise<"fulfill" | "abort">(resolve => { giveCommand = resolve; });
  let giveResult!: (result: "fulfilled" | "aborted" | "unavailable") => void;
  const settled = new Promise<"fulfilled" | "aborted" | "unavailable">(resolve => { giveResult = resolve; });
  let attached = false;
  let decided = false;
  const choose = (value: "fulfill" | "abort") => { if (!decided) { decided = true; giveCommand(value); } };
  return {
    received: () => boundedRoute(received),
    async handle(route: LoginRoute) {
      if (attached) { await route.abort(); return; }
      attached = true;
      giveRoute(route);
      const choice = await command;
      try {
        if (choice === "abort") await route.abort("aborted");
        else await route.fulfill({ status: 200, contentType: "application/json", body });
        giveResult(choice === "abort" ? "aborted" : "fulfilled");
      } catch {
        // A browser-aborted obsolete request may no longer be fulfillable.
        // The case separately requires its exact requestfailed observation.
        giveResult("unavailable");
      }
    },
    release() { choose("fulfill"); return boundedRoute(settled); },
    abort() { choose("abort"); return boundedRoute(settled); },
    async cleanup(page: LoginPage) {
      choose("abort");
      try { if (attached) await boundedRoute(settled); }
      // Keep the network fence installed until this test-owned page is closed.
      finally { await boundedRoute(actMounted(() => page.close(), "owned_page_close_failed")); }
    },
  };
}

function requestBodyIs(route: LoginRoute, expected: object): boolean {
  try { return route.request().postData() === JSON.stringify(expected); }
  catch { return false; }
}
async function fillSynthetic(field: LoginLocator, value: string) {
  try { await field.fill(value); }
  catch { throw new Error("synthetic_login_field_fill_failed"); }
}
async function inputIs(field: LoginLocator, expected: string): Promise<boolean> {
  try { return await field.inputValue() === expected; }
  catch { return false; }
}
async function jsonReply(route: LoginRoute, body: string) {
  try { await route.fulfill({ status: 200, contentType: "application/json", body }); }
  catch { throw new Error("synthetic_login_reply_failed"); }
}

// Exact two login effects only. The actual page/assets still come from the app.
// Unexpected mutations, off-origin traffic and home navigation never reach it.
function routeKind(route: LoginRoute, origin: string): "send" | "verify" | "asset" | "refuse" {
  const request = route.request();
  const url = new URL(request.url());
  if (url.origin !== origin) return "refuse";
  if (url.pathname === "/login/explorer/send" || url.pathname === "/login/explorer/verify") {
    if (request.method() !== "POST" || url.search !== "") return "refuse";
    return url.pathname === "/login/explorer/send" ? "send" : "verify";
  }
  if (url.pathname === "/explorer/home" || (request.method() !== "GET" && request.method() !== "HEAD")) return "refuse";
  return "asset";
}

test("M1 held send is invalidated by an email edit before the replacement attempt", async ({ page, baseURL }) => {
  test.setTimeout(30_000);
  if (!baseURL) throw new Error("missing_test_origin");
  const origin = new URL(baseURL).origin;
  const original = "first-mounted@example.invalid";
  const replacement = "replacement-mounted@example.invalid";
  const held = heldLoginReply(ackBody(FIRST_SELECTOR));
  let sends = 0; let blocked = 0; let shapes = true;
  await page.route("**/*", async route => {
    const kind = routeKind(route, origin);
    if (kind === "send") {
      sends += 1;
      shapes &&= requestBodyIs(route, { identifier: sends === 1 ? original : replacement });
      if (sends === 1) return held.handle(route);
      if (sends === 2) return jsonReply(route, ackBody(REPLACEMENT_SELECTOR));
    } else if (kind === "asset") return route.continue();
    blocked += 1; return route.abort();
  });
  try {
    await actMounted(() => page.goto("/login/explorer"), "mounted_action_01");
    const email = page.getByLabel("Email", { exact: true });
    const send = page.getByRole("button", { name: "Send my code", exact: true });
    await fillSynthetic(email, original);
    await actMounted(() => send.click(), "mounted_action_02");
    const oldRoute = await held.received();
    await checkMounted(async () => mountedTextIs(page.getByRole("status"), "Requesting your code..."), "mounted_check_01");
    await checkMounted(async () => (await (page.locator("form")).getAttribute("aria-busy")) === "true", "mounted_check_02");
    await checkMounted(async () => (send).isDisabled(), "mounted_check_03");
    await actMounted(() => email.press("Enter"), "mounted_action_03");
    expect(sends === 1, "pending send stays a single request").toBe(true);
    await checkMounted(async () => (email).isEnabled(), "mounted_check_04");
    const failed = page.waitForEvent("requestfailed", { predicate: request => request === oldRoute.request(), timeout: 5_000 }).then(() => true, () => false);
    await fillSynthetic(email, replacement);
    await held.release();
    expect(await failed, "edited request is locally aborted").toBe(true);
    expect(await inputIs(email, replacement), "replacement identifier remains private and current").toBe(true);
    await expect(page.getByRole("heading", { name: "Check your email", exact: true })).toHaveCount(0);
    await checkMounted(async () => (send).isEnabled(), "mounted_check_05");
    await actMounted(() => send.click(), "mounted_action_04");
    await checkMounted(async () => (page.getByRole("heading", { name: "Check your email", exact: true })).evaluate(node => node === (node.getRootNode() as Document | ShadowRoot).activeElement && node.ownerDocument.hasFocus()), "mounted_check_06");
    expect(sends === 2 && shapes && blocked === 0, "only the two exact send attempts occurred").toBe(true);
    await checkMounted(async () => (page).url() === `${origin}/login/explorer`, "mounted_check_07");
  } finally { await held.cleanup(page); }
});

test("M2 opaque refusal and failed resend require a fresh replacement selector", async ({ page, baseURL }) => {
  test.setTimeout(30_000);
  if (!baseURL) throw new Error("missing_test_origin");
  const origin = new URL(baseURL).origin;
  const identifier = "resend-mounted@example.invalid";
  const held = heldLoginReply(ackBody(REPLACEMENT_SELECTOR));
  let sends = 0; let verifies = 0; let blocked = 0; let shapes = true;
  await page.route("**/*", async route => {
    const kind = routeKind(route, origin);
    if (kind === "send") {
      sends += 1; shapes &&= requestBodyIs(route, { identifier });
      if (sends === 1) return jsonReply(route, ackBody(FIRST_SELECTOR));
      if (sends === 2) return held.handle(route);
      if (sends === 3) return jsonReply(route, ackBody(REPLACEMENT_SELECTOR));
    } else if (kind === "verify") {
      verifies += 1;
      shapes &&= requestBodyIs(route, { identifier, challengeId: verifies === 1 ? FIRST_SELECTOR : REPLACEMENT_SELECTOR, code: SYNTHETIC_CODE });
      if (verifies <= 2) return jsonReply(route, refusedBody);
    } else if (kind === "asset") return route.continue();
    blocked += 1; return route.abort();
  });
  try {
    await actMounted(() => page.goto("/login/explorer"), "mounted_action_05");
    await fillSynthetic(page.getByLabel("Email", { exact: true }), identifier);
    await actMounted(() => page.getByRole("button", { name: "Send my code", exact: true }).click(), "mounted_action_06");
    const code = page.getByLabel("Your code", { exact: true });
    const verify = page.getByRole("button", { name: "Verify and sign in", exact: true });
    const resend = page.getByRole("button", { name: "Send a new code", exact: true });
    await fillSynthetic(code, SYNTHETIC_CODE);
    await actMounted(() => verify.click(), "mounted_action_07");
    await checkMounted(async () => mountedTextIs(page.getByRole("status"), "We couldn\u2019t sign you in with that code. You can try the code from your latest SolMind email, or request a new one."), "mounted_check_08");
    await checkMounted(async () => (page.getByRole("heading", { name: "Check your email", exact: true })).isVisible(), "mounted_check_09");
    expect(await inputIs(code, SYNTHETIC_CODE), "opaque refusal does not replace the draft").toBe(true);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await actMounted(() => resend.click(), "mounted_action_08");
    await held.received();
    expect(await inputIs(code, ""), "resend immediately clears the old draft").toBe(true);
    await checkMounted(async () => (code).isDisabled(), "mounted_check_10"); await checkMounted(async () => (verify).isDisabled(), "mounted_check_11"); await checkMounted(async () => (resend).isDisabled(), "mounted_check_12");
    await checkMounted(async () => (await (page.locator("form")).getAttribute("aria-busy")) === "true", "mounted_check_13");
    expect(await held.abort() === "aborted", "the held resend fails deliberately").toBe(true);
    await checkMounted(async () => mountedTextIs(page.getByRole("status"), "We couldn't confirm sign-in. Please try signing in again."), "mounted_check_14");
    await checkMounted(async () => (verify).isDisabled(), "mounted_check_15"); await checkMounted(async () => (resend).isEnabled(), "mounted_check_16");
    await fillSynthetic(code, SYNTHETIC_CODE);
    await actMounted(() => code.press("Enter"), "mounted_action_09");
    expect(verifies === 1, "lost resend cannot verify with the discarded selector").toBe(true);
    await actMounted(() => resend.click(), "mounted_action_10");
    await checkMounted(async () => (verify).isEnabled(), "mounted_check_17");
    expect(await inputIs(code, ""), "replacement resend clears the draft again").toBe(true);
    await fillSynthetic(code, SYNTHETIC_CODE);
    await actMounted(() => verify.click(), "mounted_action_11");
    await checkMounted(async () => mountedTextIs(page.getByRole("status"), "We couldn\u2019t sign you in with that code. You can try the code from your latest SolMind email, or request a new one."), "mounted_check_18");
    expect(sends === 3 && verifies === 2 && shapes && blocked === 0, "fresh verify uses the replacement selector only").toBe(true);
    await checkMounted(async () => (page).url() === `${origin}/login/explorer`, "mounted_check_19");
  } finally { await held.cleanup(page); }
});

test("M3 leaving a held verify invalidates its response and remounts an empty view", async ({ page, baseURL }) => {
  test.setTimeout(30_000);
  if (!baseURL) throw new Error("missing_test_origin");
  const origin = new URL(baseURL).origin;
  const identifier = "departure-mounted@example.invalid";
  const held = heldLoginReply(signedInBody);
  let sends = 0; let verifies = 0; let blocked = 0; let shapes = true;
  await page.route("**/*", async route => {
    const kind = routeKind(route, origin);
    if (kind === "send") {
      sends += 1; shapes &&= requestBodyIs(route, { identifier });
      if (sends === 1) return jsonReply(route, ackBody(FIRST_SELECTOR));
    } else if (kind === "verify") {
      verifies += 1; shapes &&= requestBodyIs(route, { identifier, challengeId: FIRST_SELECTOR, code: SYNTHETIC_CODE });
      if (verifies === 1) return held.handle(route);
    } else if (kind === "asset") return route.continue();
    blocked += 1; return route.abort();
  });
  try {
    await actMounted(() => page.goto("/login/explorer"), "mounted_action_12");
    await fillSynthetic(page.getByLabel("Email", { exact: true }), identifier);
    await actMounted(() => page.getByRole("button", { name: "Send my code", exact: true }).click(), "mounted_action_13");
    const code = page.getByLabel("Your code", { exact: true });
    await fillSynthetic(code, SYNTHETIC_CODE);
    await actMounted(() => page.getByRole("button", { name: "Verify and sign in", exact: true }).click(), "mounted_action_14");
    const oldRoute = await held.received();
    await checkMounted(async () => mountedTextIs(page.getByRole("status"), "Checking your code..."), "mounted_check_20");
    await checkMounted(async () => (await (page.locator("form")).getAttribute("aria-busy")) === "true", "mounted_check_21");
    await checkMounted(async () => (code).isDisabled(), "mounted_check_22");
    await checkMounted(async () => (page.getByRole("button", { name: "Verify and sign in", exact: true })).isDisabled(), "mounted_check_23");
    await checkMounted(async () => (page.getByRole("button", { name: "Send a new code", exact: true })).isDisabled(), "mounted_check_24");
    await checkMounted(async () => (page.getByRole("button", { name: "Use a different email", exact: true })).isEnabled(), "mounted_check_25");
    const failed = page.waitForEvent("requestfailed", { predicate: request => request === oldRoute.request(), timeout: 5_000 }).then(() => true, () => false);
    await actMounted(() => page.getByRole("button", { name: "Choose a different role", exact: true }).click(), "mounted_action_15");
    await checkMounted(async () => (page.getByRole("heading", { name: "Welcome back", exact: true })).evaluate(node => node === (node.getRootNode() as Document | ShadowRoot).activeElement && node.ownerDocument.hasFocus()), "mounted_check_26");
    await held.release();
    expect(await failed, "departed verify is locally aborted").toBe(true);
    await checkMounted(async () => (page.getByRole("heading", { name: "Welcome back", exact: true })).evaluate(node => node === (node.getRootNode() as Document | ShadowRoot).activeElement && node.ownerDocument.hasFocus()), "mounted_check_27");
    await expect(code).toHaveCount(0);
    await actMounted(() => page.getByRole("button", { name: /I'm an Explorer/ }).click(), "mounted_action_16");
    expect(await inputIs(page.getByLabel("Email", { exact: true }), ""), "new view has no old identifier").toBe(true);
    await checkMounted(async () => (page.getByRole("heading", { level: 1 })).evaluate(node => node === (node.getRootNode() as Document | ShadowRoot).activeElement && node.ownerDocument.hasFocus()), "mounted_check_28");
    await checkMounted(async () => (page.getByRole("button", { name: "Send my code", exact: true })).isEnabled(), "mounted_check_29");
    await expect(page.getByRole("status")).toHaveCount(0);
    expect(sends === 1 && verifies === 1 && shapes && blocked === 0, "no old result navigates or creates another request").toBe(true);
    await checkMounted(async () => (page).url() === `${origin}/login/explorer`, "mounted_check_30");
  } finally { await held.cleanup(page); }
});
