-- Turned-down limit state projection. Synthetic rollback-only SQL fixture.
-- The Executor runs this in an isolated migration-proof database; no provider I/O.
-- Authority, methodology and turn helpers follow explorer_compass_suggestion_replies_test.sql.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,pg_catalog,pg_temp;
set local statement_timeout='120s';
select plan(23);

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
create function pg_temp.compass_context() returns jsonb language sql stable as $$
  with forming_move as (select ai.solmind_forming_attention_move_v1(pg_temp.gid(6005)) as value),
  moves as (
    select o.kind,o.completed_at,o.compass_route_kind,o.compass_route_item_id,o.initial_revision,o.operation_id
    from ai.explorer_conversation_operation o where o.conversation_id=pg_temp.gid(6005) and o.compass_route_kind='attention_changed'
    union all
    select 'set_attention',(value->>'recordedAt')::timestamptz,'attention_changed',(value->>'pointId')::uuid,
      (value->>'revision')::integer-1,null::uuid from forming_move where value is not null
  )
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

-- Pin the complete pre-change serializer, including nested fields, on the same
-- stored data. Only the new boolean may differ from the S6a projection.
create function pg_temp.previous_state(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('version','explorer-conversation.v1','conversationId',p_id,
    'revision',coalesce(s.revision,0),'providerState','unavailable',
    'pendingTurn',s.pending_operation_id is not null,
    'sessionStatus',session_row.session_status,
    'ending',(select jsonb_build_object('operationId',e.operation_id,'revision',e.initial_revision+1,
      'endedAt',e.completed_at,'directionsTaken',e.ending_directions_text,'routeThroughRevision',e.ending_route_revision)
      from ai.explorer_conversation_operation e where e.conversation_id=p_id and e.kind='end_conversation' and e.status='completed'),
    'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.ai_interaction_message_id,
      'role',case when m.sender_type='user' then 'explorer' else 'virtualGuide' end,
      'body',m.content_text,'createdAt',m.created_at)
      || case when m.explorer_reply_choices is null then '{}'::jsonb else jsonb_build_object('choices',m.explorer_reply_choices) end
      order by m.sequence_number)
      from ai.ai_interaction_message m where m.ai_interaction_session_id=p_id and m.sender_type in ('user','ai')),'[]'::jsonb),
    'compassItems',coalesce((select jsonb_agg(jsonb_build_object('id',c.item_id,'sourceMessageId',c.source_message_id,
      'label',c.label,'anchor',c.compass_anchor,'emphasis',c.relative_emphasis,'mergedIntoItemId',c.merged_into_item_id,'formation',case when c.formation_status='proposed' then 'forming' else 'saved' end)
      || case when c.formation_status='proposed' then jsonb_build_object('wordingMessageId',c.wording_message_id) else '{}'::jsonb end
      order by c.display_order) from ai.explorer_conversation_compass_item c where c.conversation_id=p_id and c.formation_status is distinct from 'rejected'),'[]'::jsonb),
    'priorityId',s.priority_id,'attentionId',s.attention_id,
    'route',coalesce((select jsonb_agg(case when o.compass_route_kind='category_confirmed' then
      jsonb_build_object('operationId',o.operation_id,'revision',o.initial_revision+1,'kind',o.compass_route_kind,
        'change',o.compass_category_change,'recordedAt',o.completed_at)
      when o.compass_route_kind='arrangement_confirmed' then
      jsonb_build_object('operationId',o.operation_id,'revision',o.initial_revision+1,'kind',o.compass_route_kind,
        'previousPriorityId',o.compass_arrangement->'previousPriorityId','priorityId',o.compass_arrangement->'priorityId',
        'items',o.compass_arrangement->'items','recordedAt',o.completed_at)
      else jsonb_build_object('operationId',o.operation_id,
        'revision',o.initial_revision+1,'kind',o.compass_route_kind,'compassItemId',o.compass_route_item_id,
        'label',o.compass_route_label,'recordedAt',o.completed_at)
        || case when o.compass_route_kind='attention_changed' then jsonb_build_object('actor',
          case when o.kind='follow_attention' then 'virtual_guide' else 'explorer' end) else '{}'::jsonb end
      end order by o.initial_revision,o.operation_id)
      from ai.explorer_conversation_operation o where o.conversation_id=p_id and o.compass_route_kind is not null),'[]'::jsonb),
    'waypoints',coalesce((select jsonb_agg(jsonb_build_object('id',w.waypoint_id,'sourceMessageId',w.source_message_id,
      'destination',w.destination,'meaning',w.why_it_matters,'arrivalSignal',w.arrival_signal,
      'status',w.lifecycle_status,'reachedEvidence',w.reached_evidence,'reachedAt',w.reached_at)
      || case when w.released_at is null then '{}'::jsonb else jsonb_build_object('release',
        jsonb_build_object('operationId',w.released_operation_id,'releasedAt',w.released_at)) end
      || case when w.predecessor_waypoint_id is null then '{}'::jsonb else jsonb_build_object('lifecycle',
        jsonb_build_object('predecessorWaypointId',w.predecessor_waypoint_id,'creationReason',w.creation_reason,
          'clarifications',coalesce((select jsonb_agg(jsonb_build_object('component',c.component,'questionKey',c.question_key,
            'answer',c.answer_text,'recordedAt',c.created_at) order by case c.component when 'destination' then 1 when 'meaning' then 2 else 3 end)
            from content.waypoint_clarification c where c.waypoint_id=w.waypoint_id),'[]'::jsonb))) end
      order by w.created_at,w.waypoint_id)
      from content.waypoint w where w.source_ai_interaction_session_id=p_id),'[]'::jsonb))
  from (select 1) anchor left join ai.explorer_conversation_state s on s.conversation_id=p_id
    left join ai.ai_interaction_session session_row on session_row.ai_interaction_session_id=s.conversation_id
$$;

select ok((select p.proowner='postgres'::regrole and p.prosecdef and p.provolatile='s'
    and p.proconfig=array['search_path=""'] and p.pronargs=1 and p.prorettype='jsonb'::regtype
    from pg_proc p where p.oid='ai.solmind_conversation_state_json(uuid)'::regprocedure),
  'TDL01: state helper retains owner, security, stability, search path and signature');
select ok(not has_function_privilege('anon','ai.solmind_conversation_state_json(uuid)','EXECUTE')
    and not has_function_privilege('authenticated','ai.solmind_conversation_state_json(uuid)','EXECUTE')
    and not has_function_privilege('service_role','ai.solmind_conversation_state_json(uuid)','EXECUTE')
    and not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
      where p.oid='ai.solmind_conversation_state_json(uuid)'::regprocedure and acl.grantee=0 and acl.privilege_type='EXECUTE'),
  'TDL02: no API role or PUBLIC gains direct state access');
select is(ai.solmind_conversation_state_json(null),
  pg_temp.previous_state(null)||jsonb_build_object('turnedDownLimitReached',false),
  'TDL03: blank Discovery adds exactly a false boolean');

-- Real command owners create each rejected row; no trigger is bypassed.
do $$ declare n integer; point_id uuid; begin
  for n in 1..23 loop
    if not pg_temp.send_suggestions(n,jsonb_build_array(jsonb_build_object('label','Turned down '||n))) then raise exception 'fixture'; end if;
    select item_id into point_id from ai.explorer_conversation_compass_item
      where conversation_id=pg_temp.gid(6005) and label='Turned down '||n;
    if pg_temp.answer(73000+n,point_id,'not_it')<>'ok' then raise exception 'fixture'; end if;
  end loop;
end $$;
select is((select count(*)::integer from ai.explorer_conversation_compass_item
    where conversation_id=pg_temp.gid(6005) and formation_status='rejected'),23,
  'TDL04: fixture retains 23 rejected rows');
select is(pg_temp.state()->'turnedDownLimitReached','false'::jsonb,
  'TDL05: 23 rejected rows do not reach the limit');
select is(pg_temp.state()-'turnedDownLimitReached',pg_temp.previous_state(pg_temp.gid(6005)),
  'TDL06: at 23 every prior state field is unchanged');
select is((select conversation_state from public.solmind_read_explorer_conversation_v3(
    pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005))),pg_temp.state(),
  'TDL07: the authorized private read retains the full state contract');
select throws_ok($$select * from public.solmind_read_explorer_conversation_v3(
    pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6005))$$,
  'P0001','solmind_explorer_private_unavailable','TDL08: another Explorer cannot read the below-limit flag');

do $$ declare point_id uuid; begin
  if not pg_temp.send_suggestions(24,'[{"label":"Turned down 24"}]') then raise exception 'fixture'; end if;
  select item_id into point_id from ai.explorer_conversation_compass_item
    where conversation_id=pg_temp.gid(6005) and label='Turned down 24';
  if pg_temp.answer(73024,point_id,'not_it')<>'ok' then raise exception 'fixture'; end if;
end $$;
select is((select count(*)::integer from ai.explorer_conversation_compass_item
    where conversation_id=pg_temp.gid(6005) and formation_status='rejected'),24,
  'TDL09: fixture reaches the trigger existing 24-row rejection cap');
select is(pg_temp.state()->'turnedDownLimitReached','true'::jsonb,
  'TDL10: 24 rejected rows reach the limit');
select is(pg_temp.state()-'turnedDownLimitReached',pg_temp.previous_state(pg_temp.gid(6005)),
  'TDL11: at 24 every prior state field is unchanged and no extra count appears');
select ok(not exists(select 1 from ai.explorer_conversation_compass_item c
    where c.conversation_id=pg_temp.gid(6005) and c.formation_status='rejected'
      and (position(c.item_id::text in pg_temp.state()::text)>0 or position(c.label in pg_temp.state()::text)>0)),
  'TDL12: no rejected point id or label leaks into saved conversation state');
select is((select conversation_state from public.solmind_read_explorer_conversation_v3(
    pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005))),pg_temp.state(),
  'TDL13: the authorized read carries the true flag and unchanged remaining fields');
select is((select conversation_state from public.solmind_read_explorer_conversation_v3(pg_temp.gid(4),pg_temp.gid(54))),
  pg_temp.previous_state(null)||jsonb_build_object('turnedDownLimitReached',false),
  'TDL14: another Explorer empty Discovery does not inherit the limit');
select throws_ok($$select * from public.solmind_read_explorer_conversation_v3(
    pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6005))$$,
  'P0001','solmind_explorer_private_unavailable','TDL15: another Explorer cannot read the at-limit conversation');
do $$ begin
  if not exists(select 1 from pg_temp.ensure_anchor(6006,4,54) where outcome='created') then raise exception 'fixture'; end if;
end $$;
select is((select conversation_state from public.solmind_read_explorer_conversation_v3(
    pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6006))),
  pg_temp.previous_state(pg_temp.gid(6006))||jsonb_build_object('turnedDownLimitReached',false),
  'TDL16: another owned conversation counts only its own rejected rows');
select is(pg_temp.state()->'turnedDownLimitReached','true'::jsonb,
  'TDL17: another conversation leaves the first conversation limit unchanged');

do $$ begin
  if not pg_temp.send_suggestions(25,'[{"label":"Still forming"}]') then raise exception 'fixture'; end if;
end $$;
create temp table before_refusal as select pg_temp.state() state,
  (select count(*) from ai.explorer_conversation_operation) operations;
select is(pg_temp.answer(73999,(select item_id from ai.explorer_conversation_compass_item
    where conversation_id=pg_temp.gid(6005) and label='Still forming'),'not_it'),'operation_conflict',
  'TDL18: a racing button rejection still receives the existing definite conflict');
select ok(pg_temp.state()=(select state from before_refusal)
    and (select count(*) from ai.explorer_conversation_operation)=(select operations from before_refusal),
  'TDL19: the server limit refusal changes no state and records no operation');
select is(pg_temp.state()-'turnedDownLimitReached',pg_temp.previous_state(pg_temp.gid(6005)),
  'TDL20: the nonempty forming-point projection retains every previous field');

select is((select outcome from public.solmind_end_explorer_conversation_v1(pg_temp.gid(1),pg_temp.gid(50),
    pg_temp.gid(6005),pg_temp.gid(74000),(pg_temp.state()->>'revision')::integer,pg_temp.request_sha(74000))),
  'ok','TDL21: ending the at-limit conversation retains its normal command contract');
select is((select conversation_state from public.solmind_read_ended_explorer_conversations_v1(
    pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005))),
  pg_temp.previous_state(pg_temp.gid(6005))||jsonb_build_object('turnedDownLimitReached',true),
  'TDL22: owned ended review adds only the same limit boolean');
select throws_ok($$select * from public.solmind_read_ended_explorer_conversations_v1(
    pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6005))$$,
  'P0001','solmind_explorer_conversation_denied','TDL23: another Explorer cannot read the ended limit state');
select * from finish();
rollback;
