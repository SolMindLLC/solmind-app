-- SolMind private Compass: the needle may point at any current point.
-- Paul's decision, decision queue 2026-11-03 18:05:33 CST ("Yes, build it",
-- the chat card redesign including this rule change): set_attention accepts
-- any current (not combined-away) Compass point, placed on the Compass or not,
-- also once a Compass is arranged, and still records the attention_changed
-- Route event with the point's saved label. confirm_priority keeps its rule
-- (once a Compass is arranged, only the apex point). Confirming an arrangement
-- keeps its rule that the current-attention point stays placed (Data Model
-- Spec 03, Explicit Compass arrangement: attention "remains independently
-- selected and visible"), so public.solmind_confirm_explorer_compass_arrangement_v1
-- is unchanged. Only the internal body that public.solmind_mutate_explorer_conversation_v3
-- calls is replaced: its latest definition (20261029030000) with the one rule
-- block changed, the same signature, return shape, security definer, empty
-- search_path and lock timeout. Its owner and grants stay as 20261025020000
-- left them (owner postgres; no API role may execute it), restated below.
-- No table, constraint, policy, other function, provider, context or data change.
begin;

create or replace function public.solmind_mutate_explorer_conversation(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_expected_revision integer,p_kind text,p_command_fingerprint text,p_source_message_id uuid default null,p_item_id uuid default null,
  p_waypoint_id uuid default null,p_label text default null,p_destination text default null,
  p_meaning text default null,p_arrival_signal text default null,p_evidence text default null
) returns table(outcome text,conversation_state jsonb)
language plpgsql volatile security definer set search_path = '' set lock_timeout = '2000ms' as $$
declare a jsonb; h text; op ai.explorer_conversation_operation%rowtype;
  st ai.explorer_conversation_state%rowtype; n integer; ts timestamptz;
  route_kind text; selected_label text; route_item uuid; selected_anchor text;
begin
  if p_conversation_id is null or p_operation_id is null or p_expected_revision is null or p_expected_revision<0
    or p_kind is null or p_kind not in ('add_compass','confirm_priority','set_attention','confirm_waypoint','confirm_reached')
    or p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$'
    or not (
      (p_kind='add_compass' and p_source_message_id is not null and p_item_id is null and p_waypoint_id is null
        and ai.solmind_conversation_text_valid(p_label,160,true) and p_destination is null
        and p_meaning is null and p_arrival_signal is null and p_evidence is null)
      or (p_kind in ('confirm_priority','set_attention') and p_source_message_id is null and p_item_id is not null
        and p_waypoint_id is null and p_label is null and p_destination is null
        and p_meaning is null and p_arrival_signal is null and p_evidence is null)
      or (p_kind='confirm_waypoint' and p_source_message_id is not null and p_item_id is null and p_waypoint_id is null
        and p_label is null and ai.solmind_conversation_text_valid(p_destination,1000,false)
        and ai.solmind_conversation_text_valid(p_meaning,1000,false)
        and ai.solmind_conversation_text_valid(p_arrival_signal,1000,false) and p_evidence is null)
      or (p_kind='confirm_reached' and p_source_message_id is null and p_item_id is null and p_waypoint_id is not null
        and p_label is null and p_destination is null and p_meaning is null and p_arrival_signal is null
        and ai.solmind_conversation_text_valid(p_evidence,1000,false)))
  then raise exception 'solmind_explorer_conversation_invalid_input'; end if;
  perform pg_advisory_xact_lock(hashtextextended('solmind:explorer-conversation:v2|'||p_actor_user_account_id::text||'|'||p_operation_id::text,0));
  a:=ai.solmind_conversation_authority(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id then
    raise exception 'solmind_explorer_conversation_denied'; end if;
  h:=upper(encode(extensions.digest(convert_to(jsonb_build_array(p_user_session_id,p_conversation_id,p_expected_revision,
    p_kind,p_source_message_id,p_item_id,p_waypoint_id,p_label,p_destination,p_meaning,p_arrival_signal,p_evidence,p_command_fingerprint)::text,'UTF8'),'sha256'),'hex'));
  select x.* into op from ai.explorer_conversation_operation x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id for update;
  if found then
    if op.request_fingerprint is distinct from h or op.command_fingerprint is distinct from p_command_fingerprint
      or op.conversation_id is distinct from p_conversation_id
      or op.kind is distinct from p_kind then
      raise exception 'solmind_explorer_conversation_operation_conflict'; end if;
    return query select 'exact_replay'::text,ai.solmind_conversation_state_json(p_conversation_id); return;
  end if;
  if st.revision<>p_expected_revision then return query select 'stale_revision'::text,null::jsonb; return; end if;
  if st.pending_operation_id is not null then return query select 'unavailable'::text,null::jsonb; return; end if;
  if p_source_message_id is not null and not exists(select 1 from ai.ai_interaction_message m
    where m.ai_interaction_message_id=p_source_message_id and m.ai_interaction_session_id=p_conversation_id
      and ((m.sender_type='user' and m.sender_user_account_id=p_actor_user_account_id and m.sender_role_context='explorer')
        or (m.sender_type='ai' and m.ai_role='solmind_virtual_guide' and m.sender_user_account_id is null)))
  then raise exception 'solmind_explorer_conversation_denied'; end if;
  ts:=clock_timestamp();
  if p_kind='add_compass' then
    select count(*)::integer into n from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id;
    if n>=24 then return query select 'unavailable'::text,null::jsonb; return; end if;
    insert into ai.explorer_conversation_compass_item(item_id,conversation_id,source_message_id,label,display_order)
      values(p_operation_id,p_conversation_id,p_source_message_id,p_label,n+1);
  elsif p_kind in ('confirm_priority','set_attention') then
    select c.label,c.compass_anchor into selected_label,selected_anchor from ai.explorer_conversation_compass_item c
      where c.item_id=p_item_id and c.conversation_id=p_conversation_id and c.merged_into_item_id is null for share;
    if not found then raise exception 'solmind_explorer_conversation_denied'; end if;
    -- The needle may point at any current point, placed or not (Paul's
    -- decision, 2026-11-03 18:05:33 CST). Once a Compass is arranged, only a
    -- new Priority must sit at the apex.
    if p_kind='confirm_priority' and exists(select 1 from ai.explorer_conversation_compass_item c
      where c.conversation_id=p_conversation_id and c.merged_into_item_id is null and c.relative_emphasis is not null)
      and selected_anchor is distinct from 'apex' then
      raise exception 'solmind_explorer_conversation_denied';
    end if;
    if p_kind='confirm_priority' then
      if st.priority_id is distinct from p_item_id then
        route_kind:=case when st.priority_id is null then 'priority_confirmed' else 'priority_reoriented' end;
        route_item:=p_item_id;
      end if;
      update ai.explorer_conversation_state set priority_id=p_item_id where conversation_id=p_conversation_id;
    else
      if st.attention_id is distinct from p_item_id then route_kind:='attention_changed'; route_item:=p_item_id; end if;
      update ai.explorer_conversation_state set attention_id=p_item_id where conversation_id=p_conversation_id;
    end if;
  elsif p_kind='confirm_waypoint' then
    if (select count(*) from content.waypoint w where w.source_ai_interaction_session_id=p_conversation_id)>=20 then
      return query select 'unavailable'::text,null::jsonb; return; end if;
    insert into content.waypoint(waypoint_id,guide_explorer_relationship_id,source_ai_interaction_session_id,
      source_message_id,title,destination,why_it_matters,arrival_signal,lifecycle_status,
      chosen_by_explorer_user_account_id,chosen_at)
      values(p_operation_id,(a->>'relationshipId')::uuid,p_conversation_id,p_source_message_id,
        p_destination,p_destination,p_meaning,p_arrival_signal,'chosen',p_actor_user_account_id,ts);
  else
    update content.waypoint set lifecycle_status='reached',reached_at=ts,
      reached_by_explorer_user_account_id=p_actor_user_account_id,reached_evidence=p_evidence
      where waypoint_id=p_waypoint_id and source_ai_interaction_session_id=p_conversation_id
        and chosen_by_explorer_user_account_id=p_actor_user_account_id and lifecycle_status='chosen';
    if not found then raise exception 'solmind_explorer_conversation_denied'; end if;
  end if;
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
    conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,
    compass_route_kind,compass_route_item_id,compass_route_label)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,p_kind,h,p_command_fingerprint,p_expected_revision,'completed',ts,
      route_kind,route_item,case when route_kind is not null then selected_label else null end);
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then
    raise exception 'solmind_explorer_conversation_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id);
end $$;
alter function public.solmind_mutate_explorer_conversation(uuid,uuid,uuid,uuid,integer,text,text,uuid,uuid,uuid,text,text,text,text,text) owner to postgres;
revoke all on function public.solmind_mutate_explorer_conversation(uuid,uuid,uuid,uuid,integer,text,text,uuid,uuid,uuid,text,text,text,text,text) from public,anon,authenticated,service_role;

commit;
