// SolMind MVP0 Supabase principal mapping (pure).
//
// Purpose:
//   - map a verified Supabase auth user into the existing SupabaseAuthenticatedUser
//     shape that serverAuthContext / authSource already consume;
//   - fix the canonical provider name for Supabase auth in one place.
//
// Architecture notes (MVP0):
//   - The Supabase auth.users.id is the stable, immutable provider subject id and
//     is the ONLY identity key used here. Email and phone are mutable metadata and
//     are never used as the key (a re-keyed account would be a takeover risk).
//   - This module is pure and dependency-free: no Supabase client, no env, no IO.
//     The verified user is established server-side before this mapping runs; this
//     function only reshapes it.
//   - A blank/whitespace-only id is rejected by returning null (deny-by-default,
//     consistent with the null-means-deny pattern in the adapter layer).

import { type SupabaseAuthenticatedUser } from "../auth";

// Canonical provider name for Supabase auth. Matches the data model spec
// (identity.auth_provider_identity.provider_name) and the adapter fixtures.
export const SUPABASE_PROVIDER_NAME = "supabase" as const;

// A minimal projection of a server-verified Supabase auth user. Only id is used
// as the identity key; email/phone are accepted but ignored on purpose.
export type VerifiedSupabaseAuthUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
};

// Map a verified Supabase auth user to the SupabaseAuthenticatedUser principal.
// providerUserId is the trimmed auth.users.id; email/phone are never used.
// Returns null for a blank/whitespace-only id.
export function toSupabaseAuthenticatedUser(
  user: VerifiedSupabaseAuthUser,
): SupabaseAuthenticatedUser | null {
  const providerUserId = user.id.trim();
  if (providerUserId.length === 0) {
    return null;
  }

  return {
    providerName: SUPABASE_PROVIDER_NAME,
    providerUserId,
  };
}
