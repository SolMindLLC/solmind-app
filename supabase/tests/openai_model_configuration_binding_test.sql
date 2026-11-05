-- Focused synthetic SQL model-binding proof in a disposable project only.
-- Reuses the existing lifecycle test's authority/context fixture, not real
-- login, AI screening, model compatibility or human approval evidence.
-- No provider, credentials, runtime environment lookup or current-setting row
-- exists in this SQL test: a trusted caller supplies its selected model.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,pg_catalog,pg_temp;
set local statement_timeout='120s';
select plan(100);

create function pg_temp.gid(n integer) returns uuid language sql immutable as $$
  select ('f4290000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
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
      'label',ai.solmind_exclusion_normalize_v3(r.current_label),
      'actor',case when r.kind='follow_attention' then 'virtual_guide' else 'explorer' end,
      'awaitingReply',r.kind='set_attention'
        and r.operation_id=(select last_move.operation_id from ai.explorer_conversation_operation last_move
          where last_move.conversation_id=pg_temp.gid(6005) and last_move.compass_route_kind='attention_changed'
          order by last_move.initial_revision desc,last_move.operation_id desc limit 1)
        and not exists(select 1 from ai.ai_interaction_message reply where reply.ai_interaction_session_id=pg_temp.gid(6005)
          and reply.sender_type='ai' and reply.created_at>=r.completed_at)) order by r.initial_revision,r.operation_id)
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
create function pg_temp.context_value(msg uuid,body text,classification_only boolean default false) returns jsonb language sql stable as $$
  select jsonb_build_object('contractVersion',case when classification_only then 'wi007-v0.1+onboarding-fields-v2'
    else 'wi007-v0.1+onboarding-fields-v2+compass-v1' end,'aiRole','solmind_virtual_guide','actorRoleContext','explorer',
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
    || case when classification_only then '{}'::jsonb else jsonb_build_object('compassContext',pg_temp.compass_context()) end
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
    rev,methodology.hash_json(jsonb_build_array('synthetic-command',slot)),'explorer-safety-reply.v2',
    'synthetic-fallback.v1','synthetic-model-policy.v1',repeat('A',64),lvl::smallint,minor_flag);
end $$;
create function pg_temp.prepare_private(slot_n integer,lvl integer default 0,minor_flag boolean default false,
  body_override text default null,selected_model text default 'gpt-5.6-luna')
returns table(outcome text,conversation_state jsonb,dispatch_permitted boolean,policy_state jsonb)
language plpgsql as $$
declare saved lifecycle_intent%rowtype; a jsonb; policy jsonb; e jsonb; msg uuid:=pg_temp.gid(10001+slot_n*10);
  src uuid[]; c text; classification_only boolean; b text:=coalesce(body_override,'Synthetic private message '||slot_n||'.');
begin
  select * into saved from lifecycle_intent where slot=slot_n;
  if not found then
    select r.authority_context,r.policy_state into a,policy from public.solmind_read_explorer_conversation_v3(
      pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005)) r;
    e:=methodology.resolve_effective(pg_temp.gid(1000),pg_temp.gid(23));
    classification_only:=policy->>'restrictedLevel' is not null or (policy->>'adultReflectionStopped')::boolean
      or lvl>=3 or minor_flag;
    c:=pg_temp.compact(pg_temp.context_value(msg,b,classification_only));
    select array_agg(distinct id order by id) into src from (
      select unnest(array[pg_temp.gid(52),msg,pg_temp.gid(1001)]) id union all
      select m.ai_interaction_message_id from (select * from ai.ai_interaction_message
        where ai_interaction_session_id=pg_temp.gid(6005) order by sequence_number desc limit 24) m
      union all select x from unnest(pg_temp.compass_source_ids()) x where not classification_only
    ) selected;
    insert into lifecycle_intent values(slot_n,(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),
      b,c,src,a->>'authorizationVersion',(policy->>'version')::bigint,
      case when classification_only then 'classification_only' else 'classification_and_reply' end,lvl,minor_flag,e->>'contentSha256',e->>'methodologyAuthorizationVersion');
    select * into saved from lifecycle_intent where slot=slot_n;
  end if;
  return query select * from public.solmind_prepare_explorer_conversation_turn_v3(
    pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(10000+slot_n*10),saved.revision,msg,
    pg_temp.gid(10002+slot_n*10),pg_temp.gid(10003+slot_n*10),coalesce(body_override,saved.body),saved.serialization,
    upper(encode(extensions.digest(convert_to(saved.serialization,'UTF8'),'sha256'),'hex')),saved.source_ids,saved.authority,
    pg_temp.gid(52),pg_temp.gid(1001),'synthetic-prompt.v1','synthetic-policy.v1','synthetic-behavior.v1','synthetic-crisis.v1',
    'synthetic-role.v1','synthetic-instruction.v1',methodology.hash_json(jsonb_build_array('synthetic-command',slot_n)),
    pg_temp.gid(10004+slot_n*10),pg_temp.gid(1000),saved.methodology_sha,saved.mv,'explorer-safety-reply.v2',saved.mode,
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
  interested boolean default true,fallback_override integer default null,attention_n integer default null,choices jsonb default null)
returns table(outcome text,conversation_state jsonb,policy_state jsonb,saved_reply boolean)
language sql as $$
  select * from public.solmind_settle_explorer_conversation_turn_v4(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(10000+slot_n*10),status_name,case when kind='none' then null else pg_temp.gid(10005+slot_n*10) end,
    kind,case when kind='none' then null else body end,model::smallint,minor_flag,'explorer-safety-reply.v2',
    (select mode from lifecycle_intent where slot=slot_n),repeat('A',64),'synthetic-fallback.v1',
    'synthetic-model-policy.v1','synthetic-trusted.v1','synthetic-resources.v1',
    coalesce(fallback_override,(select fallback from lifecycle_intent where slot=slot_n))::smallint,
    (select minor from lifecycle_intent where slot=slot_n),interested,
    case when attention_n is null then null else pg_temp.gid(attention_n) end,choices)
$$;
create function pg_temp.settle_private_legacy(slot_n integer,model integer default 0,minor_flag boolean default false,
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

-- Same full-input validator contract as the server setting: no trimming.
select ok(ai.solmind_openai_model_name_valid('gpt-5.6-luna')
  and ai.solmind_openai_model_name_valid('synthetic-compatible:model_2'),
  'default caller model and alternate synthetic model ID are structurally valid');
select ok(ai.solmind_openai_model_name_valid('') is not true
  and ai.solmind_openai_model_name_valid(null) is not true
  and ai.solmind_openai_model_name_valid(' model') is not true
  and ai.solmind_openai_model_name_valid('model ') is not true
  and ai.solmind_openai_model_name_valid('bad model') is not true
  and ai.solmind_openai_model_name_valid(E'model\n') is not true
  and ai.solmind_openai_model_name_valid(repeat('a',121)) is not true
  and ai.solmind_openai_model_name_valid('mod'||pg_catalog.chr(233)||'le') is not true,
  'missing, blank, whitespace, trailing LF, non-ASCII and overlength names are rejected without normalization');
select ok(not exists(select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
  where has_table_privilege(r.role_name,'ai.explorer_conversation_operation','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege(r.role_name,'methodology.screen_attempt','SELECT,INSERT,UPDATE,DELETE')),
  'no API role receives direct preparation evidence table access');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join (values('anon'),('authenticated'),('service_role')) r(role_name)
  where n.nspname='public' and ((p.proname='solmind_prepare_methodology_screen' and p.pronargs=10)
    or (p.proname='solmind_prepare_explorer_conversation_turn_v3' and p.pronargs=36))
    and has_function_privilege(r.role_name,p.oid,'EXECUTE')),
  'old model-less preparation signatures are no longer API capabilities');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and ((p.proname='solmind_prepare_methodology_screen' and p.pronargs=11)
    or (p.proname='solmind_prepare_explorer_conversation_turn_v3' and p.pronargs=37))
    and has_function_privilege('service_role',p.oid,'EXECUTE')
    and not has_function_privilege('anon',p.oid,'EXECUTE')
    and not has_function_privilege('authenticated',p.oid,'EXECUTE')),2,
  'only the two mandatory-model preparation overloads retain service-only execution');

select is(pg_temp.register_version(1001),'ok','synthetic Admin registers the first draft');
select throws_ok($$select * from pg_temp.screen_start(1001,null,null,E'model\n')$$,
  'P0001','solmind_methodology_invalid_input','screen preparation rejects a final-LF model before creating an attempt');
select throws_ok($$select * from public.solmind_prepare_methodology_screen(
  pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(3900),pg_temp.gid(1000),pg_temp.gid(1001),pg_temp.gid(4900),
  pg_temp.sha(1001),'synthetic-screen-policy.v1',repeat('B',64),pg_temp.request_sha(1001),'gpt-5.6-luna')$$,
  'P0001','solmind_methodology_denied','new model parameter does not bypass actual Admin authority');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.screen_start(1001)),
  'trusted caller explicitly supplies the default model for a new screen');
select ok((select a.model_name='gpt-5.6-luna' and i.model_name=a.model_name
  from methodology.screen_attempt a join ai.ai_model_invocation i on i.ai_model_invocation_id=a.screen_invocation_id
  where a.methodology_context_pack_version_id=pg_temp.gid(1001)),
  'screen attempt and invocation capture the same requested default model');
select ok((select outcome='exact_replay' and not dispatch_permitted from pg_temp.screen_start(1001)),
  'exact screen replay is non-dispatch');
select throws_ok($$select * from pg_temp.screen_start(1001,null,null,'synthetic-compatible:model_2')$$,
  'P0001','solmind_methodology_operation_conflict','same screen operation cannot be reused with a changed selected model');
select is(pg_temp.screen_terminal(1001),'ok','original captured screen settles after a caller presented another selection');
select is(pg_temp.admin_review(1001),'ok','synthetic Admin consistency is retained');
select is(pg_temp.guide_decision(1001),'ok','synthetic owning Guide review activates the first fixture');
create temp table first_methodology_proof as
  select methodology.resolve_effective(pg_temp.gid(1000),pg_temp.gid(23)) value;

select is(pg_temp.register_version(1002,1001),'ok','synthetic Admin registers the next draft');
select ok((select outcome='ok' and dispatch_permitted
  from pg_temp.screen_start(1002,null,null,'synthetic-compatible:model_2')),
  'another new screen captures the caller alternate model without a fixed Luna constraint');
select ok((select a.model_name='synthetic-compatible:model_2' and i.model_name=a.model_name
  from methodology.screen_attempt a join ai.ai_model_invocation i on i.ai_model_invocation_id=a.screen_invocation_id
  where a.methodology_context_pack_version_id=pg_temp.gid(1002)),
  'alternate screen attempt and invocation agree on captured model');
select is(pg_temp.screen_terminal(1002),'ok','alternate captured screen settles without consulting a current setting');
select is(methodology.require_screen_evidence(pg_temp.gid(1002))->>'model','synthetic-compatible:model_2',
  'existing evidence verifier reconstructs the captured alternate model');
select is(methodology.resolve_effective(pg_temp.gid(1000),pg_temp.gid(23)),
  (select value from first_methodology_proof),'a later model selection does not rewrite the active earlier methodology/MV1 proof');

select is((select outcome from pg_temp.ensure_anchor()),'created','private anchor remains an explicit configured operation');
select is((select outcome from pg_temp.observe(1)),'ok','first synthetic fallback0 observation');
select throws_ok($$select * from pg_temp.prepare_private(1,0,false,null,null)$$,
  'P0001','solmind_explorer_private_invalid_input','new private preparation refuses a missing selected model');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(1)),
  'new private turn captures explicit caller default model');
select ok((select o.model_name='gpt-5.6-luna' and i.model_name=o.model_name
  from ai.explorer_conversation_operation o join ai.ai_model_invocation i on i.ai_model_invocation_id=o.invocation_id
  where o.actor_user_account_id=pg_temp.gid(1) and o.operation_id=pg_temp.gid(10010)),
  'private operation and invocation capture the same model');
select ok((select outcome='exact_replay' and not dispatch_permitted from pg_temp.prepare_private(1)),
  'exact private preparation replay remains non-dispatch');
select throws_ok($$select * from pg_temp.prepare_private(1,0,false,null,'synthetic-compatible:model_2')$$,
  'P0001','solmind_explorer_private_operation_conflict','changed model cannot reuse an existing private operation');
select ok((select outcome='ok' and saved_reply from pg_temp.settle_private(1)),
  'original private turn settles using its capture despite a later caller selection');

select is((select outcome from pg_temp.observe(2)),'ok','next synthetic fallback0 observation');
select ok((select outcome='ok' and dispatch_permitted
  from pg_temp.prepare_private(2,0,false,null,'synthetic-compatible:model_2')),
  'another private turn accepts an alternate captured model structurally');
select throws_ok($$update ai.explorer_conversation_operation set model_name='changed-model'
  where actor_user_account_id=pg_temp.gid(1) and operation_id=pg_temp.gid(10020)$$,
  'P0001','solmind_explorer_private_immutable','captured operation model is immutable');
select throws_ok($$update ai.ai_model_invocation set model_name='changed-model'
  where ai_model_invocation_id=pg_temp.gid(10023)$$,
  'P0001','solmind_explorer_private_immutable','captured invocation model is immutable');
select ok((select outcome='ok' and saved_reply from pg_temp.settle_private(2)),
  'settlement compares with the captured alternate model instead of fixed/current Luna');
select ok((select outcome='exact_replay' and saved_reply from pg_temp.settle_private(2)),
  'alternate terminal replay returns its saved result without another preparation');

-- Owner-only retained old definition fabricates a legacy-null row for branch
-- compatibility, not permission for an API caller to create unbound turns.
select is((select outcome from pg_temp.observe(3)),'ok','legacy branch observation');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private_legacy(3)),
  'owner-only historical signature can construct the legacy fixture');
select ok((select model_name is null from ai.explorer_conversation_operation
  where actor_user_account_id=pg_temp.gid(1) and operation_id=pg_temp.gid(10030)),
  'legacy operation remains null without fabricated model backfill');
select ok((select outcome='exact_replay' and not dispatch_permitted from pg_temp.prepare_private_legacy(3)),
  'owner-only historical preparation recognizes its exact v1 replay without redispatch');
select throws_ok($$select * from pg_temp.prepare_private(3)$$,
  'P0001','solmind_explorer_private_operation_conflict','v2 preparation cannot relabel a historical v1 operation');
select throws_ok($$select * from pg_temp.prepare_private(3,0,false,null,'synthetic-compatible:model_2')$$,
  'P0001','solmind_explorer_private_operation_conflict','legacy replay does not accept a changed selected model');
select ok((select outcome='ok' and saved_reply from pg_temp.settle_private_legacy(3)),
  'legacy-null settlement retains its captured historical Luna meaning');

-- S4 protocol, immutable saved choices and the separate needle operation.
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='solmind_settle_explorer_conversation_turn_v4' and p.pronargs=22
    and p.prosecdef and has_function_privilege('service_role',p.oid,'EXECUTE')
    and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE')),1,
  'only one exact 22-argument v4 settlement is an API capability');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join (values('anon'),('authenticated'),('service_role')) role_row(name)
  where n.nspname='public' and p.proname='solmind_settle_explorer_conversation_turn_v3'
    and has_function_privilege(role_row.name,p.oid,'EXECUTE')),
  'retained v3 settlement has no API execute privilege');
select ok(ai.solmind_explorer_reply_choices_valid_v2('[{"label":"Show me around"},{"label":"I have a question"},{"label":"Let''s begin"}]')
  and ai.solmind_explorer_reply_choices_valid_v2(jsonb_build_array(jsonb_build_object('label',repeat(U&'\+01F642',40))))
  and not ai.solmind_explorer_reply_choices_valid_v2(jsonb_build_array(jsonb_build_object('label',repeat(U&'\+01F642',41))))
  and not ai.solmind_explorer_reply_choices_valid_v2('[{"label":" Leading space"}]')
  and not ai.solmind_explorer_reply_choices_valid_v2(jsonb_build_array(jsonb_build_object('label',U&'hidden\200Blabel')))
  and not ai.solmind_explorer_reply_choices_valid_v2('[{"label":"A","extra":true}]')
  and not ai.solmind_explorer_reply_choices_valid_v2('[]')
  and not ai.solmind_explorer_reply_choices_valid_v2('null'),
  'choices have 1-3 exact plain labels, Unicode scalar bounds and no invisible/extra fields');
select throws_ok($$update ai.ai_interaction_message set content_text='Changed v2 Explorer message' where ai_interaction_message_id=pg_temp.gid(10011)$$,
  'P0001','solmind_explorer_private_immutable','v2 guard protects the saved Explorer message');
select throws_ok($$delete from ai.ai_interaction_message where ai_interaction_message_id=pg_temp.gid(10015)$$,
  'P0001','solmind_explorer_private_immutable','v2 guard protects a saved reply even without choices');
select throws_ok($$update ai.ai_interaction_message set content_text='Changed old reply' where ai_interaction_message_id=pg_temp.gid(10035)$$,
  'P0001','solmind_explorer_private_immutable','the same guard still protects historical v1 messages');
select throws_ok($$update ai.ai_interaction_message set explorer_reply_choices='[{"label":"Invented later"}]' where ai_interaction_message_id=pg_temp.gid(10015)$$,
  'P0001','solmind_explorer_private_immutable','choices cannot enrich a saved message after insert');
select throws_ok($$select * from public.solmind_observe_explorer_conversation_fallback_v3(
  pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(19990),pg_temp.gid(19994),
  (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),repeat('F',64),
  'explorer-safety-reply.v1','synthetic-fallback.v1','synthetic-model-policy.v1',repeat('A',64),0::smallint,false)$$,
  'P0001','solmind_explorer_private_invalid_input','new fallback observations reject the retired v1 protocol');
create function pg_temp.s4_mutate(op_n integer,kind_name text,source_n integer default null,item_n integer default null,label_text text default null)
returns text language sql as $$
  select outcome from public.solmind_mutate_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(op_n),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),
    kind_name,pg_temp.request_sha(op_n),case when source_n is null then null else pg_temp.gid(source_n) end,
    case when item_n is null then null else pg_temp.gid(item_n) end,null,label_text)
$$;
create function pg_temp.s4_send(slot_n integer,model integer default 0,kind text default 'ordinary',attention_n integer default null,
  choices jsonb default null,interested boolean default true)
returns table(outcome text,conversation_state jsonb,policy_state jsonb,saved_reply boolean) language plpgsql as $$
begin
  if not exists(select 1 from pg_temp.prepare_private(slot_n) prepared where prepared.outcome='ok' and prepared.dispatch_permitted)
    then raise exception 'synthetic_s4_prepare_failed'; end if;
  return query select * from pg_temp.settle_private(slot_n,model,false,kind,'Synthetic saved reply.','completed',interested,null,attention_n,choices);
end $$;
select is(pg_temp.s4_mutate(24001,'add_compass',10011,null,'First saved point'),'ok','S4 adds its first saved point');
select is(pg_temp.s4_mutate(24101,'confirm_priority',null,24001),'ok','Priority remains an explicit Explorer confirmation');
select is((select outcome from public.solmind_confirm_explorer_compass_arrangement_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
  pg_temp.gid(24102),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),pg_temp.request_sha(24102),
  pg_temp.gid(24001),jsonb_build_array(jsonb_build_object('compassItemId',pg_temp.gid(24001),'anchor','apex','emphasis',3)))),
  'ok','S4 fixture has an actual saved arrangement');
select is(pg_temp.s4_mutate(24002,'add_compass',10015,null,'Unplaced current point'),'ok','new current point stays unplaced');
select is(pg_temp.s4_mutate(24003,'add_compass',10021,null,'Combined-away fixture point'),'ok','third original point retained for stale-target proof');
update ai.explorer_conversation_compass_item set merged_into_item_id=pg_temp.gid(24001) where item_id=pg_temp.gid(24003);
select ok((select outcome='ok' and saved_reply from pg_temp.s4_send(4,0,'ordinary',24002,
  '[{"label":"Show me around"},{"label":"I have a question"},{"label":"Let''s begin"}]')),
  'ordinary saved v2 reply accepts three choices and quietly points to a current unplaced head');
select ok((select attention_id=pg_temp.gid(24002) and priority_id=pg_temp.gid(24001) from ai.explorer_conversation_state
  where conversation_id=pg_temp.gid(6005)) and (select compass_anchor is null from ai.explorer_conversation_compass_item where item_id=pg_temp.gid(24002)),
  'the needle moves to an unplaced point without changing Priority or arrangement');
select ok((select count(*)=1 and bool_and(status='completed' and kind='follow_attention'
    and compass_route_kind='attention_changed' and compass_route_item_id=pg_temp.gid(24002)
    and operation_id<>origin_operation_id and initial_revision+1=(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)))
  from ai.explorer_conversation_operation where origin_operation_id=pg_temp.gid(10040)),
  'one separate completed operation links the needle move to its Send and final revision');
select is((select explorer_reply_choices from ai.ai_interaction_message where ai_interaction_message_id=pg_temp.gid(10045)),
  '[{"label":"Show me around"},{"label":"I have a question"},{"label":"Let''s begin"}]'::jsonb,'choices are stored with the exact saved reply');
select ok(exists(select 1 from jsonb_array_elements(ai.solmind_conversation_state_json(pg_temp.gid(6005))->'messages') m
  where m->>'id'=pg_temp.gid(10045)::text and jsonb_array_length(m->'choices')=3)
  and exists(select 1 from jsonb_array_elements(ai.solmind_conversation_state_json(pg_temp.gid(6005))->'route') r
    where r->>'actor'='virtual_guide' and r->>'compassItemId'=pg_temp.gid(24002)::text),
  'owned state returns optional choices and the attention actor without origin-operation authority');
select ok((select outcome='exact_replay' and saved_reply from pg_temp.settle_private(4,0,false,'ordinary','Synthetic saved reply.','completed',true,null,24002,
  '[{"label":"Show me around"},{"label":"I have a question"},{"label":"Let''s begin"}]')),
  'exact v4 replay retains the same saved reply, choices and single Route move');
select throws_ok($$select * from pg_temp.settle_private(4,0,false,'ordinary','Synthetic saved reply.','completed',true,null,24001,
  '[{"label":"Show me around"},{"label":"I have a question"},{"label":"Let''s begin"}]')$$,
  'P0001','solmind_explorer_private_operation_conflict','v4 replay with a different needle conflicts');
select throws_ok($$select * from pg_temp.settle_private(4,0,false,'ordinary','Synthetic saved reply.','completed',true,null,24002,'[{"label":"Changed choice"}]')$$,
  'P0001','solmind_explorer_private_operation_conflict','v4 replay with different choices conflicts');
select throws_ok($$update ai.ai_interaction_message set explorer_reply_choices='[{"label":"Changed choice"}]' where ai_interaction_message_id=pg_temp.gid(10045)$$,
  'P0001','solmind_explorer_private_immutable','saved v2 choices are immutable');
select throws_ok($$update ai.explorer_conversation_operation set origin_operation_id=pg_temp.gid(10020) where origin_operation_id=pg_temp.gid(10040)$$,
  'P0001','solmind_explorer_private_immutable','the follow operation origin is insert-only');
select throws_ok($$delete from ai.explorer_conversation_operation where origin_operation_id=pg_temp.gid(10040)$$,
  'P0001','solmind_explorer_private_immutable','the completed follow operation cannot be deleted');
select ok((select saved_reply from pg_temp.s4_send(5,0,'ordinary',24002,'[{"label":"1"},{"label":"2"},{"label":"3"},{"label":"4"}]')),
  'too many choices are absent and do not erase an ordinary reply');
select ok((select explorer_reply_choices is null from ai.ai_interaction_message where ai_interaction_message_id=pg_temp.gid(10055))
  and not exists(select 1 from ai.explorer_conversation_operation where origin_operation_id=pg_temp.gid(10050)),
  'invalid choices are not stored and the same current needle adds no Route event');
select ok((select saved_reply from pg_temp.s4_send(6,0,'ordinary',24999,jsonb_build_array(jsonb_build_object('label',repeat('x',41))))),
  'unknown needle and overlong choices are ignored while the reply is saved');
select ok((select explorer_reply_choices is null from ai.ai_interaction_message where ai_interaction_message_id=pg_temp.gid(10065))
  and not exists(select 1 from ai.explorer_conversation_operation where origin_operation_id=pg_temp.gid(10060)),
  'unknown needle never fabricates a point or a move');
select ok((select saved_reply from pg_temp.s4_send(7,0,'ordinary',24003,'{"label":"Wrong group shape"}')),
  'combined-away target and malformed choices never roll back a valid reply');
select ok(not exists(select 1 from ai.explorer_conversation_operation where origin_operation_id=pg_temp.gid(10070))
  and (select explorer_reply_choices is null from ai.ai_interaction_message where ai_interaction_message_id=pg_temp.gid(10075)),
  'non-head target and malformed group stay absent');
select ok((select saved_reply from pg_temp.s4_send(8,2,'ordinary',24001,'[{"label":"Do not offer at level two"}]')),
  'ordinary level-two reply still saves and can quietly follow its saved topic');
select ok(exists(select 1 from ai.explorer_conversation_operation where origin_operation_id=pg_temp.gid(10080))
  and (select explorer_reply_choices is null from ai.ai_interaction_message where ai_interaction_message_id=pg_temp.gid(10085)),
  'level two keeps the quiet needle move but suppresses choices');
select ok((select not saved_reply from pg_temp.s4_send(9,0,'ordinary',24002,'[{"label":"Withheld"}]',false)),
  'lost delivery interest withholds the reply and its optional effects');
select ok(not exists(select 1 from ai.ai_interaction_message where ai_interaction_message_id=pg_temp.gid(10095))
  and not exists(select 1 from ai.explorer_conversation_operation where origin_operation_id=pg_temp.gid(10090)),
  'no orphan choices or needle move survive a withheld reply');
select is(pg_temp.s4_mutate(24103,'set_attention',null,24002),'ok','Explorer can still explicitly point the needle');
select ok(exists(select 1 from jsonb_array_elements(pg_temp.compass_context()->'recentRoute') r
  where r->>'pointId'=pg_temp.gid(24002)::text and r->>'actor'='explorer' and r->>'awaitingReply'='true'),
  'latest Explorer move after every saved reply carries the once-only acknowledgment cue');
select ok((select saved_reply from pg_temp.s4_send(10)), 'next saved reply clears the prior acknowledgment window');
select ok(not exists(select 1 from jsonb_array_elements(pg_temp.compass_context()->'recentRoute') r where r->>'awaitingReply'='true'),
  'saved reply prevents repeated acknowledgment of the same Explorer move');
select is((select outcome from pg_temp.ensure_anchor(6105,4,54)),'created',
  'separate Explorer owns the foreign-target fixture conversation');
insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
  sender_type,sender_user_account_id,sender_role_context,content_text)
  values(pg_temp.gid(25001),pg_temp.gid(6105),1,'user',pg_temp.gid(4),'explorer','Synthetic other Explorer source.');
insert into ai.explorer_conversation_compass_item(item_id,conversation_id,source_message_id,label,display_order)
  values(pg_temp.gid(25002),pg_temp.gid(6105),pg_temp.gid(25001),'Foreign current point',1);
select ok((select saved_reply from pg_temp.s4_send(13,0,'ordinary',25002,'[{"label":"Valid own choice"}]')),
  'a foreign current head is ignored while the owned ordinary reply still saves');
select ok(not exists(select 1 from ai.explorer_conversation_operation where origin_operation_id=pg_temp.gid(10130))
  and (select attention_id=pg_temp.gid(24002) from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005))
  and (select explorer_reply_choices='[{"label":"Valid own choice"}]'::jsonb from ai.ai_interaction_message where ai_interaction_message_id=pg_temp.gid(10135)),
  'foreign needle does not cross conversations or erase independent valid choices');
-- Exercise the adult stop without a restricted-level hold, then restore the
-- existing fixture through the probe's deliberate subtransaction rollback.
select lives_ok($adult_stop$do $probe$
declare observed record; prepared record; settled record;
begin
  begin
    insert into content.waypoint(waypoint_id,guide_explorer_relationship_id,source_ai_interaction_session_id,source_message_id,title,
      destination,why_it_matters,arrival_signal,lifecycle_status,chosen_by_explorer_user_account_id,chosen_at)
      values(pg_temp.gid(26001),pg_temp.gid(25),pg_temp.gid(6005),pg_temp.gid(10011),'Synthetic retained Waypoint',
        'Synthetic retained Waypoint','Synthetic meaning','Synthetic arrival','chosen',pg_temp.gid(1),now());
    select * into observed from pg_temp.observe(14,0,true);
    if observed.outcome is distinct from 'ok'
      or observed.policy_state->>'adultReflectionStopped' is distinct from 'true'
      or observed.policy_state->>'restrictedLevel' is not null
      then raise exception 'synthetic_s4_adult_stop_observation_failed'; end if;
    select * into prepared from pg_temp.prepare_private(14,0,true);
    if prepared.outcome is distinct from 'ok' or prepared.dispatch_permitted is distinct from true
      then raise exception 'synthetic_s4_adult_stop_prepare_failed'; end if;
    if not exists(select 1 from lifecycle_intent i join ai.ai_context_snapshot sn
        on sn.ai_context_snapshot_id=pg_temp.gid(10142)
      where i.slot=14 and i.mode='classification_only'
        and i.serialization::jsonb->>'contractVersion'='wi007-v0.1+onboarding-fields-v2'
        and not (i.serialization::jsonb ? 'compassContext') and not (i.source_ids && pg_temp.compass_source_ids())
        and sn.context_source_ids=i.source_ids
        and sn.context_fingerprint_sha256=ai.solmind_exclusion_fingerprint_v3(i.serialization))
      or jsonb_array_length(pg_temp.compass_context()->'points')<2
      or jsonb_array_length(pg_temp.compass_context()->'waypoints')<>1
      then raise exception 'synthetic_adult_reduced_context_binding_failed'; end if;
    select * into settled from pg_temp.settle_private(14,0,true,'adult_only','Synthetic adults-only reply.',
      'completed',true,null,24001,'[{"label":"Suppressed by adult stop"}]');
    if settled.outcome is distinct from 'ok' or settled.saved_reply is distinct from true
      or settled.policy_state->>'adultReflectionStopped' is distinct from 'true'
      or settled.policy_state->>'restrictedLevel' is not null
      then raise exception 'synthetic_s4_adult_stop_settle_failed'; end if;
    if not exists(select 1 from ai.ai_interaction_message
        where ai_interaction_message_id=pg_temp.gid(10145) and explorer_reply_choices is null)
      or exists(select 1 from ai.explorer_conversation_operation where origin_operation_id=pg_temp.gid(10140))
      or (select attention_id from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005))
        is distinct from pg_temp.gid(24002)
      then raise exception 'synthetic_s4_adult_stop_optional_effect'; end if;
    select * into prepared from pg_temp.prepare_private(16,0,false,null,'synthetic-compatible:model_2');
    if prepared.outcome is distinct from 'ok' or prepared.dispatch_permitted is distinct from true
      or not exists(select 1 from lifecycle_intent i join ai.ai_context_snapshot sn
        on sn.ai_context_snapshot_id=pg_temp.gid(10162)
        join ai.ai_model_invocation inv on inv.ai_context_snapshot_id=sn.ai_context_snapshot_id
        where i.slot=16 and i.mode='classification_only' and not (i.serialization::jsonb ? 'compassContext')
          and i.serialization::jsonb->>'contractVersion'='wi007-v0.1+onboarding-fields-v2'
          and not (i.source_ids && pg_temp.compass_source_ids()) and sn.context_source_ids=i.source_ids
          and sn.context_fingerprint_sha256=ai.solmind_exclusion_fingerprint_v3(i.serialization)
          and inv.model_name='synthetic-compatible:model_2')
      then raise exception 'synthetic_existing_adult_alternate_model_binding_failed'; end if;
    if not exists(select 1 from pg_temp.prepare_private(16,0,false,null,'synthetic-compatible:model_2')
        where outcome='exact_replay' and not dispatch_permitted)
      or not exists(select 1 from pg_temp.prepare_private_legacy(3) where outcome='exact_replay' and not dispatch_permitted)
      then raise exception 'synthetic_adult_current_or_historical_replay_failed'; end if;
    raise exception 'synthetic_s4_adult_stop_probe_rolled_back';
  exception when raise_exception then
    if sqlerrm<>'synthetic_s4_adult_stop_probe_rolled_back' then raise; end if;
  end;
end $probe$;$adult_stop$,
  'adult-stop calls omit populated Compass/Waypoint sources, retain exact fingerprints/models and replay history without optional effects (probe rolled back)');

select ok((select not saved_reply and policy_state->>'restrictedLevel'='3' from pg_temp.s4_send(11,3,'none',24001,'[{"label":"Unsafe optional effect"}]')),
  'positive classification survives without a reply and creates no optional application effects');
select ok(not exists(select 1 from ai.explorer_conversation_operation where origin_operation_id=pg_temp.gid(10110))
  and not exists(select 1 from ai.ai_interaction_message where ai_interaction_message_id=pg_temp.gid(10115)),
  'classification-only result has neither needle move nor choices');
select ok((select saved_reply from pg_temp.s4_send(12,0,'restricted',24001,'[{"label":"Suppressed in restriction"}]')),
  'restricted follow-up may save its trusted response');
select ok((select explorer_reply_choices is null from ai.ai_interaction_message where ai_interaction_message_id=pg_temp.gid(10125))
  and not exists(select 1 from ai.explorer_conversation_operation where origin_operation_id=pg_temp.gid(10120))
  and (select attention_id=pg_temp.gid(24002) from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),
  'classification-only restricted turn never stores choices or follows attention');
select ok((select i.mode='classification_only' and not (i.serialization::jsonb ? 'compassContext')
    and i.serialization::jsonb->>'contractVersion'='wi007-v0.1+onboarding-fields-v2'
    and not (i.source_ids && pg_temp.compass_source_ids()) and sn.context_source_ids=i.source_ids
    and sn.context_fingerprint_sha256=ai.solmind_exclusion_fingerprint_v3(i.serialization)
  from lifecycle_intent i join ai.ai_context_snapshot sn on sn.ai_context_snapshot_id=pg_temp.gid(10122) where i.slot=12),
  'restricted model call captures the exact reduced context and source set');
select ok((select outcome='exact_replay' and not dispatch_permitted from pg_temp.prepare_private_legacy(3)),
  'historical v1 full-envelope operation still replays after restriction without redispatch');


-- Owner-only INSERT guard probes. Each attempt supplies the same valid Route
-- shape; only the origin eligibility or its conversation/session binding changes.
-- Send 1 has a saved v2 reply and no follow row, Send 3 is v1, and Send 9
-- completed without a saved reply. The existing second conversation owns 25002.
select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(15)),
  'origin-guard fixture leaves a real v2 Send started');
-- A historical session preserves the one-active-session-per-account invariant.
insert into identity.user_session(user_session_id,user_account_id,active_role_context,created_at,expires_at,session_status,ended_at)
  values(pg_temp.gid(60),pg_temp.gid(1),'explorer',now()-interval '1 hour',now()+interval '1 hour','revoked',now());
select throws_ok($$insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
  conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,
  compass_route_kind,compass_route_item_id,compass_route_label,origin_operation_id)
  values(pg_temp.gid(1),pg_temp.gid(26001),pg_temp.gid(50),pg_temp.gid(6005),'follow_attention',
    pg_temp.request_sha(26001),pg_temp.request_sha(26001),0,'completed',clock_timestamp(),
    'attention_changed',pg_temp.gid(24002),'Unplaced current point',pg_temp.gid(10030))$$,
  'P0001','solmind_explorer_private_operation_conflict','direct follow_attention INSERT rejects a v1 Send origin');
select throws_ok($$insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
  conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,
  compass_route_kind,compass_route_item_id,compass_route_label,origin_operation_id)
  values(pg_temp.gid(1),pg_temp.gid(26002),pg_temp.gid(50),pg_temp.gid(6005),'follow_attention',
    pg_temp.request_sha(26002),pg_temp.request_sha(26002),0,'completed',clock_timestamp(),
    'attention_changed',pg_temp.gid(24002),'Unplaced current point',pg_temp.gid(10150))$$,
  'P0001','solmind_explorer_private_operation_conflict','direct follow_attention INSERT rejects a still-started Send origin');
select throws_ok($$insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
  conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,
  compass_route_kind,compass_route_item_id,compass_route_label,origin_operation_id)
  values(pg_temp.gid(1),pg_temp.gid(26003),pg_temp.gid(50),pg_temp.gid(6005),'follow_attention',
    pg_temp.request_sha(26003),pg_temp.request_sha(26003),0,'completed',clock_timestamp(),
    'attention_changed',pg_temp.gid(24002),'Unplaced current point',pg_temp.gid(10090))$$,
  'P0001','solmind_explorer_private_operation_conflict','direct follow_attention INSERT rejects a completed Send with no saved reply');
select throws_ok($$insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
  conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,
  compass_route_kind,compass_route_item_id,compass_route_label,origin_operation_id)
  values(pg_temp.gid(1),pg_temp.gid(26004),pg_temp.gid(50),pg_temp.gid(6105),'follow_attention',
    pg_temp.request_sha(26004),pg_temp.request_sha(26004),0,'completed',clock_timestamp(),
    'attention_changed',pg_temp.gid(25002),'Foreign current point',pg_temp.gid(10010))$$,
  'P0001','solmind_explorer_private_operation_conflict','direct follow_attention INSERT rejects another conversation''s Send origin');
select throws_ok($$insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
  conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,
  compass_route_kind,compass_route_item_id,compass_route_label,origin_operation_id)
  values(pg_temp.gid(1),pg_temp.gid(26005),pg_temp.gid(60),pg_temp.gid(6005),'follow_attention',
    pg_temp.request_sha(26005),pg_temp.request_sha(26005),0,'completed',clock_timestamp(),
    'attention_changed',pg_temp.gid(24002),'Unplaced current point',pg_temp.gid(10010))$$,
  'P0001','solmind_explorer_private_operation_conflict','direct follow_attention INSERT rejects a Send from a different application session');
select throws_ok($$insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
  conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,
  compass_route_kind,compass_route_item_id,compass_route_label,origin_operation_id)
  values(pg_temp.gid(1),pg_temp.gid(26006),pg_temp.gid(50),pg_temp.gid(6005),'follow_attention',
    pg_temp.request_sha(26006),pg_temp.request_sha(26006),0,'completed',clock_timestamp(),
    'attention_changed',pg_temp.gid(24002),'Unplaced current point',pg_temp.gid(24103))$$,
  'P0001','solmind_explorer_private_operation_conflict','direct follow_attention INSERT rejects an origin that is not a Send');
select lives_ok($$insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
  conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,
  compass_route_kind,compass_route_item_id,compass_route_label,origin_operation_id)
  values(pg_temp.gid(1),pg_temp.gid(26007),pg_temp.gid(50),pg_temp.gid(6005),'follow_attention',
    pg_temp.request_sha(26007),pg_temp.request_sha(26007),0,'completed',clock_timestamp(),
    'attention_changed',pg_temp.gid(24002),'Unplaced current point',pg_temp.gid(10010))$$,
  'direct follow_attention INSERT accepts a completed v2 Send with a saved reply in the same conversation and session');
select ok(exists(select 1 from ai.explorer_conversation_operation
  where actor_user_account_id=pg_temp.gid(1) and operation_id=pg_temp.gid(26007)
    and kind='follow_attention' and status='completed' and origin_operation_id=pg_temp.gid(10010)),
  'the valid direct follow_attention INSERT persists its exact Send origin');

set local role service_role;
select lives_ok($$set constraints all immediate$$,'all new/legacy pairs stay coherent at deferred caller boundary');
reset role;
select * from finish();
rollback;
