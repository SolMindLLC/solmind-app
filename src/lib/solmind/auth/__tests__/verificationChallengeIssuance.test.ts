import * as nodeCrypto from "node:crypto";
import { inspect } from "node:util";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  VERIFICATION_CHALLENGE_ACKNOWLEDGMENT,
  VERIFICATION_CHALLENGE_ISSUANCE_FUNCTION,
  VERIFICATION_CHALLENGE_ISSUANCE_OUTCOMES,
  VerificationChallengeError,
  createVerificationChallengeIssuerWithSlots,
  type VerificationCallSlots,
  toVerificationChallengeIssuanceAcknowledgment,
  type VerificationChallengeIssuanceRequest,
  type VerificationChallengeIssuanceResult,
  type VerificationChallengeIssuerDependencies,
  type VerificationChallengeRpcClient,
} from "../verificationChallengeCallersCore";
import {
  computeVerificationCodeVerifier,
  createVerificationCodePepper,
} from "../verificationCode";
import {
  VERIFICATION_CODE_DELIVERY_OUTCOMES,
  deliverVerificationCode,
  prepareVerificationCodeDelivery,
  type VerificationCodeDeliveryRequest,
  type VerificationCodeDeliveryTransport,
} from "../verificationCodeDelivery";

// Partial mock: the real boundary runs, but each call to it is observable,
// so the tests can prove one prepare and one deliver per issuance answer,
// in order, and can force a preparation failure.
vi.mock("../verificationCodeDelivery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../verificationCodeDelivery")>();
  return {
    ...actual,
    prepareVerificationCodeDelivery: vi.fn(actual.prepareVerificationCodeDelivery),
    deliverVerificationCode: vi.fn(actual.deliverVerificationCode),
  };
});

// Partial mock: the real HMAC runs, but its use is observable, so the tests
// can prove that malformed input is refused before any HMAC.
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, createHmac: vi.fn(actual.createHmac) };
});

const PEPPER_TEXT = "SOLMIND-SYNTHETIC-TEST-PEPPER-01";
const PEPPER = createVerificationCodePepper(Buffer.from(PEPPER_TEXT, "ascii"));
const EMAIL = "explorer.p5@synthetic.invalid";
const PHONE = "+15555550155";
const ACCOUNT_ID = "def50005-0000-4000-8000-000000000001";
const CONTACT_ID = "def50005-1000-4000-8000-000000000001";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
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
function fakeRpc(respond: (call: RpcCall) => unknown = () => rpcResponse([{ outcome: "issued" }])) {
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

function fakeTransport(respond: () => unknown = async () => "accepted") {
  const requests: VerificationCodeDeliveryRequest[] = [];
  const send = vi.fn(async (request: VerificationCodeDeliveryRequest) => {
    requests.push({ ...request });
    return respond();
  });
  const transport: VerificationCodeDeliveryTransport = { send };
  return { transport, send, requests };
}

function fakeSlots(available = true) {
  const release = vi.fn();
  const tryAcquire = vi.fn(() => (available ? release : null));
  return { slots: { tryAcquire }, tryAcquire, release };
}

type IssuerOverrides = Partial<
  Record<keyof VerificationChallengeIssuerDependencies | "issuanceSlots", unknown>
>;

// Builds through the restricted core, as only the public module and the three
// named unit tests (this file among them) may: the pool (a fake unless the
// test gives one) is the separate second argument, never part of the
// dependency object.
function buildIssuer(overrides: IssuerOverrides = {}) {
  const { issuanceSlots = fakeSlots().slots, ...rest } = overrides;
  return createVerificationChallengeIssuerWithSlots(dependencies(rest), issuanceSlots as VerificationCallSlots);
}

function dependencies(
  overrides: Partial<Record<keyof VerificationChallengeIssuerDependencies, unknown>> = {},
): VerificationChallengeIssuerDependencies {
  return {
    rpcClient: fakeRpc().client,
    rpcTimeoutMilliseconds: 1_000,
    pepper: PEPPER,
    deliveryTransport: fakeTransport().transport,
    deliveryTimeoutMilliseconds: 1_000,
    ...overrides,
  } as VerificationChallengeIssuerDependencies;
}

function emailRequest(
  overrides: Record<string, unknown> = {},
): VerificationChallengeIssuanceRequest {
  return {
    purpose: "login",
    contactMethodType: "email",
    normalizedContact: EMAIL,
    userAccountId: ACCOUNT_ID,
    userContactMethodId: CONTACT_ID,
    ...overrides,
  } as VerificationChallengeIssuanceRequest;
}

// Every text an outcome could leak through: JSON, string form, inspection.
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

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error("expected the action to throw");
}

function hostileError(): Error {
  return new Error(`hostile ${EMAIL} ${PEPPER_TEXT}`);
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

const prepareSpy = vi.mocked(prepareVerificationCodeDelivery);
const deliverSpy = vi.mocked(deliverVerificationCode);
const createHmacSpy = vi.mocked(nodeCrypto.createHmac);

beforeEach(() => {
  prepareSpy.mockClear();
  deliverSpy.mockClear();
  createHmacSpy.mockClear();
  for (const method of CONSOLE_METHODS) {
    vi.spyOn(console, method);
  }
});

afterEach(() => {
  // No code, contact or verifier can leak through a log: nothing logs.
  for (const method of CONSOLE_METHODS) {
    expect(console[method]).not.toHaveBeenCalled();
  }
  vi.restoreAllMocks();
});

describe("verificationChallengeCallers - issuing a challenge", () => {
  it("VCI-001 issues once, binds the delivery to the issuance answer and returns the selector", async () => {
    const rpc = fakeRpc();
    const delivery = fakeTransport();
    const slots = fakeSlots();
    const issuer = buildIssuer({
        rpcClient: rpc.client,
        deliveryTransport: delivery.transport,
        issuanceSlots: slots.slots,
      });

    const result = await issuer.issue(emailRequest());
    await settle();

    expect(rpc.calls).toHaveLength(1);
    const [call] = rpc.calls;
    expect(call.functionName).toBe(VERIFICATION_CHALLENGE_ISSUANCE_FUNCTION);
    expect(call.functionName).toBe("solmind_issue_verification_challenge");
    expect(call.signal).toBeInstanceOf(AbortSignal);
    expect(call.signal?.aborted).toBe(false);
    expect(Object.keys(call.args).sort()).toEqual([
      "p_contact_method_type",
      "p_delivery_channel",
      "p_normalized_contact_value",
      "p_purpose",
      "p_user_account_id",
      "p_user_contact_method_id",
      "p_verification_challenge_id",
      "p_verifier",
    ]);
    expect(call.args).toMatchObject({
      p_normalized_contact_value: EMAIL,
      p_contact_method_type: "email",
      p_purpose: "login",
      p_delivery_channel: "email",
      p_user_account_id: ACCOUNT_ID,
      p_user_contact_method_id: CONTACT_ID,
    });
    const challengeId = call.args.p_verification_challenge_id as string;
    expect(challengeId).toMatch(UUID_V4);

    expect(delivery.requests).toHaveLength(1);
    const [sent] = delivery.requests;
    expect(sent).toEqual({
      channel: "email",
      normalizedContact: EMAIL,
      code: expect.stringMatching(/^[0-9]{6}$/),
      purpose: "login",
      challengeId,
    });
    // The verifier sent to the database is the svf1 verifier of the code
    // that was delivered, for this challenge and purpose. No plaintext code
    // reaches the database call.
    expect(call.args.p_verifier).toBe(
      computeVerificationCodeVerifier(PEPPER, challengeId, "login", sent.code),
    );
    expect(Object.values(call.args)).not.toContain(sent.code);

    expect(result).toEqual({ outcome: "issued", challengeId, delivery: "accepted" });
    expect(Object.isFrozen(result)).toBe(true);
    expectValueFree(result, [sent.code, EMAIL, call.args.p_verifier as string, PEPPER_TEXT]);
    expect(slots.tryAcquire).toHaveBeenCalledTimes(1);
    expect(slots.release).toHaveBeenCalledTimes(1);
  });

  it("VCI-002 reports every delivery outcome as the boundary returned it", async () => {
    for (const outcome of VERIFICATION_CODE_DELIVERY_OUTCOMES) {
      const delivery = fakeTransport(async () => outcome);
      const issuer = buildIssuer({ deliveryTransport: delivery.transport });
      const result = await issuer.issue(emailRequest());
      expect(result).toMatchObject({ outcome: "issued", delivery: outcome });
      expect(delivery.send).toHaveBeenCalledTimes(1);
    }
    // A transport that throws is `ambiguous` at the boundary, and is never retried.
    const throwing = fakeTransport(async () => {
      throw hostileError();
    });
    const issuer = buildIssuer({ deliveryTransport: throwing.transport });
    const result = await issuer.issue(emailRequest());
    expect(result).toMatchObject({ outcome: "issued", delivery: "ambiguous" });
    expect(throwing.send).toHaveBeenCalledTimes(1);
    expectValueFree(result, [EMAIL, PEPPER_TEXT]);
  });

  it("VCI-003 prepares and sends only after the issuance answer says issued, exactly once", async () => {
    let resolveRpc: (value: unknown) => void = () => undefined;
    const rpc = fakeRpc(
      () =>
        new Promise((resolve) => {
          resolveRpc = resolve;
        }),
    );
    const delivery = fakeTransport();
    const issuer = buildIssuer({ rpcClient: rpc.client, deliveryTransport: delivery.transport });

    const pending = issuer.issue(emailRequest());
    await settle(20);
    expect(rpc.rpc).toHaveBeenCalledTimes(1);
    expect(prepareSpy).not.toHaveBeenCalled();
    expect(deliverSpy).not.toHaveBeenCalled();
    expect(delivery.send).not.toHaveBeenCalled();

    resolveRpc({ data: [{ outcome: "issued" }], error: null });
    await expect(pending).resolves.toMatchObject({ outcome: "issued", delivery: "accepted" });

    expect(prepareSpy).toHaveBeenCalledTimes(1);
    expect(deliverSpy).toHaveBeenCalledTimes(1);
    expect(delivery.send).toHaveBeenCalledTimes(1);
    expect(prepareSpy.mock.calls[0][0]).toMatchObject({ issuanceOutcome: "issued" });
    expect(rpc.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      prepareSpy.mock.invocationCallOrder[0],
    );
    expect(prepareSpy.mock.invocationCallOrder[0]).toBeLessThan(
      deliverSpy.mock.invocationCallOrder[0],
    );
    expect(deliverSpy.mock.invocationCallOrder[0]).toBeLessThan(
      delivery.send.mock.invocationCallOrder[0],
    );
    // The boundary is given the prepared handle and the configured transport
    // and ceiling; the caller never calls the transport's `send` itself.
    expect(deliverSpy.mock.calls[0][0]).toEqual({
      delivery: prepareSpy.mock.results[0].value,
      transport: delivery.transport,
      timeoutMilliseconds: 1_000,
    });
  });

  it("VCI-004 delivers nothing on a denied issuance and returns the same unissued selector", async () => {
    const rpc = fakeRpc(() => rpcResponse([{ outcome: "denied" }]));
    const delivery = fakeTransport();
    const slots = fakeSlots();
    const issuer = buildIssuer({
        rpcClient: rpc.client,
        deliveryTransport: delivery.transport,
        issuanceSlots: slots.slots,
      });
    const result = await issuer.issue(emailRequest());
    await settle();
    expect(result).toEqual({
      outcome: "denied",
      challengeId: rpc.calls[0].args.p_verification_challenge_id,
    });
    expect(prepareSpy).not.toHaveBeenCalled();
    expect(delivery.send).not.toHaveBeenCalled();
    expect(slots.release).toHaveBeenCalledTimes(1);
  });

  it("VCI-005 maps exactly the two fixed eligibility errors to ineligible, and every near miss to failed", async () => {
    for (const message of ["solmind_issue_ineligible_contact", "solmind_issue_invalid_binding"]) {
      const rpc = fakeRpc(() =>
        rpcResponse(null, { code: "P0001", message, details: null, hint: null }),
      );
      const delivery = fakeTransport();
      const issuer = buildIssuer({ rpcClient: rpc.client, deliveryTransport: delivery.transport });
      const result = await issuer.issue(emailRequest());
      expect(result).toEqual({
        outcome: "ineligible",
        challengeId: rpc.calls[0].args.p_verification_challenge_id,
      });
      expect(delivery.send).not.toHaveBeenCalled();
    }

    for (const error of [
      { code: "P0002", message: "solmind_issue_ineligible_contact" },
      { code: "P0001", message: "solmind_issue_ineligible_contact " },
      { code: "P0001", message: "SOLMIND_ISSUE_INVALID_BINDING" },
      { code: "P0001", message: "solmind_issue_lock_unavailable" },
      { code: "P0001", message: "solmind_issue_integrity_failure" },
      { code: "P0001", message: "solmind_issue_stale_transaction" },
      { code: "P0001", message: "solmind_issue_unsupported_isolation" },
      { code: "P0001", message: "solmind_issue_unbounded_transaction" },
      { code: "P0001", message: "solmind_issue_invalid_contact" },
      { code: "P0001", message: "solmind_issue_open_cardinality_violation" },
      { code: "P0001", message: ["solmind_issue_ineligible_contact"] },
      { code: "PGRST202", message: "Could not find the function" },
      { message: "TypeError: fetch failed", details: `connect ECONNREFUSED ${EMAIL}`, code: "" },
      { message: "AbortError: This operation was aborted", code: "", hint: "Request was aborted" },
      "solmind_issue_ineligible_contact",
      [{ code: "P0001", message: "solmind_issue_ineligible_contact" }],
    ]) {
      const rpc = fakeRpc(() => rpcResponse(null, error));
      const delivery = fakeTransport();
      const issuer = buildIssuer({ rpcClient: rpc.client, deliveryTransport: delivery.transport });
      const result = await issuer.issue(emailRequest());
      expect(result.outcome).toBe("failed");
      expect(delivery.send).not.toHaveBeenCalled();
      expectValueFree(result, [EMAIL, "ECONNREFUSED", "fetch failed", "AbortError"]);
    }
  });

  it("VCI-006 treats every other answer, throw or rejection as failed and delivers nothing", async () => {
    const responders: ReadonlyArray<() => unknown> = [
      () => rpcResponse([]),
      () => rpcResponse([{ outcome: "issued" }, { outcome: "issued" }]),
      () => rpcResponse([{ outcome: "issued", extra: true }]),
      () => rpcResponse([{ outcome: "Issued" }]),
      () => rpcResponse([{ outcome: "redeemed" }]),
      () => rpcResponse([{ result: "issued" }]),
      () => rpcResponse([["issued"]]),
      () => rpcResponse({ outcome: "issued" }),
      () => rpcResponse("issued"),
      () => rpcResponse(null),
      () => rpcResponse([{ outcome: "issued" }], { message: "unexpected" }),
      () => Promise.resolve(null),
      () => Promise.resolve("issued"),
      () => Promise.resolve([{ outcome: "issued" }]),
      () => Promise.reject(hostileError()),
      () => {
        throw hostileError();
      },
      () => undefined,
    ];
    for (const respond of responders) {
      const rpc = fakeRpc(respond);
      const delivery = fakeTransport();
      const slots = fakeSlots();
      const issuer = buildIssuer({
          rpcClient: rpc.client,
          deliveryTransport: delivery.transport,
          issuanceSlots: slots.slots,
        });
      const result = await issuer.issue(emailRequest());
      await settle();
      expect(result.outcome).toBe("failed");
      expect(result.challengeId).toMatch(UUID_V4);
      expect(rpc.rpc).toHaveBeenCalledTimes(1);
      expect(prepareSpy).not.toHaveBeenCalled();
      expect(delivery.send).not.toHaveBeenCalled();
      expect(slots.release).toHaveBeenCalledTimes(1);
      expectValueFree(result, [EMAIL, PEPPER_TEXT, "hostile"]);
    }

    // A seam whose request has no abortSignal() is a wiring fault: failed.
    const noAbort = buildIssuer({ rpcClient: { rpc: () => rpcResponse([{ outcome: "issued" }]) } });
    await expect(noAbort.issue(emailRequest())).resolves.toMatchObject({ outcome: "failed" });
    expect(prepareSpy).not.toHaveBeenCalled();
  });

  it("VCI-007 refuses a malformed request before any slot, code or database call", async () => {
    const getter = emailRequest();
    Object.defineProperty(getter, "normalizedContact", {
      enumerable: true,
      get: () => {
        throw hostileError();
      },
    });
    const malformed: ReadonlyArray<unknown> = [
      emailRequest({ purpose: "signup" }),
      emailRequest({ purpose: "LOGIN" }),
      emailRequest({ contactMethodType: "sms" }),
      emailRequest({ contactMethodType: "Email" }),
      emailRequest({ normalizedContact: "Explorer.P5@synthetic.invalid" }),
      emailRequest({ normalizedContact: ` ${EMAIL}` }),
      emailRequest({ normalizedContact: "explorer..p5@synthetic.invalid" }),
      emailRequest({ normalizedContact: `${"a".repeat(250)}@x.io` }),
      emailRequest({ normalizedContact: "no-at-sign" }),
      emailRequest({ normalizedContact: PHONE }),
      emailRequest({ contactMethodType: "phone", normalizedContact: EMAIL }),
      emailRequest({ contactMethodType: "phone", normalizedContact: "15555550155" }),
      emailRequest({ contactMethodType: "phone", normalizedContact: "+0555555015" }),
      emailRequest({ contactMethodType: "phone", normalizedContact: "+1234567" }),
      emailRequest({ normalizedContact: 42 }),
      // The binding pair: both present or both null.
      emailRequest({ userAccountId: null }),
      emailRequest({ userContactMethodId: null }),
      emailRequest({ userAccountId: ACCOUNT_ID.toUpperCase() }),
      emailRequest({ userContactMethodId: "not-a-uuid" }),
      emailRequest({ userAccountId: undefined }),
      // Only three purposes may be unbound.
      emailRequest({ purpose: "password_reset", userAccountId: null, userContactMethodId: null }),
      emailRequest({ purpose: "role_reentry", userAccountId: null, userContactMethodId: null }),
      // Exact keys, plain objects, data properties only.
      { ...emailRequest(), extra: "field" },
      (() => {
        const missing: Record<string, unknown> = { ...emailRequest() };
        delete missing.userContactMethodId;
        return missing;
      })(),
      getter,
      new Proxy(emailRequest(), {
        getOwnPropertyDescriptor: () => {
          throw hostileError();
        },
      }),
      Object.assign(Object.create({ inherited: true }), emailRequest()),
      [emailRequest()],
      null,
      undefined,
      "login",
    ];
    for (const request of malformed) {
      const rpc = fakeRpc();
      const delivery = fakeTransport();
      const slots = fakeSlots();
      const issuer = buildIssuer({
          rpcClient: rpc.client,
          deliveryTransport: delivery.transport,
          issuanceSlots: slots.slots,
        });
      const result = await issuer.issue(request as VerificationChallengeIssuanceRequest);
      expect(result.outcome).toBe("invalid_request");
      // Still a fresh selector, so the outward response keeps its one shape.
      expect(result.challengeId).toMatch(UUID_V4);
      expect(slots.tryAcquire).not.toHaveBeenCalled();
      expect(rpc.rpc).not.toHaveBeenCalled();
      expect(delivery.send).not.toHaveBeenCalled();
      expectValueFree(result, [EMAIL, PEPPER_TEXT, "hostile"]);
    }
    expect(createHmacSpy).not.toHaveBeenCalled();
  });

  it("VCI-008 returns busy without issuing when no issuance slot is free", async () => {
    for (const tryAcquire of [
      vi.fn(() => null),
      vi.fn(() => undefined),
      vi.fn(() => "slot"),
      vi.fn(() => {
        throw hostileError();
      }),
    ]) {
      const rpc = fakeRpc();
      const delivery = fakeTransport();
      const issuer = buildIssuer({
          rpcClient: rpc.client,
          deliveryTransport: delivery.transport,
          issuanceSlots: { tryAcquire },
        });
      const result = await issuer.issue(emailRequest());
      expect(result.outcome).toBe("busy");
      expect(result.challengeId).toMatch(UUID_V4);
      expect(tryAcquire).toHaveBeenCalledTimes(1);
      // No code, no database call, no budget spent.
      expect(rpc.rpc).not.toHaveBeenCalled();
      expect(prepareSpy).not.toHaveBeenCalled();
      expect(delivery.send).not.toHaveBeenCalled();
    }
    expect(createHmacSpy).not.toHaveBeenCalled();
  });

  it("VCI-009 holds its slot until its one delivery ends and releases it exactly once", async () => {
    let finishSend: (value: unknown) => void = () => undefined;
    const delivery = fakeTransport(
      () =>
        new Promise((resolve) => {
          finishSend = resolve;
        }),
    );
    const slots = fakeSlots();
    const issuer = buildIssuer({ deliveryTransport: delivery.transport, issuanceSlots: slots.slots });
    const pending = issuer.issue(emailRequest());
    await vi.waitFor(() => {
      expect(delivery.send).toHaveBeenCalledTimes(1);
    });
    expect(slots.release).not.toHaveBeenCalled();
    finishSend("accepted");
    await expect(pending).resolves.toMatchObject({ outcome: "issued", delivery: "accepted" });
    await settle();
    expect(slots.release).toHaveBeenCalledTimes(1);

    // A release function that throws changes nothing.
    const throwingRelease = vi.fn(() => {
      throw hostileError();
    });
    const issuerWithBadRelease = buildIssuer({ issuanceSlots: { tryAcquire: () => throwingRelease } });
    await expect(issuerWithBadRelease.issue(emailRequest())).resolves.toMatchObject({
      outcome: "issued",
      delivery: "accepted",
    });
    await settle();
    expect(throwingRelease).toHaveBeenCalledTimes(1);
  });

  it("VCI-010 maps a phone contact to the SMS channel", async () => {
    const rpc = fakeRpc();
    const delivery = fakeTransport(async () => "terminal_failure");
    const issuer = buildIssuer({ rpcClient: rpc.client, deliveryTransport: delivery.transport });
    const result = await issuer.issue(
      emailRequest({ contactMethodType: "phone", normalizedContact: PHONE }),
    );
    expect(rpc.calls[0].args).toMatchObject({
      p_contact_method_type: "phone",
      p_delivery_channel: "sms",
      p_normalized_contact_value: PHONE,
    });
    expect(delivery.requests[0]).toMatchObject({ channel: "sms", normalizedContact: PHONE });
    expect(result).toMatchObject({ outcome: "issued", delivery: "terminal_failure" });
  });

  it("VCI-011 allows exactly the three unbound purposes with both binding UUIDs null", async () => {
    for (const purpose of ["first_admin_setup", "login", "contact_verify"]) {
      const rpc = fakeRpc();
      const issuer = buildIssuer({ rpcClient: rpc.client });
      const result = await issuer.issue(
        emailRequest({ purpose, userAccountId: null, userContactMethodId: null }),
      );
      expect(result.outcome).toBe("issued");
      expect(rpc.calls[0].args).toMatchObject({
        p_purpose: purpose,
        p_user_account_id: null,
        p_user_contact_method_id: null,
      });
    }
    for (const purpose of ["password_reset", "role_reentry"]) {
      const rpc = fakeRpc();
      const issuer = buildIssuer({ rpcClient: rpc.client });
      await expect(issuer.issue(emailRequest({ purpose }))).resolves.toMatchObject({
        outcome: "issued",
      });
      expect(rpc.calls[0].args.p_purpose).toBe(purpose);
    }
  });

  it("VCI-012 gives every outcome a fresh selector and one identical outward acknowledgment", async () => {
    const results: VerificationChallengeIssuanceResult[] = [];
    const scenarios: ReadonlyArray<IssuerOverrides> = [
      {},
      { deliveryTransport: fakeTransport(async () => "bounced").transport },
      { rpcClient: fakeRpc(() => rpcResponse([{ outcome: "denied" }])).client },
      {
        rpcClient: fakeRpc(() =>
          rpcResponse(null, { code: "P0001", message: "solmind_issue_ineligible_contact" }),
        ).client,
      },
      { rpcClient: fakeRpc(() => Promise.reject(hostileError())).client },
      { issuanceSlots: fakeSlots(false).slots },
    ];
    for (const overrides of scenarios) {
      const issuer = buildIssuer(overrides);
      results.push(await issuer.issue(emailRequest()));
    }
    results.push(
      await buildIssuer().issue(
        emailRequest({ purpose: "signup" }),
      ),
    );
    expect(results.map((result) => result.outcome)).toEqual([
      "issued",
      "issued",
      "denied",
      "ineligible",
      "failed",
      "busy",
      "invalid_request",
    ]);
    expect([...VERIFICATION_CHALLENGE_ISSUANCE_OUTCOMES].sort()).toEqual(
      [...new Set(results.map((result) => result.outcome))].sort(),
    );
    const selectors = new Set(results.map((result) => result.challengeId));
    expect(selectors.size).toBe(results.length);

    for (const result of results) {
      expect(result.challengeId).toMatch(UUID_V4);
      const outward = toVerificationChallengeIssuanceAcknowledgment(result);
      expect(outward).toEqual({
        acknowledgment: VERIFICATION_CHALLENGE_ACKNOWLEDGMENT,
        challengeId: result.challengeId,
      });
      expect(Object.keys(outward)).toEqual(["acknowledgment", "challengeId"]);
      expect(Object.isFrozen(outward)).toBe(true);
      expect(VERIFICATION_CHALLENGE_ACKNOWLEDGMENT).toBe("verification_code_requested");
    }
  });

  it("VCI-013 prepares one delivery per issuance answer: two issuances are two selectors and two codes", async () => {
    const rpc = fakeRpc();
    const delivery = fakeTransport();
    const issuer = buildIssuer({ rpcClient: rpc.client, deliveryTransport: delivery.transport });
    const first = await issuer.issue(emailRequest());
    const second = await issuer.issue(emailRequest());
    expect(first.challengeId).not.toBe(second.challengeId);
    expect(rpc.rpc).toHaveBeenCalledTimes(2);
    expect(prepareSpy).toHaveBeenCalledTimes(2);
    expect(deliverSpy).toHaveBeenCalledTimes(2);
    expect(delivery.send).toHaveBeenCalledTimes(2);
    expect(delivery.requests.map((request) => request.challengeId)).toEqual([
      first.challengeId,
      second.challengeId,
    ]);
    for (const [index, request] of delivery.requests.entries()) {
      expect(rpc.calls[index].args.p_verifier).toBe(
        computeVerificationCodeVerifier(PEPPER, request.challengeId as string, "login", request.code),
      );
    }
  });

  it("VCI-014 reports not_attempted when the issuance's delivery cannot be prepared or started", async () => {
    prepareSpy.mockImplementationOnce(() => {
      throw hostileError();
    });
    const delivery = fakeTransport();
    const issuer = buildIssuer({ deliveryTransport: delivery.transport });
    const prepared = await issuer.issue(emailRequest());
    expect(prepared).toMatchObject({ outcome: "issued", delivery: "not_attempted" });
    expect(delivery.send).not.toHaveBeenCalled();
    expectValueFree(prepared, ["hostile", EMAIL]);

    deliverSpy.mockImplementationOnce(async () => {
      throw hostileError();
    });
    const started = await issuer.issue(emailRequest());
    expect(started).toMatchObject({ outcome: "issued", delivery: "not_attempted" });
    expect(delivery.send).not.toHaveBeenCalled();
    expectValueFree(started, ["hostile", EMAIL]);
  });

  it("VCI-015 refuses malformed wiring with one fixed, value-free error", () => {
    const transportWithGetter = {};
    Object.defineProperty(transportWithGetter, "send", {
      enumerable: true,
      get: () => async () => "accepted",
    });
    class ClassTransport {
      send = async () => "accepted";
    }
    const badWiring: ReadonlyArray<unknown> = [
      dependencies({ rpcClient: {} }),
      dependencies({ rpcClient: { rpc: "solmind_issue_verification_challenge" } }),
      dependencies({ rpcClient: null }),
      dependencies({ rpcTimeoutMilliseconds: 9 }),
      dependencies({ rpcTimeoutMilliseconds: 60_001 }),
      dependencies({ rpcTimeoutMilliseconds: 1_000.5 }),
      dependencies({ rpcTimeoutMilliseconds: "1000" }),
      dependencies({ pepper: Object.freeze({}) }),
      dependencies({ pepper: Buffer.from(PEPPER_TEXT, "ascii") }),
      dependencies({ deliveryTransport: { send: "not a function" } }),
      dependencies({ deliveryTransport: transportWithGetter }),
      dependencies({ deliveryTransport: new ClassTransport() }),
      dependencies({ deliveryTransport: { send: async () => "accepted", extra: 1 } }),
      dependencies({ deliveryTimeoutMilliseconds: 9 }),
      dependencies({ deliveryTimeoutMilliseconds: 15_001 }),
      // A pool is never part of the dependency object, so one there is an
      // extra key and is refused.
      { ...dependencies(), issuanceSlots: fakeSlots().slots },
      { ...dependencies(), extra: true },
      (() => {
        const missing: Record<string, unknown> = { ...dependencies() };
        delete missing.deliveryTransport;
        return missing;
      })(),
      new Proxy(dependencies(), {
        ownKeys: () => {
          throw hostileError();
        },
      }),
      null,
      "dependencies",
    ];
    const expectWiringError = (action: () => unknown) => {
      const error = captureError(action);
      expect(error).toBeInstanceOf(VerificationChallengeError);
      expect((error as VerificationChallengeError).code).toBe(
        "verification_challenge_invalid_configuration",
      );
      expect((error as Error).message).toBe("verification_challenge_invalid_configuration");
      expectValueFree(error, [PEPPER_TEXT, EMAIL, "hostile"]);
    };
    for (const wiring of badWiring) {
      expectWiringError(() =>
        createVerificationChallengeIssuerWithSlots(
          wiring as VerificationChallengeIssuerDependencies,
          fakeSlots().slots,
        ),
      );
    }
    // The pool, the separate second argument, is checked too.
    for (const slots of [{}, null, { tryAcquire: "slot" }, "slots", undefined]) {
      expectWiringError(() =>
        createVerificationChallengeIssuerWithSlots(dependencies(), slots as never),
      );
    }
  });

  it("VCI-016 keeps the issuer itself opaque and never throws once constructed", async () => {
    const issuer = buildIssuer();
    expect(Object.isFrozen(issuer)).toBe(true);
    expect(Object.keys(issuer)).toEqual(["issue"]);
    expectValueFree(issuer, [PEPPER_TEXT, Buffer.from(PEPPER_TEXT).toString("hex")]);
    await expect(issuer.issue(undefined as never)).resolves.toMatchObject({
      outcome: "invalid_request",
    });
  });

  it("VCI-017 refuses a final line terminator on each field before any HMAC or database call, and issues the otherwise identical request", async () => {
    // JavaScript's `$` without the `m` flag matches only at the very end of
    // the text. Each case pairs a valid request with the same request whose
    // one field gains the terminator, so the refusal is the terminator's.
    const phoneRequest = emailRequest({ contactMethodType: "phone", normalizedContact: PHONE });
    const unboundRequest = emailRequest({ userAccountId: null, userContactMethodId: null });
    for (const [name, terminator] of LINE_TERMINATORS) {
      const cases: ReadonlyArray<readonly [string, VerificationChallengeIssuanceRequest, VerificationChallengeIssuanceRequest]> = [
        ["email", emailRequest(), emailRequest({ normalizedContact: `${EMAIL}${terminator}` })],
        [
          "phone",
          phoneRequest,
          emailRequest({ contactMethodType: "phone", normalizedContact: `${PHONE}${terminator}` }),
        ],
        ["account UUID", emailRequest(), emailRequest({ userAccountId: `${ACCOUNT_ID}${terminator}` })],
        [
          "contact UUID",
          emailRequest(),
          emailRequest({ userContactMethodId: `${CONTACT_ID}${terminator}` }),
        ],
        ["purpose", emailRequest(), emailRequest({ purpose: `login${terminator}` })],
        [
          "contact-method type (email)",
          emailRequest(),
          emailRequest({ contactMethodType: `email${terminator}` }),
        ],
        [
          "contact-method type (phone)",
          phoneRequest,
          emailRequest({ contactMethodType: `phone${terminator}`, normalizedContact: PHONE }),
        ],
        [
          "purpose, unbound",
          unboundRequest,
          emailRequest({ purpose: `login${terminator}`, userAccountId: null, userContactMethodId: null }),
        ],
      ];
      for (const [field, valid, malformed] of cases) {
        const label = `${field} + ${name}`;
        const differing = Object.keys(valid).filter(
          (key) =>
            valid[key as keyof VerificationChallengeIssuanceRequest] !==
            malformed[key as keyof VerificationChallengeIssuanceRequest],
        );
        expect(differing, label).toHaveLength(1);

        createHmacSpy.mockClear();
        const refusedRpc = fakeRpc();
        const refusedSlots = fakeSlots();
        const refused = await buildIssuer({
          rpcClient: refusedRpc.client,
          issuanceSlots: refusedSlots.slots,
        }).issue(malformed);
        expect(refused.outcome, label).toBe("invalid_request");
        expect(refusedSlots.tryAcquire, label).not.toHaveBeenCalled();
        expect(refusedRpc.rpc, label).not.toHaveBeenCalled();
        expect(createHmacSpy, label).not.toHaveBeenCalled();

        const acceptedRpc = fakeRpc();
        const accepted = await buildIssuer({ rpcClient: acceptedRpc.client }).issue(valid);
        expect(accepted.outcome, label).toBe("issued");
        expect(acceptedRpc.rpc, label).toHaveBeenCalledTimes(1);
        expect(createHmacSpy, label).toHaveBeenCalledTimes(1);
      }
    }
  });

  it("VCI-018 acts on nothing when the deadline passes while the event loop is blocked, before the timer can run", async () => {
    let resolveRpc: (value: unknown) => void = () => undefined;
    const rpc = fakeRpc(
      () =>
        new Promise((resolve) => {
          resolveRpc = resolve;
        }),
    );
    const delivery = fakeTransport();
    const slots = fakeSlots();
    const issuer = buildIssuer({
        rpcClient: rpc.client,
        rpcTimeoutMilliseconds: 20,
        deliveryTransport: delivery.transport,
        issuanceSlots: slots.slots,
      });
    const pending = issuer.issue(emailRequest());
    await settle(20);
    expect(rpc.rpc).toHaveBeenCalledTimes(1);
    // The answer settles, then the event loop is held past the deadline. The
    // answer's callback runs before the timer can, so only a monotonic check
    // can tell it is late.
    resolveRpc({ data: [{ outcome: "issued" }], error: null });
    blockEventLoop(60);
    const result = await pending;
    expect(result.outcome).toBe("failed");
    expect(prepareSpy).not.toHaveBeenCalled();
    expect(delivery.send).not.toHaveBeenCalled();
    await settle();
    expect(slots.release).toHaveBeenCalledTimes(1);

    // The settle-time check alone decides answers that reach no later check:
    // a late `denied` or `ineligible` answer is `failed` too.
    for (const late of [
      { data: [{ outcome: "denied" }], error: null },
      { data: null, error: { code: "P0001", message: "solmind_issue_ineligible_contact" } },
    ]) {
      const lateIssuer = buildIssuer({ rpcClient: rpc.client, rpcTimeoutMilliseconds: 20 });
      const latePending = lateIssuer.issue(emailRequest());
      await settle(20);
      resolveRpc(late);
      blockEventLoop(60);
      await expect(latePending).resolves.toMatchObject({ outcome: "failed" });
    }
  });

  it("VCI-019 checks the deadline again just before the delivery", async () => {
    // A clock that passes the deadline after the answer's settle-time check
    // but before the delivery check: reading the answer's data moves it on.
    let clock = 1_000;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    const answer = {
      get data() {
        clock = 5_000;
        return [{ outcome: "issued" }];
      },
      error: null,
    };
    const rpc = fakeRpc(() => Promise.resolve(answer));
    const delivery = fakeTransport();
    const issuer = buildIssuer({ rpcClient: rpc.client, deliveryTransport: delivery.transport });
    const result = await issuer.issue(emailRequest());
    expect(clock).toBe(5_000);
    expect(result.outcome).toBe("failed");
    expect(prepareSpy).not.toHaveBeenCalled();
    expect(delivery.send).not.toHaveBeenCalled();
  });

  it("VCI-020 aborts the call at the deadline and holds the slot until the call itself settles", async () => {
    let resolveLate: (value: unknown) => void = () => undefined;
    const rpc = fakeRpc(
      () =>
        new Promise((resolve) => {
          resolveLate = resolve;
        }),
    );
    const delivery = fakeTransport();
    const slots = fakeSlots();
    const issuer = buildIssuer({
        rpcClient: rpc.client,
        rpcTimeoutMilliseconds: 20,
        deliveryTransport: delivery.transport,
        issuanceSlots: slots.slots,
      });
    const result = await issuer.issue(emailRequest());
    expect(result.outcome).toBe("failed");
    const [call] = rpc.calls;
    expect(call.signal?.aborted).toBe(true);
    // The call is still outstanding, so its slot is still held.
    await settle(20);
    expect(slots.release).not.toHaveBeenCalled();
    // A late `issued` is never acted on, and only now is the slot released.
    resolveLate({ data: [{ outcome: "issued" }], error: null });
    await settle(20);
    expect(slots.release).toHaveBeenCalledTimes(1);
    expect(prepareSpy).not.toHaveBeenCalled();
    expect(delivery.send).not.toHaveBeenCalled();
  });
});
