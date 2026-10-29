import "server-only";

import { setTimeout as delay } from "node:timers/promises";
import { loadTrustedApplicationOrigin } from "../auth/trustedApplicationOrigin";
import { resolveSessionCookiePolicy } from "../auth/sessionCookiePolicy";
import { loadLoginVerificationConfiguration } from "../auth/loginRouteConfiguration";
import { createVerificationChallengeServices } from "../auth/verificationChallengeComposition";
import { createServiceRoleClient } from "./serviceRoleClient";
import { createLoginAccountLookup, createLoginChallengeOwnershipCheck,
  createLoginPasswordFailureRecorder, createLoginFlowChallengeResolver, createRedeemedLoginChallengeConfirmation } from "./loginAccountLookupCallers";
import { createLoginIdentityBridge } from "./loginIdentityBridge";
import { createUserSessionCreator } from "./userSessionCreationCaller";
import { createLogoutProviderCleanupDependencies } from "./logoutDependencies";
import { REQUEST_AUTH_URL_ENV, REQUEST_AUTH_ANON_KEY_ENV } from "./requestAuthClient";
import type { CredentialPairIdentity } from "./credentialPairProof";
import type { PasswordRoleSignInHttpPorts } from "./passwordRoleSignInHttpHandlers";
import type { PasswordRoleSignInPorts, PasswordRoleSendDependencies,
  PasswordRoleVerifyDependencies } from "./passwordRoleSignInCore";

// Server composition reused by the connected Guide candidate; Admin has no routes.
// Operational values
// are required inputs, not new defaults or acceptance of timing/capacity risk.
// All required configuration is resolved before the core's first remote call.
// Old credentials are cleanup-only; the current bridge owns fresh acceptance,
// bounded prior cleanup and pair proof. The caller owns Guide route registration;
// this factory itself neither registers a route nor writes response cookies.
const FAILED = "SolMind password-role sign-in dependencies are unavailable.";
const MAX_TIMER = 2_147_483_647;
const KEYS = ["responseFloorMilliseconds", "accountLookupTimeoutMilliseconds",
  "challengeOwnershipTimeoutMilliseconds", "challengeConfirmationTimeoutMilliseconds",
  "providerTimeoutMilliseconds", "sessionCreationTimeoutMilliseconds"] as const;

if (typeof window !== "undefined") throw new Error(FAILED);

export type PasswordRoleSignInDependencyConfiguration = Readonly<{
  responseFloorMilliseconds: number;
  accountLookupTimeoutMilliseconds: number;
  challengeOwnershipTimeoutMilliseconds: number;
  challengeConfirmationTimeoutMilliseconds: number;
  providerTimeoutMilliseconds: number;
  sessionCreationTimeoutMilliseconds: number;
}>;

type Candidate = Parameters<PasswordRoleSignInHttpPorts["createVerifyPorts"]>[1];
function fail(): never { throw new Error(FAILED); }
function configuration(input: unknown): PasswordRoleSignInDependencyConfiguration {
  try {
    if (input === null || typeof input !== "object" || Array.isArray(input)) return fail();
    const proto = Object.getPrototypeOf(input);
    const keys = Reflect.ownKeys(input);
    if ((proto !== null && proto !== Object.prototype) || keys.length !== KEYS.length ||
        !keys.every(key => typeof key === "string" && (KEYS as readonly string[]).includes(key))) return fail();
    const out = Object.create(null) as Record<typeof KEYS[number], number>;
    for (const key of KEYS) {
      const field = Object.getOwnPropertyDescriptor(input, key);
      if (!field || !field.enumerable || !("value" in field) || typeof field.value !== "number" ||
          !Number.isFinite(field.value)) return fail();
      const value: number = field.value;
      if (key === "responseFloorMilliseconds" ? value <= 0 || value > MAX_TIMER :
          !Number.isSafeInteger(value) || value < 10 || value > 60_000) return fail();
      out[key] = value;
    }
    return Object.freeze(out);
  } catch { return fail(); }
}
function policy(origin: string) {
  const result = resolveSessionCookiePolicy(origin);
  if (result === null || result.environment !== "loopback") return fail();
  return result;
}
function originMatches(actual: string, bound: string): void {
  if (actual !== bound) fail();
}
function now(): number { return performance.now(); }
function epochSeconds(): number { return Date.now() / 1000; }
async function waitUntil(target: number): Promise<void> {
  if (typeof target !== "number" || !Number.isFinite(target) || target < 0) return fail();
  for (;;) {
    const observed = now();
    if (!Number.isFinite(observed) || observed < 0) return fail();
    const remaining = target - observed;
    if (remaining <= 0) return;
    await delay(Math.min(MAX_TIMER, Math.ceil(remaining)));
  }
}
function signalCleanupFailure(): void {
  try { process.stderr.write("solmind_login_identity_cleanup_failed\n"); } catch { /* Best effort, no values. */ }
}
function signalPriorCleanupFailure(): void {
  try { process.stderr.write("solmind_login_prior_session_cleanup_failed\n"); } catch { /* No notification claim. */ }
}
const send: typeof fetch = (input, init) => fetch(input, init);
// The bridge requires this shape; password-only callers receive no link method.
// Even accidental use of this private seam cannot call a privileged client.
const noLink = Object.freeze({ generateLink: async () => null });
function oldAccess(candidate: Candidate): Readonly<{ accessToken: string }> | undefined {
  try {
    if (candidate === null || typeof candidate !== "object") return undefined;
    const field = Object.getOwnPropertyDescriptor(candidate, "accessToken");
    return field && "value" in field && typeof field.value === "string" &&
      field.value.length > 0 && field.value.length <= 16_384
      ? Object.freeze({ accessToken: field.value }) : undefined;
  } catch { return undefined; }
}
function makeSend(origin: string, config: PasswordRoleSignInDependencyConfiguration): PasswordRoleSendDependencies {
  try {
    policy(origin);
    const services = createVerificationChallengeServices(loadLoginVerificationConfiguration());
    const rpcClient = createServiceRoleClient();
    const accountLookup = createLoginAccountLookup({ rpcClient, rpcTimeoutMilliseconds: config.accountLookupTimeoutMilliseconds });
    return Object.freeze({ issuer: services.issuer, accountLookup });
  } catch { return fail(); }
}
function makeVerify(origin: string, config: PasswordRoleSignInDependencyConfiguration,
  prior: Readonly<{ accessToken: string }> | undefined): PasswordRoleVerifyDependencies {
  try {
    const cookiePolicy = policy(origin);
    const services = createVerificationChallengeServices(loadLoginVerificationConfiguration());
    const rpcClient = createServiceRoleClient();
    const accountLookup = createLoginAccountLookup({ rpcClient, rpcTimeoutMilliseconds: config.accountLookupTimeoutMilliseconds });
    const flowResolver = createLoginFlowChallengeResolver({ rpcClient, rpcTimeoutMilliseconds: config.challengeOwnershipTimeoutMilliseconds });
    const ownership = createLoginChallengeOwnershipCheck({ rpcClient, rpcTimeoutMilliseconds: config.challengeOwnershipTimeoutMilliseconds });
    const passwordFailureRecorder = createLoginPasswordFailureRecorder({ rpcClient, rpcTimeoutMilliseconds: config.challengeOwnershipTimeoutMilliseconds });
    const challengeConfirmation = createRedeemedLoginChallengeConfirmation({ rpcClient, rpcTimeoutMilliseconds: config.challengeConfirmationTimeoutMilliseconds });
    const supabaseUrl = process.env[REQUEST_AUTH_URL_ENV];
    const anonKey = process.env[REQUEST_AUTH_ANON_KEY_ENV];
    if (typeof supabaseUrl !== "string" || supabaseUrl.trim().length === 0 ||
        typeof anonKey !== "string" || anonKey.trim().length === 0) return fail();
    let cleanupPriorSession: ((fresh: CredentialPairIdentity) => Promise<void>) | undefined;
    try {
      if (prior !== undefined) {
        const cleanup = createLogoutProviderCleanupDependencies({ trustedOrigin: origin, policy: cookiePolicy });
        if (cleanup !== undefined) cleanupPriorSession = async fresh => {
          if (await cleanup.cleanupPrevious(prior, fresh) === "failed") throw new Error("solmind_prior_cleanup_failed");
        };
      }
    } catch { cleanupPriorSession = undefined; }
    const realBridge = createLoginIdentityBridge({ supabaseUrl, anonKey,
      authCookieName: cookiePolicy.authCookieName, providerTimeoutMilliseconds: config.providerTimeoutMilliseconds,
      credentialPairContext: { applicationOrigin: origin, providerIssuer: `${new URL(supabaseUrl).origin}/auth/v1`, providerAudience: "authenticated" },
    }, { fetch: send, linkAdmin: noLink, signalCleanupFailure,
      ...(cleanupPriorSession === undefined ? {} : { cleanupPriorSession, signalPriorCleanupFailure }) });
    const bridge = Object.freeze({ signInWithPassword: (request: Parameters<typeof realBridge.signInWithPassword>[0]) =>
      realBridge.signInWithPassword(request) });
    const sessionCreator = createUserSessionCreator({ rpcClient, rpcTimeoutMilliseconds: config.sessionCreationTimeoutMilliseconds });
    return Object.freeze({ accountLookup, ownership, passwordFailureRecorder, bridge, redeemer: services.redeemer, challengeConfirmation, sessionCreator, flowResolver });
  } catch { return fail(); }
}

export function createPasswordRoleSignInHttpPorts(
  input: PasswordRoleSignInDependencyConfiguration,
  readCookies: PasswordRoleSignInHttpPorts["readCookies"],
): PasswordRoleSignInHttpPorts {
  const config = configuration(input);
  if (typeof readCookies !== "function") return fail();
  const base = { now, epochSeconds, waitUntil, responseFloorMilliseconds: config.responseFloorMilliseconds };
  return Object.freeze({
    loadTrustedOrigin: () => { try { return loadTrustedApplicationOrigin(); } catch { return fail(); } },
    readCookies,
    createSendPorts: (origin: string): PasswordRoleSignInPorts => Object.freeze({ ...base,
      createSendDependencies: actual => { originMatches(actual, origin); return makeSend(origin, config); },
      createVerifyDependencies: fail }),
    createVerifyPorts: (origin: string, candidate: Candidate): PasswordRoleSignInPorts => {
      const prior = oldAccess(candidate);
      return Object.freeze({ ...base, createSendDependencies: fail,
        createVerifyDependencies: actual => { originMatches(actual, origin); return makeVerify(origin, config, prior); } });
    },
  });
}
