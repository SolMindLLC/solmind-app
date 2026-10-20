// SolMind MVP0 server-only request-auth adapter (the per-request Supabase Auth check).
//
// Purpose:
//   - prove request IDENTITY only: take the sign-in token out of the request's
//     auth cookie once the shared format check has accepted that cookie, ask
//     Supabase Auth to verify that one token (getUser(token)) through a
//     request-scoped client that is given no cookie, and return the existing
//     SupabaseAuthenticatedUser principal, or null;
//   - read, from the same request, the SolMind session UUID it presents in its
//     session-binding cookie, and hand it on with the principal. This module
//     compares nothing: derivation compares that UUID with the selected
//     session's (login step 6, sub-slice S6-4; solmind-docs
//     `execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`
//     (contract 25) Section 8).
//
// Architecture notes (MVP0):
//   - This module, and the dormant login identity bridge beside it (login step
//     6, S6-7), sit in the request-auth adapter layer where cookies and headers
//     coupling enter the codebase (AUTH-RLS-DEC-012). The bridge is where
//     @supabase/ssr is used (AUTH-RLS-DEC-013); this module no longer imports
//     that package. It builds its client with createClient from
//     @supabase/supabase-js and the public anon key. It stays OFF the
//     shared src/lib/solmind/supabase/index.ts barrel, mirroring serviceRoleClient,
//     and carries an import-time `server-only` guard plus a runtime browser guard
//     (AUTH-RLS-DEC-023). Import it only from explicit server composition paths.
//   - It resolves IDENTITY only (who). It loads NO SolMind records and creates or
//     supersedes NO user_session; record loading stays on the separate service-role
//     query-client path (AUTH-RLS-DEC-015). Identity and record loading are not
//     merged.
//   - It uses getUser(token) (not getSession(), and not getUser() with no
//     argument), which asks the Supabase auth server about that one token
//     rather than trusting what a decoded cookie says.
//   - Fail closed (AUTH-RLS-DEC-016): a getUser error, a missing/blank user id, an
//     unexpected shape, or any thrown/rejected call resolves to null. The
//     fail-closed wrapper swallows errors (not logged, not propagated) so no token,
//     cookie, or secret leaks through an error path.
//   - It reads the public-but-safe request-auth config
//     (NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY) and, for the
//     cookie names only, the server-configured trusted application origin; it
//     never reads SUPABASE_SERVICE_ROLE_KEY (AUTH-RLS-DEC-020, AUTH-RLS-DEC-021).
//   - It does NOT import next/headers, cookies(), headers(), NextRequest, or
//     NextResponse. The composition root builds the RequestCookieAccessor and
//     injects it (AUTH-RLS-DEC-019).
//   - It writes no cookie (AUTH-RLS-DEC-018; cookie write/refresh persistence
//     is deferred, AUTH-RLS-DEF-015). It reads the injected accessor's
//     getAll() once and never calls its setAll, and the client it builds has
//     no cookie setter at all. This module never writes, refreshes, or clears
//     a cookie.
//
// The session cookies (contract 25 Sections 5.2, 7, 8, 14 and 19;
// AUTH-RLS-DEC-043 and AUTH-RLS-DEC-044):
//   - The shared name. The cookie names come from the one session-cookie
//     policy, resolved from the trusted application origin, as the login-step
//     cookie writer's composition root will resolve it when the sign-in routes
//     are built (S6-8), so the writer, this adapter and logout read one name.
//   - The format check comes first. Before any Supabase client exists, the
//     request's cookies are read once and the policy's one shared format
//     check judges the auth cookie. A malformed or absent auth cookie resolves
//     to null: no client is built and nothing is asked of Supabase Auth.
//   - The format check ends with the field check. The library builds its
//     request to Supabase Auth from the token text it is given, and when the
//     platform refuses that request (a token holding a line break, for
//     example) the library itself prints the platform's error, which can quote
//     that text, before the fail-closed wrapper here sees anything. So the
//     shared check opens the cookie and refuses it unless the session inside
//     has the form sign-in gives it: the token three parts of letters,
//     digits, `-` and `_` joined by dots, the renewal token a non-empty
//     string, the expiry a positive whole number, and the profile absent,
//     null or an object. Only a token of that form is handed to the library.
//     This module adds no guard on the library's requests: contract 25
//     Section 19 lists this module's step 6 changes, and such a guard is not
//     among them.
//   - The binding cookie. The request must carry exactly one session-binding
//     cookie holding a lowercase canonical UUID. None, more than one, or any
//     other value resolves to null before Supabase Auth is asked, because
//     such a request cannot be allowed. Otherwise the UUID travels on the
//     principal as presentedSessionId. It is a session UUID: it is never
//     logged, thrown, or put in an error here.
//   - Token-only verification (contract 25 Sections 7 and 8). The shared
//     module hands over the accepted cookie's sign-in token and nothing else
//     of it (readSessionAuthCookieAccessToken). The client is built with
//     persistSession false, autoRefreshToken false, detectSessionInUrl false
//     and skipAutoInitialize true, and it is given no cookie reader, no
//     cookie setter and no storage. Its only session store is the empty
//     in-memory one the library makes for itself, and nothing here puts a
//     session into it. The one call made on the client is getUser(token),
//     which in the installed library (auth-js 2.108.2) sends GET /user with
//     that token as the bearer. The library asks Supabase Auth for a renewal
//     only for a session it has loaded from its store or has been handed,
//     with that session's renewal token; this client is given neither, so the
//     cookie's renewal token and expiry never reach it. This module reads no
//     clock, so the time that passes between the check and the call changes
//     nothing about what is sent. Whether the token is still good is Supabase
//     Auth's answer, not this module's: when Supabase Auth refuses a token,
//     the library returns that error without printing it, and the request is
//     denied.
//   - What is left. The library still prints the platform's error when its
//     one request to Supabase Auth cannot be made at all (Supabase Auth
//     unreachable); that line is the platform's own error, to which the
//     library adds nothing; in the tests, with a stand-in that fails as a
//     refused connection does, it held no cookie text. The request is tried
//     once, and it is denied. The library's request code sets no time limit
//     on that request.

import "server-only";

import { createClient } from "@supabase/supabase-js";

import {
  createFailClosedRequestAuthPrincipalSource,
  type SolMindRequestAuthPrincipalSource,
} from "../auth/requestAuthPrincipalSource";
import { type RequestCookieAccessor } from "../auth/requestCookieAccessor";
import {
  readSessionAuthCookieAccessToken,
  readSessionCookieEntries,
  resolveSessionCookiePolicy,
  type SessionCookieEntry,
  type SessionCookiePolicy,
} from "../auth/sessionCookiePolicy";
import { loadTrustedApplicationOrigin } from "../auth/trustedApplicationOrigin";
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

// The one fixed, value-free error for a session-cookie policy that cannot be
// resolved: the trusted application origin is missing or malformed, or it is a
// plain-http origin that is not a loopback address (contract 25 Section 4: a
// configuration failure). It names no variable value and no origin.
export const REQUEST_AUTH_SESSION_COOKIE_POLICY_UNAVAILABLE =
  "SolMind server configuration error: the session cookie policy is unavailable." as const;

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

// Resolve the session-cookie policy (the cookie names) from the trusted
// application origin, with the banked loader and the banked policy. Any failure
// throws the one fixed error above; the loader's own error is dropped.
function resolveRequestSessionCookiePolicy(): SessionCookiePolicy {
  let policy: SessionCookiePolicy | null = null;
  try {
    policy = resolveSessionCookiePolicy(loadTrustedApplicationOrigin());
  } catch {
    policy = null;
  }
  if (policy === null) {
    throw new Error(REQUEST_AUTH_SESSION_COOKIE_POLICY_UNAVAILABLE);
  }
  return policy;
}

// A SolMind session UUID exactly as the database prints one and the login-step
// cookie writer writes it: lowercase, 8-4-4-4-12. No `m` flag, so `$` matches
// only at the very end and a final line terminator is refused.
const SESSION_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// The session UUID the request presents in its session-binding cookie, or null.
// Exactly one cookie of that name must be present, and its value must be a
// lowercase canonical UUID; a repeated name is ambiguous and counts as none.
// Nothing here keeps, logs, or returns any part of a refused value.
function readPresentedSessionId(
  policy: SessionCookiePolicy,
  requestCookies: ReadonlyArray<SessionCookieEntry>,
): string | null {
  const presented = requestCookies.filter(
    (cookie) => cookie.name === policy.bindingCookieName,
  );
  if (presented.length !== 1) {
    return null;
  }
  const value = presented[0].value;
  return SESSION_UUID_PATTERN.test(value) ? value : null;
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
  const policy = resolveRequestSessionCookiePolicy();

  return createFailClosedRequestAuthPrincipalSource(async () => {
    // One frozen snapshot of the request's cookies, read through own data
    // properties only. Everything below judges this snapshot.
    const requestCookies = readSessionCookieEntries(cookies.getAll(), false);
    if (requestCookies === null) {
      return null;
    }

    // Contract 25 Section 14: the one shared format check, before any Supabase
    // client exists. The policy's helper judges the request's auth cookie with
    // that check and hands over the accepted cookie's sign-in token, or null.
    // A malformed auth cookie is treated as absent, and an absent one cannot
    // be verified, so both deny here.
    const accessToken = readSessionAuthCookieAccessToken(policy, requestCookies);
    if (accessToken === null) {
      return null;
    }

    // Contract 25 Section 8: what the request presents as its SolMind session.
    // Without it the request cannot be allowed, so it denies before Supabase
    // Auth is asked.
    const presentedSessionId = readPresentedSessionId(policy, requestCookies);
    if (presentedSessionId === null) {
      return null;
    }

    // Contract 25 Sections 7 and 8: a client that holds nothing of the
    // request. No cookie reader, no cookie setter and no storage are given.
    // With persistSession false the library keeps its own empty in-memory
    // store. With skipAutoInitialize true it runs no initialization when the
    // client is built; the one session load it starts for its own listener
    // finds that empty store. autoRefreshToken false and detectSessionInUrl
    // false switch off the renewal timer and the reading of a session from a
    // URL, which only initialization would start.
    const client = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        skipAutoInitialize: true,
      },
    });

    // Ask Supabase Auth about that one token. With a token argument the
    // library sends GET /user with the token as the bearer; it does not load
    // a stored session for that call, and this client has none to renew.
    const { data, error } = await client.auth.getUser(accessToken);
    if (error) {
      return null;
    }
    const user = data?.user ?? null;
    if (user === null) {
      return null;
    }
    // toSupabaseAuthenticatedUser fixes providerName = "supabase", uses the trimmed
    // auth.users.id as providerUserId, and returns null for a blank id. email/phone
    // are ignored on purpose. The presented session UUID is passed through.
    return toSupabaseAuthenticatedUser(
      {
        id: user.id,
        email: user.email,
        phone: user.phone,
      },
      presentedSessionId,
    );
  });
}
