-- REV306 failed-reply reasons: synthetic rollback-only SQL tests, authored only.
-- Execute only in the Executor's isolated migration-proof database. No provider call.
-- Fixture uses existing governance and current v7 context; no real human approval is claimed.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,pg_catalog,pg_temp;
set local statement_timeout='120s';
select no_plan();

create function pg_temp.gid(n integer) returns uuid language sql immutable as $$
  select ('f3060000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
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
    coalesce(sha_override,pg_temp.sha(n)),'synthetic-screen-policy.v1',repeat('B',64),pg_temp.request_sha(n),'gpt-5.6-luna') r
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
-- with the point's current label), current Waypoint heads, and the proposed draft.
create function pg_temp.compass_context() returns jsonb language sql stable as $$
  with forming_move as (select ai.solmind_forming_attention_move_v1(pg_temp.gid(6005)) as value),
  moves as (
    select o.kind,o.completed_at,o.compass_route_kind,o.compass_route_item_id,o.initial_revision,o.operation_id
    from ai.explorer_conversation_operation o where o.conversation_id=pg_temp.gid(6005) and o.compass_route_kind='attention_changed'
    union all
    select 'set_attention',(value->>'recordedAt')::timestamptz,'attention_changed',(value->>'pointId')::uuid,
      (value->>'revision')::integer-1,null::uuid from forming_move where value is not null
  )
  select jsonb_build_object('version','explorer-compass-context.v8','immediateMessageIsReplyChoice',false,
    'mode','automatic',
    'capacity',jsonb_build_object('originalsRemaining',greatest(0,24-(select count(*) from ai.explorer_conversation_compass_item
      where conversation_id=pg_temp.gid(6005) and formation_status is distinct from 'rejected')),
      'topicSlotsRemaining',greatest(0,24-(select count(*) from ai.explorer_compass_topic where conversation_id=pg_temp.gid(6005))),
      'visibleSlotsRemaining',greatest(0,8-(select count(*) from ai.explorer_conversation_compass_item
        where conversation_id=pg_temp.gid(6005) and merged_into_item_id is null and formation_status is distinct from 'rejected'))),
    'messageRefs',jsonb_build_object('history',(select coalesce(jsonb_agg(jsonb_build_object('ref','h'||h.ord::text,
      'order',h.ord) order by h.ord),'[]'::jsonb) from (
      select recent.*,row_number() over(order by recent.sequence_number)-1 as ord from (
        select * from ai.ai_interaction_message where ai_interaction_session_id=pg_temp.gid(6005)
        order by sequence_number desc limit 24) recent) h where h.sender_type='user'),'immediate','now'),
    'topics',(select coalesce(jsonb_agg(jsonb_build_object('id',topic.topic_id,'label',topic.label,
      'pointId',(select item_id from ai.explorer_conversation_compass_item where automatic_topic_id=topic.topic_id),
      'supportCount',(select count(*) from ai.explorer_compass_topic_support where topic_id=topic.topic_id),
      'countedRefs',(select coalesce(jsonb_agg('h'||h.ord::text order by h.ord),'[]'::jsonb) from (
        select recent.*,row_number() over(order by recent.sequence_number)-1 as ord from (
          select * from ai.ai_interaction_message where ai_interaction_session_id=pg_temp.gid(6005)
          order by sequence_number desc limit 24) recent) h where h.sender_type='user' and exists(
            select 1 from ai.explorer_compass_topic_support e where e.topic_id=topic.topic_id and e.support_message_id=h.ai_interaction_message_id)))
      order by topic.topic_slot),'[]'::jsonb) from ai.explorer_compass_topic topic where topic.conversation_id=pg_temp.gid(6005)),
    'points',coalesce((select jsonb_agg(jsonb_build_object('id',c.item_id,'label',ai.solmind_exclusion_normalize_v3(c.label),
      'order',c.ord-1,'formation',case when c.formation_status='automatic' then 'automatic' else 'saved' end,'anchor',c.compass_anchor,'emphasis',c.relative_emphasis)
 order by c.ord)
      from (select x.*,row_number() over(order by x.display_order) as ord from ai.explorer_conversation_compass_item x
        where x.conversation_id=pg_temp.gid(6005) and x.merged_into_item_id is null and x.formation_status is distinct from 'rejected') c),'[]'::jsonb),
    'priorityId',null,
    'attentionId',(select s.attention_id from ai.explorer_conversation_state s where s.conversation_id=pg_temp.gid(6005)),
    'recentRoute',coalesce((select jsonb_agg(jsonb_build_object('kind',r.compass_route_kind,'pointId',r.compass_route_item_id,
      'label',ai.solmind_exclusion_normalize_v3(r.current_label),
      'actor',case when r.kind='follow_attention' then 'virtual_guide' else 'explorer' end,
      'awaitingReply',r.kind='set_attention'
        and r.operation_id is not distinct from (select last_move.operation_id from moves last_move
          order by last_move.initial_revision desc,last_move.operation_id desc limit 1)
        and not exists(select 1 from ai.ai_interaction_message reply where reply.ai_interaction_session_id=pg_temp.gid(6005)
          and reply.sender_type='ai' and reply.created_at>=r.completed_at)) order by r.initial_revision,r.operation_id)
      from (select o.*,c.label as current_label from moves o join ai.explorer_conversation_compass_item c
          on c.conversation_id=pg_temp.gid(6005) and c.item_id=o.compass_route_item_id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected'
        where c.formation_status is distinct from 'proposed' or o.operation_id is null
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
    'drafts',coalesce((select jsonb_agg(jsonb_build_object('id',d.waypoint_draft_id,
      'title',ai.solmind_exclusion_normalize_v3(d.title),'destination',ai.solmind_exclusion_normalize_v3(d.destination),
      'whyItMatters',ai.solmind_exclusion_normalize_v3(d.why_it_matters),
      'arrivalSignal',ai.solmind_exclusion_normalize_v3(d.arrival_signal),
      'suggestedInPreviousReply',coalesce(d.suggestion_message_id=(select m.ai_interaction_message_id
        from ai.ai_interaction_message m where m.ai_interaction_session_id=pg_temp.gid(6005)
          and m.sender_type='ai' and m.ai_role='solmind_virtual_guide'
        order by m.sequence_number desc limit 1),false)))
      from content.waypoint_draft d where d.source_ai_interaction_session_id=pg_temp.gid(6005)
        and d.draft_status='proposed'),'[]'::jsonb))
$$;
create function pg_temp.compass_source_ids() returns uuid[] language sql stable as $$
  select coalesce(array_agg(x.id),array[]::uuid[]) from (
    select c.item_id as id from ai.explorer_conversation_compass_item c
      where c.conversation_id=pg_temp.gid(6005) and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected'
    union all select w.waypoint_id from (select h.* from content.waypoint h where h.source_ai_interaction_session_id=pg_temp.gid(6005)
      and not exists(select 1 from content.waypoint s where s.predecessor_waypoint_id=h.waypoint_id)
      order by case when h.lifecycle_status='chosen' and h.released_at is null then 0 else 1 end,h.created_at desc,h.waypoint_id limit 20) w
    union all select d.waypoint_draft_id from content.waypoint_draft d
      where d.source_ai_interaction_session_id=pg_temp.gid(6005) and d.draft_status='proposed'
    union all select topic_id from ai.explorer_compass_topic where conversation_id=pg_temp.gid(6005)
    union all select support_message_id from ai.explorer_compass_topic_support where conversation_id=pg_temp.gid(6005)) x
$$;
create function pg_temp.context_value(msg uuid,body text,classification_only boolean default false) returns jsonb language sql stable as $$
  select jsonb_build_object('contractVersion',case when classification_only then 'wi007-v0.1+onboarding-fields-v2'
    else 'wi007-v0.1+onboarding-fields-v2+compass-v8' end,'aiRole','solmind_virtual_guide','actorRoleContext','explorer',
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
  body_override text default null)
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
    saved.safety_version,saved.fallback,saved.minor,'gpt-5.6-luna');
end $$;
create function pg_temp.settle_private(slot_n integer,model integer default 0,minor_flag boolean default false,
  kind text default 'ordinary',body text default 'Synthetic saved reply.',status_name text default 'completed',
  interested boolean default true,fallback_override integer default null,attention_n integer default null,choices jsonb default null,suggestions jsonb default null,attention_id uuid default null,responses jsonb default null,waypoint jsonb default null,waypoint_response jsonb default null,failure_reason text default null)
returns table(outcome text,conversation_state jsonb,policy_state jsonb,saved_reply boolean)
language sql as $$
  select * from public.solmind_settle_explorer_conversation_turn_v4(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(10000+slot_n*10),status_name,case when kind='none' then null else pg_temp.gid(10005+slot_n*10) end,
    kind,case when kind='none' then null else body end,model::smallint,minor_flag,'explorer-safety-reply.v2',
    (select mode from lifecycle_intent where slot=slot_n),repeat('A',64),'synthetic-fallback.v1',
    'synthetic-model-policy.v1','synthetic-trusted.v1','synthetic-resources.v1',
    coalesce(fallback_override,(select fallback from lifecycle_intent where slot=slot_n))::smallint,
    (select minor from lifecycle_intent where slot=slot_n),interested,
    coalesce(attention_id,case when attention_n is null then null else pg_temp.gid(attention_n) end),choices,suggestions,responses,waypoint,waypoint_response,failure_reason)
$$;

-- Real SQL owners, synthetic authority and provider results only; no provider I/O.
do $$ begin
  if pg_temp.register_version(1001)<>'ok' then raise exception 'fixture'; end if;
  if not exists(select 1 from pg_temp.screen_start(1001) where outcome='ok' and dispatch_permitted) then raise exception 'fixture'; end if;
  if pg_temp.screen_terminal(1001)<>'ok' or pg_temp.admin_review(1001)<>'ok' or pg_temp.guide_decision(1001)<>'ok'
    then raise exception 'fixture'; end if;
  if not exists(select 1 from pg_temp.ensure_anchor() where outcome='created') then raise exception 'fixture'; end if;
end $$;
create function pg_temp.state() returns jsonb language sql stable as $$
  select ai.solmind_conversation_state_json(pg_temp.gid(6005))
$$;

select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(1)),
  'deadline: one prepared Send');
select ok((select outcome='ok' and not saved_reply from pg_temp.settle_private(1,model=>null,minor_flag=>null,kind=>'none',status_name=>'failed',failure_reason=>'deadline')),
  'deadline: one terminal without an invented reply');
select is((select error_summary from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gid(10013)),
  'deadline', 'deadline: stores only the closed code');
select is((select request_status::text from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gid(10013)),
  'failed', 'deadline: keeps existing terminal status');
select ok(exists(select 1 from ai.ai_interaction_message
  where ai_interaction_message_id=pg_temp.gid(10011) and sender_type='user'
    and content_text='Synthetic private message 1.'),
  'deadline: keeps the Explorer message saved by prepare');
select is((select outcome from pg_temp.settle_private(1,model=>null,minor_flag=>null,kind=>'none',status_name=>'failed',failure_reason=>'deadline')), 'exact_replay', 'deadline: exact terminal replay');
select throws_ok($test$select * from pg_temp.settle_private(1,model=>null,minor_flag=>null,kind=>'none',
  status_name=>'failed',failure_reason=>'transport_failed')$test$,
  'P0001','solmind_explorer_private_operation_conflict','deadline: changed reason conflicts on replay');
select ok((select outcome='exact_replay' and not dispatch_permitted from pg_temp.prepare_private(1)),
  'deadline: repeated Send never permits a second dispatch');

select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(2)),
  'transport_failed: one prepared Send');
select ok((select outcome='ok' and not saved_reply from pg_temp.settle_private(2,model=>null,minor_flag=>null,kind=>'none',status_name=>'failed',failure_reason=>'transport_failed')),
  'transport_failed: one terminal without an invented reply');
select is((select error_summary from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gid(10023)),
  'transport_failed', 'transport_failed: stores only the closed code');
select is((select request_status::text from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gid(10023)),
  'failed', 'transport_failed: keeps existing terminal status');
select ok(exists(select 1 from ai.ai_interaction_message
  where ai_interaction_message_id=pg_temp.gid(10021) and sender_type='user'
    and content_text='Synthetic private message 2.'),
  'transport_failed: keeps the Explorer message saved by prepare');
select is((select outcome from pg_temp.settle_private(2,model=>null,minor_flag=>null,kind=>'none',status_name=>'failed',failure_reason=>'transport_failed')), 'exact_replay', 'transport_failed: exact terminal replay');
select throws_ok($test$select * from pg_temp.settle_private(2,model=>null,minor_flag=>null,kind=>'none',
  status_name=>'failed',failure_reason=>'deadline')$test$,
  'P0001','solmind_explorer_private_operation_conflict','transport_failed: changed reason conflicts on replay');
select ok((select outcome='exact_replay' and not dispatch_permitted from pg_temp.prepare_private(2)),
  'transport_failed: repeated Send never permits a second dispatch');

select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(3)),
  'invalid_response: one prepared Send');
select ok((select outcome='ok' and not saved_reply from pg_temp.settle_private(3,model=>null,minor_flag=>null,kind=>'none',status_name=>'failed',failure_reason=>'invalid_response')),
  'invalid_response: one terminal without an invented reply');
select is((select error_summary from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gid(10033)),
  'invalid_response', 'invalid_response: stores only the closed code');
select is((select request_status::text from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gid(10033)),
  'failed', 'invalid_response: keeps existing terminal status');
select ok(exists(select 1 from ai.ai_interaction_message
  where ai_interaction_message_id=pg_temp.gid(10031) and sender_type='user'
    and content_text='Synthetic private message 3.'),
  'invalid_response: keeps the Explorer message saved by prepare');
select is((select outcome from pg_temp.settle_private(3,model=>null,minor_flag=>null,kind=>'none',status_name=>'failed',failure_reason=>'invalid_response')), 'exact_replay', 'invalid_response: exact terminal replay');
select throws_ok($test$select * from pg_temp.settle_private(3,model=>null,minor_flag=>null,kind=>'none',
  status_name=>'failed',failure_reason=>'deadline')$test$,
  'P0001','solmind_explorer_private_operation_conflict','invalid_response: changed reason conflicts on replay');
select ok((select outcome='exact_replay' and not dispatch_permitted from pg_temp.prepare_private(3)),
  'invalid_response: repeated Send never permits a second dispatch');

select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(4)),
  'delivery_canceled_before_dispatch: one prepared Send');
select ok((select outcome='ok' and not saved_reply from pg_temp.settle_private(4,model=>null,minor_flag=>null,kind=>'none',status_name=>'canceled',failure_reason=>'delivery_canceled_before_dispatch')),
  'delivery_canceled_before_dispatch: one terminal without an invented reply');
select is((select error_summary from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gid(10043)),
  'delivery_canceled_before_dispatch', 'delivery_canceled_before_dispatch: stores only the closed code');
select is((select request_status::text from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gid(10043)),
  'canceled', 'delivery_canceled_before_dispatch: keeps existing terminal status');
select ok(exists(select 1 from ai.ai_interaction_message
  where ai_interaction_message_id=pg_temp.gid(10041) and sender_type='user'
    and content_text='Synthetic private message 4.'),
  'delivery_canceled_before_dispatch: keeps the Explorer message saved by prepare');
select is((select outcome from pg_temp.settle_private(4,model=>null,minor_flag=>null,kind=>'none',status_name=>'canceled',failure_reason=>'delivery_canceled_before_dispatch')), 'exact_replay', 'delivery_canceled_before_dispatch: exact terminal replay');
select throws_ok($test$select * from pg_temp.settle_private(4,model=>null,minor_flag=>null,kind=>'none',
  status_name=>'canceled',failure_reason=>'deadline')$test$,
  'P0001','solmind_explorer_private_operation_conflict','delivery_canceled_before_dispatch: changed reason conflicts on replay');
select ok((select outcome='exact_replay' and not dispatch_permitted from pg_temp.prepare_private(4)),
  'delivery_canceled_before_dispatch: repeated Send never permits a second dispatch');

select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(5)),
  'dispatch_not_admitted: one prepared Send');
select ok((select outcome='ok' and not saved_reply from pg_temp.settle_private(5,model=>null,minor_flag=>null,kind=>'none',status_name=>'failed',failure_reason=>'dispatch_not_admitted')),
  'dispatch_not_admitted: one terminal without an invented reply');
select is((select error_summary from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gid(10053)),
  'dispatch_not_admitted', 'dispatch_not_admitted: stores only the closed code');
select is((select request_status::text from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gid(10053)),
  'failed', 'dispatch_not_admitted: keeps existing terminal status');
select ok(exists(select 1 from ai.ai_interaction_message
  where ai_interaction_message_id=pg_temp.gid(10051) and sender_type='user'
    and content_text='Synthetic private message 5.'),
  'dispatch_not_admitted: keeps the Explorer message saved by prepare');
select is((select outcome from pg_temp.settle_private(5,model=>null,minor_flag=>null,kind=>'none',status_name=>'failed',failure_reason=>'dispatch_not_admitted')), 'exact_replay', 'dispatch_not_admitted: exact terminal replay');
select throws_ok($test$select * from pg_temp.settle_private(5,model=>null,minor_flag=>null,kind=>'none',
  status_name=>'failed',failure_reason=>'deadline')$test$,
  'P0001','solmind_explorer_private_operation_conflict','dispatch_not_admitted: changed reason conflicts on replay');
select ok((select outcome='exact_replay' and not dispatch_permitted from pg_temp.prepare_private(5)),
  'dispatch_not_admitted: repeated Send never permits a second dispatch');

select is((select count(*)::integer from ai.ai_model_invocation where ai_interaction_session_id=pg_temp.gid(6005)),5,
  'five attempted Sends retain exactly five invocations');
select is((select count(*)::integer from ai.ai_interaction_message where ai_interaction_session_id=pg_temp.gid(6005)),5,
  'five failed replies leave exactly five Explorer lines');
select throws_ok($test$update ai.ai_model_invocation set error_summary='transport_failed'
  where ai_model_invocation_id=pg_temp.gid(10013)$test$,
  'P0001','solmind_explorer_private_immutable','a terminal reason cannot be rewritten directly');

select ok((select dispatch_permitted from pg_temp.prepare_private(6)),'prepare closed reason validation');
select throws_ok($test$select * from pg_temp.settle_private(6,model=>null,minor_flag=>null,kind=>'none',
  status_name=>'failed',failure_reason=>'Synthetic private provider text')$test$,
  'P0001','solmind_explorer_private_invalid_input','reject any provider or message text as the reason');
select throws_ok($test$select * from pg_temp.settle_private(6,model=>null,minor_flag=>null,kind=>'none',
  status_name=>'failed',failure_reason=>' deadline')$test$,
  'P0001','solmind_explorer_private_invalid_input','reason bytes are not trimmed or normalized');
select throws_ok($test$select * from pg_temp.settle_private(6,failure_reason=>'invalid_response')$test$,
  'P0001','solmind_explorer_private_invalid_input','a saved reply cannot claim a failure reason');
select throws_ok($test$select * from pg_temp.settle_private(6,kind=>'none',failure_reason=>'deadline')$test$,
  'P0001','solmind_explorer_private_invalid_input','an accepted classification cannot claim an invocation deadline');
select is((select request_status::text from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gid(10063)),
  'started','invalid reasons leave terminal state unchanged');
select ok((select outcome='ok' from pg_temp.settle_private(6,kind=>'none',failure_reason=>'invalid_response')),
  'invalid prose records a reason while the classification remains completed');
select ok((select request_status='completed' and error_summary='invalid_response' and ai_interaction_message_id is null
  from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gid(10063)),
  'accepted classification and unusable prose remain distinct facts');
select is((select outcome from pg_temp.settle_private(6,kind=>'none',failure_reason=>'invalid_response')),
  'exact_replay','completed classification with invalid prose replays exactly');

select ok((select dispatch_permitted from pg_temp.prepare_private(7)),'prepare legacy nullable-reason compatibility');
select ok((select outcome='ok' from pg_temp.settle_private(7,model=>null,minor_flag=>null,kind=>'none',status_name=>'failed')),
  'omitted reason retains legacy settlement');
select is((select error_summary from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gid(10073)),
  'provider_unavailable','omitted reason preserves historical value');
select is((select outcome from pg_temp.settle_private(7,model=>null,minor_flag=>null,kind=>'none',status_name=>'failed')),
  'exact_replay','null reason preserves historical terminal fingerprint');
select throws_ok($test$select * from pg_temp.settle_private(7,model=>null,minor_flag=>null,kind=>'none',
  status_name=>'failed',failure_reason=>'transport_failed')$test$,
  'P0001','solmind_explorer_private_operation_conflict','a new reason cannot rewrite a legacy terminal');

select ok((select dispatch_permitted from pg_temp.prepare_private(8)),'prepare trusted-render failure');
select ok((select outcome='ok' from pg_temp.settle_private(8,model=>3,kind=>'none',failure_reason=>'trusted_render_unavailable')),
  'trusted-render failure retains the positive classification');
select ok((select request_status='completed' and error_summary='trusted_render_unavailable'
  from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gid(10083)),
  'trusted-render failure records only its closed code');
select ok(exists(select 1 from ai.explorer_safety_evidence where logical_operation_id=pg_temp.gid(10084) and model_level=3),
  'positive safety evidence survives failed trusted rendering');
select is((select outcome from pg_temp.settle_private(8,model=>3,kind=>'none',failure_reason=>'trusted_render_unavailable')),
  'exact_replay','trusted-render failure is immutable under exact replay');
select is((select count(*)::integer from ai.ai_interaction_message where ai_interaction_session_id=pg_temp.gid(6005)),8,
  'all eight Explorer messages remain saved');

create function pg_temp.replay_read(slot_n integer)
returns table(outcome text,conversation_state jsonb,authority_context jsonb,policy_state jsonb)
language sql as $$
  select * from public.solmind_read_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),null,
    pg_temp.gid(10000+slot_n*10),methodology.hash_json(jsonb_build_array('synthetic-command',slot_n)))
$$;
select ok((select bool_and(r.outcome='exact_replay' and r.authority_context->'replayFailedReply'='true'::jsonb
  and not r.conversation_state ? 'replayFailedReply')
  from unnest(array[1,2,3,4,5,6,8]) slot_n cross join lateral pg_temp.replay_read(slot_n) r),
  'REV306b: only server authority metadata marks closed-reason failed Send replays');
select ok((select authority_context->'replayFailedReply'='true'::jsonb from pg_temp.replay_read(7)),
  'REV306b: the known legacy failed-Send summary also supports retry without rewriting its reason');
select ok((select not authority_context ? 'replayFailedReply'
  from public.solmind_read_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50))),
  'REV306b: an ordinary read carries no operation-specific retry marker');
select throws_ok($test$select * from public.solmind_read_explorer_conversation_v3(
  pg_temp.gid(1),pg_temp.gid(50),null,pg_temp.gid(10010),repeat('B',64))$test$,
  'P0001','solmind_explorer_private_operation_conflict','REV306b: failed replay still binds exact command bytes');
select throws_ok($test$select * from public.solmind_read_explorer_conversation_v3(
  pg_temp.gid(1),pg_temp.gid(54),null,pg_temp.gid(10010),
  methodology.hash_json(jsonb_build_array('synthetic-command',1)))$test$,
  'P0001','solmind_explorer_private_operation_conflict','REV306b: failed replay still binds the owning application session');

select ok((select dispatch_permitted from pg_temp.prepare_private(9)),
  'REV306b: prepare a saved trusted reply under the retained restricted policy');
select ok((select outcome='exact_replay' and not authority_context ? 'replayFailedReply'
  from pg_temp.replay_read(9)), 'REV306b: an in-progress Send never claims a confirmed failed reply');
select ok((select outcome='ok' and saved_reply from pg_temp.settle_private(9,model=>3,kind=>'urgent')),
  'REV306b: save the trusted reply');
select ok((select not authority_context ? 'replayFailedReply' from pg_temp.replay_read(9)),
  'REV306b: saved-reply replay never claims a failed reply');
select ok((select dispatch_permitted from pg_temp.prepare_private(10)),
  'REV306b: prepare a synthetic reply that SQL must withhold');
select ok((select outcome='withheld' and not saved_reply from pg_temp.settle_private(10)),
  'REV306b: ordinary prose is withheld under the retained restricted policy');
select ok((select error_summary is null from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gid(10103)),
  'REV306b: policy-withheld prose is not recorded as an unusable provider reply');
select ok((select not authority_context ? 'replayFailedReply' from pg_temp.replay_read(10)),
  'REV306b: withheld replay never authorizes the retry sentence');
select ok((select p.prosecdef and p.proowner='postgres'::regrole
  and p.proconfig @> array['search_path=""','lock_timeout=2000ms','statement_timeout=5000ms']
  from pg_proc p where p.oid='public.solmind_read_explorer_conversation_v3(uuid,uuid,uuid,uuid,text)'::regprocedure),
  'REV306b: replay read retains protected ownership and finite lock/statement budgets');
select ok(has_function_privilege('service_role','public.solmind_read_explorer_conversation_v3(uuid,uuid,uuid,uuid,text)','execute')
  and not has_function_privilege('anon','public.solmind_read_explorer_conversation_v3(uuid,uuid,uuid,uuid,text)','execute')
  and not has_function_privilege('authenticated','public.solmind_read_explorer_conversation_v3(uuid,uuid,uuid,uuid,text)','execute'),
  'REV306b: replay metadata retains the service-role-only read boundary');

select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='solmind_settle_explorer_conversation_turn_v4' and p.pronargs=28
    and p.prosecdef and pg_get_userbyid(p.proowner)='postgres'
    and array_to_string(p.proconfig,',') like '%lock_timeout=2000ms%'
    and array_to_string(p.proconfig,',') like '%statement_timeout=5000ms%'),
  'replacement retains owner, security definer and statement/lock budgets');
select ok(to_regprocedure('public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text)') is null,
  'REV391: the retired 27-argument settlement identity is absent');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='solmind_settle_explorer_conversation_turn_v4'),1,
  'only the extended settlement overload remains');
select ok(has_function_privilege('service_role','public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb)','execute'), 'service role retains settlement execution');
select ok(not has_function_privilege('anon','public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb)','execute') and not has_function_privilege('authenticated','public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb)','execute'), 'browser roles cannot settle');
-- Evaluate the actual installed CHECK for other invocation contracts as well,
-- without bypassing their separate insert/immutability triggers.
create function pg_temp.error_summary_allowed(status_value text,contract_value text,reason text,saved boolean default false)
returns boolean language plpgsql as $$
declare expression text; allowed boolean;
begin
  select pg_get_expr(c.conbin,c.conrelid) into strict expression from pg_constraint c
    where c.conrelid='ai.ai_model_invocation'::regclass and c.conname='ai_model_invocation_error_summary_check';
  execute 'select ('||expression||') from (select $1::text as request_status,$2::text as dispatch_contract_version,'
    ||'$3::text as error_summary,$4::uuid as ai_interaction_message_id) candidate'
    into allowed using status_value,contract_value,reason,case when saved then pg_temp.gid(99999) else null::uuid end;
  return allowed;
end $$;
select ok(pg_temp.error_summary_allowed('failed','older-contract','Legacy nonblank failure'),
  'CHECK preserves the original nonblank failed allowance for every contract');
select ok(pg_temp.error_summary_allowed('completed','older-contract',null),
  'CHECK preserves completed legacy invocations without an error');
select ok(pg_temp.error_summary_allowed('canceled','older-contract',null),
  'CHECK preserves canceled legacy invocations without an error');
select is(pg_temp.error_summary_allowed('completed','older-contract','invalid_response'),false,
  'CHECK does not expand completed errors for an older contract');
select is(pg_temp.error_summary_allowed('canceled','older-contract','delivery_canceled_before_dispatch'),false,
  'CHECK does not expand canceled errors for an older contract');
select is(pg_temp.error_summary_allowed('canceled',null,'delivery_canceled_before_dispatch'),false,
  'a null contract cannot pass the new CHECK branch as SQL unknown');
select is(pg_temp.error_summary_allowed('completed','virtual-guide-predispatch-evidence.v3','deadline'),false,
  'completed classification admits only prose or trusted-render failures');
select is(pg_temp.error_summary_allowed('started','virtual-guide-predispatch-evidence.v3','invalid_response'),false,
  'an invocation still in progress cannot carry a terminal failure reason');
select is(pg_temp.error_summary_allowed('canceled','virtual-guide-predispatch-evidence.v3','Private provider text'),false,
  'canceled v3 errors remain a closed set');
select is(pg_temp.error_summary_allowed('canceled','virtual-guide-predispatch-evidence.v3','trusted_render_unavailable'),false,
  'canceled invocations cannot report a trusted-render failure without an accepted classification');
select ok(pg_temp.error_summary_allowed('completed','virtual-guide-predispatch-evidence.v3','trusted_render_unavailable'),
  'accepted classification can still record an unavailable trusted render without a saved reply');
select ok(pg_temp.error_summary_allowed('canceled','virtual-guide-predispatch-evidence.v3','delivery_canceled_before_dispatch'),
  'canceled v3 invocations retain the closed delivery-cancellation reason');
select is(pg_temp.error_summary_allowed('completed','virtual-guide-predispatch-evidence.v3','invalid_response',true),false,
  'a saved v3 reply cannot carry a completed failure reason');
select * from finish();
rollback;
