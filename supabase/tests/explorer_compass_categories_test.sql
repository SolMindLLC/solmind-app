-- Focused explicit category wording/combination and retained provenance proof.
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


create function pg_temp.category(op_n integer,target_n integer,members integer[],label_text text,revision_override integer default null)
returns table(outcome text,conversation_state jsonb) language sql as $$
  select * from public.solmind_confirm_explorer_compass_category_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(op_n),coalesce(revision_override,
      (select initial_revision from ai.explorer_conversation_operation where actor_user_account_id=pg_temp.gid(1) and operation_id=pg_temp.gid(op_n)),
      (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005))),pg_temp.request_sha(op_n),
    pg_temp.gid(target_n),case when members is null then null else array(select pg_temp.gid(n) from unnest(members) n) end,label_text)
$$;
create function pg_temp.layout() returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('compassItemId',c.item_id,
    'anchor',case c.item_id when pg_temp.gid(26001) then 'apex' when pg_temp.gid(26002) then 'upper_left'
      when pg_temp.gid(26003) then 'upper_right' when pg_temp.gid(26004) then 'upper_left' else null end,
    'emphasis',case c.item_id when pg_temp.gid(26001) then 3 when pg_temp.gid(26002) then 2 else 1 end)
    order by c.item_id),'[]'::jsonb)
  from ai.explorer_conversation_compass_item c where c.conversation_id=pg_temp.gid(6005) and c.merged_into_item_id is null
$$;
create function pg_temp.arrange(op_n integer,items_value jsonb) returns table(outcome text,conversation_state jsonb) language sql as $$
  select * from public.solmind_confirm_explorer_compass_arrangement_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(op_n),
    coalesce((select initial_revision from ai.explorer_conversation_operation where actor_user_account_id=pg_temp.gid(1) and operation_id=pg_temp.gid(op_n)),
      (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005))),pg_temp.request_sha(op_n),pg_temp.gid(26001),items_value)
$$;

select is((select outcome from pg_temp.mutate(26001,'add_compass',10011,null,null,'Weekly focus')),'ok','first saved-source category added');
select is((select outcome from pg_temp.mutate(26002,'add_compass',10015,null,null,'Supporting routine')),'ok','second saved source retained');
select is((select outcome from pg_temp.mutate(26003,'add_compass',10011,null,null,'Time constraints')),'ok','third source point retained');
select is((select outcome from pg_temp.mutate(26101,'confirm_priority',null,26001)),'ok','Explorer confirms original Priority');
select is((select outcome from pg_temp.mutate(26102,'set_attention',null,26002)),'ok','attention is distinct from Priority');
create temp table initial_layout as select pg_temp.layout() value;
select is((select outcome from pg_temp.arrange(26201,(select value from initial_layout))),'ok','three reviewed positions saved');
create temp table initial_route as select pg_temp.read_state()->'route' value;

select is((select outcome from pg_temp.category(26301,26001,array[26001],'Weekly focus and constraints')),'ok','one-head reviewed broadening changes its descriptive label');
select ok((select source_message_id=pg_temp.gid(10011) and compass_anchor='apex' and relative_emphasis=3 and merged_into_item_id is null
  from ai.explorer_conversation_compass_item where item_id=pg_temp.gid(26001)),'broadening preserves original source, stable identity and current placement');
select ok((select priority_id=pg_temp.gid(26001) and attention_id=pg_temp.gid(26002)
  from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),'confirmed meaning change does not transfer either selector');
select is((select compass_category_change#>>'{beforeItems,0,label}' from ai.explorer_conversation_operation where operation_id=pg_temp.gid(26301)),
  'Weekly focus','captured old wording is exact rather than recomputed');
select ok((select ai.solmind_compass_category_change_valid(compass_category_change) from ai.explorer_conversation_operation where operation_id=pg_temp.gid(26301)),
  'new category capture obeys its exact closed shape');
select is((select jsonb_agg(x.value order by x.ord)::text from jsonb_array_elements(pg_temp.read_state()->'route') with ordinality x(value,ord)
    where x.ord<=(select jsonb_array_length(value) from initial_route)),(select value::text from initial_route),'earlier captured Route remains exactly unchanged');
select throws_ok($$select * from pg_temp.category(26302,26001,array[26001,26002],'Premature combined focus')$$,
  'P0001','solmind_explorer_private_invalid_input','combining away current attention refuses instead of moving it silently');
select throws_ok($$select * from pg_temp.category(26303,26002,array[26001,26002],'Wrong surviving Priority')$$,
  'P0001','solmind_explorer_private_invalid_input','combining away Priority refuses');

select is((select outcome from pg_temp.category(26304,26002,array[26003,26002],'Supporting themes')),'ok','attention survivor can combine another current category');
select ok((select merged_into_item_id=pg_temp.gid(26002) and label='Time constraints' and compass_anchor='upper_right'
  from ai.explorer_conversation_compass_item where item_id=pg_temp.gid(26003)),'combined original retains label, exact source and former layout');
select is((select outcome from pg_temp.mutate(26103,'set_attention',null,26001)),'ok','Explorer explicitly moves attention before the next combination');
select is((select outcome from pg_temp.category(26305,26001,array[26002,26001],'Weekly focus and supporting themes')),'ok','two current heads combine under the explicitly chosen Priority survivor');
select ok((select count(*)=3 and count(*) filter(where merged_into_item_id is null)=1
  from ai.explorer_conversation_compass_item where conversation_id=pg_temp.gid(6005)),'all original rows remain while only one current category head survives');
select ok((select merged_into_item_id=pg_temp.gid(26002) from ai.explorer_conversation_compass_item where item_id=pg_temp.gid(26003))
  and (select merged_into_item_id=pg_temp.gid(26001) from ai.explorer_conversation_compass_item where item_id=pg_temp.gid(26002)),
  'transitive source links retain the actual earlier grouping rather than flattening history');
select is((select jsonb_array_length(compass_category_change->'beforeItems') from ai.explorer_conversation_operation where operation_id=pg_temp.gid(26305)),3,
  'later capture contains the complete contributing closure');
select is((select count(distinct x->>'sourceMessageId')::integer from ai.explorer_conversation_operation o,
  lateral jsonb_array_elements(o.compass_category_change->'beforeItems') x where o.operation_id=pg_temp.gid(26305)),2,
  'both distinct exact saved-message references survive the grouping');
select ok((select jsonb_array_length(pg_temp.read_state()->'compassItems')=3) and
  exists(select 1 from jsonb_array_elements(pg_temp.read_state()->'compassItems') x where x->>'id'=pg_temp.gid(26003)::text
    and x->>'mergedIntoItemId'=pg_temp.gid(26002)::text),'state preserves all retained IDs for old Route references and source review');
select is((select outcome from pg_temp.category(26305,26001,array[26001,26002],'Weekly focus and supporting themes')),'exact_replay',
  'reordered semantic member set replays before current-head validation');
select is((select count(*)::integer from ai.explorer_conversation_operation where operation_id=pg_temp.gid(26305)),1,'exact replay adds no duplicate operation/capture');
select throws_ok($$select * from pg_temp.category(26305,26001,array[26001,26002],'Changed same-ID wording')$$,
  'P0001','solmind_explorer_private_operation_conflict','changed reuse of one operation conflicts');
select is((select outcome from pg_temp.category(26306,26001,array[26001],'Stale wording',0)),'stale_revision','new stale review cannot change category wording');
select throws_ok($$select * from pg_temp.category(26307,26001,array[26001,26001],'Duplicate members')$$,
  'P0001','solmind_explorer_private_invalid_input','duplicate members refuse');
select throws_ok($$select * from pg_temp.category(26308,26001,array[26001,99999],'Foreign selector')$$,
  'P0001','solmind_explorer_private_invalid_input','missing or foreign point selector refuses');
select throws_ok($$select * from pg_temp.category(26309,26002,array[26002],'Retired selector')$$,
  'P0001','solmind_explorer_private_invalid_input','a retained combined-away row cannot become a fresh current target');
select throws_ok($$select * from pg_temp.mutate(26104,'set_attention',null,26002)$$,'P0001',null,'legacy attention writer refuses a combined-away selector');
select throws_ok($$select * from pg_temp.mutate(26105,'confirm_priority',null,26002)$$,'P0001',null,'legacy Priority writer refuses a combined-away selector');
select is((select outcome from pg_temp.arrange(26201,(select value from initial_layout))),'exact_replay','old complete arrangement fingerprint/replay survives later combinations');
select throws_ok($$select * from pg_temp.arrange(26202,(select value from initial_layout))$$,'P0001','solmind_explorer_private_invalid_input',
  'new arrangement cannot treat retained retired originals as current heads');

select is((select outcome from pg_temp.mutate(26004,'add_compass',10015,null,null,'Additional saved detail')),'ok','another current source point can be added without reusing a retained ID');
select is((select outcome from pg_temp.arrange(26203,pg_temp.layout())),'ok','current head reuses a visible anchor retained only in historical originals');
select ok((select compass_anchor='upper_left' from ai.explorer_conversation_compass_item where item_id=pg_temp.gid(26002)) and
  (select compass_anchor='upper_left' from ai.explorer_conversation_compass_item where item_id=pg_temp.gid(26004)),
  'current-only uniqueness preserves retired layout without blocking the current frame');

create temp table before_failed_capture as select revision,(select label from ai.explorer_conversation_compass_item where item_id=pg_temp.gid(26001)) label
  from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005);
create function pg_temp.reject_category_capture() returns trigger language plpgsql as $$ begin
  if new.kind='confirm_compass_category' then raise exception 'synthetic_category_capture_failure'; end if;
  return new;
end $$;
create trigger category_capture_failure before insert on ai.explorer_conversation_operation
  for each row execute function pg_temp.reject_category_capture();
select throws_ok($$select * from pg_temp.category(26310,26001,array[26001],'Must roll back')$$,'P0001','synthetic_category_capture_failure',
  'operation/capture failure rolls back the associated current wording change');
drop trigger category_capture_failure on ai.explorer_conversation_operation;
select ok((select s.revision=b.revision and c.label=b.label from ai.explorer_conversation_state s
  join ai.explorer_conversation_compass_item c on c.item_id=pg_temp.gid(26001) cross join before_failed_capture b
  where s.conversation_id=pg_temp.gid(6005)) and not exists(select 1 from ai.explorer_conversation_operation where operation_id=pg_temp.gid(26310)),
  'failed atomic capture leaves label/revision/operation unchanged');
select throws_ok($$update ai.explorer_conversation_operation set compass_category_change=compass_category_change||'{"label":"Rewritten history"}'::jsonb
  where operation_id=pg_temp.gid(26305)$$,'P0001','solmind_explorer_private_immutable','saved category history is immutable');
select throws_ok($$update ai.explorer_conversation_operation set compass_category_change='{}'::jsonb
  where operation_id=pg_temp.gid(26101)$$,'P0001','solmind_explorer_private_immutable','old operation cannot be retrospectively enriched with category history');
select throws_ok($$delete from ai.explorer_conversation_operation where operation_id=pg_temp.gid(26305)$$,'P0001',
  'solmind_explorer_private_immutable','captured category operation cannot be deleted');

create temp table no_op_route as select pg_temp.read_state()->'route' value;
select is((select outcome from pg_temp.category(26311,26001,array[26001],'Weekly focus and supporting themes')),'ok','one-member same-wording request is a completed no-op');
select is((pg_temp.read_state()->'route')::text,(select value::text from no_op_route),'no-op does not invent a meaningful Route event');
select throws_ok($$update ai.explorer_conversation_operation set status='failed' where operation_id=pg_temp.gid(26311)$$,
  'P0001','solmind_explorer_private_immutable','completed no-op category records are immutable too');

-- Total storage remains bounded even when the number of current heads falls.
do $$ begin
  for n in 5..24 loop
    if not exists(select 1 from pg_temp.mutate(26000+n,'add_compass',10011,null,null,'Saved point '||n) where outcome='ok')
      then raise exception 'synthetic_category_limit_setup_failed'; end if;
  end loop;
end $$;
select is((select count(*)::integer from ai.explorer_conversation_compass_item where conversation_id=pg_temp.gid(6005)),24,'retained originals still count toward the 24-row storage bound');
select is((select outcome from pg_temp.category(26312,26001,array[26004,26001],'Reviewed complete focus')),'ok','combination at storage capacity preserves its originals');
select is((select outcome from pg_temp.mutate(26025,'add_compass',10011,null,null,'No hidden extra slot')),'unavailable','combining does not manufacture a twenty-fifth storage slot');
select is((select count(*)::integer from ai.explorer_conversation_compass_item where conversation_id=pg_temp.gid(6005)),24,'refused extra source point does not discard an original');
select is((select outcome from pg_temp.arrange(26204,pg_temp.layout())),'ok','all and only remaining current heads can still be arranged');
select ok((select count(*)<=8 from ai.explorer_conversation_compass_item where conversation_id=pg_temp.gid(6005)
  and merged_into_item_id is null and compass_anchor is not null),'current visible frame remains bounded by eight');
select ok((select bool_and(x?'mergedIntoItemId') from jsonb_array_elements(pg_temp.read_state()->'compassItems') x),
  'new projection always supplies the explicit current/retained marker');
select throws_ok($$select * from public.solmind_confirm_explorer_compass_category_v1(pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6005),pg_temp.gid(26313),
  (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),repeat('A',64),pg_temp.gid(26001),array[pg_temp.gid(26001)],'Other actor')$$,
  'P0001',null,'another Explorer cannot update owned categories');
select throws_ok($$select * from public.solmind_confirm_explorer_compass_category_v1(pg_temp.gid(2),pg_temp.gid(56),pg_temp.gid(6005),pg_temp.gid(26314),
  (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),repeat('A',64),pg_temp.gid(26001),array[pg_temp.gid(26001)],'Guide alteration')$$,
  'P0001',null,'Guide cannot update Explorer categories');
select ok(has_function_privilege('service_role','public.solmind_confirm_explorer_compass_category_v1(uuid,uuid,uuid,uuid,integer,text,uuid,uuid[],text)','EXECUTE')
  and not has_function_privilege('authenticated','public.solmind_confirm_explorer_compass_category_v1(uuid,uuid,uuid,uuid,integer,text,uuid,uuid[],text)','EXECUTE')
  and not has_function_privilege('anon','public.solmind_confirm_explorer_compass_category_v1(uuid,uuid,uuid,uuid,integer,text,uuid,uuid[],text)','EXECUTE'),
  'only existing trusted service composition receives the new public RPC capability');
select ok(not has_table_privilege('service_role','ai.explorer_conversation_compass_item','UPDATE') and
  not has_function_privilege('service_role','ai.solmind_compass_category_change_valid(jsonb)','EXECUTE'),'no direct table/helper capability is added');
select is((select count(*)::integer from ai.ai_model_invocation),(select n from invocation_before),'all category operations leave model invocation count unchanged');

-- A real known restricted observation blocks new formation but preserves replay;
-- it is a SQL protocol fixture, not a real crisis classification or provider call.
select is((select outcome from pg_temp.observe(99,3,false)),'ok','synthetic private restriction is recorded for refusal checks');
select throws_ok($$select * from pg_temp.category(26315,26001,array[26001],'Blocked reflection')$$,'P0001','solmind_explorer_private_denied',
  'restricted private policy refuses a new category write');
select is((select outcome from pg_temp.category(26312,26001,array[26001,26004],'Reviewed complete focus')),'exact_replay',
  'existing exact category replay precedes new-reflection policy checks');
select is((select outcome from public.solmind_end_explorer_conversation_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(26401),
  (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),pg_temp.request_sha(26401))),'ok','explicit ending remains available without clearing the restriction');
select ok((select ending_directions_text like '% Compass changes.%' from ai.explorer_conversation_operation where operation_id=pg_temp.gid(26401)),
  'prospective ending truthfully counts category changes as Compass changes');
create temp table saved_ending as select ending_directions_text value from ai.explorer_conversation_operation where operation_id=pg_temp.gid(26401);
select is((select outcome from public.solmind_end_explorer_conversation_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(26401),
  (select initial_revision from ai.explorer_conversation_operation where operation_id=pg_temp.gid(26401)),pg_temp.request_sha(26401))),'exact_replay','ending replay remains unchanged');
select is((select ending_directions_text from ai.explorer_conversation_operation where operation_id=pg_temp.gid(26401)),(select value from saved_ending),
  'saved ending is retained rather than regenerated');
select ok((select jsonb_array_length(conversation_state->'compassItems')=24 and conversation_state->>'sessionStatus'='ended'
  from public.solmind_read_ended_explorer_conversations_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005))),
  'owned ended review retains category originals and provenance');
select throws_ok($$select * from pg_temp.category(26316,26001,array[26001],'No ended mutation')$$,'P0001',null,
  'ended review does not reactivate or permit category writes');
select is((select count(*)::integer from ai.ai_model_invocation),(select n from invocation_before),'End/review adds no model invocation');

select * from finish();
rollback;
