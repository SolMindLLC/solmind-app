// SolMind MVP0 server-side access boundary helper.
//
// Purpose:
//   - represent the trusted, server-established authenticated SolMind identity
//     (who the request actually is) separately from the raw, browser-supplied
//     selectors (what the request claims to be acting as);
//   - bind browser-supplied selectors to that authenticated identity BEFORE any
//     authorization decision, so a client value can never act as authority;
//   - compose the existing deny-by-default helpers (resolveActorContext and the
//     relationship-access helpers) into a single access decision per request;
//   - keep Guide access and Explorer access on strictly separate paths.
//
// Architecture notes (MVP0):
//   - Supabase Auth proves authentication only. The AuthenticatedIdentity passed
//     in MUST already be derived server-side from the authenticated Supabase
//     session plus the trusted SolMind session/identity records. Its
//     userAccountId and profile ids are AUTHORITY, never browser-supplied.
//   - AccessSelectors are raw, browser-supplied values. They SELECT which
//     server-side decision to attempt; they never grant access by themselves.
//     This helper normalizes them and refuses to treat them as authority: a
//     selector that does not match the authenticated identity is denied before
//     any record is trusted.
//   - This helper is pure and deterministic. It makes NO Supabase, network,
//     filesystem, or environment calls. Callers fetch records server-side and
//     pass plain objects in, exactly as with the helpers it composes.
//
// This module adds NO new role strings or product terms. Role comparisons are
// delegated to the existing helpers, which use the canonical SOLMIND_ROLES.

import {
  resolveActorContext,
  type ActorDenyReason,
  type ResolveActorContextResult,
  type SolMindActor,
  type SolMindRoleAssignmentRecord,
  type SolMindSessionRecord,
  type SolMindUserAccountRecord,
} from "./roleContext";
import {
  canAdminAccessRelationshipForQa,
  canExplorerAccessRelationship,
  canGuideAccessRelationship,
  type RelationshipAccessDenyReason,
  type SolMindRelationshipRecord,
} from "./relationshipAccess";

// --- Trusted, server-established identity (AUTHORITY) ---
//
// Built server-side from the authenticated Supabase session and the trusted
// SolMind identity/session records. Never constructed from browser input.
// guideProfileId / explorerProfileId are the actor-derived profile ids used for
// relationship access; each is null when this identity has no profile of that
// kind.
export type AuthenticatedIdentity = {
  userAccountId: string;
  guideProfileId: string | null;
  explorerProfileId: string | null;
};

// --- Raw, browser-supplied selectors (NOT authority) ---
//
// These are whatever the client sent. They are normalized and bound to the
// authenticated identity before any decision is trusted.
export type AccessSelectors = {
  requestedRole: string;
  requestedUserAccountId: string;
};

// --- Deny reason codes added by this boundary ---
//
// These sit alongside (and are returned together with) the deny reasons from
// the helpers this module composes.
export const ACCESS_BOUNDARY_DENY_REASONS = {
  // The browser-supplied user-account selector does not match the trusted
  // authenticated identity. The selector is being treated as a selector, not
  // as authority: it cannot name an account other than the authenticated one.
  SELECTOR_IDENTITY_MISMATCH: "selector_identity_mismatch",
  // A relationship decision was requested but the authenticated identity has no
  // server-derived profile id of the required kind.
  MISSING_GUIDE_PROFILE: "missing_guide_profile",
  MISSING_EXPLORER_PROFILE: "missing_explorer_profile",
  // The browser-supplied relationship selector does not match the relationship
  // record the server loaded. The selector cannot redirect the decision onto a
  // different record than the one actually fetched.
  RELATIONSHIP_SELECTOR_MISMATCH: "relationship_selector_mismatch",
} as const;

export type AccessBoundaryDenyReason =
  (typeof ACCESS_BOUNDARY_DENY_REASONS)[keyof typeof ACCESS_BOUNDARY_DENY_REASONS];

// --- Result shapes ---

export type AuthenticatedActorResult =
  | { allowed: true; actor: SolMindActor }
  | { allowed: false; reason: ActorDenyReason | AccessBoundaryDenyReason };

export type RelationshipAccessDecisionResult =
  | { allowed: true; actor: SolMindActor }
  | {
      allowed: false;
      reason:
        | ActorDenyReason
        | AccessBoundaryDenyReason
        | RelationshipAccessDenyReason;
    };

// Normalize a single browser-supplied selector string. Trims surrounding
// whitespace only. Normalization never widens access on its own: the normalized
// value still has to match the authenticated identity and the server-fetched
// records before anything is allowed.
function normalizeSelector(value: string): string {
  return value.trim();
}

// --- Relationship decision input ---

type RelationshipDecisionInput = {
  identity: AuthenticatedIdentity;
  selectors: AccessSelectors;
  // Browser-supplied selector naming which relationship the client asked for.
  // Used only to confirm it matches the server-loaded record below.
  requestedRelationshipId: string;
  // Records the caller fetched server-side. Any record not found is null.
  userAccount: SolMindUserAccountRecord | null;
  roleAssignment: SolMindRoleAssignmentRecord | null;
  session: SolMindSessionRecord | null;
  // The relationship record the caller actually loaded server-side.
  relationship: SolMindRelationshipRecord;
};

// Resolve a trusted SolMind actor from the authenticated identity plus the
// browser-supplied selectors and the server-fetched records.
//
// Deny-by-default. The browser-supplied user-account selector must match the
// authenticated identity FIRST; only then do we delegate to resolveActorContext
// to prove the records are internally consistent with that selector.
export function resolveAuthenticatedActor(args: {
  identity: AuthenticatedIdentity;
  selectors: AccessSelectors;
  userAccount: SolMindUserAccountRecord | null;
  roleAssignment: SolMindRoleAssignmentRecord | null;
  session: SolMindSessionRecord | null;
}): AuthenticatedActorResult {
  const { identity, selectors, userAccount, roleAssignment, session } = args;

  const requestedRole = normalizeSelector(selectors.requestedRole);
  const requestedUserAccountId = normalizeSelector(
    selectors.requestedUserAccountId,
  );

  // Bind the selector to the authenticated identity before trusting anything
  // else. A request may only act as its own authenticated account.
  if (requestedUserAccountId !== identity.userAccountId) {
    return {
      allowed: false,
      reason: ACCESS_BOUNDARY_DENY_REASONS.SELECTOR_IDENTITY_MISMATCH,
    };
  }

  // Delegate the record-consistency checks (account/role/session) to the
  // existing pure helper rather than duplicating them here.
  const result: ResolveActorContextResult = resolveActorContext({
    requestedRole,
    requestedUserAccountId,
    userAccount,
    roleAssignment,
    session,
  });

  return result;
}

// Shared first stage for relationship decisions: resolve the actor, then bind
// the relationship selector to the loaded record. Returns either a resolved
// actor or a denial to propagate.
function resolveActorForRelationship(
  input: RelationshipDecisionInput,
):
  | { allowed: true; actor: SolMindActor }
  | RelationshipAccessDecisionResult {
  const actorResult = resolveAuthenticatedActor({
    identity: input.identity,
    selectors: input.selectors,
    userAccount: input.userAccount,
    roleAssignment: input.roleAssignment,
    session: input.session,
  });
  if (!actorResult.allowed) {
    return actorResult;
  }

  // The browser-supplied relationship selector must name the record the server
  // actually loaded. It cannot redirect the decision onto another record.
  const requestedRelationshipId = normalizeSelector(
    input.requestedRelationshipId,
  );
  if (
    requestedRelationshipId !== input.relationship.guideExplorerRelationshipId
  ) {
    return {
      allowed: false,
      reason: ACCESS_BOUNDARY_DENY_REASONS.RELATIONSHIP_SELECTOR_MISMATCH,
    };
  }

  return { allowed: true, actor: actorResult.actor };
}

// Guide relationship access decision. Composes identity binding, selector
// binding, server-derived Guide profile id, and the Guide relationship helper.
export function decideGuideRelationshipAccess(
  input: RelationshipDecisionInput,
): RelationshipAccessDecisionResult {
  const staged = resolveActorForRelationship(input);
  if (!staged.allowed) {
    return staged;
  }

  // The Guide profile id is server-derived from the authenticated identity, not
  // browser-supplied. Without it there is no authority to compare against.
  if (input.identity.guideProfileId === null) {
    return {
      allowed: false,
      reason: ACCESS_BOUNDARY_DENY_REASONS.MISSING_GUIDE_PROFILE,
    };
  }

  return canGuideAccessRelationship({
    actor: staged.actor,
    actorGuideProfileId: input.identity.guideProfileId,
    relationship: input.relationship,
  });
}

// Explorer relationship access decision. Composes identity binding, selector
// binding, server-derived Explorer profile id, and the Explorer relationship
// helper. Kept strictly separate from the Guide path above.
export function decideExplorerRelationshipAccess(
  input: RelationshipDecisionInput,
): RelationshipAccessDecisionResult {
  const staged = resolveActorForRelationship(input);
  if (!staged.allowed) {
    return staged;
  }

  // The Explorer profile id is server-derived from the authenticated identity,
  // not browser-supplied.
  if (input.identity.explorerProfileId === null) {
    return {
      allowed: false,
      reason: ACCESS_BOUNDARY_DENY_REASONS.MISSING_EXPLORER_PROFILE,
    };
  }

  return canExplorerAccessRelationship({
    actor: staged.actor,
    actorExplorerProfileId: input.identity.explorerProfileId,
    relationship: input.relationship,
  });
}

// Admin QA relationship access decision. Composes identity binding and selector
// binding, then delegates to the explicitly-named Admin QA helper. This is the
// only Admin relationship allowance and requires no profile id.
export function decideAdminRelationshipQaAccess(
  input: RelationshipDecisionInput,
): RelationshipAccessDecisionResult {
  const staged = resolveActorForRelationship(input);
  if (!staged.allowed) {
    return staged;
  }

  return canAdminAccessRelationshipForQa({
    actor: staged.actor,
    relationship: input.relationship,
  });
}
