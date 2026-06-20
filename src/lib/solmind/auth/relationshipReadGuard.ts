// SolMind MVP0 Guide relationship read guard.
//
// Purpose:
//   - compose trusted server auth context derivation with the existing Guide
//     relationship access boundary into a single deterministic allow/deny guard
//     a future Guide-facing server read can call;
//   - prove the server-mediated pattern for a relationship read: derive trusted
//     context server-side, require the server-derived active role to be Guide,
//     and authorize the relationship from the server-derived Guide identity
//     only, never from any browser-supplied role or profile selector.
//
// Architecture notes (MVP0):
//   - The decision authority is the TrustedServerAuthContext produced by
//     deriveTrustedServerAuthContext: its activeRole and its server-derived
//     identity (including the Guide profile id). Browser-supplied selectors
//     (requestedRole, requestedGuideProfileId, requestedExplorerProfileId) are
//     accepted for pass-through but are NEVER consulted for authority. Only
//     requestedRelationshipId is used, and only to confirm it matches the
//     server-loaded relationship record (handled inside the boundary helper).
//   - This is Guide relationship read only. It does not implement Explorer or
//     Admin relationship read; Explorer/Admin actors are denied here.
//   - Denial is deny-by-default and intentionally opaque. Every failure
//     (derivation failure, non-Guide role, missing relationship, id mismatch,
//     inactive relationship, cross-Guide access, selector spoofing) collapses to
//     one generic outward reason. The caller never learns which record or
//     internal step failed.
//   - This helper is pure and deterministic. It makes NO Supabase, network,
//     filesystem, cookie, header, or environment calls, and performs no
//     redirects. It only composes existing pure helpers.
//
// This module adds NO new role strings or product terms.

import { SOLMIND_ROLES } from "../roles";
import { decideGuideRelationshipAccess } from "./accessBoundary";
import {
  deriveTrustedServerAuthContext,
  type DeriveTrustedServerAuthContextInput,
  type TrustedServerAuthContext,
} from "./serverAuthContext";
import { type SolMindRelationshipRecord } from "./relationshipAccess";

// --- Browser/request selectors (NOT authority) ---
//
// requestedRelationshipId names which relationship the client wants; it is
// matched against the server-loaded relationship record inside the boundary.
// The optional fields are accepted so callers can pass through what the client
// claimed, but none of them are ever read for the access decision.
export type RelationshipReadSelectors = {
  requestedRelationshipId: string;
  requestedRole?: string;
  requestedGuideProfileId?: string;
  requestedExplorerProfileId?: string;
};

// --- Guard input ---
//
// serverAuthContext is the trusted, server-loaded record set consumed by
// deriveTrustedServerAuthContext (reused wholesale). relationship is the
// server-loaded relationship record (null when the server did not find one).
// selectors are the browser-supplied values, kept deliberately separate from
// the trusted records.
export type AuthorizeGuideRelationshipReadInput = {
  serverAuthContext: DeriveTrustedServerAuthContextInput;
  relationship: SolMindRelationshipRecord | null;
  selectors: RelationshipReadSelectors;
};

// --- Generic outward denial reason ---
//
// Deny results expose only this single code. Internal derivation/boundary
// reasons and record-level detail are intentionally not surfaced to the caller.
export const RELATIONSHIP_READ_DENY_REASON = "relationship_read_denied" as const;

export type RelationshipReadDenyReason = typeof RELATIONSHIP_READ_DENY_REASON;

// --- Result shape ---

export type AuthorizeGuideRelationshipReadResult =
  | {
      allowed: true;
      context: TrustedServerAuthContext;
      relationship: SolMindRelationshipRecord;
    }
  | { allowed: false; reason: RelationshipReadDenyReason };

function denyRelationshipRead(): AuthorizeGuideRelationshipReadResult {
  return { allowed: false, reason: RELATIONSHIP_READ_DENY_REASON };
}

// Decide whether a Guide may read the requested relationship.
//
// Deny-by-default: returns an allow result ONLY when the trusted context
// derives successfully, the server-derived active role is Guide, a relationship
// record exists, and the existing Guide relationship boundary allows the
// server-derived Guide identity to access it. Any failure returns the same
// generic denial.
export function authorizeGuideRelationshipRead(
  input: AuthorizeGuideRelationshipReadInput,
): AuthorizeGuideRelationshipReadResult {
  // 1. Derive the trusted server auth context. On any derivation failure, deny
  //    without surfacing the internal reason.
  const derivation = deriveTrustedServerAuthContext(input.serverAuthContext);
  if (!derivation.allowed) {
    return denyRelationshipRead();
  }

  const { context } = derivation;

  // 2. This guard is Guide-only. The server-derived active role is the sole
  //    authority for this check; a browser-claimed role cannot satisfy it.
  if (context.activeRole !== SOLMIND_ROLES.GUIDE) {
    return denyRelationshipRead();
  }

  // 3. A server-loaded relationship record must exist.
  const { relationship } = input;
  if (relationship === null) {
    return denyRelationshipRead();
  }

  // 4. Authorize via the existing Guide relationship boundary. The selectors
  //    handed to the boundary are built from the TRUSTED context, not from the
  //    browser: requestedRole and requestedUserAccountId come from the derived
  //    context, and the Guide profile id used for the match is the
  //    server-derived context.identity.guideProfileId (inside the boundary).
  //    input.selectors.requestedGuideProfileId / requestedRole are never used
  //    here. Only requestedRelationshipId flows through, and the boundary
  //    confirms it matches the server-loaded record.
  const decision = decideGuideRelationshipAccess({
    identity: context.identity,
    selectors: {
      requestedRole: context.activeRole,
      requestedUserAccountId: context.identity.userAccountId,
    },
    requestedRelationshipId: input.selectors.requestedRelationshipId,
    userAccount: input.serverAuthContext.userAccount,
    roleAssignment: input.serverAuthContext.activeRoleAssignment,
    session: input.serverAuthContext.session,
    relationship,
  });
  if (!decision.allowed) {
    return denyRelationshipRead();
  }

  return { allowed: true, context, relationship };
}
