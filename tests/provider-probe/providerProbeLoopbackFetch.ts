// Test-only PRODUCTION network entry points for the future local Supabase Auth
// provider probes. These two factories are the only way production harness code
// may obtain a network path.
//
// - Each takes nothing but the environment. Targets, path prefixes, limits and the
//   `node:http` request function are fixed here; no caller can widen or replace them.
// - `createProviderProbeAuthFetch` reaches only the kernel's validated Supabase API
//   origin, and on it only `/auth/v1/`. PostgREST (`/rest/v1/`), tables and every
//   `solmind_*` database function are therefore unreachable through it.
// - `createProviderProbeMailpitFetch` reaches only the current-config mail catcher
//   (`supabase/config.toml` `[inbucket] port = 54324`, on the same literal loopback
//   host), and on it only `/api/v1/`. The locked-down profile has no decided mail
//   catcher, so it is refused.
// - Both require the banked kernel's two exact interlocks at construction
//   (`readProviderProbeSafetyConfig` must return a configuration), and check them
//   again before every request and immediately before its first byte is written, with
//   zero request bytes sent when they are absent or changed at either point. A request
//   that has already begun writing is not recalled. The interlocks are technical
//   gates, never human authorization.

import {
  readProviderProbeSafetyConfig,
  type ProviderProbeSafetyConfig,
} from "../../src/lib/solmind/supabase/__tests__/providerProbeConfig";
import {
  createLoopbackTransport,
  LoopbackFetchError,
  type LoopbackFetch,
} from "./providerProbeLoopbackCore";

export { LoopbackFetchError };
export type { LoopbackFetch };

type ProbeEnvironment = Readonly<Record<string, string | undefined>>;

export const PROVIDER_PROBE_AUTH_PATH_PREFIX = "/auth/v1/";
export const PROVIDER_PROBE_MAILPIT_PATH_PREFIX = "/api/v1/";
export const PROVIDER_PROBE_MAILPIT_CURRENT_CONFIG_PORT = 54324;
export const PROVIDER_PROBE_TRANSPORT_LIMITS = Object.freeze({
  timeoutMilliseconds: 10_000,
  maxRequestBytes: 65_536,
  maxResponseBytes: 1_048_576,
});

function gatedConfig(environment: ProbeEnvironment): ProviderProbeSafetyConfig {
  // An enabled but malformed configuration throws the kernel's own value-free code.
  const config = readProviderProbeSafetyConfig(environment);
  if (config === null) {
    throw new LoopbackFetchError("loopback_fetch_ungated");
  }
  return config;
}

function sameRunGate(environment: ProbeEnvironment, config: ProviderProbeSafetyConfig): () => boolean {
  return () => {
    const current = readProviderProbeSafetyConfig(environment);
    return (
      current !== null &&
      current.runId === config.runId &&
      current.profile === config.profile &&
      current.localSupabaseUrl === config.localSupabaseUrl
    );
  };
}

export function providerProbeMailpitOrigin(config: ProviderProbeSafetyConfig): string {
  if (config.profile !== "current-config") {
    throw new Error("mailpit_origin_undecided");
  }
  const host = new URL(config.localSupabaseUrl).hostname;
  return `http://${host}:${PROVIDER_PROBE_MAILPIT_CURRENT_CONFIG_PORT}`;
}

export function createProviderProbeAuthFetch(environment: ProbeEnvironment): LoopbackFetch {
  const config = gatedConfig(environment);
  return createLoopbackTransport({
    targets: [{ origin: config.localSupabaseUrl, pathPrefixes: [PROVIDER_PROBE_AUTH_PATH_PREFIX] }],
    ...PROVIDER_PROBE_TRANSPORT_LIMITS,
    gate: sameRunGate(environment, config),
  });
}

export function createProviderProbeMailpitFetch(environment: ProbeEnvironment): LoopbackFetch {
  const config = gatedConfig(environment);
  return createLoopbackTransport({
    targets: [{ origin: providerProbeMailpitOrigin(config), pathPrefixes: [PROVIDER_PROBE_MAILPIT_PATH_PREFIX] }],
    ...PROVIDER_PROBE_TRANSPORT_LIMITS,
    gate: sameRunGate(environment, config),
  });
}
