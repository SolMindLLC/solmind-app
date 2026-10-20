import { describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const fixture = vi.hoisted(() => ({ cookies: [] as unknown[], read: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => fixture.cookies }) }));
vi.mock("@/lib/solmind/supabase/logoutComposition", () => ({
  handleLogout: async (_request: Request, ports: { readCookies(): Promise<unknown> }) => {
    fixture.read(await ports.readCookies());
    return new Response(null, { status: 200 });
  },
}));
import { POST } from "./route";

describe("Next logout cookie boundary", () => {
  it("projects mutable Next cookies to the strict name/value input", async () => {
    const response = NextResponse.json({});
    response.cookies.set("solmind-auth", "synthetic-auth");
    response.cookies.set("solmind-session", "synthetic-session");
    fixture.cookies = response.cookies.getAll();
    expect(fixture.cookies.every(cookie => Object.hasOwn(cookie as object, "path"))).toBe(true);
    await POST(new Request("http://127.0.0.1:3100/logout", { method: "POST" }));
    expect(fixture.read).toHaveBeenLastCalledWith([
      { name: "solmind-auth", value: "synthetic-auth" },
      { name: "solmind-session", value: "synthetic-session" },
    ]);
  });
});
