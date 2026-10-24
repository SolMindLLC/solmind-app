import "server-only";

import { createHash } from "node:crypto";
import { types } from "node:util";

import { EXPLORER_SAFE_CONTEXT_LIMITS } from "../context/explorerSafeContext";

export const METHODOLOGY_SAFETY_SCREEN_CRITERIA = Object.freeze([
  "boundary_override",
  "false_identity",
  "crisis_override",
  "diagnosis_framework",
  "concealment",
  "dependency",
  "superiority",
  "manipulative_certainty",
  "identity_imposition",
  "emotional_coercion",
  "unsafe_escalation",
  "ideological_rigidity",
  "shame",
  "exploitation",
  "manipulative_urgency",
  "cult_dynamics",
  "fear_dependency",
  "infallible_authority",
] as const);

export const METHODOLOGY_SAFETY_SCREEN_LIMITS = Object.freeze({
  subjectCharacters: EXPLORER_SAFE_CONTEXT_LIMITS.methodologyTextCharacters,
  findingCount: 16,
  excerptCharacters: 512,
  explanationCharacters: 768,
} as const);

export const METHODOLOGY_SAFETY_SCREEN_ERROR_CODES = Object.freeze([
  "methodology_screen_invalid_subject",
  "methodology_screen_invalid_result",
  "methodology_screen_subject_mismatch",
  "methodology_screen_invalid_finding",
  "methodology_screen_limit_exceeded",
] as const);

type MethodologySafetyScreenErrorCode =
  (typeof METHODOLOGY_SAFETY_SCREEN_ERROR_CODES)[number];
type MethodologySafetyScreenCriterion =
  (typeof METHODOLOGY_SAFETY_SCREEN_CRITERIA)[number];

export class MethodologySafetyScreenError extends Error {
  readonly code: MethodologySafetyScreenErrorCode;

  constructor(code: MethodologySafetyScreenErrorCode) {
    super(code);
    this.name = "MethodologySafetyScreenError";
    this.code = code;
  }
}

export type MethodologySafetyScreenSubject = Readonly<{
  methodologyContextPackVersionId: string;
  content: string;
}>;

export type BoundMethodologySafetyScreenSubject = Readonly<{
  subject: MethodologySafetyScreenSubject;
  subjectSha256: string;
}>;

export type MethodologySafetyScreenFinding = Readonly<{
  criterion: MethodologySafetyScreenCriterion;
  severity: "review" | "fail";
  excerpt: string;
  explanation: string;
}>;

export type MethodologySafetyScreenResult = Readonly<{
  result: "pass" | "review" | "fail";
  subject_sha256: string;
  findings: ReadonlyArray<MethodologySafetyScreenFinding>;
  methodologyContextPackVersionId: string;
}>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[0-9A-F]{64}$/;
const UNSAFE_TEXT_PATTERN =
  /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u061c\u200b-\u200f\u2028-\u202e\u2060\u2066-\u2069\ufeff]/u;

function fail(code: MethodologySafetyScreenErrorCode): never {
  throw new MethodologySafetyScreenError(code);
}

// Snapshot enumerable own data properties before reading values. Reject proxies
// before reflection as their traps could otherwise execute caller-owned code.
function readClosedRecord(
  input: unknown,
  keys: ReadonlyArray<string>,
  code: MethodologySafetyScreenErrorCode,
): Record<string, unknown> {
  if (
    input === null ||
    typeof input !== "object" ||
    types.isProxy(input) ||
    Array.isArray(input)
  ) {
    fail(code);
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    fail(code);
  }
  const ownKeys = Reflect.ownKeys(input);
  if (
    ownKeys.length !== keys.length ||
    ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))
  ) {
    fail(code);
  }
  const snapshot: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      fail(code);
    }
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function readFindings(input: unknown): unknown[] {
  if (
    input === null ||
    typeof input !== "object" ||
    types.isProxy(input) ||
    !Array.isArray(input) ||
    Object.getPrototypeOf(input) !== Array.prototype
  ) {
    fail("methodology_screen_invalid_result");
  }
  const length = Object.getOwnPropertyDescriptor(input, "length")?.value;
  if (!Number.isSafeInteger(length) || length < 0) {
    fail("methodology_screen_invalid_result");
  }
  if (length > METHODOLOGY_SAFETY_SCREEN_LIMITS.findingCount) {
    fail("methodology_screen_limit_exceeded");
  }
  // Native length is the sole permitted non-enumerable array property. Exact
  // key count plus every dense index excludes holes, symbols and extra keys.
  if (Reflect.ownKeys(input).length !== length + 1) {
    fail("methodology_screen_invalid_result");
  }
  const findings: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      fail("methodology_screen_invalid_result");
    }
    findings.push(descriptor.value);
  }
  return findings;
}

function parseText(
  input: unknown,
  maximum: number,
  requireTrimmed: boolean,
  code: MethodologySafetyScreenErrorCode,
): string {
  if (
    typeof input !== "string" ||
    input.trim().length === 0 ||
    (requireTrimmed && input !== input.trim()) ||
    UNSAFE_TEXT_PATTERN.test(input)
  ) {
    fail(code);
  }
  if (input.length > maximum) {
    fail("methodology_screen_limit_exceeded");
  }
  // UTF-8 encoding would silently replace an isolated UTF-16 surrogate. Refuse
  // it instead, so accepted hash and citation bytes cannot change on encoding.
  for (let index = 0; index < input.length; index += 1) {
    const unit = input.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = input.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        fail(code);
      }
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      fail(code);
    }
  }
  return input;
}

/**
 * Binds exact bytes only. Neither a syntactically valid version UUID nor this
 * digest proves a stored version exists, belongs to a scope, or is approved.
 */
export function bindMethodologySafetyScreenSubject(
  input: unknown,
): BoundMethodologySafetyScreenSubject {
  const raw = readClosedRecord(
    input,
    ["methodologyContextPackVersionId", "content"],
    "methodology_screen_invalid_subject",
  );
  if (
    typeof raw.methodologyContextPackVersionId !== "string" ||
    !UUID_PATTERN.test(raw.methodologyContextPackVersionId)
  ) {
    fail("methodology_screen_invalid_subject");
  }
  const subject = Object.freeze({
    methodologyContextPackVersionId: raw.methodologyContextPackVersionId,
    content: parseText(
      raw.content,
      METHODOLOGY_SAFETY_SCREEN_LIMITS.subjectCharacters,
      true,
      "methodology_screen_invalid_subject",
    ),
  });
  const subjectSha256 = createHash("sha256")
    .update(subject.content, "utf8")
    .digest("hex")
    .toUpperCase();
  return Object.freeze({ subject, subjectSha256 });
}

/**
 * Validates only structure, exact-byte linkage and outcome coherence. It does
 * not certify semantic truth, perform an AI screen, persist an outcome/audit,
 * approve a version, override a failed screen, or activate a provider.
 */
export function parseMethodologySafetyScreenResult(
  input: unknown,
  expectedSubject: unknown,
): MethodologySafetyScreenResult {
  // Never trust a caller-owned digest or assume its subject stayed unchanged.
  const { subject, subjectSha256 } =
    bindMethodologySafetyScreenSubject(expectedSubject);
  const raw = readClosedRecord(
    input,
    ["result", "subject_sha256", "findings"],
    "methodology_screen_invalid_result",
  );
  if (
    raw.result !== "pass" &&
    raw.result !== "review" &&
    raw.result !== "fail"
  ) {
    fail("methodology_screen_invalid_result");
  }
  if (
    typeof raw.subject_sha256 !== "string" ||
    !SHA256_PATTERN.test(raw.subject_sha256) ||
    raw.subject_sha256 !== subjectSha256
  ) {
    fail("methodology_screen_subject_mismatch");
  }
  const duplicates = new Set<string>();
  const findings = readFindings(raw.findings).map((inputFinding) => {
    const finding = readClosedRecord(
      inputFinding,
      ["criterion", "severity", "excerpt", "explanation"],
      "methodology_screen_invalid_finding",
    );
    const criterion = METHODOLOGY_SAFETY_SCREEN_CRITERIA.find(
      (allowed) => allowed === finding.criterion,
    );
    if (
      criterion === undefined ||
      (finding.severity !== "review" && finding.severity !== "fail")
    ) {
      fail("methodology_screen_invalid_finding");
    }
    const excerpt = parseText(
      finding.excerpt,
      METHODOLOGY_SAFETY_SCREEN_LIMITS.excerptCharacters,
      false,
      "methodology_screen_invalid_finding",
    );
    const explanation = parseText(
      finding.explanation,
      METHODOLOGY_SAFETY_SCREEN_LIMITS.explanationCharacters,
      true,
      "methodology_screen_invalid_finding",
    );
    const identity = JSON.stringify([criterion, excerpt]);
    if (!subject.content.includes(excerpt) || duplicates.has(identity)) {
      fail("methodology_screen_invalid_finding");
    }
    duplicates.add(identity);
    return Object.freeze({
      criterion,
      severity: finding.severity,
      excerpt,
      explanation,
    });
  });
  if (
    (raw.result === "pass" && findings.length !== 0) ||
    (raw.result === "review" &&
      (findings.length === 0 ||
        findings.some((finding) => finding.severity !== "review"))) ||
    (raw.result === "fail" &&
      !findings.some((finding) => finding.severity === "fail"))
  ) {
    fail("methodology_screen_invalid_result");
  }
  return Object.freeze({
    result: raw.result,
    subject_sha256: subjectSha256,
    findings: Object.freeze(findings),
    methodologyContextPackVersionId: subject.methodologyContextPackVersionId,
  });
}
