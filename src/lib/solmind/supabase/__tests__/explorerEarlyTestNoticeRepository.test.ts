import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EXPLORER_EARLY_TEST_NOTICE_VERSION as VERSION } from "../../explorerEarlyTestNotice";
import { APPLICATION_SETTING_READ_FAILED } from "../applicationSettingReader";
import { createExplorerEarlyTestNoticeRepository, EXPLORER_EARLY_TEST_NOTICE_REPOSITORY_FAILED as FAILED } from "../explorerEarlyTestNoticeRepository";

const actor = Object.freeze({ accountId: "10000000-0000-4000-8000-000000000001",
  applicationSessionId: "20000000-0000-4000-8000-000000000001" });
const statusRow = { enabled: true, notice_version: VERSION, agreed: false };
function fixture(data: unknown = [statusRow], error: unknown = null) {
  const abortSignal = vi.fn().mockResolvedValue({ data, error });
  const rpc = vi.fn<(...args: unknown[]) => { abortSignal: typeof abortSignal }>(() => ({ abortSignal }));
  const repository = createExplorerEarlyTestNoticeRepository({ rpc } as unknown as SupabaseClient);
  return { rpc, abortSignal, repository };
}

describe("closed early-test notice repository", () => {
  it("reads only the proved actor and session with a bounded request", async () => {
    const { repository, rpc, abortSignal } = fixture();
    const result = await repository.read(actor);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("solmind_read_explorer_early_test_notice_v1", {
      p_actor_user_account_id: actor.accountId, p_user_session_id: actor.applicationSessionId,
    });
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(result).toEqual({ enabled: true, noticeVersion: VERSION, agreed: false });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(repository)).toBe(true);
  });

  it("records only the approved version and explicit adult affirmation", async () => {
    const { repository, rpc } = fixture([{ ...statusRow, agreed: true }]);
    await expect(repository.agree(actor, VERSION, true)).resolves.toEqual({ enabled: true, noticeVersion: VERSION, agreed: true });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("solmind_agree_explorer_early_test_notice_v1", {
      p_actor_user_account_id: actor.accountId, p_user_session_id: actor.applicationSessionId,
      p_notice_version: VERSION, p_adult_affirmation: true,
    });
    expect(Object.isFrozen(rpc.mock.calls[0][1])).toBe(true);
  });

  it.each([null, {}, { ...actor, accountId: "bad" }, { ...actor, applicationSessionId: "bad" },
    { ...actor, browserRole: "explorer" }, Object.defineProperty({ applicationSessionId: actor.applicationSessionId }, "accountId", { enumerable: true, get: () => actor.accountId }),
  ])("refuses invalid actor arguments before RPC: %j", async (value) => {
    const { repository, rpc } = fixture();
    await expect(repository.read(value as never)).rejects.toThrow(FAILED);
    await expect(repository.agree(value as never, VERSION, true)).rejects.toThrow(FAILED);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([["old-version", true], [VERSION, false], [VERSION, "true"], [VERSION, null]])(
    "refuses invalid version/affirmation before RPC", async (version, affirmation) => {
      const { repository, rpc } = fixture();
      await expect(repository.agree(actor, version as string, affirmation as never)).rejects.toThrow(FAILED);
      expect(rpc).not.toHaveBeenCalled();
    });

  it.each([null, [], [statusRow, statusRow], [{}], [{ ...statusRow, agreed: "true" }],
    [{ ...statusRow, enabled: 1 }], [{ ...statusRow, notice_version: " bad " }],
    [{ ...statusRow, accountId: actor.accountId }],
  ])("rejects non-exact RPC rows: %j", async (data) => {
    await expect(fixture(data).repository.read(actor)).rejects.toThrow(FAILED);
  });

  it("redacts both RPC errors and thrown transport details", async () => {
    const failed = fixture([statusRow], { message: "private transport detail" });
    await expect(failed.repository.read(actor)).rejects.toThrow(FAILED);
    const thrown = fixture();
    thrown.rpc.mockImplementation(() => { throw new Error("private transport detail"); });
    await expect(thrown.repository.read(actor)).rejects.toThrow(FAILED);
  });

  it("closes throwing actor objects without leaking the thrown detail", async () => {
    const { repository, rpc } = fixture();
    const badActor = new Proxy(actor, { ownKeys() { throw new Error("private actor detail"); } });
    await expect(repository.read(badActor)).rejects.toThrow(FAILED);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reads the fixed protected setting without any actor or caller key", async () => {
    const { repository, rpc, abortSignal } = fixture([{ enabled: false, notice_version: VERSION, version: 1 }]);
    const setting = await repository.readSetting();
    expect(setting).toEqual({ enabled: false, noticeVersion: VERSION, version: 1 });
    expect(Object.isFrozen(setting)).toBe(true);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("solmind_read_explorer_early_test_notice_setting_v1", {});
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it.each(["a", "a".repeat(128), "a0.-z"])("accepts the shared SQL/TypeScript version pattern: %s", async (noticeVersion) => {
    await expect(fixture([{ ...statusRow, notice_version: noticeVersion }]).repository.read(actor))
      .resolves.toMatchObject({ noticeVersion });
    await expect(fixture([{ enabled: false, notice_version: noticeVersion, version: 1 }]).repository.readSetting())
      .resolves.toMatchObject({ noticeVersion });
  });

  it.each(["a".repeat(129), "a_b", "A", ".a", "a b"])("rejects tokens outside the shared version pattern: %s", async (noticeVersion) => {
    await expect(fixture([{ ...statusRow, notice_version: noticeVersion }]).repository.read(actor))
      .rejects.toThrow(FAILED);
    await expect(fixture([{ enabled: false, notice_version: noticeVersion, version: 1 }]).repository.readSetting())
      .rejects.toThrow(APPLICATION_SETTING_READ_FAILED);
  });

  it.each([null, [], [{ enabled: false, notice_version: VERSION, version: 0 }],
    [{ enabled: false, notice_version: VERSION, version: "1" }],
    [{ enabled: false, notice_version: VERSION, version: 1, extra: true }],
    [{ enabled: "false", notice_version: VERSION, version: 1 }],
    [{ enabled: false, notice_version: "", version: 1 }],
  ])("fails closed on an unreadable setting: %j", async (data) => {
    await expect(fixture(data).repository.readSetting()).rejects.toThrow(APPLICATION_SETTING_READ_FAILED);
  });
});
