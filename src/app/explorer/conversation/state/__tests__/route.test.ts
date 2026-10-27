// PREPARED, NOT RUN. Synthetic dependency/engine ports; no real auth or DB IO.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ factory: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/solmind/supabase/explorerConversationRequestDependencies", () => ({ createExplorerPrivateLocalRequestDependencies: mocks.factory }));
vi.mock("@/lib/solmind/virtual-guide/explorerPrivateConversationComposition", () => ({ readExplorerPrivateConversation: mocks.read }));
import { GET, dynamic, runtime } from "../route";

const dependencies = Object.freeze({ synthetic: "read-only injected port marker" });
const denied = { ok: false, state: null, error: "denied" };
const unavailable = { ok: false, state: null, error: "unavailable" };
const empty = { ok: true, error: null, state: { version: "explorer-conversation.v1", conversationId: null,
  revision: 0, providerState: "unavailable", pendingTurn: false, messages: [], compassItems: [], priorityId: null, attentionId: null, waypoints: [] } };
function request(query = "", cookie?: string) {
  return new NextRequest(`http://localhost:3100/explorer/conversation/state${query}`, {
    headers: cookie === undefined ? {} : { Cookie: cookie },
  });
}
async function result(next = request()) {
  const response = await GET(next);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.has("set-cookie")).toBe(false);
  const output = await response.json();
  expect(output.version).toBe("explorer-private-conversation-response.v1");
  expect(output).toHaveProperty("assistance");
  return output.result;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.factory.mockReturnValue(dependencies); mocks.read.mockResolvedValue({ result: empty, assistance: null });
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected_network_effect"));
});
afterEach(() => { expect(globalThis.fetch).not.toHaveBeenCalled(); vi.restoreAllMocks(); });

describe("GET Explorer conversation state boundary", () => {
  it("R01 remains dynamic/node and passes only raw cookies to the factory", async () => {
    const raw = "solmind-auth=opaque%2Fvalue%3D; solmind-session=first; solmind-session=second";
    expect(await result(request("", raw))).toEqual(empty);
    expect(dynamic).toBe("force-dynamic"); expect(runtime).toBe("nodejs");
    expect(mocks.factory).toHaveBeenCalledExactlyOnceWith(raw);
    expect(mocks.read).toHaveBeenCalledExactlyOnceWith(dependencies);
  });
  it.each(["?actorAccountId=synthetic", "?role=admin", "?conversationId=synthetic", "?limit=10"])("R02 rejects query authority before construction (%s)", async query => {
    expect(await result(request(query))).toEqual(denied);
    expect(mocks.factory).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("R03 absence of cookies is passed as null rather than invented identity", async () => {
    mocks.read.mockResolvedValue({ result: denied, assistance: null });
    expect(await result()).toEqual(denied);
    expect(mocks.factory).toHaveBeenCalledExactlyOnceWith(null);
  });
  it.each(["factory", "engine"] as const)("R04 %s exceptions stay fixed and value-free", async source => {
    if (source === "factory") mocks.factory.mockImplementation(() => { throw new Error("private_cookie_and_configuration_detail"); });
    else mocks.read.mockRejectedValue(new Error("private_cookie_and_configuration_detail"));
    const body = await result(); expect(body).toEqual(unavailable);
    expect(JSON.stringify(body)).not.toContain("private_cookie");
    if (source === "factory") expect(mocks.read).not.toHaveBeenCalled();
  });
  it.each(["denied", "unavailable", "refresh_required", "provider_unavailable"])("R05 keeps closed engine failure %s uncached", async error => {
    const failure = { ok: false, state: null, error };
    mocks.read.mockResolvedValue({ result: failure, assistance: null });
    expect(await result()).toEqual(failure);
  });
});
