import { type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  ADMIN_SCREENS_AUTHORITY_REFERENCE_ID,
  ADMIN_WORKSPACE_FUNCTIONS,
  ADMIN_WORKSPACE_READ_FAILED,
  createAdminWorkspaceRpcExecutor,
} from "../adminWorkspaceRpcExecutor";

// Contract of the closed Admin executor (minimal Admin screens, decision queue 2026-11-03 11:56:14): fixed
// function names and arguments, strict rows, value-free failures. A fake rpc only; no database.
const ACTOR = "aaaaaaaa-0000-4000-8000-000000000001";
const STOP = "bbbbbbbb-0000-4000-8000-000000000002";
const OP = "cccccccc-0000-4000-8000-000000000003";
const GUIDE = "dddddddd-0000-4000-8000-000000000004";

function client(answer: { data?: unknown; error?: unknown } | (() => never)) {
  const rpc = vi.fn(async () => (typeof answer === "function" ? answer() : { data: answer.data ?? null, error: answer.error ?? null }));
  return { rpc, executor: createAdminWorkspaceRpcExecutor({ rpc } as unknown as SupabaseClient) };
}

const SETTINGS = [
  ["explorer_ai_use_automatic_lifts_per_month", 2, 0, 2, 30, 1],
  ["explorer_ai_use_automatic_lifts_per_week", 1, 0, 1, 7, 1],
  ["explorer_ai_use_individual_daily_call_limit", 500, 1, 500, 2000, 3],
  ["explorer_ai_use_shared_daily_calls_per_active_explorer", 300, 1, 300, 2000, 1],
  ["explorer_shared_snapshot_sendability_days", 7, 1, 7, 100, 1],
  ["suggested_waypoint_send_grace_seconds", 300, 60, 300, 3600, 1],
].map(([setting_key, integer_value, minimum_integer_value, default_integer_value, maximum_integer_value, version]) =>
  ({ setting_key, integer_value, minimum_integer_value, default_integer_value, maximum_integer_value, version }));

const PERSON = {
  guide_profile_id: GUIDE, guide_name: "Synthetic Guide", explorer_name: "Synthetic Explorer", relationship_status: "active",
  explorer_last_sign_in_at: "2026-11-02T17:05:00+00:00", explorer_pause: "none",
};
const PAUSE = {
  stop_id: STOP, stop_kind: "individual", explorer_name: "Synthetic Explorer", stop_day: "2026-11-03",
  reached_at: "2026-11-03T16:00:00.123+00:00", day_total: 500, limit_value: 500, account_in_crisis: true,
};
// A pause the gate applies by the Explorer's own limit that no stop records yet.
const UNRECORDED = {
  stop_id: null, stop_kind: "individual_unrecorded", explorer_name: "Synthetic Lowered", stop_day: "2026-11-03",
  reached_at: null, day_total: 30, limit_value: 20, account_in_crisis: null,
};
const OVERVIEW = { guide_count: 2, explorer_count: 3, explorers_signed_in_last_7_days: 1, accounts_paused_now: 0 };

describe("closed Admin workspace executor", () => {
  it("reads each Admin function by its fixed name with only the actor", async () => {
    const overview = client({ data: [OVERVIEW] });
    expect(await overview.executor.readOverview(ACTOR)).toEqual({ guideCount: 2, explorerCount: 3, explorersSignedInLast7Days: 1, accountsPausedNow: 0 });
    expect(overview.rpc.mock.calls).toEqual([[ADMIN_WORKSPACE_FUNCTIONS.overview, { p_actor_user_account_id: ACTOR }]]);
    expect(ADMIN_WORKSPACE_FUNCTIONS).toEqual({
      overview: "solmind_read_admin_overview_v1", people: "solmind_read_admin_people_v1", pauses: "solmind_read_admin_ai_use_pauses_v1",
      settings: "solmind_read_admin_application_settings_v1", lift: "solmind_lift_explorer_ai_use_pause_v1",
      change: "solmind_set_application_setting_integer",
    });
    // Each read calls only its own function: a fake that answers only the expected name proves no swap.
    const answers: Record<string, unknown> = {
      [ADMIN_WORKSPACE_FUNCTIONS.overview]: [OVERVIEW],
      [ADMIN_WORKSPACE_FUNCTIONS.people]: [PERSON],
      [ADMIN_WORKSPACE_FUNCTIONS.pauses]: [PAUSE],
      [ADMIN_WORKSPACE_FUNCTIONS.settings]: SETTINGS,
    };
    const reads = [
      ["readOverview", ADMIN_WORKSPACE_FUNCTIONS.overview],
      ["readPeople", ADMIN_WORKSPACE_FUNCTIONS.people],
      ["readPauses", ADMIN_WORKSPACE_FUNCTIONS.pauses],
      ["readSettings", ADMIN_WORKSPACE_FUNCTIONS.settings],
    ] as const;
    for (const [method, functionName] of reads) {
      const rpc = vi.fn(async (called: string) => ({ data: called === functionName ? answers[called] : [], error: null }));
      const executor = createAdminWorkspaceRpcExecutor({ rpc } as unknown as SupabaseClient);
      await expect(executor[method](ACTOR), method).resolves.toBeDefined();
      expect(rpc.mock.calls, method).toEqual([[functionName, { p_actor_user_account_id: ACTOR }]]);
    }
  });

  it("checks people rows exactly, including a Guide with no Explorers", async () => {
    const empty = { ...PERSON, explorer_name: null, relationship_status: null, explorer_last_sign_in_at: null, explorer_pause: null };
    const people = client({ data: [PERSON, { ...PERSON, explorer_pause: "own_limit" }, { ...PERSON, explorer_pause: "shared" }, empty] });
    const rows = await people.executor.readPeople(ACTOR);
    expect(people.rpc.mock.calls).toEqual([[ADMIN_WORKSPACE_FUNCTIONS.people, { p_actor_user_account_id: ACTOR }]]);
    expect(rows[0]).toEqual({ guideProfileId: GUIDE, guideName: "Synthetic Guide", explorer: {
      name: "Synthetic Explorer", relationshipStatus: "active", lastSignInAt: "2026-11-02T17:05:00+00:00", pause: "none" } });
    expect(rows.slice(0, 3).map((row) => row.explorer?.pause)).toEqual(["none", "own_limit", "shared"]);
    expect(rows[3].explorer).toBeNull();
    expect(Object.isFrozen(rows) && Object.isFrozen(rows[0]) && Object.isFrozen(rows[0].explorer)).toBe(true);
    for (const bad of [{ ...PERSON, message_count: 1 }, { ...PERSON, relationship_status: "unknown" },
      { ...PERSON, explorer_pause: true }, { ...PERSON, explorer_pause: "paused" }, { ...PERSON, explorer_pause: null },
      { ...empty, explorer_pause: "none" }, { ...PERSON, guide_profile_id: "x" },
      { ...PERSON, explorer_pause: undefined, explorer_paused_now: false }]) {
      await expect(client({ data: [bad] }).executor.readPeople(ACTOR)).rejects.toThrow(ADMIN_WORKSPACE_READ_FAILED);
    }
  });

  it("checks pause rows: individual with a name and crisis status, unrecorded without a stop, time or crisis, at most one shared stop", async () => {
    const shared = { ...PAUSE, stop_id: OP, stop_kind: "shared", explorer_name: null, account_in_crisis: null, day_total: 900, limit_value: 900 };
    const pauses = client({ data: [PAUSE, UNRECORDED, shared] });
    const rows = await pauses.executor.readPauses(ACTOR);
    expect(pauses.rpc.mock.calls).toEqual([[ADMIN_WORKSPACE_FUNCTIONS.pauses, { p_actor_user_account_id: ACTOR }]]);
    expect(rows.map((row) => row.kind)).toEqual(["individual", "unrecorded", "shared"]);
    expect(rows[1]).toEqual({ kind: "unrecorded", explorerName: "Synthetic Lowered", stopDay: "2026-11-03", dayTotal: 30, limit: 20 });
    for (const bad of [[{ ...PAUSE, explorer_name: null }], [{ ...shared, explorer_name: "x" }], [shared, shared],
      [{ ...PAUSE, stop_day: "2026-11-3" }], [{ ...PAUSE, conversation_id: STOP }],
      [{ ...UNRECORDED, stop_id: STOP }], [{ ...UNRECORDED, reached_at: "2026-11-03T16:00:00+00:00" }],
      [{ ...UNRECORDED, account_in_crisis: false }], [{ ...UNRECORDED, explorer_name: null }],
      [{ ...UNRECORDED, day_total: null }], [{ ...PAUSE, stop_id: null }], [{ ...UNRECORDED, stop_kind: "other" }]]) {
      await expect(client({ data: bad }).executor.readPauses(ACTOR)).rejects.toThrow(ADMIN_WORKSPACE_READ_FAILED);
    }
  });

  it("returns the six settings in the page's order and refuses anything else", async () => {
    const settings = client({ data: SETTINGS });
    const rows = await settings.executor.readSettings(ACTOR);
    expect(settings.rpc.mock.calls).toEqual([[ADMIN_WORKSPACE_FUNCTIONS.settings, { p_actor_user_account_id: ACTOR }]]);
    expect(rows.map((row) => row.key)).toEqual([
      "explorer_ai_use_individual_daily_call_limit", "explorer_ai_use_shared_daily_calls_per_active_explorer",
      "explorer_ai_use_automatic_lifts_per_week", "explorer_ai_use_automatic_lifts_per_month",
      "explorer_shared_snapshot_sendability_days", "suggested_waypoint_send_grace_seconds"]);
    expect(rows[0]).toEqual({ key: "explorer_ai_use_individual_daily_call_limit", value: 500, minimum: 1, defaultValue: 500, maximum: 2000, version: 3 });
    for (const bad of [SETTINGS.slice(1), [...SETTINGS.slice(1), SETTINGS[1]], [{ ...SETTINGS[0], integer_value: 31 }, ...SETTINGS.slice(1)],
      [{ ...SETTINGS[0], setting_key: "other" }, ...SETTINGS.slice(1)]]) {
      await expect(client({ data: bad }).executor.readSettings(ACTOR)).rejects.toThrow(ADMIN_WORKSPACE_READ_FAILED);
    }
  });

  it("turns every read failure into one value-free error", async () => {
    for (const answer of [{ error: { message: "solmind_admin_required" } }, { data: [] }, { data: null },
      () => { throw new Error("private_detail"); }]) {
      const error = await client(answer).executor.readOverview(ACTOR).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(ADMIN_WORKSPACE_READ_FAILED);
    }
    const bad = client({ data: [] });
    await expect(bad.executor.readOverview("not-a-uuid")).rejects.toThrow(ADMIN_WORKSPACE_READ_FAILED);
    expect(bad.rpc).not.toHaveBeenCalled();
  });

  it("lifts with the one fixed authority reference, never an account id, and maps the closed outcomes", async () => {
    expect(ADMIN_SCREENS_AUTHORITY_REFERENCE_ID).toBe("569232b5-a117-4390-8273-a2e6922a69ef");
    const lift = client({ data: [{ outcome: "lifted" }] });
    expect(await lift.executor.liftPause({ stopId: STOP, operationId: OP })).toBe("lifted");
    expect(lift.rpc.mock.calls).toEqual([["solmind_lift_explorer_ai_use_pause_v1",
      { p_stop_id: STOP, p_authority_reference_id: "569232b5-a117-4390-8273-a2e6922a69ef", p_operation_id: OP }]]);
    // An actor id slipped in by a caller is never sent.
    await lift.executor.liftPause({ stopId: STOP, operationId: OP, actorUserAccountId: ACTOR } as unknown as { stopId: string; operationId: string });
    expect(JSON.stringify(lift.rpc.mock.calls).includes(ACTOR)).toBe(false);
    const cases: [ReturnType<typeof client>, string][] = [
      [client({ data: [{ outcome: "already_lifted" }] }), "already_lifted"],
      [client({ data: [{ outcome: "lifted_automatically" }] }), "lifted_automatically"],
      [client({ data: [{ outcome: "other" }] }), "failed"],
      [client({ error: { message: "solmind_explorer_ai_use_not_found" } }), "not_found"],
      // A fresh operation id per press: the writer's operation conflict means the stop was already lifted elsewhere.
      [client({ error: { message: "solmind_explorer_ai_use_operation_conflict" } }), "lifted_elsewhere"],
      [client({ error: { message: "solmind_explorer_ai_use_lock_unavailable" } }), "conflict"],
      [client({ error: { message: "anything else" } }), "failed"],
      [client(() => { throw new Error("private_detail"); }), "failed"],
    ];
    for (const [fake, outcome] of cases) {
      expect(await fake.executor.liftPause({ stopId: STOP, operationId: OP })).toBe(outcome);
    }
  });

  it("changes one setting through the existing writer with basis paul_approved and the fixed reference, and maps the closed outcomes", async () => {
    const ok = { outcome: "applied", setting_key: "explorer_shared_snapshot_sendability_days", integer_value: 8, version: 2 };
    const change = client({ data: [ok] });
    const args = { settingKey: "explorer_shared_snapshot_sendability_days" as const, value: 8, expectedVersion: 1, operationId: OP };
    expect(await change.executor.changeSetting(args)).toBe("applied");
    expect(change.rpc.mock.calls).toEqual([["solmind_set_application_setting_integer", {
      p_setting_key: "explorer_shared_snapshot_sendability_days", p_integer_value: 8, p_expected_version: 1, p_operation_id: OP,
      p_authority_basis: "paul_approved", p_authority_reference_id: "569232b5-a117-4390-8273-a2e6922a69ef",
      p_reason_code: "paul_approved_configuration_change" }]]);
    await change.executor.changeSetting({ ...args, actorUserAccountId: ACTOR } as unknown as typeof args);
    expect(JSON.stringify(change.rpc.mock.calls).includes(ACTOR)).toBe(false);
    const cases: [ReturnType<typeof client>, string][] = [
      [client({ data: [{ ...ok, outcome: "unchanged" }] }), "unchanged"],
      [client({ data: [{ ...ok, outcome: "already_applied" }] }), "already_applied"],
      [client({ data: [{ ...ok, setting_key: "suggested_waypoint_send_grace_seconds" }] }), "failed"],
      [client({ error: { message: "solmind_application_setting_version_conflict" } }), "version_conflict"],
      [client({ error: { message: "solmind_application_setting_invalid_value" } }), "out_of_range"],
      [client({ error: { message: "solmind_application_setting_lock_unavailable" } }), "conflict"],
      [client({ error: { message: "solmind_application_setting_not_allowed" } }), "failed"],
    ];
    for (const [fake, outcome] of cases) expect(await fake.executor.changeSetting(args)).toBe(outcome);
    const refused = client({ data: [ok] });
    expect(await refused.executor.changeSetting({ ...args, expectedVersion: 0 })).toBe("failed");
    expect(refused.rpc).not.toHaveBeenCalled();
  });
});
