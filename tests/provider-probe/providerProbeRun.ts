// Test-only PRODUCTION composition root for the future local Supabase Auth provider
// probes. `createProviderProbeRun(environment)` takes nothing but the environment:
//
// - It requires the banked kernel's two exact interlocks before it builds anything
//   (an enabled but malformed configuration throws the kernel's own value-free code).
//   The interlocks are technical gates, never human authorization.
// - It passes the restricted run core (`providerProbeRunCore.ts`) only the gated,
//   fixed-target production transports: the Auth fetch (`/auth/v1/` on the kernel's
//   loopback origin) and, for the current-config profile, the Mailpit fetch
//   (`/api/v1/` on port 54324 of the same loopback host). No caller can supply a
//   transport, a deleter, a receipt or an identifier.
//
// The returned run can create run-tagged users, read the mail inventory, clean up
// through its own fixed deleters (`cleanup()`, `retryCleanup()`) and assemble the one
// scanned output document. It reads no key by itself and starts nothing.

import { readProviderProbeSafetyConfig } from "../../src/lib/solmind/supabase/__tests__/providerProbeConfig";
import {
  createProviderProbeAuthFetch,
  createProviderProbeMailpitFetch,
  providerProbeMailpitOrigin,
} from "./providerProbeLoopbackFetch";
import { createProviderProbeRunCore, type ProviderProbeRun } from "./providerProbeRunCore";

export type { ProviderProbeRun };

type ProbeEnvironment = Readonly<Record<string, string | undefined>>;

export function createProviderProbeRun(environment: ProbeEnvironment): ProviderProbeRun {
  const config = readProviderProbeSafetyConfig(environment);
  if (config === null) {
    throw new Error("provider_probe_run_ungated");
  }
  return createProviderProbeRunCore({
    environment,
    auth: { origin: config.localSupabaseUrl, fetch: createProviderProbeAuthFetch(environment) },
    mailpit:
      config.profile === "current-config"
        ? { origin: providerProbeMailpitOrigin(config), fetch: createProviderProbeMailpitFetch(environment) }
        : null,
  });
}
