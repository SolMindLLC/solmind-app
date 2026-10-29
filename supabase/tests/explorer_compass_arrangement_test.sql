-- Focused explicit Compass arrangement, emphasis and Other paths proof.
-- Synthetic disposable-project SQL only; no retained demo data or provider calls.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,pg_catalog,pg_temp;
set local statement_timeout='120s';
select no_plan();

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
create function pg_temp.context_value(msg uuid,body text) returns jsonb language sql stable as $$
  select jsonb_build_object('contractVersion','wi007-v0.1+onboarding-fields-v2','aiRole','solmind_virtual_guide','actorRoleContext','explorer',
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
    rev,methodology.hash_json(jsonb_build_array('synthetic-command',slot)),'explorer-safety-reply.v1',
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
    pg_temp.gid(10004+slot_n*10),pg_temp.gid(1000),saved.methodology_sha,saved.mv,'explorer-safety-reply.v1',saved.mode,
    repeat('A',64),'synthetic-fallback.v1','synthetic-model-policy.v1','synthetic-trusted.v1','synthetic-resources.v1',
    saved.safety_version,saved.fallback,saved.minor,selected_model);
end $$;
create function pg_temp.settle_private(slot_n integer,model integer default 0,minor_flag boolean default false,
  kind text default 'ordinary',body text default 'Synthetic saved reply.',status_name text default 'completed',
  interested boolean default true,fallback_override integer default null)
returns table(outcome text,conversation_state jsonb,policy_state jsonb,saved_reply boolean)
language sql as $$
  select * from public.solmind_settle_explorer_conversation_turn_v3(pg_temp.gid(1),pg_temp.gid(50),pg_temp.gid(6005),
    pg_temp.gid(10000+slot_n*10),status_name,case when kind='none' then null else pg_temp.gid(10005+slot_n*10) end,
    kind,case when kind='none' then null else body end,model::smallint,minor_flag,'explorer-safety-reply.v1',
    (select mode from lifecycle_intent where slot=slot_n),repeat('A',64),'synthetic-fallback.v1',
    'synthetic-model-policy.v1','synthetic-trusted.v1','synthetic-resources.v1',
    coalesce(fallback_override,(select fallback from lifecycle_intent where slot=slot_n))::smallint,
    (select minor from lifecycle_intent where slot=slot_n),interested)
$$;

-- Establish the existing synthetic governed source fixture. No provider is called;
-- the recorded screen/reply below are SQL protocol fixtures, not human/AI proof.
do $$ begin
  if pg_temp.register_version(1001) is distinct from 'ok' then raise exception 'synthetic_formation_register_failed'; end if;
  if not exists(select 1 from pg_temp.screen_start(1001) where outcome='ok' and dispatch_permitted) then raise exception 'synthetic_formation_screen_prepare_failed'; end if;
  if pg_temp.screen_terminal(1001) is distinct from 'ok' then raise exception 'synthetic_formation_screen_terminal_failed'; end if;
  if pg_temp.admin_review(1001) is distinct from 'ok' then raise exception 'synthetic_formation_admin_failed'; end if;
  if pg_temp.guide_decision(1001) is distinct from 'ok' then raise exception 'synthetic_formation_guide_failed'; end if;
  if not exists(select 1 from pg_temp.ensure_anchor() where outcome='created') then raise exception 'synthetic_formation_anchor_failed'; end if;
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
    if not exists(select 1 from pg_temp.mutate(23000+n,'add_compass',10011,null,null,'Saved point '||n) where outcome='ok')
      then raise exception 'synthetic_compass_eight_point_setup_failed'; end if;
  end loop;
end $$;
select is((select outcome from pg_temp.mutate(23009,'add_compass',10015,null,null,'Saved ninth point')),'ok',
  'ninth source-backed point saves beyond the eight visible-anchor limit');
select is((select count(*)::integer from ai.explorer_conversation_compass_item where conversation_id=pg_temp.gid(6005)),9,
  'ninth point is retained without replacing an earlier point');
select ok((select bool_and(c.compass_anchor is null and c.relative_emphasis is null)
  from ai.explorer_conversation_compass_item c where c.conversation_id=pg_temp.gid(6005)),
  'all legacy/new points remain truthfully unarranged before explicit confirmation');
select ok((select bool_and(v?'anchor' and v?'emphasis' and v->'anchor'='null'::jsonb and v->'emphasis'='null'::jsonb)
  from jsonb_array_elements(pg_temp.read_state()->'compassItems') v),
  'SQL projection supplies both NULL layout fields without inventing a history or position');
create temp table initial_request as select pg_temp.layout() items;
select is((select outcome from pg_temp.arrange(24101,null,(select items from initial_request))),'ok',
  'complete explicit Discovery arrangement saves with no confirmed Priority');
select ok(pg_temp.read_state()->'priorityId'='null'::jsonb and (select count(*)=1
  from jsonb_array_elements(pg_temp.read_state()->'compassItems') v where v->>'anchor'='apex'),
  'an apex point does not invent or automatically confirm a Priority');
select is((select count(*)::integer from jsonb_array_elements(pg_temp.read_state()->'compassItems') v where v->>'anchor' is not null),8,
  'exactly eight named anchors are visible');
select ok((select v->'anchor'='null'::jsonb and v->>'emphasis'='1'
  from jsonb_array_elements(pg_temp.read_state()->'compassItems') v where v->>'id'=pg_temp.gid(23009)::text),
  'ninth point is explicitly retained as an Other path with chosen emphasis');
select is((select array_agg(v->>'anchor' order by v->>'anchor')
  from jsonb_array_elements(pg_temp.read_state()->'compassItems') v where v->>'anchor' is not null),
  array['apex','lower_center','lower_left','lower_right','side_left','side_right','upper_left','upper_right']::text[],
  'all eight closed anchor names survive saved readback');
select ok((select v->>'emphasis'='3' from jsonb_array_elements(pg_temp.read_state()->'compassItems') v where v->>'id'=pg_temp.gid(23001)::text)
  and (select v->>'emphasis'='2' from jsonb_array_elements(pg_temp.read_state()->'compassItems') v where v->>'id'=pg_temp.gid(23002)::text),
  'explicit relative emphasis is saved separately from position');
select is(pg_temp.read_state()->'route'->0,
  (select jsonb_build_object('operationId',operation_id,'revision',initial_revision+1,'kind','arrangement_confirmed',
    'previousPriorityId',compass_arrangement->'previousPriorityId','priorityId',compass_arrangement->'priorityId',
    'items',compass_arrangement->'items','recordedAt',completed_at)
    from ai.explorer_conversation_operation where operation_id=pg_temp.gid(24101)),
  'actual arrangement Route has exactly seven required keys and resulting revision/time');
select is((select compass_arrangement->'items' from ai.explorer_conversation_operation where operation_id=pg_temp.gid(24101)),
  (select jsonb_agg(jsonb_build_object('compassItemId',c.item_id,'label',c.label,'anchor',c.compass_anchor,'emphasis',c.relative_emphasis)
    order by c.item_id) from ai.explorer_conversation_compass_item c where c.conversation_id=pg_temp.gid(6005)),
  'snapshot captures exact saved DB labels and explicit placement/emphasis in canonical item order');
select is((select outcome from pg_temp.mutate(24201,'confirm_priority',null,23001)),'ok','old Priority command may confirm the saved apex point');
select is((select outcome from pg_temp.mutate(24202,'set_attention',null,23002)),'ok','old attention command may select another visible point');
create temp table old_route as select jsonb_agg(v order by ord) value
  from jsonb_array_elements(pg_temp.read_state()->'route') with ordinality r(v,ord) where v->>'kind'<>'arrangement_confirmed';
select ok((select bool_and((select count(*) from jsonb_object_keys(v))=6)
  from jsonb_array_elements((select value from old_route)) v),'predecessor Priority/attention Route events keep their six-key shape');
create temp table reoriented_request as select jsonb_set(jsonb_set((select items from initial_request),'{0,anchor}','"upper_left"'),'{1,anchor}','"apex"') items;
select is((select outcome from pg_temp.arrange(24102,23002,(select items from reoriented_request))),'ok',
  'explicit batch atomically swaps visible anchors and reorients Priority to the apex');
select ok((pg_temp.read_state()->>'priorityId')::uuid=pg_temp.gid(23002)
  and (pg_temp.read_state()->>'attentionId')::uuid=pg_temp.gid(23002),
  'confirmed new Priority and unchanged independent attention both remain visible');
select ok((select compass_arrangement->>'previousPriorityId'=pg_temp.gid(23001)::text
    and compass_arrangement->>'priorityId'=pg_temp.gid(23002)::text
  from ai.explorer_conversation_operation where operation_id=pg_temp.gid(24102)),
  'one meaningful arrangement snapshot records actual prior and new Priority');
select is((select jsonb_agg(v order by ord) from jsonb_array_elements(pg_temp.read_state()->'route') with ordinality r(v,ord)
  where v->>'kind'<>'arrangement_confirmed'),(select value from old_route),'new arrangement leaves original six-key Route facts unchanged');
create temp table saved_arranged_state as select pg_temp.read_state() value;
select is(pg_temp.read_state(),(select value from saved_arranged_state),'owned reload preserves all confirmed placement and history');
select is((select outcome from pg_temp.arrange(24102,23002,
  (select jsonb_agg(v order by ord desc) from jsonb_array_elements((select items from reoriented_request)) with ordinality r(v,ord)))),
  'exact_replay','same complete batch in different array order is a canonical exact replay');
select is(pg_temp.read_state(),(select value from saved_arranged_state),'canonical replay creates no duplicate history or state change');
select is((select outcome from pg_temp.arrange(24103,23002,(select items from reoriented_request))),'ok',
  'fresh equivalent arrangement retains ordinary completed-operation semantics');
select ok((select compass_route_kind is null and compass_arrangement is null
  from ai.explorer_conversation_operation where operation_id=pg_temp.gid(24103)),
  'equivalent no-op carries no captured arrangement or Route event');
select is(pg_temp.read_state()->'route',(select value->'route' from saved_arranged_state),'fresh no-op creates no meaningful Route event');
select is((pg_temp.read_state()->>'revision')::integer,(select (value->>'revision')::integer+1 from saved_arranged_state),
  'fresh no-op advances only the existing compatible operation/revision semantics');
create temp table refusal_before as select pg_temp.read_state() value;
select is((select outcome from pg_temp.arrange(24104,23002,(select items from reoriented_request),0)),'stale_revision',
  'stale new batch is refused before any saved arrangement mutation');
select is(pg_temp.read_state(),(select value from refusal_before),'stale batch preserves exact state, revision and history');

-- A separate owner's genuine container and saved-source fixture supply a real
-- foreign point ID; no model preparation is necessary for this test-only source.
do $$ begin
  if not exists(select 1 from pg_temp.ensure_anchor(6105,4,54) where outcome='created')
    then raise exception 'synthetic_foreign_arrangement_fixture_failed'; end if;
end $$;
insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
  sender_type,sender_user_account_id,sender_role_context,content_text)
values(pg_temp.gid(24991),pg_temp.gid(6105),1,'user',pg_temp.gid(4),'explorer','Synthetic foreign source.');
insert into ai.explorer_conversation_compass_item(item_id,conversation_id,source_message_id,label,display_order)
values(pg_temp.gid(24992),pg_temp.gid(6105),pg_temp.gid(24991),'Foreign saved point',1);

select throws_ok($$select * from pg_temp.arrange(24301,23002,'{}'::jsonb)$$,
  'P0001','solmind_explorer_private_invalid_input','batch must be an array');
select throws_ok($$select * from pg_temp.arrange(24302,23002,null)$$,
  'P0001','solmind_explorer_private_invalid_input','missing batch is refused');
select throws_ok($$select * from pg_temp.arrange(24303,23002,(select items-0 from reoriented_request))$$,
  'P0001','solmind_explorer_private_invalid_input','partial batch cannot silently omit a saved point');
select throws_ok($$select * from pg_temp.arrange(24304,23002,(select items||jsonb_build_array(items->0) from reoriented_request))$$,
  'P0001','solmind_explorer_private_invalid_input','duplicate item ID is refused');
select throws_ok($$select * from pg_temp.arrange(24305,23002,(select jsonb_set(items,'{0,label}','"Browser-forged label"') from reoriented_request))$$,
  'P0001','solmind_explorer_private_invalid_input','unknown browser label key is not trusted or ignored');
select throws_ok($$select * from pg_temp.arrange(24306,23002,(select jsonb_set(items,'{0,compassItemId}',to_jsonb(pg_temp.gid(24999)::text)) from reoriented_request))$$,
  'P0001','solmind_explorer_private_invalid_input','unknown point cannot substitute for a current owned point');
select throws_ok($$select * from pg_temp.arrange(24307,23002,(select jsonb_set(items,'{0,compassItemId}',to_jsonb(pg_temp.gid(24992)::text)) from reoriented_request))$$,
  'P0001','solmind_explorer_private_invalid_input','foreign saved point is refused despite its genuine existing ID');
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
select throws_ok($$select * from pg_temp.arrange(24316,null,(select items from reoriented_request))$$,
  'P0001','solmind_explorer_private_invalid_input','an existing confirmed Priority cannot be cleared');
select throws_ok($$select * from pg_temp.arrange(24317,23001,(select items from reoriented_request))$$,
  'P0001','solmind_explorer_private_invalid_input','nonnull Priority must occupy apex');
select throws_ok($$select * from pg_temp.arrange(24318,23001,(select jsonb_set(jsonb_set(items,'{0,anchor}','"apex"'),'{1,anchor}','null') from reoriented_request))$$,
  'P0001','solmind_explorer_private_invalid_input','current attention cannot be silently put into Other paths');
select throws_ok($$select * from pg_temp.arrange(24102,23002,(select jsonb_set(items,'{0,emphasis}','2') from reoriented_request))$$,
  'P0001','solmind_explorer_private_operation_conflict','same operation with changed complete arrangement conflicts');
select is(pg_temp.read_state(),(select value from refusal_before),'every refused batch preserves all primary state, revision and history');
select ok(not exists(select 1 from ai.explorer_conversation_operation where conversation_id=pg_temp.gid(6005)
  and operation_id between pg_temp.gid(24301) and pg_temp.gid(24318)),
  'malformed/refused batches create no completed operation or partial arrangement');
select throws_ok($$select * from pg_temp.mutate(24203,'confirm_priority',null,23001)$$,
  'P0001','solmind_explorer_conversation_denied','old new-write Priority command cannot bypass the saved apex');
select throws_ok($$select * from pg_temp.mutate(24204,'set_attention',null,23009)$$,
  'P0001','solmind_explorer_conversation_denied','old new-write attention command cannot select overflow');
select is((select outcome from pg_temp.mutate(24201,'confirm_priority',null,23001)),'exact_replay',
  'old exact Priority replay resolves even though that old point is now off-apex');
select is(pg_temp.read_state(),(select value from refusal_before),'old refusals and legitimate exact replay preserve current layout and history');

-- Captured history is immutable and independent of later point wording.
update ai.explorer_conversation_compass_item set label='Later synthetic wording' where item_id=pg_temp.gid(23001);
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
    if not exists(select 1 from pg_temp.mutate(23000+n,'add_compass',10011,null,null,'Saved point '||n) where outcome='ok')
      then raise exception 'synthetic_compass_twentyfour_point_setup_failed'; end if;
  end loop;
end $$;
create temp table capacity_request as select jsonb_set(jsonb_set(pg_temp.layout(),'{0,anchor}','"upper_left"'),'{1,anchor}','"apex"') items;
select is((select outcome from pg_temp.arrange(24105,23002,(select items from capacity_request))),'ok',
  'complete twenty-four-point batch saves eight anchors plus sixteen explicit Other paths');
select ok((select count(*)=24 and count(*) filter(where c.compass_anchor is not null)=8
  and count(*) filter(where c.compass_anchor is null and c.relative_emphasis is not null)=16
  from ai.explorer_conversation_compass_item c where c.conversation_id=pg_temp.gid(6005)),
  'all twenty-four saved points remain, with eight visible and sixteen reviewable Other paths');
create temp table capacity_before as select pg_temp.read_state() value;
select is((select outcome from pg_temp.mutate(23025,'add_compass',10011,null,null,'Twenty-fifth refused point')),'unavailable',
  'twenty-fifth saved point is explicitly refused at the total capacity');
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
select throws_ok($$select * from pg_temp.arrange(24402,23002,(select jsonb_set(items,'{0,emphasis}','2') from capacity_request))$$,
  'P0001','solmind_explorer_private_denied','restricted policy denies new arrangement even with a complete valid batch');
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
-- Total capacity and visible capacity are independent: Discovery can retain all
-- twenty-four points as Other paths, without forcing an apex or Priority.
do $$ begin
  for n in 1..23 loop
    if not exists(select 1 from public.solmind_mutate_explorer_conversation_v3(pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6105),
      pg_temp.gid(24500+n),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6105)),
      'add_compass',pg_temp.request_sha(24500+n),pg_temp.gid(24991),null,null,'Other path '||n) where outcome='ok')
      then raise exception 'synthetic_discovery_capacity_setup_failed'; end if;
  end loop;
end $$;
select is((select outcome from public.solmind_confirm_explorer_compass_arrangement_v1(pg_temp.gid(4),pg_temp.gid(54),pg_temp.gid(6105),
  pg_temp.gid(24600),(select revision from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6105)),pg_temp.request_sha(24600),null,
  (select jsonb_agg(jsonb_build_object('compassItemId',item_id,'anchor',null,'emphasis',1) order by item_id)
    from ai.explorer_conversation_compass_item where conversation_id=pg_temp.gid(6105)))),'ok',
  'Discovery may explicitly retain twenty-four Other paths with zero visible anchors');
select ok((select count(*)=24 and bool_and(compass_anchor is null and relative_emphasis=1)
  from ai.explorer_conversation_compass_item where conversation_id=pg_temp.gid(6105))
  and (select priority_id is null from ai.explorer_conversation_state where conversation_id=pg_temp.gid(6105)),
  'there is no independent sixteen-Other-path cap or automatically invented Priority');
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
