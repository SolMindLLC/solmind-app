-- Synthetic real two-session overlap proof.
-- Current executed evidence: solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md.
-- ROOT-OWNED DISPOSABLE POSTGRES ONLY: this file commits reserved synthetic
-- fixtures so independent service-role sessions can contend on actual RPCs.
-- It connects only to the current verified TCP server's numeric address/port,
-- never guessed DNS, loopback trust, a shared host54322 endpoint or a fallback.
-- All credentials below are ordinary isolated synthetic postgres defaults.
-- Collision preflight, bounded worker waits, narrow transactional cleanup and
-- zero-residue assertions are required. An aborted run may leave reserved rows;
-- Root must inspect/teardown its exact disposable DB, never reset a shared DB.
-- These SQL fixtures prove no Auth/browser/human/model/policy/provider behavior.

create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
set search_path=public,extensions,pg_catalog,pg_temp;
set statement_timeout='120s';

create function pg_temp.gcid(n integer) returns uuid language sql immutable as $$
  select ('f4260000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
do $preflight$
begin
  if inet_server_addr() is null or inet_server_port() is null
    or inet_server_port() not between 1 and 65535
    or inet_server_addr() <<= inet '127.0.0.0/8'
    or inet_server_addr() in (inet '0.0.0.0',inet '::',inet '::1')
    or current_database() !~ '^[A-Za-z0-9_]+$'
    then raise exception 'synthetic_methodology_requires_verified_tcp_server'; end if;
  if exists(select 1 from identity.user_account where user_account_id::text like 'f4260000-%')
    or exists(select 1 from methodology.methodology_context_pack where methodology_context_pack_id::text like 'f4260000-%')
    or exists(select 1 from methodology.methodology_context_pack_version where methodology_context_pack_version_id::text like 'f4260000-%')
    or exists(select 1 from methodology.workflow_operation where operation_id::text like 'f4260000-%')
    or exists(select 1 from methodology.screen_attempt where screen_operation_id::text like 'f4260000-%')
    or exists(select 1 from audit.audit_event where target_entity_id::text like 'f4260000-%')
    or exists(select 1 from ai.ai_model_invocation where ai_model_invocation_id::text like 'f4260000-%')
    then raise exception 'synthetic_methodology_concurrency_residue'; end if;
end $preflight$;

begin;
insert into identity.user_account(user_account_id,display_name,account_status) values
  (pg_temp.gcid(2),'Synthetic concurrency Guide','active'),(pg_temp.gcid(3),'Synthetic concurrency Admin','active');
insert into identity.user_role_assignment(user_role_assignment_id,user_account_id,role_code,role_status) values
  (pg_temp.gcid(12),pg_temp.gcid(2),'guide','active'),(pg_temp.gcid(13),pg_temp.gcid(3),'admin','active');
insert into core.guide_profile(guide_profile_id,user_account_id,guide_display_name,setup_status,approved_by_user_account_id,approved_at,status)
  values(pg_temp.gcid(23),pg_temp.gcid(2),'Synthetic concurrency Guide','approved',pg_temp.gcid(3),now(),'active');
insert into identity.user_session(user_session_id,user_account_id,active_role_context,created_at,expires_at,session_status) values
  (pg_temp.gcid(56),pg_temp.gcid(2),'guide',now()-interval '1 hour',now()+interval '1 hour','active'),
  (pg_temp.gcid(57),pg_temp.gcid(3),'admin',now()-interval '1 hour',now()+interval '1 hour','active');
do $$
declare n integer; sha text;
begin
  for n in 1001..1003 loop
    perform public.solmind_register_methodology_version(pg_temp.gcid(3),pg_temp.gcid(57),pg_temp.gcid(n+1000),
      pg_temp.gcid(1000),pg_temp.gcid(n),pg_temp.gcid(23),case when n=1001 then null else pg_temp.gcid(n-1) end,
      'Synthetic concurrent pack','Synthetic concurrent version '||n||'.','admin_assisted','Synthetic fixture',
      '[{"source":"synthetic local only"}]','Synthetic summary.');
    if n>1001 then
      select content_sha256 into sha from methodology.methodology_context_pack_version where methodology_context_pack_version_id=pg_temp.gcid(n);
      perform public.solmind_prepare_methodology_screen(pg_temp.gcid(3),pg_temp.gcid(57),pg_temp.gcid(n+2000),pg_temp.gcid(1000),pg_temp.gcid(n),
        pg_temp.gcid(n+3000),sha,'synthetic-policy.v1',repeat('B',64),repeat('C',64),'gpt-5.6-luna');
      perform public.solmind_record_methodology_screen(pg_temp.gcid(n+2000),pg_temp.gcid(n+3000),pg_temp.gcid(n),sha,repeat('C',64),'completed',
        jsonb_build_object('result','pass','subject_sha256',sha,'findings','[]'::jsonb));
      perform public.solmind_confirm_methodology_admin_review(pg_temp.gcid(3),pg_temp.gcid(57),pg_temp.gcid(n+4000),pg_temp.gcid(1000),pg_temp.gcid(n),sha,pg_temp.gcid(n+3000));
    end if;
  end loop;
end $$;
commit;

begin;
select no_plan();
create function pg_temp.register_sql(n integer,previous_n integer,op_n integer) returns text language sql as $$
  select format($q$select * from public.solmind_register_methodology_version(%L::uuid,%L::uuid,%L::uuid,
    %L::uuid,%L::uuid,%L::uuid,%L::uuid,'Synthetic concurrent pack',%L,'admin_assisted','Synthetic fixture',
    '[{"source":"synthetic local only"}]'::jsonb,'Synthetic summary.')$q$,
    pg_temp.gcid(3),pg_temp.gcid(57),pg_temp.gcid(op_n),pg_temp.gcid(1000),pg_temp.gcid(n),pg_temp.gcid(23),pg_temp.gcid(previous_n),
    'Synthetic concurrent version '||n||'.')
$$;
create function pg_temp.wait_for_lock(connection_name text,backend integer) returns boolean language plpgsql as $$
begin
  for attempt in 1..20 loop
    perform pg_stat_clear_snapshot();
    if dblink_is_busy(connection_name)=1 and exists(select 1 from pg_stat_activity where pid=backend and wait_event_type='Lock')
      then return true; end if;
    perform pg_sleep(0.025);
  end loop;
  return false;
end $$;
select lives_ok(format($q$select dblink_connect('methodology_governance_a',
  'hostaddr=%s port=%s dbname=%s user=postgres password=postgres connect_timeout=5')$q$,inet_server_addr(),inet_server_port(),current_database()),'same disposable database worker A opens');
select lives_ok(format($q$select dblink_connect('methodology_governance_b',
  'hostaddr=%s port=%s dbname=%s user=postgres password=postgres connect_timeout=5')$q$,inet_server_addr(),inet_server_port(),current_database()),'same disposable database worker B opens');
select is(dblink_exec('methodology_governance_a','set statement_timeout=''8s'''),'SET','worker A has bounded statement timeout');
select is(dblink_exec('methodology_governance_b','set statement_timeout=''8s'''),'SET','worker B has bounded statement timeout');
select is(dblink_exec('methodology_governance_a','set role service_role'),'SET','worker A uses only closed service-role RPCs');
select is(dblink_exec('methodology_governance_b','set role service_role'),'SET','worker B uses only closed service-role RPCs');
create temp table worker_pids as select 'a'::text name,r.* from dblink('methodology_governance_a',
  'select pg_backend_pid(),current_database(),inet_server_addr(),inet_server_port(),pg_postmaster_start_time()')
  r(pid integer,database_name text,server_address inet,server_port integer,postmaster_started timestamptz)
  union all select 'b',r.* from dblink('methodology_governance_b',
  'select pg_backend_pid(),current_database(),inet_server_addr(),inet_server_port(),pg_postmaster_start_time()')
  r(pid integer,database_name text,server_address inet,server_port integer,postmaster_started timestamptz);
select ok((select bool_and(database_name=current_database() and server_address=inet_server_addr()
  and server_port=inet_server_port() and postmaster_started=pg_postmaster_start_time()) from worker_pids),
  'both workers verify the exact current database/server incarnation before any race');
select is((select count(distinct pid)::integer from worker_pids),2,'two independent real database sessions participate');

-- Screen admission is a distinct operation family: an actual overlapping
-- exact retry must never produce a second dispatch allowance or invocation.
create function pg_temp.screen_start_sql() returns text language sql as $$
  select format($q$select * from public.solmind_prepare_methodology_screen(%L::uuid,%L::uuid,%L::uuid,
    %L::uuid,%L::uuid,%L::uuid,%L,'synthetic-policy.v1',%L,%L,'gpt-5.6-luna')$q$,
    pg_temp.gcid(3),pg_temp.gcid(57),pg_temp.gcid(3001),pg_temp.gcid(1000),pg_temp.gcid(1001),pg_temp.gcid(4001),
    v.content_sha256,repeat('B',64),repeat('C',64))
  from methodology.methodology_context_pack_version v where v.methodology_context_pack_version_id=pg_temp.gcid(1001)
$$;
select is(dblink_exec('methodology_governance_a','begin'),'BEGIN','screen-start A begins');
select is(dblink_exec('methodology_governance_b','begin'),'BEGIN','screen-start B begins');
select ok((select outcome='ok' and dispatch_permitted from dblink('methodology_governance_a',pg_temp.screen_start_sql())
  r(outcome text,invocation_id uuid,dispatch_permitted boolean)),'screen A alone receives first dispatch allowance');
select is(dblink_send_query('methodology_governance_b',pg_temp.screen_start_sql()),1,'exact screen B actually overlaps A');
select ok(pg_temp.wait_for_lock('methodology_governance_b',(select pid from worker_pids where name='b')),
  'screen B is observed waiting on the exact operation lock');
select is(dblink_exec('methodology_governance_a','commit'),'COMMIT','screen A commits its single pre-I/O receipt');
select ok((select outcome='exact_replay' and not dispatch_permitted from dblink_get_result('methodology_governance_b')
  r(outcome text,invocation_id uuid,dispatch_permitted boolean)),'overlapping exact screen B never receives dispatch permission');
select is((select count(*)::integer from dblink_get_result('methodology_governance_b')
  r(outcome text,invocation_id uuid,dispatch_permitted boolean)),0,'screen B asynchronous stream drains');
select is(dblink_exec('methodology_governance_b','commit'),'COMMIT','screen B commits no second effect');
select ok((select count(*)=1 from methodology.screen_attempt where methodology_context_pack_version_id=pg_temp.gcid(1001))
  and (select count(*)=1 from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gcid(4001))
  and (select count(*)=1 from audit.audit_event where event_type='methodology_context_pack_screen_started'
    and target_entity_id=pg_temp.gcid(1001)),'screen overlap leaves one attempt, invocation and start audit');

-- Once-only terminal settlement has its own actual overlap, with an artificial
-- local pass only. This cannot prove a provider call or semantic safety.
create function pg_temp.screen_terminal_sql() returns text language sql as $$
  select format($q$select * from public.solmind_record_methodology_screen(%L::uuid,%L::uuid,%L::uuid,
    %L,%L,'completed',%L::jsonb)$q$,pg_temp.gcid(3001),pg_temp.gcid(4001),pg_temp.gcid(1001),v.content_sha256,repeat('C',64),
    jsonb_build_object('result','pass','subject_sha256',v.content_sha256,'findings','[]'::jsonb)::text)
  from methodology.methodology_context_pack_version v where v.methodology_context_pack_version_id=pg_temp.gcid(1001)
$$;
select is(dblink_exec('methodology_governance_a','begin'),'BEGIN','screen-terminal A begins');
select is(dblink_exec('methodology_governance_b','begin'),'BEGIN','screen-terminal B begins');
select is((select outcome from dblink('methodology_governance_a',pg_temp.screen_terminal_sql()) r(outcome text)),
  'ok','screen-terminal A settles exact synthetic pass');
select is(dblink_send_query('methodology_governance_b',pg_temp.screen_terminal_sql()),1,'screen-terminal B actually overlaps A');
select ok(pg_temp.wait_for_lock('methodology_governance_b',(select pid from worker_pids where name='b')),
  'screen-terminal B waits on actual settlement lock');
select is(dblink_exec('methodology_governance_a','commit'),'COMMIT','terminal A commits one completed result');
select is((select outcome from dblink_get_result('methodology_governance_b') r(outcome text)),
  'exact_replay','terminal B receives exact replay after the overlap');
select is((select count(*)::integer from dblink_get_result('methodology_governance_b') r(outcome text)),0,
  'terminal B asynchronous stream drains');
select is(dblink_exec('methodology_governance_b','commit'),'COMMIT','terminal B commits no duplicate effect');
select ok((select terminal_status='completed' from methodology.screen_attempt where screen_operation_id=pg_temp.gcid(3001))
  and (select count(*)=1 from audit.audit_event where event_type='context_pack_safety_screen'
    and target_entity_id=pg_temp.gcid(1001)),'terminal overlap leaves one completed receipt and one exact audit');

-- Same operation: B must actually wait, then return exact replay without any
-- additional version, ledger or audit. No sequential-only simulation.
select is(dblink_exec('methodology_governance_a','begin'),'BEGIN','same-operation A transaction begins');
select is(dblink_exec('methodology_governance_b','begin'),'BEGIN','same-operation B transaction begins');
select is((select outcome from dblink('methodology_governance_a',pg_temp.register_sql(1004,1003,2004))
  r(outcome text,version_id uuid,version_number integer,sha text)),'ok','A registers pending version before commit');
select is(dblink_send_query('methodology_governance_b',pg_temp.register_sql(1004,1003,2004)),1,'same exact operation B starts concurrently');
select ok(pg_temp.wait_for_lock('methodology_governance_b',(select pid from worker_pids where name='b')),
  'B is observed waiting on an actual database lock');
select is(dblink_exec('methodology_governance_a','commit'),'COMMIT','A commits original version');
select is((select outcome from dblink_get_result('methodology_governance_b') r(outcome text,version_id uuid,version_number integer,sha text)),
  'exact_replay','B sees exact replay after real overlap');
select is((select count(*)::integer from dblink_get_result('methodology_governance_b') r(outcome text,version_id uuid,version_number integer,sha text)),
  0,'same-operation asynchronous result stream is drained');
select is(dblink_exec('methodology_governance_b','commit'),'COMMIT','same-operation B commits no additional effect');
select is((select count(*)::integer from methodology.methodology_context_pack_version where methodology_context_pack_id=pg_temp.gcid(1000)),4,
  'same-operation race leaves exactly one additional immutable version');
select is((select count(*)::integer from audit.audit_event where event_type='methodology_context_pack_version_created' and target_entity_id=pg_temp.gcid(1004)),1,
  'same-operation race leaves one registration audit');

-- Different operations with the same predecessor cannot both acquire number5.
select is(dblink_exec('methodology_governance_a','begin'),'BEGIN','sequential-number A begins');
select is(dblink_exec('methodology_governance_b','begin'),'BEGIN','sequential-number B begins');
select is((select outcome from dblink('methodology_governance_a',pg_temp.register_sql(1005,1004,2005))
  r(outcome text,version_id uuid,version_number integer,sha text)),'ok','A registers next candidate while holding transaction');
select is(dblink_send_query('methodology_governance_b',pg_temp.register_sql(1006,1004,2006)),1,'B races distinct operation with same predecessor');
select ok(pg_temp.wait_for_lock('methodology_governance_b',(select pid from worker_pids where name='b')),'different-operation B genuinely overlaps A');
select is(dblink_exec('methodology_governance_a','commit'),'COMMIT','A commits sequential winner');
select is((select count(*)::integer from dblink_get_result('methodology_governance_b',false)
  r(outcome text,version_id uuid,version_number integer,sha text)),0,'losing stale predecessor returns no row');
select matches(dblink_error_message('methodology_governance_b'),'solmind_methodology_operation_conflict',
  'losing distinct operation receives closed conflict');
select is((select count(*)::integer from dblink_get_result('methodology_governance_b',false)
  r(outcome text,version_id uuid,version_number integer,sha text)),0,'losing async stream is drained');
select is(dblink_exec('methodology_governance_b','rollback'),'ROLLBACK','losing operation is rolled back');
select ok((select version_number=5 from methodology.methodology_context_pack_version where methodology_context_pack_version_id=pg_temp.gcid(1005))
  and not exists(select 1 from methodology.methodology_context_pack_version where methodology_context_pack_version_id=pg_temp.gcid(1006)),
  'only one exact fifth version exists');
select ok(not exists(select 1 from methodology.workflow_operation where operation_id=pg_temp.gcid(2006))
  and not exists(select 1 from audit.audit_event where target_entity_id=pg_temp.gcid(1006)), 'loser leaves no ledger or audit');
create function pg_temp.approve_sql(n integer,op_n integer) returns text language sql as $$
  select format($q$select * from public.solmind_decide_methodology_guide_review(%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L::uuid,
    %L,%L::uuid,%L::uuid,null,'approve',
    'This content does not instruct the AI to act as a clinician, conceal information, or alter safety behavior.',true)$q$,
    pg_temp.gcid(2),pg_temp.gcid(56),pg_temp.gcid(op_n),pg_temp.gcid(1000),pg_temp.gcid(n),v.content_sha256,
    pg_temp.gcid(n+3000),v.admin_consistency_audit_event_id)
  from methodology.methodology_context_pack_version v where v.methodology_context_pack_version_id=pg_temp.gcid(n)
$$;
select is(dblink_exec('methodology_governance_a','begin'),'BEGIN','activation A begins');
select is(dblink_exec('methodology_governance_b','begin'),'BEGIN','activation B begins');
select is((select outcome from dblink('methodology_governance_a',pg_temp.approve_sql(1002,6002))
  r(outcome text,approval_audit uuid,activation_audit uuid)),'ok','A approves one candidate atomically before commit');
select is(dblink_send_query('methodology_governance_b',pg_temp.approve_sql(1003,6003)),1,'B races another candidate with expected empty pointer');
select ok(pg_temp.wait_for_lock('methodology_governance_b',(select pid from worker_pids where name='b')),'Guide activation B genuinely waits');
select is(dblink_exec('methodology_governance_a','commit'),'COMMIT','A commits approval and effective pointer together');
select is((select count(*)::integer from dblink_get_result('methodology_governance_b',false)
  r(outcome text,approval_audit uuid,activation_audit uuid)),0,'stale expected-active loser returns no approval');
select matches(dblink_error_message('methodology_governance_b'),'solmind_methodology_operation_conflict',
  'activation loser receives fixed pointer conflict');
select is((select count(*)::integer from dblink_get_result('methodology_governance_b',false)
  r(outcome text,approval_audit uuid,activation_audit uuid)),0,'activation asynchronous stream is drained');
select is(dblink_exec('methodology_governance_b','rollback'),'ROLLBACK','losing activation rolls back');
select ok((select active_version_id=pg_temp.gcid(1002) from methodology.methodology_context_pack where methodology_context_pack_id=pg_temp.gcid(1000))
  and (select approval_status='needs_guide_review' and approved_at is null from methodology.methodology_context_pack_version
    where methodology_context_pack_version_id=pg_temp.gcid(1003)), 'one winner effective; losing candidate still awaits Guide');
select is((select count(*)::integer from audit.audit_event where event_type='methodology_context_pack_guide_approved'
  and target_entity_id in (pg_temp.gcid(1002),pg_temp.gcid(1003))),1,'race produces one Guide approval audit');
select is((select count(*)::integer from audit.audit_event where event_type='methodology_context_pack_version_activated'
  and target_entity_id in (pg_temp.gcid(1002),pg_temp.gcid(1003))),1,'race produces one atomic activation audit');
select ok(not exists(select 1 from methodology.workflow_operation where operation_id=pg_temp.gcid(6003)),
  'losing activation has no operation ledger effect');
select lives_ok($$select dblink_disconnect('methodology_governance_a')$$,'worker A closes');
select lives_ok($$select dblink_disconnect('methodology_governance_b')$$,'worker B closes');

-- Owner-only fixture cleanup in one transaction. Triggers are disabled only
-- while deleting this preflight-reserved namespace and re-enabled before commit;
-- a cleanup error rolls back both fixture changes and trigger-state changes.
-- Flush and make the existing deferred receipt FK immediate before owner-only
-- deletion. Its pending delete-trigger events must not block trigger restoration.
-- All actual workflow writes above committed with the original constraint mode.
set constraints all immediate;
alter table methodology.methodology_context_pack_version disable trigger methodology_version_immutable_content;
alter table methodology.methodology_context_pack disable trigger methodology_pack_identity_immutable;
alter table methodology.workflow_operation disable trigger methodology_operation_append_only;
alter table methodology.screen_attempt disable trigger methodology_screen_attempt_once;
alter table audit.audit_event disable trigger methodology_closed_audit_immutable;
update methodology.methodology_context_pack set pack_status='draft',active_version_id=null where methodology_context_pack_id=pg_temp.gcid(1000);
delete from methodology.screen_attempt where screen_operation_id::text like 'f4260000-%';
delete from methodology.workflow_operation where actor_user_account_id in (pg_temp.gcid(2),pg_temp.gcid(3));
delete from methodology.methodology_context_pack_version where methodology_context_pack_id=pg_temp.gcid(1000);
delete from methodology.methodology_context_pack where methodology_context_pack_id=pg_temp.gcid(1000);
delete from ai.ai_model_invocation where ai_model_invocation_id::text like 'f4260000-%';
delete from audit.audit_event where target_entity_id::text like 'f4260000-%';
delete from identity.user_session where user_account_id in (pg_temp.gcid(2),pg_temp.gcid(3));
delete from core.guide_profile where guide_profile_id=pg_temp.gcid(23);
delete from identity.user_role_assignment where user_account_id in (pg_temp.gcid(2),pg_temp.gcid(3));
delete from identity.user_account where user_account_id in (pg_temp.gcid(2),pg_temp.gcid(3));
alter table methodology.methodology_context_pack_version enable trigger methodology_version_immutable_content;
alter table methodology.methodology_context_pack enable trigger methodology_pack_identity_immutable;
alter table methodology.workflow_operation enable trigger methodology_operation_append_only;
alter table methodology.screen_attempt enable trigger methodology_screen_attempt_once;
alter table audit.audit_event enable trigger methodology_closed_audit_immutable;
select ok(not exists(select 1 from identity.user_account where user_account_id::text like 'f4260000-%')
  and not exists(select 1 from methodology.methodology_context_pack where methodology_context_pack_id::text like 'f4260000-%')
  and not exists(select 1 from methodology.methodology_context_pack_version where methodology_context_pack_version_id::text like 'f4260000-%')
  and not exists(select 1 from methodology.screen_attempt where screen_operation_id::text like 'f4260000-%')
  and not exists(select 1 from methodology.workflow_operation where operation_id::text like 'f4260000-%')
  and not exists(select 1 from ai.ai_model_invocation where ai_model_invocation_id::text like 'f4260000-%')
  and not exists(select 1 from audit.audit_event where target_entity_id::text like 'f4260000-%'), 'all reserved committed fixture rows are removed');
select ok(not exists(select 1 from pg_trigger where tgname in ('methodology_version_immutable_content','methodology_pack_identity_immutable',
  'methodology_operation_append_only','methodology_screen_attempt_once','methodology_closed_audit_immutable') and tgenabled='D'),
  'all temporarily disabled owner-cleanup triggers are restored');
select * from finish();
commit;
