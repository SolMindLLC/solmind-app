import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createFailClosedRequestAuthPrincipalSource,
  createInMemoryRequestAuthPrincipalSource,
} from "../requestAuthPrincipalSource";
import {
  createInMemoryAuthSource,
  type InMemoryAuthSourceFixture,
} from "../authSource";
import {
  deriveTrustedServerAuthContext,
  type DeriveTrustedServerAuthContextInput,
  type SupabaseAuthenticatedUser,
} from "../serverAuthContext";

// The canonical provider name for Supabase auth, matching principalMapping and
// the existing serverAuthContext/authSource fixtures.
const PROVIDER_NAME = "supabase";
const GUIDE_USER_ID = "user-guide-1";
const GUIDE_PROFILE_A = "guide-profile-a";

// Login step 6, sub-slice S6-4: the selected session's UUID, which the request
// presents in its binding cookie, and its expiry.
const SESSION_ID = "5e5510a0-0000-4000-8000-000000001101";
const SESSION_EXPIRES_AT = "2999-12-31T23:59:59+00:00";

function guidePrincipal(
  presentedSessionId: string | null = SESSION_ID,
): SupabaseAuthenticatedUser {
  return {
    providerName: PROVIDER_NAME,
    providerUserId: "auth-user-guide-1",
    presentedSessionId,
  };
}

// A fully-valid trusted-context input for the guide principal, in the style of
// authSource.test.ts / serverAuthContext.test.ts. The active role is carried by
// the server-loaded session record, not by any request value.
function validGuideInput(): DeriveTrustedServerAuthContextInput {
  const { providerUserId } = guidePrincipal();
  return {
    authenticatedUser: {
      providerName: PROVIDER_NAME,
      providerUserId,
      presentedSessionId: SESSION_ID,
    },
    authProviderIdentity: {
      userAccountId: GUIDE_USER_ID,
      providerName: PROVIDER_NAME,
      providerUserId,
      status: "active",
    },
    userAccount: { userAccountId: GUIDE_USER_ID, accountStatus: "active" },
    session: {
      userSessionId: SESSION_ID,
      userAccountId: GUIDE_USER_ID,
      activeRoleContext: "guide",
      sessionStatus: "active",
      expiresAt: SESSION_EXPIRES_AT,
    },
    activeRoleAssignment: {
      userAccountId: GUIDE_USER_ID,
      roleCode: "guide",
      roleStatus: "active",
    },
    guideProfile: {
      guideProfileId: GUIDE_PROFILE_A,
      userAccountId: GUIDE_USER_ID,
      status: "active",
    },
    explorerProfile: null,
  };
}

function guideFixture(): InMemoryAuthSourceFixture {
  return {
    accounts: [
      {
        principal: guidePrincipal(),
        serverAuthContextInput: validGuideInput(),
      },
    ],
  };
}

describe("createInMemoryRequestAuthPrincipalSource - port contract", () => {
  it("resolves the configured principal", async () => {
    const source = createInMemoryRequestAuthPrincipalSource(guidePrincipal());

    await expect(source.resolveAuthenticatedUser()).resolves.toEqual(
      guidePrincipal(),
    );
  });

  it("resolves null when configured with null (deny)", async () => {
    const source = createInMemoryRequestAuthPrincipalSource(null);

    await expect(source.resolveAuthenticatedUser()).resolves.toBeNull();
  });

  it("is deterministic and side-effect-free across repeated calls", async () => {
    const source = createInMemoryRequestAuthPrincipalSource(guidePrincipal());

    const first = await source.resolveAuthenticatedUser();
    const second = await source.resolveAuthenticatedUser();

    expect(first).toEqual(second);
    expect(first).toEqual(guidePrincipal());
  });
});

describe("request-auth principal composes with the existing auth chain", () => {
  it("a resolved principal feeds loadServerAuthContextInput and derives an allow", async () => {
    const principalSource = createInMemoryRequestAuthPrincipalSource(
      guidePrincipal(),
    );
    const authSource = createInMemoryAuthSource(guideFixture());

    // The composition root resolves identity first, then loads records keyed by
    // that principal, then derives. The principal is only a lookup key.
    const principal = await principalSource.resolveAuthenticatedUser();
    expect(principal).not.toBeNull();
    if (principal === null) {
      return;
    }

    const input = await authSource.loadServerAuthContextInput({
      authenticatedUser: principal,
    });
    const derived = deriveTrustedServerAuthContext(input);

    expect(derived.allowed).toBe(true);
    if (derived.allowed) {
      expect(derived.context.activeRole).toBe("guide");
      expect(derived.context.identity.userAccountId).toBe(GUIDE_USER_ID);
    }
  });

  it("PRQ-601 the session UUID a principal source presents is what the chain compares: none, or another session's, derives a denial", async () => {
    const authSource = createInMemoryAuthSource(guideFixture());

    for (const presented of [null, "5e5510a0-0000-4000-8000-000000001102"]) {
      const principal = await createInMemoryRequestAuthPrincipalSource(
        guidePrincipal(presented),
      ).resolveAuthenticatedUser();
      expect(principal).toEqual(guidePrincipal(presented));
      if (principal === null) {
        return;
      }

      const input = await authSource.loadServerAuthContextInput({
        authenticatedUser: principal,
      });
      expect(deriveTrustedServerAuthContext(input).allowed).toBe(false);
    }
  });

  it("a null principal is the deny signal and yields a denied derivation", async () => {
    const principalSource = createInMemoryRequestAuthPrincipalSource(null);

    const principal = await principalSource.resolveAuthenticatedUser();
    expect(principal).toBeNull();

    // null means deny: the existing chain denies by default on a null
    // authenticated user, without consulting any record store.
    const derived = deriveTrustedServerAuthContext({
      authenticatedUser: principal,
      authProviderIdentity: null,
      userAccount: null,
      session: null,
      activeRoleAssignment: null,
      guideProfile: null,
      explorerProfile: null,
    });

    expect(derived.allowed).toBe(false);
  });
});

describe("createFailClosedRequestAuthPrincipalSource - fail-closed posture", () => {
  it("passes through a synchronously resolved principal", async () => {
    const source = createFailClosedRequestAuthPrincipalSource(() =>
      guidePrincipal(),
    );

    await expect(source.resolveAuthenticatedUser()).resolves.toEqual(
      guidePrincipal(),
    );
  });

  it("passes through an asynchronously resolved principal", async () => {
    const source = createFailClosedRequestAuthPrincipalSource(async () =>
      guidePrincipal(),
    );

    await expect(source.resolveAuthenticatedUser()).resolves.toEqual(
      guidePrincipal(),
    );
  });

  it("treats a null result as a deny", async () => {
    const source = createFailClosedRequestAuthPrincipalSource(() => null);

    await expect(source.resolveAuthenticatedUser()).resolves.toBeNull();
  });

  it("converts a thrown error to a null deny and does not rethrow", async () => {
    const source = createFailClosedRequestAuthPrincipalSource(() => {
      throw new Error("token-bearing failure that must not leak");
    });

    await expect(source.resolveAuthenticatedUser()).resolves.toBeNull();
  });

  it("converts a rejected promise to a null deny and does not reject", async () => {
    const source = createFailClosedRequestAuthPrincipalSource(() =>
      Promise.reject(new Error("verification failed")),
    );

    await expect(source.resolveAuthenticatedUser()).resolves.toBeNull();
  });
});

// Correction D-14 (2026-11-09; REV341c finding 1): the optional deadline and
// cancellation over the whole resolver call.
describe("createFailClosedRequestAuthPrincipalSource - deadline and cancellation (D-14)", () => {
  // A resolver answer the test settles by hand, as a stalled provider would
  // not settle at all.
  function deferred() {
    let resolve: (principal: SupabaseAuthenticatedUser | null) => void = () => undefined;
    let reject: (error: Error) => void = () => undefined;
    const promise = new Promise<SupabaseAuthenticatedUser | null>((settleWith, failWith) => {
      resolve = settleWith;
      reject = failWith;
    });
    return { promise, resolve, reject };
  }

  // Whether a promise has settled, without waiting for it.
  async function isSettled(promise: Promise<unknown>): Promise<boolean> {
    let settled = false;
    void promise.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await vi.advanceTimersByTimeAsync(0);
    return settled;
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it("RAD-001 a resolver that never settles is denied at the deadline, not before", async () => {
    vi.useFakeTimers();
    const answer = deferred();
    const source = createFailClosedRequestAuthPrincipalSource(() => answer.promise, { deadlineMs: 3_000 });

    const result = source.resolveAuthenticatedUser();
    await vi.advanceTimersByTimeAsync(2_999);
    expect(await isSettled(result)).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("RAD-002 a valid principal that arrives after the deadline is ignored", async () => {
    vi.useFakeTimers();
    const answer = deferred();
    const source = createFailClosedRequestAuthPrincipalSource(() => answer.promise, { deadlineMs: 3_000 });

    const result = source.resolveAuthenticatedUser();
    await vi.advanceTimersByTimeAsync(3_000);
    answer.resolve(guidePrincipal());
    await expect(result).resolves.toBeNull();
  });

  it("RAD-003 a rejection that arrives after the deadline is consumed: nothing is left unhandled", async () => {
    vi.useFakeTimers();
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      const answer = deferred();
      const source = createFailClosedRequestAuthPrincipalSource(() => answer.promise, { deadlineMs: 3_000 });
      const result = source.resolveAuthenticatedUser();
      await vi.advanceTimersByTimeAsync(3_000);
      await expect(result).resolves.toBeNull();
      answer.reject(new Error("a late, token-bearing failure"));
      vi.useRealTimers();
      await new Promise((settle) => setTimeout(settle, 20));
      expect(unhandled).toEqual([]);
    } finally {
      process.removeListener("unhandledRejection", onUnhandled);
    }
  });

  it("RAD-004 an answer before the deadline passes through, and the timer is removed", async () => {
    vi.useFakeTimers();
    const answer = deferred();
    const source = createFailClosedRequestAuthPrincipalSource(() => answer.promise, { deadlineMs: 3_000 });

    const result = source.resolveAuthenticatedUser();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(vi.getTimerCount()).toBe(1);
    answer.resolve(guidePrincipal());
    await expect(result).resolves.toEqual(guidePrincipal());
    expect(vi.getTimerCount()).toBe(0);
    // A rejection or a null answer before the deadline still denies.
    const failing = createFailClosedRequestAuthPrincipalSource(() => Promise.reject(new Error("refused")), {
      deadlineMs: 3_000,
    });
    await expect(failing.resolveAuthenticatedUser()).resolves.toBeNull();
    const empty = createFailClosedRequestAuthPrincipalSource(() => null, { deadlineMs: 3_000 });
    await expect(empty.resolveAuthenticatedUser()).resolves.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("RAD-005 a signal that has already aborted denies without calling the resolver", async () => {
    const controller = new AbortController();
    controller.abort();
    const resolve = vi.fn(() => guidePrincipal());
    const source = createFailClosedRequestAuthPrincipalSource(resolve, {
      deadlineMs: 3_000,
      signal: controller.signal,
    });

    await expect(source.resolveAuthenticatedUser()).resolves.toBeNull();
    expect(resolve).not.toHaveBeenCalled();
  });

  it("RAD-006 a signal that aborts while the resolver waits denies at once; its listener and the timer are removed", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const added = vi.spyOn(controller.signal, "addEventListener");
    const removed = vi.spyOn(controller.signal, "removeEventListener");
    const answer = deferred();
    const source = createFailClosedRequestAuthPrincipalSource(() => answer.promise, {
      deadlineMs: 3_000,
      signal: controller.signal,
    });

    const result = source.resolveAuthenticatedUser();
    await vi.advanceTimersByTimeAsync(100);
    expect(await isSettled(result)).toBe(false);
    controller.abort();
    await expect(result).resolves.toBeNull();
    answer.resolve(guidePrincipal());
    expect(vi.getTimerCount()).toBe(0);
    expect(added).toHaveBeenCalledTimes(1);
    expect(removed).toHaveBeenCalledTimes(1);
    expect(removed.mock.calls[0][1]).toBe(added.mock.calls[0][1]);
  });

  it("RAD-007 a signal alone, with no deadline, still lets an answer through and still cancels", async () => {
    const controller = new AbortController();
    const passing = createFailClosedRequestAuthPrincipalSource(async () => guidePrincipal(), {
      signal: controller.signal,
    });
    await expect(passing.resolveAuthenticatedUser()).resolves.toEqual(guidePrincipal());

    const answer = deferred();
    const waiting = createFailClosedRequestAuthPrincipalSource(() => answer.promise, { signal: controller.signal });
    const result = waiting.resolveAuthenticatedUser();
    controller.abort();
    await expect(result).resolves.toBeNull();
  });

  it("RAD-016 a cancellation in the same moment as an answer that has already won the race still denies", async () => {
    // The answer settles first and wins the race; the abort runs in the next
    // queued step, before the wrapper reads the race's result.
    const controller = new AbortController();
    const source = createFailClosedRequestAuthPrincipalSource(() => Promise.resolve(guidePrincipal()), {
      signal: controller.signal,
    });
    const result = source.resolveAuthenticatedUser();
    queueMicrotask(() => controller.abort());
    await expect(result).resolves.toBeNull();

    // Control: with no abort in that moment the same answer is used.
    const calm = new AbortController();
    const control = createFailClosedRequestAuthPrincipalSource(() => Promise.resolve(guidePrincipal()), {
      signal: calm.signal,
    });
    await expect(control.resolveAuthenticatedUser()).resolves.toEqual(guidePrincipal());
  });

  it("RAD-008 a deadline that is not a positive whole number a timer can hold is refused when the source is built", () => {
    for (const deadlineMs of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 31, 2 ** 53]) {
      expect(() =>
        createFailClosedRequestAuthPrincipalSource(() => null, { deadlineMs }),
      ).toThrow("SolMind server configuration error: the request-auth deadline is invalid.");
    }
    // The largest delay a timer holds is accepted.
    expect(() =>
      createFailClosedRequestAuthPrincipalSource(() => null, { deadlineMs: 2 ** 31 - 1 }),
    ).not.toThrow();
  });

  it("RAD-017 an answer processed at the deadline before the overdue timer has run is denied (a monotonic deadline)", async () => {
    // Only the timer functions are faked, so the deadline's timer never runs
    // here; the clock the wrapper reads (performance.now) is moved forward by
    // hand, as a busy event loop would move it. A control answers just inside.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const realNow = performance.now.bind(performance);
    let offset = 0;
    const clock = vi.spyOn(performance, "now").mockImplementation(() => realNow() + offset);
    try {
      const late = deferred();
      const lateSource = createFailClosedRequestAuthPrincipalSource(() => late.promise, { deadlineMs: 3_000 });
      const lateResult = lateSource.resolveAuthenticatedUser();
      offset += 3_000;
      late.resolve(guidePrincipal());
      await expect(lateResult).resolves.toBeNull();
      expect(vi.getTimerCount()).toBe(0);

      offset = 0;
      const inside = deferred();
      const insideSource = createFailClosedRequestAuthPrincipalSource(() => inside.promise, { deadlineMs: 3_000 });
      const insideResult = insideSource.resolveAuthenticatedUser();
      offset += 2_000;
      inside.resolve(guidePrincipal());
      await expect(insideResult).resolves.toEqual(guidePrincipal());
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      clock.mockRestore();
    }
  });

  it("RAD-020 the deadline counts from before the resolver runs: a slow synchronous part leaves less time to wait", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const realNow = performance.now.bind(performance);
    let offset = 0;
    const clock = vi.spyOn(performance, "now").mockImplementation(() => realNow() + offset);
    try {
      const answer = deferred();
      const source = createFailClosedRequestAuthPrincipalSource(
        () => {
          offset += 2_000;
          return answer.promise;
        },
        { deadlineMs: 3_000 },
      );
      const result = source.resolveAuthenticatedUser();
      await vi.advanceTimersByTimeAsync(1_000);
      await expect(result).resolves.toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      clock.mockRestore();
    }
  });

  it("RAD-018 a cancellation during the resolver's own synchronous part denies", async () => {
    const controller = new AbortController();
    const source = createFailClosedRequestAuthPrincipalSource(
      () => {
        controller.abort();
        return new Promise<SupabaseAuthenticatedUser | null>((settle) => {
          setTimeout(() => settle(guidePrincipal()), 20);
        });
      },
      { deadlineMs: 3_000, signal: controller.signal },
    );
    await expect(source.resolveAuthenticatedUser()).resolves.toBeNull();
  });

  it("RAD-009 without options a waiting resolver keeps the earlier behavior: no timer is set", async () => {
    vi.useFakeTimers();
    const answer = deferred();
    const source = createFailClosedRequestAuthPrincipalSource(() => answer.promise);

    const result = source.resolveAuthenticatedUser();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(vi.getTimerCount()).toBe(0);
    expect(await isSettled(result)).toBe(false);
    answer.resolve(guidePrincipal());
    await expect(result).resolves.toEqual(guidePrincipal());
  });
});
