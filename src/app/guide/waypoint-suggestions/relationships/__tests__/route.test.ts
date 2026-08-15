import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_DENIED } from "@/lib/solmind/supabase/suggestedWaypointRelationshipSelectorRequest";

const {
  cookiesMock,
  createDependenciesMock,
  resolveSelectorRequestMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createDependenciesMock: vi.fn(),
  resolveSelectorRequestMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock(
  "@/lib/solmind/supabase/suggestedWaypointRequestDependencies",
  () => ({
    createSuggestedWaypointRequestDependencies: createDependenciesMock,
  }),
);
vi.mock(
  "@/lib/solmind/supabase/suggestedWaypointRelationshipSelectorRequest",
  async (importOriginal) => {
    const original = await importOriginal<
      typeof import("@/lib/solmind/supabase/suggestedWaypointRelationshipSelectorRequest")
    >();
    return {
      ...original,
      resolveSuggestedWaypointRelationshipSelectorRequest: resolveSelectorRequestMock,
    };
  },
);

import { GET } from "../route";

const SECRET_COOKIE = "sb-access-token-SECRET-do-not-leak";
const PAGE = Object.freeze({
  items: Object.freeze([
    Object.freeze({
      guide_explorer_relationship_id: "55555555-5555-4555-8555-555555555555",
      explorer_display_name: "Avery",
      relationship_created_at: "2026-08-14T17:00:00.000Z",
    }),
  ]),
  next_cursor: null,
  total_count: 1,
});

function request(query = ""): NextRequest {
  return new NextRequest(
    `http://localhost/guide/waypoint-suggestions/relationships${query}`,
  );
}

async function invoke(query = "") {
  const response = await GET(request(query));
  const rawText = await response.clone().text();
  return {
    response,
    rawText,
    body: await response.json(),
  };
}

beforeEach(() => {
  cookiesMock.mockReset();
  createDependenciesMock.mockReset();
  resolveSelectorRequestMock.mockReset();

  cookiesMock.mockResolvedValue({
    getAll: () => [{ name: "sb-access-token", value: SECRET_COOKIE }],
  });
  createDependenciesMock.mockReturnValue({
    principalSource: { resolveAuthenticatedUser: vi.fn() },
    authSource: { loadServerAuthContextInput: vi.fn() },
    relationshipSelectorExecutor: { execute: vi.fn() },
  });
  resolveSelectorRequestMock.mockResolvedValue(
    Object.freeze({ ok: true, data: PAGE, error: null }),
  );
});

describe("GET /guide/waypoint-suggestions/relationships", () => {
  it("defaults to page size 10 and returns the exact browser-safe page", async () => {
    const { response, body } = await invoke();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(body).toEqual({ ok: true, data: PAGE, error: null });
    expect(resolveSelectorRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        principalSource: expect.any(Object),
        authSource: expect.any(Object),
        executor: expect.any(Object),
      }),
      { pageSize: 10, cursor: null },
    );
  });

  it("accepts only the closed page sizes and one optional opaque cursor", async () => {
    await invoke("?pageSize=50&cursor=YWJjZA==");
    expect(resolveSelectorRequestMock).toHaveBeenCalledWith(
      expect.any(Object),
      { pageSize: 50, cursor: "YWJjZA==" },
    );
  });

  it.each([
    "?pageSize=25",
    "?pageSize=010",
    "?pageSize=10&pageSize=20",
    "?cursor=",
    "?cursor=not-a-cursor",
    "?cursor=YWJjZA==&cursor=ZWZnaA==",
    "?pageSize=10&actorUserAccountId=11111111-1111-4111-8111-111111111111",
  ])("denies malformed or authority-bearing query input before cookie IO: %s", async (query) => {
    const { body } = await invoke(query);

    expect(body).toEqual({
      ok: false,
      data: null,
      error: SUGGESTED_WAYPOINT_RELATIONSHIP_SELECTOR_DENIED,
    });
    expect(cookiesMock).not.toHaveBeenCalled();
    expect(createDependenciesMock).not.toHaveBeenCalled();
    expect(resolveSelectorRequestMock).not.toHaveBeenCalled();
  });

  it("passes a read-only cookie snapshot into the concrete dependency root", async () => {
    await invoke();

    const args = createDependenciesMock.mock.calls[0][0];
    expect(Object.keys(args)).toEqual(["cookies"]);
    expect(args.cookies.getAll()).toEqual([
      { name: "sb-access-token", value: SECRET_COOKIE },
    ]);
    expect(
      args.cookies.setAll([
        { name: "sb-access-token", value: "rotated", options: { path: "/" } },
      ]),
    ).toBeUndefined();
  });

  it("projects a fresh exact success shape even if an upstream result carries extra fields", async () => {
    resolveSelectorRequestMock.mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            ...PAGE.items[0],
            private_explorer_note: "must not leave the server",
          },
        ],
        next_cursor: null,
        total_count: 1,
        private_count: 99,
      },
      error: null,
      actor_user_account_id: "11111111-1111-4111-8111-111111111111",
    });

    const { body, rawText } = await invoke();
    expect(body).toEqual({ ok: true, data: PAGE, error: null });
    expect(rawText).not.toContain("private_explorer_note");
    expect(rawText).not.toContain("private_count");
    expect(rawText).not.toContain("actor_user_account_id");
  });

  it.each(["cookies", "dependencies", "resolver"])(
    "maps a thrown %s failure to one value-free browser-safe result",
    async (failure) => {
      if (failure === "cookies") {
        cookiesMock.mockRejectedValue(new Error("secret cookie failure"));
      } else if (failure === "dependencies") {
        createDependenciesMock.mockImplementation(() => {
          throw new Error("SUPABASE_SERVICE_ROLE_KEY secret failure");
        });
      } else {
        resolveSelectorRequestMock.mockRejectedValue(
          new Error("private relationship failure"),
        );
      }

      const { response, body, rawText } = await invoke();
      expect(response.status).toBe(200);
      expect(body).toEqual({
        ok: false,
        data: null,
        error: "SolMind Suggested Waypoint relationships could not be loaded.",
      });
      expect(rawText).not.toContain("secret");
      expect(rawText).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(rawText).not.toContain("private relationship");
      expect(rawText).not.toContain(SECRET_COOKIE);
    },
  );
});
