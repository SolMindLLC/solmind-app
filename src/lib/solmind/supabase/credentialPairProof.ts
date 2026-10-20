import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Exact-pair provenance for one optional logout renewal. This is not a user
// authentication/session check. Only the identity bridge may mint, after a
// trusted fresh provider answer, account assertion and SolMind acceptance.
// Never mint from request cookies. Logout receives only CredentialPairVerifier.
// No IO except the explicitly named environment loaders; no logging or keys
// in results/errors. The dedicated key is provisioned separately, never here.
if (typeof window !== "undefined") {
  throw new Error("SolMind credential pair proof must remain server-only.");
}

export const CREDENTIAL_PAIR_PROOF_PROPERTY = "solmind_pair_proof";
export const CREDENTIAL_PAIR_PROOF_KEY_VARIABLE = "SOLMIND_CREDENTIAL_PAIR_PROOF_KEY_BASE64";
export const CREDENTIAL_PAIR_PROOF_LIMITS = Object.freeze({
  minimumKeyBytes: 32,
  maximumKeyBytes: 4096,
  maximumAccessTokenBytes: 16_384,
  maximumRefreshTokenBytes: 4096,
  maximumEncodedSessionBytes: 32_768,
});

export type CredentialPairContext = Readonly<{
  applicationOrigin: string;
  authCookieName: string;
  providerIssuer: string;
  providerAudience: string;
}>;

export type CredentialPairIdentity = Readonly<{
  issuer: string;
  audience: string;
  subject: string;
  sessionId: string;
  expiresAt: number;
}>;

export type CredentialPairProof = Readonly<{
  mintTrustedPair(pair: Readonly<{
    accessToken: string;
    refreshToken: string;
    assertedProviderUserId: string;
  }>): string | undefined;
  verifyPair(pair: Readonly<{
    accessToken: string;
    refreshToken: string;
    proof: unknown;
  }>): CredentialPairIdentity | undefined;
}>;

export type CredentialPairVerifier = Pick<CredentialPairProof, "verifyPair">;

const DOMAIN = "SolMind credential pair provenance";
const VERSION = "v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const NON_TOKEN_CHARACTER = /[^!-~]/;

export class CredentialPairProofConfigurationError extends Error {
  constructor() {
    super("SolMind credential pair proof: invalid configuration.");
    this.name = "CredentialPairProofConfigurationError";
  }
}

function dataRecord(value: unknown, keys: readonly string[]): Map<string, unknown> | undefined {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const names = Reflect.ownKeys(value);
    if (names.length !== keys.length || names.some((name) => typeof name !== "string" || !keys.includes(name))) {
      return undefined;
    }
    const result = new Map<string, unknown>();
    for (const name of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      if (!descriptor?.enumerable || !("value" in descriptor)) return undefined;
      result.set(name, descriptor.value);
    }
    return result;
  } catch {
    return undefined;
  }
}

function canonicalUrl(value: unknown, originOnly: boolean): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "https:" ||
      (parsed.protocol === "http:" && ["127.0.0.1", "[::1]", "localhost"].includes(parsed.hostname))) &&
      parsed.username === "" && parsed.password === "" && parsed.search === "" && parsed.hash === "" &&
      (originOnly ? parsed.origin === value : parsed.href === value && !value.endsWith("/"));
  } catch {
    return false;
  }
}

export function resolveCredentialPairContext(value: unknown): CredentialPairContext | undefined {
  const fields = dataRecord(value, ["applicationOrigin", "authCookieName", "providerIssuer", "providerAudience"]);
  const applicationOrigin = fields?.get("applicationOrigin");
  const authCookieName = fields?.get("authCookieName");
  const providerIssuer = fields?.get("providerIssuer");
  const providerAudience = fields?.get("providerAudience");
  if (!canonicalUrl(applicationOrigin, true) || !canonicalUrl(providerIssuer, false) ||
      typeof authCookieName !== "string" || authCookieName.length < 1 || authCookieName.length > 64 || /[^A-Za-z0-9_-]/.test(authCookieName) ||
      typeof providerAudience !== "string" || providerAudience.length < 1 || providerAudience.length > 128 || NON_TOKEN_CHARACTER.test(providerAudience)) {
    return undefined;
  }
  return Object.freeze({ applicationOrigin, authCookieName, providerIssuer, providerAudience });
}

function readIdentity(accessToken: unknown, context: CredentialPairContext): CredentialPairIdentity | undefined {
  try {
    if (typeof accessToken !== "string" || accessToken.length > CREDENTIAL_PAIR_PROOF_LIMITS.maximumAccessTokenBytes) {
      return undefined;
    }
    const segments = accessToken.split(".");
    if (segments.length !== 3 || segments.some((part) => !BASE64URL.test(part) || Buffer.from(part, "base64url").toString("base64url") !== part)) {
      return undefined;
    }
    const claims: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(segments[1], "base64url")));
    if (claims === null || typeof claims !== "object" || Array.isArray(claims)) return undefined;
    const value = claims as Record<string, unknown>;
    if (value.iss !== context.providerIssuer || value.aud !== context.providerAudience ||
        typeof value.sub !== "string" || value.sub.length !== 36 || !UUID.test(value.sub) ||
        typeof value.session_id !== "string" || value.session_id.length !== 36 || !UUID.test(value.session_id) ||
        typeof value.exp !== "number" || !Number.isSafeInteger(value.exp) || value.exp <= 0) return undefined;
    return Object.freeze({
      issuer: context.providerIssuer, audience: context.providerAudience,
      subject: value.sub, sessionId: value.session_id, expiresAt: value.exp,
    });
  } catch {
    return undefined;
  }
}

// Reads only canonical claim syntax/context. The caller must already own the
// exact trusted fresh provider response; this does not verify a JWT signature.
// Kept separate so absent optional MAC configuration does not change login.
export function readTrustedCredentialPairIdentity(
  accessToken: string,
  context: CredentialPairContext,
): CredentialPairIdentity | undefined {
  const resolved = resolveCredentialPairContext(context);
  return resolved === undefined ? undefined : readIdentity(accessToken, resolved);
}

function refreshIsWellFormed(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= CREDENTIAL_PAIR_PROOF_LIMITS.maximumRefreshTokenBytes && !NON_TOKEN_CHARACTER.test(value);
}

// Wire format: for EACH UTF-8 field, uint32 big-endian byte length then its
// bytes. Fixed ordered tuple: domain, version, application origin, cookie name,
// issuer, audience, subject, provider session UUID, decimal integer expiry,
// exact access token, exact refresh token. No separators or JSON ambiguity.
function mac(key: Buffer, context: CredentialPairContext, identity: CredentialPairIdentity, accessToken: string, refreshToken: string): Buffer {
  const hash = createHmac("sha256", key);
  for (const field of [DOMAIN, VERSION, context.applicationOrigin, context.authCookieName,
    identity.issuer, identity.audience, identity.subject, identity.sessionId,
    String(identity.expiresAt), accessToken, refreshToken]) {
    const bytes = Buffer.from(field, "utf8");
    const length = Buffer.alloc(4);
    length.writeUInt32BE(bytes.length);
    hash.update(length).update(bytes);
  }
  return hash.digest();
}

export function createCredentialPairProof(
  configuration: CredentialPairContext & Readonly<{ key: Uint8Array }>,
): CredentialPairProof {
  const fields = dataRecord(configuration, ["key", "applicationOrigin", "authCookieName", "providerIssuer", "providerAudience"]);
  const suppliedKey = fields?.get("key");
  const context = resolveCredentialPairContext({
    applicationOrigin: fields?.get("applicationOrigin"), authCookieName: fields?.get("authCookieName"),
    providerIssuer: fields?.get("providerIssuer"), providerAudience: fields?.get("providerAudience"),
  });
  if (context === undefined) throw new CredentialPairProofConfigurationError();
  let key: Buffer;
  try {
    if (!(suppliedKey instanceof Uint8Array) ||
        suppliedKey.byteLength < CREDENTIAL_PAIR_PROOF_LIMITS.minimumKeyBytes ||
        suppliedKey.byteLength > CREDENTIAL_PAIR_PROOF_LIMITS.maximumKeyBytes) {
      throw new CredentialPairProofConfigurationError();
    }
    key = Buffer.from(suppliedKey); // Sever mutable caller ownership.
  } catch {
    throw new CredentialPairProofConfigurationError();
  }
  return Object.freeze({
    mintTrustedPair(pair: Parameters<CredentialPairProof["mintTrustedPair"]>[0]): string | undefined {
      try {
        const input = dataRecord(pair, ["accessToken", "refreshToken", "assertedProviderUserId"]);
        const accessToken = input?.get("accessToken");
        const refreshToken = input?.get("refreshToken");
        const identity = readIdentity(accessToken, context);
        if (identity === undefined || typeof accessToken !== "string" || !refreshIsWellFormed(refreshToken) ||
            input?.get("assertedProviderUserId") !== identity.subject) return undefined;
        return `${VERSION}.${mac(key, context, identity, accessToken, refreshToken).toString("base64url")}`;
      } catch {
        return undefined;
      }
    },
    verifyPair(pair: Parameters<CredentialPairProof["verifyPair"]>[0]): CredentialPairIdentity | undefined {
      try {
        const input = dataRecord(pair, ["accessToken", "refreshToken", "proof"]);
        const accessToken = input?.get("accessToken");
        const refreshToken = input?.get("refreshToken");
        const proof = input?.get("proof");
        if (typeof proof !== "string" || proof.length !== 46 || !/^v1\.[A-Za-z0-9_-]{43}$/.test(proof)) return undefined;
        const supplied = Buffer.from(proof.slice(3), "base64url");
        if (supplied.length !== 32 || supplied.toString("base64url") !== proof.slice(3)) return undefined;
        const identity = readIdentity(accessToken, context);
        if (identity === undefined || typeof accessToken !== "string" || !refreshIsWellFormed(refreshToken)) return undefined;
        return timingSafeEqual(supplied, mac(key, context, identity, accessToken, refreshToken)) ? identity : undefined;
      } catch {
        return undefined;
      }
    },
  });
}

// Identity-layer loader: missing, malformed or replaced key degrades only the
// optional renewal facility. No random fallback, no automatic key creation and
// no NEXT_PUBLIC alias. Canonical padded RFC4648 base64 is required. Production
// route composition must use the verifier-only loader, never this mint loader.
export function loadLoginCredentialPairProof(context: CredentialPairContext): CredentialPairProof | undefined {
  try {
    const encoded = process.env[CREDENTIAL_PAIR_PROOF_KEY_VARIABLE];
    if (typeof encoded !== "string" || encoded.length > 5464 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return undefined;
    const key = Buffer.from(encoded, "base64");
    if (key.toString("base64") !== encoded) return undefined;
    return createCredentialPairProof({ ...context, key });
  } catch {
    return undefined;
  }
}

export function loadCredentialPairVerifier(context: CredentialPairContext): CredentialPairVerifier | undefined {
  const proof = loadLoginCredentialPairProof(context);
  return proof === undefined ? undefined : Object.freeze({ verifyPair: proof.verifyPair });
}
