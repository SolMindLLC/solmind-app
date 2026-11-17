-- Memory step 1: the private memory records. Synthetic, rollback-only, plain psql proof.
-- Accounts, governance, conversations and replies below are invented fixtures; no AI call.
-- The fixture head is the one of explorer_waypoint_offers_test.sql, with its one fixed
-- conversation replaced by "the conversation in use" (the cur table below).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,pg_catalog,pg_temp;
set local statement_timeout='120s';
select plan(432);

create function pg_temp.gid(n integer) returns uuid language sql immutable as $$
  select ('f4a10000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
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
    '{"supportNow":"Synthetic other support","usefulOutcome":"Synthetic other outcome","supportStyle":"Synthetic other style","guideContext":"Synthetic other shared answer","communicationPreference":"Synthetic other preference","doNotEmphasize":"Synthetic other excluded topic"}');

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

-- The conversation in use: whose account, login, conversation, profile, relationship and intake.
create temp table cur(actor integer,app integer,conv integer,profile integer,rel integer,intake integer);
insert into cur values(1,50,6001,24,25,52);
create function pg_temp.ac() returns uuid language sql stable as $$ select pg_temp.gid(actor) from cur $$;
create function pg_temp.ap() returns uuid language sql stable as $$ select pg_temp.gid(app) from cur $$;
create function pg_temp.cv() returns uuid language sql stable as $$ select pg_temp.gid(conv) from cur $$;
create function pg_temp.pf() returns uuid language sql stable as $$ select pg_temp.gid(profile) from cur $$;
create function pg_temp.rl() returns uuid language sql stable as $$ select pg_temp.gid(rel) from cur $$;
create function pg_temp.ik() returns uuid language sql stable as $$ select pg_temp.gid(intake) from cur $$;
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
create function pg_temp.offer_context() returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',o.waypoint_offer_id,'kind',o.offer_kind,
    'waypointId',o.target_waypoint_id,'stage',case o.target_stage when 'chosen' then 'formed' else o.target_stage end,
    'suggestedInPreviousReply',coalesce(o.suggestion_message_id=(select m.ai_interaction_message_id
      from ai.ai_interaction_message m where m.ai_interaction_session_id=pg_temp.cv()
        and m.sender_type='ai' and m.ai_role='solmind_virtual_guide'
      order by m.sequence_number desc limit 1),false))
    ||case when o.offer_kind='reached' then jsonb_build_object('evidence',ai.solmind_exclusion_normalize_v3(o.evidence))
      else jsonb_build_object('title',ai.solmind_exclusion_normalize_v3(o.title),
        'destination',ai.solmind_exclusion_normalize_v3(o.destination),
        'whyItMatters',ai.solmind_exclusion_normalize_v3(o.why_it_matters),
        'arrivalSignal',ai.solmind_exclusion_normalize_v3(o.arrival_signal)) end),'[]'::jsonb)
  from content.waypoint_offer o where o.source_ai_interaction_session_id=pg_temp.cv() and o.offer_status='proposed'
$$;
create function pg_temp.reached_ids() returns jsonb language sql stable as $$
  with recursive ancestry as (
    select waypoint_id,waypoint_id as ancestor,predecessor_waypoint_id from content.waypoint
      where source_ai_interaction_session_id=pg_temp.cv()
    union all select a.waypoint_id,w.waypoint_id,w.predecessor_waypoint_id from ancestry a
      join content.waypoint w on w.waypoint_id=a.predecessor_waypoint_id
  ), heads as (
    select w.* from content.waypoint w where source_ai_interaction_session_id=pg_temp.cv()
      and not exists(select 1 from content.waypoint s where s.predecessor_waypoint_id=w.waypoint_id)
    order by case when w.lifecycle_status='chosen' and w.released_at is null then 0 else 1 end,
      w.created_at desc,w.waypoint_id limit 20
  )
  select coalesce(jsonb_agg(w.waypoint_id order by case when w.lifecycle_status='chosen' and w.released_at is null then 0 else 1 end,
    w.created_at desc,w.waypoint_id),'[]'::jsonb) from heads w where exists(
    select 1 from ancestry a join content.waypoint_offer o on o.lineage_root_waypoint_id=a.ancestor
      and o.offer_kind='reached' where a.waypoint_id=w.waypoint_id and a.predecessor_waypoint_id is null)
$$;
create function pg_temp.compass_context() returns jsonb language sql stable as $$
  with forming_move as (select ai.solmind_forming_attention_move_v1(pg_temp.cv()) as value),
  moves as (
    select o.kind,o.completed_at,o.compass_route_kind,o.compass_route_item_id,o.initial_revision,o.operation_id
    from ai.explorer_conversation_operation o where o.conversation_id=pg_temp.cv() and o.compass_route_kind='attention_changed'
    union all
    select 'set_attention',(value->>'recordedAt')::timestamptz,'attention_changed',(value->>'pointId')::uuid,
      (value->>'revision')::integer-1,null::uuid from forming_move where value is not null
  )
  select jsonb_build_object('version','explorer-compass-context.v9','immediateMessageIsReplyChoice',false,
    'mode','automatic',
    'capacity',jsonb_build_object('originalsRemaining',greatest(0,24-(select count(*) from ai.explorer_conversation_compass_item
      where conversation_id=pg_temp.cv() and formation_status is distinct from 'rejected')),
      'topicSlotsRemaining',greatest(0,24-(select count(*) from ai.explorer_compass_topic where conversation_id=pg_temp.cv())),
      'visibleSlotsRemaining',greatest(0,8-(select count(*) from ai.explorer_conversation_compass_item
        where conversation_id=pg_temp.cv() and merged_into_item_id is null and formation_status is distinct from 'rejected'))),
    'messageRefs',jsonb_build_object('history',(select coalesce(jsonb_agg(jsonb_build_object('ref','h'||h.ord::text,
      'order',h.ord) order by h.ord),'[]'::jsonb) from (
      select recent.*,row_number() over(order by recent.sequence_number)-1 as ord from (
        select * from ai.ai_interaction_message where ai_interaction_session_id=pg_temp.cv()
        order by sequence_number desc limit 24) recent) h where h.sender_type='user'),'immediate','now'),
    'topics',(select coalesce(jsonb_agg(jsonb_build_object('id',topic.topic_id,'label',topic.label,
      'pointId',(select item_id from ai.explorer_conversation_compass_item where automatic_topic_id=topic.topic_id),
      'supportCount',(select count(*) from ai.explorer_compass_topic_support where topic_id=topic.topic_id),
      'countedRefs',(select coalesce(jsonb_agg('h'||h.ord::text order by h.ord),'[]'::jsonb) from (
        select recent.*,row_number() over(order by recent.sequence_number)-1 as ord from (
          select * from ai.ai_interaction_message where ai_interaction_session_id=pg_temp.cv()
          order by sequence_number desc limit 24) recent) h where h.sender_type='user' and exists(
            select 1 from ai.explorer_compass_topic_support e where e.topic_id=topic.topic_id and e.support_message_id=h.ai_interaction_message_id)))
      order by topic.topic_slot),'[]'::jsonb) from ai.explorer_compass_topic topic where topic.conversation_id=pg_temp.cv()),
    'points',coalesce((select jsonb_agg(jsonb_build_object('id',c.item_id,'label',ai.solmind_exclusion_normalize_v3(c.label),
      'order',c.ord-1,'formation',case when c.formation_status='automatic' then 'automatic' else 'saved' end,'anchor',c.compass_anchor,'emphasis',c.relative_emphasis)
 order by c.ord)
      from (select x.*,row_number() over(order by x.display_order) as ord from ai.explorer_conversation_compass_item x
        where x.conversation_id=pg_temp.cv() and x.merged_into_item_id is null and x.formation_status is distinct from 'rejected') c),'[]'::jsonb),
    'priorityId',null,
    'attentionId',(select s.attention_id from ai.explorer_conversation_state s where s.conversation_id=pg_temp.cv()),
    'recentRoute',coalesce((select jsonb_agg(jsonb_build_object('kind',r.compass_route_kind,'pointId',r.compass_route_item_id,
      'label',ai.solmind_exclusion_normalize_v3(r.current_label),
      'actor',case when r.kind='follow_attention' then 'virtual_guide' else 'explorer' end,
      'awaitingReply',r.kind='set_attention'
        and r.operation_id is not distinct from (select last_move.operation_id from moves last_move
          order by last_move.initial_revision desc,last_move.operation_id desc limit 1)
        and not exists(select 1 from ai.ai_interaction_message reply where reply.ai_interaction_session_id=pg_temp.cv()
          and reply.sender_type='ai' and reply.created_at>=r.completed_at)) order by r.initial_revision,r.operation_id)
      from (select o.*,c.label as current_label from moves o join ai.explorer_conversation_compass_item c
          on c.conversation_id=pg_temp.cv() and c.item_id=o.compass_route_item_id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected'
        where c.formation_status is distinct from 'proposed' or o.operation_id is null
        order by o.initial_revision desc,o.operation_id desc limit 5) r),'[]'::jsonb),
    'waypoints',coalesce((select jsonb_agg(jsonb_build_object('id',w.waypoint_id,'title',ai.solmind_exclusion_normalize_v3(w.title),
      'destination',ai.solmind_exclusion_normalize_v3(w.destination),'meaning',ai.solmind_exclusion_normalize_v3(w.why_it_matters),
      'arrivalSignal',ai.solmind_exclusion_normalize_v3(w.arrival_signal),
      'stage',case when w.lifecycle_status='reached' then 'reached' when w.released_at is not null then 'released' else 'formed' end,
      'reachedEvidence',case when w.lifecycle_status='reached' then ai.solmind_exclusion_normalize_v3(w.reached_evidence) end)
      order by case when w.lifecycle_status='chosen' and w.released_at is null then 0 else 1 end,w.created_at desc,w.waypoint_id)
      from (select h.* from content.waypoint h where h.source_ai_interaction_session_id=pg_temp.cv()
        and not exists(select 1 from content.waypoint s where s.predecessor_waypoint_id=h.waypoint_id)
        order by case when h.lifecycle_status='chosen' and h.released_at is null then 0 else 1 end,h.created_at desc,h.waypoint_id limit 20) w),'[]'::jsonb),
    'drafts',coalesce((select jsonb_agg(jsonb_build_object('id',d.waypoint_draft_id,
      'title',ai.solmind_exclusion_normalize_v3(d.title),'destination',ai.solmind_exclusion_normalize_v3(d.destination),
      'whyItMatters',ai.solmind_exclusion_normalize_v3(d.why_it_matters),
      'arrivalSignal',ai.solmind_exclusion_normalize_v3(d.arrival_signal),
      'suggestedInPreviousReply',coalesce(d.suggestion_message_id=(select m.ai_interaction_message_id
        from ai.ai_interaction_message m where m.ai_interaction_session_id=pg_temp.cv()
          and m.sender_type='ai' and m.ai_role='solmind_virtual_guide'
        order by m.sequence_number desc limit 1),false)))
      from content.waypoint_draft d where d.source_ai_interaction_session_id=pg_temp.cv()
        and d.draft_status='proposed'),'[]'::jsonb),
    'offers',pg_temp.offer_context(),'reachedOfferedWaypointIds',pg_temp.reached_ids())
$$;
create function pg_temp.compass_source_ids() returns uuid[] language sql stable as $$
  select coalesce(array_agg(x.id),array[]::uuid[]) from (
    select c.item_id as id from ai.explorer_conversation_compass_item c
      where c.conversation_id=pg_temp.cv() and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected'
    union all select w.waypoint_id from (select h.* from content.waypoint h where h.source_ai_interaction_session_id=pg_temp.cv()
      and not exists(select 1 from content.waypoint s where s.predecessor_waypoint_id=h.waypoint_id)
      order by case when h.lifecycle_status='chosen' and h.released_at is null then 0 else 1 end,h.created_at desc,h.waypoint_id limit 20) w
    union all select d.waypoint_draft_id from content.waypoint_draft d
      where d.source_ai_interaction_session_id=pg_temp.cv() and d.draft_status='proposed'
    union all select waypoint_offer_id from content.waypoint_offer
      where source_ai_interaction_session_id=pg_temp.cv() and offer_status='proposed'
    union all select topic_id from ai.explorer_compass_topic where conversation_id=pg_temp.cv()
    union all select support_message_id from ai.explorer_compass_topic_support where conversation_id=pg_temp.cv()) x
$$;
create function pg_temp.context_value(msg uuid,body text,classification_only boolean default false) returns jsonb language sql stable as $$
  select jsonb_build_object('contractVersion',case when classification_only then 'wi007-v0.1+onboarding-fields-v2'
    else 'wi007-v0.1+onboarding-fields-v2+compass-v9' end,'aiRole','solmind_virtual_guide','actorRoleContext','explorer',
    'globalPolicy',jsonb_build_object('version','synthetic-policy.v1','text','Synthetic policy.'),
    'roleBehavior',jsonb_build_object('version','synthetic-behavior.v1','text','Synthetic behavior.'),
    'crisisBehavior',jsonb_build_object('version','synthetic-crisis.v1','text','Synthetic crisis.'),
    'methodologyContext',jsonb_build_object('version','methodology:'||v.methodology_context_pack_version_id::text,'text',v.content_markdown),
    'sessionContext',jsonb_build_object('sessionType','explorer_virtual_guide','explorerId',pg_temp.pf(),
      'sessionId',pg_temp.cv(),'continuityBindingId',pg_temp.rl(),'explorerDisplayName',null,
      'activeFocusItems','[]'::jsonb,'nextAppointment',null,'explorerSafeGuardrail',null),
    'approvedContinuity',(select jsonb_agg(jsonb_build_object('sourceId',pg_temp.ik(),'order',f.ord-1,
      'kind','onboarding_answer','field',f.name,'content',ai.solmind_exclusion_normalize_v3(i.response_json->>f.name)) order by f.ord)
      from core.intake_response_set i cross join unnest(array['supportNow','usefulOutcome','supportStyle','guideContext',
        'communicationPreference','doNotEmphasize']) with ordinality f(name,ord) where i.intake_response_set_id=pg_temp.ik()),
    'currentSessionMessages',coalesce((select jsonb_agg(jsonb_build_object('messageId',h.ai_interaction_message_id,'order',h.ord-1,
      'explorerId',pg_temp.pf(),'sessionId',pg_temp.cv(),
      'role',case when h.sender_type='user' then 'explorer' else 'solmind_virtual_guide' end,
      'content',ai.solmind_exclusion_normalize_v3(h.content_text)) order by h.ord)
      from (select x.*,row_number() over(order by x.sequence_number) as ord from (select * from ai.ai_interaction_message
        where ai_interaction_session_id=pg_temp.cv() order by sequence_number desc limit 24) x) h),'[]'::jsonb),
    'immediateExplorerMessage',jsonb_build_object('messageId',msg,'explorerId',pg_temp.pf(),
      'sessionId',pg_temp.cv(),'role','explorer','content',body),
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
  select revision into rev from ai.explorer_conversation_state where conversation_id=pg_temp.cv();
  return query select * from public.solmind_observe_explorer_conversation_fallback_v3(
    pg_temp.ac(),pg_temp.ap(),pg_temp.cv(),pg_temp.gid(10000+slot*10),pg_temp.gid(10004+slot*10),
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
      pg_temp.ac(),pg_temp.ap(),pg_temp.cv()) r;
    e:=methodology.resolve_effective(pg_temp.gid(1000),pg_temp.gid(23));
    classification_only:=policy->>'restrictedLevel' is not null or (policy->>'adultReflectionStopped')::boolean
      or lvl>=3 or minor_flag;
    c:=pg_temp.compact(pg_temp.context_value(msg,b,classification_only));
    select array_agg(distinct id order by id) into src from (
      select unnest(array[pg_temp.ik(),msg,pg_temp.gid(1001)]) id union all
      select m.ai_interaction_message_id from (select * from ai.ai_interaction_message
        where ai_interaction_session_id=pg_temp.cv() order by sequence_number desc limit 24) m
      union all select x from unnest(pg_temp.compass_source_ids()) x where not classification_only
    ) selected;
    insert into lifecycle_intent values(slot_n,(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.cv()),
      b,c,src,a->>'authorizationVersion',(policy->>'version')::bigint,
      case when classification_only then 'classification_only' else 'classification_and_reply' end,lvl,minor_flag,e->>'contentSha256',e->>'methodologyAuthorizationVersion');
    select * into saved from lifecycle_intent where slot=slot_n;
  end if;
  return query select * from public.solmind_prepare_explorer_conversation_turn_v3(
    pg_temp.ac(),pg_temp.ap(),pg_temp.cv(),pg_temp.gid(10000+slot_n*10),saved.revision,msg,
    pg_temp.gid(10002+slot_n*10),pg_temp.gid(10003+slot_n*10),coalesce(body_override,saved.body),saved.serialization,
    upper(encode(extensions.digest(convert_to(saved.serialization,'UTF8'),'sha256'),'hex')),saved.source_ids,saved.authority,
    pg_temp.ik(),pg_temp.gid(1001),'synthetic-prompt.v1','synthetic-policy.v1','synthetic-behavior.v1','synthetic-crisis.v1',
    'synthetic-role.v1','synthetic-instruction.v1',methodology.hash_json(jsonb_build_array('synthetic-command',slot_n)),
    pg_temp.gid(10004+slot_n*10),pg_temp.gid(1000),saved.methodology_sha,saved.mv,'explorer-safety-reply.v2',saved.mode,
    repeat('A',64),'synthetic-fallback.v1','synthetic-model-policy.v1','synthetic-trusted.v1','synthetic-resources.v1',
    saved.safety_version,saved.fallback,saved.minor,'gpt-5.6-luna');
end $$;
create function pg_temp.settle_private(slot_n integer,model integer default 0,minor_flag boolean default false,
  kind text default 'ordinary',body text default 'Synthetic saved reply.',status_name text default 'completed',
  interested boolean default true,fallback_override integer default null,attention_n integer default null,choices jsonb default null,suggestions jsonb default null,attention_id uuid default null,responses jsonb default null,waypoint jsonb default null,waypoint_response jsonb default null,
  offer jsonb default null,offer_response jsonb default null,offer_drop jsonb default null,failure_reason text default null)
returns table(outcome text,conversation_state jsonb,policy_state jsonb,saved_reply boolean)
language sql as $$
  select * from public.solmind_settle_explorer_conversation_turn_v4(pg_temp.ac(),pg_temp.ap(),pg_temp.cv(),
    pg_temp.gid(10000+slot_n*10),status_name,case when kind='none' then null else pg_temp.gid(10005+slot_n*10) end,
    kind,case when kind='none' then null else body end,model::smallint,minor_flag,'explorer-safety-reply.v2',
    (select mode from lifecycle_intent where slot=slot_n),repeat('A',64),'synthetic-fallback.v1',
    'synthetic-model-policy.v1','synthetic-trusted.v1','synthetic-resources.v1',
    coalesce(fallback_override,(select fallback from lifecycle_intent where slot=slot_n))::smallint,
    (select minor from lifecycle_intent where slot=slot_n),interested,
    coalesce(attention_id,case when attention_n is null then null else pg_temp.gid(attention_n) end),choices,suggestions,responses,waypoint,waypoint_response,
    p_waypoint_offer=>offer,p_waypoint_offer_response=>offer_response,p_waypoint_offer_drop=>offer_drop,p_failure_reason=>failure_reason)
$$;

-- Real SQL owners, synthetic authority and provider results only; no provider I/O.
do $$ begin
  if pg_temp.register_version(1001)<>'ok' then raise exception 'fixture'; end if;
  if not exists(select 1 from pg_temp.screen_start(1001) where outcome='ok' and dispatch_permitted) then raise exception 'fixture'; end if;
  if pg_temp.screen_terminal(1001)<>'ok' or pg_temp.admin_review(1001)<>'ok' or pg_temp.guide_decision(1001)<>'ok'
    then raise exception 'fixture'; end if;
end $$;
-- ===========================================================================
-- Memory step 1. Invented people and words only:
--   Explorer one (account 1): an older conversation 6001 that never joins
--     memory, conversation A 6002, then conversation B 6003, which a crisis
--     restricts near the end.
--   Explorer two (account 4): conversation C 6101, with the same words.
--   Guide accounts 2 and 6, Admin accounts 3 and 5.
-- Every conversation, message and reply below is made by the real SQL owners.
-- ===========================================================================
create function pg_temp.use_conversation(actor_n integer,conv_n integer) returns void language sql as $$
  update cur set actor=actor_n,conv=conv_n,app=case actor_n when 1 then 50 else 54 end,
    profile=case actor_n when 1 then 24 else 26 end,rel=case actor_n when 1 then 25 else 27 end,
    intake=case actor_n when 1 then 52 else 55 end
$$;
create function pg_temp.start_conversation() returns text language sql as $$
  select e.outcome from cur c cross join lateral pg_temp.ensure_anchor(c.conv,c.actor,c.app) e
$$;
create function pg_temp.send(slot_n integer,explorer_words text) returns boolean language plpgsql as $$
begin
  if not exists(select 1 from pg_temp.prepare_private(slot_n,body_override=>explorer_words)
    where outcome='ok' and dispatch_permitted) then return false; end if;
  return exists(select 1 from pg_temp.settle_private(slot_n) where outcome='ok' and saved_reply);
end $$;
create function pg_temp.send_failed(slot_n integer,explorer_words text) returns boolean language plpgsql as $$
begin
  if not exists(select 1 from pg_temp.prepare_private(slot_n,body_override=>explorer_words)
    where outcome='ok' and dispatch_permitted) then return false; end if;
  return exists(select 1 from pg_temp.settle_private(slot_n,model=>null,minor_flag=>null,kind=>'none',
    status_name=>'failed',failure_reason=>'invalid_response') where not saved_reply);
end $$;
create function pg_temp.send_crisis(slot_n integer,explorer_words text) returns boolean language plpgsql as $$
begin
  if not exists(select 1 from pg_temp.prepare_private(slot_n,body_override=>explorer_words)
    where outcome='ok' and dispatch_permitted) then return false; end if;
  return exists(select 1 from pg_temp.settle_private(slot_n,model=>4,kind=>'crisis',
    body=>'Synthetic crisis reply.') where outcome='ok' and saved_reply);
end $$;
create function pg_temp.send_restricted(slot_n integer,explorer_words text) returns boolean language plpgsql as $$
begin
  if not exists(select 1 from pg_temp.prepare_private(slot_n,body_override=>explorer_words)
    where outcome='ok') then return false; end if;
  return exists(select 1 from pg_temp.settle_private(slot_n,kind=>'restricted',
    body=>'Synthetic restricted reply.') where outcome='ok' and saved_reply);
end $$;
create function pg_temp.send_adult(slot_n integer,explorer_words text) returns boolean language plpgsql as $$
begin
  if not exists(select 1 from pg_temp.prepare_private(slot_n,body_override=>explorer_words)
    where outcome='ok' and dispatch_permitted) then return false; end if;
  return exists(select 1 from pg_temp.settle_private(slot_n,minor_flag=>true,kind=>'adult_only',
    body=>'Synthetic adults-only reply.') where outcome='ok' and saved_reply);
end $$;
create function pg_temp.end_conversation(op_n integer) returns text language sql as $$
  select e.outcome from cur c cross join lateral public.solmind_end_explorer_conversation_v1(
    pg_temp.gid(c.actor),pg_temp.gid(c.app),pg_temp.gid(c.conv),pg_temp.gid(op_n),
    (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(c.conv)),repeat('F',64)) e
$$;
-- m(slot): the Explorer's message of a Send; r(slot): its reply; o(slot): its operation.
create function pg_temp.m(slot_n integer) returns uuid language sql immutable as $$ select pg_temp.gid(10001+slot_n*10) $$;
create function pg_temp.r(slot_n integer) returns uuid language sql immutable as $$ select pg_temp.gid(10005+slot_n*10) $$;
create function pg_temp.o(slot_n integer) returns uuid language sql immutable as $$ select pg_temp.gid(10000+slot_n*10) $$;
-- whole(...): whole messages as sources, place not pinned. place(...): one pinned stretch.
create function pg_temp.whole(variadic ids uuid[]) returns jsonb language sql immutable as $$
  select jsonb_agg(jsonb_build_object('messageId',x.id,'spanStart',null,'spanLength',null) order by x.ord)
  from unnest(ids) with ordinality x(id,ord)
$$;
create function pg_temp.place(id uuid,start_n integer,length_n integer) returns jsonb language sql immutable as $$
  select jsonb_build_array(jsonb_build_object('messageId',id,'spanStart',start_n,'spanLength',length_n))
$$;
-- deps(...): a "built from" list that names each point as it stands now. dep_at(...): one entry as the caller saw it earlier.
create function pg_temp.dep_at(n integer,version_n integer,retired_flag boolean) returns jsonb language sql immutable as $$
  select jsonb_build_array(jsonb_build_object('pointId',pg_temp.gid(n),'version',version_n,'retired',retired_flag))
$$;
create function pg_temp.deps(variadic ns integer[]) returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('pointId',pg_temp.gid(n),
    'version',(select max(v.version_number) from ai.explorer_memory_point_version v where v.point_id=pg_temp.gid(n)),
    'retired',exists(select 1 from ai.explorer_memory_point_event e where e.point_id=pg_temp.gid(n) and e.event_kind='retired'))),'[]'::jsonb)
  from unnest(ns) n
$$;
create function pg_temp.walk(actor_n integer,topic_n integer,direction text,depth_n integer default 8,topics_n integer default 500,
  links_n integer default 2000) returns jsonb language sql stable as $$
  select jsonb_build_object('count',jsonb_array_length(w->'topics'),'more',w->'moreExist',
    'deepest',(select coalesce(max((x->>'depth')::integer),0) from jsonb_array_elements(w->'topics') x),
    'distinct',(select count(distinct x->>'topicId') from jsonb_array_elements(w->'topics') x))
  from ai.solmind_memory_related_topics_v1(pg_temp.gid(actor_n),pg_temp.gid(topic_n),direction,depth_n,topics_n,links_n) w
$$;
-- work(...): how many topics and links the walk looked at, and whether it was cut short.
create function pg_temp.work(actor_n integer,topic_n integer,direction text,depth_n integer default 8,topics_n integer default 500,
  links_n integer default 2000) returns jsonb language sql stable as $$
  select w-'topics'
  from ai.solmind_memory_related_topics_v1(pg_temp.gid(actor_n),pg_temp.gid(topic_n),direction,depth_n,topics_n,links_n) w
$$;
create function pg_temp.point_ids(actor_n integer) returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(p.point_id order by p.point_id),'[]'::jsonb) from ai.solmind_memory_points_v1(pg_temp.gid(actor_n)) p
$$;
create function pg_temp.topic_ids(actor_n integer) returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(t.topic_id order by t.topic_id),'[]'::jsonb) from ai.solmind_memory_topics_v1(pg_temp.gid(actor_n)) t
$$;
create function pg_temp.ids(variadic ns integer[]) returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(pg_temp.gid(n) order by pg_temp.gid(n)),'[]'::jsonb) from unnest(ns) n
$$;
create function pg_temp.related(actor_n integer,topic_n integer,direction text,depth_n integer default 8) returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_array(x->>'topicId',x->>'label',(x->>'depth')::integer) order by (x->>'depth')::integer,x->>'topicId'),'[]'::jsonb)
  from jsonb_array_elements(ai.solmind_memory_related_topics_v1(pg_temp.gid(actor_n),pg_temp.gid(topic_n),direction,depth_n)->'topics') x
$$;

-- 1. Private tables and internal functions.
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='ai' and c.relkind='r' and c.relname like 'explorer\_memory\_%'),11,'eleven memory tables');
select ok(c.relrowsecurity and not exists(select 1 from pg_policy p where p.polrelid=c.oid)
  and not has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  and not has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  and not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  and not has_table_privilege('public',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
  'private table, row security on, no policy, none of the seven table rights for any API role: '||c.relname)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='ai' and c.relkind='r' and c.relname like 'explorer\_memory\_%' order by c.relname;
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='ai' and p.proname like 'solmind\_memory\_%'),40,'forty memory functions');
select ok(not has_function_privilege('service_role',p.oid,'EXECUTE')
  and not has_function_privilege('authenticated',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE')
  and not has_function_privilege('public',p.oid,'EXECUTE') and not p.prosecdef,
  'internal function, no API role may run it: '||p.proname)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='ai' and p.proname like 'solmind\_memory\_%' order by p.proname;
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname<>'ai' and p.proname like 'solmind%memory%'),0,'no memory function is reachable outside the internal schema');
select ok(ai.solmind_memory_sources_valid_v1(pg_temp.whole(pg_temp.gid(1)))
  and ai.solmind_memory_sources_valid_v1(pg_temp.place(pg_temp.gid(1),0,5))
  and not ai.solmind_memory_sources_valid_v1('[]'::jsonb)
  and not ai.solmind_memory_sources_valid_v1('{}'::jsonb)
  and not ai.solmind_memory_sources_valid_v1(pg_temp.whole(pg_temp.gid(1),pg_temp.gid(1)))
  and not ai.solmind_memory_sources_valid_v1(pg_temp.place(pg_temp.gid(1),0,0))
  and not ai.solmind_memory_sources_valid_v1(jsonb_build_array(jsonb_build_object('messageId',pg_temp.gid(1),'spanStart',2,'spanLength',null)))
  and not ai.solmind_memory_sources_valid_v1(jsonb_build_array(jsonb_build_object('messageId',pg_temp.gid(1),'spanStart',null,'spanLength',null,'text','copied words'))),
  'a source is a message with no place or a whole place, once, and never copied words');

select is((select count(*)::integer from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='ai' and c.relname like 'explorer\_memory\_%' and t.tgname like '%\_no\_truncate' and (t.tgtype & 32)<>0),11,
  'each of the eleven tables has its own refusal of TRUNCATE');
select throws_ok('truncate ai.explorer_memory_point_topic','P0001','solmind_explorer_memory_immutable','a table cannot be emptied in one stroke');

-- 2. Memory starts with new conversations only.
select pg_temp.use_conversation(1,6001);
select is(pg_temp.start_conversation(),'created','fixture: an older conversation starts');
select ok(pg_temp.send(1,'This was said before memory existed.'),'fixture: the older conversation has an answered message');
select is(ai.solmind_memory_enroll_conversation_v1(pg_temp.gid(1),pg_temp.gid(6001)),'not_new',
  'a conversation that already has a message does not join memory');
select throws_ok($$insert into ai.explorer_memory_conversation(conversation_id,actor_user_account_id)
  values(pg_temp.gid(6001),pg_temp.gid(1))$$,'P0001','solmind_explorer_memory_conflict',
  'the table itself refuses a conversation that already has a message');
select throws_ok($$select ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6001),pg_temp.gid(900),
  'An older point.','explorer_words',false,pg_temp.whole(pg_temp.m(1)))$$,'P0001','solmind_explorer_memory_denied',
  'nothing is saved from an older conversation');
select is(pg_temp.end_conversation(7001),'ok','fixture: the older conversation ends');

-- 3. Conversation A: enrolling, topics, links, points, sources, corrections.
select pg_temp.use_conversation(1,6002);
select is(pg_temp.start_conversation(),'created','fixture: conversation A starts');
select throws_ok(format($$select ai.solmind_memory_enroll_conversation_v1(pg_temp.gid(%s),pg_temp.gid(6002))$$,n),
  'P0001','solmind_explorer_memory_denied','account '||n||' cannot enroll Explorer one''s conversation')
  from unnest(array[4,2,3]) n;
select is(ai.solmind_memory_enroll_conversation_v1(pg_temp.gid(1),pg_temp.gid(6002)),'enrolled','a new conversation joins memory');
select is(ai.solmind_memory_enroll_conversation_v1(pg_temp.gid(1),pg_temp.gid(6002)),'exact_replay','enrolling twice saves once');
select ok(pg_temp.send(11,'My dog died. Evenings feel lonely.'),'fixture: A, the dog');
select ok(pg_temp.send(12,'I miss my grandmother too.'),'fixture: A, the grandmother');
select ok(pg_temp.send(13,'I keep thinking of leaving my job.'),'fixture: A, the job');
select ok(pg_temp.send(15,'His name was Bruno.'),'fixture: A, the name');
select ok(pg_temp.send(16,U&'\+01F600 My cat is fine.'),'fixture: A, a message that starts with an emoji');
select ok(pg_temp.send_failed(14,'Words that got no reply.'),'fixture: A, one message gets no reply');

select is(ai.solmind_memory_save_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(801),'Sadness about my dog','explorer',pg_temp.m(11)),
  'saved','a topic the Explorer named, with the message that named it');
select is(ai.solmind_memory_save_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(802),'Missing my grandmother','virtual_guide',pg_temp.r(11)),'saved','a topic as the Virtual Guide''s reading');
select is(ai.solmind_memory_save_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(803),'Loss of loved ones','virtual_guide',pg_temp.r(11)),'saved','a broad topic');
select is(ai.solmind_memory_save_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(805),'The urn','virtual_guide',pg_temp.r(11)),'saved','a narrower topic still');
select is(ai.solmind_memory_save_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(808),'Family','virtual_guide',pg_temp.r(11)),'saved','a second broad topic');
select is(ai.solmind_memory_save_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(803),'Loss of loved ones','virtual_guide',pg_temp.r(11)),'exact_replay','the same topic call twice saves once');
select throws_ok($$select ai.solmind_memory_save_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(803),'Something else','virtual_guide',pg_temp.r(11))$$,
  'P0001','solmind_explorer_memory_conflict','a topic identity cannot be reused for other words');
select throws_ok($$select ai.solmind_memory_save_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(809),'Work','explorer',pg_temp.r(13))$$,
  'P0001','solmind_explorer_memory_denied','"named by the Explorer" cannot rest on the Virtual Guide''s reply');
select throws_ok($$select ai.solmind_memory_save_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(809),'Work','explorer',null)$$,
  'P0001','solmind_explorer_memory_invalid_input','"named by the Explorer" needs the Explorer''s message');
select throws_ok($$select ai.solmind_memory_save_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(809),' ','virtual_guide',pg_temp.r(11))$$,
  'P0001','solmind_explorer_memory_invalid_input','an empty topic label is refused');
select throws_ok($$select ai.solmind_memory_save_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(809),'Work','virtual_guide',null)$$,
  'P0001','solmind_explorer_memory_invalid_input','a topic read by the Virtual Guide also needs a supporting message');
select throws_ok($$select ai.solmind_memory_save_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(809),'Work','virtual_guide',pg_temp.m(14))$$,
  'P0001','solmind_explorer_memory_denied','a message that got no reply cannot support a topic');
select throws_ok($$select ai.solmind_memory_save_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(809),'Work','virtual_guide',pg_temp.m(1))$$,
  'P0001','solmind_explorer_memory_denied','nor can a message from another conversation');
select is(ai.solmind_memory_save_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(810),'Work','virtual_guide',pg_temp.r(13),pg_temp.o(13)),
  'saved','a record may name the Send that produced it');
select throws_ok($$select ai.solmind_memory_save_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(809),'Rest','virtual_guide',pg_temp.r(13),pg_temp.o(1))$$,
  'P0001','solmind_explorer_memory_denied','but not a Send of another conversation');
select throws_ok($$select ai.solmind_memory_save_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(809),'Rest','virtual_guide',pg_temp.r(13),pg_temp.o(14))$$,
  'P0001','solmind_explorer_memory_denied','nor a Send that did not complete');
select throws_ok($$insert into ai.explorer_memory_topic_wording(topic_id,wording_number,actor_user_account_id,label,named_by,source_message_id,
  recorded_conversation_id,recorded_operation_id) values(pg_temp.gid(810),2,pg_temp.gid(1),'Rest','virtual_guide',pg_temp.r(13),pg_temp.gid(6002),pg_temp.o(1))$$,
  'P0001','solmind_explorer_memory_conflict','the table itself refuses a Send of another conversation');

select is(ai.solmind_memory_link_topics_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(811),pg_temp.gid(803),pg_temp.gid(801),'virtual_guide',pg_temp.r(11)),'linked','loss of loved ones is broader than the dog');
select is(ai.solmind_memory_link_topics_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(812),pg_temp.gid(803),pg_temp.gid(802),'explorer',pg_temp.m(12)),'linked','and broader than the grandmother, as the Explorer said');
select is(ai.solmind_memory_link_topics_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(813),pg_temp.gid(801),pg_temp.gid(805),'virtual_guide',pg_temp.r(11)),'linked','the dog is broader than the urn');
select is(ai.solmind_memory_link_topics_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(811),pg_temp.gid(803),pg_temp.gid(801),'virtual_guide',pg_temp.r(11)),'exact_replay','the same link call twice saves once');
select is(ai.solmind_memory_link_topics_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(814),pg_temp.gid(803),pg_temp.gid(801),'virtual_guide',pg_temp.r(11)),'already_linked','one current link per pair');
select is(ai.solmind_memory_link_topics_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(814),pg_temp.gid(801),pg_temp.gid(803),'virtual_guide',pg_temp.r(11)),'cycle','a link back up is refused');
select is(ai.solmind_memory_link_topics_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(814),pg_temp.gid(805),pg_temp.gid(803),'virtual_guide',pg_temp.r(11)),'cycle','a circle through three topics is refused');
select throws_ok($$select ai.solmind_memory_link_topics_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(814),pg_temp.gid(803),pg_temp.gid(803),'virtual_guide',pg_temp.r(11))$$,
  'P0001','solmind_explorer_memory_invalid_input','a topic cannot be linked to itself');
select throws_ok($$select ai.solmind_memory_link_topics_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(814),pg_temp.gid(808),pg_temp.gid(805),'virtual_guide',null)$$,
  'P0001','solmind_explorer_memory_invalid_input','a link needs a supporting message');
select throws_ok($$insert into ai.explorer_memory_topic_link(link_id,actor_user_account_id,broad_topic_id,narrow_topic_id,named_by,source_message_id,recorded_conversation_id)
  values(pg_temp.gid(814),pg_temp.gid(1),pg_temp.gid(805),pg_temp.gid(803),'virtual_guide',pg_temp.r(11),pg_temp.gid(6002))$$,
  'P0001','solmind_explorer_memory_cycle','the table itself refuses a circle');
select is(pg_temp.related(1,803,'narrower'),jsonb_build_array(
  jsonb_build_array(pg_temp.gid(801),'Sadness about my dog',1),jsonb_build_array(pg_temp.gid(802),'Missing my grandmother',1),
  jsonb_build_array(pg_temp.gid(805),'The urn',2)),'from the broad topic down: both narrow topics, then the one below');
select is(pg_temp.related(1,805,'broader'),jsonb_build_array(
  jsonb_build_array(pg_temp.gid(801),'Sadness about my dog',1),jsonb_build_array(pg_temp.gid(803),'Loss of loved ones',2)),
  'from the narrowest topic up: the same links read the other way');
select is(pg_temp.related(1,802,'broader'),jsonb_build_array(jsonb_build_array(pg_temp.gid(803),'Loss of loved ones',1)),'from the grandmother up');
select is(jsonb_array_length(pg_temp.related(1,803,'narrower',1)),2,'the walk stops at the depth asked for');
select is(ai.solmind_memory_link_topics_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(816),pg_temp.gid(808),pg_temp.gid(802),'virtual_guide',pg_temp.r(11)),'linked','family is broader than the grandmother');
select is(ai.solmind_memory_unlink_topics_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(816)),'unlinked','a link can be taken back');
select is(ai.solmind_memory_unlink_topics_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(816)),'exact_replay','taking it back twice changes nothing');
select is(pg_temp.related(1,808,'narrower'),'[]'::jsonb,'a link taken back is no longer followed');
select ok((select retired_at is not null and retired_conversation_id=pg_temp.gid(6002) and recorded_at<=retired_at
  from ai.explorer_memory_topic_link where link_id=pg_temp.gid(816)),'the link taken back is kept, with both dates');
select is(ai.solmind_memory_link_topics_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(817),pg_temp.gid(808),pg_temp.gid(802),'virtual_guide',pg_temp.r(11)),'linked','the same pair can be linked again later');

select is(ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(901),'Their dog died; evenings feel lonely.',
  'explorer_words',true,pg_temp.place(pg_temp.m(11),0,12)),'saved','a point in the Explorer''s words, its place pinned');
select is(ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(902),'They miss their grandmother.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(12))),'saved','a point with the whole message as its source');
select is(ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(903),'They are thinking of leaving their job.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(13))),'saved','a third point');
select is(ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(907),'Evenings may be the hardest time of day.',
  'virtual_guide_reading',false,pg_temp.whole(pg_temp.r(11))),'saved','a reading by the Virtual Guide, resting on its own reply');
select is(ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(909),'They keep thinking about work.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(13))),'saved','a fifth point');
select is(ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(910),'Their cat is fine.',
  'explorer_words',false,pg_temp.place(pg_temp.m(16),2,15)),'saved','a place counted in code points, after an emoji');
select is((select substr(m.content_text,s.span_start+1,s.span_length) from ai.explorer_memory_point_source s
  join ai.ai_interaction_message m on m.ai_interaction_message_id=s.source_message_id
  where s.point_id=pg_temp.gid(910) and s.version_number=1),'My cat is fine.','the place after the emoji reads back the exact sentence');
select throws_ok($$select ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(908),'One past the end.',
  'explorer_words',false,pg_temp.place(pg_temp.m(16),2,16))$$,'P0001','solmind_explorer_memory_invalid_input',
  'the emoji counts as one position: a place one past the end is refused');
select is(ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(901),'Their dog died; evenings feel lonely.',
  'explorer_words',true,pg_temp.place(pg_temp.m(11),0,12)),'exact_replay','the same save twice saves once');
select is((select count(*)::integer from ai.explorer_memory_point_version where point_id=pg_temp.gid(901)),1,'and leaves one version');
select throws_ok($$select ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(901),'Different words.',
  'explorer_words',true,pg_temp.place(pg_temp.m(11),0,12))$$,'P0001','solmind_explorer_memory_conflict','a point identity cannot be reused for other words');
select throws_ok($$select ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(908),'A place past the end.',
  'explorer_words',false,pg_temp.place(pg_temp.m(11),30,10))$$,'P0001','solmind_explorer_memory_invalid_input','a place outside the message is refused');
select throws_ok($$select ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(908),'From a message with no reply.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(14)))$$,'P0001','solmind_explorer_memory_denied','a message that got no reply cannot support memory');
select throws_ok($$select ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(908),'Called the Explorer''s words.',
  'explorer_words',false,pg_temp.whole(pg_temp.r(11)))$$,'P0001','solmind_explorer_memory_invalid_input','the Virtual Guide''s reply alone cannot be called the Explorer''s words');
select throws_ok($$select ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(908),repeat('a',401),
  'explorer_words',false,pg_temp.whole(pg_temp.m(12)))$$,'P0001','solmind_explorer_memory_invalid_input','a line longer than 400 characters is refused');
select throws_ok($$select ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(908),'No source at all.',
  'explorer_words',false,'[]'::jsonb)$$,'P0001','solmind_explorer_memory_invalid_input','a point with no source is refused');
select throws_ok($$select ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(908),'Built from itself.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(12)),pg_temp.deps(908))$$,'P0001','solmind_explorer_memory_invalid_input','a point cannot be built from itself');
select throws_ok($$insert into ai.explorer_memory_point_source(point_id,version_number,source_slot,actor_user_account_id,
  source_message_id,source_conversation_id,speaker) values(pg_temp.gid(901),1,2,pg_temp.gid(1),pg_temp.m(12),pg_temp.gid(6002),'explorer')$$,
  'P0001','solmind_explorer_memory_conflict','a saved version is sealed: no source can be added to it afterwards');
-- The next two writes pretend to be the save step itself, to reach the checks behind the seal.
select set_config('solmind_memory.open_version',pg_temp.gid(901)::text||':1',true);
select throws_ok($$insert into ai.explorer_memory_point_source(point_id,version_number,source_slot,actor_user_account_id,
  source_message_id,source_conversation_id,speaker,span_start,span_length)
  values(pg_temp.gid(901),1,2,pg_temp.gid(1),pg_temp.m(12),pg_temp.gid(6002),'explorer',30,10)$$,
  'P0001','solmind_explorer_memory_conflict','the table itself refuses a place outside the message');
select throws_ok($$insert into ai.explorer_memory_point_source(point_id,version_number,source_slot,actor_user_account_id,
  source_message_id,source_conversation_id,speaker) values(pg_temp.gid(901),1,2,pg_temp.gid(1),pg_temp.m(12),pg_temp.gid(6002),'virtual_guide')$$,
  'P0001','solmind_explorer_memory_conflict','the table itself refuses a wrong speaker');
select set_config('solmind_memory.open_version','',true);
select is((select count(*)::integer from ai.explorer_memory_point where point_id=pg_temp.gid(908)),0,'no refused save left anything behind');

select is(ai.solmind_memory_attach_point_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(821),pg_temp.gid(901),pg_temp.gid(801)),'attached','the dog point belongs to the dog topic');
select is(ai.solmind_memory_attach_point_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(822),pg_temp.gid(902),pg_temp.gid(802)),'attached','the grandmother point to its topic');
select is(ai.solmind_memory_attach_point_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(821),pg_temp.gid(901),pg_temp.gid(801)),'exact_replay','attaching twice saves once');
select is(ai.solmind_memory_attach_point_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(829),pg_temp.gid(901),pg_temp.gid(801)),'already_attached','one current attachment per pair');
select is((select jsonb_agg(p.point_id) from ai.solmind_memory_topic_points_v1(pg_temp.gid(1),pg_temp.gid(801)) p),pg_temp.ids(901),'a topic leads to its points');

select is(ai.solmind_memory_correct_point_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(901),1,'Their dog Bruno died; evenings feel lonely.',
  'explorer_words',true,pg_temp.whole(pg_temp.m(11),pg_temp.m(15)),'[]'::jsonb),'corrected','a correction adds a version');
select is(ai.solmind_memory_correct_point_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(901),1,'Their dog Bruno died; evenings feel lonely.',
  'explorer_words',true,pg_temp.whole(pg_temp.m(11),pg_temp.m(15)),'[]'::jsonb),'exact_replay','the same correction twice saves once');
select is(ai.solmind_memory_correct_point_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(901),1,'A correction made against old wording.',
  'explorer_words',true,pg_temp.whole(pg_temp.m(11)),'[]'::jsonb),'stale_version','a correction against wording that has moved on is turned away');
select is((select summary_text||'|'||version_number from ai.solmind_memory_points_v1(pg_temp.gid(1)) where point_id=pg_temp.gid(901)),
  'Their dog Bruno died; evenings feel lonely.|2','the corrected wording is the current one');
select is((select summary_text from ai.explorer_memory_point_version where point_id=pg_temp.gid(901) and version_number=1),
  'Their dog died; evenings feel lonely.','the correction did not erase the earlier wording');
select is((select jsonb_array_length(h->'versions') from ai.solmind_memory_point_history_v1(pg_temp.gid(1),pg_temp.gid(901)) h),2,'the history holds both wordings');
select ok((select (h#>>'{versions,0,recordedAt}')::timestamptz<=(h#>>'{versions,1,recordedAt}')::timestamptz
    and (h#>>'{versions,0,recordedAt}') is not null and h#>>'{versions,0,summary}'='Their dog died; evenings feel lonely.'
  from ai.solmind_memory_point_history_v1(pg_temp.gid(1),pg_temp.gid(901)) h),'each wording carries its date, the earlier one first');
select ok((select (h#>'{versions,0,sources,0,placePinned}')='true'::jsonb and (h#>'{versions,0,sources,0,spanStart}')='0'::jsonb
    and (h#>'{versions,0,sources,0,spanLength}')='12'::jsonb and h#>>'{versions,0,sources,0,speaker}'='explorer'
    and (h#>>'{versions,0,sources,0,messageAt}') is not null
    and jsonb_array_length(h#>'{versions,1,sources}')=2 and (h#>'{versions,1,sources,1,placePinned}')='false'::jsonb
  from ai.solmind_memory_point_history_v1(pg_temp.gid(1),pg_temp.gid(901)) h),
  'each wording says where it came from: the message, its date, the speaker, and the pinned place or none');
select is((select substr(m.content_text,s.span_start+1,s.span_length) from ai.explorer_memory_point_source s
  join ai.ai_interaction_message m on m.ai_interaction_message_id=s.source_message_id
  where s.point_id=pg_temp.gid(901) and s.version_number=1),'My dog died.','the pinned place reads back the exact sentence');

-- The lasting topic behind a Compass topic. The Compass row is a rollback-only
-- fixture written with its formation guard off; the guard is back on at once.
alter table ai.explorer_compass_topic disable trigger explorer_compass_topic_guard;
insert into ai.explorer_compass_topic(topic_id,conversation_id,actor_user_account_id,topic_slot,label,created_operation_id,created_reply_message_id)
  values(pg_temp.gid(701),pg_temp.gid(6002),pg_temp.gid(1),1,'Sadness about my dog',pg_temp.o(11),pg_temp.r(11));
alter table ai.explorer_compass_topic enable trigger explorer_compass_topic_guard;
select is(ai.solmind_memory_bind_compass_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(701),pg_temp.gid(801)),'bound','a Compass topic is bound to its lasting topic');
select is(ai.solmind_memory_bind_compass_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(701),pg_temp.gid(801)),'exact_replay','binding twice saves once');
select throws_ok($$select ai.solmind_memory_bind_compass_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(701),pg_temp.gid(802))$$,
  'P0001','solmind_explorer_memory_conflict','a Compass topic keeps the lasting topic it was bound to');
select is(ai.solmind_memory_compass_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(701)),pg_temp.gid(801),'and it is found again from the Compass topic');

select is(pg_temp.end_conversation(7002),'ok','fixture: conversation A ends');
select throws_ok($$select ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(908),'After the end.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(12)))$$,'P0001','solmind_explorer_memory_denied','nothing more is written from an ended conversation');
select is(pg_temp.point_ids(1),pg_temp.ids(901,902,903,907,909,910),'what was saved stays after the conversation ends');

-- Conversation A2: one dated update, so that a later trial can restrict the
-- conversation a note came from without touching anything else.
select pg_temp.use_conversation(1,6004);
select is(pg_temp.start_conversation(),'created','fixture: conversation A2 starts');
select is(ai.solmind_memory_enroll_conversation_v1(pg_temp.gid(1),pg_temp.gid(6004)),'enrolled','conversation A2 joins memory');
select ok(pg_temp.send(26,'I ordered an urn for him.'),'fixture: A2, the urn');
select throws_ok($$select ai.solmind_memory_record_point_event_v1(pg_temp.gid(1),pg_temp.gid(6004),pg_temp.gid(977),pg_temp.gid(901),'dated_note','Ordered an urn.',null)$$,
  'P0001','solmind_explorer_memory_invalid_input','a dated update needs a supporting message');
select is(ai.solmind_memory_record_point_event_v1(pg_temp.gid(1),pg_temp.gid(6004),pg_temp.gid(977),pg_temp.gid(901),'dated_note','Ordered an urn.',pg_temp.m(26)),
  'recorded','a dated update is added to a point from an earlier conversation');
select is(pg_temp.end_conversation(7004),'ok','fixture: conversation A2 ends');

-- 4. Explorer two says the same words. Nothing crosses between the two.
select pg_temp.use_conversation(4,6101);
select is(pg_temp.start_conversation(),'created','fixture: Explorer two''s conversation C starts');
select is(ai.solmind_memory_enroll_conversation_v1(pg_temp.gid(4),pg_temp.gid(6101)),'enrolled','Explorer two''s conversation joins memory');
select ok(pg_temp.send(21,'My dog died. Evenings feel lonely.'),'fixture: C, the same words');
select is(ai.solmind_memory_save_topic_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(851),'Sadness about my dog','explorer',pg_temp.m(21)),'saved','Explorer two saves a topic with the same label');
select is(ai.solmind_memory_save_point_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(951),'Their dog died; evenings feel lonely.',
  'explorer_words',true,pg_temp.place(pg_temp.m(21),0,12)),'saved','and a point with the same words');
select is(pg_temp.point_ids(4),pg_temp.ids(951),'Explorer two reads only their own point');
select is(pg_temp.topic_ids(4),pg_temp.ids(851),'and only their own topic');
select is(pg_temp.point_ids(1),pg_temp.ids(901,902,903,907,909,910),'Explorer one reads none of Explorer two''s');
select is(pg_temp.topic_ids(1),pg_temp.ids(801,802,803,805,808,810),'in points or in topics');
select is(ai.solmind_memory_attach_point_topic_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(868),pg_temp.gid(951),pg_temp.gid(851)),'attached','Explorer two attaches their point to their topic');

select throws_ok(q,'P0001','solmind_explorer_memory_denied','Explorer two cannot '||what) from (values
  ('read the history of Explorer one''s point',$$select ai.solmind_memory_point_history_v1(pg_temp.gid(4),pg_temp.gid(901))$$),
  ('read the wordings of Explorer one''s topic',$$select ai.solmind_memory_topic_wordings_v1(pg_temp.gid(4),pg_temp.gid(801))$$),
  ('walk Explorer one''s topic links',$$select * from ai.solmind_memory_related_topics_v1(pg_temp.gid(4),pg_temp.gid(803),'narrower')$$),
  ('list the points of Explorer one''s topic',$$select * from ai.solmind_memory_topic_points_v1(pg_temp.gid(4),pg_temp.gid(801))$$),
  ('correct Explorer one''s point',$$select ai.solmind_memory_correct_point_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(901),2,'Taken over.','explorer_words',false,pg_temp.whole(pg_temp.m(21)),'[]'::jsonb)$$),
  ('add history to Explorer one''s point',$$select ai.solmind_memory_record_point_event_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(981),pg_temp.gid(901),'dated_note','A note.',pg_temp.m(21))$$),
  ('retire Explorer one''s point',$$select ai.solmind_memory_record_point_event_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(981),pg_temp.gid(901),'retired',null,pg_temp.m(21))$$),
  ('use Explorer one''s message as a source',$$select ai.solmind_memory_save_point_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(952),'Borrowed words.','explorer_words',false,pg_temp.whole(pg_temp.m(11)))$$),
  ('build a point from Explorer one''s point',$$select ai.solmind_memory_save_point_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(952),'Built on another.','explorer_words',false,pg_temp.whole(pg_temp.m(21)),pg_temp.deps(901))$$),
  ('save into Explorer one''s conversation',$$select ai.solmind_memory_save_point_v1(pg_temp.gid(4),pg_temp.gid(6002),pg_temp.gid(952),'In the wrong place.','explorer_words',false,pg_temp.whole(pg_temp.m(21)))$$),
  ('link their topic above Explorer one''s',$$select ai.solmind_memory_link_topics_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(861),pg_temp.gid(851),pg_temp.gid(801),'virtual_guide',pg_temp.r(21))$$),
  ('link their topic below Explorer one''s',$$select ai.solmind_memory_link_topics_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(861),pg_temp.gid(803),pg_temp.gid(851),'virtual_guide',pg_temp.r(21))$$),
  ('take back Explorer one''s link',$$select ai.solmind_memory_unlink_topics_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(811))$$),
  ('reword Explorer one''s topic',$$select ai.solmind_memory_reword_topic_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(801),1,'Mine now','virtual_guide',pg_temp.r(21))$$),
  ('attach their point to Explorer one''s topic',$$select ai.solmind_memory_attach_point_topic_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(862),pg_temp.gid(951),pg_temp.gid(801))$$),
  ('attach Explorer one''s point to their topic',$$select ai.solmind_memory_attach_point_topic_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(862),pg_temp.gid(901),pg_temp.gid(851))$$),
  ('detach Explorer one''s point',$$select ai.solmind_memory_detach_point_topic_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(821))$$),
  ('find the lasting topic behind Explorer one''s Compass topic',$$select ai.solmind_memory_compass_topic_v1(pg_temp.gid(4),pg_temp.gid(6002),pg_temp.gid(701))$$),
  ('bind Explorer one''s Compass topic',$$select ai.solmind_memory_bind_compass_topic_v1(pg_temp.gid(4),pg_temp.gid(6002),pg_temp.gid(701),pg_temp.gid(851))$$)
) as attempts(what,q);
select throws_ok($$select ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6101),pg_temp.gid(908),'In the wrong place.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(12)))$$,'P0001','solmind_explorer_memory_denied','Explorer one cannot save into Explorer two''s conversation');
select ok(ai.solmind_memory_compass_topic_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(799)) is null,'a Compass topic that is not bound gives nothing, without a refusal');
-- Even a direct write that skips the functions cannot cross: the keys carry the owner.
select throws_ok($$insert into ai.explorer_memory_topic_link(link_id,actor_user_account_id,broad_topic_id,narrow_topic_id,named_by,source_message_id,recorded_conversation_id)
  values(pg_temp.gid(861),pg_temp.gid(4),pg_temp.gid(851),pg_temp.gid(801),'virtual_guide',pg_temp.r(21),pg_temp.gid(6101))$$,'23503',null,
  'the table itself refuses a link between two Explorers'' topics');
select set_config('solmind_memory.open_version',pg_temp.gid(951)::text||':1',true);
select throws_ok($$insert into ai.explorer_memory_point_source(point_id,version_number,source_slot,actor_user_account_id,
  source_message_id,source_conversation_id,speaker) values(pg_temp.gid(951),1,2,pg_temp.gid(4),pg_temp.m(11),pg_temp.gid(6002),'explorer')$$,'P0001','solmind_explorer_memory_conflict',
  'the table itself refuses another Explorer''s message as a source');
select throws_ok($$insert into ai.explorer_memory_point_topic(attachment_id,point_id,topic_id,actor_user_account_id,recorded_conversation_id)
  values(pg_temp.gid(862),pg_temp.gid(951),pg_temp.gid(801),pg_temp.gid(4),pg_temp.gid(6101))$$,'23503',null,
  'the table itself refuses a point on another Explorer''s topic');
select throws_ok($$insert into ai.explorer_memory_point_dependency(point_id,version_number,depends_on_point_id,depends_on_version_number,depends_on_retired,actor_user_account_id)
  values(pg_temp.gid(951),1,pg_temp.gid(901),2,false,pg_temp.gid(4))$$,'23503',null,
  'the table itself refuses a point built from another Explorer''s point');
select set_config('solmind_memory.open_version','',true);

-- A graph that branches and comes together again: one root, then three layers
-- of three topics, each topic linked to all three of the layer below (27 paths
-- to each of the lowest topics). Each topic is returned once, at its depth.
do $$
declare layer integer; a integer; b integer; n integer:=0;
begin
  for a in 870..879 loop
    if ai.solmind_memory_save_topic_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(a),'Layered topic '||a,'virtual_guide',pg_temp.r(21))<>'saved'
      then raise exception 'fixture'; end if;
  end loop;
  for b in 871..873 loop
    n:=n+1;
    if ai.solmind_memory_link_topics_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(8700+n),pg_temp.gid(870),pg_temp.gid(b),'virtual_guide',pg_temp.r(21))<>'linked'
      then raise exception 'fixture'; end if;
  end loop;
  for layer in 0..1 loop
    for a in 871+layer*3..873+layer*3 loop
      for b in 874+layer*3..876+layer*3 loop
        n:=n+1;
        if ai.solmind_memory_link_topics_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(8700+n),pg_temp.gid(a),pg_temp.gid(b),'virtual_guide',pg_temp.r(21))<>'linked'
          then raise exception 'fixture'; end if;
      end loop;
    end loop;
  end loop;
end $$;
select is((select jsonb_agg(x->2 order by x->>0) from jsonb_array_elements(pg_temp.related(4,870,'narrower')) x),
  '[1,1,1,2,2,2,3,3,3]'::jsonb,'through a graph that branches and rejoins, each topic comes back once, at its nearest depth');
select is((select jsonb_agg(x->2 order by x->>0) from jsonb_array_elements(pg_temp.related(4,879,'broader')) x),
  '[3,2,2,2,1,1,1]'::jsonb,'and the same from the bottom up');
select is(pg_temp.walk(4,870,'narrower'),'{"count":9,"more":false,"deepest":3,"distinct":9}'::jsonb,
  'nine rows for nine topics, and no "more exist" signal: every one of the 21 links was examined');
select is(pg_temp.walk(4,870,'narrower',8,500,12),'{"count":6,"more":true,"deepest":2,"distinct":6}'::jsonb,
  'with only 12 links to examine, the walk keeps the two nearest layers, stops, and says more exist');
select is(pg_temp.walk(4,870,'narrower',8,5,2000),'{"count":5,"more":true,"deepest":2,"distinct":5}'::jsonb,
  'with only 5 topics to visit, it keeps the nearest five and says more exist');
select is(pg_temp.walk(4,870,'narrower',2),'{"count":6,"more":false,"deepest":2,"distinct":6}'::jsonb,
  'stopping at the depth asked for is not "more exist"');
-- A topic reachable at two depths: 880 is above 881 and 882, and 881 is above 882 too.
do $$
declare a integer;
begin
  for a in 880..882 loop
    if ai.solmind_memory_save_topic_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(a),'Short cut topic '||a,'virtual_guide',pg_temp.r(21))<>'saved'
      then raise exception 'fixture'; end if;
  end loop;
  if ai.solmind_memory_link_topics_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(8790),pg_temp.gid(880),pg_temp.gid(881),'virtual_guide',pg_temp.r(21))<>'linked'
    or ai.solmind_memory_link_topics_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(8791),pg_temp.gid(881),pg_temp.gid(882),'virtual_guide',pg_temp.r(21))<>'linked'
    or ai.solmind_memory_link_topics_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(8792),pg_temp.gid(880),pg_temp.gid(882),'virtual_guide',pg_temp.r(21))<>'linked'
    then raise exception 'fixture'; end if;
end $$;
select is(pg_temp.walk(4,880,'narrower'),'{"count":2,"more":false,"deepest":1,"distinct":2}'::jsonb,
  'a topic that can be reached by a short and a long way comes back once, at the nearest depth');
-- Three topics below a root, and one topic below all three: once the topic budget of four is
-- used up, the two remaining links lead only to a topic already visited.
do $$
declare a integer;
begin
  for a in 895..899 loop
    if ai.solmind_memory_save_topic_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(a),'Funnel topic '||a,'virtual_guide',pg_temp.r(21))<>'saved'
      then raise exception 'fixture'; end if;
  end loop;
  for a in 896..898 loop
    if ai.solmind_memory_link_topics_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(8000+a),pg_temp.gid(895),pg_temp.gid(a),'virtual_guide',pg_temp.r(21))<>'linked'
      or ai.solmind_memory_link_topics_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(8100+a),pg_temp.gid(a),pg_temp.gid(899),'virtual_guide',pg_temp.r(21))<>'linked'
      then raise exception 'fixture'; end if;
  end loop;
end $$;
select is(pg_temp.work(4,895,'narrower',8,4),'{"moreExist":true,"topicsExamined":4,"linksExamined":5}'::jsonb,
  'once the topic budget is used up the walk stops at the very next link, though the links left lead only to a visited topic');
select is(pg_temp.work(4,895,'narrower'),'{"moreExist":false,"topicsExamined":4,"linksExamined":6}'::jsonb,
  'with room to spare the same walk looks at all six links');
-- More than 500 topics: one root with 600 topics directly below it, and one topic below the first of those.
do $$
declare i integer;
begin
  if ai.solmind_memory_save_topic_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(39999),'Wide root','virtual_guide',pg_temp.r(21))<>'saved'
    then raise exception 'fixture'; end if;
  for i in 0..600 loop
    if ai.solmind_memory_save_topic_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(40000+i),'Wide topic '||i,'virtual_guide',pg_temp.r(21))<>'saved'
      then raise exception 'fixture'; end if;
    if ai.solmind_memory_link_topics_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(50000+i),
        pg_temp.gid(case when i=600 then 40000 else 39999 end),pg_temp.gid(40000+i),'virtual_guide',pg_temp.r(21))<>'linked'
      then raise exception 'fixture'; end if;
  end loop;
end $$;
select is(pg_temp.walk(4,39999,'narrower'),'{"count":500,"more":true,"deepest":1,"distinct":500}'::jsonb,
  'below a root with 600 topics the walk visits 500, goes no deeper, and says more exist');
select is(pg_temp.walk(4,39999,'narrower',8,500,100),'{"count":100,"more":true,"deepest":1,"distinct":100}'::jsonb,
  'and with 100 links to examine it examines 100');
select is(pg_temp.walk(4,40600,'broader'),'{"count":2,"more":false,"deepest":2,"distinct":2}'::jsonb,
  'from the lowest of them upward the walk is small and complete');
select is(pg_temp.work(4,39999,'narrower'),'{"moreExist":true,"topicsExamined":500,"linksExamined":501}'::jsonb,
  'below the wide root the walk looks at 500 topics and 501 links, and not at the other hundred');
select is(pg_temp.work(4,39999,'narrower',8,500,100),'{"moreExist":true,"topicsExamined":100,"linksExamined":100}'::jsonb,
  'with 100 links to examine it looks at exactly 100');
select is(pg_temp.work(4,870,'narrower',8,3),'{"moreExist":true,"topicsExamined":3,"linksExamined":3}'::jsonb,
  'when the first layer fills the topic budget exactly, the walk stops there: it looks at no link of the next layer');
select is(pg_temp.work(4,870,'narrower',8,500,3),'{"moreExist":true,"topicsExamined":3,"linksExamined":3}'::jsonb,
  'and the same when the first layer fills the link budget exactly');
select is(pg_temp.work(4,40600,'broader',8,2),'{"moreExist":false,"topicsExamined":2,"linksExamined":2}'::jsonb,
  'a walk that fills its budget exactly with nothing beyond it does not say more exist');
select is(pg_temp.work(4,880,'narrower'),'{"moreExist":false,"topicsExamined":2,"linksExamined":3}'::jsonb,
  'a topic already visited costs a link but is not looked at again');
select throws_ok($$select * from ai.solmind_memory_related_topics_v1(pg_temp.gid(4),pg_temp.gid(39999),'narrower',8,501)$$,
  'P0001','solmind_explorer_memory_invalid_input','no caller can ask for more than 500 topics');

-- Guide and Admin accounts get nothing, read or write.
select throws_ok(format(q,n),'P0001','solmind_explorer_memory_denied',who||' account '||n||' cannot '||what)
from (values (2,'Guide'),(6,'Guide'),(3,'Admin'),(5,'Admin')) as accounts(n,who) cross join (values
  ('list memory points',$$select * from ai.solmind_memory_points_v1(pg_temp.gid(%s))$$),
  ('list memory topics',$$select * from ai.solmind_memory_topics_v1(pg_temp.gid(%s))$$),
  ('read a point''s history',$$select ai.solmind_memory_point_history_v1(pg_temp.gid(%s),pg_temp.gid(901))$$),
  ('read a topic''s wordings',$$select ai.solmind_memory_topic_wordings_v1(pg_temp.gid(%s),pg_temp.gid(801))$$),
  ('walk topic links',$$select * from ai.solmind_memory_related_topics_v1(pg_temp.gid(%s),pg_temp.gid(803),'narrower')$$),
  ('find a Compass topic''s lasting topic',$$select ai.solmind_memory_compass_topic_v1(pg_temp.gid(%s),pg_temp.gid(6002),pg_temp.gid(701))$$),
  ('save a point',$$select ai.solmind_memory_save_point_v1(pg_temp.gid(%s),pg_temp.gid(6101),pg_temp.gid(953),'Written by someone else.','virtual_guide_reading',false,pg_temp.whole(pg_temp.r(21)))$$),
  ('correct a point',$$select ai.solmind_memory_correct_point_v1(pg_temp.gid(%s),pg_temp.gid(6101),pg_temp.gid(951),1,'Changed by someone else.','virtual_guide_reading',false,pg_temp.whole(pg_temp.r(21)),'[]'::jsonb)$$),
  ('link topics',$$select ai.solmind_memory_link_topics_v1(pg_temp.gid(%s),pg_temp.gid(6101),pg_temp.gid(863),pg_temp.gid(803),pg_temp.gid(808),'virtual_guide',pg_temp.r(21))$$)
) as attempts(what,q);
create temp table role_probe(role_name text,probe text,refused boolean);
do $$
declare r text; q text;
begin
  foreach r in array array['anon','authenticated','service_role'] loop
    foreach q in array array['select count(*) from ai.explorer_memory_point',
      'select count(*) from ai.explorer_memory_point_source',
      'select count(*) from ai.solmind_memory_points_v1(''f4a10000-0000-4000-8000-000000000001''::uuid)'] loop
      begin
        execute format('set local role %I',r);
        execute q;
        reset role;
        insert into role_probe values(r,q,false);
      exception when insufficient_privilege then
        reset role;
        insert into role_probe values(r,q,true);
      end;
    end loop;
  end loop;
end $$;
select is(current_user::text,'postgres','the role probes left the test as the database owner');
select ok(refused,'the database refuses the '||role_name||' role: '||probe) from role_probe order by role_name,probe;

-- 5. Conversation B: dated history, "no longer applies", points across conversations, "built from".
select pg_temp.use_conversation(1,6003);
select is(pg_temp.start_conversation(),'created','fixture: conversation B starts');
select is(ai.solmind_memory_enroll_conversation_v1(pg_temp.gid(1),pg_temp.gid(6003)),'enrolled','conversation B joins memory');
select ok(pg_temp.send(31,'He is still on my mind every evening.'),'fixture: B, the dog again');
select ok(pg_temp.send(32,'I decided to stay at my job. Leaving does not apply any more.'),'fixture: B, the job');
select ok(pg_temp.send(33,'Evenings are still the hardest.'),'fixture: B, evenings');

select is(ai.solmind_memory_record_point_event_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(971),pg_temp.gid(901),'dated_note','Still on their mind every evening.',pg_temp.m(31)),
  'recorded','a second dated update, from conversation B');
select is(ai.solmind_memory_record_point_event_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(971),pg_temp.gid(901),'dated_note','Still on their mind every evening.',pg_temp.m(31)),
  'exact_replay','the same update twice saves once');
select ok((select is_current from ai.solmind_memory_points_v1(pg_temp.gid(1)) where point_id=pg_temp.gid(901)),'a dated update does not retire the point');
select is(ai.solmind_memory_record_point_event_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(972),pg_temp.gid(903),'retired','Decided to stay at the job.',pg_temp.m(32)),
  'recorded','"that doesn''t apply any more" retires the point');
select is(ai.solmind_memory_record_point_event_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(972),pg_temp.gid(903),'retired','Decided to stay at the job.',pg_temp.m(32)),
  'exact_replay','the same retirement twice saves once');
select is(ai.solmind_memory_record_point_event_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(973),pg_temp.gid(903),'retired',null,pg_temp.m(32)),
  'already_retired','a point is retired once');
select throws_ok($$select ai.solmind_memory_record_point_event_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(974),pg_temp.gid(902),'retired',null,pg_temp.r(32))$$,
  'P0001','solmind_explorer_memory_denied','a retirement cannot rest on the Virtual Guide''s reply');
select throws_ok($$select ai.solmind_memory_record_point_event_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(974),pg_temp.gid(902),'retired',null,pg_temp.m(12))$$,
  'P0001','solmind_explorer_memory_denied','nor on a message from another conversation');
select throws_ok($$select ai.solmind_memory_record_point_event_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(974),pg_temp.gid(902),'retired',null,null)$$,
  'P0001','solmind_explorer_memory_invalid_input','nor on nothing');
select is((select is_current::text||'|'||summary_text from ai.solmind_memory_points_v1(pg_temp.gid(1)) where point_id=pg_temp.gid(903)),
  'false|They are thinking of leaving their job.','the retired point is no longer the current picture, and its wording is kept');
select ok((select h#>>'{events,0,kind}'='retired' and h#>>'{events,0,note}'='Decided to stay at the job.'
    and (h#>>'{events,0,recordedAt}')::timestamptz>=(h#>>'{versions,0,recordedAt}')::timestamptz
    and h#>>'{events,0,messageId}'=pg_temp.m(32)::text and jsonb_array_length(h->'versions')=1
  from ai.solmind_memory_point_history_v1(pg_temp.gid(1),pg_temp.gid(903)) h),'its history shows the earlier picture, then the dated retirement and its source');
select is(ai.solmind_memory_correct_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(909),1,'They kept thinking about work in the spring.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(13)),'[]'::jsonb),'corrected','an earlier point is corrected in B, still resting only on a message from A');

select is(ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(904),'The dog is on their mind in two conversations.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(11),pg_temp.m(31))),'saved','a point resting on messages from two conversations');
select is(ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(905),'Evenings are still the hardest.',
  'explorer_words',true,pg_temp.whole(pg_temp.m(33))),'saved','a point from conversation B alone');
select is(ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(912),'They are staying at their job.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(32))),'saved','another point from B alone');
select is(ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(906),'Evenings are hardest without the grandmother.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(33)),pg_temp.deps(902,905)),'saved','a point built from two other points');
select is(ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(906),'Evenings are hardest without the grandmother.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(33)),pg_temp.deps(905,902)),'exact_replay','the same built-from save twice saves once');
select is(ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(913),'Evenings and the grandmother, said again.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(33)),pg_temp.deps(906)),'saved','a point built from that built point: two levels');
select is(ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(914),'Staying at the job, said again.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(32)),pg_temp.deps(912)),'saved','a point built from the job point');
select is(ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(915),'The dog, said again in B.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(31)),pg_temp.deps(901)),'saved','a point built from the dog point, which carries a note from A2');
select is(ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(916),'The dog, said a third time.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(31)),pg_temp.deps(915)),'saved','and one built from that');
select ok((select h->'builtFrom'=jsonb_build_array(
    jsonb_build_object('version',1,'pointId',pg_temp.gid(902),'pointVersion',1,'pointRetired',false),
    jsonb_build_object('version',1,'pointId',pg_temp.gid(905),'pointVersion',1,'pointRetired',false)) and not (h->>'stale')::boolean
  from ai.solmind_memory_point_history_v1(pg_temp.gid(1),pg_temp.gid(906)) h),'"built from" records which version of each point the wording rests on');

-- A correction reaches what was built from the corrected point, at every level.
select is(ai.solmind_memory_correct_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(905),1,'Evenings are the hardest, mornings are fine.',
  'explorer_words',true,pg_temp.whole(pg_temp.m(33)),'[]'::jsonb),'corrected','the evenings point is corrected');
select ok(ai.solmind_memory_point_stale_v1(pg_temp.gid(906)) and ai.solmind_memory_point_stale_v1(pg_temp.gid(913))
  and not ai.solmind_memory_point_stale_v1(pg_temp.gid(905)),'the point built from it, and the point built from that, are now out of date');
select ok(not pg_temp.point_ids(1) @> pg_temp.ids(906) and not pg_temp.point_ids(1) @> pg_temp.ids(913) and pg_temp.point_ids(1) @> pg_temp.ids(905),
  'out-of-date points are not given out; the corrected point is');
select ok(ai.solmind_memory_point_history_v1(pg_temp.gid(1),pg_temp.gid(913)) is null
  and ai.solmind_memory_point_history_v1(pg_temp.gid(1),pg_temp.gid(906)) is null,'their history is not given out either');
select ok((select (h->>'stale')::boolean and jsonb_array_length(h->'versions')=1
  from ai.solmind_memory_point_history_v1(pg_temp.gid(1),pg_temp.gid(913),true) h),
  'unless it is asked for by name, as the rebuild must, and then it is marked out of date');
select is(ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(918),'Composed from the earlier wording.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(33)),pg_temp.dep_at(905,1,false)),'changed_dependency',
  'a wording composed from version 1 of a point is refused once that point has been corrected');
select is(ai.solmind_memory_correct_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(906),1,'Rebuilt from the earlier wording.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(33)),pg_temp.dep_at(905,1,false)),'changed_dependency',
  'and so is a correction composed from it');
select is((select count(*)::integer from ai.explorer_memory_point where point_id=pg_temp.gid(918)),0,'the refused save left nothing behind');
select is(ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(917),'Built on an out-of-date point.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(33)),pg_temp.deps(906)),'unusable','nothing new is built from an out-of-date point');
select is(ai.solmind_memory_correct_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(906),1,'Evenings are hardest without the grandmother; mornings are fine.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(33)),pg_temp.deps(902,905)),'corrected','the built point is rebuilt by a correction with its full built-from list');
select ok(not ai.solmind_memory_point_stale_v1(pg_temp.gid(906)) and ai.solmind_memory_point_stale_v1(pg_temp.gid(913)),
  'it is given out again; the point one level further is still out of date');
select is(ai.solmind_memory_correct_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(913),1,'Evenings and the grandmother, said again; mornings are fine.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(33)),pg_temp.deps(906)),'corrected','and is rebuilt in its turn');
select ok(not ai.solmind_memory_point_stale_v1(pg_temp.gid(913)),'both levels are current again');
select is(ai.solmind_memory_correct_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(905),2,'A circle.',
  'explorer_words',true,pg_temp.whole(pg_temp.m(33)),pg_temp.deps(913)),'cycle','a correction cannot build a point from one that is built from it');
select throws_ok($$insert into ai.explorer_memory_point_dependency(point_id,version_number,depends_on_point_id,depends_on_version_number,depends_on_retired,actor_user_account_id)
  values(pg_temp.gid(905),2,pg_temp.gid(906),2,false,pg_temp.gid(1))$$,'P0001','solmind_explorer_memory_cycle','the table itself refuses "built from" in a circle');
select throws_ok($$insert into ai.explorer_memory_point_dependency(point_id,version_number,depends_on_point_id,depends_on_version_number,depends_on_retired,actor_user_account_id)
  values(pg_temp.gid(905),2,pg_temp.gid(902),1,false,pg_temp.gid(1))$$,'P0001','solmind_explorer_memory_conflict','a saved version is sealed: nothing can be added to what it was built from');
select throws_ok($$insert into ai.explorer_memory_point_source(point_id,version_number,source_slot,actor_user_account_id,
  source_message_id,source_conversation_id,speaker) values(pg_temp.gid(905),2,2,pg_temp.gid(1),pg_temp.m(32),pg_temp.gid(6003),'explorer')$$,
  'P0001','solmind_explorer_memory_conflict','nor to its sources, even while its conversation is open');
-- A retirement reaches what was built from the retired point.
select is(ai.solmind_memory_record_point_event_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(978),pg_temp.gid(912),'retired',null,pg_temp.m(33)),
  'recorded','the job point from B is retired');
select ok(ai.solmind_memory_point_stale_v1(pg_temp.gid(914)),'the point built from it before the retirement is out of date');
select is(ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(918),'Composed before the retirement.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(33)),pg_temp.dep_at(912,1,false)),'changed_dependency',
  'a wording composed while a point still applied is refused once that point has been retired');
select is(ai.solmind_memory_correct_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(914),1,'Staying at the job, as it was.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(32)),pg_temp.dep_at(912,1,true)),'corrected',
  'a wording composed knowing the point is retired is accepted');
select ok((select h#>'{builtFrom,1}'=jsonb_build_object('version',2,'pointId',pg_temp.gid(912),'pointVersion',1,'pointRetired',true)
    and not (h->>'stale')::boolean
  from ai.solmind_memory_point_history_v1(pg_temp.gid(1),pg_temp.gid(914)) h),
  'its history keeps the state it was composed from, and it is current again');
select is(ai.solmind_memory_correct_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(912),1,'In the autumn they were staying at their job.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(32)),'[]'::jsonb),'corrected','the history of a retired point can still be corrected');
select is((select is_current::text||'|'||version_number from ai.solmind_memory_points_v1(pg_temp.gid(1)) where point_id=pg_temp.gid(912)),
  'false|2','and the point stays retired');
select ok(ai.solmind_memory_point_stale_v1(pg_temp.gid(914)),'that correction puts the point built from it out of date again');
select throws_ok($$select ai.solmind_memory_correct_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(905),2,'No list given.',
  'explorer_words',true,pg_temp.whole(pg_temp.m(33)),null)$$,'P0001','solmind_explorer_memory_invalid_input',
  'a correction must say what it is built from, even if that is nothing');

select is(ai.solmind_memory_save_topic_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(807),'Hard evenings','explorer',pg_temp.m(33)),'saved','a topic first named in conversation B');
select is(ai.solmind_memory_link_topics_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(815),pg_temp.gid(803),pg_temp.gid(807),'virtual_guide',pg_temp.r(33)),'linked','a link to it from an earlier broad topic');
select is(ai.solmind_memory_link_topics_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(818),pg_temp.gid(808),pg_temp.gid(801),'virtual_guide',pg_temp.r(31)),'linked','a link made in B between two earlier topics');
select ok(ai.solmind_memory_link_topics_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(8801),pg_temp.gid(810),pg_temp.gid(802),'virtual_guide',pg_temp.r(32))='linked'
  and ai.solmind_memory_link_topics_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(8802),pg_temp.gid(810),pg_temp.gid(801),'virtual_guide',pg_temp.r(32))='linked',
  'two links made in B from the work topic, the only links it has');
select is(ai.solmind_memory_reword_topic_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(805),1,'The urn for Bruno','explorer',pg_temp.m(31)),'reworded','a topic gets a new wording');
select is(ai.solmind_memory_reword_topic_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(805),1,'The urn for Bruno','explorer',pg_temp.m(31)),'exact_replay','the same rewording twice saves once');
select is(ai.solmind_memory_reword_topic_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(805),1,'Another wording','virtual_guide',pg_temp.r(31)),'stale_wording','a rewording against a label that has moved on is turned away');
select throws_ok($$select ai.solmind_memory_reword_topic_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(805),2,'Another wording','virtual_guide',null)$$,
  'P0001','solmind_explorer_memory_invalid_input','a rewording needs a supporting message');
select ok((select w#>>'{0,label}'='The urn' and w#>>'{1,label}'='The urn for Bruno' and w#>>'{1,namedBy}'='explorer'
    and (w#>>'{0,recordedAt}')::timestamptz<=(w#>>'{1,recordedAt}')::timestamptz and jsonb_array_length(w)=2
    and w#>>'{0,messageId}'=pg_temp.r(11)::text and w#>>'{1,messageId}'=pg_temp.m(31)::text
  from ai.solmind_memory_topic_wordings_v1(pg_temp.gid(1),pg_temp.gid(805)) w),'the earlier wording of the topic is kept, each with its date and its supporting message');
select is((select label from ai.solmind_memory_topics_v1(pg_temp.gid(1)) where topic_id=pg_temp.gid(805)),'The urn for Bruno','the new wording is the current label');
select is(ai.solmind_memory_attach_point_topic_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(823),pg_temp.gid(905),pg_temp.gid(807)),'attached','the evenings point belongs to its topic');
select is(ai.solmind_memory_attach_point_topic_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(824),pg_temp.gid(903),pg_temp.gid(808)),'attached','a point is attached');
select is(ai.solmind_memory_detach_point_topic_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(824)),'detached','and detached again');
select is(ai.solmind_memory_detach_point_topic_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(824)),'exact_replay','detaching twice changes nothing');
select ok((select count(*)=0 from ai.solmind_memory_topic_points_v1(pg_temp.gid(1),pg_temp.gid(808)))
  and (select retired_at is not null from ai.explorer_memory_point_topic where attachment_id=pg_temp.gid(824)),
  'the detached point is no longer listed, and the attachment is kept as history');
select is(ai.solmind_memory_attach_point_topic_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(825),pg_temp.gid(902),pg_temp.gid(808)),'attached',
  'in B, the grandmother point from A is attached to the family topic from A');
select is((select jsonb_agg(p.point_id) from ai.solmind_memory_topic_points_v1(pg_temp.gid(1),pg_temp.gid(808)) p),pg_temp.ids(902),'and is listed under it');
alter table ai.explorer_compass_topic disable trigger explorer_compass_topic_guard;
insert into ai.explorer_compass_topic(topic_id,conversation_id,actor_user_account_id,topic_slot,label,created_operation_id,created_reply_message_id)
  values(pg_temp.gid(702),pg_temp.gid(6003),pg_temp.gid(1),1,'Sadness about my dog',pg_temp.o(31),pg_temp.r(31)),
    (pg_temp.gid(703),pg_temp.gid(6003),pg_temp.gid(1),2,'Hard evenings',pg_temp.o(33),pg_temp.r(33));
alter table ai.explorer_compass_topic enable trigger explorer_compass_topic_guard;
select is(ai.solmind_memory_bind_compass_topic_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(702),pg_temp.gid(801)),'bound',
  'the same lasting topic stands behind a Compass topic of a second conversation');
select is(pg_temp.point_ids(1),pg_temp.ids(901,902,903,904,905,906,907,909,910,912,913,915,916),
  'thirteen points are given out before anything is restricted (the fourteenth is out of date)');
select is((select count(*)::integer from ai.explorer_memory_point where actor_user_account_id=pg_temp.gid(1)),14,'fourteen are stored');
select is(pg_temp.related(1,803,'narrower'),jsonb_build_array(
  jsonb_build_array(pg_temp.gid(801),'Sadness about my dog',1),jsonb_build_array(pg_temp.gid(802),'Missing my grandmother',1),
  jsonb_build_array(pg_temp.gid(807),'Hard evenings',1),jsonb_build_array(pg_temp.gid(805),'The urn for Bruno',2)),'four topics below the broad one before anything is restricted');

-- Rows are kept: no memory row can be deleted or rewritten, in any table.
select throws_ok(format('delete from ai.%I',t),'P0001','solmind_explorer_memory_immutable','no row can be deleted: '||t)
  from unnest(array['explorer_memory_conversation','explorer_memory_topic','explorer_memory_topic_wording','explorer_memory_topic_link',
    'explorer_memory_topic_compass','explorer_memory_point','explorer_memory_point_version','explorer_memory_point_source',
    'explorer_memory_point_dependency','explorer_memory_point_event','explorer_memory_point_topic']) t;
select throws_ok(format('update ai.%I set retention_class=retention_class',t),'P0001','solmind_explorer_memory_immutable','no row can be rewritten: '||t)
  from unnest(array['explorer_memory_conversation','explorer_memory_topic','explorer_memory_topic_wording','explorer_memory_topic_link',
    'explorer_memory_topic_compass','explorer_memory_point','explorer_memory_point_version','explorer_memory_point_source',
    'explorer_memory_point_dependency','explorer_memory_point_event','explorer_memory_point_topic']) t;
select throws_ok($$update ai.explorer_memory_point_version set summary_text='Rewritten.' where point_id=pg_temp.gid(901) and version_number=1$$,
  'P0001','solmind_explorer_memory_immutable','an earlier wording cannot be rewritten');
select throws_ok($$update ai.explorer_memory_topic_link set retired_at=null,retired_conversation_id=null where link_id=pg_temp.gid(816)$$,
  'P0001','solmind_explorer_memory_immutable','a link taken back cannot be quietly restored');
select throws_ok($$update ai.explorer_memory_topic_link set retired_at=clock_timestamp(),retired_conversation_id=pg_temp.gid(6003),
  narrow_topic_id=pg_temp.gid(805) where link_id=pg_temp.gid(811)$$,'P0001','solmind_explorer_memory_immutable','taking a link back cannot change what it linked');

-- 6. Exclusion. First two rolled-back trials: suppose an earlier, already ended
-- conversation became restricted (set here by a privileged fixture write, undone
-- at once; no application path restricts an ended conversation today).
create function pg_temp.restricted_case(conv_n integer) returns jsonb language plpgsql as $$
declare result jsonb;
begin
  begin
    update ai.explorer_conversation_state set restricted_level=3,safety_version=safety_version+1
      where conversation_id=pg_temp.gid(conv_n);
    result:=jsonb_build_object('points',pg_temp.point_ids(1),'topics',pg_temp.topic_ids(1),
      'otherExplorerPoints',pg_temp.point_ids(4),
      'history902Gone',ai.solmind_memory_point_history_v1(pg_temp.gid(1),pg_temp.gid(902)) is null,
      'dogEvents',(select jsonb_agg(e->'eventId') from jsonb_array_elements(
        ai.solmind_memory_point_history_v1(pg_temp.gid(1),pg_temp.gid(901))->'events') e),
      'compassA',ai.solmind_memory_compass_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(701)),
      'rows',(select count(*) from ai.explorer_memory_point where actor_user_account_id=pg_temp.gid(1)));
    raise exception 'synthetic_rollback';
  exception when raise_exception then
    if sqlerrm<>'synthetic_rollback' then raise; end if;
  end;
  return result;
end $$;
create temp table a_case as select pg_temp.restricted_case(6002) as r;
select is((select r->'points' from a_case),pg_temp.ids(905,912),
  'were A restricted: every point that rests on A goes, and so do the point built from one of them and the point built from that, though their own sources are in B');
select is((select r->'topics' from a_case),pg_temp.ids(807),'were A restricted: every topic A named or reworded goes');
select ok((select (r->>'history902Gone')::boolean and r->'compassA'='null'::jsonb from a_case),'were A restricted: no history and no Compass binding is given out');
select is((select r->'otherExplorerPoints' from a_case),pg_temp.ids(951),'were A restricted: the other Explorer''s same-worded memory is untouched');
select is((select (r->>'rows')::integer from a_case),14,'were A restricted: nothing is erased');
create temp table a2_case as select pg_temp.restricted_case(6004) as r;
select is((select r->'points' from a2_case),pg_temp.ids(901,902,903,904,905,906,907,909,910,912,913),
  'were A2 restricted: the dog point stays, and the two points built from it, which may carry what its note said, go');
select is((select r->'dogEvents' from a2_case),jsonb_build_array(pg_temp.gid(971)),
  'were A2 restricted: the dog point keeps its other note and loses the one from A2');
select is(pg_temp.point_ids(1),pg_temp.ids(901,902,903,904,905,906,907,909,910,912,913,915,916),'the trials are undone: all thirteen points are back');

-- Now the real path: a crisis restricts conversation B.
select ok(pg_temp.send_crisis(39,'Synthetic crisis words.'),'fixture: a crisis reply in conversation B');
select is((select restricted_level::integer from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6003)),4,'conversation B is now restricted');
select is(pg_temp.point_ids(1),pg_temp.ids(901,902,907,910),
  'only the points that A alone wrote and supports are still given out');
select is((select jsonb_agg(e->'eventId') from jsonb_array_elements(ai.solmind_memory_point_history_v1(pg_temp.gid(1),pg_temp.gid(901))->'events') e),
  jsonb_build_array(pg_temp.gid(977)),'the dog point stays, with its note from A2 and without the note that came from the restricted conversation');
select ok(ai.solmind_memory_point_history_v1(pg_temp.gid(1),pg_temp.gid(905)) is null
  and ai.solmind_memory_point_history_v1(pg_temp.gid(1),pg_temp.gid(904)) is null
  and ai.solmind_memory_point_history_v1(pg_temp.gid(1),pg_temp.gid(906)) is null,
  'points from B, across A and B, or built from a B point give out no history');
select ok(ai.solmind_memory_point_history_v1(pg_temp.gid(1),pg_temp.gid(903)) is null,
  'the A point that B only retired is not given out as if it still applied');
select ok(ai.solmind_memory_point_history_v1(pg_temp.gid(1),pg_temp.gid(909)) is null,
  'the A point that B only corrected, from an A message, is not given out in its earlier wording');
select is(pg_temp.topic_ids(1),pg_temp.ids(801,802,803,808,810),'the topic named in B and the topic reworded in B are not given out');
select is(pg_temp.related(1,803,'narrower'),jsonb_build_array(
  jsonb_build_array(pg_temp.gid(801),'Sadness about my dog',1),jsonb_build_array(pg_temp.gid(802),'Missing my grandmother',1)),
  'the dog and the grandmother stay linked to the broad topic; what B added is not followed');
select is(pg_temp.related(1,808,'narrower'),jsonb_build_array(jsonb_build_array(pg_temp.gid(802),'Missing my grandmother',1)),
  'a link made in B between two earlier topics is not followed');
select is(pg_temp.related(1,801,'broader'),jsonb_build_array(jsonb_build_array(pg_temp.gid(803),'Loss of loved ones',1)),'and not the other way either');
select is(ai.solmind_memory_related_topics_v1(pg_temp.gid(1),pg_temp.gid(810),'narrower',8,500,1),
  '{"topics":[],"moreExist":true,"topicsExamined":0,"linksExamined":1}'::jsonb,
  'a walk cut short after one unusable link finds nothing and still says more may exist');
select is(ai.solmind_memory_related_topics_v1(pg_temp.gid(1),pg_temp.gid(810),'narrower'),
  '{"topics":[],"moreExist":false,"topicsExamined":0,"linksExamined":2}'::jsonb,
  'the same walk with room to look at both links finds nothing and says so plainly');
select ok((select count(*)=0 from ai.solmind_memory_topic_points_v1(pg_temp.gid(1),pg_temp.gid(808)))
  and pg_temp.point_ids(1) @> pg_temp.ids(902) and pg_temp.topic_ids(1) @> pg_temp.ids(808),
  'an attachment made in B between a point and a topic that both stay is not given out');
select is((select jsonb_agg(p.point_id) from ai.solmind_memory_topic_points_v1(pg_temp.gid(1),pg_temp.gid(802)) p),pg_temp.ids(902),'the attachment made in A is');
select ok(ai.solmind_memory_compass_topic_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(702)) is null
  and ai.solmind_memory_compass_topic_v1(pg_temp.gid(1),pg_temp.gid(6002),pg_temp.gid(701))=pg_temp.gid(801),
  'the Compass binding of B is not given out; the one of A is');
select ok(not ai.solmind_memory_message_usable_v1(pg_temp.m(33)) and not ai.solmind_memory_message_usable_v1(pg_temp.m(39))
  and ai.solmind_memory_message_usable_v1(pg_temp.m(11)),'every message of the restricted conversation, earlier ones too, stops supporting memory');
select ok(pg_temp.send_restricted(40,'Words sent for the crisis check only.'),'fixture: a crisis-check-only message in the restricted conversation');
select ok(ai.solmind_memory_source_speaker_v1(pg_temp.gid(1),pg_temp.m(40)) is null
  and ai.solmind_memory_source_speaker_v1(pg_temp.gid(1),pg_temp.r(40)) is null
  and ai.solmind_memory_source_speaker_v1(pg_temp.gid(1),pg_temp.m(33))='explorer'
  and exists(select 1 from ai.explorer_conversation_operation op where op.operation_id=pg_temp.o(40)
    and op.status='completed' and op.safety_request_mode='classification_only'),
  'a crisis-check-only message and its reply are nobody''s source, by their own kind and apart from the restriction');
select throws_ok(q,'P0001','solmind_explorer_memory_denied','nothing is written from the restricted conversation: '||what) from (values
  ('a point',$$select ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(911),'Said in the crisis.','explorer_words',false,pg_temp.whole(pg_temp.m(39)))$$),
  ('a point from earlier messages',$$select ai.solmind_memory_save_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(911),'From an earlier message.','explorer_words',false,pg_temp.whole(pg_temp.m(12)))$$),
  ('a correction',$$select ai.solmind_memory_correct_point_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(902),1,'Changed in the crisis.','explorer_words',false,pg_temp.whole(pg_temp.m(12)),'[]'::jsonb)$$),
  ('a dated update',$$select ai.solmind_memory_record_point_event_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(975),pg_temp.gid(902),'dated_note','A note.',pg_temp.m(33))$$),
  ('a retirement',$$select ai.solmind_memory_record_point_event_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(975),pg_temp.gid(902),'retired',null,pg_temp.m(33))$$),
  ('a topic',$$select ai.solmind_memory_save_topic_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(809),'Crisis','virtual_guide',pg_temp.r(31))$$),
  ('a rewording',$$select ai.solmind_memory_reword_topic_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(801),1,'Reworded in the crisis','virtual_guide',pg_temp.r(31))$$),
  ('a link',$$select ai.solmind_memory_link_topics_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(819),pg_temp.gid(808),pg_temp.gid(803),'virtual_guide',pg_temp.r(31))$$),
  ('a link taken back',$$select ai.solmind_memory_unlink_topics_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(811))$$),
  ('an attachment',$$select ai.solmind_memory_attach_point_topic_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(826),pg_temp.gid(902),pg_temp.gid(803))$$),
  ('a detachment',$$select ai.solmind_memory_detach_point_topic_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(822))$$),
  ('a Compass binding',$$select ai.solmind_memory_bind_compass_topic_v1(pg_temp.gid(1),pg_temp.gid(6003),pg_temp.gid(703),pg_temp.gid(802))$$)
) as attempts(what,q);
select throws_ok($$insert into ai.explorer_memory_point(point_id,actor_user_account_id,created_conversation_id)
  values(pg_temp.gid(911),pg_temp.gid(1),pg_temp.gid(6003))$$,'P0001','solmind_explorer_memory_conflict','the table itself refuses a write from the restricted conversation');
select is((select count(*)::integer from ai.explorer_memory_point where actor_user_account_id=pg_temp.gid(1)),14,'nothing was erased: all fourteen points are still stored');
select is((select count(*)::integer from ai.explorer_memory_point_event where point_id in (pg_temp.gid(901),pg_temp.gid(903))),3,'nor their dated history');
select is(pg_temp.point_ids(4),pg_temp.ids(951),'the other Explorer''s memory is untouched by the restriction');

-- 7. The end-of-transaction checks: everything saved above passes them, and a
-- bare row written past the functions does not. (Explorer two's conversation C
-- is the one still open for writing.)
select lives_ok($$set constraints ai.explorer_memory_topic_complete,ai.explorer_memory_point_complete,
  ai.explorer_memory_point_version_complete immediate$$,'every saved topic, point and version passes the end-of-transaction checks');
select throws_ok($$insert into ai.explorer_memory_point(point_id,actor_user_account_id,created_conversation_id)
  values(pg_temp.gid(990),pg_temp.gid(4),pg_temp.gid(6101))$$,'P0001','solmind_explorer_memory_unsupported','a point with no wording is refused');
select throws_ok($$insert into ai.explorer_memory_topic(topic_id,actor_user_account_id,created_conversation_id)
  values(pg_temp.gid(890),pg_temp.gid(4),pg_temp.gid(6101))$$,'P0001','solmind_explorer_memory_unsupported','a topic with no wording is refused');
select throws_ok($$insert into ai.explorer_memory_point_version(point_id,version_number,actor_user_account_id,summary_text,whose_words,recorded_conversation_id)
  values(pg_temp.gid(951),2,pg_temp.gid(4),'No source.','explorer_words',pg_temp.gid(6101))$$,'P0001','solmind_explorer_memory_unsupported','a wording with no source is refused');
set constraints ai.explorer_memory_topic_complete,ai.explorer_memory_point_complete,ai.explorer_memory_point_version_complete deferred;
select is(ai.solmind_memory_correct_point_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(951),1,'Their dog died in the spring; evenings feel lonely.',
  'explorer_words',true,pg_temp.whole(pg_temp.m(21)),'[]'::jsonb),'corrected','Explorer two''s memory still works normally afterwards');

-- 8. The adults-only stop (a reply that indicates the Explorer may be a minor).
-- It stops conversation C without restricting it.
select pg_temp.use_conversation(4,6101);
select ok(pg_temp.send_adult(51,'Synthetic words that indicate a minor.'),'fixture: an adults-only reply in conversation C');
select ok((select adult_reflection_stopped and restricted_level is null from ai.explorer_conversation_state
  where conversation_id=pg_temp.gid(6101)),'conversation C has the adults-only stop and is not restricted');
select throws_ok(q,'P0001','solmind_explorer_memory_denied','nothing is written from the adults-only-stopped conversation: '||what) from (values
  ('a point',$$select ai.solmind_memory_save_point_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(954),'Said before the stop.','explorer_words',false,pg_temp.whole(pg_temp.m(21)))$$),
  ('a correction',$$select ai.solmind_memory_correct_point_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(951),2,'Changed after the stop.','explorer_words',false,pg_temp.whole(pg_temp.m(21)),'[]'::jsonb)$$),
  ('a dated update',$$select ai.solmind_memory_record_point_event_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(982),pg_temp.gid(951),'dated_note','A note.',pg_temp.m(21))$$),
  ('a retirement',$$select ai.solmind_memory_record_point_event_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(982),pg_temp.gid(951),'retired',null,pg_temp.m(21))$$),
  ('a topic',$$select ai.solmind_memory_save_topic_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(852),'After the stop','virtual_guide',pg_temp.r(21))$$),
  ('a rewording',$$select ai.solmind_memory_reword_topic_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(851),1,'Reworded after the stop','virtual_guide',pg_temp.r(21))$$),
  ('a link',$$select ai.solmind_memory_link_topics_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(864),pg_temp.gid(851),pg_temp.gid(870),'virtual_guide',pg_temp.r(21))$$),
  ('a link taken back',$$select ai.solmind_memory_unlink_topics_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(8701))$$),
  ('an attachment',$$select ai.solmind_memory_attach_point_topic_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(869),pg_temp.gid(951),pg_temp.gid(870))$$),
  ('a detachment',$$select ai.solmind_memory_detach_point_topic_v1(pg_temp.gid(4),pg_temp.gid(6101),pg_temp.gid(868))$$)
) as attempts(what,q);
select is(pg_temp.point_ids(4),pg_temp.ids(951),
  'as built today, awaiting Paul: memory saved before the stop is still given out');
-- A later conversation cannot cite the stopped conversation's messages either.
select is(pg_temp.end_conversation(7101),'ok','fixture: conversation C ends');
select pg_temp.use_conversation(4,6102);
select is(pg_temp.start_conversation(),'created','fixture: Explorer two''s next conversation starts');
select is(ai.solmind_memory_enroll_conversation_v1(pg_temp.gid(4),pg_temp.gid(6102)),'enrolled','it joins memory');
select ok(pg_temp.send(52,'Hello again.'),'fixture: the next conversation has an answered message');
select ok(ai.solmind_memory_source_speaker_v1(pg_temp.gid(4),pg_temp.m(51))='explorer'
  and ai.solmind_memory_source_speaker_v1(pg_temp.gid(4),pg_temp.r(51))='virtual_guide'
  and ai.solmind_memory_message_usable_v1(pg_temp.m(51)) and not ai.solmind_memory_message_citable_v1(pg_temp.m(51)),
  'the stopped turn looks like an ordinary answered turn; only the stop keeps it from being cited');
select throws_ok(q,'P0001','solmind_explorer_memory_denied','a later conversation cannot cite '||what) from (values
  ('the message that led to the stop',$$select ai.solmind_memory_save_point_v1(pg_temp.gid(4),pg_temp.gid(6102),pg_temp.gid(955),'From the stopped turn.','explorer_words',false,pg_temp.whole(pg_temp.m(51)))$$),
  ('the adults-only reply',$$select ai.solmind_memory_save_point_v1(pg_temp.gid(4),pg_temp.gid(6102),pg_temp.gid(955),'From the adults-only reply.','virtual_guide_reading',false,pg_temp.whole(pg_temp.r(51)))$$),
  ('an earlier message of the stopped conversation',$$select ai.solmind_memory_save_point_v1(pg_temp.gid(4),pg_temp.gid(6102),pg_temp.gid(955),'From before the stop.','explorer_words',false,pg_temp.whole(pg_temp.m(21)))$$),
  ('the stopped turn beside a good source',$$select ai.solmind_memory_correct_point_v1(pg_temp.gid(4),pg_temp.gid(6102),pg_temp.gid(951),2,'With a mixed source.','explorer_words',false,pg_temp.whole(pg_temp.m(52),pg_temp.m(51)),'[]'::jsonb)$$)
) as attempts(what,q);
select is(ai.solmind_memory_save_point_v1(pg_temp.gid(4),pg_temp.gid(6102),pg_temp.gid(955),'They said hello again.',
  'explorer_words',false,pg_temp.whole(pg_temp.m(52))),'saved','the later conversation saves from its own messages as usual');
-- The next write pretends to be the save step of that new version, in the open conversation.
select set_config('solmind_memory.open_version',pg_temp.gid(955)::text||':1',true);
select throws_ok($$insert into ai.explorer_memory_point_source(point_id,version_number,source_slot,actor_user_account_id,
  source_message_id,source_conversation_id,speaker) values(pg_temp.gid(955),1,2,pg_temp.gid(4),pg_temp.m(51),pg_temp.gid(6101),'explorer')$$,
  'P0001','solmind_explorer_memory_conflict','the table itself refuses the stopped turn as a source of a version in the open conversation');
select lives_ok($$insert into ai.explorer_memory_point_source(point_id,version_number,source_slot,actor_user_account_id,
  source_message_id,source_conversation_id,speaker) values(pg_temp.gid(955),1,2,pg_temp.gid(4),pg_temp.r(52),pg_temp.gid(6102),'virtual_guide')$$,
  'and the same write with a message of the open conversation passes, so the stop alone refused it');
select set_config('solmind_memory.open_version','',true);

select * from finish();
rollback;
