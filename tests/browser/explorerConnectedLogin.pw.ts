// These cases run in the standard browser suite on both projects, with synthetic
// mocked replies. The mocked responses prove mounted client behavior only; the
// destination marker deliberately does not prove protected-home access.
import { expect, test } from "@playwright/test";

test.use({ trace: "off", screenshot: "off", video: "off" });

// Since 705f9a1 (2026-10-29, the private sign-in flow) the page sends its own
// private flow ID, {identifier, flowId}, accepts only an acknowledgment that
// echoes that same flowId, and verifies with {identifier, flowId, code}.
const FLOW_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NIL_FLOW_ID = "00000000-0000-0000-0000-000000000000";

// The request's own flow ID when it is a canonical lowercase UUID other than the nil UUID, else null.
function requestFlowId(postData: string | null): string | null {
  try {
    const body: unknown = JSON.parse(postData ?? "null");
    const value = typeof body === "object" && body !== null ? (body as Record<string, unknown>).flowId : undefined;
    return typeof value === "string" && FLOW_ID.test(value) && value !== NIL_FLOW_ID ? value : null;
  } catch { return null; }
}
const flowAck = (flowId: string) => JSON.stringify({ acknowledgment: "verification_code_requested", flowId });

test("Explorer connected entry uses fixed requests and fresh destination", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("missing_test_origin");
  const origin = new URL(baseURL).origin;
  const identifier = "candidate@example.invalid";
  const flow = { id: null as string | null };
  let sendShape = false;
  let verifyShape = false;
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === "/login/explorer/send") {
      const flowId = requestFlowId(request.postData());
      flow.id = flowId;
      sendShape = request.method() === "POST" && url.search === "" && flowId !== null &&
        request.postData() === JSON.stringify({ identifier, flowId });
      return route.fulfill({ status: 200, contentType: "application/json", body: flowAck(flowId ?? "") });
    }
    if (url.pathname === "/login/explorer/verify") {
      verifyShape = request.method() === "POST" && url.search === "" && flow.id !== null &&
        request.postData() === JSON.stringify({ identifier, flowId: flow.id, code: "123456" });
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
  await page.getByLabel("Email", { exact: true }).fill(identifier);
  await page.getByRole("button", { name: "Send my code", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your email", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Check your email", exact: true })).toBeFocused();
  await page.getByLabel("Your code", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Verify and sign in", exact: true }).click();
  await page.waitForURL(`${origin}/explorer/home`);
  expect(sendShape && verifyShape).toBe(true);
  await expect(page.getByRole("heading", { name: "Fixed navigation observed; authorization not tested" })).toBeVisible();
});

test("Connected Admin selection and departure return to chooser without requests", async ({ page }) => {
  let effects = 0;
  await page.route("**/login/*/*", route => { effects += 1; return route.abort(); });
  await page.goto("/login");
  for (const name of [/I'm the Admin/]) {
    await page.getByRole("button", { name }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await expect(page.getByLabel("Email, or the Admin username", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
    await expect(page.getByText(/Sign-in preview: not connected yet/)).toHaveCount(0);
    await page.getByRole("button", { name: "Choose a different role", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeFocused();
  }
  expect(effects).toBe(0);
});

// M1-M3 run in the same suite. All replies below are synthetic.
// Request cancellation proves local invalidation, never remote rollback.
type LoginRoute = import("@playwright/test").Route;
type LoginPage = import("@playwright/test").Page;
type LoginLocator = import("@playwright/test").Locator;
const SYNTHETIC_CODE = "123456";
const refusedBody = JSON.stringify({ outcome: "code_not_accepted" });
const signedInBody = JSON.stringify({ outcome: "signed_in", destination: "/explorer/home" });

// These wrappers narrow outward assertion/action failures only. Playwright can
// retain filled values in step metadata, so this file keeps trace, screenshot
// and video off and uses synthetic values only.
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

// The reply body is built only on release: a send acknowledgment must echo the
// page's own flow ID, which exists only once the page has sent it.
function heldLoginReply(bodyFor: () => string) {
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
        else await route.fulfill({ status: 200, contentType: "application/json", body: bodyFor() });
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
  // The page's own flow ID of each send, in order.
  const flows: (string | null)[] = [];
  // Released only after the email edit: a correct echo of the first flow, so
  // only the edit's invalidation can keep the page off the code screen.
  const held = heldLoginReply(() => flowAck(flows[0] ?? ""));
  let sends = 0; let blocked = 0; let shapes = true;
  await page.route("**/*", async route => {
    const kind = routeKind(route, origin);
    if (kind === "send") {
      sends += 1;
      const flowId = requestFlowId(route.request().postData());
      flows.push(flowId);
      shapes &&= flowId !== null && requestBodyIs(route, { identifier: sends === 1 ? original : replacement, flowId });
      if (sends === 1) return held.handle(route);
      if (sends === 2) return jsonReply(route, flowAck(flowId ?? ""));
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
    expect(flows.length === 2 && flows[0] !== null && flows[1] !== null && flows[1] !== flows[0], "the email edit starts a new private flow").toBe(true);
    await checkMounted(async () => (page).url() === `${origin}/login/explorer`, "mounted_check_07");
  } finally { await held.cleanup(page); }
});

// Since 705f9a1 (Paul's Card 9 item 17; unit tests F11 and U10) one private
// flow survives every resend, so after a failed resend the next verify uses
// the same flow.
test("M2 opaque refusal and a failed resend keep the same private flow for the next verify", async ({ page, baseURL }) => {
  test.setTimeout(30_000);
  if (!baseURL) throw new Error("missing_test_origin");
  const origin = new URL(baseURL).origin;
  const identifier = "resend-mounted@example.invalid";
  // The flow ID of the first send; every later send and verify must carry it.
  const flow = { id: null as string | null };
  const held = heldLoginReply(() => flowAck(flow.id ?? ""));
  let sends = 0; let verifies = 0; let blocked = 0; let shapes = true;
  await page.route("**/*", async route => {
    const kind = routeKind(route, origin);
    if (kind === "send") {
      sends += 1;
      if (sends === 1) flow.id = requestFlowId(route.request().postData());
      shapes &&= flow.id !== null && requestBodyIs(route, { identifier, flowId: flow.id });
      if (sends === 1) return jsonReply(route, flowAck(flow.id ?? ""));
      if (sends === 2) return held.handle(route);
      if (sends === 3) return jsonReply(route, flowAck(flow.id ?? ""));
    } else if (kind === "verify") {
      verifies += 1;
      shapes &&= flow.id !== null && requestBodyIs(route, { identifier, flowId: flow.id, code: SYNTHETIC_CODE });
      if (verifies <= 3) return jsonReply(route, refusedBody);
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
    // Scoped to the page's own content: Next.js adds its route announcer, an empty
    // role="alert" in a shadow root outside <main>, to every page.
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    await actMounted(() => resend.click(), "mounted_action_08");
    await held.received();
    expect(await inputIs(code, ""), "resend immediately clears the old draft").toBe(true);
    await checkMounted(async () => (code).isDisabled(), "mounted_check_10"); await checkMounted(async () => (verify).isDisabled(), "mounted_check_11"); await checkMounted(async () => (resend).isDisabled(), "mounted_check_12");
    await checkMounted(async () => (await (page.locator("form")).getAttribute("aria-busy")) === "true", "mounted_check_13");
    expect(await held.abort() === "aborted", "the held resend fails deliberately").toBe(true);
    await checkMounted(async () => mountedTextIs(page.getByRole("status"), "We couldn't confirm sign-in. Please try signing in again."), "mounted_check_14");
    // The failed resend keeps the same private flow, so the code field and Verify stay usable.
    await checkMounted(async () => (await (verify).isEnabled()) && (await (code).isEnabled()), "mounted_check_15"); await checkMounted(async () => (resend).isEnabled(), "mounted_check_16");
    await fillSynthetic(code, SYNTHETIC_CODE);
    await actMounted(() => code.press("Enter"), "mounted_action_09");
    await checkMounted(async () => verifies === 2, "mounted_check_31");
    expect(shapes, "the verify after the failed resend carries the same private flow").toBe(true);
    await checkMounted(async () => mountedTextIs(page.getByRole("status"), "We couldn\u2019t sign you in with that code. You can try the code from your latest SolMind email, or request a new one."), "mounted_check_32");
    await actMounted(() => resend.click(), "mounted_action_10");
    // The new-code request settled: its acknowledgment echoed the same flow and the status region is gone.
    await checkMounted(async () => sends === 3 && (await page.getByRole("status").count()) === 0, "mounted_check_33");
    await checkMounted(async () => (verify).isEnabled(), "mounted_check_17");
    expect(await inputIs(code, ""), "the new-code request clears the draft again").toBe(true);
    await fillSynthetic(code, SYNTHETIC_CODE);
    await actMounted(() => verify.click(), "mounted_action_11");
    await checkMounted(async () => mountedTextIs(page.getByRole("status"), "We couldn\u2019t sign you in with that code. You can try the code from your latest SolMind email, or request a new one."), "mounted_check_18");
    expect(sends === 3 && verifies === 3 && shapes && blocked === 0, "every send and verify used the one private flow").toBe(true);
    await checkMounted(async () => (page).url() === `${origin}/login/explorer`, "mounted_check_19");
  } finally { await held.cleanup(page); }
});

test("M3 leaving a held verify invalidates its response and remounts an empty view", async ({ page, baseURL }) => {
  test.setTimeout(30_000);
  if (!baseURL) throw new Error("missing_test_origin");
  const origin = new URL(baseURL).origin;
  const identifier = "departure-mounted@example.invalid";
  const held = heldLoginReply(() => signedInBody);
  // The flow ID of the one send; the verify must carry it.
  const flow = { id: null as string | null };
  let sends = 0; let verifies = 0; let blocked = 0; let shapes = true;
  await page.route("**/*", async route => {
    const kind = routeKind(route, origin);
    if (kind === "send") {
      sends += 1;
      if (sends === 1) flow.id = requestFlowId(route.request().postData());
      shapes &&= flow.id !== null && requestBodyIs(route, { identifier, flowId: flow.id });
      if (sends === 1) return jsonReply(route, flowAck(flow.id ?? ""));
    } else if (kind === "verify") {
      verifies += 1; shapes &&= flow.id !== null && requestBodyIs(route, { identifier, flowId: flow.id, code: SYNTHETIC_CODE });
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
