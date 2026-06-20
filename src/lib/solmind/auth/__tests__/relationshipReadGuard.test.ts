import { describe, expect, it } from "vitest";

import {
  RELATIONSHIP_READ_DENY_REASON,
  authorizeGuideRelationshipRead,
} from "../relationshipReadGuard";
import type { DeriveTrustedServerAuthContextInput } from "../serverAuthContext";
import type { SolMindRelationshipRecord } from "../relationshipAccess";

// Stable IDs. Every server-loaded record below is authority; the requested*
// selector values are browser-supplied and never authority.
const GUIDE_USER_ID = "user-guide-1";
const ADMIN_USER_ID = "user-admin-1";
const EXPLORER_USER_ID = "user-explorer-1";

const GUIDE_PROFILE_A = "guide-profile-a";
const GUIDE_PROFILE_B = "guide-profile-b";
const EXPLORER_PROFILE_A = "explorer-profile-a";

const RELATIONSHIP_ID = "rel-1";
const OTHER_RELATIONSHIP_ID = "rel-belongs-to-someone-else";

const PROVIDER_NAME = "supabase";

// Build a fully-valid trusted-context input for a given canonical role, in the
// style of serverAuthContext.test.ts. The active role is carried by the
// server-loaded session record.
function validServerAuthContextInput(
  role: "admin" | "guide" | "explorer",
): DeriveTrustedServerAuthContextInput {
  const userAccountId =
    role === "admin"
      ? ADMIN_USER_ID
      : role === "guide"
        ? GUIDE_USER_ID
        : EXPLORER_USER_ID;
  const providerUserId = `auth-user-${role}-1`;

  return {
    authenticatedUser: { providerName: PROVIDER_NAME, providerUserId },
    authProviderIdentity: {
      userAccountId,
      providerName: PROVIDER_NAME,
      providerUserId,
      status: "active",
    },
    userAccount: { userAccountId, accountStatus: "active" },
    session: {
      userAccountId,
      activeRoleContext: role,
      sessionStatus: "active",
    },
    activeRoleAssignment: {
      userAccountId,
      roleCode: role,
      roleStatus: "active",
    },
    guideProfile:
      role === "guide"
        ? { guideProfileId: GUIDE_PROFILE_A, userAccountId, status: "active" }
        : null,
    explorerProfile:
      role === "explorer"
        ? {
            explorerProfileId: EXPLORER_PROFILE_A,
            userAccountId,
            status: "active",
          }
        : null,
  };
}

// An active relationship tying Guide profile A to Explorer profile A.
function activeRelationship(
  overrides: Partial<SolMindRelationshipRecord> = {},
): SolMindRelationshipRecord {
  return {
    guideExplorerRelationshipId: RELATIONSHIP_ID,
    guideProfileId: GUIDE_PROFILE_A,
    explorerProfileId: EXPLORER_PROFILE_A,
    relationshipStatus: "active",
    ...overrides,
  };
}

describe("authorizeGuideRelationshipRead - allow", () => {
  it("allows a guide to read an active assigned relationship when the server-derived guide identity owns it", () => {
    const result = authorizeGuideRelationshipRead({
      serverAuthContext: validServerAuthContextInput("guide"),
      relationship: activeRelationship(),
      selectors: { requestedRelationshipId: RELATIONSHIP_ID },
    });

    expect(result).toEqual({
      allowed: true,
      context: {
        activeRole: "guide",
        identity: {
          userAccountId: GUIDE_USER_ID,
          guideProfileId: GUIDE_PROFILE_A,
          explorerProfileId: null,
        },
      },
      relationship: activeRelationship(),
    });
  });
});

describe("authorizeGuideRelationshipRead - role denials", () => {
  it("denies an admin trying to use the guide relationship read guard", () => {
    const result = authorizeGuideRelationshipRead({
      serverAuthContext: validServerAuthContextInput("admin"),
      relationship: activeRelationship(),
      selectors: { requestedRelationshipId: RELATIONSHIP_ID },
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_READ_DENY_REASON,
    });
  });

  it("denies an explorer trying to use the guide relationship read guard", () => {
    const result = authorizeGuideRelationshipRead({
      serverAuthContext: validServerAuthContextInput("explorer"),
      relationship: activeRelationship(),
      selectors: { requestedRelationshipId: RELATIONSHIP_ID },
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_READ_DENY_REASON,
    });
  });
});

describe("authorizeGuideRelationshipRead - context and record denials", () => {
  it("denies when trusted server context derivation fails (missing authenticated user)", () => {
    const input = validServerAuthContextInput("guide");
    const result = authorizeGuideRelationshipRead({
      serverAuthContext: { ...input, authenticatedUser: null },
      relationship: activeRelationship(),
      selectors: { requestedRelationshipId: RELATIONSHIP_ID },
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_READ_DENY_REASON,
    });
  });

  it("denies when no relationship record is provided", () => {
    const result = authorizeGuideRelationshipRead({
      serverAuthContext: validServerAuthContextInput("guide"),
      relationship: null,
      selectors: { requestedRelationshipId: RELATIONSHIP_ID },
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_READ_DENY_REASON,
    });
  });

  it("denies when requestedRelationshipId does not match the server-loaded relationship record", () => {
    const result = authorizeGuideRelationshipRead({
      serverAuthContext: validServerAuthContextInput("guide"),
      relationship: activeRelationship(),
      selectors: { requestedRelationshipId: OTHER_RELATIONSHIP_ID },
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_READ_DENY_REASON,
    });
  });

  it("denies when the relationship is not active", () => {
    const result = authorizeGuideRelationshipRead({
      serverAuthContext: validServerAuthContextInput("guide"),
      relationship: activeRelationship({ relationshipStatus: "paused" }),
      selectors: { requestedRelationshipId: RELATIONSHIP_ID },
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_READ_DENY_REASON,
    });
  });

  it("denies cross-guide access (relationship owned by a different guide profile)", () => {
    const result = authorizeGuideRelationshipRead({
      serverAuthContext: validServerAuthContextInput("guide"),
      relationship: activeRelationship({ guideProfileId: GUIDE_PROFILE_B }),
      selectors: { requestedRelationshipId: RELATIONSHIP_ID },
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_READ_DENY_REASON,
    });
  });
});

describe("authorizeGuideRelationshipRead - selectors are not authority", () => {
  it("proves requestedRole is not authority: requestedRole guide cannot grant access when the server-derived active role is explorer", () => {
    const result = authorizeGuideRelationshipRead({
      serverAuthContext: validServerAuthContextInput("explorer"),
      relationship: activeRelationship(),
      selectors: {
        requestedRelationshipId: RELATIONSHIP_ID,
        requestedRole: "guide",
      },
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_READ_DENY_REASON,
    });
  });

  it("proves requestedGuideProfileId is not authority: a selector claiming the owning guide profile cannot grant cross-guide access", () => {
    // The server-derived guide identity owns GUIDE_PROFILE_A, but the
    // relationship belongs to GUIDE_PROFILE_B. The browser selector claims
    // requestedGuideProfileId = GUIDE_PROFILE_B (the owning profile). It is
    // ignored; authority is the server-derived guide profile id, so access is
    // still denied.
    const result = authorizeGuideRelationshipRead({
      serverAuthContext: validServerAuthContextInput("guide"),
      relationship: activeRelationship({ guideProfileId: GUIDE_PROFILE_B }),
      selectors: {
        requestedRelationshipId: RELATIONSHIP_ID,
        requestedGuideProfileId: GUIDE_PROFILE_B,
      },
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_READ_DENY_REASON,
    });
  });
});

describe("authorizeGuideRelationshipRead - denial output does not leak detail", () => {
  it("exposes only the generic outward reason and no record-specific failure detail", () => {
    // Force a specific internal boundary failure (cross-guide profile mismatch).
    // The outward result must reveal only the generic relationship-read denial,
    // with no internal reason or relationship detail key.
    const result = authorizeGuideRelationshipRead({
      serverAuthContext: validServerAuthContextInput("guide"),
      relationship: activeRelationship({ guideProfileId: GUIDE_PROFILE_B }),
      selectors: { requestedRelationshipId: RELATIONSHIP_ID },
    });

    expect(result).toEqual({
      allowed: false,
      reason: RELATIONSHIP_READ_DENY_REASON,
    });
    // No extra keys beyond allowed + reason, and the reason is the generic code.
    expect(Object.keys(result).sort()).toEqual(["allowed", "reason"]);
    if (!result.allowed) {
      expect(result.reason).toBe("relationship_read_denied");
    }
  });
});
