import "server-only";

import { createClient } from "@supabase/supabase-js";

import { readSupabaseServiceRoleEnv } from "./serverEnv";

// Login step 6, sub-slice S6-8: the one client the Explorer exchange's link
// seam uses.
//
// Source of truth: solmind-docs
// `execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md`
// (contract 21) Section 7.9 (AUTH-RLS-DEC-035): after its own trust decision
// the server "calls server-only `admin.generateLink({ type: 'magiclink' })`",
// and the internal token "is never sent, stored, logged, accepted from a
// client, or treated as a user verification factor".
//
// Why it exists. The banked sign-in bridge (sub-slice S6-7) records a
// required precondition for whatever client serves its link seam: that
// client must reach Supabase Auth through a fetch boundary that never
// rejects and never logs, because the installed auth library itself prints a
// rejected fetch's error, in time or after the bridge's deadline, where the
// bridge cannot prevent it. The banked service-role client factory takes no
// argument, so it cannot be given such a boundary; this module builds one
// more service-role client that has it.
//
// DECIDED by Paul on 2026-10-07 (morning check-in packet, item 7, option 1):
// "a second, separate module used only for that one link request, exposing
// nothing else. The five existing users stay on the path they were tested
// on." Record:
// `solmind-sprints/PRJ01-SPR001/Decision_Queue/Current_Action_Queue.md`,
// "The 2026-10-07 check-in: answered (first seen by the 11:30:10 clock
// read)". This is that module: the second one that builds a client with the
// key that bypasses row-level security.
//
// What it builds. One Supabase client with the server-only service-role key
// (read through the banked server environment reader, when the factory is
// called and never when the module loads), with sessions neither persisted
// nor refreshed, and with every request sent through the boundary below.
//
// The boundary. It hands its two arguments to the global `fetch` unchanged
// (the global is read at call time) and returns that answer; if the call
// throws or rejects, the error is dropped unread and the answer is one fixed
// 503 with no body, which the library reports as an error without printing
// anything. It logs nothing. At the installed library version (auth-js
// 2.108.2) the library prints a rejected fetch's error, and a body that
// fails while it is read becomes an error object with no print; the tests
// show nothing printed for either behind this boundary. The library's error
// object can quote the failure's own message, so a caller reads only whether
// the answer has an error and never prints or returns that object; the
// bridge does exactly that.
// The boundary adds no deadline: the bridge races the link seam against its
// own deadline and has no abort for it, so a link request can outlive that
// deadline. The bridge then drops the late answer; a link token Supabase
// made for it stays valid at Supabase until it expires.
//
// What it hands out: a frozen object with one method, `generateLink`, and
// nothing else of the client. The method calls the library's own
// `auth.admin.generateLink` on the library's own object, so the library's
// `this` is kept whatever the caller applies the method to. No other Auth
// admin call (creating, listing, updating or deleting a user) and no
// database call is reachable through it.
//
// The factory throws one fixed, value-free error when the environment is
// missing or the client cannot be built; the underlying error is dropped
// unread. Nothing here logs.
//
// Called by login step 6's Explorer sign-in routes (S6-8), through their
// request-scoped dependency factory. Keep it server-only, direct-import only
// and off every barrel.

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: the login link client must not be imported in browser code.",
  );
}

// The link seam's own structural shape: the one call the Explorer exchange
// makes. The type check where this object is handed over keeps it equal to
// the shape the exchange expects.
export type LoginLinkAdminSeam = Readonly<{
  generateLink(params: Readonly<{ type: "magiclink"; email: string }>): Promise<unknown>;
}>;

export const LOGIN_LINK_ADMIN_CLIENT_UNAVAILABLE =
  "SolMind server configuration error: the login link client is unavailable." as const;

// The answer the boundary gives for every failed request: one fixed 503 with
// no body.
function boundaryFailure(): Response {
  return new Response(null, { status: 503 });
}

// The non-rejecting, non-logging fetch boundary. The error is dropped unread.
async function sendWithoutRejecting(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    return boundaryFailure();
  }
}

// Builds the link seam. Throws the one fixed error above on any failure.
export function createLoginLinkAdminClient(): LoginLinkAdminSeam {
  try {
    const { supabaseUrl, serviceRoleKey } = readSupabaseServiceRoleEnv();
    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: { fetch: sendWithoutRejecting },
    });
    const admin = client.auth.admin;
    const seam: LoginLinkAdminSeam = {
      // Called on the library's own object, never handed out bare.
      generateLink: (params) => admin.generateLink(params),
    };
    return Object.freeze(seam);
  } catch {
    throw new Error(LOGIN_LINK_ADMIN_CLIENT_UNAVAILABLE);
  }
}
