// SolMind MVP0 Guide/Explorer relationship access helper.
//
// Purpose:
//   - decide deterministically whether a resolved SolMind actor may access a
//     specific Guide/Explorer relationship record
//   - keep Guide access and Explorer access on strictly separate paths
//   - require an active relationship tied to the actor's own profile
//   - deny by default on role mismatch, inactive/unknown relationship status,
//     or any profile-id mismatch
//
// Architecture notes (MVP0):
//   - The actor passed in MUST already be a trusted, resolved actor (see
//     resolveActorContext in ./roleContext). This helper does not re-prove
//     authentication or session validity.
//   - The actor's profile id (guideProfileId / explorerProfileId) is
//     SERVER-DERIVED from the actor's identity, not browser-supplied. Browser
//     input only selects WHICH relationship record to load; it never supplies
//     the profile id used for the comparison. The helper compares the
//     actor-derived profile id against the loaded relationship record.
//   - This helper is pure and deterministic. It makes NO Supabase, network,
//     filesystem, or environment calls.
//
// String values mirror the canonical schema constraints in
// ../../../../../solmind-docs/execution/03_SolMind_Phase0_Data_Model_Spec_v1_1.md:
//   - core.guide_explorer_relationship.relationship_status / .guide_profile_id /
//     .explorer_profile_id

import { SOLMIND_ROLES } from "../roles";
import type { SolMindActor } from "./roleContext";

// core.guide_explorer_relationship.relationship_status
export type SolMindRelationshipStatus =
  | "invited"
  | "intake_pending"
  | "active"
  | "paused"
  | "ended"
  | "transferred";

// Server-fetched relationship record (source of truth). Status is typed as a
// plain string so an unknown/unexpected status is still accepted as input and
// then denied by the deny-by-default check below.
export type SolMindRelationshipRecord = {
  guideExplorerRelationshipId: string;
  guideProfileId: string;
  explorerProfileId: string;
  relationshipStatus: string;
};

// --- Deny reason codes ---

export const RELATIONSHIP_ACCESS_DENY_REASONS = {
  ACTOR_ROLE_MISMATCH: "actor_role_mismatch",
  RELATIONSHIP_NOT_ACTIVE: "relationship_not_active",
  GUIDE_PROFILE_MISMATCH: "guide_profile_mismatch",
  EXPLORER_PROFILE_MISMATCH: "explorer_profile_mismatch",
} as const;

export type RelationshipAccessDenyReason =
  (typeof RELATIONSHIP_ACCESS_DENY_REASONS)[keyof typeof RELATIONSHIP_ACCESS_DENY_REASONS];

// --- Result shape ---

export type RelationshipAccessResult =
  | { allowed: true; actor: SolMindActor }
  | { allowed: false; reason: RelationshipAccessDenyReason };

const ACTIVE_RELATIONSHIP_STATUS: SolMindRelationshipStatus = "active";

function deny(
  reason: RelationshipAccessDenyReason,
): RelationshipAccessResult {
  return { allowed: false, reason };
}

function isRelationshipActive(relationship: SolMindRelationshipRecord): boolean {
  // Only "active" is accepted. invited, intake_pending, paused, ended,
  // transferred, and any unknown status are denied by default.
  return relationship.relationshipStatus === ACTIVE_RELATIONSHIP_STATUS;
}

// Guide access: the actor must be a Guide, the relationship must be active, and
// the relationship's guide_profile_id must match the actor-derived guide
// profile id.
export function canGuideAccessRelationship(args: {
  actor: SolMindActor;
  // Server-derived from the actor's Guide identity, NOT browser-supplied.
  actorGuideProfileId: string;
  relationship: SolMindRelationshipRecord;
}): RelationshipAccessResult {
  const { actor, actorGuideProfileId, relationship } = args;

  if (actor.role !== SOLMIND_ROLES.GUIDE) {
    return deny(RELATIONSHIP_ACCESS_DENY_REASONS.ACTOR_ROLE_MISMATCH);
  }
  if (!isRelationshipActive(relationship)) {
    return deny(RELATIONSHIP_ACCESS_DENY_REASONS.RELATIONSHIP_NOT_ACTIVE);
  }
  if (relationship.guideProfileId !== actorGuideProfileId) {
    return deny(RELATIONSHIP_ACCESS_DENY_REASONS.GUIDE_PROFILE_MISMATCH);
  }

  return { allowed: true, actor };
}

// Explorer access: the actor must be an Explorer, the relationship must be
// active, and the relationship's explorer_profile_id must match the
// actor-derived explorer profile id.
export function canExplorerAccessRelationship(args: {
  actor: SolMindActor;
  // Server-derived from the actor's Explorer identity, NOT browser-supplied.
  actorExplorerProfileId: string;
  relationship: SolMindRelationshipRecord;
}): RelationshipAccessResult {
  const { actor, actorExplorerProfileId, relationship } = args;

  if (actor.role !== SOLMIND_ROLES.EXPLORER) {
    return deny(RELATIONSHIP_ACCESS_DENY_REASONS.ACTOR_ROLE_MISMATCH);
  }
  if (!isRelationshipActive(relationship)) {
    return deny(RELATIONSHIP_ACCESS_DENY_REASONS.RELATIONSHIP_NOT_ACTIVE);
  }
  if (relationship.explorerProfileId !== actorExplorerProfileId) {
    return deny(RELATIONSHIP_ACCESS_DENY_REASONS.EXPLORER_PROFILE_MISMATCH);
  }

  return { allowed: true, actor };
}

// Explicit, intentionally-named Admin allowance for QA / support access to a
// relationship. This is NOT a blanket relationship-access allow for Admins on
// the Guide or Explorer paths; it exists only behind this clearly-named helper.
// It still requires the actor to be an Admin and the relationship to be active.
export function canAdminAccessRelationshipForQa(args: {
  actor: SolMindActor;
  relationship: SolMindRelationshipRecord;
}): RelationshipAccessResult {
  const { actor, relationship } = args;

  if (actor.role !== SOLMIND_ROLES.ADMIN) {
    return deny(RELATIONSHIP_ACCESS_DENY_REASONS.ACTOR_ROLE_MISMATCH);
  }
  if (!isRelationshipActive(relationship)) {
    return deny(RELATIONSHIP_ACCESS_DENY_REASONS.RELATIONSHIP_NOT_ACTIVE);
  }

  return { allowed: true, actor };
}
