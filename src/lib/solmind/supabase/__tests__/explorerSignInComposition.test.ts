// Login step 6, sub-slice S6-8: the server composition of the two Explorer
// sign-in routes and its request-scoped dependency factory.
//
// Contract 25 Section 15 items 2, 3, 5, 9 and 10 at the composition level
// (hold then write; success only after the session exists; no client value
// used; configuration failures deny before any effect), contract 21 Section
// 7.1.3 (one acknowledgment; eligibility before issuance), and the one
// earliest answer time. The routes' own real-path files drive the same code
// through the real handlers.
//
// Three kinds of test:
//   - ports faked (ESC-001, ESC-003 to ESC-013): the composition with a fake
//     clock, a fake waiter and scripted dependencies, so that order, counted
//     calls and the answer time are exact. No timer and no wall clock decide
//     a result;
//   - the real public issuer (ESC-002): the banked issuing caller over a fake
//     RPC seam and a fake delivery transport, so "no database call and no
//     mail for an unknown email" is shown on the real caller, not a stand-in;
//   - the real factory (ESD-001 to ESD-006): the dependency factory itself,
//     with the environment set per test and the global fetch replaced.
// Every value is synthetic. Nothing here reaches a network, a database, a
// mail catcher or a local Supabase stack: the configured Supabase host is a
// reserved name that cannot resolve, and the fetch fake records and refuses
// every request.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Counters and captured arguments for the real factory's own building
// blocks. Each wrapper calls the real function; nothing is replaced.
const built = vi.hoisted(() => ({
  services: 0,
  configuration: 0,
  serviceRoleClients: 0,
  linkClients: 0,
  bridges: [] as unknown[][],
  sessionCreators: [] as unknown[][],
  accountLookups: [] as unknown[][],
  confirmations: [] as unknown[][],
  delays: [] as unknown[],
  refusedConnections: [] as unknown[][],
}));

// The real factory builds login step 5's root, and with it the local SMTP
// transport. No test in this file sends mail, so the transport's one way to
// a socket is replaced by a function that refuses and records every target.
vi.mock("node:net", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:net")>();
  const createConnection = (...args: unknown[]): never => {
    built.refusedConnections.push(args);
    throw new Error("test setup: this file opens no socket");
  };
  const replaced = { ...actual, createConnection, connect: createConnection };
  return { ...replaced, default: replaced };
});

vi.mock("node:timers/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:timers/promises")>();
  const setTimeoutFake = (milliseconds: unknown): Promise<void> => {
    built.delays.push(milliseconds);
    return Promise.resolve();
  };
  return { ...actual, default: { ...actual, setTimeout: setTimeoutFake }, setTimeout: setTimeoutFake };
});
vi.mock("../../auth/verificationChallengeComposition", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../auth/verificationChallengeComposition")>();
  return {
    ...actual,
    createVerificationChallengeServices: (
      ...args: Parameters<typeof actual.createVerificationChallengeServices>
    ) => {
      built.services += 1;
      return actual.createVerificationChallengeServices(...args);
    },
  };
});
vi.mock("../../auth/loginRouteConfiguration", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../auth/loginRouteConfiguration")>();
  return {
    ...actual,
    loadLoginVerificationConfiguration: (
      ...args: Parameters<typeof actual.loadLoginVerificationConfiguration>
    ) => {
      built.configuration += 1;
      return actual.loadLoginVerificationConfiguration(...args);
    },
  };
});
vi.mock("../serviceRoleClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../serviceRoleClient")>();
  return {
    ...actual,
    createServiceRoleClient: () => {
      built.serviceRoleClients += 1;
      return actual.createServiceRoleClient();
    },
  };
});
vi.mock("../loginLinkAdminClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../loginLinkAdminClient")>();
  return {
    ...actual,
    createLoginLinkAdminClient: () => {
      built.linkClients += 1;
      return actual.createLoginLinkAdminClient();
    },
  };
});
vi.mock("../loginIdentityBridge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../loginIdentityBridge")>();
  return {
    ...actual,
    createLoginIdentityBridge: (...args: Parameters<typeof actual.createLoginIdentityBridge>) => {
      built.bridges.push(args);
      return actual.createLoginIdentityBridge(...args);
    },
  };
});
vi.mock("../userSessionCreationCaller", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../userSessionCreationCaller")>();
  return {
    ...actual,
    createUserSessionCreator: (...args: Parameters<typeof actual.createUserSessionCreator>) => {
      built.sessionCreators.push(args);
      return actual.createUserSessionCreator(...args);
    },
  };
});
vi.mock("../loginAccountLookupCallers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../loginAccountLookupCallers")>();
  return {
    ...actual,
    createLoginAccountLookup: (...args: Parameters<typeof actual.createLoginAccountLookup>) => {
      built.accountLookups.push(args);
      return actual.createLoginAccountLookup(...args);
    },
    createRedeemedLoginChallengeConfirmation: (
      ...args: Parameters<typeof actual.createRedeemedLoginChallengeConfirmation>
    ) => {
      built.confirmations.push(args);
      return actual.createRedeemedLoginChallengeConfirmation(...args);
    },
  };
});

import * as authBarrel from "../../auth/index";
import { LOGIN_VERIFICATION_DELIVERY_SETTINGS } from "../../auth/loginRouteConfiguration";
import { resolveSessionCookiePolicy } from "../../auth/sessionCookiePolicy";
import { createVerificationChallengeIssuer } from "../../auth/verificationChallengeCallers";
import { createVerificationCodePepper } from "../../auth/verificationCode";
import * as contextBarrel from "../../context/index";
import { SOLMIND_ROLES } from "../../roles";
import * as compositionModule from "../explorerSignInComposition";
import {
  EXPLORER_SIGN_IN_SPARE_SELECTOR_REQUEST,
  requestExplorerSignInCode,
  verifyExplorerSignInCode,
} from "../explorerSignInComposition";
import * as dependenciesModule from "../explorerSignInDependencies";
import {
  EXPLORER_SIGN_IN_CLEANUP_FAILURE_SIGNAL_LINE,
  EXPLORER_SIGN_IN_DEADLINES,
  EXPLORER_SIGN_IN_DEPENDENCY_CONFIGURATION_FAILED,
  EXPLORER_SIGN_IN_PORTS,
  EXPLORER_SIGN_IN_RESPONSE_FLOOR_MILLISECONDS,
  type ExplorerSignInPorts,
  type ExplorerSignInSendDependencies,
  type ExplorerSignInVerifyDependencies,
} from "../explorerSignInDependencies";
import {
  EXPLORER_SIGN_IN_CODE_NOT_ACCEPTED,
  EXPLORER_SIGN_IN_DENIED,
  EXPLORER_SIGN_IN_INVALID_EMAIL,
} from "../explorerSignInRouteContract";
import * as supabaseBarrel from "../index";

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

const LOOPBACK_ORIGIN = "http://127.0.0.1:3000";
const SUPABASE_URL = "http://supabase.invalid";
const SERVICE_KEY = "synthetic-service-role-key-s68-composition";
const ANON_KEY = "synthetic-anon-key-s68-composition";
const PEPPER_BYTES = Buffer.alloc(32, 0x5a);
const PEPPER_TEXT = PEPPER_BYTES.toString("base64url");

const TYPED_EMAIL = "  Explorer.S68@SolMind.Example ";
const EMAIL = "explorer.s68@solmind.example";
// The lookup's own row deliberately differs from what was typed in every
// value a later step could take from the request by mistake.
const STORED_EMAIL = "stored.explorer.s68@solmind.example";
const ACCOUNT_ID = "1a111111-1111-4111-8111-11111111111f";
const CONTACT_ID = "2b222222-2222-4222-8222-22222222222e";
const PROVIDER_ID = "3f0c9a6e-1b2d-4c3e-8f4a-5b6c7d8e9f01";
const CHALLENGE_ID = "5d0c9a6e-1b2d-4c3e-8f4a-5b6c7d8e9f01";
const SESSION_ID = "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60";
const CODE = "246810";
const TOKEN_EXPIRES_AT = 1_900_000_000;
const MAX_AGE = 3_480;
const HELD_VALUE = "base64-c3ludGhldGljLWhlbGQtc2Vzc2lvbi1zNjg";
const SENTINEL = "sentinel-s68-composition-detail";
const START = 50_000;
const ANSWER_AT = START + EXPLORER_SIGN_IN_RESPONSE_FLOOR_MILLISECONDS;

const FOUND = Object.freeze({
  outcome: "found" as const,
  userAccountId: ACCOUNT_ID,
  userContactMethodId: CONTACT_ID,
  normalizedEmail: STORED_EMAIL,
  providerUserId: PROVIDER_ID,
});

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let selectorCount = 0;
// A fresh, deterministic selector for every scripted issuance answer.
function nextSelector(): string {
  selectorCount += 1;
  return `0000${String(selectorCount).padStart(4, "0")}-0000-4000-8000-000000000000`;
}

// Lets every already-settled promise chain run to its end: two turns of the
// event loop. No timer decides a result.
async function flush(): Promise<void> {
  for (let turn = 0; turn < 2; turn += 1) {
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  }
}

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (reason: unknown) => void };

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

// The fake clock and waiter. The clock never moves by itself; the waiter
// records the answer time it is asked for and resolves only when released.
function fakeTime(events: string[], options: Readonly<{ waiter?: "held" | "rejects" | "throws" }> = {}) {
  const waits: number[] = [];
  let pending: Deferred<void> | null = null;
  const now = (): number => {
    events.push("now");
    return START;
  };
  const waitUntil = (answerAt: number): Promise<void> => {
    events.push("wait");
    waits.push(answerAt);
    if (options.waiter === "throws") {
      throw new Error(SENTINEL);
    }
    if (options.waiter === "rejects") {
      return Promise.reject(new Error(SENTINEL));
    }
    pending = deferred<void>();
    return pending.promise;
  };
  const release = (): void => {
    if (pending === null) {
      throw new Error("test setup: no wait to release");
    }
    pending.resolve();
    pending = null;
  };
  return { now, waitUntil, waits, release, waiting: () => pending !== null };
}

// Runs `start`, shows that it stays unsettled until the waiter is released
// (when a wait is expected), and returns the result with the answer times
// the waiter was asked for.
async function settleThroughWait<T>(
  time: ReturnType<typeof fakeTime>,
  start: () => Promise<T>,
  expectWait: boolean,
): Promise<{ result: T; waits: number[] }> {
  let settled = false;
  const running = start().then((value) => {
    settled = true;
    return value;
  });
  await flush();
  if (expectWait) {
    // With the real factory the work before the wait takes more turns (a
    // fake fetch answer is read asynchronously); the bound only ends a test
    // that would otherwise hang.
    for (let turn = 0; turn < 500 && !time.waiting() && !settled; turn += 1) {
      await flush();
    }
    expect(settled, "settled before the waiter was released").toBe(false);
    expect(time.waiting()).toBe(true);
    time.release();
  } else {
    expect(time.waiting()).toBe(false);
    expect(settled, "not settled although no wait was asked for").toBe(true);
  }
  return { result: await running, waits: [...time.waits] };
}

// --- the send route's scripted dependencies ----------------------------------

type SendScript = Readonly<{
  configure?: () => void;
  spare?: () => unknown;
  lookup?: () => unknown;
  issue?: (request: unknown) => unknown;
  waiter?: "held" | "rejects" | "throws";
}>;

function sendHarness(script: SendScript = {}) {
  const events: string[] = [];
  const time = fakeTime(events, { waiter: script.waiter });
  const issueRequests: unknown[] = [];
  const lookupRequests: unknown[] = [];
  const origins: string[] = [];
  let spareSelector: string | null = null;
  const dependencies = {
    issuer: {
      issue: async (request: unknown) => {
        issueRequests.push(request);
        if (request === EXPLORER_SIGN_IN_SPARE_SELECTOR_REQUEST) {
          events.push("spare");
          if (script.spare !== undefined) {
            return script.spare();
          }
          spareSelector = nextSelector();
          return Object.freeze({ outcome: "invalid_request", challengeId: spareSelector });
        }
        events.push("issue");
        if (script.issue !== undefined) {
          return script.issue(request);
        }
        return Object.freeze({ outcome: "issued", challengeId: nextSelector(), delivery: "accepted" });
      },
    },
    accountLookup: {
      resolve: async (request: unknown) => {
        events.push("lookup");
        lookupRequests.push(request);
        return script.lookup === undefined ? FOUND : script.lookup();
      },
    },
  } as unknown as ExplorerSignInSendDependencies;
  const ports: ExplorerSignInPorts = {
    now: time.now,
    epochSeconds: () => TOKEN_EXPIRES_AT - 3600,
    waitUntil: time.waitUntil,
    createSendDependencies: (trustedOrigin) => {
      events.push("configure");
      origins.push(trustedOrigin);
      script.configure?.();
      return dependencies;
    },
    createVerifyDependencies: () => {
      throw new Error("test setup: the send route must not build the verify dependencies");
    },
  };
  const send = (identifier: unknown = TYPED_EMAIL, extra: Record<string, unknown> = {}) =>
    requestExplorerSignInCode(
      { trustedOrigin: LOOPBACK_ORIGIN, identifier, ...extra } as Parameters<typeof requestExplorerSignInCode>[0],
      ports,
    );
  return { events, time, issueRequests, lookupRequests, origins, ports, send, spare: () => spareSelector };
}

// --- the verify route's scripted dependencies --------------------------------

type CookieWriteRecord = Readonly<{ name: string; value: string; attributes: unknown }>;

function fakeResponse(events: string[], failOn?: Readonly<{ header?: number; cookie?: number }>) {
  const cookies: CookieWriteRecord[] = [];
  const headers: Array<readonly [string, string]> = [];
  const response = {
    cookies: {
      set: (name: string, value: string, attributes: unknown) => {
        if (failOn?.cookie !== undefined && cookies.length + 1 === failOn.cookie) {
          events.push(`cookie-throws:${name}`);
          throw new Error(SENTINEL);
        }
        events.push(`cookie:${name}`);
        cookies.push({ name, value, attributes });
      },
    },
    headers: {
      set: (name: string, value: string) => {
        if (failOn?.header !== undefined && headers.length + 1 === failOn.header) {
          events.push(`header-throws:${name}`);
          throw new Error(SENTINEL);
        }
        events.push(`header:${name}`);
        headers.push([name, value]);
      },
    },
  };
  return { response, cookies, headers };
}

type VerifyScript = Readonly<{
  configure?: () => void;
  redeem?: () => unknown;
  lookup?: () => unknown;
  confirm?: () => unknown;
  exchange?: () => unknown;
  create?: () => unknown;
  prepare?: () => Promise<void>;
  release?: (request: unknown) => unknown;
  discard?: () => unknown;
  heldCookies?: ReadonlyArray<Readonly<{ name: string; value: string }>>;
  makeResponse?: () => unknown;
  responseFailsOn?: Readonly<{ header?: number; cookie?: number }>;
  requestCookies?: ReadonlyArray<Readonly<{ name: string; value: string }>>;
}>;

function verifyHarness(script: VerifyScript = {}) {
  const events: string[] = [];
  const time = fakeTime(events);
  const calls = {
    redeem: [] as unknown[],
    lookup: [] as unknown[],
    confirm: [] as unknown[],
    exchange: [] as unknown[],
    create: [] as unknown[],
    prepare: [] as unknown[],
    candidates: [] as unknown[],
    release: [] as unknown[],
    discard: 0,
    responses: 0,
  };
  const origins: string[] = [];
  const made: Array<ReturnType<typeof fakeResponse>> = [];
  const hold = {
    accessTokenExpiresAt: TOKEN_EXPIRES_AT,
    assertProviderUser: async () => {
      throw new Error("test setup: the Explorer path never asserts through the hold");
    },
    prepareAcceptedSession: async (request: unknown) => {
      calls.prepare.push(request);
      events.push("prepare");
      await script.prepare?.();
    },
    release: (request: unknown) => {
      calls.release.push(request);
      events.push(`release:${String((request as { sessionOutcome?: unknown }).sessionOutcome)}`);
      if (script.release !== undefined) {
        return script.release(request);
      }
      return Object.freeze({
        outcome: "released",
        heldCookies: script.heldCookies ?? [{ name: "solmind-auth", value: HELD_VALUE }],
      });
    },
    discard: () => {
      calls.discard += 1;
      events.push("discard");
      if (script.discard !== undefined) {
        return script.discard();
      }
      return Promise.resolve(Object.freeze({ outcome: "discarded", cleanup: "cleaned" }));
    },
  };
  const dependencies = {
    redeemer: {
      redeem: async (request: unknown) => {
        events.push("redeem");
        calls.redeem.push(request);
        return script.redeem === undefined ? Object.freeze({ outcome: "redeemed" }) : script.redeem();
      },
    },
    accountLookup: {
      resolve: async (request: unknown) => {
        events.push("lookup");
        calls.lookup.push(request);
        return script.lookup === undefined ? FOUND : script.lookup();
      },
    },
    challengeConfirmation: {
      confirm: async (request: unknown) => {
        events.push("confirm");
        calls.confirm.push(request);
        return script.confirm === undefined ? Object.freeze({ outcome: "confirmed" }) : script.confirm();
      },
    },
    bridge: {
      signInWithPassword: async () => {
        throw new Error("test setup: the Explorer path never uses the password sign-in");
      },
      exchangeExplorerLink: async (request: unknown) => {
        events.push("exchange");
        calls.exchange.push(request);
        return script.exchange === undefined ? Object.freeze({ outcome: "held", hold }) : script.exchange();
      },
    },
    sessionCreator: {
      create: async (request: unknown) => {
        events.push("create");
        calls.create.push(request);
        return script.create === undefined
          ? Object.freeze({ outcome: "created", sessionId: SESSION_ID, maxAgeSeconds: MAX_AGE })
          : script.create();
      },
    },
  } as unknown as ExplorerSignInVerifyDependencies;
  const ports: ExplorerSignInPorts = {
    now: time.now,
    epochSeconds: () => TOKEN_EXPIRES_AT - 3600,
    waitUntil: time.waitUntil,
    createSendDependencies: () => {
      throw new Error("test setup: the verify route must not build the send dependencies");
    },
    createVerifyDependencies: (trustedOrigin, candidate) => {
      calls.candidates.push(candidate);
      events.push("configure");
      origins.push(trustedOrigin);
      script.configure?.();
      return dependencies;
    },
  };
  const verify = (overrides: Record<string, unknown> = {}) =>
    verifyExplorerSignInCode(
      {
        trustedOrigin: LOOPBACK_ORIGIN,
        identifier: TYPED_EMAIL,
        challengeId: CHALLENGE_ID,
        code: CODE,
        requestCookies: script.requestCookies ?? [],
        createSuccessResponse: () => {
          calls.responses += 1;
          events.push("response");
          if (script.makeResponse !== undefined) {
            return script.makeResponse() as ReturnType<typeof fakeResponse>["response"];
          }
          const fake = fakeResponse(events, script.responseFailsOn);
          made.push(fake);
          return fake.response;
        },
        ...overrides,
      } as Parameters<typeof verifyExplorerSignInCode>[0],
      ports,
    );
  return { events, time, calls, origins, made, hold, ports, verify };
}

function throwing(): never {
  throw new Error(SENTINEL);
}

function rejecting(): Promise<never> {
  return Promise.reject(new Error(SENTINEL));
}

// --- the real factory's environment and network edge -------------------------

function stubEnvironment(overrides: Record<string, string> = {}): void {
  const values: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    SOLMIND_VERIFICATION_PEPPER: PEPPER_TEXT,
    ...overrides,
  };
  for (const [name, value] of Object.entries(values)) {
    vi.stubEnv(name, value);
  }
  // The pepper source refuses to load while its public-name tripwire is set,
  // so the tests do not depend on this computer's own environment.
  vi.stubEnv("NEXT_PUBLIC_SOLMIND_VERIFICATION_PEPPER", undefined);
}

// Records every request and answers it with `respond`, or refuses it.
function stubFetch(respond?: (url: string, init?: RequestInit) => Response) {
  const requests: Array<Readonly<{ url: string; body: unknown }>> = [];
  const send = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    requests.push({ url, body: typeof init?.body === "string" ? JSON.parse(init.body) : null });
    if (respond === undefined) {
      throw new Error("test setup: no request is expected");
    }
    return respond(url, init);
  });
  vi.stubGlobal("fetch", send);
  return { send, requests };
}

function resetBuilt(): void {
  built.services = 0;
  built.configuration = 0;
  built.serviceRoleClients = 0;
  built.linkClients = 0;
  built.bridges.length = 0;
  built.sessionCreators.length = 0;
  built.accountLookups.length = 0;
  built.confirmations.length = 0;
  built.delays.length = 0;
}

let stderrLines: string[] = [];
let realConnect: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  for (const method of CONSOLE_METHODS) {
    vi.spyOn(console, method);
  }
  stderrLines = [];
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    stderrLines.push(String(chunk));
    return true;
  });
  // The guard behind the replacement: a real socket connect, by any path,
  // is refused and recorded.
  const actualNet = await vi.importActual<typeof import("node:net")>("node:net");
  realConnect = vi.spyOn(actualNet.Socket.prototype, "connect").mockImplementation(() => {
    throw new Error("test setup: a real socket is never opened");
  });
  built.refusedConnections.length = 0;
  resetBuilt();
});

afterEach(() => {
  // The checks run in `try` and the restores in `finally`, so that a failed
  // check here cannot leave a spy in place for the tests after it.
  try {
    for (const method of CONSOLE_METHODS) {
      expect(vi.mocked(console[method]).mock.calls.length === 0, `console.${method} was not called`).toBe(true);
    }
    // Only the one fixed signal line may ever reach standard error.
    for (const line of stderrLines) {
      expect(
        line === EXPLORER_SIGN_IN_CLEANUP_FAILURE_SIGNAL_LINE,
        "standard error carries nothing but the fixed signal line",
      ).toBe(true);
    }
    // No test in this file asked for a socket, and none was opened.
    expect(built.refusedConnections).toEqual([]);
    expect(realConnect).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});

describe("explorerSignInComposition - send a code: one acknowledgment (contract 21 Section 7.1.3)", () => {
  // Every exit class from the account lookup on. `own` is true when the
  // issuing caller's own selector must be the one acknowledged.
  const EXIT_CLASSES: ReadonlyArray<readonly [string, SendScript, boolean]> = [
    ["an unknown or ineligible email (zero rows)", { lookup: () => ({ outcome: "not_found" }) }, false],
    ["a failed lookup", { lookup: () => ({ outcome: "failed" }) }, false],
    ["a lookup that throws", { lookup: throwing }, false],
    ["a lookup that rejects", { lookup: rejecting }, false],
    ["a lookup answer outside its closed set", { lookup: () => ({ outcome: "eligible" }) }, false],
    ["a lookup answer that is not an object", { lookup: () => undefined }, false],
    ["a `found` row without a contact UUID", { lookup: () => ({ ...FOUND, userContactMethodId: null }) }, false],
    ["a `found` row without an account UUID", { lookup: () => ({ ...FOUND, userAccountId: null }) }, false],
    ["a `found` row with an uppercase account UUID", { lookup: () => ({ ...FOUND, userAccountId: ACCOUNT_ID.toUpperCase() }) }, false],
    ["a `found` row without an email", { lookup: () => ({ ...FOUND, normalizedEmail: null }) }, false],
    ["issued and accepted", {}, true],
    ["issued, delivery timed out", { issue: () => ({ outcome: "issued", challengeId: nextSelector(), delivery: "timeout" }) }, true],
    ["issued, delivery failed for good", { issue: () => ({ outcome: "issued", challengeId: nextSelector(), delivery: "terminal_failure" }) }, true],
    ["issued, delivery ambiguous", { issue: () => ({ outcome: "issued", challengeId: nextSelector(), delivery: "ambiguous" }) }, true],
    ["issued, delivery not attempted", { issue: () => ({ outcome: "issued", challengeId: nextSelector(), delivery: "not_attempted" }) }, true],
    ["a budget or lockout denial", { issue: () => ({ outcome: "denied", challengeId: nextSelector() }) }, true],
    ["an ineligible binding", { issue: () => ({ outcome: "ineligible", challengeId: nextSelector() }) }, true],
    ["no free issuance slot", { issue: () => ({ outcome: "busy", challengeId: nextSelector() }) }, true],
    ["a refused real request", { issue: () => ({ outcome: "invalid_request", challengeId: nextSelector() }) }, true],
    ["a failed issuance", { issue: () => ({ outcome: "failed", challengeId: nextSelector() }) }, true],
    ["a failed issuance carrying the nil UUID", { issue: () => ({ outcome: "failed", challengeId: "00000000-0000-0000-0000-000000000000" }) }, true],
    ["an issuing caller that throws on the real request", { issue: throwing }, false],
    ["an issuing caller that rejects on the real request", { issue: rejecting }, false],
    ["an issuance answer without a selector", { issue: () => ({ outcome: "issued", delivery: "accepted" }) }, false],
    ["an issuance answer with a malformed selector", { issue: () => ({ outcome: "issued", challengeId: "NOT-A-SELECTOR", delivery: "accepted" }) }, false],
    ["an issuance answer that is not an object", { issue: () => null }, false],
  ];

  it("ESC-001 every exit class from the account lookup on gives the one acknowledgment, byte for byte apart from the selector: a fresh one, or the issuing caller's fixed nil UUID fallback, which is exempt from freshness", async () => {
    const selectors = new Set<string>();
    for (const [label, script, own] of EXIT_CLASSES) {
      let issuedSelector: string | null = null;
      const harness = sendHarness({
        ...script,
        issue:
          script.issue === undefined
            ? undefined
            : (request) => {
                const answer = (script.issue as (request: unknown) => unknown)(request);
                issuedSelector = (answer as { challengeId?: string } | null)?.challengeId ?? null;
                return answer;
              },
      });
      const { result } = await settleThroughWait(harness.time, () => harness.send(), true);
      expect(Object.keys(result), label).toEqual(["acknowledgment", "challengeId"]);
      const acknowledged = result as { acknowledgment: string; challengeId: string };
      expect(acknowledged.acknowledgment, label).toBe("verification_code_requested");
      expect(Object.isFrozen(result), label).toBe(true);
      // One body form: only the selector differs.
      expect(JSON.stringify(result).replace(acknowledged.challengeId, "<selector>"), label).toBe(
        '{"acknowledgment":"verification_code_requested","challengeId":"<selector>"}',
      );
      expect(acknowledged.challengeId, label).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      if (own && script.issue !== undefined) {
        expect(acknowledged.challengeId, label).toBe(issuedSelector);
      } else if (!own) {
        // The spare selector taken before the lookup.
        expect(acknowledged.challengeId, label).toBe(harness.spare());
      }
      if (acknowledged.challengeId !== "00000000-0000-0000-0000-000000000000") {
        expect(selectors.has(acknowledged.challengeId), `${label}: a selector was reused`).toBe(false);
        selectors.add(acknowledged.challengeId);
      }
    }
  });

  it("ESC-002 on the real public issuer: the spare request is refused with a fresh UUID and no effect; an unknown or ineligible email makes no issuance database call and no mail attempt; an eligible one makes exactly one of each, bound to the lookup's row", async () => {
    const rpcCalls: Array<Readonly<{ functionName: string; args: Record<string, unknown> }>> = [];
    const sends: Array<Record<string, unknown>> = [];
    const issuer = createVerificationChallengeIssuer({
      rpcClient: {
        rpc: (functionName, args) => ({
          abortSignal: () => {
            rpcCalls.push({ functionName, args: { ...args } });
            return Promise.resolve({ data: [{ outcome: "issued" }], error: null });
          },
        }),
      },
      rpcTimeoutMilliseconds: 5_000,
      pepper: createVerificationCodePepper(PEPPER_BYTES),
      deliveryTransport: Object.freeze({
        send: async (request: unknown) => {
          sends.push({ ...(request as Record<string, unknown>) });
          return "accepted";
        },
      }),
      deliveryTimeoutMilliseconds: 2_000,
    });

    // The constant itself: an empty frozen object, and nothing else.
    expect(Reflect.ownKeys(EXPLORER_SIGN_IN_SPARE_SELECTOR_REQUEST)).toEqual([]);
    expect(Object.isFrozen(EXPLORER_SIGN_IN_SPARE_SELECTOR_REQUEST)).toBe(true);
    expect(Object.getPrototypeOf(EXPLORER_SIGN_IN_SPARE_SELECTOR_REQUEST)).toBe(Object.prototype);
    const first = await issuer.issue(EXPLORER_SIGN_IN_SPARE_SELECTOR_REQUEST);
    const second = await issuer.issue(EXPLORER_SIGN_IN_SPARE_SELECTOR_REQUEST);
    expect(first.outcome).toBe("invalid_request");
    expect(second.outcome).toBe("invalid_request");
    expect(first.challengeId).toMatch(UUID_V4);
    expect(second.challengeId).toMatch(UUID_V4);
    expect(second.challengeId).not.toBe(first.challengeId);
    expect(rpcCalls.length === 0, "the spare request made no issuance database call").toBe(true);
    expect(sends.length === 0, "the spare request sent no mail").toBe(true);

    const composeWith = (lookup: () => unknown) => {
      const events: string[] = [];
      const time = fakeTime(events);
      const ports: ExplorerSignInPorts = {
        now: time.now,
        epochSeconds: () => TOKEN_EXPIRES_AT - 3600,
        waitUntil: time.waitUntil,
        createSendDependencies: () =>
          ({ issuer, accountLookup: { resolve: async () => lookup() } }) as unknown as ExplorerSignInSendDependencies,
        createVerifyDependencies: () => {
          throw new Error("test setup: not the verify route");
        },
      };
      return settleThroughWait(time, () => requestExplorerSignInCode({ trustedOrigin: LOOPBACK_ORIGIN, identifier: TYPED_EMAIL }, ports), true);
    };

    // No eligible account: the acknowledgment, with a real version 4 selector,
    // and still no issuance call and no mail.
    for (const lookup of [
      () => ({ outcome: "not_found" }),
      () => ({ outcome: "failed" }),
      throwing,
      () => ({ ...FOUND, userContactMethodId: null }),
      () => ({ ...FOUND, userAccountId: null, userContactMethodId: null }),
    ]) {
      const { result } = await composeWith(lookup);
      expect((result as { acknowledgment: string }).acknowledgment).toBe("verification_code_requested");
      expect((result as { challengeId: string }).challengeId).toMatch(UUID_V4);
      expect(rpcCalls.length === 0, "no eligible account: no issuance database call").toBe(true);
      expect(sends.length === 0, "no eligible account: no mail").toBe(true);
    }

    // One eligible row: exactly one issuance call, bound to that row, and one
    // delivery to the row's own email.
    const { result } = await composeWith(() => FOUND);
    expect(rpcCalls.length === 1, "one eligible row: exactly one issuance database call").toBe(true);
    expect(rpcCalls[0].functionName).toBe("solmind_issue_verification_challenge");
    const issued = rpcCalls[0].args;
    expect(
      issued.p_purpose === "login" &&
        issued.p_contact_method_type === "email" &&
        issued.p_delivery_channel === "email" &&
        issued.p_normalized_contact_value === STORED_EMAIL &&
        issued.p_user_account_id === ACCOUNT_ID &&
        issued.p_user_contact_method_id === CONTACT_ID,
      "the issuance is bound to the lookup's row",
    ).toBe(true);
    expect(rpcCalls[0].args.p_user_account_id).not.toBeNull();
    expect(rpcCalls[0].args.p_user_contact_method_id).not.toBeNull();
    expect((result as { challengeId: string }).challengeId).toBe(rpcCalls[0].args.p_verification_challenge_id);
    expect(sends.length === 1, "one eligible row: exactly one delivery").toBe(true);
    expect(sends[0].normalizedContact === STORED_EMAIL, "the delivery is to the row's own email").toBe(true);
    expect(sends[0].purpose).toBe("login");
  });

  it("ESC-003 every exit class from the account lookup on asks the waiter for the same answer time and resolves only after it is released; invalid_email and denied do not wait", async () => {
    for (const [label, script] of EXIT_CLASSES) {
      const harness = sendHarness(script);
      const { waits } = await settleThroughWait(harness.time, () => harness.send(), true);
      // Exactly one wait, for exactly the one answer time fixed at the start.
      expect(waits, label).toEqual([ANSWER_AT]);
      // The clock was read once, first, before anything else.
      expect(harness.events.filter((event) => event === "now"), label).toEqual(["now"]);
      expect(harness.events[0], label).toBe("now");
      expect(harness.events[harness.events.length - 1], label).toBe("wait");
    }
    expect(ANSWER_AT - START).toBe(EXPLORER_SIGN_IN_RESPONSE_FLOOR_MILLISECONDS);

    // The answers that do not depend on stored data return at once.
    const noWait: ReadonlyArray<readonly [string, SendScript, unknown, unknown]> = [
      ["not an email", {}, "not an email", EXPLORER_SIGN_IN_INVALID_EMAIL],
      ["a non-string identifier", {}, 42, EXPLORER_SIGN_IN_INVALID_EMAIL],
      ["a configuration failure", { configure: throwing }, TYPED_EMAIL, EXPLORER_SIGN_IN_DENIED],
      ["a spare request that throws", { spare: throwing }, TYPED_EMAIL, EXPLORER_SIGN_IN_DENIED],
      ["a spare request that rejects", { spare: rejecting }, TYPED_EMAIL, EXPLORER_SIGN_IN_DENIED],
      ["a spare answer without a selector", { spare: () => ({ outcome: "invalid_request" }) }, TYPED_EMAIL, EXPLORER_SIGN_IN_DENIED],
      ["a spare answer that is not an object", { spare: () => undefined }, TYPED_EMAIL, EXPLORER_SIGN_IN_DENIED],
    ];
    for (const [label, script, identifier, expected] of noWait) {
      const harness = sendHarness(script);
      const { result, waits } = await settleThroughWait(harness.time, () => harness.send(identifier), false);
      expect(result, label).toBe(expected);
      expect(waits, label).toEqual([]);
      expect(harness.lookupRequests.length === 0, `${label}: no lookup was made`).toBe(true);
      if (expected === EXPLORER_SIGN_IN_INVALID_EMAIL) {
        // Text that is not an email is answered from what was typed alone:
        // the clock was read and nothing else happened, so the request's
        // dependencies were never built.
        expect(harness.events, label).toEqual(["now"]);
      }
    }

    // A waiter that fails does not change the answer.
    for (const waiter of ["rejects", "throws"] as const) {
      const harness = sendHarness({ waiter });
      const result = await harness.send();
      expect((result as { acknowledgment: string }).acknowledgment).toBe("verification_code_requested");
      expect(harness.time.waits).toEqual([ANSWER_AT]);
    }
  });

  it("ESC-012 an issuing caller that throws only on the found branch still gives the acknowledgment, with the spare selector, and the same answer time as an unknown email", async () => {
    const found = sendHarness({ issue: throwing });
    const foundRun = await settleThroughWait(found.time, () => found.send(), true);
    const unknown = sendHarness({ lookup: () => ({ outcome: "not_found" }) });
    const unknownRun = await settleThroughWait(unknown.time, () => unknown.send(), true);
    for (const [run, harness] of [
      [foundRun, found],
      [unknownRun, unknown],
    ] as const) {
      expect(Object.keys(run.result)).toEqual(["acknowledgment", "challengeId"]);
      expect((run.result as { challengeId: string }).challengeId).toBe(harness.spare());
      expect(run.waits).toEqual([ANSWER_AT]);
    }
    // The whole answer, in each branch: the one acknowledgment with that
    // request's own spare selector, and nothing else.
    const foundSpare = found.spare();
    const unknownSpare = unknown.spare();
    expect(
      foundSpare !== null &&
        isDeepStrictEqual(foundRun.result, { acknowledgment: "verification_code_requested", challengeId: foundSpare }),
      "ESC-012: the found branch answers exactly the one acknowledgment with its spare selector",
    ).toBe(true);
    expect(
      unknownSpare !== null &&
        isDeepStrictEqual(unknownRun.result, {
          acknowledgment: "verification_code_requested",
          challengeId: unknownSpare,
        }),
      "ESC-012: the unknown-email branch answers exactly the one acknowledgment with its spare selector",
    ).toBe(true);
    // Only the found branch reached the issuing caller a second time.
    expect(found.events).toEqual(["now", "configure", "spare", "lookup", "issue", "wait"]);
    expect(unknown.events).toEqual(["now", "configure", "spare", "lookup", "wait"]);
  });

  it("ESC-011a the send route fixes the type, the role and the purpose, and takes the binding from the lookup's row, whatever the request carries", async () => {
    const harness = sendHarness();
    await settleThroughWait(
      harness.time,
      () =>
        harness.send(TYPED_EMAIL, {
          role: "admin",
          requestedRoleContext: "guide",
          identifierType: "username",
          purpose: "role_reentry",
          userAccountId: "99999999-9999-4999-8999-999999999999",
          userContactMethodId: "88888888-8888-4888-8888-888888888888",
          normalizedContact: "attacker.s68@solmind.example",
        }),
      true,
    );
    expect(harness.origins).toEqual([LOOPBACK_ORIGIN]);
    expect(
      isDeepStrictEqual(harness.lookupRequests, [
        { normalizedIdentifier: EMAIL, identifierType: "email", requestedRoleContext: "explorer" },
      ]),
      "one lookup: the normalized email, the type `email` and the Explorer role",
    ).toBe(true);
    expect((harness.lookupRequests[0] as { requestedRoleContext: string }).requestedRoleContext).toBe(
      SOLMIND_ROLES.EXPLORER,
    );
    expect(harness.issueRequests.length === 2, "two calls of the issuing caller").toBe(true);
    expect(
      harness.issueRequests[0] === EXPLORER_SIGN_IN_SPARE_SELECTOR_REQUEST,
      "the first call is the spare-selector request",
    ).toBe(true);
    expect(
      isDeepStrictEqual(harness.issueRequests[1], {
        purpose: "login",
        contactMethodType: "email",
        normalizedContact: STORED_EMAIL,
        userAccountId: ACCOUNT_ID,
        userContactMethodId: CONTACT_ID,
      }),
      "the real request: the purpose `login` and the binding of the lookup's row",
    ).toBe(true);
    expect(Object.isFrozen(harness.issueRequests[1])).toBe(true);
    // The order: clock, configuration, spare selector, lookup, issuance, wait.
    expect(harness.events).toEqual(["now", "configure", "spare", "lookup", "issue", "wait"]);
  });
});

describe("explorerSignInComposition - verify the code and sign in (contract 25 Section 15 items 2, 3 and 5)", () => {
  it("ESC-006 a success runs in contract 21's order, makes the success response only after the release, and returns that same response with both cookies written", async () => {
    const harness = verifyHarness({
      requestCookies: [
        { name: "solmind-auth.0", value: "" },
        { name: "solmind-auth-code-verifier", value: "" },
        { name: "solmind-session", value: "" },
        { name: "unrelated", value: "" },
      ],
    });
    const { result, waits } = await settleThroughWait(harness.time, () => harness.verify(), false);
    expect(result.outcome).toBe("signed_in");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.keys(result)).toEqual(["outcome", "response"]);
    expect(harness.made).toHaveLength(1);
    expect((result as { response: unknown }).response).toBe(harness.made[0].response);
    // One event list: the whole order of a success.
    expect(harness.events).toEqual([
      "now",
      "configure",
      "redeem",
      "lookup",
      "confirm",
      "exchange",
      "create",
      "now",
      "prepare",
      "now",
      "release:created",
      "response",
      "header:Cache-Control",
      "header:Expires",
      "header:Pragma",
      "cookie:solmind-auth.0",
      "cookie:solmind-auth-code-verifier",
      "cookie:solmind-auth",
      "cookie:solmind-session",
    ]);
    // A success does not wait and never discards.
    expect(waits).toEqual([]);
    expect(harness.calls.discard).toBe(0);
    expect(harness.calls.responses).toBe(1);
    // The request's old chunk and code verifier are cleared; the auth cookie
    // is the held value; the binding cookie is the database's session UUID.
    const byName = new Map(harness.made[0].cookies.map((cookie) => [cookie.name, cookie]));
    // True when the named cookie was set with exactly this value and with
    // each of these attributes. A failed check prints its label only.
    const wasSet = (name: string, value: string, attributes: Record<string, unknown>): boolean => {
      const cookie = byName.get(name);
      const given = cookie?.attributes;
      return (
        cookie !== undefined &&
        cookie.value === value &&
        typeof given === "object" &&
        given !== null &&
        Object.entries(attributes).every(([key, wanted]) => Object.is((given as Record<string, unknown>)[key], wanted))
      );
    };
    const sessionAttributes = { maxAge: MAX_AGE, httpOnly: true, sameSite: "lax", path: "/", secure: false };
    expect(wasSet("solmind-auth.0", "", { maxAge: 0 }), "the request's old chunk is cleared").toBe(true);
    expect(wasSet("solmind-auth-code-verifier", "", { maxAge: 0 }), "the request's code verifier is cleared").toBe(true);
    expect(wasSet("solmind-auth", HELD_VALUE, sessionAttributes), "the auth cookie is the held value").toBe(true);
    expect(wasSet("solmind-session", SESSION_ID, sessionAttributes), "the binding cookie is the session UUID").toBe(true);
    expect(byName.has("unrelated")).toBe(false);
  });

  it("ESC-007 every failure branch after the exchange returns no response, and awaits discard before it answers; a response whose cookie setter throws partway is never returned", async () => {
    const BRANCHES: ReadonlyArray<readonly [string, VerifyScript, number]> = [
      ["the session call denies", { create: () => ({ outcome: "denied" }) }, 0],
      ["the session call refuses the request", { create: () => ({ outcome: "invalid_request" }) }, 0],
      ["the session call fails", { create: () => ({ outcome: "failed" }) }, 0],
      ["a session answer outside the closed set", { create: () => ({ outcome: "superseded", sessionId: SESSION_ID, maxAgeSeconds: MAX_AGE }) }, 0],
      ["a session answer that is not an object", { create: () => undefined }, 0],
      ["the session call throws", { create: throwing }, 0],
      ["the session call rejects", { create: rejecting }, 0],
      ["the release is refused", { release: () => ({ outcome: "refused" }) }, 0],
      ["the release throws", { release: throwing }, 0],
      ["a release answer that is not an object", { release: () => null }, 0],
      ["the response function throws", { makeResponse: throwing }, 1],
      ["the response function returns nothing the writer can use", { makeResponse: () => null }, 1],
      ["the writer denies a held cookie of another name", { heldCookies: [{ name: "other-cookie", value: HELD_VALUE }] }, 1],
      ["the writer denies an incomplete chunk set", { heldCookies: [{ name: "solmind-auth.1", value: HELD_VALUE }] }, 1],
      ["the writer denies a session id that is not canonical", { create: () => ({ outcome: "created", sessionId: SESSION_ID.toUpperCase(), maxAgeSeconds: MAX_AGE }) }, 1],
      ["publication denies a lifetime out of range before response creation", { create: () => ({ outcome: "created", sessionId: SESSION_ID, maxAgeSeconds: 0 }) }, 0],
      ["the response throws on its first header", { responseFailsOn: { header: 1 } }, 1],
      ["the response throws on its first cookie", { responseFailsOn: { cookie: 1 } }, 1],
      ["the response throws on its second cookie, after the first was set", { responseFailsOn: { cookie: 2 } }, 1],
    ];
    for (const [label, script, responses] of BRANCHES) {
      const cleanup = deferred<unknown>();
      const harness = verifyHarness({ ...script, discard: () => cleanup.promise });
      let settled = false;
      const running = harness.verify().then((value) => {
        settled = true;
        return value;
      });
      await flush();
      // The cleanup has been started and is being awaited: nothing has been
      // answered, and the answer-time wait has not even been asked for.
      expect(harness.calls.discard, label).toBe(1);
      expect(settled, `${label}: answered before discard settled`).toBe(false);
      expect(harness.time.waits, label).toEqual([]);
      cleanup.resolve({ outcome: "discarded", cleanup: "failed" });
      await flush();
      expect(settled, `${label}: answered before the answer time`).toBe(false);
      expect(harness.time.waits, label).toEqual([ANSWER_AT]);
      harness.time.release();
      const result = await running;
      expect(result, label).toBe(EXPLORER_SIGN_IN_DENIED);
      expect("response" in result, label).toBe(false);
      expect(harness.calls.discard, label).toBe(1);
      expect(harness.calls.responses, label).toBe(responses);
      expect(harness.calls.create, label).toHaveLength(1);
      expect(harness.events.indexOf("discard"), label).toBeLessThan(harness.events.indexOf("wait"));
      expect(harness.events.indexOf("exchange"), label).toBeLessThan(harness.events.indexOf("discard"));
    }

    // The partial write, in detail: the first cookie was set on the response
    // the composition made, and that response never left the composition.
    const partial = verifyHarness({ responseFailsOn: { cookie: 2 } });
    const { result } = await settleThroughWait(partial.time, () => partial.verify(), true);
    expect(result).toBe(EXPLORER_SIGN_IN_DENIED);
    expect(partial.made).toHaveLength(1);
    expect(partial.made[0].cookies.map((cookie) => cookie.name)).toEqual(["solmind-auth"]);
    expect(Object.values(result)).not.toContain(partial.made[0].response);

    // A cleanup that itself rejects or throws never changes the deny.
    for (const discard of [rejecting, throwing]) {
      const harness = verifyHarness({ create: () => ({ outcome: "failed" }), discard });
      const run = await settleThroughWait(harness.time, () => harness.verify(), true);
      expect(run.result).toBe(EXPLORER_SIGN_IN_DENIED);
      expect(harness.calls.discard).toBe(1);
    }
  });

  it("ESC-008 the release is told exactly the outcome this request's one session call returned, and the session call runs at most once, only after redeemed, found, confirmed and held", async () => {
    for (const outcome of ["created", "existing"] as const) {
      const harness = verifyHarness({
        create: () => ({ outcome, sessionId: SESSION_ID, maxAgeSeconds: MAX_AGE }),
      });
      const { result } = await settleThroughWait(harness.time, () => harness.verify(), false);
      expect(result.outcome).toBe("signed_in");
      expect(harness.calls.release).toEqual([{ sessionOutcome: outcome }]);
      expect(Object.isFrozen(harness.calls.release[0])).toBe(true);
      expect(harness.calls.create).toHaveLength(1);
    }
    // No session call unless every earlier step passed.
    const earlier: ReadonlyArray<readonly [string, VerifyScript]> = [
      ["the code is refused", { redeem: () => ({ outcome: "denied" }) }],
      ["no eligible account", { lookup: () => ({ outcome: "not_found" }) }],
      ["the challenge is not the account's own", { confirm: () => ({ outcome: "not_confirmed" }) }],
      ["the exchange is denied", { exchange: () => ({ outcome: "denied" }) }],
    ];
    for (const [label, script] of earlier) {
      const harness = verifyHarness(script);
      await settleThroughWait(harness.time, () => harness.verify(), true);
      expect(harness.calls.create, label).toEqual([]);
      expect(harness.calls.release, label).toEqual([]);
      expect(harness.calls.responses, label).toBe(0);
    }
  });

  it("ESC-009 a refused code is code_not_accepted; a busy or failed redemption, and every other failure, is the generic deny; each step runs only when the one before it passed", async () => {
    type Counts = Readonly<{ lookup: number; confirm: number; exchange: number; create: number; discard: number }>;
    const NONE: Counts = { lookup: 0, confirm: 0, exchange: 0, create: 0, discard: 0 };
    const CASES: ReadonlyArray<readonly [string, VerifyScript, unknown, Counts]> = [
      ["redemption denied", { redeem: () => ({ outcome: "denied" }) }, EXPLORER_SIGN_IN_CODE_NOT_ACCEPTED, NONE],
      ["redemption refused the request", { redeem: () => ({ outcome: "invalid_request" }) }, EXPLORER_SIGN_IN_CODE_NOT_ACCEPTED, NONE],
      ["redemption busy", { redeem: () => ({ outcome: "busy" }) }, EXPLORER_SIGN_IN_DENIED, NONE],
      ["redemption failed", { redeem: () => ({ outcome: "failed" }) }, EXPLORER_SIGN_IN_DENIED, NONE],
      ["a redemption answer outside the closed set", { redeem: () => ({ outcome: "accepted" }) }, EXPLORER_SIGN_IN_DENIED, NONE],
      ["a redemption answer that is not an object", { redeem: () => undefined }, EXPLORER_SIGN_IN_DENIED, NONE],
      ["redemption throws", { redeem: throwing }, EXPLORER_SIGN_IN_DENIED, NONE],
      ["redemption rejects", { redeem: rejecting }, EXPLORER_SIGN_IN_DENIED, NONE],
      ["lookup: zero rows", { lookup: () => ({ outcome: "not_found" }) }, EXPLORER_SIGN_IN_DENIED, { ...NONE, lookup: 1 }],
      ["lookup failed", { lookup: () => ({ outcome: "failed" }) }, EXPLORER_SIGN_IN_DENIED, { ...NONE, lookup: 1 }],
      ["lookup: a row without an account UUID", { lookup: () => ({ ...FOUND, userAccountId: undefined }) }, EXPLORER_SIGN_IN_DENIED, { ...NONE, lookup: 1 }],
      ["lookup: a row without a provider user id", { lookup: () => ({ ...FOUND, providerUserId: null }) }, EXPLORER_SIGN_IN_DENIED, { ...NONE, lookup: 1 }],
      ["lookup throws", { lookup: throwing }, EXPLORER_SIGN_IN_DENIED, { ...NONE, lookup: 1 }],
      ["confirmation false", { confirm: () => ({ outcome: "not_confirmed" }) }, EXPLORER_SIGN_IN_DENIED, { ...NONE, lookup: 1, confirm: 1 }],
      ["confirmation failed", { confirm: () => ({ outcome: "failed" }) }, EXPLORER_SIGN_IN_DENIED, { ...NONE, lookup: 1, confirm: 1 }],
      ["a confirmation answer of true, not `confirmed`", { confirm: () => true }, EXPLORER_SIGN_IN_DENIED, { ...NONE, lookup: 1, confirm: 1 }],
      ["confirmation throws", { confirm: throwing }, EXPLORER_SIGN_IN_DENIED, { ...NONE, lookup: 1, confirm: 1 }],
      ["exchange denied", { exchange: () => ({ outcome: "denied" }) }, EXPLORER_SIGN_IN_DENIED, { ...NONE, lookup: 1, confirm: 1, exchange: 1 }],
      ["exchange refused the request", { exchange: () => ({ outcome: "invalid_request" }) }, EXPLORER_SIGN_IN_DENIED, { ...NONE, lookup: 1, confirm: 1, exchange: 1 }],
      ["exchange failed", { exchange: () => ({ outcome: "failed" }) }, EXPLORER_SIGN_IN_DENIED, { ...NONE, lookup: 1, confirm: 1, exchange: 1 }],
      ["exchange throws", { exchange: throwing }, EXPLORER_SIGN_IN_DENIED, { ...NONE, lookup: 1, confirm: 1, exchange: 1 }],
      ["session denied", { create: () => ({ outcome: "denied" }) }, EXPLORER_SIGN_IN_DENIED, { lookup: 1, confirm: 1, exchange: 1, create: 1, discard: 1 }],
    ];
    for (const [label, script, expected, counts] of CASES) {
      const harness = verifyHarness(script);
      const { result } = await settleThroughWait(harness.time, () => harness.verify(), true);
      // The route contract's own frozen constant: a closed, value-free set.
      expect(result, label).toBe(expected);
      expect(JSON.stringify(result), label).not.toContain(SENTINEL);
      expect(harness.calls.redeem.length === 1, `${label}: exactly one redemption call`).toBe(true);
      expect(
        {
          lookup: harness.calls.lookup.length,
          confirm: harness.calls.confirm.length,
          exchange: harness.calls.exchange.length,
          create: harness.calls.create.length,
          discard: harness.calls.discard,
        },
        label,
      ).toEqual(counts);
      expect(harness.calls.responses, label).toBe(0);
    }
  });

  it("ESC-010 every exit from the redemption call on, except signed_in, asks the waiter for the same answer time and resolves only after it is released; denials before the redemption call do not wait", async () => {
    const WAITING: ReadonlyArray<readonly [string, VerifyScript]> = [
      ["a wrong code against a real challenge, or a selector that names no row (the database gives one answer)", { redeem: () => ({ outcome: "denied" }) }],
      ["a malformed code or selector", { redeem: () => ({ outcome: "invalid_request" }) }],
      ["a busy redemption", { redeem: () => ({ outcome: "busy" }) }],
      ["a failed redemption", { redeem: () => ({ outcome: "failed" }) }],
      ["a redemption that throws", { redeem: throwing }],
      ["redeemed, then an unknown email", { lookup: () => ({ outcome: "not_found" }) }],
      ["redeemed, then another person's email", { confirm: () => ({ outcome: "not_confirmed" }) }],
      ["redeemed, then a failed exchange", { exchange: () => ({ outcome: "failed" }) }],
      ["redeemed, then a refused session", { create: () => ({ outcome: "denied" }) }],
      ["redeemed, then a refused release", { release: () => ({ outcome: "refused" }) }],
      ["redeemed, then a writer failure", { responseFailsOn: { cookie: 1 } }],
    ];
    for (const [label, script] of WAITING) {
      const harness = verifyHarness(script);
      const { result, waits } = await settleThroughWait(harness.time, () => harness.verify(), true);
      expect(result.outcome, label).not.toBe("signed_in");
      expect(waits, label).toEqual([ANSWER_AT]);
      expect(harness.events[0], label).toBe("now");
      expect(harness.events.filter((event) => event === "now").length, label).toBe(harness.calls.prepare.length > 0 ? 3 : 1);
      expect(harness.events[harness.events.length - 1], label).toBe("wait");
    }

    // Before the redemption call: no wait, and nothing after it runs.
    const BEFORE: ReadonlyArray<readonly [string, VerifyScript, Record<string, unknown>]> = [
      ["not an email", {}, { identifier: "not an email" }],
      ["a non-string identifier", {}, { identifier: null }],
      ["a configuration failure", { configure: throwing }, {}],
    ];
    for (const [label, script, overrides] of BEFORE) {
      const harness = verifyHarness(script);
      const { result, waits } = await settleThroughWait(harness.time, () => harness.verify(overrides), false);
      expect(result, label).toBe(EXPLORER_SIGN_IN_DENIED);
      expect(waits, label).toEqual([]);
      expect(harness.calls.redeem.length === 0, `${label}: no redemption call`).toBe(true);
      if ("identifier" in overrides) {
        // Text that is not an email is answered from what was typed alone:
        // the clock was read and nothing else happened, so the request's
        // dependencies were never built.
        expect(harness.events, label).toEqual(["now"]);
      }
    }

    // A success returns without the wait.
    const success = verifyHarness();
    const run = await settleThroughWait(success.time, () => success.verify(), false);
    expect(run.result.outcome).toBe("signed_in");
    expect(run.waits).toEqual([]);
  });

  it("ESC-011 the fixed values: the lookup gets `email` and the Explorer role, the redeemer and the confirmation get `login`, the session call gets the Explorer role, and every later value is the lookup's own row, whatever the request carries", async () => {
    const harness = verifyHarness();
    const { result } = await settleThroughWait(
      harness.time,
      () =>
        harness.verify({
          role: "admin",
          activeRoleContext: "guide",
          requestedRoleContext: "admin",
          identifierType: "username",
          purpose: "role_reentry",
          expectedPurpose: "role_reentry",
          userAccountId: "99999999-9999-4999-8999-999999999999",
          sessionId: "77777777-7777-4777-8777-777777777777",
          providerUserId: "66666666-6666-4666-8666-666666666666",
          email: "attacker.s68@solmind.example",
          destination: "https://attacker.example/after",
          returnTo: "//attacker.example",
        }),
      false,
    );
    expect(result.outcome).toBe("signed_in");
    expect(harness.origins).toEqual([LOOPBACK_ORIGIN]);
    expect(
      isDeepStrictEqual(harness.calls.redeem, [{ purpose: "login", challengeId: CHALLENGE_ID, code: CODE }]),
      "one redemption: the purpose `login`, this request's selector and code",
    ).toBe(true);
    expect(
      isDeepStrictEqual(harness.calls.lookup, [
        { normalizedIdentifier: EMAIL, identifierType: "email", requestedRoleContext: "explorer" },
      ]),
      "one lookup: the normalized email, the type `email` and the Explorer role",
    ).toBe(true);
    expect((harness.calls.lookup[0] as { requestedRoleContext: string }).requestedRoleContext).toBe(
      SOLMIND_ROLES.EXPLORER,
    );
    expect(harness.calls.confirm).toEqual([
      { userAccountId: ACCOUNT_ID, challengeId: CHALLENGE_ID, expectedPurpose: "login" },
    ]);
    // The exchange is made for the looked-up email and bound provider user
    // id, never the typed text.
    expect(
      isDeepStrictEqual(harness.calls.exchange, [{ email: STORED_EMAIL, boundProviderUserId: PROVIDER_ID }]),
      "one exchange: the looked-up email and the bound provider user id",
    ).toBe(true);
    expect(harness.calls.create).toEqual([
      {
        userAccountId: ACCOUNT_ID,
        activeRoleContext: SOLMIND_ROLES.EXPLORER,
        challengeId: CHALLENGE_ID,
        providerAccessTokenExpiresAt: TOKEN_EXPIRES_AT,
      },
    ]);
    for (const request of [
      harness.calls.redeem[0],
      harness.calls.lookup[0],
      harness.calls.confirm[0],
      harness.calls.exchange[0],
      harness.calls.create[0],
    ]) {
      expect(Object.isFrozen(request)).toBe(true);
    }
    // The binding cookie is the session call's UUID, not the request's.
    expect(
      harness.made[0].cookies.find((cookie) => cookie.name === "solmind-session")?.value === SESSION_ID,
      "the binding cookie is the session call's UUID",
    ).toBe(true);
  });

  it("ESC-013 a port that throws at any step after redeemed still waits until the answer time and answers the generic deny; with a hold, discard is awaited first", async () => {
    const STEPS: ReadonlyArray<readonly [string, VerifyScript, boolean]> = [
      ["the lookup", { lookup: throwing }, false],
      ["the lookup (rejects)", { lookup: rejecting }, false],
      ["the confirmation", { confirm: throwing }, false],
      ["the exchange", { exchange: throwing }, false],
      ["the session call", { create: throwing }, true],
      ["the release", { release: throwing }, true],
      ["the response function", { makeResponse: throwing }, true],
      ["the response's cookie setter", { responseFailsOn: { cookie: 1 } }, true],
    ];
    for (const [label, script, held] of STEPS) {
      // With a hold, discard stays pending until this test resolves it.
      const cleanup = deferred<unknown>();
      const harness = verifyHarness(held ? { ...script, discard: () => cleanup.promise } : script);
      let answered = false;
      const running = harness.verify().then((value) => {
        answered = true;
        return value;
      });
      if (held) {
        await flush();
        // Discard has been started and has not settled: the answer-time wait
        // has not been asked for and nothing has been answered.
        expect(harness.calls.discard === 1, "ESC-013: with a hold, discard was started exactly once").toBe(true);
        expect(
          harness.time.waits.length === 0 && !harness.time.waiting(),
          "ESC-013: while discard is pending, the answer-time wait has not been asked for",
        ).toBe(true);
        expect(answered, "ESC-013: the call settled while discard was still pending").toBe(false);
        cleanup.resolve(Object.freeze({ outcome: "discarded", cleanup: "cleaned" }));
      }
      const { result, waits } = await settleThroughWait(harness.time, () => running, true);
      expect(result, label).toBe(EXPLORER_SIGN_IN_DENIED);
      expect(waits, label).toEqual([ANSWER_AT]);
      expect(harness.calls.discard, label).toBe(held ? 1 : 0);
      if (held) {
        expect(harness.events.indexOf("discard"), label).toBeLessThan(harness.events.indexOf("wait"));
      }
      expect(harness.events[harness.events.length - 1], label).toBe("wait");
    }
  });
});

describe("explorerSignInComposition - configuration first, and the loopback rule on both routes", () => {
  it("ESC-004 a configuration failure answers the generic deny before any lookup, issuance or redemption call, on both routes, with ports faked and with the real factory", async () => {
    const send = sendHarness({ configure: throwing });
    expect(await send.send()).toBe(EXPLORER_SIGN_IN_DENIED);
    expect(send.events).toEqual(["now", "configure"]);
    expect(send.issueRequests.length === 0, "the send route made no call of the issuing caller").toBe(true);
    const verify = verifyHarness({ configure: throwing });
    expect(await verify.verify()).toBe(EXPLORER_SIGN_IN_DENIED);
    expect(verify.events).toEqual(["now", "configure"]);
    expect(verify.calls.redeem.length === 0, "the verify route made no redemption call").toBe(true);

    // The real factory: each missing or blank setting denies, and no request
    // of any kind is made.
    const realPorts = (time: ReturnType<typeof fakeTime>): ExplorerSignInPorts => ({
      ...EXPLORER_SIGN_IN_PORTS,
      now: time.now,
      waitUntil: time.waitUntil,
    });
    const BROKEN: ReadonlyArray<readonly [string, Record<string, string>, "both" | "verify"]> = [
      ["no pepper", { SOLMIND_VERIFICATION_PEPPER: "" }, "both"],
      ["a malformed pepper", { SOLMIND_VERIFICATION_PEPPER: "too-short" }, "both"],
      ["no service-role key", { SUPABASE_SERVICE_ROLE_KEY: "" }, "both"],
      ["no Supabase URL", { NEXT_PUBLIC_SUPABASE_URL: "" }, "both"],
      ["no anon key", { NEXT_PUBLIC_SUPABASE_ANON_KEY: "" }, "verify"],
      ["a blank anon key", { NEXT_PUBLIC_SUPABASE_ANON_KEY: "   " }, "verify"],
      ["an anon key with a space", { NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic key" }, "verify"],
      ["a Supabase URL that is not http", { NEXT_PUBLIC_SUPABASE_URL: "ftp://supabase.invalid" }, "verify"],
    ];
    for (const [label, overrides, scope] of BROKEN) {
      stubEnvironment(overrides);
      const { send: fetchFake } = stubFetch();
      if (scope === "both") {
        const time = fakeTime([]);
        const result = await requestExplorerSignInCode({ trustedOrigin: LOOPBACK_ORIGIN, identifier: TYPED_EMAIL }, realPorts(time));
        expect(result, `send: ${label}`).toBe(EXPLORER_SIGN_IN_DENIED);
        expect(time.waits, `send: ${label}`).toEqual([]);
      }
      const time = fakeTime([]);
      const made: unknown[] = [];
      const result = await verifyExplorerSignInCode(
        {
          trustedOrigin: LOOPBACK_ORIGIN,
          identifier: TYPED_EMAIL,
          challengeId: CHALLENGE_ID,
          code: CODE,
          requestCookies: [],
          createSuccessResponse: () => {
            made.push(null);
            return fakeResponse([]).response;
          },
        },
        realPorts(time),
      );
      expect(result, `verify: ${label}`).toBe(EXPLORER_SIGN_IN_DENIED);
      expect(time.waits, `verify: ${label}`).toEqual([]);
      expect(made, `verify: ${label}`).toEqual([]);
      await flush();
      expect(fetchFake.mock.calls.length === 0, `${label}: no request of any kind was made`).toBe(true);
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }

    // Control: with every setting present the real factory builds, and the
    // send route goes on to its lookup (the only request it then makes here).
    stubEnvironment();
    const { requests } = stubFetch(() =>
      new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const time = fakeTime([]);
    const { result } = await settleThroughWait(
      time,
      () => requestExplorerSignInCode({ trustedOrigin: LOOPBACK_ORIGIN, identifier: TYPED_EMAIL }, realPorts(time)),
      true,
    );
    expect((result as { acknowledgment: string }).acknowledgment).toBe("verification_code_requested");
    expect(
      isDeepStrictEqual(requests, [
        {
          url: `${SUPABASE_URL}/rest/v1/rpc/solmind_resolve_login_account`,
          body: {
            p_normalized_login_identifier: EMAIL,
            p_login_identifier_type: "email",
            p_requested_role_context: "explorer",
          },
        },
      ]),
      "the control: exactly one request, the account lookup with its three arguments",
    ).toBe(true);
  });

  it("ESC-005 on both routes a trusted origin that is not a loopback origin is denied before the step 5 root is called: nothing is built and nothing is sent", async () => {
    stubEnvironment();
    const { send: fetchFake } = stubFetch();
    const NOT_LOOPBACK = [
      "https://uat.solmind.example",
      "https://127.0.0.1:3000",
      "http://192.168.1.10:3000",
      "http://solmind.example",
      "http://127.0.0.1:3000/",
      "HTTP://127.0.0.1:3000",
      "not-an-origin",
      "",
    ];
    for (const origin of NOT_LOOPBACK) {
      resetBuilt();
      for (const factory of [EXPLORER_SIGN_IN_PORTS.createSendDependencies, EXPLORER_SIGN_IN_PORTS.createVerifyDependencies]) {
        let thrown: unknown = null;
        try {
          factory(origin);
        } catch (error) {
          thrown = error;
        }
        expect(thrown, origin).toBeInstanceOf(Error);
        expect((thrown as Error).message, origin).toBe(EXPLORER_SIGN_IN_DEPENDENCY_CONFIGURATION_FAILED);
      }
      // Through the composition: the generic deny, with no wait.
      const sendTime = fakeTime([]);
      expect(
        await requestExplorerSignInCode(
          { trustedOrigin: origin, identifier: TYPED_EMAIL },
          { ...EXPLORER_SIGN_IN_PORTS, now: sendTime.now, waitUntil: sendTime.waitUntil },
        ),
        origin,
      ).toBe(EXPLORER_SIGN_IN_DENIED);
      const verifyTime = fakeTime([]);
      expect(
        await verifyExplorerSignInCode(
          {
            trustedOrigin: origin,
            identifier: TYPED_EMAIL,
            challengeId: CHALLENGE_ID,
            code: CODE,
            requestCookies: [],
            createSuccessResponse: () => fakeResponse([]).response,
          },
          { ...EXPLORER_SIGN_IN_PORTS, now: verifyTime.now, waitUntil: verifyTime.waitUntil },
        ),
        origin,
      ).toBe(EXPLORER_SIGN_IN_DENIED);
      expect([...sendTime.waits, ...verifyTime.waits], origin).toEqual([]);
      // Nothing was built: not the step 5 root (and so not the local mail
      // transport), not its configuration, no client, no bridge, no caller.
      expect(
        {
          services: built.services,
          configuration: built.configuration,
          serviceRoleClients: built.serviceRoleClients,
          linkClients: built.linkClients,
          bridges: built.bridges.length,
          sessionCreators: built.sessionCreators.length,
          accountLookups: built.accountLookups.length,
          confirmations: built.confirmations.length,
        },
        origin,
      ).toEqual({
        services: 0,
        configuration: 0,
        serviceRoleClients: 0,
        linkClients: 0,
        bridges: 0,
        sessionCreators: 0,
        accountLookups: 0,
        confirmations: 0,
      });
    }
    await flush();
    expect(fetchFake.mock.calls.length === 0, "no request of any kind was made").toBe(true);

    // Controls: each loopback origin builds, so the counters above do count.
    for (const origin of ["http://127.0.0.1:3000", "http://localhost:3000", "http://[::1]:3000"]) {
      resetBuilt();
      expect(Object.keys(EXPLORER_SIGN_IN_PORTS.createSendDependencies(origin)).sort()).toEqual(["accountLookup", "issuer"]);
      expect(built.services).toBe(1);
      expect(Object.keys(EXPLORER_SIGN_IN_PORTS.createVerifyDependencies(origin)).sort()).toEqual([
        "accountLookup",
        "bridge",
        "challengeConfirmation",
        "flowResolver",
        "redeemer",
        "sessionCreator",
      ]);
      expect(built.services).toBe(2);
    }
    await flush();
    expect(fetchFake.mock.calls.length === 0, "no request of any kind was made").toBe(true);
  });
});

describe("accepted-login backstop wiring", () => {
  it("captures old credentials only for the dependency factory and prepares after acceptance, never before a denied session", async () => {
    const prior = Object.freeze({ accessToken: "synthetic-old-token", refreshToken: "synthetic-old-refresh", proof: undefined });
    const harness = verifyHarness();
    const result = await harness.verify({ priorCleanupCandidate: prior });
    expect(result.outcome).toBe("signed_in");
    expect(harness.calls.candidates[0] === prior).toBe(true);
    expect(harness.calls.prepare).toEqual([{ sessionOutcome: "created" }]);
    expect(harness.events.indexOf("prepare") > harness.events.indexOf("create") && harness.events.indexOf("prepare") < harness.events.indexOf("release:created")).toBe(true);
    expect(JSON.stringify([harness.calls.redeem, harness.calls.lookup, harness.calls.confirm, harness.calls.exchange, harness.calls.create]).includes(prior.accessToken)).toBe(false);
    const denied = verifyHarness({ create: () => ({ outcome: "denied" }) });
    const failure = await settleThroughWait(denied.time, () => denied.verify({ priorCleanupCandidate: prior }), true);
    expect(failure.result.outcome).toBe("denied");
    expect(denied.calls.prepare.length).toBe(0);
  });

  it("subtracts rounded-up monotonic cleanup time and clamps publication to fresh provider lifetime", async () => {
    for (const [elapsed, remaining, expected] of [[5001, 3600, MAX_AGE - 6], [1, 3600, MAX_AGE - 1], [0, 2.9, 2]]) {
      let clock = START;
      const harness = verifyHarness({ prepare: async () => { clock += elapsed; } });
      vi.spyOn(harness.ports, "now").mockImplementation(() => clock);
      vi.spyOn(harness.ports, "epochSeconds").mockReturnValue(TOKEN_EXPIRES_AT - remaining);
      expect((await harness.verify()).outcome).toBe("signed_in");
      const positive = harness.made[0].cookies.filter((entry) => entry.value !== "");
      expect(positive.length > 0 && positive.every((entry) =>
        typeof entry.attributes === "object" && entry.attributes !== null &&
        (entry.attributes as Record<string, unknown>).maxAge === expected)).toBe(true);
    }
  });

  it("publishes no response and discards if cleanup consumed the usable credential lifetime", async () => {
    const harness = verifyHarness();
    vi.spyOn(harness.ports, "epochSeconds").mockReturnValue(TOKEN_EXPIRES_AT);
    const result = await settleThroughWait(harness.time, () => harness.verify(), true);
    expect(result.result.outcome).toBe("denied");
    expect(harness.calls.prepare.length).toBe(1);
    expect(harness.calls.release.length).toBe(0);
    expect(harness.calls.responses).toBe(0);
    expect(harness.calls.discard).toBe(1);
  });

  it("keeps verify construction available when optional old-session cleanup configuration is unsupported", () => {
    stubEnvironment();
    const network = stubFetch();
    const dependencies = EXPLORER_SIGN_IN_PORTS.createVerifyDependencies(LOOPBACK_ORIGIN, { accessToken: "synthetic-old", refreshToken: "synthetic-refresh", proof: undefined });
    expect(dependencies.bridge !== undefined).toBe(true);
    expect(network.send.mock.calls.length).toBe(0);
  });
});

describe("explorerSignInDependencies - the real factory, the deadlines, the clock and the signal", () => {
  it("ESD-001 a send request builds two service-role clients and a verify request three; building opens nothing", () => {
    stubEnvironment();
    const { send: fetchFake } = stubFetch();
    const sendDependencies = EXPLORER_SIGN_IN_PORTS.createSendDependencies(LOOPBACK_ORIGIN);
    expect(Object.isFrozen(sendDependencies)).toBe(true);
    // The step 5 root's own client, and the factory's for the lookup.
    expect({
      services: built.services,
      configuration: built.configuration,
      serviceRoleClients: built.serviceRoleClients,
      linkClients: built.linkClients,
      bridges: built.bridges.length,
      sessionCreators: built.sessionCreators.length,
      accountLookups: built.accountLookups.length,
      confirmations: built.confirmations.length,
      delays: built.delays.length,
    }).toEqual({
      services: 1,
      configuration: 1,
      serviceRoleClients: 2,
      linkClients: 0,
      bridges: 0,
      sessionCreators: 0,
      accountLookups: 1,
      confirmations: 0,
      delays: 0,
    });
    resetBuilt();
    const verifyDependencies = EXPLORER_SIGN_IN_PORTS.createVerifyDependencies(LOOPBACK_ORIGIN);
    expect(Object.isFrozen(verifyDependencies)).toBe(true);
    // Those two, and the link seam's client: three with the service-role key.
    expect(built.serviceRoleClients + built.linkClients).toBe(3);
    expect({ services: built.services, serviceRoleClients: built.serviceRoleClients, linkClients: built.linkClients }).toEqual({
      services: 1,
      serviceRoleClients: 2,
      linkClients: 1,
    });
    expect(built.bridges).toHaveLength(1);
    expect(built.sessionCreators).toHaveLength(1);
    expect(built.accountLookups).toHaveLength(1);
    expect(built.confirmations).toHaveLength(1);
    expect(fetchFake.mock.calls.length === 0, "no request of any kind was made").toBe(true);
  });

  it("ESD-002 the bridge gets the auth cookie name of the same policy the writer resolves, the public settings, the provider deadline, and exactly its three dependencies; the callers get their own deadlines and the factory's one client", () => {
    stubEnvironment();
    stubFetch();
    EXPLORER_SIGN_IN_PORTS.createVerifyDependencies(LOOPBACK_ORIGIN);
    const [configuration, dependencies] = built.bridges[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(
      isDeepStrictEqual(configuration, {
        supabaseUrl: SUPABASE_URL,
        anonKey: ANON_KEY,
        authCookieName: resolveSessionCookiePolicy(LOOPBACK_ORIGIN)?.authCookieName,
        providerTimeoutMilliseconds: EXPLORER_SIGN_IN_DEADLINES.providerTimeoutMilliseconds,
        credentialPairContext: { applicationOrigin: LOOPBACK_ORIGIN, providerIssuer: `${new URL(SUPABASE_URL).origin}/auth/v1`, providerAudience: "authenticated" },
      }),
      "the bridge's configuration: the public settings, the policy's auth cookie name and the provider deadline",
    ).toBe(true);
    expect(configuration.authCookieName).toBe("solmind-auth");
    expect(Reflect.ownKeys(dependencies).sort()).toEqual(["fetch", "linkAdmin", "signalCleanupFailure"]);
    expect(Reflect.ownKeys(dependencies.linkAdmin as object)).toEqual(["generateLink"]);

    const [lookupDependencies] = built.accountLookups[0] as [Record<string, unknown>];
    const [confirmationDependencies] = built.confirmations[0] as [Record<string, unknown>];
    const [sessionDependencies] = built.sessionCreators[0] as [Record<string, unknown>];
    expect(lookupDependencies.rpcTimeoutMilliseconds).toBe(EXPLORER_SIGN_IN_DEADLINES.accountLookupTimeoutMilliseconds);
    expect(confirmationDependencies.rpcTimeoutMilliseconds).toBe(
      EXPLORER_SIGN_IN_DEADLINES.challengeConfirmationTimeoutMilliseconds,
    );
    expect(sessionDependencies.rpcTimeoutMilliseconds).toBe(EXPLORER_SIGN_IN_DEADLINES.sessionCreationTimeoutMilliseconds);
    // One client serves the two lookups and the session caller.
    expect(confirmationDependencies.rpcClient).toBe(lookupDependencies.rpcClient);
    expect(sessionDependencies.rpcClient).toBe(lookupDependencies.rpcClient);
    for (const each of [lookupDependencies, confirmationDependencies, sessionDependencies]) {
      expect(Reflect.ownKeys(each).sort()).toEqual(["rpcClient", "rpcTimeoutMilliseconds"]);
    }
  });

  it("ESD-003 the bridge's fetch reads the global at call time, and the cleanup-failure signal writes exactly one fixed line and never throws", async () => {
    stubEnvironment();
    stubFetch();
    EXPLORER_SIGN_IN_PORTS.createVerifyDependencies(LOOPBACK_ORIGIN);
    const dependencies = built.bridges[0][1] as {
      fetch: typeof fetch;
      signalCleanupFailure: (...args: unknown[]) => void;
    };
    // A fetch installed AFTER the factory ran is the one used.
    vi.unstubAllGlobals();
    const later = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", later);
    const init = { method: "POST" };
    const answer = await dependencies.fetch("http://supabase.invalid/auth/v1/logout?scope=local", init);
    expect(answer.status).toBe(204);
    expect(later.mock.calls).toEqual([["http://supabase.invalid/auth/v1/logout?scope=local", init]]);

    expect(dependencies.signalCleanupFailure(SENTINEL, new Error(SENTINEL))).toBeUndefined();
    expect(
      stderrLines.length === 1 && stderrLines[0] === EXPLORER_SIGN_IN_CLEANUP_FAILURE_SIGNAL_LINE,
      "the signal wrote exactly one fixed line to standard error",
    ).toBe(true);
    expect(EXPLORER_SIGN_IN_CLEANUP_FAILURE_SIGNAL_LINE).toBe("solmind_login_identity_cleanup_failed\n");
    vi.mocked(process.stderr.write).mockImplementation(() => {
      throw new Error(SENTINEL);
    });
    expect(() => dependencies.signalCleanupFailure()).not.toThrow();
  });

  it("ESD-004 the real clock is the monotonic clock, and the real waiter waits only the time that is left: nothing when the answer time has passed", async () => {
    // The monotonic clock is scripted, so nothing here depends on how fast
    // this computer runs.
    const clock = vi.spyOn(performance, "now");
    clock.mockReturnValue(5_000);
    expect(EXPLORER_SIGN_IN_PORTS.now()).toBe(5_000);
    clock.mockReturnValue(5_000.25);
    expect(EXPLORER_SIGN_IN_PORTS.now()).toBe(5_000.25);

    // 399.75 ms are left: the timer is asked for the next whole millisecond.
    await EXPLORER_SIGN_IN_PORTS.waitUntil(5_400);
    expect(built.delays).toEqual([400]);
    built.delays.length = 0;
    clock.mockReturnValue(5_399);
    await EXPLORER_SIGN_IN_PORTS.waitUntil(5_400);
    expect(built.delays).toEqual([1]);

    // At the answer time, or after it: no wait.
    built.delays.length = 0;
    clock.mockReturnValue(5_400);
    await EXPLORER_SIGN_IN_PORTS.waitUntil(5_400);
    await EXPLORER_SIGN_IN_PORTS.waitUntil(5_399);
    await EXPLORER_SIGN_IN_PORTS.waitUntil(0);
    await EXPLORER_SIGN_IN_PORTS.waitUntil(Number.NaN);
    await EXPLORER_SIGN_IN_PORTS.waitUntil(Number.NEGATIVE_INFINITY);
    expect(built.delays).toEqual([]);
    expect(Object.isFrozen(EXPLORER_SIGN_IN_PORTS)).toBe(true);
    expect(Object.keys(EXPLORER_SIGN_IN_PORTS).sort()).toEqual([
      "createSendDependencies",
      "createVerifyDependencies",
      "epochSeconds",
      "now",
      "waitUntil",
    ]);
  });

  function appRoot(): string {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
  }

  it("ESD-005 the session deadline exceeds every explicit lock wait counted in the current definition of the session function, found by search, comments not counted", () => {
    const DEFINITION = "create or replace function public.solmind_create_user_session(";
    const migrations = path.join(appRoot(), "supabase", "migrations");
    const definers = fs
      .readdirSync(migrations)
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .filter((name) => fs.readFileSync(path.join(migrations, name), "utf8").includes(DEFINITION));
    // More than one migration defines it; the last one is the current one.
    expect(definers.length).toBeGreaterThan(1);
    const sql = fs.readFileSync(path.join(migrations, definers[definers.length - 1]), "utf8");
    expect(sql.split(DEFINITION)).toHaveLength(2);
    const start = sql.indexOf(DEFINITION);
    const end = sql.indexOf("\n$$;", start);
    expect(end).toBeGreaterThan(start);
    const withComments = sql.slice(start, end);
    // SQL line comments are dropped before anything is counted.
    const body = withComments
      .split(/\r?\n/)
      .map((line) => {
        const at = line.indexOf("--");
        return at < 0 ? line : line.slice(0, at);
      })
      .join("\n");
    // One pattern for the three forms of an explicit lock.
    const LOCK_FORMS = /\bpg_advisory_xact_lock\b|\bfor\s+update\b|\bfor\s+share\b/gi;
    // The control for "comments not counted": the definition does name a
    // lock in a comment, which this pattern would count.
    expect((withComments.match(LOCK_FORMS) ?? []).length).toBeGreaterThan((body.match(LOCK_FORMS) ?? []).length);
    const lockTimeouts = [...body.matchAll(/set lock_timeout = '(\d+)ms'/g)].map((match) => Number(match[1]));
    expect(lockTimeouts).toEqual([2_000]);
    const locks = body.match(LOCK_FORMS) ?? [];
    expect(locks).toHaveLength(8);
    expect(EXPLORER_SIGN_IN_DEADLINES.sessionCreationTimeoutMilliseconds).toBeGreaterThan(locks.length * lockTimeouts[0]);
    expect(EXPLORER_SIGN_IN_DEADLINES.sessionCreationTimeoutMilliseconds).toBe(locks.length * lockTimeouts[0] + 2_000);
  });

  it("ESD-006 the configured response deadlines total 40 seconds, below the policy migration's 60-second minimum", () => {
    const sum =
      LOGIN_VERIFICATION_DELIVERY_SETTINGS.rpcTimeoutMilliseconds +
      EXPLORER_SIGN_IN_DEADLINES.accountLookupTimeoutMilliseconds +
      EXPLORER_SIGN_IN_DEADLINES.challengeConfirmationTimeoutMilliseconds +
      2 * EXPLORER_SIGN_IN_DEADLINES.providerTimeoutMilliseconds +
      EXPLORER_SIGN_IN_DEADLINES.sessionCreationTimeoutMilliseconds;
    expect(sum).toBe(40_000);
    // The policy's minimum, read from the migration that creates the policy.
    const policySql = fs.readFileSync(
      path.join(appRoot(), "supabase", "migrations", "20260716000000_user_session_creation_function.sql"),
      "utf8",
    );
    const initial =
      /\(\s*minimum_seconds,\s*active_seconds,\s*maximum_seconds\s*\)\s*values\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i.exec(
        policySql,
      );
    expect(initial).not.toBeNull();
    const minimumSeconds = Number((initial as RegExpExecArray)[1]);
    expect(minimumSeconds).toBe(60);
    expect(sum).toBeLessThan(minimumSeconds * 1_000);
    expect(Object.isFrozen(EXPLORER_SIGN_IN_DEADLINES)).toBe(true);
    expect(EXPLORER_SIGN_IN_DEADLINES).toEqual({
      accountLookupTimeoutMilliseconds: 3_000,
      challengeConfirmationTimeoutMilliseconds: 3_000,
      providerTimeoutMilliseconds: 5_000,
      sessionCreationTimeoutMilliseconds: 18_000,
    });
    expect(EXPLORER_SIGN_IN_RESPONSE_FLOOR_MILLISECONDS).toBe(1_500);
  });
});

describe("the Explorer sign-in routes' new files - module boundary", () => {
  const LIB_MODULES = [
    "explorerSignInComposition",
    "explorerSignInDependencies",
    "explorerSignInRouteContract",
    "loginAccountLookupCallers",
    "loginLinkAdminClient",
  ] as const;

  function sourceRoot(): string {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
  }

  function fileText(relativeToSource: string): string {
    return fs.readFileSync(path.join(sourceRoot(), ...relativeToSource.split("/")), "utf8");
  }

  // The file's code without its comments (no string in these files holds `//`).
  function codeOf(text: string): string {
    return text
      .split(/\r?\n/)
      .map((line) => {
        const at = line.indexOf("//");
        return at < 0 ? line : line.slice(0, at);
      })
      .join("\n");
  }

  function importsOf(text: string): string[] {
    const source = ts.createSourceFile("module.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const imports: string[] = [];
    source.forEachChild((node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
        imports.push(`${node.importClause?.isTypeOnly === true ? "type " : ""}${node.moduleSpecifier.text}`);
      }
    });
    return imports;
  }

  const NEW_FILES = [
    ...LIB_MODULES.map((name) => `lib/solmind/supabase/${name}.ts`),
    "app/login/explorer/send/route.ts",
    "app/login/explorer/verify/route.ts",
    "instrumentation.ts",
    "instrumentation-node.ts",
  ];

  it("ESB-001 each new lib module starts with the server-only import, and the composition and its factory import exactly what they need, the restricted core never", () => {
    for (const name of LIB_MODULES) {
      const text = fileText(`lib/solmind/supabase/${name}.ts`);
      expect(text.startsWith('import "server-only";'), name).toBe(true);
      expect(text.charCodeAt(0), name).not.toBe(0xfeff);
    }
    expect(importsOf(fileText("lib/solmind/supabase/explorerSignInComposition.ts"))).toEqual([
      "server-only",
      "../auth/loginContactNormalizer",
      "../auth/verificationChallengeCallers",
      "../roles",
      "./explorerSignInDependencies",
      "./explorerSignInRouteContract",
      "./loginCookieWriter",
    ]);
    expect(importsOf(fileText("lib/solmind/supabase/explorerSignInDependencies.ts"))).toEqual([
      "server-only",
      "node:timers/promises",
      "../auth/loginRouteConfiguration",
      "../auth/sessionCookiePolicy",
      "../auth/verificationChallengeComposition",
      "./loginAccountLookupCallers",
      "./loginIdentityBridge",
      "./loginLinkAdminClient",
      "./logoutDependencies",
      "./credentialPairProof",
      "./requestAuthClient",
      "./serviceRoleClient",
      "./userSessionCreationCaller",
    ]);
    for (const file of NEW_FILES) {
      expect(fileText(file), file).not.toContain("verificationChallengeCallersCore");
    }
  });

  it("ESB-002 no new lib module imports a Next.js module, logs or reads a cookie, and the two route files export only POST and dynamic", () => {
    for (const name of LIB_MODULES) {
      const code = codeOf(fileText(`lib/solmind/supabase/${name}.ts`));
      expect(code, name).not.toMatch(/from\s+["']next\/|["']next["']|console\.|cookies\s*\(|["']use server["']|import\.meta|localStorage|sessionStorage|document\.cookie/);
    }
    // The composition itself: no environment, no fetch, no clock or timer of
    // its own (it takes the clock and the waiter as ports), no randomness.
    const composition = codeOf(fileText("lib/solmind/supabase/explorerSignInComposition.ts"));
    expect(composition).not.toMatch(/process\.|\bfetch\s*\(|performance\.|Date\.|setTimeout|setInterval|Math\.random|randomUUID|\.rpc\s*\(|@supabase/);
    // The purpose `login` with null UUIDs appears nowhere: the spare request
    // is the empty object, and the real request takes both UUIDs from the row.
    expect(composition).not.toMatch(/userAccountId:\s*null|userContactMethodId:\s*null/);
    expect(composition).toMatch(/EXPLORER_SIGN_IN_SPARE_SELECTOR_REQUEST = Object\.freeze\(\s*\{\},?\s*\) as unknown as/);

    // Every runtime value a file exports, in the file's order: a function, a
    // variable, a class, an enum, a namespace or an exported import alias by
    // its name, a default export as `default`, and any export declaration or
    // export assignment as `export-declaration`. A type alias or an interface
    // is not a runtime value and is not listed.
    const runtimeExportsOf = (text: string): string[] => {
      const source = ts.createSourceFile("route.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const exported: string[] = [];
      source.forEachChild((node) => {
        if (
          (ts.isFunctionDeclaration(node) ||
            ts.isVariableStatement(node) ||
            ts.isClassDeclaration(node) ||
            ts.isEnumDeclaration(node) ||
            ts.isModuleDeclaration(node) ||
            ts.isImportEqualsDeclaration(node)) &&
          node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
        ) {
          if (node.modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)) {
            exported.push("default");
          } else if (ts.isVariableStatement(node)) {
            for (const declaration of node.declarationList.declarations) {
              exported.push(declaration.name.getText(source));
            }
          } else {
            exported.push(node.name?.text ?? "");
          }
        } else if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
          exported.push("export-declaration");
        }
      });
      return exported;
    };
    // The reader itself, on a synthetic file: it lists every kind of runtime
    // export, a class and an enum included, and no type.
    expect(
      isDeepStrictEqual(
        runtimeExportsOf(
          [
            "export function a() {}",
            "export const b = 1, c = 2;",
            "export class D {}",
            "export enum E {}",
            "export namespace F { export const g = 1; }",
            "export default class {}",
            'export { h } from "./h";',
            "export type T = string;",
            "export interface I {}",
            "function local() {}",
            "class Local {}",
          ].join("\n"),
        ),
        ["a", "b", "c", "D", "E", "F", "default", "export-declaration"],
      ),
      "ESB-002: the export reader lists each runtime export of a synthetic file, classes and enums included",
    ).toBe(true);

    for (const route of ["send", "verify"] as const) {
      const text = fileText(`app/login/explorer/${route}/route.ts`);
      const exported = runtimeExportsOf(text);
      expect(exported.sort(), route).toEqual(["POST", "dynamic"]);
      expect(codeOf(text), route).toContain('export const dynamic = "force-dynamic";');
      expect(codeOf(text), route).not.toMatch(/console\.|process\.|\bfetch\s*\(|import\.meta/);
    }
    // Only the verify route reads the request's cookies, and it hands on
    // names with empty values.
    expect(codeOf(fileText("app/login/explorer/send/route.ts"))).not.toMatch(/cookies|next\/headers/);
    const verifyRoute = codeOf(fileText("app/login/explorer/verify/route.ts"));
    expect(verifyRoute).toContain('.map((cookie) => ({ name: cookie.name, value: "" }))');
    expect(verifyRoute).not.toMatch(/cookie\.value/);
  });

  it("ESB-003 the text process.env appears in no new file except the dependency factory (the two public names only, read inside a function) and the start hook (the runtime name only)", () => {
    for (const file of NEW_FILES) {
      const text = fileText(file);
      const uses = text.match(/process\.env[^\s;,)]*/g) ?? [];
      if (file === "lib/solmind/supabase/explorerSignInDependencies.ts") {
        expect(uses).toEqual(["process.env[REQUEST_AUTH_URL_ENV]", "process.env[REQUEST_AUTH_ANON_KEY_ENV]"]);
      } else if (file === "instrumentation.ts") {
        expect(codeOf(text).match(/process\.env[^\s;,)]*/g)).toEqual(["process.env.NEXT_RUNTIME"]);
      } else {
        expect(uses, file).toEqual([]);
      }
    }
    // Both reads sit inside one function body, so loading the module reads
    // nothing: with no setting at all, the import above already succeeded,
    // and the factory, not the import, is what fails.
    const factory = fileText("lib/solmind/supabase/explorerSignInDependencies.ts");
    const reader = factory.slice(factory.indexOf("function readPublicSupabaseSettings()"));
    const readerBody = reader.slice(0, reader.indexOf("\n}\n"));
    expect(readerBody.match(/process\.env/g)).toHaveLength(2);
    expect(factory.match(/process\.env/g)).toHaveLength(2);
    stubEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      SOLMIND_VERIFICATION_PEPPER: "",
    });
    stubFetch();
    expect(() => EXPLORER_SIGN_IN_PORTS.createVerifyDependencies(LOOPBACK_ORIGIN)).toThrow(
      EXPLORER_SIGN_IN_DEPENDENCY_CONFIGURATION_FAILED,
    );
    expect(codeOf(factory)).not.toMatch(/console\./);
    expect(codeOf(factory).match(/process\.stderr\.write\([^)]*\)/g)).toEqual([
      "process.stderr.write(EXPLORER_SIGN_IN_CLEANUP_FAILURE_SIGNAL_LINE)",
      "process.stderr.write(EXPLORER_SIGN_IN_PRIOR_CLEANUP_FAILURE_SIGNAL_LINE)",
    ]);
  });

  it("ESB-004 neither the composition nor its factory is exported from the three barrels `lib/solmind/auth/index.ts`, `lib/solmind/context/index.ts` and `lib/solmind/supabase/index.ts`, and each exports only its named runtime values", () => {
    for (const exportedName of [...Object.keys(compositionModule), ...Object.keys(dependenciesModule)]) {
      expect(exportedName in authBarrel, exportedName).toBe(false);
      expect(exportedName in supabaseBarrel, exportedName).toBe(false);
      expect(exportedName in contextBarrel, exportedName).toBe(false);
    }
    const root = sourceRoot();
    for (const barrel of [
      path.join(root, "lib", "solmind", "auth", "index.ts"),
      path.join(root, "lib", "solmind", "context", "index.ts"),
      path.join(root, "lib", "solmind", "supabase", "index.ts"),
    ]) {
      const text = fs.readFileSync(barrel, "utf8");
      for (const name of LIB_MODULES) {
        expect(text, `${barrel} names ${name}`).not.toContain(name);
      }
    }
    expect(Object.keys(compositionModule).sort()).toEqual(
      ["EXPLORER_SIGN_IN_SPARE_SELECTOR_REQUEST", "requestExplorerSignInCode", "verifyExplorerSignInCode"].sort(),
    );
    expect(Object.keys(dependenciesModule).sort()).toEqual(
      [
        "EXPLORER_SIGN_IN_CLEANUP_FAILURE_SIGNAL_LINE",
        "EXPLORER_SIGN_IN_PRIOR_CLEANUP_FAILURE_SIGNAL_LINE",
        "EXPLORER_SIGN_IN_DEADLINES",
        "EXPLORER_SIGN_IN_DEPENDENCY_CONFIGURATION_FAILED",
        "EXPLORER_SIGN_IN_PORTS",
        "EXPLORER_SIGN_IN_RESPONSE_FLOOR_MILLISECONDS",
      ].sort(),
    );
  });
});


// Item17 server composition variants only: public flow stays independent of
// actual issuance, and one resolved private candidate enters the factor chain.
describe("Explorer login-flow server branch", () => {
  const flowId = "6f170000-0000-4000-8000-000000000001";
  it("echoes the same flow for every lookup/issuance status without exposing private candidate IDs", async () => {
    for (const script of [ {}, { lookup: () => ({ outcome: "not_found" }) },
      { lookup: throwing }, { issue: () => ({ outcome: "denied", challengeId: CHALLENGE_ID }) }, { issue: throwing }]) {
      const h = sendHarness(script);
      const { result, waits } = await settleThroughWait(h.time, () => h.send(TYPED_EMAIL, { flowId }), true);
      expect(result).toEqual({ acknowledgment: "verification_code_requested", flowId });
      expect(Object.isFrozen(result)).toBe(true); expect(waits).toEqual([ANSWER_AT]);
      expect(h.issueRequests[0]).toBe(EXPLORER_SIGN_IN_SPARE_SELECTOR_REQUEST);
      if (h.issueRequests.length === 2) expect(h.issueRequests[1]).toEqual({ purpose: "login", contactMethodType: "email",
        normalizedContact: STORED_EMAIL, userAccountId: ACCOUNT_ID, userContactMethodId: CONTACT_ID,
        loginFlow: { flowId, roleContext: "explorer" } });
    }
  });
  function runFlow(h: ReturnType<typeof verifyHarness>, resolver: unknown, extra: Record<string, unknown> = {}) {
    const ports: ExplorerSignInPorts = { ...h.ports, createVerifyDependencies(origin, candidate) {
      return { ...h.ports.createVerifyDependencies(origin, candidate), ...(resolver === undefined ? {} : { flowResolver: resolver }) } as ExplorerSignInVerifyDependencies;
    } };
    return verifyExplorerSignInCode({ trustedOrigin: LOOPBACK_ORIGIN, identifier: TYPED_EMAIL, flowId, code: CODE,
      requestCookies: [], createSuccessResponse: () => fakeResponse(h.events).response, ...extra } as Parameters<typeof verifyExplorerSignInCode>[0], ports);
  }
  it("looks up/resolves once before redemption, then uses the actual ID through confirmation/session without another account lookup", async () => {
    const h = verifyHarness(); const resolutions: unknown[] = [];
    const result = await runFlow(h, { resolve: async (request: unknown) => { h.events.push("flow"); resolutions.push(request);
      return { outcome: "found", challengeId: CHALLENGE_ID }; } });
    expect(result.outcome).toBe("signed_in");
    expect(h.events.filter(x => ["lookup", "flow", "redeem", "confirm", "exchange", "create"].includes(x))).toEqual([
      "lookup", "flow", "redeem", "confirm", "exchange", "create"]);
    expect(resolutions).toEqual([{ flowId, userAccountId: ACCOUNT_ID, userContactMethodId: CONTACT_ID, roleContext: "explorer" }]);
    expect(h.calls.lookup).toHaveLength(1);
    expect(h.calls.redeem).toEqual([{ purpose: "login", challengeId: CHALLENGE_ID, code: CODE }]);
    expect(h.calls.confirm).toEqual([{ userAccountId: ACCOUNT_ID, challengeId: CHALLENGE_ID, expectedPurpose: "login" }]);
    expect(h.calls.create).toEqual([{ userAccountId: ACCOUNT_ID, activeRoleContext: "explorer", challengeId: CHALLENGE_ID,
      providerAccessTokenExpiresAt: TOKEN_EXPIRES_AT }]);
  });
  it("refuses absent/foreign/expired/failed mappings before redemption or provider and never tries another candidate", async () => {
    for (const resolver of [undefined, { resolve: async () => ({ outcome: "not_found" }) },
      { resolve: async () => ({ outcome: "failed" }) }, { resolve: async () => { throw new Error(SENTINEL); } }]) {
      const h = verifyHarness(); let calls = 0;
      const port = resolver === undefined ? undefined : { resolve: async () => { calls++; return resolver.resolve(); } };
      const { result, waits } = await settleThroughWait(h.time, () => runFlow(h, port), true);
      expect(result.outcome === "denied" || result.outcome === "code_not_accepted").toBe(true);
      expect(h.calls.redeem).toHaveLength(0); expect(h.calls.exchange).toHaveLength(0); expect(h.calls.create).toHaveLength(0);
      expect(calls).toBeLessThanOrEqual(1); expect(waits).toEqual([ANSWER_AT]);
    }
  });
  it("refuses malformed/nil/mixed flow selectors before dependency construction", async () => {
    for (const bad of [flowId + "\n", "00000000-0000-0000-0000-000000000000"]) {
      const send = sendHarness(); expect(await send.send(TYPED_EMAIL, { flowId: bad })).toEqual({ outcome: "denied" });
      expect(send.issueRequests).toHaveLength(0); expect(send.lookupRequests).toHaveLength(0);
      const h = verifyHarness(); expect(await runFlow(h, undefined, { flowId: bad })).toEqual({ outcome: "denied" });
      expect(h.origins).toHaveLength(0);
    }
    const h = verifyHarness(); expect(await runFlow(h, undefined, { challengeId: CHALLENGE_ID })).toEqual({ outcome: "denied" });
    expect(h.origins).toHaveLength(0);
  });
  it("real verify factory wires one bounded flow resolver over its existing service client without constructing another client", async () => {
    stubEnvironment(); const edge = stubFetch(() => new Response(JSON.stringify([{ outcome: "found", verification_challenge_id: CHALLENGE_ID }]),
      { headers: { "content-type": "application/json" } }));
    const dependencies = EXPLORER_SIGN_IN_PORTS.createVerifyDependencies(LOOPBACK_ORIGIN);
    expect(dependencies.flowResolver).toBeDefined();
    expect(await dependencies.flowResolver!.resolve({ flowId, userAccountId: ACCOUNT_ID, userContactMethodId: CONTACT_ID, roleContext: "explorer" })).toEqual({ outcome: "found", challengeId: CHALLENGE_ID });
    expect(edge.requests).toHaveLength(1); expect(edge.requests[0].url).toContain("/rest/v1/rpc/solmind_resolve_login_flow_challenge");
    expect(edge.requests[0].body).toEqual({ p_login_flow_id: flowId, p_user_account_id: ACCOUNT_ID,
      p_user_contact_method_id: CONTACT_ID, p_role_context: "explorer" });
    expect(built.serviceRoleClients).toBe(2); expect(built.linkClients).toBe(1);
  });
});
