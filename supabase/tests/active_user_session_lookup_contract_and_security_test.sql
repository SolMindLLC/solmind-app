-- Login step 6 sub-slice S6-3 contract and security proofs for public.solmind_find_active_user_sessions
-- after migration 20261005000000_active_user_session_lookup_session_id.sql: the exact new return
-- shape, and the banked hygiene, grants, read-only body and denials unchanged.
-- Source contracts: execution/19_SolMind_MVP0_Auth_RLS_RPC_Function_Contract_v0_1.md Sections 7, 8
-- (function 3) and 9; execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md
-- Section 8.
-- Local ephemeral database only. Seeds no data; everything rolls back.
begin;
select plan(37);

-- Shape: one function, the exact argument, the five returned columns.
select has_function('public','solmind_find_active_user_sessions',array['uuid'],'the session lookup exists with its one uuid argument');
select is(
  (select count(*)::int from pg_proc p where p.proname='solmind_find_active_user_sessions'),
  1,
  'exactly one session lookup exists in any schema (no overload, no leftover definition)'
);
select is(
  pg_get_function_result('public.solmind_find_active_user_sessions(uuid)'::regprocedure),
  'TABLE(user_session_id uuid, user_account_id uuid, active_role_context text, session_status text, expires_at timestamp with time zone)',
  'the lookup returns exactly the session UUID and the four banked columns'
);
select is(
  pg_get_function_arguments('public.solmind_find_active_user_sessions(uuid)'::regprocedure),
  'p_user_account_id uuid',
  'the lookup takes only the account UUID'
);
select function_lang_is('public','solmind_find_active_user_sessions',array['uuid'],'sql','the lookup is LANGUAGE sql');
select volatility_is('public','solmind_find_active_user_sessions',array['uuid'],'stable','the lookup is STABLE');
select ok(
  (select proretset and not proisstrict and prokind='f'
     from pg_proc where oid='public.solmind_find_active_user_sessions(uuid)'::regprocedure),
  'the lookup is a set-returning, non-strict plain function, as banked'
);

-- Hygiene and ownership (contract 19 Section 7).
select ok((select prosecdef from pg_proc where oid='public.solmind_find_active_user_sessions(uuid)'::regprocedure),'the lookup is security definer');
select is((select pg_get_userbyid(proowner) from pg_proc where oid='public.solmind_find_active_user_sessions(uuid)'::regprocedure),'postgres','the lookup owner is postgres');
select is(
  (select proconfig from pg_proc where oid='public.solmind_find_active_user_sessions(uuid)'::regprocedure),
  array['search_path=""']::text[],
  'the lookup pins an empty search_path and sets nothing else'
);
select ok(
  (select obj_description('public.solmind_find_active_user_sessions(uuid)'::regprocedure,'pg_proc') like '%AUTH-RLS-DEC-026%'
      and obj_description('public.solmind_find_active_user_sessions(uuid)'::regprocedure,'pg_proc') like '%EXECUTE granted to service_role only%'
      and obj_description('public.solmind_find_active_user_sessions(uuid)'::regprocedure,'pg_proc') like '%user_session_id%'
      and obj_description('public.solmind_find_active_user_sessions(uuid)'::regprocedure,'pg_proc') like '%FORCE ROW LEVEL SECURITY%'),
  'the lookup carries its owner-bypass, service-role-only, session UUID and FORCE ROW LEVEL SECURITY comment'
);
select is(
  (select n.nspname::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.oid='public.solmind_find_active_user_sessions(uuid)'::regprocedure),
  'public',
  'the lookup stays in the public schema, which the Data API serves, so service-role RPC calls keep reaching it'
);

-- Grants: the same as banked (all privileges revoked from PUBLIC, EXECUTE revoked from anon and
-- authenticated, EXECUTE granted to service_role).
select ok(has_function_privilege('service_role','public.solmind_find_active_user_sessions(uuid)','EXECUTE'),'service_role can execute the lookup');
select ok(not has_function_privilege('anon','public.solmind_find_active_user_sessions(uuid)','EXECUTE'),'anon cannot execute the lookup');
select ok(not has_function_privilege('authenticated','public.solmind_find_active_user_sessions(uuid)','EXECUTE'),'authenticated cannot execute the lookup');
select ok(not has_function_privilege('public','public.solmind_find_active_user_sessions(uuid)','EXECUTE'),'PUBLIC cannot execute the lookup');
select is(
  (select count(*)::int
     from pg_proc p
     cross join lateral pg_catalog.aclexplode(p.proacl) acl
    where p.oid='public.solmind_find_active_user_sessions(uuid)'::regprocedure
      and (acl.grantee=0::oid or acl.grantee in ('anon'::regrole::oid,'authenticated'::regrole::oid))),
  0,
  'the lookup ACL holds no PUBLIC, anon, or authenticated entry'
);
select is(
  (select array_agg(e order by e) from (
     select format('%s|%s|%s|%s', acl.grantor::regrole::text,
                   case when acl.grantee=0::oid then 'PUBLIC' else acl.grantee::regrole::text end,
                   acl.privilege_type, acl.is_grantable) as e
       from pg_proc p
       cross join lateral pg_catalog.aclexplode(p.proacl) acl
      where p.oid='public.solmind_find_active_user_sessions(uuid)'::regprocedure) recreated),
  (select array_agg(e order by e) from (
     select format('%s|%s|%s|%s', acl.grantor::regrole::text,
                   case when acl.grantee=0::oid then 'PUBLIC' else acl.grantee::regrole::text end,
                   acl.privilege_type, acl.is_grantable) as e
       from pg_proc p
       cross join lateral pg_catalog.aclexplode(p.proacl) acl
      where p.oid='public.solmind_find_user_account(uuid)'::regprocedure) sibling),
  'the recreated lookup''s ACL equals that of its untouched sibling public.solmind_find_user_account, which the same banked grant block produced'
);

-- Body: one read-only SELECT of identity.user_session, with only the banked predicates.
select ok(
  (select prosrc ~ 'select\s+t\.user_session_id,\s+t\.user_account_id,\s+t\.active_role_context,\s+t\.session_status,\s+t\.expires_at\s+from identity\.user_session as t\s+where t\.session_status = ''active''\s+and t\.user_account_id = p_user_account_id;'
     from pg_proc where oid='public.solmind_find_active_user_sessions(uuid)'::regprocedure),
  'the body selects the five columns from identity.user_session with only the active-status and account predicates'
);
select is(
  (select count(*)::int
     from pg_proc p
     cross join lateral regexp_matches(p.prosrc,'\m(from|join)\M','gi') m
    where p.oid='public.solmind_find_active_user_sessions(uuid)'::regprocedure),
  1,
  'the body reads exactly one relation and joins nothing'
);
select ok(
  (select (length(prosrc)-length(replace(prosrc,'expires_at','')))/length('expires_at')=1
      and prosrc !~* '\m(now|clock_timestamp|statement_timestamp|transaction_timestamp|current_timestamp|localtimestamp|timeofday)\M'
     from pg_proc where oid='public.solmind_find_active_user_sessions(uuid)'::regprocedure),
  'the body names expires_at only as a returned column and reads no clock: no expiry pre-filter'
);
select ok(
  (select prosrc !~* '\m(limit|offset|order|group|having|distinct|fetch)\M'
     from pg_proc where oid='public.solmind_find_active_user_sessions(uuid)'::regprocedure),
  'the body has no LIMIT, OFFSET, ORDER BY, grouping, or DISTINCT, so every active session of the account is returned'
);
select ok(
  (select prosrc !~* '\m(insert|update|delete|merge|truncate|raise|exception|perform|lock)\M'
     from pg_proc where oid='public.solmind_find_active_user_sessions(uuid)'::regprocedure),
  'the body writes nothing, takes no lock, and raises nothing of its own'
);

-- The five sibling lookups of the same banked set keep their exact shapes.
select is(
  pg_get_function_result('public.solmind_find_auth_provider_identity(text,text)'::regprocedure),
  'TABLE(user_account_id uuid, provider_name text, provider_user_id text, status text)',
  'the provider-identity lookup is unchanged'
);
select is(
  pg_get_function_result('public.solmind_find_user_account(uuid)'::regprocedure),
  'TABLE(user_account_id uuid, account_status text)',
  'the account lookup is unchanged'
);
select is(
  pg_get_function_result('public.solmind_find_active_role_assignment(uuid,text)'::regprocedure),
  'TABLE(user_account_id uuid, role_code text, role_status text)',
  'the role-assignment lookup is unchanged'
);
select is(
  pg_get_function_result('public.solmind_find_guide_profile(uuid)'::regprocedure),
  'TABLE(guide_profile_id uuid, user_account_id uuid, status text)',
  'the Guide-profile lookup is unchanged'
);
select is(
  pg_get_function_result('public.solmind_find_explorer_profile(uuid)'::regprocedure),
  'TABLE(explorer_profile_id uuid, user_account_id uuid, status text)',
  'the Explorer-profile lookup is unchanged'
);

-- Denials and reachability.
set local role anon;
select throws_ok(
  $$select * from public.solmind_find_active_user_sessions('10630000-1000-4000-8000-0000000000ee')$$,
  '42501',
  'permission denied for function solmind_find_active_user_sessions',
  'anon direct invocation is denied'
);
reset role;
set local role authenticated;
select throws_ok(
  $$select * from public.solmind_find_active_user_sessions('10630000-1000-4000-8000-0000000000ee')$$,
  '42501',
  'permission denied for function solmind_find_active_user_sessions',
  'authenticated direct invocation is denied'
);
reset role;
set local role service_role;
select is(
  (select count(*)::int from public.solmind_find_active_user_sessions('10630000-1000-4000-8000-0000000000ee')),
  0,
  'service_role reaches the lookup, and an account with no session returns an empty set, not an error'
);
reset role;

-- The table and its posture are unchanged.
select ok((select relrowsecurity and not relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='identity' and c.relname='user_session'),'user_session RLS stays enabled and not forced, so the owner-bypass read still works');
select ok(not has_table_privilege('service_role','identity.user_session','SELECT'),'service_role has no direct session table select; the lookup is its only read path');
select ok(not has_table_privilege('anon','identity.user_session','SELECT'),'anon has no session table select');
select ok(not has_table_privilege('authenticated','identity.user_session','SELECT'),'authenticated has no session table select');
select is(
  (select pg_get_indexdef(indexrelid) from pg_index where indexrelid='identity.user_session_one_active_per_account_idx'::regclass),
  'CREATE UNIQUE INDEX user_session_one_active_per_account_idx ON identity.user_session USING btree (user_account_id) WHERE (session_status = ''active''::text)',
  'the account-wide active-session backstop is unchanged'
);
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='graphql_public' and p.proname like 'solmind\_%'),
  0,
  'no SolMind function is placed in the GraphQL-exposed schema'
);

select * from finish();
rollback;
