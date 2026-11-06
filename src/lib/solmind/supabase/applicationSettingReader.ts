// PRJ01_R-WS09-WI021-S02 server-only application-setting reader.
//
// This module exposes one closed setting read. It is deliberately absent from
// the shared supabase barrel, accepts no caller-supplied key, and owns no
// browser, role, consent, persistence, or mutation behavior.

import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: applicationSettingReader must not be imported in browser code.",
  );
}

export const EXPLORER_SHARED_SNAPSHOT_SENDABILITY_DAYS_KEY =
  "explorer_shared_snapshot_sendability_days";
export const APPLICATION_SETTING_READ_FAILED =
  "solmind_application_setting_read_failed";

export type ExplorerEarlyTestNoticeSetting = Readonly<{
  enabled: boolean;
  noticeVersion: string;
  version: number;
}>;

// A separate closed RPC reads only this protected setting. No arbitrary key or
// mutation capability is exposed, including while the switch is off.
export async function readExplorerEarlyTestNoticeSetting(
  client: SupabaseClient,
): Promise<ExplorerEarlyTestNoticeSetting> {
  try {
    const { data, error } = await client.rpc(
      "solmind_read_explorer_early_test_notice_setting_v1", {},
    ).abortSignal(AbortSignal.timeout(10_000));
    if ((error !== null && error !== undefined) || !Array.isArray(data) || data.length !== 1) {
      throw new Error(APPLICATION_SETTING_READ_FAILED);
    }
    const row: unknown = data[0];
    if (!row || typeof row !== "object" || Array.isArray(row) ||
        Object.keys(row).sort().join(",") !== "enabled,notice_version,version") {
      throw new Error(APPLICATION_SETTING_READ_FAILED);
    }
    const enabled = Object.getOwnPropertyDescriptor(row, "enabled")?.value;
    const noticeVersion = Object.getOwnPropertyDescriptor(row, "notice_version")?.value;
    const version = Object.getOwnPropertyDescriptor(row, "version")?.value;
    if (typeof enabled !== "boolean" || typeof noticeVersion !== "string" ||
        !/^[a-z0-9][a-z0-9.-]{0,127}$/.test(noticeVersion) ||
        !isSafePositiveInteger(version)) throw new Error(APPLICATION_SETTING_READ_FAILED);
    return Object.freeze({ enabled, noticeVersion, version });
  } catch { throw new Error(APPLICATION_SETTING_READ_FAILED); }
}

export type ExplorerSharedSnapshotSendabilitySetting = Readonly<{
  key: typeof EXPLORER_SHARED_SNAPSHOT_SENDABILITY_DAYS_KEY;
  days: number;
  minimumDays: 1;
  defaultDays: 7;
  maximumDays: 100;
  version: number;
}>;

type SettingRpcRow = {
  setting_key: unknown;
  integer_value: unknown;
  minimum_integer_value: unknown;
  default_integer_value: unknown;
  maximum_integer_value: unknown;
  version: unknown;
};

function isSafePositiveInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1
  );
}

export async function readExplorerSharedSnapshotSendabilitySetting(
  client: SupabaseClient,
): Promise<ExplorerSharedSnapshotSendabilitySetting> {
  try {
    const { data, error } = await client.rpc(
      "solmind_read_application_setting_integer",
      {
        p_setting_key: EXPLORER_SHARED_SNAPSHOT_SENDABILITY_DAYS_KEY,
      },
    );

    if (error !== null && error !== undefined) {
      throw new Error(APPLICATION_SETTING_READ_FAILED);
    }

    if (!Array.isArray(data) || data.length !== 1) {
      throw new Error(APPLICATION_SETTING_READ_FAILED);
    }

    const row = data[0] as SettingRpcRow;
    if (
      row.setting_key !== EXPLORER_SHARED_SNAPSHOT_SENDABILITY_DAYS_KEY ||
      row.minimum_integer_value !== 1 ||
      row.default_integer_value !== 7 ||
      row.maximum_integer_value !== 100 ||
      !isSafePositiveInteger(row.integer_value) ||
      row.integer_value > 100 ||
      !isSafePositiveInteger(row.version)
    ) {
      throw new Error(APPLICATION_SETTING_READ_FAILED);
    }

    return Object.freeze({
      key: EXPLORER_SHARED_SNAPSHOT_SENDABILITY_DAYS_KEY,
      days: row.integer_value,
      minimumDays: 1,
      defaultDays: 7,
      maximumDays: 100,
      version: row.version,
    });
  } catch {
    throw new Error(APPLICATION_SETTING_READ_FAILED);
  }
}
