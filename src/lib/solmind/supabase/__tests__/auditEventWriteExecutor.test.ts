import { describe, expect, it, vi } from "vitest";

import {
  AUDIT_WRITE_FAILED_ERROR,
  AUDIT_WRITE_UNMAPPED_INTENT_ERROR,
  RECORD_AUDIT_EVENT_INTENT,
  createAuditEventWriteExecutor,
  type AuditEventWriteIntent,
  type SolmindRecordAuditEventArgs,
} from "../auditEventWriteExecutor";
import * as supabaseBarrel from "../index";

// Build a fake service-role Supabase client whose .rpc(fn, args) records every call
// and returns a canned response. Only .rpc is exercised by the seam, so no network,
// DB, env, or real client is touched. Cast through the executor's own parameter type
// to avoid importing the full client.
function fakeClient(response: { data: unknown; error: unknown }) {
  const rpc = vi.fn(() => Promise.resolve(response));
  const client = { rpc } as unknown as Parameters<
    typeof createAuditEventWriteExecutor
  >[0];
  return { client, rpc };
}

const AUDIT_EVENT_ID = "0f9be9a6-2f7e-4e64-9f0a-5a1b2c3d4e5f";
const ACCOUNT_ID = "user-admin-1";

// Exact named args for the two actor shapes the AUD-1 function accepts: an
// admin-context row with a non-null actor, and a system-context row with a null
// actor and empty metadata. These mirror what the AUD-2 writer builds.
const ALLOW_ARGS: SolmindRecordAuditEventArgs = {
  p_event_type: "admin_route_access_decision",
  p_action: "allow",
  p_actor_role_context: "admin",
  p_actor_user_account_id: ACCOUNT_ID,
  p_target_entity_type: "admin_route",
  p_target_entity_id: null,
  p_reason_code: "access_granted",
  p_metadata: { routeId: "admin_route", decision: "allow" },
};

const FAILURE_ARGS: SolmindRecordAuditEventArgs = {
  p_event_type: "auth_resolution_failure",
  p_action: "deny",
  p_actor_role_context: "system",
  p_actor_user_account_id: null,
  p_target_entity_type: "admin_route",
  p_target_entity_id: null,
  p_reason_code: "auth_unresolved",
  p_metadata: {},
};

function intentWith(args: SolmindRecordAuditEventArgs): AuditEventWriteIntent {
  return {
    intent: RECORD_AUDIT_EVENT_INTENT,
    args: { ...args, p_metadata: { ...args.p_metadata } },
  };
}

describe("createAuditEventWriteExecutor dispatch", () => {
  it("dispatches the single approved intent to solmind_record_audit_event with the exact named args", async () => {
    const { client, rpc } = fakeClient({
      data: [{ audit_event_id: AUDIT_EVENT_ID }],
      error: null,
    });
    const executor = createAuditEventWriteExecutor(client);

    const result = await executor.write(intentWith(ALLOW_ARGS));

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("solmind_record_audit_event", ALLOW_ARGS);
    expect(result).toEqual({ auditEventId: AUDIT_EVENT_ID, error: null });
  });

  it("dispatches a system-context intent (null actor, empty metadata object) unchanged", async () => {
    // The null actor id and the EMPTY (never SQL-null) metadata object must be
    // passed explicitly: the seam never relies on SQL parameter defaults.
    const { client, rpc } = fakeClient({
      data: [{ audit_event_id: AUDIT_EVENT_ID }],
      error: null,
    });
    const executor = createAuditEventWriteExecutor(client);

    const result = await executor.write(intentWith(FAILURE_ARGS));

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("solmind_record_audit_event", FAILURE_ARGS);
    expect(result).toEqual({ auditEventId: AUDIT_EVENT_ID, error: null });
  });
});

describe("createAuditEventWriteExecutor fail-closed before .rpc (unmapped intent / missing argument)", () => {
  it("fails closed on an unknown intent without calling .rpc", async () => {
    const { client, rpc } = fakeClient({
      data: [{ audit_event_id: AUDIT_EVENT_ID }],
      error: null,
    });
    const executor = createAuditEventWriteExecutor(client);

    const forged = {
      intent: "record_anything_else",
      args: { ...ALLOW_ARGS },
    } as unknown as AuditEventWriteIntent;
    const result = await executor.write(forged);

    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({
      auditEventId: null,
      error: AUDIT_WRITE_UNMAPPED_INTENT_ERROR,
    });
  });

  it("fails closed when a required named argument is missing, without calling .rpc", async () => {
    const { client, rpc } = fakeClient({
      data: [{ audit_event_id: AUDIT_EVENT_ID }],
      error: null,
    });
    const executor = createAuditEventWriteExecutor(client);

    const args: Record<string, unknown> = { ...ALLOW_ARGS };
    delete args.p_reason_code;
    const forged = {
      intent: RECORD_AUDIT_EVENT_INTENT,
      args,
    } as unknown as AuditEventWriteIntent;
    const result = await executor.write(forged);

    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({
      auditEventId: null,
      error: AUDIT_WRITE_UNMAPPED_INTENT_ERROR,
    });
  });

  it("fails closed on an extra named argument, without calling .rpc", async () => {
    const { client, rpc } = fakeClient({
      data: [{ audit_event_id: AUDIT_EVENT_ID }],
      error: null,
    });
    const executor = createAuditEventWriteExecutor(client);

    const forged = {
      intent: RECORD_AUDIT_EVENT_INTENT,
      args: { ...ALLOW_ARGS, p_event_summary: "smuggled caller summary" },
    } as unknown as AuditEventWriteIntent;
    const result = await executor.write(forged);

    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({
      auditEventId: null,
      error: AUDIT_WRITE_UNMAPPED_INTENT_ERROR,
    });
  });

  it.each([
    ["a non-string actor id", { p_actor_user_account_id: 42 }],
    ["an empty-string event type", { p_event_type: "" }],
    ["an empty-string action", { p_action: "" }],
    ["a non-null target entity id", { p_target_entity_id: "target-1" }],
    ["a null reason code", { p_reason_code: null }],
    ["a string metadata payload", { p_metadata: "not-an-object" }],
    ["an array metadata payload", { p_metadata: ["routeId"] }],
    ["a metadata value that is not a string", { p_metadata: { routeId: 7 } }],
  ])(
    "fails closed on %s without calling .rpc",
    async (_name, override) => {
      const { client, rpc } = fakeClient({
        data: [{ audit_event_id: AUDIT_EVENT_ID }],
        error: null,
      });
      const executor = createAuditEventWriteExecutor(client);

      const forged = {
        intent: RECORD_AUDIT_EVENT_INTENT,
        args: { ...ALLOW_ARGS, ...override },
      } as unknown as AuditEventWriteIntent;
      const result = await executor.write(forged);

      expect(rpc).not.toHaveBeenCalled();
      expect(result).toEqual({
        auditEventId: null,
        error: AUDIT_WRITE_UNMAPPED_INTENT_ERROR,
      });
    },
  );
});

describe("createAuditEventWriteExecutor fail-closed on .rpc outcomes (M2 exact single-row contract)", () => {
  it("maps an .rpc() error to a detail-free sentinel that leaks no secret", async () => {
    // A realistic PostgREST error body carrying a URL, a fixed database error
    // identifier, and a service-role-looking token: none of it may surface.
    const leakyError = {
      message:
        "solmind_audit_unknown_event_action at https://project-ref.supabase.co/rest/v1/rpc using key sbp_service_role_secret_abc123",
      code: "P0001",
    };
    const { client } = fakeClient({ data: null, error: leakyError });
    const executor = createAuditEventWriteExecutor(client);

    const result = await executor.write(intentWith(ALLOW_ARGS));

    expect(result).toEqual({
      auditEventId: null,
      error: AUDIT_WRITE_FAILED_ERROR,
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("supabase.co");
    expect(serialized).not.toContain("sbp_service_role_secret_abc123");
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain("solmind_audit_unknown_event_action");
    expect(serialized).not.toContain("P0001");
  });

  it("maps a thrown/rejected .rpc() call to the failed sentinel (never rejects)", async () => {
    const rpc = vi.fn(() => Promise.reject(new Error("network down")));
    const client = { rpc } as unknown as Parameters<
      typeof createAuditEventWriteExecutor
    >[0];
    const executor = createAuditEventWriteExecutor(client);

    const result = await executor.write(intentWith(ALLOW_ARGS));

    expect(result).toEqual({
      auditEventId: null,
      error: AUDIT_WRITE_FAILED_ERROR,
    });
  });

  it("fails closed on an EMPTY array result (a write with zero rows is not a success)", async () => {
    // Deliberate contrast with the read executor, where an empty array is a
    // reachable "no rows" result: for the write seam, zero returned rows means the
    // insert did not happen, so the empty-array success trap is NOT mirrored here.
    const { client, rpc } = fakeClient({ data: [], error: null });
    const executor = createAuditEventWriteExecutor(client);

    const result = await executor.write(intentWith(ALLOW_ARGS));

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      auditEventId: null,
      error: AUDIT_WRITE_FAILED_ERROR,
    });
  });

  it("fails closed on a multi-row result (exactly one row is the only success)", async () => {
    const { client } = fakeClient({
      data: [
        { audit_event_id: AUDIT_EVENT_ID },
        { audit_event_id: "0f9be9a6-2f7e-4e64-9f0a-5a1b2c3d4e60" },
      ],
      error: null,
    });
    const executor = createAuditEventWriteExecutor(client);

    const result = await executor.write(intentWith(ALLOW_ARGS));

    expect(result).toEqual({
      auditEventId: null,
      error: AUDIT_WRITE_FAILED_ERROR,
    });
  });

  it("fails closed on a non-array data payload", async () => {
    const { client } = fakeClient({
      data: { audit_event_id: AUDIT_EVENT_ID },
      error: null,
    });
    const executor = createAuditEventWriteExecutor(client);

    const result = await executor.write(intentWith(ALLOW_ARGS));

    expect(result).toEqual({
      auditEventId: null,
      error: AUDIT_WRITE_FAILED_ERROR,
    });
  });

  it.each([
    ["a row without audit_event_id", [{ unexpected: true }]],
    ["a non-string audit_event_id", [{ audit_event_id: 12345 }]],
    ["an empty-string audit_event_id", [{ audit_event_id: "" }]],
    ["a null row", [null]],
  ])("fails closed on a malformed row: %s", async (_name, data) => {
    const { client } = fakeClient({ data, error: null });
    const executor = createAuditEventWriteExecutor(client);

    const result = await executor.write(intentWith(ALLOW_ARGS));

    expect(result).toEqual({
      auditEventId: null,
      error: AUDIT_WRITE_FAILED_ERROR,
    });
  });
});

describe("auditEventWriteExecutor - barrel exposure", () => {
  it("is not exported from the shared supabase index barrel", () => {
    // The server-only write seam must stay off the shared barrel
    // (AUTH-RLS-DEC-007), mirroring serviceRoleClient, serviceRoleRpcExecutor, and
    // the other server-only factories. Server composition paths import it by
    // direct path only.
    expect("createAuditEventWriteExecutor" in supabaseBarrel).toBe(false);
    expect("AUDIT_WRITE_FAILED_ERROR" in supabaseBarrel).toBe(false);
    expect("AUDIT_WRITE_UNMAPPED_INTENT_ERROR" in supabaseBarrel).toBe(false);
    expect("RECORD_AUDIT_EVENT_INTENT" in supabaseBarrel).toBe(false);
  });
});
