// SolMind MVP0 B-4 PostgREST-transport-level integration probes (opt-in, local stack only).
//
// This is the companion to the pgTAP suite (supabase/tests/admin_access_rpc_*_test.sql). It
// covers exactly the execution/19_SolMind_MVP0_Auth_RLS_RPC_Function_Contract_v0_1.md Section 13
// cases that are PostgREST behaviors, which pgTAP cannot reach:
//   - anon .rpc() to every enumerated function is DENIED with an error and no rows, and does
//     not throw a 500 (the supabase-js client surfaces a PostgREST 4xx as { data:null, error });
//   - the functions are ABSENT from the anon OpenAPI surface (PostgREST root);
//   - anon cannot read the identity/core tables directly (schemas off the Data API);
//   - service_role .rpc() REACHES the functions and returns an empty array (error null) on
//     empty tables.
// The DB-level authenticated/anon EXECUTE denial, seeded real-path rows, column contract, and
// pg_catalog hygiene are proven in the pgTAP suite. The app decision (allow given the chain,
// deny on missing/expired/ambiguous/non-admin) is proven in the mock route real-path test
// (src/app/admin/access/__tests__/route.realpath.test.ts).
//
// SKIPPED BY DEFAULT: this suite only runs when a LOCAL Supabase stack is configured via the
// SOLMIND_LOCAL_SUPABASE_* env vars below. Default `npm test` / `npm run build` never connect
// to a database. Point it at a LOCAL `supabase start` stack only; never a cloud project.
//   SOLMIND_LOCAL_SUPABASE_URL               e.g. http://127.0.0.1:54321
//   SOLMIND_LOCAL_SUPABASE_ANON_KEY          the local anon key
//   SOLMIND_LOCAL_SUPABASE_SERVICE_ROLE_KEY  the local service-role key (kept out of the client bundle)

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const LOCAL_URL = process.env.SOLMIND_LOCAL_SUPABASE_URL;
const LOCAL_ANON_KEY = process.env.SOLMIND_LOCAL_SUPABASE_ANON_KEY;
const LOCAL_SERVICE_ROLE_KEY = process.env.SOLMIND_LOCAL_SUPABASE_SERVICE_ROLE_KEY;

const HAS_LOCAL_STACK = Boolean(
  LOCAL_URL && LOCAL_ANON_KEY && LOCAL_SERVICE_ROLE_KEY,
);

// An obviously-synthetic id; anon denial happens before execution, so the value is irrelevant.
const ABSENT_ID = "00000000-0000-0000-0000-000000000000";

// Each enumerated function paired with a well-formed named-argument object.
const RPC_CALLS: ReadonlyArray<{ fn: string; args: Record<string, string> }> = [
  {
    fn: "solmind_find_auth_provider_identity",
    args: { p_provider_name: "supabase", p_provider_user_id: "b4-probe" },
  },
  { fn: "solmind_find_user_account", args: { p_user_account_id: ABSENT_ID } },
  { fn: "solmind_find_active_user_sessions", args: { p_user_account_id: ABSENT_ID } },
  {
    fn: "solmind_find_active_role_assignment",
    args: { p_user_account_id: ABSENT_ID, p_role_code: "admin" },
  },
  { fn: "solmind_find_guide_profile", args: { p_user_account_id: ABSENT_ID } },
  { fn: "solmind_find_explorer_profile", args: { p_user_account_id: ABSENT_ID } },
];

describe.skipIf(!HAS_LOCAL_STACK)(
  "B-4 /admin/access RPC transport (local stack, PostgREST level)",
  () => {
    let anon: SupabaseClient;
    let serviceRole: SupabaseClient;

    beforeAll(() => {
      // Constructed lazily so a default (skipped) run never builds a client or reads a key.
      anon = createClient(LOCAL_URL as string, LOCAL_ANON_KEY as string, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      serviceRole = createClient(
        LOCAL_URL as string,
        LOCAL_SERVICE_ROLE_KEY as string,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
    });

    afterAll(async () => {
      await anon?.auth.signOut().catch(() => undefined);
      await serviceRole?.auth.signOut().catch(() => undefined);
    });

    it("denies every enumerated function to anon with an error and no rows (no thrown 500)", async () => {
      for (const call of RPC_CALLS) {
        // A denied .rpc surfaces as a resolved { data: null, error } (a PostgREST 4xx), never a
        // thrown exception and never a 500. anon has no EXECUTE and the function is not exposed.
        const { data, error } = await anon.rpc(call.fn, call.args);
        expect(error, `${call.fn} must be denied for anon`).not.toBeNull();
        expect(data ?? null).toBeNull();
      }
    });

    it("does not list any enumerated function in the anon OpenAPI surface", async () => {
      const response = await fetch(`${LOCAL_URL}/rest/v1/`, {
        headers: {
          apikey: LOCAL_ANON_KEY as string,
          Authorization: `Bearer ${LOCAL_ANON_KEY}`,
        },
      });
      const body = await response.text();
      for (const call of RPC_CALLS) {
        expect(body, `${call.fn} must be absent from the anon OpenAPI surface`).not.toContain(
          call.fn,
        );
      }
    });

    it("blocks anon from reading the identity/core tables directly", async () => {
      const identityProbe = await anon
        .schema("identity")
        .from("user_account")
        .select("user_account_id")
        .limit(1);
      expect(identityProbe.error).not.toBeNull();

      const coreProbe = await anon
        .schema("core")
        .from("guide_profile")
        .select("guide_profile_id")
        .limit(1);
      expect(coreProbe.error).not.toBeNull();
    });

    it("lets service_role reach a function and returns an empty array (error null) on an absent id", async () => {
      const { data, error } = await serviceRole.rpc("solmind_find_user_account", {
        p_user_account_id: ABSENT_ID,
      });
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });
  },
);
