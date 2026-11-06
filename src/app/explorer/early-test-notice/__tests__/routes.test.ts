import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const ports = vi.hoisted(() => ({ status: vi.fn(), agree: vi.fn(), guard: vi.fn(), origin: vi.fn(), enabled: vi.fn() }));
vi.mock("@/lib/solmind/auth/explorerEarlyTestNoticeAccess", () => ({
  resolveExplorerEarlyTestNoticeStatus: ports.status, agreeExplorerEarlyTestNotice: ports.agree,
  isExplorerEarlyTestNoticeEnabled: ports.enabled,
}));
vi.mock("@/lib/solmind/auth/sameOriginJsonWriteRequest", () => ({ readSameOriginJsonWriteRequest: ports.guard }));
vi.mock("@/lib/solmind/auth/trustedApplicationOrigin", () => ({ loadTrustedApplicationOrigin: ports.origin }));
import { GET } from "../status/route";
import { POST } from "../agree/route";
import { EXPLORER_EARLY_TEST_NOTICE_VERSION } from "@/lib/solmind/explorerEarlyTestNotice";
const version = EXPLORER_EARLY_TEST_NOTICE_VERSION;
beforeEach(() => {
  vi.resetAllMocks();
  ports.enabled.mockReturnValue(true);
  ports.origin.mockReturnValue("http://localhost:3000");
  ports.status.mockResolvedValue({ status: "required", noticeVersion: version });
  ports.agree.mockResolvedValue({ status: "allowed", noticeVersion: null });
  ports.guard.mockResolvedValue({ ok: true, value: { noticeVersion: version, adultAffirmation: true } });
});
describe("early-test notice HTTP edges", () => {
  it("refuses agreement with the capability off before origin configuration, body parsing or agreement work", async () => {
    ports.enabled.mockReturnValue(false);
    ports.origin.mockImplementation(() => { throw new Error("must-not-load-origin"); });
    const response = await POST(new NextRequest("http://localhost:3000/explorer/early-test-notice/agree", { method: "POST" }));
    expect(await response.json()).toEqual({ status: "denied", noticeVersion: null });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(ports.origin).not.toHaveBeenCalled();
    expect(ports.guard).not.toHaveBeenCalled();
    expect(ports.agree).not.toHaveBeenCalled();
  });
  it("passes untouched raw cookie framing to status and forbids cached results", async () => {
    const response = await GET(new NextRequest("http://localhost:3000/explorer/early-test-notice/status", { headers: { cookie: "a=1; a=2" } }));
    expect(ports.status).toHaveBeenCalledWith("a=1; a=2");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ status: "required", noticeVersion: version });
  });
  it("rejects query authority before status or agreement", async () => {
    expect((await (await GET(new NextRequest("http://localhost:3000/explorer/early-test-notice/status?account=x"))).json()).status).toBe("denied");
    expect((await (await POST(new NextRequest("http://localhost:3000/explorer/early-test-notice/agree?account=x", { method: "POST" }))).json()).status).toBe("denied");
    expect(ports.status).not.toHaveBeenCalled();
    expect(ports.agree).not.toHaveBeenCalled();
  });
  it("requires the existing same-origin guard and rejects extra identity fields", async () => {
    const request = () => new NextRequest("http://localhost:3000/explorer/early-test-notice/agree", { method: "POST" });
    ports.guard.mockResolvedValueOnce({ ok: false });
    expect((await (await POST(request())).json()).status).toBe("denied");
    ports.guard.mockResolvedValueOnce({ ok: true, value: { noticeVersion: version, adultAffirmation: true, accountId: "browser" } });
    expect((await (await POST(request())).json()).status).toBe("denied");
    expect(ports.agree).not.toHaveBeenCalled();
  });
  it("records only the explicit version/affirmation through fresh actor composition", async () => {
    const response = await POST(new NextRequest("http://localhost:3000/explorer/early-test-notice/agree", { method: "POST", headers: { cookie: "a=1; a=2" } }));
    expect(ports.agree).toHaveBeenCalledExactlyOnceWith("a=1; a=2", version, true);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ status: "allowed", noticeVersion: null });
  });
  it("returns a closed unavailable result on configuration failure", async () => {
    ports.origin.mockImplementationOnce(() => { throw new Error("private underlying detail"); });
    const response = await POST(new NextRequest("http://localhost:3000/explorer/early-test-notice/agree", { method: "POST" }));
    expect(await response.json()).toEqual({ status: "unavailable", noticeVersion: null });
    expect(ports.agree).not.toHaveBeenCalled();
  });
});
