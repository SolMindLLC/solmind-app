// The actual same-origin JSON guard with an injected factory and composition: no real login, SQL or provider.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ factory: vi.fn(), close: vi.fn(), origin: vi.fn() }));
vi.mock("@/lib/solmind/supabase/explorerConversationRequestDependencies", () => ({ createExplorerPrivateConversationRequestDependencies: mocks.factory }));
vi.mock("@/lib/solmind/supabase/explorerYourWaypointsComposition", () => ({ closeExplorerYourWaypoint: mocks.close }));
vi.mock("@/lib/solmind/auth/trustedApplicationOrigin", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/solmind/auth/trustedApplicationOrigin")>(),
  loadTrustedApplicationOrigin: mocks.origin,
}));
import { POST, dynamic, runtime } from "../route";

const ORIGIN = "http://localhost:3100";
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const command = Object.freeze({ kind: "release_waypoint", operationId: id(7), waypointId: id(1) });
const dependencies = Object.freeze({ synthetic: true });
const failure = (error: string) => ({ version: "explorer-your-waypoints.v1", kind: "close", ok: false, replay: false, item: null, error });
const released = { id: id(1), conversationId: id(500), conversationEnded: true, sourceMessageId: id(900), isCurrent: true,
  createdAt: "2026-11-06T10:00:00.000Z", title: "Title", destination: "Destination", meaning: "Reason", arrivalSignal: "Arrival",
  status: "chosen", release: { operationId: id(7), releasedAt: "2026-11-06T11:00:00.000Z" } };
const ok = { version: "explorer-your-waypoints.v1", kind: "close", ok: true, replay: false, item: released, error: null };
type Args = { query?: string; body?: unknown; rawBody?: string; headers?: Record<string, string> };
function request(args: Args = {}) {
  return new NextRequest(`${ORIGIN}/explorer/waypoints/your-waypoints/commands${args.query ?? ""}`, {
    method: "POST",
    headers: { Origin: ORIGIN, "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json",
      Host: "untrusted-host.example", "X-Forwarded-Host": "another-untrusted-host.example", ...args.headers },
    body: args.rawBody ?? JSON.stringify(args.body ?? command),
  });
}
async function invoke(next = request()) {
  const response = await POST(next);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.has("set-cookie")).toBe(false);
  return response.json();
}
beforeEach(() => {
  vi.resetAllMocks(); mocks.origin.mockReturnValue(ORIGIN); mocks.factory.mockReturnValue(dependencies); mocks.close.mockResolvedValue(ok);
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected_network_effect"));
});
afterEach(() => { expect(globalThis.fetch).not.toHaveBeenCalled(); vi.restoreAllMocks(); });

it("uses the actual same-origin guard and forwards raw cookies and the exact body", async () => {
  const raw = "solmind-auth=synthetic%2Fopaque%3D; solmind-session=a; solmind-session=b";
  expect(await invoke(request({ headers: { Cookie: raw } }))).toEqual(ok);
  expect(dynamic).toBe("force-dynamic"); expect(runtime).toBe("nodejs");
  expect(mocks.factory).toHaveBeenCalledExactlyOnceWith(raw);
  expect(mocks.close).toHaveBeenCalledExactlyOnceWith(dependencies, command);
});
it("refuses any query before the body, origin or factory", async () => {
  const next = request({ query: "?actorAccountId=synthetic" });
  const body = vi.spyOn(next, "body", "get");
  expect(await invoke(next)).toEqual(failure("denied"));
  expect(body).not.toHaveBeenCalled(); expect(mocks.origin).not.toHaveBeenCalled();
  expect(mocks.factory).not.toHaveBeenCalled(); expect(mocks.close).not.toHaveBeenCalled();
});
it.each([
  ["a cross-site request", { headers: { "Sec-Fetch-Site": "cross-site" } }],
  ["another origin", { headers: { Origin: "http://evil.example" } }],
  ["a form body", { headers: { "Content-Type": "application/x-www-form-urlencoded" } }],
  ["malformed JSON", { rawBody: "{" }],
  ["an extra field", { body: { ...command, actorAccountId: id(2) } }],
  ["Release with evidence", { body: { ...command, reachedEvidence: "x" } }],
  ["Reached without evidence", { body: { ...command, kind: "reach_waypoint" } }],
  ["another command kind", { body: { ...command, kind: "revise_waypoint" } }],
])("refuses %s before the factory", async (_name, args) => {
  expect(await invoke(request(args as Args))).toEqual(failure("denied"));
  expect(mocks.factory).not.toHaveBeenCalled(); expect(mocks.close).not.toHaveBeenCalled();
});
it.each(["factory", "close", "shape"])("keeps %s failure value-free", async kind => {
  if (kind === "factory") mocks.factory.mockImplementation(() => { throw new Error("private_secret"); });
  else if (kind === "close") mocks.close.mockRejectedValue(new Error("private_secret"));
  else mocks.close.mockResolvedValue({ ...ok, private_secret: true });
  expect(await invoke()).toEqual(failure("unavailable"));
});
it("passes the closed conflict outcome through", async () => {
  mocks.close.mockResolvedValue(failure("conflict"));
  expect(await invoke()).toEqual(failure("conflict"));
});
