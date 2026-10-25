import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  effectiveMethodologySignalAborted,
  parseEffectiveMethodologyReadInput,
  parseEffectiveMethodologyScope,
  parseEffectiveMethodologySelection,
  type EffectiveMethodologyReadInput,
} from "./effectiveMethodologyContext";

// Structural fixtures only: no database, real screen, human approval or provider.
const id = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const text = "Synthetic reflection-method content.\nPreserve the Explorer's agency.";
const digest = createHash("sha256").update(text, "utf8").digest("hex").toUpperCase();
const expected = { packId: id(1), expectedScope: { type: "guide" as const, id: id(2) } };
const selection = () => ({
  packId: id(1), scopeType: "guide" as const, scopeId: id(2), versionId: id(3), versionNumber: 1,
  contentMarkdown: text, contentSha256: digest, methodologyAuthorizationVersion: `MV1:${"A".repeat(64)}`,
});
const request = (): EffectiveMethodologyReadInput => ({
  actor: { accountId: id(4), applicationSessionId: id(5) }, ...structuredClone(expected),
});
const unavailable = "effective_methodology_context_unavailable";

describe("effective methodology exact-byte boundary (synthetic data only)", () => {
  it("returns an immutable exact copy without adding or normalizing text", () => {
    const original = selection();
    const parsed = parseEffectiveMethodologySelection(original, expected);
    expect(parsed).toEqual(original);
    expect(parsed).not.toBe(original);
    expect(Object.isFrozen(parsed)).toBe(true);
    original.contentMarkdown = "Changed after selection";
    expect(parsed.contentMarkdown).toBe(text);
    expect(parsed.contentSha256).toBe(digest);
  });

  it.each([
    { packId: id(9) }, { scopeType: "organization" }, { scopeType: "practice" }, { scopeId: id(9) },
    { versionId: "not-a-version" }, { versionNumber: 0 }, { versionNumber: -1 }, { versionNumber: 1.5 },
    { versionNumber: Number.MAX_SAFE_INTEGER + 1 }, { versionNumber: "1" },
    { contentSha256: digest.toLowerCase() }, { contentSha256: "F".repeat(64) },
    { methodologyAuthorizationVersion: `MV1:${"a".repeat(64)}` },
    { methodologyAuthorizationVersion: `MV2:${"A".repeat(64)}` },
    { methodologyAuthorizationVersion: "MV1:" }, { ignoredAuthority: true },
  ])("rejects mismatched or malformed selected evidence: %#", (change) => {
    expect(() => parseEffectiveMethodologySelection({ ...selection(), ...change }, expected)).toThrow(unavailable);
  });

  it.each([
    "", " ", ` ${text}`, `${text}\n`, text.replace("\n", "\r\n"), "bad\ttext", "bad\u200btext",
    "isolated\ud800", "isolated\udc00", "x".repeat(24_001),
  ])("rejects unsafe or normalization-changing text without repairing its digest: %#", (contentMarkdown) => {
    const contentSha256 = createHash("sha256").update(contentMarkdown, "utf8").digest("hex").toUpperCase();
    expect(() => parseEffectiveMethodologySelection({ ...selection(), contentMarkdown, contentSha256 }, expected)).toThrow(unavailable);
  });

  it("preserves valid supplementary Unicode and the exact 24,000-unit boundary", () => {
    for (const contentMarkdown of ["A reflective question \u{1f331}", "x".repeat(24_000)]) {
      const contentSha256 = createHash("sha256").update(contentMarkdown, "utf8").digest("hex").toUpperCase();
      expect(parseEffectiveMethodologySelection({ ...selection(), contentMarkdown, contentSha256 }, expected).contentMarkdown).toBe(contentMarkdown);
    }
  });

  it("rejects getters and proxies before executing their code", () => {
    const getter = vi.fn(() => text);
    const hostile = Object.defineProperty(selection(), "contentMarkdown", { enumerable: true, get: getter });
    expect(() => parseEffectiveMethodologySelection(hostile, expected)).toThrow(unavailable);
    const trap = vi.fn(() => { throw new Error("PRIVATE_SOURCE_DETAIL"); });
    expect(() => parseEffectiveMethodologySelection(new Proxy(selection(), { ownKeys: trap, get: trap }), expected)).toThrow(unavailable);
    expect(getter).not.toHaveBeenCalled(); expect(trap).not.toHaveBeenCalled();
  });

  it("rejects symbols, hidden properties, inherited fields and exotic records", () => {
    const symbol = { ...selection(), [Symbol("authority")]: true };
    const hidden = Object.defineProperty(selection(), "private", { value: true });
    const inherited = Object.create(selection());
    for (const candidate of [symbol, hidden, inherited, [], new Date(), null]) {
      expect(() => parseEffectiveMethodologySelection(candidate, expected)).toThrow(unavailable);
    }
  });

  it("accepts null-prototype JSON records but copies them into the fixed output shape", () => {
    expect(parseEffectiveMethodologySelection(Object.assign(Object.create(null), selection()), expected)).toEqual(selection());
  });

  it("limits scopes to one exact GUIDE profile with no precedence or fallback", () => {
    expect(parseEffectiveMethodologyScope(expected.expectedScope)).toEqual(expected.expectedScope);
    for (const scope of [null, { type: "organization", id: id(2) }, { type: "practice", id: id(2) },
      { type: "guide", id: "wrong" }, { ...expected.expectedScope, fallback: id(8) }]) {
      expect(() => parseEffectiveMethodologyScope(scope)).toThrow(unavailable);
    }
  });

  it("rejects executable expected selectors before reading them", () => {
    const getter = vi.fn(() => id(1));
    const hostile = Object.defineProperty({ expectedScope: expected.expectedScope }, "packId", { enumerable: true, get: getter });
    expect(() => parseEffectiveMethodologySelection(selection(), hostile as typeof expected)).toThrow(unavailable);
    expect(getter).not.toHaveBeenCalled();
  });

  it("copies and freezes the exact actor/pack/scope request", () => {
    const original = request();
    const parsed = parseEffectiveMethodologyReadInput(original);
    expect(parsed).toEqual(original); expect(parsed).not.toBe(original);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.actor)).toBe(true); expect(Object.isFrozen(parsed.expectedScope)).toBe(true);
    (original.actor as { accountId: string }).accountId = id(99);
    expect(parsed.actor.accountId).toBe(id(4));
  });

  it.each([
    null, {}, { ...request(), packId: "wrong" }, { ...request(), actor: { accountId: id(4) } },
    { ...request(), actor: { ...request().actor, role: "admin" } },
    { ...request(), selectedVersionId: id(3) }, { ...request(), signal: {} },
  ])("rejects unknown or malformed read authority without repair: %#", (input) => {
    expect(() => parseEffectiveMethodologyReadInput(input)).toThrow(unavailable);
  });

  it("does not execute read-selector or actor getters", () => {
    const getter = vi.fn(() => id(4));
    const input = request();
    Object.defineProperty(input.actor, "accountId", { enumerable: true, get: getter });
    expect(() => parseEffectiveMethodologyReadInput(input)).toThrow(unavailable);
    expect(getter).not.toHaveBeenCalled();
  });

  it("uses native abort state without executing an overridden getter", () => {
    const controller = new AbortController();
    const getter = vi.fn(() => false);
    Object.defineProperty(controller.signal, "aborted", { get: getter });
    expect(effectiveMethodologySignalAborted(controller.signal)).toBe(false);
    controller.abort();
    expect(effectiveMethodologySignalAborted(controller.signal)).toBe(true);
    expect(getter).not.toHaveBeenCalled();
    expect(effectiveMethodologySignalAborted(undefined)).toBe(false);
  });
});
