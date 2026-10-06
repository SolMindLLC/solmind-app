import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  cookiesMock,
  createDependenciesMock,
  createDiagnosticMock,
  diagnosticReportMock,
  diagnosticReportResolutionDeniedMock,
  diagnosticSetResolutionStageMock,
  principalResolveMock,
  authContextLoadMock,
  relationshipLoadMock,
  resolveRequestMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createDependenciesMock: vi.fn(),
  createDiagnosticMock: vi.fn(),
  diagnosticReportMock: vi.fn(),
  diagnosticReportResolutionDeniedMock: vi.fn(),
  diagnosticSetResolutionStageMock: vi.fn(),
  principalResolveMock: vi.fn(),
  authContextLoadMock: vi.fn(),
  relationshipLoadMock: vi.fn(),
  resolveRequestMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock(
  "@/lib/solmind/supabase/suggestedWaypointRequestDependencies",
  () => ({ createSuggestedWaypointRequestDependencies: createDependenciesMock }),
);
vi.mock(
  "@/lib/solmind/supabase/suggestedWaypointRequestComposition",
  async (importOriginal) => {
    const original = await importOriginal<
      typeof import("@/lib/solmind/supabase/suggestedWaypointRequestComposition")
    >();
    return { ...original, resolveSuggestedWaypointRequest: resolveRequestMock };
  },
);
vi.mock(
  "@/lib/solmind/supabase/suggestedWaypointWholePathGuideRelationshipEntryDiagnostic",
  () => ({
    createSuggestedWaypointWholePathGuideRelationshipEntryDiagnostic:
      createDiagnosticMock,
  }),
);

import { GET } from "../route";

const RELATIONSHIP_ID = "55555555-5555-4555-8555-555555555555";
const SUGGESTION_ID = "66666666-6666-4666-8666-666666666666";
const SECRET_COOKIE = "sb-access-token-SECRET-do-not-leak";
const GUIDE_ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const GUIDE_PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const EXPLORER_PROFILE_ID = "33333333-3333-4333-8333-333333333333";
const PRINCIPAL = Object.freeze({
  providerName: "supabase" as const,
  providerUserId: "guide-provider-user",
});
const AUTH_INPUT = Object.freeze({
  authenticatedUser: PRINCIPAL,
  authProviderIdentity: Object.freeze({
    userAccountId: GUIDE_ACCOUNT_ID,
    providerName: "supabase",
    providerUserId: "guide-provider-user",
    status: "active",
  }),
  userAccount: Object.freeze({
    userAccountId: GUIDE_ACCOUNT_ID,
    accountStatus: "active",
  }),
  session: Object.freeze({
    userAccountId: GUIDE_ACCOUNT_ID,
    activeRoleContext: "guide",
    sessionStatus: "active",
  }),
  activeRoleAssignment: Object.freeze({
    userAccountId: GUIDE_ACCOUNT_ID,
    roleCode: "guide",
    roleStatus: "active",
  }),
  guideProfile: Object.freeze({
    guideProfileId: GUIDE_PROFILE_ID,
    userAccountId: GUIDE_ACCOUNT_ID,
    status: "active",
  }),
  explorerProfile: null,
});
const RELATIONSHIP = Object.freeze({
  guideExplorerRelationshipId: RELATIONSHIP_ID,
  guideProfileId: GUIDE_PROFILE_ID,
  explorerProfileId: EXPLORER_PROFILE_ID,
  relationshipStatus: "active",
});
const PAGE = Object.freeze({
  items: Object.freeze([
    Object.freeze({
      suggested_waypoint_id: SUGGESTION_ID,
      authoring_mode: "draft",
      authoring_revision: 1,
      destination_preview: "Protect one evening each week for recovery",
      pending_deadline_at: null,
      pull_back_available: false,
      channel_category: "not_delivered",
      current_version_id: null,
      delivered_at: null,
      acknowledged_version_id: null,
      acknowledged_at: null,
    }),
  ]),
  next_cursor: null,
  total_count: 1,
});

function request(query = ""): NextRequest {
  return new NextRequest(
    `http://localhost/guide/waypoint-suggestions/${RELATIONSHIP_ID}/suggestions${query}`,
  );
}

async function invoke(query = "", relationshipId = RELATIONSHIP_ID) {
  const response = await GET(request(query), {
    params: Promise.resolve({ relationshipId }),
  });
  const rawText = await response.clone().text();
  return { response, rawText, body: await response.json() };
}

beforeEach(() => {
  cookiesMock.mockReset();
  createDependenciesMock.mockReset();
  createDiagnosticMock.mockReset();
  diagnosticReportMock.mockReset();
  diagnosticReportResolutionDeniedMock.mockReset();
  diagnosticSetResolutionStageMock.mockReset();
  principalResolveMock.mockReset();
  authContextLoadMock.mockReset();
  relationshipLoadMock.mockReset();
  resolveRequestMock.mockReset();

  cookiesMock.mockResolvedValue({
    getAll: () => [{ name: "sb-access-token", value: SECRET_COOKIE }],
  });
  createDiagnosticMock.mockReturnValue({
    setResolutionStage: diagnosticSetResolutionStageMock,
    report: diagnosticReportMock,
    reportResolutionDenied: diagnosticReportResolutionDeniedMock,
  });
  principalResolveMock.mockResolvedValue(PRINCIPAL);
  authContextLoadMock.mockResolvedValue(AUTH_INPUT);
  relationshipLoadMock.mockResolvedValue(RELATIONSHIP);
  createDependenciesMock.mockReturnValue({
    principalSource: { resolveAuthenticatedUser: principalResolveMock },
    authSource: {
      loadServerAuthContextInput: authContextLoadMock,
      loadGuideRelationship: relationshipLoadMock,
    },
    executor: { execute: vi.fn() },
  });
  resolveRequestMock.mockResolvedValue(
    Object.freeze({ ok: true, data: PAGE, error: null }),
  );
});

describe("GET relationship-scoped Guide Suggested Waypoint list", () => {
  it("defaults to ten and passes only the relationship and pagination selectors", async () => {
    const { response, body } = await invoke();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(body).toEqual({ ok: true, data: PAGE, error: null });
    expect(resolveRequestMock).toHaveBeenCalledWith(
      expect.any(Object),
      {
        kind: "guide.list",
        relationshipId: RELATIONSHIP_ID,
        pageSize: 10,
        cursor: null,
      },
    );
    expect(diagnosticReportMock).not.toHaveBeenCalled();
    expect(diagnosticReportResolutionDeniedMock).not.toHaveBeenCalled();
  });

  it("reports only the final fixed relationship-entry resolution stage on denial", async () => {
    resolveRequestMock.mockImplementation(async (dependencies) => {
      const principal =
        await dependencies.principalSource.resolveAuthenticatedUser();
      const authInput =
        await dependencies.authSource.loadServerAuthContextInput({
          authenticatedUser: principal,
        });
      await dependencies.authSource.loadGuideRelationship({
        relationshipId: RELATIONSHIP_ID,
      });
      expect(authInput).toBe(AUTH_INPUT);
      return Object.freeze({
        ok: false,
        data: null,
        error: "solmind_suggested_waypoint_request_denied",
      });
    });

    const { body, rawText } = await invoke();

    expect(body.error).toBe("SolMind Suggested Waypoints are unavailable.");
    expect(diagnosticSetResolutionStageMock.mock.calls).toEqual([
      ["principal_denied"],
      ["auth_context_denied"],
      ["auth_context_denied"],
      ["relationship_load_denied"],
      ["relationship_load_denied"],
      ["rpc_denied"],
    ]);
    expect(diagnosticReportResolutionDeniedMock).toHaveBeenCalledOnce();
    expect(rawText).not.toContain(GUIDE_ACCOUNT_ID);
    expect(rawText).not.toContain(GUIDE_PROFILE_ID);
  });

  it("distinguishes relationship access denial from a missing relationship", async () => {
    relationshipLoadMock.mockResolvedValueOnce({
      ...RELATIONSHIP,
      guideProfileId: "99999999-9999-4999-8999-999999999999",
    });
    resolveRequestMock.mockImplementation(async (dependencies) => {
      const principal =
        await dependencies.principalSource.resolveAuthenticatedUser();
      await dependencies.authSource.loadServerAuthContextInput({
        authenticatedUser: principal,
      });
      await dependencies.authSource.loadGuideRelationship({
        relationshipId: RELATIONSHIP_ID,
      });
      return Object.freeze({
        ok: false,
        data: null,
        error: "solmind_suggested_waypoint_request_denied",
      });
    });

    await invoke();

    expect(diagnosticSetResolutionStageMock).toHaveBeenLastCalledWith(
      "relationship_access_denied",
    );
    expect(diagnosticReportResolutionDeniedMock).toHaveBeenCalledOnce();
  });

  it("accepts only a closed page size and one optional opaque cursor", async () => {
    await invoke("?pageSize=50&cursor=YWJjZA==");
    expect(resolveRequestMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ pageSize: 50, cursor: "YWJjZA==" }),
    );
  });

  it.each([
    ["?pageSize=25", RELATIONSHIP_ID],
    ["?pageSize=010", RELATIONSHIP_ID],
    ["?pageSize=10&pageSize=20", RELATIONSHIP_ID],
    ["?cursor=", RELATIONSHIP_ID],
    ["?cursor=not-a-cursor", RELATIONSHIP_ID],
    ["?actorUserAccountId=11111111-1111-4111-8111-111111111111", RELATIONSHIP_ID],
    ["", "not-a-relationship"],
  ])("denies malformed or authority-bearing input before cookie IO: %s", async (query, relationshipId) => {
    const { body } = await invoke(query, relationshipId);
    expect(body).toEqual({
      ok: false,
      data: null,
      error: "SolMind Suggested Waypoints are unavailable.",
    });
    expect(cookiesMock).not.toHaveBeenCalled();
    expect(resolveRequestMock).not.toHaveBeenCalled();
  });

  it("keeps malformed query and relationship-path diagnostics value-free", async () => {
    await invoke("?pageSize=25");
    expect(diagnosticReportMock).toHaveBeenLastCalledWith("query_denied");

    diagnosticReportMock.mockClear();
    await invoke("", "not-a-relationship");
    expect(diagnosticReportMock).toHaveBeenLastCalledWith(
      "relationship_path_denied",
    );
  });

  it("passes a read-only cookie snapshot into the dependency root", async () => {
    await invoke();
    const args = createDependenciesMock.mock.calls[0][0];
    expect(args.cookies.getAll()).toEqual([
      { name: "sb-access-token", value: SECRET_COOKIE },
    ]);
    expect(
      args.cookies.setAll([
        { name: "sb-access-token", value: "rotated", options: { path: "/" } },
      ]),
    ).toBeUndefined();
  });

  it("fails closed if the supposedly validated upstream payload is widened", async () => {
    resolveRequestMock.mockResolvedValue({
      ok: true,
      data: {
        items: [{ ...PAGE.items[0], private_explorer_note: "must not leave" }],
        next_cursor: null,
        total_count: 1,
      },
      error: null,
    });

    const { body, rawText } = await invoke();
    expect(body).toEqual({
      ok: false,
      data: null,
      error: "SolMind Suggested Waypoints could not be loaded.",
    });
    expect(rawText).not.toContain("private_explorer_note");
    expect(rawText).not.toContain("must not leave");
  });

  it("maps denial, transport failure, and thrown detail to fixed value-free results", async () => {
    resolveRequestMock.mockResolvedValue({
      ok: false,
      data: null,
      error: "solmind_suggested_waypoint_request_denied",
    });
    expect((await invoke()).body.error).toBe("SolMind Suggested Waypoints are unavailable.");

    resolveRequestMock.mockRejectedValue(
      new Error("private relationship and service-role detail"),
    );
    const { body, rawText } = await invoke();
    expect(body.error).toBe("SolMind Suggested Waypoints could not be loaded.");
    expect(rawText).not.toContain("private relationship");
    expect(rawText).not.toContain("service-role");
    expect(rawText).not.toContain(SECRET_COOKIE);
  });

  it("maps the internal stale-cursor result to the one public recovery sentinel", async () => {
    resolveRequestMock.mockResolvedValue({
      ok: false,
      data: null,
      error: "solmind_suggested_waypoint_request_refresh_required",
    });

    const { body, rawText } = await invoke("?pageSize=20&cursor=YWJjZA==");
    expect(body).toEqual({ ok: false, data: null, error: "refresh_required" });
    expect(Object.keys(body)).toEqual(["ok", "data", "error"]);
    expect(rawText).not.toContain("solmind_suggested_waypoint_request");
  });
});
