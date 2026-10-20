import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { handleLogout, type LogoutPorts } from "../logoutComposition";

const origin = "http://localhost:3000";
const providerUser = "11111111-1111-1111-1111-111111111111";
const account = "22222222-2222-2222-2222-222222222222";
const session = "33333333-3333-3333-3333-333333333333";
const stored = "base64-" + Buffer.from(JSON.stringify({
  access_token: "aaa.bbb.ccc", refresh_token: "captured-refresh", expires_at: 1_900_000_000,
})).toString("base64url");

function request(body = "{}", query = "", headers: Record<string, string> = {}) {
  return new Request(origin + "/logout" + query, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin", ...headers }, body,
  });
}

function harness() {
  const events: string[] = [];
  const jar = [ { name: "solmind-auth", value: stored }, { name: "solmind-session", value: session },
    { name: "remembered-browser", value: "keep" }, { name: "solmind-auth-code-verifier.0", value: "old" } ];
  const database = {
    identify: vi.fn(async () => { events.push("identity"); return providerUser; }),
    findAccount: vi.fn(async () => { events.push("account"); return account; }),
    endSession: vi.fn(async (): Promise<"ended" | "already_ended" | "failed"> => { events.push("end"); return "ended"; }),
  };
  const provider = { cleanup: vi.fn(async (): Promise<"cleaned" | "skipped" | "failed"> => { events.push("cleanup"); return "cleaned"; }),
    cleanupPrevious: vi.fn(async () => "skipped" as const) };
  const ports: LogoutPorts = {
    loadOrigin: () => origin, readCookies: vi.fn(async () => jar),
    createDatabase: vi.fn(() => database), createProvider: vi.fn(() => provider), report: vi.fn(),
  };
  return { ports, database, provider, jar, events };
}

afterEach(() => vi.useRealTimers());

describe("logout request coordination", () => {
  it("targets presented session, clears owned families and preserves other cookies", async () => {
    const h = harness();
    const response = await handleLogout(request(), h.ports);
    expect(await response.json()).toEqual({ outcome: "signed_out" });
    expect(h.events).toEqual(["identity", "account", "end", "cleanup"]);
    expect(h.ports.readCookies).toHaveBeenCalledTimes(1);
    expect(h.database.endSession).toHaveBeenCalledExactlyOnceWith(account, session);
    const cleared = response.cookies.getAll();
    expect(cleared.every(({ value }) => value === "")).toBe(true);
    expect(cleared.map(({ name }) => name)).toEqual(expect.arrayContaining(["solmind-auth", "solmind-session", "solmind-auth-code-verifier.0"]));
    expect(cleared.some(({ name }) => name === "remembered-browser")).toBe(false);
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache, no-store, must-revalidate, max-age=0");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.status).toBe(200);
  });

  it.each(["ended", "already_ended"] as const)("confirms %s even if provider cleanup fails", async (result) => {
    const h = harness(); h.database.endSession.mockResolvedValue(result); h.provider.cleanup.mockRejectedValue(new Error("private"));
    const response = await handleLogout(request(), h.ports);
    expect(await response.json()).toEqual({ outcome: "signed_out" });
    expect(h.ports.report).toHaveBeenCalledExactlyOnceWith("SM-OUT-01");
  });

  it("guard failure does not read cookies or construct dependencies", async () => {
    const h = harness();
    const response = await handleLogout(request("{}", "", { Origin: "http://hostile.invalid" }), h.ports);
    expect(await response.json()).toEqual({ outcome: "denied" });
    expect(response.cookies.getAll()).toHaveLength(0);
    expect(h.ports.readCookies).not.toHaveBeenCalled();
    expect(h.ports.createDatabase).not.toHaveBeenCalled();
  });

  it.each([["{\"account\":\"extra\"}", ""], ["{}", "?role=Admin"]])("late shape failure clears without remote calls", async (body, query) => {
    const h = harness(); const response = await handleLogout(request(body, query), h.ports);
    expect(await response.json()).toEqual({ outcome: "sign_out_unconfirmed" });
    expect(response.cookies.getAll().length > 0).toBe(true);
    expect(h.ports.createDatabase).not.toHaveBeenCalled(); expect(h.ports.createProvider).not.toHaveBeenCalled();
  });

  it.each([undefined, "throw"])("missing DB construction still permits cleanup and clearing %#", async (mode) => {
    const h = harness(); const ports = { ...h.ports, createDatabase: () => { if (mode) throw new Error("private"); return undefined; } };
    const response = await handleLogout(request(), ports);
    expect(await response.json()).toEqual({ outcome: "sign_out_unconfirmed" });
    expect(h.database.identify).not.toHaveBeenCalled(); expect(h.provider.cleanup).toHaveBeenCalledTimes(1);
    expect(response.cookies.getAll().length > 0).toBe(true);
  });

  it("missing provider configuration cannot trigger a provider call", async () => {
    const h = harness(); const response = await handleLogout(request(), { ...h.ports, createDatabase: () => undefined, createProvider: () => undefined });
    expect(await response.json()).toEqual({ outcome: "sign_out_unconfirmed" }); expect(h.provider.cleanup).not.toHaveBeenCalled();
  });

  it.each(["duplicate", "missing", "malformed"])("invalid %s binding cannot end a session", async (mode) => {
    const h = harness();
    if (mode === "duplicate") h.jar.push({ name: "solmind-session", value: session });
    if (mode === "missing") h.jar.splice(1, 1);
    if (mode === "malformed") h.jar[1].value += "\n";
    const response = await handleLogout(request(), h.ports);
    expect((await response.json()).outcome).not.toBe("signed_out"); expect(h.database.endSession).not.toHaveBeenCalled();
  });

  it("unresolved identity or account never invokes the writer", async () => {
    const h = harness(); h.database.findAccount.mockResolvedValue(null as unknown as string);
    const response = await handleLogout(request(), h.ports);
    expect(await response.json()).toEqual({ outcome: "sign_out_unconfirmed" }); expect(h.database.endSession).not.toHaveBeenCalled();
  });

  it("does not let late identity success start lookup or a write", async () => {
    vi.useFakeTimers(); const h = harness(); let resolve!: (value: string) => void;
    h.database.identify.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const operation = handleLogout(request(), h.ports);
    await vi.advanceTimersByTimeAsync(3_001);
    const response = await operation; resolve(providerUser); await Promise.resolve();
    expect(await response.json()).toEqual({ outcome: "sign_out_unconfirmed" });
    expect(h.database.findAccount).not.toHaveBeenCalled(); expect(h.database.endSession).not.toHaveBeenCalled();
  });

  it("discards a partially written response and consumes reporting errors", async () => {
    const h = harness(); let partial: NextResponse | undefined;
    const response = await handleLogout(request(), { ...h.ports,
      report: () => { throw new Error("private"); },
      createResponse: (outcome) => {
        partial = NextResponse.json({ outcome }); let count = 0; const write = partial.cookies.set.bind(partial.cookies);
        partial.cookies.set = ((...args: Parameters<typeof write>) => { if (++count === 2) throw new Error("private"); return write(...args); }) as typeof write;
        return partial;
      },
    });
    expect(response === partial).toBe(false); expect(response.cookies.getAll()).toHaveLength(0);
    expect(await response.json()).toEqual({ outcome: "denied" });
  });
});
