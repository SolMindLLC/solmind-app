-- Step 1 saved Waypoint offers. Synthetic, rollback-only, plain psql proof.
-- Auth, governance and provider responses below are invented fixtures.
-- Authored only; the Executor runs this file on its owned test database.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,pg_catalog,pg_temp;
set local statement_timeout='120s';
select plan(181);

create function pg_temp.gid(n integer) returns uuid language sql immutable as $$
  select ('f47f0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
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
create function pg_temp.offer_context() returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',o.waypoint_offer_id,'kind',o.offer_kind,
    'waypointId',o.target_waypoint_id,'stage',case o.target_stage when 'chosen' then 'formed' else o.target_stage end,
    'suggestedInPreviousReply',coalesce(o.suggestion_message_id=(select m.ai_interaction_message_id
      from ai.ai_interaction_message m where m.ai_interaction_session_id=pg_temp.gid(6005)
        and m.sender_type='ai' and m.ai_role='solmind_virtual_guide'
      order by m.sequence_number desc limit 1),false))
    ||case when o.offer_kind='reached' then jsonb_build_object('evidence',ai.solmind_exclusion_normalize_v3(o.evidence))
      else jsonb_build_object('title',ai.solmind_exclusion_normalize_v3(o.title),
        'destination',ai.solmind_exclusion_normalize_v3(o.destination),
        'whyItMatters',ai.solmind_exclusion_normalize_v3(o.why_it_matters),
        'arrivalSignal',ai.solmind_exclusion_normalize_v3(o.arrival_signal)) end),'[]'::jsonb)
  from content.waypoint_offer o where o.source_ai_interaction_session_id=pg_temp.gid(6005) and o.offer_status='proposed'
$$;
create function pg_temp.reached_ids() returns jsonb language sql stable as $$
  with recursive ancestry as (
    select waypoint_id,waypoint_id as ancestor,predecessor_waypoint_id from content.waypoint
      where source_ai_interaction_session_id=pg_temp.gid(6005)
    union all select a.waypoint_id,w.waypoint_id,w.predecessor_waypoint_id from ancestry a
      join content.waypoint w on w.waypoint_id=a.predecessor_waypoint_id
  ), heads as (
    select w.* from content.waypoint w where source_ai_interaction_session_id=pg_temp.gid(6005)
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
  with forming_move as (select ai.solmind_forming_attention_move_v1(pg_temp.gid(6005)) as value),
  moves as (
    select o.kind,o.completed_at,o.compass_route_kind,o.compass_route_item_id,o.initial_revision,o.operation_id
    from ai.explorer_conversation_operation o where o.conversation_id=pg_temp.gid(6005) and o.compass_route_kind='attention_changed'
    union all
    select 'set_attention',(value->>'recordedAt')::timestamptz,'attention_changed',(value->>'pointId')::uuid,
      (value->>'revision')::integer-1,null::uuid from forming_move where value is not null
  )
  select jsonb_build_object('version','explorer-compass-context.v9','immediateMessageIsReplyChoice',false,
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
        and d.draft_status='proposed'),'[]'::jsonb),
    'offers',pg_temp.offer_context(),'reachedOfferedWaypointIds',pg_temp.reached_ids())
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
    union all select waypoint_offer_id from content.waypoint_offer
      where source_ai_interaction_session_id=pg_temp.gid(6005) and offer_status='proposed'
    union all select topic_id from ai.explorer_compass_topic where conversation_id=pg_temp.gid(6005)
    union all select support_message_id from ai.explorer_compass_topic_support where conversation_id=pg_temp.gid(6005)) x
$$;
create function pg_temp.context_value(msg uuid,body text,classification_only boolean default false) returns jsonb language sql stable as $$
  select jsonb_build_object('contractVersion',case when classification_only then 'wi007-v0.1+onboarding-fields-v2'
    else 'wi007-v0.1+onboarding-fields-v2+compass-v9' end,'aiRole','solmind_virtual_guide','actorRoleContext','explorer',
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
  interested boolean default true,fallback_override integer default null,attention_n integer default null,choices jsonb default null,suggestions jsonb default null,attention_id uuid default null,responses jsonb default null,waypoint jsonb default null,waypoint_response jsonb default null,
  offer jsonb default null,offer_response jsonb default null,offer_drop jsonb default null)
returns table(outcome text,conversation_state jsonb,policy_state jsonb,saved_reply boolean)
language sql as $$
  select * from public.solmind_settle_explorer_conversation_turn_v4(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(10000+slot_n*10),status_name,case when kind='none' then null else pg_temp.gid(10005+slot_n*10) end,
    kind,case when kind='none' then null else body end,model::smallint,minor_flag,'explorer-safety-reply.v2',
    (select mode from lifecycle_intent where slot=slot_n),repeat('A',64),'synthetic-fallback.v1',
    'synthetic-model-policy.v1','synthetic-trusted.v1','synthetic-resources.v1',
    coalesce(fallback_override,(select fallback from lifecycle_intent where slot=slot_n))::smallint,
    (select minor from lifecycle_intent where slot=slot_n),interested,
    coalesce(attention_id,case when attention_n is null then null else pg_temp.gid(attention_n) end),choices,suggestions,responses,waypoint,waypoint_response,
    p_waypoint_offer=>offer,p_waypoint_offer_response=>offer_response,p_waypoint_offer_drop=>offer_drop)
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
create function pg_temp.suggestion(title_text text default 'Find a calmer start to mornings') returns jsonb language sql immutable as $$
  select jsonb_build_object('title',title_text,'destination','Start my morning without rushing.',
    'whyItMatters','I want room to think before work.','arrivalSignal','I start two mornings with time for breakfast.')
$$;
create function pg_temp.send_waypoint(slot_n integer,value jsonb) returns boolean language plpgsql as $$
begin
  if not exists(select 1 from pg_temp.prepare_private(slot_n) where outcome='ok' and dispatch_permitted) then return false; end if;
  return exists(select 1 from pg_temp.settle_private(slot_n,waypoint=>value) where outcome='ok' and saved_reply);
end $$;
create function pg_temp.answer_draft(op_n integer,draft_id uuid,response_name text,revision_override integer default null,
  fingerprint_override text default null) returns text language sql as $$
  select outcome from public.solmind_respond_explorer_waypoint_draft_v1(
    pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(op_n),
    coalesce(revision_override,(select initial_revision from ai.explorer_conversation_operation
      where actor_user_account_id=pg_temp.gid(1) and operation_id=pg_temp.gid(op_n)),
      (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005))),
    coalesce(fingerprint_override,pg_temp.request_sha(op_n)),draft_id,response_name)
$$;
create function pg_temp.inspect(value jsonb,source_override uuid[] default null) returns text language sql as $$
  select outcome from ai.solmind_inspect_explorer_context_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(24),
    pg_temp.gid(25),pg_temp.gid(6005),pg_temp.compact(value),coalesce(source_override,
    (select array_agg(distinct id order by id) from (
      select unnest(array[pg_temp.gid(52),(value#>>'{immediateExplorerMessage,messageId}')::uuid,pg_temp.gid(1001)]) id
      union all select ai_interaction_message_id from (select * from ai.ai_interaction_message
        where ai_interaction_session_id=pg_temp.gid(6005) order by sequence_number desc limit 24) messages
      union all select unnest(pg_temp.compass_source_ids()) where value ? 'compassContext') ids)))
$$;

create function pg_temp.offer_value(kind_name text default 'change',target uuid default pg_temp.gid(80001),
  destination_text text default 'A clearer synthetic destination') returns jsonb language sql immutable as $$
  select jsonb_build_object('kind',kind_name,'waypointId',target)||case when kind_name='reached'
    then jsonb_build_object('evidence','Synthetic arrival.') else jsonb_build_object('title','A synthetic offer',
      'destination',destination_text,'whyItMatters','Synthetic meaning','arrivalSignal','Synthetic signal') end
$$;
create function pg_temp.send_offer(slot_n integer,value jsonb) returns boolean language plpgsql as $$
begin
  if not exists(select 1 from pg_temp.prepare_private(slot_n) where outcome='ok' and dispatch_permitted)
    then raise exception 'fixture_offer_prepare'; end if;
  return exists(select 1 from pg_temp.settle_private(slot_n,offer=>value) where outcome='ok' and saved_reply);
end $$;
create function pg_temp.answer_offer(op_n integer,offer_id uuid,response_name text,revision_override integer default null,
  fingerprint_override text default null) returns table(outcome text,conversation_state jsonb,operation_result jsonb)
language sql as $$
  select * from public.solmind_respond_explorer_waypoint_offer_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(op_n),coalesce(revision_override,(select initial_revision from ai.explorer_conversation_operation
      where actor_user_account_id=pg_temp.gid(1) and operation_id=pg_temp.gid(op_n)),
      (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005))),
    coalesce(fingerprint_override,pg_temp.request_sha(op_n)),offer_id,response_name)
$$;
create function pg_temp.mark_reached(target_waypoint uuid) returns void language sql as $$
  update content.waypoint set lifecycle_status='reached',reached_by_explorer_user_account_id=pg_temp.gid(1),
    reached_at=clock_timestamp(),reached_evidence='Synthetic arrival.' where waypoint_id=target_waypoint
$$;
create function pg_temp.add_waypoint(waypoint uuid,predecessor uuid default null,conv uuid default pg_temp.gid(6005),
  source_id uuid default pg_temp.gid(10015)) returns void language sql as $$
  insert into content.waypoint(waypoint_id,guide_explorer_relationship_id,source_ai_interaction_session_id,source_message_id,
    title,destination,why_it_matters,arrival_signal,lifecycle_status,chosen_by_explorer_user_account_id,chosen_at,
    predecessor_waypoint_id,creation_reason)
  values(waypoint,pg_temp.gid(25),conv,source_id,'Synthetic original','Synthetic destination','Synthetic meaning',
    'Synthetic signal','chosen',pg_temp.gid(1),clock_timestamp(),predecessor,case when predecessor is not null then 'revision' end)
$$;
create function pg_temp.release(waypoint uuid) returns void language plpgsql as $$
begin
  if not exists(select 1 from public.solmind_release_explorer_waypoint_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(75000),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),
    pg_temp.request_sha(75000),waypoint) where outcome='ok') then raise exception 'fixture_release'; end if;
end;
$$;
do $$ begin
  if not exists(select 1 from pg_temp.prepare_private(1,body_override=>'Synthetic arrival.') where outcome='ok' and dispatch_permitted)
    or not exists(select 1 from pg_temp.settle_private(1) where outcome='ok' and saved_reply)
    then raise exception 'fixture_base_send'; end if;
  perform pg_temp.add_waypoint(pg_temp.gid(80001));
end $$;

-- Each scenario rolls its changes back, then exposes facts to assertions outside
-- the rollback scope. No assertion can disappear with its fixture transaction.
-- Step 2 golden compassContext texts: copy the bytes inside each named dollar
-- quote. These are literal expectations, independent of the SQL context builder.
create function pg_temp.expected_change_offer_context() returns text language sql immutable as $$
  select $change_offer${"attentionId":null,"capacity":{"originalsRemaining":24,"topicSlotsRemaining":24,"visibleSlotsRemaining":8},"drafts":[],"immediateMessageIsReplyChoice":false,"messageRefs":{"history":[{"order":0,"ref":"h0"},{"order":2,"ref":"h2"}],"immediate":"now"},"mode":"automatic","offers":[{"arrivalSignal":"Synthetic signal","destination":"A clearer synthetic destination","id":"7291b0c8-3ff0-5279-b7e1-c955943ce37c","kind":"change","stage":"formed","suggestedInPreviousReply":true,"title":"A synthetic offer","waypointId":"f47f0000-0000-4000-8000-000000080001","whyItMatters":"Synthetic meaning"}],"points":[],"priorityId":null,"reachedOfferedWaypointIds":[],"recentRoute":[],"topics":[],"version":"explorer-compass-context.v9","waypoints":[{"arrivalSignal":"Synthetic signal","destination":"Synthetic destination","id":"f47f0000-0000-4000-8000-000000080001","meaning":"Synthetic meaning","reachedEvidence":null,"stage":"formed","title":"Synthetic original"}]}$change_offer$
$$;
create function pg_temp.expected_reached_offer_context() returns text language sql immutable as $$
  select $reached_offer${"attentionId":null,"capacity":{"originalsRemaining":24,"topicSlotsRemaining":24,"visibleSlotsRemaining":8},"drafts":[],"immediateMessageIsReplyChoice":false,"messageRefs":{"history":[{"order":0,"ref":"h0"},{"order":2,"ref":"h2"}],"immediate":"now"},"mode":"automatic","offers":[{"evidence":"Synthetic arrival.","id":"7291b0c8-3ff0-5279-b7e1-c955943ce37c","kind":"reached","stage":"formed","suggestedInPreviousReply":true,"waypointId":"f47f0000-0000-4000-8000-000000080001"}],"points":[],"priorityId":null,"reachedOfferedWaypointIds":["f47f0000-0000-4000-8000-000000080001"],"recentRoute":[],"topics":[],"version":"explorer-compass-context.v9","waypoints":[{"arrivalSignal":"Synthetic signal","destination":"Synthetic destination","id":"f47f0000-0000-4000-8000-000000080001","meaning":"Synthetic meaning","reachedEvidence":null,"stage":"formed","title":"Synthetic original"}]}$reached_offer$
$$;
create function pg_temp.expected_reached_offered_context() returns text language sql immutable as $$
  select $reached_offered${"attentionId":null,"capacity":{"originalsRemaining":24,"topicSlotsRemaining":24,"visibleSlotsRemaining":8},"drafts":[],"immediateMessageIsReplyChoice":false,"messageRefs":{"history":[{"order":0,"ref":"h0"},{"order":2,"ref":"h2"}],"immediate":"now"},"mode":"automatic","offers":[],"points":[],"priorityId":null,"reachedOfferedWaypointIds":["f47f0000-0000-4000-8000-000000080001"],"recentRoute":[],"topics":[],"version":"explorer-compass-context.v9","waypoints":[{"arrivalSignal":"Synthetic signal","destination":"Synthetic destination","id":"f47f0000-0000-4000-8000-000000080001","meaning":"Synthetic meaning","reachedEvidence":null,"stage":"formed","title":"Synthetic original"}]}$reached_offered$
$$;
create function pg_temp.golden_offer_case(case_name text,expected_context text) returns jsonb language plpgsql as $$
declare result jsonb; offer_id uuid;
begin
  begin
    if not pg_temp.send_offer(2,pg_temp.offer_value(case when case_name='change' then 'change' else 'reached' end))
      then raise exception 'fixture_golden_offer'; end if;
    if case_name='reached_declined' then
      select waypoint_offer_id into offer_id from content.waypoint_offer where offer_status='proposed';
      if not exists(select 1 from pg_temp.answer_offer(79991,offer_id,'not_it') where outcome='ok')
        then raise exception 'fixture_golden_decline'; end if;
    end if;
    result:=jsonb_build_object('compact',pg_temp.compact(pg_temp.compass_context()),
      'inspected',pg_temp.inspect(jsonb_set(pg_temp.context_value(pg_temp.gid(99901),'Synthetic next message.'),
        '{compassContext}',expected_context::jsonb)));
    raise exception using errcode='P0715',message='rollback_synthetic_fixture';
  exception when sqlstate 'P0715' then null; end;
  return result;
end $$;
create temp table golden_offer_cases as select name,expected_context,pg_temp.golden_offer_case(name,expected_context) value
  from (values ('change',pg_temp.expected_change_offer_context()),('reached',pg_temp.expected_reached_offer_context()),
    ('reached_declined',pg_temp.expected_reached_offered_context())) fixtures(name,expected_context);
select is(convert_to(value->>'compact','UTF8'),convert_to(expected_context,'UTF8'),
  'literal compassContext golden is byte-equal to compact context: '||name) from golden_offer_cases order by name;
select is(value->>'inspected','clear','inspector accepts the literal compassContext golden: '||name)
  from golden_offer_cases order by name;

create function pg_temp.foreign_target(other_owner boolean) returns uuid language plpgsql as $$
declare actor uuid:=case when other_owner then pg_temp.gid(4) else pg_temp.gid(1) end;
  explorer uuid:=case when other_owner then pg_temp.gid(26) else pg_temp.gid(24) end;
  relation uuid:=case when other_owner then pg_temp.gid(27) else pg_temp.gid(25) end;
begin
  insert into ai.ai_interaction_session(ai_interaction_session_id,session_type,actor_user_account_id,actor_role_context,
    guide_profile_id,explorer_profile_id,guide_explorer_relationship_id,practice_id,metadata)
  values(pg_temp.gid(9906),'explorer_reflection',actor,'explorer',pg_temp.gid(23),explorer,relation,pg_temp.gid(22),'{"restricted_mode":false}');
  insert into ai.explorer_conversation_state(conversation_id,actor_user_account_id,safety_contract_version,
    restricted_level,adult_reflection_stopped,safety_version)
  values(pg_temp.gid(9906),actor,'explorer-conversation-safety.v1',null,false,0);
  insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
    sender_type,sender_user_account_id,sender_role_context,content_text)
  values(pg_temp.gid(99061),pg_temp.gid(9906),1,'user',actor,'explorer','Synthetic other source.');
  update ai.ai_interaction_session set session_status='ended',ended_at=clock_timestamp() where ai_interaction_session_id=pg_temp.gid(9906);
  insert into content.waypoint(waypoint_id,guide_explorer_relationship_id,source_ai_interaction_session_id,source_message_id,
    title,destination,why_it_matters,arrival_signal,lifecycle_status,chosen_by_explorer_user_account_id,chosen_at)
  values(pg_temp.gid(89998),relation,pg_temp.gid(9906),pg_temp.gid(99061),'Other synthetic target',
    'Synthetic destination','Synthetic meaning','Synthetic signal','chosen',actor,clock_timestamp());
  return pg_temp.gid(89998);
end $$;
create function pg_temp.creation_case(case_name text) returns jsonb language plpgsql as $$
declare result jsonb; value jsonb:=pg_temp.offer_value(); drop_value jsonb; draft_value jsonb;
  settled record; replayed record; snapshot jsonb; slot_n integer:=2; level_n integer:=0; minor_n boolean:=false;
  reply_kind text:='ordinary'; target uuid:=pg_temp.gid(80001); previous_offer uuid; same_replay boolean;
begin
  begin
    if case_name like 'reached%' or case_name like 'evidence%' or case_name like 'once_%' then value:=pg_temp.offer_value('reached'); end if;
    if case_name in ('revisit_reached','revisit_five') then
      perform pg_temp.mark_reached(target); value:=pg_temp.offer_value('revisit',target,'Synthetic destination');
      if case_name='revisit_five' then for i in 2..5 loop
        perform pg_temp.add_waypoint(pg_temp.gid(80000+i)); perform pg_temp.mark_reached(pg_temp.gid(80000+i));
      end loop; end if;
    elsif case_name='revisit_released' then
      perform pg_temp.release(target); value:=pg_temp.offer_value('revisit',target,'Synthetic destination');
    elsif case_name='revisit_formed' then value:=pg_temp.offer_value('revisit');
    elsif case_name in ('change_reached','reached_reached') then perform pg_temp.mark_reached(target);
    elsif case_name in ('change_released','reached_released') then perform pg_temp.release(target);
    elsif case_name='missing_target' then value:=pg_temp.offer_value('change',pg_temp.gid(89999));
    elsif case_name in ('other_owner','other_conversation') then value:=pg_temp.offer_value('change',pg_temp.foreign_target(case_name='other_owner'));
    elsif case_name='relationship_mismatch' then
      insert into content.waypoint select (jsonb_populate_record(null::content.waypoint,
        (select to_jsonb(w)||jsonb_build_object('waypoint_id',pg_temp.gid(80002),
          'guide_explorer_relationship_id',pg_temp.gid(27)) from content.waypoint w where waypoint_id=target))).*;
      value:=pg_temp.offer_value('change',pg_temp.gid(80002));
    elsif case_name='noncurrent_target' then perform pg_temp.add_waypoint(pg_temp.gid(80002),target);
    elsif case_name='no_change' then value:=pg_temp.offer_value('change',target,'Synthetic destination');
    elsif case_name='invalid' then value:=value||'{"extra":true}'::jsonb;
    elsif case_name='invalid_scalar' then value:='42'::jsonb;
    elsif case_name='invalid_array' then value:='[]'::jsonb;
    elsif case_name='invalid_json_null' then value:='null'::jsonb;
    elsif case_name='application_invalid' then value:=null; drop_value:='{"kind":"change","reason":"invalid"}';
    elsif case_name='competing_draft' then draft_value:=pg_temp.suggestion();
    elsif case_name='level2' then level_n:=2;
    elsif case_name='restricted' then level_n:=3; reply_kind:='urgent';
    elsif case_name='crisis' then level_n:=4; reply_kind:='crisis';
    elsif case_name='restricted_reply' then
      if not exists(select 1 from pg_temp.observe(99,3) where outcome='ok') then raise exception 'fixture_restricted_floor'; end if;
      reply_kind:='restricted';
    elsif case_name='adult' then minor_n:=true; reply_kind:='adult_only';
    elsif case_name='evidence_difference' then value:=jsonb_set(value,'{evidence}','"Synthetic Arrival."');
    elsif case_name='evidence_guide_only' then value:=jsonb_set(value,'{evidence}','"Synthetic saved reply."');
    elsif case_name in ('evidence_crlf','evidence_cr','evidence_spaces') then
      insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
        sender_type,sender_user_account_id,sender_role_context,content_text)
      values(pg_temp.gid(90001),pg_temp.gid(6005),3,'user',pg_temp.gid(1),'explorer',
        case case_name when 'evidence_crlf' then E'\r\nSynthetic first.\r\nSynthetic second.\r\n'
          when 'evidence_cr' then E'\rSynthetic first.\rSynthetic second.\r'
          else U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFFSynthetic first.\000ASynthetic second.\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF' end);
      value:=jsonb_set(value,'{evidence}',to_jsonb(case case_name
        when 'evidence_crlf' then E'\r\nSynthetic first.\r\nSynthetic second.\r\n'
        when 'evidence_cr' then E'\rSynthetic first.\rSynthetic second.\r'
        else U&'\00A0\FEFFSynthetic first.\000ASynthetic second.\3000\0020' end));
    elsif case_name in ('once_superseded','once_successor') then
      if not pg_temp.send_offer(2,value) then raise exception 'fixture_first_reached'; end if;
      select waypoint_offer_id into previous_offer from content.waypoint_offer where offer_status='proposed';
      perform pg_temp.add_waypoint(pg_temp.gid(80002));
      if not pg_temp.send_offer(3,pg_temp.offer_value('change',pg_temp.gid(80002))) then raise exception 'fixture_superseding'; end if;
      slot_n:=4;
      if case_name='once_successor' then
        perform pg_temp.add_waypoint(pg_temp.gid(80003),target); value:=pg_temp.offer_value('reached',pg_temp.gid(80003));
      end if;
    end if;
    if (level_n>=3 or minor_n) and not exists(select 1 from pg_temp.observe(slot_n,level_n,minor_n) where outcome='ok')
      then raise exception 'fixture_observe'; end if;
    if not exists(select 1 from pg_temp.prepare_private(slot_n,level_n,minor_n) where outcome='ok' and dispatch_permitted)
      then raise exception 'fixture_prepare'; end if;
    select * into settled from pg_temp.settle_private(slot_n,model=>level_n,minor_flag=>minor_n,kind=>reply_kind,
      offer=>value,offer_drop=>drop_value,waypoint=>draft_value,interested=>case_name<>'uninterested');
    snapshot:=jsonb_build_object('state',pg_temp.state(),'offers',(select jsonb_agg(to_jsonb(o) order by waypoint_offer_id) from content.waypoint_offer o),
      'events',(select jsonb_agg(to_jsonb(e) order by event_id) from ai.explorer_waypoint_offer_event e),
      'operations',(select count(*) from ai.explorer_conversation_operation),'messages',(select count(*) from ai.ai_interaction_message));
    select * into replayed from pg_temp.settle_private(slot_n,model=>level_n,minor_flag=>minor_n,kind=>reply_kind,
      offer=>value,offer_drop=>drop_value,waypoint=>draft_value,interested=>case_name<>'uninterested');
    same_replay:=snapshot=jsonb_build_object('state',pg_temp.state(),
      'offers',(select jsonb_agg(to_jsonb(o) order by waypoint_offer_id) from content.waypoint_offer o),
      'events',(select jsonb_agg(to_jsonb(e) order by event_id) from ai.explorer_waypoint_offer_event e),
      'operations',(select count(*) from ai.explorer_conversation_operation),'messages',(select count(*) from ai.ai_interaction_message));
    result:=jsonb_build_object('saved',settled.saved_reply,'outcome',settled.outcome,'state',pg_temp.state(),
      'offers',(select coalesce(jsonb_agg(to_jsonb(o) order by created_at,waypoint_offer_id),'[]') from content.waypoint_offer o),
      'drop',(select to_jsonb(e) from ai.explorer_waypoint_offer_event e where operation_id=pg_temp.gid(10000+slot_n*10) and event_kind='offer_dropped'),
      'oldStatus',(select offer_status from content.waypoint_offer where waypoint_offer_id=previous_offer),
      'replay',replayed.outcome,'replayUnchanged',same_replay,
      'context',pg_temp.inspect(pg_temp.context_value(pg_temp.gid(99901),'Synthetic next message.',
        level_n>=3 or minor_n or case_name='restricted_reply')));
    raise exception using errcode='P0711',message='rollback_synthetic_fixture';
  exception when sqlstate 'P0711' then null; end;
  return result;
end $$;
create temp table creation_cases as select name,pg_temp.creation_case(name) value from unnest(array[
  'change','reached','revisit_reached','revisit_released','revisit_five','revisit_formed','change_reached','change_released',
  'reached_reached','reached_released','missing_target','other_owner','other_conversation','relationship_mismatch','noncurrent_target','no_change',
  'invalid','invalid_scalar','invalid_array','invalid_json_null','application_invalid',
  'competing_draft','level2','restricted','crisis','restricted_reply','adult','uninterested',
  'evidence_difference','evidence_guide_only','evidence_crlf','evidence_cr','evidence_spaces',
  'once_superseded','once_successor']) name;

select ok((value->>'saved')::boolean and jsonb_array_length(value->'offers')=1 and value->'drop'='null'::jsonb,
  'creation accepts '||name) from creation_cases where name in ('change','reached','revisit_reached','revisit_released','revisit_five',
    'evidence_crlf','evidence_cr','evidence_spaces') order by name;
select is(value#>>'{drop,reason}',case when name like 'invalid%' or name='application_invalid' then 'invalid'
  when name in ('evidence_difference','evidence_guide_only') then 'evidence_not_found' when name='no_change' then 'no_change'
  when name in ('once_superseded','once_successor') then 'already_offered'
  when name='level2' then 'not_allowed_now' else 'target_not_available' end,
  'creation refuses '||name||' with its closed drop reason') from creation_cases where name not in
  ('change','reached','revisit_reached','revisit_released','revisit_five','evidence_crlf','evidence_cr','evidence_spaces',
    'competing_draft','uninterested','restricted','crisis','restricted_reply','adult') order by name;
select ok((value->>'saved')::boolean and jsonb_array_length(value->'offers')=0 and value->'drop'='null'::jsonb
  and value#>'{state,waypointOfferDrop}'='null'::jsonb,
  'non-ordinary reply saves no offer or drop receipt: '||name) from creation_cases
  where name in ('restricted','crisis','restricted_reply','adult') order by name;
select ok(bool_and(value#>'{state,waypointOffer,targetCurrent}'='true'::jsonb),
  'new offers expose a current target snapshot') from creation_cases where name in
  ('change','reached','revisit_reached','revisit_released','revisit_five','evidence_crlf','evidence_cr','evidence_spaces');
select ok(bool_and((value->>'saved')::boolean and (value->>'replayUnchanged')::boolean and value->>'replay'='exact_replay'),
  'every creation or drop saves its reply and settlement replay writes nothing twice') from creation_cases where name<>'uninterested';
select ok(value->>'saved'='false' and jsonb_array_length(value->'offers')=0 and value->'drop'='null'::jsonb
  and value->>'replay'='exact_replay' and (value->>'replayUnchanged')::boolean,
  'uninterested delivery saves no reply, offer or drop and replays without another write') from creation_cases where name='uninterested';
select ok(bool_and(jsonb_array_length(value->'offers')=0),'every ordinary drop creates no offer row') from creation_cases
  where name not in ('change','reached','revisit_reached','revisit_released','revisit_five','evidence_crlf','evidence_cr','evidence_spaces',
    'once_superseded','once_successor','competing_draft');
select ok(value#>>'{oldStatus}'='superseded' and value#>>'{drop,reason}'='already_offered',
  'superseded Reached consumes its chance for '||name) from creation_cases where name in ('once_superseded','once_successor');
select ok(jsonb_array_length(value->'offers')=0 and value->'drop'='null'::jsonb,
  'same-reply draft competition creates neither offer nor dropped-offer receipt') from creation_cases where name='competing_draft';
select ok(bool_and(value#>>'{offers,0,evidence}'=E'Synthetic first.\nSynthetic second.'),
  'CRLF, CR and all tested outer whitespace store and show the same normalized evidence') from creation_cases
  where name in ('evidence_crlf','evidence_cr','evidence_spaces');
select ok(bool_and(value->>'context'='clear'),'v9 inspector accepts independently constructed contexts with and without an offer') from creation_cases;

create function pg_temp.fill_capacity(history boolean) returns void language plpgsql as $$
declare previous uuid;
begin
  if history then
    for i in 1..199 loop
      perform pg_temp.add_waypoint(pg_temp.gid(82000+i),previous); previous:=pg_temp.gid(82000+i);
    end loop;
  else
    insert into ai.ai_interaction_session(ai_interaction_session_id,session_type,actor_user_account_id,actor_role_context,
      guide_profile_id,explorer_profile_id,guide_explorer_relationship_id,practice_id,metadata)
    values(pg_temp.gid(9905),'explorer_reflection',pg_temp.gid(1),'explorer',pg_temp.gid(23),pg_temp.gid(24),pg_temp.gid(25),
      pg_temp.gid(22),'{"restricted_mode":false}');
    insert into ai.explorer_conversation_state(conversation_id,actor_user_account_id,safety_contract_version,
      restricted_level,adult_reflection_stopped,safety_version)
    values(pg_temp.gid(9905),pg_temp.gid(1),'explorer-conversation-safety.v1',null,false,0);
    insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
      sender_type,sender_user_account_id,sender_role_context,content_text)
    values(pg_temp.gid(99051),pg_temp.gid(9905),1,'user',pg_temp.gid(1),'explorer','Synthetic earlier source.');
    update ai.ai_interaction_session set session_status='ended',ended_at=clock_timestamp() where ai_interaction_session_id=pg_temp.gid(9905);
    for i in 1..20 loop
      perform pg_temp.add_waypoint(pg_temp.gid(83000+i),null,pg_temp.gid(9905),pg_temp.gid(99051));
    end loop;
  end if;
end $$;
create function pg_temp.answer_case(case_name text) returns jsonb language plpgsql as $$
declare result jsonb; v_offer_id uuid; draft_id uuid; response_name text:='right'; kind_name text:='change';
  answer record; replayed record; answered_result jsonb; before_revision integer; delta integer;
  slot_n integer:=3; target uuid:=pg_temp.gid(80001); offer_value jsonb; current_state jsonb;
  before_refinement jsonb; after_refinement jsonb; refused_state jsonb; settled record; receipt jsonb;
  initial_offer jsonb; unchanged boolean; error_code text; original_revision integer; typed boolean;
begin
  begin
    select null::text as outcome,null::jsonb as operation_result into replayed;
    select null::text as outcome,null::jsonb as conversation_state,null::jsonb as operation_result into answer;
    select null::boolean as saved_reply into settled;
    typed:=case_name like 'typed_%';
    if case_name like '%reached%' then kind_name:='reached';
    elsif case_name like '%revisit%' or (case_name like '%active%' and case_name<>'button_change_active')
      then kind_name:='revisit'; perform pg_temp.mark_reached(target); end if;
    if case_name like '%close%' then response_name:='close'; elsif case_name like '%decline%' then response_name:='not_it'; end if;
    offer_value:=pg_temp.offer_value(kind_name);
    if not pg_temp.send_offer(2,offer_value) then raise exception 'fixture_answer_offer'; end if;
    select waypoint_offer_id,to_jsonb(o) into v_offer_id,initial_offer from content.waypoint_offer o where offer_status='proposed';
    select revision into original_revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005);
    if case_name='button_revisit_five' then
      for i in 2..5 loop
        perform pg_temp.add_waypoint(pg_temp.gid(80000+i)); perform pg_temp.mark_reached(pg_temp.gid(80000+i));
      end loop;
    elsif case_name like '%history%' then perform pg_temp.fill_capacity(true);
    elsif case_name like '%active%' then
      perform pg_temp.fill_capacity(false);
      if case_name='button_change_active' then perform pg_temp.mark_reached(pg_temp.gid(83001)); end if;
    elsif case_name like '%target_changed%' then perform pg_temp.add_waypoint(pg_temp.gid(80002),target);
    elsif case_name in ('button_wrong_stage','button_stage_changed_decline','button_stage_changed_close') then
      perform pg_temp.mark_reached(target);
    elsif case_name like 'button_released_target_%' then perform pg_temp.release(target);
    elsif case_name in ('typed_old','button_old') then
      if not pg_temp.send_offer(3,null) then raise exception 'fixture_later_reply'; end if; slot_n:=4;
    elsif case_name='typed_after_close' then
      perform * from pg_temp.answer_offer(70009,v_offer_id,'close');
    elsif case_name='button_pending' then
      perform * from pg_temp.prepare_private(3);
    elsif case_name='button_restricted' then
      perform * from pg_temp.observe(3,3);
    end if;
    before_refinement:=pg_temp.state();
    select revision into before_revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005);
    if typed then
      if not exists(select 1 from pg_temp.prepare_private(slot_n) where outcome='ok' and dispatch_permitted)
        then raise exception 'fixture_typed_prepare'; end if;
      select * into settled from pg_temp.settle_private(slot_n,offer_response=>case case_name
        when 'typed_badshape' then jsonb_build_object('offerId',v_offer_id,'response','right','extra',true)
        when 'typed_badid' then '{"offerId":"not-an-id","response":"right"}'::jsonb
        when 'typed_json_null' then 'null'::jsonb
        else jsonb_build_object('offerId',v_offer_id,'response',response_name) end);
      select to_jsonb(o) into receipt from ai.explorer_conversation_operation o where v_offer_id=o.offer_id and o.offer_typed;
      refused_state:=pg_temp.state();
      if case_name in ('typed_active_restore','typed_active_refine','typed_active_confirm') then
        perform pg_temp.mark_reached(pg_temp.gid(83001));
        before_refinement:=pg_temp.state();
        if case_name='typed_active_refine' and not pg_temp.send_offer(slot_n+1,
          pg_temp.offer_value('revisit',target,'Synthetic corrected destination')) then raise exception 'fixture_refinement'; end if;
        after_refinement:=pg_temp.state();
        if case_name='typed_active_confirm' then perform * from pg_temp.answer_offer(70002,v_offer_id,'right'); end if;
      end if;
    else
      begin
        select * into answer from pg_temp.answer_offer(70001,v_offer_id,response_name,
          case when case_name='button_stale' then before_revision-1 else null end);
        answered_result:=answer.operation_result;
      exception when raise_exception then error_code:=sqlerrm; end;
      select revision-before_revision into delta from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005);
      if case_name='button_close_refine_confirm' then
        if not pg_temp.send_offer(3,pg_temp.offer_value('change',target,'Synthetic corrected destination')) then raise exception 'fixture_refinement'; end if;
        perform * from pg_temp.answer_offer(70002,v_offer_id,'right');
      elsif case_name='button_new_offer' then
        if not pg_temp.send_offer(3,pg_temp.offer_value('change',(answered_result->>'resultWaypointId')::uuid,
          'Synthetic later destination')) then raise exception 'fixture_later_offer'; end if;
      elsif case_name='button_later_change' then
        perform * from public.solmind_confirm_explorer_waypoint_revision_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
          pg_temp.gid(71001),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),
          pg_temp.request_sha(71001),'revise_waypoint',(answered_result->>'resultWaypointId')::uuid,
          '[{"component":"meaning","answer":"Synthetic later meaning"}]');
      elsif case_name='button_replay_pending' then perform * from pg_temp.prepare_private(3);
      end if;
      if error_code is null and answer.outcome='ok' then
        select * into replayed from pg_temp.answer_offer(70001,v_offer_id,response_name);
      end if;
      select to_jsonb(o) into receipt from ai.explorer_conversation_operation o where operation_id=pg_temp.gid(70001);
    end if;
    current_state:=pg_temp.state();
    unchanged:=initial_offer=(select to_jsonb(o) from content.waypoint_offer o where waypoint_offer_id=v_offer_id);
    result:=jsonb_build_object('state',current_state,'offerId',v_offer_id,'offerUnchanged',unchanged,'delta',delta,
      'saved',case when typed then settled.saved_reply end,'receipt',receipt,'answerResult',answered_result,'error',error_code,
      'outcome',case when not typed and error_code is null then answer.outcome end,
      'replayOutcome',case when replayed is not null then replayed.outcome end,
      'replayResult',case when replayed is not null then replayed.operation_result end,
      'beforeRefinement',before_refinement,'afterRefinement',after_refinement,'refusedState',refused_state,
      'events',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from ai.explorer_waypoint_offer_event e where event_kind='typed_answer_refused'),
      'waypoints',(select jsonb_agg(to_jsonb(w) order by created_at,waypoint_id) from content.waypoint w),
      'confirmedWaypoint',(select to_jsonb(w) from content.waypoint w where waypoint_id=coalesce(
        (answered_result->>'resultWaypointId')::uuid,(receipt->>'offer_result_waypoint_id')::uuid)),
      'clarifications',(select coalesce(jsonb_agg(to_jsonb(c) order by component),'[]') from content.waypoint_clarification c),
      'reachedAudits',(select count(*) from audit.audit_event where event_type='waypoint_reached'
        and target_entity_id=target),
      'activeCount',ai.solmind_waypoint_active_count_v1(pg_temp.gid(1)));
    raise exception using errcode='P0712',message='rollback_synthetic_fixture';
  exception when sqlstate 'P0712' then null; end;
  return result;
end $$;
create temp table answer_cases as select name,pg_temp.answer_case(name) value from unnest(array[
  'button_right','button_reached','button_reached_decline','button_reached_close','button_revisit','button_revisit_five','button_decline','button_close',
  'button_old','button_stale','button_pending','button_restricted','button_target_changed','button_wrong_stage','button_history',
  'button_target_changed_decline','button_target_changed_close','button_stage_changed_decline','button_stage_changed_close',
  'button_released_target_right','button_released_target_decline','button_released_target_close',
  'button_active','button_change_active','button_close_refine_confirm','button_new_offer','button_later_change','button_replay_pending',
  'typed_right','typed_reached','typed_revisit','typed_decline','typed_close','typed_old','typed_after_close',
  'typed_badshape','typed_badid','typed_json_null',
  'typed_history','typed_active','typed_target_changed','typed_active_restore','typed_active_refine','typed_active_confirm']) name;
select ok(value->>'outcome'='ok' and value->>'delta'='1' and value->>'replayOutcome'='exact_replay'
  and value->'answerResult'=value->'replayResult','button applies exactly one revision and replays its immutable result: '||name)
  from answer_cases where name in ('button_right','button_reached','button_reached_decline','button_revisit','button_revisit_five','button_decline',
    'button_close','button_old','button_change_active','button_close_refine_confirm','button_new_offer','button_later_change','button_replay_pending',
    'button_target_changed_decline','button_target_changed_close','button_stage_changed_decline','button_stage_changed_close',
    'button_released_target_decline','button_released_target_close') order by name;
select is(value->>'outcome',case when name='button_stale' then 'stale_revision' else 'operation_conflict' end,
  'button refuses '||name) from answer_cases where name in ('button_stale','button_pending','button_target_changed',
    'button_wrong_stage','button_history','button_active','button_reached_close','button_released_target_right') order by name;
select ok(value#>'{beforeRefinement,waypointOffer,targetCurrent}'='false'::jsonb
  and value#>'{state,waypointOffer,targetCurrent}'='false'::jsonb,
  'targetCurrent stays false after a changed target: '||name) from answer_cases where name in
  ('button_target_changed','button_wrong_stage','button_released_target_right',
    'button_target_changed_decline','button_target_changed_close','button_stage_changed_decline','button_stage_changed_close',
    'button_released_target_decline','button_released_target_close') order by name;
select ok(value#>>'{state,waypointOffer,status}'=case when name like '%decline' then 'declined' else 'proposed' end
  and value#>>'{answerResult,outcome}'=case when name like '%decline' then 'declined' else 'kept_open' end,
  'changed target still allows the non-confirming answer: '||name) from answer_cases where name in
  ('button_target_changed_decline','button_target_changed_close','button_stage_changed_decline','button_stage_changed_close',
    'button_released_target_decline','button_released_target_close') order by name;
select ok(value#>'{beforeRefinement,waypointOffer,typedAnswerEligible}'='true'::jsonb
  and value#>'{beforeRefinement,waypointOffer,targetCurrent}'='false'::jsonb
  and value#>>'{events,0,reason}'='target_changed',
  'a changed target stays typed-answer eligible so its refusal receipt is retained') from answer_cases where name='typed_target_changed';
select is(value->>'error','solmind_explorer_private_denied','restricted answer is denied') from answer_cases where name='button_restricted';
select ok(value#>>'{replayResult,outcome}'='kept_open' and value#>'{replayResult,resultWaypointId}'='null'::jsonb
  and value#>>'{state,waypointOffer,status}'='confirmed','Close replay after refinement and confirmation remains kept_open without a result id')
  from answer_cases where name='button_close_refine_confirm';
select ok(value#>>'{state,waypointOffer,status}'='proposed' and value#>>'{answerResult,outcome}'='confirmed',
  'earlier answer replay returns its own confirmation while the newer offer waits') from answer_cases where name='button_new_offer';
select ok(value#>>'{waypoints,0,lifecycle_status}'='reached' and value#>>'{waypoints,0,reached_evidence}'='Synthetic arrival.',
  'Reached answer uses saved evidence and does not trip the creation once-only rule') from answer_cases where name='button_reached';
select ok(bool_and(value->>'reachedAudits'='0'),
  'button and typed Reached answers add no Reached audit event, matching confirm_reached')
  from answer_cases where name in ('button_reached','typed_reached');
select ok(value#>>'{receipt,offer_outcome}'=case when name='typed_decline' then 'declined' when name='typed_close' then 'kept_open' else 'confirmed' end
  and (value->>'saved')::boolean,'typed answer applies with its reply saved: '||name) from answer_cases
  where name in ('typed_right','typed_reached','typed_revisit','typed_decline','typed_close') order by name;
select ok((value->>'saved')::boolean and value->'receipt'='null'::jsonb and (value->>'offerUnchanged')::boolean,
  'typed answer ignored for '||name) from answer_cases where name in ('typed_old','typed_after_close','typed_badshape','typed_badid','typed_json_null') order by name;
select ok((value->>'saved')::boolean and value->'receipt'='null'::jsonb and value#>>'{events,0,reason}'=
  case when name='typed_history' then 'history_limit' when name='typed_target_changed' then 'target_changed' else 'active_limit' end
  and value#>>'{events,0,suggestion_message_id}'=value#>>'{refusedState,waypointOffer,suggestionMessageId}',
  'typed refusal preserves reply, creates no answer, and pins the presentation: '||name) from answer_cases
  where name in ('typed_history','typed_active','typed_target_changed','typed_active_restore','typed_active_refine','typed_active_confirm') order by name;
select ok(value#>>'{afterRefinement,waypointOffer,typedAnswerRefusal}'='active_limit',
  'capacity restored without refinement retains the refused presentation notice') from answer_cases where name='typed_active_restore';
select ok(value#>'{afterRefinement,waypointOffer,typedAnswerRefusal}'='null'::jsonb and jsonb_array_length(value->'events')=1,
  'refinement clears only the projected refusal while its immutable receipt remains') from answer_cases where name='typed_active_refine';
select ok(value#>'{state,waypointOffer,typedAnswerRefusal}'='null'::jsonb and value#>>'{state,waypointOffer,status}'='confirmed',
  'confirmation after restored capacity clears the projected refusal') from answer_cases where name='typed_active_confirm';
select ok(value#>>'{beforeRefinement,waypointOffer,typedAnswerEligible}'=case when name in ('typed_old','typed_after_close') then 'false' else 'true' end,
  'server offer typed eligibility includes preceding reply and no intervening receipt: '||name) from answer_cases
  where name in ('typed_right','typed_old','typed_after_close') order by name;
select ok(value#>>'{confirmedWaypoint,suggested_by_actor_type}'='solmind_virtual_guide'
  and value#>>'{confirmedWaypoint,suggestion_offer_id}'=value->>'offerId'
  and value#>'{confirmedWaypoint,suggestion_draft_id}'='null'::jsonb,
  'confirmed offer successor records the Guide as proposer and the Explorer as chooser') from answer_cases where name='button_right';
select ok(value#>>'{clarifications,0,question_key}'='waypoint.destination.offer.v1'
  and value#>>'{clarifications,0,answer_text}'='A clearer synthetic destination',
  'changed offer parts use the new clarification key family') from answer_cases where name='button_right';

-- Persistent fixture for direct guard, RPC identity and projection assertions.
select ok(pg_temp.send_offer(2,pg_temp.offer_value()),'guard fixture saves an ordinary change offer');
create temp table guard_offer as select * from content.waypoint_offer where offer_status='proposed';
do $$ begin
  if not exists(select 1 from pg_temp.ensure_anchor(candidate_n=>9907,actor_n=>4,app_n=>54) where outcome='created')
    then raise exception 'fixture_other_explorer_conversation'; end if;
end $$;
select is((select outcome from public.solmind_respond_explorer_waypoint_offer_v1(pg_temp.gid(4),pg_temp.gid(54),
  pg_temp.gid(9907),pg_temp.gid(79990),
  (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(9907)),
  pg_temp.request_sha(79990),(select waypoint_offer_id from guard_offer),'right')),
  'operation_conflict','a second Explorer cannot answer the first Explorer offer from their own conversation');
select throws_ok($q$insert into content.waypoint_offer select (jsonb_populate_record(null::content.waypoint_offer,
  (select to_jsonb(o)||jsonb_build_object('waypoint_offer_id',pg_temp.gid(89901)) from guard_offer o))).*$q$,
  'P0001','solmind_explorer_private_formation_conflict','offer insertion outside settlement is refused');
select throws_ok($q$update content.waypoint_offer set title='Untrusted direct refinement'$q$,
  'P0001','solmind_explorer_private_formation_conflict','offered wording cannot be refined outside settlement');
select throws_ok($q$update content.waypoint_offer set target_title='Changed snapshot'$q$,
  'P0001','solmind_explorer_private_immutable','offer target snapshot is immutable');
select throws_ok($q$update content.waypoint_offer set source_message_id=pg_temp.gid(10015)$q$,
  'P0001','solmind_explorer_private_immutable','offer first carrying reply is immutable');
select throws_ok($q$update content.waypoint_offer set offer_status='declined'$q$,
  'P0001','solmind_explorer_private_immutable','a status transition without its matching answer receipt is refused');
select throws_ok($q$delete from content.waypoint_offer$q$,'P0001','solmind_explorer_private_immutable','offers cannot be deleted');
select ok((select relrowsecurity from pg_class where oid='content.waypoint_offer'::regclass)
  and (select relrowsecurity from pg_class where oid='ai.explorer_waypoint_offer_event'::regclass),
  'both new tables retain row level security');
select ok(not exists(select 1 from unnest(array['anon','authenticated','service_role']) r(name)
  cross join unnest(array['content.waypoint_offer','ai.explorer_waypoint_offer_event']) t(name)
  where has_table_privilege(r.name,t.name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')),
  'API roles have no direct privilege on either new table');
select ok(has_function_privilege('service_role',
  'public.solmind_respond_explorer_waypoint_offer_v1(uuid,uuid,uuid,uuid,integer,text,uuid,text)','EXECUTE')
  and not has_function_privilege('anon',
  'public.solmind_respond_explorer_waypoint_offer_v1(uuid,uuid,uuid,uuid,integer,text,uuid,text)','EXECUTE')
  and not has_function_privilege('authenticated',
  'public.solmind_respond_explorer_waypoint_offer_v1(uuid,uuid,uuid,uuid,integer,text,uuid,text)','EXECUTE'),
  'only the service role can execute the offer command');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join unnest(array['anon','authenticated','service_role']) r(name)
  where n.nspname in ('ai','content') and p.proname like '%waypoint_offer%'
    and has_function_privilege(r.name,p.oid,'EXECUTE')),'API roles cannot execute private offer functions');
select is(pg_temp.inspect(pg_temp.context_value(pg_temp.gid(99901),'Synthetic next message.')),'clear',
  'current offer context and its independently assembled exact source ids pass');
select is(pg_temp.inspect(pg_temp.context_value(pg_temp.gid(99901),'Synthetic next message.'),
  (select array_agg(distinct id order by id) from (
    select unnest(array[pg_temp.gid(52),pg_temp.gid(99901),pg_temp.gid(1001)]) id
    union all select ai_interaction_message_id from ai.ai_interaction_message where ai_interaction_session_id=pg_temp.gid(6005)
    union all select unnest(pg_temp.compass_source_ids())) ids where id<>(select waypoint_offer_id from guard_offer))),
  'unavailable','omitting the pending offer source id is refused even with correct context bytes');
select is(pg_temp.inspect(jsonb_set(pg_temp.context_value(pg_temp.gid(99901),'Synthetic next message.'),
  '{compassContext,offers,0,title}','"Invented unsaved title"')),'unavailable',
  'changing offered wording in model context is refused');
select is(pg_temp.inspect(jsonb_set(pg_temp.context_value(pg_temp.gid(99901),'Synthetic next message.'),
  '{compassContext,offers}','[]')),'unavailable','omitting a saved offer from context is refused');
select is(pg_temp.inspect(jsonb_set(jsonb_set(pg_temp.context_value(pg_temp.gid(99901),'Synthetic next message.'),
  '{contractVersion}','"wi007-v0.1+onboarding-fields-v2+compass-v8"'),
  '{compassContext,version}','"explorer-compass-context.v8"')),'unavailable','the inspector rejects the retired v8 context');
select ok(not methodology.serialized_methodology_valid(pg_temp.compact(jsonb_set(jsonb_set(
  pg_temp.context_value(pg_temp.gid(99901),'Synthetic next message.'),
  '{contractVersion}','"wi007-v0.1+onboarding-fields-v2+compass-v8"'),
  '{compassContext,version}','"explorer-compass-context.v8"')),
  pg_temp.gid(1001),(select content_markdown from methodology.methodology_context_pack_version where methodology_context_pack_version_id=pg_temp.gid(1001))),
  'serialized methodology rejects the retired v8 contract');
select is(pg_temp.inspect(jsonb_set(pg_temp.context_value(pg_temp.gid(99901),'Synthetic next message.'),
  '{roleBehavior,text}',to_jsonb(repeat('r',25000)))),'clear','role rules accept exactly 25000 characters');
select is(pg_temp.inspect(jsonb_set(pg_temp.context_value(pg_temp.gid(99901),'Synthetic next message.'),
  '{roleBehavior,text}',to_jsonb(repeat('r',25001)))),'unavailable','role rules reject 25001 characters');
select is(pg_temp.inspect(jsonb_set(pg_temp.context_value(pg_temp.gid(99901),'Synthetic next message.'),
  array[part,'text'],to_jsonb(repeat('s',20000)))),'clear',part||' keeps its 20000 character boundary')
  from unnest(array['globalPolicy','crisisBehavior']) part;
select is(pg_temp.inspect(jsonb_set(pg_temp.context_value(pg_temp.gid(99901),'Synthetic next message.'),
  array[part,'text'],to_jsonb(repeat('s',20001)))),'unavailable',part||' still rejects 20001 characters')
  from unnest(array['globalPolicy','crisisBehavior']) part;

create temp table button_close as select * from pg_temp.answer_offer(70001,(select waypoint_offer_id from guard_offer),'close');
select is((select outcome from button_close),'ok','button Close records the original presentation');
select is(pg_temp.state()#>'{waypointOffer,typedAnswerEligible}','false'::jsonb,
  'Close leaves the box proposed but an answer receipt makes it ineligible for a typed follow-up');
select throws_ok($q$update ai.explorer_conversation_operation set offer_typed=true where operation_id=pg_temp.gid(70001)$q$,
  'P0001','solmind_explorer_private_immutable','offer answer operation result cannot be updated');
select throws_ok($q$delete from ai.explorer_conversation_operation where operation_id=pg_temp.gid(70001)$q$,
  'P0001','solmind_explorer_private_immutable','offer answer operation result cannot be deleted');
select throws_ok($q$select * from pg_temp.answer_offer(70001,(select waypoint_offer_id from guard_offer),'right')$q$,
  'P0001','solmind_explorer_private_operation_conflict','same operation id with a different answer conflicts');
select throws_ok($q$select * from pg_temp.answer_offer(70001,(select waypoint_offer_id from guard_offer),'close',
  fingerprint_override=>repeat('F',64))$q$,'P0001','solmind_explorer_private_operation_conflict',
  'same operation id with changed command bytes conflicts');
select ok(pg_temp.send_offer(3,pg_temp.offer_value('change',pg_temp.gid(80001),'Synthetic corrected destination')),
  'settlement can refine the same proposed change offer');
select ok((select count(*)=1 and bool_and(waypoint_offer_id=(select waypoint_offer_id from guard_offer)
  and source_message_id=(select source_message_id from guard_offer) and suggestion_message_id=pg_temp.gid(10035))
  from content.waypoint_offer),'refinement preserves offer identity and first reply and advances only the presentation');
select is(pg_temp.state()#>'{waypointOffer,typedAnswerEligible}','true'::jsonb,
  'refinement restores typed eligibility for the new presentation');

select ok(pg_temp.send_waypoint(4,pg_temp.suggestion()),'a separate later draft can coexist with an older proposed offer');
select ok(pg_temp.state()#>'{waypointDraft,typedAnswerEligible}'='true'::jsonb
  and pg_temp.state()#>'{waypointOffer,typedAnswerEligible}'='false'::jsonb,
  'only the latest carrying draft can receive a typed answer');
create temp table draft_before as select waypoint_draft_id,(select revision from ai.explorer_conversation_state
  where conversation_id=pg_temp.gid(6005)) as revision from content.waypoint_draft where draft_status='proposed';
select is(pg_temp.answer_draft(70101,(select waypoint_draft_id from draft_before),'close'),'ok','draft Close remains supported');
select is((select revision-(select revision from draft_before) from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),
  1,'the existing draft button also advances conversation revision by exactly one');
select is(pg_temp.state()#>'{waypointDraft,typedAnswerEligible}','false'::jsonb,
  'draft Close receipt disqualifies that presentation from a typed answer');
select ok(pg_temp.send_waypoint(5,pg_temp.suggestion('Synthetic refined draft')),'draft can be presented again through settlement');
select is(pg_temp.state()#>'{waypointDraft,typedAnswerEligible}','true'::jsonb,'refined draft presentation is typed-answer eligible again');
select is(pg_temp.answer_draft(70102,(select waypoint_draft_id from draft_before),'right'),'ok','the original draft provenance still forms normally');
select ok(exists(select 1 from content.waypoint where suggestion_draft_id=(select waypoint_draft_id from draft_before)
  and suggested_by_actor_type='solmind_virtual_guide' and suggestion_offer_id is null and suggestion_message_id=pg_temp.gid(10055)),
  'the old draft provenance shape stays unchanged');
select ok(exists(select 1 from content.waypoint where waypoint_id=pg_temp.gid(80001)
  and suggested_by_actor_type is null and suggestion_draft_id is null and suggestion_offer_id is null and suggestion_message_id is null),
  'the old no-suggestion provenance shape stays unchanged');
select throws_ok($q$insert into content.waypoint select (jsonb_populate_record(null::content.waypoint,
  (select to_jsonb(w)||jsonb_build_object('waypoint_id',pg_temp.gid(89903),
    'suggestion_offer_id',(select waypoint_offer_id from guard_offer)) from content.waypoint w where suggestion_draft_id is not null))).*$q$,
  'P0001','solmind_explorer_private_formation_conflict','a row cannot combine draft and offer provenance');
select throws_ok($q$insert into content.waypoint select (jsonb_populate_record(null::content.waypoint,
  (select to_jsonb(w)||jsonb_build_object('waypoint_id',pg_temp.gid(89904),'suggested_by_actor_type','solmind_virtual_guide')
    from content.waypoint w where waypoint_id=pg_temp.gid(80001)))).*$q$,
  '23514',null,'Guide provenance cannot omit both a draft and offer source');

-- A dropped-offer receipt is real settlement output, not a manufactured row.
select ok(pg_temp.send_offer(6,pg_temp.offer_value('change',pg_temp.gid(89999))),'a dropped target keeps its ordinary reply');
select throws_ok($q$update ai.explorer_waypoint_offer_event set reason='invalid'$q$,'P0001','solmind_explorer_private_immutable',
  'offer event receipts cannot be changed');
select throws_ok($q$delete from ai.explorer_waypoint_offer_event$q$,'P0001','solmind_explorer_private_immutable','offer event receipts cannot be deleted');
select ok(pg_temp.state()#>>'{waypointOfferDrop,reason}'='target_not_available','drop is projected under its carrying latest reply');
select ok(pg_temp.send_offer(7,null),'a later ordinary reply can omit an offer');
select is(pg_temp.state()->'waypointOfferDrop','null'::jsonb,'an older drop receipt is not projected under a newer reply');

select is((select terminal_fingerprint from ai.explorer_conversation_operation where operation_id=pg_temp.gid(10010)),
  (select methodology.hash_json(jsonb_build_array(methodology.hash_json(jsonb_build_array(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(10010),
    op.logical_operation_id,op.message_id,op.snapshot_id,op.invocation_id,'completed',pg_temp.gid(10015),'ordinary',
    'Synthetic saved reply.',0::smallint,false,'explorer-safety-reply.v2','classification_and_reply',repeat('A',64),
    'synthetic-fallback.v1','synthetic-model-policy.v1','synthetic-trusted.v1','synthetic-resources.v1',0::smallint,false,
    true,null,null)),pg_temp.gid(10015),'ordinary','Synthetic saved reply.',null,null))
    from ai.explorer_conversation_operation op where operation_id=pg_temp.gid(10010)),
  'null new settlement arguments retain the exact pre-offer fingerprint bytes');

create function pg_temp.defense_case(case_name text) returns jsonb language plpgsql as $$
declare result jsonb; v_offer_id uuid; v_draft_id uuid; first_receipt jsonb; before_offer jsonb; after_offer jsonb;
  response record; before_revision integer; evidence text; first_reply uuid;
begin
  begin
    if case_name='draft_precedence' then
      if not pg_temp.send_waypoint(8,pg_temp.suggestion('Synthetic precedence draft'))
        or not pg_temp.send_offer(9,pg_temp.offer_value('change',pg_temp.gid(80001),'Synthetic precedence offer'))
        then raise exception 'fixture_precedence'; end if;
      select waypoint_draft_id into v_draft_id from content.waypoint_draft where draft_status='proposed';
      select waypoint_offer_id into v_offer_id from content.waypoint_offer where offer_status='proposed';
      -- Defense fixture only: the one-box settlement rule cannot produce these
      -- simultaneous presentations. Use the existing settlement guard, without
      -- disabling triggers, to exercise the at-most-one-answer rule itself.
      update ai.explorer_conversation_state set pending_operation_id=pg_temp.gid(10090) where conversation_id=pg_temp.gid(6005);
      update content.waypoint_draft set suggestion_message_id=pg_temp.gid(10095) where waypoint_draft_id=v_draft_id;
      update ai.explorer_conversation_state set pending_operation_id=null where conversation_id=pg_temp.gid(6005);
      select to_jsonb(o) into before_offer from content.waypoint_offer o where waypoint_offer_id=v_offer_id;
      perform * from pg_temp.prepare_private(10);
      select * into response from pg_temp.settle_private(10,
        waypoint_response=>jsonb_build_object('draftId',v_draft_id,'response','right'),
        offer_response=>jsonb_build_object('offerId',v_offer_id,'response','right'));
      result:=jsonb_build_object('saved',response.saved_reply,
        'draftApplied',exists(select 1 from content.waypoint_draft where waypoint_draft_id=v_draft_id and draft_status='confirmed'),
        'offerUnchanged',before_offer=(select to_jsonb(o) from content.waypoint_offer o where waypoint_offer_id=v_offer_id),
        'offerAnswers',(select count(*) from ai.explorer_conversation_operation where offer_id=v_offer_id and offer_typed));
    elsif case_name='reached_no_refinement' then
      if not pg_temp.send_offer(8,pg_temp.offer_value('reached')) then raise exception 'fixture_reached'; end if;
      select waypoint_offer_id,to_jsonb(o) into v_offer_id,before_offer from content.waypoint_offer o where offer_status='proposed';
      if not pg_temp.send_offer(9,pg_temp.offer_value('reached')) then raise exception 'fixture_reached_again'; end if;
      result:=jsonb_build_object('unchanged',before_offer=(select to_jsonb(o) from content.waypoint_offer o where waypoint_offer_id=v_offer_id),
        'reason',(select reason from ai.explorer_waypoint_offer_event where operation_id=pg_temp.gid(10090)));
    elsif case_name='declines_not_draft_limit' then
      for i in 8..32 loop
        if not pg_temp.send_offer(i,pg_temp.offer_value('change',pg_temp.gid(80001),'Synthetic change '||i)) then raise exception 'fixture_decline'; end if;
        select waypoint_offer_id into v_offer_id from content.waypoint_offer where offer_status='proposed';
        if not exists(select 1 from pg_temp.answer_offer(76000+i,v_offer_id,'not_it') where outcome='ok') then raise exception 'fixture_decline_answer'; end if;
      end loop;
      result:=jsonb_build_object('declined',(select count(*) from content.waypoint_offer where offer_status='declined'),
        'draftRejected',(select count(*) from content.waypoint_draft where draft_status='rejected'));
    end if;
    raise exception using errcode='P0713',message='rollback_synthetic_fixture';
  exception when sqlstate 'P0713' then null; end;
  return result;
end $$;
create temp table defenses as select name,pg_temp.defense_case(name) value
  from unnest(array['draft_precedence','reached_no_refinement','declines_not_draft_limit']) name;
select ok((value->>'saved')::boolean and (value->>'draftApplied')::boolean and (value->>'offerUnchanged')::boolean
  and value->>'offerAnswers'='0','a successfully applied draft answer suppresses the typed offer answer in the same settlement')
  from defenses where name='draft_precedence';
select ok((value->>'unchanged')::boolean and value->>'reason'='already_offered',
  'Reached is never refined, even by a later valid settlement with the same target') from defenses where name='reached_no_refinement';
select ok(value->>'declined'='25' and value->>'draftRejected'='0',
  '25 declined offers do not consume the 24 declined-draft allowance or impose their own cap') from defenses where name='declines_not_draft_limit';

create function pg_temp.followup_case(response_name text,offer_answered boolean) returns jsonb language plpgsql as $$
declare result jsonb; v_offer_id uuid; v_draft_id uuid; rev integer; first_outcome text; replay_outcome text;
  first_state jsonb; replay_state jsonb;
begin
  begin
    if not pg_temp.send_waypoint(8,pg_temp.suggestion('Synthetic older pending draft'))
      or not pg_temp.send_offer(9,pg_temp.offer_value('change',pg_temp.gid(80001),'Synthetic newer offer'))
      then raise exception 'fixture_followup'; end if;
    select waypoint_draft_id into v_draft_id from content.waypoint_draft where draft_status='proposed';
    select waypoint_offer_id into v_offer_id from content.waypoint_offer where offer_status='proposed';
    if offer_answered then
      if not exists(select 1 from pg_temp.answer_offer(77001,v_offer_id,'close') where outcome='ok')
        then raise exception 'fixture_close_newer_offer'; end if;
      -- No AI reply is added after Close: this is the skipped-follow-up case.
    end if;
    select revision into rev from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005);
    first_outcome:=pg_temp.answer_draft(77002,v_draft_id,response_name);
    first_state:=pg_temp.state();
    replay_outcome:=pg_temp.answer_draft(77002,v_draft_id,response_name);
    replay_state:=pg_temp.state();
    result:=jsonb_build_object('firstOutcome',first_outcome,'replayOutcome',replay_outcome,
      'delta',(first_state->>'revision')::integer-rev,'sameState',first_state=replay_state,
      'firstEligible',first_state#>'{waypointOffer,typedAnswerEligible}',
      'replayEligible',replay_state#>'{waypointOffer,typedAnswerEligible}',
      'carryingReply',first_state#>'{waypointOffer,suggestionMessageId}',
      'latestReply',(select ai_interaction_message_id from ai.ai_interaction_message where ai_interaction_session_id=pg_temp.gid(6005)
        and sender_type='ai' order by sequence_number desc limit 1));
    raise exception using errcode='P0714',message='rollback_synthetic_fixture';
  exception when sqlstate 'P0714' then null; end;
  return result;
end $$;
create temp table followup_cases as select response_name,offer_answered,pg_temp.followup_case(response_name,offer_answered) value
  from unnest(array['right','close','not_it']) response_name cross join unnest(array[true,false]) offer_answered;
select ok(value->>'firstOutcome'='ok' and value->>'replayOutcome'='exact_replay' and value->>'delta'='1'
  and (value->>'sameState')::boolean and value->>'firstEligible'=(not offer_answered)::text
  and value->>'replayEligible'=(not offer_answered)::text and value->>'carryingReply'=value->>'latestReply',
  'REV473d older draft '||response_name||', newer offer answered Close='||offer_answered::text||
  ': first result and unchanged exact replay expose accurate competing typed eligibility')
  from followup_cases order by response_name,offer_answered;

select * from finish();
rollback;
