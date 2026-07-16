begin;
select plan(40);

select has_table('identity', 'session_creation_freshness_policy', 'freshness policy table exists');
select columns_are(
  'identity',
  'session_creation_freshness_policy',
  array['policy_name','minimum_seconds','active_seconds','maximum_seconds','retention_class','created_at','updated_at'],
  'freshness policy has the exact bounded columns'
);
select results_eq(
  $$select policy_name,minimum_seconds,active_seconds,maximum_seconds,retention_class from identity.session_creation_freshness_policy$$,
  $$select 'redeemed_evidence_freshness'::text,60,300,600,'security_log'::text$$,
  'freshness policy has one initial 60/300/600 row'
);
select ok(
  (select relrowsecurity and not relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='identity' and c.relname='session_creation_freshness_policy'),
  'freshness policy RLS is enabled and not forced'
);
select ok(not has_table_privilege('service_role','identity.session_creation_freshness_policy','SELECT'), 'service_role cannot read policy table directly');
select ok(not has_table_privilege('service_role','identity.session_creation_freshness_policy','UPDATE'), 'service_role cannot update policy table directly');
select ok(not has_table_privilege('anon','identity.session_creation_freshness_policy','SELECT'), 'anon cannot read policy table');
select ok(not has_table_privilege('authenticated','identity.session_creation_freshness_policy','SELECT'), 'authenticated cannot read policy table');

select has_function('public','solmind_create_user_session',array['uuid','text','uuid','text','integer'],'session function exists');
select function_lang_is('public','solmind_create_user_session',array['uuid','text','uuid','text','integer'],'plpgsql','session function is plpgsql');
select volatility_is('public','solmind_create_user_session',array['uuid','text','uuid','text','integer'],'volatile','session function is volatile');
select is(
  (select pg_get_function_result(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='solmind_create_user_session'),
  'TABLE(outcome text, user_session_id uuid, expires_at timestamp with time zone)',
  'session function returns the exact bounded result shape'
);
select ok((select p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='solmind_create_user_session'),'session function is security definer');
select is((select pg_get_userbyid(p.proowner) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='solmind_create_user_session'),'postgres','session function owner is postgres');
select is((select p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='solmind_create_user_session'),array['search_path=""','lock_timeout=2000ms']::text[],'session function has empty search_path and bounded lock timeout');
select ok(has_function_privilege('service_role','public.solmind_create_user_session(uuid,text,uuid,text,integer)','EXECUTE'),'service_role can execute session function');
select ok(not has_function_privilege('anon','public.solmind_create_user_session(uuid,text,uuid,text,integer)','EXECUTE'),'anon denied session function');
select ok(not has_function_privilege('authenticated','public.solmind_create_user_session(uuid,text,uuid,text,integer)','EXECUTE'),'authenticated denied session function');
select ok(not has_table_privilege('service_role','identity.user_session','SELECT'),'service_role has no session table select');
select ok(not has_table_privilege('service_role','identity.user_session','INSERT'),'service_role has no session table insert');
select ok(not has_table_privilege('service_role','identity.user_session','UPDATE'),'service_role has no session table update');
select ok(not has_table_privilege('service_role','audit.audit_event','INSERT'),'service_role has no audit table insert');

select is(
  (select pg_get_indexdef(indexrelid) from pg_index where indexrelid='identity.user_session_one_active_per_account_idx'::regclass),
  'CREATE UNIQUE INDEX user_session_one_active_per_account_idx ON identity.user_session USING btree (user_account_id) WHERE (session_status = ''active''::text)',
  'account-wide active-session backstop has the exact definition'
);
select is(
  (select pg_get_indexdef(indexrelid) from pg_index where indexrelid='identity.user_session_one_per_challenge_idx'::regclass),
  'CREATE UNIQUE INDEX user_session_one_per_challenge_idx ON identity.user_session USING btree (verification_challenge_id) WHERE (verification_challenge_id IS NOT NULL)',
  'per-challenge backstop has the exact definition'
);
select ok((select prosrc like '%solmind_session_conflicting_retry%' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='solmind_create_user_session'),'function carries fixed conflicting-retry identifier');
select ok((select prosrc like '%solmind_session_policy_unavailable%' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='solmind_create_user_session'),'function carries fixed unavailable-policy identifier');
select ok((select prosrc like '%solmind_session_active_cardinality_violation%' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='solmind_create_user_session'),'function carries fixed active-cardinality identifier');

select throws_ok($$select * from public.solmind_create_user_session(null,'admin','def50004-0000-4000-8000-000000000001','login',300)$$,'P0001','solmind_session_invalid_account','null account fails closed');
select throws_ok($$select * from public.solmind_create_user_session('def50004-0000-4000-8000-000000000001','owner','def50004-0000-4000-8000-000000000002','login',300)$$,'P0001','solmind_session_invalid_role','unknown role fails closed');
select throws_ok($$select * from public.solmind_create_user_session('def50004-0000-4000-8000-000000000001',null,'def50004-0000-4000-8000-000000000002','login',300)$$,'P0001','solmind_session_invalid_role','null role fails closed');
select throws_ok($$select * from public.solmind_create_user_session('def50004-0000-4000-8000-000000000001','admin',null,'login',300)$$,'P0001','solmind_session_invalid_challenge','null challenge fails closed');
select throws_ok($$select * from public.solmind_create_user_session('def50004-0000-4000-8000-000000000001','admin','def50004-0000-4000-8000-000000000002','password_reset',300)$$,'P0001','solmind_session_invalid_purpose','provisioning purpose fails closed');
select throws_ok($$select * from public.solmind_create_user_session('def50004-0000-4000-8000-000000000001','admin','def50004-0000-4000-8000-000000000002',null,300)$$,'P0001','solmind_session_invalid_purpose','null purpose fails closed');
select throws_ok($$select * from public.solmind_create_user_session('def50004-0000-4000-8000-000000000001','admin','def50004-0000-4000-8000-000000000002','login',0)$$,'P0001','solmind_session_invalid_duration','zero duration fails closed');
select throws_ok($$select * from public.solmind_create_user_session('def50004-0000-4000-8000-000000000001','admin','def50004-0000-4000-8000-000000000002','login',3601)$$,'P0001','solmind_session_invalid_duration','over-ceiling duration fails closed');

select ok((select relrowsecurity and not relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='identity' and c.relname='user_session'),'user_session RLS stays enabled and not forced');
select ok((select relrowsecurity and not relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='audit' and c.relname='audit_event'),'audit RLS stays enabled and not forced');
select is((select count(*)::int from pg_policies where schemaname in ('identity','core','audit','content','ai','methodology','notification','scheduling')),0,'no policies exist in any SolMind application schema');
select ok((select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname in ('identity','core','audit','content','ai','methodology','notification','scheduling')),'every SolMind application table keeps RLS enabled');
select is((select count(*)::int from pg_policies where schemaname='public'),0,'public schema has no policies');

select * from finish();
rollback;
