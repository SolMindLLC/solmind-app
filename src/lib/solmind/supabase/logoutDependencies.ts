import "server-only";

import { AuthClient } from "@supabase/supabase-js";

import { resolveSessionCookiePolicy, type SessionCookiePolicy } from "../auth/sessionCookiePolicy";
import { loadCredentialPairVerifier } from "./credentialPairProof";
import { createLogoutProviderCleanup, type LogoutProviderCleanup } from "./logoutProviderSignOut";
import { createUserSessionLogoutCaller } from "./userSessionLogoutCaller";

// Concrete server composition only. The public provider and privileged database
// factories are independent: missing database configuration cannot suppress the
// eligible provider cleanup or the separately owned safe cookie-clearing branch.
if (typeof window !== "undefined") throw new Error("SolMind logout dependencies are server-only.");

export type LogoutDatabaseDependencies = Readonly<{
  identify(accessToken: string, signal: AbortSignal): Promise<string | null>;
  findAccount(providerUserId: string, signal: AbortSignal): Promise<string | null>;
  endSession(userAccountId: string, presentedSessionId: string): Promise<"ended" | "already_ended" | "failed">;
}>;
export type LogoutDependencyInputs = Readonly<{
  env?: Readonly<Record<string, string | undefined>>;
  fetch?: typeof fetch;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?![\s\S])/;
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?![\s\S])/;
const IDENTITY_TIMEOUT = 3_000;
const LOOKUP_TIMEOUT = 3_000;
const WRITER_TIMEOUT = 6_000;
const MAXIMUM_BODY_BYTES = 65_536;
const MAXIMUM_BODY_CHUNKS = 1_024;
const RPC_FAILED = Object.freeze({ data: null, error: Object.freeze({ message: "logout_dependency_failed" }) });

function data(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).some((key) => typeof key !== "string")) return undefined;
  const result: Record<string, unknown> = Object.create(null);
  for (const [name, descriptor] of Object.entries(descriptors)) {
    if (!("value" in descriptor)) return undefined;
    result[name] = descriptor.value;
  }
  return result;
}

function readSetting(env: Readonly<Record<string, string | undefined>>, name: string): string | undefined {
  const field = Object.getOwnPropertyDescriptor(env, name);
  return field && "value" in field && typeof field.value === "string" && /^[\x21-\x7e]{1,16384}(?![\s\S])/.test(field.value)
    ? field.value : undefined;
}

function configuration(inputs: LogoutDependencyInputs) {
  const supplied = data(inputs);
  if (!supplied) return undefined;
  const env = supplied.env === undefined ? process.env : supplied.env;
  const send = supplied.fetch === undefined ? globalThis.fetch : supplied.fetch;
  if (env === null || typeof env !== "object" || typeof send !== "function") return undefined;
  const typedEnv = env as Readonly<Record<string, string | undefined>>;
  const rawUrl = readSetting(typedEnv, "NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readSetting(typedEnv, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!rawUrl || !anonKey || anonKey.startsWith("sb_secret_")) return undefined;
  if (JWT.test(anonKey)) {
    const keyPayload = data(JSON.parse(Buffer.from(anonKey.split(".")[1], "base64url").toString("utf8")));
    if (!keyPayload || keyPayload.role !== "anon") return undefined;
  }
  const url = new URL(rawUrl);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)))) return undefined;
  return Object.freeze({ origin: url.origin, anonKey, env: typedEnv, send: send as typeof fetch });
}

function discardBody(response: Response): void {
  try { void response.body?.cancel().catch(() => undefined); } catch { /* value-free */ }
}

// Purpose-local transport, not an exported general HTTP capability. Callers
// below construct one exact URL/method/body. This helper bounds both response
// and body, never prints/rethrows errors, never retries and consumes late errors.
async function readJson(
  send: typeof fetch, url: string, init: RequestInit, milliseconds: number, outerSignal?: AbortSignal,
): Promise<unknown | undefined> {
  const controller = new AbortController();
  const started = performance.now();
  let open = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stop: (() => void) | undefined;
  const live = () => open && !controller.signal.aborted && !outerSignal?.aborted && performance.now() - started < milliseconds;
  const abort = () => { controller.abort(); stop?.(); };
  try {
    if (outerSignal?.aborted) return undefined;
    outerSignal?.addEventListener("abort", abort, { once: true });
    const expired = new Promise<undefined>((resolve) => {
      stop = () => resolve(undefined);
      timer = setTimeout(abort, milliseconds);
    });
    const perform = async (): Promise<unknown | undefined> => {
      try {
        if (!live()) return undefined;
        const response = await send(url, { ...init, signal: controller.signal,
          redirect: "error", credentials: "omit", cache: "no-store" });
        if (!live() || !response.ok || response.redirected || (response.url && response.url !== url) ||
            !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")) {
          discardBody(response); return undefined;
        }
        const length = response.headers.get("content-length");
        if (!response.body || (length !== null && (!/^\d+$/.test(length) || Number(length) > MAXIMUM_BODY_BYTES))) {
          discardBody(response); return undefined;
        }
        const reader = response.body.getReader();
        const cancel = () => { void reader.cancel().catch(() => undefined); };
        controller.signal.addEventListener("abort", cancel, { once: true });
        try {
          let size = 0;
          const chunks: Uint8Array[] = [];
          for (;;) {
            if (!live()) { cancel(); return undefined; }
            const item = await reader.read();
            if (item.done) break;
            size += item.value.byteLength;
            chunks.push(item.value);
            if (size > MAXIMUM_BODY_BYTES || chunks.length > MAXIMUM_BODY_CHUNKS) { cancel(); return undefined; }
          }
          if (!live()) return undefined;
          const bytes = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
          return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        } finally { controller.signal.removeEventListener("abort", cancel); reader.releaseLock(); }
      } catch { return undefined; }
    };
    return await Promise.race([perform(), expired]);
  } catch { return undefined; }
  finally {
    open = false;
    controller.abort();
    if (timer !== undefined) clearTimeout(timer);
    outerSignal?.removeEventListener("abort", abort);
  }
}

function fixedAuthFailure(): Response {
  return new Response('{"message":"Logout identity unavailable"}', { status: 503, headers: { "Content-Type": "application/json" } });
}

export function createLogoutDatabaseDependencies(inputs: LogoutDependencyInputs = {}): LogoutDatabaseDependencies | undefined {
  try {
    const config = configuration(inputs);
    if (!config) return undefined;
    const serviceKey = readSetting(config.env, "SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) return undefined;
    const rpcHeaders = Object.freeze({ apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json", "Content-Profile": "public", "Accept-Profile": "public" });
    const logout = createUserSessionLogoutCaller({ rpcTimeoutMilliseconds: WRITER_TIMEOUT, rpcClient: {
      rpc(name, args) {
        const values = data(args);
        const valid = name === "solmind_logout_user_session" && values && Object.keys(values).length === 2 &&
          typeof values.p_user_account_id === "string" && UUID.test(values.p_user_account_id) &&
          typeof values.p_user_session_id === "string" && UUID.test(values.p_user_session_id);
        // Capture bytes before handing out the one-use abortSignal capability.
        const body = valid ? JSON.stringify({ p_user_account_id: values.p_user_account_id, p_user_session_id: values.p_user_session_id }) : undefined;
        let consumed = false;
        return Object.freeze({ async abortSignal(signal: AbortSignal) {
          if (consumed || body === undefined || signal.aborted) return RPC_FAILED;
          consumed = true;
          const result = await readJson(config.send, `${config.origin}/rest/v1/rpc/solmind_logout_user_session`,
            { method: "POST", headers: rpcHeaders, body }, WRITER_TIMEOUT, signal);
          return result === undefined ? RPC_FAILED : { data: result, error: null };
        } });
      },
    } });
    return Object.freeze({
      async identify(accessToken, signal) {
        try {
          if (typeof accessToken !== "string" || accessToken.length > 16_384 || !JWT.test(accessToken) || signal.aborted) return null;
          const token = accessToken;
          let requested = false;
          let closed = false;
          const endpoint = `${config.origin}/auth/v1/user`;
          const sanitized: typeof fetch = async (url, init) => {
            try {
              if (closed || requested || signal.aborted || url !== endpoint || init?.method !== "GET" ||
                  new Headers(init.headers).get("authorization") !== `Bearer ${token}`) return fixedAuthFailure();
              requested = true;
              const answer = data(await readJson(config.send, endpoint, { method: "GET",
                headers: { apikey: config.anonKey, Authorization: `Bearer ${token}`, "X-Supabase-Api-Version": "2024-01-01" } }, IDENTITY_TIMEOUT, signal));
              const user = answer && (data(answer.user) ?? answer);
              if (closed || signal.aborted || !user || typeof user.id !== "string" || !UUID.test(user.id)) return fixedAuthFailure();
              return new Response(JSON.stringify({ id: user.id }), { headers: { "Content-Type": "application/json" } });
            } catch { return fixedAuthFailure(); }
          };
          const client = new AuthClient({ url: `${config.origin}/auth/v1`, headers: { apikey: config.anonKey }, fetch: sanitized,
            persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, debug: false, storageKey: "solmind-logout-identity" });
          try {
            const result = await client.getUser(token);
            const id = result.data?.user?.id;
            return !signal.aborted && requested && !result.error && typeof id === "string" && UUID.test(id) ? id : null;
          } finally { closed = true; }
        } catch { return null; }
      },
      async findAccount(providerUserId, signal) {
        try {
          if (typeof providerUserId !== "string" || !UUID.test(providerUserId) || signal.aborted) return null;
          const result = await readJson(config.send, `${config.origin}/rest/v1/rpc/solmind_find_auth_provider_identity`,
            { method: "POST", headers: rpcHeaders, body: JSON.stringify({ p_provider_name: "supabase", p_provider_user_id: providerUserId }) }, LOOKUP_TIMEOUT, signal);
          if (signal.aborted || !Array.isArray(result) || result.length !== 1) return null;
          const row = data(result[0]);
          if (!row || Object.keys(row).length !== 4 || row.provider_name !== "supabase" || row.provider_user_id !== providerUserId ||
              row.status !== "active" || typeof row.user_account_id !== "string" || !UUID.test(row.user_account_id)) return null;
          // No active-account/current-session check: identifiable suspended and
          // superseded sessions still use their exact presented logout binding.
          return row.user_account_id;
        } catch { return null; }
      },
      async endSession(userAccountId, presentedSessionId) {
        try {
          const result = await logout.end({ userAccountId, presentedSessionId });
          return result.outcome === "ended" || result.outcome === "already_ended" ? result.outcome : "failed";
        } catch { return "failed"; }
      },
    });
  } catch { return undefined; }
}

export function createLogoutProviderCleanupDependencies(
  args: Readonly<{ trustedOrigin: string; policy: SessionCookiePolicy }>, inputs: LogoutDependencyInputs = {},
): LogoutProviderCleanup | undefined {
  try {
    const config = configuration(inputs);
    const supplied = data(args);
    const policy = supplied && data(supplied.policy);
    if (!config || !supplied || typeof supplied.trustedOrigin !== "string" || !policy) return undefined;
    const resolved = resolveSessionCookiePolicy(supplied.trustedOrigin);
    if (!resolved || Object.keys(resolved).some((key) => policy[key] !== Reflect.get(resolved, key))) return undefined;
    const pairVerifier = loadCredentialPairVerifier({ applicationOrigin: supplied.trustedOrigin,
      authCookieName: resolved.authCookieName, providerIssuer: `${config.origin}/auth/v1`, providerAudience: "authenticated" });
    return createLogoutProviderCleanup({ supabaseUrl: config.origin, anonKey: config.anonKey, providerAudience: "authenticated" },
      { fetch: config.send, pairVerifier });
  } catch { return undefined; }
}
