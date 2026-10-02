// RESTRICTED test-only Auth probe core for the local Supabase Auth provider probes.
// It accepts injected clients and request functions, so only the restricted run core
// (`providerProbeRunCore.ts`, which builds them over the gated, fixed-target production
// Auth transport) and named unit tests may import it; `providerProbeModuleBoundary.test.ts`
// enforces that.
//
// Every operation returns value-free facts (closed kinds, counts, booleans) and opaque
// handles. Tokens, token hashes, links, codes, passwords and user ids stay inside this
// module (and the admin core), are registered in the run's known-value registry the
// moment they arrive, and are never returned.
//
// Users. Every operation that might create a user does so at an address this run minted
// for that one request (R6: the anonymous and phone sign-up attempts, which had no
// minted address, are removed). It takes a ledger reservation first, so capacity is
// checked before any request and cleanup cannot start while it is open.
// - A user whose id comes back from the run's own creating request is committed at once
//   (a receipt for that id).
// - A creating request that returns no id is followed, while the reservation is still
//   open, by a listing of the local users. Only a user whose address equals the address
//   this run minted for that request (80 random bits, known only to this run) is
//   adopted, by its id. Nothing else found in a listing is ever deleted.
// - (R6) Every reservation that has not been committed is released in a `finally`, on
//   every path, including a listing or registry failure; committed receipts are kept,
//   so cleanup can always start and always deletes what was committed.
// - (R8) If that follow-up listing fails, any answer without a usable id (lost, failed,
//   id-less, and also a refusal confirmed by status and code, since a server can refuse
//   and still create a user) may have created a user that cannot be attributed: it is
//   reported as one unresolved user (`usersUntracked`), which makes the probe core stop
//   every further effect. Nothing is deleted by a guess. Only when every attempt returned
//   its id is a listing failure a failed check, rethrown (PP-08).
// - (R9) Settlement is delivered before any processing that can throw. Every creating path
//   (`settleCreation` for the sign-up surfaces and PP-09, PP-08's own settlement, and the
//   admin fixtures) first commits every user it can attribute and adds every unresolved
//   user to the run's creation count (`unresolvedCreations`), and only then registers ids,
//   holds a session or registers the link's properties. An exception there fails the
//   record, and the count is not lost: the probe core reads it after every step.
// - (R10) An unresolved admin creation adds the count the admin core reports (every
//   located user that could not get a receipt, at least one), never a fixed one. Where
//   the count is unknown (a failed listing after an id-less answer, one per attempt), the
//   minimum, one, is counted.
// - (R11, re-check #128f) That count is conservative, not exact: it is at least one per
//   unresolved creation, so when every located user was tracked it is one more than can
//   exist untracked, and when a listing failed the true number may be higher or none.
//   PP-12 checks only whether any run-tagged user or message is left (it reports no
//   number), and a completed creation that every listing omits stays undetectable.
// - (R7) The admin fixtures (`createExplorer`, `createPasswordUser`) give the admin core a
//   locator, so a failed or id-less creation is reconciled by its exact minted address
//   while the admin's reservation stays open; a reconciled creation is tracked but never
//   a pass, and an unresolved one is reported as one untracked user.
//
// Answers. `classifyAuthError` decides by status first (R7): no answer (status 0) is a
// transport failure and a non-4xx status is unexpected, whatever code came with it.
// (R7) A refusal counts as confirmed only through `providerProbeIsConfirmedRefusal`: a
// refusal status and a code from the table for the surface that was attempted
// (`PROVIDER_PROBE_REFUSALS`). The disabled-provider answer is matched (status, code and
// message) in memory, and only a boolean leaves.
//
// Sessions. A session is held as an opaque handle: its tokens are registered and kept
// here, and the probe core may only ask whether it belongs to a user, whether the
// server still recognizes it, what its lifetime fields say, and to sign it out. (R6) A
// session whose access or refresh token is not a string of at least the registry's
// minimum length is refused as malformed, so every token held is registered. (R7) A
// session is held whenever an answer carries one, whatever its error, so it is always
// signed out; an error answer that carries a session is contradictory and never passes.
// (R8) That includes the existing-account email send, whose data is now inspected too.

import { randomBytes } from "node:crypto";

import type { ProviderProbeSafetyConfig } from "../../src/lib/solmind/supabase/__tests__/providerProbeConfig";
import {
  authUserRecordForHandle,
  mintRunRecipient,
  type ProviderProbeAuthAdmin,
  type ProviderProbeAuthUserHandle,
  type ProviderProbeRandomSource,
} from "./providerProbeAuthAdminCore";
import type { ProviderProbeCleanupLedger, ProviderProbeCleanupReservation } from "./providerProbeCleanupLedger";
import {
  addRunOwnedRecipient,
  isRunOwnedRecipientsRecord,
  isValidCleanupId,
  issueCleanupReceipt,
  type ProviderProbeRunOwnedRecipients,
} from "./providerProbeCleanupReceipts";
import {
  isProviderProbeKnownValueRegistry,
  PROVIDER_PROBE_OUTPUT_LIMITS,
  type ProviderProbeKnownValueRegistry,
} from "./providerProbeRunEnvelope";

export type { ProviderProbeAuthUserHandle };

// Closed classification of an Auth answer. Messages and bodies are never kept.
export type ProviderProbeAuthErrorKind =
  | "none"
  | "refused"
  | "invalid-credentials"
  | "expired-or-invalid"
  | "duplicate"
  | "rate-limited"
  | "validation"
  | "not-found"
  | "transport"
  | "unexpected";

export type ProviderProbeSessionHandle = Readonly<{ readonly kind: "provider-probe-session" }>;
export type ProviderProbeLinkHandle = Readonly<{ readonly kind: "provider-probe-link" }>;

// R7: the surfaces whose refusal is checked, each with its own valid refusal statuses and
// GoTrue codes (PROVIDER_PROBE_REFUSALS below).
export type ProviderProbeRefusalSurface =
  | "email-sign-up"
  | "email-code-sign-up"
  | "email-code-missing-address"
  | "existing-account-send"
  | "link-replay"
  | "duplicate-create"
  | "missing-user-link";

export type ProviderProbeCreationFacts = Readonly<{
  errorKind: ProviderProbeAuthErrorKind;
  // R7: a valid refusal status and a code this surface refuses with, and no session.
  confirmedRefusal: boolean;
  // R7: an error answer that also carried a session (held for sign-out, never a pass).
  contradictory: boolean;
  usersCreated: number;
  usersUntracked: number;
  session: ProviderProbeSessionHandle | null;
}>;

export type ProviderProbeUserFacts = Readonly<{
  found: boolean;
  emailMatches: boolean;
  anonymous: boolean;
  hasPhone: boolean;
}>;

export type ProviderProbeUserListing = Readonly<{
  runTaggedUsers: number;
  totalUsers: number;
}>;

export type ProviderProbeLinkFacts = Readonly<{
  errorKind: ProviderProbeAuthErrorKind;
  userIdMatched: boolean;
  propertyKeysExact: boolean;
  verificationTypeMagiclink: boolean;
  hashedTokenPresent: boolean;
  link: ProviderProbeLinkHandle | null;
}>;

export type ProviderProbeSignInFacts = Readonly<{
  errorKind: ProviderProbeAuthErrorKind;
  session: ProviderProbeSessionHandle | null;
  // R7: an error answer that also carried a session (held for sign-out, never a pass).
  contradictory: boolean;
  // R7: for a link exchange, a confirmed expired-or-invalid refusal (status and code).
  confirmedRefusal: boolean;
}>;

export type ProviderProbeCreatedFixture = Readonly<{
  errorKind: ProviderProbeAuthErrorKind;
  user: ProviderProbeAuthUserHandle | null;
  emailMatched: boolean;
  // R7: the creation answer failed or carried no id, and was reconciled by its minted address.
  reconciled: boolean;
  // R7: a user the creation may have made that could not be attributed (reported, value-free).
  usersUntracked: number;
}>;

export type ProviderProbeLifetimeFacts = Readonly<{
  expiresIn: number;
  expiresAt: number;
  jwtExp: number;
  jwtIat: number;
  receivedAtSeconds: number;
}>;

export type ProviderProbeRawAuthRequest =
  | Readonly<{ kind: "health" }>
  | Readonly<{ kind: "authorize-disabled-provider" }>
  | Readonly<{ kind: "list-users"; page: number }>;

export type ProviderProbeRawAuthAnswer = Readonly<{
  status: number;
  redirectRefused: boolean;
  transportFailed: boolean;
  totalCount: number | null;
  json: unknown;
}>;

export type ProviderProbeMailCredentials = Readonly<{
  messageFound: boolean;
  code: string | null;
  tokenHash: string | null;
}>;

// The narrow structural slices of supabase-js clients that this core uses.
export type ProviderProbePublicClient = Readonly<{
  auth: Readonly<{
    signUp(credentials: Readonly<Record<string, unknown>>): Promise<unknown>;
    signInWithOtp(credentials: Readonly<Record<string, unknown>>): Promise<unknown>;
    signInWithPassword(credentials: Readonly<Record<string, unknown>>): Promise<unknown>;
    verifyOtp(params: Readonly<Record<string, unknown>>): Promise<unknown>;
    getUser(jwt: string): Promise<unknown>;
  }>;
}>;

export type ProviderProbeAdminProbeClient = Readonly<{
  auth: Readonly<{
    admin: Readonly<{
      createUser(attributes: Readonly<Record<string, unknown>>): Promise<unknown>;
      generateLink(params: Readonly<Record<string, unknown>>): Promise<unknown>;
      getUserById(id: string): Promise<unknown>;
      signOut(jwt: string, scope?: "global" | "local" | "others"): Promise<unknown>;
    }>;
  }>;
}>;

export type ProviderProbeAuthProbe = Readonly<{
  // R9: how many creations so far could not be attributed (delivered at settlement).
  unresolvedCreations(): number;
  checkHealth(): Promise<boolean>;
  listUsers(): Promise<ProviderProbeUserListing>;
  createExplorer(): Promise<ProviderProbeCreatedFixture>;
  createPasswordUser(): Promise<ProviderProbeCreatedFixture>;
  describeUser(user: ProviderProbeAuthUserHandle): Promise<ProviderProbeUserFacts>;
  countUsersWithAddressOf(user: ProviderProbeAuthUserHandle): Promise<number>;
  generateMagicLink(user: ProviderProbeAuthUserHandle): Promise<ProviderProbeLinkFacts>;
  verifyLink(link: ProviderProbeLinkHandle): Promise<ProviderProbeSignInFacts>;
  sessionBelongsTo(session: ProviderProbeSessionHandle, user: ProviderProbeAuthUserHandle): boolean;
  serverRecognizes(session: ProviderProbeSessionHandle, user: ProviderProbeAuthUserHandle): Promise<boolean>;
  lifetimeOf(session: ProviderProbeSessionHandle): ProviderProbeLifetimeFacts | null;
  signOut(session: ProviderProbeSessionHandle): Promise<boolean>;
  openSessions(): readonly ProviderProbeSessionHandle[];
  sessionsOpened(): number;
  trySignUpWithPassword(): Promise<ProviderProbeCreationFacts>;
  tryEmailCodeSignUp(): Promise<ProviderProbeCreationFacts>;
  tryEmailCodeForMissingAddress(): Promise<ProviderProbeCreationFacts>;
  tryDisabledProvider(): Promise<Readonly<{ confirmedRefusal: boolean; redirected: boolean; transportFailed: boolean }>>;
  sendExistingAccountEmail(
    user: ProviderProbeAuthUserHandle,
  ): Promise<Readonly<{ errorKind: ProviderProbeAuthErrorKind; confirmedRefusal: boolean; session: ProviderProbeSessionHandle | null }>>;
  verifyFromNewMessage(user: ProviderProbeAuthUserHandle, mode: "code" | "link"): Promise<Readonly<{ credentialFound: boolean; result: ProviderProbeSignInFacts }>>;
  passwordSignIn(user: ProviderProbeAuthUserHandle, mode: "correct" | "wrong"): Promise<ProviderProbeSignInFacts>;
  passwordSignInUnknownAddress(): Promise<ProviderProbeSignInFacts>;
  duplicateCreate(): Promise<Readonly<{ successes: number; duplicateRefusals: number; otherErrors: number; located: number; usersCreated: number; usersUntracked: number }>>;
  generateLinkForMissingAddress(): Promise<Readonly<{ errorKind: ProviderProbeAuthErrorKind; confirmedNotFound: boolean; createdOnMissing: boolean; usersCreated: number; usersUntracked: number }>>;
}>;

export const PROVIDER_PROBE_AUTH_LIMITS = Object.freeze({
  userPageSize: 50,
  maxUserPages: 20,
  maxListingPasses: 4,
  maxOpenSessions: 10,
  disabledProvider: "apple",
});

// GoTrue's own codes for "this surface is closed by policy", and (R7) the refusal statuses
// they must come with. This is only the general classification (an error class); no pass
// depends on it: every pass uses the stricter per-surface table below.
const POLICY_REFUSAL_CODES = ["signup_disabled", "otp_disabled", "email_provider_disabled", "provider_disabled"];
const POLICY_REFUSAL_STATUSES = [400, 403, 422];

// R7: one table of what counts as a confirmed refusal, per attempted surface: an HTTP
// client-error status GoTrue uses for that refusal and a code that surface refuses with.
// A status-0 (transport) answer, a 5xx, a 401 or 404 from a gateway, a code from another
// surface, or any other answer is never a confirmed refusal. UNVERIFIED against the GoTrue
// that Supabase CLI 2.115.0 starts: a wrong guess fails the record, never passes it.
export const PROVIDER_PROBE_REFUSALS: Readonly<
  Record<ProviderProbeRefusalSurface, Readonly<{ statuses: readonly number[]; codes: readonly string[] }>>
> = Object.freeze({
  "email-sign-up": Object.freeze({ statuses: Object.freeze([400, 403, 422]), codes: Object.freeze(["signup_disabled", "email_provider_disabled"]) }),
  "email-code-sign-up": Object.freeze({
    statuses: Object.freeze([400, 403, 422]),
    codes: Object.freeze(["signup_disabled", "otp_disabled", "email_provider_disabled"]),
  }),
  "email-code-missing-address": Object.freeze({
    statuses: Object.freeze([400, 403, 422]),
    codes: Object.freeze(["otp_disabled", "signup_disabled", "email_provider_disabled"]),
  }),
  "existing-account-send": Object.freeze({ statuses: Object.freeze([400, 403, 422]), codes: Object.freeze(["email_provider_disabled", "otp_disabled"]) }),
  "link-replay": Object.freeze({ statuses: Object.freeze([400, 403]), codes: Object.freeze(["otp_expired"]) }),
  "duplicate-create": Object.freeze({ statuses: Object.freeze([400, 409, 422]), codes: Object.freeze(["email_exists", "user_already_exists"]) }),
  "missing-user-link": Object.freeze({ statuses: Object.freeze([404]), codes: Object.freeze(["user_not_found"]) }),
});

// R7: true only for an answer with a valid refusal status and code for this surface.
export function providerProbeIsConfirmedRefusal(error: unknown, surface: ProviderProbeRefusalSurface): boolean {
  if (error === null || error === undefined || typeof error !== "object") {
    return false;
  }
  const rule = PROVIDER_PROBE_REFUSALS[surface];
  const { status, code } = error as { status?: unknown; code?: unknown };
  return (
    rule !== undefined &&
    Number.isSafeInteger(status) &&
    rule.statuses.includes(status as number) &&
    typeof code === "string" &&
    rule.codes.includes(code)
  );
}

// The disabled-provider authorize answer that counts as a confirmed refusal: GoTrue's
// "Unsupported provider: provider is not enabled", a 400 with `validation_failed` (R7: and
// that message, matched in memory and never returned; UNVERIFIED for the pinned stack). A
// redirect, a transport failure, a gateway 401/404, an unrelated `validation_failed` or
// any other answer is not one.
const DISABLED_PROVIDER_REFUSAL = Object.freeze({ status: 400, code: "validation_failed", message: /provider is not enabled/i });

const EXPECTED_LINK_PROPERTY_KEYS = ["action_link", "email_otp", "hashed_token", "redirect_to", "verification_type"];
const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

type SessionRecord = {
  accessToken: string;
  userId: string | null;
  expiresIn: number;
  expiresAt: number;
  receivedAtSeconds: number;
  signedOut: boolean;
};

type ListedUser = Readonly<{ id: string; email: string | null; anonymous: boolean; phone: boolean }>;

function fail(code: string): never {
  throw new Error(code);
}

export function classifyAuthError(error: unknown): ProviderProbeAuthErrorKind {
  if (error === null || error === undefined) {
    return "none";
  }
  const record = (typeof error === "object" ? error : {}) as { status?: unknown; code?: unknown; name?: unknown };
  const status = Number.isSafeInteger(record.status) ? (record.status as number) : 0;
  const code = typeof record.code === "string" ? record.code : "";
  // R7: the status decides first. No answer (status 0) is a transport failure and a
  // server error is unexpected, whatever code came with them; a code counts only on a
  // client-error status.
  if (status === 0) {
    return "transport";
  }
  if (status === 429 || ((code === "over_request_rate_limit" || code === "over_email_send_rate_limit") && status >= 400 && status <= 499)) {
    return "rate-limited";
  }
  if (status < 400 || status > 499) {
    return "unexpected";
  }
  if (POLICY_REFUSAL_CODES.includes(code) && POLICY_REFUSAL_STATUSES.includes(status)) {
    return "refused";
  }
  if (code === "invalid_credentials") {
    return "invalid-credentials";
  }
  if (code === "otp_expired" || code === "flow_state_expired" || code === "bad_jwt") {
    return "expired-or-invalid";
  }
  if (code === "email_exists" || code === "user_already_exists" || code === "phone_exists") {
    return "duplicate";
  }
  if (code === "user_not_found") {
    return "not-found";
  }
  if (code === "validation_failed" || code === "email_address_invalid" || code === "weak_password") {
    return "validation";
  }
  // Any other answer, including a 403 or 422 without a policy-refusal code, is not a
  // confirmed refusal.
  return "unexpected";
}

type HeldReservation = Readonly<{
  commit(receipt: unknown): void;
  releaseIfOpen(): void;
}>;

// Wraps a ledger reservation so a `finally` can release it if, and only if, it was never
// committed. A commit settles the ledger's reservation first (so a later failure inside
// the commit still leaves nothing outstanding).
function holdReservation(reservation: ProviderProbeCleanupReservation): HeldReservation {
  let open = true;
  return Object.freeze({
    commit(receipt: unknown): void {
      open = false;
      reservation.commit(receipt);
    },
    releaseIfOpen(): void {
      if (open) {
        open = false;
        reservation.release();
      }
    },
  });
}

// Five bits from each random byte, so 24 bytes give 120 bits.
function secretCharacters(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) {
    output += BASE32[byte & 31];
  }
  return output;
}

function decodeJwtTimes(token: string): Readonly<{ exp: number; iat: number }> | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as Record<string, unknown>;
    const { exp, iat } = payload;
    return Number.isSafeInteger(exp) && Number.isSafeInteger(iat) ? { exp: exp as number, iat: iat as number } : null;
  } catch {
    return null;
  }
}

function resultOf(raw: unknown): Readonly<{ data: Record<string, unknown> | null; error: unknown }> {
  if (!raw || typeof raw !== "object") {
    return { data: null, error: { status: 0 } };
  }
  const { data, error } = raw as { data?: unknown; error?: unknown };
  return {
    data: data && typeof data === "object" ? (data as Record<string, unknown>) : null,
    error: error ?? null,
  };
}

// R10: the unresolved count an admin creation reported: its `unresolvedUsers` when that is
// a positive whole number, and otherwise one (the minimum for an unresolved creation).
function unresolvedUsersOf(error: unknown): number {
  const count = error !== null && typeof error === "object" ? (error as { unresolvedUsers?: unknown }).unresolvedUsers : undefined;
  return Number.isSafeInteger(count) && (count as number) >= 1 ? (count as number) : 1;
}

// R7: whether an answer's data carries a session object at all (whatever its error).
function carriesSession(data: Record<string, unknown> | null): boolean {
  return !!data?.session && typeof data.session === "object";
}

function userIdOf(value: unknown): string | null {
  const id = value && typeof value === "object" ? (value as { id?: unknown }).id : undefined;
  return isValidCleanupId("auth-user", id) ? id : null;
}

export function createAuthProbeOperations(
  input: Readonly<{
    config: ProviderProbeSafetyConfig;
    adminOps: ProviderProbeAuthAdmin;
    adminClient: ProviderProbeAdminProbeClient;
    createPublicClient: () => ProviderProbePublicClient;
    rawRequest: (request: ProviderProbeRawAuthRequest) => Promise<ProviderProbeRawAuthAnswer>;
    readMailCredentials: (address: string) => Promise<ProviderProbeMailCredentials>;
    markMailSeen: (address: string) => Promise<void>;
    ledger: ProviderProbeCleanupLedger;
    registry: ProviderProbeKnownValueRegistry;
    ownedRecipients: ProviderProbeRunOwnedRecipients;
    nowSeconds: () => number;
    random?: ProviderProbeRandomSource;
  }>,
): ProviderProbeAuthProbe {
  const { config, adminOps, ledger, registry, ownedRecipients } = input;
  const random: ProviderProbeRandomSource = input.random ?? ((size) => randomBytes(size));
  const admin = input.adminClient?.auth?.admin;
  if (
    !admin ||
    typeof admin.createUser !== "function" ||
    typeof admin.generateLink !== "function" ||
    typeof admin.getUserById !== "function" ||
    typeof admin.signOut !== "function" ||
    typeof adminOps?.createRunTaggedUser !== "function" ||
    typeof input.createPublicClient !== "function" ||
    typeof input.rawRequest !== "function" ||
    typeof input.readMailCredentials !== "function" ||
    typeof input.markMailSeen !== "function" ||
    typeof input.nowSeconds !== "function" ||
    !isProviderProbeKnownValueRegistry(registry) ||
    !isRunOwnedRecipientsRecord(ownedRecipients) ||
    !ledger ||
    typeof ledger.reserve !== "function"
  ) {
    fail("auth_probe_invalid_dependencies");
  }
  const runTag = config.runId.toLowerCase();
  const sessions = new WeakMap<object, SessionRecord>();
  const sessionList: ProviderProbeSessionHandle[] = [];
  const links = new WeakMap<object, { tokenHash: string; used: boolean }>();
  const passwords = new WeakMap<object, string>();
  // R9: the run's count of unresolved creations (users that may exist but could not be
  // attributed). Each settlement adds to it at once, before any response processing that
  // can throw, so an exception later in the same operation cannot lose it; the probe core
  // reads it (`unresolvedCreations`) after every step, on success and on failure.
  let unresolvedCreations = 0;

  function recordUnresolved(count: number): void {
    if (count > 0) {
      unresolvedCreations += count;
    }
  }

  function mint(): string {
    const address = mintRunRecipient(config.runId, random);
    registry.register(address);
    return address;
  }

  function generatedSecret(): string {
    const bytes = random(24);
    if (!(bytes instanceof Uint8Array) || bytes.length !== 24) {
      fail("auth_probe_invalid_dependencies");
    }
    // 28 characters (120 random bits); registered before any use.
    const secret = `Pp9-${secretCharacters(bytes)}`;
    registry.register(secret);
    return secret;
  }

  function recordOf(user: ProviderProbeAuthUserHandle): Readonly<{ id: string; email: string }> {
    const record = authUserRecordForHandle(user);
    if (record === null) {
      fail("auth_probe_unknown_user_handle");
    }
    return record;
  }

  function holdSession(data: Record<string, unknown> | null): ProviderProbeSessionHandle | null {
    const session = data?.session;
    if (!session || typeof session !== "object") {
      return null;
    }
    const value = session as Record<string, unknown>;
    const accessToken = value.access_token;
    const refreshToken = value.refresh_token;
    const expiresIn = value.expires_in;
    const expiresAt = value.expires_at;
    const registrable = (candidate: unknown): candidate is string =>
      typeof candidate === "string" &&
      candidate.length >= PROVIDER_PROBE_OUTPUT_LIMITS.minKnownValueLength &&
      candidate.length <= PROVIDER_PROBE_OUTPUT_LIMITS.maxKnownValueLength;
    // Whatever can be registered is registered first; then a session with any token the
    // registry cannot hold (too short or too long) is refused as malformed, so no token
    // is ever held unregistered.
    for (const candidate of [accessToken, refreshToken]) {
      if (registrable(candidate)) {
        registry.register(candidate);
      }
    }
    if (
      !registrable(accessToken) ||
      !registrable(refreshToken) ||
      !Number.isSafeInteger(expiresIn) ||
      !Number.isSafeInteger(expiresAt)
    ) {
      fail("auth_probe_session_malformed");
    }
    if (sessionList.length >= PROVIDER_PROBE_AUTH_LIMITS.maxOpenSessions) {
      fail("auth_probe_session_capacity_exceeded");
    }
    const userId = userIdOf(value.user) ?? userIdOf(data?.user);
    if (userId !== null) {
      registry.register(userId);
    }
    const handle = Object.freeze({ kind: "provider-probe-session" as const });
    sessions.set(handle, {
      accessToken,
      userId,
      expiresIn: expiresIn as number,
      expiresAt: expiresAt as number,
      receivedAtSeconds: input.nowSeconds(),
      signedOut: false,
    });
    sessionList.push(handle);
    return handle;
  }

  // R7: the facts of a sign-in or link exchange. The session is held whenever the answer
  // carries one, whatever its error, so it is registered and signed out at the end; an
  // error answer that carries a session is contradictory and never passes. A refusal is
  // confirmed only for a named surface (the link replay).
  function signInFacts(
    data: Record<string, unknown> | null,
    error: unknown,
    surface: ProviderProbeRefusalSurface | null,
  ): ProviderProbeSignInFacts {
    const contradictory = error !== null && carriesSession(data);
    const session = holdSession(data);
    return Object.freeze({
      errorKind: classifyAuthError(error),
      session,
      contradictory,
      confirmedRefusal: surface !== null && !contradictory && providerProbeIsConfirmedRefusal(error, surface),
    });
  }

  function sessionRecord(session: ProviderProbeSessionHandle): SessionRecord {
    const record = sessions.get(session);
    if (record === undefined) {
      fail("auth_probe_unknown_session_handle");
    }
    return record;
  }

  // One complete pass over the local users, or null when the list moved during it.
  async function readUserPass(): Promise<Map<string, ListedUser> | null> {
    const users = new Map<string, ListedUser>();
    let total: number | null = null;
    for (let page = 1; page <= PROVIDER_PROBE_AUTH_LIMITS.maxUserPages; page += 1) {
      const answer = await input.rawRequest({ kind: "list-users", page });
      if (answer.transportFailed || answer.status !== 200 || answer.totalCount === null) {
        fail("auth_probe_user_listing_failed");
      }
      const listed = (answer.json as { users?: unknown } | null)?.users;
      if (!Array.isArray(listed) || listed.length > PROVIDER_PROBE_AUTH_LIMITS.userPageSize) {
        fail("auth_probe_user_listing_malformed");
      }
      if (total !== null && answer.totalCount !== total) {
        return null;
      }
      total = answer.totalCount;
      if (total > PROVIDER_PROBE_AUTH_LIMITS.maxUserPages * PROVIDER_PROBE_AUTH_LIMITS.userPageSize) {
        fail("auth_probe_user_listing_too_large");
      }
      const start = (page - 1) * PROVIDER_PROBE_AUTH_LIMITS.userPageSize;
      if (listed.length !== Math.max(0, Math.min(PROVIDER_PROBE_AUTH_LIMITS.userPageSize, total - start))) {
        fail("auth_probe_user_listing_inconsistent");
      }
      for (const entry of listed) {
        const id = userIdOf(entry);
        if (id === null) {
          fail("auth_probe_user_listing_malformed");
        }
        if (users.has(id)) {
          return null;
        }
        const record = entry as { email?: unknown; phone?: unknown; is_anonymous?: unknown };
        const email = typeof record.email === "string" && record.email.length > 0 ? record.email.toLowerCase() : null;
        users.set(
          id,
          Object.freeze({
            id,
            email,
            anonymous: record.is_anonymous === true,
            phone: typeof record.phone === "string" && record.phone.length > 0,
          }),
        );
      }
      if (users.size === total) {
        return users;
      }
    }
    fail("auth_probe_user_listing_too_large");
  }

  // Two consecutive complete passes must agree on every id and address.
  async function readUsers(): Promise<ReadonlyMap<string, ListedUser>> {
    let previous: Map<string, ListedUser> | null = null;
    for (let pass = 0; pass < PROVIDER_PROBE_AUTH_LIMITS.maxListingPasses; pass += 1) {
      const current = await readUserPass();
      if (
        current !== null &&
        previous !== null &&
        current.size === previous.size &&
        [...current].every(([id, user]) => previous!.get(id)?.email === user.email)
      ) {
        return current;
      }
      previous = current;
    }
    fail("auth_probe_user_listing_unstable");
  }

  function isRunTagged(email: string | null): boolean {
    if (email === null) {
      return false;
    }
    const at = email.lastIndexOf("@");
    return at > 0 && email.slice(at + 1) === "synthetic.invalid" && email.slice(0, at).includes(runTag);
  }

  // Commit the reservation for a returned id, or adopt users found at the exact minted
  // address while it is still open. Returns how many users were tracked and how many
  // were found but could not be tracked (capacity). The caller releases the reservation
  // in a `finally` if this never commits it (no user, or a listing failure).
  //
  // R8: the follow-up listing runs whenever no usable id came back, and if it fails, the
  // creation is always reported as one unresolved user, which makes the caller stop every
  // further effect. A refusal, even one confirmed by status and code, does not account
  // for the creation: a server can refuse and still create a user (re-check #128c).
  //
  // R9 (re-check #128d): settlement comes first and is delivered at once. Every user found
  // is committed (a receipt), and every unresolved user is counted into the run's
  // creation count (`recordUnresolved`), before anything that can throw: registering the
  // ids and making the address run-owned come only after, and so does the caller's own
  // processing of the answer (a session, the link's properties).
  async function settleCreation(
    reservation: HeldReservation,
    returnedId: string | null,
    mintedAddress: string,
  ): Promise<Readonly<{ usersCreated: number; usersUntracked: number }>> {
    const committed: string[] = [];
    let untracked = 0;
    if (returnedId !== null) {
      reservation.commit(issueCleanupReceipt("auth-user", returnedId, config.runId));
      committed.push(returnedId);
    } else {
      let listing: ReadonlyMap<string, ListedUser>;
      try {
        listing = await readUsers();
      } catch {
        // (R10) How many users the request made is unknown here, not a known count collapsed:
        // it counts the minimum, one, which stops every effect. (R11) The true number may be
        // higher or none; PP-12 then checks only whether any run-tagged user is left, without
        // reporting a number, and a user that every listing omits stays undetectable.
        // No usable id and no listing: a user may exist that cannot be attributed.
        recordUnresolved(1);
        return { usersCreated: 0, usersUntracked: 1 };
      }
      const found: ListedUser[] = [...listing.values()].filter((user) => user.email === mintedAddress);
      if (found.length === 0) {
        return { usersCreated: 0, usersUntracked: 0 };
      }
      reservation.commit(issueCleanupReceipt("auth-user", found[0]!.id, config.runId));
      committed.push(found[0]!.id);
      for (const extra of found.slice(1)) {
        try {
          ledger.reserve("auth-user").commit(issueCleanupReceipt("auth-user", extra.id, config.runId));
          committed.push(extra.id);
        } catch {
          untracked += 1;
        }
      }
    }
    // Delivered before anything below can throw.
    recordUnresolved(untracked);
    for (const id of committed) {
      registry.register(id);
    }
    addRunOwnedRecipient(ownedRecipients, config.runId, mintedAddress);
    return { usersCreated: committed.length, usersUntracked: untracked };
  }

  async function creatingCall(
    mintedAddress: string,
    surface: ProviderProbeRefusalSurface,
    call: () => Promise<unknown>,
  ): Promise<ProviderProbeCreationFacts> {
    const reservation = holdReservation(ledger.reserve("auth-user"));
    try {
      let raw: unknown;
      try {
        raw = await call();
      } catch {
        raw = { error: { status: 0 } };
      }
      const { data, error } = resultOf(raw);
      const errorKind = classifyAuthError(error);
      const returnedId = errorKind === "none" ? userIdOf(data?.user) : null;
      // R7: an error answer that also carries a session contradicts itself: never a
      // confirmed refusal, and the session is still held (below) for sign-out.
      const contradictory = error !== null && carriesSession(data);
      const confirmedRefusal = !contradictory && providerProbeIsConfirmedRefusal(error, surface);
      const settled = await settleCreation(reservation, returnedId, mintedAddress);
      // R7: held whenever the answer carries one, whatever its error. (R9) A malformed or
      // excess session throws here, after the settlement was delivered: the record fails,
      // and the run still counts any unresolved user.
      const session = holdSession(data);
      return Object.freeze({
        errorKind,
        confirmedRefusal,
        contradictory,
        usersCreated: settled.usersCreated,
        usersUntracked: settled.usersUntracked,
        session,
      });
    } finally {
      reservation.releaseIfOpen();
    }
  }

  // R7: the admin core keeps its reservation open while this locates a failed or id-less
  // creation by the exact address minted for it. An unresolved creation is reported as
  // one untracked user, never rethrown, so the caller counts it and stops every effect.
  async function createTracked(password: boolean): Promise<ProviderProbeCreatedFixture> {
    const secret = password ? generatedSecret() : undefined;
    let reconciled = false;
    const locateMintedAddress = async (address: string): Promise<readonly string[]> => {
      reconciled = true;
      return [...(await readUsers()).values()].filter((user) => user.email === address).map((user) => user.id);
    };
    try {
      const created = await adminOps.createRunTaggedUser({
        ...(secret === undefined ? {} : { password: secret }),
        locateMintedAddress,
      });
      if (secret !== undefined) {
        passwords.set(created.user, secret);
      }
      return Object.freeze({
        errorKind: reconciled ? ("unexpected" as const) : ("none" as const),
        user: created.user,
        emailMatched: created.emailMatched,
        reconciled,
        usersUntracked: 0,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "auth_admin_capacity_exceeded" || code === "auth_admin_ledger_closed") {
        throw error;
      }
      // R10: the count the admin core reports (every located user it could not track, and at
      // least one), not a fixed one.
      const unresolved = code === "auth_admin_create_unresolved" ? unresolvedUsersOf(error) : 0;
      // R9: delivered to the run's creation count at once.
      recordUnresolved(unresolved);
      return Object.freeze({
        errorKind: "unexpected" as const,
        user: null,
        emailMatched: false,
        reconciled,
        usersUntracked: unresolved,
      });
    }
  }

  return Object.freeze({
    unresolvedCreations: () => unresolvedCreations,

    async checkHealth() {
      const answer = await input.rawRequest({ kind: "health" });
      return !answer.transportFailed && answer.status === 200 && !!answer.json && typeof answer.json === "object";
    },

    async listUsers() {
      const users = [...(await readUsers()).values()];
      return Object.freeze({ runTaggedUsers: users.filter((user) => isRunTagged(user.email)).length, totalUsers: users.length });
    },

    createExplorer: () => createTracked(false),
    createPasswordUser: () => createTracked(true),

    async describeUser(user) {
      const record = recordOf(user);
      const { data, error } = resultOf(await admin.getUserById(record.id).catch(() => ({ error: { status: 0 } })));
      const found = error === null ? (data?.user as Record<string, unknown> | undefined) : undefined;
      if (!found || userIdOf(found) !== record.id) {
        return Object.freeze({ found: false, emailMatches: false, anonymous: false, hasPhone: false });
      }
      return Object.freeze({
        found: true,
        emailMatches: typeof found.email === "string" && found.email.toLowerCase() === record.email,
        anonymous: found.is_anonymous === true,
        hasPhone: typeof found.phone === "string" && found.phone.length > 0,
      });
    },

    async countUsersWithAddressOf(user) {
      const record = recordOf(user);
      return [...(await readUsers()).values()].filter((listed) => listed.email === record.email).length;
    },

    async generateMagicLink(user) {
      const record = recordOf(user);
      const { data, error } = resultOf(
        await admin.generateLink({ type: "magiclink", email: record.email }).catch(() => ({ error: { status: 0 } })),
      );
      const errorKind = classifyAuthError(error);
      const properties = data?.properties && typeof data.properties === "object" ? (data.properties as Record<string, unknown>) : null;
      for (const key of ["action_link", "hashed_token", "email_otp"]) {
        const value = properties?.[key];
        if (typeof value === "string" && value.length >= 8) {
          registry.register(value);
        }
      }
      const tokenHash = properties?.hashed_token;
      const present = typeof tokenHash === "string" && tokenHash.trim().length >= 8;
      const handle = errorKind === "none" && present ? Object.freeze({ kind: "provider-probe-link" as const }) : null;
      if (handle !== null) {
        links.set(handle, { tokenHash: tokenHash as string, used: false });
      }
      const keys = properties === null ? [] : Object.keys(properties).filter((key) => properties[key] !== undefined).sort();
      return Object.freeze({
        errorKind,
        userIdMatched: errorKind === "none" && user.matchesUserId(userIdOf(data?.user)),
        propertyKeysExact: keys.length === EXPECTED_LINK_PROPERTY_KEYS.length && keys.every((key, index) => key === EXPECTED_LINK_PROPERTY_KEYS[index]),
        verificationTypeMagiclink: properties?.verification_type === "magiclink",
        hashedTokenPresent: present,
        link: handle,
      });
    },

    async verifyLink(link) {
      const held = links.get(link);
      if (held === undefined) {
        fail("auth_probe_unknown_link_handle");
      }
      held.used = true;
      const { data, error } = resultOf(
        await input
          .createPublicClient()
          .auth.verifyOtp({ token_hash: held.tokenHash, type: "email" })
          .catch(() => ({ error: { status: 0 } })),
      );
      return signInFacts(data, error, "link-replay");
    },

    sessionBelongsTo(session, user) {
      return user.matchesUserId(sessionRecord(session).userId);
    },

    async serverRecognizes(session, user) {
      const record = sessionRecord(session);
      const { data, error } = resultOf(
        await input.createPublicClient().auth.getUser(record.accessToken).catch(() => ({ error: { status: 0 } })),
      );
      return error === null && user.matchesUserId(userIdOf(data?.user));
    },

    lifetimeOf(session) {
      const record = sessionRecord(session);
      const times = decodeJwtTimes(record.accessToken);
      if (times === null) {
        return null;
      }
      return Object.freeze({
        expiresIn: record.expiresIn,
        expiresAt: record.expiresAt,
        jwtExp: times.exp,
        jwtIat: times.iat,
        receivedAtSeconds: record.receivedAtSeconds,
      });
    },

    async signOut(session) {
      const record = sessionRecord(session);
      if (record.signedOut) {
        return true;
      }
      const { error } = resultOf(await admin.signOut(record.accessToken, "local").catch(() => ({ error: { status: 0 } })));
      record.signedOut = error === null;
      return record.signedOut;
    },

    openSessions: () => Object.freeze(sessionList.filter((session) => !sessions.get(session)!.signedOut)),
    sessionsOpened: () => sessionList.length,

    async trySignUpWithPassword() {
      const address = mint();
      const password = generatedSecret();
      return creatingCall(address, "email-sign-up", () => input.createPublicClient().auth.signUp({ email: address, password }));
    },

    async tryEmailCodeSignUp() {
      const address = mint();
      return creatingCall(address, "email-code-sign-up", () =>
        input.createPublicClient().auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } }),
      );
    },

    async tryEmailCodeForMissingAddress() {
      const address = mint();
      return creatingCall(address, "email-code-missing-address", () =>
        input.createPublicClient().auth.signInWithOtp({ email: address, options: { shouldCreateUser: false } }),
      );
    },

    async tryDisabledProvider() {
      const answer = await input.rawRequest({ kind: "authorize-disabled-provider" });
      const body =
        answer.json && typeof answer.json === "object" && !Array.isArray(answer.json)
          ? (answer.json as { error_code?: unknown; msg?: unknown; message?: unknown; error_description?: unknown })
          : null;
      // R7: the message is matched here, in memory, and never returned.
      const messages = body === null ? [] : [body.msg, body.message, body.error_description].filter((text) => typeof text === "string");
      return Object.freeze({
        confirmedRefusal:
          !answer.redirectRefused &&
          !answer.transportFailed &&
          answer.status === DISABLED_PROVIDER_REFUSAL.status &&
          body?.error_code === DISABLED_PROVIDER_REFUSAL.code &&
          messages.some((text) => DISABLED_PROVIDER_REFUSAL.message.test(text as string)),
        redirected: answer.redirectRefused,
        transportFailed: answer.transportFailed,
      });
    },

    async sendExistingAccountEmail(user) {
      const record = recordOf(user);
      // Anything already in this recipient's mail is set aside, so the credential read
      // afterwards can only come from the message this request causes.
      await input.markMailSeen(record.email);
      const { data, error } = resultOf(
        await input
          .createPublicClient()
          .auth.signInWithOtp({ email: record.email, options: { shouldCreateUser: false } })
          .catch(() => ({ error: { status: 0 } })),
      );
      // R8: the answer's data is inspected like any other: a session in it is registered
      // and held for sign-out, and a refusal that carries one is never confirmed.
      const facts = signInFacts(data, error, "existing-account-send");
      return Object.freeze({ errorKind: facts.errorKind, confirmedRefusal: facts.confirmedRefusal, session: facts.session });
    },

    async verifyFromNewMessage(user, mode) {
      const record = recordOf(user);
      const credentials = await input.readMailCredentials(record.email);
      const value = mode === "code" ? credentials.code : credentials.tokenHash;
      if (!credentials.messageFound || value === null) {
        return Object.freeze({
          credentialFound: false,
          result: Object.freeze({ errorKind: "unexpected" as const, session: null, contradictory: false, confirmedRefusal: false }),
        });
      }
      const params =
        mode === "code" ? { email: record.email, token: value, type: "email" } : { token_hash: value, type: "email" };
      const { data, error } = resultOf(
        await input.createPublicClient().auth.verifyOtp(params).catch(() => ({ error: { status: 0 } })),
      );
      return Object.freeze({ credentialFound: true, result: signInFacts(data, error, null) });
    },

    async passwordSignIn(user, mode) {
      const record = recordOf(user);
      const correct = passwords.get(user);
      if (correct === undefined) {
        fail("auth_probe_user_has_no_password");
      }
      const password = mode === "correct" ? correct : generatedSecret();
      const { data, error } = resultOf(
        await input
          .createPublicClient()
          .auth.signInWithPassword({ email: record.email, password })
          .catch(() => ({ error: { status: 0 } })),
      );
      return signInFacts(data, error, null);
    },

    async passwordSignInUnknownAddress() {
      // A fresh minted address that no user has: a password sign-in cannot create one.
      const address = mint();
      const password = generatedSecret();
      const { data, error } = resultOf(
        await input
          .createPublicClient()
          .auth.signInWithPassword({ email: address, password })
          .catch(() => ({ error: { status: 0 } })),
      );
      return signInFacts(data, error, null);
    },

    async duplicateCreate() {
      const address = mint();
      const reservations: HeldReservation[] = [];
      try {
        reservations.push(holdReservation(ledger.reserve("auth-user")));
        reservations.push(holdReservation(ledger.reserve("auth-user")));
        const attempt = () =>
          admin
            .createUser({ email: address, email_confirm: true, user_metadata: { synthetic: true } })
            .catch(() => ({ error: { status: 0 } }));
        const answers = await Promise.all([attempt(), attempt()]);
        const results = answers.map((answer) => resultOf(answer));
        const ids = results.map((result) => (classifyAuthError(result.error) === "none" ? userIdOf(result.data?.user) : null));
        const distinct = [...new Set(ids.filter((id): id is string => id !== null))];
        // R9: settlement first. Every returned id is committed (a receipt) at once; the ids
        // are registered, and the address made run-owned, only after every unresolved user
        // has been counted into the run's creation count (`recordUnresolved`), because
        // registering can throw (a full registry).
        const committed: string[] = [];
        let next = 0;
        for (const id of distinct) {
          reservations[next++]!.commit(issueCleanupReceipt("auth-user", id, config.runId));
          committed.push(id);
        }
        const finishSettlement = (): void => {
          for (const id of committed) {
            registry.register(id);
          }
          if (committed.length > 0) {
            addRunOwnedRecipient(ownedRecipients, config.runId, address);
          }
        };
        const kinds = results.map((result) => classifyAuthError(result.error));
        // R7: a duplicate refusal counts only with a valid status and a duplicate code.
        const confirmedDuplicates = results.map((result) => providerProbeIsConfirmedRefusal(result.error, "duplicate-create"));
        const counts = {
          successes: kinds.filter((kind) => kind === "none").length,
          duplicateRefusals: confirmedDuplicates.filter(Boolean).length,
          otherErrors: kinds.filter((kind, index) => kind !== "none" && !confirmedDuplicates[index]).length,
        };
        // Any user at the address that came back without an id is adopted from a listing
        // while a reservation is still open. The `finally` below releases what was not
        // committed, and the committed receipts stay, so cleanup can start and deletes them.
        // R8: if the listing fails, every attempt that returned no usable id, a confirmed
        // duplicate refusal included, may have created a user that cannot be attributed;
        // each is reported as one unresolved user (the caller stops every effect). Only when
        // both attempts returned an id is the failure a failed check, rethrown.
        const unaccounted = ids.filter((id) => id === null).length;
        let listing: ReadonlyMap<string, ListedUser>;
        try {
          listing = await readUsers();
        } catch (error) {
          if (unaccounted === 0) {
            finishSettlement();
            throw error;
          }
          recordUnresolved(unaccounted);
          finishSettlement();
          return Object.freeze({ ...counts, located: distinct.length, usersCreated: committed.length, usersUntracked: unaccounted });
        }
        let untracked = 0;
        const listed = [...listing.values()].filter((user) => user.email === address);
        for (const user of listed.filter((entry) => !distinct.includes(entry.id))) {
          const reservation = reservations[next];
          if (reservation === undefined) {
            untracked += 1;
            continue;
          }
          next += 1;
          reservation.commit(issueCleanupReceipt("auth-user", user.id, config.runId));
          committed.push(user.id);
        }
        recordUnresolved(untracked);
        finishSettlement();
        return Object.freeze({
          ...counts,
          located: listed.length,
          usersCreated: committed.length,
          usersUntracked: untracked,
        });
      } finally {
        for (const reservation of reservations) {
          reservation.releaseIfOpen();
        }
      }
    },

    async generateLinkForMissingAddress() {
      const address = mint();
      const reservation = holdReservation(ledger.reserve("auth-user"));
      try {
        const { data, error } = resultOf(
          await admin.generateLink({ type: "magiclink", email: address }).catch(() => ({ error: { status: 0 } })),
        );
        // The link is never verified: no session follows a missing-user link.
        const errorKind = classifyAuthError(error);
        const returnedId = errorKind === "none" ? userIdOf(data?.user) : null;
        // R7: GoTrue's "no such user" answer for this surface (status and code).
        const confirmedNotFound = providerProbeIsConfirmedRefusal(error, "missing-user-link");
        // Settled first, so a user the request created is tracked even if registering a
        // value below fails. (R9) Any unresolved user has also been counted by then, so an
        // oversized property or a full registry below fails the record without losing it.
        const settled = await settleCreation(reservation, returnedId, address);
        const properties =
          data?.properties && typeof data.properties === "object" ? (data.properties as Record<string, unknown>) : null;
        for (const key of ["action_link", "hashed_token", "email_otp"]) {
          const value = properties?.[key];
          if (typeof value === "string" && value.length >= PROVIDER_PROBE_OUTPUT_LIMITS.minKnownValueLength) {
            registry.register(value);
          }
        }
        return Object.freeze({
          errorKind,
          confirmedNotFound,
          createdOnMissing: settled.usersCreated + settled.usersUntracked > 0,
          ...settled,
        });
      } finally {
        reservation.releaseIfOpen();
      }
    },
  });
}
