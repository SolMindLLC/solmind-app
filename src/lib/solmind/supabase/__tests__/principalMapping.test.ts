import { describe, expect, it } from "vitest";

import {
  SUPABASE_PROVIDER_NAME,
  toSupabaseAuthenticatedUser,
} from "../principalMapping";

const AUTH_USER_ID = "11111111-1111-1111-1111-111111111111";

describe("SUPABASE_PROVIDER_NAME", () => {
  it("is exactly the string supabase", () => {
    expect(SUPABASE_PROVIDER_NAME).toBe("supabase");
  });
});

describe("toSupabaseAuthenticatedUser", () => {
  it("maps the auth user id to providerName/providerUserId", () => {
    const result = toSupabaseAuthenticatedUser({ id: AUTH_USER_ID });

    expect(result).toEqual({
      providerName: "supabase",
      providerUserId: AUTH_USER_ID,
    });
  });

  it("uses the id as the key and ignores email and phone", () => {
    const result = toSupabaseAuthenticatedUser({
      id: AUTH_USER_ID,
      email: "person@example.com",
      phone: "+15551234567",
    });

    // The key is the id only; email/phone never appear in the principal.
    expect(result).toEqual({
      providerName: "supabase",
      providerUserId: AUTH_USER_ID,
    });
    expect(result).not.toBeNull();
    if (result !== null) {
      expect(Object.keys(result).sort()).toEqual([
        "providerName",
        "providerUserId",
      ]);
    }
  });

  it("maps to the same principal regardless of differing email/phone for the same id", () => {
    const a = toSupabaseAuthenticatedUser({
      id: AUTH_USER_ID,
      email: "old@example.com",
    });
    const b = toSupabaseAuthenticatedUser({
      id: AUTH_USER_ID,
      email: "new@example.com",
      phone: "+15559999999",
    });

    expect(a).toEqual(b);
  });

  it("trims surrounding whitespace on the id", () => {
    const result = toSupabaseAuthenticatedUser({ id: `  ${AUTH_USER_ID}  ` });

    expect(result).toEqual({
      providerName: "supabase",
      providerUserId: AUTH_USER_ID,
    });
  });

  it("returns null for an empty id", () => {
    expect(toSupabaseAuthenticatedUser({ id: "" })).toBeNull();
  });

  it("returns null for a whitespace-only id", () => {
    expect(toSupabaseAuthenticatedUser({ id: "   " })).toBeNull();
  });
});
