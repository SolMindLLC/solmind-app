// SolMind MVP0 server-only request-auth adapter (@supabase/ssr lives ONLY here).
//
// Purpose:
//   - prove request IDENTITY only: build a request-scoped Supabase auth client
//     from @supabase/ssr, verify the session server-side via getUser(), and
//     return the existing SupabaseAuthenticatedUser principal, or null.
//
// Architecture notes (MVP0):
//   - This is the single seam where @supabase/ssr, cookies, and headers coupling
//     enter the codebase (AUTH-RLS-DEC-012, AUTH-RLS-DEC-013). It stays OFF the
//     shared src/lib/solmind/supabase/index.ts barrel, mirroring serviceRoleClient,
//     and carries a runtime browser guard. Import it only from explicit server
//     composition paths.
//   - It resolves IDENTITY only (who). It loads NO SolMind records and creates or
//     supersedes NO user_session; record loading stays on the separate service-role
//     query-client path (AUTH-RLS-DEC-015). Identity and record loading are not
//     merged.
//   - It uses getUser() (not getSession()), which re-verifies with the Supabase
//     auth server rather than trusting a decoded cookie.
//   - Fail closed (AUTH-RLS-DEC-016): a getUser error, a missing/blank user id, an
//     unexpected shape, or any thrown/rejected call resolves to null. The
//     fail-closed wrapper swallows errors (not logged, not propagated) so no token,
//     cookie, or secret leaks through an error path.
//   - It reads ONLY the public-but-safe request-auth config
//     (NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY); it never reads
//     SUPABASE_SERVICE_ROLE_KEY (AUTH-RLS-DEC-020, AUTH-RLS-DEC-021).
//   - It does NOT import next/headers, cookies(), headers(), NextRequest, or
//     NextResponse. The composition root builds the RequestCookieAccessor and
//     injects it (AUTH-RLS-DEC-019).
//   - Cookie writes are a deliberate no-op for MVP0 (AUTH-RLS-DEC-018); the
//     accessor setAll is passed through to @supabase/ssr but persists nothing
//     (cookie write/refresh persistence is deferred, AUTH-RLS-DEF-015).

import { createServerClient } from "@supabase/ssr";

import {
  createFailClosedRequestAuthPrincipalSource,
  type SolMindRequestAuthPrincipalSource,
} from "../auth/requestAuthPrincipalSource";
import { type RequestCookieAccessor } from "../auth/requestCookieAccessor";
import { toSupabaseAuthenticatedUser } from "./principalMapping";

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: requestAuthClient must not be imported in browser code.",
  );
}

// Public-but-safe request-auth configuration variable names (AUTH-RLS-DEC-020,
// AUTH-RLS-DEC-021). The service-role key is never read here. Exported so tests can
// assert the exact public names without hard-coding string literals.
export const REQUEST_AUTH_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL" as const;
export const REQUEST_AUTH_ANON_KEY_ENV = "NEXT_PUBLIC_SUPABASE_ANON_KEY" as const;

type RequestAuthEnv = { supabaseUrl: string; anonKey: string };

// Read the public request-auth config. Throws a clear, value-free, server-only
// configuration error (naming the variable, never its value) when missing or blank,
// so a misconfigured deployment fails loudly server-side instead of silently denying
// every user. Mirrors the serverEnv.ts posture.
function readRequestAuthEnv(): RequestAuthEnv {
  const supabaseUrl = process.env[REQUEST_AUTH_URL_ENV];
  const anonKey = process.env[REQUEST_AUTH_ANON_KEY_ENV];
  if (supabaseUrl === undefined || supabaseUrl.trim().length === 0) {
    throw new Error(
      `SolMind server configuration error: required public environment variable ${REQUEST_AUTH_URL_ENV} is missing or blank.`,
    );
  }
  if (anonKey === undefined || anonKey.trim().length === 0) {
    throw new Error(
      `SolMind server configuration error: required public environment variable ${REQUEST_AUTH_ANON_KEY_ENV} is missing or blank.`,
    );
  }
  return { supabaseUrl, anonKey };
}

// Build a request-scoped Supabase request-auth principal source.
//   - cookies: the injected RequestCookieAccessor built at the composition root.
//
// Config is validated eagerly at construction (throws server-side on misconfig).
// Per-request verification is wrapped in the banked fail-closed posture, so any
// getUser error, missing/blank user, unexpected shape, or thrown/rejected call
// resolves to null rather than throwing to the caller.
export function createSupabaseRequestAuthPrincipalSource(args: {
  cookies: RequestCookieAccessor;
}): SolMindRequestAuthPrincipalSource {
  const { cookies } = args;
  const { supabaseUrl, anonKey } = readRequestAuthEnv();

  return createFailClosedRequestAuthPrincipalSource(async () => {
    const client = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll: () => cookies.getAll(),
        // Pass writes straight to the accessor. MVP0's accessor setAll is a no-op
        // (AUTH-RLS-DEC-018), so nothing is persisted; the second `headers`
        // argument @supabase/ssr would supply is intentionally ignored. options is
        // the framework cookie-options bag, treated here as the opaque record the
        // accessor's write contract documents (AUTH-RLS-DEF-015).
        setAll: (cookiesToSet) =>
          cookies.setAll(
            cookiesToSet.map((cookie) => ({
              name: cookie.name,
              value: cookie.value,
              options: cookie.options as Readonly<Record<string, unknown>>,
            })),
          ),
      },
    });

    const { data, error } = await client.auth.getUser();
    if (error) {
      return null;
    }
    const user = data?.user ?? null;
    if (user === null) {
      return null;
    }
    // toSupabaseAuthenticatedUser fixes providerName = "supabase", uses the trimmed
    // auth.users.id as providerUserId, and returns null for a blank id. email/phone
    // are ignored on purpose.
    return toSupabaseAuthenticatedUser({
      id: user.id,
      email: user.email,
      phone: user.phone,
    });
  });
}
