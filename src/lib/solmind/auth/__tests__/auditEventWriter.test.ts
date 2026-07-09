import { describe, expect, it, vi } from "vitest";

import {
  AUDIT_EVENT_UNMAPPABLE_ERROR,
  AUTH_RLS_AUDIT_ACTIONS,
  createAuthRlsAuditEventWriter,
  toPersistableAuthRlsAuditEvent,
  type PersistableAuthRlsAuditEvent,
} from "../auditEventWriter";
import {
  AUTH_RLS_AUDIT_DECISIONS,
  createAdminAccessDecisionEvent,
  createAuthResolutionFailureEvent,
  createGuardedServiceRoleReadEvent,
  type AuthRlsAuditEvent,
} from "../authRlsAuditEvent";
import {
  AUDIT_WRITE_FAILED_ERROR,
  AUDIT_WRITE_UNMAPPED_INTENT_ERROR,
  RECORD_AUDIT_EVENT_INTENT,
  type AuditEventWriteExecutor,
  type AuditEventWriteResult,
} from "../../supabase/auditEventWriteExecutor";
import * as authBarrel from "../index";

const ACCOUNT_ID = "user-admin-1";
const AUDIT_EVENT_ID = "0f9be9a6-2f7e-4e64-9f0a-5a1b2c3d4e5f";

// A deterministic executor double: records every write intent and returns a canned
// result. No network, DB, env, or real client is touched.
function fakeExecutor(result: AuditEventWriteResult) {
  const write = vi.fn(() => Promise.resolve(result));
  const executor = { write } as unknown as AuditEventWriteExecutor;
  return { executor, write };
}

function successExecutor() {
  return fakeExecutor({ auditEventId: AUDIT_EVENT_ID, error: null });
}

// The four banked Family A factory events paired with the EXACT named RPC argument
// object each must produce (M3: the action column is derived from the closed
// mapping; the app event carries no action field; metadata is never SQL null).
const MAPPING_CASES: ReadonlyArray<{
  name: string;
  event: AuthRlsAuditEvent;
  action: string;
  args: Record<string, unknown>;
}> = [
  {
    name: "admin_route_access_decision allow",
    event: createAdminAccessDecisionEvent({
      decision: AUTH_RLS_AUDIT_DECISIONS.ALLOW,
      actorUserAccountId: ACCOUNT_ID,
    }),
    action: AUTH_RLS_AUDIT_ACTIONS.ALLOW,
    args: {
      p_event_type: "admin_route_access_decision",
      p_action: "allow",
      p_actor_role_context: "admin",
      p_actor_user_account_id: ACCOUNT_ID,
      p_target_entity_type: "admin_route",
      p_target_entity_id: null,
      p_reason_code: "access_granted",
      p_metadata: { routeId: "admin_route", decision: "allow" },
    },
  },
  {
    name: "admin_route_access_decision deny",
    event: createAdminAccessDecisionEvent({
      decision: AUTH_RLS_AUDIT_DECISIONS.DENY,
    }),
    action: AUTH_RLS_AUDIT_ACTIONS.DENY,
    args: {
      p_event_type: "admin_route_access_decision",
      p_action: "deny",
      p_actor_role_context: "system",
      p_actor_user_account_id: null,
      p_target_entity_type: "admin_route",
      p_target_entity_id: null,
      p_reason_code: "access_denied",
      p_metadata: { routeId: "admin_route", decision: "deny" },
    },
  },
  {
    name: "guarded_service_role_read (post-resolution, non-null actor)",
    event: createGuardedServiceRoleReadEvent({ actorUserAccountId: ACCOUNT_ID }),
    action: AUTH_RLS_AUDIT_ACTIONS.READ,
    args: {
      p_event_type: "guarded_service_role_read",
      p_action: "read",
      p_actor_role_context: "admin",
      p_actor_user_account_id: ACCOUNT_ID,
      p_target_entity_type: "admin_route",
      p_target_entity_id: null,
      p_reason_code: "guarded_read",
      p_metadata: { routeId: "admin_route" },
    },
  },
  {
    name: "auth_resolution_failure",
    event: createAuthResolutionFailureEvent(),
    action: AUTH_RLS_AUDIT_ACTIONS.DENY,
    args: {
      p_event_type: "auth_resolution_failure",
      p_action: "deny",
      p_actor_role_context: "system",
      p_actor_user_account_id: null,
      p_target_entity_type: "admin_route",
      p_target_entity_id: null,
      p_reason_code: "auth_unresolved",
      p_metadata: {},
    },
  },
];

describe("toPersistableAuthRlsAuditEvent - closed mapping and explicit action derivation", () => {
  for (const testCase of MAPPING_CASES) {
    it(`maps the banked ${testCase.name} event and derives action '${testCase.action}'`, () => {
      const envelope = toPersistableAuthRlsAuditEvent(testCase.event);

      expect(envelope).not.toBeNull();
      expect(envelope?.action).toBe(testCase.action);
      expect(envelope?.eventType).toBe(testCase.event.eventType);
    });
  }

  it("refuses a NULL-actor guarded read (AUTH-RLS-DEC-029): the pre-read bridge event is unmappable", () => {
    // The banked pre-read bridge emits the guarded-read event with a structurally
    // unavailable null actor. Persisting it would violate the banked AUD-1
    // non-null actor requirement, so the mapping refuses it and the writer can
    // never send it: a null actor never reaches the guarded-read writer.
    const preReadBridgeEvent = createGuardedServiceRoleReadEvent({
      actorUserAccountId: null,
    });

    expect(toPersistableAuthRlsAuditEvent(preReadBridgeEvent)).toBeNull();
  });

  it.each([
    [
      "an allow decision carrying the system role context",
      {
        ...createAdminAccessDecisionEvent({
          decision: AUTH_RLS_AUDIT_DECISIONS.ALLOW,
          actorUserAccountId: ACCOUNT_ID,
        }),
        actorRoleContext: "system",
      },
    ],
    [
      "an allow decision with a mismatched reason code",
      {
        ...createAdminAccessDecisionEvent({
          decision: AUTH_RLS_AUDIT_DECISIONS.ALLOW,
          actorUserAccountId: ACCOUNT_ID,
        }),
        reasonCode: "access_denied",
      },
    ],
    [
      "an allow decision with an empty-string actor id",
      {
        ...createAdminAccessDecisionEvent({
          decision: AUTH_RLS_AUDIT_DECISIONS.ALLOW,
          actorUserAccountId: ACCOUNT_ID,
        }),
        actorUserAccountId: "",
      },
    ],
    [
      "a deny decision carrying an attributed account id",
      {
        ...createAdminAccessDecisionEvent({
          decision: AUTH_RLS_AUDIT_DECISIONS.DENY,
        }),
        actorUserAccountId: ACCOUNT_ID,
      },
    ],
    [
      "an allow decision whose metadata decision contradicts the outcome",
      {
        ...createAdminAccessDecisionEvent({
          decision: AUTH_RLS_AUDIT_DECISIONS.ALLOW,
          actorUserAccountId: ACCOUNT_ID,
        }),
        metadata: { routeId: "admin_route", decision: "deny" },
      },
    ],
    [
      "a guarded read with an extra metadata key",
      {
        ...createGuardedServiceRoleReadEvent({ actorUserAccountId: ACCOUNT_ID }),
        metadata: { routeId: "admin_route", decision: "allow" },
      },
    ],
    [
      "a guarded read with a wrong routeId value",
      {
        ...createGuardedServiceRoleReadEvent({ actorUserAccountId: ACCOUNT_ID }),
        metadata: { routeId: "guide_route" },
      },
    ],
    [
      "a tampered free-text event summary",
      {
        ...createAdminAccessDecisionEvent({
          decision: AUTH_RLS_AUDIT_DECISIONS.ALLOW,
          actorUserAccountId: ACCOUNT_ID,
        }),
        eventSummary: "free-text summary that must never persist",
      },
    ],
    [
      "an unknown event type",
      {
        ...createAuthResolutionFailureEvent(),
        eventType: "admin_sensitive_access",
      },
    ],
    [
      "a resolution failure carrying unexpected metadata",
      {
        ...createAuthResolutionFailureEvent(),
        metadata: { routeId: "admin_route" },
      },
    ],
  ])(
    "refuses a hand-crafted/tampered event: %s",
    (_name, tampered) => {
      expect(
        toPersistableAuthRlsAuditEvent(tampered as unknown as AuthRlsAuditEvent),
      ).toBeNull();
    },
  );
});

describe("createAuthRlsAuditEventWriter - exact named RPC argument mapping (M3)", () => {
  for (const testCase of MAPPING_CASES) {
    it(`persists the ${testCase.name} event with the exact named args`, async () => {
      const { executor, write } = successExecutor();
      const writer = createAuthRlsAuditEventWriter({ executor });

      const envelope = toPersistableAuthRlsAuditEvent(testCase.event);
      expect(envelope).not.toBeNull();
      const result = await writer.persistAuthRlsAuditEvent(
        envelope as PersistableAuthRlsAuditEvent,
      );

      expect(write).toHaveBeenCalledTimes(1);
      expect(write).toHaveBeenCalledWith({
        intent: RECORD_AUDIT_EVENT_INTENT,
        args: testCase.args,
      });
      expect(result).toEqual({ persisted: true, auditEventId: AUDIT_EVENT_ID });
    });
  }
});

describe("createAuthRlsAuditEventWriter - fail closed with NO RPC call", () => {
  it("refuses a type-cast-forged NULL-actor guarded-read envelope without calling the executor (AUTH-RLS-DEC-029)", async () => {
    const { executor, write } = successExecutor();
    const writer = createAuthRlsAuditEventWriter({ executor });

    // TypeScript types the guarded-read actor as non-null; forge past it to prove
    // the runtime defense-in-depth check also fails closed.
    const forged = {
      eventType: "guarded_service_role_read",
      action: "read",
      actorRoleContext: "admin",
      actorUserAccountId: null,
      targetEntityType: "admin_route",
      reasonCode: "guarded_read",
      metadata: { routeId: "admin_route" },
    } as unknown as PersistableAuthRlsAuditEvent;
    const result = await writer.persistAuthRlsAuditEvent(forged);

    expect(write).not.toHaveBeenCalled();
    expect(result).toEqual({
      persisted: false,
      error: AUDIT_EVENT_UNMAPPABLE_ERROR,
    });
  });

  it.each([
    [
      "an unknown (eventType, action) pair",
      { eventType: "admin_sensitive_access", action: "view" },
    ],
    ["a wrong role context", { actorRoleContext: "guide" }],
    ["an attributed system event", { actorUserAccountId: ACCOUNT_ID }],
    ["a wrong target entity type", { targetEntityType: "guide_route" }],
    ["a mismatched reason code", { reasonCode: "access_denied" }],
    ["unexpected metadata", { metadata: { routeId: "admin_route" } }],
  ])(
    "refuses a forged envelope with %s without calling the executor",
    async (_name, override) => {
      const { executor, write } = successExecutor();
      const writer = createAuthRlsAuditEventWriter({ executor });

      const base = toPersistableAuthRlsAuditEvent(
        createAuthResolutionFailureEvent(),
      );
      expect(base).not.toBeNull();
      const forged = {
        ...(base as PersistableAuthRlsAuditEvent),
        ...override,
      } as unknown as PersistableAuthRlsAuditEvent;
      const result = await writer.persistAuthRlsAuditEvent(forged);

      expect(write).not.toHaveBeenCalled();
      expect(result).toEqual({
        persisted: false,
        error: AUDIT_EVENT_UNMAPPABLE_ERROR,
      });
    },
  );
});

describe("createAuthRlsAuditEventWriter - sentinel passthrough and no-leak behavior", () => {
  it("passes the seam's failed sentinel through unchanged", async () => {
    const { executor } = fakeExecutor({
      auditEventId: null,
      error: AUDIT_WRITE_FAILED_ERROR,
    });
    const writer = createAuthRlsAuditEventWriter({ executor });

    const envelope = toPersistableAuthRlsAuditEvent(
      createAdminAccessDecisionEvent({
        decision: AUTH_RLS_AUDIT_DECISIONS.ALLOW,
        actorUserAccountId: ACCOUNT_ID,
      }),
    );
    const result = await writer.persistAuthRlsAuditEvent(
      envelope as PersistableAuthRlsAuditEvent,
    );

    expect(result).toEqual({
      persisted: false,
      error: AUDIT_WRITE_FAILED_ERROR,
    });
  });

  it("passes the seam's unmapped-intent sentinel through unchanged", async () => {
    const { executor } = fakeExecutor({
      auditEventId: null,
      error: AUDIT_WRITE_UNMAPPED_INTENT_ERROR,
    });
    const writer = createAuthRlsAuditEventWriter({ executor });

    const envelope = toPersistableAuthRlsAuditEvent(
      createAuthResolutionFailureEvent(),
    );
    const result = await writer.persistAuthRlsAuditEvent(
      envelope as PersistableAuthRlsAuditEvent,
    );

    expect(result).toEqual({
      persisted: false,
      error: AUDIT_WRITE_UNMAPPED_INTENT_ERROR,
    });
  });

  it("resolves (never rejects) to the failed sentinel when the executor throws, leaking nothing", async () => {
    const LEAKY = "connection refused at https://project-ref.supabase.co with key sbp_secret";
    const write = vi.fn(() => Promise.reject(new Error(LEAKY)));
    const executor = { write } as unknown as AuditEventWriteExecutor;
    const writer = createAuthRlsAuditEventWriter({ executor });

    const envelope = toPersistableAuthRlsAuditEvent(
      createGuardedServiceRoleReadEvent({ actorUserAccountId: ACCOUNT_ID }),
    );
    const result = await writer.persistAuthRlsAuditEvent(
      envelope as PersistableAuthRlsAuditEvent,
    );

    expect(result).toEqual({
      persisted: false,
      error: AUDIT_WRITE_FAILED_ERROR,
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("supabase.co");
    expect(serialized).not.toContain("sbp_secret");
    expect(serialized).not.toContain("https://");
  });

  it("returns value-free results only: a failure result carries exactly { persisted, error }", async () => {
    const { executor } = fakeExecutor({
      auditEventId: null,
      error: AUDIT_WRITE_FAILED_ERROR,
    });
    const writer = createAuthRlsAuditEventWriter({ executor });

    const envelope = toPersistableAuthRlsAuditEvent(
      createAdminAccessDecisionEvent({
        decision: AUTH_RLS_AUDIT_DECISIONS.ALLOW,
        actorUserAccountId: ACCOUNT_ID,
      }),
    );
    const result = await writer.persistAuthRlsAuditEvent(
      envelope as PersistableAuthRlsAuditEvent,
    );

    expect(Object.keys(result).sort()).toEqual(["error", "persisted"]);
    // The failure result never echoes the event: no account id, no event type.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(ACCOUNT_ID);
    expect(serialized).not.toContain("admin_route_access_decision");
  });
});

describe("auditEventWriter - barrel exposure", () => {
  it("is not exported from the shared auth index barrel", () => {
    // The server-only writer must stay off the shared barrel (AUTH-RLS-DEC-007),
    // mirroring authRlsAuditEvent, adminAccessRequest, and the other server-only
    // modules. Server composition paths import it by direct path only.
    expect("createAuthRlsAuditEventWriter" in authBarrel).toBe(false);
    expect("toPersistableAuthRlsAuditEvent" in authBarrel).toBe(false);
    expect("AUTH_RLS_AUDIT_ACTIONS" in authBarrel).toBe(false);
    expect("AUDIT_EVENT_UNMAPPABLE_ERROR" in authBarrel).toBe(false);
  });
});
