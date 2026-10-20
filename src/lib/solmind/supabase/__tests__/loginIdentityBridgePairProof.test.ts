// Real installed SSR/auth-js against injected in-memory HTTP only. Assertions
// on credentials compare booleans so a failure never prints token operands.
import { createChunks, createServerClient, stringFromBase64URL, stringToBase64URL } from "@supabase/ssr";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveSessionCookiePolicy, readSessionAuthCookies, type SessionCookieAttributes } from "../../auth/sessionCookiePolicy";
import {
  CREDENTIAL_PAIR_PROOF_KEY_VARIABLE,
  CREDENTIAL_PAIR_PROOF_PROPERTY,
  createCredentialPairProof,
  type CredentialPairContext,
  type CredentialPairIdentity,
  type CredentialPairProof,
} from "../credentialPairProof";
import { createLoginIdentityBridge, type LoginIdentityHold } from "../loginIdentityBridge";
import { writeLoginSessionCookies } from "../loginCookieWriter";

const ACCOUNT = "aaaaaaaa-1111-4444-8888-aaaaaaaaaaaa";
const SESSION = "bbbbbbbb-2222-4444-8888-bbbbbbbbbbbb";
const BINDING = "cccccccc-3333-4444-8888-cccccccccccc";
const URL = "http://127.0.0.1:54321";
const ORIGIN = "http://127.0.0.1:3000";
const CONTEXT: CredentialPairContext = {
  applicationOrigin: ORIGIN, authCookieName: "solmind-auth",
  providerIssuer: `${URL}/auth/v1`, providerAudience: "authenticated",
};
const KEY = new Uint8Array(32).fill(83);
const segment = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

function providerAnswer(padding = 0, lifetime = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: CONTEXT.providerIssuer, aud: "authenticated", sub: ACCOUNT, session_id: SESSION, exp: now + lifetime };
  return {
    access_token: `${segment({ alg: "HS256", typ: "JWT" })}.${segment(claims)}.c3ludGhldGlj`,
    refresh_token: "synthetic-refresh-from-provider", token_type: "bearer", expires_in: lifetime, expires_at: now + lifetime,
    user: { id: ACCOUNT, aud: "authenticated", role: "authenticated", email: "synthetic@example.test", app_metadata: {}, user_metadata: { padding: "p".repeat(padding) } },
  };
}

function setup(answer = providerAnswer(), options: Readonly<{
  proof?: CredentialPairProof;
  cleanup?: (fresh: CredentialPairIdentity) => Promise<void>;
  signal?: () => void;
  context?: CredentialPairContext;
}> = {}) {
  const calls: string[] = [];
  const send = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const address = String(input);
    if (address === `${URL}/auth/v1/token?grant_type=password`) {
      calls.push("password");
      return new Response(JSON.stringify(answer), { status: 200, headers: { "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" } });
    }
    if (address === `${URL}/auth/v1/logout?scope=local`) {
      calls.push("local-logout");
      return new Response(null, { status: 204 });
    }
    throw new Error("Unexpected synthetic provider request");
  });
  const context = options.context ?? CONTEXT;
  const bridge = createLoginIdentityBridge({
    supabaseUrl: URL, anonKey: "synthetic-public-key", authCookieName: context.authCookieName, providerTimeoutMilliseconds: 200,
    credentialPairContext: { applicationOrigin: context.applicationOrigin, providerIssuer: context.providerIssuer, providerAudience: context.providerAudience },
  }, {
    fetch: send as typeof fetch,
    linkAdmin: { generateLink: async () => ({ error: "unused" }) }, signalCleanupFailure: () => undefined,
    ...(options.proof === undefined ? {} : { credentialPairProof: options.proof }),
    ...(options.cleanup === undefined ? {} : { cleanupPriorSession: options.cleanup }),
    ...(options.signal === undefined ? {} : { signalPriorCleanupFailure: options.signal }),
  });
  return { bridge, calls };
}

async function held(bridge: ReturnType<typeof setup>["bridge"]): Promise<LoginIdentityHold> {
  const result = await bridge.signInWithPassword({ email: "synthetic@example.test", password: "synthetic-password" });
  if (result.outcome !== "held") throw new Error("Synthetic sign-in did not produce hold");
  return result.hold;
}

function stored(heldCookies: readonly { name: string; value: string }[]) {
  return JSON.parse(stringFromBase64URL(heldCookies.map((cookie) => cookie.value).join("").slice(7))) as Record<string, unknown>;
}

afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); vi.restoreAllMocks(); vi.doUnmock("@supabase/ssr"); vi.resetModules(); });

describe("bridge trusted pair publication", () => {
  it("never mints on sign-in or assertion, then mints once after session acceptance and keeps exact required provider fields", async () => {
    const capability = createCredentialPairProof({ ...CONTEXT, key: KEY });
    const mint = vi.fn(capability.mintTrustedPair);
    const answer = providerAnswer();
    const { bridge } = setup(answer, { proof: { ...capability, mintTrustedPair: mint } });
    const hold = await held(bridge);
    expect(mint).not.toHaveBeenCalled();
    await hold.assertProviderUser(ACCOUNT);
    expect(mint).not.toHaveBeenCalled();
    const released = hold.release({ sessionOutcome: "created" });
    expect(released.outcome).toBe("released");
    if (released.outcome !== "released") return;
    expect(mint).toHaveBeenCalledTimes(1);
    const value = stored(released.heldCookies);
    expect(Object.prototype.hasOwnProperty.call(value, CREDENTIAL_PAIR_PROOF_PROPERTY)).toBe(true);
    expect(value.access_token === answer.access_token && value.refresh_token === answer.refresh_token && value.expires_at === answer.expires_at).toBe(true);
    expect(JSON.stringify(value.user) === JSON.stringify(answer.user)).toBe(true);
    expect(capability.verifyPair({ accessToken: answer.access_token, refreshToken: answer.refresh_token, proof: value[CREDENTIAL_PAIR_PROOF_PROPERTY] }) !== undefined).toBe(true);
    expect(hold.release({ sessionOutcome: "created" }).outcome).toBe("refused");
    expect(mint).toHaveBeenCalledTimes(1);
  });

  it("refuses release without provider assertion or accepted session outcome and never calls mint", async () => {
    const capability = createCredentialPairProof({ ...CONTEXT, key: KEY });
    for (const failure of ["no-assertion", "denied-session"] as const) {
      const mint = vi.fn(capability.mintTrustedPair);
      const { bridge, calls } = setup(providerAnswer(), { proof: { ...capability, mintTrustedPair: mint } });
      const hold = await held(bridge);
      if (failure === "denied-session") await hold.assertProviderUser(ACCOUNT);
      expect(hold.release({ sessionOutcome: failure === "no-assertion" ? "created" : "denied" } as never).outcome).toBe("refused");
      await hold.discard();
      expect(mint).not.toHaveBeenCalled();
      expect(calls.filter((call) => call === "local-logout").length).toBe(1);
    }
  });

  it("keeps ordinary login and exact legacy serialized bytes when dedicated key is missing or malformed", async () => {
    for (const key of [undefined, "malformed-key"]) {
      vi.stubEnv(CREDENTIAL_PAIR_PROOF_KEY_VARIABLE, key);
      const answer = providerAnswer();
      const hold = await held(setup(answer).bridge);
      await hold.assertProviderUser(ACCOUNT);
      const released = hold.release({ sessionOutcome: "existing" });
      expect(released.outcome).toBe("released");
      if (released.outcome !== "released") continue;
      const expected = createChunks(CONTEXT.authCookieName, `base64-${stringToBase64URL(JSON.stringify(answer))}`);
      expect(JSON.stringify(released.heldCookies) === JSON.stringify(expected)).toBe(true);
      expect(CREDENTIAL_PAIR_PROOF_PROPERTY in stored(released.heldCookies)).toBe(false);
    }
  });

  it("uses the real SSR encoding and read path after proof crosses a chunk boundary; writer clears old layouts and preserves attributes", async () => {
    vi.stubEnv(CREDENTIAL_PAIR_PROOF_KEY_VARIABLE, Buffer.from(KEY).toString("base64"));
    for (const origin of [ORIGIN, "https://uat.example.test"]) {
      const policy = resolveSessionCookiePolicy(origin)!;
      const context = { ...CONTEXT, applicationOrigin: origin, authCookieName: policy.authCookieName };
      let answer = providerAnswer();
      // Find a payload with one original chunk and two proof-bearing chunks.
      for (let padding = 0; padding < 4000; padding++) {
        const candidate = providerAnswer(padding);
        const length = 7 + stringToBase64URL(JSON.stringify(candidate)).length;
        if (length >= 3120 && length <= 3180) { answer = candidate; break; }
      }
      expect(createChunks(policy.authCookieName, `base64-${stringToBase64URL(JSON.stringify(answer))}`).length).toBe(1);
      const hold = await held(setup(answer, { context }).bridge);
      await hold.assertProviderUser(ACCOUNT);
      const release = hold.release({ sessionOutcome: "created" });
      expect(release.outcome).toBe("released");
      if (release.outcome !== "released") continue;
      expect(release.heldCookies.length).toBe(2);
      expect(release.heldCookies.every((entry, index) => entry.name === `${policy.authCookieName}.${index}` && entry.value.length <= 3180)).toBe(true);
      const writes: { name: string; value: string; attributes: SessionCookieAttributes }[] = [];
      const headers = new Map<string, string>();
      const result = writeLoginSessionCookies({ trustedOrigin: origin, heldCookies: release.heldCookies,
        requestCookies: [{ name: policy.authCookieName, value: "old" }, { name: `${policy.authCookieName}.3`, value: "stale" }, { name: policy.codeVerifierCookieName, value: "old" }],
        sessionId: BINDING, maxAgeSeconds: 300,
        response: { cookies: { set(name, value, attributes) { writes.push({ name, value, attributes }); } }, headers: { set(name, value) { headers.set(name, value); } } },
      });
      expect(result.outcome).toBe("written");
      expect(writes.filter((write) => write.value === "").map((write) => write.name)).toEqual(expect.arrayContaining([policy.authCookieName, `${policy.authCookieName}.3`, policy.codeVerifierCookieName]));
      expect(writes.every(({ attributes }) => attributes.httpOnly && attributes.sameSite === "lax" && attributes.path === "/" && attributes.secure === policy.secure && !("domain" in attributes))).toBe(true);
      expect(headers.get("Cache-Control")).toContain("no-store");
      expect(readSessionAuthCookies(policy, release.heldCookies).status).toBe("present");
      const network = vi.fn(async () => { throw new Error("Unexpected read network"); });
      const client = createServerClient(URL, "synthetic-public-key", {
        cookieOptions: { name: policy.authCookieName }, cookies: { getAll: () => [...release.heldCookies], setAll: () => undefined }, global: { fetch: network },
      });
      // Installed session read consumes the exact published SSR chunks. The
      // fixture is unexpired; this is serialization compatibility, not auth.
      const response = await client.auth.getSession();
      expect(response.data.session?.access_token === answer.access_token && response.data.session?.refresh_token === answer.refresh_token).toBe(true);
      expect(network).not.toHaveBeenCalled();
    }
  });

  it("refuses an augmented over-limit cookie atomically and discards only its own transient session", async () => {
    vi.stubEnv(CREDENTIAL_PAIR_PROOF_KEY_VARIABLE, Buffer.from(KEY).toString("base64"));
    let answer = providerAnswer();
    for (let padding = 23_000; padding < 26_000; padding++) {
      const candidate = providerAnswer(padding);
      const length = 7 + stringToBase64URL(JSON.stringify(candidate)).length;
      if (length >= 32_700 && length <= 32_768) { answer = candidate; break; }
    }
    const { bridge, calls } = setup(answer);
    const hold = await held(bridge);
    await hold.assertProviderUser(ACCOUNT);
    expect(hold.release({ sessionOutcome: "created" }).outcome).toBe("refused");
    await hold.discard();
    expect(calls.filter((call) => call === "local-logout").length).toBe(1);
  });

  it("rejects a library hand-over carrying another refresh token even when its access token matches the provider answer", async () => {
    const answer = providerAnswer();
    const signOut = vi.fn(async (token: string, scope: string) => { void token; void scope; return { error: null }; });
    vi.doMock("@supabase/ssr", async (importOriginal) => {
      const original = await importOriginal<typeof import("@supabase/ssr")>();
      return { ...original, createServerClient: (_url: string, _key: string, options: { cookies: { setAll(value: unknown): void } }) => ({ auth: {
        signInWithPassword: async () => {
          options.cookies.setAll(createChunks(CONTEXT.authCookieName, `base64-${stringToBase64URL(JSON.stringify({ ...answer, refresh_token: "another-session-refresh" }))}`));
          return { data: { session: answer, user: answer.user }, error: null };
        }, admin: { signOut },
      } }) };
    });
    vi.resetModules();
    const bridgeModule = await import("../loginIdentityBridge");
    const bridge = bridgeModule.createLoginIdentityBridge({ supabaseUrl: URL, anonKey: "synthetic", authCookieName: CONTEXT.authCookieName, providerTimeoutMilliseconds: 200 }, {
      fetch: vi.fn() as unknown as typeof fetch, linkAdmin: { generateLink: async () => null }, signalCleanupFailure: () => undefined,
    });
    const result = await bridge.signInWithPassword({ email: "synthetic@example.test", password: "synthetic" });
    expect(result.outcome).toBe("failed");
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut.mock.calls.every((call) => call[0] === answer.access_token && call[1] === "local")).toBe(true);
  });
});

describe("accepted-session residual cleanup seam", () => {
  it("calls once after assertion and acceptance with fresh facts only, then permits normal publication even after callback rejection", async () => {
    const cleanup = vi.fn(async (fresh: CredentialPairIdentity) => { void fresh; throw new Error("synthetic-private-error"); });
    const signal = vi.fn();
    const { bridge, calls } = setup(providerAnswer(), { cleanup, signal });
    const hold = await held(bridge);
    expect(cleanup).not.toHaveBeenCalled();
    await hold.assertProviderUser(ACCOUNT);
    expect(cleanup).not.toHaveBeenCalled();
    await hold.prepareAcceptedSession({ sessionOutcome: "created" });
    await hold.prepareAcceptedSession({ sessionOutcome: "existing" });
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(signal).toHaveBeenCalledExactlyOnceWith();
    const fresh = cleanup.mock.calls[0][0];
    expect(Object.keys(fresh).sort()).toEqual(["audience", "expiresAt", "issuer", "sessionId", "subject"]);
    expect(Object.isFrozen(fresh) && fresh.subject === ACCOUNT && fresh.sessionId === SESSION).toBe(true);
    expect(hold.release({ sessionOutcome: "created" }).outcome).toBe("released");
    expect(calls).toEqual(["password"]);
  });

  it("does not release around unfinished preparation or run cleanup for a failed login/session", async () => {
    const cleanup = vi.fn(async () => undefined);
    for (const mode of ["before-assertion", "session-denied", "skip-preparation"] as const) {
      const hold = await held(setup(providerAnswer(), { cleanup }).bridge);
      if (mode !== "before-assertion") await hold.assertProviderUser(ACCOUNT);
      if (mode !== "skip-preparation") await hold.prepareAcceptedSession({ sessionOutcome: mode === "session-denied" ? "denied" : "created" } as never);
      expect(hold.release({ sessionOutcome: "created" }).outcome).toBe("refused");
      await hold.discard();
    }
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("skips cleanup without its whole budget plus response reserve and refuses release after token expiry", async () => {
    const cleanup = vi.fn(async () => undefined);
    const hold = await held(setup(providerAnswer(0, 8), { cleanup }).bridge);
    await hold.assertProviderUser(ACCOUNT);
    await hold.prepareAcceptedSession({ sessionOutcome: "created" });
    expect(cleanup).not.toHaveBeenCalled();
    const later = vi.spyOn(Date, "now").mockReturnValue((hold.accessTokenExpiresAt + 1) * 1000);
    expect(hold.release({ sessionOutcome: "created" }).outcome).toBe("refused");
    await hold.discard();
    later.mockRestore();
  });

  it("settles a never-answering backstop at its shared budget, and late completion cannot resurrect a discarded hold", async () => {
    vi.useFakeTimers();
    let finish: (() => void) | undefined;
    const cleanup = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const signal = vi.fn(() => { throw new Error("synthetic-private-report-error"); });
    const hold = await held(setup(providerAnswer(), { cleanup, signal }).bridge);
    await hold.assertProviderUser(ACCOUNT);
    const preparing = hold.prepareAcceptedSession({ sessionOutcome: "created" });
    await vi.advanceTimersByTimeAsync(5001);
    await preparing;
    expect(signal).toHaveBeenCalledExactlyOnceWith();
    await hold.discard();
    finish?.();
    await Promise.resolve();
    expect(hold.release({ sessionOutcome: "created" }).outcome).toBe("refused");
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(signal).toHaveBeenCalledTimes(1);
  });
});
