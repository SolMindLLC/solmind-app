// Injected auth/read ports only: no real login, SQL, provider or human proof.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ factory: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/solmind/supabase/explorerConversationRequestDependencies", () => ({ createExplorerPrivateLocalRequestDependencies: mocks.factory }));
vi.mock("@/lib/solmind/virtual-guide/explorerPrivateConversationComposition", () => ({ readEndedExplorerConversations: mocks.read }));
import { GET, dynamic, runtime } from "../route";
const dependencies = Object.freeze({ synthetic: true });
const id = "10000000-0000-4000-8000-000000000001";
const empty = { version: "explorer-conversation-review.v1", ok: true, items: [], state: null, error: null };
const failure = (error: string) => ({ version: "explorer-conversation-review.v1", ok: false, items: null, state: null, error });
async function read(query = "", cookie?: string) {
  const response = await GET(new NextRequest(`http://127.0.0.1:4311/explorer/conversations/state${query}`, {
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
it("passes raw duplicate cookies and null list selector through the actual factory", async () => {
  const cookie = "solmind-session=one; solmind-session=two";
  expect(await read("", cookie)).toEqual(empty);
  expect(dynamic).toBe("force-dynamic"); expect(runtime).toBe("nodejs");
  expect(mocks.factory).toHaveBeenCalledExactlyOnceWith(cookie);
  expect(mocks.read).toHaveBeenCalledExactlyOnceWith(dependencies, null);
});
it("passes only the one exact opaque selector, never identity or role", async () => {
  mocks.read.mockResolvedValue(failure("denied"));
  expect(await read(`?conversationId=${id}`)).toEqual(failure("denied"));
  expect(mocks.read).toHaveBeenCalledExactlyOnceWith(dependencies, id);
});
it.each(["?role=admin", "?actorAccountId=synthetic", "?conversationId=", `?conversationId=${id}&conversationId=${id}`,
  `?conversationId=${id}&limit=5`, "?conversationId=invalid", `?conversationId=${id}%0A`])("refuses malformed/extra selectors before dependency construction: %s", async query => {
  expect(await read(query)).toEqual(failure("denied")); expect(mocks.factory).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled();
});
it.each(["factory", "read", "shape"])("keeps %s failure value-free with no metadata", async kind => {
  if (kind === "factory") mocks.factory.mockImplementation(() => { throw new Error("private_secret"); });
  else if (kind === "read") mocks.read.mockRejectedValue(new Error("private_secret"));
  else mocks.read.mockResolvedValue({ ...empty, private_secret: true });
  expect(await read()).toEqual(failure("unavailable"));
});
