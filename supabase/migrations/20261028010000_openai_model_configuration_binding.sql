-- SolMind MVP0 shared server-configured OpenAI model binding.
-- Model selection is trusted server configuration, never a browser selector or
-- provider/spend grant. The separately approved private grant remains a veto.
-- Preserve old rows and owner-only old signatures; only new mandatory-model
-- preparation overloads are service-role capabilities. No provider call, user,
-- settings table/UI/writer, backfill, policy or direct-table grant is created.
begin;

create function ai.solmind_openai_model_name_valid(p_model_name text)
returns boolean language sql immutable strict set search_path='' as $$
  select p_model_name collate "C" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$'
    and p_model_name collate "C" !~ '[^A-Za-z0-9._:-]'
$$;
alter function ai.solmind_openai_model_name_valid(text) owner to postgres;
revoke all on function ai.solmind_openai_model_name_valid(text) from public,anon,authenticated,service_role;

alter table ai.explorer_conversation_operation
  add column model_name text null,
  add constraint explorer_conversation_operation_model_name_check
    check(model_name is null or ai.solmind_openai_model_name_valid(model_name));
comment on column ai.explorer_conversation_operation.model_name is
  'Immutable server-selected request model for new turns; NULL preserves the historical Luna operation format without backfill. Current configuration is never used to relabel or settle this captured operation.';

alter table methodology.screen_attempt
  drop constraint screen_attempt_model_name_check,
  add constraint screen_attempt_model_name_valid_check
    check(ai.solmind_openai_model_name_valid(model_name));

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
  p_expected_safety_version bigint,p_fallback_level smallint,p_fallback_minor_indicated boolean,p_model_name text
) returns table(outcome text,conversation_state jsonb,dispatch_permitted boolean,policy_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; e jsonb; st ai.explorer_conversation_state%rowtype; old_op ai.explorer_conversation_operation%rowtype;
  h text; h_legacy text; ids uuid[]; mode text; ctx json; inspected record; n integer; ts timestamptz;
  v_contract constant text:='virtual-guide-predispatch-evidence.v3';
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_user_session_id is null or p_conversation_id is null or p_operation_id is null or p_message_id is null
    or p_snapshot_id is null or p_invocation_id is null or p_logical_operation_id is null
    or p_expected_revision is null or p_expected_revision<0 or p_expected_safety_version is null or p_expected_safety_version<0
    or p_protocol_version is distinct from 'explorer-safety-reply.v1'
    or p_request_mode is null or p_request_mode not in ('classification_and_reply','classification_only')
    or p_fallback_level is null or p_fallback_level not between 0 and 4 or p_fallback_minor_indicated is null
    or p_model_name is null or not ai.solmind_openai_model_name_valid(p_model_name)
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
  h_legacy:=methodology.hash_json(jsonb_build_array(p_actor_user_account_id,p_user_session_id,p_conversation_id,
    p_operation_id,p_expected_revision,p_message_id,p_snapshot_id,p_invocation_id,p_body,p_context_fingerprint_sha256,ids,
    p_authorization_version,p_intake_response_set_id,p_methodology_context_pack_version_id,p_prompt_version,p_policy_version,
    p_behavior_version,p_crisis_version,p_role_version,p_instruction_version,p_command_fingerprint,p_logical_operation_id,
    p_methodology_context_pack_id,p_methodology_content_sha256,p_methodology_authorization_version,p_protocol_version,
    p_request_mode,p_configuration_fingerprint,p_fallback_policy_version,p_model_policy_version,p_trusted_response_version,
    p_resource_policy_version,p_expected_safety_version,p_fallback_level,p_fallback_minor_indicated));
  h:=methodology.hash_json(jsonb_build_array('explorer-model-binding.v1',h_legacy,p_model_name));
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id
    then raise exception 'solmind_explorer_private_denied'; end if;
  select x.* into old_op from ai.explorer_conversation_operation x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id for update;
  if found then
    if old_op.kind is distinct from 'send' or old_op.conversation_id is distinct from p_conversation_id
      or old_op.application_session_id is distinct from p_user_session_id
      or (old_op.model_name is not null and old_op.model_name is distinct from p_model_name)
      or (old_op.model_name is null and p_model_name is distinct from 'gpt-5.6-luna')
      or old_op.request_fingerprint is distinct from (case when old_op.model_name is null then h_legacy else h end)
      or old_op.command_fingerprint is distinct from p_command_fingerprint
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
    values(p_invocation_id,p_conversation_id,'openai',p_model_name,p_prompt_version,p_logical_operation_id,p_snapshot_id,v_contract,ts);
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
    conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,message_id,snapshot_id,invocation_id,
    logical_operation_id,safety_protocol_version,safety_request_mode,configuration_fingerprint,fallback_observation_fingerprint,
    fallback_policy_version,model_policy_version,trusted_response_version,resource_policy_version,model_name)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,'send',h,p_command_fingerprint,
      p_expected_revision,'started',p_message_id,p_snapshot_id,p_invocation_id,p_logical_operation_id,
      p_protocol_version,p_request_mode,p_configuration_fingerprint,
      methodology.hash_json(jsonb_build_array('explorer-fallback-observation.v1',p_user_session_id,p_conversation_id,
        p_logical_operation_id,p_command_fingerprint,p_configuration_fingerprint,p_fallback_policy_version,
        p_model_policy_version,p_fallback_level,p_fallback_minor_indicated)),p_fallback_policy_version,
      p_model_policy_version,p_trusted_response_version,p_resource_policy_version,p_model_name);
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
        'model_name',p_model_name,'operation_id',p_logical_operation_id::text,'provider_name','openai',
        'request_status','started','role_context','explorer','session_id',p_conversation_id::text));
  update ai.explorer_conversation_state set revision=revision+1,pending_operation_id=p_operation_id
    where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp()
    then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id),true,
    ai.solmind_private_policy_v3(p_conversation_id);
end $$;

create or replace function public.solmind_settle_explorer_conversation_turn_v3(
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
      and inv.provider_name='openai' and inv.model_name=coalesce(op.model_name,'gpt-5.6-luna') and inv.safety_result='{}'::jsonb
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

create function public.solmind_prepare_methodology_screen(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_operation_id uuid,
  p_methodology_context_pack_id uuid,p_methodology_context_pack_version_id uuid,p_screen_invocation_id uuid,
  p_content_sha256 text,p_policy_version text,p_policy_manifest_sha256 text,p_request_sha256 text,p_model_name text
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
    or p_model_name is null or not ai.solmind_openai_model_name_valid(p_model_name)
  then raise exception 'solmind_methodology_invalid_input'; end if;
  h:=methodology.hash_json(jsonb_build_array('screen_start_v1',p_user_session_id,p_methodology_context_pack_id,
    p_methodology_context_pack_version_id,p_screen_invocation_id,p_content_sha256,'methodology_safety_screen',
    'methodology-safety-screen.v1',p_policy_version,p_policy_manifest_sha256,p_request_sha256,'openai',p_model_name));
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
    values(p_screen_invocation_id,'openai',p_model_name,'methodology-safety-screen.v1','started',ts,
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
      p_policy_manifest_sha256,p_request_sha256,'openai',p_model_name,ts,eid);
  perform methodology.lock_human(p_actor_user_account_id,p_user_session_id,'admin');
  return query select 'ok'::text,p_screen_invocation_id,true;
exception when others then
  if SQLSTATE='P0001' and SQLERRM like 'solmind_methodology_%' then raise; end if;
  raise exception 'solmind_methodology_unavailable';
end $$;

-- Retire the old preparation API capabilities without deleting historical definitions.
revoke all on function public.solmind_prepare_explorer_conversation_turn_v3(uuid,uuid,uuid,uuid,integer,uuid,uuid,uuid,text,text,text,uuid[],text,uuid,uuid,text,text,text,text,text,text,text,uuid,uuid,text,text,text,text,text,text,text,text,text,bigint,smallint,boolean) from public,anon,authenticated,service_role;
alter function public.solmind_prepare_explorer_conversation_turn_v3(uuid,uuid,uuid,uuid,integer,uuid,uuid,uuid,text,text,text,uuid[],text,uuid,uuid,text,text,text,text,text,text,text,uuid,uuid,text,text,text,text,text,text,text,text,text,bigint,smallint,boolean,text) owner to postgres;
revoke all on function public.solmind_prepare_explorer_conversation_turn_v3(uuid,uuid,uuid,uuid,integer,uuid,uuid,uuid,text,text,text,uuid[],text,uuid,uuid,text,text,text,text,text,text,text,uuid,uuid,text,text,text,text,text,text,text,text,text,bigint,smallint,boolean,text) from public,anon,authenticated,service_role;
grant execute on function public.solmind_prepare_explorer_conversation_turn_v3(uuid,uuid,uuid,uuid,integer,uuid,uuid,uuid,text,text,text,uuid[],text,uuid,uuid,text,text,text,text,text,text,text,uuid,uuid,text,text,text,text,text,text,text,text,text,bigint,smallint,boolean,text) to service_role;
revoke all on function public.solmind_prepare_methodology_screen(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated,service_role;
alter function public.solmind_prepare_methodology_screen(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,text,text) owner to postgres;
revoke all on function public.solmind_prepare_methodology_screen(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.solmind_prepare_methodology_screen(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,text,text) to service_role;

commit;
