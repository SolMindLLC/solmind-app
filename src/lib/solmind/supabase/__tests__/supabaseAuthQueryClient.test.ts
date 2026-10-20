import { describe, expect, it } from "vitest";

import {
  createSupabaseAuthQueryClient,
  type SupabaseQueryResult,
  type SupabaseQuerySpec,
} from "../supabaseAuthQueryClient";

// Fixed injected now. Future/past expiries are relative to this.
const NOW = new Date("2026-06-21T12:00:00.000Z");
const FUTURE = "2026-06-21T13:00:00.000Z";
const PAST = "2026-06-21T11:00:00.000Z";

const ACCOUNT_ID = "user-account-1";
const PROVIDER_USER_ID = "auth-user-1";
const GUIDE_PROFILE_ID = "guide-profile-1";
const EXPLORER_PROFILE_ID = "explorer-profile-1";
const RELATIONSHIP_ID = "rel-1";

// Login step 6, sub-slice S6-4: session UUIDs as the lookup returns them.
const SESSION_ID = "5e5510a0-0000-4000-8000-000000000a01";
const OTHER_SESSION_ID = "5e5510a0-0000-4000-8000-000000000a02";

function nowProvider(): Date {
  return NOW;
}

// A deterministic mock executor. It records every spec it receives and returns a
// canned result keyed by table. No network, DB, env, or cookies.
function mockClient(resultByTable: Record<string, SupabaseQueryResult>) {
  const calls: SupabaseQuerySpec[] = [];
  const client = {
    select(spec: SupabaseQuerySpec): Promise<SupabaseQueryResult> {
      calls.push(spec);
      const result = resultByTable[spec.table] ?? { data: [], error: null };
      return Promise.resolve(result);
    },
  };
  return { client, calls };
}

function makeClient(resultByTable: Record<string, SupabaseQueryResult>) {
  const { client, calls } = mockClient(resultByTable);
  return {
    queryClient: createSupabaseAuthQueryClient({ client, now: nowProvider }),
    calls,
  };
}

// An executor whose select() throws synchronously.
function throwingClient() {
  return createSupabaseAuthQueryClient({
    client: {
      select(): Promise<SupabaseQueryResult> {
        throw new Error("synchronous executor failure");
      },
    },
    now: nowProvider,
  });
}

// An executor whose select() returns a rejected promise.
function rejectingClient() {
  return createSupabaseAuthQueryClient({
    client: {
      select(): Promise<SupabaseQueryResult> {
        return Promise.reject(new Error("rejected executor failure"));
      },
    },
    now: nowProvider,
  });
}

describe("findAuthProviderIdentity", () => {
  const row = {
    user_account_id: ACCOUNT_ID,
    provider_name: "supabase",
    provider_user_id: PROVIDER_USER_ID,
    status: "active",
  };

  it("returns a matching active row", async () => {
    const { queryClient, calls } = makeClient({
      auth_provider_identity: { data: [row], error: null },
    });

    const result = await queryClient.findAuthProviderIdentity({
      providerName: "supabase",
      providerUserId: PROVIDER_USER_ID,
    });

    expect(result).toEqual(row);
    // Scoped filters only: provider_name, provider_user_id, status=active.
    expect(calls[0].schema).toBe("identity");
    expect(calls[0].table).toBe("auth_provider_identity");
    expect(calls[0].filters).toEqual([
      { column: "provider_name", value: "supabase" },
      { column: "provider_user_id", value: PROVIDER_USER_ID },
      { column: "status", value: "active" },
    ]);
  });

  it("returns null when no row exists", async () => {
    const { queryClient } = makeClient({
      auth_provider_identity: { data: [], error: null },
    });

    const result = await queryClient.findAuthProviderIdentity({
      providerName: "supabase",
      providerUserId: PROVIDER_USER_ID,
    });

    expect(result).toBeNull();
  });

  it("returns null on multiple rows (deny on ambiguity)", async () => {
    const { queryClient } = makeClient({
      auth_provider_identity: { data: [row, { ...row }], error: null },
    });

    const result = await queryClient.findAuthProviderIdentity({
      providerName: "supabase",
      providerUserId: PROVIDER_USER_ID,
    });

    expect(result).toBeNull();
  });

  it("returns null on query error", async () => {
    const { queryClient } = makeClient({
      auth_provider_identity: { data: null, error: { message: "boom" } },
    });

    const result = await queryClient.findAuthProviderIdentity({
      providerName: "supabase",
      providerUserId: PROVIDER_USER_ID,
    });

    expect(result).toBeNull();
  });

  it("returns null on an invalid row shape", async () => {
    const { queryClient } = makeClient({
      auth_provider_identity: {
        data: [{ user_account_id: ACCOUNT_ID, provider_name: "supabase" }],
        error: null,
      },
    });

    const result = await queryClient.findAuthProviderIdentity({
      providerName: "supabase",
      providerUserId: PROVIDER_USER_ID,
    });

    expect(result).toBeNull();
  });
});

describe("findActiveSessionByUserAccountId", () => {
  function sessionRow(overrides: Record<string, string> = {}) {
    return {
      user_session_id: SESSION_ID,
      user_account_id: ACCOUNT_ID,
      active_role_context: "guide",
      session_status: "active",
      expires_at: FUTURE,
      ...overrides,
    };
  }

  it("returns the single valid active, non-expired session projected to UserSessionRow", async () => {
    const { queryClient, calls } = makeClient({
      user_session: { data: [sessionRow()], error: null },
    });

    const result = await queryClient.findActiveSessionByUserAccountId({
      userAccountId: ACCOUNT_ID,
    });

    // PRQ-001 The projected shape keeps the selected session's own UUID and its
    // expires_at, exactly as the lookup returned them (login step 6, S6-4).
    expect(result).toEqual({
      user_session_id: SESSION_ID,
      user_account_id: ACCOUNT_ID,
      active_role_context: "guide",
      session_status: "active",
      expires_at: FUTURE,
    });

    // The session query includes user_session_id and expires_at in the selected
    // columns and is scoped by account + active status, with no limit semantics.
    expect(calls[0].columns).toEqual([
      "user_session_id",
      "user_account_id",
      "active_role_context",
      "session_status",
      "expires_at",
    ]);
    expect(calls[0].filters).toEqual([
      { column: "user_account_id", value: ACCOUNT_ID },
      { column: "session_status", value: "active" },
    ]);
  });

  it("returns null for zero sessions", async () => {
    const { queryClient } = makeClient({
      user_session: { data: [], error: null },
    });

    const result = await queryClient.findActiveSessionByUserAccountId({
      userAccountId: ACCOUNT_ID,
    });

    expect(result).toBeNull();
  });

  it("returns null for an active-status session that is expired by time (expiration wins)", async () => {
    const { queryClient } = makeClient({
      user_session: { data: [sessionRow({ expires_at: PAST })], error: null },
    });

    const result = await queryClient.findActiveSessionByUserAccountId({
      userAccountId: ACCOUNT_ID,
    });

    expect(result).toBeNull();
  });

  it("returns null for multiple valid active sessions (deny on ambiguity)", async () => {
    const { queryClient } = makeClient({
      user_session: {
        data: [
          sessionRow({ active_role_context: "guide" }),
          sessionRow({ active_role_context: "explorer" }),
        ],
        error: null,
      },
    });

    const result = await queryClient.findActiveSessionByUserAccountId({
      userAccountId: ACCOUNT_ID,
    });

    expect(result).toBeNull();
  });

  it("returns the single valid session when mixed with an expired one", async () => {
    // PRQ-002 The UUID and expiry returned are the selected session's own, never
    // those of another row the lookup returned beside it.
    const { queryClient } = makeClient({
      user_session: {
        data: [
          sessionRow({ user_session_id: OTHER_SESSION_ID, expires_at: PAST }),
          sessionRow(),
        ],
        error: null,
      },
    });

    const result = await queryClient.findActiveSessionByUserAccountId({
      userAccountId: ACCOUNT_ID,
    });

    expect(result).toEqual({
      user_session_id: SESSION_ID,
      user_account_id: ACCOUNT_ID,
      active_role_context: "guide",
      session_status: "active",
      expires_at: FUTURE,
    });
  });

  it("PRQ-003 fails closed when a session row carries no usable user_session_id (the lookup's shape before S6-3, or a non-string value)", async () => {
    const withoutId: Record<string, unknown> = { ...sessionRow() };
    delete withoutId.user_session_id;
    for (const row of [
      withoutId,
      { ...sessionRow(), user_session_id: null },
      { ...sessionRow(), user_session_id: 7 },
      { ...sessionRow(), expires_at: null },
    ]) {
      const { queryClient } = makeClient({
        user_session: { data: [row], error: null },
      });

      await expect(
        queryClient.findActiveSessionByUserAccountId({ userAccountId: ACCOUNT_ID }),
      ).resolves.toBeNull();
    }
  });

  it("PRQ-004 returns no session UUID on ambiguity: two valid active sessions select nothing", async () => {
    const { queryClient } = makeClient({
      user_session: {
        data: [sessionRow(), sessionRow({ user_session_id: OTHER_SESSION_ID })],
        error: null,
      },
    });

    await expect(
      queryClient.findActiveSessionByUserAccountId({ userAccountId: ACCOUNT_ID }),
    ).resolves.toBeNull();
  });

  it("returns null on query error", async () => {
    const { queryClient } = makeClient({
      user_session: { data: null, error: { message: "boom" } },
    });

    const result = await queryClient.findActiveSessionByUserAccountId({
      userAccountId: ACCOUNT_ID,
    });

    expect(result).toBeNull();
  });

  it("fails closed when any active session row has an invalid shape", async () => {
    const { queryClient } = makeClient({
      user_session: {
        data: [sessionRow(), { user_account_id: ACCOUNT_ID }],
        error: null,
      },
    });

    const result = await queryClient.findActiveSessionByUserAccountId({
      userAccountId: ACCOUNT_ID,
    });

    expect(result).toBeNull();
  });
});

describe("other finder methods", () => {
  it("findUserAccountById maps a valid row and scopes by id", async () => {
    const row = { user_account_id: ACCOUNT_ID, account_status: "active" };
    const { queryClient, calls } = makeClient({
      user_account: { data: [row], error: null },
    });

    const result = await queryClient.findUserAccountById({
      userAccountId: ACCOUNT_ID,
    });

    expect(result).toEqual(row);
    expect(calls[0].schema).toBe("identity");
    expect(calls[0].filters).toEqual([
      { column: "user_account_id", value: ACCOUNT_ID },
    ]);
  });

  it("findUserAccountById returns null on miss and on error", async () => {
    const miss = makeClient({ user_account: { data: [], error: null } });
    expect(
      await miss.queryClient.findUserAccountById({ userAccountId: ACCOUNT_ID }),
    ).toBeNull();

    const errored = makeClient({
      user_account: { data: null, error: { message: "boom" } },
    });
    expect(
      await errored.queryClient.findUserAccountById({
        userAccountId: ACCOUNT_ID,
      }),
    ).toBeNull();
  });

  it("findActiveRoleAssignment maps a valid row and scopes by account + role + active", async () => {
    const row = {
      user_account_id: ACCOUNT_ID,
      role_code: "guide",
      role_status: "active",
    };
    const { queryClient, calls } = makeClient({
      user_role_assignment: { data: [row], error: null },
    });

    const result = await queryClient.findActiveRoleAssignment({
      userAccountId: ACCOUNT_ID,
      roleCode: "guide",
    });

    expect(result).toEqual(row);
    expect(calls[0].filters).toEqual([
      { column: "user_account_id", value: ACCOUNT_ID },
      { column: "role_code", value: "guide" },
      { column: "role_status", value: "active" },
    ]);
  });

  it("findGuideProfileByUserAccountId maps a valid row and scopes by account + active", async () => {
    const row = {
      guide_profile_id: GUIDE_PROFILE_ID,
      user_account_id: ACCOUNT_ID,
      status: "active",
    };
    const { queryClient, calls } = makeClient({
      guide_profile: { data: [row], error: null },
    });

    const result = await queryClient.findGuideProfileByUserAccountId({
      userAccountId: ACCOUNT_ID,
    });

    expect(result).toEqual(row);
    expect(calls[0].schema).toBe("core");
    expect(calls[0].filters).toEqual([
      { column: "user_account_id", value: ACCOUNT_ID },
      { column: "status", value: "active" },
    ]);
  });

  it("findExplorerProfileByUserAccountId maps a valid row and returns null on miss", async () => {
    const row = {
      explorer_profile_id: EXPLORER_PROFILE_ID,
      user_account_id: ACCOUNT_ID,
      status: "active",
    };
    const hit = makeClient({ explorer_profile: { data: [row], error: null } });
    expect(
      await hit.queryClient.findExplorerProfileByUserAccountId({
        userAccountId: ACCOUNT_ID,
      }),
    ).toEqual(row);

    const miss = makeClient({ explorer_profile: { data: [], error: null } });
    expect(
      await miss.queryClient.findExplorerProfileByUserAccountId({
        userAccountId: ACCOUNT_ID,
      }),
    ).toBeNull();
  });

  it("findGuideExplorerRelationshipById maps a valid row and scopes by relationship id", async () => {
    const row = {
      guide_explorer_relationship_id: RELATIONSHIP_ID,
      guide_profile_id: GUIDE_PROFILE_ID,
      explorer_profile_id: EXPLORER_PROFILE_ID,
      relationship_status: "active",
    };
    const { queryClient, calls } = makeClient({
      guide_explorer_relationship: { data: [row], error: null },
    });

    const result = await queryClient.findGuideExplorerRelationshipById({
      relationshipId: RELATIONSHIP_ID,
    });

    expect(result).toEqual(row);
    expect(calls[0].schema).toBe("core");
    expect(calls[0].filters).toEqual([
      { column: "guide_explorer_relationship_id", value: RELATIONSHIP_ID },
    ]);
  });

  it("findGuideExplorerRelationshipById returns null on query error", async () => {
    const { queryClient } = makeClient({
      guide_explorer_relationship: { data: null, error: { message: "boom" } },
    });

    const result = await queryClient.findGuideExplorerRelationshipById({
      relationshipId: RELATIONSHIP_ID,
    });

    expect(result).toBeNull();
  });
});

describe("fails closed on thrown/rejected executor failures", () => {
  it("findAuthProviderIdentity returns null when the executor throws synchronously", async () => {
    const queryClient = throwingClient();

    const result = await queryClient.findAuthProviderIdentity({
      providerName: "supabase",
      providerUserId: PROVIDER_USER_ID,
    });

    expect(result).toBeNull();
  });

  it("findAuthProviderIdentity returns null when the executor rejects", async () => {
    const queryClient = rejectingClient();

    const result = await queryClient.findAuthProviderIdentity({
      providerName: "supabase",
      providerUserId: PROVIDER_USER_ID,
    });

    expect(result).toBeNull();
  });

  it("findActiveSessionByUserAccountId returns null when the executor throws synchronously", async () => {
    const queryClient = throwingClient();

    const result = await queryClient.findActiveSessionByUserAccountId({
      userAccountId: ACCOUNT_ID,
    });

    expect(result).toBeNull();
  });

  it("findActiveSessionByUserAccountId returns null when the executor rejects", async () => {
    const queryClient = rejectingClient();

    const result = await queryClient.findActiveSessionByUserAccountId({
      userAccountId: ACCOUNT_ID,
    });

    expect(result).toBeNull();
  });

  it("does not propagate the thrown/rejected error to the caller", async () => {
    const queryClient = rejectingClient();

    // The call resolves to null rather than rejecting.
    await expect(
      queryClient.findUserAccountById({ userAccountId: ACCOUNT_ID }),
    ).resolves.toBeNull();
  });
});
