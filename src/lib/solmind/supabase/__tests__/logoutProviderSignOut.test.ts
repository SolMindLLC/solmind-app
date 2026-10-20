import { generateKeyPairSync, sign } from "node:crypto";

import { AuthClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createCredentialPairProof, type CredentialPairIdentity } from "../credentialPairProof";
import {
  createLogoutProviderCleanup,
  LOGOUT_PROVIDER_CLEANUP_LIMITS,
  type LogoutCleanupCandidate,
} from "../logoutProviderSignOut";

// Installed auth-js executes against an injected in-memory fetch. These tests
// establish transport/identity isolation, never actual provider revocation.
const URL_ROOT = "http://127.0.0.1:54321";
const ISSUER = `${URL_ROOT}/auth/v1`;
const ACCOUNT = "10000000-0000-4000-8000-000000000001";
const OTHER_ACCOUNT = "10000000-0000-4000-8000-000000000002";
const OLD_SESSION = "20000000-0000-4000-8000-000000000001";
const NEW_SESSION = "20000000-0000-4000-8000-000000000002";
const KEY = "synthetic-public-anon-key-cleanup";
const REFRESH = "synthetic-old-refresh-credential";
const NEW_REFRESH = "synthetic-new-refresh-credential";
const proofSettings = { key: new Uint8Array(32).fill(67), applicationOrigin: "http://127.0.0.1:3000",
  authCookieName: "sb-solmind-auth-token", providerIssuer: ISSUER, providerAudience: "authenticated" };
const proof = createCredentialPairProof(proofSettings);
const now = () => Math.floor(Date.now() / 1000);
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

function claims(change: Record<string, unknown> = {}) {
  return { iss: ISSUER, aud: "authenticated", sub: ACCOUNT, session_id: OLD_SESSION,
    exp: now() + 3600, iat: now(), role: "authenticated", ...change };
}
function jwt(change: Record<string, unknown> = {}) {
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims(change))}.c3ludGhldGlj`;
}
function pair(change: Record<string, unknown> = {}): LogoutCleanupCandidate {
  const accessToken = jwt(change);
  return { accessToken, refreshToken: REFRESH,
    proof: proof.mintTrustedPair({ accessToken, refreshToken: REFRESH, assertedProviderUserId: ACCOUNT }) };
}
function fresh(change: Partial<CredentialPairIdentity> = {}): CredentialPairIdentity {
  return { issuer: ISSUER, audience: "authenticated", subject: ACCOUNT, sessionId: NEW_SESSION,
    expiresAt: now() + 3600, ...change };
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}
function renewal(change: Record<string, unknown> = {}) {
  return { access_token: jwt(), refresh_token: "synthetic-renewed-credential", token_type: "bearer",
    expires_in: 3600, expires_at: now() + 3600, user: { id: ACCOUNT }, ...change };
}
type Call = { url: string; method: string; headers: Headers; body: unknown; init: RequestInit };
function harness(answer?: (call: Call) => Response | Promise<Response>, timeout = 5000, verifier = true) {
  const calls: Call[] = [];
  const failure = vi.fn();
  const send: typeof fetch = async (url, init) => {
    const call = { url: String(url), method: init?.method ?? "GET", headers: new Headers(init?.headers), body: init?.body, init: init! };
    calls.push(call);
    if (answer) return answer(call);
    if (call.url.endsWith("/user")) return json({ id: ACCOUNT });
    if (call.url.endsWith("/token?grant_type=refresh_token")) return json(renewal());
    if (call.url.endsWith("/logout?scope=local")) return new Response(null, { status: 204 });
    throw new Error("Unexpected fake request");
  };
  const adapter = createLogoutProviderCleanup({ supabaseUrl: URL_ROOT, anonKey: KEY,
    providerAudience: "authenticated", operationTimeoutMilliseconds: timeout },
  { fetch: send, pairVerifier: verifier ? { verifyPair: proof.verifyPair } : undefined, signalFailure: failure });
  return { adapter, calls, failure };
}
const paths = (calls: Call[]) => calls.map((call) => new URL(call.url).pathname + new URL(call.url).search);
function privateValuesAbsent(value: unknown, values: string[]) {
  const serialized = JSON.stringify(value);
  return values.every((entry) => !serialized.includes(entry));
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("targeted provider cleanup", () => {
  it("verifies an explicit current token and sends exactly one local logout without renewal or proof", async () => {
    const h = harness(undefined, 5000, false);
    const accessToken = jwt();
    expect(await h.adapter.cleanup({ accessToken })).toBe("cleaned");
    expect(paths(h.calls)).toEqual(["/auth/v1/user", "/auth/v1/logout?scope=local"]);
    expect(h.calls.every((call) => call.headers.get("authorization") === `Bearer ${accessToken}`)).toBe(true);
    expect(h.calls.every((call) => call.headers.get("apikey") === KEY && call.init.redirect === "error" &&
      call.init.credentials === "omit" && call.init.cache === "no-store")).toBe(true);
    expect(h.failure).not.toHaveBeenCalled();
  });

  it("proves an expired pair before one renewal, verifies renewed identity, then logs out only that session", async () => {
    const h = harness();
    const old = pair({ exp: now() - 10 });
    expect(typeof old.proof === "string").toBe(true);
    expect(await h.adapter.cleanup(old)).toBe("cleaned");
    expect(paths(h.calls)).toEqual(["/auth/v1/token?grant_type=refresh_token", "/auth/v1/user", "/auth/v1/logout?scope=local"]);
    expect(h.calls[0].body === JSON.stringify({ refresh_token: REFRESH })).toBe(true);
    expect(h.calls[2].headers.get("authorization") === `Bearer ${old.accessToken}`).toBe(false);
  });

  it.each(["missing", "tampered", "mixed_pair", "wrong_context", "wrong_key", "unknown_version"])(
    "makes zero renewal requests with %s provenance", async (kind) => {
      const h = harness();
      let old: LogoutCleanupCandidate = pair({ exp: now() - 1 });
      if (kind === "missing") old = { ...old, proof: undefined };
      if (kind === "tampered") old = { ...old, proof: `${old.proof}A` };
      if (kind === "mixed_pair") old = { ...old, refreshToken: NEW_REFRESH };
      if (kind === "unknown_version") old = { ...old, proof: String(old.proof).replace("v1.", "v2.") };
      if (kind === "wrong_context" || kind === "wrong_key") {
        const other = createCredentialPairProof({ ...proofSettings,
          ...(kind === "wrong_key" ? { key: new Uint8Array(32).fill(68) } : { applicationOrigin: "http://localhost:3000" }) });
        old = { ...old, proof: other.mintTrustedPair({ accessToken: old.accessToken,
          refreshToken: old.refreshToken!, assertedProviderUserId: ACCOUNT }) };
      }
      expect(await h.adapter.cleanup(old)).toBe("failed");
      expect(h.calls.length).toBe(0);
      expect(h.failure).toHaveBeenCalledTimes(1);
    });

  it("a same-account newer-session refresh token cannot be substituted before dispatch", async () => {
    const h = harness();
    const older = pair({ exp: now() - 20 });
    const newer = pair({ session_id: NEW_SESSION });
    expect(await h.adapter.cleanup({ ...older, refreshToken: NEW_REFRESH, proof: newer.proof })).toBe("failed");
    expect(h.calls.length).toBe(0);
  });

  it.each([
    { access_token: jwt({ session_id: NEW_SESSION }) },
    { access_token: jwt({ sub: OTHER_ACCOUNT }) },
    { access_token: jwt({ iss: "https://attacker.example/auth/v1" }) },
    { access_token: jwt({ aud: "other" }) },
    { access_token: jwt({ exp: 1 }) },
    { user: { id: OTHER_ACCOUNT } },
    { expires_at: 1 },
    { token_type: "mac" },
    { refresh_token: "" },
    { unexpected: true },
  ])("rejects mismatched or malformed renewal output without signout (case %#)", async (change) => {
    const h = harness(() => json(renewal(change)));
    expect(await h.adapter.cleanup(pair({ exp: now() - 1 }))).toBe("failed");
    expect(paths(h.calls)).toEqual(["/auth/v1/token?grant_type=refresh_token"]);
  });

  it.each([401, 403, 404, 429, 500, 503])("provider %s is a fixed failure, never revocation confirmation or retry", async (status) => {
    const h = harness((call) => call.url.endsWith("/user") ? json({ id: ACCOUNT }) : json({ message: REFRESH }, status));
    const result = await h.adapter.cleanup(pair());
    expect(result).toBe("failed");
    expect(h.calls.length).toBe(2);
    expect(h.failure).toHaveBeenCalledTimes(1);
    expect(privateValuesAbsent(result, [REFRESH, ACCOUNT])).toBe(true);
  });

  it("an in-time user-verification refusal never falls through to renewal", async () => {
    const h = harness(() => json({ message: REFRESH }, 401));
    expect(await h.adapter.cleanup(pair())).toBe("failed");
    expect(paths(h.calls)).toEqual(["/auth/v1/user"]);
  });

  it("rejects a successful getUser answer for a different subject", async () => {
    const h = harness(() => json({ id: OTHER_ACCOUNT }));
    expect(await h.adapter.cleanup(pair())).toBe("failed");
    expect(h.calls.length).toBe(1);
  });

  it("verifies a real asymmetric signature with one JWKS read and no user request", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const kid = "cleanup-valid-key";
    const unsigned = `${encode({ alg: "ES256", kid, typ: "JWT" })}.${encode(claims())}`;
    const signature = sign("sha256", Buffer.from(unsigned), { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
    const accessToken = `${unsigned}.${signature}`;
    const h = harness((call) => call.url.endsWith("jwks.json") ? json({ keys: [{ ...publicKey.export({ format: "jwk" }), kid, alg: "ES256", use: "sig" }] }) : new Response(null, { status: 204 }));
    expect(await h.adapter.cleanup({ accessToken })).toBe("cleaned");
    expect(paths(h.calls)).toEqual(["/auth/v1/.well-known/jwks.json", "/auth/v1/logout?scope=local"]);
  });

  it("rejects an invalid asymmetric signature without a logout fallback", async () => {
    const { publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const kid = "cleanup-invalid-key";
    const token = `${encode({ alg: "ES256", kid })}.${encode(claims())}.${Buffer.alloc(64).toString("base64url")}`;
    const h = harness(() => json({ keys: [{ ...publicKey.export({ format: "jwk" }), kid, alg: "ES256" }] }));
    expect(await h.adapter.cleanup({ accessToken: token })).toBe("failed");
    expect(paths(h.calls)).toEqual(["/auth/v1/.well-known/jwks.json"]);
  });
});

describe("deadline, closure, body and privacy boundaries", () => {
  it("deadline closes dispatch even when fetch ignores abort and later resolves", async () => {
    vi.useFakeTimers();
    let finish!: (response: Response) => void;
    const h = harness(() => new Promise<Response>((resolve) => { finish = resolve; }), 50);
    const pending = h.adapter.cleanup(pair());
    await vi.advanceTimersByTimeAsync(60);
    expect(await pending).toBe("failed");
    expect(h.calls[0].init.signal?.aborted).toBe(true);
    finish(json({ id: ACCOUNT }));
    await vi.advanceTimersByTimeAsync(100);
    expect(h.calls.length).toBe(1);
    expect(h.failure).toHaveBeenCalledTimes(1);
  });

  it("times out body consumption, cancels the stream and never starts logout", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const h = harness(() => new Response(new ReadableStream({ pull() {}, cancel }),
      { headers: { "Content-Type": "application/json" } }), 50);
    const pending = h.adapter.cleanup(pair());
    await vi.advanceTimersByTimeAsync(60);
    expect(await pending).toBe("failed");
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(h.calls.length).toBe(1);
  });

  it("one shared operation budget prevents a late logout after renewal plus verification consume it", async () => {
    vi.useFakeTimers();
    const h = harness((call) => new Promise<Response>((resolve) => setTimeout(() =>
      resolve(call.url.includes("/token?") ? json(renewal()) : json({ id: ACCOUNT })), 40)), 60);
    const pending = h.adapter.cleanup(pair({ exp: now() - 1 }));
    await vi.advanceTimersByTimeAsync(150);
    expect(await pending).toBe("failed");
    expect(paths(h.calls)).toEqual(["/auth/v1/token?grant_type=refresh_token", "/auth/v1/user"]);
  });

  it.each(["oversized", "length", "invalid_json", "wrong_type", "body_error", "redirect"])("rejects %s response", async (kind) => {
    const h = harness(() => {
      if (kind === "oversized") return json({ id: ACCOUNT, padding: "x".repeat(LOGOUT_PROVIDER_CLEANUP_LIMITS.maximumBodyBytes) });
      if (kind === "length") return new Response("{}", { headers: { "Content-Type": "application/json", "Content-Length": "999999" } });
      if (kind === "invalid_json") return new Response("{", { headers: { "Content-Type": "application/json" } });
      if (kind === "wrong_type") return new Response("{}");
      if (kind === "redirect") return new Response(null, { status: 302, headers: { Location: "https://attacker.example" } });
      return new Response(new ReadableStream({ start(controller) { controller.error(new Error(REFRESH)); } }),
        { headers: { "Content-Type": "application/json" } });
    });
    expect(await h.adapter.cleanup(pair())).toBe("failed");
    expect(h.calls.length).toBe(1);
  });

  it("bounds a stream of empty chunks that could otherwise starve the deadline timer", async () => {
    const cancel = vi.fn();
    const h = harness(() => new Response(new ReadableStream({
      pull(controller) { controller.enqueue(new Uint8Array(0)); }, cancel,
    }), { headers: { "Content-Type": "application/json" } }));
    expect(await h.adapter.cleanup(pair())).toBe("failed");
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(h.calls.length).toBe(1);
  });

  it("the installed library prints nothing for early or late secret-bearing transport failures", async () => {
    const logs: unknown[][] = [];
    for (const method of ["log", "info", "warn", "error", "debug", "trace"] as const) {
      vi.spyOn(console, method).mockImplementation((...args) => { logs.push(args); });
    }
    const early = harness(async () => { throw new Error(REFRESH); });
    expect(await early.adapter.cleanup(pair())).toBe("failed");
    vi.useFakeTimers();
    let reject!: (error: Error) => void;
    const late = harness(() => new Promise<Response>((_, fail) => { reject = fail; }), 25);
    const pending = late.adapter.cleanup(pair());
    await vi.advanceTimersByTimeAsync(30);
    expect(await pending).toBe("failed");
    reject(new Error(REFRESH));
    await vi.advanceTimersByTimeAsync(30);
    expect(logs.length).toBe(0);
  });

  it.each([
    ["https://attacker.example/auth/v1/user", "GET"],
    [`${ISSUER}/user?extra=1`, "GET"],
    [`${ISSUER}/logout?scope=global`, "POST"],
    [`${ISSUER}/logout?scope=others`, "POST"],
    [`${ISSUER}/user`, "POST"],
    [`${ISSUER}/token?grant_type=refresh_token`, "POST"],
  ])("rejects unexpected library dispatch (case %#)", async (url, method) => {
    vi.spyOn(AuthClient.prototype, "getClaims").mockImplementation(async function (this: InstanceType<typeof AuthClient>) {
      const transport = Reflect.get(this, "fetch") as typeof fetch;
      await transport(url, { method });
      return { data: null, error: null };
    });
    const h = harness();
    expect(await h.adapter.cleanup(pair())).toBe("failed");
    expect(h.calls.length).toBe(0);
  });

  it("rejects library verification retries before a second network request", async () => {
    vi.spyOn(AuthClient.prototype, "getClaims").mockImplementation(async function (this: InstanceType<typeof AuthClient>, token) {
      const transport = Reflect.get(this, "fetch") as typeof fetch;
      const options = { method: "GET", headers: { Authorization: `Bearer ${token}` } };
      await transport(`${ISSUER}/user`, options);
      await transport(`${ISSUER}/user`, options);
      return { data: null, error: null };
    });
    const h = harness();
    expect(await h.adapter.cleanup(pair())).toBe("failed");
    expect(h.calls.length).toBe(1);
  });

  it("ignores a throwing failure signal and keeps fixed results", async () => {
    const adapter = createLogoutProviderCleanup({ supabaseUrl: URL_ROOT, anonKey: KEY, providerAudience: "authenticated" },
      { fetch: async () => { throw new Error(REFRESH); }, signalFailure: () => { throw new Error(REFRESH); } });
    expect(await adapter.cleanup(pair())).toBe("failed");
  });
});

describe("next successful login old-session backstop", () => {
  it("targets only a verified distinct older session, with no renewal or fresh credential available", async () => {
    const h = harness();
    const old = pair();
    const freshIdentity = Object.freeze(fresh());
    expect(await h.adapter.cleanupPrevious(old, freshIdentity)).toBe("cleaned");
    expect(paths(h.calls)).toEqual(["/auth/v1/user", "/auth/v1/logout?scope=local"]);
    expect(h.calls.every((call) => call.headers.get("authorization") === `Bearer ${old.accessToken}`)).toBe(true);
    expect(freshIdentity.sessionId === NEW_SESSION).toBe(true);
  });

  it.each(["same_session", "different_account", "different_issuer", "expired_old", "short_fresh"])(
    "skips %s without a provider request", async (kind) => {
      const h = harness();
      const old = kind === "expired_old" ? pair({ exp: now() - 1 }) : pair();
      const current = fresh(kind === "same_session" ? { sessionId: OLD_SESSION } :
        kind === "different_account" ? { subject: OTHER_ACCOUNT } :
        kind === "different_issuer" ? { issuer: "https://attacker.example/auth/v1" } :
        kind === "short_fresh" ? { expiresAt: now() + 9 } : {});
      expect(await h.adapter.cleanupPrevious(old, current)).toBe("skipped");
      expect(h.calls.length).toBe(0);
    });

  it("unverifiable older credentials never renew, even with valid provenance", async () => {
    const h = harness(() => json({ message: REFRESH }, 401));
    expect(await h.adapter.cleanupPrevious(pair(), fresh())).toBe("failed");
    expect(paths(h.calls)).toEqual(["/auth/v1/user"]);
  });

  it("concurrent cleanups keep their old credential targets private to each operation", async () => {
    const h = harness();
    const first = pair();
    const second = pair({ session_id: "20000000-0000-4000-8000-000000000003" });
    expect(await Promise.all([h.adapter.cleanupPrevious(first, fresh()), h.adapter.cleanupPrevious(second, fresh())])).toEqual(["cleaned", "cleaned"]);
    const outgoing = h.calls.filter((call) => call.url.endsWith("/logout?scope=local"));
    expect(outgoing.length).toBe(2);
    expect(outgoing.some((call) => call.headers.get("authorization") === `Bearer ${first.accessToken}`)).toBe(true);
    expect(outgoing.some((call) => call.headers.get("authorization") === `Bearer ${second.accessToken}`)).toBe(true);
  });
});

describe("configuration and snapshots", () => {
  it.each(["\n", "\r", "\r\n", "\u2028", "\u2029"])("refuses final terminators in credentials and canonical UUID claims (case %#)", async (ending) => {
    const h = harness();
    expect(await h.adapter.cleanup({ accessToken: jwt() + ending })).toBe("skipped");
    expect(await h.adapter.cleanup({ accessToken: jwt({ sub: ACCOUNT + ending }) })).toBe("skipped");
    expect(await h.adapter.cleanup({ accessToken: jwt({ session_id: OLD_SESSION + ending }) })).toBe("skipped");
    expect(await h.adapter.cleanup({ accessToken: jwt(), refreshToken: REFRESH + ending })).toBe("skipped");
    expect(h.calls.length).toBe(0);
  });

  it.each(["https://example.invalid/path", "http://example.invalid", "https://user:pass@example.invalid", `${URL_ROOT}?x=1`])(
    "rejects unsupported provider URL without I/O (case %#)", (supabaseUrl) => {
      let fixed = false;
      try { createLogoutProviderCleanup({ supabaseUrl, anonKey: KEY, providerAudience: "authenticated" }, { fetch: vi.fn() }); }
      catch (error) { fixed = error instanceof Error && error.message === "SolMind provider cleanup configuration unavailable."; }
      expect(fixed).toBe(true);
    });

  it("refuses a service-role JWT used as the public key", () => {
    const key = `${encode({ alg: "HS256" })}.${encode({ role: "service_role" })}.c3ludGhldGlj`;
    expect(() => createLogoutProviderCleanup({ supabaseUrl: URL_ROOT, anonKey: key, providerAudience: "authenticated" }, { fetch: vi.fn() }))
      .toThrow("SolMind provider cleanup configuration unavailable.");
  });

  it("does not execute credential getters or expose malformed input", async () => {
    const h = harness();
    const getter = vi.fn(() => { throw new Error(REFRESH); });
    const input = Object.defineProperty({}, "accessToken", { get: getter }) as LogoutCleanupCandidate;
    expect(await h.adapter.cleanup(input)).toBe("skipped");
    expect(getter).not.toHaveBeenCalled();
    expect(h.calls.length).toBe(0);
  });
});
