import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestCookieAccessor } from "../../../../lib/solmind/auth/requestCookieAccessor";

const seams = vi.hoisted(() => ({ header: null as string | null, throwHeaders: false, access: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => {
  if (seams.throwHeaders) throw new Error("fixture_private_error");
  return { get: (name: string) => name === "cookie" ? seams.header : null };
} }));
vi.mock("@/lib/solmind/auth/adminHomeAccess", () => ({ resolveAdminHomeAccess: seams.access }));
import AdminHomePage, { dynamic, runtime } from "../page";
import { AdminHome, AdminSessionOutcome } from "../../../../components/solmind/AdminHome";

const allowed = { allowed: true as const, expiresAt: "2026-10-23T17:00:00.000Z", observedAt: "2026-10-23T16:05:00.000Z" };
beforeEach(() => {
  seams.header = null; seams.throwHeaders = false; seams.access.mockReset();
  seams.access.mockResolvedValue({ allowed: false, reason: "route_access_denied" });
  vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("unexpected_effect"); });
  for (const level of ["log", "warn", "error", "info", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => undefined);
});
afterEach(() => {
  expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(0);
  for (const level of ["log", "warn", "error", "info", "debug"] as const) expect(vi.mocked(console[level]).mock.calls.length).toBe(0);
  vi.restoreAllMocks();
});

// Direct invocation of the page composition with mocked request/auth seams;
// this does not render an async React Server Component or prove real access.
describe("Admin protected page raw-header composition", () => {
  it("P01 request rendering is explicit and home receives only the two nonsecret session fields", async () => {
    seams.access.mockResolvedValue({ ...allowed, actorUserAccountId: "fixture-internal-actor", sessionId: "fixture-internal-session" });
    const result = await AdminHomePage();
    expect(dynamic === "force-dynamic" && runtime === "nodejs").toBe(true);
    expect(result.type === AdminHome && Object.keys(result.props).join() === "session").toBe(true);
    expect(Object.keys(result.props.session).sort()).toEqual(["expiresAt", "observedAt"]);
    expect(result.props.session.expiresAt === allowed.expiresAt && result.props.session.observedAt === allowed.observedAt).toBe(true);
  });
  it("P02 no cookie still goes through opaque denial without creating home", async () => {
    const result = await AdminHomePage();
    const cookies: RequestCookieAccessor = seams.access.mock.calls[0][0].cookies;
    expect(cookies.getAll().length).toBe(0);
    expect(result.type === AdminSessionOutcome && result.props.outcome === "session_ended").toBe(true);
  });
  it("P03 duplicate owned cookie occurrences survive unchanged at the page seam", async () => {
    seams.header = "solmind-session=fixture-one; solmind-session=fixture-two";
    seams.access.mockImplementation(async ({ cookies }: { cookies: RequestCookieAccessor }) => {
      const records = cookies.getAll();
      expect(records.length === 2 && records[0].name === records[1].name && records[0].value !== records[1].value).toBe(true);
      return { allowed: false, reason: "route_access_denied" };
    });
    const result = await AdminHomePage();
    expect(seams.access.mock.calls.length === 1 && result.type === AdminSessionOutcome).toBe(true);
  });
  it("P04 raw percent encoding is never decoded into a newly acceptable owned value", async () => {
    seams.header = "solmind-auth=base64-%61bc; solmind-session=fixture";
    await AdminHomePage();
    const cookies: RequestCookieAccessor = seams.access.mock.calls[0][0].cookies;
    expect(cookies.getAll()[0].value === "base64-%61bc").toBe(true);
  });
  it("P05 unrelated duplicate cookies are preserved without overriding access policy", async () => {
    seams.header = "theme=first; theme=second"; seams.access.mockResolvedValue(allowed);
    const result = await AdminHomePage();
    expect(seams.access.mock.calls.length === 1 && result.type === AdminHome).toBe(true);
    const cookies: RequestCookieAccessor = seams.access.mock.calls[0][0].cookies;
    expect(cookies.getAll().length).toBe(2);
  });
  it.each(["solmind-auth =bad", "solmind-auth=bad value", "solmind-auth=bad,merged", "solmind-auth", ";", "a=" + "x".repeat(16_384), Array.from({ length: 129 }, () => "a=b").join(";")])("P06 malformed framing case %# denies before auth without revealing values", async raw => {
    seams.header = raw;
    const result = await AdminHomePage();
    expect(seams.access.mock.calls.length === 0 && result.type === AdminSessionOutcome).toBe(true);
  });
  it("P07 cookie snapshots are defensive and attempted writes remain a no-op", async () => {
    seams.header = "solmind-session=fixture";
    await AdminHomePage();
    const cookies: RequestCookieAccessor = seams.access.mock.calls[0][0].cookies;
    const first = cookies.getAll(); first[0].value = "changed";
    cookies.setAll([{ name: "solmind-session", value: "changed" }]);
    expect(cookies.getAll()[0].value === "fixture").toBe(true);
  });
  it("P08 framework and access failures collapse to the session-ended component without raw errors", async () => {
    seams.throwHeaders = true;
    expect((await AdminHomePage()).type === AdminSessionOutcome && seams.access.mock.calls.length === 0).toBe(true);
    seams.throwHeaders = false; seams.access.mockRejectedValue(new Error("fixture_private_error"));
    expect((await AdminHomePage()).type).toBe(AdminSessionOutcome);
  });
});
