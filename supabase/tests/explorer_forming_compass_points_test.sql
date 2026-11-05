-- PROPOSAL AUTHORSHIP. The Executor executes serially in an isolated
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
select plan(119);

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
  select jsonb_build_object('version','explorer-compass-context.v2',
    'points',coalesce((select jsonb_agg(jsonb_build_object('id',c.item_id,'label',ai.solmind_exclusion_normalize_v3(c.label),
      'order',c.ord-1,'formation',case when c.formation_status='proposed' then 'forming' else 'saved' end,'anchor',c.compass_anchor,'emphasis',c.relative_emphasis) order by c.ord)
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
      order by w.created_at,w.waypoint_id)
      from content.waypoint w where w.source_ai_interaction_session_id=pg_temp.gid(6005)
        and not exists(select 1 from content.waypoint s where s.predecessor_waypoint_id=w.waypoint_id)),'[]'::jsonb),
    'drafts','[]'::jsonb)
$$;
create function pg_temp.compass_source_ids() returns uuid[] language sql stable as $$
  select coalesce(array_agg(x.id),array[]::uuid[]) from (
    select c.item_id as id from ai.explorer_conversation_compass_item c
      where c.conversation_id=pg_temp.gid(6005) and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected'
    union all select w.waypoint_id from content.waypoint w where w.source_ai_interaction_session_id=pg_temp.gid(6005)
      and not exists(select 1 from content.waypoint s where s.predecessor_waypoint_id=w.waypoint_id)) x
$$;
create function pg_temp.context_value(msg uuid,body text,classification_only boolean default false) returns jsonb language sql stable as $$
  select jsonb_build_object('contractVersion',case when classification_only then 'wi007-v0.1+onboarding-fields-v2'
    else 'wi007-v0.1+onboarding-fields-v2+compass-v2' end,'aiRole','solmind_virtual_guide','actorRoleContext','explorer',
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
  interested boolean default true,fallback_override integer default null,attention_n integer default null,choices jsonb default null,suggestions jsonb default null,attention_id uuid default null)
returns table(outcome text,conversation_state jsonb,policy_state jsonb,saved_reply boolean)
language sql as $$
  select * from public.solmind_settle_explorer_conversation_turn_v4(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(10000+slot_n*10),status_name,case when kind='none' then null else pg_temp.gid(10005+slot_n*10) end,
    kind,case when kind='none' then null else body end,model::smallint,minor_flag,'explorer-safety-reply.v2',
    (select mode from lifecycle_intent where slot=slot_n),repeat('A',64),'synthetic-fallback.v1',
    'synthetic-model-policy.v1','synthetic-trusted.v1','synthetic-resources.v1',
    coalesce(fallback_override,(select fallback from lifecycle_intent where slot=slot_n))::smallint,
    (select minor from lifecycle_intent where slot=slot_n),interested,
    coalesce(attention_id,case when attention_n is null then null else pg_temp.gid(attention_n) end),choices,suggestions)
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
create function pg_temp.move(op_n integer,point_id uuid,kind_name text default 'set_attention') returns text language sql as $$
  select outcome from public.solmind_mutate_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(op_n),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),
    kind_name,pg_temp.request_sha(op_n),null,point_id)
$$;
create function pg_temp.resolve_point(op_n integer,point_id uuid,resolution text,label_override text default null,
  wording_override uuid default null,revision_override integer default null) returns text language sql as $$
  select outcome from ai.solmind_resolve_forming_compass_point(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(op_n),
    coalesce(revision_override,(select initial_revision from ai.explorer_conversation_operation where operation_id=pg_temp.gid(op_n)),
      (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005))),point_id,
    coalesce(label_override,(select label from ai.explorer_conversation_compass_item where item_id=point_id)),
    coalesce(wording_override,(select wording_message_id from ai.explorer_conversation_compass_item where item_id=point_id)),
    resolution,pg_temp.request_sha(op_n))
$$;
create function pg_temp.send_suggestions(slot_n integer,suggestions jsonb,attention uuid default null) returns boolean language plpgsql as $$
begin
  if not exists(select 1 from pg_temp.prepare_private(slot_n) where outcome='ok' and dispatch_permitted) then return false; end if;
  return exists(select 1 from pg_temp.settle_private(slot_n,suggestions=>suggestions,attention_id=>attention) where outcome='ok' and saved_reply);
end $$;
create function pg_temp.inspect_forming(context_override jsonb default null) returns text language sql as $$
  select outcome from ai.solmind_inspect_explorer_context_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(24),pg_temp.gid(25),
    pg_temp.gid(6005),pg_temp.compact(coalesce(context_override,pg_temp.context_value(pg_temp.gid(99001),'Synthetic inspection.'))),
    (select array_agg(distinct id order by id) from (
      select unnest(array[pg_temp.gid(52),pg_temp.gid(99001),pg_temp.gid(1001)]) id
      union all select m.ai_interaction_message_id from (select * from ai.ai_interaction_message
        where ai_interaction_session_id=pg_temp.gid(6005) order by sequence_number desc limit 24) m
      union all select unnest(pg_temp.compass_source_ids())) sources))
$$;
create temp table points(name text primary key,id uuid);

select ok((select p.pronargs=23 and p.prosecdef and p.proconfig @> array['lock_timeout=2000ms','statement_timeout=5000ms']
  and has_function_privilege('service_role',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE')
  and not has_function_privilege('authenticated',p.oid,'EXECUTE') from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='solmind_settle_explorer_conversation_turn_v4'),
  'S5: settle has 23 arguments, unchanged limits and service-only execution');
select ok(not has_function_privilege('service_role','ai.solmind_resolve_forming_compass_point(uuid,uuid,uuid,uuid,integer,uuid,text,uuid,text,text)','EXECUTE')
  and not has_function_privilege('anon','ai.solmind_resolve_forming_compass_point(uuid,uuid,uuid,uuid,integer,uuid,text,uuid,text,text)','EXECUTE')
  and not has_function_privilege('authenticated','ai.solmind_resolve_forming_compass_point(uuid,uuid,uuid,uuid,integer,uuid,text,uuid,text,text)','EXECUTE')
  and not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
    where p.oid='ai.solmind_resolve_forming_compass_point(uuid,uuid,uuid,uuid,integer,uuid,text,uuid,text,text)'::regprocedure
      and acl.grantee=0 and acl.privilege_type='EXECUTE')
  and not has_function_privilege('service_role','ai.solmind_forming_attention_move_v1(uuid)','EXECUTE')
  and not has_function_privilege('anon','ai.solmind_forming_attention_move_v1(uuid)','EXECUTE')
  and not has_function_privilege('authenticated','ai.solmind_forming_attention_move_v1(uuid)','EXECUTE')
  and not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
    where p.oid='ai.solmind_forming_attention_move_v1(uuid)'::regprocedure and acl.grantee=0 and acl.privilege_type='EXECUTE')
  and not has_table_privilege('service_role','ai.explorer_conversation_compass_item','INSERT,UPDATE,DELETE'),
  'S5: resolution groundwork, the forming-move helper and point writes expose no API grant');
select ok(pg_temp.send_suggestions(1,'[{"label":"Work pressure"},{"label":""},{"label":"Rest"},{"label":"Ignored fourth"}]'),
  'S5: bad entry is dropped independently and the ordinary reply saves');
insert into points select label,item_id from ai.explorer_conversation_compass_item where conversation_id=pg_temp.gid(6005);
select is((select count(*)::integer from ai.explorer_conversation_compass_item),2,'S5: first three positions yield two valid points; fourth is ignored');
select ok((select bool_and(formation_status='proposed' and wording_message_id=pg_temp.gid(10015) and source_message_id=pg_temp.gid(10015)
  and compass_anchor is null and relative_emphasis is null and merged_into_item_id is null) from ai.explorer_conversation_compass_item),
  'S5: forming points save immediately with original and latest reply pointers');
select ok((select bool_and(value->>'formation'='forming') from jsonb_array_elements(pg_temp.state()->'compassItems')),
  'S5: private state marks forming points explicitly');
select ok((select bool_and(value->>'formation'='forming') from jsonb_array_elements(pg_temp.compass_context()->'points')),
  'S5: ordinary v2 model context includes forming points');
select is(jsonb_array_length(pg_temp.state()->'route'),0,'S5: proposal creates no confirmed Route history');
select is(pg_temp.inspect_forming(),'clear','S5: real forming rows inspect clear before the forgery');
select is(pg_temp.inspect_forming(jsonb_set(pg_temp.context_value(pg_temp.gid(99001),'Synthetic inspection.'),
  '{compassContext,points,0,formation}','"saved"')),'unavailable','S5: a forming row cannot be forged as saved in model context');
select throws_ok($$update ai.explorer_conversation_compass_item set label='Unauthorized change' where item_id=(select id from points where name='Work pressure')$$,
  'P0001','solmind_explorer_private_formation_conflict','S5: proposed label cannot change outside settlement');
select throws_ok($$select pg_temp.move(70001,(select id from points where name='Work pressure'),'confirm_priority')$$,
  'P0001',null,'S5: Priority does not implicitly confirm a forming point');
select throws_ok($$select * from public.solmind_confirm_explorer_compass_category_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(70002),
  (pg_temp.state()->>'revision')::integer,pg_temp.request_sha(70002),(select id from points where name='Work pressure'),
  array[(select id from points where name='Work pressure')],'Changed category')$$,
  'P0001','solmind_explorer_private_invalid_input','S5: category cannot snapshot unconfirmed wording');
select throws_ok($$select pg_temp.resolve_point(70003,(select id from points where name='Work pressure'),'confirmed','Changed unseen wording')$$,
  'P0001','solmind_explorer_private_formation_conflict','S5: confirmation requires exact current wording');
select throws_ok($$select pg_temp.resolve_point(70004,(select id from points where name='Work pressure'),'confirmed',null,pg_temp.gid(999))$$,
  'P0001','solmind_explorer_private_formation_conflict','S5: confirmation requires exact wording reply');
select ok((select dispatch_permitted from pg_temp.prepare_private(2)),'S5: actual inspector accepts forming v2 context');
select is(pg_temp.resolve_point(70005,(select id from points where name='Work pressure'),'confirmed'),'unavailable',
  'S5: confirmation refuses while a turn is pending');
create temp table revised as select jsonb_build_array(jsonb_build_object('pointId',id,'label','Work and boundaries')) value
  from points where name='Work pressure';
select ok((select saved_reply from pg_temp.settle_private(2,suggestions=>(select value from revised),attention_id=>(select id from points where name='Work pressure'))),
  'S5: later reply revises wording and automatically follows the forming point');
select ok((select label='Work and boundaries' and source_message_id=pg_temp.gid(10015) and wording_message_id=pg_temp.gid(10025)
  from ai.explorer_conversation_compass_item where item_id=(select id from points where name='Work pressure')),
  'S5: same point keeps original source and replaces latest wording pointer');
select is(jsonb_array_length(pg_temp.state()->'route'),0,'S5: automatic forming move records no unconfirmed Route label');
select is((pg_temp.state()->>'attentionId')::uuid,(select id from points where name='Work pressure'),'S5: needle moves while the point is forming');
select is((select outcome from pg_temp.settle_private(2,suggestions=>(select value from revised),attention_id=>(select id from points where name='Work pressure'))),
  'exact_replay','S5: forming move replay remains exact and makes no second update');
select throws_ok($$select * from pg_temp.settle_private(2,suggestions=>'[]',attention_id=>(select id from points where name='Work pressure'))$$,
  'P0001','solmind_explorer_private_operation_conflict','S5: changed suggestions cannot replay a completed Send');
select is(pg_temp.resolve_point(70006,(select id from points where name='Work pressure'),'confirmed'),'ok','S5: explicit exact confirmation succeeds');
select is((select formation_status from ai.explorer_conversation_compass_item where item_id=(select id from points where name='Work pressure')),
  'confirmed','S5: confirmation persists its status');
select is(jsonb_array_length(pg_temp.state()->'route'),1,'S5: confirmation materializes one deferred move');
select ok((select compass_route_label='Work and boundaries' and completed_at=(select completed_at from ai.explorer_conversation_operation where operation_id=pg_temp.gid(10020))
  from ai.explorer_conversation_operation where origin_operation_id=pg_temp.gid(10020)),
  'S5: deferred Route uses confirmed wording and original move time');
select is(pg_temp.resolve_point(70006,(select id from points where name='Work pressure'),'confirmed'),'exact_replay','S5: confirmation replay is writeless');
select is(jsonb_array_length(pg_temp.state()->'route'),1,'S5: confirmation replay cannot duplicate deferred Route');
select is(pg_temp.resolve_point(70007,(select id from points where name='Rest'),'rejected'),'ok','S5: rejection keeps a private row');
select is((select formation_status from ai.explorer_conversation_compass_item where item_id=(select id from points where name='Rest')),
  'rejected','S5: rejected status is retained');
select is(jsonb_array_length(pg_temp.state()->'compassItems'),1,'S5: rejected point is absent from Explorer state');
select is(jsonb_array_length(pg_temp.compass_context()->'points'),1,'S5: rejected point is absent from model context');
select ok(not (select id from points where name='Rest')=any(pg_temp.compass_source_ids()),'S5: rejected identity is absent from context sources');
select throws_ok($$select pg_temp.move(70008,(select id from points where name='Rest'))$$,'P0001',null,'S5: rejected row is not an attention head');
select throws_ok($$update ai.explorer_conversation_compass_item set formation_status='proposed' where item_id=(select id from points where name='Rest')$$,
  'P0001','solmind_explorer_private_immutable','S5: rejection cannot reactivate');
select ok(pg_temp.send_suggestions(3,jsonb_build_array(jsonb_build_object('pointId',(select id from points where name='Rest'),'label','Not revived'),
  jsonb_build_object('pointId',(select id from points where name='Work pressure'),'label','Not overwritten'),jsonb_build_object('label','Family'))),
  'S5: invalid rejected/confirmed updates do not discard a valid new suggestion or reply');
insert into points select 'Family',item_id from ai.explorer_conversation_compass_item where label='Family';
select ok((select label='Work and boundaries' from ai.explorer_conversation_compass_item where item_id=(select id from points where name='Work pressure'))
  and (select label='Rest' from ai.explorer_conversation_compass_item where item_id=(select id from points where name='Rest')),
  'S5: confirmed and rejected labels remain unchanged');

savepoint explorer_forming_moves;
select is(pg_temp.move(76000,(select id from points where name='Family')),'ok','S5: Explorer taps a forming point');
select ok((select followed_attention_item_id=(select id from points where name='Family') and compass_route_kind is null
  and compass_route_item_id is null and compass_route_label is null from ai.explorer_conversation_operation where operation_id=pg_temp.gid(76000))
  and jsonb_array_length(pg_temp.state()->'route')=1,'S5: Explorer forming move retains only its target and no Route row or wording');
select throws_ok($$update ai.explorer_conversation_operation set followed_attention_item_id=null where operation_id=pg_temp.gid(76000)$$,
  'P0001','solmind_explorer_private_immutable','S5: deferred Explorer target is immutable');
select ok((select authority_context->'formingAttentionMove'=jsonb_build_object('pointId',(select id from points where name='Family'),
  'revision',o.initial_revision+1,'recordedAt',o.completed_at) and not conversation_state ? 'formingAttentionMove'
  from public.solmind_read_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005)) r
  cross join ai.explorer_conversation_operation o where o.operation_id=pg_temp.gid(76000)),
  'S5: only the server authority read carries label-free move chronology');
select is(pg_temp.compass_context()->'recentRoute'->-1,jsonb_build_object('kind','attention_changed',
  'pointId',(select id from points where name='Family'),'label','Family','actor','explorer','awaitingReply',true),
  'S5: next reply gets the forming point current-label Explorer acknowledgment');
select is(pg_temp.inspect_forming(),'clear','S5: inspector accepts the transient forming acknowledgment without a Route row');
select is(pg_temp.move(76001,(select id from points where name='Family')),'ok','S5: tapping the same forming attention remains a no-op');
select ok((select followed_attention_item_id is null from ai.explorer_conversation_operation where operation_id=pg_temp.gid(76001)),
  'S5: a no-op cannot become another deferred move');
select throws_ok($$update ai.explorer_conversation_operation set followed_attention_item_id=(select id from points where name='Family')
  where operation_id=pg_temp.gid(76001)$$,'P0001','solmind_explorer_private_immutable','S5: a no-op cannot be enriched into a deferred move');
select is(pg_temp.move(76002,(select id from points where name='Work pressure')),'ok','S5: later Explorer move leaves the forming point');
select ok(ai.solmind_forming_attention_move_v1(pg_temp.gid(6005)) is null
  and pg_temp.compass_context()->'recentRoute'->-1->>'label'='Work and boundaries'
  and pg_temp.compass_context()->'recentRoute'->-1->>'awaitingReply'='true'
  and not exists(select 1 from jsonb_array_elements(pg_temp.compass_context()->'recentRoute') r
    where r->>'pointId'=(select id::text from points where name='Family')),
  'S5: a later saved-point move clears the forming signal and receives acknowledgment instead');
select is(pg_temp.inspect_forming(),'clear','S5: inspector and context agree after the later Explorer move');
select is(pg_temp.move(76003,(select id from points where name='Family')),'ok','S5: Explorer can return to the forming point');
select ok(pg_temp.send_suggestions(4,jsonb_build_array(jsonb_build_object('pointId',(select id from points where name='Family'),
  'label','Family refined')),(select id from points where name='Work pressure')),'S5: next reply refines the point and follows a saved point');
select ok((select serialization::jsonb#>'{compassContext,recentRoute,-1}'=jsonb_build_object('kind','attention_changed',
  'pointId',(select id from points where name='Family'),'label','Family','actor','explorer','awaitingReply',true)
  from lifecycle_intent where slot=4) and ai.solmind_forming_attention_move_v1(pg_temp.gid(6005)) is null,
  'S5: the actual next prepare carries the acknowledgment and the saved reply consumes it');
select ok(pg_temp.send_suggestions(5,'[]',(select id from points where name='Family')),'S5: Virtual Guide later follows the same forming point');
select is(pg_temp.move(76004,(select id from points where name='Work pressure')),'ok','S5: Explorer leaves the automatic forming move');
select is(pg_temp.move(76005,(select id from points where name='Family')),'ok','S5: Explorer returns after the automatic move');
select is(pg_temp.move(76006,(select id from points where name='Work pressure')),'ok','S5: current attention can leave before confirmation');
select is(pg_temp.resolve_point(76007,(select id from points where name='Family'),'confirmed'),'ok','S5: confirmation resolves interleaved Explorer and Virtual Guide moves');
select is((select count(*)::integer from ai.explorer_conversation_operation where compass_route_item_id=(select id from points where name='Family')),4,
  'S5: three Explorer moves and one automatic move materialize exactly once');
select ok((select count(*)=4 and bool_and(f.compass_route_kind='attention_changed' and f.compass_route_label='Family refined'
  and f.completed_at=o.completed_at and f.initial_revision=o.initial_revision+case when o.kind='send' then 1 else 0 end
  and f.kind=case when o.kind='send' then 'follow_attention' else 'set_attention' end)
  from ai.explorer_conversation_operation f join ai.explorer_conversation_operation o on o.operation_id=f.origin_operation_id
  where f.compass_route_item_id=(select id from points where name='Family')),
  'S5: every deferred move uses confirmed wording, original revision and time, and its original actor');
select is((select jsonb_agg(r->>'actor' order by ord) from jsonb_array_elements(pg_temp.state()->'route') with ordinality entries(r,ord)
  where r->>'compassItemId'=(select id::text from points where name='Family')),
  '["explorer","explorer","virtual_guide","explorer"]'::jsonb,'S5: interleaved deferred Route events retain operation order and actors');
select is(pg_temp.resolve_point(76007,(select id from points where name='Family'),'confirmed'),'exact_replay','S5: mixed-move confirmation replays exactly');
select is((select count(*)::integer from ai.explorer_conversation_operation where compass_route_item_id=(select id from points where name='Family')),4,
  'S5: replay does not duplicate any Explorer or Virtual Guide deferred move');
select is(pg_temp.inspect_forming(),'clear','S5: confirmed deferred moves inspect clear as saved Route history');
rollback to savepoint explorer_forming_moves;

savepoint explorer_rejected_move;
select is(pg_temp.move(76100,(select id from points where name='Family')),'ok','S5: Explorer move can be declined later');
select is(pg_temp.move(76101,(select id from points where name='Work pressure')),'ok','S5: older saved Explorer move precedes rejection scenario');
select is(pg_temp.move(76102,(select id from points where name='Family')),'ok','S5: latest forming Explorer move supersedes older saved acknowledgment');
select is(pg_temp.resolve_point(76103,(select id from points where name='Family'),'rejected'),'ok','S5: rejection resolves deferred Explorer moves');
select ok(not exists(select 1 from ai.explorer_conversation_operation where compass_route_item_id=(select id from points where name='Family')
  or origin_operation_id in (pg_temp.gid(76100),pg_temp.gid(76102))) and pg_temp.state()->>'attentionId' is null,
  'S5: rejection writes no deferred Explorer Route event or wording and clears attention');
select ok((select authority_context->'formingAttentionMove'->'pointId'='null'::jsonb
  from public.solmind_read_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005)))
  and not exists(select 1 from jsonb_array_elements(pg_temp.compass_context()->'recentRoute') r where r->>'awaitingReply'='true'),
  'S5: rejected target identity stays private and older acknowledgment does not revive');
select is(pg_temp.inspect_forming(),'clear','S5: inspector agrees after rejecting the latest Explorer move');
rollback to savepoint explorer_rejected_move;

savepoint moved_away;
select ok(pg_temp.send_suggestions(4,'[]',(select id from points where name='Family')),'S5: auto move onto another forming point');
select is(pg_temp.move(70009,(select id from points where name='Work pressure')),'ok','S5: Explorer moves away before confirmation');
select ok(pg_temp.send_suggestions(5,'[]',(select id from points where name='Family')),'S5: second real automatic move onto the same forming point');
select is(pg_temp.move(70010,(select id from points where name='Work pressure')),'ok','S5: Explorer moves away again');
select is(pg_temp.resolve_point(70011,(select id from points where name='Family'),'confirmed'),'ok','S5: later confirmation resolves historical deferred moves');
select is((select count(*)::integer from ai.explorer_conversation_operation where followed_attention_item_id=(select id from points where name='Family')),2,
  'S5: two Send outcome pointers retain no wording');
select is((select count(*)::integer from ai.explorer_conversation_operation where kind='follow_attention' and compass_route_item_id=(select id from points where name='Family')),2,
  'S5: each real automatic move is materialized once after confirmation');
select ok((select bool_and(f.initial_revision=o.initial_revision+1 and f.completed_at=o.completed_at and f.compass_route_label='Family')
  from ai.explorer_conversation_operation f join ai.explorer_conversation_operation o on o.operation_id=f.origin_operation_id
  where f.compass_route_item_id=(select id from points where name='Family')),'S5: deferred events preserve original move chronology');
select is((pg_temp.state()->>'attentionId')::uuid,(select id from points where name='Work pressure'),'S5: confirmation never moves the current needle');
rollback to savepoint moved_away;

savepoint reject_attention;
select ok(pg_temp.send_suggestions(4,'[]',(select id from points where name='Family')),'S5: forming attention can later be declined');
select is(pg_temp.resolve_point(70012,(select id from points where name='Family'),'rejected'),'ok','S5: decline resolves the exact forming attention');
select ok(pg_temp.state()->>'attentionId' is null and not exists(select 1 from ai.explorer_conversation_operation
  where origin_operation_id=pg_temp.gid(10040)),'S5: rejection clears the needle without capturing rejected wording');
select is((select outcome from pg_temp.settle_private(4,suggestions=>'[]',attention_id=>(select id from points where name='Family'))),
  'exact_replay','S5: original Send replay stays exact after its forming target is rejected');
select is((select count(*)::integer from ai.explorer_conversation_compass_item where item_id=(select id from points where name='Family')),1,
  'S5: rejection and terminal replay retain one private identity');
rollback to savepoint reject_attention;

savepoint arrangement;
select is(pg_temp.move(70100,(select id from points where name='Work pressure'),'confirm_priority'),'ok','S5: saved head still permits Priority');
select is(pg_temp.move(70101,(select id from points where name='Family')),'ok','S5: Explorer may point at an unplaced forming point');
select is((select outcome from public.solmind_confirm_explorer_compass_arrangement_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(70102),
  (pg_temp.state()->>'revision')::integer,pg_temp.request_sha(70102),(select id from points where name='Work pressure'),
  jsonb_build_array(jsonb_build_object('compassItemId',(select id from points where name='Work pressure'),'anchor','apex','emphasis',3)))),
  'ok','S5: arrangement includes only confirmed heads while needle may remain forming');
select ok((select compass_anchor is null and relative_emphasis is null from ai.explorer_conversation_compass_item where item_id=(select id from points where name='Family')),
  'S5: arrangement leaves forming point unplaced and out of snapshots');
select ok(pg_temp.send_suggestions(4,'[{"label":"New topic beside arranged points"}]'),'S5: a new point forms beside an existing arrangement');
select ok((select label='Work and boundaries' and compass_anchor='apex' from ai.explorer_conversation_compass_item where item_id=(select id from points where name='Work pressure')),
  'S5: suggestions do not change Priority wording or arrangement');
select is((select outcome from public.solmind_end_explorer_conversation_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(70103),
  (pg_temp.state()->>'revision')::integer,pg_temp.request_sha(70103))),'ok','S5: ending succeeds with forming attention');
select ok((pg_temp.state()#>>'{ending,directionsTaken}') like '%Current attention was still forming.%'
  and position('Family' in pg_temp.state()#>>'{ending,directionsTaken}')=0,'S5: End captures no unconfirmed attention wording');
rollback to savepoint arrangement;

savepoint active_cap;
insert into ai.explorer_conversation_compass_item(item_id,conversation_id,source_message_id,label,display_order)
  select pg_temp.gid(72000+n),pg_temp.gid(6005),pg_temp.gid(10011),'Explorer saved '||n,3+n from generate_series(1,22) n;
select is((select count(*)::integer from ai.explorer_conversation_compass_item where formation_status is distinct from 'rejected'),24,
  'S5: legacy, confirmed and forming rows share the 24-point storage bound');
select ok(pg_temp.send_suggestions(4,jsonb_build_array(jsonb_build_object('label','Over bound'),
  jsonb_build_object('pointId',(select id from points where name='Family'),'label','Family revised at cap'))),
  'S5: full capacity drops only the new point while reply and forming update save');
select ok(not exists(select 1 from ai.explorer_conversation_compass_item where label='Over bound')
  and exists(select 1 from ai.explorer_conversation_compass_item where label='Family revised at cap'),
  'S5: cap excludes rejected rows and does not stop an in-place wording update');
select throws_ok($$insert into ai.explorer_conversation_compass_item(item_id,conversation_id,source_message_id,label,display_order)
  values(pg_temp.gid(72999),pg_temp.gid(6005),pg_temp.gid(10011),'Extra legacy',26)$$,
  'P0001','solmind_explorer_private_formation_limit','S5: mixed-status cap is also guarded at storage');
rollback to savepoint active_cap;

savepoint rejection_cap;
do $$ declare n integer; item uuid; begin
  for n in 1..23 loop
    if not pg_temp.send_suggestions(100+n,jsonb_build_array(jsonb_build_object('label','Turned down '||n))) then raise exception 'fixture'; end if;
    select item_id into item from ai.explorer_conversation_compass_item where label='Turned down '||n;
    if pg_temp.resolve_point(73000+n,item,'rejected')<>'ok' then raise exception 'fixture'; end if;
  end loop;
end $$;
select is((select count(*)::integer from ai.explorer_conversation_compass_item where formation_status='rejected'),24,'S5: rejected storage has its own fixed bound of 24');
select is(jsonb_array_length(pg_temp.state()->'compassItems'),2,'S5: 24 rejected rows do not consume the visible active limit');
select is(pg_temp.resolve_point(73999,(select id from points where name='Family'),'rejected'),'unavailable','S5: 25th rejection refuses without deleting older private rows');
select is((select formation_status from ai.explorer_conversation_compass_item where item_id=(select id from points where name='Family')),
  'proposed','S5: rejected-cap refusal preserves the proposed point');
insert into ai.explorer_conversation_compass_item(item_id,conversation_id,source_message_id,label,display_order)
  select pg_temp.gid(74000+n),pg_temp.gid(6005),pg_temp.gid(10011),'After rejected '||n,26+n from generate_series(1,22) n;
select is((select count(*)::integer from ai.explorer_conversation_compass_item),48,'S5: 24 retained rejected rows coexist with 24 non-rejected originals');
select is((select max(display_order) from ai.explorer_conversation_compass_item),48,'S5: append ordering remains unique through both bounds');
rollback to savepoint rejection_cap;

savepoint suggestion_gates;
select ok((select dispatch_permitted from pg_temp.prepare_private(4)),'S5: prepare ordinary turn for level 2 gate');
select ok((select saved_reply from pg_temp.settle_private(4,model=>2,suggestions=>'[{"label":"Level two forbidden"}]',
  attention_id=>(select id from points where name='Family'))),
  'S5: level 2 can save ordinary prose');
select ok(not exists(select 1 from ai.explorer_conversation_compass_item where label='Level two forbidden'),'S5: level 2 saves no suggestions');
select ok((pg_temp.state()->>'attentionId')::uuid=(select id from points where name='Work pressure')
  and (select followed_attention_item_id is null from ai.explorer_conversation_operation where operation_id=pg_temp.gid(10040))
  and not exists(select 1 from ai.explorer_conversation_operation where origin_operation_id=pg_temp.gid(10040)),
  'S5: level 2 drops an automatic forming-point move without changing attention or writing Route history');
rollback to savepoint suggestion_gates;
select ok((select dispatch_permitted from pg_temp.prepare_private(4)),'S5: prepare ordinary turn for delivery gate');
select ok((select not saved_reply from pg_temp.settle_private(4,interested=>false,suggestions=>'[{"label":"Canceled delivery"}]')),
  'S5: unwanted delivery cannot save reply or suggestions');
select ok(not exists(select 1 from ai.explorer_conversation_compass_item where label='Canceled delivery'),'S5: canceled delivery leaves no point');
rollback to savepoint suggestion_gates;
-- As in a real Send (and the lifecycle test's classification probe), the phrase check is observed before prepare.
do $$ begin if not exists(select 1 from pg_temp.observe(4,3) where outcome='ok') then raise exception 'fixture'; end if; end $$;
select ok((select dispatch_permitted from pg_temp.prepare_private(4,3)),'S5: classification-only crisis preparation still succeeds');
select ok((select not serialization::jsonb ? 'compassContext' and not (select id from points where name='Family')=any(source_ids)
  from lifecycle_intent where slot=4),'S5: classification-only context omits forming points and their exclusive source IDs');
select ok((select saved_reply from pg_temp.settle_private(4,model=>3,kind=>'urgent',suggestions=>'[{"label":"Restricted forbidden"}]')),
  'S5: trusted support reply saves independently of forbidden suggestions');
select ok(not exists(select 1 from ai.explorer_conversation_compass_item where label='Restricted forbidden'),'S5: restricted reply creates no forming point');
select throws_ok($$select pg_temp.resolve_point(75000,(select id from points where name='Family'),'confirmed')$$,
  'P0001','solmind_explorer_private_denied','S5: restricted reflection cannot confirm forming wording');
rollback to savepoint suggestion_gates;

select ok(not ai.solmind_compass_suggestion_label_valid(repeat('x',161)) and ai.solmind_compass_suggestion_label_valid(repeat('x',160)),
  'S5: suggestion labels use the 160-character bound');
select ok(not ai.solmind_compass_suggestion_label_valid(E'line\nbreak') and not ai.solmind_compass_suggestion_label_valid(U&'hidden\200Btext'),
  'S5: proposed labels cannot poison closed browser or context validation');
select ok(pg_temp.send_suggestions(4,jsonb_build_array(jsonb_build_object('pointId','bad uuid','label','Ignored'),
  jsonb_build_object('label','Sibling valid'),jsonb_build_object('label','Unknown key','extra',true))),
  'S5: malformed ID and unknown entry key are independently absent');
select is((select count(*)::integer from ai.explorer_conversation_compass_item where label in ('Ignored','Sibling valid','Unknown key')),1,
  'S5: only the valid sibling persists');
select * from finish();
rollback;
