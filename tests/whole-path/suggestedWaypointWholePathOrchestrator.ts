import type { SuggestedWaypointFixtureScenarioIds } from "./suggestedWaypointLocalSqlFixture";
import {
  runWithSuggestedWaypointLocalAuthFixture,
  type SuggestedWaypointLocalFixtureRunOptions,
} from "./suggestedWaypointLocalAuthFixture";
import {
  createSuggestedWaypointPlaywrightBundle,
  type SuggestedWaypointPlaywrightActor,
  type SuggestedWaypointPlaywrightBrowser,
} from "./suggestedWaypointPlaywrightSession";
import {
  readSuggestedWaypointWholePathSafetyConfig,
  WHOLE_PATH_APPROVAL_GATE,
  WHOLE_PATH_EFFECT_GATE,
  type SuggestedWaypointWholePathSafetyConfig,
} from "./suggestedWaypointWholePathSafety";
import {
  SuggestedWaypointGuideDraftCreateFailure,
  type SuggestedWaypointGuideDraftCreateFailureReason,
} from "./suggestedWaypointWholePathGuideDraftDiagnostics";
import {
  SuggestedWaypointGuideRelationshipEntryFailure,
  type SuggestedWaypointGuideRelationshipEntryFailureReason,
} from "./suggestedWaypointWholePathGuideRelationshipEntryDiagnostics";
import {
  SuggestedWaypointGuideSchedulePullBackRescheduleFailure,
  type SuggestedWaypointGuideSchedulePullBackRescheduleFailureReason,
} from "./suggestedWaypointWholePathGuideScheduleDiagnostics";

type WholePathEnvironment = Readonly<Record<string, string | undefined>>;

export const SUGGESTED_WAYPOINT_WHOLE_PATH_SCENARIO_STEPS = Object.freeze([
  "guide_relationship_entry",
  "guide_draft_create",
  "guide_draft_edit_save",
  "guide_schedule_pull_back_reschedule",
  "explorer_pre_delivery_denial",
  "delivery_eligibility_wait",
  "delivery_bridge",
  "explorer_delivery_read",
  "explorer_mark_read",
  "explorer_acknowledge",
  "guide_acknowledgement_refresh",
  "guide_projection_shape",
  "unrelated_role_denials",
  "layout_accessibility",
] as const);

export type SuggestedWaypointWholePathScenarioStep =
  (typeof SUGGESTED_WAYPOINT_WHOLE_PATH_SCENARIO_STEPS)[number];

class SuggestedWaypointWholePathScenarioStepFailure extends Error {
  readonly step: SuggestedWaypointWholePathScenarioStep;
  readonly guideRelationshipEntryReason: SuggestedWaypointGuideRelationshipEntryFailureReason | null;
  readonly guideDraftCreateReason: SuggestedWaypointGuideDraftCreateFailureReason | null;
  readonly guideSchedulePullBackRescheduleReason: SuggestedWaypointGuideSchedulePullBackRescheduleFailureReason | null;

  constructor(
    step: SuggestedWaypointWholePathScenarioStep,
    guideRelationshipEntryReason: SuggestedWaypointGuideRelationshipEntryFailureReason | null,
    guideDraftCreateReason: SuggestedWaypointGuideDraftCreateFailureReason | null,
    guideSchedulePullBackRescheduleReason: SuggestedWaypointGuideSchedulePullBackRescheduleFailureReason | null,
  ) {
    super("whole_path_scenario_step_failed");
    this.name = "SuggestedWaypointWholePathScenarioStepFailure";
    this.step = step;
    this.guideRelationshipEntryReason = guideRelationshipEntryReason;
    this.guideDraftCreateReason = guideDraftCreateReason;
    this.guideSchedulePullBackRescheduleReason = guideSchedulePullBackRescheduleReason;
  }
}

export async function runSuggestedWaypointWholePathScenarioStep<T>(
  step: SuggestedWaypointWholePathScenarioStep,
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw new SuggestedWaypointWholePathScenarioStepFailure(
      step,
      step === "guide_relationship_entry" &&
        error instanceof SuggestedWaypointGuideRelationshipEntryFailure
        ? error.reason
        : null,
      step === "guide_draft_create" &&
        error instanceof SuggestedWaypointGuideDraftCreateFailure
        ? error.reason
        : null,
      step === "guide_schedule_pull_back_reschedule" &&
        error instanceof SuggestedWaypointGuideSchedulePullBackRescheduleFailure
        ? error.reason
        : null,
    );
  }
}

export type SuggestedWaypointOwnedPlaywrightBrowser =
  SuggestedWaypointPlaywrightBrowser &
    Readonly<{
      close(): Promise<void>;
    }>;

export type SuggestedWaypointWholePathScenario = Readonly<{
  config: SuggestedWaypointWholePathSafetyConfig;
  scenarioIds: SuggestedWaypointFixtureScenarioIds;
  actors: readonly SuggestedWaypointPlaywrightActor[];
}>;

export type SuggestedWaypointWholePathOrchestratorOptions<T> = Omit<
  SuggestedWaypointLocalFixtureRunOptions<unknown>,
  "environment" | "runScenario"
> &
  Readonly<{
    environment: WholePathEnvironment;
    createBrowser(
      config: SuggestedWaypointWholePathSafetyConfig,
    ): Promise<SuggestedWaypointOwnedPlaywrightBrowser>;
    runScenario(scenario: SuggestedWaypointWholePathScenario): Promise<T>;
  }>;

type BrowserOutcome<T> =
  | Readonly<{ status: "completed"; result: T }>
  | Readonly<{
      status: "run_failed";
      stage: "browser" | "bundle";
    }>
  | Readonly<{
      status: "run_failed";
      stage: "scenario";
      scenarioStep: SuggestedWaypointWholePathScenarioStep | null;
      guideRelationshipEntryReason: SuggestedWaypointGuideRelationshipEntryFailureReason | null;
      guideDraftCreateReason: SuggestedWaypointGuideDraftCreateFailureReason | null;
      guideSchedulePullBackRescheduleReason: SuggestedWaypointGuideSchedulePullBackRescheduleFailureReason | null;
    }>
  | Readonly<{ status: "cleanup_failed" }>;

function stableEnvironment(
  config: SuggestedWaypointWholePathSafetyConfig,
): WholePathEnvironment {
  return Object.freeze({
    SOLMIND_WHOLE_PATH_APPROVAL: WHOLE_PATH_APPROVAL_GATE,
    SOLMIND_WHOLE_PATH_ALLOW_LOCAL_EFFECTS: WHOLE_PATH_EFFECT_GATE,
    SOLMIND_WHOLE_PATH_RUN_ID: config.runId,
    SOLMIND_LOCAL_SUPABASE_PROJECT_ID: config.projectId,
    SOLMIND_LOCAL_SUPABASE_URL: config.localSupabaseUrl,
    SOLMIND_LOCAL_DATABASE_PORT: String(config.localDatabasePort),
    SOLMIND_TRUSTED_APP_ORIGIN: config.trustedApplicationOrigin,
  });
}

async function runBrowserScenario<T>(
  options: SuggestedWaypointWholePathOrchestratorOptions<T>,
  config: SuggestedWaypointWholePathSafetyConfig,
  fixture: Parameters<
    SuggestedWaypointLocalFixtureRunOptions<unknown>["runScenario"]
  >[0],
): Promise<BrowserOutcome<T>> {
  let browser: SuggestedWaypointOwnedPlaywrightBrowser | undefined;
  let bundle: Awaited<
    ReturnType<typeof createSuggestedWaypointPlaywrightBundle>
  > | undefined;
  let result: T | undefined;
  let runFailed = false;
  let runFailureStage: "browser" | "bundle" | "scenario" = "browser";
  let runFailureScenarioStep: SuggestedWaypointWholePathScenarioStep | null =
    null;
  let runFailureGuideRelationshipEntryReason: SuggestedWaypointGuideRelationshipEntryFailureReason | null =
    null;
  let runFailureGuideDraftCreateReason: SuggestedWaypointGuideDraftCreateFailureReason | null =
    null;
  let runFailureGuideSchedulePullBackRescheduleReason: SuggestedWaypointGuideSchedulePullBackRescheduleFailureReason | null =
    null;
  let cleanupFailed = false;
  let stage: "browser" | "bundle" | "scenario" = "browser";

  try {
    browser = await options.createBrowser(config);
    stage = "bundle";
    bundle = await createSuggestedWaypointPlaywrightBundle(
      browser,
      fixture.actors,
      config,
    );
    stage = "scenario";
    result = await options.runScenario(
      Object.freeze({
        config,
        scenarioIds: fixture.scenarioIds,
        actors: bundle.actors,
      }),
    );
  } catch (error) {
    if (
      stage === "bundle" &&
      error instanceof Error &&
      error.message === "whole_path_playwright_setup_cleanup_failed"
    ) {
      cleanupFailed = true;
    } else {
      runFailed = true;
      runFailureStage = stage;
      if (
        stage === "scenario" &&
        error instanceof SuggestedWaypointWholePathScenarioStepFailure
      ) {
        runFailureScenarioStep = error.step;
        runFailureGuideRelationshipEntryReason =
          error.guideRelationshipEntryReason;
        runFailureGuideDraftCreateReason = error.guideDraftCreateReason;
        runFailureGuideSchedulePullBackRescheduleReason =
          error.guideSchedulePullBackRescheduleReason;
      }
    }
  } finally {
    if (bundle) {
      try {
        await bundle.close();
      } catch {
        cleanupFailed = true;
      }
    }
    if (browser) {
      try {
        await browser.close();
      } catch {
        cleanupFailed = true;
      }
    }
  }

  if (cleanupFailed) return Object.freeze({ status: "cleanup_failed" });
  if (runFailed) {
    if (runFailureStage === "scenario") {
      return Object.freeze({
        status: "run_failed",
        stage: "scenario",
        scenarioStep: runFailureScenarioStep,
        guideRelationshipEntryReason: runFailureGuideRelationshipEntryReason,
        guideDraftCreateReason: runFailureGuideDraftCreateReason,
        guideSchedulePullBackRescheduleReason:
          runFailureGuideSchedulePullBackRescheduleReason,
      });
    }
    return Object.freeze({ status: "run_failed", stage: runFailureStage });
  }
  return Object.freeze({ status: "completed", result: result as T });
}

export async function runSuggestedWaypointWholePath<T>(
  options: SuggestedWaypointWholePathOrchestratorOptions<T>,
): Promise<Readonly<{ status: "refused" } | { status: "completed"; result: T }>> {
  let config: SuggestedWaypointWholePathSafetyConfig | null;
  try {
    config = readSuggestedWaypointWholePathSafetyConfig(options.environment);
  } catch {
    throw new Error("whole_path_orchestrator_configuration_failed");
  }
  if (config === null) return Object.freeze({ status: "refused" });

  const fixtureResult = await runWithSuggestedWaypointLocalAuthFixture<
    BrowserOutcome<T>
  >({
    environment: stableEnvironment(config),
    loadSecrets: options.loadSecrets,
    createDependencies: options.createDependencies,
    ...(options.generatePassword
      ? { generatePassword: options.generatePassword }
      : {}),
    runScenario: (fixture) => runBrowserScenario(options, config, fixture),
  });

  if (fixtureResult.status === "refused") {
    throw new Error("whole_path_orchestrator_configuration_drift");
  }
  if (fixtureResult.result.status === "cleanup_failed") {
    throw new Error("whole_path_orchestrator_cleanup_failed");
  }
  if (fixtureResult.result.status === "run_failed") {
    if (
      fixtureResult.result.stage === "scenario" &&
      fixtureResult.result.scenarioStep !== null
    ) {
      if (
        fixtureResult.result.scenarioStep === "guide_relationship_entry" &&
        fixtureResult.result.guideRelationshipEntryReason !== null
      ) {
        throw new Error(
          `whole_path_orchestrator_scenario_guide_relationship_entry_${fixtureResult.result.guideRelationshipEntryReason}_failed`,
        );
      }
      if (
        fixtureResult.result.scenarioStep === "guide_draft_create" &&
        fixtureResult.result.guideDraftCreateReason !== null
      ) {
        throw new Error(
          `whole_path_orchestrator_scenario_guide_draft_create_${fixtureResult.result.guideDraftCreateReason}_failed`,
        );
      }
      if (
        fixtureResult.result.scenarioStep === "guide_schedule_pull_back_reschedule" &&
        fixtureResult.result.guideSchedulePullBackRescheduleReason !== null
      ) {
        throw new Error(
          `whole_path_orchestrator_scenario_guide_schedule_pull_back_reschedule_${fixtureResult.result.guideSchedulePullBackRescheduleReason}_failed`,
        );
      }
      throw new Error(
        `whole_path_orchestrator_scenario_${fixtureResult.result.scenarioStep}_failed`,
      );
    }
    throw new Error(
      `whole_path_orchestrator_${fixtureResult.result.stage}_failed`,
    );
  }
  return Object.freeze({
    status: "completed",
    result: fixtureResult.result.result,
  });
}
