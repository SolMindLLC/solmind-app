-- PROPOSAL AUTHORSHIP / ALL CASES UNRUN. Root executes serially in an isolated
-- migration-proof DB only. No shared DB, Auth/browser/provider or real users.
-- The copied synthetic role/topology/methodology fixtures below exercise actual
-- closed SQL governance transitions, but fabricated local screen/classification
-- results are NOT actual AI or human approval/operational-readiness evidence.
-- Sequential alternate-tab calls below are not a real overlap proof; Root must
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
select no_plan();

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
  select jsonb_build_object('version','explorer-compass-context.v3',
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
    else 'wi007-v0.1+onboarding-fields-v2+compass-v3' end,'aiRole','solmind_virtual_guide','actorRoleContext','explorer',
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
create function pg_temp.fail_selected_audit() returns trigger language plpgsql as $$
begin
  if new.event_type=current_setting('solmind.fixture.fail_audit_event',true) then raise exception 'synthetic_audit_failure'; end if;
  return new;
end $$;
create trigger synthetic_private_audit_failure before insert on audit.audit_event
for each row execute function pg_temp.fail_selected_audit();

select ok((select relrowsecurity from pg_class where oid='ai.explorer_safety_evidence'::regclass),'private evidence enables RLS');
select is((select count(*)::integer from pg_policies where schemaname='ai' and tablename='explorer_safety_evidence'),0,'private evidence has no policies');
select ok(not has_table_privilege('anon','ai.explorer_safety_evidence','SELECT')
  and not has_table_privilege('authenticated','ai.explorer_safety_evidence','SELECT')
  and not has_table_privilege('service_role','ai.explorer_safety_evidence','SELECT'), 'no API-role evidence table read');
select is((select count(*)::integer from information_schema.columns where table_schema='ai' and table_name='explorer_safety_evidence'),15,
  'exact minimum evidence fields, no extra lifecycle/text/recipient/count field');
select is((select count(*)::integer from pg_constraint where conrelid='ai.explorer_safety_evidence'::regclass and contype='f' and confdeltype='c'),0,
  'private evidence FKs introduce no cascading delete');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
  and p.proname in ('solmind_read_explorer_conversation_v3','solmind_ensure_explorer_conversation_v3',
    'solmind_observe_explorer_conversation_fallback_v3','solmind_prepare_explorer_conversation_turn_v3',
    'solmind_settle_explorer_conversation_turn_v4','solmind_mutate_explorer_conversation_v3','solmind_confirm_explorer_compass_arrangement_v1',
    'solmind_end_explorer_conversation_v1','solmind_read_ended_explorer_conversations_v1')
  and (p.proname<>'solmind_prepare_explorer_conversation_turn_v3' or p.pronargs=37)
  and p.prosecdef and has_function_privilege('service_role',p.oid,'EXECUTE')
  and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE')),9,
  'exact nine closed definer ports including arrangement and owned ending/review are service-only');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join (values('anon'),('authenticated'),('service_role')) r(role_name)
  where n.nspname='public' and p.proname='solmind_prepare_explorer_conversation_turn_v3' and p.pronargs=36
    and has_function_privilege(r.role_name,p.oid,'EXECUTE')),0,
  'model-less private preparation overload is retired for every API role');
select is((select count(*)::integer from pg_proc p where p.proname in ('solmind_prepare_explorer_conversation_turn',
  'solmind_prepare_governed_explorer_conversation_turn','solmind_complete_explorer_conversation_turn',
  'solmind_prepare_virtual_guide_predispatch','solmind_mutate_explorer_conversation') and has_function_privilege('service_role',p.oid,'EXECUTE')),0,
  'old reflective preparation/completion, direct formation and dormant v1 dispatch capabilities retired for service role');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='ai'
  and (p.proname like 'solmind_private_%_v3' or p.proname in ('solmind_store_private_observation_v3','solmind_raise_private_policy_v3'))
  and has_function_privilege('service_role',p.oid,'EXECUTE')),0,'internal lifecycle helpers are not public capabilities');

-- All governance identities below are actual local SQL fixtures. The screen
-- result and human identities/decisions are deliberately synthetic.
select is(pg_temp.register_version(1001),'ok','synthetic Admin prepares immutable scoped version');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.screen_start(1001)),'synthetic screen receipt prepared, no provider called');
select is(pg_temp.screen_terminal(1001),'ok','fabricated local pass structurally settled');
select is(pg_temp.admin_review(1001),'ok','synthetic Admin consistency transition');
select is(pg_temp.guide_decision(1001),'ok','synthetic owning Guide checklist/approval transition');

select ok((select authority_context->>'authorizationVersion' ~ '^AV3:[0-9A-F]{64}$' and policy_state->'known'='false'::jsonb
  and conversation_state->>'conversationId' is null from public.solmind_read_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50))),
  'pre-anchor read binds no selected conversation and makes no clear observation');
create temp table before_anchor as select authority_context->>'authorizationVersion' token
  from public.solmind_read_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50));
select ok((select outcome='created' and conversation_state->>'conversationId'=pg_temp.gid(6005)::text
  and conversation_state->>'revision'='0' and jsonb_array_length(conversation_state->'messages')=0
  and policy_state='{"known":true,"contractVersion":"explorer-conversation-safety.v1","restrictedLevel":null,"adultReflectionStopped":false,"version":0}'::jsonb
  and authority_context->>'authorizationVersion' ~ '^AV3:[0-9A-F]{64}$' from pg_temp.ensure_anchor()),'first deliberate ensure commits actual empty coherent anchor');
select isnt((select authority_context->>'authorizationVersion' from public.solmind_read_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50))),
  (select token from before_anchor),'AV3 binds newly created identity/policy rather than old absence');
select ok((select outcome='reused' and conversation_state->>'conversationId'=pg_temp.gid(6005)::text from pg_temp.ensure_anchor(6006)),
  'sequential alternate-tab candidate reuses actual existing identity');
select is((select count(*)::integer from ai.ai_interaction_session where actor_user_account_id=pg_temp.gid(1) and session_status='active'),1,
  'one active container survives reuse');
select is((select count(*)::integer from ai.explorer_conversation_operation where conversation_id=pg_temp.gid(6005)),0,'anchor creates no fake send ledger');
select is((select count(*)::integer from ai.ai_model_invocation where ai_interaction_session_id=pg_temp.gid(6005)),0,'anchor creates no invocation');
select ok((select event_type='ai_session_created' and action='create' and reason_code='initial_conversation_anchor'
  and actor_user_account_id=pg_temp.gid(1) and actor_role_context='explorer' and target_entity_type='ai_interaction_session'
  and event_summary='Explorer AI conversation created before first-turn evaluation.'
  and metadata='{"session_type":"explorer_reflection"}'::jsonb and ip_address is null and user_agent is null
  from audit.audit_event where target_entity_id=pg_temp.gid(6005) and event_type='ai_session_created'),'anchor exact audit tuple is minimal and actual');
select is((select count(*)::integer from audit.audit_event where event_type='ai_session_created' and target_entity_id=pg_temp.gid(6005)),1,
  'reuse emits no second creation audit');
set local solmind.fixture.fail_audit_event='ai_session_created';
select throws_ok($$select * from pg_temp.ensure_anchor(6099,4,54)$$,'P0001','synthetic_audit_failure','creation audit failure rolls back anchor');
set local solmind.fixture.fail_audit_event='';
select ok(not exists(select 1 from ai.ai_interaction_session where ai_interaction_session_id=pg_temp.gid(6099))
  and not exists(select 1 from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6099)), 'failed creation left neither session nor state');
select throws_ok($$select * from public.solmind_read_explorer_conversation_v3(pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6005))$$,
  'P0001','solmind_explorer_private_unavailable','foreign actor cannot read actual container');

-- Numerical zero has no row; minor-only has one monotonic policy transition,
-- no ordinary operation or per-message detector record.
select is((select outcome from pg_temp.observe(1)), 'ok','actual configured fallback0 accepted mechanically');
select is((select count(*)::integer from ai.explorer_safety_evidence),0,'fallback0 creates no safety row');
select ok((select outcome='ok' and dispatch_permitted from pg_temp.prepare_private(1)),'clear ordinary exact preparation creates one hypothetical call permission');
create temp table first_prepared as select * from ai.ai_context_snapshot where ai_context_snapshot_id=pg_temp.gid(10012);
select ok((select evidence_contract_version='virtual-guide-predispatch-evidence.v3' and authorization_version ~ '^AV3:[0-9A-F]{64}$'
  and explorer_safety_protocol_version='explorer-safety-reply.v2' and explorer_safety_request_mode='classification_and_reply'
  and explorer_configuration_fingerprint=repeat('A',64) from first_prepared),'v3 snapshot pins AV3/protocol/mode/configuration');
select ok((select outcome='exact_replay' and not dispatch_permitted from pg_temp.prepare_private(1)),'exact prepared replay never redispatches');
select throws_ok($$select * from pg_temp.prepare_private(1,0,false,'Changed actual body')$$,
  'P0001','solmind_explorer_private_operation_conflict','changed prepared body conflicts before source collection');
select throws_ok($$update ai.ai_context_snapshot set explorer_safety_request_mode='classification_only' where ai_context_snapshot_id=pg_temp.gid(10012)$$,
  'P0001','solmind_explorer_conversation_snapshot_immutable','v3 snapshot protocol fields are immutable');
insert into ai.ai_context_snapshot(ai_context_snapshot_id,ai_interaction_session_id,prompt_version)
  values(pg_temp.gid(21990),pg_temp.gid(6005),'synthetic-historical.v1');
select throws_ok($$update ai.ai_context_snapshot set evidence_contract_version='virtual-guide-predispatch-evidence.v3'
  where ai_context_snapshot_id=pg_temp.gid(21990)$$,'P0001','solmind_explorer_conversation_snapshot_immutable',
  'old NULL-contract snapshot cannot be upgraded to v3 even before shape checks');
select throws_ok($$select * from pg_temp.settle_private(1,0,false,'ordinary','Synthetic reply.','completed',true,1::smallint)$$,
  'P0001','solmind_explorer_private_operation_conflict','changed fallback input cannot settle a clear prepared binding');
select ok((select outcome='ok' and saved_reply from pg_temp.settle_private(1)),'observed0 ordinary reply saves once');
select is((select count(*)::integer from ai.explorer_safety_evidence),0,'combined numerical0 has no safety row');
select ok((select outcome='exact_replay' and saved_reply from pg_temp.settle_private(1)),'exact terminal replay writes no second reply');
select throws_ok($$select * from pg_temp.settle_private(1,1)$$,'P0001','solmind_explorer_private_operation_conflict','contradictory terminal observation is not an update');
select is((select count(*)::integer from ai.ai_interaction_message where ai_interaction_session_id=pg_temp.gid(6005)),2,'one original and one reply only');
select throws_ok($$update ai.ai_interaction_message set content_text='Changed original' where ai_interaction_message_id=pg_temp.gid(10011)$$,
  'P0001','solmind_explorer_private_immutable','actual original message stays immutable after preparation');

-- New known/clear formation uses the same locked owner. No model/readiness call.
create temp table formation_intent as select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005);
select is((select outcome from public.solmind_mutate_explorer_conversation_v3(
  pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(21500),(select revision from formation_intent),
  'add_compass',repeat('B',64),pg_temp.gid(10011),null,null,'Synthetic explicit Compass item.')),'ok','known clear explicit formation writes through atomic v3 wrapper');
select is((select outcome from public.solmind_mutate_explorer_conversation_v3(
  pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(21500),(select revision from formation_intent),
  'add_compass',repeat('B',64),pg_temp.gid(10011),null,null,'Synthetic explicit Compass item.')),'exact_replay','exact deliberate formation replay writes nothing again');

-- Both saved section kinds are present before testing any classification cause.
insert into content.waypoint(waypoint_id,guide_explorer_relationship_id,source_ai_interaction_session_id,source_message_id,title,
  destination,why_it_matters,arrival_signal,lifecycle_status,chosen_by_explorer_user_account_id,chosen_at)
  values(pg_temp.gid(21510),pg_temp.gid(25),pg_temp.gid(6005),pg_temp.gid(10011),'Synthetic saved destination',
    'Synthetic saved destination','Synthetic saved meaning','Synthetic saved arrival','chosen',pg_temp.gid(1),now());
create function pg_temp.reduced_snapshot(slot_n integer) returns boolean language sql stable as $$
  select i.mode='classification_only' and i.serialization::jsonb->>'contractVersion'='wi007-v0.1+onboarding-fields-v2'
    and not (i.serialization::jsonb ? 'compassContext') and not (i.source_ids && pg_temp.compass_source_ids())
    and sn.explorer_safety_request_mode=i.mode and sn.context_source_ids=i.source_ids
    and sn.context_fingerprint_sha256=ai.solmind_exclusion_fingerprint_v3(i.serialization)
    and exists(select 1 from unnest(i.source_ids) id where id=pg_temp.gid(52))
    and exists(select 1 from unnest(i.source_ids) id where id=pg_temp.gid(1001))
    and exists(select 1 from unnest(i.source_ids) id where id=pg_temp.gid(10001+slot_n*10))
  from lifecycle_intent i join ai.ai_context_snapshot sn on sn.ai_context_snapshot_id=pg_temp.gid(10002+slot_n*10)
  where i.slot=slot_n
$$;
create function pg_temp.classification_prepare_probe(lvl integer,minor_flag boolean,existing_policy boolean)
returns text language plpgsql as $$
declare prepared record; fallback_level integer:=case when existing_policy then 0 else lvl end;
  fallback_minor boolean:=not existing_policy and minor_flag;
begin
  begin
    if jsonb_array_length(pg_temp.compass_context()->'points')<>1
      or jsonb_array_length(pg_temp.compass_context()->'waypoints')<>1
      then raise exception 'classification_populated_fixture_missing'; end if;
    if existing_policy then
      perform ai.solmind_raise_private_policy_v3(pg_temp.gid(6005),lvl::smallint,minor_flag);
    else
      perform pg_temp.observe(90,lvl,minor_flag);
    end if;
    select * into prepared from pg_temp.prepare_private(90,fallback_level,fallback_minor);
    if prepared.outcome is distinct from 'ok' or prepared.dispatch_permitted is distinct from true
      or pg_temp.reduced_snapshot(90) is distinct from true
      then raise exception 'classification_reduced_prepare_failed'; end if;
    if not exists(select 1 from pg_temp.prepare_private(90,fallback_level,fallback_minor)
      where outcome='exact_replay' and not dispatch_permitted)
      or (select count(*) from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gid(10903))<>1
      then raise exception 'classification_replay_redispatched'; end if;
    raise exception 'classification_prepare_probe_rolled_back';
  exception when raise_exception then
    if sqlerrm<>'classification_prepare_probe_rolled_back' then raise; end if;
  end;
  return 'ok';
end $$;
select is(pg_temp.classification_prepare_probe(3,false,true),'ok','existing level 3 omits saved Compass/Waypoint sources before fingerprinting');
select is(pg_temp.classification_prepare_probe(4,false,true),'ok','existing level 4 prepares reduced exact bytes once');
select is(pg_temp.classification_prepare_probe(0,true,true),'ok','existing adult stop alone prepares reduced exact bytes once');
select is(pg_temp.classification_prepare_probe(3,false,false),'ok','current fallback level 3 prepares reduced exact bytes once');
select is(pg_temp.classification_prepare_probe(4,false,false),'ok','current fallback level 4 prepares reduced exact bytes once');
select is(pg_temp.classification_prepare_probe(0,true,false),'ok','current fallback minor indication prepares reduced exact bytes once');
select ok((select restricted_level is null and not adult_reflection_stopped and pending_operation_id is null
  from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),
  'classification probes roll back their policy, snapshots, messages and operations');

insert into content.trigger_observation(trigger_observation_id,guide_explorer_relationship_id,trigger_label,observation_text,created_by_actor_type)
  values(pg_temp.gid(21000),pg_temp.gid(25),'Synthetic excluded label.','Synthetic excluded private trigger text.','guide');
select ok((select outcome='blocked' and not dispatch_permitted from pg_temp.prepare_private(9,0,false,'Synthetic excluded private trigger text.')),
  'confirmed source exclusion returns normally, allowing its actual audit to commit');
select is((select count(*)::integer from audit.audit_event where event_type='explorer_context_exclusion_violation'
  and target_entity_id=pg_temp.gid(6005)),1,'blocked v3 prepare retained actual exclusion audit');
select ok(not exists(select 1 from ai.explorer_conversation_operation where operation_id=pg_temp.gid(10090))
  and not exists(select 1 from ai.ai_interaction_message where ai_interaction_message_id=pg_temp.gid(10091))
  and not exists(select 1 from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gid(10093)),
  'blocked evaluation saves no attempted body, operation or model evidence');

select is((select outcome from pg_temp.observe(2,1)), 'ok','actual positive fallback retained before model preparation');
select ok((select fallback_level=1 and model_level is null and model_invocation_id is null
  and retention_class='sensitive_content' from ai.explorer_safety_evidence where logical_operation_id=pg_temp.gid(10024)),
  'positive preprepare row is partial, private and has no fake invocation');
select is((select count(*)::integer from ai.explorer_conversation_operation where operation_id=pg_temp.gid(10020)),0,
  'positive preprepare observation creates no ordinary send operation');
select ok((select dispatch_permitted from pg_temp.prepare_private(2,1)),'positive preparation attaches actual references');
select ok((select model_invocation_id=pg_temp.gid(10023) and model_level is null from ai.explorer_safety_evidence
  where logical_operation_id=pg_temp.gid(10024)),'only actual prepared invocation attached');
select ok((select outcome='ok' and not saved_reply from pg_temp.settle_private(2,0,false,'none',null)),
  'valid classification with unusable/no prose settles without a fabricated message');
select ok((select fallback_level=1 and model_level=0 and model_minor_indicated=false from ai.explorer_safety_evidence
  where logical_operation_id=pg_temp.gid(10024)),'observed model0 enriches already-positive row only');
select ok((select request_status='completed' and safety_result='{}'::jsonb and ai_interaction_message_id is null
  and error_summary is null from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gid(10023)),
  'completed classification remains completed invocation, no copied detector payload or false prose/error');

-- An independently observed concern while an ordinary operation is pending
-- represents the concurrency ordering case; real overlap needs Root sessions.
select ok((select dispatch_permitted from pg_temp.prepare_private(3)), 'another ordinary operation prepares');
select lives_ok($$select ai.solmind_store_private_observation_v3(pg_temp.gid(6005),pg_temp.gid(50),pg_temp.gid(19994),
  repeat('C',64),'synthetic-fallback.v1','synthetic-model-policy.v1',3::smallint,false,null,null,null)$$,
  'synthetic independent actual positive raises floor under same state owner');
select ok((select outcome='withheld' and not saved_reply and policy_state->>'restrictedLevel'='3'
  from pg_temp.settle_private(3,1)), 'new restriction withholds stale ordinary reply while preserving own positive');
select ok((select model_level=1 and fallback_level=0 from ai.explorer_safety_evidence where logical_operation_id=pg_temp.gid(10034)),
  'stale output withholding does not erase actual model positive');
select ok((select outcome='ok' and conversation_state is not null and policy_state->>'restrictedLevel'='3'
  from public.solmind_read_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005))),
  'owned restricted conversation stays recoverable');
select ok((select dispatch_permitted from pg_temp.prepare_private(4)), 'restricted healthy message still requires a prepared classification-only call');
select is((select safety_request_mode from ai.explorer_conversation_operation where operation_id=pg_temp.gid(10040)),
  'classification_only','prior restriction selects classification-only mode');
select ok(pg_temp.reduced_snapshot(4),'restricted snapshot pins only the reduced serialization fingerprint and retained source ids');
select throws_ok($$update ai.ai_context_snapshot set context_source_ids=context_source_ids||pg_temp.gid(21510)
  where ai_context_snapshot_id=pg_temp.gid(10042)$$,'P0001','solmind_explorer_conversation_snapshot_immutable',
  'classification-only snapshot cannot be enriched with an omitted Waypoint source');
select throws_ok($$update ai.ai_context_snapshot set context_fingerprint_sha256=repeat('F',64)
  where ai_context_snapshot_id=pg_temp.gid(10042)$$,'P0001','solmind_explorer_conversation_snapshot_immutable',
  'classification-only exact fingerprint stays immutable');
select ok((select outcome='exact_replay' and not dispatch_permitted from pg_temp.prepare_private(1)),
  'historical ordinary full-envelope preparation replays under current restriction without new inspection or dispatch');
select is((select to_jsonb(sn) from ai.ai_context_snapshot sn where ai_context_snapshot_id=pg_temp.gid(10012)),
  (select to_jsonb(sn) from first_prepared sn),'classification scope change does not rewrite historical ordinary evidence');

select ok((select saved_reply from pg_temp.settle_private(4,0,false,'restricted','Synthetic reviewed support fixture.')),
  'synthetic trusted restricted response can save after required classification');

-- Raise only the persistent floor, then use CURRENT level3 trusted intent.
select lives_ok($$select ai.solmind_store_private_observation_v3(pg_temp.gid(6005),pg_temp.gid(50),pg_temp.gid(19995),
  repeat('F',64),'synthetic-fallback.v1','synthetic-model-policy.v1',4::smallint,false,null,null,null)$$,'synthetic actual separate concern raises retained floor4');
select ok((select dispatch_permitted from pg_temp.prepare_private(7)), 'floor4 still requires a fresh classification-only message');
select ok((select saved_reply and policy_state->>'restrictedLevel'='4' from pg_temp.settle_private(7,3,false,'urgent','Synthetic current urgent trusted response.')),
  'current level3 urgent response can save while prior floor4 remains monotonic');
select throws_ok($$select * from public.solmind_mutate_explorer_conversation_v3(
  pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(21501),0,'add_compass',repeat('B',64),pg_temp.gid(10011),null,null,'Held Compass item.')$$,
  'P0001','solmind_explorer_private_denied','actual current restricted policy blocks new deliberate formation');
select is((select outcome from public.solmind_mutate_explorer_conversation_v3(
  pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),pg_temp.gid(21500),(select revision from formation_intent),
  'add_compass',repeat('B',64),pg_temp.gid(10011),null,null,'Synthetic explicit Compass item.')),'exact_replay','restriction does not erase an exact prior formation replay');

create temp table before_minor as select authority_context->>'authorizationVersion' token
  from public.solmind_read_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005));
set local solmind.fixture.fail_audit_event='ai_session_state_changed';
select throws_ok($$select * from pg_temp.observe(5,0,true)$$,'P0001','synthetic_audit_failure','minor-only state and audit roll back together');
set local solmind.fixture.fail_audit_event='';
select ok((select not adult_reflection_stopped from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),
  'failed state audit did not leave an unaudited adult stop');
select ok((select policy_state->'adultReflectionStopped'='true'::jsonb from pg_temp.observe(5,0,true)),
  'minor-only0 sets the separate monotonic adult policy');
select ok(not exists(select 1 from ai.explorer_safety_evidence where logical_operation_id=pg_temp.gid(10054)),
  'minor-only0 creates no safety evidence row');
select ok(not exists(select 1 from ai.explorer_conversation_operation where operation_id=pg_temp.gid(10050)),
  'minor-only state transition creates no per-message send ledger');
select isnt((select authority_context->>'authorizationVersion' from public.solmind_read_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005))),
  (select token from before_minor),'AV3 changes with monotonic adult-state transition');
create temp table policy_audit_count as select count(*)::integer n from audit.audit_event where event_type='ai_session_state_changed';
select lives_ok($$select * from pg_temp.observe(5,0,true)$$,'already true adult stop is a no-op');
select is((select count(*)::integer from audit.audit_event where event_type='ai_session_state_changed'),(select n from policy_audit_count),
  'minor-only replay emits no duplicate policy audit');
select throws_ok($$update ai.explorer_conversation_state set adult_reflection_stopped=false where conversation_id=pg_temp.gid(6005)$$,
  'P0001','solmind_explorer_private_immutable','adult stop cannot clear');
select throws_ok($$update ai.explorer_conversation_state set restricted_level=null where conversation_id=pg_temp.gid(6005)$$,
  'P0001','solmind_explorer_private_immutable','restriction cannot clear');
select throws_ok($$update ai.explorer_conversation_state set safety_contract_version=null,restricted_level=null,
  adult_reflection_stopped=null,safety_version=null where conversation_id=pg_temp.gid(6005)$$,
  'P0001','solmind_explorer_private_immutable','known state cannot become legacy unknown');

select ok((select dispatch_permitted from pg_temp.prepare_private(8)), 'adult-stop plus retained floor4 still prepares classification-only');
select ok((select saved_reply and policy_state->>'restrictedLevel'='4' and policy_state->'adultReflectionStopped'='true'::jsonb
  from pg_temp.settle_private(8,0,false,'adult_only','Synthetic age-appropriate help and adult policy response.')),
  'current0 adult-policy trusted response saves without erasing earlier crisis floor');
select ok((select dispatch_permitted from pg_temp.prepare_private(6)), 'owned classification-only operation prepares before logout');
update identity.user_session set session_status='logged_out',ended_at=clock_timestamp() where user_session_id=pg_temp.gid(50);
select ok((select outcome='ok' and not saved_reply and conversation_state is null and policy_state is null
  from pg_temp.settle_private(6,4,true,'none',null)), 'technical settlement after logout preserves positive but returns/saves no private response');
select ok((select model_level=4 and model_minor_indicated from ai.explorer_safety_evidence where logical_operation_id=pg_temp.gid(10064)),
  'actual accepted urgent model observation survives logout');
select ok((select restricted_level=4 and adult_reflection_stopped and pending_operation_id is null
  from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)), 'floor raises and pending state settles after logout');
select ok((select request_status='completed' and safety_result='{}'::jsonb from ai.ai_model_invocation where ai_model_invocation_id=pg_temp.gid(10063)),
  'actual complete classification is completed even without delivery');
select throws_ok($$select * from public.solmind_read_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005))$$,
  'P0001','solmind_explorer_conversation_denied','ended login cannot read private state');

-- Minimal audit vocabulary contains no safety category, level, minor/mode,
-- copied text or hashes. Protected private targets remain non-routine.
select ok(not exists(select 1 from audit.audit_event where event_type in ('protected_ai_record_created','protected_ai_record_enriched','ai_session_state_changed')
  and (actor_user_account_id is not null or actor_role_context<>'system' or metadata<>'{}'::jsonb or ip_address is not null or user_agent is not null)),
  'all private evidence/policy audit rows have exact blank content-free fields');
select ok(exists(select 1 from audit.audit_event where event_type='protected_ai_record_created'
  and target_entity_type='protected_ai_record' and action='create' and reason_code='protected_record_created'
  and event_summary='Protected AI operation record created.'), 'generic creation accountability tuple');
select ok(exists(select 1 from audit.audit_event where event_type='protected_ai_record_enriched'
  and target_entity_type='protected_ai_record' and action='update' and reason_code='protected_record_enriched'
  and event_summary='Protected AI operation record enriched.'), 'generic enrichment accountability tuple');
select ok(exists(select 1 from audit.audit_event where event_type='ai_session_state_changed'
  and target_entity_type='ai_interaction_session' and action='update' and reason_code='protected_state_changed'
  and event_summary='Protected conversation state changed.'), 'generic state-change accountability tuple');
set local solmind.fixture.fail_audit_event='protected_ai_record_created';
select throws_ok($$select ai.solmind_store_private_observation_v3(pg_temp.gid(6005),pg_temp.gid(50),pg_temp.gid(29994),
  repeat('E',64),'synthetic-fallback.v1','synthetic-model-policy.v1',1::smallint,false,null,null,null)$$,
  'P0001','synthetic_audit_failure','positive evidence and its creation audit roll back together');
set local solmind.fixture.fail_audit_event='';
select ok(not exists(select 1 from ai.explorer_safety_evidence where logical_operation_id=pg_temp.gid(29994)),
  'failed evidence audit left no unaudited positive row');
select throws_ok($$insert into ai.explorer_safety_evidence(conversation_id,origin_application_session_id,logical_operation_id,command_fingerprint,
  evidence_protocol_version,fallback_policy_version,model_policy_version,fallback_level,fallback_minor_indicated)
  values(pg_temp.gid(6005),pg_temp.gid(50),pg_temp.gid(29000),repeat('D',64),'explorer-minimum-safety.v1',
    'synthetic-fallback.v1','synthetic-model-policy.v1',0,true)$$,'23514',null,'table independently refuses numerical0/minor-only safety row');
select throws_ok($$delete from ai.explorer_safety_evidence where logical_operation_id=pg_temp.gid(10024)$$,
  'P0001','solmind_explorer_private_immutable','no hidden evidence purge');
select throws_ok($$update ai.explorer_safety_evidence set model_level=2 where logical_operation_id=pg_temp.gid(10024)$$,
  'P0001','solmind_explorer_private_evidence_conflict','accepted model component is once-only');

-- Another Explorer's pre-existing container remains UNKNOWN. No backfill.
insert into ai.ai_interaction_session(ai_interaction_session_id,session_type,actor_user_account_id,actor_role_context,
  guide_profile_id,explorer_profile_id,guide_explorer_relationship_id,practice_id)
  values(pg_temp.gid(6090),'explorer_reflection',pg_temp.gid(4),'explorer',pg_temp.gid(23),pg_temp.gid(26),pg_temp.gid(27),pg_temp.gid(22));
insert into ai.explorer_conversation_state(conversation_id,actor_user_account_id) values(pg_temp.gid(6090),pg_temp.gid(4));
select ok((select policy_state->'known'='false'::jsonb and conversation_state->>'conversationId'=pg_temp.gid(6090)::text
  from public.solmind_read_explorer_conversation_v3(pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6090))),
  'legacy owned history readable with explicit UNKNOWN policy');
select ok((select outcome='held' and policy_state->'known'='false'::jsonb from pg_temp.ensure_anchor(6091,4,54)),
  'ensure preserves old unknown container, does not create replacement');
select throws_ok($$update ai.explorer_conversation_state set safety_contract_version='explorer-conversation-safety.v1',
  adult_reflection_stopped=false,safety_version=0 where conversation_id=pg_temp.gid(6090)$$,
  'P0001','solmind_explorer_private_legacy_unknown','legacy row cannot be repaired to clear');

set constraints all immediate;
select * from finish();
rollback;
