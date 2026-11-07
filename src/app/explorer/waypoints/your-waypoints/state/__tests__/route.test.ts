// Injected factory and composition only: no real login, SQL or provider.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ factory: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/solmind/supabase/explorerConversationRequestDependencies", () => ({ createExplorerPrivateConversationRequestDependencies: mocks.factory }));
vi.mock("@/lib/solmind/supabase/explorerYourWaypointsComposition", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/solmind/supabase/explorerYourWaypointsComposition")>(),
  readExplorerYourWaypoints: mocks.read,
}));
import { GET, dynamic, runtime } from "../route";

const dependencies = Object.freeze({ synthetic: true });
const empty = { version: "explorer-your-waypoints.v1", kind: "list", ok: true, items: [], hasMore: false, nextOffset: null, error: null };
const failure = (error: string) => ({ version: "explorer-your-waypoints.v1", kind: "list", ok: false, items: null, hasMore: false, nextOffset: null, error });
async function read(query = "", cookie?: string) {
  const response = await GET(new NextRequest(`http://127.0.0.1:4311/explorer/waypoints/your-waypoints/state${query}`, {
    headers: cookie === undefined ? {} : { Cookie: cookie },
  }));
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.has("set-cookie")).toBe(false);
  return response.json();
}
beforeEach(() => { vi.resetAllMocks(); mocks.factory.mockReturnValue(dependencies); mocks.read.mockResolvedValue(empty);
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected_network")); });
afterEach(() => { expect(globalThis.fetch).not.toHaveBeenCalled(); vi.restoreAllMocks(); });

it("passes raw duplicate cookies and the first page through the actual factory", async () => {
  const cookie = "solmind-session=one; solmind-session=two";
  expect(await read("", cookie)).toEqual(empty);
  expect(dynamic).toBe("force-dynamic"); expect(runtime).toBe("nodejs");
  expect(mocks.factory).toHaveBeenCalledExactlyOnceWith(cookie);
  expect(mocks.read).toHaveBeenCalledExactlyOnceWith(dependencies, 0);
});
it("passes one exact page offset, never identity or role", async () => {
  mocks.read.mockResolvedValue(failure("denied"));
  expect(await read("?offset=40")).toEqual(failure("denied"));
  expect(mocks.read).toHaveBeenCalledExactlyOnceWith(dependencies, 40);
});
it.each(["?role=admin", "?actorAccountId=synthetic", "?offset=", "?offset=5", "?offset=-20", "?offset=020", "?offset=20&offset=40",
  "?offset=20&limit=5", "?offset=1e2", "?offset=2147483640", "?offset=20%0A"])("refuses malformed or extra selectors before the factory: %s", async query => {
  expect(await read(query)).toEqual(failure("denied")); expect(mocks.factory).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled();
});
it.each(["factory", "read", "shape"])("keeps %s failure value-free", async kind => {
  if (kind === "factory") mocks.factory.mockImplementation(() => { throw new Error("private_secret"); });
  else if (kind === "read") mocks.read.mockRejectedValue(new Error("private_secret"));
  else mocks.read.mockResolvedValue({ ...empty, private_secret: true });
  expect(await read()).toEqual(failure("unavailable"));
});
