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
const DETAIL = Object.freeze({
  suggested_waypoint_id: SUGGESTION_ID,
  current_version_id: VERSION_ID,
  destination: "Protect one evening each week for recovery",
  why: "A protected evening may make the week feel more sustainable.",
  arrival_signals: Object.freeze(["One evening stays unscheduled."]),
  received_at: "2026-08-16T06:00:00.000Z",
  read: false,
  read_at: null,
  receipt_acknowledged: false,
  acknowledged_at: null,
  channel_category: "open",
});

function request(query = ""): NextRequest {
  return new NextRequest(`http://localhost/explorer/waypoints/${SUGGESTION_ID}/detail${query}`);
}

async function invoke(query = "", suggestedWaypointId = SUGGESTION_ID) {
  const response = await GET(request(query), {
    params: Promise.resolve({ suggestedWaypointId }),
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
    Object.freeze({ ok: true, data: DETAIL, error: null }),
  );
});

describe("GET Explorer Suggested Waypoint detail", () => {
  it("passes only the opaque suggestion selector to authenticated composition", async () => {
    const { response, body } = await invoke();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(body).toEqual({ ok: true, data: DETAIL, error: null });
    expect(resolveRequestMock).toHaveBeenCalledWith(expect.any(Object), {
      kind: "explorer.get",
      suggestedWaypointId: SUGGESTION_ID,
    });
  });

  it.each([
    ["?actorUserAccountId=11111111-1111-4111-8111-111111111111", SUGGESTION_ID],
    ["?guideExplorerRelationshipId=55555555-5555-4555-8555-555555555555", SUGGESTION_ID],
    ["", "not-a-suggestion"],
  ])("denies widening or malformed identity input before cookie IO", async (query, id) => {
    expect((await invoke(query, id)).body.error).toBe("SolMind Waypoint Suggestions are unavailable.");
    expect(cookiesMock).not.toHaveBeenCalled();
    expect(resolveRequestMock).not.toHaveBeenCalled();
  });

  it("passes a read-only cookie snapshot into the dependency root", async () => {
    await invoke();
    const args = createDependenciesMock.mock.calls[0][0];
    expect(args.cookies.getAll()).toEqual([{ name: "sb-access-token", value: SECRET_COOKIE }]);
    expect(args.cookies.setAll([{ name: "sb-access-token", value: "rotated", options: { path: "/" } }])).toBeUndefined();
  });

  it("fails closed if supposedly validated detail contains Guide-only data", async () => {
    resolveRequestMock.mockResolvedValue({
      ok: true,
      data: { ...DETAIL, pending_deadline_at: "2026-08-16T06:30:00.000Z" },
      error: null,
    });
    const { body, rawText } = await invoke();
    expect(body.error).toBe("SolMind Waypoint Suggestions could not be loaded.");
    expect(rawText).not.toContain("pending_deadline_at");
  });

  it("maps denial and thrown detail to fixed value-free results", async () => {
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
});
