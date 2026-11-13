-- S7b typed Waypoint replies: synthetic rollback-only SQL construction proof.
-- migration-proof DB only. No shared DB, Auth/browser/provider or real users.
-- The copied synthetic role/topology/methodology fixtures below exercise actual
-- closed SQL governance transitions, but fabricated local screen/classification
-- results are NOT actual AI or human approval/operational-readiness evidence.
-- Sequential alternate-tab calls below are not a real overlap proof; the Executor must
-- separately exercise simultaneous sessions and client uncertain-ack boundaries.
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
select plan(50);

create function pg_temp.gid(n integer) returns uuid language sql immutable as $$
  select ('f47a0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
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
  interested boolean default true,fallback_override integer default null,attention_n integer default null,choices jsonb default null,suggestions jsonb default null,attention_id uuid default null,responses jsonb default null,waypoint jsonb default null,waypoint_response jsonb default null)
returns table(outcome text,conversation_state jsonb,policy_state jsonb,saved_reply boolean)
language sql as $$
  select * from public.solmind_settle_explorer_conversation_turn_v4(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(10000+slot_n*10),status_name,case when kind='none' then null else pg_temp.gid(10005+slot_n*10) end,
    kind,case when kind='none' then null else body end,model::smallint,minor_flag,'explorer-safety-reply.v2',
    (select mode from lifecycle_intent where slot=slot_n),repeat('A',64),'synthetic-fallback.v1',
    'synthetic-model-policy.v1','synthetic-trusted.v1','synthetic-resources.v1',
    coalesce(fallback_override,(select fallback from lifecycle_intent where slot=slot_n))::smallint,
    (select minor from lifecycle_intent where slot=slot_n),interested,
    coalesce(attention_id,case when attention_n is null then null else pg_temp.gid(attention_n) end),choices,suggestions,responses,waypoint,waypoint_response)
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
      union all select unnest(pg_temp.compass_source_ids())) ids)))
$$;

create function pg_temp.foreign_waypoint_draft() returns uuid language plpgsql as $$
declare a jsonb; policy jsonb; e jsonb; context_value jsonb; serialization text; source_ids uuid[]; draft_id uuid;
begin
  if not exists(select 1 from pg_temp.ensure_anchor(6006,4,54) where outcome='created') then raise exception 'fixture'; end if;
  select r.authority_context,r.policy_state into a,policy from public.solmind_read_explorer_conversation_v3(
    pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6006)) r;
  e:=methodology.resolve_effective(pg_temp.gid(1000),pg_temp.gid(23));
  context_value:=pg_temp.context_value(pg_temp.gid(20001),'Synthetic other Explorer message.')||jsonb_build_object(
    'sessionContext',jsonb_build_object('sessionType','explorer_virtual_guide','explorerId',pg_temp.gid(26),
      'sessionId',pg_temp.gid(6006),'continuityBindingId',pg_temp.gid(27),'explorerDisplayName',null,
      'activeFocusItems','[]'::jsonb,'nextAppointment',null,'explorerSafeGuardrail',null),
    'approvedContinuity',(select jsonb_agg(jsonb_build_object('sourceId',pg_temp.gid(55),'order',f.ord-1,
      'kind','onboarding_answer','field',f.name,'content',ai.solmind_exclusion_normalize_v3(i.response_json->>f.name)) order by f.ord)
      from core.intake_response_set i cross join unnest(array['supportNow','usefulOutcome','supportStyle'])
        with ordinality f(name,ord) where i.intake_response_set_id=pg_temp.gid(55)),
    'currentSessionMessages','[]'::jsonb,
    'immediateExplorerMessage',jsonb_build_object('messageId',pg_temp.gid(20001),'explorerId',pg_temp.gid(26),
      'sessionId',pg_temp.gid(6006),'role','explorer','content','Synthetic other Explorer message.'),
    'compassContext',jsonb_build_object('version','explorer-compass-context.v8','immediateMessageIsReplyChoice',false,
      'mode','automatic','capacity',jsonb_build_object('originalsRemaining',24,'topicSlotsRemaining',24,'visibleSlotsRemaining',8),
      'messageRefs',jsonb_build_object('history','[]'::jsonb,'immediate','now'),'topics','[]'::jsonb,'points','[]'::jsonb,
      'priorityId',null,'attentionId',null,'recentRoute','[]'::jsonb,'waypoints','[]'::jsonb,'drafts','[]'::jsonb));
  serialization:=pg_temp.compact(context_value);
  select array_agg(id order by id) into source_ids from unnest(array[pg_temp.gid(55),pg_temp.gid(1001),pg_temp.gid(20001)]) id;
  if not exists(select 1 from public.solmind_prepare_explorer_conversation_turn_v3(
    pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6006),pg_temp.gid(20000),0,pg_temp.gid(20001),
    pg_temp.gid(20002),pg_temp.gid(20003),'Synthetic other Explorer message.',serialization,
    upper(encode(extensions.digest(convert_to(serialization,'UTF8'),'sha256'),'hex')),source_ids,a->>'authorizationVersion',
    pg_temp.gid(55),pg_temp.gid(1001),'synthetic-prompt.v1','synthetic-policy.v1','synthetic-behavior.v1','synthetic-crisis.v1',
    'synthetic-role.v1','synthetic-instruction.v1',pg_temp.request_sha(20000),pg_temp.gid(20004),pg_temp.gid(1000),
    e->>'contentSha256',e->>'methodologyAuthorizationVersion','explorer-safety-reply.v2','classification_and_reply',
    repeat('A',64),'synthetic-fallback.v1','synthetic-model-policy.v1','synthetic-trusted.v1','synthetic-resources.v1',
    (policy->>'version')::bigint,0::smallint,false,'gpt-5.6-luna') where outcome='ok' and dispatch_permitted)
    then raise exception 'fixture'; end if;
  if not exists(select 1 from public.solmind_settle_explorer_conversation_turn_v4(
    pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6006),pg_temp.gid(20000),'completed',pg_temp.gid(20005),
    'ordinary','Synthetic other Explorer reply.',0::smallint,false,'explorer-safety-reply.v2','classification_and_reply',
    repeat('A',64),'synthetic-fallback.v1','synthetic-model-policy.v1','synthetic-trusted.v1','synthetic-resources.v1',
    0::smallint,false,true,null,null,null,null,pg_temp.suggestion('Other Explorer forming draft'),null) where outcome='ok' and saved_reply)
    then raise exception 'fixture'; end if;
  select waypoint_draft_id into strict draft_id from content.waypoint_draft
    where source_ai_interaction_session_id=pg_temp.gid(6006) and draft_status='proposed';
  return draft_id;
end $$;

-- Scenarios return captured results after rolling back fixture writes.
-- Assertions run outside each scenario's rolled-back subtransaction.
do $$ begin
  if not pg_temp.send_waypoint(1,pg_temp.suggestion()) then raise exception 'fixture_initial_draft'; end if;
end $$;
create temp table original_draft as select * from content.waypoint_draft;
create function pg_temp.typed_case(case_name text) returns jsonb language plpgsql as $$
declare draft_id uuid:=(select waypoint_draft_id from original_draft); slot_n integer:=2;
  proposal jsonb; refinement jsonb; answer_name text; result jsonb; settled record; replayed record;
  level_n integer:=0; model_n integer:=0; minor_n boolean:=false; interested_n boolean:=true;
  reply_kind text:='ordinary'; n integer; before_draft jsonb; before_counts jsonb; before_replay jsonb;
  receipts_before integer; changed_replay_conflicts boolean:=false; send_body text;
  foreign_id uuid; before_foreign jsonb;
begin
  begin
    answer_name:=case when case_name in ('close','button_close') then 'close'
      when case_name in ('not_it','rejected_limit') then 'not_it' else 'right' end;
    if case_name='foreign_existing' then
      foreign_id:=pg_temp.foreign_waypoint_draft();
      select to_jsonb(d) into before_foreign from content.waypoint_draft d where waypoint_draft_id=foreign_id;
    elsif case_name='old' then
      if not pg_temp.send_waypoint(2,null) then raise exception 'fixture_old_reply'; end if;
      slot_n:=3;
    elsif case_name in ('button_right','button_not_it','button_close','button_close_refined') then
      if pg_temp.answer_draft(70001,draft_id,case when case_name='button_right' then 'right'
        when case_name='button_not_it' then 'not_it' else 'close' end) is distinct from 'ok'
        then raise exception 'fixture_button_response'; end if;
      if case_name='button_close_refined' then
        if not pg_temp.send_waypoint(2,pg_temp.suggestion('Make room for breakfast'))
          then raise exception 'fixture_refined_draft'; end if;
        slot_n:=3;
      elsif case_name='button_close' then
        send_body:='Close, not quite: "Find a calmer start to mornings"';
      end if;
    elsif case_name='reword' then refinement:=pg_temp.suggestion('Make room for breakfast');
    elsif case_name='same_reword' then refinement:=pg_temp.suggestion();
    elsif case_name='restricted' then level_n:=3; model_n:=3; reply_kind:='urgent';
    elsif case_name='adult' then minor_n:=true; reply_kind:='adult_only';
    elsif case_name='level2' then model_n:=2;
    elsif case_name='classification_only' then level_n:=3;
    elsif case_name='uninterested' then interested_n:=false;
    elsif case_name in ('waypoint_limit','history_limit') then
      -- Lane 12: the active-limit case fills the allowance from an ended earlier conversation (9905), so the
      -- five-per-conversation rule never decides it; the 200-version guard is per conversation and stays here.
      if case_name='waypoint_limit' then
        insert into ai.ai_interaction_session(ai_interaction_session_id,session_type,actor_user_account_id,actor_role_context,
          guide_profile_id,explorer_profile_id,guide_explorer_relationship_id,practice_id,metadata)
        values(pg_temp.gid(9905),'explorer_reflection',pg_temp.gid(1),'explorer',pg_temp.gid(23),pg_temp.gid(24),pg_temp.gid(25),
          pg_temp.gid(22),jsonb_build_object('restricted_mode',false));
        insert into ai.explorer_conversation_state(conversation_id,actor_user_account_id,safety_contract_version,
          restricted_level,adult_reflection_stopped,safety_version)
        values(pg_temp.gid(9905),pg_temp.gid(1),'explorer-conversation-safety.v1',null,false,0);
        insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
          sender_type,sender_user_account_id,sender_role_context,content_text)
        values(pg_temp.gid(99051),pg_temp.gid(9905),1,'user',pg_temp.gid(1),'explorer','Earlier conversation source.');
        update ai.ai_interaction_session set session_status='ended',ended_at=clock_timestamp()
          where ai_interaction_session_id=pg_temp.gid(9905);
      end if;
      if case_name='history_limit' then
        -- Lane 12: 200 saved versions of one Waypoint (one original and 199 revisions), so the five-Waypoint rule cannot
        -- decide this case; only the head is current, and it is Reached, so no active place is used.
        for i in 1..200 loop
          insert into content.waypoint(waypoint_id,guide_explorer_relationship_id,source_ai_interaction_session_id,
            source_message_id,title,destination,why_it_matters,arrival_signal,lifecycle_status,chosen_by_explorer_user_account_id,
            chosen_at,predecessor_waypoint_id,creation_reason)
          values(pg_temp.gid(80000+i),pg_temp.gid(25),pg_temp.gid(6005),pg_temp.gid(10015),'Existing','Existing destination',
            'Existing meaning','Existing signal','chosen',pg_temp.gid(1),clock_timestamp(),
            case when i>1 then pg_temp.gid(80000+i-1) end,case when i>1 then 'revision' end);
        end loop;
        update content.waypoint set lifecycle_status='reached',reached_by_explorer_user_account_id=pg_temp.gid(1),
          reached_at=clock_timestamp(),reached_evidence='Explicit synthetic evidence' where waypoint_id=pg_temp.gid(80200);
      else
        insert into content.waypoint(waypoint_id,guide_explorer_relationship_id,source_ai_interaction_session_id,
          source_message_id,title,destination,why_it_matters,arrival_signal,lifecycle_status,chosen_by_explorer_user_account_id,chosen_at)
          select pg_temp.gid(80000+g.n),pg_temp.gid(25),pg_temp.gid(9905),pg_temp.gid(99051),
            'Existing','Existing destination','Existing meaning','Existing signal','chosen',pg_temp.gid(1),clock_timestamp()
            from generate_series(1,20) g(n);
      end if;
    elsif case_name in ('conversation_fifth','conversation_limit') then
      -- Lane 12: earlier different Waypoints of this same conversation, three of them Reached (Reached still counts).
      insert into content.waypoint(waypoint_id,guide_explorer_relationship_id,source_ai_interaction_session_id,source_message_id,
        title,destination,why_it_matters,arrival_signal,lifecycle_status,chosen_by_explorer_user_account_id,chosen_at,
        reached_by_explorer_user_account_id,reached_at,reached_evidence)
        select pg_temp.gid(80300+g.n),pg_temp.gid(25),pg_temp.gid(6005),pg_temp.gid(10015),
          'Earlier','Earlier destination '||g.n,'Earlier meaning','Earlier signal',
          case when g.n<=3 then 'reached' else 'chosen' end,pg_temp.gid(1),clock_timestamp(),
          case when g.n<=3 then pg_temp.gid(1) end,case when g.n<=3 then clock_timestamp() end,
          case when g.n<=3 then 'Explicit synthetic evidence' end
        from generate_series(1,case when case_name='conversation_limit' then 5 else 4 end) g(n);
    elsif case_name='rejected_limit' then
      for n in 1..24 loop
        if pg_temp.answer_draft(80000+n,draft_id,'not_it') is distinct from 'ok' then raise exception 'fixture_rejection'; end if;
        if not pg_temp.send_waypoint(1+n,pg_temp.suggestion('Next proposed draft')) then raise exception 'fixture_next_draft'; end if;
        select waypoint_draft_id into strict draft_id from content.waypoint_draft where draft_status='proposed';
      end loop;
      slot_n:=26;
    elsif case_name='incomplete' then
      -- Fixture uses the existing settlement-only wording guard without inventing a new public writer.
      update ai.explorer_conversation_state set pending_operation_id=pg_temp.gid(10010) where conversation_id=pg_temp.gid(6005);
      update content.waypoint_draft set arrival_signal=null where waypoint_draft_id=draft_id;
      update ai.explorer_conversation_state set pending_operation_id=null where conversation_id=pg_temp.gid(6005);
    end if;
    proposal:=jsonb_build_object('draftId',draft_id,'response',answer_name);
    if case_name='foreign_existing' then proposal:=jsonb_set(proposal,'{draftId}',to_jsonb(foreign_id::text));
    elsif case_name='foreign' then proposal:=jsonb_set(proposal,'{draftId}',to_jsonb(pg_temp.gid(99999)::text));
    elsif case_name='missing' then proposal:=proposal-'response';
    elsif case_name='extra' then proposal:=proposal||'{"extra":true}'::jsonb;
    elsif case_name='array' then proposal:=jsonb_build_array(proposal);
    elsif case_name='uppercase' then proposal:=jsonb_set(proposal,'{response}','"RIGHT"');
    elsif case_name='bad_id' then proposal:=jsonb_set(proposal,'{draftId}','"not-a-uuid"');
    elsif case_name='json_null' then proposal:='null'::jsonb;
    end if;
    select to_jsonb(d) into before_draft from content.waypoint_draft d where waypoint_draft_id=draft_id;
    before_counts:=jsonb_build_object('sends',(select count(*) from ai.explorer_conversation_operation where kind='send'),
      'invocations',(select count(*) from ai.ai_model_invocation),'messages',(select count(*) from ai.ai_interaction_message));
    select count(*) into receipts_before from ai.explorer_conversation_operation where waypoint_suggestion_typed;
    if (level_n>=3 or minor_n) and not exists(select 1 from pg_temp.observe(slot_n,level_n,minor_n) where outcome='ok')
      then raise exception 'fixture_observe'; end if;
    if not exists(select 1 from pg_temp.prepare_private(slot_n,level_n,minor_n,send_body) where outcome='ok' and dispatch_permitted)
      then raise exception 'fixture_prepare'; end if;
    select * into settled from pg_temp.settle_private(slot_n,model=>model_n,minor_flag=>minor_n,kind=>reply_kind,
      interested=>interested_n,waypoint=>refinement,waypoint_response=>proposal);
    before_replay:=jsonb_build_object('state',pg_temp.state(),
      'drafts',(select jsonb_agg(to_jsonb(d) order by waypoint_draft_id) from content.waypoint_draft d),
      'waypoints',(select coalesce(jsonb_agg(to_jsonb(w) order by waypoint_id),'[]'::jsonb) from content.waypoint w),
      'operations',(select count(*) from ai.explorer_conversation_operation),'messages',(select count(*) from ai.ai_interaction_message),
      'invocations',(select count(*) from ai.ai_model_invocation));
    select * into replayed from pg_temp.settle_private(slot_n,model=>model_n,minor_flag=>minor_n,kind=>reply_kind,
      interested=>interested_n,waypoint=>refinement,waypoint_response=>proposal);
    begin
      perform * from pg_temp.settle_private(slot_n,model=>model_n,minor_flag=>minor_n,kind=>reply_kind,
        interested=>interested_n,waypoint=>refinement,waypoint_response=>null);
    exception when raise_exception then changed_replay_conflicts:=sqlerrm='solmind_explorer_private_operation_conflict'; end;
    result:=jsonb_build_object('outcome',settled.outcome,'saved',settled.saved_reply,'state',pg_temp.state(),
      'draft',(select to_jsonb(d) from content.waypoint_draft d where waypoint_draft_id=draft_id),
      'draftUnchanged',before_draft=(select to_jsonb(d) from content.waypoint_draft d where waypoint_draft_id=draft_id),
      'foreignUnchanged',before_foreign=(select to_jsonb(d) from content.waypoint_draft d where waypoint_draft_id=foreign_id),
      'waypoints',(select coalesce(jsonb_agg(to_jsonb(w) order by waypoint_id),'[]'::jsonb) from content.waypoint w),
      'waypointCount',(select count(*) from content.waypoint),'rejected',(select count(*) from content.waypoint_draft where draft_status='rejected'),
      'typedReceipts',(select count(*)-receipts_before from ai.explorer_conversation_operation where waypoint_suggestion_typed),
      'receipts',(select coalesce(jsonb_agg(jsonb_build_object('draftId',waypoint_suggestion_draft_id,
        'response',waypoint_suggestion_response,'typed',waypoint_suggestion_typed)),'[]'::jsonb)
        from ai.explorer_conversation_operation where waypoint_suggestion_typed),
      'noReceiptProse',not exists(select 1 from ai.explorer_conversation_operation where waypoint_suggestion_typed
        and (message_id is not null or reply_message_id is not null or invocation_id is not null or snapshot_id is not null
          or compass_route_kind is not null)),
      'buttonCloseReceipt',exists(select 1 from ai.explorer_conversation_operation o
        join ai.ai_interaction_message m on m.ai_interaction_message_id=pg_temp.gid(10015)
        where o.operation_id=pg_temp.gid(70001) and o.kind='respond_waypoint_draft'
          and o.waypoint_suggestion_draft_id=draft_id and o.waypoint_suggestion_response='close'
          and not o.waypoint_suggestion_typed and o.completed_at>=m.created_at),
      'sendBody',(select body from lifecycle_intent where slot=slot_n),
      'mode',(select mode from lifecycle_intent where slot=slot_n),
      'contextHasCompass',(select serialization::jsonb ? 'compassContext' from lifecycle_intent where slot=slot_n),
      'contextHasDraftSource',(select draft_id=any(source_ids) from lifecycle_intent where slot=slot_n),
      'replay',replayed.outcome,'changedReplayConflicts',changed_replay_conflicts,
      'replayUnchanged',before_replay=jsonb_build_object('state',pg_temp.state(),
        'drafts',(select jsonb_agg(to_jsonb(d) order by waypoint_draft_id) from content.waypoint_draft d),
        'waypoints',(select coalesce(jsonb_agg(to_jsonb(w) order by waypoint_id),'[]'::jsonb) from content.waypoint w),
        'operations',(select count(*) from ai.explorer_conversation_operation),'messages',(select count(*) from ai.ai_interaction_message),
        'invocations',(select count(*) from ai.ai_model_invocation)),
      'sendDelta',(select count(*) from ai.explorer_conversation_operation where kind='send')-(before_counts->>'sends')::integer,
      'invocationDelta',(select count(*) from ai.ai_model_invocation)-(before_counts->>'invocations')::integer,
      'messageDelta',(select count(*) from ai.ai_interaction_message)-(before_counts->>'messages')::integer);
    raise exception using errcode='P0706',message='rollback_synthetic_fixture';
  exception when sqlstate 'P0706' then null;
  end;
  return result;
end $$;
create temp table cases as select name,pg_temp.typed_case(name) value
  from unnest(array['right','close','not_it','old','button_right','button_not_it','button_close','button_close_refined',
    'reword','same_reword','restricted','adult','level2','classification_only','uninterested',
    'waypoint_limit','history_limit','conversation_fifth','conversation_limit','rejected_limit','incomplete','foreign','foreign_existing','missing','extra','array','uppercase','bad_id','json_null']) name;

select ok((select p.pronargs=28 and p.proargnames[26]='p_waypoint_response' and p.prosecdef
  and p.proowner='postgres'::regrole and p.proconfig @> array['search_path=""','lock_timeout=2000ms','statement_timeout=5000ms']
  from pg_proc p where p.oid='public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb)'::regprocedure),
  'S7b: settle has 28 arguments and preserves owner, security definer, empty search path and finite timeouts');
select ok(to_regprocedure('public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb)') is null,
  'S7b: the retired 25-argument settlement overload is absent');
select ok(to_regprocedure('public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text)') is null,
  'REV391: the retired 27-argument settlement identity is absent');
select ok(has_function_privilege('service_role',
  'public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb)','EXECUTE')
  and not has_function_privilege('anon',
  'public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb)','EXECUTE')
  and not has_function_privilege('authenticated',
  'public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb)','EXECUTE')
  and not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
    where p.proname in ('solmind_settle_explorer_conversation_turn_v4','solmind_apply_waypoint_draft_response')
      and acl.grantee=0 and acl.privilege_type='EXECUTE'),
  'S7b: service_role alone among API roles can settle, and the shared transition has no public execute grant');
select ok(not exists(select 1 from unnest(array['anon','authenticated','service_role']) r(name)
  where has_function_privilege(r.name,
    'ai.solmind_apply_waypoint_draft_response(uuid,uuid,uuid,uuid,text,text,uuid,text,timestamptz,boolean)','EXECUTE')),
  'S7b: no API role can invoke the shared Waypoint transition directly');
select ok((select value->>'outcome'='ok' and value->>'saved'='true' and value#>>'{draft,draft_status}'='confirmed'
  and value->>'typedReceipts'='1' and value->>'waypointCount'='1' and value#>'{state,waypointDraft}'='null'::jsonb
  from cases where name='right'),'S7b: typed right confirms one current proposed draft and refreshes owned state');
select ok((select value#>>'{waypoints,0,title}'='Find a calmer start to mornings'
  and value#>>'{waypoints,0,destination}'='Start my morning without rushing.'
  and value#>>'{waypoints,0,why_it_matters}'='I want room to think before work.'
  and value#>>'{waypoints,0,arrival_signal}'='I start two mornings with time for breakfast.'
  and value#>>'{waypoints,0,lifecycle_status}'='chosen'
  and value#>>'{waypoints,0,chosen_by_explorer_user_account_id}'=pg_temp.gid(1)::text
  and value#>>'{waypoints,0,suggestion_draft_id}'=(select waypoint_draft_id::text from original_draft)
  and value#>>'{waypoints,0,suggestion_message_id}'=pg_temp.gid(10015)::text
  and value#>>'{waypoints,0,suggested_by_actor_type}'='solmind_virtual_guide'
  from cases where name='right'),'S7b: right copies all four stored fields and preserves Explorer choice and draft provenance');
select ok((select value->>'saved'='true' and value->>'draftUnchanged'='true'
  and value->>'typedReceipts'='1' and value->>'waypointCount'='0' from cases where name='close'),
  'S7b: typed close records only the answer and leaves exact forming wording unchanged');
select ok((select value->>'saved'='true' and value#>>'{draft,draft_status}'='rejected'
  and value->>'typedReceipts'='1' and value->>'waypointCount'='0'
  and value#>'{state,waypointDraft}'='null'::jsonb from cases where name='not_it'),
  'S7b: typed not_it rejects privately and removes the forming card from saved state');
select ok((select value->>'saved'='true' and value->>'draftUnchanged'='true' and value->>'typedReceipts'='0'
  from cases where name='old'),'S7b: only the immediately preceding saved Virtual Guide wording may be answered');
select ok((select count(*)=2 and bool_and((value->>'saved'='true' and value->>'draftUnchanged'='true'
  and value->>'typedReceipts'='0') is true) from cases where name in ('button_right','button_not_it')),
  'S7b: a draft already confirmed or rejected by a button cannot receive a typed answer');
select ok((select value->>'saved'='true' and value->>'draftUnchanged'='true' and value->>'typedReceipts'='0'
  and value->>'buttonCloseReceipt'='true' and value->>'sendBody'='Close, not quite: "Find a calmer start to mornings"'
  from cases where name='button_close'),'S7b: completed button close at or after the wording reply blocks the automatic follow-up typed proposal');
select ok((select value->>'typedReceipts'='1' and value#>>'{draft,draft_status}'='confirmed'
  and value#>>'{waypoints,0,title}'='Make room for breakfast' from cases where name='button_close_refined'),
  'S7b: a button close before new wording does not block a clear typed answer to the later reply');
select ok((select value->>'typedReceipts'='0' and value#>>'{draft,draft_status}'='proposed'
  and value#>>'{draft,title}'='Make room for breakfast' and value#>>'{draft,suggestion_message_id}'=pg_temp.gid(10025)::text
  from cases where name='reword'),'S7b: a valid rewording in the same reply wins over its typed response');
select ok((select value->>'typedReceipts'='0' and value#>>'{draft,draft_status}'='proposed'
  and value#>>'{draft,title}'='Find a calmer start to mornings'
  and value#>>'{draft,suggestion_message_id}'=pg_temp.gid(10025)::text from cases where name='same_reword'),
  'S7b: even identical suggested wording is a new suggestion and suppresses the same-reply answer');
select ok((select count(*)=5 and bool_and((value->>'typedReceipts'='0' and value->>'draftUnchanged'='true') is true)
  from cases where name in ('restricted','adult','level2','classification_only','uninterested')),
  'S7b: restriction, adult stop, level 2, classification_only and unwanted delivery all drop typed responses');
select ok((select count(*)=3 and bool_and((value->>'mode'='classification_only'
  and value->>'contextHasCompass'='false' and value->>'contextHasDraftSource'='false') is true)
  from cases where name in ('restricted','adult','classification_only')),
  'S7b: classification_only carries neither the Compass section nor a Waypoint draft source');
select ok((select value->>'saved'='true' and value->>'typedReceipts'='0' from cases where name='level2'),
  'S7b: a saved level-2 ordinary reply remains valid while the typed proposal is ignored');
select ok((select value->>'saved'='false' and value->>'typedReceipts'='0' from cases where name='uninterested'),
  'S7b: delivery no longer wanted saves neither a reply nor a typed response');
select ok((select value->>'saved'='true' and value->>'draftUnchanged'='true' and value->>'typedReceipts'='0'
  and value->>'waypointCount'='20' from cases where name='waypoint_limit'),
  'S7b: twenty active Waypoints silently drop typed right and preserve the saved reply');
select ok((select value->>'outcome'='ok' and value->>'saved'='true' and value->>'waypointCount'='200'
  and value->>'draftUnchanged'='true' and value->>'typedReceipts'='0'
  and value#>>'{state,waypointCapacity,conversationRoom}'='true' and value#>>'{state,waypointCapacity,historyRoom}'='false'
  from cases where name='history_limit'),
  'lane 7: exhausted history silently drops typed right while the ordinary reply remains saved');
select ok((select value->>'outcome'='ok' and value->>'saved'='true' and value->>'typedReceipts'='1'
  and value#>>'{draft,draft_status}'='confirmed' and value->>'waypointCount'='5'
  and value#>>'{state,waypointCapacity,conversationRoom}'='false' from cases where name='conversation_fifth'),
  'lane 12: with four earlier Waypoints here, a typed right forms the fifth and fills this conversation');
select ok((select value->>'outcome'='ok' and value->>'saved'='true' and value->>'draftUnchanged'='true'
  and value->>'typedReceipts'='0' and value->>'waypointCount'='5'
  and value#>>'{state,waypointCapacity,conversationRoom}'='false' and value#>>'{state,waypointCapacity,activeCount}'='2'
  from cases where name='conversation_limit'),
  'lane 12: with five here, a typed right forms nothing below the active allowance while the reply is still saved');
select ok((select value->>'saved'='true' and value->>'draftUnchanged'='true' and value->>'typedReceipts'='0'
  and value->>'rejected'='24' from cases where name='rejected_limit'),
  'S7b: the 24-rejected-draft bound silently drops typed not_it and preserves the saved reply');
select ok((select value->>'saved'='true' and value->>'draftUnchanged'='true' and value->>'typedReceipts'='0'
  and value->>'waypointCount'='0' from cases where name='incomplete'),
  'S7b: incomplete stored wording cannot become a chosen Waypoint through a typed answer');
select ok((select count(*)=7 and bool_and((value->>'saved'='true' and value->>'draftUnchanged'='true'
  and value->>'typedReceipts'='0') is true)
  from cases where name in ('foreign','missing','extra','array','uppercase','bad_id','json_null')),
  'S7b: malformed or non-current selectors are dropped without losing the valid reply');
select ok((select value->>'saved'='true' and value->>'draftUnchanged'='true' and value->>'foreignUnchanged'='true'
  and value->>'typedReceipts'='0' from cases where name='foreign_existing'),
  'S7b: a real proposed draft owned by another Explorer remains unchanged and cannot be answered');
select ok((select bool_and((value->>'replay'='exact_replay' and value->>'replayUnchanged'='true') is true) from cases),
  'S7b: exact replay never repeats a transition, receipt, message or invocation for any outcome');
select ok((select bool_and((value->>'changedReplayConflicts'='true') is true) from cases),
  'S7b: changing the typed proposal conflicts even when it was malformed, ignored or gated');
select ok((select bool_and((value->>'noReceiptProse'='true') is true) from cases)
  and (select value#>'{receipts,0}'=jsonb_build_object('draftId',(select waypoint_draft_id from original_draft),
    'response','right','typed',true) from cases where name='right'),
  'S7b: an applied typed receipt records only draft id, answer and typed marker without a wording snapshot');
select ok((select bool_and((value->>'sendDelta'='1' and value->>'invocationDelta'='1'
  and (value->>'messageDelta')::integer=case when value->>'saved'='true' then 2 else 1 end) is true) from cases),
  'S7b: typed answers add no extra Send, invocation or message beyond the ordinary turn');

create temp table context_fixture as select pg_temp.context_value(pg_temp.gid(99901),'Synthetic typed Waypoint answer.') value;
select is(pg_temp.inspect((select value from context_fixture)),'clear','S7b: SQL accepts the current v7 draft projection');
select is((select value#>'{compassContext,drafts,0,suggestedInPreviousReply}' from context_fixture),'true'::jsonb,
  'S7b: the draft from the immediately preceding saved Virtual Guide reply has the true signal');
select is(pg_temp.inspect(jsonb_set((select value from context_fixture),'{compassContext,drafts,0,suggestedInPreviousReply}','false')),
  'unavailable','S7b: a forged provenance signal fails inspection');
select is(pg_temp.inspect((select value#-'{compassContext,drafts,0,suggestedInPreviousReply}' from context_fixture)),
  'unavailable','S7b: omitting the new signal fails inspection');
select is(pg_temp.inspect(jsonb_set(jsonb_set((select value from context_fixture),'{contractVersion}',
  '"wi007-v0.1+onboarding-fields-v2+compass-v4"'),'{compassContext,version}','"explorer-compass-context.v4"')),
  'unavailable','S7b: compass-v4 is refused for every new ordinary turn');
select ok(not methodology.serialized_methodology_valid(pg_temp.compact(jsonb_set(jsonb_set((select value from context_fixture),
  '{contractVersion}','"wi007-v0.1+onboarding-fields-v2+compass-v4"'),'{compassContext,version}','"explorer-compass-context.v4"')),
  pg_temp.gid(1001),(select content_markdown from methodology.methodology_context_pack_version where methodology_context_pack_version_id=pg_temp.gid(1001))),
  'S7b: methodology validation independently refuses compass-v4');
select ok(pg_temp.send_waypoint(2,null),'S7b: an ordinary reply without a draft suggestion can save');
select is(pg_temp.compass_context()#>'{drafts,0,suggestedInPreviousReply}','false'::jsonb,
  'S7b: a later saved reply makes the older draft wording ineligible');
select is(pg_temp.inspect(pg_temp.context_value(pg_temp.gid(99902),'Synthetic older draft answer.')),'clear',
  'S7b: SQL accepts the exact false provenance signal for older wording');
select ok(pg_temp.send_waypoint(3,pg_temp.suggestion('Keep the drafted title')),
  'S7b: a later refinement makes the same proposed draft current again');
select is(pg_temp.compass_context()#>'{drafts,0,suggestedInPreviousReply}','true'::jsonb,
  'S7b: the latest refinement restores eligibility without changing the draft identity');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(4)),
  'S7b: fixture prepares a final ordinary typed confirmation');
select ok((select outcome='ok' and saved_reply from pg_temp.settle_private(4,
  waypoint_response=>jsonb_build_object('draftId',(select waypoint_draft_id from original_draft),'response','right'))),
  'S7b: the final typed answer confirms the exact refined wording');
select throws_ok($$update ai.explorer_conversation_operation set waypoint_suggestion_typed=false where waypoint_suggestion_typed$$,
  'P0001','solmind_explorer_private_immutable','S7b: an applied typed receipt cannot be relabeled as a button answer');
select throws_ok($$delete from ai.explorer_conversation_operation where waypoint_suggestion_typed$$,
  'P0001','solmind_explorer_private_immutable','S7b: an applied typed receipt cannot be deleted');
create temp table chosen_before_revision as select * from content.waypoint;
select is((select outcome from public.solmind_confirm_explorer_waypoint_revision_v1(
  pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(91001),(pg_temp.state()->>'revision')::integer,
  pg_temp.request_sha(91001),'revise_waypoint',(select waypoint_id from chosen_before_revision),
  '[{"component":"destination","answer":"A revised destination that is not the title."}]'::jsonb)),'ok',
  'S7b: a typed-confirmed Waypoint can be revised through the existing explicit command');
select ok((select successor.title=predecessor.title and successor.title='Keep the drafted title'
  and successor.destination='A revised destination that is not the title.'
  and successor.why_it_matters=predecessor.why_it_matters and successor.arrival_signal=predecessor.arrival_signal
  and successor.predecessor_waypoint_id=predecessor.waypoint_id
  from content.waypoint successor cross join chosen_before_revision predecessor where successor.waypoint_id=pg_temp.gid(91001)),
  'S7b: revision carries the predecessor title unchanged while replacing the reviewed destination');
select is((select to_jsonb(w) from content.waypoint w where waypoint_id=(select waypoint_id from chosen_before_revision)),
  (select to_jsonb(w) from chosen_before_revision w),'S7b: revision preserves the original exact confirmed wording and provenance');
select ok((select bool_and(c.relrowsecurity) from pg_class c
  where c.oid in ('content.waypoint_draft'::regclass,'ai.explorer_conversation_operation'::regclass))
  and not has_table_privilege('service_role','content.waypoint_draft','SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('service_role','ai.explorer_conversation_operation','SELECT,INSERT,UPDATE,DELETE'),
  'S7b: draft and receipt RLS and direct-access grants remain closed');
select * from finish();
rollback;
