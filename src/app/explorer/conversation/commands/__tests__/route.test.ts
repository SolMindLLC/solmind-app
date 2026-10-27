// PREPARED, NOT RUN. Actual banked JSON/origin guard, synthetic engine/factory.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ factory: vi.fn(), command: vi.fn(), origin: vi.fn() }));
vi.mock("@/lib/solmind/supabase/explorerConversationRequestDependencies", () => ({ createExplorerPrivateLocalRequestDependencies: mocks.factory }));
vi.mock("@/lib/solmind/virtual-guide/explorerPrivateConversationComposition", () => ({ commandExplorerPrivateConversation: mocks.command }));
vi.mock("@/lib/solmind/auth/trustedApplicationOrigin", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/solmind/auth/trustedApplicationOrigin")>(),
  loadTrustedApplicationOrigin: mocks.origin,
}));
import { POST, dynamic, runtime } from "../route";

const ORIGIN = "http://localhost:3100";
const command = Object.freeze({ kind: "send", operationId: "10000000-0000-4000-8000-000000000001", expectedRevision: 0, body: "A synthetic message" });
const dependencies = Object.freeze({ synthetic: "injected command dependency marker" });
const denied = { ok: false, state: null, error: "denied" };
const unavailable = { ok: false, state: null, error: "unavailable" };
type RequestArgs = { query?: string; body?: unknown; rawBody?: string; headers?: Record<string, string>; method?: string };
function request(args: RequestArgs = {}) {
  return new NextRequest(`${ORIGIN}/explorer/conversation/commands${args.query ?? ""}`, {
    method: args.method ?? "POST",
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
  const output = await response.json();
  expect(output.version).toBe("explorer-private-conversation-response.v1");
  expect(output).toHaveProperty("assistance");
  return output.result;
}
beforeEach(() => {
  vi.resetAllMocks(); mocks.origin.mockReturnValue(ORIGIN); mocks.factory.mockReturnValue(dependencies);
  mocks.command.mockResolvedValue({ result: { ok: false, state: null, error: "provider_unavailable" }, assistance: null });
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected_network_effect"));
});
afterEach(() => { expect(globalThis.fetch).not.toHaveBeenCalled(); vi.restoreAllMocks(); });

describe("POST Explorer conversation commands boundary", () => {
  it("P01 uses the actual same-origin guard and forwards raw cookies/body/request signal", async () => {
    const raw = "solmind-auth=synthetic%2Fopaque%3D; solmind-session=a; solmind-session=b";
    const next = request({ headers: { Cookie: raw } });
    expect(await invoke(next)).toEqual({ ok: false, state: null, error: "provider_unavailable" });
    expect(dynamic).toBe("force-dynamic"); expect(runtime).toBe("nodejs");
    expect(mocks.factory).toHaveBeenCalledExactlyOnceWith(raw);
    expect(mocks.command).toHaveBeenCalledExactlyOnceWith({ command, dependencies, signal: next.signal });
    expect(Object.isFrozen(mocks.command.mock.calls[0][0].command)).toBe(true);
  });
  it("P02 query authority is rejected before config, body or factory", async () => {
    const next = request({ query: "?actorAccountId=synthetic" });
    const body = vi.spyOn(next, "body", "get");
    expect(await invoke(next)).toEqual(denied);
    expect(body).not.toHaveBeenCalled(); expect(mocks.origin).not.toHaveBeenCalled();
    expect(mocks.factory).not.toHaveBeenCalled(); expect(mocks.command).not.toHaveBeenCalled();
  });
  it.each<{ label: string; args: RequestArgs }>([
    { label: "foreign origin", args: { headers: { Origin: "https://untrusted.example" } } },
    { label: "cross-site", args: { headers: { "Sec-Fetch-Site": "cross-site" } } },
    { label: "wrong media type", args: { headers: { "Content-Type": "text/plain" } } },
    { label: "compressed", args: { headers: { "Content-Encoding": "gzip" } } },
    { label: "wrong length", args: { headers: { "Content-Length": "1" } } },
    { label: "wrong method", args: { method: "PUT" } },
    { label: "invalid JSON", args: { rawBody: "{" } },
    { label: "array", args: { rawBody: "[]" } },
    { label: "BOM", args: { rawBody: "\uFEFF{}" } },
    { label: "over byte cap", args: { body: { ...command, body: "x".repeat(17_000) } } },
  ])("P03 rejects framing or body before dependency IO ($label)", async ({ args }) => {
    expect(await invoke(request(args))).toEqual(denied);
    expect(mocks.factory).not.toHaveBeenCalled(); expect(mocks.command).not.toHaveBeenCalled();
  });
  it.each([
    { ...command, actorAccountId: "a browser actor" },
    { ...command, roleContext: "admin" },
    { ...command, conversationId: "a browser conversation" },
    { ...command, applicationSessionId: "a browser session" },
    { ...command, operationId: "not-a-uuid" },
    { ...command, expectedRevision: -1 },
  ])("P04 rejects browser authority or malformed command before factory (%j)", async body => {
    expect(await invoke(request({ body }))).toEqual(denied);
    expect(mocks.factory).not.toHaveBeenCalled(); expect(mocks.command).not.toHaveBeenCalled();
  });
  it("P05 trusted-origin configuration failure never reads body or constructs dependencies", async () => {
    mocks.origin.mockImplementation(() => { throw new Error("private_origin_configuration"); });
    const next = request(); const body = vi.spyOn(next, "body", "get");
    expect(await invoke(next)).toEqual(unavailable);
    expect(body).not.toHaveBeenCalled(); expect(mocks.factory).not.toHaveBeenCalled(); expect(mocks.command).not.toHaveBeenCalled();
  });
  it.each(["factory", "engine"] as const)("P06 %s failure emits no private details", async source => {
    if (source === "factory") mocks.factory.mockImplementation(() => { throw new Error("private_actor_cookie_or_key"); });
    else mocks.command.mockRejectedValue(new Error("private_actor_cookie_or_key"));
    const body = await invoke(); expect(body).toEqual(unavailable);
    expect(JSON.stringify(body)).not.toContain("private_actor");
    if (source === "factory") expect(mocks.command).not.toHaveBeenCalled();
  });
  it.each(["denied", "refresh_required", "unavailable", "provider_unavailable"])("P07 preserves closed failure %s", async error => {
    const failure = { ok: false, state: null, error }; mocks.command.mockResolvedValue({ result: failure, assistance: null });
    expect(await invoke()).toEqual(failure);
  });
});

// A real private controller wrapper is projected intact, not unwrapped into history.
it("projects bounded transient assistance separately and rejects leaked engine fields", async () => {
  const assistance = { kind: "support", body: "Synthetic static support.", persisted: false };
  const result = { ok: false, state: null, error: "denied" };
  mocks.command.mockResolvedValue({ result, assistance });
  const response = await POST(request());
  expect(await response.json()).toEqual({ version: "explorer-private-conversation-response.v1", result, assistance });
  mocks.command.mockResolvedValue({ result, assistance, policy_state: { private: "must not leak" } });
  expect(await invoke()).toEqual(unavailable);
});
