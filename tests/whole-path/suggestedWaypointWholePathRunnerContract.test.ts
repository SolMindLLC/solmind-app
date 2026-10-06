import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { SUGGESTED_WAYPOINT_WHOLE_PATH_GUIDE_DRAFT_INTERNAL_STAGES } from "@/lib/solmind/supabase/suggestedWaypointWholePathGuideDraftDiagnostic";
import { SUGGESTED_WAYPOINT_WHOLE_PATH_GUIDE_RELATIONSHIP_ENTRY_INTERNAL_STAGES } from "@/lib/solmind/supabase/suggestedWaypointWholePathGuideRelationshipEntryDiagnostic";
import { SUGGESTED_WAYPOINT_WHOLE_PATH_SCENARIO_STEPS } from "./suggestedWaypointWholePathOrchestrator";
import { SUGGESTED_WAYPOINT_GUIDE_DRAFT_CREATE_FAILURE_REASONS } from "./suggestedWaypointWholePathGuideDraftDiagnostics";
import { SUGGESTED_WAYPOINT_GUIDE_RELATIONSHIP_ENTRY_FAILURE_REASONS } from "./suggestedWaypointWholePathGuideRelationshipEntryDiagnostics";
import { SUGGESTED_WAYPOINT_GUIDE_SCHEDULE_PULL_BACK_RESCHEDULE_FAILURE_REASONS } from "./suggestedWaypointWholePathGuideScheduleDiagnostics";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const runnerSource = readFileSync(
  path.join(appRoot, "tests", "whole-path", "runSuggestedWaypointWholePath.mjs"),
  "utf8",
);
const playwrightConfigSource = readFileSync(
  path.join(appRoot, "playwright.whole-path.config.ts"),
  "utf8",
);
const scenarioSource = readFileSync(
  path.join(appRoot, "tests", "whole-path", "suggestedWaypointWholePath.pw.ts"),
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(path.join(appRoot, "package.json"), "utf8"),
) as { scripts?: Record<string, unknown> };
const scenarioStepAlternation =
  SUGGESTED_WAYPOINT_WHOLE_PATH_SCENARIO_STEPS.join("|");
const guideDraftCreateFailureAlternation =
  SUGGESTED_WAYPOINT_GUIDE_DRAFT_CREATE_FAILURE_REASONS.join("|");
const guideRelationshipEntryFailureAlternation =
  SUGGESTED_WAYPOINT_GUIDE_RELATIONSHIP_ENTRY_FAILURE_REASONS.join("|");
const guideSchedulePullBackRescheduleFailureAlternation =
  SUGGESTED_WAYPOINT_GUIDE_SCHEDULE_PULL_BACK_RESCHEDULE_FAILURE_REASONS.join("|");
const guideDraftInternalStageAlternation =
  SUGGESTED_WAYPOINT_WHOLE_PATH_GUIDE_DRAFT_INTERNAL_STAGES.join("|");
const guideRelationshipEntryInternalStageAlternation =
  SUGGESTED_WAYPOINT_WHOLE_PATH_GUIDE_RELATIONSHIP_ENTRY_INTERNAL_STAGES.join(
    "|",
  );
const runnerFailurePatternSource = runnerSource.match(
  /const WHOLE_PATH_VALUE_FREE_FAILURE_PATTERN = \/(.+)\/gu;/u,
)?.[1];

function matchesRunnerFailurePattern(value: string): string[] | null {
  expect(runnerFailurePatternSource).toBeDefined();
  return value.match(new RegExp(runnerFailurePatternSource!, "gu"));
}

describe("Suggested Waypoint whole-path runner build topology", () => {
  it("uses webpack only for the junction-backed isolated proof build", () => {
    expect(runnerSource).toContain(
      'const isolatedBuildArguments = Object.freeze([nextCli, "build", "--webpack"]);',
    );
    expect(runnerSource).toContain(
      "await boundedCommand(process.execPath, isolatedBuildArguments, { env: publicEnvironment });",
    );
    expect(runnerSource).not.toContain(
      'await boundedCommand(process.execPath, [nextCli, "build"], { env: publicEnvironment });',
    );
  });

  it("retains the normal live-repository Turbopack production-build gate", () => {
    expect(packageJson.scripts?.build).toBe("next build");
  });

  it("emits only allowlisted value-free child failure categories", () => {
    expect(runnerSource).toContain("function valueFreeFailureCode(stdout, stderr)");
    expect(runnerSource).toContain(
      "const matches = combined.match(WHOLE_PATH_VALUE_FREE_FAILURE_PATTERN);",
    );
    expect(runnerFailurePatternSource).toContain(
      `(?:${scenarioStepAlternation})_failed`,
    );
    expect(
      runnerFailurePatternSource?.match(/scenario_\(\?:\(\?:([a-z_|]+)\)_failed/u)?.[1],
    ).toBe(scenarioStepAlternation);
    expect(SUGGESTED_WAYPOINT_WHOLE_PATH_SCENARIO_STEPS).toHaveLength(14);
    for (const step of SUGGESTED_WAYPOINT_WHOLE_PATH_SCENARIO_STEPS) {
      expect(scenarioSource).toMatch(
        new RegExp(
          `runSuggestedWaypointWholePathScenarioStep\\(\\s*"${step}"`,
          "u",
        ),
      );
      const category = `whole_path_orchestrator_scenario_${step}_failed`;
      expect(matchesRunnerFailurePattern(`before ${category} after`)).toEqual([
        category,
      ]);
    }
    expect(runnerFailurePatternSource).toContain(
      `guide_relationship_entry_(?:${guideRelationshipEntryFailureAlternation})_failed`,
    );
    expect(
      SUGGESTED_WAYPOINT_GUIDE_RELATIONSHIP_ENTRY_FAILURE_REASONS,
    ).toHaveLength(9);
    for (const reason of SUGGESTED_WAYPOINT_GUIDE_RELATIONSHIP_ENTRY_FAILURE_REASONS) {
      const category =
        `whole_path_orchestrator_scenario_guide_relationship_entry_${reason}_failed`;
      expect(matchesRunnerFailurePattern(`before ${category} after`)).toEqual([
        category,
      ]);
    }
    expect(runnerFailurePatternSource).toContain(
      `guide_relationship_entry_internal_(?:${guideRelationshipEntryInternalStageAlternation})_failed`,
    );
    expect(
      SUGGESTED_WAYPOINT_WHOLE_PATH_GUIDE_RELATIONSHIP_ENTRY_INTERNAL_STAGES,
    ).toHaveLength(9);
    for (const stage of SUGGESTED_WAYPOINT_WHOLE_PATH_GUIDE_RELATIONSHIP_ENTRY_INTERNAL_STAGES) {
      const category =
        `whole_path_orchestrator_scenario_guide_relationship_entry_internal_${stage}_failed`;
      expect(matchesRunnerFailurePattern(`before ${category} after`)).toEqual([
        category,
      ]);
    }
    expect(runnerFailurePatternSource).toContain(
      `guide_draft_create_(?:${guideDraftCreateFailureAlternation})_failed`,
    );
    expect(SUGGESTED_WAYPOINT_GUIDE_DRAFT_CREATE_FAILURE_REASONS).toHaveLength(10);
    for (const reason of SUGGESTED_WAYPOINT_GUIDE_DRAFT_CREATE_FAILURE_REASONS) {
      const category =
        `whole_path_orchestrator_scenario_guide_draft_create_${reason}_failed`;
      expect(matchesRunnerFailurePattern(`before ${category} after`)).toEqual([
        category,
      ]);
    }
    expect(runnerFailurePatternSource).toContain(
      `guide_draft_create_internal_(?:${guideDraftInternalStageAlternation})_failed`,
    );
    expect(
      SUGGESTED_WAYPOINT_WHOLE_PATH_GUIDE_DRAFT_INTERNAL_STAGES,
    ).toHaveLength(10);
    for (const stage of SUGGESTED_WAYPOINT_WHOLE_PATH_GUIDE_DRAFT_INTERNAL_STAGES) {
      const category =
        `whole_path_orchestrator_scenario_guide_draft_create_internal_${stage}_failed`;
      expect(matchesRunnerFailurePattern(`before ${category} after`)).toEqual([
        category,
      ]);
    }
    expect(runnerFailurePatternSource).toContain(
      `guide_schedule_pull_back_reschedule_(?:${guideSchedulePullBackRescheduleFailureAlternation})_failed`,
    );
    expect(
      SUGGESTED_WAYPOINT_GUIDE_SCHEDULE_PULL_BACK_RESCHEDULE_FAILURE_REASONS,
    ).toHaveLength(43);
    for (const reason of SUGGESTED_WAYPOINT_GUIDE_SCHEDULE_PULL_BACK_RESCHEDULE_FAILURE_REASONS) {
      const category =
        `whole_path_orchestrator_scenario_guide_schedule_pull_back_reschedule_${reason}_failed`;
      expect(matchesRunnerFailurePattern(`before ${category} after`)).toEqual([
        category,
      ]);
    }
    for (const category of [
      "whole_path_fixture_initialization_failed",
      "whole_path_fixture_cleanup_failed",
      "whole_path_fixture_run_failed",
      "whole_path_orchestrator_configuration_failed",
      "whole_path_orchestrator_configuration_drift",
      "whole_path_orchestrator_cleanup_failed",
      "whole_path_orchestrator_browser_failed",
      "whole_path_orchestrator_bundle_failed",
      "whole_path_orchestrator_scenario_failed",
      "whole_path_runner_child_failed",
    ]) {
      expect(matchesRunnerFailurePattern(`before ${category} after`)).toEqual([
        category,
      ]);
    }
    expect(
      matchesRunnerFailurePattern(
        "whole_path_orchestrator_scenario_unapproved_step_failed",
      ),
    ).toBeNull();
    expect(
      matchesRunnerFailurePattern(
        "whole_path_orchestrator_scenario_guide_draft_create_protected_raw_failed",
      ),
    ).toBeNull();
    expect(
      matchesRunnerFailurePattern(
        "whole_path_orchestrator_scenario_guide_relationship_entry_protected_raw_failed",
      ),
    ).toBeNull();
    expect(
      matchesRunnerFailurePattern(
        "whole_path_orchestrator_scenario_guide_relationship_entry_internal_protected_raw_failed",
      ),
    ).toBeNull();
    expect(
      matchesRunnerFailurePattern(
        "whole_path_orchestrator_scenario_guide_draft_create_internal_protected_raw_failed",
      ),
    ).toBeNull();
    expect(
      matchesRunnerFailurePattern(
        "whole_path_orchestrator_scenario_guide_schedule_pull_back_reschedule_protected_raw_failed",
      ),
    ).toBeNull();
    expect(
      matchesRunnerFailurePattern(
        "whole_path_orchestrator_scenario_guide_schedule_pull_back_reschedule_pull_back_policy_unavailable_failed",
      ),
    ).toBeNull();
    expect(
      matchesRunnerFailurePattern(
        "x_whole_path_orchestrator_scenario_delivery_bridge_failed",
      ),
    ).toBeNull();
    expect(
      matchesRunnerFailurePattern(
        "whole_path_orchestrator_scenario_delivery_bridge_failed_extra",
      ),
    ).toBeNull();
    expect(runnerSource).toContain(
      'return matches?.at(0) ?? "whole_path_runner_child_failed";',
    );
    expect(
      matchesRunnerFailurePattern(
        "whole_path_orchestrator_scenario_delivery_bridge_failed " +
          "whole_path_orchestrator_scenario_layout_accessibility_failed",
      ),
    ).toEqual([
      "whole_path_orchestrator_scenario_delivery_bridge_failed",
      "whole_path_orchestrator_scenario_layout_accessibility_failed",
    ]);
    expect(playwrightConfigSource).toContain("maxFailures: 1");
    expect(runnerSource).toContain('process.stderr.write("whole_path_failed\\n")');
    expect(runnerSource).toContain('process.stderr.write(`${failureCode}\\n`)');
    expect(runnerSource).not.toContain("process.stderr.write(combined)");
  });

  it("binds server-only Guide draft markers to the exact proof and fixed output", () => {
    expect(scenarioSource).toContain(
      '"X-SolMind-Whole-Path-Run-Id": exactRunId',
    );
    expect(runnerSource).toContain(
      'stdio: ["ignore", "ignore", "pipe"]',
    );
    for (const name of [
      "SOLMIND_WHOLE_PATH_APPROVAL",
      "SOLMIND_WHOLE_PATH_ALLOW_LOCAL_EFFECTS",
      "SOLMIND_WHOLE_PATH_RUN_ID",
      "SOLMIND_LOCAL_SUPABASE_PROJECT_ID",
      "SOLMIND_LOCAL_SUPABASE_URL",
      "SOLMIND_LOCAL_DATABASE_PORT",
    ]) {
      expect(runnerSource).toContain(`${name}:`);
    }
    expect(runnerSource).toContain(
      "server.stderr.on(\"data\", observeServerDiagnostic)",
    );
    expect(runnerSource).toContain(
      "error.message === WHOLE_PATH_GUIDE_DRAFT_GENERIC_DENIAL",
    );
    expect(runnerSource).toContain(
      "whole_path_orchestrator_scenario_guide_draft_create_internal_${serverGuideDraftInternalStage}_failed",
    );
    expect(runnerSource).not.toContain("process.stderr.write(serverDiagnosticCarry)");
  });

  it("binds Guide relationship-entry markers to one exact GET and fixed output", () => {
    expect(scenarioSource).toContain(
      '"x-solmind-whole-path-run-id": runId',
    );
    expect(scenarioSource).toContain(
      "await page.route(exactListRequest, bindExactRun)",
    );
    expect(scenarioSource).toContain(
      "await page.unroute(exactListRequest, bindExactRun)",
    );
    expect(runnerSource).toContain(
      "WHOLE_PATH_GUIDE_RELATIONSHIP_ENTRY_INTERNAL_MARKER_PATTERN",
    );
    expect(runnerSource).toContain(
      "error.message === WHOLE_PATH_GUIDE_RELATIONSHIP_ENTRY_GENERIC_DENIAL",
    );
    expect(runnerSource).toContain(
      "whole_path_orchestrator_scenario_guide_relationship_entry_internal_${serverGuideRelationshipEntryInternalStage}_failed",
    );
    expect(runnerSource).not.toContain(
      "process.stderr.write(serverDiagnosticCarry)",
    );
  });

  it("keeps reset, project, and outer-child timeout budgets coherently nested", () => {
    const resetTimeoutMs = 600_000;
    const projectTimeoutMs = 1_800_000;
    const outerTimeoutMs = 4_200_000;

    expect(scenarioSource).toContain(
      `const WHOLE_PATH_RESET_TIMEOUT_MS = ${resetTimeoutMs.toLocaleString("en-US").replaceAll(",", "_")};`,
    );
    expect(scenarioSource).toContain("timeout: WHOLE_PATH_RESET_TIMEOUT_MS");
    expect(playwrightConfigSource).toContain(
      `const WHOLE_PATH_PROJECT_TIMEOUT_MS = ${projectTimeoutMs.toLocaleString("en-US").replaceAll(",", "_")};`,
    );
    expect(playwrightConfigSource).toContain("timeout: WHOLE_PATH_PROJECT_TIMEOUT_MS");
    expect(runnerSource).toContain(
      `const WHOLE_PATH_PLAYWRIGHT_CHILD_TIMEOUT_MS = ${outerTimeoutMs.toLocaleString("en-US").replaceAll(",", "_")};`,
    );
    expect(runnerSource).toContain(
      "timeoutMs: WHOLE_PATH_PLAYWRIGHT_CHILD_TIMEOUT_MS",
    );
    expect(projectTimeoutMs).toBeGreaterThan((2 * resetTimeoutMs) + 540_000);
    expect(outerTimeoutMs).toBeGreaterThan((2 * projectTimeoutMs) + 540_000);
  });
});
