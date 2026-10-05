import "server-only";

import {
  createVerificationCallSlots,
  createVerificationChallengeIssuerWithSlots,
  createVerificationChallengeRedeemerWithSlots,
  type VerificationChallengeIssuer,
  type VerificationChallengeIssuerDependencies,
  type VerificationChallengeRedeemer,
  type VerificationChallengeRedeemerDependencies,
} from "./verificationChallengeCallersCore";

// Login step 5: the public issuing and redeeming callers for verification
// challenges. The callers themselves live in the restricted
// `verificationChallengeCallersCore.ts`; see its comment for what they do,
// what an `issued` or `redeemed` answer does and does not prove, and the
// caller response deadline.
//
// This module owns two slot pools: one of
// VERIFICATION_CHALLENGE_MAXIMUM_CONCURRENT_ISSUANCES slots for every issuer
// and one of VERIFICATION_CHALLENGE_MAXIMUM_CONCURRENT_REDEMPTIONS slots for
// every redeemer built here, by any root. Its factories take no pool, refuse a
// dependency object that carries one (the core checks exact keys), and pass
// their own pool as a separate argument, so a caller's object can never
// replace it. The boundary test VCB-006 parses every `src` file with
// TypeScript's parser and finds that this module and three named unit tests
// are the only literal `src` importers of the core: the issuance and
// redemption tests, which pass test pools to the core's caller factories, and
// the composition test, which exercises its slot factory. VCB-004 refuses
// computed references and `import.meta` in every non-test file. So no caller
// built through these public factories can supply a pool, and no
// parser-checked `src` reference outside this module and those unit tests
// reaches the core. Reflective loading (`createRequire`, `module.require`,
// the `Function` constructor) is beyond those source checks and could still
// reach the core's exported factories.
//
// The bound this proves: per loaded copy of this module in one server process,
// at most that many issuances (each a database call followed by at most one
// delivery attempt through the delivery boundary) and at most that many
// redemption calls are in progress at the client at any moment, for every
// caller built through these factories, whichever roots built them. A caller
// holds its slot until its database call has settled (and, for issuance,
// until the delivery boundary has returned); a call that never settles holds
// its slot indefinitely, so a pool fails closed to `busy` rather than growing.
// Not proved: anything across processes or server instances; that a transport
// cancels, or that PostgreSQL stops work, when the abort requests
// cancellation; or anything a transport does after the delivery boundary has
// returned (the local SMTP transport may still close its socket within its
// 1 s QUIT grace).
//
// Dormant: nothing calls these factories outside the dormant composition root.
// Keep this module direct-import only and off every barrel.

export {
  VERIFICATION_CHALLENGE_ACKNOWLEDGMENT,
  VERIFICATION_CHALLENGE_CONTACT_METHOD_TYPES,
  VERIFICATION_CHALLENGE_DELIVERY_CHANNEL_BY_CONTACT_TYPE,
  VERIFICATION_CHALLENGE_ERROR_CODES,
  VERIFICATION_CHALLENGE_ISSUANCE_FUNCTION,
  VERIFICATION_CHALLENGE_ISSUANCE_OUTCOMES,
  VERIFICATION_CHALLENGE_LIMITS,
  VERIFICATION_CHALLENGE_REDEMPTION_FUNCTION,
  VERIFICATION_CHALLENGE_REDEMPTION_OUTCOMES,
  VERIFICATION_CHALLENGE_UNBOUND_PURPOSES,
  VerificationChallengeError,
  toVerificationChallengeIssuanceAcknowledgment,
  type VerificationChallengeContactMethodType,
  type VerificationChallengeDeliveryStatus,
  type VerificationChallengeErrorCode,
  type VerificationChallengeIssuanceAcknowledgment,
  type VerificationChallengeIssuanceOutcome,
  type VerificationChallengeIssuanceRequest,
  type VerificationChallengeIssuanceResult,
  type VerificationChallengeIssuer,
  type VerificationChallengeIssuerDependencies,
  type VerificationChallengeRedeemer,
  type VerificationChallengeRedeemerDependencies,
  type VerificationChallengeRedemptionOutcome,
  type VerificationChallengeRedemptionRequest,
  type VerificationChallengeRedemptionResult,
  type VerificationChallengeRpcClient,
  type VerificationChallengeRpcRequest,
} from "./verificationChallengeCallersCore";

export const VERIFICATION_CHALLENGE_MAXIMUM_CONCURRENT_ISSUANCES = 4;
export const VERIFICATION_CHALLENGE_MAXIMUM_CONCURRENT_REDEMPTIONS = 4;

// The two pools every issuer and every redeemer from this module share.
const issuanceSlots = createVerificationCallSlots(
  VERIFICATION_CHALLENGE_MAXIMUM_CONCURRENT_ISSUANCES,
);
const redemptionSlots = createVerificationCallSlots(
  VERIFICATION_CHALLENGE_MAXIMUM_CONCURRENT_REDEMPTIONS,
);

// An issuer bound to this module's one issuance pool.
export function createVerificationChallengeIssuer(
  dependencies: VerificationChallengeIssuerDependencies,
): VerificationChallengeIssuer {
  return createVerificationChallengeIssuerWithSlots(dependencies, issuanceSlots);
}

// A redeemer bound to this module's one redemption pool.
export function createVerificationChallengeRedeemer(
  dependencies: VerificationChallengeRedeemerDependencies,
): VerificationChallengeRedeemer {
  return createVerificationChallengeRedeemerWithSlots(dependencies, redemptionSlots);
}
