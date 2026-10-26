-- SolMind MVP0 approved private synthetic-local Explorer safety construction.
-- Purpose: actual empty-first-send anchor; minimum private positive evidence;
-- monotonic conversation policy; exact v3 prepared/terminal technical ownership.
-- PROPOSAL ONLY / ALL PROOF UNRUN. No provider, operational configuration,
-- human approval, scheduled checker, Admin paging, sharing or responder feature.
-- No users, seeds, permissive policies, direct table grants, backfill, repair,
-- shared database effect, deletion, deployment or real-user activation.
begin;

alter table ai.explorer_conversation_state
  add column safety_contract_version text null,
  add column restricted_level smallint null,
  add column adult_reflection_stopped boolean null,
  add column safety_version bigint null,
  add constraint explorer_conversation_private_policy_shape check (
    (safety_contract_version is null and restricted_level is null
      and adult_reflection_stopped is null and safety_version is null)
    or (safety_contract_version is not null
      and safety_contract_version='explorer-conversation-safety.v1'
      and (restricted_level is null or restricted_level in (3,4))
      and adult_reflection_stopped is not null and safety_version is not null and safety_version>=0));

create table ai.explorer_safety_evidence (
  explorer_safety_evidence_id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai.explorer_conversation_state(conversation_id),
  origin_application_session_id uuid not null references identity.user_session(user_session_id),
  logical_operation_id uuid not null,
  command_fingerprint text not null check(command_fingerprint ~ '^[0-9A-F]{64}$'),
  model_invocation_id uuid null references ai.ai_model_invocation(ai_model_invocation_id),
  evidence_protocol_version text not null check(evidence_protocol_version='explorer-minimum-safety.v1'),
  fallback_policy_version text not null check(fallback_policy_version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'),
  model_policy_version text not null check(model_policy_version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'),
  fallback_level smallint not null check(fallback_level between 0 and 4),
  fallback_minor_indicated boolean not null,
  model_level smallint null check(model_level is null or model_level between 0 and 4),
  model_minor_indicated boolean null,
  observed_at timestamptz not null default clock_timestamp(),
  retention_class text not null default 'sensitive_content' check(retention_class='sensitive_content'),
  unique(conversation_id,logical_operation_id),
  check((model_level is null)=(model_minor_indicated is null)),
  check(model_level is null or model_invocation_id is not null),
  check(fallback_level>=1 or (model_level is not null and model_level>=1))
);
alter table ai.explorer_safety_evidence enable row level security;
revoke all on ai.explorer_safety_evidence from public,anon,authenticated,service_role;

-- Closed protocol/configuration bindings, not another detector payload owner.
alter table ai.explorer_conversation_operation
  add column safety_protocol_version text null,
  add column safety_request_mode text null,
  add column configuration_fingerprint text null,
  add column fallback_observation_fingerprint text null,
  add column fallback_policy_version text null,
  add column model_policy_version text null,
  add column trusted_response_version text null,
  add column resource_policy_version text null,
  add constraint explorer_conversation_v3_operation_shape check (
    (safety_protocol_version is null and safety_request_mode is null and configuration_fingerprint is null and fallback_observation_fingerprint is null
      and fallback_policy_version is null and model_policy_version is null and trusted_response_version is null
      and resource_policy_version is null)
    or (kind='send' and safety_protocol_version is not null and safety_protocol_version='explorer-safety-reply.v1'
      and safety_request_mode is not null and safety_request_mode in ('classification_and_reply','classification_only')
      and configuration_fingerprint is not null and configuration_fingerprint ~ '^[0-9A-F]{64}$'
      and fallback_observation_fingerprint is not null and fallback_observation_fingerprint ~ '^[0-9A-F]{64}$'
      and fallback_policy_version is not null and fallback_policy_version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
      and model_policy_version is not null and model_policy_version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
      and trusted_response_version is not null and trusted_response_version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
      and resource_policy_version is not null and resource_policy_version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'));
alter table ai.ai_context_snapshot
  add column explorer_safety_protocol_version text null,
  add column explorer_safety_request_mode text null,
  add column explorer_configuration_fingerprint text null,
  add column fallback_policy_version text null,
  add column model_policy_version text null,
  add column trusted_response_version text null,
  add column resource_policy_version text null,
  add constraint explorer_v3_snapshot_protocol_shape check (
    (evidence_contract_version is distinct from 'virtual-guide-predispatch-evidence.v3'
      and explorer_safety_protocol_version is null and explorer_safety_request_mode is null
      and explorer_configuration_fingerprint is null and fallback_policy_version is null
      and model_policy_version is null and trusted_response_version is null and resource_policy_version is null)
    or (evidence_contract_version is not null and evidence_contract_version='virtual-guide-predispatch-evidence.v3'
      and explorer_safety_protocol_version is not null and explorer_safety_protocol_version='explorer-safety-reply.v1'
      and explorer_safety_request_mode is not null and explorer_safety_request_mode in ('classification_and_reply','classification_only')
      and explorer_configuration_fingerprint is not null and explorer_configuration_fingerprint ~ '^[0-9A-F]{64}$'
      and fallback_policy_version is not null and fallback_policy_version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
      and model_policy_version is not null and model_policy_version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
      and trusted_response_version is not null and trusted_response_version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
      and resource_policy_version is not null and resource_policy_version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'));

create function ai.solmind_private_owner_lock_v3(p_actor uuid)
returns void language plpgsql volatile set search_path='' as $$
begin
  if p_actor is null or current_setting('transaction_isolation') is distinct from 'read committed'
    then raise exception 'solmind_explorer_private_denied'; end if;
  if not pg_try_advisory_xact_lock(hashtextextended('solmind:explorer-private-owner:v3|'||p_actor::text,0))
    then raise exception 'solmind_explorer_private_unavailable'; end if;
end $$;

-- Internal minimum-evidence write. Callers hold the real owner/state locks and
-- establish actual current or previously prepared authority before entering.
create function ai.solmind_store_private_observation_v3(
  p_conversation uuid,p_app uuid,p_logical uuid,p_command text,
  p_fallback_version text,p_model_version text,p_fallback smallint,p_fallback_minor boolean,
  p_invocation uuid,p_model smallint,p_model_minor boolean
) returns void language plpgsql volatile set search_path='' as $$
declare ev ai.explorer_safety_evidence%rowtype; attach_id uuid; observed_level smallint; observed_minor boolean;
begin
  if p_conversation is null or p_app is null or p_logical is null or p_command is null
    or p_command !~ '^[0-9A-F]{64}$' or p_fallback is null or p_fallback not between 0 and 4
    or p_fallback_minor is null or (p_model is null) is distinct from (p_model_minor is null)
    or (p_model is not null and (p_model not between 0 and 4 or p_invocation is null))
    or p_fallback_version is null or p_fallback_version !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    or p_model_version is null or p_model_version !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  select x.* into ev from ai.explorer_safety_evidence x
    where x.conversation_id=p_conversation and x.logical_operation_id=p_logical for update;
  if found then
    if ev.origin_application_session_id is distinct from p_app or ev.command_fingerprint is distinct from p_command
      or ev.fallback_policy_version is distinct from p_fallback_version or ev.model_policy_version is distinct from p_model_version
      or ev.fallback_level is distinct from p_fallback or ev.fallback_minor_indicated is distinct from p_fallback_minor
      or (ev.model_invocation_id is not null and p_invocation is not null and ev.model_invocation_id is distinct from p_invocation)
      or (ev.model_level is not null and p_model is not null and
        (ev.model_level is distinct from p_model or ev.model_minor_indicated is distinct from p_model_minor))
      then raise exception 'solmind_explorer_private_evidence_conflict'; end if;
    attach_id:=coalesce(ev.model_invocation_id,p_invocation);
    observed_level:=coalesce(ev.model_level,p_model);
    observed_minor:=coalesce(ev.model_minor_indicated,p_model_minor);
    if attach_id is distinct from ev.model_invocation_id or observed_level is distinct from ev.model_level
      or observed_minor is distinct from ev.model_minor_indicated then
      update ai.explorer_safety_evidence set model_invocation_id=attach_id,model_level=observed_level,
        model_minor_indicated=observed_minor where explorer_safety_evidence_id=ev.explorer_safety_evidence_id;
    end if;
  elsif p_fallback>=1 or coalesce(p_model,0)>=1 then
    insert into ai.explorer_safety_evidence(conversation_id,origin_application_session_id,logical_operation_id,
      command_fingerprint,model_invocation_id,evidence_protocol_version,fallback_policy_version,model_policy_version,
      fallback_level,fallback_minor_indicated,model_level,model_minor_indicated)
      values(p_conversation,p_app,p_logical,p_command,p_invocation,'explorer-minimum-safety.v1',
        p_fallback_version,p_model_version,p_fallback,p_fallback_minor,p_model,p_model_minor);
  end if;
  -- Numerical zero, including minor-only, creates no private safety row.
  perform ai.solmind_raise_private_policy_v3(p_conversation,greatest(p_fallback,coalesce(p_model,0))::smallint,
    p_fallback_minor or coalesce(p_model_minor,false));
end $$;

create function public.solmind_read_explorer_conversation_v3(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid default null,
  p_operation_id uuid default null,p_command_fingerprint text default null
) returns table(outcome text,conversation_state jsonb,authority_context jsonb,policy_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare v_id uuid; a jsonb; op ai.explorer_conversation_operation%rowtype; ids uuid[]; replay boolean:=false;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if (p_operation_id is null) is distinct from (p_command_fingerprint is null)
    or (p_command_fingerprint is not null and p_command_fingerprint !~ '^[0-9A-F]{64}$')
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  v_id:=p_conversation_id;
  if p_operation_id is not null then
    select x.* into op from ai.explorer_conversation_operation x
      where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id;
    replay:=found;
    if replay then
      if (v_id is not null and v_id is distinct from op.conversation_id)
        or op.application_session_id is distinct from p_user_session_id
        or op.command_fingerprint is distinct from p_command_fingerprint
        then raise exception 'solmind_explorer_private_operation_conflict'; end if;
      v_id:=op.conversation_id;
    end if;
  end if;
  if v_id is null then
    select array_agg(s.ai_interaction_session_id order by s.ai_interaction_session_id) into ids
      from ai.ai_interaction_session s where s.actor_user_account_id=p_actor_user_account_id
        and s.actor_role_context='explorer' and s.session_type='explorer_reflection' and s.session_status='active';
    if coalesce(cardinality(ids),0)>1 then raise exception 'solmind_explorer_private_unavailable'; end if;
    v_id:=ids[1];
  end if;
  if v_id is not null and not exists(select 1 from ai.explorer_conversation_state st
    where st.conversation_id=v_id and st.actor_user_account_id=p_actor_user_account_id)
    then raise exception 'solmind_explorer_private_unavailable'; end if;
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,v_id);
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp()
    then raise exception 'solmind_explorer_private_denied'; end if;
  return query select case when replay then 'exact_replay' else 'ok' end,
    ai.solmind_conversation_state_json(v_id),a,ai.solmind_private_policy_v3(v_id);
end $$;

create function public.solmind_ensure_explorer_conversation_v3(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_candidate_conversation_id uuid,p_expected_revision integer,
  p_methodology_context_pack_id uuid,p_methodology_context_pack_version_id uuid,
  p_methodology_content_sha256 text,p_methodology_authorization_version text,p_configuration_fingerprint text
) returns table(outcome text,conversation_state jsonb,authority_context jsonb,policy_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; e jsonb; ids uuid[]; v_id uuid; st ai.explorer_conversation_state%rowtype; ts timestamptz;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_candidate_conversation_id is null or p_expected_revision is null or p_expected_revision<0
    or p_configuration_fingerprint is null or p_configuration_fingerprint !~ '^[0-9A-F]{64}$'
    or p_methodology_context_pack_id is null or p_methodology_context_pack_version_id is null
    or p_methodology_content_sha256 is null or p_methodology_content_sha256 !~ '^[0-9A-F]{64}$'
    or p_methodology_authorization_version is null or p_methodology_authorization_version !~ '^MV1:[0-9A-F]{64}$'
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,null);
  e:=methodology.resolve_effective(p_methodology_context_pack_id,(a->>'guideId')::uuid);
  if (e->>'versionId')::uuid is distinct from p_methodology_context_pack_version_id
    or e->>'contentSha256' is distinct from p_methodology_content_sha256
    or e->>'methodologyAuthorizationVersion' is distinct from p_methodology_authorization_version
    then raise exception 'solmind_explorer_private_denied'; end if;
  -- Other reviewed configuration is trusted server composition, never a SQL
  -- candidate-ready flag. Hash shape alone proves no operational approval.
  select array_agg(s.ai_interaction_session_id order by s.ai_interaction_session_id) into ids
    from ai.ai_interaction_session s where s.actor_user_account_id=p_actor_user_account_id
      and s.actor_role_context='explorer' and s.session_type='explorer_reflection' and s.session_status='active';
  if coalesce(cardinality(ids),0)>1 then raise exception 'solmind_explorer_private_unavailable'; end if;
  if coalesce(cardinality(ids),0)=1 then
    v_id:=ids[1];
    a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,v_id);
    select x.* into st from ai.explorer_conversation_state x where x.conversation_id=v_id for update;
    if not found or st.actor_user_account_id is distinct from p_actor_user_account_id
      then raise exception 'solmind_explorer_private_unavailable'; end if;
    if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp()
      then raise exception 'solmind_explorer_private_denied'; end if;
    return query select case when st.revision is distinct from p_expected_revision then 'stale_revision'
      when ai.solmind_private_policy_v3(v_id)->'known' is distinct from 'true'::jsonb then 'held' else 'reused' end,
      ai.solmind_conversation_state_json(v_id),a,ai.solmind_private_policy_v3(v_id);
    return;
  end if;
  if p_expected_revision<>0 then
    return query select 'stale_revision'::text,null::jsonb,null::jsonb,null::jsonb; return;
  end if;
  if exists(select 1 from ai.ai_interaction_session s where s.ai_interaction_session_id=p_candidate_conversation_id)
    then raise exception 'solmind_explorer_private_unavailable'; end if;
  ts:=clock_timestamp(); v_id:=p_candidate_conversation_id;
  insert into ai.ai_interaction_session(ai_interaction_session_id,session_type,actor_user_account_id,actor_role_context,
    guide_profile_id,explorer_profile_id,guide_explorer_relationship_id,practice_id,started_at,last_activity_at,metadata)
    values(v_id,'explorer_reflection',p_actor_user_account_id,'explorer',(a->>'guideId')::uuid,
      (a->>'explorerId')::uuid,(a->>'relationshipId')::uuid,(a->>'practiceId')::uuid,ts,ts,'{"restricted_mode":false}');
  insert into ai.explorer_conversation_state(conversation_id,actor_user_account_id,safety_contract_version,
    restricted_level,adult_reflection_stopped,safety_version)
    values(v_id,p_actor_user_account_id,'explorer-conversation-safety.v1',null,false,0);
  insert into audit.audit_event(event_type,actor_user_account_id,actor_role_context,target_entity_type,target_entity_id,
    action,reason_code,event_summary,metadata,ip_address,user_agent,created_at)
    values('ai_session_created',p_actor_user_account_id,'explorer','ai_interaction_session',v_id,'create',
      'initial_conversation_anchor','Explorer AI conversation created before first-turn evaluation.',
      '{"session_type":"explorer_reflection"}',null,null,ts);
  -- Creation changed the absence/known-policy binding. Return actual AV3 for
  -- the returned identity, never the earlier pre-anchor token.
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,v_id);
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp()
    then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'created'::text,ai.solmind_conversation_state_json(v_id),a,ai.solmind_private_policy_v3(v_id);
end $$;

create function public.solmind_observe_explorer_conversation_fallback_v3(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_logical_operation_id uuid,p_expected_revision integer,p_command_fingerprint text,p_protocol_version text,
  p_fallback_policy_version text,p_model_policy_version text,p_configuration_fingerprint text,
  p_fallback_level smallint,p_fallback_minor_indicated boolean
) returns table(outcome text,policy_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; st ai.explorer_conversation_state%rowtype; op ai.explorer_conversation_operation%rowtype;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_conversation_id is null or p_operation_id is null or p_logical_operation_id is null
    or p_expected_revision is null or p_expected_revision<0
    or p_protocol_version is distinct from 'explorer-safety-reply.v1'
    or p_configuration_fingerprint is null or p_configuration_fingerprint !~ '^[0-9A-F]{64}$'
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id
    or ai.solmind_private_policy_v3(p_conversation_id)->'known' is distinct from 'true'::jsonb
    then raise exception 'solmind_explorer_private_legacy_unknown'; end if;
  select x.* into op from ai.explorer_conversation_operation x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id for update;
  if found then
    if op.kind is distinct from 'send' or op.application_session_id is distinct from p_user_session_id
      or op.conversation_id is distinct from p_conversation_id or op.command_fingerprint is distinct from p_command_fingerprint
      or op.logical_operation_id is distinct from p_logical_operation_id
      then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    return query select 'exact_replay'::text,ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  if st.revision is distinct from p_expected_revision or st.pending_operation_id is not null then
    return query select 'stale_revision'::text,ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  perform ai.solmind_store_private_observation_v3(p_conversation_id,p_user_session_id,p_logical_operation_id,
    p_command_fingerprint,p_fallback_policy_version,p_model_policy_version,p_fallback_level,p_fallback_minor_indicated,
    null,null,null);
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp()
    then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'ok'::text,ai.solmind_private_policy_v3(p_conversation_id);
end $$;

create function ai.solmind_private_policy_v3(p_conversation uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select case when st.safety_contract_version='explorer-conversation-safety.v1'
      and st.adult_reflection_stopped is not null and st.safety_version is not null
      and st.safety_version>=0 and jsonb_typeof(s.metadata)='object'
      and s.metadata->'restricted_mode' is not distinct from to_jsonb(st.restricted_level is not null)
      then jsonb_build_object('known',true,'contractVersion',st.safety_contract_version,
        'restrictedLevel',st.restricted_level,'adultReflectionStopped',st.adult_reflection_stopped,'version',st.safety_version)
      else jsonb_build_object('known',false,'contractVersion',null,'restrictedLevel',null,
        'adultReflectionStopped',null,'version',null) end
  from (select 1) anchor left join ai.explorer_conversation_state st on st.conversation_id=p_conversation
    left join ai.ai_interaction_session s on s.ai_interaction_session_id=st.conversation_id
$$;

create function ai.solmind_private_state_guard_v3() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' and old.safety_contract_version is not null then
    raise exception 'solmind_explorer_private_immutable';
  elsif tg_op='UPDATE' and old.safety_contract_version is not null then
    if new.conversation_id is distinct from old.conversation_id
      or new.actor_user_account_id is distinct from old.actor_user_account_id
      or new.safety_contract_version is distinct from old.safety_contract_version
      or new.adult_reflection_stopped is null or (old.adult_reflection_stopped and not new.adult_reflection_stopped)
      or (old.restricted_level is not null and (new.restricted_level is null or new.restricted_level<old.restricted_level))
      or new.safety_version is null or new.safety_version<old.safety_version
      or ((new.restricted_level is distinct from old.restricted_level
        or new.adult_reflection_stopped is distinct from old.adult_reflection_stopped)
        and new.safety_version<=old.safety_version)
      then raise exception 'solmind_explorer_private_immutable'; end if;
  elsif tg_op='UPDATE' and old.safety_contract_version is null and new.safety_contract_version is not null then
    -- New-container INSERT is the only clear initializer. Legacy rows cannot be
    -- upgraded/backfilled even if a caller calls that maintenance or repair.
    raise exception 'solmind_explorer_private_legacy_unknown';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger explorer_private_state_guard before update or delete on ai.explorer_conversation_state
for each row execute function ai.solmind_private_state_guard_v3();

create function ai.solmind_private_policy_coherent_v3() returns trigger
language plpgsql set search_path='' as $$
declare v_id uuid; st ai.explorer_conversation_state%rowtype; m jsonb;
begin
  if tg_table_name='ai_interaction_session' then v_id:=new.ai_interaction_session_id;
  else v_id:=new.conversation_id; end if;
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=v_id;
  if found and st.safety_contract_version is not null then
    select s.metadata into m from ai.ai_interaction_session s where s.ai_interaction_session_id=v_id;
    if not found or jsonb_typeof(m) is distinct from 'object'
      or m->'restricted_mode' is distinct from to_jsonb(st.restricted_level is not null)
      then raise exception 'solmind_explorer_private_policy_incoherent'; end if;
  end if;
  return null;
end $$;
create constraint trigger explorer_private_state_coherent after insert or update on ai.explorer_conversation_state
deferrable initially deferred for each row execute function ai.solmind_private_policy_coherent_v3();
create constraint trigger explorer_private_session_coherent after insert or update on ai.ai_interaction_session
deferrable initially deferred for each row execute function ai.solmind_private_policy_coherent_v3();

create function ai.solmind_private_policy_audit_v3() returns trigger
language plpgsql set search_path='' as $$
begin
  if old.safety_contract_version is not null and
    (new.restricted_level is distinct from old.restricted_level
      or new.adult_reflection_stopped is distinct from old.adult_reflection_stopped) then
    insert into audit.audit_event(event_type,actor_user_account_id,actor_role_context,target_entity_type,
      target_entity_id,action,reason_code,event_summary,metadata,ip_address,user_agent,created_at)
      values('ai_session_state_changed',null,'system','ai_interaction_session',new.conversation_id,
        'update','protected_state_changed','Protected conversation state changed.','{}',null,null,clock_timestamp());
  end if;
  return new;
end $$;
create trigger explorer_private_policy_audit after update on ai.explorer_conversation_state
for each row execute function ai.solmind_private_policy_audit_v3();

create function ai.solmind_private_evidence_guard_v3() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'solmind_explorer_private_immutable'; end if;
  if tg_op='UPDATE' and (
    (to_jsonb(new)-array['model_invocation_id','model_level','model_minor_indicated']) is distinct from
      (to_jsonb(old)-array['model_invocation_id','model_level','model_minor_indicated'])
    or (old.model_invocation_id is not null and new.model_invocation_id is distinct from old.model_invocation_id)
    or (old.model_level is not null and (new.model_level is distinct from old.model_level
      or new.model_minor_indicated is distinct from old.model_minor_indicated)))
    then raise exception 'solmind_explorer_private_evidence_conflict'; end if;
  if new.model_invocation_id is not null and not exists(
    select 1 from ai.explorer_conversation_operation op
      join ai.ai_context_snapshot sn on sn.ai_context_snapshot_id=op.snapshot_id
      join ai.ai_model_invocation inv on inv.ai_model_invocation_id=op.invocation_id
      join ai.ai_interaction_message msg on msg.ai_interaction_message_id=op.message_id
    where op.conversation_id=new.conversation_id and op.logical_operation_id=new.logical_operation_id
      and op.application_session_id=new.origin_application_session_id
      and op.command_fingerprint=new.command_fingerprint and op.invocation_id=new.model_invocation_id
      and op.fallback_policy_version=new.fallback_policy_version and op.model_policy_version=new.model_policy_version
      and op.safety_protocol_version='explorer-safety-reply.v1'
      and sn.evidence_contract_version='virtual-guide-predispatch-evidence.v3'
      and sn.application_session_id=op.application_session_id and sn.immediate_message_id=op.message_id
      and sn.ai_interaction_message_id=op.message_id and sn.actor_user_account_id=op.actor_user_account_id
      and sn.ai_interaction_session_id=op.conversation_id and inv.ai_interaction_session_id=op.conversation_id
      and inv.ai_context_snapshot_id=op.snapshot_id and inv.logical_operation_id=op.logical_operation_id
      and inv.dispatch_contract_version='virtual-guide-predispatch-evidence.v3'
      and msg.ai_interaction_session_id=op.conversation_id and msg.sender_type='user'
      and msg.sender_user_account_id=op.actor_user_account_id and msg.sender_role_context='explorer')
    then raise exception 'solmind_explorer_private_evidence_binding'; end if;
  return new;
end $$;
create trigger explorer_private_evidence_guard before update or delete or insert on ai.explorer_safety_evidence
for each row execute function ai.solmind_private_evidence_guard_v3();

create function ai.solmind_private_evidence_audit_v3() returns trigger
language plpgsql set search_path='' as $$
begin
  insert into audit.audit_event(event_type,actor_user_account_id,actor_role_context,target_entity_type,
    target_entity_id,action,reason_code,event_summary,metadata,ip_address,user_agent,created_at)
    values(case when tg_op='INSERT' then 'protected_ai_record_created' else 'protected_ai_record_enriched' end,
      null,'system','protected_ai_record',new.explorer_safety_evidence_id,
      case when tg_op='INSERT' then 'create' else 'update' end,
      case when tg_op='INSERT' then 'protected_record_created' else 'protected_record_enriched' end,
      case when tg_op='INSERT' then 'Protected AI operation record created.' else 'Protected AI operation record enriched.' end,
      '{}',null,null,clock_timestamp());
  return new;
end $$;
create trigger explorer_private_evidence_audit after insert or update on ai.explorer_safety_evidence
for each row execute function ai.solmind_private_evidence_audit_v3();

create function ai.solmind_raise_private_policy_v3(p_conversation uuid,p_level smallint,p_minor boolean)
returns void language plpgsql volatile set search_path='' as $$
declare st ai.explorer_conversation_state%rowtype; floor_level smallint; stopped boolean;
begin
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation for update;
  if not found or ai.solmind_private_policy_v3(p_conversation)->'known' is distinct from 'true'::jsonb
    or p_level is null or p_level not between 0 and 4 or p_minor is null
    then raise exception 'solmind_explorer_private_legacy_unknown'; end if;
  floor_level:=case when p_level>=3 then greatest(st.restricted_level,p_level) else st.restricted_level end;
  stopped:=st.adult_reflection_stopped or p_minor;
  if floor_level is distinct from st.restricted_level or stopped is distinct from st.adult_reflection_stopped then
    update ai.explorer_conversation_state set restricted_level=floor_level,adult_reflection_stopped=stopped,
      safety_version=safety_version+1 where conversation_id=p_conversation;
    update ai.ai_interaction_session set metadata=jsonb_set(metadata,'{restricted_mode}',to_jsonb(floor_level is not null),true)
      where ai_interaction_session_id=p_conversation;
  end if;
end $$;

-- Extend both successor shapes prospectively; no historical row is enriched.
alter table ai.ai_context_snapshot drop constraint ai_context_snapshot_predispatch_evidence_shape_check;
alter table ai.ai_context_snapshot add constraint ai_context_snapshot_predispatch_evidence_shape_check check (
  (actor_user_account_id is null and explorer_profile_id is null and guide_explorer_relationship_id is null
   and authorization_version is null and active_required_consent_document_ids is null
   and context_source_ids is null and context_fingerprint_sha256 is null and evidence_contract_version is null)
  or
  (actor_user_account_id is not null and explorer_profile_id is not null and guide_explorer_relationship_id is not null
   and authorization_version is not null and active_required_consent_document_ids is not null
   and cardinality(active_required_consent_document_ids) between 1 and 16
   and array_position(active_required_consent_document_ids,null) is null
   and context_source_ids is not null and cardinality(context_source_ids) between 1 and 256
   and array_position(context_source_ids,null) is null
   and context_fingerprint_sha256 is not null and context_fingerprint_sha256 ~ '^[0-9A-F]{64}$'
   and evidence_contract_version is not null
   and (
     (evidence_contract_version = 'virtual-guide-predispatch-evidence.v1' and authorization_version ~ '^AV1:[0-9A-F]{64}$')
     or
     (evidence_contract_version in ('virtual-guide-predispatch-evidence.v2','virtual-guide-predispatch-evidence.v3')
      and ((evidence_contract_version='virtual-guide-predispatch-evidence.v2' and authorization_version ~ '^AV2:[0-9A-F]{64}$')
        or (evidence_contract_version='virtual-guide-predispatch-evidence.v3' and authorization_version ~ '^AV3:[0-9A-F]{64}$'))
      and application_session_id is not null and immediate_message_id is not null
      and organization_id is not null and practice_id is not null
      and methodology_context_pack_version_id is not null and intake_response_set_id is not null
      and solmind_policy_version is not null and ai_behavior_version is not null
      and crisis_policy_version is not null and role_policy_version is not null and instruction_version is not null
      and related_prior_session_ids is not null and cardinality(related_prior_session_ids) = 0
      and related_summary_revision_ids = '[]'::jsonb and related_reflection_ids = '[]'::jsonb
      and related_waypoint_ids = '[]'::jsonb and related_goal_focus_area_ids = '[]'::jsonb
      and related_trigger_observation_ids = '[]'::jsonb)
   ))
);
alter table ai.ai_context_snapshot drop constraint ai_context_snapshot_successor_columns_check;
alter table ai.ai_context_snapshot add constraint ai_context_snapshot_successor_columns_check check (
  (evidence_contract_version is not null and evidence_contract_version in ('virtual-guide-predispatch-evidence.v2','virtual-guide-predispatch-evidence.v3'))
  or (application_session_id is null and immediate_message_id is null and organization_id is null
    and practice_id is null and solmind_policy_version is null and ai_behavior_version is null
    and crisis_policy_version is null and role_policy_version is null and instruction_version is null
    and intake_response_set_id is null and related_prior_session_ids is null)
);
alter table ai.ai_model_invocation drop constraint ai_model_invocation_predispatch_evidence_shape_check;
alter table ai.ai_model_invocation add constraint ai_model_invocation_predispatch_evidence_shape_check check (
  (logical_operation_id is null and ai_context_snapshot_id is null and dispatch_contract_version is null)
  or (logical_operation_id is not null and ai_context_snapshot_id is not null and ai_interaction_session_id is not null
    and dispatch_contract_version is not null and dispatch_contract_version in
      ('virtual-guide-predispatch-evidence.v1','virtual-guide-predispatch-evidence.v2','virtual-guide-predispatch-evidence.v3'))
);
create or replace function ai.solmind_conversation_snapshot_immutable() returns trigger
language plpgsql set search_path='' as $$
begin
  if (tg_op='UPDATE' and new.evidence_contract_version='virtual-guide-predispatch-evidence.v3'
      and old.evidence_contract_version is distinct from new.evidence_contract_version)
    or old.evidence_contract_version in ('virtual-guide-predispatch-evidence.v2','virtual-guide-predispatch-evidence.v3')
    or (tg_op='UPDATE' and old.evidence_contract_version='virtual-guide-predispatch-evidence.v1'
      and new.evidence_contract_version is distinct from old.evidence_contract_version) then
    raise exception 'solmind_explorer_conversation_snapshot_immutable';
  end if;
  if tg_op='UPDATE' then return new; end if;
  return old;
end $$;

-- Copy the complete v2 current authority checks, changing ONLY its restricted
-- predicate for owned/support access. Ordinary eligibility is checked separately
-- under the same owner/state locks in prepare/settle. No authority is inferred
-- from service possession or a caller configuration hash.
create function ai.solmind_private_owned_authority_v3(
  p_actor uuid,p_app_session uuid,p_conversation uuid
) returns jsonb language plpgsql volatile security definer
set search_path = '' set lock_timeout = '2000ms' as $$
declare
  s ai.ai_interaction_session%rowtype;
  e core.explorer_profile%rowtype;
  r core.guide_explorer_relationship%rowtype;
  p core.practice%rowtype;
  o core.organization%rowtype;
  u identity.user_session%rowtype;
  i core.intake_response_set%rowtype;
  ids uuid[]; docs jsonb; answers jsonb; authority jsonb;
begin
  if current_setting('transaction_isolation') is distinct from 'read committed'
    or p_actor is null or p_app_session is null then
    raise exception 'solmind_explorer_conversation_denied';
  end if;
  if p_conversation is not null then
    select x.* into s from ai.ai_interaction_session x
      where x.ai_interaction_session_id=p_conversation for update;
    if not found or s.actor_user_account_id is distinct from p_actor
      or s.actor_role_context is distinct from 'explorer' or s.session_status is distinct from 'active'
      or s.session_type is distinct from 'explorer_reflection'
      or jsonb_typeof(s.metadata) is distinct from 'object'
    then raise exception 'solmind_explorer_conversation_denied'; end if;
  end if;
  perform a.user_account_id from identity.user_account a
    join identity.user_role_assignment ra on ra.user_account_id=a.user_account_id
      and ra.role_code='explorer' and ra.role_status='active'
      and ra.revoked_at is null and ra.granted_at<=clock_timestamp()
    where a.user_account_id=p_actor and a.account_status='active' for share of a,ra;
  if not found then raise exception 'solmind_explorer_conversation_denied'; end if;
  select x.* into u from identity.user_session x
    where x.user_session_id=p_app_session for share;
  if not found or u.user_account_id is distinct from p_actor
    or u.active_role_context is distinct from 'explorer' or u.session_status is distinct from 'active'
    or u.ended_at is not null or u.expires_at <= clock_timestamp()
    or (select count(*) from identity.user_session x where x.user_account_id=p_actor and x.session_status='active') <> 1
  then raise exception 'solmind_explorer_conversation_denied'; end if;
  select x.* into e from core.explorer_profile x
    where x.user_account_id=p_actor and x.status='active' for update;
  if not found or e.onboarding_status is distinct from 'active' then
    raise exception 'solmind_explorer_conversation_denied'; end if;
  if p_conversation is not null and s.explorer_profile_id is distinct from e.explorer_profile_id then
    raise exception 'solmind_explorer_conversation_denied'; end if;
  if p_conversation is not null and exists(select 1 from ai.ai_interaction_message m
    where m.ai_interaction_session_id=p_conversation and (
      (m.sender_type='user' and m.sender_user_account_id=p_actor and m.sender_role_context='explorer')
      or (m.sender_type='ai' and m.ai_role='solmind_virtual_guide' and m.sender_user_account_id is null)
    ) is not true) then raise exception 'solmind_explorer_conversation_denied'; end if;
  select x.* into r from core.guide_explorer_relationship x
    where x.explorer_profile_id=e.explorer_profile_id and x.relationship_status in ('active','paused')
    order by x.guide_explorer_relationship_id limit 1 for update;
  if not found then raise exception 'solmind_explorer_conversation_denied'; end if;
  perform x.guide_explorer_relationship_id from core.guide_explorer_relationship x
    where x.explorer_profile_id=e.explorer_profile_id order by x.guide_explorer_relationship_id for share;
  if exists(select 1 from core.guide_explorer_relationship x where x.explorer_profile_id=e.explorer_profile_id
      and x.guide_explorer_relationship_id<>r.guide_explorer_relationship_id
      and (x.relationship_status is null or x.relationship_status not in ('ended','transferred')))
    or (p_conversation is not null and
      (s.guide_explorer_relationship_id is distinct from r.guide_explorer_relationship_id
       or s.practice_id is distinct from r.practice_id))
  then raise exception 'solmind_explorer_conversation_denied'; end if;
  select x.* into p from core.practice x where x.practice_id=r.practice_id for share;
  if not found or p.status is distinct from 'active' or p.approval_status is distinct from 'approved'
    then raise exception 'solmind_explorer_conversation_denied'; end if;
  select x.* into o from core.organization x where x.organization_id=p.organization_id for share;
  if not found or o.status is distinct from 'active' or o.approval_status is distinct from 'approved'
    then raise exception 'solmind_explorer_conversation_denied'; end if;
  lock table core.consent_document in share mode;
  select array_agg(d.consent_document_id order by d.consent_document_id::text),
    jsonb_agg(jsonb_build_array(d.consent_document_id,d.version_label,d.consent_type) order by d.consent_document_id::text)
    into ids,docs from core.consent_document d
    where d.document_status='active' and d.is_required_for_explorer is true;
  if ids is null or cardinality(ids) not between 1 and 16 then
    raise exception 'solmind_explorer_conversation_denied'; end if;
  perform cr.consent_record_id from core.consent_record cr join core.consent_document d
    on d.consent_document_id=cr.consent_document_id
    where cr.user_account_id=p_actor and cr.role_context='explorer' and cr.consent_document_id=any(ids)
      and cr.consent_type=d.consent_type and cr.document_version=d.version_label and cr.adult_affirmation is true
    order by cr.consent_record_id for share of cr;
  if exists(select 1 from core.consent_document d where d.consent_document_id=any(ids)
    and not exists(select 1 from core.consent_record cr where cr.user_account_id=p_actor
      and cr.role_context='explorer' and cr.consent_document_id=d.consent_document_id
      and cr.consent_type=d.consent_type and cr.document_version=d.version_label and cr.adult_affirmation is true))
  then raise exception 'solmind_explorer_conversation_denied'; end if;
  select x.* into i from core.intake_response_set x
    where x.guide_explorer_relationship_id=r.guide_explorer_relationship_id and x.intake_status='completed'
    order by x.completed_at desc,x.intake_response_set_id desc limit 1 for share;
  if not found or i.completed_at is null or i.completed_at>clock_timestamp()
    or jsonb_typeof(i.response_json) is distinct from 'object'
  then raise exception 'solmind_explorer_conversation_denied'; end if;
  if exists(select 1 from jsonb_object_keys(i.response_json) as keys(key)
      where key not in ('supportNow','usefulOutcome','supportStyle','guideContext','communicationPreference','doNotEmphasize'))
    or exists(select 1 from unnest(array['supportNow','usefulOutcome','supportStyle']) k
      where jsonb_typeof(i.response_json->k) is distinct from 'string'
        or not ai.solmind_conversation_text_valid(i.response_json->>k,8192,false))
    or exists(select 1 from jsonb_each(i.response_json) kv
      where jsonb_typeof(kv.value) is distinct from 'string' or char_length(kv.value#>>'{}')>8192)
  then raise exception 'solmind_explorer_conversation_denied'; end if;
  answers:=jsonb_build_object('supportNow',i.response_json->>'supportNow','usefulOutcome',i.response_json->>'usefulOutcome',
    'supportStyle',i.response_json->>'supportStyle','guideContext',coalesce(i.response_json->>'guideContext',''),
    'communicationPreference',coalesce(i.response_json->>'communicationPreference',''),
    'doNotEmphasize',coalesce(i.response_json->>'doNotEmphasize',''));
  authority:=jsonb_build_object('accountId',p_actor,'explorerId',e.explorer_profile_id,
    'relationshipId',r.guide_explorer_relationship_id,'guideId',r.guide_profile_id,
    'relationshipStatus',r.relationship_status,'practiceId',p.practice_id,'organizationId',o.organization_id,
    'applicationSessionId',p_app_session,'applicationSessionExpiresAt',u.expires_at,
    'onboardingStatus','active','adultAffirmation',true,
    'onboarding',jsonb_build_object('responseId',i.intake_response_set_id,'answers',answers),
    'requiredConsentDocumentIds',to_jsonb(ids));
  return authority || jsonb_build_object('authorizationVersion','AV3:'||upper(encode(extensions.digest(
    convert_to(jsonb_build_array('explorer-owned-authority.v3',
      authority||jsonb_build_object('requiredConsentVersions',docs),p_conversation,
      case when p_conversation is null then jsonb_build_object('presence','not_selected')
        else jsonb_build_object('policy',ai.solmind_private_policy_v3(p_conversation),
          'restrictedMode',s.metadata->'restricted_mode') end)::text,'UTF8'),'sha256'),'hex')));
end $$;

create function public.solmind_prepare_explorer_conversation_turn_v3(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,
  p_operation_id uuid,p_expected_revision integer,p_message_id uuid,p_snapshot_id uuid,p_invocation_id uuid,
  p_body text,p_context_serialization text,p_context_fingerprint_sha256 text,p_context_source_ids uuid[],
  p_authorization_version text,p_intake_response_set_id uuid,p_methodology_context_pack_version_id uuid,
  p_prompt_version text,p_policy_version text,p_behavior_version text,p_crisis_version text,
  p_role_version text,p_instruction_version text,p_command_fingerprint text,p_logical_operation_id uuid,
  p_methodology_context_pack_id uuid,p_methodology_content_sha256 text,p_methodology_authorization_version text,
  p_protocol_version text,p_request_mode text,p_configuration_fingerprint text,p_fallback_policy_version text,
  p_model_policy_version text,p_trusted_response_version text,p_resource_policy_version text,
  p_expected_safety_version bigint,p_fallback_level smallint,p_fallback_minor_indicated boolean
) returns table(outcome text,conversation_state jsonb,dispatch_permitted boolean,policy_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; e jsonb; st ai.explorer_conversation_state%rowtype; old_op ai.explorer_conversation_operation%rowtype;
  h text; ids uuid[]; mode text; ctx json; inspected record; n integer; ts timestamptz;
  v_contract constant text:='virtual-guide-predispatch-evidence.v3';
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_user_session_id is null or p_conversation_id is null or p_operation_id is null or p_message_id is null
    or p_snapshot_id is null or p_invocation_id is null or p_logical_operation_id is null
    or p_expected_revision is null or p_expected_revision<0 or p_expected_safety_version is null or p_expected_safety_version<0
    or p_protocol_version is distinct from 'explorer-safety-reply.v1'
    or p_request_mode is null or p_request_mode not in ('classification_and_reply','classification_only')
    or p_fallback_level is null or p_fallback_level not between 0 and 4 or p_fallback_minor_indicated is null
    or not ai.solmind_conversation_text_valid(p_body,8192,false)
    or p_configuration_fingerprint is null or p_configuration_fingerprint !~ '^[0-9A-F]{64}$'
    or p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$'
    or p_context_serialization is null or octet_length(p_context_serialization) not between 2 and 524288
    or p_context_fingerprint_sha256 is null or p_context_fingerprint_sha256 !~ '^[0-9A-F]{64}$'
    or p_authorization_version is null or p_authorization_version !~ '^AV3:[0-9A-F]{64}$'
    or p_context_fingerprint_sha256 is distinct from upper(encode(extensions.digest(convert_to(p_context_serialization,'UTF8'),'sha256'),'hex'))
    or p_intake_response_set_id is null or p_methodology_context_pack_id is null or p_methodology_context_pack_version_id is null
    or p_methodology_content_sha256 is null or p_methodology_content_sha256 !~ '^[0-9A-F]{64}$'
    or p_methodology_authorization_version is null or p_methodology_authorization_version !~ '^MV1:[0-9A-F]{64}$'
    or p_context_source_ids is null or cardinality(p_context_source_ids) not between 3 and 103
    or array_position(p_context_source_ids,null) is not null
    or exists(select 1 from unnest(array[p_prompt_version,p_policy_version,p_behavior_version,p_crisis_version,
      p_role_version,p_instruction_version,p_fallback_policy_version,p_model_policy_version,
      p_trusted_response_version,p_resource_policy_version]) as versions(version)
      where version is null or version !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$')
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  select array_agg(distinct x order by x) into ids from unnest(p_context_source_ids) as sources(x);
  if ids is distinct from p_context_source_ids or not(p_message_id=any(ids))
    or not(p_intake_response_set_id=any(ids)) or not(p_methodology_context_pack_version_id=any(ids))
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  h:=methodology.hash_json(jsonb_build_array(p_actor_user_account_id,p_user_session_id,p_conversation_id,
    p_operation_id,p_expected_revision,p_message_id,p_snapshot_id,p_invocation_id,p_body,p_context_fingerprint_sha256,ids,
    p_authorization_version,p_intake_response_set_id,p_methodology_context_pack_version_id,p_prompt_version,p_policy_version,
    p_behavior_version,p_crisis_version,p_role_version,p_instruction_version,p_command_fingerprint,p_logical_operation_id,
    p_methodology_context_pack_id,p_methodology_content_sha256,p_methodology_authorization_version,p_protocol_version,
    p_request_mode,p_configuration_fingerprint,p_fallback_policy_version,p_model_policy_version,p_trusted_response_version,
    p_resource_policy_version,p_expected_safety_version,p_fallback_level,p_fallback_minor_indicated));
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id
    then raise exception 'solmind_explorer_private_denied'; end if;
  select x.* into old_op from ai.explorer_conversation_operation x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id for update;
  if found then
    if old_op.kind is distinct from 'send' or old_op.conversation_id is distinct from p_conversation_id
      or old_op.application_session_id is distinct from p_user_session_id
      or old_op.request_fingerprint is distinct from h or old_op.command_fingerprint is distinct from p_command_fingerprint
      or old_op.safety_protocol_version is distinct from p_protocol_version
      then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    -- Exact persisted request first: no current methodology/source collection or
    -- changed version enrichment, and never another dispatch permission.
    if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp()
      then raise exception 'solmind_explorer_private_denied'; end if;
    return query select 'exact_replay'::text,ai.solmind_conversation_state_json(p_conversation_id),false,
      ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  if st.revision is distinct from p_expected_revision or st.pending_operation_id is not null then
    return query select 'stale_revision'::text,null::jsonb,false,ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  if ai.solmind_private_policy_v3(p_conversation_id)->'known' is distinct from 'true'::jsonb
    then raise exception 'solmind_explorer_private_legacy_unknown'; end if;
  perform ai.solmind_store_private_observation_v3(p_conversation_id,p_user_session_id,p_logical_operation_id,
    p_command_fingerprint,p_fallback_policy_version,p_model_policy_version,p_fallback_level,p_fallback_minor_indicated,
    null,null,null);
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id;
  mode:=case when st.restricted_level is not null or st.adult_reflection_stopped or p_fallback_level>=3
    or p_fallback_minor_indicated then 'classification_only' else 'classification_and_reply' end;
  if st.safety_version is distinct from p_expected_safety_version or p_request_mode is distinct from mode then
    return query select 'stale_policy'::text,null::jsonb,false,ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  if a->>'authorizationVersion' is distinct from p_authorization_version
    or (a->'onboarding'->>'responseId')::uuid is distinct from p_intake_response_set_id
    then raise exception 'solmind_explorer_private_denied'; end if;
  e:=methodology.resolve_effective(p_methodology_context_pack_id,(a->>'guideId')::uuid);
  if (e->>'versionId')::uuid is distinct from p_methodology_context_pack_version_id
    or e->>'contentSha256' is distinct from p_methodology_content_sha256
    or e->>'methodologyAuthorizationVersion' is distinct from p_methodology_authorization_version
    or not methodology.serialized_methodology_valid(p_context_serialization,p_methodology_context_pack_version_id,e->>'contentMarkdown')
    then raise exception 'solmind_explorer_private_denied'; end if;
  ctx:=p_context_serialization::json;
  if ctx->'immediateExplorerMessage'->>'messageId' is distinct from p_message_id::text
    or ctx->'immediateExplorerMessage'->>'content' is distinct from p_body
    or ctx->'globalPolicy'->>'version' is distinct from p_policy_version
    or ctx->'roleBehavior'->>'version' is distinct from p_behavior_version
    or ctx->'crisisBehavior'->>'version' is distinct from p_crisis_version
    then raise exception 'solmind_explorer_private_denied'; end if;
  -- The source owner locks all covered tables NOWAIT before its fresh scan.
  -- Its blocked audit MUST survive: return rather than throw after that row.
  select x.* into inspected from ai.solmind_record_explorer_context_exclusion_v3(
    p_actor_user_account_id,p_user_session_id,(a->>'explorerId')::uuid,(a->>'relationshipId')::uuid,
    p_conversation_id,p_context_serialization,ids) x;
  if not found or inspected.outcome is null or inspected.outcome not in ('clear','blocked','unavailable')
    then raise exception 'solmind_explorer_private_unavailable'; end if;
  if inspected.outcome<>'clear' then
    return query select inspected.outcome::text,null::jsonb,false,null::jsonb; return;
  end if;
  select count(*)::integer into n from ai.ai_interaction_message m where m.ai_interaction_session_id=p_conversation_id;
  if n>98 then return query select 'unavailable'::text,null::jsonb,false,null::jsonb; return; end if;
  ts:=clock_timestamp();
  insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
    sender_type,sender_user_account_id,sender_role_context,content_text,created_at)
    values(p_message_id,p_conversation_id,n+1,'user',p_actor_user_account_id,'explorer',p_body,ts);
  insert into ai.ai_context_snapshot(ai_context_snapshot_id,ai_interaction_session_id,ai_interaction_message_id,
    prompt_version,methodology_context_pack_version_id,actor_user_account_id,explorer_profile_id,
    guide_explorer_relationship_id,authorization_version,active_required_consent_document_ids,context_source_ids,
    context_fingerprint_sha256,evidence_contract_version,application_session_id,immediate_message_id,
    organization_id,practice_id,solmind_policy_version,ai_behavior_version,crisis_policy_version,
    role_policy_version,instruction_version,intake_response_set_id,related_prior_session_ids,created_at,
    explorer_safety_protocol_version,explorer_safety_request_mode,explorer_configuration_fingerprint,
    fallback_policy_version,model_policy_version,trusted_response_version,resource_policy_version)
    values(p_snapshot_id,p_conversation_id,p_message_id,p_prompt_version,p_methodology_context_pack_version_id,
      p_actor_user_account_id,(a->>'explorerId')::uuid,(a->>'relationshipId')::uuid,p_authorization_version,
      array(select jsonb_array_elements_text(a->'requiredConsentDocumentIds')::uuid),ids,
      p_context_fingerprint_sha256,v_contract,p_user_session_id,p_message_id,(a->>'organizationId')::uuid,
      (a->>'practiceId')::uuid,p_policy_version,p_behavior_version,p_crisis_version,p_role_version,p_instruction_version,
      p_intake_response_set_id,array[]::uuid[],ts,p_protocol_version,p_request_mode,p_configuration_fingerprint,
      p_fallback_policy_version,p_model_policy_version,p_trusted_response_version,p_resource_policy_version);
  insert into ai.ai_model_invocation(ai_model_invocation_id,ai_interaction_session_id,provider_name,model_name,
    prompt_version,logical_operation_id,ai_context_snapshot_id,dispatch_contract_version,started_at)
    values(p_invocation_id,p_conversation_id,'openai','gpt-5.6-luna',p_prompt_version,p_logical_operation_id,p_snapshot_id,v_contract,ts);
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
    conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,message_id,snapshot_id,invocation_id,
    logical_operation_id,safety_protocol_version,safety_request_mode,configuration_fingerprint,fallback_observation_fingerprint,
    fallback_policy_version,model_policy_version,trusted_response_version,resource_policy_version)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,'send',h,p_command_fingerprint,
      p_expected_revision,'started',p_message_id,p_snapshot_id,p_invocation_id,p_logical_operation_id,
      p_protocol_version,p_request_mode,p_configuration_fingerprint,
      methodology.hash_json(jsonb_build_array('explorer-fallback-observation.v1',p_user_session_id,p_conversation_id,
        p_logical_operation_id,p_command_fingerprint,p_configuration_fingerprint,p_fallback_policy_version,
        p_model_policy_version,p_fallback_level,p_fallback_minor_indicated)),p_fallback_policy_version,
      p_model_policy_version,p_trusted_response_version,p_resource_policy_version);
  insert into methodology.explorer_methodology_binding(ai_context_snapshot_id,methodology_context_pack_id,
    methodology_context_pack_version_id,content_sha256,methodology_authorization_version,created_at)
    values(p_snapshot_id,p_methodology_context_pack_id,p_methodology_context_pack_version_id,p_methodology_content_sha256,
      p_methodology_authorization_version,ts);
  perform ai.solmind_store_private_observation_v3(p_conversation_id,p_user_session_id,p_logical_operation_id,
    p_command_fingerprint,p_fallback_policy_version,p_model_policy_version,p_fallback_level,p_fallback_minor_indicated,
    p_invocation_id,null,null);
  insert into audit.audit_event(event_type,actor_user_account_id,actor_role_context,target_entity_type,
    target_entity_id,action,reason_code,event_summary,metadata)
    values('ai_context_snapshot_created',p_actor_user_account_id,'explorer','ai_context_snapshot',p_snapshot_id,
      'create','pre_dispatch_snapshot_created','Virtual Guide context snapshot created before provider dispatch.',
      jsonb_build_object('contract_version',v_contract,'operation_id',p_logical_operation_id::text,
        'role_context','explorer','session_id',p_conversation_id::text)),
    ('ai_model_invocation_started',p_actor_user_account_id,'explorer','ai_model_invocation',p_invocation_id,
      'start','pre_dispatch_invocation_started','Virtual Guide model invocation started before provider dispatch.',
      jsonb_build_object('context_snapshot_id',p_snapshot_id::text,'contract_version',v_contract,
        'model_name','gpt-5.6-luna','operation_id',p_logical_operation_id::text,'provider_name','openai',
        'request_status','started','role_context','explorer','session_id',p_conversation_id::text));
  update ai.explorer_conversation_state set revision=revision+1,pending_operation_id=p_operation_id
    where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp()
    then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id),true,
    ai.solmind_private_policy_v3(p_conversation_id);
end $$;

create function public.solmind_settle_explorer_conversation_turn_v3(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_status text,p_reply_message_id uuid,p_reply_kind text,p_reply_body text,
  p_model_level smallint,p_model_minor_indicated boolean,p_protocol_version text,p_request_mode text,
  p_configuration_fingerprint text,p_fallback_policy_version text,p_model_policy_version text,
  p_trusted_response_version text,p_resource_policy_version text,p_fallback_level smallint,
  p_fallback_minor_indicated boolean,p_delivery_interested boolean
) returns table(outcome text,conversation_state jsonb,policy_state jsonb,saved_reply boolean)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare st ai.explorer_conversation_state%rowtype; op ai.explorer_conversation_operation%rowtype;
  a jsonb; intent text; h text; observed_fallback text; ts timestamptz; n integer;
  may_return boolean:=false; may_save boolean:=false; saved_id uuid; saved_body text; saved_kind text:='none';
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_user_session_id is null or p_conversation_id is null or p_operation_id is null
    or p_status is null or p_status not in ('completed','failed','canceled')
    or p_protocol_version is distinct from 'explorer-safety-reply.v1'
    or p_request_mode is null or p_request_mode not in ('classification_and_reply','classification_only')
    or p_reply_kind is null or p_reply_kind not in ('ordinary','urgent','crisis','restricted','adult_only','none')
    or (p_reply_kind='none' and (p_reply_message_id is not null or p_reply_body is not null))
    or (p_reply_kind<>'none' and (p_reply_message_id is null or not ai.solmind_conversation_text_valid(p_reply_body,8192,false)))
    or (p_status<>'completed' and p_reply_kind<>'none')
    or (p_model_level is null) is distinct from (p_model_minor_indicated is null)
    or (p_model_level is not null and p_model_level not between 0 and 4)
    or (p_status='completed' and p_model_level is null)
    or p_fallback_level is null or p_fallback_level not between 0 and 4 or p_fallback_minor_indicated is null
    or p_delivery_interested is null
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  -- Technical settlement owns the already-prepared operation, not a new login
  -- authority. Preserve actual positives after logout without returning content.
  perform s.ai_interaction_session_id from ai.ai_interaction_session s
    where s.ai_interaction_session_id=p_conversation_id and s.actor_user_account_id=p_actor_user_account_id
      and s.actor_role_context='explorer' and s.session_type='explorer_reflection' for update;
  if not found then raise exception 'solmind_explorer_private_denied'; end if;
  perform u.user_session_id from identity.user_session u where u.user_session_id=p_user_session_id
    and u.user_account_id=p_actor_user_account_id and u.active_role_context='explorer' for share;
  if not found then raise exception 'solmind_explorer_private_denied'; end if;
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id
    or ai.solmind_private_policy_v3(p_conversation_id)->'known' is distinct from 'true'::jsonb
    then raise exception 'solmind_explorer_private_legacy_unknown'; end if;
  select x.* into op from ai.explorer_conversation_operation x where x.actor_user_account_id=p_actor_user_account_id
    and x.operation_id=p_operation_id for update;
  if not found or op.kind is distinct from 'send' or op.conversation_id is distinct from p_conversation_id
    or op.application_session_id is distinct from p_user_session_id
    or op.safety_protocol_version is distinct from p_protocol_version or op.safety_request_mode is distinct from p_request_mode
    or op.configuration_fingerprint is distinct from p_configuration_fingerprint
    or op.fallback_policy_version is distinct from p_fallback_policy_version
    or op.model_policy_version is distinct from p_model_policy_version
    or op.trusted_response_version is distinct from p_trusted_response_version
    or op.resource_policy_version is distinct from p_resource_policy_version
    then raise exception 'solmind_explorer_private_operation_conflict'; end if;
  observed_fallback:=methodology.hash_json(jsonb_build_array('explorer-fallback-observation.v1',p_user_session_id,p_conversation_id,
    op.logical_operation_id,op.command_fingerprint,p_configuration_fingerprint,p_fallback_policy_version,
    p_model_policy_version,p_fallback_level,p_fallback_minor_indicated));
  if op.fallback_observation_fingerprint is distinct from observed_fallback
    then raise exception 'solmind_explorer_private_operation_conflict'; end if;
  intent:=methodology.hash_json(jsonb_build_array(p_actor_user_account_id,p_user_session_id,p_conversation_id,p_operation_id,
    op.logical_operation_id,op.message_id,op.snapshot_id,op.invocation_id,p_status,p_reply_message_id,p_reply_kind,p_reply_body,
    p_model_level,p_model_minor_indicated,p_protocol_version,p_request_mode,p_configuration_fingerprint,p_fallback_policy_version,
    p_model_policy_version,p_trusted_response_version,p_resource_policy_version,p_fallback_level,p_fallback_minor_indicated,
    p_delivery_interested));
  if op.status<>'started' then
    if op.reply_message_id is not null then
      select m.content_text into saved_body from ai.ai_interaction_message m
        where m.ai_interaction_message_id=op.reply_message_id and m.ai_interaction_session_id=p_conversation_id;
      if not found then raise exception 'solmind_explorer_private_operation_conflict'; end if;
      saved_kind:=p_reply_kind;
    end if;
    h:=methodology.hash_json(jsonb_build_array(intent,op.reply_message_id,saved_kind,saved_body));
    if op.terminal_fingerprint is distinct from h then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    begin
      a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
      may_return:=(a->>'applicationSessionExpiresAt')::timestamptz>clock_timestamp();
    exception when others then may_return:=false; end;
    return query select 'exact_replay'::text,
      case when may_return then ai.solmind_conversation_state_json(p_conversation_id) else null::jsonb end,
      case when may_return then ai.solmind_private_policy_v3(p_conversation_id) else null::jsonb end,
      op.reply_message_id is not null; return;
  end if;
  if st.pending_operation_id is distinct from p_operation_id then raise exception 'solmind_explorer_private_operation_conflict'; end if;
  perform inv.ai_model_invocation_id from ai.ai_model_invocation inv
    join ai.ai_context_snapshot sn on sn.ai_context_snapshot_id=op.snapshot_id
    join ai.ai_interaction_message msg on msg.ai_interaction_message_id=op.message_id
    join methodology.explorer_methodology_binding mb on mb.ai_context_snapshot_id=sn.ai_context_snapshot_id
    where inv.ai_model_invocation_id=op.invocation_id and inv.request_status='started'
      and inv.ai_interaction_session_id=p_conversation_id and inv.ai_context_snapshot_id=op.snapshot_id
      and inv.logical_operation_id=op.logical_operation_id and inv.dispatch_contract_version='virtual-guide-predispatch-evidence.v3'
      and inv.provider_name='openai' and inv.model_name='gpt-5.6-luna' and inv.safety_result='{}'::jsonb
      and sn.ai_interaction_session_id=p_conversation_id and sn.actor_user_account_id=p_actor_user_account_id
      and sn.application_session_id=p_user_session_id and sn.ai_interaction_message_id=op.message_id
      and sn.immediate_message_id=op.message_id and sn.evidence_contract_version=inv.dispatch_contract_version
      and sn.explorer_safety_protocol_version=op.safety_protocol_version and sn.explorer_safety_request_mode=op.safety_request_mode
      and sn.explorer_configuration_fingerprint=op.configuration_fingerprint
      and sn.fallback_policy_version=op.fallback_policy_version and sn.model_policy_version=op.model_policy_version
      and sn.trusted_response_version=op.trusted_response_version and sn.resource_policy_version=op.resource_policy_version
      and mb.methodology_context_pack_version_id=sn.methodology_context_pack_version_id
      and msg.ai_interaction_session_id=p_conversation_id and msg.sender_type='user'
      and msg.sender_user_account_id=p_actor_user_account_id and msg.sender_role_context='explorer'
    for update of inv;
  if not found then raise exception 'solmind_explorer_private_operation_conflict'; end if;
  perform ai.solmind_store_private_observation_v3(p_conversation_id,p_user_session_id,op.logical_operation_id,
    op.command_fingerprint,p_fallback_policy_version,p_model_policy_version,p_fallback_level,p_fallback_minor_indicated,
    op.invocation_id,p_model_level,p_model_minor_indicated);
  -- Full CURRENT user authority is separate from positive-preserving settlement.
  -- A denial is caught locally, preserving the approved observation outside this
  -- subtransaction; it saves/returns no private response after an expired login.
  begin
    a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
    may_return:=(a->>'applicationSessionExpiresAt')::timestamptz>clock_timestamp();
  exception when others then may_return:=false; end;
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id;
  may_save:=may_return and p_delivery_interested and p_status='completed' and p_reply_kind<>'none'
    and case p_reply_kind
      when 'ordinary' then p_request_mode='classification_and_reply' and st.restricted_level is null
        and not st.adult_reflection_stopped
      when 'crisis' then st.restricted_level=4 and greatest(p_fallback_level,coalesce(p_model_level,0))=4
      when 'urgent' then st.restricted_level>=3 and greatest(p_fallback_level,coalesce(p_model_level,0))=3
      when 'adult_only' then st.adult_reflection_stopped and greatest(p_fallback_level,coalesce(p_model_level,0))<3
      when 'restricted' then st.restricted_level is not null and greatest(p_fallback_level,coalesce(p_model_level,0))<3
        and not st.adult_reflection_stopped
      else false end;
  -- A minor indication may accompany urgent/crisis support only when the trusted
  -- server renderer includes the adults-only boundary and verified suitable help.
  -- SQL binds that reviewed configuration/version; it does not certify semantics.
  if may_save and (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then
    may_save:=false; may_return:=false;
  end if;
  if may_save then
    select count(*)::integer into n from ai.ai_interaction_message m where m.ai_interaction_session_id=p_conversation_id;
    if n>=100 then may_save:=false; end if;
  end if;
  ts:=clock_timestamp();
  if may_save then
    saved_id:=p_reply_message_id; saved_body:=p_reply_body; saved_kind:=p_reply_kind;
    insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
      sender_type,ai_role,content_text,created_at)
      values(saved_id,p_conversation_id,n+1,'ai','solmind_virtual_guide',saved_body,ts);
  end if;
  -- Observation and turn are different facts: an accepted complete
  -- classification remains a completed invocation even if prose was invalid,
  -- delivery canceled, or the operation intentionally records failed/canceled.
  update ai.ai_model_invocation set request_status=case when p_model_level is not null then 'completed' else p_status end,
    completed_at=ts,ai_interaction_message_id=saved_id,
    error_summary=case when p_model_level is null and p_status='failed' then 'provider_unavailable' else null end
    where ai_model_invocation_id=op.invocation_id;
  h:=methodology.hash_json(jsonb_build_array(intent,saved_id,saved_kind,saved_body));
  update ai.explorer_conversation_operation set status=p_status,completed_at=ts,terminal_fingerprint=h,reply_message_id=saved_id
    where actor_user_account_id=p_actor_user_account_id and operation_id=p_operation_id;
  update ai.explorer_conversation_state set revision=revision+1,pending_operation_id=null where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if may_return and (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then
    -- Do not raise after accepting a positive. A saved reply's authority was
    -- checked immediately before its insert under the locked current facts.
    may_return:=false;
  end if;
  return query select case when saved_id is not null or p_reply_kind='none' then 'ok' else 'withheld' end,
    case when may_return then ai.solmind_conversation_state_json(p_conversation_id) else null::jsonb end,
    case when may_return then ai.solmind_private_policy_v3(p_conversation_id) else null::jsonb end,
    saved_id is not null;
end $$;

create function ai.solmind_private_operation_guard_v3() returns trigger
language plpgsql set search_path='' as $$
begin
  if old.safety_protocol_version is null then
    if tg_op='UPDATE' and new.safety_protocol_version is not null then
      raise exception 'solmind_explorer_private_immutable'; end if;
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op='DELETE' or old.status<>'started' then raise exception 'solmind_explorer_private_immutable'; end if;
  if (to_jsonb(new)-array['status','completed_at','terminal_fingerprint','reply_message_id']) is distinct from
      (to_jsonb(old)-array['status','completed_at','terminal_fingerprint','reply_message_id'])
    or new.status not in ('completed','failed','canceled') or new.completed_at is null or new.terminal_fingerprint is null
    then raise exception 'solmind_explorer_private_immutable'; end if;
  return new;
end $$;
create trigger explorer_private_operation_guard before update or delete on ai.explorer_conversation_operation
for each row execute function ai.solmind_private_operation_guard_v3();

create function ai.solmind_private_invocation_guard_v3() returns trigger
language plpgsql set search_path='' as $$
begin
  if old.dispatch_contract_version is distinct from 'virtual-guide-predispatch-evidence.v3' then
    if tg_op='UPDATE' and new.dispatch_contract_version='virtual-guide-predispatch-evidence.v3'
      then raise exception 'solmind_explorer_private_immutable'; end if;
    if tg_op='DELETE' then return old; end if; return new;
  end if;
  if tg_op='DELETE' or old.request_status<>'started'
    then raise exception 'solmind_explorer_private_immutable'; end if;
  if (to_jsonb(new)-array['request_status','completed_at','ai_interaction_message_id','error_summary']) is distinct from
      (to_jsonb(old)-array['request_status','completed_at','ai_interaction_message_id','error_summary'])
    or new.request_status not in ('completed','failed','canceled') or new.completed_at is null
    or new.safety_result is distinct from '{}'::jsonb
    then raise exception 'solmind_explorer_private_immutable'; end if;
  return new;
end $$;
create trigger explorer_private_invocation_guard before update or delete on ai.ai_model_invocation
for each row execute function ai.solmind_private_invocation_guard_v3();

create function ai.solmind_private_message_guard_v3() returns trigger
language plpgsql set search_path='' as $$
begin
  if exists(select 1 from ai.explorer_conversation_operation op where op.safety_protocol_version='explorer-safety-reply.v1'
    and (op.message_id=old.ai_interaction_message_id or op.reply_message_id=old.ai_interaction_message_id))
    then raise exception 'solmind_explorer_private_immutable'; end if;
  if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger explorer_private_message_guard before update or delete on ai.ai_interaction_message
for each row execute function ai.solmind_private_message_guard_v3();

-- The original narrow mutation body remains historical/internal. This exact
-- successor closes the read-to-mutate adult-stop race under the SAME actor
-- owner/state locks as observation and settlement; client preflight is no gate.
create function public.solmind_mutate_explorer_conversation_v3(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_expected_revision integer,p_kind text,p_command_fingerprint text,p_source_message_id uuid default null,p_item_id uuid default null,
  p_waypoint_id uuid default null,p_label text default null,p_destination text default null,
  p_meaning text default null,p_arrival_signal text default null,p_evidence text default null
) returns table(outcome text,conversation_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; policy jsonb; st ai.explorer_conversation_state%rowtype;
  op ai.explorer_conversation_operation%rowtype; h text;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_conversation_id is null or p_operation_id is null or p_expected_revision is null or p_expected_revision<0
    or p_kind is null or p_kind not in ('add_compass','confirm_priority','set_attention','confirm_waypoint','confirm_reached')
    or p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$'
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id
    then raise exception 'solmind_explorer_private_denied'; end if;
  h:=upper(encode(extensions.digest(convert_to(jsonb_build_array(p_user_session_id,p_conversation_id,p_expected_revision,
    p_kind,p_source_message_id,p_item_id,p_waypoint_id,p_label,p_destination,p_meaning,p_arrival_signal,p_evidence,p_command_fingerprint)::text,'UTF8'),'sha256'),'hex'));
  select x.* into op from ai.explorer_conversation_operation x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id for update;
  if found then
    if op.request_fingerprint is distinct from h or op.command_fingerprint is distinct from p_command_fingerprint
      or op.conversation_id is distinct from p_conversation_id or op.kind is distinct from p_kind
      or op.application_session_id is distinct from p_user_session_id or op.status is distinct from 'completed'
      then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp()
      then raise exception 'solmind_explorer_private_denied'; end if;
    return query select 'exact_replay'::text,ai.solmind_conversation_state_json(p_conversation_id); return;
  end if;
  policy:=ai.solmind_private_policy_v3(p_conversation_id);
  if policy->'known' is distinct from 'true'::jsonb or st.restricted_level is not null or st.adult_reflection_stopped
    then raise exception 'solmind_explorer_private_denied'; end if;
  -- Same transaction and retained state/owner locks. The internal old body still
  -- validates every deliberate field/source/limit/revision/current authority.
  return query select * from public.solmind_mutate_explorer_conversation(
    p_actor_user_account_id,p_user_session_id,p_conversation_id,p_operation_id,p_expected_revision,p_kind,p_command_fingerprint,
    p_source_message_id,p_item_id,p_waypoint_id,p_label,p_destination,p_meaning,p_arrival_signal,p_evidence);
end $$;

-- No legacy reflective new-write service bypass. Existing historical records
-- remain readable/replayable through v3; owner-only old tests are not authority.
do $acl$
declare f record;
begin
  for f in select p.oid::regprocedure as signature,n.nspname as schema_name,p.proname
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='ai' and (p.proname like 'solmind_private_%_v3' or p.proname in
      ('solmind_raise_private_policy_v3','solmind_store_private_observation_v3','solmind_conversation_snapshot_immutable')))
      or (n.nspname='public' and p.proname in ('solmind_read_explorer_conversation_v3',
        'solmind_ensure_explorer_conversation_v3','solmind_observe_explorer_conversation_fallback_v3',
        'solmind_prepare_explorer_conversation_turn_v3','solmind_settle_explorer_conversation_turn_v3',
        'solmind_mutate_explorer_conversation_v3','solmind_mutate_explorer_conversation',
        'solmind_prepare_explorer_conversation_turn','solmind_prepare_governed_explorer_conversation_turn',
        'solmind_complete_explorer_conversation_turn','solmind_prepare_virtual_guide_predispatch'))
  loop
    execute format('alter function %s owner to postgres',f.signature);
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
    if f.schema_name='public' and f.proname like '%_v3' then
      execute format('grant execute on function %s to service_role',f.signature); end if;
  end loop;
end $acl$;
comment on table ai.explorer_safety_evidence is
  'Private minimum actual numerical1-4 evidence; no text, responder or routine human read. Manual sensitive-content retention, no cascade. Owner bypass outside protection.';
comment on column ai.explorer_conversation_operation.fallback_observation_fingerprint is
  'Protected exact prepared fallback input binding only; never a detector payload, audit metadata, browser value or operational approval.';
comment on column ai.explorer_conversation_state.safety_contract_version is
  'Nullable legacy UNKNOWN with no repair/backfill; only genuinely new first-send containers initialize clear coherent policy.';
commit;
