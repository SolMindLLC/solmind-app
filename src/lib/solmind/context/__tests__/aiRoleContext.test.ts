import { describe, expect, it } from "vitest";

import {
  SOLMIND_AI_ROLE_REQUIRED_CONTEXT,
  SOLMIND_AI_ROLES,
  isAiRoleAllowedInContext,
  isSolMindAiRole,
  isSolMindRoleContext,
} from "../aiRoleContext";

const ROLE_CONTEXTS = ["admin", "guide", "explorer"] as const;

describe("AI role / role-context alignment", () => {
  it("maps each AI role to exactly one allowed role context", () => {
    expect(SOLMIND_AI_ROLE_REQUIRED_CONTEXT).toEqual({
      solmind_virtual_guide: "explorer",
      solmind_guide_assistant: "guide",
      internal_admin_ai: "admin",
    });
  });

  // Table of (aiRole, the one context it is allowed in).
  const allowedAlignments: ReadonlyArray<{
    aiRole: string;
    allowedContext: (typeof ROLE_CONTEXTS)[number];
  }> = [
    { aiRole: SOLMIND_AI_ROLES.VIRTUAL_GUIDE, allowedContext: "explorer" },
    { aiRole: SOLMIND_AI_ROLES.GUIDE_ASSISTANT, allowedContext: "guide" },
    { aiRole: SOLMIND_AI_ROLES.INTERNAL_ADMIN_AI, allowedContext: "admin" },
  ];

  for (const { aiRole, allowedContext } of allowedAlignments) {
    it(`allows ${aiRole} only in the ${allowedContext} context`, () => {
      for (const roleContext of ROLE_CONTEXTS) {
        expect(isAiRoleAllowedInContext(aiRole, roleContext)).toBe(
          roleContext === allowedContext,
        );
      }
    });
  }

  it("keeps the SolMind Virtual Guide Explorer-facing only", () => {
    expect(
      isAiRoleAllowedInContext(SOLMIND_AI_ROLES.VIRTUAL_GUIDE, "explorer"),
    ).toBe(true);
    expect(
      isAiRoleAllowedInContext(SOLMIND_AI_ROLES.VIRTUAL_GUIDE, "guide"),
    ).toBe(false);
    expect(
      isAiRoleAllowedInContext(SOLMIND_AI_ROLES.VIRTUAL_GUIDE, "admin"),
    ).toBe(false);
  });

  it("keeps the SolMind Guide Assistant Guide-facing only", () => {
    expect(
      isAiRoleAllowedInContext(SOLMIND_AI_ROLES.GUIDE_ASSISTANT, "guide"),
    ).toBe(true);
    expect(
      isAiRoleAllowedInContext(SOLMIND_AI_ROLES.GUIDE_ASSISTANT, "explorer"),
    ).toBe(false);
    expect(
      isAiRoleAllowedInContext(SOLMIND_AI_ROLES.GUIDE_ASSISTANT, "admin"),
    ).toBe(false);
  });

  it("keeps the internal Admin AI Admin-facing only", () => {
    expect(
      isAiRoleAllowedInContext(SOLMIND_AI_ROLES.INTERNAL_ADMIN_AI, "admin"),
    ).toBe(true);
    expect(
      isAiRoleAllowedInContext(SOLMIND_AI_ROLES.INTERNAL_ADMIN_AI, "guide"),
    ).toBe(false);
    expect(
      isAiRoleAllowedInContext(SOLMIND_AI_ROLES.INTERNAL_ADMIN_AI, "explorer"),
    ).toBe(false);
  });

  it("blocks an unknown AI role in every role context", () => {
    for (const roleContext of ROLE_CONTEXTS) {
      expect(isAiRoleAllowedInContext("unknown_ai", roleContext)).toBe(false);
    }
    expect(isAiRoleAllowedInContext("", "explorer")).toBe(false);
    // A human role string is not an AI role.
    expect(isAiRoleAllowedInContext("guide", "guide")).toBe(false);
  });

  it("blocks a known AI role in an unknown role context", () => {
    for (const aiRole of Object.values(SOLMIND_AI_ROLES)) {
      expect(isAiRoleAllowedInContext(aiRole, "unknown_context")).toBe(false);
      expect(isAiRoleAllowedInContext(aiRole, "")).toBe(false);
      expect(isAiRoleAllowedInContext(aiRole, "system")).toBe(false);
    }
  });

  it("exposes deny-by-default type guards", () => {
    expect(isSolMindAiRole("solmind_virtual_guide")).toBe(true);
    expect(isSolMindAiRole("internal_admin_ai")).toBe(true);
    expect(isSolMindAiRole("guide")).toBe(false);
    expect(isSolMindAiRole("")).toBe(false);

    expect(isSolMindRoleContext("explorer")).toBe(true);
    expect(isSolMindRoleContext("admin")).toBe(true);
    expect(isSolMindRoleContext("system")).toBe(false);
    expect(isSolMindRoleContext("")).toBe(false);
  });
});
