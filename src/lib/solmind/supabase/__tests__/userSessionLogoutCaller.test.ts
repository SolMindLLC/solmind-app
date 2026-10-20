import { describe, expect, it, vi } from "vitest";
import { createUserSessionLogoutCaller } from "../userSessionLogoutCaller";

const account = "11111111-1111-1111-1111-111111111111";
const session = "22222222-2222-2222-2222-222222222222";
const request = { userAccountId: account, presentedSessionId: session };
const answer = (outcome = "ended") => ({ data: [{ outcome }], error: null });

function harness(result: () => PromiseLike<unknown> | unknown = () => answer(), timeout = 100) {
  let signal: AbortSignal | undefined;
  const rpc = vi.fn(() => ({ abortSignal: (value: AbortSignal) => { signal = value; return Promise.resolve(result()); } }));
  return { rpc, signal: () => signal, caller: createUserSessionLogoutCaller({ rpcClient: { rpc }, rpcTimeoutMilliseconds: timeout }) };
}

describe("one exact logout RPC", () => {
  it.each(["ended", "already_ended"])("accepts %s only for the exact presented pair", async (outcome) => {
    const h = harness(() => answer(outcome));
    expect(await h.caller.end(request)).toEqual({ outcome });
    expect(h.rpc).toHaveBeenCalledExactlyOnceWith("solmind_logout_user_session", {
      p_user_account_id: account, p_user_session_id: session,
    });
  });

  it("rejects expanded or noncanonical authority before dispatch", async () => {
    const h = harness();
    for (const invalid of [ { ...request, role: "Admin" }, { ...request, presentedSessionId: session + "\n" },
      { ...request, userAccountId: account.toUpperCase().replace("1", "A") },
      { ...request, presentedSessionId: "" }, { ...request, userAccountId: null },
      Object.defineProperty({}, "userAccountId", { get() { throw new Error("private"); } }),
    ]) {
      expect(await h.caller.end(invalid as typeof request)).toEqual({ outcome: "invalid_request" });
    }
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it.each([
    null, {}, { data: [{ outcome: "ended" }] }, { data: [], error: null },
    { data: [{ outcome: "ended" }, { outcome: "ended" }], error: null },
    { data: [{ outcome: "ended", detail: "private" }], error: null },
    { data: [{ outcome: "unknown_session" }], error: null },
    { data: [{ outcome: "ended" }], error: { message: "private" } },
  ])("does not confirm a malformed or failed answer %#", async (result) => {
    const h = harness(() => result);
    expect(await h.caller.end(request)).toEqual({ outcome: "failed" });
    expect(h.rpc).toHaveBeenCalledTimes(1);
  });

  it("bounds a hanging call, requests cancellation and consumes late rejection without retry", async () => {
    vi.useFakeTimers();
    let reject!: (reason: unknown) => void;
    const h = harness(() => new Promise((_resolve, fail) => { reject = fail; }), 10);
    const result = h.caller.end(request);
    await vi.advanceTimersByTimeAsync(11);
    expect(await result).toEqual({ outcome: "failed" });
    expect(h.signal()?.aborted).toBe(true);
    reject(new Error("private"));
    await Promise.resolve();
    expect(h.rpc).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
