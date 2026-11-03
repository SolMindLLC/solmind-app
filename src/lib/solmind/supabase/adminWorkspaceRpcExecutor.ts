// Server-only closed executor for the minimal functional Admin screens
// (PRJ01_R-WS03-WI014; decision queue 2026-11-03 11:56:14 and 12:19:09).
//
// Exactly six fixed database functions: the four Admin reads of migration
// 20261103120000_admin_minimal_reads.sql, which recheck the actor as an active
// Admin, and the two existing service-role writers, reused unchanged. Every row
// is checked for its exact keys and types and returned as a frozen copy; every
// failure is one fixed value-free error or outcome, and no database message is
// passed on. Direct import only; off the shared supabase barrel.
//
// Both writers audit as a system change on Paul's word (actor null, role
// system): the lift with reason paul_approved_pause_lift, the setting change
// with basis paul_approved and reason paul_approved_configuration_change. Both
// get the one fixed authority reference below, never the Admin's account id
// (revised 2026-11-03 after review REV219: the banked audit contract makes the
// reference a non-descriptive id of an external approved checkpoint). Paul
// accepted the system-change audit for the throwaway minimal screens; the
// audit contract is not changed.

import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import {
  ADMIN_PEOPLE_PAUSES,
  ADMIN_RELATIONSHIP_STATUSES,
  ADMIN_SETTING_KEYS,
  isAdminSettingKey,
  isAdminWorkspaceUuid,
  type AdminChangeSettingOutcome,
  type AdminLiftPauseOutcome,
  type AdminPeoplePause,
  type AdminRelationshipStatus,
  type AdminSettingKey,
} from "../adminWorkspaceContract";

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: adminWorkspaceRpcExecutor must not be imported in browser code.",
  );
}

export const ADMIN_WORKSPACE_READ_FAILED = "solmind_admin_workspace_read_failed" as const;

// The authority reference both writers record for a Lift pause or a setting
// change made on these screens. It names Paul's decision queue entry
// 2026-11-03 11:56:14 CST (his go-ahead for the minimal Admin screens, a Lift
// pause recorded as Paul's lift, and the six settings changed through the
// existing audited function), as amended at 12:19:09. It is not an account id.
export const ADMIN_SCREENS_AUTHORITY_REFERENCE_ID = "569232b5-a117-4390-8273-a2e6922a69ef" as const;

export const ADMIN_WORKSPACE_FUNCTIONS = Object.freeze({
  overview: "solmind_read_admin_overview_v1",
  people: "solmind_read_admin_people_v1",
  pauses: "solmind_read_admin_ai_use_pauses_v1",
  settings: "solmind_read_admin_application_settings_v1",
  lift: "solmind_lift_explorer_ai_use_pause_v1",
  change: "solmind_set_application_setting_integer",
} as const);

export type AdminOverviewRow = Readonly<{
  guideCount: number;
  explorerCount: number;
  explorersSignedInLast7Days: number;
  accountsPausedNow: number;
}>;

export type AdminPeopleRow = Readonly<{
  guideProfileId: string;
  guideName: string;
  explorer: Readonly<{
    name: string;
    relationshipStatus: AdminRelationshipStatus;
    lastSignInAt: string | null;
    pause: AdminPeoplePause;
  }> | null;
}>;

// individual: a recorded stop; unrecorded: a pause the gate applies by the
// Explorer's own limit with no stop row (no stop id, reached time or crisis
// status; a Send is normally refused before any stop is recorded, so it ends at
// midnight, Chicago time, or when the limit is raised above that day's calls);
// shared: today's shared stop.
export type AdminPauseRow =
  | Readonly<{
      kind: "individual";
      stopId: string;
      explorerName: string;
      stopDay: string;
      reachedAt: string;
      dayTotal: number;
      limit: number;
      accountInCrisis: boolean;
    }>
  | Readonly<{ kind: "unrecorded"; explorerName: string; stopDay: string; dayTotal: number; limit: number }>
  | Readonly<{ kind: "shared"; stopId: string; stopDay: string; reachedAt: string; dayTotal: number; limit: number }>;

export type AdminSettingRow = Readonly<{
  key: AdminSettingKey;
  value: number;
  minimum: number;
  defaultValue: number;
  maximum: number;
  version: number;
}>;

export type AdminWorkspaceRpcExecutor = Readonly<{
  readOverview(actorUserAccountId: string): Promise<AdminOverviewRow>;
  readPeople(actorUserAccountId: string): Promise<readonly AdminPeopleRow[]>;
  readPauses(actorUserAccountId: string): Promise<readonly AdminPauseRow[]>;
  readSettings(actorUserAccountId: string): Promise<readonly AdminSettingRow[]>;
  liftPause(args: Readonly<{ stopId: string; operationId: string }>):
    Promise<Exclude<AdminLiftPauseOutcome, "denied">>;
  changeSetting(args: Readonly<{
    settingKey: AdminSettingKey;
    value: number;
    expectedVersion: number;
    operationId: string;
  }>): Promise<Exclude<AdminChangeSettingOutcome, "denied">>;
}>;

type Row = Record<string, unknown>;

function fail(): never {
  throw new Error(ADMIN_WORKSPACE_READ_FAILED);
}

function rows(data: unknown, keys: readonly string[]): Row[] {
  if (!Array.isArray(data)) fail();
  const sorted = [...keys].sort().join(",");
  return data.map((row: unknown) => {
    if (typeof row !== "object" || row === null || Array.isArray(row)) fail();
    if (Object.keys(row).sort().join(",") !== sorted) fail();
    return row as Row;
  });
}

function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) fail();
  return value;
}

function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) fail();
  return value;
}

function name(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 500) fail();
  return value;
}

function time(value: unknown): string {
  if (typeof value !== "string" || value.length > 64 || !Number.isFinite(Date.parse(value))) fail();
  return value;
}

function day(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail();
  return value;
}

function uuid(value: unknown): string {
  if (!isAdminWorkspaceUuid(value)) fail();
  return value;
}

function bool(value: unknown): boolean {
  if (typeof value !== "boolean") fail();
  return value;
}

function errorMessage(error: unknown): string | null {
  try {
    if (typeof error !== "object" || error === null || !("message" in error)) return null;
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : null;
  } catch {
    return null;
  }
}

function parseOverview(data: unknown): AdminOverviewRow {
  const list = rows(data, ["guide_count", "explorer_count", "explorers_signed_in_last_7_days", "accounts_paused_now"]);
  if (list.length !== 1) fail();
  const [row] = list;
  return Object.freeze({
    guideCount: count(row.guide_count),
    explorerCount: count(row.explorer_count),
    explorersSignedInLast7Days: count(row.explorers_signed_in_last_7_days),
    accountsPausedNow: count(row.accounts_paused_now),
  });
}

function parsePeople(data: unknown): readonly AdminPeopleRow[] {
  const list = rows(data, ["guide_profile_id", "guide_name", "explorer_name", "relationship_status",
    "explorer_last_sign_in_at", "explorer_pause"]);
  return Object.freeze(list.map((row) => {
    const guide = { guideProfileId: uuid(row.guide_profile_id), guideName: name(row.guide_name) };
    if (row.explorer_name === null) {
      if (row.relationship_status !== null || row.explorer_last_sign_in_at !== null || row.explorer_pause !== null) fail();
      return Object.freeze({ ...guide, explorer: null });
    }
    const status = row.relationship_status;
    if (typeof status !== "string" || !(ADMIN_RELATIONSHIP_STATUSES as readonly string[]).includes(status)) fail();
    const pause = row.explorer_pause;
    if (typeof pause !== "string" || !(ADMIN_PEOPLE_PAUSES as readonly string[]).includes(pause)) fail();
    return Object.freeze({
      ...guide,
      explorer: Object.freeze({
        name: name(row.explorer_name),
        relationshipStatus: status as AdminRelationshipStatus,
        lastSignInAt: row.explorer_last_sign_in_at === null ? null : time(row.explorer_last_sign_in_at),
        pause: pause as AdminPeoplePause,
      }),
    });
  }));
}

function parsePauses(data: unknown): readonly AdminPauseRow[] {
  const list = rows(data, ["stop_id", "stop_kind", "explorer_name", "stop_day", "reached_at", "day_total",
    "limit_value", "account_in_crisis"]);
  let shared = 0;
  const parsed = list.map((row): AdminPauseRow => {
    // A pause no stop records yet: exactly no stop id, no reached time and no
    // crisis status, with a name, today's day, a count and the limit.
    if (row.stop_kind === "individual_unrecorded") {
      if (row.stop_id !== null || row.reached_at !== null || row.account_in_crisis !== null) fail();
      return Object.freeze({
        kind: "unrecorded" as const,
        explorerName: name(row.explorer_name),
        stopDay: day(row.stop_day),
        dayTotal: count(row.day_total),
        limit: count(row.limit_value),
      });
    }
    const common = {
      stopId: uuid(row.stop_id),
      stopDay: day(row.stop_day),
      reachedAt: time(row.reached_at),
      dayTotal: count(row.day_total),
      limit: count(row.limit_value),
    };
    if (row.stop_kind === "shared") {
      if (row.explorer_name !== null || row.account_in_crisis !== null) fail();
      shared += 1;
      return Object.freeze({ kind: "shared" as const, ...common });
    }
    if (row.stop_kind !== "individual") fail();
    return Object.freeze({
      kind: "individual" as const, ...common, explorerName: name(row.explorer_name), accountInCrisis: bool(row.account_in_crisis),
    });
  });
  if (shared > 1) fail();
  return Object.freeze(parsed);
}

function parseSettings(data: unknown): readonly AdminSettingRow[] {
  const list = rows(data, ["setting_key", "integer_value", "minimum_integer_value", "default_integer_value",
    "maximum_integer_value", "version"]);
  if (list.length !== ADMIN_SETTING_KEYS.length) fail();
  const parsed = list.map((row) => {
    if (!isAdminSettingKey(row.setting_key)) fail();
    const setting = Object.freeze({
      key: row.setting_key,
      value: integer(row.integer_value),
      minimum: integer(row.minimum_integer_value),
      defaultValue: integer(row.default_integer_value),
      maximum: integer(row.maximum_integer_value),
      version: integer(row.version),
    });
    if (setting.version < 1 || setting.minimum > setting.maximum || setting.value < setting.minimum ||
        setting.value > setting.maximum || setting.defaultValue < setting.minimum || setting.defaultValue > setting.maximum) fail();
    return setting;
  });
  if (new Set(parsed.map((setting) => setting.key)).size !== ADMIN_SETTING_KEYS.length) fail();
  // The Settings page's own order.
  return Object.freeze(ADMIN_SETTING_KEYS.map((key) => parsed.find((setting) => setting.key === key) ?? fail()));
}

function liftOutcome(data: unknown, error: unknown): Exclude<AdminLiftPauseOutcome, "denied"> {
  if (error !== null && error !== undefined) {
    const message = errorMessage(error);
    if (message === "solmind_explorer_ai_use_not_found") return "not_found";
    // Each press sends a fresh operation id, so the writer's operation conflict
    // means the stop was already lifted under another operation (another tab,
    // or on Paul's word through another path): nothing was changed.
    if (message === "solmind_explorer_ai_use_operation_conflict") return "lifted_elsewhere";
    if (message === "solmind_explorer_ai_use_lock_unavailable") return "conflict";
    return "failed";
  }
  try {
    const list = rows(data, ["outcome"]);
    const outcome = list.length === 1 ? list[0].outcome : null;
    return outcome === "lifted" || outcome === "already_lifted" || outcome === "lifted_automatically" ? outcome : "failed";
  } catch {
    return "failed";
  }
}

function changeOutcome(data: unknown, error: unknown, settingKey: AdminSettingKey): Exclude<AdminChangeSettingOutcome, "denied"> {
  if (error !== null && error !== undefined) {
    const message = errorMessage(error);
    if (message === "solmind_application_setting_version_conflict") return "version_conflict";
    if (message === "solmind_application_setting_invalid_value") return "out_of_range";
    if (message === "solmind_application_setting_operation_conflict" || message === "solmind_application_setting_lock_unavailable") {
      return "conflict";
    }
    return "failed";
  }
  try {
    const list = rows(data, ["outcome", "setting_key", "integer_value", "version"]);
    if (list.length !== 1 || list[0].setting_key !== settingKey) return "failed";
    integer(list[0].integer_value);
    integer(list[0].version);
    const outcome = list[0].outcome;
    return outcome === "applied" || outcome === "unchanged" || outcome === "already_applied" ? outcome : "failed";
  } catch {
    return "failed";
  }
}

export function createAdminWorkspaceRpcExecutor(client: SupabaseClient): AdminWorkspaceRpcExecutor {
  async function read<T>(functionName: string, actorUserAccountId: string, parse: (data: unknown) => T): Promise<T> {
    try {
      if (!isAdminWorkspaceUuid(actorUserAccountId)) fail();
      const { data, error } = await client.rpc(functionName, { p_actor_user_account_id: actorUserAccountId });
      if (error !== null && error !== undefined) fail();
      return parse(data);
    } catch {
      throw new Error(ADMIN_WORKSPACE_READ_FAILED);
    }
  }

  return Object.freeze({
    readOverview: (actor: string) => read(ADMIN_WORKSPACE_FUNCTIONS.overview, actor, parseOverview),
    readPeople: (actor: string) => read(ADMIN_WORKSPACE_FUNCTIONS.people, actor, parsePeople),
    readPauses: (actor: string) => read(ADMIN_WORKSPACE_FUNCTIONS.pauses, actor, parsePauses),
    readSettings: (actor: string) => read(ADMIN_WORKSPACE_FUNCTIONS.settings, actor, parseSettings),
    async liftPause({ stopId, operationId }) {
      if (![stopId, operationId].every(isAdminWorkspaceUuid)) return "failed";
      try {
        const { data, error } = await client.rpc(ADMIN_WORKSPACE_FUNCTIONS.lift, {
          p_stop_id: stopId,
          p_authority_reference_id: ADMIN_SCREENS_AUTHORITY_REFERENCE_ID,
          p_operation_id: operationId,
        });
        return liftOutcome(data, error);
      } catch {
        return "failed";
      }
    },
    async changeSetting({ settingKey, value, expectedVersion, operationId }) {
      if (!isAdminWorkspaceUuid(operationId) || !isAdminSettingKey(settingKey) ||
          !Number.isSafeInteger(value) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) return "failed";
      try {
        const { data, error } = await client.rpc(ADMIN_WORKSPACE_FUNCTIONS.change, {
          p_setting_key: settingKey,
          p_integer_value: value,
          p_expected_version: expectedVersion,
          p_operation_id: operationId,
          p_authority_basis: "paul_approved",
          p_authority_reference_id: ADMIN_SCREENS_AUTHORITY_REFERENCE_ID,
          p_reason_code: "paul_approved_configuration_change",
        });
        return changeOutcome(data, error, settingKey);
      } catch {
        return "failed";
      }
    },
  });
}
