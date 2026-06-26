import { describe, expect, it, vi } from "vitest";

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
  AUTH_RLS_AUDIT_DECISIONS,
  AUTH_RLS_AUDIT_EVENT_SUMMARIES,
  AUTH_RLS_AUDIT_EVENT_TYPES,
  AUTH_RLS_AUDIT_REASON_CODES,
  AUTH_RLS_AUDIT_ROLE_CONTEXTS,
  AUTH_RLS_AUDIT_TARGET_TYPES,
  type AuthRlsAuditEvent,
  type AuthRlsAuditEventType,
  type AuthRlsAuditSink,
} from "../authRlsAuditEvent";
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

// Inject an in-memory principal source (WHO) and a real-shaped, mock-executor-backed
// Admin auth source (WHAT) into the helper, mirroring how the route composes the real
// adapters but with deterministic doubles.
function callHelperWith(args: {
  principal: SupabaseAuthenticatedUser | null;
  resultByTable?: Record<string, SupabaseQueryResult>;
  principalSourceFactory?: () => SolMindRequestAuthPrincipalSource;
  authSourceFactory?: (args: { now: () => Date }) => SolMindAuthSource;
  auditSink?: AuthRlsAuditSink;
}): Promise<{ result: AdminAccessResult; calls: SupabaseQuerySpec[] }> {
  const { executor, calls } = mockExecutor(args.resultByTable ?? chainTables("admin"));

  const createPrincipalSource =
    args.principalSourceFactory ??
    (() => createInMemoryRequestAuthPrincipalSource(args.principal));

  const createAuthSource =
    args.authSourceFactory ??
    (({ now }: { now: () => Date }) =>
      createAdminAuthSourceFromExecutor({ executor, now }));

  return resolveAdminAccessForRequest({
    cookies: cookies(),
    createPrincipalSource,
    createAuthSource,
    now: nowProvider,
    auditSink: args.auditSink,
  }).then((result) => ({ result, calls }));
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

// The complete, closed set of keys a bounded audit event may carry. Asserting the
// key set is closed proves the emitted event carries no stray field that could
// smuggle a reason, cookie, token, or any sensitive content (Doc 16 sections 7-8).
const ALLOWED_AUDIT_EVENT_KEYS = [
  "actorRoleContext",
  "actorUserAccountId",
  "eventSummary",
  "eventType",
  "metadata",
  "reasonCode",
  "targetEntityType",
].sort();

const ALLOWED_AUDIT_METADATA_KEYS = ["decision", "routeId"];

// Assert an emitted event uses only the permitted keys and bounded, non-sensitive
// values, and never attributes an Explorer/Guide role context.
function expectBoundedEmittedEvent(event: AuthRlsAuditEvent): void {
  const keys = Object.keys(event)
    .filter((key) => key !== "metadata" || event.metadata !== undefined)
    .sort();
  for (const key of keys) {
    expect(ALLOWED_AUDIT_EVENT_KEYS).toContain(key);
  }
  expect(["admin", "system"]).toContain(event.actorRoleContext);
  expect(event.actorRoleContext).not.toBe("explorer");
  expect(event.actorRoleContext).not.toBe("guide");
  expect(event.targetEntityType).toBe(AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE);
  if (event.actorUserAccountId !== null) {
    expect(typeof event.actorUserAccountId).toBe("string");
  }
  if (event.metadata !== undefined) {
    for (const key of Object.keys(event.metadata)) {
      expect(ALLOWED_AUDIT_METADATA_KEYS).toContain(key);
    }
  }
}

// Collect every event handed to a vi.fn() sink, and filter by event type. One sink
// now receives several bounded categories per request (guarded read, decision, and
// possibly a failure), so assertions filter by eventType rather than asserting a raw
// call count.
type SinkMock = ReturnType<typeof vi.fn>;

function emittedEvents(sink: SinkMock): AuthRlsAuditEvent[] {
  return sink.mock.calls.map((call) => call[0] as AuthRlsAuditEvent);
}

function eventsOfType(
  sink: SinkMock,
  eventType: AuthRlsAuditEventType,
): AuthRlsAuditEvent[] {
  return emittedEvents(sink).filter((event) => event.eventType === eventType);
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
    const result = await resolveAdminAccessForRequest({
      cookies: cookies(),
      createPrincipalSource: () =>
        createInMemoryRequestAuthPrincipalSource(null),
      createAuthSource: ({ now }) =>
        createAdminAuthSourceFromExecutor({ executor: { select }, now }),
      now: nowProvider,
    });

    expect(result).toEqual({ allowed: false });
    expect(select).not.toHaveBeenCalled();
  });
});

describe("resolveAdminAccessForRequest - audit seam", () => {
  it("is default-off: omitting the sink leaves the allow/deny result unchanged and never throws", async () => {
    // No sink injected -> the no-op default sink is used, persisting nothing. The
    // decision is unchanged for both an allow and a deny.
    const allow = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("admin"),
    });
    expect(allow.result).toEqual({ allowed: true });

    const deny = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("guide"),
    });
    expect(deny.result).toEqual({ allowed: false });
  });

  it("emits exactly one bounded allow decision event attributing the admin account", async () => {
    const auditSink = vi.fn();

    const { result } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("admin"),
      auditSink,
    });

    expect(result).toEqual({ allowed: true });
    // Filter to the DECISION category: the same sink also receives a guarded-read
    // event on this path, so a raw call count would be brittle.
    const decisionEvents = eventsOfType(
      auditSink,
      AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION,
    );
    expect(decisionEvents).toHaveLength(1);
    expect(decisionEvents[0]).toEqual({
      eventType: AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION,
      actorRoleContext: AUTH_RLS_AUDIT_ROLE_CONTEXTS.ADMIN,
      actorUserAccountId: ACCOUNT_ID,
      targetEntityType: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
      reasonCode: AUTH_RLS_AUDIT_REASON_CODES.ACCESS_GRANTED,
      eventSummary: AUTH_RLS_AUDIT_EVENT_SUMMARIES.ADMIN_ACCESS_ALLOWED,
      metadata: {
        routeId: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
        decision: AUTH_RLS_AUDIT_DECISIONS.ALLOW,
      },
    });
    expectBoundedEmittedEvent(decisionEvents[0]);
    // No auth-resolution-failure event on a clean allow.
    expect(
      eventsOfType(auditSink, AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE),
    ).toHaveLength(0);
  });

  it("emits an opaque deny event for a verified non-Admin: system role, no account id", async () => {
    const auditSink = vi.fn();

    const { result } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("guide"),
      auditSink,
    });

    expect(result).toEqual({ allowed: false });
    // A verified-but-non-admin request still performs a guarded read, so filter to
    // the DECISION category rather than reading the first call.
    const decisionEvents = eventsOfType(
      auditSink,
      AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION,
    );
    expect(decisionEvents).toHaveLength(1);
    const event = decisionEvents[0];
    expect(event.actorRoleContext).toBe(AUTH_RLS_AUDIT_ROLE_CONTEXTS.SYSTEM);
    expect(event.actorUserAccountId).toBeNull();
    expect(event.reasonCode).toBe(AUTH_RLS_AUDIT_REASON_CODES.ACCESS_DENIED);
    expect(event.eventSummary).toBe(
      AUTH_RLS_AUDIT_EVENT_SUMMARIES.ADMIN_ACCESS_DENIED,
    );
    // A denied Guide is never attributed: no admin/guide/explorer identity leaks.
    expect(event.actorRoleContext).not.toBe("guide");
    expect(event.actorRoleContext).not.toBe("explorer");
    expectBoundedEmittedEvent(event);
    // A clean (verified) deny is not a resolution failure: no failure event emitted.
    expect(
      eventsOfType(auditSink, AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE),
    ).toHaveLength(0);
  });

  it("emits an opaque deny event for a null principal without loading records", async () => {
    const auditSink = vi.fn();
    const select = vi.fn();

    const result = await resolveAdminAccessForRequest({
      cookies: cookies(),
      createPrincipalSource: () =>
        createInMemoryRequestAuthPrincipalSource(null),
      createAuthSource: ({ now }) =>
        createAdminAuthSourceFromExecutor({ executor: { select }, now }),
      now: nowProvider,
      auditSink,
    });

    expect(result).toEqual({ allowed: false });
    // No record load happened, so no guarded-read event fires; the only event is the
    // opaque system deny decision. A null principal is a clean deny, NOT a resolution
    // failure (the failure category is scoped to exceptions).
    expect(select).not.toHaveBeenCalled();
    expect(
      eventsOfType(auditSink, AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ),
    ).toHaveLength(0);
    expect(
      eventsOfType(auditSink, AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE),
    ).toHaveLength(0);
    const decisionEvents = eventsOfType(
      auditSink,
      AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION,
    );
    expect(decisionEvents).toHaveLength(1);
    const event = decisionEvents[0];
    expect(event.actorRoleContext).toBe(AUTH_RLS_AUDIT_ROLE_CONTEXTS.SYSTEM);
    expect(event.actorUserAccountId).toBeNull();
    expectBoundedEmittedEvent(event);
  });

  it("never emits an Explorer or Guide role context across allow and deny paths", async () => {
    const events: AuthRlsAuditEvent[] = [];
    const collect: AuthRlsAuditSink = (event) => events.push(event);

    await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("admin"),
      auditSink: collect,
    });
    await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("guide"),
      auditSink: collect,
    });

    // Each request now emits two events (a guarded read and the access decision), so
    // four across the allow and deny calls. Every one carries only admin/system.
    expect(events).toHaveLength(4);
    for (const event of events) {
      expect(["admin", "system"]).toContain(event.actorRoleContext);
      expect(event.actorRoleContext).not.toBe("explorer");
      expect(event.actorRoleContext).not.toBe("guide");
      expectBoundedEmittedEvent(event);
    }
  });

  it("fails closed (deny, opaque) when an injected sink throws", async () => {
    const throwingSink: AuthRlsAuditSink = () => {
      throw new Error("audit sink failure that must not leak or allow");
    };

    const { result } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("admin"),
      auditSink: throwingSink,
    });

    // A throwing sink must never flip a deny into an allow or leak detail: it is
    // caught and denies (the safe MVP0 interim posture).
    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
  });
});

describe("resolveAdminAccessForRequest - guarded service-role read seam", () => {
  it("emits exactly one bounded guarded-read event when a service-role read happens (admin allow)", async () => {
    const auditSink = vi.fn();

    const { result } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("admin"),
      auditSink,
    });

    expect(result).toEqual({ allowed: true });
    const reads = eventsOfType(
      auditSink,
      AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ,
    );
    expect(reads).toHaveLength(1);
    const read = reads[0];
    // Admin boundary context, and no account id yet (the read precedes record load),
    // per the createGuardedServiceRoleReadEvent contract.
    expect(read.actorRoleContext).toBe(AUTH_RLS_AUDIT_ROLE_CONTEXTS.ADMIN);
    expect(read.actorUserAccountId).toBeNull();
    expect(read.reasonCode).toBe(AUTH_RLS_AUDIT_REASON_CODES.GUARDED_READ);
    expect(read.eventSummary).toBe(
      AUTH_RLS_AUDIT_EVENT_SUMMARIES.GUARDED_SERVICE_ROLE_READ,
    );
    expect(read.targetEntityType).toBe(AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE);
    expectBoundedEmittedEvent(read);
  });

  it("emits the guarded-read with admin/system context only for a verified non-Admin (never guide/explorer)", async () => {
    // The read fires before the active role is known, so a guide principal still
    // yields a guarded-read carrying only the admin boundary context and a null
    // account id; no guide/explorer identity is ever attributed (req 5).
    const auditSink = vi.fn();

    const { result } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("guide"),
      auditSink,
    });

    expect(result).toEqual({ allowed: false });
    const reads = eventsOfType(
      auditSink,
      AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ,
    );
    expect(reads).toHaveLength(1);
    expect(["admin", "system"]).toContain(reads[0].actorRoleContext);
    expect(reads[0].actorRoleContext).not.toBe("guide");
    expect(reads[0].actorRoleContext).not.toBe("explorer");
    expect(reads[0].actorUserAccountId).toBeNull();
    expectBoundedEmittedEvent(reads[0]);
  });

  it("emits NO guarded-read event when the principal is null (no service-role read happens)", async () => {
    const auditSink = vi.fn();
    const select = vi.fn();

    const result = await resolveAdminAccessForRequest({
      cookies: cookies(),
      createPrincipalSource: () =>
        createInMemoryRequestAuthPrincipalSource(null),
      createAuthSource: ({ now }) =>
        createAdminAuthSourceFromExecutor({ executor: { select }, now }),
      now: nowProvider,
      auditSink,
    });

    expect(result).toEqual({ allowed: false });
    expect(select).not.toHaveBeenCalled();
    expect(
      eventsOfType(auditSink, AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ),
    ).toHaveLength(0);
  });

  it("fails closed (deny, opaque, no rethrow) when the sink throws on the guarded-read event", async () => {
    // A sink that throws only on the guarded-read event. The read seam fires inside
    // composeRequestAuthContext, so the throw is swallowed into the opaque denial and
    // the outward result is still exactly { allowed: false }.
    const auditSink = vi.fn((event: AuthRlsAuditEvent) => {
      if (
        event.eventType === AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ
      ) {
        throw new Error("guarded-read sink failure that must not leak or allow");
      }
    });

    const { result } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("admin"),
      auditSink,
    });

    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
  });
});

describe("resolveAdminAccessForRequest - auth resolution failure seam", () => {
  it("emits exactly one bounded auth-resolution-failure event when the principal source throws, then denies", async () => {
    // A principal source that REJECTS (a resolution exception) is swallowed inside
    // composeRequestAuthContext, which signals the value-free onAuthResolutionFailure
    // seam; this boundary bridges it to a bounded failure event.
    const auditSink = vi.fn();

    const { result } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      auditSink,
      principalSourceFactory: () => ({
        resolveAuthenticatedUser: () =>
          Promise.reject(
            new Error("token-bearing resolution failure that must not leak"),
          ),
      }),
    });

    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
    const failures = eventsOfType(
      auditSink,
      AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE,
    );
    expect(failures).toHaveLength(1);
    const failure = failures[0];
    expect(failure.actorRoleContext).toBe(AUTH_RLS_AUDIT_ROLE_CONTEXTS.SYSTEM);
    expect(failure.actorUserAccountId).toBeNull();
    expect(failure.reasonCode).toBe(AUTH_RLS_AUDIT_REASON_CODES.AUTH_UNRESOLVED);
    expect(failure.eventSummary).toBe(
      AUTH_RLS_AUDIT_EVENT_SUMMARIES.AUTH_RESOLUTION_FAILED,
    );
    expect(failure.actorRoleContext).not.toBe("guide");
    expect(failure.actorRoleContext).not.toBe("explorer");
    expectBoundedEmittedEvent(failure);
    // No service-role read happened: resolution threw before the read seam.
    expect(
      eventsOfType(auditSink, AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ),
    ).toHaveLength(0);
  });

  it("emits exactly one auth-resolution-failure event when a construction factory throws, then denies", async () => {
    // A missing service-role env throws at auth-source construction in the request
    // path; this module's own fail-closed catch records the failure and denies.
    const auditSink = vi.fn();

    const { result } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      auditSink,
      authSourceFactory: () => {
        throw new Error(
          "SolMind server configuration error: missing service-role env",
        );
      },
    });

    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
    expect(
      eventsOfType(auditSink, AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE),
    ).toHaveLength(1);
  });

  it("fails closed (deny, opaque, no rethrow) when the sink itself throws on the failure event", async () => {
    // The construction factory throws AND the sink throws on every event: the inner
    // guard in the fail-closed catch swallows the sink throw, so the request still
    // returns exactly { allowed: false } and never rethrows.
    const throwingSink: AuthRlsAuditSink = () => {
      throw new Error("audit sink failure that must not leak or allow");
    };

    const { result } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      auditSink: throwingSink,
      authSourceFactory: () => {
        throw new Error(
          "SolMind server configuration error: missing service-role env",
        );
      },
    });

    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
  });

  it("still fails closed and emits only bounded events when an inner failure was emitted and the later decision sink throws", async () => {
    // Edge case (documented, not de-duplicated): the principal source REJECTS, so the
    // inner onAuthResolutionFailure bridge emits a bounded failure event; the DECISION
    // sink then throws, routing into this module's own fail-closed catch, which emits a
    // second bounded failure event. The request must still return exactly
    // { allowed: false } and never rethrow. De-duplication is intentionally NOT
    // required here (the future audit-writer slice decides duplicate-failure policy);
    // only bounded, no-leak, fail-closed behavior is asserted.
    const DECISION_SINK_SECRET = "decision-sink failure that must not leak";
    const INNER_RESOLUTION_SECRET = "inner resolution failure that must not leak";
    const auditSink = vi.fn((event: AuthRlsAuditEvent) => {
      if (
        event.eventType === AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION
      ) {
        throw new Error(DECISION_SINK_SECRET);
      }
    });

    const { result } = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      auditSink,
      principalSourceFactory: () => ({
        resolveAuthenticatedUser: () =>
          Promise.reject(new Error(INNER_RESOLUTION_SECRET)),
      }),
    });

    // Fails closed and opaque despite the inner failure plus the throwing decision sink.
    expect(result).toEqual({ allowed: false });
    expectOpaque(result);

    // At least one bounded auth-resolution-failure event was emitted. Current behavior
    // emits two (the inner bridge and this module's catch); the assertion does not
    // require de-duplication so a future writer-slice refinement stays compatible.
    const failures = eventsOfType(
      auditSink,
      AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE,
    );
    expect(failures.length).toBeGreaterThanOrEqual(1);

    // Every emitted event stays bounded (closed key set, admin/system role only, no
    // free-form content), and no raw error, role, account, or relationship detail
    // leaks into any event.
    const all = emittedEvents(auditSink);
    for (const event of all) {
      expectBoundedEmittedEvent(event);
      expect(["admin", "system"]).toContain(event.actorRoleContext);
      expect(event.actorRoleContext).not.toBe("guide");
      expect(event.actorRoleContext).not.toBe("explorer");
    }
    const serialized = JSON.stringify(all);
    expect(serialized).not.toContain(DECISION_SINK_SECRET);
    expect(serialized).not.toContain(INNER_RESOLUTION_SECRET);
  });
});
