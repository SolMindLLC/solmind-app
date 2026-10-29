import "server-only";
import { types } from "node:util";
import { parseOpenAiModelName } from "../virtual-guide/openAiModelConfiguration";
import {
  bindMethodologySafetyScreenSubject,
  METHODOLOGY_SAFETY_SCREEN_CRITERIA,
} from "../virtual-guide/methodologySafetyScreenContract";
import type {
  MethodologyScreeningDraft,
  MethodologyScreeningPersistenceResult,
  MethodologyScreeningPrepareParameters,
  MethodologyScreeningReadInput,
  MethodologyScreeningRepository,
  MethodologyScreeningSettleParameters,
} from "../virtual-guide/methodologyScreeningComposition";

const UNAVAILABLE = "methodology_screening_repository_unavailable";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9A-F]{64}$/;
const LABEL = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const PREPARE_KEYS = Object.freeze([
  "p_actor_user_account_id", "p_user_session_id", "p_operation_id", "p_methodology_context_pack_id",
  "p_methodology_context_pack_version_id", "p_screen_invocation_id", "p_content_sha256", "p_policy_version",
  "p_policy_manifest_sha256", "p_request_sha256", "p_model_name",
]);
const SETTLE_KEYS = Object.freeze([
  "p_screen_operation_id", "p_screen_invocation_id", "p_methodology_context_pack_version_id",
  "p_subject_sha256", "p_request_sha256", "p_terminal_status", "p_result",
]);
type RpcName = "solmind_read_methodology_version" | "solmind_prepare_methodology_screen" | "solmind_record_methodology_screen";
type Rpc = (name: RpcName, parameters: Readonly<Record<string, unknown>>, signal: AbortSignal) => Promise<unknown>;

const abortedGetter = Object.getOwnPropertyDescriptor(AbortSignal.prototype, "aborted")?.get;
const addListener = EventTarget.prototype.addEventListener;
const removeListener = EventTarget.prototype.removeEventListener;
const abortController = AbortController.prototype.abort;
function unavailable(): never { throw new Error(UNAVAILABLE); }

// Descriptor snapshots never execute caller-owned getters, proxies or toJSON.
function record(input: unknown, keys: readonly string[], exact = true): Record<string, unknown> {
  if (input === null || typeof input !== "object" || types.isProxy(input) || Array.isArray(input)) unavailable();
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) unavailable();
  if (exact) {
    const ownKeys = Reflect.ownKeys(input);
    if (ownKeys.length !== keys.length || ownKeys.some(key => typeof key !== "string" || !keys.includes(key))) unavailable();
  }
  const copy: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const property = Object.getOwnPropertyDescriptor(input, key);
    if (!property || !property.enumerable || !("value" in property)) unavailable();
    copy[key] = property.value;
  }
  return copy;
}
function uuid(input: unknown): string {
  if (typeof input !== "string" || !UUID.test(input)) unavailable();
  return input;
}
function digest(input: unknown): string {
  if (typeof input !== "string" || !SHA256.test(input)) unavailable();
  return input;
}
function aborted(input: unknown): boolean {
  if (input === undefined) return false;
  if (input === null || typeof input !== "object" || types.isProxy(input) || !abortedGetter) unavailable();
  try { return Reflect.apply(abortedGetter, input, []) as boolean; } catch { return unavailable(); }
}
function arrayValues(input: unknown, maximum: number): unknown[] {
  if (!Array.isArray(input) || types.isProxy(input) || Object.getPrototypeOf(input) !== Array.prototype) unavailable();
  const length = Object.getOwnPropertyDescriptor(input, "length");
  if (!length || !("value" in length) || !Number.isSafeInteger(length.value) || length.value < 0 || length.value > maximum) unavailable();
  const keys = Reflect.ownKeys(input);
  if (keys.length !== length.value + 1) unavailable();
  const copy: unknown[] = [];
  for (let index = 0; index < length.value; index += 1) {
    const property = Object.getOwnPropertyDescriptor(input, String(index));
    if (!property || !property.enumerable || !("value" in property)) unavailable();
    copy.push(property.value);
  }
  return copy;
}
function oneRow(response: unknown, keys: readonly string[]): Record<string, unknown> {
  // SDK count/status/statusText are transport details, never projected.
  const envelope = record(response, ["data", "error"], false);
  if (envelope.error !== null) unavailable();
  const rows = arrayValues(envelope.data, 1);
  if (rows.length !== 1) unavailable();
  return record(rows[0], keys);
}
function parseRead(input: unknown): MethodologyScreeningReadInput {
  const raw = record(input, ["actor", "packId", "versionId", "expectedGuideId"]);
  const actor = record(raw.actor, ["accountId", "applicationSessionId"]);
  return Object.freeze({
    actor: Object.freeze({ accountId: uuid(actor.accountId), applicationSessionId: uuid(actor.applicationSessionId) }),
    packId: uuid(raw.packId), versionId: uuid(raw.versionId), expectedGuideId: uuid(raw.expectedGuideId),
  });
}
function parseDraft(row: Record<string, unknown>, expected: MethodologyScreeningReadInput): MethodologyScreeningDraft {
  const root = record(row.version_record, ["packId", "scopeType", "scopeId", "packStatus", "activeVersionId", "version"]);
  if (root.packId !== expected.packId || root.scopeType !== "guide" || root.scopeId !== expected.expectedGuideId ||
      (root.packStatus !== "draft" && root.packStatus !== "active")) unavailable();
  if (root.activeVersionId !== null) uuid(root.activeVersionId);
  if (root.packStatus === "active" && root.activeVersionId === null) unavailable();
  // Only these own data columns are consumed. Other stored columns remain on
  // the privileged SQL side of this projection, including provenance/findings.
  const version = record(root.version, [
    "methodology_context_pack_id", "methodology_context_pack_version_id", "content_markdown", "content_sha256",
    "created_by_user_account_id", "created_by_actor_type", "created_by_role_context", "approval_status",
  ], false);
  if (version.methodology_context_pack_id !== expected.packId || version.methodology_context_pack_version_id !== expected.versionId ||
      version.created_by_user_account_id !== expected.actor.accountId || version.created_by_actor_type !== "admin" ||
      version.created_by_role_context !== "admin" || version.approval_status !== "draft") unavailable();
  const subject = bindMethodologySafetyScreenSubject({ methodologyContextPackVersionId: expected.versionId, content: version.content_markdown });
  const sha = digest(version.content_sha256);
  if (sha !== subject.subjectSha256) unavailable();
  return Object.freeze({
    packId: expected.packId, versionId: expected.versionId, scopeType: "guide", scopeId: expected.expectedGuideId,
    packStatus: root.packStatus, createdByAccountId: expected.actor.accountId, createdByActorType: "admin",
    createdByRoleContext: "admin", approvalStatus: "draft", content: subject.subject.content, contentSha256: sha,
  });
}
function parsePrepare(input: unknown): MethodologyScreeningPrepareParameters {
  const raw = record(input, PREPARE_KEYS);
  const modelName = parseOpenAiModelName(raw.p_model_name);
  if (typeof raw.p_policy_version !== "string" || !LABEL.test(raw.p_policy_version)) unavailable();
  return Object.freeze({
    p_actor_user_account_id: uuid(raw.p_actor_user_account_id), p_user_session_id: uuid(raw.p_user_session_id),
    p_operation_id: uuid(raw.p_operation_id), p_methodology_context_pack_id: uuid(raw.p_methodology_context_pack_id),
    p_methodology_context_pack_version_id: uuid(raw.p_methodology_context_pack_version_id), p_screen_invocation_id: uuid(raw.p_screen_invocation_id),
    p_content_sha256: digest(raw.p_content_sha256), p_policy_version: raw.p_policy_version,
    p_policy_manifest_sha256: digest(raw.p_policy_manifest_sha256), p_request_sha256: digest(raw.p_request_sha256), p_model_name: modelName,
  });
}
function snapshotResult(input: unknown, expectedSha: string): MethodologyScreeningPersistenceResult {
  const raw = record(input, ["result", "subject_sha256", "findings"]);
  if (raw.result !== "pass" && raw.result !== "review" && raw.result !== "fail") unavailable();
  const sha = digest(raw.subject_sha256);
  if (sha !== expectedSha) unavailable();
  const findings = arrayValues(raw.findings, 16).map(inputFinding => {
    const finding = record(inputFinding, ["criterion", "severity", "excerpt", "explanation"]);
    const criterion = METHODOLOGY_SAFETY_SCREEN_CRITERIA.find(allowed => allowed === finding.criterion);
    if (!criterion || (finding.severity !== "review" && finding.severity !== "fail") ||
        typeof finding.excerpt !== "string" || finding.excerpt.length === 0 || finding.excerpt.length > 512 ||
        typeof finding.explanation !== "string" || finding.explanation.length === 0 || finding.explanation.length > 768) unavailable();
    return Object.freeze({ criterion, severity: finding.severity, excerpt: finding.excerpt, explanation: finding.explanation });
  });
  // Exact source citations, unsafe-text and outcome coherence are already owned
  // by the banked parser and SQL. This port cannot invent a replacement subject.
  return Object.freeze({ result: raw.result, subject_sha256: sha, findings: Object.freeze(findings) });
}
function parseSettle(input: unknown): MethodologyScreeningSettleParameters {
  const raw = record(input, SETTLE_KEYS);
  if (raw.p_terminal_status !== "completed" && raw.p_terminal_status !== "failed" && raw.p_terminal_status !== "canceled") unavailable();
  const sha = digest(raw.p_subject_sha256);
  if (raw.p_terminal_status !== "completed" && raw.p_result !== null) unavailable();
  return Object.freeze({
    p_screen_operation_id: uuid(raw.p_screen_operation_id), p_screen_invocation_id: uuid(raw.p_screen_invocation_id),
    p_methodology_context_pack_version_id: uuid(raw.p_methodology_context_pack_version_id), p_subject_sha256: sha,
    p_request_sha256: digest(raw.p_request_sha256), p_terminal_status: raw.p_terminal_status,
    p_result: raw.p_terminal_status === "completed" ? snapshotResult(raw.p_result, sha) : null,
  });
}

// A capability promises an ordinary native Promise, not an executable thenable
// or Promise subclass. Reject accessors before await can consult constructor.
function promised(input: unknown): Promise<unknown> {
  if (!types.isPromise(input) || Object.getPrototypeOf(input) !== Promise.prototype) unavailable();
  const constructor = Object.getOwnPropertyDescriptor(input, "constructor");
  if (constructor && (!("value" in constructor) || constructor.value !== Promise)) unavailable();
  if (Object.getOwnPropertyDescriptor(input, "then")) unavailable();
  return input as Promise<unknown>;
}

async function callRpc<T>(rpc: Rpc, name: RpcName, parameters: Readonly<Record<string, unknown>>,
  project: (response: unknown) => T, caller?: AbortSignal): Promise<T> {
  if (aborted(caller)) unavailable();
  const timeout = AbortSignal.timeout(12_000);
  const controller = new AbortController();
  const sources: AbortSignal[] = [];
  const onAbort = () => { Reflect.apply(abortController, controller, []); };
  try {
    // Prototype methods and native getter bypass caller-overridden methods and
    // accessors. The port sees a fresh native signal and no private abort reason.
    for (const source of caller === undefined ? [timeout] : [caller, timeout]) {
      aborted(source);
      Reflect.apply(addListener, source, ["abort", onAbort, { once: true }]);
      sources.push(source);
      if (aborted(source)) onAbort();
    }
    if (aborted(controller.signal)) unavailable();
    const pending = promised(rpc(name, parameters, controller.signal));
    const response = await pending; // Drain owned work; never Promise.race-return.
    if (aborted(controller.signal)) unavailable();
    // Project inside this await boundary: never return an uninspected SDK object
    // through a second Promise resolution/thenable-assimilation boundary.
    return project(response);
  } finally {
    for (const source of sources) Reflect.apply(removeListener, source, ["abort", onAbort]);
  }
}

/** Held three-RPC capability only. No default SDK adapter, table/query access,
 * credentials, Auth lookup, provider, policy, retry, telemetry or runtime wiring. */
export function createMethodologyScreeningRepository(capability: unknown): MethodologyScreeningRepository {
  try {
    const source = record(capability, ["rpc"]);
    if (typeof source.rpc !== "function" || types.isProxy(source.rpc)) unavailable();
    const rpc = source.rpc as Rpc;
    return Object.freeze({
      readOwnedDraft: async (input: MethodologyScreeningReadInput, signal?: AbortSignal) => {
        try {
          const request = parseRead(input);
          return await callRpc(rpc, "solmind_read_methodology_version", Object.freeze({
            p_actor_user_account_id: request.actor.accountId, p_user_session_id: request.actor.applicationSessionId,
            p_methodology_context_pack_id: request.packId, p_methodology_context_pack_version_id: request.versionId,
          }), response => parseDraft(oneRow(response, ["version_record"]), request), signal);
        } catch { return unavailable(); }
      },
      prepare: async (input: MethodologyScreeningPrepareParameters, signal?: AbortSignal) => {
        try {
          const parameters = parsePrepare(input);
          return await callRpc(rpc, "solmind_prepare_methodology_screen", parameters, response => {
            const row = oneRow(response, ["outcome", "screen_invocation_id", "dispatch_permitted"]);
            if (row.screen_invocation_id !== parameters.p_screen_invocation_id ||
                !((row.outcome === "ok" && row.dispatch_permitted === true) ||
                  (row.outcome === "exact_replay" && row.dispatch_permitted === false))) unavailable();
            return Object.freeze({ outcome: row.outcome, screen_invocation_id: parameters.p_screen_invocation_id, dispatch_permitted: row.dispatch_permitted });
          }, signal);
        } catch { return unavailable(); }
      },
      settle: async (input: MethodologyScreeningSettleParameters, signal?: AbortSignal) => {
        try {
          const parameters = parseSettle(input);
          return await callRpc(rpc, "solmind_record_methodology_screen", parameters, response => {
            const row = oneRow(response, ["outcome"]);
            if (row.outcome !== "ok" && row.outcome !== "exact_replay") unavailable();
            return Object.freeze({ outcome: row.outcome });
          }, signal);
        } catch { return unavailable(); }
      },
    });
  } catch { return unavailable(); }
}
