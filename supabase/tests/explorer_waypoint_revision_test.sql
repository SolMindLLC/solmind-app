-- Focused conversational Waypoint revision/revisit and immutable source history.
-- Synthetic isolated-project SQL only; application questions/Explorer answers
-- are not AI messages, exact historical quotations or provider proof.
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


create function pg_temp.release_waypoint(op_n integer,waypoint_n integer,revision_override integer default null,
 actor_n integer default 1,session_n integer default 50,conversation_n integer default 6005)
returns table(outcome text,conversation_state jsonb) language sql as $$
 select * from public.solmind_release_explorer_waypoint_v1(pg_temp.gid(actor_n),pg_temp.gid(session_n),pg_temp.gid(conversation_n),
   pg_temp.gid(op_n),coalesce(revision_override,
     (select initial_revision from ai.explorer_conversation_operation where actor_user_account_id=pg_temp.gid(actor_n) and operation_id=pg_temp.gid(op_n)),
     (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(conversation_n))),
   pg_temp.request_sha(op_n),pg_temp.gid(waypoint_n))
$$;
create function pg_temp.revise_waypoint(op_n integer,waypoint_n integer,kind_name text default 'revise_waypoint',
 answers_value jsonb default '[]',revision_override integer default null,actor_n integer default 1,
 session_n integer default 50,conversation_n integer default 6005)
returns table(outcome text,conversation_state jsonb) language sql as $$
 select * from public.solmind_confirm_explorer_waypoint_revision_v1(pg_temp.gid(actor_n),pg_temp.gid(session_n),pg_temp.gid(conversation_n),
  pg_temp.gid(op_n),coalesce(revision_override,
   (select initial_revision from ai.explorer_conversation_operation where actor_user_account_id=pg_temp.gid(actor_n) and operation_id=pg_temp.gid(op_n)),
   (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(conversation_n))),
  pg_temp.request_sha(op_n),kind_name,pg_temp.gid(waypoint_n),answers_value)
$$;
create function pg_temp.answer(component_name text,answer_value text) returns jsonb language sql immutable as $$
 select jsonb_build_array(jsonb_build_object('component',component_name,'answer',answer_value))
$$;
create function pg_temp.reject_revision_audit() returns trigger language plpgsql as $$
begin
 if new.event_type in ('waypoint_revised','waypoint_revisited') and current_setting('solmind.fixture.fail_revision_audit',true)='yes'
  then raise exception 'synthetic_revision_audit_failure'; end if;
 return new;
end $$;
create trigger synthetic_revision_audit_failure before insert on audit.audit_event
 for each row execute function pg_temp.reject_revision_audit();

select is((select outcome from pg_temp.mutate(30001,'confirm_waypoint',10011,null,null,null,
 'Choose one focus','A useful week','One focus is written down')),'ok','Explorer confirms the original private Waypoint');
create temp table original_waypoint as select to_jsonb(w) value from content.waypoint w where waypoint_id=pg_temp.gid(30001);
select ok(not (pg_temp.read_state()->'waypoints'->0 ? 'lifecycle'),'legacy initial Waypoint has no fabricated lifecycle or clarification capture');
select throws_ok($$select * from pg_temp.revise_waypoint(31000,30001)$$,'P0001','solmind_explorer_private_invalid_input','revision requires an actual changed answer');
select throws_ok($$select * from pg_temp.revise_waypoint(31000,30001,'revise_waypoint',pg_temp.answer('meaning','A useful week'))$$,
 'P0001','solmind_explorer_private_invalid_input','unchanged answer is not a new confirmed definition');
select throws_ok($$select * from pg_temp.revise_waypoint(31000,30001,'revisit_waypoint')$$,
 'P0001','solmind_explorer_private_denied','a current unreleased chosen head is not a prior Reached/released lifecycle');
select throws_ok($$select * from pg_temp.revise_waypoint(31000,30001,'revise_waypoint','[{"component":"destination","answer":"New","questionKey":"forged"}]')$$,
 'P0001','solmind_explorer_private_invalid_input','browser cannot supply a question key or extra field');
select throws_ok($$select * from pg_temp.revise_waypoint(31000,30001,'revise_waypoint','[{"component":"meaning","answer":"New"},{"component":"destination","answer":"New"}]')$$,
 'P0001','solmind_explorer_private_invalid_input','answers must preserve canonical component order');
select throws_ok($$select * from pg_temp.revise_waypoint(31000,30001,'revise_waypoint','[{"component":"meaning","answer":"New"},{"component":"meaning","answer":"Another"}]')$$,
 'P0001','solmind_explorer_private_invalid_input','duplicate answered components refuse');
select throws_ok($$select * from pg_temp.revise_waypoint(31000,30001,'revise_waypoint',pg_temp.answer('meaning',' leading space'))$$,
 'P0001','solmind_explorer_private_invalid_input','noncanonical leading whitespace refuses rather than silently changing exact answer');
select throws_ok($$select * from pg_temp.revise_waypoint(31000,30001,'revise_waypoint',pg_temp.answer('meaning',U&'\00A0leading unicode space'))$$,
 'P0001','solmind_explorer_private_invalid_input','ECMAScript Unicode trim boundary agrees with the browser');
select throws_ok($$select * from pg_temp.revise_waypoint(31000,30001,'revise_waypoint',pg_temp.answer('reachedEvidence','No'))$$,
 'P0001','solmind_explorer_private_invalid_input','revision cannot write Reached evidence through a component alias');
select throws_ok($$select * from pg_temp.revise_waypoint(31000,30001,'revise_waypoint',pg_temp.answer('meaning','Changed'),null,4,54)$$,
 'P0001',null,'other Explorer cannot revise this owned private Waypoint');
select throws_ok($$select * from pg_temp.revise_waypoint(31000,30001,'revise_waypoint',pg_temp.answer('meaning','Changed'),null,2,56)$$,
 'P0001',null,'Guide cannot confirm an Explorer-owned revision');
select throws_ok($$select * from pg_temp.revise_waypoint(31000,30001,'revise_waypoint',pg_temp.answer('meaning','Changed'),null,3,57)$$,
 'P0001',null,'Admin cannot confirm an Explorer-owned revision');
select is((select outcome from pg_temp.revise_waypoint(31000,30001,'revise_waypoint',pg_temp.answer('meaning','Changed'),0)),
 'stale_revision','a stale reviewed replacement changes nothing');

select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(2)),'synthetic pending turn starts without a provider');
create temp table pending_before_revision as select pg_temp.read_state() value;
select is((select outcome from pg_temp.revise_waypoint(31000,30001,'revise_waypoint',pg_temp.answer('meaning','Changed'))),
 'unavailable','pending turn blocks a new revision without settling it');
select is(pg_temp.read_state(),(select value from pending_before_revision),'pending refusal retains complete state');
select is((select outcome from pg_temp.settle_private(2)),'ok','the synthetic pending turn settles independently');
create temp table lifecycle_effect_before as select
 (select count(*) from ai.ai_model_invocation) invocations,(select count(*) from ai.ai_interaction_message) messages;

select set_config('solmind.fixture.fail_revision_audit','yes',true);
create temp table failed_revision_before as select pg_temp.read_state() value;
select throws_ok($$select * from pg_temp.revise_waypoint(31000,30001,'revise_waypoint',pg_temp.answer('meaning','Changed'))$$,
 'P0001','synthetic_revision_audit_failure','audit failure rolls back operation, successor and exact answers together');
select is(pg_temp.read_state(),(select value from failed_revision_before),'failed audit preserves all definition and revision state');
select ok(not exists(select 1 from content.waypoint where waypoint_id=pg_temp.gid(31000))
 and not exists(select 1 from content.waypoint_clarification where waypoint_id=pg_temp.gid(31000))
 and not exists(select 1 from ai.explorer_conversation_operation where operation_id=pg_temp.gid(31000)),
 'failed audit leaves no partial successor, clarification or operation');
select set_config('solmind.fixture.fail_revision_audit','no',true);
select is((select outcome from pg_temp.revise_waypoint(31001,30001,'revise_waypoint',
 pg_temp.answer('destination','Choose one focus')||pg_temp.answer('meaning','A calmer ðŸ§­ week'))),'ok',
 'Explorer confirms a conversational meaning answer while preserving an unchanged destination');
select is((select to_jsonb(w) from content.waypoint w where waypoint_id=pg_temp.gid(30001)),
 (select value from original_waypoint),'confirmed successor never changes the original definition, source, chosen time or history');
select ok((select predecessor_waypoint_id=pg_temp.gid(30001) and creation_reason='revision'
 and destination='Choose one focus' and why_it_matters='A calmer ðŸ§­ week' and arrival_signal='One focus is written down'
 and source_message_id=pg_temp.gid(10011) and lifecycle_status='chosen' and reached_at is null and reached_evidence is null
 and released_at is null from content.waypoint where waypoint_id=pg_temp.gid(31001)),
 'changed component is new, omitted components derive from predecessor and no historical success/release carries forward');
select ok((select count(*)=1 and bool_and(component='meaning' and question_key='waypoint.meaning.v1'
 and answer_text='A calmer ðŸ§­ week' and source_actor_user_account_id=pg_temp.gid(1) and retention_class='sensitive_content')
 from content.waypoint_clarification where waypoint_id=pg_temp.gid(31001)),
 'only actually changed exact Explorer answers create server-keyed source records');
select ok((select value->>'creationReason'='revision' and value->>'predecessorWaypointId'=pg_temp.gid(30001)::text
 and jsonb_array_length(value->'clarifications')=1
 and value#>>'{clarifications,0,answer}'='A calmer ðŸ§­ week'
 and (select count(*) from jsonb_object_keys(value->'clarifications'->0))=4
 from jsonb_array_elements(pg_temp.read_state()->'waypoints') x(value0)
 cross join lateral (select value0->'lifecycle' value) y where value0->>'id'=pg_temp.gid(31001)::text),
 'closed source history exposes exact component/question/answer/time and predecessor, never actor authority');
create temp table first_revision_state as select pg_temp.read_state() value;
select is((select outcome from pg_temp.revise_waypoint(31001,30001,'revise_waypoint',
 pg_temp.answer('destination','Choose one focus')||pg_temp.answer('meaning','A calmer ðŸ§­ week'))),'exact_replay','identical confirmed revision replays without another successor');
select is(pg_temp.read_state(),(select value from first_revision_state),'exact retry is a no-write state read');
select is((select count(*)::integer from audit.audit_event where event_type='waypoint_revised' and target_entity_id=pg_temp.gid(31001)),1,
 'same confirmed revision emits one content-free audit');
select throws_ok($$select * from pg_temp.revise_waypoint(31001,30001,'revise_waypoint',pg_temp.answer('meaning','Different'))$$,
 'P0001','solmind_explorer_private_operation_conflict','changed content under an existing operation conflicts');
select throws_ok($$select * from pg_temp.revise_waypoint(31002,30001,'revise_waypoint',pg_temp.answer('meaning','Sibling'))$$,
 'P0001','solmind_explorer_private_denied','stale predecessor cannot create a sibling current definition');
select throws_ok($$select * from pg_temp.mutate(32001,'confirm_reached',null,null,30001,null,null,null,null,'Old definition cannot receive new success')$$,
 'P0001','solmind_explorer_private_immutable','superseded chosen definition cannot receive prospective Reached');
select throws_ok($$select * from pg_temp.release_waypoint(32001,30001)$$,
 'P0001','solmind_explorer_private_immutable','superseded definition cannot receive a new release capture');
select is((select outcome from pg_temp.revise_waypoint(31002,31001,'revise_waypoint',pg_temp.answer('arrivalSignal','A selected next step exists'))),
 'ok','a further Explorer-confirmed answer creates a linear current successor');
select ok((select predecessor_waypoint_id=pg_temp.gid(31001) and why_it_matters='A calmer ðŸ§­ week'
 from content.waypoint where waypoint_id=pg_temp.gid(31002)),'unchanged meaning inherits the exact previous clarification');
select is((select answer_text from content.waypoint_clarification where waypoint_id=pg_temp.gid(31001) and component='meaning'),
 'A calmer ðŸ§­ week','earlier clarification remains available through predecessor history');
select throws_ok($$update content.waypoint_clarification set answer_text='Rewritten' where waypoint_id=pg_temp.gid(31001)$$,
 'P0001','solmind_explorer_private_immutable','source answers cannot be overwritten');
select throws_ok($$delete from content.waypoint_clarification where waypoint_id=pg_temp.gid(31001)$$,
 'P0001','solmind_explorer_private_immutable','source history cannot be silently removed');
select throws_ok($$update content.waypoint set predecessor_waypoint_id=pg_temp.gid(30001) where waypoint_id=pg_temp.gid(31002)$$,
 'P0001','solmind_explorer_private_immutable','confirmed lineage cannot be rewired');
select is((select outcome from pg_temp.mutate(30001,'confirm_waypoint',10011,null,null,null,
 'Choose one focus','A useful week','One focus is written down')),'exact_replay','old exact Choose replay remains valid before prospective history guards');

select is((select outcome from pg_temp.mutate(30002,'confirm_waypoint',10011,null,null,null,'Review one action','Meaning','Action recorded')),'ok','another Waypoint is explicitly chosen');
select is((select outcome from pg_temp.mutate(32002,'confirm_reached',null,null,30002,null,null,null,null,'The synthetic action was reviewed.')),
 'ok','Explorer separately confirms Reached with reviewed evidence');
create temp table reached_original as select to_jsonb(w) value from content.waypoint w where waypoint_id=pg_temp.gid(30002);
select is((select outcome from pg_temp.revise_waypoint(33002,30002,'revisit_waypoint')),'ok','explicit Revisit can retain the definition with zero changed answers');
select is((select to_jsonb(w) from content.waypoint w where waypoint_id=pg_temp.gid(30002)),(select value from reached_original),
 'Revisit retains historical Reached evidence, actor and time byte-for-byte');
select ok((select lifecycle_status='chosen' and predecessor_waypoint_id=pg_temp.gid(30002) and creation_reason='revisit'
 and reached_at is null and reached_evidence is null and reached_by_explorer_user_account_id is null and released_at is null
 from content.waypoint where waypoint_id=pg_temp.gid(33002)),'new current lifecycle starts chosen without carrying old arrival evidence');
select is((select count(*)::integer from content.waypoint_clarification where waypoint_id=pg_temp.gid(33002)),0,
 'unchanged Revisit creates no fabricated new clarification or source quotation');
select is((select outcome from pg_temp.mutate(32002,'confirm_reached',null,null,30002,null,null,null,null,'The synthetic action was reviewed.')),
 'exact_replay','earlier exact Reached replay stays available after a new lifecycle');
select throws_ok($$select * from pg_temp.revise_waypoint(33004,30002,'revisit_waypoint')$$,
 'P0001','solmind_explorer_private_denied','the same old Reached lifecycle cannot branch into another current version');
select is((select outcome from pg_temp.release_waypoint(32003,31002)),'ok','current revised Waypoint may be explicitly released');
create temp table released_predecessor as select to_jsonb(w) value from content.waypoint w where waypoint_id=pg_temp.gid(31002);
select is((select outcome from pg_temp.revise_waypoint(33003,31002,'revisit_waypoint')),'ok','a released current head may start a newly confirmed lifecycle');
select is((select to_jsonb(w) from content.waypoint w where waypoint_id=pg_temp.gid(31002)),(select value from released_predecessor),
 'returning to released work preserves its prior release capture and definition');
select ok((select lifecycle_status='chosen' and released_at is null and released_operation_id is null
 from content.waypoint where waypoint_id=pg_temp.gid(33003)),'Revisit never erases an old release or copies it onto the new current lifecycle');
select is((select outcome from pg_temp.release_waypoint(32003,31002)),'exact_replay','old release retry remains a read after Revisit');

-- All predecessors and current heads still count toward the twenty-row bound.
do $$ declare i integer; n integer; begin
 select count(*)::integer into n from content.waypoint where source_ai_interaction_session_id=pg_temp.gid(6005);
 for i in 1..20-n loop
  if not exists(select 1 from pg_temp.mutate(34000+i,'confirm_waypoint',10011,null,null,null,
   'Stored destination '||i,'Stored meaning','Observable signal') where outcome='ok') then raise exception 'synthetic_lifecycle_bound_failed'; end if;
 end loop;
end $$;
select is((select count(*)::integer from content.waypoint where source_ai_interaction_session_id=pg_temp.gid(6005)),20,
 'all retained confirmed versions count, including superseded, released and Reached predecessors');
select is((select outcome from pg_temp.revise_waypoint(35001,33003,'revise_waypoint',pg_temp.answer('meaning','No capacity'))),
 'unavailable','a successor at capacity refuses without dropping prior history');
select is((select outcome from pg_temp.release_waypoint(35002,33003)),'ok','safe closure remains available at the retained bound');
select is((select count(*)::integer from content.waypoint where source_ai_interaction_session_id=pg_temp.gid(6005)),20,'safe closure frees no retained history slot');
select is((select count(*)::integer from ai.ai_model_invocation),(select invocations::integer from lifecycle_effect_before),'revision/revisit/release create no model invocation');
select is((select count(*)::integer from ai.ai_interaction_message),(select messages::integer from lifecycle_effect_before),'application conversational answers are not inserted as AI or Explorer interaction messages');

select is((select outcome from pg_temp.observe(99,3,false)),'ok','synthetic restriction remains distinct from new reflection');
select throws_ok($$select * from pg_temp.revise_waypoint(35003,33002,'revise_waypoint',pg_temp.answer('meaning','Blocked'))$$,
 'P0001','solmind_explorer_private_denied','restricted policy refuses a new conversational successor');
select is((select outcome from pg_temp.revise_waypoint(31001,30001,'revise_waypoint',
 pg_temp.answer('destination','Choose one focus')||pg_temp.answer('meaning','A calmer ðŸ§­ week'))),'exact_replay','existing revision replay precedes new-reflection policy checks');
select is((select outcome from public.solmind_end_explorer_conversation_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(36001),
 (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),pg_temp.request_sha(36001))),'ok','ending remains a separate explicit closure');
select throws_ok($$select * from pg_temp.revise_waypoint(36002,33002,'revise_waypoint',pg_temp.answer('meaning','No ended edit'))$$,
 'P0001',null,'ended conversation history cannot create a revision or reactivate a lifecycle');
select ok((select exists(select 1 from jsonb_array_elements(conversation_state->'waypoints') w
 where w->>'id'=pg_temp.gid(31001)::text and w#>>'{lifecycle,clarifications,0,answer}'='A calmer ðŸ§­ week')
 from public.solmind_read_ended_explorer_conversations_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005))),
 'owned ended review retains actual lineage and application-question/Explorer-answer history');
-- Unknown policy remains held for new reflection; a fixture row supplies no
-- clear-policy permission and no new model or fabricated conversation reply.
insert into ai.ai_interaction_session(ai_interaction_session_id,session_type,actor_user_account_id,actor_role_context,
 guide_profile_id,explorer_profile_id,guide_explorer_relationship_id,practice_id)
values(pg_temp.gid(6203),'explorer_reflection',pg_temp.gid(4),'explorer',pg_temp.gid(23),pg_temp.gid(26),pg_temp.gid(27),pg_temp.gid(22));
insert into ai.explorer_conversation_state(conversation_id,actor_user_account_id) values(pg_temp.gid(6203),pg_temp.gid(4));
insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,sender_type,
 sender_user_account_id,sender_role_context,content_text)
values(pg_temp.gid(62031),pg_temp.gid(6203),1,'user',pg_temp.gid(4),'explorer','Synthetic legacy source.');
insert into content.waypoint(waypoint_id,guide_explorer_relationship_id,source_ai_interaction_session_id,source_message_id,title,
 destination,why_it_matters,arrival_signal,lifecycle_status,chosen_by_explorer_user_account_id,chosen_at)
values(pg_temp.gid(37001),pg_temp.gid(27),pg_temp.gid(6203),pg_temp.gid(62031),'Legacy destination','Legacy destination',
 'Legacy meaning','Legacy signal','chosen',pg_temp.gid(4),clock_timestamp());
select throws_ok($$select * from pg_temp.revise_waypoint(37002,37001,'revise_waypoint',pg_temp.answer('meaning','No unknown-policy reflection'),null,4,54,6203)$$,
 'P0001','solmind_explorer_private_denied','unknown policy refuses a new successor without clear initialization');
select ok((select safety_contract_version is null and restricted_level is null and adult_reflection_stopped is null and safety_version is null
 from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6203)),'failed revision preserves unknown policy exactly');

select ok(has_function_privilege('service_role','public.solmind_confirm_explorer_waypoint_revision_v1(uuid,uuid,uuid,uuid,integer,text,text,uuid,jsonb)','EXECUTE')
 and not has_function_privilege('anon','public.solmind_confirm_explorer_waypoint_revision_v1(uuid,uuid,uuid,uuid,integer,text,text,uuid,jsonb)','EXECUTE')
 and not has_function_privilege('authenticated','public.solmind_confirm_explorer_waypoint_revision_v1(uuid,uuid,uuid,uuid,integer,text,text,uuid,jsonb)','EXECUTE'),
 'only trusted service composition receives the closed confirmation capability');
select ok((select relrowsecurity from pg_class where oid='content.waypoint_clarification'::regclass)
 and not exists(select 1 from pg_policies where schemaname='content' and tablename='waypoint_clarification')
 and not has_table_privilege('service_role','content.waypoint_clarification','SELECT,INSERT,UPDATE,DELETE'),
 'clarifications remain sensitive private RLS rows with no permissive policy or API table grant');
select ok(not has_function_privilege('service_role','content.solmind_waypoint_clarification_immutable_v1()','EXECUTE'),
 'history guard is not an API capability');
select * from finish();
rollback;
