// SOLMIND-DEBUG: DEBUG CODE - remove before release.
//
// Debug logging for Explorer conversations with the SolMind Virtual Guide, on the local demo only (Paul's decision,
// PRJ01-SPR002 decision queue, morning meeting entry of 2026-11-10, item 12). It records each Send step's result and
// timing, the reply checker's own verdict on each Virtual Guide reply with the first rule the reply breaks, and the
// reply's raw text, so failed replies can be traced. The raw text holds conversation words: the demo uses invented test
// words only, and this must never run with real Explorers.
//
// Two switches, both needed, like a C #ifdef DEBUG:
// - the build: a release build (NODE_ENV production, which `next build` sets and inlines) never logs, and the
//   guarded code below it is dead code there;
// - the server setting SOLMIND_DEBUG_CONVERSATION_LOG, the absolute path of an existing folder that is not a link and
//   does not start with two slashes or backslashes (mapped drives and links in parent folders are not detected).
//   Unset, the module does nothing. The app never creates the folder.
// Every line here and every call site carries the tag SOLMIND-DEBUG, so one search finds all of it, and the
// release-candidate check (scripts/releaseCandidateScan.mjs) fails while the tag remains in the app source.
// Logging never changes what the app does: log records are built and written after the wrapped call has finished,
// outside the call's own error handling, and every failure in this module is swallowed.
import "server-only";

import { randomUUID } from "node:crypto";
import { appendFileSync, lstatSync } from "node:fs";
import path from "node:path";
import type { ExplorerPrivateConversationDependencies } from "../virtual-guide/explorerPrivateConversationComposition";
import { EXPLORER_SAFETY_REPLY_PROTOCOL, explorerSafetyReplyHasConflictingOuterKey, explorerSafetyReplyRepeatsName, parseExplorerSafetyReplyBody, type ExplorerSafetyReplyObservation } from "../virtual-guide/explorerSafetyReplyContract";

export const SOLMIND_DEBUG_TAG = "SOLMIND-DEBUG";
export const SOLMIND_DEBUG_CONVERSATION_LOG_ENV = "SOLMIND_DEBUG_CONVERSATION_LOG";
const RAW_TEXT_LIMIT = 65_536;
const KEY_LIMIT = 64;

// SOLMIND-DEBUG: the folder to write to, or null when logging is off.
function logFolder(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  try {
    const folder = process.env[SOLMIND_DEBUG_CONVERSATION_LOG_ENV];
    if (typeof folder !== "string" || folder.length === 0 || !path.isAbsolute(folder)) return null;
    if (folder.startsWith("\\\\") || folder.startsWith("//")) return null;
    const status = lstatSync(folder);
    return status.isDirectory() && !status.isSymbolicLink() ? folder : null;
  } catch { return null; }
}

// SOLMIND-DEBUG
export function explorerConversationDebugLogEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return logFolder() !== null;
}

// SOLMIND-DEBUG: appends one JSON line to that day's file (UTC day in the name); never throws. The day's file must be
// a plain file when it exists.
export function explorerConversationDebugLog(event: string, fields: Readonly<Record<string, unknown>>): void {
  if (process.env.NODE_ENV === "production") return;
  try {
    const folder = logFolder();
    if (folder === null) return;
    const at = new Date().toISOString();
    const file = path.join(folder, `explorer-conversation-${at.slice(0, 10)}.jsonl`);
    try {
      if (!lstatSync(file).isFile()) return;
    } catch { /* SOLMIND-DEBUG: the day's first record creates the file */ }
    appendFileSync(file, JSON.stringify({ at, event, ...fields }) + "\n", { encoding: "utf8", flag: "a" });
  } catch { /* SOLMIND-DEBUG: logging never affects the app */ }
}

// SOLMIND-DEBUG: runs a log write after the current call has returned, so it adds no time to the call and cannot
// change its result.
function later(write: () => void): void {
  try { setImmediate(() => { try { write(); } catch { /* SOLMIND-DEBUG */ } }); } catch { /* SOLMIND-DEBUG */ }
}

// SOLMIND-DEBUG: a value-free code for a thrown error: the error's name, and its message only when it is a closed code.
function errorCode(error: unknown): string {
  try {
    if (error instanceof Error) {
      const name = /^[A-Za-z]{1,40}$/.test(error.name) ? error.name : "Error";
      return /^[a-z0-9_]{1,80}$/.test(error.message) ? name + ": " + error.message : name + ": (message not logged)";
    }
    return typeof error;
  } catch { return "unknown"; }
}

// SOLMIND-DEBUG: the result of a step without its private content: a row's closed outcome when it has one.
function outcomeOf(value: unknown): string | null {
  try {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      const outcome = (value as { outcome?: unknown }).outcome;
      if (typeof outcome === "string" && /^[a-z0-9_]{1,80}$/.test(outcome)) return outcome;
    }
  } catch { /* SOLMIND-DEBUG */ }
  return null;
}

// SOLMIND-DEBUG: runs one Send step, logging its name, time and result afterwards. With logging off it only runs it.
export async function explorerConversationDebugStep<T>(sendId: string, step: string, operation: () => Promise<T>): Promise<T> {
  if (process.env.NODE_ENV === "production" || !explorerConversationDebugLogEnabled()) return operation();
  const started = performance.now();
  let value: T;
  try {
    value = await operation();
  } catch (error) {
    const ms = Math.round(performance.now() - started);
    later(() => explorerConversationDebugLog("send_step", { sendId, step, ms, result: "threw", error: errorCode(error) }));
    throw error;
  }
  const ms = Math.round(performance.now() - started);
  later(() => explorerConversationDebugLog("send_step", { sendId, step, ms, result: "ok", outcome: outcomeOf(value) }));
  return value;
}

const ALLOWED_OUTER_KEYS = Object.freeze(["protocol", "classification", "candidateReply", "compass", "choices", "waypointSuggestion", "waypointResponse",
  "waypointOffer", "waypointOfferResponse"]);
const REQUIRED_OUTER_KEYS = Object.freeze(["protocol", "classification", "candidateReply"]);
const KNOWN_COMPASS_KEYS = Object.freeze(["attention", "topics", "suggestions", "responses", "current"]);

// SOLMIND-DEBUG: bound key names in the shape record.
function shortKeyNames(keys: readonly string[]): string[] {
  return keys.slice(0, 20).map((key) => key.slice(0, KEY_LIMIT));
}

// SOLMIND-DEBUG: retain the decoded object for comparing proposals alongside the shape check.
function inspectReplyShape(rawText: unknown, protocol: string, mode: string): {
  shape: Readonly<Record<string, unknown>>; body?: Record<string, unknown>;
} {
  if (typeof rawText !== "string") return { shape: { rule: "not_text" } };
  const trimmed = rawText.trim();
  const fenced = /^\s*```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```\s*$/u.exec(rawText);
  let body: unknown;
  let parsedText = fenced ? fenced[1] : rawText;
  let surplusClosingBraceRemoved = false;
  // SOLMIND-DEBUG: brace repair and repeated-name checks mirror Paul's options A and E of 2026-11-12.
  try { body = JSON.parse(parsedText); } catch {
    let end = parsedText.length;
    while (end > 0 && " \t\n\r".includes(parsedText[end - 1])) end--;
    if (parsedText[end - 1] !== "}") {
      return { shape: { rule: "not_json", startsWithCodeFence: trimmed.startsWith("```"), startsWithBrace: trimmed.startsWith("{") } };
    }
    parsedText = parsedText.slice(0, end - 1);
    try { body = JSON.parse(parsedText); } catch {
      return { shape: { rule: "not_json", startsWithCodeFence: trimmed.startsWith("```"), startsWithBrace: trimmed.startsWith("{") } };
    }
    surplusClosingBraceRemoved = true;
  }
  const repair = surplusClosingBraceRemoved ? { surplusClosingBraceRemoved: true } : {};
  if (body === null || typeof body !== "object" || Array.isArray(body)) return { shape: { rule: "not_object", ...repair } };
  let repeatedNameRule: string | null = null;
  try {
    if (explorerSafetyReplyRepeatsName(parsedText)) repeatedNameRule = "repeated_name";
  } catch { repeatedNameRule = "repeated_name_scan_failed"; }
  const keys = Object.keys(body);
  const dropped = keys.filter((key) => !ALLOWED_OUTER_KEYS.includes(key));
  const missing = REQUIRED_OUTER_KEYS.filter((key) => !keys.includes(key));
  const record = body as Record<string, unknown>;
  const classification = record.classification;
  const classificationValid = classification !== null && typeof classification === "object" && !Array.isArray(classification) &&
    Object.keys(classification).length === 2 && Number.isInteger((classification as Record<string, unknown>).level) &&
    ((classification as Record<string, number>).level >= 0 && (classification as Record<string, number>).level <= 4) &&
    typeof (classification as Record<string, unknown>).minorIndicated === "boolean";
  const candidate = record.candidateReply;
  const candidateShape = candidate === null ? "null" : candidate !== null && typeof candidate === "object" && !Array.isArray(candidate) &&
    Object.keys(candidate).length === 1 && typeof (candidate as Record<string, unknown>).content === "string"
    ? ((candidate as Record<string, string>).content.trim().length === 0 ? "empty" : "content") : "other_shape";
  const rule = repeatedNameRule !== null ? repeatedNameRule : missing.length > 0 ? "missing_outer_keys"
    : record.protocol !== protocol ? "wrong_protocol"
      : explorerSafetyReplyHasConflictingOuterKey(body) ? "conflicting_outer_key" : !classificationValid ? "bad_classification"
      : mode !== "classification_only" && candidateShape !== "content" ? "candidate_" + candidateShape : "shape_ok";
  return { body: record, shape: { rule, codeFence: fenced !== null, outerKeys: shortKeyNames(keys),
    droppedKeys: shortKeyNames(dropped), missingKeys: missing, candidateShape, ...repair } };
}

// SOLMIND-DEBUG: name the first shape rule a raw Virtual Guide reply breaks.
export function describeExplorerSafetyReplyShape(rawText: unknown, protocol: string, mode: string = "classification_and_reply"): Readonly<Record<string, unknown>> {
  return inspectReplyShape(rawText, protocol, mode).shape;
}

// SOLMIND-DEBUG: compare supplied and parsed proposals using only key names, counts and presence flags.
function proposalSummary(body: Record<string, unknown> | undefined, parsed: ExplorerSafetyReplyObservation): Readonly<Record<string, unknown>> {
  try {
    if (body === undefined) return {};
    const rawCompass = body.compass;
    const compass = rawCompass !== null && typeof rawCompass === "object" && !Array.isArray(rawCompass)
      ? rawCompass as Record<string, unknown> : undefined;
    const suppliedKeys = Object.keys(compass ?? {});
    const compassKeys = suppliedKeys.filter((key) => KNOWN_COMPASS_KEYS.includes(key));
    return {
      compassSupplied: rawCompass != null,
      compassKeys,
      compassOtherKeys: suppliedKeys.length - compassKeys.length,
      compassKept: parsed.compass !== undefined,
      compassTopicsSupplied: Array.isArray(compass?.topics) ? compass.topics.length : 0,
      compassTopicsKept: parsed.compass?.topics?.length ?? 0,
      attentionKept: parsed.compass?.attention !== undefined,
      waypointSuggestionSupplied: body.waypointSuggestion != null,
      waypointSuggestionKept: parsed.waypointSuggestion !== undefined,
      waypointResponseSupplied: body.waypointResponse != null,
      waypointResponseKept: parsed.waypointResponse !== undefined,
      choicesSupplied: Array.isArray(body.choices) ? body.choices.length : 0,
      choicesKept: parsed.choices?.length ?? 0,
    };
  } catch { return {}; }
}

// SOLMIND-DEBUG: the parser's own verdict on a raw reply, beside the shape rule: accepted (with the candidate's kind)
// or the parser's error code.
export function describeExplorerSafetyReply(rawText: unknown, mode: string): Readonly<Record<string, unknown>> {
  const { shape, body } = inspectReplyShape(rawText, EXPLORER_SAFETY_REPLY_PROTOCOL, mode);
  try {
    const observation = parseExplorerSafetyReplyBody(rawText, mode as Parameters<typeof parseExplorerSafetyReplyBody>[1]);
    return { parser: "accepted", candidateKind: observation.candidate.kind, level: observation.classification.level, ...shape,
      ...(mode === "classification_and_reply" ? { proposals: proposalSummary(body, observation) } : {}) };
  } catch (error) {
    return { parser: "rejected", parserError: errorCode(error), ...shape };
  }
}

// SOLMIND-DEBUG: the raw text, cut to a bounded length.
export function boundedDebugText(rawText: unknown): string | null {
  return typeof rawText === "string" ? rawText.slice(0, RAW_TEXT_LIMIT) : null;
}

// SOLMIND-DEBUG: what a settlement keeps, without the reply's words (the raw reply is logged on its own).
function settlementSummary(value: unknown): Readonly<Record<string, unknown>> {
  try {
    if (value === null || typeof value !== "object") return {};
    const settlement = value as Record<string, unknown>;
    const closed = (key: string) => typeof settlement[key] === "string" && /^[a-z0-9_]{1,80}$/.test(settlement[key] as string) ? settlement[key] : null;
    const count = (key: string) => Array.isArray(settlement[key]) ? (settlement[key] as unknown[]).length : 0;
    return { status: closed("p_status"), replyKind: closed("p_reply_kind"), failureReason: closed("p_failure_reason"),
      modelLevel: typeof settlement.p_model_level === "number" ? settlement.p_model_level : null,
      attentionProposed: settlement.p_attention_item_id != null, choices: count("p_choices"),
      compassTopics: count("p_compass_topics"), // SOLMIND-DEBUG: counts only; never evidence identities or wording.
      waypointSuggestion: settlement.p_waypoint_suggestion != null, waypointResponse: settlement.p_waypoint_response != null,
      // SOLMIND-DEBUG: presence only; never an offer's wording, evidence or identities.
      waypointOffer: settlement.p_waypoint_offer != null, waypointOfferResponse: settlement.p_waypoint_offer_response != null,
      waypointOfferDrop: settlement.p_waypoint_offer_drop != null };
  } catch { return {}; }
}

// SOLMIND-DEBUG: wraps one request's dependencies so each step, each settlement and each raw Virtual Guide reply is
// logged. With logging off it returns the same object, unchanged.
export function withExplorerConversationDebugLog(dependencies: ExplorerPrivateConversationDependencies): ExplorerPrivateConversationDependencies {
  if (process.env.NODE_ENV === "production" || !explorerConversationDebugLogEnabled()) return dependencies;
  const sendId = randomUUID().slice(0, 8);
  const source = dependencies.repository as unknown as Record<string, unknown>;
  const repository = Object.freeze(Object.fromEntries(Object.entries(source).map(([name, port]) => [name,
    typeof port !== "function" ? port : (...args: unknown[]) => {
      if (name === "settle") {
        const settlement = args[0];
        later(() => explorerConversationDebugLog("send_settlement", { sendId, ...settlementSummary(settlement) }));
      }
      return explorerConversationDebugStep(sendId, name, () => (port as (...a: unknown[]) => Promise<unknown>)(...args));
    }]))) as unknown as ExplorerPrivateConversationDependencies["repository"];
  const provider = dependencies.provider;
  const resolve = dependencies.resolveOperationalReadiness; const build = dependencies.buildContext;
  return Object.freeze({ ...dependencies,
    authenticate: () => explorerConversationDebugStep(sendId, "authenticate", () => dependencies.authenticate()),
    repository,
    ...(resolve === undefined ? {} : { resolveOperationalReadiness: (...args: Parameters<NonNullable<typeof resolve>>) =>
      explorerConversationDebugStep(sendId, "readiness", () => resolve(...args)) }),
    ...(build === undefined ? {} : { buildContext: (input: Parameters<NonNullable<typeof build>>[0]) =>
      explorerConversationDebugStep(sendId, "context", () => build(input)) }),
    ...(provider === undefined ? {} : { provider: Object.freeze({ ...provider,
      generate: async (...args: Parameters<typeof provider.generate>) => {
        const [request] = args; const started = performance.now();
        let raw: unknown;
        try {
          raw = await provider.generate(...args);
        } catch (error) {
          const ms = Math.round(performance.now() - started);
          later(() => explorerConversationDebugLog("guide_reply", { sendId, invocationId: String(request.invocationId).slice(0, 40),
            mode: String(request.mode).slice(0, 40), ms, rule: "provider_error", error: errorCode(error) }));
          throw error;
        }
        const ms = Math.round(performance.now() - started);
        later(() => explorerConversationDebugLog("guide_reply", { sendId, invocationId: String(request.invocationId).slice(0, 40),
          mode: String(request.mode).slice(0, 40), ms, ...describeExplorerSafetyReply(raw, request.mode), raw: boundedDebugText(raw) }));
        return raw;
      } }) }),
  });
}
