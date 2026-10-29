-- Focused prospective formation Route and actual Reached readback proof.
-- Synthetic disposable-project SQL only; no retained demo data or provider calls.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,pg_catalog,pg_temp;
set local statement_timeout='120s';
select no_plan();

create function pg_temp.gid(n integer) returns uuid language sql immutable as $$
  select ('f42a0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
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
create function pg_temp.screen_start(n integer,op_n integer default null,sha_override text default null,selected_model text default 'gpt-5.6-luna')
returns table(outcome text,dispatch_permitted boolean) language sql as $$
  select r.outcome,r.dispatch_permitted from public.solmind_prepare_methodology_screen(pg_temp.gid(3),pg_temp.gid(57),
    pg_temp.gid(coalesce(op_n,n+2000)),pg_temp.gid(1000),pg_temp.gid(n),pg_temp.gid(n+3000),
    coalesce(sha_override,pg_temp.sha(n)),'synthetic-screen-policy.v1',repeat('B',64),pg_temp.request_sha(n),selected_model) r
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

create function pg_temp.compact(value jsonb) returns text language plpgsql immutable as $$
declare result text;
begin
  if jsonb_typeof(value)='object' then
    select '{'||coalesce(string_agg(to_jsonb(x.key)::text||':'||pg_temp.compact(x.value),',' order by x.key),'')||'}'
      into result from jsonb_each(value) x;
  elsif jsonb_typeof(value)='array' then
    select '['||coalesce(string_agg(pg_temp.compact(x.value),',' order by x.ord),'')||']'
      into result from jsonb_array_elements(value) with ordinality x(value,ord);
  else result:=value::text; end if;
  return result;
end $$;
create function pg_temp.ensure_anchor(candidate_n integer default 6005,actor_n integer default 1,app_n integer default 50)
returns table(outcome text,conversation_state jsonb,authority_context jsonb,policy_state jsonb)
language plpgsql as $$
declare e jsonb;
begin
  e:=methodology.resolve_effective(pg_temp.gid(1000),pg_temp.gid(23));
  return query select * from public.solmind_ensure_explorer_conversation_v3(pg_temp.gid(actor_n),pg_temp.gid(app_n),
    pg_temp.gid(candidate_n),0,pg_temp.gid(1000),(e->>'versionId')::uuid,e->>'contentSha256',
    e->>'methodologyAuthorizationVersion',repeat('A',64));
end $$;
create function pg_temp.context_value(msg uuid,body text) returns jsonb language sql stable as $$
  select jsonb_build_object('contractVersion','wi007-v0.1+onboarding-fields-v2','aiRole','solmind_virtual_guide','actorRoleContext','explorer',
    'globalPolicy',jsonb_build_object('version','synthetic-policy.v1','text','Synthetic policy.'),
    'roleBehavior',jsonb_build_object('version','synthetic-behavior.v1','text','Synthetic behavior.'),
    'crisisBehavior',jsonb_build_object('version','synthetic-crisis.v1','text','Synthetic crisis.'),
    'methodologyContext',jsonb_build_object('version','methodology:'||v.methodology_context_pack_version_id::text,'text',v.content_markdown),
    'sessionContext',jsonb_build_object('sessionType','explorer_virtual_guide','explorerId',pg_temp.gid(24),
      'sessionId',pg_temp.gid(6005),'continuityBindingId',pg_temp.gid(25),'explorerDisplayName',null,
      'activeFocusItems','[]'::jsonb,'nextAppointment',null,'explorerSafeGuardrail',null),
    'approvedContinuity',(select jsonb_agg(jsonb_build_object('sourceId',pg_temp.gid(52),'order',f.ord-1,
      'kind','onboarding_answer','field',f.name,'content',ai.solmind_exclusion_normalize_v3(i.response_json->>f.name)) order by f.ord)
      from core.intake_response_set i cross join unnest(array['supportNow','usefulOutcome','supportStyle','guideContext',
        'communicationPreference','doNotEmphasize']) with ordinality f(name,ord) where i.intake_response_set_id=pg_temp.gid(52)),
    'currentSessionMessages',coalesce((select jsonb_agg(jsonb_build_object('messageId',h.ai_interaction_message_id,'order',h.ord-1,
      'explorerId',pg_temp.gid(24),'sessionId',pg_temp.gid(6005),
      'role',case when h.sender_type='user' then 'explorer' else 'solmind_virtual_guide' end,
      'content',ai.solmind_exclusion_normalize_v3(h.content_text)) order by h.ord)
      from (select x.*,row_number() over(order by x.sequence_number) as ord from (select * from ai.ai_interaction_message
        where ai_interaction_session_id=pg_temp.gid(6005) order by sequence_number desc limit 24) x) h),'[]'::jsonb),
    'immediateExplorerMessage',jsonb_build_object('messageId',msg,'explorerId',pg_temp.gid(24),
      'sessionId',pg_temp.gid(6005),'role','explorer','content',body),
    'outputRequirements',jsonb_build_object('format','plain_text','includeCitations',false,'allowMarkdown',false))
  from methodology.methodology_context_pack_version v where v.methodology_context_pack_version_id=pg_temp.gid(1001)
$$;
create temp table lifecycle_intent (
  slot integer primary key,revision integer,body text,serialization text,source_ids uuid[],authority text,
  safety_version bigint,mode text,fallback smallint,minor boolean,methodology_sha text,mv text
);
create function pg_temp.observe(slot integer,lvl integer default 0,minor_flag boolean default false)
returns table(outcome text,policy_state jsonb) language plpgsql as $$
declare rev integer;
begin
  select revision into rev from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005);
  return query select * from public.solmind_observe_explorer_conversation_fallback_v3(
    pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(10000+slot*10),pg_temp.gid(10004+slot*10),
    rev,methodology.hash_json(jsonb_build_array('synthetic-command',slot)),'explorer-safety-reply.v1',
    'synthetic-fallback.v1','synthetic-model-policy.v1',repeat('A',64),lvl::smallint,minor_flag);
end $$;
create function pg_temp.prepare_private(slot_n integer,lvl integer default 0,minor_flag boolean default false,
  body_override text default null,selected_model text default 'gpt-5.6-luna')
returns table(outcome text,conversation_state jsonb,dispatch_permitted boolean,policy_state jsonb)
language plpgsql as $$
declare saved lifecycle_intent%rowtype; a jsonb; policy jsonb; e jsonb; msg uuid:=pg_temp.gid(10001+slot_n*10);
  src uuid[]; c text; b text:=coalesce(body_override,'Synthetic private message '||slot_n||'.');
begin
  select * into saved from lifecycle_intent where slot=slot_n;
  if not found then
    select r.authority_context,r.policy_state into a,policy from public.solmind_read_explorer_conversation_v3(
      pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005)) r;
    e:=methodology.resolve_effective(pg_temp.gid(1000),pg_temp.gid(23));
    c:=pg_temp.compact(pg_temp.context_value(msg,b));
    select array_agg(distinct id order by id) into src from (
      select unnest(array[pg_temp.gid(52),msg,pg_temp.gid(1001)]) id union all
      select m.ai_interaction_message_id from (select * from ai.ai_interaction_message
        where ai_interaction_session_id=pg_temp.gid(6005) order by sequence_number desc limit 24) m
    ) selected;
    insert into lifecycle_intent values(slot_n,(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),
      b,c,src,a->>'authorizationVersion',(policy->>'version')::bigint,
      case when policy->>'restrictedLevel' is not null or (policy->>'adultReflectionStopped')::boolean or lvl>=3 or minor_flag
        then 'classification_only' else 'classification_and_reply' end,lvl,minor_flag,e->>'contentSha256',e->>'methodologyAuthorizationVersion');
    select * into saved from lifecycle_intent where slot=slot_n;
  end if;
  return query select * from public.solmind_prepare_explorer_conversation_turn_v3(
    pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(10000+slot_n*10),saved.revision,msg,
    pg_temp.gid(10002+slot_n*10),pg_temp.gid(10003+slot_n*10),coalesce(body_override,saved.body),saved.serialization,
    upper(encode(extensions.digest(convert_to(saved.serialization,'UTF8'),'sha256'),'hex')),saved.source_ids,saved.authority,
    pg_temp.gid(52),pg_temp.gid(1001),'synthetic-prompt.v1','synthetic-policy.v1','synthetic-behavior.v1','synthetic-crisis.v1',
    'synthetic-role.v1','synthetic-instruction.v1',methodology.hash_json(jsonb_build_array('synthetic-command',slot_n)),
    pg_temp.gid(10004+slot_n*10),pg_temp.gid(1000),saved.methodology_sha,saved.mv,'explorer-safety-reply.v1',saved.mode,
    repeat('A',64),'synthetic-fallback.v1','synthetic-model-policy.v1','synthetic-trusted.v1','synthetic-resources.v1',
    saved.safety_version,saved.fallback,saved.minor,selected_model);
end $$;
create function pg_temp.settle_private(slot_n integer,model integer default 0,minor_flag boolean default false,
  kind text default 'ordinary',body text default 'Synthetic saved reply.',status_name text default 'completed',
  interested boolean default true,fallback_override integer default null)
returns table(outcome text,conversation_state jsonb,policy_state jsonb,saved_reply boolean)
language sql as $$
  select * from public.solmind_settle_explorer_conversation_turn_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(10000+slot_n*10),status_name,case when kind='none' then null else pg_temp.gid(10005+slot_n*10) end,
    kind,case when kind='none' then null else body end,model::smallint,minor_flag,'explorer-safety-reply.v1',
    (select mode from lifecycle_intent where slot=slot_n),repeat('A',64),'synthetic-fallback.v1',
    'synthetic-model-policy.v1','synthetic-trusted.v1','synthetic-resources.v1',
    coalesce(fallback_override,(select fallback from lifecycle_intent where slot=slot_n))::smallint,
    (select minor from lifecycle_intent where slot=slot_n),interested)
$$;

-- Establish the existing synthetic governed source fixture. No provider is called;
-- the recorded screen/reply below are SQL protocol fixtures, not human/AI proof.
do $$ begin
  if pg_temp.register_version(1001) is distinct from 'ok' then raise exception 'synthetic_formation_register_failed'; end if;
  if not exists(select 1 from pg_temp.screen_start(1001) where outcome='ok' and dispatch_permitted) then raise exception 'synthetic_formation_screen_prepare_failed'; end if;
  if pg_temp.screen_terminal(1001) is distinct from 'ok' then raise exception 'synthetic_formation_screen_terminal_failed'; end if;
  if pg_temp.admin_review(1001) is distinct from 'ok' then raise exception 'synthetic_formation_admin_failed'; end if;
  if pg_temp.guide_decision(1001) is distinct from 'ok' then raise exception 'synthetic_formation_guide_failed'; end if;
  if not exists(select 1 from pg_temp.ensure_anchor() where outcome='created') then raise exception 'synthetic_formation_anchor_failed'; end if;
  if not exists(select 1 from pg_temp.prepare_private(1) where outcome='ok' and dispatch_permitted) then raise exception 'synthetic_formation_prepare_failed'; end if;
  if not exists(select 1 from pg_temp.settle_private(1) where outcome='ok' and saved_reply) then raise exception 'synthetic_formation_settle_failed'; end if;
end $$;

create function pg_temp.mutate(op_n integer,kind_name text,source_n integer default null,
  item_n integer default null,waypoint_n integer default null,label_text text default null,
  destination_text text default null,meaning_text text default null,arrival_text text default null,
  evidence_text text default null,revision_override integer default null)
returns table(outcome text,conversation_state jsonb) language sql as $$
  select * from public.solmind_mutate_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(op_n),coalesce(revision_override,
      (select initial_revision from ai.explorer_conversation_operation where actor_user_account_id=pg_temp.gid(1) and operation_id=pg_temp.gid(op_n)),
      (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005))),
    kind_name,pg_temp.request_sha(op_n),case when source_n is null then null else pg_temp.gid(source_n) end,
    case when item_n is null then null else pg_temp.gid(item_n) end,
    case when waypoint_n is null then null else pg_temp.gid(waypoint_n) end,
    label_text,destination_text,meaning_text,arrival_text,evidence_text)
$$;
create function pg_temp.read_state() returns jsonb language sql as $$
  select conversation_state from public.solmind_read_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005))
$$;
create temp table invocation_before as select count(*)::integer n from ai.ai_model_invocation;

select is(pg_temp.read_state()->'route','[]'::jsonb,'saved message turn alone creates no Compass Route');
select is((select outcome from pg_temp.mutate(23001,'add_compass',10011,null,null,'Original first label')),'ok','first saved-source Compass point is added');
select is((select outcome from pg_temp.mutate(23002,'add_compass',10015,null,null,'Original second label')),'ok','second saved-source Compass point is added');
-- This is an owner-created historical-row fixture, not a new application write.
insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
  conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at)
values(pg_temp.gid(1),pg_temp.gid(23999),pg_temp.gid(50),pg_temp.gid(6005),'confirm_priority',
  repeat('C',64),repeat('D',64),0,'completed',clock_timestamp());
select is(pg_temp.read_state()->'route','[]'::jsonb,'legacy completed Priority row and added points are not reconstructed into Route');
select is((select outcome from pg_temp.mutate(23101,'confirm_priority',null,23001)),'ok','first explicit Priority confirmation saves');
select is((select outcome from pg_temp.mutate(23102,'set_attention',null,23002)),'ok','explicit attention movement saves independently');
select is((pg_temp.read_state()->>'priorityId')::uuid,pg_temp.gid(23001),'attention change leaves confirmed Priority unchanged');
select is((select outcome from pg_temp.mutate(23103,'confirm_priority',null,23002)),'ok','explicit reorientation to another Priority saves');
select is((select outcome from pg_temp.mutate(23104,'set_attention',null,23001)),'ok','attention may return to a distinct saved point');
select is((pg_temp.read_state()->>'priorityId')::uuid,pg_temp.gid(23002),'reorientation is distinct from current attention');
select is(jsonb_array_length(pg_temp.read_state()->'route'),4,'only four actual meaningful movements create Route entries');
select is(pg_temp.read_state()->'route',
  (select jsonb_agg(jsonb_build_object('operationId',o.operation_id,'revision',o.initial_revision+1,
    'kind',o.compass_route_kind,'compassItemId',o.compass_route_item_id,'label',o.compass_route_label,
    'recordedAt',o.completed_at) order by o.initial_revision,o.operation_id)
    from ai.explorer_conversation_operation o where o.conversation_id=pg_temp.gid(6005) and o.compass_route_kind is not null),
  'Route readback has exactly the six specified keys and each final resulting revision/time');
select is((select array_agg(e->>'kind' order by ord) from jsonb_array_elements(pg_temp.read_state()->'route') with ordinality r(e,ord)),
  array['priority_confirmed','attention_changed','priority_reoriented','attention_changed']::text[],
  'Route preserves meaningful chronological order and distinguishes initial confirmation from reorientation');
select is((select array_agg((e->>'operationId')::uuid order by ord) from jsonb_array_elements(pg_temp.read_state()->'route') with ordinality r(e,ord)),
  array[pg_temp.gid(23101),pg_temp.gid(23102),pg_temp.gid(23103),pg_temp.gid(23104)],
  'Route links each actual saved operation in order');
create temp table route_saved as select pg_temp.read_state()->'route' value;
select is(pg_temp.read_state()->'route',(select value from route_saved),'owned reload preserves all saved Route facts');
select is((select outcome from pg_temp.mutate(23103,'confirm_priority',null,23002)),'exact_replay','same exact Priority operation replays');
select is(pg_temp.read_state()->'route',(select value from route_saved),'exact replay appends no Route event');
select is((select outcome from pg_temp.mutate(23105,'confirm_priority',null,23002)),'ok','new same-Priority request keeps ordinary mutation compatibility');
select is((select outcome from pg_temp.mutate(23106,'set_attention',null,23001)),'ok','new same-attention request keeps ordinary mutation compatibility');
select ok((select compass_route_kind is null and compass_route_item_id is null and compass_route_label is null
  from ai.explorer_conversation_operation where operation_id=pg_temp.gid(23105))
  and (select compass_route_kind is null and compass_route_item_id is null and compass_route_label is null
  from ai.explorer_conversation_operation where operation_id=pg_temp.gid(23106)),
  'no-op operations retain all three NULL Route facts');
select is(pg_temp.read_state()->'route',(select value from route_saved),'no-op requests create no new meaningful history');
select is((select outcome from pg_temp.mutate(23107,'confirm_priority',null,23001,null,null,null,null,null,null,0)),'stale_revision','stale new movement is refused');
select ok(not exists(select 1 from ai.explorer_conversation_operation where operation_id=pg_temp.gid(23107))
  and pg_temp.read_state()->'route'=(select value from route_saved),'stale request creates no operation or Route event');
select throws_ok($$select * from public.solmind_mutate_explorer_conversation_v3(pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6005),
  pg_temp.gid(23108),0,'confirm_priority',pg_temp.request_sha(23108),null,pg_temp.gid(23001))$$,
  'P0001','solmind_explorer_conversation_denied','another owner cannot mutate this saved Route');
select throws_ok($$select * from public.solmind_read_explorer_conversation_v3(pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6005))$$,
  'P0001','solmind_explorer_private_unavailable','another owner cannot read this Route or Reached evidence');

-- Owner-only edits here test immutable captured wording without adding a product rename operation.
update ai.explorer_conversation_compass_item set label='Later synthetic point wording' where item_id=pg_temp.gid(23001);
select is(pg_temp.read_state()->'route',(select value from route_saved),'Route keeps original captured labels after later source-point wording changes');
select throws_ok($$update ai.explorer_conversation_operation set compass_route_label='Changed history' where operation_id=pg_temp.gid(23101)$$,
  'P0001','solmind_explorer_private_immutable','captured Route label cannot be rewritten even by ordinary owner SQL');
select throws_ok($$update ai.explorer_conversation_operation set completed_at=completed_at+interval '1 second' where operation_id=pg_temp.gid(23101)$$,
  'P0001','solmind_explorer_private_immutable','Route timestamp cannot be rewritten');
select throws_ok($$update ai.explorer_conversation_operation set initial_revision=initial_revision+1 where operation_id=pg_temp.gid(23101)$$,
  'P0001','solmind_explorer_private_immutable','Route revision cannot be rewritten');
select throws_ok($$delete from ai.explorer_conversation_operation where operation_id=pg_temp.gid(23101)$$,
  'P0001','solmind_explorer_private_immutable','captured Route operation cannot be deleted');
select throws_ok($$update ai.explorer_conversation_operation set compass_route_kind='priority_confirmed',
  compass_route_item_id=pg_temp.gid(23001),compass_route_label='Invented legacy history' where operation_id=pg_temp.gid(23999)$$,
  'P0001','solmind_explorer_private_immutable','NULL legacy operation cannot be enriched into invented Route history');

select is((select outcome from pg_temp.mutate(23201,'confirm_waypoint',10011,null,null,null,
  'Choose this week focus','It makes room for deliberate attention','A written focus and one first step')),'ok','explicit chosen Waypoint saves');
select ok((select w->>'status'='chosen' and w?'reachedEvidence' and w?'reachedAt'
  and w->'reachedEvidence'='null'::jsonb and w->'reachedAt'='null'::jsonb
  from jsonb_array_elements(pg_temp.read_state()->'waypoints') w where w->>'id'=pg_temp.gid(23201)::text),
  'chosen Waypoint readback includes actual NULL Reached evidence and time');
select is((select outcome from pg_temp.mutate(23202,'confirm_reached',null,null,23201,null,null,null,null,
  'I wrote the focus and completed the first small step.')),'ok','explicit Reached confirmation saves actual supporting evidence');
select ok((select w->>'status'='reached' and w->>'reachedEvidence'=stored.reached_evidence
    and w->'reachedAt'=to_jsonb(stored.reached_at) and stored.reached_at is not null
  from jsonb_array_elements(pg_temp.read_state()->'waypoints') w join content.waypoint stored
    on stored.waypoint_id=(w->>'id')::uuid where stored.waypoint_id=pg_temp.gid(23201)),
  'Reached reload returns exact stored evidence and actual timestamp');
create temp table reached_saved as select pg_temp.read_state()->'waypoints' value;
select is((select outcome from pg_temp.mutate(23202,'confirm_reached',null,null,23201,null,null,null,null,
  'I wrote the focus and completed the first small step.')),'exact_replay','exact Reached retry reads the original saved result');
select is(pg_temp.read_state()->'waypoints',(select value from reached_saved),'Reached replay preserves evidence/time without a second change');
select is(pg_temp.read_state()->'route',(select value from route_saved),'Waypoint choice and Reached confirmation do not invent Compass movement');

select lives_ok($$select ai.solmind_store_private_observation_v3(pg_temp.gid(6005),pg_temp.gid(50),pg_temp.gid(23998),
  repeat('E',64),'synthetic-fallback.v1','synthetic-model-policy.v1',3::smallint,false,null,null,null)$$,
  'synthetic actual positive establishes a restricted policy for refusal coverage');
select throws_ok($$select * from pg_temp.mutate(23109,'confirm_priority',null,23001)$$,
  'P0001','solmind_explorer_private_denied','restricted conversation denies new formation');
select is(pg_temp.read_state()->'route',(select value from route_saved),'restricted refusal preserves historical Route');
select is((select outcome from pg_temp.mutate(23103,'confirm_priority',null,23002)),'exact_replay','restriction does not erase a legitimate exact prior Route replay');
select is(pg_temp.read_state()->'waypoints',(select value from reached_saved),'restricted owned readback preserves actual Reached facts');
select is((select count(*)::integer from ai.ai_model_invocation),(select n from invocation_before),'all formation, readback and refusal checks create no additional model invocation');
select ok(not exists(select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
  where has_schema_privilege(r.role_name,'ai','USAGE')
    or has_table_privilege(r.role_name,'ai.explorer_conversation_operation','SELECT,INSERT,UPDATE,DELETE')),
  'Route adds no API schema or direct operation-table access');
-- Fire the real deferred policy guard under the actual API role before rollback.
-- This exercises transaction-end work without committing the synthetic fixture.
set local role service_role;
select lives_ok($$set constraints all immediate$$,'actual deferred coherence checks pass under service_role after formation');
reset role;
select * from finish();
rollback;
