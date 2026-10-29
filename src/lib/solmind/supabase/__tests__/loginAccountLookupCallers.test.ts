// Login step 6, sub-slice S6-8: the server callers of the two S6-5 sign-in
// lookups (contract 21 Sections 7.1.3 and 11; contract 25 Section 15 item
// 11). A fake RPC seam covers every mapping; one block drives the real
// Supabase client over a fake fetch to show one POST per call. Every value is
// synthetic. Nothing here reaches a network, a database or a local Supabase
// stack: the client's host is a reserved name that cannot resolve, and its
// fetch is the fake.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspect, isDeepStrictEqual } from "node:util";

import { createClient } from "@supabase/supabase-js";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as authBarrel from "../../auth/index";
import * as contextBarrel from "../../context/index";
import { SOLMIND_ROLES } from "../../roles";
import * as supabaseBarrel from "../index";
import * as lookupModule from "../loginAccountLookupCallers";
import {
  LOGIN_ACCOUNT_LOOKUP_FUNCTION,
  LOGIN_ACCOUNT_LOOKUP_LIMITS,
  LOGIN_CHALLENGE_OWNERSHIP_FUNCTION,
  LOGIN_PASSWORD_FAILURE_FUNCTION,
  LOGIN_FLOW_CHALLENGE_RESOLUTION_FUNCTION,
  LoginAccountLookupError,
  REDEEMED_LOGIN_CHALLENGE_CONFIRMATION_FUNCTION,
  createLoginAccountLookup,
  createLoginChallengeOwnershipCheck,
  createLoginPasswordFailureRecorder,
  createLoginFlowChallengeResolver,
  createRedeemedLoginChallengeConfirmation,
  type LoginAccountLookupRpcClient,
} from "../loginAccountLookupCallers";

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

const SUPABASE_URL = "http://supabase.invalid";
const SERVICE_KEY = "synthetic-service-role-key-s68-lookup";
const EMAIL = "explorer.s68@solmind.example";
const ACCOUNT_ID = "1a111111-1111-4111-8111-11111111111f";
const CONTACT_ID = "2b222222-2222-4222-8222-22222222222e";
const PROVIDER_ID = "3f0c9a6e-1b2d-4c3e-8f4a-5b6c7d8e9f01";
const CHALLENGE_ID = "5d0c9a6e-1b2d-4c3e-8f4a-5b6c7d8e9f01";
const SENTINEL = "sentinel-s68-lookup-detail";
const TIMEOUT = 2_000;

function accountRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    user_account_id: ACCOUNT_ID,
    user_contact_method_id: CONTACT_ID,
    normalized_contact_value: EMAIL,
    provider_user_id: PROVIDER_ID,
    ...overrides,
  };
}

const FOUND = {
  outcome: "found",
  userAccountId: ACCOUNT_ID,
  userContactMethodId: CONTACT_ID,
  normalizedEmail: EMAIL,
  providerUserId: PROVIDER_ID,
};

type RpcCallRecord = Readonly<{ functionName: string; args: unknown; signal: AbortSignal }>;

// A fake RPC seam: `answer` decides what each call resolves to.
function fakeRpc(answer: (call: RpcCallRecord) => unknown) {
  const calls: RpcCallRecord[] = [];
  const client: LoginAccountLookupRpcClient = {
    rpc: (functionName, args) => ({
      abortSignal: (signal) => {
        const call = { functionName, args, signal };
        calls.push(call);
        return Promise.resolve().then(() => answer(call));
      },
    }),
  };
  return { client, calls };
}

function lookupRequest(overrides: Record<string, unknown> = {}) {
  return {
    normalizedIdentifier: EMAIL,
    identifierType: "email",
    requestedRoleContext: SOLMIND_ROLES.EXPLORER,
    ...overrides,
  } as Parameters<ReturnType<typeof createLoginAccountLookup>["resolve"]>[0];
}

function confirmationRequest(overrides: Record<string, unknown> = {}) {
  return {
    userAccountId: ACCOUNT_ID,
    challengeId: CHALLENGE_ID,
    expectedPurpose: "login",
    ...overrides,
  } as Parameters<ReturnType<typeof createRedeemedLoginChallengeConfirmation>["confirm"]>[0];
}

function textOf(value: unknown): string {
  return [String(value), JSON.stringify(value), inspect(value, { showHidden: true, depth: 6 })].join(" ");
}

beforeEach(() => {
  for (const method of CONSOLE_METHODS) {
    vi.spyOn(console, method);
  }
});

afterEach(() => {
  // The check runs in `try` and the restores in `finally`, so that a failed
  // check here cannot leave a spy in place for the tests after it.
  try {
    for (const method of CONSOLE_METHODS) {
      expect(vi.mocked(console[method]).mock.calls.length === 0, `console.${method} was not called`).toBe(true);
    }
  } finally {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});

describe("loginAccountLookupCallers - the account lookup", () => {
  it("LAL-001 one row gives `found` with exactly the four returned values, after one call of the one fixed function with the three arguments", async () => {
    const { client, calls } = fakeRpc(() => ({ data: [accountRow()], error: null }));
    const lookup = createLoginAccountLookup({ rpcClient: client, rpcTimeoutMilliseconds: TIMEOUT });
    const result = await lookup.resolve(lookupRequest());
    expect(isDeepStrictEqual(result, FOUND), "one row gives `found` with the row's four values").toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.keys(result).sort()).toEqual(
      ["normalizedEmail", "outcome", "providerUserId", "userAccountId", "userContactMethodId"].sort(),
    );
    expect(calls.length === 1, "exactly one database call").toBe(true);
    expect(calls[0].functionName).toBe(LOGIN_ACCOUNT_LOOKUP_FUNCTION);
    expect(LOGIN_ACCOUNT_LOOKUP_FUNCTION).toBe("solmind_resolve_login_account");
    expect(
      isDeepStrictEqual(calls[0].args, {
        p_normalized_login_identifier: EMAIL,
        p_login_identifier_type: "email",
        p_requested_role_context: "explorer",
      }),
      "the lookup's three arguments",
    ).toBe(true);
    expect(calls[0].signal.aborted).toBe(false);
    // The type and the role are the caller's request, passed on unchanged.
    await lookup.resolve(lookupRequest({ normalizedIdentifier: "admin.name", identifierType: "username", requestedRoleContext: SOLMIND_ROLES.ADMIN }));
    expect(calls[1].args).toEqual({
      p_normalized_login_identifier: "admin.name",
      p_login_identifier_type: "username",
      p_requested_role_context: "admin",
    });
    expect(Object.isFrozen(lookup)).toBe(true);
    expect(Object.keys(lookup)).toEqual(["resolve"]);
  });

  it("LAL-002 zero rows give `not_found`, one shared frozen object with only its outcome", async () => {
    const { client, calls } = fakeRpc(() => ({ data: [], error: null }));
    const lookup = createLoginAccountLookup({ rpcClient: client, rpcTimeoutMilliseconds: TIMEOUT });
    const first = await lookup.resolve(lookupRequest());
    const second = await lookup.resolve(lookupRequest({ normalizedIdentifier: "other.s68@solmind.example" }));
    expect(isDeepStrictEqual(first, { outcome: "not_found" }), "zero rows give `not_found` and nothing else").toBe(true);
    expect(second === first, "every `not_found` is the one shared object").toBe(true);
    expect(Object.isFrozen(first)).toBe(true);
    expect(calls.length === 2, "one database call for each lookup").toBe(true);
  });

  it("LAL-003 everything else is `failed`, with no value and no database text in the result", async () => {
    const answers: ReadonlyArray<readonly [string, unknown]> = [
      ["the invalid-identifier error", { data: null, error: { code: "P0001", message: "solmind_login_lookup_invalid_identifier" } }],
      ["the invalid-type error", { data: null, error: { code: "P0001", message: "solmind_login_lookup_invalid_identifier_type" } }],
      ["the invalid-role error", { data: null, error: { code: "P0001", message: "solmind_login_lookup_invalid_role" } }],
      ["another error", { data: null, error: { code: "57014", message: SENTINEL } }],
      ["an error beside a row", { data: [accountRow()], error: { message: SENTINEL } }],
      ["null data", { data: null, error: null }],
      ["a row that is not in a list", { data: accountRow(), error: null }],
      ["two rows", { data: [accountRow(), accountRow()], error: null }],
      ["an extra column", { data: [accountRow({ account_status: "active" })], error: null }],
      ["a missing column", { data: [{ user_account_id: ACCOUNT_ID, user_contact_method_id: CONTACT_ID, normalized_contact_value: EMAIL }], error: null }],
      ["an uppercase account UUID", { data: [accountRow({ user_account_id: ACCOUNT_ID.toUpperCase() })], error: null }],
      ["a null account UUID", { data: [accountRow({ user_account_id: null })], error: null }],
      ["a contact UUID with a line feed", { data: [accountRow({ user_contact_method_id: `${CONTACT_ID}\n` })], error: null }],
      ["a null contact UUID", { data: [accountRow({ user_contact_method_id: null })], error: null }],
      ["an empty email", { data: [accountRow({ normalized_contact_value: "" })], error: null }],
      ["a non-string email", { data: [accountRow({ normalized_contact_value: 7 })], error: null }],
      ["a provider id that is not a UUID", { data: [accountRow({ provider_user_id: "auth-user-1" })], error: null }],
      ["an uppercase provider id", { data: [accountRow({ provider_user_id: PROVIDER_ID.toUpperCase() })], error: null }],
      ["a null provider id", { data: [accountRow({ provider_user_id: null })], error: null }],
      ["a row with an accessor", { data: [Object.defineProperty(accountRow(), "provider_user_id", { enumerable: true, get: () => PROVIDER_ID })], error: null }],
      ["a row that is a list", { data: [[ACCOUNT_ID]], error: null }],
      ["an answer that is not an object", SENTINEL],
      ["an answer that is null", null],
      ["an answer that is a list", [{ data: [accountRow()], error: null }]],
    ];
    for (const [label, answer] of answers) {
      const { client, calls } = fakeRpc(() => answer);
      const lookup = createLoginAccountLookup({ rpcClient: client, rpcTimeoutMilliseconds: TIMEOUT });
      const result = await lookup.resolve(lookupRequest());
      expect(isDeepStrictEqual(result, { outcome: "failed" }), `${label}: the result is \`failed\` and nothing else`).toBe(true);
      expect(Object.isFrozen(result), label).toBe(true);
      expect(textOf(result), label).not.toContain(SENTINEL);
      expect(calls.length === 1, `${label}: exactly one database call`).toBe(true);
    }
    // A throw inside `rpc` or `abortSignal`, and a rejection.
    const throwing: ReadonlyArray<readonly [string, LoginAccountLookupRpcClient]> = [
      ["rpc throws", { rpc: () => { throw new Error(SENTINEL); } }],
      ["abortSignal throws", { rpc: () => ({ abortSignal: () => { throw new Error(SENTINEL); } }) }],
      ["the call rejects", { rpc: () => ({ abortSignal: () => Promise.reject(new Error(SENTINEL)) }) }],
    ];
    for (const [label, client] of throwing) {
      const lookup = createLoginAccountLookup({ rpcClient: client, rpcTimeoutMilliseconds: TIMEOUT });
      const result = await lookup.resolve(lookupRequest());
      expect(isDeepStrictEqual(result, { outcome: "failed" }), `${label}: the result is \`failed\` and nothing else`).toBe(true);
      expect(textOf(result), label).not.toContain(SENTINEL);
    }
  });

  it("LAL-004 a malformed request is `failed` with no database call", async () => {
    const { client, calls } = fakeRpc(() => ({ data: [accountRow()], error: null }));
    const lookup = createLoginAccountLookup({ rpcClient: client, rpcTimeoutMilliseconds: TIMEOUT });
    const malformedRequests = [
      lookupRequest({ normalizedIdentifier: "" }),
      lookupRequest({ normalizedIdentifier: null }),
      lookupRequest({ normalizedIdentifier: 42 }),
      lookupRequest({ identifierType: "phone" }),
      lookupRequest({ identifierType: "EMAIL" }),
      lookupRequest({ identifierType: null }),
      lookupRequest({ requestedRoleContext: "superuser" }),
      lookupRequest({ requestedRoleContext: "Explorer" }),
      lookupRequest({ requestedRoleContext: null }),
      { ...lookupRequest(), functionName: "solmind_create_user_session" },
      { normalizedIdentifier: EMAIL, identifierType: "email" },
      null,
      undefined,
      EMAIL,
      [lookupRequest()],
    ];
    for (const [index, request] of malformedRequests.entries()) {
      const result = await lookup.resolve(request as never);
      // A fixed label, the case's number: the requests hold the email.
      expect(
        isDeepStrictEqual(result, { outcome: "failed" }),
        `malformed request ${index + 1} of ${malformedRequests.length}: the result is \`failed\` and nothing else`,
      ).toBe(true);
    }
    expect(calls.length === 0, "no database call was made").toBe(true);
  });

  it("LAL-005 a call that never answers is `failed` at the deadline, and its signal is aborted; a late answer is `failed` too", async () => {
    let seen: AbortSignal | null = null;
    const hanging: LoginAccountLookupRpcClient = {
      rpc: () => ({
        abortSignal: (signal) => {
          seen = signal;
          return new Promise<unknown>(() => undefined);
        },
      }),
    };
    const lookup = createLoginAccountLookup({ rpcClient: hanging, rpcTimeoutMilliseconds: 30 });
    const startedAt = performance.now();
    expect(
      isDeepStrictEqual(await lookup.resolve(lookupRequest()), { outcome: "failed" }),
      "a call that never answers is `failed` and nothing else",
    ).toBe(true);
    expect(performance.now() - startedAt).toBeGreaterThanOrEqual(25);
    expect((seen as AbortSignal | null)?.aborted).toBe(true);

    // Controlled time: the same hanging call is still open one millisecond
    // before the deadline, and is decided and aborted at the deadline. Only
    // setTimeout and clearTimeout are faked (the caller's deadline timer); the
    // `finally` puts the real ones back, whatever a check does.
    const held: { signal: AbortSignal | null; settled: boolean } = { signal: null, settled: false };
    const heldClient: LoginAccountLookupRpcClient = {
      rpc: () => ({
        abortSignal: (signal) => {
          held.signal = signal;
          return new Promise<unknown>(() => undefined);
        },
      }),
    };
    const turns = async (): Promise<void> => {
      for (let turn = 0; turn < 10; turn += 1) {
        await Promise.resolve();
      }
    };
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const timedLookup = createLoginAccountLookup({ rpcClient: heldClient, rpcTimeoutMilliseconds: 30 });
      const pending = timedLookup.resolve(lookupRequest()).then((result) => {
        held.settled = true;
        return result;
      });
      await vi.advanceTimersByTimeAsync(29);
      await turns();
      expect(
        held.settled === false,
        "LAL-005: one millisecond before the deadline the call has not settled",
      ).toBe(true);
      expect(
        held.signal !== null && held.signal.aborted === false,
        "LAL-005: one millisecond before the deadline the call's signal is not aborted",
      ).toBe(true);
      await vi.advanceTimersByTimeAsync(1);
      await turns();
      // Checked before `pending` is awaited: a call with no deadline fails here.
      expect(held.settled === true, "LAL-005: at the deadline the call has settled").toBe(true);
      expect(
        isDeepStrictEqual(await pending, { outcome: "failed" }),
        "LAL-005: at the deadline the call is `failed` and nothing else",
      ).toBe(true);
      expect(
        held.signal !== null && held.signal.aborted === true,
        "LAL-005: at the deadline the call's signal is aborted",
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }

    // A good row that arrives after the deadline is not acted on.
    const late: LoginAccountLookupRpcClient = {
      rpc: () => ({
        abortSignal: () =>
          new Promise<unknown>((resolve) => {
            setTimeout(() => resolve({ data: [accountRow()], error: null }), 80);
          }),
      }),
    };
    const lateLookup = createLoginAccountLookup({ rpcClient: late, rpcTimeoutMilliseconds: 30 });
    expect(
      isDeepStrictEqual(await lateLookup.resolve(lookupRequest()), { outcome: "failed" }),
      "a row that arrives after the deadline is `failed` and nothing else",
    ).toBe(true);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 90);
    });
  });
});

describe("loginAccountLookupCallers - the redeemed-challenge confirmation", () => {
  it("LAL-006 exactly one row { confirmed: true } is `confirmed`, and { confirmed: false } is `not_confirmed`, after one call of the one fixed function", async () => {
    let confirmed = true;
    const { client, calls } = fakeRpc(() => ({ data: [{ confirmed }], error: null }));
    const confirmation = createRedeemedLoginChallengeConfirmation({ rpcClient: client, rpcTimeoutMilliseconds: TIMEOUT });
    const yes = await confirmation.confirm(confirmationRequest());
    expect(yes).toEqual({ outcome: "confirmed" });
    expect(Object.isFrozen(yes)).toBe(true);
    confirmed = false;
    const no = await confirmation.confirm(confirmationRequest());
    expect(no).toEqual({ outcome: "not_confirmed" });
    expect(Object.isFrozen(no)).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0].functionName).toBe(REDEEMED_LOGIN_CHALLENGE_CONFIRMATION_FUNCTION);
    expect(REDEEMED_LOGIN_CHALLENGE_CONFIRMATION_FUNCTION).toBe("solmind_confirm_redeemed_login_challenge");
    expect(calls[0].args).toEqual({
      p_user_account_id: ACCOUNT_ID,
      p_verification_challenge_id: CHALLENGE_ID,
      p_expected_purpose: "login",
    });
    await confirmation.confirm(confirmationRequest({ expectedPurpose: "role_reentry" }));
    expect((calls[2].args as Record<string, string>).p_expected_purpose).toBe("role_reentry");
    expect(Object.keys(confirmation)).toEqual(["confirm"]);
  });

  it("LAL-007 everything else is `failed`: only the boolean true confirms", async () => {
    const answers: ReadonlyArray<readonly [string, unknown]> = [
      ["the text true", { data: [{ confirmed: "true" }], error: null }],
      ["the number 1", { data: [{ confirmed: 1 }], error: null }],
      ["null", { data: [{ confirmed: null }], error: null }],
      ["an extra key", { data: [{ confirmed: true, user_account_id: ACCOUNT_ID }], error: null }],
      ["another key", { data: [{ outcome: "confirmed" }], error: null }],
      ["two rows", { data: [{ confirmed: true }, { confirmed: true }], error: null }],
      ["zero rows", { data: [], error: null }],
      ["a bare boolean", { data: true, error: null }],
      ["a bare row", { data: { confirmed: true }, error: null }],
      ["the invalid-account error", { data: null, error: { code: "P0001", message: "solmind_login_confirm_invalid_account" } }],
      ["an error beside true", { data: [{ confirmed: true }], error: { message: SENTINEL } }],
      ["an accessor", { data: [Object.defineProperty({}, "confirmed", { enumerable: true, get: () => true })], error: null }],
      ["an answer that is null", null],
    ];
    for (const [label, answer] of answers) {
      const { client } = fakeRpc(() => answer);
      const confirmation = createRedeemedLoginChallengeConfirmation({ rpcClient: client, rpcTimeoutMilliseconds: TIMEOUT });
      const result = await confirmation.confirm(confirmationRequest());
      expect(result, label).toEqual({ outcome: "failed" });
      expect(textOf(result), label).not.toContain(SENTINEL);
    }
    const rejecting: LoginAccountLookupRpcClient = {
      rpc: () => ({ abortSignal: () => Promise.reject(new Error(SENTINEL)) }),
    };
    const confirmation = createRedeemedLoginChallengeConfirmation({ rpcClient: rejecting, rpcTimeoutMilliseconds: TIMEOUT });
    expect(await confirmation.confirm(confirmationRequest())).toEqual({ outcome: "failed" });
  });

  it("LAL-008 a malformed request is `failed` with no database call, and a late `true` is not acted on", async () => {
    const { client, calls } = fakeRpc(() => ({ data: [{ confirmed: true }], error: null }));
    const confirmation = createRedeemedLoginChallengeConfirmation({ rpcClient: client, rpcTimeoutMilliseconds: TIMEOUT });
    for (const request of [
      confirmationRequest({ userAccountId: ACCOUNT_ID.toUpperCase() }),
      confirmationRequest({ userAccountId: null }),
      confirmationRequest({ challengeId: "not-a-uuid" }),
      confirmationRequest({ challengeId: `${CHALLENGE_ID}\n` }),
      confirmationRequest({ expectedPurpose: "password_reset" }),
      confirmationRequest({ expectedPurpose: null }),
      { ...confirmationRequest(), role: "admin" },
      { userAccountId: ACCOUNT_ID, challengeId: CHALLENGE_ID },
      null,
    ]) {
      expect(await confirmation.confirm(request as never), JSON.stringify(request)).toEqual({ outcome: "failed" });
    }
    expect(calls).toEqual([]);

    const late: LoginAccountLookupRpcClient = {
      rpc: () => ({
        abortSignal: () =>
          new Promise<unknown>((resolve) => {
            setTimeout(() => resolve({ data: [{ confirmed: true }], error: null }), 80);
          }),
      }),
    };
    const lateConfirmation = createRedeemedLoginChallengeConfirmation({ rpcClient: late, rpcTimeoutMilliseconds: 30 });
    expect(await lateConfirmation.confirm(confirmationRequest())).toEqual({ outcome: "failed" });
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 90);
    });
  });
});

describe("loginAccountLookupCallers - construction, and one POST per call through the real client", () => {
  it("LAL-009 malformed dependencies give one fixed, value-free error", () => {
    const { client } = fakeRpc(() => ({ data: [], error: null }));
    for (const factory of [createLoginAccountLookup, createRedeemedLoginChallengeConfirmation]) {
      for (const dependencies of [
        null,
        {},
        { rpcClient: client },
        { rpcClient: client, rpcTimeoutMilliseconds: LOGIN_ACCOUNT_LOOKUP_LIMITS.minimumRpcTimeoutMilliseconds - 1 },
        { rpcClient: client, rpcTimeoutMilliseconds: LOGIN_ACCOUNT_LOOKUP_LIMITS.maximumRpcTimeoutMilliseconds + 1 },
        { rpcClient: client, rpcTimeoutMilliseconds: 1.5 },
        { rpcClient: {}, rpcTimeoutMilliseconds: TIMEOUT },
        { rpcClient: null, rpcTimeoutMilliseconds: TIMEOUT },
        { rpcClient: client, rpcTimeoutMilliseconds: TIMEOUT, functionName: SENTINEL },
      ]) {
        let thrown: unknown = null;
        try {
          factory(dependencies as never);
        } catch (error) {
          thrown = error;
        }
        expect(thrown).toBeInstanceOf(LoginAccountLookupError);
        expect((thrown as LoginAccountLookupError).message).toBe("login_account_lookup_invalid_configuration");
        expect(textOf(thrown)).not.toContain(SENTINEL);
      }
      // The limits themselves are accepted.
      expect(() => factory({ rpcClient: client, rpcTimeoutMilliseconds: 10 })).not.toThrow();
      expect(() => factory({ rpcClient: client, rpcTimeoutMilliseconds: 60_000 })).not.toThrow();
    }
  });

  it("LAL-010 through the real Supabase client each call is one POST to its own function, with the arguments as the JSON body and the caller's abort signal; a 503, a 520 and a network error are not replayed", async () => {
    type Seen = { url: string; method: string; body: unknown; signal: AbortSignal | null };
    const seen: Seen[] = [];
    let respond: (seen: Seen) => Response | Promise<Response> = () =>
      new Response(JSON.stringify([accountRow()]), { status: 200, headers: { "Content-Type": "application/json" } });
    const fakeFetch = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
      const record: Seen = {
        url: String(input),
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
        signal: init?.signal ?? null,
      };
      seen.push(record);
      return respond(record);
    });
    const client = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: fakeFetch as unknown as typeof fetch },
    });
    const lookup = createLoginAccountLookup({ rpcClient: client, rpcTimeoutMilliseconds: 5_000 });
    const confirmation = createRedeemedLoginChallengeConfirmation({ rpcClient: client, rpcTimeoutMilliseconds: 5_000 });

    expect(
      isDeepStrictEqual(await lookup.resolve(lookupRequest()), FOUND),
      "through the real client one row gives `found` with the row's four values",
    ).toBe(true);
    expect(seen.length === 1, "one request after the first lookup").toBe(true);
    expect(seen[0].url).toBe(`${SUPABASE_URL}/rest/v1/rpc/solmind_resolve_login_account`);
    expect(seen[0].method).toBe("POST");
    expect(
      isDeepStrictEqual(seen[0].body, {
        p_normalized_login_identifier: EMAIL,
        p_login_identifier_type: "email",
        p_requested_role_context: "explorer",
      }),
      "the lookup's three arguments are the JSON body",
    ).toBe(true);
    expect(seen[0].signal).not.toBeNull();

    respond = () => new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
    expect(
      isDeepStrictEqual(await lookup.resolve(lookupRequest()), { outcome: "not_found" }),
      "through the real client zero rows give `not_found` and nothing else",
    ).toBe(true);
    expect(seen.length === 2, "two requests after the second lookup").toBe(true);

    respond = () =>
      new Response(JSON.stringify([{ confirmed: true }]), { status: 200, headers: { "Content-Type": "application/json" } });
    expect(await confirmation.confirm(confirmationRequest())).toEqual({ outcome: "confirmed" });
    expect(seen.length === 3, "three requests after the confirmation").toBe(true);
    expect(seen[2].url).toBe(`${SUPABASE_URL}/rest/v1/rpc/solmind_confirm_redeemed_login_challenge`);
    expect(seen[2].method).toBe("POST");
    expect(seen[2].body).toEqual({
      p_user_account_id: ACCOUNT_ID,
      p_verification_challenge_id: CHALLENGE_ID,
      p_expected_purpose: "login",
    });
    expect(
      seen[2].signal instanceof AbortSignal,
      "LAL-010: the confirmation request carried an abort signal",
    ).toBe(true);

    // The function's own fixed error, as PostgREST sends it.
    respond = () =>
      new Response(JSON.stringify({ code: "P0001", message: "solmind_login_lookup_invalid_identifier", details: null, hint: null }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    expect(
      isDeepStrictEqual(await lookup.resolve(lookupRequest()), { outcome: "failed" }),
      "the function's own error is `failed` and nothing else",
    ).toBe(true);
    expect(seen.length === 4, "four requests after the refused lookup").toBe(true);

    // No replay of the POST.
    let before = seen.length;
    for (const status of [503, 520]) {
      respond = () => new Response(JSON.stringify({ message: SENTINEL }), { status, headers: { "Content-Type": "application/json" } });
      expect(
        isDeepStrictEqual(await lookup.resolve(lookupRequest()), { outcome: "failed" }),
        `${String(status)}: the lookup is \`failed\` and nothing else`,
      ).toBe(true);
      expect(await confirmation.confirm(confirmationRequest()), String(status)).toEqual({ outcome: "failed" });
      expect(seen.length - before, String(status)).toBe(2);
      before = seen.length;
    }
    respond = () => Promise.reject(new TypeError(`fetch failed: ${SENTINEL}`));
    expect(
      isDeepStrictEqual(await lookup.resolve(lookupRequest()), { outcome: "failed" }),
      "a network error is `failed` and nothing else",
    ).toBe(true);
    expect(await confirmation.confirm(confirmationRequest())).toEqual({ outcome: "failed" });
    expect(seen.length - before).toBe(2);

    // The deadline aborts the request's own signal.
    respond = (record) =>
      new Promise<Response>((_resolve, reject) => {
        record.signal?.addEventListener("abort", () => {
          reject(new DOMException("This operation was aborted", "AbortError"));
        });
      });
    const hangLookup = createLoginAccountLookup({ rpcClient: client, rpcTimeoutMilliseconds: 40 });
    expect(
      isDeepStrictEqual(await hangLookup.resolve(lookupRequest()), { outcome: "failed" }),
      "a request aborted at the deadline is `failed` and nothing else",
    ).toBe(true);
    expect(seen[seen.length - 1].signal?.aborted).toBe(true);

    // The confirmation's deadline aborts its own request's signal too: the
    // request never answers, and only the abort ends it.
    const hangConfirmation = createRedeemedLoginChallengeConfirmation({
      rpcClient: client,
      rpcTimeoutMilliseconds: 40,
    });
    const beforeHang = seen.length;
    expect(
      isDeepStrictEqual(await hangConfirmation.confirm(confirmationRequest()), { outcome: "failed" }),
      "LAL-010: a confirmation request aborted at the deadline is `failed` and nothing else",
    ).toBe(true);
    expect(seen.length === beforeHang + 1, "LAL-010: the hanging confirmation made exactly one request").toBe(true);
    const hungRequest = seen[seen.length - 1];
    expect(
      hungRequest.url === `${SUPABASE_URL}/rest/v1/rpc/solmind_confirm_redeemed_login_challenge` &&
        hungRequest.method === "POST",
      "LAL-010: the hanging request is the confirmation's POST",
    ).toBe(true);
    expect(
      hungRequest.signal instanceof AbortSignal && hungRequest.signal.aborted === true,
      "LAL-010: the hanging confirmation request's signal was aborted",
    ).toBe(true);
  }, 15_000);
});

describe("loginAccountLookupCallers - module boundary (server-only, off the three checked barrels)", () => {
  function moduleText(): string {
    return fs.readFileSync(fileURLToPath(new URL("../loginAccountLookupCallers.ts", import.meta.url)), "utf8");
  }

  it("LAB-001 starts with the server-only import, imports only the role names besides it, and names exactly its three functions", () => {
    const text = moduleText();
    expect(text.startsWith('import "server-only";')).toBe(true);
    expect(text.charCodeAt(0)).not.toBe(0xfeff);
    const source = ts.createSourceFile("callers.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const imports: string[] = [];
    const literals: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
        imports.push(node.moduleSpecifier.text);
      } else if (ts.isStringLiteralLike(node)) {
        literals.push(node.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(imports).toEqual(["server-only", "../roles"]);
    // The only database function names in the module's code.
    expect(literals.filter((literal) => literal.startsWith("solmind_")).sort()).toEqual([
      "solmind_check_login_challenge_owner",
      "solmind_confirm_redeemed_login_challenge",
      "solmind_record_login_password_failure",
      "solmind_resolve_login_account",
      "solmind_resolve_login_flow_challenge",
    ]);
    expect(text).not.toMatch(
      /process\.|console\.|\bfetch\s*\(|localStorage|sessionStorage|document\.cookie|cookies\s*\(|["']use server["']|Math\.random|randomUUID|import\.meta|next\/|NEXT_PUBLIC_|@supabase|\.from\s*\(|\.select\s*\(/,
    );
    // One `.rpc(` call site, in the one shared call helper.
    expect(text.match(/\.rpc\s*\(/g)).toEqual([".rpc("]);
    expect(Object.keys(lookupModule).sort()).toEqual(
      [
        "LOGIN_ACCOUNT_LOOKUP_ERROR_CODES",
        "LOGIN_ACCOUNT_LOOKUP_FUNCTION",
        "LOGIN_ACCOUNT_LOOKUP_LIMITS",
        "LOGIN_CHALLENGE_OWNERSHIP_FUNCTION",
        "LOGIN_PASSWORD_FAILURE_FUNCTION",
        "LOGIN_FLOW_CHALLENGE_RESOLUTION_FUNCTION",
        "LOGIN_IDENTIFIER_TYPES",
        "LoginAccountLookupError",
        "REDEEMED_LOGIN_CHALLENGE_CONFIRMATION_FUNCTION",
        "REDEEMED_LOGIN_CHALLENGE_PURPOSES",
        "createLoginAccountLookup",
        "createLoginChallengeOwnershipCheck",
        "createLoginPasswordFailureRecorder",
        "createLoginFlowChallengeResolver",
        "createRedeemedLoginChallengeConfirmation",
      ].sort(),
    );
  });

  it("LAB-002 is not exported from the three barrels checked: src/lib/solmind/auth/index.ts, src/lib/solmind/context/index.ts and src/lib/solmind/supabase/index.ts", () => {
    for (const exportedName of Object.keys(lookupModule)) {
      expect(exportedName in authBarrel, exportedName).toBe(false);
      expect(exportedName in supabaseBarrel, exportedName).toBe(false);
      expect(exportedName in contextBarrel, exportedName).toBe(false);
    }
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
    for (const barrel of [
      path.join(root, "lib", "solmind", "auth", "index.ts"),
      path.join(root, "lib", "solmind", "context", "index.ts"),
      path.join(root, "lib", "solmind", "supabase", "index.ts"),
    ]) {
      expect(fs.readFileSync(barrel, "utf8"), barrel).not.toContain("loginAccountLookupCallers");
    }
  });
});

describe("loginAccountLookupCallers - exact non-consuming login ownership", () => {
  const request = () => ({ userAccountId: ACCOUNT_ID, challengeId: CHALLENGE_ID });
  const failed = (value: unknown) => {
    expect(isDeepStrictEqual(value, { outcome: "failed" }), "fixed failure only").toBe(true);
    expect(Object.isFrozen(value), "failure frozen").toBe(true);
    expect(textOf(value).includes(SENTINEL), "no underlying detail").toBe(false);
  };

  it("OWN-001 fixes the function and login purpose, snapshots selectors, and returns only frozen boolean outcomes", async () => {
    let owned = true;
    const { client, calls } = fakeRpc(() => ({ data: [{ owned }], error: null }));
    const checker = createLoginChallengeOwnershipCheck({ rpcClient: client, rpcTimeoutMilliseconds: TIMEOUT });
    const input = request();
    const pending = checker.check(input);
    input.userAccountId = SENTINEL; input.challengeId = SENTINEL;
    const yes = await pending;
    expect(isDeepStrictEqual(yes, { outcome: "owned" }), "only owned outcome").toBe(true);
    expect(Object.isFrozen(yes) && Object.isFrozen(checker), "results and capability frozen").toBe(true);
    expect(Object.keys(checker)).toEqual(["check"]);
    expect(calls.length === 1 && calls[0].functionName === "solmind_check_login_challenge_owner", "one exact function").toBe(true);
    expect(LOGIN_CHALLENGE_OWNERSHIP_FUNCTION).toBe("solmind_check_login_challenge_owner");
    expect(isDeepStrictEqual(calls[0].args, { p_user_account_id: ACCOUNT_ID,
      p_verification_challenge_id: CHALLENGE_ID, p_expected_purpose: "login" }), "original selectors and fixed purpose").toBe(true);
    owned = false;
    const no = await checker.check(request());
    expect(isDeepStrictEqual(no, { outcome: "not_owned" }) && Object.isFrozen(no), "only frozen not_owned").toBe(true);
    expect(calls.length).toBe(2);
  });

  it("OWN-002 invalid or widened requests never call RPC or invoke field getters", async () => {
    const { client, calls } = fakeRpc(() => ({ data: [{ owned: true }], error: null }));
    const checker = createLoginChallengeOwnershipCheck({ rpcClient: client, rpcTimeoutMilliseconds: TIMEOUT });
    let getterCalls = 0;
    const accessor = { challengeId: CHALLENGE_ID };
    Object.defineProperty(accessor, "userAccountId", { enumerable: true, get() { getterCalls++; return ACCOUNT_ID; } });
    const values: unknown[] = [null, undefined, [], SENTINEL, {}, { userAccountId: ACCOUNT_ID },
      { ...request(), expectedPurpose: "login" }, { ...request(), role: "admin" },
      { ...request(), userAccountId: null }, { ...request(), challengeId: null },
      { ...request(), userAccountId: ACCOUNT_ID.toUpperCase() }, { ...request(), challengeId: CHALLENGE_ID + "\n" },
      { ...request(), challengeId: SENTINEL }, Object.assign(Object.create({ inherited: true }), request()),
      { ...request(), [Symbol("extra")]: true }, accessor,
      new Proxy({}, { ownKeys() { throw new Error(SENTINEL); } })];
    for (const value of values) failed(await checker.check(value as never));
    expect(calls.length === 0 && getterCalls === 0, "invalid requests neither call nor invoke getters").toBe(true);
  });

  it("OWN-003 only one plain boolean-only row can establish ownership", async () => {
    let getterCalls = 0;
    const getterRow = Object.defineProperty({}, "owned", { enumerable: true, get() { getterCalls++; return true; } });
    const getterArray = Object.defineProperty(new Array(1), "0", { enumerable: true, get() { getterCalls++; return { owned: true }; } });
    const values: unknown[] = [null, [], [{ owned: true }, { owned: true }], true, { owned: true },
      [{ owned: "true" }], [{ owned: 1 }], [{ owned: null }], [{}], [{ confirmed: true }],
      [{ owned: true, detail: SENTINEL }], [{ owned: true, [Symbol("extra")]: true }],
      [Object.create({ owned: true })], [getterRow], getterArray, new Array(1),
      Object.assign([{ owned: true }], { extra: true }),
      [new Proxy({}, { getPrototypeOf() { throw new Error(SENTINEL); } })]];
    for (const data of values) {
      const { client } = fakeRpc(() => ({ data, error: null }));
      failed(await createLoginChallengeOwnershipCheck({ rpcClient: client, rpcTimeoutMilliseconds: TIMEOUT }).check(request()));
    }
    expect(getterCalls, "row and array getters were not invoked").toBe(0);
    for (const response of [null, undefined, { data: [{ owned: true }], error: { message: SENTINEL } }]) {
      const { client } = fakeRpc(() => response);
      failed(await createLoginChallengeOwnershipCheck({ rpcClient: client, rpcTimeoutMilliseconds: TIMEOUT }).check(request()));
    }
  });

  it("OWN-004 construction rejects invalid configuration, and transport exceptions stay value-free", async () => {
    const { client } = fakeRpc(() => ({ data: [{ owned: true }], error: null }));
    for (const value of [null, {}, { rpcClient: client, rpcTimeoutMilliseconds: 9 },
      { rpcClient: client, rpcTimeoutMilliseconds: 60_001 }, { rpcClient: client, rpcTimeoutMilliseconds: 1.5 },
      { rpcClient: client, rpcTimeoutMilliseconds: TIMEOUT, functionName: SENTINEL }]) {
      let caught: unknown;
      try { createLoginChallengeOwnershipCheck(value as never); } catch (error) { caught = error; }
      expect(caught instanceof LoginAccountLookupError && !textOf(caught).includes(SENTINEL), "fixed construction failure").toBe(true);
    }
    for (const rpcClient of [
      { rpc() { throw new Error(SENTINEL); } },
      { rpc() { return { abortSignal() { throw new Error(SENTINEL); } }; } },
      { rpc() { return { abortSignal() { return Promise.reject(new Error(SENTINEL)); } }; } },
    ]) failed(await createLoginChallengeOwnershipCheck({ rpcClient, rpcTimeoutMilliseconds: TIMEOUT }).check(request()));
  });

  it("OWN-005 hanging calls abort at the inclusive deadline and late rejection is consumed without retry", async () => {
    vi.useFakeTimers();
    try {
      let reject!: (reason: unknown) => void;
      let signal: AbortSignal | undefined;
      let calls = 0;
      const rpcClient = { rpc() { calls++; return { abortSignal(s: AbortSignal) {
        signal = s; return new Promise((_, r) => { reject = r; });
      } }; } };
      const checker = createLoginChallengeOwnershipCheck({ rpcClient, rpcTimeoutMilliseconds: 10 });
      let settled = false;
      const pending = checker.check(request()).then(value => { settled = true; return value; });
      await vi.advanceTimersByTimeAsync(9);
      expect(!settled && signal?.aborted === false, "before deadline still pending").toBe(true);
      await vi.advanceTimersByTimeAsync(1);
      failed(await pending);
      expect(signal?.aborted === true && calls === 1, "at deadline aborted exactly one attempt").toBe(true);
      reject(new Error(SENTINEL));
      await vi.advanceTimersByTimeAsync(1);
      expect(calls).toBe(1);
    } finally { vi.useRealTimers(); }
  });

  it("OWN-006 rejects positive answers received or parsed at the exact monotonic deadline", async () => {
    vi.useFakeTimers();
    try {
      const clock = vi.spyOn(performance, "now").mockReturnValue(100);
      let deliver!: (value: unknown) => void;
      const rpcClient = { rpc() { return { abortSignal() { return new Promise(r => { deliver = r; }); } }; } };
      const pending = createLoginChallengeOwnershipCheck({ rpcClient, rpcTimeoutMilliseconds: 10 }).check(request());
      clock.mockReturnValue(110);
      deliver({ data: [{ owned: true }], error: null });
      failed(await pending);
      clock.mockReturnValue(100);
      const row = new Proxy({ owned: true }, { ownKeys(target) { clock.mockReturnValue(110); return Reflect.ownKeys(target); } });
      const { client } = fakeRpc(() => ({ data: [row], error: null }));
      failed(await createLoginChallengeOwnershipCheck({ rpcClient: client, rpcTimeoutMilliseconds: 10 }).check(request()));
    } finally { vi.useRealTimers(); }
  });

  it("OWN-007 real client with fake fetch sends one fixed POST, carries abort, and never replays failed requests", async () => {
    type Seen = { url: string; method: string; body: unknown; signal: AbortSignal | null };
    const seen: Seen[] = [];
    let respond: () => Response = () => new Response('[{"owned":true}]', { status: 200, headers: { "Content-Type": "application/json" } });
    const fakeFetch = vi.fn(async (input: unknown, init?: RequestInit) => {
      seen.push({ url: String(input), method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? JSON.parse(init.body) : null, signal: init?.signal ?? null });
      return respond();
    });
    const client = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: fakeFetch as unknown as typeof fetch },
    });
    const checker = createLoginChallengeOwnershipCheck({ rpcClient: client, rpcTimeoutMilliseconds: TIMEOUT });
    expect(isDeepStrictEqual(await checker.check(request()), { outcome: "owned" }), "real client parsed owned").toBe(true);
    expect(seen.length === 1 && seen[0].url === SUPABASE_URL + "/rest/v1/rpc/solmind_check_login_challenge_owner" &&
      seen[0].method === "POST" && seen[0].signal instanceof AbortSignal && isDeepStrictEqual(seen[0].body,
      { p_user_account_id: ACCOUNT_ID, p_verification_challenge_id: CHALLENGE_ID, p_expected_purpose: "login" }), "one exact request").toBe(true);
    for (const status of [400, 503, 520]) {
      respond = () => new Response(JSON.stringify({ message: SENTINEL }), { status, headers: { "Content-Type": "application/json" } });
      const before = seen.length; failed(await checker.check(request()));
      expect(seen.length === before + 1, "failed response not replayed").toBe(true);
    }
    respond = () => { throw new Error(SENTINEL); };
    const before = seen.length; failed(await checker.check(request()));
    expect(seen.length === before + 1, "network error not replayed").toBe(true);
  });
});


describe("loginAccountLookupCallers - confirmed password-failure recorder", () => {
  it.each(["guide", "admin"] as const)("records one server-bound %s failure through the fixed RPC", async roleContext => {
    const { client, calls } = fakeRpc(() => ({ data: [{ recorded: true }], error: null }));
    const recorder = createLoginPasswordFailureRecorder({ rpcClient: client, rpcTimeoutMilliseconds: TIMEOUT });
    const value = await recorder.recordWrongPassword({ userAccountId: ACCOUNT_ID, challengeId: CHALLENGE_ID, roleContext });
    expect(isDeepStrictEqual(value, { outcome: "recorded" }), "fixed recorded answer").toBe(true);
    expect(Object.isFrozen(value)).toBe(true);
    expect(calls.length === 1, "one write attempt without automatic retry").toBe(true);
    expect(calls[0].functionName).toBe(LOGIN_PASSWORD_FAILURE_FUNCTION);
    expect(LOGIN_PASSWORD_FAILURE_FUNCTION).toBe("solmind_record_login_password_failure");
    expect(isDeepStrictEqual(calls[0].args, { p_user_account_id: ACCOUNT_ID,
      p_verification_challenge_id: CHALLENGE_ID, p_role_context: roleContext }), "no typed credential or code reaches the RPC").toBe(true);
  });
  it("maps an ineligible row or unknown persistence without inventing a recorded attempt", async () => {
    for (const [answer, outcome] of [
      [{ data: [{ recorded: false }], error: null }, "not_recorded"],
      [{ data: [{ recorded: true, extra: SENTINEL }], error: null }, "failed"],
      [{ data: [], error: null }, "failed"],
      [{ data: null, error: { message: SENTINEL } }, "failed"],
    ] as const) {
      const { client, calls } = fakeRpc(() => answer);
      const recorder = createLoginPasswordFailureRecorder({ rpcClient: client, rpcTimeoutMilliseconds: TIMEOUT });
      const result = await recorder.recordWrongPassword({ userAccountId: ACCOUNT_ID, challengeId: CHALLENGE_ID, roleContext: "guide" });
      expect(isDeepStrictEqual(result, { outcome }), "closed non-recorded result").toBe(true);
      expect(calls.length === 1, "uncertain write is never retried").toBe(true);
    }
  });
  it("rejects malformed, cross-role and credential-bearing requests before RPC", async () => {
    const { client, calls } = fakeRpc(() => ({ data: [{ recorded: true }], error: null }));
    const recorder = createLoginPasswordFailureRecorder({ rpcClient: client, rpcTimeoutMilliseconds: TIMEOUT });
    const base = { userAccountId: ACCOUNT_ID, challengeId: CHALLENGE_ID, roleContext: "guide" };
    let getterReads = 0;
    for (const request of [{ ...base, roleContext: "explorer" }, { ...base, roleContext: "guide\n" },
      { ...base, challengeId: CHALLENGE_ID + "\n" }, { ...base, password: SENTINEL },
      Object.defineProperty({ ...base }, "challengeId", { enumerable: true, get() { getterReads++; return CHALLENGE_ID; } })]) {
      expect(isDeepStrictEqual(await recorder.recordWrongPassword(request as never), { outcome: "failed" }), "fixed local failure").toBe(true);
    }
    expect(calls.length === 0 && getterReads === 0, "invalid requests have no effects or getter access").toBe(true);
  });
});

describe("password-failure recorder deadline", () => {
  const request = { userAccountId: ACCOUNT_ID, challengeId: CHALLENGE_ID, roleContext: "guide" as const };
  it("aborts one hanging attempt at the inclusive deadline and consumes late rejection", async () => {
    vi.useFakeTimers();
    try {
      let reject!: (reason: unknown) => void; let signal: AbortSignal | undefined; let calls = 0;
      const rpcClient = { rpc() { calls++; return { abortSignal(s: AbortSignal) {
        signal = s; return new Promise((_, r) => { reject = r; });
      } }; } };
      const recorder = createLoginPasswordFailureRecorder({ rpcClient, rpcTimeoutMilliseconds: 10 });
      let settled = false;
      const pending = recorder.recordWrongPassword(request).then(value => { settled = true; return value; });
      await vi.advanceTimersByTimeAsync(9);
      expect(!settled && signal?.aborted === false).toBe(true);
      await vi.advanceTimersByTimeAsync(1);
      expect(await pending).toEqual({ outcome: "failed" });
      expect(signal?.aborted === true && calls === 1).toBe(true);
      reject(new Error(SENTINEL)); await vi.advanceTimersByTimeAsync(1);
      expect(calls).toBe(1);
    } finally { vi.useRealTimers(); }
  });
  it("refuses a late positive persistence answer without retry or a recorded claim", async () => {
    vi.useFakeTimers();
    try {
      const clock = vi.spyOn(performance, "now").mockReturnValue(100);
      let deliver!: (value: unknown) => void; let calls = 0;
      const rpcClient = { rpc() { calls++; return { abortSignal() { return new Promise(r => { deliver = r; }); } }; } };
      const pending = createLoginPasswordFailureRecorder({ rpcClient, rpcTimeoutMilliseconds: 10 }).recordWrongPassword(request);
      clock.mockReturnValue(110); deliver({ data: [{ recorded: true }], error: null });
      expect(await pending).toEqual({ outcome: "failed" }); expect(calls).toBe(1);
      clock.mockReturnValue(100);
      const row = new Proxy({ recorded: true }, { ownKeys(target) { clock.mockReturnValue(110); return Reflect.ownKeys(target); } });
      const f = fakeRpc(() => ({ data: [row], error: null }));
      expect(await createLoginPasswordFailureRecorder({ rpcClient: f.client, rpcTimeoutMilliseconds: 10 }).recordWrongPassword(request)).toEqual({ outcome: "failed" });
      expect(f.calls.length).toBe(1);

    } finally { vi.useRealTimers(); }
  });
});


describe("login-flow current-challenge resolver", () => {
  const flowId = "6f170000-0000-4000-8000-000000000001";
  const request = { flowId, userAccountId: ACCOUNT_ID, userContactMethodId: CONTACT_ID, roleContext: "explorer" as const };
  it.each(["explorer", "guide", "admin"] as const)("resolves one server-bound %s flow to its private actual challenge", async roleContext => {
    const f = fakeRpc(() => ({ data: [{ outcome: "found", verification_challenge_id: CHALLENGE_ID }], error: null }));
    const resolver = createLoginFlowChallengeResolver({ rpcClient: f.client, rpcTimeoutMilliseconds: TIMEOUT });
    const result = await resolver.resolve({ ...request, roleContext });
    expect(result).toEqual({ outcome: "found", challengeId: CHALLENGE_ID }); expect(Object.isFrozen(result)).toBe(true);
    expect(Object.keys(resolver)).toEqual(["resolve"]); expect(f.calls).toHaveLength(1);
    expect(f.calls[0].functionName).toBe(LOGIN_FLOW_CHALLENGE_RESOLUTION_FUNCTION);
    expect(LOGIN_FLOW_CHALLENGE_RESOLUTION_FUNCTION).toBe("solmind_resolve_login_flow_challenge");
    expect(f.calls[0].args).toEqual({ p_login_flow_id: flowId, p_user_account_id: ACCOUNT_ID,
      p_user_contact_method_id: CONTACT_ID, p_role_context: roleContext });
    expect(f.calls[0].signal.aborted).toBe(false);
  });
  it("accepts only coherent exact found/not_found rows and never leaks malformed answers", async () => {
    const cases: Array<{ data: unknown; outcome: string; error?: unknown }> = [
      { data: [{ outcome: "not_found", verification_challenge_id: null }], outcome: "not_found" },
      { data: [{ outcome: "found", verification_challenge_id: null }], outcome: "failed" },
      { data: [{ outcome: "not_found", verification_challenge_id: CHALLENGE_ID }], outcome: "failed" },
      { data: [{ outcome: "found", verification_challenge_id: CHALLENGE_ID + "\n" }], outcome: "failed" },
      { data: [{ outcome: "found", verification_challenge_id: CHALLENGE_ID.toUpperCase() }], outcome: "failed" },
      { data: [{ outcome: "found", verification_challenge_id: CHALLENGE_ID, extra: SENTINEL }], outcome: "failed" },
      { data: [{ outcome: "unknown", verification_challenge_id: null }], outcome: "failed" },
      { data: [], outcome: "failed" }, { data: null, outcome: "failed" },
      { data: [{ outcome: "found", verification_challenge_id: CHALLENGE_ID }], error: { message: SENTINEL }, outcome: "failed" },
    ];
    for (const { data, outcome, error } of cases) {
      const f = fakeRpc(() => ({ data, error: error ?? null }));
      const result = await createLoginFlowChallengeResolver({ rpcClient: f.client, rpcTimeoutMilliseconds: TIMEOUT }).resolve(request);
      expect(result).toEqual({ outcome }); expect(Object.isFrozen(result)).toBe(true); expect(f.calls).toHaveLength(1);
      for (const value of [flowId, ACCOUNT_ID, CONTACT_ID, CHALLENGE_ID, SENTINEL]) expect(textOf(result)).not.toContain(value);
    }
  });
  it("refuses request accessors, credential fields, malformed IDs/roles and nil flow before RPC", async () => {
    const f = fakeRpc(() => ({ data: [{ outcome: "found", verification_challenge_id: CHALLENGE_ID }], error: null }));
    const resolver = createLoginFlowChallengeResolver({ rpcClient: f.client, rpcTimeoutMilliseconds: TIMEOUT }); let reads = 0;
    for (const input of [null, { ...request, password: SENTINEL }, { ...request, code: "123456" },
      { ...request, flowId: "00000000-0000-0000-0000-000000000000" }, { ...request, flowId: flowId + "\n" },
      { ...request, userAccountId: ACCOUNT_ID + "\n" }, { ...request, userContactMethodId: CONTACT_ID + "\n" },
      { ...request, roleContext: "Guide" }, { ...request, roleContext: "explorer\n" },
      Object.defineProperty({ ...request }, "flowId", { enumerable: true, get() { reads++; return flowId; } })]) {
      expect(await resolver.resolve(input as never)).toEqual({ outcome: "failed" });
    }
    expect(f.calls).toHaveLength(0); expect(reads).toBe(0);
  });
  it("does not invoke row or array-slot accessors and refuses expanded/sparse row arrays", async () => {
    let reads = 0;
    const row = Object.defineProperty({ outcome: "found" }, "verification_challenge_id", { enumerable: true, get() { reads++; return CHALLENGE_ID; } });
    const accessor: unknown[] = [];
    Object.defineProperty(accessor, "0", { enumerable: true, get() { reads++; return row; } });
    const expanded = Object.assign([{ outcome: "found", verification_challenge_id: CHALLENGE_ID }], { extra: SENTINEL });
    for (const data of [[row], accessor, Array(1), expanded]) {
      const f = fakeRpc(() => ({ data, error: null }));
      expect(await createLoginFlowChallengeResolver({ rpcClient: f.client, rpcTimeoutMilliseconds: TIMEOUT }).resolve(request)).toEqual({ outcome: "failed" });
      expect(f.calls).toHaveLength(1);
    }
    expect(reads).toBe(0);
  });
  it("bounds one hanging attempt at the inclusive deadline without retry and consumes its late rejection", async () => {
    vi.useFakeTimers();
    try {
      let reject!: (value: unknown) => void; let signal: AbortSignal | undefined; let calls = 0;
      const rpcClient = { rpc() { calls++; return { abortSignal(s: AbortSignal) { signal = s; return new Promise((_, no) => { reject = no; }); } }; } };
      const pending = createLoginFlowChallengeResolver({ rpcClient, rpcTimeoutMilliseconds: 10 }).resolve(request);
      await vi.advanceTimersByTimeAsync(9); expect(signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1); expect(await pending).toEqual({ outcome: "failed" });
      expect(signal?.aborted === true && calls === 1).toBe(true);
      reject(new Error(SENTINEL)); await vi.advanceTimersByTimeAsync(1); expect(calls).toBe(1);
    } finally { vi.useRealTimers(); }
  });
  it("rechecks the clock after parsing a positive result", async () => {
    vi.useFakeTimers();
    try {
      const clock = vi.spyOn(performance, "now").mockReturnValue(100);
      const row = new Proxy({ outcome: "found", verification_challenge_id: CHALLENGE_ID }, {
        ownKeys(target) { clock.mockReturnValue(110); return Reflect.ownKeys(target); },
      });
      const f = fakeRpc(() => ({ data: [row], error: null }));
      expect(await createLoginFlowChallengeResolver({ rpcClient: f.client, rpcTimeoutMilliseconds: 10 }).resolve(request)).toEqual({ outcome: "failed" });
      expect(f.calls).toHaveLength(1);
    } finally { vi.useRealTimers(); }
  });
});
