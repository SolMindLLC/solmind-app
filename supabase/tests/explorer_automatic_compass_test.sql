-- REV391 automatic Compass: synthetic rollback-only SQL tests, authored only.
-- Execute only in the Executor's isolated migration-proof database. No provider call.
-- Fixture uses existing governance and current v8 context; no real human approval is claimed.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,pg_catalog,pg_temp;
set local statement_timeout='120s';
select no_plan();

create function pg_temp.gid(n integer) returns uuid language sql immutable as $$
  select ('f3910000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
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
  interested boolean default true,fallback_override integer default null,attention_n integer default null,choices jsonb default null,suggestions jsonb default null,attention_id uuid default null,responses jsonb default null,waypoint jsonb default null,waypoint_response jsonb default null,failure_reason text default null,topics jsonb default null)
returns table(outcome text,conversation_state jsonb,policy_state jsonb,saved_reply boolean)
language sql as $$
  select * from public.solmind_settle_explorer_conversation_turn_v4(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(10000+slot_n*10),status_name,case when kind='none' then null else pg_temp.gid(10005+slot_n*10) end,
    kind,case when kind='none' then null else body end,model::smallint,minor_flag,'explorer-safety-reply.v2',
    (select mode from lifecycle_intent where slot=slot_n),repeat('A',64),'synthetic-fallback.v1',
    'synthetic-model-policy.v1','synthetic-trusted.v1','synthetic-resources.v1',
    coalesce(fallback_override,(select fallback from lifecycle_intent where slot=slot_n))::smallint,
    (select minor from lifecycle_intent where slot=slot_n),interested,
    coalesce(attention_id,case when attention_n is null then null else pg_temp.gid(attention_n) end),choices,suggestions,responses,waypoint,waypoint_response,failure_reason,topics)
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

-- Map against the exact prepared serialization, not whatever state is read later.
create function pg_temp.topic(slot_n integer,topic_label text,refs text[],ready boolean default false)
returns jsonb language sql stable as $$
  select jsonb_build_object('topicId',(select t.topic_id from ai.explorer_compass_topic t
      where t.conversation_id=pg_temp.gid(6005) and t.label=topic_label),
    'label',topic_label,'ready',ready,'supports',coalesce((select jsonb_agg(jsonb_build_object('ref',r,
      'messageId',case when r='now' then ctx->'immediateExplorerMessage'->>'messageId'
        else ctx->'currentSessionMessages'->substring(r from 2)::integer->>'messageId' end) order by ord)
        from unnest(refs) with ordinality f(r,ord)),'[]'::jsonb))
    from (select serialization::jsonb ctx from lifecycle_intent where slot=slot_n) saved
$$;
select is(pg_temp.state()->>'compassMode','automatic','fresh conversation is automatic');
select is(jsonb_array_length(pg_temp.state()->'compassItems'),0,'fresh dial is empty');
select ok((select dispatch_permitted from pg_temp.prepare_private(1)),'first Send prepared');
select ok((select saved_reply from pg_temp.settle_private(1,topics=>jsonb_build_array(
  pg_temp.topic(1,'Time for myself',array['now'],true)))),'first controlled support saves reply');
select is((select count(*)::integer from ai.explorer_compass_topic_support),1,'one support retained');
select is(jsonb_array_length(pg_temp.state()->'compassItems'),0,'ready with one support cannot form');
select ok((select dispatch_permitted from pg_temp.prepare_private(2)),'second Send prepared');
select ok((select saved_reply from pg_temp.settle_private(2,topics=>jsonb_build_array(
  pg_temp.topic(2,'Time for myself',array['h0','now'],true)))),'second support accepts earlier repeated reference');
select is((select count(*)::integer from ai.explorer_compass_topic_support),2,'repeated reference does not increase proof');
select is(jsonb_array_length(pg_temp.state()->'compassItems'),0,'two supporting responses leave the dial empty');
select ok((select dispatch_permitted from pg_temp.prepare_private(3)),'third Send prepared');
create temp table third_payload as select jsonb_build_array(pg_temp.topic(3,'Time for myself',array['now'],true)) value;
select ok((select saved_reply from pg_temp.settle_private(3,topics=>(select value from third_payload))),'third reply saved');
set constraints ai.explorer_compass_automatic_proof immediate;
set constraints ai.explorer_compass_automatic_proof deferred;
select is(jsonb_array_length(pg_temp.state()->'compassItems'),1,'third distinct supporting response forms one automatic point');
select is(pg_temp.state()->'compassItems'->0->>'formation','automatic','automatic is never Explorer-confirmed');
select is(pg_temp.state()->'compassItems'->0->>'anchor','apex','first point occupies apex');
select is(pg_temp.state()->>'attentionId',pg_temp.state()->'compassItems'->0->>'id','first point sets the empty needle once');
select is(jsonb_array_length(pg_temp.state()->'route'),1,'first addition records one follow_attention event');
select is(jsonb_array_length(pg_temp.state()->'compassChanges'),1,'one sanitized committed bundle');
-- Independent review of 2026-11-12, finding 3: the settlement chooses the notice; storage accepts either kind.
select is(pg_temp.state()->'compassChanges'->0->'changes'->0->>'noticeKind','early_topic',
  'the first point, placed at the top, is announced as a possible early topic');
select ok((select ai.solmind_compass_additions_valid_v1(jsonb_set(b.changes,'{0,noticeKind}','"not_yet_clear"'))
    and not ai.solmind_compass_additions_valid_v1(jsonb_set(b.changes,'{0,noticeKind}','"other"'))
    and not ai.solmind_compass_additions_valid_v1(b.changes#-'{0,noticeKind}')
  from ai.explorer_compass_change_bundle b where b.conversation_id=pg_temp.gid(6005) order by b.revision limit 1),
  'a stored receipt may carry either notice kind at any position, and no other or missing kind');
select ok(not ((pg_temp.state()->'compassChanges')::text like '%supportingMessageIds%'),'browser receipt excludes evidence');
select is((select outcome from pg_temp.settle_private(3,topics=>(select value from third_payload))),'exact_replay','terminal replay applies no evidence or addition');
select is((select count(*)::integer from ai.explorer_compass_topic_support),3,'replay preserves exactly three supports');
select throws_ok($$select * from pg_temp.settle_private(3,topics=>'[]')$$,
  'P0001','solmind_explorer_private_operation_conflict','changed topic arguments conflict with terminal intent');
select ok((select dispatch_permitted from pg_temp.prepare_private(4)),'batch Send prepared');
select ok((select saved_reply from pg_temp.settle_private(4,topics=>jsonb_build_array(
  pg_temp.topic(4,'Time outdoors',array['h0','h2','now'],true),
  pg_temp.topic(4,'Time to read',array['h0','h2','now'],true)))),'one message may structurally support two different topics');
select is(pg_temp.state()->'compassItems'->1->>'anchor','upper_left','second point occupies upper left');
select is(pg_temp.state()->'compassItems'->2->>'anchor','upper_right','third point occupies upper right');
select is(pg_temp.state()->>'attentionId',pg_temp.state()->'compassItems'->0->>'id','later additions preserve the needle');
select ok((select dispatch_permitted from pg_temp.prepare_private(5)),'malformed reference Send prepared');
select ok((select saved_reply from pg_temp.settle_private(5,topics=>jsonb_build_array(
  pg_temp.topic(5,'Guide text cannot support',array['h1'],true),
  jsonb_set(pg_temp.topic(5,'Forged mapping',array['now'],false),'{supports,0,messageId}',to_jsonb(pg_temp.gid(999))),
  jsonb_set(pg_temp.topic(5,'Absent window',array['now'],false),'{supports,0,ref}','"h23"')))),'optional mapping failures preserve prose');
select is((select count(*)::integer from ai.explorer_compass_topic),3,'Guide, forged and absent-window references create no topics');
select ok((select dispatch_permitted from pg_temp.prepare_private(6)),'full-proof validation Send prepared');
select ok((select saved_reply from pg_temp.settle_private(6,topics=>jsonb_build_array(
  pg_temp.topic(6,'Time for myself',array['now','h1'],true)))),'full proof still validates every submitted reference');
select is((select count(*)::integer from ai.explorer_compass_topic_support where topic_id=(select topic_id from ai.explorer_compass_topic where label='Time for myself')),3,
  'full proof remains immutable and capped');
select throws_ok($$update ai.explorer_compass_topic_support set support_slot=2$$,'P0001','solmind_explorer_private_immutable','evidence cannot be rewritten');
select throws_ok($$delete from ai.explorer_compass_change_bundle$$,'P0001','solmind_explorer_private_immutable','receipt cannot be deleted');
select throws_ok($$update ai.explorer_conversation_state set compass_mode='legacy' where conversation_id=pg_temp.gid(6005)$$,
  'P0001','solmind_explorer_private_immutable','mode cannot change at runtime');
select is((select outcome from public.solmind_mutate_explorer_conversation_v3(
  pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(90001),(pg_temp.state()->>'revision')::integer,
  'add_compass',repeat('C',64),pg_temp.gid(10011),null,null,'Manual topic')),'operation_conflict','fresh manual Compass is retired');
select ok((select dispatch_permitted from pg_temp.prepare_private(7)),'retired fields Send prepared');
select ok((select saved_reply from pg_temp.settle_private(7,suggestions=>'[{"label":"Retired topic"}]',
  responses=>'[]')),'retired fields preserve saved prose');
select is((select count(*)::integer from ai.explorer_compass_topic),3,'retired fields create no new topic');
select is((select outcome from pg_temp.settle_private(7,suggestions=>'[{"label":"Retired topic"}]',responses=>'[]')),
  'exact_replay','null topics preserve historical settlement fingerprint extension rules');
select ok((select dispatch_permitted from pg_temp.prepare_private(8)),'delivery-loss Send prepared');
select ok((select not saved_reply from pg_temp.settle_private(8,interested=>false,topics=>jsonb_build_array(
  pg_temp.topic(8,'Delivery absent',array['now'],false)))),'delivery loss saves no topic effects');
select is((select count(*)::integer from ai.explorer_compass_topic),3,'delivery loss retains prior evidence only');

-- Controlled assertions count distinct Explorer responses, never total conversation length.
create function pg_temp.last_refs(slot_n integer) returns text[] language sql stable as $$
  select array(select 'h'||(m->>'order') from jsonb_array_elements(serialization::jsonb->'currentSessionMessages') m
    where m->>'role'='explorer' order by (m->>'order')::integer desc limit 2)||array['now']
    from lifecycle_intent where slot=slot_n
$$;
select ok((select dispatch_permitted from pg_temp.prepare_private(9)),'six-point batch prepared');
select ok((select saved_reply from pg_temp.settle_private(9,topics=>jsonb_build_array(
  pg_temp.topic(9,'Time to cook',pg_temp.last_refs(9),true),
  pg_temp.topic(9,'Time to rest',pg_temp.last_refs(9),true),
  pg_temp.topic(9,'Time to learn',pg_temp.last_refs(9),true)))),'three further points share one atomic reply');
select ok((select dispatch_permitted from pg_temp.prepare_private(10)),'full-dial batch prepared');
select ok((select saved_reply from pg_temp.settle_private(10,topics=>jsonb_build_array(
  pg_temp.topic(10,'Time with friends',pg_temp.last_refs(10),true),
  pg_temp.topic(10,'Time to walk',pg_temp.last_refs(10),true),
  pg_temp.topic(10,'Time to draw',pg_temp.last_refs(10),true)))),'full dial keeps the ninth candidate private');
select is((select count(*)::integer from ai.explorer_conversation_compass_item where conversation_id=pg_temp.gid(6005)),8,'no ninth or unplaced point');
select is((select count(distinct compass_anchor)::integer from ai.explorer_conversation_compass_item where conversation_id=pg_temp.gid(6005)),8,'all eight anchors unique');
select is((select count(*)::integer from ai.explorer_compass_topic_support s join ai.explorer_compass_topic t using(topic_id)
  where t.label='Time to draw'),3,'full dial retains candidate proof');
select is((select count(*)::integer from ai.explorer_conversation_compass_item where compass_anchor is null),0,'automatic insertion never makes an unplaced row');
select ok((select bool_and(relative_emphasis=1) from ai.explorer_conversation_compass_item),'automatic emphasis is always one');
select is((select outcome from pg_temp.settle_private(3,topics=>(select value from third_payload))),'exact_replay','replay precedes changed context and full capacity');
select is((select count(*)::integer from ai.explorer_compass_topic_support where topic_id=(select topic_id from ai.explorer_compass_topic where label='Time for myself')),3,'replay after capacity changes adds no support');

do $$ declare turn integer; proposals jsonb; j integer; begin
  for turn in 11..15 loop
    if not (select dispatch_permitted from pg_temp.prepare_private(turn)) then raise exception 'fixture_prepare'; end if;
    proposals:='[]';
    for j in 1..3 loop
      proposals:=proposals||jsonb_build_array(pg_temp.topic(turn,'Candidate '||turn||' '||j,array['now'],false));
    end loop;
    if not (select saved_reply from pg_temp.settle_private(turn,topics=>proposals)) then raise exception 'fixture_settle'; end if;
  end loop;
end $$;
select is((select count(*)::integer from ai.explorer_compass_topic),24,'twenty-four immutable topic slots retained');
select ok((select dispatch_permitted from pg_temp.prepare_private(16)),'twenty-fifth candidate prepared');
select ok((select saved_reply from pg_temp.settle_private(16,topics=>jsonb_build_array(
  pg_temp.topic(16,'Candidate twenty-five',array['now'],false)))),'topic capacity never loses prose');
select is((select count(*)::integer from ai.explorer_compass_topic),24,'twenty-fifth topic refused');
select is((select count(*)::integer from ai.explorer_compass_topic_support where topic_id=(select topic_id from ai.explorer_compass_topic where label='Time for myself')),3,
  'support survives more than twenty-four later messages');
select ok((select not exists(select 1 from jsonb_array_elements(pg_temp.compass_context()->'topics') t
  where t->>'label'='Time for myself' and (t->'supportCount'<>'3' or t->'countedRefs'<>'[]'))),'old evidence is counted without recounting an absent window reference');

-- Rejected optional entries neither alter an existing proof nor discard prose.
select ok((select dispatch_permitted from pg_temp.prepare_private(17)),'exact identity and full proof checks prepared');
select ok((select saved_reply from pg_temp.settle_private(17,topics=>jsonb_build_array(
  jsonb_set(pg_temp.topic(17,'Time for myself',array['now'],false),'{label}','"Renamed topic"'),
  jsonb_set(pg_temp.topic(17,'Time outdoors',array['now'],false),'{topicId}',to_jsonb(pg_temp.gid(1))),
  jsonb_set(pg_temp.topic(17,'Time to read',array['now'],false),'{supports,0,messageId}',to_jsonb(pg_temp.gid(10185)))))),
  'rename, foreign topic and future-message identity are rejected independently');
select is((select count(*)::integer from ai.explorer_compass_topic_support where topic_id=(select topic_id from ai.explorer_compass_topic where label='Time for myself')),3,'renaming cannot reset identity or proof');
select ok((select dispatch_permitted from pg_temp.prepare_private(18)),'fourth-support check prepared');
select ok((select saved_reply from pg_temp.settle_private(18,topics=>jsonb_build_array(
  pg_temp.topic(18,'Time for myself',array['now'],true)))),'a fourth valid assertion leaves the original three immutable');
select is((select count(*)::integer from ai.explorer_compass_topic_support where topic_id=(select topic_id from ai.explorer_compass_topic where label='Time for myself')),3,'fourth support takes no slot');
select throws_ok($$insert into ai.explorer_compass_topic_support(conversation_id,topic_id,support_message_id,support_slot,
  actor_user_account_id,observed_operation_id,observed_reply_message_id,snapshot_id)
  select conversation_id,topic_id,pg_temp.gid(10181),4,actor_user_account_id,pg_temp.gid(10180),pg_temp.gid(10185),pg_temp.gid(10182)
  from ai.explorer_compass_topic where label='Time for myself'$$,'P0001','solmind_explorer_private_formation_conflict',
  'direct fourth support outside its pending settlement fails');

create temp table atomic_before as select pg_temp.state() state,
  (select count(*) from ai.explorer_compass_topic) topics,
  (select count(*) from ai.explorer_compass_topic_support) supports,
  (select count(*) from ai.explorer_compass_change_bundle) bundles;
create function pg_temp.abort_turn() returns void language plpgsql as $$
begin
  perform * from pg_temp.prepare_private(19);
  perform * from pg_temp.settle_private(19,topics=>jsonb_build_array(pg_temp.topic(19,'Candidate 11 1',pg_temp.last_refs(19),true)));
  raise exception 'synthetic_atomic_abort';
end $$;
select throws_ok('select pg_temp.abort_turn()','P0001','synthetic_atomic_abort','abort rolls the complete turn back');
select is(pg_temp.state(),(select state from atomic_before),'reply, revision, pending and dial roll back together');
select is((select count(*) from ai.explorer_compass_topic),(select topics from atomic_before),'topics roll back');
select is((select count(*) from ai.explorer_compass_topic_support),(select supports from atomic_before),'support rolls back');
select is((select count(*) from ai.explorer_compass_change_bundle),(select bundles from atomic_before),'bundles roll back');
select throws_ok($$insert into ai.explorer_conversation_compass_item(item_id,conversation_id,source_message_id,label,display_order,
  formation_status,wording_message_id,automatic_topic_id,compass_anchor,relative_emphasis)
  select pg_temp.gid(99002),conversation_id,created_reply_message_id,label,9,'automatic',created_reply_message_id,topic_id,null,1
  from ai.explorer_compass_topic where label='Time to draw'$$,'P0001','solmind_explorer_private_formation_conflict','direct unplaced automatic point fails');
select throws_ok($$update ai.explorer_conversation_compass_item set label='Changed automatic wording' where formation_status='automatic'$$,
  'P0001','solmind_explorer_private_immutable','automatic point identity and wording are immutable');
select ok(not ai.solmind_compass_additions_valid_v1('[{"kind":"added"}]'),'incomplete addition proof is refused');
-- Deferred proof, independently of the formation guard: a privileged automatic row (formation guard
-- suspended only around these two attempts and restored before any other assertion) must still abort
-- when its deferred proof runs. The row is combined-away so it takes no current anchor in the full dial.
create function pg_temp.unproven_point(topic_label text) returns void language plpgsql as $$
begin
  insert into ai.explorer_conversation_compass_item(item_id,conversation_id,source_message_id,label,display_order,
    formation_status,wording_message_id,automatic_topic_id,compass_anchor,relative_emphasis,merged_into_item_id)
    select pg_temp.gid(99003),t.conversation_id,t.created_reply_message_id,t.label,9,'automatic',t.created_reply_message_id,t.topic_id,'apex',1,
      (select c.item_id from ai.explorer_conversation_compass_item c where c.conversation_id=t.conversation_id order by c.display_order limit 1)
    from ai.explorer_compass_topic t where t.label=topic_label;
  if not found then raise exception 'fixture_unproven_point'; end if;
  set constraints ai.explorer_compass_automatic_proof immediate;
end $$;
select is((select count(*)::integer from ai.explorer_compass_topic_support s join ai.explorer_compass_topic t using(topic_id)
  where t.label='Candidate 11 1'),1,'fixture: a topic with one support');
set constraints ai.explorer_compass_automatic_proof immediate;
set constraints ai.explorer_compass_automatic_proof deferred;
alter table ai.explorer_conversation_compass_item disable trigger explorer_compass_formation_guard;
select throws_ok($$select pg_temp.unproven_point('Candidate 11 1')$$,'P0001','solmind_explorer_private_formation_conflict',
  'deferred proof aborts an automatic point with fewer than three supports');
select throws_ok($$select pg_temp.unproven_point('Time to draw')$$,'P0001','solmind_explorer_private_formation_conflict',
  'deferred proof aborts an automatic point with three supports but no matching change bundle');
alter table ai.explorer_conversation_compass_item enable trigger explorer_compass_formation_guard;
set constraints ai.explorer_compass_automatic_proof deferred;
select ok(not exists(select 1 from ai.explorer_conversation_compass_item where item_id=pg_temp.gid(99003))
  and exists(select 1 from pg_trigger where tgname='explorer_compass_formation_guard' and tgenabled='O'),
  'aborted proof leaves no row and the formation guard enabled');

-- Policy boundary uses the real inspector, with a new unsaved immediate identity.
select is((select outcome from ai.solmind_inspect_explorer_context_v3(pg_temp.gid(1),pg_temp.gid(50),
  pg_temp.gid(24),pg_temp.gid(25),pg_temp.gid(6005),pg_temp.compact(jsonb_set(
    pg_temp.context_value(pg_temp.gid(99001),'Time to read'),'{roleBehavior,text}',to_jsonb(repeat('x',20000)))),
  (select array_agg(distinct id order by id) from (
    select unnest(array[pg_temp.gid(52),pg_temp.gid(1001),pg_temp.gid(99001)]||pg_temp.compass_source_ids()) id
    union all select m.ai_interaction_message_id from (select * from ai.ai_interaction_message where ai_interaction_session_id=pg_temp.gid(6005)
      order by sequence_number desc limit 24) m) ids))),'clear','20000 policy characters pass SQL');
select is((select outcome from ai.solmind_inspect_explorer_context_v3(pg_temp.gid(1),pg_temp.gid(50),
  pg_temp.gid(24),pg_temp.gid(25),pg_temp.gid(6005),pg_temp.compact(jsonb_set(
    pg_temp.context_value(pg_temp.gid(99001),'Time to read'),'{roleBehavior,text}',to_jsonb(repeat('x',20001)))),
  (select array_agg(distinct id order by id) from (
    select unnest(array[pg_temp.gid(52),pg_temp.gid(1001),pg_temp.gid(99001)]||pg_temp.compass_source_ids()) id
    union all select m.ai_interaction_message_id from (select * from ai.ai_interaction_message where ai_interaction_session_id=pg_temp.gid(6005)
      order by sequence_number desc limit 24) m) ids))),'unavailable','20001 policy characters fail SQL');

-- A pending Explorer move wins over a different model proposal in the next reply.
select is((select outcome from public.solmind_mutate_explorer_conversation_v3(
  pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(90002),(pg_temp.state()->>'revision')::integer,
  'set_attention',repeat('D',64),null,(pg_temp.state()->'compassItems'->1->>'id')::uuid)),
  'ok','Explorer can still select an existing point');
select ok((select dispatch_permitted from pg_temp.prepare_private(19)),'pending Explorer acknowledgment prepared');
select ok((select saved_reply from pg_temp.settle_private(19,attention_id=>(pg_temp.state()->'compassItems'->0->>'id')::uuid)),
  'acknowledgment reply saves normally');
select is(pg_temp.state()->>'attentionId',pg_temp.state()->'compassItems'->1->>'id','different model needle cannot override pending Explorer direction');
select ok((select dispatch_permitted from pg_temp.prepare_private(20)),'subsequent ordinary needle prepared');
select ok((select saved_reply from pg_temp.settle_private(20,attention_id=>(pg_temp.state()->'compassItems'->0->>'id')::uuid)),
  'subsequent ordinary needle uses the existing path');
select is(pg_temp.state()->>'attentionId',pg_temp.state()->'compassItems'->0->>'id','answered move no longer blocks a later quiet needle');

-- Each safety branch is isolated by its own rollback, so no lowered safety state is fabricated.
create function pg_temp.safety_case(case_name text) returns boolean language plpgsql as $$
declare before_supports bigint; after_supports bigint; passed boolean:=false; result record; positive boolean:=true;
begin
  select count(*) into before_supports from ai.explorer_compass_topic_support;
  begin
    if case_name='restricted' then perform * from pg_temp.observe(22,3); end if;
    perform * from pg_temp.prepare_private(21);
    select * into result from pg_temp.settle_private(21,
      model=>case case_name when 'failed' then null when 'level2' then 2 when 'urgent' then 3 when 'crisis' then 4 when 'positive_delivery_loss' then 4 else 0 end,
      minor_flag=>case when case_name='failed' then null else case_name='adult' end,
      kind=>case case_name when 'failed' then 'none' when 'canceled' then 'none' when 'urgent' then 'urgent'
        when 'crisis' then 'crisis' when 'positive_delivery_loss' then 'crisis' when 'restricted' then 'restricted' when 'adult' then 'adult_only' else 'ordinary' end,
      status_name=>case when case_name in ('failed','canceled') then case_name else 'completed' end,
      interested=>case_name not in ('delivery_loss','positive_delivery_loss'),
      failure_reason=>case when case_name='failed' then 'invalid_response' else null end,
      topics=>jsonb_build_array(pg_temp.topic(21,'Candidate 11 2',array['now'],true)));
    select count(*) into after_supports from ai.explorer_compass_topic_support;
    if case_name in ('urgent','crisis','adult','positive_delivery_loss') then
      positive:=(select request_status='completed' from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gid(10213));
    end if;
    passed:=before_supports=after_supports and positive and
      (case when case_name in ('failed','canceled','delivery_loss','positive_delivery_loss') then not result.saved_reply else result.saved_reply end);
    raise exception 'synthetic_safety_rollback';
  exception when raise_exception then
    if sqlerrm<>'synthetic_safety_rollback' then raise; end if;
  end;
  return passed;
end $$;
select ok(pg_temp.safety_case(name),'no topic effects and preserved terminal safety: '||name)
  from unnest(array['level2','urgent','crisis','adult','restricted','failed','canceled','delivery_loss','positive_delivery_loss']) name;

select ok(c.relrowsecurity and not exists(select 1 from pg_policy p where p.polrelid=c.oid)
  and not has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE'),'private table RLS and ACL: '||c.relname)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ai'
    and c.relname in ('explorer_compass_topic','explorer_compass_topic_support','explorer_compass_change_bundle');
select ok(not has_function_privilege('service_role',p.oid,'EXECUTE')
  and not has_function_privilege('authenticated',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE'),
  'private helper execution: '||p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='ai' and p.proname in ('solmind_compass_evidence_v1','solmind_plan_automatic_compass_v1',
    'solmind_apply_automatic_compass_v1','solmind_compass_additions_valid_v1','solmind_compass_mode_guard_v1',
    'solmind_automatic_compass_rows_guard_v1','solmind_automatic_compass_proof_guard_v1');
select ok(p.pronargs=28 and p.prosecdef and has_function_privilege('service_role',p.oid,'EXECUTE')
  and not has_function_privilege('authenticated',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE'),
  'sole settlement identity has 28 arguments and only service-role API execution')
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='solmind_settle_explorer_conversation_turn_v4';

-- Seed historical storage as it existed before this migration. Only the formation
-- trigger is suspended during fixture INSERTs, then restored before every assertion.
-- These privileged fixture writes are rollback-only and are never application paths.
insert into ai.ai_interaction_session select (jsonb_populate_record(null::ai.ai_interaction_session,
  to_jsonb(s)||jsonb_build_object('ai_interaction_session_id',pg_temp.gid(7005)))).*
  from ai.ai_interaction_session s where s.ai_interaction_session_id=pg_temp.gid(6005);
insert into ai.explorer_conversation_state select (jsonb_populate_record(null::ai.explorer_conversation_state,
  to_jsonb(s)||jsonb_build_object('conversation_id',pg_temp.gid(7005),'revision',4,
    'pending_operation_id',null,'priority_id',null,'attention_id',null,'compass_mode','legacy'))).*
  from ai.explorer_conversation_state s where s.conversation_id=pg_temp.gid(6005);
insert into ai.ai_interaction_message select (jsonb_populate_record(null::ai.ai_interaction_message,
  to_jsonb(m)||jsonb_build_object('ai_interaction_message_id',pg_temp.gid(7001),'ai_interaction_session_id',pg_temp.gid(7005),'sequence_number',1))).*
  from ai.ai_interaction_message m where m.ai_interaction_message_id=pg_temp.gid(10011);
insert into ai.ai_interaction_message select (jsonb_populate_record(null::ai.ai_interaction_message,
  to_jsonb(m)||jsonb_build_object('ai_interaction_message_id',pg_temp.gid(7002),'ai_interaction_session_id',pg_temp.gid(7005),'sequence_number',2))).*
  from ai.ai_interaction_message m where m.ai_interaction_message_id=pg_temp.gid(10015);
-- ALTER TABLE refuses pending deferred events: check the queued automatic proofs now.
set constraints ai.explorer_compass_automatic_proof immediate;
set constraints ai.explorer_compass_automatic_proof deferred;
alter table ai.explorer_conversation_compass_item disable trigger explorer_compass_formation_guard;
insert into ai.explorer_conversation_compass_item(item_id,conversation_id,source_message_id,label,display_order,
  formation_status,wording_message_id,compass_anchor,relative_emphasis,merged_into_item_id) values
  (pg_temp.gid(7011),pg_temp.gid(7005),pg_temp.gid(7002),'Earlier topic',1,'confirmed',pg_temp.gid(7002),'apex',3,null),
  (pg_temp.gid(7012),pg_temp.gid(7005),pg_temp.gid(7002),'Earlier forming topic',2,'proposed',pg_temp.gid(7002),null,null,null),
  (pg_temp.gid(7013),pg_temp.gid(7005),pg_temp.gid(7002),'Earlier rejected topic',3,'rejected',pg_temp.gid(7002),null,null,null),
  (pg_temp.gid(7014),pg_temp.gid(7005),pg_temp.gid(7001),'Earlier combined topic',4,null,null,null,null,pg_temp.gid(7011));
alter table ai.explorer_conversation_compass_item enable trigger explorer_compass_formation_guard;
update ai.explorer_conversation_state set priority_id=pg_temp.gid(7011),attention_id=pg_temp.gid(7012) where conversation_id=pg_temp.gid(7005);
create temp table legacy_before as select ai.solmind_conversation_state_json(pg_temp.gid(7005)) state;
select is((select state->>'compassMode' from legacy_before),'legacy','historical storage remains legacy');
select is((select jsonb_array_length(state->'compassItems') from legacy_before),3,'legacy forming, confirmed and merged rows remain readable; rejection stays private');
select is((select state->>'priorityId' from legacy_before),pg_temp.gid(7011)::text,'legacy Priority is retained');
select is(ai.solmind_compass_evidence_v1(pg_temp.gid(7005)),'[]'::jsonb,'legacy meaning is never converted into invented evidence');
select is((select outcome from public.solmind_mutate_explorer_conversation_v3(
  pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(7005),pg_temp.gid(7020),4,'confirm_priority',repeat('E',64),null,pg_temp.gid(7011))),
  'operation_conflict','fresh legacy Priority is retired');
select is((select outcome from public.solmind_respond_explorer_compass_suggestion_v1(
  pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(7005),pg_temp.gid(7021),4,repeat('E',64),pg_temp.gid(7012),'right')),
  'operation_conflict','fresh legacy confirmation is retired');
select is((select outcome from public.solmind_confirm_explorer_compass_arrangement_v1(
  pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(7005),pg_temp.gid(7022),4,repeat('E',64),pg_temp.gid(7011),
  jsonb_build_array(jsonb_build_object('compassItemId',pg_temp.gid(7011),'anchor','apex','emphasis',3)))),
  'operation_conflict','fresh legacy arrangement is retired');
select is((select outcome from public.solmind_confirm_explorer_compass_category_v1(
  pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(7005),pg_temp.gid(7023),4,repeat('E',64),pg_temp.gid(7011),array[pg_temp.gid(7011)],'Changed wording')),
  'operation_conflict','fresh legacy category is retired');
-- Independent review of 2026-11-12, finding 2: the refusal is given only to a login that has not expired.
create temp table login_expiry_before as select expires_at from identity.user_session where user_session_id=pg_temp.gid(50);
update identity.user_session set expires_at=clock_timestamp()-interval '1 second' where user_session_id=pg_temp.gid(50);
select throws_ok($$select * from public.solmind_respond_explorer_compass_suggestion_v1(
  pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(7005),pg_temp.gid(7025),4,repeat('E',64),pg_temp.gid(7012),'right')$$,
  'P0001','solmind_explorer_conversation_denied',
  'with an expired login a fresh retired command is denied at the login check, never answered as a conflict');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where (n.nspname,p.proname) in (('public','solmind_respond_explorer_compass_suggestion_v1'),
      ('public','solmind_confirm_explorer_compass_arrangement_v1'),('public','solmind_confirm_explorer_compass_category_v1'),
      ('ai','solmind_resolve_forming_compass_point'))
    and p.prosrc ~ $re$applicationSessionExpiresAt'\)::timestamptz<=clock_timestamp\(\) then raise exception 'solmind_explorer_private_denied'; end if;\s+return query select 'operation_conflict'::text,null::jsonb; return;$re$),
  4,'each of the four retired commands rechecks the login''s expiry immediately before its fresh refusal');
update identity.user_session set expires_at=(select expires_at from login_expiry_before) where user_session_id=pg_temp.gid(50);
select is(ai.solmind_conversation_state_json(pg_temp.gid(7005)),(select state from legacy_before),'retirement preserves every historical field and revision');
select is((select outcome from public.solmind_end_explorer_conversation_v1(
  pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(7005),pg_temp.gid(7024),4,repeat('F',64))),'ok','legacy End remains available');
select is(ai.solmind_conversation_state_json(pg_temp.gid(7005))->'ending'->>'directionsTaken',
  'The confirmed Priority at the end was "Earlier topic". Current attention was still forming. There are no recorded Route changes for this conversation.',
  'legacy ending wording remains byte for byte');
select is((select outcome from public.solmind_end_explorer_conversation_v1(
  pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(7005),pg_temp.gid(7024),4,repeat('F',64))),'exact_replay','authenticated historical ending replays without mutation');

-- The full existing safety, exclusion, blocked-audit and Waypoint pgTAP suites
-- remain Executor regression checks. Structural evidence does not certify meaning.
select * from finish();
rollback;
