// Injected factory and composition only: no real login, SQL or provider.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ factory: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/solmind/supabase/explorerConversationRequestDependencies", () => ({ createExplorerPrivateConversationRequestDependencies: mocks.factory }));
vi.mock("@/lib/solmind/supabase/explorerYourWaypointsComposition", () => ({ readExplorerYourWaypointHistory: mocks.read }));
import { GET, dynamic, runtime } from "../route";

const C = "10000000-0000-4000-8000-000000000001";
const W = "10000000-0000-4000-8000-000000000002";
const dependencies = Object.freeze({ synthetic: true });
const failure = (error: string) => ({ version: "explorer-your-waypoints.v1", kind: "history", ok: false, waypointId: null, versions: null, complete: false, error });
const version = { id: W, sourceMessageId: C, isCurrent: true, createdAt: "2026-11-06T10:00:00.000Z", title: "Title",
  destination: "Destination", meaning: "Reason", arrivalSignal: "Arrival", status: "chosen" };
const ok = { version: "explorer-your-waypoints.v1", kind: "history", ok: true, waypointId: W, versions: [version], complete: true, error: null };
async function read(query: string) {
  const response = await GET(new NextRequest(`http://127.0.0.1:4311/explorer/waypoints/your-waypoints/history${query}`));
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.has("set-cookie")).toBe(false);
  return response.json();
}
beforeEach(() => { vi.resetAllMocks(); mocks.factory.mockReturnValue(dependencies); mocks.read.mockResolvedValue(ok);
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected_network")); });
afterEach(() => { expect(globalThis.fetch).not.toHaveBeenCalled(); vi.restoreAllMocks(); });

it("passes exactly the two selectors, in either order", async () => {
  expect(await read(`?conversationId=${C}&waypointId=${W}`)).toEqual(ok);
  expect(dynamic).toBe("force-dynamic"); expect(runtime).toBe("nodejs");
  expect(mocks.read).toHaveBeenCalledExactlyOnceWith(dependencies, C, W);
  expect(await read(`?waypointId=${W}&conversationId=${C}`)).toEqual(ok);
});
it.each(["", `?conversationId=${C}`, `?waypointId=${W}`, `?conversationId=${C}&waypointId=${W}&role=admin`,
  `?conversationId=${C}&conversationId=${C}`, `?conversationId=x&waypointId=${W}`, `?conversationId=${C}&waypointId=${W.replace(/2$/, "A")}`,
  `?conversationId=${C}&waypointId=${W}%0A`])("refuses malformed or extra selectors before the factory: %s", async query => {
  expect(await read(query)).toEqual(failure("denied")); expect(mocks.factory).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled();
});
it.each(["factory", "read", "shape"])("keeps %s failure value-free", async kind => {
  if (kind === "factory") mocks.factory.mockImplementation(() => { throw new Error("private_secret"); });
  else if (kind === "read") mocks.read.mockRejectedValue(new Error("private_secret"));
  else mocks.read.mockResolvedValue({ ...ok, private_secret: true });
  expect(await read(`?conversationId=${C}&waypointId=${W}`)).toEqual(failure("unavailable"));
});
