import { describe, expect, it } from "vitest";

import {
  SUPABASE_PROVIDER_NAME,
  toSupabaseAuthenticatedUser,
} from "../principalMapping";

const AUTH_USER_ID = "11111111-1111-1111-1111-111111111111";
// The SolMind session UUID a request presented in its binding cookie (login step
// 6, sub-slice S6-4); the mapping passes it through and derives nothing from it.
const PRESENTED_SESSION_ID = "5e5510a0-0000-4000-8000-000000000b01";

describe("SUPABASE_PROVIDER_NAME", () => {
  it("is exactly the string supabase", () => {
    expect(SUPABASE_PROVIDER_NAME).toBe("supabase");
  });
});

describe("toSupabaseAuthenticatedUser", () => {
  it("maps the auth user id to providerName/providerUserId", () => {
    const result = toSupabaseAuthenticatedUser({ id: AUTH_USER_ID }, PRESENTED_SESSION_ID);

    expect(result).toEqual({
      providerName: "supabase",
      providerUserId: AUTH_USER_ID,
      presentedSessionId: PRESENTED_SESSION_ID,
    });
  });

  it("uses the id as the key and ignores email and phone", () => {
    const result = toSupabaseAuthenticatedUser(
      {
        id: AUTH_USER_ID,
        email: "person@example.com",
        phone: "+15551234567",
      },
      PRESENTED_SESSION_ID,
    );

    // The key is the id only; email/phone never appear in the principal.
    expect(result).toEqual({
      providerName: "supabase",
      providerUserId: AUTH_USER_ID,
      presentedSessionId: PRESENTED_SESSION_ID,
    });
    expect(result).not.toBeNull();
    if (result !== null) {
      expect(Object.keys(result).sort()).toEqual([
        "presentedSessionId",
        "providerName",
        "providerUserId",
      ]);
    }
  });

  it("maps to the same principal regardless of differing email/phone for the same id", () => {
    const a = toSupabaseAuthenticatedUser(
      {
        id: AUTH_USER_ID,
        email: "old@example.com",
      },
      PRESENTED_SESSION_ID,
    );
    const b = toSupabaseAuthenticatedUser(
      {
        id: AUTH_USER_ID,
        email: "new@example.com",
        phone: "+15559999999",
      },
      PRESENTED_SESSION_ID,
    );

    expect(a).toEqual(b);
  });

  it("trims surrounding whitespace on the id", () => {
    const result = toSupabaseAuthenticatedUser(
      { id: `  ${AUTH_USER_ID}  ` },
      PRESENTED_SESSION_ID,
    );

    expect(result).toEqual({
      providerName: "supabase",
      providerUserId: AUTH_USER_ID,
      presentedSessionId: PRESENTED_SESSION_ID,
    });
  });

  it("returns null for an empty id", () => {
    expect(toSupabaseAuthenticatedUser({ id: "" }, PRESENTED_SESSION_ID)).toBeNull();
  });

  it("returns null for a whitespace-only id", () => {
    expect(toSupabaseAuthenticatedUser({ id: "   " }, PRESENTED_SESSION_ID)).toBeNull();
  });

  it("PRQ-201 passes the presented session UUID through unchanged, including none, and never derives it from the user", () => {
    for (const presented of [PRESENTED_SESSION_ID, null, "", `  ${PRESENTED_SESSION_ID}  `]) {
      expect(toSupabaseAuthenticatedUser({ id: AUTH_USER_ID }, presented)).toEqual({
        providerName: "supabase",
        providerUserId: AUTH_USER_ID,
        presentedSessionId: presented,
      });
    }
    // The Supabase user's own id is never taken as the presented session.
    expect(
      toSupabaseAuthenticatedUser({ id: AUTH_USER_ID }, null)?.presentedSessionId,
    ).toBeNull();
  });
});
