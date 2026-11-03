import { describe, expect, it, vi } from "vitest";

import {
  changeAdminSetting,
  liftAdminPause,
  resolveAdminAiUseAccess,
  resolveAdminDashboardAccess,
  resolveAdminPeopleAccess,
  resolveAdminSettingsAccess,
  type AdminWorkspaceAccessArgs,
} from "../adminWorkspaceAccess";
import { createInMemoryRequestAuthPrincipalSource } from "../requestAuthPrincipalSource";
import { createInMemoryRequestCookieAccessor } from "../requestCookieAccessor";
import { type AuthRlsAuditEventWriter, type PersistableAuthRlsAuditEvent } from "../auditEventWriter";
import { createAdminAuthSourceFromExecutor } from "../../supabase/adminAuthSource";
import { type AdminWorkspaceRpcExecutor } from "../../supabase/adminWorkspaceRpcExecutor";
import { type SupabaseQueryResult } from "../../supabase/supabaseAuthQueryClient";
import { SOLMIND_ROLES, type SolMindRole } from "../../roles";

// The minimal Admin screens' composition (decision queue 2026-11-03 11:56:14): the real audited guard over
// in-memory ports, then a fake closed executor. Proves guard-then-read in one call, the actor staying
// server-side, read failures not shown as a session end, and the writes receiving no account id.
const NOW = "2026-11-03T18:00:00.000Z";
const END = "2026-11-03T19:00:00.000Z";
const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const PROVIDER = "22222222-2222-4222-8222-222222222222";
const SESSION = "33333333-3333-4333-8333-333333333333";
const STOP = "44444444-4444-4444-8444-444444444444";
const OP = "55555555-5555-4555-8555-555555555555";

function tables(role: SolMindRole): Record<string, SupabaseQueryResult> {
  return {
    auth_provider_identity: { data: [{ user_account_id: ACCOUNT, provider_name: "supabase", provider_user_id: PROVIDER, status: "active" }], error: null },
    user_account: { data: [{ user_account_id: ACCOUNT, account_status: "active" }], error: null },
    user_session: { data: [{ user_session_id: SESSION, user_account_id: ACCOUNT, active_role_context: role, session_status: "active", expires_at: END }], error: null },
    user_role_assignment: { data: [{ user_account_id: ACCOUNT, role_code: role, role_status: "active" }], error: null },
    guide_profile: { data: [], error: null },
    explorer_profile: { data: [], error: null },
  };
}

function fakeExecutor(overrides: Partial<AdminWorkspaceRpcExecutor> = {}) {
  const calls: string[] = [];
  const executor: AdminWorkspaceRpcExecutor = {
    readOverview: vi.fn(async (actor: string) => { calls.push(`overview:${actor}`); return { guideCount: 1, explorerCount: 2, explorersSignedInLast7Days: 1, accountsPausedNow: 1 }; }),
    readPeople: vi.fn(async (actor: string) => { calls.push(`people:${actor}`); return [
      { guideProfileId: STOP, guideName: "Synthetic Guide", explorer: { name: "Synthetic Explorer", relationshipStatus: "active" as const, lastSignInAt: "2026-11-02T17:05:00+00:00", pause: "own_limit" as const } },
      { guideProfileId: STOP, guideName: "Synthetic Guide", explorer: { name: "Synthetic Second", relationshipStatus: "paused" as const, lastSignInAt: null, pause: "shared" as const } },
      { guideProfileId: STOP, guideName: "Synthetic Guide", explorer: { name: "Synthetic Third", relationshipStatus: "active" as const, lastSignInAt: null, pause: "none" as const } },
      { guideProfileId: OP, guideName: "Synthetic Lone Guide", explorer: null },
    ]; }),
    readPauses: vi.fn(async () => [
      { kind: "individual" as const, stopId: STOP, explorerName: "Synthetic Explorer", stopDay: "2026-11-03", reachedAt: "2026-11-03T16:00:00+00:00", dayTotal: 500, limit: 500, accountInCrisis: true },
      { kind: "unrecorded" as const, explorerName: "Synthetic Lowered", stopDay: "2026-11-03", dayTotal: 30, limit: 20 },
      { kind: "shared" as const, stopId: OP, stopDay: "2026-11-03", reachedAt: "2026-11-03T17:30:00+00:00", dayTotal: 1200, limit: 1200 },
    ]),
    readSettings: vi.fn(async () => []),
    liftPause: vi.fn(async () => "lifted" as const),
    changeSetting: vi.fn(async () => "applied" as const),
    ...overrides,
  };
  return { executor, calls };
}

function args(role: SolMindRole, executor: AdminWorkspaceRpcExecutor, events: PersistableAuthRlsAuditEvent[] = []): AdminWorkspaceAccessArgs {
  const rows = tables(role);
  const writer: AuthRlsAuditEventWriter = { async persistAuthRlsAuditEvent(event) { events.push(event); return { persisted: true, auditEventId: `s-${events.length}` }; } };
  return {
    cookies: createInMemoryRequestCookieAccessor(),
    now: () => new Date(NOW),
    requestDependencies: {
      createPrincipalSource: () => createInMemoryRequestAuthPrincipalSource({ providerName: "supabase", providerUserId: PROVIDER, presentedSessionId: SESSION }),
      createAuthSource: ({ now }) => createAdminAuthSourceFromExecutor({ executor: { select: async (spec: { table: string }) => rows[spec.table] ?? { data: [], error: null } }, now }),
      createAuditEventWriter: () => writer,
    },
    createExecutor: () => executor,
  };
}

describe("Admin workspace access composition", () => {
  it("guards, then reads the Dashboard with the server-derived actor, returning only times and display data", async () => {
    const fake = fakeExecutor();
    const events: PersistableAuthRlsAuditEvent[] = [];
    const result = await resolveAdminDashboardAccess(args(SOLMIND_ROLES.ADMIN, fake.executor, events));
    expect(result).toEqual({ allowed: true, expiresAt: END, observedAt: NOW,
      view: { page: "dashboard", overview: { guides: 1, explorers: 2, explorersSignedInLast7Days: 1, accountsPausedNow: 1 } } });
    expect(fake.calls).toEqual([`overview:${ACCOUNT}`]);
    expect(events).toHaveLength(2);
    expect(JSON.stringify(result).includes(ACCOUNT)).toBe(false);
  });

  it("groups people by Guide with Chicago-time sign-ins and no ids", async () => {
    const result = await resolveAdminPeopleAccess(args(SOLMIND_ROLES.ADMIN, fakeExecutor().executor));
    expect(result.allowed && result.view).toEqual({ page: "people", guides: [
      { name: "Synthetic Guide", explorers: [
        { name: "Synthetic Explorer", relationshipStatus: "active", lastSignIn: "Nov 2, 2026, 11:05 AM CST", pausedNow: "own_limit" },
        { name: "Synthetic Second", relationshipStatus: "paused", lastSignIn: null, pausedNow: "shared" },
        { name: "Synthetic Third", relationshipStatus: "active", lastSignIn: null, pausedNow: "none" }] },
      { name: "Synthetic Lone Guide", explorers: [] }] });
    expect(JSON.stringify(result).includes(STOP) || JSON.stringify(result).includes(OP)).toBe(false);
  });

  it("projects recorded pauses, a pause not recorded yet and today's shared stop in Chicago time", async () => {
    const result = await resolveAdminAiUseAccess(args(SOLMIND_ROLES.ADMIN, fakeExecutor().executor));
    expect(result.allowed && result.view).toEqual({ page: "aiUse", aiUse: {
      pauses: [
        { kind: "recorded", stopId: STOP, explorerName: "Synthetic Explorer", stopDay: "Nov 3, 2026", reachedAt: "Nov 3, 2026, 10:00 AM CST", dayTotal: 500, limit: 500, inCrisisAtStop: true },
        { kind: "not_recorded", explorerName: "Synthetic Lowered", stopDay: "Nov 3, 2026", dayTotal: 30, limit: 20 }],
      sharedStop: { stopDay: "Nov 3, 2026", reachedAt: "Nov 3, 2026, 11:30 AM CST", dayTotal: 1200, limit: 1200 } } });
  });

  it("shows a failed read as the page with no data, not as a session end", async () => {
    const fake = fakeExecutor({ readSettings: vi.fn(async () => { throw new Error("private_detail"); }) });
    const result = await resolveAdminSettingsAccess(args(SOLMIND_ROLES.ADMIN, fake.executor));
    expect(result).toEqual({ allowed: true, expiresAt: END, observedAt: NOW, view: { page: "settings", settings: null } });
    const broken = await resolveAdminSettingsAccess({ ...args(SOLMIND_ROLES.ADMIN, fake.executor), createExecutor: () => { throw new Error("no_env"); } });
    expect(broken.allowed && broken.view).toEqual({ page: "settings", settings: null });
  });

  it("denies a Guide before any database call", async () => {
    const fake = fakeExecutor();
    for (const resolve of [resolveAdminDashboardAccess, resolveAdminPeopleAccess, resolveAdminAiUseAccess, resolveAdminSettingsAccess]) {
      expect(await resolve(args(SOLMIND_ROLES.GUIDE, fake.executor))).toEqual({ allowed: false, reason: "route_access_denied" });
    }
    expect(await liftAdminPause({ ...args(SOLMIND_ROLES.GUIDE, fake.executor), body: { stopId: STOP, operationId: OP } })).toEqual({ outcome: "denied" });
    expect(await changeAdminSetting({ ...args(SOLMIND_ROLES.GUIDE, fake.executor),
      body: { settingKey: "explorer_shared_snapshot_sendability_days", value: 8, expectedVersion: 1, operationId: OP } })).toEqual({ outcome: "denied" });
    for (const method of Object.values(fake.executor)) expect(method).not.toHaveBeenCalled();
  });

  it("runs the writers after the Admin guard without sending the Admin's account id", async () => {
    const fake = fakeExecutor();
    expect(await liftAdminPause({ ...args(SOLMIND_ROLES.ADMIN, fake.executor), body: { stopId: STOP, operationId: OP } })).toEqual({ outcome: "lifted" });
    expect(vi.mocked(fake.executor.liftPause).mock.calls).toEqual([[{ stopId: STOP, operationId: OP }]]);
    const body = { settingKey: "explorer_shared_snapshot_sendability_days" as const, value: 8, expectedVersion: 4, operationId: OP };
    expect(await changeAdminSetting({ ...args(SOLMIND_ROLES.ADMIN, fake.executor), body })).toEqual({ outcome: "applied" });
    expect(vi.mocked(fake.executor.changeSetting).mock.calls).toEqual([[body]]);
    expect(JSON.stringify([vi.mocked(fake.executor.liftPause).mock.calls, vi.mocked(fake.executor.changeSetting).mock.calls])
      .includes(ACCOUNT)).toBe(false);
    const failing = fakeExecutor({ liftPause: vi.fn(async () => { throw new Error("private_detail"); }) });
    expect(await liftAdminPause({ ...args(SOLMIND_ROLES.ADMIN, failing.executor), body: { stopId: STOP, operationId: OP } })).toEqual({ outcome: "failed" });
  });
});
