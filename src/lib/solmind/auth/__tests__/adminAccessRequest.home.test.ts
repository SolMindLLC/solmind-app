import { describe, expect, it, vi } from "vitest";

import {
  resolveAdminAccessForRequest,
  resolveAdminActorForRequest,
  resolveAdminHomeForRequest,
  type AdminAccessRequestDependencies,
} from "../adminAccessRequest";
import { createInMemoryRequestAuthPrincipalSource } from "../requestAuthPrincipalSource";
import { createInMemoryRequestCookieAccessor } from "../requestCookieAccessor";
import { AUTH_RLS_AUDIT_EVENT_TYPES } from "../authRlsAuditEvent";
import {
  AUTH_RLS_AUDIT_ACTIONS,
  type AuthRlsAuditEventWriter,
  type PersistableAuthRlsAuditEvent,
} from "../auditEventWriter";
import { type SupabaseAuthenticatedUser } from "../serverAuthContext";
import { createAdminAuthSourceFromExecutor } from "../../supabase/adminAuthSource";
import { AUDIT_WRITE_FAILED_ERROR } from "../../supabase/auditEventWriteExecutor";
import { type SupabaseQueryResult } from "../../supabase/supabaseAuthQueryClient";
import {
  ADMIN_HOME_ROUTE,
  SOLMIND_ROUTE_ACCESS_RULES,
} from "../../routeAccess";
import { SOLMIND_ROLES, type SolMindRole } from "../../roles";

// This suite runs the actual audited request composition, fixed route policy,
// record mapping and session selection over deterministic injected ports. It
// does not mock the function under test or claim browser/database proof.
const NOW = "2026-10-23T16:00:00.000Z";
const END = "2026-10-23T17:00:00.000Z";
const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const PROVIDER = "22222222-2222-4222-8222-222222222222";
const SESSION = "33333333-3333-4333-8333-333333333333";
const PRIVATE = "admin_home_private_error_canary";
const PRINCIPAL: SupabaseAuthenticatedUser = {
  providerName: "supabase",
  providerUserId: PROVIDER,
  presentedSessionId: SESSION,
};

function chainTables(role: SolMindRole): Record<string, SupabaseQueryResult> {
  return {
    auth_provider_identity: {
      data: [{ user_account_id: ACCOUNT, provider_name: "supabase", provider_user_id: PROVIDER, status: "active" }],
      error: null,
    },
    user_account: {
      data: [{ user_account_id: ACCOUNT, account_status: "active" }],
      error: null,
    },
    user_session: {
      data: [{ user_session_id: SESSION, user_account_id: ACCOUNT, active_role_context: role, session_status: "active", expires_at: END }],
      error: null,
    },
    user_role_assignment: {
      data: [{ user_account_id: ACCOUNT, role_code: role, role_status: "active" }],
      error: null,
    },
    guide_profile: { data: [], error: null },
    explorer_profile: { data: [], error: null },
  };
}

function fixture(args: {
  now?: () => Date;
  writer?: AuthRlsAuditEventWriter;
  role?: SolMindRole;
  principal?: SupabaseAuthenticatedUser | null;
  createAuditEventWriter?: () => AuthRlsAuditEventWriter;
} = {}) {
  const events: PersistableAuthRlsAuditEvent[] = [];
  const rows = chainTables(args.role ?? SOLMIND_ROLES.ADMIN);
  const select = vi.fn(async (spec: { table: string }) =>
    rows[spec.table] ?? { data: [], error: null });
  const now = args.now ?? vi.fn(() => new Date(NOW));
  const setAll = vi.fn();
  const cookies = { ...createInMemoryRequestCookieAccessor(), setAll };
  const onAuditWriteFailure = vi.fn();
  const defaultWriter: AuthRlsAuditEventWriter = {
    async persistAuthRlsAuditEvent(event) {
      events.push(event);
      return { persisted: true, auditEventId: `synthetic-${events.length}` };
    },
  };
  const deps: AdminAccessRequestDependencies = {
    cookies,
    createPrincipalSource: () => createInMemoryRequestAuthPrincipalSource(
      args.principal === undefined ? PRINCIPAL : args.principal),
    createAuthSource: ({ now: serverNow }) =>
      createAdminAuthSourceFromExecutor({ executor: { select }, now: serverNow }),
    now,
    createAuditEventWriter: args.createAuditEventWriter ?? (() => args.writer ?? defaultWriter),
    onAuditWriteFailure,
  };
  return { deps, events, rows, select, now, setAll, onAuditWriteFailure };
}

function expectDenied(result: Awaited<ReturnType<typeof resolveAdminHomeForRequest>>) {
  // Boolean checks keep any unexpected private field out of assertion output.
  expect(JSON.stringify(result) === JSON.stringify({ allowed: false })).toBe(true);
  expect(Object.isFrozen(result)).toBe(true);
}

function expectAllowEvents(events: PersistableAuthRlsAuditEvent[]) {
  expect(events.map(({ eventType, action }) => ({ eventType, action }))).toEqual([
    { eventType: AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ, action: AUTH_RLS_AUDIT_ACTIONS.READ },
    { eventType: AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION, action: AUTH_RLS_AUDIT_ACTIONS.ALLOW },
  ]);
  expect(events.every((event) => event.actorUserAccountId === ACCOUNT)).toBe(true);
  expect(JSON.stringify(events).includes(SESSION)).toBe(false);
  expect(JSON.stringify(events).includes(PRIVATE)).toBe(false);
}

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

async function drain() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("audited fixed Admin home projection", () => {
  it("allows only after both attributed rows, exposing exactly frozen expiry and observation fields", async () => {
    const test = fixture();
    const result = await resolveAdminHomeForRequest(test.deps);
    expect(JSON.stringify(result) === JSON.stringify({ allowed: true, expiresAt: END, observedAt: NOW })).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.keys(result).sort()).toEqual(["allowed", "expiresAt", "observedAt"]);
    expectAllowEvents(test.events);
    expect(test.setAll).not.toHaveBeenCalled();
    expect(test.onAuditWriteFailure).not.toHaveBeenCalled();
  });

  it("awaits the guarded read then the allow row and observes time only after both have persisted", async () => {
    const guarded = gate();
    const allow = gate();
    const events: PersistableAuthRlsAuditEvent[] = [];
    const order: string[] = [];
    const now = vi.fn(() => { order.push("clock"); return new Date(NOW); });
    const writer: AuthRlsAuditEventWriter = {
      async persistAuthRlsAuditEvent(event) {
        events.push(event);
        const first = events.length === 1;
        order.push(first ? "guarded-attempt" : "allow-attempt");
        await (first ? guarded.promise : allow.promise);
        order.push(first ? "guarded-persisted" : "allow-persisted");
        return { persisted: true, auditEventId: `synthetic-${events.length}` };
      },
    };
    const test = fixture({ now, writer });
    let settled = false;
    const pending = resolveAdminHomeForRequest(test.deps).then((result) => {
      settled = true;
      return result;
    });
    try {
      await drain();
      expect(events).toHaveLength(1);
      expect(now).toHaveBeenCalledTimes(1);
      expect(settled).toBe(false);
      guarded.release();
      await drain();
      expect(events).toHaveLength(2);
      expect(now).toHaveBeenCalledTimes(1);
      expect(settled).toBe(false);
      allow.release();
      expect((await pending).allowed).toBe(true);
      expect(order).toEqual([
        "clock", "guarded-attempt", "guarded-persisted",
        "allow-attempt", "allow-persisted", "clock",
      ]);
      expectAllowEvents(events);
    } finally {
      guarded.release();
      allow.release();
      await pending;
    }
  });

  it.each(["guarded", "allow"])("denies at inclusive expiry reached during the %s write without inventing additional rows", async (stage) => {
    let observed = NOW;
    const events: PersistableAuthRlsAuditEvent[] = [];
    const writer: AuthRlsAuditEventWriter = {
      async persistAuthRlsAuditEvent(event) {
        events.push(event);
        if ((stage === "guarded" && events.length === 1) ||
            (stage === "allow" && events.length === 2)) observed = END;
        return { persisted: true, auditEventId: `synthetic-${events.length}` };
      },
    };
    const test = fixture({ writer, now: () => new Date(observed) });
    expectDenied(await resolveAdminHomeForRequest(test.deps));
    // These are the completed earlier decision's rows, not proof of a rendered
    // home. No compensating deny or false resolution-failure row is approved.
    expectAllowEvents(events);
    expect(test.onAuditWriteFailure).not.toHaveBeenCalled();
    expect(test.setAll).not.toHaveBeenCalled();
  });

  it.each(["invalid", "throw"])("denies a final %s clock without misreporting auth resolution failure", async (kind) => {
    const now = vi.fn().mockReturnValueOnce(new Date(NOW)).mockImplementation(() => {
      if (kind === "throw") throw new Error(PRIVATE);
      return new Date(NaN);
    });
    const test = fixture({ now });
    expectDenied(await resolveAdminHomeForRequest(test.deps));
    expect(now).toHaveBeenCalledTimes(2);
    expectAllowEvents(test.events);
    expect(test.onAuditWriteFailure).not.toHaveBeenCalled();
  });

  it.each([1, 2])("fails write %s closed with no compensating deny or false resolution-failure row", async (failureAttempt) => {
    const attempted: PersistableAuthRlsAuditEvent[] = [];
    const persisted: PersistableAuthRlsAuditEvent[] = [];
    const writer: AuthRlsAuditEventWriter = {
      async persistAuthRlsAuditEvent(event) {
        attempted.push(event);
        if (attempted.length === failureAttempt) {
          return { persisted: false, error: AUDIT_WRITE_FAILED_ERROR };
        }
        persisted.push(event);
        return { persisted: true, auditEventId: "synthetic-guarded" };
      },
    };
    const now = vi.fn(() => new Date(NOW));
    const test = fixture({ writer, now });
    expectDenied(await resolveAdminHomeForRequest(test.deps));
    expect(attempted).toHaveLength(failureAttempt);
    expect(persisted).toHaveLength(failureAttempt - 1);
    expect(attempted[0].eventType).toBe(AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ);
    if (failureAttempt === 2) expectAllowEvents(attempted);
    expect(attempted.some((event) => event.eventType === AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE)).toBe(false);
    expect(attempted.some((event) => event.action === AUTH_RLS_AUDIT_ACTIONS.DENY)).toBe(false);
    expect(test.onAuditWriteFailure).toHaveBeenCalledTimes(1);
    expect(now).toHaveBeenCalledTimes(1);
  });

  it.each(["throw", "reject"])("contains a contract-violating writer %s as an audit failure", async (kind) => {
    const attempted: PersistableAuthRlsAuditEvent[] = [];
    const writer: AuthRlsAuditEventWriter = {
      persistAuthRlsAuditEvent(event) {
        attempted.push(event);
        if (kind === "throw") throw new Error(PRIVATE);
        return Promise.reject(new Error(PRIVATE));
      },
    };
    const test = fixture({ writer });
    expectDenied(await resolveAdminHomeForRequest(test.deps));
    expect(attempted).toHaveLength(1);
    expect(attempted[0].eventType).toBe(AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ);
    expect(test.onAuditWriteFailure).toHaveBeenCalledTimes(1);
  });

  it("fails an unavailable audit writer closed without a false auth failure", async () => {
    const test = fixture({ createAuditEventWriter: () => { throw new Error(PRIVATE); } });
    expectDenied(await resolveAdminHomeForRequest(test.deps));
    expect(test.events).toHaveLength(0);
    expect(test.onAuditWriteFailure).toHaveBeenCalledTimes(1);
  });

  it("preserves exact actor and public probe keys rather than widening their successful outputs", async () => {
    const actor = fixture();
    const actorResult = await resolveAdminActorForRequest(actor.deps);
    expect(actorResult).toEqual({ allowed: true, actorUserAccountId: ACCOUNT });
    expect(Object.keys(actorResult).sort()).toEqual(["actorUserAccountId", "allowed"]);
    expectAllowEvents(actor.events);
    const probe = fixture();
    const probeResult = await resolveAdminAccessForRequest(probe.deps);
    expect(probeResult).toEqual({ allowed: true });
    expect(Object.keys(probeResult)).toEqual(["allowed"]);
    expectAllowEvents(probe.events);
  });

  it("binds home to its own exact policy and denies if that policy is missing", async () => {
    const index = SOLMIND_ROUTE_ACCESS_RULES.findIndex((rule) => rule.route === ADMIN_HOME_ROUTE);
    expect(index).toBeGreaterThanOrEqual(0);
    const [rule] = SOLMIND_ROUTE_ACCESS_RULES.splice(index, 1);
    try {
      const test = fixture();
      expectDenied(await resolveAdminHomeForRequest(test.deps));
      expect(test.events.map(({ eventType, action }) => ({ eventType, action }))).toEqual([
        { eventType: AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION, action: AUTH_RLS_AUDIT_ACTIONS.DENY },
      ]);
      expect(test.events[0].actorUserAccountId).toBeNull();
      // The old fixed /admin policy remains independently effective.
      expect(await resolveAdminAccessForRequest(fixture().deps)).toEqual({ allowed: true });
    } finally {
      SOLMIND_ROUTE_ACCESS_RULES.splice(index, 0, rule);
    }
  });

  it("denies Admin if the exact home policy no longer permits Admin", async () => {
    const rule = SOLMIND_ROUTE_ACCESS_RULES.find((candidate) => candidate.route === ADMIN_HOME_ROUTE);
    expect(rule).toBeDefined();
    if (!rule) return;
    const original = rule.allowedRoles;
    rule.allowedRoles = [];
    try {
      const test = fixture();
      expectDenied(await resolveAdminHomeForRequest(test.deps));
      expect(test.events).toHaveLength(1);
      expect(test.events[0].action).toBe(AUTH_RLS_AUDIT_ACTIONS.DENY);
      expect(test.events[0].actorUserAccountId).toBeNull();
      expect(await resolveAdminAccessForRequest(fixture().deps)).toEqual({ allowed: true });
    } finally {
      rule.allowedRoles = original;
    }
  });

  it.each([SOLMIND_ROLES.GUIDE, SOLMIND_ROLES.EXPLORER])("rejects a valid %s active role without attributing it to Admin", async (role) => {
    const test = fixture({ role });
    expectDenied(await resolveAdminHomeForRequest(test.deps));
    expect(test.events).toHaveLength(1);
    expect(test.events[0].action).toBe(AUTH_RLS_AUDIT_ACTIONS.DENY);
    expect(test.events[0].actorUserAccountId).toBeNull();
  });

  it("denies no principal before loading records and never writes request cookies", async () => {
    const test = fixture({ principal: null });
    expectDenied(await resolveAdminHomeForRequest(test.deps));
    expect(test.select).not.toHaveBeenCalled();
    expect(test.setAll).not.toHaveBeenCalled();
    expect(test.events).toHaveLength(1);
    expect(test.events[0].action).toBe(AUTH_RLS_AUDIT_ACTIONS.DENY);
    expect(test.events[0].actorUserAccountId).toBeNull();
  });
});
