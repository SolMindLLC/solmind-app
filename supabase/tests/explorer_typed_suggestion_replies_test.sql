-- S6b typed-reply proposal. PROPOSAL AUTHORSHIP. The Executor executes serially in an isolated
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
select plan(47);

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
-- REV391 (2026-11-11): conversation 6005 is a legacy-mode conversation (its suggestion, forming and confirmed rows
-- are historical), so the section is the v8 legacy envelope (explorer_source_exclusion_test.sql): mode
-- legacy_read_only, zero capacity, no topics, a null priorityId, no forming points, attention only when it names a
-- supplied point, and the Route without forming targets; a still-unmaterialized Explorer move onto a forming point
-- keeps its place in the chronology, so it can supersede an older acknowledgment, but never appears itself.
create function pg_temp.compass_context() returns jsonb language sql stable as $$
  with att as (select s.attention_id as id from ai.explorer_conversation_state s where s.conversation_id=pg_temp.gid(6005)
      and exists(select 1 from ai.explorer_conversation_compass_item c where c.item_id=s.attention_id and c.conversation_id=s.conversation_id
        and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' and c.formation_status is distinct from 'proposed')),
  moves as (
    select o.kind,o.completed_at,coalesce(o.compass_route_kind,'attention_changed') as route_kind,
      coalesce(o.compass_route_item_id,o.followed_attention_item_id) as item_id,o.initial_revision,o.operation_id
    from ai.explorer_conversation_operation o
    where o.conversation_id=pg_temp.gid(6005) and (o.compass_route_kind='attention_changed'
      or (o.kind='set_attention' and o.followed_attention_item_id is not null
        and not exists(select 1 from ai.explorer_conversation_operation materialized
          where materialized.actor_user_account_id=o.actor_user_account_id and materialized.origin_operation_id=o.operation_id)))
  ),
  eligible as (
    select o.*,c.label as current_label,c.formation_status,
      o.kind='set_attention' and o.item_id=(select id from att)
        and o.operation_id=(select last_move.operation_id from moves last_move
          order by last_move.initial_revision desc,last_move.operation_id desc limit 1)
        and not exists(select 1 from ai.ai_interaction_message reply where reply.ai_interaction_session_id=pg_temp.gid(6005)
          and reply.sender_type='ai' and reply.created_at>=o.completed_at) as awaiting_reply
    from moves o join ai.explorer_conversation_compass_item c on c.conversation_id=pg_temp.gid(6005)
      and c.item_id=o.item_id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected'
  )
  select jsonb_build_object('version','explorer-compass-context.v8','immediateMessageIsReplyChoice',false,
    'mode','legacy_read_only','topics','[]'::jsonb,
    'capacity',jsonb_build_object('originalsRemaining',0,'topicSlotsRemaining',0,'visibleSlotsRemaining',0),
    'messageRefs',jsonb_build_object('history',(select coalesce(jsonb_agg(jsonb_build_object('ref','h'||h.ord::text,
      'order',h.ord) order by h.ord),'[]'::jsonb) from (
      select recent.*,row_number() over(order by recent.sequence_number)-1 as ord from (
        select * from ai.ai_interaction_message where ai_interaction_session_id=pg_temp.gid(6005)
        order by sequence_number desc limit 24) recent) h where h.sender_type='user'),'immediate','now'),
    'points',coalesce((select jsonb_agg(jsonb_build_object('id',c.item_id,'label',ai.solmind_exclusion_normalize_v3(c.label),
      'order',c.ord-1,'formation',case when c.formation_status='automatic' then 'automatic' else 'saved' end,'anchor',c.compass_anchor,'emphasis',c.relative_emphasis)
        order by c.ord)
      from (select x.*,row_number() over(order by x.display_order) as ord from ai.explorer_conversation_compass_item x
        where x.conversation_id=pg_temp.gid(6005) and x.merged_into_item_id is null and x.formation_status is distinct from 'rejected'
          and x.formation_status is distinct from 'proposed') c),'[]'::jsonb),
    'priorityId',null,
    'attentionId',(select id from att),
    'recentRoute',coalesce((select jsonb_agg(jsonb_build_object('kind',r.route_kind,'pointId',r.item_id,
      'label',ai.solmind_exclusion_normalize_v3(r.current_label),
      'actor',case when r.kind='follow_attention' then 'virtual_guide' else 'explorer' end,
      'awaitingReply',r.awaiting_reply) order by r.initial_revision,r.operation_id)
      from (select * from eligible e where e.formation_status is distinct from 'proposed'
        order by e.initial_revision desc,e.operation_id desc limit 5) r),'[]'::jsonb),
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
        and c.formation_status is distinct from 'proposed'
    union all select w.waypoint_id from (select h.* from content.waypoint h where h.source_ai_interaction_session_id=pg_temp.gid(6005)
      and not exists(select 1 from content.waypoint s where s.predecessor_waypoint_id=h.waypoint_id)
      order by case when h.lifecycle_status='chosen' and h.released_at is null then 0 else 1 end,h.created_at desc,h.waypoint_id limit 20) w) x
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
  interested boolean default true,fallback_override integer default null,attention_n integer default null,choices jsonb default null,suggestions jsonb default null,attention_id uuid default null,responses jsonb default null)
returns table(outcome text,conversation_state jsonb,policy_state jsonb,saved_reply boolean)
language sql as $$
  select * from public.solmind_settle_explorer_conversation_turn_v4(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(10000+slot_n*10),status_name,case when kind='none' then null else pg_temp.gid(10005+slot_n*10) end,
    kind,case when kind='none' then null else body end,model::smallint,minor_flag,'explorer-safety-reply.v2',
    (select mode from lifecycle_intent where slot=slot_n),repeat('A',64),'synthetic-fallback.v1',
    'synthetic-model-policy.v1','synthetic-trusted.v1','synthetic-resources.v1',
    coalesce(fallback_override,(select fallback from lifecycle_intent where slot=slot_n))::smallint,
    (select minor from lifecycle_intent where slot=slot_n),interested,
    coalesce(attention_id,case when attention_n is null then null else pg_temp.gid(attention_n) end),choices,suggestions,responses)
$$;

-- Real SQL owners, synthetic authority and provider results only; no provider I/O.
do $$ begin
  if pg_temp.register_version(1001)<>'ok' then raise exception 'fixture'; end if;
  if not exists(select 1 from pg_temp.screen_start(1001) where outcome='ok' and dispatch_permitted) then raise exception 'fixture'; end if;
  if pg_temp.screen_terminal(1001)<>'ok' or pg_temp.admin_review(1001)<>'ok' or pg_temp.guide_decision(1001)<>'ok'
    then raise exception 'fixture'; end if;
  if not exists(select 1 from pg_temp.ensure_anchor(6004) where outcome='created') then raise exception 'fixture'; end if;
end $$;
-- REV391 (2026-11-11): suggestions, answers and forming points exist only from before automatic Compass, so
-- conversation 6005 is a legacy-mode conversation: a privileged rollback-only copy of the freshly created owned
-- conversation 6004 (session and state rows), as in explorer_automatic_compass_test.sql.
insert into ai.ai_interaction_session select (jsonb_populate_record(null::ai.ai_interaction_session,
  to_jsonb(s)||jsonb_build_object('ai_interaction_session_id',pg_temp.gid(6005)))).*
  from ai.ai_interaction_session s where s.ai_interaction_session_id=pg_temp.gid(6004);
insert into ai.explorer_conversation_state select (jsonb_populate_record(null::ai.explorer_conversation_state,
  to_jsonb(s)||jsonb_build_object('conversation_id',pg_temp.gid(6005),'compass_mode','legacy'))).*
  from ai.explorer_conversation_state s where s.conversation_id=pg_temp.gid(6004);
create function pg_temp.read_state() returns jsonb language sql as $$
  select conversation_state from public.solmind_read_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005))
$$;
-- REV391 (2026-11-11): manual Compass commands are retired, so every earlier manual Compass operation in this
-- file is a privileged historical fixture: the operation row exactly as its owner stored it (request fingerprint
-- formulas of the latest prior owners, 20261106000000_explorer_waypoint_active_limits.sql for the mutation and
-- 20261105010000_explorer_forming_compass_points.sql for arrangement and category, unchanged by REV391) and the
-- stored effect it had. Direct writes happen only here; only the formation guard is suspended, and only around a
-- point INSERT or a wording UPDATE, restored before any assertion.
create function pg_temp.historical_mutation(op_n integer,kind_name text,source_n integer default null,
  item_n integer default null,label_text text default null) returns void language plpgsql as $$
declare st ai.explorer_conversation_state%rowtype; route_kind text; route_label text;
begin
  select * into st from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005);
  if kind_name='add_compass' then
    alter table ai.explorer_conversation_compass_item disable trigger explorer_compass_formation_guard;
    insert into ai.explorer_conversation_compass_item(item_id,conversation_id,source_message_id,label,display_order)
      values(pg_temp.gid(op_n),pg_temp.gid(6005),pg_temp.gid(source_n),label_text,
        (select coalesce(max(c.display_order),0)+1 from ai.explorer_conversation_compass_item c where c.conversation_id=pg_temp.gid(6005)));
    alter table ai.explorer_conversation_compass_item enable trigger explorer_compass_formation_guard;
  elsif kind_name='confirm_priority' then
    if st.priority_id is distinct from pg_temp.gid(item_n) then
      route_kind:=case when st.priority_id is null then 'priority_confirmed' else 'priority_reoriented' end;
      select c.label into route_label from ai.explorer_conversation_compass_item c where c.item_id=pg_temp.gid(item_n);
    end if;
    update ai.explorer_conversation_state set priority_id=pg_temp.gid(item_n) where conversation_id=pg_temp.gid(6005);
  else raise exception 'fixture_kind'; end if;
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
    conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,
    compass_route_kind,compass_route_item_id,compass_route_label)
  values(pg_temp.gid(1),pg_temp.gid(op_n),pg_temp.gid(50),pg_temp.gid(6005),kind_name,
    upper(encode(extensions.digest(convert_to(jsonb_build_array(pg_temp.gid(50),pg_temp.gid(6005),st.revision,
      kind_name,case when source_n is null then null else pg_temp.gid(source_n) end,
      case when item_n is null then null else pg_temp.gid(item_n) end,null::uuid,label_text,null::text,null::text,null::text,null::text,
      pg_temp.request_sha(op_n))::text,'UTF8'),'sha256'),'hex')),
    pg_temp.request_sha(op_n),st.revision,'completed',clock_timestamp(),
    route_kind,case when route_kind is null then null else pg_temp.gid(item_n) end,route_label);
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=pg_temp.gid(6005);
  update ai.ai_interaction_session set last_activity_at=clock_timestamp() where ai_interaction_session_id=pg_temp.gid(6005);
end $$;
create function pg_temp.historical_arrangement(op_n integer,priority_n integer,p_items jsonb) returns void language plpgsql as $$
declare st ai.explorer_conversation_state%rowtype; canonical_items jsonb; snapshot jsonb; meaningful boolean;
  p_priority uuid:=case when priority_n is null then null else pg_temp.gid(priority_n) end;
begin
  select * into st from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005);
  select coalesce(jsonb_agg(value order by value->>'compassItemId'),'[]'::jsonb) into canonical_items from jsonb_array_elements(p_items);
  select exists(select 1 from ai.explorer_conversation_compass_item c join jsonb_array_elements(canonical_items) i
      on c.item_id=(i->>'compassItemId')::uuid where c.conversation_id=pg_temp.gid(6005) and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' and c.formation_status is distinct from 'proposed'
      and (c.compass_anchor is distinct from i->>'anchor' or c.relative_emphasis is distinct from (i->>'emphasis')::smallint))
    or st.priority_id is distinct from p_priority into meaningful;
  select jsonb_build_object('previousPriorityId',st.priority_id,'priorityId',p_priority,'items',
    coalesce(jsonb_agg(jsonb_build_object('compassItemId',c.item_id,'label',c.label,'anchor',i->'anchor','emphasis',i->'emphasis')
      order by c.item_id),'[]'::jsonb)) into snapshot
    from ai.explorer_conversation_compass_item c join jsonb_array_elements(canonical_items) i
      on c.item_id=(i->>'compassItemId')::uuid where c.conversation_id=pg_temp.gid(6005) and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' and c.formation_status is distinct from 'proposed';
  if meaningful then
    update ai.explorer_conversation_compass_item set compass_anchor=null where conversation_id=pg_temp.gid(6005) and merged_into_item_id is null and formation_status is distinct from 'rejected' and formation_status is distinct from 'proposed';
    update ai.explorer_conversation_compass_item c set compass_anchor=i->>'anchor',relative_emphasis=(i->>'emphasis')::smallint
      from jsonb_array_elements(canonical_items) i where c.conversation_id=pg_temp.gid(6005) and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' and c.formation_status is distinct from 'proposed' and c.item_id=(i->>'compassItemId')::uuid;
    update ai.explorer_conversation_state set priority_id=p_priority where conversation_id=pg_temp.gid(6005);
  end if;
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,kind,
    request_fingerprint,command_fingerprint,initial_revision,status,completed_at,compass_route_kind,compass_arrangement)
    values(pg_temp.gid(1),pg_temp.gid(op_n),pg_temp.gid(50),pg_temp.gid(6005),'confirm_compass_arrangement',
      methodology.hash_json(jsonb_build_array('compass-arrangement.v1',pg_temp.gid(50),pg_temp.gid(6005),
        st.revision,p_priority,canonical_items,pg_temp.request_sha(op_n))),pg_temp.request_sha(op_n),
      st.revision,'completed',clock_timestamp(),case when meaningful then 'arrangement_confirmed' else null end,
      case when meaningful then snapshot else null end);
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=pg_temp.gid(6005);
  update ai.ai_interaction_session set last_activity_at=clock_timestamp() where ai_interaction_session_id=pg_temp.gid(6005);
end $$;
create function pg_temp.historical_category(op_n integer,target_n integer,members integer[],p_label text) returns void language plpgsql as $$
declare st ai.explorer_conversation_state%rowtype; ids uuid[]; contributing uuid[]; snapshot jsonb; old_label text; meaningful boolean;
  p_target uuid:=pg_temp.gid(target_n);
begin
  select * into st from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005);
  select array_agg(distinct pg_temp.gid(n) order by pg_temp.gid(n)) into ids from unnest(members) n;
  with recursive originals(item_id) as (
    select c.item_id from ai.explorer_conversation_compass_item c where c.conversation_id=pg_temp.gid(6005) and c.item_id=any(ids)
    union
    select c.item_id from ai.explorer_conversation_compass_item c join originals o on c.merged_into_item_id=o.item_id
      where c.conversation_id=pg_temp.gid(6005)
  ) select array_agg(item_id order by item_id) into contributing from originals;
  select c.label into old_label from ai.explorer_conversation_compass_item c where c.conversation_id=pg_temp.gid(6005) and c.item_id=p_target;
  meaningful:=cardinality(ids)>1 or old_label is distinct from p_label;
  if meaningful then
    select jsonb_build_object('targetItemId',p_target,'memberItemIds',to_jsonb(ids),'beforeItems',
      jsonb_agg(jsonb_build_object('compassItemId',c.item_id,'sourceMessageId',c.source_message_id,'label',c.label,
        'mergedIntoItemId',c.merged_into_item_id,'anchor',c.compass_anchor,'emphasis',c.relative_emphasis) order by c.item_id),
      'label',p_label) into snapshot
      from ai.explorer_conversation_compass_item c where c.conversation_id=pg_temp.gid(6005) and c.item_id=any(contributing);
    alter table ai.explorer_conversation_compass_item disable trigger explorer_compass_formation_guard;
    update ai.explorer_conversation_compass_item set label=p_label where conversation_id=pg_temp.gid(6005) and item_id=p_target;
    alter table ai.explorer_conversation_compass_item enable trigger explorer_compass_formation_guard;
    update ai.explorer_conversation_compass_item set merged_into_item_id=p_target
      where conversation_id=pg_temp.gid(6005) and item_id=any(ids) and item_id<>p_target;
  end if;
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,kind,
    request_fingerprint,command_fingerprint,initial_revision,status,completed_at,compass_route_kind,compass_category_change)
    values(pg_temp.gid(1),pg_temp.gid(op_n),pg_temp.gid(50),pg_temp.gid(6005),'confirm_compass_category',
      methodology.hash_json(jsonb_build_array('compass-category.v1',pg_temp.gid(50),pg_temp.gid(6005),
        st.revision,p_target,to_jsonb(ids),p_label,pg_temp.request_sha(op_n))),pg_temp.request_sha(op_n),
      st.revision,'completed',clock_timestamp(),case when meaningful then 'category_confirmed' else null end,snapshot);
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=pg_temp.gid(6005);
  update ai.ai_interaction_session set last_activity_at=clock_timestamp() where ai_interaction_session_id=pg_temp.gid(6005);
end $$;
create function pg_temp.compass_rows() returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(to_jsonb(c) order by c.item_id),'[]'::jsonb) from ai.explorer_conversation_compass_item c
    where c.conversation_id=pg_temp.gid(6005)
$$;
create function pg_temp.operation_count() returns bigint language sql stable as $$
  select count(*) from ai.explorer_conversation_operation where conversation_id=pg_temp.gid(6005)
$$;
-- A retired fresh command (cmd returns its outcome) is refused with the definite conflict and leaves the saved
-- state, every stored point row (rejected rows included) and the operation count byte-equal to before.
create function pg_temp.refused(cmd text) returns boolean language plpgsql as $$
declare s jsonb:=pg_temp.read_state(); r jsonb:=pg_temp.compass_rows(); n bigint:=pg_temp.operation_count(); result text;
begin
  execute cmd into result;
  return result is not distinct from 'operation_conflict' and pg_temp.read_state()=s and pg_temp.compass_rows()=r
    and pg_temp.operation_count()=n;
end $$;
-- REV391 (2026-11-11): suggestion formation and replies are retired, so earlier suggestions and answers in this
-- file are privileged historical fixtures. historical_point writes a proposed (or other) point row exactly as the
-- retired settlement stored it; historical_response writes the respond_compass_suggestion operation exactly as
-- public.solmind_respond_explorer_compass_suggestion_v1 stored it (request fingerprint of
-- 20261105030000_explorer_typed_suggestion_replies.sql, unchanged by REV391, with compass_suggestion_item_id and
-- compass_suggestion_response) and applies the stored effect of ai.solmind_apply_compass_suggestion_response from
-- that migration: right confirms and materializes each deferred move with its derived follow id, not_it rejects and
-- clears that attention, close changes nothing but the revision. Only the formation guard is suspended, and only
-- around the point INSERT or status UPDATE, restored before any assertion.
create function pg_temp.historical_point(item_n integer,point_label text,wording_n integer,display_n integer,
  status_name text default 'proposed') returns uuid language plpgsql as $$
begin
  alter table ai.explorer_conversation_compass_item disable trigger explorer_compass_formation_guard;
  insert into ai.explorer_conversation_compass_item(item_id,conversation_id,source_message_id,label,display_order,
    formation_status,wording_message_id)
    values(pg_temp.gid(item_n),pg_temp.gid(6005),pg_temp.gid(wording_n),point_label,display_n,status_name,pg_temp.gid(wording_n));
  alter table ai.explorer_conversation_compass_item enable trigger explorer_compass_formation_guard;
  return pg_temp.gid(item_n);
end $$;
create function pg_temp.historical_response(op_n integer,point_id uuid,response_name text) returns void language plpgsql as $$
declare st ai.explorer_conversation_state%rowtype; point ai.explorer_conversation_compass_item%rowtype;
  origin ai.explorer_conversation_operation%rowtype; follow_hash text; follow_bytes bytea; ts timestamptz:=clock_timestamp();
begin
  select * into st from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005);
  select * into point from ai.explorer_conversation_compass_item where item_id=point_id;
  if point.formation_status is distinct from 'proposed' or st.pending_operation_id is not null then raise exception 'fixture_response'; end if;
  if response_name in ('right','not_it') then
    alter table ai.explorer_conversation_compass_item disable trigger explorer_compass_formation_guard;
    update ai.explorer_conversation_compass_item set formation_status=case when response_name='right' then 'confirmed' else 'rejected' end
      where item_id=point_id;
    alter table ai.explorer_conversation_compass_item enable trigger explorer_compass_formation_guard;
  end if;
  if response_name='right' then
    for origin in select o.* from ai.explorer_conversation_operation o
      where o.actor_user_account_id=pg_temp.gid(1) and o.conversation_id=pg_temp.gid(6005) and o.status='completed'
        and o.followed_attention_item_id=point_id
        and ((o.kind='send' and o.reply_message_id is not null and o.safety_protocol_version='explorer-safety-reply.v2')
          or (o.kind='set_attention' and o.compass_route_kind is null and o.origin_operation_id is null))
        and not exists(select 1 from ai.explorer_conversation_operation followed
          where followed.actor_user_account_id=pg_temp.gid(1) and followed.origin_operation_id=o.operation_id)
      order by o.initial_revision,o.operation_id loop
      follow_hash:=methodology.hash_json(jsonb_build_array('explorer-follow-attention.v1',pg_temp.gid(1),
        origin.application_session_id,pg_temp.gid(6005),origin.operation_id,point_id));
      follow_bytes:=substring(extensions.digest(convert_to('explorer-follow-attention-operation.v1|'||pg_temp.gid(1)::text||'|'||origin.operation_id::text,'UTF8'),'sha256') from 1 for 16);
      follow_bytes:=set_byte(set_byte(follow_bytes,6,(get_byte(follow_bytes,6)&15)|80),8,(get_byte(follow_bytes,8)&63)|128);
      insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
        conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,
        compass_route_kind,compass_route_item_id,compass_route_label,origin_operation_id)
        values(pg_temp.gid(1),encode(follow_bytes,'hex')::uuid,origin.application_session_id,pg_temp.gid(6005),
          case when origin.kind='send' then 'follow_attention' else 'set_attention' end,
          follow_hash,follow_hash,origin.initial_revision+case when origin.kind='send' then 1 else 0 end,
          'completed',origin.completed_at,'attention_changed',point_id,point.label,origin.operation_id);
    end loop;
  end if;
  if st.attention_id=point_id and response_name='not_it' then
    update ai.explorer_conversation_state set attention_id=null where conversation_id=pg_temp.gid(6005);
  end if;
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,
    kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,compass_suggestion_item_id,compass_suggestion_response)
    values(pg_temp.gid(1),pg_temp.gid(op_n),pg_temp.gid(50),pg_temp.gid(6005),'respond_compass_suggestion',
      methodology.hash_json(jsonb_build_array('explorer-compass-suggestion-response.v1',pg_temp.gid(50),pg_temp.gid(6005),
        st.revision,point_id,response_name,pg_temp.request_sha(op_n))),
      pg_temp.request_sha(op_n),st.revision,'completed',ts,point_id,response_name);
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=pg_temp.gid(6005);
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=pg_temp.gid(6005);
end $$;
-- The Compass slice of the saved state and the raw point rows.
create function pg_temp.compass_slice() returns jsonb language sql stable as $$
  select jsonb_build_object('items',s->'compassItems','priority',s->'priorityId','attention',s->'attentionId',
    'route',s->'route','changes',s->'compassChanges','rows',(select coalesce(jsonb_agg(to_jsonb(c) order by c.item_id),'[]'::jsonb)
      from ai.explorer_conversation_compass_item c where c.conversation_id=pg_temp.gid(6005)))
  from (select ai.solmind_conversation_state_json(pg_temp.gid(6005)) s) x
$$;
-- A Send whose model reply carries retired Compass fields (suggestions, a forming-point attention, typed
-- responses): the reply saves, the Compass slice and point rows stay byte-equal, the Send records no followed
-- point, and no Route, follow or answer operation appears beside the Send itself.
create function pg_temp.send_retired(slot_n integer,suggestions jsonb,attention uuid default null,responses jsonb default null,
  body_override text default null)
returns boolean language plpgsql as $$
declare before jsonb:=pg_temp.compass_slice(); ops bigint; saved boolean;
begin
  select count(*) into ops from ai.explorer_conversation_operation where conversation_id=pg_temp.gid(6005);
  if not exists(select 1 from pg_temp.prepare_private(slot_n,body_override=>body_override) where outcome='ok' and dispatch_permitted) then return false; end if;
  select r.outcome='ok' and r.saved_reply into saved from public.solmind_settle_explorer_conversation_turn_v4(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(10000+slot_n*10),'completed',pg_temp.gid(10005+slot_n*10),'ordinary','Synthetic saved reply.',0::smallint,false,
    'explorer-safety-reply.v2',(select mode from lifecycle_intent where slot=slot_n),repeat('A',64),'synthetic-fallback.v1',
    'synthetic-model-policy.v1','synthetic-trusted.v1','synthetic-resources.v1',(select fallback from lifecycle_intent where slot=slot_n),
    (select minor from lifecycle_intent where slot=slot_n),true,attention,null,suggestions,responses) r;
  return saved and pg_temp.compass_slice()=before
    and (select count(*) from ai.explorer_conversation_operation where conversation_id=pg_temp.gid(6005))=ops+1
    and (select followed_attention_item_id is null and compass_route_kind is null from ai.explorer_conversation_operation
      where operation_id=pg_temp.gid(10000+slot_n*10));
end $$;
create function pg_temp.state() returns jsonb language sql stable as $$
  select ai.solmind_conversation_state_json(pg_temp.gid(6005))
$$;
create function pg_temp.move(op_n integer,point_id uuid,kind_name text default 'set_attention') returns text language sql as $$
  select outcome from public.solmind_mutate_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(op_n),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),
    kind_name,pg_temp.request_sha(op_n),null,point_id)
$$;

create function pg_temp.answer(op_n integer,point_id uuid,response_name text,revision_override integer default null,
  fingerprint_override text default null) returns text language sql as $$
  select outcome from public.solmind_respond_explorer_compass_suggestion_v1(
    pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(op_n),
    coalesce(revision_override,(select initial_revision from ai.explorer_conversation_operation
      where actor_user_account_id=pg_temp.gid(1) and operation_id=pg_temp.gid(op_n)),
      (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005))),
    coalesce(fingerprint_override,pg_temp.request_sha(op_n)),point_id,response_name)
$$;
create function pg_temp.send_suggestions(slot_n integer,suggestions jsonb,attention uuid default null) returns boolean language plpgsql as $$
begin
  if not exists(select 1 from pg_temp.prepare_private(slot_n) where outcome='ok' and dispatch_permitted) then return false; end if;
  return exists(select 1 from pg_temp.settle_private(slot_n,suggestions=>suggestions,attention_id=>attention) where outcome='ok' and saved_reply);
end $$;
create function pg_temp.foreign_forming_point() returns uuid language plpgsql as $$
declare a jsonb; policy jsonb; e jsonb; context_value jsonb; serialization text; source_ids uuid[]; point_id uuid;
begin
  if not exists(select 1 from pg_temp.ensure_anchor(6106,4,54) where outcome='created') then raise exception 'fixture'; end if;
  -- REV391: the other Explorer's forming point is historical, so 6006 is a legacy-mode copy of 6106.
  insert into ai.ai_interaction_session select (jsonb_populate_record(null::ai.ai_interaction_session,
    to_jsonb(s)||jsonb_build_object('ai_interaction_session_id',pg_temp.gid(6006)))).*
    from ai.ai_interaction_session s where s.ai_interaction_session_id=pg_temp.gid(6106);
  insert into ai.explorer_conversation_state select (jsonb_populate_record(null::ai.explorer_conversation_state,
    to_jsonb(s)||jsonb_build_object('conversation_id',pg_temp.gid(6006),'compass_mode','legacy'))).*
    from ai.explorer_conversation_state s where s.conversation_id=pg_temp.gid(6106);
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
      'mode','legacy_read_only','topics','[]'::jsonb,
      'capacity',jsonb_build_object('originalsRemaining',0,'topicSlotsRemaining',0,'visibleSlotsRemaining',0),
      'messageRefs',jsonb_build_object('history','[]'::jsonb,'immediate','now'),'points','[]'::jsonb,
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
    0::smallint,false,true,null,null,'[{"label":"Other Explorer forming point"}]'::jsonb,null) where outcome='ok' and saved_reply)
    then raise exception 'fixture'; end if;
  if exists(select 1 from ai.explorer_conversation_compass_item where conversation_id=pg_temp.gid(6006))
    then raise exception 'fixture_retired_suggestion_formed'; end if;
  alter table ai.explorer_conversation_compass_item disable trigger explorer_compass_formation_guard;
  insert into ai.explorer_conversation_compass_item(item_id,conversation_id,source_message_id,label,display_order,
    formation_status,wording_message_id)
    values(pg_temp.gid(20010),pg_temp.gid(6006),pg_temp.gid(20005),'Other Explorer forming point',1,'proposed',pg_temp.gid(20005));
  alter table ai.explorer_conversation_compass_item enable trigger explorer_compass_formation_guard;
  select item_id into strict point_id from ai.explorer_conversation_compass_item
    where conversation_id=pg_temp.gid(6006) and formation_status='proposed' and merged_into_item_id is null;
  return point_id;
end $$;
create function pg_temp.reflection_state() returns jsonb language sql stable as $$
  select jsonb_build_object('states',(select jsonb_agg(ai.solmind_conversation_state_json(conversation_id)
    -'revision'-'messages'-'providerState' order by conversation_id) from ai.explorer_conversation_state),
    'operations',(select coalesce(jsonb_agg(to_jsonb(o) order by actor_user_account_id,operation_id),'[]'::jsonb)
      from ai.explorer_conversation_operation o where kind<>'send'))
$$;

-- Each scenario rolls back its own fixture effects before assertions run.
-- pgTAP assertions themselves are never inside a rolled-back savepoint.
do $$ begin
  if not pg_temp.send_retired(1,'[{"label":"Work pressure"},{"label":"Rest"},{"label":"Family"}]')
    then raise exception 'fixture'; end if;
  -- Historical forming points, as the retired settlement stored them from reply 10015.
  perform pg_temp.historical_point(71001,'Work pressure',10015,1);
  perform pg_temp.historical_point(71002,'Rest',10015,2);
  perform pg_temp.historical_point(71003,'Family',10015,3);
end $$;
create temp table points as select label name,item_id id from ai.explorer_conversation_compass_item
  where conversation_id=pg_temp.gid(6005);
create function pg_temp.typed_case(case_name text) returns jsonb language plpgsql as $$
declare point_id uuid:=(select id from points where name='Work pressure'); slot_n integer:=2;
  responses jsonb; suggestions jsonb; result jsonb; settled record; replayed record; before_replay jsonb;
  level_n integer:=0; minor_n boolean:=false; interested_n boolean:=true; reply_kind text:='ordinary';
  model_n integer:=0; n integer; target uuid; receipts_before integer; conflict boolean:=false;
  before_points jsonb; before_counts jsonb; before_reflection jsonb; send_body text;
begin
  begin
    responses:=jsonb_build_array(jsonb_build_object('pointId',point_id,'response',
      case when case_name in ('close','button_close','duplicates','refine_close') then 'close'
        when case_name in ('not_it','limit','limit_duplicate','refine_not_it') then 'not_it' else 'right' end));
    if case_name='old' then
      if not pg_temp.send_suggestions(2,'[]') then raise exception 'fixture'; end if;
      slot_n:=3;
    elsif case_name='button' then
      perform pg_temp.historical_response(70001,point_id,'right');
    elsif case_name='button_close' then
      perform pg_temp.historical_response(70001,point_id,'close');
      send_body:='Close, not quite: "Work pressure"';
    elsif case_name='button_close_refined' then
      -- A button close before a reply that refines the point does not block a later typed answer to the new wording.
      perform pg_temp.historical_response(70001,point_id,'close');
      if not pg_temp.send_suggestions(2,jsonb_build_array(jsonb_build_object('pointId',point_id,'label','Work pressure, mostly')))
        then raise exception 'fixture'; end if;
      slot_n:=3;
    elsif case_name='foreign_existing' then
      point_id:=pg_temp.foreign_forming_point();
      responses:=jsonb_build_array(jsonb_build_object('pointId',point_id,'response','right'));
    elsif case_name='merged' then
      -- Forming points cannot be combined until the Explorer confirms them.
      target:=(select id from points where name='Rest');
      perform pg_temp.historical_response(70001,point_id,'right');
      perform pg_temp.historical_response(70002,target,'right');
      perform pg_temp.historical_category(70003,71002,array[71001,71002],'Work and rest');
    elsif case_name='explorer_saved' then
      perform pg_temp.historical_mutation(70001,'add_compass',10011,null,'Explorer saved point');
      select item_id into strict point_id from ai.explorer_conversation_compass_item
        where conversation_id=pg_temp.gid(6005) and label='Explorer saved point';
      responses:=jsonb_build_array(jsonb_build_object('pointId',point_id,'response','right'));
    elsif case_name in ('refine','refine_close','refine_not_it') then
      suggestions:=jsonb_build_array(jsonb_build_object('pointId',point_id,'label','Work refined'));
    elsif case_name='same_refine' then
      suggestions:=jsonb_build_array(jsonb_build_object('pointId',point_id,'label','Work pressure'));
    elsif case_name='deferred' then
      if not pg_temp.send_suggestions(2,jsonb_build_array(jsonb_build_object('pointId',point_id,'label','Work pressure')),point_id)
        then raise exception 'fixture'; end if;
      if pg_temp.move(70001,(select id from points where name='Rest'))<>'ok'
        or pg_temp.move(70002,point_id)<>'ok' then raise exception 'fixture'; end if;
      slot_n:=3;
    elsif case_name='restricted' then level_n:=3; reply_kind:='urgent'; model_n:=3;
    elsif case_name='adult' then minor_n:=true; reply_kind:='adult_only';
    elsif case_name='level2' then model_n:=2;
    elsif case_name='classification_only' then level_n:=3;
    elsif case_name='uninterested' then interested_n:=false;
    elsif case_name='malformed' then
      responses:=jsonb_build_array(jsonb_build_object('pointId',point_id,'response','RIGHT'),null,
        jsonb_build_object('pointId',point_id,'response','right'));
    elsif case_name='foreign' then responses:=jsonb_build_array(jsonb_build_object('pointId',pg_temp.gid(99999),'response','right'));
    elsif case_name='duplicates' then responses:=responses||jsonb_build_array(jsonb_build_object('pointId',point_id,'response','not_it'));
    elsif case_name='fourth' then
      responses:=jsonb_build_array(null,null,null,jsonb_build_object('pointId',point_id,'response','right'));
    elsif case_name='three' then
      responses:=jsonb_build_array(jsonb_build_object('pointId',point_id,'response','right'),
        jsonb_build_object('pointId',(select id from points where name='Rest'),'response','close'),
        jsonb_build_object('pointId',(select id from points where name='Family'),'response','not_it'));
    elsif case_name in ('limit','limit_duplicate') then
      for n in 1..8 loop
        if not pg_temp.send_suggestions(100+n,jsonb_build_array(jsonb_build_object('label','Rejected A '||n),
          jsonb_build_object('label','Rejected B '||n),jsonb_build_object('label','Rejected C '||n)))
          then raise exception 'fixture'; end if;
        -- REV391: each turned-down suggestion is a historical point and historical not_it answer.
        for k in 1..3 loop
          perform pg_temp.historical_response(71000+n*10+3+(n-1)*3+k,
            pg_temp.historical_point(72000+n*10+k,'Rejected '||chr(64+k)||' '||n,10005+(100+n)*10,3+(n-1)*3+k),'not_it');
        end loop;
      end loop;
      if not pg_temp.send_suggestions(200,jsonb_build_array(jsonb_build_object('pointId',point_id,'label','Work pressure')))
        then raise exception 'fixture'; end if;
      slot_n:=201;
      if case_name='limit_duplicate' then
        responses:=responses||jsonb_build_array(jsonb_build_object('pointId',point_id,'response','right'));
      end if;
    end if;
    select jsonb_agg(to_jsonb(c) order by item_id) into before_points from ai.explorer_conversation_compass_item c;
    before_reflection:=pg_temp.reflection_state();
    select jsonb_build_object('sends',(select count(*) from ai.explorer_conversation_operation where kind='send'),
      'invocations',(select count(*) from ai.ai_model_invocation),'messages',(select count(*) from ai.ai_interaction_message))
      into before_counts;
    select count(*) into receipts_before from ai.explorer_conversation_operation where compass_suggestion_typed;
    -- As in a real Send, the phrase check is observed before prepare when it flags crisis, urgency or a possible minor.
    if (level_n>=3 or minor_n) and not exists(select 1 from pg_temp.observe(slot_n,level_n,minor_n) where outcome='ok')
      then raise exception 'fixture'; end if;
    if not exists(select 1 from pg_temp.prepare_private(slot_n,level_n,minor_n,send_body) where outcome='ok' and dispatch_permitted)
      then raise exception 'fixture'; end if;
    select * into settled from pg_temp.settle_private(slot_n,model=>model_n,minor_flag=>minor_n,kind=>reply_kind,
      interested=>interested_n,suggestions=>suggestions,responses=>responses,
      attention_id=>case when case_name in ('right','not_it') then point_id else null end);
    before_replay:=jsonb_build_object('state',pg_temp.state(),'operations',(select count(*) from ai.explorer_conversation_operation),
      'messages',(select count(*) from ai.ai_interaction_message),'invocations',(select count(*) from ai.ai_model_invocation));
    select * into replayed from pg_temp.settle_private(slot_n,model=>model_n,minor_flag=>minor_n,kind=>reply_kind,
      interested=>interested_n,suggestions=>suggestions,responses=>responses,
      attention_id=>case when case_name in ('right','not_it') then point_id else null end);
    begin
      perform * from pg_temp.settle_private(slot_n,model=>model_n,minor_flag=>minor_n,kind=>reply_kind,
        interested=>interested_n,suggestions=>suggestions,responses=>'[]'::jsonb,
        attention_id=>case when case_name in ('right','not_it') then point_id else null end);
    exception when raise_exception then conflict:=sqlerrm='solmind_explorer_private_operation_conflict'; end;
    result:=jsonb_build_object('outcome',settled.outcome,'saved',settled.saved_reply,'state',pg_temp.state(),
      'formation',(select formation_status from ai.explorer_conversation_compass_item where item_id=point_id),
      'label',(select label from ai.explorer_conversation_compass_item where item_id=point_id),
      'wording',(select wording_message_id from ai.explorer_conversation_compass_item where item_id=point_id),
      'unchangedPoints',before_points=(select jsonb_agg(to_jsonb(c) order by item_id) from ai.explorer_conversation_compass_item c),
      'unchangedReflection',before_reflection=pg_temp.reflection_state(),
      'foreignForming',exists(select 1 from ai.explorer_conversation_compass_item c
        join ai.explorer_conversation_state s on s.conversation_id=c.conversation_id
        where c.item_id=point_id and c.conversation_id=pg_temp.gid(6006) and s.actor_user_account_id=pg_temp.gid(4)
          and c.formation_status='proposed' and c.merged_into_item_id is null and c.wording_message_id=pg_temp.gid(20005)),
      'mergedOriginallyForming',exists(select 1 from ai.explorer_conversation_compass_item
        where item_id=point_id and formation_status='confirmed' and wording_message_id=pg_temp.gid(10015)
          and merged_into_item_id=(select id from points where name='Rest')),
      'explorerSaved',exists(select 1 from ai.explorer_conversation_compass_item c
        join ai.ai_interaction_message m on m.ai_interaction_message_id=c.source_message_id
        where c.item_id=point_id and c.formation_status is null and c.wording_message_id is null
          and c.conversation_id=pg_temp.gid(6005) and m.sender_type='user' and m.sender_user_account_id=pg_temp.gid(1)),
      'buttonCloseReceipt',exists(select 1 from ai.explorer_conversation_operation o
        join ai.ai_interaction_message m on m.ai_interaction_message_id=pg_temp.gid(10015)
        where o.operation_id=pg_temp.gid(70001) and o.actor_user_account_id=pg_temp.gid(1)
          and o.kind='respond_compass_suggestion' and o.compass_suggestion_item_id=point_id
          and o.compass_suggestion_response='close' and not o.compass_suggestion_typed and o.completed_at>=m.created_at),
      'sendBody',(select body from lifecycle_intent where slot=slot_n),
      'typedReceipts',(select count(*)-receipts_before from ai.explorer_conversation_operation where compass_suggestion_typed),
      'receipts',(select coalesce(jsonb_agg(jsonb_build_object('pointId',compass_suggestion_item_id,
        'response',compass_suggestion_response,'typed',compass_suggestion_typed)),'[]'::jsonb)
        from ai.explorer_conversation_operation where compass_suggestion_typed),
      'noReceiptProse',not exists(select 1 from ai.explorer_conversation_operation where compass_suggestion_typed
        and (message_id is not null or reply_message_id is not null or invocation_id is not null
          or snapshot_id is not null or compass_route_kind is not null)),
      'replayOutcome',replayed.outcome,'replayUnchanged',before_replay=jsonb_build_object('state',pg_temp.state(),
        'operations',(select count(*) from ai.explorer_conversation_operation),'messages',(select count(*) from ai.ai_interaction_message),
        'invocations',(select count(*) from ai.ai_model_invocation)),'changedReplayConflicts',conflict,
      'rejected',(select count(*) from ai.explorer_conversation_compass_item where formation_status='rejected'),
      'mode',(select mode from lifecycle_intent where slot=slot_n),
      'contextHasCompass',(select serialization::jsonb ? 'compassContext' from lifecycle_intent where slot=slot_n),
      'sendDelta',(select count(*) from ai.explorer_conversation_operation where kind='send')-(before_counts->>'sends')::integer,
      'invocationDelta',(select count(*) from ai.ai_model_invocation)-(before_counts->>'invocations')::integer,
      'messageDelta',(select count(*) from ai.ai_interaction_message)-(before_counts->>'messages')::integer,
      'deferredExact',not exists(select 1 from ai.explorer_conversation_operation f
        join ai.explorer_conversation_operation o on o.operation_id=f.origin_operation_id and o.actor_user_account_id=f.actor_user_account_id
        where f.compass_route_item_id=point_id and (f.compass_route_label<>'Work pressure' or f.completed_at<>o.completed_at
          or f.initial_revision<>o.initial_revision+case when o.kind='send' then 1 else 0 end)));
    raise exception using errcode='P0602',message='rollback_synthetic_fixture';
  exception when sqlstate 'P0602' then null;
  end;
  return result;
end $$;
create temp table cases(name text primary key,value jsonb);
insert into cases select name,pg_temp.typed_case(name) from unnest(array['right','close','not_it','old','button','refine',
  'same_refine','refine_close','refine_not_it','deferred','restricted','adult','level2','classification_only','uninterested','malformed','foreign',
  'duplicates','fourth','three','limit','limit_duplicate','button_close','button_close_refined','foreign_existing','merged',
  'explorer_saved']) name;

select ok((select p.pronargs=28 and p.prosecdef and p.proowner='postgres'::regrole
  and p.proconfig @> array['search_path=""','lock_timeout=2000ms','statement_timeout=5000ms']
  and p.proargnames[24]='p_compass_responses' and p.proargnames[25]='p_waypoint_suggestion' and p.proargnames[28]='p_compass_topics' from pg_proc p
  where p.oid='public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb)'::regprocedure),
  'S6b: settlement has exactly 28 arguments (REV391 adds p_compass_topics), postgres ownership and unchanged finite limits');
select ok(to_regprocedure('public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text)') is null
  and (select count(*)=1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='solmind_settle_explorer_conversation_turn_v4'),
  'S6b: the 27-argument settlement identity is gone and exactly one settlement identity remains');
select ok(has_function_privilege('service_role',
  'public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb)','EXECUTE')
  and not has_function_privilege('anon',
  'public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb)','EXECUTE')
  and not has_function_privilege('authenticated',
  'public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb)','EXECUTE')
  and not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
    where p.oid='public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb)'::regprocedure
      and acl.grantee=0 and acl.privilege_type='EXECUTE'),
  'S6b: settlement is executable by service_role only among API roles');
select ok(to_regprocedure('public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb)') is null
  and not has_function_privilege('service_role','ai.solmind_apply_compass_suggestion_response(uuid,uuid,uuid,text)','EXECUTE'),
  'S6b: no retired 23-argument overload or public shared-transition capability remains');
select ok((select value->>'formation'='proposed' and value->>'label'='Work pressure' and (value->>'saved')::boolean
  and value->>'typedReceipts'='0' and (value->>'unchangedPoints')::boolean and (value->>'unchangedReflection')::boolean
  from cases where name='right'),'S6b: a typed right is retired: the reply saves, no receipt is written and every point is unchanged');
select ok((select jsonb_array_length(value#>'{state,route}')=0 and value#>'{state,attentionId}'='null'::jsonb
  from cases where name='right'),
  'S6b: the same reply''s attention to the forming point is not followed, so no deferred move or Route entry appears');
select ok((select (value->>'unchangedPoints')::boolean and value->>'formation'='proposed'
  and value->>'typedReceipts'='0' and (value->>'unchangedReflection')::boolean from cases where name='close'),
  'S6b: a typed close is retired: no receipt and no point or reflection change');
select ok((select value->>'formation'='proposed' and value#>'{state,attentionId}'='null'::jsonb
  and jsonb_array_length(value#>'{state,compassItems}')=3 and jsonb_array_length(value#>'{state,route}')=0
  and value->>'typedReceipts'='0' and (value->>'unchangedPoints')::boolean
  from cases where name='not_it'),'S6b: a typed not_it is retired: the point stays forming, attention is not moved and no Route is captured');
select ok((select value->>'typedReceipts'='0' and (value->>'unchangedPoints')::boolean from cases where name='old'),
  'S6b: a suggestion from an older saved reply cannot be answered');
select ok((select value->>'typedReceipts'='0' and value->>'formation'='confirmed' from cases where name='button'),
  'S6b: a point already confirmed by a historical button answer cannot be answered again');
select ok((select value->>'saved'='true' and value->>'typedReceipts'='0' and value->>'formation'='proposed'
  and (value->>'unchangedPoints')::boolean and (value->>'unchangedReflection')::boolean
  and (value->>'buttonCloseReceipt')::boolean and value->>'sendBody'='Close, not quite: "Work pressure"'
  from cases where name='button_close'),
  'S6b: button close followed by a typed close proposal saves the reply without a typed receipt or reflection change');
select ok((select value->>'typedReceipts'='0' and value->>'formation'='proposed' and value->>'label'='Work pressure'
  and (value->>'unchangedPoints')::boolean from cases where name='button_close_refined'),
  'S6b: after a historical button close, a retired rewording leaves the wording and a typed right writes no receipt');
select ok((select value->>'typedReceipts'='0' and value->>'formation'='proposed' and value->>'label'='Work pressure'
  and (value->>'unchangedPoints')::boolean from cases where name='refine'),
  'S6b: a reply proposing both a rewording and a confirmation changes neither (both retired)');
select ok((select value->>'typedReceipts'='0' and value->>'formation'='proposed' and value->>'label'='Work pressure'
  from cases where name='same_refine'),'S6b: even a same-label refinement prevents a typed confirmation');
select ok((select bool_and(value->>'typedReceipts'='0' and value->>'formation'='proposed'
  and value->>'label'='Work pressure' and value->>'saved'='true' and (value->>'unchangedPoints')::boolean)
  from cases where name in ('refine_close','refine_not_it')),
  'REV306b: retired rewordings with close and not_it change nothing without losing the reply');
select ok((select jsonb_array_length(value#>'{state,route}')=0 and value->>'typedReceipts'='0' and value->>'formation'='proposed'
  from cases where name='deferred'),'S6b: with confirmation retired, the Explorer moves onto the forming point stay unmaterialized and no Route entry appears');
select ok((select bool_and(value->>'typedReceipts'='0' and (value->>'unchangedPoints')::boolean)
  from cases where name in ('restricted','adult','level2','classification_only','uninterested')),
  'S6b: every closed safety, mode and delivery gate drops responses without changing points');
select ok((select bool_and(value->>'mode'='classification_only' and not (value->>'contextHasCompass')::boolean)
  from cases where name in ('restricted','adult','classification_only')),
  'S6b: classification-only prepares retain the section-free context');
select ok((select value->>'saved'='true' and value->>'typedReceipts'='0' from cases where name='level2'),
  'S6b: a valid level-2 ordinary reply saves while its answer proposal is ignored');
select ok((select value->>'saved'='false' and value->>'typedReceipts'='0' from cases where name='uninterested'),
  'S6b: delivery no longer wanted produces neither a saved reply nor a typed receipt');
select ok((select value->>'formation'='proposed' and value->>'typedReceipts'='0' and (value->>'unchangedPoints')::boolean
  from cases where name='malformed'),'S6b: malformed and valid typed entries alike are now ignored');
select ok((select value->>'typedReceipts'='0' and value->>'saved'='true' from cases where name='foreign'),
  'S6b: an unowned or missing point selector never affects a valid saved reply');
select ok((select value->>'typedReceipts'='0' and value->>'saved'='true' and (value->>'foreignForming')::boolean
  and (value->>'unchangedPoints')::boolean and (value->>'unchangedReflection')::boolean from cases where name='foreign_existing'),
  'S6b: a real forming point in another Explorer conversation is skipped without any reflection change');
select ok((select value->>'typedReceipts'='0' and value->>'saved'='true' and (value->>'mergedOriginallyForming')::boolean
  and (value->>'unchangedPoints')::boolean and (value->>'unchangedReflection')::boolean from cases where name='merged'),
  'S6b: a formerly forming point confirmed and combined into another point (historical) is skipped without any reflection change');
select ok((select value->>'typedReceipts'='0' and value->>'saved'='true' and (value->>'explorerSaved')::boolean
  and (value->>'unchangedPoints')::boolean and (value->>'unchangedReflection')::boolean from cases where name='explorer_saved'),
  'S6b: an Explorer-saved point is skipped without any reflection change');
select ok((select value->>'formation'='proposed' and value->>'typedReceipts'='0' and (value->>'unchangedPoints')::boolean
  from cases where name='duplicates'),'S6b: duplicate typed answers to one point are all ignored (retired)');
select ok((select value->>'typedReceipts'='0' from cases where name='fourth'),
  'S6b: a fourth submitted response is never considered');
select ok((select value->>'typedReceipts'='0' and (value->>'unchangedPoints')::boolean from cases where name='three'),
  'S6b: three distinct typed answers produce no receipt and change no point (retired)');
select ok((select value->>'rejected'='24' and value->>'typedReceipts'='0' and value->>'formation'='proposed'
  and value->>'saved'='true' from cases where name='limit'),
  'S6b: at the 24 historical turned-down rows another typed rejection is dropped without losing the reply');
select ok((select value->>'rejected'='24' and value->>'typedReceipts'='0' and value->>'formation'='proposed'
  from cases where name='limit_duplicate'),
  'S6b: a first valid rejection at the limit still consumes the point and cannot become a later duplicate confirmation');
select ok((select bool_and(value->>'replayOutcome'='exact_replay' and (value->>'replayUnchanged')::boolean) from cases),
  'S6b: exact replay is zero-write for applied, ignored, malformed and gated responses');
select ok((select bool_and((value->>'changedReplayConflicts')::boolean) from cases),
  'S6b: changing any response proposal conflicts even when it was ignored');
select ok((select bool_and((value->>'noReceiptProse')::boolean and value->'receipts'='[]'::jsonb) from cases),
  'S6b: no case writes any typed receipt, so no receipt can carry prose or invocation');
select ok((select bool_and(value->>'sendDelta'='1' and value->>'invocationDelta'='1'
  and (value->>'messageDelta')::integer=case when (value->>'saved')::boolean then 2 else 1 end) from cases),
  'S6b: typed responses add no extra Send, invocation or message beyond the ordinary turn');

-- Inspector proves the same forming-point boolean as the TypeScript golden case.
create function pg_temp.inspect(value jsonb) returns text language sql as $$
  select outcome from ai.solmind_inspect_explorer_context_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(24),
    pg_temp.gid(25),pg_temp.gid(6005),pg_temp.compact(value),
    (select array_agg(distinct id order by id) from (
      select unnest(array[pg_temp.gid(52),(value#>>'{immediateExplorerMessage,messageId}')::uuid,pg_temp.gid(1001)]) id
      union all select ai_interaction_message_id from ai.ai_interaction_message where ai_interaction_session_id=pg_temp.gid(6005)
      union all select unnest(pg_temp.compass_source_ids())) ids))
$$;
create temp table context_fixture as select pg_temp.context_value(pg_temp.gid(99901),'Synthetic typed answer.') value;
select is(pg_temp.inspect((select value from context_fixture)),'clear','S6b: SQL accepts the exact v8 legacy context');
select ok((select value#>'{compassContext,points}'='[]'::jsonb and value#>>'{compassContext,mode}'='legacy_read_only'
  from context_fixture),'S6b: the v8 legacy context offers no forming point for an answer');
select is(pg_temp.inspect(jsonb_set((select value from context_fixture),'{compassContext,points}',
  jsonb_build_array(jsonb_build_object('id',(select id from points where name='Work pressure'),'label','Work pressure','order',0,
    'formation','saved','anchor',null,'emphasis',null)))),
  'unavailable','S6b: SQL refuses a legacy forming point forged into the v8 points');
select is(pg_temp.inspect(jsonb_set(jsonb_set((select value from context_fixture),'{contractVersion}',
  '"wi007-v0.1+onboarding-fields-v2+compass-v2"'),'{compassContext,version}','"explorer-compass-context.v2"')),
  'unavailable','S6b: SQL refuses the old ordinary context version');
select ok(not methodology.serialized_methodology_valid(pg_temp.compact(jsonb_set(jsonb_set((select value from context_fixture),
  '{contractVersion}','"wi007-v0.1+onboarding-fields-v2+compass-v2"'),'{compassContext,version}','"explorer-compass-context.v2"')),
  pg_temp.gid(1001),(select content_markdown from methodology.methodology_context_pack_version
    where methodology_context_pack_version_id=pg_temp.gid(1001))),
  'S6b: methodology validation also refuses the old ordinary context version');
select ok(pg_temp.send_retired(2,jsonb_build_array(jsonb_build_object('pointId',(select id from points where name='Work pressure'),
  'label','Work pressure'))),'S6b: a reply carrying a retired wording refresh saves and changes no Compass state');
select is((select jsonb_agg(jsonb_build_object('label',c->>'label','wordingMessageId',c->>'wordingMessageId') order by c->>'label')
  from jsonb_array_elements(pg_temp.state()->'compassItems') c),
  jsonb_build_array(jsonb_build_object('label','Family','wordingMessageId',pg_temp.gid(10015)),
    jsonb_build_object('label','Rest','wordingMessageId',pg_temp.gid(10015)),
    jsonb_build_object('label','Work pressure','wordingMessageId',pg_temp.gid(10015))),
  'S6b: every forming point keeps its original wording reply in saved state (no refresh)');
select is(pg_temp.inspect(pg_temp.context_value(pg_temp.gid(99902),'Synthetic typed answer.')),'clear',
  'S6b: exact inspection accepts the v8 legacy context after the retired refresh');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(3)),
  'S6b: fixture prepares a final typed confirmation for immutable receipt checks');
select ok((select outcome='ok' and saved_reply from pg_temp.settle_private(3,
  responses=>jsonb_build_array(jsonb_build_object('pointId',(select id from points where name='Work pressure'),'response','right'))))
  and not exists(select 1 from ai.explorer_conversation_operation where compass_suggestion_typed)
  and (select formation_status='proposed' from ai.explorer_conversation_compass_item where item_id=(select id from points where name='Work pressure')),
  'S6b: a final typed confirmation saves the reply but writes no receipt and confirms nothing');
-- REV391: a privileged historical typed receipt (derived id and fingerprint of
-- 20261106030000_explorer_failed_reply_reason.sql), attached to Send 1, for the immutability checks below.
insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,
  kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,
  compass_suggestion_item_id,compass_suggestion_response,compass_suggestion_typed)
select pg_temp.gid(1),encode(set_byte(set_byte(x1.bb,6,(get_byte(x1.bb,6)&15)|80),8,(get_byte(x1.bb,8)&63)|128),'hex')::uuid,
  pg_temp.gid(50),pg_temp.gid(6005),'respond_compass_suggestion',x2.h,x2.h,o.initial_revision,'completed',o.completed_at,
  (select id from points where name='Rest'),'close',true
from ai.explorer_conversation_operation o,
  lateral (select substring(extensions.digest(convert_to('explorer-typed-compass-response.v1|'||pg_temp.gid(1)::text
    ||'|'||o.operation_id::text||'|'||(select id from points where name='Rest')::text,'UTF8'),'sha256') from 1 for 16) as bb) x1,
  lateral (select methodology.hash_json(jsonb_build_array('explorer-typed-compass-response.v1',pg_temp.gid(1),pg_temp.gid(50),
      pg_temp.gid(6005),o.operation_id,(select id from points where name='Rest'),'close')) as h) x2
where o.operation_id=pg_temp.gid(10010);
select throws_ok($$update ai.explorer_conversation_operation set compass_suggestion_typed=false where compass_suggestion_typed$$,
  'P0001','solmind_explorer_private_immutable','S6b: a historical typed receipt cannot be relabeled as a button answer');
select throws_ok($$delete from ai.explorer_conversation_operation where compass_suggestion_typed$$,
  'P0001','solmind_explorer_private_immutable','S6b: a historical typed receipt cannot be deleted');
select ok((select bool_and(c.relrowsecurity) from pg_class c
  where c.oid in ('ai.explorer_conversation_compass_item'::regclass,'ai.explorer_conversation_operation'::regclass))
  and not has_table_privilege('service_role','ai.explorer_conversation_operation','SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('service_role','ai.explorer_conversation_compass_item','SELECT,INSERT,UPDATE,DELETE'),
  'S6b: private table RLS and direct-access grants remain closed');
select * from finish();
rollback;
