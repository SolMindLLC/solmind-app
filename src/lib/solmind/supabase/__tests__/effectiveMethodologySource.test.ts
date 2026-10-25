import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEffectiveMethodologySource } from "../effectiveMethodologySource";
import type { EffectiveMethodologyReadInput } from "../../virtual-guide/effectiveMethodologyContext";

// RPC-shaped in-memory doubles only. No Supabase client, auth, DB or network.
const id = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const content = "Synthetic methodology text; this fixture is not an actual approved pack.";
const sha = createHash("sha256").update(content, "utf8").digest("hex").toUpperCase();
const input = (): EffectiveMethodologyReadInput => ({
  actor: { accountId: id(1), applicationSessionId: id(2) }, packId: id(3), expectedScope: { type: "guide", id: id(4) },
});
const row = () => ({
  methodology_context_pack_id: id(3), scope_type: "guide", scope_id: id(4),
  methodology_context_pack_version_id: id(5), version_number: 2, content_markdown: content,
  content_sha256: sha, methodology_authorization_version: `MV1:${"A".repeat(64)}`,
});
const UNAVAILABLE = "effective_methodology_source_unavailable";
const PRIVATE = "SYNTHETIC_PRIVATE_DATABASE_DETAIL";
function fixture(response: unknown = { data: [row()], error: null }) {
  const abortSignal = vi.fn<(signal: AbortSignal) => Promise<unknown>>().mockResolvedValue(response);
  const rpc = vi.fn<(name: string, parameters: unknown) => { abortSignal: typeof abortSignal }>().mockReturnValue({ abortSignal });
  const unexpected = vi.fn(() => { throw new Error(PRIVATE); });
  const client = new Proxy({ rpc }, { get: (target, property) => property === "rpc" ? target.rpc : unexpected() }) as unknown as SupabaseClient;
  return { rpc, abortSignal, unexpected, source: createEffectiveMethodologySource(client) };
}
async function opaque(promise: Promise<unknown>) {
  let error: unknown;
  try { await promise; } catch (caught) { error = caught; }
  expect(error).toBeInstanceOf(Error); expect((error as Error).message).toBe(UNAVAILABLE);
  expect(String(error)).not.toContain(PRIVATE); expect("cause" in (error as Error)).toBe(false);
}
afterEach(() => { vi.restoreAllMocks(); });

describe("effective methodology exact resolver port (synthetic transport)", () => {
  it("calls the one pinned RPC with five server-derived selectors and a 12-second bound", async () => {
    const f = fixture(); const bounded = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(bounded);
    const result = await f.source.read(input());
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("solmind_resolve_explorer_methodology", {
      p_actor_user_account_id: id(1), p_user_session_id: id(2), p_methodology_context_pack_id: id(3),
      p_scope_type: "guide", p_scope_id: id(4),
    });
    expect(timeout).toHaveBeenCalledExactlyOnceWith(12_000);
    expect(f.abortSignal).toHaveBeenCalledExactlyOnceWith(bounded);
    expect(result).toEqual({
      packId: id(3), scopeType: "guide", scopeId: id(4), versionId: id(5), versionNumber: 2,
      contentMarkdown: content, contentSha256: sha, methodologyAuthorizationVersion: `MV1:${"A".repeat(64)}`,
    });
    expect(Object.isFrozen(result)).toBe(true); expect(f.unexpected).not.toHaveBeenCalled();
    expect(Object.keys(f.source)).toEqual(["read"]); expect(Object.isFrozen(f.source)).toBe(true);
  });

  it("does not cache a selected version across reads", async () => {
    const f = fixture();
    const first = await f.source.read(input());
    f.abortSignal.mockResolvedValueOnce({ data: [{ ...row(), methodology_context_pack_version_id: id(6), version_number: 3 }], error: null });
    const next = await f.source.read(input());
    expect(first.versionId).toBe(id(5)); expect(next.versionId).toBe(id(6));
    expect(f.rpc).toHaveBeenCalledTimes(2);
  });

  it.each([
    null, {}, { data: [row()] }, { data: [], error: null }, { data: [row(), row()], error: null },
    { data: row(), error: null }, { data: [null], error: null }, { data: ["not a row"], error: null },
    { data: [{ ...row(), private: PRIVATE }], error: null },
    { data: [{ ...row(), scope_type: "organization" }], error: null },
    { data: [{ ...row(), scope_id: id(7) }], error: null },
    { data: [{ ...row(), methodology_context_pack_id: id(7) }], error: null },
    { data: [{ ...row(), content_sha256: "F".repeat(64) }], error: null },
    { data: [{ ...row(), version_number: 0 }], error: null },
    { data: [{ ...row(), methodology_authorization_version: "not a proof" }], error: null },
    { data: [row()], error: { message: PRIVATE, code: "P0001" } },
  ])("returns only fixed unavailable for malformed/denied resolver data: %#", async (response) => {
    const f = fixture(response); await opaque(f.source.read(input()));
    expect(f.rpc).toHaveBeenCalledTimes(1); expect(f.unexpected).not.toHaveBeenCalled();
  });

  it("ignores Supabase transport status fields without exposing them", async () => {
    const f = fixture({ data: [row()], error: null, count: 1, status: 200, statusText: PRIVATE });
    expect(JSON.stringify(await f.source.read(input()))).not.toContain(PRIVATE);
  });

  it("rejects accessors and proxies in response/array/row without executing them", async () => {
    const getter = vi.fn(() => content);
    const hostileRow = Object.defineProperty(row(), "content_markdown", { enumerable: true, get: getter });
    const hostileResponse = Object.defineProperty({ error: null }, "data", { enumerable: true, get: getter });
    const hostileArray = Object.defineProperty([row()], "0", { enumerable: true, get: getter });
    const trap = vi.fn(() => { throw new Error(PRIVATE); });
    for (const response of [
      { data: [hostileRow], error: null }, hostileResponse, { data: hostileArray, error: null },
      { data: [new Proxy(row(), { get: trap, ownKeys: trap })], error: null },
      { data: new Proxy([row()], { get: trap, ownKeys: trap }), error: null },
      // Promise delivery necessarily probes `then` before the parser receives
      // a value. Permit only that inert interoperability probe; parser access
      // to any property or key must still never execute a trap.
      new Proxy({ data: [row()], error: null }, {
        get: (_target, key) => key === "then" ? undefined : trap(),
        ownKeys: () => trap(),
      }),
    ]) await opaque(fixture(response).source.read(input()));
    expect(getter).not.toHaveBeenCalled(); expect(trap.mock.calls.length).toBe(0);
  });

  it("rejects sparse, decorated, or hidden-property arrays", async () => {
    const sparse = new Array(1);
    const decorated = Object.assign([row()], { extra: true });
    const hidden = Object.defineProperty([row()], "private", { value: true });
    for (const data of [sparse, decorated, hidden]) await opaque(fixture({ data, error: null }).source.read(input()));
  });

  it("refuses invalid or accessor-bearing read selectors before any RPC", async () => {
    const getter = vi.fn(() => id(3));
    const hostile = Object.defineProperty(input(), "packId", { enumerable: true, get: getter });
    for (const request of [hostile, { ...input(), actor: { ...input().actor, role: "guide" } },
      { ...input(), expectedScope: { type: "practice", id: id(4) } }]) {
      const f = fixture(); await opaque(f.source.read(request as EffectiveMethodologyReadInput));
      expect(f.rpc).not.toHaveBeenCalled();
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it("settles a pre-aborted caller without transport or timeout creation", async () => {
    const controller = new AbortController(); controller.abort();
    const timeout = vi.spyOn(AbortSignal, "timeout"); const f = fixture();
    await opaque(f.source.read({ ...input(), signal: controller.signal }));
    expect(f.rpc).not.toHaveBeenCalled(); expect(timeout).not.toHaveBeenCalled();
  });

  it.each(["caller", "timeout"] as const)("bounds pending RPC by %s cancellation without a retry", async (kind) => {
    const caller = new AbortController(); const timeout = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
    const f = fixture();
    f.abortSignal.mockImplementationOnce(signal => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error(PRIVATE)), { once: true });
    }));
    const pending = opaque(f.source.read({ ...input(), signal: caller.signal }));
    (kind === "caller" ? caller : timeout).abort();
    await pending; expect(f.rpc).toHaveBeenCalledTimes(1); expect(f.abortSignal).toHaveBeenCalledTimes(1);
  });

  it("refuses a result arriving after caller cancellation", async () => {
    const caller = new AbortController(); const f = fixture();
    f.abortSignal.mockImplementationOnce(async () => { caller.abort(); return { data: [row()], error: null }; });
    await opaque(f.source.read({ ...input(), signal: caller.signal })); expect(f.rpc).toHaveBeenCalledTimes(1);
  });

  it("keeps synchronous and asynchronous transport errors fixed and private", async () => {
    const synchronous = fixture(); synchronous.rpc.mockImplementationOnce(() => { throw new Error(PRIVATE); });
    await opaque(synchronous.source.read(input()));
    const asynchronous = fixture(); asynchronous.abortSignal.mockRejectedValueOnce(new Error(PRIVATE));
    await opaque(asynchronous.source.read(input()));
  });
});
