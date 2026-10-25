import "server-only";
import { createHash } from "node:crypto";
import { types } from "node:util";
import {
  bindMethodologySafetyScreenSubject,
  parseMethodologySafetyScreenResult,
  type BoundMethodologySafetyScreenSubject,
  type MethodologySafetyScreenFinding,
} from "./methodologySafetyScreenContract";

export type MethodologyScreeningActor = Readonly<{ accountId: string; applicationSessionId: string }>;
export type MethodologyScreeningReadInput = Readonly<{
  actor: MethodologyScreeningActor; packId: string; versionId: string; expectedGuideId: string;
}>;
export type MethodologyScreeningDraft = Readonly<{
  packId: string; versionId: string; scopeType: "guide"; scopeId: string;
  packStatus: "draft" | "active"; createdByAccountId: string;
  createdByActorType: "admin"; createdByRoleContext: "admin";
  approvalStatus: "draft"; content: string; contentSha256: string;
}>;
export type MethodologyScreeningPrepareParameters = Readonly<{
  p_actor_user_account_id: string; p_user_session_id: string; p_operation_id: string;
  p_methodology_context_pack_id: string; p_methodology_context_pack_version_id: string;
  p_screen_invocation_id: string; p_content_sha256: string; p_policy_version: string;
  p_policy_manifest_sha256: string; p_request_sha256: string;
}>;
export type MethodologyScreeningPersistenceResult = Readonly<{
  result: "pass" | "review" | "fail"; subject_sha256: string;
  findings: ReadonlyArray<MethodologySafetyScreenFinding>;
}>;
export type MethodologyScreeningSettleParameters = Readonly<{
  p_screen_operation_id: string; p_screen_invocation_id: string;
  p_methodology_context_pack_version_id: string; p_subject_sha256: string;
  p_request_sha256: string; p_terminal_status: "completed" | "failed" | "canceled";
  p_result: MethodologyScreeningPersistenceResult | null;
}>;
export type MethodologyScreeningRepository = Readonly<{
  readOwnedDraft: (input: MethodologyScreeningReadInput, signal?: AbortSignal) => Promise<unknown>;
  prepare: (parameters: MethodologyScreeningPrepareParameters, signal?: AbortSignal) => Promise<unknown>;
  settle: (parameters: MethodologyScreeningSettleParameters, signal?: AbortSignal) => Promise<unknown>;
}>;
export type MethodologyScreeningRequest = Readonly<{
  task: "methodology_safety_screen"; protocolVersion: "methodology-safety-screen.v1";
  providerName: "openai"; modelName: "gpt-5.6-luna";
  policyVersion: string; policyManifestSha256: string;
  operationId: string; invocationId: string; packId: string; versionId: string;
  subjectSha256: string; requestSha256: string; requestBody: string;
}>;
export type MethodologyScreeningRunResult = Readonly<
  | { status: "completed"; screenResult: "pass" | "review" | "fail" }
  | { status: "failed" | "canceled" | "not_dispatched" | "unavailable" | "unconfirmed" }
>;

type BuildInput = Readonly<{
  subject: BoundMethodologySafetyScreenSubject;
  task: "methodology_safety_screen"; protocolVersion: "methodology-safety-screen.v1";
  providerName: "openai"; modelName: "gpt-5.6-luna";
  policyVersion: string; policyManifestSha256: string;
}>;
type Configuration = Readonly<{ policyVersion: string; policyManifestSha256: string; transportTimeoutMilliseconds: number }>;
type RunInput = MethodologyScreeningReadInput & Readonly<{ operationId: string; invocationId: string; signal?: AbortSignal }>;
type Execute = (request: MethodologyScreeningRequest, signal: AbortSignal) => Promise<unknown>;
const UNAVAILABLE = "methodology_screening_unavailable";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9A-F]{64}$/;
const LABEL = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const FIXED = Object.freeze({ task: "methodology_safety_screen", protocolVersion: "methodology-safety-screen.v1",
  providerName: "openai", modelName: "gpt-5.6-luna" } as const);

function unavailable(): never { throw new Error(UNAVAILABLE); }
function record(input: unknown, keys: readonly string[]): Record<string, unknown> {
  if (input === null || typeof input !== "object" || types.isProxy(input) || Array.isArray(input)) unavailable();
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) unavailable();
  const ownKeys = Reflect.ownKeys(input);
  if (ownKeys.length !== keys.length || ownKeys.some(key => typeof key !== "string" || !keys.includes(key))) unavailable();
  const copied: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) unavailable();
    copied[key] = descriptor.value;
  }
  return copied;
}
function uuid(input: unknown): string {
  if (typeof input !== "string" || !UUID.test(input)) unavailable();
  return input;
}
function capability(input: unknown): (...args: never[]) => unknown {
  if (typeof input !== "function" || types.isProxy(input)) unavailable();
  return input as (...args: never[]) => unknown;
}
function promised(input: unknown): Promise<unknown> {
  // Validate the immediate capability return before await can consult then or
  // constructor. Work already started/resolved inside a trusted capability is
  // outside this guard; operational ports must honor their Promise contract.
  if (!types.isPromise(input) || Object.getPrototypeOf(input) !== Promise.prototype) unavailable();
  const constructor = Object.getOwnPropertyDescriptor(input, "constructor");
  if (constructor && (!("value" in constructor) || constructor.value !== Promise)) unavailable();
  if (Object.getOwnPropertyDescriptor(input, "then")) unavailable();
  return input as Promise<unknown>;
}
function aborted(signal: AbortSignal | undefined): boolean {
  if (signal === undefined) return false;
  if (types.isProxy(signal)) unavailable();
  const getter = Object.getOwnPropertyDescriptor(AbortSignal.prototype, "aborted")?.get;
  if (!getter) unavailable();
  // The native getter checks the actual signal brand, without consulting a
  // caller-owned `aborted` accessor or relying on a mutable signal prototype.
  return getter.call(signal) as boolean;
}
function configuration(input: unknown): Configuration {
  const value = record(input, ["policyVersion", "policyManifestSha256", "transportTimeoutMilliseconds"]);
  if (typeof value.policyVersion !== "string" || !LABEL.test(value.policyVersion) ||
      typeof value.policyManifestSha256 !== "string" || !SHA256.test(value.policyManifestSha256) ||
      typeof value.transportTimeoutMilliseconds !== "number" || !Number.isSafeInteger(value.transportTimeoutMilliseconds) ||
      value.transportTimeoutMilliseconds < 10 || value.transportTimeoutMilliseconds > 60_000) unavailable();
  return Object.freeze({ policyVersion: value.policyVersion, policyManifestSha256: value.policyManifestSha256,
    transportTimeoutMilliseconds: value.transportTimeoutMilliseconds });
}
function runInput(input: unknown): RunInput {
  if (input === null || typeof input !== "object" || types.isProxy(input)) unavailable();
  const hasSignal = Reflect.ownKeys(input).includes("signal");
  const value = record(input, ["actor", "packId", "versionId", "expectedGuideId", "operationId", "invocationId", ...(hasSignal ? ["signal"] : [])]);
  const actor = record(value.actor, ["accountId", "applicationSessionId"]);
  const signal = value.signal as AbortSignal | undefined;
  aborted(signal);
  return Object.freeze({ actor: Object.freeze({ accountId: uuid(actor.accountId), applicationSessionId: uuid(actor.applicationSessionId) }),
    packId: uuid(value.packId), versionId: uuid(value.versionId), expectedGuideId: uuid(value.expectedGuideId),
    operationId: uuid(value.operationId), invocationId: uuid(value.invocationId), ...(signal === undefined ? {} : { signal }) });
}
function draftSubject(input: unknown, expected: RunInput): BoundMethodologySafetyScreenSubject {
  const value = record(input, ["packId", "versionId", "scopeType", "scopeId", "packStatus", "createdByAccountId",
    "createdByActorType", "createdByRoleContext", "approvalStatus", "content", "contentSha256"]);
  if (value.packId !== expected.packId || value.versionId !== expected.versionId || value.scopeType !== "guide" ||
      value.scopeId !== expected.expectedGuideId || !["draft", "active"].includes(value.packStatus as string) ||
      value.createdByAccountId !== expected.actor.accountId || value.createdByActorType !== "admin" ||
      value.createdByRoleContext !== "admin" || value.approvalStatus !== "draft" ||
      typeof value.contentSha256 !== "string" || !SHA256.test(value.contentSha256)) unavailable();
  const subject = bindMethodologySafetyScreenSubject({ methodologyContextPackVersionId: expected.versionId, content: value.content });
  if (subject.subjectSha256 !== value.contentSha256) unavailable();
  return subject;
}
function requestBody(input: unknown): string {
  // Do not await, inspect `then`, normalize, parse JSON or invent a schema.
  if (typeof input !== "string" || input.length === 0 || new TextEncoder().encode(input).byteLength > 524_288) unavailable();
  for (let index = 0; index < input.length; index += 1) {
    const unit = input.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = input.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) unavailable();
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) unavailable();
  }
  return input;
}
function status(value: Exclude<MethodologyScreeningRunResult["status"], "completed">): MethodologyScreeningRunResult {
  return Object.freeze({ status: value });
}

/**
 * Held composition only: capabilities and policy identity are injected. Their
 * shape/hash proves no approved policy, actual HTTP/model call or semantics.
 * No default source, HTTP adapter, credentials, route or approval exists here.
 */
export function createMethodologyScreeningComposition(input: unknown): Readonly<{
  run: (input: unknown) => Promise<MethodologyScreeningRunResult>;
}> {
  try {
    const factory = record(input, ["repository", "buildRequest", "transport", "configuration"]);
    const repo = record(factory.repository, ["readOwnedDraft", "prepare", "settle"]);
    const transport = record(factory.transport, ["execute"]);
    const read = capability(repo.readOwnedDraft) as MethodologyScreeningRepository["readOwnedDraft"];
    const prepare = capability(repo.prepare) as MethodologyScreeningRepository["prepare"];
    const settle = capability(repo.settle) as MethodologyScreeningRepository["settle"];
    const execute = capability(transport.execute) as Execute;
    const build = capability(factory.buildRequest) as (input: BuildInput) => unknown;
    const config = configuration(factory.configuration);
    return Object.freeze({ run: async (raw: unknown): Promise<MethodologyScreeningRunResult> => {
      let request: RunInput;
      try { request = runInput(raw); } catch { return status("unavailable"); }
      if (aborted(request.signal)) return status("canceled");
      let subject: BoundMethodologySafetyScreenSubject;
      let outgoing: MethodologyScreeningRequest;
      try {
        const readInput = Object.freeze({ actor: request.actor, packId: request.packId, versionId: request.versionId,
          expectedGuideId: request.expectedGuideId });
        const rawDraft = await promised(read(readInput, request.signal));
        if (aborted(request.signal)) return status("canceled");
        subject = draftSubject(rawDraft, request);
        const body = requestBody(build(Object.freeze({ subject, ...FIXED, policyVersion: config.policyVersion,
          policyManifestSha256: config.policyManifestSha256 })));
        if (aborted(request.signal)) return status("canceled");
        outgoing = Object.freeze({ ...FIXED, policyVersion: config.policyVersion, policyManifestSha256: config.policyManifestSha256,
          operationId: request.operationId, invocationId: request.invocationId, packId: request.packId, versionId: request.versionId,
          subjectSha256: subject.subjectSha256, requestSha256: createHash("sha256").update(body, "utf8").digest("hex").toUpperCase(), requestBody: body });
      } catch { return status(aborted(request.signal) ? "canceled" : "unavailable"); }
      try {
        const receipt = record(await promised(prepare(Object.freeze({
          p_actor_user_account_id: request.actor.accountId, p_user_session_id: request.actor.applicationSessionId,
          p_operation_id: request.operationId, p_methodology_context_pack_id: request.packId,
          p_methodology_context_pack_version_id: request.versionId, p_screen_invocation_id: request.invocationId,
          p_content_sha256: outgoing.subjectSha256, p_policy_version: config.policyVersion,
          p_policy_manifest_sha256: config.policyManifestSha256, p_request_sha256: outgoing.requestSha256,
        }), request.signal)), ["outcome", "screen_invocation_id", "dispatch_permitted"]);
        if (receipt.screen_invocation_id !== request.invocationId) return status("unavailable");
        if (receipt.outcome === "exact_replay" && receipt.dispatch_permitted === false) return status("not_dispatched");
        if (receipt.outcome !== "ok" || receipt.dispatch_permitted !== true) return status("unavailable");
      } catch { return status("unavailable"); }

      let terminal: "completed" | "failed" | "canceled" = "failed";
      let result: MethodologyScreeningPersistenceResult | null = null;
      if (aborted(request.signal)) {
        terminal = "canceled";
      } else {
        const controller = new AbortController();
        let timedOut = false;
        const cancel = () => controller.abort();
        if (request.signal) EventTarget.prototype.addEventListener.call(request.signal, "abort", cancel, { once: true });
        const timer = setTimeout(() => { timedOut = true; controller.abort(); }, config.transportTimeoutMilliseconds);
        try {
          // A caller may have canceled immediately before listener registration.
          if (aborted(request.signal)) { controller.abort(); terminal = "canceled"; }
          else {
            const body = await promised(execute(outgoing, controller.signal));
            if (aborted(request.signal)) terminal = "canceled";
            else if (!timedOut) {
              const parsed = parseMethodologySafetyScreenResult(body, subject.subject);
              result = Object.freeze({ result: parsed.result, subject_sha256: parsed.subject_sha256, findings: parsed.findings });
              terminal = "completed";
            }
          }
        } catch { terminal = aborted(request.signal) ? "canceled" : "failed"; result = null; }
        finally {
          clearTimeout(timer);
          if (request.signal) EventTarget.prototype.removeEventListener.call(request.signal, "abort", cancel);
        }
      }
      const intent: MethodologyScreeningSettleParameters = Object.freeze({
        p_screen_operation_id: request.operationId, p_screen_invocation_id: request.invocationId,
        p_methodology_context_pack_version_id: request.versionId, p_subject_sha256: outgoing.subjectSha256,
        p_request_sha256: outgoing.requestSha256, p_terminal_status: terminal, p_result: result,
      });
      // This signal is independent of caller cancellation. Await the owned port;
      // timeout is an abort request, not proof that an uncooperative port drained.
      const cleanupSignal = AbortSignal.timeout(12_000);
      try {
        const confirmed = record(await promised(settle(intent, cleanupSignal)), ["outcome"]);
        if (aborted(cleanupSignal) || !["ok", "exact_replay"].includes(confirmed.outcome as string)) return status("unconfirmed");
      } catch { return status("unconfirmed"); }
      return terminal === "completed" && result
        ? Object.freeze({ status: "completed", screenResult: result.result })
        : status(terminal === "canceled" ? "canceled" : "failed");
    } });
  } catch { return unavailable(); }
}
