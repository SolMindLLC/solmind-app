import { describe, expect, it, vi } from "vitest";

import {
  createInMemoryAuthSource,
  type InMemoryAuthSourceFixture,
  type SolMindAuthSource,
} from "../../auth/authSource";
import { createInMemoryRequestAuthPrincipalSource } from "../../auth/requestAuthPrincipalSource";
import { type SupabaseAuthenticatedUser } from "../../auth/serverAuthContext";
import {
  SUGGESTED_WAYPOINT_RPC_DENIED,
  SUGGESTED_WAYPOINT_RPC_REFRESH_REQUIRED,
  type SuggestedWaypointRpcResult,
} from "../suggestedWaypointRpcExecutor";
import {
  SUGGESTED_WAYPOINT_REQUEST_DENIED,
  SUGGESTED_WAYPOINT_REQUEST_FAILED,
  SUGGESTED_WAYPOINT_REQUEST_REFRESH_REQUIRED,
  resolveSuggestedWaypointRequest,
} from "../suggestedWaypointRequestComposition";

const GUIDE_ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const EXPLORER_ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const RELATIONSHIP_ID = "44444444-4444-4444-8444-444444444444";
const SUGGESTION_ID = "55555555-5555-4555-8555-555555555555";
const VERSION_ID = "66666666-6666-4666-8666-666666666666";
const GUIDE_PROFILE_ID = "77777777-7777-4777-8777-777777777777";
const EXPLORER_PROFILE_ID = "88888888-8888-4888-8888-888888888888";
const TIMESTAMP = "2026-08-14T03:00:00.000Z";

const IDENTIFIERS = {
  suggestedWaypointIdForCreate: vi.fn(() => SUGGESTION_ID),
  versionIdForSchedule: vi.fn(() => VERSION_ID),
};

const GUIDE_PRINCIPAL: SupabaseAuthenticatedUser = {
  providerName: "supabase",
  providerUserId: "guide-provider-user",
};
const EXPLORER_PRINCIPAL: SupabaseAuthenticatedUser = {
  providerName: "supabase",
  providerUserId: "explorer-provider-user",
};

function authAccount(args: {
  principal: SupabaseAuthenticatedUser;
  accountId: string;
  role: "guide" | "explorer";
}) {
  return {
    principal: args.principal,
    serverAuthContextInput: {
      authenticatedUser: args.principal,
      authProviderIdentity: {
        userAccountId: args.accountId,
        providerName: args.principal.providerName,
        providerUserId: args.principal.providerUserId,
        status: "active",
      },
      userAccount: {
        userAccountId: args.accountId,
        accountStatus: "active",
      },
      session: {
        userAccountId: args.accountId,
        activeRoleContext: args.role,
        sessionStatus: "active",
      },
      activeRoleAssignment: {
        userAccountId: args.accountId,
        roleCode: args.role,
        roleStatus: "active",
      },
      guideProfile:
        args.role === "guide"
          ? {
              guideProfileId: GUIDE_PROFILE_ID,
              userAccountId: args.accountId,
              status: "active",
            }
          : null,
      explorerProfile:
        args.role === "explorer"
          ? {
              explorerProfileId: EXPLORER_PROFILE_ID,
              userAccountId: args.accountId,
              status: "active",
            }
          : null,
    },
  };
}

function fixture(): InMemoryAuthSourceFixture {
  return {
    accounts: [
      authAccount({
        principal: GUIDE_PRINCIPAL,
        accountId: GUIDE_ACCOUNT_ID,
        role: "guide",
      }),
      authAccount({
        principal: EXPLORER_PRINCIPAL,
        accountId: EXPLORER_ACCOUNT_ID,
        role: "explorer",
      }),
    ],
    relationships: [
      {
        guideExplorerRelationshipId: RELATIONSHIP_ID,
        guideProfileId: GUIDE_PROFILE_ID,
        explorerProfileId: EXPLORER_PROFILE_ID,
        relationshipStatus: "active",
      },
    ],
  };
}

function successFor(call: unknown): SuggestedWaypointRpcResult {
  const functionName = (call as { functionName?: unknown }).functionName;
  const common = {
    outcome_code: "applied" as const,
    operation_id: OPERATION_ID,
    suggested_waypoint_id: SUGGESTION_ID,
    authoring_revision: 1,
    current_version_id: null,
    committed_at: TIMESTAMP,
  };

  switch (functionName) {
    case "solmind_save_suggested_waypoint_draft":
      return Object.freeze({
        functionName,
        data: Object.freeze({ ...common, draft_saved_at: TIMESTAMP }),
        error: null,
      });
    case "solmind_schedule_suggested_waypoint_send":
      return Object.freeze({
        functionName,
        data: Object.freeze({
          ...common,
          pending_version_id: VERSION_ID,
          deadline_at: TIMESTAMP,
          policy_key: "suggested_waypoint_send_grace_seconds" as const,
          policy_version: 1,
          effective_seconds: 300,
        }),
        error: null,
      });
    case "solmind_pull_back_suggested_waypoint":
      return Object.freeze({
        functionName,
        data: Object.freeze({ ...common, draft_restored_at: TIMESTAMP }),
        error: null,
      });
    case "solmind_mark_suggested_waypoint_read":
      return Object.freeze({
        functionName,
        data: Object.freeze({
          ...common,
          current_version_id: VERSION_ID,
          read_at: TIMESTAMP,
        }),
        error: null,
      });
    case "solmind_acknowledge_suggested_waypoint_receipt":
      return Object.freeze({
        functionName,
        data: Object.freeze({
          ...common,
          current_version_id: VERSION_ID,
          acknowledged_version_id: VERSION_ID,
          acknowledged_at: TIMESTAMP,
        }),
        error: null,
      });
    case "solmind_list_guide_suggested_waypoints":
    case "solmind_list_explorer_suggested_waypoints":
      return Object.freeze({
        functionName,
        data: Object.freeze({ items: [], next_cursor: null, total_count: 0 }),
        error: null,
      });
    case "solmind_get_guide_suggested_waypoint":
      return Object.freeze({
        functionName,
        data: Object.freeze({
          suggested_waypoint_id: SUGGESTION_ID,
          authoring_mode: "draft" as const,
          authoring_revision: 1,
          destination_preview: "Protect one evening for recovery",
          pending_deadline_at: null,
          pull_back_available: false,
          channel_category: "not_delivered" as const,
          current_version_id: null,
          delivered_at: null,
          acknowledged_version_id: null,
          acknowledged_at: null,
          draft_or_pending_destination: "Protect one evening for recovery",
          draft_or_pending_why: "Create dependable recovery space.",
          draft_or_pending_arrival_signals: [
            "One evening remains unscheduled.",
          ],
          delivered_destination: null,
          delivered_why: null,
          delivered_arrival_signals: null,
          policy_key: null,
          policy_version: null,
          effective_seconds: null,
        }),
        error: null,
      });
    case "solmind_get_explorer_suggested_waypoint":
      return Object.freeze({
        functionName,
        data: Object.freeze({
          suggested_waypoint_id: SUGGESTION_ID,
          current_version_id: VERSION_ID,
          destination: "Protect one evening for recovery",
          why: "Create dependable recovery space.",
          arrival_signals: ["One evening remains unscheduled."],
          received_at: TIMESTAMP,
          read: false,
          read_at: null,
          receipt_acknowledged: false,
          acknowledged_at: null,
          channel_category: "open" as const,
        }),
        error: null,
      });
    default:
      return Object.freeze({
        functionName: null,
        data: null,
        error: "solmind_suggested_waypoint_rpc_failed",
      });
  }
}

function makeExecutor() {
  return { execute: vi.fn(async (call: unknown) => successFor(call)) };
}

function makeGuideDependencies() {
  return {
    principalSource: {
      resolveAuthenticatedUser: vi.fn(async () => GUIDE_PRINCIPAL),
    },
    authSource: createInMemoryAuthSource(fixture()),
    executor: makeExecutor(),
    identifiers: IDENTIFIERS,
  };
}

const GUIDE_CREATE_REQUEST = {
  kind: "guide.create_draft",
  relationshipId: RELATIONSHIP_ID,
  operationId: OPERATION_ID,
  destination: "Protect one evening for recovery",
  why: "Create dependable recovery space.",
  arrivalSignals: ["One evening remains unscheduled."],
} as const;

describe("resolveSuggestedWaypointRequest - server-derived authority", () => {
  it("injects the authenticated Guide account and authorized relationship", async () => {
    const executor = makeExecutor();
    const result = await resolveSuggestedWaypointRequest(
      {
        principalSource:
          createInMemoryRequestAuthPrincipalSource(GUIDE_PRINCIPAL),
        authSource: createInMemoryAuthSource(fixture()),
        executor,
        identifiers: IDENTIFIERS,
      },
      GUIDE_CREATE_REQUEST,
    );

    expect(result.ok).toBe(true);
    expect(IDENTIFIERS.suggestedWaypointIdForCreate).toHaveBeenCalledWith({
      actorUserAccountId: GUIDE_ACCOUNT_ID,
      relationshipId: RELATIONSHIP_ID,
      operationId: OPERATION_ID,
    });
    expect(executor.execute).toHaveBeenCalledWith({
      functionName: "solmind_save_suggested_waypoint_draft",
      args: {
        p_actor_user_account_id: GUIDE_ACCOUNT_ID,
        p_operation_id: OPERATION_ID,
        p_guide_explorer_relationship_id: RELATIONSHIP_ID,
        p_suggested_waypoint_id: SUGGESTION_ID,
        p_expected_revision: 0,
        p_destination: "Protect one evening for recovery",
        p_why: "Create dependable recovery space.",
        p_arrival_signals: ["One evening remains unscheduled."],
      },
    });
  });

  it("injects the authenticated Explorer account without loading a client-selected relationship", async () => {
    const authSource = createInMemoryAuthSource(fixture());
    const loadRelationship = vi.spyOn(authSource, "loadGuideRelationship");
    const executor = makeExecutor();

    const result = await resolveSuggestedWaypointRequest(
      {
        principalSource:
          createInMemoryRequestAuthPrincipalSource(EXPLORER_PRINCIPAL),
        authSource,
        executor,
      },
      { kind: "explorer.list", pageSize: 10, cursor: null },
    );

    expect(result.ok).toBe(true);
    expect(loadRelationship).not.toHaveBeenCalled();
    expect(executor.execute).toHaveBeenCalledWith({
      functionName: "solmind_list_explorer_suggested_waypoints",
      args: {
        p_actor_user_account_id: EXPLORER_ACCOUNT_ID,
        p_page_size: 10,
        p_cursor: null,
      },
    });
  });
});

describe("resolveSuggestedWaypointRequest - role and relationship isolation", () => {
  it("denies an Explorer attempting a Guide operation", async () => {
    const executor = makeExecutor();
    const result = await resolveSuggestedWaypointRequest(
      {
        principalSource:
          createInMemoryRequestAuthPrincipalSource(EXPLORER_PRINCIPAL),
        authSource: createInMemoryAuthSource(fixture()),
        executor,
      },
      GUIDE_CREATE_REQUEST,
    );

    expect(result).toEqual({
      ok: false,
      data: null,
      error: SUGGESTED_WAYPOINT_REQUEST_DENIED,
    });
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it("denies a Guide attempting an Explorer operation", async () => {
    const executor = makeExecutor();
    const result = await resolveSuggestedWaypointRequest(
      {
        principalSource:
          createInMemoryRequestAuthPrincipalSource(GUIDE_PRINCIPAL),
        authSource: createInMemoryAuthSource(fixture()),
        executor,
      },
      { kind: "explorer.list", pageSize: 10, cursor: null },
    );

    expect(result.error).toBe(SUGGESTED_WAYPOINT_REQUEST_DENIED);
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it("denies a cross-Guide relationship", async () => {
    const badFixture = fixture();
    badFixture.relationships = [
      {
        guideExplorerRelationshipId: RELATIONSHIP_ID,
        guideProfileId: "99999999-9999-4999-8999-999999999999",
        explorerProfileId: EXPLORER_PROFILE_ID,
        relationshipStatus: "active",
      },
    ];
    const executor = makeExecutor();
    const result = await resolveSuggestedWaypointRequest(
      {
        principalSource:
          createInMemoryRequestAuthPrincipalSource(GUIDE_PRINCIPAL),
        authSource: createInMemoryAuthSource(badFixture),
        executor,
      },
      GUIDE_CREATE_REQUEST,
    );

    expect(result.error).toBe(SUGGESTED_WAYPOINT_REQUEST_DENIED);
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it.each(["ended", "transferred", "paused", "unknown"])(
    "denies a %s relationship",
    async (relationshipStatus) => {
      const inactiveFixture = fixture();
      inactiveFixture.relationships = [
        {
          guideExplorerRelationshipId: RELATIONSHIP_ID,
          guideProfileId: GUIDE_PROFILE_ID,
          explorerProfileId: EXPLORER_PROFILE_ID,
          relationshipStatus,
        },
      ];
      const executor = makeExecutor();
      const result = await resolveSuggestedWaypointRequest(
        {
          principalSource:
            createInMemoryRequestAuthPrincipalSource(GUIDE_PRINCIPAL),
          authSource: createInMemoryAuthSource(inactiveFixture),
          executor,
        },
        GUIDE_CREATE_REQUEST,
      );

      expect(result.error).toBe(SUGGESTED_WAYPOINT_REQUEST_DENIED);
      expect(executor.execute).not.toHaveBeenCalled();
    },
  );
});

describe("resolveSuggestedWaypointRequest - fail closed", () => {
  it("rejects malformed and extra client authority fields before auth IO", async () => {
    const principalSource = createInMemoryRequestAuthPrincipalSource(GUIDE_PRINCIPAL);
    const principalSpy = vi.spyOn(principalSource, "resolveAuthenticatedUser");
    const executor = makeExecutor();
    const result = await resolveSuggestedWaypointRequest(
      {
        principalSource,
        authSource: createInMemoryAuthSource(fixture()),
        executor,
      },
      { ...GUIDE_CREATE_REQUEST, actorUserAccountId: EXPLORER_ACCOUNT_ID },
    );

    expect(result.error).toBe(SUGGESTED_WAYPOINT_REQUEST_DENIED);
    expect(principalSpy).not.toHaveBeenCalled();
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it.each([
    [
      "create",
      {
        ...GUIDE_CREATE_REQUEST,
        destination: "Protect one evening\nfor recovery",
      },
    ],
    [
      "save",
      {
        kind: "guide.save_draft",
        relationshipId: RELATIONSHIP_ID,
        operationId: OPERATION_ID,
        suggestedWaypointId: SUGGESTION_ID,
        expectedRevision: 1,
        destination: "Protect one evening\nfor recovery",
        why: "Create dependable recovery space.",
        arrivalSignals: ["One evening remains unscheduled."],
      },
    ],
  ])(
    "denies a multiline destination in the Guide %s request before auth IO",
    async (_operation, request) => {
      const principalSource =
        createInMemoryRequestAuthPrincipalSource(GUIDE_PRINCIPAL);
      const principalSpy = vi.spyOn(
        principalSource,
        "resolveAuthenticatedUser",
      );
      const executor = makeExecutor();

      const result = await resolveSuggestedWaypointRequest(
        {
          principalSource,
          authSource: createInMemoryAuthSource(fixture()),
          executor,
          identifiers: IDENTIFIERS,
        },
        request,
      );

      expect(result.error).toBe(SUGGESTED_WAYPOINT_REQUEST_DENIED);
      expect(principalSpy).not.toHaveBeenCalled();
      expect(executor.execute).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["create destination U+2028", { ...GUIDE_CREATE_REQUEST, destination: "Protect one\u2028evening" }],
    ["create why U+2029", { ...GUIDE_CREATE_REQUEST, why: "Create recovery\u2029space." }],
    [
      "create arrival signal U+2028",
      { ...GUIDE_CREATE_REQUEST, arrivalSignals: ["One evening\u2028remains open."] },
    ],
    [
      "save destination U+2029",
      {
        kind: "guide.save_draft",
        relationshipId: RELATIONSHIP_ID,
        operationId: OPERATION_ID,
        suggestedWaypointId: SUGGESTION_ID,
        expectedRevision: 1,
        destination: "Protect one\u2029evening",
        why: "Create dependable recovery space.",
        arrivalSignals: ["One evening remains unscheduled."],
      },
    ],
    [
      "save why U+2028",
      {
        kind: "guide.save_draft",
        relationshipId: RELATIONSHIP_ID,
        operationId: OPERATION_ID,
        suggestedWaypointId: SUGGESTION_ID,
        expectedRevision: 1,
        destination: "Protect one evening",
        why: "Create recovery\u2028space.",
        arrivalSignals: ["One evening remains unscheduled."],
      },
    ],
    [
      "save arrival signal U+2029",
      {
        kind: "guide.save_draft",
        relationshipId: RELATIONSHIP_ID,
        operationId: OPERATION_ID,
        suggestedWaypointId: SUGGESTION_ID,
        expectedRevision: 1,
        destination: "Protect one evening",
        why: "Create dependable recovery space.",
        arrivalSignals: ["One evening\u2029remains open."],
      },
    ],
  ])(
    "denies Unicode line or paragraph separators in %s before auth IO",
    async (_caseName, request) => {
      const principalSource =
        createInMemoryRequestAuthPrincipalSource(GUIDE_PRINCIPAL);
      const principalSpy = vi.spyOn(
        principalSource,
        "resolveAuthenticatedUser",
      );
      const executor = makeExecutor();

      await expect(
        resolveSuggestedWaypointRequest(
          {
            principalSource,
            authSource: createInMemoryAuthSource(fixture()),
            executor,
            identifiers: IDENTIFIERS,
          },
          request,
        ),
      ).resolves.toEqual({
        ok: false,
        data: null,
        error: SUGGESTED_WAYPOINT_REQUEST_DENIED,
      });
      expect(principalSpy).not.toHaveBeenCalled();
      expect(executor.execute).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["destination", "Protect \ud800 recovery"],
    ["destination", "Protect \udc00 recovery"],
    ["why", "Make space for \ud800 recovery."],
    ["arrivalSignals", ["One \udc00 evening remains unscheduled."]],
  ])(
    "denies isolated surrogate text in %s before auth IO",
    async (field, invalidValue) => {
      const deps = makeGuideDependencies();
      const request = {
        ...GUIDE_CREATE_REQUEST,
        [field]: invalidValue,
      };

      await expect(resolveSuggestedWaypointRequest(deps, request)).resolves.toEqual({
        ok: false,
        data: null,
        error: SUGGESTED_WAYPOINT_REQUEST_DENIED,
      });
      expect(deps.principalSource.resolveAuthenticatedUser).not.toHaveBeenCalled();
      expect(deps.executor.execute).not.toHaveBeenCalled();
    },
  );

  it("accepts valid paired surrogate and ordinary four-byte scalar text", async () => {
    const deps = makeGuideDependencies();
    await expect(
      resolveSuggestedWaypointRequest(deps, {
        ...GUIDE_CREATE_REQUEST,
        destination: "Protect one evening for recovery \ud83d\ude0a",
        why: "Make space for recovery \ud83d\ude80.",
        arrivalSignals: ["One evening remains unscheduled \ud83c\udf1f."],
      }),
    ).resolves.toMatchObject({ ok: true, error: null });
    expect(deps.executor.execute).toHaveBeenCalledTimes(1);
  });

  it("snapshots mutable client input before the first asynchronous boundary", async () => {
    let releasePrincipal!: (value: SupabaseAuthenticatedUser) => void;
    const principalPromise = new Promise<SupabaseAuthenticatedUser>((resolve) => {
      releasePrincipal = resolve;
    });
    const principalSource = {
      resolveAuthenticatedUser: () => principalPromise,
    };
    const executor = makeExecutor();
    const mutableRequest = {
      ...GUIDE_CREATE_REQUEST,
      destination: "Protect one evening for recovery",
      arrivalSignals: ["One evening remains unscheduled."],
    };

    const pending = resolveSuggestedWaypointRequest(
      {
        principalSource,
        authSource: createInMemoryAuthSource(fixture()),
        executor,
        identifiers: IDENTIFIERS,
      },
      mutableRequest,
    );
    mutableRequest.destination = "Mutated after validation";
    mutableRequest.arrivalSignals[0] = "Mutated signal";
    releasePrincipal(GUIDE_PRINCIPAL);
    await pending;

    expect(executor.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.objectContaining({
          p_destination: "Protect one evening for recovery",
          p_arrival_signals: ["One evening remains unscheduled."],
        }),
      }),
    );
  });

  it("reads accessor-backed save-draft fields once before validation", async () => {
    let revisionReads = 0;
    const accessorRequest = {
      kind: "guide.save_draft",
      relationshipId: RELATIONSHIP_ID,
      operationId: OPERATION_ID,
      suggestedWaypointId: SUGGESTION_ID,
      destination: "Protect one evening for recovery",
      why: "Create dependable recovery space.",
      arrivalSignals: ["One evening remains unscheduled."],
    } as Record<string, unknown>;
    Object.defineProperty(accessorRequest, "expectedRevision", {
      enumerable: true,
      get: () => {
        revisionReads += 1;
        return revisionReads === 1 ? 1 : 0;
      },
    });
    const executor = makeExecutor();

    const result = await resolveSuggestedWaypointRequest(
      {
        principalSource:
          createInMemoryRequestAuthPrincipalSource(GUIDE_PRINCIPAL),
        authSource: createInMemoryAuthSource(fixture()),
        executor,
        identifiers: IDENTIFIERS,
      },
      accessorRequest,
    );

    expect(result.ok).toBe(true);
    expect(revisionReads).toBe(1);
    expect(executor.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.objectContaining({ p_expected_revision: 1 }),
      }),
    );
  });

  it("denies throwing proxy input before auth IO", async () => {
    const principalSource =
      createInMemoryRequestAuthPrincipalSource(GUIDE_PRINCIPAL);
    const principalSpy = vi.spyOn(principalSource, "resolveAuthenticatedUser");
    const executor = makeExecutor();
    const hostileRequest = new Proxy(
      { ...GUIDE_CREATE_REQUEST },
      {
        ownKeys: () => {
          throw new Error("hostile proxy");
        },
      },
    );

    const result = await resolveSuggestedWaypointRequest(
      {
        principalSource,
        authSource: createInMemoryAuthSource(fixture()),
        executor,
        identifiers: IDENTIFIERS,
      },
      hostileRequest,
    );

    expect(result.error).toBe(SUGGESTED_WAYPOINT_REQUEST_DENIED);
    expect(principalSpy).not.toHaveBeenCalled();
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5])(
    "denies save-draft expectedRevision %s before auth IO",
    async (expectedRevision) => {
      const principalSource =
        createInMemoryRequestAuthPrincipalSource(GUIDE_PRINCIPAL);
      const principalSpy = vi.spyOn(
        principalSource,
        "resolveAuthenticatedUser",
      );
      const executor = makeExecutor();
      const result = await resolveSuggestedWaypointRequest(
        {
          principalSource,
          authSource: createInMemoryAuthSource(fixture()),
          executor,
        },
        {
          kind: "guide.save_draft",
          relationshipId: RELATIONSHIP_ID,
          operationId: OPERATION_ID,
          suggestedWaypointId: SUGGESTION_ID,
          expectedRevision,
          destination: "Protect one evening for recovery",
          why: "Create dependable recovery space.",
          arrivalSignals: ["One evening remains unscheduled."],
        },
      );

      expect(result.error).toBe(SUGGESTED_WAYPOINT_REQUEST_DENIED);
      expect(principalSpy).not.toHaveBeenCalled();
      expect(executor.execute).not.toHaveBeenCalled();
    },
  );

  it("denies before record loading when no request principal exists", async () => {
    const authSource = createInMemoryAuthSource(fixture());
    const loadContext = vi.spyOn(authSource, "loadServerAuthContextInput");
    const executor = makeExecutor();
    const result = await resolveSuggestedWaypointRequest(
      {
        principalSource: createInMemoryRequestAuthPrincipalSource(null),
        authSource,
        executor,
      },
      GUIDE_CREATE_REQUEST,
    );

    expect(result.error).toBe(SUGGESTED_WAYPOINT_REQUEST_DENIED);
    expect(loadContext).not.toHaveBeenCalled();
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it("collapses auth-source exceptions to the opaque denial", async () => {
    const authSource: SolMindAuthSource = {
      loadServerAuthContextInput: vi.fn().mockRejectedValue(new Error("secret")),
      loadGuideRelationship: vi.fn(),
    };
    const executor = makeExecutor();
    const result = await resolveSuggestedWaypointRequest(
      {
        principalSource:
          createInMemoryRequestAuthPrincipalSource(GUIDE_PRINCIPAL),
        authSource,
        executor,
      },
      GUIDE_CREATE_REQUEST,
    );

    expect(result).toEqual({
      ok: false,
      data: null,
      error: SUGGESTED_WAYPOINT_REQUEST_DENIED,
    });
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it("maps executor sentinels and exceptions to one browser-safe failure", async () => {
    const failedExecutor = {
      execute: vi.fn().mockResolvedValue({
        functionName: null,
        data: null,
        error: "solmind_suggested_waypoint_rpc_failed",
      }),
    };
    const deps = {
      principalSource:
        createInMemoryRequestAuthPrincipalSource(GUIDE_PRINCIPAL),
      authSource: createInMemoryAuthSource(fixture()),
      executor: failedExecutor,
      identifiers: IDENTIFIERS,
    };

    const failed = await resolveSuggestedWaypointRequest(deps, GUIDE_CREATE_REQUEST);
    expect(failed.error).toBe(SUGGESTED_WAYPOINT_REQUEST_FAILED);

    failedExecutor.execute.mockRejectedValueOnce(new Error("transport detail"));
    const thrown = await resolveSuggestedWaypointRequest(deps, GUIDE_CREATE_REQUEST);
    expect(thrown).toEqual({
      ok: false,
      data: null,
      error: SUGGESTED_WAYPOINT_REQUEST_FAILED,
    });
  });

  it.each([
    {
      role: "Guide",
      principal: GUIDE_PRINCIPAL,
      request: {
        kind: "guide.get" as const,
        relationshipId: RELATIONSHIP_ID,
        suggestedWaypointId: SUGGESTION_ID,
      },
      functionName: "solmind_get_guide_suggested_waypoint" as const,
    },
    {
      role: "Explorer",
      principal: EXPLORER_PRINCIPAL,
      request: {
        kind: "explorer.get" as const,
        suggestedWaypointId: SUGGESTION_ID,
      },
      functionName: "solmind_get_explorer_suggested_waypoint" as const,
    },
    {
      role: "Explorer list relationship invariant",
      principal: EXPLORER_PRINCIPAL,
      request: {
        kind: "explorer.list" as const,
        pageSize: 10 as const,
        cursor: null,
      },
      functionName: "solmind_list_explorer_suggested_waypoints" as const,
    },
  ])(
    "maps a function-bound $role denial to the browser-safe request denial",
    async ({ principal, request, functionName }) => {
      const executor = {
        execute: vi.fn().mockResolvedValue({
          functionName,
          data: null,
          error: SUGGESTED_WAYPOINT_RPC_DENIED,
        }),
      };

      const result = await resolveSuggestedWaypointRequest(
        {
          principalSource: createInMemoryRequestAuthPrincipalSource(principal),
          authSource: createInMemoryAuthSource(fixture()),
          executor,
        },
        request,
      );

      expect(result).toEqual({
        ok: false,
        data: null,
        error: SUGGESTED_WAYPOINT_REQUEST_DENIED,
      });
    },
  );

  it("fails closed when a detail denial names a different function", async () => {
    const executor = {
      execute: vi.fn().mockResolvedValue({
        functionName: "solmind_get_explorer_suggested_waypoint",
        data: null,
        error: SUGGESTED_WAYPOINT_RPC_DENIED,
      }),
    };

    const result = await resolveSuggestedWaypointRequest(
      {
        principalSource:
          createInMemoryRequestAuthPrincipalSource(GUIDE_PRINCIPAL),
        authSource: createInMemoryAuthSource(fixture()),
        executor,
      },
      {
        kind: "guide.get",
        relationshipId: RELATIONSHIP_ID,
        suggestedWaypointId: SUGGESTION_ID,
      },
    );

    expect(result.error).toBe(SUGGESTED_WAYPOINT_REQUEST_FAILED);
  });

  it.each([
    {
      role: "Guide",
      principal: GUIDE_PRINCIPAL,
      request: {
        kind: "guide.list" as const,
        relationshipId: RELATIONSHIP_ID,
        pageSize: 10 as const,
        cursor: "YWJjZA==",
      },
      functionName: "solmind_list_guide_suggested_waypoints" as const,
    },
    {
      role: "Explorer",
      principal: EXPLORER_PRINCIPAL,
      request: {
        kind: "explorer.list" as const,
        pageSize: 10 as const,
        cursor: "YWJjZA==",
      },
      functionName: "solmind_list_explorer_suggested_waypoints" as const,
    },
  ])(
    "maps a function-bound $role stale cursor to the browser-safe request result",
    async ({ principal, request, functionName }) => {
      const executor = {
        execute: vi.fn().mockResolvedValue({
          functionName,
          data: null,
          error: SUGGESTED_WAYPOINT_RPC_REFRESH_REQUIRED,
        }),
      };

      const result = await resolveSuggestedWaypointRequest(
        {
          principalSource: createInMemoryRequestAuthPrincipalSource(principal),
          authSource: createInMemoryAuthSource(fixture()),
          executor,
        },
        request,
      );

      expect(result).toEqual({
        ok: false,
        data: null,
        error: SUGGESTED_WAYPOINT_REQUEST_REFRESH_REQUIRED,
      });
      expect(Object.isFrozen(result)).toBe(true);
    },
  );

  it("fails closed when a refresh-required result names a different list function", async () => {
    const executor = {
      execute: vi.fn().mockResolvedValue({
        functionName: "solmind_list_explorer_suggested_waypoints",
        data: null,
        error: SUGGESTED_WAYPOINT_RPC_REFRESH_REQUIRED,
      }),
    };

    const result = await resolveSuggestedWaypointRequest(
      {
        principalSource:
          createInMemoryRequestAuthPrincipalSource(GUIDE_PRINCIPAL),
        authSource: createInMemoryAuthSource(fixture()),
        executor,
      },
      {
        kind: "guide.list",
        relationshipId: RELATIONSHIP_ID,
        pageSize: 10,
        cursor: "YWJjZA==",
      },
    );

    expect(result).toEqual({
      ok: false,
      data: null,
      error: SUGGESTED_WAYPOINT_REQUEST_FAILED,
    });
  });

  it("fails closed when the executor result names a different function", async () => {
    const executor = {
      execute: vi.fn().mockResolvedValue({
        functionName: "solmind_list_guide_suggested_waypoints",
        data: { items: [], next_cursor: null, total_count: 0 },
        error: null,
      }),
    };

    const result = await resolveSuggestedWaypointRequest(
      {
        principalSource:
          createInMemoryRequestAuthPrincipalSource(GUIDE_PRINCIPAL),
        authSource: createInMemoryAuthSource(fixture()),
        executor,
        identifiers: IDENTIFIERS,
      },
      GUIDE_CREATE_REQUEST,
    );

    expect(result).toEqual({
      ok: false,
      data: null,
      error: SUGGESTED_WAYPOINT_REQUEST_FAILED,
    });
  });

  it("fails closed when the server identifier resolver is absent or invalid", async () => {
    const executor = makeExecutor();
    const baseDeps = {
      principalSource:
        createInMemoryRequestAuthPrincipalSource(GUIDE_PRINCIPAL),
      authSource: createInMemoryAuthSource(fixture()),
      executor,
    };

    const absent = await resolveSuggestedWaypointRequest(
      baseDeps,
      GUIDE_CREATE_REQUEST,
    );
    expect(absent.error).toBe(SUGGESTED_WAYPOINT_REQUEST_FAILED);

    const invalid = await resolveSuggestedWaypointRequest(
      {
        ...baseDeps,
        identifiers: {
          suggestedWaypointIdForCreate: () => "not-a-uuid",
          versionIdForSchedule: () => VERSION_ID,
        },
      },
      GUIDE_CREATE_REQUEST,
    );
    expect(invalid.error).toBe(SUGGESTED_WAYPOINT_REQUEST_FAILED);
    expect(executor.execute).not.toHaveBeenCalled();
  });
});

describe("resolveSuggestedWaypointRequest - closed operation catalog", () => {
  it.each([
    GUIDE_CREATE_REQUEST,
    {
      kind: "guide.save_draft",
      relationshipId: RELATIONSHIP_ID,
      operationId: OPERATION_ID,
      suggestedWaypointId: SUGGESTION_ID,
      expectedRevision: 1,
      destination: "Protect one evening for recovery",
      why: "Create dependable recovery space.",
      arrivalSignals: ["One evening remains unscheduled."],
    },
    {
      kind: "guide.schedule_send",
      relationshipId: RELATIONSHIP_ID,
      operationId: OPERATION_ID,
      suggestedWaypointId: SUGGESTION_ID,
      expectedRevision: 1,
    },
    {
      kind: "guide.pull_back",
      relationshipId: RELATIONSHIP_ID,
      operationId: OPERATION_ID,
      suggestedWaypointId: SUGGESTION_ID,
      expectedRevision: 1,
      expectedPendingVersionId: VERSION_ID,
    },
    {
      kind: "guide.list",
      relationshipId: RELATIONSHIP_ID,
      pageSize: 10,
      cursor: null,
    },
    {
      kind: "guide.get",
      relationshipId: RELATIONSHIP_ID,
      suggestedWaypointId: SUGGESTION_ID,
    },
  ])("accepts the Guide client shape for $kind", async (request) => {
    const executor = makeExecutor();
    const result = await resolveSuggestedWaypointRequest(
      {
        principalSource:
          createInMemoryRequestAuthPrincipalSource(GUIDE_PRINCIPAL),
        authSource: createInMemoryAuthSource(fixture()),
        executor,
        identifiers: IDENTIFIERS,
      },
      request,
    );
    expect(result.ok).toBe(true);
    expect(result.data).not.toBeNull();
    expect(executor.execute).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      kind: "explorer.mark_read",
      operationId: OPERATION_ID,
      suggestedWaypointId: SUGGESTION_ID,
      versionId: VERSION_ID,
    },
    {
      kind: "explorer.acknowledge",
      operationId: OPERATION_ID,
      suggestedWaypointId: SUGGESTION_ID,
      expectedCurrentVersionId: VERSION_ID,
    },
    { kind: "explorer.list", pageSize: 10, cursor: null },
    { kind: "explorer.get", suggestedWaypointId: SUGGESTION_ID },
  ])("accepts the Explorer client shape for $kind", async (request) => {
    const executor = makeExecutor();
    const result = await resolveSuggestedWaypointRequest(
      {
        principalSource:
          createInMemoryRequestAuthPrincipalSource(EXPLORER_PRINCIPAL),
        authSource: createInMemoryAuthSource(fixture()),
        executor,
      },
      request,
    );
    expect(result.ok).toBe(true);
    expect(result.data).not.toBeNull();
    expect(executor.execute).toHaveBeenCalledTimes(1);
  });

  it("rejects unknown and worker operations", async () => {
    const executor = makeExecutor();
    for (const input of [
      { kind: "admin.list" },
      { kind: "worker.deliver", suggestedWaypointId: SUGGESTION_ID },
    ]) {
      const result = await resolveSuggestedWaypointRequest(
        {
          principalSource:
            createInMemoryRequestAuthPrincipalSource(GUIDE_PRINCIPAL),
          authSource: createInMemoryAuthSource(fixture()),
          executor,
        },
        input,
      );
      expect(result.error).toBe(SUGGESTED_WAYPOINT_REQUEST_DENIED);
    }
    expect(executor.execute).not.toHaveBeenCalled();
  });
});
