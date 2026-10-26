import { describe, expect, it } from "vitest";
import { getExplorerPrivateConfigurationCandidate } from "../explorerPrivateConfiguration";
import type { ExplorerSafetyLevel } from "../explorerSafetyReplyContract";
import { combineExplorerSafety, detectExplorerFallback, normalizeExplorerSafetyComparison,
  requiresExplorerSafetyEvidence, selectExplorerSafetyReply, selectExplorerSafetyRequestMode,
  type ExplorerConversationPolicy, type ExplorerFallbackObservation } from "../explorerConversationSafety";

function configuration() { const value = getExplorerPrivateConfigurationCandidate(); if (!value) throw new Error("synthetic_fixture_configuration_unavailable"); return value; }
const CLEAR: ExplorerConversationPolicy = Object.freeze({ status: "known", restrictedLevel: null, adultReflectionStopped: false, safetyVersion: 0 });
function fallback(level: ExplorerSafetyLevel = 0, minorIndicated = false): ExplorerFallbackObservation {
  return { status: "available", policyVersion: "synthetic.v1", classification: { level, minorIndicated } };
}
const FIXTURES = [
  ["I want to kill myself", 4, false], ["I sometimes wish I wouldn’t wake up", 3, false],
  ["I am in immediate danger", 4, false], ["I am a minor", 0, true], ["I am 17 years old", 0, true],
  ["I am 18 years old", 0, false], ["I worked here for 17 years", 0, false], ["My sister is 17 years old", 0, false],
  ["I do not want to kill myself", 0, false], ["I am not saying I want to kill myself", 4, false],
  ["A character says: I am a minor", 0, true], ["I would like to reflect on my day", 0, false],
  ["I am going to hurt someone", 4, false], ["I am being abused", 3, false], ["I'm 15", 0, true],
  ["I'm 15 minutes late", 0, false], ["I am 15.5 miles away", 0, false], ["I AM\r\nIN\tIMMEDIATE DANGER", 4, false],
  ["xi am a minorx", 0, false],
] as const;
describe("Explorer configured fallback/combination/selection (mechanics only)", () => {
  it.each(FIXTURES)("R11Q2 prospective fixture: %s", (text, level, minorIndicated) => {
    const observed = detectExplorerFallback(text, configuration().fallback);
    expect(observed.status).toBe("available");
    if (observed.status === "available") expect(observed.classification).toEqual({ level, minorIndicated });
  });
  it("uses only a comparison copy with pinned Unicode/case/apostrophe/space normalization", () => {
    const original = "Ｉ　ＡＭ\r\nＡ　ＭＩＮＯＲ";
    expect(normalizeExplorerSafetyComparison(original)).toBe("i am a minor");
    expect(original).toBe("Ｉ　ＡＭ\r\nＡ　ＭＩＮＯＲ");
    expect(detectExplorerFallback("I sometimes wish I wouldn’t wake up", configuration().fallback)).toMatchObject({ classification: { level: 3 } });
  });
  it.each(["I'm 15.5", "I'm 150", "I'm 15 minutes", "I am 17and happy", "αi am a minor", "i am a minorβ", "_i am a minor_"])("does not create a numeric-prefix or Unicode-boundary minor hit: %s", (message) => {
    expect(detectExplorerFallback(message, configuration().fallback)).toMatchObject({ classification: { level: 0, minorIndicated: false } });
  });
  it("marks missing/invalid configuration or invalid message unavailable, never clear", () => {
    for (const value of [null, undefined, {}, { ...configuration().fallback, rules: [] }]) {
      expect(detectExplorerFallback("ordinary text", value as Parameters<typeof detectExplorerFallback>[1])).toEqual({ status: "unavailable" });
    }
    expect(detectExplorerFallback("\ud800", configuration().fallback)).toEqual({ status: "unavailable" });
    expect(detectExplorerFallback(" ", configuration().fallback)).toEqual({ status: "unavailable" });
  });
  it("does not execute a changed arbitrary regex rule", () => {
    const changed = structuredClone(configuration().fallback) as unknown as { rules: Array<Record<string, unknown>> };
    changed.rules[6].pattern = "(a+)+$";
    expect(detectExplorerFallback("aaaa!", changed as unknown as Parameters<typeof detectExplorerFallback>[1])).toEqual({ status: "unavailable" });
  });
  it("returns only version/bounded values, never matched text, rule ID or age", () => {
    const observed = detectExplorerFallback("I'm 15", configuration().fallback);
    expect(Object.keys(observed).sort()).toEqual(["classification", "policyVersion", "status"]);
    expect(JSON.stringify(observed)).not.toContain("minor-age"); expect(JSON.stringify(observed)).not.toContain("15");
  });
  it("selects one healthy mode and never claims a zero-call optimization", () => {
    expect(selectExplorerSafetyRequestMode(CLEAR, fallback())).toBe("classification_and_reply");
    expect(selectExplorerSafetyRequestMode(CLEAR, fallback(3))).toBe("classification_only");
    expect(selectExplorerSafetyRequestMode(CLEAR, fallback(0, true))).toBe("classification_only");
    expect(selectExplorerSafetyRequestMode({ ...CLEAR, status: "known", restrictedLevel: 4 }, fallback())).toBe("classification_only");
    expect(selectExplorerSafetyRequestMode({ status: "unknown" }, fallback())).toBeNull();
    expect(selectExplorerSafetyRequestMode(CLEAR, { status: "unavailable" })).toBeNull();
  });
  it("keeps prior restriction/adult stop and unavailable model distinct from model0", () => {
    const policy: ExplorerConversationPolicy = { status: "known", restrictedLevel: 4, adultReflectionStopped: true, safetyVersion: 2 };
    const partial = combineExplorerSafety({ policy, fallback: fallback(), model: null });
    expect(partial).toMatchObject({ coverage: "fallback_only", currentLevel: 0, restrictedLevel: 4, adultReflectionStopped: true });
    expect(combineExplorerSafety({ policy, fallback: { status: "unavailable" }, model: null }).currentLevel).toBeNull();
  });
  it("uses maximum/OR, while minor-only0 does not qualify for private positive evidence", () => {
    const model = { level: 2 as const, minorIndicated: true };
    expect(combineExplorerSafety({ policy: CLEAR, fallback: fallback(4), model })).toMatchObject({ coverage: "combined", currentLevel: 4, minorIndicated: true, restrictedLevel: 4, adultReflectionStopped: true });
    expect(requiresExplorerSafetyEvidence(fallback(0, true), { level: 0, minorIndicated: true })).toBe(false);
    expect(requiresExplorerSafetyEvidence(fallback(1), null)).toBe(true);
    expect(requiresExplorerSafetyEvidence(fallback(), model)).toBe(true);
  });
  it("requires combined observations and known state for ordinary intent; confirms no persistence itself", () => {
    const trusted = configuration().trustedResponses;
    const safety = combineExplorerSafety({ policy: CLEAR, fallback: fallback(), model: { level: 0, minorIndicated: false } });
    const plan = selectExplorerSafetyReply({ safety, trusted, candidate: { kind: "usable", content: "Synthetic candidate." }, persistence: "pending" });
    expect(plan.kind).toBe("ordinary"); expect(plan.requiredPersistenceConfirmed).toBe(false);
    expect(selectExplorerSafetyReply({ safety: { ...safety, coverage: "fallback_only" }, trusted, candidate: { kind: "usable", content: "Do not deliver." }, persistence: "confirmed" }).kind).toBe("unavailable");
    expect(selectExplorerSafetyReply({ safety: { ...safety, policyKnown: false }, trusted, candidate: { kind: "usable", content: "Do not deliver." }, persistence: "confirmed" }).kind).toBe("unavailable");
  });
  it("concurrent restriction selection suppresses stale ordinary candidate", () => {
    const safety = combineExplorerSafety({ policy: { status: "known", restrictedLevel: 3, adultReflectionStopped: false, safetyVersion: 1 }, fallback: fallback(), model: { level: 0, minorIndicated: false } });
    const plan = selectExplorerSafetyReply({ safety, trusted: configuration().trustedResponses, candidate: { kind: "usable", content: "Stale reflective prose." }, persistence: "confirmed" });
    expect(plan.kind).toBe("restricted_followup"); expect(plan.ordinaryCandidate).toBeNull(); expect(plan.resourceRequirement).toBeNull();
  });
  it("known urgent/minor conditions retain trusted failure assistance and require actual operational signaling", () => {
    const safety = combineExplorerSafety({ policy: CLEAR, fallback: fallback(4, true), model: null });
    const plan = selectExplorerSafetyReply({ safety, trusted: configuration().trustedResponses, candidate: { kind: "usable", content: "Never expose." }, persistence: "unconfirmed" });
    expect(plan.kind).toBe("crisis"); expect(plan.ordinaryCandidate).toBeNull(); expect(plan.operationalFailureSignalRequired).toBe(true);
    expect(plan.resourceRequirement).toBe("reviewed_age_appropriate"); expect(plan.adultBoundaryIncluded).toBe(true);
    expect(plan.beforeResources[0]).toContain("couldn't confirm"); expect(plan.afterResources).toContain(configuration().trustedResponses.adultOnly);
    expect(JSON.stringify(plan)).not.toContain("988"); expect(JSON.stringify(plan)).not.toContain("741741");
  });
  it("withholds ordinary prose after uncertain settlement and does not pretend a fallback is saved", () => {
    const safety = combineExplorerSafety({ policy: CLEAR, fallback: fallback(), model: { level: 0, minorIndicated: false } });
    const plan = selectExplorerSafetyReply({ safety, trusted: configuration().trustedResponses, candidate: { kind: "usable", content: "Do not return." }, persistence: "unconfirmed" });
    expect(plan.kind).toBe("uncertain"); expect(plan.ordinaryCandidate).toBeNull(); expect(plan.requiredPersistenceConfirmed).toBe(false);
    expect(plan.operationalFailureSignalRequired).toBe(false);
  });
});
