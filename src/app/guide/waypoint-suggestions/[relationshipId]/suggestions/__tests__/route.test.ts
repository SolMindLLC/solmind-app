import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  cookiesMock,
  createDependenciesMock,
  resolveRequestMock,
} = vi.hoisted(() => ({
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

const RELATIONSHIP_ID = "55555555-5555-4555-8555-555555555555";
const SUGGESTION_ID = "66666666-6666-4666-8666-666666666666";
const SECRET_COOKIE = "sb-access-token-SECRET-do-not-leak";
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
});
