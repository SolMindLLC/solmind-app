-- S7a private Waypoint drafts: synthetic rollback-only SQL construction proof.
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
select plan(88);

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
  select jsonb_build_object('version','explorer-compass-context.v7','immediateMessageIsReplyChoice',false,
    'points',coalesce((select jsonb_agg(jsonb_build_object('id',c.item_id,'label',ai.solmind_exclusion_normalize_v3(c.label),
      'order',c.ord-1,'formation',case when c.formation_status='proposed' then 'forming' else 'saved' end,'anchor',c.compass_anchor,'emphasis',c.relative_emphasis)
      ||case when c.formation_status='proposed' then jsonb_build_object('suggestedInPreviousReply',
        coalesce(c.wording_message_id=(select m.ai_interaction_message_id from ai.ai_interaction_message m
          where m.ai_interaction_session_id=pg_temp.gid(6005) and m.sender_type='ai' and m.ai_role='solmind_virtual_guide'
          order by m.sequence_number desc limit 1),false)) else '{}'::jsonb end order by c.ord)
      from (select x.*,row_number() over(order by x.display_order) as ord from ai.explorer_conversation_compass_item x
        where x.conversation_id=pg_temp.gid(6005) and x.merged_into_item_id is null and x.formation_status is distinct from 'rejected') c),'[]'::jsonb),
    'priorityId',(select s.priority_id from ai.explorer_conversation_state s where s.conversation_id=pg_temp.gid(6005)),
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
      where d.source_ai_interaction_session_id=pg_temp.gid(6005) and d.draft_status='proposed') x
$$;
create function pg_temp.context_value(msg uuid,body text,classification_only boolean default false) returns jsonb language sql stable as $$
  select jsonb_build_object('contractVersion',case when classification_only then 'wi007-v0.1+onboarding-fields-v2'
    else 'wi007-v0.1+onboarding-fields-v2+compass-v7' end,'aiRole','solmind_virtual_guide','actorRoleContext','explorer',
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
  interested boolean default true,fallback_override integer default null,attention_n integer default null,choices jsonb default null,suggestions jsonb default null,attention_id uuid default null,responses jsonb default null,waypoint jsonb default null)
returns table(outcome text,conversation_state jsonb,policy_state jsonb,saved_reply boolean)
language sql as $$
  select * from public.solmind_settle_explorer_conversation_turn_v4(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(10000+slot_n*10),status_name,case when kind='none' then null else pg_temp.gid(10005+slot_n*10) end,
    kind,case when kind='none' then null else body end,model::smallint,minor_flag,'explorer-safety-reply.v2',
    (select mode from lifecycle_intent where slot=slot_n),repeat('A',64),'synthetic-fallback.v1',
    'synthetic-model-policy.v1','synthetic-trusted.v1','synthetic-resources.v1',
    coalesce(fallback_override,(select fallback from lifecycle_intent where slot=slot_n))::smallint,
    (select minor from lifecycle_intent where slot=slot_n),interested,
    coalesce(attention_id,case when attention_n is null then null else pg_temp.gid(attention_n) end),choices,suggestions,responses,waypoint)
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

select ok((select c.relrowsecurity and not c.relforcerowsecurity and c.relowner='postgres'::regrole
  from pg_class c where c.oid='content.waypoint_draft'::regclass)
  and not exists(select 1 from pg_policy where polrelid='content.waypoint_draft'::regclass),
  'S7a: draft table is postgres-owned with RLS and zero policies');
select ok(not has_table_privilege('anon','content.waypoint_draft','SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated','content.waypoint_draft','SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('service_role','content.waypoint_draft','SELECT,INSERT,UPDATE,DELETE')
  and not exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) acl
    where c.oid='content.waypoint_draft'::regclass and acl.grantee=0),
  'S7a: no direct API-role or public draft table access');
select ok((select p.pronargs=27 and p.proargnames[25]='p_waypoint_suggestion' and p.prosecdef
  and p.proowner='postgres'::regrole and p.proconfig @> array['search_path=""','lock_timeout=2000ms','statement_timeout=5000ms']
  from pg_proc p where p.oid='public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text)'::regprocedure),
  'S7a: settlement preserves its 25th argument with 27 arguments and unchanged security and finite limits');
select ok(to_regprocedure('public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb)') is null,
  'S7a: the retired 24-argument overload is absent');
select ok(has_function_privilege('service_role',
    'public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text)','EXECUTE')
  and not has_function_privilege('anon',
    'public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text)','EXECUTE')
  and not has_function_privilege('authenticated',
    'public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text)','EXECUTE'),
  'S7a: settlement remains service-role-only');
select ok((select p.pronargs=8 and p.proargnames[7]='p_draft_id' and p.prosecdef and p.proowner='postgres'::regrole
  and p.proconfig @> array['search_path=""','lock_timeout=2000ms','statement_timeout=5000ms']
  from pg_proc p where p.oid='public.solmind_respond_explorer_waypoint_draft_v1(uuid,uuid,uuid,uuid,integer,text,uuid,text)'::regprocedure),
  'S7a: draft replies use an eight-argument owner capability with finite limits');
select ok(has_function_privilege('service_role',
    'public.solmind_respond_explorer_waypoint_draft_v1(uuid,uuid,uuid,uuid,integer,text,uuid,text)','EXECUTE')
  and not has_function_privilege('anon',
    'public.solmind_respond_explorer_waypoint_draft_v1(uuid,uuid,uuid,uuid,integer,text,uuid,text)','EXECUTE')
  and not has_function_privilege('authenticated',
    'public.solmind_respond_explorer_waypoint_draft_v1(uuid,uuid,uuid,uuid,integer,text,uuid,text)','EXECUTE')
  and not has_function_privilege('service_role','content.solmind_waypoint_draft_guard()','EXECUTE'),
  'S7a: replies are service-role-only and the guard has no API grant');
select is(pg_temp.state()->'waypointDraft','null'::jsonb,'S7a: an empty conversation has explicit null draft');
select ok(pg_temp.send_waypoint(1,pg_temp.suggestion()),'S7a: ordinary settlement creates one private draft');
create temp table original_draft as select * from content.waypoint_draft;
select is((select count(*)::integer from content.waypoint),0,'S7a: a draft is not a chosen Waypoint');
select is(pg_temp.state()->'waypointDraft',jsonb_build_object('id',(select waypoint_draft_id from original_draft),
  'title','Find a calmer start to mornings','destination','Start my morning without rushing.',
  'whyItMatters','I want room to think before work.','arrivalSignal','I start two mornings with time for breakfast.',
  'suggestionMessageId',pg_temp.gid(10015)),'S7a: owned state carries exactly the current draft fields');
select ok(pg_temp.send_waypoint(2,pg_temp.suggestion('Make room for breakfast before work')),
  'S7a: the next ordinary reply refines the existing draft');
select ok((select count(*)=1 and bool_and(d.waypoint_draft_id=o.waypoint_draft_id
  and d.source_message_id=o.source_message_id and d.source_message_id=pg_temp.gid(10015)
  and d.suggestion_message_id=pg_temp.gid(10025) and d.title='Make room for breakfast before work'
  and d.draft_status='proposed') from content.waypoint_draft d cross join original_draft o),
  'S7a: refinement preserves identity and first source while replacing latest wording');
create temp table before_replay as select pg_temp.state() state,
  (select count(*) from ai.explorer_conversation_operation) operations;
select is((select outcome from pg_temp.settle_private(2,waypoint=>pg_temp.suggestion('Make room for breakfast before work'))),
  'exact_replay','S7a: exact suggestion settlement replay succeeds');
select ok(pg_temp.state()=(select state from before_replay)
  and (select count(*) from ai.explorer_conversation_operation)=(select operations from before_replay),
  'S7a: settlement replay has no duplicate draft or writes');
select throws_ok($$select * from pg_temp.settle_private(2,waypoint=>pg_temp.suggestion('Different replay wording'))$$,
  'P0001','solmind_explorer_private_operation_conflict','S7a: changed suggestion bytes conflict on replay');
select throws_ok($$update content.waypoint_draft set title='Unsettled overwrite'$$,
  'P0001','solmind_explorer_private_formation_conflict','S7a: wording cannot be rewritten outside settlement');
select throws_ok($$update content.waypoint_draft set source_message_id=pg_temp.gid(10025)$$,
  'P0001','solmind_explorer_private_immutable','S7a: first source is immutable');
select throws_ok($$delete from content.waypoint_draft$$,'P0001','solmind_explorer_private_immutable',
  'S7a: proposed drafts cannot be deleted');
select throws_ok($$update content.waypoint_draft set draft_status='confirmed'$$,
  'P0001','solmind_explorer_private_immutable','S7a: confirmation requires its exact response receipt');
select throws_ok($$select * from public.solmind_read_explorer_conversation_v3(
  pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6005))$$,'P0001','solmind_explorer_private_unavailable',
  'S7a: another Explorer cannot read the draft conversation');
select throws_ok($$select * from public.solmind_respond_explorer_waypoint_draft_v1(
  pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6005),pg_temp.gid(70000),4,pg_temp.request_sha(70000),
  (select waypoint_draft_id from original_draft),'right')$$,'P0001','solmind_explorer_conversation_denied',
  'S7a: another Explorer cannot confirm the draft');
select is((select conversation_state->'waypointDraft' from public.solmind_read_explorer_conversation_v3(
  pg_temp.gid(4),pg_temp.gid(54))),'null'::jsonb,'S7a: another Explorer empty state has no draft');
select is(pg_temp.inspect(pg_temp.context_value(pg_temp.gid(99901),'Synthetic draft context.')),'clear',
  'S7a: SQL accepts the exact v7 draft context and draft source identity');
select is(pg_temp.compass_context()->'drafts',jsonb_build_array(jsonb_build_object(
  'id',(select waypoint_draft_id from original_draft),'title','Make room for breakfast before work',
  'destination','Start my morning without rushing.','whyItMatters','I want room to think before work.',
  'arrivalSignal','I start two mornings with time for breakfast.','suggestedInPreviousReply',true)),
  'S7a: SQL golden draft projection matches the TypeScript field shape');
select is(pg_temp.inspect(jsonb_set(pg_temp.context_value(pg_temp.gid(99901),'Synthetic draft context.'),
  '{compassContext,drafts,0,title}','"Unowned wording"')),'unavailable','S7a: inspector refuses changed draft wording');
select is(pg_temp.inspect(jsonb_set(jsonb_set(pg_temp.context_value(pg_temp.gid(99901),'Synthetic draft context.'),
  '{contractVersion}','"wi007-v0.1+onboarding-fields-v2+compass-v3"'),
  '{compassContext,version}','"explorer-compass-context.v3"')),'unavailable','S7a: inspector refuses prior ordinary context version');
select ok(not methodology.serialized_methodology_valid(pg_temp.compact(jsonb_set(
  pg_temp.context_value(pg_temp.gid(99901),'Synthetic draft context.'),
  '{contractVersion}','"wi007-v0.1+onboarding-fields-v2+compass-v3"')),pg_temp.gid(1001),
  (select content_markdown from methodology.methodology_context_pack_version where methodology_context_pack_version_id=pg_temp.gid(1001))),
  'S7a: methodology validator also refuses the old version');

-- Each case rolls its own synthetic writes back before returning a scalar result.
-- All pgTAP assertions are outside that rollback scope.
create function pg_temp.lifecycle_command(kind_name text,op_n integer,waypoint_id uuid) returns text language plpgsql as $$
declare expected_revision integer;
begin
  expected_revision:=coalesce((select initial_revision from ai.explorer_conversation_operation
    where actor_user_account_id=pg_temp.gid(1) and operation_id=pg_temp.gid(op_n)),
    (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)));
  if kind_name='release' then
    return (select outcome from public.solmind_release_explorer_waypoint_v1(
      pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(op_n),expected_revision,
      pg_temp.request_sha(op_n),waypoint_id));
  elsif kind_name='reached' then
    return (select outcome from public.solmind_mutate_explorer_conversation_v3(
      pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(op_n),expected_revision,
      'confirm_reached',pg_temp.request_sha(op_n),null,null,waypoint_id,null,null,null,null,
      'I reviewed two mornings with time for breakfast.'));
  elsif kind_name='revision' then
    return (select outcome from public.solmind_confirm_explorer_waypoint_revision_v1(
      pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(op_n),expected_revision,
      pg_temp.request_sha(op_n),'revise_waypoint',waypoint_id,
      '[{"component":"arrivalSignal","answer":"I start three mornings with time for breakfast."}]'::jsonb));
  end if;
  raise exception 'unknown_synthetic_lifecycle';
end $$;
create function pg_temp.reply_case(case_name text) returns jsonb language plpgsql as $$
declare result jsonb; draft_id uuid; response_name text; reply text; replay text; before_state jsonb; guard_denied boolean:=false;
  after_state jsonb; before_counts jsonb; initial_revision integer; i integer; error_text text; first_filler integer:=1;
begin
  begin
    select waypoint_draft_id into draft_id from original_draft;
    if case_name in ('waypoint_limit','waypoint_limit_history','history_limit') then
      if case_name='waypoint_limit_history' then
        if pg_temp.answer_draft(81000,draft_id,'right') is distinct from 'ok' then raise exception 'fixture_lifecycle_limit'; end if;
        if pg_temp.lifecycle_command('revision',81001,(select waypoint_id from content.waypoint
          where suggestion_draft_id=draft_id)) is distinct from 'ok' then raise exception 'fixture_lifecycle_limit'; end if;
        if pg_temp.lifecycle_command('reached',81002,pg_temp.gid(81001)) is distinct from 'ok'
          then raise exception 'fixture_lifecycle_limit'; end if;
        if not pg_temp.send_waypoint(3,pg_temp.suggestion('Another proposed destination')) then raise exception 'fixture_send'; end if;
        select waypoint_draft_id into draft_id from content.waypoint_draft where draft_status='proposed';
        first_filler:=3;
      end if;
      -- Lane 12: the active-limit cases fill the allowance from an ended earlier conversation (9905), so the
      -- five-per-conversation rule never decides them; the 200-version guard is per conversation and stays here.
      if case_name<>'history_limit' then
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
            from generate_series(first_filler,20) g(n);
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
      for i in 1..24 loop
        if pg_temp.answer_draft(80000+i,draft_id,'not_it')<>'ok' then raise exception 'fixture_rejection'; end if;
        if not pg_temp.send_waypoint(2+i,pg_temp.suggestion('Next proposed draft')) then raise exception 'fixture_send'; end if;
        select waypoint_draft_id into draft_id from content.waypoint_draft where draft_status='proposed';
      end loop;
      insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,
        kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,
        waypoint_suggestion_draft_id,waypoint_suggestion_response)
        values(pg_temp.gid(1),pg_temp.gid(89999),pg_temp.gid(50),pg_temp.gid(6005),'respond_waypoint_draft',
          pg_temp.request_sha(89999),pg_temp.request_sha(89999),(pg_temp.state()->>'revision')::integer,
          'completed',clock_timestamp(),draft_id,'not_it');
      begin
        update content.waypoint_draft set draft_status='rejected' where waypoint_draft_id=draft_id;
      exception when raise_exception then guard_denied:=sqlerrm='solmind_explorer_private_formation_limit'; end;
    elsif case_name='incomplete' then
      update ai.explorer_conversation_state set pending_operation_id=pg_temp.gid(10020) where conversation_id=pg_temp.gid(6005);
      update content.waypoint_draft set arrival_signal=null where waypoint_draft_id=draft_id;
      update ai.explorer_conversation_state set pending_operation_id=null where conversation_id=pg_temp.gid(6005);
    elsif case_name='pending' then
      if not exists(select 1 from pg_temp.prepare_private(3) where outcome='ok' and dispatch_permitted) then raise exception 'fixture_pending'; end if;
    elsif case_name='restricted' then perform * from pg_temp.observe(3,3,false);
    elsif case_name='adult' then perform * from pg_temp.observe(3,0,true);
    elsif case_name='unknown_policy' then
      update ai.ai_interaction_session set metadata=metadata-'restricted_mode' where ai_interaction_session_id=pg_temp.gid(6005);
    elsif case_name='expired_session' then
      update identity.user_session set expires_at=clock_timestamp()-interval '1 second' where user_session_id=pg_temp.gid(50);
    elsif case_name='missing_consent' then
      delete from core.consent_record where consent_record_id=pg_temp.gid(41);
    elsif case_name='ended' then
      perform * from public.solmind_end_explorer_conversation_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
        pg_temp.gid(80000),(pg_temp.state()->>'revision')::integer,pg_temp.request_sha(80000));
    end if;
    response_name:=case when case_name in ('not_it','rejected_limit') then 'not_it' when case_name='close' then 'close' else 'right' end;
    before_state:=pg_temp.state(); initial_revision:=(before_state->>'revision')::integer;
    before_counts:=jsonb_build_object('messages',(select count(*) from ai.ai_interaction_message),
      'invocations',(select count(*) from ai.ai_model_invocation),'sends',(select count(*) from ai.explorer_conversation_operation where kind='send'));
    begin reply:=pg_temp.answer_draft(90000,draft_id,response_name,
      case when case_name='stale' then 0 else null end);
    exception when raise_exception then error_text:=sqlerrm; end;
    after_state:=pg_temp.state();
    if reply='ok' then
      replay:=pg_temp.answer_draft(90000,draft_id,response_name);
    end if;
    result:=jsonb_build_object('outcome',reply,'error',error_text,'state',after_state,
      'unchanged',before_state=after_state,'replay',replay,'replayUnchanged',after_state=pg_temp.state(),
      'status',(select draft_status from content.waypoint_draft where waypoint_draft_id=draft_id),
      'revisionDelta',(after_state->>'revision')::integer-initial_revision,
      'rejected',(select count(*) from content.waypoint_draft where draft_status='rejected'),'boundGuardDenied',guard_denied,
      'waypoints',(select coalesce(jsonb_agg(to_jsonb(w)),'[]'::jsonb) from content.waypoint w),
      'waypointCount',(select count(*) from content.waypoint),
      'receipts',(select count(*) from ai.explorer_conversation_operation where operation_id=pg_temp.gid(90000)),
      'noProviderWork',before_counts=jsonb_build_object('messages',(select count(*) from ai.ai_interaction_message),
        'invocations',(select count(*) from ai.ai_model_invocation),'sends',(select count(*) from ai.explorer_conversation_operation where kind='send')));
    raise exception using errcode='P0701',message='rollback_synthetic_fixture';
  exception when sqlstate 'P0701' then null;
  end;
  return result;
end $$;
create temp table replies as select name,pg_temp.reply_case(name) value
  from unnest(array['right','close','not_it','stale','pending','restricted','adult','ended','waypoint_limit','waypoint_limit_history','history_limit','conversation_fifth','conversation_limit','rejected_limit',
    'incomplete','unknown_policy','expired_session','missing_consent']) name;
select ok((select value->>'outcome'='ok' and value->>'status'='confirmed' and value->>'waypointCount'='1'
  and value#>'{state,waypointDraft}'='null'::jsonb from replies where name='right'),'S7a: right creates one chosen Waypoint and closes the draft');
select ok((select value#>>'{waypoints,0,title}'='Make room for breakfast before work'
  and value#>>'{waypoints,0,destination}'='Start my morning without rushing.'
  and value#>>'{waypoints,0,why_it_matters}'='I want room to think before work.'
  and value#>>'{waypoints,0,arrival_signal}'='I start two mornings with time for breakfast.'
  and value#>>'{waypoints,0,lifecycle_status}'='chosen'
  and value#>>'{waypoints,0,chosen_by_explorer_user_account_id}'=pg_temp.gid(1)::text
  and value#>>'{waypoints,0,source_message_id}'=pg_temp.gid(10015)::text
  and value#>>'{waypoints,0,suggestion_message_id}'=pg_temp.gid(10025)::text
  and value#>>'{waypoints,0,suggestion_draft_id}'=(select waypoint_draft_id::text from original_draft)
  and value#>>'{waypoints,0,suggested_by_actor_type}'='solmind_virtual_guide'
  from replies where name='right'),'S7a: confirmation copies exact stored wording and both source messages with Explorer choice provenance');
select ok((select value->>'outcome'='ok' and value->>'status'='proposed' and value->>'waypointCount'='0'
  and value->>'receipts'='1' and value->>'revisionDelta'='1' from replies where name='close'),'S7a: close records only its answer and revision');
select ok((select value->>'outcome'='ok' and value->>'status'='rejected' and value->>'waypointCount'='0'
  and value#>'{state,waypointDraft}'='null'::jsonb from replies where name='not_it'),'S7a: not_it keeps a private rejected row and no visible draft');
select ok((select bool_and(value->>'replay'='exact_replay' and (value->>'replayUnchanged')::boolean)
  from replies where name in ('right','close','not_it')),'S7a: all three answer replays are zero-write');
select ok((select bool_and((value->>'noProviderWork')::boolean) from replies),'S7a: responses never send messages or call/count a provider');
select ok((select value->>'outcome'='stale_revision' and (value->>'unchanged')::boolean and value->>'receipts'='0'
  from replies where name='stale'),'S7a: stale revision writes no answer');
select ok((select value->>'outcome'='operation_conflict' and (value->>'unchanged')::boolean and value->>'receipts'='0'
  from replies where name='pending'),'S7a: a pending turn definitely refuses the answer');
select ok((select bool_and(value->>'error'='solmind_explorer_private_denied' and (value->>'unchanged')::boolean)
  from replies where name in ('restricted','adult')),'S7a: current safety gates refuse draft replies');
select ok((select value->>'error'='solmind_explorer_private_denied' and (value->>'unchanged')::boolean
  from replies where name='unknown_policy'),'S7a: unconfirmed policy settings refuse draft replies');
select ok((select bool_and(value->>'error'='solmind_explorer_conversation_denied' and (value->>'unchanged')::boolean
  and value->>'receipts'='0') from replies where name in ('expired_session','missing_consent')),
  'S7a: expired login and missing required consent refuse draft replies without a receipt');
select ok((select value->>'error'='solmind_explorer_conversation_denied' and (value->>'unchanged')::boolean
  from replies where name='ended'),'S7a: ended conversations cannot confirm a draft');
select ok((select value->>'outcome'='operation_conflict' and (value->>'unchanged')::boolean
  and value->>'waypointCount'='20' and value->>'status'='proposed' and value->>'receipts'='0'
  from replies where name='waypoint_limit'),'S7a: twenty active Waypoints definitely refuse another confirmation');
select ok((select value->>'outcome'='operation_conflict' and value->>'unchanged'='true'
  and value->>'waypointCount'='200' and value#>>'{state,waypointCapacity,activeCount}'='0'
  and value#>>'{state,waypointCapacity,historyRoom}'='false' and value->>'receipts'='0'
  and value#>>'{state,waypointCapacity,conversationRoom}'='true'
  from replies where name='history_limit'),'lane 7: draft right refuses exhausted history even with all active places free');
select ok((select value->>'outcome'='ok' and value->>'status'='confirmed' and value->>'receipts'='1'
  and value->>'waypointCount'='5' and value#>>'{state,waypointCapacity,conversationRoom}'='false'
  and value#>>'{state,waypointCapacity,activeCount}'='2' from replies where name='conversation_fifth'),
  'lane 12: with four earlier Waypoints here (three Reached), That''s right forms the fifth and fills this conversation');
select ok((select value->>'outcome'='operation_conflict' and value->>'unchanged'='true' and value->>'status'='proposed'
  and value->>'receipts'='0' and value->>'waypointCount'='5' and value#>>'{state,waypointCapacity,conversationRoom}'='false'
  and value#>>'{state,waypointCapacity,activeCount}'='2' and value#>>'{state,waypointDraft,id}' is not null
  from replies where name='conversation_limit'),
  'lane 12: with five here (three Reached), That''s right is refused below the active allowance and the draft stays visible');
select ok((select value->>'outcome'='ok' and value->>'unchanged'='false'
  and value->>'waypointCount'='21' and value->>'status'='confirmed' and value->>'receipts'='1'
  from replies where name='waypoint_limit_history'),
  'S7a: predecessors and Reached heads leave room for another confirmed draft');
select ok((select jsonb_array_length(value#>'{state,waypoints}')=2
  and value#>>'{state,waypointCapacity,activeCount}'='19'
  and value#>>'{state,waypointProjection,totalHeads}'='2'
  and exists(select 1 from jsonb_array_elements(value#>'{state,waypoints}') w
    where w->>'status'='reached' and w#>>'{lifecycle,predecessorWaypointId}' is not null)
  and not exists(select 1 from jsonb_array_elements(replies.value#>'{state,waypoints}') current_waypoint
    join jsonb_array_elements(replies.value#>'{state,waypoints}') earlier_waypoint
      on current_waypoint#>>'{lifecycle,predecessorWaypointId}'=earlier_waypoint->>'id')
  from replies where name='waypoint_limit_history'),
  'S7a: owned state explicitly selects current heads and omits their retained predecessors');
select ok((select value->>'outcome'='operation_conflict' and (value->>'unchanged')::boolean
  and value->>'rejected'='24' and value->>'status'='proposed' and value->>'receipts'='0'
  from replies where name='rejected_limit'),'S7a: twenty-four retained rejected drafts definitely refuse another rejection');
select ok((select value->>'boundGuardDenied'='true' from replies where name='rejected_limit'),
  'S7a: the table guard independently enforces the rejected-draft bound');
select ok((select value->>'outcome'='operation_conflict' and value->>'status'='proposed' and value->>'receipts'='0'
  and value->>'unchanged'='true' from replies where name='incomplete'),
  'S7a: nullable incomplete wording persists privately but cannot be confirmed');

create function pg_temp.lifecycle_case(kind_name text) returns jsonb language plpgsql as $$
declare result jsonb; draft_id uuid; chosen_id uuid; before_waypoint jsonb; before_draft jsonb; before_counts jsonb;
  after_state jsonb; after_rows jsonb; outcome_name text; replay_name text; rewrite_error text; delete_error text;
  clarification_error text;
begin
  begin
    select waypoint_draft_id into draft_id from original_draft;
    if pg_temp.answer_draft(91000,draft_id,'right') is distinct from 'ok' then raise exception 'fixture_confirmation'; end if;
    select w.waypoint_id,to_jsonb(w) into chosen_id,before_waypoint from content.waypoint w where w.suggestion_draft_id=draft_id;
    select to_jsonb(d) into before_draft from content.waypoint_draft d where d.waypoint_draft_id=draft_id;
    before_counts:=jsonb_build_object('messages',(select count(*) from ai.ai_interaction_message),
      'invocations',(select count(*) from ai.ai_model_invocation),'sends',(select count(*) from ai.explorer_conversation_operation where kind='send'));
    outcome_name:=pg_temp.lifecycle_command(kind_name,91001,chosen_id);
    after_state:=pg_temp.state();
    select jsonb_agg(to_jsonb(w) order by w.waypoint_id) into after_rows from content.waypoint w;
    replay_name:=pg_temp.lifecycle_command(kind_name,91001,chosen_id);
    begin
      update content.waypoint set title='Rewritten history' where waypoint_id=chosen_id;
    exception when raise_exception then rewrite_error:=sqlerrm; end;
    begin
      delete from content.waypoint where waypoint_id=chosen_id;
    exception when raise_exception then delete_error:=sqlerrm; end;
    if kind_name='revision' then
      begin
        update content.waypoint_clarification set answer_text='Rewritten answer' where waypoint_id=pg_temp.gid(91001);
      exception when raise_exception then clarification_error:=sqlerrm; end;
    end if;
    result:=jsonb_build_object('outcome',outcome_name,'before',before_waypoint,
      'original',(select to_jsonb(w) from content.waypoint w where w.waypoint_id=chosen_id),
      'successor',(select to_jsonb(w) from content.waypoint w where w.predecessor_waypoint_id=chosen_id),
      'operation',(select to_jsonb(o) from ai.explorer_conversation_operation o where o.operation_id=pg_temp.gid(91001)),
      'clarifications',(select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from content.waypoint_clarification c
        where c.waypoint_id=pg_temp.gid(91001)),
      'state',after_state,'waypointCount',(select count(*) from content.waypoint where source_ai_interaction_session_id=pg_temp.gid(6005)),
      'stateIdsMatch',(select array_agg((w->>'id')::uuid order by w->>'id') from jsonb_array_elements(after_state->'waypoints') w)
        =(select array_agg(w.waypoint_id order by w.waypoint_id) from content.waypoint w where w.source_ai_interaction_session_id=pg_temp.gid(6005)
          and not exists(select 1 from content.waypoint successor where successor.predecessor_waypoint_id=w.waypoint_id)),
      'draftUnchanged',before_draft=(select to_jsonb(d) from content.waypoint_draft d where d.waypoint_draft_id=draft_id),
      'replay',replay_name,'replayUnchanged',after_state=pg_temp.state(),
      'rewriteError',rewrite_error,'deleteError',delete_error,'clarificationError',clarification_error,
      'historyUnchanged',after_rows=(select jsonb_agg(to_jsonb(w) order by w.waypoint_id) from content.waypoint w),
      'noProviderWork',before_counts=jsonb_build_object('messages',(select count(*) from ai.ai_interaction_message),
        'invocations',(select count(*) from ai.ai_model_invocation),'sends',(select count(*) from ai.explorer_conversation_operation where kind='send')));
    raise exception using errcode='P0705',message='rollback_synthetic_fixture';
  exception when sqlstate 'P0705' then null;
  end;
  return result;
end $$;
create temp table lifecycles as select name,pg_temp.lifecycle_case(name) value from unnest(array['release','reached','revision']) name;
select ok((select count(*)=3 and bool_and((value->>'outcome'='ok') is true) from lifecycles),
  'S7a: draft-confirmed Waypoints support the existing Release, Reached and revision commands');
select ok((select ((value->'original')-array['released_at','released_by_user_account_id','released_operation_id'])
    =((value->'before')-array['released_at','released_by_user_account_id','released_operation_id'])
  and value#>>'{original,released_operation_id}'=pg_temp.gid(91001)::text
  and value#>>'{original,released_by_user_account_id}'=pg_temp.gid(1)::text
  and value#>>'{original,released_at}'=value#>>'{operation,completed_at}'
  and value#>>'{operation,kind}'='release_waypoint' from lifecycles where name='release'),
  'S7a: Release preserves exact drafted wording, sources and chosen history with its paired operation');
select ok((select ((value->'original')-array['lifecycle_status','reached_by_explorer_user_account_id','reached_at','reached_evidence'])
    =((value->'before')-array['lifecycle_status','reached_by_explorer_user_account_id','reached_at','reached_evidence'])
  and value#>>'{original,lifecycle_status}'='reached'
  and value#>>'{original,reached_by_explorer_user_account_id}'=pg_temp.gid(1)::text
  and value#>>'{original,reached_evidence}'='I reviewed two mornings with time for breakfast.'
  and value#>>'{original,reached_at}' is not null and value#>>'{operation,kind}'='confirm_reached'
  from lifecycles where name='reached'),
  'S7a: Reached records explicit Explorer evidence while preserving exact draft and source history');
select ok((select value->'original'=value->'before'
  and value#>>'{successor,predecessor_waypoint_id}'=value#>>'{original,waypoint_id}'
  and value#>>'{successor,creation_reason}'='revision'
  and value#>>'{successor,title}'=value#>>'{original,title}'
  and value#>>'{successor,source_message_id}'=value#>>'{original,source_message_id}'
  and value#>>'{successor,destination}'=value#>>'{original,destination}'
  and value#>>'{successor,why_it_matters}'=value#>>'{original,why_it_matters}'
  and value#>>'{successor,arrival_signal}'='I start three mornings with time for breakfast.'
  and value#>>'{successor,lifecycle_status}'='chosen' and value#>'{successor,reached_at}'='null'::jsonb
  and value#>'{successor,reached_evidence}'='null'::jsonb and value#>'{successor,released_at}'='null'::jsonb
  and value#>>'{successor,chosen_by_explorer_user_account_id}'=pg_temp.gid(1)::text
  and value#>>'{successor,chosen_at}'=value#>>'{operation,completed_at}' from lifecycles where name='revision'),
  'S7a: revision preserves the original draft-confirmed Waypoint and links a new chosen version with the reviewed arrival signal');
select ok((select value#>>'{clarifications,0,component}'='arrivalSignal'
  and value#>>'{clarifications,0,question_key}'='waypoint.arrivalSignal.v1'
  and value#>>'{clarifications,0,answer_text}'='I start three mornings with time for breakfast.'
  and jsonb_array_length(value->'clarifications')=1 and value->>'clarificationError'='solmind_explorer_private_immutable'
  from lifecycles where name='revision'),
  'S7a: revision retains the exact immutable application-question and Explorer-answer record');
select ok((select bool_and((value->>'stateIdsMatch'='true'
  and jsonb_array_length(value#>'{state,waypoints}')=1
  and (value->>'waypointCount')::integer=case when name='revision' then 2 else 1 end) is true) from lifecycles),
  'S7a: owned state retains the current head while all prior versions remain stored');
select ok((select bool_and((value->>'draftUnchanged'='true'
  and value#>>'{original,suggestion_draft_id}'=(select waypoint_draft_id::text from original_draft)
  and value#>>'{original,suggestion_message_id}'=pg_temp.gid(10025)::text
  and value#>>'{original,suggested_by_actor_type}'='solmind_virtual_guide') is true) from lifecycles),
  'S7a: every lifecycle preserves the confirmed private draft and original insert-only provenance');
select ok((select bool_and((value->>'replay'='exact_replay' and value->>'replayUnchanged'='true'
  and value->>'historyUnchanged'='true') is true) from lifecycles),
  'S7a: every lifecycle exact replay preserves state and stored history');
select ok((select bool_and((value->>'rewriteError'='solmind_explorer_private_immutable'
  and value->>'deleteError'='solmind_explorer_private_immutable' and value->>'historyUnchanged'='true') is true) from lifecycles),
  'S7a: the history guard still rejects rewriting or deleting each draft-confirmed lifecycle');
select ok((select bool_and((value->>'noProviderWork'='true') is true) from lifecycles),
  'S7a: Release, Reached and revision add no message, Send or provider invocation');

create function pg_temp.settlement_case(case_name text,slot_n integer) returns jsonb language plpgsql as $$
declare result jsonb; proposal jsonb:=pg_temp.suggestion('A gated revision'); level_n integer:=0;
  minor_flag boolean:=false; interested boolean:=true; reply_kind text:='ordinary'; settled record; replayed record;
  before_draft jsonb; before_state jsonb;
begin
  begin
    if case_name='level2' then level_n:=2;
    elsif case_name='restricted' then level_n:=3; reply_kind:='urgent';
    elsif case_name='adult' then minor_flag:=true; reply_kind:='adult_only';
    elsif case_name='uninterested' then interested:=false;
    elsif case_name='array' then proposal:=jsonb_build_array(proposal);
    elsif case_name='missing' then proposal:=proposal-'title';
    elsif case_name='extra' then proposal:=proposal||'{"extra":true}'::jsonb;
    elsif case_name='null' then proposal:=jsonb_set(proposal,'{title}','null');
    elsif case_name='blank' then proposal:=jsonb_set(proposal,'{title}','" "');
    elsif case_name='overlong' then proposal:=jsonb_set(proposal,'{arrivalSignal}',to_jsonb(repeat('x',1001)));
    elsif case_name='control' then proposal:=jsonb_set(proposal,'{whyItMatters}',to_jsonb(chr(1)));
    elsif case_name='untrimmed' then proposal:=jsonb_set(proposal,'{destination}','" Padding "');
    end if;
    select to_jsonb(d) into before_draft from content.waypoint_draft d;
    -- Observe safety changes before caching the Send's authority, policy version and context.
    if (level_n>=3 or minor_flag) and not exists(select 1 from pg_temp.observe(slot_n,level_n,minor_flag) where outcome='ok')
      then raise exception 'fixture_observe: %',case_name; end if;
    if not exists(select 1 from pg_temp.prepare_private(slot_n,level_n,minor_flag) where outcome='ok' and dispatch_permitted)
      then raise exception 'fixture_prepare: %',case_name; end if;
    select * into settled from pg_temp.settle_private(slot_n,model=>level_n,minor_flag=>minor_flag,kind=>reply_kind,
      interested=>interested,waypoint=>proposal,suggestions=>'[{"label":"Independent Compass suggestion"}]');
    before_state:=pg_temp.state();
    select * into replayed from pg_temp.settle_private(slot_n,model=>level_n,minor_flag=>minor_flag,kind=>reply_kind,
      interested=>interested,waypoint=>proposal,suggestions=>'[{"label":"Independent Compass suggestion"}]');
    result:=jsonb_build_object('saved',settled.saved_reply,'outcome',settled.outcome,
      'draftUnchanged',before_draft=(select to_jsonb(d) from content.waypoint_draft d),
      'replay',replayed.outcome,'replayUnchanged',before_state=pg_temp.state(),
      'mode',(select mode from lifecycle_intent where slot=slot_n),
      'contextHasCompass',(select serialization::jsonb ? 'compassContext' from lifecycle_intent where slot=slot_n),
      'contextSourceHasDraft',(select (select waypoint_draft_id from original_draft)=any(source_ids) from lifecycle_intent where slot=slot_n),
      'independentCompass',(select count(*) from ai.explorer_conversation_compass_item));
    raise exception using errcode='P0702',message='rollback_synthetic_fixture';
  exception when sqlstate 'P0702' then null;
  end;
  return result;
end $$;
-- Give each case its own Send identities, outside the other fixtures' slots 1..26.
create temp table settlements as select cases.name,pg_temp.settlement_case(cases.name,(100+cases.case_order)::integer) value
  from unnest(array['level2','restricted','adult','uninterested','array','missing','extra','null','blank','overlong','control','untrimmed'])
    with ordinality cases(name,case_order);
select ok((select bool_and((value->>'draftUnchanged')::boolean
  and value->>'outcome'=case when name='uninterested' then 'withheld' else 'ok' end) from settlements),
  'S7a: malformed proposals and every safety or delivery gate leave draft wording unchanged');
select ok((select bool_and((value->>'saved')::boolean and value->>'independentCompass'='1')
  from settlements where name in ('array','missing','extra','null','blank','overlong','control','untrimmed')),
  'S7a: a bad Waypoint proposal never loses the reply or independent valid Compass proposal');
select ok((select value->>'saved'='true' and value->>'independentCompass'='0' from settlements where name='level2'),
  'S7a: classification level two saves prose but neither suggestion type');
select ok((select value->>'saved'='false' and value->>'independentCompass'='0' from settlements where name='uninterested'),
  'S7a: unwanted delivery saves no suggestion or reply');
select ok((select bool_and(value->>'mode'='classification_only' and value->>'contextHasCompass'='false'
  and value->>'contextSourceHasDraft'='false' and value->>'saved'='true' and value->>'independentCompass'='0')
  from settlements where name in ('restricted','adult')),
  'S7a: classification-only contexts contain no Compass or draft section or exclusive source id');
select ok((select bool_and(value->>'replay'='exact_replay' and value->>'replayUnchanged'='true') from settlements),
  'S7a: invalid and gated suggestion replay also remains zero-write');
select ok(ai.solmind_waypoint_draft_text_valid(repeat('x',1000))
  and not ai.solmind_waypoint_draft_text_valid(repeat('x',1001))
  and not ai.solmind_waypoint_draft_text_valid('  ')
  and not ai.solmind_waypoint_draft_text_valid(' x')
  and not ai.solmind_waypoint_draft_text_valid(chr(1))
  and not ai.solmind_waypoint_draft_text_valid('A'||chr(9)||'B')
  and not ai.solmind_waypoint_draft_text_valid('A'||chr(8203)||'B')
  and ai.solmind_waypoint_draft_text_valid('A'||chr(13)||'B')
  and not ai.solmind_waypoint_draft_text_valid(repeat(chr(128512),501)),
  'S7a: exact trim, nonblank, control and browser UTF16 bounds are enforced');
select ok((select count(*)=4 and bool_and(not attnotnull) from pg_attribute
  where attrelid='content.waypoint_draft'::regclass and attname in ('title','destination','why_it_matters','arrival_signal')),
  'S7a: all four wording columns permit incomplete private drafts');

create function pg_temp.guard_case(case_name text) returns boolean language plpgsql as $$
declare denied boolean:=false;
begin
  begin
    -- Owner-only synthetic interval matching the completed-Send/pending state.
    update ai.explorer_conversation_state set pending_operation_id=pg_temp.gid(10020)
      where conversation_id=pg_temp.gid(6005);
    begin
      if case_name='invalid_text' then
        update content.waypoint_draft set title=chr(1);
      else
        insert into content.waypoint_draft(waypoint_draft_id,guide_explorer_relationship_id,source_ai_interaction_session_id,
          title,destination,why_it_matters,arrival_signal,source_message_id,suggestion_message_id)
          select pg_temp.gid(88000),case when case_name='foreign_relationship' then pg_temp.gid(27)
            else guide_explorer_relationship_id end,source_ai_interaction_session_id,
            title,destination,why_it_matters,arrival_signal,suggestion_message_id,suggestion_message_id
          from content.waypoint_draft;
      end if;
    exception when unique_violation then denied:=case_name='duplicate';
      when check_violation then denied:=case_name='invalid_text';
      when raise_exception then denied:=case_name='foreign_relationship' and sqlerrm='solmind_explorer_private_formation_conflict';
    end;
    raise exception using errcode='P0703',message='rollback_synthetic_fixture';
  exception when sqlstate 'P0703' then null;
  end;
  return denied;
end $$;
select ok(pg_temp.guard_case('duplicate'),'S7a: even a valid settlement interval cannot insert a second proposed draft');
select ok(pg_temp.guard_case('foreign_relationship'),'S7a: draft relationship must match the owned conversation');
select ok(pg_temp.guard_case('invalid_text'),'S7a: table constraints reject invalid wording independently of settlement parsing');

-- The TypeScript context test reads this one expected non-empty sample too.
create function pg_temp.expected_draft_context() returns jsonb language sql immutable as $$
  select $waypoint_context_golden${"version":"explorer-compass-context.v7","points":[],"priorityId":null,"attentionId":null,"recentRoute":[],"waypoints":[],"drafts":[{"id":"f5120000-0000-4000-8000-000000000901","title":"A calmer morning","destination":"An unhurried breakfast","whyItMatters":"Family time","arrivalSignal":"Two calm mornings","suggestedInPreviousReply":true}],"immediateMessageIsReplyChoice":false}$waypoint_context_golden$::jsonb
$$;
create function pg_temp.shared_context_golden() returns jsonb language plpgsql as $$
declare result jsonb;
begin
  begin
    if pg_temp.answer_draft(88001,(select waypoint_draft_id from original_draft),'not_it')<>'ok' then raise exception 'fixture'; end if;
    update ai.explorer_conversation_state set pending_operation_id=pg_temp.gid(10020) where conversation_id=pg_temp.gid(6005);
    insert into content.waypoint_draft(waypoint_draft_id,guide_explorer_relationship_id,source_ai_interaction_session_id,
      title,destination,why_it_matters,arrival_signal,source_message_id,suggestion_message_id)
      values('f5120000-0000-4000-8000-000000000901',pg_temp.gid(25),pg_temp.gid(6005),
        'A calmer morning','An unhurried breakfast','Family time','Two calm mornings',pg_temp.gid(10025),pg_temp.gid(10025));
    update ai.explorer_conversation_state set pending_operation_id=null where conversation_id=pg_temp.gid(6005);
    result:=jsonb_build_object('compassContext',pg_temp.compass_context(),
      'inspected',pg_temp.inspect(pg_temp.context_value(pg_temp.gid(99910),'Synthetic shared golden.')));
    raise exception using errcode='P0704',message='rollback_synthetic_fixture';
  exception when sqlstate 'P0704' then null;
  end;
  return result;
end $$;
create temp table shared_golden as select pg_temp.shared_context_golden() value;
select is((select value->'compassContext' from shared_golden),pg_temp.expected_draft_context(),
  'S7a: SQL and TypeScript share one exact non-empty draft context sample');
select is((select value->>'inspected' from shared_golden),'clear',
  'S7a: authoritative inspection accepts the shared TypeScript golden and its source id');

select is(pg_temp.answer_draft(70001,(select waypoint_draft_id from original_draft),'close'),'ok',
  'S7a: persistent fixture records close without changing the draft');
select throws_ok($$select pg_temp.answer_draft(70001,(select waypoint_draft_id from original_draft),'right')$$,
  'P0001','solmind_explorer_private_operation_conflict','S7a: changed response on replay conflicts');
select throws_ok($$select pg_temp.answer_draft(70001,(select waypoint_draft_id from original_draft),'close',null,repeat('F',64))$$,
  'P0001','solmind_explorer_private_operation_conflict','S7a: changed fingerprint on replay conflicts');
select throws_ok($$update ai.explorer_conversation_operation set waypoint_suggestion_response='right' where operation_id=pg_temp.gid(70001)$$,
  'P0001','solmind_explorer_private_immutable','S7a: answer receipt cannot be edited');
select throws_ok($$delete from ai.explorer_conversation_operation where operation_id=pg_temp.gid(70001)$$,
  'P0001','solmind_explorer_private_immutable','S7a: answer receipt cannot be deleted');
select is(pg_temp.answer_draft(70002,(select waypoint_draft_id from original_draft),'right'),'ok',
  'S7a: persistent fixture confirms the exact refined draft');
select is(pg_temp.state()#>>'{waypoints,0,title}','Make room for breakfast before work',
  'S7a: the saved Waypoint state preserves its distinct title');
select throws_ok($$update content.waypoint_draft set title='Edited confirmed wording'$$,
  'P0001','solmind_explorer_private_immutable','S7a: confirmed drafts are immutable');
select throws_ok($$update content.waypoint set suggestion_draft_id=null,suggested_by_actor_type=null,suggestion_message_id=null$$,
  'P0001','solmind_explorer_private_immutable','S7a: inserted provenance cannot be changed by later history updates');
select ok(pg_temp.send_waypoint(3,pg_temp.suggestion('A second new Waypoint')),
  'S7a: a later suggestion starts a new draft without rewriting a confirmed one');
select is((select count(*)::integer from content.waypoint_draft),2,'S7a: confirmed and proposed rows are retained independently');
select is(pg_temp.answer_draft(70003,(pg_temp.state()#>>'{waypointDraft,id}')::uuid,'not_it'),'ok',
  'S7a: persistent fixture rejects the new draft');
select throws_ok($$update content.waypoint_draft set title='Edited rejection' where draft_status='rejected'$$,
  'P0001','solmind_explorer_private_immutable','S7a: rejected drafts are immutable');
select is(pg_temp.compass_context()->'drafts','[]'::jsonb,'S7a: confirmed and rejected drafts never enter model context');
select is(pg_temp.state()->'waypointDraft','null'::jsonb,'S7a: confirmed and rejected drafts never appear in owned state');
select ok((select count(*)=1 from pg_index i where i.indrelid='content.waypoint_draft'::regclass and i.indisunique
  and pg_get_expr(i.indpred,i.indrelid) like '%proposed%'),'S7a: a partial unique index enforces one proposed draft');
select * from finish();
rollback;
