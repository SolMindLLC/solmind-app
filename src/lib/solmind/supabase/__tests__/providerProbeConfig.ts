// Test-only safety configuration for the future local Supabase Auth provider probes.
//
// This module does not construct a client, read a key, call Auth, or mutate state.
// Returning null unless both explicit gates match keeps the future integration suite
// skipped during ordinary test/build commands. Even after opt-in, every endpoint and
// recipient must pass the fail-closed local-synthetic checks below.

export const PROVIDER_PROBE_APPROVAL_GATE =
  "approved-local-synthetic-auth-probe";
export const PROVIDER_PROBE_EFFECT_GATE =
  "approved-exact-id-local-auth-cleanup";

export type ProviderProbeProfile = "current-config" | "locked-down";

export type ProviderProbeSafetyConfig = Readonly<{
  profile: ProviderProbeProfile;
  expectedProjectId: "solmind-app" | "solmind-provider-probe-locked-down";
  expectedApiPort: 54321 | 55421;
  runId: string;
  localSupabaseUrl: string;
  syntheticEmail: string;
  lifetimeSafetyMarginSeconds: number;
}>;

type ProbeEnvironment = Readonly<Record<string, string | undefined>>;

const RUN_ID_PATTERN = /^P28-[0-9]{8}-[a-z0-9][a-z0-9-]{5,31}$/;
// Literal loopback addresses only. "localhost" is intentionally rejected because
// a hostname string does not prove how the operating system will resolve it.
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]"]);
const PROFILE_EXPECTATIONS = {
  "current-config": {
    expectedProjectId: "solmind-app",
    expectedApiPort: 54321,
  },
  "locked-down": {
    expectedProjectId: "solmind-provider-probe-locked-down",
    expectedApiPort: 55421,
  },
} as const;

function required(env: ProbeEnvironment, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`provider_probe_missing_${name.toLowerCase()}`);
  }
  return value;
}

function parseLocalUrl(raw: string, expectedPort: number): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("provider_probe_invalid_local_url");
  }

  if (
    url.protocol !== "http:" ||
    !LOOPBACK_HOSTS.has(url.hostname) ||
    url.username !== "" ||
    url.password !== "" ||
    Number(url.port) !== expectedPort ||
    url.search !== "" ||
    url.hash !== "" ||
    (url.pathname !== "" && url.pathname !== "/")
  ) {
    throw new Error("provider_probe_non_loopback_or_ambiguous_url");
  }

  return url.origin;
}

function parseRunId(raw: string): string {
  if (!RUN_ID_PATTERN.test(raw)) {
    throw new Error("provider_probe_invalid_run_id");
  }
  return raw;
}

function parseSyntheticEmail(raw: string, runId: string): string {
  if (raw !== raw.toLowerCase() || raw.length > 254) {
    throw new Error("provider_probe_invalid_synthetic_email");
  }

  const at = raw.lastIndexOf("@");
  if (at <= 0 || raw.slice(at + 1) !== "synthetic.invalid") {
    throw new Error("provider_probe_recipient_not_reserved_synthetic_domain");
  }

  const localPart = raw.slice(0, at);
  const requiredMarker = runId.toLowerCase();
  if (!/^[a-z0-9+._-]{1,64}$/.test(localPart) || !localPart.includes(requiredMarker)) {
    throw new Error("provider_probe_recipient_missing_run_marker");
  }

  return raw;
}

function parseProfile(raw: string): ProviderProbeProfile {
  if (raw !== "current-config" && raw !== "locked-down") {
    throw new Error("provider_probe_invalid_profile");
  }
  return raw;
}

function parseSafetyMargin(raw: string): number {
  if (!/^[0-9]+$/.test(raw)) {
    throw new Error("provider_probe_invalid_lifetime_margin");
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > 300) {
    throw new Error("provider_probe_invalid_lifetime_margin");
  }
  return value;
}

export function readProviderProbeSafetyConfig(
  env: ProbeEnvironment,
): ProviderProbeSafetyConfig | null {
  if (
    env.SOLMIND_PROVIDER_PROBE_APPROVAL !== PROVIDER_PROBE_APPROVAL_GATE ||
    env.SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS !== PROVIDER_PROBE_EFFECT_GATE
  ) {
    return null;
  }

  const runId = parseRunId(required(env, "SOLMIND_PROVIDER_PROBE_RUN_ID"));
  const profile = parseProfile(required(env, "SOLMIND_PROVIDER_PROBE_PROFILE"));
  const expectation = PROFILE_EXPECTATIONS[profile];
  const config: ProviderProbeSafetyConfig = {
    profile,
    ...expectation,
    runId,
    localSupabaseUrl: parseLocalUrl(
      required(env, "SOLMIND_LOCAL_SUPABASE_URL"),
      expectation.expectedApiPort,
    ),
    syntheticEmail: parseSyntheticEmail(
      required(env, "SOLMIND_PROVIDER_PROBE_SYNTHETIC_EMAIL"),
      runId,
    ),
    lifetimeSafetyMarginSeconds: parseSafetyMargin(
      required(env, "SOLMIND_PROVIDER_PROBE_LIFETIME_MARGIN_SECONDS"),
    ),
  };

  return Object.freeze(config);
}
