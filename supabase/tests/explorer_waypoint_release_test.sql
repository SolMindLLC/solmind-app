-- Focused active-conversation private Waypoint Release and immutable history.
-- Synthetic isolated-project SQL protocol fixture only; no Auth signin,
-- browser, model call, real human approval or retained demo mutation.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,pg_catalog,pg_temp;
set local statement_timeout='120s';
select plan(52);

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


create function pg_temp.release_waypoint(op_n integer,waypoint_n integer,revision_override integer default null,
 actor_n integer default 1,session_n integer default 50,conversation_n integer default 6005)
returns table(outcome text,conversation_state jsonb) language sql as $$
 select * from public.solmind_release_explorer_waypoint_v1(pg_temp.gid(actor_n),pg_temp.gid(session_n),pg_temp.gid(conversation_n),
   pg_temp.gid(op_n),coalesce(revision_override,
     (select initial_revision from ai.explorer_conversation_operation where actor_user_account_id=pg_temp.gid(actor_n) and operation_id=pg_temp.gid(op_n)),
     (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(conversation_n))),
   pg_temp.request_sha(op_n),pg_temp.gid(waypoint_n))
$$;
create function pg_temp.reject_release_audit() returns trigger language plpgsql as $$
begin
 if new.event_type='waypoint_released' and current_setting('solmind.fixture.fail_release_audit',true)='yes'
   then raise exception 'synthetic_release_audit_failure'; end if;
 return new;
end $$;
create trigger synthetic_release_audit_failure before insert on audit.audit_event
 for each row execute function pg_temp.reject_release_audit();

select is((select outcome from pg_temp.mutate(27001,'confirm_waypoint',10011,null,null,null,
 'Choose one focus','A useful week','One focus is written down')),'ok','Explorer explicitly chooses the initial synthetic private Waypoint');
create temp table initial_waypoint as select to_jsonb(w) value from content.waypoint w where waypoint_id=pg_temp.gid(27001);
select ok(not (pg_temp.read_state()->'waypoints'->0 ? 'release'),'unreleased projection retains legacy exact shape with no null release capture');
select throws_ok($$select * from pg_temp.release_waypoint(28001,27001,null,4,54)$$,'P0001',null,'other Explorer cannot release the owned Waypoint');
select throws_ok($$select * from pg_temp.release_waypoint(28002,27001,null,2,56)$$,'P0001',null,'Guide cannot release a private Explorer Waypoint');
select throws_ok($$select * from pg_temp.release_waypoint(28003,27001,null,3,57)$$,'P0001',null,'Admin cannot release a private Explorer Waypoint');
select throws_ok($$select * from pg_temp.release_waypoint(28004,99999)$$,'P0001','solmind_explorer_private_denied','foreign or missing Waypoint selector fails closed');
select is((select outcome from pg_temp.release_waypoint(28005,27001,0)),'stale_revision','stale reviewed revision changes nothing');
select ok(not exists(select 1 from ai.explorer_conversation_operation where operation_id=pg_temp.gid(28005)),'stale review creates no operation');

select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(2)),
 'synthetic protocol prepares a pending turn without a provider call');
create temp table pending_state as select pg_temp.read_state() value;
select is((select outcome from pg_temp.release_waypoint(28006,27001)),'unavailable','pending turn blocks release without canceling it');
select is(pg_temp.read_state(),(select value from pending_state),'pending refusal preserves all saved state');
select ok(not exists(select 1 from ai.explorer_conversation_operation where operation_id=pg_temp.gid(28006)),'pending refusal creates no release operation');
select is((select outcome from pg_temp.settle_private(2)),'ok','owned synthetic pending turn settles separately');
create temp table release_effect_before as select
 (select count(*) from ai.ai_model_invocation) invocations,(select count(*) from ai.ai_interaction_message) messages;

select set_config('solmind.fixture.fail_release_audit','yes',true);
create temp table before_failed_release as select pg_temp.read_state() value;
select throws_ok($$select * from pg_temp.release_waypoint(28007,27001)$$,'P0001','synthetic_release_audit_failure','audit failure rolls back release atomically');
select is(pg_temp.read_state(),(select value from before_failed_release),'failed audit retains revision and complete Waypoint state');
select ok(not exists(select 1 from ai.explorer_conversation_operation where operation_id=pg_temp.gid(28007))
 and not exists(select 1 from content.waypoint where released_operation_id=pg_temp.gid(28007)),'failed audit leaves no operation or release capture');
select set_config('solmind.fixture.fail_release_audit','no',true);
select is((select outcome from pg_temp.release_waypoint(28008,27001)),'ok','Explorer explicitly releases the current chosen Waypoint');
select is((select to_jsonb(w)-array['released_at','released_by_user_account_id','released_operation_id'] from content.waypoint w where waypoint_id=pg_temp.gid(27001)),
 (select value-array['released_at','released_by_user_account_id','released_operation_id'] from initial_waypoint),'release preserves every definition/source/chosen/Reached/history field');
select ok((select w.lifecycle_status='chosen' and w.reached_at is null and w.reached_evidence is null
 and w.released_by_user_account_id=pg_temp.gid(1) and w.released_operation_id=pg_temp.gid(28008)
 and w.released_at=o.completed_at from content.waypoint w join ai.explorer_conversation_operation o
 on o.actor_user_account_id=w.released_by_user_account_id and o.operation_id=w.released_operation_id
 where w.waypoint_id=pg_temp.gid(27001) and o.kind='release_waypoint'),'release is a paired actual completed operation, not a Reached claim');
select ok((select count(*)=1 and bool_and(metadata='{}'::jsonb and actor_role_context='explorer'
 and action='release' and reason_code='explorer_released_waypoint') from audit.audit_event
 where event_type='waypoint_released' and target_entity_id=pg_temp.gid(27001)),'one content-free release audit is committed with the operation');
create temp table released_state as select pg_temp.read_state() value;
select is((select outcome from pg_temp.release_waypoint(28008,27001)),'exact_replay','same operation and exact request replays without another transition');
select is(pg_temp.read_state(),(select value from released_state),'exact replay changes no state');
select is((select count(*)::integer from audit.audit_event where event_type='waypoint_released' and target_entity_id=pg_temp.gid(27001)),1,'exact replay creates no duplicate audit');
select throws_ok($$select * from pg_temp.release_waypoint(28008,99999)$$,'P0001','solmind_explorer_private_operation_conflict','changed selector under an existing operation conflicts');
select throws_ok($$select * from pg_temp.release_waypoint(28009,27001)$$,'P0001','solmind_explorer_private_denied','a new operation cannot release the same Waypoint again');
select ok((select value->'waypoints'->0->'release' ?& array['operationId','releasedAt']
 and (select count(*) from jsonb_object_keys(value->'waypoints'->0->'release'))=2
 and value#>>'{waypoints,0,release,operationId}'=pg_temp.gid(28008)::text from released_state),
 'state exposes only exact release operation/time, no actor identity or fake null capture');
select throws_ok($$select * from pg_temp.mutate(28010,'confirm_reached',null,null,27001,null,null,null,null,'Old release is not success')$$,
 'P0001','solmind_explorer_private_immutable','released Waypoint cannot later be marked Reached');
select throws_ok($$update content.waypoint set destination='History rewritten' where waypoint_id=pg_temp.gid(27001)$$,
 'P0001','solmind_explorer_private_immutable','stored definition is immutable after release');
select throws_ok($$update content.waypoint set released_at=null,released_by_user_account_id=null,released_operation_id=null where waypoint_id=pg_temp.gid(27001)$$,
 'P0001','solmind_explorer_private_immutable','release capture cannot be erased or silently reactivated');
select throws_ok($$delete from content.waypoint where waypoint_id=pg_temp.gid(27001)$$,
 'P0001','solmind_explorer_private_immutable','release does not authorize deleting source/history');
select throws_ok($$update ai.explorer_conversation_operation set completed_at=clock_timestamp() where operation_id=pg_temp.gid(28008)$$,
 'P0001','solmind_explorer_private_immutable','completed release operation capture is immutable');
select throws_ok($$delete from ai.explorer_conversation_operation where operation_id=pg_temp.gid(28008)$$,
 'P0001','solmind_explorer_private_immutable','completed release operation cannot be deleted');

-- The retained twenty-row bound includes Released history; release frees no slot.
do $$ declare i integer; begin
 for i in 2..20 loop
  if not exists(select 1 from pg_temp.mutate(27000+i,'confirm_waypoint',10011,null,null,null,
   'Synthetic retained destination '||i,'Synthetic retained meaning','Observable synthetic signal') where outcome='ok')
   then raise exception 'synthetic_release_bound_fixture_failed'; end if;
 end loop;
end $$;
select is((select count(*)::integer from content.waypoint where source_ai_interaction_session_id=pg_temp.gid(6005)),20,'Released rows still count toward twenty stored Waypoints');
select is((select outcome from pg_temp.mutate(27021,'confirm_waypoint',10011,null,null,null,'No spare slot','Meaning','Signal')),'unavailable','twenty-first retained row refuses without loss');
select is((select outcome from pg_temp.release_waypoint(28011,27002)),'ok','safe release remains available at the full retained-row bound');
select is((select count(*)::integer from content.waypoint where source_ai_interaction_session_id=pg_temp.gid(6005)),20,'release at capacity does not physically remove a row');
select throws_ok($$update content.waypoint set destination='Unreleased definition rewritten' where waypoint_id=pg_temp.gid(27003)$$,
 'P0001','solmind_explorer_private_immutable','current chosen definition also cannot be edited directly');

-- Positive coverage of the new guard on an unreleased chosen row.
select is((select outcome from pg_temp.mutate(28098,'confirm_reached',null,null,27005,null,null,null,null,E'Observed arrival.\nConfirmed supporting evidence.')),
 'ok','unreleased chosen Waypoint still confirms Reached through the history guard');
select ok(exists(select 1 from jsonb_array_elements(pg_temp.read_state()->'waypoints') item
 where item->>'id'=pg_temp.gid(27005)::text and item->>'status'='reached'
 and item->>'reachedEvidence'=E'Observed arrival.\nConfirmed supporting evidence.' and item->>'reachedAt' is not null),
 'successful Reached preserves exact multiline evidence and actual saved confirmation time');

create temp table prior_expiry as select expires_at value from identity.user_session where user_session_id=pg_temp.gid(50);
update identity.user_session set expires_at=clock_timestamp()-interval '1 minute' where user_session_id=pg_temp.gid(50);
select throws_ok($$select * from pg_temp.release_waypoint(28012,27003)$$,'P0001',null,'expired application session cannot release');
update identity.user_session set expires_at=(select value from prior_expiry) where user_session_id=pg_temp.gid(50);

-- Known restriction is preserved during owned closure; no new reflection occurs.
select is((select outcome from pg_temp.observe(99,3,false)),'ok','synthetic observed restriction is retained');
create temp table restriction_before as select safety_contract_version,restricted_level,adult_reflection_stopped,safety_version
 from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005);
select is((select outcome from pg_temp.release_waypoint(28013,27003)),'ok','owned release remains available under a known restriction');
select ok(not exists((select safety_contract_version,restricted_level,adult_reflection_stopped,safety_version
 from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005) except select * from restriction_before)
 union all (select * from restriction_before except select safety_contract_version,restricted_level,adult_reflection_stopped,safety_version
 from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005))),'release does not reset or reclassify policy');

-- A legacy unknown owned container may close an existing Waypoint, without
-- clear-state initialization or another Send. Exact source ownership is real.
insert into ai.ai_interaction_session(ai_interaction_session_id,session_type,actor_user_account_id,actor_role_context,
 guide_profile_id,explorer_profile_id,guide_explorer_relationship_id,practice_id)
values(pg_temp.gid(6103),'explorer_reflection',pg_temp.gid(4),'explorer',pg_temp.gid(23),pg_temp.gid(26),pg_temp.gid(27),pg_temp.gid(22));
insert into ai.explorer_conversation_state(conversation_id,actor_user_account_id) values(pg_temp.gid(6103),pg_temp.gid(4));
insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,sender_type,
 sender_user_account_id,sender_role_context,content_text)
values(pg_temp.gid(61031),pg_temp.gid(6103),1,'user',pg_temp.gid(4),'explorer','Synthetic legacy owned source.');
insert into content.waypoint(waypoint_id,guide_explorer_relationship_id,source_ai_interaction_session_id,source_message_id,title,
 destination,why_it_matters,arrival_signal,lifecycle_status,chosen_by_explorer_user_account_id,chosen_at)
values(pg_temp.gid(27031),pg_temp.gid(27),pg_temp.gid(6103),pg_temp.gid(61031),'Legacy destination','Legacy destination',
 'Legacy meaning','Legacy signal','chosen',pg_temp.gid(4),clock_timestamp());
select is((select outcome from pg_temp.release_waypoint(28014,27031,null,4,54,6103)),'ok','unknown-policy owned release does not require or invent clear reflection');
select ok((select safety_contract_version is null and restricted_level is null and adult_reflection_stopped is null and safety_version is null
 from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6103)),'unknown policy remains unknown after release');

select is((select outcome from public.solmind_end_explorer_conversation_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(28100),
 (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),pg_temp.request_sha(28100))),'ok','ending remains a separately confirmed action');
select throws_ok($$select * from pg_temp.release_waypoint(28015,27004)$$,'P0001',null,'ended conversation review cannot release or reactivate a Waypoint');
select ok((select conversation_state#>>'{waypoints,0,release,operationId}'=pg_temp.gid(28008)::text
 from public.solmind_read_ended_explorer_conversations_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005))),
 'ended owned history retains exact release capture and original source');
select is((select count(*)::integer from ai.ai_model_invocation),(select invocations::integer from release_effect_before),'all release operations create no model invocation');
select is((select count(*)::integer from ai.ai_interaction_message),(select messages::integer+1 from release_effect_before),'release creates no message; only the explicit legacy fixture source was added');
select ok(has_function_privilege('service_role','public.solmind_release_explorer_waypoint_v1(uuid,uuid,uuid,uuid,integer,text,uuid)','EXECUTE')
 and not has_function_privilege('anon','public.solmind_release_explorer_waypoint_v1(uuid,uuid,uuid,uuid,integer,text,uuid)','EXECUTE')
 and not has_function_privilege('authenticated','public.solmind_release_explorer_waypoint_v1(uuid,uuid,uuid,uuid,integer,text,uuid)','EXECUTE'),
 'only the trusted service composition receives the exact release capability');
select ok(not has_table_privilege('service_role','content.waypoint','SELECT,INSERT,UPDATE,DELETE')
 and not has_function_privilege('service_role','content.solmind_waypoint_history_guard_v1()','EXECUTE'),
 'release adds no private table or trigger-helper API capability');
select * from finish();
rollback;
