import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { cookiesMock, createDependenciesMock, resolveRequestMock } = vi.hoisted(
  () => ({
    cookiesMock: vi.fn(),
    createDependenciesMock: vi.fn(),
    resolveRequestMock: vi.fn(),
  }),
);

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
const DETAIL = Object.freeze({
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
  draft_or_pending_destination: "Protect one evening each week for recovery",
  draft_or_pending_why: "A protected evening may make the week sustainable.",
  draft_or_pending_arrival_signals: Object.freeze(["One evening stays unscheduled."]),
  delivered_destination: null,
  delivered_why: null,
  delivered_arrival_signals: null,
  policy_key: null,
  policy_version: null,
  effective_seconds: null,
});

function request(query = ""): NextRequest {
  return new NextRequest(
    `http://localhost/guide/waypoint-suggestions/${RELATIONSHIP_ID}/${SUGGESTION_ID}/detail${query}`,
  );
}

async function invoke(
  query = "",
  relationshipId = RELATIONSHIP_ID,
  suggestedWaypointId = SUGGESTION_ID,
) {
  const response = await GET(request(query), {
    params: Promise.resolve({ relationshipId, suggestedWaypointId }),
  });
  const rawText = await response.clone().text();
  return { response, rawText, body: await response.json() };
}

beforeEach(() => {
  cookiesMock.mockReset();
  createDependenciesMock.mockReset();
  resolveRequestMock.mockReset();
  cookiesMock.mockResolvedValue({
    getAll: () => [{ name: "sb-access-token", value: "SECRET-do-not-leak" }],
  });
  createDependenciesMock.mockReturnValue({});
  resolveRequestMock.mockResolvedValue(
    Object.freeze({ ok: true, data: DETAIL, error: null }),
  );
});

describe("GET relationship-scoped Guide Suggested Waypoint detail", () => {
  it("passes only the two selectors to the closed Guide detail request", async () => {
    const { response, body } = await invoke();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(body).toEqual({ ok: true, data: DETAIL, error: null });
    expect(resolveRequestMock).toHaveBeenCalledWith(expect.any(Object), {
      kind: "guide.get",
      relationshipId: RELATIONSHIP_ID,
      suggestedWaypointId: SUGGESTION_ID,
    });
  });

  it.each([
    ["?actorUserAccountId=11111111-1111-4111-8111-111111111111", RELATIONSHIP_ID, SUGGESTION_ID],
    ["", "not-a-relationship", SUGGESTION_ID],
    ["", RELATIONSHIP_ID, "not-a-suggestion"],
  ])("denies query or malformed selectors before cookie IO", async (query, relationshipId, suggestionId) => {
    expect((await invoke(query, relationshipId, suggestionId)).body).toEqual({
      ok: false,
      data: null,
      error: "SolMind Suggested Waypoints are unavailable.",
    });
    expect(cookiesMock).not.toHaveBeenCalled();
    expect(resolveRequestMock).not.toHaveBeenCalled();
  });

  it("fails closed if upstream detail is widened", async () => {
    resolveRequestMock.mockResolvedValue({
      ok: true,
      data: { ...DETAIL, explorer_read: true, private_note: "must not leave" },
      error: null,
    });
    const { body, rawText } = await invoke();
    expect(body.error).toBe("SolMind Suggested Waypoints could not be loaded.");
    expect(rawText).not.toContain("private_note");
    expect(rawText).not.toContain("must not leave");
  });

  it("maps denial and thrown detail to fixed value-free results", async () => {
    resolveRequestMock.mockResolvedValue({
      ok: false,
      data: null,
      error: "solmind_suggested_waypoint_request_denied",
    });
    expect((await invoke()).body.error).toBe("SolMind Suggested Waypoints are unavailable.");

    resolveRequestMock.mockRejectedValue(new Error("private relationship detail"));
    const { body, rawText } = await invoke();
    expect(body.error).toBe("SolMind Suggested Waypoints could not be loaded.");
    expect(rawText).not.toContain("private relationship");
    expect(rawText).not.toContain("SECRET");
  });
});
