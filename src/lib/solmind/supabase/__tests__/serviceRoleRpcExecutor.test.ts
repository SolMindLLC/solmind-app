import { describe, expect, it, vi } from "vitest";

import {
  RPC_FAILED_ERROR,
  RPC_UNMAPPED_SPEC_ERROR,
  createServiceRoleRpcExecutor,
} from "../serviceRoleRpcExecutor";
import { type SupabaseQuerySpec } from "../supabaseAuthQueryClient";

// Build a fake service-role Supabase client whose .rpc(fn, args) records every call and returns a
// canned response. Only .rpc is exercised by the executor, so no network, DB, env, or real client
// is touched. Cast through the executor's own parameter type to avoid importing the full client.
function fakeClient(response: { data: unknown; error: unknown }) {
  const rpc = vi.fn(() => Promise.resolve(response));
  const client = { rpc } as unknown as Parameters<
    typeof createServiceRoleRpcExecutor
  >[0];
  return { client, rpc };
}

// The six approved scoped-select specs, mirroring exactly what createSupabaseAuthQueryClient
// issues, each paired with the enumerated function and the named args (dynamic values only) the
// executor must dispatch to. Baked status filters and the columns list must NOT become args.
const ACCOUNT_ID = "user-admin-1";

const DISPATCH_CASES: ReadonlyArray<{
  name: string;
  spec: SupabaseQuerySpec;
  functionName: string;
  args: Record<string, string>;
}> = [
  {
    name: "auth_provider_identity",
    spec: {
      schema: "identity",
      table: "auth_provider_identity",
      columns: ["user_account_id", "provider_name", "provider_user_id", "status"],
      filters: [
        { column: "provider_name", value: "supabase" },
        { column: "provider_user_id", value: "auth-admin-1" },
        { column: "status", value: "active" },
      ],
    },
    functionName: "solmind_find_auth_provider_identity",
    args: { p_provider_name: "supabase", p_provider_user_id: "auth-admin-1" },
  },
  {
    name: "user_account",
    spec: {
      schema: "identity",
      table: "user_account",
      columns: ["user_account_id", "account_status"],
      filters: [{ column: "user_account_id", value: ACCOUNT_ID }],
    },
    functionName: "solmind_find_user_account",
    args: { p_user_account_id: ACCOUNT_ID },
  },
  {
    name: "user_session",
    spec: {
      schema: "identity",
      table: "user_session",
      columns: [
        "user_account_id",
        "active_role_context",
        "session_status",
        "expires_at",
      ],
      filters: [
        { column: "user_account_id", value: ACCOUNT_ID },
        { column: "session_status", value: "active" },
      ],
    },
    functionName: "solmind_find_active_user_sessions",
    args: { p_user_account_id: ACCOUNT_ID },
  },
  {
    name: "user_role_assignment",
    spec: {
      schema: "identity",
      table: "user_role_assignment",
      columns: ["user_account_id", "role_code", "role_status"],
      filters: [
        { column: "user_account_id", value: ACCOUNT_ID },
        { column: "role_code", value: "admin" },
        { column: "role_status", value: "active" },
      ],
    },
    functionName: "solmind_find_active_role_assignment",
    args: { p_user_account_id: ACCOUNT_ID, p_role_code: "admin" },
  },
  {
    name: "guide_profile",
    spec: {
      schema: "core",
      table: "guide_profile",
      columns: ["guide_profile_id", "user_account_id", "status"],
      filters: [
        { column: "user_account_id", value: ACCOUNT_ID },
        { column: "status", value: "active" },
      ],
    },
    functionName: "solmind_find_guide_profile",
    args: { p_user_account_id: ACCOUNT_ID },
  },
  {
    name: "explorer_profile",
    spec: {
      schema: "core",
      table: "explorer_profile",
      columns: ["explorer_profile_id", "user_account_id", "status"],
      filters: [
        { column: "user_account_id", value: ACCOUNT_ID },
        { column: "status", value: "active" },
      ],
    },
    functionName: "solmind_find_explorer_profile",
    args: { p_user_account_id: ACCOUNT_ID },
  },
];

// The deliberately-absent seventh lookup (AUTH-RLS-DEF-018). The query client still issues this
// spec, so the executor must have no mapping for it and must fail closed.
const RELATIONSHIP_SPEC: SupabaseQuerySpec = {
  schema: "core",
  table: "guide_explorer_relationship",
  columns: [
    "guide_explorer_relationship_id",
    "guide_profile_id",
    "explorer_profile_id",
    "relationship_status",
  ],
  filters: [
    { column: "guide_explorer_relationship_id", value: "rel-1" },
  ],
};

describe("createServiceRoleRpcExecutor dispatch", () => {
  for (const testCase of DISPATCH_CASES) {
    it(`maps ${testCase.name} to its enumerated function and named args`, async () => {
      const row = { ok: true };
      const { client, rpc } = fakeClient({ data: [row], error: null });
      const executor = createServiceRoleRpcExecutor(client);

      const result = await executor.select(testCase.spec);

      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith(testCase.functionName, testCase.args);
      expect(result).toEqual({ data: [row], error: null });
    });
  }

  it("returns the array data on a reachable empty result (no rows)", async () => {
    const { client, rpc } = fakeClient({ data: [], error: null });
    const executor = createServiceRoleRpcExecutor(client);

    const result = await executor.select(DISPATCH_CASES[0].spec);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ data: [], error: null });
  });
});

describe("createServiceRoleRpcExecutor fail-closed", () => {
  it("fails closed on the deliberately-absent relationship lookup without calling .rpc", async () => {
    const { client, rpc } = fakeClient({ data: [{ ok: true }], error: null });
    const executor = createServiceRoleRpcExecutor(client);

    const result = await executor.select(RELATIONSHIP_SPEC);

    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({ data: null, error: RPC_UNMAPPED_SPEC_ERROR });
  });

  it("fails closed on an unknown schema.table without calling .rpc", async () => {
    const { client, rpc } = fakeClient({ data: [{ ok: true }], error: null });
    const executor = createServiceRoleRpcExecutor(client);

    const result = await executor.select({
      schema: "identity",
      table: "some_unmapped_table",
      columns: ["user_account_id"],
      filters: [{ column: "user_account_id", value: ACCOUNT_ID }],
    });

    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({ data: null, error: RPC_UNMAPPED_SPEC_ERROR });
  });

  it("fails closed on a mismatched spec missing a required filter without calling .rpc", async () => {
    const { client, rpc } = fakeClient({ data: [{ ok: true }], error: null });
    const executor = createServiceRoleRpcExecutor(client);

    // auth_provider_identity requires provider_name AND provider_user_id; drop one.
    const result = await executor.select({
      schema: "identity",
      table: "auth_provider_identity",
      columns: ["user_account_id", "provider_name", "provider_user_id", "status"],
      filters: [
        { column: "provider_name", value: "supabase" },
        { column: "status", value: "active" },
      ],
    });

    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({ data: null, error: RPC_UNMAPPED_SPEC_ERROR });
  });

  it("maps an .rpc() error to a detail-free sentinel that leaks no secret", async () => {
    // A realistic PostgREST error body carrying a URL and a service-role-looking token.
    const leakyError = {
      message:
        "permission denied at https://project-ref.supabase.co/rest/v1/rpc using key sbp_service_role_secret_abc123",
      code: "42501",
    };
    const { client } = fakeClient({ data: null, error: leakyError });
    const executor = createServiceRoleRpcExecutor(client);

    const result = await executor.select(DISPATCH_CASES[0].spec);

    expect(result).toEqual({ data: null, error: RPC_FAILED_ERROR });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("supabase.co");
    expect(serialized).not.toContain("service_role");
    expect(serialized).not.toContain("sbp_service_role_secret_abc123");
    expect(serialized).not.toContain("https://");
  });

  it("maps a thrown/rejected .rpc() call to the failed sentinel", async () => {
    const rpc = vi.fn(() => Promise.reject(new Error("network down")));
    const client = { rpc } as unknown as Parameters<
      typeof createServiceRoleRpcExecutor
    >[0];
    const executor = createServiceRoleRpcExecutor(client);

    const result = await executor.select(DISPATCH_CASES[0].spec);

    expect(result).toEqual({ data: null, error: RPC_FAILED_ERROR });
  });

  it("fails closed when .rpc() returns a non-array data payload", async () => {
    const { client } = fakeClient({ data: { unexpected: true }, error: null });
    const executor = createServiceRoleRpcExecutor(client);

    const result = await executor.select(DISPATCH_CASES[0].spec);

    expect(result).toEqual({ data: null, error: null });
  });
});
