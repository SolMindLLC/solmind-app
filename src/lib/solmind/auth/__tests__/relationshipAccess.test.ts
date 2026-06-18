import { describe, expect, it } from "vitest";

import {
  RELATIONSHIP_ACCESS_DENY_REASONS,
  canAdminAccessRelationshipForQa,
  canExplorerAccessRelationship,
  canGuideAccessRelationship,
  type SolMindRelationshipRecord,
} from "../relationshipAccess";
import type { SolMindActor } from "../roleContext";

// Stable profile IDs. The actor-derived profile id is server-derived; the
// relationship record is server-fetched. Browser input only selects which
// relationship record is loaded, never the profile id used in the comparison.
const GUIDE_PROFILE_A = "guide-profile-a";
const GUIDE_PROFILE_B = "guide-profile-b";
const EXPLORER_PROFILE_A = "explorer-profile-a";
const EXPLORER_PROFILE_B = "explorer-profile-b";

const GUIDE_ACTOR: SolMindActor = {
  userAccountId: "user-guide-1",
  role: "guide",
};
const EXPLORER_ACTOR: SolMindActor = {
  userAccountId: "user-explorer-1",
  role: "explorer",
};
const ADMIN_ACTOR: SolMindActor = {
  userAccountId: "user-admin-1",
  role: "admin",
};

// An active relationship tying Guide A to Explorer A.
function activeRelationship(
  overrides: Partial<SolMindRelationshipRecord> = {},
): SolMindRelationshipRecord {
  return {
    guideExplorerRelationshipId: "rel-1",
    guideProfileId: GUIDE_PROFILE_A,
    explorerProfileId: EXPLORER_PROFILE_A,
    relationshipStatus: "active",
    ...overrides,
  };
}

describe("canGuideAccessRelationship - allow", () => {
  it("allows an active Guide actor for an active relationship tied to that Guide profile", () => {
    const result = canGuideAccessRelationship({
      actor: GUIDE_ACTOR,
      actorGuideProfileId: GUIDE_PROFILE_A,
      relationship: activeRelationship(),
    });

    expect(result).toEqual({ allowed: true, actor: GUIDE_ACTOR });
  });
});

describe("canGuideAccessRelationship - deny", () => {
  it("denies an Explorer actor on the Guide path", () => {
    const result = canGuideAccessRelationship({
      actor: EXPLORER_ACTOR,
      actorGuideProfileId: GUIDE_PROFILE_A,
      relationship: activeRelationship(),
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_ACCESS_DENY_REASONS.ACTOR_ROLE_MISMATCH,
    });
  });

  it("denies an Admin actor on the Guide path", () => {
    const result = canGuideAccessRelationship({
      actor: ADMIN_ACTOR,
      actorGuideProfileId: GUIDE_PROFILE_A,
      relationship: activeRelationship(),
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_ACCESS_DENY_REASONS.ACTOR_ROLE_MISMATCH,
    });
  });

  it("denies a Guide accessing a relationship tied to a different Guide profile", () => {
    const result = canGuideAccessRelationship({
      actor: GUIDE_ACTOR,
      actorGuideProfileId: GUIDE_PROFILE_A,
      relationship: activeRelationship({ guideProfileId: GUIDE_PROFILE_B }),
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_ACCESS_DENY_REASONS.GUIDE_PROFILE_MISMATCH,
    });
  });

  it("denies a non-active relationship (paused, ended, invited, intake_pending, transferred)", () => {
    for (const relationshipStatus of [
      "paused",
      "ended",
      "invited",
      "intake_pending",
      "transferred",
    ]) {
      const result = canGuideAccessRelationship({
        actor: GUIDE_ACTOR,
        actorGuideProfileId: GUIDE_PROFILE_A,
        relationship: activeRelationship({ relationshipStatus }),
      });

      expect(result).toEqual({
        allowed: false,
        reason: RELATIONSHIP_ACCESS_DENY_REASONS.RELATIONSHIP_NOT_ACTIVE,
      });
    }
  });

  it("denies an unknown relationship status by default", () => {
    const result = canGuideAccessRelationship({
      actor: GUIDE_ACTOR,
      actorGuideProfileId: GUIDE_PROFILE_A,
      relationship: activeRelationship({ relationshipStatus: "mystery" }),
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_ACCESS_DENY_REASONS.RELATIONSHIP_NOT_ACTIVE,
    });
  });
});

describe("canExplorerAccessRelationship - allow", () => {
  it("allows an active Explorer actor for an active relationship tied to that Explorer profile", () => {
    const result = canExplorerAccessRelationship({
      actor: EXPLORER_ACTOR,
      actorExplorerProfileId: EXPLORER_PROFILE_A,
      relationship: activeRelationship(),
    });

    expect(result).toEqual({ allowed: true, actor: EXPLORER_ACTOR });
  });
});

describe("canExplorerAccessRelationship - deny", () => {
  it("denies a Guide actor on the Explorer path", () => {
    const result = canExplorerAccessRelationship({
      actor: GUIDE_ACTOR,
      actorExplorerProfileId: EXPLORER_PROFILE_A,
      relationship: activeRelationship(),
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_ACCESS_DENY_REASONS.ACTOR_ROLE_MISMATCH,
    });
  });

  it("denies an Explorer accessing another Explorer's relationship", () => {
    // The actor is Explorer A, but the loaded relationship belongs to
    // Explorer B. The actor-derived profile id wins; the mismatch denies.
    const result = canExplorerAccessRelationship({
      actor: EXPLORER_ACTOR,
      actorExplorerProfileId: EXPLORER_PROFILE_A,
      relationship: activeRelationship({
        explorerProfileId: EXPLORER_PROFILE_B,
      }),
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_ACCESS_DENY_REASONS.EXPLORER_PROFILE_MISMATCH,
    });
  });

  it("denies a non-active relationship", () => {
    const result = canExplorerAccessRelationship({
      actor: EXPLORER_ACTOR,
      actorExplorerProfileId: EXPLORER_PROFILE_A,
      relationship: activeRelationship({ relationshipStatus: "paused" }),
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_ACCESS_DENY_REASONS.RELATIONSHIP_NOT_ACTIVE,
    });
  });

  it("denies an unknown relationship status by default", () => {
    const result = canExplorerAccessRelationship({
      actor: EXPLORER_ACTOR,
      actorExplorerProfileId: EXPLORER_PROFILE_A,
      relationship: activeRelationship({ relationshipStatus: "mystery" }),
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_ACCESS_DENY_REASONS.RELATIONSHIP_NOT_ACTIVE,
    });
  });
});

describe("browser-supplied IDs are selectors only, not authority", () => {
  it("ignores a browser-claimed profile id and uses the actor-derived profile id", () => {
    // Simulate a request where the browser selected relationship rel-1 (which
    // belongs to Explorer B) while authenticated as Explorer A. The helper is
    // given the actor-derived profile id (EXPLORER_PROFILE_A), so even though
    // the relationship record exists and is active, access is denied.
    const browserSelectedRelationship = activeRelationship({
      guideExplorerRelationshipId: "rel-belongs-to-b",
      explorerProfileId: EXPLORER_PROFILE_B,
    });

    const result = canExplorerAccessRelationship({
      actor: EXPLORER_ACTOR,
      actorExplorerProfileId: EXPLORER_PROFILE_A,
      relationship: browserSelectedRelationship,
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_ACCESS_DENY_REASONS.EXPLORER_PROFILE_MISMATCH,
    });
  });
});

describe("canAdminAccessRelationshipForQa", () => {
  it("allows an Admin actor to access an active relationship for QA", () => {
    const result = canAdminAccessRelationshipForQa({
      actor: ADMIN_ACTOR,
      relationship: activeRelationship(),
    });

    expect(result).toEqual({ allowed: true, actor: ADMIN_ACTOR });
  });

  it("denies a Guide actor on the Admin QA path", () => {
    const result = canAdminAccessRelationshipForQa({
      actor: GUIDE_ACTOR,
      relationship: activeRelationship(),
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_ACCESS_DENY_REASONS.ACTOR_ROLE_MISMATCH,
    });
  });

  it("denies an Explorer actor on the Admin QA path", () => {
    const result = canAdminAccessRelationshipForQa({
      actor: EXPLORER_ACTOR,
      relationship: activeRelationship(),
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_ACCESS_DENY_REASONS.ACTOR_ROLE_MISMATCH,
    });
  });

  it("denies an Admin on the Admin QA path for a non-active relationship", () => {
    const result = canAdminAccessRelationshipForQa({
      actor: ADMIN_ACTOR,
      relationship: activeRelationship({ relationshipStatus: "ended" }),
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_ACCESS_DENY_REASONS.RELATIONSHIP_NOT_ACTIVE,
    });
  });
});
