-- PROPOSAL AUTHORSHIP / ALL CASES UNRUN. The Executor executes serially in an isolated
-- migration-proof DB only. No shared DB, Auth/browser/provider or real users.
-- The copied synthetic role/topology/methodology fixtures below exercise actual
-- closed SQL governance transitions, but fabricated local screen/classification
-- results are NOT actual AI or human approval/operational-readiness evidence.
-- These serial fixtures do not prove simultaneous sessions or browser uncertain acknowledgements.
-- Synthetic real SQL transition proof. Rollback-only isolated DB.
-- Current executed evidence: solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md.
-- Synthetic account/role/session fixtures exercise actual closed SQL predicates;
-- they do not prove real Auth/browser login, actual human review, a genuine AI
-- screen, policy approval, source rights or any provider call. Synthetic screen
-- results below are intentionally fabricated local fixtures, never production.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,pg_catalog,pg_temp;
set local statement_timeout='120s';
select plan(40);

create function pg_temp.gid(n integer) returns uuid language sql immutable as $$
  select ('f4260000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
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
-- with the point's current label), the current Waypoint heads, no drafts.
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
    'mode',case when (select compass_mode from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005))='automatic'
      then 'automatic' else 'legacy_read_only' end,
    'capacity',case when (select compass_mode from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005))<>'automatic'
      then jsonb_build_object('originalsRemaining',0,'topicSlotsRemaining',0,'visibleSlotsRemaining',0)
      else jsonb_build_object('originalsRemaining',greatest(0,24-(select count(*) from ai.explorer_conversation_compass_item
      where conversation_id=pg_temp.gid(6005) and formation_status is distinct from 'rejected')),
      'topicSlotsRemaining',greatest(0,24-(select count(*) from ai.explorer_compass_topic where conversation_id=pg_temp.gid(6005))),
      'visibleSlotsRemaining',greatest(0,8-(select count(*) from ai.explorer_conversation_compass_item
        where conversation_id=pg_temp.gid(6005) and merged_into_item_id is null and formation_status is distinct from 'rejected'))) end,
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
  body_override text default null,reply_choice boolean default false,verified_marker boolean default false)
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
    c:=pg_temp.compact(case when classification_only then pg_temp.context_value(msg,b,true)
      else jsonb_set(pg_temp.context_value(msg,b),'{compassContext,immediateMessageIsReplyChoice}',to_jsonb(verified_marker)) end);
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
    saved.safety_version,saved.fallback,saved.minor,'gpt-5.6-luna',reply_choice);
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

-- REV302b: requires the Waypoint-limits migration and preserves its bounded head/source selection.
-- All fixtures stay local and rollback-only; database execution is held.
select is(pg_temp.register_version(1001),'ok','CV: synthetic methodology version registered');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.screen_start(1001)),'CV: synthetic screen receipt prepared');
select is(pg_temp.screen_terminal(1001),'ok','CV: fabricated screen pass settled');
select is(pg_temp.admin_review(1001),'ok','CV: synthetic Admin review recorded');
select is(pg_temp.guide_decision(1001),'ok','CV: synthetic owning Guide approval recorded');
select ok((select outcome='created' from pg_temp.ensure_anchor()),'CV: empty owned conversation created');
-- REV391 (contract Part C): the TypeScript counterpart of this test's golden builds from a state without
-- compassMode, which normalizes to a legacy conversation. The equivalent SQL fixture is therefore a conversation
-- that existed before the migration, which the migration marks legacy by the column's initial default. A
-- privileged fixture write with only the mode guard suspended, restored at once; never an application path.
set constraints ai.explorer_private_state_coherent immediate;
set constraints ai.explorer_private_state_coherent deferred;
alter table ai.explorer_conversation_state disable trigger explorer_compass_mode_immutable;
update ai.explorer_conversation_state set compass_mode='legacy' where conversation_id=pg_temp.gid(6005);
set constraints ai.explorer_private_state_coherent immediate;
set constraints ai.explorer_private_state_coherent deferred;
alter table ai.explorer_conversation_state enable trigger explorer_compass_mode_immutable;
select ok(not ai.solmind_immediate_reply_choice_v1(pg_temp.gid(6005),'Something that happened today',true),
  'CV: a conversation without a preceding saved message has no choice marker');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(1)),'CV: initial ordinary Send prepared');
select ok((select outcome='ok' and saved_reply from pg_temp.settle_private(1,
  choices=>'[{"label":"Something that happened today"},{"label":"I have a question"}]'::jsonb)),
  'CV: immediately preceding saved reply offers exact Explorer-voice choices');

create function pg_temp.inspect(value jsonb,claim boolean default false) returns text language sql volatile as $$
  select outcome from ai.solmind_inspect_explorer_context_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(24),
    pg_temp.gid(25),pg_temp.gid(6005),pg_temp.compact(value),
    (select array_agg(distinct id order by id) from (
      select unnest(array[pg_temp.gid(52),pg_temp.gid(1001),(value#>>'{immediateExplorerMessage,messageId}')::uuid]) id
      union all select m.ai_interaction_message_id from (select * from ai.ai_interaction_message
        where ai_interaction_session_id=pg_temp.gid(6005) order by sequence_number desc limit 24) m
      union all select unnest(pg_temp.compass_source_ids())) sources),claim)
$$;
create temp table choice_context as select jsonb_set(
  pg_temp.context_value(pg_temp.gid(99901),'Something that happened today'),
  '{compassContext,immediateMessageIsReplyChoice}','true') value;
select is((select value->'compassContext' from choice_context),
  $choice_context_golden${"version":"explorer-compass-context.v8","mode":"legacy_read_only","topics":[],"messageRefs":{"history":[{"ref":"h0","order":0}],"immediate":"now"},"capacity":{"originalsRemaining":0,"topicSlotsRemaining":0,"visibleSlotsRemaining":0},"points":[],"priorityId":null,"attentionId":null,"recentRoute":[],"waypoints":[],"drafts":[],"immediateMessageIsReplyChoice":true}$choice_context_golden$::jsonb,
  'CV: SQL and TypeScript share the exact ordinary true-marker projection');
select is(pg_temp.inspect((select value from choice_context),true),'clear',
  'CV: SQL independently accepts exactly one matching saved choice with a true claim');
select is(pg_temp.inspect((select value from choice_context),false),'unavailable',
  'CV: equal typed text alone cannot assert the tapped-choice marker');
select is(pg_temp.inspect(jsonb_set((select value from choice_context),
  '{compassContext,immediateMessageIsReplyChoice}','false'),false),'clear',
  'CV: equal typed text without a tap retains the false marker');
select is(pg_temp.inspect(jsonb_set((select value from choice_context),
  '{compassContext,immediateMessageIsReplyChoice}','false'),true),'unavailable',
  'CV: SQL rejects a marker that disagrees with the independently verified tap');
select is(pg_temp.inspect((select value#-'{compassContext,immediateMessageIsReplyChoice}' from choice_context),true),
  'unavailable','CV: the ordinary marker is required even when it would be false');
select is(pg_temp.inspect(jsonb_set((select value from choice_context),
  '{compassContext,immediateMessageIsReplyChoice}','"true"'),true),'unavailable',
  'CV: the ordinary marker is a boolean, not a string');
select is(pg_temp.inspect(jsonb_set((select value from choice_context),
  '{immediateExplorerMessage,content}','"A label that was never offered"'),true),'unavailable',
  'CV: an invented matching claim cannot bypass exact saved-label rederivation');
select is(pg_temp.inspect(jsonb_set(jsonb_set((select value from choice_context),
  '{contractVersion}','"wi007-v0.1+onboarding-fields-v2+compass-v5"'),
  '{compassContext,version}','"explorer-compass-context.v5"'),true),'unavailable',
  'CV: the previous ordinary v5 revision is refused for a new turn');
select ok(not methodology.serialized_methodology_valid(pg_temp.compact(jsonb_set(
  (select value from choice_context),'{contractVersion}','"wi007-v0.1+onboarding-fields-v2+compass-v5"')),
  pg_temp.gid(1001),(select content_markdown from methodology.methodology_context_pack_version
    where methodology_context_pack_version_id=pg_temp.gid(1001))),
  'CV: methodology validation independently refuses the previous v5 ordinary revision');
select is(pg_temp.inspect(jsonb_set(jsonb_set((select value from choice_context),
  '{contractVersion}','"wi007-v0.1+onboarding-fields-v2+compass-v6"'),
  '{compassContext,version}','"explorer-compass-context.v6"'),true),'unavailable',
  'CV: the previous ordinary v6 revision is refused for a new turn');
select ok(not methodology.serialized_methodology_valid(pg_temp.compact(jsonb_set(
  (select value from choice_context),'{contractVersion}','"wi007-v0.1+onboarding-fields-v2+compass-v6"')),
  pg_temp.gid(1001),(select content_markdown from methodology.methodology_context_pack_version
    where methodology_context_pack_version_id=pg_temp.gid(1001))),
  'CV: methodology validation independently refuses the previous v6 ordinary revision');
select is(pg_temp.inspect((select value from choice_context),null),'unavailable',
  'CV: an explicit null claim fails closed at the inspector');
select throws_ok($$select * from pg_temp.prepare_private(2,reply_choice=>null)$$,
  'P0001','solmind_explorer_private_invalid_input','CV: an explicit null claim fails closed at preparation');
select ok(not ai.solmind_immediate_reply_choice_v1(pg_temp.gid(6005),'something that happened today',true)
  and not ai.solmind_immediate_reply_choice_v1(pg_temp.gid(6005),' Something that happened today',true)
  and not ai.solmind_immediate_reply_choice_v1(pg_temp.gid(6005),'Something that happened today ',true)
  and not ai.solmind_immediate_reply_choice_v1(pg_temp.gid(6005),'Something that happened',true)
  and not ai.solmind_immediate_reply_choice_v1(pg_temp.gid(6006),'Something that happened today',true),
  'CV: case, whitespace, partial labels and another conversation never match');

create function pg_temp.sequence_probe() returns boolean language plpgsql as $$
declare result boolean;
begin
  begin
    insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
      sender_type,ai_role,content_text,created_at,explorer_reply_choices)
      select pg_temp.gid(99903),pg_temp.gid(6005),3,'ai','solmind_virtual_guide','Synthetic later sequence.',
        m.created_at-interval '1 day','[{"label":"I would like another topic"}]'::jsonb
      from ai.ai_interaction_message m where m.ai_interaction_message_id=pg_temp.gid(10015);
    result:=ai.solmind_immediate_reply_choice_v1(pg_temp.gid(6005),'I would like another topic',true)
      and not ai.solmind_immediate_reply_choice_v1(pg_temp.gid(6005),'Something that happened today',true);
    raise exception using errcode='P0708',message='rollback_synthetic_fixture';
  exception when sqlstate 'P0708' then null;
  end;
  return result;
end $$;
select ok(pg_temp.sequence_probe(),'CV: the immediately preceding message follows saved sequence, never its timestamp');

create function pg_temp.byte_probe() returns boolean language plpgsql as $$
declare result boolean;
begin
  begin
    insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
      sender_type,ai_role,content_text,explorer_reply_choices)
      values(pg_temp.gid(99904),pg_temp.gid(6005),3,'ai','solmind_virtual_guide','Synthetic Unicode choice.',
        jsonb_build_array(jsonb_build_object('label',U&'Caf\00E9')));
    result:=ai.solmind_immediate_reply_choice_v1(pg_temp.gid(6005),U&'Caf\00E9',true)
      and not ai.solmind_immediate_reply_choice_v1(pg_temp.gid(6005),U&'Cafe\0301',true);
    raise exception using errcode='P0709',message='rollback_synthetic_fixture';
  exception when sqlstate 'P0709' then null;
  end;
  return result;
end $$;
select ok(pg_temp.byte_probe(),'CV: UTF-8 matching does not infer equivalence between composed and decomposed labels');

create function pg_temp.choice_case(case_name text) returns jsonb language plpgsql as $$
declare slot_n integer:=2; claim boolean:=true; marker boolean:=true;
  body_text text:='Something that happened today'; level_n integer:=0; before_counts jsonb; after_counts jsonb;
  prepared record; replayed record; settled record; changed_conflicts boolean:=false; result jsonb; setup_facts jsonb;
begin
  begin
    if case_name='typed' then claim:=false; marker:=false; end if;
    if case_name='unoffered' then body_text:='I would like something else'; marker:=false; end if;
    if case_name='stale_reply' then
      perform * from pg_temp.prepare_private(2);
      perform * from pg_temp.settle_private(2);
      slot_n:=3; marker:=false;
    elsif case_name='preceding_explorer' then
      perform * from pg_temp.prepare_private(2);
      perform * from pg_temp.settle_private(2,kind=>'none',status_name=>'failed');
      slot_n:=3; marker:=false;
    elsif case_name='duplicate' then
      perform * from pg_temp.prepare_private(2);
      perform * from pg_temp.settle_private(2,
        choices=>'[{"label":"Something that happened today"},{"label":"Something that happened today"}]'::jsonb);
      slot_n:=3; marker:=false;
    elsif case_name='classification_only' then
      level_n:=3; marker:=false;
      perform * from pg_temp.observe(2,3);
    elsif case_name='forged_marker' then body_text:='I would like something else';
    elsif case_name='unflagged_marker' then claim:=false;
    end if;
    -- Record what the setup really saved, so a case cannot pass by repeating another case.
    setup_facts:=(select jsonb_build_object(
        'newestIsGuideReply',coalesce(m.ai_role='solmind_virtual_guide',false),
        'newestLabelCount',(select count(*) from jsonb_array_elements(case when jsonb_typeof(m.explorer_reply_choices)='array'
          then m.explorer_reply_choices else '[]'::jsonb end) e where (e->>'label'='Something that happened today' or e#>>'{}'='Something that happened today')),
        'olderGuideReplyHasLabel',exists(select 1 from ai.ai_interaction_message o
          cross join lateral jsonb_array_elements(case when jsonb_typeof(o.explorer_reply_choices)='array'
            then o.explorer_reply_choices else '[]'::jsonb end) e
          where o.ai_interaction_session_id=pg_temp.gid(6005) and o.sequence_number<m.sequence_number
            and o.ai_role='solmind_virtual_guide' and (e->>'label'='Something that happened today' or e#>>'{}'='Something that happened today')))
      from ai.ai_interaction_message m where m.ai_interaction_session_id=pg_temp.gid(6005)
      order by m.sequence_number desc limit 1);
    before_counts:=jsonb_build_object(
      'sends',(select count(*) from ai.explorer_conversation_operation where kind='send'),
      'messages',(select count(*) from ai.ai_interaction_message),
      'invocations',(select count(*) from ai.ai_model_invocation),
      'snapshots',(select count(*) from ai.ai_context_snapshot));
    select * into prepared from pg_temp.prepare_private(slot_n,lvl=>level_n,
      body_override=>body_text,reply_choice=>claim,verified_marker=>marker);
    if prepared.outcome='ok' then
      select * into settled from pg_temp.settle_private(slot_n,
        kind=>case when level_n>=3 then 'urgent' else 'ordinary' end);
      after_counts:=jsonb_build_object(
        'sends',(select count(*) from ai.explorer_conversation_operation where kind='send'),
        'messages',(select count(*) from ai.ai_interaction_message),
        'invocations',(select count(*) from ai.ai_model_invocation),
        'snapshots',(select count(*) from ai.ai_context_snapshot));
      select * into replayed from pg_temp.prepare_private(slot_n,lvl=>level_n,
        body_override=>body_text,reply_choice=>claim,verified_marker=>marker);
      begin
        perform * from pg_temp.prepare_private(slot_n,lvl=>level_n,
          body_override=>body_text,reply_choice=>not claim,verified_marker=>marker);
      exception when raise_exception then
        changed_conflicts:=sqlerrm='solmind_explorer_private_operation_conflict';
      end;
      result:=jsonb_build_object('outcome',prepared.outcome,'dispatch',prepared.dispatch_permitted,
        'marker',(select serialization::jsonb#>'{compassContext,immediateMessageIsReplyChoice}' from lifecycle_intent where slot=slot_n),
        'mode',(select mode from lifecycle_intent where slot=slot_n),
        'hasCompass',(select serialization::jsonb ? 'compassContext' from lifecycle_intent where slot=slot_n),
        'contract',(select serialization::jsonb->>'contractVersion' from lifecycle_intent where slot=slot_n),
        'saved',settled.saved_reply,'replay',replayed.outcome,'redispatch',replayed.dispatch_permitted,
        'changedConflicts',changed_conflicts,'setup',setup_facts,
        'sendDelta',(after_counts->>'sends')::integer-(before_counts->>'sends')::integer,
        'messageDelta',(after_counts->>'messages')::integer-(before_counts->>'messages')::integer,
        'invocationDelta',(after_counts->>'invocations')::integer-(before_counts->>'invocations')::integer,
        'snapshotDelta',(after_counts->>'snapshots')::integer-(before_counts->>'snapshots')::integer,
        'replayUnchanged',after_counts=jsonb_build_object(
          'sends',(select count(*) from ai.explorer_conversation_operation where kind='send'),
          'messages',(select count(*) from ai.ai_interaction_message),
          'invocations',(select count(*) from ai.ai_model_invocation),
          'snapshots',(select count(*) from ai.ai_context_snapshot)));
    else
      result:=jsonb_build_object('outcome',prepared.outcome,'dispatch',prepared.dispatch_permitted,'setup',setup_facts,
        'unchanged',before_counts=jsonb_build_object(
          'sends',(select count(*) from ai.explorer_conversation_operation where kind='send'),
          'messages',(select count(*) from ai.ai_interaction_message),
          'invocations',(select count(*) from ai.ai_model_invocation),
          'snapshots',(select count(*) from ai.ai_context_snapshot)));
    end if;
    raise exception using errcode='P0707',message='rollback_synthetic_fixture';
  exception when sqlstate 'P0707' then null;
  end;
  return result;
end $$;
create temp table choice_cases as select name,pg_temp.choice_case(name) value from unnest(
  array['exact','typed','unoffered','stale_reply','preceding_explorer','duplicate',
    'classification_only','forged_marker','unflagged_marker']) name;
select ok((select value->>'outcome'='ok' and value->>'dispatch'='true' and value->>'marker'='true'
  from choice_cases where name='exact'),'CV: a verified tapped label enters ordinary context');
select ok((select count(*)=5 and bool_and((value->>'outcome'='ok' and value->>'dispatch'='true'
  and value->>'marker'='false') is true) from choice_cases
  where name in ('typed','unoffered','stale_reply','preceding_explorer','duplicate')),
  'CV: typed text, unoffered labels, older replies, preceding Explorer messages and duplicates drop the marker');
select ok((select value#>>'{setup,newestIsGuideReply}'='true' and value#>>'{setup,newestLabelCount}'='0'
  and value#>>'{setup,olderGuideReplyHasLabel}'='true' from choice_cases where name='stale_reply'),
  'CV: the older-reply case really saves a newer Guide reply without the label, after one that offered it');
select ok((select value#>>'{setup,newestIsGuideReply}'='false' from choice_cases where name='preceding_explorer'),
  'CV: the preceding-Explorer case really leaves an Explorer message newest');
select ok((select value#>>'{setup,newestIsGuideReply}'='true' and value#>>'{setup,newestLabelCount}'='2'
  from choice_cases where name='duplicate'),
  'CV: the duplicate case really saves a Guide reply offering the same label twice');
select ok((select value->>'outcome'='ok' and value->>'mode'='classification_only'
  and value->>'hasCompass'='false' and value->>'contract'='wi007-v0.1+onboarding-fields-v2'
  and value->'marker'='null'::jsonb from choice_cases where name='classification_only'),
  'CV: a tapped Send leaves classification_only section-free with its existing base revision');
select ok((select count(*)=2 and bool_and((value->>'outcome'='unavailable' and value->>'dispatch'='false'
  and value->>'unchanged'='true') is true) from choice_cases where name in ('forged_marker','unflagged_marker')),
  'CV: a forged context marker saves no message, snapshot, invocation or counted Send');
select ok((select count(*)=7 and bool_and((value->>'saved'='true' and value->>'sendDelta'='1'
  and value->>'invocationDelta'='1' and value->>'snapshotDelta'='1' and value->>'messageDelta'='2') is true)
  from choice_cases where value->>'outcome'='ok'),
  'CV: every accepted tapped or dropped-choice Send counts exactly once and uses one invocation');
select ok((select count(*)=7 and bool_and((value->>'replay'='exact_replay' and value->>'redispatch'='false'
  and value->>'replayUnchanged'='true' and value->>'changedConflicts'='true') is true)
  from choice_cases where value->>'outcome'='ok'),
  'CV: exact replay never redispatches, and changing the raw tap claim conflicts even when dropped or classification_only');

select ok((select count(*)=1 and bool_and(p.pronargs=38 and p.proargnames[38]='p_reply_choice'
  and p.pronargdefaults=1 and p.prosecdef and p.proowner='postgres'::regrole
  and p.proconfig @> array['search_path=""','lock_timeout=2000ms','statement_timeout=5000ms'])
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='solmind_prepare_explorer_conversation_turn_v3'
    and has_function_privilege('service_role',p.oid,'EXECUTE')),
  'CV: only the 38-argument prepare is active, with the same owner, definer mode and finite timeouts');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='solmind_prepare_explorer_conversation_turn_v3' and p.pronargs=37),
  'CV: the replaced 37-argument overload is absent');
select ok((select count(*)=2 and bool_and(p.pronargs=8 and p.proargnames[8]='p_reply_choice'
  and p.pronargdefaults=1 and not p.prosecdef and p.proowner='postgres'::regrole
  and p.proconfig @> array['search_path=""','lock_timeout=2000ms'])
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='ai'
  and p.proname in ('solmind_inspect_explorer_context_v3','solmind_record_explorer_context_exclusion_v3')),
  'CV: inspector and audited exclusion arm retain invoker isolation and bounded locking');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join unnest(array['anon','authenticated','service_role']) r(name)
  where n.nspname='ai' and p.proname in ('solmind_immediate_reply_choice_v1',
    'solmind_inspect_explorer_context_v3','solmind_record_explorer_context_exclusion_v3')
    and has_function_privilege(r.name,p.oid,'EXECUTE'))
  and not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where p.proname in ('solmind_immediate_reply_choice_v1','solmind_inspect_explorer_context_v3',
      'solmind_record_explorer_context_exclusion_v3','solmind_prepare_explorer_conversation_turn_v3')
      and a.grantee=0 and a.privilege_type='EXECUTE'),
  'CV: no API role can call the internal choice/source boundaries and PUBLIC gets no execute capability');
select ok(not has_table_privilege('service_role','ai.ai_interaction_message','SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('service_role','ai.explorer_conversation_operation','SELECT,INSERT,UPDATE,DELETE'),
  'CV: saved replies and counted Send receipts retain closed direct access');
select * from finish();
rollback;
