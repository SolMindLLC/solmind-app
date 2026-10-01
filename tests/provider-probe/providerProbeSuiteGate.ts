// Test-only gate and wiring for the opt-in integration file
// `supabaseAuthProviderProbe.local.integration.test.ts`.
//
// `readProviderProbeSuiteState` never throws, so a malformed enabled setting cannot
// fail the file at import time. It returns "skipped" without both kernel
// interlocks, "enabled" with a valid configuration, and "refused" (with only the
// kernel's value-free error code) when the interlocks are present but a setting is
// unsafe or missing. The integration file shows "refused" as a failing test.
//
// `verifyProviderProbeWiring` is the whole body of the integration file's enabled
// branch. It builds the run, the ledger and (for the current-config profile) the
// mail inventory, and reads no key and sends no request.

import {
  readProviderProbeSafetyConfig,
  type ProviderProbeSafetyConfig,
} from "../../src/lib/solmind/supabase/__tests__/providerProbeConfig";
import { createProviderProbeRun } from "./providerProbeRun";

type ProbeEnvironment = Readonly<Record<string, string | undefined>>;

export type ProviderProbeSuiteState =
  | Readonly<{ state: "skipped" }>
  | Readonly<{ state: "enabled"; config: ProviderProbeSafetyConfig }>
  | Readonly<{ state: "refused"; code: string }>;

export type ProviderProbeWiringSummary = Readonly<{
  profile: ProviderProbeSafetyConfig["profile"];
  recordedAuthUsers: number;
  recordedMailpitMessages: number;
  mailInventoryBuilt: boolean;
}>;

const KERNEL_CODE_PATTERN = /^provider_probe_[a-z_]{1,96}$/;

export function readProviderProbeSuiteState(environment: ProbeEnvironment): ProviderProbeSuiteState {
  try {
    const config = readProviderProbeSafetyConfig(environment);
    return config === null
      ? Object.freeze({ state: "skipped" as const })
      : Object.freeze({ state: "enabled" as const, config });
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
