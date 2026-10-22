import "server-only";

import { normalizeLoginEmail } from "../auth/loginContactNormalizer";
import { normalizeAdminLoginIdentifier } from "../auth/adminLoginIdentifierNormalizer";
import { readSessionCookieEntries, resolveSessionCookiePolicy, isSessionCookieMaxAge } from "../auth/sessionCookiePolicy";
import { toVerificationChallengeIssuanceAcknowledgment, VERIFICATION_CHALLENGE_ISSUANCE_OUTCOMES,
  type VerificationChallengeIssuer, type VerificationChallengeRedeemer,
  type VerificationChallengeIssuanceAcknowledgment,
  type VerificationChallengeIssuanceRequest } from "../auth/verificationChallengeCallers";
import { VERIFICATION_CODE_DELIVERY_OUTCOMES } from "../auth/verificationCodeDelivery";
import { SOLMIND_ROLES } from "../roles";
import type { LoginAccountLookup, LoginAccountLookupResult, LoginChallengeOwnershipCheck,
  RedeemedLoginChallengeConfirmation } from "./loginAccountLookupCallers";
import type { LoginIdentityBridge } from "./loginIdentityBridge";
import type { UserSessionCreator } from "./userSessionCreationCaller";
import { writeLoginSessionCookies, type LoginSessionCookieWrite, type SessionCookieResponse } from "./loginCookieWriter";
import { parsePasswordRoleSignInSendBody, parsePasswordRoleSignInVerifyBody } from "./passwordRoleSignInBodies";

// Guide/Admin orchestration component, adopted S69 DESIGN_BRIEF_R04.md with
// REVIEW_R04.md (contact/account join). October 12 decisions 5-8; proposed
// register entries AUTH-RLS-DEC-047..050 are not yet banked. Exact sources and
// unbanked dependencies are pinned in this component's excluded evidence.
// Four fixed entry points; no request chooses role, purpose or destination.
// Guide handlers own same-origin/method/framing/query guards; Admin is dormant. Factories
// must resolve complete local configuration before returning these capabilities.
// No production defaults, environment, link exchange, retry or private slot pool.
// The response floor is an injected provisional mitigation, not constant time.
// Individual callers own deadlines; this module cannot cancel a remote commit.
// Executable ports are trusted seams: never-settling calls or discard prevent
// completion. The final factory must supply the actual bounded implementations.

export type PasswordRoleSendDependencies = Readonly<{
  issuer: VerificationChallengeIssuer;
  accountLookup: LoginAccountLookup;
}>;
export type PasswordRoleVerifyDependencies = Readonly<{
  accountLookup: LoginAccountLookup;
  ownership: LoginChallengeOwnershipCheck;
  bridge: Pick<LoginIdentityBridge, "signInWithPassword">;
  redeemer: VerificationChallengeRedeemer;
  challengeConfirmation: RedeemedLoginChallengeConfirmation;
  sessionCreator: UserSessionCreator;
}>;
export type PasswordRoleSignInPorts = Readonly<{
  now(): number;
  epochSeconds(): number;
  waitUntil(answerAt: number): Promise<void>;
  responseFloorMilliseconds: number;
  createSendDependencies(trustedOrigin: string): PasswordRoleSendDependencies;
  createVerifyDependencies(trustedOrigin: string): PasswordRoleVerifyDependencies;
}>;
export type PasswordRoleCodeRequest = Readonly<{ trustedOrigin: string; body: unknown }>;
export type PasswordRoleVerification<Response extends SessionCookieResponse> = Readonly<{
  trustedOrigin: string;
  body: unknown;
  // Names only: every value is empty. Reject credentials instead of discarding them.
  requestCookies: LoginSessionCookieWrite["requestCookies"];
  createSuccessResponse(): Response;
}>;
type Denied = Readonly<{ outcome: "denied" }>;
type NotMatched = Readonly<{ outcome: "not_matched" }>;
export type PasswordRoleSendResult = VerificationChallengeIssuanceAcknowledgment | Denied |
  Readonly<{ outcome: "invalid_email" | "invalid_identifier" }>;
export type PasswordRoleVerifyResult<Response extends SessionCookieResponse> = Denied | NotMatched |
  Readonly<{ outcome: "signed_in"; response: Response }>;

type Role = typeof SOLMIND_ROLES.GUIDE | typeof SOLMIND_ROLES.ADMIN;
type Found = Extract<LoginAccountLookupResult, { outcome: "found" }>;
type Call = (...args: unknown[]) => unknown;
type Clock = Readonly<{ answerAt: number; now: Call; epoch: Call; wait: Call; send: Call; verify: Call }>;
const DENIED: Denied = Object.freeze({ outcome: "denied" });
const NOT_MATCHED: NotMatched = Object.freeze({ outcome: "not_matched" });
const INVALID_EMAIL = Object.freeze({ outcome: "invalid_email" as const });
const INVALID_IDENTIFIER = Object.freeze({ outcome: "invalid_identifier" as const });
const PURPOSE = "login" as const;
// The public issuer generates its selector before validating this invalid shape;
// it takes no slot, calls no database and sends no mail. Null bindings are NOT a spare.
const SPARE = Object.freeze({}) as VerificationChallengeIssuanceRequest;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const COOKIE_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

// Snapshot data descriptors once; never invoke field getters or inspect errors.
// Standard reflection may execute Proxy traps, which cannot be time-bounded here.
function record(value: unknown, keys: ReadonlyArray<string>): Map<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return null;
    const names = Reflect.ownKeys(value);
    if (names.length !== keys.length || !names.every(k => typeof k === "string" && keys.includes(k))) return null;
    const fields = new Map<string, unknown>();
    for (const key of keys) {
      const d = Object.getOwnPropertyDescriptor(value, key);
      if (d === undefined || !d.enumerable || !Object.prototype.hasOwnProperty.call(d, "value")) return null;
      fields.set(key, d.value);
    }
    return fields;
  } catch { return null; }
}
function own(value: unknown, key: string): unknown {
  try {
    if (value === null || typeof value !== "object") return undefined;
    const d = Object.getOwnPropertyDescriptor(value, key);
    return d !== undefined && Object.prototype.hasOwnProperty.call(d, "value") ? d.value : undefined;
  } catch { return undefined; }
}
function callable(owner: unknown, value: unknown): Call | null {
  return typeof value === "function" ? (...args) => Reflect.apply(value, owner, args) : null;
}
function method(owner: unknown, name: string): Call | null {
  const fields = record(owner, [name]);
  return fields === null ? null : callable(owner, fields.get(name));
}
function uuid(value: unknown): value is string { return typeof value === "string" && value.length === 36 && UUID.test(value); }
function resultIs(value: unknown, outcome: string): boolean { return record(value, ["outcome"])?.get("outcome") === outcome; }
function isRole(role: unknown): role is Role { return role === SOLMIND_ROLES.GUIDE || role === SOLMIND_ROLES.ADMIN; }
function identifier(role: Role, value: string): Readonly<{ identifierType: "email" | "username"; normalizedIdentifier: string }> | null {
  if (role === SOLMIND_ROLES.ADMIN) return normalizeAdminLoginIdentifier(value);
  const email = normalizeLoginEmail(value);
  return email === null ? null : Object.freeze({ identifierType: "email", normalizedIdentifier: email });
}
function clock(ports: unknown): Clock | null {
  const p = record(ports, ["now", "epochSeconds", "waitUntil", "responseFloorMilliseconds", "createSendDependencies", "createVerifyDependencies"]);
  if (p === null) return null;
  const now = callable(ports, p.get("now")); const wait = callable(ports, p.get("waitUntil"));
  const epoch = callable(ports, p.get("epochSeconds"));
  const send = callable(ports, p.get("createSendDependencies")); const verify = callable(ports, p.get("createVerifyDependencies"));
  const floor = p.get("responseFloorMilliseconds");
  if (now === null || epoch === null || wait === null || send === null || verify === null || typeof floor !== "number" || !Number.isFinite(floor) || floor <= 0) return null;
  const started = now();
  if (typeof started !== "number" || !Number.isFinite(started) || started < 0 || !Number.isFinite(started + floor)) return null;
  return Object.freeze({ answerAt: started + floor, now, epoch, wait, send, verify });
}
async function wait(c: Clock): Promise<void> { try { await c.wait(c.answerAt); } catch { /* Keep the selected answer. */ } }
function found(answer: unknown): Found | null {
  const a = record(answer, ["outcome", "userAccountId", "userContactMethodId", "normalizedEmail", "providerUserId"]);
  if (a === null || a.get("outcome") !== "found" || !uuid(a.get("userAccountId")) || !uuid(a.get("userContactMethodId")) ||
      !uuid(a.get("providerUserId")) || typeof a.get("normalizedEmail") !== "string" || a.get("normalizedEmail") === "") return null;
  return Object.freeze({ outcome: "found", userAccountId: a.get("userAccountId") as string,
    userContactMethodId: a.get("userContactMethodId") as string, normalizedEmail: a.get("normalizedEmail") as string,
    providerUserId: a.get("providerUserId") as string });
}
function acknowledgment(answer: unknown): VerificationChallengeIssuanceAcknowledgment | null {
  const outcome = own(answer, "outcome");
  const a = record(answer, outcome === "issued" ? ["outcome", "challengeId", "delivery"] : ["outcome", "challengeId"]);
  if (a === null || a.get("outcome") !== outcome || typeof outcome !== "string" ||
      !(VERIFICATION_CHALLENGE_ISSUANCE_OUTCOMES as ReadonlyArray<string>).includes(outcome) || !uuid(a.get("challengeId")) ||
      (outcome === "issued" && a.get("delivery") !== "not_attempted" &&
       !(VERIFICATION_CODE_DELIVERY_OUTCOMES as ReadonlyArray<unknown>).includes(a.get("delivery")))) return null;
  // Only the validated selector is exposed; internal issuance/delivery status proves nothing publicly.
  return toVerificationChallengeIssuanceAcknowledgment({ outcome: "failed", challengeId: a.get("challengeId") as string });
}
function origin(value: unknown): value is string {
  const policy = resolveSessionCookiePolicy(value);
  // Current mail/configuration integration is local-only, as in the adopted design.
  return policy !== null && policy.environment === "loopback";
}

async function send(role: Role, request: PasswordRoleCodeRequest, ports: PasswordRoleSignInPorts): Promise<PasswordRoleSendResult> {
  let c: Clock; let lookup: Call; let issue: Call; let id: NonNullable<ReturnType<typeof identifier>>;
  let ack: VerificationChallengeIssuanceAcknowledgment;
  try {
    if (!isRole(role)) return DENIED;
    const timing = clock(ports); const r = record(request, ["trustedOrigin", "body"]);
    if (timing === null || r === null || !origin(r.get("trustedOrigin"))) return DENIED;
    const body = parsePasswordRoleSignInSendBody(r.get("body"));
    if (body === null) return DENIED;
    const normalized = identifier(role, body.identifier);
    if (normalized === null) return role === SOLMIND_ROLES.GUIDE ? INVALID_EMAIL : INVALID_IDENTIFIER;
    const d = record(timing.send(r.get("trustedOrigin")), ["issuer", "accountLookup"]);
    const issuing = method(d?.get("issuer"), "issue"); const resolving = method(d?.get("accountLookup"), "resolve");
    if (issuing === null || resolving === null) return DENIED;
    const spare = acknowledgment(await issuing(SPARE));
    if (spare === null) return DENIED;
    c = timing; lookup = resolving; issue = issuing; id = normalized; ack = spare;
  } catch { return DENIED; }
  try {
    const account = found(await lookup(Object.freeze({ ...id, requestedRoleContext: role })));
    if (account !== null) {
      const next = acknowledgment(await issue(Object.freeze({ purpose: PURPOSE, contactMethodType: "email",
        normalizedContact: account.normalizedEmail, userAccountId: account.userAccountId, userContactMethodId: account.userContactMethodId })));
      if (next !== null) ack = next;
    }
  } catch { /* The acknowledgment was fully prepared before lookup. */ }
  await wait(c);
  return ack;
}

type VerifyCalls = Readonly<{ lookup: Call; ownership: Call; password: Call; redeem: Call; confirm: Call; session: Call }>;
function verificationCalls(value: unknown): VerifyCalls | null {
  const d = record(value, ["accountLookup", "ownership", "bridge", "redeemer", "challengeConfirmation", "sessionCreator"]);
  if (d === null) return null;
  const lookup = method(d.get("accountLookup"), "resolve"); const ownership = method(d.get("ownership"), "check");
  const password = method(d.get("bridge"), "signInWithPassword"); const redeem = method(d.get("redeemer"), "redeem");
  const confirm = method(d.get("challengeConfirmation"), "confirm"); const session = method(d.get("sessionCreator"), "create");
  return lookup && ownership && password && redeem && confirm && session ? Object.freeze({ lookup, ownership, password, redeem, confirm, session }) : null;
}
type Hold = Readonly<{ expiresAt: number; assert: Call; prepare: Call; release: Call }>;
function held(answer: unknown, candidate: unknown): Hold | null {
  const a = record(answer, ["outcome", "hold"]);
  const h = record(candidate, ["accessTokenExpiresAt", "assertProviderUser", "prepareAcceptedSession", "release", "discard"]);
  if (a === null || a.get("outcome") !== "held" || a.get("hold") !== candidate || h === null) return null;
  const expiry = h.get("accessTokenExpiresAt"); const assertion = callable(candidate, h.get("assertProviderUser"));
  const release = callable(candidate, h.get("release"));
  const prepare = callable(candidate, h.get("prepareAcceptedSession"));
  if (typeof expiry !== "number" || !Number.isSafeInteger(expiry) || expiry <= 0 || assertion === null || prepare === null || release === null || typeof h.get("discard") !== "function") return null;
  return Object.freeze({ expiresAt: expiry, assert: assertion, prepare, release });
}
async function verify<Response extends SessionCookieResponse>(role: Role, request: PasswordRoleVerification<Response>, ports: PasswordRoleSignInPorts): Promise<PasswordRoleVerifyResult<Response>> {
  let c: Clock; let deps: VerifyCalls; let body: NonNullable<ReturnType<typeof parsePasswordRoleSignInVerifyBody>>;
  let id: NonNullable<ReturnType<typeof identifier>>; let trustedOrigin: string;
  let cookies: LoginSessionCookieWrite["requestCookies"]; let makeResponse: Call;
  try {
    if (!isRole(role)) return DENIED;
    const timing = clock(ports); const r = record(request, ["trustedOrigin", "body", "requestCookies", "createSuccessResponse"]);
    if (timing === null || r === null || !origin(r.get("trustedOrigin"))) return DENIED;
    const parsed = parsePasswordRoleSignInVerifyBody(r.get("body"));
    if (parsed === null) return DENIED;
    const normalized = identifier(role, parsed.identifier);
    const names = readSessionCookieEntries(r.get("requestCookies"), false);
    const response = callable(request, r.get("createSuccessResponse"));
    if (normalized === null || names === null || response === null || names.some(x => x.value !== "" || COOKIE_NAME.exec(x.name)?.[0] !== x.name)) return DENIED;
    const calls = verificationCalls(timing.verify(r.get("trustedOrigin")));
    if (calls === null) return DENIED;
    c = timing; deps = calls; body = parsed; id = normalized; cookies = names;
    trustedOrigin = r.get("trustedOrigin") as string; makeResponse = response;
  } catch { return DENIED; }

  let cleanup: Call | null = null; let complete = false; let factors = false;
  const run = async (): Promise<PasswordRoleVerifyResult<Response>> => {
    try {
      const account = found(await deps.lookup(Object.freeze({ ...id, requestedRoleContext: role })));
      if (account === null) return NOT_MATCHED;
      if (!resultIs(await deps.ownership(Object.freeze({ userAccountId: account.userAccountId, challengeId: body.challengeId })), "owned")) return NOT_MATCHED;
      const password = await deps.password(Object.freeze({ email: account.normalizedEmail, password: body.password }));
      const candidate = own(password, "hold");
      // Take the recoverable cleanup capability before validating any other hold field.
      cleanup = callable(candidate, own(candidate, "discard"));
      const hold = held(password, candidate);
      if (hold === null || cleanup === null) return NOT_MATCHED;
      if (!resultIs(await deps.redeem(Object.freeze({ purpose: PURPOSE, challengeId: body.challengeId, code: body.code })), "redeemed")) return NOT_MATCHED;
      if (!resultIs(await hold.assert(account.providerUserId), "asserted")) return NOT_MATCHED;
      if (!resultIs(await deps.confirm(Object.freeze({ userAccountId: account.userAccountId, challengeId: body.challengeId, expectedPurpose: PURPOSE })), "confirmed")) return NOT_MATCHED;
      factors = true;
      const result = record(await deps.session(Object.freeze({ userAccountId: account.userAccountId, activeRoleContext: role,
        challengeId: body.challengeId, providerAccessTokenExpiresAt: hold.expiresAt })), ["outcome", "sessionId", "maxAgeSeconds"]);
      const outcome = result?.get("outcome");
      if (result === null || (outcome !== "created" && outcome !== "existing") || !uuid(result.get("sessionId")) || !isSessionCookieMaxAge(result.get("maxAgeSeconds"))) return DENIED;
      // The current logout predecessor prepares optional prior-session cleanup
      // only after this request's factors and session are accepted. Its bounded
      // wait consumes cookie lifetime; it never renews the fresh provider token.
      const sessionAnsweredAt = c.now();
      if (typeof sessionAnsweredAt !== "number" || !Number.isFinite(sessionAnsweredAt) || sessionAnsweredAt < 0) return DENIED;
      await hold.prepare(Object.freeze({ sessionOutcome: outcome }));
      const answeredAt = c.now(); const epoch = c.epoch();
      if (typeof answeredAt !== "number" || typeof epoch !== "number" || !Number.isFinite(answeredAt) || !Number.isFinite(epoch) || epoch < 0) return DENIED;
      const elapsed = answeredAt - sessionAnsweredAt;
      const maxAgeSeconds = Math.min((result.get("maxAgeSeconds") as number) - Math.ceil(elapsed / 1000), Math.floor(hold.expiresAt - epoch));
      if (!Number.isFinite(elapsed) || elapsed < 0 || !isSessionCookieMaxAge(maxAgeSeconds)) return DENIED;
      const release = record(hold.release(Object.freeze({ sessionOutcome: outcome })), ["outcome", "heldCookies"]);
      if (release === null || release.get("outcome") !== "released") return DENIED;
      const response = makeResponse() as Response;
      const written = writeLoginSessionCookies({ trustedOrigin, heldCookies: release.get("heldCookies") as LoginSessionCookieWrite["heldCookies"],
        requestCookies: cookies, sessionId: result.get("sessionId") as string, maxAgeSeconds, response });
      if (written.outcome !== "written") return DENIED;
      const success = Object.freeze({ outcome: "signed_in" as const, response });
      complete = true;
      return success;
    } catch { return factors ? DENIED : NOT_MATCHED; }
    finally {
      if (!complete && cleanup !== null) { try { await cleanup(); } catch { /* Cleanup cannot turn refusal into success. */ } }
    }
  };
  const result = await run();
  if (result.outcome !== "signed_in") await wait(c);
  return result;
}

export function requestGuideSignInCode(request: PasswordRoleCodeRequest, ports: PasswordRoleSignInPorts): Promise<PasswordRoleSendResult> {
  return send(SOLMIND_ROLES.GUIDE, request, ports);
}
export function requestAdminSignInCode(request: PasswordRoleCodeRequest, ports: PasswordRoleSignInPorts): Promise<PasswordRoleSendResult> {
  return send(SOLMIND_ROLES.ADMIN, request, ports);
}
export function verifyGuideSignIn<Response extends SessionCookieResponse>(request: PasswordRoleVerification<Response>, ports: PasswordRoleSignInPorts): Promise<PasswordRoleVerifyResult<Response>> {
  return verify(SOLMIND_ROLES.GUIDE, request, ports);
}
export function verifyAdminSignIn<Response extends SessionCookieResponse>(request: PasswordRoleVerification<Response>, ports: PasswordRoleSignInPorts): Promise<PasswordRoleVerifyResult<Response>> {
  return verify(SOLMIND_ROLES.ADMIN, request, ports);
}
