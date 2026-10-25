import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMethodologyScreeningRepository } from "../methodologyScreeningRepository";
import { bindMethodologySafetyScreenSubject, parseMethodologySafetyScreenResult } from "../../virtual-guide/methodologySafetyScreenContract";
import type {
  MethodologyScreeningPrepareParameters,
  MethodologyScreeningReadInput,
  MethodologyScreeningSettleParameters,
} from "../../virtual-guide/methodologyScreeningComposition";

// Ordinary Promise-returning RPC-shaped in-memory doubles only. No Supabase
// client, Auth, database, provider, real methodology or external I/O is used.
const id = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const CONTENT = "Synthetic methodology for local repository fixtures only.";
const SHA = createHash("sha256").update(CONTENT, "utf8").digest("hex").toUpperCase();
const PRIVATE = "SYNTHETIC_PRIVATE_DATABASE_DETAIL";
const ERROR = "methodology_screening_repository_unavailable";
const readInput = (): MethodologyScreeningReadInput => ({
  actor: { accountId: id(1), applicationSessionId: id(2) }, packId: id(3), versionId: id(5), expectedGuideId: id(4),
});
const version = () => ({
  methodology_context_pack_id: id(3), methodology_context_pack_version_id: id(5), content_markdown: CONTENT,
  content_sha256: SHA, created_by_user_account_id: id(1), created_by_actor_type: "admin", created_by_role_context: "admin",
  approval_status: "draft", source_provenance: [{ source: PRIVATE }], metadata: { safety_screen: PRIVATE },
  safety_screen_result: null, safety_screen_invocation_id: null, ai_change_summary: PRIVATE,
});
const root = () => ({ packId: id(3), scopeType: "guide", scopeId: id(4), packStatus: "draft", activeVersionId: null, version: version() });
const envelope = (row: unknown) => ({ data: [row], error: null });
const readResponse = () => envelope({ version_record: root() });
const prepareParameters = (): MethodologyScreeningPrepareParameters => ({
  p_actor_user_account_id: id(1), p_user_session_id: id(2), p_operation_id: id(6), p_methodology_context_pack_id: id(3),
  p_methodology_context_pack_version_id: id(5), p_screen_invocation_id: id(7), p_content_sha256: SHA,
  p_policy_version: "synthetic-screen-policy.v1", p_policy_manifest_sha256: "B".repeat(64), p_request_sha256: "C".repeat(64),
});
const prepareResponse = () => envelope({ outcome: "ok", screen_invocation_id: id(7), dispatch_permitted: true });
const settleParameters = (status: "completed" | "failed" | "canceled" = "completed"): MethodologyScreeningSettleParameters => ({
  p_screen_operation_id: id(6), p_screen_invocation_id: id(7), p_methodology_context_pack_version_id: id(5),
  p_subject_sha256: SHA, p_request_sha256: "C".repeat(64), p_terminal_status: status,
  p_result: status === "completed" ? { result: "pass", subject_sha256: SHA, findings: [] } : null,
});
type Rpc = (name: string, parameters: Readonly<Record<string, unknown>>, signal: AbortSignal) => Promise<unknown>;
function fixture(response: unknown = readResponse()) {
  const rpc = vi.fn<Rpc>().mockImplementation(async () => response);
  const capability = { rpc };
  return { rpc, capability, repository: createMethodologyScreeningRepository(capability) };
}
function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<unknown>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function opaque(promise: Promise<unknown>) {
  let error: unknown;
  try { await promise; } catch (caught) { error = caught; }
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe(ERROR);
  expect(String(error)).not.toContain(PRIVATE);
  expect(Object.hasOwn(error as object, "cause")).toBe(false);
}
afterEach(() => { vi.restoreAllMocks(); });

describe("held methodology screening repository: synthetic SQL-shaped capability", () => {
  it("projects an exact own-Admin draft into eleven immutable fields using only four read arguments", async () => {
    const f = fixture(); const timeout = new AbortController();
    const bound = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
    const result = await f.repository.readOwnedDraft(readInput());
    expect(f.rpc).toHaveBeenCalledTimes(1);
    expect(f.rpc.mock.calls[0][0]).toBe("solmind_read_methodology_version");
    expect(f.rpc.mock.calls[0][1]).toEqual({ p_actor_user_account_id: id(1), p_user_session_id: id(2),
      p_methodology_context_pack_id: id(3), p_methodology_context_pack_version_id: id(5) });
    expect(Object.isFrozen(f.rpc.mock.calls[0][1])).toBe(true);
    expect(f.rpc.mock.calls[0][2]).toBeInstanceOf(AbortSignal);
    expect(bound).toHaveBeenCalledExactlyOnceWith(12_000);
    expect(result).toEqual({ packId: id(3), versionId: id(5), scopeType: "guide", scopeId: id(4), packStatus: "draft",
      createdByAccountId: id(1), createdByActorType: "admin", createdByRoleContext: "admin", approvalStatus: "draft", content: CONTENT, contentSha256: SHA });
    expect(Object.keys(result as object)).toHaveLength(11);
    expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(PRIVATE);
    expect(Object.keys(f.repository)).toEqual(["readOwnedDraft", "prepare", "settle"]);
    expect(Object.isFrozen(f.repository)).toBe(true);
  });

  it("supports an own draft in an already-active pack without interpreting pointer shape as approval", async () => {
    const f = fixture(envelope({ version_record: { ...root(), packStatus: "active", activeVersionId: id(9) } }));
    expect(await f.repository.readOwnedDraft(readInput())).toMatchObject({ packStatus: "active", approvalStatus: "draft" });
    expect(f.rpc).toHaveBeenCalledTimes(1);
  });

  it("ignores SDK status/count extras and unselected stored columns without copying them", async () => {
    const f = fixture({ ...readResponse(), status: 200, count: 1, statusText: PRIVATE });
    expect(JSON.stringify(await f.repository.readOwnedDraft(readInput()))).not.toContain(PRIVATE);
  });

  it("captures the rpc function and copies read selectors before the first await", async () => {
    const d = deferred(); const f = fixture(); f.rpc.mockReturnValueOnce(d.promise);
    const replacement = vi.fn<Rpc>();
    const request = { ...readInput(), actor: { ...readInput().actor } };
    f.capability.rpc = replacement;
    const pending = f.repository.readOwnedDraft(request);
    request.packId = id(8); request.actor.accountId = id(9); request.expectedGuideId = id(10);
    d.resolve(readResponse());
    expect(await pending).toMatchObject({ packId: id(3), createdByAccountId: id(1), scopeId: id(4) });
    expect(replacement).not.toHaveBeenCalled(); expect(f.rpc).toHaveBeenCalledTimes(1);
    expect(f.rpc.mock.calls[0][1].p_actor_user_account_id).toBe(id(1));
  });

  it.each([
    ["packId", id(8)], ["scopeType", "practice"], ["scopeId", id(8)], ["packStatus", "archived"],
    ["activeVersionId", "not-a-uuid"], ["activeVersionId", undefined], ["extra", PRIVATE],
  ] as const)("denies mismatched or widened read root field %s", async (field, value) => {
    const f = fixture(envelope({ version_record: { ...root(), [field]: value } }));
    await opaque(f.repository.readOwnedDraft(readInput()));
  });
  it("denies an active pack with no active pointer", async () => {
    await opaque(fixture(envelope({ version_record: { ...root(), packStatus: "active" } })).repository.readOwnedDraft(readInput()));
  });
  it.each([
    ["methodology_context_pack_id", id(8)], ["methodology_context_pack_version_id", id(8)],
    ["created_by_user_account_id", id(8)], ["created_by_actor_type", "guide"],
    ["created_by_actor_type", "system_migration"], ["created_by_role_context", "guide"],
    ["approval_status", "needs_guide_review"], ["approval_status", "guide_approved"],
    ["content_sha256", "F".repeat(64)], ["content_sha256", SHA.toLowerCase()],
    ["content_markdown", "Different subject"], ["content_markdown", ` ${CONTENT}`],
  ] as const)("denies ineligible or incorrectly bound stored version field %s", async (field, value) => {
    await opaque(fixture(envelope({ version_record: { ...root(), version: { ...version(), [field]: value } } })).repository.readOwnedDraft(readInput()));
  });

  it.each([
    null, {}, { data: [], error: null }, { data: [{ version_record: root() }, { version_record: root() }], error: null },
    { data: { version_record: root() }, error: null }, { data: [null], error: null }, { data: ["wrong"], error: null },
    { data: [{ version_record: root(), extra: PRIVATE }], error: null }, { data: [{ version_record: root() }] },
    { data: [{ version_record: root() }], error: { message: PRIVATE, code: "P0001" } },
  ])("keeps malformed/denied SDK envelope case %# opaque", async response => {
    await opaque(fixture(response).repository.readOwnedDraft(readInput()));
  });

  it("rejects selected-path getters and nested proxies without executing them", async () => {
    const getter = vi.fn(() => PRIVATE); const trap = vi.fn(() => { throw new Error(PRIVATE); });
    const versionGetter = Object.defineProperty(version(), "content_markdown", { enumerable: true, get: getter });
    const rootGetter = Object.defineProperty(root(), "version", { enumerable: true, get: getter });
    const rowGetter = Object.defineProperty({}, "version_record", { enumerable: true, get: getter });
    const responseGetter = Object.defineProperty({ error: null }, "data", { enumerable: true, get: getter });
    const arrayGetter = Object.defineProperty([{}], "0", { enumerable: true, get: getter });
    for (const response of [
      envelope({ version_record: { ...root(), version: versionGetter } }), envelope({ version_record: rootGetter }),
      envelope(rowGetter), responseGetter, { data: arrayGetter, error: null },
      envelope({ version_record: new Proxy(root(), { get: trap, ownKeys: trap }) }),
      envelope({ version_record: { ...root(), version: new Proxy(version(), { get: trap, ownKeys: trap }) } }),
      { data: new Proxy([{ version_record: root() }], { get: trap, ownKeys: trap }), error: null },
      // Promise delivery must be allowed its inert then probe before validation.
      new Proxy(readResponse(), { get: (_target, key) => key === "then" ? undefined : trap(), ownKeys: () => trap() }),
    ]) await opaque(fixture(response).repository.readOwnedDraft(readInput()));
    expect(getter).not.toHaveBeenCalled(); expect(trap).not.toHaveBeenCalled();
  });

  it("rejects nonordinary/decorated/sparse row arrays and hidden selected fields", async () => {
    const decorated = Object.assign([{ version_record: root() }], { extra: true });
    const hidden = Object.defineProperty([{ version_record: root() }], "secret", { value: PRIVATE });
    const exotic = [{ version_record: root() }]; Object.setPrototypeOf(exotic, null);
    for (const data of [new Array(1), decorated, hidden, exotic]) await opaque(fixture({ data, error: null }).repository.readOwnedDraft(readInput()));
    const hiddenVersion = Object.defineProperty(version(), "content_markdown", { value: CONTENT, enumerable: false });
    await opaque(fixture(envelope({ version_record: { ...root(), version: hiddenVersion } })).repository.readOwnedDraft(readInput()));
  });

  it("rejects malformed/executable read selectors before any RPC", async () => {
    const getter = vi.fn(() => id(3)); const trap = vi.fn(() => { throw new Error(PRIVATE); });
    for (const input of [
      { ...readInput(), extra: true }, { ...readInput(), expectedGuideId: "invalid" },
      { ...readInput(), actor: { ...readInput().actor, role: "admin" } },
      Object.defineProperty({ ...readInput() }, "packId", { enumerable: true, get: getter }),
      { ...readInput(), actor: new Proxy(readInput().actor, { get: trap, ownKeys: trap }) },
      new Proxy(readInput(), { get: trap, ownKeys: trap }),
    ]) {
      const f = fixture(); await opaque(f.repository.readOwnedDraft(input as MethodologyScreeningReadInput));
      expect(f.rpc).not.toHaveBeenCalled();
    }
    expect(getter).not.toHaveBeenCalled(); expect(trap).not.toHaveBeenCalled();
  });

  it.each([null, {}, { rpc: () => Promise.resolve(readResponse()), extra: true }, { rpc: "not-a-function" }])(
    "rejects malformed closed capability %#", capability => {
      expect(() => createMethodologyScreeningRepository(capability)).toThrow(ERROR);
    });
  it("rejects proxy/accessor/hidden/symbol/exotic capability fields before invoking anything", () => {
    const getter = vi.fn(() => async () => readResponse()); const trap = vi.fn(() => { throw new Error(PRIVATE); });
    const fn = async () => readResponse();
    for (const capability of [
      Object.defineProperty({}, "rpc", { enumerable: true, get: getter }), Object.defineProperty({}, "rpc", { value: fn }),
      { rpc: fn, [Symbol("hidden")]: true }, Object.create({ rpc: fn }),
      new Proxy({ rpc: fn }, { get: trap, ownKeys: trap }), { rpc: new Proxy(fn, { apply: trap }) },
    ]) expect(() => createMethodologyScreeningRepository(capability)).toThrow(ERROR);
    expect(getter).not.toHaveBeenCalled(); expect(trap).not.toHaveBeenCalled();
  });

  it.each(["ok", "exact_replay"] as const)("uses exactly ten prepare arguments and projects %s correctly", async outcome => {
    const f = fixture(envelope({ outcome, screen_invocation_id: id(7), dispatch_permitted: outcome === "ok" }));
    expect(await f.repository.prepare(prepareParameters())).toEqual({ outcome, screen_invocation_id: id(7), dispatch_permitted: outcome === "ok" });
    expect(f.rpc.mock.calls[0][0]).toBe("solmind_prepare_methodology_screen");
    expect(f.rpc.mock.calls[0][1]).toEqual(prepareParameters());
    expect(Object.keys(f.rpc.mock.calls[0][1])).toHaveLength(10); expect(Object.isFrozen(f.rpc.mock.calls[0][1])).toBe(true);
    expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it.each([
    { outcome: "ok", screen_invocation_id: id(7), dispatch_permitted: false },
    { outcome: "exact_replay", screen_invocation_id: id(7), dispatch_permitted: true },
    { outcome: "ok", screen_invocation_id: id(9), dispatch_permitted: true },
    { outcome: "ok", screen_invocation_id: id(7), dispatch_permitted: "true" },
    { outcome: "unknown", screen_invocation_id: id(7), dispatch_permitted: false },
    { outcome: "ok", screen_invocation_id: id(7), dispatch_permitted: true, extra: PRIVATE },
  ])("denies unsafe prepare receipt case %#", async row => {
    await opaque(fixture(envelope(row)).repository.prepare(prepareParameters()));
  });
  it.each([
    { ...prepareParameters(), p_operation_id: id(171).toUpperCase() },
    { ...prepareParameters(), p_policy_version: "invalid policy" }, { ...prepareParameters(), p_policy_version: "a".repeat(121) },
    { ...prepareParameters(), p_content_sha256: "bad" }, { ...prepareParameters(), p_request_sha256: "c".repeat(64) },
    { ...prepareParameters(), p_policy_manifest_sha256: null }, { ...prepareParameters(), extra: true },
  ])("rejects malformed prepare input %# before any RPC", async input => {
    const f = fixture(prepareResponse()); await opaque(f.repository.prepare(input as MethodologyScreeningPrepareParameters));
    expect(f.rpc).not.toHaveBeenCalled();
  });

  it.each(["completed", "failed", "canceled"] as const)("sends exactly seven settlement arguments for %s", async status => {
    const f = fixture(envelope({ outcome: "ok" }));
    expect(await f.repository.settle(settleParameters(status))).toEqual({ outcome: "ok" });
    expect(f.rpc.mock.calls[0][0]).toBe("solmind_record_methodology_screen");
    expect(f.rpc.mock.calls[0][1]).toEqual(settleParameters(status)); expect(Object.keys(f.rpc.mock.calls[0][1])).toHaveLength(7);
    expect(Object.isFrozen(f.rpc.mock.calls[0][1])).toBe(true); expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it("accepts exact terminal replay but never adds provider or approval ports", async () => {
    const f = fixture(envelope({ outcome: "exact_replay" }));
    expect(await f.repository.settle(settleParameters())).toEqual({ outcome: "exact_replay" });
    expect(f.rpc.mock.calls.map(call => call[0])).toEqual(["solmind_record_methodology_screen"]);
  });
  it.each([{ outcome: "unknown" }, { outcome: "ok", extra: PRIVATE }, { outcome: null }])(
    "denies uncertain or widened terminal receipt %#", async row => {
      const f = fixture(envelope(row)); await opaque(f.repository.settle(settleParameters()));
      expect(f.rpc).toHaveBeenCalledTimes(1);
    });
  it.each(["pass", "review", "fail"] as const)("uses the real parser then persists only three result keys for %s", async result => {
    const subject = bindMethodologySafetyScreenSubject({ methodologyContextPackVersionId: id(5), content: CONTENT });
    const parsed = parseMethodologySafetyScreenResult({ result, subject_sha256: SHA, findings: result === "pass" ? [] : [{
      criterion: "concealment", severity: result, excerpt: "Synthetic", explanation: "Synthetic fixture concern only.",
    }] }, subject.subject);
    const f = fixture(envelope({ outcome: "ok" }));
    await f.repository.settle({ ...settleParameters(), p_result: { result: parsed.result, subject_sha256: parsed.subject_sha256, findings: parsed.findings } });
    const sent = f.rpc.mock.calls[0][1].p_result as Record<string, unknown>;
    expect(Object.keys(sent)).toEqual(["result", "subject_sha256", "findings"]);
    expect(sent).not.toHaveProperty("methodologyContextPackVersionId"); expect(Object.isFrozen(sent)).toBe(true);
    expect(Object.isFrozen(sent.findings)).toBe(true);
    if (result !== "pass") expect(Object.isFrozen((sent.findings as object[])[0])).toBe(true);
  });
  it("copies nested result/findings before awaiting and never invokes toJSON", async () => {
    const d = deferred(); const f = fixture(); f.rpc.mockReturnValueOnce(d.promise);
    const input = { ...settleParameters(), p_result: { result: "review" as const, subject_sha256: SHA,
      findings: [{ criterion: "concealment" as const, severity: "review" as const, excerpt: "Synthetic", explanation: "Synthetic concern." }] } };
    const pending = f.repository.settle(input);
    input.p_result.findings[0].excerpt = PRIVATE; input.p_result.findings.push({ ...input.p_result.findings[0] });
    d.resolve(envelope({ outcome: "ok" })); await pending;
    const sent = f.rpc.mock.calls[0][1].p_result as { findings: { excerpt: string }[] };
    expect(sent.findings).toHaveLength(1); expect(sent.findings[0].excerpt).toBe("Synthetic"); expect(JSON.stringify(sent)).not.toContain(PRIVATE);
  });
  it.each([
    { ...settleParameters(), p_terminal_status: "started" }, { ...settleParameters(), p_result: null },
    { ...settleParameters("failed"), p_result: settleParameters().p_result },
    { ...settleParameters("canceled"), p_result: {} }, { ...settleParameters(), p_screen_invocation_id: "bad" },
    { ...settleParameters(), p_result: { result: "pass", subject_sha256: "F".repeat(64), findings: [] } },
    { ...settleParameters(), p_result: { result: "pass", subject_sha256: SHA, findings: [], methodologyContextPackVersionId: id(5) } },
  ])("rejects malformed/widened terminal input %# without RPC", async input => {
    const f = fixture(envelope({ outcome: "ok" })); await opaque(f.repository.settle(input as MethodologyScreeningSettleParameters));
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("rejects hostile result/finding arrays/accessors/proxies without executing a getter or toJSON", async () => {
    const getter = vi.fn(() => PRIVATE); const trap = vi.fn(() => { throw new Error(PRIVATE); });
    const finding = { criterion: "concealment", severity: "review", excerpt: "Synthetic", explanation: "Synthetic concern." };
    const result = { result: "review", subject_sha256: SHA, findings: [finding] };
    const findingGetter = Object.defineProperty({ ...finding }, "excerpt", { enumerable: true, get: getter });
    const inputResults: unknown[] = [
      { ...result, findings: [findingGetter] }, { ...result, findings: new Array(1) },
      { ...result, findings: Object.assign([finding], { extra: true }) },
      { ...result, findings: new Proxy([finding], { get: trap, ownKeys: trap }) },
      { ...result, findings: [new Proxy(finding, { get: trap, ownKeys: trap })] },
      new Proxy(result, { get: trap, ownKeys: trap }),
      Object.defineProperty({ ...result }, "findings", { enumerable: true, get: getter }),
      Object.defineProperty({ ...result }, "toJSON", { enumerable: true, get: getter }),
    ];
    for (const p_result of inputResults) {
      const f = fixture(envelope({ outcome: "ok" }));
      await opaque(f.repository.settle({ ...settleParameters(), p_result } as MethodologyScreeningSettleParameters));
      expect(f.rpc).not.toHaveBeenCalled();
    }
    expect(getter).not.toHaveBeenCalled(); expect(trap).not.toHaveBeenCalled();
  });

  it.each(["read", "prepare", "settle"] as const)("does not call RPC/create timeout for pre-canceled %s", async kind => {
    const caller = new AbortController(); caller.abort(new Error(PRIVATE)); const f = fixture();
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const pending = kind === "read" ? f.repository.readOwnedDraft(readInput(), caller.signal)
      : kind === "prepare" ? f.repository.prepare(prepareParameters(), caller.signal) : f.repository.settle(settleParameters(), caller.signal);
    await opaque(pending); expect(f.rpc).not.toHaveBeenCalled(); expect(timeout).not.toHaveBeenCalled();
  });
  it.each(["caller", "timeout"] as const)("requests %s abort but drains a late finite RPC before rejecting", async kind => {
    const caller = new AbortController(); const timeout = new AbortController(); const d = deferred();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
    const f = fixture(); f.rpc.mockReturnValueOnce(d.promise);
    let finished = false;
    const pending = f.repository.prepare(prepareParameters(), caller.signal);
    void pending.then(() => { finished = true; }, () => { finished = true; });
    (kind === "caller" ? caller : timeout).abort(new Error(PRIVATE));
    await Promise.resolve(); await Promise.resolve();
    expect(f.rpc.mock.calls[0][2].aborted).toBe(true); expect(finished).toBe(false);
    expect(String(f.rpc.mock.calls[0][2].reason)).not.toContain(PRIVATE);
    d.resolve(prepareResponse()); await opaque(pending);
    expect(finished).toBe(true); expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it("uses native signal access rather than overridden caller getters/methods", async () => {
    const caller = new AbortController(); const timeout = new AbortController(); const d = deferred();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
    const getter = vi.fn(() => { throw new Error(PRIVATE); });
    for (const property of ["aborted", "addEventListener", "removeEventListener"])
      Object.defineProperty(caller.signal, property, { configurable: true, get: getter });
    const f = fixture(); f.rpc.mockReturnValueOnce(d.promise);
    const pending = f.repository.prepare(prepareParameters(), caller.signal); caller.abort(new Error(PRIVATE));
    d.resolve(prepareResponse()); await opaque(pending); expect(getter).not.toHaveBeenCalled();
  });
  it("rejects proxy/forged signals without traps or RPC", async () => {
    const trap = vi.fn(() => { throw new Error(PRIVATE); }); const f = fixture();
    for (const signal of [new Proxy(new AbortController().signal, { get: trap, getPrototypeOf: trap }), Object.create(AbortSignal.prototype), {}])
      await opaque(f.repository.prepare(prepareParameters(), signal as AbortSignal));
    expect(trap).not.toHaveBeenCalled(); expect(f.rpc).not.toHaveBeenCalled();
  });
  it("permits a failed settlement with an independent cleanup signal after another caller aborts", async () => {
    const caller = new AbortController(); caller.abort(); const cleanup = new AbortController();
    const f = fixture(envelope({ outcome: "ok" }));
    expect(await f.repository.settle(settleParameters("failed"), cleanup.signal)).toEqual({ outcome: "ok" });
    expect(f.rpc.mock.calls[0][2].aborted).toBe(false); expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it("keeps sync/async capability errors opaque with no retry", async () => {
    const sync = fixture(); sync.rpc.mockImplementationOnce(() => { throw new Error(PRIVATE); });
    await opaque(sync.repository.prepare(prepareParameters())); expect(sync.rpc).toHaveBeenCalledTimes(1);
    const asyncFailure = fixture(); asyncFailure.rpc.mockRejectedValueOnce(new Error(PRIVATE));
    await opaque(asyncFailure.repository.prepare(prepareParameters())); expect(asyncFailure.rpc).toHaveBeenCalledTimes(1);
  });
  it("rejects executable thenables or accessor-bearing native Promises before await consults them", async () => {
    const getter = vi.fn(() => { throw new Error(PRIVATE); });
    const thenable = Object.defineProperty({}, "then", { enumerable: true, get: getter });
    const constructorPromise = Promise.resolve(prepareResponse()); Object.defineProperty(constructorPromise, "constructor", { get: getter });
    const thenPromise = Promise.resolve(prepareResponse()); Object.defineProperty(thenPromise, "then", { get: getter });
    for (const value of [thenable, constructorPromise, thenPromise]) {
      // A plain counted capability prevents mock instrumentation from probing
      // the malformed return before the repository can reject its descriptors.
      let calls = 0;
      const rpc = () => { calls++; return value; };
      await opaque(createMethodologyScreeningRepository({ rpc }).prepare(prepareParameters()));
      expect(calls).toBe(1);
    }
    expect(getter).not.toHaveBeenCalled();
  });
});
