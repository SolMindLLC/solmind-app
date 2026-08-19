import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { cookiesMock, createDependenciesMock, resolveRequestMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createDependenciesMock: vi.fn(),
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

import { GET } from "../route";

const SUGGESTION_ID = "66666666-6666-4666-8666-666666666666";
const VERSION_ID = "99999999-9999-4999-8999-999999999999";
const SECRET_COOKIE = "sb-access-token-SECRET-do-not-leak";
const PAGE = Object.freeze({
  items: Object.freeze([
    Object.freeze({
      suggested_waypoint_id: SUGGESTION_ID,
      current_version_id: VERSION_ID,
      destination_preview: "Protect one evening each week for recovery",
      received_at: "2026-08-16T06:00:00.000Z",
      read: false,
      receipt_acknowledged: false,
      acknowledged_at: null,
      channel_category: "open",
    }),
  ]),
  next_cursor: null,
  total_count: 1,
});

function request(query = ""): NextRequest {
  return new NextRequest(`http://localhost/explorer/waypoints/suggestions${query}`);
}

async function invoke(query = "") {
  const response = await GET(request(query));
  const rawText = await response.clone().text();
  return { response, rawText, body: await response.json() };
}

beforeEach(() => {
  cookiesMock.mockReset();
  createDependenciesMock.mockReset();
  resolveRequestMock.mockReset();
  cookiesMock.mockResolvedValue({
    getAll: () => [{ name: "sb-access-token", value: SECRET_COOKIE }],
  });
  createDependenciesMock.mockReturnValue({
    principalSource: { resolveAuthenticatedUser: vi.fn() },
    authSource: { loadServerAuthContextInput: vi.fn() },
    executor: { execute: vi.fn() },
  });
  resolveRequestMock.mockResolvedValue(
    Object.freeze({ ok: true, data: PAGE, error: null }),
  );
});

describe("GET Explorer Suggested Waypoint inbox", () => {
  it("defaults to ten and passes pagination only", async () => {
    const { response, body } = await invoke();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(body).toEqual({ ok: true, data: PAGE, error: null });
    expect(resolveRequestMock).toHaveBeenCalledWith(expect.any(Object), {
      kind: "explorer.list",
      pageSize: 10,
      cursor: null,
    });
  });

  it("keeps a legitimate empty inbox distinct from relationship unavailability", async () => {
    resolveRequestMock.mockResolvedValueOnce({
      ok: true,
      data: { items: [], next_cursor: null, total_count: 0 },
      error: null,
    });
    expect((await invoke()).body).toEqual({
      ok: true,
      data: { items: [], next_cursor: null, total_count: 0 },
      error: null,
    });

    resolveRequestMock.mockResolvedValueOnce({
      ok: false,
      data: null,
      error: "solmind_suggested_waypoint_request_denied",
    });
    expect((await invoke()).body).toEqual({
      ok: false,
      data: null,
      error: "SolMind Waypoint Suggestions are unavailable.",
    });
  });

  it("accepts only a closed page size and one optional opaque cursor", async () => {
    await invoke("?pageSize=50&cursor=YWJjZA==");
    expect(resolveRequestMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ pageSize: 50, cursor: "YWJjZA==" }),
    );
  });

  it.each([
    "?pageSize=25",
    "?pageSize=010",
    "?pageSize=10&pageSize=20",
    "?cursor=",
    "?cursor=not-a-cursor",
    "?actorUserAccountId=11111111-1111-4111-8111-111111111111",
    "?guideExplorerRelationshipId=55555555-5555-4555-8555-555555555555",
  ])("denies malformed or authority-bearing input before cookie IO: %s", async (query) => {
    expect((await invoke(query)).body).toEqual({
      ok: false,
      data: null,
      error: "SolMind Waypoint Suggestions are unavailable.",
    });
    expect(cookiesMock).not.toHaveBeenCalled();
    expect(resolveRequestMock).not.toHaveBeenCalled();
  });

  it("passes a read-only cookie snapshot into the dependency root", async () => {
    await invoke();
    const args = createDependenciesMock.mock.calls[0][0];
    expect(args.cookies.getAll()).toEqual([
      { name: "sb-access-token", value: SECRET_COOKIE },
    ]);
    expect(args.cookies.setAll([{ name: "sb-access-token", value: "rotated", options: { path: "/" } }])).toBeUndefined();
  });

  it("fails closed if the upstream payload contains Guide-only fields", async () => {
    resolveRequestMock.mockResolvedValue({
      ok: true,
      data: {
        items: [{ ...PAGE.items[0], authoring_mode: "delivered" }],
        next_cursor: null,
        total_count: 1,
      },
      error: null,
    });
    const { body, rawText } = await invoke();
    expect(body.error).toBe("SolMind Waypoint Suggestions could not be loaded.");
    expect(rawText).not.toContain("authoring_mode");
  });

  it("maps denial, transport failure, and thrown detail to fixed value-free results", async () => {
    resolveRequestMock.mockResolvedValue({
      ok: false,
      data: null,
      error: "solmind_suggested_waypoint_request_denied",
    });
    expect((await invoke()).body.error).toBe("SolMind Waypoint Suggestions are unavailable.");

    resolveRequestMock.mockRejectedValue(new Error("private Explorer and service-role detail"));
    const { body, rawText } = await invoke();
    expect(body.error).toBe("SolMind Waypoint Suggestions could not be loaded.");
    expect(rawText).not.toContain("private Explorer");
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
