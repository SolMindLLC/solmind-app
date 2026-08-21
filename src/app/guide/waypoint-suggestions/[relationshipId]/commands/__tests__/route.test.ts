import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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
const RELATIONSHIP_ID = "44444444-4444-4444-8444-444444444444";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const SUGGESTION_ID = "55555555-5555-4555-8555-555555555555";
const TIMESTAMP = "2026-08-20T20:00:00.000Z";
const SECRET_COOKIE = "sb-access-token-SECRET-do-not-leak";

const CREATE_BODY = Object.freeze({
  kind: "guide.create_draft",
  operationId: OPERATION_ID,
  destination: "Protect one evening for recovery",
  why: "Create dependable recovery space.",
  arrivalSignals: Object.freeze(["One evening remains unscheduled."]),
});

function request(args: {
  body?: unknown;
  query?: string;
  origin?: string;
  secFetchSite?: string;
  contentType?: string;
  host?: string;
} = {}): NextRequest {
  const body = JSON.stringify(args.body ?? CREATE_BODY);
  return new NextRequest(
    `http://localhost:3000/guide/waypoint-suggestions/${RELATIONSHIP_ID}/commands${args.query ?? ""}`,
    {
      method: "POST",
      headers: {
        "content-type": args.contentType ?? "application/json",
        origin: args.origin ?? TRUSTED_ORIGIN,
        "sec-fetch-site": args.secFetchSite ?? "same-origin",
        host: args.host ?? "attacker.example",
      },
      body,
    },
  );
}

async function invoke(
  nextRequest = request(),
  relationshipId = RELATIONSHIP_ID,
) {
  const response = await POST(nextRequest, {
    params: Promise.resolve({ relationshipId }),
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
    identifiers: {
      suggestedWaypointIdForCreate: vi.fn(),
      versionIdForSchedule: vi.fn(),
    },
  });
  resolveRequestMock.mockResolvedValue({
    ok: true,
    data: {
      outcome_code: "applied",
      operation_id: OPERATION_ID,
      suggested_waypoint_id: SUGGESTION_ID,
      authoring_revision: 1,
      current_version_id: null,
      committed_at: TIMESTAMP,
      draft_saved_at: TIMESTAMP,
    },
    error: null,
  });
});

describe("POST relationship-scoped Guide Suggested Waypoint command", () => {
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
    expect(loadTrustedOriginMock).toHaveBeenCalledTimes(1);
    expect(cookiesMock).toHaveBeenCalledTimes(1);
    expect(createDependenciesMock).toHaveBeenCalledTimes(1);
    expect(resolveRequestMock).toHaveBeenCalledTimes(1);
    expect(resolveRequestMock).toHaveBeenCalledWith(expect.any(Object), {
      ...CREATE_BODY,
      arrivalSignals: ["One evening remains unscheduled."],
      relationshipId: RELATIONSHIP_ID,
    });
  });

  it.each([
    [request({ query: "?actorUserAccountId=private" }), RELATIONSHIP_ID, 0],
    [request(), "not-a-relationship", 0],
  ])(
    "denies URL authority before body, cookies, and dependencies %#",
    async (nextRequest, relationshipId, expectedOriginLoads) => {
      const { body } = await invoke(nextRequest, relationshipId);
      expect(body).toEqual({
        ok: false,
        outcome: null,
        suggestedWaypointId: null,
        error: "command_denied",
      });
      expect(loadTrustedOriginMock).toHaveBeenCalledTimes(expectedOriginLoads);
      expect(cookiesMock).not.toHaveBeenCalled();
      expect(createDependenciesMock).not.toHaveBeenCalled();
      expect(resolveRequestMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    request({ origin: "http://attacker.example" }),
    request({ secFetchSite: "cross-site" }),
    request({ contentType: "text/plain" }),
    request({ body: { ...CREATE_BODY, role: "admin" } }),
    request({ body: { ...CREATE_BODY, destination: "line one\nline two" } }),
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
    expect(result.body).toMatchObject({ ok: false, error: "command_failed" });
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

  it.each([
    [
      {
        kind: "guide.save_draft",
        operationId: OPERATION_ID,
        suggestedWaypointId: SUGGESTION_ID,
        expectedRevision: 2,
        destination: "Protect one evening for recovery",
        why: "Create dependable recovery space.",
        arrivalSignals: ["One evening remains unscheduled."],
      },
    ],
    [
      {
        kind: "guide.schedule_send",
        operationId: OPERATION_ID,
        suggestedWaypointId: SUGGESTION_ID,
        expectedRevision: 2,
      },
    ],
    [
      {
        kind: "guide.pull_back",
        operationId: OPERATION_ID,
        suggestedWaypointId: SUGGESTION_ID,
        expectedRevision: 3,
        expectedPendingVersionId: "66666666-6666-4666-8666-666666666666",
      },
    ],
  ])("injects only the path relationship for every remaining Guide command %#", async (body) => {
    resolveRequestMock.mockResolvedValue({
      ok: false,
      data: null,
      error: "solmind_suggested_waypoint_request_denied",
    });
    await invoke(request({ body }));
    expect(resolveRequestMock).toHaveBeenCalledWith(expect.any(Object), {
      ...body,
      relationshipId: RELATIONSHIP_ID,
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

  it("rejects a widened upstream command row at final projection", async () => {
    resolveRequestMock.mockResolvedValue({
      ok: true,
      data: {
        outcome_code: "applied",
        operation_id: OPERATION_ID,
        suggested_waypoint_id: SUGGESTION_ID,
        authoring_revision: 1,
        current_version_id: null,
        committed_at: TIMESTAMP,
        draft_saved_at: TIMESTAMP,
        private_explorer_note: "must not leave",
      },
      error: null,
    });

    const { body, rawText } = await invoke();
    expect(body).toMatchObject({ error: "command_failed" });
    expect(rawText).not.toContain("private_explorer_note");
    expect(rawText).not.toContain("must not leave");
  });
});
