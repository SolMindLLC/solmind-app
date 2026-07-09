import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock ONLY the service-role CLIENT factory (the true IO edge). The real
// createAuditEventWriteExecutor and createAuthRlsAuditEventWriter still run, so
// this suite proves the ASSEMBLED production chain dispatches through the single
// enumerated audit write function -- no network, DB, env secret, or real Supabase
// client is touched.
const { rpcMock, createServiceRoleClientMock } = vi.hoisted(() => {
  return {
    rpcMock: vi.fn(),
    createServiceRoleClientMock: vi.fn(),
  };
});

vi.mock("../serviceRoleClient", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
}));

import { createAdminAuditEventWriter } from "../adminAuditEventWriter";
import * as supabaseBarrel from "../index";
import * as authBarrel from "../../auth/index";
import {
  createGuardedServiceRoleReadEvent,
} from "../../auth/authRlsAuditEvent";
import { toPersistableAuthRlsAuditEvent } from "../../auth/auditEventWriter";

const ACCOUNT_ID = "user-admin-1";
const AUDIT_EVENT_ID = "0f9be9a6-2f7e-4e64-9f0a-5a1b2c3d4e5f";

// A post-resolution guarded-read envelope, built through the banked factory and
// mapping so this suite never hand-crafts a persistable shape.
function guardedReadEnvelope() {
  const envelope = toPersistableAuthRlsAuditEvent(
    createGuardedServiceRoleReadEvent({ actorUserAccountId: ACCOUNT_ID }),
  );
  expect(envelope).not.toBeNull();
  return envelope as NonNullable<typeof envelope>;
}

beforeEach(() => {
  rpcMock.mockReset();
  createServiceRoleClientMock.mockReset();
  createServiceRoleClientMock.mockReturnValue({ rpc: rpcMock });
});

describe("createAdminAuditEventWriter - production chain assembly (AUD-3)", () => {
  it("dispatches a persistable envelope to solmind_record_audit_event with exact named arguments", async () => {
    rpcMock.mockResolvedValue({
      data: [{ audit_event_id: AUDIT_EVENT_ID }],
      error: null,
    });

    const writer = createAdminAuditEventWriter();
    const result = await writer.persistAuthRlsAuditEvent(guardedReadEnvelope());

    expect(result).toEqual({ persisted: true, auditEventId: AUDIT_EVENT_ID });
    expect(createServiceRoleClientMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("solmind_record_audit_event", {
      p_event_type: "guarded_service_role_read",
      p_action: "read",
      p_actor_role_context: "admin",
      p_actor_user_account_id: ACCOUNT_ID,
      p_target_entity_type: "admin_route",
      p_target_entity_id: null,
      p_reason_code: "guarded_read",
      p_metadata: { routeId: "admin_route" },
    });
  });

  it("resolves a value-free failure result (never throws) when the RPC transport errors", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message:
          "permission denied at https://project-ref.supabase.co/rest/v1/rpc using key sbp_service_role_secret_abc123",
        code: "42501",
      },
    });

    const writer = createAdminAuditEventWriter();
    const result = await writer.persistAuthRlsAuditEvent(guardedReadEnvelope());

    expect(result.persisted).toBe(false);
    // The sentinel is value-free: no URL, key, or error body survives the seam.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("supabase.co");
    expect(serialized).not.toContain("sbp_service_role_secret_abc123");
    expect(serialized).not.toContain("permission denied");
  });

  it("propagates a service-role client construction failure (the composition treats audit as unavailable)", () => {
    createServiceRoleClientMock.mockImplementation(() => {
      throw new Error(
        "SolMind server configuration error: required server environment variable SUPABASE_SERVICE_ROLE_KEY is missing or blank.",
      );
    });

    // The factory throws at CONSTRUCTION (not at persist time), so the /admin
    // composition root's guarded writer resolution catches it and fails the allow
    // path closed with audit persistence unavailable.
    expect(() => createAdminAuditEventWriter()).toThrowError(
      /SolMind server configuration error/,
    );
  });
});

describe("createAdminAuditEventWriter - barrel hygiene (server-only, off-barrel)", () => {
  it("is exported from NEITHER shared barrel", () => {
    expect(supabaseBarrel).not.toHaveProperty("createAdminAuditEventWriter");
    expect(authBarrel).not.toHaveProperty("createAdminAuditEventWriter");
  });
});
