import { Buffer } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Only the transport-producing library constructor is replaced. The actual
// identity adapter, RPC dispatcher, query mapper, selection, binding and policy run.
const transport = vi.hoisted(() => ({
  getUser: vi.fn(), rpc: vi.fn(), build: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => transport.build(...args),
}));

import { resolveExplorerHomeAccess } from "../explorerHomeAccess";
import { createInMemoryRequestCookieAccessor, type RequestCookie } from "../requestCookieAccessor";
import { EXPLORER_HOME_ROUTE, SOLMIND_ROUTE_ACCESS_RULES, canSolMindRoleAccessRoute } from "../../routeAccess";
import { SOLMIND_ROLES, SOLMIND_ROLE_HOME_ROUTES } from "../../roles";

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const PROVIDER = "22222222-2222-4222-8222-222222222222";
const SESSION = "33333333-3333-4333-8333-333333333333";
const OTHER = "44444444-4444-4444-8444-444444444444";
const PRIVATE = "HOME_PRIVATE_CANARY_not_for_output";
const TOKEN = "synthetic.HOME_PRIVATE_CANARY.signature";
const NOW = "2026-10-16T23:00:00.000Z";
const END = "2026-10-17T00:00:00.000Z";
const DENIED = { allowed: false, reason: "route_access_denied" };
type Row = Record<string, unknown>;
let rows: Record<string, Row[]>;
let output: Array<ReturnType<typeof vi.spyOn>>;
let network: ReturnType<typeof vi.fn>;

function cookieEntries(): RequestCookie[] {
  const session = { access_token: TOKEN, refresh_token: PRIVATE, expires_at: 1792195200, user: null };
  return [
    { name: "solmind-auth", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}` },
    { name: "solmind-session", value: SESSION },
  ];
}
function request(entries = cookieEntries(), now = () => new Date(NOW)) {
  return resolveExplorerHomeAccess({ cookies: createInMemoryRequestCookieAccessor(entries), now });
}
function change(name: string, patch: Row) {
  rows[`solmind_find_${name}`] = [{ ...rows[`solmind_find_${name}`][0], ...patch }];
}
async function expectDenied(result: ReturnType<typeof request>) {
  const actual = await result;
  // Boolean assertions avoid printing a secret-bearing unexpected result.
  expect(JSON.stringify(actual) === JSON.stringify(DENIED)).toBe(true);
  expect(Object.isFrozen(actual)).toBe(true);
}

beforeEach(() => {
  vi.resetAllMocks();
  output = [vi.spyOn(console, "log"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];
  for (const spy of output) spy.mockImplementation(() => undefined);
  network = vi.fn(() => { throw new Error("Unexpected network access"); });
  vi.stubGlobal("fetch", network);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "synthetic-anon");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-service");
  vi.stubEnv("SOLMIND_TRUSTED_APP_ORIGIN", "http://127.0.0.1:4321");
  rows = {
    solmind_find_auth_provider_identity: [{ user_account_id: ACCOUNT, provider_name: "supabase", provider_user_id: PROVIDER, status: "active" }],
    solmind_find_user_account: [{ user_account_id: ACCOUNT, account_status: "active" }],
    solmind_find_active_user_sessions: [{ user_session_id: SESSION, user_account_id: ACCOUNT, active_role_context: SOLMIND_ROLES.EXPLORER, session_status: "active", expires_at: END }],
    solmind_find_active_role_assignment: [{ user_account_id: ACCOUNT, role_code: SOLMIND_ROLES.EXPLORER, role_status: "active" }],
    solmind_find_guide_profile: [],
    solmind_find_explorer_profile: [{ explorer_profile_id: OTHER, user_account_id: ACCOUNT, status: "active" }],
  };
  transport.getUser.mockResolvedValue({ data: { user: { id: PROVIDER } }, error: null });
  transport.rpc.mockImplementation(async (name: string) => ({ data: rows[name] ?? null, error: null }));
  transport.build.mockImplementation((_url: unknown, key: unknown) => {
    if (key === "synthetic-anon") return { auth: { getUser: transport.getUser } };
    if (key === "synthetic-service") return { rpc: transport.rpc };
    throw new Error("Unexpected client configuration");
  });
});
afterEach(() => {
  const printed = output.some((spy) => spy.mock.calls.length !== 0);
  const escapedNetwork = network.mock.calls.length !== 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  expect(printed).toBe(false);
  expect(escapedNetwork).toBe(false);
});

describe("fixed Explorer home server access", () => {
  it("allows the bound Explorer with only frozen expiry and observation props", async () => {
    const result = await request();
    expect(JSON.stringify(result) === JSON.stringify({ allowed: true, expiresAt: END, observedAt: NOW })).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    expect(transport.getUser.mock.calls.length).toBe(1);
    expect(transport.getUser.mock.calls[0].length === 1 && transport.getUser.mock.calls[0][0] === TOKEN).toBe(true);
    expect(transport.rpc.mock.calls.map((call) => call[0])).toEqual(Object.keys(rows));
    expect(transport.rpc.mock.calls.every((call) => !JSON.stringify(call).includes(PRIVATE))).toBe(true);
    const anon = transport.build.mock.calls.find((call) => call[1] === "synthetic-anon");
    expect(JSON.stringify(anon?.[2]) === JSON.stringify({ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, skipAutoInitialize: true } })).toBe(true);
  });

  it("adds one exact Explorer rule and leaves prototype destinations unchanged", () => {
    expect(EXPLORER_HOME_ROUTE).toBe("/explorer/home");
    expect(SOLMIND_ROUTE_ACCESS_RULES.length).toBe(4);
    expect(SOLMIND_ROUTE_ACCESS_RULES.slice(0, 3).map((rule) => rule.route)).toEqual(["/admin", "/guide", "/explorer"]);
    expect(SOLMIND_ROLE_HOME_ROUTES.explorer).toBe("/explorer");
    expect(canSolMindRoleAccessRoute(SOLMIND_ROLES.EXPLORER, EXPLORER_HOME_ROUTE)).toBe(true);
    for (const role of [SOLMIND_ROLES.GUIDE, SOLMIND_ROLES.ADMIN]) expect(canSolMindRoleAccessRoute(role, EXPLORER_HOME_ROUTE)).toBe(false);
    expect(canSolMindRoleAccessRoute(SOLMIND_ROLES.EXPLORER, "/explorer/home/other")).toBe(false);
  });

  it.each(["missing", "malformed", "missing-binding", "duplicate-binding", "wrong-binding-shape"])("denies %s credentials before provider or record IO", async (kind) => {
    let entries = cookieEntries();
    if (kind === "missing") entries = [];
    if (kind === "malformed") entries[0].value = PRIVATE;
    if (kind === "missing-binding") entries.pop();
    if (kind === "duplicate-binding") entries.push({ ...entries[1] });
    if (kind === "wrong-binding-shape") entries[1].value = PRIVATE;
    await expectDenied(request(entries));
    expect(transport.getUser.mock.calls.length).toBe(0);
    expect(transport.rpc.mock.calls.length).toBe(0);
  });

  it.each(["null", "error", "throw"])("denies provider %s without any record read", async (kind) => {
    if (kind === "null") transport.getUser.mockResolvedValue({ data: { user: null }, error: null });
    if (kind === "error") transport.getUser.mockResolvedValue({ data: { user: { id: PROVIDER } }, error: PRIVATE });
    if (kind === "throw") transport.getUser.mockRejectedValue(new Error(PRIVATE));
    await expectDenied(request());
    expect(transport.rpc.mock.calls.length).toBe(0);
  });

  it("denies a throwing cookie accessor without leaking or writing", async () => {
    const setAll = vi.fn();
    await expectDenied(resolveExplorerHomeAccess({ cookies: { getAll() { throw new Error(PRIVATE); }, setAll } }));
    expect(setAll.mock.calls.length).toBe(0);
    expect(transport.rpc.mock.calls.length).toBe(0);
  });

  it.each(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SOLMIND_TRUSTED_APP_ORIGIN"])("denies absent %s configuration", async (key) => {
    vi.stubEnv(key, "");
    await expectDenied(request());
    expect(transport.rpc.mock.calls.length).toBe(0);
  });

  it.each([
    ["auth_provider_identity", { status: "inactive" }],
    ["auth_provider_identity", { provider_user_id: OTHER }],
    ["user_account", { user_account_id: OTHER }],
    ["user_account", { account_status: "inactive" }],
    ["active_user_sessions", { user_account_id: OTHER }],
    ["active_user_sessions", { session_status: "logged_out" }],
    ["active_role_assignment", { user_account_id: OTHER }],
    ["active_role_assignment", { role_code: SOLMIND_ROLES.GUIDE }],
    ["active_role_assignment", { role_status: "inactive" }],
    ["explorer_profile", { user_account_id: OTHER }],
  ] as Array<[string, Row]>)("denies inconsistent %s records without disclosing them", async (name, patch) => {
    change(name, patch);
    await expectDenied(request());
  });

  it.each([SOLMIND_ROLES.GUIDE, SOLMIND_ROLES.ADMIN])("denies a valid %s session despite browser role and destination hints", async (role) => {
    change("active_user_sessions", { active_role_context: role });
    change("active_role_assignment", { role_code: role });
    const args = { cookies: createInMemoryRequestCookieAccessor(cookieEntries()), now: () => new Date(NOW), requestedRole: SOLMIND_ROLES.EXPLORER, requestedRoute: "/explorer" };
    await expectDenied(resolveExplorerHomeAccess(args));
  });

  it("does not inherit the same account's newer session from an old binding", async () => {
    change("active_user_sessions", { user_session_id: OTHER });
    await expectDenied(request());
  });

  it.each(["missing", "ambiguous", "expired", "equal", "invalid-expiry"])("denies %s session selection", async (kind) => {
    if (kind === "missing") rows.solmind_find_active_user_sessions = [];
    if (kind === "ambiguous") rows.solmind_find_active_user_sessions.push({ ...rows.solmind_find_active_user_sessions[0], user_session_id: OTHER });
    if (kind === "expired") change("active_user_sessions", { expires_at: "2026-10-16T22:59:59.999Z" });
    if (kind === "equal") change("active_user_sessions", { expires_at: NOW });
    if (kind === "invalid-expiry") change("active_user_sessions", { expires_at: PRIVATE });
    await expectDenied(request());
  });

  it.each(["error", "throw", "invalid-shape"])("denies record transport %s", async (kind) => {
    if (kind === "error") transport.rpc.mockResolvedValue({ data: [], error: PRIVATE });
    if (kind === "throw") transport.rpc.mockRejectedValue(new Error(PRIVATE));
    if (kind === "invalid-shape") transport.rpc.mockResolvedValue({ data: PRIVATE, error: null });
    await expectDenied(request());
  });

  it("checks expiry again when later record reads reach its inclusive boundary", async () => {
    const now = vi.fn().mockReturnValueOnce(new Date(NOW)).mockReturnValue(new Date(END));
    await expectDenied(request(cookieEntries(), now));
    expect(now.mock.calls.length).toBe(2);
  });

  it.each(["invalid", "throw"])("denies a final %s clock", async (kind) => {
    const now = vi.fn().mockReturnValueOnce(new Date(NOW)).mockImplementation(() => {
      if (kind === "throw") throw new Error(PRIVATE);
      return new Date(NaN);
    });
    await expectDenied(request(cookieEntries(), now));
  });

  it("does not invent a profile, onboarding or consent condition for the auth-only shell", async () => {
    rows.solmind_find_explorer_profile = [];
    expect((await request()).allowed).toBe(true);
  });

  it("rechecks each request after a session is retired and never writes cookies", async () => {
    const cookies = createInMemoryRequestCookieAccessor(cookieEntries());
    const setAll = vi.spyOn(cookies, "setAll");
    expect((await resolveExplorerHomeAccess({ cookies, now: () => new Date(NOW) })).allowed).toBe(true);
    change("active_user_sessions", { session_status: "logged_out" });
    await expectDenied(resolveExplorerHomeAccess({ cookies, now: () => new Date(NOW) }));
    expect(transport.getUser.mock.calls.length).toBe(2);
    expect(transport.build.mock.calls.length).toBe(4);
    expect(setAll.mock.calls.length).toBe(0);
  });
});
