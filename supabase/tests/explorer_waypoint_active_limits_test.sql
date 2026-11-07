-- Lane 7 synthetic rollback-only integration proof. No database or provider was
-- run by the builder. Every assertion is outside fixture rollback subtransactions.
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
-- Chat step slice S3 (2026-11-03): the saved Compass and Waypoint section and its source ids, rebuilt from this
-- fixture conversation's rows for each new Send (the inspector compares them exactly): current points in display
-- order, the saved Priority and attention, the last five needle moves on a current point (oldest first, each
-- with the point's current label), the current Waypoint heads, no drafts.
create function pg_temp.compass_context() returns jsonb language sql stable as $$
  select jsonb_build_object('version','explorer-compass-context.v7','immediateMessageIsReplyChoice',false,
    'points',coalesce((select jsonb_agg(jsonb_build_object('id',c.item_id,'label',ai.solmind_exclusion_normalize_v3(c.label),
      'order',c.ord-1,'formation',case when c.formation_status='proposed' then 'forming' else 'saved' end,'anchor',c.compass_anchor,'emphasis',c.relative_emphasis)
      ||case when c.formation_status='proposed' then jsonb_build_object('suggestedInPreviousReply',coalesce(
        c.wording_message_id=(select previous.ai_interaction_message_id from ai.ai_interaction_message previous
          where previous.ai_interaction_session_id=c.conversation_id and previous.sender_type='ai'
            and previous.ai_role='solmind_virtual_guide' order by previous.sequence_number desc limit 1),false))
        else '{}'::jsonb end order by c.ord)
      from (select x.*,row_number() over(order by x.display_order) as ord from ai.explorer_conversation_compass_item x
        where x.conversation_id=pg_temp.gid(6005) and x.merged_into_item_id is null and x.formation_status is distinct from 'rejected') c),'[]'::jsonb),
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
          on c.conversation_id=o.conversation_id and c.item_id=o.compass_route_item_id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected'
        where o.conversation_id=pg_temp.gid(6005) and o.compass_route_kind='attention_changed'
        order by o.initial_revision desc,o.operation_id desc limit 5) r),'[]'::jsonb),
    'waypoints',coalesce((select jsonb_agg(jsonb_build_object('id',w.waypoint_id,'title',ai.solmind_exclusion_normalize_v3(w.title),
      'destination',ai.solmind_exclusion_normalize_v3(w.destination),'meaning',ai.solmind_exclusion_normalize_v3(w.why_it_matters),
      'arrivalSignal',ai.solmind_exclusion_normalize_v3(w.arrival_signal),
      'stage',case when w.lifecycle_status='reached' then 'reached' when w.released_at is not null then 'released' else 'formed' end,
      'reachedEvidence',case when w.lifecycle_status='reached' then ai.solmind_exclusion_normalize_v3(w.reached_evidence) end)
      order by case when w.lifecycle_status='chosen' and w.released_at is null then 0 else 1 end,w.created_at desc,w.waypoint_id)
      from (select h.* from content.waypoint h where h.source_ai_interaction_session_id=pg_temp.gid(6005)
        and not exists(select 1 from content.waypoint s where s.predecessor_waypoint_id=h.waypoint_id)
        order by case when h.lifecycle_status='chosen' and h.released_at is null then 0 else 1 end,h.created_at desc,h.waypoint_id limit 20) w),'[]'::jsonb),
    'drafts','[]'::jsonb)
$$;
create function pg_temp.compass_source_ids() returns uuid[] language sql stable as $$
  select coalesce(array_agg(x.id),array[]::uuid[]) from (
    select c.item_id as id from ai.explorer_conversation_compass_item c
      where c.conversation_id=pg_temp.gid(6005) and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected'
    union all select w.waypoint_id from (select h.* from content.waypoint h where h.source_ai_interaction_session_id=pg_temp.gid(6005)
      and not exists(select 1 from content.waypoint s where s.predecessor_waypoint_id=h.waypoint_id)
      order by case when h.lifecycle_status='chosen' and h.released_at is null then 0 else 1 end,h.created_at desc,h.waypoint_id limit 20) w) x
$$;
create function pg_temp.context_value(msg uuid,body text) returns jsonb language sql stable as $$
  select jsonb_build_object('contractVersion','wi007-v0.1+onboarding-fields-v2+compass-v7','aiRole','solmind_virtual_guide','actorRoleContext','explorer',
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
    rev,methodology.hash_json(jsonb_build_array('synthetic-command',slot)),'explorer-safety-reply.v2',
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
    pg_temp.gid(10004+slot_n*10),pg_temp.gid(1000),saved.methodology_sha,saved.mv,'explorer-safety-reply.v2',saved.mode,
    repeat('A',64),'synthetic-fallback.v1','synthetic-model-policy.v1','synthetic-trusted.v1','synthetic-resources.v1',
    saved.safety_version,saved.fallback,saved.minor,selected_model);
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

create function pg_temp.sx(n integer) returns uuid language sql immutable as $$
  select ('f5120000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
-- This independent golden is shared with explorerConversationContext.test.ts.
create temp table selection_golden as select
  $waypoint_selection_golden$["f5120000-0000-4000-8000-000000001000","f5120000-0000-4000-8000-000000001001","f5120000-0000-4000-8000-000000001023","f5120000-0000-4000-8000-000000001022","f5120000-0000-4000-8000-000000001021","f5120000-0000-4000-8000-000000001020","f5120000-0000-4000-8000-000000001019","f5120000-0000-4000-8000-000000001018","f5120000-0000-4000-8000-000000001017","f5120000-0000-4000-8000-000000001016","f5120000-0000-4000-8000-000000001015","f5120000-0000-4000-8000-000000001014","f5120000-0000-4000-8000-000000001013","f5120000-0000-4000-8000-000000001012","f5120000-0000-4000-8000-000000001011","f5120000-0000-4000-8000-000000001010","f5120000-0000-4000-8000-000000001009","f5120000-0000-4000-8000-000000001008","f5120000-0000-4000-8000-000000001007","f5120000-0000-4000-8000-000000001006"]$waypoint_selection_golden$::jsonb ids;
insert into content.waypoint(waypoint_id,guide_explorer_relationship_id,source_ai_interaction_session_id,source_message_id,
  title,destination,why_it_matters,arrival_signal,lifecycle_status,chosen_by_explorer_user_account_id,chosen_at,
  reached_by_explorer_user_account_id,reached_at,reached_evidence,created_at)
select pg_temp.sx(1000+n),pg_temp.gid(25),pg_temp.gid(6005),pg_temp.gid(10011),
  'Synthetic title','Synthetic destination','Synthetic meaning','Synthetic signal',
  case when n<2 then 'chosen' else 'reached' end,pg_temp.gid(1),clock_timestamp(),
  case when n>=2 then pg_temp.gid(1) end,case when n>=2 then clock_timestamp() end,
  case when n>=2 then 'Explicit synthetic evidence' end,
  case when n<2 then timestamptz '2026-11-06 09:00:00.000001+00'
    else timestamptz '2026-11-06 09:01:00+00'+n*interval '1 second' end
from generate_series(0,23) n;

select is((select row(active_limit,history_limit)::text from ai.solmind_waypoint_policy_v1()),'(20,200)',
  'one protected policy owns the active allowance and independent history guard');
select is(ai.solmind_conversation_state_json(null)->'waypointCapacity','null'::jsonb,
  'the base state without an owner has null capacity and cannot imply active room');
select is((select p.proconfig from pg_proc p where p.oid=
  'public.solmind_confirm_explorer_waypoint_revision_v1(uuid,uuid,uuid,uuid,integer,text,text,uuid,jsonb)'::regprocedure),
  array['search_path=""','lock_timeout=2000ms']::text[],
  'the revision RPC retains exactly its prior search path and lock timeout settings');
select is(ai.solmind_waypoint_active_count_v1(pg_temp.gid(1)),2::bigint,'closed heads consume no active place');
select is((select jsonb_agg(w->'id') from jsonb_array_elements(pg_temp.read_state()->'waypoints') w),
  (select ids from selection_golden),'state selection uses active first, newest closed and deterministic UUID ties');
select is(pg_temp.read_state()->'waypointProjection',
  '{"kind":"current_heads","limit":20,"totalHeads":24,"hasMore":true}'::jsonb,'state declares its partial projection');
select is((select jsonb_agg(w->'id') from jsonb_array_elements(pg_temp.compass_context()->'waypoints') w),
  (select ids from selection_golden),'SQL context selection equals the independent TypeScript golden');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(2)),
  'ordinary preparation accepts the selected context and its exact source set with more than twenty heads');
select ok((select cardinality(array(select x from unnest(source_ids) x where x=any(
  array(select waypoint_id from content.waypoint))))=20 from lifecycle_intent where slot=2),
  'context evidence includes only the twenty selected Waypoint source IDs');
select ok((select outcome='ok' and saved_reply from pg_temp.settle_private(2)),
  'bounded selection permits an ordinary saved reply without changing calling rules');
select ok((select jsonb_array_length(waypoint_page->'items')=20 and waypoint_page->>'nextOffset'='20'
  and waypoint_page->>'hasMore'='true' from public.solmind_read_explorer_waypoint_history_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),0)),
  'history returns twenty rows and explicit continuation');
select ok((select jsonb_array_length(waypoint_page->'items')=4 and waypoint_page->>'hasMore'='false'
  and waypoint_page->'nextOffset'='null'::jsonb from public.solmind_read_explorer_waypoint_history_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),20)),
  'the last history page preserves access to the oldest records');

create function pg_temp.revise(op_n integer,waypoint uuid,kind_name text default 'revise_waypoint')
returns text language sql as $$
  select outcome from public.solmind_confirm_explorer_waypoint_revision_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(op_n),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),
    pg_temp.request_sha(op_n),kind_name,waypoint,'[{"component":"meaning","answer":"Explicit revised meaning"}]')
$$;
create function pg_temp.fill_waypoints(first_n integer,last_n integer,reached boolean default false,conversation_n integer default 6005)
returns void language sql as $$
  insert into content.waypoint(waypoint_id,guide_explorer_relationship_id,source_ai_interaction_session_id,source_message_id,
    title,destination,why_it_matters,arrival_signal,lifecycle_status,chosen_by_explorer_user_account_id,chosen_at,
    reached_by_explorer_user_account_id,reached_at,reached_evidence)
  select pg_temp.gid(50000+n),pg_temp.gid(25),pg_temp.gid(conversation_n),
    case conversation_n when 6005 then pg_temp.gid(10011) when 8005 then pg_temp.gid(80051) else pg_temp.gid(70051) end,
    'Synthetic title','Synthetic destination','Synthetic meaning','Synthetic signal',
    case when reached then 'reached' else 'chosen' end,pg_temp.gid(1),clock_timestamp(),
    case when reached then pg_temp.gid(1) end,case when reached then clock_timestamp() end,
    case when reached then 'Explicit synthetic evidence' end from generate_series(first_n,last_n) n
$$;
create function pg_temp.end_current(op_n integer default 81000) returns text language sql as $$
  select outcome from public.solmind_end_explorer_conversation_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(op_n),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),pg_temp.request_sha(op_n))
$$;
create function pg_temp.start_second(known boolean default true,restricted boolean default false,adult boolean default false)
returns void language plpgsql as $$
begin
  insert into ai.ai_interaction_session(ai_interaction_session_id,session_type,actor_user_account_id,actor_role_context,
    guide_profile_id,explorer_profile_id,guide_explorer_relationship_id,practice_id,metadata)
  values(pg_temp.gid(7005),'explorer_reflection',pg_temp.gid(1),'explorer',pg_temp.gid(23),pg_temp.gid(24),pg_temp.gid(25),
    pg_temp.gid(22),jsonb_build_object('restricted_mode',restricted));
  insert into ai.explorer_conversation_state(conversation_id,actor_user_account_id,safety_contract_version,
    restricted_level,adult_reflection_stopped,safety_version)
  values(pg_temp.gid(7005),pg_temp.gid(1),case when known then 'explorer-conversation-safety.v1' end,
    case when restricted then 3 end,case when known then adult end,case when known then 0 end);
  insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
    sender_type,sender_user_account_id,sender_role_context,content_text)
  values(pg_temp.gid(70051),pg_temp.gid(7005),1,'user',pg_temp.gid(1),'explorer','Second conversation source.');
end $$;
-- Lane 12: 6005's base fixture holds 24 original Waypoints (the context-selection golden needs them), so a new Waypoint
-- can no longer be formed there. Scenarios that form new Waypoints run in a fresh second conversation (7005).
create function pg_temp.mutate_in(conv_n integer,op_n integer,kind_name text,source_n integer,
  destination_text text,meaning_text text,arrival_text text)
returns table(outcome text,conversation_state jsonb) language sql as $$
  select * from public.solmind_mutate_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(conv_n),
    pg_temp.gid(op_n),coalesce(
      (select initial_revision from ai.explorer_conversation_operation where actor_user_account_id=pg_temp.gid(1) and operation_id=pg_temp.gid(op_n)),
      (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(conv_n))),
    kind_name,pg_temp.request_sha(op_n),pg_temp.gid(source_n),null,null,null,destination_text,meaning_text,arrival_text,null)
$$;
create function pg_temp.revise_in(conv_n integer,op_n integer,waypoint uuid,kind_name text default 'revise_waypoint')
returns text language sql as $$
  select outcome from public.solmind_confirm_explorer_waypoint_revision_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(conv_n),
    pg_temp.gid(op_n),coalesce(
      (select initial_revision from ai.explorer_conversation_operation where actor_user_account_id=pg_temp.gid(1) and operation_id=pg_temp.gid(op_n)),
      (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(conv_n))),
    pg_temp.request_sha(op_n),kind_name,waypoint,'[{"component":"meaning","answer":"Explicit revised meaning"}]')
$$;
create function pg_temp.conversation_capacity(conv_n integer) returns jsonb language sql as $$
  select conversation_state->'waypointCapacity' from public.solmind_read_explorer_conversation_v3(
    pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(conv_n))
$$;
-- Lane 12: stored history rows as a revision chain (each row continues the one before), so a conversation can reach
-- the 200-version guard while holding few different Waypoints. Returns the chain's current head.
create function pg_temp.revision_chain(conv_n integer,source_n integer,root uuid,first_n integer,last_n integer)
returns uuid language plpgsql as $$
declare previous uuid:=root; n integer;
begin
  for n in first_n..last_n loop
    insert into content.waypoint(waypoint_id,guide_explorer_relationship_id,source_ai_interaction_session_id,source_message_id,
      title,destination,why_it_matters,arrival_signal,lifecycle_status,chosen_by_explorer_user_account_id,chosen_at,
      predecessor_waypoint_id,creation_reason)
    values(pg_temp.gid(52000+n),pg_temp.gid(25),pg_temp.gid(conv_n),pg_temp.gid(source_n),'Revised '||n,'Revised '||n,
      'Synthetic meaning','Synthetic signal','chosen',pg_temp.gid(1),clock_timestamp(),previous,'revision');
    previous:=pg_temp.gid(52000+n);
  end loop;
  return previous;
end $$;
-- Lane 12: Waypoints that only fill the active allowance live in their own ended conversation (8005), so the
-- five-per-conversation rule never decides a test about the active limit; the conversation under test (7005,
-- since 6005 already holds 24 originals) keeps its own few original Waypoints.
create function pg_temp.filler_conversation() returns void language plpgsql as $$
begin
  insert into ai.ai_interaction_session(ai_interaction_session_id,session_type,actor_user_account_id,actor_role_context,
    guide_profile_id,explorer_profile_id,guide_explorer_relationship_id,practice_id,metadata)
  values(pg_temp.gid(8005),'explorer_reflection',pg_temp.gid(1),'explorer',pg_temp.gid(23),pg_temp.gid(24),pg_temp.gid(25),
    pg_temp.gid(22),jsonb_build_object('restricted_mode',false));
  insert into ai.explorer_conversation_state(conversation_id,actor_user_account_id,safety_contract_version,
    restricted_level,adult_reflection_stopped,safety_version)
  values(pg_temp.gid(8005),pg_temp.gid(1),'explorer-conversation-safety.v1',null,false,0);
  insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
    sender_type,sender_user_account_id,sender_role_context,content_text)
  values(pg_temp.gid(80051),pg_temp.gid(8005),1,'user',pg_temp.gid(1),'explorer','Filler conversation source.');
  update ai.ai_interaction_session set session_status='ended',ended_at=clock_timestamp()
    where ai_interaction_session_id=pg_temp.gid(8005);
end $$;
create function pg_temp.capacity_case(kind_name text) returns jsonb language plpgsql as $$
declare result jsonb; saved text; before_count bigint; next_command text; i integer; a uuid; b uuid; c uuid;
begin
  begin
    -- Lane 12: each case runs in a fresh conversation (7005) holding three Waypoints of its own (A and C chosen, B
    -- Reached), well below five, so every refusal below is decided by the limit it names.
    if pg_temp.end_current(80090) is distinct from 'ok' then raise exception 'fixture_capacity_end'; end if;
    perform pg_temp.start_second();
    for i in 1..3 loop
      if (select outcome from pg_temp.mutate_in(7005,80090+i,'confirm_waypoint',70051,'Capacity '||i,'Capacity meaning',
        'Capacity signal'))<>'ok' then raise exception 'fixture_capacity_form'; end if;
    end loop;
    select w.waypoint_id into strict a from content.waypoint w where w.source_ai_interaction_session_id=pg_temp.gid(7005) and w.destination='Capacity 1';
    select w.waypoint_id into strict b from content.waypoint w where w.source_ai_interaction_session_id=pg_temp.gid(7005) and w.destination='Capacity 2';
    select w.waypoint_id into strict c from content.waypoint w where w.source_ai_interaction_session_id=pg_temp.gid(7005) and w.destination='Capacity 3';
    if (select outcome from public.solmind_mutate_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(7005),
      pg_temp.gid(80094),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(7005)),
      'confirm_reached',pg_temp.request_sha(80094),null,null,b,null,null,null,null,'Explicit evidence'))<>'ok'
      then raise exception 'fixture_capacity_reached'; end if;
    -- Active now: 6005's two chosen heads (still active after End) plus A and C.
    if kind_name='history' then a:=pg_temp.revision_chain(7005,70051,a,1,197);
    else perform pg_temp.filler_conversation();
      perform pg_temp.fill_waypoints(1,case when kind_name='grandfathered' then 17 else 16 end,false,8005); end if;
    before_count:=ai.solmind_waypoint_active_count_v1(pg_temp.gid(1));
    result:=jsonb_build_object('beforeCount',before_count,'capacity',pg_temp.conversation_capacity(7005),
      'storedBefore',(select count(*) from content.waypoint where source_ai_interaction_session_id=pg_temp.gid(7005)));
    select outcome into saved from pg_temp.mutate_in(7005,80001,'confirm_waypoint',70051,'New destination','New meaning','New signal');
    result:=result||jsonb_build_object('manual',saved);
    result:=result||jsonb_build_object('revision',pg_temp.revise_in(7005,80002,a));
    result:=result||jsonb_build_object('revisit',pg_temp.revise_in(7005,80003,b,'revisit_waypoint'));
    if kind_name='history' then
      select outcome into saved from public.solmind_mutate_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(7005),
        pg_temp.gid(80004),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(7005)),
        'confirm_reached',pg_temp.request_sha(80004),null,null,c,null,null,null,null,'Explicit evidence');
    else
      select outcome into saved from public.solmind_release_explorer_waypoint_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(7005),
        pg_temp.gid(80004),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(7005)),
        pg_temp.request_sha(80004),c);
    end if;
    result:=result||jsonb_build_object('closure',saved);
    result:=result||jsonb_build_object('afterCount',ai.solmind_waypoint_active_count_v1(pg_temp.gid(1)),
      'storedAfter',(select count(*) from content.waypoint where source_ai_interaction_session_id=pg_temp.gid(7005)));
    if kind_name='history' then
      select outcome into saved from public.solmind_release_explorer_waypoint_v1(
        pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(7005),pg_temp.gid(80005),
        (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(7005)),pg_temp.request_sha(80005),a);
      select outcome into next_command from public.solmind_end_explorer_conversation_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(7005),
        pg_temp.gid(80006),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(7005)),pg_temp.request_sha(80006));
      result:=result||jsonb_build_object('release',saved,'end',next_command,
        'storedEnd',(select count(*) from content.waypoint where source_ai_interaction_session_id=pg_temp.gid(7005)));
    end if;
    raise exception using errcode='P0710',message='rollback_synthetic_fixture';
  exception when sqlstate 'P0710' then null; end;
  return result;
end $$;

create temp table capacities as select name,pg_temp.capacity_case(name) value
from unnest(array['active','grandfathered','history']) name;
select ok((select value->>'manual'='unavailable' and value->>'revision'='ok' and value->>'revisit'='unavailable'
  and value->>'beforeCount'='20' and value#>>'{capacity,conversationRoom}'='true' and value#>>'{capacity,historyRoom}'='true'
  from capacities where name='active'),'at twenty, manual and revisit increases refuse while net-zero revision works');
select ok((select value->>'beforeCount'='21' and value->>'manual'='unavailable' and value->>'revision'='ok'
  and value->>'closure'='ok' and value->>'afterCount'='20' and value#>>'{capacity,conversationRoom}'='true'
  from capacities where name='grandfathered'),
  'grandfathered excess heads are retained, revisable and closable but cannot increase');
select ok((select value#>>'{capacity,historyRoom}'='false' and value#>>'{capacity,conversationRoom}'='true'
  and (value#>>'{capacity,activeCount}')::integer<20 and value->>'storedBefore'='200' and value->>'manual'='unavailable'
  and value->>'revision'='unavailable' and value->>'revisit'='unavailable'
  and value->>'closure'='ok' and value->>'release'='ok' and value->>'end'='ok' and value->>'storedAfter'='200'
  and value->>'storedEnd'='200' from capacities where name='history'),
  'the history guard refuses every insertion but preserves Reached, Release, End and all two hundred rows');

create function pg_temp.close_old(op_n integer,waypoint uuid,kind_name text default 'release_waypoint',
  actor_n integer default 1,session_n integer default 50,evidence text default null)
returns text language sql as $$
  select outcome from public.solmind_close_ended_explorer_waypoint_v1(pg_temp.gid(actor_n),pg_temp.gid(session_n),waypoint,
    pg_temp.gid(op_n),pg_temp.request_sha(op_n),kind_name,evidence)
$$;
create function pg_temp.closure_case(case_name text) returns jsonb language plpgsql as $$
declare result jsonb; before_state jsonb; saved text; replayed text; err text; duplicate_err text; head uuid:=pg_temp.sx(1000);
  actor_n integer:=1; session_n integer:=50; kind_name text:='release_waypoint'; evidence text;
  before_rows jsonb; before_audit bigint; before_transcript jsonb; before_waypoint jsonb;
  rewrite_err text; delete_err text; fingerprint_err text; session_err text;
begin
  begin
    if case_name='stale_head' then perform pg_temp.revise(81001,head); end if;
    if case_name='already_reached' then
      if (select outcome from public.solmind_mutate_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
        pg_temp.gid(81002),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),
        'confirm_reached',pg_temp.request_sha(81002),null,null,head,null,null,null,null,'Explicit evidence before End'))
        is distinct from 'ok' then raise exception 'fixture_reached'; end if;
    elsif case_name='already_released' then
      if (select outcome from public.solmind_release_explorer_waypoint_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
        pg_temp.gid(81002),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),
        pg_temp.request_sha(81002),head)) is distinct from 'ok' then raise exception 'fixture_released'; end if;
    end if;
    if case_name in ('reached','already_reached','restricted_reached','adult_reached','current_restricted','current_unknown','current_adult','no_evidence') then
      kind_name:='reach_waypoint'; evidence:='I reviewed the explicit arrival evidence.'; end if;
    if case_name like 'restricted_%' then perform pg_temp.observe(91,3,false); end if;
    if case_name like 'adult_%' then perform pg_temp.observe(91,0,true); end if;
    if case_name<>'active_source' then
      if pg_temp.end_current() is distinct from 'ok' then raise exception 'fixture_end'; end if;
    end if;
    result:=jsonb_build_object('noConversationCapacity',(select conversation_state->'waypointCapacity'
      from public.solmind_read_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50))));
    if case_name='global' then perform pg_temp.start_second(); perform pg_temp.filler_conversation();
      perform pg_temp.fill_waypoints(1,17,false,8005); perform pg_temp.fill_waypoints(18,18,false,7005); end if;
    if case_name in ('current_restricted','current_unknown','current_adult') then
      perform pg_temp.start_second(case_name<>'current_unknown',case_name='current_restricted',case_name='current_adult'); end if;
    if case_name='historical_relationship' then
      update core.guide_explorer_relationship set relationship_status='ended',ended_at=clock_timestamp() where guide_explorer_relationship_id=pg_temp.gid(25);
      insert into core.guide_explorer_relationship(guide_explorer_relationship_id,guide_profile_id,explorer_profile_id,practice_id,relationship_status,started_at)
      values(pg_temp.gid(925),pg_temp.gid(23),pg_temp.gid(24),pg_temp.gid(22),'active',clock_timestamp());
      insert into core.intake_response_set(intake_response_set_id,guide_explorer_relationship_id,started_at,completed_at,intake_status,response_json)
      select pg_temp.gid(952),pg_temp.gid(925),clock_timestamp(),clock_timestamp(),'completed',response_json from core.intake_response_set where intake_response_set_id=pg_temp.gid(52);
      result:=result||jsonb_build_object('readPrior',(select outcome from public.solmind_read_explorer_waypoint_history_v1(
        pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),0)));
    end if;
    -- Each current-head row says whether its own source conversation has ended (migration 20261106050000).
    result:=result||jsonb_build_object('headsEnded',(select jsonb_object_agg(i->>'id',i->'conversationEnded')
        from public.solmind_read_explorer_waypoint_heads_v1(pg_temp.gid(1),pg_temp.gid(50),0) r,
          jsonb_array_elements(r.waypoint_page->'items') i),
      -- Every row has the fact, both conversations are on the page, and each row matches its own conversation.
      'headsSplit',(select coalesce(bool_and(coalesce((i->>'conversationEnded')::boolean
            =(i->>'conversationId'<>pg_temp.gid(7005)::text),false)),false)
          and count(*) filter (where not (i ? 'conversationEnded'))=0
          and count(*) filter (where i->>'conversationId'=pg_temp.gid(7005)::text)>0
          and count(*) filter (where i->>'conversationId'<>pg_temp.gid(7005)::text)>0
        from public.solmind_read_explorer_waypoint_heads_v1(pg_temp.gid(1),pg_temp.gid(50),0) r,
          jsonb_array_elements(r.waypoint_page->'items') i),
      'historyHasNoEndedFact',(select bool_and(not (i ? 'conversationEnded'))
        from public.solmind_read_explorer_waypoint_history_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),0) r,
          jsonb_array_elements(r.waypoint_page->'items') i));
    if case_name='wrong_actor' then actor_n:=4; session_n:=54;
    elsif case_name='guide' then actor_n:=2; session_n:=56;
    elsif case_name='expired' then update identity.user_session set expires_at=clock_timestamp()-interval '1 minute' where user_session_id=pg_temp.gid(50);
    elsif case_name='revoked' then update identity.user_role_assignment set role_status='revoked',revoked_at=clock_timestamp() where user_role_assignment_id=pg_temp.gid(11);
    elsif case_name='consent' then delete from core.consent_record where consent_record_id=pg_temp.gid(41);
    elsif case_name='no_evidence' then evidence:=null;
    elsif case_name='audit_failure' then perform set_config('solmind.fixture.fail_release_audit','yes',true);
    end if;
    select jsonb_build_object('session',to_jsonb(s),'state',to_jsonb(st)) into before_state
      from ai.ai_interaction_session s join ai.explorer_conversation_state st on st.conversation_id=s.ai_interaction_session_id
      where s.ai_interaction_session_id=pg_temp.gid(6005);
    select jsonb_agg(to_jsonb(o) order by o.operation_id) into before_rows from ai.explorer_conversation_operation o where conversation_id=pg_temp.gid(6005);
    select jsonb_agg(to_jsonb(m) order by m.sequence_number) into before_transcript from ai.ai_interaction_message m where ai_interaction_session_id=pg_temp.gid(6005);
    select count(*) into before_audit from audit.audit_event where target_entity_id=head;
    select to_jsonb(w) into before_waypoint from content.waypoint w where waypoint_id=head;
    if case_name='global' then
      result:=result||jsonb_build_object('globalBefore',ai.solmind_waypoint_active_count_v1(pg_temp.gid(1)),
        'blockedBefore',(select outcome from public.solmind_mutate_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(7005),
          pg_temp.gid(82001),0,'confirm_waypoint',pg_temp.request_sha(82001),pg_temp.gid(70051),null,null,null,'New','Meaning','Signal',null)));
    end if;
    begin saved:=pg_temp.close_old(82000,head,kind_name,actor_n,session_n,evidence);
    exception when raise_exception then err:=sqlerrm; end;
    if saved='ok' then
      replayed:=pg_temp.close_old(82000,head,kind_name,actor_n,session_n,evidence);
      begin update content.waypoint_post_end_closure set completed_at=completed_at+interval '1 second' where waypoint_id=head;
      exception when raise_exception then rewrite_err:=sqlerrm; end;
      begin delete from content.waypoint_post_end_closure where waypoint_id=head;
      exception when raise_exception then delete_err:=sqlerrm; end;
      begin perform * from public.solmind_close_ended_explorer_waypoint_v1(pg_temp.gid(actor_n),pg_temp.gid(session_n),head,
        pg_temp.gid(82000),repeat('C',64),kind_name,evidence);
      exception when raise_exception then fingerprint_err:=sqlerrm; end;
      begin perform pg_temp.close_old(82000,head,kind_name,actor_n,54,evidence);
      exception when raise_exception then session_err:=sqlerrm; end;
      begin perform pg_temp.close_old(82002,head,case when kind_name='reach_waypoint' then 'release_waypoint' else 'reach_waypoint' end,
        actor_n,session_n,case when kind_name='release_waypoint' then 'Competing evidence' end);
      exception when raise_exception then duplicate_err:=sqlerrm; end;
    end if;
    result:=result||jsonb_build_object('outcome',saved,'error',err,'replay',replayed,'competingError',duplicate_err,
      'closureCount',(select count(*) from content.waypoint_post_end_closure where waypoint_id=head),
      'auditDelta',(select count(*) from audit.audit_event where target_entity_id=head)-before_audit,
      'waypointUnchanged',before_waypoint=(select to_jsonb(w) from content.waypoint w where waypoint_id=head),
      'rewriteError',rewrite_err,'deleteError',delete_err,'fingerprintError',fingerprint_err,'sessionError',session_err,
      'afterCount',ai.solmind_waypoint_active_count_v1(pg_temp.gid(1)),
      'sourceUnchanged',before_state=(select jsonb_build_object('session',to_jsonb(s),'state',to_jsonb(st))
        from ai.ai_interaction_session s join ai.explorer_conversation_state st on st.conversation_id=s.ai_interaction_session_id
        where s.ai_interaction_session_id=pg_temp.gid(6005)),
      'routeUnchanged',before_rows=(select jsonb_agg(to_jsonb(o) order by o.operation_id) from ai.explorer_conversation_operation o where conversation_id=pg_temp.gid(6005)),
      'transcriptUnchanged',before_transcript=(select jsonb_agg(to_jsonb(m) order by m.sequence_number) from ai.ai_interaction_message m where ai_interaction_session_id=pg_temp.gid(6005)),
      'recordedAtEnd',ai.solmind_waypoint_row_json_v1(head,false),'effective',ai.solmind_waypoint_row_json_v1(head,true));
    if case_name='global' then
      result:=result||jsonb_build_object('newAfter',(select outcome from public.solmind_mutate_explorer_conversation_v3(
        pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(7005),pg_temp.gid(82001),0,'confirm_waypoint',pg_temp.request_sha(82001),
        pg_temp.gid(70051),null,null,null,'New','Meaning','Signal',null)),
        'replayAfterCapacity',pg_temp.close_old(82000,head));
    end if;
    raise exception using errcode='P0711',message='rollback_synthetic_fixture';
  exception when sqlstate 'P0711' then null; end;
  return result;
end $$;
create temp table closures as select name,pg_temp.closure_case(name) value from unnest(array[
  'release','reached','global','historical_relationship','stale_head','wrong_actor','guide','expired','revoked','consent',
  'restricted_release','restricted_reached','adult_release','adult_reached','current_restricted','current_unknown','current_adult',
  'no_evidence','audit_failure','active_source','already_reached','already_released']) name;
select ok((select bool_and(value->>'outcome'='ok' and value->>'replay'='exact_replay' and value->>'closureCount'='1'
  and value->>'auditDelta'='1' and value->>'competingError'='solmind_explorer_private_operation_conflict')
  from closures where name in ('release','reached','global','historical_relationship','restricted_release','adult_release')),
  'eligible post-End closures and authenticated replay commit one terminal fact and audit only');
select ok((select bool_and(value->>'sourceUnchanged'='true' and value->>'routeUnchanged'='true' and value->>'transcriptUnchanged'='true'
  and value->>'waypointUnchanged'='true')
  from closures),'all closure success and failure cases preserve the original End time/revision, policy, Route and transcript');
select ok((select bool_and(value->>'rewriteError'='solmind_explorer_private_immutable'
  and value->>'deleteError'='solmind_explorer_private_immutable'
  and value->>'fingerprintError'='solmind_explorer_private_operation_conflict' and value->>'sessionError' is not null)
  from closures where value->>'outcome'='ok'),
  'closure facts are append-only and exact replay binds fingerprint and currently authenticated session');
select ok((select value#>>'{noConversationCapacity,activeCount}'='2' and value#>>'{noConversationCapacity,historyRoom}'='true'
  from closures where name='release'),'capacity is supplied across ended conversations even with no active conversation');
select ok((select value->>'globalBefore'='20' and value->>'blockedBefore'='unavailable' and value->>'afterCount'='19'
  and value->>'newAfter'='ok' and value->>'replayAfterCapacity'='exact_replay' from closures where name='global'),
  'global capacity spans conversations and post-End closure frees exactly one place with replay after capacity changes');
select ok((select value->'headsEnded'->>(pg_temp.sx(1000)::text)='true' from closures where name='historical_relationship'),
  'a head from an ended conversation in an earlier Guide relationship is marked ended on the current-head page');
select ok((select value->'headsEnded'->>(pg_temp.sx(1000)::text)='false' and value->>'historyHasNoEndedFact'='true'
  from closures where name='active_source'),
  'a head from a conversation that has not ended is marked not ended, and history pages carry no ended fact');
select ok((select value->>'headsSplit'='true' from closures where name='global'),
  'with one ended and one open conversation, every current-head row carries its own conversation''s ended fact');
select ok((select p.prosecdef and pg_get_userbyid(p.proowner)='postgres' and p.proconfig=array['search_path=""']
  and not has_function_privilege('anon',p.oid,'execute') and not has_function_privilege('authenticated',p.oid,'execute')
  and not has_function_privilege('service_role',p.oid,'execute')
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='ai' and p.proname='solmind_waypoint_page_v1'),
  'the replaced page helper keeps security definer, owner postgres, an empty search path and no API-role execute');
select ok((select value->>'readPrior'='ok' and value->>'outcome'='ok' from closures where name='historical_relationship'),
  'fresh current eligibility permits only owner-private history and closure across earlier relationships');
select ok((select bool_and(value->>'outcome' is null and value->>'error' is not null and value->>'closureCount'='0' and value->>'auditDelta'='0')
  from closures where name in ('stale_head','wrong_actor','guide','expired','revoked','consent','restricted_reached','adult_reached',
    'current_restricted','current_unknown','current_adult','no_evidence','audit_failure')),
  'ownership, fresh authority, source/current policy, explicit evidence and audit failure all refuse atomically');
select ok((select value->>'outcome' is null and value->>'error'='solmind_explorer_private_denied'
  and value->>'closureCount'='0' and value->>'auditDelta'='0' from closures where name='active_source'),
  'post-End closure refuses an active source conversation without a closure fact or audit');
select ok((select value->>'outcome' is null and value->>'error'='solmind_explorer_private_operation_conflict'
  and value->>'closureCount'='0' and value->>'auditDelta'='0' and value#>>'{recordedAtEnd,status}'='reached'
  from closures where name='already_reached'),
  'a head already Reached inside its conversation conflicts after End without a closure fact or audit');
select ok((select value->>'outcome' is null and value->>'error'='solmind_explorer_private_operation_conflict'
  and value->>'closureCount'='0' and value->>'auditDelta'='0' and value->'recordedAtEnd' ? 'release'
  from closures where name='already_released'),
  'a head already Released inside its conversation conflicts after End without a closure fact or audit');
select ok((select value#>>'{recordedAtEnd,status}'='chosen' and value#>>'{effective,status}'='reached'
  and value#>>'{effective,reachedEvidence}'='I reviewed the explicit arrival evidence.' from closures where name='reached'),
  'post-End Reached resolves only portfolio status with exact evidence while ended state keeps its original fact');
select ok((select not(value->'recordedAtEnd' ? 'release') and value->'effective' ? 'release' from closures where name='release'),
  'post-End Release leaves the original Waypoint fact intact');

select throws_ok($$select * from public.solmind_read_explorer_waypoint_history_v1(pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6005),0)$$,
  'P0001','solmind_explorer_private_denied','another Explorer cannot read the history page');
select throws_ok($$select * from public.solmind_read_explorer_waypoint_heads_v1(pg_temp.gid(2),pg_temp.gid(56),0)$$,
  'P0001',null,'a Guide gains no private portfolio read');
select throws_ok($$select * from public.solmind_read_explorer_waypoint_heads_v1(pg_temp.gid(1),pg_temp.gid(50),-1)$$,
  'P0001','solmind_explorer_private_invalid_input','negative page offsets fail closed');
select ok((select c.relrowsecurity and not exists(select 1 from pg_policy p where p.polrelid=c.oid)
  from pg_class c where c.oid='content.waypoint_post_end_closure'::regclass)
  and not has_table_privilege('service_role','content.waypoint_post_end_closure','SELECT,INSERT,UPDATE,DELETE'),
  'post-End facts have RLS, zero policies and no direct service table privileges');
select ok(not exists(select 1 from unnest(array['anon','authenticated','service_role']) r(name)
  where has_function_privilege(r.name,'ai.solmind_waypoint_active_count_v1(uuid)','EXECUTE')
    or has_function_privilege(r.name,'ai.solmind_waypoint_policy_v1()','EXECUTE')),
  'count and policy helpers are protected from API roles');
select ok((select bool_and(p.prosecdef and p.proowner='postgres'::regrole
  and p.proconfig @> array['search_path=""','lock_timeout=2000ms','statement_timeout=5000ms']
  and has_function_privilege('service_role',p.oid,'EXECUTE')
  and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE'))
  from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in (
    'solmind_read_explorer_waypoint_heads_v1','solmind_read_explorer_waypoint_history_v1','solmind_close_ended_explorer_waypoint_v1')),
  'all new RPCs retain service-only execution, empty paths and bounded timeouts');
create function pg_temp.unknown_closure(kind_name text) returns jsonb language plpgsql as $$
declare result jsonb; saved text; err text;
begin
  begin
    insert into ai.ai_interaction_session(ai_interaction_session_id,session_type,actor_user_account_id,actor_role_context,
      guide_profile_id,explorer_profile_id,guide_explorer_relationship_id,practice_id,session_status,ended_at)
    values(pg_temp.gid(9005),'explorer_reflection',pg_temp.gid(4),'explorer',pg_temp.gid(23),pg_temp.gid(26),pg_temp.gid(27),
      pg_temp.gid(22),'ended',clock_timestamp());
    insert into ai.explorer_conversation_state(conversation_id,actor_user_account_id) values(pg_temp.gid(9005),pg_temp.gid(4));
    insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
      sender_type,sender_user_account_id,sender_role_context,content_text)
    values(pg_temp.gid(90051),pg_temp.gid(9005),1,'user',pg_temp.gid(4),'explorer','Legacy owned source.');
    insert into content.waypoint(waypoint_id,guide_explorer_relationship_id,source_ai_interaction_session_id,source_message_id,
      title,destination,why_it_matters,arrival_signal,lifecycle_status,chosen_by_explorer_user_account_id,chosen_at)
    values(pg_temp.gid(90052),pg_temp.gid(27),pg_temp.gid(9005),pg_temp.gid(90051),'Old','Old','Meaning','Signal','chosen',pg_temp.gid(4),clock_timestamp());
    begin saved:=pg_temp.close_old(90053,pg_temp.gid(90052),kind_name,4,54,
      case when kind_name='reach_waypoint' then 'Explicit synthetic evidence' end);
    exception when raise_exception then err:=sqlerrm; end;
    result:=jsonb_build_object('outcome',saved,'error',err,'policy',ai.solmind_private_policy_v3(pg_temp.gid(9005)),
      'count',ai.solmind_waypoint_active_count_v1(pg_temp.gid(4)));
    raise exception using errcode='P0712',message='rollback_synthetic_fixture';
  exception when sqlstate 'P0712' then null; end;
  return result;
end $$;
select ok((select value->>'outcome'='ok' and value->>'count'='0' and value#>>'{policy,known}'='false'
  from (select pg_temp.unknown_closure('release_waypoint') value) x),
  'unknown-policy post-End Release retains unknown policy and frees its active place');
select ok((select value->>'error'='solmind_explorer_private_denied' and value->>'count'='1' and value#>>'{policy,known}'='false'
  from (select pg_temp.unknown_closure('reach_waypoint') value) x),
  'unknown-policy post-End Reached fails closed despite explicit evidence');
select ok(not methodology.serialized_methodology_valid(replace(pg_temp.compact(pg_temp.context_value(pg_temp.gid(9999),'Synthetic text')),
  'compass-v7','compass-v5'),pg_temp.gid(1001),(select content_markdown from methodology.methodology_context_pack_version where methodology_context_pack_version_id=pg_temp.gid(1001))),
  'the prior compass-v5 envelope is refused for new ordinary turns');
create function pg_temp.capacity_replays() returns jsonb language plpgsql as $$
declare result jsonb; before_state jsonb; manual text; revision text; draft text; expected integer; formed uuid;
begin
  begin
    if pg_temp.end_current(85099) is distinct from 'ok' then raise exception 'fixture_replay_end'; end if;
    perform pg_temp.start_second();
    insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
      sender_type,ai_role,content_text)
    values(pg_temp.gid(70052),pg_temp.gid(7005),2,'ai','solmind_virtual_guide','Second conversation Guide reply.');
    if (select outcome from pg_temp.mutate_in(7005,85000,'confirm_waypoint',70051,'New destination','New meaning','New signal'))<>'ok'
      then raise exception 'fixture_replay_setup'; end if;
    select w.waypoint_id into formed from content.waypoint w where w.source_ai_interaction_session_id=pg_temp.gid(7005);
    if pg_temp.revise_in(7005,85001,formed)<>'ok' then raise exception 'fixture_replay_revise'; end if;
    -- An actual saved reply provides the source; the guarded synthetic setup
    -- exposes it as settlement does before installing the proposed draft.
    -- Synthetic: 7005's completed send is a copy of 6005's settled send (operation 10020), pointed at 7005's own
    -- source and saved Guide reply, so the draft below has a saved reply in its own conversation.
    insert into ai.explorer_conversation_operation select (jsonb_populate_record(null::ai.explorer_conversation_operation,
      to_jsonb(o)||jsonb_build_object('operation_id',pg_temp.gid(70059),'conversation_id',pg_temp.gid(7005),
        'message_id',pg_temp.gid(70051),'reply_message_id',pg_temp.gid(70052)))).*
      from ai.explorer_conversation_operation o where o.actor_user_account_id=pg_temp.gid(1) and o.operation_id=pg_temp.gid(10020);
    update ai.explorer_conversation_state set pending_operation_id=pg_temp.gid(70059) where conversation_id=pg_temp.gid(7005);
    insert into content.waypoint_draft(waypoint_draft_id,guide_explorer_relationship_id,source_ai_interaction_session_id,
      title,destination,why_it_matters,arrival_signal,source_message_id,suggestion_message_id)
    values(pg_temp.gid(85010),pg_temp.gid(25),pg_temp.gid(7005),'Draft title','Draft destination','Draft meaning','Draft signal',pg_temp.gid(70052),pg_temp.gid(70052));
    update ai.explorer_conversation_state set pending_operation_id=null where conversation_id=pg_temp.gid(7005);
    select st.revision into expected from ai.explorer_conversation_state st where st.conversation_id=pg_temp.gid(7005);
    if (select outcome from public.solmind_respond_explorer_waypoint_draft_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(7005),
      pg_temp.gid(85002),expected,pg_temp.request_sha(85002),pg_temp.gid(85010),'right'))<>'ok' then raise exception 'fixture_replay_draft'; end if;
    perform pg_temp.filler_conversation(); perform pg_temp.fill_waypoints(1,17,false,8005);
    before_state:=(select conversation_state from public.solmind_read_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(7005)));
    select outcome into manual from pg_temp.mutate_in(7005,85000,'confirm_waypoint',70051,'New destination','New meaning','New signal');
    select pg_temp.revise_in(7005,85001,formed) into revision;
    select outcome into draft from public.solmind_respond_explorer_waypoint_draft_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(7005),
      pg_temp.gid(85002),expected,pg_temp.request_sha(85002),pg_temp.gid(85010),'right');
    result:=jsonb_build_object('manual',manual,'revision',revision,'draft',draft,
      'activeCount',ai.solmind_waypoint_active_count_v1(pg_temp.gid(1)),
      'unchanged',before_state=(select conversation_state from public.solmind_read_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(7005))));
    raise exception using errcode='P0713',message='rollback_synthetic_fixture';
  exception when sqlstate 'P0713' then null; end;
  return result;
end $$;
select ok((select value->>'activeCount'='21' and value->>'manual'='exact_replay' and value->>'revision'='exact_replay'
  and value->>'draft'='exact_replay' and value->>'unchanged'='true' from (select pg_temp.capacity_replays() value) x),
  'authenticated manual, revision and draft replays return before capacity refusal even after the count grows beyond twenty');
create function pg_temp.post_end_context_canary() returns jsonb language plpgsql as $$
declare result jsonb; original_ended jsonb; original_waypoint jsonb; envelope jsonb; ordinary text; classification text;
  source_ids uuid[]; injected_ids uuid[]; ordinary_result text; classification_result text;
  ordinary_injected text; classification_injected text;
  evidence constant text:='Lane 7 older private arrival evidence canary ZQX.';
begin
  begin
    if pg_temp.end_current(87000) is distinct from 'ok' then raise exception 'fixture_canary_end'; end if;
    -- Capacity is a live account value, not a fact frozen by End. All saved
    -- conversation/ending/Route/Waypoint display facts stay byte-for-byte equal.
    original_ended:=ai.solmind_conversation_state_json(pg_temp.gid(6005))-'waypointCapacity';
    select to_jsonb(w) into original_waypoint from content.waypoint w where waypoint_id=pg_temp.sx(1000);
    if pg_temp.close_old(87001,pg_temp.sx(1000),'reach_waypoint',1,50,evidence) is distinct from 'ok'
      then raise exception 'fixture_canary_closure'; end if;
    if not exists(select 1 from pg_temp.ensure_anchor(7005) where outcome='created')
      then raise exception 'fixture_canary_new_conversation'; end if;
    -- Independent exact ordinary envelope for the new, empty conversation.
    -- The current source set contains intake, methodology and immediate message
    -- only; no portfolio or prior-conversation source is newly authorized.
    envelope:=pg_temp.context_value(pg_temp.gid(87011),'Synthetic new conversation only.');
    envelope:=jsonb_set(envelope,'{sessionContext,sessionId}',to_jsonb(pg_temp.gid(7005)));
    envelope:=jsonb_set(envelope,'{immediateExplorerMessage,sessionId}',to_jsonb(pg_temp.gid(7005)));
    envelope:=jsonb_set(envelope,'{currentSessionMessages}','[]'::jsonb);
    envelope:=jsonb_set(envelope,'{compassContext}',jsonb_build_object('version','explorer-compass-context.v7','immediateMessageIsReplyChoice',false,
      'points','[]'::jsonb,'priorityId',null,'attentionId',null,'recentRoute','[]'::jsonb,
      'waypoints','[]'::jsonb,'drafts','[]'::jsonb));
    ordinary:=pg_temp.compact(envelope);
    select array_agg(id order by id) into source_ids from unnest(array[pg_temp.gid(52),pg_temp.gid(1001),pg_temp.gid(87011)]) id;
    select array_agg(id order by id) into injected_ids from unnest(source_ids||array[pg_temp.sx(1000),pg_temp.gid(87001)]) id;
    select outcome into ordinary_result from ai.solmind_inspect_explorer_context_v3(pg_temp.gid(1),pg_temp.gid(50),
      pg_temp.gid(24),pg_temp.gid(25),pg_temp.gid(7005),ordinary,source_ids);
    select outcome into ordinary_injected from ai.solmind_inspect_explorer_context_v3(pg_temp.gid(1),pg_temp.gid(50),
      pg_temp.gid(24),pg_temp.gid(25),pg_temp.gid(7005),ordinary,injected_ids);
    if not exists(select 1 from public.solmind_observe_explorer_conversation_fallback_v3(pg_temp.gid(1),pg_temp.gid(50),
      pg_temp.gid(7005),pg_temp.gid(87020),pg_temp.gid(87024),0,pg_temp.request_sha(87020),'explorer-safety-reply.v2',
      'synthetic-fallback.v1','synthetic-model-policy.v1',repeat('A',64),3::smallint,false) where outcome='ok')
      then raise exception 'fixture_canary_classification_policy'; end if;
    envelope:=jsonb_set(envelope-'compassContext','{contractVersion}',to_jsonb('wi007-v0.1+onboarding-fields-v2'::text));
    classification:=pg_temp.compact(envelope);
    select outcome into classification_result from ai.solmind_inspect_explorer_context_v3(pg_temp.gid(1),pg_temp.gid(50),
      pg_temp.gid(24),pg_temp.gid(25),pg_temp.gid(7005),classification,source_ids);
    select outcome into classification_injected from ai.solmind_inspect_explorer_context_v3(pg_temp.gid(1),pg_temp.gid(50),
      pg_temp.gid(24),pg_temp.gid(25),pg_temp.gid(7005),classification,injected_ids);
    result:=jsonb_build_object('ordinary',ordinary_result,'classification',classification_result,
      'ordinaryInjected',ordinary_injected,'classificationInjected',classification_injected,
      'ordinaryClean',strpos(ordinary,evidence)=0 and strpos(ordinary,pg_temp.sx(1000)::text)=0
        and strpos(ordinary,pg_temp.gid(87001)::text)=0 and strpos(ordinary,pg_temp.gid(6005)::text)=0,
      'classificationClean',strpos(classification,evidence)=0 and strpos(classification,pg_temp.sx(1000)::text)=0
        and strpos(classification,pg_temp.gid(87001)::text)=0 and strpos(classification,pg_temp.gid(6005)::text)=0
        and not(envelope ? 'compassContext'),
      'sourcesClean',cardinality(source_ids)=3 and not(pg_temp.sx(1000)=any(source_ids)) and not(pg_temp.gid(87001)=any(source_ids)),
      'endedUnchanged',original_ended=ai.solmind_conversation_state_json(pg_temp.gid(6005))-'waypointCapacity',
      'waypointUnchanged',original_waypoint=(select to_jsonb(w) from content.waypoint w where waypoint_id=pg_temp.sx(1000)),
      'closureEvidence',(select reached_evidence from content.waypoint_post_end_closure where waypoint_id=pg_temp.sx(1000)));
    raise exception using errcode='P0714',message='rollback_synthetic_fixture';
  exception when sqlstate 'P0714' then null; end;
  return result;
end $$;
create temp table context_canary as select pg_temp.post_end_context_canary() value;
select ok((select value->>'ordinary'='clear' and value->>'ordinaryClean'='true' and value->>'sourcesClean'='true'
  from context_canary),'a new ordinary context and its exact source IDs omit older post-End evidence and identifiers');
select ok((select value->>'classification'='clear' and value->>'classificationClean'='true'
  and value->>'ordinaryInjected'='unavailable' and value->>'classificationInjected'='unavailable' from context_canary),
  'classification context retains its exclusions and neither mode accepts old Waypoint or closure source IDs');
select ok((select value->>'endedUnchanged'='true' and value->>'waypointUnchanged'='true'
  and value->>'closureEvidence'='Lane 7 older private arrival evidence canary ZQX.' from context_canary),
  'the closure evidence remains private while every original ended-conversation and Waypoint fact remains unchanged');
-- Lane 12: at most five different Waypoints form in one conversation, counting Reached and Released ones.
create function pg_temp.five_case() returns jsonb language plpgsql as $$
declare result jsonb; i integer; saved text; before_state jsonb; second_id uuid; third_id uuid; fourth_id uuid;
begin
  begin
    -- 6005 already holds 24 different Waypoints from before this rule (2 chosen, 22 Reached). All are kept; nothing new
    -- may form there, while a revision and a revisit, which continue an existing Waypoint, still work.
    result:=jsonb_build_object('legacyCapacity',pg_temp.conversation_capacity(6005),
      'legacyHeads',pg_temp.read_state()#>'{waypointProjection,totalHeads}',
      'legacyManual',(select outcome from pg_temp.mutate(86000,'confirm_waypoint',10011,null,null,null,
        'Legacy new destination','Legacy new meaning','Legacy new signal')));
    result:=result||jsonb_build_object('legacyRevision',pg_temp.revise(86001,pg_temp.sx(1000)),
      'legacyRevisit',pg_temp.revise(86002,pg_temp.sx(1002),'revisit_waypoint'));
    result:=result||jsonb_build_object('legacyActive',ai.solmind_waypoint_active_count_v1(pg_temp.gid(1)));
    if pg_temp.end_current(86003) is distinct from 'ok' then raise exception 'fixture_five_end'; end if;
    perform pg_temp.start_second();
    for i in 1..4 loop
      if (select outcome from pg_temp.mutate_in(7005,86010+i,'confirm_waypoint',70051,
        'Five destination '||i,'Five meaning','Five signal'))<>'ok' then raise exception 'fixture_five_form'; end if;
    end loop;
    result:=result||jsonb_build_object('fourCapacity',pg_temp.conversation_capacity(7005));
    -- A separately formed Waypoint with the same wording as the first is still a different Waypoint.
    select outcome into saved from pg_temp.mutate_in(7005,86015,'confirm_waypoint',70051,'Five destination 1','Five meaning','Five signal');
    result:=result||jsonb_build_object('fifth',saved,'fiveCapacity',pg_temp.conversation_capacity(7005));
    before_state:=(select conversation_state from public.solmind_read_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(7005)));
    select outcome into saved from pg_temp.mutate_in(7005,86016,'confirm_waypoint',70051,'Sixth destination','Sixth meaning','Sixth signal');
    result:=result||jsonb_build_object('sixth',saved,
      'sixthUnchanged',before_state=(select conversation_state from public.solmind_read_explorer_conversation_v3(
        pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(7005))),
      'fifthReplay',(select outcome from pg_temp.mutate_in(7005,86015,'confirm_waypoint',70051,'Five destination 1','Five meaning','Five signal')),
      'activeAtSixth',ai.solmind_waypoint_active_count_v1(pg_temp.gid(1)));
    -- Reached and Released Waypoints keep their places; a revision continues one and uses none.
    select w.waypoint_id into second_id from content.waypoint w where w.source_ai_interaction_session_id=pg_temp.gid(7005) and w.destination='Five destination 2';
    select w.waypoint_id into third_id from content.waypoint w where w.source_ai_interaction_session_id=pg_temp.gid(7005) and w.destination='Five destination 3';
    select w.waypoint_id into fourth_id from content.waypoint w where w.source_ai_interaction_session_id=pg_temp.gid(7005) and w.destination='Five destination 4';
    result:=result||jsonb_build_object('revision',pg_temp.revise_in(7005,86017,second_id));
    select outcome into saved from public.solmind_release_explorer_waypoint_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(7005),
      pg_temp.gid(86018),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(7005)),
      pg_temp.request_sha(86018),third_id);
    result:=result||jsonb_build_object('release',saved);
    select outcome into saved from public.solmind_mutate_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(7005),
      pg_temp.gid(86019),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(7005)),
      'confirm_reached',pg_temp.request_sha(86019),null,null,fourth_id,null,null,null,null,'Explicit evidence');
    result:=result||jsonb_build_object('reached',saved);
    select outcome into saved from pg_temp.mutate_in(7005,86020,'confirm_waypoint',70051,'Seventh destination','Seventh meaning','Seventh signal');
    result:=result||jsonb_build_object('afterClosures',saved,
      'originals',(select count(*) from content.waypoint where source_ai_interaction_session_id=pg_temp.gid(7005)
        and predecessor_waypoint_id is null),
      'rows',(select count(*) from content.waypoint where source_ai_interaction_session_id=pg_temp.gid(7005)),
      'active',ai.solmind_waypoint_active_count_v1(pg_temp.gid(1)),'finalCapacity',pg_temp.conversation_capacity(7005));
    raise exception using errcode='P0714',message='rollback_synthetic_fixture';
  exception when sqlstate 'P0714' then null; end;
  return result;
end $$;
create temp table five as select pg_temp.five_case() value;
select ok((select value#>>'{legacyCapacity,conversationRoom}'='false' and value#>>'{legacyCapacity,historyRoom}'='true'
  and value#>>'{legacyCapacity,activeCount}'='2' and value->>'legacyHeads'='24' from five),
  'lane 12: a conversation already above five keeps all 24 Waypoints and reports no room for another');
select ok((select value->>'legacyManual'='unavailable' and value->>'legacyRevision'='ok' and value->>'legacyRevisit'='ok'
  and value->>'legacyActive'='3' from five),
  'lane 12: above five, a new Waypoint is refused while a revision and a revisit still work');
select ok((select value#>>'{fourCapacity,conversationRoom}'='true' and value->>'fifth'='ok'
  and value#>>'{fiveCapacity,conversationRoom}'='false' from five),
  'lane 12: four leave room; a fifth with the same wording as an earlier one is separate and fills the conversation');
select ok((select value->>'sixth'='unavailable' and value->>'sixthUnchanged'='true' and value->>'fifthReplay'='exact_replay'
  and (value->>'activeAtSixth')::integer<20 from five),
  'lane 12: a sixth is refused below the active allowance, changes nothing, and an exact replay of the fifth still answers');
select ok((select value->>'revision'='ok' and value->>'release'='ok' and value->>'reached'='ok'
  and value->>'afterClosures'='unavailable' and value->>'originals'='5' and value->>'rows'='6' and value->>'active'='6'
  and value#>>'{finalCapacity,conversationRoom}'='false' from five),
  'lane 12: Reached and Released Waypoints keep their places and a revision uses none');
select ok((select count(*)=2 and bool_and(p.prosecdef and p.proowner='postgres'::regrole and p.proconfig @> array['search_path=""']
  and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE')
  and not has_function_privilege('service_role',p.oid,'EXECUTE'))
  from pg_proc p where p.oid in ('ai.solmind_waypoint_root_room_v1(uuid,uuid)'::regprocedure,
    'ai.solmind_waypoint_insert_allowed_v2(uuid,uuid,boolean,boolean)'::regprocedure)),
  'lane 12: the new counting helpers are protected from API roles');
select is((select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text) from pg_proc p
  where p.prosrc like '%solmind_waypoint_insert_allowed_v1(%'),
  array['ai.solmind_apply_waypoint_draft_response(uuid,uuid,uuid,uuid,text,text,uuid,text,timestamp with time zone,boolean)',
    'solmind_mutate_explorer_conversation(uuid,uuid,uuid,uuid,integer,text,text,uuid,uuid,uuid,text,text,text,text,text)'],
  'lane 12: only the two callers that form a new original use the old check, which now also spends one of the five places');
select ok((select ai.solmind_waypoint_capacity_v1(pg_temp.gid(1),null)->>'conversationRoom'='true'
  and not ai.solmind_waypoint_root_room_v1(pg_temp.gid(1),null)
  and not ai.solmind_waypoint_insert_allowed_v2(pg_temp.gid(1),null,false,true)),
  'lane 12: before a first Send the capacity facts report room, while the guard still refuses an insert without a conversation');
select * from finish();
rollback;
