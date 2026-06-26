// SolMind MVP0 route-handler-level contract test for GET /admin/access.
//
// The auth composition itself (identity -> record load -> decision, fail-closed,
// opaque outcome, audit seam) is already covered by adminAccessRequest.test.ts.
// This file covers the THIN Route Handler shell that those tests do not exercise:
// the actual HTTP-facing contract of route.ts. It confirms that, given a controlled
// resolver outcome, the handler:
//   1. serializes an allow as exactly { allowed: true } (no extra/sensitive fields);
//   2. serializes a deny as exactly { allowed: false } (no reason/account/role);
//   3. fails closed to { allowed: false } when the resolver OR the request-surface
//      glue (cookies()) throws, leaking no error/reason detail;
//   4. keeps the outward body opaque even if an upstream resolver were to return
//      extra fields or a request cookie carried a secret value;
//   5. stays read-only: it delegates with only a cookie accessor and injects no
//      audit sink / writer / auth-source, so it adds no persistence behavior.
//
// The Next.js request surface is the only thing mocked: next/headers cookies() is
// replaced with a deterministic in-memory store, and resolveAdminAccessForRequest is
// replaced so the decision is controlled without any real Supabase, network, env, or
// DB. NextResponse is the REAL implementation, so the assertions read the actual
// serialized Response body and headers, not a mock of them. The real
// requestCookieAccessor module (pure, dependency-free) is used, so the handler's
// getAll/noop-setAll wiring is exercised, not stubbed.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type RequestCookie } from "@/lib/solmind/auth/requestCookieAccessor";

// Hoisted doubles shared with the (hoisted) vi.mock factories below.
//   - resolveAdminAccessForRequest: the composition helper the route delegates to.
//   - cookiesMock: the next/headers cookies() request API.
const { resolveAdminAccessForRequest, cookiesMock } = vi.hoisted(() => {
  return {
    resolveAdminAccessForRequest: vi.fn(),
    cookiesMock: vi.fn(),
  };
});

// Replace ONLY the composition helper. Its behavior is exhaustively tested elsewhere;
// here we drive its outcome to test the handler's projection and fail-closed glue.
vi.mock("@/lib/solmind/auth/adminAccessRequest", () => ({
  resolveAdminAccessForRequest,
}));

// Replace the Next.js request cookie API so no real request context is needed.
vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

import { GET } from "../route";

// A deterministic cookie store shaped like the subset of Next's ReadonlyRequestCookies
// the route uses (getAll returning { name, value } entries). One entry carries a
// secret-looking value so a leak test can assert it never reaches the response body.
const SECRET_COOKIE_VALUE = "sb-access-token-SECRET-do-not-leak";

function cookieStore(entries: RequestCookie[] = [{ name: "sb-access-token", value: SECRET_COOKIE_VALUE }]) {
  return {
    getAll: () => entries.map((entry) => ({ name: entry.name, value: entry.value })),
  };
}

// Read the handler's actual outward result: status, parsed JSON body, and the raw
// serialized text (used to prove no secret substring escapes).
async function invokeRoute(): Promise<{
  status: number;
  contentType: string | null;
  body: unknown;
  rawText: string;
}> {
  const response = await GET();
  const rawText = await response.clone().text();
  const body = await response.json();
  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    body,
    rawText,
  };
}

beforeEach(() => {
  resolveAdminAccessForRequest.mockReset();
  cookiesMock.mockReset();
  // Default: a present, well-formed request cookie store. Individual tests override.
  cookiesMock.mockResolvedValue(cookieStore());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /admin/access - allow contract", () => {
  it("returns HTTP 200 JSON exactly { allowed: true } with no extra fields", async () => {
    resolveAdminAccessForRequest.mockResolvedValue({ allowed: true });

    const { status, contentType, body } = await invokeRoute();

    expect(status).toBe(200);
    expect(contentType).toContain("application/json");
    expect(body).toEqual({ allowed: true });
    expect(Object.keys(body as object)).toEqual(["allowed"]);
  });
});

describe("GET /admin/access - deny contract", () => {
  it("returns HTTP 200 JSON exactly { allowed: false } with no reason/account/role fields", async () => {
    resolveAdminAccessForRequest.mockResolvedValue({ allowed: false });

    const { status, body } = await invokeRoute();

    // Opaque status: a deny uses the same 200 + JSON shape as an allow, so the status
    // code itself signals nothing. Only the boolean differs.
    expect(status).toBe(200);
    expect(body).toEqual({ allowed: false });
    expect(Object.keys(body as object)).toEqual(["allowed"]);
  });
});

describe("GET /admin/access - fail closed", () => {
  it("denies opaquely when the resolver throws (raw error never escapes)", async () => {
    resolveAdminAccessForRequest.mockRejectedValue(
      new Error("token-bearing resolver failure that must not leak"),
    );

    const { status, body, rawText } = await invokeRoute();

    expect(status).toBe(200);
    expect(body).toEqual({ allowed: false });
    expect(Object.keys(body as object)).toEqual(["allowed"]);
    // No error message, stack, or reason detail is serialized out.
    expect(rawText).not.toContain("token-bearing");
    expect(rawText).not.toContain("Error");
  });

  it("denies opaquely when the request-surface glue (cookies()) throws", async () => {
    // Covers the route's OUTER guard over the request-surface glue (AUTH-RLS-DEC-016):
    // a failure building the cookie accessor must still fail closed.
    cookiesMock.mockRejectedValue(new Error("cookies() request-context failure"));

    const { status, body, rawText } = await invokeRoute();

    expect(status).toBe(200);
    expect(body).toEqual({ allowed: false });
    expect(Object.keys(body as object)).toEqual(["allowed"]);
    expect(rawText).not.toContain("cookies()");
    // The resolver is never reached when the glue fails before delegation.
    expect(resolveAdminAccessForRequest).not.toHaveBeenCalled();
  });
});

describe("GET /admin/access - opaque projection", () => {
  it("forwards ONLY { allowed } even if the resolver returns extra allow fields", async () => {
    // The handler projects result.allowed into a fresh { allowed } object; it never
    // spreads the resolver result. So even a (hypothetical) leaky upstream cannot push
    // a reason/account/role into the response.
    resolveAdminAccessForRequest.mockResolvedValue({
      allowed: true,
      reason: "verified-admin",
      accountId: "user-admin-1",
      role: "admin",
      context: { identity: { userAccountId: "user-admin-1" } },
    });

    const { body, rawText } = await invokeRoute();

    expect(body).toEqual({ allowed: true });
    expect(Object.keys(body as object)).toEqual(["allowed"]);
    expect(body).not.toHaveProperty("reason");
    expect(body).not.toHaveProperty("accountId");
    expect(body).not.toHaveProperty("role");
    expect(body).not.toHaveProperty("context");
    expect(rawText).not.toContain("verified-admin");
    expect(rawText).not.toContain("user-admin-1");
  });

  it("forwards ONLY { allowed } even if the resolver returns extra deny fields", async () => {
    // The sensitive case: a denied request must not carry the denial reason, the
    // attempted account/role, or any relationship/context detail outward.
    resolveAdminAccessForRequest.mockResolvedValue({
      allowed: false,
      reason: "not-admin",
      accountId: "user-guide-7",
      role: "guide",
      relationship: { guideProfileId: "guide-profile-1" },
    });

    const { body, rawText } = await invokeRoute();

    expect(body).toEqual({ allowed: false });
    expect(Object.keys(body as object)).toEqual(["allowed"]);
    expect(body).not.toHaveProperty("reason");
    expect(body).not.toHaveProperty("accountId");
    expect(body).not.toHaveProperty("role");
    expect(body).not.toHaveProperty("relationship");
    expect(rawText).not.toContain("not-admin");
    expect(rawText).not.toContain("guide-profile-1");
  });

  it("never serializes a request cookie value into the response body", async () => {
    cookiesMock.mockResolvedValue(cookieStore());
    resolveAdminAccessForRequest.mockResolvedValue({ allowed: true });

    const { rawText } = await invokeRoute();

    expect(rawText).not.toContain(SECRET_COOKIE_VALUE);
    expect(rawText).not.toContain("sb-access-token");
  });
});

describe("GET /admin/access - read-only delegation", () => {
  it("delegates exactly once with only a cookie accessor and no writer/audit/auth-source wiring", async () => {
    resolveAdminAccessForRequest.mockResolvedValue({ allowed: true });

    await invokeRoute();

    // A single decision per request: no extra reads or duplicate decisions.
    expect(resolveAdminAccessForRequest).toHaveBeenCalledTimes(1);

    const deps = resolveAdminAccessForRequest.mock.calls[0][0] as Record<string, unknown>;
    // The route injects ONLY the cookie accessor. It wires no audit sink, no auth
    // source, and no principal-source override, so it adds no persistence / writer /
    // record-load behavior at this boundary (audit stays default-off in the helper).
    expect(Object.keys(deps)).toEqual(["cookies"]);
    expect(deps).not.toHaveProperty("auditSink");
    expect(deps).not.toHaveProperty("createAuthSource");
    expect(deps).not.toHaveProperty("createPrincipalSource");
  });

  it("passes a read-only cookie accessor: getAll reflects the request, setAll is a no-op that does not throw", async () => {
    resolveAdminAccessForRequest.mockResolvedValue({ allowed: true });

    await invokeRoute();

    const deps = resolveAdminAccessForRequest.mock.calls[0][0] as {
      cookies: {
        getAll: () => RequestCookie[];
        setAll: (entries: unknown[]) => void;
      };
    };

    // getAll surfaces the incoming request cookies as { name, value } entries.
    expect(deps.cookies.getAll()).toEqual([
      { name: "sb-access-token", value: SECRET_COOKIE_VALUE },
    ]);
    // setAll is the explicit MVP0 no-op: persists nothing, returns undefined, never
    // throws (AUTH-RLS-DEC-018). The route is verification-only / read-only.
    expect(
      deps.cookies.setAll([
        { name: "sb-access-token", value: "rotated", options: { path: "/" } },
      ]),
    ).toBeUndefined();
  });
});
