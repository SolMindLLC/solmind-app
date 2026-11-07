-- Lane 12: at most five different Waypoints form in one conversation, counting any later Reached or Released
-- (Paul's rule, decision queue 2026-11-05 19:38:45 CST; execution/07 item 32 (b)). A different Waypoint is an original
-- version (no predecessor) chosen in that conversation; revisions and revisits continue an existing one and never use a
-- place. Conversations already above five keep everything; only a further new Waypoint is refused. Exact replay keeps
-- returning before any capacity check, as before. No table, row, policy or grant changes.
begin;

create function ai.solmind_waypoint_root_room_v1(p_actor uuid,p_conversation uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select p_actor is not null and p_conversation is not null
    and (select count(*) from content.waypoint w where w.source_ai_interaction_session_id=p_conversation
      and w.chosen_by_explorer_user_account_id=p_actor and w.predecessor_waypoint_id is null)<5
$$;
alter function ai.solmind_waypoint_root_room_v1(uuid,uuid) owner to postgres;
revoke all on function ai.solmind_waypoint_root_room_v1(uuid,uuid) from public,anon,authenticated,service_role;

create function ai.solmind_waypoint_insert_allowed_v2(p_actor uuid,p_conversation uuid,p_increases_active boolean,p_creates_root boolean)
returns boolean language sql stable security definer set search_path='' as $$
  select p_actor is not null and p_conversation is not null and p_increases_active is not null and p_creates_root is not null
    and (select count(*) from content.waypoint w where w.source_ai_interaction_session_id=p_conversation)<p.history_limit
    and (not p_increases_active or ai.solmind_waypoint_active_count_v1(p_actor)<p.active_limit)
    and (not p_creates_root or ai.solmind_waypoint_root_room_v1(p_actor,p_conversation))
  from ai.solmind_waypoint_policy_v1() p
$$;
alter function ai.solmind_waypoint_insert_allowed_v2(uuid,uuid,boolean,boolean) owner to postgres;
revoke all on function ai.solmind_waypoint_insert_allowed_v2(uuid,uuid,boolean,boolean) from public,anon,authenticated,service_role;

-- v1 keeps its signature for its two remaining callers, which both form a new Waypoint: confirm_waypoint in
-- public.solmind_mutate_explorer_conversation and ai.solmind_apply_waypoint_draft_response ("That's right" and a typed
-- right). The revisit path, the only other caller that increases the active count, now calls v2 directly (below).
create or replace function ai.solmind_waypoint_insert_allowed_v1(p_actor uuid,p_conversation uuid,p_increases_active boolean)
returns boolean language sql stable security definer set search_path='' as $$
  select ai.solmind_waypoint_insert_allowed_v2(p_actor,p_conversation,p_increases_active,p_increases_active)
$$;
alter function ai.solmind_waypoint_insert_allowed_v1(uuid,uuid,boolean) owner to postgres;
revoke all on function ai.solmind_waypoint_insert_allowed_v1(uuid,uuid,boolean) from public,anon,authenticated,service_role;

-- The server capacity facts gain conversationRoom: whether this conversation can still form a different Waypoint.
-- Before the first Send there is no conversation yet; it has room (as historyRoom is true), while the insertion guard
-- above still refuses any insert without a conversation.
create or replace function ai.solmind_waypoint_capacity_v1(p_actor uuid,p_conversation uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('activeCount',ai.solmind_waypoint_active_count_v1(p_actor),
    'activeLimit',p.active_limit,'historyRoom',(select count(*) from content.waypoint w
      where w.source_ai_interaction_session_id=p_conversation)<p.history_limit,
    'conversationRoom',p_conversation is null or ai.solmind_waypoint_root_room_v1(p_actor,p_conversation))
  from ai.solmind_waypoint_policy_v1() p
$$;
alter function ai.solmind_waypoint_capacity_v1(uuid,uuid) owner to postgres;
revoke all on function ai.solmind_waypoint_capacity_v1(uuid,uuid) from public,anon,authenticated,service_role;

-- Latest definition from 20261106000000, unchanged except its capacity call (v2, creates_root false).
create or replace function public.solmind_confirm_explorer_waypoint_revision_v1(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_expected_revision integer,p_command_fingerprint text,p_kind text,p_waypoint_id uuid,p_answers jsonb
) returns table(outcome text,conversation_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' as $$
declare a jsonb; policy jsonb; st ai.explorer_conversation_state%rowtype;
  w content.waypoint%rowtype; op ai.explorer_conversation_operation%rowtype;
  entry jsonb; component_name text; answer_value text; ordinal integer; last_ordinal integer:=0;
  new_destination text; new_meaning text; new_arrival text; changed_answers jsonb:='[]';
  h text; ts timestamptz; reason text;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_conversation_id is null or p_operation_id is null or p_expected_revision is null or p_expected_revision<0
    or p_waypoint_id is null or p_kind is null or p_kind not in ('revise_waypoint','revisit_waypoint')
    or p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$'
    or jsonb_typeof(p_answers) is distinct from 'array' then raise exception 'solmind_explorer_private_invalid_input'; end if;
  if jsonb_array_length(p_answers)>3 then raise exception 'solmind_explorer_private_invalid_input'; end if;
  for entry in select value from jsonb_array_elements(p_answers) loop
    if jsonb_typeof(entry) is distinct from 'object' then raise exception 'solmind_explorer_private_invalid_input'; end if;
    if (select count(*) from jsonb_object_keys(entry))<>2 or not entry ?& array['component','answer']
      or jsonb_typeof(entry->'component') is distinct from 'string' or jsonb_typeof(entry->'answer') is distinct from 'string'
      then raise exception 'solmind_explorer_private_invalid_input'; end if;
    component_name:=entry->>'component'; answer_value:=entry->>'answer';
    ordinal:=case component_name when 'destination' then 1 when 'meaning' then 2 when 'arrivalSignal' then 3 else null end;
    if ordinal is null or ordinal<=last_ordinal or not ai.solmind_conversation_text_valid(answer_value,1000,false)
      or answer_value is distinct from btrim(answer_value,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
      then raise exception 'solmind_explorer_private_invalid_input'; end if;
    last_ordinal:=ordinal;
  end loop;
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id
    then raise exception 'solmind_explorer_private_denied'; end if;
  h:=methodology.hash_json(jsonb_build_array('explorer-waypoint-revision.v1',p_user_session_id,p_conversation_id,
    p_expected_revision,p_kind,p_waypoint_id,p_answers,p_command_fingerprint));
  select x.* into op from ai.explorer_conversation_operation x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id for update;
  if found then
    if op.kind is distinct from p_kind or op.request_fingerprint is distinct from h
      or op.command_fingerprint is distinct from p_command_fingerprint or op.application_session_id is distinct from p_user_session_id
      or op.conversation_id is distinct from p_conversation_id or op.status is distinct from 'completed'
      or not exists(select 1 from content.waypoint successor where successor.waypoint_id=p_operation_id
        and successor.source_ai_interaction_session_id=p_conversation_id and successor.chosen_by_explorer_user_account_id=p_actor_user_account_id
        and successor.predecessor_waypoint_id=p_waypoint_id
        and successor.creation_reason=case p_kind when 'revise_waypoint' then 'revision' else 'revisit' end
        and successor.chosen_at=op.completed_at)
      then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp()
      then raise exception 'solmind_explorer_private_denied'; end if;
    return query select 'exact_replay'::text,ai.solmind_conversation_state_json(p_conversation_id); return;
  end if;
  policy:=ai.solmind_private_policy_v3(p_conversation_id);
  if policy->'known' is distinct from 'true'::jsonb or st.restricted_level is not null or st.adult_reflection_stopped
    then raise exception 'solmind_explorer_private_denied'; end if;
  if st.revision<>p_expected_revision then return query select 'stale_revision'::text,null::jsonb; return; end if;
  if st.pending_operation_id is not null or exists(select 1 from ai.explorer_conversation_operation o
    where o.conversation_id=p_conversation_id and o.status='started') then
    return query select 'unavailable'::text,null::jsonb; return; end if;
  select x.* into w from content.waypoint x where x.waypoint_id=p_waypoint_id
    and x.source_ai_interaction_session_id=p_conversation_id for update;
  if not found or w.chosen_by_explorer_user_account_id is distinct from p_actor_user_account_id
    or w.guide_explorer_relationship_id is distinct from (a->>'relationshipId')::uuid
    or exists(select 1 from content.waypoint successor where successor.predecessor_waypoint_id=p_waypoint_id)
    or (p_kind='revise_waypoint' and (w.lifecycle_status is distinct from 'chosen' or w.released_at is not null))
    or (p_kind='revisit_waypoint' and w.lifecycle_status is distinct from 'reached' and w.released_at is null)
    or not exists(select 1 from ai.ai_interaction_message m where m.ai_interaction_message_id=w.source_message_id
      and m.ai_interaction_session_id=p_conversation_id and (
        (m.sender_type='user' and m.sender_user_account_id=p_actor_user_account_id and m.sender_role_context='explorer')
        or (m.sender_type='ai' and m.ai_role='solmind_virtual_guide' and m.sender_user_account_id is null)))
    then raise exception 'solmind_explorer_private_denied'; end if;
  -- A revision or revisit continues an existing Waypoint, so it never needs one of the conversation's five places.
  if not ai.solmind_waypoint_insert_allowed_v2(p_actor_user_account_id,p_conversation_id,p_kind='revisit_waypoint',false) then
    return query select 'unavailable'::text,null::jsonb; return; end if;
  new_destination:=w.destination; new_meaning:=w.why_it_matters; new_arrival:=w.arrival_signal;
  for entry in select value from jsonb_array_elements(p_answers) loop
    component_name:=entry->>'component'; answer_value:=entry->>'answer';
    if (component_name='destination' and answer_value is distinct from w.destination)
      or (component_name='meaning' and answer_value is distinct from w.why_it_matters)
      or (component_name='arrivalSignal' and answer_value is distinct from w.arrival_signal) then
      changed_answers:=changed_answers||jsonb_build_array(entry);
      if component_name='destination' then new_destination:=answer_value;
      elsif component_name='meaning' then new_meaning:=answer_value;
      else new_arrival:=answer_value; end if;
    end if;
  end loop;
  if p_kind='revise_waypoint' and jsonb_array_length(changed_answers)=0 then
    raise exception 'solmind_explorer_private_invalid_input'; end if;
  reason:=case p_kind when 'revise_waypoint' then 'revision' else 'revisit' end;
  ts:=clock_timestamp();
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,kind,
    request_fingerprint,command_fingerprint,initial_revision,status,completed_at)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,p_kind,h,p_command_fingerprint,
      p_expected_revision,'completed',ts);
  insert into content.waypoint(waypoint_id,guide_explorer_relationship_id,source_ai_interaction_session_id,source_message_id,title,
    destination,why_it_matters,arrival_signal,lifecycle_status,chosen_by_explorer_user_account_id,chosen_at,
    predecessor_waypoint_id,creation_reason)
    values(p_operation_id,w.guide_explorer_relationship_id,p_conversation_id,w.source_message_id,
      case when w.title is distinct from w.destination then w.title else new_destination end,
      new_destination,new_meaning,new_arrival,'chosen',p_actor_user_account_id,ts,p_waypoint_id,reason);
  insert into content.waypoint_clarification(waypoint_id,component,question_key,answer_text,source_actor_user_account_id,created_at)
    select p_operation_id,changed.value->>'component','waypoint.'||(changed.value->>'component')||'.v1',changed.value->>'answer',p_actor_user_account_id,ts
    from jsonb_array_elements(changed_answers) as changed(value);
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  insert into audit.audit_event(event_type,actor_user_account_id,actor_role_context,target_entity_type,target_entity_id,
    action,reason_code,event_summary,metadata,ip_address,user_agent,created_at)
    values(case p_kind when 'revise_waypoint' then 'waypoint_revised' else 'waypoint_revisited' end,
      p_actor_user_account_id,'explorer','waypoint',p_operation_id,reason,
      case p_kind when 'revise_waypoint' then 'explorer_revised_waypoint' else 'explorer_revisited_waypoint' end,
      case p_kind when 'revise_waypoint' then 'Explorer revised a private Waypoint.' else 'Explorer revisited a private Waypoint.' end,
      '{}',null,null,ts);
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp()
    then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id);
end $$;

commit;
