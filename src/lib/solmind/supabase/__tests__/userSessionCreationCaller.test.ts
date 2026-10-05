// Login step 6, sub-slice S6-6: the server caller of the banked session
// function `public.solmind_create_user_session` (AUTH-RLS-DEC-039; contract 25
// Sections 6 and 7 and Section 15 item 6; contract 21 Section 7.3), and the
// module boundary of the caller and the duration rule. A fake RPC seam stands
// in for the service-role client, except in USC-013, which drives the real
// postgrest-js client through a fake `fetch`. Nothing here touches a
// database, the local Supabase stack, or the network.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";

import { createClient } from "@supabase/supabase-js";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as authBarrel from "../../auth/index";
import * as durationModule from "../../auth/loginSessionDuration";
import * as contextBarrel from "../../context/index";
import * as supabaseBarrel from "../index";
import * as callerModule from "../userSessionCreationCaller";
import {
  USER_SESSION_CREATION_FUNCTION,
  USER_SESSION_CREATION_LIMITS,
  USER_SESSION_CREATION_OUTCOMES,
  USER_SESSION_CREATION_PURPOSE,
  UserSessionCreationError,
  createUserSessionCreator,
  type UserSessionCreationRequest,
  type UserSessionCreationRpcClient,
  type UserSessionCreatorDependencies,
} from "../userSessionCreationCaller";

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

// Synthetic identifiers, in PostgreSQL's lowercase canonical form.
const ACCOUNT_ID = "3d0f6a1e-2b4c-4d5e-8f60-718293a4b5c6";
const CHALLENGE_ID = "6f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const SESSION_ID = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d";

// 2026-10-05 17:00:00 UTC, a whole second, in epoch milliseconds. Every test
// in the caller's describe blocks reads this time from Date.now().
const NOW = Date.UTC(2026, 9, 5, 17, 0, 0);
const NOW_SECONDS = NOW / 1000;

// A token issued just now with the local `jwt_expiry` of 3600 seconds: the
// requested duration is 3600 - 120 = 3480 seconds.
const TOKEN_EXPIRES_AT = NOW_SECONDS + 3600;
const REQUESTED = 3480;

// The session function's fixed refusals of the evidence, account or role
// (`denied`), and its other fixed errors (`failed`), in the current
// definition. USC-007 checks these two lists against the migration.
const DENIAL_MESSAGES = [
  "solmind_session_ineligible_account",
  "solmind_session_ineligible_role",
  "solmind_session_ineligible_evidence",
  "solmind_session_conflicting_retry",
  "solmind_session_evidence_consumed",
  "solmind_session_stale_evidence",
  "solmind_session_older_evidence",
] as const;
const FAILURE_MESSAGES = [
  "solmind_session_invalid_account",
  "solmind_session_invalid_role",
  "solmind_session_invalid_challenge",
  "solmind_session_invalid_purpose",
  "solmind_session_invalid_duration",
  "solmind_session_consumption_integrity_failure",
  "solmind_session_policy_unavailable",
  "solmind_session_active_cardinality_violation",
  "solmind_session_lock_unavailable",
  "solmind_session_integrity_failure",
] as const;

const CURRENT_DEFINITION_MIGRATION = "20260718000000_authorizing_evidence_consumption.sql";

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
  args: Readonly<Record<string, string | number>>;
  signal: AbortSignal | null;
}>;

// `expires_at` as PostgreSQL prints a timestamptz in JSON, at the given
// instant plus a microsecond part.
function pgTimestamp(milliseconds: number, microseconds = "123456"): string {
  return `${new Date(milliseconds).toISOString().slice(0, 19)}.${microseconds}+00:00`;
}

function sessionRow(
  overrides: Record<string, unknown> = {},
  expiresAtMilliseconds: number = NOW + REQUESTED * 1000,
): Record<string, unknown> {
  return {
    outcome: "created",
    user_session_id: SESSION_ID,
    // The microseconds are below a millisecond, so the Max-Age is unchanged.
    expires_at: pgTimestamp(expiresAtMilliseconds, "000999"),
    ...overrides,
  };
}

function rpcResponse(data: unknown, error: unknown = null) {
  return Promise.resolve({ data, error, count: null, status: 200, statusText: "OK" });
}

function raised(message: string, code = "P0001") {
  return { code, message, details: null, hint: null };
}

// A fake of the seam: rpc() returns a request whose abortSignal() records the
// signal and returns the awaitable answer, as postgrest-js's builder does.
function fakeRpc(respond: (call: RpcCall) => unknown = () => rpcResponse([sessionRow()])) {
  const calls: RpcCall[] = [];
  const rpc = vi.fn((functionName: string, args: Readonly<Record<string, string | number>>) => ({
    abortSignal: (signal: AbortSignal) => {
      const call = Object.freeze({ functionName, args: Object.freeze({ ...args }), signal });
      calls.push(call);
      return respond(call) as PromiseLike<unknown>;
    },
  }));
  const client: UserSessionCreationRpcClient = { rpc };
  return { client, rpc, calls };
}

function dependencies(
  overrides: Partial<Record<keyof UserSessionCreatorDependencies, unknown>> = {},
): UserSessionCreatorDependencies {
  return {
    rpcClient: fakeRpc().client,
    rpcTimeoutMilliseconds: 1_000,
    ...overrides,
  } as UserSessionCreatorDependencies;
}

function buildCreator(overrides: Partial<Record<keyof UserSessionCreatorDependencies, unknown>> = {}) {
  return createUserSessionCreator(dependencies(overrides));
}

function request(overrides: Record<string, unknown> = {}): UserSessionCreationRequest {
  return {
    userAccountId: ACCOUNT_ID,
    activeRoleContext: "explorer",
    challengeId: CHALLENGE_ID,
    providerAccessTokenExpiresAt: TOKEN_EXPIRES_AT,
    ...overrides,
  } as UserSessionCreationRequest;
}

// Contract 25 Section 14 keeps session UUIDs out of test output, so no
// assertion here is handed a result, a row, an error or a sensitive string:
// a failing assertion prints only what it was handed, and its label. Results
// are compared through this value-free view: the outcome when it is one of
// the closed set, the key names when they are the result type's, whether the
// session id is the synthetic one (a boolean), and the Max-Age when it is a
// number.
type ResultView = Readonly<{
  outcome: string;
  keys: ReadonlyArray<string>;
  sessionIdIsSynthetic: boolean;
  maxAgeSeconds: number | null;
}>;

const RESULT_KEYS: ReadonlyArray<string> = ["outcome", "sessionId", "maxAgeSeconds"];

function view(result: unknown): ResultView {
  if (typeof result !== "object" || result === null) {
    return { outcome: "not an object", keys: [], sessionIdIsSynthetic: false, maxAgeSeconds: null };
  }
  const record = result as Record<string, unknown>;
  const outcomes: ReadonlyArray<unknown> = USER_SESSION_CREATION_OUTCOMES;
  return {
    outcome: outcomes.includes(record.outcome) ? String(record.outcome) : "other",
    keys: Reflect.ownKeys(record)
      .filter((key) => Object.prototype.propertyIsEnumerable.call(record, key))
      .map((key) => (typeof key === "string" && RESULT_KEYS.includes(key) ? key : "other")),
    sessionIdIsSynthetic: record.sessionId === SESSION_ID,
    maxAgeSeconds: typeof record.maxAgeSeconds === "number" ? record.maxAgeSeconds : null,
  };
}

// The view of a refusal: only `outcome`.
function refused(outcome: "denied" | "invalid_request" | "failed"): ResultView {
  return { outcome, keys: ["outcome"], sessionIdIsSynthetic: false, maxAgeSeconds: null };
}

// The view of an accepted result carrying the synthetic session UUID.
function accepted(outcome: "created" | "existing", maxAgeSeconds: number): ResultView {
  return { outcome, keys: ["outcome", "sessionId", "maxAgeSeconds"], sessionIdIsSynthetic: true, maxAgeSeconds };
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

// Redaction checks as booleans with fixed labels: a failing check prints
// neither the value nor the string it looked for.
function expectValueFree(value: unknown, secrets: Readonly<Record<string, string>>, caseLabel: string): void {
  const text = textOf(value);
  for (const [secretLabel, secret] of Object.entries(secrets)) {
    expect(text.includes(secret), `${caseLabel}: contains the ${secretLabel}`).toBe(false);
  }
}

function hostileError(): Error {
  return new Error(`hostile ${ACCOUNT_ID} ${CHALLENGE_ID} ${SESSION_ID}`);
}

function expectWiringError(action: () => unknown, caseLabel: string): void {
  let error: unknown = null;
  try {
    action();
  } catch (caught) {
    error = caught;
  }
  expect(error instanceof UserSessionCreationError, `${caseLabel}: the fixed construction error`).toBe(true);
  expect(
    (error as { code?: unknown } | null)?.code === "user_session_creation_invalid_configuration",
    `${caseLabel}: its code`,
  ).toBe(true);
  expect(
    error instanceof Error && error.message === "user_session_creation_invalid_configuration",
    `${caseLabel}: its message`,
  ).toBe(true);
  expectValueFree(error, { "hostile marker": "hostile" }, caseLabel);
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

// The console spies print nothing, and the check is a count with a fixed
// label: a logged value never reaches test output, even when the check fails.
beforeEach(() => {
  for (const method of CONSOLE_METHODS) {
    vi.spyOn(console, method).mockImplementation(() => undefined);
  }
});

afterEach(() => {
  for (const method of CONSOLE_METHODS) {
    expect(vi.mocked(console[method]).mock.calls.length, `console.${method} calls`).toBe(0);
  }
  vi.restoreAllMocks();
});

describe("userSessionCreationCaller - creating a session (contract 25 Sections 6 and 7; AUTH-RLS-DEC-039)", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
  });

  it("USC-001 calls the one fixed function once, with the server-derived values, the purpose `login` and the computed duration, and returns the session UUID and its Max-Age", async () => {
    for (const role of ["explorer", "guide", "admin"] as const) {
      const rpc = fakeRpc();
      const result = await buildCreator({ rpcClient: rpc.client }).create(request({ activeRoleContext: role }));
      // The view compares the key names in order, as well as the values.
      expect(view(result), role).toEqual(accepted("created", REQUESTED));
      expect(Object.isFrozen(result), role).toBe(true);
      expect(rpc.calls.map(({ functionName, args }) => ({ functionName, args }))).toEqual([
        {
          functionName: USER_SESSION_CREATION_FUNCTION,
          args: {
            p_user_account_id: ACCOUNT_ID,
            p_active_role_context: role,
            p_verification_challenge_id: CHALLENGE_ID,
            p_expected_purpose: "login",
            p_requested_duration_seconds: REQUESTED,
          },
        },
      ]);
      expect(rpc.calls[0].signal).toBeInstanceOf(AbortSignal);
      expect(rpc.calls[0].signal?.aborted).toBe(false);
    }
    expect(USER_SESSION_CREATION_FUNCTION).toBe("solmind_create_user_session");
    expect(USER_SESSION_CREATION_PURPOSE).toBe("login");
  });

  it("USC-002 item 6's boundaries through the caller: a token with 120 seconds left is denied without a call, and 121, 3720 and 3721 request 1, 3600 and 3600 as JSON integers", async () => {
    const cases: ReadonlyArray<readonly [number, number | null]> = [
      [120, null],
      [121, 1],
      [3720, 3600],
      [3721, 3600],
      [0, null],
      [-5, null],
      [119, null],
    ];
    for (const [remainingLife, expected] of cases) {
      const rpc = fakeRpc((call) =>
        rpcResponse([sessionRow({}, NOW + Number(call.args.p_requested_duration_seconds) * 1000)]),
      );
      const result = await buildCreator({ rpcClient: rpc.client }).create(
        request({ providerAccessTokenExpiresAt: NOW_SECONDS + remainingLife }),
      );
      const label = `remaining life ${remainingLife}`;
      if (expected === null) {
        expect(view(result), label).toEqual(refused("denied"));
        expect(rpc.rpc, label).not.toHaveBeenCalled();
        continue;
      }
      expect(view(result), label).toEqual(accepted("created", expected));
      expect(rpc.calls, label).toHaveLength(1);
      const duration = rpc.calls[0].args.p_requested_duration_seconds;
      expect(duration, label).toBe(expected);
      expect(typeof duration, label).toBe("number");
      expect(Number.isInteger(duration), label).toBe(true);
      expect(
        JSON.stringify(rpc.calls[0].args).includes(`"p_requested_duration_seconds":${expected}`),
        `${label}: a JSON integer`,
      ).toBe(true);
    }

    // Rounding down never overstates: one millisecond later, 121 seconds
    // left is 120.999, which is denied.
    vi.mocked(Date.now).mockReturnValue(NOW + 1);
    const late = fakeRpc();
    const lateResult = await buildCreator({ rpcClient: late.client }).create(
      request({ providerAccessTokenExpiresAt: NOW_SECONDS + 121 }),
    );
    expect(view(lateResult), "120.999 seconds left").toEqual(refused("denied"));
    expect(late.rpc).not.toHaveBeenCalled();
  });

  it("USC-003 the Max-Age is the session's remaining life from the returned expiry, with no cap, and an answer under 1 second or over 3600 seconds from its end is failed", async () => {
    const cases: ReadonlyArray<readonly [string, number, ResultView]> = [
      ["clocks in step", NOW + REQUESTED * 1000, accepted("created", REQUESTED)],
      ["3000.999 seconds left", NOW + 3_000_999, accepted("created", 3000)],
      ["1 second left", NOW + 1_000, accepted("created", 1)],
      // The database's clock 5 seconds ahead of this server's: the remaining
      // life the expiry shows, not capped at the requested duration.
      ["database 5 seconds ahead", NOW + (REQUESTED + 5) * 1000, accepted("created", REQUESTED + 5)],
      // Exactly 3600 seconds left, and one more (the database's clock 120
      // and 121 seconds ahead): the second is an abnormal state.
      ["3600 seconds left", NOW + 3_600_000, accepted("created", 3600)],
      ["3601 seconds left", NOW + 3_601_000, refused("failed")],
      ["0.999 seconds left", NOW + 999, refused("failed")],
      ["0 seconds left", NOW, refused("failed")],
      ["expired a minute ago", NOW - 60_000, refused("failed")],
    ];
    for (const [label, expiresAt, expected] of cases) {
      const rpc = fakeRpc(() =>
        rpcResponse([{ outcome: "created", user_session_id: SESSION_ID, expires_at: pgTimestamp(expiresAt, "000") }]),
      );
      expect(view(await buildCreator({ rpcClient: rpc.client }).create(request())), label).toEqual(expected);
    }

    // The Max-Age is worked out when the answer is accepted, from the
    // returned expiry: 2.5 seconds after the duration was computed, 3477.
    vi.mocked(Date.now).mockReturnValueOnce(NOW).mockReturnValueOnce(NOW + 2_500);
    expect(view(await buildCreator().create(request())), "2.5 seconds later").toEqual(
      accepted("created", REQUESTED - 3),
    );
  });

  it("USC-004 accepts `existing` only as the answer to this one call: checked exactly like `created`, one call per create, no retry, and no other entry point", async () => {
    const existing = fakeRpc(() => rpcResponse([sessionRow({ outcome: "existing" })]));
    const creator = buildCreator({ rpcClient: existing.client });
    expect(view(await creator.create(request())), "existing").toEqual(accepted("existing", REQUESTED));
    expect(existing.rpc).toHaveBeenCalledTimes(1);

    // An `existing` answer gets every check a `created` one does.
    const rows: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
      ["uppercase session id", sessionRow({ outcome: "existing", user_session_id: SESSION_ID.toUpperCase() })],
      ["expiry not in the printed form", sessionRow({ outcome: "existing", expires_at: "2026-10-05 17:58:00+00:00" })],
      ["extra key", sessionRow({ outcome: "existing", extra: true })],
      ["0.5 seconds left", sessionRow({ outcome: "existing" }, NOW + 500)],
      ["expired", sessionRow({ outcome: "existing" }, NOW - 1_000)],
    ];
    for (const [label, row] of rows) {
      const rpc = fakeRpc(() => rpcResponse([row]));
      expect(view(await buildCreator({ rpcClient: rpc.client }).create(request())), label).toEqual(refused("failed"));
    }

    // Each create is its own single call: two creates are two calls with the
    // same arguments, and nothing is cached or looked up between them.
    await creator.create(request());
    expect(existing.calls).toHaveLength(2);
    expect(existing.calls[1].args).toEqual(existing.calls[0].args);

    // No retry: a failed or denied answer is one call.
    for (const respond of [
      () => Promise.reject(hostileError()),
      () => rpcResponse(null, raised("solmind_session_lock_unavailable")),
      () => rpcResponse(null, raised("solmind_session_conflicting_retry")),
    ]) {
      const rpc = fakeRpc(respond);
      await buildCreator({ rpcClient: rpc.client }).create(request());
      expect(rpc.rpc).toHaveBeenCalledTimes(1);
    }

    // The module offers no lookup, list or recovery of a session: only the
    // one factory and its constants.
    expect(Object.keys(callerModule).sort()).toEqual(
      [
        "USER_SESSION_CREATION_ERROR_CODES",
        "USER_SESSION_CREATION_FUNCTION",
        "USER_SESSION_CREATION_LIMITS",
        "USER_SESSION_CREATION_OUTCOMES",
        "USER_SESSION_CREATION_PURPOSE",
        "UserSessionCreationError",
        "createUserSessionCreator",
      ].sort(),
    );
    expect(Object.keys(creator)).toEqual(["create"]);
  });

  it("USC-005 maps each of the function's fixed refusals of the evidence, account or role to `denied`, matched exactly", async () => {
    for (const message of DENIAL_MESSAGES) {
      const rpc = fakeRpc(() => rpcResponse(null, raised(message)));
      const result = await buildCreator({ rpcClient: rpc.client }).create(request());
      expect(view(result), message).toEqual(refused("denied"));
      expect(rpc.rpc, message).toHaveBeenCalledTimes(1);
    }
    // Near misses are failures.
    const nearMisses: ReadonlyArray<readonly [string, unknown]> = [
      ["code P0002", raised("solmind_session_stale_evidence", "P0002")],
      ["lowercase code", raised("solmind_session_stale_evidence", "p0001")],
      ["no code", { message: "solmind_session_stale_evidence" }],
      ["no message", { code: "P0001" }],
      ["uppercase message", raised("SOLMIND_SESSION_STALE_EVIDENCE")],
      ["trailing space", raised("solmind_session_stale_evidence ")],
      ["leading space", raised(" solmind_session_stale_evidence")],
      ["a value appended", raised(`solmind_session_stale_evidence: ${ACCOUNT_ID}`)],
      ["a shortened message", raised("solmind_session_stale")],
      ["a bare string", "solmind_session_stale_evidence"],
      ["an array", [raised("solmind_session_stale_evidence")]],
    ];
    for (const [label, error] of nearMisses) {
      const rpc = fakeRpc(() => rpcResponse(null, error));
      expect(view(await buildCreator({ rpcClient: rpc.client }).create(request())), label).toEqual(refused("failed"));
    }
  });

  it("USC-006 maps every other database error, the function's own fixed failures included, to `failed`", async () => {
    const errors: ReadonlyArray<readonly [string, unknown]> = [
      ...FAILURE_MESSAGES.map((message) => [message, raised(message)] as const),
      ["unique violation", raised("duplicate key value violates unique constraint", "23505")],
      ["lock timeout", raised("canceling statement due to lock timeout", "55P03")],
      ["statement timeout", raised("canceling statement due to statement timeout", "57014")],
      ["permission denied", raised("permission denied for function solmind_create_user_session", "42501")],
      ["function not found", raised("Could not find the function", "PGRST202")],
      ["fetch failed", { message: "TypeError: fetch failed", details: "", hint: "", code: "" }],
    ];
    for (const [label, error] of errors) {
      const rpc = fakeRpc(() => rpcResponse(null, error));
      const result = await buildCreator({ rpcClient: rpc.client }).create(request());
      expect(view(result), label).toEqual(refused("failed"));
      expect(rpc.rpc, label).toHaveBeenCalledTimes(1);
    }
    // A row beside an error is still the error's outcome.
    const both = fakeRpc(() => rpcResponse([sessionRow()], raised("solmind_session_integrity_failure")));
    expect(view(await buildCreator({ rpcClient: both.client }).create(request())), "a row beside an error").toEqual(
      refused("failed"),
    );
  });

  it("USC-007 the two lists are exactly the current definition's fixed errors, and the call matches its signature, duration bounds, outputs and grants", () => {
    const migrations = path.join(appRoot(), "supabase", "migrations");
    const definitions = fs
      .readdirSync(migrations)
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .filter((name) =>
        /create\s+(?:or\s+replace\s+)?function\s+public\.solmind_create_user_session\s*\(/i.test(
          fs.readFileSync(path.join(migrations, name), "utf8"),
        ),
      );
    // The latest definition, which the database runs, is P27-A's.
    expect(definitions[definitions.length - 1]).toBe(CURRENT_DEFINITION_MIGRATION);

    const text = fs.readFileSync(path.join(migrations, CURRENT_DEFINITION_MIGRATION), "utf8").replace(/\r\n/g, "\n");
    const start = text.search(/create\s+or\s+replace\s+function\s+public\.solmind_create_user_session\s*\(/i);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = text.indexOf("$$;", start);
    expect(end).toBeGreaterThan(start);
    const definition = text.slice(start, end);

    const raisedMessages = new Set(
      [...definition.matchAll(/raise\s+exception\s+'(solmind_session_[a-z_]+)'/g)].map((match) => match[1]),
    );
    expect([...raisedMessages].sort()).toEqual([...DENIAL_MESSAGES, ...FAILURE_MESSAGES].sort());
    // No other raise of any kind.
    expect([...definition.matchAll(/\braise\b/gi)]).toHaveLength(
      [...definition.matchAll(/raise\s+exception\s+'solmind_session_[a-z_]+'/g)].length,
    );

    // The signature, in order, and the three outputs the caller reads.
    const parameters = [...definition.slice(0, definition.indexOf(")")).matchAll(/\b(p_[a-z_]+)\s+(uuid|text|integer)\b/g)].map(
      (match) => `${match[1]} ${match[2]}`,
    );
    expect(parameters).toEqual([
      "p_user_account_id uuid",
      "p_active_role_context text",
      "p_verification_challenge_id uuid",
      "p_expected_purpose text",
      "p_requested_duration_seconds integer",
    ]);
    expect(definition).toMatch(/returns table \(outcome text, user_session_id uuid, expires_at timestamptz\)/);
    expect(definition).toContain("select 'existing'::text,");
    expect(definition).toContain("return query select 'created'::text, v_new_session_id, v_new_expires_at;");
    // The duration bounds the caller's rule keeps to.
    expect(definition).toContain("p_requested_duration_seconds < 1");
    expect(definition).toContain("p_requested_duration_seconds > 3600");
    expect(durationModule.LOGIN_SESSION_DURATION_LIMITS.minimumSeconds).toBe(1);
    expect(durationModule.LOGIN_SESSION_DURATION_LIMITS.maximumSeconds).toBe(3600);
    // The purpose the caller fixes is one the function accepts.
    expect(definition).toContain("p_expected_purpose not in ('login', 'role_reentry')");
    // Service-role only: every privilege revoked from PUBLIC, execute revoked
    // from `anon` and `authenticated`, and execute granted to `service_role`.
    const signature = "public.solmind_create_user_session(uuid, text, uuid, text, integer)";
    const tail = text.slice(end);
    expect(tail).toContain(`revoke all on function ${signature}\n  from public;`);
    expect(tail).toContain(`revoke execute on function ${signature}\n  from anon, authenticated;`);
    expect(tail).toContain(`grant execute on function ${signature}\n  to service_role;`);
  });

  it("USC-008 treats every malformed, missing or rejected answer as `failed`", async () => {
    const responders: ReadonlyArray<readonly [string, () => unknown]> = [
      ["no row", () => rpcResponse([])],
      ["two rows", () => rpcResponse([sessionRow(), sessionRow()])],
      ["an extra key", () => rpcResponse([sessionRow({ extra: 1 })])],
      ["no expires_at", () => rpcResponse([{ outcome: "created", user_session_id: SESSION_ID }])],
      ["outcome Created", () => rpcResponse([sessionRow({ outcome: "Created" })])],
      ["outcome issued", () => rpcResponse([sessionRow({ outcome: "issued" })])],
      ["outcome denied", () => rpcResponse([sessionRow({ outcome: "denied" })])],
      ["outcome null", () => rpcResponse([sessionRow({ outcome: null })])],
      ["uppercase session id", () => rpcResponse([sessionRow({ user_session_id: SESSION_ID.toUpperCase() })])],
      ["session id without hyphens", () => rpcResponse([sessionRow({ user_session_id: SESSION_ID.replace(/-/g, "") })])],
      ["session id in braces", () => rpcResponse([sessionRow({ user_session_id: `{${SESSION_ID}}` })])],
      ["session id with a final line feed", () => rpcResponse([sessionRow({ user_session_id: `${SESSION_ID}\n` })])],
      ["session id null", () => rpcResponse([sessionRow({ user_session_id: null })])],
      ["expires_at without an offset", () => rpcResponse([sessionRow({ expires_at: "2026-10-05T17:58:00" })])],
      ["expires_at on 30 February", () => rpcResponse([sessionRow({ expires_at: "2026-02-30T17:58:00+00:00" })])],
      ["expires_at as a number", () => rpcResponse([sessionRow({ expires_at: NOW + REQUESTED * 1000 })])],
      ["expires_at null", () => rpcResponse([sessionRow({ expires_at: null })])],
      ["a row instead of an array", () => rpcResponse(sessionRow())],
      ["an array row", () => rpcResponse([[SESSION_ID]])],
      ["data null", () => rpcResponse(null)],
      ["data undefined", () => rpcResponse(undefined)],
      ["no answer", () => Promise.resolve(undefined)],
      ["a string answer", () => Promise.resolve("created")],
      ["a rejection", () => Promise.reject(hostileError())],
      [
        "a synchronous throw",
        () => {
          throw hostileError();
        },
      ],
    ];
    for (const [label, respond] of responders) {
      const rpc = fakeRpc(respond);
      const result = await buildCreator({ rpcClient: rpc.client }).create(request());
      expect(view(result), label).toEqual(refused("failed"));
      expect(rpc.rpc, label).toHaveBeenCalledTimes(1);
      expectValueFree(result, { "session id": SESSION_ID, "hostile marker": "hostile" }, label);
    }

    // The row's fields are read through own-property descriptors, so no
    // field getter or Proxy `get` trap runs: a getter row and a row with an
    // inherited prototype are failed, and a Proxy row is read from its
    // target's data, not from its `get` trap.
    let trapRan = false;
    const getterRow = sessionRow();
    Object.defineProperty(getterRow, "user_session_id", {
      enumerable: true,
      get: () => {
        trapRan = true;
        return SESSION_ID;
      },
    });
    const unreadRows: ReadonlyArray<readonly [string, unknown]> = [
      ["a getter row", getterRow],
      ["an inherited prototype", Object.assign(Object.create({ inherited: true }), sessionRow())],
    ];
    for (const [label, row] of unreadRows) {
      const rpc = fakeRpc(() => rpcResponse([row]));
      expect(view(await buildCreator({ rpcClient: rpc.client }).create(request())), label).toEqual(refused("failed"));
    }
    const proxyRow = new Proxy(sessionRow(), {
      get: () => {
        trapRan = true;
        return "not-a-session-id";
      },
    });
    const proxied = fakeRpc(() => rpcResponse([proxyRow]));
    expect(view(await buildCreator({ rpcClient: proxied.client }).create(request())), "a Proxy row").toEqual(
      accepted("created", REQUESTED),
    );
    expect(trapRan).toBe(false);
  });

  it("USC-009 refuses a malformed request before any database call: wrong or extra fields, client-supplied values, and a final line terminator", async () => {
    const getter = request();
    Object.defineProperty(getter, "challengeId", {
      enumerable: true,
      get: () => {
        throw hostileError();
      },
    });
    const malformed: ReadonlyArray<unknown> = [
      request({ userAccountId: ACCOUNT_ID.toUpperCase() }),
      request({ userAccountId: ACCOUNT_ID.replace(/-/g, "") }),
      request({ userAccountId: `{${ACCOUNT_ID}}` }),
      request({ userAccountId: ` ${ACCOUNT_ID}` }),
      request({ userAccountId: "" }),
      request({ userAccountId: null }),
      request({ challengeId: CHALLENGE_ID.toUpperCase() }),
      request({ challengeId: `${CHALLENGE_ID} ` }),
      request({ challengeId: 42 }),
      request({ activeRoleContext: "Explorer" }),
      request({ activeRoleContext: "client" }),
      request({ activeRoleContext: "role_reentry" }),
      request({ activeRoleContext: "" }),
      request({ activeRoleContext: null }),
      request({ providerAccessTokenExpiresAt: 0 }),
      request({ providerAccessTokenExpiresAt: -1 }),
      request({ providerAccessTokenExpiresAt: TOKEN_EXPIRES_AT + 0.5 }),
      request({ providerAccessTokenExpiresAt: `${TOKEN_EXPIRES_AT}` }),
      request({ providerAccessTokenExpiresAt: Number.NaN }),
      request({ providerAccessTokenExpiresAt: Infinity }),
      request({ providerAccessTokenExpiresAt: 8_640_000_000_001 }),
      request({ providerAccessTokenExpiresAt: null }),
      // Values only the server may choose are never accepted from a caller.
      { ...request(), purpose: "role_reentry" },
      { ...request(), expectedPurpose: "login" },
      { ...request(), requestedDurationSeconds: 3600 },
      { ...request(), sessionId: SESSION_ID },
      { ...request(), maxAgeSeconds: 3600 },
      { userAccountId: ACCOUNT_ID, activeRoleContext: "explorer", challengeId: CHALLENGE_ID },
      getter,
      new Proxy(request(), {
        getPrototypeOf: () => {
          throw hostileError();
        },
      }),
      Object.assign(Object.create({ inherited: true }), request()),
      [request()],
      null,
      CHALLENGE_ID,
    ];
    for (const [index, input] of malformed.entries()) {
      const label = `malformed request ${index}`;
      const rpc = fakeRpc();
      const result = await buildCreator({ rpcClient: rpc.client }).create(input as UserSessionCreationRequest);
      expect(view(result), label).toEqual(refused("invalid_request"));
      expect(rpc.rpc, label).not.toHaveBeenCalled();
      expectValueFree(
        result,
        { "account id": ACCOUNT_ID, "challenge id": CHALLENGE_ID, "hostile marker": "hostile" },
        label,
      );
    }

    // Each case pairs a valid request with the same request whose one field
    // gains the terminator, so the refusal is the terminator's.
    for (const [name, terminator] of LINE_TERMINATORS) {
      for (const field of ["userAccountId", "activeRoleContext", "challengeId"] as const) {
        const valid = request();
        const changed = request({ [field]: `${valid[field]}${terminator}` });
        const label = `${field} + ${name}`;
        const refusing = fakeRpc();
        expect(view(await buildCreator({ rpcClient: refusing.client }).create(changed)), label).toEqual(
          refused("invalid_request"),
        );
        expect(refusing.rpc, label).not.toHaveBeenCalled();
        const accepting = fakeRpc();
        expect(view(await buildCreator({ rpcClient: accepting.client }).create(valid)), label).toMatchObject({
          outcome: "created",
        });
        expect(accepting.rpc, label).toHaveBeenCalledTimes(1);
      }
    }
  });

  it("USC-010 acts on no late answer: at the deadline the call is aborted, a blocked event loop makes a timely-looking answer late, and the deadline is checked again just before acceptance", async () => {
    // Never answered in time: aborted at the deadline.
    let resolveLate: (value: unknown) => void = () => undefined;
    const late = fakeRpc(
      () =>
        new Promise((resolve) => {
          resolveLate = resolve;
        }),
    );
    expect(
      view(await buildCreator({ rpcClient: late.client, rpcTimeoutMilliseconds: 20 }).create(request())),
      "never answered",
    ).toEqual(refused("failed"));
    expect(late.calls[0].signal?.aborted).toBe(true);
    resolveLate({ data: [sessionRow()], error: null });
    await settle(20);

    // Answered, but its callback runs after the deadline because the event
    // loop was blocked, before the timer could run.
    let resolveBlocked: (value: unknown) => void = () => undefined;
    const blocked = fakeRpc(
      () =>
        new Promise((resolve) => {
          resolveBlocked = resolve;
        }),
    );
    const pending = buildCreator({ rpcClient: blocked.client, rpcTimeoutMilliseconds: 20 }).create(request());
    await settle(20);
    expect(blocked.rpc).toHaveBeenCalledTimes(1);
    resolveBlocked({ data: [sessionRow()], error: null });
    blockEventLoop(60);
    expect(view(await pending), "blocked event loop").toEqual(refused("failed"));

    // The deadline passes while the answer is read: the check just before
    // acceptance catches it.
    let clock = 1_000;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    const answer = {
      get data() {
        clock = 5_000;
        return [sessionRow()];
      },
      error: null,
    };
    const slow = fakeRpc(() => Promise.resolve(answer));
    expect(view(await buildCreator({ rpcClient: slow.client }).create(request())), "late while read").toEqual(
      refused("failed"),
    );
    expect(clock).toBe(5_000);
  });

  it("USC-011 refuses malformed wiring with one fixed, value-free error", () => {
    const hostileClient = {
      get rpc() {
        throw hostileError();
      },
    };
    const getterDependencies = dependencies();
    Object.defineProperty(getterDependencies, "rpcTimeoutMilliseconds", {
      enumerable: true,
      get: () => 1_000,
    });
    for (const [index, wiring] of [
      dependencies({ rpcClient: {} }),
      dependencies({ rpcClient: { rpc: "rpc" } }),
      dependencies({ rpcClient: null }),
      dependencies({ rpcClient: hostileClient }),
      dependencies({ rpcTimeoutMilliseconds: 9 }),
      dependencies({ rpcTimeoutMilliseconds: 60_001 }),
      dependencies({ rpcTimeoutMilliseconds: 1_000.5 }),
      dependencies({ rpcTimeoutMilliseconds: "1000" }),
      // Only the client and the deadline: nothing else can be configured.
      { ...dependencies(), purpose: "role_reentry" },
      { ...dependencies(), requestedDurationSeconds: 3600 },
      { ...dependencies(), functionName: "solmind_find_active_user_sessions" },
      { rpcClient: fakeRpc().client },
      getterDependencies,
      [dependencies()],
      null,
      undefined,
    ].entries()) {
      expectWiringError(() => createUserSessionCreator(wiring as UserSessionCreatorDependencies), `wiring ${index}`);
    }
    expect(USER_SESSION_CREATION_LIMITS).toEqual({
      minimumRpcTimeoutMilliseconds: 10,
      maximumRpcTimeoutMilliseconds: 60_000,
    });
    expect(() => buildCreator({ rpcTimeoutMilliseconds: 10 })).not.toThrow();
    expect(() => buildCreator({ rpcTimeoutMilliseconds: 60_000 })).not.toThrow();
  });

  it("USC-012 returns frozen results from the closed set, shared for every refusal, carrying no account, challenge or error text, and never throws", async () => {
    expect(USER_SESSION_CREATION_OUTCOMES).toEqual(["created", "existing", "denied", "invalid_request", "failed"]);
    const creator = buildCreator({ rpcClient: fakeRpc(() => Promise.reject(hostileError())).client });
    const first = await creator.create(request());
    const second = await creator.create(request());
    expect(first === second, "one shared refusal").toBe(true);
    expect(view(first).keys, "a refusal's keys").toEqual(["outcome"]);
    expect(Object.isFrozen(first)).toBe(true);
    const invalid = await creator.create(null as unknown as UserSessionCreationRequest);
    const invalidAgain = await creator.create(CHALLENGE_ID as unknown as UserSessionCreationRequest);
    expect(invalid === invalidAgain, "one shared invalid_request").toBe(true);

    // An accepted result carries the session UUID and the Max-Age only.
    const acceptedResult = await buildCreator().create(request());
    expectValueFree(
      acceptedResult,
      {
        "account id": ACCOUNT_ID,
        "challenge id": CHALLENGE_ID,
        "expiry text": "2026-10-05T",
        purpose: "login",
        role: "explorer",
      },
      "an accepted result",
    );

    // A failure anywhere becomes `failed`, never a throw: here the clock
    // throws, or reads NaN, at the one call that works out the duration.
    vi.mocked(Date.now).mockImplementationOnce(() => {
      throw hostileError();
    });
    const throwingClock = await buildCreator().create(request());
    expect(view(throwingClock), "a throwing clock").toEqual(refused("failed"));
    expectValueFree(throwingClock, { "hostile marker": "hostile" }, "a throwing clock");
    vi.mocked(Date.now).mockReturnValueOnce(Number.NaN);
    expect(view(await buildCreator().create(request())), "a NaN clock").toEqual(refused("failed"));
  });

  it("USC-013 drives the real postgrest-js client: one POST with the exact body and an integer duration, the abort signal reaches fetch, a refusal is read, no POST is replayed, and an aborted call settles", async () => {
    type Seen = Readonly<{ url: string; method: string; body: string; signal: AbortSignal | null }>;
    const seen: Seen[] = [];
    let mode: "created" | "existing" | "refused" | "status-503" | "status-520" | "network" | "hang" = "created";
    const fakeFetch = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
      const url = input instanceof Request ? input.url : String(input);
      seen.push(
        Object.freeze({
          url,
          method: init?.method ?? "GET",
          body: typeof init?.body === "string" ? init.body : "",
          signal: init?.signal ?? null,
        }),
      );
      if (mode === "status-503" || mode === "status-520") {
        return new Response("", { status: mode === "status-503" ? 503 : 520 });
      }
      if (mode === "network") {
        throw new TypeError("fetch failed");
      }
      if (mode === "hang") {
        // This fake settles when its signal aborts; whether a real transport
        // does is the transport's own behaviour.
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("This operation was aborted", "AbortError"));
          });
        });
      }
      if (mode === "refused") {
        return new Response(JSON.stringify(raised("solmind_session_older_evidence")), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify([
          { outcome: mode, user_session_id: SESSION_ID, expires_at: pgTimestamp(NOW + REQUESTED * 1000) },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    const client = createClient("http://127.0.0.1:54321", "synthetic-service-role-key", {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: fakeFetch as unknown as typeof fetch },
    });
    const creator = createUserSessionCreator({ rpcClient: client, rpcTimeoutMilliseconds: 5_000 });
    const hangCreator = createUserSessionCreator({ rpcClient: client, rpcTimeoutMilliseconds: 100 });
    const rpcCalls = () => seen.filter((call) => call.url.includes("/rest/v1/rpc/"));
    const RPC_URL = "http://127.0.0.1:54321/rest/v1/rpc/solmind_create_user_session";

    expect(view(await creator.create(request())), "created").toEqual(accepted("created", REQUESTED));
    expect(rpcCalls()).toHaveLength(1);
    const [call] = rpcCalls();
    expect(call.method).toBe("POST");
    expect(call.url).toBe(RPC_URL);
    expect(JSON.parse(call.body)).toEqual({
      p_user_account_id: ACCOUNT_ID,
      p_active_role_context: "explorer",
      p_verification_challenge_id: CHALLENGE_ID,
      p_expected_purpose: "login",
      p_requested_duration_seconds: REQUESTED,
    });
    expect(call.body).toContain(`"p_requested_duration_seconds":${REQUESTED}`);
    expect(call.signal).toBeInstanceOf(AbortSignal);
    expect(call.signal?.aborted).toBe(false);

    mode = "existing";
    expect(view(await creator.create(request())), "existing").toMatchObject({
      outcome: "existing",
      sessionIdIsSynthetic: true,
    });
    expect(rpcCalls()).toHaveLength(2);

    // The function's refusal, as PostgREST sends it, is read as `denied`.
    mode = "refused";
    expect(view(await creator.create(request())), "refused").toEqual(refused("denied"));
    expect(rpcCalls()).toHaveLength(3);

    // No automatic replay of the POST: postgrest-js retries only GET, HEAD
    // and OPTIONS, for network errors and 503/520.
    for (const failing of ["status-503", "status-520", "network"] as const) {
      mode = failing;
      const before = rpcCalls().length;
      expect(view(await creator.create(request())), failing).toEqual(refused("failed"));
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(rpcCalls().length, failing).toBe(before + 1);
      expect(rpcCalls()[before].url).toBe(RPC_URL);
    }

    // A call that never answers is aborted at its deadline; this fake fetch
    // then rejects, and postgrest-js settles the call with an error answer.
    mode = "hang";
    const beforeHang = rpcCalls().length;
    expect(view(await hangCreator.create(request())), "hang").toEqual(refused("failed"));
    expect(rpcCalls()).toHaveLength(beforeHang + 1);
    expect(rpcCalls()[beforeHang].signal?.aborted).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
});

// The app's root, or, when this file runs from a proposal folder that holds
// only new files, the live app's.
function appRoot(): string {
  const testDirectory = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(testDirectory, "..", "..", "..", "..", "..");
  const proposalRoot = path.resolve(root, "..");
  if (
    !fs.existsSync(path.join(root, "supabase", "migrations")) &&
    path.basename(proposalRoot).includes("_proposed_")
  ) {
    return path.resolve(proposalRoot, "..", "solmind-app");
  }
  return root;
}

describe("loginSessionDuration and userSessionCreationCaller - module boundary (dormant, off every barrel)", () => {
  type ModuleReference = Readonly<{ form: string; specifier: string | null }>;

  const DURATION_PATH = "../../auth/loginSessionDuration.ts";
  const CALLER_PATH = "../userSessionCreationCaller.ts";

  function moduleText(relativePath: string): string {
    return fs.readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
  }

  // Every module reference in a file, found with TypeScript's own parser, as
  // the login step 5 boundary test does: static imports, side-effect imports,
  // re-exports, `import x = require()`, dynamic `import()`, `require()` calls,
  // `typeof import()` types, any other value use of `require`, and any use of
  // `import.meta`. A reference whose argument is not one string literal has a
  // null specifier.
  function moduleReferences(fileName: string, text: string): ModuleReference[] {
    const kind = /\.[jt]sx$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
    const references: ModuleReference[] = [];
    const literal = (node: ts.Node | undefined): string | null =>
      node !== undefined && ts.isStringLiteralLike(node) ? node.text : null;
    function visit(node: ts.Node): void {
      if (ts.isImportDeclaration(node)) {
        references.push({ form: "import", specifier: literal(node.moduleSpecifier) });
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
        references.push({ form: "export-from", specifier: literal(node.moduleSpecifier) });
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        references.push({ form: "import-equals", specifier: literal(node.moduleReference.expression) });
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        references.push({
          form: "dynamic-import",
          specifier: node.arguments.length === 1 ? literal(node.arguments[0]) : null,
        });
      } else if (ts.isImportTypeNode(node)) {
        const argument = node.argument;
        references.push({
          form: "import-type",
          specifier:
            ts.isLiteralTypeNode(argument) && ts.isStringLiteralLike(argument.literal)
              ? argument.literal.text
              : null,
        });
      } else if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) {
        references.push({ form: "import-meta", specifier: null });
      } else if (ts.isIdentifier(node) && node.text === "require") {
        const parent = node.parent;
        if (ts.isCallExpression(parent) && parent.expression === node) {
          references.push({
            form: "require",
            specifier: parent.arguments.length === 1 ? literal(parent.arguments[0]) : null,
          });
        } else if (!(ts.isPropertyAccessExpression(parent) && parent.name === node) && !ts.isExternalModuleReference(parent)) {
          references.push({ form: "require-reference", specifier: null });
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    return references;
  }

  // The app's source root, or, when this file runs from a proposal folder
  // that holds only new files, the live app's.
  function sourceRoot(): string {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const root = path.resolve(testDirectory, "..", "..", "..", "..");
    const proposalRoot = path.resolve(root, "..", "..");
    if (
      !fs.existsSync(path.join(root, "lib", "solmind", "auth", "index.ts")) &&
      path.basename(proposalRoot).includes("_proposed_")
    ) {
      return path.resolve(proposalRoot, "..", "solmind-app", "src");
    }
    return root;
  }

  function sourceFiles(directory: string): string[] {
    const found: string[] = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        found.push(...sourceFiles(entryPath));
      } else if (/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) {
        found.push(entryPath);
      }
    }
    return found;
  }

  // A relative or `@/` specifier as a lowercased path without its extension;
  // a package specifier gives null.
  function resolveReference(fromFile: string, specifier: string, root: string): string | null {
    let target: string;
    if (specifier.startsWith("@/")) {
      target = path.join(root, specifier.slice(2));
    } else if (specifier.startsWith(".")) {
      target = path.resolve(path.dirname(fromFile), specifier);
    } else {
      return null;
    }
    return target.replace(/\.(?:[cm]?[jt]sx?)$/, "").toLowerCase();
  }

  it("USB-001 the duration rule is pure with no import; the caller starts with the server-only import and imports only the rule and the role names", () => {
    const durationText = moduleText(DURATION_PATH);
    const callerText = moduleText(CALLER_PATH);
    expect(moduleReferences("loginSessionDuration.ts", durationText)).toEqual([]);
    expect(durationText).not.toContain("server-only");
    expect(callerText.startsWith('import "server-only";')).toBe(true);
    expect(
      moduleReferences("userSessionCreationCaller.ts", callerText).map(
        (reference) => `${reference.form} ${reference.specifier}`,
      ),
    ).toEqual(["import server-only", "import ../auth/loginSessionDuration", "import ../roles"]);
    for (const text of [durationText, callerText]) {
      expect(text.charCodeAt(0)).not.toBe(0xfeff);
    }
  });

  it("USB-002 neither module reads the environment, logs, fetches or stores anything; the rule reads no clock; each duty sits in one place; and neither names a module that another dormancy test guards", () => {
    const durationText = moduleText(DURATION_PATH);
    const callerText = moduleText(CALLER_PATH);
    for (const [name, text] of [
      ["duration", durationText],
      ["caller", callerText],
    ] as const) {
      expect(text, name).not.toMatch(
        /process\.env|console\.|\bfetch\s*\(|localStorage|sessionStorage|document\.cookie|cookies\s*\(|["']use server["']|Math\.random|randomUUID|node:crypto|import\.meta|NEXT_PUBLIC_|@supabase|next\//,
      );
      // The names that the login step 4 and 5 boundary test (VCB-004) and the
      // S6-2 cookie writer's (LCB-004) guard: a non-test file may not even
      // mention them.
      for (const guarded of [
        "verificationCode",
        "verificationChallengeCallersCore",
        "verificationChallengeCallers",
        "verificationChallengeComposition",
        "verificationCodeDelivery",
        "localSmtpVerificationCodeDelivery",
        "verificationCodeEmailWording",
        "sessionCookiePolicy",
        "loginCookieWriter",
      ]) {
        expect(new RegExp(`\\b${guarded}\\b`).test(text), `${name} mentions ${guarded}`).toBe(false);
      }
    }
    // The rule takes every time as an argument.
    expect(durationText).not.toMatch(/Date\.now|performance\.now|setTimeout/);
    // The function name, the RPC call with its abort signal and the clocks
    // only in the caller.
    for (const marker of ['"solmind_create_user_session"', ".rpc(", ".abortSignal(", "performance.now()", "Date.now()"]) {
      expect(callerText, marker).toContain(marker);
      expect(durationText, marker).not.toContain(marker);
    }
    // The 120-second margin and the 3600-second cap only in the rule.
    expect(durationText).toContain("expiryMarginSeconds: 120");
    expect(callerText).not.toMatch(/\b120\b|\b3600\b/);
    // Only these runtime exports.
    expect(Object.keys(durationModule).sort()).toEqual(
      [
        "LOGIN_SESSION_DURATION_LIMITS",
        "loginSessionCookieMaxAgeSeconds",
        "parseLoginSessionExpiresAt",
        "providerTokenRemainingLifeSeconds",
        "requestedLoginSessionDurationSeconds",
      ].sort(),
    );
  });

  it("USB-003 is not exported from any barrel", () => {
    for (const exportedName of [...Object.keys(callerModule), ...Object.keys(durationModule)]) {
      expect(exportedName in authBarrel, exportedName).toBe(false);
      expect(exportedName in supabaseBarrel, exportedName).toBe(false);
      expect(exportedName in contextBarrel, exportedName).toBe(false);
    }
    const root = sourceRoot();
    const barrels = sourceFiles(root).filter((file) => /^index\.(?:[cm]?[jt]sx?)$/.test(path.basename(file)));
    expect(barrels).toContain(path.join(root, "lib", "solmind", "auth", "index.ts"));
    expect(barrels).toContain(path.join(root, "lib", "solmind", "supabase", "index.ts"));
    for (const barrel of barrels) {
      const text = fs.readFileSync(barrel, "utf8");
      expect(text, barrel).not.toContain("loginSessionDuration");
      expect(text, barrel).not.toContain("userSessionCreationCaller");
    }
  });

  it("USB-004 is dormant: no other application file references or names either module", () => {
    // Computed references and `import.meta` in any non-test file are already
    // refused by the login step 5 boundary test (VCB-004), so the literal
    // references found here are all the references there are. The route slice
    // that first imports either module (S6-8) must amend this test in its own
    // slice, as VCB-004 is amended for login step 5's modules.
    const root = sourceRoot();
    const durationPath = path.join(root, "lib", "solmind", "auth", "loginSessionDuration").toLowerCase();
    const callerPath = path.join(root, "lib", "solmind", "supabase", "userSessionCreationCaller").toLowerCase();
    const guarded = new Set([durationPath, callerPath]);
    const offenders: string[] = [];
    for (const file of sourceFiles(root)) {
      if (/\.test\.[cm]?[jt]sx?$/.test(file)) {
        continue;
      }
      const withoutExtension = file.replace(/\.(?:[cm]?[jt]sx?)$/, "").toLowerCase();
      const text = fs.readFileSync(file, "utf8");
      if (guarded.has(withoutExtension)) {
        // The caller may import the rule; nothing else may reach either.
        continue;
      }
      for (const reference of moduleReferences(file, text)) {
        if (reference.specifier === null) {
          continue;
        }
        const resolved = resolveReference(file, reference.specifier, root);
        if (resolved !== null && guarded.has(resolved)) {
          offenders.push(`${path.relative(root, file)}: ${reference.form} ${reference.specifier}`);
        }
      }
      for (const name of ["loginSessionDuration", "userSessionCreationCaller"]) {
        if (new RegExp(`\\b${name}\\b`).test(text)) {
          offenders.push(`${path.relative(root, file)}: mentions ${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);

    // Controls: a literal import of either module from another file, and a
    // mention by name, are both found.
    const probe = path.join(root, "lib", "solmind", "other", "probe.ts");
    const found = (text: string) =>
      moduleReferences(probe, text)
        .filter((reference) => reference.specifier !== null)
        .map((reference) => resolveReference(probe, reference.specifier as string, root));
    expect(found('import { x } from "../supabase/userSessionCreationCaller";')).toEqual([callerPath]);
    expect(found('import { y } from "@/lib/solmind/auth/loginSessionDuration.ts";')).toEqual([durationPath]);
    expect(found('const m = await import("../auth/loginSessionDuration");')).toEqual([durationPath]);
  });
});
