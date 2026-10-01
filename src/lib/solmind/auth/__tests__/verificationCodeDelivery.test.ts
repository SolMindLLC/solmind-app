import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import * as authBarrel from "../index";
import {
  VERIFICATION_CODE_DELIVERY_ERROR_CODES,
  VERIFICATION_CODE_DELIVERY_LIMITS,
  VERIFICATION_CODE_DELIVERY_OUTCOMES,
  VerificationCodeDeliveryError,
  deliverVerificationCode,
  prepareVerificationCodeDelivery,
  type PrepareVerificationCodeDeliveryInput,
  type PreparedVerificationCodeDelivery,
  type VerificationCodeDeliveryOutcome,
  type VerificationCodeDeliveryRequest,
  type VerificationCodeDeliveryTransport,
} from "../verificationCodeDelivery";

const CODE = "481926";
const CONTACT = "explorer.p4@synthetic.invalid";
const PHONE = "+15555550142";
const CHALLENGE_ID = "6f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";

function input(
  overrides: Record<string, unknown> = {},
): PrepareVerificationCodeDeliveryInput {
  return {
    issuanceOutcome: "issued",
    channel: "email",
    normalizedContact: CONTACT,
    code: CODE,
    purpose: "login",
    challengeId: CHALLENGE_ID,
    ...overrides,
  } as PrepareVerificationCodeDeliveryInput;
}

function transportReturning(value: unknown) {
  return {
    send: vi.fn<VerificationCodeDeliveryTransport["send"]>(async () => value),
  };
}

function expectValueFree(value: unknown): void {
  const text = [
    JSON.stringify(value),
    String(value),
    value instanceof Error
      ? `${value.name} ${value.message} ${value.stack ?? ""} ${String(value.cause ?? "")}`
      : "",
  ].join(" ");
  for (const secret of [CODE, CONTACT, PHONE, CHALLENGE_ID]) {
    expect(text).not.toContain(secret);
  }
}

// Hostile inputs: every read they run throws an Error that carries the code
// and the contact, so a leak would show up in expectValueFree.
function hostileError(): Error {
  return new Error(`hostile ${CODE} ${CONTACT}`);
}

function throwingAccessor<T extends object>(target: T, key: string): T {
  return Object.defineProperty(target, key, {
    enumerable: true,
    configurable: true,
    get: () => {
      throw hostileError();
    },
  });
}

const PROXY_TRAPS = [
  "getPrototypeOf",
  "ownKeys",
  "getOwnPropertyDescriptor",
  "get",
  "has",
] as const;

function hostileProxy<T extends object>(
  target: T,
  traps: ReadonlyArray<(typeof PROXY_TRAPS)[number]> = PROXY_TRAPS,
): T {
  const handler: ProxyHandler<T> = {};
  for (const trap of traps) {
    handler[trap] = () => {
      throw hostileError();
    };
  }
  return new Proxy(target, handler);
}

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error("expected the action to throw");
}

function expectDeliveryError(action: () => unknown, code: string): void {
  const error = captureError(action);
  expect(error).toBeInstanceOf(VerificationCodeDeliveryError);
  expect((error as VerificationCodeDeliveryError).code).toBe(code);
  expect((error as Error).message).toBe(code);
  expectValueFree(error);
}

async function expectDeliveryRejection(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  const error = await promise.then(
    () => {
      throw new Error("expected the delivery to reject");
    },
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(VerificationCodeDeliveryError);
  expect((error as VerificationCodeDeliveryError).code).toBe(code);
  expectValueFree(error);
}

describe("verificationCodeDelivery - preparation after issuance", () => {
  it("VCD-001 accepts only the literal issued outcome and returns an opaque handle", () => {
    const handle = prepareVerificationCodeDelivery(input());
    expect(Object.isFrozen(handle)).toBe(true);
    expect(Reflect.ownKeys(handle)).toEqual([]);
    expect(JSON.stringify(handle)).toBe("{}");
    expectValueFree(handle);

    for (const issuanceOutcome of [
      "denied",
      "Issued",
      " issued",
      "issued ",
      "",
      null,
      undefined,
      true,
    ]) {
      expectDeliveryError(
        () => prepareVerificationCodeDelivery(input({ issuanceOutcome })),
        "verification_code_delivery_not_issued",
      );
    }
    const withoutOutcome: Record<string, unknown> = { ...input() };
    delete withoutOutcome.issuanceOutcome;
    expectDeliveryError(
      () =>
        prepareVerificationCodeDelivery(
          withoutOutcome as PrepareVerificationCodeDeliveryInput,
        ),
      "verification_code_delivery_not_issued",
    );
  });

  it("VCD-002 accepts every schema purpose, SMS in E.164 form, and an omitted challenge id", async () => {
    for (const purpose of [
      "login",
      "password_reset",
      "contact_verify",
      "first_admin_setup",
      "role_reentry",
    ]) {
      expect(() => prepareVerificationCodeDelivery(input({ purpose }))).not.toThrow();
    }

    const transport = transportReturning("terminal_failure");
    const smsInput: Record<string, unknown> = {
      ...input({ channel: "sms", normalizedContact: PHONE }),
    };
    delete smsInput.challengeId;
    await deliverVerificationCode({
      delivery: prepareVerificationCodeDelivery(
        smsInput as PrepareVerificationCodeDeliveryInput,
      ),
      transport,
      timeoutMilliseconds: 1_000,
    });
    const sent = transport.send.mock.calls[0][0] as VerificationCodeDeliveryRequest;
    expect(sent).toEqual({
      channel: "sms",
      normalizedContact: PHONE,
      code: CODE,
      purpose: "login",
      challengeId: null,
    });
    expect(Object.isFrozen(sent)).toBe(true);
    expect(transport.send.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ["an unknown channel", { channel: "voice" }],
    ["an uppercase email", { normalizedContact: "Explorer@synthetic.invalid" }],
    ["an email with CR/LF", { normalizedContact: `${CONTACT}\r\nBcc: x@y.invalid` }],
    ["an email with a trailing LF", { normalizedContact: `${CONTACT}\n` }],
    ["an email with angle brackets", { normalizedContact: "<a@b.invalid>" }],
    ["an email with consecutive dots", { normalizedContact: "a..b@synthetic.invalid" }],
    ["an email over 254 characters", { normalizedContact: `${"a".repeat(250)}@b.invalid` }],
    ["a phone on the email channel", { normalizedContact: PHONE }],
    ["an email on the SMS channel", { channel: "sms" }],
    ["a phone without E.164 form", { channel: "sms", normalizedContact: "5555550142" }],
    ["a five-digit code", { code: "48192" }],
    ["a seven-digit code", { code: "4819260" }],
    ["a code with a letter", { code: "48192a" }],
    ["a code with a trailing LF", { code: `${CODE}\n` }],
    [
      "a code in Arabic-Indic digits",
      { code: String.fromCharCode(0x0664, 0x0668, 0x0661, 0x0669, 0x0662, 0x0666) },
    ],
    ["a numeric code", { code: 481926 }],
    ["an unknown purpose", { purpose: "signup" }],
    ["an uppercase challenge id", { challengeId: CHALLENGE_ID.toUpperCase() }],
    ["a malformed challenge id", { challengeId: "not-a-uuid" }],
    ["a null challenge id", { challengeId: null }],
    ["an extra key", { accountId: "11111111-1111-4111-8111-111111111111" }],
  ])("VCD-003 rejects %s with one fixed value-free error", (_label, overrides) => {
    expectDeliveryError(
      () => prepareVerificationCodeDelivery(input(overrides)),
      "verification_code_delivery_invalid_request",
    );
  });

  it("VCD-004 rejects non-plain input objects", () => {
    for (const value of [null, undefined, "issued", [], new Map()]) {
      expectDeliveryError(
        () =>
          prepareVerificationCodeDelivery(
            value as unknown as PrepareVerificationCodeDeliveryInput,
          ),
        "verification_code_delivery_invalid_request",
      );
    }
    const missingCode: Record<string, unknown> = { ...input() };
    delete missingCode.code;
    expectDeliveryError(
      () =>
        prepareVerificationCodeDelivery(
          missingCode as PrepareVerificationCodeDeliveryInput,
        ),
      "verification_code_delivery_invalid_request",
    );
  });

  it("VCD-016 refuses getters and hostile Proxies with its own fixed value-free error, never theirs", () => {
    for (const key of [
      "issuanceOutcome",
      "channel",
      "normalizedContact",
      "code",
      "purpose",
      "challengeId",
      "unexpectedKey",
    ]) {
      expectDeliveryError(
        () => prepareVerificationCodeDelivery(throwingAccessor(input(), key)),
        "verification_code_delivery_invalid_request",
      );
    }
    // A getter is refused even when it would return a valid value.
    expectDeliveryError(
      () =>
        prepareVerificationCodeDelivery(
          Object.defineProperty(input(), "code", { enumerable: true, get: () => CODE }),
        ),
      "verification_code_delivery_invalid_request",
    );

    for (const traps of [
      PROXY_TRAPS,
      ["getPrototypeOf"],
      ["ownKeys"],
      ["getOwnPropertyDescriptor"],
    ] as const) {
      expectDeliveryError(
        () => prepareVerificationCodeDelivery(hostileProxy(input(), traps)),
        "verification_code_delivery_invalid_request",
      );
    }
    const revocable = Proxy.revocable(input(), {});
    revocable.revoke();
    expectDeliveryError(
      () => prepareVerificationCodeDelivery(revocable.proxy),
      "verification_code_delivery_invalid_request",
    );

    // Values are read only through own data descriptors, so hostile `get`
    // and `has` traps never run.
    expect(() =>
      prepareVerificationCodeDelivery(hostileProxy(input(), ["get", "has"])),
    ).not.toThrow();
  });
});

describe("verificationCodeDelivery - one bounded attempt", () => {
  it("VCD-005 passes every closed outcome through as a frozen value-free result", async () => {
    expect(VERIFICATION_CODE_DELIVERY_OUTCOMES).toEqual([
      "accepted",
      "delivered",
      "bounced",
      "throttled",
      "ambiguous",
      "timeout",
      "retryable_failure",
      "terminal_failure",
      "cleanup_failure",
    ]);
    for (const outcome of VERIFICATION_CODE_DELIVERY_OUTCOMES) {
      const transport = transportReturning(outcome);
      const result = await deliverVerificationCode({
        delivery: prepareVerificationCodeDelivery(input()),
        transport,
        timeoutMilliseconds: 1_000,
      });
      expect(result).toEqual({ outcome });
      expect(Reflect.ownKeys(result)).toEqual(["outcome"]);
      expect(Object.isFrozen(result)).toBe(true);
      expectValueFree(result);
      expect(transport.send).toHaveBeenCalledTimes(1);
      expect(transport.send.mock.calls[0][0]).toEqual({
        channel: "email",
        normalizedContact: CONTACT,
        code: CODE,
        purpose: "login",
        challengeId: CHALLENGE_ID,
      });
    }
  });

  it("VCD-006 has retry ceiling 0: an ambiguous result is never retried and a handle cannot be delivered twice", async () => {
    expect(VERIFICATION_CODE_DELIVERY_LIMITS).toEqual({
      retryCeiling: 0,
      attemptsPerPreparedDelivery: 1,
      minimumTimeoutMilliseconds: 10,
      maximumTimeoutMilliseconds: 15_000,
    });
    expect(Object.isFrozen(VERIFICATION_CODE_DELIVERY_LIMITS)).toBe(true);

    for (const outcome of ["ambiguous", "retryable_failure", "accepted"]) {
      const transport = transportReturning(outcome);
      const delivery = prepareVerificationCodeDelivery(input());
      await expect(
        deliverVerificationCode({ delivery, transport, timeoutMilliseconds: 1_000 }),
      ).resolves.toEqual({ outcome });
      await expectDeliveryRejection(
        deliverVerificationCode({ delivery, transport, timeoutMilliseconds: 1_000 }),
        "verification_code_delivery_already_attempted",
      );
      expect(transport.send).toHaveBeenCalledTimes(1);
    }
  });

  it("VCD-007 maps thrown, rejected and unknown transport results to ambiguous, never retryable", async () => {
    const transports: VerificationCodeDeliveryTransport[] = [
      {
        send: () => {
          throw new Error(`boom ${CODE} ${CONTACT}`);
        },
      },
      { send: async () => Promise.reject(new Error(`boom ${CODE}`)) },
      { send: async () => "sent" },
      { send: async () => ({ outcome: "accepted" }) },
      { send: async () => undefined },
      { send: async () => "ACCEPTED" },
    ];
    for (const transport of transports) {
      const result = await deliverVerificationCode({
        delivery: prepareVerificationCodeDelivery(input()),
        transport,
        timeoutMilliseconds: 1_000,
      });
      expect(result).toEqual({ outcome: "ambiguous" });
      expectValueFree(result);
    }
  });

  it("VCD-019 keeps a transport's hostile promise inside the closed outcome set", async () => {
    // A native promise whose own `then` ignores its callbacks and returns
    // another value. Called directly, it could replace the outcome with
    // anything, such as "constructor"; adopted by the module's own promise,
    // it never calls back, so the ceiling decides.
    const hostilePromise = (value: string): Promise<VerificationCodeDeliveryOutcome> => {
      const promise = Promise.resolve("accepted" as const);
      Object.defineProperty(promise, "then", {
        value: () => Promise.resolve(value),
      });
      return promise;
    };
    for (const value of ["constructor", "toString", "accepted"]) {
      const result = await deliverVerificationCode({
        delivery: prepareVerificationCodeDelivery(input()),
        transport: { send: () => hostilePromise(value) },
        timeoutMilliseconds: 50,
      });
      expect(result).toEqual({ outcome: "timeout" });
      expect(Object.keys(result)).toEqual(["outcome"]);
      expect(Object.isFrozen(result)).toBe(true);
      expectValueFree(result);
    }
  });

  it("VCD-020 lets a transport that settles on abort report only ambiguous after the ceiling", async () => {
    const settlingOnAbort = (
      react: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => void,
    ): VerificationCodeDeliveryTransport => ({
      send: (_request, signal) =>
        new Promise<unknown>((resolve, reject) => {
          signal.addEventListener("abort", () => react(resolve, reject), { once: true });
        }) as Promise<VerificationCodeDeliveryOutcome>,
    });
    const cases: ReadonlyArray<[VerificationCodeDeliveryTransport, VerificationCodeDeliveryOutcome]> = [
      [settlingOnAbort((resolve) => resolve("ambiguous")), "ambiguous"],
      [settlingOnAbort((_resolve, reject) => reject(new Error(`aborted ${CODE}`))), "ambiguous"],
      [settlingOnAbort((resolve) => resolve("accepted")), "timeout"],
      [settlingOnAbort((resolve) => resolve("delivered")), "timeout"],
      [settlingOnAbort((resolve) => resolve("terminal_failure")), "timeout"],
      [settlingOnAbort((resolve) => resolve("timeout")), "timeout"],
      [settlingOnAbort((resolve) => resolve("sent")), "timeout"],
      [settlingOnAbort((resolve) => resolve(undefined)), "timeout"],
      [settlingOnAbort((resolve) => resolve({ outcome: "ambiguous" })), "timeout"],
    ];
    for (const [transport, expected] of cases) {
      const result = await deliverVerificationCode({
        delivery: prepareVerificationCodeDelivery(input()),
        transport,
        timeoutMilliseconds: 20,
      });
      expect(result).toEqual({ outcome: expected });
      expectValueFree(result);
    }
  });

  it("VCD-021 follows the ceiling rule for a fulfilment queued before the ceiling but processed after it", async () => {
    // Each transport's promise has already settled when `send` returns, so
    // its fulfilment is queued before the ceiling. Only setTimeout and
    // clearTimeout are faked, so the ceiling can then fire synchronously,
    // before any promise callback runs. A control run first processes the
    // same fulfilment before the ceiling.
    const cases: ReadonlyArray<
      [
        VerificationCodeDeliveryTransport["send"],
        VerificationCodeDeliveryOutcome,
        VerificationCodeDeliveryOutcome,
      ]
    > = [
      // [send, processed before the ceiling, processed after it]
      [async () => "accepted", "accepted", "timeout"],
      [async () => "sent", "ambiguous", "timeout"],
      [async () => "ambiguous", "ambiguous", "ambiguous"],
      [
        async () => {
          throw new Error(`late ${CODE}`);
        },
        "ambiguous",
        "ambiguous",
      ],
    ];
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      for (const [send, beforeCeiling, afterCeiling] of cases) {
        const control = await deliverVerificationCode({
          delivery: prepareVerificationCodeDelivery(input()),
          transport: { send },
          timeoutMilliseconds: 20,
        });
        expect(control).toEqual({ outcome: beforeCeiling });

        const transport = { send: vi.fn(send) };
        const pending = deliverVerificationCode({
          delivery: prepareVerificationCodeDelivery(input()),
          transport,
          timeoutMilliseconds: 20,
        });
        // No await before this: the ceiling fires while the settled
        // fulfilment still waits to be processed. The grace turn stays
        // pending, so that fulfilment, not the grace turn, decides.
        vi.advanceTimersByTime(20);
        expect(transport.send).toHaveBeenCalledTimes(1);
        expect(transport.send.mock.calls[0][1].aborted).toBe(true);
        expect(vi.getTimerCount()).toBe(1);
        const result = await pending;
        expect(result).toEqual({ outcome: afterCeiling });
        expectValueFree(result);
        expect(vi.getTimerCount()).toBe(0);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("VCD-008 stops at the elapsed-time ceiling, aborts the transport and absorbs a late rejection", async () => {
    const captured: {
      signal?: AbortSignal;
      rejectLate?: (reason: unknown) => void;
    } = {};
    const transport: VerificationCodeDeliveryTransport = {
      send: (_request, signal) => {
        captured.signal = signal;
        return new Promise((_resolve, reject) => {
          captured.rejectLate = reject;
        });
      },
    };
    const started = Date.now();
    const result = await deliverVerificationCode({
      delivery: prepareVerificationCodeDelivery(input()),
      transport,
      timeoutMilliseconds: 50,
    });
    expect(result).toEqual({ outcome: "timeout" });
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(captured.signal?.aborted).toBe(true);
    // A rejection after the ceiling decided the result must not surface as an
    // unhandled rejection (Vitest would fail the run).
    captured.rejectLate?.(new Error(`late ${CODE}`));
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  it.each([9, 15_001, 1.5, Number.NaN, "100", undefined])(
    "VCD-009 rejects the out-of-bounds timeout %s without sending or consuming the handle",
    async (timeoutMilliseconds) => {
      const transport = transportReturning("accepted");
      const delivery = prepareVerificationCodeDelivery(input());
      await expectDeliveryRejection(
        deliverVerificationCode({
          delivery,
          transport,
          timeoutMilliseconds: timeoutMilliseconds as number,
        }),
        "verification_code_delivery_invalid_timeout",
      );
      expect(transport.send).not.toHaveBeenCalled();
      await expect(
        deliverVerificationCode({ delivery, transport, timeoutMilliseconds: 1_000 }),
      ).resolves.toEqual({ outcome: "accepted" });
    },
  );

  it("VCD-010 rejects malformed transports without sending or burning the handle, and never falls back", async () => {
    const sendSpy = vi.fn(async () => "accepted");
    class TransportClass {
      send = sendSpy;
    }
    const withGetter = Object.defineProperty({}, "send", {
      enumerable: true,
      get: () => sendSpy,
    });
    const malformed: unknown[] = [
      undefined,
      null,
      sendSpy,
      {},
      { send: "accepted" },
      { send: sendSpy, extra: true },
      { deliver: sendSpy },
      withGetter,
      new TransportClass(),
    ];
    const delivery = prepareVerificationCodeDelivery(input());
    for (const transport of malformed) {
      await expectDeliveryRejection(
        deliverVerificationCode({
          delivery,
          transport: transport as VerificationCodeDeliveryTransport,
          timeoutMilliseconds: 1_000,
        }),
        "verification_code_delivery_invalid_transport",
      );
    }
    expect(sendSpy).not.toHaveBeenCalled();

    // The refused transports neither sent nor burned the handle: it still
    // delivers exactly once.
    const valid = transportReturning("accepted");
    await expect(
      deliverVerificationCode({ delivery, transport: valid, timeoutMilliseconds: 1_000 }),
    ).resolves.toEqual({ outcome: "accepted" });
    await expectDeliveryRejection(
      deliverVerificationCode({ delivery, transport: valid, timeoutMilliseconds: 1_000 }),
      "verification_code_delivery_already_attempted",
    );
    expect(valid.send).toHaveBeenCalledTimes(1);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("VCD-011 refuses a handle it did not create", async () => {
    const transport = transportReturning("accepted");
    for (const delivery of [{}, Object.freeze({}), null, "handle"]) {
      await expectDeliveryRejection(
        deliverVerificationCode({
          delivery: delivery as unknown as PreparedVerificationCodeDelivery,
          transport,
          timeoutMilliseconds: 1_000,
        }),
        "verification_code_delivery_invalid_request",
      );
    }
    expect(transport.send).not.toHaveBeenCalled();
  });

  it("VCD-012 keeps every error fixed and value-free", () => {
    for (const code of VERIFICATION_CODE_DELIVERY_ERROR_CODES) {
      const error = new VerificationCodeDeliveryError(code);
      expect(error.message).toBe(code);
      expect(error.name).toBe("VerificationCodeDeliveryError");
      expectValueFree(error);
    }
  });

  it("VCD-017 suppresses duplicates per prepared handle only: two handles for one challenge and code are two sends", async () => {
    // This is why the login step 5 caller must prepare exactly one delivery
    // per committed issuance and keep no copy of the code.
    const transport = transportReturning("accepted");
    const first = prepareVerificationCodeDelivery(input());
    const second = prepareVerificationCodeDelivery(input());
    expect(first).not.toBe(second);

    for (const delivery of [first, second]) {
      await expect(
        deliverVerificationCode({ delivery, transport, timeoutMilliseconds: 1_000 }),
      ).resolves.toEqual({ outcome: "accepted" });
    }
    expect(transport.send).toHaveBeenCalledTimes(2);
    expect(transport.send.mock.calls[0][0]).toEqual(transport.send.mock.calls[1][0]);
    expect(transport.send.mock.calls[0][0]).toMatchObject({
      code: CODE,
      challengeId: CHALLENGE_ID,
    });

    for (const delivery of [first, second]) {
      await expectDeliveryRejection(
        deliverVerificationCode({ delivery, transport, timeoutMilliseconds: 1_000 }),
        "verification_code_delivery_already_attempted",
      );
    }
    expect(transport.send).toHaveBeenCalledTimes(2);
  });

  it("VCD-018 refuses getters and hostile Proxies in the delivery input and transport, value-free, and keeps the handle usable", async () => {
    const sendSpy = vi.fn(async () => "accepted");
    const delivery = prepareVerificationCodeDelivery(input());
    const valid = () => ({
      delivery,
      transport: { send: sendSpy },
      timeoutMilliseconds: 1_000,
    });

    for (const hostile of [
      throwingAccessor(valid(), "delivery"),
      throwingAccessor(valid(), "transport"),
      throwingAccessor(valid(), "timeoutMilliseconds"),
      hostileProxy(valid()),
      hostileProxy(valid(), ["getPrototypeOf"]),
      hostileProxy(valid(), ["getOwnPropertyDescriptor"]),
    ]) {
      await expectDeliveryRejection(
        deliverVerificationCode(hostile),
        "verification_code_delivery_invalid_request",
      );
    }

    for (const transport of [
      throwingAccessor({ send: sendSpy }, "send"),
      hostileProxy({ send: sendSpy }),
      hostileProxy({ send: sendSpy }, ["getPrototypeOf"]),
      hostileProxy({ send: sendSpy }, ["ownKeys"]),
      hostileProxy({ send: sendSpy }, ["getOwnPropertyDescriptor"]),
    ]) {
      await expectDeliveryRejection(
        deliverVerificationCode({ delivery, transport, timeoutMilliseconds: 1_000 }),
        "verification_code_delivery_invalid_transport",
      );
    }
    expect(sendSpy).not.toHaveBeenCalled();

    // Nothing above burned the handle. Hostile `get` and `has` traps never
    // run, because values are read only through own data descriptors.
    await expect(
      deliverVerificationCode(hostileProxy(valid(), ["get", "has"])),
    ).resolves.toEqual({ outcome: "accepted" });
    await expectDeliveryRejection(
      deliverVerificationCode(valid()),
      "verification_code_delivery_already_attempted",
    );
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });
});

describe("verificationCodeDelivery - server-only and barrel boundaries", () => {
  const moduleNames = [
    "verificationCodeDelivery",
    "localSmtpVerificationCodeDelivery",
    "verificationCodeEmailWording",
  ] as const;

  function moduleSource(name: string): string {
    return fs.readFileSync(
      fileURLToPath(new URL(`../${name}.ts`, import.meta.url)),
      "utf8",
    );
  }

  function importSpecifiers(source: string): string[] {
    return [
      ...source.matchAll(/^import\s+["']([^"']+)["'];|\bfrom\s+["']([^"']+)["'];/gm),
    ].map((match) => match[1] ?? match[2]);
  }

  it("VCD-013 each module starts with the server-only import and imports only what it needs", () => {
    for (const name of moduleNames) {
      const source = moduleSource(name);
      expect(source.startsWith('import "server-only";')).toBe(true);
      expect(source.charCodeAt(0)).not.toBe(0xfeff);
    }
    expect(importSpecifiers(moduleSource("verificationCodeDelivery"))).toEqual([
      "server-only",
    ]);
    expect(importSpecifiers(moduleSource("verificationCodeEmailWording"))).toEqual([
      "server-only",
    ]);
    expect(importSpecifiers(moduleSource("localSmtpVerificationCodeDelivery"))).toEqual([
      "server-only",
      "node:net",
      "./verificationCodeDelivery",
      "./verificationCodeEmailWording",
    ]);
  });

  it("VCD-014 never reads the environment, logs, calls a database or generates a code", () => {
    for (const name of moduleNames) {
      const source = moduleSource(name);
      expect(source).not.toMatch(
        /process\.env|console\.|\bfetch\s*\(|@supabase|\.rpc\(|node:crypto|randomInt|randomBytes|Math\.random|localStorage|sessionStorage|\bimport\s*\(|\brequire\s*\(/,
      );
      expect(source).not.toContain("54325");
    }
  });

  it("VCD-015 is not exported from any barrel", () => {
    for (const exportedName of [
      "prepareVerificationCodeDelivery",
      "deliverVerificationCode",
      "VerificationCodeDeliveryError",
      "VERIFICATION_CODE_DELIVERY_OUTCOMES",
      "createLocalSmtpVerificationCodeTransport",
      "VERIFICATION_CODE_EMAIL_WORDING",
    ]) {
      expect(exportedName in authBarrel).toBe(false);
    }

    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    let sourceRoot = path.resolve(testDirectory, "..", "..", "..", "..");
    let authBarrelPath = path.join(sourceRoot, "lib", "solmind", "auth", "index.ts");
    const proposalRoot = path.resolve(sourceRoot, "..", "..");
    if (
      !fs.existsSync(authBarrelPath) &&
      path.basename(proposalRoot).includes("_proposed_")
    ) {
      // Run from a proposal folder that holds only new files: scan the live app.
      sourceRoot = path.resolve(proposalRoot, "..", "solmind-app", "src");
      authBarrelPath = path.join(sourceRoot, "lib", "solmind", "auth", "index.ts");
    }

    const barrels: string[] = [];
    const walk = (directory: string): void => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          walk(entryPath);
        } else if (/^index\.(?:ts|tsx|js|mjs)$/.test(entry.name)) {
          barrels.push(entryPath);
        }
      }
    };
    walk(sourceRoot);

    expect(barrels).toContain(authBarrelPath);
    for (const barrel of barrels) {
      const source = fs.readFileSync(barrel, "utf8");
      for (const name of moduleNames) {
        expect(source).not.toContain(name);
      }
    }
  });
});
