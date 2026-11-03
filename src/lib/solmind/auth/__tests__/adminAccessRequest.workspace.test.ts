import { describe, expect, it, vi } from "vitest";

import {
  resolveAdminAccessForRequest,
  resolveAdminActorForRequest,
  resolveAdminHomeForRequest,
  resolveAdminWorkspaceForRequest,
  type AdminAccessRequestDependencies,
} from "../adminAccessRequest";
import {
  resolveAdminAiUseRouteAccess,
  resolveAdminChangeSettingRouteAccess,
  resolveAdminHomeRouteAccess,
  resolveAdminLiftPauseRouteAccess,
  resolveAdminPeopleRouteAccess,
  resolveAdminSettingsRouteAccess,
} from "../adminRouteAccess";
import { createInMemoryRequestAuthPrincipalSource } from "../requestAuthPrincipalSource";
import { createInMemoryRequestCookieAccessor } from "../requestCookieAccessor";
import { AUTH_RLS_AUDIT_EVENT_TYPES } from "../authRlsAuditEvent";
import { AUTH_RLS_AUDIT_ACTIONS, type AuthRlsAuditEventWriter, type PersistableAuthRlsAuditEvent } from "../auditEventWriter";
import { type SupabaseAuthenticatedUser } from "../serverAuthContext";
import { createAdminAuthSourceFromExecutor } from "../../supabase/adminAuthSource";
import { AUDIT_WRITE_FAILED_ERROR } from "../../supabase/auditEventWriteExecutor";
import { type SupabaseQueryResult } from "../../supabase/supabaseAuthQueryClient";
import {
  ADMIN_AI_USE_ROUTE,
  ADMIN_CHANGE_SETTING_ROUTE,
  ADMIN_HOME_ROUTE,
  ADMIN_LIFT_PAUSE_ROUTE,
  ADMIN_PEOPLE_ROUTE,
  ADMIN_SETTINGS_ROUTE,
  SOLMIND_ROUTE_ACCESS_RULES,
} from "../../routeAccess";
import { SOLMIND_ROLES, type SolMindRole } from "../../roles";

// The minimal Admin screens' guard (decision queue 2026-11-03 11:56:14): the real audited request composition
// and fixed route policy over deterministic injected ports, as adminAccessRequest.home.test.ts does for the
// home. It does not mock the function under test or claim browser/database proof.
const NOW = "2026-11-03T18:00:00.000Z";
const END = "2026-11-03T19:00:00.000Z";
const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const PROVIDER = "22222222-2222-4222-8222-222222222222";
const SESSION = "33333333-3333-4333-8333-333333333333";
const PRINCIPAL: SupabaseAuthenticatedUser = { providerName: "supabase", providerUserId: PROVIDER, presentedSessionId: SESSION };

function chainTables(role: SolMindRole): Record<string, SupabaseQueryResult> {
  return {
    auth_provider_identity: {
      data: [{ user_account_id: ACCOUNT, provider_name: "supabase", provider_user_id: PROVIDER, status: "active" }], error: null,
    },
    user_account: { data: [{ user_account_id: ACCOUNT, account_status: "active" }], error: null },
    user_session: {
      data: [{ user_session_id: SESSION, user_account_id: ACCOUNT, active_role_context: role, session_status: "active", expires_at: END }],
      error: null,
    },
    user_role_assignment: { data: [{ user_account_id: ACCOUNT, role_code: role, role_status: "active" }], error: null },
    guide_profile: { data: [], error: null },
    explorer_profile: { data: [], error: null },
  };
}

function fixture(args: { role?: SolMindRole; now?: () => Date; writer?: AuthRlsAuditEventWriter } = {}) {
  const events: PersistableAuthRlsAuditEvent[] = [];
  const rows = chainTables(args.role ?? SOLMIND_ROLES.ADMIN);
  const select = vi.fn(async (spec: { table: string }) => rows[spec.table] ?? { data: [], error: null });
  const setAll = vi.fn();
  const writer: AuthRlsAuditEventWriter = args.writer ?? {
    async persistAuthRlsAuditEvent(event) {
      events.push(event);
      return { persisted: true, auditEventId: `synthetic-${events.length}` };
    },
  };
  const deps: AdminAccessRequestDependencies = {
    cookies: { ...createInMemoryRequestCookieAccessor(), setAll },
    createPrincipalSource: () => createInMemoryRequestAuthPrincipalSource(PRINCIPAL),
    createAuthSource: ({ now }) => createAdminAuthSourceFromExecutor({ executor: { select }, now }),
    now: args.now ?? (() => new Date(NOW)),
    createAuditEventWriter: () => writer,
  };
  return { deps, events, setAll };
}

const FIXED = [
  ["Dashboard (home)", resolveAdminHomeRouteAccess, ADMIN_HOME_ROUTE],
  ["Guides and Explorers", resolveAdminPeopleRouteAccess, ADMIN_PEOPLE_ROUTE],
  ["AI use and pauses", resolveAdminAiUseRouteAccess, ADMIN_AI_USE_ROUTE],
  ["Settings", resolveAdminSettingsRouteAccess, ADMIN_SETTINGS_ROUTE],
  ["Lift pause", resolveAdminLiftPauseRouteAccess, ADMIN_LIFT_PAUSE_ROUTE],
  ["Setting change", resolveAdminChangeSettingRouteAccess, ADMIN_CHANGE_SETTING_ROUTE],
] as const;

function expectAllowEvents(events: PersistableAuthRlsAuditEvent[]) {
  expect(events.map(({ eventType, action }) => ({ eventType, action }))).toEqual([
    { eventType: AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ, action: AUTH_RLS_AUDIT_ACTIONS.READ },
    { eventType: AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION, action: AUTH_RLS_AUDIT_ACTIONS.ALLOW },
  ]);
  expect(events.every((event) => event.actorUserAccountId === ACCOUNT)).toBe(true);
  expect(JSON.stringify(events).includes(SESSION)).toBe(false);
}

describe("audited Admin workspace guard", () => {
  it("adds exactly five fixed Admin-only rules", () => {
    for (const route of [ADMIN_PEOPLE_ROUTE, ADMIN_AI_USE_ROUTE, ADMIN_SETTINGS_ROUTE, ADMIN_LIFT_PAUSE_ROUTE, ADMIN_CHANGE_SETTING_ROUTE]) {
      const matches = SOLMIND_ROUTE_ACCESS_RULES.filter((rule) => rule.route === route);
      expect(matches.length, route).toBe(1);
      expect(matches[0].allowedRoles, route).toEqual([SOLMIND_ROLES.ADMIN]);
    }
  });

  it.each(FIXED)("%s: allows an Admin after both audit rows with exactly actor, expiry and observation", async (_name, resolver) => {
    const test = fixture();
    const result = await resolveAdminWorkspaceForRequest(test.deps, resolver);
    expect(result).toEqual({ allowed: true, actorUserAccountId: ACCOUNT, expiresAt: END, observedAt: NOW });
    expect(Object.isFrozen(result)).toBe(true);
    expectAllowEvents(test.events);
    expect(test.setAll).not.toHaveBeenCalled();
  });

  it.each(FIXED)("%s: refuses a Guide and an Explorer with one opaque deny row", async (_name, resolver) => {
    for (const role of [SOLMIND_ROLES.GUIDE, SOLMIND_ROLES.EXPLORER]) {
      const test = fixture({ role });
      expect(await resolveAdminWorkspaceForRequest(test.deps, resolver)).toEqual({ allowed: false });
      expect(test.events).toHaveLength(1);
      expect(test.events[0].action).toBe(AUTH_RLS_AUDIT_ACTIONS.DENY);
      expect(test.events[0].actorUserAccountId).toBeNull();
    }
  });

  it.each(FIXED)("%s: denies when its own rule is missing, without borrowing another rule", async (_name, resolver, route) => {
    const index = SOLMIND_ROUTE_ACCESS_RULES.findIndex((rule) => rule.route === route);
    const [rule] = SOLMIND_ROUTE_ACCESS_RULES.splice(index, 1);
    try {
      expect(await resolveAdminWorkspaceForRequest(fixture().deps, resolver)).toEqual({ allowed: false });
      expect(await resolveAdminAccessForRequest(fixture().deps)).toEqual({ allowed: true });
    } finally {
      SOLMIND_ROUTE_ACCESS_RULES.splice(index, 0, rule);
    }
  });

  it("denies at inclusive expiry and on a broken final clock without a third row", async () => {
    let calls = 0;
    const expired = fixture({ now: () => (++calls === 1 ? new Date(NOW) : new Date(END)) });
    expect(await resolveAdminWorkspaceForRequest(expired.deps, resolveAdminPeopleRouteAccess)).toEqual({ allowed: false });
    expectAllowEvents(expired.events);
    let second = 0;
    const broken = fixture({ now: () => (++second === 1 ? new Date(NOW) : new Date(Number.NaN)) });
    expect(await resolveAdminWorkspaceForRequest(broken.deps, resolveAdminSettingsRouteAccess)).toEqual({ allowed: false });
    expectAllowEvents(broken.events);
  });

  it("fails closed when an audit write fails", async () => {
    const writer: AuthRlsAuditEventWriter = { async persistAuthRlsAuditEvent() { return { persisted: false, error: AUDIT_WRITE_FAILED_ERROR }; } };
    expect(await resolveAdminWorkspaceForRequest(fixture({ writer }).deps, resolveAdminLiftPauseRouteAccess)).toEqual({ allowed: false });
  });

  it("leaves the home, actor and public probe projections unchanged", async () => {
    const home = await resolveAdminHomeForRequest(fixture().deps);
    expect(Object.keys(home).sort()).toEqual(["allowed", "expiresAt", "observedAt"]);
    expect(Object.keys(await resolveAdminActorForRequest(fixture().deps)).sort()).toEqual(["actorUserAccountId", "allowed"]);
    expect(Object.keys(await resolveAdminAccessForRequest(fixture().deps))).toEqual(["allowed"]);
  });
});
