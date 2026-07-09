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
  AUTH_RLS_AUDIT_EVENT_TYPES,
  type AuthRlsAuditEvent,
  type AuthRlsAuditSink,
} from "../authRlsAuditEvent";
import { createAdminAuthSourceFromExecutor } from "../../supabase/adminAuthSource";
import {
  type SupabaseQueryResult,
  type SupabaseQuerySpec,
} from "../../supabase/supabaseAuthQueryClient";

// AUD-2 async awaited sink behavior (Doc 22 Section 11; carry-forward H2): every
// emission site must be async-safe. These tests prove, with a REJECTING async sink
// and a SLOW async sink, that a rejection is handled exactly like a synchronous
// throw (fail closed, no unhandled rejection, no leak) and that the outward result
// -- including an allow -- never resolves before an awaited emission settles. The
// banked sync-sink suites (adminAccessRequest.test.ts) continue to cover the
// synchronous behavior unchanged.

const NOW = new Date("2026-07-09T12:00:00.000Z");
const FUTURE = "2026-07-09T13:00:00.000Z";

const PROVIDER_NAME = "supabase";
const PROVIDER_USER_ID = "auth-admin-1";
const ACCOUNT_ID = "user-admin-1";

const ADMIN_PRINCIPAL: SupabaseAuthenticatedUser = {
  providerName: PROVIDER_NAME,
  providerUserId: PROVIDER_USER_ID,
};

function nowProvider(): Date {
  return NOW;
}

function cookies(): RequestCookieAccessor {
  return createInMemoryRequestCookieAccessor();
}

// A deterministic mock scoped-select executor keyed by table (no network/DB/env),
// mirroring the banked adminAccessRequest.test.ts double.
function mockExecutor(resultByTable: Record<string, SupabaseQueryResult>) {
  return {
    select(spec: SupabaseQuerySpec): Promise<SupabaseQueryResult> {
      return Promise.resolve(
        resultByTable[spec.table] ?? { data: [], error: null },
      );
    },
  };
}

// A full, valid identity->session->role chain for the given role.
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

function callHelperWith(args: {
  principal: SupabaseAuthenticatedUser | null;
  resultByTable?: Record<string, SupabaseQueryResult>;
  principalSourceFactory?: () => SolMindRequestAuthPrincipalSource;
  authSourceFactory?: (args: { now: () => Date }) => SolMindAuthSource;
  auditSink?: AuthRlsAuditSink;
}): Promise<AdminAccessResult> {
  const executor = mockExecutor(args.resultByTable ?? chainTables("admin"));

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
  });
}

function expectOpaque(result: AdminAccessResult): void {
  expect(Object.keys(result)).toEqual(["allowed"]);
}

// A sink that rejects asynchronously only for the given event type, resolving for
// every other event. The rejection carries a marker string that must never leak.
function rejectingSinkFor(eventType: string): AuthRlsAuditSink {
  return (event: AuthRlsAuditEvent) =>
    event.eventType === eventType
      ? Promise.reject(
          new Error("async sink rejection that must not leak or allow"),
        )
      : Promise.resolve();
}

describe("resolveAdminAccessForRequest - async rejecting sink (fail closed, no unhandled rejection)", () => {
  it("denies a would-be allow when the async sink rejects on the DECISION event", async () => {
    const result = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("admin"),
      auditSink: rejectingSinkFor(
        AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION,
      ),
    });

    // The awaited rejection is handled exactly like the banked throwing-sink case:
    // fail closed, opaque, no rethrow, no unhandled rejection.
    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
  });

  it("denies when the async sink rejects on the bridged GUARDED-READ event", async () => {
    const events: AuthRlsAuditEvent[] = [];
    const auditSink: AuthRlsAuditSink = (event) => {
      events.push(event);
      return event.eventType ===
        AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ
        ? Promise.reject(
            new Error("guarded-read sink rejection that must not leak"),
          )
        : Promise.resolve();
    };

    const result = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("admin"),
      auditSink,
    });

    // The rejection lands in the composer's fail-closed catch (deny) and the
    // failure seam bridges a bounded auth-resolution-failure event.
    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
    expect(
      events.filter(
        (event) =>
          event.eventType === AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE,
      ).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("keeps an already-denied outcome denied when the async sink rejects on the deny decision", async () => {
    // Best-effort posture direction: a rejecting sink can never change an outcome
    // to allow. Under the MVP0 interim the deny stays a deny.
    const result = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("guide"),
      auditSink: rejectingSinkFor(
        AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION,
      ),
    });

    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
  });

  it("still denies (no rethrow, no unhandled rejection) when the request path throws AND the failure-event sink rejects", async () => {
    // The auth-source factory throws, routing into the module's fail-closed catch;
    // the awaited failure emission then rejects and is swallowed by the inner guard.
    const auditSink: AuthRlsAuditSink = () =>
      Promise.reject(new Error("sink rejection on every event"));

    const result = await callHelperWith({
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
  });
});

describe("resolveAdminAccessForRequest - slow awaited sink ordering (allow never outruns the audit write)", () => {
  it("does not resolve the outward allow before the awaited decision emission settles", async () => {
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    const decisionEmissions = vi.fn();

    // The sink is slow ONLY on the decision event: it returns a promise that stays
    // pending until the test releases it.
    const auditSink: AuthRlsAuditSink = (event) => {
      if (
        event.eventType === AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION
      ) {
        decisionEmissions(event);
        return gate;
      }
      return Promise.resolve();
    };

    let settled = false;
    const pending = callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("admin"),
      auditSink,
    }).then((result) => {
      settled = true;
      return result;
    });

    // Drain the microtask and macrotask queues: everything except the gated sink
    // has had every opportunity to finish. The outward result must still be
    // unsettled, proving the allow is blocked on the awaited audit emission.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(decisionEmissions).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);

    releaseGate();
    const result = await pending;

    expect(settled).toBe(true);
    expect(result).toEqual({ allowed: true });
  });
});
