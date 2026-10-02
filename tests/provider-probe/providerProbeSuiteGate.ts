// Test-only gate and session for the opt-in integration file
// `supabaseAuthProviderProbe.local.integration.test.ts`.
//
// `readProviderProbeSuiteState` never throws, so a malformed enabled setting cannot
// fail the file at import time. It returns "skipped" without both kernel
// interlocks, "enabled" with a valid configuration and phase, and "refused" (with only
// a value-free error code) when the interlocks are present but a setting is unsafe or
// missing. The integration file shows "refused" as a failing test.
//
// `createProviderProbeSession` (R5) is the integration file's whole route to the probe
// bodies: it reads the run's own settings from the environment, builds the gated run,
// and passes the restricted probe core the real clock, timer, (R6) stack observer and
// output writer. It returns only value-free step summaries.
//
// (R6) The environment it is given must be the live process environment itself (the
// integration file passes `process.env`), never a copy: the output writer re-reads both
// interlocks, the run id and the phase from it immediately before each write, so
// removing an interlock at any time refuses the write. The observer receives it only to
// decide the local Docker engine (R7: DOCKER_HOST and DOCKER_CONTEXT are read and checked,
// never passed on) and to pass an allowlisted few variables to the docker CLI, together
// with the kernel's API origin, against which it checks the published port.
// `createProviderProbeSessionSeams` builds those production seams, and its tests cover
// both. Its settings:
// - SOLMIND_PROVIDER_PROBE_PHASE: "preview" (PP-00 only, reads only, writes the impact
//   display) or "run" (every step, after Paul has approved that display);
// - SOLMIND_PROVIDER_PROBE_ANON_KEY and SOLMIND_PROVIDER_PROBE_SERVICE_ROLE_KEY: the
//   local stack's keys, registered at once and never printed;
// - SOLMIND_PROVIDER_PROBE_CLI_VERSION: the CLI version the operator read (must be
//   2.115.0);
// - SOLMIND_PROVIDER_PROBE_OUTPUT_DIR: an existing directory outside the app root;
// - SOLMIND_PROVIDER_PROBE_APPROVED_IMPACT (run phase): the approval digest printed at
//   the end of the impact display Paul approved.
//
// `verifyProviderProbeWiring` builds the run, the ledger and the mail inventory, and
// reads no key and sends no request.

import {
  readProviderProbeSafetyConfig,
  type ProviderProbeSafetyConfig,
} from "../../src/lib/solmind/supabase/__tests__/providerProbeConfig";
import { resolveProviderProbeOutputDirectory, writeProviderProbeOutputFile } from "./providerProbeOutputFile";
import {
  createProviderProbeSuiteCore,
  PROVIDER_PROBE_FINISH_TIMEOUT_MILLISECONDS,
  PROVIDER_PROBE_STEPS,
  providerProbeStepTimeoutMilliseconds,
  type ProviderProbePhase,
  type ProviderProbeStep,
  type ProviderProbeStepSummary,
  type ProviderProbeSuiteSeams,
} from "./providerProbeProbeCore";
import { createProviderProbeRun } from "./providerProbeRun";
import { observeProviderProbeStack } from "./providerProbeStackObserver";

export { PROVIDER_PROBE_FINISH_TIMEOUT_MILLISECONDS, PROVIDER_PROBE_STEPS, providerProbeStepTimeoutMilliseconds };
export type { ProviderProbeStep, ProviderProbeStepSummary };

type ProbeEnvironment = Readonly<Record<string, string | undefined>>;

export type ProviderProbeSuiteState =
  | Readonly<{ state: "skipped" }>
  | Readonly<{ state: "enabled"; config: ProviderProbeSafetyConfig; phase: ProviderProbePhase }>
  | Readonly<{ state: "refused"; code: string }>;

export type ProviderProbeWiringSummary = Readonly<{
  profile: ProviderProbeSafetyConfig["profile"];
  recordedAuthUsers: number;
  recordedMailpitMessages: number;
  mailInventoryBuilt: boolean;
}>;

export type ProviderProbeSession = Readonly<{
  phase: ProviderProbePhase;
  runStep(step: ProviderProbeStep): Promise<ProviderProbeStepSummary>;
  finish(): Promise<void>;
}>;

const KERNEL_CODE_PATTERN = /^provider_probe_[a-z_]{1,96}$/;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

function fail(code: string): never {
  throw new Error(code);
}

export function readProviderProbeSuiteState(environment: ProbeEnvironment): ProviderProbeSuiteState {
  try {
    const config = readProviderProbeSafetyConfig(environment);
    if (config === null) {
      return Object.freeze({ state: "skipped" as const });
    }
    const phase = environment.SOLMIND_PROVIDER_PROBE_PHASE;
    if (phase !== "preview" && phase !== "run") {
      fail("provider_probe_invalid_phase");
    }
    return Object.freeze({ state: "enabled" as const, config, phase });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return Object.freeze({
      state: "refused" as const,
      code: KERNEL_CODE_PATTERN.test(message) ? message : "provider_probe_settings_refused",
    });
  }
}

export function verifyProviderProbeWiring(environment: ProbeEnvironment): ProviderProbeWiringSummary {
  const run = createProviderProbeRun(environment);
  const mailInventoryBuilt = run.config.profile === "current-config" && typeof run.createMailpitInventory() === "object";
  const recorded = run.cleanupCounts();
  return Object.freeze({
    profile: run.config.profile,
    recordedAuthUsers: recorded.authUsers,
    recordedMailpitMessages: recorded.mailpitMessages,
    mailInventoryBuilt,
  });
}

function requiredSetting(environment: ProbeEnvironment, name: string, code: string): string {
  const value = environment[name];
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    fail(code);
  }
  return value;
}

export function createProviderProbeSession(environment: ProbeEnvironment): ProviderProbeSession {
  const state = readProviderProbeSuiteState(environment);
  if (state.state !== "enabled") {
    fail("provider_probe_session_not_enabled");
  }
  const approved = environment.SOLMIND_PROVIDER_PROBE_APPROVED_IMPACT;
  if (state.phase === "run" && (typeof approved !== "string" || !DIGEST_PATTERN.test(approved))) {
    fail("provider_probe_missing_approved_impact");
  }
  const settings = Object.freeze({
    phase: state.phase,
    anonKey: requiredSetting(environment, "SOLMIND_PROVIDER_PROBE_ANON_KEY", "provider_probe_missing_anon_key"),
    serviceRoleKey: requiredSetting(
      environment,
      "SOLMIND_PROVIDER_PROBE_SERVICE_ROLE_KEY",
      "provider_probe_missing_service_role_key",
    ),
    cliVersion: requiredSetting(environment, "SOLMIND_PROVIDER_PROBE_CLI_VERSION", "provider_probe_missing_cli_version"),
    approvedImpact: state.phase === "run" ? (approved as string) : null,
  });
  const directory = resolveProviderProbeOutputDirectory(environment.SOLMIND_PROVIDER_PROBE_OUTPUT_DIR);
  const run = createProviderProbeRun(environment);
  const suite = createProviderProbeSuiteCore({
    run,
    settings,
    seams: createProviderProbeSessionSeams({ environment, config: run.config, phase: state.phase, directory }),
  });
  return Object.freeze({ phase: suite.phase, runStep: suite.runStep, finish: suite.finish });
}

// R6: the production seams of a session: the real clock and timer, the stack observer
// (the two fixed docker reads), and the output writer bound to this run's id and phase.
// Both the observer and the writer receive the environment object exactly as given (the
// live process environment), never a copy, so the writer's re-check sees any change.
export function createProviderProbeSessionSeams(
  input: Readonly<{ environment: ProbeEnvironment; config: ProviderProbeSafetyConfig; phase: ProviderProbePhase; directory: string }>,
): ProviderProbeSuiteSeams {
  const { environment, config, phase, directory } = input;
  const expected = Object.freeze({ runId: config.runId, phase });
  return Object.freeze({
    clock: () => Date.now(),
    wait: (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
    observeStack: () => observeProviderProbeStack({ environment, expectedApiOrigin: config.localSupabaseUrl }),
    writeOutput: (kind: "impact-display" | "evidence", text: string) =>
      writeProviderProbeOutputFile({ environment, expected, directory, kind, text }),
  });
}
