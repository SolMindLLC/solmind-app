/**
 * OPT-IN REAL LOCAL AUTH + SQL COMPOSITION PROOF, with SYNTHETIC AI TRANSPORT.
 * Initial authorship: not executed by its author. See tests/integration/README.explorerConversationLocalProof.md.
 * Browser phase uses Root's already-running isolated app; AI remains synthetic.
 * No real AI credentials, API or production activation is used or claimed.
 * Root must apply tests/integration/fixtures/explorerConversationLocalProofSeed.sql to its inspected disposable stack first.
 */
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ExplorerConversationCommand, ExplorerConversationResult, ExplorerConversationState } from "../../src/lib/solmind/explorerConversationContract";
import type { ExplorerConversationDependencies } from "../../src/lib/solmind/virtual-guide/explorerConversationComposition";
import type { VirtualGuideConversationRequest } from "../../src/lib/solmind/virtual-guide/virtualGuideConversationContract";

const MARKER = "EXPLORER_CONVERSATION_ISOLATED_55321_SYNTHETIC_TRANSPORT_ONLY_V1";
const configured = process.env.SOLMIND_EXPLORER_LOCAL_PROOF;
if (configured !== undefined && configured !== MARKER) throw new Error("explorer_local_proof_invalid_marker");
const enabled = configured === MARKER;
const localDescribe = enabled ? describe : describe.skip;
const API = "http://127.0.0.1:55321";
const APP = "http://127.0.0.1:4311";
const cid = (number: number) => `f4200000-0000-4000-8000-${String(number).padStart(12, "0")}`;

function requireLocalConfiguration(): { anonKey: string; serviceKey: string } {
  if (process.env.SOLMIND_EXPLORER_LOCAL_PROOF !== MARKER ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !== API || process.env.SOLMIND_TRUSTED_APP_ORIGIN !== APP) {
    throw new Error("explorer_local_proof_requires_exact_isolated_origins");
  }
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!anonKey || !serviceKey || anonKey === serviceKey) throw new Error("explorer_local_proof_missing_isolated_keys");
  return { anonKey, serviceKey };
}

// Never attach provider errors, tokens, passwords or cookie values to an assertion.
function required(condition: unknown, category: string): asserts condition {
  if (!condition) throw new Error(category);
}
function state(result: ExplorerConversationResult): ExplorerConversationState {
  required(result.ok, "explorer_local_proof_expected_success");
  return result.state;
}

localDescribe("REAL isolated Auth/cookies/SQL; SYNTHETIC Virtual Guide transport", () => {
  it("uses fresh banked authority, persists/reloads/replays formation, and rejects foreign roles and ended sessions", async () => {
    // This guard runs before any client construction, dynamic application import
    // or local network operation. The normal suite skips this entire body.
    const { anonKey, serviceKey } = requireLocalConfiguration();
    const [{ createClient }, { createServerClient }, cookiePolicy, cookieWriter, factory, engine, context, contract, next, route, logout] = await Promise.all([
      import("@supabase/supabase-js"), import("@supabase/ssr"),
      import("../../src/lib/solmind/auth/sessionCookiePolicy"),
      import("../../src/lib/solmind/supabase/loginCookieWriter"),
      import("../../src/lib/solmind/supabase/explorerConversationRequestDependencies"),
      import("../../src/lib/solmind/virtual-guide/explorerConversationComposition"),
      import("../../src/lib/solmind/virtual-guide/explorerConversationContext"),
      import("../../src/lib/solmind/virtual-guide/virtualGuideConversationContract"),
      import("next/server"), import("../../src/app/explorer/conversation/state/route"),
      import("../../src/lib/solmind/supabase/logoutDependencies"),
    ]);
    const admin = createClient(API, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const policy = cookiePolicy.resolveSessionCookiePolicy(APP);
    required(policy, "explorer_local_proof_cookie_policy_unavailable");
    const roles = [
      { label: "explorer", provider: cid(201), account: cid(1), session: cid(50) },
      { label: "other-explorer", provider: cid(202), account: cid(4), session: cid(54) },
      { label: "guide", provider: cid(203), account: cid(2), session: cid(56) },
      { label: "admin", provider: cid(204), account: cid(3), session: cid(57) },
    ] as const;
    const cookieHeaders = new Map<string, string>();
    for (const role of roles) {
      const email = `${role.label}-conversation-proof-20261024@example.invalid`;
      const password = randomBytes(32).toString("base64url");
      // Root-controlled UUIDs are predeclared in the committed isolated seed.
      // Existing user -> fixed failure. No update, retry, recovery or deletion.
      const created = await admin.auth.admin.createUser({ id: role.provider, email, password, email_confirm: true });
      required(!created.error && created.data.user?.id === role.provider, "explorer_local_proof_auth_create_failed");
      const held = new Map<string, { name: string; value: string }>();
      const auth = createServerClient(API, anonKey, {
        cookieOptions: { name: policy.authCookieName },
        auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
        cookies: { getAll: () => [], setAll: (entries) => {
          for (const entry of entries) held.set(entry.name, { name: entry.name, value: entry.value });
        } },
      });
      const signedIn = await auth.auth.signInWithPassword({ email, password });
      required(!signedIn.error && signedIn.data.user?.id === role.provider && signedIn.data.session, "explorer_local_proof_password_login_failed");
      const published = new Map<string, string>();
      const headers = new Headers();
      const written = cookieWriter.writeLoginSessionCookies({
        trustedOrigin: APP, heldCookies: [...held.values()], requestCookies: [],
        sessionId: role.session, maxAgeSeconds: 900,
        response: { headers, cookies: { set(name, value, attributes) {
          if (attributes.maxAge > 0) published.set(name, value);
        } } },
      });
      required(written.outcome === "written" && published.get(policy.bindingCookieName) === role.session,
        "explorer_local_proof_cookie_publication_failed");
      const raw = [...published].map(([name, value]) => `${name}=${value}`).join("; ");
      required(cookiePolicy.readSessionAuthCookieAccessToken(policy, [...published].map(([name, value]) => ({ name, value }))) !== null,
        "explorer_local_proof_cookie_grammar_failed");
      cookieHeaders.set(role.label, raw);
    }
    const header = (role = "explorer"): string => {
      const value = cookieHeaders.get(role);
      required(value, "explorer_local_proof_missing_role_cookie");
      return value;
    };
    // A new concrete principal source + service-role client on every request.
    const fresh = (role = "explorer") => factory.createExplorerConversationRequestDependencies(header(role));
    expect(await fresh().authenticate()).toEqual({ accountId: cid(1), applicationSessionId: cid(50) });
    expect(await fresh("other-explorer").authenticate()).toEqual({ accountId: cid(4), applicationSessionId: cid(54) });
    expect(await fresh("guide").authenticate()).toBeNull();
    expect(await fresh("admin").authenticate()).toBeNull();
    expect(await factory.createExplorerConversationRequestDependencies(null).authenticate()).toBeNull();
    expect(await factory.createExplorerConversationRequestDependencies(`${header()}; ${policy.bindingCookieName}=${cid(50)}`).authenticate()).toBeNull();

    const response = await route.GET(new next.NextRequest(`${APP}/explorer/conversation/state`, { headers: { Cookie: header("explorer") } }));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const blank = await response.json() as ExplorerConversationResult;
    expect(state(blank)).toMatchObject({ conversationId: null, revision: 0, pendingTurn: false, providerState: "unavailable", messages: [] });
    const heldSend: ExplorerConversationCommand = { kind: "send", operationId: cid(300), expectedRevision: 0, body: "Synthetic held message; must not be saved." };
    expect(await engine.commandExplorerConversation({ command: heldSend, dependencies: fresh() })).toEqual({ ok: false, state: null, error: "provider_unavailable" });
    expect(state(await engine.readExplorerConversation(fresh()))).toEqual(state(blank));

    const captured: VirtualGuideConversationRequest[] = [];
    const config = {
      methodologyContextPackVersionId: cid(90), promptVersion: "synthetic-local-prompt.v1",
      instructionVersion: "synthetic-local-instruction.v1", roleVersion: "synthetic-local-role.v1",
      globalPolicy: { version: "synthetic-local-policy.v1", text: "Synthetic isolated local policy only." },
      roleBehavior: { version: "synthetic-local-behavior.v1", text: "Synthetic local Virtual Guide role only." },
      crisisBehavior: { version: "synthetic-local-crisis.v1", text: "Synthetic local crisis behavior only." },
      methodologyContext: { version: "synthetic-local-methodology.v1", text: "Synthetic local methodology only." },
    };
    const connected = (role = "explorer"): ExplorerConversationDependencies => {
      const actual = fresh(role);
      return { ...actual, buildContext: context.createExplorerConversationContextBuilder({ repository: actual.repository, configuration: config }),
        provider: { generate: async (request, signal) => {
          required(!signal.aborted, "explorer_local_proof_transport_aborted");
          captured.push(request);
          return { contractVersion: contract.VIRTUAL_GUIDE_CONVERSATION_CONTRACT_VERSION, invocationId: request.invocationId,
            assistantMessage: { messageId: cid(350), role: "solmind_virtual_guide", content: "SYNTHETIC LOCAL TRANSPORT: consider one small step you choose." }, finishReason: "completed" };
        } } };
    };
    const send: ExplorerConversationCommand = { kind: "send", operationId: cid(301), expectedRevision: 0, body: "Synthetic Explorer would like one small useful step." };
    let saved = state(await engine.commandExplorerConversation({ command: send, dependencies: connected() }));
    expect(captured).toHaveLength(1);
    expect(saved.messages.map((message) => message.role)).toEqual(["explorer", "virtualGuide"]);
    expect(saved.messages[1].body).toBe("SYNTHETIC LOCAL TRANSPORT: consider one small step you choose.");
    expect(saved.pendingTurn).toBe(false);
    const actualContext = JSON.parse(captured[0].authorizedContext);
    expect(actualContext.contractVersion).toBe(context.EXPLORER_CONVERSATION_CONTEXT_SELECTION_VERSION);
    expect(actualContext.approvedContinuity.map((item: { field: string; content: string; order: number }) => [item.field, item.content, item.order])).toEqual([
      ["supportNow", "Synthetic support source", 0], ["usefulOutcome", "Synthetic useful outcome", 1],
      ["supportStyle", "Synthetic style", 2], ["guideContext", "Synthetic shared answer", 3],
      ["communicationPreference", "Synthetic preference", 4], ["doNotEmphasize", "Synthetic excluded topic", 5],
    ]);
    expect(new Set(actualContext.approvedContinuity.map((item: { sourceId: string }) => item.sourceId)).size).toBe(1);
    expect(actualContext.approvedContinuity.every((item: { sourceId: string }) => item.sourceId === cid(52))).toBe(true);
    expect(actualContext.sessionContext.explorerSafeGuardrail).toBeNull();
    // Synthetic proof metadata only: no cookies, credentials or source text.
    console.info("ONBOARDING_CONTEXT_PROOF", JSON.stringify({
      selectionVersion: actualContext.contractVersion,
      fingerprint: captured[0].contextFingerprint,
      fields: actualContext.approvedContinuity.map((item: { field: string }) => item.field),
      intakeSourceId: actualContext.approvedContinuity[0].sourceId,
    }));
    for (const excluded of ["Synthetic Guide Private Canary", "Synthetic other support"]) {
      expect(captured[0].authorizedContext).not.toContain(excluded);
    }
    const reloaded = state(await engine.readExplorerConversation(fresh()));
    expect({ ...reloaded, providerState: "available" }).toEqual(saved);
    // Exact retry has its original expected revision and bytes, after history grew.
    expect(state(await engine.commandExplorerConversation({ command: send, dependencies: connected() }))).toEqual(saved);
    expect(captured).toHaveLength(1);
    expect(await engine.commandExplorerConversation({ command: { ...send, body: "Changed bytes" }, dependencies: connected() })).toEqual({ ok: false, state: null, error: "refresh_required" });
    expect(captured).toHaveLength(1);
    expect(await engine.commandExplorerConversation({ command: { ...send, operationId: cid(302) }, dependencies: connected() })).toEqual({ ok: false, state: null, error: "refresh_required" });
    expect(captured).toHaveLength(1);

    const source = saved.messages[0].id;
    const mutate = async (command: ExplorerConversationCommand) => {
      saved = state(await engine.commandExplorerConversation({ command, dependencies: connected() }));
      return saved;
    };
    await mutate({ kind: "add_compass", operationId: cid(310), expectedRevision: saved.revision, sourceMessageId: source, label: "Synthetic chosen focus" });
    const compassId = saved.compassItems[0].id;
    await mutate({ kind: "confirm_priority", operationId: cid(311), expectedRevision: saved.revision, itemId: compassId });
    await mutate({ kind: "set_attention", operationId: cid(312), expectedRevision: saved.revision, itemId: compassId });
    await mutate({ kind: "confirm_waypoint", operationId: cid(313), expectedRevision: saved.revision, sourceMessageId: source,
      destination: "Synthetic small step", meaning: "Synthetic personal importance", arrivalSignal: "Synthetic visible evidence" });
    expect(saved.waypoints[0].status).toBe("chosen");
    await mutate({ kind: "confirm_reached", operationId: cid(314), expectedRevision: saved.revision, waypointId: saved.waypoints[0].id,
      evidence: "Synthetic Explorer explicitly confirms the visible evidence." });
    expect(saved).toMatchObject({ priorityId: compassId, attentionId: compassId, waypoints: [{ status: "reached" }] });
    expect({ ...state(await engine.readExplorerConversation(fresh())), providerState: "available" }).toEqual(saved);
    expect(captured).toHaveLength(1); // Formation never invokes the synthetic transport.

    const other = state(await engine.readExplorerConversation(fresh("other-explorer")));
    expect(other).toMatchObject({ conversationId: null, messages: [], compassItems: [], waypoints: [] });
    expect(await engine.commandExplorerConversation({ command: { kind: "add_compass", operationId: cid(320), expectedRevision: 0,
      sourceMessageId: source, label: "Foreign saved message must not transfer" }, dependencies: connected("other-explorer") })).toEqual({ ok: false, state: null, error: "denied" });
    for (const role of ["guide", "admin"]) {
      expect(await engine.readExplorerConversation(fresh(role))).toEqual({ ok: false, state: null, error: "denied" });
      expect(await engine.commandExplorerConversation({ command: send, dependencies: connected(role) })).toEqual({ ok: false, state: null, error: "denied" });
    }
    expect(captured).toHaveLength(1);
    // Real persisted revoked binding, same valid local provider JWT. This is
    // fixture-state revocation coverage, not an induced mid-dispatch race.
    const revokedHeader = header("explorer").split("; ").map((part) => part.startsWith(`${policy.bindingCookieName}=`) ? `${policy.bindingCookieName}=${cid(58)}` : part).join("; ");
    expect(await factory.createExplorerConversationRequestDependencies(revokedHeader).authenticate()).toBeNull();

    // Banked logout database capability, actual provider identity and mapping;
    // no fake account derivation. Provider sign-out/UI cleanup are separate proof.
    const logoutDatabase = logout.createLogoutDatabaseDependencies();
    required(logoutDatabase, "explorer_local_proof_logout_dependencies_unavailable");
    // A separate real SQL turn loses its application-session authority while
    // the injected SYNTHETIC transport is in flight. Failure settlement must
    // close only retained terminal metadata, without publishing a fake reply.
    const faultActual = fresh("other-explorer");
    const faultActor = await faultActual.authenticate();
    required(faultActor?.accountId === cid(4) && faultActor.applicationSessionId === cid(54),
      "explorer_local_proof_fault_actor_unavailable");
    let faultDispatches = 0;
    const faultDependencies: ExplorerConversationDependencies = { ...faultActual,
      buildContext: context.createExplorerConversationContextBuilder({ repository: faultActual.repository, configuration: config }),
      provider: { generate: async () => {
        faultDispatches++;
        required(await logoutDatabase.endSession(faultActor.accountId, faultActor.applicationSessionId) === "ended",
          "explorer_local_proof_inflight_logout_failed");
        throw new Error("synthetic_local_transport_failure_after_logout");
      } },
    };
    expect(await engine.commandExplorerConversation({ command: { kind: "send", operationId: cid(330), expectedRevision: 0,
      body: "Synthetic other Explorer turn; transport will fail after actual local logout." }, dependencies: faultDependencies }))
      .toEqual({ ok: false, state: null, error: "unavailable" });
    expect(faultDispatches).toBe(1);
    expect(await fresh("other-explorer").authenticate()).toBeNull();
    expect(await engine.readExplorerConversation(fresh("other-explorer"))).toEqual({ ok: false, state: null, error: "denied" });
    // Root's separate postgres receipt in README.explorerConversationLocalProof.md must verify that the
    // failed operation has no reply and no pending pointer. No table grant is
    // added here to peek past the correctly denied request boundary.

    // GENUINE browser + Auth + HTTP + SQL phase. Root starts the current built
    // validation app at APP first and pins this existing Chrome's identity/hash.
    // No app start, persistent profile, route interception or mock HTTP response.
    const [{ chromium, expect: browserExpect }, { mkdir, access }, browserContract] = await Promise.all([
      import("@playwright/test"), import("node:fs/promises"),
      import("../../src/lib/solmind/explorerConversationContract"),
    ]);
    const screenshotDirectory = "C:\\_Apollo\\Projects\\Solmind\\.validation\\explorer-conversation-20261024-r01\\real-browser-r04";
    const desktopScreenshot = `${screenshotDirectory}\\desktop-1280x900.png`;
    const narrowScreenshot = `${screenshotDirectory}\\narrow-390x844.png`;
    // Preserve an earlier receipt; screenshot creation must not overwrite it.
    for (const path of [desktopScreenshot, narrowScreenshot]) {
      let exists = false;
      try { await access(path); exists = true; } catch (error) {
        required(error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT",
          "explorer_local_proof_screenshot_precheck_failed");
      }
      required(!exists, "explorer_local_proof_screenshot_already_exists");
    }
    await mkdir(screenshotDirectory, { recursive: true });
    const browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      headless: true, timeout: 15_000 });
    try {
      const browserContext = await browser.newContext({ baseURL: APP, viewport: { width: 1280, height: 900 },
        serviceWorkers: "block", ignoreHTTPSErrors: false });
      const publishedEntries = factory.readExplorerConversationCookies(header("explorer"));
      required(publishedEntries, "explorer_local_proof_browser_cookies_unavailable");
      await browserContext.addCookies(publishedEntries.map(({ name, value }) => ({ name, value, url: APP,
        httpOnly: true, secure: false, sameSite: "Lax" as const, expires: Math.floor(Date.now() / 1000) + 900 })));
      const page = await browserContext.newPage();
      page.setDefaultTimeout(10_000);
      page.setDefaultNavigationTimeout(15_000);
      await page.goto(`${APP}/explorer/conversation`, { waitUntil: "domcontentloaded" });
      const history = page.getByRole("list", { name: "Saved conversation", exact: true });
      await browserExpect(history).toContainText("SYNTHETIC LOCAL TRANSPORT: consider one small step you choose.");
      await browserExpect(page.getByRole("button", { name: "Send message", exact: true })).toBeDisabled();
      await browserExpect(page.getByLabel("Your message", { exact: true })).toBeDisabled();
      await browserExpect(page.getByText(/unavailable\. You can review saved messages/)).toBeVisible();
      const initialAttentionId = saved.attentionId;
      const replySourceId = saved.messages.find((message) => message.role === "virtualGuide")?.id;
      required(replySourceId, "explorer_local_proof_browser_reply_source_missing");
      const browserCommand = async (click: () => Promise<unknown>) => {
        const [answer] = await Promise.all([
          page.waitForResponse((answer) => answer.url() === `${APP}/explorer/conversation/commands` &&
            answer.request().method() === "POST", { timeout: 15_000 }), click(),
        ]);
        required(answer.ok() && answer.headers()["cache-control"] === "private, no-store",
          "explorer_local_proof_browser_command_http_failed");
        const parsed = browserContract.parseExplorerConversationResult(await answer.json());
        required(parsed, "explorer_local_proof_browser_command_malformed");
        saved = state(parsed);
        await browserExpect(page.getByRole("status").first()).toHaveText("Your saved conversation is up to date.");
      };
      const compass = page.getByRole("region", { name: "Session Compass", exact: true });
      await compass.getByRole("combobox", { name: "Saved conversation source", exact: true }).selectOption(replySourceId);
      await compass.getByLabel("Your short label", { exact: true }).fill("Browser chosen second focus");
      await browserCommand(() => compass.getByRole("button", { name: "Save Compass point", exact: true }).click());
      expect(saved.compassItems).toHaveLength(2);
      const secondCompass = saved.compassItems.find((item) => item.label === "Browser chosen second focus");
      required(secondCompass?.sourceMessageId === replySourceId, "explorer_local_proof_browser_compass_source_failed");
      await compass.getByRole("button", { name: "Review Priority: Browser chosen second focus", exact: true }).click();
      await browserCommand(() => compass.getByRole("group", { name: "Confirm Priority choice", exact: true })
        .getByRole("button", { name: "Confirm Priority", exact: true }).click());
      expect(saved.priorityId).toBe(secondCompass.id);
      expect(saved.attentionId).toBe(initialAttentionId);
      await browserExpect(compass.getByText("Current attention: Synthetic chosen focus", { exact: true })).toBeVisible();

      const waypoints = page.getByRole("region", { name: "Private Waypoints", exact: true });
      await waypoints.getByRole("combobox", { name: "Saved conversation source", exact: true }).selectOption(replySourceId);
      await waypoints.getByLabel("Where do you want to arrive?", { exact: true }).fill("Browser-confirmed small step");
      await waypoints.getByLabel("Why does reaching it matter to you?", { exact: true }).fill("Browser confirms a private choice.");
      await waypoints.getByLabel("What observable signal will help you recognize arrival?", { exact: true }).fill("Browser-visible supporting signal.");
      await waypoints.getByLabel("I choose this private Waypoint with the destination, meaning and arrival signal shown above.", { exact: true }).check();
      await browserCommand(() => waypoints.getByRole("button", { name: "Confirm and save private Waypoint", exact: true }).click());
      const secondWaypoint = saved.waypoints.find((waypoint) => waypoint.destination === "Browser-confirmed small step");
      required(secondWaypoint?.status === "chosen" && secondWaypoint.sourceMessageId === replySourceId,
        "explorer_local_proof_browser_waypoint_choice_failed");
      await waypoints.getByRole("button", { name: "Review Reached: Browser-confirmed small step", exact: true }).click();
      const reachedReview = waypoints.getByRole("group", { name: "Review before confirming Reached", exact: true });
      await reachedReview.getByLabel("What supporting evidence shows arrival?", { exact: true }).fill("Synthetic browser evidence explicitly confirms the chosen arrival signal.");
      await reachedReview.getByLabel("I have reviewed my arrival signal and supporting evidence, and I confirm meaningful progress to this Waypoint.", { exact: true }).check();
      await browserCommand(() => reachedReview.getByRole("button", { name: "Confirm Reached", exact: true }).click());
      expect(saved.waypoints).toHaveLength(2);
      expect(saved.waypoints.every((waypoint) => waypoint.status === "reached")).toBe(true);
      expect(saved.revision).toBe(11);
      expect(saved.providerState).toBe("unavailable");
      expect(captured).toHaveLength(1);
      await page.reload({ waitUntil: "domcontentloaded" });
      await browserExpect(history).toContainText("SYNTHETIC LOCAL TRANSPORT: consider one small step you choose.");
      await browserExpect(compass.getByRole("button", { name: "Review Priority: Browser chosen second focus", exact: true })).toBeDisabled();
      await browserExpect(compass.getByText("Current attention: Synthetic chosen focus", { exact: true })).toBeVisible();
      await browserExpect(waypoints.getByText("Reached — confirmed by you", { exact: true })).toHaveCount(2);
      expect(state(await engine.readExplorerConversation(fresh()))).toEqual(saved);
      await page.screenshot({ path: desktopScreenshot, fullPage: true, animations: "disabled" });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload({ waitUntil: "domcontentloaded" });
      await browserExpect(history).toContainText("SYNTHETIC LOCAL TRANSPORT: consider one small step you choose.");
      await browserExpect(waypoints.getByText("Reached — confirmed by you", { exact: true })).toHaveCount(2);
      await page.screenshot({ path: narrowScreenshot, fullPage: true, animations: "disabled" });

      // A fresh anonymous context has no borrowed cookie/profile/storage state.
      const deniedContext = await browser.newContext({ baseURL: APP, viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
      const deniedPage = await deniedContext.newPage();
      deniedPage.setDefaultTimeout(10_000);
      deniedPage.setDefaultNavigationTimeout(15_000);
      await deniedPage.goto(`${APP}/explorer/conversation`, { waitUntil: "domcontentloaded" });
      await browserExpect(deniedPage.getByRole("main").getByRole("alert")).toContainText("not available in your current session");
      await browserExpect(deniedPage.getByRole("list", { name: "Saved conversation", exact: true })).toHaveCount(0);
      await browserExpect(deniedPage.getByText("SYNTHETIC LOCAL TRANSPORT: consider one small step you choose.", { exact: true })).toHaveCount(0);
      await browserExpect(deniedPage.getByText("Synthetic Guide Private Canary", { exact: true })).toHaveCount(0);
      await deniedContext.close();
      await browserContext.close();
    } finally {
      await browser.close();
    }

    const entries = factory.readExplorerConversationCookies(header("explorer"));
    required(entries, "explorer_local_proof_logout_cookie_unavailable");
    const token = cookiePolicy.readSessionAuthCookieAccessToken(policy, entries);
    required(token, "explorer_local_proof_logout_token_unavailable");
    const identity = await logoutDatabase.identify(token, AbortSignal.timeout(3_000));
    required(identity === cid(201), "explorer_local_proof_logout_identity_failed");
    const account = await logoutDatabase.findAccount(identity, AbortSignal.timeout(3_000));
    required(account === cid(1), "explorer_local_proof_logout_mapping_failed");
    expect(await logoutDatabase.endSession(account, cid(50))).toBe("ended");
    expect(await fresh().authenticate()).toBeNull();
    expect(await engine.readExplorerConversation(fresh())).toEqual({ ok: false, state: null, error: "denied" });
    expect(await engine.commandExplorerConversation({ command: send, dependencies: connected() })).toEqual({ ok: false, state: null, error: "denied" });
    expect(captured).toHaveLength(1);
    // No delete/reset/stop here. Root owns retained synthetic resources and their
    // exact disposable-stack closeout, including failure or partial setup.
  }, 180_000);
});
