-- Login step 6a contract and security proofs for public.solmind_logout_user_session.
-- Source contract: execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md Section 9.
-- Local ephemeral database only. Seeds no data; everything rolls back.
begin;
select plan(50);

select has_function('public','solmind_logout_user_session',array['uuid','uuid'],'logout function exists with the exact argument types');
select function_lang_is('public','solmind_logout_user_session',array['uuid','uuid'],'plpgsql','logout function is plpgsql');
select volatility_is('public','solmind_logout_user_session',array['uuid','uuid'],'volatile','logout function is volatile');
select is(
  (select count(*)::int from pg_proc p where p.proname='solmind_logout_user_session'),
  1,
  'exactly one logout function exists in any schema (no overload)'
);
select is(
  pg_get_function_result('public.solmind_logout_user_session(uuid,uuid)'::regprocedure),
  'TABLE(outcome text)',
  'logout function returns the exact one-column table shape'
);
select is(
  pg_get_function_arguments('public.solmind_logout_user_session(uuid,uuid)'::regprocedure),
  'p_user_account_id uuid, p_user_session_id uuid',
  'logout function takes only the server-derived account and the presented session UUID'
);
select ok((select prosecdef from pg_proc where oid='public.solmind_logout_user_session(uuid,uuid)'::regprocedure),'logout function is security definer');
select is((select pg_get_userbyid(proowner) from pg_proc where oid='public.solmind_logout_user_session(uuid,uuid)'::regprocedure),'postgres','logout function owner is postgres');
select is(
  (select proconfig from pg_proc where oid='public.solmind_logout_user_session(uuid,uuid)'::regprocedure),
  array['search_path=""','lock_timeout=2000ms']::text[],
  'logout function has an empty search_path and the bounded lock timeout of session creation'
);
select ok(
  (select obj_description('public.solmind_logout_user_session(uuid,uuid)'::regprocedure,'pg_proc') like '%service_role-only%'),
  'logout function carries its dormant service-role-only comment'
);

select ok(has_function_privilege('service_role','public.solmind_logout_user_session(uuid,uuid)','EXECUTE'),'service_role can execute the logout function');
select is(
  (select n.nspname::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.oid='public.solmind_logout_user_session(uuid,uuid)'::regprocedure),
  'public',
  'the function is in the public schema, which the Data API serves, so service-role RPC execution stays available (as for session creation)'
);
select ok(not has_function_privilege('anon','public.solmind_logout_user_session(uuid,uuid)','EXECUTE'),'anon cannot execute the logout function');
select ok(not has_function_privilege('authenticated','public.solmind_logout_user_session(uuid,uuid)','EXECUTE'),'authenticated cannot execute the logout function');
select ok(not has_function_privilege('public','public.solmind_logout_user_session(uuid,uuid)','EXECUTE'),'PUBLIC cannot execute the logout function');
select is(
  (select count(*)::int
     from pg_proc p
     cross join lateral aclexplode(p.proacl) acl
    where p.oid='public.solmind_logout_user_session(uuid,uuid)'::regprocedure
      and (acl.grantee=0::oid or acl.grantee in ('anon'::regrole::oid,'authenticated'::regrole::oid))),
  0,
  'the function ACL holds no PUBLIC, anon, or authenticated entry: anon and authenticated execution is denied'
);

select ok(not has_table_privilege('service_role','identity.user_session','SELECT'),'service_role has no session table select');
select ok(not has_table_privilege('service_role','identity.user_session','UPDATE'),'service_role has no session table update');
select ok(not has_table_privilege('service_role','identity.user_session','DELETE'),'service_role has no session table delete');
select ok(not has_table_privilege('service_role','audit.audit_event','INSERT'),'service_role has no audit table insert');
select ok(not has_table_privilege('anon','identity.user_session','UPDATE'),'anon has no session table update');
select ok(not has_table_privilege('authenticated','identity.user_session','UPDATE'),'authenticated has no session table update');
select ok(not has_table_privilege('anon','audit.audit_event','SELECT'),'anon has no audit table select');
select ok(not has_table_privilege('authenticated','audit.audit_event','SELECT'),'authenticated has no audit table select');

select ok(
  (select prosrc like '%solmind:authorizing-domain:account:v1|%'
     from pg_proc where oid='public.solmind_logout_user_session(uuid,uuid)'::regprocedure),
  'logout takes the shared account-domain advisory lock that session creation takes'
);
select ok(
  (select prosrc not like '%solmind:authorizing-evidence:v1|%'
      and prosrc not like '%verification_challenge%'
      and prosrc not like '%authorizing_evidence_consumption%'
     from pg_proc where oid='public.solmind_logout_user_session(uuid,uuid)'::regprocedure),
  'logout never takes the evidence lock and never reads or changes evidence or its consumption'
);
select is(
  (select count(*)::int
     from pg_proc p
     cross join lateral regexp_matches(p.prosrc,'(insert\s+into|update|delete\s+from)\s+[a-z_]+\.[a-z_]+','gi') m
    where p.oid='public.solmind_logout_user_session(uuid,uuid)'::regprocedure),
  2,
  'logout has exactly two write statements'
);
select ok(
  (select prosrc ~ 'update identity\.user_session session\s+set session_status = ''logged_out'',\s+ended_at = v_now\s+where session\.user_session_id = p_user_session_id\s+and session\.user_account_id = p_user_account_id\s+and session\.session_status = ''active'''
     from pg_proc where oid='public.solmind_logout_user_session(uuid,uuid)'::regprocedure),
  'the only state change targets the presented session of this account while it is active'
);
select ok(
  (select prosrc like '%insert into audit.audit_event%'
      and prosrc like '%''session_logged_out''%'
      and prosrc like '%''end'', ''user_logout''%'
      and prosrc like '%''User session ended by logout.''%'
     from pg_proc where oid='public.solmind_logout_user_session(uuid,uuid)'::regprocedure),
  'the only insert is the exact Family B logout audit row'
);
select ok(
  (select prosrc like '%solmind_logout_invalid_account%'
      and prosrc like '%solmind_logout_invalid_session%'
      and prosrc like '%solmind_logout_unknown_session%'
      and prosrc like '%solmind_logout_cardinality_violation%'
      and prosrc like '%solmind_logout_lock_unavailable%'
      and prosrc like '%solmind_logout_integrity_failure%'
      and prosrc like '%solmind_logout_failed%'
     from pg_proc where oid='public.solmind_logout_user_session(uuid,uuid)'::regprocedure),
  'logout carries its seven fixed value-free failure identifiers'
);
select is(
  (select (length(prosrc) - length(replace(prosrc,'clock_timestamp(','')))/length('clock_timestamp(')
     from pg_proc where oid='public.solmind_logout_user_session(uuid,uuid)'::regprocedure),
  1,
  'logout reads the database clock exactly once'
);
select ok(
  (select prosrc not ilike '%now()%'
      and prosrc not ilike '%statement_timestamp%'
      and prosrc not ilike '%transaction_timestamp%'
      and prosrc not ilike '%current_timestamp%'
      and prosrc not ilike '%localtimestamp%'
      and prosrc not ilike '%timeofday%'
     from pg_proc where oid='public.solmind_logout_user_session(uuid,uuid)'::regprocedure),
  'logout uses no other time source'
);
select ok(
  (select strpos(prosrc,'pg_catalog.pg_advisory_xact_lock(') > 0
      and strpos(prosrc,'pg_catalog.pg_advisory_xact_lock(') < strpos(prosrc,'for update')
      and strpos(prosrc,'for update') < strpos(prosrc,'pg_catalog.clock_timestamp()')
     from pg_proc where oid='public.solmind_logout_user_session(uuid,uuid)'::regprocedure),
  'the clock is read after the account lock and after the presented row is locked'
);
select ok(
  (select prosrc like '%when assert_failure then%raise exception ''solmind_logout_failed''%'
      and prosrc like '%when others then%raise exception ''solmind_logout_failed''%'
      and prosrc not ilike '%sqlerrm%'
      and prosrc not ilike '%sqlstate%'
      and prosrc not ilike '%stacked diagnostics%'
      and prosrc not ilike '% using %'
     from pg_proc where oid='public.solmind_logout_user_session(uuid,uuid)'::regprocedure),
  'every unexpected failure raised in the body, assertion failures included, becomes the fixed solmind_logout_failed and no original message, detail or hint is passed on'
);

set local role service_role;
select throws_ok(
  $$select * from public.solmind_logout_user_session(null,'106a0000-5000-4000-8000-000000000001')$$,
  'P0001','solmind_logout_invalid_account','a null account fails closed'
);
select throws_ok(
  $$select * from public.solmind_logout_user_session('106a0000-1000-4000-8000-000000000001',null)$$,
  'P0001','solmind_logout_invalid_session','a null session fails closed'
);
select throws_ok(
  $$select * from public.solmind_logout_user_session(null,null)$$,
  'P0001','solmind_logout_invalid_account','the account is checked first'
);
select throws_ok(
  $$select * from public.solmind_logout_user_session('106a0000-1000-4000-8000-000000000001','106a0000-5000-4000-8000-000000000001')$$,
  'P0001','solmind_logout_unknown_session','a session UUID that does not exist fails closed with one fixed identifier'
);
reset role;

set local role anon;
select throws_ok(
  $$select * from public.solmind_logout_user_session('106a0000-1000-4000-8000-000000000001','106a0000-5000-4000-8000-000000000001')$$,
  '42501',
  'permission denied for function solmind_logout_user_session',
  'anon direct invocation is denied'
);
reset role;
set local role authenticated;
select throws_ok(
  $$select * from public.solmind_logout_user_session('106a0000-1000-4000-8000-000000000001','106a0000-5000-4000-8000-000000000001')$$,
  '42501',
  'permission denied for function solmind_logout_user_session',
  'authenticated direct invocation is denied'
);
reset role;

select ok((select relrowsecurity and not relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='identity' and c.relname='user_session'),'user_session RLS stays enabled and not forced');
select ok((select relrowsecurity and not relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='audit' and c.relname='audit_event'),'audit RLS stays enabled and not forced');
select is((select count(*)::int from pg_policies where schemaname in ('identity','core','audit','content','ai','methodology','notification','scheduling')),0,'no policies exist in any SolMind application schema');
select ok((select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname in ('identity','core','audit','content','ai','methodology','notification','scheduling')),'every SolMind application table keeps RLS enabled');
select is((select count(*)::int from pg_policies where schemaname='public'),0,'public schema has no policies');
select is(
  (select pg_get_constraintdef(oid) from pg_constraint where conrelid='identity.user_session'::regclass and conname='user_session_status_check'),
  'CHECK ((session_status = ANY (ARRAY[''active''::text, ''expired''::text, ''logged_out''::text, ''revoked''::text])))',
  'the session status vocabulary still includes the data model''s logged_out status'
);
select is(
  (select pg_get_indexdef(indexrelid) from pg_index where indexrelid='identity.user_session_one_active_per_account_idx'::regclass),
  'CREATE UNIQUE INDEX user_session_one_active_per_account_idx ON identity.user_session USING btree (user_account_id) WHERE (session_status = ''active''::text)',
  'the account-wide active-session backstop is unchanged'
);
select ok(
  (select prosrc like '%solmind:authorizing-domain:account:v1|%'
     from pg_proc where oid='public.solmind_create_user_session(uuid,text,uuid,text,integer)'::regprocedure),
  'session creation still takes the same account-domain key, so logout and login serialize per account'
);
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='graphql_public' and p.proname like 'solmind\_%'),
  0,
  'no SolMind function is placed in the GraphQL-exposed schema'
);
select is(
  (select count(*)::int from identity.user_session where user_account_id::text like '106a0000-%'),
  0,
  'the input checks left no session residue'
);

select * from finish();
rollback;
