-- Guide/Admin R04 ownership RPC: catalog, closed arguments and actual ACL denial.
-- Run only in the separately verified local test DB; integration receipts own actual proof.
-- No real identities; output uses fixed labels and boolean/catalog values only.
begin;
select plan(29);

select has_function('public','solmind_check_login_challenge_owner',array['uuid','uuid','text'],'ownership function exists');
select function_lang_is('public','solmind_check_login_challenge_owner',array['uuid','uuid','text'],'plpgsql','ownership uses plpgsql');
select volatility_is('public','solmind_check_login_challenge_owner',array['uuid','uuid','text'],'stable','ownership is stable');
select is((select count(*)::int from pg_proc where proname='solmind_check_login_challenge_owner'),1,'exactly one ownership function, no overload');
select is(pg_get_function_result('public.solmind_check_login_challenge_owner(uuid,uuid,text)'::regprocedure),'TABLE(owned boolean)','only one boolean output');
select is(pg_get_function_arguments('public.solmind_check_login_challenge_owner(uuid,uuid,text)'::regprocedure),'p_user_account_id uuid, p_verification_challenge_id uuid, p_expected_purpose text','exact argument names and types');
select ok((select prosecdef from pg_proc where oid='public.solmind_check_login_challenge_owner(uuid,uuid,text)'::regprocedure),'security definer');
select is((select pg_get_userbyid(proowner) from pg_proc where oid='public.solmind_check_login_challenge_owner(uuid,uuid,text)'::regprocedure),'postgres','explicit postgres owner');
select is((select proconfig from pg_proc where oid='public.solmind_check_login_challenge_owner(uuid,uuid,text)'::regprocedure),array['search_path=""']::text[],'empty search path only');
select ok(has_function_privilege('service_role','public.solmind_check_login_challenge_owner(uuid,uuid,text)','EXECUTE'),'service role can execute');
select ok(not has_function_privilege('anon','public.solmind_check_login_challenge_owner(uuid,uuid,text)','EXECUTE'),'anon cannot execute');
select ok(not has_function_privilege('authenticated','public.solmind_check_login_challenge_owner(uuid,uuid,text)','EXECUTE'),'authenticated cannot execute');
select ok(not has_function_privilege('public','public.solmind_check_login_challenge_owner(uuid,uuid,text)','EXECUTE'),'PUBLIC cannot execute');
select is((select count(*)::int from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where p.oid='public.solmind_check_login_challenge_owner(uuid,uuid,text)'::regprocedure
    and (a.grantee not in (p.proowner,'service_role'::regrole::oid) or a.privilege_type <> 'EXECUTE' or a.is_grantable)),0,'no extra grantee or grant option');
select ok((select count(*)=2 and bool_and(relrowsecurity and not relforcerowsecurity) from pg_class
  where oid in ('identity.verification_challenge'::regclass,'identity.user_contact_method'::regclass)),'both read tables retain non-forced RLS');
select ok((select bool_or(has_table_privilege(r.role_name,t.table_name,'SELECT')) from
  (values ('service_role'),('anon'),('authenticated')) r(role_name) cross join
  (values ('identity.verification_challenge'),('identity.user_contact_method')) t(table_name)) is false,'no read-table grant to API roles');
select is((select count(*)::int from pg_policies where schemaname='identity' and tablename in ('verification_challenge','user_contact_method')),0,'no policy added to either read table');

set local role service_role;
select throws_ok($$select * from public.solmind_check_login_challenge_owner(null,'10690000-2000-4000-8000-000000000001','login')$$,'P0001','solmind_login_owner_invalid_account','null account is a fixed failure');
select throws_ok($$select * from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001',null,'login')$$,'P0001','solmind_login_owner_invalid_challenge','null selector is a fixed failure');
select throws_ok($$select * from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001','10690000-2000-4000-8000-000000000001',null)$$,'P0001','solmind_login_owner_invalid_purpose','null purpose is a fixed failure');
select throws_ok($$select * from public.solmind_check_login_challenge_owner(null,null,null)$$,'P0001','solmind_login_owner_invalid_account','argument failure order is fixed');
select throws_ok($$select * from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001','10690000-2000-4000-8000-000000000001','')$$,'P0001','solmind_login_owner_invalid_purpose','empty purpose refused');
select throws_ok($$select * from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001','10690000-2000-4000-8000-000000000001','role_reentry')$$,'P0001','solmind_login_owner_invalid_purpose','other legitimate purposes do not widen login scope');
select throws_ok($$select * from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001','10690000-2000-4000-8000-000000000001','LOGIN')$$,'P0001','solmind_login_owner_invalid_purpose','purpose is case exact');
select throws_ok($$select * from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001','10690000-2000-4000-8000-000000000001','login ')$$,'P0001','solmind_login_owner_invalid_purpose','purpose is not trimmed');
select throws_ok($$select * from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001','10690000-2000-4000-8000-000000000001',repeat('x',1000))$$,'P0001','solmind_login_owner_invalid_purpose','oversized purpose refused without value output');
select results_eq($$select owned from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001','10690000-2000-4000-8000-000000000099','login')$$,$$select false$$,'missing selector gives exactly one false row');
reset role;
set local role anon;
select throws_ok($$select * from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001','10690000-2000-4000-8000-000000000001','login')$$,'42501','permission denied for function solmind_check_login_challenge_owner','anon actual invocation denied');
reset role;
set local role authenticated;
select throws_ok($$select * from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001','10690000-2000-4000-8000-000000000001','login')$$,'42501','permission denied for function solmind_check_login_challenge_owner','authenticated actual invocation denied');
reset role;

select * from finish();
rollback;
