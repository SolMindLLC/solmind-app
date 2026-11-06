// Real Explorer handlers, request factories, authentication and notice gate.
// Cookies, Supabase Auth and RPC IO are synthetic. Feature ports have transparent
// call-through observers. The local provider-run loader is held so this proof
// cannot read operational files or call a provider.
import { Buffer } from "node:buffer";
import { NextRequest } from "next/server";
import { createElement, isValidElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(), headers: vi.fn(), redirect: vi.fn(), getUser: vi.fn(), rpc: vi.fn(), client: vi.fn(),
  from: vi.fn(), schema: vi.fn(), featureRepositoryCall: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies, headers: mocks.headers }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...await importOriginal<typeof import("next/navigation")>(), redirect: mocks.redirect,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/solmind/supabase/serviceRoleClient", () => ({
  createServiceRoleClient: mocks.client,
}));
vi.mock("@/lib/solmind/operations/explorerPrivateLocalRunProfile", () => ({
  EXPLORER_PRIVATE_LOCAL_CALL_LEDGER_ROOT: "synthetic-unused-ledger-root",
  loadExplorerPrivateLocalRun: () => null,
}));
vi.mock("@/lib/solmind/supabase/explorerEarlyTestNoticeRepository", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/solmind/supabase/explorerEarlyTestNoticeRepository")>();
  return { ...original, createExplorerEarlyTestNoticeRepository: vi.fn(original.createExplorerEarlyTestNoticeRepository) };
});
vi.mock("@/lib/solmind/supabase/applicationSettingReader", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/solmind/supabase/applicationSettingReader")>();
  return { ...original, readExplorerEarlyTestNoticeSetting: vi.fn(original.readExplorerEarlyTestNoticeSetting) };
});
vi.mock("@/lib/solmind/supabase/explorerPrivateConversationRepository", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/solmind/supabase/explorerPrivateConversationRepository")>();
  return {
    ...original,
    createExplorerPrivateConversationRepository(client: Parameters<typeof original.createExplorerPrivateConversationRepository>[0]) {
      const repository = original.createExplorerPrivateConversationRepository(client);
      const observed = Object.fromEntries(Object.entries(repository).map(([name, port]) => [
        name, (...args: unknown[]) => {
          mocks.featureRepositoryCall(`conversation.${name}`);
          return Reflect.apply(port, repository, args);
        },
      ]));
      return Object.freeze({ ...repository, ...observed });
    },
  };
});
vi.mock("@/lib/solmind/supabase/suggestedWaypointRpcExecutor", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/solmind/supabase/suggestedWaypointRpcExecutor")>();
  return {
    ...original,
    createSuggestedWaypointHumanRpcExecutor(client: Parameters<typeof original.createSuggestedWaypointHumanRpcExecutor>[0]) {
      const executor = original.createSuggestedWaypointHumanRpcExecutor(client);
      return Object.freeze({ execute(call: unknown) {
        mocks.featureRepositoryCall("suggestedWaypoint.execute");
        return executor.execute(call);
      } });
    },
  };
});

import { EXPLORER_EARLY_TEST_NOTICE_VERSION } from "@/lib/solmind/explorerEarlyTestNotice";
import { EXPLORER_EARLY_TEST_NOTICE_CAPABILITY_ENV } from "@/lib/solmind/auth/explorerEarlyTestNoticeAccess";
import { createExplorerEarlyTestNoticeRepository } from "@/lib/solmind/supabase/explorerEarlyTestNoticeRepository";
import { readExplorerEarlyTestNoticeSetting } from "@/lib/solmind/supabase/applicationSettingReader";
import { EXPLORER_PRIVATE_RESPONSE_VERSION } from "@/lib/solmind/explorerPrivateConversationResponse";
import { SUGGESTED_WAYPOINT_COMMAND_DENIED } from "@/lib/solmind/suggestedWaypointCommandBrowserContract";
import { SUGGESTED_WAYPOINT_EXPLORER_DETAIL_DENIED } from "@/lib/solmind/suggestedWaypointExplorerDetailBrowserContract";
import { SUGGESTED_WAYPOINT_EXPLORER_LIST_DENIED } from "@/lib/solmind/suggestedWaypointExplorerListBrowserContract";
import { GET as conversationState } from "../conversation/state/route";
import { POST as conversationCommand } from "../conversation/commands/route";
import { GET as conversationReview } from "../conversations/state/route";
import { GET as waypointList } from "../waypoints/suggestions/route";
import { GET as waypointDetail } from "../waypoints/[suggestedWaypointId]/detail/route";
import { POST as waypointCommand } from "../waypoints/[suggestedWaypointId]/commands/route";
import { GET as noticeStatus } from "../early-test-notice/status/route";
import { POST as noticeAgree } from "../early-test-notice/agree/route";
import ExplorerPage from "../page";
import ExplorerHomePage from "../home/page";
import ExplorerConversationPage from "../conversation/page";
import ExplorerConversationsPage from "../conversations/page";
import ExplorerWaypointsPage from "../waypoints/page";
import ExplorerSuggestedWaypointPage from "../waypoints/[suggestedWaypointId]/page";
import ExplorerConversationPreviewPage from "../conversation-preview/page";
import ExplorerCompassComparisonPage from "../compass-comparison/page";
import ExplorerLayout from "../layout";
import { ExplorerEarlyTestNoticeBoundary, ExplorerEarlyTestNoticeUnavailable } from "@/components/solmind/ExplorerEarlyTestNotice";
import { ExplorerHome } from "@/components/solmind/ExplorerHome";

const ORIGIN = "http://127.0.0.1:3000";
const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const EXPLORER = "33333333-3333-4333-8333-333333333333";
const SUGGESTION = "44444444-4444-4444-8444-444444444444";
const OPERATION = "55555555-5555-4555-8555-555555555555";
const VERSION = "66666666-6666-4666-8666-666666666666";
const PROVIDER_USER = "synthetic-explorer-provider-user";
const AUTH_VALUE = `base64-${Buffer.from(JSON.stringify({
  access_token: "synthetic.explorer-token.signature",
  refresh_token: "synthetic-refresh-token", expires_at: 4102444800,
})).toString("base64url")}`;
const COOKIE_HEADER = `solmind-auth=${AUTH_VALUE}; solmind-session=${SESSION}`;
const NOTICE_SETTING = "solmind_read_explorer_early_test_notice_setting_v1";
const NOTICE_STATUS = "solmind_read_explorer_early_test_notice_v1";
const AUTH_ROWS: Readonly<Record<string, readonly unknown[]>> = {
  solmind_find_auth_provider_identity: [{
    user_account_id: ACCOUNT, provider_name: "supabase",
    provider_user_id: PROVIDER_USER, status: "active",
  }],
  solmind_find_user_account: [{ user_account_id: ACCOUNT, account_status: "active" }],
  solmind_find_active_user_sessions: [{
    user_session_id: SESSION, user_account_id: ACCOUNT, active_role_context: "explorer",
    session_status: "active", expires_at: "2999-12-31T23:59:59.000Z",
  }],
  solmind_find_active_role_assignment: [{
    user_account_id: ACCOUNT, role_code: "explorer", role_status: "active",
  }],
  solmind_find_guide_profile: [],
  solmind_find_explorer_profile: [{
    explorer_profile_id: EXPLORER, user_account_id: ACCOUNT, status: "active",
  }],
};

function request(path: string, body?: unknown): NextRequest {
  return new NextRequest(`${ORIGIN}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Cookie: COOKIE_HEADER, Origin: ORIGIN,
      "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const waypointContext = () => ({ params: Promise.resolve({ suggestedWaypointId: SUGGESTION }) });
const conversationDenied = {
  version: EXPLORER_PRIVATE_RESPONSE_VERSION,
  result: { ok: false, state: null, error: "denied" }, assistance: null,
};
const CASES = [
  {
    route: "GET /explorer/conversation/state",
    invoke: () => conversationState(request("/explorer/conversation/state")),
    feature: "solmind_read_explorer_conversation_v3", denied: conversationDenied,
  },
  {
    route: "POST /explorer/conversation/commands",
    invoke: () => conversationCommand(request("/explorer/conversation/commands", {
      kind: "send", operationId: OPERATION, expectedRevision: 0, body: "Synthetic situation.",
    })),
    feature: "solmind_read_explorer_conversation_v3", denied: conversationDenied,
  },
  {
    route: "GET /explorer/conversations/state",
    invoke: () => conversationReview(request("/explorer/conversations/state")),
    feature: "solmind_read_ended_explorer_conversations_v1",
    denied: { version: "explorer-conversation-review.v1", ok: false, items: null, state: null, error: "denied" },
  },
  {
    route: "GET /explorer/waypoints/suggestions",
    invoke: () => waypointList(request("/explorer/waypoints/suggestions?pageSize=10")),
    feature: "solmind_list_explorer_suggested_waypoints",
    denied: { ok: false, data: null, error: SUGGESTED_WAYPOINT_EXPLORER_LIST_DENIED },
  },
  {
    route: "GET /explorer/waypoints/[suggestedWaypointId]/detail",
    invoke: () => waypointDetail(request(`/explorer/waypoints/${SUGGESTION}/detail`), waypointContext()),
    feature: "solmind_get_explorer_suggested_waypoint",
    denied: { ok: false, data: null, error: SUGGESTED_WAYPOINT_EXPLORER_DETAIL_DENIED },
  },
  {
    route: "POST /explorer/waypoints/[suggestedWaypointId]/commands",
    invoke: () => waypointCommand(request(`/explorer/waypoints/${SUGGESTION}/commands`, {
      kind: "explorer.mark_read", operationId: OPERATION, versionId: VERSION,
    }), waypointContext()),
    feature: "solmind_mark_suggested_waypoint_read",
    denied: { ok: false, outcome: null, suggestedWaypointId: null, error: SUGGESTED_WAYPOINT_COMMAND_DENIED },
  },
];

function setNotice(mode: "required" | "unreadable" | "off") {
  mocks.rpc.mockImplementation((name: string) => {
    let data: readonly unknown[] | null = null;
    if (Object.hasOwn(AUTH_ROWS, name)) data = AUTH_ROWS[name];
    if (name === NOTICE_SETTING && mode !== "unreadable") {
      data = [{ enabled: mode !== "off", notice_version: EXPLORER_EARLY_TEST_NOTICE_VERSION, version: 1 }];
    }
    if (name === NOTICE_STATUS) {
      data = [{ enabled: true, notice_version: EXPLORER_EARLY_TEST_NOTICE_VERSION, agreed: false }];
    }
    // A permitted feature attempt stops at this synthetic IO edge. No database
    // or provider runs, and the control still proves the route reached its RPC.
    const result = Promise.resolve({ data, error: data === null ? { message: "synthetic-unavailable" } : null });
    return Object.assign(result, { abortSignal: () => result });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv(EXPLORER_EARLY_TEST_NOTICE_CAPABILITY_ENV, "enabled");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "synthetic-anon-key");
  vi.stubEnv("SOLMIND_TRUSTED_APP_ORIGIN", ORIGIN);
  mocks.cookies.mockResolvedValue({ getAll: () => [
    { name: "solmind-auth", value: AUTH_VALUE }, { name: "solmind-session", value: SESSION },
  ] });
  mocks.headers.mockResolvedValue(new Headers({ cookie: COOKIE_HEADER }));
  mocks.redirect.mockImplementation(() => { throw new Error("synthetic-redirect"); });
  mocks.getUser.mockResolvedValue({ data: { user: { id: PROVIDER_USER } }, error: null });
  mocks.client.mockReturnValue({ rpc: mocks.rpc, from: mocks.from, schema: mocks.schema });
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected-network-request"));
});
afterEach(() => {
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.schema).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe.each(CASES)("early-test notice real path: $route", ({ invoke, feature, denied }) => {
  it.each(["required", "unreadable"] as const)("denies with notice %s before every feature repository call", async (mode) => {
    setNotice(mode);
    const response = await invoke();
    expect(await response.json()).toEqual(denied);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith(NOTICE_SETTING, {});
    if (mode === "required") {
      expect(mocks.rpc).toHaveBeenCalledWith(NOTICE_STATUS, {
        p_actor_user_account_id: ACCOUNT, p_user_session_id: SESSION,
      });
    } else {
      expect(mocks.rpc.mock.calls.some(([name]) => name === NOTICE_STATUS)).toBe(false);
    }
    const permitted = [...Object.keys(AUTH_ROWS), NOTICE_SETTING, NOTICE_STATUS];
    for (const [name] of mocks.rpc.mock.calls) expect(permitted).toContain(name);
    expect(mocks.featureRepositoryCall).not.toHaveBeenCalled();
    expect(mocks.rpc.mock.calls.some(([name]) => name === feature)).toBe(false);
  });
  it("reaches the existing feature repository with the same request when notice is off", async () => {
    setNotice("off");
    await invoke();
    expect(mocks.rpc).toHaveBeenCalledWith(NOTICE_SETTING, {});
    expect(mocks.rpc.mock.calls.some(([name]) => name === NOTICE_STATUS)).toBe(false);
    expect(mocks.featureRepositoryCall).toHaveBeenCalledOnce();
    expect(mocks.rpc.mock.calls.some(([name]) => name === feature)).toBe(true);
  });
  it.each([undefined, "off"])("capability %s reaches the existing feature without notice IO", async (capability) => {
    vi.stubEnv(EXPLORER_EARLY_TEST_NOTICE_CAPABILITY_ENV, capability);
    // If touched, the unreadable protected setting would refuse this request.
    setNotice("unreadable");
    await invoke();
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(createExplorerEarlyTestNoticeRepository).not.toHaveBeenCalled();
    expect(readExplorerEarlyTestNoticeSetting).not.toHaveBeenCalled();
    expect(mocks.rpc.mock.calls.some(([name]) => name.includes("early_test_notice"))).toBe(false);
    expect(mocks.featureRepositoryCall).toHaveBeenCalledOnce();
    expect(mocks.rpc.mock.calls.some(([name]) => name === feature)).toBe(true);
  });
});

describe.each([undefined, "off"])("notice route capability %s", (capability) => {
  beforeEach(() => vi.stubEnv(EXPLORER_EARLY_TEST_NOTICE_CAPABILITY_ENV, capability));
  afterEach(() => {
    expect(createExplorerEarlyTestNoticeRepository).not.toHaveBeenCalled();
    expect(readExplorerEarlyTestNoticeSetting).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.cookies).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.featureRepositoryCall).not.toHaveBeenCalled();
  });
  it("status says the notice does not apply without authentication or database access", async () => {
    const response = await noticeStatus(request("/explorer/early-test-notice/status"));
    expect(await response.json()).toEqual({ status: "allowed", noticeVersion: null });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.has("set-cookie")).toBe(false);
  });
  it("a valid same-origin agreement is refused without recording or authentication", async () => {
    const response = await noticeAgree(request("/explorer/early-test-notice/agree", {
      noticeVersion: EXPLORER_EARLY_TEST_NOTICE_VERSION, adultAffirmation: true,
    }));
    expect(await response.json()).toEqual({ status: "denied", noticeVersion: null });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.has("set-cookie")).toBe(false);
  });
});

describe.each([
  { route: "/explorer/conversation-preview", invoke: () => ExplorerConversationPreviewPage() },
  { route: "/explorer/compass-comparison", invoke: () => ExplorerCompassComparisonPage() },
])("review page inside the Explorer layout: $route", ({ invoke }) => {
  afterEach(() => {
    expect(mocks.cookies).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.featureRepositoryCall).not.toHaveBeenCalled();
  });
  it.each([undefined, "off"])("capability %s returns the exact review page without notice IO", async (capability) => {
    vi.stubEnv(EXPLORER_EARLY_TEST_NOTICE_CAPABILITY_ENV, capability);
    setNotice("unreadable");
    const children = invoke();
    expect(await ExplorerLayout({ children })).toBe(children);
    expect(createExplorerEarlyTestNoticeRepository).not.toHaveBeenCalled();
    expect(readExplorerEarlyTestNoticeSetting).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["off", "required", "unreadable"] as const)("enabled capability applies the layout's %s setting gate", async (mode) => {
    setNotice(mode);
    const children = invoke();
    const result = await ExplorerLayout({ children });
    if (mode === "off") expect(result).toBe(children);
    else if (mode === "required") {
      expect(result).toEqual(createElement(ExplorerEarlyTestNoticeBoundary, null, children));
    } else {
      expect(result).toEqual(createElement(ExplorerEarlyTestNoticeUnavailable));
    }
    expect(createExplorerEarlyTestNoticeRepository).toHaveBeenCalledOnce();
    expect(readExplorerEarlyTestNoticeSetting).toHaveBeenCalledOnce();
    expect(mocks.client).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(NOTICE_SETTING, {});
  });
});

describe.each([undefined, "off", "enabled"])("Explorer server pages with capability %s", (capability) => {
  beforeEach(() => {
    vi.stubEnv(EXPLORER_EARLY_TEST_NOTICE_CAPABILITY_ENV, capability);
    setNotice("unreadable");
  });
  afterEach(() => {
    expect(createExplorerEarlyTestNoticeRepository).not.toHaveBeenCalled();
    expect(readExplorerEarlyTestNoticeSetting).not.toHaveBeenCalled();
    expect(mocks.rpc.mock.calls.some(([name]) => name.includes("early_test_notice"))).toBe(false);
    expect(mocks.featureRepositoryCall).not.toHaveBeenCalled();
  });
  it.each([
    { route: "/explorer/conversation", invoke: () => ExplorerConversationPage() },
    { route: "/explorer/conversations", invoke: () => ExplorerConversationsPage() },
    { route: "/explorer/waypoints", invoke: () => ExplorerWaypointsPage() },
    { route: "/explorer/waypoints/[suggestedWaypointId]", invoke: () => ExplorerSuggestedWaypointPage(waypointContext()) },
    { route: "/explorer/conversation-preview", invoke: () => ExplorerConversationPreviewPage() },
    { route: "/explorer/compass-comparison", invoke: () => ExplorerCompassComparisonPage() },
  ])("$route constructs only a data-free shell without notice or database IO", async ({ invoke }) => {
    expect(isValidElement(await invoke())).toBe(true);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("/explorer keeps its existing redirect without notice or database IO", () => {
    expect(() => ExplorerPage()).toThrow("synthetic-redirect");
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/explorer/home");
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("/explorer/home keeps its existing authentication and exposes only the two session times", async () => {
    const result = await ExplorerHomePage();
    expect(result.type).toBe(ExplorerHome);
    expect(result.props).toEqual({ session: {
      expiresAt: "2999-12-31T23:59:59.000Z", observedAt: expect.any(String),
    } });
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalled();
    for (const [name] of mocks.rpc.mock.calls) expect(Object.keys(AUTH_ROWS)).toContain(name);
  });
});
