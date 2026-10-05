import * as nodeCrypto from "node:crypto";
import { inspect } from "node:util";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  VERIFICATION_CHALLENGE_REDEMPTION_FUNCTION,
  VERIFICATION_CHALLENGE_REDEMPTION_OUTCOMES,
  VerificationChallengeError,
  createVerificationChallengeRedeemerWithSlots,
  type VerificationCallSlots,
  type VerificationChallengeRedeemerDependencies,
  type VerificationChallengeRedemptionRequest,
  type VerificationChallengeRpcClient,
} from "../verificationChallengeCallersCore";
import { createVerificationCodePepper } from "../verificationCode";

// Partial mock: the real HMAC runs, but its use is observable, so the tests
// can prove that malformed input is refused before any HMAC.
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, createHmac: vi.fn(actual.createHmac) };
});

// The register's AUTH-RLS-DEC-032 known-answer test: the banked redemption
// pgTAP suite redeems exactly this selector and verifier
// (supabase/tests/verification_challenge_redemption_realpath_test.sql).
const PEPPER_TEXT = "SOLMIND-SYNTHETIC-TEST-PEPPER-01";
const PEPPER = createVerificationCodePepper(Buffer.from(PEPPER_TEXT, "ascii"));
const KAT_CHALLENGE_ID = "00000000-0000-4000-8000-000000000001";
const KAT_CODE = "000000";
const KAT_VERIFIER =
  "svf1:ecab5e52743c2befef754a1568a90e466dac2777d43c18162914acca44e8960d";
const LETTERED_CHALLENGE_ID = "6f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

// Every final line terminator JavaScript knows, built from code points so
// this file stays ASCII.
const LINE_TERMINATORS: ReadonlyArray<readonly [string, string]> = [
  ["LF", "\n"],
  ["CR", "\r"],
  ["CRLF", "\r\n"],
  ["U+2028", String.fromCharCode(0x2028)],
  ["U+2029", String.fromCharCode(0x2029)],
];

type RpcCall = Readonly<{
  functionName: string;
  args: Readonly<Record<string, string | null>>;
  signal: AbortSignal | null;
}>;

function rpcResponse(data: unknown, error: unknown = null) {
  return Promise.resolve({ data, error, count: null, status: 200, statusText: "OK" });
}

// A fake of the seam: rpc() returns a request whose abortSignal() records the
// signal and returns the awaitable answer, as postgrest-js's builder does.
function fakeRpc(respond: (call: RpcCall) => unknown = () => rpcResponse([{ outcome: "redeemed" }])) {
  const calls: RpcCall[] = [];
  const rpc = vi.fn((functionName: string, args: Readonly<Record<string, string | null>>) => ({
    abortSignal: (signal: AbortSignal) => {
      const call = Object.freeze({ functionName, args: Object.freeze({ ...args }), signal });
      calls.push(call);
      return respond(call) as PromiseLike<unknown>;
    },
  }));
  const client: VerificationChallengeRpcClient = { rpc };
  return { client, rpc, calls };
}

function fakeSlots(available = true) {
  const release = vi.fn();
  const tryAcquire = vi.fn(() => (available ? release : null));
  return { slots: { tryAcquire }, tryAcquire, release };
}

type RedeemerOverrides = Partial<
  Record<keyof VerificationChallengeRedeemerDependencies | "redemptionSlots", unknown>
>;

// Builds through the restricted core, as only the public module and the three
// named unit tests (this file among them) may: the pool (a fake unless the
// test gives one) is the separate second argument, never part of the
// dependency object.
function buildRedeemer(overrides: RedeemerOverrides = {}) {
  const { redemptionSlots = fakeSlots().slots, ...rest } = overrides;
  return createVerificationChallengeRedeemerWithSlots(dependencies(rest), redemptionSlots as VerificationCallSlots);
}

function dependencies(
  overrides: Partial<Record<keyof VerificationChallengeRedeemerDependencies, unknown>> = {},
): VerificationChallengeRedeemerDependencies {
  return {
    rpcClient: fakeRpc().client,
    rpcTimeoutMilliseconds: 1_000,
    pepper: PEPPER,
    ...overrides,
  } as VerificationChallengeRedeemerDependencies;
}

function request(overrides: Record<string, unknown> = {}): VerificationChallengeRedemptionRequest {
  return {
    purpose: "login",
    challengeId: KAT_CHALLENGE_ID,
    code: KAT_CODE,
    ...overrides,
  } as VerificationChallengeRedemptionRequest;
}

function textOf(value: unknown): string {
  let json = "";
  try {
    json = JSON.stringify(value) ?? "";
  } catch {
    json = "";
  }
  return [
    json,
    String(value),
    inspect(value, { showHidden: true, depth: 5 }),
    value instanceof Error ? `${value.name} ${value.message} ${value.stack ?? ""}` : "",
  ].join(" ");
}

function expectValueFree(value: unknown, secrets: ReadonlyArray<string>): void {
  const text = textOf(value);
  for (const secret of secrets) {
    expect(text).not.toContain(secret);
  }
}

function expectWiringError(action: () => unknown): void {
  let error: unknown = null;
  try {
    action();
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(VerificationChallengeError);
  expect((error as Error).message).toBe("verification_challenge_invalid_configuration");
  expectValueFree(error, [PEPPER_TEXT]);
}

function hostileError(): Error {
  return new Error(`hostile ${KAT_CODE} ${KAT_VERIFIER} ${PEPPER_TEXT}`);
}

async function settle(turns = 5): Promise<void> {
  for (let turn = 0; turn < turns; turn += 1) {
    await Promise.resolve();
  }
}

// Holds the event loop for at least `milliseconds`, so no timer can run.
function blockEventLoop(milliseconds: number): void {
  const start = performance.now();
  while (performance.now() - start < milliseconds) {
    // Busy wait on purpose.
  }
}

const createHmacSpy = vi.mocked(nodeCrypto.createHmac);

beforeEach(() => {
  createHmacSpy.mockClear();
  for (const method of CONSOLE_METHODS) {
    vi.spyOn(console, method);
  }
});

afterEach(() => {
  for (const method of CONSOLE_METHODS) {
    expect(console[method]).not.toHaveBeenCalled();
  }
  vi.restoreAllMocks();
});

describe("verificationChallengeCallers - redeeming a challenge", () => {
  it("VCR-001 sends the selector, the route's purpose and the svf1 verifier, never the code", async () => {
    const rpc = fakeRpc();
    const slots = fakeSlots();
    const redeemer = buildRedeemer({ rpcClient: rpc.client, redemptionSlots: slots.slots });
    const result = await redeemer.redeem(request());
    await settle();

    expect(result).toEqual({ outcome: "redeemed" });
    expect(Object.isFrozen(result)).toBe(true);
    expect(rpc.calls.map(({ functionName, args }) => ({ functionName, args }))).toEqual([
      {
        functionName: VERIFICATION_CHALLENGE_REDEMPTION_FUNCTION,
        args: {
          p_verification_challenge_id: KAT_CHALLENGE_ID,
          p_purpose: "login",
          // The verifier the banked pgTAP suite redeems for this selector.
          p_verifier: KAT_VERIFIER,
        },
      },
    ]);
    expect(rpc.calls[0].signal).toBeInstanceOf(AbortSignal);
    expect(VERIFICATION_CHALLENGE_REDEMPTION_FUNCTION).toBe(
      "solmind_redeem_verification_challenge",
    );
    expect(Object.values(rpc.calls[0].args)).not.toContain(KAT_CODE);
    expectValueFree(result, [KAT_CODE, KAT_VERIFIER, KAT_CHALLENGE_ID, PEPPER_TEXT]);
    expect(slots.tryAcquire).toHaveBeenCalledTimes(1);
    expect(slots.release).toHaveBeenCalledTimes(1);
  });

  it("VCR-002 maps a denied row to denied, and binds the verifier to the purpose the route fixed", async () => {
    for (const purpose of [
      "login",
      "password_reset",
      "contact_verify",
      "first_admin_setup",
      "role_reentry",
    ]) {
      const rpc = fakeRpc(() => rpcResponse([{ outcome: "denied" }]));
      const redeemer = buildRedeemer({ rpcClient: rpc.client });
      await expect(redeemer.redeem(request({ purpose }))).resolves.toEqual({ outcome: "denied" });
      expect(rpc.calls[0].args.p_purpose).toBe(purpose);
      if (purpose !== "login") {
        expect(rpc.calls[0].args.p_verifier).not.toBe(KAT_VERIFIER);
      }
    }
  });

  it("VCR-003 treats every other answer, throw, rejection or late answer as failed", async () => {
    const responders: ReadonlyArray<() => unknown> = [
      () => rpcResponse([]),
      () => rpcResponse([{ outcome: "redeemed" }, { outcome: "redeemed" }]),
      () => rpcResponse([{ outcome: "redeemed", extra: 1 }]),
      () => rpcResponse([{ outcome: "issued" }]),
      () => rpcResponse([{ outcome: "Redeemed" }]),
      () => rpcResponse({ outcome: "redeemed" }),
      () => rpcResponse(null),
      () => rpcResponse([{ outcome: "redeemed" }], { message: "unexpected" }),
      () =>
        rpcResponse(null, {
          code: "P0001",
          message: "solmind_redeem_invalid_verifier_format",
        }),
      () => rpcResponse(null, { code: "P0001", message: "solmind_redeem_cardinality_violation" }),
      () => Promise.resolve(undefined),
      () => Promise.reject(hostileError()),
      () => {
        throw hostileError();
      },
    ];
    for (const respond of responders) {
      const rpc = fakeRpc(respond);
      const redeemer = buildRedeemer({ rpcClient: rpc.client });
      const result = await redeemer.redeem(request());
      expect(result).toEqual({ outcome: "failed" });
      // One call, never a retry.
      expect(rpc.rpc).toHaveBeenCalledTimes(1);
      expectValueFree(result, [KAT_CODE, KAT_VERIFIER, "hostile"]);
    }

    let resolveLate: (value: unknown) => void = () => undefined;
    const late = fakeRpc(
      () =>
        new Promise((resolve) => {
          resolveLate = resolve;
        }),
    );
    const slots = fakeSlots();
    const redeemer = buildRedeemer({ rpcClient: late.client, rpcTimeoutMilliseconds: 20, redemptionSlots: slots.slots });
    await expect(redeemer.redeem(request())).resolves.toEqual({ outcome: "failed" });
    expect(late.calls[0].signal?.aborted).toBe(true);
    // The call is still outstanding, so its slot is still held until it settles.
    await settle(20);
    expect(slots.release).not.toHaveBeenCalled();
    resolveLate({ data: [{ outcome: "redeemed" }], error: null });
    await settle(20);
    expect(slots.release).toHaveBeenCalledTimes(1);
  });

  it("VCR-004 refuses a malformed selector, code, purpose or request without calling the database", async () => {
    const getter = request();
    Object.defineProperty(getter, "code", {
      enumerable: true,
      get: () => {
        throw hostileError();
      },
    });
    const arabicIndicDigits = String.fromCharCode(0x0661, 0x0662, 0x0663, 0x0664, 0x0665, 0x0666);
    const malformed: ReadonlyArray<unknown> = [
      // The verifier message requires the lowercase canonical UUID.
      request({ challengeId: LETTERED_CHALLENGE_ID.toUpperCase() }),
      request({ challengeId: LETTERED_CHALLENGE_ID.replace(/-/g, "") }),
      request({ challengeId: `${KAT_CHALLENGE_ID} ` }),
      request({ challengeId: "" }),
      request({ challengeId: null }),
      request({ code: "12345" }),
      request({ code: "1234567" }),
      request({ code: " 123456" }),
      request({ code: "12345a" }),
      request({ code: arabicIndicDigits }),
      request({ code: 123456 }),
      request({ purpose: "signup" }),
      request({ purpose: "Login" }),
      { ...request(), verifier: KAT_VERIFIER },
      { purpose: "login", challengeId: KAT_CHALLENGE_ID },
      getter,
      new Proxy(request(), {
        getPrototypeOf: () => {
          throw hostileError();
        },
      }),
      Object.assign(Object.create({ inherited: true }), request()),
      [request()],
      null,
      KAT_CODE,
    ];
    for (const input of malformed) {
      const rpc = fakeRpc();
      const slots = fakeSlots();
      const redeemer = buildRedeemer({ rpcClient: rpc.client, redemptionSlots: slots.slots });
      const result = await redeemer.redeem(input as VerificationChallengeRedemptionRequest);
      expect(result).toEqual({ outcome: "invalid_request" });
      expect(rpc.rpc).not.toHaveBeenCalled();
      expect(slots.tryAcquire).not.toHaveBeenCalled();
      expectValueFree(result, [KAT_CODE, KAT_VERIFIER, "hostile"]);
    }
    expect(createHmacSpy).not.toHaveBeenCalled();
  });

  it("VCR-005 returns only shared, frozen results from the closed set", async () => {
    expect(VERIFICATION_CHALLENGE_REDEMPTION_OUTCOMES).toEqual([
      "redeemed",
      "denied",
      "busy",
      "invalid_request",
      "failed",
    ]);
    const redeemer = buildRedeemer();
    const first = await redeemer.redeem(request());
    const second = await redeemer.redeem(request());
    expect(first).toBe(second);
    expect(Object.keys(first)).toEqual(["outcome"]);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("VCR-006 refuses malformed wiring with one fixed, value-free error", () => {
    for (const wiring of [
      dependencies({ rpcClient: {} }),
      dependencies({ rpcTimeoutMilliseconds: 0 }),
      dependencies({ rpcTimeoutMilliseconds: 60_001 }),
      dependencies({ pepper: Buffer.from(PEPPER_TEXT, "ascii") }),
      dependencies({ pepper: Object.freeze({}) }),
      // A pool is never part of the dependency object, so one there is an
      // extra key and is refused.
      { ...dependencies(), redemptionSlots: fakeSlots().slots },
      { ...dependencies(), deliveryTransport: { send: async () => "accepted" } },
      { rpcClient: fakeRpc().client, pepper: PEPPER },
      null,
    ]) {
      expectWiringError(() =>
        createVerificationChallengeRedeemerWithSlots(
          wiring as VerificationChallengeRedeemerDependencies,
          fakeSlots().slots,
        ),
      );
    }
    // The pool, the separate second argument, is checked too.
    for (const slots of [{}, null, { tryAcquire: "slot" }, "slots", undefined]) {
      expectWiringError(() =>
        createVerificationChallengeRedeemerWithSlots(dependencies(), slots as never),
      );
    }
  });

  it("VCR-007 targets exactly the submitted selector: one call per redemption, no lookup or scan", async () => {
    const rpc = fakeRpc(() => rpcResponse([{ outcome: "denied" }]));
    const redeemer = buildRedeemer({ rpcClient: rpc.client });
    await redeemer.redeem(request({ challengeId: LETTERED_CHALLENGE_ID, code: "123456" }));
    await redeemer.redeem(request({ challengeId: LETTERED_CHALLENGE_ID, code: "654321" }));
    expect(rpc.calls.map((call) => call.functionName)).toEqual([
      VERIFICATION_CHALLENGE_REDEMPTION_FUNCTION,
      VERIFICATION_CHALLENGE_REDEMPTION_FUNCTION,
    ]);
    expect(rpc.calls.map((call) => call.args.p_verification_challenge_id)).toEqual([
      LETTERED_CHALLENGE_ID,
      LETTERED_CHALLENGE_ID,
    ]);
    expect(rpc.calls[0].args.p_verifier).not.toBe(rpc.calls[1].args.p_verifier);
  });

  it("VCR-008 refuses a final line terminator on each field before any HMAC or database call, and redeems the otherwise identical request", async () => {
    // Each case pairs a valid request with the same request whose one field
    // gains the terminator, so the refusal is the terminator's.
    for (const [name, terminator] of LINE_TERMINATORS) {
      const cases: ReadonlyArray<readonly [string, VerificationChallengeRedemptionRequest, VerificationChallengeRedemptionRequest]> = [
        ["selector", request(), request({ challengeId: `${KAT_CHALLENGE_ID}${terminator}` })],
        ["code", request(), request({ code: `${KAT_CODE}${terminator}` })],
        ["purpose", request(), request({ purpose: `login${terminator}` })],
      ];
      for (const [field, valid, malformed] of cases) {
        const label = `${field} + ${name}`;
        const differing = Object.keys(valid).filter(
          (key) =>
            valid[key as keyof VerificationChallengeRedemptionRequest] !==
            malformed[key as keyof VerificationChallengeRedemptionRequest],
        );
        expect(differing, label).toHaveLength(1);

        createHmacSpy.mockClear();
        const refusedRpc = fakeRpc();
        const refusedSlots = fakeSlots();
        await expect(
          buildRedeemer({ rpcClient: refusedRpc.client, redemptionSlots: refusedSlots.slots }).redeem(
            malformed,
          ),
          label,
        ).resolves.toEqual({ outcome: "invalid_request" });
        expect(refusedRpc.rpc, label).not.toHaveBeenCalled();
        expect(refusedSlots.tryAcquire, label).not.toHaveBeenCalled();
        expect(createHmacSpy, label).not.toHaveBeenCalled();

        const acceptedRpc = fakeRpc();
        await expect(buildRedeemer({ rpcClient: acceptedRpc.client }).redeem(valid), label).resolves.toEqual({
          outcome: "redeemed",
        });
        expect(acceptedRpc.rpc, label).toHaveBeenCalledTimes(1);
        expect(createHmacSpy, label).toHaveBeenCalledTimes(1);
      }
    }
  });

  it("VCR-009 accepts no redemption when the deadline passes while the event loop is blocked, before the timer can run", async () => {
    let resolveRpc: (value: unknown) => void = () => undefined;
    const rpc = fakeRpc(
      () =>
        new Promise((resolve) => {
          resolveRpc = resolve;
        }),
    );
    const redeemer = buildRedeemer({ rpcClient: rpc.client, rpcTimeoutMilliseconds: 20 });
    const pending = redeemer.redeem(request());
    await settle(20);
    expect(rpc.rpc).toHaveBeenCalledTimes(1);
    resolveRpc({ data: [{ outcome: "redeemed" }], error: null });
    blockEventLoop(60);
    await expect(pending).resolves.toEqual({ outcome: "failed" });

    // The settle-time check alone decides a late `denied` answer: `failed`.
    const latePending = redeemer.redeem(request());
    await settle(20);
    resolveRpc({ data: [{ outcome: "denied" }], error: null });
    blockEventLoop(60);
    await expect(latePending).resolves.toEqual({ outcome: "failed" });
  });

  it("VCR-010 checks the deadline again just before a redemption is accepted", async () => {
    let clock = 1_000;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    const answer = {
      get data() {
        clock = 5_000;
        return [{ outcome: "redeemed" }];
      },
      error: null,
    };
    const rpc = fakeRpc(() => Promise.resolve(answer));
    const redeemer = buildRedeemer({ rpcClient: rpc.client });
    await expect(redeemer.redeem(request())).resolves.toEqual({ outcome: "failed" });
    expect(clock).toBe(5_000);
  });

  it("VCR-011 returns busy without a database call when no redemption slot is free", async () => {
    for (const tryAcquire of [
      vi.fn(() => null),
      vi.fn(() => "slot"),
      vi.fn(() => {
        throw hostileError();
      }),
    ]) {
      const rpc = fakeRpc();
      const redeemer = buildRedeemer({ rpcClient: rpc.client, redemptionSlots: { tryAcquire } });
      await expect(redeemer.redeem(request())).resolves.toEqual({ outcome: "busy" });
      expect(tryAcquire).toHaveBeenCalledTimes(1);
      expect(rpc.rpc).not.toHaveBeenCalled();
    }
    expect(createHmacSpy).not.toHaveBeenCalled();
  });
});
