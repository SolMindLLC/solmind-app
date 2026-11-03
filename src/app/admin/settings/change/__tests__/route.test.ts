import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Setting change route (minimal Admin screens, decision queue 2026-11-03 11:56:14), in the pattern of the
// Guide commands route test: hoisted mocks for the trusted origin and the access module; the real
// same-origin guard, body parser and raw cookie reader.
const { loadTrustedOriginMock, changeMock } = vi.hoisted(() => ({ loadTrustedOriginMock: vi.fn(), changeMock: vi.fn() }));
vi.mock("@/lib/solmind/auth/trustedApplicationOrigin", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/solmind/auth/trustedApplicationOrigin")>();
  return { ...original, loadTrustedApplicationOrigin: loadTrustedOriginMock };
});
vi.mock("@/lib/solmind/auth/adminWorkspaceAccess", () => ({ changeAdminSetting: changeMock }));

import { POST, dynamic, runtime } from "../route";

const ORIGIN = "http://127.0.0.1:4311";
const OP = "55555555-5555-4555-8555-555555555555";
const BODY = { settingKey: "explorer_ai_use_individual_daily_call_limit", value: 400, expectedVersion: 2, operationId: OP };

function request(body: unknown, init: { query?: string; origin?: string; site?: string; cookie?: string } = {}) {
  const headers: Record<string, string> = {
    "content-type": "application/json", origin: init.origin ?? ORIGIN, "sec-fetch-site": init.site ?? "same-origin",
    host: "attacker.example",
  };
  if (init.cookie !== undefined) headers.cookie = init.cookie;
  return new NextRequest(`${ORIGIN}/admin/settings/change${init.query ?? ""}`, { method: "POST", headers, body: JSON.stringify(body) });
}

async function outcome(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  return response.json();
}

beforeEach(() => {
  loadTrustedOriginMock.mockReset(); loadTrustedOriginMock.mockReturnValue(ORIGIN);
  changeMock.mockReset(); changeMock.mockResolvedValue({ outcome: "applied" });
});

describe("Admin setting change route", () => {
  it("is dynamic on Node and changes one setting with the exact body", async () => {
    expect(dynamic === "force-dynamic" && runtime === "nodejs").toBe(true);
    expect(await outcome(await POST(request(BODY, { cookie: "solmind-session=a" })))).toEqual({ outcome: "applied" });
    expect(changeMock.mock.calls[0][0].body).toEqual(BODY);
    expect(changeMock.mock.calls[0][0].cookies.getAll()).toEqual([{ name: "solmind-session", value: "a" }]);
  });

  it.each(["version_conflict", "out_of_range", "unchanged"])("passes the closed outcome %s through", async (value) => {
    changeMock.mockResolvedValue({ outcome: value });
    expect(await outcome(await POST(request(BODY)))).toEqual({ outcome: value });
  });

  it.each([
    ["a query", BODY, { query: "?x=1" }],
    ["another origin", BODY, { origin: "http://attacker.example" }],
    ["an unknown setting", { ...BODY, settingKey: "explorer_ai_use_ordinary_daily_reply_allowance" }, {}],
    ["a decimal value", { ...BODY, value: 1.5 }, {}],
    ["a text value", { ...BODY, value: "400" }, {}],
    ["a zero version", { ...BODY, expectedVersion: 0 }, {}],
    ["an extra key", { ...BODY, authorityBasis: "system_operations_runbook" }, {}],
    ["two settings at once", { ...BODY, settingKey: [BODY.settingKey, "suggested_waypoint_send_grace_seconds"] }, {}],
  ] as const)("denies %s before the guard", async (_name, body, init) => {
    expect(await outcome(await POST(request(body, init)))).toEqual({ outcome: "denied" });
    expect(changeMock).not.toHaveBeenCalled();
  });

  it("answers failed without detail when the guard throws", async () => {
    changeMock.mockRejectedValue(new Error("private_detail"));
    expect(await outcome(await POST(request(BODY)))).toEqual({ outcome: "failed" });
  });
});
