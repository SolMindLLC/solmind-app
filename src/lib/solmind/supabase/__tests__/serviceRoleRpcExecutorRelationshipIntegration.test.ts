import { describe, expect, it, vi } from "vitest";

import {
  createServiceRoleRpcExecutor,
  SERVICE_ROLE_RPC_DISPATCH_KEYS,
} from "../serviceRoleRpcExecutor";
import {
  createSupabaseAuthQueryClient,
  type SupabaseQueryExecutor,
} from "../supabaseAuthQueryClient";

const RELATIONSHIP_ID = "33333333-3333-4333-8333-333333333333";
const GUIDE_PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const EXPLORER_PROFILE_ID = "44444444-4444-4444-8444-444444444444";
const USER_ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const PROVIDER_USER_ID = "55555555-5555-4555-8555-555555555555";

describe("Guide relationship query-client and service-role executor integration", () => {
  it("keeps every actual query-client finder and executor dispatch key bidirectionally closed", async () => {
    const rowsByFunction: Readonly<Record<string, unknown[]>> = {
      solmind_find_auth_provider_identity: [
        {
          user_account_id: USER_ACCOUNT_ID,
          provider_name: "supabase",
          provider_user_id: PROVIDER_USER_ID,
          status: "active",
        },
      ],
      solmind_find_user_account: [
        { user_account_id: USER_ACCOUNT_ID, account_status: "active" },
      ],
      solmind_find_active_user_sessions: [
        {
          user_account_id: USER_ACCOUNT_ID,
          active_role_context: "guide",
          session_status: "active",
          expires_at: "2026-08-30T20:00:00.000Z",
        },
      ],
      solmind_find_active_role_assignment: [
        {
          user_account_id: USER_ACCOUNT_ID,
          role_code: "guide",
          role_status: "active",
        },
      ],
      solmind_find_guide_profile: [
        {
          guide_profile_id: GUIDE_PROFILE_ID,
          user_account_id: USER_ACCOUNT_ID,
          status: "active",
        },
      ],
      solmind_find_explorer_profile: [
        {
          explorer_profile_id: EXPLORER_PROFILE_ID,
          user_account_id: USER_ACCOUNT_ID,
          status: "active",
        },
      ],
      solmind_find_guide_explorer_relationship: [
        {
          guide_explorer_relationship_id: RELATIONSHIP_ID,
          guide_profile_id: GUIDE_PROFILE_ID,
          explorer_profile_id: EXPLORER_PROFILE_ID,
          relationship_status: "active",
        },
      ],
    };
    const rpc = vi.fn((functionName: string) =>
      Promise.resolve({
        data: rowsByFunction[functionName] ?? null,
        error: rowsByFunction[functionName] === undefined ? "unexpected" : null,
      }),
    );
    const serviceRoleClient = { rpc } as unknown as Parameters<
      typeof createServiceRoleRpcExecutor
    >[0];
    const executor = createServiceRoleRpcExecutor(serviceRoleClient);
    const observedQueryKeys = new Set<string>();
    const observingExecutor: SupabaseQueryExecutor = {
      select(spec) {
        observedQueryKeys.add(`${spec.schema}.${spec.table}`);
        return executor.select(spec);
      },
    };
    const queryClient = createSupabaseAuthQueryClient({
      client: observingExecutor,
      now: () => new Date("2026-08-30T19:00:00.000Z"),
    });

    await Promise.all([
      queryClient.findAuthProviderIdentity({
        providerName: "supabase",
        providerUserId: PROVIDER_USER_ID,
      }),
      queryClient.findUserAccountById({ userAccountId: USER_ACCOUNT_ID }),
      queryClient.findActiveSessionByUserAccountId({
        userAccountId: USER_ACCOUNT_ID,
      }),
      queryClient.findActiveRoleAssignment({
        userAccountId: USER_ACCOUNT_ID,
        roleCode: "guide",
      }),
      queryClient.findGuideProfileByUserAccountId({
        userAccountId: USER_ACCOUNT_ID,
      }),
      queryClient.findExplorerProfileByUserAccountId({
        userAccountId: USER_ACCOUNT_ID,
      }),
      queryClient.findGuideExplorerRelationshipById({
        relationshipId: RELATIONSHIP_ID,
      }),
    ]);

    expect([...observedQueryKeys].sort()).toEqual(
      SERVICE_ROLE_RPC_DISPATCH_KEYS,
    );
    expect(SERVICE_ROLE_RPC_DISPATCH_KEYS).toHaveLength(7);
    expect(rpc).toHaveBeenCalledTimes(7);
    expect(
      rpc.mock.calls.map(([functionName]) => functionName).sort(),
    ).toEqual(Object.keys(rowsByFunction).sort());
  });

  it("dispatches the actual query-client specification through the exact closed mapping", async () => {
    const row = {
      guide_explorer_relationship_id: RELATIONSHIP_ID,
      guide_profile_id: GUIDE_PROFILE_ID,
      explorer_profile_id: EXPLORER_PROFILE_ID,
      relationship_status: "active",
    };
    const rpc = vi.fn(() => Promise.resolve({ data: [row], error: null }));
    const serviceRoleClient = { rpc } as unknown as Parameters<
      typeof createServiceRoleRpcExecutor
    >[0];
    const queryClient = createSupabaseAuthQueryClient({
      client: createServiceRoleRpcExecutor(serviceRoleClient),
      now: () => new Date("2026-08-30T18:00:00.000Z"),
    });

    const result = await queryClient.findGuideExplorerRelationshipById({
      relationshipId: RELATIONSHIP_ID,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      "solmind_find_guide_explorer_relationship",
      { p_guide_explorer_relationship_id: RELATIONSHIP_ID },
    );
    expect(result).toEqual(row);
  });

  it("preserves an ended relationship row for the app-layer active check", async () => {
    const row = {
      guide_explorer_relationship_id: RELATIONSHIP_ID,
      guide_profile_id: GUIDE_PROFILE_ID,
      explorer_profile_id: EXPLORER_PROFILE_ID,
      relationship_status: "ended",
    };
    const rpc = vi.fn(() => Promise.resolve({ data: [row], error: null }));
    const serviceRoleClient = { rpc } as unknown as Parameters<
      typeof createServiceRoleRpcExecutor
    >[0];
    const queryClient = createSupabaseAuthQueryClient({
      client: createServiceRoleRpcExecutor(serviceRoleClient),
      now: () => new Date("2026-08-30T18:00:00.000Z"),
    });

    await expect(
      queryClient.findGuideExplorerRelationshipById({
        relationshipId: RELATIONSHIP_ID,
      }),
    ).resolves.toEqual(row);
  });
});
