// SOLMIND-DEBUG: tests for the debug logging, removed with it before release.
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  describeExplorerSafetyReply,
  describeExplorerSafetyReplyShape,
  explorerConversationDebugLog,
  explorerConversationDebugLogEnabled,
  explorerConversationDebugStep,
  SOLMIND_DEBUG_CONVERSATION_LOG_ENV,
  withExplorerConversationDebugLog,
} from "./explorerConversationDebugLog";
import { EXPLORER_SAFETY_REQUEST_VERSION } from "../virtual-guide/explorerSafetyReplyContract";
import { invokeExplorerSafetyReply } from "../virtual-guide/explorerSafetyReplyInvocation";
import type { ExplorerPrivateConversationDependencies } from "../virtual-guide/explorerPrivateConversationComposition";

const PROTOCOL = "explorer-safety-reply.v2";
const GOOD = JSON.stringify({ protocol: PROTOCOL, classification: { level: 0, minorIndicated: false }, candidateReply: { content: "Hello there." } });

async function logFolder(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "solmind-debug-"));
  vi.stubEnv(SOLMIND_DEBUG_CONVERSATION_LOG_ENV, folder);
  return folder;
}
// Log writes run after the wrapped call returns (setImmediate); let them finish before reading.
async function flush(): Promise<void> {
  for (let i = 0; i < 3; i += 1) await new Promise((resolve) => setImmediate(resolve));
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
    expect(all[1]).toMatchObject({ step: "ensure", error: "Error: (message not logged)" });
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
});
