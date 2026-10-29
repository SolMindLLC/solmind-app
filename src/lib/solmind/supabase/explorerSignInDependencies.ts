import "server-only";

import { setTimeout as delay } from "node:timers/promises";

import { loadLoginVerificationConfiguration } from "../auth/loginRouteConfiguration";
import { resolveSessionCookiePolicy, type SessionCookiePolicy } from "../auth/sessionCookiePolicy";
import {
  createVerificationChallengeServices,
  type VerificationChallengeServices,
} from "../auth/verificationChallengeComposition";
import {
  createLoginAccountLookup,
  createLoginFlowChallengeResolver,
  createRedeemedLoginChallengeConfirmation,
  type LoginAccountLookup,
  type LoginFlowChallengeResolver,
  type RedeemedLoginChallengeConfirmation,
} from "./loginAccountLookupCallers";
import {
  createLoginIdentityBridge,
  type LoginIdentityBridge,
  type LoginIdentityHold,
} from "./loginIdentityBridge";
import { createLoginLinkAdminClient } from "./loginLinkAdminClient";
import { createLogoutProviderCleanupDependencies } from "./logoutDependencies";
import { type CredentialPairIdentity } from "./credentialPairProof";
import { REQUEST_AUTH_ANON_KEY_ENV, REQUEST_AUTH_URL_ENV } from "./requestAuthClient";
import { createServiceRoleClient } from "./serviceRoleClient";
import { createUserSessionCreator, type UserSessionCreator } from "./userSessionCreationCaller";

// Login step 6, sub-slice S6-8: the request-scoped dependency factory of the
// two Explorer sign-in routes. It builds, once per request, the real pieces
// the composition beside it runs: login step 5's issuing and redeeming
// services, the two sign-in lookups, the Supabase identity bridge and the
// session caller, with the clock and the waiter the composition uses.
//
// Source of truth: solmind-docs
// `execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`
// (contract 25), accepted by Paul on 2026-10-04 (AUTH-RLS-DEC-043), Sections
// 4, 6 and 12, and
// `execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md`
// (contract 21) Sections 7.1.3 and 7.9.
//
// Configuration first. Each factory builds everything that can fail on
// configuration before it returns, and so before the composition makes its
// first database call. A configuration fault therefore never spends a code,
// a budget slot or an attempt. In order:
//   1. the session-cookie policy, resolved from the trusted origin the route
//      loaded. No policy is a configuration failure (contract 25 Section 4);
//   2. the loopback rule (below);
//   3. login step 5's configuration (the pepper and the fixed local delivery
//      settings) and its composition root, which builds the issuing and
//      redeeming services over its own service-role client and the local
//      development mail transport;
//   4. one more service-role client, for the two sign-in lookups and, on the
//      verify route, the session caller. The step 5 root keeps its own
//      client to itself;
//   5. on the verify route only: the Supabase URL and anon key, the link
//      seam's client, the identity bridge and the session caller.
// Building these opens no connection. Any failure becomes one fixed,
// value-free error; the underlying error is dropped unread, so no
// environment value, key or dependency message reaches a route. The
// composition answers its generic deny for it (contract 25 Section 12: "The
// same-origin guard or configuration fails: none written; no code issued;
// the generic deny").
//
// The loopback rule, on both routes. Login step 6's route configuration
// (sub-slice S6-1) points at the local mail catcher and requires that the
// route composition "must not compose the local transport unless the trusted
// origin is a loopback origin". The step 5 root always composes that
// transport, for the issuer and the redeemer together, so both factories
// refuse any origin whose policy is not the loopback one before that root is
// called. Until a provider adapter exists, both routes deny on a hosted
// origin.
//
// How many service-role clients one request builds. A send request builds
// two (the step 5 root's and this factory's), both through the banked
// service-role client factory. A verify request builds three: those two, and
// the link seam's, from the link client module beside this one.
//
// The deadlines and the response floor are fixed here, reviewed with the
// code, not read from the environment. The only environment values this
// module reads are the Supabase URL and the anon key, by their two exported
// public names, when a verify factory is called and never when the module
// loads.
// The optional pair/backstop context and separately loaded dedicated MAC key
// add no fresh-login authority. Unsupported optional configuration skips those
// facilities, preserving the bridge's existing ordinary login validation.
//
// The clock and the waiter. `now` is the monotonic clock. `waitUntil`
// resolves at the given monotonic time, or at once when that time has
// passed. The composition uses them for the one earliest answer time of each
// route; see its module comment for what that floor does and does not hide.
// epochSeconds is a separate injectable wall clock used only to clamp cookie
// publication to the fresh token lifetime after optional residual cleanup.
//
// The cleanup-failure signal. No operational alarm sink exists yet (backlog
// item 54). The bridge's injected signal is one function that writes one
// fixed line to standard error. The line is a constant: it never carries a
// value, an identifier or an error object, and a failed write is dropped.
//
// Called by login step 6's Explorer sign-in routes (S6-8), through the
// composition beside this module. Keep it server-only, direct-import only
// and off every barrel.

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: explorerSignInDependencies must not be imported in browser code.",
  );
}

// Caller response deadlines, in milliseconds. Each is the time a caller
// waits for an answer, not a limit on the call itself.
//   - the two lookups: each is one STABLE read with no lock of its own;
//   - the provider deadline bounds the link request and the exchange, each
//     once, and each cleanup request;
//   - the session call: the current definition of the session function sets
//     `lock_timeout` to 2,000 ms and has eight statements that take an
//     explicit lock, counting every statement in the function body that
//     takes one in any of three forms (`pg_advisory_xact_lock`, `for update`
//     or `for share`). Each may wait up to that timeout, so the deadline is
//     8 x 2,000 ms plus the 2,000 ms margin sub-slice S6-1 used. A test
//     reads the current migration and fails if the deadline no longer
//     exceeds the count times the timeout. This is not a bound on the true
//     worst case: one of those statements locks rows of two tables and may
//     wait more than once, and other waiting, execution, transport and
//     scheduling delays can still cause a committed session call to be
//     reported as failed.
// The configured response deadlines from redemption through the session
// call sum to 40,000 ms. This is not a wall-clock ceiling: scheduling can
// delay observation of a deadline, and failure cleanup can add further
// provider waits. The test checks only that the configured sum is below
// the freshness policy's 60-second minimum.
export const EXPLORER_SIGN_IN_DEADLINES: Readonly<{
  accountLookupTimeoutMilliseconds: number;
  challengeConfirmationTimeoutMilliseconds: number;
  providerTimeoutMilliseconds: number;
  sessionCreationTimeoutMilliseconds: number;
}> = Object.freeze({
  accountLookupTimeoutMilliseconds: 3_000,
  challengeConfirmationTimeoutMilliseconds: 3_000,
  providerTimeoutMilliseconds: 5_000,
  sessionCreationTimeoutMilliseconds: 18_000,
});

// DECIDED by Paul on 2026-10-07 (morning check-in packet, item 5, option 1):
// "a fixed wait of about one and a half seconds, set from the first local
// run. Accept the three limits for the local demo, and record them." Record:
// `solmind-sprints/PRJ01-SPR001/Decision_Queue/Current_Action_Queue.md`,
// "The 2026-10-07 check-in: answered (first seen by the 11:30:10 clock
// read)". This constant is that wait: the floor, in milliseconds, that both
// routes ask the waiter for, measured from composition entry. Earlier
// refusals do not wait; waiter failure can return early. Still open: the
// exact value. 1,500 is this module's number for "about one and a half
// seconds" until the first local run, which has not happened, sets it.
export const EXPLORER_SIGN_IN_RESPONSE_FLOOR_MILLISECONDS = 1_500;

// The one fixed line of the bridge's cleanup-failure signal.
export const EXPLORER_SIGN_IN_CLEANUP_FAILURE_SIGNAL_LINE =
  "solmind_login_identity_cleanup_failed\n" as const;
export const EXPLORER_SIGN_IN_PRIOR_CLEANUP_FAILURE_SIGNAL_LINE =
  "solmind_login_prior_session_cleanup_failed\n" as const;

// The one fixed, value-free error of both factories.
export const EXPLORER_SIGN_IN_DEPENDENCY_CONFIGURATION_FAILED =
  "SolMind Explorer sign-in dependencies are unavailable." as const;

export type ExplorerSignInIssuer = VerificationChallengeServices["issuer"];
export type ExplorerSignInRedeemer = VerificationChallengeServices["redeemer"];
export type ExplorerSignInIdentityHold = LoginIdentityHold;
export type ExplorerSignInPriorCleanupCandidate = Readonly<{ accessToken: string; refreshToken: string; proof: unknown }>;

export type ExplorerSignInSendDependencies = Readonly<{
  issuer: ExplorerSignInIssuer;
  accountLookup: LoginAccountLookup;
}>;

export type ExplorerSignInVerifyDependencies = Readonly<{
  redeemer: ExplorerSignInRedeemer;
  accountLookup: LoginAccountLookup;
  challengeConfirmation: RedeemedLoginChallengeConfirmation;
  bridge: LoginIdentityBridge;
  sessionCreator: UserSessionCreator;
  flowResolver?: LoginFlowChallengeResolver;
}>;

// The optional flow resolver preserves existing legacy fixture composition;
// the real verify factory always wires it once over its existing lookup client
// and account-lookup deadline. It opens nothing and adds no credential source.
// What the composition is given. The two factories throw the one fixed error
// above; nothing else here throws.
export type ExplorerSignInPorts = Readonly<{
  now(): number;
  epochSeconds(): number;
  waitUntil(answerAt: number): Promise<void>;
  createSendDependencies(trustedOrigin: string): ExplorerSignInSendDependencies;
  createVerifyDependencies(trustedOrigin: string, priorCleanupCandidate?: ExplorerSignInPriorCleanupCandidate | null): ExplorerSignInVerifyDependencies;
}>;

// The monotonic clock, in milliseconds.
function monotonicNow(): number {
  return performance.now();
}

function epochSeconds(): number {
  return Date.now() / 1000;
}

// Resolves at the given monotonic time, or at once when it has passed.
async function waitUntil(answerAt: number): Promise<void> {
  const remaining = answerAt - performance.now();
  if (remaining > 0) {
    await delay(Math.ceil(remaining));
  }
}

// The bridge's cleanup-failure signal: one fixed line, never a value.
function signalCleanupFailure(): void {
  try {
    process.stderr.write(EXPLORER_SIGN_IN_CLEANUP_FAILURE_SIGNAL_LINE);
  } catch {
    // Dropped unread: the signal never affects an outcome.
  }
}

function signalPriorCleanupFailure(): void {
  try { process.stderr.write(EXPLORER_SIGN_IN_PRIOR_CLEANUP_FAILURE_SIGNAL_LINE); }
  catch { /* Fixed, best-effort report; no notification claim or login effect. */ }
}

// The bridge's own transport: the global `fetch`, read at call time, never a
// reference captured when this module loads.
const sendThroughGlobalFetch: typeof fetch = (input, init) => fetch(input, init);

// The loopback rule: the policy of a loopback trusted origin, or a throw.
function requireLoopbackPolicy(trustedOrigin: string): SessionCookiePolicy {
  const policy = resolveSessionCookiePolicy(trustedOrigin);
  if (policy === null || policy.environment !== "loopback") {
    throw new Error(EXPLORER_SIGN_IN_DEPENDENCY_CONFIGURATION_FAILED);
  }
  return policy;
}

// The Supabase URL and the anon key, by their two public names. Missing or
// blank is a configuration failure; the error names no value.
function readPublicSupabaseSettings(): Readonly<{ supabaseUrl: string; anonKey: string }> {
  const supabaseUrl = process.env[REQUEST_AUTH_URL_ENV];
  const anonKey = process.env[REQUEST_AUTH_ANON_KEY_ENV];
  if (
    supabaseUrl === undefined ||
    supabaseUrl.trim().length === 0 ||
    anonKey === undefined ||
    anonKey.trim().length === 0
  ) {
    throw new Error(EXPLORER_SIGN_IN_DEPENDENCY_CONFIGURATION_FAILED);
  }
  return Object.freeze({ supabaseUrl, anonKey });
}

// The send route's dependencies. Throws the one fixed error on any failure.
function createExplorerSignInSendDependencies(
  trustedOrigin: string,
): ExplorerSignInSendDependencies {
  try {
    requireLoopbackPolicy(trustedOrigin);
    const services = createVerificationChallengeServices(loadLoginVerificationConfiguration());
    const rpcClient = createServiceRoleClient();
    const accountLookup = createLoginAccountLookup({
      rpcClient,
      rpcTimeoutMilliseconds: EXPLORER_SIGN_IN_DEADLINES.accountLookupTimeoutMilliseconds,
    });
    return Object.freeze({ issuer: services.issuer, accountLookup });
  } catch {
    // Dropped unread: an environment, client or dependency error must not
    // reach a route.
    throw new Error(EXPLORER_SIGN_IN_DEPENDENCY_CONFIGURATION_FAILED);
  }
}

// The verify route's dependencies. Throws the one fixed error on any failure.
function createExplorerSignInVerifyDependencies(
  trustedOrigin: string,
  priorCleanupCandidate?: ExplorerSignInPriorCleanupCandidate | null,
): ExplorerSignInVerifyDependencies {
  try {
    const policy = requireLoopbackPolicy(trustedOrigin);
    const services = createVerificationChallengeServices(loadLoginVerificationConfiguration());
    const rpcClient = createServiceRoleClient();
    const accountLookup = createLoginAccountLookup({
      rpcClient,
      rpcTimeoutMilliseconds: EXPLORER_SIGN_IN_DEADLINES.accountLookupTimeoutMilliseconds,
    });
    const flowResolver = createLoginFlowChallengeResolver({
      rpcClient, rpcTimeoutMilliseconds: EXPLORER_SIGN_IN_DEADLINES.accountLookupTimeoutMilliseconds,
    });
    const challengeConfirmation = createRedeemedLoginChallengeConfirmation({
      rpcClient,
      rpcTimeoutMilliseconds: EXPLORER_SIGN_IN_DEADLINES.challengeConfirmationTimeoutMilliseconds,
    });
    const { supabaseUrl, anonKey } = readPublicSupabaseSettings();
    const linkAdmin = createLoginLinkAdminClient();
    // Optional cleanup cannot prevent fresh authentication. The only old
    // credential captured for this backstop is its access token. The adapter
    // independently verifies it and refuses same-session/different-account
    // targets; it never receives the fresh token or a cookie capability.
    let cleanupPriorSession: ((fresh: CredentialPairIdentity) => Promise<void>) | undefined;
    try {
      if (priorCleanupCandidate !== undefined && priorCleanupCandidate !== null) {
        const prior = Object.freeze({ accessToken: priorCleanupCandidate.accessToken });
        const cleanup = createLogoutProviderCleanupDependencies({ trustedOrigin, policy });
        if (cleanup !== undefined) cleanupPriorSession = async (fresh) => {
          // The hold owns the single report, including its own timeout. No
          // late completion can produce a duplicate signal or change login.
          if (await cleanup.cleanupPrevious(prior, fresh) === "failed") {
            throw new Error("solmind_prior_cleanup_failed");
          }
        };
      }
    } catch {
      cleanupPriorSession = undefined;
    }
    // The auth cookie name comes from the same policy the cookie writer
    // resolves from this trusted origin, so the bridge holds exactly the
    // names the writer accepts.
    const bridge = createLoginIdentityBridge(
      {
        supabaseUrl,
        anonKey,
        authCookieName: policy.authCookieName,
        providerTimeoutMilliseconds: EXPLORER_SIGN_IN_DEADLINES.providerTimeoutMilliseconds,
        credentialPairContext: {
          applicationOrigin: trustedOrigin,
          providerIssuer: `${new URL(supabaseUrl).origin}/auth/v1`,
          providerAudience: "authenticated",
        },
      },
      { fetch: sendThroughGlobalFetch, linkAdmin, signalCleanupFailure,
        ...(cleanupPriorSession === undefined ? {} : { cleanupPriorSession, signalPriorCleanupFailure }) },
    );
    const sessionCreator = createUserSessionCreator({
      rpcClient,
      rpcTimeoutMilliseconds: EXPLORER_SIGN_IN_DEADLINES.sessionCreationTimeoutMilliseconds,
    });
    return Object.freeze({
      redeemer: services.redeemer,
      accountLookup,
      challengeConfirmation,
      bridge,
      sessionCreator,
      flowResolver,
    });
  } catch {
    // Dropped unread: an environment, client or dependency error must not
    // reach a route.
    throw new Error(EXPLORER_SIGN_IN_DEPENDENCY_CONFIGURATION_FAILED);
  }
}

// The real ports, built once when this module loads. Building them reads no
// setting and opens nothing; each factory does its work when it is called.
export const EXPLORER_SIGN_IN_PORTS: ExplorerSignInPorts = Object.freeze({
  now: monotonicNow,
  epochSeconds,
  waitUntil,
  createSendDependencies: createExplorerSignInSendDependencies,
  createVerifyDependencies: createExplorerSignInVerifyDependencies,
});
