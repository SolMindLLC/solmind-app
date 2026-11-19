// SOLMIND-DEBUG: tests for the debug logging, removed with it before release.
import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import { link, mkdir, mkdtemp, readdir, readFile, stat, truncate, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import {
  describeExplorerSafetyReply,
  describeExplorerSafetyReplyShape,
  explorerConversationDebugLog,
  explorerConversationDebugLogEnabled,
  explorerConversationDebugStep,
  flushExplorerConversationDebugLog as flush,
  SOLMIND_DEBUG_CONVERSATION_LOG_ENV,
  withExplorerConversationDebugLog,
} from "./explorerConversationDebugLog";
import { EXPLORER_SAFETY_REQUEST_VERSION } from "../virtual-guide/explorerSafetyReplyContract";
import { invokeExplorerSafetyReply } from "../virtual-guide/explorerSafetyReplyInvocation";
import type { ExplorerPrivateConversationDependencies } from "../virtual-guide/explorerPrivateConversationComposition";

// SOLMIND-DEBUG: expose the real filesystem operations through exports the tests can spy on.
vi.mock("node:fs/promises", async (importOriginal) => ({ ...await importOriginal<typeof import("node:fs/promises")>() }));

const PROTOCOL = "explorer-safety-reply.v2";
const goodReply = { protocol: PROTOCOL, classification: { level: 0, minorIndicated: false }, candidateReply: { content: "Hello there." } };
const GOOD = JSON.stringify(goodReply);

async function logFolder(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "solmind-debug-"));
  vi.stubEnv(SOLMIND_DEBUG_CONVERSATION_LOG_ENV, folder);
  return folder;
}
// SOLMIND-DEBUG: keep the test day fixed across setup, append and inspection.
function dayFile(folder: string): string {
  vi.spyOn(Date.prototype, "toISOString").mockReturnValue("2026-11-19T12:00:00.000Z");
  return join(folder, "explorer-conversation-2026-11-19.jsonl");
}
// SOLMIND-DEBUG: size fixtures without allocating their contents in memory.
async function sizedFile(file: string, bytes: number): Promise<void> {
  await writeFile(file, "");
  onTestFinished(() => unlink(file));
  await truncate(file, bytes);
}
async function rows(folder: string): Promise<Record<string, unknown>[]> {
  await flush();
  const files = (await readdir(folder, { withFileTypes: true })).filter((entry) => entry.isFile());
  const text = (await Promise.all(files.map(file => readFile(join(folder, file.name), "utf8")))).join("");
  return text.trim() === "" ? [] : text.trim().split("\n").map(line => JSON.parse(line) as Record<string, unknown>);
}
function request(mode = "classification_and_reply") {
  const authorizedContext = JSON.stringify({ immediateExplorerMessage: { content: "Synthetic local message." } });
  return { contractVersion: EXPLORER_SAFETY_REQUEST_VERSION,
    invocationId: "00000000-0000-4000-8000-000000000001", explorerId: "00000000-0000-4000-8000-000000000002",
    sessionId: "00000000-0000-4000-8000-000000000003", contextSnapshotId: "00000000-0000-4000-8000-000000000004",
    contextFingerprint: createHash("sha256").update(authorizedContext).digest("hex"), authorizedContext,
    mode, classificationPolicyVersion: "synthetic-model.v1",
    fallbackPolicyVersion: "synthetic-fallback.v1", instructionVersion: "synthetic-instructions.v1" };
}
function dependencies(generate: (raw: unknown) => Promise<unknown>): ExplorerPrivateConversationDependencies {
  return Object.freeze({
    authenticate: async () => null,
    repository: Object.freeze({
      read: async () => ({ outcome: "ok", conversation_state: { secret: "private" } }),
      settle: async () => ({ outcome: "ok" }),
    }),
    provider: Object.freeze({ generate: (request: unknown) => generate(request) }),
  }) as unknown as ExplorerPrivateConversationDependencies;
}

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("debug conversation log (SOLMIND-DEBUG)", () => {
  it("DL01 is off without the setting: nothing is written and the dependencies are returned unchanged", async () => {
    vi.stubEnv(SOLMIND_DEBUG_CONVERSATION_LOG_ENV, "");
    expect(explorerConversationDebugLogEnabled()).toBe(false);
    const original = dependencies(async () => GOOD);
    expect(withExplorerConversationDebugLog(original)).toBe(original);
  });

  it("DL02 is off in a release build even with a valid folder", async () => {
    const folder = await logFolder();
    vi.stubEnv("NODE_ENV", "production");
    expect(explorerConversationDebugLogEnabled()).toBe(false);
    explorerConversationDebugLog("x", { a: 1 });
    const original = dependencies(async () => GOOD);
    expect(withExplorerConversationDebugLog(original)).toBe(original);
    expect(await rows(folder)).toEqual([]);
  });

  it("DL03 is off for a relative path, a path starting with two slashes or a file instead of a folder, and never throws", async () => {
    vi.stubEnv(SOLMIND_DEBUG_CONVERSATION_LOG_ENV, "relative/folder");
    expect(explorerConversationDebugLogEnabled()).toBe(false);
    const folder = await mkdtemp(join(tmpdir(), "solmind-debug-"));
    // An existing folder, written with a leading double slash or backslash: only the prefix rule refuses it.
    vi.stubEnv(SOLMIND_DEBUG_CONVERSATION_LOG_ENV, process.platform === "win32" ? "\\\\?\\" + folder : "/" + folder);
    expect(explorerConversationDebugLogEnabled()).toBe(false);
    vi.stubEnv(SOLMIND_DEBUG_CONVERSATION_LOG_ENV, folder);
    expect(explorerConversationDebugLogEnabled()).toBe(true);
    const file = join(folder, "not-a-folder.txt");
    await writeFile(file, "x");
    vi.stubEnv(SOLMIND_DEBUG_CONVERSATION_LOG_ENV, file);
    expect(explorerConversationDebugLogEnabled()).toBe(false);
    expect(() => explorerConversationDebugLog("x", { a: 1 })).not.toThrow();
  });

  it("DL04 logs each step's name, time and closed outcome, never the step's private content", async () => {
    const folder = await logFolder();
    const wrapped = withExplorerConversationDebugLog(dependencies(async () => GOOD));
    await wrapped.repository.read({} as never);
    const [row] = await rows(folder);
    expect(row).toMatchObject({ event: "send_step", step: "read", result: "ok", outcome: "ok" });
    expect(typeof row.ms).toBe("number");
    expect(JSON.stringify(row)).not.toContain("private");
  });

  it("DL05 logs a step that throws and rethrows the same error; a free-text message is not logged", async () => {
    const folder = await logFolder();
    const failure = new Error("explorer_send_deadline");
    await expect(explorerConversationDebugStep("s1", "prepare", async () => { throw failure; })).rejects.toBe(failure);
    const words = new Error("a message with words in it");
    await expect(explorerConversationDebugStep("s1", "ensure", async () => { throw words; })).rejects.toBe(words);
    const all = await rows(folder);
    expect(all[0]).toMatchObject({ event: "send_step", sendId: "s1", step: "prepare", result: "threw", error: "Error: explorer_send_deadline" });
    expect(all[1]).toMatchObject({ step: "ensure", error: "Error: (not logged)" });
  });

  it("DL06 logs the raw Guide reply with the parser's verdict and the shape rule, and returns the reply unchanged", async () => {
    const folder = await logFolder();
    const raw = JSON.stringify({ protocol: PROTOCOL, classification: { level: 0, minorIndicated: false }, candidateReply: { content: "Hi" }, compassResponse: [] });
    const wrapped = withExplorerConversationDebugLog(dependencies(async () => raw));
    const req = { invocationId: "00000000-0000-4000-8000-000000000001", mode: "classification_and_reply" };
    expect(await wrapped.provider!.generate(req as never, new AbortController().signal)).toBe(raw);
    const [row] = await rows(folder);
    expect(row).toMatchObject({ event: "guide_reply", invocationId: req.invocationId, mode: req.mode, parser: "accepted",
      candidateKind: "usable", level: 0, rule: "shape_ok", droppedKeys: ["compassResponse"], codeFence: false, raw });
  });

  it("DL07 logs a provider error and rethrows it", async () => {
    const folder = await logFolder();
    const failure = new Error("explorer_safety_http_failed");
    const wrapped = withExplorerConversationDebugLog(dependencies(async () => { throw failure; }));
    await expect(wrapped.provider!.generate({ invocationId: "x", mode: "classification_only" } as never, new AbortController().signal)).rejects.toBe(failure);
    const [row] = await rows(folder);
    expect(row).toMatchObject({ event: "guide_reply", rule: "provider_error", error: "Error: explorer_safety_http_failed" });
  });

  it("DL08 summarizes a settlement without the reply's words", async () => {
    const folder = await logFolder();
    const wrapped = withExplorerConversationDebugLog(dependencies(async () => GOOD));
    await wrapped.repository.settle({ p_status: "failed", p_reply_kind: "none", p_reply_body: "words of the reply",
      p_failure_reason: "invalid_response", p_model_level: null, p_choices: [{ label: "a" }], p_compass_topics: null, p_compass_suggestions: null,
      p_compass_responses: null, p_waypoint_suggestion: null, p_waypoint_response: null, p_attention_item_id: null } as never);
    const all = await rows(folder);
    expect(all.find(row => row.event === "send_settlement")).toMatchObject({ status: "failed", replyKind: "none",
      failureReason: "invalid_response", choices: 1, compassTopics: 0, waypointSuggestion: false });
    expect(JSON.stringify(all)).not.toContain("words of the reply");
  });

  it("DL09 names the first shape rule a reply breaks, and the parser's verdict beside it", () => {
    expect(describeExplorerSafetyReplyShape(GOOD, PROTOCOL)).toMatchObject({ rule: "shape_ok", candidateShape: "content" });
    expect(describeExplorerSafetyReplyShape(42, PROTOCOL)).toEqual({ rule: "not_text" });
    expect(describeExplorerSafetyReplyShape("```json\n" + GOOD + "\n```", PROTOCOL)).toMatchObject({ rule: "shape_ok", codeFence: true });
    expect(describeExplorerSafetyReplyShape("Here it is: ```json\n" + GOOD + "\n```", PROTOCOL)).toMatchObject({ rule: "not_json", startsWithCodeFence: false });
    expect(describeExplorerSafetyReplyShape("[1]", PROTOCOL)).toEqual({ rule: "not_object" });
    expect(describeExplorerSafetyReplyShape(JSON.stringify({ protocol: PROTOCOL, classification: { level: 0, minorIndicated: false } }), PROTOCOL))
      .toMatchObject({ rule: "missing_outer_keys", missingKeys: ["candidateReply"] });
    expect(describeExplorerSafetyReplyShape(GOOD.replace(PROTOCOL, "other"), PROTOCOL)).toMatchObject({ rule: "wrong_protocol" });
    expect(describeExplorerSafetyReplyShape(JSON.stringify({ protocol: PROTOCOL, classification: { level: 5, minorIndicated: false }, candidateReply: null }), PROTOCOL))
      .toMatchObject({ rule: "bad_classification" });
    expect(describeExplorerSafetyReplyShape(JSON.stringify({ protocol: PROTOCOL, classification: { level: 1, minorIndicated: false }, candidateReply: null }), PROTOCOL))
      .toMatchObject({ rule: "candidate_null" });
    expect(describeExplorerSafetyReplyShape(JSON.stringify({ protocol: PROTOCOL, classification: { level: 1, minorIndicated: false }, candidateReply: null }), PROTOCOL, "classification_only"))
      .toMatchObject({ rule: "shape_ok" });
    const longKey = JSON.stringify({ ["k".repeat(500)]: 1, protocol: PROTOCOL, classification: { level: 0, minorIndicated: false }, candidateReply: null });
    expect((describeExplorerSafetyReplyShape(longKey, PROTOCOL).droppedKeys as string[])[0].length).toBe(64);
    expect(describeExplorerSafetyReply(GOOD, "classification_and_reply")).toMatchObject({ parser: "accepted", candidateKind: "usable" });
    expect(describeExplorerSafetyReply(JSON.stringify({ protocol: PROTOCOL, classification: { level: 0, minorIndicated: false },
      candidateReply: { content: "x".repeat(9000) } }), "classification_and_reply")).toMatchObject({ parser: "accepted", candidateKind: "unusable", rule: "shape_ok" });
    expect(describeExplorerSafetyReply("not json", "classification_and_reply")).toMatchObject({ parser: "rejected", parserError: expect.stringMatching(/: explorer_safety_invalid_response$/) });
  });

  it("DL10 keeps the dependency keys, passes unwrapped members by reference and keeps absent capabilities absent", async () => {
    await logFolder();
    const renderer = Object.freeze({ verificationReceiptSha256: "A".repeat(64) });
    const operationalSignal = Object.freeze({ emit: async () => undefined });
    const sendCapacityAvailable = () => true;
    const full = Object.freeze({ ...dependencies(async () => GOOD), renderer, operationalSignal, sendCapacityAvailable,
      resolveOperationalReadiness: async () => null, buildContext: async () => ({}) }) as unknown as ExplorerPrivateConversationDependencies;
    const wrapped = withExplorerConversationDebugLog(full);
    expect(Object.keys(wrapped).sort()).toEqual(Object.keys(full).sort());
    expect(Object.keys(wrapped.repository).sort()).toEqual(Object.keys(full.repository).sort());
    expect(wrapped.renderer).toBe(renderer);
    expect(wrapped.operationalSignal).toBe(operationalSignal);
    expect((wrapped as unknown as { sendCapacityAvailable: unknown }).sendCapacityAvailable).toBe(sendCapacityAvailable);
    const bare = Object.freeze({ authenticate: async () => null, repository: Object.freeze({}) }) as unknown as ExplorerPrivateConversationDependencies;
    const wrappedBare = withExplorerConversationDebugLog(bare);
    expect(Object.keys(wrappedBare).sort()).toEqual(["authenticate", "repository"]);
    expect("provider" in wrappedBare || "buildContext" in wrappedBare || "resolveOperationalReadiness" in wrappedBare).toBe(false);
  });

  it("DL11 skips a day's log file that is not a plain file, and the wrapped calls still answer", async () => {
    const folder = await logFolder();
    await mkdir(join(folder, `explorer-conversation-${new Date().toISOString().slice(0, 10)}.jsonl`));
    const wrapped = withExplorerConversationDebugLog(dependencies(async () => GOOD));
    await expect(wrapped.repository.read({} as never)).resolves.toMatchObject({ outcome: "ok" });
    expect(await wrapped.provider!.generate({ invocationId: "x", mode: "classification_and_reply" } as never, new AbortController().signal)).toBe(GOOD);
    expect(await rows(folder)).toEqual([]);
  });

  it("DL11b swallows a log write that throws, after the wrapped calls have answered", async () => {
    const folder = await logFolder();
    const wrapped = withExplorerConversationDebugLog(dependencies(async () => GOOD));
    const stringify = vi.spyOn(JSON, "stringify").mockImplementation(() => { throw new Error("stringify_failed"); });
    let read: unknown; let reply: unknown;
    try {
      read = await wrapped.repository.read({} as never);
      reply = await wrapped.provider!.generate({ invocationId: "x", mode: "classification_and_reply" } as never, new AbortController().signal);
      await flush();
    } finally { stringify.mockRestore(); }
    expect(read).toMatchObject({ outcome: "ok" });
    expect(reply).toBe(GOOD);
    expect(await rows(folder)).toEqual([]);
  });

  it("DL13 names the competing-safety-field rejection in the log", () => {
    const base = { protocol: PROTOCOL, classification: { level: 0, minorIndicated: false }, candidateReply: { content: "Hi" } };
    for (const extra of [{ Classification: { level: 4, minorIndicated: false } }, { level: 4 }, { minor_indicated: true }, { "candidate-reply": null }]) {
      const described = describeExplorerSafetyReply(JSON.stringify({ ...base, ...extra }), "classification_and_reply");
      expect(described).toMatchObject({ parser: "rejected", rule: "conflicting_outer_key" });
    }
  });

  it("DL12 the wrapped provider passes the real invoker's checks and is observed", async () => {
    const folder = await logFolder();
    const wrapped = withExplorerConversationDebugLog(dependencies(async () => GOOD));
    const result = await invokeExplorerSafetyReply({ request: request(), transport: wrapped.provider!, timeoutMilliseconds: 1000 });
    expect(result.status).toBe("observed");
    expect(result.observation).toEqual({ classification: { level: 0, minorIndicated: false }, candidate: { kind: "usable", content: "Hello there." } });
    const [row] = await rows(folder);
    expect(row).toMatchObject({ event: "guide_reply", parser: "accepted" });
  });

  it("DL14 describes a repaired surplus-brace reply and adds only the repair flag", () => {
    for (const raw of [GOOD + "} \t\n\r", "```json\n" + GOOD + "}\n```"]) {
      const described = describeExplorerSafetyReply(raw, "classification_and_reply");
      expect(described).toEqual({ parser: "accepted", candidateKind: "usable", level: 0, rule: "shape_ok",
        codeFence: raw.startsWith("```"), outerKeys: ["protocol", "classification", "candidateReply"],
        droppedKeys: [], missingKeys: [], candidateShape: "content", surplusClosingBraceRemoved: true,
        proposals: { compassSupplied: false, compassKeys: [], compassOtherKeys: 0, compassKept: false, compassTopicsSupplied: 0,
          compassTopicsKept: 0, attentionKept: false, waypointSuggestionSupplied: false, waypointSuggestionKept: false,
          waypointResponseSupplied: false, waypointResponseKept: false, choicesSupplied: 0, choicesKept: 0 } });
      expect(JSON.stringify(described)).not.toContain("Hello there.");
    }
  });

  it("DL15 names repeated names before missing keys and scans the repaired text", () => {
    const raw = GOOD.slice(0, -1) + ',"extra":1,"extra":2}';
    expect(describeExplorerSafetyReply(raw, "classification_and_reply")).toMatchObject({ parser: "rejected", rule: "repeated_name" });
    expect(describeExplorerSafetyReplyShape(raw, PROTOCOL)).not.toHaveProperty("surplusClosingBraceRemoved");
    expect(describeExplorerSafetyReply(raw + "}", "classification_and_reply"))
      .toMatchObject({ parser: "rejected", rule: "repeated_name", surplusClosingBraceRemoved: true });
    expect(describeExplorerSafetyReplyShape('{"extra":1,"extra":2}', PROTOCOL))
      .toMatchObject({ rule: "repeated_name", missingKeys: ["protocol", "classification", "candidateReply"] });
  });

  it("DL16 keeps unreadable replies at not_json without a repair flag", () => {
    for (const raw of ["not json", "not json}", GOOD + "}}", GOOD + "}\u00a0"]) {
      expect(describeExplorerSafetyReplyShape(raw, PROTOCOL))
        .toEqual({ rule: "not_json", startsWithCodeFence: false, startsWithBrace: raw.startsWith("{") });
    }
  });

  it("DL17 contains a repeated-name scanner failure without logging reply words", () => {
    const parsed: unknown = JSON.parse(GOOD);
    const spy = vi.spyOn(JSON, "parse").mockReturnValueOnce(parsed);
    try {
      const described = describeExplorerSafetyReplyShape("Synthetic unreadable document.", PROTOCOL);
      expect(described).toEqual({ rule: "repeated_name_scan_failed", codeFence: false,
        outerKeys: ["protocol", "classification", "candidateReply"], droppedKeys: [], missingKeys: [], candidateShape: "content" });
      expect(JSON.stringify(described)).not.toContain("Synthetic unreadable document.");
      expect(JSON.stringify(described)).not.toContain("Hello there.");
    } finally { spy.mockRestore(); }
  });

  it("DL20 summarizes the kept topic and dropped Waypoint draft without their words or IDs", () => {
    const pointId = "00000000-0000-4000-8000-000000000001";
    const draftId = "00000000-0000-4000-8000-000000000002";
    const topic = { topicId: null, label: "Quiet mornings", supportRefs: ["now"], ready: false };
    const draft = { title: "Walk", destination: "Park", whyItMatters: "Fresh air" };
    const choice = { label: "Stay here" };
    const body = JSON.stringify({ ...goodReply, compass: { attention: pointId, current: null, topics: [topic] },
      waypointSuggestion: draft, waypointResponse: { draftId, response: "right" }, choices: [choice] });
    const raw = "```json\n" + body + "}\n```";
    const { proposals } = describeExplorerSafetyReply(raw, "classification_and_reply");
    expect(proposals).toEqual({ compassSupplied: true, compassKeys: ["attention", "current", "topics"], compassOtherKeys: 0, compassKept: true,
      compassTopicsSupplied: 1, compassTopicsKept: 1, attentionKept: true,
      waypointSuggestionSupplied: true, waypointSuggestionKept: false, waypointResponseSupplied: true,
      waypointResponseKept: true, choicesSupplied: 1, choicesKept: 1 });
    const logged = JSON.stringify(proposals);
    for (const value of [topic.label, ...Object.values(draft), pointId, draftId, choice.label, goodReply.candidateReply.content]) {
      expect(logged).not.toContain(value);
    }
  });

  it("DL21 counts a supplied topic when an unknown Compass key drops it", () => {
    const compass = { topics: [{ topicId: null, label: "Quiet mornings", supportRefs: ["now"], ready: false }], correction: true };
    const raw = JSON.stringify({ ...goodReply, compass });
    expect(describeExplorerSafetyReply(raw, "classification_and_reply").proposals).toMatchObject({
      compassSupplied: true, compassKeys: ["topics"], compassOtherKeys: 1, compassKept: false, compassTopicsSupplied: 1, compassTopicsKept: 0,
    });
    expect(describeExplorerSafetyReply(raw, "classification_only")).not.toHaveProperty("proposals");
    expect(describeExplorerSafetyReply("not json", "classification_and_reply")).not.toHaveProperty("proposals");
  });

  it("DL22 counts a Compass key containing conversation text without recording the text", () => {
    const topic = { topicId: null, label: "Routine", supportRefs: ["now"], ready: false };
    const raw = JSON.stringify({ ...goodReply, compass: { "Quiet mornings": true, topics: [topic] } });
    const { proposals } = describeExplorerSafetyReply(raw, "classification_and_reply");
    expect(proposals).toMatchObject({
      compassKept: false, compassKeys: ["topics"], compassOtherKeys: 1, compassTopicsSupplied: 1, compassTopicsKept: 0,
    });
    expect(JSON.stringify(proposals)).not.toContain("Quiet mornings");
  });

  it("DL23 SOLMIND-DEBUG filters error names and messages independently", async () => {
    const folder = await logFolder();
    const token = new TypeError("ab".repeat(32));
    const named = new Error("explorer_safety_invalid_transport");
    named.name = "PrivateName";
    for (const failure of [token, named]) {
      await expect(explorerConversationDebugStep("s1", "read", () => Promise.reject(failure))).rejects.toBe(failure);
    }
    expect((await rows(folder)).map(row => row.error)).toEqual([
      "TypeError: (not logged)", "(not logged): explorer_safety_invalid_transport",
    ]);
  });

  it("DL24 SOLMIND-DEBUG drops unknown step outcomes", async () => {
    const folder = await logFolder();
    const value = { outcome: "ab".repeat(32) };
    await expect(explorerConversationDebugStep("s1", "read", () => Promise.resolve(value))).resolves.toBe(value);
    expect(await rows(folder)).toMatchObject([{ outcome: null }]);
  });

  it("DL25 SOLMIND-DEBUG filters settlement values using each field's own domain", async () => {
    const folder = await logFolder();
    const wrapped = withExplorerConversationDebugLog(dependencies(async () => GOOD));
    await wrapped.repository.settle({ p_status: "ordinary", p_reply_kind: "deadline", p_failure_reason: "failed" } as never);
    const summary = (await rows(folder)).find(row => row.event === "send_settlement");
    expect(summary).toMatchObject({ status: null, replyKind: null, failureReason: null });
  });

  it("DL26 SOLMIND-DEBUG skips appends at the daily byte limit", async () => {
    const file = dayFile(await logFolder());
    const limit = 5_000_000;
    await sizedFile(file, limit);
    await explorerConversationDebugLog("test", {});
    expect((await stat(file)).size).toBe(limit);
  });

  it("DL27 SOLMIND-DEBUG skips a new day when older logs together reach the folder limit", async () => {
    const folder = await logFolder();
    const file = dayFile(folder);
    const halfLimit = 25_000_000;
    const first = join(folder, "explorer-conversation-2026-11-17.jsonl");
    const second = join(folder, "explorer-conversation-2026-11-18.jsonl");
    await sizedFile(first, halfLimit);
    await sizedFile(second, halfLimit);
    await explorerConversationDebugLog("test", {});
    await expect(stat(file)).rejects.toMatchObject({ code: "ENOENT" });
    expect((await stat(first)).size).toBe(halfLimit);
    expect((await stat(second)).size).toBe(halfLimit);
  });

  it("DL28 SOLMIND-DEBUG leaves both names of a hard-linked day file untouched", async () => {
    const folder = await logFolder();
    const file = dayFile(folder);
    const original = join(folder, "original.txt");
    await writeFile(original, "original contents");
    await link(original, file);
    await explorerConversationDebugLog("test", {});
    expect(await readFile(original, "utf8")).toBe("original contents");
    expect(await readFile(file, "utf8")).toBe("original contents");
  });

  it("DL29 SOLMIND-DEBUG admits only the UTF-8 record that fits when appends overlap", async () => {
    const folder = await logFolder();
    const file = dayFile(folder);
    const event = "\u00e9";
    const line = JSON.stringify({ at: new Date().toISOString(), event }) + "\n";
    await sizedFile(file, 5_000_000 - Buffer.byteLength(line));
    await sizedFile(join(folder, "unrelated.jsonl"), 50_000_000);
    await Promise.all([
      explorerConversationDebugLog(event + event, {}),
      explorerConversationDebugLog(event, {}),
      explorerConversationDebugLog(event, {}),
    ]);
    expect((await stat(file)).size).toBe(5_000_000);
  });

  it("DL30 SOLMIND-DEBUG drops records beyond 100 while the first inspection is stalled", async () => {
    await logFolder();
    let failInspection!: (error: Error) => void;
    const stalled = new Promise<never>((_, reject) => { failInspection = reject; });
    const inspect = vi.spyOn(fs, "lstat").mockReturnValueOnce(stalled);
    vi.spyOn(fs, "opendir").mockRejectedValue(new Error("scan failed"));
    const numbers = Array.from({ length: 200 }, (_, index) => index + 1);
    const settled: number[] = [];
    const writes = numbers.map(number => explorerConversationDebugLog("test", { number }).then(() => { settled.push(number); }));
    try {
      await new Promise<void>(resolve => setImmediate(resolve));
      expect(inspect).toHaveBeenCalledTimes(1);
      expect([...settled]).toEqual(numbers.slice(100));
    } finally {
      failInspection(new Error("inspection failed"));
      await Promise.all(writes);
    }
    expect(inspect).toHaveBeenCalledTimes(100);
    // SOLMIND-DEBUG: the failed inspection and the 99 rejected scans must release all 100 slots.
    await Promise.all(numbers.slice(100).map(number => explorerConversationDebugLog("next", { number })));
    expect(inspect).toHaveBeenCalledTimes(200);
  });

  it("DL31 SOLMIND-DEBUG skips the open when the checked folder becomes a link during the size scan", async () => {
    const folder = await logFolder();
    const moved = folder + "-moved";
    const file = dayFile(folder);
    const scan = fs.opendir;
    vi.spyOn(fs, "opendir").mockImplementationOnce(async (...args) => {
      await fs.rename(folder, moved);
      await fs.symlink(moved, folder, "junction");
      return scan(...args);
    });
    await explorerConversationDebugLog("test", {});
    expect((await fs.lstat(folder)).isSymbolicLink()).toBe(true);
    try {
      await expect(stat(file)).rejects.toMatchObject({ code: "ENOENT" });
    } finally { await unlink(folder); }
  });

  it("DL32 SOLMIND-DEBUG skips a new day when the folder budget is one byte short of its record", async () => {
    const folder = await logFolder();
    const file = dayFile(folder);
    const event = "\u00e9";
    const line = JSON.stringify({ at: new Date().toISOString(), event }) + "\n";
    const older = join(folder, "explorer-conversation-2026-11-18.jsonl");
    const olderBytes = 50_000_000 - (Buffer.byteLength(line) - 1);
    await sizedFile(older, olderBytes);
    await explorerConversationDebugLog(event, {});
    await expect(stat(file)).rejects.toMatchObject({ code: "ENOENT" });
    expect((await stat(older)).size).toBe(olderBytes);
  });

  it.each(["dev", "ino"] as const)("DL33 SOLMIND-DEBUG closes without writing when the opened %s differs", async (field) => {
    const file = dayFile(await logFolder());
    await sizedFile(file, 0);
    const before = await fs.lstat(file, { bigint: true });
    before[field] += BigInt(1);
    const handle = await fs.open(file, "a");
    try {
      // SOLMIND-DEBUG: only the pre-open identity differs; a later pathname check sees the real file.
      vi.spyOn(fs, "lstat").mockResolvedValueOnce(before);
      vi.spyOn(fs, "open").mockResolvedValueOnce(handle);
      await explorerConversationDebugLog("test", {});
      expect((await stat(file)).size).toBe(0);
      expect(handle.fd).toBe(-1);
    } finally { await handle.close(); }
  });
});

describe("offers build step 2: debug conversation log (SOLMIND-DEBUG)", () => {
  it("DL18 treats the two offer fields as known outer keys of a reply", () => {
    const raw = JSON.stringify({ protocol: PROTOCOL, classification: { level: 0, minorIndicated: false },
      candidateReply: { content: "A synthetic reply." }, waypointOffer: { kind: "reached" }, waypointOfferResponse: null, waypointReached: {} });
    expect(describeExplorerSafetyReplyShape(raw, PROTOCOL)).toMatchObject({ rule: "shape_ok",
      outerKeys: ["protocol", "classification", "candidateReply", "waypointOffer", "waypointOfferResponse", "waypointReached"],
      droppedKeys: ["waypointReached"] });
  });
  it("DL19 summarizes a settlement's offer arguments by presence only", async () => {
    const folder = await logFolder();
    const wrapped = withExplorerConversationDebugLog(dependencies(async () => GOOD));
    await wrapped.repository.settle({ p_status: "completed", p_reply_kind: "ordinary", p_reply_body: "words of the reply",
      p_failure_reason: null, p_model_level: 0, p_choices: null, p_compass_topics: null, p_compass_suggestions: null,
      p_compass_responses: null, p_waypoint_suggestion: null, p_waypoint_response: null, p_attention_item_id: null,
      p_waypoint_offer: { kind: "reached", waypointId: "00000000-0000-4000-8000-000000000001", evidence: "words of the evidence" } } as never);
    const all = await rows(folder);
    expect(all.find(row => row.event === "send_settlement")).toMatchObject({ status: "completed", replyKind: "ordinary",
      waypointSuggestion: false, waypointResponse: false, waypointOffer: true, waypointOfferResponse: false, waypointOfferDrop: false });
    expect(JSON.stringify(all)).not.toContain("words of the evidence");
    expect(JSON.stringify(all)).not.toContain("words of the reply");
  });
});
