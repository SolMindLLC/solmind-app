import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EXPLORER_EARLY_TEST_NOTICE_VERSION as VERSION } from "@/lib/solmind/explorerEarlyTestNotice";

const mock = vi.hoisted(() => ({ client: vi.fn(), rpc: vi.fn(), result: vi.fn() }));
vi.mock("@/lib/solmind/supabase/serviceRoleClient", () => ({ createServiceRoleClient: mock.client }));
vi.mock("next/navigation", () => ({ usePathname: () => "/explorer/conversation" }));
vi.mock("@/lib/solmind/supabase/explorerEarlyTestNoticeRepository", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/solmind/supabase/explorerEarlyTestNoticeRepository")>();
  return { ...original, createExplorerEarlyTestNoticeRepository: vi.fn(original.createExplorerEarlyTestNoticeRepository) };
});
vi.mock("@/lib/solmind/supabase/applicationSettingReader", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/solmind/supabase/applicationSettingReader")>();
  return { ...original, readExplorerEarlyTestNoticeSetting: vi.fn(original.readExplorerEarlyTestNoticeSetting) };
});

import ExplorerLayout from "../layout";
import { ExplorerEarlyTestNoticeBoundary, ExplorerEarlyTestNoticeUnavailable } from "@/components/solmind/ExplorerEarlyTestNotice";
import { EXPLORER_EARLY_TEST_NOTICE_CAPABILITY_ENV } from "@/lib/solmind/auth/explorerEarlyTestNoticeAccess";
import { createExplorerEarlyTestNoticeRepository } from "@/lib/solmind/supabase/explorerEarlyTestNoticeRepository";
import { readExplorerEarlyTestNoticeSetting } from "@/lib/solmind/supabase/applicationSettingReader";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv(EXPLORER_EARLY_TEST_NOTICE_CAPABILITY_ENV, "enabled");
  mock.client.mockReturnValue({ rpc: mock.rpc });
  mock.rpc.mockReturnValue({ abortSignal: mock.result });
});
afterEach(() => vi.unstubAllEnvs());

function setting(enabled: boolean, noticeVersion = VERSION) {
  mock.result.mockResolvedValue({ data: [{ enabled, notice_version: noticeVersion, version: 1 }], error: null });
}

it.each([undefined, "", "off", "true", "ENABLED", "enabled "])("capability %s returns the exact children without notice IO", async (capability) => {
  vi.stubEnv(EXPLORER_EARLY_TEST_NOTICE_CAPABILITY_ENV, capability);
  const children = <button>Existing app control</button>;
  const result = await ExplorerLayout({ children });
  expect(result).toBe(children);
  expect(renderToStaticMarkup(result)).toBe("<button>Existing app control</button>");
  expect(createExplorerEarlyTestNoticeRepository).not.toHaveBeenCalled();
  expect(readExplorerEarlyTestNoticeSetting).not.toHaveBeenCalled();
  expect(mock.client).not.toHaveBeenCalled();
  expect(mock.rpc).not.toHaveBeenCalled();
});

it("off returns the exact existing children without a notice client boundary", async () => {
  setting(false);
  const children = <button>Existing app control</button>;
  const result = await ExplorerLayout({ children });
  expect(result).toBe(children);
  expect(renderToStaticMarkup(result)).toBe("<button>Existing app control</button>");
  expect(mock.rpc).toHaveBeenCalledExactlyOnceWith("solmind_read_explorer_early_test_notice_setting_v1", {});
});

it("on mounts the notice boundary without reading any account data", async () => {
  setting(true);
  const children = <button>Existing app control</button>;
  const result = await ExplorerLayout({ children });
  expect(result).toEqual(<ExplorerEarlyTestNoticeBoundary>{children}</ExplorerEarlyTestNoticeBoundary>);
  expect(mock.rpc).toHaveBeenCalledExactlyOnceWith("solmind_read_explorer_early_test_notice_setting_v1", {});
});

it.each([true, false])("an unsupported version fails closed even when enabled is %s", async (enabled) => {
  setting(enabled, "future-version");
  const result = await ExplorerLayout({ children: <button>Existing app control</button> });
  expect(result).toEqual(<ExplorerEarlyTestNoticeUnavailable />);
  const markup = renderToStaticMarkup(result);
  expect(markup).toContain("Please try again later");
  expect(markup).not.toContain("Existing app control");
  expect(markup).not.toContain("Checking access...");
});

it.each([{ data: [] }, { data: [{ enabled: "false", notice_version: VERSION, version: 1 }] }])("malformed setting rows fail closed", async ({ data }) => {
  mock.result.mockResolvedValue({ data, error: null });
  expect(await ExplorerLayout({ children: <button>Existing app control</button> }))
    .toEqual(<ExplorerEarlyTestNoticeUnavailable />);
});

it("an unreadable setting renders unavailable without leaking the error", async () => {
  mock.result.mockRejectedValue(new Error("private setting failure"));
  const result = await ExplorerLayout({ children: <button>Existing app control</button> });
  expect(result).toEqual(<ExplorerEarlyTestNoticeUnavailable />);
  expect(renderToStaticMarkup(result)).not.toContain("private setting failure");
});
