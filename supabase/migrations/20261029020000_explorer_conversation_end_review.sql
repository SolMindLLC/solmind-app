-- SolMind bounded End Session and owned ended-conversation review.
-- Existing reflective writers stay active-only; no provider, new message,
-- fabricated Discovery container, reactivation, sharing or historical backfill.
begin;

alter table ai.explorer_conversation_operation
  add column ending_directions_text text null,
  add column ending_route_revision integer null,
  drop constraint explorer_conversation_operation_kind_check,
  add constraint explorer_conversation_operation_kind_check check (kind in ('send','add_compass','confirm_priority','set_attention',
    'confirm_waypoint','confirm_reached','confirm_compass_arrangement','end_conversation')),
  add constraint explorer_conversation_ending_shape_check check (
    (kind<>'end_conversation' and ending_directions_text is null and ending_route_revision is null)
    or (kind='end_conversation' and status='completed' and ending_directions_text is not null
      and ending_route_revision is not null and ending_route_revision=initial_revision
      and ai.solmind_conversation_text_valid(ending_directions_text,2048,false))
  );
create unique index explorer_conversation_one_ending_idx on ai.explorer_conversation_operation(conversation_id)
  where kind='end_conversation' and status='completed';
comment on column ai.explorer_conversation_operation.ending_directions_text is
  'Actual deterministic final direction facts, saved once; private, immutable, no model or clinical completion claim.';
comment on column ai.explorer_conversation_operation.ending_route_revision is
  'Pre-End revision through which the saved directions-taken text counts the existing immutable Route; no Route copy/backfill.';

create or replace function ai.solmind_private_operation_guard_v3() returns trigger
language plpgsql set search_path='' as $$
begin
  -- Route facts are insert-only. Legacy rows cannot be enriched into history.
  if old.compass_route_kind is not null or old.kind='end_conversation' then
    raise exception 'solmind_explorer_private_immutable';
  end if;
  if tg_op='UPDATE' and (new.compass_route_kind,new.compass_route_item_id,new.compass_route_label,new.compass_arrangement,new.ending_directions_text,new.ending_route_revision)
    is distinct from (old.compass_route_kind,old.compass_route_item_id,old.compass_route_label,old.compass_arrangement,old.ending_directions_text,old.ending_route_revision) then
    raise exception 'solmind_explorer_private_immutable';
  end if;
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

create or replace function ai.solmind_conversation_state_json(p_id uuid)
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
      'body',m.content_text,'createdAt',m.created_at) order by m.sequence_number)
      from ai.ai_interaction_message m where m.ai_interaction_session_id=p_id and m.sender_type in ('user','ai')),'[]'::jsonb),
    'compassItems',coalesce((select jsonb_agg(jsonb_build_object('id',c.item_id,'sourceMessageId',c.source_message_id,
      'label',c.label,'anchor',c.compass_anchor,'emphasis',c.relative_emphasis) order by c.display_order) from ai.explorer_conversation_compass_item c where c.conversation_id=p_id),'[]'::jsonb),
    'priorityId',s.priority_id,'attentionId',s.attention_id,
    'route',coalesce((select jsonb_agg(case when o.compass_route_kind='arrangement_confirmed' then
      jsonb_build_object('operationId',o.operation_id,'revision',o.initial_revision+1,'kind',o.compass_route_kind,
        'previousPriorityId',o.compass_arrangement->'previousPriorityId','priorityId',o.compass_arrangement->'priorityId',
        'items',o.compass_arrangement->'items','recordedAt',o.completed_at)
      else jsonb_build_object('operationId',o.operation_id,
        'revision',o.initial_revision+1,'kind',o.compass_route_kind,'compassItemId',o.compass_route_item_id,
        'label',o.compass_route_label,'recordedAt',o.completed_at) end order by o.initial_revision,o.operation_id)
      from ai.explorer_conversation_operation o where o.conversation_id=p_id and o.compass_route_kind is not null),'[]'::jsonb),
    'waypoints',coalesce((select jsonb_agg(jsonb_build_object('id',w.waypoint_id,'sourceMessageId',w.source_message_id,
      'destination',w.destination,'meaning',w.why_it_matters,'arrivalSignal',w.arrival_signal,
      'status',w.lifecycle_status,'reachedEvidence',w.reached_evidence,'reachedAt',w.reached_at) order by w.created_at,w.waypoint_id)
      from content.waypoint w where w.source_ai_interaction_session_id=p_id),'[]'::jsonb))
  from (select 1) anchor left join ai.explorer_conversation_state s on s.conversation_id=p_id
    left join ai.ai_interaction_session session_row on session_row.ai_interaction_session_id=s.conversation_id
$$;

-- Current global authority is reused, then exact ended ownership is checked.
-- Returns internal read facts only, never an AV3 proof or dispatch context.
create function ai.solmind_ended_conversation_authority_v1(p_actor uuid,p_app_session uuid,p_conversation uuid)
returns jsonb language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' as $$
declare a jsonb; s ai.ai_interaction_session%rowtype; st ai.explorer_conversation_state%rowtype;
begin
  a:=ai.solmind_private_owned_authority_v3(p_actor,p_app_session,null);
  if p_conversation is not null then
    select x.* into s from ai.ai_interaction_session x where x.ai_interaction_session_id=p_conversation for update;
    if not found or s.actor_user_account_id is distinct from p_actor or s.actor_role_context is distinct from 'explorer'
      or s.session_type is distinct from 'explorer_reflection' or s.session_status is distinct from 'ended'
      or s.explorer_profile_id is distinct from (a->>'explorerId')::uuid
      or s.guide_explorer_relationship_id is distinct from (a->>'relationshipId')::uuid
      or s.practice_id is distinct from (a->>'practiceId')::uuid
      or jsonb_typeof(s.metadata) is distinct from 'object' then raise exception 'solmind_explorer_conversation_denied'; end if;
    select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation for update;
    if not found or st.actor_user_account_id is distinct from p_actor then raise exception 'solmind_explorer_conversation_denied'; end if;
    if exists(select 1 from ai.ai_interaction_message m where m.ai_interaction_session_id=p_conversation and (
      (m.sender_type='user' and m.sender_user_account_id=p_actor and m.sender_role_context='explorer')
      or (m.sender_type='ai' and m.ai_role='solmind_virtual_guide' and m.sender_user_account_id is null)
    ) is not true) then raise exception 'solmind_explorer_conversation_denied'; end if;
  end if;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_conversation_denied'; end if;
  return jsonb_build_object('applicationSessionExpiresAt',a->'applicationSessionExpiresAt','explorerId',a->'explorerId',
    'relationshipId',a->'relationshipId','practiceId',a->'practiceId');
end $$;
alter function ai.solmind_ended_conversation_authority_v1(uuid,uuid,uuid) owner to postgres;
revoke all on function ai.solmind_ended_conversation_authority_v1(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function public.solmind_read_ended_explorer_conversations_v1(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid
) returns table(outcome text,ended_conversations jsonb,conversation_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; history jsonb;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  a:=ai.solmind_ended_conversation_authority_v1(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  select coalesce(jsonb_agg(jsonb_build_object('conversationId',s.ai_interaction_session_id,'endedAt',s.ended_at)
    order by s.ended_at desc nulls last,s.ai_interaction_session_id),'[]'::jsonb) into history
    from ai.ai_interaction_session s join ai.explorer_conversation_state st on st.conversation_id=s.ai_interaction_session_id
    where s.actor_user_account_id=p_actor_user_account_id and st.actor_user_account_id=p_actor_user_account_id
      and s.actor_role_context='explorer' and s.session_type='explorer_reflection' and s.session_status='ended'
      and s.explorer_profile_id=(a->>'explorerId')::uuid
      and s.guide_explorer_relationship_id=(a->>'relationshipId')::uuid and s.practice_id=(a->>'practiceId')::uuid
      and jsonb_typeof(s.metadata)='object';
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_conversation_denied'; end if;
  return query select 'ok'::text,history,
    case when p_conversation_id is null then null::jsonb else ai.solmind_conversation_state_json(p_conversation_id) end;
end $$;
alter function public.solmind_read_ended_explorer_conversations_v1(uuid,uuid,uuid) owner to postgres;
revoke all on function public.solmind_read_ended_explorer_conversations_v1(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.solmind_read_ended_explorer_conversations_v1(uuid,uuid,uuid) to service_role;

create function public.solmind_end_explorer_conversation_v1(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_expected_revision integer,p_command_fingerprint text
) returns table(outcome text,conversation_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; s ai.ai_interaction_session%rowtype; st ai.explorer_conversation_state%rowtype;
  op ai.explorer_conversation_operation%rowtype; h text; ts timestamptz; priority_label text; attention_label text;
  directions text; route_count bigint;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_conversation_id is null or p_operation_id is null or p_expected_revision is null or p_expected_revision<0
    or p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$' then raise exception 'solmind_explorer_private_invalid_input'; end if;
  select x.* into s from ai.ai_interaction_session x where x.ai_interaction_session_id=p_conversation_id for update;
  if not found or s.actor_user_account_id is distinct from p_actor_user_account_id or s.actor_role_context is distinct from 'explorer'
    or s.session_type is distinct from 'explorer_reflection' or s.session_status not in ('active','ended')
    then raise exception 'solmind_explorer_conversation_denied'; end if;
  if s.session_status='ended' then
    a:=ai.solmind_ended_conversation_authority_v1(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  else
    a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  end if;
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id then raise exception 'solmind_explorer_conversation_denied'; end if;
  h:=methodology.hash_json(jsonb_build_array('explorer-conversation-end.v1',p_user_session_id,p_conversation_id,
    p_expected_revision,p_command_fingerprint));
  select x.* into op from ai.explorer_conversation_operation x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id for update;
  if found then
    if op.kind is distinct from 'end_conversation' or op.request_fingerprint is distinct from h
      or op.command_fingerprint is distinct from p_command_fingerprint or op.application_session_id is distinct from p_user_session_id
      or op.conversation_id is distinct from p_conversation_id or op.status is distinct from 'completed'
      or s.session_status is distinct from 'ended' then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_conversation_denied'; end if;
    return query select 'exact_replay'::text,ai.solmind_conversation_state_json(p_conversation_id); return;
  end if;
  if s.session_status='ended' then
    if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_conversation_denied'; end if;
    return query select 'already_ended'::text,ai.solmind_conversation_state_json(p_conversation_id); return;
  end if;
  if st.revision<>p_expected_revision then return query select 'stale_revision'::text,null::jsonb; return; end if;
  if st.pending_operation_id is not null or exists(select 1 from ai.explorer_conversation_operation o
    where o.conversation_id=p_conversation_id and o.status='started') then
    return query select 'unavailable'::text,null::jsonb; return; end if;
  -- Ending is closure, not reflection. Preserve known/unknown/restricted/adult
  -- policy exactly; no ensure, classification, model, message or reactivation.
  perform c.item_id from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id order by c.item_id for share;
  select c.label into priority_label from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id and c.item_id=st.priority_id;
  select c.label into attention_label from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id and c.item_id=st.attention_id;
  select count(*) into route_count from ai.explorer_conversation_operation o where o.conversation_id=p_conversation_id
    and o.compass_route_kind is not null and o.initial_revision<st.revision;
  directions:=case when st.priority_id is null then 'No Priority was confirmed when this conversation ended.'
    else 'The confirmed Priority at the end was "'||priority_label||'".' end;
  directions:=directions||case when st.attention_id is null then ' No current-attention point was chosen.'
    else ' Current attention was "'||attention_label||'".' end;
  directions:=directions||case when route_count=0 then ' There are no recorded Route changes for this conversation.'
    else ' The saved Route records '||route_count::text||' attention, Priority or arrangement changes. Review that Route for the directions taken.' end;
  ts:=clock_timestamp();
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,kind,
    request_fingerprint,command_fingerprint,initial_revision,status,completed_at,ending_directions_text,ending_route_revision)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,'end_conversation',h,p_command_fingerprint,
      p_expected_revision,'completed',ts,directions,st.revision);
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set session_status='ended',ended_at=ts,last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  insert into audit.audit_event(event_type,actor_user_account_id,actor_role_context,target_entity_type,target_entity_id,
    action,reason_code,event_summary,metadata,ip_address,user_agent,created_at)
    values('ai_session_ended',p_actor_user_account_id,'explorer','ai_interaction_session',p_conversation_id,
      'end','explorer_ended_session','Explorer ended an AI interaction session.','{}',null,null,ts);
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_conversation_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id);
end $$;
alter function public.solmind_end_explorer_conversation_v1(uuid,uuid,uuid,uuid,integer,text) owner to postgres;
revoke all on function public.solmind_end_explorer_conversation_v1(uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.solmind_end_explorer_conversation_v1(uuid,uuid,uuid,uuid,integer,text) to service_role;

-- Old active-only reflective writers, policy flags, model and provider bindings are unchanged.
commit;
