import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXPLORER_SAFETY_REQUEST_VERSION } from "../explorerSafetyReplyContract";
import { invokeExplorerSafetyReply, type ExplorerSafetyReplyTransport } from "../explorerSafetyReplyInvocation";

function request() {
  const authorizedContext = JSON.stringify({ immediateExplorerMessage: { content: "Synthetic local message." } });
  return { contractVersion: EXPLORER_SAFETY_REQUEST_VERSION,
    invocationId: "00000000-0000-4000-8000-000000000001", explorerId: "00000000-0000-4000-8000-000000000002",
    sessionId: "00000000-0000-4000-8000-000000000003", contextSnapshotId: "00000000-0000-4000-8000-000000000004",
    contextFingerprint: createHash("sha256").update(authorizedContext).digest("hex"), authorizedContext,
    mode: "classification_and_reply", classificationPolicyVersion: "synthetic-model.v1",
    fallbackPolicyVersion: "synthetic-fallback.v1", instructionVersion: "synthetic-instructions.v1" };
}
const POSITIVE = JSON.stringify({ protocol: "explorer-safety-reply.v1", classification: { level: 4, minorIndicated: true }, candidateReply: { content: "\ud800" } });
function deferred() {
  let resolve!: (value: unknown) => void; let reject!: (reason: unknown) => void;
  const promise = new Promise<unknown>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("Explorer one result-admission owner (fake port only)", () => {
  it("counts one dispatch and retains positive classification through unusable prose", async () => {
    const generate = vi.fn(async () => POSITIVE);
    const result = await invokeExplorerSafetyReply({ request: request(), transport: { generate }, timeoutMilliseconds: 1000 });
    expect(generate).toHaveBeenCalledOnce(); expect(result.status).toBe("observed");
    expect(result.observation).toEqual({ classification: { level: 4, minorIndicated: true }, candidate: { kind: "unusable" } });
  });
  it("makes no dispatch if delivery is canceled beforehand", async () => {
    const controller = new AbortController(); controller.abort(); const generate = vi.fn(async () => POSITIVE);
    const result = await invokeExplorerSafetyReply({ request: request(), transport: { generate }, timeoutMilliseconds: 1000, signal: controller.signal });
    expect(result.status).toBe("not_attempted"); expect(result.observation).toBeNull(); expect(generate).not.toHaveBeenCalled();
  });
  it("browser cancellation does not erase the separately owned observation interval", async () => {
    const pending = deferred(); const controller = new AbortController(); let ownedSignal!: AbortSignal;
    const generate = vi.fn((_request: unknown, signal: AbortSignal) => { ownedSignal = signal; return pending.promise; });
    const run = invokeExplorerSafetyReply({ request: request(), transport: { generate }, timeoutMilliseconds: 1000, signal: controller.signal });
    controller.abort(); expect(ownedSignal.aborted).toBe(false); pending.resolve(POSITIVE);
    const result = await run; expect(result.status).toBe("observed"); expect(result.deliveryInterested).toBe(false);
    expect(result.observation?.classification.level).toBe(4); expect(generate).toHaveBeenCalledOnce();
  });
  it("synchronous browser abort inside generate still cannot erase an accepted positive", async () => {
    const controller = new AbortController();
    const generate = vi.fn(() => { controller.abort(); return Promise.resolve(POSITIVE); });
    const result = await invokeExplorerSafetyReply({ request: request(), transport: { generate }, timeoutMilliseconds: 1000, signal: controller.signal });
    expect(result.status).toBe("observed"); expect(result.deliveryInterested).toBe(false);
  });
  it("at deadline requests abort and admits no later positive", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const pending = deferred(); let ownedSignal!: AbortSignal;
    const generate = vi.fn((_request: unknown, signal: AbortSignal) => { ownedSignal = signal; return pending.promise; });
    const run = invokeExplorerSafetyReply({ request: request(), transport: { generate }, timeoutMilliseconds: 100 });
    await vi.advanceTimersByTimeAsync(100); const result = await run;
    expect(result.status).toBe("unavailable"); expect(result.reason).toBe("deadline"); expect(result.observation).toBeNull();
    expect(ownedSignal.aborted).toBe(true); pending.resolve(POSITIVE); await Promise.resolve();
    expect(result.observation).toBeNull(); expect(generate).toHaveBeenCalledOnce();
  });
  it("checks receipt time even before a delayed timer callback can run", async () => {
    vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValue(101);
    const generate = vi.fn(async () => POSITIVE);
    const result = await invokeExplorerSafetyReply({ request: request(), transport: { generate }, timeoutMilliseconds: 100 });
    expect(result.reason).toBe("deadline"); expect(result.observation).toBeNull(); expect(generate).toHaveBeenCalledOnce();
  });
  it("observes late rejection without a retry or replacement result", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }); const pending = deferred();
    const generate = vi.fn(() => pending.promise);
    const run = invokeExplorerSafetyReply({ request: request(), transport: { generate }, timeoutMilliseconds: 100 });
    await vi.advanceTimersByTimeAsync(100); const result = await run;
    pending.reject(new Error("private provider detail")); await Promise.resolve();
    expect(result.reason).toBe("deadline"); expect(JSON.stringify(result)).not.toContain("private provider detail"); expect(generate).toHaveBeenCalledOnce();
  });
  it("refuses arbitrary thenables without consulting their then getter", async () => {
    const getter = vi.fn(() => () => undefined); const thenable = Object.defineProperty({}, "then", { get: getter });
    const generate = vi.fn(() => thenable as Promise<unknown>);
    const result = await invokeExplorerSafetyReply({ request: request(), transport: { generate }, timeoutMilliseconds: 1000 });
    expect(result.reason).toBe("transport_failed"); expect(getter).not.toHaveBeenCalled();
  });
  it("requires an ordinary native promise, not a subclass", async () => {
    class OtherPromise extends Promise<unknown> {}
    const result = await invokeExplorerSafetyReply({ request: request(), transport: { generate: () => new OtherPromise((resolve) => resolve(POSITIVE)) }, timeoutMilliseconds: 1000 });
    expect(result.reason).toBe("transport_failed");
  });
  it("makes malformed output unavailable instead of inventing model0", async () => {
    const result = await invokeExplorerSafetyReply({ request: request(), transport: { generate: async () => "unparsed level4" }, timeoutMilliseconds: 1000 });
    expect(result.reason).toBe("invalid_response"); expect(result.observation).toBeNull();
  });
  it("one throwing port becomes one opaque failure", async () => {
    const generate = vi.fn(() => { throw new Error("private credential detail"); });
    const result = await invokeExplorerSafetyReply({ request: request(), transport: { generate }, timeoutMilliseconds: 1000 });
    expect(result.reason).toBe("transport_failed"); expect(JSON.stringify(result)).not.toContain("private credential detail"); expect(generate).toHaveBeenCalledOnce();
  });
  it("does not consult a transport generate getter", async () => {
    const getter = vi.fn(); const transport = Object.defineProperty({}, "generate", { enumerable: true, get: getter });
    await expect(invokeExplorerSafetyReply({ request: request(), transport: transport as ExplorerSafetyReplyTransport, timeoutMilliseconds: 1000 })).rejects.toThrowError("explorer_safety_invalid_transport");
    expect(getter).not.toHaveBeenCalled();
  });
});
