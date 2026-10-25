-- SolMind MVP0: closed, Guide-scoped methodology governance construction.
-- Owners in solmind-docs:
-- canonical/09_SolMind_MethodologyGovernance_v1_0.md;
-- execution/03_SolMind_Phase0_Data_Model_Spec_v1_1.md Sections18/24/29;
-- execution/04_SolMind_AI_Orchestration_Spec_v1_0.md Section9;
-- execution/22_SolMind_MVP0_Auth_RLS_Audit_Persistence_Contract_v0_1.md Section7.3.
-- Proposal support GOVERNANCE_INTERFACE_R01.md pins public interfaces.
-- No seed, genuine screen/provider call, UI, default factory activation, direct
-- API table grants, old-snapshot backfill, or change to the existing v2 RPC.
-- Trusted service code attests screen receipt hashes; SQL does not prove a real
-- external call, source rights, policy approval, or the truth of a human review.

create table methodology.workflow_operation (
  actor_user_account_id uuid not null references identity.user_account(user_account_id),
  operation_id uuid not null,
  user_session_id uuid not null references identity.user_session(user_session_id),
  operation_kind text not null check (operation_kind in
    ('register_v1','screen_start_v1','admin_review_v1','guide_approve_v1','guide_reject_v1')),
  request_sha256 text not null check (request_sha256 ~ '^[0-9A-F]{64}$'),
  methodology_context_pack_id uuid not null references methodology.methodology_context_pack(methodology_context_pack_id),
  methodology_context_pack_version_id uuid not null,
  audit_event_id uuid not null unique references audit.audit_event(audit_event_id),
  secondary_audit_event_id uuid null unique references audit.audit_event(audit_event_id),
  created_at timestamptz not null,
  retention_class text not null default 'security_log' check (retention_class='security_log'),
  primary key(actor_user_account_id,operation_id),
  foreign key(methodology_context_pack_id,methodology_context_pack_version_id) references
    methodology.methodology_context_pack_version(methodology_context_pack_id,methodology_context_pack_version_id),
  check ((operation_kind='guide_approve_v1')=(secondary_audit_event_id is not null))
);

create table methodology.screen_attempt (
  screen_operation_id uuid primary key,
  initiating_user_account_id uuid not null references identity.user_account(user_account_id),
  initiating_user_session_id uuid not null references identity.user_session(user_session_id),
  methodology_context_pack_id uuid not null references methodology.methodology_context_pack(methodology_context_pack_id),
  methodology_context_pack_version_id uuid not null unique,
  screen_invocation_id uuid not null unique references ai.ai_model_invocation(ai_model_invocation_id),
  subject_sha256 text not null check(subject_sha256 ~ '^[0-9A-F]{64}$'),
  task_code text not null check(task_code='methodology_safety_screen'),
  protocol_version text not null check(protocol_version='methodology-safety-screen.v1'),
  policy_version text not null check(policy_version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$'),
  policy_manifest_sha256 text not null check(policy_manifest_sha256 ~ '^[0-9A-F]{64}$'),
  request_sha256 text not null check(request_sha256 ~ '^[0-9A-F]{64}$'),
  provider_name text not null check(provider_name='openai'),
  model_name text not null check(model_name='gpt-5.6-luna'),
  started_at timestamptz not null,
  started_audit_event_id uuid not null references audit.audit_event(audit_event_id),
  terminal_status text null check(terminal_status in ('completed','failed','canceled')),
  terminal_sha256 text null check(terminal_sha256 ~ '^[0-9A-F]{64}$'),
  terminal_at timestamptz null,
  terminal_audit_event_id uuid null references audit.audit_event(audit_event_id),
  retention_class text not null default 'security_log' check(retention_class='security_log'),
  foreign key(methodology_context_pack_id,methodology_context_pack_version_id) references
    methodology.methodology_context_pack_version(methodology_context_pack_id,methodology_context_pack_version_id),
  foreign key(initiating_user_account_id,screen_operation_id) references
    methodology.workflow_operation(actor_user_account_id,operation_id) deferrable initially deferred,
  check ((terminal_status is null and terminal_sha256 is null and terminal_at is null and terminal_audit_event_id is null)
    or (terminal_status is not null and terminal_sha256 is not null and terminal_at>=started_at and terminal_audit_event_id is not null))
);

create table methodology.explorer_methodology_binding (
  ai_context_snapshot_id uuid primary key references ai.ai_context_snapshot(ai_context_snapshot_id),
  methodology_context_pack_id uuid not null references methodology.methodology_context_pack(methodology_context_pack_id),
  methodology_context_pack_version_id uuid not null,
  content_sha256 text not null check(content_sha256 ~ '^[0-9A-F]{64}$'),
  methodology_authorization_version text not null check(methodology_authorization_version ~ '^MV1:[0-9A-F]{64}$'),
  evidence_contract_version text not null default 'explorer-methodology-governance.v1'
    check(evidence_contract_version='explorer-methodology-governance.v1'),
  created_at timestamptz not null,
  retention_class text not null default 'sensitive_content' check(retention_class='sensitive_content'),
  foreign key(methodology_context_pack_id,methodology_context_pack_version_id) references
    methodology.methodology_context_pack_version(methodology_context_pack_id,methodology_context_pack_version_id)
);

alter table methodology.workflow_operation enable row level security;
alter table methodology.screen_attempt enable row level security;
alter table methodology.explorer_methodology_binding enable row level security;
revoke all on schema methodology from public,anon,authenticated,service_role;
revoke all on all tables in schema methodology from public,anon,authenticated,service_role;

create function methodology.hash_json(p_value jsonb) returns text language sql immutable strict
set search_path='' as $$
  select upper(encode(extensions.digest(convert_to(p_value::text,'UTF8'),'sha256'),'hex'))
$$;

-- JavaScript string length is UTF-16 units. PostgreSQL valid UTF8 already
-- excludes isolated surrogates/NUL. Reject exact bytes, never normalize them.
create function methodology.text_valid(p_text text,p_limit integer,p_trimmed boolean)
returns boolean language plpgsql immutable set search_path='' as $$
declare i integer; cp integer; units integer:=0;
  trim_chars text:=chr(9)||chr(10)||chr(11)||chr(12)||chr(13)||chr(32)||chr(160)||chr(5760)||
    chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||
    chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279);
begin
  if p_text is null or p_limit is null or p_limit<1 or p_trimmed is null
    or octet_length(p_text)>p_limit*4 or char_length(p_text)>p_limit
    or length(btrim(p_text,trim_chars))=0
    or (p_trimmed and p_text is distinct from btrim(p_text,trim_chars)) then return false; end if;
  for i in 1..char_length(p_text) loop
    cp:=ascii(substr(p_text,i,1));
    if cp between 0 and 9 or cp between 11 and 31 or cp between 127 and 159
      or cp=1564 or cp between 8203 and 8207 or cp between 8232 and 8238
      or cp=8288 or cp between 8294 and 8297 or cp=65279 then return false; end if;
    units:=units+case when cp>65535 then 2 else 1 end;
    if units>p_limit then return false; end if;
  end loop;
  return true;
end $$;

create function methodology.lock_pack(p_pack uuid,p_owner uuid default null)
returns methodology.methodology_context_pack language plpgsql volatile set search_path='' as $$
declare p methodology.methodology_context_pack%rowtype; gid uuid;
begin
  select x.guide_profile_id into gid from methodology.methodology_context_pack x
    where x.methodology_context_pack_id=p_pack and x.scope_type='guide';
  perform methodology.lock_guide(gid,p_owner);
  perform pg_advisory_xact_lock(hashtextextended('solmind:methodology:pack:v1|'||p_pack::text,0));
  select x.* into p from methodology.methodology_context_pack x where x.methodology_context_pack_id=p_pack for update;
  if not found or p.scope_type<>'guide' or p.guide_profile_id is distinct from gid
    or p.pack_status not in ('draft','active') then raise exception 'solmind_methodology_denied'; end if;
  return p;
end $$;

create function public.solmind_read_methodology_version(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_methodology_context_pack_id uuid,
  p_methodology_context_pack_version_id uuid
) returns table(version_record jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' as $$
declare role_name text; p methodology.methodology_context_pack%rowtype; v methodology.methodology_context_pack_version%rowtype;
begin
  select s.active_role_context into role_name from identity.user_session s where s.user_session_id=p_user_session_id;
  if role_name is null or role_name not in ('admin','guide') then raise exception 'solmind_methodology_denied'; end if;
  perform methodology.lock_human(p_actor_user_account_id,p_user_session_id,role_name);
  p:=methodology.lock_pack(p_methodology_context_pack_id,case when role_name='guide' then p_actor_user_account_id else null end);
  if p.created_by_role_context<>'admin' or (role_name='admin' and p.created_by_user_account_id<>p_actor_user_account_id)
    then raise exception 'solmind_methodology_denied'; end if;
  select x.* into v from methodology.methodology_context_pack_version x
    where x.methodology_context_pack_version_id=p_methodology_context_pack_version_id
      and x.methodology_context_pack_id=p_methodology_context_pack_id for share;
  if not found or v.created_by_actor_type<>'admin' or v.created_by_role_context<>'admin'
    or v.created_by_user_account_id is distinct from p.created_by_user_account_id
    then raise exception 'solmind_methodology_denied'; end if;
  perform methodology.lock_human(p_actor_user_account_id,p_user_session_id,role_name);
  -- This privileged workflow read is not an Explorer/browser serialization.
  return query select jsonb_build_object('packId',p.methodology_context_pack_id,'scopeType','guide','scopeId',p.guide_profile_id,
    'packStatus',p.pack_status,'activeVersionId',p.active_version_id,'version',to_jsonb(v));
exception when others then
  if SQLSTATE='P0001' and SQLERRM like 'solmind_methodology_%' then raise; end if;
  raise exception 'solmind_methodology_unavailable';
end $$;

create function public.solmind_prepare_methodology_screen(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_operation_id uuid,
  p_methodology_context_pack_id uuid,p_methodology_context_pack_version_id uuid,p_screen_invocation_id uuid,
  p_content_sha256 text,p_policy_version text,p_policy_manifest_sha256 text,p_request_sha256 text
) returns table(outcome text,screen_invocation_id uuid,dispatch_permitted boolean)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' as $$
declare ts timestamptz; h text; old_op methodology.workflow_operation%rowtype;
  v methodology.methodology_context_pack_version%rowtype; a methodology.screen_attempt%rowtype;
  pack methodology.methodology_context_pack%rowtype;
  eid uuid:=gen_random_uuid();
begin
  if p_operation_id is null or p_methodology_context_pack_id is null or p_methodology_context_pack_version_id is null
    or p_screen_invocation_id is null or p_content_sha256 is null or p_content_sha256 !~ '^[0-9A-F]{64}$'
    or p_policy_version is null or p_policy_version !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$'
    or p_policy_manifest_sha256 is null or p_policy_manifest_sha256 !~ '^[0-9A-F]{64}$'
    or p_request_sha256 is null or p_request_sha256 !~ '^[0-9A-F]{64}$'
  then raise exception 'solmind_methodology_invalid_input'; end if;
  h:=methodology.hash_json(jsonb_build_array('screen_start_v1',p_user_session_id,p_methodology_context_pack_id,
    p_methodology_context_pack_version_id,p_screen_invocation_id,p_content_sha256,'methodology_safety_screen',
    'methodology-safety-screen.v1',p_policy_version,p_policy_manifest_sha256,p_request_sha256,'openai','gpt-5.6-luna'));
  perform pg_advisory_xact_lock(hashtextextended('solmind:methodology:operation:v1|'||p_actor_user_account_id::text||'|'||p_operation_id::text,0));
  ts:=methodology.lock_human(p_actor_user_account_id,p_user_session_id,'admin');
  pack:=methodology.lock_pack(p_methodology_context_pack_id);
  if pack.created_by_role_context<>'admin' or pack.created_by_user_account_id is distinct from p_actor_user_account_id
    then raise exception 'solmind_methodology_denied'; end if;
  select x.* into old_op from methodology.workflow_operation x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id;
  if found then
    if old_op.operation_kind<>'screen_start_v1' or old_op.request_sha256<>h then raise exception 'solmind_methodology_operation_conflict'; end if;
    select x.* into a from methodology.screen_attempt x where x.screen_operation_id=p_operation_id;
    if not found or a.screen_invocation_id<>p_screen_invocation_id then raise exception 'solmind_methodology_denied'; end if;
    return query select 'exact_replay'::text,p_screen_invocation_id,false; return;
  end if;
  select x.* into v from methodology.methodology_context_pack_version x
    where x.methodology_context_pack_version_id=p_methodology_context_pack_version_id
      and x.methodology_context_pack_id=p_methodology_context_pack_id for update;
  if not found or v.approval_status<>'draft' or v.safety_screen_completed_at is not null
    or v.content_sha256<>p_content_sha256 or v.created_by_actor_type<>'admin'
    or v.created_by_user_account_id is distinct from p_actor_user_account_id
    or not methodology.text_valid(v.content_markdown,24000,true)
    or exists(select 1 from methodology.screen_attempt x where x.methodology_context_pack_version_id=p_methodology_context_pack_version_id)
  then raise exception 'solmind_methodology_denied'; end if;
  ts:=clock_timestamp();
  insert into ai.ai_model_invocation(ai_model_invocation_id,provider_name,model_name,prompt_version,
    request_status,started_at,metadata)
    values(p_screen_invocation_id,'openai','gpt-5.6-luna','methodology-safety-screen.v1','started',ts,
      jsonb_build_object('task','methodology_safety_screen','protocol_version','methodology-safety-screen.v1',
        'screen_operation_id',p_operation_id::text,'methodology_context_pack_version_id',p_methodology_context_pack_version_id::text,
        'subject_sha256',p_content_sha256,'policy_version',p_policy_version,'policy_manifest_sha256',p_policy_manifest_sha256,
        'request_sha256',p_request_sha256));
  insert into audit.audit_event(audit_event_id,event_type,actor_role_context,target_entity_type,target_entity_id,
    action,reason_code,event_summary,metadata,created_at)
    values(eid,'methodology_context_pack_screen_started','system','methodology_context_pack_version',p_methodology_context_pack_version_id,
      'start','methodology_screen_prepared','Methodology screen prepared.',
      jsonb_build_object('methodology_context_pack_version_id',p_methodology_context_pack_version_id::text,
        'screen_invocation_id',p_screen_invocation_id::text,'screen_operation_id',p_operation_id::text),ts);
  insert into methodology.workflow_operation values(p_actor_user_account_id,p_operation_id,p_user_session_id,'screen_start_v1',h,
    p_methodology_context_pack_id,p_methodology_context_pack_version_id,eid,null,ts,'security_log');
  insert into methodology.screen_attempt(screen_operation_id,initiating_user_account_id,initiating_user_session_id,
    methodology_context_pack_id,methodology_context_pack_version_id,screen_invocation_id,subject_sha256,task_code,protocol_version,
    policy_version,policy_manifest_sha256,request_sha256,provider_name,model_name,started_at,started_audit_event_id)
    values(p_operation_id,p_actor_user_account_id,p_user_session_id,p_methodology_context_pack_id,p_methodology_context_pack_version_id,
      p_screen_invocation_id,p_content_sha256,'methodology_safety_screen','methodology-safety-screen.v1',p_policy_version,
      p_policy_manifest_sha256,p_request_sha256,'openai','gpt-5.6-luna',ts,eid);
  perform methodology.lock_human(p_actor_user_account_id,p_user_session_id,'admin');
  return query select 'ok'::text,p_screen_invocation_id,true;
exception when others then
  if SQLSTATE='P0001' and SQLERRM like 'solmind_methodology_%' then raise; end if;
  raise exception 'solmind_methodology_unavailable';
end $$;

-- System settlement is deliberately separate from human authorization. It can
-- close the exact already-started receipt after logout, without creating another
-- attempt, authorizing dispatch, returning content, or approving a version.
create function public.solmind_record_methodology_screen(
  p_screen_operation_id uuid,p_screen_invocation_id uuid,p_methodology_context_pack_version_id uuid,
  p_subject_sha256 text,p_request_sha256 text,p_terminal_status text,p_result jsonb
) returns table(outcome text)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' as $$
declare a methodology.screen_attempt%rowtype; v methodology.methodology_context_pack_version%rowtype;
  inv ai.ai_model_invocation%rowtype; ts timestamptz; h text; eid uuid:=gen_random_uuid(); expected_meta jsonb;
begin
  if current_setting('transaction_isolation')<>'read committed' or p_screen_operation_id is null
    or p_screen_invocation_id is null or p_methodology_context_pack_version_id is null
    or p_subject_sha256 is null or p_subject_sha256 !~ '^[0-9A-F]{64}$'
    or p_request_sha256 is null or p_request_sha256 !~ '^[0-9A-F]{64}$'
    or p_terminal_status is null or p_terminal_status not in ('completed','failed','canceled')
    or (p_terminal_status='completed') is distinct from (p_result is not null)
  then raise exception 'solmind_methodology_invalid_input'; end if;
  select x.* into a from methodology.screen_attempt x where x.screen_operation_id=p_screen_operation_id;
  if not found then raise exception 'solmind_methodology_denied'; end if;
  -- Settlement does not reacquire mutable human role eligibility; use the same
  -- operation -> pack -> version -> attempt order, requiring immutable receipt.
  perform pg_advisory_xact_lock(hashtextextended('solmind:methodology:operation:v1|'||a.initiating_user_account_id::text||'|'||p_screen_operation_id::text,0));
  perform p.methodology_context_pack_id from methodology.methodology_context_pack p
    where p.methodology_context_pack_id=a.methodology_context_pack_id and p.scope_type='guide' for update;
  if not found then raise exception 'solmind_methodology_denied'; end if;
  select x.* into v from methodology.methodology_context_pack_version x
    where x.methodology_context_pack_version_id=p_methodology_context_pack_version_id for update;
  select x.* into a from methodology.screen_attempt x where x.screen_operation_id=p_screen_operation_id for update;
  if not found or a.screen_invocation_id<>p_screen_invocation_id
    or a.methodology_context_pack_version_id<>p_methodology_context_pack_version_id
    or a.subject_sha256<>p_subject_sha256 or a.request_sha256<>p_request_sha256
    or v.methodology_context_pack_id is distinct from a.methodology_context_pack_id
    or v.content_sha256 is distinct from a.subject_sha256
  then raise exception 'solmind_methodology_denied'; end if;
  if p_terminal_status='completed' and not methodology.screen_result_valid(p_result,v.content_markdown,v.content_sha256)
    then raise exception 'solmind_methodology_invalid_input'; end if;
  h:=methodology.hash_json(jsonb_build_array(p_screen_operation_id,p_screen_invocation_id,p_methodology_context_pack_version_id,
    p_subject_sha256,p_request_sha256,p_terminal_status,p_result));
  if a.terminal_status is not null then
    if a.terminal_sha256<>h then raise exception 'solmind_methodology_operation_conflict'; end if;
    return query select 'exact_replay'::text; return;
  end if;
  expected_meta:=jsonb_build_object('task',a.task_code,'protocol_version',a.protocol_version,
    'screen_operation_id',a.screen_operation_id::text,'methodology_context_pack_version_id',a.methodology_context_pack_version_id::text,
    'subject_sha256',a.subject_sha256,'policy_version',a.policy_version,'policy_manifest_sha256',a.policy_manifest_sha256,
    'request_sha256',a.request_sha256);
  select x.* into inv from ai.ai_model_invocation x where x.ai_model_invocation_id=p_screen_invocation_id for update;
  if not found or inv.request_status<>'started' or inv.completed_at is not null or inv.provider_name<>a.provider_name
    or inv.model_name<>a.model_name or inv.prompt_version<>a.protocol_version or inv.started_at<>a.started_at
    or inv.metadata<>expected_meta or inv.ai_interaction_session_id is not null or inv.ai_interaction_message_id is not null
    or inv.logical_operation_id is not null or inv.ai_context_snapshot_id is not null or inv.dispatch_contract_version is not null
    or v.approval_status<>'draft' or v.safety_screen_completed_at is not null
  then raise exception 'solmind_methodology_denied'; end if;
  ts:=clock_timestamp();
  update ai.ai_model_invocation set request_status=p_terminal_status,completed_at=ts,
    safety_result=case when p_terminal_status='completed' then jsonb_build_object('screen_result',p_result->>'result') else '{}'::jsonb end,
    error_summary=case when p_terminal_status='failed' then 'methodology_screen_failed' else null end
    where ai_model_invocation_id=p_screen_invocation_id;
  if p_terminal_status='completed' then
    insert into audit.audit_event(audit_event_id,event_type,actor_role_context,target_entity_type,target_entity_id,
      action,reason_code,event_summary,metadata,created_at)
      values(eid,'context_pack_safety_screen','system','methodology_context_pack_version',p_methodology_context_pack_version_id,
        'screen','methodology_safety_screen_completed','Methodology safety screen recorded.',
        jsonb_build_object('methodology_context_pack_version_id',p_methodology_context_pack_version_id::text,
          'screen_result',p_result->>'result','screen_invocation_id',p_screen_invocation_id::text),ts);
    update methodology.methodology_context_pack_version set safety_screen_result=p_result->>'result',
      safety_screen_invocation_id=p_screen_invocation_id,safety_screen_audit_event_id=eid,safety_screen_completed_at=ts,
      metadata=jsonb_build_object('safety_screen',jsonb_build_object('result',p_result->>'result',
        'screen_invocation_id',p_screen_invocation_id::text,'content_sha256',p_subject_sha256,'cited_excerpts',p_result->'findings'))
      where methodology_context_pack_version_id=p_methodology_context_pack_version_id;
  else
    insert into audit.audit_event(audit_event_id,event_type,actor_role_context,target_entity_type,target_entity_id,
      action,reason_code,event_summary,metadata,created_at)
      values(eid,'methodology_context_pack_screen_terminated','system','methodology_context_pack_version',p_methodology_context_pack_version_id,
        'settle',case when p_terminal_status='failed' then 'methodology_screen_failed' else 'methodology_screen_canceled' end,
        'Methodology screen terminated.',jsonb_build_object('methodology_context_pack_version_id',p_methodology_context_pack_version_id::text,
          'screen_invocation_id',p_screen_invocation_id::text,'screen_operation_id',p_screen_operation_id::text),ts);
  end if;
  update methodology.screen_attempt set terminal_status=p_terminal_status,terminal_sha256=h,terminal_at=ts,terminal_audit_event_id=eid
    where screen_operation_id=p_screen_operation_id;
  return query select 'ok'::text;
exception when others then
  if SQLSTATE='P0001' and SQLERRM like 'solmind_methodology_%' then raise; end if;
  raise exception 'solmind_methodology_unavailable';
end $$;

create function methodology.guard_append_only() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'solmind_methodology_evidence_immutable'; end $$;
create trigger methodology_operation_append_only before update or delete on methodology.workflow_operation
  for each row execute function methodology.guard_append_only();
create trigger methodology_binding_append_only before update or delete on methodology.explorer_methodology_binding
  for each row execute function methodology.guard_append_only();

create function methodology.guard_screen_attempt() returns trigger language plpgsql set search_path='' as $$
begin
  if TG_OP='DELETE' or OLD.terminal_status is not null
    or (to_jsonb(NEW)-array['terminal_status','terminal_sha256','terminal_at','terminal_audit_event_id']::text[])
      is distinct from (to_jsonb(OLD)-array['terminal_status','terminal_sha256','terminal_at','terminal_audit_event_id']::text[])
    or NEW.terminal_status is null then raise exception 'solmind_methodology_evidence_immutable'; end if;
  return NEW;
end $$;
create trigger methodology_screen_attempt_once before update or delete on methodology.screen_attempt
  for each row execute function methodology.guard_screen_attempt();

create function methodology.guard_screen_invocation() returns trigger language plpgsql set search_path='' as $$
begin
  if exists(select 1 from methodology.screen_attempt a where a.screen_invocation_id=OLD.ai_model_invocation_id) then
    if TG_OP='DELETE' or OLD.request_status<>'started'
      or (to_jsonb(NEW)-array['request_status','completed_at','safety_result','error_summary']::text[])
        is distinct from (to_jsonb(OLD)-array['request_status','completed_at','safety_result','error_summary']::text[])
      or NEW.request_status not in ('completed','failed','canceled')
      then raise exception 'solmind_methodology_evidence_immutable'; end if;
  end if;
  if TG_OP='DELETE' then return OLD; end if;
  return NEW;
end $$;
create trigger methodology_screen_invocation_once before update or delete on ai.ai_model_invocation
  for each row execute function methodology.guard_screen_invocation();

create function methodology.guard_pack_identity() returns trigger language plpgsql set search_path='' as $$
begin
  -- Stored generated columns are not populated in NEW during BEFORE UPDATE.
  -- Freeze every actual scope input; PostgreSQL alone recomputes scope_id.
  if TG_OP='DELETE' or (to_jsonb(NEW)-array['pack_status','active_version_id','scope_id']::text[])
    is distinct from (to_jsonb(OLD)-array['pack_status','active_version_id','scope_id']::text[])
  then raise exception 'solmind_methodology_pack_immutable'; end if;
  return NEW;
end $$;
create trigger methodology_pack_identity_immutable before update or delete on methodology.methodology_context_pack
  for each row execute function methodology.guard_pack_identity();

create function methodology.guard_governance_audit() returns trigger language plpgsql set search_path='' as $$
begin
  if OLD.event_type in ('context_pack_safety_screen','methodology_context_pack_version_created',
    'methodology_context_pack_admin_reviewed','methodology_context_pack_guide_approved',
    'methodology_context_pack_guide_rejected','methodology_context_pack_version_activated',
    'methodology_context_pack_screen_started','methodology_context_pack_screen_terminated')
    or (TG_OP='UPDATE' and NEW.event_type in ('context_pack_safety_screen','methodology_context_pack_version_created',
    'methodology_context_pack_admin_reviewed','methodology_context_pack_guide_approved',
    'methodology_context_pack_guide_rejected','methodology_context_pack_version_activated',
    'methodology_context_pack_screen_started','methodology_context_pack_screen_terminated'))
  then raise exception 'solmind_methodology_audit_immutable'; end if;
  if TG_OP='DELETE' then return OLD; end if;
  return NEW;
end $$;
create trigger methodology_closed_audit_immutable before update or delete on audit.audit_event
  for each row execute function methodology.guard_governance_audit();

-- All owning writes use operation -> account domain -> account/role/session ->
-- Guide account/profile -> pack -> version -> screen/invocation -> audit order.
-- Explorer uses its unchanged v2 authority order before Guide/pack locks. No
-- provider I/O occurs here. READ COMMITTED + two-second locks fail closed.
create function methodology.lock_human(p_actor uuid,p_session uuid,p_role text)
returns timestamptz language plpgsql volatile set search_path='' as $$
declare ts timestamptz; s identity.user_session%rowtype;
begin
  if current_setting('transaction_isolation')<>'read committed' or p_actor is null or p_session is null
    or p_role not in ('admin','guide') then raise exception 'solmind_methodology_denied'; end if;
  perform pg_advisory_xact_lock(hashtextextended('solmind:authorizing-domain:account:v1|'||p_actor::text,0));
  perform a.user_account_id from identity.user_account a join identity.user_role_assignment r
    on r.user_account_id=a.user_account_id where a.user_account_id=p_actor and a.account_status='active'
    and r.role_code=p_role and r.role_status='active' and r.revoked_at is null and r.granted_at<=clock_timestamp()
    for share of a,r;
  if not found then raise exception 'solmind_methodology_denied'; end if;
  select x.* into s from identity.user_session x where x.user_session_id=p_session for share;
  ts:=clock_timestamp();
  if not found or s.user_account_id is distinct from p_actor or s.active_role_context is distinct from p_role
    or s.session_status is distinct from 'active' or s.ended_at is not null or s.created_at>ts or s.expires_at<=ts
    or (select count(*) from identity.user_session x where x.user_account_id=p_actor
      and x.session_status='active' and x.ended_at is null and x.expires_at>ts)<>1
  then raise exception 'solmind_methodology_denied'; end if;
  return ts;
end $$;

create function methodology.lock_guide(p_guide uuid,p_expected_actor uuid default null)
returns uuid language plpgsql volatile set search_path='' as $$
declare owner_id uuid; g core.guide_profile%rowtype;
begin
  select x.user_account_id into owner_id from core.guide_profile x where x.guide_profile_id=p_guide;
  if owner_id is null or (p_expected_actor is not null and owner_id is distinct from p_expected_actor)
    then raise exception 'solmind_methodology_denied'; end if;
  perform a.user_account_id from identity.user_account a join identity.user_role_assignment r
    on r.user_account_id=a.user_account_id where a.user_account_id=owner_id and a.account_status='active'
    and r.role_code='guide' and r.role_status='active' and r.revoked_at is null and r.granted_at<=clock_timestamp()
    for share of a,r;
  if not found then raise exception 'solmind_methodology_denied'; end if;
  select x.* into g from core.guide_profile x where x.guide_profile_id=p_guide for share;
  if not found or g.user_account_id is distinct from owner_id or g.status<>'active' or g.setup_status<>'approved'
    then raise exception 'solmind_methodology_denied'; end if;
  return owner_id;
end $$;

create function methodology.historical_session_valid(p_actor uuid,p_session uuid,p_role text,p_at timestamptz)
returns boolean language plpgsql volatile set search_path='' as $$
declare s identity.user_session%rowtype;
begin
  select x.* into s from identity.user_session x where x.user_session_id=p_session for share;
  if not found then return false; end if;
  return coalesce(s.user_account_id=p_actor and s.active_role_context=p_role and s.created_at<=p_at and s.expires_at>p_at
    and (s.ended_at is null or s.ended_at>=p_at)
    and exists(select 1 from identity.user_role_assignment r where r.user_account_id=p_actor and r.role_code=p_role
      and r.granted_at<=p_at and (r.revoked_at is null or r.revoked_at>=p_at)),false);
end $$;

-- Internal verifier, never an audit writer or public generic event port.
create function methodology.audit_matches(p_id uuid,p_event text,p_actor uuid,p_role text,p_version uuid,
  p_action text,p_reason text,p_summary text,p_metadata jsonb,p_at timestamptz)
returns boolean language plpgsql volatile set search_path='' as $$
declare e audit.audit_event%rowtype;
begin
  select x.* into e from audit.audit_event x where x.audit_event_id=p_id for share;
  return coalesce(found and e.event_type=p_event and e.actor_user_account_id is not distinct from p_actor
    and e.actor_role_context=p_role and e.target_entity_type='methodology_context_pack_version'
    and e.target_entity_id=p_version and e.action=p_action and e.reason_code=p_reason
    and e.event_summary=p_summary and e.metadata=p_metadata and e.created_at=p_at and e.retention_class='security_log',false);
end $$;

create function methodology.screen_result_valid(p_result jsonb,p_content text,p_sha text)
returns boolean language plpgsql immutable set search_path='' as $$
declare f jsonb; duplicate_keys text[]:='{}'; k text; any_fail boolean:=false;
begin
  if p_result is null or jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>65536
    or (select array_agg(x order by x) from jsonb_object_keys(p_result) x)
      is distinct from array['findings','result','subject_sha256']::text[]
    or jsonb_typeof(p_result->'result') is distinct from 'string' or p_result->>'result' not in ('pass','review','fail')
    or jsonb_typeof(p_result->'subject_sha256') is distinct from 'string' or p_result->>'subject_sha256' is distinct from p_sha
    or jsonb_typeof(p_result->'findings') is distinct from 'array' or jsonb_array_length(p_result->'findings')>16
    then return false; end if;
  for f in select value from jsonb_array_elements(p_result->'findings') loop
    if jsonb_typeof(f)<>'object' or (select array_agg(x order by x) from jsonb_object_keys(f) x)
      is distinct from array['criterion','excerpt','explanation','severity']::text[]
      or jsonb_typeof(f->'criterion') is distinct from 'string' or jsonb_typeof(f->'severity') is distinct from 'string'
      or f->>'criterion' not in ('boundary_override','false_identity','crisis_override','diagnosis_framework','concealment',
        'dependency','superiority','manipulative_certainty','identity_imposition','emotional_coercion','unsafe_escalation',
        'ideological_rigidity','shame','exploitation','manipulative_urgency','cult_dynamics','fear_dependency','infallible_authority')
      or f->>'severity' not in ('review','fail') or jsonb_typeof(f->'excerpt')<>'string'
      or jsonb_typeof(f->'explanation')<>'string' or not methodology.text_valid(f->>'excerpt',512,false)
      or not methodology.text_valid(f->>'explanation',768,true) or strpos(p_content,f->>'excerpt')=0
      then return false; end if;
    k:=jsonb_build_array(f->>'criterion',f->>'excerpt')::text;
    if k=any(duplicate_keys) then return false; end if;
    duplicate_keys:=array_append(duplicate_keys,k);
    any_fail:=any_fail or f->>'severity'='fail';
  end loop;
  return coalesce((p_result->>'result'='pass' and jsonb_array_length(p_result->'findings')=0)
    or (p_result->>'result'='review' and jsonb_array_length(p_result->'findings')>0 and not any_fail)
    or (p_result->>'result'='fail' and any_fail),false);
exception when others then return false;
end $$;

create function public.solmind_register_methodology_version(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_operation_id uuid,
  p_methodology_context_pack_id uuid,p_methodology_context_pack_version_id uuid,p_guide_profile_id uuid,
  p_expected_previous_version_id uuid,p_pack_name text,p_content_markdown text,p_source_type text,
  p_source_actor_label text,p_source_provenance jsonb,p_ai_change_summary text
) returns table(outcome text,methodology_context_pack_version_id uuid,version_number integer,content_sha256 text)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' as $$
declare ts timestamptz; h text; sha text; old_op methodology.workflow_operation%rowtype;
  p methodology.methodology_context_pack%rowtype; prev methodology.methodology_context_pack_version%rowtype;
  n integer; eid uuid:=gen_random_uuid();
begin
  if p_operation_id is null or p_methodology_context_pack_id is null or p_methodology_context_pack_version_id is null
    or p_guide_profile_id is null or not methodology.text_valid(p_pack_name,160,true)
    or not methodology.text_valid(p_content_markdown,24000,true)
    or p_source_type is null or p_source_type not in ('manual_entry','admin_assisted','ai_generated','imported_from_source_material')
    or not methodology.text_valid(p_source_actor_label,160,true) or not methodology.text_valid(p_ai_change_summary,2000,true)
    or p_source_provenance is null or jsonb_typeof(p_source_provenance)<>'array'
    or jsonb_array_length(p_source_provenance) not between 1 and 16 or octet_length(p_source_provenance::text)>8192
    or exists(select 1 from jsonb_array_elements(p_source_provenance) x where jsonb_typeof(x)<>'object'
      or x='{}'::jsonb or octet_length(x::text)>2048)
  then raise exception 'solmind_methodology_invalid_input'; end if;
  h:=methodology.hash_json(jsonb_build_array('register_v1',p_user_session_id,p_methodology_context_pack_id,
    p_methodology_context_pack_version_id,p_guide_profile_id,p_expected_previous_version_id,p_pack_name,
    p_content_markdown,p_source_type,p_source_actor_label,p_source_provenance,p_ai_change_summary));
  perform pg_advisory_xact_lock(hashtextextended('solmind:methodology:operation:v1|'||p_actor_user_account_id::text||'|'||p_operation_id::text,0));
  ts:=methodology.lock_human(p_actor_user_account_id,p_user_session_id,'admin');
  perform methodology.lock_guide(p_guide_profile_id);
  select x.* into old_op from methodology.workflow_operation x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id;
  if found then
    if old_op.operation_kind<>'register_v1' or old_op.request_sha256<>h then raise exception 'solmind_methodology_operation_conflict'; end if;
    return query select 'exact_replay'::text,v.methodology_context_pack_version_id,v.version_number,v.content_sha256
      from methodology.methodology_context_pack_version v where v.methodology_context_pack_version_id=old_op.methodology_context_pack_version_id;
    return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('solmind:methodology:pack:v1|'||p_methodology_context_pack_id::text,0));
  select x.* into p from methodology.methodology_context_pack x where x.methodology_context_pack_id=p_methodology_context_pack_id for update;
  if not found then
    if p_expected_previous_version_id is not null then raise exception 'solmind_methodology_operation_conflict'; end if;
    insert into methodology.methodology_context_pack(methodology_context_pack_id,scope_type,guide_profile_id,pack_name,
      created_by_user_account_id,created_by_role_context,created_at)
      values(p_methodology_context_pack_id,'guide',p_guide_profile_id,p_pack_name,p_actor_user_account_id,'admin',ts);
    n:=1;
  else
    if p.scope_type<>'guide' or p.guide_profile_id<>p_guide_profile_id or p.pack_name<>p_pack_name
      or p.created_by_role_context<>'admin' or p.created_by_user_account_id is distinct from p_actor_user_account_id
      or p.pack_status not in ('draft','active') then raise exception 'solmind_methodology_denied'; end if;
    select x.* into prev from methodology.methodology_context_pack_version x
      where x.methodology_context_pack_id=p_methodology_context_pack_id order by x.version_number desc limit 1 for update;
    if not found or prev.methodology_context_pack_version_id is distinct from p_expected_previous_version_id
      or prev.version_number=2147483647 then raise exception 'solmind_methodology_operation_conflict'; end if;
    n:=prev.version_number+1;
  end if;
  sha:=upper(encode(extensions.digest(convert_to(p_content_markdown,'UTF8'),'sha256'),'hex'));
  insert into methodology.methodology_context_pack_version(methodology_context_pack_version_id,methodology_context_pack_id,
    version_number,previous_version_id,content_markdown,content_sha256,created_by_actor_type,created_by_user_account_id,
    created_by_role_context,source_type,source_actor_label,source_provenance,ai_change_summary,created_at)
    values(p_methodology_context_pack_version_id,p_methodology_context_pack_id,n,p_expected_previous_version_id,p_content_markdown,
      sha,'admin',p_actor_user_account_id,'admin',p_source_type,p_source_actor_label,p_source_provenance,p_ai_change_summary,ts);
  insert into audit.audit_event(audit_event_id,event_type,actor_user_account_id,actor_role_context,target_entity_type,target_entity_id,
    action,reason_code,event_summary,metadata,created_at)
    values(eid,'methodology_context_pack_version_created',p_actor_user_account_id,'admin','methodology_context_pack_version',
      p_methodology_context_pack_version_id,'create','methodology_draft_registered','Methodology version registered.',
      jsonb_build_object('operation_id',p_operation_id::text,'methodology_context_pack_id',p_methodology_context_pack_id::text,
        'user_session_id',p_user_session_id::text),ts);
  insert into methodology.workflow_operation values(p_actor_user_account_id,p_operation_id,p_user_session_id,'register_v1',h,
    p_methodology_context_pack_id,p_methodology_context_pack_version_id,eid,null,ts,'security_log');
  perform methodology.lock_human(p_actor_user_account_id,p_user_session_id,'admin');
  return query select 'ok'::text,p_methodology_context_pack_version_id,n,sha;
exception when others then
  if SQLSTATE='P0001' and SQLERRM like 'solmind_methodology_%' then raise; end if;
  raise exception 'solmind_methodology_unavailable';
end $$;

-- Closed evidence verification is shared by Admin review, Guide decision and
-- Explorer resolution. It rejects a merely well-shaped FK/pass fixture.
create function methodology.require_screen_evidence(p_version uuid)
returns jsonb language plpgsql volatile set search_path='' as $$
declare v methodology.methodology_context_pack_version%rowtype; a methodology.screen_attempt%rowtype;
  inv ai.ai_model_invocation%rowtype; op methodology.workflow_operation%rowtype; r jsonb; im jsonb; h text;
begin
  select x.* into v from methodology.methodology_context_pack_version x
    where x.methodology_context_pack_version_id=p_version for share;
  if not found or v.safety_screen_result not in ('pass','review') or v.safety_screen_completed_at is null
    or not methodology.text_valid(v.content_markdown,24000,true)
    or v.content_sha256 is distinct from upper(encode(extensions.digest(convert_to(v.content_markdown,'UTF8'),'sha256'),'hex'))
    or (select array_agg(x order by x) from jsonb_object_keys(v.metadata->'safety_screen') x)
      is distinct from array['cited_excerpts','content_sha256','result','screen_invocation_id']::text[]
    then raise exception 'solmind_methodology_denied'; end if;
  r:=jsonb_build_object('result',v.safety_screen_result,'subject_sha256',v.content_sha256,
    'findings',v.metadata->'safety_screen'->'cited_excerpts');
  if not methodology.screen_result_valid(r,v.content_markdown,v.content_sha256)
    then raise exception 'solmind_methodology_denied'; end if;
  select x.* into a from methodology.screen_attempt x where x.methodology_context_pack_version_id=p_version for share;
  if not found or a.methodology_context_pack_id<>v.methodology_context_pack_id or a.subject_sha256<>v.content_sha256
    or a.initiating_user_account_id is distinct from v.created_by_user_account_id or v.created_by_actor_type<>'admin'
    or a.terminal_status is distinct from 'completed' or a.screen_invocation_id<>v.safety_screen_invocation_id
    or a.terminal_at<>v.safety_screen_completed_at or a.terminal_audit_event_id<>v.safety_screen_audit_event_id
    or a.terminal_sha256 is distinct from methodology.hash_json(jsonb_build_array(a.screen_operation_id,a.screen_invocation_id,
      p_version,a.subject_sha256,a.request_sha256,'completed',r))
    then raise exception 'solmind_methodology_denied'; end if;
  im:=jsonb_build_object('task',a.task_code,'protocol_version',a.protocol_version,'screen_operation_id',a.screen_operation_id::text,
    'methodology_context_pack_version_id',p_version::text,'subject_sha256',a.subject_sha256,
    'policy_version',a.policy_version,'policy_manifest_sha256',a.policy_manifest_sha256,'request_sha256',a.request_sha256);
  select x.* into inv from ai.ai_model_invocation x where x.ai_model_invocation_id=a.screen_invocation_id for share;
  if not found or inv.request_status<>'completed' or inv.completed_at<>a.terminal_at or inv.started_at<>a.started_at
    or inv.provider_name<>a.provider_name or inv.model_name<>a.model_name or inv.prompt_version<>a.protocol_version
    or inv.metadata<>im or inv.safety_result<>jsonb_build_object('screen_result',v.safety_screen_result)
    or inv.error_summary is not null or inv.ai_interaction_session_id is not null or inv.ai_interaction_message_id is not null
    or inv.logical_operation_id is not null or inv.ai_context_snapshot_id is not null or inv.dispatch_contract_version is not null
    then raise exception 'solmind_methodology_denied'; end if;
  select x.* into op from methodology.workflow_operation x
    where x.actor_user_account_id=a.initiating_user_account_id and x.operation_id=a.screen_operation_id for share;
  h:=methodology.hash_json(jsonb_build_array('screen_start_v1',a.initiating_user_session_id,a.methodology_context_pack_id,
    p_version,a.screen_invocation_id,a.subject_sha256,a.task_code,a.protocol_version,a.policy_version,
    a.policy_manifest_sha256,a.request_sha256,a.provider_name,a.model_name));
  if not found or op.operation_kind<>'screen_start_v1' or op.request_sha256<>h
    or op.user_session_id<>a.initiating_user_session_id or op.methodology_context_pack_id<>a.methodology_context_pack_id
    or op.methodology_context_pack_version_id<>p_version or op.audit_event_id<>a.started_audit_event_id or op.created_at<>a.started_at
    or not methodology.historical_session_valid(a.initiating_user_account_id,a.initiating_user_session_id,'admin',a.started_at)
    or not methodology.audit_matches(a.started_audit_event_id,'methodology_context_pack_screen_started',null,'system',p_version,
      'start','methodology_screen_prepared','Methodology screen prepared.',jsonb_build_object(
        'methodology_context_pack_version_id',p_version::text,'screen_invocation_id',a.screen_invocation_id::text,
        'screen_operation_id',a.screen_operation_id::text),a.started_at)
    or not methodology.audit_matches(v.safety_screen_audit_event_id,'context_pack_safety_screen',null,'system',p_version,
      'screen','methodology_safety_screen_completed','Methodology safety screen recorded.',jsonb_build_object(
        'methodology_context_pack_version_id',p_version::text,'screen_result',v.safety_screen_result,
        'screen_invocation_id',a.screen_invocation_id::text),a.terminal_at)
    then raise exception 'solmind_methodology_denied'; end if;
  return jsonb_build_object('screenOperationId',a.screen_operation_id,'screenInvocationId',a.screen_invocation_id,
    'subjectSha256',a.subject_sha256,'task',a.task_code,'protocol',a.protocol_version,'policyVersion',a.policy_version,
    'policyManifestSha256',a.policy_manifest_sha256,'requestSha256',a.request_sha256,'provider',a.provider_name,'model',a.model_name,
    'startedEpoch',extract(epoch from a.started_at),'startedAuditId',a.started_audit_event_id,'completedEpoch',extract(epoch from a.terminal_at),
    'completedAuditId',a.terminal_audit_event_id,'terminalSha256',a.terminal_sha256,'result',r);
end $$;

create function public.solmind_confirm_methodology_admin_review(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_operation_id uuid,
  p_methodology_context_pack_id uuid,p_methodology_context_pack_version_id uuid,
  p_content_sha256 text,p_screen_invocation_id uuid
) returns table(outcome text,admin_consistency_audit_event_id uuid)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' as $$
declare ts timestamptz; h text; eid uuid:=gen_random_uuid(); op methodology.workflow_operation%rowtype;
  p methodology.methodology_context_pack%rowtype; v methodology.methodology_context_pack_version%rowtype;
begin
  if p_operation_id is null or p_methodology_context_pack_id is null or p_methodology_context_pack_version_id is null
    or p_content_sha256 is null or p_content_sha256 !~ '^[0-9A-F]{64}$' or p_screen_invocation_id is null
    then raise exception 'solmind_methodology_invalid_input'; end if;
  h:=methodology.hash_json(jsonb_build_array('admin_review_v1',p_user_session_id,p_methodology_context_pack_id,
    p_methodology_context_pack_version_id,p_content_sha256,p_screen_invocation_id));
  perform pg_advisory_xact_lock(hashtextextended('solmind:methodology:operation:v1|'||p_actor_user_account_id::text||'|'||p_operation_id::text,0));
  perform methodology.lock_human(p_actor_user_account_id,p_user_session_id,'admin');
  p:=methodology.lock_pack(p_methodology_context_pack_id);
  if p.created_by_role_context<>'admin' or p.created_by_user_account_id is distinct from p_actor_user_account_id
    then raise exception 'solmind_methodology_denied'; end if;
  select x.* into op from methodology.workflow_operation x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id;
  if found then
    if op.operation_kind<>'admin_review_v1' or op.request_sha256<>h then raise exception 'solmind_methodology_operation_conflict'; end if;
    return query select 'exact_replay'::text,op.audit_event_id; return;
  end if;
  select x.* into v from methodology.methodology_context_pack_version x
    where x.methodology_context_pack_version_id=p_methodology_context_pack_version_id
      and x.methodology_context_pack_id=p_methodology_context_pack_id for update;
  if not found or v.created_by_actor_type<>'admin' or v.created_by_user_account_id is distinct from p_actor_user_account_id
    or v.approval_status<>'draft' or v.content_sha256<>p_content_sha256 or v.safety_screen_invocation_id<>p_screen_invocation_id
    or v.admin_consistency_reviewed_at is not null then raise exception 'solmind_methodology_denied'; end if;
  perform methodology.require_screen_evidence(p_methodology_context_pack_version_id);
  ts:=clock_timestamp();
  insert into audit.audit_event(audit_event_id,event_type,actor_user_account_id,actor_role_context,target_entity_type,target_entity_id,
    action,reason_code,event_summary,metadata,created_at)
    values(eid,'methodology_context_pack_admin_reviewed',p_actor_user_account_id,'admin','methodology_context_pack_version',
      p_methodology_context_pack_version_id,'review','methodology_consistency_confirmed','Methodology consistency review recorded.',
      jsonb_build_object('operation_id',p_operation_id::text,'methodology_context_pack_id',p_methodology_context_pack_id::text,
        'user_session_id',p_user_session_id::text),ts);
  update methodology.methodology_context_pack_version set approval_status='needs_guide_review',
    admin_consistency_reviewer_user_account_id=p_actor_user_account_id,admin_consistency_user_session_id=p_user_session_id,
    admin_consistency_audit_event_id=eid,admin_consistency_reviewed_at=ts
    where methodology_context_pack_version_id=p_methodology_context_pack_version_id;
  insert into methodology.workflow_operation values(p_actor_user_account_id,p_operation_id,p_user_session_id,'admin_review_v1',h,
    p_methodology_context_pack_id,p_methodology_context_pack_version_id,eid,null,ts,'security_log');
  perform methodology.lock_human(p_actor_user_account_id,p_user_session_id,'admin');
  return query select 'ok'::text,eid;
exception when others then
  if SQLSTATE='P0001' and SQLERRM like 'solmind_methodology_%' then raise; end if;
  raise exception 'solmind_methodology_unavailable';
end $$;

create function methodology.require_admin_evidence(p_version uuid)
returns jsonb language plpgsql volatile set search_path='' as $$
declare v methodology.methodology_context_pack_version%rowtype; p methodology.methodology_context_pack%rowtype;
  op methodology.workflow_operation%rowtype; registered methodology.workflow_operation%rowtype; h text;
begin
  select x.* into v from methodology.methodology_context_pack_version x where x.methodology_context_pack_version_id=p_version for share;
  select x.* into p from methodology.methodology_context_pack x where x.methodology_context_pack_id=v.methodology_context_pack_id for share;
  if not found or p.scope_type<>'guide' or p.created_by_role_context<>'admin' or v.created_by_actor_type<>'admin'
    or v.created_by_role_context<>'admin' or v.created_by_user_account_id is distinct from p.created_by_user_account_id
    or v.admin_consistency_reviewer_user_account_id is distinct from p.created_by_user_account_id
    or v.admin_consistency_reviewed_at is null then raise exception 'solmind_methodology_denied'; end if;
  select x.* into registered from methodology.workflow_operation x where x.operation_kind='register_v1'
    and x.actor_user_account_id=v.created_by_user_account_id and x.methodology_context_pack_version_id=p_version;
  if not found or registered.methodology_context_pack_id<>p.methodology_context_pack_id or registered.created_at<>v.created_at
    or not methodology.historical_session_valid(registered.actor_user_account_id,registered.user_session_id,'admin',registered.created_at)
    or not methodology.audit_matches(registered.audit_event_id,'methodology_context_pack_version_created',registered.actor_user_account_id,
      'admin',p_version,'create','methodology_draft_registered','Methodology version registered.',jsonb_build_object(
        'operation_id',registered.operation_id::text,'methodology_context_pack_id',p.methodology_context_pack_id::text,
        'user_session_id',registered.user_session_id::text),v.created_at)
    then raise exception 'solmind_methodology_denied'; end if;
  h:=methodology.hash_json(jsonb_build_array('admin_review_v1',v.admin_consistency_user_session_id,p.methodology_context_pack_id,
    p_version,v.content_sha256,v.safety_screen_invocation_id));
  select x.* into op from methodology.workflow_operation x where x.audit_event_id=v.admin_consistency_audit_event_id
    and x.operation_kind='admin_review_v1' and x.methodology_context_pack_version_id=p_version for share;
  if not found or op.actor_user_account_id<>v.admin_consistency_reviewer_user_account_id
    or op.user_session_id<>v.admin_consistency_user_session_id or op.request_sha256<>h or op.created_at<>v.admin_consistency_reviewed_at
    or op.methodology_context_pack_id<>p.methodology_context_pack_id
    or not methodology.historical_session_valid(op.actor_user_account_id,op.user_session_id,'admin',op.created_at)
    or not methodology.audit_matches(op.audit_event_id,'methodology_context_pack_admin_reviewed',op.actor_user_account_id,'admin',p_version,
      'review','methodology_consistency_confirmed','Methodology consistency review recorded.',jsonb_build_object(
        'operation_id',op.operation_id::text,'methodology_context_pack_id',p.methodology_context_pack_id::text,
        'user_session_id',op.user_session_id::text),op.created_at)
    then raise exception 'solmind_methodology_denied'; end if;
  return jsonb_build_object('registrationOperationId',registered.operation_id,'registrationAuditId',registered.audit_event_id,
    'registrationSha256',registered.request_sha256,'registrationEpoch',extract(epoch from registered.created_at),'adminOperationId',op.operation_id,
    'adminActorId',op.actor_user_account_id,'adminSessionId',op.user_session_id,'adminAuditId',op.audit_event_id,
    'adminReviewedEpoch',extract(epoch from op.created_at),'adminRequestSha256',op.request_sha256);
end $$;

create function public.solmind_decide_methodology_guide_review(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_operation_id uuid,
  p_methodology_context_pack_id uuid,p_methodology_context_pack_version_id uuid,
  p_content_sha256 text,p_screen_invocation_id uuid,p_admin_consistency_audit_event_id uuid,
  p_expected_active_version_id uuid,p_decision text,p_checklist_text text,p_checklist_affirmed boolean
) returns table(outcome text,guide_review_audit_event_id uuid,activation_audit_event_id uuid)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' as $$
declare ts timestamptz; h text; kind text; eid uuid:=gen_random_uuid(); activation_id uuid;
  op methodology.workflow_operation%rowtype; p methodology.methodology_context_pack%rowtype;
  v methodology.methodology_context_pack_version%rowtype; active_v methodology.methodology_context_pack_version%rowtype;
  checklist constant text:='This content does not instruct the AI to act as a clinician, conceal information, or alter safety behavior.';
begin
  if p_operation_id is null or p_methodology_context_pack_id is null or p_methodology_context_pack_version_id is null
    or p_content_sha256 is null or p_content_sha256 !~ '^[0-9A-F]{64}$' or p_screen_invocation_id is null
    or p_admin_consistency_audit_event_id is null or p_decision is null or p_decision not in ('approve','reject')
    or (p_decision='approve' and (p_checklist_text is distinct from checklist or p_checklist_affirmed is distinct from true))
    or (p_decision='reject' and (p_checklist_text is not null or p_checklist_affirmed is distinct from false))
    then raise exception 'solmind_methodology_invalid_input'; end if;
  kind:=case when p_decision='approve' then 'guide_approve_v1' else 'guide_reject_v1' end;
  h:=methodology.hash_json(jsonb_build_array(kind,p_user_session_id,p_methodology_context_pack_id,
    p_methodology_context_pack_version_id,p_content_sha256,p_screen_invocation_id,p_admin_consistency_audit_event_id,
    p_expected_active_version_id,p_checklist_text,p_checklist_affirmed));
  perform pg_advisory_xact_lock(hashtextextended('solmind:methodology:operation:v1|'||p_actor_user_account_id::text||'|'||p_operation_id::text,0));
  perform methodology.lock_human(p_actor_user_account_id,p_user_session_id,'guide');
  p:=methodology.lock_pack(p_methodology_context_pack_id,p_actor_user_account_id);
  select x.* into op from methodology.workflow_operation x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id;
  if found then
    if op.operation_kind<>kind or op.request_sha256<>h then raise exception 'solmind_methodology_operation_conflict'; end if;
    return query select 'exact_replay'::text,op.audit_event_id,op.secondary_audit_event_id; return;
  end if;
  if p.active_version_id is distinct from p_expected_active_version_id then raise exception 'solmind_methodology_operation_conflict'; end if;
  -- Stable UUID lock order includes the old active row and candidate row.
  perform x.methodology_context_pack_version_id from methodology.methodology_context_pack_version x
    where x.methodology_context_pack_version_id in (p_methodology_context_pack_version_id,p.active_version_id)
    order by x.methodology_context_pack_version_id for update;
  select x.* into v from methodology.methodology_context_pack_version x
    where x.methodology_context_pack_version_id=p_methodology_context_pack_version_id and x.methodology_context_pack_id=p_methodology_context_pack_id;
  if not found or v.approval_status<>'needs_guide_review' or v.content_sha256<>p_content_sha256
    or v.safety_screen_invocation_id<>p_screen_invocation_id
    or v.admin_consistency_audit_event_id<>p_admin_consistency_audit_event_id
    then raise exception 'solmind_methodology_denied'; end if;
  if p.active_version_id is not null then
    select x.* into active_v from methodology.methodology_context_pack_version x where x.methodology_context_pack_version_id=p.active_version_id;
    if active_v.approval_status<>'guide_approved' or active_v.active_from is null or active_v.superseded_at is not null
      or active_v.version_number>=v.version_number then raise exception 'solmind_methodology_denied'; end if;
  end if;
  perform methodology.require_screen_evidence(p_methodology_context_pack_version_id);
  perform methodology.require_admin_evidence(p_methodology_context_pack_version_id);
  ts:=clock_timestamp();
  if p_decision='approve' then
    activation_id:=gen_random_uuid();
    insert into audit.audit_event(audit_event_id,event_type,actor_user_account_id,actor_role_context,target_entity_type,target_entity_id,
      action,reason_code,event_summary,metadata,created_at) values
      (eid,'methodology_context_pack_guide_approved',p_actor_user_account_id,'guide','methodology_context_pack_version',
        p_methodology_context_pack_version_id,'approve','methodology_guide_approved','Methodology Guide approval recorded.',
        jsonb_build_object('operation_id',p_operation_id::text,'methodology_context_pack_id',p_methodology_context_pack_id::text,
          'user_session_id',p_user_session_id::text),ts),
      (activation_id,'methodology_context_pack_version_activated',p_actor_user_account_id,'guide','methodology_context_pack_version',
        p_methodology_context_pack_version_id,'activate','methodology_version_effective','Methodology version made effective.',
        jsonb_build_object('operation_id',p_operation_id::text,'methodology_context_pack_id',p_methodology_context_pack_id::text,
          'user_session_id',p_user_session_id::text),ts);
    if p.active_version_id is not null then
      update methodology.methodology_context_pack_version set approval_status='superseded',superseded_at=ts
        where methodology_context_pack_version_id=p.active_version_id;
    end if;
    update methodology.methodology_context_pack_version set approval_status='guide_approved',
      approved_by_user_account_id=p_actor_user_account_id,approved_by_role_context='guide',approved_by_user_session_id=p_user_session_id,
      guide_checklist_affirmed=true,guide_approval_audit_event_id=eid,approved_at=ts,active_from=ts
      where methodology_context_pack_version_id=p_methodology_context_pack_version_id;
    update methodology.methodology_context_pack set pack_status='active',active_version_id=p_methodology_context_pack_version_id
      where methodology_context_pack_id=p_methodology_context_pack_id;
  else
    insert into audit.audit_event(audit_event_id,event_type,actor_user_account_id,actor_role_context,target_entity_type,target_entity_id,
      action,reason_code,event_summary,metadata,created_at)
      values(eid,'methodology_context_pack_guide_rejected',p_actor_user_account_id,'guide','methodology_context_pack_version',
        p_methodology_context_pack_version_id,'reject','methodology_guide_rejected','Methodology Guide rejection recorded.',
        jsonb_build_object('operation_id',p_operation_id::text,'methodology_context_pack_id',p_methodology_context_pack_id::text,
          'user_session_id',p_user_session_id::text),ts);
    update methodology.methodology_context_pack_version set approval_status='rejected'
      where methodology_context_pack_version_id=p_methodology_context_pack_version_id;
  end if;
  insert into methodology.workflow_operation values(p_actor_user_account_id,p_operation_id,p_user_session_id,kind,h,
    p_methodology_context_pack_id,p_methodology_context_pack_version_id,eid,activation_id,ts,'security_log');
  perform methodology.lock_human(p_actor_user_account_id,p_user_session_id,'guide');
  return query select 'ok'::text,eid,activation_id;
exception when others then
  if SQLSTATE='P0001' and SQLERRM like 'solmind_methodology_%' then raise; end if;
  raise exception 'solmind_methodology_unavailable';
end $$;

create function methodology.resolve_effective(p_pack uuid,p_guide uuid)
returns jsonb language plpgsql volatile set search_path='' as $$
declare p methodology.methodology_context_pack%rowtype; v methodology.methodology_context_pack_version%rowtype;
  owner_id uuid; op methodology.workflow_operation%rowtype; screen_proof jsonb; admin_proof jsonb; mv text; m jsonb;
begin
  if current_setting('transaction_isolation')<>'read committed' or p_pack is null or p_guide is null
    then raise exception 'solmind_methodology_denied'; end if;
  owner_id:=methodology.lock_guide(p_guide);
  select x.* into p from methodology.methodology_context_pack x where x.methodology_context_pack_id=p_pack for share;
  if not found or p.scope_type<>'guide' or p.guide_profile_id is distinct from p_guide
    or p.pack_status<>'active' or p.active_version_id is null then raise exception 'solmind_methodology_denied'; end if;
  select x.* into v from methodology.methodology_context_pack_version x
    where x.methodology_context_pack_id=p_pack and x.methodology_context_pack_version_id=p.active_version_id for share;
  if not found or v.approval_status<>'guide_approved' or v.active_from is null or v.active_from>clock_timestamp()
    or v.superseded_at is not null or v.approved_by_user_account_id is distinct from owner_id
    or v.approved_by_role_context is distinct from 'guide' or not v.guide_checklist_affirmed
    or v.approved_at is null or v.approved_at<>v.active_from
    then raise exception 'solmind_methodology_denied'; end if;
  screen_proof:=methodology.require_screen_evidence(v.methodology_context_pack_version_id);
  admin_proof:=methodology.require_admin_evidence(v.methodology_context_pack_version_id);
  select x.* into op from methodology.workflow_operation x
    where x.audit_event_id=v.guide_approval_audit_event_id and x.operation_kind='guide_approve_v1'
      and x.methodology_context_pack_version_id=v.methodology_context_pack_version_id for share;
  m:=jsonb_build_object('operation_id',op.operation_id::text,'methodology_context_pack_id',p_pack::text,
    'user_session_id',v.approved_by_user_session_id::text);
  if not found or op.actor_user_account_id is distinct from owner_id or op.user_session_id is distinct from v.approved_by_user_session_id
    or op.methodology_context_pack_id<>p_pack or op.created_at<>v.approved_at
    or not methodology.historical_session_valid(owner_id,v.approved_by_user_session_id,'guide',v.approved_at)
    or not methodology.audit_matches(v.guide_approval_audit_event_id,'methodology_context_pack_guide_approved',owner_id,'guide',
      v.methodology_context_pack_version_id,'approve','methodology_guide_approved','Methodology Guide approval recorded.',m,v.approved_at)
    or not methodology.audit_matches(op.secondary_audit_event_id,'methodology_context_pack_version_activated',owner_id,'guide',
      v.methodology_context_pack_version_id,'activate','methodology_version_effective','Methodology version made effective.',m,v.active_from)
    then raise exception 'solmind_methodology_denied'; end if;
  -- MV1 canonical JSONB array: explicit scalar fields, hashes, complete verified
  -- evidence, and epoch timestamps. No session TimeZone/DateStyle dependency.
  mv:='MV1:'||methodology.hash_json(jsonb_build_array('explorer-methodology-governance.v1',p_pack,'guide',p_guide,
    p.pack_status,p.active_version_id,v.methodology_context_pack_version_id,v.version_number,v.previous_version_id,
    v.content_sha256,v.source_type,v.source_actor_label,v.source_provenance,v.ai_change_summary,
    v.created_by_user_account_id,extract(epoch from v.created_at),v.approval_status,screen_proof,admin_proof,
    owner_id,v.approved_by_user_session_id,v.guide_checklist_affirmed,v.guide_approval_audit_event_id,
    extract(epoch from v.approved_at),extract(epoch from v.active_from),op.operation_id,op.request_sha256,op.secondary_audit_event_id));
  return jsonb_build_object('packId',p_pack,'scopeType','guide','scopeId',p_guide,
    'versionId',v.methodology_context_pack_version_id,'versionNumber',v.version_number,'contentMarkdown',v.content_markdown,
    'contentSha256',v.content_sha256,'methodologyAuthorizationVersion',mv);
end $$;

create function public.solmind_resolve_explorer_methodology(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_methodology_context_pack_id uuid,p_scope_type text,p_scope_id uuid
) returns table(methodology_context_pack_id uuid,scope_type text,scope_id uuid,
  methodology_context_pack_version_id uuid,version_number integer,content_markdown text,content_sha256 text,
  methodology_authorization_version text)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' as $$
declare a jsonb; e jsonb;
begin
  if p_scope_type is distinct from 'guide' or p_scope_id is null or p_methodology_context_pack_id is null
    then raise exception 'solmind_methodology_denied'; end if;
  a:=ai.solmind_conversation_authority(p_actor_user_account_id,p_user_session_id,null);
  if (a->>'guideId')::uuid is distinct from p_scope_id then raise exception 'solmind_methodology_denied'; end if;
  e:=methodology.resolve_effective(p_methodology_context_pack_id,p_scope_id);
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_methodology_denied'; end if;
  return query select (e->>'packId')::uuid,'guide'::text,(e->>'scopeId')::uuid,(e->>'versionId')::uuid,
    (e->>'versionNumber')::integer,e->>'contentMarkdown',e->>'contentSha256',e->>'methodologyAuthorizationVersion';
exception when others then
  if SQLSTATE='P0001' and SQLERRM like 'solmind_methodology_%' then raise; end if;
  raise exception 'solmind_methodology_denied';
end $$;

create function methodology.serialized_methodology_valid(p_serialized text,p_version uuid,p_content text)
returns boolean language plpgsql immutable set search_path='' as $$
declare envelope json; subject json; keys text[];
begin
  if p_serialized is null or octet_length(p_serialized) not between 2 and 524288 or p_version is null or p_content is null
    then return false; end if;
  envelope:=p_serialized::json;
  if json_typeof(envelope) is distinct from 'object' then return false; end if;
  -- json preserves duplicate keys; jsonb would erase this evidence first.
  select array_agg(key order by key) into keys from json_each(envelope);
  if keys is distinct from array['actorRoleContext','aiRole','approvedContinuity','contractVersion','crisisBehavior',
    'currentSessionMessages','globalPolicy','immediateExplorerMessage','methodologyContext','outputRequirements',
    'roleBehavior','sessionContext']::text[]
    or json_typeof(envelope->'contractVersion') is distinct from 'string'
    or envelope->>'contractVersion' is distinct from 'wi007-v0.1+onboarding-fields-v2'
    or json_typeof(envelope->'aiRole') is distinct from 'string' or envelope->>'aiRole' is distinct from 'solmind_virtual_guide'
    or json_typeof(envelope->'actorRoleContext') is distinct from 'string' or envelope->>'actorRoleContext' is distinct from 'explorer'
    then return false; end if;
  subject:=envelope->'methodologyContext';
  if json_typeof(subject) is distinct from 'object' then return false; end if;
  select array_agg(key order by key) into keys from json_each(subject);
  return coalesce(keys=array['text','version']::text[] and json_typeof(subject->'text')='string'
    and json_typeof(subject->'version')='string' and subject->>'version'='methodology:'||p_version::text
    and subject->>'text'=p_content,false);
exception when others then return false;
end $$;

create function public.solmind_prepare_governed_explorer_conversation_turn(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,
  p_operation_id uuid,p_expected_revision integer,p_message_id uuid,p_snapshot_id uuid,p_invocation_id uuid,
  p_body text,p_context_serialization text,p_context_fingerprint_sha256 text,p_context_source_ids uuid[],
  p_authorization_version text,p_intake_response_set_id uuid,p_methodology_context_pack_version_id uuid,
  p_prompt_version text,p_policy_version text,p_behavior_version text,p_crisis_version text,
  p_role_version text,p_instruction_version text,p_command_fingerprint text,p_logical_operation_id uuid,
  p_methodology_context_pack_id uuid,p_methodology_content_sha256 text,p_methodology_authorization_version text
) returns table(outcome text,conversation_state jsonb,dispatch_permitted boolean)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' as $$
declare a jsonb; e jsonb; existing_state boolean; op ai.explorer_conversation_operation%rowtype;
  b methodology.explorer_methodology_binding%rowtype; result record; is_retry boolean; bound_content text;
begin
  if p_actor_user_account_id is null or p_operation_id is null or p_methodology_context_pack_id is null
    or p_methodology_content_sha256 is null or p_methodology_content_sha256 !~ '^[0-9A-F]{64}$'
    or p_methodology_authorization_version is null or p_methodology_authorization_version !~ '^MV1:[0-9A-F]{64}$'
    then raise exception 'solmind_methodology_invalid_input'; end if;
  -- Same lock key and existing authority order as unchanged v2. It rechecks the
  -- full original v2 fingerprint on retry; no current methodology read happens.
  perform pg_advisory_xact_lock(hashtextextended('solmind:explorer-conversation:v2|'||p_actor_user_account_id::text||'|'||p_operation_id::text,0));
  select exists(select 1 from ai.explorer_conversation_state s where s.conversation_id=p_conversation_id) into existing_state;
  a:=ai.solmind_conversation_authority(p_actor_user_account_id,p_user_session_id,
    case when existing_state then p_conversation_id else null end);
  select x.* into op from ai.explorer_conversation_operation x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id for update;
  is_retry:=found;
  if is_retry then
    select x.* into b from methodology.explorer_methodology_binding x where x.ai_context_snapshot_id=op.snapshot_id for share;
    if not found or b.ai_context_snapshot_id is distinct from p_snapshot_id
      or b.methodology_context_pack_id is distinct from p_methodology_context_pack_id
      or b.methodology_context_pack_version_id is distinct from p_methodology_context_pack_version_id
      or b.content_sha256 is distinct from p_methodology_content_sha256
      or b.methodology_authorization_version is distinct from p_methodology_authorization_version
      or b.evidence_contract_version<>'explorer-methodology-governance.v1'
      then raise exception 'solmind_methodology_operation_conflict'; end if;
    select v.content_markdown into bound_content from methodology.methodology_context_pack_version v
      where v.methodology_context_pack_version_id=b.methodology_context_pack_version_id
        and v.methodology_context_pack_id=b.methodology_context_pack_id and v.content_sha256=b.content_sha256 for share;
    if not found or not methodology.serialized_methodology_valid(p_context_serialization,b.methodology_context_pack_version_id,bound_content)
      then raise exception 'solmind_methodology_operation_conflict'; end if;
  else
    e:=methodology.resolve_effective(p_methodology_context_pack_id,(a->>'guideId')::uuid);
    if (e->>'versionId')::uuid is distinct from p_methodology_context_pack_version_id
      or e->>'contentSha256' is distinct from p_methodology_content_sha256
      or e->>'methodologyAuthorizationVersion' is distinct from p_methodology_authorization_version
      or not methodology.serialized_methodology_valid(p_context_serialization,p_methodology_context_pack_version_id,e->>'contentMarkdown')
      then raise exception 'solmind_methodology_denied'; end if;
  end if;
  select x.* into result from public.solmind_prepare_explorer_conversation_turn(
    p_actor_user_account_id,p_user_session_id,p_conversation_id,p_operation_id,p_expected_revision,p_message_id,p_snapshot_id,p_invocation_id,
    p_body,p_context_serialization,p_context_fingerprint_sha256,p_context_source_ids,p_authorization_version,p_intake_response_set_id,
    p_methodology_context_pack_version_id,p_prompt_version,p_policy_version,p_behavior_version,p_crisis_version,p_role_version,
    p_instruction_version,p_command_fingerprint,p_logical_operation_id) x;
  if not found then raise exception 'solmind_methodology_unavailable'; end if;
  if is_retry and (result.outcome is distinct from 'exact_replay' or result.dispatch_permitted is distinct from false)
    then raise exception 'solmind_methodology_operation_conflict'; end if;
  if not is_retry and result.dispatch_permitted then
    if result.outcome is distinct from 'ok' then raise exception 'solmind_methodology_unavailable'; end if;
    insert into methodology.explorer_methodology_binding(ai_context_snapshot_id,methodology_context_pack_id,
      methodology_context_pack_version_id,content_sha256,methodology_authorization_version,created_at)
      values(p_snapshot_id,p_methodology_context_pack_id,p_methodology_context_pack_version_id,p_methodology_content_sha256,
        p_methodology_authorization_version,clock_timestamp());
  end if;
  return query select result.outcome::text,result.conversation_state::jsonb,result.dispatch_permitted::boolean;
exception when others then
  if SQLSTATE='P0001' and (SQLERRM like 'solmind_methodology_%' or SQLERRM like 'solmind_explorer_conversation_%') then raise; end if;
  raise exception 'solmind_methodology_unavailable';
end $$;

-- Explicit effective ACLs defeat inherited global default privileges. Schema
-- ownership remains postgres; API roles get only the eight closed public ports.
do $acl$
declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='methodology' loop
    execute format('alter function %s owner to postgres',f.signature);
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  end loop;
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('solmind_register_methodology_version','solmind_read_methodology_version',
      'solmind_prepare_methodology_screen','solmind_record_methodology_screen','solmind_confirm_methodology_admin_review',
      'solmind_decide_methodology_guide_review','solmind_resolve_explorer_methodology','solmind_prepare_governed_explorer_conversation_turn') loop
    execute format('alter function %s owner to postgres',f.signature);
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $acl$;

comment on table methodology.screen_attempt is
  'One immutable pre-I/O screen receipt per immutable version, with once-only terminal settlement; trusted-server provenance assertion, not proof of a real call.';
comment on table methodology.workflow_operation is
  'Closed human operation identity/hash/audit ledger; no content, provider body or generic event writer.';
comment on table methodology.explorer_methodology_binding is
  'Prospective append-only exact methodology governance evidence for newly governed v2 snapshots; legacy snapshots remain unchanged.';
comment on table methodology.methodology_context_pack is
  'Logical methodology scope; initial closed workflow operates only same-preparing-Admin Guide-scoped artifacts, with owning Guide approval.';
comment on table methodology.methodology_context_pack_version is
  'Immutable methodology/provenance plus once-set closed screen/Admin/Guide evidence. No real screen or human truth follows from schema shape alone.';
