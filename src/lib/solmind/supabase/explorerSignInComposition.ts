import "server-only";

import { normalizeLoginEmail } from "../auth/loginContactNormalizer";
import {
  toVerificationChallengeIssuanceAcknowledgment,
  type VerificationChallengeIssuanceRequest,
} from "../auth/verificationChallengeCallers";
import { SOLMIND_ROLES } from "../roles";
import {
  EXPLORER_SIGN_IN_PORTS,
  EXPLORER_SIGN_IN_RESPONSE_FLOOR_MILLISECONDS,
  type ExplorerSignInIdentityHold,
  type ExplorerSignInPorts,
  type ExplorerSignInSendDependencies,
  type ExplorerSignInVerifyDependencies,
} from "./explorerSignInDependencies";
import {
  EXPLORER_SIGN_IN_CODE_NOT_ACCEPTED,
  EXPLORER_SIGN_IN_DENIED,
  EXPLORER_SIGN_IN_INVALID_EMAIL,
  type ExplorerSignInCodeNotAccepted,
  type ExplorerSignInDenied,
  type ExplorerSignInSendAcknowledgment,
  type ExplorerSignInSendResult,
} from "./explorerSignInRouteContract";
import {
  writeLoginSessionCookies,
  type LoginSessionCookieWrite,
  type SessionCookieResponse,
} from "./loginCookieWriter";

// Login step 6, sub-slice S6-8: the server composition of the two Explorer
// sign-in routes. It holds both step orders. The route files do the request
// work (the trusted origin, the same-origin guard, the query string, the
// body shape, the request's cookie names and the response); everything from
// there to the outward result is here.
//
// Source of truth: solmind-docs
// `execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md`
// (contract 21) Sections 7.1.3, 7.3 and 7.9, and
// `execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`
// (contract 25), accepted by Paul on 2026-10-04 (AUTH-RLS-DEC-043), Sections
// 6, 11 and 12.
//
// The values this composition fixes. Each is a literal here and never comes
// from a request: the identifier type `email`, the role
// `SOLMIND_ROLES.EXPLORER`, and the purpose `login`. The role given to the
// account lookup is what keeps a Guide-only or Admin-only account out: the
// lookup returns a row only for an account with an active assignment for the
// requested role. The account id, the contact id, the email and the provider
// user id that later steps use are the lookup's own row, never the request's.
//
// Send a code (`requestExplorerSignInCode`), in order:
//   1. reads the clock and fixes the answer time: now plus the response
//      floor;
//   2. normalizes the typed text with the shared normalizer. Not an email:
//      `invalid_email`, with no lookup and no wait. That answer depends only
//      on what was typed;
//   3. builds the request's dependencies, configuration first (see the
//      dependency factory). A failure is `denied`, with no wait: it does not
//      depend on the identifier;
//   4. takes a spare selector, on every request: one call to the issuing
//      caller with a fixed request that is structurally invalid (an empty
//      object). That caller picks a fresh challenge UUID before it checks
//      anything and returns it with `invalid_request`: no slot is taken, no
//      database call is made and nothing is sent. If the call throws or
//      returns no selector, the answer is `denied`, with no wait: the
//      identifier has not been used yet;
//   5. looks the account up, with the type and the role fixed. From this
//      step on there is one exit: the acknowledgment, after the wait;
//   6. only for exactly one row: issues, with both UUIDs and the email from
//      that row, and keeps the selector the issuing caller returns, whatever
//      the outcome. For no row, a failed lookup, a throw, or a row that does
//      not carry both UUIDs, it makes no second call and keeps the spare
//      selector;
//   7. builds the one acknowledgment with the selector in hand, waits until
//      the answer time, and returns it.
//
// The rule that keeps an ordinary sign-in bound. The banked issuing caller
// accepts the purpose `login` with both binding UUIDs null, and so does the
// database function, with no contact check: it would issue a real challenge
// and email a code to an address with no eligible account. Nothing below the
// route stops that. So step 6 runs only with both UUIDs from a one-row
// lookup, and neither step 4 nor the no-row path ever passes nulls: the
// spare request is the empty object and nothing else.
//
// One limit of the one-exit rule. The banked issuing caller never throws
// once constructed. If an issuing port ever threw after it had issued and
// sent a code, the person would get the spare selector, and the code in
// their mailbox would not work with it; they would ask for a new code. That
// is accepted, because the other way is an answer that differs for an
// eligible email.
//
// Verify the code and sign in (`verifyExplorerSignInCode`), in contract 21's
// order:
//   1. reads the clock and fixes the answer time; normalizes the typed text.
//      Not an email: `denied`, with no wait;
//   2. builds the request's dependencies, configuration first. A failure is
//      `denied`, with no wait, and the code is not spent;
//   3. redeems the selected challenge, with the purpose fixed. From this
//      call on there is one rule: every exit except `signed_in` asks the
//      waiter for the answer time (waiter failure can return early). A
//      returned `denied` or `invalid_request` is `code_not_accepted`;
//      `busy`, `failed`, a throw or anything else is `denied`. Only
//      `redeemed` goes on;
//   4. looks the account up from the typed email, with the type and the role
//      fixed. Anything but one row is `denied`. The code stays used;
//   5. confirms that the redeemed challenge is that account's own. Anything
//      but `confirmed` is `denied`. No Supabase call has been made;
//   6. runs the internal exchange with the looked-up email and bound
//      provider user id only. Anything but a hold is `denied`; the bridge
//      has already attempted cleanup of any session it recovered;
//   7. creates the SolMind session, once, with the looked-up account, the
//      fixed role, this request's own redeemed selector and the hold's token
//      expiry;
//   8. releases the held cookies, stating the outcome that this request's
//      own session call returned (never a constant);
//   9. only then calls the route's function once to make the success
//      response, and writes both cookies onto it with the login-step cookie
//      writer, giving it the request's cookie names for the old chunks it
//      clears;
//  10. returns `signed_in` with that response only when the writer answered
//      `written`.
// Once a hold exists, one guard covers every exit: steps 7 to 9 run inside
// one try-and-finally, and every exit that is not step 10, a throw included,
// awaits the hold's `discard` before the composition answers. `discard`
// never rejects and may run after a release whose write then failed.
//
// What is true on a failure, and its limits. No cookie reaches the browser
// on any failure: the success response is made only at step 9 and leaves
// this module only at step 10. Cleanup of the transient Supabase session is
// attempted and can fail; a failed revocation leaves that session alive at
// Supabase, where it authorizes nothing in SolMind without a matching
// SolMind session and binding cookie. A code is spent by any failure after
// step 3 returned `redeemed`. At step 6, a link request for an email that
// Supabase does not know creates a Supabase user there, as login step 3's
// run recorded, and nothing here deletes it (the bridge deletes no user);
// that user is not the account's bound user, so the bridge denies before
// any exchange. After step 7 answered, the new session row exists and the
// account's earlier session has already been ended, also when step 8 or 9
// then fails; no application code ends that session; a later sign-in of the
// same account supersedes it, and otherwise it ends by itself within the
// hour. Paul decided on 2026-10-07 to "accept it for the local demo, and
// record it" (morning check-in packet, item 8, option 1; record:
// `solmind-sprints/PRJ01-SPR001/Decision_Queue/Current_Action_Queue.md`,
// "The 2026-10-07 check-in: answered (first seen by the 11:30:10 clock
// read)").
//
// The one earliest answer time, and what it does not hide. The wait is a
// floor, measured from this module's entry: the waiter is asked for the
// answer time, and the answer comes later if the work took longer. Earlier
// refusals do not wait; waiter failure can return early. On the send route
// the floor covers every exit from the account lookup on; on the verify
// route every exit from the redemption call on except `signed_in`. Without
// it on the verify route, one wrong code per
// email would show whether the email has an account: a wrong code against a
// real challenge writes, and against the spare selector of an unknown email
// it writes nothing. The floor hides the ordinary difference. It does not
// hide a send that runs longer than the floor, slowness someone creates by
// flooding the send route (the unknown-email path takes no slot and makes
// one read), or the shared pool of four issuance slots (while someone floods
// one email, a send for another address is dropped as `busy` only if the
// flooded email is eligible). Nothing was measured. The tests prove what the
// code asks of the clock and the waiter, not what an observer measures.
//
// Neither function throws or rejects, logs, reads the environment or a
// request cookie's value, or imports a Next.js module: the response is seen
// only as the cookie writer's own structural type. Results are the route
// contract's frozen constants, the acknowledgment, or `signed_in` with the
// response.
//
// Called by login step 6's Explorer sign-in routes (S6-8). Keep it
// server-only, direct-import only and off every barrel.

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: explorerSignInComposition must not be imported in browser code.",
  );
}

// The three values this composition fixes.
const SIGN_IN_IDENTIFIER_TYPE = "email" as const;
const SIGN_IN_ROLE = SOLMIND_ROLES.EXPLORER;
const SIGN_IN_PURPOSE = "login" as const;

// The spare-selector request: structurally invalid on purpose. The issuing
// caller reads one exact list of five keys, so an empty object cannot pass
// its check, and it answers `invalid_request` with a fresh UUID and no
// effect. The cast is deliberate: the public type does not admit `{}`. It
// must never be given the shape of a real request: the purpose `login` with
// both binding UUIDs null is VALID and would send mail.
export const EXPLORER_SIGN_IN_SPARE_SELECTOR_REQUEST = Object.freeze(
  {},
) as unknown as VerificationChallengeIssuanceRequest;

// A UUID exactly as the issuing caller and PostgreSQL print one: lowercase
// canonical form (the caller's fixed nil UUID included). No `m` flag, so a
// final line terminator is refused.
const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_UUID_PATTERN.test(value);
}

export type ExplorerSignInCodeRequest = Readonly<{
  trustedOrigin: string;
  identifier: string;
}>;

export type ExplorerSignInVerification<SuccessResponse extends SessionCookieResponse> = Readonly<{
  trustedOrigin: string;
  identifier: string;
  challengeId: string;
  code: string;
  // The request's cookies as names only: every value is an empty string.
  requestCookies: LoginSessionCookieWrite["requestCookies"];
  // Format-checked captured credentials for optional cleanup only; cannot
  // select the new login account, evidence or session.
  priorCleanupCandidate?: Readonly<{ accessToken: string; refreshToken: string; proof: unknown }> | null;
  // Makes the success response. Called at most once, and only after the
  // session exists and the held cookies were released.
  createSuccessResponse: () => SuccessResponse;
}>;

export type ExplorerSignInVerifyResult<SuccessResponse extends SessionCookieResponse> =
  | Readonly<{ outcome: "signed_in"; response: SuccessResponse }>
  | ExplorerSignInCodeNotAccepted
  | ExplorerSignInDenied;

type AccountLookupResult = Awaited<
  ReturnType<ExplorerSignInSendDependencies["accountLookup"]["resolve"]>
>;
type FoundAccount = Extract<AccountLookupResult, { outcome: "found" }>;

// The lookup's one row, only when it is `found` and carries both binding
// UUIDs, an email and a provider user id. Null for anything else, a value
// outside the lookup's closed set included.
function readFoundAccount(result: AccountLookupResult): FoundAccount | null {
  if (
    result === null ||
    typeof result !== "object" ||
    result.outcome !== "found" ||
    !isCanonicalUuid(result.userAccountId) ||
    !isCanonicalUuid(result.userContactMethodId) ||
    typeof result.normalizedEmail !== "string" ||
    typeof result.providerUserId !== "string"
  ) {
    return null;
  }
  return result;
}

// The one acknowledgment for a returned issuance result, or null when the
// result carries no selector of the one form.
function acknowledgmentOf(result: unknown): ExplorerSignInSendAcknowledgment | null {
  if (result === null || typeof result !== "object") {
    return null;
  }
  const acknowledgment = toVerificationChallengeIssuanceAcknowledgment(
    result as Parameters<typeof toVerificationChallengeIssuanceAcknowledgment>[0],
  );
  return isCanonicalUuid(acknowledgment.challengeId) ? acknowledgment : null;
}

// Waits until the answer time. A waiter that fails is dropped: the answer is
// then returned at once.
async function waitForAnswerTime(ports: ExplorerSignInPorts, answerAt: number): Promise<void> {
  try {
    await ports.waitUntil(answerAt);
  } catch {
    // Dropped unread.
  }
}

// Send a code. See the module comment for the order. Never throws.
export async function requestExplorerSignInCode(
  request: ExplorerSignInCodeRequest,
  ports: ExplorerSignInPorts = EXPLORER_SIGN_IN_PORTS,
): Promise<ExplorerSignInSendResult> {
  let answerAt: number;
  let dependencies: ExplorerSignInSendDependencies;
  let email: string;
  let acknowledgment: ExplorerSignInSendAcknowledgment;
  try {
    answerAt = ports.now() + EXPLORER_SIGN_IN_RESPONSE_FLOOR_MILLISECONDS;
    const normalized = normalizeLoginEmail(request.identifier);
    if (normalized === null) {
      return EXPLORER_SIGN_IN_INVALID_EMAIL;
    }
    email = normalized;
    dependencies = ports.createSendDependencies(request.trustedOrigin);
    // The spare selector, on every request, before the identifier is used.
    const spare = acknowledgmentOf(
      await dependencies.issuer.issue(EXPLORER_SIGN_IN_SPARE_SELECTOR_REQUEST),
    );
    if (spare === null) {
      return EXPLORER_SIGN_IN_DENIED;
    }
    acknowledgment = spare;
  } catch {
    return EXPLORER_SIGN_IN_DENIED;
  }

  // From the account lookup on there is one exit: the acknowledgment, after
  // the wait.
  try {
    const account = readFoundAccount(
      await dependencies.accountLookup.resolve(
        Object.freeze({
          normalizedIdentifier: email,
          identifierType: SIGN_IN_IDENTIFIER_TYPE,
          requestedRoleContext: SIGN_IN_ROLE,
        }),
      ),
    );
    if (account !== null) {
      // Only here, and only with both UUIDs and the email of the one row.
      const issued = acknowledgmentOf(
        await dependencies.issuer.issue(
          Object.freeze({
            purpose: SIGN_IN_PURPOSE,
            contactMethodType: SIGN_IN_IDENTIFIER_TYPE,
            normalizedContact: account.normalizedEmail,
            userAccountId: account.userAccountId,
            userContactMethodId: account.userContactMethodId,
          }),
        ),
      );
      if (issued !== null) {
        acknowledgment = issued;
      }
    }
  } catch {
    // The spare selector stands.
  }
  await waitForAnswerTime(ports, answerAt);
  return acknowledgment;
}

// Steps 7 to 10 of the verify order, under the one guard a hold needs: every
// exit that is not `signed_in` awaits `discard` before it answers.
async function completeSignInWithHold<SuccessResponse extends SessionCookieResponse>(
  verification: ExplorerSignInVerification<SuccessResponse>,
  dependencies: ExplorerSignInVerifyDependencies,
  account: FoundAccount,
  hold: ExplorerSignInIdentityHold,
  ports: ExplorerSignInPorts,
): Promise<ExplorerSignInVerifyResult<SuccessResponse>> {
  let completed = false;
  try {
    // Once per request, and only after this request's own `redeemed` and
    // `confirmed`.
    const session = await dependencies.sessionCreator.create(
      Object.freeze({
        userAccountId: account.userAccountId,
        activeRoleContext: SIGN_IN_ROLE,
        challengeId: verification.challengeId,
        providerAccessTokenExpiresAt: hold.accessTokenExpiresAt,
      }),
    );
    if (session.outcome !== "created" && session.outcome !== "existing") {
      return EXPLORER_SIGN_IN_DENIED;
    }
    const sessionAnsweredAt = ports.now();
    await hold.prepareAcceptedSession(Object.freeze({ sessionOutcome: session.outcome }));
    const elapsedMilliseconds = ports.now() - sessionAnsweredAt;
    const providerRemainingSeconds = Math.floor(hold.accessTokenExpiresAt - ports.epochSeconds());
    const maxAgeSeconds = Math.min(session.maxAgeSeconds - Math.ceil(elapsedMilliseconds / 1000), providerRemainingSeconds);
    if (!Number.isFinite(elapsedMilliseconds) || elapsedMilliseconds < 0 || !Number.isSafeInteger(maxAgeSeconds) || maxAgeSeconds < 1) {
      return EXPLORER_SIGN_IN_DENIED;
    }
    // The outcome this request's own session call returned, never a constant.
    const release = hold.release(Object.freeze({ sessionOutcome: session.outcome }));
    if (release.outcome !== "released") {
      return EXPLORER_SIGN_IN_DENIED;
    }
    // The success response exists only from here.
    const response = verification.createSuccessResponse();
    const written = writeLoginSessionCookies(
      Object.freeze({
        trustedOrigin: verification.trustedOrigin,
        heldCookies: release.heldCookies,
        requestCookies: verification.requestCookies,
        sessionId: session.sessionId,
        maxAgeSeconds,
        response,
      }),
    );
    if (written.outcome !== "written") {
      // The response may already hold some of the cookies: it is dropped.
      return EXPLORER_SIGN_IN_DENIED;
    }
    completed = true;
    return Object.freeze({ outcome: "signed_in" as const, response });
  } catch {
    return EXPLORER_SIGN_IN_DENIED;
  } finally {
    if (!completed) {
      try {
        await hold.discard();
      } catch {
        // Dropped unread: cleanup never changes the deny.
      }
    }
  }
}

// Steps 3 to 10 of the verify order. Never throws.
async function redeemAndSignIn<SuccessResponse extends SessionCookieResponse>(
  verification: ExplorerSignInVerification<SuccessResponse>,
  dependencies: ExplorerSignInVerifyDependencies,
  email: string,
  ports: ExplorerSignInPorts,
): Promise<ExplorerSignInVerifyResult<SuccessResponse>> {
  try {
    const redemption = await dependencies.redeemer.redeem(
      Object.freeze({
        purpose: SIGN_IN_PURPOSE,
        challengeId: verification.challengeId,
        code: verification.code,
      }),
    );
    if (redemption.outcome === "denied" || redemption.outcome === "invalid_request") {
      return EXPLORER_SIGN_IN_CODE_NOT_ACCEPTED;
    }
    if (redemption.outcome !== "redeemed") {
      return EXPLORER_SIGN_IN_DENIED;
    }
    const account = readFoundAccount(
      await dependencies.accountLookup.resolve(
        Object.freeze({
          normalizedIdentifier: email,
          identifierType: SIGN_IN_IDENTIFIER_TYPE,
          requestedRoleContext: SIGN_IN_ROLE,
        }),
      ),
    );
    if (account === null) {
      return EXPLORER_SIGN_IN_DENIED;
    }
    const confirmation = await dependencies.challengeConfirmation.confirm(
      Object.freeze({
        userAccountId: account.userAccountId,
        challengeId: verification.challengeId,
        expectedPurpose: SIGN_IN_PURPOSE,
      }),
    );
    if (confirmation.outcome !== "confirmed") {
      return EXPLORER_SIGN_IN_DENIED;
    }
    const exchange = await dependencies.bridge.exchangeExplorerLink(
      Object.freeze({
        email: account.normalizedEmail,
        boundProviderUserId: account.providerUserId,
      }),
    );
    if (exchange.outcome !== "held") {
      return EXPLORER_SIGN_IN_DENIED;
    }
    return await completeSignInWithHold(verification, dependencies, account, exchange.hold, ports);
  } catch {
    return EXPLORER_SIGN_IN_DENIED;
  }
}

// Verify the code and sign in. See the module comment for the order. Never
// throws.
export async function verifyExplorerSignInCode<SuccessResponse extends SessionCookieResponse>(
  verification: ExplorerSignInVerification<SuccessResponse>,
  ports: ExplorerSignInPorts = EXPLORER_SIGN_IN_PORTS,
): Promise<ExplorerSignInVerifyResult<SuccessResponse>> {
  let answerAt: number;
  let dependencies: ExplorerSignInVerifyDependencies;
  let email: string;
  try {
    answerAt = ports.now() + EXPLORER_SIGN_IN_RESPONSE_FLOOR_MILLISECONDS;
    const normalized = normalizeLoginEmail(verification.identifier);
    if (normalized === null) {
      return EXPLORER_SIGN_IN_DENIED;
    }
    email = normalized;
    dependencies = ports.createVerifyDependencies(verification.trustedOrigin, verification.priorCleanupCandidate);
  } catch {
    return EXPLORER_SIGN_IN_DENIED;
  }

  // From the redemption call on: every exit except `signed_in` asks the
  // waiter for the answer time (waiter failure can return early).
  const result = await redeemAndSignIn(verification, dependencies, email, ports);
  if (result.outcome === "signed_in") {
    return result;
  }
  await waitForAnswerTime(ports, answerAt);
  return result;
}
