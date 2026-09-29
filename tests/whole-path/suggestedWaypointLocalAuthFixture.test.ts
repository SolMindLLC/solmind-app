import { describe, expect, it, vi } from "vitest";

import {
  runWithSuggestedWaypointLocalAuthFixture,
  type SuggestedWaypointLocalFixture,
  type SuggestedWaypointLocalFixtureDependencies,
  type SuggestedWaypointRoleSession,
} from "./suggestedWaypointLocalAuthFixture";
import {
  WHOLE_PATH_APPROVAL_GATE,
  WHOLE_PATH_EFFECT_GATE,
  type SuggestedWaypointWholePathRole,
} from "./suggestedWaypointWholePathSafety";

vi.mock("node:crypto", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:crypto")>()),
  randomBytes: (size: number) => Buffer.alloc(size),
}));

const ROLES = [
  "assigned-guide",
  "assigned-explorer",
  "unrelated-guide",
  "unrelated-explorer",
  "ended-explorer",
] as const satisfies readonly SuggestedWaypointWholePathRole[];

function environment(): Record<string, string> {
  return {
    SOLMIND_WHOLE_PATH_APPROVAL: WHOLE_PATH_APPROVAL_GATE,
    SOLMIND_WHOLE_PATH_ALLOW_LOCAL_EFFECTS: WHOLE_PATH_EFFECT_GATE,
    SOLMIND_WHOLE_PATH_RUN_ID: "S03G-20260822-fixture",
    SOLMIND_LOCAL_SUPABASE_PROJECT_ID: "solmind-app",
    SOLMIND_LOCAL_SUPABASE_URL: "http://127.0.0.1:54321",
    SOLMIND_LOCAL_DATABASE_PORT: "54322",
    SOLMIND_TRUSTED_APP_ORIGIN: "http://127.0.0.1:4627",
  };
}

function authId(index: number): string {
  return `1000000${index}-0000-4000-8000-00000000000${index}`;
}

function harness(failAt?: string) {
  const events: string[] = [];
  let createIndex = 0;
  const dependencies: SuggestedWaypointLocalFixtureDependencies = {
    async resetLocalDatabase() {
      events.push("reset");
      if (failAt === "reset-before" && events.length === 1) {
        throw new Error("protected reset detail");
      }
    },
    async assertNoAuthEmailCollisions(emails) {
      events.push(`collision:${emails.length}`);
      if (failAt === "collision") throw new Error("protected collision detail");
    },
    async createAuthUser() {
      const index = createIndex;
      createIndex += 1;
      events.push(`create:${index}`);
      if (failAt === `create:${index}`) throw new Error("protected create detail");
      return { id: authId(index) };
    },
    async deleteAuthUser(id) {
      events.push(`delete:${id}`);
      if (failAt === "delete") throw new Error("protected delete detail");
    },
    async executeFixtureSql(sql) {
      events.push(`sql:${sql.includes("begin;")}`);
      if (failAt === "sql") throw new Error("protected sql detail");
    },
    async createRoleSession() {
      const index = sessions.length;
      events.push(`session:${index}`);
      if (failAt === `session:${index}`) throw new Error("protected session detail");
      const session: SuggestedWaypointRoleSession = {
        cookies: () => Object.freeze([{ name: `cookie-${index}`, value: "protected", options: Object.freeze({}) }]),
        async clear() {
          events.push(`clear:${index}`);
        },
      };
      sessions.push(session);
      return session;
    },
  };
  const sessions: SuggestedWaypointRoleSession[] = [];
  return { events, dependencies };
}

function options(
  dependencies: SuggestedWaypointLocalFixtureDependencies,
  runScenario: (
    fixture: SuggestedWaypointLocalFixture,
  ) => Promise<string> = vi.fn(async () => "scenario-complete"),
) {
  return {
    environment: environment(),
    loadSecrets: vi.fn(async () => ({
      anonKey: "anon-key-with-at-least-sixteen-characters",
      serviceRoleKey: "service-key-with-at-least-sixteen-characters",
    })),
    createDependencies: vi.fn(() => dependencies),
    generatePassword: (role: SuggestedWaypointWholePathRole) =>
      `${role}.password-with-at-least-thirty-two-characters`,
    runScenario,
  };
}

describe("Suggested Waypoint local Auth fixture lifecycle", () => {
  it("refuses before secret or dependency access without the exact gate pair", async () => {
    const loadSecrets = vi.fn(async () => {
      throw new Error("must not be called");
    });
    const createDependencies = vi.fn();

    await expect(
      runWithSuggestedWaypointLocalAuthFixture({
        environment: {},
        loadSecrets,
        createDependencies,
        runScenario: vi.fn(),
      }),
    ).resolves.toEqual({ status: "refused" });
    expect(loadSecrets).not.toHaveBeenCalled();
    expect(createDependencies).not.toHaveBeenCalled();
  });

  it("runs five isolated actors and always cleans them in reverse order", async () => {
    const { events, dependencies } = harness();
    const runScenario = vi.fn(async (fixture: SuggestedWaypointLocalFixture) => {
      expect(fixture.actors.map((actor) => actor.role)).toEqual(ROLES);
      expect(new Set(fixture.actors.map((actor) => actor.session)).size).toBe(5);
      expect(fixture.actors.every((actor) => !("authUserId" in actor))).toBe(true);
      expect(
        fixture.actors.every((actor) => !("authUserId" in actor.session)),
      ).toBe(true);
      expect(fixture.scenarioIds.assignedRelationshipId).toBe(
        "02208000-5000-4000-8000-000000000001",
      );
      events.push("scenario");
      return "scenario-complete";
    });

    await expect(
      runWithSuggestedWaypointLocalAuthFixture(options(dependencies, runScenario)),
    ).resolves.toEqual({ status: "completed", result: "scenario-complete" });

    expect(events.slice(0, 3)).toEqual(["reset", "collision:5", "create:0"]);
    expect(events.filter((event) => event.startsWith("create:"))).toHaveLength(5);
    expect(events.filter((event) => event.startsWith("session:"))).toHaveLength(5);
    expect(events.filter((event) => event.startsWith("clear:"))).toEqual([
      "clear:4", "clear:3", "clear:2", "clear:1", "clear:0",
    ]);
    expect(events.filter((event) => event.startsWith("delete:"))).toEqual([
      `delete:${authId(4)}`,
      `delete:${authId(3)}`,
      `delete:${authId(2)}`,
      `delete:${authId(1)}`,
      `delete:${authId(0)}`,
    ]);
    expect(events.at(-1)).toBe("reset");
  });

  it.each([
    "collision",
    "create:0",
    "create:2",
    "sql",
    "session:0",
    "session:3",
  ])("cleans every exact prior owner after injected %s failure", async (failAt) => {
    const { events, dependencies } = harness(failAt);
    await expect(
      runWithSuggestedWaypointLocalAuthFixture(options(dependencies)),
    ).rejects.toThrow("whole_path_fixture_run_failed");
    expect(events.at(-1)).toBe("reset");
    expect(events.join(" ")).not.toContain("protected");
    const created = events.filter((event) => event.startsWith("create:")).length;
    const deleted = events.filter((event) => event.startsWith("delete:")).length;
    expect(deleted).toBe(Math.min(created, Number(failAt.startsWith("create:")) ? created - 1 : created));
  });

  it("reports cleanup failure without exposing the underlying error", async () => {
    const { dependencies } = harness("delete");
    await expect(
      runWithSuggestedWaypointLocalAuthFixture(options(dependencies)),
    ).rejects.toThrow("whole_path_fixture_cleanup_failed");
  });

  it("maps secret-loader and dependency-construction failures to one fixed error", async () => {
    const { dependencies } = harness();
    const secretFailure = options(dependencies);
    secretFailure.loadSecrets = vi.fn(async () => {
      throw new Error("protected environment output");
    });
    await expect(
      runWithSuggestedWaypointLocalAuthFixture(secretFailure),
    ).rejects.toThrow("whole_path_fixture_initialization_failed");

    const dependencyFailure = options(dependencies);
    dependencyFailure.createDependencies = vi.fn(() => {
      throw new Error("protected client output");
    });
    await expect(
      runWithSuggestedWaypointLocalAuthFixture(dependencyFailure),
    ).rejects.toThrow("whole_path_fixture_initialization_failed");
  });

  it("cleans after the scenario fails and returns only a fixed value-free error", async () => {
    const { events, dependencies } = harness();
    const scenario = vi.fn(async () => {
      throw new Error("protected scenario response body");
    });
    await expect(
      runWithSuggestedWaypointLocalAuthFixture(options(dependencies, scenario)),
    ).rejects.toThrow("whole_path_fixture_run_failed");
    expect(events.filter((event) => event.startsWith("delete:"))).toHaveLength(5);
    expect(events.at(-1)).toBe("reset");
  });

  it("generates default passwords that meet the local Auth password policy even when the random part has no digit", async () => {
    const { dependencies } = harness();
    const passwords: string[] = [];
    const capturing: SuggestedWaypointLocalFixtureDependencies = {
      ...dependencies,
      async createAuthUser(email, password) {
        passwords.push(password);
        return dependencies.createAuthUser(email, password);
      },
    };
    await expect(
      runWithSuggestedWaypointLocalAuthFixture({ ...options(capturing), generatePassword: undefined }),
    ).resolves.toEqual({ status: "completed", result: "scenario-complete" });

    expect(passwords).toHaveLength(5);
    for (const password of passwords) {
      expect(password.length).toBeGreaterThanOrEqual(32);
      expect(password).toMatch(/[a-z]/u);
      expect(password).toMatch(/[A-Z]/u);
      expect(password).toMatch(/[0-9]/u);
      expect(password).toMatch(/[^A-Za-z0-9]/u);
      expect(password).not.toMatch(/[<>]/u);
    }
  });
});
