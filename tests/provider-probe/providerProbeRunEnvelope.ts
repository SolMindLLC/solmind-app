// Test-only run envelope, known-value registry and output scanner for the future
// local Supabase Auth provider probes.
//
// Output boundary. The only document a run may emit is the closed envelope below
// plus kernel-validated evidence records (`createProviderProbeEvidence`): every field
// is a closed enum, a bounded number, a boolean, a pinned version string, the run id
// or a SHA-256 config digest. That closed schema is the boundary.
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

export type ProviderProbeRunEnvelope = Readonly<{
  envelopeVersion: 1;
  profile: ProviderProbeProfile;
  runId: string;
  supabaseCliVersion: string;
  supabaseJsVersion: string;
  authJsVersion: string;
  configDigest: string;
}>;

export type ProviderProbeObservedRun = Readonly<{
  supabaseCliVersion: string;
  supabaseJsVersion: string;
  authJsVersion: string;
  configDigest: string;
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
  "envelopeVersion",
  "profile",
  "runId",
  "supabaseCliVersion",
  "supabaseJsVersion",
] as const;
const OBSERVED_KEYS = ["authJsVersion", "configDigest", "supabaseCliVersion", "supabaseJsVersion"] as const;
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

function assertEnvelope(raw: unknown): ProviderProbeRunEnvelope {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail("provider_probe_envelope_invalid");
  }
  const value = raw as Record<string, unknown>;
  if (
    !hasExactKeys(value, ENVELOPE_KEYS) ||
    value.envelopeVersion !== 1 ||
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
    envelopeVersion: 1 as const,
    profile: value.profile,
    runId: value.runId,
    supabaseCliVersion: value.supabaseCliVersion,
    supabaseJsVersion: value.supabaseJsVersion,
    authJsVersion: value.authJsVersion,
    configDigest: value.configDigest,
  });
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
    envelopeVersion: 1,
    profile: config.profile,
    runId: config.runId,
    supabaseCliVersion: observed.supabaseCliVersion,
    supabaseJsVersion: observed.supabaseJsVersion,
    authJsVersion: observed.authJsVersion,
    configDigest: observed.configDigest,
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
  const output = JSON.stringify({ envelope, evidence: records });
  if (!scanProviderProbeOutput(output, input.registry).passed) {
    fail("provider_probe_output_secret_pattern");
  }
  return output;
}
