import { describe, expect, it, vi } from "vitest";

import {
  AUTH_RLS_AUDIT_DECISIONS,
  AUTH_RLS_AUDIT_EVENT_SUMMARIES,
  AUTH_RLS_AUDIT_EVENT_TYPES,
  AUTH_RLS_AUDIT_REASON_CODES,
  AUTH_RLS_AUDIT_ROLE_CONTEXTS,
  AUTH_RLS_AUDIT_TARGET_TYPES,
  NOOP_AUTH_RLS_AUDIT_SINK,
  createAdminAccessDecisionEvent,
  createAuthResolutionFailureEvent,
  createGuardedServiceRoleReadEvent,
  noopAuthRlsAuditSink,
  type AuthRlsAuditEvent,
} from "../authRlsAuditEvent";
import * as authBarrel from "../index";

// The bounded vocabularies a safe Auth/RLS audit event may draw each field from.
// The shaping tests assert that every produced field stays inside these closed
// sets, so a factory can never introduce free-form, content-bearing, or
// secret-bearing values (Doc 16 sections 7-8).
const ALLOWED_EVENT_TYPES = Object.values(AUTH_RLS_AUDIT_EVENT_TYPES);
const ALLOWED_ROLE_CONTEXTS = Object.values(AUTH_RLS_AUDIT_ROLE_CONTEXTS);
const ALLOWED_TARGET_TYPES = Object.values(AUTH_RLS_AUDIT_TARGET_TYPES);
const ALLOWED_REASON_CODES = Object.values(AUTH_RLS_AUDIT_REASON_CODES);
const ALLOWED_SUMMARIES = Object.values(AUTH_RLS_AUDIT_EVENT_SUMMARIES);
const ALLOWED_DECISIONS = Object.values(AUTH_RLS_AUDIT_DECISIONS);

// The exact, complete set of keys a bounded event may carry. Asserting the key
// set is closed proves no stray field (a content/secret carrier) was added.
const ALLOWED_EVENT_KEYS = [
  "actorRoleContext",
  "actorUserAccountId",
  "eventSummary",
  "eventType",
  "metadata",
  "reasonCode",
  "targetEntityType",
].sort();

const ALLOWED_METADATA_KEYS = ["decision", "routeId"];

// Assert that a produced event uses only bounded, non-sensitive values and only
// the permitted keys. This is the structural privacy guarantee from Doc 16.
function expectBoundedEvent(event: AuthRlsAuditEvent): void {
  const keys = Object.keys(event)
    .filter((key) => key !== "metadata" || event.metadata !== undefined)
    .sort();
  // Every key present must be one of the allowed event keys (no stray fields).
  for (const key of keys) {
    expect(ALLOWED_EVENT_KEYS).toContain(key);
  }

  expect(ALLOWED_EVENT_TYPES).toContain(event.eventType);
  expect(ALLOWED_ROLE_CONTEXTS).toContain(event.actorRoleContext);
  expect(ALLOWED_TARGET_TYPES).toContain(event.targetEntityType);
  expect(ALLOWED_REASON_CODES).toContain(event.reasonCode);
  expect(ALLOWED_SUMMARIES).toContain(event.eventSummary);

  // actorUserAccountId is either null or a plain string id (never an object that
  // could smuggle a record body).
  if (event.actorUserAccountId !== null) {
    expect(typeof event.actorUserAccountId).toBe("string");
  }

  if (event.metadata !== undefined) {
    for (const key of Object.keys(event.metadata)) {
      expect(ALLOWED_METADATA_KEYS).toContain(key);
    }
    if (event.metadata.routeId !== undefined) {
      expect(ALLOWED_TARGET_TYPES).toContain(event.metadata.routeId);
    }
    if (event.metadata.decision !== undefined) {
      expect(ALLOWED_DECISIONS).toContain(event.metadata.decision);
    }
  }
}

describe("authRlsAuditEvent - default-off / no-op sink", () => {
  it("the no-op sink persists nothing, returns nothing, and does not throw", () => {
    const event = createAuthResolutionFailureEvent();

    // Calling the no-op sink has no observable effect and yields undefined.
    expect(noopAuthRlsAuditSink()).toBeUndefined();
    expect(() => NOOP_AUTH_RLS_AUDIT_SINK(event)).not.toThrow();
    expect(NOOP_AUTH_RLS_AUDIT_SINK(event)).toBeUndefined();
  });

  it("the shared no-op sink is the named no-op function (seam is default-off)", () => {
    expect(NOOP_AUTH_RLS_AUDIT_SINK).toBe(noopAuthRlsAuditSink);
  });

  it("the module exposes no real writer, persistence, or sink-construction API", () => {
    // Safe-by-default means the only sink shipped here is the no-op. A future
    // slice adds the real writer; this guards against one slipping in early.
    const moduleApi = {
      createAdminAccessDecisionEvent,
      createAuthResolutionFailureEvent,
      createGuardedServiceRoleReadEvent,
      noopAuthRlsAuditSink,
      NOOP_AUTH_RLS_AUDIT_SINK,
    };
    const exportedNames = Object.keys(moduleApi);
    const writerLike = exportedNames.filter((name) =>
      /writer|persist|insert|sink|store|save|flush/i.test(name),
    );
    // The only sink-like export is the default-off no-op sink.
    expect(writerLike.sort()).toEqual(
      ["NOOP_AUTH_RLS_AUDIT_SINK", "noopAuthRlsAuditSink"].sort(),
    );
  });

  it("an injected sink is called with the exact event, proving the seam is wire-ready", () => {
    // The seam is default-off, but a future slice will inject a real sink. Prove
    // the contract: a sink receives the bounded event verbatim and nothing else.
    const sink = vi.fn();
    const event = createGuardedServiceRoleReadEvent({
      actorUserAccountId: "user-admin-1",
    });

    sink(event);

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith(event);
  });
});

describe("authRlsAuditEvent - admin access decision shaping", () => {
  it("shapes an allow decision as an admin-attributed, bounded event", () => {
    const event = createAdminAccessDecisionEvent({
      decision: AUTH_RLS_AUDIT_DECISIONS.ALLOW,
      actorUserAccountId: "user-admin-1",
    });

    expect(event).toEqual({
      eventType: AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION,
      actorRoleContext: AUTH_RLS_AUDIT_ROLE_CONTEXTS.ADMIN,
      actorUserAccountId: "user-admin-1",
      targetEntityType: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
      reasonCode: AUTH_RLS_AUDIT_REASON_CODES.ACCESS_GRANTED,
      eventSummary: AUTH_RLS_AUDIT_EVENT_SUMMARIES.ADMIN_ACCESS_ALLOWED,
      metadata: {
        routeId: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
        decision: AUTH_RLS_AUDIT_DECISIONS.ALLOW,
      },
    });
    expectBoundedEvent(event);
  });

  it("shapes a deny decision opaquely: system role, no account id attributed", () => {
    const event = createAdminAccessDecisionEvent({
      decision: AUTH_RLS_AUDIT_DECISIONS.DENY,
    });

    // A deny never attributes an identity: role is system and the account id is
    // null, so a denied Explorer/Guide is never carried into the event.
    expect(event.actorRoleContext).toBe(AUTH_RLS_AUDIT_ROLE_CONTEXTS.SYSTEM);
    expect(event.actorUserAccountId).toBeNull();
    expect(event.reasonCode).toBe(AUTH_RLS_AUDIT_REASON_CODES.ACCESS_DENIED);
    expect(event.eventSummary).toBe(
      AUTH_RLS_AUDIT_EVENT_SUMMARIES.ADMIN_ACCESS_DENIED,
    );
    expect(event.metadata).toEqual({
      routeId: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
      decision: AUTH_RLS_AUDIT_DECISIONS.DENY,
    });
    expectBoundedEvent(event);
  });
});

describe("authRlsAuditEvent - guarded service-role read shaping", () => {
  it("shapes a guarded read with a known admin account id", () => {
    const event = createGuardedServiceRoleReadEvent({
      actorUserAccountId: "user-admin-1",
    });

    expect(event.eventType).toBe(
      AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ,
    );
    expect(event.actorRoleContext).toBe(AUTH_RLS_AUDIT_ROLE_CONTEXTS.ADMIN);
    expect(event.actorUserAccountId).toBe("user-admin-1");
    expect(event.reasonCode).toBe(AUTH_RLS_AUDIT_REASON_CODES.GUARDED_READ);
    expectBoundedEvent(event);
  });

  it("allows a null account id when it is not yet known at the read seam", () => {
    const event = createGuardedServiceRoleReadEvent({
      actorUserAccountId: null,
    });

    expect(event.actorUserAccountId).toBeNull();
    expect(event.actorRoleContext).toBe(AUTH_RLS_AUDIT_ROLE_CONTEXTS.ADMIN);
    expectBoundedEvent(event);
  });
});

describe("authRlsAuditEvent - auth resolution failure shaping", () => {
  it("shapes a generic system security event with no principal or detail", () => {
    const event = createAuthResolutionFailureEvent();

    expect(event).toEqual({
      eventType: AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE,
      actorRoleContext: AUTH_RLS_AUDIT_ROLE_CONTEXTS.SYSTEM,
      actorUserAccountId: null,
      targetEntityType: AUTH_RLS_AUDIT_TARGET_TYPES.ADMIN_ROUTE,
      reasonCode: AUTH_RLS_AUDIT_REASON_CODES.AUTH_UNRESOLVED,
      eventSummary: AUTH_RLS_AUDIT_EVENT_SUMMARIES.AUTH_RESOLUTION_FAILED,
    });
    // No metadata is attached: there is nothing bounded to add and nothing
    // sensitive is ever recorded.
    expect(event.metadata).toBeUndefined();
    expectBoundedEvent(event);
  });
});

describe("authRlsAuditEvent - prohibited-payload safety", () => {
  it("every factory produces only bounded, non-sensitive, closed-key-set events", () => {
    const events: AuthRlsAuditEvent[] = [
      createAdminAccessDecisionEvent({
        decision: AUTH_RLS_AUDIT_DECISIONS.ALLOW,
        actorUserAccountId: "user-admin-1",
      }),
      createAdminAccessDecisionEvent({ decision: AUTH_RLS_AUDIT_DECISIONS.DENY }),
      createGuardedServiceRoleReadEvent({ actorUserAccountId: "user-admin-1" }),
      createGuardedServiceRoleReadEvent({ actorUserAccountId: null }),
      createAuthResolutionFailureEvent(),
    ];

    for (const event of events) {
      expectBoundedEvent(event);
    }
  });

  it("never emits the Explorer or Guide role context (role separation preserved)", () => {
    const events: AuthRlsAuditEvent[] = [
      createAdminAccessDecisionEvent({
        decision: AUTH_RLS_AUDIT_DECISIONS.ALLOW,
        actorUserAccountId: "user-admin-1",
      }),
      createAdminAccessDecisionEvent({ decision: AUTH_RLS_AUDIT_DECISIONS.DENY }),
      createGuardedServiceRoleReadEvent({ actorUserAccountId: "user-admin-1" }),
      createAuthResolutionFailureEvent(),
    ];

    for (const event of events) {
      expect(["admin", "system"]).toContain(event.actorRoleContext);
      expect(event.actorRoleContext).not.toBe("explorer");
      expect(event.actorRoleContext).not.toBe("guide");
    }
  });
});

describe("authRlsAuditEvent - barrel exposure", () => {
  it("is not exported from the shared auth index barrel", () => {
    // The server-only audit seam must stay off the shared barrel, mirroring
    // composeRequestAuthContext, adminRouteAccess, and serviceRoleClient.
    expect("createAdminAccessDecisionEvent" in authBarrel).toBe(false);
    expect("NOOP_AUTH_RLS_AUDIT_SINK" in authBarrel).toBe(false);
    expect("noopAuthRlsAuditSink" in authBarrel).toBe(false);
  });
});
