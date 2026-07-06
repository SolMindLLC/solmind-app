-- SolMind MVP0 B-4 pgTAP: enumerated Admin/auth RPC contract, hygiene, and negative security.
-- Source contract: execution/19_SolMind_MVP0_Auth_RLS_RPC_Function_Contract_v0_1.md (Section 13).
-- Banked decision: AUTH-RLS-DEC-026.
-- Run with: supabase test db  (local stack only; never cloud).
--
-- Scope of THIS file (no fixtures required):
--   - column contract: each of the six public.solmind_find_* functions returns ONLY its
--     contracted columns and no excluded column (checked via pg_get_function_result, so it
--     needs no seeded rows and cannot leak a private column);
--   - pg_catalog hygiene: every function is SECURITY DEFINER, has an empty search_path, and
--     grants EXECUTE to service_role only (anon/authenticated denied);
--   - schema isolation: anon and authenticated hold no direct SELECT on the identity/core
--     tables the functions read (identity/core stay off the Data API);
--   - service_role reachability shape: a lookup on an absent id returns an empty set, not an error.
--
-- This file creates nothing permanent: it runs inside a transaction that ROLLS BACK, seeds no
-- real or pilot data, adds no migration, no function, no policy, and no grant. The PostgREST
-- transport-level assertions (anon/authenticated .rpc() denied with no 500; functions absent
-- from the anon OpenAPI surface) live in the supabase-js companion, since pgTAP cannot reach
-- PostgREST; see src/lib/solmind/supabase/__tests__/adminAccessRealPath.integration.test.ts.

begin;

select plan(20);

-- --- Column contract: only the contracted columns, never an excluded one --------------------

select ok(
  pg_get_function_result('public.solmind_find_auth_provider_identity(text,text)'::regprocedure)
    like '%provider_user_id text%',
  'auth_provider_identity result includes provider_user_id'
);
select ok(
  pg_get_function_result('public.solmind_find_auth_provider_identity(text,text)'::regprocedure)
    not like '%provider_email%',
  'auth_provider_identity result excludes provider_email'
);

select ok(
  pg_get_function_result('public.solmind_find_user_account(uuid)'::regprocedure)
    like '%account_status text%',
  'user_account result includes account_status'
);
select ok(
  pg_get_function_result('public.solmind_find_user_account(uuid)'::regprocedure)
    not like '%display_name%',
  'user_account result excludes display_name'
);

select ok(
  pg_get_function_result('public.solmind_find_active_user_sessions(uuid)'::regprocedure)
    like '%active_role_context text%',
  'active_user_sessions result includes active_role_context'
);
select ok(
  pg_get_function_result('public.solmind_find_active_user_sessions(uuid)'::regprocedure)
    not like '%last_activity_at%',
  'active_user_sessions result excludes last_activity_at'
);

select ok(
  pg_get_function_result('public.solmind_find_active_role_assignment(uuid,text)'::regprocedure)
    like '%role_status text%',
  'active_role_assignment result includes role_status'
);
select ok(
  pg_get_function_result('public.solmind_find_active_role_assignment(uuid,text)'::regprocedure)
    not like '%granted_by%',
  'active_role_assignment result excludes granted_by columns'
);

select ok(
  pg_get_function_result('public.solmind_find_guide_profile(uuid)'::regprocedure)
    like '%guide_profile_id uuid%',
  'guide_profile result includes guide_profile_id'
);
select ok(
  pg_get_function_result('public.solmind_find_guide_profile(uuid)'::regprocedure)
    not like '%created_at%',
  'guide_profile result excludes created_at'
);

select ok(
  pg_get_function_result('public.solmind_find_explorer_profile(uuid)'::regprocedure)
    like '%explorer_profile_id uuid%',
  'explorer_profile result includes explorer_profile_id'
);
select ok(
  pg_get_function_result('public.solmind_find_explorer_profile(uuid)'::regprocedure)
    not like '%created_at%',
  'explorer_profile result excludes created_at'
);

-- --- pg_catalog hygiene across all six functions --------------------------------------------
-- The six enumerated functions, referenced by their exact signatures.

select ok(
  (select bool_and(prosecdef)
     from pg_proc
    where oid in (
      'public.solmind_find_auth_provider_identity(text,text)'::regprocedure,
      'public.solmind_find_user_account(uuid)'::regprocedure,
      'public.solmind_find_active_user_sessions(uuid)'::regprocedure,
      'public.solmind_find_active_role_assignment(uuid,text)'::regprocedure,
      'public.solmind_find_guide_profile(uuid)'::regprocedure,
      'public.solmind_find_explorer_profile(uuid)'::regprocedure
    )),
  'all six functions are SECURITY DEFINER'
);

select ok(
  (select bool_and(
            exists (select 1 from unnest(coalesce(proconfig, array[]::text[])) as c
                     where c = 'search_path=""'))
     from pg_proc
    where oid in (
      'public.solmind_find_auth_provider_identity(text,text)'::regprocedure,
      'public.solmind_find_user_account(uuid)'::regprocedure,
      'public.solmind_find_active_user_sessions(uuid)'::regprocedure,
      'public.solmind_find_active_role_assignment(uuid,text)'::regprocedure,
      'public.solmind_find_guide_profile(uuid)'::regprocedure,
      'public.solmind_find_explorer_profile(uuid)'::regprocedure
    )),
  'all six functions pin an empty search_path'
);

select ok(
  (select bool_and(has_function_privilege('service_role', oid, 'EXECUTE'))
     from pg_proc
    where oid in (
      'public.solmind_find_auth_provider_identity(text,text)'::regprocedure,
      'public.solmind_find_user_account(uuid)'::regprocedure,
      'public.solmind_find_active_user_sessions(uuid)'::regprocedure,
      'public.solmind_find_active_role_assignment(uuid,text)'::regprocedure,
      'public.solmind_find_guide_profile(uuid)'::regprocedure,
      'public.solmind_find_explorer_profile(uuid)'::regprocedure
    )),
  'service_role can EXECUTE all six functions'
);

select ok(
  (select bool_or(has_function_privilege('anon', oid, 'EXECUTE'))
     from pg_proc
    where oid in (
      'public.solmind_find_auth_provider_identity(text,text)'::regprocedure,
      'public.solmind_find_user_account(uuid)'::regprocedure,
      'public.solmind_find_active_user_sessions(uuid)'::regprocedure,
      'public.solmind_find_active_role_assignment(uuid,text)'::regprocedure,
      'public.solmind_find_guide_profile(uuid)'::regprocedure,
      'public.solmind_find_explorer_profile(uuid)'::regprocedure
    )) is not true,
  'anon cannot EXECUTE any of the six functions'
);

select ok(
  (select bool_or(has_function_privilege('authenticated', oid, 'EXECUTE'))
     from pg_proc
    where oid in (
      'public.solmind_find_auth_provider_identity(text,text)'::regprocedure,
      'public.solmind_find_user_account(uuid)'::regprocedure,
      'public.solmind_find_active_user_sessions(uuid)'::regprocedure,
      'public.solmind_find_active_role_assignment(uuid,text)'::regprocedure,
      'public.solmind_find_guide_profile(uuid)'::regprocedure,
      'public.solmind_find_explorer_profile(uuid)'::regprocedure
    )) is not true,
  'authenticated cannot EXECUTE any of the six functions'
);

-- --- Schema isolation: identity/core tables stay off-limits to the Data API roles ------------

select ok(
  (select bool_or(has_table_privilege('anon', t, 'SELECT'))
     from unnest(array[
       'identity.auth_provider_identity',
       'identity.user_account',
       'identity.user_session',
       'identity.user_role_assignment',
       'core.guide_profile',
       'core.explorer_profile'
     ]) as t) is not true,
  'anon holds no direct SELECT on the identity/core tables the functions read'
);

select ok(
  (select bool_or(has_table_privilege('authenticated', t, 'SELECT'))
     from unnest(array[
       'identity.auth_provider_identity',
       'identity.user_account',
       'identity.user_session',
       'identity.user_role_assignment',
       'core.guide_profile',
       'core.explorer_profile'
     ]) as t) is not true,
  'authenticated holds no direct SELECT on the identity/core tables the functions read'
);

-- --- Reachability shape: an absent id returns an empty set (error null), not a failure -------

select is(
  (select count(*)::int from public.solmind_find_user_account(gen_random_uuid())),
  0,
  'a lookup on an absent user_account_id returns an empty set'
);

select * from finish();

rollback;
