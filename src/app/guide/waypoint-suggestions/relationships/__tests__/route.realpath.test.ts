import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  cookiesMock,
  getUserMock,
  rpcMock,
  fromSpy,
  schemaSpy,
  createServiceRoleClientMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  getUserMock: vi.fn(),
  rpcMock: vi.fn(),
  fromSpy: vi.fn(),
  schemaSpy: vi.fn(),
  createServiceRoleClientMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: getUserMock } }),
}));
vi.mock("@/lib/solmind/supabase/serviceRoleClient", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
}));

import { GET } from "../route";

const PROVIDER_USER_ID = "auth-guide-1";
const GUIDE_ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const GUIDE_PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const RELATIONSHIP_ID = "33333333-3333-4333-8333-333333333333";
const SECRET_COOKIE = "sb-access-token-SECRET-do-not-leak";
const FAR_FUTURE = "2999-12-31T23:59:59.000Z";

const FN = Object.freeze({
  identity: "solmind_find_auth_provider_identity",
  account: "solmind_find_user_account",
  sessions: "solmind_find_active_user_sessions",
  role: "solmind_find_active_role_assignment",
  guide: "solmind_find_guide_profile",
  explorer: "solmind_find_explorer_profile",
  selector: "solmind_list_guide_suggested_waypoint_relationships",
});

const PAGE = Object.freeze({
  items: Object.freeze([
    Object.freeze({
      guide_explorer_relationship_id: RELATIONSHIP_ID,
      explorer_display_name: "Avery",
      relationship_created_at: "2026-08-14T17:00:00.000Z",
    }),
  ]),
  next_cursor: null,
  total_count: 1,
});

type RpcResponse = { data: unknown; error: unknown };

function guideChain(): Record<string, RpcResponse> {
  return {
    [FN.identity]: {
      data: [
        {
          user_account_id: GUIDE_ACCOUNT_ID,
          provider_name: "supabase",
          provider_user_id: PROVIDER_USER_ID,
          status: "active",
        },
      ],
      error: null,
    },
    [FN.account]: {
      data: [{ user_account_id: GUIDE_ACCOUNT_ID, account_status: "active" }],
      error: null,
    },
    [FN.sessions]: {
      data: [
        {
          user_account_id: GUIDE_ACCOUNT_ID,
          active_role_context: "guide",
          session_status: "active",
          expires_at: FAR_FUTURE,
        },
      ],
      error: null,
    },
    [FN.role]: {
      data: [
        {
          user_account_id: GUIDE_ACCOUNT_ID,
          role_code: "guide",
          role_status: "active",
        },
      ],
      error: null,
    },
    [FN.guide]: {
      data: [
        {
          guide_profile_id: GUIDE_PROFILE_ID,
          user_account_id: GUIDE_ACCOUNT_ID,
          status: "active",
        },
      ],
      error: null,
    },
    [FN.explorer]: { data: [], error: null },
    [FN.selector]: { data: [PAGE], error: null },
  };
}

function setRpcChain(chain: Record<string, RpcResponse>): void {
  rpcMock.mockImplementation((functionName: string) =>
    Promise.resolve(chain[functionName] ?? { data: [], error: null }),
  );
}

async function invoke() {
  const response = await GET(
    new NextRequest(
      "http://localhost/guide/waypoint-suggestions/relationships?pageSize=10",
    ),
  );
  const rawText = await response.clone().text();
  return { response, rawText, body: await response.json() };
}

let savedUrl: string | undefined;
let savedAnonKey: string | undefined;

beforeEach(() => {
  cookiesMock.mockReset();
  getUserMock.mockReset();
  rpcMock.mockReset();
  fromSpy.mockReset();
  schemaSpy.mockReset();
  createServiceRoleClientMock.mockReset();

  savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  savedAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";

  cookiesMock.mockResolvedValue({
    getAll: () => [{ name: "sb-access-token", value: SECRET_COOKIE }],
  });
  getUserMock.mockResolvedValue({
    data: { user: { id: PROVIDER_USER_ID } },
    error: null,
  });
  createServiceRoleClientMock.mockReturnValue({
    rpc: rpcMock,
    from: fromSpy,
    schema: schemaSpy,
  });
  setRpcChain(guideChain());
});

afterEach(() => {
  if (savedUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
  }
  if (savedAnonKey === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedAnonKey;
  }
  vi.restoreAllMocks();
});

describe("GET relationship selector real path", () => {
  it("derives the Guide actor and reaches only enumerated RPCs", async () => {
    const { response, body } = await invoke();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, data: PAGE, error: null });
    expect(rpcMock).toHaveBeenCalledWith(FN.selector, {
      p_actor_user_account_id: GUIDE_ACCOUNT_ID,
      p_page_size: 10,
      p_cursor: null,
    });
    for (const [functionName, args] of rpcMock.mock.calls) {
      expect(Object.values(FN)).toContain(functionName);
      expect(args).toBeTypeOf("object");
      expect(args).not.toHaveProperty("schema");
      expect(args).not.toHaveProperty("table");
      expect(args).not.toHaveProperty("columns");
      expect(args).not.toHaveProperty("filters");
    }
    expect(fromSpy).not.toHaveBeenCalled();
    expect(schemaSpy).not.toHaveBeenCalled();
  });

  it("denies before selector IO when the server-derived active role is not Guide", async () => {
    const chain = guideChain();
    chain[FN.sessions] = {
      data: [
        {
          user_account_id: GUIDE_ACCOUNT_ID,
          active_role_context: "explorer",
          session_status: "active",
          expires_at: FAR_FUTURE,
        },
      ],
      error: null,
    };
    chain[FN.role] = {
      data: [
        {
          user_account_id: GUIDE_ACCOUNT_ID,
          role_code: "explorer",
          role_status: "active",
        },
      ],
      error: null,
    };
    chain[FN.guide] = { data: [], error: null };
    chain[FN.explorer] = {
      data: [
        {
          explorer_profile_id: "44444444-4444-4444-8444-444444444444",
          user_account_id: GUIDE_ACCOUNT_ID,
          status: "active",
        },
      ],
      error: null,
    };
    setRpcChain(chain);

    const { body } = await invoke();
    expect(body).toEqual({
      ok: false,
      data: null,
      error: "SolMind Suggested Waypoint relationships are unavailable.",
    });
    expect(
      rpcMock.mock.calls.some((call) => call[0] === FN.selector),
    ).toBe(false);
  });

  it("maps selector transport detail to a value-free failure", async () => {
    const chain = guideChain();
    chain[FN.selector] = {
      data: null,
      error: {
        message: "private relationship and service-role detail",
        code: "42501",
      },
    };
    setRpcChain(chain);

    const { body, rawText } = await invoke();
    expect(body).toEqual({
      ok: false,
      data: null,
      error: "SolMind Suggested Waypoint relationships could not be loaded.",
    });
    expect(rawText).not.toContain("private relationship");
    expect(rawText).not.toContain("service-role");
    expect(rawText).not.toContain(SECRET_COOKIE);
  });
});
