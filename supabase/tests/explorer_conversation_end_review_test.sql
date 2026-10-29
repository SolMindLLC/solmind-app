-- Focused explicit End Session and owned ended-conversation review proof.
-- Synthetic disposable-project SQL only; no retained demo data or provider calls.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,pg_catalog,pg_temp;
set local statement_timeout='120s';
select no_plan();

create function pg_temp.gid(n integer) returns uuid language sql immutable as $$
  select ('f42c0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
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

create function pg_temp.end_conversation(conv_n integer,op_n integer,revision_override integer default null,
  actor_n integer default 1,app_n integer default 50,fingerprint_override text default null)
returns table(outcome text,conversation_state jsonb) language sql as $$
  select * from public.solmind_end_explorer_conversation_v1(pg_temp.gid(actor_n),pg_temp.gid(app_n),pg_temp.gid(conv_n),
    pg_temp.gid(op_n),coalesce(revision_override,
      (select initial_revision from ai.explorer_conversation_operation where actor_user_account_id=pg_temp.gid(actor_n) and operation_id=pg_temp.gid(op_n)),
      (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(conv_n))),
    coalesce(fingerprint_override,pg_temp.request_sha(op_n)))
$$;
create function pg_temp.ended_state(conv_n integer default 6005,actor_n integer default 1,app_n integer default 50)
returns jsonb language sql as $$
  select conversation_state from public.solmind_read_ended_explorer_conversations_v1(pg_temp.gid(actor_n),pg_temp.gid(app_n),pg_temp.gid(conv_n))
$$;
create function pg_temp.reject_end_audit() returns trigger language plpgsql as $$
begin
  if new.event_type='ai_session_ended' and current_setting('solmind.fixture.fail_end_audit',true)='yes'
    then raise exception 'synthetic_end_audit_failure'; end if;
  return new;
end $$;
create trigger synthetic_end_audit_failure before insert on audit.audit_event
  for each row execute function pg_temp.reject_end_audit();

-- Real saved formation/Route/Reached state, using only synthetic protocol data.
do $$ begin
  if not exists(select 1 from pg_temp.mutate(23001,'add_compass',10011,null,null,'First ending Priority') where outcome='ok')
    then raise exception 'synthetic_end_compass_setup_failed'; end if;
  if not exists(select 1 from pg_temp.mutate(23002,'add_compass',10015,null,null,'Independent ending attention') where outcome='ok')
    then raise exception 'synthetic_end_compass_setup_failed'; end if;
  if not exists(select 1 from pg_temp.mutate(23101,'confirm_priority',null,23001) where outcome='ok')
    then raise exception 'synthetic_end_priority_setup_failed'; end if;
  if not exists(select 1 from pg_temp.mutate(23102,'set_attention',null,23002) where outcome='ok')
    then raise exception 'synthetic_end_attention_setup_failed'; end if;
  if not exists(select 1 from public.solmind_confirm_explorer_compass_arrangement_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(23103),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),pg_temp.request_sha(23103),pg_temp.gid(23001),
    jsonb_build_array(jsonb_build_object('compassItemId',pg_temp.gid(23001),'anchor','apex','emphasis',3),
      jsonb_build_object('compassItemId',pg_temp.gid(23002),'anchor','lower_center','emphasis',1))) where outcome='ok')
    then raise exception 'synthetic_end_arrangement_setup_failed'; end if;
  if not exists(select 1 from pg_temp.mutate(23201,'confirm_waypoint',10011,null,null,null,
    'Choose one focus','Make room for deliberate attention','One written step') where outcome='ok')
    then raise exception 'synthetic_end_waypoint_setup_failed'; end if;
  if not exists(select 1 from pg_temp.mutate(23202,'confirm_reached',null,null,23201,null,null,null,null,
    'The written first step is done.') where outcome='ok') then raise exception 'synthetic_end_reached_setup_failed'; end if;
end $$;
select ok(pg_temp.read_state()->>'sessionStatus'='active' and pg_temp.read_state()->'ending'='null'::jsonb,
  'actual active conversation has no invented ending');
create temp table active_before as select pg_temp.read_state() value;
select throws_ok($$select * from public.solmind_read_ended_explorer_conversations_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005))$$,
  'P0001','solmind_explorer_conversation_denied','ended reader refuses an active selected conversation');
create temp table no_container_before as select count(*)::integer n from ai.ai_interaction_session;
select throws_ok($$select * from public.solmind_end_explorer_conversation_v1(pg_temp.gid(1),pg_temp.gid(50),null,pg_temp.gid(25099),0,pg_temp.request_sha(25099))$$,
  'P0001','solmind_explorer_private_invalid_input','null-ID Discovery cannot invent a session to end');
select is((select count(*)::integer from ai.ai_interaction_session),(select n from no_container_before),
  'invalid End creates no container or replacement session');
select is((select outcome from pg_temp.end_conversation(6005,25098,0)),'stale_revision','stale End refuses without changing current state');
select is(pg_temp.read_state(),(select value from active_before),'stale End preserves exact active formation/history');

-- A genuine prepared synthetic turn blocks End; End does not cancel/settle it.
select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(2)),
  'fixture prepares an actual pending turn with no HTTP/provider call');
create temp table pending_before as select pg_temp.read_state() value;
select is((select outcome from pg_temp.end_conversation(6005,25001)),'unavailable','pending turn blocks End');
select is(pg_temp.read_state(),(select value from pending_before),'blocked End preserves pending turn and all current state');
select ok(not exists(select 1 from ai.explorer_conversation_operation where operation_id=pg_temp.gid(25001))
  and not exists(select 1 from audit.audit_event where event_type='ai_session_ended' and target_entity_id=pg_temp.gid(6005)),
  'blocked End creates no ending operation, audit or false completion');
select ok((select outcome='ok' and not saved_reply from pg_temp.settle_private(2,null,null,'none',null,'canceled',false)),
  'test owner separately settles its prepared synthetic turn without a fabricated reply');
create temp table before_end as select pg_temp.read_state() value;
create temp table end_effect_before as select
  (select count(*)::integer from ai.ai_interaction_session) sessions,
  (select count(*)::integer from ai.ai_interaction_message) messages,
  (select count(*)::integer from ai.ai_model_invocation) invocations;
set local solmind.fixture.fail_end_audit='yes';
select throws_ok($$select * from pg_temp.end_conversation(6005,25001)$$,
  'P0001','synthetic_end_audit_failure','ending audit failure is not reported as successful End');
set local solmind.fixture.fail_end_audit='';
select is(pg_temp.read_state(),(select value from before_end),'audit failure rolls back status, revision and all saved ending facts');
select ok(not exists(select 1 from ai.explorer_conversation_operation where operation_id=pg_temp.gid(25001))
  and not exists(select 1 from audit.audit_event where event_type='ai_session_ended' and target_entity_id=pg_temp.gid(6005)),
  'audit failure leaves neither an unaudited ending nor a partial operation');
select is((select outcome from pg_temp.end_conversation(6005,25001)),'ok','explicit current-owned End succeeds once');
select is(pg_temp.ended_state()->'ending',
  (select jsonb_build_object('operationId',operation_id,'revision',initial_revision+1,'endedAt',completed_at,
    'directionsTaken',ending_directions_text,'routeThroughRevision',ending_route_revision)
   from ai.explorer_conversation_operation where operation_id=pg_temp.gid(25001)),
  'ended DTO has exactly five saved ending keys and actual SQL completion time');
select ok(pg_temp.ended_state()->>'sessionStatus'='ended'
  and (pg_temp.ended_state()->>'revision')::integer=(select (value->>'revision')::integer+1 from before_end)
  and (select session_status='ended' and ended_at=op.completed_at
    from ai.ai_interaction_session s join ai.explorer_conversation_operation op on op.conversation_id=s.ai_interaction_session_id
    where op.operation_id=pg_temp.gid(25001)),
  'AI status, actual ending time and single resulting revision agree');
select ok((select ending_route_revision=initial_revision and ending_route_revision=(select (value->>'revision')::integer from before_end)
    and char_length(ending_directions_text) between 1 and 2048
    and position('First ending Priority' in ending_directions_text)>0
    and position('Independent ending attention' in ending_directions_text)>0
    and position('The saved Route records 3 ' in ending_directions_text)>0
  from ai.explorer_conversation_operation where operation_id=pg_temp.gid(25001)),
  'saved factual directions use actual final labels and exact pre-End Route boundary');
select is(pg_temp.ended_state()-array['revision','sessionStatus','ending'],
  (select value-array['revision','sessionStatus','ending'] from before_end),
  'ended review preserves all saved messages, Compass arrangement, Route and actual Reached evidence');
select ok((select count(*)=1 and bool_and(actor_user_account_id=pg_temp.gid(1) and actor_role_context='explorer'
    and target_entity_type='ai_interaction_session' and target_entity_id=pg_temp.gid(6005)
    and action='end' and reason_code='explorer_ended_session' and event_summary='Explorer ended an AI interaction session.'
    and metadata='{}'::jsonb and ip_address is null and user_agent is null)
  from audit.audit_event where event_type='ai_session_ended' and target_entity_id=pg_temp.gid(6005)),
  'one closed ending audit records the actual Explorer actor and no content');
create temp table saved_ended as select pg_temp.ended_state() value;
select is((select outcome from pg_temp.end_conversation(6005,25001)),'exact_replay',
  'same exact End retries through current authority after the session is ended');
select is(pg_temp.ended_state(),(select value from saved_ended),'exact End retry reads the same saved ending');
select throws_ok($$select * from pg_temp.end_conversation(6005,25001,null,1,50,repeat('F',64))$$,
  'P0001','solmind_explorer_private_operation_conflict','changed same-operation End reuse conflicts');
select is((select outcome from pg_temp.end_conversation(6005,25002)),'already_ended',
  'a distinct End on an ended session is an honest read-only already-ended result');
select ok(not exists(select 1 from ai.explorer_conversation_operation where operation_id=pg_temp.gid(25002))
  and (select count(*)=1 from audit.audit_event where event_type='ai_session_ended' and target_entity_id=pg_temp.gid(6005)),
  'retries and already-ended results create no second ending or audit');
select is(pg_temp.ended_state(),(select value from saved_ended),'already-ended result does not reactivate or change saved history');
select ok((select outcome='ok' and conversation_state is null
  and ended_conversations=jsonb_build_array(jsonb_build_object('conversationId',pg_temp.gid(6005),
    'endedAt',(select ended_at from ai.ai_interaction_session where ai_interaction_session_id=pg_temp.gid(6005))))
  from public.solmind_read_ended_explorer_conversations_v1(pg_temp.gid(1),pg_temp.gid(50),null)),
  'owned list returns only exact two-key ended metadata and no selected private state');
select ok((select count(*)::integer from ai.ai_interaction_session)=(select sessions from end_effect_before)
  and (select count(*)::integer from ai.ai_interaction_message)=(select messages from end_effect_before)
  and (select count(*)::integer from ai.ai_model_invocation)=(select invocations from end_effect_before),
  'End and owned review create no new session, message or model invocation');
select throws_ok($$select * from pg_temp.mutate(23301,'add_compass',10011,null,null,'Must not append after ending')$$,
  'P0001','solmind_explorer_conversation_denied','old formation writer remains active-only after End');
select throws_ok($$select * from pg_temp.mutate(23101,'confirm_priority',null,23001)$$,
  'P0001','solmind_explorer_conversation_denied','old reflective exact replay cannot bypass ended active-only authority');
select throws_ok($$update ai.explorer_conversation_operation set ending_directions_text='Rewritten ending'
  where operation_id=pg_temp.gid(25001)$$,'P0001','solmind_explorer_private_immutable','saved factual ending text is immutable');
select throws_ok($$update ai.explorer_conversation_operation set ending_route_revision=ending_route_revision+1
  where operation_id=pg_temp.gid(25001)$$,'P0001','solmind_explorer_private_immutable','saved ending Route boundary is immutable');
select throws_ok($$update ai.explorer_conversation_operation set completed_at=completed_at+interval '1 second'
  where operation_id=pg_temp.gid(25001)$$,'P0001','solmind_explorer_private_immutable','saved ending time is immutable');
select throws_ok($$delete from ai.explorer_conversation_operation where operation_id=pg_temp.gid(25001)$$,
  'P0001','solmind_explorer_private_immutable','saved ending operation cannot be deleted');
select throws_ok($$update ai.explorer_conversation_operation set ending_directions_text='Invented old ending',ending_route_revision=initial_revision
  where operation_id=pg_temp.gid(23001)$$,'P0001','solmind_explorer_private_immutable','historical non-send row cannot be enriched with ending facts');
select throws_ok($$update ai.explorer_conversation_operation set ending_directions_text='Invented old ending',ending_route_revision=initial_revision
  where operation_id=pg_temp.gid(10010)$$,'P0001','solmind_explorer_private_immutable','historical model-bound send cannot be enriched with ending facts');
update ai.explorer_conversation_compass_item set label='Later synthetic source label' where item_id=pg_temp.gid(23001);
select is(pg_temp.ended_state()->'ending',(select value->'ending' from saved_ended),
  'saved directions are captured text rather than reconstructed from later mutable labels');
select throws_ok($$select * from public.solmind_read_ended_explorer_conversations_v1(pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6005))$$,
  'P0001','solmind_explorer_conversation_denied','another Explorer cannot review the selected ended conversation');
select throws_ok($$select * from pg_temp.end_conversation(6005,25101,0,4,54)$$,
  'P0001','solmind_explorer_conversation_denied','another Explorer cannot end or reuse the selected ended conversation');
select throws_ok($$select * from public.solmind_read_ended_explorer_conversations_v1(pg_temp.gid(2),pg_temp.gid(56),null)$$,
  'P0001','solmind_explorer_conversation_denied','Guide login cannot enter the private Explorer ended-review list');

-- Current eligibility still applies after ending; no permanently valid history token.
create temp table app_expiry_before as select expires_at from identity.user_session where user_session_id=pg_temp.gid(50);
update identity.user_session set expires_at=clock_timestamp()-interval '1 second' where user_session_id=pg_temp.gid(50);
select throws_ok($$select * from public.solmind_read_ended_explorer_conversations_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005))$$,
  'P0001','solmind_explorer_conversation_denied','expired app login cannot read owned ended state');
select throws_ok($$select * from pg_temp.end_conversation(6005,25001)$$,
  'P0001','solmind_explorer_conversation_denied','exact End replay still requires current authentication');
update identity.user_session set expires_at=(select expires_at from app_expiry_before) where user_session_id=pg_temp.gid(50);
update identity.user_role_assignment set role_status='suspended' where user_role_assignment_id=pg_temp.gid(11);
select throws_ok($$select * from public.solmind_read_ended_explorer_conversations_v1(pg_temp.gid(1),pg_temp.gid(50),null)$$,
  'P0001','solmind_explorer_conversation_denied','current suspended Explorer role cannot list historical private state');
update identity.user_role_assignment set role_status='active' where user_role_assignment_id=pg_temp.gid(11);
update core.guide_explorer_relationship set relationship_status='ended',ended_at=clock_timestamp() where guide_explorer_relationship_id=pg_temp.gid(25);
select throws_ok($$select * from public.solmind_read_ended_explorer_conversations_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005))$$,
  'P0001','solmind_explorer_conversation_denied','ended current relationship denies selected ended review');
update core.guide_explorer_relationship set relationship_status='active',ended_at=null where guide_explorer_relationship_id=pg_temp.gid(25);
update core.practice set status='inactive' where practice_id=pg_temp.gid(22);
select throws_ok($$select * from public.solmind_read_ended_explorer_conversations_v1(pg_temp.gid(1),pg_temp.gid(50),null)$$,
  'P0001','solmind_explorer_conversation_denied','inactive current Practice denies ended metadata list');
update core.practice set status='active' where practice_id=pg_temp.gid(22);
insert into core.consent_document(consent_document_id,consent_type,version_number,version_label,title,body_markdown,
  document_status,is_required_for_explorer,effective_at,created_by_user_account_id)
values(pg_temp.gid(33),'privacy_policy',9421,'synthetic-ending-new-consent','Synthetic later required consent','SQL fixture only.',
  'active',true,now(),pg_temp.gid(3));
select throws_ok($$select * from public.solmind_read_ended_explorer_conversations_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005))$$,
  'P0001','solmind_explorer_conversation_denied','new unaccepted required consent denies ended state read');
update core.consent_document set document_status='draft' where consent_document_id=pg_temp.gid(33);
insert into core.practice(practice_id,organization_id,practice_name,approval_status,approved_by_user_account_id,approved_at)
values(pg_temp.gid(28),pg_temp.gid(21),'Synthetic mismatched ended Practice','approved',pg_temp.gid(3),now());
update ai.ai_interaction_session set practice_id=pg_temp.gid(28) where ai_interaction_session_id=pg_temp.gid(6005);
select throws_ok($$select * from public.solmind_read_ended_explorer_conversations_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005))$$,
  'P0001','solmind_explorer_conversation_denied','selected ended record must retain current relationship/Practice binding');
update ai.ai_interaction_session set practice_id=pg_temp.gid(22) where ai_interaction_session_id=pg_temp.gid(6005);
select is(pg_temp.ended_state()->'ending',(select value->'ending' from saved_ended),
  'restored current authority reads the original saved ending without renewal or backfill');

-- End is an exit: empty, restricted, adult-stopped and legacy unknown are distinct.
select is((select outcome from pg_temp.ensure_anchor(6100,4,54)),'created','fixture explicitly creates an actual zero-point owned container');
select is((select outcome from pg_temp.end_conversation(6100,26000,null,4,54)),'ok','actual zero-point Discovery container may End');
select ok((select jsonb_array_length(s->'messages')=0 and jsonb_array_length(s->'compassItems')=0
    and jsonb_array_length(s->'route')=0 and s->'priorityId'='null'::jsonb and s->'attentionId'='null'::jsonb
    and position('no recorded Route changes' in (s->'ending'->>'directionsTaken'))>0 from (select pg_temp.ended_state(6100,4,54) s) r),
  'empty ending saves factual text without inventing messages, Priority or Route');
select is((select outcome from pg_temp.ensure_anchor(6101,4,54)),'created','next synthetic owned container is created explicitly rather than by End');
select lives_ok($$select ai.solmind_store_private_observation_v3(pg_temp.gid(6101),pg_temp.gid(54),pg_temp.gid(26991),
  repeat('A',64),'synthetic-fallback.v1','synthetic-model-policy.v1',3::smallint,false,null,null,null)$$,
  'synthetic actual positive establishes restricted fixture policy');
create temp table closure_policy_before as select conversation_id,safety_contract_version,restricted_level,adult_reflection_stopped,safety_version
  from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6101);
select is((select outcome from pg_temp.end_conversation(6101,26001,null,4,54)),'ok','restricted conversation may End without new reflective formation');
select is((select outcome from pg_temp.ensure_anchor(6102,4,54)),'created','adult-stop fixture is a new explicit owned container');
select lives_ok($$select ai.solmind_store_private_observation_v3(pg_temp.gid(6102),pg_temp.gid(54),pg_temp.gid(26992),
  repeat('B',64),'synthetic-fallback.v1','synthetic-model-policy.v1',0::smallint,true,null,null,null)$$,
  'synthetic minor-only observation sets the separate adult stop');
insert into closure_policy_before select conversation_id,safety_contract_version,restricted_level,adult_reflection_stopped,safety_version
  from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6102);
select is((select outcome from pg_temp.end_conversation(6102,26002,null,4,54)),'ok','adult-stopped conversation may End without resetting policy');
insert into ai.ai_interaction_session(ai_interaction_session_id,session_type,actor_user_account_id,actor_role_context,
  guide_profile_id,explorer_profile_id,guide_explorer_relationship_id,practice_id)
values(pg_temp.gid(6103),'explorer_reflection',pg_temp.gid(4),'explorer',pg_temp.gid(23),pg_temp.gid(26),pg_temp.gid(27),pg_temp.gid(22));
insert into ai.explorer_conversation_state(conversation_id,actor_user_account_id) values(pg_temp.gid(6103),pg_temp.gid(4));
insert into closure_policy_before select conversation_id,safety_contract_version,restricted_level,adult_reflection_stopped,safety_version
  from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6103);
select is((select outcome from pg_temp.end_conversation(6103,26003,null,4,54)),'ok','legacy-unknown owned container may End without clear initialization');
select ok(not exists((select conversation_id,safety_contract_version,restricted_level,adult_reflection_stopped,safety_version
    from ai.explorer_conversation_state where conversation_id in (select conversation_id from closure_policy_before)
    except select * from closure_policy_before)
  union all (select * from closure_policy_before except select conversation_id,safety_contract_version,restricted_level,adult_reflection_stopped,safety_version
    from ai.explorer_conversation_state where conversation_id in (select conversation_id from closure_policy_before))),
  'End preserves restricted, adult-stop and unknown policy fields exactly');
select ok((select restricted_level=3 and not adult_reflection_stopped from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6101))
  and (select adult_reflection_stopped from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6102))
  and (select safety_contract_version is null and safety_version is null and restricted_level is null and adult_reflection_stopped is null
    from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6103)),
  'the three closure policy states remain distinct rather than normalized to clear');

-- Existing schema requires an actual ended_at. No constraint is weakened to
-- manufacture a NULL time; NULL-time compatibility belongs to the DTO tests.
insert into ai.ai_interaction_session(ai_interaction_session_id,session_type,session_status,ended_at,
  actor_user_account_id,actor_role_context,guide_profile_id,explorer_profile_id,guide_explorer_relationship_id,practice_id)
values(pg_temp.gid(6104),'explorer_reflection','ended',clock_timestamp(),pg_temp.gid(4),'explorer',
  pg_temp.gid(23),pg_temp.gid(26),pg_temp.gid(27),pg_temp.gid(22));
insert into ai.explorer_conversation_state(conversation_id,actor_user_account_id) values(pg_temp.gid(6104),pg_temp.gid(4));
select ok(pg_temp.ended_state(6104,4,54)->>'sessionStatus'='ended' and pg_temp.ended_state(6104,4,54)->'ending'='null'::jsonb,
  'legacy owned ended session remains reviewable with honest absence of a saved ending summary');
select is((select outcome from pg_temp.end_conversation(6104,26004,null,4,54)),'already_ended',
  'new End on legacy ended history is read-only and creates no summary backfill');
select ok(not exists(select 1 from ai.explorer_conversation_operation where conversation_id=pg_temp.gid(6104))
  and not exists(select 1 from audit.audit_event where event_type='ai_session_ended' and target_entity_id=pg_temp.gid(6104)),
  'legacy already-ended read creates neither a fake ending operation nor a new ending audit');
select ok((select outcome='ok' and conversation_state is null and jsonb_array_length(ended_conversations)=5
    and not exists(select 1 from jsonb_array_elements(ended_conversations) x where (select count(*) from jsonb_object_keys(x))<>2
      or x->>'conversationId'=pg_temp.gid(6005)::text)
  from public.solmind_read_ended_explorer_conversations_v1(pg_temp.gid(4),pg_temp.gid(54),null)),
  'ended list returns all five own sessions, exact metadata only and no other Explorer record');
select is((select count(*)::integer from ai.ai_model_invocation),(select invocations from end_effect_before),
  'all closure-policy, list and review cases create no additional model invocation');
select is((select count(*)::integer from ai.ai_interaction_message),(select messages from end_effect_before),
  'empty/restricted/adult/unknown/legacy closure and review create no invented message');
select ok(has_function_privilege('service_role','public.solmind_end_explorer_conversation_v1(uuid,uuid,uuid,uuid,integer,text)','EXECUTE')
  and has_function_privilege('service_role','public.solmind_read_ended_explorer_conversations_v1(uuid,uuid,uuid)','EXECUTE')
  and not exists(select 1 from (values('anon'),('authenticated')) r(role_name) cross join (values
    ('public.solmind_end_explorer_conversation_v1(uuid,uuid,uuid,uuid,integer,text)'),
    ('public.solmind_read_ended_explorer_conversations_v1(uuid,uuid,uuid)')) f(signature)
    where has_function_privilege(r.role_name,f.signature,'EXECUTE')),
  'only service_role receives the two narrow public ending/review capabilities');
select ok(not exists(select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
  where has_schema_privilege(r.role_name,'ai','USAGE')
    or has_table_privilege(r.role_name,'ai.ai_interaction_session','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege(r.role_name,'ai.explorer_conversation_operation','SELECT,INSERT,UPDATE,DELETE')),
  'ending/review add no API schema or direct private table access');

select ok(not exists(select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
  where has_function_privilege(r.role_name,'ai.solmind_ended_conversation_authority_v1(uuid,uuid,uuid)','EXECUTE')),
  'private ended-review authority helper remains ungranted to every API role');
-- Root additionally runs an actual service-role COMMIT proof separately. Here
-- deferred policy coherence is executed under the real API role before rollback.
set local role service_role;
set constraints all immediate;
select ok(true,'deferred coherence checks complete under service_role without new ai schema access');
reset role;
select * from finish();
rollback;
