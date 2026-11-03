import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Lift pause route (minimal Admin screens, decision queue 2026-11-03 11:56:14), in the pattern of the Guide
// commands route test: hoisted mocks for the trusted origin and the access module; the real same-origin
// guard, body parser and raw cookie reader.
const { loadTrustedOriginMock, liftMock } = vi.hoisted(() => ({ loadTrustedOriginMock: vi.fn(), liftMock: vi.fn() }));
vi.mock("@/lib/solmind/auth/trustedApplicationOrigin", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/solmind/auth/trustedApplicationOrigin")>();
  return { ...original, loadTrustedApplicationOrigin: loadTrustedOriginMock };
});
vi.mock("@/lib/solmind/auth/adminWorkspaceAccess", () => ({ liftAdminPause: liftMock }));

import { POST, dynamic, runtime } from "../route";

const ORIGIN = "http://127.0.0.1:4311";
const STOP = "44444444-4444-4444-8444-444444444444";
const OP = "55555555-5555-4555-8555-555555555555";

function request(body: unknown, init: { query?: string; origin?: string; site?: string; cookie?: string; type?: string } = {}) {
  const headers: Record<string, string> = {
    "content-type": init.type ?? "application/json",
    origin: init.origin ?? ORIGIN,
    "sec-fetch-site": init.site ?? "same-origin",
    host: "attacker.example",
  };
  if (init.cookie !== undefined) headers.cookie = init.cookie;
  return new NextRequest(`${ORIGIN}/admin/ai-use/lift${init.query ?? ""}`, {
    method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function outcome(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  return response.json();
}

beforeEach(() => {
  loadTrustedOriginMock.mockReset(); loadTrustedOriginMock.mockReturnValue(ORIGIN);
  liftMock.mockReset(); liftMock.mockResolvedValue({ outcome: "lifted" });
});

describe("Admin lift pause route", () => {
  it("is dynamic on Node and lifts one stop with the exact body and raw cookies", async () => {
    expect(dynamic === "force-dynamic" && runtime === "nodejs").toBe(true);
    const response = await POST(request({ stopId: STOP, operationId: OP }, { cookie: "solmind-session=a; solmind-session=b" }));
    expect(await outcome(response)).toEqual({ outcome: "lifted" });
    expect(liftMock).toHaveBeenCalledOnce();
    const call = liftMock.mock.calls[0][0];
    expect(call.body).toEqual({ stopId: STOP, operationId: OP });
    expect(call.cookies.getAll()).toEqual([{ name: "solmind-session", value: "a" }, { name: "solmind-session", value: "b" }]);
    expect(Object.keys(call).sort()).toEqual(["body", "cookies"]);
  });

  it.each([
    ["a query", { stopId: STOP, operationId: OP }, { query: "?stopId=x" }],
    ["another origin", { stopId: STOP, operationId: OP }, { origin: "http://attacker.example" }],
    ["a cross-site fetch", { stopId: STOP, operationId: OP }, { site: "cross-site" }],
    ["a form post", "stopId=x", { type: "application/x-www-form-urlencoded" }],
    ["an extra key", { stopId: STOP, operationId: OP, actorUserAccountId: STOP }, {}],
    ["a missing operation id", { stopId: STOP }, {}],
    ["a bad stop id", { stopId: "not-a-uuid", operationId: OP }, {}],
    ["malformed cookies", { stopId: STOP, operationId: OP }, { cookie: "solmind-auth=bad value" }],
  ] as const)("denies %s before the guard", async (_name, body, init) => {
    expect(await outcome(await POST(request(body, init)))).toEqual({ outcome: "denied" });
    expect(liftMock).not.toHaveBeenCalled();
  });

  it("answers failed without detail when configuration or the guard throws", async () => {
    loadTrustedOriginMock.mockImplementation(() => { throw new Error("private_detail"); });
    expect(await outcome(await POST(request({ stopId: STOP, operationId: OP })))).toEqual({ outcome: "failed" });
    loadTrustedOriginMock.mockReturnValue(ORIGIN);
    liftMock.mockRejectedValue(new Error("private_detail"));
    const body = await outcome(await POST(request({ stopId: STOP, operationId: OP })));
    expect(body).toEqual({ outcome: "failed" });
    expect(JSON.stringify(body).includes("private")).toBe(false);
  });
});
