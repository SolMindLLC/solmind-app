-- Focused synthetic SQL proof of the product hard stops (slice 2a) in a disposable project only.
-- Reuses the model-binding suite's authority/context fixture (own id prefix). No provider, credential,
-- real person, login or human approval; a trusted caller supplies the selected model as before.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,pg_catalog,pg_temp;
set local statement_timeout='120s';
select no_plan();

create function pg_temp.gid(n integer) returns uuid language sql immutable as $$
  select ('f5110000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
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
-- Chat step slice S3 (2026-11-03): the saved Compass and Waypoint section and its source ids, rebuilt from this
-- fixture conversation's rows for each new Send (the inspector compares them exactly): current points in display
-- order, the saved Priority and attention, the last five needle moves on a current point (oldest first, each
-- with the point's current label), the current Waypoint heads, no drafts.
create function pg_temp.compass_context() returns jsonb language sql stable as $$
  select jsonb_build_object('version','explorer-compass-context.v1',
    'points',coalesce((select jsonb_agg(jsonb_build_object('id',c.item_id,'label',ai.solmind_exclusion_normalize_v3(c.label),
      'order',c.ord-1,'formation','saved','anchor',c.compass_anchor,'emphasis',c.relative_emphasis) order by c.ord)
      from (select x.*,row_number() over(order by x.display_order) as ord from ai.explorer_conversation_compass_item x
        where x.conversation_id=pg_temp.gid(6005) and x.merged_into_item_id is null) c),'[]'::jsonb),
    'priorityId',(select s.priority_id from ai.explorer_conversation_state s where s.conversation_id=pg_temp.gid(6005)),
    'attentionId',(select s.attention_id from ai.explorer_conversation_state s where s.conversation_id=pg_temp.gid(6005)),
    'recentRoute',coalesce((select jsonb_agg(jsonb_build_object('kind',r.compass_route_kind,'pointId',r.compass_route_item_id,
      'label',ai.solmind_exclusion_normalize_v3(r.current_label)) order by r.initial_revision,r.operation_id)
      from (select o.*,c.label as current_label from ai.explorer_conversation_operation o join ai.explorer_conversation_compass_item c
          on c.conversation_id=o.conversation_id and c.item_id=o.compass_route_item_id and c.merged_into_item_id is null
        where o.conversation_id=pg_temp.gid(6005) and o.compass_route_kind='attention_changed'
        order by o.initial_revision desc,o.operation_id desc limit 5) r),'[]'::jsonb),
    'waypoints',coalesce((select jsonb_agg(jsonb_build_object('id',w.waypoint_id,'title',ai.solmind_exclusion_normalize_v3(w.title),
      'destination',ai.solmind_exclusion_normalize_v3(w.destination),'meaning',ai.solmind_exclusion_normalize_v3(w.why_it_matters),
      'arrivalSignal',ai.solmind_exclusion_normalize_v3(w.arrival_signal),
      'stage',case when w.lifecycle_status='reached' then 'reached' when w.released_at is not null then 'released' else 'formed' end,
      'reachedEvidence',case when w.lifecycle_status='reached' then ai.solmind_exclusion_normalize_v3(w.reached_evidence) end)
      order by w.created_at,w.waypoint_id)
      from content.waypoint w where w.source_ai_interaction_session_id=pg_temp.gid(6005)
        and not exists(select 1 from content.waypoint s where s.predecessor_waypoint_id=w.waypoint_id)),'[]'::jsonb),
    'drafts','[]'::jsonb)
$$;
create function pg_temp.compass_source_ids() returns uuid[] language sql stable as $$
  select coalesce(array_agg(x.id),array[]::uuid[]) from (
    select c.item_id as id from ai.explorer_conversation_compass_item c
      where c.conversation_id=pg_temp.gid(6005) and c.merged_into_item_id is null
    union all select w.waypoint_id from content.waypoint w where w.source_ai_interaction_session_id=pg_temp.gid(6005)
      and not exists(select 1 from content.waypoint s where s.predecessor_waypoint_id=w.waypoint_id)) x
$$;
create function pg_temp.context_value(msg uuid,body text) returns jsonb language sql stable as $$
  select jsonb_build_object('contractVersion','wi007-v0.1+onboarding-fields-v2+compass-v1','aiRole','solmind_virtual_guide','actorRoleContext','explorer',
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
    'compassContext',pg_temp.compass_context(),
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
      union all select x from unnest(pg_temp.compass_source_ids()) x
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
create function pg_temp.prepare_private_legacy(slot_n integer,lvl integer default 0,minor_flag boolean default false,
  body_override text default null)
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
      union all select x from unnest(pg_temp.compass_source_ids()) x
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
    saved.safety_version,saved.fallback,saved.minor);
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


-- Fixture activation (copied steps): one effective Guide-scoped methodology for the synthetic Guide.
select is(pg_temp.register_version(1001),'ok','synthetic Admin registers the first draft');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.screen_start(1001)),
  'trusted caller explicitly supplies the default model for a new screen');
select is(pg_temp.screen_terminal(1001),'ok','original captured screen settles after a caller presented another selection');
select is(pg_temp.admin_review(1001),'ok','synthetic Admin consistency is retained');
select is(pg_temp.guide_decision(1001),'ok','synthetic owning Guide review activates the first fixture');

-- Day-dependent assertions use today's Chicago day: refuse to run in the minutes around Chicago midnight.
do $midnight$ begin
  if (select next_day_start-clock_timestamp() from ai.solmind_explorer_ai_use_day_v1(clock_timestamp()))<interval '15 minutes'
    or (select clock_timestamp()-day_start from ai.solmind_explorer_ai_use_day_v1(clock_timestamp()))<interval '1 minute'
    then raise exception 'explorer_ai_use_suite_must_not_run_across_chicago_midnight'; end if;
end $midnight$;
create function pg_temp.noon(day_value date) returns timestamptz language sql immutable as $$
  select (day_value::timestamp+interval '12 hours') at time zone 'America/Chicago'
$$;
create function pg_temp.set_limit(key_name text,value_n integer,op_n integer) returns text language sql as $$
  select outcome from public.solmind_set_application_setting_integer(key_name,value_n,
    (select version from core.application_setting where setting_key=key_name),pg_temp.gid(op_n),
    'paul_approved',pg_temp.gid(9999),'paul_approved_configuration_change')
$$;
create function pg_temp.pause(actor_n integer default 1,app_n integer default 50)
returns table(outcome text,notice_kind text,crisis boolean,adults_only boolean) language sql as $$
  select * from public.solmind_read_explorer_ai_use_pause_v1(pg_temp.gid(actor_n),pg_temp.gid(app_n))
$$;
create function pg_temp.sends(actor_n integer) returns integer language sql stable as $$
  select count(*)::integer from ai.explorer_conversation_operation where actor_user_account_id=pg_temp.gid(actor_n) and kind='send'
$$;
create function pg_temp.stops(kind_name text,actor_n integer default null) returns integer language sql stable as $$
  select count(*)::integer from ai.explorer_ai_use_stop where stop_kind=kind_name
    and actor_user_account_id is not distinct from case when actor_n is null then null else pg_temp.gid(actor_n) end
    and stop_day=(select stop_day from ai.solmind_explorer_ai_use_day_v1(clock_timestamp()))
$$;
create function pg_temp.observe4(slot integer,lvl integer default 0) returns table(outcome text,policy_state jsonb) language plpgsql as $$
declare rev integer;
begin
  select revision into rev from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6006);
  return query select * from public.solmind_observe_explorer_conversation_fallback_v3(
    pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6006),pg_temp.gid(20000+slot*10),pg_temp.gid(20004+slot*10),
    rev,methodology.hash_json(jsonb_build_array('synthetic-command-4',slot)),'explorer-safety-reply.v1',
    'synthetic-fallback.v1','synthetic-model-policy.v1',repeat('A',64),lvl::smallint,false);
end $$;
create function pg_temp.evidence(conversation_n integer,logical_n integer) returns integer language sql stable as $$
  select count(*)::integer from ai.explorer_safety_evidence
    where conversation_id=pg_temp.gid(conversation_n) and logical_operation_id=pg_temp.gid(logical_n)
$$;
create function pg_temp.today() returns date language sql stable as $$
  select stop_day from ai.solmind_explorer_ai_use_day_v1(clock_timestamp())
$$;

-- Settings: the closed family gains exactly four rows with Paul's values and ranges (decision queue 01:02:19,
-- 13:22:56).
select is((select count(*)::integer from core.application_setting),6,'the closed setting family now has six rows');
select ok(exists(select 1 from core.application_setting where application_setting_id='a30f0250-0000-4000-8000-000000000001'
    and setting_key='explorer_ai_use_automatic_lifts_per_week' and integer_value=1 and minimum_integer_value=0
    and default_integer_value=1 and maximum_integer_value=7 and version=1 and retention_class='core_business'),
  'automatic lifts per week start at 1 within 0 to 7');
select ok(exists(select 1 from core.application_setting where application_setting_id='a30f0260-0000-4000-8000-000000000001'
    and setting_key='explorer_ai_use_automatic_lifts_per_month' and integer_value=2 and minimum_integer_value=0
    and default_integer_value=2 and maximum_integer_value=30 and version=1 and retention_class='core_business'),
  'automatic lifts per month start at 2 within 0 to 30');
select throws_ok($$select pg_temp.set_limit('explorer_ai_use_automatic_lifts_per_week',8,9140)$$,
  'P0001','solmind_application_setting_invalid_value','the writer refuses more than 7 automatic lifts a week');
select throws_ok($$select pg_temp.set_limit('explorer_ai_use_automatic_lifts_per_month',31,9141)$$,
  'P0001','solmind_application_setting_invalid_value','the writer refuses more than 30 automatic lifts a month');
select throws_ok($$select pg_temp.set_limit('explorer_ai_use_automatic_lifts_per_week',-1,9142)$$,
  'P0001','solmind_application_setting_invalid_value','the writer refuses a negative number of lifts');
select ok(exists(select 1 from core.application_setting where application_setting_id='a30f0230-0000-4000-8000-000000000001'
    and setting_key='explorer_ai_use_individual_daily_call_limit' and integer_value=500 and minimum_integer_value=1
    and default_integer_value=500 and maximum_integer_value=2000 and version=1 and retention_class='core_business'),
  'individual stop setting starts at 500 within 1 to 2,000');
select ok(exists(select 1 from core.application_setting where application_setting_id='a30f0240-0000-4000-8000-000000000001'
    and setting_key='explorer_ai_use_shared_daily_calls_per_active_explorer' and integer_value=300 and minimum_integer_value=1
    and default_integer_value=300 and maximum_integer_value=2000 and version=1 and retention_class='core_business'),
  'shared stop setting starts at 300 per active Explorer within 1 to 2,000');
select ok(exists(select 1 from core.application_setting where setting_key='explorer_shared_snapshot_sendability_days'
    and minimum_integer_value=1 and default_integer_value=7 and maximum_integer_value=100)
  and exists(select 1 from core.application_setting where setting_key='suggested_waypoint_send_grace_seconds'
    and minimum_integer_value=60 and default_integer_value=300 and maximum_integer_value=3600),
  'the two existing settings keep their bounds');
select throws_ok($$select pg_temp.set_limit('explorer_ai_use_individual_daily_call_limit',2001,9101)$$,
  'P0001','solmind_application_setting_invalid_value','the writer refuses an individual stop above 2,000');
select throws_ok($$select pg_temp.set_limit('explorer_ai_use_shared_daily_calls_per_active_explorer',0,9102)$$,
  'P0001','solmind_application_setting_invalid_value','the writer refuses a shared stop below 1');
select throws_ok($$insert into core.application_setting(application_setting_id,setting_key,integer_value,minimum_integer_value,
    default_integer_value,maximum_integer_value,version,retention_class)
    values('a30f0270-0000-4000-8000-000000000001','explorer_ai_use_ordinary_daily_reply_allowance',150,1,150,1000,1,'core_business')$$,
  '23514',null,'no further key can be added without a migration');
select throws_ok($$update core.application_setting set integer_value=2001 where setting_key='explorer_ai_use_individual_daily_call_limit'$$,
  '23514',null,'the table itself keeps the individual stop within its range');
select throws_ok($$select * from public.solmind_read_application_setting_integer('explorer_ai_use_individual_daily_call_limit')$$,
  'P0001','solmind_application_setting_not_allowed','the existing reader keeps its two keys');

-- Tables, functions and grants.
select ok((select relrowsecurity from pg_class where oid='ai.explorer_ai_use_stop'::regclass)
  and (select relrowsecurity from pg_class where oid='ai.explorer_ai_use_shared_day'::regclass),'both new tables enable RLS');
select is((select count(*)::integer from pg_policies where schemaname='ai'
  and tablename in ('explorer_ai_use_stop','explorer_ai_use_shared_day')),0,'both new tables have no policies');
select ok(not exists(select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
  where has_table_privilege(r.role_name,'ai.explorer_ai_use_stop','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege(r.role_name,'ai.explorer_ai_use_shared_day','SELECT,INSERT,UPDATE,DELETE')),
  'no API role has direct access to the stop records or the shared day');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join (values('anon'),('authenticated'),('service_role')) r(role_name)
  where n.nspname='ai' and p.proname in ('solmind_explorer_ai_use_gate_v1','solmind_explorer_ai_use_day_v1',
    'solmind_explorer_ai_use_active_explorers_v1','solmind_explorer_ai_use_immutable_v1',
    'solmind_explorer_ai_use_automatic_kind_v1')
    and has_function_privilege(r.role_name,p.oid,'EXECUTE')),'internal hard-stop helpers grant no API role');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('solmind_read_explorer_ai_use_pause_v1','solmind_lift_explorer_ai_use_pause_v1',
    'solmind_report_explorer_ai_use_v1','solmind_report_explorer_ai_use_days_v1') and p.prosecdef
    and p.proconfig @> array['search_path=""'] and has_function_privilege('service_role',p.oid,'EXECUTE')
    and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE')),4,
  'pause read, lift, report and daily summary are service-role-only definer functions with an empty search path');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and ((p.proname='solmind_observe_explorer_conversation_fallback_v3' and p.pronargs=13)
    or (p.proname='solmind_prepare_explorer_conversation_turn_v3' and p.pronargs=37))
    and has_function_privilege('service_role',p.oid,'EXECUTE')
    and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE')),2,
  'the replaced observe and prepare steps keep service-only execution');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join (values('anon'),('authenticated'),('service_role')) r(role_name)
  where n.nspname='public' and p.proname='solmind_prepare_explorer_conversation_turn_v3' and p.pronargs=36
    and has_function_privilege(r.role_name,p.oid,'EXECUTE')),'the retired 36-argument prepare stays ungranted');
select is((select array_to_string(p.proargnames,',') from pg_proc p where p.oid='public.solmind_report_explorer_ai_use_v1(date)'::regprocedure),
  'p_from_day,stop_id,stop_kind,actor_user_account_id,stop_day,day_stop_number,reached_at,day_total,limit_value,'
  'account_in_crisis,lifted_at,lifted_day,lift_kind,lifted_on_pauls_word',
  'the report returns the Question 8 facts plus the stop number, crisis status and lift kind; no conversation reference');
select ok(not exists(select 1 from information_schema.columns where table_schema='ai' and table_name='explorer_ai_use_stop'
    and column_name like '%conversation%'),
  'the stop records hold no conversation reference');
select is((select array_to_string(p.proargnames,',') from pg_proc p
    where p.oid='public.solmind_report_explorer_ai_use_days_v1(date)'::regprocedure),
  'p_from_day,report_day,individual_stops,stops_in_crisis,repeat_stops,automatic_crisis_lifts,automatic_allowance_lifts,'
  'shared_stop_reached',
  'the daily summary returns counts only');
select ok((select position('pg_advisory_xact_lock' in p.prosrc)>0
    and position('pg_advisory_xact_lock' in p.prosrc)<position('ts:=clock_timestamp();' in p.prosrc)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='solmind_prepare_explorer_conversation_turn_v3' and p.pronargs=37),
  'prepare takes the shared lock before it reads the clock for the counted Send');
create function pg_temp.early_lock_ok(src text) returns boolean language sql immutable as $$
  select position('(''explorer_ai_use_automatic_lifts_per_month'',''explorer_ai_use_automatic_lifts_per_week'','
      in left(src,position('''check'')' in src)))>0
    and position('''explorer_ai_use_individual_daily_call_limit'',''explorer_ai_use_shared_daily_calls_per_active_explorer'')'
      in left(src,position('''check'')' in src)))>0
    and position('order by s.setting_key for share' in left(src,position('''check'')' in src)))>0
$$;
select ok((select pg_temp.early_lock_ok(p.prosrc)
    and position('order by s.setting_key for share' in p.prosrc)<position('pg_advisory_xact_lock' in p.prosrc)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='solmind_prepare_explorer_conversation_turn_v3' and p.pronargs=37),
  'prepare takes the four hard-stop settings, in key order, in the statement before its first check, and before the shared lock');
select ok((select pg_temp.early_lock_ok(p.prosrc)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='solmind_observe_explorer_conversation_fallback_v3' and p.pronargs=13),
  'observe takes the four hard-stop settings, in key order, in the statement before it reads the clock for its check');
select ok((select position('pg_advisory_xact_lock' in p.prosrc)>0
    and position('pg_advisory_xact_lock' in p.prosrc)<position('into c_all' in p.prosrc)
  from pg_proc p where p.oid='ai.solmind_explorer_ai_use_gate_v1(uuid,uuid,timestamptz,text)'::regprocedure),
  'the final count is taken only after the shared lock');

-- The America/Chicago day, including the 25-hour and 23-hour days.
select is((select stop_day from ai.solmind_explorer_ai_use_day_v1('2026-11-01 12:00 America/Chicago')),'2026-11-01'::date,
  'noon on the fall-back day is that day');
select is((select next_day_start-day_start from ai.solmind_explorer_ai_use_day_v1('2026-11-01 12:00 America/Chicago')),
  interval '25 hours','the fall-back day lasts 25 hours');
select is((select next_day_start-day_start from ai.solmind_explorer_ai_use_day_v1('2027-03-14 12:00 America/Chicago')),
  interval '23 hours','the spring-forward day lasts 23 hours');
select is((select next_day_start-day_start from ai.solmind_explorer_ai_use_day_v1('2026-11-02 12:00 America/Chicago')),
  interval '24 hours','an ordinary day lasts 24 hours');
select is((select stop_day from ai.solmind_explorer_ai_use_day_v1('2026-11-01 23:59:59.999999 America/Chicago')),'2026-11-01'::date,
  'the last microsecond before Chicago midnight stays on the old day');
select is((select stop_day from ai.solmind_explorer_ai_use_day_v1('2026-11-02 00:00:00 America/Chicago')),'2026-11-02'::date,
  'Chicago midnight starts the new day');
select is((select day_start from ai.solmind_explorer_ai_use_day_v1('2026-11-01 12:00 America/Chicago')),
  '2026-11-01 05:00:00+00'::timestamptz,'the fall-back day starts at midnight daylight time');
select is((select next_day_start from ai.solmind_explorer_ai_use_day_v1('2026-11-01 12:00 America/Chicago')),
  '2026-11-02 06:00:00+00'::timestamptz,'the next day starts at midnight standard time');

-- Serialization: a counted Send holds the shared lock until its transaction ends (taken here before any
-- setting change, so the other connection meets only that lock); an earlier check never takes it.
select lives_ok($$select pg_advisory_xact_lock(hashtextextended('solmind:explorer-ai-use-shared:v1',0))$$,
  'this transaction takes the shared lock as a counted Send does');
create extension if not exists dblink;
select lives_ok($$select dblink_connect('aiuse_lock',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres')$$,'second connection opens');
select lives_ok($$select dblink_exec('aiuse_lock','begin')$$,
  'everything on the second connection runs in one transaction that is always rolled back');
select lives_ok($$select dblink_exec('aiuse_lock','set local lock_timeout = ''300ms''')$$,'second connection waits at most 300 ms');
do $samedb$ begin
  if (select held from dblink('aiuse_lock',
    'select pg_try_advisory_xact_lock(hashtextextended(''solmind:explorer-ai-use-shared:v1'',0))::text') as r(held text))
    is distinct from 'false' then raise exception 'explorer_ai_use_second_connection_is_not_this_database'; end if;
end $samedb$;
select pass('the second connection reaches this database: the shared lock held here is busy there');
select lives_ok($$select * from dblink('aiuse_lock','select ai.solmind_explorer_ai_use_gate_v1(gen_random_uuid(),gen_random_uuid(),
  clock_timestamp(),''check'')::text') as r(x text)$$,'an earlier check on another connection does not wait for the shared lock');
select throws_ok($$select * from dblink('aiuse_lock','select ai.solmind_explorer_ai_use_gate_v1(gen_random_uuid(),gen_random_uuid(),
  clock_timestamp(),''final'')::text') as r(x text)$$,'55P03',null,'a final count on another connection waits for the shared lock');
select lives_ok($$select dblink_exec('aiuse_lock','rollback')$$,'the second connection rolls everything back');
select lives_ok($$select dblink_disconnect('aiuse_lock')$$,'second connection closes');

-- A change to the shared setting during a day first keeps that day's value from before the change, without
-- counting Explorers; the day's first counted Send then counts them, once (decision queue 12:00:53). Probed
-- in a block that is always rolled back, before this suite fixes today's allowance itself.
do $writer$ declare r ai.explorer_ai_use_shared_day%rowtype; begin
  if exists(select 1 from ai.explorer_ai_use_shared_day where stop_day=pg_temp.today()) then
    raise exception 'explorer_ai_use_suite_needs_no_shared_day_for_today'; end if;
  begin
    perform pg_temp.set_limit('explorer_ai_use_shared_daily_calls_per_active_explorer',1500,9120);
    select x.* into r from ai.explorer_ai_use_shared_day x where x.stop_day=pg_temp.today();
    if r.calls_per_active_explorer is distinct from 300 or r.setting_version is distinct from 1
      or r.active_explorer_count is not null or r.threshold is not null or r.counted_at is not null
      or (select integer_value from core.application_setting
        where setting_key='explorer_ai_use_shared_daily_calls_per_active_explorer') is distinct from 1500
      then raise exception 'explorer_ai_use_writer_did_not_keep_the_old_value_uncounted'; end if;
    perform pg_temp.set_limit('explorer_ai_use_shared_daily_calls_per_active_explorer',1600,9121);
    if (select calls_per_active_explorer from ai.explorer_ai_use_shared_day where stop_day=pg_temp.today()) is distinct from 300
      then raise exception 'explorer_ai_use_second_change_replaced_the_day_value'; end if;
    perform ai.solmind_explorer_ai_use_gate_v1(gen_random_uuid(),gen_random_uuid(),clock_timestamp(),'final');
    select x.* into r from ai.explorer_ai_use_shared_day x where x.stop_day=pg_temp.today();
    if r.calls_per_active_explorer is distinct from 300 or r.counted_at is null
      or r.active_explorer_count is distinct from ai.solmind_explorer_ai_use_active_explorers_v1(r.counted_at)
      or r.active_explorer_count<1 or r.threshold is distinct from r.active_explorer_count::bigint*300
      then raise exception 'explorer_ai_use_first_final_did_not_count_the_explorers'; end if;
    perform ai.solmind_explorer_ai_use_gate_v1(gen_random_uuid(),gen_random_uuid(),clock_timestamp(),'final');
    if (select counted_at from ai.explorer_ai_use_shared_day where stop_day=pg_temp.today()) is distinct from r.counted_at
      then raise exception 'explorer_ai_use_second_final_counted_again'; end if;
    begin
      update ai.explorer_ai_use_shared_day set active_explorer_count=active_explorer_count+1,
        threshold=(active_explorer_count+1)::bigint*300 where stop_day=pg_temp.today();
      raise exception 'explorer_ai_use_count_was_changed';
    exception when raise_exception then
      if sqlerrm<>'solmind_explorer_ai_use_immutable' then raise; end if;
    end;
    raise exception 'explorer_ai_use_writer_probe_rolled_back';
  exception when raise_exception then
    if sqlerrm<>'explorer_ai_use_writer_probe_rolled_back' then raise; end if;
  end;
end $writer$;
select pass('a shared-setting change keeps today''s old 300, version 1, uncounted; the first counted Send counts the active Explorers once, and the count cannot change (probe rolled back)');
select ok(not exists(select 1 from ai.explorer_ai_use_shared_day where stop_day=pg_temp.today())
  and (select integer_value=300 and version=1 from core.application_setting
    where setting_key='explorer_ai_use_shared_daily_calls_per_active_explorer'),'the probe left nothing behind');

-- Fix today's shared allowance before any Send so the shared stop is reachable in this suite: whatever
-- Sends already exist today, plus eleven.
create temp table aiuse_base as select (select count(*)::integer from ai.explorer_conversation_operation o
  cross join ai.solmind_explorer_ai_use_day_v1(clock_timestamp()) d
  where o.kind='send' and o.created_at>=d.day_start and o.created_at<d.next_day_start) as c0;
select lives_ok($$insert into ai.explorer_ai_use_shared_day(stop_day,active_explorer_count,calls_per_active_explorer,
    setting_version,threshold,counted_at) select pg_temp.today(),c0+11,1,1,c0+11,clock_timestamp() from aiuse_base$$,
  'synthetic shared allowance for today is fixed before the first counted Send');
select throws_ok($$insert into ai.explorer_ai_use_shared_day(stop_day,active_explorer_count,calls_per_active_explorer,
    setting_version,threshold) values(pg_temp.today()+30,1,1,1,1)$$,'23514',null,
  'a counted day must record when it was counted');
select is((select count(*)::integer from ai.explorer_ai_use_stop),0,'no stop records exist before any Send');

-- Individual stop, reached by lowering the setting below today's count (the stop is then recorded by the
-- next Send, which is refused before anything is stored).
select is(pg_temp.set_limit('explorer_ai_use_individual_daily_call_limit',5,9103),'applied','individual stop set to 5 for the test');
select is((select outcome from pg_temp.ensure_anchor()),'created','first conversation anchor');
-- Three probes through real Sends, each in a block that is always rolled back, before the suite's own Sends:
-- (1) a limit lowered to today's count: the read writes nothing, the next check records the first stop already
-- lifted (weekly and monthly lift), and the Send then counts against the fresh allowance;
-- (2) a crisis message at a first-stop pause unlocks it and its Send goes through prepare;
-- (3) a Send that reaches the first stop of an account already in crisis gets the crisis lift at that moment.
do $probe1$ declare v text; begin
  begin
    perform pg_temp.observe(21); perform pg_temp.prepare_private(21); perform pg_temp.settle_private(21);
    perform pg_temp.observe(22); perform pg_temp.prepare_private(22); perform pg_temp.settle_private(22);
    perform pg_temp.set_limit('explorer_ai_use_individual_daily_call_limit',2,9180);
    if (select (g->>'allowed')::boolean is not true or g->>'individual'<>'none'
        from (select ai.solmind_explorer_ai_use_gate_v1(pg_temp.gid(1),pg_temp.gid(6005),clock_timestamp(),'read') g) x)
      or pg_temp.stops('individual',1)<>0 then raise exception 'probe1_read_paused_or_wrote'; end if;
    select outcome into v from pg_temp.observe(23);
    if v is distinct from 'ok' then raise exception 'probe1_observe_%',v; end if;
    if pg_temp.stops('individual',1)<>1 or not exists(select 1 from ai.explorer_ai_use_stop where actor_user_account_id=pg_temp.gid(1)
        and stop_day=pg_temp.today() and day_stop_number=1 and lift_authority_basis='automatic_allowance'
        and lifted_at=reached_at and day_total=2 and not account_in_crisis)
      then raise exception 'probe1_stop'; end if;
    select outcome into v from pg_temp.prepare_private(23);
    if v is distinct from 'ok' then raise exception 'probe1_prepare_%',v; end if;
    if pg_temp.sends(1)<>3 or pg_temp.stops('individual',1)<>1 then raise exception 'probe1_fresh_allowance'; end if;
    raise exception 'probe1_rolled_back';
  exception when raise_exception then
    if sqlerrm<>'probe1_rolled_back' then raise; end if;
  end;
end $probe1$;
select pass('a limit lowered to today''s count: the read writes nothing, the next check records the first stop already lifted, and the Send then counts against the fresh allowance (probe rolled back)');
do $probe2$ declare v text; begin
  begin
    perform pg_temp.set_limit('explorer_ai_use_automatic_lifts_per_week',0,9181);
    perform pg_temp.set_limit('explorer_ai_use_individual_daily_call_limit',1,9182);
    perform pg_temp.observe(31); perform pg_temp.prepare_private(31); perform pg_temp.settle_private(31);
    if not exists(select 1 from ai.explorer_ai_use_stop where actor_user_account_id=pg_temp.gid(1) and stop_day=pg_temp.today()
        and day_stop_number=1 and lifted_at is null and not account_in_crisis) then raise exception 'probe2_first_stop'; end if;
    select outcome into v from pg_temp.observe(32,4);
    if v is distinct from 'ok' then raise exception 'probe2_observe_%',v; end if;
    if (select restricted_level from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)) is distinct from 4
      or pg_temp.evidence(6005,10324)<>1
      or not exists(select 1 from ai.explorer_ai_use_stop where actor_user_account_id=pg_temp.gid(1) and stop_day=pg_temp.today()
        and day_stop_number=1 and lift_authority_basis='automatic_crisis')
      then raise exception 'probe2_unlock'; end if;
    if (select not (outcome='ok' and dispatch_permitted) from pg_temp.prepare_private(32,4)) then raise exception 'probe2_prepare'; end if;
    if pg_temp.sends(1)<>2 or not exists(select 1 from ai.explorer_ai_use_stop where actor_user_account_id=pg_temp.gid(1)
        and stop_day=pg_temp.today() and day_stop_number=2 and account_in_crisis and lifted_at is null)
      then raise exception 'probe2_counted'; end if;
    raise exception 'probe2_rolled_back';
  exception when raise_exception then
    if sqlerrm<>'probe2_rolled_back' then raise; end if;
  end;
end $probe2$;
select pass('a crisis message at a first-stop pause unlocks it, its Send is prepared and counted, and the next stop that day waits for Paul (probe rolled back)');
do $probe3$ begin
  begin
    perform ai.solmind_raise_private_policy_v3(pg_temp.gid(6005),4::smallint,false);
    perform pg_temp.set_limit('explorer_ai_use_individual_daily_call_limit',1,9183);
    perform pg_temp.observe(41);
    if (select not (outcome='ok' and dispatch_permitted) from pg_temp.prepare_private(41)) then raise exception 'probe3_prepare'; end if;
    if not exists(select 1 from ai.explorer_ai_use_stop x where x.actor_user_account_id=pg_temp.gid(1) and x.stop_day=pg_temp.today()
        and x.day_stop_number=1 and x.lift_authority_basis='automatic_crisis' and x.account_in_crisis and x.lifted_at=x.reached_at
        and x.day_total=1 and x.reached_at=(select o.created_at from ai.explorer_conversation_operation o
          where o.actor_user_account_id=pg_temp.gid(1) and o.operation_id=pg_temp.gid(10410)))
      then raise exception 'probe3_stop'; end if;
    raise exception 'probe3_rolled_back';
  exception when raise_exception then
    if sqlerrm<>'probe3_rolled_back' then raise; end if;
  end;
end $probe3$;
select pass('a Send that reaches the first stop of an account already in crisis gets the crisis lift at that Send''s own moment (probe rolled back)');
do $probe4$ declare v text; begin
  begin
    perform pg_temp.set_limit('explorer_ai_use_automatic_lifts_per_week',0,9184);
    perform pg_temp.observe(61); perform pg_temp.prepare_private(61); perform pg_temp.settle_private(61);
    perform pg_temp.observe(62); perform pg_temp.prepare_private(62); perform pg_temp.settle_private(62);
    perform pg_temp.set_limit('explorer_ai_use_individual_daily_call_limit',2,9185);
    select outcome into v from pg_temp.observe(63,4);
    if v is distinct from 'ok' then raise exception 'probe4_observe_%',v; end if;
    if (select restricted_level from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)) is distinct from 4
      or pg_temp.evidence(6005,10634)<>1 or pg_temp.stops('individual',1)<>1
      or not exists(select 1 from ai.explorer_ai_use_stop where actor_user_account_id=pg_temp.gid(1) and stop_day=pg_temp.today()
        and day_stop_number=1 and lift_authority_basis='automatic_crisis' and not account_in_crisis and day_total=2)
      then raise exception 'probe4_unlock'; end if;
    raise exception 'probe4_rolled_back';
  exception when raise_exception then
    if sqlerrm<>'probe4_rolled_back' then raise; end if;
  end;
end $probe4$;
select pass('a crisis message in the same check that records the account''s first stop (weekly lifts used up) unlocks it at once (probe rolled back)');
-- A real prepare that waits for a hard-stop setting beyond its 2000 ms lock timeout fails cleanly: nothing is saved
-- or counted, and the same Send can be prepared once the lock is released. (Prepare stores the observation itself;
-- no observe runs here, because an observe in this transaction would hold the setting rows until it ends.)
select lives_ok($$select dblink_connect('aiuse_hold',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres')$$,'another connection opens');
select lives_ok($$select dblink_exec('aiuse_hold','begin')$$,'its transaction is always rolled back');
select is((select x from dblink('aiuse_hold','select setting_key from core.application_setting
    where setting_key=''explorer_ai_use_automatic_lifts_per_week'' for update') as r(x text)),'explorer_ai_use_automatic_lifts_per_week',
  'the other connection holds a hard-stop setting row, as a setting change does');
select throws_ok($$select * from pg_temp.prepare_private(51)$$,'55P03',null,
  'prepare waits for that setting at most its lock timeout, then fails');
select ok(pg_temp.sends(1)=0 and pg_temp.stops('individual',1)=0
    and not exists(select 1 from ai.ai_interaction_message where ai_interaction_message_id=pg_temp.gid(10511)),
  'the failed prepare saved and counted nothing');
select lives_ok($$select dblink_exec('aiuse_hold','rollback')$$,'the other connection releases the setting');
select lives_ok($$select dblink_disconnect('aiuse_hold')$$,'and closes');
do $retry$ declare v text; begin
  begin
    select outcome into v from pg_temp.prepare_private(51);
    if v is distinct from 'ok' or pg_temp.sends(1)<>1 then raise exception 'retry_%',v; end if;
    raise exception 'retry_rolled_back';
  exception when raise_exception then
    if sqlerrm<>'retry_rolled_back' then raise; end if;
  end;
end $retry$;
select pass('once released, the same Send is prepared and counted once (probe rolled back)');
select ok(pg_temp.sends(1)=0 and pg_temp.stops('individual',1)=0
    and (select restricted_level is null from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005))
    and (select integer_value=5 from core.application_setting where setting_key='explorer_ai_use_individual_daily_call_limit')
    and (select integer_value=1 from core.application_setting where setting_key='explorer_ai_use_automatic_lifts_per_week'),
  'the probes left nothing behind');
-- An automatic lift for an account not in crisis, through real Sends (decision queue 13:20:16, 13:22:56): with the
-- stop at 2, the second Send reaches the first stop, which is recorded already lifted at that Send's moment. Only
-- Sends made after it count toward the next stop, so the fourth Send reaches the second stop, which waits for Paul.
select is(pg_temp.set_limit('explorer_ai_use_individual_daily_call_limit',2,9150),'applied','individual stop set to 2');
select is((select outcome from pg_temp.observe(13)),'ok','observation allowed');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(13)),'a Send is counted');
select ok((select outcome='ok' and saved_reply from pg_temp.settle_private(13)),'it settles');
select is((select outcome from pg_temp.observe(14)),'ok','observation allowed');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(14)),
  'the Send that reaches the first stop is allowed');
select ok((select outcome='ok' and saved_reply from pg_temp.settle_private(14)),'it settles');
select ok((select day_stop_number=1 and lift_authority_basis='automatic_allowance' and lifted_at=reached_at and day_total=2
    and not account_in_crisis and reached_at=(select o.created_at from ai.explorer_conversation_operation o
      where o.actor_user_account_id=pg_temp.gid(1) and o.operation_id=pg_temp.gid(10140))
  from ai.explorer_ai_use_stop where actor_user_account_id=pg_temp.gid(1) and stop_day=pg_temp.today()),
  'the first stop is recorded already lifted, at the moment of the Send that reached it');
select ok((select outcome='ok' and notice_kind is null from pg_temp.pause()),'so the account sees no pause');
select is((select outcome from pg_temp.observe(15)),'ok','observation allowed after the automatic lift');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(15)),
  'the first Send of the fresh allowance is counted');
select ok((select outcome='ok' and saved_reply from pg_temp.settle_private(15)),'it settles');
select is(pg_temp.stops('individual',1),1,'the Send that reached the first stop is not counted again, so no second stop yet');
select is((select outcome from pg_temp.observe(16)),'ok','observation allowed');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(16)),
  'the Send that reaches the second stop is allowed');
select ok((select outcome='ok' and saved_reply from pg_temp.settle_private(16)),'it settles');
select ok((select day_total=4 and lifted_at is null and not account_in_crisis from ai.explorer_ai_use_stop
  where actor_user_account_id=pg_temp.gid(1) and stop_day=pg_temp.today() and day_stop_number=2),
  'the second stop that day is reached at the fourth Send and waits for Paul');
select ok((select outcome='ok' and notice_kind='individual' and not crisis from pg_temp.pause()),'the account is paused');
select is((select outcome from public.solmind_lift_explorer_ai_use_pause_v1((select stop_id from ai.explorer_ai_use_stop
    where actor_user_account_id=pg_temp.gid(1) and stop_day=pg_temp.today() and day_stop_number=2),
    pg_temp.gid(9170),pg_temp.gid(9171))),'lifted','Paul lifts the second stop');
select is(pg_temp.set_limit('explorer_ai_use_individual_daily_call_limit',5,9151),'applied','individual stop back to 5');
-- The automatic lifts of accounts not in crisis are turned off until their own cases below, so the later stops
-- in between wait for Paul.
select is(pg_temp.set_limit('explorer_ai_use_automatic_lifts_per_week',0,9130),'applied','automatic lifts per week set to 0');
select is(pg_temp.set_limit('explorer_ai_use_automatic_lifts_per_month',0,9131),'applied','automatic lifts per month set to 0');
select is((select outcome from pg_temp.observe(1)),'ok','first observation is allowed');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(1)),'first Send is prepared and counted');
select ok((select outcome='ok' and saved_reply from pg_temp.settle_private(1)),'first Send settles');
select is((select outcome from pg_temp.observe(2)),'ok','second observation is allowed');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(2)),'second Send is prepared and counted');
select ok((select outcome='ok' and saved_reply from pg_temp.settle_private(2)),'second Send settles');
select is(pg_temp.sends(1),6,'six Sends are counted today');
select ok((select outcome='ok' and notice_kind is null and not adults_only from pg_temp.pause()),'no pause below the stop');
select ok((select o.created_at=m.created_at from ai.explorer_conversation_operation o join ai.ai_interaction_message m
  on m.ai_interaction_message_id=o.message_id where o.operation_id=pg_temp.gid(10020)),
  'the counted Send carries the same time as its saved message');
-- Lifting a stop from an earlier day never restarts today's count (decision 00:57:31).
select lives_ok($$insert into ai.explorer_ai_use_stop(stop_kind,actor_user_account_id,stop_day,day_stop_number,reached_at,
    day_total,limit_value,account_in_crisis)
    values('individual',pg_temp.gid(1),pg_temp.today()-1,1,clock_timestamp()-interval '1 day',2,2,false)$$,
  'synthetic stop from yesterday for the first Explorer');
select is((select outcome from public.solmind_lift_explorer_ai_use_pause_v1((select stop_id from ai.explorer_ai_use_stop
    where actor_user_account_id=pg_temp.gid(1) and stop_day=pg_temp.today()-1),pg_temp.gid(9013),pg_temp.gid(9014))),
  'lifted','Paul lifts yesterday''s stop today');
select is(pg_temp.set_limit('explorer_ai_use_individual_daily_call_limit',2,9104),'applied','individual stop lowered to 2');
select ok((select g->>'individual'='review' from (select ai.solmind_explorer_ai_use_gate_v1(pg_temp.gid(1),pg_temp.gid(6005),
  clock_timestamp(),'read') g) x),'the two Sends since the lifted second stop still count after yesterday''s stop was lifted, so the lowered stop is reached');
select ok((select outcome='ok' and notice_kind='individual' from pg_temp.pause()),
  'the pause read already shows the individual pause notice');
select is(pg_temp.stops('individual',1),2,'the pause read itself records nothing');
select is((select outcome from pg_temp.observe(3,1)),'paused','a message without crisis signs typed while paused is refused at observe');
select is(pg_temp.evidence(6005,10034),0,'the refused message leaves no safety record');
select ok((select restricted_level is null from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),
  'the conversation stays out of crisis handling');
select is(pg_temp.stops('individual',1),3,'reaching the lowered stop is recorded once');
select ok((select stop_day=pg_temp.today() and day_stop_number=3 and day_total=6 and limit_value=2 and not account_in_crisis
    and lifted_at is null and lift_authority_basis is null and retention_class='security_log'
  from ai.explorer_ai_use_stop where stop_kind='individual' and actor_user_account_id=pg_temp.gid(1) and stop_day=pg_temp.today()
    and lifted_at is null),
  'the stop record holds the day, its number that day, total, limit and the account''s crisis status');
select ok((select not (g->>'automatic_if_crisis')::boolean and not (g->>'crisis')::boolean
  from (select ai.solmind_explorer_ai_use_gate_v1(pg_temp.gid(1),pg_temp.gid(6005),clock_timestamp(),'read') g) x),
  'a third stop of the day is not one an automatic lift would cover');
select ok((select outcome='paused' and not dispatch_permitted from pg_temp.prepare_private(3)),
  'a direct prepare is refused too');
select ok(not exists(select 1 from ai.ai_interaction_message where ai_interaction_message_id=pg_temp.gid(10031)),
  'the refused message is not saved');
select is(pg_temp.sends(1),6,'the refused Send is not counted');
select is(pg_temp.stops('individual',1),3,'a repeated refusal records no further stop');
select ok((select outcome='exact_replay' and not dispatch_permitted from pg_temp.prepare_private(2)),
  'an exact replay of an earlier Send is answered, never counted or refused');

-- The report shows the Question 8 facts and the crisis status; the lift is the Executor's step on Paul's word.
select ok((select stop_kind='individual' and actor_user_account_id=pg_temp.gid(1) and day_total=6 and limit_value=2
    and stop_day=pg_temp.today() and day_stop_number=3 and not account_in_crisis and lifted_at is null and lifted_day is null
    and lift_kind is null and not lifted_on_pauls_word
  from public.solmind_report_explorer_ai_use_v1(pg_temp.today()) where stop_kind='individual' and lifted_day is null),
  'the report lists the stop as waiting for Paul''s lift, reached outside crisis handling');
create temp table aiuse_first as select stop_id from ai.explorer_ai_use_stop where stop_kind='individual'
  and actor_user_account_id=pg_temp.gid(1) and stop_day=pg_temp.today() and lifted_at is null;
select throws_ok($$select * from public.solmind_lift_explorer_ai_use_pause_v1(null,pg_temp.gid(9001),pg_temp.gid(9002))$$,
  'P0001','solmind_explorer_ai_use_invalid_input','a lift needs its stop, reference and operation');
select is((select outcome from public.solmind_lift_explorer_ai_use_pause_v1((select stop_id from aiuse_first),pg_temp.gid(9001),pg_temp.gid(9002))),
  'lifted','Paul''s lift is applied');
select is((select outcome from public.solmind_lift_explorer_ai_use_pause_v1((select stop_id from aiuse_first),pg_temp.gid(9001),pg_temp.gid(9002))),
  'already_lifted','the exact same lift is recognised as a repeat');
select throws_ok($$select * from public.solmind_lift_explorer_ai_use_pause_v1((select stop_id from aiuse_first),pg_temp.gid(9001),pg_temp.gid(9003))$$,
  'P0001','solmind_explorer_ai_use_operation_conflict','a different lift of the same stop is refused');
select ok((select actor_user_account_id is null and actor_role_context='system' and target_entity_type='explorer_ai_use_stop'
    and target_entity_id=(select stop_id from aiuse_first) and action='lift' and reason_code='paul_approved_pause_lift'
    and metadata=jsonb_build_object('authority_basis','paul_approved','authority_reference_id',pg_temp.gid(9001)::text,
      'operation_id',pg_temp.gid(9002)::text)
  from audit.audit_event where event_type='explorer_ai_use_pause_lifted' and target_entity_id=(select stop_id from aiuse_first)),
  'the lift writes one content-free system audit row');
select is((select count(*)::integer from audit.audit_event where event_type='explorer_ai_use_pause_lifted'
  and target_entity_id=(select stop_id from aiuse_first)),1,
  'the repeated lift writes no second audit row');
select ok((select lift_authority_basis='paul_approved' and lift_authority_reference_id=pg_temp.gid(9001)
    and lift_operation_id=pg_temp.gid(9002) and lifted_at>=reached_at
  from ai.explorer_ai_use_stop where stop_id=(select stop_id from aiuse_first)),'the stop keeps its lift facts');
select ok((select lift_kind='paul' and lifted_on_pauls_word from public.solmind_report_explorer_ai_use_v1(pg_temp.today())
  where stop_id=(select stop_id from aiuse_first)),'the report shows the lift was on Paul''s word');
select ok((select outcome='ok' and notice_kind is null from pg_temp.pause()),'after the lift the pause is gone');

-- A same-day lift gives a fresh allowance: two more Sends, and the second one reaches the stop again.
select is((select outcome from pg_temp.observe(4)),'ok','fourth observation is allowed after the lift');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(4)),'first Send after the lift is counted');
select ok((select outcome='ok' and saved_reply from pg_temp.settle_private(4)),'it settles');
select is((select outcome from pg_temp.observe(5)),'ok','fifth observation is allowed');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(5)),
  'the Send that reaches the stop is itself allowed');
select is(pg_temp.stops('individual',1),4,'reaching the fresh allowance records a new stop');
select ok((select day_total=8 and limit_value=2 and day_stop_number=4 and lifted_at is null from ai.explorer_ai_use_stop
  where stop_kind='individual' and actor_user_account_id=pg_temp.gid(1) and stop_day=pg_temp.today()
    and day_stop_number=4),
  'the new stop is the fourth of the day and records the day''s running total of 8');
select ok((select outcome='ok' and saved_reply from pg_temp.settle_private(5)),'the Send that reached the stop still settles');
select ok((select outcome='ok' and notice_kind='individual' and not crisis from pg_temp.pause()),
  'the pause shows again after its reply');
select ok((select not (g->>'automatic_if_crisis')::boolean
  from (select ai.solmind_explorer_ai_use_gate_v1(pg_temp.gid(1),pg_temp.gid(6005),clock_timestamp(),'read') g) x),
  'a later stop that day is never one an automatic lift would cover');
select is((select outcome from pg_temp.observe(6,4)),'paused',
  'a message with crisis signs at a later stop that day is refused (likely misuse waits for Paul)');
select is(pg_temp.evidence(6005,10064),0,'that refused message leaves no safety record');
select ok((select restricted_level is null from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),
  'and does not move the conversation into crisis handling');
select throws_ok($$select * from pg_temp.observe(11,7)$$,'P0001','solmind_explorer_private_invalid_input',
  'a malformed request at a stop is still refused as malformed, not as paused');
select ok((select lifted_at is not null from ai.explorer_ai_use_stop where stop_id=(select stop_id from aiuse_first)),
  'the first stop keeps its lift');
select throws_ok($$update ai.explorer_ai_use_stop set day_total=99 where stop_id=(select stop_id from aiuse_first)$$,
  'P0001','solmind_explorer_ai_use_immutable','a stop record cannot be changed');
select throws_ok($$delete from ai.explorer_ai_use_stop where stop_id=(select stop_id from aiuse_first)$$,
  'P0001','solmind_explorer_ai_use_immutable','a stop record cannot be deleted');
select throws_ok($$update ai.explorer_ai_use_shared_day set threshold=threshold+1$$,
  'P0001','solmind_explorer_ai_use_immutable','the shared day cannot be changed');

-- Other days, through the gate directly. The open ordinary pause still waits tomorrow. The gate itself
-- creates a day's shared allowance: the per-Explorer setting in force at that day's start, times the
-- active Explorers.
select ok((select g->>'individual'='review' and not (g->>'allowed')::boolean
  from (select ai.solmind_explorer_ai_use_gate_v1(pg_temp.gid(1),pg_temp.gid(6005),pg_temp.noon(pg_temp.today()+1),'read') g) x),
  'tomorrow the open ordinary pause still waits for Paul');
select is(pg_temp.set_limit('explorer_ai_use_shared_daily_calls_per_active_explorer',1000,9106),'applied',
  'the shared setting is changed today to 1,000 per active Explorer');
select lives_ok($$select ai.solmind_explorer_ai_use_gate_v1(pg_temp.gid(1),pg_temp.gid(6005),pg_temp.noon(pg_temp.today()+1),'final')$$,
  'a final check tomorrow creates tomorrow''s shared allowance');
select ok((select calls_per_active_explorer=1000 and setting_version=2 and counted_at=pg_temp.noon(pg_temp.today()+1)
    and active_explorer_count=ai.solmind_explorer_ai_use_active_explorers_v1(pg_temp.noon(pg_temp.today()+1))
    and threshold=active_explorer_count::bigint*1000
  from ai.explorer_ai_use_shared_day where stop_day=pg_temp.today()+1),
  'tomorrow uses the setting changed today, with its version, times the active Explorers counted at that first Send');
select ok((select calls_per_active_explorer=1 from ai.explorer_ai_use_shared_day where stop_day=pg_temp.today()),
  'today''s allowance, fixed before the change, is unchanged by it');
select is((select count(*)::integer from ai.explorer_ai_use_stop where stop_day=pg_temp.today()+1),0,
  'tomorrow''s check records no stop');

-- Crisis accounts (decision queue 12:27:07 and question 3 part 1), with the other synthetic Explorer.
-- An ordinary first-stop pause from yesterday waits for Paul until crisis signs appear.
select is((select outcome from pg_temp.ensure_anchor(6006,4,54)),'created','the other Explorer has a conversation');
select lives_ok($$insert into ai.explorer_ai_use_stop(stop_kind,actor_user_account_id,stop_day,day_stop_number,reached_at,
    day_total,limit_value,account_in_crisis)
    values('individual',pg_temp.gid(4),pg_temp.today()-1,1,clock_timestamp()-interval '1 day',2,2,false)$$,
  'synthetic first stop from yesterday, reached outside crisis handling');
create temp table aiuse_yesterday as select stop_id from ai.explorer_ai_use_stop where actor_user_account_id=pg_temp.gid(4);
select ok((select outcome='ok' and notice_kind='individual' and not crisis from pg_temp.pause(4,54)),
  'an ordinary pause from yesterday still waits for Paul');
select ok((select (g->>'automatic_if_crisis')::boolean from (select ai.solmind_explorer_ai_use_gate_v1(pg_temp.gid(4),
  pg_temp.gid(6006),clock_timestamp(),'read') g) x),'it is a first stop, which a crisis account would have lifted');
select is((select outcome from pg_temp.observe4(1,2)),'paused','a message without crisis signs is refused');
select is(pg_temp.evidence(6006,20014),0,'and leaves no safety record');
select is((select outcome from pg_temp.observe4(2,4)),'ok',
  'a message with crisis signs at an ordinary first-stop pause is let through');
select is(pg_temp.evidence(6006,20024),1,'its safety observation is saved');
select is((select restricted_level from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6006)),4::smallint,
  'the conversation moves into crisis handling');
select ok((select lifted_at is not null and lift_authority_basis='automatic_crisis' and lift_authority_reference_id is null
    and lift_operation_id is null and not account_in_crisis
  from ai.explorer_ai_use_stop where stop_id=(select stop_id from aiuse_yesterday)),
  'the pause is lifted automatically, and the record keeps the status at the time it was reached');
select ok((select outcome='ok' and notice_kind is null from pg_temp.pause(4,54)),'the pause is gone');
select ok((select lift_kind='automatic_crisis' and not lifted_on_pauls_word and not account_in_crisis
    and lifted_at=(select lifted_at from ai.explorer_ai_use_stop where stop_id=(select stop_id from aiuse_yesterday))
    and lifted_day=pg_temp.today()
  from public.solmind_report_explorer_ai_use_v1(null) where stop_id=(select stop_id from aiuse_yesterday)),
  'the report shows the automatic crisis lift with when it was made');
select is((select outcome from public.solmind_lift_explorer_ai_use_pause_v1((select stop_id from aiuse_yesterday),
    pg_temp.gid(9005),pg_temp.gid(9006))),'lifted_automatically','Paul''s lift of a stop already lifted automatically changes nothing');
select ok((select (g->>'crisis')::boolean from (select ai.solmind_explorer_ai_use_gate_v1(pg_temp.gid(4),null,
  clock_timestamp(),'read') g) x),'crisis status belongs to the account, not to one conversation');
-- Today, with the stop at 1 Send: the crisis account's first stop is recorded already lifted, so it never
-- pauses there; its second stop that day waits for Paul, across midnight.
select is(pg_temp.set_limit('explorer_ai_use_individual_daily_call_limit',1,9108),'applied','individual stop set to 1');
select ok((select (g->>'allowed')::boolean from (select ai.solmind_explorer_ai_use_gate_v1(pg_temp.gid(4),pg_temp.gid(6006),
  clock_timestamp(),'final') g) x),'the final check that reaches the crisis account''s first stop today allows it');
select ok((select day_stop_number=1 and account_in_crisis and lift_authority_basis='automatic_crisis' and lifted_at=reached_at
  from ai.explorer_ai_use_stop where actor_user_account_id=pg_temp.gid(4) and stop_day=pg_temp.today()),
  'it is recorded as the first stop, reached in crisis handling and lifted automatically at once');
select ok((select outcome='ok' and notice_kind is null from pg_temp.pause(4,54)),'so the crisis account sees no pause');
select ok((select lifted_at=reached_at and lifted_day=pg_temp.today() and lift_kind='automatic_crisis'
  from public.solmind_report_explorer_ai_use_v1(pg_temp.today())
  where actor_user_account_id=pg_temp.gid(4) and stop_day=pg_temp.today() and day_stop_number=1),
  'the report shows a crisis lift made at the stop with the stop''s own time');
select throws_ok($$insert into ai.explorer_ai_use_stop(stop_kind,actor_user_account_id,stop_day,day_stop_number,reached_at,
    day_total,limit_value,account_in_crisis,lifted_at,lift_authority_basis)
    values('individual',pg_temp.gid(4),pg_temp.today(),2,clock_timestamp(),9,1,true,clock_timestamp(),'automatic_crisis')$$,
  '23514',null,'only a first stop of the day can be lifted automatically');
select ok((select (g->>'allowed')::boolean from (select ai.solmind_explorer_ai_use_gate_v1(pg_temp.gid(4),pg_temp.gid(6006),
  clock_timestamp(),'final') g) x),'the final check that reaches the second stop today allows it');
select ok((select day_stop_number=2 and account_in_crisis and lifted_at is null from ai.explorer_ai_use_stop
  where actor_user_account_id=pg_temp.gid(4) and stop_day=pg_temp.today() and day_stop_number=2),
  'the second stop is recorded, unlifted');
select ok((select outcome='ok' and notice_kind='individual' and crisis and not adults_only from pg_temp.pause(4,54)),
  'the crisis account now sees the crisis pause notice for a pause that waits for Paul');
select ok((select g->>'individual'='review' and not (g->>'automatic_if_crisis')::boolean
  from (select ai.solmind_explorer_ai_use_gate_v1(pg_temp.gid(4),pg_temp.gid(6006),clock_timestamp(),'read') g) x),
  'no automatic lift covers it');
select ok((select g->>'individual'='review' from (select ai.solmind_explorer_ai_use_gate_v1(pg_temp.gid(4),pg_temp.gid(6006),
  pg_temp.noon(pg_temp.today()+1),'read') g) x),'it still waits for Paul tomorrow');
select is((select outcome from pg_temp.observe4(3,4)),'paused','a crisis message does not unlock a second stop');
select is(pg_temp.evidence(6006,20034),0,'and leaves no new safety record');
select lives_ok($$select ai.solmind_raise_private_policy_v3(pg_temp.gid(6006),0::smallint,true)$$,
  'the other conversation also gets the adults-only stop');
select ok((select notice_kind='individual' and crisis and adults_only from pg_temp.pause(4,54)),
  'the notice then adds the adults-only line');
select is((select outcome from public.solmind_lift_explorer_ai_use_pause_v1((select stop_id from ai.explorer_ai_use_stop
    where actor_user_account_id=pg_temp.gid(4) and stop_day=pg_temp.today() and day_stop_number=2),
    pg_temp.gid(9015),pg_temp.gid(9016))),'lifted','Paul lifts the second stop');
select ok((select outcome='ok' and notice_kind is null from pg_temp.pause(4,54)),'the crisis account is no longer paused');
select ok((select individual_stops=6 and stops_in_crisis=2 and repeat_stops=4 and automatic_crisis_lifts=2
    and automatic_allowance_lifts=1 and not shared_stop_reached
  from public.solmind_report_explorer_ai_use_days_v1(pg_temp.today()) where report_day=pg_temp.today()),
  'the daily summary counts today''s six stops, the two reached in crisis handling, the four repeat stops, the two crisis lifts and the one weekly and monthly lift');
select ok(exists(select 1 from public.solmind_report_explorer_ai_use_v1(pg_temp.today())
    where stop_id=(select stop_id from aiuse_yesterday)),
  'the report from today also lists a stop from yesterday that was lifted today');
select ok((select individual_stops=2 and automatic_crisis_lifts=0
  from public.solmind_report_explorer_ai_use_days_v1(null) where report_day=pg_temp.today()-1),
  'yesterday''s two stops are counted on their own day, and their automatic lift on the day it was made');
select throws_ok($$select * from pg_temp.pause(1,54)$$,'P0001','solmind_explorer_conversation_denied',
  'the pause read refuses another Explorer''s session');
select throws_ok($$select * from pg_temp.pause(4,50)$$,'P0001','solmind_explorer_conversation_denied',
  'and the other way round');

-- Shared stop: today's allowance is the base plus eleven Sends.
select is((select outcome from public.solmind_lift_explorer_ai_use_pause_v1(
    (select stop_id from ai.explorer_ai_use_stop where stop_kind='individual' and actor_user_account_id=pg_temp.gid(1) and lifted_at is null),
    pg_temp.gid(9007),pg_temp.gid(9008))),'lifted','Paul lifts the fourth stop');
-- Automatic lifts for an account not in crisis (decision queue 13:20:16, 13:22:56): only a first stop of a
-- day, within 1 a week and 2 a month (rolling Chicago days); Paul's lifts do not count. Exercised through the
-- final gate on earlier days, each with a synthetic shared allowance, while the stop is set to 1 Send.
select is(pg_temp.set_limit('explorer_ai_use_automatic_lifts_per_week',1,9132),'applied','automatic lifts per week back to 1');
select is(pg_temp.set_limit('explorer_ai_use_automatic_lifts_per_month',2,9133),'applied','automatic lifts per month back to 2');
select lives_ok($$insert into ai.explorer_ai_use_shared_day(stop_day,active_explorer_count,calls_per_active_explorer,
    setting_version,threshold,counted_at)
    select pg_temp.today()-k,1,1000,1,1000,clock_timestamp() from unnest(array[60,54,53,31,30,15]) k$$,
  'synthetic shared allowances for six earlier days');
create function pg_temp.final1(days_ago integer,minutes integer default 0) returns jsonb language sql as $$
  select ai.solmind_explorer_ai_use_gate_v1(pg_temp.gid(1),pg_temp.gid(6005),
    pg_temp.noon(pg_temp.today()-days_ago)+make_interval(mins=>minutes),'final')
$$;
create function pg_temp.stop1(days_ago integer,number_n integer default 1) returns ai.explorer_ai_use_stop language sql as $$
  select x.* from ai.explorer_ai_use_stop x where x.actor_user_account_id=pg_temp.gid(1)
    and x.stop_day=pg_temp.today()-days_ago and x.day_stop_number=number_n
$$;
create function pg_temp.lift1(days_ago integer,op_n integer,number_n integer default 1) returns text language sql as $$
  select outcome from public.solmind_lift_explorer_ai_use_pause_v1((select stop_id from pg_temp.stop1(days_ago,number_n)),
    pg_temp.gid(op_n),pg_temp.gid(op_n+1))
$$;
select ok((pg_temp.final1(60)->>'allowed')::boolean,'day A: the final check that reaches the first stop allows it');
select ok((select lift_authority_basis='automatic_allowance' and lifted_at=reached_at and not account_in_crisis
    and lift_authority_reference_id is null and lift_operation_id is null from pg_temp.stop1(60)),
  'day A: the first stop of an account not in crisis is lifted automatically at once');
select ok((select (g->>'allowed')::boolean from (select ai.solmind_explorer_ai_use_gate_v1(pg_temp.gid(1),pg_temp.gid(6005),
  pg_temp.noon(pg_temp.today()-60)+interval '1 minute','read') g) x),'day A: so the account sees no pause');
select ok((select lift_kind='automatic_allowance' and not lifted_on_pauls_word and not account_in_crisis
  from public.solmind_report_explorer_ai_use_v1(null) where stop_id=(select stop_id from pg_temp.stop1(60))),
  'the report shows the automatic lift of an account not in crisis');
select ok((select automatic_allowance_lifts=1 and automatic_crisis_lifts=0
  from public.solmind_report_explorer_ai_use_days_v1(null) where report_day=pg_temp.today()-60),
  'the daily summary counts it separately from crisis lifts');
select ok((pg_temp.final1(54)->>'allowed')::boolean,'day B, six days after A: the final check that reaches the first stop allows it');
select ok((select lifted_at is null from pg_temp.stop1(54)),'day B: A is within the last 7 days, so the stop waits for Paul');
select is(pg_temp.lift1(54,9160),'lifted','Paul lifts day B''s stop');
select ok((pg_temp.final1(53)->>'allowed')::boolean,'day C, seven days after A');
select ok((select lift_authority_basis='automatic_allowance' from pg_temp.stop1(53)),
  'day C: A is no longer within the last 7 days, and this is the second lift in 30 days, so it is automatic');
select ok((pg_temp.final1(31)->>'allowed')::boolean,'day D, 29 days after A');
select ok((select lifted_at is null from pg_temp.stop1(31)),'day D: A and C are within the last 30 days, so the stop waits for Paul');
select is(pg_temp.lift1(31,9162),'lifted','Paul lifts day D''s stop');
select ok((pg_temp.final1(30)->>'allowed')::boolean,'day E, 30 days after A');
select ok((select lift_authority_basis='automatic_allowance' from pg_temp.stop1(30)),
  'day E: A is no longer within the last 30 days, and Paul''s lift of D does not count, so only C counts');
select ok((pg_temp.final1(30,1)->>'allowed')::boolean,'day E: the final check that reaches a second stop that day allows it');
select ok((select lifted_at is null from pg_temp.stop1(30,2)),'day E: the second stop that day waits for Paul');
select ok((select g->>'individual'='review' and not (g->>'automatic_if_crisis')::boolean
  from (select ai.solmind_explorer_ai_use_gate_v1(pg_temp.gid(1),pg_temp.gid(6005),
    pg_temp.noon(pg_temp.today()-30)+interval '2 minutes','read') g) x),'and no automatic lift covers it');
select is(pg_temp.lift1(30,9166,2),'lifted','Paul lifts day E''s second stop');
select is(pg_temp.set_limit('explorer_ai_use_automatic_lifts_per_week',0,9134),'applied','automatic lifts per week set to 0');
select ok((pg_temp.final1(15)->>'allowed')::boolean,'day F');
select ok((select lifted_at is null from pg_temp.stop1(15)),'day F: a setting of 0 turns the automatic lifts off');
select is(pg_temp.lift1(15,9164),'lifted','Paul lifts day F''s stop');
select is((select outcome from public.solmind_lift_explorer_ai_use_pause_v1((select stop_id from pg_temp.stop1(60)),
    pg_temp.gid(9168),pg_temp.gid(9169))),'lifted_automatically','Paul''s lift of a stop already lifted automatically changes nothing');
select is(pg_temp.set_limit('explorer_ai_use_automatic_lifts_per_week',1,9135),'applied','automatic lifts per week back to 1');
select is(pg_temp.set_limit('explorer_ai_use_individual_daily_call_limit',2000,9105),'applied','individual stop raised to 2,000');
select is((select outcome from pg_temp.observe(7)),'ok','observation allowed');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(7)),'a counted Send');
select ok((select outcome='ok' and saved_reply from pg_temp.settle_private(7)),'it settles');
select is((select outcome from pg_temp.observe(8)),'ok','observation allowed');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(8)),'another counted Send');
select ok((select outcome='ok' and saved_reply from pg_temp.settle_private(8)),'it settles');
select is(pg_temp.stops('shared'),0,'no shared stop below the allowance');
select is((select outcome from pg_temp.observe(9)),'ok','observation allowed');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(9)),'the Send that reaches the shared stop is allowed');
select ok((select outcome='ok' and saved_reply from pg_temp.settle_private(9)),'it settles');
select is(pg_temp.stops('shared'),1,'the shared stop is recorded once');
select ok((select stop_day=pg_temp.today() and day_total=(select c0+11 from aiuse_base) and limit_value=(select c0+11 from aiuse_base)
    and actor_user_account_id is null and day_stop_number is null and account_in_crisis is null
  from ai.explorer_ai_use_stop where stop_kind='shared' and stop_day=pg_temp.today()),
  'the shared stop records the total and the threshold, no account');
select ok((select outcome='ok' and notice_kind='shared' and not crisis from pg_temp.pause()),
  'the Explorer sees the shared pause notice');
select ok((select outcome='ok' and notice_kind='shared' and crisis from pg_temp.pause(4,54)),
  'the crisis account, paused only by the shared stop, sees the crisis pause notice with the shared restart time');
select is((select outcome from pg_temp.observe(10)),'paused','the next Send is refused for the first Explorer');
select is((select outcome from pg_temp.observe4(4)),'paused','and for the other Explorer');
select is(pg_temp.stops('shared'),1,'no second shared stop is recorded');
select ok((select stop_day=pg_temp.today() and lifted_at is null and not lifted_on_pauls_word
  from public.solmind_report_explorer_ai_use_v1(pg_temp.today()) where stop_kind='shared'),'the report lists today''s shared stop');
select ok((select not (g->>'shared')::boolean and (g->>'allowed')::boolean
  from (select ai.solmind_explorer_ai_use_gate_v1(pg_temp.gid(1),pg_temp.gid(6005),pg_temp.noon(pg_temp.today()+1),'read') g) x),
  'the shared pause ends at the next midnight, and tomorrow''s count starts again');
select throws_ok($$select * from public.solmind_lift_explorer_ai_use_pause_v1(
    (select stop_id from ai.explorer_ai_use_stop where stop_kind='shared' and stop_day=pg_temp.today()),pg_temp.gid(9009),pg_temp.gid(9010))$$,
  'P0001','solmind_explorer_ai_use_not_found','the shared pause is not lifted by hand');
select lives_ok($$insert into ai.explorer_ai_use_stop(stop_kind,actor_user_account_id,stop_day,day_stop_number,reached_at,
    day_total,limit_value,account_in_crisis)
    values('individual',pg_temp.gid(1),pg_temp.today()-2,1,clock_timestamp()-interval '2 days',2,2,false)$$,
  'synthetic first stop from two days ago, still waiting for Paul, while the shared stop is in place');
create temp table aiuse_two_days as select stop_id from ai.explorer_ai_use_stop
  where actor_user_account_id=pg_temp.gid(1) and stop_day=pg_temp.today()-2;
select is((select outcome from pg_temp.observe(12,4)),'paused',
  'a message with crisis signs at a first-stop pause is refused while the shared stop is in place');
select is(pg_temp.evidence(6005,10124),0,'and leaves no safety record');
select ok((select restricted_level is null from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),
  'nor moves the conversation into crisis handling');
select ok((select lifted_at is null from ai.explorer_ai_use_stop where stop_id=(select stop_id from aiuse_two_days)),
  'and the first stop still waits for Paul');
select ok(exists(select 1 from public.solmind_report_explorer_ai_use_v1(pg_temp.today())
    where stop_id=(select stop_id from aiuse_two_days) and lifted_at is null and lifted_day is null),
  'the report from today lists that earlier-day stop as still open');
select ok((select notice_kind='individual_and_shared' and not crisis from pg_temp.pause()),
  'with both pauses in place, the pause read reports both');
select lives_ok($$select ai.solmind_raise_private_policy_v3(pg_temp.gid(6005),3::smallint,false)$$,
  'the first conversation moves into urgent handling');
select ok((select notice_kind='shared' and crisis from pg_temp.pause()),
  'now a crisis account, its first-stop pause is due an automatic lift, so only the shared pause shows, as a crisis pause notice');
select ok((select lifted_at is null from ai.explorer_ai_use_stop where stop_id=(select stop_id from aiuse_two_days)),
  'the pause read itself lifts nothing');
select is((select outcome from pg_temp.observe(18)),'paused','the next Send is still refused under the shared stop');
select ok((select lift_authority_basis='automatic_crisis' and lifted_at is not null and not account_in_crisis
  from ai.explorer_ai_use_stop where stop_id=(select stop_id from aiuse_two_days)),
  'but that check lifts the first stop automatically, because the account is now in crisis handling');
select is(pg_temp.set_limit('explorer_ai_use_individual_daily_call_limit',4,9109),'applied','individual stop lowered to 4');
select ok((select g->>'individual'='none' from (select ai.solmind_explorer_ai_use_gate_v1(pg_temp.gid(1),pg_temp.gid(6005),
  clock_timestamp(),'read') g) x),
  'the three Sends after the fourth stop are below 4: the Send that reached that stop is not counted again');
select is(pg_temp.set_limit('explorer_ai_use_individual_daily_call_limit',3,9107),'applied',
  'individual stop lowered to 3, the Sends since today''s latest lifted stop');
select ok((select g->>'individual'='review' and (g->>'crisis')::boolean
  from (select ai.solmind_explorer_ai_use_gate_v1(pg_temp.gid(1),pg_temp.gid(6005),clock_timestamp(),'read') g) x),
  'today the lowered stop is reached and, as the day''s fifth stop, waits for Paul even in urgent handling');
select ok((select notice_kind='individual_and_shared' and crisis from pg_temp.pause()),
  'the pause read reports both pauses, as a crisis pause notice');
select ok((select g->>'individual'='none' from (select ai.solmind_explorer_ai_use_gate_v1(pg_temp.gid(1),pg_temp.gid(6005),
  pg_temp.noon(pg_temp.today()+1),'read') g) x),'tomorrow the individual count starts again from zero');
select is((select outcome from pg_temp.observe(17)),'paused','the next Send is refused');
select ok((select day_stop_number=5 and account_in_crisis and lifted_at is null from ai.explorer_ai_use_stop
  where actor_user_account_id=pg_temp.gid(1) and stop_day=pg_temp.today() and day_stop_number=5),
  'and records the fifth stop, reached in crisis handling');
select ok((select g->>'individual'='review' and not (g->>'shared')::boolean
  from (select ai.solmind_explorer_ai_use_gate_v1(pg_temp.gid(1),pg_temp.gid(6005),pg_temp.noon(pg_temp.today()+1),'read') g) x),
  'if midnight comes first, the shared pause ends but the fifth stop still waits for Paul');
select is((select outcome from public.solmind_lift_explorer_ai_use_pause_v1((select stop_id from ai.explorer_ai_use_stop
    where actor_user_account_id=pg_temp.gid(1) and stop_day=pg_temp.today() and day_stop_number=5),
    pg_temp.gid(9172),pg_temp.gid(9173))),'lifted','Paul lifts the fifth stop');
select ok((select notice_kind='shared' and crisis from pg_temp.pause()),
  'if Paul lifts first, only the shared pause remains until midnight');
select lives_ok($$insert into ai.explorer_ai_use_shared_day(stop_day,active_explorer_count,calls_per_active_explorer,
    setting_version,threshold,counted_at) values(pg_temp.today()+2,1,1,1,1,clock_timestamp())$$,
  'synthetic shared allowance of one Send for the day after tomorrow');
select ok((select not (g->>'shared')::boolean from (select ai.solmind_explorer_ai_use_gate_v1(pg_temp.gid(1),pg_temp.gid(6005),
  pg_temp.noon(pg_temp.today()+2),'read') g) x),'today''s Sends do not count toward another day''s shared allowance');

-- Active Explorers for the shared budget.
create temp table aiuse_active as select ai.solmind_explorer_ai_use_active_explorers_v1(clock_timestamp()) n;
update core.guide_explorer_relationship set relationship_status='paused' where guide_explorer_relationship_id=pg_temp.gid(27);
select is(ai.solmind_explorer_ai_use_active_explorers_v1(clock_timestamp()),(select n from aiuse_active),
  'an Explorer in a paused Guide relationship still counts');
update core.explorer_profile set onboarding_status='intake_pending' where explorer_profile_id=pg_temp.gid(26);
select is(ai.solmind_explorer_ai_use_active_explorers_v1(clock_timestamp()),(select n from aiuse_active)-1,
  'an Explorer who has not finished sign-up does not count');


set local role service_role;
select lives_ok($$set constraints all immediate$$,'deferred coherence checks pass at the caller boundary');
reset role;
select * from finish();
rollback;
