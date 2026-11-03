-- Focused synthetic SQL proof of the four minimal Admin read functions (PRJ01_R-WS03-WI014; decision queue
-- 2026-11-03 11:56:14 and 12:19:09) in a disposable project only. Synthetic accounts only: no provider, login,
-- real person or human approval. Counts are checked as changes from a baseline taken inside this test, so other
-- rows in the database do not matter. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,pg_catalog,pg_temp;
set local statement_timeout='120s';
select no_plan();

create function pg_temp.gid(n integer) returns uuid language sql immutable as $$
  select ('ad3e0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
-- The fixed authority reference the Admin screens pass to both writers (Paul's decision queue entry
-- 2026-11-03 11:56:14, as amended at 12:19:09); never the Admin's own account id.
create function pg_temp.authority() returns uuid language sql immutable as $$
  select '569232b5-a117-4390-8273-a2e6922a69ef'::uuid
$$;
do $midnight$ begin
  if (select next_day_start-clock_timestamp() from ai.solmind_explorer_ai_use_day_v1(clock_timestamp()))<interval '15 minutes'
    or (select clock_timestamp()-day_start from ai.solmind_explorer_ai_use_day_v1(clock_timestamp()))<interval '1 minute'
    then raise exception 'admin_minimal_reads_suite_must_not_run_across_chicago_midnight'; end if;
end $midnight$;
create function pg_temp.today() returns date language sql stable as $$
  select stop_day from ai.solmind_explorer_ai_use_day_v1(clock_timestamp())
$$;
-- The gate's own answer for one account, in read mode (writes nothing).
create function pg_temp.gate(n integer) returns jsonb language sql as $$
  select ai.solmind_explorer_ai_use_gate_v1(pg_temp.gid(n),null,clock_timestamp(),'read')
$$;
-- Rows of the pause read for one account's recorded stops, and its rows for a pause no stop records yet.
create function pg_temp.pause_rows(n integer) returns integer language sql as $$
  select count(*)::integer from public.solmind_read_admin_ai_use_pauses_v1(pg_temp.gid(1)) p
    join ai.explorer_ai_use_stop x on x.stop_id=p.stop_id
   where p.stop_kind='individual' and x.actor_user_account_id=pg_temp.gid(n)
$$;
create function pg_temp.unrecorded_rows(n integer) returns integer language sql as $$
  select count(*)::integer from public.solmind_read_admin_ai_use_pauses_v1(pg_temp.gid(1)) p
   where p.stop_kind='individual_unrecorded'
     and p.explorer_name=(select e.explorer_display_name from core.explorer_profile e
       where e.user_account_id=pg_temp.gid(n) and e.status<>'deleted')
$$;
create function pg_temp.people_pause(n integer) returns text language sql as $$
  select p.explorer_pause from public.solmind_read_admin_people_v1(pg_temp.gid(1)) p
   where p.explorer_name=(select e.explorer_display_name from core.explorer_profile e
     where e.user_account_id=pg_temp.gid(n) and e.status<>'deleted')
$$;
-- The gate's individual decision over every account with a non-deleted Explorer profile, for the
-- Dashboard's agreement check.
create function pg_temp.gate_paused_profiles() returns integer language sql as $$
  select count(*)::integer from core.explorer_profile e where e.status<>'deleted'
    and ai.solmind_explorer_ai_use_gate_v1(e.user_account_id,null,clock_timestamp(),'read')->>'individual'='review'
$$;
-- A setting change through the existing audited writer, with the version the Admin read returned.
create function pg_temp.set_setting(key_name text,new_value integer,op_n integer) returns text language sql as $$
  select outcome from public.solmind_set_application_setting_integer(key_name,new_value,
    (select version from public.solmind_read_admin_application_settings_v1(pg_temp.gid(1)) where setting_key=key_name),
    pg_temp.gid(op_n),'paul_approved',pg_temp.authority(),'paul_approved_configuration_change')
$$;

-- The Admin first, so the baseline can be read.
insert into identity.user_account(user_account_id,display_name,account_status) values
  (pg_temp.gid(1),'Synthetic Admin Reads Admin','active');
insert into identity.user_role_assignment(user_role_assignment_id,user_account_id,role_code,role_status) values
  (pg_temp.gid(11),pg_temp.gid(1),'admin','active');
create temp table admin_base as select * from public.solmind_read_admin_overview_v1(pg_temp.gid(1));
create temp table admin_base_pauses as select count(*)::integer n from public.solmind_read_admin_ai_use_pauses_v1(pg_temp.gid(1));
create function pg_temp.paused_delta() returns integer language sql as $$
  select accounts_paused_now-(select accounts_paused_now from admin_base) from public.solmind_read_admin_overview_v1(pg_temp.gid(1))
$$;
select is((select count(*)::integer from admin_base),1,'the overview is one row');

-- Refused callers: an inactive Admin account, a suspended Admin role, a Guide and an Explorer.
insert into identity.user_account(user_account_id,display_name,account_status) values
  (pg_temp.gid(2),'Synthetic Inactive Admin','inactive'),
  (pg_temp.gid(3),'Synthetic Suspended Admin','active'),
  (pg_temp.gid(4),'Synthetic Admin Reads Guide One','active'),
  (pg_temp.gid(5),'Synthetic Admin Reads Guide Two','active'),
  (pg_temp.gid(6),'Synthetic Admin Reads Explorer One','active'),
  (pg_temp.gid(7),'Synthetic Admin Reads Explorer Two','active'),
  (pg_temp.gid(8),'Synthetic Admin Reads Explorer Three','active'),
  (pg_temp.gid(9),'Synthetic Deleted Guide','active');
insert into identity.user_role_assignment(user_role_assignment_id,user_account_id,role_code,role_status) values
  (pg_temp.gid(12),pg_temp.gid(2),'admin','active'),
  (pg_temp.gid(13),pg_temp.gid(3),'admin','suspended'),
  (pg_temp.gid(14),pg_temp.gid(4),'guide','active'),
  (pg_temp.gid(15),pg_temp.gid(5),'guide','active'),
  (pg_temp.gid(16),pg_temp.gid(6),'explorer','active'),
  (pg_temp.gid(17),pg_temp.gid(7),'explorer','active'),
  (pg_temp.gid(18),pg_temp.gid(8),'explorer','active'),
  (pg_temp.gid(19),pg_temp.gid(9),'guide','active');
insert into core.organization(organization_id,organization_name,approval_status,approved_by_user_account_id,approved_at)
  values(pg_temp.gid(21),'Synthetic Admin Reads Organization','approved',pg_temp.gid(1),now());
insert into core.practice(practice_id,organization_id,practice_name,approval_status,approved_by_user_account_id,approved_at)
  values(pg_temp.gid(22),pg_temp.gid(21),'Synthetic Admin Reads Practice','approved',pg_temp.gid(1),now());
insert into core.guide_profile(guide_profile_id,user_account_id,guide_display_name,setup_status,approved_by_user_account_id,approved_at,status) values
  (pg_temp.gid(41),pg_temp.gid(4),'Synthetic Guide One','approved',pg_temp.gid(1),now(),'active'),
  (pg_temp.gid(51),pg_temp.gid(5),'Synthetic Guide Two','approved',pg_temp.gid(1),now(),'active'),
  (pg_temp.gid(59),pg_temp.gid(9),'Synthetic Deleted Guide','approved',pg_temp.gid(1),now(),'deleted');
insert into core.explorer_profile(explorer_profile_id,user_account_id,explorer_display_name,onboarding_status,status) values
  (pg_temp.gid(61),pg_temp.gid(6),'Synthetic Explorer One','active','active'),
  (pg_temp.gid(62),pg_temp.gid(7),'Synthetic Explorer Two','active','active'),
  (pg_temp.gid(63),pg_temp.gid(8),'Synthetic Explorer Three','active','active');
insert into core.guide_explorer_relationship(guide_explorer_relationship_id,guide_profile_id,explorer_profile_id,practice_id,relationship_status,started_at) values
  (pg_temp.gid(71),pg_temp.gid(41),pg_temp.gid(61),pg_temp.gid(22),'active',now()),
  (pg_temp.gid(72),pg_temp.gid(41),pg_temp.gid(62),pg_temp.gid(22),'paused',now()),
  (pg_temp.gid(73),pg_temp.gid(41),pg_temp.gid(63),pg_temp.gid(22),'active',now());
-- Sign-ins: Explorer One 1 and 3 days ago, Explorer Two 10 days ago, Explorer Three never; a Guide sign-in and
-- an Admin sign-in today, which never count as Explorer activity.
insert into identity.user_session(user_session_id,user_account_id,active_role_context,created_at,expires_at,session_status) values
  (pg_temp.gid(81),pg_temp.gid(6),'explorer',now()-interval '1 day',now()-interval '1 day'+interval '1 hour','expired'),
  (pg_temp.gid(82),pg_temp.gid(6),'explorer',now()-interval '3 days',now()-interval '3 days'+interval '1 hour','logged_out'),
  (pg_temp.gid(83),pg_temp.gid(7),'explorer',now()-interval '10 days',now()-interval '10 days'+interval '1 hour','expired'),
  (pg_temp.gid(84),pg_temp.gid(4),'guide',now()-interval '1 hour',now()+interval '1 hour','active'),
  (pg_temp.gid(85),pg_temp.gid(1),'admin',now()-interval '1 hour',now()+interval '1 hour','active');
-- Explorer Three's account is in crisis or urgent handling (a conversation at restricted level 4).
insert into ai.ai_interaction_session(ai_interaction_session_id,session_type,actor_user_account_id,actor_role_context,
  guide_profile_id,explorer_profile_id,guide_explorer_relationship_id,practice_id,metadata)
values(pg_temp.gid(91),'explorer_reflection',pg_temp.gid(8),'explorer',pg_temp.gid(41),pg_temp.gid(63),pg_temp.gid(73),
  pg_temp.gid(22),jsonb_build_object('restricted_mode',true));
insert into ai.explorer_conversation_state(conversation_id,actor_user_account_id,safety_contract_version,restricted_level,
  adult_reflection_stopped,safety_version)
values(pg_temp.gid(91),pg_temp.gid(8),'explorer-conversation-safety.v1',4,false,0);

-- Guide Three and four more Explorers (round 2, review REV219), plus an Explorer whose profile is deleted.
-- Explorer Four: an unlifted stop from yesterday. Explorer Five: in crisis or urgent handling, with today's
-- first stop lifted automatically and a second stop today waiting for Paul. Explorer Six: one counted Send
-- today and this week's automatic lift already used. Explorer Seven: no stop and no Send.
insert into identity.user_account(user_account_id,display_name,account_status) values
  (pg_temp.gid(300),'Synthetic Admin Reads Guide Three','active'),
  (pg_temp.gid(301),'Synthetic Admin Reads Explorer Four','active'),
  (pg_temp.gid(302),'Synthetic Admin Reads Explorer Five','active'),
  (pg_temp.gid(303),'Synthetic Admin Reads Explorer Six','active'),
  (pg_temp.gid(304),'Synthetic Admin Reads Explorer Seven','active'),
  (pg_temp.gid(305),'Synthetic Admin Reads Deleted Explorer','active');
insert into identity.user_role_assignment(user_role_assignment_id,user_account_id,role_code,role_status) values
  (pg_temp.gid(310),pg_temp.gid(300),'guide','active'),
  (pg_temp.gid(311),pg_temp.gid(301),'explorer','active'),
  (pg_temp.gid(312),pg_temp.gid(302),'explorer','active'),
  (pg_temp.gid(313),pg_temp.gid(303),'explorer','active'),
  (pg_temp.gid(314),pg_temp.gid(304),'explorer','active'),
  (pg_temp.gid(315),pg_temp.gid(305),'explorer','active');
insert into core.guide_profile(guide_profile_id,user_account_id,guide_display_name,setup_status,approved_by_user_account_id,approved_at,status)
  values(pg_temp.gid(320),pg_temp.gid(300),'Synthetic Guide Three','approved',pg_temp.gid(1),now(),'active');
insert into core.explorer_profile(explorer_profile_id,user_account_id,explorer_display_name,onboarding_status,status) values
  (pg_temp.gid(321),pg_temp.gid(301),'Synthetic Explorer Four','active','active'),
  (pg_temp.gid(322),pg_temp.gid(302),'Synthetic Explorer Five','active','active'),
  (pg_temp.gid(323),pg_temp.gid(303),'Synthetic Explorer Six','active','active'),
  (pg_temp.gid(324),pg_temp.gid(304),'Synthetic Explorer Seven','active','active'),
  (pg_temp.gid(325),pg_temp.gid(305),'Synthetic Deleted Explorer','active','deleted');
insert into core.guide_explorer_relationship(guide_explorer_relationship_id,guide_profile_id,explorer_profile_id,practice_id,relationship_status,started_at) values
  (pg_temp.gid(331),pg_temp.gid(320),pg_temp.gid(321),pg_temp.gid(22),'active',now()),
  (pg_temp.gid(332),pg_temp.gid(320),pg_temp.gid(322),pg_temp.gid(22),'active',now()),
  (pg_temp.gid(333),pg_temp.gid(320),pg_temp.gid(323),pg_temp.gid(22),'active',now()),
  (pg_temp.gid(334),pg_temp.gid(320),pg_temp.gid(324),pg_temp.gid(22),'active',now());
-- Sign-ins at the edges of the 7-day window: Explorer Four 6 days 23 hours ago (counted), Explorer Five 7 days
-- 1 hour ago (not counted), Explorer Six 30 days ago (not counted), and the deleted Explorer 2 days ago (not
-- counted: no non-deleted Explorer profile).
insert into identity.user_session(user_session_id,user_account_id,active_role_context,created_at,expires_at,session_status) values
  (pg_temp.gid(351),pg_temp.gid(301),'explorer',now()-interval '6 days 23 hours',now()-interval '6 days 22 hours','expired'),
  (pg_temp.gid(352),pg_temp.gid(302),'explorer',now()-interval '7 days 1 hour',now()-interval '7 days','expired'),
  (pg_temp.gid(353),pg_temp.gid(303),'explorer',now()-interval '30 days',now()-interval '30 days'+interval '1 hour','expired'),
  (pg_temp.gid(355),pg_temp.gid(305),'explorer',now()-interval '2 days',now()-interval '2 days'+interval '1 hour','expired');
-- Explorer Five's account is in crisis or urgent handling (restricted level 3); Explorer Six's conversation is
-- clear. Each conversation's session marks its restricted mode to match.
insert into ai.ai_interaction_session(ai_interaction_session_id,session_type,actor_user_account_id,actor_role_context,
  guide_profile_id,explorer_profile_id,guide_explorer_relationship_id,practice_id,metadata) values
  (pg_temp.gid(341),'explorer_reflection',pg_temp.gid(302),'explorer',pg_temp.gid(320),pg_temp.gid(322),pg_temp.gid(332),
    pg_temp.gid(22),jsonb_build_object('restricted_mode',true)),
  (pg_temp.gid(342),'explorer_reflection',pg_temp.gid(303),'explorer',pg_temp.gid(320),pg_temp.gid(323),pg_temp.gid(333),
    pg_temp.gid(22),jsonb_build_object('restricted_mode',false));
insert into ai.explorer_conversation_state(conversation_id,actor_user_account_id,safety_contract_version,restricted_level,
  adult_reflection_stopped,safety_version) values
  (pg_temp.gid(341),pg_temp.gid(302),'explorer-conversation-safety.v1',3,false,0),
  (pg_temp.gid(342),pg_temp.gid(303),'explorer-conversation-safety.v1',null,false,0);
-- Explorer Six's one counted Send today: an owner-created historical-row fixture (a legacy snapshot and an
-- invocation with no dispatch evidence), not a new application write. Synthetic words only.
insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,sender_type,
  sender_user_account_id,sender_role_context,content_text)
  values(pg_temp.gid(361),pg_temp.gid(342),1,'user',pg_temp.gid(303),'explorer','Synthetic Admin reads fixture message.');
insert into ai.ai_context_snapshot(ai_context_snapshot_id,ai_interaction_session_id,prompt_version)
  values(pg_temp.gid(371),pg_temp.gid(342),'synthetic-admin-reads.v1');
insert into ai.ai_model_invocation(ai_model_invocation_id,ai_interaction_session_id,provider_name,model_name,prompt_version,
  request_status,completed_at)
  values(pg_temp.gid(381),pg_temp.gid(342),'synthetic','synthetic-model','synthetic-admin-reads.v1','completed',clock_timestamp());
insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,kind,
  request_fingerprint,command_fingerprint,initial_revision,status,message_id,snapshot_id,invocation_id,logical_operation_id,completed_at)
  values(pg_temp.gid(303),pg_temp.gid(391),pg_temp.gid(353),pg_temp.gid(342),'send',repeat('A',64),repeat('B',64),0,'completed',
    pg_temp.gid(361),pg_temp.gid(371),pg_temp.gid(381),pg_temp.gid(392),clock_timestamp());

select throws_ok($$select * from public.solmind_read_admin_overview_v1(null)$$,'P0001','solmind_admin_required',
  'no actor is refused');
select throws_ok($$select * from public.solmind_read_admin_overview_v1(pg_temp.gid(999))$$,'P0001','solmind_admin_required',
  'an unknown account is refused');
select throws_ok($$select * from public.solmind_read_admin_overview_v1(pg_temp.gid(2))$$,'P0001','solmind_admin_required',
  'the overview refuses an inactive Admin account');
select throws_ok($$select * from public.solmind_read_admin_people_v1(pg_temp.gid(2))$$,'P0001','solmind_admin_required',
  'the people read refuses an inactive Admin account');
select throws_ok($$select * from public.solmind_read_admin_ai_use_pauses_v1(pg_temp.gid(2))$$,'P0001','solmind_admin_required',
  'the pause read refuses an inactive Admin account');
select throws_ok($$select * from public.solmind_read_admin_application_settings_v1(pg_temp.gid(2))$$,'P0001','solmind_admin_required',
  'the settings read refuses an inactive Admin account');
select throws_ok($$select * from public.solmind_read_admin_overview_v1(pg_temp.gid(3))$$,'P0001','solmind_admin_required',
  'the overview refuses a suspended Admin role');
select throws_ok($$select * from public.solmind_read_admin_application_settings_v1(pg_temp.gid(3))$$,'P0001','solmind_admin_required',
  'the settings read refuses a suspended Admin role');
select throws_ok($$select * from public.solmind_read_admin_overview_v1(pg_temp.gid(4))$$,'P0001','solmind_admin_required',
  'the overview refuses a Guide');
select throws_ok($$select * from public.solmind_read_admin_people_v1(pg_temp.gid(4))$$,'P0001','solmind_admin_required',
  'the people read refuses a Guide');
select throws_ok($$select * from public.solmind_read_admin_ai_use_pauses_v1(pg_temp.gid(4))$$,'P0001','solmind_admin_required',
  'the pause read refuses a Guide');
select throws_ok($$select * from public.solmind_read_admin_application_settings_v1(pg_temp.gid(4))$$,'P0001','solmind_admin_required',
  'the settings read refuses a Guide');
select throws_ok($$select * from public.solmind_read_admin_people_v1(pg_temp.gid(6))$$,'P0001','solmind_admin_required',
  'the people read refuses an Explorer');

-- Stops. Explorer One: a first stop today lifted automatically and a second stop today waiting for Paul.
-- Explorer Two: a first stop today, lifted below on the Admin's lift. Explorer Three: a first stop today
-- reached before the crisis began, which the gate treats as no pause (the next Send lifts it).
insert into ai.explorer_ai_use_stop(stop_id,stop_kind,actor_user_account_id,stop_day,day_stop_number,reached_at,
  day_total,limit_value,account_in_crisis,lifted_at,lift_authority_basis) values
  (pg_temp.gid(101),'individual',pg_temp.gid(6),pg_temp.today(),1,clock_timestamp()-interval '50 minutes',500,500,false,
    clock_timestamp()-interval '50 minutes','automatic_allowance');
insert into ai.explorer_ai_use_stop(stop_id,stop_kind,actor_user_account_id,stop_day,day_stop_number,reached_at,
  day_total,limit_value,account_in_crisis) values
  (pg_temp.gid(102),'individual',pg_temp.gid(6),pg_temp.today(),2,clock_timestamp()-interval '10 minutes',1000,500,false),
  (pg_temp.gid(103),'individual',pg_temp.gid(7),pg_temp.today(),1,clock_timestamp()-interval '20 minutes',500,500,false),
  (pg_temp.gid(104),'individual',pg_temp.gid(8),pg_temp.today(),1,clock_timestamp()-interval '30 minutes',500,500,false);
-- Explorer Four: yesterday's first stop, still waiting (the gate has no day filter for an unlifted stop).
-- Explorer Five: today's first stop lifted as a crisis lift, then a second stop today, unlifted.
-- Explorer Six: this week's automatic lifts already used on earlier days (as many as the per-week setting).
insert into ai.explorer_ai_use_stop(stop_id,stop_kind,actor_user_account_id,stop_day,day_stop_number,reached_at,
  day_total,limit_value,account_in_crisis) values
  (pg_temp.gid(401),'individual',pg_temp.gid(301),pg_temp.today()-1,1,clock_timestamp()-interval '1 day',500,500,false);
insert into ai.explorer_ai_use_stop(stop_id,stop_kind,actor_user_account_id,stop_day,day_stop_number,reached_at,
  day_total,limit_value,account_in_crisis,lifted_at,lift_authority_basis) values
  (pg_temp.gid(402),'individual',pg_temp.gid(302),pg_temp.today(),1,clock_timestamp()-interval '40 minutes',500,500,true,
    clock_timestamp()-interval '40 minutes','automatic_crisis');
insert into ai.explorer_ai_use_stop(stop_id,stop_kind,actor_user_account_id,stop_day,day_stop_number,reached_at,
  day_total,limit_value,account_in_crisis) values
  (pg_temp.gid(403),'individual',pg_temp.gid(302),pg_temp.today(),2,clock_timestamp()-interval '15 minutes',1000,500,true);
select ok((select integer_value between 0 and 6 from core.application_setting where setting_key='explorer_ai_use_automatic_lifts_per_week'),
  'the per-week automatic-lift setting can be used up on earlier days of the last 7');
insert into ai.explorer_ai_use_stop(stop_id,stop_kind,actor_user_account_id,stop_day,day_stop_number,reached_at,
  day_total,limit_value,account_in_crisis,lifted_at,lift_authority_basis)
  select pg_temp.gid(410+k),'individual',pg_temp.gid(303),pg_temp.today()-k,1,clock_timestamp()-k*interval '1 day',500,500,false,
    clock_timestamp()-k*interval '1 day','automatic_allowance'
  from generate_series(1,(select integer_value from core.application_setting
    where setting_key='explorer_ai_use_automatic_lifts_per_week')) k;

-- The pause reads agree with the gate.
select ok((select pg_temp.gate(6)->>'individual'='review'),'the gate pauses Explorer One');
select is(pg_temp.pause_rows(6),1,'the pause read lists Explorer One''s waiting stop once');
select ok((select stop_id=pg_temp.gid(102) and explorer_name='Synthetic Explorer One' and stop_day=pg_temp.today()
    and day_total=1000 and limit_value=500 and account_in_crisis is false
  from public.solmind_read_admin_ai_use_pauses_v1(pg_temp.gid(1)) where stop_id=pg_temp.gid(102)),
  'the pause row holds the name, stop, day, total, limit and the crisis status recorded at the stop');
select is(pg_temp.people_pause(6),'own_limit','the people read shows Explorer One paused by their own limit');
select ok((select pg_temp.gate(7)->>'individual'='review'),'the gate pauses Explorer Two before the lift');
select is(pg_temp.pause_rows(7),1,'the pause read lists Explorer Two before the lift');
select is(pg_temp.people_pause(7),'own_limit','the people read shows Explorer Two paused before the lift');
select ok((select pg_temp.gate(8)->>'individual'='none' and (pg_temp.gate(8)->>'crisis')::boolean),
  'the gate treats a crisis account''s first stop of a day as no pause');
select is(pg_temp.pause_rows(8),0,'the pause read leaves out a crisis account''s first stop of a day');
select is(pg_temp.unrecorded_rows(8),0,'and adds no unrecorded row for it');
select is(pg_temp.people_pause(8),'none','the people read shows the crisis account not paused');
select ok((select pg_temp.gate(301)->>'individual'='review'),'the gate pauses Explorer Four for yesterday''s unlifted stop');
select is(pg_temp.pause_rows(301),1,'the pause read lists yesterday''s waiting stop');
select ok((select stop_day=pg_temp.today()-1 from public.solmind_read_admin_ai_use_pauses_v1(pg_temp.gid(1)) where stop_id=pg_temp.gid(401)),
  'with its own day');
select is(pg_temp.people_pause(301),'own_limit','the people read shows Explorer Four paused');
select ok((select pg_temp.gate(302)->>'individual'='review' and (pg_temp.gate(302)->>'crisis')::boolean),
  'the gate pauses a crisis account at its second stop of a day');
select is(pg_temp.pause_rows(302),1,'the pause read lists that second stop once');
select ok((select account_in_crisis is true and day_total=1000 and explorer_name='Synthetic Explorer Five'
  from public.solmind_read_admin_ai_use_pauses_v1(pg_temp.gid(1)) where stop_id=pg_temp.gid(403)),
  'with the crisis status recorded at the stop');
select is(pg_temp.people_pause(302),'own_limit','the people read shows the crisis account paused at its second stop');
select ok((select pg_temp.gate(303)->>'individual'='none'),'Explorer Six is under the limit before it is lowered');
select is(pg_temp.unrecorded_rows(303)+pg_temp.pause_rows(303),0,'so the pause read has no row for Explorer Six');
select is(pg_temp.people_pause(303),'none','and the people read shows Explorer Six not paused');
select is(pg_temp.people_pause(304),'none','Explorer Seven is not paused');
select is(pg_temp.paused_delta(),4,'the overview counts the four accounts the gate pauses');
select is((select accounts_paused_now from public.solmind_read_admin_overview_v1(pg_temp.gid(1))),pg_temp.gate_paused_profiles(),
  'the overview count is the gate''s own count over every non-deleted Explorer profile');

-- The Admin's lift through the existing writer, with the fixed authority reference.
select is((select outcome from public.solmind_lift_explorer_ai_use_pause_v1(pg_temp.gid(103),pg_temp.authority(),pg_temp.gid(9001))),
  'lifted','the existing lift lifts Explorer Two''s stop');
select ok((select lift_authority_basis='paul_approved' and lift_authority_reference_id=pg_temp.authority()
    and lift_operation_id=pg_temp.gid(9001) from ai.explorer_ai_use_stop where stop_id=pg_temp.gid(103)),
  'the lift records the fixed authority reference and the browser''s operation id');
select ok((select actor_user_account_id is null and actor_role_context='system' and reason_code='paul_approved_pause_lift'
    and metadata->>'authority_reference_id'=pg_temp.authority()::text
  from audit.audit_event where event_type='explorer_ai_use_pause_lifted' and target_entity_id=pg_temp.gid(103)),
  'the lift is still audited as a system change on Paul''s word (accepted for this throwaway version)');
select is((select outcome from public.solmind_lift_explorer_ai_use_pause_v1(pg_temp.gid(103),pg_temp.authority(),pg_temp.gid(9001))),
  'already_lifted','the same press again is recognised as a repeat');
select throws_ok($$select * from public.solmind_lift_explorer_ai_use_pause_v1(pg_temp.gid(103),pg_temp.authority(),pg_temp.gid(9002))$$,
  'P0001','solmind_explorer_ai_use_operation_conflict','a new press on a pause already lifted elsewhere is the operation conflict');
select ok((select pg_temp.gate(7)->>'individual'='none'),'the gate no longer pauses Explorer Two after the lift');
select is(pg_temp.pause_rows(7),0,'the pause read drops the lifted stop');
select is(pg_temp.unrecorded_rows(7),0,'and adds no unrecorded row for Explorer Two');
select is(pg_temp.people_pause(7),'none','the people read shows Explorer Two not paused after the lift');
select is(pg_temp.pause_rows(6),1,'Explorer One stays paused');
select is(pg_temp.paused_delta(),3,'the overview counts three paused accounts after the lift');

-- A lowered limit: Explorer Six's one Send today is at a limit lowered to 1, this week's automatic lift is used
-- up, and no stop row exists. The gate pauses Explorer Six at once and all three reads agree; a Send is
-- normally refused at the pause read before any stop is recorded, so there is nothing to lift, and the pause
-- ends at midnight, Chicago time, or when the limit is raised again (as at the end of this case).
create temp table admin_limit as select integer_value from core.application_setting
  where setting_key='explorer_ai_use_individual_daily_call_limit';
select is(pg_temp.set_setting('explorer_ai_use_individual_daily_call_limit',1,9201),'applied',
  'the individual limit is lowered to 1 through the existing writer');
select ok((select pg_temp.gate(303)->>'individual'='review'),'the gate pauses Explorer Six by the lowered limit');
select is((select count(*)::integer from ai.explorer_ai_use_stop where actor_user_account_id=pg_temp.gid(303) and lifted_at is null),0,
  'no stop row records that pause yet');
select is(pg_temp.unrecorded_rows(303),1,'the pause read lists Explorer Six once, as not recorded yet');
select ok((select stop_id is null and reached_at is null and account_in_crisis is null and stop_day=pg_temp.today()
    and day_total=1 and limit_value=1
  from public.solmind_read_admin_ai_use_pauses_v1(pg_temp.gid(1))
  where stop_kind='individual_unrecorded' and explorer_name='Synthetic Explorer Six'),
  'that row has no stop, no reached time and no crisis status, and holds today, today''s calls and the limit');
select is(pg_temp.people_pause(303),'own_limit','the people read shows Explorer Six paused by their own limit');
select is(pg_temp.paused_delta(),4,'the overview counts Explorer Six as paused');
select is((select accounts_paused_now from public.solmind_read_admin_overview_v1(pg_temp.gid(1))),pg_temp.gate_paused_profiles(),
  'the overview count is still the gate''s own count');
select is(pg_temp.unrecorded_rows(6)+pg_temp.unrecorded_rows(301)+pg_temp.unrecorded_rows(302),0,
  'an Explorer whose recorded stop is listed gets no unrecorded row');
select is((select count(*)::integer from ai.explorer_ai_use_stop where actor_user_account_id=pg_temp.gid(303) and lifted_at is null),0,
  'the reads wrote nothing');
select is(pg_temp.set_setting('explorer_ai_use_individual_daily_call_limit',(select integer_value from admin_limit),9202),'applied',
  'the limit is set back');
select is(pg_temp.unrecorded_rows(303)+pg_temp.paused_delta(),3,'Explorer Six is then neither listed nor counted');
select is(pg_temp.people_pause(303),'none','and the people read shows Explorer Six not paused');

-- The shared stop: today's pauses everyone and is listed once; yesterday's is not listed.
select ok((select not (pg_temp.gate(7)->>'shared')::boolean),'no shared pause before the shared stop');
insert into ai.explorer_ai_use_stop(stop_id,stop_kind,stop_day,reached_at,day_total,limit_value) values
  (pg_temp.gid(105),'shared',pg_temp.today()-1,clock_timestamp()-interval '1 day',900,900);
select is((select count(*)::integer from public.solmind_read_admin_ai_use_pauses_v1(pg_temp.gid(1)) where stop_kind='shared'
  and stop_id=pg_temp.gid(105)),0,'yesterday''s shared stop is not listed');
select ok((select not (pg_temp.gate(7)->>'shared')::boolean),'the gate ignores yesterday''s shared stop too');
-- Reached before two of the individual stops, so the list's order is the function's own, not the time order.
insert into ai.explorer_ai_use_stop(stop_id,stop_kind,stop_day,reached_at,day_total,limit_value) values
  (pg_temp.gid(106),'shared',pg_temp.today(),clock_timestamp()-interval '35 minutes',900,900);
select ok((select (pg_temp.gate(7)->>'shared')::boolean and (pg_temp.gate(8)->>'shared')::boolean),
  'the gate pauses everyone after today''s shared stop');
select ok((select explorer_name is null and account_in_crisis is null and stop_day=pg_temp.today() and day_total=900
    and limit_value=900 from public.solmind_read_admin_ai_use_pauses_v1(pg_temp.gid(1)) where stop_id=pg_temp.gid(106)),
  'the pause read lists today''s shared stop without a name or crisis status');
select is((select count(*)::integer from public.solmind_read_admin_ai_use_pauses_v1(pg_temp.gid(1)))-(select n from admin_base_pauses),4,
  'the pause read lists exactly the stops of Explorers One, Four and Five and today''s shared stop');
select is((select array_agg(t.stop_id order by t.n) from public.solmind_read_admin_ai_use_pauses_v1(pg_temp.gid(1))
    with ordinality t(stop_id,stop_kind,explorer_name,stop_day,reached_at,day_total,limit_value,account_in_crisis,n)
  where t.stop_id in (pg_temp.gid(102),pg_temp.gid(106),pg_temp.gid(401),pg_temp.gid(403))),
  array[pg_temp.gid(401),pg_temp.gid(403),pg_temp.gid(102),pg_temp.gid(106)],
  'the function lists recorded individual pauses by the time reached, then the shared stop');
select is(pg_temp.people_pause(304),'shared','the people read shows the shared pause for an Explorer with no stop of their own');
select is(pg_temp.people_pause(7),'shared','and for an Explorer whose own stop was lifted');
select is(pg_temp.people_pause(8),'shared','and for the crisis account whose first stop is no pause');
select is(pg_temp.people_pause(6),'own_limit','an Explorer paused by their own limit still shows that');
select is(pg_temp.paused_delta(),3,'the Dashboard count stays the accounts paused by their own limit');

-- Counts are changes from the baseline: three Guides (the deleted one left out), seven Explorers (the deleted
-- profile left out), two Explorers signed in during the last 7 days (Explorer One 1 day ago and Explorer Four
-- 6 days 23 hours ago; not 7 days 1 hour ago, not a deleted profile, and never a Guide or Admin sign-in).
select ok((select o.guide_count-b.guide_count=3 and o.explorer_count-b.explorer_count=7
    and o.explorers_signed_in_last_7_days-b.explorers_signed_in_last_7_days=2
  from public.solmind_read_admin_overview_v1(pg_temp.gid(1)) o cross join admin_base b),
  'the overview counts three Guides, seven Explorers and two Explorers active by sign-ins in the last 7 days');

-- The people read: one row per pairing and one for a Guide with no Explorers; names, status, last sign-in.
select is((select count(*)::integer from public.solmind_read_admin_people_v1(pg_temp.gid(1)) where guide_profile_id=pg_temp.gid(41)),3,
  'Guide One has one row per Explorer');
select is((select array_agg(t.explorer_name order by t.n) from public.solmind_read_admin_people_v1(pg_temp.gid(1))
    with ordinality t(guide_profile_id,guide_name,explorer_name,relationship_status,explorer_last_sign_in_at,explorer_pause,n)
  where t.guide_profile_id=pg_temp.gid(41)),array['Synthetic Explorer One','Synthetic Explorer Three','Synthetic Explorer Two'],
  'the function lists Guide One''s Explorers in name order');
select is((select array_agg(s.guide_name order by s.first_n) from (select t.guide_name,min(t.n) first_n
    from public.solmind_read_admin_people_v1(pg_temp.gid(1))
      with ordinality t(guide_profile_id,guide_name,explorer_name,relationship_status,explorer_last_sign_in_at,explorer_pause,n)
    where t.guide_profile_id in (pg_temp.gid(41),pg_temp.gid(51),pg_temp.gid(320)) group by t.guide_name) s),
  array['Synthetic Guide One','Synthetic Guide Three','Synthetic Guide Two'],'and the Guides in name order');
select ok((select guide_name='Synthetic Guide Two' and explorer_name is null and relationship_status is null
    and explorer_last_sign_in_at is null and explorer_pause is null
  from public.solmind_read_admin_people_v1(pg_temp.gid(1)) where guide_profile_id=pg_temp.gid(51)),
  'a Guide with no Explorers has one row with no Explorer');
select is((select count(*)::integer from public.solmind_read_admin_people_v1(pg_temp.gid(1)) where guide_profile_id=pg_temp.gid(51)),1,
  'that Guide has exactly one row');
select is((select count(*)::integer from public.solmind_read_admin_people_v1(pg_temp.gid(1)) where guide_profile_id=pg_temp.gid(59)),0,
  'a deleted Guide is left out');
select is((select count(*)::integer from public.solmind_read_admin_people_v1(pg_temp.gid(1)) where guide_profile_id=pg_temp.gid(320)),4,
  'Guide Three has one row per Explorer');
select ok((select guide_name='Synthetic Guide One' and relationship_status='active' and explorer_last_sign_in_at=now()-interval '1 day'
  from public.solmind_read_admin_people_v1(pg_temp.gid(1)) where explorer_name='Synthetic Explorer One'),
  'Explorer One''s last sign-in is the latest Explorer sign-in');
select ok((select relationship_status='paused' and explorer_last_sign_in_at=now()-interval '10 days'
  from public.solmind_read_admin_people_v1(pg_temp.gid(1)) where explorer_name='Synthetic Explorer Two'),
  'Explorer Two''s relationship status and older sign-in are shown');
select ok((select explorer_last_sign_in_at is null from public.solmind_read_admin_people_v1(pg_temp.gid(1))
  where explorer_name='Synthetic Explorer Three'),'an Explorer who never signed in has no last sign-in');

-- Settings: the six rows exactly as stored, and a change through the existing writer with the version read.
select is((select count(*)::integer from public.solmind_read_admin_application_settings_v1(pg_temp.gid(1))),6,'six settings');
select is((select array_agg(setting_key order by setting_key) from public.solmind_read_admin_application_settings_v1(pg_temp.gid(1))),
  array['explorer_ai_use_automatic_lifts_per_month','explorer_ai_use_automatic_lifts_per_week',
    'explorer_ai_use_individual_daily_call_limit','explorer_ai_use_shared_daily_calls_per_active_explorer',
    'explorer_shared_snapshot_sendability_days','suggested_waypoint_send_grace_seconds'],'the six protected keys');
select is((select count(*)::integer from (
    select setting_key,integer_value,minimum_integer_value,default_integer_value,maximum_integer_value,version
      from core.application_setting
    except
    select * from public.solmind_read_admin_application_settings_v1(pg_temp.gid(1))) d),0,
  'every value, range, default and version matches the table');
create temp table admin_setting as select integer_value,version from public.solmind_read_admin_application_settings_v1(pg_temp.gid(1))
  where setting_key='explorer_shared_snapshot_sendability_days';
select is((select outcome from public.solmind_set_application_setting_integer('explorer_shared_snapshot_sendability_days',
    (select case when integer_value=100 then 99 else integer_value+1 end from admin_setting),(select version from admin_setting),
    pg_temp.gid(9101),'paul_approved',pg_temp.authority(),'paul_approved_configuration_change')),
  'applied','the existing writer applies a change with the version the read returned');
select is((select version-(select version from admin_setting) from public.solmind_read_admin_application_settings_v1(pg_temp.gid(1))
  where setting_key='explorer_shared_snapshot_sendability_days'),1::bigint,'the read shows the new version');
select throws_ok($$select * from public.solmind_set_application_setting_integer('explorer_shared_snapshot_sendability_days',5,
    (select version from admin_setting),pg_temp.gid(9102),'paul_approved',pg_temp.authority(),'paul_approved_configuration_change')$$,
  'P0001','solmind_application_setting_version_conflict','a stale page''s version is a version conflict');
select throws_ok($$select * from public.solmind_set_application_setting_integer('explorer_shared_snapshot_sendability_days',101,
    (select version+1 from admin_setting),pg_temp.gid(9103),'paul_approved',pg_temp.authority(),'paul_approved_configuration_change')$$,
  'P0001','solmind_application_setting_invalid_value','a value out of range is refused');
select ok((select actor_user_account_id is null and actor_role_context='system'
    and metadata->>'authority_reference_id'=pg_temp.authority()::text
  from audit.audit_event where event_type='application_setting_changed' and metadata->>'operation_id'=pg_temp.gid(9101)::text),
  'the change is audited as a system change with the fixed authority reference');

-- Privileges and shape.
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('solmind_read_admin_overview_v1','solmind_read_admin_people_v1',
    'solmind_read_admin_ai_use_pauses_v1','solmind_read_admin_application_settings_v1')
    and p.pronargs=1 and p.prosecdef and p.provolatile='s' and p.proconfig @> array['search_path=""']
    and pg_get_userbyid(p.proowner)='postgres'
    and has_function_privilege('service_role',p.oid,'EXECUTE')
    and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE')
    and not exists(select 1 from aclexplode(p.proacl) a where a.grantee=0)),4,
  'the four reads are stable service-role-only definer functions owned by postgres with an empty search path');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'solmind_read_admin_%_v1'),4,'exactly four new reads, no overloads');
select is((select array_to_string(p.proargnames,',') from pg_proc p where p.oid='public.solmind_read_admin_overview_v1(uuid)'::regprocedure),
  'p_actor_user_account_id,guide_count,explorer_count,explorers_signed_in_last_7_days,accounts_paused_now','overview columns');
select is((select array_to_string(p.proargnames,',') from pg_proc p where p.oid='public.solmind_read_admin_people_v1(uuid)'::regprocedure),
  'p_actor_user_account_id,guide_profile_id,guide_name,explorer_name,relationship_status,explorer_last_sign_in_at,explorer_pause',
  'people columns: names, status, last sign-in and pause only');
select is((select array_to_string(p.proargnames,',') from pg_proc p where p.oid='public.solmind_read_admin_ai_use_pauses_v1(uuid)'::regprocedure),
  'p_actor_user_account_id,stop_id,stop_kind,explorer_name,stop_day,reached_at,day_total,limit_value,account_in_crisis','pause columns');
select is((select array_to_string(p.proargnames,',') from pg_proc p where p.oid='public.solmind_read_admin_application_settings_v1(uuid)'::regprocedure),
  'p_actor_user_account_id,setting_key,integer_value,minimum_integer_value,default_integer_value,maximum_integer_value,version',
  'settings columns');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join unnest(p.proargnames) a(name)
  where n.nspname='public' and p.proname like 'solmind_read_admin_%_v1'
    and a.name ~ '(message|conversation|content|title|session|words|safety|text)'),
  'no message, conversation, content, title, session or safety column of any kind');
select ok(not exists(select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
  cross join (values('ai.explorer_ai_use_stop'),('core.application_setting'),('identity.user_session'),
    ('core.guide_profile'),('core.explorer_profile')) t(table_name)
  where has_table_privilege(r.role_name,t.table_name,'SELECT,INSERT,UPDATE,DELETE')),
  'no API role gains direct access to the tables the reads use');

-- Role checks use literal ids (gid(1) is the Admin, gid(4) a Guide), so no temporary object is needed.
create temp table admin_role_results(name text,value text);
grant insert on admin_role_results to service_role;
set local role service_role;
insert into admin_role_results select 'explorers',explorer_count::text
  from public.solmind_read_admin_overview_v1('ad3e0000-0000-4000-8000-000000000001');
select throws_ok($$select * from public.solmind_read_admin_people_v1('ad3e0000-0000-4000-8000-000000000004')$$,'P0001',
  'solmind_admin_required','the service role still gets the closed refusal for a Guide');
select lives_ok($$set constraints all immediate$$,'deferred coherence checks pass at the caller boundary');
reset role;
select is((select value::integer from admin_role_results where name='explorers')-(select explorer_count from admin_base),7,
  'the service role can call the overview for an active Admin');
set local role anon;
select throws_ok($$select * from public.solmind_read_admin_overview_v1('ad3e0000-0000-4000-8000-000000000001')$$,'42501',null,
  'anon cannot call the overview');
reset role;
set local role authenticated;
select throws_ok($$select * from public.solmind_read_admin_application_settings_v1('ad3e0000-0000-4000-8000-000000000001')$$,
  '42501',null,'authenticated cannot call the settings read');
reset role;
select * from finish();
rollback;
