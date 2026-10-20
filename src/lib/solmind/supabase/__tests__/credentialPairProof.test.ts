import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CREDENTIAL_PAIR_PROOF_KEY_VARIABLE,
  CredentialPairProofConfigurationError,
  createCredentialPairProof,
  loadCredentialPairVerifier,
  loadLoginCredentialPairProof,
  readTrustedCredentialPairIdentity,
  type CredentialPairContext,
} from "../credentialPairProof";

const SUBJECT = "aaaaaaaa-1111-4444-8888-aaaaaaaaaaaa";
const SESSION = "bbbbbbbb-2222-4444-8888-bbbbbbbbbbbb";
const OTHER_SESSION = "cccccccc-3333-4444-8888-cccccccccccc";
const CONTEXT: CredentialPairContext = Object.freeze({
  applicationOrigin: "http://127.0.0.1:3000",
  authCookieName: "solmind-auth",
  providerIssuer: "http://127.0.0.1:54321/auth/v1",
  providerAudience: "authenticated",
});
const KEY = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const segment = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = (override: Record<string, unknown> = {}) => `${segment({ alg: "HS256", typ: "JWT" })}.${segment({
  iss: CONTEXT.providerIssuer, aud: CONTEXT.providerAudience,
  sub: SUBJECT, session_id: SESSION, exp: 1_900_000_000, ...override,
})}.c3ludGhldGlj`;
const pair = (override: Record<string, unknown> = {}) => ({ accessToken: token(override), refreshToken: "synthetic-refresh-a" });
const factory = () => createCredentialPairProof({ ...CONTEXT, key: KEY });

afterEach(() => vi.unstubAllEnvs());

describe("exact credential pair provenance", () => {
  it("mints fixed canonical v1 MAC only for the asserted fresh provider subject and returns frozen provenance", () => {
    const proof = factory();
    const input = pair();
    const mac = proof.mintTrustedPair({ ...input, assertedProviderUserId: SUBJECT });
    expect(typeof mac === "string" && /^v1\.[A-Za-z0-9_-]{43}$/.test(mac)).toBe(true);
    const identity = proof.verifyPair({ ...input, proof: mac });
    expect(identity !== undefined && Object.isFrozen(identity) && identity.subject === SUBJECT && identity.sessionId === SESSION).toBe(true);
    expect(proof.mintTrustedPair({ ...input, assertedProviderUserId: OTHER_SESSION }) === undefined).toBe(true);
  });

  it("refuses mixed refresh credentials before any consumer can authorize renewal, including the same account's newer session", () => {
    const proof = factory();
    const older = pair();
    const newer = { accessToken: token({ session_id: OTHER_SESSION }), refreshToken: "synthetic-refresh-b" };
    const mac = proof.mintTrustedPair({ ...older, assertedProviderUserId: SUBJECT });
    const changedInputs = [
      { ...older, refreshToken: newer.refreshToken },
      { ...newer, refreshToken: older.refreshToken },
      newer,
      { ...older, accessToken: `${older.accessToken.slice(0, -1)}k` },
      { ...older, accessToken: token({ exp: 1_900_000_001 }) },
      { ...older, accessToken: token({ sub: OTHER_SESSION }) },
    ];
    for (const changed of changedInputs) expect(proof.verifyPair({ ...changed, proof: mac }) === undefined).toBe(true);
  });

  it("binds key, origin, cookie family, issuer, audience and does not treat historical expiry as current authentication", () => {
    const proof = factory();
    const input = pair({ exp: 1 });
    const mac = proof.mintTrustedPair({ ...input, assertedProviderUserId: SUBJECT });
    expect(proof.verifyPair({ ...input, proof: mac })?.expiresAt === 1).toBe(true);
    const configurations = [
      { ...CONTEXT, key: new Uint8Array(32).fill(42) },
      { ...CONTEXT, key: KEY, applicationOrigin: "http://localhost:3000" },
      { ...CONTEXT, key: KEY, authCookieName: "different-auth" },
      { ...CONTEXT, key: KEY, providerIssuer: "http://localhost:54321/auth/v1" },
      { ...CONTEXT, key: KEY, providerAudience: "another-audience" },
    ];
    for (const config of configurations) expect(createCredentialPairProof(config).verifyPair({ ...input, proof: mac }) === undefined).toBe(true);
  });

  it("owns a copy of the key and rejects noncanonical proof versions, sizes and encodings", () => {
    const key = new Uint8Array(KEY);
    const proof = createCredentialPairProof({ ...CONTEXT, key });
    const input = pair();
    const mac = proof.mintTrustedPair({ ...input, assertedProviderUserId: SUBJECT })!;
    key.fill(0);
    expect(factory().verifyPair({ ...input, proof: mac }) !== undefined).toBe(true);
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const final = alphabet.indexOf(mac.at(-1)!);
    // SHA256's last base64url character has two zero padding bits. An alias
    // encoding for the same bytes is rejected before constant-time comparison.
    const noncanonical = mac.slice(0, -1) + alphabet[final | 1];
    for (const value of [undefined, null, "", mac.replace("v1.", "v2."), `${mac}=`, `${mac}\n`, mac.slice(0, -1), noncanonical, { proof: mac }]) {
      expect(proof.verifyPair({ ...input, proof: value }) === undefined).toBe(true);
    }
  });

  it("refuses ambiguous or malformed provider fields, accessor requests and oversized credentials without invoking getters", () => {
    const proof = factory();
    for (const claims of [
      { iss: "http://127.0.0.1:54321/auth/v1/" }, { aud: ["authenticated"] },
      { sub: SUBJECT.toUpperCase() }, { session_id: "legacy-session" },
      { session_id: undefined }, { exp: 1.5 }, { exp: 0 }, { exp: Number.MAX_SAFE_INTEGER + 1 },
    ]) expect(proof.mintTrustedPair({ ...pair(claims), assertedProviderUserId: SUBJECT }) === undefined).toBe(true);
    for (const refreshToken of ["", "has space", "\n", "x".repeat(4097)]) {
      expect(proof.mintTrustedPair({ ...pair(), refreshToken, assertedProviderUserId: SUBJECT }) === undefined).toBe(true);
    }
    const getter = vi.fn(() => token());
    const request = Object.defineProperty({ refreshToken: "synthetic", assertedProviderUserId: SUBJECT }, "accessToken", { enumerable: true, get: getter });
    expect(proof.mintTrustedPair(request as never) === undefined).toBe(true);
    expect(getter).not.toHaveBeenCalled();
    expect(readTrustedCredentialPairIdentity(token(), CONTEXT) !== undefined).toBe(true);
    expect(proof.verifyPair({ ...pair(), proof: undefined }) === undefined).toBe(true);
  });

  it("requires a dedicated canonical server key and gives cleanup only verifier capability", () => {
    vi.stubEnv(CREDENTIAL_PAIR_PROOF_KEY_VARIABLE, undefined);
    expect(loadLoginCredentialPairProof(CONTEXT) === undefined).toBe(true);
    for (const encoded of ["", "secret", Buffer.alloc(31).toString("base64"), `${Buffer.from(KEY).toString("base64")}\n`]) {
      vi.stubEnv(CREDENTIAL_PAIR_PROOF_KEY_VARIABLE, encoded);
      expect(loadLoginCredentialPairProof(CONTEXT) === undefined).toBe(true);
    }
    vi.stubEnv(CREDENTIAL_PAIR_PROOF_KEY_VARIABLE, Buffer.from(KEY).toString("base64"));
    const verifier = loadCredentialPairVerifier(CONTEXT);
    expect(verifier !== undefined && Object.keys(verifier).join() === "verifyPair" && Object.isFrozen(verifier)).toBe(true);
    const proof = factory().mintTrustedPair({ ...pair(), assertedProviderUserId: SUBJECT });
    expect(verifier?.verifyPair({ ...pair(), proof }) !== undefined).toBe(true);
    vi.stubEnv(CREDENTIAL_PAIR_PROOF_KEY_VARIABLE, Buffer.alloc(32, 42).toString("base64"));
    expect(loadCredentialPairVerifier(CONTEXT)?.verifyPair({ ...pair(), proof }) === undefined).toBe(true);
  });

  it("reports only one fixed configuration error with no supplied configuration values", () => {
    for (const config of [
      { ...CONTEXT, key: new Uint8Array(31) },
      { ...CONTEXT, key: KEY, applicationOrigin: "https://example.test/path" },
      { ...CONTEXT, key: KEY, providerIssuer: "https://user:secret@example.test/auth/v1" },
      { ...CONTEXT, key: KEY, providerAudience: "authenticated\n" },
      { ...CONTEXT, key: KEY, extra: "sensitive" },
    ]) expect(() => createCredentialPairProof(config)).toThrow(CredentialPairProofConfigurationError);
  });
});
