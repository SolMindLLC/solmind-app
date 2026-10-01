// Test-only environment comparison, verified config digest and value-free impact
// display for the future local Supabase Auth provider probes.
//
// Before any effect, a run must show Paul which local environment it observed and
// everything it would create and delete, then wait for his exact current approval.
// This module compares an observed workdir, project id and API URL against the
// banked kernel's expected values, and renders the impact as counts and categories
// only. It contacts nothing.
//
// Filesystem reads are limited to one place: `readVerifiedProviderProbeConfigDigest`
// reads `supabase/config.toml` only under the workdir that a successful comparison
// verified, and only when that workdir is the pinned app root and its path text passes
// the UNC, device-path and relative-root rejection in providerProbeLocalRoot.ts (a
// lexical check, not proof that the path is on a local disk). A comparison
// result is branded here, so a hand-made `{ matches: true }` object unlocks nothing.

import { readFileSync } from "node:fs";
import path from "node:path";

import type { ProviderProbeSafetyConfig } from "../../src/lib/solmind/supabase/__tests__/providerProbeConfig";
import { isAcceptedRootPathSyntax, providerProbeAppRoot } from "./providerProbeLocalRoot";
import { computeProviderProbeConfigDigest, scanProviderProbeOutput } from "./providerProbeRunEnvelope";

export type ProviderProbeObservedEnvironment = Readonly<{
  workdir: string;
  projectId: string;
  apiUrl: string;
}>;

/**
 * UNVERIFIED INTERFACE - NO IMPLEMENTATION IN THIS REVISION.
 *
 * How the pinned Supabase CLI 2.115.0 exposes the resolved workdir, project id and
 * API URL of a running local stack (for example in `supabase status` output, its
 * `-o` formats, or its `--workdir` handling) has not been checked. A later revision
 * must confirm the CLI's real behaviour first and must not parse an assumed format.
 * An observer must also never return or print key values, which the same CLI
 * command may show.
 */
export type ProviderProbeEnvironmentObserver = Readonly<{
  observe(): Promise<ProviderProbeObservedEnvironment>;
}>;

export type ProviderProbeEnvironmentComparison = Readonly<{
  matches: boolean;
  workdir: "matches" | "differs" | "undecided";
  projectId: "matches" | "differs";
  apiUrl: "matches" | "differs";
}>;

export type ProviderProbeImpactPlan = Readonly<{
  authUsersCreated: number;
  authSessionsCreated: number;
  mailpitMessagesCaptured: number;
}>;

const OBSERVED_KEYS = ["apiUrl", "projectId", "workdir"] as const;
const MAX_OBSERVED_LENGTH = 4_096;
// Verified workdirs of successful comparisons, keyed by the comparison object itself.
const verifiedWorkdirs = new WeakMap<object, string>();

function fail(code: string): never {
  throw new Error(code);
}

// The kernel pins no workdir. The current-config profile runs from the pinned app
// root; the locked-down profile's workdir is an open decision, so it stays undecided.
export function expectedProviderProbeWorkdir(config: ProviderProbeSafetyConfig): string | null {
  return config.profile === "current-config" ? providerProbeAppRoot() : null;
}

function normalizeWorkdir(raw: string): string | null {
  // Lexical only: a UNC, device-path or relative root is refused here and never passed
  // to any filesystem call. (A mapped network drive would pass; see providerProbeLocalRoot.ts.)
  if (!isAcceptedRootPathSyntax(raw)) {
    return null;
  }
  const resolved = path.resolve(raw).replace(/[\\/]+$/, "");
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function sameApiUrl(raw: string, expectedOrigin: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return (
    url.protocol === "http:" &&
    url.username === "" &&
    url.password === "" &&
    url.search === "" &&
    url.hash === "" &&
    url.pathname === "/" &&
    url.origin === expectedOrigin
  );
}

function validateObserved(raw: unknown): ProviderProbeObservedEnvironment {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail("provider_probe_environment_observation_malformed");
  }
  const value = raw as Record<string, unknown>;
  const keys = Object.keys(value).sort();
  if (keys.length !== OBSERVED_KEYS.length || keys.some((key, index) => key !== OBSERVED_KEYS[index])) {
    fail("provider_probe_environment_observation_malformed");
  }
  for (const key of OBSERVED_KEYS) {
    const field = value[key];
    if (typeof field !== "string" || field.length === 0 || field.length > MAX_OBSERVED_LENGTH) {
      fail("provider_probe_environment_observation_malformed");
    }
  }
  return Object.freeze({
    workdir: value.workdir as string,
    projectId: value.projectId as string,
    apiUrl: value.apiUrl as string,
  });
}

export function compareProviderProbeEnvironment(
  config: ProviderProbeSafetyConfig,
  observed: unknown,
): ProviderProbeEnvironmentComparison {
  const value = validateObserved(observed);
  const expectedWorkdir = expectedProviderProbeWorkdir(config);
  let workdir: ProviderProbeEnvironmentComparison["workdir"] = "undecided";
  if (expectedWorkdir !== null) {
    const left = normalizeWorkdir(value.workdir);
    const right = normalizeWorkdir(expectedWorkdir);
    workdir = left !== null && right !== null && left === right ? "matches" : "differs";
  }
  const projectId = value.projectId === config.expectedProjectId ? "matches" : "differs";
  const apiUrl = sameApiUrl(value.apiUrl, config.localSupabaseUrl) ? "matches" : "differs";
  const comparison = Object.freeze({
    matches: workdir === "matches" && projectId === "matches" && apiUrl === "matches",
    workdir,
    projectId,
    apiUrl,
  });
  if (comparison.matches && expectedWorkdir !== null) {
    verifiedWorkdirs.set(comparison, expectedWorkdir);
  }
  return comparison;
}

// Reads `<verified workdir>/supabase/config.toml` exactly as stored and returns its
// SHA-256 digest. Only a genuine, matching comparison from this module unlocks it.
export function readVerifiedProviderProbeConfigDigest(comparison: unknown): string {
  const workdir =
    comparison && typeof comparison === "object" ? verifiedWorkdirs.get(comparison) : undefined;
  if (workdir === undefined || !isAcceptedRootPathSyntax(workdir)) {
    fail("provider_probe_config_digest_unverified");
  }
  let bytes: Buffer;
  try {
    bytes = readFileSync(path.join(workdir, "supabase", "config.toml"));
  } catch {
    fail("provider_probe_config_unreadable");
  }
  return computeProviderProbeConfigDigest(bytes);
}

function validatePlan(raw: unknown): ProviderProbeImpactPlan {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail("provider_probe_impact_plan_invalid");
  }
  const value = raw as Record<string, unknown>;
  const keys = Object.keys(value).sort();
  const expected = ["authSessionsCreated", "authUsersCreated", "mailpitMessagesCaptured"];
  const bounded = (field: unknown, maximum: number) =>
    Number.isSafeInteger(field) && (field as number) >= 0 && (field as number) <= maximum;
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index]) ||
    !bounded(value.authUsersCreated, 10) ||
    !bounded(value.authSessionsCreated, 10) ||
    !bounded(value.mailpitMessagesCaptured, 100)
  ) {
    fail("provider_probe_impact_plan_invalid");
  }
  return Object.freeze({
    authUsersCreated: value.authUsersCreated as number,
    authSessionsCreated: value.authSessionsCreated as number,
    mailpitMessagesCaptured: value.mailpitMessagesCaptured as number,
  });
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

// The per-probe plan comes from the caller: what PP-04 creates is still Paul's
// decision, so no count is fixed here.
export function describeProviderProbeImpact(
  config: ProviderProbeSafetyConfig,
  plan: unknown,
  comparison?: ProviderProbeEnvironmentComparison,
): readonly string[] {
  const value = validatePlan(plan);
  const lines = [
    "Provider probe run: what it would create and delete (counts and categories only)",
    `Profile: ${config.profile}`,
    "Reaches: the local Auth API and the local mail catcher, on a literal loopback address only",
    `Would create: ${plural(value.authUsersCreated, "local Auth user", "local Auth users")}, with reserved synthetic addresses`,
    `Would create: ${plural(value.authSessionsCreated, "local Auth session", "local Auth sessions")}, held in memory only, never in a cookie or file`,
    `May capture: up to ${plural(value.mailpitMessagesCaptured, "local test message", "local test messages")}, to reserved synthetic addresses`,
    `Would delete: at most ${plural(value.authUsersCreated, "local Auth user", "local Auth users")} and ${plural(value.mailpitMessagesCaptured, "local test message", "local test messages")}, only those this run created, by their exact IDs, once each; nothing is listed and deleted`,
    "Would not touch: any SolMind database function, the hosted project, or any real address",
  ];
  if (comparison !== undefined) {
    lines.push(
      `Environment check: workdir ${comparison.workdir}, project ${comparison.projectId}, API URL ${comparison.apiUrl}`,
    );
  }
  for (const line of lines) {
    if (!scanProviderProbeOutput(line).passed) {
      fail("provider_probe_impact_display_secret_pattern");
    }
  }
  return Object.freeze(lines);
}
