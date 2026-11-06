-- REV306, 2026-11-06: closed failed-reply reason; no new column or RLS change.
-- The final nullable argument preserves historical terminal fingerprints and callers.
-- New application settlements always provide a closed reason for an unusable reply.
-- Retain accepted safety observations, owner locks, exact replay, all proposal and
-- capacity helpers, privileges and the existing 2s lock / 5s statement settings.
begin;

-- Legacy invocations retain the original nonblank failed-only allowance.
-- A v3 turn without a saved reply can also record a closed canceled reason or
-- an unusable reply after its classification was accepted as completed.
alter table ai.ai_model_invocation drop constraint ai_model_invocation_error_summary_check;
alter table ai.ai_model_invocation add constraint ai_model_invocation_error_summary_check check (
  error_summary is null
  or (length(trim(error_summary))>0 and request_status='failed')
  or (dispatch_contract_version is not distinct from 'virtual-guide-predispatch-evidence.v3'
    and ai_interaction_message_id is null
    and ((request_status='completed' and error_summary in ('invalid_response','trusted_render_unavailable'))
      or (request_status='canceled' and error_summary in
        ('deadline','transport_failed','invalid_response','delivery_canceled_before_dispatch','dispatch_not_admitted'))))
);

drop function public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb);
create function public.solmind_settle_explorer_conversation_turn_v4(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_status text,p_reply_message_id uuid,p_reply_kind text,p_reply_body text,
  p_model_level smallint,p_model_minor_indicated boolean,p_protocol_version text,p_request_mode text,
  p_configuration_fingerprint text,p_fallback_policy_version text,p_model_policy_version text,
  p_trusted_response_version text,p_resource_policy_version text,p_fallback_level smallint,
  p_fallback_minor_indicated boolean,p_delivery_interested boolean,p_attention_item_id uuid,p_choices jsonb,p_compass_suggestions jsonb default null,p_compass_responses jsonb default null,p_waypoint_suggestion jsonb default null,p_waypoint_response jsonb default null,
  p_failure_reason text default null
) returns table(outcome text,conversation_state jsonb,policy_state jsonb,saved_reply boolean)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare st ai.explorer_conversation_state%rowtype; op ai.explorer_conversation_operation%rowtype;
  a jsonb; intent text; h text; observed_fallback text; ts timestamptz; n integer;
  may_return boolean:=false; may_save boolean:=false; saved_id uuid; saved_body text; saved_kind text:='none';
  saved_choices jsonb; followed_id uuid; followed_operation_id uuid; followed_label text; follow_hash text; follow_bytes bytea; followed_formation text; suggestion jsonb; suggestion_label text; suggestion_id uuid; suggestion_index integer:=0; item_count integer;
  response jsonb; response_id uuid; response_name text; response_hash text; response_operation_id uuid;
  new_draft_id uuid;
  previous_reply_id uuid; response_ids uuid[]:=array[]::uuid[]; refined_ids uuid[]:=array[]::uuid[];
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_user_session_id is null or p_conversation_id is null or p_operation_id is null
    or p_status is null or p_status not in ('completed','failed','canceled')
    or p_protocol_version is distinct from 'explorer-safety-reply.v2'
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
    or (p_failure_reason is not null and (p_failure_reason not in
      ('deadline','transport_failed','invalid_response','delivery_canceled_before_dispatch','dispatch_not_admitted','trusted_render_unavailable')
      or p_reply_kind<>'none'
      or (p_model_level is not null and p_failure_reason not in ('invalid_response','trusted_render_unavailable'))
      or (p_status='canceled' and p_failure_reason='trusted_render_unavailable')))
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
    p_delivery_interested,p_attention_item_id,p_choices)
    ||case when p_compass_responses is null then
      case when p_compass_suggestions is null then '[]'::jsonb else jsonb_build_array(p_compass_suggestions) end
      else jsonb_build_array('explorer-typed-compass-responses.v1',p_compass_suggestions,p_compass_responses) end
    ||case when p_waypoint_suggestion is null then '[]'::jsonb
      else jsonb_build_array('explorer-waypoint-suggestion.v1',p_waypoint_suggestion) end
    ||case when p_waypoint_response is null then '[]'::jsonb
      else jsonb_build_array('explorer-typed-waypoint-response.v1',p_waypoint_response) end
    ||case when p_failure_reason is null then '[]'::jsonb
      else jsonb_build_array('explorer-failed-reply-reason.v1',p_failure_reason) end);
  if op.status<>'started' then
    if op.reply_message_id is not null then
      select m.content_text,m.explorer_reply_choices into saved_body,saved_choices from ai.ai_interaction_message m
        where m.ai_interaction_message_id=op.reply_message_id and m.ai_interaction_session_id=p_conversation_id;
      if not found then raise exception 'solmind_explorer_private_operation_conflict'; end if;
      saved_kind:=p_reply_kind;
    end if;
    select coalesce(op.followed_attention_item_id,o.compass_route_item_id) into followed_id from (select 1) dummy left join ai.explorer_conversation_operation o on true
      where o.actor_user_account_id=p_actor_user_account_id and o.origin_operation_id=p_operation_id;
    followed_id:=coalesce(followed_id,op.followed_attention_item_id);
    h:=methodology.hash_json(jsonb_build_array(intent,op.reply_message_id,saved_kind,saved_body,saved_choices,followed_id));
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
    if p_reply_kind='ordinary' and p_request_mode='classification_and_reply' and st.restricted_level is null
      and not st.adult_reflection_stopped then
      if greatest(p_fallback_level,coalesce(p_model_level,0))<2
        and ai.solmind_explorer_reply_choices_valid_v2(p_choices) then saved_choices:=p_choices; end if;
      -- Invalid, foreign or combined-away targets are absent, never a failed reply.
      -- A current point need not have a position in the saved arrangement.
      if p_attention_item_id is not null and p_attention_item_id is distinct from st.attention_id then
        select c.item_id,c.label,c.formation_status into followed_id,followed_label,followed_formation from ai.explorer_conversation_compass_item c
          where c.conversation_id=p_conversation_id and c.item_id=p_attention_item_id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected'
            and (c.formation_status is distinct from 'proposed' or greatest(p_fallback_level,coalesce(p_model_level,0))<2);
      end if;
    end if;
    insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
      sender_type,ai_role,content_text,created_at,explorer_reply_choices)
      values(saved_id,p_conversation_id,n+1,'ai','solmind_virtual_guide',saved_body,ts,saved_choices);
  end if;
  -- Observation and turn are different facts: an accepted complete
  -- classification remains a completed invocation even if prose was invalid,
  -- delivery canceled, or the operation intentionally records failed/canceled.
  update ai.ai_model_invocation set request_status=case when p_model_level is not null then 'completed' else p_status end,
    completed_at=ts,ai_interaction_message_id=saved_id,
    error_summary=case when p_failure_reason is not null then p_failure_reason
      when p_model_level is null and p_status='failed' then 'provider_unavailable' else null end
    where ai_model_invocation_id=op.invocation_id;
  h:=methodology.hash_json(jsonb_build_array(intent,saved_id,saved_kind,saved_body,saved_choices,followed_id));
  update ai.explorer_conversation_operation set status=p_status,completed_at=ts,terminal_fingerprint=h,reply_message_id=saved_id,followed_attention_item_id=followed_id
    where actor_user_account_id=p_actor_user_account_id and operation_id=p_operation_id;
  -- Exclusion comes from raw valid rewording proposals, before any application
  -- gate or mutation. The application also retains this exclusion before its
  -- pacing gate suppresses both the rewording and a conflicting typed answer.
  if jsonb_typeof(p_compass_suggestions)='array' then
    for suggestion in select p_compass_suggestions->g.i
      from generate_series(0,least(2,jsonb_array_length(p_compass_suggestions)-1)) as g(i) loop
      if jsonb_typeof(suggestion) is distinct from 'object' then continue; end if;
      if not suggestion ?& array['label','pointId']
        or exists(select 1 from jsonb_object_keys(suggestion) k where k not in ('label','pointId'))
        or jsonb_typeof(suggestion->'label') is distinct from 'string'
        or jsonb_typeof(suggestion->'pointId') is distinct from 'string' then continue; end if;
      if not ai.solmind_compass_suggestion_label_valid(suggestion->>'label')
        or length(suggestion->>'pointId')<>36
        or (suggestion->>'pointId') collate "C" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then continue; end if;
      refined_ids:=array_append(refined_ids,(suggestion->>'pointId')::uuid);
    end loop;
  end if;
  -- First three submitted positions only. Each malformed suggestion is absent
  -- independently; it never discards the valid saved reply or its siblings.
  if saved_id is not null and saved_kind='ordinary' and p_request_mode='classification_and_reply'
    and p_delivery_interested and st.restricted_level is null and not st.adult_reflection_stopped
    and greatest(p_fallback_level,coalesce(p_model_level,0))<2 and jsonb_typeof(p_compass_suggestions)='array' then
    for suggestion in select p_compass_suggestions->g.i from generate_series(0,least(2,jsonb_array_length(p_compass_suggestions)-1)) as g(i) loop
      suggestion_index:=suggestion_index+1;
      if jsonb_typeof(suggestion) is distinct from 'object' then continue; end if;
      if not suggestion ? 'label' or exists(select 1 from jsonb_object_keys(suggestion) k where k not in ('label','pointId'))
        or jsonb_typeof(suggestion->'label') is distinct from 'string' then continue; end if;
      suggestion_label:=suggestion->>'label';
      if not ai.solmind_compass_suggestion_label_valid(suggestion_label) then continue; end if;
      if suggestion ? 'pointId' then
        if jsonb_typeof(suggestion->'pointId') is distinct from 'string'
          or length(suggestion->>'pointId')<>36
          or (suggestion->>'pointId') collate "C" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then continue; end if;
        suggestion_id:=(suggestion->>'pointId')::uuid;
        update ai.explorer_conversation_compass_item set label=suggestion_label,wording_message_id=saved_id
          where conversation_id=p_conversation_id and item_id=suggestion_id and formation_status='proposed' and merged_into_item_id is null;
      else
        select count(*) into item_count from ai.explorer_conversation_compass_item c
          where c.conversation_id=p_conversation_id and c.formation_status is distinct from 'rejected';
        if item_count>=24 then continue; end if;
        follow_bytes:=substring(extensions.digest(convert_to('explorer-compass-suggestion.v1|'||p_actor_user_account_id::text||'|'||p_operation_id::text||'|'||suggestion_index::text,'UTF8'),'sha256') from 1 for 16);
        follow_bytes:=set_byte(set_byte(follow_bytes,6,(get_byte(follow_bytes,6)&15)|80),8,(get_byte(follow_bytes,8)&63)|128);
        suggestion_id:=encode(follow_bytes,'hex')::uuid;
        if exists(select 1 from ai.explorer_conversation_compass_item where item_id=suggestion_id) then continue; end if;
        insert into ai.explorer_conversation_compass_item(item_id,conversation_id,source_message_id,label,display_order,formation_status,wording_message_id)
          values(suggestion_id,p_conversation_id,saved_id,suggestion_label,
            (select coalesce(max(c.display_order),0)+1 from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id),
            'proposed',saved_id);
      end if;
    end loop;
  end if;
  -- One complete Waypoint proposal is independent of Compass entries and never
  -- invalidates saved prose. Existing proposed wording is refined in place.
  if saved_id is not null and saved_kind='ordinary' and p_request_mode='classification_and_reply'
    and p_delivery_interested and st.restricted_level is null and not st.adult_reflection_stopped
    and greatest(p_fallback_level,coalesce(p_model_level,0))<2 and jsonb_typeof(p_waypoint_suggestion)='object' then
    if p_waypoint_suggestion ?& array['title','destination','whyItMatters','arrivalSignal']
      and not exists(select 1 from jsonb_object_keys(p_waypoint_suggestion) k
        where k not in ('title','destination','whyItMatters','arrivalSignal'))
      and jsonb_typeof(p_waypoint_suggestion->'title')='string'
      and jsonb_typeof(p_waypoint_suggestion->'destination')='string'
      and jsonb_typeof(p_waypoint_suggestion->'whyItMatters')='string'
      and jsonb_typeof(p_waypoint_suggestion->'arrivalSignal')='string'
      and ai.solmind_waypoint_draft_text_valid(p_waypoint_suggestion->>'title')
      and ai.solmind_waypoint_draft_text_valid(p_waypoint_suggestion->>'destination')
      and ai.solmind_waypoint_draft_text_valid(p_waypoint_suggestion->>'whyItMatters')
      and ai.solmind_waypoint_draft_text_valid(p_waypoint_suggestion->>'arrivalSignal') then
      select d.waypoint_draft_id into new_draft_id from content.waypoint_draft d
        where d.source_ai_interaction_session_id=p_conversation_id and d.draft_status='proposed' for update;
      if found then
        update content.waypoint_draft d set title=p_waypoint_suggestion->>'title',
          destination=p_waypoint_suggestion->>'destination',why_it_matters=p_waypoint_suggestion->>'whyItMatters',
          arrival_signal=p_waypoint_suggestion->>'arrivalSignal',suggestion_message_id=saved_id
          where d.waypoint_draft_id=new_draft_id;
      else
        follow_bytes:=substring(extensions.digest(convert_to('explorer-waypoint-suggestion.v1|'||p_actor_user_account_id::text
          ||'|'||p_operation_id::text,'UTF8'),'sha256') from 1 for 16);
        follow_bytes:=set_byte(set_byte(follow_bytes,6,(get_byte(follow_bytes,6)&15)|80),8,(get_byte(follow_bytes,8)&63)|128);
        new_draft_id:=encode(follow_bytes,'hex')::uuid;
        insert into content.waypoint_draft(waypoint_draft_id,guide_explorer_relationship_id,source_ai_interaction_session_id,
          title,destination,why_it_matters,arrival_signal,source_message_id,suggestion_message_id)
          select new_draft_id,s.guide_explorer_relationship_id,p_conversation_id,p_waypoint_suggestion->>'title',
            p_waypoint_suggestion->>'destination',p_waypoint_suggestion->>'whyItMatters',
            p_waypoint_suggestion->>'arrivalSignal',saved_id,saved_id
          from ai.ai_interaction_session s where s.ai_interaction_session_id=p_conversation_id;
      end if;
    end if;
  end if;
  if followed_id is not null then
    follow_hash:=methodology.hash_json(jsonb_build_array('explorer-follow-attention.v1',p_actor_user_account_id,
      p_user_session_id,p_conversation_id,p_operation_id,followed_id));
    follow_bytes:=substring(extensions.digest(convert_to('explorer-follow-attention-operation.v1|'||p_actor_user_account_id::text||'|'||p_operation_id::text,'UTF8'),'sha256') from 1 for 16);
    follow_bytes:=set_byte(set_byte(follow_bytes,6,(get_byte(follow_bytes,6)&15)|80),8,(get_byte(follow_bytes,8)&63)|128);
    followed_operation_id:=encode(follow_bytes,'hex')::uuid;
    if followed_formation is distinct from 'proposed' then
    insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
      conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,
      compass_route_kind,compass_route_item_id,compass_route_label,origin_operation_id)
      values(p_actor_user_account_id,followed_operation_id,p_user_session_id,p_conversation_id,'follow_attention',
        follow_hash,follow_hash,st.revision,'completed',ts,'attention_changed',followed_id,followed_label,p_operation_id);
    end if;
    update ai.explorer_conversation_state set attention_id=followed_id where conversation_id=p_conversation_id;
  end if;
  update ai.explorer_conversation_state set revision=revision+1,pending_operation_id=null where conversation_id=p_conversation_id;
  -- Locate the saved reply that this Send's Explorer message answers. Never
  -- use the newly saved reply as the source of a typed answer.
  if saved_id is not null and saved_kind='ordinary' and p_request_mode='classification_and_reply'
    and p_delivery_interested and st.restricted_level is null and not st.adult_reflection_stopped
    and greatest(p_fallback_level,coalesce(p_model_level,0))<2 and jsonb_typeof(p_compass_responses)='array' then
    select previous.ai_interaction_message_id into previous_reply_id
      from ai.ai_interaction_message previous
      join ai.ai_interaction_message current_message on current_message.ai_interaction_message_id=op.message_id
        and current_message.ai_interaction_session_id=p_conversation_id
      where previous.ai_interaction_session_id=p_conversation_id and previous.sender_type='ai'
        and previous.ai_role='solmind_virtual_guide' and previous.sequence_number<current_message.sequence_number
      order by previous.sequence_number desc limit 1;
    for response in select p_compass_responses->g.i
      from generate_series(0,least(2,jsonb_array_length(p_compass_responses)-1)) as g(i) loop
      if jsonb_typeof(response) is distinct from 'object' then continue; end if;
      if not response ? 'pointId' or not response ? 'response'
        or exists(select 1 from jsonb_object_keys(response) k where k not in ('pointId','response'))
        or jsonb_typeof(response->'pointId') is distinct from 'string'
        or jsonb_typeof(response->'response') is distinct from 'string'
        or length(response->>'pointId')<>36
        or (response->>'pointId') collate "C" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or response->>'response' not in ('right','close','not_it') then continue; end if;
      response_id:=(response->>'pointId')::uuid; response_name:=response->>'response';
      if response_id=any(response_ids) or response_id=any(refined_ids) then continue; end if;
      response_ids:=array_append(response_ids,response_id);
      if not exists(select 1 from ai.explorer_conversation_compass_item c
        where c.conversation_id=p_conversation_id and c.item_id=response_id
          and c.formation_status='proposed' and c.merged_into_item_id is null
          and c.wording_message_id=previous_reply_id)
        or exists(select 1 from ai.explorer_conversation_operation r
          where r.actor_user_account_id=p_actor_user_account_id and r.conversation_id=p_conversation_id
            and r.kind='respond_compass_suggestion' and r.compass_suggestion_item_id=response_id
            and r.completed_at>=(select m.created_at from ai.ai_interaction_message m
              where m.ai_interaction_message_id=previous_reply_id)) then continue; end if;
      if not ai.solmind_apply_compass_suggestion_response(p_actor_user_account_id,p_conversation_id,response_id,response_name)
        then continue; end if;
      response_hash:=methodology.hash_json(jsonb_build_array('explorer-typed-compass-response.v1',p_actor_user_account_id,
        p_user_session_id,p_conversation_id,p_operation_id,response_id,response_name));
      follow_bytes:=substring(extensions.digest(convert_to('explorer-typed-compass-response.v1|'||p_actor_user_account_id::text
        ||'|'||p_operation_id::text||'|'||response_id::text,'UTF8'),'sha256') from 1 for 16);
      follow_bytes:=set_byte(set_byte(follow_bytes,6,(get_byte(follow_bytes,6)&15)|80),8,(get_byte(follow_bytes,8)&63)|128);
      response_operation_id:=encode(follow_bytes,'hex')::uuid;
      insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,
        kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,
        compass_suggestion_item_id,compass_suggestion_response,compass_suggestion_typed)
        values(p_actor_user_account_id,response_operation_id,p_user_session_id,p_conversation_id,'respond_compass_suggestion',
          response_hash,response_hash,st.revision,'completed',ts,response_id,response_name,true);
    end loop;
  end if;

  -- A valid same-reply rewording wins. The current draft must still name the
  -- saved reply immediately preceding the Explorer message answered by this Send.
  if saved_id is not null and saved_kind='ordinary' and p_request_mode='classification_and_reply'
    and p_delivery_interested and st.restricted_level is null and not st.adult_reflection_stopped
    and greatest(p_fallback_level,coalesce(p_model_level,0))<2 and jsonb_typeof(p_waypoint_response)='object' then
    if p_waypoint_response ?& array['draftId','response']
      and not exists(select 1 from jsonb_object_keys(p_waypoint_response) k where k not in ('draftId','response'))
      and jsonb_typeof(p_waypoint_response->'draftId')='string'
      and jsonb_typeof(p_waypoint_response->'response')='string'
      and length(p_waypoint_response->>'draftId')=36
      and (p_waypoint_response->>'draftId') collate "C" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and p_waypoint_response->>'response' in ('right','close','not_it') then
      response_id:=(p_waypoint_response->>'draftId')::uuid; response_name:=p_waypoint_response->>'response';
      select previous.ai_interaction_message_id into previous_reply_id
        from ai.ai_interaction_message previous
        join ai.ai_interaction_message current_message on current_message.ai_interaction_message_id=op.message_id
          and current_message.ai_interaction_session_id=p_conversation_id
        where previous.ai_interaction_session_id=p_conversation_id and previous.sender_type='ai'
          and previous.ai_role='solmind_virtual_guide' and previous.sequence_number<current_message.sequence_number
        order by previous.sequence_number desc limit 1;
      if response_id is distinct from new_draft_id and exists(select 1 from content.waypoint_draft d
        where d.source_ai_interaction_session_id=p_conversation_id and d.waypoint_draft_id=response_id
          and d.draft_status='proposed' and d.suggestion_message_id=previous_reply_id)
        and not exists(select 1 from ai.explorer_conversation_operation r
          where r.actor_user_account_id=p_actor_user_account_id and r.conversation_id=p_conversation_id
            and r.kind='respond_waypoint_draft' and r.waypoint_suggestion_draft_id=response_id
            and r.completed_at>=(select m.created_at from ai.ai_interaction_message m
              where m.ai_interaction_message_id=previous_reply_id)) then
        response_hash:=methodology.hash_json(jsonb_build_array('explorer-typed-waypoint-response.v1',p_actor_user_account_id,
          p_user_session_id,p_conversation_id,p_operation_id,response_id,response_name));
        follow_bytes:=substring(extensions.digest(convert_to('explorer-typed-waypoint-response.v1|'||p_actor_user_account_id::text
          ||'|'||p_operation_id::text||'|'||response_id::text,'UTF8'),'sha256') from 1 for 16);
        follow_bytes:=set_byte(set_byte(follow_bytes,6,(get_byte(follow_bytes,6)&15)|80),8,(get_byte(follow_bytes,8)&63)|128);
        response_operation_id:=encode(follow_bytes,'hex')::uuid;
        -- This helper reads the post-Send revision for the receipt and guard.
        -- At either bound it returns false without inserting a receipt.
        perform ai.solmind_apply_waypoint_draft_response(p_actor_user_account_id,p_user_session_id,p_conversation_id,
          response_operation_id,response_hash,response_hash,response_id,response_name,ts,true);
      end if;
    end if;
  end if;
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
alter function public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text) owner to postgres;
revoke all on function public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text) to service_role;

-- Server-only exact replay evidence distinguishes a recorded unusable reply
-- from a pending operation or intentionally withheld prose. It grants no Send
-- authority and is never part of the browser's conversation state or context.
create or replace function public.solmind_read_explorer_conversation_v3(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid default null,
  p_operation_id uuid default null,p_command_fingerprint text default null
) returns table(outcome text,conversation_state jsonb,authority_context jsonb,policy_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare v_id uuid; a jsonb; op ai.explorer_conversation_operation%rowtype; ids uuid[]; replay boolean:=false; forming_move jsonb;
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
  forming_move:=ai.solmind_forming_attention_move_v1(v_id);
  if forming_move is not null then a:=a||jsonb_build_object('formingAttentionMove',forming_move); end if;
  if replay and op.kind='send' and op.status in ('completed','failed','canceled') and op.reply_message_id is null
    and exists(select 1 from ai.ai_model_invocation inv where inv.ai_model_invocation_id=op.invocation_id
      and inv.request_status in ('completed','failed','canceled') and inv.ai_interaction_message_id is null
      and (inv.error_summary in ('deadline','transport_failed','invalid_response',
        'delivery_canceled_before_dispatch','dispatch_not_admitted','trusted_render_unavailable')
        or (op.status='failed' and inv.request_status='failed' and inv.error_summary='provider_unavailable'))) then
    a:=a||jsonb_build_object('replayFailedReply',true);
  end if;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp()
    then raise exception 'solmind_explorer_private_denied'; end if;
  return query select case when replay then 'exact_replay' else 'ok' end,
    ai.solmind_conversation_state_json(v_id)||jsonb_build_object('waypointCapacity',
      ai.solmind_waypoint_capacity_v1(p_actor_user_account_id,v_id)),a,ai.solmind_private_policy_v3(v_id);
end $$;
alter function public.solmind_read_explorer_conversation_v3(uuid,uuid,uuid,uuid,text) owner to postgres;
revoke all on function public.solmind_read_explorer_conversation_v3(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.solmind_read_explorer_conversation_v3(uuid,uuid,uuid,uuid,text) to service_role;

commit;
