import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXPLORER_EARLY_TEST_NOTICE_VERSION as VERSION } from "../../explorerEarlyTestNotice";
import { SOLMIND_ROLES } from "../../roles";
import type { ExplorerEarlyTestNoticeRepository } from "../../supabase/explorerEarlyTestNoticeRepository";

const mocks = vi.hoisted(() => ({ client: vi.fn(), repository: vi.fn(), home: vi.fn() }));
vi.mock("../../supabase/serviceRoleClient", () => ({ createServiceRoleClient: mocks.client }));
vi.mock("../../supabase/explorerEarlyTestNoticeRepository", () => ({ createExplorerEarlyTestNoticeRepository: mocks.repository }));
vi.mock("../explorerHomeAccess", () => ({ resolveExplorerHomeActorAccess: mocks.home }));

import { EXPLORER_EARLY_TEST_NOTICE_CAPABILITY_ENV, agreeExplorerEarlyTestNotice, checkExplorerEarlyTestNoticeAccess, isExplorerEarlyTestNoticeEnabled, resolveExplorerEarlyTestNoticeSetting, resolveExplorerEarlyTestNoticeStatus } from "../explorerEarlyTestNoticeAccess";

const actor = Object.freeze({ accountId: "10000000-0000-4000-8000-000000000001",
  applicationSessionId: "20000000-0000-4000-8000-000000000001" });
const repository = { readSetting: vi.fn<ExplorerEarlyTestNoticeRepository["readSetting"]>(),
  read: vi.fn<ExplorerEarlyTestNoticeRepository["read"]>(), agree: vi.fn<ExplorerEarlyTestNoticeRepository["agree"]>() };
const allowed = { status: "allowed", noticeVersion: null };
const required = { status: "required", noticeVersion: VERSION };
const unavailable = { status: "unavailable", noticeVersion: null };
const denied = { status: "denied", noticeVersion: null };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv(EXPLORER_EARLY_TEST_NOTICE_CAPABILITY_ENV, "enabled");
  mocks.client.mockReturnValue({}); mocks.repository.mockReturnValue(repository);
  repository.readSetting.mockResolvedValue({ enabled: true, noticeVersion: VERSION, version: 1 });
  repository.read.mockResolvedValue({ enabled: true, noticeVersion: VERSION, agreed: false });
  repository.agree.mockResolvedValue({ enabled: true, noticeVersion: VERSION, agreed: true });
  mocks.home.mockResolvedValue({ allowed: true, ...actor, expiresAt: "2999-01-01T00:00:00Z", observedAt: "2026-11-06T00:00:00Z" });
});

afterEach(() => { vi.unstubAllEnvs(); });

describe("server-only early-test notice capability", () => {
  it.each([undefined, "", "disabled", "on", "true", "ENABLED", "Enabled", " enabled", "enabled ", "enabled\n"])(
    "bypasses all notice IO unless the value is exactly enabled (%s)", async (value) => {
      vi.stubEnv(EXPLORER_EARLY_TEST_NOTICE_CAPABILITY_ENV, value);
      expect(isExplorerEarlyTestNoticeEnabled()).toBe(false);
      expect(await resolveExplorerEarlyTestNoticeSetting()).toBe("off");
      expect(await checkExplorerEarlyTestNoticeAccess(repository, actor)).toEqual(allowed);
      expect(await resolveExplorerEarlyTestNoticeStatus(null)).toEqual(allowed);
      expect(await resolveExplorerEarlyTestNoticeStatus("malformed cookie framing")).toEqual(allowed);
      expect(await agreeExplorerEarlyTestNotice(null, VERSION, true)).toEqual(denied);
      expect(await agreeExplorerEarlyTestNotice(null, "old-version", false)).toEqual(denied);
      for (const dependency of Object.values(mocks)) expect(dependency).not.toHaveBeenCalled();
      for (const port of Object.values(repository)) expect(port).not.toHaveBeenCalled();
    });
  it("reads the server capability afresh and retains the enabled fail-closed gate", async () => {
    vi.stubEnv(EXPLORER_EARLY_TEST_NOTICE_CAPABILITY_ENV, undefined);
    expect(isExplorerEarlyTestNoticeEnabled()).toBe(false);
    vi.stubEnv(EXPLORER_EARLY_TEST_NOTICE_CAPABILITY_ENV, "enabled");
    expect(isExplorerEarlyTestNoticeEnabled()).toBe(true);
    repository.readSetting.mockRejectedValue(new Error("synthetic-unreadable"));
    expect(await resolveExplorerEarlyTestNoticeSetting()).toBe("unavailable");
    expect(repository.readSetting).toHaveBeenCalledOnce();
  });
});

describe("early-test notice gate", () => {
  it("allows off without reading account agreement", async () => {
    repository.readSetting.mockResolvedValue({ enabled: false, noticeVersion: VERSION, version: 1 });
    expect(await checkExplorerEarlyTestNoticeAccess(repository, actor)).toEqual(allowed);
    expect(repository.read).not.toHaveBeenCalled();
  });
  it("holds on/not agreed and allows only agreement to the current version", async () => {
    expect(await checkExplorerEarlyTestNoticeAccess(repository, actor)).toEqual(required);
    expect(repository.read).toHaveBeenCalledExactlyOnceWith(actor);
    repository.read.mockResolvedValue({ enabled: true, noticeVersion: VERSION, agreed: true });
    expect(await checkExplorerEarlyTestNoticeAccess(repository, actor)).toEqual(allowed);
    repository.read.mockResolvedValue({ enabled: true, noticeVersion: "old-version", agreed: true });
    expect(await checkExplorerEarlyTestNoticeAccess(repository, actor)).toEqual(unavailable);
  });
  it("fails closed on unreadable setting, unsupported version and failed account read", async () => {
    repository.readSetting.mockRejectedValueOnce(new Error("private detail"));
    expect(await checkExplorerEarlyTestNoticeAccess(repository, actor)).toEqual(unavailable);
    repository.readSetting.mockResolvedValueOnce({ enabled: false, noticeVersion: "future-version", version: 2 });
    expect(await checkExplorerEarlyTestNoticeAccess(repository, actor)).toEqual(unavailable);
    expect(repository.read).not.toHaveBeenCalled();
    repository.read.mockRejectedValueOnce(new Error("private detail"));
    expect(await checkExplorerEarlyTestNoticeAccess(repository, actor)).toEqual(unavailable);
  });
  it.each([SOLMIND_ROLES.GUIDE, SOLMIND_ROLES.ADMIN])("leaves %s unaffected without setting or agreement reads", async (role) => {
    expect(await checkExplorerEarlyTestNoticeAccess(repository, actor, role)).toEqual(allowed);
    expect(repository.readSetting).not.toHaveBeenCalled(); expect(repository.read).not.toHaveBeenCalled();
  });
});

describe("server layout setting", () => {
  it("reads off without any account authentication or agreement read", async () => {
    repository.readSetting.mockResolvedValue({ enabled: false, noticeVersion: VERSION, version: 1 });
    expect(await resolveExplorerEarlyTestNoticeSetting()).toBe("off");
    expect(mocks.home).not.toHaveBeenCalled(); expect(repository.read).not.toHaveBeenCalled();
  });
  it("distinguishes on from an unreadable or unsupported setting, even while off", async () => {
    expect(await resolveExplorerEarlyTestNoticeSetting()).toBe("on");
    repository.readSetting.mockRejectedValueOnce(new Error("private detail"));
    expect(await resolveExplorerEarlyTestNoticeSetting()).toBe("unavailable");
    repository.readSetting.mockResolvedValueOnce({ enabled: false, noticeVersion: "future-version", version: 2 });
    expect(await resolveExplorerEarlyTestNoticeSetting()).toBe("unavailable");
    expect(mocks.home).not.toHaveBeenCalled(); expect(repository.read).not.toHaveBeenCalled();
  });
});

describe("request-bound notice status and agreement", () => {
  it("authenticates even an off-setting status request without reading agreement", async () => {
    repository.readSetting.mockResolvedValue({ enabled: false, noticeVersion: VERSION, version: 1 });
    expect(await resolveExplorerEarlyTestNoticeStatus(null)).toEqual(allowed);
    expect(mocks.home).toHaveBeenCalledOnce(); expect(repository.read).not.toHaveBeenCalled();
  });
  it("uses existing Explorer home access, preserves duplicate raw cookies and exports no identity", async () => {
    expect(await resolveExplorerEarlyTestNoticeStatus("solmind-auth=first; solmind-auth=second")).toEqual(required);
    const { cookies } = mocks.home.mock.calls[0][0];
    expect(cookies.getAll()).toEqual([{ name: "solmind-auth", value: "first" }, { name: "solmind-auth", value: "second" }]);
    cookies.getAll()[0].value = "changed";
    expect(cookies.getAll()[0].value).toBe("first");
    expect(repository.read).toHaveBeenCalledWith(actor);
  });
  it("denies malformed framing and denied existing auth before agreement reads", async () => {
    expect(await resolveExplorerEarlyTestNoticeStatus("solmind-auth=has space")).toEqual(denied);
    expect(mocks.home).not.toHaveBeenCalled();
    mocks.home.mockResolvedValue({ allowed: false });
    expect(await resolveExplorerEarlyTestNoticeStatus(null)).toEqual(denied);
    expect(repository.read).not.toHaveBeenCalled();
    expect(repository.readSetting).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("anonymous calls reveal no setting state and perform no setting read", async () => {
    mocks.home.mockResolvedValue({ allowed: false });
    repository.readSetting.mockRejectedValue(new Error("private detail"));
    expect(await resolveExplorerEarlyTestNoticeStatus(null)).toEqual(denied);
    expect(await agreeExplorerEarlyTestNotice(null, VERSION, true)).toEqual(denied);
    expect(repository.readSetting).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("unreadable settings show unavailable after existing authentication", async () => {
    repository.readSetting.mockRejectedValue(new Error("private detail"));
    expect(await resolveExplorerEarlyTestNoticeStatus(null)).toEqual(unavailable);
    expect(mocks.home).toHaveBeenCalledOnce();
    expect(repository.read).not.toHaveBeenCalled();
  });
  it("binds agreement only to server identity and current explicit affirmation", async () => {
    expect(await agreeExplorerEarlyTestNotice(null, VERSION, true)).toEqual(allowed);
    expect(repository.agree).toHaveBeenCalledExactlyOnceWith(actor, VERSION, true);
    expect(repository.read).not.toHaveBeenCalled();
  });
  it.each([["old-version", true], [VERSION, false], [VERSION, "true"], [null, null]])(
    "refuses invalid agreement input before any dependency", async (version, affirmation) => {
      expect(await agreeExplorerEarlyTestNotice(null, version, affirmation)).toEqual(denied);
      expect(mocks.client).not.toHaveBeenCalled(); expect(repository.agree).not.toHaveBeenCalled();
    });
  it("records nothing when auth denies, setting is off, or current version is unsupported", async () => {
    mocks.home.mockResolvedValue({ allowed: false });
    expect(await agreeExplorerEarlyTestNotice(null, VERSION, true)).toEqual(denied);
    expect(repository.readSetting).not.toHaveBeenCalled();
    mocks.home.mockResolvedValue({ allowed: true, ...actor });
    repository.readSetting.mockResolvedValueOnce({ enabled: false, noticeVersion: VERSION, version: 1 });
    expect(await agreeExplorerEarlyTestNotice(null, VERSION, true)).toEqual(allowed);
    repository.readSetting.mockResolvedValueOnce({ enabled: true, noticeVersion: "future-version", version: 2 });
    expect(await agreeExplorerEarlyTestNotice(null, VERSION, true)).toEqual(unavailable);
    expect(repository.agree).not.toHaveBeenCalled();
  });
  it("never reports a failed or unconfirmed agreement as success", async () => {
    repository.agree.mockRejectedValueOnce(new Error("private detail"));
    expect(await agreeExplorerEarlyTestNotice(null, VERSION, true)).toEqual(unavailable);
    repository.agree.mockResolvedValueOnce({ enabled: true, noticeVersion: VERSION, agreed: false });
    expect(await agreeExplorerEarlyTestNotice(null, VERSION, true)).toEqual(required);
  });
});
