import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { assembleExplorerSafeContext, EXPLORER_SAFE_CONTEXT_LIMITS } from "../context/explorerSafeContext";
import * as matcher from "./explorerContextExclusionGuard";
import {
  EXPLORER_CONTEXT_EXCLUSION_MATCHER_VERSION,
  inspectExplorerContextExclusions,
  type ExplorerExclusionEntityType,
  type ExplorerExclusionManifest,
} from "./explorerContextExclusionGuard";

// Pure synthetic fixtures only. No private repository, real authorization,
// denylist source, audit, provider, network or application integration is used.
const id = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const BINDING = Object.freeze({ explorerId: id(1), sessionId: id(2), relationshipId: id(3) });
const PRIVATE_CANARY = "SYNTHETIC_GUIDE_PRIVATE_OBSERVATION_NOT_CONTEXT";
const UNAVAILABLE = "explorer_context_exclusion_unavailable";
const hash = (text: string) => createHash("sha256").update(text.replace(/\r\n?/g, "\n").trim(), "utf8").digest("hex").toUpperCase();
function entry(entityType: ExplorerExclusionEntityType = "private_note", entityId = id(0xfeed), text = PRIVATE_CANARY) {
  return { entityType, entityId, normalizedContentSha256: hash(text) };
}
function assembled(methodologyText = "Reflect gently and preserve agency.") {
  const binding = { explorerId: BINDING.explorerId, sessionId: BINDING.sessionId, continuityBindingId: BINDING.relationshipId };
  return assembleExplorerSafeContext({
    contractVersion: "wi007-v0.1+onboarding-fields-v2", aiRole: "solmind_virtual_guide", actorRoleContext: "explorer",
    explorerBinding: binding,
    globalPolicy: { version: "global-v1", text: "Synthetic global safety rules." },
    roleBehavior: { version: "role-v1", text: "Support reflection and Explorer agency." },
    crisisBehavior: { version: "crisis-v1", text: "Use the independently approved crisis rules." },
    methodologyContext: { version: "methodology-v1", text: methodologyText },
    sessionContext: { sessionType: "explorer_virtual_guide", ...binding, explorerDisplayName: "Synthetic Explorer",
      activeFocusItems: [{ id: id(7), order: 0, text: "An Explorer-owned focus" }],
      nextAppointment: { startsAt: "2026-10-30T12:00:00.000Z", timezone: "America/Chicago", mode: "video",
        status: "confirmed", location: null, channel: "Synthetic video" },
      explorerSafeGuardrail: "Use the Explorer's own words." },
    continuityCandidates: [{ kind: "onboarding_answer", sourceId: id(4), order: 0, ...binding,
      field: "supportNow", content: "A submitted synthetic preference." }],
    currentSessionMessages: [{ messageId: id(5), order: 0, explorerId: BINDING.explorerId, sessionId: BINDING.sessionId,
      role: "explorer", content: "An earlier synthetic message." }],
    immediateExplorerMessage: { messageId: id(6), explorerId: BINDING.explorerId, sessionId: BINDING.sessionId,
      role: "explorer", content: "What might help with my next conversation?" },
    outputRequirements: { format: "plain_text", includeCitations: false, allowMarkdown: false },
  });
}
function fixture(entries: ExplorerExclusionManifest["entries"] = [entry()]) {
  return {
    serializedContext: assembled().serialized,
    includedSourceIds: [id(4), id(5), id(6)], expectedBinding: { ...BINDING },
    manifest: { contractVersion: EXPLORER_CONTEXT_EXCLUSION_MATCHER_VERSION,
      explorerId: BINDING.explorerId, relationshipId: BINDING.relationshipId, entries: [...entries] },
  };
}
function changed(serialized: string, path: readonly (string | number)[], value: unknown): string {
  const context = JSON.parse(serialized) as Record<string | number, unknown>;
  let cursor = context;
  for (const key of path.slice(0, -1)) cursor = cursor[key] as Record<string | number, unknown>;
  cursor[path[path.length - 1]] = value;
  return JSON.stringify(context);
}
function unavailable(input: unknown) {
  let error: unknown;
  try { inspectExplorerContextExclusions(input); } catch (caught) { error = caught; }
  expect(error).toBeInstanceOf(Error); expect((error as Error).message).toBe(UNAVAILABLE);
  expect(String(error)).not.toContain(PRIVATE_CANARY);
  expect(JSON.stringify(error)).not.toContain(PRIVATE_CANARY);
  expect("cause" in (error as Error)).toBe(false);
}
function blocked(reason: "excluded_identifier" | "excluded_content", value = entry()) {
  return { status: "blocked", reason, entityType: value.entityType, entityId: value.entityId };
}

describe("provider-held pure Explorer exclusion matcher (synthetic data)", () => {
  it("accepts real S03A clean assembly without modifying input or manufacturing authority", () => {
    const input = fixture(); const before = JSON.stringify(input);
    const result = inspectExplorerContextExclusions(input);
    expect(result).toEqual({ status: "clear" }); expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
    expect(result).not.toHaveProperty("authorized"); expect(result).not.toHaveProperty("manifestComplete");
    expect(result).not.toBe(inspectExplorerContextExclusions(input));
  });

  it("allows an empty supplied index without implying completeness or freshness", () => {
    expect(inspectExplorerContextExclusions(fixture([]))).toEqual({ status: "clear" });
  });

  it.each(["private_note", "trigger_observation", "summary_revision"] as const)("blocks whole allowed-field contamination for %s", entityType => {
    const forbidden = entry(entityType); const input = fixture([forbidden]);
    input.serializedContext = assembled(PRIVATE_CANARY).serialized;
    const result = inspectExplorerContextExclusions(input);
    expect(result).toEqual(blocked("excluded_content", forbidden));
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.keys(result).sort()).toEqual(["entityId", "entityType", "reason", "status"]);
    expect(JSON.stringify(result)).not.toContain(PRIVATE_CANARY);
    expect(JSON.stringify(result)).not.toContain(forbidden.normalizedContentSha256);
  });

  it.each([
    ["globalPolicy", "text"], ["roleBehavior", "text"], ["crisisBehavior", "text"],
    ["methodologyContext", "text"], ["sessionContext", "explorerSafeGuardrail"],
    ["approvedContinuity", 0, "content"], ["currentSessionMessages", 0, "content"],
    ["immediateExplorerMessage", "content"],
  ] as const)("detects contamination in the decoded leaf at %j", (...path) => {
    const input = fixture(); input.serializedContext = changed(input.serializedContext, path, PRIVATE_CANARY);
    expect(inspectExplorerContextExclusions(input)).toEqual(blocked("excluded_content"));
  });

  it("checks even non-content string leaves rather than an incomplete text-property list", () => {
    const input = fixture([entry("summary_revision", id(0xbeef), "plain_text")]);
    expect(inspectExplorerContextExclusions(input)).toEqual(blocked("excluded_content", input.manifest.entries[0]));
  });

  it("detects a forbidden source identity independently of content", () => {
    const input = fixture(); input.includedSourceIds.push(entry().entityId);
    expect(inspectExplorerContextExclusions(input)).toEqual(blocked("excluded_identifier"));
  });

  it.each([
    ["globalPolicy", "version"], ["methodologyContext", "text"], ["sessionContext", "explorerDisplayName"],
    ["sessionContext", "activeFocusItems", 0, "text"], ["sessionContext", "nextAppointment", "channel"],
    ["currentSessionMessages", 0, "messageId"], ["immediateExplorerMessage", "content"],
  ] as const)("detects case-insensitive embedded UUID in leaf %j", (...path) => {
    const input = fixture();
    input.serializedContext = changed(input.serializedContext, path, `prefix(${entry().entityId.toUpperCase()})suffix`);
    expect(inspectExplorerContextExclusions(input)).toEqual(blocked("excluded_identifier"));
  });

  it("applies identifier precedence globally, then manifest order within the matching phase", () => {
    const first = entry("private_note", id(0xfeed)); const second = entry("trigger_observation", id(0xbeef), "Other forbidden text");
    const input = fixture([first, second]);
    input.serializedContext = changed(input.serializedContext, ["globalPolicy", "text"], PRIVATE_CANARY);
    input.serializedContext = changed(input.serializedContext, ["immediateExplorerMessage", "content"], second.entityId);
    expect(inspectExplorerContextExclusions(input)).toEqual(blocked("excluded_identifier", second));
    input.includedSourceIds.push(first.entityId);
    expect(inspectExplorerContextExclusions(input)).toEqual(blocked("excluded_identifier", first));
    const contentOnly = fixture([second, first]);
    contentOnly.serializedContext = changed(contentOnly.serializedContext, ["globalPolicy", "text"], PRIVATE_CANARY);
    contentOnly.serializedContext = changed(contentOnly.serializedContext, ["methodologyContext", "text"], "Other forbidden text");
    expect(inspectExplorerContextExclusions(contentOnly)).toEqual(blocked("excluded_content", second));
  });

  it("uses only CRLF/CR to LF and outer trimming for whole-leaf fingerprints", () => {
    const text = "Synthetic private line\nAnother private line"; const forbidden = entry("private_note", id(0xfeed), text);
    const input = fixture([forbidden]);
    input.serializedContext = changed(input.serializedContext, ["methodologyContext", "text"], " \r\nSynthetic private line\rAnother private line\r\n ");
    expect(inspectExplorerContextExclusions(input)).toEqual(blocked("excluded_content", forbidden));
  });

  it.each([
    ["A private observation", "a private observation"],
    ["Two  spaces", "Two spaces"],
    ["caf\u0065\u0301", "caf\u00e9"],
  ])("does not case-fold, collapse whitespace or normalize Unicode content: %#", (forbiddenText, leaf) => {
    const input = fixture([entry("private_note", id(0xfeed), forbiddenText)]);
    input.serializedContext = changed(input.serializedContext, ["methodologyContext", "text"], leaf);
    expect(inspectExplorerContextExclusions(input)).toEqual({ status: "clear" });
  });

  it("discloses the deliberate substring/paraphrase limitation through executable examples", () => {
    for (const text of [`Before ${PRIVATE_CANARY} after`, "A differently worded synthetic private observation.",
      "U1lOVEhFVElDX0dVSURFX1BSSVZBVEVfT0JTRVJWQVRJT05fTk9UX0NPTlRFWFQ="]) {
      const input = fixture(); input.serializedContext = changed(input.serializedContext, ["methodologyContext", "text"], text);
      expect(inspectExplorerContextExclusions(input)).toEqual({ status: "clear" });
    }
  });

  it.each([
    null, [], {}, { ...fixture(), extra: true },
    { ...fixture(), expectedBinding: { ...BINDING, role: "explorer" } },
    { ...fixture(), expectedBinding: { ...BINDING, explorerId: "not-a-uuid" } },
    { ...fixture(), expectedBinding: { ...BINDING, sessionId: id(99) } },
    { ...fixture(), expectedBinding: { ...BINDING, relationshipId: id(99) } },
    { ...fixture(), includedSourceIds: [id(4), id(4)] },
    { ...fixture(), includedSourceIds: [id(0xfeed).toUpperCase()] },
    { ...fixture(), includedSourceIds: Array.from({ length: 257 }, (_, index) => id(index + 1000)) },
  ])("fails closed on malformed or mismatched supplied input: %#", input => { unavailable(input); });

  it.each([
    null, {}, { ...fixture().manifest, contractVersion: "other.v1" },
    { ...fixture().manifest, explorerId: id(99) }, { ...fixture().manifest, relationshipId: id(99) },
    { ...fixture().manifest, extra: true }, { ...fixture().manifest, entries: [entry(), entry("trigger_observation")] },
    { ...fixture().manifest, entries: [{ ...entry(), entityType: "safety_flag" }] },
    { ...fixture().manifest, entries: [{ ...entry(), entityId: "wrong" }] },
    { ...fixture().manifest, entries: [{ ...entry(), normalizedContentSha256: hash(PRIVATE_CANARY).toLowerCase() }] },
    { ...fixture().manifest, entries: [{ ...entry(), normalizedContentSha256: "A".repeat(63) }] },
    { ...fixture().manifest, entries: [{ ...entry(), content: PRIVATE_CANARY }] },
    { ...fixture().manifest, entries: Array.from({ length: 129 }, (_, index) => entry("private_note", id(index + 1000))) },
  ])("rejects malformed indexes without treating uncertainty as a confirmed violation: %#", manifest => {
    unavailable({ ...fixture(), manifest });
  });

  it("accepts the exact source-ID and index count boundaries", () => {
    const input = fixture(Array.from({ length: 128 }, (_, index) => entry("private_note", id(index + 2000))));
    input.includedSourceIds = Array.from({ length: 256 }, (_, index) => id(index + 1000));
    expect(inspectExplorerContextExclusions(input)).toEqual({ status: "clear" });
  });

  it("rejects getters throughout supplied records and arrays without executing them", () => {
    const getter = vi.fn(() => { throw new Error(PRIVATE_CANARY); });
    const root = fixture(); Object.defineProperty(root, "serializedContext", { enumerable: true, get: getter });
    const bound = fixture(); Object.defineProperty(bound.expectedBinding, "explorerId", { enumerable: true, get: getter });
    const manifest = fixture(); Object.defineProperty(manifest.manifest, "entries", { enumerable: true, get: getter });
    const record = fixture(); Object.defineProperty(record.manifest.entries[0], "normalizedContentSha256", { enumerable: true, get: getter });
    const source = fixture(); Object.defineProperty(source.includedSourceIds, "0", { enumerable: true, get: getter });
    const entries = fixture(); Object.defineProperty(entries.manifest.entries, "0", { enumerable: true, get: getter });
    for (const candidate of [root, bound, manifest, record, source, entries]) unavailable(candidate);
    expect(getter.mock.calls.length).toBe(0);
  });

  it("rejects live and revoked proxies before their reflection traps", () => {
    const trap = vi.fn(() => { throw new Error(PRIVATE_CANARY); });
    const hostile = (value: object) => new Proxy(value, { get: () => trap(), getPrototypeOf: () => trap(), ownKeys: () => trap() });
    const input = fixture();
    unavailable(hostile(input));
    unavailable({ ...input, expectedBinding: hostile(input.expectedBinding) });
    unavailable({ ...input, includedSourceIds: hostile(input.includedSourceIds) });
    unavailable({ ...input, manifest: hostile(input.manifest) });
    unavailable({ ...input, manifest: { ...input.manifest, entries: hostile(input.manifest.entries) } });
    unavailable({ ...input, manifest: { ...input.manifest, entries: [hostile(entry())] } });
    const revoked = Proxy.revocable(input, {}); revoked.revoke(); unavailable(revoked.proxy);
    expect(trap.mock.calls.length).toBe(0);
  });

  it("rejects unknown symbols, hidden properties, exotic prototypes, sparse and decorated arrays", () => {
    const symbol = { ...fixture(), [Symbol("unknown")]: true };
    const hidden = Object.defineProperty(fixture(), "hidden", { value: true });
    const inherited = Object.create(fixture());
    const sparse = new Array(1); const decorated = Object.assign([id(4)], { extra: true });
    const exotic = Object.setPrototypeOf([id(4)], Object.create(Array.prototype));
    for (const candidate of [symbol, hidden, inherited, new Date()]) unavailable(candidate);
    for (const includedSourceIds of [sparse, decorated, exotic, new Uint8Array(1)]) unavailable({ ...fixture(), includedSourceIds });
    const hiddenEntry = Object.defineProperty(entry(), "normalizedContentSha256", { value: hash(PRIVATE_CANARY), enumerable: false });
    unavailable({ ...fixture(), manifest: { ...fixture().manifest, entries: [hiddenEntry] } });
  });

  it("accepts closed null-prototype records and freezes only newly returned values", () => {
    const input = fixture(); const record = Object.assign(Object.create(null), input);
    record.expectedBinding = Object.assign(Object.create(null), input.expectedBinding);
    record.manifest = Object.assign(Object.create(null), input.manifest);
    record.manifest.entries = [Object.assign(Object.create(null), entry())];
    expect(inspectExplorerContextExclusions(record)).toEqual({ status: "clear" });
    expect(Object.isFrozen(record)).toBe(false); expect(Object.isFrozen(record.manifest.entries[0])).toBe(false);
  });

  it("requires compact round-trip JSON, the twelve root keys and the correct roles/binding", () => {
    const input = fixture(); const original = JSON.parse(input.serializedContext) as Record<string, unknown>;
    const missing = { ...original }; delete missing.crisisBehavior;
    for (const serializedContext of ["", "null", "[]", "{", ` ${input.serializedContext}`, JSON.stringify(original, null, 2),
      JSON.stringify({ ...original, extra: true }), JSON.stringify(missing),
      JSON.stringify({ ...original, aiRole: "solmind_guide_assistant" }), JSON.stringify({ ...original, actorRoleContext: "guide" }),
      JSON.stringify({ ...original, sessionContext: [] }), JSON.stringify({ ...original, contractVersion: null }),
      changed(input.serializedContext, ["sessionContext", "explorerId"], id(99)),
      `${input.serializedContext.slice(0, -1)},"aiRole":"solmind_virtual_guide"}`]) {
      unavailable({ ...input, serializedContext });
    }
  });

  it("limits parsed container nesting to 64 including the root; this does not validate nested S03A schemas", () => {
    const nested = (count: number) => {
      let value: unknown = "Synthetic leaf";
      for (let index = 0; index < count; index += 1) value = { value };
      return value;
    };
    const input = fixture();
    input.serializedContext = changed(input.serializedContext, ["methodologyContext"], nested(63));
    expect(inspectExplorerContextExclusions(input)).toEqual({ status: "clear" });
    input.serializedContext = changed(input.serializedContext, ["methodologyContext"], nested(64));
    unavailable(input);
  });

  it("enforces the exact UTF8 byte ceiling independently of character length", () => {
    const input = fixture();
    const empty = changed(input.serializedContext, ["methodologyContext", "text"], "");
    const room = EXPLORER_SAFE_CONTEXT_LIMITS.serializedUtf8Bytes - new TextEncoder().encode(empty).byteLength;
    const text = "\u00e9".repeat(Math.floor(room / 2)) + (room % 2 === 0 ? "" : "x");
    input.serializedContext = changed(empty, ["methodologyContext", "text"], text);
    expect(new TextEncoder().encode(input.serializedContext).byteLength).toBe(EXPLORER_SAFE_CONTEXT_LIMITS.serializedUtf8Bytes);
    expect(inspectExplorerContextExclusions(input)).toEqual({ status: "clear" });
    input.serializedContext = changed(input.serializedContext, ["methodologyContext", "text"], `${text}x`);
    unavailable(input);
  });

  it("exports only the held inspector and version, never a raw-content hashing/source capability", () => {
    expect(Object.keys(matcher).sort()).toEqual(["EXPLORER_CONTEXT_EXCLUSION_MATCHER_VERSION", "inspectExplorerContextExclusions"]);
  });
});
