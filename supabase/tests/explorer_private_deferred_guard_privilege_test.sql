-- Isolated synthetic SQL regression only. No Auth, browser or provider call.
-- Exercise the actual deferred triggers after a test-only definer returns to
-- service_role. This is trigger privilege/coherence proof, not RPC authority.
-- Root may reuse the marked fixture block for the separate COMMIT smoke test.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,pg_catalog,pg_temp;
set local statement_timeout='30s';
select plan(7);

-- BEGIN REUSABLE ISOLATED FIXTURE
-- These IDs belong only to this disposable test. Reusing the same exact fixture
-- lets the separate COMMIT smoke and rollback-only TAP checks share one source.
insert into identity.user_account(user_account_id,display_name,account_status) values
  ('f4280000-0000-4000-8000-000000000001','Deferred guard fixture Explorer','active'),
  ('f4280000-0000-4000-8000-000000000002','Deferred guard fixture Guide','active')
on conflict (user_account_id) do nothing;
insert into core.organization(organization_id,organization_name)
  values('f4280000-0000-4000-8000-000000000021','Deferred guard fixture organization')
on conflict (organization_id) do nothing;
insert into core.practice(practice_id,organization_id,practice_name)
  values('f4280000-0000-4000-8000-000000000022','f4280000-0000-4000-8000-000000000021','Deferred guard fixture practice')
on conflict (practice_id) do nothing;
insert into core.guide_profile(guide_profile_id,user_account_id,guide_display_name)
  values('f4280000-0000-4000-8000-000000000023','f4280000-0000-4000-8000-000000000002','Deferred guard fixture Guide')
on conflict (guide_profile_id) do nothing;
insert into core.explorer_profile(explorer_profile_id,user_account_id,explorer_display_name)
  values('f4280000-0000-4000-8000-000000000024','f4280000-0000-4000-8000-000000000001','Deferred guard fixture Explorer')
on conflict (explorer_profile_id) do nothing;
insert into core.guide_explorer_relationship(guide_explorer_relationship_id,guide_profile_id,explorer_profile_id,practice_id)
  values('f4280000-0000-4000-8000-000000000025','f4280000-0000-4000-8000-000000000023',
    'f4280000-0000-4000-8000-000000000024','f4280000-0000-4000-8000-000000000022')
on conflict (guide_explorer_relationship_id) do nothing;

-- TEST ONLY: a transaction-scoped fixture writer, not a product capability.
-- Its narrow grant exists only in the disposable test and rolls back below.
create or replace function public.solmind_test_private_deferred_guard_pair(p_session uuid,p_metadata_restricted boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_session is null or p_session not in (
    'f4280000-0000-4000-8000-000000000601'::uuid,
    'f4280000-0000-4000-8000-000000000602'::uuid,
    'f4280000-0000-4000-8000-000000000603'::uuid,
    'f4280000-0000-4000-8000-000000000604'::uuid)
    or p_metadata_restricted is null then
    raise exception 'synthetic_deferred_guard_invalid_fixture';
  end if;
  insert into ai.ai_interaction_session(ai_interaction_session_id,session_type,
    actor_user_account_id,actor_role_context,guide_profile_id,explorer_profile_id,
    guide_explorer_relationship_id,practice_id,metadata)
  values(p_session,'explorer_reflection','f4280000-0000-4000-8000-000000000001','explorer',
    'f4280000-0000-4000-8000-000000000023','f4280000-0000-4000-8000-000000000024',
    'f4280000-0000-4000-8000-000000000025','f4280000-0000-4000-8000-000000000022',
    pg_catalog.jsonb_build_object('restricted_mode',p_metadata_restricted));
  insert into ai.explorer_conversation_state(conversation_id,actor_user_account_id,
    safety_contract_version,restricted_level,adult_reflection_stopped,safety_version)
  values(p_session,'f4280000-0000-4000-8000-000000000001',
    'explorer-conversation-safety.v1',null,false,0);
end $$;
alter function public.solmind_test_private_deferred_guard_pair(uuid,boolean) owner to postgres;
revoke all on function public.solmind_test_private_deferred_guard_pair(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.solmind_test_private_deferred_guard_pair(uuid,boolean) to service_role;
-- END REUSABLE ISOLATED FIXTURE

select ok(not exists(select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
  where has_schema_privilege(r.role_name,'ai','USAGE')),
  'API roles still have no direct ai schema usage');
select ok(not exists(
  select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
  cross join (values('ai.ai_interaction_session'),('ai.explorer_conversation_state')) t(table_name)
  where has_table_privilege(r.role_name,t.table_name,'SELECT,INSERT,UPDATE,DELETE')),
  'API roles still have no direct session or private-state table privileges');
select ok(not exists(select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
  where has_function_privilege(r.role_name,'ai.solmind_private_policy_coherent_v3()','EXECUTE')),
  'the production trigger helper is not an API-role callable capability');

set local role service_role;
select lives_ok($test$
  set constraints all deferred;
  select public.solmind_test_private_deferred_guard_pair('f4280000-0000-4000-8000-000000000601',false);
  set constraints all immediate;
$test$,'coherent deferred checks pass after the definer returned to service_role');
reset role;
select is((select count(*) from (
  select ai_interaction_session_id from ai.ai_interaction_session
    where ai_interaction_session_id='f4280000-0000-4000-8000-000000000601'
  union all select conversation_id from ai.explorer_conversation_state
    where conversation_id='f4280000-0000-4000-8000-000000000601') pair),2::bigint,
  'both coherent rows remain after the actual deferred checks');

set local role service_role;
select throws_ok($test$
  set constraints all deferred;
  select public.solmind_test_private_deferred_guard_pair('f4280000-0000-4000-8000-000000000602',true);
  set constraints all immediate;
$test$,'P0001','solmind_explorer_private_policy_incoherent',
  'the same caller still cannot finish an incoherent private-policy pair');
reset role;
select is((select count(*) from (
  select ai_interaction_session_id from ai.ai_interaction_session
    where ai_interaction_session_id='f4280000-0000-4000-8000-000000000602'
  union all select conversation_id from ai.explorer_conversation_state
    where conversation_id='f4280000-0000-4000-8000-000000000602') pair),0::bigint,
  'the failed incoherent case leaves neither row');

select * from finish();
rollback;
