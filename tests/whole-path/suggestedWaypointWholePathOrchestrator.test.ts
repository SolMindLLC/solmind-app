import { describe, expect, it, vi } from "vitest";

import {
  parseSuggestedWaypointExplorerCommandRouteInput,
  projectSuggestedWaypointExplorerCommandResult,
} from "@/lib/solmind/supabase/suggestedWaypointExplorerCommandRouteContract";

import type {
  SuggestedWaypointLocalFixtureDependencies,
  SuggestedWaypointRoleSession,
} from "./suggestedWaypointLocalAuthFixture";
import type { SuggestedWaypointPlaywrightContext } from "./suggestedWaypointPlaywrightSession";
import {
  runSuggestedWaypointWholePath,
  runSuggestedWaypointWholePathScenarioStep,
  type SuggestedWaypointOwnedPlaywrightBrowser,
  type SuggestedWaypointWholePathOrchestratorOptions,
} from "./suggestedWaypointWholePathOrchestrator";
import {
  SUGGESTED_WAYPOINT_GUIDE_DRAFT_CREATE_FAILURE_REASONS,
  SuggestedWaypointGuideDraftCreateFailure,
} from "./suggestedWaypointWholePathGuideDraftDiagnostics";
import {
  SUGGESTED_WAYPOINT_GUIDE_RELATIONSHIP_ENTRY_FAILURE_REASONS,
  SuggestedWaypointGuideRelationshipEntryFailure,
} from "./suggestedWaypointWholePathGuideRelationshipEntryDiagnostics";
import {
  SUGGESTED_WAYPOINT_GUIDE_SCHEDULE_PULL_BACK_RESCHEDULE_FAILURE_REASONS,
  SuggestedWaypointGuideSchedulePullBackRescheduleFailure,
} from "./suggestedWaypointWholePathGuideScheduleDiagnostics";
import {
  WHOLE_PATH_APPROVAL_GATE,
  WHOLE_PATH_EFFECT_GATE,
  type SuggestedWaypointWholePathRole,
} from "./suggestedWaypointWholePathSafety";

const ROLES = [
  "assigned-guide",
  "assigned-explorer",
  "unrelated-guide",
  "unrelated-explorer",
  "ended-explorer",
] as const satisfies readonly SuggestedWaypointWholePathRole[];

const CONTRACT_OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const CONTRACT_SUGGESTION_ID = "55555555-5555-4555-8555-555555555555";
const CONTRACT_VERSION_ID = "66666666-6666-4666-8666-666666666666";

describe("Suggested Waypoint whole-path Explorer denial canary", () => {
  it("pins relationship_unavailable to the banked value-free non-success shape", () => {
    const routeInput = parseSuggestedWaypointExplorerCommandRouteInput(
      {
        kind: "explorer.mark_read",
        operationId: CONTRACT_OPERATION_ID,
        versionId: CONTRACT_VERSION_ID,
      },
      CONTRACT_SUGGESTION_ID,
    );
    expect(routeInput).not.toBeNull();
    expect(
      projectSuggestedWaypointExplorerCommandResult(routeInput!, {
        ok: true,
        data: {
          outcome_code: "relationship_unavailable",
          operation_id: CONTRACT_OPERATION_ID,
          suggested_waypoint_id: null,
          authoring_revision: null,
          current_version_id: null,
          committed_at: null,
          read_at: null,
        },
        error: null,
      }),
    ).toEqual({
      ok: false,
      outcome: "relationship_unavailable",
      suggestedWaypointId: null,
      error: null,
    });
  });
});

function environment(): Record<string, string> {
  return {
    SOLMIND_WHOLE_PATH_APPROVAL: WHOLE_PATH_APPROVAL_GATE,
    SOLMIND_WHOLE_PATH_ALLOW_LOCAL_EFFECTS: WHOLE_PATH_EFFECT_GATE,
    SOLMIND_WHOLE_PATH_RUN_ID: "S03G-20260822-orchestrator",
    SOLMIND_LOCAL_SUPABASE_PROJECT_ID: "solmind-app",
    SOLMIND_LOCAL_SUPABASE_URL: "http://127.0.0.1:54321",
    SOLMIND_LOCAL_DATABASE_PORT: "54322",
    SOLMIND_TRUSTED_APP_ORIGIN: "http://127.0.0.1:4627",
  };
}

function authId(index: number): string {
  return `2000000${index}-0000-4000-8000-00000000000${index}`;
}

type Failure =
  | "browser-create"
  | "add-cookie:3"
  | "add-cookie:3+context-close:2"
  | "context-close:2"
  | "browser-close"
  | "scenario"
  | "scenario-step"
  | "scenario-step+auth-delete"
  | "session-clear:1"
  | "auth-delete"
  | "final-reset";

function harness(failure?: Failure) {
  const events: string[] = [];
  let authIndex = 0;
  let sessionIndex = 0;
  let contextIndex = 0;
  let resetCount = 0;

  const dependencies: SuggestedWaypointLocalFixtureDependencies = {
    async resetLocalDatabase() {
      events.push(`reset:${resetCount}`);
      resetCount += 1;
      if (failure === "final-reset" && resetCount === 2) {
        throw new Error("protected final-reset detail");
      }
    },
    async assertNoAuthEmailCollisions(emails) {
      events.push(`collision:${emails.length}`);
    },
    async createAuthUser() {
      const index = authIndex;
      authIndex += 1;
      events.push(`auth-create:${index}`);
      return { id: authId(index) };
    },
    async deleteAuthUser(id) {
      events.push(`auth-delete:${id}`);
      if (
        failure === "auth-delete" ||
        failure === "scenario-step+auth-delete"
      ) {
        throw new Error("protected auth-delete detail");
      }
    },
    async executeFixtureSql(sql) {
      events.push(`sql:${sql.includes("begin;")}`);
    },
    async createRoleSession() {
      const index = sessionIndex;
      sessionIndex += 1;
      events.push(`session:${index}`);
      const session: SuggestedWaypointRoleSession = Object.freeze({
        cookies: () =>
          Object.freeze([
            Object.freeze({
              name: `sb-role-${index}`,
              value: `role-session-${index}`,
              options: Object.freeze({ path: "/", sameSite: "lax" as const }),
            }),
          ]),
        async clear() {
          events.push(`session-clear:${index}`);
          if (failure === `session-clear:${index}`) {
            throw new Error("protected session-clear detail");
          }
        },
      });
      return session;
    },
  };

  const createBrowser = vi.fn(async () => {
    events.push("browser-create");
    if (failure === "browser-create") {
      throw new Error("protected browser-create detail");
    }
    const browser: SuggestedWaypointOwnedPlaywrightBrowser = {
      async newContext() {
        const index = contextIndex;
        contextIndex += 1;
        events.push(`context:${index}`);
        const context: SuggestedWaypointPlaywrightContext = {
          async newPage() {
            throw new Error("test_context_has_no_page");
          },
          async addCookies(cookies) {
            events.push(`cookies:${index}:${cookies.length}`);
            if (
              failure === `add-cookie:${index}` ||
              (failure === "add-cookie:3+context-close:2" && index === 3)
            ) {
              throw new Error("protected add-cookie detail");
            }
          },
          async close() {
            events.push(`context-close:${index}`);
            if (
              failure === `context-close:${index}` ||
              (failure === "add-cookie:3+context-close:2" && index === 2)
            ) {
              throw new Error("protected context-close detail");
            }
          },
        };
        return context;
      },
      async close() {
        events.push("browser-close");
        if (failure === "browser-close") {
          throw new Error("protected browser-close detail");
        }
      },
    };
    return browser;
  });

  return { events, dependencies, createBrowser };
}

function options(
  failure?: Failure,
): {
  target: ReturnType<typeof harness>;
  value: SuggestedWaypointWholePathOrchestratorOptions<string>;
} {
  const target = harness(failure);
  return {
    target,
    value: {
      environment: environment(),
      loadSecrets: vi.fn(async () => ({
        anonKey: "anon-key-with-at-least-sixteen-characters",
        serviceRoleKey: "service-key-with-at-least-sixteen-characters",
      })),
      createDependencies: vi.fn(() => target.dependencies),
      generatePassword: (role) =>
        `${role}.password-with-at-least-thirty-two-characters`,
      createBrowser: target.createBrowser,
      async runScenario(scenario) {
        target.events.push("scenario");
        expect(Object.isFrozen(scenario)).toBe(true);
        expect(scenario.config.trustedApplicationOrigin).toBe(
          "http://127.0.0.1:4627",
        );
        expect(scenario.actors.map((actor) => actor.role)).toEqual(ROLES);
        expect(scenario.scenarioIds.assignedRelationshipId).toBe(
          "02208000-5000-4000-8000-000000000001",
        );
        if (failure === "scenario") {
          throw new Error("protected scenario detail");
        }
        if (
          failure === "scenario-step" ||
          failure === "scenario-step+auth-delete"
        ) {
          return runSuggestedWaypointWholePathScenarioStep(
            "delivery_bridge",
            async () => {
              throw new Error("protected delivery detail");
            },
          );
        }
        return "scenario-complete";
      },
    },
  };
}

function cleanupEvents(events: readonly string[]): string[] {
  return events.filter((event) =>
    /^(?:context-close|browser-close|session-clear|auth-delete|reset:1)/u.test(
      event,
    ),
  );
}

describe("Suggested Waypoint whole-path lifecycle orchestrator", () => {
  it("refuses before secret, dependency, or browser access without both gates", async () => {
    const target = harness();
    const loadSecrets = vi.fn(async () => {
      throw new Error("must not run");
    });
    await expect(
      runSuggestedWaypointWholePath({
        ...options().value,
        environment: {},
        loadSecrets,
        createBrowser: target.createBrowser,
      }),
    ).resolves.toEqual({ status: "refused" });
    expect(loadSecrets).not.toHaveBeenCalled();
    expect(target.createBrowser).not.toHaveBeenCalled();
  });

  it("completes one closed lifecycle in the exact cleanup order", async () => {
    const { target, value } = options();
    await expect(runSuggestedWaypointWholePath(value)).resolves.toEqual({
      status: "completed",
      result: "scenario-complete",
    });
    expect(target.createBrowser).toHaveBeenCalledTimes(1);
    expect(cleanupEvents(target.events)).toEqual([
      "context-close:4",
      "context-close:3",
      "context-close:2",
      "context-close:1",
      "context-close:0",
      "browser-close",
      "session-clear:4",
      "session-clear:3",
      "session-clear:2",
      "session-clear:1",
      "session-clear:0",
      `auth-delete:${authId(4)}`,
      `auth-delete:${authId(3)}`,
      `auth-delete:${authId(2)}`,
      `auth-delete:${authId(1)}`,
      `auth-delete:${authId(0)}`,
      "reset:1",
    ]);
  });

  it("uses the validated configuration even if the caller mutates its environment later", async () => {
    const { target, value } = options();
    const mutableEnvironment = environment();
    const loadSecrets = value.loadSecrets;
    await expect(
      runSuggestedWaypointWholePath({
        ...value,
        environment: mutableEnvironment,
        async loadSecrets() {
          mutableEnvironment.SOLMIND_WHOLE_PATH_APPROVAL = "changed";
          return loadSecrets();
        },
      }),
    ).resolves.toEqual({
      status: "completed",
      result: "scenario-complete",
    });
    expect(target.createBrowser).toHaveBeenCalledTimes(1);
  });

  it("does not create a browser when fixture initialization fails", async () => {
    const { target, value } = options();
    await expect(
      runSuggestedWaypointWholePath({
        ...value,
        async loadSecrets() {
          throw new Error("protected initialization detail");
        },
      }),
    ).rejects.toThrow("whole_path_fixture_initialization_failed");
    expect(target.createBrowser).not.toHaveBeenCalled();
  });

  it.each(["browser-create", "add-cookie:3", "scenario"] as const)(
    "maps %s failure to one value-free run category after cleanup",
    async (failure) => {
      const { target, value } = options(failure);
      const expectedStage =
        failure === "browser-create"
          ? "browser"
          : failure === "add-cookie:3"
            ? "bundle"
            : "scenario";
      await expect(runSuggestedWaypointWholePath(value)).rejects.toThrow(
        `whole_path_orchestrator_${expectedStage}_failed`,
      );
      expect(target.events).toContain("reset:1");
      expect(target.events.join(" ")).not.toContain("protected");
    },
  );

  it("preserves one closed value-free scenario step after cleanup", async () => {
    const { target, value } = options("scenario-step");
    await expect(runSuggestedWaypointWholePath(value)).rejects.toThrow(
      "whole_path_orchestrator_scenario_delivery_bridge_failed",
    );
    expect(target.events).toContain("reset:1");
    expect(target.events.join(" ")).not.toContain("protected");
  });

  it.each(SUGGESTED_WAYPOINT_GUIDE_RELATIONSHIP_ENTRY_FAILURE_REASONS)(
    "preserves the closed Guide relationship-entry %s subclass after cleanup",
    async (reason) => {
      const { target, value } = options();
      await expect(
        runSuggestedWaypointWholePath({
          ...value,
          async runScenario() {
            return runSuggestedWaypointWholePathScenarioStep(
              "guide_relationship_entry",
              async () => {
                throw new SuggestedWaypointGuideRelationshipEntryFailure(
                  reason,
                );
              },
            );
          },
        }),
      ).rejects.toThrow(
        `whole_path_orchestrator_scenario_guide_relationship_entry_${reason}_failed`,
      );
      expect(target.events).toContain("reset:1");
      expect(target.events.join(" ")).not.toContain("protected");
    },
  );

  it("does not preserve an arbitrary Guide relationship-entry error message", async () => {
    const { target, value } = options();
    await expect(
      runSuggestedWaypointWholePath({
        ...value,
        async runScenario() {
          return runSuggestedWaypointWholePathScenarioStep(
            "guide_relationship_entry",
            async () => {
              throw new Error("protected arbitrary Guide relationship detail");
            },
          );
        },
      }),
    ).rejects.toThrow(
      "whole_path_orchestrator_scenario_guide_relationship_entry_failed",
    );
    expect(target.events).toContain("reset:1");
    expect(target.events.join(" ")).not.toContain("protected");
  });

  it.each(SUGGESTED_WAYPOINT_GUIDE_DRAFT_CREATE_FAILURE_REASONS)(
    "preserves the closed Guide draft-create %s subclass after cleanup",
    async (reason) => {
      const { target, value } = options();
      await expect(
        runSuggestedWaypointWholePath({
          ...value,
          async runScenario() {
            return runSuggestedWaypointWholePathScenarioStep(
              "guide_draft_create",
              async () => {
                throw new SuggestedWaypointGuideDraftCreateFailure(reason);
              },
            );
          },
        }),
      ).rejects.toThrow(
        `whole_path_orchestrator_scenario_guide_draft_create_${reason}_failed`,
      );
      expect(target.events).toContain("reset:1");
      expect(target.events.join(" ")).not.toContain("protected");
    },
  );

  it("does not preserve an arbitrary Guide draft-create error message", async () => {
    const { target, value } = options();
    await expect(
      runSuggestedWaypointWholePath({
        ...value,
        async runScenario() {
          return runSuggestedWaypointWholePathScenarioStep(
            "guide_draft_create",
            async () => {
              throw new Error("protected arbitrary Guide draft detail");
            },
          );
        },
      }),
    ).rejects.toThrow(
      "whole_path_orchestrator_scenario_guide_draft_create_failed",
    );
    expect(target.events).toContain("reset:1");
    expect(target.events.join(" ")).not.toContain("protected");
  });

  it.each(SUGGESTED_WAYPOINT_GUIDE_SCHEDULE_PULL_BACK_RESCHEDULE_FAILURE_REASONS)(
    "preserves the closed Guide schedule/Pull Back/reschedule %s subclass after cleanup",
    async (reason) => {
      const { target, value } = options();
      await expect(
        runSuggestedWaypointWholePath({
          ...value,
          async runScenario() {
            return runSuggestedWaypointWholePathScenarioStep(
              "guide_schedule_pull_back_reschedule",
              async () => {
                throw new SuggestedWaypointGuideSchedulePullBackRescheduleFailure(
                  reason,
                );
              },
            );
          },
        }),
      ).rejects.toThrow(
        `whole_path_orchestrator_scenario_guide_schedule_pull_back_reschedule_${reason}_failed`,
      );
      expect(target.events).toContain("reset:1");
      expect(target.events.join(" ")).not.toContain("protected");
    },
  );

  it.each([
    ["an arbitrary error", () => new Error("protected arbitrary Guide schedule detail")],
    [
      "an unlisted subclass reason",
      () =>
        new SuggestedWaypointGuideSchedulePullBackRescheduleFailure(
          "protected-arbitrary-reason",
        ),
    ],
  ] as const)(
    "does not preserve %s from the Guide schedule/Pull Back/reschedule step",
    async (_label, makeError) => {
      const { target, value } = options();
      const outcome = runSuggestedWaypointWholePath({
        ...value,
        async runScenario() {
          return runSuggestedWaypointWholePathScenarioStep(
            "guide_schedule_pull_back_reschedule",
            async () => {
              throw makeError();
            },
          );
        },
      });
      await expect(outcome).rejects.toThrow(
        /^whole_path_orchestrator_scenario_guide_schedule_pull_back_reschedule_failed$/u,
      );
      expect(target.events).toContain("reset:1");
      expect(target.events.join(" ")).not.toContain("protected");
    },
  );

  it("does not carry a Guide schedule subclass from another step", async () => {
    const { value } = options();
    await expect(
      runSuggestedWaypointWholePath({
        ...value,
        async runScenario() {
          return runSuggestedWaypointWholePathScenarioStep(
            "delivery_eligibility_wait",
            async () => {
              throw new SuggestedWaypointGuideSchedulePullBackRescheduleFailure(
                "pending_selector_mismatch",
              );
            },
          );
        },
      }),
    ).rejects.toThrow(
      /^whole_path_orchestrator_scenario_delivery_eligibility_wait_failed$/u,
    );
  });

  it.each(["context-close:2", "browser-close"] as const)(
    "maps %s failure to one value-free cleanup category and continues teardown",
    async (failure) => {
      const { target, value } = options(failure);
      await expect(runSuggestedWaypointWholePath(value)).rejects.toThrow(
        "whole_path_orchestrator_cleanup_failed",
      );
      expect(target.events).toContain("browser-close");
      expect(target.events).toContain("session-clear:0");
      expect(target.events).toContain("reset:1");
      expect(target.events.join(" ")).not.toContain("protected");
    },
  );

  it("classifies a bundle-setup teardown failure as cleanup failure", async () => {
    const { target, value } = options("add-cookie:3+context-close:2");
    await expect(runSuggestedWaypointWholePath(value)).rejects.toThrow(
      "whole_path_orchestrator_cleanup_failed",
    );
    expect(target.events).toContain("browser-close");
    expect(target.events).toContain("session-clear:0");
    expect(target.events).toContain("reset:1");
  });

  it.each(["session-clear:1", "auth-delete", "final-reset"] as const)(
    "preserves the fixture cleanup failure for %s after browser teardown",
    async (failure) => {
      const { target, value } = options(failure);
      await expect(runSuggestedWaypointWholePath(value)).rejects.toThrow(
        "whole_path_fixture_cleanup_failed",
      );
      expect(target.events.indexOf("browser-close")).toBeLessThan(
        target.events.indexOf("session-clear:4"),
      );
      expect(target.events.join(" ")).not.toContain("protected");
    },
  );

  it("preserves fixture cleanup failure when a closed scenario step also fails", async () => {
    const { target, value } = options("scenario-step+auth-delete");
    await expect(runSuggestedWaypointWholePath(value)).rejects.toThrow(
      "whole_path_fixture_cleanup_failed",
    );
    expect(target.events).toContain("browser-close");
    expect(target.events).toContain("reset:1");
    expect(target.events.join(" ")).not.toContain("protected");
  });

  it("preserves fixture cleanup failure when a detailed Guide draft-create failure also occurs", async () => {
    const { target, value } = options("auth-delete");
    await expect(
      runSuggestedWaypointWholePath({
        ...value,
        async runScenario() {
          return runSuggestedWaypointWholePathScenarioStep(
            "guide_draft_create",
            async () => {
              throw new SuggestedWaypointGuideDraftCreateFailure(
                "command_failed",
              );
            },
          );
        },
      }),
    ).rejects.toThrow("whole_path_fixture_cleanup_failed");
    expect(target.events).toContain("browser-close");
    expect(target.events).toContain("reset:1");
    expect(target.events.join(" ")).not.toContain("command_failed");
  });

  it("maps hostile configuration access without calling later owners", async () => {
    const { target, value } = options();
    const hostile = Object.defineProperty({}, "SOLMIND_WHOLE_PATH_APPROVAL", {
      enumerable: true,
      get() {
        throw new Error("protected configuration detail");
      },
    });
    await expect(
      runSuggestedWaypointWholePath({ ...value, environment: hostile }),
    ).rejects.toThrow("whole_path_orchestrator_configuration_failed");
    expect(target.createBrowser).not.toHaveBeenCalled();
  });
});
