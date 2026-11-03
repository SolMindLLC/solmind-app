// The minimal functional Admin screens (PRJ01_R-WS03-WI014; decision queue
// 2026-11-03 11:52:57, 11:56:14 and 12:19:09): the closed shapes shared by the
// server pages, the two Admin POST commands and the browser. Browser-safe and
// pure: no fetch, storage, environment or server import. The pages receive
// plain display data only (names, counts, Chicago-time strings, stop ids and
// setting versions), and never an account id. Activity is by sign-ins only;
// apart from the recorded hard-stop facts Paul approved as Admin review flags
// (2026-11-01 01:00:16: day, time reached, that day's total calls, the limit;
// 2026-11-01 12:27:07: crisis or urgent status at the stop), no Admin page
// shows conversation content, message dates or message counts. Paul may throw
// these screens away and replace them with a better design.

function freeze<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

// The six protected settings, in the order the Settings page shows them.
export const ADMIN_SETTING_KEYS = freeze([
  "explorer_ai_use_individual_daily_call_limit",
  "explorer_ai_use_shared_daily_calls_per_active_explorer",
  "explorer_ai_use_automatic_lifts_per_week",
  "explorer_ai_use_automatic_lifts_per_month",
  "explorer_shared_snapshot_sendability_days",
  "suggested_waypoint_send_grace_seconds",
] as const);

export type AdminSettingKey = (typeof ADMIN_SETTING_KEYS)[number];

export function isAdminSettingKey(value: unknown): value is AdminSettingKey {
  return typeof value === "string" && (ADMIN_SETTING_KEYS as readonly string[]).includes(value);
}

export const ADMIN_RELATIONSHIP_STATUSES = freeze([
  "invited", "intake_pending", "active", "paused", "ended", "transferred",
] as const);

export type AdminRelationshipStatus = (typeof ADMIN_RELATIONSHIP_STATUSES)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isAdminWorkspaceUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

// What each page draws. A page whose read failed after a successful sign-in
// check gets null and says so; it is not shown as a session end.
export type AdminOverviewView = Readonly<{
  guides: number;
  explorers: number;
  explorersSignedInLast7Days: number;
  accountsPausedNow: number;
}>;

// "Paused now" on the Guides and Explorers page is the AI-use gate's whole
// decision: own_limit (paused by the Explorer's own daily limit), shared (only
// today's shared pause for everyone applies) or none.
export const ADMIN_PEOPLE_PAUSES = freeze(["own_limit", "shared", "none"] as const);

export type AdminPeoplePause = (typeof ADMIN_PEOPLE_PAUSES)[number];

export type AdminPeopleExplorerView = Readonly<{
  name: string;
  relationshipStatus: AdminRelationshipStatus;
  lastSignIn: string | null;
  pausedNow: AdminPeoplePause;
}>;

export type AdminPeopleGuideView = Readonly<{
  name: string;
  explorers: readonly AdminPeopleExplorerView[];
}>;

// A row of "Paused now" on the AI use page: a recorded stop, which can be
// lifted, or a pause the AI-use gate applies by the Explorer's own limit that
// no stop records (for example after the limit was lowered), which has no
// stop, time or crisis status and cannot be lifted here. A Send is normally
// refused at the pause read before any stop is recorded (revised 2026-11-03
// after review REV219b), so that pause ends at midnight, Chicago time, or when
// the limit is raised above that Explorer's calls today.
export type AdminPauseView =
  | Readonly<{
      kind: "recorded";
      stopId: string;
      explorerName: string;
      stopDay: string;
      reachedAt: string;
      dayTotal: number;
      limit: number;
      inCrisisAtStop: boolean;
    }>
  | Readonly<{
      kind: "not_recorded";
      explorerName: string;
      stopDay: string;
      dayTotal: number;
      limit: number;
    }>;

export type AdminSharedStopView = Readonly<{
  stopDay: string;
  reachedAt: string;
  dayTotal: number;
  limit: number;
}>;

export type AdminAiUseView = Readonly<{
  pauses: readonly AdminPauseView[];
  sharedStop: AdminSharedStopView | null;
}>;

export type AdminSettingView = Readonly<{
  key: AdminSettingKey;
  value: number;
  minimum: number;
  defaultValue: number;
  maximum: number;
  version: number;
}>;

export type AdminWorkspaceView =
  | Readonly<{ page: "dashboard"; overview: AdminOverviewView | null }>
  | Readonly<{ page: "people"; guides: readonly AdminPeopleGuideView[] | null }>
  | Readonly<{ page: "aiUse"; aiUse: AdminAiUseView | null }>
  | Readonly<{ page: "settings"; settings: readonly AdminSettingView[] | null }>;

export type AdminWorkspacePageName = AdminWorkspaceView["page"];

// The two commands. The browser creates the operation id once per button
// press; the server adds the one fixed authority reference of these screens
// (Paul's decision queue entry for them), never an account id.
export type AdminLiftPauseBody = Readonly<{ stopId: string; operationId: string }>;

export type AdminChangeSettingBody = Readonly<{
  settingKey: AdminSettingKey;
  value: number;
  expectedVersion: number;
  operationId: string;
}>;

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

// The PostgreSQL integer range the setting writer accepts as an argument; the
// row's own range is checked by the database and answered as out_of_range.
export const ADMIN_SETTING_INTEGER_MAX = 2_147_483_647;

export function parseAdminLiftPauseBody(value: Readonly<Record<string, unknown>>): AdminLiftPauseBody | null {
  if (!hasExactKeys(value, ["stopId", "operationId"])) return null;
  if (!isAdminWorkspaceUuid(value.stopId) || !isAdminWorkspaceUuid(value.operationId)) return null;
  return freeze({ stopId: value.stopId, operationId: value.operationId });
}

export function parseAdminChangeSettingBody(value: Readonly<Record<string, unknown>>): AdminChangeSettingBody | null {
  if (!hasExactKeys(value, ["settingKey", "value", "expectedVersion", "operationId"])) return null;
  const { settingKey, value: settingValue, expectedVersion, operationId } = value;
  if (!isAdminSettingKey(settingKey) || !isAdminWorkspaceUuid(operationId)) return null;
  if (typeof settingValue !== "number" || !Number.isSafeInteger(settingValue) || Math.abs(settingValue) > ADMIN_SETTING_INTEGER_MAX) return null;
  if (typeof expectedVersion !== "number" || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) return null;
  return freeze({ settingKey, value: settingValue, expectedVersion, operationId });
}

// Value-free answers. denied: the Admin sign-in check refused the command;
// failed: the outcome is not known (nothing confirmed either way).
// lifted_elsewhere: the pause had already been lifted by another press or on
// Paul's word through another path, so this press changed nothing.
export const ADMIN_LIFT_PAUSE_OUTCOMES = freeze([
  "lifted", "already_lifted", "lifted_automatically", "lifted_elsewhere", "not_found", "conflict", "denied", "failed",
] as const);

export type AdminLiftPauseOutcome = (typeof ADMIN_LIFT_PAUSE_OUTCOMES)[number];

export const ADMIN_CHANGE_SETTING_OUTCOMES = freeze([
  "applied", "unchanged", "already_applied", "version_conflict", "out_of_range", "conflict", "denied", "failed",
] as const);

export type AdminChangeSettingOutcome = (typeof ADMIN_CHANGE_SETTING_OUTCOMES)[number];

export type AdminLiftPauseResult = Readonly<{ outcome: AdminLiftPauseOutcome }>;
export type AdminChangeSettingResult = Readonly<{ outcome: AdminChangeSettingOutcome }>;

export function adminCommandResult<T extends string>(outcome: T): Readonly<{ outcome: T }> {
  return freeze({ outcome });
}

// The browser's check of an answer body: exactly { outcome } with a known value.
export function parseAdminCommandAnswer<T extends string>(value: unknown, outcomes: readonly T[]): T | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!hasExactKeys(record, ["outcome"])) return null;
  const outcome = record.outcome;
  return typeof outcome === "string" && (outcomes as readonly string[]).includes(outcome) ? (outcome as T) : null;
}
