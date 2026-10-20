import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveSessionCookiePolicy } from "../../auth/sessionCookiePolicy";
import { createLogoutDatabaseDependencies, createLogoutProviderCleanupDependencies } from "../logoutDependencies";

const ORIGIN = "http://127.0.0.1:54321";
const APP = "http://127.0.0.1:3000";
const PROVIDER_ID = "30000000-0000-4000-8000-000000000001";
const ACCOUNT_ID = "40000000-0000-4000-8000-000000000001";
const SESSION_ID = "50000000-0000-4000-8000-000000000001";
const KEY = "synthetic-public-key-dependencies";
const SERVICE = "synthetic-private-service-key-dependencies";
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzeW50aGV0aWMifQ.c3ludGhldGlj";
const ENV = { NEXT_PUBLIC_SUPABASE_URL: ORIGIN, NEXT_PUBLIC_SUPABASE_ANON_KEY: KEY, SUPABASE_SERVICE_ROLE_KEY: SERVICE };
const ROW = { user_account_id: ACCOUNT_ID, provider_name: "supabase", provider_user_id: PROVIDER_ID, status: "active" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const signal = () => new AbortController().signal;
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("independent concrete logout factories", () => {
  it.each(["\n", "\r", "\r\n", "\u2028", "\u2029"])("rejects terminated tokens/provider identifiers before I/O (case %#)", async (ending) => {
    const send = vi.fn();
    const deps = createLogoutDatabaseDependencies({ env: ENV, fetch: send })!;
    expect(await deps.identify(TOKEN + ending, signal())).toBeNull();
    expect(await deps.findAccount(PROVIDER_ID + ending, signal())).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("missing database key leaves the public provider cleanup factory available", () => {
    const env = { NEXT_PUBLIC_SUPABASE_URL: ORIGIN, NEXT_PUBLIC_SUPABASE_ANON_KEY: KEY };
    const send = vi.fn();
    expect(createLogoutDatabaseDependencies({ env, fetch: send })).toBeUndefined();
    expect(createLogoutProviderCleanupDependencies({ trustedOrigin: APP, policy: resolveSessionCookiePolicy(APP)! }, { env, fetch: send }) !== undefined).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });

  it("missing provider configuration makes both factories unavailable without a request", () => {
    const send = vi.fn();
    expect(createLogoutDatabaseDependencies({ env: { SUPABASE_SERVICE_ROLE_KEY: SERVICE }, fetch: send })).toBeUndefined();
    expect(createLogoutProviderCleanupDependencies({ trustedOrigin: APP, policy: resolveSessionCookiePolicy(APP)! }, { env: {}, fetch: send })).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects a policy from another configured origin", () => {
    expect(createLogoutProviderCleanupDependencies({ trustedOrigin: APP, policy: resolveSessionCookiePolicy("https://example.invalid")! },
      { env: ENV, fetch: vi.fn() })).toBeUndefined();
  });

  it("uses only the public key and explicit presented token for identity", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const deps = createLogoutDatabaseDependencies({ env: ENV, fetch: async (url, init) => {
      requests.push({ url: String(url), init: init! }); return json({ id: PROVIDER_ID });
    } })!;
    expect((await deps.identify(TOKEN, signal())) === PROVIDER_ID).toBe(true);
    expect(requests.length).toBe(1);
    expect(requests[0].url).toBe(`${ORIGIN}/auth/v1/user`);
    const headers = new Headers(requests[0].init.headers);
    expect(headers.get("authorization") === `Bearer ${TOKEN}`).toBe(true);
    expect(headers.get("apikey") === KEY && !JSON.stringify([...headers]).includes(SERVICE)).toBe(true);
    expect(requests[0].init.redirect).toBe("error");
  });

  it("returns only the exact active provider mapping without querying account or current session", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const deps = createLogoutDatabaseDependencies({ env: ENV, fetch: async (url, init) => {
      requests.push({ url: String(url), init: init! }); return json([ROW]);
    } })!;
    expect((await deps.findAccount(PROVIDER_ID, signal())) === ACCOUNT_ID).toBe(true);
    expect(requests.length).toBe(1);
    expect(requests[0].url).toBe(`${ORIGIN}/rest/v1/rpc/solmind_find_auth_provider_identity`);
    expect(requests[0].init.body === JSON.stringify({ p_provider_name: "supabase", p_provider_user_id: PROVIDER_ID })).toBe(true);
    const headers = new Headers(requests[0].init.headers);
    expect(headers.get("authorization") === `Bearer ${SERVICE}` && headers.get("apikey") === SERVICE).toBe(true);
  });

  it.each([[], [ROW, ROW], [{ ...ROW, status: "inactive" }], [{ ...ROW, provider_user_id: ACCOUNT_ID }],
    [{ ...ROW, provider_name: "other" }], [{ ...ROW, user_account_id: "invalid" }], [{ ...ROW, extra: true }]].map((answer) => ({ answer })))(
    "rejects ambiguous, inactive, mismatched and malformed provider mappings (case %#)", async ({ answer }) => {
      const send = vi.fn(async () => json(answer));
      const deps = createLogoutDatabaseDependencies({ env: ENV, fetch: send })!;
      expect(await deps.findAccount(PROVIDER_ID, signal())).toBeNull();
      expect(send).toHaveBeenCalledTimes(1);
    });

  it("uses the exact logout caller argument pair and never retries an uncertain error", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const deps = createLogoutDatabaseDependencies({ env: ENV, fetch: async (url, init) => {
      requests.push({ url: String(url), init: init! }); return json({ message: SERVICE }, 503);
    } })!;
    expect(await deps.endSession(ACCOUNT_ID, SESSION_ID)).toBe("failed");
    expect(requests.length).toBe(1);
    expect(requests[0].url).toBe(`${ORIGIN}/rest/v1/rpc/solmind_logout_user_session`);
    expect(requests[0].init.body === JSON.stringify({ p_user_account_id: ACCOUNT_ID, p_user_session_id: SESSION_ID })).toBe(true);
  });

  it.each(["ended", "already_ended"])("preserves %s from the strict writer caller", async (outcome) => {
    const deps = createLogoutDatabaseDependencies({ env: ENV, fetch: async () => json([{ outcome }]) })!;
    expect(await deps.endSession(ACCOUNT_ID, SESSION_ID)).toBe(outcome);
  });

  it("pre-aborted identity/account signals dispatch no request", async () => {
    const controller = new AbortController(); controller.abort();
    const send = vi.fn();
    const deps = createLogoutDatabaseDependencies({ env: ENV, fetch: send })!;
    expect(await deps.identify(TOKEN, controller.signal)).toBeNull();
    expect(await deps.findAccount(PROVIDER_ID, controller.signal)).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("bounds an ignored abort and late identity rejection without library logging", async () => {
    vi.useFakeTimers();
    const logs: unknown[][] = [];
    for (const method of ["error", "warn", "log", "info", "debug", "trace"] as const) vi.spyOn(console, method).mockImplementation((...args) => { logs.push(args); });
    let reject!: (value: unknown) => void;
    const send = vi.fn(() => new Promise<Response>((_, fail) => { reject = fail; }));
    const deps = createLogoutDatabaseDependencies({ env: ENV, fetch: send })!;
    const pending = deps.identify(TOKEN, signal());
    await vi.advanceTimersByTimeAsync(3100);
    expect(await pending).toBeNull();
    reject(new Error(TOKEN));
    await vi.advanceTimersByTimeAsync(100);
    expect(send).toHaveBeenCalledTimes(1);
    expect(logs.length).toBe(0);
  });

  it("cancels a never-ending mapping body and refuses its late authority", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const send = vi.fn(async () => new Response(new ReadableStream({ pull() {}, cancel }), { headers: { "Content-Type": "application/json" } }));
    const deps = createLogoutDatabaseDependencies({ env: ENV, fetch: send })!;
    const pending = deps.findAccount(PROVIDER_ID, signal());
    await vi.advanceTimersByTimeAsync(3100);
    expect(await pending).toBeNull();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
