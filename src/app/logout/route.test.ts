import { describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/solmind/supabase/logoutComposition", () => ({
  handleLogout: async (_request: Request, ports: { readCookies(): Promise<unknown> }) => {
    fixture.read(await ports.readCookies());
    return new Response(null, { status: 200 });
  },
}));
import { POST } from "./route";

function request(cookie?: string) {
  return new Request("http://127.0.0.1:3100/logout", {
    method: "POST", headers: cookie === undefined ? {} : { cookie },
  });
}

describe("Next logout cookie boundary", () => {
  it("projects raw name/value pairs without mutable response-cookie metadata", async () => {
    await POST(request("solmind-auth=synthetic-auth; solmind-session=synthetic-session"));
    expect(fixture.read).toHaveBeenLastCalledWith([
      { name: "solmind-auth", value: "synthetic-auth" },
      { name: "solmind-session", value: "synthetic-session" },
    ]);
  });
  it("preserves exact owned duplicates and values instead of collapsing them", async () => {
    await POST(request("solmind-auth=first; solmind-auth=second; solmind-session=first; solmind-session=second"));
    expect(fixture.read).toHaveBeenLastCalledWith([
      { name: "solmind-auth", value: "first" }, { name: "solmind-auth", value: "second" },
      { name: "solmind-session", value: "first" }, { name: "solmind-session", value: "second" },
    ]);
  });
  it.each(["solmind-auth =bad", "solmind-session", "solmind-auth=has space", "solmind-auth-suspicious =bad"])(
    "does not hide malformed owned raw framing (%s)", async cookie => {
      await POST(request(cookie)); expect(fixture.read).toHaveBeenLastCalledWith(null);
    });
  it("retains the raw reader's header and segment budgets", async () => {
    for (const cookie of ["other=" + "x".repeat(16_384), Array(129).fill("other=x").join(";")]) {
      await POST(request(cookie)); expect(fixture.read).toHaveBeenLastCalledWith(null);
    }
  });
  it("returns a genuinely empty pair list only for an absent header or unrelated pairs", async () => {
    await POST(request()); expect(fixture.read).toHaveBeenLastCalledWith([]);
    await POST(request("other=keep; unrelated malformed"));
    expect(fixture.read).toHaveBeenLastCalledWith([{ name: "other", value: "keep" }]);
  });
});
