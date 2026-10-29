-- SolMind private Compass arrangement/emphasis and explicit Other paths.
-- Provisional private-demo storage limit: 24 saved points, at most eight visible.
-- No layout backfill, AI/provider/context, sharing, ending or Waypoint lifecycle.
begin;

alter table ai.explorer_conversation_compass_item
  add column compass_anchor text null,
  add column relative_emphasis smallint null,
  drop constraint explorer_conversation_compass_item_display_order_check,
  add constraint explorer_conversation_compass_item_display_order_check check (display_order between 1 and 24),
  add constraint explorer_compass_layout_shape_check check (
    (compass_anchor is null and relative_emphasis is null)
    or (relative_emphasis is not null and relative_emphasis between 1 and 3
      and (compass_anchor is null or compass_anchor in ('apex','upper_left','upper_right','side_left','side_right',
        'lower_left','lower_center','lower_right')))
  ),
  add constraint explorer_compass_anchor_unique unique (conversation_id,compass_anchor);

comment on column ai.explorer_conversation_compass_item.compass_anchor is
  'Explicit fixed Priority-up anchor; NULL with emphasis means Other paths, NULL pair means genuinely unarranged. No inferred placement.';
comment on column ai.explorer_conversation_compass_item.relative_emphasis is
  'Explorer-confirmed relative importance 1-3, never a clinical score; NULL legacy/new point is unarranged.';

-- Closed immutable history payload only; authoritative current layout is normal columns.
create function ai.solmind_compass_arrangement_snapshot_valid(p_snapshot jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare x jsonb; ids text[]:=array[]::text[]; anchors text[]:=array[]::text[];
  point text; anchor_name text; apex_id text; previous_id text; priority_id text;
begin
  if p_snapshot is null or jsonb_typeof(p_snapshot) is distinct from 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(p_snapshot))<>3
    or not p_snapshot ?& array['previousPriorityId','priorityId','items']
    or jsonb_typeof(p_snapshot->'items') is distinct from 'array' then return false; end if;
  if jsonb_array_length(p_snapshot->'items')>24 then return false; end if;
  if jsonb_typeof(p_snapshot->'previousPriorityId') is distinct from 'null' then
    if jsonb_typeof(p_snapshot->'previousPriorityId') is distinct from 'string' then return false; end if;
    previous_id:=p_snapshot->>'previousPriorityId';
    if length(previous_id)<>36 or previous_id collate "C" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  end if;
  if jsonb_typeof(p_snapshot->'priorityId') is distinct from 'null' then
    if jsonb_typeof(p_snapshot->'priorityId') is distinct from 'string' then return false; end if;
    priority_id:=p_snapshot->>'priorityId';
    if length(priority_id)<>36 or priority_id collate "C" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  end if;
  if previous_id is not null and priority_id is null then return false; end if;
  for x in select value from jsonb_array_elements(p_snapshot->'items') loop
    if jsonb_typeof(x) is distinct from 'object' then return false; end if;
    if (select count(*) from jsonb_object_keys(x))<>4 or not x ?& array['compassItemId','label','anchor','emphasis']
      or jsonb_typeof(x->'compassItemId') is distinct from 'string' or jsonb_typeof(x->'label') is distinct from 'string'
      or jsonb_typeof(x->'emphasis') is distinct from 'number' then return false; end if;
    point:=x->>'compassItemId';
    if length(point)<>36 or point collate "C" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or point=any(ids) or not ai.solmind_conversation_text_valid(x->>'label',160,true)
      or x->>'emphasis' not in ('1','2','3') then return false; end if;
    ids:=array_append(ids,point);
    if jsonb_typeof(x->'anchor') is distinct from 'null' then
      if jsonb_typeof(x->'anchor') is distinct from 'string' then return false; end if;
      anchor_name:=x->>'anchor';
      if anchor_name not in ('apex','upper_left','upper_right','side_left','side_right','lower_left','lower_center','lower_right')
        or anchor_name=any(anchors) then return false; end if;
      anchors:=array_append(anchors,anchor_name);
      if anchor_name='apex' then apex_id:=point; end if;
    end if;
  end loop;
  if previous_id is not null and not previous_id=any(ids) then return false; end if;
  if priority_id is not null and priority_id is distinct from apex_id then return false; end if;
  return true;
end $$;
alter function ai.solmind_compass_arrangement_snapshot_valid(jsonb) owner to postgres;
revoke all on function ai.solmind_compass_arrangement_snapshot_valid(jsonb) from public,anon,authenticated,service_role;

alter table ai.explorer_conversation_operation
  add column compass_arrangement jsonb null,
  drop constraint explorer_conversation_operation_kind_check,
  add constraint explorer_conversation_operation_kind_check check (kind in ('send','add_compass','confirm_priority','set_attention',
    'confirm_waypoint','confirm_reached','confirm_compass_arrangement')),
  drop constraint explorer_conversation_route_shape_check,
  add constraint explorer_conversation_route_shape_check check (
    (compass_route_kind is null and compass_route_item_id is null and compass_route_label is null and compass_arrangement is null)
    or
    (compass_arrangement is null and compass_route_kind is not null and compass_route_item_id is not null
      and compass_route_label is not null and status='completed'
      and ai.solmind_conversation_text_valid(compass_route_label,160,true)
      and ((kind='confirm_priority' and compass_route_kind in ('priority_confirmed','priority_reoriented'))
        or (kind='set_attention' and compass_route_kind='attention_changed')))
    or
    (kind='confirm_compass_arrangement' and status='completed' and compass_route_kind is not null and compass_route_kind='arrangement_confirmed'
      and compass_route_item_id is null and compass_route_label is null and compass_arrangement is not null
      and ai.solmind_compass_arrangement_snapshot_valid(compass_arrangement))
  );
comment on column ai.explorer_conversation_operation.compass_arrangement is
  'Closed actual confirmed arrangement snapshot: previous/new Priority and DB-captured point labels/anchors/emphasis; immutable, private, never model context.';

create or replace function ai.solmind_private_operation_guard_v3() returns trigger
language plpgsql set search_path='' as $$
begin
  -- Route facts are insert-only. Legacy rows cannot be enriched into history.
  if old.compass_route_kind is not null then
    raise exception 'solmind_explorer_private_immutable';
  end if;
  if tg_op='UPDATE' and (new.compass_route_kind,new.compass_route_item_id,new.compass_route_label,new.compass_arrangement)
    is distinct from (old.compass_route_kind,old.compass_route_item_id,old.compass_route_label,old.compass_arrangement) then
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
$$;

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
      where c.item_id=p_item_id and c.conversation_id=p_conversation_id for share;
    if not found then raise exception 'solmind_explorer_conversation_denied'; end if;
    if exists(select 1 from ai.explorer_conversation_compass_item c
      where c.conversation_id=p_conversation_id and c.relative_emphasis is not null)
      and ((p_kind='confirm_priority' and selected_anchor is distinct from 'apex')
        or (p_kind='set_attention' and selected_anchor is null)) then
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

create function public.solmind_confirm_explorer_compass_arrangement_v1(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_expected_revision integer,p_command_fingerprint text,p_priority_id uuid,p_items jsonb
) returns table(outcome text,conversation_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; policy jsonb; st ai.explorer_conversation_state%rowtype;
  op ai.explorer_conversation_operation%rowtype; x jsonb; canonical_items jsonb; snapshot jsonb;
  ids uuid[]:=array[]::uuid[]; anchors text[]:=array[]::text[]; point uuid; anchor_name text;
  h text; ts timestamptz; meaningful boolean; n integer;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_conversation_id is null or p_operation_id is null or p_expected_revision is null or p_expected_revision<0
    or p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$'
    or p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'solmind_explorer_private_invalid_input'; end if;
  if jsonb_array_length(p_items)>24 then raise exception 'solmind_explorer_private_invalid_input'; end if;
  for x in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(x) is distinct from 'object' then raise exception 'solmind_explorer_private_invalid_input'; end if;
    if (select count(*) from jsonb_object_keys(x))<>3 or not x ?& array['compassItemId','anchor','emphasis']
      or jsonb_typeof(x->'compassItemId') is distinct from 'string'
      or jsonb_typeof(x->'emphasis') is distinct from 'number' then raise exception 'solmind_explorer_private_invalid_input'; end if;
    if length(x->>'compassItemId')<>36 or (x->>'compassItemId') collate "C" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or x->>'emphasis' not in ('1','2','3') then raise exception 'solmind_explorer_private_invalid_input'; end if;
    point:=(x->>'compassItemId')::uuid;
    if point=any(ids) then raise exception 'solmind_explorer_private_invalid_input'; end if;
    ids:=array_append(ids,point);
    if jsonb_typeof(x->'anchor') is distinct from 'null' then
      if jsonb_typeof(x->'anchor') is distinct from 'string' then raise exception 'solmind_explorer_private_invalid_input'; end if;
      anchor_name:=x->>'anchor';
      if anchor_name not in ('apex','upper_left','upper_right','side_left','side_right','lower_left','lower_center','lower_right')
        or anchor_name=any(anchors) then raise exception 'solmind_explorer_private_invalid_input'; end if;
      anchors:=array_append(anchors,anchor_name);
    end if;
  end loop;
  select coalesce(jsonb_agg(value order by value->>'compassItemId'),'[]'::jsonb) into canonical_items from jsonb_array_elements(p_items);
  h:=methodology.hash_json(jsonb_build_array('compass-arrangement.v1',p_user_session_id,p_conversation_id,
    p_expected_revision,p_priority_id,canonical_items,p_command_fingerprint));
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  select z.* into st from ai.explorer_conversation_state z where z.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id then raise exception 'solmind_explorer_private_denied'; end if;
  select z.* into op from ai.explorer_conversation_operation z
    where z.actor_user_account_id=p_actor_user_account_id and z.operation_id=p_operation_id for update;
  if found then
    if op.request_fingerprint is distinct from h or op.command_fingerprint is distinct from p_command_fingerprint
      or op.conversation_id is distinct from p_conversation_id or op.kind is distinct from 'confirm_compass_arrangement'
      or op.application_session_id is distinct from p_user_session_id or op.status is distinct from 'completed'
      then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
    return query select 'exact_replay'::text,ai.solmind_conversation_state_json(p_conversation_id); return;
  end if;
  policy:=ai.solmind_private_policy_v3(p_conversation_id);
  if policy->'known' is distinct from 'true'::jsonb or st.restricted_level is not null or st.adult_reflection_stopped
    then raise exception 'solmind_explorer_private_denied'; end if;
  if st.revision<>p_expected_revision then return query select 'stale_revision'::text,null::jsonb; return; end if;
  if st.pending_operation_id is not null then return query select 'unavailable'::text,null::jsonb; return; end if;
  perform c.item_id from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id order by c.item_id for update;
  select count(*)::integer into n from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id;
  if n<>cardinality(ids) or exists(select 1 from unnest(ids) id where not exists(
    select 1 from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id and c.item_id=id))
    or (st.priority_id is not null and p_priority_id is null)
    or (p_priority_id is not null and not exists(select 1 from jsonb_array_elements(canonical_items) i
      where (i->>'compassItemId')::uuid=p_priority_id and i->>'anchor'='apex'))
    or (st.attention_id is not null and not exists(select 1 from jsonb_array_elements(canonical_items) i
      where (i->>'compassItemId')::uuid=st.attention_id and i->>'anchor' is not null))
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  select exists(select 1 from ai.explorer_conversation_compass_item c join jsonb_array_elements(canonical_items) i
      on c.item_id=(i->>'compassItemId')::uuid where c.conversation_id=p_conversation_id
      and (c.compass_anchor is distinct from i->>'anchor' or c.relative_emphasis is distinct from (i->>'emphasis')::smallint))
    or st.priority_id is distinct from p_priority_id into meaningful;
  select jsonb_build_object('previousPriorityId',st.priority_id,'priorityId',p_priority_id,'items',
    coalesce(jsonb_agg(jsonb_build_object('compassItemId',c.item_id,'label',c.label,'anchor',i->'anchor','emphasis',i->'emphasis')
      order by c.item_id),'[]'::jsonb)) into snapshot
    from ai.explorer_conversation_compass_item c join jsonb_array_elements(canonical_items) i
      on c.item_id=(i->>'compassItemId')::uuid where c.conversation_id=p_conversation_id;
  ts:=clock_timestamp();
  if meaningful then
    -- Both statements remain in this locked transaction; no intermediate layout commits.
    update ai.explorer_conversation_compass_item set compass_anchor=null where conversation_id=p_conversation_id;
    update ai.explorer_conversation_compass_item c set compass_anchor=i->>'anchor',relative_emphasis=(i->>'emphasis')::smallint
      from jsonb_array_elements(canonical_items) i where c.conversation_id=p_conversation_id and c.item_id=(i->>'compassItemId')::uuid;
    update ai.explorer_conversation_state set priority_id=p_priority_id where conversation_id=p_conversation_id;
  end if;
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,kind,
    request_fingerprint,command_fingerprint,initial_revision,status,completed_at,compass_route_kind,compass_arrangement)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,'confirm_compass_arrangement',h,p_command_fingerprint,
      p_expected_revision,'completed',ts,case when meaningful then 'arrangement_confirmed' else null end,
      case when meaningful then snapshot else null end);
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id);
end $$;
alter function public.solmind_confirm_explorer_compass_arrangement_v1(uuid,uuid,uuid,uuid,integer,text,uuid,jsonb) owner to postgres;
revoke all on function public.solmind_confirm_explorer_compass_arrangement_v1(uuid,uuid,uuid,uuid,integer,text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.solmind_confirm_explorer_compass_arrangement_v1(uuid,uuid,uuid,uuid,integer,text,uuid,jsonb) to service_role;

-- Existing function identities, owners, ACLs and model definitions remain unchanged.
commit;
