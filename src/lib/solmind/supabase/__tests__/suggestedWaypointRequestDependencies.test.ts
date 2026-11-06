import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as supabaseBarrel from "../index";
const notice = vi.hoisted(() => ({ check: vi.fn() }));
vi.mock("../../auth/explorerEarlyTestNoticeAccess", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../auth/explorerEarlyTestNoticeAccess")>(),
  checkExplorerEarlyTestNoticeAccess: notice.check,
}));
import { EXPLORER_EARLY_TEST_NOTICE_CAPABILITY_ENV } from "../../auth/explorerEarlyTestNoticeAccess";

const mocks = vi.hoisted(() => ({
  createPrincipalSource: vi.fn(),
  createServiceRoleClient: vi.fn(),
  createServiceRoleRpcExecutor: vi.fn(),
  createAuthQueryClient: vi.fn(),
  createAuthSource: vi.fn(),
  createHumanExecutor: vi.fn(),
  createRelationshipSelectorExecutor: vi.fn(),
  createIdentifiers: vi.fn(),
}));

vi.mock("../requestAuthClient", () => ({
  createSupabaseRequestAuthPrincipalSource: mocks.createPrincipalSource,
}));
vi.mock("../serviceRoleClient", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}));
vi.mock("../serviceRoleRpcExecutor", () => ({
  createServiceRoleRpcExecutor: mocks.createServiceRoleRpcExecutor,
}));
vi.mock("../supabaseAuthQueryClient", () => ({
  createSupabaseAuthQueryClient: mocks.createAuthQueryClient,
}));
vi.mock("../serverAuthSourceAdapter", () => ({
  createSupabaseAuthSource: mocks.createAuthSource,
}));
vi.mock("../suggestedWaypointRpcExecutor", () => ({
  createSuggestedWaypointHumanRpcExecutor: mocks.createHumanExecutor,
}));
vi.mock("../suggestedWaypointRelationshipSelectorExecutor", () => ({
  createSuggestedWaypointRelationshipSelectorExecutor:
    mocks.createRelationshipSelectorExecutor,
}));
vi.mock("../suggestedWaypointScopedIdentifiers", () => ({
  createSuggestedWaypointScopedIdentifiers: mocks.createIdentifiers,
}));

import {
  SUGGESTED_WAYPOINT_REQUEST_DEPENDENCY_CONFIGURATION_FAILED,
  createSuggestedWaypointRequestDependencies,
} from "../suggestedWaypointRequestDependencies";

const principalSource = Object.freeze({
  resolveAuthenticatedUser: vi.fn(),
});
const serviceRoleClient = Object.freeze({ kind: "service-role-client" });
const authQueryExecutor = Object.freeze({ select: vi.fn() });
const authQueryClient = Object.freeze({ kind: "auth-query-client" });
const authSource = Object.freeze({ kind: "auth-source" });
const humanExecutor = Object.freeze({ execute: vi.fn() });
const relationshipSelectorExecutor = Object.freeze({ execute: vi.fn() });
const identifiers = Object.freeze({
  suggestedWaypointIdForCreate: vi.fn(),
  versionIdForSchedule: vi.fn(),
});
const cookies = Object.freeze({
  getAll: vi.fn(() => []),
  setAll: vi.fn(),
});

describe("createSuggestedWaypointRequestDependencies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv(EXPLORER_EARLY_TEST_NOTICE_CAPABILITY_ENV, "enabled");
    mocks.createPrincipalSource.mockReturnValue(principalSource);
    mocks.createServiceRoleClient.mockReturnValue(serviceRoleClient);
    mocks.createServiceRoleRpcExecutor.mockReturnValue(authQueryExecutor);
    mocks.createAuthQueryClient.mockReturnValue(authQueryClient);
    mocks.createAuthSource.mockReturnValue(authSource);
    mocks.createHumanExecutor.mockReturnValue(humanExecutor);
    mocks.createRelationshipSelectorExecutor.mockReturnValue(
      relationshipSelectorExecutor,
    );
    mocks.createIdentifiers.mockReturnValue(identifiers);
  });

  afterEach(() => { vi.unstubAllEnvs(); });

  it("assembles one request-scoped concrete dependency graph", () => {
    const now = vi.fn(() => new Date("2026-08-14T12:00:00.000Z"));

    const result = createSuggestedWaypointRequestDependencies({ cookies, now });

    expect(mocks.createPrincipalSource).toHaveBeenCalledWith({ cookies });
    expect(mocks.createServiceRoleClient).toHaveBeenCalledTimes(1);
    expect(mocks.createServiceRoleRpcExecutor).toHaveBeenCalledWith(
      serviceRoleClient,
    );
    expect(mocks.createAuthQueryClient).toHaveBeenCalledWith({
      client: authQueryExecutor,
      now,
    });
    expect(mocks.createAuthSource).toHaveBeenCalledWith(authQueryClient);
    expect(mocks.createHumanExecutor).toHaveBeenCalledWith(serviceRoleClient);
    expect(mocks.createRelationshipSelectorExecutor).toHaveBeenCalledWith(
      serviceRoleClient,
    );
    expect(mocks.createIdentifiers).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      principalSource,
      authSource,
      executor: humanExecutor,
      checkExplorerNoticeAccess: expect.any(Function),
      relationshipSelectorExecutor,
      identifiers,
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("constructs identifiers as a required production dependency", () => {
    const result = createSuggestedWaypointRequestDependencies({ cookies });

    expect(result.identifiers).toBe(identifiers);
    expect(Object.keys(result).sort()).toEqual([
      "authSource",
      "checkExplorerNoticeAccess",
      "executor",
      "identifiers",
      "principalSource",
      "relationshipSelectorExecutor",
    ]);
  });

  it("always installs the Explorer gate and passes only its server-proved actor", async () => {
    const result = createSuggestedWaypointRequestDependencies({ cookies });
    const actor = { accountId: "10000000-0000-4000-8000-000000000001",
      applicationSessionId: "20000000-0000-4000-8000-000000000001" };
    for (const status of ["required", "unavailable", "denied", "allowed"]) {
      notice.check.mockResolvedValue({ status, noticeVersion: null });
      expect(await result.checkExplorerNoticeAccess!(actor)).toBe(status === "allowed");
      expect(notice.check).toHaveBeenLastCalledWith(expect.objectContaining({ readSetting: expect.any(Function),
        read: expect.any(Function), agree: expect.any(Function) }), actor);
    }
    expect(humanExecutor.execute).not.toHaveBeenCalled();
  });

  it("keeps the required Explorer check without calling the notice gate when the capability is off", async () => {
    vi.stubEnv(EXPLORER_EARLY_TEST_NOTICE_CAPABILITY_ENV, undefined);
    const result = createSuggestedWaypointRequestDependencies({ cookies });
    expect(await result.checkExplorerNoticeAccess({
      accountId: "10000000-0000-4000-8000-000000000001",
      applicationSessionId: "20000000-0000-4000-8000-000000000001",
    })).toBe(true);
    expect(notice.check).not.toHaveBeenCalled();
    expect(humanExecutor.execute).not.toHaveBeenCalled();
  });

  it("supplies a server clock when the caller omits one", () => {
    createSuggestedWaypointRequestDependencies({ cookies });

    const call = mocks.createAuthQueryClient.mock.calls[0][0] as {
      now: () => Date;
    };
    expect(call.now()).toBeInstanceOf(Date);
  });

  it("maps construction failures to one value-free error", () => {
    mocks.createServiceRoleClient.mockImplementation(() => {
      throw new Error("secret-bearing upstream detail");
    });

    expect(() =>
      createSuggestedWaypointRequestDependencies({ cookies }),
    ).toThrow(SUGGESTED_WAYPOINT_REQUEST_DEPENDENCY_CONFIGURATION_FAILED);
    expect(mocks.createHumanExecutor).not.toHaveBeenCalled();
    expect(mocks.createIdentifiers).not.toHaveBeenCalled();
  });

  it("keeps the concrete factory and identifier source off the shared barrel", () => {
    expect(
      "createSuggestedWaypointRequestDependencies" in supabaseBarrel,
    ).toBe(false);
    expect("createSuggestedWaypointScopedIdentifiers" in supabaseBarrel).toBe(
      false,
    );
  });
});
