import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMethodologyScreeningComposition,
  type MethodologyScreeningDraft,
  type MethodologyScreeningRepository,
  type MethodologyScreeningRequest,
} from "./methodologyScreeningComposition";

// Synthetic ports only: no SDK, database, actual screen, human approval, HTTP,
// credentials or operational policy/prompt/schema is used or implied here.
const id = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const PRIVATE = "SYNTHETIC_PRIVATE_SCREEN_DETAIL";
const CONTENT = "Synthetic method: preserve Explorer agency.";
const SHA = createHash("sha256").update(CONTENT, "utf8").digest("hex").toUpperCase();
const BODY = "  SYNTHETIC_OPAQUE_REQUEST\r\nnot an approved API payload  ";
const bodySha = createHash("sha256").update(BODY, "utf8").digest("hex").toUpperCase();
const runInput = () => ({ actor: { accountId: id(1), applicationSessionId: id(2) }, packId: id(3), versionId: id(4),
  expectedGuideId: id(5), operationId: id(6), invocationId: id(7) });
function draft(): MethodologyScreeningDraft {
  return { packId: id(3), versionId: id(4), scopeType: "guide", scopeId: id(5), packStatus: "draft",
    createdByAccountId: id(1), createdByActorType: "admin", createdByRoleContext: "admin", approvalStatus: "draft",
    content: CONTENT, contentSha256: SHA };
}
const pass = () => ({ result: "pass", subject_sha256: SHA, findings: [] });
const fresh = () => ({ outcome: "ok", screen_invocation_id: id(7), dispatch_permitted: true });
type Execute = (request: MethodologyScreeningRequest, signal: AbortSignal) => Promise<unknown>;
function fixture(timeout = 1000, modelName = "gpt-5.6-luna") {
  const events: string[] = [];
  const read = vi.fn<MethodologyScreeningRepository["readOwnedDraft"]>().mockImplementation(async () => { events.push("read"); return draft(); });
  const prepare = vi.fn<MethodologyScreeningRepository["prepare"]>().mockImplementation(async () => { events.push("prepare"); return fresh(); });
  const execute = vi.fn<Execute>().mockImplementation(async () => { events.push("execute"); return pass(); });
  const settle = vi.fn<MethodologyScreeningRepository["settle"]>().mockImplementation(async () => { events.push("settle"); return { outcome: "ok" }; });
  const build = vi.fn<(input: unknown) => unknown>().mockImplementation(() => { events.push("build"); return BODY; });
  const factory = { repository: { readOwnedDraft: read, prepare, settle }, buildRequest: build, transport: { execute },
    configuration: { modelName, policyVersion: "synthetic-policy.v1", policyManifestSha256: "A".repeat(64), transportTimeoutMilliseconds: timeout } };
  const composition = createMethodologyScreeningComposition(factory);
  return { events, read, prepare, execute, settle, build, factory, composition };
}
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (value: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function flush() { for (let index = 0; index < 12; index += 1) await Promise.resolve(); }
function noDispatch(f: ReturnType<typeof fixture>) {
  expect(f.execute).not.toHaveBeenCalled(); expect(f.settle).not.toHaveBeenCalled();
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("held methodology screening composition with synthetic capabilities", () => {
  it("reads, builds, prepares, executes and confirms exactly one bound terminal result in order", async () => {
    const f = fixture(); const result = await f.composition.run(runInput());
    expect(result).toEqual({ status: "completed", screenResult: "pass" }); expect(Object.isFrozen(result)).toBe(true);
    expect(f.events).toEqual(["read", "build", "prepare", "execute", "settle"]);
    expect(Object.keys(f.composition)).toEqual(["run"]); expect(Object.isFrozen(f.composition)).toBe(true);
    expect(f.read).toHaveBeenCalledExactlyOnceWith({ actor: runInput().actor, packId: id(3), versionId: id(4), expectedGuideId: id(5) }, undefined);
    expect(f.prepare.mock.calls[0][0]).toEqual({
      p_actor_user_account_id: id(1), p_user_session_id: id(2), p_operation_id: id(6),
      p_methodology_context_pack_id: id(3), p_methodology_context_pack_version_id: id(4), p_screen_invocation_id: id(7),
      p_content_sha256: SHA, p_policy_version: "synthetic-policy.v1", p_policy_manifest_sha256: "A".repeat(64), p_request_sha256: bodySha, p_model_name: "gpt-5.6-luna",
    });
    const builder = f.build.mock.calls[0][0] as { subject: { subject: object; subjectSha256: string } };
    expect(builder).toEqual({ subject: { subject: { methodologyContextPackVersionId: id(4), content: CONTENT }, subjectSha256: SHA },
      task: "methodology_safety_screen", protocolVersion: "methodology-safety-screen.v1", providerName: "openai", modelName: "gpt-5.6-luna",
      policyVersion: "synthetic-policy.v1", policyManifestSha256: "A".repeat(64) });
    expect(Object.isFrozen(builder)).toBe(true); expect(Object.isFrozen(builder.subject)).toBe(true);
    expect(Object.isFrozen(builder.subject.subject)).toBe(true);
    const [request, transportSignal] = f.execute.mock.calls[0];
    expect(request).toEqual({ task: "methodology_safety_screen", protocolVersion: "methodology-safety-screen.v1",
      providerName: "openai", modelName: "gpt-5.6-luna", policyVersion: "synthetic-policy.v1", policyManifestSha256: "A".repeat(64),
      operationId: id(6), invocationId: id(7), packId: id(3), versionId: id(4), subjectSha256: SHA, requestSha256: bodySha, requestBody: BODY });
    expect(Object.isFrozen(request)).toBe(true); expect(transportSignal).toBeInstanceOf(AbortSignal);
    const [intent, cleanup] = f.settle.mock.calls[0];
    expect(Object.keys(intent)).toHaveLength(7); expect(Object.isFrozen(intent)).toBe(true);
    expect(intent).toEqual({ p_screen_operation_id: id(6), p_screen_invocation_id: id(7), p_methodology_context_pack_version_id: id(4),
      p_subject_sha256: SHA, p_request_sha256: bodySha, p_terminal_status: "completed", p_result: pass() });
    expect(Object.keys(intent.p_result!)).toEqual(["result", "subject_sha256", "findings"]);
    expect(Object.isFrozen(intent.p_result)).toBe(true); expect(Object.isFrozen(intent.p_result?.findings)).toBe(true);
    expect(intent.p_result).not.toHaveProperty("methodologyContextPackVersionId"); expect(cleanup).toBeInstanceOf(AbortSignal);
    expect(cleanup).not.toBe(transportSignal);
    expect(JSON.stringify(result)).not.toContain(CONTENT); expect(JSON.stringify(result)).not.toContain(SHA);
  });

  it("captures one configured model through builder bytes, hash, preparation and execution", async () => {
    const modelName = "synthetic-screen-model.v2"; const f = fixture(1000, modelName);
    const body = JSON.stringify({ model: modelName, test: "synthetic-only" });
    f.build.mockImplementation(input => JSON.stringify({ model: (input as { modelName: string }).modelName, test: "synthetic-only" }));
    f.factory.configuration.modelName = "changed-after-construction";
    expect(await f.composition.run(runInput())).toEqual({ status: "completed", screenResult: "pass" });
    expect(f.build.mock.calls[0][0]).toMatchObject({ modelName });
    const expectedSha = createHash("sha256").update(body, "utf8").digest("hex").toUpperCase();
    expect(f.prepare.mock.calls[0][0]).toMatchObject({ p_model_name: modelName, p_request_sha256: expectedSha });
    expect(f.execute.mock.calls[0][0]).toMatchObject({ modelName, requestBody: body, requestSha256: expectedSha });
    expect(f.execute).toHaveBeenCalledTimes(1);
  });

  it("requires an explicit configured model instead of inventing a default", () => {
    const f = fixture(); const withoutModel: Partial<typeof f.factory.configuration> = { ...f.factory.configuration }; delete withoutModel.modelName;
    expect(() => createMethodologyScreeningComposition({ ...f.factory, configuration: withoutModel })).toThrow("methodology_screening_unavailable");
    expect(f.read).not.toHaveBeenCalled(); expect(f.prepare).not.toHaveBeenCalled(); noDispatch(f);
  });
  it.each(["review", "fail"] as const)("distinguishes completed model %s from execution failure", async result => {
    const f = fixture(); const severity = result === "review" ? "review" : "fail";
    f.execute.mockResolvedValueOnce({ result, subject_sha256: SHA, findings: [
      { criterion: "dependency", severity, excerpt: "Explorer agency", explanation: "Synthetic finding for structural proof only." },
    ] });
    expect(await f.composition.run(runInput())).toEqual({ status: "completed", screenResult: result });
    expect(f.settle.mock.calls[0][0].p_terminal_status).toBe("completed");
    expect(f.settle.mock.calls[0][0].p_result?.result).toBe(result);
  });

  it.each(["ok", "exact_replay"])("accepts only a closed %s terminal acknowledgment", async outcome => {
    const f = fixture(); f.settle.mockResolvedValueOnce({ outcome });
    expect(await f.composition.run(runInput())).toEqual({ status: "completed", screenResult: "pass" });
    expect(f.settle).toHaveBeenCalledTimes(1);
  });

  it("has no preparation or transport while the owned draft read remains pending", async () => {
    const f = fixture(); const read = deferred<unknown>(); f.read.mockReturnValueOnce(read.promise);
    const pending = f.composition.run(runInput()); await flush();
    expect(f.build).not.toHaveBeenCalled(); expect(f.prepare).not.toHaveBeenCalled(); noDispatch(f);
    read.resolve(draft()); await pending; expect(f.execute).toHaveBeenCalledOnce();
  });

  it("never dispatches before a committed fresh preparation receipt", async () => {
    const f = fixture(); const prepared = deferred<unknown>(); f.prepare.mockReturnValueOnce(prepared.promise);
    const pending = f.composition.run(runInput()); await flush(); noDispatch(f);
    prepared.resolve(fresh()); expect(await pending).toEqual({ status: "completed", screenResult: "pass" });
  });

  it("honors exact replay without provider execution, settlement or attempt takeover", async () => {
    const f = fixture(); f.prepare.mockResolvedValueOnce({ outcome: "exact_replay", screen_invocation_id: id(7), dispatch_permitted: false });
    expect(await f.composition.run(runInput())).toEqual({ status: "not_dispatched" }); noDispatch(f);
  });

  it("concurrent callers respect fresh versus replay receipts and only one executes/settles", async () => {
    const f = fixture(); f.prepare.mockResolvedValueOnce(fresh())
      .mockResolvedValueOnce({ outcome: "exact_replay", screen_invocation_id: id(7), dispatch_permitted: false });
    const results = await Promise.all([f.composition.run(runInput()), f.composition.run(runInput())]);
    expect(results).toEqual([{ status: "completed", screenResult: "pass" }, { status: "not_dispatched" }]);
    expect(f.prepare).toHaveBeenCalledTimes(2); expect(f.execute).toHaveBeenCalledTimes(1); expect(f.settle).toHaveBeenCalledTimes(1);
  });

  it.each([null, {}, { ...fresh(), dispatch_permitted: false },
    { outcome: "exact_replay", screen_invocation_id: id(7), dispatch_permitted: true },
    { ...fresh(), screen_invocation_id: id(99) }, { ...fresh(), extra: true }, { ...fresh(), outcome: "denied" },
  ])("refuses malformed or uncertain preparation without execution/settlement: %#", async receipt => {
    const f = fixture(); f.prepare.mockResolvedValueOnce(receipt);
    expect(await f.composition.run(runInput())).toEqual({ status: "unavailable" }); noDispatch(f);
  });

  it("does not retry or guess settlement after preparation throws an uncertain private error", async () => {
    const f = fixture(); f.prepare.mockRejectedValueOnce(new Error(PRIVATE));
    expect(await f.composition.run(runInput())).toEqual({ status: "unavailable" });
    expect(f.prepare).toHaveBeenCalledTimes(1); noDispatch(f);
  });

  it.each([
    { packId: id(99) }, { versionId: id(99) }, { scopeType: "practice" }, { scopeId: id(99) }, { packStatus: "inactive" },
    { createdByAccountId: id(99) }, { createdByActorType: "guide" }, { createdByRoleContext: "guide" },
    { approvalStatus: "guide_approved" }, { contentSha256: "F".repeat(64) }, { content: ` ${CONTENT}` }, { secret: PRIVATE },
  ])("refuses a wrong owner/role/scope/subject/digest before request construction: %#", async change => {
    const f = fixture(); f.read.mockResolvedValueOnce({ ...draft(), ...change });
    expect(await f.composition.run(runInput())).toEqual({ status: "unavailable" });
    expect(f.build).not.toHaveBeenCalled(); expect(f.prepare).not.toHaveBeenCalled(); noDispatch(f);
  });

  it("allows a draft version within the same active pack without approving it", async () => {
    const f = fixture(); f.read.mockResolvedValueOnce({ ...draft(), packStatus: "active" });
    expect(await f.composition.run(runInput())).toEqual({ status: "completed", screenResult: "pass" });
    expect(f.events).not.toContain("approve");
  });

  it.each([null, "", "isolated\ud800", "isolated\udc00", "x".repeat(524_289), Promise.resolve("asynchronous body")])(
    "rejects an invalid/asynchronous builder output without preparation: %#", async body => {
      const f = fixture(); f.build.mockReturnValueOnce(body);
      expect(await f.composition.run(runInput())).toEqual({ status: "unavailable" }); expect(f.prepare).not.toHaveBeenCalled(); noDispatch(f);
    });

  it("does not assimilate a builder thenable or execute its getter", async () => {
    const getter = vi.fn(() => { throw new Error(PRIVATE); }); const thenable = Object.defineProperty({}, "then", { get: getter });
    const f = fixture(); f.build.mockReturnValueOnce(thenable);
    expect(await f.composition.run(runInput())).toEqual({ status: "unavailable" });
    expect(getter.mock.calls.length).toBe(0); expect(f.prepare).not.toHaveBeenCalled(); noDispatch(f);
  });

  it("preserves opaque non-JSON request bytes, valid surrogate pairs and the exact UTF8 cap", async () => {
    const f = fixture(); const body = "\u{1f331}".repeat(131_072); f.build.mockReturnValueOnce(body);
    expect(await f.composition.run(runInput())).toEqual({ status: "completed", screenResult: "pass" });
    expect(f.execute.mock.calls[0][0].requestBody).toBe(body);
    expect(f.execute.mock.calls[0][0].requestSha256).toBe(createHash("sha256").update(body, "utf8").digest("hex").toUpperCase());
  });

  it("captures every capability/configuration and run identity before the first await", async () => {
    const f = fixture(); const read = deferred<unknown>(); f.read.mockReturnValueOnce(read.promise);
    const input = runInput(); const pending = f.composition.run(input);
    input.actor.accountId = id(99); input.packId = id(99);
    f.factory.configuration.modelName = "changed-after-start"; f.factory.configuration.policyVersion = "changed-after-start"; f.factory.configuration.policyManifestSha256 = "B".repeat(64);
    f.factory.buildRequest = vi.fn<(input: unknown) => unknown>().mockReturnValue(PRIVATE);
    f.factory.repository.prepare = vi.fn<MethodologyScreeningRepository["prepare"]>().mockRejectedValue(new Error(PRIVATE));
    f.factory.transport.execute = vi.fn<Execute>().mockRejectedValue(new Error(PRIVATE));
    f.factory.repository.settle = vi.fn<MethodologyScreeningRepository["settle"]>().mockRejectedValue(new Error(PRIVATE));
    read.resolve(draft());
    expect(await pending).toEqual({ status: "completed", screenResult: "pass" });
    expect(f.prepare.mock.calls[0][0].p_actor_user_account_id).toBe(id(1));
    expect(f.execute.mock.calls[0][0].policyVersion).toBe("synthetic-policy.v1");
    expect(f.execute.mock.calls[0][0].modelName).toBe("gpt-5.6-luna");
    expect(f.prepare.mock.calls[0][0].p_model_name).toBe("gpt-5.6-luna");
    expect(f.execute.mock.calls[0][0].requestBody).toBe(BODY);
  });

  it("copies the original subject before a later caller-owned draft mutation", async () => {
    const f = fixture(); const row = { ...draft() }; f.read.mockResolvedValueOnce(row);
    f.prepare.mockImplementationOnce(async () => { row.content = PRIVATE; row.contentSha256 = "F".repeat(64); return fresh(); });
    expect(await f.composition.run(runInput())).toEqual({ status: "completed", screenResult: "pass" });
    expect(f.execute.mock.calls[0][0].subjectSha256).toBe(SHA); expect(f.settle.mock.calls[0][0].p_subject_sha256).toBe(SHA);
  });

  it("honors cancellation before any work", async () => {
    const f = fixture(); const caller = new AbortController(); caller.abort();
    expect(await f.composition.run({ ...runInput(), signal: caller.signal })).toEqual({ status: "canceled" });
    expect(f.read).not.toHaveBeenCalled(); expect(f.build).not.toHaveBeenCalled(); expect(f.prepare).not.toHaveBeenCalled(); noDispatch(f);
  });

  it("reads the native cancellation state without invoking a caller-owned aborted getter", async () => {
    const f = fixture(); const caller = new AbortController(); const getter = vi.fn(() => { throw new Error(PRIVATE); });
    caller.abort();
    Object.defineProperty(caller.signal, "aborted", { get: getter });
    expect(await f.composition.run({ ...runInput(), signal: caller.signal })).toEqual({ status: "canceled" });
    expect(getter.mock.calls.length).toBe(0); expect(f.read).not.toHaveBeenCalled(); noDispatch(f);
  });

  it("drains a canceled draft read before returning without a new effect", async () => {
    const f = fixture(); const caller = new AbortController(); const read = deferred<unknown>(); f.read.mockReturnValueOnce(read.promise);
    let finished = false; const pending = f.composition.run({ ...runInput(), signal: caller.signal }).then(value => { finished = true; return value; });
    caller.abort(); await flush(); expect(finished).toBe(false); read.resolve(draft());
    expect(await pending).toEqual({ status: "canceled" }); expect(f.prepare).not.toHaveBeenCalled(); noDispatch(f);
  });

  it("honors a builder-time cancellation before prepare", async () => {
    const f = fixture(); const caller = new AbortController();
    f.build.mockImplementationOnce(() => { caller.abort(); return BODY; });
    expect(await f.composition.run({ ...runInput(), signal: caller.signal })).toEqual({ status: "canceled" });
    expect(f.prepare).not.toHaveBeenCalled(); noDispatch(f);
  });

  it("drains canceled preparation and settles only a confirmed fresh receipt, without executing", async () => {
    const f = fixture(); const caller = new AbortController(); const prepared = deferred<unknown>(); f.prepare.mockReturnValueOnce(prepared.promise);
    const pending = f.composition.run({ ...runInput(), signal: caller.signal }); await flush(); caller.abort();
    noDispatch(f); prepared.resolve(fresh()); expect(await pending).toEqual({ status: "canceled" });
    expect(f.execute).not.toHaveBeenCalled(); expect(f.settle.mock.calls[0][0].p_terminal_status).toBe("canceled");
    expect(f.settle.mock.calls[0][0].p_result).toBeNull(); expect(f.settle.mock.calls[0][1]).not.toBe(caller.signal);
    expect(f.settle.mock.calls[0][1]?.aborted).toBe(false);
  });

  it("uncertain preparation remains unavailable even after caller cancellation", async () => {
    const f = fixture(); const caller = new AbortController(); const prepared = deferred<unknown>(); f.prepare.mockReturnValueOnce(prepared.promise);
    const pending = f.composition.run({ ...runInput(), signal: caller.signal }); await flush(); caller.abort(); prepared.reject(new Error(PRIVATE));
    expect(await pending).toEqual({ status: "unavailable" }); noDispatch(f);
  });

  it.each(["caller", "timeout"] as const)("requests %s abort, drains late finite execution, then settles one immutable null intent", async kind => {
    vi.useFakeTimers(); const f = fixture(10); const caller = new AbortController(); const executed = deferred<unknown>();
    f.execute.mockReturnValueOnce(executed.promise); let finished = false;
    const pending = f.composition.run({ ...runInput(), signal: caller.signal }).then(value => { finished = true; return value; });
    await flush(); expect(f.execute).toHaveBeenCalledTimes(1);
    if (kind === "caller") caller.abort(); else await vi.advanceTimersByTimeAsync(10);
    expect(f.execute.mock.calls[0][1].aborted).toBe(true); expect(finished).toBe(false); expect(f.settle).not.toHaveBeenCalled();
    executed.resolve(pass());
    expect(await pending).toEqual({ status: kind === "caller" ? "canceled" : "failed" });
    const [intent, cleanup] = f.settle.mock.calls[0];
    expect(intent.p_terminal_status).toBe(kind === "caller" ? "canceled" : "failed"); expect(intent.p_result).toBeNull();
    expect(Object.isFrozen(intent)).toBe(true); expect(cleanup).not.toBe(caller.signal); expect(cleanup?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1000); expect(f.execute).toHaveBeenCalledTimes(1); expect(f.settle).toHaveBeenCalledTimes(1);
  });

  it.each([null, {}, { ...pass(), subject_sha256: "F".repeat(64) }, { ...pass(), result: "unknown" },
    { result: "review", subject_sha256: SHA, findings: [] }, { result: "fail", subject_sha256: SHA, findings: [] },
    { ...pass(), extra: PRIVATE }, { status: 200, body: pass() },
  ])("settles malformed/HTTP-envelope/subject-mismatched output as failed, not a model fail: %#", async body => {
    const f = fixture(); f.execute.mockResolvedValueOnce(body);
    expect(await f.composition.run(runInput())).toEqual({ status: "failed" });
    expect(f.settle.mock.calls[0][0].p_terminal_status).toBe("failed"); expect(f.settle.mock.calls[0][0].p_result).toBeNull();
  });

  it("does not execute hostile result getters/proxies and emits only failed/null intent", async () => {
    const getter = vi.fn(() => { throw new Error(PRIVATE); }); const hostile = Object.defineProperty(pass(), "result", { enumerable: true, get: getter });
    const trap = vi.fn(() => { throw new Error(PRIVATE); });
    // Promise delivery must be allowed to probe `then`; parsing remains inert.
    const proxy = new Proxy(pass(), { get: (_target, key) => key === "then" ? undefined : trap(), ownKeys: () => trap() });
    for (const body of [hostile, proxy]) {
      const f = fixture(); f.execute.mockResolvedValueOnce(body);
      expect(await f.composition.run(runInput())).toEqual({ status: "failed" }); expect(f.settle.mock.calls[0][0].p_result).toBeNull();
    }
    expect(getter.mock.calls.length).toBe(0); expect(trap.mock.calls.length).toBe(0);
  });

  it.each(["synchronous", "asynchronous"] as const)("settles %s transport errors once without their private detail", async mode => {
    const f = fixture();
    if (mode === "synchronous") f.execute.mockImplementationOnce(() => { throw new Error(PRIVATE); });
    else f.execute.mockRejectedValueOnce(new Error(PRIVATE));
    const result = await f.composition.run(runInput()); expect(result).toEqual({ status: "failed" });
    expect(JSON.stringify(result)).not.toContain(PRIVATE); expect(f.execute).toHaveBeenCalledTimes(1); expect(f.settle).toHaveBeenCalledTimes(1);
  });

  it.each([null, {}, { outcome: "denied" }, { outcome: "ok", extra: PRIVATE }])("does not claim persistence for malformed settlement: %#", async response => {
    const f = fixture(); f.settle.mockResolvedValueOnce(response);
    expect(await f.composition.run(runInput())).toEqual({ status: "unconfirmed" });
    expect(f.settle).toHaveBeenCalledTimes(1); expect(f.settle.mock.calls[0][0].p_terminal_status).toBe("completed");
    expect(f.execute).toHaveBeenCalledTimes(1);
  });

  it("retains completed intent after settlement throws, without a failed fallback write", async () => {
    const f = fixture(); f.settle.mockRejectedValueOnce(new Error(PRIVATE));
    expect(await f.composition.run(runInput())).toEqual({ status: "unconfirmed" });
    expect(f.settle.mock.calls.map(([intent]) => intent.p_terminal_status)).toEqual(["completed"]);
    expect(f.execute).toHaveBeenCalledTimes(1);
  });

  it("awaits settlement drain and never switches intent when caller cancels during settlement", async () => {
    const f = fixture(); const caller = new AbortController(); const saved = deferred<unknown>(); f.settle.mockReturnValueOnce(saved.promise);
    let finished = false; const pending = f.composition.run({ ...runInput(), signal: caller.signal }).then(value => { finished = true; return value; });
    await flush(); expect(f.settle).toHaveBeenCalledTimes(1); caller.abort(); await flush(); expect(finished).toBe(false);
    expect(f.settle.mock.calls[0][1]?.aborted).toBe(false); saved.resolve({ outcome: "ok" });
    expect(await pending).toEqual({ status: "completed", screenResult: "pass" });
    expect(f.settle.mock.calls.map(([intent]) => intent.p_terminal_status)).toEqual(["completed"]);
  });

  it("returns unconfirmed for a cleanup deadline even if an uncooperative port later claims ok", async () => {
    const cleanup = new AbortController(); vi.spyOn(AbortSignal, "timeout").mockReturnValue(cleanup.signal);
    const f = fixture(); f.settle.mockImplementationOnce(async () => { cleanup.abort(); return { outcome: "ok" }; });
    expect(await f.composition.run(runInput())).toEqual({ status: "unconfirmed" }); expect(f.settle).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed run selectors before any source operation", async () => {
    const getter = vi.fn(() => id(3)); const hostile = Object.defineProperty(runInput(), "packId", { enumerable: true, get: getter });
    for (const input of [null, {}, { ...runInput(), extra: true }, { ...runInput(), packId: "wrong" },
      { ...runInput(), actor: { ...runInput().actor, role: "admin" } },
      { ...runInput(), packId: id(10).toUpperCase() }, { ...runInput(), signal: {} },
      { ...runInput(), signal: Object.create(AbortSignal.prototype) }, hostile]) {
      const f = fixture(); expect(await f.composition.run(input)).toEqual({ status: "unavailable" }); expect(f.read).not.toHaveBeenCalled(); noDispatch(f);
    }
    expect(getter.mock.calls.length).toBe(0);
  });

  it("rejects hostile factory shapes without invoking their executable properties", () => {
    const f = fixture(); const getter = vi.fn(() => f.factory.repository);
    const hostile = Object.defineProperty({ ...f.factory }, "repository", { enumerable: true, get: getter });
    const trap = vi.fn(() => { throw new Error(PRIVATE); });
    const proxy = new Proxy(f.factory, { get: () => trap(), ownKeys: () => trap() });
    const hidden = Object.defineProperty({ ...f.factory }, "hidden", { value: true });
    for (const input of [null, {}, hostile, proxy, hidden, { ...f.factory, extra: true },
      { ...f.factory, repository: { ...f.factory.repository, approve: vi.fn() } },
      { ...f.factory, transport: { ...f.factory.transport, fallback: vi.fn() } }]) {
      let error: unknown; try { createMethodologyScreeningComposition(input); } catch (caught) { error = caught; }
      expect((error as Error).message).toBe("methodology_screening_unavailable"); expect("cause" in (error as Error)).toBe(false);
    }
    expect(getter.mock.calls.length).toBe(0); expect(trap.mock.calls.length).toBe(0);
  });

  it.each([{ modelName: undefined }, { modelName: " gpt-5.6-luna" }, { modelName: "invalid/model" }, { modelName: "gpt-5.6-luna\n" }, { modelName: "x".repeat(121) }, { policyVersion: "" }, { policyVersion: "bad+label" }, { policyVersion: "x".repeat(121) },
    { policyManifestSha256: "a".repeat(64) }, { transportTimeoutMilliseconds: 9 }, { transportTimeoutMilliseconds: 60_001 },
    { transportTimeoutMilliseconds: 10.5 }, { transportTimeoutMilliseconds: undefined }, { approvedPolicy: true },
  ])("rejects invalid configuration without inventing a default: %#", change => {
    const f = fixture(); expect(() => createMethodologyScreeningComposition({ ...f.factory,
      configuration: { ...f.factory.configuration, ...change } })).toThrow("methodology_screening_unavailable");
  });

  it.each(["read", "prepare", "execute", "settle"] as const)("rejects malformed immediate %s Promise returns without executable assimilation", async kind => {
    const expected = kind === "execute" ? "failed" : kind === "settle" ? "unconfirmed" : "unavailable";
    for (const variant of ["then-getter", "then-callback", "constructor-getter", "own-then-getter", "subclass", "proxy"] as const) {
      const f = fixture(); let hostileCalls = 0; let portCalls = 0;
      const payload = kind === "read" ? draft() : kind === "prepare" ? fresh() : kind === "execute" ? pass() : { outcome: "ok" };
      const getter = () => { hostileCalls++; throw new Error(PRIVATE); };
      let value: unknown;
      if (variant === "then-getter") value = Object.defineProperty({}, "then", { get: getter });
      else if (variant === "then-callback") value = { then: (resolve: (raw: unknown) => void) => { hostileCalls++; resolve(payload); } };
      else if (variant === "constructor-getter") value = Object.defineProperty(Promise.resolve(payload), "constructor", { get: getter });
      else if (variant === "own-then-getter") value = Object.defineProperty(Promise.resolve(payload), "then", { get: getter });
      else if (variant === "subclass") { class OtherPromise extends Promise<unknown> {} value = new OtherPromise(resolve => resolve(payload)); }
      else value = new Proxy(Promise.resolve(payload), { get: getter, getPrototypeOf: getter });
      // Plain function: mock instrumentation must not inspect malformed returns first.
      const invalid = () => { portCalls++; return value; };
      const factory = kind === "execute"
        ? { ...f.factory, transport: { execute: invalid } }
        : { ...f.factory, repository: { ...f.factory.repository, [kind === "read" ? "readOwnedDraft" : kind]: invalid } };
      const result = await createMethodologyScreeningComposition(factory).run(runInput());
      expect(result).toEqual({ status: expected }); expect(hostileCalls).toBe(0); expect(portCalls).toBe(1);
      if (kind === "read" || kind === "prepare") noDispatch(f);
      else if (kind === "execute") {
        expect(f.settle).toHaveBeenCalledTimes(1);
        expect(f.settle.mock.calls[0][0]).toMatchObject({ p_terminal_status: "failed", p_result: null });
      } else expect(f.execute).toHaveBeenCalledTimes(1);
    }
  });
});
