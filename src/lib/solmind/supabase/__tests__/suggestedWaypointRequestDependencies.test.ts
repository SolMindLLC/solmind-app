import { beforeEach, describe, expect, it, vi } from "vitest";

import * as supabaseBarrel from "../index";

const mocks = vi.hoisted(() => ({
  createPrincipalSource: vi.fn(),
  createServiceRoleClient: vi.fn(),
  createServiceRoleRpcExecutor: vi.fn(),
  createAuthQueryClient: vi.fn(),
  createAuthSource: vi.fn(),
  createHumanExecutor: vi.fn(),
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
    mocks.createPrincipalSource.mockReturnValue(principalSource);
    mocks.createServiceRoleClient.mockReturnValue(serviceRoleClient);
    mocks.createServiceRoleRpcExecutor.mockReturnValue(authQueryExecutor);
    mocks.createAuthQueryClient.mockReturnValue(authQueryClient);
    mocks.createAuthSource.mockReturnValue(authSource);
    mocks.createHumanExecutor.mockReturnValue(humanExecutor);
    mocks.createIdentifiers.mockReturnValue(identifiers);
  });

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
    expect(mocks.createIdentifiers).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      principalSource,
      authSource,
      executor: humanExecutor,
      identifiers,
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("constructs identifiers as a required production dependency", () => {
    const result = createSuggestedWaypointRequestDependencies({ cookies });

    expect(result.identifiers).toBe(identifiers);
    expect(Object.keys(result).sort()).toEqual([
      "authSource",
      "executor",
      "identifiers",
      "principalSource",
    ]);
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
