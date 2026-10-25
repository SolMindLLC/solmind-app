-- Synthetic real SQL transition proof. Rollback-only isolated DB.
-- Current executed evidence: solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md.
-- Synthetic account/role/session fixtures exercise actual closed SQL predicates;
-- they do not prove real Auth/browser login, actual human review, a genuine AI
-- screen, policy approval, source rights or any provider call. Synthetic screen
-- results below are intentionally fabricated local fixtures, never production.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,pg_catalog,pg_temp;
set local statement_timeout='120s';
select no_plan();

create function pg_temp.gid(n integer) returns uuid language sql immutable as $$
  select ('f4250000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
do $$ begin
  if exists(select 1 from core.consent_document
    where document_status='active' and is_required_for_explorer is true) then
    raise exception 'synthetic_methodology-workflow_fixture_requires_isolated_consent_state';
  end if;
end $$;

insert into identity.user_account(user_account_id,display_name,account_status) values
  (pg_temp.gid(1),'Synthetic Methodology Workflow Explorer','active'),
  (pg_temp.gid(2),'Synthetic Methodology Workflow Guide','active'),
  (pg_temp.gid(3),'Synthetic Methodology Workflow Admin','active'),
  (pg_temp.gid(4),'Synthetic Other Explorer','active');
insert into identity.user_role_assignment(user_role_assignment_id,user_account_id,role_code,role_status) values
  (pg_temp.gid(11),pg_temp.gid(1),'explorer','active'),
  (pg_temp.gid(12),pg_temp.gid(2),'guide','active'),
  (pg_temp.gid(13),pg_temp.gid(3),'admin','active'),
  (pg_temp.gid(14),pg_temp.gid(4),'explorer','active');
insert into core.organization(organization_id,organization_name,approval_status,approved_by_user_account_id,approved_at)
  values(pg_temp.gid(21),'Synthetic Methodology Workflow Organization','approved',pg_temp.gid(3),now());
insert into core.practice(practice_id,organization_id,practice_name,approval_status,approved_by_user_account_id,approved_at)
  values(pg_temp.gid(22),pg_temp.gid(21),'Synthetic Methodology Workflow Practice','approved',pg_temp.gid(3),now());
insert into core.guide_profile(guide_profile_id,user_account_id,guide_display_name,setup_status,approved_by_user_account_id,approved_at,status)
  values(pg_temp.gid(23),pg_temp.gid(2),'Synthetic Guide Private Canary','approved',pg_temp.gid(3),now(),'active');
insert into core.explorer_profile(explorer_profile_id,user_account_id,explorer_display_name,onboarding_status,status) values
  (pg_temp.gid(24),pg_temp.gid(1),'Synthetic Methodology Workflow Explorer','active','active'),
  (pg_temp.gid(26),pg_temp.gid(4),'Synthetic Other Explorer','active','active');
insert into core.guide_explorer_relationship(guide_explorer_relationship_id,guide_profile_id,explorer_profile_id,practice_id,relationship_status,started_at) values
  (pg_temp.gid(25),pg_temp.gid(23),pg_temp.gid(24),pg_temp.gid(22),'active',now()),
  (pg_temp.gid(27),pg_temp.gid(23),pg_temp.gid(26),pg_temp.gid(22),'active',now());
insert into core.consent_document(consent_document_id,consent_type,version_number,version_label,title,body_markdown,
  document_status,is_required_for_explorer,effective_at,created_by_user_account_id) values
  (pg_temp.gid(31),'user_agreement',9420,'synthetic-methodology-workflow-9420','Synthetic Agreement','SQL fixture only.','active',true,now(),pg_temp.gid(3)),
  (pg_temp.gid(32),'ai_disclosure',9420,'synthetic-methodology-workflow-9420','Synthetic AI Disclosure','SQL fixture only.','active',true,now(),pg_temp.gid(3));
insert into core.consent_record(consent_record_id,user_account_id,role_context,consent_type,document_version,consent_document_id,adult_affirmation) values
  (pg_temp.gid(41),pg_temp.gid(1),'explorer','user_agreement','synthetic-methodology-workflow-9420',pg_temp.gid(31),true),
  (pg_temp.gid(42),pg_temp.gid(1),'explorer','ai_disclosure','synthetic-methodology-workflow-9420',pg_temp.gid(32),true),
  (pg_temp.gid(43),pg_temp.gid(4),'explorer','user_agreement','synthetic-methodology-workflow-9420',pg_temp.gid(31),true),
  (pg_temp.gid(44),pg_temp.gid(4),'explorer','ai_disclosure','synthetic-methodology-workflow-9420',pg_temp.gid(32),true);
insert into identity.user_session(user_session_id,user_account_id,active_role_context,created_at,expires_at,session_status) values
  (pg_temp.gid(50),pg_temp.gid(1),'explorer',now()-interval '2 hours',now()+interval '1 hour','active'),
  (pg_temp.gid(54),pg_temp.gid(4),'explorer',now()-interval '2 hours',now()+interval '1 hour','active');
insert into core.intake_response_set(intake_response_set_id,guide_explorer_relationship_id,started_at,completed_at,intake_status,response_json) values
  (pg_temp.gid(52),pg_temp.gid(25),now()-interval '1 hour',now(),'completed',
    '{"supportNow":"Synthetic support source","usefulOutcome":"Synthetic useful outcome","supportStyle":"Synthetic style","guideContext":"Synthetic shared answer","communicationPreference":"Synthetic preference","doNotEmphasize":"Synthetic excluded topic"}'),
  (pg_temp.gid(55),pg_temp.gid(27),now()-interval '1 hour',now(),'completed',
    '{"supportNow":"Synthetic other support","usefulOutcome":"Synthetic other outcome","supportStyle":"Synthetic other style"}');

insert into identity.user_account(user_account_id,display_name,account_status) values
  (pg_temp.gid(5),'Synthetic Other Admin','active'),(pg_temp.gid(6),'Synthetic Other Guide','active');
insert into identity.user_role_assignment(user_role_assignment_id,user_account_id,role_code,role_status) values
  (pg_temp.gid(15),pg_temp.gid(5),'admin','active'),(pg_temp.gid(16),pg_temp.gid(6),'guide','active');
insert into identity.user_session(user_session_id,user_account_id,active_role_context,created_at,expires_at,session_status) values
  (pg_temp.gid(56),pg_temp.gid(2),'guide',now()-interval '1 hour',now()+interval '1 hour','active'),
  (pg_temp.gid(57),pg_temp.gid(3),'admin',now()-interval '1 hour',now()+interval '1 hour','active'),
  (pg_temp.gid(58),pg_temp.gid(5),'admin',now()-interval '1 hour',now()+interval '1 hour','active'),
  (pg_temp.gid(59),pg_temp.gid(6),'guide',now()-interval '1 hour',now()+interval '1 hour','active');
insert into core.guide_profile(guide_profile_id,user_account_id,guide_display_name,setup_status,approved_by_user_account_id,approved_at,status)
  values(pg_temp.gid(29),pg_temp.gid(6),'Synthetic Other Guide','approved',pg_temp.gid(3),now(),'active');

create function pg_temp.register_version(n integer,previous_n integer default null,op_n integer default null,
  body_override text default null,actor_n integer default 3,session_n integer default 57)
returns text language sql as $$
  select outcome from public.solmind_register_methodology_version(pg_temp.gid(actor_n),pg_temp.gid(session_n),pg_temp.gid(coalesce(op_n,n+1000)),
    pg_temp.gid(1000),pg_temp.gid(n),pg_temp.gid(23),case when previous_n is null then null else pg_temp.gid(previous_n) end,
    'Synthetic governed methodology',coalesce(body_override,'Synthetic methodology version '||n||'.'),'admin_assisted',
    'Synthetic Admin fixture','[{"source":"synthetic fixture only"}]','Synthetic source summary; no AI authorship is claimed.')
$$;
create function pg_temp.sha(n integer) returns text language sql stable as $$
  select content_sha256 from methodology.methodology_context_pack_version where methodology_context_pack_version_id=pg_temp.gid(n)
$$;
create function pg_temp.request_sha(n integer) returns text language sql immutable as $$
  select methodology.hash_json(jsonb_build_array('synthetic-request',n))
$$;
create function pg_temp.screen_start(n integer,op_n integer default null,sha_override text default null)
returns table(outcome text,dispatch_permitted boolean) language sql as $$
  select r.outcome,r.dispatch_permitted from public.solmind_prepare_methodology_screen(pg_temp.gid(3),pg_temp.gid(57),
    pg_temp.gid(coalesce(op_n,n+2000)),pg_temp.gid(1000),pg_temp.gid(n),pg_temp.gid(n+3000),
    coalesce(sha_override,pg_temp.sha(n)),'synthetic-screen-policy.v1',repeat('B',64),pg_temp.request_sha(n)) r
$$;
create function pg_temp.screen_terminal(n integer,status_name text default 'completed',result_name text default 'pass',findings jsonb default '[]')
returns text language sql as $$
  select outcome from public.solmind_record_methodology_screen(pg_temp.gid(n+2000),pg_temp.gid(n+3000),pg_temp.gid(n),
    pg_temp.sha(n),pg_temp.request_sha(n),status_name,case when status_name='completed' then
      jsonb_build_object('result',result_name,'subject_sha256',pg_temp.sha(n),'findings',findings) else null end)
$$;
create function pg_temp.admin_review(n integer,op_n integer default null,actor_n integer default 3,session_n integer default 57)
returns text language sql as $$
  select outcome from public.solmind_confirm_methodology_admin_review(pg_temp.gid(actor_n),pg_temp.gid(session_n),
    pg_temp.gid(coalesce(op_n,n+4000)),pg_temp.gid(1000),pg_temp.gid(n),pg_temp.sha(n),pg_temp.gid(n+3000))
$$;
create function pg_temp.guide_decision(n integer,active_n integer default null,decision_name text default 'approve',
  op_n integer default null,actor_n integer default 2,session_n integer default 56,affirm boolean default true)
returns text language sql as $$
  select outcome from public.solmind_decide_methodology_guide_review(pg_temp.gid(actor_n),pg_temp.gid(session_n),
    pg_temp.gid(coalesce(op_n,n+5000)),pg_temp.gid(1000),pg_temp.gid(n),pg_temp.sha(n),pg_temp.gid(n+3000),
    (select admin_consistency_audit_event_id from methodology.methodology_context_pack_version where methodology_context_pack_version_id=pg_temp.gid(n)),
    case when active_n is null then null else pg_temp.gid(active_n) end,decision_name,
    case when decision_name='approve' then 'This content does not instruct the AI to act as a clinician, conceal information, or alter safety behavior.' else null end,
    case when decision_name='approve' then affirm else false end)
$$;
create function pg_temp.resolve() returns table(methodology_context_pack_id uuid,scope_type text,scope_id uuid,
  methodology_context_pack_version_id uuid,version_number integer,content_markdown text,content_sha256 text,methodology_authorization_version text)
language sql as $$ select * from public.solmind_resolve_explorer_methodology(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(1000),'guide',pg_temp.gid(23)) $$;

create function pg_temp.context_bytes(v_id uuid) returns text language sql stable as $$
  select jsonb_build_object('contractVersion','wi007-v0.1+onboarding-fields-v2','aiRole','solmind_virtual_guide',
    'actorRoleContext','explorer','globalPolicy',jsonb_build_object('version','synthetic-policy.v1','text','Synthetic policy.'),
    'roleBehavior',jsonb_build_object('version','synthetic-behavior.v1','text','Synthetic behavior.'),
    'crisisBehavior',jsonb_build_object('version','synthetic-crisis.v1','text','Synthetic crisis policy.'),
    'methodologyContext',jsonb_build_object('version','methodology:'||v_id::text,'text',content_markdown),
    'sessionContext','{}'::jsonb,'approvedContinuity','[]'::jsonb,'currentSessionMessages','[]'::jsonb,
    'immediateExplorerMessage','{}'::jsonb,'outputRequirements','{}'::jsonb)::text
  from methodology.methodology_context_pack_version where methodology_context_pack_version_id=v_id
$$;
create function pg_temp.prepare_governed(slot integer,v_id uuid,sha text,mv text,rev integer default 0,
  body_text text default 'Synthetic governed message',serialization_override text default null)
returns table(outcome text,conversation_state jsonb,dispatch_permitted boolean) language plpgsql as $$
declare a jsonb; ids uuid[]; c text:=coalesce(serialization_override,pg_temp.context_bytes(v_id));
begin
  select authority_context into a from public.solmind_read_explorer_conversation(pg_temp.gid(1),pg_temp.gid(50));
  select array_agg(x order by x) into ids from unnest(array[pg_temp.gid(52),pg_temp.gid(6002+slot*10),v_id]) x;
  return query select * from public.solmind_prepare_governed_explorer_conversation_turn(
    pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(6001+slot*10),rev,pg_temp.gid(6002+slot*10),
    pg_temp.gid(6000+slot*10),pg_temp.gid(6003+slot*10),body_text,c,
    upper(encode(extensions.digest(convert_to(c,'UTF8'),'sha256'),'hex')),ids,a->>'authorizationVersion',pg_temp.gid(52),v_id,
    'synthetic-prompt.v1','synthetic-policy.v1','synthetic-behavior.v1','synthetic-crisis.v1','synthetic-role.v1','synthetic-instruction.v1',
    methodology.hash_json(jsonb_build_array('synthetic-command',slot,rev,body_text)),pg_temp.gid(6004+slot*10),pg_temp.gid(1000),sha,mv);
end $$;

-- Inject fixed audit failure through a transaction-local test trigger. Each
-- throws_ok subtransaction must roll back every preceding feature write.
create function pg_temp.fail_selected_audit() returns trigger language plpgsql as $$
begin
  if NEW.event_type=current_setting('solmind.fixture.fail_audit_event',true) then raise exception 'synthetic_audit_failure'; end if;
  return NEW;
end $$;
create trigger synthetic_methodology_audit_failure before insert on audit.audit_event
  for each row execute function pg_temp.fail_selected_audit();

select is(pg_temp.register_version(1001),'ok','authenticated Admin registers one immutable scoped version');
select is(pg_temp.register_version(1001),'exact_replay','identical Admin operation is idempotent');
select throws_ok($$select pg_temp.register_version(1010,1001,9901,null,3,56)$$,
  'P0001','solmind_methodology_denied','Admin actor cannot substitute another account Guide session');
update identity.user_session set expires_at=clock_timestamp()-interval '1 second' where user_session_id=pg_temp.gid(57);
select throws_ok($$select * from public.solmind_read_methodology_version(pg_temp.gid(3),pg_temp.gid(57),pg_temp.gid(1000),pg_temp.gid(1001))$$,
  'P0001','solmind_methodology_denied','expired Admin session cannot retrieve its own prepared artifact');
update identity.user_session set expires_at=now()+interval '1 hour' where user_session_id=pg_temp.gid(57);
select is((select count(*)::integer from audit.audit_event where event_type='methodology_context_pack_version_created'
  and target_entity_id=pg_temp.gid(1001)),1,'register replay emits no duplicate audit');
select throws_ok($$select pg_temp.register_version(1001,null,null,'Changed content')$$,
  'P0001','solmind_methodology_operation_conflict','same operation with changed content conflicts');
select throws_ok($$select pg_temp.register_version(1010,null,2200)$$,
  'P0001','solmind_methodology_operation_conflict','existing pack requires exact latest predecessor');
select throws_ok($$select pg_temp.register_version(1010,1001,2200,null,5,58)$$,
  'P0001','solmind_methodology_denied','another current Admin cannot continue this private prepared artifact');
select lives_ok($$select * from public.solmind_read_methodology_version(pg_temp.gid(3),pg_temp.gid(57),pg_temp.gid(1000),pg_temp.gid(1001))$$,
  'preparing Admin can read exact artifact');
select lives_ok($$select * from public.solmind_read_methodology_version(pg_temp.gid(2),pg_temp.gid(56),pg_temp.gid(1000),pg_temp.gid(1001))$$,
  'owning Guide can read exact scoped artifact');
select throws_ok($$select * from public.solmind_read_methodology_version(pg_temp.gid(5),pg_temp.gid(58),pg_temp.gid(1000),pg_temp.gid(1001))$$,
  'P0001','solmind_methodology_denied','other Admin cannot retrieve preparation content');
select throws_ok($$select * from public.solmind_read_methodology_version(pg_temp.gid(6),pg_temp.gid(59),pg_temp.gid(1000),pg_temp.gid(1001))$$,
  'P0001','solmind_methodology_denied','unrelated Guide cannot read artifact');
select throws_ok($$select * from public.solmind_read_methodology_version(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(1000),pg_temp.gid(1001))$$,
  'P0001','solmind_methodology_denied','Explorer cannot use privileged workflow read');
select throws_ok($$select * from pg_temp.resolve()$$,'P0001','solmind_methodology_denied','unapproved draft is unavailable to Explorer');
select throws_ok($$select pg_temp.admin_review(1001)$$,'P0001','solmind_methodology_denied','Admin cannot review absent actual bound screen');
select throws_ok($$select * from pg_temp.screen_start(1001,null,repeat('A',64))$$,
  'P0001','solmind_methodology_denied','screen preparation rejects mismatched exact digest');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.screen_start(1001)),'first exact screen receipt permits at most one hypothetical dispatch');
select ok((select outcome='exact_replay' and not dispatch_permitted from pg_temp.screen_start(1001)),'screen retry never permits a second dispatch');
select throws_ok($$select * from pg_temp.screen_start(1001,9001)$$,'P0001','solmind_methodology_denied','another operation cannot rescreen same immutable version');
select throws_ok($$select * from public.solmind_record_methodology_screen(pg_temp.gid(3001),pg_temp.gid(4001),pg_temp.gid(1001),
  pg_temp.sha(1001),repeat('F',64),'completed',jsonb_build_object('result','pass','subject_sha256',pg_temp.sha(1001),'findings','[]'::jsonb))$$,
  'P0001','solmind_methodology_denied','terminal result cannot be attached to a different actual request receipt');
select is(pg_temp.screen_terminal(1001),'ok','synthetic exact bound pass completes through actual SQL path');
select is(pg_temp.screen_terminal(1001),'exact_replay','exact terminal retry writes no duplicate evidence');
select throws_ok($$select pg_temp.screen_terminal(1001,'failed')$$,'P0001','solmind_methodology_operation_conflict','completed outcome cannot change');
select throws_ok($$update ai.ai_model_invocation set model_name='changed' where ai_model_invocation_id=pg_temp.gid(4001)$$,
  'P0001','solmind_methodology_evidence_immutable','completed invocation provenance is immutable');
select throws_ok($$update methodology.screen_attempt set terminal_sha256=repeat('F',64) where screen_operation_id=pg_temp.gid(3001)$$,
  'P0001','solmind_methodology_evidence_immutable','completed attempt receipt is immutable');
select throws_ok($$select pg_temp.admin_review(1001,9002,5,58)$$,'P0001','solmind_methodology_denied','other Admin cannot record consistency review');
select is(pg_temp.admin_review(1001),'ok','preparing Admin reviews nonfail exact screen');
select is(pg_temp.admin_review(1001),'exact_replay','Admin consistency retry writes no new audit');
select throws_ok($$select pg_temp.guide_decision(1001,null,'approve',9003,6,59)$$,
  'P0001','solmind_methodology_denied','unrelated Guide cannot approve');
select throws_ok($$select pg_temp.guide_decision(1001,null,'approve',9003,2,56,false)$$,
  'P0001','solmind_methodology_invalid_input','Guide must affirm exact clinician/concealment/safety checklist');
select is(pg_temp.guide_decision(1001),'ok','owning authenticated Guide approval and effectiveness are atomic');
select is(pg_temp.guide_decision(1001),'exact_replay','Guide approval retry is idempotent');
select ok((select methodology_context_pack_version_id=pg_temp.gid(1001) and version_number=1
  and content_sha256=pg_temp.sha(1001) and methodology_authorization_version ~ '^MV1:[0-9A-F]{64}$' from pg_temp.resolve()),
  'Explorer resolves exact current fully evidenced version');
create temp table selection_one as select * from pg_temp.resolve();
set local timezone='Pacific/Auckland';
select is((select methodology_authorization_version from pg_temp.resolve()),
  (select methodology_authorization_version from selection_one),'MV1 does not change with session time zone');
set local timezone='UTC';
select throws_ok($$select * from public.solmind_resolve_explorer_methodology(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(1000),'practice',pg_temp.gid(22))$$,
  'P0001','solmind_methodology_denied','operational practice scope refuses instead of falling back');
select throws_ok($$select * from public.solmind_resolve_explorer_methodology(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(1000),'guide',pg_temp.gid(29))$$,
  'P0001','solmind_methodology_denied','exact authorized Guide scope must match current topology');
select throws_ok($$update methodology.methodology_context_pack set guide_profile_id=pg_temp.gid(29) where methodology_context_pack_id=pg_temp.gid(1000)$$,
  'P0001','solmind_methodology_pack_immutable','pack scope cannot be rewritten');
select throws_ok($$update audit.audit_event set event_summary='changed' where event_type='methodology_context_pack_guide_approved'
  and target_entity_id=pg_temp.gid(1001)$$,'P0001','solmind_methodology_audit_immutable','completed approval audit cannot be rewritten');
select throws_ok($$select r.* from selection_one s cross join lateral pg_temp.prepare_governed(90,s.methodology_context_pack_version_id,
  repeat('F',64),s.methodology_authorization_version) r$$,'P0001','solmind_methodology_denied','governed preparation denies a separately supplied false content digest');
select throws_ok($$select r.* from selection_one s cross join lateral pg_temp.prepare_governed(90,s.methodology_context_pack_version_id,
  s.content_sha256,s.methodology_authorization_version,0,'Synthetic governed message',
  jsonb_set(pg_temp.context_bytes(s.methodology_context_pack_version_id)::jsonb,'{methodologyContext,text}','"Changed stored methodology"')::text) r$$,
  'P0001','solmind_methodology_denied','new prepare rejects altered methodology text with a recomputed outer fingerprint');
select throws_ok($$select r.* from selection_one s cross join lateral pg_temp.prepare_governed(90,s.methodology_context_pack_version_id,
  s.content_sha256,s.methodology_authorization_version,0,'Synthetic governed message',
  jsonb_set(pg_temp.context_bytes(s.methodology_context_pack_version_id)::jsonb,'{methodologyContext,version}','"methodology:wrong"')::text) r$$,
  'P0001','solmind_methodology_denied','new prepare rejects altered methodology version label with a recomputed fingerprint');
select throws_ok($$select r.* from selection_one s cross join lateral pg_temp.prepare_governed(90,s.methodology_context_pack_version_id,
  s.content_sha256,s.methodology_authorization_version,0,'Synthetic governed message',
  left(pg_temp.context_bytes(s.methodology_context_pack_version_id),-1)||',"methodologyContext":'||
    (pg_temp.context_bytes(s.methodology_context_pack_version_id)::jsonb->'methodologyContext')::text||'}') r$$,
  'P0001','solmind_methodology_denied','duplicate top-level methodology keys refuse even when both values match');
select throws_ok($$select r.* from selection_one s cross join lateral pg_temp.prepare_governed(90,s.methodology_context_pack_version_id,
  s.content_sha256,s.methodology_authorization_version,0,'Synthetic governed message',replace(
    pg_temp.context_bytes(s.methodology_context_pack_version_id),'"methodologyContext": {',
    '"methodologyContext": {"version":"methodology:'||s.methodology_context_pack_version_id::text||'",')) r$$,
  'P0001','solmind_methodology_denied','duplicate nested methodology version key refuses');
select ok((select r.outcome='ok' and r.dispatch_permitted from selection_one s cross join lateral pg_temp.prepare_governed(0,
  s.methodology_context_pack_version_id,s.content_sha256,s.methodology_authorization_version) r),'new governed prepare persists exact snapshot binding before dispatch permission');
select ok((select b.methodology_context_pack_version_id=pg_temp.gid(1001) and b.content_sha256=s.content_sha256
  and b.methodology_authorization_version=s.methodology_authorization_version from methodology.explorer_methodology_binding b,
  selection_one s where b.ai_context_snapshot_id=pg_temp.gid(6000)),'governed snapshot has exact durable MV1/SHA/version linkage');
select is((select count(*)::integer from methodology.explorer_methodology_binding where ai_context_snapshot_id=pg_temp.gid(6000)),1,
  'one governed snapshot has one binding');
select throws_ok($$update methodology.explorer_methodology_binding set content_sha256=repeat('A',64) where ai_context_snapshot_id=pg_temp.gid(6000)$$,
  'P0001','solmind_methodology_evidence_immutable','snapshot governance binding is append-only');
select is((select outcome from public.solmind_complete_explorer_conversation_turn(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
  pg_temp.gid(6001),'completed',pg_temp.gid(6006),'Synthetic local reply; no provider call.')),'ok','synthetic terminal reply completes old turn');

-- The next approved version takes effect inside the same conversation.
select is(pg_temp.register_version(1002,1001),'ok','next version registers with exact serial predecessor');
select is((select version_number from methodology.methodology_context_pack_version where methodology_context_pack_version_id=pg_temp.gid(1002)),2,
  'sequential version number is assigned under pack serialization');
select set_config('solmind.fixture.fail_audit_event','methodology_context_pack_screen_started',true);
select throws_ok($$select * from pg_temp.screen_start(1002)$$,'P0001','solmind_methodology_unavailable','screen-start audit failure fails whole preparation');
select ok(not exists(select 1 from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gid(4002))
  and not exists(select 1 from methodology.screen_attempt where screen_operation_id=pg_temp.gid(3002)),
  'failed start leaves no invocation or attempt');
select set_config('solmind.fixture.fail_audit_event','',true);
select ok((select dispatch_permitted from pg_temp.screen_start(1002)),'screen can start after rolled-back local audit failure');
select is(pg_temp.screen_terminal(1002,'completed','review',
  '[{"criterion":"concealment","severity":"review","excerpt":"Synthetic","explanation":"Synthetic review finding only."}]'),
  'ok','nonfail review findings are retained as protected version evidence');
select throws_ok($$select pg_temp.guide_decision(1002,1001)$$,'P0001','solmind_methodology_invalid_input','Guide cannot skip focused Admin consistency review');
select set_config('solmind.fixture.fail_audit_event','methodology_context_pack_admin_reviewed',true);
select throws_ok($$select pg_temp.admin_review(1002)$$,'P0001','solmind_methodology_unavailable','Admin audit failure refuses review atomically');
select ok((select approval_status='draft' and admin_consistency_reviewed_at is null from methodology.methodology_context_pack_version
  where methodology_context_pack_version_id=pg_temp.gid(1002)), 'failed Admin audit leaves no completed review');
select set_config('solmind.fixture.fail_audit_event','',true);
select is(pg_temp.admin_review(1002),'ok','focused Admin review follows exact review-result screen');
select set_config('solmind.fixture.fail_audit_event','methodology_context_pack_version_activated',true);
select throws_ok($$select pg_temp.guide_decision(1002,1001)$$,'P0001','solmind_methodology_unavailable','activation audit failure rolls back whole approval');
select ok((select active_version_id=pg_temp.gid(1001) from methodology.methodology_context_pack where methodology_context_pack_id=pg_temp.gid(1000))
  and (select approval_status='needs_guide_review' and approved_at is null from methodology.methodology_context_pack_version
    where methodology_context_pack_version_id=pg_temp.gid(1002)), 'audit failure preserves old pointer and unapproved candidate');
select is((select count(*)::integer from audit.audit_event where event_type='methodology_context_pack_guide_approved'
  and target_entity_id=pg_temp.gid(1002)),0,'failed activation leaves no orphan Guide approval audit');
select set_config('solmind.fixture.fail_audit_event','',true);
select is(pg_temp.guide_decision(1002,1001),'ok','new exact approval atomically supersedes prior effective version');
create temp table selection_two as select * from pg_temp.resolve();
select ok((select methodology_context_pack_version_id=pg_temp.gid(1002) and version_number=2 from selection_two)
  and (select approval_status='superseded' and superseded_at is not null from methodology.methodology_context_pack_version
    where methodology_context_pack_version_id=pg_temp.gid(1001)), 'resolver follows new effective pointer and preserves prior immutable record');
select throws_ok($$select r.* from selection_one s cross join lateral pg_temp.prepare_governed(1,s.methodology_context_pack_version_id,
  s.content_sha256,s.methodology_authorization_version,2) r$$,'P0001','solmind_methodology_denied','final prepare denies pointer drift after context assembly');
select ok(not exists(select 1 from ai.ai_context_snapshot where ai_context_snapshot_id=pg_temp.gid(6010)),
  'pointer drift creates no new snapshot/invocation');
select ok((select r.outcome='exact_replay' and not r.dispatch_permitted from selection_one s cross join lateral pg_temp.prepare_governed(0,
  s.methodology_context_pack_version_id,s.content_sha256,s.methodology_authorization_version) r),
  'direct exact retry uses original binding after new version activation');
select throws_ok($$select r.* from selection_one s cross join lateral pg_temp.prepare_governed(0,s.methodology_context_pack_version_id,
  s.content_sha256,s.methodology_authorization_version,0,'Changed command bytes') r$$,
  'P0001','solmind_explorer_conversation_operation_conflict','direct retry still verifies complete original v2 fingerprint');
select throws_ok($$select r.* from selection_one s cross join lateral pg_temp.prepare_governed(0,s.methodology_context_pack_version_id,
  s.content_sha256,'MV1:'||repeat('F',64)) r$$,'P0001','solmind_methodology_operation_conflict','direct retry rejects changed original governance binding');
select ok((select r.outcome='ok' and r.dispatch_permitted from selection_two s cross join lateral pg_temp.prepare_governed(1,
  s.methodology_context_pack_version_id,s.content_sha256,s.methodology_authorization_version,2) r),
  'next new turn uses newly effective methodology inside same conversation');
select is((select methodology_context_pack_version_id from ai.ai_context_snapshot where ai_context_snapshot_id=pg_temp.gid(6000)),pg_temp.gid(1001),
  'old response provenance remains on old version');
select is((select methodology_context_pack_version_id from ai.ai_context_snapshot where ai_context_snapshot_id=pg_temp.gid(6010)),pg_temp.gid(1002),
  'new response snapshot records new version');
select is((select count(*)::integer from methodology.explorer_methodology_binding where ai_context_snapshot_id in (pg_temp.gid(6000),pg_temp.gid(6010))),2,
  'retries and pointer drift add no duplicate bindings');

create function pg_temp.legacy_prepare(governed boolean default false) returns text language plpgsql as $$
declare a jsonb; ids uuid[]; c text:='{"syntheticLegacyContext":true}'; result_name text;
begin
  select authority_context into a from public.solmind_read_explorer_conversation(pg_temp.gid(4),pg_temp.gid(54));
  select array_agg(x order by x) into ids from unnest(array[pg_temp.gid(55),pg_temp.gid(7002),pg_temp.gid(9999)]) x;
  if not governed then
    select outcome into result_name from public.solmind_prepare_explorer_conversation_turn(
      pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(7005),pg_temp.gid(7001),0,pg_temp.gid(7002),pg_temp.gid(7000),pg_temp.gid(7003),
      'Synthetic legacy message',c,upper(encode(extensions.digest(convert_to(c,'UTF8'),'sha256'),'hex')),ids,
      a->>'authorizationVersion',pg_temp.gid(55),pg_temp.gid(9999),'synthetic-prompt.v1','synthetic-policy.v1',
      'synthetic-behavior.v1','synthetic-crisis.v1','synthetic-role.v1','synthetic-instruction.v1',repeat('D',64),pg_temp.gid(7004));
  else
    select outcome into result_name from public.solmind_prepare_governed_explorer_conversation_turn(
      pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(7005),pg_temp.gid(7001),0,pg_temp.gid(7002),pg_temp.gid(7000),pg_temp.gid(7003),
      'Synthetic legacy message',c,upper(encode(extensions.digest(convert_to(c,'UTF8'),'sha256'),'hex')),ids,
      a->>'authorizationVersion',pg_temp.gid(55),pg_temp.gid(9999),'synthetic-prompt.v1','synthetic-policy.v1',
      'synthetic-behavior.v1','synthetic-crisis.v1','synthetic-role.v1','synthetic-instruction.v1',repeat('D',64),pg_temp.gid(7004),
      pg_temp.gid(1000),pg_temp.sha(1002),(select methodology_authorization_version from selection_two));
  end if;
  return result_name;
end $$;
select is(pg_temp.legacy_prepare(),'ok','legacy v2 still accepts its arbitrary synthetic methodology UUID path');
select ok(not exists(select 1 from methodology.explorer_methodology_binding where ai_context_snapshot_id=pg_temp.gid(7000)),
  'legacy operation is not silently enriched');
select throws_ok($$select pg_temp.legacy_prepare(true)$$,'P0001','solmind_methodology_operation_conflict',
  'a legacy exact operation cannot be upgraded into governed provenance');

insert into methodology.methodology_context_pack(methodology_context_pack_id,scope_type,guide_profile_id,pack_name,
  created_by_user_account_id,created_by_role_context) values(pg_temp.gid(1100),'guide',pg_temp.gid(23),
  'Synthetic Guide-authored private artifact',pg_temp.gid(2),'guide');
insert into methodology.methodology_context_pack_version(methodology_context_pack_version_id,methodology_context_pack_id,version_number,
  content_markdown,content_sha256,created_by_actor_type,created_by_user_account_id,created_by_role_context,
  source_type,source_actor_label,source_provenance,ai_change_summary)
  values(pg_temp.gid(1101),pg_temp.gid(1100),1,'Synthetic Guide-only canary.',
    upper(encode(extensions.digest(convert_to('Synthetic Guide-only canary.','UTF8'),'sha256'),'hex')),
    'guide',pg_temp.gid(2),'guide','guide_edited','Synthetic fixture','[{"fixture":"private Guide artifact"}]','Synthetic summary.');
select throws_ok($$select * from public.solmind_read_methodology_version(pg_temp.gid(3),pg_temp.gid(57),pg_temp.gid(1100),pg_temp.gid(1101))$$,
  'P0001','solmind_methodology_denied','Admin cannot use methodology read to retrieve Guide-authored private artifacts');
select throws_ok($$select * from public.solmind_read_methodology_version(pg_temp.gid(2),pg_temp.gid(56),pg_temp.gid(1100),pg_temp.gid(1101))$$,
  'P0001','solmind_methodology_denied','initial workflow has no Guide-authoring bypass even for owning Guide');

-- A syntactically valid pass/UUID/FK cannot impersonate a screen attempt.
select is(pg_temp.register_version(1003,1002),'ok','new immutable version can follow active predecessor');
update methodology.methodology_context_pack_version set safety_screen_result='pass',safety_screen_invocation_id=pg_temp.gid(4001),
  safety_screen_audit_event_id=(select safety_screen_audit_event_id from methodology.methodology_context_pack_version where methodology_context_pack_version_id=pg_temp.gid(1001)),
  safety_screen_completed_at=clock_timestamp(),metadata=jsonb_build_object('safety_screen',jsonb_build_object('result','pass',
    'screen_invocation_id',pg_temp.gid(4001)::text,'content_sha256',pg_temp.sha(1003),'cited_excerpts','[]'::jsonb))
  where methodology_context_pack_version_id=pg_temp.gid(1003);
select throws_ok($$select * from public.solmind_confirm_methodology_admin_review(pg_temp.gid(3),pg_temp.gid(57),pg_temp.gid(9004),
  pg_temp.gid(1000),pg_temp.gid(1003),pg_temp.sha(1003),pg_temp.gid(4001))$$,
  'P0001','solmind_methodology_denied','forged pass/FK row cannot satisfy actual screen-attempt provenance');

select is(pg_temp.register_version(1004,1003),'ok','later version can follow an unusable draft without modifying it');
select ok((select dispatch_permitted from pg_temp.screen_start(1004)),'rejection candidate screen starts once');
select is(pg_temp.screen_terminal(1004),'ok','rejection candidate has synthetic nonfail screen');
select is(pg_temp.admin_review(1004),'ok','rejection candidate reviewed by preparing Admin');
select is(pg_temp.guide_decision(1004,1002,'reject'),'ok','owning Guide can reject without activation');
select ok((select approval_status='rejected' and approved_at is null from methodology.methodology_context_pack_version
  where methodology_context_pack_version_id=pg_temp.gid(1004)) and (select active_version_id=pg_temp.gid(1002)
  from methodology.methodology_context_pack where methodology_context_pack_id=pg_temp.gid(1000)), 'rejection leaves current effective version unchanged');
select throws_ok($$select pg_temp.guide_decision(1004,1002,'approve',9005)$$,'P0001','solmind_methodology_denied','rejected version cannot be reactivated through initial MVP0 workflow');

select is(pg_temp.register_version(1005,1004),'ok','failed screen candidate registers independently');
select ok((select dispatch_permitted from pg_temp.screen_start(1005)),'failed screen candidate starts exactly once');
select is(pg_temp.screen_terminal(1005,'completed','fail',
  '[{"criterion":"concealment","severity":"fail","excerpt":"Synthetic","explanation":"Synthetic failure fixture."}]'),
  'ok','completed failing synthetic screen is retained');
select throws_ok($$select pg_temp.admin_review(1005)$$,'P0001','solmind_methodology_denied','failed screen cannot be approved or overridden by Admin');
select is(pg_temp.register_version(1006,1005),'ok','terminal-error candidate needs a new immutable version');
select ok((select dispatch_permitted from pg_temp.screen_start(1006)),'terminal-error candidate starts once');
select is(pg_temp.register_version(1007,1006),'ok','cancellation candidate is another immutable version');
select ok((select dispatch_permitted from pg_temp.screen_start(1007)),'cancellation candidate starts once');
select set_config('solmind.fixture.fail_audit_event','methodology_context_pack_version_created',true);
select throws_ok($$select pg_temp.register_version(1010,1007)$$,'P0001','solmind_methodology_unavailable','registration audit failure rolls back immutable version creation');
select ok(not exists(select 1 from methodology.methodology_context_pack_version where methodology_context_pack_version_id=pg_temp.gid(1010))
  and not exists(select 1 from methodology.workflow_operation where operation_id=pg_temp.gid(2010)),
  'registration audit failure leaves no version or operation');
select set_config('solmind.fixture.fail_audit_event','context_pack_safety_screen',true);
select throws_ok($$select pg_temp.screen_terminal(1006)$$,'P0001','solmind_methodology_unavailable','screen-completion audit failure rolls back invocation completion');
select ok((select request_status='started' from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gid(4006))
  and (select terminal_status is null from methodology.screen_attempt where screen_operation_id=pg_temp.gid(3006)),
  'completion audit failure leaves original started receipt intact');
select set_config('solmind.fixture.fail_audit_event','',true);
update identity.user_session set session_status='logged_out',ended_at=clock_timestamp() where user_session_id=pg_temp.gid(57);
select is(pg_temp.screen_terminal(1006,'failed'),'ok','system may settle exact previously authorized failure after initiating Admin logout');
select is(pg_temp.screen_terminal(1007,'canceled'),'ok','system may settle cancellation after initiating Admin logout');
select is(pg_temp.screen_terminal(1006,'failed'),'exact_replay','terminal failure retry is idempotent and cannot redispatch');
select throws_ok($$select * from pg_temp.screen_start(1006)$$,'P0001','solmind_methodology_denied','logged-out Admin cannot authorize another preparation or retry');
update identity.user_session set session_status='logged_out',ended_at=clock_timestamp() where user_session_id=pg_temp.gid(56);
select is((select methodology_context_pack_version_id from pg_temp.resolve()),pg_temp.gid(1002),
  'historical Admin and Guide approval sessions remain valid after ordinary later logout');
select throws_ok($$select pg_temp.guide_decision(1002,1001)$$,'P0001','solmind_methodology_denied','human approval retry still requires current Guide session authority');
update identity.user_session set expires_at=clock_timestamp()-interval '1 second' where user_session_id=pg_temp.gid(50);
select throws_ok($$select * from pg_temp.resolve()$$,'P0001','solmind_methodology_denied','current Explorer session expiry denies resolver');

select * from finish();
rollback;
