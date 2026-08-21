import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import {
  createInMemoryAuthSource,
  type InMemoryAuthSourceFixture,
} from "@/lib/solmind/auth/authSource";
import { createInMemoryRequestAuthPrincipalSource } from "@/lib/solmind/auth/requestAuthPrincipalSource";
import { type SupabaseAuthenticatedUser } from "@/lib/solmind/auth/serverAuthContext";

const {
  cookiesMock,
  createDependenciesMock,
  loadTrustedOriginMock,
  resolveRequestMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createDependenciesMock: vi.fn(),
  loadTrustedOriginMock: vi.fn(),
  resolveRequestMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("@/lib/solmind/auth/trustedApplicationOrigin", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/lib/solmind/auth/trustedApplicationOrigin")
  >();
  return { ...original, loadTrustedApplicationOrigin: loadTrustedOriginMock };
});
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

import { POST } from "../route";

const TRUSTED_ORIGIN = "http://localhost:3000";
const EXPLORER_ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const RELATIONSHIP_ID = "44444444-4444-4444-8444-444444444444";
const SUGGESTION_ID = "55555555-5555-4555-8555-555555555555";
const VERSION_ID = "66666666-6666-4666-8666-666666666666";
const GUIDE_PROFILE_ID = "77777777-7777-4777-8777-777777777777";
const EXPLORER_PROFILE_ID = "88888888-8888-4888-8888-888888888888";
const TIMESTAMP = "2026-08-21T20:00:00.000Z";
const SECRET_COOKIE = "sb-access-token-SECRET-do-not-leak";

const MARK_READ_BODY = Object.freeze({
  kind: "explorer.mark_read",
  operationId: OPERATION_ID,
  versionId: VERSION_ID,
});

function request(args: {
  body?: unknown;
  query?: string;
  origin?: string;
  secFetchSite?: string;
  contentType?: string;
  host?: string;
} = {}): NextRequest {
  return new NextRequest(
    `http://localhost:3000/explorer/waypoints/${SUGGESTION_ID}/commands${args.query ?? ""}`,
    {
      method: "POST",
      headers: {
        "content-type": args.contentType ?? "application/json",
        origin: args.origin ?? TRUSTED_ORIGIN,
        "sec-fetch-site": args.secFetchSite ?? "same-origin",
        host: args.host ?? "attacker.example",
      },
      body: JSON.stringify(args.body ?? MARK_READ_BODY),
    },
  );
}

async function invoke(
  nextRequest = request(),
  suggestedWaypointId = SUGGESTION_ID,
) {
  const response = await POST(nextRequest, {
    params: Promise.resolve({ suggestedWaypointId }),
  });
  const rawText = await response.clone().text();
  return { response, rawText, body: await response.json() };
}

beforeEach(() => {
  cookiesMock.mockReset();
  createDependenciesMock.mockReset();
  loadTrustedOriginMock.mockReset();
  resolveRequestMock.mockReset();

  loadTrustedOriginMock.mockReturnValue(TRUSTED_ORIGIN);
  cookiesMock.mockResolvedValue({
    getAll: () => [{ name: "sb-access-token", value: SECRET_COOKIE }],
  });
  createDependenciesMock.mockReturnValue({
    principalSource: { resolveAuthenticatedUser: vi.fn() },
    authSource: { loadServerAuthContextInput: vi.fn() },
    executor: { execute: vi.fn() },
  });
  resolveRequestMock.mockResolvedValue({
    ok: true,
    data: {
      outcome_code: "applied",
      operation_id: OPERATION_ID,
      suggested_waypoint_id: SUGGESTION_ID,
      authoring_revision: 1,
      current_version_id: VERSION_ID,
      committed_at: TIMESTAMP,
      read_at: TIMESTAMP,
    },
    error: null,
  });
});

describe("POST suggestion-scoped Explorer Suggested Waypoint command", () => {
  it("uses the actual same-origin JSON guard and ignores Host as authority", async () => {
    const { response, body } = await invoke(
      request({ host: "forwarded-attacker.example" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(body).toEqual({
      ok: true,
      outcome: "applied",
      suggestedWaypointId: SUGGESTION_ID,
      error: null,
    });
    expect(cookiesMock).toHaveBeenCalledTimes(1);
    expect(resolveRequestMock).toHaveBeenCalledWith(expect.any(Object), {
      ...MARK_READ_BODY,
      suggestedWaypointId: SUGGESTION_ID,
    });
  });

  it.each([
    [request({ query: "?actorUserAccountId=private" }), SUGGESTION_ID],
    [request(), "not-a-suggestion"],
  ])("denies URL authority before origin, body, and cookies %#", async (nextRequest, id) => {
    const { body } = await invoke(nextRequest, id);
    expect(body).toEqual({
      ok: false,
      outcome: null,
      suggestedWaypointId: null,
      error: "command_denied",
    });
    expect(loadTrustedOriginMock).not.toHaveBeenCalled();
    expect(cookiesMock).not.toHaveBeenCalled();
    expect(resolveRequestMock).not.toHaveBeenCalled();
  });

  it("denies a rejected path promise before all later boundaries", async () => {
    const response = await POST(request(), {
      params: Promise.reject(new Error("private path detail")),
    });
    expect(await response.json()).toMatchObject({ error: "command_denied" });
    expect(loadTrustedOriginMock).not.toHaveBeenCalled();
    expect(cookiesMock).not.toHaveBeenCalled();
  });

  it.each([
    request({ origin: "http://attacker.example" }),
    request({ secFetchSite: "cross-site" }),
    request({ contentType: "text/plain" }),
    request({ body: { ...MARK_READ_BODY, role: "admin" } }),
    request({ body: { ...MARK_READ_BODY, suggestedWaypointId: SUGGESTION_ID } }),
  ])("denies hostile framing or body before cookie IO %#", async (nextRequest) => {
    const { body, rawText } = await invoke(nextRequest);
    expect(body).toMatchObject({ ok: false, error: "command_denied" });
    expect(rawText).not.toContain("admin");
    expect(rawText).not.toContain("attacker");
    expect(cookiesMock).not.toHaveBeenCalled();
    expect(resolveRequestMock).not.toHaveBeenCalled();
  });

  it("fails closed before reading the body when trusted configuration is unavailable", async () => {
    loadTrustedOriginMock.mockImplementation(() => {
      throw new Error("private configuration detail");
    });
    const nextRequest = request();
    const bodyGetter = vi.spyOn(nextRequest, "body", "get");

    const result = await invoke(nextRequest);
    expect(result.body).toMatchObject({ error: "command_failed" });
    expect(result.rawText).not.toContain("private configuration detail");
    expect(bodyGetter).not.toHaveBeenCalled();
    expect(cookiesMock).not.toHaveBeenCalled();
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

  it("runs actual protected request composition at the route layer", async () => {
    const actual = await vi.importActual<
      typeof import("@/lib/solmind/supabase/suggestedWaypointRequestComposition")
    >("@/lib/solmind/supabase/suggestedWaypointRequestComposition");
    const principal: SupabaseAuthenticatedUser = {
      providerName: "supabase",
      providerUserId: "explorer-provider-user",
    };
    const fixture: InMemoryAuthSourceFixture = {
      accounts: [
        {
          principal,
          serverAuthContextInput: {
            authenticatedUser: principal,
            authProviderIdentity: {
              userAccountId: EXPLORER_ACCOUNT_ID,
              providerName: "supabase",
              providerUserId: "explorer-provider-user",
              status: "active",
            },
            userAccount: {
              userAccountId: EXPLORER_ACCOUNT_ID,
              accountStatus: "active",
            },
            session: {
              userAccountId: EXPLORER_ACCOUNT_ID,
              activeRoleContext: "explorer",
              sessionStatus: "active",
            },
            activeRoleAssignment: {
              userAccountId: EXPLORER_ACCOUNT_ID,
              roleCode: "explorer",
              roleStatus: "active",
            },
            guideProfile: null,
            explorerProfile: {
              explorerProfileId: EXPLORER_PROFILE_ID,
              userAccountId: EXPLORER_ACCOUNT_ID,
              status: "active",
            },
          },
        },
      ],
      relationships: [
        {
          guideExplorerRelationshipId: RELATIONSHIP_ID,
          guideProfileId: GUIDE_PROFILE_ID,
          explorerProfileId: EXPLORER_PROFILE_ID,
          relationshipStatus: "active",
        },
      ],
    };
    const executor = {
      execute: vi.fn(async () => ({
        functionName: "solmind_mark_suggested_waypoint_read" as const,
        data: {
          outcome_code: "applied" as const,
          operation_id: OPERATION_ID,
          suggested_waypoint_id: SUGGESTION_ID,
          authoring_revision: 1,
          current_version_id: VERSION_ID,
          committed_at: TIMESTAMP,
          read_at: TIMESTAMP,
        },
        error: null,
      })),
    };
    createDependenciesMock.mockReturnValue({
      principalSource: createInMemoryRequestAuthPrincipalSource(principal),
      authSource: createInMemoryAuthSource(fixture),
      executor,
    });
    resolveRequestMock.mockImplementation(actual.resolveSuggestedWaypointRequest);

    expect((await invoke()).body).toEqual({
      ok: true,
      outcome: "applied",
      suggestedWaypointId: SUGGESTION_ID,
      error: null,
    });
    expect(executor.execute).toHaveBeenCalledWith({
      functionName: "solmind_mark_suggested_waypoint_read",
      args: {
        p_actor_user_account_id: EXPLORER_ACCOUNT_ID,
        p_operation_id: OPERATION_ID,
        p_suggested_waypoint_id: SUGGESTION_ID,
        p_version_id: VERSION_ID,
      },
    });
  });

  it("injects only the path selector for acknowledgement", async () => {
    const body = {
      kind: "explorer.acknowledge",
      operationId: OPERATION_ID,
      expectedCurrentVersionId: VERSION_ID,
    };
    resolveRequestMock.mockResolvedValue({
      ok: false,
      data: null,
      error: "solmind_suggested_waypoint_request_denied",
    });
    await invoke(request({ body }));
    expect(resolveRequestMock).toHaveBeenCalledWith(expect.any(Object), {
      ...body,
      suggestedWaypointId: SUGGESTION_ID,
    });
  });

  it("maps denial and thrown private detail to fixed value-free failures", async () => {
    resolveRequestMock.mockResolvedValue({
      ok: false,
      data: null,
      error: "solmind_suggested_waypoint_request_denied",
    });
    expect((await invoke()).body).toMatchObject({ error: "command_denied" });

    resolveRequestMock.mockRejectedValue(
      new Error("private relationship and service-role detail"),
    );
    const { body, rawText } = await invoke();
    expect(body).toMatchObject({ error: "command_failed" });
    expect(rawText).not.toContain("private relationship");
    expect(rawText).not.toContain("service-role");
    expect(rawText).not.toContain(SECRET_COOKIE);
  });

  it("rejects widened and call-mismatched rows at final projection", async () => {
    resolveRequestMock.mockResolvedValue({
      ok: true,
      data: {
        outcome_code: "applied",
        operation_id: OPERATION_ID,
        suggested_waypoint_id: SUGGESTION_ID,
        authoring_revision: 1,
        current_version_id: VERSION_ID,
        committed_at: TIMESTAMP,
        read_at: TIMESTAMP,
        private_guide_note: "must not leave",
      },
      error: null,
    });
    let result = await invoke();
    expect(result.body).toMatchObject({ error: "command_failed" });
    expect(result.rawText).not.toContain("private_guide_note");

    resolveRequestMock.mockResolvedValue({
      ok: true,
      data: {
        outcome_code: "applied",
        operation_id: "99999999-9999-4999-8999-999999999999",
        suggested_waypoint_id: SUGGESTION_ID,
        authoring_revision: 1,
        current_version_id: VERSION_ID,
        committed_at: TIMESTAMP,
        read_at: TIMESTAMP,
      },
      error: null,
    });
    result = await invoke();
    expect(result.body).toMatchObject({ error: "command_failed" });
  });
});
