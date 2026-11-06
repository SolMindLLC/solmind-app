import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EXPLORER_EARLY_TEST_NOTICE_VERSION } from "../explorerEarlyTestNotice";
import { readExplorerEarlyTestNoticeSetting, type ExplorerEarlyTestNoticeSetting } from "./applicationSettingReader";

export const EXPLORER_EARLY_TEST_NOTICE_REPOSITORY_FAILED = "explorer_early_test_notice_unavailable";
export type ExplorerEarlyTestNoticeActor = Readonly<{ accountId: string; applicationSessionId: string }>;
export type ExplorerEarlyTestNoticeRecord = Readonly<{ enabled: boolean; noticeVersion: string; agreed: boolean }>;
export type ExplorerEarlyTestNoticeRepository = Readonly<{
  readSetting(): Promise<ExplorerEarlyTestNoticeSetting>;
  read(actor: ExplorerEarlyTestNoticeActor): Promise<ExplorerEarlyTestNoticeRecord>;
  agree(actor: ExplorerEarlyTestNoticeActor, noticeVersion: string, adultAffirmation: true): Promise<ExplorerEarlyTestNoticeRecord>;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function actorParameters(actor: ExplorerEarlyTestNoticeActor) {
  try {
    if (!actor || typeof actor !== "object" ||
        Object.keys(actor).sort().join(",") !== "accountId,applicationSessionId") throw new Error(EXPLORER_EARLY_TEST_NOTICE_REPOSITORY_FAILED);
    const accountId = Object.getOwnPropertyDescriptor(actor, "accountId")?.value;
    const applicationSessionId = Object.getOwnPropertyDescriptor(actor, "applicationSessionId")?.value;
    if (typeof accountId !== "string" || !UUID.test(accountId) ||
        typeof applicationSessionId !== "string" || !UUID.test(applicationSessionId)) throw new Error(EXPLORER_EARLY_TEST_NOTICE_REPOSITORY_FAILED);
    return Object.freeze({ p_actor_user_account_id: accountId, p_user_session_id: applicationSessionId });
  } catch { throw new Error(EXPLORER_EARLY_TEST_NOTICE_REPOSITORY_FAILED); }
}

// The only two agreement capabilities bind IDs already proved by request auth.
// SQL independently repeats the current Explorer/account/session binding.
export function createExplorerEarlyTestNoticeRepository(client: SupabaseClient): ExplorerEarlyTestNoticeRepository {
  async function call(name: "solmind_read_explorer_early_test_notice_v1" | "solmind_agree_explorer_early_test_notice_v1",
    parameters: Readonly<Record<string, unknown>>): Promise<ExplorerEarlyTestNoticeRecord> {
    try {
      const { data, error } = await client.rpc(name, parameters).abortSignal(AbortSignal.timeout(10_000));
      if ((error !== null && error !== undefined) || !Array.isArray(data) || data.length !== 1) throw new Error(EXPLORER_EARLY_TEST_NOTICE_REPOSITORY_FAILED);
      const row: unknown = data[0];
      if (!row || typeof row !== "object" || Array.isArray(row) ||
          Object.keys(row).sort().join(",") !== "agreed,enabled,notice_version") throw new Error(EXPLORER_EARLY_TEST_NOTICE_REPOSITORY_FAILED);
      const enabled = Object.getOwnPropertyDescriptor(row, "enabled")?.value;
      const agreed = Object.getOwnPropertyDescriptor(row, "agreed")?.value;
      const noticeVersion = Object.getOwnPropertyDescriptor(row, "notice_version")?.value;
      if (typeof enabled !== "boolean" || typeof agreed !== "boolean" || typeof noticeVersion !== "string" ||
          !/^[a-z0-9][a-z0-9.-]{0,127}$/.test(noticeVersion)) throw new Error(EXPLORER_EARLY_TEST_NOTICE_REPOSITORY_FAILED);
      return Object.freeze({ enabled, agreed, noticeVersion });
    } catch { throw new Error(EXPLORER_EARLY_TEST_NOTICE_REPOSITORY_FAILED); }
  }
  return Object.freeze({
    readSetting: () => readExplorerEarlyTestNoticeSetting(client),
    read: async (actor) => call("solmind_read_explorer_early_test_notice_v1", actorParameters(actor)),
    agree: async (actor, noticeVersion, adultAffirmation) => {
      const parameters = actorParameters(actor);
      if (noticeVersion !== EXPLORER_EARLY_TEST_NOTICE_VERSION || adultAffirmation !== true) throw new Error(EXPLORER_EARLY_TEST_NOTICE_REPOSITORY_FAILED);
      return call("solmind_agree_explorer_early_test_notice_v1", Object.freeze({ ...parameters,
        p_notice_version: noticeVersion, p_adult_affirmation: true }));
    },
  });
}
