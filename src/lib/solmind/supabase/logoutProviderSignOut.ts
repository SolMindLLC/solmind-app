import "server-only";

import { AuthClient } from "@supabase/supabase-js";

import type { CredentialPairIdentity, CredentialPairVerifier } from "./credentialPairProof";

// Direct-import server adapter. It owns no cookie, application session, database,
// environment read or authenticated shared client. A successful HTTP response is
// a cleanup acknowledgement, not independently observed provider revocation.
// The identity bridge alone supplies the fresh accepted identity to the backstop.
if (typeof window !== "undefined") {
  throw new Error("SolMind provider cleanup is server-only.");
}

export const LOGOUT_PROVIDER_CLEANUP_LIMITS = Object.freeze({
  operationTimeoutMilliseconds: 5_000,
  requestTimeoutMilliseconds: 2_500,
  maximumBodyBytes: 65_536,
  maximumBodyChunks: 1_024,
  maximumAccessTokenLength: 16_384,
  maximumRefreshTokenLength: 4_096,
  releaseMarginMilliseconds: 5_000,
});

export type ProviderCleanupOutcome = "cleaned" | "skipped" | "failed";
export type LogoutCleanupCandidate = Readonly<{
  accessToken: string;
  refreshToken?: string;
  proof?: unknown;
}>;
export type LogoutProviderCleanup = Readonly<{
  cleanup(candidate: LogoutCleanupCandidate): Promise<ProviderCleanupOutcome>;
  cleanupPrevious(candidate: LogoutCleanupCandidate, fresh: CredentialPairIdentity): Promise<ProviderCleanupOutcome>;
}>;
export type LogoutProviderCleanupConfiguration = Readonly<{
  supabaseUrl: string;
  anonKey: string;
  providerAudience: string;
  operationTimeoutMilliseconds?: number;
}>;
export type LogoutProviderCleanupDependencies = Readonly<{
  fetch: typeof fetch;
  pairVerifier?: CredentialPairVerifier;
  signalFailure?: () => void;
}>;

type Settings = Readonly<{
  issuer: string;
  audience: string;
  key: string;
  milliseconds: number;
  send: typeof fetch;
  verifyPair?: CredentialPairVerifier["verifyPair"];
  signalFailure?: () => void;
}>;
type Phase = Readonly<{ token: string; identity: CredentialPairIdentity }>;
// An absolute end assertion: JavaScript `$` alone also accepts before final LF.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?![\s\S])/;
const TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?![\s\S])/;
const FAILURE_BODY = '{"message":"Provider cleanup unavailable","code":"cleanup_unavailable"}';

function record(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).some((key) => typeof key !== "string")) return undefined;
  const copy: Record<string, unknown> = Object.create(null);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!("value" in descriptor)) return undefined;
    copy[key] = descriptor.value;
  }
  return copy;
}

function segment(value: string): unknown {
  const bytes = Buffer.from(value, "base64url");
  if (bytes.toString("base64url") !== value) return undefined;
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

function identity(value: unknown, settings: Pick<Settings, "issuer" | "audience">): CredentialPairIdentity | undefined {
  const item = record(value);
  if (!item || item.issuer !== settings.issuer || item.audience !== settings.audience ||
      typeof item.subject !== "string" || !UUID.test(item.subject) ||
      typeof item.sessionId !== "string" || !UUID.test(item.sessionId) ||
      typeof item.expiresAt !== "number" || !Number.isSafeInteger(item.expiresAt) || item.expiresAt <= 0) return undefined;
  return Object.freeze({ issuer: item.issuer, audience: item.audience, subject: item.subject,
    sessionId: item.sessionId, expiresAt: item.expiresAt });
}

// Shape only: this result is never authority for revocation or renewal.
function unverifiedIdentity(token: unknown, settings: Settings): CredentialPairIdentity | undefined {
  if (typeof token !== "string" || token.length > LOGOUT_PROVIDER_CLEANUP_LIMITS.maximumAccessTokenLength || !TOKEN.test(token)) return undefined;
  const [header, payload] = token.split(".");
  const head = record(segment(header));
  const claims = record(segment(payload));
  if (!head || !claims || !["HS256", "RS256", "ES256"].includes(String(head.alg))) return undefined;
  return identity({ issuer: claims.iss, audience: claims.aud, subject: claims.sub,
    sessionId: claims.session_id, expiresAt: claims.exp }, settings);
}

function candidate(value: unknown, settings: Settings): LogoutCleanupCandidate | undefined {
  const item = record(value);
  if (!item || Object.keys(item).some((key) => !["accessToken", "refreshToken", "proof"].includes(key)) ||
      !unverifiedIdentity(item.accessToken, settings)) return undefined;
  if (item.refreshToken !== undefined && (typeof item.refreshToken !== "string" ||
      item.refreshToken.length === 0 || item.refreshToken.length > LOGOUT_PROVIDER_CLEANUP_LIMITS.maximumRefreshTokenLength ||
      !/^[\x21-\x7e]+(?![\s\S])/.test(item.refreshToken))) return undefined;
  return Object.freeze({ accessToken: item.accessToken as string,
    refreshToken: item.refreshToken as string | undefined, proof: item.proof });
}

function settingsFor(configuration: unknown, dependencies: unknown): Settings {
  try {
    const config = record(configuration);
    const deps = record(dependencies);
    if (!config || !deps || typeof config.supabaseUrl !== "string" || /[\s\u0000-\u001f\u007f]/.test(config.supabaseUrl) || typeof config.anonKey !== "string" ||
        !/^[\x21-\x7e]{1,16384}(?![\s\S])/.test(config.anonKey) || config.anonKey.startsWith("sb_secret_") ||
        typeof config.providerAudience !== "string" || !/^[A-Za-z0-9_-]{1,64}(?![\s\S])/.test(config.providerAudience) ||
        typeof deps.fetch !== "function" || (deps.signalFailure !== undefined && typeof deps.signalFailure !== "function")) throw 0;
    if (TOKEN.test(config.anonKey)) {
      const keyClaims = record(segment(config.anonKey.split(".")[1]));
      if (!keyClaims || keyClaims.role !== "anon") throw 0;
    }
    const url = new URL(config.supabaseUrl);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
        (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)))) throw 0;
    const milliseconds = config.operationTimeoutMilliseconds ?? LOGOUT_PROVIDER_CLEANUP_LIMITS.operationTimeoutMilliseconds;
    if (typeof milliseconds !== "number" || !Number.isSafeInteger(milliseconds) || milliseconds < 25 ||
        milliseconds > LOGOUT_PROVIDER_CLEANUP_LIMITS.operationTimeoutMilliseconds) throw 0;
    const verifier = deps.pairVerifier === undefined ? undefined : record(deps.pairVerifier);
    if (deps.pairVerifier !== undefined && (!verifier || Object.keys(verifier).length !== 1 || typeof verifier.verifyPair !== "function")) throw 0;
    return Object.freeze({ issuer: `${url.origin}/auth/v1`, audience: config.providerAudience, key: config.anonKey,
      milliseconds, send: deps.fetch as typeof fetch,
      verifyPair: verifier ? (input) => (verifier.verifyPair as CredentialPairVerifier["verifyPair"])(input) : undefined,
      signalFailure: deps.signalFailure as (() => void) | undefined });
  } catch {
    throw new Error("SolMind provider cleanup configuration unavailable.");
  }
}

function failedResponse(): Response {
  return new Response(FAILURE_BODY, { status: 503, headers: { "Content-Type": "application/json" } });
}

function abandon(response: Response): void {
  try { void response.body?.cancel().catch(() => undefined); } catch { /* fixed failure only */ }
}

async function boundedJson(response: Response, signal: AbortSignal, live: () => boolean): Promise<unknown> {
  const type = response.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(type) || !response.body) throw 0;
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > LOGOUT_PROVIDER_CLEANUP_LIMITS.maximumBodyBytes)) throw 0;
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  const parts: Uint8Array[] = [];
  let size = 0;
  let count = 0;
  try {
    for (;;) {
      if (signal.aborted || !live()) throw 0;
      const next = await reader.read();
      if (next.done) break;
      count += 1;
      size += next.value.byteLength;
      if (size > LOGOUT_PROVIDER_CLEANUP_LIMITS.maximumBodyBytes || count > LOGOUT_PROVIDER_CLEANUP_LIMITS.maximumBodyChunks) throw 0;
      parts.push(next.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    void reader.cancel().catch(() => undefined);
    throw 0;
  } finally { signal.removeEventListener("abort", cancel); reader.releaseLock(); }
}

function sameSession(left: CredentialPairIdentity, right: CredentialPairIdentity): boolean {
  return left.issuer === right.issuer && left.audience === right.audience &&
    left.subject === right.subject && left.sessionId === right.sessionId;
}

function createOperation(settings: Settings) {
  const started = performance.now();
  const controllers = new Set<AbortController>();
  let open = true;
  let transportFailed = false;
  let phase: Phase | undefined;
  let jwksReads = 0;
  let userReads = 0;
  let renewals = 0;
  let signOuts = 0;
  let renewalCredential: string | undefined;
  let signOutCredential: string | undefined;
  const live = () => open && !transportFailed && performance.now() - started < settings.milliseconds;
  const close = () => {
    open = false;
    for (const controller of controllers) controller.abort();
    controllers.clear();
  };
  const fail = () => { transportFailed = true; close(); return failedResponse(); };

  // Installed auth-js logs rejected fetch errors before its caller can catch.
  // No error object or provider error body crosses this never-rejecting wrapper.
  const transport: typeof fetch = async (input, init) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    try {
      if (!live() || typeof input !== "string" || !init) return fail();
      const method = init.method;
      const headers = new Headers(init.headers);
      let kind: "jwks" | "user" | "renew" | "logout";
      let token: string | undefined;
      let body: string | undefined;
      if (input === `${settings.issuer}/.well-known/jwks.json` && method === "GET" && phase && jwksReads++ === 0) {
        kind = "jwks";
      } else if (input === `${settings.issuer}/user` && method === "GET" && phase && userReads++ === 0 &&
          headers.get("authorization") === `Bearer ${phase.token}`) {
        kind = "user"; token = phase.token;
      } else if (input === `${settings.issuer}/token?grant_type=refresh_token` && method === "POST" &&
          renewalCredential && renewals++ === 0 && init.body === JSON.stringify({ refresh_token: renewalCredential })) {
        kind = "renew"; body = JSON.stringify({ refresh_token: renewalCredential });
      } else if (input === `${settings.issuer}/logout?scope=local` && method === "POST" &&
          signOutCredential && signOuts++ === 0 && headers.get("authorization") === `Bearer ${signOutCredential}`) {
        kind = "logout"; token = signOutCredential;
      } else return fail();
      // No caller-provided credentials, arbitrary headers or redirect policy survive.
      const outgoing = new Headers({ apikey: settings.key, "X-Supabase-Api-Version": "2024-01-01" });
      if (token) outgoing.set("Authorization", `Bearer ${token}`);
      if (body) outgoing.set("Content-Type", "application/json");
      controller = new AbortController();
      const activeController = controller;
      controllers.add(controller);
      const remaining = Math.min(LOGOUT_PROVIDER_CLEANUP_LIMITS.requestTimeoutMilliseconds,
        settings.milliseconds - (performance.now() - started));
      const timeout = new Promise<Response>((resolve) => {
        timer = setTimeout(() => { activeController.abort(); resolve(fail()); }, Math.max(0, remaining));
      });
      const perform = async (): Promise<Response> => {
        try {
          if (!live() || activeController.signal.aborted) return fail();
          const response = await settings.send(input, { method, headers: outgoing, body,
            signal: activeController.signal, redirect: "error", credentials: "omit", cache: "no-store" });
          if (!live() || activeController.signal.aborted) { abandon(response); return failedResponse(); }
          if (response.redirected || (response.url !== "" && response.url !== input) || !response.ok) {
            abandon(response); return fail();
          }
          if (kind === "logout") {
            // The library's admin API intentionally does not consume a success body.
            // Cancel it here; only an explicit 200/204 acknowledgement counts.
            abandon(response);
            return response.status === 200 || response.status === 204 ? new Response(null, { status: 204 }) : fail();
          }
          let parsed: Record<string, unknown> | undefined;
          try { parsed = record(await boundedJson(response, activeController.signal, live)); }
          catch { abandon(response); return fail(); }
          if (!live() || activeController.signal.aborted || !parsed) return fail();
          let safe: unknown = parsed;
          if (kind === "user") {
            const user = record(parsed.user) ?? parsed;
            if (user.id !== phase?.identity.subject) return fail();
            safe = { id: user.id };
          } else if (kind === "jwks") {
            if (!Array.isArray(parsed.keys) || parsed.keys.length > 32 ||
                parsed.keys.some((key) => !record(key) || Object.hasOwn(key, "d"))) return fail();
            safe = { keys: parsed.keys };
          }
          return new Response(JSON.stringify(safe), { status: 200, headers: { "Content-Type": "application/json" } });
        } catch { return fail(); }
      };
      return await Promise.race([perform(), timeout]);
    } catch { return fail(); }
    finally {
      if (timer !== undefined) clearTimeout(timer);
      if (controller) controllers.delete(controller);
    }
  };

  const client = new AuthClient({ url: settings.issuer, headers: { apikey: settings.key }, fetch: transport,
    persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, debug: false,
    storageKey: `solmind-cleanup:${settings.issuer}` });

  return {
    live, close,
    async verify(token: string): Promise<CredentialPairIdentity | undefined> {
      if (!live()) return undefined;
      const shaped = unverifiedIdentity(token, settings);
      if (!shaped || shaped.expiresAt <= Math.floor(Date.now() / 1000)) return undefined;
      phase = { token, identity: shaped }; jwksReads = 0; userReads = 0;
      const result = await client.getClaims(token);
      if (!live() || result.error || !result.data) return undefined;
      const verified = identity({ issuer: result.data.claims.iss, audience: result.data.claims.aud,
        subject: result.data.claims.sub, sessionId: result.data.claims.session_id, expiresAt: result.data.claims.exp }, settings);
      return verified && sameSession(shaped, verified) && verified.expiresAt === shaped.expiresAt ? verified : undefined;
    },
    async renew(pair: LogoutCleanupCandidate): Promise<Readonly<{ token: string; identity: CredentialPairIdentity }> | undefined> {
      if (!live() || !pair.refreshToken || !settings.verifyPair) return undefined;
      const proven = identity(settings.verifyPair({ accessToken: pair.accessToken, refreshToken: pair.refreshToken, proof: pair.proof }), settings);
      const shaped = unverifiedIdentity(pair.accessToken, settings);
      if (!proven || !shaped || !sameSession(proven, shaped) || proven.expiresAt !== shaped.expiresAt) return undefined;
      renewalCredential = pair.refreshToken;
      const response = await transport(`${settings.issuer}/token?grant_type=refresh_token`, {
        method: "POST", body: JSON.stringify({ refresh_token: pair.refreshToken }) });
      if (!live() || !response.ok) return undefined;
      const payload = record(await response.json());
      if (!payload || Object.keys(payload).some((key) => !["access_token", "refresh_token", "token_type", "expires_in", "expires_at", "user"].includes(key)) ||
          payload.token_type !== "bearer" || typeof payload.expires_in !== "number" || !Number.isSafeInteger(payload.expires_in) || payload.expires_in <= 0 ||
          typeof payload.refresh_token !== "string" || !/^[\x21-\x7e]+(?![\s\S])/.test(payload.refresh_token) ||
          payload.refresh_token.length > LOGOUT_PROVIDER_CLEANUP_LIMITS.maximumRefreshTokenLength) return undefined;
      const renewed = unverifiedIdentity(payload.access_token, settings);
      const user = record(payload.user);
      if (!renewed || !user || user.id !== proven.subject || !sameSession(renewed, proven) ||
          renewed.expiresAt <= Math.floor(Date.now() / 1000) ||
          (payload.expires_at !== undefined && payload.expires_at !== renewed.expiresAt)) return undefined;
      return Object.freeze({ token: payload.access_token as string, identity: renewed });
    },
    async signOut(token: string): Promise<ProviderCleanupOutcome> {
      if (!live()) return "failed";
      signOutCredential = token;
      const answer = await client.admin.signOut(token, "local");
      return live() && signOuts === 1 && !answer.error ? "cleaned" : "failed";
    },
  };
}

export function createLogoutProviderCleanup(
  configuration: LogoutProviderCleanupConfiguration,
  dependencies: LogoutProviderCleanupDependencies,
): LogoutProviderCleanup {
  const settings = settingsFor(configuration, dependencies);
  async function run(input: LogoutCleanupCandidate, freshInput?: CredentialPairIdentity): Promise<ProviderCleanupOutcome> {
    let operation: ReturnType<typeof createOperation> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let result: ProviderCleanupOutcome = "failed";
    try {
      const pair = candidate(input, settings);
      if (!pair) return "skipped";
      const before = unverifiedIdentity(pair.accessToken, settings)!;
      const fresh = freshInput === undefined ? undefined : identity(freshInput, settings);
      if (freshInput !== undefined && (!fresh || before.expiresAt <= Math.floor(Date.now() / 1000) ||
          fresh.subject !== before.subject || fresh.sessionId === before.sessionId ||
          fresh.expiresAt * 1000 - Date.now() <= settings.milliseconds + LOGOUT_PROVIDER_CLEANUP_LIMITS.releaseMarginMilliseconds)) return "skipped";
      operation = createOperation(settings);
      const active = operation;
      const work = async (): Promise<ProviderCleanupOutcome> => {
        try {
          let token = pair.accessToken;
          let expected = before;
          // Decide before any verification I/O. A provider refusal never triggers renewal.
          if (!fresh && before.expiresAt * 1000 - Date.now() <= settings.milliseconds) {
            const renewed = await active.renew(pair);
            if (!renewed || !active.live()) return "failed";
            token = renewed.token; expected = renewed.identity;
          }
          const verified = await active.verify(token);
          if (!verified || !active.live() || !sameSession(verified, expected)) return "failed";
          if (fresh && (verified.subject !== fresh.subject || verified.sessionId === fresh.sessionId ||
              fresh.expiresAt * 1000 - Date.now() <= LOGOUT_PROVIDER_CLEANUP_LIMITS.releaseMarginMilliseconds)) return "skipped";
          return await active.signOut(token);
        } catch { return "failed"; }
      };
      result = await Promise.race([work(), new Promise<ProviderCleanupOutcome>((resolve) => {
        timer = setTimeout(() => { active.close(); resolve("failed"); }, settings.milliseconds);
      })]);
      return result;
    } catch { return "failed"; }
    finally {
      operation?.close();
      if (timer !== undefined) clearTimeout(timer);
      if (result === "failed" && operation) {
        try { void Promise.resolve(settings.signalFailure?.()).catch(() => undefined); } catch { /* reporting cannot change cleanup */ }
      }
    }
  }
  return Object.freeze({ cleanup: (input) => run(input), cleanupPrevious: (input, fresh) => run(input, fresh) });
}
