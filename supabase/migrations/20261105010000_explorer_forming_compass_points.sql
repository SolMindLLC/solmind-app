-- Chat step S5: private forming points, no additional wording snapshots.
-- Existing immutable provider evidence remains unchanged. No S6 public command.
begin;

alter table ai.explorer_conversation_compass_item
  add column formation_status text null check (formation_status in ('proposed','confirmed','rejected')),
  add column wording_message_id uuid null references ai.ai_interaction_message(ai_interaction_message_id),
  add constraint explorer_compass_formation_pointer check (
    (formation_status is null and wording_message_id is null)
    or (formation_status is not null and wording_message_id is not null)),
  drop constraint explorer_conversation_compass_item_display_order_check,
  add constraint explorer_conversation_compass_item_display_order_check check (display_order between 1 and 48);
comment on column ai.explorer_conversation_compass_item.formation_status is
  'NULL: Explorer-saved legacy point; proposed: forming; confirmed: exact wording confirmed; rejected: private withdrawn suggestion. At most 24 non-rejected stored originals and 24 rejected rows per conversation; no eviction.';
comment on column ai.explorer_conversation_compass_item.wording_message_id is
  'Latest saved Virtual Guide reply that set proposed wording. Replaced in place, never a wording history; source_message_id keeps the original source.';

drop index ai.explorer_compass_current_anchor_unique;
create unique index explorer_compass_current_anchor_unique
  on ai.explorer_conversation_compass_item(conversation_id,compass_anchor)
  where merged_into_item_id is null and formation_status is distinct from 'rejected' and compass_anchor is not null;

alter table ai.explorer_conversation_operation
  add column followed_attention_item_id uuid null,
  add constraint explorer_followed_attention_item_fkey foreign key(conversation_id,followed_attention_item_id)
    references ai.explorer_conversation_compass_item(conversation_id,item_id),
  add constraint explorer_followed_attention_item_shape check (followed_attention_item_id is null or
    (kind='send' and status='completed' and reply_message_id is not null and safety_protocol_version='explorer-safety-reply.v2')
    or (kind='set_attention' and status='completed' and compass_route_kind is null and origin_operation_id is null)),
  drop constraint explorer_follow_attention_origin_shape,
  add constraint explorer_follow_attention_origin_shape check (
    (kind in ('follow_attention','set_attention') and origin_operation_id is not null and origin_operation_id<>operation_id
      and status='completed' and compass_route_kind is not null and compass_route_kind='attention_changed')
    or (kind<>'follow_attention' and origin_operation_id is null)),
  drop constraint explorer_conversation_operation_kind_check,
  add constraint explorer_conversation_operation_kind_check check(kind in ('send','add_compass','confirm_priority','set_attention',
    'confirm_waypoint','confirm_reached','confirm_compass_arrangement','end_conversation','confirm_compass_category',
    'release_waypoint','revise_waypoint','revisit_waypoint','follow_attention','confirm_compass_point','reject_compass_point'));
comment on column ai.explorer_conversation_operation.followed_attention_item_id is
  'Immutable terminal Send outcome or insert-time Explorer move onto a forming target whose Route event is deferred. No wording.';
comment on column ai.explorer_conversation_operation.origin_operation_id is
  'Insert-only link from one materialized attention move to its completed Send or deferred Explorer set_attention in the same conversation. Never browser authority or a second Send/count.';

create function ai.solmind_compass_suggestion_label_valid(p_label text)
returns boolean language sql immutable set search_path='' as $$
  select ai.solmind_conversation_text_valid(p_label,160,true) and char_length(p_label)<=160
    and p_label=btrim(p_label,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
    and p_label !~ U&'[\200B-\200D\202A-\202E\2060\2066-\2069\FEFF]'
    and (select coalesce(sum(case when ascii(substr(p_label,n,1))>65535 then 2 else 1 end),0)
      from generate_series(1,char_length(p_label)) n)<=160
$$;
alter function ai.solmind_compass_suggestion_label_valid(text) owner to postgres;
revoke all on function ai.solmind_compass_suggestion_label_valid(text) from public,anon,authenticated,service_role;

create function ai.solmind_compass_formation_guard() returns trigger
language plpgsql set search_path='' as $$
declare st ai.explorer_conversation_state%rowtype;
begin
  if tg_op='DELETE' then
    if old.formation_status is not null then raise exception 'solmind_explorer_private_immutable'; end if;
    return old;
  end if;
  select s.* into st from ai.explorer_conversation_state s where s.conversation_id=new.conversation_id for update;
  if tg_op='UPDATE' then
    if old.formation_status is not null and (new.item_id,new.conversation_id,new.source_message_id,new.display_order,new.created_at,new.retention_class)
      is distinct from (old.item_id,old.conversation_id,old.source_message_id,old.display_order,old.created_at,old.retention_class)
      then raise exception 'solmind_explorer_private_immutable'; end if;
    if old.formation_status='rejected' and new is distinct from old
      then raise exception 'solmind_explorer_private_immutable'; end if;
    if old.formation_status is distinct from 'proposed' and
      (new.formation_status,new.wording_message_id) is distinct from (old.formation_status,old.wording_message_id)
      then raise exception 'solmind_explorer_private_immutable'; end if;
    if old.formation_status='proposed' and new.formation_status is distinct from 'proposed' then
      if new.formation_status is null or new.formation_status not in ('confirmed','rejected')
        or new.label is distinct from old.label or new.wording_message_id is distinct from old.wording_message_id
        or st.pending_operation_id is not null
        then raise exception 'solmind_explorer_private_immutable'; end if;
    end if;
  end if;
  if new.formation_status='proposed' then
    if new.compass_anchor is not null or new.relative_emphasis is not null or new.merged_into_item_id is not null
      then raise exception 'solmind_explorer_private_formation_conflict'; end if;
    if tg_op='INSERT' or new.label is distinct from old.label or new.wording_message_id is distinct from old.wording_message_id then
      -- The reply exists and the Send is terminal, but pending has not yet been
      -- cleared. Only the settlement transaction can reach this interval through
      -- an API capability; other commands refuse pending turns and tables are private.
      if not exists(select 1 from ai.explorer_conversation_operation op
        join ai.ai_interaction_message m on m.ai_interaction_message_id=op.reply_message_id
        where op.actor_user_account_id=st.actor_user_account_id and op.operation_id=st.pending_operation_id
          and op.conversation_id=new.conversation_id and op.kind='send' and op.status='completed'
          and op.safety_protocol_version='explorer-safety-reply.v2' and op.safety_request_mode='classification_and_reply'
          and op.reply_message_id=new.wording_message_id and m.ai_interaction_session_id=new.conversation_id
          and m.sender_type='ai' and m.ai_role='solmind_virtual_guide' and m.sender_user_account_id is null)
        or st.restricted_level is not null or st.adult_reflection_stopped
        or not ai.solmind_compass_suggestion_label_valid(new.label)
        then raise exception 'solmind_explorer_private_formation_conflict'; end if;
    end if;
  elsif tg_op='INSERT' and new.formation_status is not null then
    raise exception 'solmind_explorer_private_formation_conflict';
  end if;
  if (tg_op='INSERT' or new.formation_status is distinct from old.formation_status) and
    (select count(*) from ai.explorer_conversation_compass_item c where c.conversation_id=new.conversation_id
      and c.item_id<>new.item_id and (c.formation_status is not distinct from 'rejected')=(new.formation_status is not distinct from 'rejected'))>=24
    then raise exception 'solmind_explorer_private_formation_limit'; end if;
  return new;
end $$;
alter function ai.solmind_compass_formation_guard() owner to postgres;
revoke all on function ai.solmind_compass_formation_guard() from public,anon,authenticated,service_role;
create trigger explorer_compass_formation_guard before insert or update or delete on ai.explorer_conversation_compass_item
  for each row execute function ai.solmind_compass_formation_guard();

create or replace function ai.solmind_private_operation_guard_v3() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.kind='follow_attention' and not exists(select 1 from ai.explorer_conversation_operation source
      where source.actor_user_account_id=new.actor_user_account_id and source.operation_id=new.origin_operation_id
        and source.conversation_id=new.conversation_id and source.application_session_id=new.application_session_id
        and source.kind='send' and source.status='completed' and source.reply_message_id is not null
        and source.safety_protocol_version='explorer-safety-reply.v2')
      then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    if new.kind='set_attention' and new.origin_operation_id is not null and not exists(
      select 1 from ai.explorer_conversation_operation source
      join ai.explorer_conversation_compass_item point on point.conversation_id=source.conversation_id
        and point.item_id=source.followed_attention_item_id
      where source.actor_user_account_id=new.actor_user_account_id and source.operation_id=new.origin_operation_id
        and source.conversation_id=new.conversation_id and source.application_session_id=new.application_session_id
        and source.kind='set_attention' and source.status='completed' and source.compass_route_kind is null
        and source.origin_operation_id is null and source.followed_attention_item_id=new.compass_route_item_id
        and point.formation_status='confirmed' and point.label=new.compass_route_label
        and source.initial_revision=new.initial_revision and source.completed_at=new.completed_at)
      then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    return new;
  end if;
  -- Route facts are insert-only. Legacy rows cannot be enriched into history.
  if old.compass_route_kind is not null or old.kind in ('end_conversation','confirm_compass_category','release_waypoint','revise_waypoint','revisit_waypoint','confirm_compass_point','reject_compass_point') then
    raise exception 'solmind_explorer_private_immutable';
  end if;
  if old.kind='set_attention' and old.followed_attention_item_id is not null then
    raise exception 'solmind_explorer_private_immutable'; end if;
  if tg_op='UPDATE' and old.kind='set_attention'
    and new.followed_attention_item_id is distinct from old.followed_attention_item_id then
    raise exception 'solmind_explorer_private_immutable'; end if;
  if tg_op='UPDATE' and (new.compass_route_kind,new.compass_route_item_id,new.compass_route_label,new.compass_arrangement,new.ending_directions_text,new.ending_route_revision,new.compass_category_change,new.origin_operation_id)
    is distinct from (old.compass_route_kind,old.compass_route_item_id,old.compass_route_label,old.compass_arrangement,old.ending_directions_text,old.ending_route_revision,old.compass_category_change,old.origin_operation_id) then
    raise exception 'solmind_explorer_private_immutable';
  end if;
  if old.safety_protocol_version is null then
    if tg_op='UPDATE' and new.safety_protocol_version is not null then
      raise exception 'solmind_explorer_private_immutable'; end if;
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op='DELETE' or old.status<>'started' then raise exception 'solmind_explorer_private_immutable'; end if;
  if (to_jsonb(new)-array['status','completed_at','terminal_fingerprint','reply_message_id','followed_attention_item_id']) is distinct from
      (to_jsonb(old)-array['status','completed_at','terminal_fingerprint','reply_message_id','followed_attention_item_id'])
    or new.status not in ('completed','failed','canceled') or new.completed_at is null or new.terminal_fingerprint is null
    then raise exception 'solmind_explorer_private_immutable'; end if;
  return new;
end $$;

-- Transient, server-only S4 acknowledgment. Never a Route row or wording snapshot.
create function ai.solmind_forming_attention_move_v1(p_conversation_id uuid)
returns jsonb language sql stable set search_path='' as $$
  -- A rejected latest move carries only chronology, suppressing stale acknowledgments.
  select jsonb_build_object('pointId',case when point.formation_status='proposed' then move.followed_attention_item_id end,
    'revision',move.initial_revision+1,'recordedAt',move.completed_at)
  from (select o.* from ai.explorer_conversation_operation o
    where o.conversation_id=p_conversation_id and (o.compass_route_kind='attention_changed'
      or (o.kind='set_attention' and o.followed_attention_item_id is not null
        and not exists(select 1 from ai.explorer_conversation_operation materialized
          where materialized.actor_user_account_id=o.actor_user_account_id and materialized.origin_operation_id=o.operation_id)))
    order by o.initial_revision desc,o.operation_id desc limit 1) move
  join ai.explorer_conversation_compass_item point on point.conversation_id=move.conversation_id
    and point.item_id=move.followed_attention_item_id and point.formation_status in ('proposed','rejected') and point.merged_into_item_id is null
  join ai.explorer_conversation_state st on st.conversation_id=move.conversation_id
    and ((point.formation_status='proposed' and st.attention_id=point.item_id)
      or (point.formation_status='rejected' and st.attention_id is null))
  where move.kind='set_attention' and move.compass_route_kind is null and move.status='completed'
    and not exists(select 1 from ai.ai_interaction_message reply where reply.ai_interaction_session_id=p_conversation_id
      and reply.sender_type='ai' and reply.created_at>=move.completed_at)
$$;
alter function ai.solmind_forming_attention_move_v1(uuid) owner to postgres;
revoke all on function ai.solmind_forming_attention_move_v1(uuid) from public,anon,authenticated,service_role;

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
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp()
    then raise exception 'solmind_explorer_private_denied'; end if;
  return query select case when replay then 'exact_replay' else 'ok' end,
    ai.solmind_conversation_state_json(v_id),a,ai.solmind_private_policy_v3(v_id);
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
      'body',m.content_text,'createdAt',m.created_at)
      || case when m.explorer_reply_choices is null then '{}'::jsonb else jsonb_build_object('choices',m.explorer_reply_choices) end
      order by m.sequence_number)
      from ai.ai_interaction_message m where m.ai_interaction_session_id=p_id and m.sender_type in ('user','ai')),'[]'::jsonb),
    'compassItems',coalesce((select jsonb_agg(jsonb_build_object('id',c.item_id,'sourceMessageId',c.source_message_id,
      'label',c.label,'anchor',c.compass_anchor,'emphasis',c.relative_emphasis,'mergedIntoItemId',c.merged_into_item_id,'formation',case when c.formation_status='proposed' then 'forming' else 'saved' end) order by c.display_order) from ai.explorer_conversation_compass_item c where c.conversation_id=p_id and c.formation_status is distinct from 'rejected'),'[]'::jsonb),
    'priorityId',s.priority_id,'attentionId',s.attention_id,
    'route',coalesce((select jsonb_agg(case when o.compass_route_kind='category_confirmed' then
      jsonb_build_object('operationId',o.operation_id,'revision',o.initial_revision+1,'kind',o.compass_route_kind,
        'change',o.compass_category_change,'recordedAt',o.completed_at)
      when o.compass_route_kind='arrangement_confirmed' then
      jsonb_build_object('operationId',o.operation_id,'revision',o.initial_revision+1,'kind',o.compass_route_kind,
        'previousPriorityId',o.compass_arrangement->'previousPriorityId','priorityId',o.compass_arrangement->'priorityId',
        'items',o.compass_arrangement->'items','recordedAt',o.completed_at)
      else jsonb_build_object('operationId',o.operation_id,
        'revision',o.initial_revision+1,'kind',o.compass_route_kind,'compassItemId',o.compass_route_item_id,
        'label',o.compass_route_label,'recordedAt',o.completed_at)
        || case when o.compass_route_kind='attention_changed' then jsonb_build_object('actor',
          case when o.kind='follow_attention' then 'virtual_guide' else 'explorer' end) else '{}'::jsonb end
      end order by o.initial_revision,o.operation_id)
      from ai.explorer_conversation_operation o where o.conversation_id=p_id and o.compass_route_kind is not null),'[]'::jsonb),
    'waypoints',coalesce((select jsonb_agg(jsonb_build_object('id',w.waypoint_id,'sourceMessageId',w.source_message_id,
      'destination',w.destination,'meaning',w.why_it_matters,'arrivalSignal',w.arrival_signal,
      'status',w.lifecycle_status,'reachedEvidence',w.reached_evidence,'reachedAt',w.reached_at)
      || case when w.released_at is null then '{}'::jsonb else jsonb_build_object('release',
        jsonb_build_object('operationId',w.released_operation_id,'releasedAt',w.released_at)) end
      || case when w.predecessor_waypoint_id is null then '{}'::jsonb else jsonb_build_object('lifecycle',
        jsonb_build_object('predecessorWaypointId',w.predecessor_waypoint_id,'creationReason',w.creation_reason,
          'clarifications',coalesce((select jsonb_agg(jsonb_build_object('component',c.component,'questionKey',c.question_key,
            'answer',c.answer_text,'recordedAt',c.created_at) order by case c.component when 'destination' then 1 when 'meaning' then 2 else 3 end)
            from content.waypoint_clarification c where c.waypoint_id=w.waypoint_id),'[]'::jsonb))) end
      order by w.created_at,w.waypoint_id)
      from content.waypoint w where w.source_ai_interaction_session_id=p_id),'[]'::jsonb))
  from (select 1) anchor left join ai.explorer_conversation_state s on s.conversation_id=p_id
    left join ai.ai_interaction_session session_row on session_row.ai_interaction_session_id=s.conversation_id
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
  route_kind text; selected_label text; route_item uuid; selected_anchor text; selected_formation text; deferred_item uuid;
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
    select count(*)::integer into n from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id and c.formation_status is distinct from 'rejected';
    if n>=24 then return query select 'unavailable'::text,null::jsonb; return; end if;
    insert into ai.explorer_conversation_compass_item(item_id,conversation_id,source_message_id,label,display_order)
      values(p_operation_id,p_conversation_id,p_source_message_id,p_label,(select coalesce(max(c.display_order),0)+1 from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id));
  elsif p_kind in ('confirm_priority','set_attention') then
    select c.label,c.compass_anchor,c.formation_status into selected_label,selected_anchor,selected_formation from ai.explorer_conversation_compass_item c
      where c.item_id=p_item_id and c.conversation_id=p_conversation_id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' for share;
    if not found then raise exception 'solmind_explorer_conversation_denied'; end if;
    -- The needle may point at any current point, placed or not (Paul's
    -- decision, 2026-11-03 18:05:33 CST). Once a Compass is arranged, only a
    -- new Priority must sit at the apex.
    if p_kind='confirm_priority' and selected_formation='proposed' then raise exception 'solmind_explorer_conversation_denied'; end if;
    if p_kind='confirm_priority' and exists(select 1 from ai.explorer_conversation_compass_item c
      where c.conversation_id=p_conversation_id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' and c.relative_emphasis is not null)
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
      if st.attention_id is distinct from p_item_id then
        if selected_formation='proposed' then deferred_item:=p_item_id;
        else route_kind:='attention_changed'; route_item:=p_item_id; end if;
      end if;
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
    compass_route_kind,compass_route_item_id,compass_route_label,followed_attention_item_id)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,p_kind,h,p_command_fingerprint,p_expected_revision,'completed',ts,
      route_kind,route_item,case when route_kind is not null then selected_label else null end,deferred_item);
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then
    raise exception 'solmind_explorer_conversation_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id);
end $$;

create or replace function public.solmind_confirm_explorer_compass_arrangement_v1(
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
  select count(*)::integer into n from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' and c.formation_status is distinct from 'proposed';
  if n<>cardinality(ids) or exists(select 1 from unnest(ids) id where not exists(
    select 1 from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id and c.item_id=id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' and c.formation_status is distinct from 'proposed'))
    or (st.priority_id is not null and p_priority_id is null)
    or (p_priority_id is not null and not exists(select 1 from jsonb_array_elements(canonical_items) i
      where (i->>'compassItemId')::uuid=p_priority_id and i->>'anchor'='apex'))
    or (st.attention_id is not null and exists(select 1 from ai.explorer_conversation_compass_item forming where forming.item_id=st.attention_id and forming.formation_status is distinct from 'proposed') and not exists(select 1 from jsonb_array_elements(canonical_items) i
      where (i->>'compassItemId')::uuid=st.attention_id and i->>'anchor' is not null))
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  select exists(select 1 from ai.explorer_conversation_compass_item c join jsonb_array_elements(canonical_items) i
      on c.item_id=(i->>'compassItemId')::uuid where c.conversation_id=p_conversation_id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' and c.formation_status is distinct from 'proposed'
      and (c.compass_anchor is distinct from i->>'anchor' or c.relative_emphasis is distinct from (i->>'emphasis')::smallint))
    or st.priority_id is distinct from p_priority_id into meaningful;
  select jsonb_build_object('previousPriorityId',st.priority_id,'priorityId',p_priority_id,'items',
    coalesce(jsonb_agg(jsonb_build_object('compassItemId',c.item_id,'label',c.label,'anchor',i->'anchor','emphasis',i->'emphasis')
      order by c.item_id),'[]'::jsonb)) into snapshot
    from ai.explorer_conversation_compass_item c join jsonb_array_elements(canonical_items) i
      on c.item_id=(i->>'compassItemId')::uuid where c.conversation_id=p_conversation_id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' and c.formation_status is distinct from 'proposed';
  ts:=clock_timestamp();
  if meaningful then
    -- Both statements remain in this locked transaction; no intermediate layout commits.
    update ai.explorer_conversation_compass_item set compass_anchor=null where conversation_id=p_conversation_id and merged_into_item_id is null and formation_status is distinct from 'rejected' and formation_status is distinct from 'proposed';
    update ai.explorer_conversation_compass_item c set compass_anchor=i->>'anchor',relative_emphasis=(i->>'emphasis')::smallint
      from jsonb_array_elements(canonical_items) i where c.conversation_id=p_conversation_id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' and c.formation_status is distinct from 'proposed' and c.item_id=(i->>'compassItemId')::uuid;
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

create or replace function public.solmind_confirm_explorer_compass_category_v1(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_expected_revision integer,p_command_fingerprint text,p_target_item_id uuid,p_member_item_ids uuid[],p_label text
) returns table(outcome text,conversation_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' as $$
declare a jsonb; policy jsonb; st ai.explorer_conversation_state%rowtype;
  op ai.explorer_conversation_operation%rowtype; ids uuid[]; contributing uuid[];
  snapshot jsonb; old_label text; h text; ts timestamptz; meaningful boolean;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_conversation_id is null or p_operation_id is null or p_expected_revision is null or p_expected_revision<0
    or p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$'
    or p_target_item_id is null or p_member_item_ids is null or array_ndims(p_member_item_ids) is distinct from 1
    or array_lower(p_member_item_ids,1) is distinct from 1 or cardinality(p_member_item_ids) not between 1 and 24
    or array_position(p_member_item_ids,null) is not null or not ai.solmind_conversation_text_valid(p_label,160,true)
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  select array_agg(distinct id order by id) into ids from unnest(p_member_item_ids) id;
  if cardinality(ids)<>cardinality(p_member_item_ids) or not p_target_item_id=any(ids)
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  h:=methodology.hash_json(jsonb_build_array('compass-category.v1',p_user_session_id,p_conversation_id,
    p_expected_revision,p_target_item_id,to_jsonb(ids),p_label,p_command_fingerprint));
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id then raise exception 'solmind_explorer_private_denied'; end if;
  select x.* into op from ai.explorer_conversation_operation x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id for update;
  if found then
    if op.request_fingerprint is distinct from h or op.command_fingerprint is distinct from p_command_fingerprint
      or op.conversation_id is distinct from p_conversation_id or op.kind is distinct from 'confirm_compass_category'
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
  if (select count(*) from ai.explorer_conversation_compass_item c
      where c.conversation_id=p_conversation_id and c.item_id=any(ids) and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected' and c.formation_status is distinct from 'proposed')<>cardinality(ids)
    or (st.priority_id is not null and st.priority_id=any(ids) and st.priority_id<>p_target_item_id)
    or (st.attention_id is not null and st.attention_id=any(ids) and st.attention_id<>p_target_item_id)
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  with recursive originals(item_id) as (
    select c.item_id from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id and c.item_id=any(ids)
    union
    select c.item_id from ai.explorer_conversation_compass_item c join originals o on c.merged_into_item_id=o.item_id
      where c.conversation_id=p_conversation_id
  ) select array_agg(item_id order by item_id) into contributing from originals;
  if exists(select 1 from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id
    and c.item_id=any(contributing) and not exists(select 1 from ai.ai_interaction_message m
      where m.ai_interaction_message_id=c.source_message_id and m.ai_interaction_session_id=p_conversation_id
        and ((m.sender_type='user' and m.sender_user_account_id=p_actor_user_account_id and m.sender_role_context='explorer')
          or (m.sender_type='ai' and m.ai_role='solmind_virtual_guide' and m.sender_user_account_id is null))))
    then raise exception 'solmind_explorer_private_denied'; end if;
  select c.label into old_label from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id and c.item_id=p_target_item_id;
  meaningful:=cardinality(ids)>1 or old_label is distinct from p_label;
  if meaningful then
    select jsonb_build_object('targetItemId',p_target_item_id,'memberItemIds',to_jsonb(ids),'beforeItems',
      jsonb_agg(jsonb_build_object('compassItemId',c.item_id,'sourceMessageId',c.source_message_id,'label',c.label,
        'mergedIntoItemId',c.merged_into_item_id,'anchor',c.compass_anchor,'emphasis',c.relative_emphasis) order by c.item_id),
      'label',p_label) into snapshot
      from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id and c.item_id=any(contributing);
    update ai.explorer_conversation_compass_item set label=p_label where conversation_id=p_conversation_id and item_id=p_target_item_id;
    update ai.explorer_conversation_compass_item set merged_into_item_id=p_target_item_id
      where conversation_id=p_conversation_id and item_id=any(ids) and item_id<>p_target_item_id;
  end if;
  ts:=clock_timestamp();
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,kind,
    request_fingerprint,command_fingerprint,initial_revision,status,completed_at,compass_route_kind,compass_category_change)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,'confirm_compass_category',h,p_command_fingerprint,
      p_expected_revision,'completed',ts,case when meaningful then 'category_confirmed' else null end,snapshot);
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id);
end $$;

create or replace function public.solmind_end_explorer_conversation_v1(
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
  select c.label into attention_label from ai.explorer_conversation_compass_item c where c.conversation_id=p_conversation_id and c.item_id=st.attention_id and c.formation_status is distinct from 'proposed' and c.formation_status is distinct from 'rejected';
  select count(*) into route_count from ai.explorer_conversation_operation o where o.conversation_id=p_conversation_id
    and o.compass_route_kind is not null and o.initial_revision<st.revision;
  directions:=case when st.priority_id is null then 'No Priority was confirmed when this conversation ended.'
    else 'The confirmed Priority at the end was "'||priority_label||'".' end;
  directions:=directions||case when st.attention_id is null then ' No current-attention point was chosen.'
    when attention_label is null then ' Current attention was still forming.'
    else ' Current attention was "'||attention_label||'".' end;
  directions:=directions||case when route_count=0 then ' There are no recorded Route changes for this conversation.'
    else ' The saved Route records '||route_count::text||' Compass changes. Review that Route for the directions taken.' end;
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

create or replace function ai.solmind_inspect_explorer_context_v3(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_explorer_profile_id uuid,
  p_relationship_id uuid,p_conversation_id uuid,p_context_serialization text,p_context_source_ids uuid[]
) returns table(outcome text,excluded_entity_type text,excluded_entity_id uuid)
language plpgsql volatile security invoker set search_path='' set lock_timeout='2000ms' as $$
declare
  envelope json; part json; item json; immediate json; intake core.intake_response_set%rowtype;
  expected_fields text[]; actual_ids uuid[]; expected_ids uuid[]; history jsonb;
  source_hashes text[]; source_lower text[]; context_strings text[];
  immediate_id uuid; methodology_id uuid; cell record; capability_row record; seen integer:=0;
  total_bytes bigint:=0; field_index integer:=0; max_bytes integer; matched boolean; metadata_root record; metadata_roots integer:=0;
  winner_type text; winner_id uuid; winner_key text; candidate_key text;
  unknown_match boolean:=false; private_owner regclass; private_id uuid;
  compass_priority uuid; compass_attention uuid; compass_points jsonb; compass_route jsonb; compass_waypoints jsonb;
  point_ids uuid[]; waypoint_ids uuid[]; policy jsonb; classification_only boolean;
begin
  outcome:='unavailable'; excluded_entity_type:=null; excluded_entity_id:=null;
  if pg_catalog.current_setting('transaction_isolation') is distinct from 'read committed'
    or p_actor_user_account_id is null or p_user_session_id is null or p_explorer_profile_id is null
    or p_relationship_id is null or p_conversation_id is null or p_context_serialization is null
    or pg_catalog.octet_length(p_context_serialization) not between 2 and 524288
    or p_context_source_ids is null or pg_catalog.cardinality(p_context_source_ids) not between 3 and 103
    or pg_catalog.array_position(p_context_source_ids,null) is not null
  then return next; return; end if;
  select pg_catalog.array_agg(distinct x order by x) into actual_ids from pg_catalog.unnest(p_context_source_ids) x;
  if actual_ids is distinct from p_context_source_ids then return next; return; end if;
  -- Prepare already holds the state lock and has applied the current fallback
  -- observation. Derive the mode from that authoritative state, never the envelope.
  policy:=ai.solmind_private_policy_v3(p_conversation_id);
  if policy->'known' is distinct from 'true'::jsonb then return next; return; end if;
  classification_only:=policy->>'restrictedLevel' is not null or (policy->>'adultReflectionStopped')::boolean;
  envelope:=p_context_serialization::json;
  if not ai.solmind_exclusion_keys_v3(envelope,array['contractVersion','aiRole','actorRoleContext','globalPolicy',
    'roleBehavior','crisisBehavior','methodologyContext','sessionContext','approvedContinuity']
    ||case when classification_only then array[]::text[] else array['compassContext'] end
    ||array['currentSessionMessages','immediateExplorerMessage','outputRequirements'])
    or envelope->>'contractVersion' is distinct from (case when classification_only
      then 'wi007-v0.1+onboarding-fields-v2' else 'wi007-v0.1+onboarding-fields-v2+compass-v2' end)
    or envelope->>'aiRole' is distinct from 'solmind_virtual_guide'
    or envelope->>'actorRoleContext' is distinct from 'explorer'
    -- Strip complete JSON string tokens first; whitespace outside them is not
    -- part of the exact compact assembler serialization.
    or pg_catalog.regexp_replace(p_context_serialization,'"([^"\\]|\\.)*"','""','g') ~ '[[:space:]]'
  then return next; return; end if;
  select pg_catalog.array_agg(s.field_text order by s.field_path) into context_strings
    from ai.solmind_exclusion_strings_v3(envelope) s;
  if context_strings is null then return next; return; end if;

  -- Root owns the full locked consent/configuration/role authority check. These
  -- additional real-row checks bind the internal source/audit operation and do
  -- not call the old ordinary-reflection-only restricted-mode authority helper.
  if not exists(select 1 from identity.user_account a
    join identity.user_role_assignment ra on ra.user_account_id=a.user_account_id
    join identity.user_session u on u.user_account_id=a.user_account_id
    join core.explorer_profile e on e.user_account_id=a.user_account_id
    join core.guide_explorer_relationship r on r.explorer_profile_id=e.explorer_profile_id
    join ai.ai_interaction_session s on s.actor_user_account_id=a.user_account_id
      and s.explorer_profile_id=e.explorer_profile_id and s.guide_explorer_relationship_id=r.guide_explorer_relationship_id
    where a.user_account_id=p_actor_user_account_id and a.account_status='active'
      and ra.role_code='explorer' and ra.role_status='active' and ra.revoked_at is null and ra.granted_at<=clock_timestamp()
      and u.user_session_id=p_user_session_id and u.active_role_context='explorer' and u.session_status='active'
      and u.ended_at is null and u.expires_at>clock_timestamp()
      and e.explorer_profile_id=p_explorer_profile_id and e.status='active' and e.onboarding_status='active'
      and r.guide_explorer_relationship_id=p_relationship_id and r.relationship_status in ('active','paused')
      and s.ai_interaction_session_id=p_conversation_id and s.session_type='explorer_reflection'
      and s.actor_role_context='explorer' and s.session_status='active'
      and s.guide_profile_id=r.guide_profile_id and s.practice_id=r.practice_id)
    or (select count(*) from identity.user_session u where u.user_account_id=p_actor_user_account_id and u.session_status='active')<>1
  then return next; return; end if;

  part:=envelope->'sessionContext';
  if not ai.solmind_exclusion_keys_v3(part,array['sessionType','explorerId','sessionId','continuityBindingId',
      'explorerDisplayName','activeFocusItems','nextAppointment','explorerSafeGuardrail'])
    or part->>'sessionType' is distinct from 'explorer_virtual_guide'
    or part->>'explorerId' is distinct from p_explorer_profile_id::text
    or part->>'sessionId' is distinct from p_conversation_id::text
    or part->>'continuityBindingId' is distinct from p_relationship_id::text
    or (part->'explorerDisplayName')::text is distinct from 'null'
    or (part->'nextAppointment')::text is distinct from 'null'
    or (part->'explorerSafeGuardrail')::text is distinct from 'null'
    or (part->'activeFocusItems')::text is distinct from '[]'
  then return next; return; end if;
  foreach winner_type in array array['globalPolicy','roleBehavior','crisisBehavior','methodologyContext'] loop
    part:=envelope->winner_type;
    if not ai.solmind_exclusion_keys_v3(part,array['version','text'])
      or pg_catalog.json_typeof(part->'version') is distinct from 'string'
      or pg_catalog.json_typeof(part->'text') is distinct from 'string'
      or pg_catalog.char_length(part->>'version') not between 1 and 64
      or (part->>'version') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
      or pg_catalog.char_length(part->>'text') not between 1 and (case when winner_type='methodologyContext' then 24000 else 12000 end)
      or ai.solmind_exclusion_normalize_v3(part->>'text') is distinct from part->>'text'
    then return next; return; end if;
  end loop;
  winner_type:=null;
  if envelope->'methodologyContext'->>'version' !~ '^methodology:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then return next; return; end if;
  methodology_id:=pg_catalog.substr(envelope->'methodologyContext'->>'version',13)::uuid;
  part:=envelope->'outputRequirements';
  if not ai.solmind_exclusion_keys_v3(part,array['format','includeCitations','allowMarkdown'])
    or part->>'format' is distinct from 'plain_text' or (part->'includeCitations')::text is distinct from 'false'
    or (part->'allowMarkdown')::text is distinct from 'false'
  then return next; return; end if;
  immediate:=envelope->'immediateExplorerMessage';
  if not ai.solmind_exclusion_keys_v3(immediate,array['messageId','explorerId','sessionId','role','content'])
    or immediate->>'explorerId' is distinct from p_explorer_profile_id::text
    or immediate->>'sessionId' is distinct from p_conversation_id::text or immediate->>'role' is distinct from 'explorer'
    or pg_catalog.json_typeof(immediate->'content') is distinct from 'string'
    or not ai.solmind_conversation_text_valid(immediate->>'content',8192,false)
    or immediate->>'content' is distinct from ai.solmind_exclusion_normalize_v3(immediate->>'content')
    or immediate->>'messageId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then return next; return; end if;
  immediate_id:=(immediate->>'messageId')::uuid;
  if exists(select 1 from ai.ai_interaction_message m where m.ai_interaction_message_id=immediate_id)
    then return next; return; end if;

  select x.* into intake from core.intake_response_set x
    where x.guide_explorer_relationship_id=p_relationship_id and x.intake_status='completed'
    order by x.completed_at desc,x.intake_response_set_id desc limit 1;
  if not found or intake.completed_at is null or intake.completed_at>clock_timestamp()
    or pg_catalog.jsonb_typeof(intake.response_json) is distinct from 'object'
  then return next; return; end if;
  expected_ids:=array[immediate_id,intake.intake_response_set_id,methodology_id];
  select pg_catalog.array_agg(f.name order by f.ord) into expected_fields
  from pg_catalog.unnest(array['supportNow','usefulOutcome','supportStyle','guideContext','communicationPreference','doNotEmphasize'])
    with ordinality f(name,ord)
  where f.ord<=3 or pg_catalog.char_length(ai.solmind_exclusion_normalize_v3(coalesce(intake.response_json->>f.name,'')))>0;
  if pg_catalog.json_typeof(envelope->'approvedContinuity') is distinct from 'array'
    or pg_catalog.json_array_length(envelope->'approvedContinuity')<>pg_catalog.cardinality(expected_fields)
  then return next; return; end if;
  field_index:=0;
  for item in select value from pg_catalog.json_array_elements(envelope->'approvedContinuity') loop
    field_index:=field_index+1;
    if not ai.solmind_exclusion_keys_v3(item,array['sourceId','order','kind','field','content'])
      or item->>'sourceId' is distinct from intake.intake_response_set_id::text
      or item->>'order' is distinct from (field_index-1)::text or pg_catalog.json_typeof(item->'order') is distinct from 'number'
      or item->>'kind' is distinct from 'onboarding_answer' or item->>'field' is distinct from expected_fields[field_index]
      or pg_catalog.json_typeof(item->'content') is distinct from 'string'
      or pg_catalog.jsonb_typeof(intake.response_json->expected_fields[field_index]) is distinct from 'string'
      or item->>'content' is distinct from ai.solmind_exclusion_normalize_v3(intake.response_json->>expected_fields[field_index])
      or pg_catalog.char_length(item->>'content') not between 1 and 2000
    then return next; return; end if;
  end loop;
  if exists(select 1 from ai.ai_interaction_message m where m.ai_interaction_session_id=p_conversation_id and
    ((m.sender_type='user' and m.sender_user_account_id=p_actor_user_account_id and m.sender_role_context='explorer')
      or (m.sender_type='ai' and m.ai_role='solmind_virtual_guide' and m.sender_user_account_id is null)) is not true)
  then return next; return; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'messageId',h.ai_interaction_message_id,'order',h.ord-1,'explorerId',p_explorer_profile_id,'sessionId',p_conversation_id,
    'role',case when h.sender_type='user' then 'explorer' else 'solmind_virtual_guide' end,
    'content',ai.solmind_exclusion_normalize_v3(h.content_text)) order by h.ord),'[]'::jsonb),
    expected_ids||coalesce(pg_catalog.array_agg(h.ai_interaction_message_id order by h.ord),array[]::uuid[])
    into history,expected_ids
  from (select x.*,pg_catalog.row_number() over(order by x.sequence_number) as ord
    from (select m.* from ai.ai_interaction_message m where m.ai_interaction_session_id=p_conversation_id
      order by m.sequence_number desc limit 24) x) h;
  if envelope->'currentSessionMessages' is null or (envelope->'currentSessionMessages')::jsonb is distinct from history
    then return next; return; end if;

  if not classification_only then
  -- The saved Compass and Waypoint section (chat step slice S3), rebuilt exactly from the saved rows.
  -- Current points: not combined into another point, in display order. Priority and attention are the
  -- state's own values. The Route gives only needle moves (attention_changed) on a current point, the
  -- last five by (initial revision, operation), oldest first, each with that point's current normalized
  -- label, never the label the Route captured (it may be wording from before a rename); Priority changes,
  -- arrangement and category snapshots (and their before-labels) never enter model context. Waypoints:
  -- current heads only.
  select s.priority_id,s.attention_id into compass_priority,compass_attention
    from ai.explorer_conversation_state s where s.conversation_id=p_conversation_id;
  if not found then return next; return; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',c.item_id,
      'label',ai.solmind_exclusion_normalize_v3(c.label),'order',c.ord-1,'formation',case when c.formation_status='proposed' then 'forming' else 'saved' end,
      'anchor',c.compass_anchor,'emphasis',c.relative_emphasis) order by c.ord),'[]'::jsonb),
    coalesce(pg_catalog.array_agg(c.item_id order by c.ord),array[]::uuid[])
    into compass_points,point_ids
  from (select x.*,pg_catalog.row_number() over(order by x.display_order) as ord
    from ai.explorer_conversation_compass_item x
    where x.conversation_id=p_conversation_id and x.merged_into_item_id is null and x.formation_status is distinct from 'rejected') c;
  -- Include only the latest unanswered Explorer move onto a forming point as a
  -- transient acknowledgment; its immutable operation has no Route facts or label.
  with moves as (
    select o.kind,o.completed_at,coalesce(o.compass_route_kind,'attention_changed') as compass_route_kind,
      coalesce(o.compass_route_item_id,o.followed_attention_item_id) as compass_route_item_id,
      o.initial_revision,o.operation_id,o.compass_route_kind is null as deferred
    from ai.explorer_conversation_operation o
    where o.conversation_id=p_conversation_id and (o.compass_route_kind='attention_changed'
      or (o.kind='set_attention' and o.followed_attention_item_id is not null
        and not exists(select 1 from ai.explorer_conversation_operation materialized
          where materialized.actor_user_account_id=o.actor_user_account_id and materialized.origin_operation_id=o.operation_id)))
  ), eligible as (
    select o.*,c.label as current_label,c.formation_status,
      o.kind='set_attention'
        and o.operation_id=(select last_move.operation_id from moves last_move
          order by last_move.initial_revision desc,last_move.operation_id desc limit 1)
        and not exists(select 1 from ai.ai_interaction_message reply where reply.ai_interaction_session_id=p_conversation_id
          and reply.sender_type='ai' and reply.created_at>=o.completed_at) as awaiting_reply
    from moves o join ai.explorer_conversation_compass_item c on c.conversation_id=p_conversation_id
      and c.item_id=o.compass_route_item_id and c.merged_into_item_id is null and c.formation_status is distinct from 'rejected'
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('kind',r.compass_route_kind,
      'pointId',r.compass_route_item_id,'label',ai.solmind_exclusion_normalize_v3(r.current_label),
      'actor',case when r.kind='follow_attention' then 'virtual_guide' else 'explorer' end,
      'awaitingReply',r.awaiting_reply)
      order by r.initial_revision,r.operation_id),'[]'::jsonb)
    into compass_route
  from (select * from eligible e where e.formation_status is distinct from 'proposed'
      or (e.deferred and e.awaiting_reply and e.compass_route_item_id=compass_attention)
    order by e.initial_revision desc,e.operation_id desc limit 5) r;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',w.waypoint_id,
      'title',ai.solmind_exclusion_normalize_v3(w.title),'destination',ai.solmind_exclusion_normalize_v3(w.destination),
      'meaning',ai.solmind_exclusion_normalize_v3(w.why_it_matters),'arrivalSignal',ai.solmind_exclusion_normalize_v3(w.arrival_signal),
      'stage',case when w.lifecycle_status='reached' then 'reached' when w.released_at is not null then 'released' else 'formed' end,
      'reachedEvidence',case when w.lifecycle_status='reached' then ai.solmind_exclusion_normalize_v3(w.reached_evidence) end)
      order by w.created_at,w.waypoint_id),'[]'::jsonb),
    coalesce(pg_catalog.array_agg(w.waypoint_id order by w.created_at,w.waypoint_id),array[]::uuid[])
    into compass_waypoints,waypoint_ids
  from content.waypoint w where w.source_ai_interaction_session_id=p_conversation_id
    and not exists(select 1 from content.waypoint successor where successor.predecessor_waypoint_id=w.waypoint_id);
  if envelope->'compassContext' is null or (envelope->'compassContext')::jsonb is distinct from pg_catalog.jsonb_build_object(
      'version','explorer-compass-context.v2','points',compass_points,'priorityId',compass_priority,
      'attentionId',compass_attention,'recentRoute',compass_route,'waypoints',compass_waypoints,'drafts','[]'::jsonb)
    then return next; return; end if;
  expected_ids:=expected_ids||point_ids||waypoint_ids;
  end if;
  -- Distinct cross-kind identities are an independent source obligation; a
  -- duplicate must not disappear merely because the transport list is a set.
  if pg_catalog.cardinality(expected_ids) is distinct from
    (select count(distinct x)::integer from pg_catalog.unnest(expected_ids) x)
    then return next; return; end if;
  select pg_catalog.array_agg(distinct x order by x) into expected_ids from pg_catalog.unnest(expected_ids) x;
  if expected_ids is distinct from p_context_source_ids then return next; return; end if;

  -- Closed deployed family capability: any new private-note owner or changed
  -- covered column inventory is unsupported until explicitly reviewed. The new
  -- private evidence owner is physically created by Root's following migration.
  -- Lock BEFORE inspecting the covered catalog; otherwise a DDL change between
  -- the check and acquisition could invalidate that check without detection.
  lock table content.summary in share mode nowait;
  lock table content.summary_revision in share mode nowait;
  lock table content.summary_section in share mode nowait;
  lock table content.summary_publication in share mode nowait;
  lock table content.trigger_observation in share mode nowait;
  if pg_catalog.to_regclass('content.private_note') is not null then return next; return; end if;
  private_owner:=pg_catalog.to_regclass('ai.explorer_safety_evidence');
  if private_owner is null or not exists(select 1 from pg_catalog.pg_class c where c.oid=private_owner
      and c.relkind='r' and c.relrowsecurity and not c.relforcerowsecurity)
    or (select count(*) from pg_catalog.pg_attribute a where a.attrelid=private_owner and a.attnum>0 and not a.attisdropped
      and a.attname in ('explorer_safety_evidence_id','conversation_id') and a.atttypid='uuid'::regtype)<>2
    or exists(select 1 from pg_catalog.pg_policy p where p.polrelid=private_owner)
    or exists(select 1 from pg_catalog.unnest(array['anon','authenticated','service_role']) r(name)
      where pg_catalog.has_table_privilege(r.name,private_owner,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')
        or pg_catalog.has_any_column_privilege(r.name,private_owner,'SELECT,INSERT,UPDATE,REFERENCES'))
  then return next; return; end if;
  for capability_row in select * from (values
    ('content.summary',array['summary_id','guide_explorer_relationship_id','summary_type','summary_status','current_revision_id',
      'created_from_ai_interaction_session_id','created_by_actor_type','created_by_user_account_id','created_at','updated_at',
      'metadata','retention_class','created_from_appointment_id','version','last_operation_id']),
    ('content.summary_revision',array['summary_revision_id','summary_id','revision_number','content_markdown','revision_status',
      'created_by_actor_type','created_by_user_account_id','source_ai_model_invocation_id','source_ai_interaction_session_id',
      'source_ai_interaction_message_id','created_at','metadata','retention_class','created_by_role_context','previous_revision_id','ai_change_summary']),
    ('content.summary_section',array['summary_section_id','summary_revision_id','section_type','section_title','content_markdown',
      'visibility','display_order','created_at','retention_class']),
    ('content.summary_publication',array['summary_publication_id','summary_id','summary_revision_id','published_to_explorer_profile_id',
      'published_by_user_account_id','published_by_role_context','published_at','publication_status','unpublished_at',
      'unpublished_by_user_account_id','superseded_by_summary_publication_id','publication_operation_id','last_operation_id','created_at','retention_class']),
    ('content.trigger_observation',array['trigger_observation_id','guide_explorer_relationship_id','source_ai_interaction_session_id',
      'source_ai_interaction_message_id','source_summary_revision_id','trigger_label','observation_text','observation_window_start',
      'observation_window_end','occurrence_count','confidence_level','review_status','created_by_actor_type','created_at','metadata','retention_class'])
  ) v(relation,expected)
  loop
    if not exists(select 1 from pg_catalog.pg_class c where c.oid=pg_catalog.to_regclass(capability_row.relation)
        and c.relkind='r' and c.relrowsecurity and not c.relforcerowsecurity)
      or (select pg_catalog.array_agg(a.attname::text order by a.attname) from pg_catalog.pg_attribute a
        where a.attrelid=pg_catalog.to_regclass(capability_row.relation) and a.attnum>0 and not a.attisdropped)
      is distinct from (select pg_catalog.array_agg(x order by x) from pg_catalog.unnest(capability_row.expected) x)
      or exists(select 1 from pg_catalog.pg_attribute a
        where a.attrelid=pg_catalog.to_regclass(capability_row.relation) and a.attnum>0 and not a.attisdropped
          and a.atttypid is distinct from (case
            when a.attname like '%\_id' escape '\' then 'uuid'
            when a.attname='metadata' then 'jsonb'
            when a.attname='version' then 'bigint'
            when a.attname in ('revision_number','display_order','occurrence_count') then 'integer'
            when a.attname in ('created_at','updated_at','published_at','unpublished_at',
              'observation_window_start','observation_window_end') then 'timestamp with time zone'
            else 'text' end)::regtype)
    then return next; return; end if;
  end loop;

  -- A UUID FK alone does not establish actual Summary containment. Never
  -- attribute metadata to another Summary/relationship through a bad pointer.
  if exists(select 1 from content.summary s
    where s.guide_explorer_relationship_id=p_relationship_id and s.current_revision_id is not null
      and not exists(select 1 from content.summary_revision r
        where r.summary_revision_id=s.current_revision_id and r.summary_id=s.summary_id))
    then return next; return; end if;
  -- Charge raw metadata (including keys/non-string leaves) before expanding any
  -- root. Key/value cells are also charged below; this is deliberately conservative.
  for metadata_root in
    select t.metadata from content.trigger_observation t where t.guide_explorer_relationship_id=p_relationship_id
    union all select s.metadata from content.summary s where s.guide_explorer_relationship_id=p_relationship_id
    union all select r.metadata from content.summary_revision r join content.summary s on s.summary_id=r.summary_id
      where s.guide_explorer_relationship_id=p_relationship_id
  loop
    metadata_roots:=metadata_roots+1;
    max_bytes:=coalesce(pg_catalog.octet_length(metadata_root.metadata::text),0);
    total_bytes:=total_bytes+max_bytes;
    if metadata_roots>4096 or max_bytes>262144 or total_bytes>4194304 then return next; return; end if;
  end loop;

  select pg_catalog.array_agg(ai.solmind_exclusion_fingerprint_v3(x)),
    pg_catalog.array_agg(pg_catalog.lower(x)) into source_hashes,source_lower
    from pg_catalog.unnest(context_strings) x;
  -- Every field/identity is evaluated before a winner can authorize a denial.
  -- Section identity is independent internally; only its real containing
  -- revision is emitted under the existing summary_revision audit vocabulary.
  for cell in
    with scoped_summary as (
      select s.*,coalesce(s.current_revision_id,(select r.summary_revision_id from content.summary_revision r
        where r.summary_id=s.summary_id order by r.revision_number desc,r.summary_revision_id limit 1)) as audit_revision
      from content.summary s where s.guide_explorer_relationship_id=p_relationship_id
    ), scoped_revision as (
      select r.*,s.summary_status,s.current_revision_id from content.summary_revision r
      join scoped_summary s on s.summary_id=r.summary_id
    ), eligible_section as (
      select sec.summary_section_id from content.summary_section sec
      join scoped_revision r on r.summary_revision_id=sec.summary_revision_id
      where r.summary_status='published' and r.current_revision_id=r.summary_revision_id
        and r.revision_status='published_to_explorer' and sec.section_type='explorer_facing'
        and sec.visibility='published_to_explorer' and exists(select 1 from content.summary_publication pub
          where pub.summary_id=r.summary_id and pub.summary_revision_id=r.summary_revision_id
            and pub.published_to_explorer_profile_id=p_explorer_profile_id and pub.publication_status='published')
    )
    select 'trigger_observation'::text as audit_type,t.trigger_observation_id as audit_id,
      t.trigger_observation_id as source_id,'trigger_observation'::text as source_type,f.field,f.value,false as eligible
    from content.trigger_observation t cross join lateral (values
      ('identity',null::text),('trigger_label',t.trigger_label),('observation_text',t.observation_text)) f(field,value)
      where t.guide_explorer_relationship_id=p_relationship_id
    union all
    select 'trigger_observation',t.trigger_observation_id,t.trigger_observation_id,'trigger_observation',
      'metadata/'||pg_catalog.array_to_string(j.field_path,'/'),j.field_text,false
    from content.trigger_observation t cross join lateral ai.solmind_exclusion_strings_v3(t.metadata::json,true) j
      where t.guide_explorer_relationship_id=p_relationship_id
    union all
    select 'summary_revision',r.summary_revision_id,r.summary_revision_id,'summary_revision',f.field,f.value,
      f.field='identity' and exists(select 1 from content.summary_section sec join eligible_section e
        on e.summary_section_id=sec.summary_section_id where sec.summary_revision_id=r.summary_revision_id)
      from scoped_revision r cross join lateral (values
        ('identity',null::text),('content_markdown',r.content_markdown),('ai_change_summary',r.ai_change_summary)) f(field,value)
    union all
    select 'summary_revision',r.summary_revision_id,r.summary_revision_id,'summary_revision',
      'metadata/'||pg_catalog.array_to_string(j.field_path,'/'),j.field_text,false
      from scoped_revision r cross join lateral ai.solmind_exclusion_strings_v3(r.metadata::json,true) j
    union all
    select 'summary_revision',r.summary_revision_id,sec.summary_section_id,'summary_section',f.field,f.value,
      exists(select 1 from eligible_section e where e.summary_section_id=sec.summary_section_id)
      from content.summary_section sec join scoped_revision r on r.summary_revision_id=sec.summary_revision_id
      cross join lateral (values ('identity',null::text),('section_title',sec.section_title),('content_markdown',sec.content_markdown)) f(field,value)
    union all
    select 'summary_revision',s.audit_revision,s.summary_id,'summary','identity',null::text,false from scoped_summary s
    union all
    select 'summary_revision',s.audit_revision,s.summary_id,'summary','metadata/'||pg_catalog.array_to_string(j.field_path,'/'),j.field_text,false
      from scoped_summary s cross join lateral ai.solmind_exclusion_strings_v3(s.metadata::json,true) j
  loop
    seen:=seen+1;
    max_bytes:=coalesce(pg_catalog.octet_length(cell.value),0);
    total_bytes:=total_bytes+max_bytes;
    if seen>4096 or max_bytes>262144 or total_bytes>4194304 then return next; return; end if;
    matched:=cell.field='identity' and (cell.source_id=any(p_context_source_ids) or exists(
      select 1 from pg_catalog.unnest(source_lower) x where pg_catalog.strpos(x,cell.source_id::text)>0));
    if cell.value is not null then
      matched:=matched or ai.solmind_exclusion_fingerprint_v3(cell.value)=any(source_hashes);
    end if;
    if matched and not cell.eligible then
      if cell.audit_id is null then unknown_match:=true;
      else
        candidate_key:=cell.source_type||'|'||cell.source_id::text||'|'||cell.field;
        if winner_key is null or candidate_key<winner_key then
          winner_key:=candidate_key; winner_type:=cell.audit_type; winner_id:=cell.audit_id;
        end if;
      end if;
    end if;
  end loop;
  -- Private evidence is structurally excluded. The following exact ID check
  -- refuses without inventing a compatible exclusion-audit category. Root's
  -- common actor-owner lock serializes its private evidence writers.
  for private_id in execute 'select e.explorer_safety_evidence_id from ai.explorer_safety_evidence e '
    ||'join ai.ai_interaction_session s on s.ai_interaction_session_id=e.conversation_id '
    ||'where s.guide_explorer_relationship_id=$1' using p_relationship_id
  loop
    seen:=seen+1;
    if seen>4096 then return next; return; end if;
    if private_id=any(p_context_source_ids) or exists(select 1 from pg_catalog.unnest(source_lower) x
      where pg_catalog.strpos(x,private_id::text)>0) then unknown_match:=true; end if;
  end loop;
  if unknown_match then return next; return; end if;
  if winner_key is not null then
    outcome:='blocked'; excluded_entity_type:=winner_type; excluded_entity_id:=winner_id;
  else outcome:='clear'; end if;
  return next;
exception when others then
  -- No details/content from parse, shape, lock, schema or privilege failures.
  -- Cancellation propagates naturally and never becomes permission.
  return query select 'unavailable'::text,null::text,null::uuid;
end $$;

create or replace function methodology.serialized_methodology_valid(p_serialized text,p_version uuid,p_content text)
returns boolean language plpgsql immutable set search_path='' as $$
declare envelope json; subject json; keys text[];
begin
  if p_serialized is null or octet_length(p_serialized) not between 2 and 524288 or p_version is null or p_content is null
    then return false; end if;
  envelope:=p_serialized::json;
  if json_typeof(envelope) is distinct from 'object' then return false; end if;
  -- json preserves duplicate keys; jsonb would erase this evidence first.
  select array_agg(key order by key) into keys from json_each(envelope);
  -- Exactly two key sets, each tied to its own version: the existing envelope, or the
  -- same envelope plus the saved Compass and Waypoint section (chat step slice S3).
  if not coalesce((keys=array['actorRoleContext','aiRole','approvedContinuity','contractVersion','crisisBehavior',
        'currentSessionMessages','globalPolicy','immediateExplorerMessage','methodologyContext','outputRequirements',
        'roleBehavior','sessionContext']::text[]
      and envelope->>'contractVersion'='wi007-v0.1+onboarding-fields-v2')
    or (keys=array['actorRoleContext','aiRole','approvedContinuity','compassContext','contractVersion','crisisBehavior',
        'currentSessionMessages','globalPolicy','immediateExplorerMessage','methodologyContext','outputRequirements',
        'roleBehavior','sessionContext']::text[]
      and envelope->>'contractVersion'='wi007-v0.1+onboarding-fields-v2+compass-v2'),false)
    or json_typeof(envelope->'contractVersion') is distinct from 'string'
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
-- Extend v4 in place at its API name; the default preserves callers without suggestions.
drop function public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb);
create function public.solmind_settle_explorer_conversation_turn_v4(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_status text,p_reply_message_id uuid,p_reply_kind text,p_reply_body text,
  p_model_level smallint,p_model_minor_indicated boolean,p_protocol_version text,p_request_mode text,
  p_configuration_fingerprint text,p_fallback_policy_version text,p_model_policy_version text,
  p_trusted_response_version text,p_resource_policy_version text,p_fallback_level smallint,
  p_fallback_minor_indicated boolean,p_delivery_interested boolean,p_attention_item_id uuid,p_choices jsonb,p_compass_suggestions jsonb default null
) returns table(outcome text,conversation_state jsonb,policy_state jsonb,saved_reply boolean)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare st ai.explorer_conversation_state%rowtype; op ai.explorer_conversation_operation%rowtype;
  a jsonb; intent text; h text; observed_fallback text; ts timestamptz; n integer;
  may_return boolean:=false; may_save boolean:=false; saved_id uuid; saved_body text; saved_kind text:='none';
  saved_choices jsonb; followed_id uuid; followed_operation_id uuid; followed_label text; follow_hash text; follow_bytes bytea; followed_formation text; suggestion jsonb; suggestion_label text; suggestion_id uuid; suggestion_index integer:=0; item_count integer;
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
    p_delivery_interested,p_attention_item_id,p_choices)||case when p_compass_suggestions is null then '[]'::jsonb else jsonb_build_array(p_compass_suggestions) end);
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
    error_summary=case when p_model_level is null and p_status='failed' then 'provider_unavailable' else null end
    where ai_model_invocation_id=op.invocation_id;
  h:=methodology.hash_json(jsonb_build_array(intent,saved_id,saved_kind,saved_body,saved_choices,followed_id));
  update ai.explorer_conversation_operation set status=p_status,completed_at=ts,terminal_fingerprint=h,reply_message_id=saved_id,followed_attention_item_id=followed_id
    where actor_user_account_id=p_actor_user_account_id and operation_id=p_operation_id;
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
alter function public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb) owner to postgres;
revoke all on function public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb) to service_role;

-- Private S6 groundwork only: no public RPC, service grant, browser command,
-- typed-reply inference or provider authority to confirm/reject a suggestion.
create function ai.solmind_resolve_forming_compass_point(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_expected_revision integer,p_item_id uuid,p_expected_label text,p_wording_message_id uuid,
  p_resolution text,p_command_fingerprint text
) returns table(outcome text,conversation_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; st ai.explorer_conversation_state%rowtype; point ai.explorer_conversation_compass_item%rowtype;
  op ai.explorer_conversation_operation%rowtype; origin ai.explorer_conversation_operation%rowtype;
  h text; kind_name text; ts timestamptz; follow_hash text; follow_bytes bytea; follow_id uuid;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_conversation_id is null or p_operation_id is null or p_expected_revision is null or p_expected_revision<0
    or p_item_id is null or p_wording_message_id is null or not ai.solmind_compass_suggestion_label_valid(p_expected_label)
    or p_resolution is null or p_resolution not in ('confirmed','rejected')
    or p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$'
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  kind_name:=case when p_resolution='confirmed' then 'confirm_compass_point' else 'reject_compass_point' end;
  h:=methodology.hash_json(jsonb_build_array('explorer-compass-resolution.v1',p_user_session_id,p_conversation_id,
    p_expected_revision,p_item_id,p_expected_label,p_wording_message_id,p_resolution,p_command_fingerprint));
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  select s.* into st from ai.explorer_conversation_state s where s.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id
    then raise exception 'solmind_explorer_private_denied'; end if;
  select o.* into op from ai.explorer_conversation_operation o
    where o.actor_user_account_id=p_actor_user_account_id and o.operation_id=p_operation_id for update;
  if found then
    if op.request_fingerprint is distinct from h or op.command_fingerprint is distinct from p_command_fingerprint
      or op.kind is distinct from kind_name or op.conversation_id is distinct from p_conversation_id
      or op.application_session_id is distinct from p_user_session_id or op.status is distinct from 'completed'
      then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
    return query select 'exact_replay'::text,ai.solmind_conversation_state_json(p_conversation_id); return;
  end if;
  if ai.solmind_private_policy_v3(p_conversation_id)->'known' is distinct from 'true'::jsonb
    or st.restricted_level is not null or st.adult_reflection_stopped then raise exception 'solmind_explorer_private_denied'; end if;
  if st.revision<>p_expected_revision then return query select 'stale_revision'::text,null::jsonb; return; end if;
  if st.pending_operation_id is not null then return query select 'unavailable'::text,null::jsonb; return; end if;
  select c.* into point from ai.explorer_conversation_compass_item c
    where c.conversation_id=p_conversation_id and c.item_id=p_item_id for update;
  if not found or point.formation_status is distinct from 'proposed' or point.merged_into_item_id is not null
    or point.label is distinct from p_expected_label or point.wording_message_id is distinct from p_wording_message_id
    or point.compass_anchor is not null or point.relative_emphasis is not null or st.priority_id=p_item_id
    then raise exception 'solmind_explorer_private_formation_conflict'; end if;
  if p_resolution='rejected' and (select count(*) from ai.explorer_conversation_compass_item c
    where c.conversation_id=p_conversation_id and c.formation_status='rejected')>=24
    then return query select 'unavailable'::text,null::jsonb; return; end if;
  ts:=clock_timestamp();
  update ai.explorer_conversation_compass_item set formation_status=p_resolution
    where conversation_id=p_conversation_id and item_id=p_item_id;
  if p_resolution='confirmed' then
    for origin in select o.* from ai.explorer_conversation_operation o
      where o.actor_user_account_id=p_actor_user_account_id
        and o.conversation_id=p_conversation_id and o.status='completed'
        and o.followed_attention_item_id=p_item_id
        and ((o.kind='send' and o.reply_message_id is not null and o.safety_protocol_version='explorer-safety-reply.v2')
          or (o.kind='set_attention' and o.compass_route_kind is null and o.origin_operation_id is null))
        and not exists(select 1 from ai.explorer_conversation_operation followed where followed.actor_user_account_id=p_actor_user_account_id and followed.origin_operation_id=o.operation_id)
      order by o.initial_revision,o.operation_id loop
    follow_hash:=methodology.hash_json(jsonb_build_array('explorer-follow-attention.v1',p_actor_user_account_id,
      origin.application_session_id,p_conversation_id,origin.operation_id,p_item_id));
    follow_bytes:=substring(extensions.digest(convert_to('explorer-follow-attention-operation.v1|'||p_actor_user_account_id::text||'|'||origin.operation_id::text,'UTF8'),'sha256') from 1 for 16);
    follow_bytes:=set_byte(set_byte(follow_bytes,6,(get_byte(follow_bytes,6)&15)|80),8,(get_byte(follow_bytes,8)&63)|128);
    follow_id:=encode(follow_bytes,'hex')::uuid;
    insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
      conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,
      compass_route_kind,compass_route_item_id,compass_route_label,origin_operation_id)
      values(p_actor_user_account_id,follow_id,origin.application_session_id,p_conversation_id,
        case when origin.kind='send' then 'follow_attention' else 'set_attention' end,
        follow_hash,follow_hash,origin.initial_revision+case when origin.kind='send' then 1 else 0 end,
        'completed',origin.completed_at,'attention_changed',p_item_id,point.label,origin.operation_id);
    end loop;
  end if;
  if st.attention_id=p_item_id and p_resolution='rejected' then
    update ai.explorer_conversation_state set attention_id=null where conversation_id=p_conversation_id;
  end if;
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,
    kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,kind_name,h,p_command_fingerprint,
      p_expected_revision,'completed',ts);
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id);
end $$;
alter function ai.solmind_resolve_forming_compass_point(uuid,uuid,uuid,uuid,integer,uuid,text,uuid,text,text) owner to postgres;
revoke all on function ai.solmind_resolve_forming_compass_point(uuid,uuid,uuid,uuid,integer,uuid,text,uuid,text,text) from public,anon,authenticated,service_role;

commit;
