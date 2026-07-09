import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  resolveAdminAccessForRequest,
  type AdminAccessResult,
} from "../adminAccessRequest";
import { type SolMindAuthSource } from "../authSource";
import {
  createInMemoryRequestAuthPrincipalSource,
  type SolMindRequestAuthPrincipalSource,
} from "../requestAuthPrincipalSource";
import {
  createInMemoryRequestCookieAccessor,
  type RequestCookieAccessor,
} from "../requestCookieAccessor";
import { type SupabaseAuthenticatedUser } from "../serverAuthContext";
import {
  AUTH_RLS_AUDIT_EVENT_TYPES,
  AUTH_RLS_AUDIT_REASON_CODES,
  AUTH_RLS_AUDIT_ROLE_CONTEXTS,
  AUTH_RLS_AUDIT_TARGET_TYPES,
} from "../authRlsAuditEvent";
import {
  AUTH_RLS_AUDIT_ACTIONS,
  type AuthRlsAuditEventWriter,
  type PersistableAuthRlsAuditEvent,
} from "../auditEventWriter";
import { AUDIT_WRITE_FAILED_ERROR } from "../../supabase/auditEventWriteExecutor";
import { createAdminAuthSourceFromExecutor } from "../../supabase/adminAuthSource";
import {
  type SupabaseQueryResult,
  type SupabaseQuerySpec,
} from "../../supabase/supabaseAuthQueryClient";

// Fixed injected clock; session expiries are relative to this. No real time is read.
const NOW = new Date("2026-06-25T12:00:00.000Z");
const FUTURE = "2026-06-25T13:00:00.000Z";

const PROVIDER_NAME = "supabase";
const PROVIDER_USER_ID = "auth-admin-1";
const ACCOUNT_ID = "user-admin-1";

function nowProvider(): Date {
  return NOW;
}

const ADMIN_PRINCIPAL: SupabaseAuthenticatedUser = {
  providerName: PROVIDER_NAME,
  providerUserId: PROVIDER_USER_ID,
};

// Deterministic cookie accessor double. The injected principal-source factory below
// ignores it, so its contents do not affect the decision; it only satisfies the port.
function cookies(): RequestCookieAccessor {
  return createInMemoryRequestCookieAccessor();
}

// A deterministic mock scoped-select executor keyed by table. No network/DB/env.
function mockExecutor(resultByTable: Record<string, SupabaseQueryResult>) {
  const calls: SupabaseQuerySpec[] = [];
  const executor = {
    select(spec: SupabaseQuerySpec): Promise<SupabaseQueryResult> {
      calls.push(spec);
      return Promise.resolve(
        resultByTable[spec.table] ?? { data: [], error: null },
      );
    },
  };
  return { executor, calls };
}

// Build a full, valid identity->session->role chain for the given role. The session
// is active and non-expired; the role assignment matches the active role context.
function chainTables(
  role: "admin" | "guide",
): Record<string, SupabaseQueryResult> {
  return {
    auth_provider_identity: {
      data: [
        {
          user_account_id: ACCOUNT_ID,
          provider_name: PROVIDER_NAME,
          provider_user_id: PROVIDER_USER_ID,
          status: "active",
        },
      ],
      error: null,
    },
    user_account: {
      data: [{ user_account_id: ACCOUNT_ID, account_status: "active" }],
      error: null,
    },
    user_session: {
      data: [
        {
          user_account_id: ACCOUNT_ID,
          active_role_context: role,
          session_status: "active",
          expires_at: FUTURE,
        },
      ],
      error: null,
    },
    user_role_assignment: {
      data: [
        { user_account_id: ACCOUNT_ID, role_code: role, role_status: "active" },
      ],
      error: null,
    },
    guide_profile:
      role === "guide"
        ? {
            data: [
              {
                guide_profile_id: "guide-profile-1",
                user_account_id: ACCOUNT_ID,
                status: "active",
              },
            ],
            error: null,
          }
        : { data: [], error: null },
    explorer_profile: { data: [], error: null },
  };
}

// A deterministic recording audit-writer double (AUD-3): records every persistable
// envelope offered to it and resolves a canned result per call. failFor lets a test
// induce a write failure for a specific envelope; the double never touches network,
// DB, or env and honors the never-throwing writer contract.
function recordingAuditWriter(options?: {
  failFor?: (event: PersistableAuthRlsAuditEvent) => boolean;
}) {
  const events: PersistableAuthRlsAuditEvent[] = [];
  const writer: AuthRlsAuditEventWriter = {
    persistAuthRlsAuditEvent(event: PersistableAuthRlsAuditEvent) {
      events.push(event);
      if (options?.failFor?.(event) === true) {
        return Promise.resolve({
          persisted: false as const,
          error: AUDIT_WRITE_FAILED_ERROR,
        });
      }
      return Promise.resolve({
        persisted: true as const,
        auditEventId: `audit-event-${events.length}`,
      });
    },
  };
  return { events, writer };
}

function eventsOfType(
  events: PersistableAuthRlsAuditEvent[],
  eventType: string,
): PersistableAuthRlsAuditEvent[] {
  return events.filter((event) => event.eventType === eventType);
}

// Inject an in-memory principal source (WHO), a real-shaped, mock-executor-backed
// Admin auth source (WHAT), and a recording audit writer into the helper, mirroring
// how the route composes the real adapters but with deterministic doubles.
function callHelperWith(args: {
  principal: SupabaseAuthenticatedUser | null;
  resultByTable?: Record<string, SupabaseQueryResult>;
  principalSourceFactory?: () => SolMindRequestAuthPrincipalSource;
  authSourceFactory?: (args: { now: () => Date }) => SolMindAuthSource;
  auditWriter?: AuthRlsAuditEventWriter;
  onAuditWriteFailure?: () => void;
}): Promise<{
  result: AdminAccessResult;
  calls: SupabaseQuerySpec[];
  auditEvents: PersistableAuthRlsAuditEvent[];
}> {
  const { executor, calls } = mockExecutor(args.resultByTable ?? chainTables("admin"));

  const createPrincipalSource =
    args.principalSourceFactory ??
    (() => createInMemoryRequestAuthPrincipalSource(args.principal));

  const createAuthSource =
    args.authSourceFactory ??
    (({ now }: { now: () => Date }) =>
      createAdminAuthSourceFromExecutor({ executor, now }));

  const recorder = recordingAuditWriter();
  const auditWriter = args.auditWriter ?? recorder.writer;

  return resolveAdminAccessForRequest({
    cookies: cookies(),
    createPrincipalSource,
    createAuthSource,
    now: nowProvider,
    createAuditEventWriter: () => auditWriter,
    onAuditWriteFailure: args.onAuditWriteFailure,
  }).then((result) => ({ result, calls, auditEvents: recorder.events }));
}

// Assert the outward result carries ONLY { allowed } and never leaks reason, context,
// role, or any profile/session/identity field.
function expectOpaque(result: AdminAccessResult): void {
  expect(Object.keys(result)).toEqual(["allowed"]);
  expect(result).not.toHaveProperty("reason");
  expect(result).not.toHaveProperty("context");
  expect(result).not.toHaveProperty("activeRole");
  expect(result).not.toHaveProperty("identity");
  expect(result).not.toHaveProperty("guideProfileId");
  expect(result).not.toHaveProperty("explorerProfileId");
}

// The complete, closed set of keys a persistable audit envelope may carry. Asserting
// the key set is closed proves the persisted payload carries no stray field that
// could smuggle a reason, cookie, token, or any sensitive content (Doc 16
// sections 7-8; Doc 22 Section 9).
const ALLOWED_ENVELOPE_KEYS = [
  "action",
  "actorRoleContext",
  "actorUserAccountId",
  "eventType",
  "metadata",
  "reasonCode",
  "targetEntityType",
].sort();

const ALLOWED_ENVELOPE_METADATA_KEYS = ["decision", "routeId"];

// Assert a persisted envelope uses only the permitted keys and bounded,
// non-sensitive values, and never attributes an Explorer/Guide role context.
function expectBoundedEnvelope(event: PersistableAuthRlsAuditEvent): void {
  expect(Object.keys(event).sort()).toEqual(ALLOWED_ENVELOPE_KEYS);
  expect(["admin", "system"]).toContain(event.actorRoleContext);
  expect(event.actorRoleContext).not.toBe("explorer");
  expect(event.actorRoleContext).not.toBe("guide");
  expect(event.targetEntityType).toBe(AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE);
  if (event.actorUserAccountId !== null) {
    expect(typeof event.actorUserAccountId).toBe("string");
  }
  for (const key of Object.keys(event.metadata)) {
    expect(ALLOWED_ENVELOPE_METADATA_KEYS).toContain(key);
  }
}

describe("resolveAdminAccessForRequest - opaque allow", () => {
  it("returns only { allowed: true } for a verified Admin (no context/reason leakage)", async () => {
    const { result } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("admin"),
    });

    expect(result).toEqual({ allowed: true });
    expectOpaque(result);
  });
});

describe("resolveAdminAccessForRequest - opaque deny", () => {
  it("returns only { allowed: false } for a verified non-Admin (Guide), no leakage", async () => {
    const { result } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("guide"),
    });

    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
  });

  it("never carries Explorer/Guide profile fields into the outward result", async () => {
    // Even when the loaded chain includes a Guide profile, the outward result holds
    // only { allowed } -- no guideProfileId/explorerProfileId or any private field.
    const { result } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("guide"),
    });

    expectOpaque(result);
  });
});

describe("resolveAdminAccessForRequest - fail closed", () => {
  it("denies when the auth-source factory throws (e.g. missing service-role env)", async () => {
    const { result } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      authSourceFactory: () => {
        throw new Error("SolMind server configuration error: missing service-role env");
      },
    });

    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
  });

  it("denies when the principal-source factory throws", async () => {
    const { result } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      principalSourceFactory: () => {
        throw new Error("principal source construction failure");
      },
    });

    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
  });
});

describe("resolveAdminAccessForRequest - null principal", () => {
  it("denies a null principal WITHOUT invoking the service-role/record-load executor", async () => {
    const select = vi.fn();
    const recorder = recordingAuditWriter();
    const result = await resolveAdminAccessForRequest({
      cookies: cookies(),
      createPrincipalSource: () =>
        createInMemoryRequestAuthPrincipalSource(null),
      createAuthSource: ({ now }) =>
        createAdminAuthSourceFromExecutor({ executor: { select }, now }),
      now: nowProvider,
      createAuditEventWriter: () => recorder.writer,
    });

    expect(result).toEqual({ allowed: false });
    expect(select).not.toHaveBeenCalled();
  });
});

describe("resolveAdminAccessForRequest - allow-path audit persistence (AUTH-RLS-DEC-029/030)", () => {
  it("persists exactly two rows on an allow: guarded-read FIRST, then the allow decision, both attributed", async () => {
    const { result, auditEvents } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("admin"),
    });

    expect(result).toEqual({ allowed: true });
    // Exactly two persist attempts, in the AUTH-RLS-DEC-030 order.
    expect(auditEvents).toHaveLength(2);
    expect(auditEvents[0]).toEqual({
      eventType: AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ,
      action: AUTH_RLS_AUDIT_ACTIONS.READ,
      actorRoleContext: AUTH_RLS_AUDIT_ROLE_CONTEXTS.ADMIN,
      actorUserAccountId: ACCOUNT_ID,
      targetEntityType: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
      reasonCode: AUTH_RLS_AUDIT_REASON_CODES.GUARDED_READ,
      metadata: { routeId: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE },
    });
    expect(auditEvents[1]).toEqual({
      eventType: AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION,
      action: AUTH_RLS_AUDIT_ACTIONS.ALLOW,
      actorRoleContext: AUTH_RLS_AUDIT_ROLE_CONTEXTS.ADMIN,
      actorUserAccountId: ACCOUNT_ID,
      targetEntityType: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
      reasonCode: AUTH_RLS_AUDIT_REASON_CODES.ACCESS_GRANTED,
      metadata: {
        routeId: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
        decision: "allow",
      },
    });
    for (const event of auditEvents) {
      expectBoundedEnvelope(event);
    }
    // The persisted guarded-read is post-resolution (AUTH-RLS-DEC-029): exactly one,
    // never a second (legacy pre-read bridge) emission, and never a null actor.
    const reads = eventsOfType(
      auditEvents,
      AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ,
    );
    expect(reads).toHaveLength(1);
    expect(reads[0].actorUserAccountId).toBe(ACCOUNT_ID);
    // No auth-resolution-failure row on a clean allow.
    expect(
      eventsOfType(auditEvents, AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE),
    ).toHaveLength(0);
  });
});

describe("resolveAdminAccessForRequest - deny-path audit persistence", () => {
  it("persists exactly one opaque deny decision row for a verified non-Admin: system role, no account id, NO guarded-read row", async () => {
    const { result, auditEvents } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("guide"),
    });

    expect(result).toEqual({ allowed: false });
    // AUTH-RLS-DEC-029 deny path: no guarded-read row is persisted (no valid Admin
    // actor is attributable), and the opaque deny decision row is the audit record.
    expect(auditEvents).toHaveLength(1);
    const event = auditEvents[0];
    expect(event.eventType).toBe(
      AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION,
    );
    expect(event.action).toBe(AUTH_RLS_AUDIT_ACTIONS.DENY);
    expect(event.actorRoleContext).toBe(AUTH_RLS_AUDIT_ROLE_CONTEXTS.SYSTEM);
    expect(event.actorUserAccountId).toBeNull();
    expect(event.reasonCode).toBe(AUTH_RLS_AUDIT_REASON_CODES.ACCESS_DENIED);
    // A denied Guide is never attributed: no admin/guide/explorer identity leaks.
    expect(event.actorRoleContext).not.toBe("guide");
    expect(event.actorRoleContext).not.toBe("explorer");
    expectBoundedEnvelope(event);
    expect(
      eventsOfType(auditEvents, AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ),
    ).toHaveLength(0);
    expect(
      eventsOfType(auditEvents, AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE),
    ).toHaveLength(0);
  });

  it("persists exactly one opaque deny decision row for a null principal without loading records", async () => {
    const select = vi.fn();
    const recorder = recordingAuditWriter();

    const result = await resolveAdminAccessForRequest({
      cookies: cookies(),
      createPrincipalSource: () =>
        createInMemoryRequestAuthPrincipalSource(null),
      createAuthSource: ({ now }) =>
        createAdminAuthSourceFromExecutor({ executor: { select }, now }),
      now: nowProvider,
      createAuditEventWriter: () => recorder.writer,
    });

    expect(result).toEqual({ allowed: false });
    // No record load happened, so no guarded-read row; a null principal is a clean
    // deny, NOT a resolution failure (the failure category is scoped to exceptions).
    expect(select).not.toHaveBeenCalled();
    expect(recorder.events).toHaveLength(1);
    expect(recorder.events[0].eventType).toBe(
      AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION,
    );
    expect(recorder.events[0].action).toBe(AUTH_RLS_AUDIT_ACTIONS.DENY);
    expect(recorder.events[0].actorRoleContext).toBe(
      AUTH_RLS_AUDIT_ROLE_CONTEXTS.SYSTEM,
    );
    expect(recorder.events[0].actorUserAccountId).toBeNull();
    expectBoundedEnvelope(recorder.events[0]);
  });

  it("never persists an Explorer or Guide role context across allow and deny paths", async () => {
    const allow = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("admin"),
    });
    const deny = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("guide"),
    });

    // The allow persists two rows (guarded read + allow decision); the deny persists
    // one (opaque deny decision). Every envelope carries only admin/system.
    const all = [...allow.auditEvents, ...deny.auditEvents];
    expect(all).toHaveLength(3);
    for (const event of all) {
      expect(["admin", "system"]).toContain(event.actorRoleContext);
      expect(event.actorRoleContext).not.toBe("explorer");
      expect(event.actorRoleContext).not.toBe("guide");
      expectBoundedEnvelope(event);
    }
  });
});

describe("resolveAdminAccessForRequest - auth resolution failure persistence", () => {
  it("persists one bounded failure row (then the opaque deny decision) when the principal source rejects", async () => {
    // A principal source that REJECTS (a resolution exception) is swallowed inside
    // composeRequestAuthContext, which signals the value-free onAuthResolutionFailure
    // seam; this boundary bridges it to a best-effort persisted failure row. The
    // composer then returns the opaque denial, so the deny decision row follows.
    const INNER_RESOLUTION_SECRET =
      "token-bearing resolution failure that must not leak";
    const { result, auditEvents } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      principalSourceFactory: () => ({
        resolveAuthenticatedUser: () =>
          Promise.reject(new Error(INNER_RESOLUTION_SECRET)),
      }),
    });

    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
    expect(auditEvents).toHaveLength(2);
    const failure = auditEvents[0];
    expect(failure.eventType).toBe(
      AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE,
    );
    expect(failure.action).toBe(AUTH_RLS_AUDIT_ACTIONS.DENY);
    expect(failure.actorRoleContext).toBe(AUTH_RLS_AUDIT_ROLE_CONTEXTS.SYSTEM);
    expect(failure.actorUserAccountId).toBeNull();
    expect(failure.reasonCode).toBe(AUTH_RLS_AUDIT_REASON_CODES.AUTH_UNRESOLVED);
    expectBoundedEnvelope(failure);
    expect(auditEvents[1].eventType).toBe(
      AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION,
    );
    expect(auditEvents[1].action).toBe(AUTH_RLS_AUDIT_ACTIONS.DENY);
    // No service-role read happened: resolution threw before the record load, so no
    // guarded-read row exists (AUTH-RLS-DEC-029 deny path).
    expect(
      eventsOfType(auditEvents, AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ),
    ).toHaveLength(0);
    // Privacy: the raw error never reaches any persisted envelope.
    expect(JSON.stringify(auditEvents)).not.toContain(INNER_RESOLUTION_SECRET);
  });

  it("persists exactly one failure row (and no decision row) when a construction factory throws", async () => {
    // A missing service-role env throws at auth-source construction in the request
    // path; this module's own fail-closed catch records the genuine failure
    // best-effort and denies. No decision was reached, so no decision row exists.
    const { result, auditEvents } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      authSourceFactory: () => {
        throw new Error(
          "SolMind server configuration error: missing service-role env",
        );
      },
    });

    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0].eventType).toBe(
      AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE,
    );
    expectBoundedEnvelope(auditEvents[0]);
  });
});

describe("resolveAdminAccessForRequest - default production audit writer (AUD-3 default-off retirement)", () => {
  // The production default (no injected createAuditEventWriter) must resolve the
  // REAL writer chain. Without service-role env that construction fails, audit
  // persistence is unavailable, and a would-be allow must FAIL CLOSED -- proving the
  // seam can no longer silently regress to a no-op that allows unaudited access.
  let savedUrlEnv: string | undefined;
  let savedServiceRoleEnv: string | undefined;

  beforeEach(() => {
    savedUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
    savedServiceRoleEnv = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    // Restore exactly: delete a var that was originally unset. Assigning undefined
    // to a process.env property would store the literal string "undefined".
    if (savedUrlEnv === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrlEnv;
    }
    if (savedServiceRoleEnv === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = savedServiceRoleEnv;
    }
  });

  it("fails a would-be allow closed when the default real writer chain cannot be constructed", async () => {
    const onAuditWriteFailure = vi.fn();
    const { executor } = mockExecutor(chainTables("admin"));

    const result = await resolveAdminAccessForRequest({
      cookies: cookies(),
      createPrincipalSource: () =>
        createInMemoryRequestAuthPrincipalSource(ADMIN_PRINCIPAL),
      createAuthSource: ({ now }) =>
        createAdminAuthSourceFromExecutor({ executor, now }),
      now: nowProvider,
      // No createAuditEventWriter: the default real chain is resolved and its
      // construction fails on the deleted service-role env.
      onAuditWriteFailure,
    });

    // The record chain would allow, but the required guarded-read audit write is
    // unavailable, so the outcome is a fail-closed deny with the bounded signal.
    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
    expect(onAuditWriteFailure).toHaveBeenCalledTimes(1);
  });
});
