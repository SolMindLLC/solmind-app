import { afterEach, describe, expect, it, vi } from "vitest";
import { requestExplorerEarlyTestNotice } from "../explorerEarlyTestNoticeBrowserRequest";
import { EXPLORER_EARLY_TEST_NOTICE_VERSION } from "../explorerEarlyTestNotice";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("notice browser requests", () => {
  it("sends only version and adult affirmation, once, without redirects or caching", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ status: "allowed", noticeVersion: null }));
    vi.stubGlobal("fetch", fetcher);
    expect(await requestExplorerEarlyTestNotice("/explorer/early-test-notice/agree", {
      noticeVersion: EXPLORER_EARLY_TEST_NOTICE_VERSION, adultAffirmation: true,
    }, new AbortController().signal)).toEqual({ status: "allowed", noticeVersion: null });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "POST", cache: "no-store", credentials: "same-origin", redirect: "error",
      body: JSON.stringify({ noticeVersion: EXPLORER_EARLY_TEST_NOTICE_VERSION, adultAffirmation: true }) });
  });
  it("fails closed on oversized or malformed responses", async () => {
    for (const response of [new Response(" ".repeat(1025), { headers: { "Content-Type": "application/json" } }),
      Response.json({ status: "allowed", noticeVersion: null, extra: true }), new Response("not json")]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
      expect((await requestExplorerEarlyTestNotice("/explorer/early-test-notice/status", null, new AbortController().signal)).status).toBe("unavailable");
    }
  });
  it("ends a stalled read at the finite budget, even if fetch ignores abort", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    const pending = requestExplorerEarlyTestNotice("/explorer/early-test-notice/status", null, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await pending).status).toBe("unavailable");
  });
});
