// Test-only environment comparison, verified config digest and value-free impact
// display for the future local Supabase Auth provider probes.
//
// Before any effect, a run must show Paul which local environment it observed and
// everything it would create and delete, then wait for his exact current approval.
// This module compares an observed workdir, project id and API URL against the
// banked kernel's expected values, and renders the impact as counts and categories
// only. It contacts nothing.
//
// Filesystem reads touch one file, `supabase/config.toml`, and only under the pinned app
// root after its path text passes the UNC, device-path and relative-root rejection in
// providerProbeLocalRoot.ts (a lexical check, not proof that the path is on a local
// disk):
// - `readVerifiedProviderProbeConfigDigest`, (R5) `readVerifiedProviderProbeJwtExpiry`
//   and (R6) `readVerifiedProviderProbeConfiguredSurfaces` read it only under the
//   workdir that a successful comparison verified. A comparison result is branded here,
//   so a hand-made `{ matches: true }` object unlocks nothing.
// - (R5) `readProviderProbeCheckoutProjectId` reads the checkout's own `project_id`
//   from it with no comparison; PP-00 requires it to equal the kernel's project id too.
//
// (R6) The observation compared here comes from `providerProbeStackObserver.ts`: the
// running stack's own container labels (workdir and project id) and its API
// container's published port, read with two fixed, read-only `docker` commands.

import { readFileSync } from "node:fs";
import path from "node:path";

import type { ProviderProbeSafetyConfig } from "../../src/lib/solmind/supabase/__tests__/providerProbeConfig";
import { isAcceptedRootPathSyntax, providerProbeAppRoot } from "./providerProbeLocalRoot";
import {
  computeProviderProbeConfigDigest,
  scanProviderProbeOutput,
  type ProviderProbeConfiguredNotObserved,
  type ProviderProbeConfiguredSetting,
} from "./providerProbeRunEnvelope";

export type ProviderProbeObservedEnvironment = Readonly<{
  workdir: string;
  projectId: string;
  apiUrl: string;
}>;

export type ProviderProbeEnvironmentComparison = Readonly<{
  matches: boolean;
  workdir: "matches" | "differs" | "undecided";
  projectId: "matches" | "differs";
  apiUrl: "matches" | "differs";
}>;

// (R6) Each count is a conditional range, a planned maximum and, separately, the
// capacity the run enforces: expectedMin <= expectedMax <= plannedMax <= capacity, and
// the capacity is within the kernel's evidence bound (10 users, 10 sessions, 100
// messages).
export type ProviderProbeImpactCount = Readonly<{
  expectedMin: number;
  expectedMax: number;
  plannedMax: number;
  capacity: number;
}>;

export type ProviderProbeImpactPlan = Readonly<{
  users: ProviderProbeImpactCount;
  sessions: ProviderProbeImpactCount;
  messages: ProviderProbeImpactCount;
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
  return computeProviderProbeConfigDigest(readVerifiedConfigBytes(comparison));
}

function readVerifiedConfigBytes(comparison: unknown): Buffer {
  const workdir =
    comparison && typeof comparison === "object" ? verifiedWorkdirs.get(comparison) : undefined;
  if (workdir === undefined || !isAcceptedRootPathSyntax(workdir)) {
    fail("provider_probe_config_digest_unverified");
  }
  try {
    return readFileSync(path.join(workdir, "supabase", "config.toml"));
  } catch {
    fail("provider_probe_config_unreadable");
  }
}

// A deliberately small reader for single `key = value` lines of `config.toml`: the
// value of `key` in `section` (null for the top level), or null when the key is
// missing, repeated or not a plain value. It is not a TOML parser and never guesses.
export function readTomlSetting(text: string, section: string | null, key: string): string | null {
  let current: string | null = null;
  const found: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const header = /^\[([A-Za-z0-9_.-]{1,128})\]$/.exec(line);
    if (header !== null) {
      current = header[1]!;
      continue;
    }
    if (current !== section) {
      continue;
    }
    const equals = line.indexOf("=");
    if (equals > 0 && line.slice(0, equals).trim() === key) {
      found.push(line.slice(equals + 1).replace(/\s+#[^"]*$/, "").trim());
    }
  }
  return found.length === 1 ? found[0]! : null;
}

// R5: the checkout's own project id, from `<pinned app root>/supabase/config.toml`. This
// is what this checkout configures. (R6) Which workdir and project the running stack
// was started with is observed separately, from its container labels.
export function readProviderProbeCheckoutProjectId(): string | null {
  let text: string;
  try {
    text = readFileSync(path.join(providerProbeAppRoot(), "supabase", "config.toml"), "utf8");
  } catch {
    return null;
  }
  const raw = readTomlSetting(text, null, "project_id");
  const match = raw === null ? null : /^"([a-z0-9][a-z0-9_-]{0,63})"$/.exec(raw);
  return match === null ? null : match[1]!;
}

// R5: the configured access-token lifetime (`[auth] jwt_expiry`), from the same verified
// file as the digest, so a hand-made comparison unlocks nothing here either.
export function readVerifiedProviderProbeJwtExpiry(comparison: unknown): number | null {
  const raw = readTomlSetting(readVerifiedConfigBytes(comparison).toString("utf8"), "auth", "jwt_expiry");
  if (raw === null || !/^[0-9]{1,6}$/.test(raw)) {
    return null;
  }
  const seconds = Number(raw);
  return seconds >= 1 && seconds <= 604_800 ? seconds : null;
}

// R6: what a settings text configures for the two surfaces the run no longer tries:
// `[auth] enable_anonymous_sign_ins` and `[auth.sms] enable_signup`. "configured, not
// observed": the running stack is never asked.
export function providerProbeConfiguredSurfacesFromToml(text: string): ProviderProbeConfiguredNotObserved {
  const word = (raw: string | null): ProviderProbeConfiguredSetting =>
    raw === "true" ? "enabled" : raw === "false" ? "disabled" : "unreadable";
  return Object.freeze({
    anonymousSignIns: word(readTomlSetting(text, "auth", "enable_anonymous_sign_ins")),
    phoneSignUp: word(readTomlSetting(text, "auth.sms", "enable_signup")),
  });
}

// R6: the same, from the verified workdir's settings file only.
export function readVerifiedProviderProbeConfiguredSurfaces(comparison: unknown): ProviderProbeConfiguredNotObserved {
  return providerProbeConfiguredSurfacesFromToml(readVerifiedConfigBytes(comparison).toString("utf8"));
}

const PLAN_COUNTS = ["messages", "sessions", "users"] as const;
const COUNT_KEYS = ["capacity", "expectedMax", "expectedMin", "plannedMax"];
// The kernel's evidence bounds: userDelta <= 10, sessionDelta <= 10, messageDelta <= 100.
const KERNEL_BOUNDS: Readonly<Record<(typeof PLAN_COUNTS)[number], number>> = { users: 10, sessions: 10, messages: 100 };

function validateCount(raw: unknown, bound: number): ProviderProbeImpactCount {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail("provider_probe_impact_plan_invalid");
  }
  const value = raw as Record<string, unknown>;
  const keys = Object.keys(value).sort();
  if (
    keys.length !== COUNT_KEYS.length ||
    keys.some((key, index) => key !== COUNT_KEYS[index]) ||
    COUNT_KEYS.some((key) => !Number.isSafeInteger(value[key]))
  ) {
    fail("provider_probe_impact_plan_invalid");
  }
  const count = value as ProviderProbeImpactCount;
  if (
    count.expectedMin < 0 ||
    count.expectedMin > count.expectedMax ||
    count.expectedMax > count.plannedMax ||
    count.plannedMax > count.capacity ||
    count.capacity > bound
  ) {
    fail("provider_probe_impact_plan_invalid");
  }
  return Object.freeze({
    expectedMin: count.expectedMin,
    expectedMax: count.expectedMax,
    plannedMax: count.plannedMax,
    capacity: count.capacity,
  });
}

function validatePlan(raw: unknown): ProviderProbeImpactPlan {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail("provider_probe_impact_plan_invalid");
  }
  const value = raw as Record<string, unknown>;
  const keys = Object.keys(value).sort();
  if (keys.length !== PLAN_COUNTS.length || keys.some((key, index) => key !== PLAN_COUNTS[index])) {
    fail("provider_probe_impact_plan_invalid");
  }
  return Object.freeze({
    users: validateCount(value.users, KERNEL_BOUNDS.users),
    sessions: validateCount(value.sessions, KERNEL_BOUNDS.sessions),
    messages: validateCount(value.messages, KERNEL_BOUNDS.messages),
  });
}

function expectedRange(count: ProviderProbeImpactCount): string {
  return count.expectedMin === count.expectedMax ? `${count.expectedMin}` : `${count.expectedMin} to ${count.expectedMax}`;
}

// The per-probe plan comes from the caller (the probe core); every count is shown as
// what is expected, what is planned at most, and what the run enforces, separately.
export function describeProviderProbeImpact(
  config: ProviderProbeSafetyConfig,
  plan: unknown,
  comparison?: ProviderProbeEnvironmentComparison,
): readonly string[] {
  const { users, sessions, messages } = validatePlan(plan);
  const lines = [
    "Provider probe run: what it would create and delete (counts and categories only)",
    `Profile: ${config.profile}`,
    "Reaches: the local Auth API and the local mail catcher, on a literal loopback address only",
    `Local Auth users: expected ${expectedRange(users)}, each at an address this run minted for it; at most ${users.plannedMax} planned, if every check found an unexpected result; the run tracks at most ${users.capacity} (enforced), and a user it finds but cannot track stops the run`,
    `Local Auth sessions: expected ${expectedRange(sessions)}, held in memory only, never in a cookie or file; at most ${sessions.plannedMax} planned; at most ${sessions.capacity} can be held (enforced)`,
    `Local test messages: expected ${expectedRange(messages)}, to addresses this run minted; at most ${messages.plannedMax} planned; the run tracks at most ${messages.capacity} (enforced), and a run-tagged message it cannot attribute stops the run`,
    "Would delete: only the users and messages this run created and tracked, by their exact IDs, at most three tries each",
    "Found by listing: only a user at an address this run minted for the request that created it (the server returned no ID); no other listed user is ever deleted",
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
