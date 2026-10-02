// Test-only run envelope, known-value registry and output scanner for the future
// local Supabase Auth provider probes.
//
// Output boundary. The only evidence document a run may emit is the closed envelope
// below plus kernel-validated evidence records (`createProviderProbeEvidence`): every
// field is a closed enum, a bounded number, a boolean, a pinned version string, the run
// id or a SHA-256 config digest. That closed schema is the boundary. (Since R5 the
// preview phase also writes an impact display: fixed lines of counts, categories,
// versions and digests, each scanned before it is written.)
//
// Envelope version 2 (R6) adds `configuredNotObserved`: what this checkout's
// `supabase/config.toml` configures for anonymous sign-in and phone sign-up, two
// surfaces the run no longer tries. Each value is a closed word ("enabled", "disabled"
// or "unreadable") read from the settings file, never observed from the running stack.
//
// Envelope version 3 (R11, re-check #128f) adds `countsBeyondEvidenceBounds`: the banked
// kernel's evidence record holds each count only up to a fixed maximum (users and
// sessions 10, messages and requests 100), and never below zero. A record count outside
// those bounds is written as the bound itself and named here, entry by entry ("PP-01's
// userDelta is more than 10"), so it is never silently reduced; the list is always
// present and empty when no count was out of bounds. The exact count is not carried (a
// "more than" marker, as Paul chose, leaving the kernel unchanged). Assembly checks every
// entry against its record: the record exists, its probe id matches, its field holds
// exactly the bound, and it did not pass.
//
// The scanner is defence in depth on top of that boundary, not proof that arbitrary
// text is safe. It applies the kernel's own serializer patterns (by delegating to
// `serializeProviderProbeEvidence`, so they cannot drift), stricter patterns of its
// own (any-version and hyphen-free UUIDs, and the word "token"), and exact matches of
// every value in the run's known-value registry, to the text and to decoded variants
// of it (percent-encoding once and twice, `\u`/`\x` escapes, HTML character
// references). It reports only booleans and a count, never the matched text.
//
// Registry. `createProviderProbeKnownValueRegistry` makes a branded, in-memory set of
// the sensitive values a run holds. The effect-owning operations register what they
// receive (keys, synthetic addresses, generated credentials, created identifiers,
// captured message ids) automatically. `assembleProviderProbeRunOutput` refuses to
// assemble without a genuine registry. Registered values are never returned, logged
// or written.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { ProviderProbeSafetyConfig } from "../../src/lib/solmind/supabase/__tests__/providerProbeConfig";
import {
  createProviderProbeEvidence,
  serializeProviderProbeEvidence,
  type ProviderProbeEvidence,
  type ProviderProbeProfile,
} from "../../src/lib/solmind/supabase/__tests__/providerProbeEvidence";
import { providerProbeAppRoot } from "./providerProbeLocalRoot";

export type ProviderProbeConfiguredSetting = "enabled" | "disabled" | "unreadable";

export type ProviderProbeConfiguredNotObserved = Readonly<{
  anonymousSignIns: ProviderProbeConfiguredSetting;
  phoneSignUp: ProviderProbeConfiguredSetting;
}>;

// R11: the record counts the kernel bounds, and those bounds (the kernel does not export
// them; `providerProbeProbes.test.ts` checks each against the kernel itself).
export type ProviderProbeEvidenceCountField = "userDelta" | "sessionDelta" | "messageDelta" | "requestCount";

export const PROVIDER_PROBE_EVIDENCE_BOUNDS: Readonly<Record<ProviderProbeEvidenceCountField, number>> = Object.freeze({
  userDelta: 10,
  sessionDelta: 10,
  messageDelta: 100,
  requestCount: 100,
});

// R11: one record count outside the kernel's bounds. "more-than" pairs with the field's
// maximum, "less-than" with zero; the record's field holds exactly that limit.
export type ProviderProbeCountBeyondEvidenceBounds = Readonly<{
  record: number;
  probeId: string;
  field: ProviderProbeEvidenceCountField;
  relation: "more-than" | "less-than";
  limit: number;
}>;

export type ProviderProbeRunEnvelope = Readonly<{
  envelopeVersion: 3;
  profile: ProviderProbeProfile;
  runId: string;
  supabaseCliVersion: string;
  supabaseJsVersion: string;
  authJsVersion: string;
  configDigest: string;
  configuredNotObserved: ProviderProbeConfiguredNotObserved;
  countsBeyondEvidenceBounds: readonly ProviderProbeCountBeyondEvidenceBounds[];
}>;

export type ProviderProbeObservedRun = Readonly<{
  supabaseCliVersion: string;
  supabaseJsVersion: string;
  authJsVersion: string;
  configDigest: string;
  configuredNotObserved: ProviderProbeConfiguredNotObserved;
}>;

export type ProviderProbeOutputScan = Readonly<{
  passed: boolean;
  kernelRuleMatched: boolean;
  strictRuleMatched: boolean;
  knownValueMatches: number;
}>;

export type ProviderProbeKnownValueRegistry = Readonly<{
  register(value: string): void;
  size(): number;
}>;

export const PROVIDER_PROBE_OUTPUT_LIMITS = Object.freeze({
  maxScannedCharacters: 4_194_304,
  // Matches the shortest identifier the harness accepts (an 8-character mail id).
  minKnownValueLength: 8,
  maxKnownValueLength: 8_192,
  maxKnownValues: 512,
  maxEvidenceRecords: 32,
  maxDecodingPasses: 2,
});

const SEMVER_PATTERN = /^(?:0|[1-9][0-9]{0,4})\.(?:0|[1-9][0-9]{0,4})\.(?:0|[1-9][0-9]{0,4})$/;
const CONFIG_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const ENVELOPE_KEYS = [
  "authJsVersion",
  "configDigest",
  "configuredNotObserved",
  "countsBeyondEvidenceBounds",
  "envelopeVersion",
  "profile",
  "runId",
  "supabaseCliVersion",
  "supabaseJsVersion",
] as const;
const OBSERVED_KEYS = [
  "authJsVersion",
  "configDigest",
  "configuredNotObserved",
  "supabaseCliVersion",
  "supabaseJsVersion",
] as const;
const CONFIGURED_KEYS = ["anonymousSignIns", "phoneSignUp"] as const;
const BEYOND_KEYS = ["field", "limit", "probeId", "record", "relation"] as const;
const EVIDENCE_PROBE_ID_PATTERN = /^PP-(?:0[0-9]|1[0-2])$/;
const CONFIGURED_SETTINGS: readonly string[] = ["enabled", "disabled", "unreadable"];
const SDK_PACKAGES = Object.freeze({
  supabaseJsVersion: "@supabase/supabase-js",
  authJsVersion: "@supabase/auth-js",
});
// Stricter than the kernel: every UUID version (including 7 and nil), any case, and
// the 32-digit hyphen-free form (a hexadecimal run of exactly 32 digits, so the
// 64-digit config digest does not match); plus the word "token" in any form.
const ANY_UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const HEX_RUN_PATTERN = /[0-9a-f]+/gi;
const TOKEN_WORD_PATTERN = /token/i;

function strictRuleMatches(text: string): boolean {
  return (
    ANY_UUID_PATTERN.test(text) ||
    TOKEN_WORD_PATTERN.test(text) ||
    (text.match(HEX_RUN_PATTERN) ?? []).some((run) => run.length === 32)
  );
}

const registries = new WeakMap<object, Set<string>>();

function fail(code: string): never {
  throw new Error(code);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

export function createProviderProbeKnownValueRegistry(): ProviderProbeKnownValueRegistry {
  const values = new Set<string>();
  const registry = Object.freeze({
    register(value: string): void {
      if (
        typeof value !== "string" ||
        value.length < PROVIDER_PROBE_OUTPUT_LIMITS.minKnownValueLength ||
        value.length > PROVIDER_PROBE_OUTPUT_LIMITS.maxKnownValueLength
      ) {
        fail("provider_probe_known_value_invalid");
      }
      if (!values.has(value) && values.size >= PROVIDER_PROBE_OUTPUT_LIMITS.maxKnownValues) {
        fail("provider_probe_known_value_capacity_exceeded");
      }
      values.add(value);
    },
    size: () => values.size,
  });
  registries.set(registry, values);
  return registry;
}

export function isProviderProbeKnownValueRegistry(candidate: unknown): candidate is ProviderProbeKnownValueRegistry {
  return !!candidate && typeof candidate === "object" && registries.has(candidate);
}

export function computeProviderProbeConfigDigest(bytes: Uint8Array): string {
  if (!(bytes instanceof Uint8Array)) {
    fail("provider_probe_config_digest_invalid_input");
  }
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

// Read-only, from the pinned app root only (after its path-syntax check): the installed versions, from each
// package's own package.json.
export function readInstalledSupabaseSdkVersions(): Readonly<{ supabaseJsVersion: string; authJsVersion: string }> {
  const appRoot = providerProbeAppRoot();
  const versions: Partial<Record<keyof typeof SDK_PACKAGES, string>> = {};
  for (const [field, packageName] of Object.entries(SDK_PACKAGES) as [keyof typeof SDK_PACKAGES, string][]) {
    let manifest: unknown;
    try {
      manifest = JSON.parse(
        readFileSync(path.join(appRoot, "node_modules", ...packageName.split("/"), "package.json"), "utf8"),
      );
    } catch {
      fail("provider_probe_sdk_version_unreadable");
    }
    const record = manifest as Record<string, unknown> | null;
    if (
      !record ||
      typeof record !== "object" ||
      record.name !== packageName ||
      typeof record.version !== "string" ||
      !SEMVER_PATTERN.test(record.version)
    ) {
      fail("provider_probe_sdk_version_invalid");
    }
    versions[field] = record.version;
  }
  return Object.freeze({
    supabaseJsVersion: versions.supabaseJsVersion!,
    authJsVersion: versions.authJsVersion!,
  });
}

function assertConfiguredNotObserved(raw: unknown): ProviderProbeConfiguredNotObserved {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail("provider_probe_envelope_invalid");
  }
  const value = raw as Record<string, unknown>;
  if (!hasExactKeys(value, CONFIGURED_KEYS) || CONFIGURED_KEYS.some((key) => !CONFIGURED_SETTINGS.includes(value[key] as string))) {
    fail("provider_probe_envelope_invalid");
  }
  return Object.freeze({
    anonymousSignIns: value.anonymousSignIns as ProviderProbeConfiguredSetting,
    phoneSignUp: value.phoneSignUp as ProviderProbeConfiguredSetting,
  });
}

// R11: a closed list of record counts outside the kernel's bounds; each entry names a
// record position, its probe id, a bounded field, and the relation paired with its limit.
function assertCountsBeyondEvidenceBounds(raw: unknown): readonly ProviderProbeCountBeyondEvidenceBounds[] {
  if (!Array.isArray(raw) || raw.length > PROVIDER_PROBE_OUTPUT_LIMITS.maxEvidenceRecords * 4) {
    fail("provider_probe_envelope_invalid");
  }
  const seen = new Set<string>();
  return Object.freeze(
    raw.map((entry: unknown) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry) || !hasExactKeys(entry as Record<string, unknown>, BEYOND_KEYS)) {
        fail("provider_probe_envelope_invalid");
      }
      const { record, probeId, field, relation, limit } = entry as Record<string, unknown>;
      const bounded = typeof field === "string" && Object.prototype.hasOwnProperty.call(PROVIDER_PROBE_EVIDENCE_BOUNDS, field);
      if (
        !Number.isSafeInteger(record) ||
        (record as number) < 0 ||
        (record as number) >= PROVIDER_PROBE_OUTPUT_LIMITS.maxEvidenceRecords ||
        typeof probeId !== "string" ||
        !EVIDENCE_PROBE_ID_PATTERN.test(probeId) ||
        !bounded ||
        !(
          (relation === "more-than" && limit === PROVIDER_PROBE_EVIDENCE_BOUNDS[field as ProviderProbeEvidenceCountField]) ||
          (relation === "less-than" && limit === 0)
        ) ||
        seen.has(`${record as number}:${field as string}`)
      ) {
        fail("provider_probe_envelope_invalid");
      }
      seen.add(`${record as number}:${field as string}`);
      return Object.freeze({
        record: record as number,
        probeId,
        field: field as ProviderProbeEvidenceCountField,
        relation: relation as "more-than" | "less-than",
        limit: limit as number,
      });
    }),
  );
}

function assertEnvelope(raw: unknown): ProviderProbeRunEnvelope {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail("provider_probe_envelope_invalid");
  }
  const value = raw as Record<string, unknown>;
  if (
    !hasExactKeys(value, ENVELOPE_KEYS) ||
    value.envelopeVersion !== 3 ||
    (value.profile !== "current-config" && value.profile !== "locked-down") ||
    typeof value.runId !== "string" ||
    !/^P28-[0-9]{8}-[a-z0-9][a-z0-9-]{5,31}$/.test(value.runId) ||
    typeof value.supabaseCliVersion !== "string" ||
    !SEMVER_PATTERN.test(value.supabaseCliVersion) ||
    typeof value.supabaseJsVersion !== "string" ||
    !SEMVER_PATTERN.test(value.supabaseJsVersion) ||
    typeof value.authJsVersion !== "string" ||
    !SEMVER_PATTERN.test(value.authJsVersion) ||
    typeof value.configDigest !== "string" ||
    !CONFIG_DIGEST_PATTERN.test(value.configDigest)
  ) {
    fail("provider_probe_envelope_invalid");
  }
  return Object.freeze({
    envelopeVersion: 3 as const,
    profile: value.profile,
    runId: value.runId,
    supabaseCliVersion: value.supabaseCliVersion,
    supabaseJsVersion: value.supabaseJsVersion,
    authJsVersion: value.authJsVersion,
    configDigest: value.configDigest,
    configuredNotObserved: assertConfiguredNotObserved(value.configuredNotObserved),
    countsBeyondEvidenceBounds: assertCountsBeyondEvidenceBounds(value.countsBeyondEvidenceBounds),
  });
}

// R11: the run's envelope with the record counts that were outside the kernel's bounds
// (found when the records are finalized, after PP-00 built the envelope). Validated like
// the rest of the envelope; assembly then checks each entry against its record.
export function withCountsBeyondEvidenceBounds(
  envelope: ProviderProbeRunEnvelope,
  entries: readonly ProviderProbeCountBeyondEvidenceBounds[],
): ProviderProbeRunEnvelope {
  return assertEnvelope({ ...assertEnvelope(envelope), countsBeyondEvidenceBounds: entries });
}

export function createProviderProbeRunEnvelope(
  config: ProviderProbeSafetyConfig,
  observed: ProviderProbeObservedRun,
): ProviderProbeRunEnvelope {
  if (!observed || typeof observed !== "object" || Array.isArray(observed)) {
    fail("provider_probe_envelope_invalid");
  }
  if (!hasExactKeys(observed as Record<string, unknown>, OBSERVED_KEYS)) {
    fail("provider_probe_envelope_invalid");
  }
  return assertEnvelope({
    envelopeVersion: 3,
    profile: config.profile,
    runId: config.runId,
    supabaseCliVersion: observed.supabaseCliVersion,
    supabaseJsVersion: observed.supabaseJsVersion,
    authJsVersion: observed.authJsVersion,
    configDigest: observed.configDigest,
    configuredNotObserved: observed.configuredNotObserved,
    countsBeyondEvidenceBounds: [],
  });
}

function replaceControlCharacters(text: string): string {
  // The kernel matches JSON text, where a newline becomes the two characters "\n";
  // that would hide a pattern such as "Bearer" at the start of a line from its
  // word-boundary check. Control and separator characters become spaces first.
  let result = "";
  for (const character of text) {
    const code = character.codePointAt(0) as number;
    const isControl =
      code <= 0x1f || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029;
    result += isControl ? " " : character;
  }
  return result;
}

function decodePercent(text: string): string {
  return text.replace(/%([0-9A-Fa-f]{2})/g, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeEscapes(text: string): string {
  return text
    .replace(/\\u\{([0-9A-Fa-f]{1,6})\}/g, (_match, hex: string) => safeCodePoint(parseInt(hex, 16)))
    .replace(/\\u([0-9A-Fa-f]{4})/g, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\x([0-9A-Fa-f]{2})/g, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeHtmlReferences(text: string): string {
  return text
    .replace(/&#x([0-9A-Fa-f]{1,6});?/g, (_match, hex: string) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]{1,7});?/g, (_match, digits: string) => safeCodePoint(parseInt(digits, 10)))
    .replace(/&commat;/gi, "@");
}

function safeCodePoint(code: number): string {
  return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
}

function decodedVariants(text: string): string[] {
  const variants = new Set<string>([text]);
  let frontier = [text];
  for (let pass = 0; pass < PROVIDER_PROBE_OUTPUT_LIMITS.maxDecodingPasses; pass += 1) {
    const next: string[] = [];
    for (const variant of frontier) {
      for (const decoded of [decodePercent(variant), decodeEscapes(variant), decodeHtmlReferences(variant)]) {
        if (!variants.has(decoded)) {
          variants.add(decoded);
          next.push(decoded);
        }
      }
    }
    frontier = next;
  }
  return [...variants];
}

function kernelRuleMatches(text: string): boolean {
  try {
    // The kernel serializer does not validate its argument; a one-field carrier
    // object makes it apply exactly its banked secret patterns to this text.
    serializeProviderProbeEvidence({ scannedOutput: text } as unknown as ProviderProbeEvidence);
    return false;
  } catch {
    return true;
  }
}

function knownValueForms(value: string): string[] {
  const bytes = Buffer.from(value, "utf8");
  return [
    value,
    encodeURIComponent(value),
    JSON.stringify(value).slice(1, -1),
    bytes.toString("base64"),
    bytes.toString("base64").replace(/=+$/, ""),
    bytes.toString("base64url"),
  ];
}

export function scanProviderProbeOutput(
  text: string,
  registry?: ProviderProbeKnownValueRegistry,
): ProviderProbeOutputScan {
  if (typeof text !== "string" || text.length > PROVIDER_PROBE_OUTPUT_LIMITS.maxScannedCharacters) {
    fail("provider_probe_scan_invalid_input");
  }
  if (registry !== undefined && !isProviderProbeKnownValueRegistry(registry)) {
    fail("provider_probe_scan_invalid_registry");
  }
  const variants = decodedVariants(text);
  const normalized = variants.flatMap((variant) => [variant, replaceControlCharacters(variant)]);
  const kernelRuleMatched = normalized.some(kernelRuleMatches);
  const strictRuleMatched = normalized.some(strictRuleMatches);
  let knownValueMatches = 0;
  for (const value of registry === undefined ? [] : (registries.get(registry) ?? [])) {
    const forms = knownValueForms(value);
    if (variants.some((variant) => forms.some((form) => variant.includes(form)))) {
      knownValueMatches += 1;
    }
  }
  return Object.freeze({
    passed: !kernelRuleMatched && !strictRuleMatched && knownValueMatches === 0,
    kernelRuleMatched,
    strictRuleMatched,
    knownValueMatches,
  });
}

export function assembleProviderProbeRunOutput(
  input: Readonly<{
    envelope: ProviderProbeRunEnvelope;
    evidence: readonly unknown[];
    registry: ProviderProbeKnownValueRegistry;
  }>,
): string {
  if (!isProviderProbeKnownValueRegistry(input.registry)) {
    fail("provider_probe_output_registry_required");
  }
  const envelope = assertEnvelope(input.envelope);
  if (!Array.isArray(input.evidence) || input.evidence.length > PROVIDER_PROBE_OUTPUT_LIMITS.maxEvidenceRecords) {
    fail("provider_probe_output_invalid_evidence");
  }
  const records = input.evidence.map((record) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      fail("provider_probe_output_invalid_evidence");
    }
    // The kernel freezes what it is given, so it receives a fresh copy.
    const evidence = createProviderProbeEvidence({ ...(record as Record<string, unknown>) });
    serializeProviderProbeEvidence(evidence);
    return evidence;
  });
  // R11: every out-of-bounds entry names a record that exists, with its probe id, whose
  // field holds exactly the bound, and which did not pass.
  for (const entry of envelope.countsBeyondEvidenceBounds) {
    const target = records[entry.record] as unknown as Record<string, unknown> | undefined;
    if (
      target === undefined ||
      target.probeId !== entry.probeId ||
      target[entry.field] !== entry.limit ||
      target.outcome === "pass"
    ) {
      fail("provider_probe_output_invalid_evidence");
    }
  }
  const output = JSON.stringify({ envelope, evidence: records });
  if (!scanProviderProbeOutput(output, input.registry).passed) {
    fail("provider_probe_output_secret_pattern");
  }
  return output;
}
