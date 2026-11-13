import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  EXPLORER_SAFETY_REQUEST_VERSION, EXPLORER_SAFETY_REPLY_PROTOCOL,
  explorerSafetyReplyRepeatsName, parseExplorerSafetyReplyBody, parseExplorerSafetyReplyRequest,
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
describe("S7a Waypoint proposals", () => {
  it.each(["right", "close", "not_it"] as const)("S7b accepts one frozen %s response without changing reply v2", response => {
    const waypointResponse = { draftId: POINT, response };
    const result = parseExplorerSafetyReplyBody(proposedBody({ waypointResponse }), "classification_and_reply");
    expect(result.waypointResponse).toEqual(waypointResponse);
    expect(Object.isFrozen(result.waypointResponse)).toBe(true);
    expect(result.candidate.kind).toBe("usable");
    expect(EXPLORER_SAFETY_REPLY_PROTOCOL).toBe("explorer-safety-reply.v2");
  });
  it.each([null, {}, [], "right", [{ draftId: POINT, response: "right" }],
    { draftId: POINT }, { response: "right" }, { draftId: null, response: "right" },
    { draftId: POINT + "\n", response: "right" }, { draftId: "unknown", response: "right" },
    { draftId: POINT, response: "Right" }, { draftId: POINT, response: " right " },
    { draftId: POINT, response: "not it" }, { draftId: POINT, response: null },
    { draftId: POINT, response: "right", extra: true }])("S7b drops malformed response %j without losing valid siblings or prose", invalid => {
    const result = parseExplorerSafetyReplyBody(proposedBody({ waypointResponse: invalid,
      waypointSuggestion, compass: { attention: POINT }, choices: [{ label: "Begin" }] }), "classification_and_reply");
    expect(result.waypointResponse).toBeUndefined();
    expect(result.waypointSuggestion).toEqual(waypointSuggestion);
    expect(result.compass).toEqual({ attention: POINT });
    expect(result.choices).toEqual([{ label: "Begin" }]);
    expect(result.classification).toEqual({ level: 0, minorIndicated: false });
    expect(result.candidate.kind).toBe("usable");
  });
  it("S7b keeps valid response independent of a malformed suggestion and drops it in classification-only mode", () => {
    const waypointResponse = { draftId: POINT, response: "right" };
    expect(parseExplorerSafetyReplyBody(proposedBody({ waypointResponse, waypointSuggestion: {} }),
      "classification_and_reply").waypointResponse).toEqual(waypointResponse);
    expect(parseExplorerSafetyReplyBody(proposedBody({ waypointResponse, waypointSuggestion }), "classification_only"))
      .toEqual({ classification: { level: 0, minorIndicated: false }, candidate: { kind: "not_requested" } });
  });
  const waypointSuggestion = { title: "Calm mornings with room to breathe", destination: "An unhurried breakfast",
    whyItMatters: "Time with my family", arrivalSignal: "Two calm breakfasts this week" };
  it("parses one exact frozen suggestion beside valid Compass and reply data", () => {
    const result = parseExplorerSafetyReplyBody(proposedBody({ waypointSuggestion,
      compass: { suggestions: [{ label: "Mornings" }] }, choices: [{ label: "Begin" }] }), "classification_and_reply");
    expect(result.waypointSuggestion).toEqual(waypointSuggestion);
    expect(Object.isFrozen(result.waypointSuggestion)).toBe(true);
    expect(result.candidate.kind).toBe("usable");
    expect(result.compass).toBeUndefined();
  });
  it("drops every malformed suggestion independently without discarding prose or other proposals", () => {
    for (const invalid of [null, [], [waypointSuggestion], {}, { ...waypointSuggestion, extra: true },
      ...Object.keys(waypointSuggestion).flatMap(field => [undefined, null, "", " ", " padded ", "x".repeat(1001), "\ud800", "bad\u0000text", "bad\ttext", "bad\u200btext", "bad\u202etext"]
        .map(value => ({ ...waypointSuggestion, [field]: value })))]) {
      const result = parseExplorerSafetyReplyBody(proposedBody({ waypointSuggestion: invalid,
        compass: { suggestions: [{ label: "Mornings" }] } }), "classification_and_reply");
      expect(result.waypointSuggestion).toBeUndefined();
      expect(result.candidate.kind).toBe("usable");
      expect(result.compass).toBeUndefined();
    }
  });
  it("accepts exact text bounds and excludes the suggestion from classification-only observations", () => {
    expect(parseExplorerSafetyReplyBody(proposedBody({ waypointSuggestion: { ...waypointSuggestion,
      destination: "x".repeat(1000), whyItMatters: "One\nTwo" } }), "classification_and_reply").waypointSuggestion)
      .toMatchObject({ destination: "x".repeat(1000), whyItMatters: "One\nTwo" });
    expect(parseExplorerSafetyReplyBody(proposedBody({ waypointSuggestion }), "classification_only"))
      .toEqual({ classification: { level: 0, minorIndicated: false }, candidate: { kind: "not_requested" } });
  });
});
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
    for (const raw of ['Level4: help', '{"protocol":', body().slice(0, -1), "[]", "null",
      JSON.stringify({ protocol: EXPLORER_SAFETY_REPLY_PROTOCOL, classification: { level: 4, minorIndicated: false } }),
      "Here it is:\n```json\n" + body() + "\n```", "```json\n" + body() + "\n``` and more", "```json\n" + body().slice(0, -1) + "\n```"]) {
      expect(() => parseExplorerSafetyReplyBody(raw, "classification_and_reply")).toThrow();
    }
  });
  it("RF01 drops an unknown outer key and keeps the classification, reply and proposals, checked as before (2026-11-10 reply fix)", () => {
    const raw = JSON.stringify({ protocol: EXPLORER_SAFETY_REPLY_PROTOCOL, classification: { level: 4, minorIndicated: false },
      candidateReply: null, extra: true, compassResponse: [{ pointId: POINT, response: "right" }] });
    const observation = parseExplorerSafetyReplyBody(raw, "classification_and_reply");
    expect(observation.classification).toEqual({ level: 4, minorIndicated: false });
    expect(observation.candidate).toEqual({ kind: "unusable" });
    expect(Object.keys(observation).sort()).toEqual(["candidate", "classification"]);
    const ordinary = JSON.parse(body()) as Record<string, unknown>;
    const kept = parseExplorerSafetyReplyBody(JSON.stringify({ ...ordinary, note: "x" }), "classification_and_reply");
    expect(kept).toEqual(parseExplorerSafetyReplyBody(body(), "classification_and_reply"));
  });
  it("RF02 keeps the strict checks on the kept keys: a wrong protocol or classification stays fatal beside an extra key", () => {
    const ordinary = JSON.parse(body()) as Record<string, unknown>;
    for (const raw of [JSON.stringify({ ...ordinary, protocol: "explorer-safety-reply.v1", extra: 1 }),
      JSON.stringify({ ...ordinary, classification: { level: 3, minorIndicated: false, explanation: "No" }, extra: 1 })]) {
      expect(() => parseExplorerSafetyReplyBody(raw, "classification_and_reply")).toThrowError("explorer_safety_invalid_response");
    }
  });
  it("RF04 rejects a dropped key that could be a competing safety signal or a misspelled known key", () => {
    const ordinary = JSON.parse(body()) as Record<string, unknown>;
    for (const extra of [{ Classification: { level: 4, minorIndicated: false } }, { level: 4 }, { minorIndicated: true },
      { CandidateReply: { content: "x" } }, { PROTOCOL: "explorer-safety-reply.v2" }, { minor_indicated: true },
      { "waypoint-suggestion": {} }, { "Level ": 4 }]) {
      expect(() => parseExplorerSafetyReplyBody(JSON.stringify({ ...ordinary, ...extra }), "classification_and_reply"))
        .toThrowError("explorer_safety_invalid_response");
    }
  });
  it("RF05 keeps minorIndicated, drops a __proto__ key without effect, and reads fenced, multi-line and classification-only replies", () => {
    const minor = JSON.stringify({ protocol: EXPLORER_SAFETY_REPLY_PROTOCOL, classification: { level: 2, minorIndicated: true }, candidateReply: null });
    expect(parseExplorerSafetyReplyBody("```json\n" + minor + "\n```", "classification_and_reply").classification).toEqual({ level: 2, minorIndicated: true });
    const proto = '{"__proto__":{"polluted":true},"protocol":"' + EXPLORER_SAFETY_REPLY_PROTOCOL +
      '","classification":{"level":0,"minorIndicated":false},"candidateReply":null}';
    const observation = parseExplorerSafetyReplyBody(proto, "classification_and_reply");
    expect(observation.classification).toEqual({ level: 0, minorIndicated: false });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    const pretty = JSON.stringify(JSON.parse(body()), null, 2);
    expect(parseExplorerSafetyReplyBody("```json\n" + pretty + "\n```", "classification_and_reply"))
      .toEqual(parseExplorerSafetyReplyBody(body(), "classification_and_reply"));
    expect(parseExplorerSafetyReplyBody("```\n" + minor + "\n```", "classification_only"))
      .toEqual({ classification: { level: 2, minorIndicated: true }, candidate: { kind: "not_requested" } });
  });
  it("RF06 still rejects a kept key that is an accessor", () => {
    const accessor = { protocol: EXPLORER_SAFETY_REPLY_PROTOCOL, candidateReply: null } as Record<string, unknown>;
    Object.defineProperty(accessor, "classification", { enumerable: true, get: () => ({ level: 0, minorIndicated: false }) });
    const spy = vi.spyOn(JSON, "parse").mockReturnValueOnce(accessor);
    try {
      expect(() => parseExplorerSafetyReplyBody("{}", "classification_and_reply")).toThrowError("explorer_safety_invalid_response");
    } finally { spy.mockRestore(); }
  });
  it("RF03 reads one whole reply wrapped in a Markdown code fence as its inner JSON", () => {
    const plain = parseExplorerSafetyReplyBody(body(), "classification_and_reply");
    for (const raw of ["```json\n" + body() + "\n```", "```\n" + body() + "\n```", "  ```json \r\n" + body() + "\r\n```  \n"]) {
      expect(parseExplorerSafetyReplyBody(raw, "classification_and_reply")).toEqual(plain);
    }
  });
  it("decodes the reply once and refuses repeated classification names", () => {
    // Paul's option E, 2026-11-12: repeated safety names must no longer silently select the last value.
    const raw = '{"protocol":"explorer-safety-reply.v2","classification":{"level":4,"level":0,"minorIndicated":false},"candidateReply":null}';
    const spy = vi.spyOn(JSON, "parse");
    try {
      expect(() => parseExplorerSafetyReplyBody(raw, "classification_and_reply")).toThrowError("explorer_safety_invalid_response");
      expect(spy).toHaveBeenCalledOnce();
    } finally { spy.mockRestore(); }
  });
  it("bounds extracted raw UTF8 bytes before decoding", () => {
    expect(() => parseExplorerSafetyReplyBody(" ".repeat(262145), "classification_and_reply")).toThrowError("explorer_safety_limit_exceeded");
    expect(() => parseExplorerSafetyReplyBody("\u00e9".repeat(131073), "classification_and_reply")).toThrowError("explorer_safety_limit_exceeded");
  });
});

// Paul's option A, 2026-11-12: only one final closing brace may be removed after JSON decoding fails.
describe("one surplus reply closing brace", () => {
  it.each(["}", "} \t\r\n"])("keeps the same classification and prose with suffix %j", suffix => {
    const raw = body();
    expect(parseExplorerSafetyReplyBody(raw + suffix, "classification_and_reply"))
      .toEqual(parseExplorerSafetyReplyBody(raw, "classification_and_reply"));
  });
  it.each(["json", ""])("accepts one surplus brace inside a whole %j Markdown fence", language => {
    const raw = body();
    expect(parseExplorerSafetyReplyBody("```" + language + "\n" + raw + "} \t\r\n```", "classification_and_reply"))
      .toEqual(parseExplorerSafetyReplyBody(raw, "classification_and_reply"));
  });
  it.each(["}}", "]", "} ok", "}\u00a0", "}\u000b", "}\u000c"])("refuses unapproved surplus suffix %j", suffix => {
    expect(() => parseExplorerSafetyReplyBody(body() + suffix, "classification_and_reply"))
      .toThrowError("explorer_safety_invalid_response");
  });
  it("does not repair a missing comma before the surplus brace", () => {
    const raw = body().replace(",\"candidateReply\":", "\"candidateReply\":") + "}";
    expect(() => parseExplorerSafetyReplyBody(raw, "classification_and_reply")).toThrowError("explorer_safety_invalid_response");
  });
  it("does not add the missing final brace to a truncated reply", () => {
    const raw = body({ content: "Synthetic truncated reply." }).slice(0, -1);
    expect(() => parseExplorerSafetyReplyBody(raw, "classification_and_reply")).toThrowError("explorer_safety_invalid_response");
  });
  it("refuses ordinary words before the opening JSON brace", () => {
    const raw = "Here is a synthetic reply: " + body();
    expect(() => parseExplorerSafetyReplyBody(raw, "classification_and_reply")).toThrowError("explorer_safety_invalid_response");
  });
  it("leaves an ordinary valid reply intact and decodes it only once", () => {
    const raw = body(); const spy = vi.spyOn(JSON, "parse");
    try {
      expect(parseExplorerSafetyReplyBody(raw, "classification_and_reply")).toEqual({
        classification: { level: 3, minorIndicated: false }, candidate: { kind: "usable", content: "One\npermitted question?" } });
      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(raw);
    } finally { spy.mockRestore(); }
  });
  it.each(["", " \t\r\n", "}"])("refuses an empty or incomplete document %j", raw => {
    expect(() => parseExplorerSafetyReplyBody(raw, "classification_and_reply")).toThrowError("explorer_safety_invalid_response");
  });
  it("keeps classification-only replies free of candidate prose after removing a surplus brace", () => {
    expect(parseExplorerSafetyReplyBody(body() + "}", "classification_only")).toEqual({
      classification: { level: 3, minorIndicated: false }, candidate: { kind: "not_requested" } });
  });
  it("checks the original raw byte limit before a surplus brace could be removed", () => {
    const raw = body(); const padded = raw + " ".repeat(262144 - Buffer.byteLength(raw, "utf8")) + "}";
    const spy = vi.spyOn(JSON, "parse");
    try {
      expect(() => parseExplorerSafetyReplyBody(padded, "classification_and_reply")).toThrowError("explorer_safety_limit_exceeded");
      expect(spy).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });
  it("keeps the protocol and classification checks after a surplus brace is removed", () => {
    for (const raw of [proposedBody({ protocol: "explorer-safety-reply.v1" }), body(null, { level: 5, minorIndicated: false })]) {
      expect(() => parseExplorerSafetyReplyBody(raw + "}", "classification_and_reply")).toThrowError("explorer_safety_invalid_response");
    }
  });
});

// Paul's option E, 2026-11-12: only the outer object and its classification object reject decoded repeated names.
describe("repeated reply names", () => {
  it("keeps structural-looking content inside its string but refuses a real repeated outer name", () => {
    const content = '},"classification":{"level":4,"minorIndicated":false},"x":{';
    const raw = body({ content }, { level: 1, minorIndicated: true });
    expect(parseExplorerSafetyReplyBody(raw, "classification_and_reply")).toEqual({
      classification: { level: 1, minorIndicated: true }, candidate: { kind: "usable", content } });
    const repeated = raw.slice(0, -1) + String.raw`,"extra":1,"extra":2}`;
    expect(() => parseExplorerSafetyReplyBody(repeated, "classification_and_reply")).toThrowError("explorer_safety_invalid_response");
  });
  it.each([
    ["BMP letter", String.raw`,"\u00e9":1,"${String.fromCodePoint(0x00e9)}":2}`],
    ["surrogate pair", String.raw`,"\ud83d\ude00":1,"${String.fromCodePoint(0x1f600)}":2}`],
  ])("refuses an escaped outer name repeated as its plain character: %s", (_name, extra) => {
    const raw = body().slice(0, -1) + extra;
    expect(() => parseExplorerSafetyReplyBody(raw, "classification_and_reply")).toThrowError("explorer_safety_invalid_response");
  });
  it.each([
    String.raw`,"classification":{"level":0,"minorIndicated":false}`,
    String.raw`,"candidateReply":{"content":"Synthetic replacement."}`,
    String.raw`,"extra":1,"extra":2`,
    String.raw`,"__proto__":1,"__proto__":2`,
    String.raw`,"classifi\u0063ation":{"level":0,"minorIndicated":false}`,
  ])("refuses repeated outer names even when they would be dropped: %s", extra => {
    const raw = body().slice(0, -1) + extra + "}";
    expect(() => parseExplorerSafetyReplyBody(raw, "classification_and_reply")).toThrowError("explorer_safety_invalid_response");
  });
  it.each([
    String.raw`{"level":4,"le\u0076el":0,"minorIndicated":false}`,
    String.raw`{"level":4,"minorIndicated":true,"minor\u0049ndicated":false}`,
  ])("refuses repeated decoded classification names: %s", classification => {
    const raw = String.raw`{"protocol":"${EXPLORER_SAFETY_REPLY_PROTOCOL}","classifi\u0063ation":${classification},"candidateReply":null}`;
    expect(() => parseExplorerSafetyReplyBody(raw, "classification_and_reply")).toThrowError("explorer_safety_invalid_response");
    expect(() => parseExplorerSafetyReplyBody(raw, "classification_only")).toThrowError("explorer_safety_invalid_response");
  });
  it("keeps last-member interpretation inside an unexamined Waypoint suggestion and candidate", () => {
    const raw = String.raw`{"protocol":"${EXPLORER_SAFETY_REPLY_PROTOCOL}","classification":{"level":0,"minorIndicated":false},` +
      String.raw`"candidateReply":{"content":"Earlier synthetic reply.","content":"Later synthetic reply."},` +
      String.raw`"waypointSuggestion":{"title":"Earlier title","title":"Later title","destination":"Synthetic destination",` +
      String.raw`"whyItMatters":"Synthetic reason","arrivalSignal":"Synthetic arrival"}}`;
    expect(explorerSafetyReplyRepeatsName(raw)).toBe(false);
    expect(parseExplorerSafetyReplyBody(raw, "classification_and_reply")).toEqual({
      classification: { level: 0, minorIndicated: false }, candidate: { kind: "usable", content: "Later synthetic reply." },
      waypointSuggestion: { title: "Later title", destination: "Synthetic destination", whyItMatters: "Synthetic reason", arrivalSignal: "Synthetic arrival" } });
  });
  it("keeps a reply with no repeated names unchanged", () => {
    const raw = body();
    expect(explorerSafetyReplyRepeatsName(raw)).toBe(false);
    expect(parseExplorerSafetyReplyBody(raw, "classification_and_reply")).toEqual({
      classification: { level: 3, minorIndicated: false }, candidate: { kind: "usable", content: "One\npermitted question?" } });
  });
  it("refuses repeated outer names after removing one surplus brace, including inside a fence", () => {
    const raw = body().slice(0, -1) + String.raw`,"classification":{"level":0,"minorIndicated":false}}}`;
    for (const text of [raw, "```json\n" + raw + "\n```"]) {
      expect(() => parseExplorerSafetyReplyBody(text, "classification_and_reply")).toThrowError("explorer_safety_invalid_response");
    }
  });
  it("compares names exactly without case folding, spacing removal or Unicode normalization", () => {
    const raw = String.raw`{"name":1,"Name":2,"na me":3,"na_me":4,"na-me":5,"\u00e9":6,"e\u0301":7}`;
    expect(explorerSafetyReplyRepeatsName(raw)).toBe(false);
    expect(parseExplorerSafetyReplyBody(body().slice(0, -1) + String.raw`,"extra":1,"Extra":2}`, "classification_and_reply"))
      .toEqual(parseExplorerSafetyReplyBody(body(), "classification_and_reply"));
  });
  it.each([
    String.raw`{"a\"b":0,"a\u0022b":1}`,
    String.raw`{"a\\b":0,"a\u005cb":1}`,
    String.raw`{"a\/b":0,"a/b":1}`,
    String.raw`{"\b\f\n\r\t":0,"\u0008\u000c\u000a\u000d\u0009":1}`,
    String.raw`{"\ud83d\ude00":0,"\uD83D\uDE00":1}`,
    String.raw`{"\ud800":0,"\uD800":1}`,
  ])("decodes JSON name escapes before comparison: %s", raw => {
    expect(explorerSafetyReplyRepeatsName(raw)).toBe(true);
  });
  it.each([
    String.raw`{"extra":{"classification":{"level":4,"level":0}}}`,
    String.raw`{"extra":[{"classification":{"level":4,"level":0}}]}`,
    String.raw`{"classification":[{"level":4,"level":0}]}`,
    String.raw`{"classification":{"extra":{"level":4,"level":0}}}`,
    String.raw`[{"level":4,"level":0}]`,
    String.raw`[{"classification":{"level":4,"level":0}}]`,
  ])("does not widen the examined object scopes: %s", raw => {
    expect(explorerSafetyReplyRepeatsName(raw)).toBe(false);
  });
  it("does not call JSON.parse to compare names", () => {
    const spy = vi.spyOn(JSON, "parse");
    try {
      expect(explorerSafetyReplyRepeatsName(String.raw`{"classification":{"level":4,"le\u0076el":0}}`)).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });
  it.each(["null", "true", "false", "-0", "10.25e-3", "1E+9", "1e999", "\"Synthetic string\"",
    "[]", "{}", "[null,true,false,-0,1.5e2,\"string\",{},[]]"])
    ("reads a complete JSON document with no repeated names: %s", raw => {
      expect(explorerSafetyReplyRepeatsName(" \t\r\n" + raw + " \t\r\n")).toBe(false);
    });
  it.each(["", " ", "}", "{", "[", "{}{}", "null true", "[1,]", "{\"a\":1,}", "{\"a\" 1}", "{\"a\":}",
    "{\"a\":1 \"b\":2}", "{\"a\":1,\"a\":2} trailing", "01", "-", "1.", "1e", "1e+", "+1", "NaN", "undefined",
    String.raw`"\x41"`, String.raw`"\u0x00"`, "\"unterminated", "\"line\nbreak\"", "{}\u00a0"])
    ("refuses scanner text that is not one JSON document: %s", raw => {
      expect(() => explorerSafetyReplyRepeatsName(raw)).toThrowError("explorer_safety_invalid_response");
    });
  it("reads deep arrays and objects without an added nesting limit or recursive calls", () => {
    const nested = "{\"child\":[".repeat(12000) + "null" + "]}".repeat(12000);
    const raw = body().slice(0, -1) + ",\"extra\":" + nested + "}";
    expect(Buffer.byteLength(raw, "utf8")).toBeLessThan(262144);
    expect(explorerSafetyReplyRepeatsName(raw)).toBe(false);
    expect(parseExplorerSafetyReplyBody(raw, "classification_and_reply"))
      .toEqual(parseExplorerSafetyReplyBody(body(), "classification_and_reply"));
  });
});

describe("retired Compass proposal fields", () => {
  it.each([null, [], {}, "right", [{ label: "Time for myself" }],
    [{ pointId: POINT, response: "right" }], [{ pointId: POINT, response: "close" }],
    [{ pointId: POINT, response: "not_it" }], [{ label: " padded " }], [{ label: "\\ud800" }]])(
    "discards retired values without interpreting them: %j", value => {
      const result = parseExplorerSafetyReplyBody(proposedBody({ compass: { suggestions: value, responses: value } }),
        "classification_and_reply");
      expect(result.compass).toBeUndefined();
      expect(result.classification).toEqual({ level: 0, minorIndicated: false });
      expect(result.candidate.kind).toBe("usable");
      expect(parseExplorerSafetyReplyBody(proposedBody({ compass: { attention: POINT, suggestions: value, responses: value } }),
        "classification_and_reply").compass).toEqual({ attention: POINT });
    });
});
