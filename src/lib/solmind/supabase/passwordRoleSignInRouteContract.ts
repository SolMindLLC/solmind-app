import "server-only";

import { SESSION_COOKIE_NO_STORE_HEADERS } from "../auth/sessionCookiePolicy";
import type { VerificationChallengeIssuanceAcknowledgment } from "../auth/verificationChallengeCallers";

// Guide/Admin route contract: adopted S69 DESIGN_BRIEF_R04.md and
// REVIEW_R04.md, with the accepted failure-table clarification. Exact authority
// and the separately proposed decision documentation are pinned in the excluded
// component evidence; decision entries AUTH-RLS-DEC-047..050 are not yet banked.
// Keep server-only, direct-import only and off shared/browser barrels.
// No request handler, body parser, response writer, environment or IO lives here.
// Types describe outward JSON; they do not validate an arbitrary value.

// Preserved R03 E18 selects these spellings as engineering choices, not new
// Paul decisions. Guide has a separately composed guarded home and browser flow;
// Admin remains dormant. Leave prototype SOLMIND_ROLE_HOME_ROUTES unchanged.
export const GUIDE_SIGN_IN_ROUTE_PATHS = Object.freeze({
  send: "/login/guide/send", verify: "/login/guide/verify",
} as const);
export const ADMIN_SIGN_IN_ROUTE_PATHS = Object.freeze({
  send: "/login/admin/send", verify: "/login/admin/verify",
} as const);
export const GUIDE_SIGN_IN_HOME_PATH = "/guide/home" as const;
export const ADMIN_SIGN_IN_HOME_PATH = "/admin/home" as const;

// The opaque selector proves neither account existence nor issuance/delivery.
// Reuse the existing owner without importing a runtime issuer or its slot pools.
export type PasswordRoleSignInSendAcknowledgment = VerificationChallengeIssuanceAcknowledgment;
export type PasswordRoleSignInFlowSendAcknowledgment = Readonly<{
  acknowledgment: "verification_code_requested"; flowId: string;
}>;
export type PasswordRoleSignInDenied = Readonly<{ outcome: "denied" }>;
export type PasswordRoleSignInNotMatched = Readonly<{ outcome: "not_matched" }>;
export type GuideSignInInvalidEmail = Readonly<{ outcome: "invalid_email" }>;
export type AdminSignInInvalidIdentifier = Readonly<{ outcome: "invalid_identifier" }>;
export type GuideSignInSignedIn = Readonly<{ outcome: "signed_in"; destination: typeof GUIDE_SIGN_IN_HOME_PATH }>;
export type AdminSignInSignedIn = Readonly<{ outcome: "signed_in"; destination: typeof ADMIN_SIGN_IN_HOME_PATH }>;

export type GuideSignInSendResult = PasswordRoleSignInSendAcknowledgment | PasswordRoleSignInFlowSendAcknowledgment | GuideSignInInvalidEmail | PasswordRoleSignInDenied;
export type AdminSignInSendResult = PasswordRoleSignInSendAcknowledgment | PasswordRoleSignInFlowSendAcknowledgment | AdminSignInInvalidIdentifier | PasswordRoleSignInDenied;
export type GuideSignInVerifyBodyResult = GuideSignInSignedIn | PasswordRoleSignInNotMatched | PasswordRoleSignInDenied;
export type AdminSignInVerifyBodyResult = AdminSignInSignedIn | PasswordRoleSignInNotMatched | PasswordRoleSignInDenied;

// Invalid typed identifiers are send-only. No stored-account fact is disclosed.
export const GUIDE_SIGN_IN_INVALID_EMAIL: GuideSignInInvalidEmail = Object.freeze({ outcome: "invalid_email" });
export const ADMIN_SIGN_IN_INVALID_IDENTIFIER: AdminSignInInvalidIdentifier = Object.freeze({ outcome: "invalid_identifier" });

// Verification uses one not_matched from lookup through successful same-account
// factor confirmation, including ownership, operational failure and exceptions.
// Earlier request/guard/configuration failures and handled completion failures
// after both factors retain denied. This does not promise equal timing or undo
// committed state. The accepted human message belongs to the decision/UI owners,
// not to an additional JSON message or reason field here.
export const PASSWORD_ROLE_SIGN_IN_NOT_MATCHED: PasswordRoleSignInNotMatched = Object.freeze({ outcome: "not_matched" });
export const PASSWORD_ROLE_SIGN_IN_DENIED: PasswordRoleSignInDenied = Object.freeze({ outcome: "denied" });

// Adapters use these only on the complete cookie-bearing success response
// returned by their fixed-role core entrypoint. No request selects a destination.
export const GUIDE_SIGN_IN_SIGNED_IN: GuideSignInSignedIn = Object.freeze({
  outcome: "signed_in", destination: GUIDE_SIGN_IN_HOME_PATH,
});
export const ADMIN_SIGN_IN_SIGNED_IN: AdminSignInSignedIn = Object.freeze({
  outcome: "signed_in", destination: ADMIN_SIGN_IN_HOME_PATH,
});

// Every handler-generated POST answer uses 200 and these identical headers.
// Real only-POST handlers, framework GET405, transmitted headers/cookies and
// response delivery still require separate route/runtime proof. Send/refusal
// responses set no cookies; success cookies stay owned by the core and writer.
export const PASSWORD_ROLE_SIGN_IN_RESPONSE_STATUS = 200 as const;
const responseHeaders: Record<string, string> = {};
for (const { name, value } of SESSION_COOKIE_NO_STORE_HEADERS) responseHeaders[name] = value;
responseHeaders["X-Content-Type-Options"] = "nosniff";
export const PASSWORD_ROLE_SIGN_IN_RESPONSE_HEADERS: Readonly<Record<string, string>> = Object.freeze(responseHeaders);
