-- SolMind MVP0 B-4 pgTAP: seeded real-path Admin/auth RPC row contract.
-- Source contract: execution/19_SolMind_MVP0_Auth_RLS_RPC_Function_Contract_v0_1.md (Section 13).
-- Banked decision: AUTH-RLS-DEC-026.
-- Run with: supabase test db  (local stack only; never cloud).
--
-- Scope of THIS file:
--   - seed a synthetic, local-ephemeral active Admin chain (never real or pilot Admin data)
--     and prove the six public.solmind_find_* functions return exactly the rows that drive an
--     ALLOW: the identity, account, single active session, and active admin role assignment
--     resolve, while the optional guide/explorer profiles are absent (not a deny on /admin);
--   - prove the DEF5-S4 database backstop rejects a second active account session, while the
--     app layer's ambiguity-deny behavior remains independently proven in mocked app tests;
--   - prove the DB does not pre-filter an expired-but-active-status session (returns it,
--     expiry visible), which the app layer turns into a deny.
--
-- Rollback-safe: everything runs inside a transaction that ROLLS BACK, so no seeded row
-- persists. It adds no migration, function, policy, or grant. The synthetic ids below are
-- fixed, obviously-synthetic literals, not real accounts.

begin;

select plan(11);

-- --- Seed one valid active Admin chain (account 1) -------------------------------------------
-- account_status defaults to 'pending'; set 'active'. display_name is NOT NULL.

insert into identity.user_account (user_account_id, display_name, account_status)
values ('11111111-1111-1111-1111-111111111111', 'B4 Synthetic Admin', 'active');

insert into identity.auth_provider_identity
  (user_account_id, provider_name, provider_user_id, status)
values ('11111111-1111-1111-1111-111111111111', 'supabase', 'b4-auth-admin-1', 'active');

insert into identity.user_role_assignment (user_account_id, role_code, role_status)
values ('11111111-1111-1111-1111-111111111111', 'admin', 'active');

insert into identity.user_session
  (user_account_id, active_role_context, expires_at, session_status)
values
  ('11111111-1111-1111-1111-111111111111', 'admin', now() + interval '1 hour', 'active');

-- The four required lookups resolve to the seeded active Admin chain.

select is(
  (select user_account_id
     from public.solmind_find_auth_provider_identity('supabase', 'b4-auth-admin-1')),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'auth_provider_identity lookup resolves the seeded active admin account'
);

select is(
  (select account_status
     from public.solmind_find_user_account('11111111-1111-1111-1111-111111111111'::uuid)),
  'active',
  'user_account lookup returns the active account status'
);

select is(
  (select count(*)::int
     from public.solmind_find_active_user_sessions('11111111-1111-1111-1111-111111111111'::uuid)),
  1,
  'exactly one active session is returned for the seeded account'
);

select is(
  (select active_role_context
     from public.solmind_find_active_user_sessions('11111111-1111-1111-1111-111111111111'::uuid)),
  'admin',
  'the active session carries the admin role context'
);

select is(
  (select role_status
     from public.solmind_find_active_role_assignment(
       '11111111-1111-1111-1111-111111111111'::uuid, 'admin')),
  'active',
  'the active admin role assignment resolves'
);

-- The optional profiles are absent for an Admin; a null profile is not a deny on /admin.

select is(
  (select count(*)::int
     from public.solmind_find_guide_profile('11111111-1111-1111-1111-111111111111'::uuid)),
  0,
  'no guide profile for the seeded admin (optional; not a deny)'
);

select is(
  (select count(*)::int
     from public.solmind_find_explorer_profile('11111111-1111-1111-1111-111111111111'::uuid)),
  0,
  'no explorer profile for the seeded admin (optional; not a deny)'
);

-- An unrelated, unseeded account resolves to nothing (empty database / absent account -> deny).

select is(
  (select count(*)::int
     from public.solmind_find_user_account(gen_random_uuid())),
  0,
  'an unseeded account id resolves to no account row'
);

-- --- DEF5-S4 structural backstop rejects a second active account session --------------------

select throws_ok(
  $$insert into identity.user_session
      (user_account_id, active_role_context, expires_at, session_status)
    values
      ('11111111-1111-1111-1111-111111111111', 'admin', now() + interval '2 hours', 'active')$$,
  '23505',
  'duplicate key value violates unique constraint "user_session_one_active_per_account_idx"',
  'the database rejects a second active session for the same account'
);

-- --- Expiry is surfaced, not pre-filtered: a backdated, still-active-status session ----------
-- The expires_at > created_at CHECK forces created_at to be backdated further than expires_at.

insert into identity.user_account (user_account_id, display_name, account_status)
values ('22222222-2222-2222-2222-222222222222', 'B4 Synthetic Expired', 'active');

insert into identity.user_session
  (user_account_id, active_role_context, created_at, expires_at, session_status)
values
  ('22222222-2222-2222-2222-222222222222', 'admin',
   now() - interval '2 hours', now() - interval '1 hour', 'active');

select is(
  (select count(*)::int
     from public.solmind_find_active_user_sessions('22222222-2222-2222-2222-222222222222'::uuid)),
  1,
  'an expired-but-active-status session is still returned (expiry not pre-filtered)'
);

select ok(
  (select expires_at
     from public.solmind_find_active_user_sessions('22222222-2222-2222-2222-222222222222'::uuid))
    < now(),
  'the returned session is already expired, leaving the deny to the app layer'
);

select * from finish();

rollback;
