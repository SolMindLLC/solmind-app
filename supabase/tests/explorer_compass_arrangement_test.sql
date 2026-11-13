-- Focused explicit Compass arrangement, emphasis and Other paths proof.
-- Synthetic disposable-project SQL only; no retained demo data or provider calls.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,pg_catalog,pg_temp;
set local statement_timeout='120s';
select plan(102);

create function pg_temp.gid(n integer) returns uuid language sql immutable as $$
  select ('f42b0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
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
create function pg_temp.screen_start(n integer,op_n integer default null,sha_override text default null,selected_model text default 'gpt-5.6-luna')
returns table(outcome text,dispatch_permitted boolean) language sql as $$
  select r.outcome,r.dispatch_permitted from public.solmind_prepare_methodology_screen(pg_temp.gid(3),pg_temp.gid(57),
    pg_temp.gid(coalesce(op_n,n+2000)),pg_temp.gid(1000),pg_temp.gid(n),pg_temp.gid(n+3000),
    coalesce(sha_override,pg_temp.sha(n)),'synthetic-screen-policy.v1',repeat('B',64),pg_temp.request_sha(n),selected_model) r
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
-- REV391 (2026-11-11): conversation 6005 is a legacy-mode conversation (its rejected and forming rows are
-- historical), so the section is the v8 legacy envelope: mode legacy_read_only, zero capacity, no topics, a null
-- priorityId, no forming points, attention only when it names a supplied point (explorer_source_exclusion_test.sql).
-- This fixture records no needle moves, so the Route is empty.
create function pg_temp.compass_context() returns jsonb language sql stable as $$
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
    'attentionId',(select s.attention_id from ai.explorer_conversation_state s where s.conversation_id=pg_temp.gid(6005)
      and exists(select 1 from ai.explorer_conversation_compass_item c where c.item_id=s.attention_id
        and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' and c.formation_status is distinct from 'proposed')),
    'recentRoute',case when exists(select 1 from ai.explorer_conversation_operation o where o.conversation_id=pg_temp.gid(6005)
      and (o.compass_route_kind is not null or o.followed_attention_item_id is not null)) then null else '[]'::jsonb end,
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
create function pg_temp.context_value(msg uuid,body text) returns jsonb language sql stable as $$
  select jsonb_build_object('contractVersion','wi007-v0.1+onboarding-fields-v2+compass-v8','aiRole','solmind_virtual_guide','actorRoleContext','explorer',
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
    'compassContext',pg_temp.compass_context(),
    'currentSessionMessages',coalesce((select jsonb_agg(jsonb_build_object('messageId',h.ai_interaction_message_id,'order',h.ord-1,
      'explorerId',pg_temp.gid(24),'sessionId',pg_temp.gid(6005),
      'role',case when h.sender_type='user' then 'explorer' else 'solmind_virtual_guide' end,
      'content',ai.solmind_exclusion_normalize_v3(h.content_text)) order by h.ord)
      from (select x.*,row_number() over(order by x.sequence_number) as ord from (select * from ai.ai_interaction_message
        where ai_interaction_session_id=pg_temp.gid(6005) order by sequence_number desc limit 24) x) h),'[]'::jsonb),
    'immediateExplorerMessage',jsonb_build_object('messageId',msg,'explorerId',pg_temp.gid(24),
      'sessionId',pg_temp.gid(6005),'role','explorer','content',body),
    'outputRequirements',jsonb_build_object('format','plain_text','includeCitations',false,'allowMarkdown',false))
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
  body_override text default null,selected_model text default 'gpt-5.6-luna')
returns table(outcome text,conversation_state jsonb,dispatch_permitted boolean,policy_state jsonb)
language plpgsql as $$
declare saved lifecycle_intent%rowtype; a jsonb; policy jsonb; e jsonb; msg uuid:=pg_temp.gid(10001+slot_n*10);
  src uuid[]; c text; b text:=coalesce(body_override,'Synthetic private message '||slot_n||'.');
begin
  select * into saved from lifecycle_intent where slot=slot_n;
  if not found then
    select r.authority_context,r.policy_state into a,policy from public.solmind_read_explorer_conversation_v3(
      pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005)) r;
    e:=methodology.resolve_effective(pg_temp.gid(1000),pg_temp.gid(23));
    c:=pg_temp.compact(pg_temp.context_value(msg,b));
    select array_agg(distinct id order by id) into src from (
      select unnest(array[pg_temp.gid(52),msg,pg_temp.gid(1001)]) id union all
      select m.ai_interaction_message_id from (select * from ai.ai_interaction_message
        where ai_interaction_session_id=pg_temp.gid(6005) order by sequence_number desc limit 24) m
      union all select x from unnest(pg_temp.compass_source_ids()) x
    ) selected;
    insert into lifecycle_intent values(slot_n,(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005)),
      b,c,src,a->>'authorizationVersion',(policy->>'version')::bigint,
      case when policy->>'restrictedLevel' is not null or (policy->>'adultReflectionStopped')::boolean or lvl>=3 or minor_flag
        then 'classification_only' else 'classification_and_reply' end,lvl,minor_flag,e->>'contentSha256',e->>'methodologyAuthorizationVersion');
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
    saved.safety_version,saved.fallback,saved.minor,selected_model);
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

-- Establish the existing synthetic governed source fixture. No provider is called;
-- the recorded screen/reply below are SQL protocol fixtures, not human/AI proof.
do $$ begin
  if pg_temp.register_version(1001) is distinct from 'ok' then raise exception 'synthetic_formation_register_failed'; end if;
  if not exists(select 1 from pg_temp.screen_start(1001) where outcome='ok' and dispatch_permitted) then raise exception 'synthetic_formation_screen_prepare_failed'; end if;
  if pg_temp.screen_terminal(1001) is distinct from 'ok' then raise exception 'synthetic_formation_screen_terminal_failed'; end if;
  if pg_temp.admin_review(1001) is distinct from 'ok' then raise exception 'synthetic_formation_admin_failed'; end if;
  if pg_temp.guide_decision(1001) is distinct from 'ok' then raise exception 'synthetic_formation_guide_failed'; end if;
  if not exists(select 1 from pg_temp.ensure_anchor(6004) where outcome='created') then raise exception 'synthetic_formation_anchor_failed'; end if;
end $$;
-- REV391 (2026-11-11): manual Compass points, Priority, arrangement and category operations exist only from before
-- automatic Compass, so conversation 6005 is a legacy-mode conversation: a privileged rollback-only copy of the
-- freshly created owned conversation 6004 (session and state rows), as in explorer_automatic_compass_test.sql.
insert into ai.ai_interaction_session select (jsonb_populate_record(null::ai.ai_interaction_session,
  to_jsonb(s)||jsonb_build_object('ai_interaction_session_id',pg_temp.gid(6005)))).*
  from ai.ai_interaction_session s where s.ai_interaction_session_id=pg_temp.gid(6004);
insert into ai.explorer_conversation_state select (jsonb_populate_record(null::ai.explorer_conversation_state,
  to_jsonb(s)||jsonb_build_object('conversation_id',pg_temp.gid(6005),'compass_mode','legacy'))).*
  from ai.explorer_conversation_state s where s.conversation_id=pg_temp.gid(6004);
do $$ begin
  if not exists(select 1 from pg_temp.prepare_private(1) where outcome='ok' and dispatch_permitted) then raise exception 'synthetic_formation_prepare_failed'; end if;
  if not exists(select 1 from pg_temp.settle_private(1) where outcome='ok' and saved_reply) then raise exception 'synthetic_formation_settle_failed'; end if;
end $$;

create function pg_temp.mutate(op_n integer,kind_name text,source_n integer default null,
  item_n integer default null,waypoint_n integer default null,label_text text default null,
  destination_text text default null,meaning_text text default null,arrival_text text default null,
  evidence_text text default null,revision_override integer default null)
returns table(outcome text,conversation_state jsonb) language sql as $$
  select * from public.solmind_mutate_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(op_n),coalesce(revision_override,
      (select initial_revision from ai.explorer_conversation_operation where actor_user_account_id=pg_temp.gid(1) and operation_id=pg_temp.gid(op_n)),
      (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005))),
    kind_name,pg_temp.request_sha(op_n),case when source_n is null then null else pg_temp.gid(source_n) end,
    case when item_n is null then null else pg_temp.gid(item_n) end,
    case when waypoint_n is null then null else pg_temp.gid(waypoint_n) end,
    label_text,destination_text,meaning_text,arrival_text,evidence_text)
$$;
create function pg_temp.read_state() returns jsonb language sql as $$
  select conversation_state from public.solmind_read_explorer_conversation_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005))
$$;
create temp table invocation_before as select count(*)::integer n from ai.ai_model_invocation;
-- REV391 (2026-11-11): manual Compass commands are retired, so every earlier manual Compass operation in this
-- file is a privileged historical fixture: the operation row exactly as its owner stored it (request fingerprint
-- formulas of the latest prior owners, 20261106000000_explorer_waypoint_active_limits.sql for the mutation and
-- 20261105010000_explorer_forming_compass_points.sql for arrangement and category, unchanged by REV391) and the
-- stored effect it had. Direct writes happen only here; only the formation guard is suspended, and only around a
-- point INSERT or a wording UPDATE, restored before any assertion.
create function pg_temp.historical_mutation(op_n integer,kind_name text,source_n integer default null,
  item_n integer default null,label_text text default null,conv_n integer default 6005) returns void language plpgsql as $$
declare st ai.explorer_conversation_state%rowtype; route_kind text; route_label text;
begin
  select * into st from ai.explorer_conversation_state where conversation_id=pg_temp.gid(conv_n);
  if kind_name='add_compass' then
    alter table ai.explorer_conversation_compass_item disable trigger explorer_compass_formation_guard;
    insert into ai.explorer_conversation_compass_item(item_id,conversation_id,source_message_id,label,display_order)
      values(pg_temp.gid(op_n),pg_temp.gid(conv_n),pg_temp.gid(source_n),label_text,
        (select coalesce(max(c.display_order),0)+1 from ai.explorer_conversation_compass_item c where c.conversation_id=pg_temp.gid(conv_n)));
    alter table ai.explorer_conversation_compass_item enable trigger explorer_compass_formation_guard;
  elsif kind_name='confirm_priority' then
    if st.priority_id is distinct from pg_temp.gid(item_n) then
      route_kind:=case when st.priority_id is null then 'priority_confirmed' else 'priority_reoriented' end;
      select c.label into route_label from ai.explorer_conversation_compass_item c where c.item_id=pg_temp.gid(item_n);
    end if;
    update ai.explorer_conversation_state set priority_id=pg_temp.gid(item_n) where conversation_id=pg_temp.gid(conv_n);
  else raise exception 'fixture_kind'; end if;
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
    conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,
    compass_route_kind,compass_route_item_id,compass_route_label)
  values(pg_temp.gid(case when conv_n=6105 then 4 else 1 end),pg_temp.gid(op_n),pg_temp.gid(case when conv_n=6105 then 54 else 50 end),pg_temp.gid(conv_n),kind_name,
    upper(encode(extensions.digest(convert_to(jsonb_build_array(pg_temp.gid(case when conv_n=6105 then 54 else 50 end),pg_temp.gid(conv_n),st.revision,
      kind_name,case when source_n is null then null else pg_temp.gid(source_n) end,
      case when item_n is null then null else pg_temp.gid(item_n) end,null::uuid,label_text,null::text,null::text,null::text,null::text,
      pg_temp.request_sha(op_n))::text,'UTF8'),'sha256'),'hex')),
    pg_temp.request_sha(op_n),st.revision,'completed',clock_timestamp(),
    route_kind,case when route_kind is null then null else pg_temp.gid(item_n) end,route_label);
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=pg_temp.gid(conv_n);
  update ai.ai_interaction_session set last_activity_at=clock_timestamp() where ai_interaction_session_id=pg_temp.gid(conv_n);
end $$;
create function pg_temp.historical_arrangement(op_n integer,priority_n integer,p_items jsonb,conv_n integer default 6005) returns void language plpgsql as $$
declare st ai.explorer_conversation_state%rowtype; canonical_items jsonb; snapshot jsonb; meaningful boolean;
  p_priority uuid:=case when priority_n is null then null else pg_temp.gid(priority_n) end;
begin
  select * into st from ai.explorer_conversation_state where conversation_id=pg_temp.gid(conv_n);
  select coalesce(jsonb_agg(value order by value->>'compassItemId'),'[]'::jsonb) into canonical_items from jsonb_array_elements(p_items);
  select exists(select 1 from ai.explorer_conversation_compass_item c join jsonb_array_elements(canonical_items) i
      on c.item_id=(i->>'compassItemId')::uuid where c.conversation_id=pg_temp.gid(conv_n) and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' and c.formation_status is distinct from 'proposed'
      and (c.compass_anchor is distinct from i->>'anchor' or c.relative_emphasis is distinct from (i->>'emphasis')::smallint))
    or st.priority_id is distinct from p_priority into meaningful;
  select jsonb_build_object('previousPriorityId',st.priority_id,'priorityId',p_priority,'items',
    coalesce(jsonb_agg(jsonb_build_object('compassItemId',c.item_id,'label',c.label,'anchor',i->'anchor','emphasis',i->'emphasis')
      order by c.item_id),'[]'::jsonb)) into snapshot
    from ai.explorer_conversation_compass_item c join jsonb_array_elements(canonical_items) i
      on c.item_id=(i->>'compassItemId')::uuid where c.conversation_id=pg_temp.gid(conv_n) and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' and c.formation_status is distinct from 'proposed';
  if meaningful then
    update ai.explorer_conversation_compass_item set compass_anchor=null where conversation_id=pg_temp.gid(conv_n) and merged_into_item_id is null and formation_status is distinct from 'rejected' and formation_status is distinct from 'proposed';
    update ai.explorer_conversation_compass_item c set compass_anchor=i->>'anchor',relative_emphasis=(i->>'emphasis')::smallint
      from jsonb_array_elements(canonical_items) i where c.conversation_id=pg_temp.gid(conv_n) and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' and c.formation_status is distinct from 'proposed' and c.item_id=(i->>'compassItemId')::uuid;
    update ai.explorer_conversation_state set priority_id=p_priority where conversation_id=pg_temp.gid(conv_n);
  end if;
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,kind,
    request_fingerprint,command_fingerprint,initial_revision,status,completed_at,compass_route_kind,compass_arrangement)
    values(pg_temp.gid(case when conv_n=6105 then 4 else 1 end),pg_temp.gid(op_n),pg_temp.gid(case when conv_n=6105 then 54 else 50 end),pg_temp.gid(conv_n),'confirm_compass_arrangement',
      methodology.hash_json(jsonb_build_array('compass-arrangement.v1',pg_temp.gid(case when conv_n=6105 then 54 else 50 end),pg_temp.gid(conv_n),
        st.revision,p_priority,canonical_items,pg_temp.request_sha(op_n))),pg_temp.request_sha(op_n),
      st.revision,'completed',clock_timestamp(),case when meaningful then 'arrangement_confirmed' else null end,
      case when meaningful then snapshot else null end);
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=pg_temp.gid(conv_n);
  update ai.ai_interaction_session set last_activity_at=clock_timestamp() where ai_interaction_session_id=pg_temp.gid(conv_n);
end $$;
create function pg_temp.historical_category(op_n integer,target_n integer,members integer[],p_label text,conv_n integer default 6005) returns void language plpgsql as $$
declare st ai.explorer_conversation_state%rowtype; ids uuid[]; contributing uuid[]; snapshot jsonb; old_label text; meaningful boolean;
  p_target uuid:=pg_temp.gid(target_n);
begin
  select * into st from ai.explorer_conversation_state where conversation_id=pg_temp.gid(conv_n);
  select array_agg(distinct pg_temp.gid(n) order by pg_temp.gid(n)) into ids from unnest(members) n;
  with recursive originals(item_id) as (
    select c.item_id from ai.explorer_conversation_compass_item c where c.conversation_id=pg_temp.gid(conv_n) and c.item_id=any(ids)
    union
    select c.item_id from ai.explorer_conversation_compass_item c join originals o on c.merged_into_item_id=o.item_id
      where c.conversation_id=pg_temp.gid(conv_n)
  ) select array_agg(item_id order by item_id) into contributing from originals;
  select c.label into old_label from ai.explorer_conversation_compass_item c where c.conversation_id=pg_temp.gid(conv_n) and c.item_id=p_target;
  meaningful:=cardinality(ids)>1 or old_label is distinct from p_label;
  if meaningful then
    select jsonb_build_object('targetItemId',p_target,'memberItemIds',to_jsonb(ids),'beforeItems',
      jsonb_agg(jsonb_build_object('compassItemId',c.item_id,'sourceMessageId',c.source_message_id,'label',c.label,
        'mergedIntoItemId',c.merged_into_item_id,'anchor',c.compass_anchor,'emphasis',c.relative_emphasis) order by c.item_id),
      'label',p_label) into snapshot
      from ai.explorer_conversation_compass_item c where c.conversation_id=pg_temp.gid(conv_n) and c.item_id=any(contributing);
    alter table ai.explorer_conversation_compass_item disable trigger explorer_compass_formation_guard;
    update ai.explorer_conversation_compass_item set label=p_label where conversation_id=pg_temp.gid(conv_n) and item_id=p_target;
    alter table ai.explorer_conversation_compass_item enable trigger explorer_compass_formation_guard;
    update ai.explorer_conversation_compass_item set merged_into_item_id=p_target
      where conversation_id=pg_temp.gid(conv_n) and item_id=any(ids) and item_id<>p_target;
  end if;
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,kind,
    request_fingerprint,command_fingerprint,initial_revision,status,completed_at,compass_route_kind,compass_category_change)
    values(pg_temp.gid(case when conv_n=6105 then 4 else 1 end),pg_temp.gid(op_n),pg_temp.gid(case when conv_n=6105 then 54 else 50 end),pg_temp.gid(conv_n),'confirm_compass_category',
      methodology.hash_json(jsonb_build_array('compass-category.v1',pg_temp.gid(case when conv_n=6105 then 54 else 50 end),pg_temp.gid(conv_n),
        st.revision,p_target,to_jsonb(ids),p_label,pg_temp.request_sha(op_n))),pg_temp.request_sha(op_n),
      st.revision,'completed',clock_timestamp(),case when meaningful then 'category_confirmed' else null end,snapshot);
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=pg_temp.gid(conv_n);
  update ai.ai_interaction_session set last_activity_at=clock_timestamp() where ai_interaction_session_id=pg_temp.gid(conv_n);
end $$;
create function pg_temp.read_conv(conv_n integer) returns jsonb language sql as $$
  select conversation_state from public.solmind_read_explorer_conversation_v3(pg_temp.gid(case when conv_n=6105 then 4 else 1 end),
    pg_temp.gid(case when conv_n=6105 then 54 else 50 end),pg_temp.gid(conv_n))
$$;
create function pg_temp.compass_rows(conv_n integer default 6005) returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(to_jsonb(c) order by c.item_id),'[]'::jsonb) from ai.explorer_conversation_compass_item c
    where c.conversation_id=pg_temp.gid(conv_n)
$$;
create function pg_temp.operation_count(conv_n integer default 6005) returns bigint language sql stable as $$
  select count(*) from ai.explorer_conversation_operation where conversation_id=pg_temp.gid(conv_n)
$$;
-- A retired fresh command (cmd returns its outcome) is refused with the definite conflict and leaves the saved
-- state, every stored point row (rejected rows included) and the operation count byte-equal to before.
create function pg_temp.refused(cmd text,conv_n integer default 6005) returns boolean language plpgsql as $$
declare s jsonb:=pg_temp.read_conv(conv_n); r jsonb:=pg_temp.compass_rows(conv_n); n bigint:=pg_temp.operation_count(conv_n); result text;
begin
  execute cmd into result;
  return result is not distinct from 'operation_conflict' and pg_temp.read_conv(conv_n)=s and pg_temp.compass_rows(conv_n)=r
    and pg_temp.operation_count(conv_n)=n;
end $$;

-- The complete desired placement is explicit; item creation order is not a layout.
create function pg_temp.layout() returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('compassItemId',c.item_id,
    'anchor',case c.item_id
      when pg_temp.gid(23001) then 'apex' when pg_temp.gid(23002) then 'upper_left'
      when pg_temp.gid(23003) then 'upper_right' when pg_temp.gid(23004) then 'side_left'
      when pg_temp.gid(23005) then 'side_right' when pg_temp.gid(23006) then 'lower_left'
      when pg_temp.gid(23007) then 'lower_center' when pg_temp.gid(23008) then 'lower_right' else null end,
    'emphasis',case c.item_id when pg_temp.gid(23001) then 3 when pg_temp.gid(23002) then 2 else 1 end)
    order by c.item_id),'[]'::jsonb)
  from ai.explorer_conversation_compass_item c where c.conversation_id=pg_temp.gid(6005)
$$;
create function pg_temp.arrange(op_n integer,priority_n integer,items_value jsonb,revision_override integer default null)
returns table(outcome text,conversation_state jsonb) language sql as $$
  select * from public.solmind_confirm_explorer_compass_arrangement_v1(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(op_n),coalesce(revision_override,
      (select initial_revision from ai.explorer_conversation_operation where actor_user_account_id=pg_temp.gid(1) and operation_id=pg_temp.gid(op_n)),
      (select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6005))),pg_temp.request_sha(op_n),
    case when priority_n is null then null else pg_temp.gid(priority_n) end,items_value)
$$;

do $$ begin
  for n in 1..8 loop
    perform pg_temp.historical_mutation(23000+n,'add_compass',10011,null,'Saved point '||n);
  end loop;
end $$;
select ok(pg_temp.refused($q$select outcome from pg_temp.mutate(24900,'add_compass',10015,null,null,'Saved ninth point')$q$),
  'a fresh ninth source-backed point is refused (retired), changing nothing');
do $$ begin perform pg_temp.historical_mutation(23009,'add_compass',10015,null,'Saved ninth point'); end $$;
select is((select count(*)::integer from ai.explorer_conversation_compass_item where conversation_id=pg_temp.gid(6005)),9,
  'ninth point is retained without replacing an earlier point (historical readback)');
select ok((select bool_and(c.compass_anchor is null and c.relative_emphasis is null)
  from ai.explorer_conversation_compass_item c where c.conversation_id=pg_temp.gid(6005)),
  'all legacy/new points remain truthfully unarranged before explicit confirmation (historical readback)');
select ok((select bool_and(v?'anchor' and v?'emphasis' and v->'anchor'='null'::jsonb and v->'emphasis'='null'::jsonb)
  from jsonb_array_elements(pg_temp.read_state()->'compassItems') v),
  'SQL projection supplies both NULL layout fields without inventing a history or position');
create temp table initial_request as select pg_temp.layout() items;
select ok(pg_temp.refused($q$select outcome from pg_temp.arrange(24901,null,(select items from initial_request))$q$),
  'a fresh complete Discovery arrangement is refused (retired), changing nothing');
do $$ begin perform pg_temp.historical_arrangement(24101,null,(select items from initial_request)); end $$;
select ok(pg_temp.read_state()->'priorityId'='null'::jsonb and (select count(*)=1
  from jsonb_array_elements(pg_temp.read_state()->'compassItems') v where v->>'anchor'='apex'),
  'an apex point does not invent or automatically confirm a Priority (historical readback)');
select is((select count(*)::integer from jsonb_array_elements(pg_temp.read_state()->'compassItems') v where v->>'anchor' is not null),8,
  'exactly eight named anchors are visible (historical readback)');
select ok((select v->'anchor'='null'::jsonb and v->>'emphasis'='1'
  from jsonb_array_elements(pg_temp.read_state()->'compassItems') v where v->>'id'=pg_temp.gid(23009)::text),
  'ninth point is explicitly retained as an Other path with chosen emphasis (historical readback)');
select is((select array_agg(v->>'anchor' order by v->>'anchor')
  from jsonb_array_elements(pg_temp.read_state()->'compassItems') v where v->>'anchor' is not null),
  array['apex','lower_center','lower_left','lower_right','side_left','side_right','upper_left','upper_right']::text[],
  'all eight closed anchor names survive saved readback (historical readback)');
select ok((select v->>'emphasis'='3' from jsonb_array_elements(pg_temp.read_state()->'compassItems') v where v->>'id'=pg_temp.gid(23001)::text)
  and (select v->>'emphasis'='2' from jsonb_array_elements(pg_temp.read_state()->'compassItems') v where v->>'id'=pg_temp.gid(23002)::text),
  'explicit relative emphasis is saved separately from position (historical readback)');
select is(pg_temp.read_state()->'route'->0,
  (select jsonb_build_object('operationId',operation_id,'revision',initial_revision+1,'kind','arrangement_confirmed',
    'previousPriorityId',compass_arrangement->'previousPriorityId','priorityId',compass_arrangement->'priorityId',
    'items',compass_arrangement->'items','recordedAt',completed_at)
    from ai.explorer_conversation_operation where operation_id=pg_temp.gid(24101)),
  'actual arrangement Route has exactly seven required keys and resulting revision/time');
select is((select compass_arrangement->'items' from ai.explorer_conversation_operation where operation_id=pg_temp.gid(24101)),
  (select jsonb_agg(jsonb_build_object('compassItemId',c.item_id,'label',c.label,'anchor',c.compass_anchor,'emphasis',c.relative_emphasis)
    order by c.item_id) from ai.explorer_conversation_compass_item c where c.conversation_id=pg_temp.gid(6005)),
  'snapshot captures exact saved DB labels and explicit placement/emphasis in canonical item order (historical readback)');
select ok(pg_temp.refused($q$select outcome from pg_temp.mutate(24902,'confirm_priority',null,23001)$q$),
  'a fresh Priority confirmation of the saved apex point is refused (retired), changing nothing');
do $$ begin perform pg_temp.historical_mutation(24201,'confirm_priority',null,23001); end $$;
select is((select outcome from pg_temp.mutate(24202,'set_attention',null,23002)),'ok','old attention command may select another visible point');
create temp table old_route as select jsonb_agg(v order by ord) value
  from jsonb_array_elements(pg_temp.read_state()->'route') with ordinality r(v,ord) where v->>'kind'<>'arrangement_confirmed';
select ok((select bool_and((select count(*) from jsonb_object_keys(v))=case when v->>'kind'='attention_changed' then 7 else 6 end
    and (v->>'kind'<>'attention_changed' or v->>'actor'='explorer'))
  from jsonb_array_elements((select value from old_route)) v),'Priority Route keeps six keys and attention adds only its Explorer actor');
create temp table reoriented_request as select jsonb_set(jsonb_set((select items from initial_request),'{0,anchor}','"upper_left"'),'{1,anchor}','"apex"') items;
select ok(pg_temp.refused($q$select outcome from pg_temp.arrange(24903,23002,(select items from reoriented_request))$q$),
  'a fresh batch that swaps anchors and reorients Priority is refused (retired), changing nothing');
do $$ begin perform pg_temp.historical_arrangement(24102,23002,(select items from reoriented_request)); end $$;
select ok((pg_temp.read_state()->>'priorityId')::uuid=pg_temp.gid(23002)
  and (pg_temp.read_state()->>'attentionId')::uuid=pg_temp.gid(23002),
  'confirmed new Priority and unchanged independent attention both remain visible (historical readback)');
select ok((select compass_arrangement->>'previousPriorityId'=pg_temp.gid(23001)::text
    and compass_arrangement->>'priorityId'=pg_temp.gid(23002)::text
  from ai.explorer_conversation_operation where operation_id=pg_temp.gid(24102)),
  'one meaningful arrangement snapshot records actual prior and new Priority (historical readback)');
select is((select jsonb_agg(v order by ord) from jsonb_array_elements(pg_temp.read_state()->'route') with ordinality r(v,ord)
  where v->>'kind'<>'arrangement_confirmed'),(select value from old_route),'new arrangement leaves original Route facts and attention actor unchanged');
create temp table saved_arranged_state as select pg_temp.read_state() value;
select is(pg_temp.read_state(),(select value from saved_arranged_state),'owned reload preserves all confirmed placement and history');
select is((select outcome from pg_temp.arrange(24102,23002,
  (select jsonb_agg(v order by ord desc) from jsonb_array_elements((select items from reoriented_request)) with ordinality r(v,ord)))),
  'exact_replay','same complete batch in different array order is a canonical exact replay');
select is(pg_temp.read_state(),(select value from saved_arranged_state),'canonical replay creates no duplicate history or state change');
select ok(pg_temp.refused($q$select outcome from pg_temp.arrange(24904,23002,(select items from reoriented_request))$q$),
  'a fresh equivalent arrangement is refused (retired), changing nothing');
do $$ begin perform pg_temp.historical_arrangement(24103,23002,(select items from reoriented_request)); end $$;
select ok((select compass_route_kind is null and compass_arrangement is null
  from ai.explorer_conversation_operation where operation_id=pg_temp.gid(24103)),
  'equivalent no-op carries no captured arrangement or Route event (historical readback)');
select is(pg_temp.read_state()->'route',(select value->'route' from saved_arranged_state),'the historical no-op has no meaningful Route event (historical readback)');
select is((pg_temp.read_state()->>'revision')::integer,(select (value->>'revision')::integer+1 from saved_arranged_state),
  'the historical no-op advanced only the existing compatible operation/revision semantics (historical readback)');
create temp table refusal_before as select pg_temp.read_state() value;
select ok(pg_temp.refused($q$select outcome from pg_temp.arrange(24104,23002,(select items from reoriented_request),0)$q$),
  'a stale new batch is refused (retired) before any saved arrangement mutation');
select is(pg_temp.read_state(),(select value from refusal_before),'stale batch preserves exact state, revision and history');

-- A separate owner's genuine container and saved-source fixture supply a real
-- foreign point ID; no model preparation is necessary for this test-only source.
do $$ begin
  if not exists(select 1 from pg_temp.ensure_anchor(6104,4,54) where outcome='created')
    then raise exception 'synthetic_foreign_arrangement_fixture_failed'; end if;
end $$;
-- REV391: the foreign owner's conversation 6105 holds historical manual points, so it is a legacy-mode copy of
-- Explorer 4's freshly created conversation 6104; its point rows are privileged historical rows.
insert into ai.ai_interaction_session select (jsonb_populate_record(null::ai.ai_interaction_session,
  to_jsonb(s)||jsonb_build_object('ai_interaction_session_id',pg_temp.gid(6105)))).*
  from ai.ai_interaction_session s where s.ai_interaction_session_id=pg_temp.gid(6104);
insert into ai.explorer_conversation_state select (jsonb_populate_record(null::ai.explorer_conversation_state,
  to_jsonb(s)||jsonb_build_object('conversation_id',pg_temp.gid(6105),'compass_mode','legacy'))).*
  from ai.explorer_conversation_state s where s.conversation_id=pg_temp.gid(6104);
insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
  sender_type,sender_user_account_id,sender_role_context,content_text)
values(pg_temp.gid(24991),pg_temp.gid(6105),1,'user',pg_temp.gid(4),'explorer','Synthetic foreign source.');
alter table ai.explorer_conversation_compass_item disable trigger explorer_compass_formation_guard;
insert into ai.explorer_conversation_compass_item(item_id,conversation_id,source_message_id,label,display_order)
values(pg_temp.gid(24992),pg_temp.gid(6105),pg_temp.gid(24991),'Foreign saved point',1);
alter table ai.explorer_conversation_compass_item enable trigger explorer_compass_formation_guard;

select throws_ok($$select * from pg_temp.arrange(24301,23002,'{}'::jsonb)$$,
  'P0001','solmind_explorer_private_invalid_input','batch must be an array');
select throws_ok($$select * from pg_temp.arrange(24302,23002,null)$$,
  'P0001','solmind_explorer_private_invalid_input','missing batch is refused');
select ok(pg_temp.refused($q$select outcome from pg_temp.arrange(24303,23002,(select items-0 from reoriented_request))$q$),
  'a partial batch cannot silently omit a saved point: refused (retired), changing nothing');
select throws_ok($$select * from pg_temp.arrange(24304,23002,(select items||jsonb_build_array(items->0) from reoriented_request))$$,
  'P0001','solmind_explorer_private_invalid_input','duplicate item ID is refused');
select throws_ok($$select * from pg_temp.arrange(24305,23002,(select jsonb_set(items,'{0,label}','"Browser-forged label"') from reoriented_request))$$,
  'P0001','solmind_explorer_private_invalid_input','unknown browser label key is not trusted or ignored');
select ok(pg_temp.refused($q$select outcome from pg_temp.arrange(24306,23002,(select jsonb_set(items,'{0,compassItemId}',to_jsonb(pg_temp.gid(24999)::text)) from reoriented_request))$q$),
  'an unknown point cannot substitute for a current owned point: refused (retired), changing nothing');
select ok(pg_temp.refused($q$select outcome from pg_temp.arrange(24307,23002,(select jsonb_set(items,'{0,compassItemId}',to_jsonb(pg_temp.gid(24992)::text)) from reoriented_request))$q$),
  'a foreign saved point is refused (retired) despite its genuine existing ID, changing nothing');
select throws_ok($$select * from pg_temp.arrange(24308,23002,(select jsonb_set(items,'{0,emphasis}','0') from reoriented_request))$$,
  'P0001','solmind_explorer_private_invalid_input','emphasis below one is refused');
select throws_ok($$select * from pg_temp.arrange(24309,23002,(select jsonb_set(items,'{0,emphasis}','4') from reoriented_request))$$,
  'P0001','solmind_explorer_private_invalid_input','emphasis above three is refused');
select throws_ok($$select * from pg_temp.arrange(24310,23002,(select jsonb_set(items,'{0,emphasis}','"1"') from reoriented_request))$$,
  'P0001','solmind_explorer_private_invalid_input','emphasis must be a number rather than a coercible string');
select throws_ok($$select * from pg_temp.arrange(24311,23002,(select jsonb_set(items,'{0,emphasis}','1.5') from reoriented_request))$$,
  'P0001','solmind_explorer_private_invalid_input','fractional emphasis is refused');
select throws_ok($$select * from pg_temp.arrange(24312,23002,(select jsonb_set(items,'{0,emphasis}','null') from reoriented_request))$$,
  'P0001','solmind_explorer_private_invalid_input','explicit confirmation requires chosen emphasis even for Other paths');
select throws_ok($$select * from pg_temp.arrange(24313,23002,(select jsonb_set(items,'{0,anchor}','"north"') from reoriented_request))$$,
  'P0001','solmind_explorer_private_invalid_input','unknown anchor is refused');
select throws_ok($$select * from pg_temp.arrange(24314,23002,(select jsonb_set(items,'{0,anchor}','"apex"') from reoriented_request))$$,
  'P0001','solmind_explorer_private_invalid_input','two points cannot occupy one named anchor');
select throws_ok($$select * from pg_temp.arrange(24315,23002,(select jsonb_set(items,'{0}',(items->0)-'anchor') from reoriented_request))$$,
  'P0001','solmind_explorer_private_invalid_input','partial three-key point shape is refused');
select ok(pg_temp.refused($q$select outcome from pg_temp.arrange(24316,null,(select items from reoriented_request))$q$),
  'an existing confirmed Priority cannot be cleared: refused (retired), changing nothing');
select ok(pg_temp.refused($q$select outcome from pg_temp.arrange(24317,23001,(select items from reoriented_request))$q$),
  'a Priority off the apex is refused (retired), changing nothing');
select ok(pg_temp.refused($q$select outcome from pg_temp.arrange(24318,23001,(select jsonb_set(jsonb_set(items,'{0,anchor}','"apex"'),'{1,anchor}','null') from reoriented_request))$q$),
  'current attention cannot be silently put into Other paths: refused (retired), changing nothing');
select throws_ok($$select * from pg_temp.arrange(24102,23002,(select jsonb_set(items,'{0,emphasis}','2') from reoriented_request))$$,
  'P0001','solmind_explorer_private_operation_conflict','same operation with changed complete arrangement conflicts');
select is(pg_temp.read_state(),(select value from refusal_before),'every refused batch preserves all primary state, revision and history');
select ok(not exists(select 1 from ai.explorer_conversation_operation where conversation_id=pg_temp.gid(6005)
  and operation_id between pg_temp.gid(24301) and pg_temp.gid(24318)),
  'malformed/refused batches create no completed operation or partial arrangement');
select ok(pg_temp.refused($q$select outcome from pg_temp.mutate(24203,'confirm_priority',null,23001)$q$),
  'the retired Priority command cannot bypass the saved apex: refused, changing nothing');
-- Since 20261103180000 (Paul's decision, decision queue 2026-11-03 18:05:33 CST) the attention
-- command may select an Other paths point; that rule is pinned after the 24-point setup below.
select is((select outcome from pg_temp.mutate(24201,'confirm_priority',null,23001)),'exact_replay',
  'old exact Priority replay resolves even though that old point is now off-apex');
select is(pg_temp.read_state(),(select value from refusal_before),'old refusals and legitimate exact replay preserve current layout and history');

-- Captured history is immutable and independent of later point wording.
-- REV391: point wording is now immutable to every write, so this later historical wording is a privileged edit
-- with only the formation guard suspended, restored before the next assertion.
alter table ai.explorer_conversation_compass_item disable trigger explorer_compass_formation_guard;
update ai.explorer_conversation_compass_item set label='Later synthetic wording' where item_id=pg_temp.gid(23001);
alter table ai.explorer_conversation_compass_item enable trigger explorer_compass_formation_guard;
select is(pg_temp.read_state()->'route',(select value->'route' from refusal_before),
  'captured arrangement retains original DB labels after a later synthetic point-label edit');
select throws_ok($$update ai.explorer_conversation_operation set compass_arrangement=jsonb_set(compass_arrangement,'{items,0,label}','"Forged history"')
  where operation_id=pg_temp.gid(24102)$$,'P0001','solmind_explorer_private_immutable','captured arrangement labels cannot be rewritten');
select throws_ok($$update ai.explorer_conversation_operation set completed_at=completed_at+interval '1 second'
  where operation_id=pg_temp.gid(24102)$$,'P0001','solmind_explorer_private_immutable','captured arrangement time cannot be rewritten');
select throws_ok($$delete from ai.explorer_conversation_operation where operation_id=pg_temp.gid(24102)$$,
  'P0001','solmind_explorer_private_immutable','captured arrangement operation cannot be deleted');
select throws_ok($$update ai.explorer_conversation_operation set compass_route_kind='arrangement_confirmed',
  compass_arrangement=(select compass_arrangement from ai.explorer_conversation_operation where operation_id=pg_temp.gid(24102))
  where operation_id=pg_temp.gid(24103)$$,'P0001','solmind_explorer_private_immutable','NULL no-op history cannot be enriched into an arrangement');
select throws_ok($$update ai.explorer_conversation_operation set compass_arrangement=(select compass_arrangement
  from ai.explorer_conversation_operation where operation_id=pg_temp.gid(24102)) where operation_id=pg_temp.gid(24201)$$,
  'P0001','solmind_explorer_private_immutable','an old six-key Route row cannot be enriched into new arrangement history');

-- Capacity is total saved points; Other paths are not dropped or silently swapped.
do $$ begin
  for n in 10..24 loop
    perform pg_temp.historical_mutation(23000+n,'add_compass',10011,null,'Saved point '||n);
  end loop;
end $$;
-- The needle may point at any current point (20261103180000; Paul's decision, decision queue
-- 2026-11-03 18:05:33 CST). Here the Compass is arranged, 23009 is in Other paths and 23010-23024
-- are not yet arranged, under clear policy; the Priority is 23002 at the apex and the needle is on it.
create temp table any_point_before as select pg_temp.read_state() value;
select is((select outcome from pg_temp.mutate(24701,'set_attention',null,23009)),'ok',
  'the needle may point at an Other paths point once a Compass is arranged');
select ok((pg_temp.read_state()->>'attentionId')::uuid=pg_temp.gid(23009)
  and (pg_temp.read_state()->>'priorityId')::uuid=pg_temp.gid(23002)
  and (pg_temp.read_state()->>'revision')::integer=(select (value->>'revision')::integer+1 from any_point_before),
  'pointing at an Other paths point moves only the needle, in one revision, and keeps the Priority');
select is(pg_temp.read_state()->'route'->-1,
  (select jsonb_build_object('operationId',operation_id,'revision',initial_revision+1,'kind','attention_changed',
    'compassItemId',pg_temp.gid(23009),'label','Saved ninth point','recordedAt',completed_at,'actor','explorer')
    from ai.explorer_conversation_operation where operation_id=pg_temp.gid(24701)),
  'the Route records the move to the Other paths point with its saved label');
select is((select compass_route_kind||'|'||compass_route_label from ai.explorer_conversation_operation where operation_id=pg_temp.gid(24701)),
  'attention_changed|Saved ninth point','the operation keeps the attention_changed Route fact');
select is((select outcome from pg_temp.mutate(24702,'set_attention',null,23010)),'ok',
  'the needle may point at a point not yet arranged once a Compass is arranged');
select is(pg_temp.read_state()->'route'->-1,
  (select jsonb_build_object('operationId',operation_id,'revision',initial_revision+1,'kind','attention_changed',
    'compassItemId',pg_temp.gid(23010),'label','Saved point 10','recordedAt',completed_at,'actor','explorer')
    from ai.explorer_conversation_operation where operation_id=pg_temp.gid(24702)),
  'the Route records the move to the point not yet arranged with its saved label');
select ok((select compass_anchor is null and relative_emphasis is null from ai.explorer_conversation_compass_item where item_id=pg_temp.gid(23010))
  and (select compass_anchor is null and relative_emphasis=1 from ai.explorer_conversation_compass_item where item_id=pg_temp.gid(23009)),
  'pointing the needle places nothing: both points keep their saved layout');
select is((select jsonb_array_length(pg_temp.read_state()->'route')),(select jsonb_array_length(value->'route')+2 from any_point_before),
  'two moves add exactly two Route events');
-- confirm_priority keeps its rule: once a Compass is arranged, only the apex point.
create temp table priority_rule_before as select pg_temp.read_state() value;
select ok(pg_temp.refused($q$select outcome from pg_temp.mutate(24703,'confirm_priority',null,23009)$q$),
  'a new Priority still cannot be an Other paths point: refused (retired), changing nothing');
select ok(pg_temp.refused($q$select outcome from pg_temp.mutate(24704,'confirm_priority',null,23010)$q$),
  'a new Priority still cannot be a point not yet arranged: refused (retired), changing nothing');
select ok(pg_temp.refused($q$select outcome from pg_temp.mutate(24705,'confirm_priority',null,23003)$q$),
  'a new Priority still cannot be a placed point off the apex: refused (retired), changing nothing');
select is(pg_temp.read_state(),(select value from priority_rule_before),'the refused Priority commands change nothing saved');
-- The arrangement rule is unchanged (Data Model Spec 03: attention stays placed when a Compass is
-- arranged): with the needle on a point not yet arranged, an arrangement that leaves that point
-- unplaced is refused, so the needle is never moved silently; one that places it keeps the needle there.
select ok(pg_temp.refused($q$select outcome from pg_temp.arrange(24706,23002,jsonb_set(jsonb_set(pg_temp.layout(),'{0,anchor}','"upper_left"'),'{1,anchor}','"apex"'))$q$),
  'an arrangement that leaves the needle''s unplaced point unplaced is refused (retired), changing nothing');
select is(pg_temp.read_state(),(select value from priority_rule_before),'the refused arrangement changes nothing saved');
select ok(pg_temp.refused($q$select outcome from pg_temp.arrange(24905,23002,jsonb_set(jsonb_set(jsonb_set(jsonb_set(pg_temp.layout(),
  '{0,anchor}','"upper_left"'),'{1,anchor}','"apex"'),'{7,anchor}','null'),'{9,anchor}','"lower_right"'))$q$),
  'a fresh arrangement that places the needle''s point is refused (retired), changing nothing');
do $$ begin perform pg_temp.historical_arrangement(24707,23002,jsonb_set(jsonb_set(jsonb_set(jsonb_set(pg_temp.layout(),
  '{0,anchor}','"upper_left"'),'{1,anchor}','"apex"'),'{7,anchor}','null'),'{9,anchor}','"lower_right"')); end $$;
select ok((pg_temp.read_state()->>'attentionId')::uuid=pg_temp.gid(23010)
  and (select compass_anchor='lower_right' from ai.explorer_conversation_compass_item where item_id=pg_temp.gid(23010))
  and (select compass_anchor is null and relative_emphasis=1 from ai.explorer_conversation_compass_item where item_id=pg_temp.gid(23008)),
  'the needle stays on its point, now placed, and the point moved out is kept in Other paths (historical readback)');
select is((select outcome from pg_temp.mutate(24708,'set_attention',null,23002)),'ok',
  'the needle returns to the Priority point before the capacity arrangement below');
create temp table capacity_request as select jsonb_set(jsonb_set(pg_temp.layout(),'{0,anchor}','"upper_left"'),'{1,anchor}','"apex"') items;
select ok(pg_temp.refused($q$select outcome from pg_temp.arrange(24906,23002,(select items from capacity_request))$q$),
  'a fresh complete twenty-four-point batch is refused (retired), changing nothing');
do $$ begin perform pg_temp.historical_arrangement(24105,23002,(select items from capacity_request)); end $$;
select ok((select count(*)=24 and count(*) filter(where c.compass_anchor is not null)=8
  and count(*) filter(where c.compass_anchor is null and c.relative_emphasis is not null)=16
  from ai.explorer_conversation_compass_item c where c.conversation_id=pg_temp.gid(6005)),
  'all twenty-four saved points remain, with eight visible and sixteen reviewable Other paths (historical readback)');
create temp table capacity_before as select pg_temp.read_state() value;
select ok(pg_temp.refused($q$select outcome from pg_temp.mutate(23025,'add_compass',10011,null,null,'Twenty-fifth refused point')$q$),
  'a fresh twenty-fifth saved point at the total capacity is refused (retired), changing nothing');
select is(pg_temp.read_state(),(select value from capacity_before),'capacity refusal preserves every existing point, arrangement, revision and Route event');
select ok(not exists(select 1 from ai.explorer_conversation_compass_item where item_id=pg_temp.gid(23025))
  and not exists(select 1 from ai.explorer_conversation_operation where operation_id=pg_temp.gid(23025)),
  'capacity refusal creates neither a dropped/replacement point nor an operation');
select throws_ok($$select * from public.solmind_confirm_explorer_compass_arrangement_v1(pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6005),
  pg_temp.gid(24401),0,pg_temp.request_sha(24401),pg_temp.gid(23002),(select items from capacity_request))$$,
  'P0001','solmind_explorer_conversation_denied','other owner cannot confirm this conversation arrangement');
select lives_ok($$select ai.solmind_store_private_observation_v3(pg_temp.gid(6005),pg_temp.gid(50),pg_temp.gid(24998),
  repeat('E',64),'synthetic-fallback.v1','synthetic-model-policy.v1',3::smallint,false,null,null,null)$$,
  'synthetic positive establishes current restricted policy without a model call');
select ok(pg_temp.refused($q$select outcome from pg_temp.arrange(24402,23002,(select jsonb_set(items,'{0,emphasis}','2') from capacity_request))$q$),
  'a new arrangement under restricted policy is refused (retired) even with a complete valid batch, changing nothing');
select is((select outcome from pg_temp.arrange(24105,23002,(select items from capacity_request))),'exact_replay',
  'restriction preserves a legitimate exact earlier arrangement replay');
select is(pg_temp.read_state(),(select value from capacity_before),'owner/restricted denials and replay preserve saved private arrangement');
select is((select count(*)::integer from ai.ai_model_invocation),(select n from invocation_before),
  'all arrangement, capacity, readback and refusal cases create no additional model invocation');
select ok(has_function_privilege('service_role',
  'public.solmind_confirm_explorer_compass_arrangement_v1(uuid,uuid,uuid,uuid,integer,text,uuid,jsonb)','EXECUTE')
  and not has_function_privilege('anon','public.solmind_confirm_explorer_compass_arrangement_v1(uuid,uuid,uuid,uuid,integer,text,uuid,jsonb)','EXECUTE')
  and not has_function_privilege('authenticated','public.solmind_confirm_explorer_compass_arrangement_v1(uuid,uuid,uuid,uuid,integer,text,uuid,jsonb)','EXECUTE'),
  'only service_role receives the new public arrangement capability');
select ok(not exists(select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
  where has_schema_privilege(r.role_name,'ai','USAGE')
    or has_table_privilege(r.role_name,'ai.explorer_conversation_compass_item','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege(r.role_name,'ai.explorer_conversation_operation','SELECT,INSERT,UPDATE,DELETE')),
  'no API role gains schema or direct current-layout/history table access');
-- 20261103180000 replaced only the internal body: its owner, security, settings and grants stay.
select ok((select pg_get_userbyid(p.proowner)='postgres' and p.prosecdef and p.proconfig @> array['search_path=""','lock_timeout=2000ms']
    and cardinality(p.proconfig)=2
  from pg_proc p where p.oid='public.solmind_mutate_explorer_conversation(uuid,uuid,uuid,uuid,integer,text,text,uuid,uuid,uuid,text,text,text,text,text)'::regprocedure),
  'the replaced internal body keeps its owner, security definer, empty search_path and lock timeout');
select ok(not exists(select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
  where has_function_privilege(r.role_name,'public.solmind_mutate_explorer_conversation(uuid,uuid,uuid,uuid,integer,text,text,uuid,uuid,uuid,text,text,text,text,text)','EXECUTE')),
  'no API role may execute the replaced internal body');
select ok(has_function_privilege('service_role','public.solmind_mutate_explorer_conversation_v3(uuid,uuid,uuid,uuid,integer,text,text,uuid,uuid,uuid,text,text,text,text,text)','EXECUTE')
  and not has_function_privilege('anon','public.solmind_mutate_explorer_conversation_v3(uuid,uuid,uuid,uuid,integer,text,text,uuid,uuid,uuid,text,text,text,text,text)','EXECUTE')
  and not has_function_privilege('authenticated','public.solmind_mutate_explorer_conversation_v3(uuid,uuid,uuid,uuid,integer,text,text,uuid,uuid,uuid,text,text,text,text,text)','EXECUTE'),
  'only service_role executes the v3 wrapper that calls it, as before');
-- Total capacity and visible capacity are independent: Discovery can retain all
-- twenty-four points as Other paths, without forcing an apex or Priority.
do $$ begin
  for n in 1..23 loop
    perform pg_temp.historical_mutation(24500+n,'add_compass',24991,null,'Other path '||n,6105);
  end loop;
end $$;
select ok(pg_temp.refused($q$select outcome from public.solmind_confirm_explorer_compass_arrangement_v1(pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6105),
  pg_temp.gid(24907),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6105)),pg_temp.request_sha(24907),null,
  (select jsonb_agg(jsonb_build_object('compassItemId',item_id,'anchor',null,'emphasis',1) order by item_id)
    from ai.explorer_conversation_compass_item where conversation_id=pg_temp.gid(6105)))$q$,6105),
  'a fresh Discovery arrangement of twenty-four Other paths is refused (retired), changing nothing');
do $$ begin perform pg_temp.historical_arrangement(24600,null,(select jsonb_agg(jsonb_build_object('compassItemId',item_id,'anchor',null,'emphasis',1) order by item_id)
    from ai.explorer_conversation_compass_item where conversation_id=pg_temp.gid(6105)),6105); end $$;
select ok((select count(*)=24 and bool_and(compass_anchor is null and relative_emphasis=1)
  from ai.explorer_conversation_compass_item where conversation_id=pg_temp.gid(6105))
  and (select priority_id is null from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6105)),
  'there is no independent sixteen-Other-path cap or automatically invented Priority (historical readback)');
-- With every point in Other paths the needle may still point at one (20261103180000), while a
-- combined-away original still cannot take it and a new Priority still needs the apex.
select is((select outcome from public.solmind_mutate_explorer_conversation_v3(pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6105),
  pg_temp.gid(24801),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6105)),
  'set_attention',pg_temp.request_sha(24801),null,pg_temp.gid(24501))),'ok',
  'with every point in Other paths the needle may point at one of them');
select ok((select attention_id=pg_temp.gid(24501) from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6105))
  and (select compass_route_kind='attention_changed' and compass_route_item_id=pg_temp.gid(24501) and compass_route_label='Other path 1'
    from ai.explorer_conversation_operation where operation_id=pg_temp.gid(24801)),
  'that move is saved with its attention_changed Route fact and saved label');
select ok(pg_temp.refused($q$select outcome from public.solmind_confirm_explorer_compass_category_v1(pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6105),
  pg_temp.gid(24908),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6105)),pg_temp.request_sha(24908),
  pg_temp.gid(24503),array[pg_temp.gid(24502),pg_temp.gid(24503)],'Other paths 2 and 3')$q$,6105),
  'a fresh combination of two Other paths points is refused (retired), changing nothing');
do $$ begin perform pg_temp.historical_category(24802,24503,array[24502,24503],'Other paths 2 and 3',6105); end $$;
create temp table merged_before as select revision,attention_id from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6105);
select throws_ok($$select * from public.solmind_mutate_explorer_conversation_v3(pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6105),
  pg_temp.gid(24803),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6105)),
  'set_attention',pg_temp.request_sha(24803),null,pg_temp.gid(24502))$$,
  'P0001','solmind_explorer_conversation_denied','a combined-away original still cannot take the needle');
select ok(pg_temp.refused($q$select outcome from public.solmind_mutate_explorer_conversation_v3(pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6105),
  pg_temp.gid(24804),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6105)),
  'confirm_priority',pg_temp.request_sha(24804),null,pg_temp.gid(24503))$q$,6105),
  'an Other paths point still cannot become the Priority: refused (retired), changing nothing');
select ok((select s.revision=b.revision and s.attention_id=b.attention_id from ai.explorer_conversation_state s,merged_before b
    where s.conversation_id=pg_temp.gid(6105))
  and not exists(select 1 from ai.explorer_conversation_operation where operation_id in (pg_temp.gid(24803),pg_temp.gid(24804))),
  'both refusals leave the saved needle, revision and history unchanged');
select ok(not exists(select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
  where has_function_privilege(r.role_name,'ai.solmind_compass_arrangement_snapshot_valid(jsonb)','EXECUTE')),
  'closed private snapshot validator remains ungranted to every API role');
select is((select count(*)::integer from ai.ai_model_invocation),(select n from invocation_before),
  'the independent full-Other-path Discovery proof also creates no model invocation');
-- Force pending session/state coherence work under the real API role before
-- rolling back this owned fixture; this is not an actual COMMIT/durability claim.
set local role service_role;
select lives_ok($$set constraints all immediate$$,'actual deferred coherence checks pass under service_role after arrangement');
reset role;
select * from finish();
rollback;
