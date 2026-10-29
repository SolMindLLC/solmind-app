import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const f = vi.hoisted(() => ({ send: vi.fn(), verify: vi.fn(), guard: vi.fn() }));
vi.mock("@/lib/solmind/auth/trustedApplicationOrigin", () => ({ loadTrustedApplicationOrigin: () => "http://127.0.0.1:4311" }));
vi.mock("@/lib/solmind/auth/sameOriginJsonWriteRequest", () => ({ readSameOriginJsonWriteRequest: f.guard }));
vi.mock("@/lib/solmind/supabase/explorerSignInComposition", () => ({ requestExplorerSignInCode: f.send, verifyExplorerSignInCode: f.verify }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [] }) }));
import { POST as send } from "../send/route";
import { POST as verify } from "../verify/route";
const flowId = "17170000-0000-4000-8000-000000009001";
beforeEach(() => { f.send.mockReset(); f.verify.mockReset(); f.guard.mockReset(); });
// Mocked guarded input/composition only; no actual sign-in, mail or provider.
it("forwards the guarded public flow selector on Send and publishes only its flow acknowledgment", async () => {
  f.guard.mockResolvedValue({ ok: true, value: { identifier: "explorer@synthetic.invalid", flowId } });
  const acknowledgment = { acknowledgment: "verification_code_requested", flowId };
  f.send.mockResolvedValue(acknowledgment);
  const reply = await send(new NextRequest("http://127.0.0.1:4311/login/explorer/send", { method: "POST" }));
  expect(f.send).toHaveBeenCalledExactlyOnceWith({ trustedOrigin: "http://127.0.0.1:4311", identifier: "explorer@synthetic.invalid", flowId });
  expect(await reply.json()).toEqual(acknowledgment); expect(reply.headers.get("cache-control")).toContain("no-store");
});
it("forwards exactly the selected Verify flow branch without an undefined or fallback challenge selector", async () => {
  f.guard.mockResolvedValue({ ok: true, value: { identifier: "explorer@synthetic.invalid", flowId, code: "123456" } });
  f.verify.mockResolvedValue({ outcome: "code_not_accepted" });
  const reply = await verify(new NextRequest("http://127.0.0.1:4311/login/explorer/verify", { method: "POST" }));
  expect(f.verify).toHaveBeenCalledExactlyOnceWith({ trustedOrigin: "http://127.0.0.1:4311", identifier: "explorer@synthetic.invalid",
    flowId, code: "123456", requestCookies: [], priorCleanupCandidate: null, createSuccessResponse: expect.any(Function) });
  expect(await reply.json()).toEqual({ outcome: "code_not_accepted" }); expect(f.send).not.toHaveBeenCalled();
});
