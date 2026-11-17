-- Requirement 46: four different Waypoints, two contenders, one fifth.
-- Executor only: isolated local test database with dblink available. The setup
-- backend commits synthetic rows so both contenders can use real authority.
-- Reserved UUID range: f46c0000-0000-4000-8000-000000000001 through
-- f46c0000-0000-4000-8000-000000000106 (unused by the other tests in this copy).
-- Cleanup uses fixed IDs plus Waypoints and operations of the reserved conversation.
-- Rerunning recovers this file only; earlier files can still fail until cleanup.
-- run serially; never in parallel with other test files
begin;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
set local search_path=public,extensions,pg_catalog,pg_temp;
set local statement_timeout='30s';
select plan(33);

select lives_ok(format($q$select dblink_connect('five_waypoints_setup',
  'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5')$q$,
  current_database()),'the third connection opens for committed setup and cleanup');

select is(dblink_exec('five_waypoints_setup',$remote$
  set statement_timeout='10s';
  set lock_timeout='2000ms';
  set default_transaction_isolation='read committed';
  create function pg_temp.gid(n integer) returns uuid language sql immutable as $body$
    select ('f46c0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
  $body$;
  create function pg_temp.fixture_rows() returns bigint language sql as $body$
    select sum(n)::bigint from (
      select count(*) n from content.waypoint where waypoint_id in
        (pg_temp.gid(101),pg_temp.gid(102),pg_temp.gid(103),pg_temp.gid(104),pg_temp.gid(105),pg_temp.gid(106))
        or source_ai_interaction_session_id=pg_temp.gid(51)
      union all select count(*) from ai.explorer_conversation_operation where actor_user_account_id=pg_temp.gid(1)
        and (operation_id in (pg_temp.gid(101),pg_temp.gid(102),pg_temp.gid(103),pg_temp.gid(104),pg_temp.gid(105),pg_temp.gid(106))
          or conversation_id=pg_temp.gid(51))
      union all select count(*) from ai.ai_interaction_message where ai_interaction_message_id=pg_temp.gid(61)
      union all select count(*) from ai.explorer_conversation_state where conversation_id=pg_temp.gid(51)
      union all select count(*) from ai.ai_interaction_session where ai_interaction_session_id=pg_temp.gid(51)
      union all select count(*) from core.intake_response_set where intake_response_set_id=pg_temp.gid(52)
      union all select count(*) from core.consent_record where consent_record_id in (pg_temp.gid(41),pg_temp.gid(42))
      union all select count(*) from core.consent_document where consent_document_id in (pg_temp.gid(31),pg_temp.gid(32))
      union all select count(*) from identity.user_session where user_session_id=pg_temp.gid(50)
      union all select count(*) from core.guide_explorer_relationship where guide_explorer_relationship_id=pg_temp.gid(25)
      union all select count(*) from core.explorer_profile where explorer_profile_id=pg_temp.gid(24)
      union all select count(*) from core.guide_profile where guide_profile_id=pg_temp.gid(23)
      union all select count(*) from core.practice where practice_id=pg_temp.gid(22)
      union all select count(*) from core.organization where organization_id=pg_temp.gid(21)
      union all select count(*) from identity.user_role_assignment where user_role_assignment_id in
        (pg_temp.gid(11),pg_temp.gid(12),pg_temp.gid(13))
      union all select count(*) from identity.user_account where user_account_id in
        (pg_temp.gid(1),pg_temp.gid(2),pg_temp.gid(3))
    ) counts
  $body$;
  create function pg_temp.cleanup_fixture() returns void language plpgsql as $body$
  begin
    -- The only delete guards that obstruct these synthetic rows. No foreign
    -- keys or formation guards are disabled. This whole call is one transaction;
    -- an error rolls back the deletes and the trigger changes together.
    set constraints all immediate;
    if (select count(*) from pg_catalog.pg_trigger where tgenabled='O' and
        ((tgrelid='content.waypoint'::regclass and tgname='waypoint_history_guard')
          or (tgrelid='ai.explorer_conversation_state'::regclass and tgname='explorer_private_state_guard')))<>2 then
      raise exception 'synthetic_five_waypoints_cleanup_guards_unavailable';
    end if;
    alter table content.waypoint disable trigger waypoint_history_guard;
    alter table ai.explorer_conversation_state disable trigger explorer_private_state_guard;
    delete from content.waypoint where waypoint_id in
      (pg_temp.gid(101),pg_temp.gid(102),pg_temp.gid(103),pg_temp.gid(104),pg_temp.gid(105),pg_temp.gid(106))
      or source_ai_interaction_session_id=pg_temp.gid(51);
    delete from ai.explorer_conversation_operation where actor_user_account_id=pg_temp.gid(1)
      and (operation_id in (pg_temp.gid(101),pg_temp.gid(102),pg_temp.gid(103),pg_temp.gid(104),pg_temp.gid(105),pg_temp.gid(106))
        or conversation_id=pg_temp.gid(51));
    delete from ai.ai_interaction_message where ai_interaction_message_id=pg_temp.gid(61);
    delete from ai.explorer_conversation_state where conversation_id=pg_temp.gid(51);
    delete from ai.ai_interaction_session where ai_interaction_session_id=pg_temp.gid(51);
    delete from core.intake_response_set where intake_response_set_id=pg_temp.gid(52);
    delete from core.consent_record where consent_record_id in (pg_temp.gid(41),pg_temp.gid(42));
    delete from core.consent_document where consent_document_id in (pg_temp.gid(31),pg_temp.gid(32));
    delete from identity.user_session where user_session_id=pg_temp.gid(50);
    delete from core.guide_explorer_relationship where guide_explorer_relationship_id=pg_temp.gid(25);
    delete from core.explorer_profile where explorer_profile_id=pg_temp.gid(24);
    delete from core.guide_profile where guide_profile_id=pg_temp.gid(23);
    delete from core.practice where practice_id=pg_temp.gid(22);
    delete from core.organization where organization_id=pg_temp.gid(21);
    delete from identity.user_role_assignment where user_role_assignment_id in
      (pg_temp.gid(11),pg_temp.gid(12),pg_temp.gid(13));
    delete from identity.user_account where user_account_id in (pg_temp.gid(1),pg_temp.gid(2),pg_temp.gid(3));
    alter table content.waypoint enable trigger waypoint_history_guard;
    alter table ai.explorer_conversation_state enable trigger explorer_private_state_guard;
  end $body$
$remote$),'CREATE FUNCTION','setup installs temporary fixed-ID fixture and cleanup helpers');

select is(dblink_exec('five_waypoints_setup',
  'do $body$ begin perform pg_temp.cleanup_fixture(); end $body$'),
  'DO','setup removes and commits only leftovers belonging to this test');
select is((select n from dblink('five_waypoints_setup','select pg_temp.fixture_rows()') r(n bigint)),
  0::bigint,'no reserved fixture rows remain before setup');

select is(dblink_exec('five_waypoints_setup',$remote$
  begin isolation level read committed;
  do $body$ begin
    if exists(select 1 from core.consent_document
      where document_status='active' and
        (is_required_for_explorer is true or consent_type in ('user_agreement','ai_disclosure'))) then
      raise exception 'synthetic_five_waypoints_fixture_requires_isolated_consent_state';
    end if;
  end $body$;
  insert into identity.user_account(user_account_id,display_name,account_status) values
    (pg_temp.gid(1),'Synthetic Five Waypoints Explorer','active'),
    (pg_temp.gid(2),'Synthetic Five Waypoints Guide','active'),
    (pg_temp.gid(3),'Synthetic Five Waypoints Admin','active');
  insert into identity.user_role_assignment(user_role_assignment_id,user_account_id,role_code,role_status) values
    (pg_temp.gid(11),pg_temp.gid(1),'explorer','active'),
    (pg_temp.gid(12),pg_temp.gid(2),'guide','active'),
    (pg_temp.gid(13),pg_temp.gid(3),'admin','active');
  insert into core.organization(organization_id,organization_name,approval_status,approved_by_user_account_id,approved_at)
    values(pg_temp.gid(21),'Synthetic Five Waypoints Organization','approved',pg_temp.gid(3),now());
  insert into core.practice(practice_id,organization_id,practice_name,approval_status,approved_by_user_account_id,approved_at)
    values(pg_temp.gid(22),pg_temp.gid(21),'Synthetic Five Waypoints Practice','approved',pg_temp.gid(3),now());
  insert into core.guide_profile(guide_profile_id,user_account_id,guide_display_name,setup_status,approved_by_user_account_id,approved_at,status)
    values(pg_temp.gid(23),pg_temp.gid(2),'Synthetic Five Waypoints Guide','approved',pg_temp.gid(3),now(),'active');
  insert into core.explorer_profile(explorer_profile_id,user_account_id,explorer_display_name,onboarding_status,status)
    values(pg_temp.gid(24),pg_temp.gid(1),'Synthetic Five Waypoints Explorer','active','active');
  insert into core.guide_explorer_relationship(guide_explorer_relationship_id,guide_profile_id,explorer_profile_id,practice_id,relationship_status,started_at)
    values(pg_temp.gid(25),pg_temp.gid(23),pg_temp.gid(24),pg_temp.gid(22),'active',now());
  insert into core.consent_document(consent_document_id,consent_type,version_number,version_label,title,body_markdown,
    document_status,is_required_for_explorer,effective_at,created_by_user_account_id) values
    (pg_temp.gid(31),'user_agreement',9460,'synthetic-five-waypoints-9460','Synthetic Agreement','SQL fixture only.','active',true,now(),pg_temp.gid(3)),
    (pg_temp.gid(32),'ai_disclosure',9460,'synthetic-five-waypoints-9460','Synthetic AI Disclosure','SQL fixture only.','active',true,now(),pg_temp.gid(3));
  insert into core.consent_record(consent_record_id,user_account_id,role_context,consent_type,document_version,consent_document_id,adult_affirmation) values
    (pg_temp.gid(41),pg_temp.gid(1),'explorer','user_agreement','synthetic-five-waypoints-9460',pg_temp.gid(31),true),
    (pg_temp.gid(42),pg_temp.gid(1),'explorer','ai_disclosure','synthetic-five-waypoints-9460',pg_temp.gid(32),true);
  insert into identity.user_session(user_session_id,user_account_id,active_role_context,created_at,expires_at,session_status)
    values(pg_temp.gid(50),pg_temp.gid(1),'explorer',now()-interval '2 hours',now()+interval '1 hour','active');
  insert into core.intake_response_set(intake_response_set_id,guide_explorer_relationship_id,started_at,completed_at,intake_status,response_json)
    values(pg_temp.gid(52),pg_temp.gid(25),now()-interval '1 hour',now(),'completed',
      '{"supportNow":"Synthetic support","usefulOutcome":"Synthetic outcome","supportStyle":"Synthetic style"}');
  insert into ai.ai_interaction_session(ai_interaction_session_id,session_type,actor_user_account_id,actor_role_context,
    guide_profile_id,explorer_profile_id,guide_explorer_relationship_id,practice_id,metadata)
    values(pg_temp.gid(51),'explorer_reflection',pg_temp.gid(1),'explorer',pg_temp.gid(23),pg_temp.gid(24),pg_temp.gid(25),
      pg_temp.gid(22),'{"restricted_mode":false}');
  insert into ai.explorer_conversation_state(conversation_id,actor_user_account_id,safety_contract_version,
    restricted_level,adult_reflection_stopped,safety_version)
    values(pg_temp.gid(51),pg_temp.gid(1),'explorer-conversation-safety.v1',null,false,0);
  insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
    sender_type,sender_user_account_id,sender_role_context,content_text)
    values(pg_temp.gid(61),pg_temp.gid(51),1,'user',pg_temp.gid(1),'explorer','Synthetic source for six distinct choices.');
  -- Form the four originals through the same real RPC, not a capacity helper.
  do $body$
  declare n integer; result text;
  begin
    for n in 101..104 loop
      select r.outcome into result from public.solmind_mutate_explorer_conversation_v3(
        pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(51),pg_temp.gid(n),n-101,
        'confirm_waypoint',repeat('C',64),pg_temp.gid(61),null,null,null,
        'Synthetic starting destination '||n,'Synthetic starting meaning '||n,'Synthetic starting signal '||n,null) r;
      if result is distinct from 'ok' then raise exception 'synthetic_five_waypoints_fixture_formation_failed'; end if;
    end loop;
  end $body$;
  commit
$remote$),'COMMIT','setup commits one complete Explorer, one conversation and four real formations');

select lives_ok(format($q$select dblink_connect('five_waypoints_a',
  'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5')$q$,
  current_database()),'connection A opens');
select lives_ok(format($q$select dblink_connect('five_waypoints_b',
  'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5')$q$,
  current_database()),'connection B opens separately');
select ok((select a.pid<>b.pid and a.pid<>s.pid and b.pid<>s.pid
  from dblink('five_waypoints_a','select pg_backend_pid()',false) a(pid integer)
  cross join dblink('five_waypoints_b','select pg_backend_pid()',false) b(pid integer)
  cross join dblink('five_waypoints_setup','select pg_backend_pid()',false) s(pid integer)),
  'A, B and setup are three distinct PostgreSQL backends');

-- Two assertions, one per contender. Keep only outcome/refusal text, never the
-- conversation JSON, exception detail or context. WHEN OTHERS excludes statement
-- timeouts; fail_on_error=false also keeps those remote errors from aborting the
-- outer pgTAP transaction before cleanup.
select is(dblink_exec(connection_name,$remote$
  set statement_timeout='10s';
  set default_transaction_isolation='read committed';
  create function pg_temp.waypoint_try(command text) returns text language plpgsql as $body$
  declare result text;
  begin
    execute command into result;
    return coalesce(result,'unexpected_no_outcome');
  exception when others then return sqlerrm;
  end $body$
$remote$,false),'CREATE FUNCTION',connection_name||' installs a local value-free result and exception capture')
from (values ('five_waypoints_a'),('five_waypoints_b')) connections(connection_name);

select ok((select n=4 and roots=4 and destinations=4 from dblink('five_waypoints_setup',$remote$
  select count(*)::integer,count(*) filter(where predecessor_waypoint_id is null)::integer,
    count(distinct destination)::integer from content.waypoint
  where source_ai_interaction_session_id=pg_temp.gid(51) and chosen_by_explorer_user_account_id=pg_temp.gid(1)
$remote$,false) r(n integer,roots integer,destinations integer)),
  'the committed starting conversation has four different original Waypoints');
select is((select revision from dblink('five_waypoints_setup',$remote$
  select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(51)
$remote$,false) r(revision integer)),4,'four real starting formations advanced the revision to four');

select is(dblink_exec('five_waypoints_a','begin isolation level read committed',false),'BEGIN','A begins an open formation transaction');
select is((select result from dblink('five_waypoints_a',$remote$select pg_temp.waypoint_try(
  $$select outcome from public.solmind_mutate_explorer_conversation_v3(
    'f46c0000-0000-4000-8000-000000000001','f46c0000-0000-4000-8000-000000000050',
    'f46c0000-0000-4000-8000-000000000051','f46c0000-0000-4000-8000-000000000105',4,
    'confirm_waypoint',repeat('A',64),'f46c0000-0000-4000-8000-000000000061',null,null,null,
    'Synthetic fifth destination A','Synthetic fifth meaning A','Synthetic fifth signal A',null)$$)
$remote$,false) r(result text)),'ok','A forms the fifth through the current public RPC and keeps its transaction open');
select is((select n from dblink('five_waypoints_a',$remote$
  select count(*)::integer from content.waypoint
  where source_ai_interaction_session_id='f46c0000-0000-4000-8000-000000000051'
$remote$,false) r(n integer)),5,'A sees its own uncommitted fifth');
select is((select n from dblink('five_waypoints_b',$remote$
  select count(*)::integer from content.waypoint
  where source_ai_interaction_session_id='f46c0000-0000-4000-8000-000000000051'
$remote$,false) r(n integer)),4,'B still sees four while A retains the fifth and its transaction locks');

-- A has not committed. B uses a distinct operation/Waypoint ID and wording,
-- with the same revision four that was valid when both saw four Waypoints.
select is((select result from dblink('five_waypoints_b',$remote$select pg_temp.waypoint_try(
  $$select outcome from public.solmind_mutate_explorer_conversation_v3(
    'f46c0000-0000-4000-8000-000000000001','f46c0000-0000-4000-8000-000000000050',
    'f46c0000-0000-4000-8000-000000000051','f46c0000-0000-4000-8000-000000000106',4,
    'confirm_waypoint',repeat('B',64),'f46c0000-0000-4000-8000-000000000061',null,null,null,
    'Synthetic fifth destination B','Synthetic fifth meaning B','Synthetic fifth signal B',null)$$)
$remote$,false) r(result text)),'solmind_explorer_private_unavailable',
  'B is refused specifically by the owner lock while A holds its uncommitted fifth');
select is(dblink_exec('five_waypoints_a','commit',false),'COMMIT','A commits the only winning fifth');
select is((select n from dblink('five_waypoints_setup',$remote$
  select count(*)::integer from content.waypoint where source_ai_interaction_session_id=pg_temp.gid(51)
$remote$,false) r(n integer)),5,'the committed conversation has five Waypoints after the overlap');
select is((select n from dblink('five_waypoints_setup',$remote$
  select count(*)::integer from content.waypoint where source_ai_interaction_session_id=pg_temp.gid(51)
    and waypoint_id in (pg_temp.gid(105),pg_temp.gid(106))
$remote$,false) r(n integer)),1,'exactly one of the two competing new Waypoints committed');
select is((select revision from dblink('five_waypoints_setup',$remote$
  select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(51)
$remote$,false) r(revision integer)),5,'only one competing formation advanced the committed revision');

-- Isolate the five-root limit: neither the 20-active nor 200-version guard is
-- full, no Send is pending, and B uses the current revision. A stale-revision
-- refusal would not prove the capacity guard, so it is not accepted here.
select ok((select history_room and active_room and not conversation_room and not pending
  from dblink('five_waypoints_setup',$remote$
    select (select count(*) from content.waypoint where source_ai_interaction_session_id=pg_temp.gid(51))<p.history_limit,
      ai.solmind_waypoint_active_count_v1(pg_temp.gid(1))<p.active_limit,
      ai.solmind_waypoint_root_room_v1(pg_temp.gid(1),pg_temp.gid(51)),s.pending_operation_id is not null
    from ai.solmind_waypoint_policy_v1() p cross join ai.explorer_conversation_state s
    where s.conversation_id=pg_temp.gid(51)
  $remote$,false) r(history_room boolean,active_room boolean,conversation_room boolean,pending boolean)),
  'only the five-different-Waypoints limit is full before B retries');
select is((select result from dblink('five_waypoints_b',$remote$select pg_temp.waypoint_try(
  $$select outcome from public.solmind_mutate_explorer_conversation_v3(
    'f46c0000-0000-4000-8000-000000000001','f46c0000-0000-4000-8000-000000000050',
    'f46c0000-0000-4000-8000-000000000051','f46c0000-0000-4000-8000-000000000106',5,
    'confirm_waypoint',repeat('B',64),'f46c0000-0000-4000-8000-000000000061',null,null,null,
    'Synthetic fifth destination B','Synthetic fifth meaning B','Synthetic fifth signal B',null)$$)
$remote$,false) r(result text)),'unavailable','after A commits, B with the current revision is refused by capacity');
select ok((select n=5 and roots=5 and starters=4 and contenders=1 from dblink('five_waypoints_setup',$remote$
  select count(*)::integer,count(*) filter(where predecessor_waypoint_id is null)::integer,
    count(*) filter(where waypoint_id in (pg_temp.gid(101),pg_temp.gid(102),pg_temp.gid(103),pg_temp.gid(104)))::integer,
    count(*) filter(where waypoint_id in (pg_temp.gid(105),pg_temp.gid(106)))::integer
  from content.waypoint where source_ai_interaction_session_id=pg_temp.gid(51)
$remote$,false) r(n integer,roots integer,starters integer,contenders integer)),
  'after both B attempts, all four originals plus exactly one new original remain: five and no more');
select ok((select won and not lost and won_receipt and not lost_receipt from dblink('five_waypoints_setup',$remote$
  select exists(select 1 from content.waypoint where waypoint_id=pg_temp.gid(105)),
    exists(select 1 from content.waypoint where waypoint_id=pg_temp.gid(106)),
    exists(select 1 from ai.explorer_conversation_operation where actor_user_account_id=pg_temp.gid(1)
      and operation_id=pg_temp.gid(105) and kind='confirm_waypoint' and status='completed'),
    exists(select 1 from ai.explorer_conversation_operation where actor_user_account_id=pg_temp.gid(1) and operation_id=pg_temp.gid(106))
$remote$,false) r(won boolean,lost boolean,won_receipt boolean,lost_receipt boolean)),
  'A has the sole new Waypoint and receipt; neither B refusal persisted either row');
select is((select revision from dblink('five_waypoints_setup',$remote$
  select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(51)
$remote$,false) r(revision integer)),5,'B capacity refusal leaves the revision unchanged');

-- Every base-table read above runs remotely: the outer pgTAP transaction holds
-- no fixture-table locks. Disconnect A/B before cleanup to release any locks
-- still held after a failed assertion. dblink_disconnect has no fail_on_error
-- parameter; lives_ok turns disconnect errors into failed assertions instead.
select lives_ok($$select dblink_disconnect('five_waypoints_a')$$,'connection A disconnects');
select lives_ok($$select dblink_disconnect('five_waypoints_b')$$,'connection B disconnects');
select is(dblink_exec('five_waypoints_setup',
  'do $body$ begin perform pg_temp.cleanup_fixture(); end $body$',false),
  'DO','setup commits cleanup of every fixed fixture and both possible contender IDs');
select is((select n from dblink('five_waypoints_setup','select pg_temp.fixture_rows()',false) r(n bigint)),
  0::bigint,'cleanup left none of the rows in any of the sixteen fixture tables');
select is((select n from dblink('five_waypoints_setup',$remote$
  select count(*)::integer from pg_catalog.pg_trigger where tgenabled='O' and
    ((tgrelid='content.waypoint'::regclass and tgname='waypoint_history_guard')
      or (tgrelid='ai.explorer_conversation_state'::regclass and tgname='explorer_private_state_guard'))
$remote$,false) r(n integer)),2,'both immutable-row guards are enabled after cleanup');
select lives_ok($$select dblink_disconnect('five_waypoints_setup')$$,'the setup connection disconnects');
select ok(not (coalesce(dblink_get_connections(),array[]::text[]) &&
  array['five_waypoints_a','five_waypoints_b','five_waypoints_setup']),
  'none of the three named connections remains open');
select * from finish();
rollback;
