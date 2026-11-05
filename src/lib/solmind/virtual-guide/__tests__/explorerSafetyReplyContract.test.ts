import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  EXPLORER_SAFETY_REQUEST_VERSION, EXPLORER_SAFETY_REPLY_PROTOCOL,
  parseExplorerSafetyReplyBody, parseExplorerSafetyReplyRequest,
} from "../explorerSafetyReplyContract";

function request() {
  const authorizedContext = JSON.stringify({ immediateExplorerMessage: { content: "Synthetic local message." }, outputRequirements: { format: "plain_text" } });
  return { contractVersion: EXPLORER_SAFETY_REQUEST_VERSION,
    invocationId: "00000000-0000-4000-8000-000000000001", explorerId: "00000000-0000-4000-8000-000000000002",
    sessionId: "00000000-0000-4000-8000-000000000003", contextSnapshotId: "00000000-0000-4000-8000-000000000004",
    contextFingerprint: createHash("sha256").update(authorizedContext).digest("hex"), authorizedContext,
    mode: "classification_and_reply", classificationPolicyVersion: "synthetic-model.v1",
    fallbackPolicyVersion: "synthetic-fallback.v1", instructionVersion: "synthetic-instructions.v1" };
}
function body(candidateReply: unknown = { content: "  One\r\npermitted question?  " }, classification: unknown = { level: 3, minorIndicated: false }) {
  return JSON.stringify({ protocol: EXPLORER_SAFETY_REPLY_PROTOCOL, classification, candidateReply });
}
const POINT = "00000000-0000-4000-8000-000000000005";
function proposedBody(proposals: Record<string, unknown>) {
  return JSON.stringify({ protocol: EXPLORER_SAFETY_REPLY_PROTOCOL,
    classification: { level: 0, minorIndicated: false }, candidateReply: { content: "We can explore that." }, ...proposals });
}
describe("Explorer same-call raw body contract (synthetic mechanics)", () => {
  it("binds exact compact bytes, mode, versions and server identities into a frozen request", () => {
    const input = request(); const parsed = parseExplorerSafetyReplyRequest(input);
    expect(parsed.contextFingerprint).toBe(input.contextFingerprint.toUpperCase());
    expect(parsed.authorizedContext).toBe(input.authorizedContext); expect(Object.isFrozen(parsed)).toBe(true);
    input.invocationId = "changed"; expect(parsed.invocationId).not.toBe("changed");
  });
  it("rejects mismatched bytes, noncompact input, extra identities and overlong versions", () => {
    for (const input of [
      { ...request(), contextFingerprint: "A".repeat(64) },
      { ...request(), authorizedContext: '{ "hello": true }' },
      { ...request(), unexpected: true },
      { ...request(), instructionVersion: "v".repeat(65) },
      { ...request(), mode: "ordinary" },
    ]) expect(() => parseExplorerSafetyReplyRequest(input)).toThrow();
  });
  it("does not evaluate a request getter", () => {
    const input = request(); const getter = vi.fn(() => input.authorizedContext);
    Object.defineProperty(input, "authorizedContext", { enumerable: true, get: getter });
    expect(() => parseExplorerSafetyReplyRequest(input)).toThrow(); expect(getter).not.toHaveBeenCalled();
  });
  it("preserves classification and normalizes only usable candidate prose", () => {
    const observation = parseExplorerSafetyReplyBody(body(), "classification_and_reply");
    expect(observation).toEqual({ classification: { level: 3, minorIndicated: false }, candidate: { kind: "usable", content: "One\npermitted question?" } });
    expect(Object.isFrozen(observation.classification)).toBe(true); expect(Object.isFrozen(observation.candidate)).toBe(true);
  });
  it.each([null, "ordinary prose", [], {}, { content: "", extra: 1 }, { content: " " },
    { content: "x\u0000y" }, { content: "x\u202ey" }, { content: "\ud800" },
    { content: "x".repeat(8193) }, { content: "word ".repeat(301) }])("keeps accepted classification when candidate is unusable: %j", (invalid) => {
    const observation = parseExplorerSafetyReplyBody(body(invalid), "classification_and_reply");
    expect(observation.classification).toEqual({ level: 3, minorIndicated: false });
    expect(observation.candidate).toEqual({ kind: "unusable" });
  });
  it("accepts exact candidate bounds without truncation", () => {
    expect(parseExplorerSafetyReplyBody(body({ content: "x".repeat(8192) }), "classification_and_reply").candidate).toEqual({ kind: "usable", content: "x".repeat(8192) });
    const content = "word ".repeat(300).trim();
    expect(parseExplorerSafetyReplyBody(body({ content }), "classification_and_reply").candidate).toEqual({ kind: "usable", content });
  });
  it("discards even valid ordinary prose in classification-only mode", () => {
    expect(parseExplorerSafetyReplyBody(body({ content: "Do not expose me." }), "classification_only")).toEqual({
      classification: { level: 3, minorIndicated: false }, candidate: { kind: "not_requested" } });
  });
  it.each([{}, { compass: { attention: POINT } }, { compass: { attention: null } },
    { choices: [{ label: "Let's begin" }] },
    { compass: { attention: POINT }, choices: [{ label: "Show me around" }, { label: "I have a question" }, { label: "Let's begin" }] }])(
    "S4 accepts each closed v2 optional group independently: %j", (proposals) => {
      const result = parseExplorerSafetyReplyBody(proposedBody(proposals), "classification_and_reply");
      expect(result).toEqual({ classification: { level: 0, minorIndicated: false },
        candidate: { kind: "usable", content: "We can explore that." }, ...proposals });
      expect(Object.isFrozen(result)).toBe(true);
      if (result.compass) expect(Object.isFrozen(result.compass)).toBe(true);
      if (result.choices) {
        expect(Object.isFrozen(result.choices)).toBe(true);
        for (const choice of result.choices) expect(Object.isFrozen(choice)).toBe(true);
      }
    });
  it.each([null, [], "unknown", {}, { attention: 1 }, { attention: "unknown" },
    { attention: POINT, extra: true }, { attention: POINT.toUpperCase() + " " }, { attention: POINT + "\n" }])(
    "S4 ignores malformed compass without losing classification, prose or choices: %j", (invalid) => {
      expect(parseExplorerSafetyReplyBody(proposedBody({ compass: invalid, choices: [{ label: "Begin" }] }), "classification_and_reply"))
        .toEqual({ classification: { level: 0, minorIndicated: false }, candidate: { kind: "usable", content: "We can explore that." }, choices: [{ label: "Begin" }] });
    });
  it.each([null, {}, [], "Begin", [{ label: " " }], [{ label: "a".repeat(41) }],
    Array.from({ length: 4 }, () => ({ label: "Begin" })), [{ label: "Begin", extra: true }],
    [{ label: "A\nB" }], [{ label: "\tBegin" }], [{ label: "A\u0000B" }],
    [{ label: "A\u202eB" }], [{ label: "A\u200bB" }], [{ label: "A\u2028B" }],
    [{ label: "A\u200eB" }], [{ label: "A\u2061B" }], [{ label: "A\u206fB" }],
    [{ label: "\ud800" }], [{ label: "Valid" }, { label: 4 }]])(
    "S4 ignores the entire malformed choices group without losing compass, classification or reply: %j", (invalid) => {
      expect(parseExplorerSafetyReplyBody(proposedBody({ compass: { attention: POINT }, choices: invalid }), "classification_and_reply"))
        .toEqual({ classification: { level: 0, minorIndicated: false }, candidate: { kind: "usable", content: "We can explore that." }, compass: { attention: POINT } });
    });
  it("S4 normalizes label edges and bounds Unicode scalar count without truncation", () => {
    const label = "\u{1f642}".repeat(40);
    expect(parseExplorerSafetyReplyBody(proposedBody({ choices: [{ label: " Begin " }, { label }] }), "classification_and_reply").choices)
      .toEqual([{ label: "Begin" }, { label }]);
    expect(parseExplorerSafetyReplyBody(proposedBody({ choices: [{ label: label + "x" }] }), "classification_and_reply").choices).toBeUndefined();
  });
  it("S4 classification-only mode drops both valid proposal groups with the ordinary candidate", () => {
    expect(parseExplorerSafetyReplyBody(proposedBody({ compass: { attention: POINT }, choices: [{ label: "Begin" }] }), "classification_only"))
      .toEqual({ classification: { level: 0, minorIndicated: false }, candidate: { kind: "not_requested" } });
  });
  it("S4 rejects the previous v1 body after the protocol switch", () => {
    const raw = proposedBody({ protocol: "explorer-safety-reply.v1" });
    expect(() => parseExplorerSafetyReplyBody(raw, "classification_and_reply")).toThrowError("explorer_safety_invalid_response");
  });
  it.each([{ level: -1, minorIndicated: false }, { level: 5, minorIndicated: false },
    { level: 1.5, minorIndicated: false }, { level: "3", minorIndicated: false },
    { level: 3, minorIndicated: 1 }, { level: 3, minorIndicated: false, explanation: "No" }])("admits no observation for invalid classification: %j", (invalid) => {
    expect(() => parseExplorerSafetyReplyBody(body(null, invalid), "classification_and_reply")).toThrow();
  });
  it("does not recover partial JSON, prose levels or invalid root shape", () => {
    for (const raw of ['Level4: help', '{"protocol":', body().slice(0, -1),
      JSON.stringify({ protocol: EXPLORER_SAFETY_REPLY_PROTOCOL, classification: { level: 4, minorIndicated: false }, candidateReply: null, extra: true })]) {
      expect(() => parseExplorerSafetyReplyBody(raw, "classification_and_reply")).toThrow();
    }
  });
  it("uses one decoder and its single last-member duplicate interpretation", () => {
    const raw = '{"protocol":"explorer-safety-reply.v2","classification":{"level":4,"level":0,"minorIndicated":false},"candidateReply":null}';
    const spy = vi.spyOn(JSON, "parse");
    try {
      expect(parseExplorerSafetyReplyBody(raw, "classification_and_reply").classification.level).toBe(0);
      expect(spy).toHaveBeenCalledOnce();
    } finally { spy.mockRestore(); }
  });
  it("bounds extracted raw UTF8 bytes before decoding", () => {
    expect(() => parseExplorerSafetyReplyBody(" ".repeat(262145), "classification_and_reply")).toThrowError("explorer_safety_limit_exceeded");
    expect(() => parseExplorerSafetyReplyBody("\u00e9".repeat(131073), "classification_and_reply")).toThrowError("explorer_safety_limit_exceeded");
  });
});
