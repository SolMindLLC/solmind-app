import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  getExplorerPrivateConfigurationCandidate,
  parseExplorerPrivateConfigurationCandidate,
  type ExplorerPrivateConfigurationCandidate,
} from "./explorerPrivateConfiguration";

// Local mechanical configuration fixtures only. No detector-quality, resource,
// real screen, human approval, provider, database or runtime-readiness proof.
function candidate(): ExplorerPrivateConfigurationCandidate {
  const result = getExplorerPrivateConfigurationCandidate();
  if (result === null) throw new Error("pinned_candidate_unavailable");
  return result;
}
function clone(): Record<string, unknown> {
  return structuredClone(candidate()) as unknown as Record<string, unknown>;
}
function record(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}
function assertDeeplyFrozen(value: unknown): void {
  if (value !== null && typeof value === "object") {
    expect(Object.isFrozen(value)).toBe(true);
    for (const child of Object.values(value)) assertDeeplyFrozen(child);
  }
}

describe("private Explorer exact inert configuration candidate", () => {
  it("returns a new deeply immutable copy and severs all caller-owned nested references", () => {
    const input = clone();
    const parsed = parseExplorerPrivateConfigurationCandidate(input);
    expect(parsed).toEqual(candidate());
    expect(parsed).not.toBe(input);
    expect(parsed?.fallback).not.toBe(input.fallback);
    assertDeeplyFrozen(parsed);
    record(input.globalPolicy).text = "Later caller mutation";
    record((record(input.fallback).rules as unknown[])[0]).level = 0;
    expect(parsed?.globalPolicy.text).toBe(candidate().globalPolicy.text);
    expect(parsed?.fallback.rules[0].level).toBe(4);
    expect(getExplorerPrivateConfigurationCandidate()).not.toBe(getExplorerPrivateConfigurationCandidate());
  });

  it("retains the exact global, crisis and structured-role decoded UTF-8 byte identities", () => {
    const value = candidate();
    const expected = [
      [value.globalPolicy, 2270, "E0F4D2221572A814AE6732C7B8F6D596A66306F4680C171E082283D0C36C798F"],
      [value.crisisBehavior, 2222, "7B39A9C98351D25E2FAC5DA236E2086B3F33CCBD8987A80AE6716E5242208D84"],
      [value.roleBehavior, 2674, "304EE170CC182F15D376A36D1278FD5ADFFCC7420231F395959D496D14D7EE95"],
    ] as const;
    for (const [part, bytes, sha] of expected) {
      expect(Buffer.byteLength(part.text, "utf8")).toBe(bytes);
      expect(createHash("sha256").update(part.text, "utf8").digest("hex").toUpperCase()).toBe(sha);
      expect(part.sha256).toBe(sha);
    }
    expect(value.methodologySubjectSha256).toBe("86AB02C9403C5DD5E9606986ECE9081802B489CFE51D21839D042FA52E504CCA");
    expect(Object.hasOwn(value, "methodologyContextPackVersionId")).toBe(false);
    expect(Object.hasOwn(value, "methodologyContext")).toBe(false);
  });

  it("pins actual assembler-compatible labels and all seven finite reviewed-language definitions", () => {
    const value = candidate();
    const labels = [value.protocolVersion, value.promptVersion, value.instructionVersion, value.roleVersion,
      value.globalPolicy.version, value.roleBehavior.version, value.crisisBehavior.version,
      value.fallback.version, value.fallback.normalizationVersion, value.trustedResponses.version,
      value.resourceCandidate.version];
    for (const label of labels) expect(label).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/);
    expect(value.fallback.rules.map(rule => [rule.id, rule.kind, rule.level, rule.minorIndicated])).toEqual([
      ["self-intent", "literal_phrases", 4, false],
      ["other-intent", "literal_phrases", 4, false],
      ["passive-ideation", "literal_phrases", 3, false],
      ["ongoing-abuse", "literal_phrases", 3, false],
      ["immediate-danger", "literal_phrases", 4, false],
      ["minor-statement", "literal_phrases", 0, true],
      ["minor-age", "first_person_minor_age_v1", 0, true],
    ]);
    expect(value.fallback.rules[2].phrases).toEqual(["wish i wouldn't wake up"]);
    expect(value.fallback.rules[6].pattern).toBe("(?<![\\p{L}\\p{N}_])(?:i am|i'm) (?:[0-9]|1[0-7])(?:(?: years? old| yo)(?![\\p{L}\\p{N}_])|(?=$|[!?,;]|\\.(?![0-9])| and(?: |$)))");
  });

  it("keeps resource identities and trusted text explicitly unverified and unapproved", () => {
    const value = candidate();
    expect(value.resourceCandidate.version).toBe("us-canonical-resource-snapshot.review-only-20261025-r11q2");
    expect(value.resourceCandidate.verificationRequired).toBe(true);
    expect(value.resourceCandidate.verifiedAt).toBeNull();
    expect(value.resourceCandidate.verifiedBy).toBeNull();
    expect(value.resourceCandidate.youthResourceSelection).toBeNull();
    expect(value.resourceCandidate.items.map(item => [item.name, item.contact, item.displayOrder])).toEqual([
      ["988 Suicide & Crisis Lifeline", "call or text 988", 1],
      ["Crisis Text Line", "text HOME to 741741", 2],
      ["Local emergency services", "911 for immediate danger", 3],
    ]);
    expect(value.resourceCandidate.items.every(item => !item.currentContactVerified && !item.youthSuitabilityVerified)).toBe(true);
    expect(value.trustedResponses.status).toBe("EXACT REVIEW TEXT / NOT APPROVED OR RUNTIME");
    expect(value.trustedResponses.crisis.limits).toBe("I'm an AI support tool, not a crisis service, and I can't provide emergency help.");
    expect(value.trustedResponses.criticalPersistenceFailurePrefix).toBe("I couldn't confirm that this update was saved. I can still offer the support and help options below.");
    for (const key of ["ready", "approved", "provider", "reviewer", "packId"]) expect(Object.hasOwn(value, key)).toBe(false);
  });

  it("accepts ordinary key reordering and null-prototype data without reinterpreting content", () => {
    const input = clone();
    const reordered = Object.fromEntries(Object.entries(input).reverse());
    Object.setPrototypeOf(record(reordered.globalPolicy), null);
    Object.setPrototypeOf(reordered, null);
    expect(parseExplorerPrivateConfigurationCandidate(reordered)).toEqual(candidate());
  });

  const changes: ReadonlyArray<readonly [string, (input: Record<string, unknown>) => void]> = [
    ["unknown approval flag", input => { input.approved = true; }],
    ["missing required layer", input => { delete input.crisisBehavior; }],
    ["different protocol", input => { input.protocolVersion = "explorer-safety-reply.v2"; }],
    ["oversized label", input => { input.promptVersion = "x".repeat(65); }],
    ["changed text with internally matching digest", input => {
      const part = record(input.globalPolicy);
      part.text = `${part.text}\n`;
      part.sha256 = createHash("sha256").update(part.text as string, "utf8").digest("hex").toUpperCase();
    }],
    ["changed digest", input => { record(input.roleBehavior).sha256 = "A".repeat(64); }],
    ["arbitrary regex", input => {
      const rules = record(input.fallback).rules as unknown[];
      record(rules[6]).pattern = "(a+)+$";
    }],
    ["changed literal policy", input => {
      const rules = record(input.fallback).rules as unknown[];
      record(rules[0]).level = 0;
    }],
    ["empty fallback configuration", input => { record(input.fallback).rules = []; }],
    ["manufactured resource verification", input => { record(input.resourceCandidate).verifiedAt = "2026-10-25T12:00:00Z"; }],
    ["invented methodology identity", input => { input.methodologyContextPackVersionId = "00000000-0000-4000-8000-000000000001"; }],
    ["invented trusted response readiness", input => { record(input.trustedResponses).ready = true; }],
    ["cyclic wrong layer", input => { input.globalPolicy = input; }],
  ];
  it.each(changes)("rejects unsupported candidate changes: %s", (_name, change) => {
    const input = clone();
    change(input);
    expect(parseExplorerPrivateConfigurationCandidate(input)).toBeNull();
  });

  it.each([null, undefined, true, 0, "configuration", [], new Date()])("rejects invalid outer input: %#", input => {
    expect(parseExplorerPrivateConfigurationCandidate(input)).toBeNull();
  });

  it("rejects getter, proxy and revoked-proxy shapes without executing their bodies or traps", () => {
    let calls = 0;
    const getterInput = clone();
    Object.defineProperty(getterInput, "fallback", { enumerable: true, get: () => { calls += 1; throw new Error("must not execute"); } });
    expect(parseExplorerPrivateConfigurationCandidate(getterInput)).toBeNull();
    const nested = clone();
    Object.defineProperty(record(nested.trustedResponses), "version", { enumerable: true, get: () => { calls += 1; return "wrong"; } });
    expect(parseExplorerPrivateConfigurationCandidate(nested)).toBeNull();
    const proxy = new Proxy(clone(), {
      get: () => { calls += 1; throw new Error("must not execute"); },
      getPrototypeOf: () => { calls += 1; throw new Error("must not execute"); },
      ownKeys: () => { calls += 1; throw new Error("must not execute"); },
    });
    expect(parseExplorerPrivateConfigurationCandidate(proxy)).toBeNull();
    const revoked = Proxy.revocable(clone(), {});
    revoked.revoke();
    expect(parseExplorerPrivateConfigurationCandidate(revoked.proxy)).toBeNull();
    expect(calls).toBe(0);
  });

  it("rejects symbols, hidden fields, sparse/extra arrays and exotic nested prototypes", () => {
    const symbol = clone();
    Object.defineProperty(symbol, Symbol("extra"), { value: true });
    const hidden = clone();
    Object.defineProperty(hidden, "globalPolicy", { value: hidden.globalPolicy, enumerable: false });
    const sparse = clone();
    delete (record(sparse.fallback).rules as unknown[])[0];
    const extraArray = clone();
    Object.defineProperty(record(extraArray.fallback).rules, "extra", { value: true });
    const exotic = clone();
    Object.setPrototypeOf(record(exotic.trustedResponses), { inherited: true });
    for (const input of [symbol, hidden, sparse, extraArray, exotic]) {
      expect(parseExplorerPrivateConfigurationCandidate(input)).toBeNull();
    }
  });
});
