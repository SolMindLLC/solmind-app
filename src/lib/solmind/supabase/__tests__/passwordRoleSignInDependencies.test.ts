// Source integration only. RPC/Auth are intercepted by an in-memory fetch;
// mail is a fake transport. Real HTTP/core/factory/callers/SDK/bridge run.
import { isDeepStrictEqual } from "node:util";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as factory from "../passwordRoleSignInDependencies";
import type { PasswordRoleSignInDependencyConfiguration as Configuration } from "../passwordRoleSignInDependencies";
import * as handlers from "../passwordRoleSignInHttpHandlers";
import * as service from "../serviceRoleClient";
import * as lookups from "../loginAccountLookupCallers";
import * as identity from "../loginIdentityBridge";
import * as session from "../userSessionCreationCaller";
import * as cleanup from "../logoutDependencies";
import * as challenges from "../../auth/verificationChallengeComposition";

const state = vi.hoisted(() => ({ now: 1000, delays: [] as number[], mail: 0, transport: 0, clients: 0 }));
vi.mock("../serviceRoleClient", async importOriginal => {
  const real = await importOriginal<typeof service>();
  return { ...real, createServiceRoleClient: () => { state.clients++; return real.createServiceRoleClient(); } };
});
vi.mock("node:timers/promises", () => ({ setTimeout: async (milliseconds: number) => {
  state.delays.push(milliseconds); state.now += milliseconds;
} }));
vi.mock("../../auth/localSmtpVerificationCodeDelivery", () => ({
  createLocalSmtpVerificationCodeTransport: () => { state.transport++; return { send: async () => { state.mail++; return { outcome: "accepted" }; } }; },
}));

const ORIGIN = "http://127.0.0.1:4321";
const PROVIDER = "http://127.0.0.1:54321";
const PRIVATE = "factory-private-fixture-canary";
const EMAIL = "stored@example.invalid";
const PASSWORD = " \t" + PRIVATE + "\r\n";
const EPOCH = 2_000_000_000;
const ID = { account: "11111111-1111-4111-8111-111111111111", contact: "22222222-2222-4222-8222-222222222222",
  provider: "33333333-3333-4333-8333-333333333333", challenge: "44444444-4444-4444-8444-444444444444",
  old: "55555555-5555-4555-8555-555555555555", session: "66666666-6666-4666-8666-666666666666",
  other: "77777777-7777-4777-8777-777777777777" };
const CONFIG: Configuration = Object.freeze({ responseFloorMilliseconds: 1.5, accountLookupTimeoutMilliseconds: 101,
  challengeOwnershipTimeoutMilliseconds: 102, challengeConfirmationTimeoutMilliseconds: 103,
  providerTimeoutMilliseconds: 104, sessionCreationTimeoutMilliseconds: 105 });
const FIXED_ERROR = "SolMind password-role sign-in dependencies are unavailable.";
const CONSOLE = ["log", "info", "warn", "error", "debug", "trace"] as const;

// Deliberate source-frame distance from synthetic private fixtures. A failing
// Boolean assertion must not cause the reporter to print nearby credentials.





const yes = (value: boolean, label: string) => expect(value, label).toBe(true);
const same = (actual: unknown, expected: unknown, label: string) => yes(isDeepStrictEqual(actual, expected), label);
function fixedFailure(action: () => unknown) {
  let caught: unknown; try { action(); } catch (error) { caught = error; }
  yes(caught instanceof Error && caught.message === FIXED_ERROR, "fixed configuration failure");
}





const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
function token(subject: string, sessionId: string, exp = EPOCH + 3600) {
  return encode({ alg: "HS256", typ: "JWT" }) + "." + encode({ iss: PROVIDER + "/auth/v1", aud: "authenticated",
    sub: subject, session_id: sessionId, exp, iat: EPOCH - 10, role: "authenticated" }) + ".c3ludGhldGlj";
}
function candidate(subject: string = ID.provider, sessionId: string = ID.old) {
  return { accessToken: token(subject, sessionId), refreshToken: PRIVATE, proof: PRIVATE };
}
function cookies(pair = candidate()) {
  return [{ name: "solmind-auth", value: "base64-" + encode({ access_token: pair.accessToken,
    refresh_token: pair.refreshToken, solmind_pair_proof: pair.proof, expires_at: EPOCH + 3600, user: null }) }];
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", "X-Supabase-Api-Version": "2024-01-01" } });
}
function request(role: "guide" | "admin", verify: boolean) {
  return new NextRequest(ORIGIN + "/login/" + role + (verify ? "/verify" : "/send"), { method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json", "sec-fetch-site": "same-origin" },
    body: JSON.stringify({ identifier: role === "guide" ? "Typed@Example.Invalid" : " ADMIN-User ",
      ...(verify ? { password: PASSWORD, challengeId: ID.challenge, code: "123456" } : {}) }) });
}
function edge() {
  const events: string[] = []; const calls: { name: string; body: unknown; authorization: string | null }[] = [];
  let owned = true; let password = true; let confirmedRefusal = false; let revokeFails = false; let failRpc = false; let redeemed = true;
  let holdUser: (() => Promise<Response>) | undefined;
  const send = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    yes(url.origin === PROVIDER, "all fake requests use the synthetic provider");
    const name = url.pathname.startsWith("/rest/v1/rpc/") ? url.pathname.slice(13) : url.pathname + url.search;
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as unknown : null;
    const authorization = new Headers(init?.headers).get("authorization"); calls.push({ name, body, authorization });
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      if (failRpc) throw new Error(PRIVATE);
      if (name === "solmind_resolve_login_account") { events.push("lookup"); return json([{ user_account_id: ID.account,
        user_contact_method_id: ID.contact, normalized_contact_value: EMAIL, provider_user_id: ID.provider }]); }
      if (name === "solmind_check_login_challenge_owner") { events.push("ownership"); return json([{ owned }]); }
      if (name === "solmind_record_login_password_failure") { events.push("password_failure"); return json([{ recorded: true }]); }
      if (name === "solmind_redeem_verification_challenge") { events.push("redeem"); return json([{ outcome: redeemed ? "redeemed" : "denied" }]); }
      if (name === "solmind_confirm_redeemed_login_challenge") { events.push("confirm"); return json([{ confirmed: true }]); }
      if (name === "solmind_create_user_session") { events.push("session"); return json([{ outcome: "created",
        user_session_id: ID.session, expires_at: new Date((EPOCH + 120) * 1000).toISOString() }]); }
      if (name === "solmind_issue_verification_challenge") { events.push("issue"); return json([{ outcome: "issued" }]); }
    }
    if (name === "/auth/v1/token?grant_type=password") {
      events.push("password"); same(body, { email: EMAIL, password: PASSWORD, gotrue_meta_security: {} }, "SDK sends only fresh password credentials");
      if (!password) return confirmedRefusal
        ? json({ code: "invalid_credentials", message: PRIVATE }, 400)
        : json({ error: "invalid_grant", error_description: PRIVATE }, 400);
      return json({ access_token: token(ID.provider, ID.session), refresh_token: PRIVATE, token_type: "bearer", expires_in: 3600,
        expires_at: EPOCH + 3600, user: { id: ID.provider, aud: "authenticated", role: "authenticated", email: EMAIL,
          app_metadata: { provider: "email" }, user_metadata: {} } });
    }
    if (name === "/auth/v1/user") { events.push("prior_verify"); return holdUser ? holdUser() : json({ id: ID.provider }); }
    if (name === "/auth/v1/logout?scope=local") {
      const old = authorization === "Bearer " + token(ID.provider, ID.old); events.push(old ? "prior_revoke" : "fresh_discard");
      return revokeFails ? json({ message: PRIVATE }, 500) : new Response(null, { status: 204 });
    }
    throw new Error("unexpected synthetic operation");
  });
  vi.stubGlobal("fetch", send);
  return { events, calls, send, wrongOwner: () => { owned = false; }, wrongPassword: () => { password = false; },
    confirmedWrongPassword: () => { password = false; confirmedRefusal = true; },
    wrongCode: () => { redeemed = false; }, failRevoke: () => { revokeFails = true; }, failRpc: () => { failRpc = true; }, holdUser: (fn: () => Promise<Response>) => { holdUser = fn; } };
}

beforeEach(() => {
  state.now = 1000; state.delays = []; state.mail = 0; state.transport = 0; state.clients = 0;
  vi.spyOn(performance, "now").mockImplementation(() => state.now);
  vi.spyOn(Date, "now").mockReturnValue(EPOCH * 1000);
  for (const name of CONSOLE) vi.spyOn(console, name).mockImplementation(() => {});
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  vi.stubGlobal("fetch", () => { throw new Error("network forbidden in fixture"); });
  vi.stubEnv("SOLMIND_TRUSTED_APP_ORIGIN", ORIGIN); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", PROVIDER);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "synthetic-key"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-service-key");
  vi.stubEnv("SOLMIND_VERIFICATION_PEPPER", Buffer.alloc(32, 17).toString("base64url"));
  vi.stubEnv("NEXT_PUBLIC_SOLMIND_VERIFICATION_PEPPER", undefined);
  vi.stubEnv("SOLMIND_CREDENTIAL_PAIR_PROOF_KEY_BASE64", undefined);
});
afterEach(() => {
  try { for (const name of CONSOLE) yes(vi.mocked(console[name]).mock.calls.length === 0, "no console values"); }
  finally { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); }
});

describe("exact request-scoped factory", () => {
  it("exports one runtime factory and construction loads no environment or client", () => {
    same(Object.keys(factory), ["createPasswordRoleSignInHttpPorts"], "one public runtime surface");
    const services = vi.spyOn(service, "createServiceRoleClient"); const challengesSpy = vi.spyOn(challenges, "createVerificationChallengeServices");
    vi.stubEnv("SOLMIND_VERIFICATION_PEPPER", undefined); vi.stubEnv("SOLMIND_TRUSTED_APP_ORIGIN", undefined);
    const ports = factory.createPasswordRoleSignInHttpPorts(CONFIG, () => []);
    same(Object.keys(ports).sort(), ["createSendPorts", "createVerifyPorts", "loadTrustedOrigin", "readCookies"], "exact HTTP ports");
    yes(services.mock.calls.length === 0 && challengesSpy.mock.calls.length === 0 && state.transport === 0, "no construction effects");
    fixedFailure(() => ports.loadTrustedOrigin());
  });
  it("rejects malformed configuration without running accessors or constructors", () => {
    const services = vi.spyOn(service, "createServiceRoleClient"); let getter = 0;
    const bad: unknown[] = [null, [], {}, { ...CONFIG, extra: 1 }, Object.create(CONFIG),
      Object.defineProperty({ ...CONFIG }, "responseFloorMilliseconds", { get() { getter++; return 1; } }),
      { ...CONFIG, [Symbol("extra")]: 1 }, Object.defineProperty({ ...CONFIG }, "responseFloorMilliseconds", { enumerable: false })];
    for (const key of Object.keys(CONFIG)) {
      bad.push({ ...CONFIG, [key]: undefined }, { ...CONFIG, [key]: NaN }, { ...CONFIG, [key]: Infinity }, { ...CONFIG, [key]: "10" });
      if (key !== "responseFloorMilliseconds") for (const value of [9, 60_001, 10.5]) bad.push({ ...CONFIG, [key]: value });
    }
    for (const value of [0, -1, 2_147_483_648]) bad.push({ ...CONFIG, responseFloorMilliseconds: value });
    for (const value of bad) fixedFailure(() => factory.createPasswordRoleSignInHttpPorts(value as Configuration, () => []));
    fixedFailure(() => factory.createPasswordRoleSignInHttpPorts(CONFIG, null as never));
    yes(getter === 0 && services.mock.calls.length === 0, "invalid inputs have no capability effects");
  });
  it("snapshots accepted values and accepts caller range boundaries", () => {
    for (const budget of [10, 60_000]) {
      const mutable = Object.fromEntries(Object.keys(CONFIG).map(k => [k, k === "responseFloorMilliseconds" ? 0.25 : budget])) as unknown as Configuration;
      const ports = factory.createPasswordRoleSignInHttpPorts(mutable, () => []);
      (mutable as { responseFloorMilliseconds: number }).responseFloorMilliseconds = 999;
      yes(ports.createSendPorts(ORIGIN).responseFloorMilliseconds === 0.25, "configuration snapshot survives caller mutation");
      yes(ports.createVerifyPorts(ORIGIN, null).createVerifyDependencies(ORIGIN).ownership !== undefined, "deadline boundary composes");
    }
  });
  it("refuses hosted or mismatched origin before constructing transports", () => {
    const ports = factory.createPasswordRoleSignInHttpPorts(CONFIG, () => []);
    for (const verify of [false, true]) {
      const core = verify ? ports.createVerifyPorts("https://example.invalid", null) : ports.createSendPorts("https://example.invalid");
      fixedFailure(() => verify ? core.createVerifyDependencies("https://example.invalid") : core.createSendDependencies("https://example.invalid"));
    }
    fixedFailure(() => ports.createSendPorts(ORIGIN).createSendDependencies(ORIGIN + "/"));
    fixedFailure(() => ports.createVerifyPorts(ORIGIN, null).createVerifyDependencies("http://localhost:4321"));
    yes(state.transport === 0, "local delivery never composed for rejected origin");
  });
  it("wires all five distinct deadlines and narrows the bridge without a link client", async () => {
    const lookup = vi.spyOn(lookups, "createLoginAccountLookup"); const owner = vi.spyOn(lookups, "createLoginChallengeOwnershipCheck");
    const confirm = vi.spyOn(lookups, "createRedeemedLoginChallengeConfirmation"); const bridge = vi.spyOn(identity, "createLoginIdentityBridge");
    const creator = vi.spyOn(session, "createUserSessionCreator");
    const recorder = vi.spyOn(lookups, "createLoginPasswordFailureRecorder");
    const ports = factory.createPasswordRoleSignInHttpPorts(CONFIG, () => []).createVerifyPorts(ORIGIN, null);
    const dependencies = ports.createVerifyDependencies(ORIGIN);
    same([lookup.mock.calls[0][0].rpcTimeoutMilliseconds, owner.mock.calls[0][0].rpcTimeoutMilliseconds,
      confirm.mock.calls[0][0].rpcTimeoutMilliseconds, bridge.mock.calls[0][0].providerTimeoutMilliseconds,
      creator.mock.calls[0][0].rpcTimeoutMilliseconds], [101, 102, 103, 104, 105], "distinct approved input mapping");
    same(recorder.mock.calls[0][0].rpcTimeoutMilliseconds, 102, "recorder reuses exact ownership timeout");
    yes(recorder.mock.calls[0][0].rpcClient === owner.mock.calls[0][0].rpcClient, "recorder reuses the ownership RPC client");
    yes(state.clients === 2 && state.transport === 1, "two clients, no privileged link client");
    same(Object.keys(dependencies.bridge), ["signInWithPassword"], "exact core bridge shape");
    same(await bridge.mock.calls[0][1].linkAdmin.generateLink({ type: "magiclink", email: EMAIL }), null, "inert mandatory link seam");
    fixedFailure(() => ports.createSendDependencies(ORIGIN));
  });
  it("requires complete configuration before the first RPC and discards constructor errors", async () => {
    const f = edge();
    for (const key of ["SOLMIND_VERIFICATION_PEPPER", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
      const prior = process.env[key]; vi.stubEnv(key, undefined);
      const response = await handlers.handleGuideSignInVerify(request("guide", true), factory.createPasswordRoleSignInHttpPorts(CONFIG, () => []));
      same(await response.json(), { outcome: "denied" }, "required configuration refuses before lookup"); vi.stubEnv(key, prior);
    }
    vi.spyOn(service, "createServiceRoleClient").mockImplementation(() => { throw new Error(PRIVATE); });
    fixedFailure(() => factory.createPasswordRoleSignInHttpPorts(CONFIG, () => []).createSendPorts(ORIGIN).createSendDependencies(ORIGIN));
    yes(f.send.mock.calls.length === 0, "configuration failure never spends a remote operation");
  });
  it("sends without cookie/Auth configuration or cleanup capability", async () => {
    const f = edge(); let reads = 0; vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);
    const bridge = vi.spyOn(identity, "createLoginIdentityBridge"); const cleanupSpy = vi.spyOn(cleanup, "createLogoutProviderCleanupDependencies");

    const response = await handlers.handleAdminSignInSend(request("admin", false), factory.createPasswordRoleSignInHttpPorts(CONFIG, () => { reads++; return []; }));
    const body = await response.json(); yes(body.acknowledgment === "verification_code_requested", "opaque send acknowledgment");
    same(f.events, ["lookup", "issue"], "real issuer follows lookup");
    yes(reads === 0 && bridge.mock.calls.length === 0 && cleanupSpy.mock.calls.length === 0 && state.mail === 1 && state.clients === 2, "send isolation");
    yes(response.cookies.getAll().length === 0, "send has no cookie writes");
  });
  it("uses the monotonic floor with clamped fractional maximum and independent epoch", async () => {
    state.now = 1.3;
    const p = factory.createPasswordRoleSignInHttpPorts({ ...CONFIG, responseFloorMilliseconds: 2_147_483_647 }, () => []).createSendPorts(ORIGIN);
    await p.waitUntil(p.now() + p.responseFloorMilliseconds);
    yes(state.delays.length > 0 && state.delays.every(x => x > 0 && x <= 2_147_483_647), "no timer overflow");
    yes(p.now() >= 1.3 + p.responseFloorMilliseconds && p.epochSeconds() === EPOCH, "deadline rechecked, epoch independent");
    for (const value of [NaN, Infinity, -1]) { let rejected = false; try { await p.waitUntil(value); } catch { rejected = true; } yes(rejected, "invalid wait refuses"); }
  });
});

describe("actual HTTP/core/factory/bridge with fake external IO", () => {
  for (const role of ["guide", "admin"] as const) it(role + " reaches accepted session and exact cookies with only password capability", async () => {
    const f = edge(); const response = await (role === "guide" ? handlers.handleGuideSignInVerify : handlers.handleAdminSignInVerify)(
      request(role, true), factory.createPasswordRoleSignInHttpPorts(CONFIG, () => cookies()));
    same(await response.json(), { outcome: "signed_in", destination: "/" + role + "/home" }, "connected in-memory result");
    same(f.events, ["lookup", "ownership", "password", "redeem", "confirm", "session", "prior_verify", "prior_revoke"], "fresh factors/session before prior cleanup");
    yes(response.cookies.getAll().some(x => x.name === "solmind-auth" && x.value.startsWith("base64-")), "fresh cookie published");
    yes(!f.calls.some(x => x.name.includes("refresh_token") || x.name.includes("admin/generate_link")), "no refresh or link path");
  });
  for (const reason of ["owner", "password"] as const) it(reason + " refusal stops all later work and writes no cookies", async () => {
    const f = edge(); if (reason === "owner") f.wrongOwner(); else f.wrongPassword();
    const response = await handlers.handleGuideSignInVerify(request("guide", true), factory.createPasswordRoleSignInHttpPorts(CONFIG, () => cookies()));
    same(await response.json(), { outcome: "not_matched" }, "common refusal");
    same(f.events, reason === "owner" ? ["lookup", "ownership"] : ["lookup", "ownership", "password"], "factor order cannot be bypassed");
    yes(response.cookies.getAll().length === 0, "refusal preserves old browser state");
  });
  for (const role of ["guide", "admin"] as const) it(role + " confirmed invalid credentials reach one bounded failure recorder only", async () => {
    const f = edge(); f.confirmedWrongPassword();
    const ports = factory.createPasswordRoleSignInHttpPorts(CONFIG, () => cookies());
    const response = role === "guide"
      ? await handlers.handleGuideSignInVerify(request(role, true), ports)
      : await handlers.handleAdminSignInVerify(request(role, true), ports);
    same(await response.json(), { outcome: "not_matched" }, "existing outward refusal remains unchanged");
    same(f.events, ["lookup", "ownership", "password", "password_failure"], "real factory/core/SDK/caller order");
    const records = f.calls.filter(x => x.name === "solmind_record_login_password_failure");
    yes(records.length === 1, "one fixed RPC and no automatic retry");
    same(records[0].body, { p_user_account_id: ID.account, p_verification_challenge_id: ID.challenge, p_role_context: role }, "record payload contains no typed credentials");
    yes(response.cookies.getAll().length === 0 && !f.events.includes("redeem") && !f.events.includes("session"), "refusal has no code redemption or session effect");
  });
  for (const kind of ["same", "different"] as const) it(kind + " prior session is never revoked", async () => {
    const f = edge(); const old = kind === "same" ? candidate(ID.provider, ID.session) : candidate(ID.other, ID.old);
    const response = await handlers.handleAdminSignInVerify(request("admin", true), factory.createPasswordRoleSignInHttpPorts(CONFIG, () => cookies(old)));
    yes((await response.json()).outcome === "signed_in", "fresh acceptance unaffected");
    yes(!f.events.includes("prior_verify") && !f.events.includes("prior_revoke") && !f.events.includes("fresh_discard"), "forbidden target not touched");
  });
  it("captures only an own access token; malicious refresh/proof getters stay unread", async () => {
    const f = edge(); let getters = 0; const input = Object.defineProperties({ accessToken: token(ID.provider, ID.old) }, {
      refreshToken: { get() { getters++; throw new Error(PRIVATE); } }, proof: { get() { getters++; throw new Error(PRIVATE); } } });
    const p = factory.createPasswordRoleSignInHttpPorts(CONFIG, () => []);
    const original = cleanup.createLogoutProviderCleanupDependencies;
    const spy = vi.spyOn(cleanup, "createLogoutProviderCleanupDependencies");
    let captured: unknown;
    spy.mockImplementation((...args) => { const real = original(...args); return real && { ...real,
      cleanupPrevious: async (prior, fresh) => { captured = prior; return real.cleanupPrevious(prior, fresh); } }; });
    const core = p.createVerifyPorts(ORIGIN, input as never); input.accessToken = token(ID.other, ID.old);
    const response = await handlers.handleGuideSignInVerify(request("guide", true), { ...p, createVerifyPorts: () => core });
    yes((await response.json()).outcome === "signed_in" && getters === 0, "optional fields cannot execute");
    same(captured, { accessToken: token(ID.provider, ID.old) }, "access-only snapshot cannot change");
    yes(f.events.includes("prior_revoke"), "original eligible prior token used");
  });
  it("skips unavailable optional cleanup and preserves otherwise accepted login", async () => {
    const f = edge(); vi.spyOn(cleanup, "createLogoutProviderCleanupDependencies").mockImplementation(() => { throw new Error(PRIVATE); });
    const response = await handlers.handleGuideSignInVerify(request("guide", true), factory.createPasswordRoleSignInHttpPorts(CONFIG, () => cookies()));
    yes((await response.json()).outcome === "signed_in" && !f.events.includes("prior_verify"), "optional constructor failure is not login authority");
  });
  it("signals failed optional cleanup once without exposing provider errors or vetoing login", async () => {
    const f = edge(); f.failRevoke();
    const response = await handlers.handleGuideSignInVerify(request("guide", true), factory.createPasswordRoleSignInHttpPorts(CONFIG, () => cookies()));
    yes((await response.json()).outcome === "signed_in", "optional failure does not veto fresh session");
    same(vi.mocked(process.stderr.write).mock.calls.map(x => x[0]), ["solmind_login_prior_session_cleanup_failed\n"], "fixed single cleanup signal");
    yes(!f.events.includes("fresh_discard"), "fresh identity not revoked");
  });
  it("a rejected RPC stays value-free and never authenticates", async () => {
    const f = edge(); f.failRpc();
    const response = await handlers.handleGuideSignInVerify(request("guide", true), factory.createPasswordRoleSignInHttpPorts(CONFIG, () => []));
    same(await response.json(), { outcome: "not_matched" }, "operational lookup refusal remains closed");
    yes(!f.events.includes("password"), "no provider after failed lookup");
  });
});

describe("current cleanup completion boundaries", () => {
  it("invalid optional access property cannot execute or prevent fresh authentication", async () => {
    const f = edge(); let getter = 0;
    const candidate = Object.defineProperty({}, "accessToken", { get() { getter++; throw new Error(PRIVATE); } });
    const p = factory.createPasswordRoleSignInHttpPorts(CONFIG, () => []);
    const core = p.createVerifyPorts(ORIGIN, candidate as never);
    const response = await handlers.handleGuideSignInVerify(request("guide", true), { ...p, createVerifyPorts: () => core });
    yes((await response.json()).outcome === "signed_in" && getter === 0 && !f.events.includes("prior_verify"), "malformed optional context skipped");
  });
  it("mandatory failed-attempt discard remains a refusal even when revocation fails", async () => {
    const f = edge(); f.wrongCode(); f.failRevoke();
    const response = await handlers.handleGuideSignInVerify(request("guide", true), factory.createPasswordRoleSignInHttpPorts(CONFIG, () => cookies()));
    same(await response.json(), { outcome: "not_matched" }, "failed code cannot publish identity");
    yes(f.events.includes("fresh_discard") && !f.events.includes("session") && !f.events.includes("prior_verify"), "mandatory cleanup precedes any new session");
    yes(response.cookies.getAll().length === 0, "discarded hold never releases");
    same(vi.mocked(process.stderr.write).mock.calls.map(x => x[0]), ["solmind_login_identity_cleanup_failed\n"], "fixed mandatory signal");
  });
  it("best-effort signal failure cannot veto an accepted fresh session", async () => {
    const f = edge(); f.failRevoke(); vi.mocked(process.stderr.write).mockImplementation(() => { throw new Error(PRIVATE); });
    const response = await handlers.handleGuideSignInVerify(request("guide", true), factory.createPasswordRoleSignInHttpPorts(CONFIG, () => cookies()));
    yes((await response.json()).outcome === "signed_in" && !f.events.includes("fresh_discard"), "failed operational sink has no login authority");
  });
  it("optional timeout and late completion cannot revoke fresh login or duplicate its signal", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const f = edge(); let enter!: () => void; let release!: (response: Response) => void;
    const entered = new Promise<void>(resolve => { enter = resolve; });
    const pending = new Promise<Response>(resolve => { release = resolve; });
    f.holdUser(() => { enter(); return pending; });
    const task = handlers.handleGuideSignInVerify(request("guide", true), factory.createPasswordRoleSignInHttpPorts(CONFIG, () => cookies()));
    await entered;
    await vi.advanceTimersByTimeAsync(6_000);
    const response = await task;
    yes((await response.json()).outcome === "signed_in", "bounded optional timeout does not veto login");
    release(json({ id: ID.provider }));
    await vi.advanceTimersByTimeAsync(1);
    yes(!f.events.includes("prior_revoke") && !f.events.includes("fresh_discard"), "closed late verification cannot add effects");
    same(vi.mocked(process.stderr.write).mock.calls.map(x => x[0]), ["solmind_login_prior_session_cleanup_failed\n"], "timeout signal remains single");
    yes(vi.getTimerCount() === 0, "owned timeout timers removed");
  });
});

describe("module and credential-pair configuration", () => {
  it("reimports without reading required environment or invoking any remote/client capability", async () => {
    vi.stubEnv("SOLMIND_VERIFICATION_PEPPER", undefined); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    const fetchSpy = vi.fn(() => { throw new Error("forbidden import IO"); }); vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();
    const imported = await import("../passwordRoleSignInDependencies");
    yes(typeof imported.createPasswordRoleSignInHttpPorts === "function" && state.clients === 0 && state.transport === 0 && fetchSpy.mock.calls.length === 0, "import remains inert");
  });
  it("uses the current dedicated pair context and key without treating old proof as authority", async () => {
    const f = edge(); vi.stubEnv("SOLMIND_CREDENTIAL_PAIR_PROOF_KEY_BASE64", Buffer.alloc(32, 23).toString("base64"));
    const bridge = vi.spyOn(identity, "createLoginIdentityBridge");
    const response = await handlers.handleGuideSignInVerify(request("guide", true), factory.createPasswordRoleSignInHttpPorts(CONFIG, () => cookies()));
    yes((await response.json()).outcome === "signed_in", "dedicated pair configuration supports ordinary fresh login");
    same(bridge.mock.calls[0][0].credentialPairContext, { applicationOrigin: ORIGIN, providerIssuer: PROVIDER + "/auth/v1", providerAudience: "authenticated" }, "exact origin issuer audience binding");
    const value = response.cookies.getAll().filter(x => x.name === "solmind-auth" || /^solmind-auth\.\d+$/.test(x.name))
      .sort((x, y) => x.name.localeCompare(y.name)).map(x => x.value).join("");
    const parsed = JSON.parse(Buffer.from(value.slice(7), "base64url").toString("utf8")) as Record<string, unknown>;
    yes(typeof parsed.solmind_pair_proof === "string" && parsed.solmind_pair_proof !== PRIVATE, "fresh proof minted by current bridge");
    yes(f.events.includes("prior_revoke") && !f.calls.some(x => x.name.includes("refresh_token")), "old invalid proof does not grant renewal authority");
  });
});
