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
import { AUTH_RLS_AUDIT_EVENT_TYPES } from "../authRlsAuditEvent";
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

// AUD-3 audit-persistence behavior at the /admin/access composition boundary
// (AUTH-RLS-DEC-029/030; Doc 22 Sections 10-12 families 4 and 6):
//   - allow-path ordering and the two induced-failure cases (guarded-read write
//     failure denies with no allow row; allow-decision write failure denies and
//     leaves exactly one truthful residual guarded-read row);
//   - best-effort deny/failure classes never change an already-denied outcome;
//   - an audit-write failure is handled as a RESULT and never becomes a false
//     auth_resolution_failure row;
//   - the outward allow never resolves before an awaited persist settles;
//   - the bounded, value-free operational signal fires per failed persist attempt
//     and is itself guarded (a throwing signal changes nothing).
// The banked writer/executor unit suites cover the writer internals; this file
// covers the composition boundary over deterministic writer doubles (no IO).

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

// Recording writer double with per-envelope induced failure (honors the
// never-throwing writer contract).
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

function callHelperWith(args: {
  principal: SupabaseAuthenticatedUser | null;
  resultByTable?: Record<string, SupabaseQueryResult>;
  principalSourceFactory?: () => SolMindRequestAuthPrincipalSource;
  authSourceFactory?: (args: { now: () => Date }) => SolMindAuthSource;
  auditWriter?: AuthRlsAuditEventWriter;
  createAuditEventWriter?: () => AuthRlsAuditEventWriter;
  onAuditWriteFailure?: () => void;
}): Promise<AdminAccessResult> {
  const executor = mockExecutor(args.resultByTable ?? chainTables("admin"));

  const createPrincipalSource =
    args.principalSourceFactory ??
    (() => createInMemoryRequestAuthPrincipalSource(args.principal));

  const createAuthSource =
    args.authSourceFactory ??
    (({ now }: { now: () => Date }) =>
      createAdminAuthSourceFromExecutor({ executor, now }));

  const createAuditEventWriter =
    args.createAuditEventWriter ??
    (args.auditWriter === undefined
      ? undefined
      : () => args.auditWriter as AuthRlsAuditEventWriter);

  return resolveAdminAccessForRequest({
    cookies: cookies(),
    createPrincipalSource,
    createAuthSource,
    now: nowProvider,
    createAuditEventWriter,
    onAuditWriteFailure: args.onAuditWriteFailure,
  });
}

function expectOpaque(result: AdminAccessResult): void {
  expect(Object.keys(result)).toEqual(["allowed"]);
}

describe("allow-path induced audit-write failures (AUTH-RLS-DEC-030, Doc 22 family 6)", () => {
  it("denies a would-be allow when the guarded-read write fails, writing NO allow, deny, or failure row", async () => {
    const onAuditWriteFailure = vi.fn();
    const { events, writer } = recordingAuditWriter({
      failFor: (event) =>
        event.eventType === AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ,
    });

    const result = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("admin"),
      auditWriter: writer,
      onAuditWriteFailure,
    });

    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
    // Exactly ONE persist attempt (the failed guarded read): no allow decision row,
    // no substitute opaque deny row, and no false auth_resolution_failure row.
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(
      AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ,
    );
    expect(
      eventsOfType(events, AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE),
    ).toHaveLength(0);
    expect(onAuditWriteFailure).toHaveBeenCalledTimes(1);
  });

  it("denies when the allow-decision write fails after the guarded-read persisted, leaving exactly ONE truthful residual guarded-read row", async () => {
    const onAuditWriteFailure = vi.fn();
    const { events, writer } = recordingAuditWriter({
      failFor: (event) =>
        event.eventType ===
          AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION &&
        event.action === AUTH_RLS_AUDIT_ACTIONS.ALLOW,
    });

    const result = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("admin"),
      auditWriter: writer,
      onAuditWriteFailure,
    });

    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
    // Exactly TWO attempts: the persisted guarded read (the accepted truthful
    // residual row, actor-resolved -- not false attribution) and the failed allow
    // decision. No third row of any kind is written for the induced deny.
    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe(
      AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ,
    );
    expect(events[0].actorUserAccountId).toBe(ACCOUNT_ID);
    expect(events[1].eventType).toBe(
      AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION,
    );
    expect(events[1].action).toBe(AUTH_RLS_AUDIT_ACTIONS.ALLOW);
    expect(
      eventsOfType(events, AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE),
    ).toHaveLength(0);
    expect(onAuditWriteFailure).toHaveBeenCalledTimes(1);
  });

  it("denies a would-be allow when an injected writer FACTORY throws (audit unavailable), with no false failure row", async () => {
    const onAuditWriteFailure = vi.fn();

    const result = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("admin"),
      createAuditEventWriter: () => {
        throw new Error("writer construction failure that must not leak");
      },
      onAuditWriteFailure,
    });

    // Audit persistence is unavailable: the allow path fails closed and the
    // construction failure is NOT recorded as an auth_resolution_failure (there is
    // no writer to record through, and it is not a resolution failure).
    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
    expect(onAuditWriteFailure).toHaveBeenCalledTimes(1);
  });
});

describe("best-effort classes never change an already-denied outcome (Doc 22 Section 10)", () => {
  it("keeps a verified non-Admin deny denied when the deny decision write fails, with no false failure row", async () => {
    const onAuditWriteFailure = vi.fn();
    const { events, writer } = recordingAuditWriter({
      failFor: (event) =>
        event.eventType === AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION,
    });

    const result = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("guide"),
      auditWriter: writer,
      onAuditWriteFailure,
    });

    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
    // One failed best-effort attempt; the outcome is unchanged, the signal fired,
    // and no auth_resolution_failure row was attempted in its place.
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(
      AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION,
    );
    expect(
      eventsOfType(events, AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE),
    ).toHaveLength(0);
    expect(onAuditWriteFailure).toHaveBeenCalledTimes(1);
  });

  it("keeps a genuine resolution failure denied when every audit write fails (failure row and deny row both best-effort)", async () => {
    const onAuditWriteFailure = vi.fn();
    const { events, writer } = recordingAuditWriter({ failFor: () => true });

    const result = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      auditWriter: writer,
      onAuditWriteFailure,
      principalSourceFactory: () => ({
        resolveAuthenticatedUser: () =>
          Promise.reject(
            new Error("token-bearing resolution failure that must not leak"),
          ),
      }),
    });

    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
    // Two best-effort attempts (the bridged failure row, then the opaque deny
    // decision), both failed, both signaled, outcome unchanged, no rethrow.
    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe(
      AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE,
    );
    expect(events[1].eventType).toBe(
      AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION,
    );
    expect(onAuditWriteFailure).toHaveBeenCalledTimes(2);
    // Privacy: the injected error text never reaches a persisted envelope.
    expect(JSON.stringify(events)).not.toContain("token-bearing");
  });

  it("swallows a THROWING operational signal without changing the outcome or writing extra rows", async () => {
    const { events, writer } = recordingAuditWriter({
      failFor: (event) =>
        event.eventType === AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION,
    });

    const result = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("guide"),
      auditWriter: writer,
      onAuditWriteFailure: () => {
        throw new Error("operational signal failure that must not leak or flip");
      },
    });

    // The guarded signal can never flip the deny, rethrow, or route into the
    // fail-closed catch (which would mint a false failure row).
    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
    expect(events).toHaveLength(1);
    expect(
      eventsOfType(events, AUTH_RLS_AUDIT_EVENT_TYPES.AUTH_RESOLUTION_FAILURE),
    ).toHaveLength(0);
  });
});

describe("contract-violating writers are handled as write failures, never as resolution failures", () => {
  it("denies a would-be allow when the injected writer THROWS synchronously, with no false failure row", async () => {
    const onAuditWriteFailure = vi.fn();
    const attempted: PersistableAuthRlsAuditEvent[] = [];
    const throwingWriter: AuthRlsAuditEventWriter = {
      persistAuthRlsAuditEvent(event: PersistableAuthRlsAuditEvent) {
        attempted.push(event);
        throw new Error("audit writer throw that must not leak or allow");
      },
    };

    const result = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("admin"),
      auditWriter: throwingWriter,
      onAuditWriteFailure,
    });

    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
    // The throw is contained at the persist call site as a write failure: only the
    // guarded-read attempt exists; the catch never records a failure row for it.
    expect(attempted).toHaveLength(1);
    expect(attempted[0].eventType).toBe(
      AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ,
    );
    expect(onAuditWriteFailure).toHaveBeenCalledTimes(1);
  });

  it("denies a would-be allow when the injected writer REJECTS asynchronously, with no unhandled rejection", async () => {
    const onAuditWriteFailure = vi.fn();
    const attempted: PersistableAuthRlsAuditEvent[] = [];
    const rejectingWriter: AuthRlsAuditEventWriter = {
      persistAuthRlsAuditEvent(event: PersistableAuthRlsAuditEvent) {
        attempted.push(event);
        return Promise.reject(
          new Error("audit writer rejection that must not leak or allow"),
        );
      },
    };

    const result = await callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("admin"),
      auditWriter: rejectingWriter,
      onAuditWriteFailure,
    });

    expect(result).toEqual({ allowed: false });
    expectOpaque(result);
    expect(attempted).toHaveLength(1);
    expect(onAuditWriteFailure).toHaveBeenCalledTimes(1);
  });
});

describe("awaited persistence ordering (an allow never outruns its audit rows)", () => {
  it("does not resolve the outward allow before the awaited allow-decision persist settles", async () => {
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    const events: PersistableAuthRlsAuditEvent[] = [];

    // The writer is slow ONLY on the allow-decision persist: it returns a result
    // promise that stays pending until the test releases it.
    const slowWriter: AuthRlsAuditEventWriter = {
      persistAuthRlsAuditEvent(event: PersistableAuthRlsAuditEvent) {
        events.push(event);
        if (
          event.eventType ===
            AUTH_RLS_AUDIT_EVENT_TYPES.ADMIN_ROUTE_ACCESS_DECISION &&
          event.action === AUTH_RLS_AUDIT_ACTIONS.ALLOW
        ) {
          return gate.then(() => ({
            persisted: true as const,
            auditEventId: "audit-event-allow",
          }));
        }
        return Promise.resolve({
          persisted: true as const,
          auditEventId: `audit-event-${events.length}`,
        });
      },
    };

    let settled = false;
    const pending = callHelperWith({
      principal: ADMIN_PRINCIPAL,
      resultByTable: chainTables("admin"),
      auditWriter: slowWriter,
    }).then((result) => {
      settled = true;
      return result;
    });

    // Drain the microtask and macrotask queues: everything except the gated persist
    // has had every opportunity to finish. The outward result must still be
    // unsettled, proving the allow is blocked on the awaited audit write.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe(
      AUTH_RLS_AUDIT_EVENT_TYPES.GUARDED_SERVICE_ROLE_READ,
    );
    expect(settled).toBe(false);

    releaseGate();
    const result = await pending;

    expect(settled).toBe(true);
    expect(result).toEqual({ allowed: true });
  });
});
