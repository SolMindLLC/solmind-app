-- Lane 7: account-wide active places, bounded conversation history and private
-- post-End closure. Deploy with the required capacity/partial-state app contract.
-- Existing facts are retained; no backfill, deletion or count-based rejection.
begin;

-- Retained-data preflight checks ownership and lineage only. Counts above the
-- new active allowance (or history guard) are deliberately not migration errors.
-- No retained value is changed and there is no lifetime storage ceiling.
do $$
begin
  if exists(select 1 from content.waypoint w
    join ai.ai_interaction_session s on s.ai_interaction_session_id=w.source_ai_interaction_session_id
    where w.chosen_by_explorer_user_account_id is not null
      and (w.chosen_by_explorer_user_account_id is distinct from s.actor_user_account_id
        or w.guide_explorer_relationship_id is distinct from s.guide_explorer_relationship_id))
    or exists(select 1 from content.waypoint w join content.waypoint predecessor on predecessor.waypoint_id=w.predecessor_waypoint_id
      where w.chosen_by_explorer_user_account_id is distinct from predecessor.chosen_by_explorer_user_account_id
        or w.source_ai_interaction_session_id is distinct from predecessor.source_ai_interaction_session_id)
    then raise exception 'solmind_waypoint_retained_provenance_invalid'; end if;
end $$;

create function ai.solmind_waypoint_policy_v1()
returns table(active_limit integer,history_limit integer)
language sql immutable security definer set search_path='' as $$
  select 20,200
$$;
alter function ai.solmind_waypoint_policy_v1() owner to postgres;
revoke all on function ai.solmind_waypoint_policy_v1() from public,anon,authenticated,service_role;

create index waypoint_owner_current_capacity on content.waypoint
  (chosen_by_explorer_user_account_id,created_at desc,waypoint_id)
  where lifecycle_status='chosen' and released_at is null;
create index waypoint_conversation_history_page on content.waypoint
  (source_ai_interaction_session_id,created_at desc,waypoint_id);

create table content.waypoint_post_end_closure (
  waypoint_id uuid primary key references content.waypoint(waypoint_id),
  source_conversation_id uuid not null references ai.ai_interaction_session(ai_interaction_session_id),
  actor_user_account_id uuid not null references identity.user_account(user_account_id),
  application_session_id uuid not null references identity.user_session(user_session_id),
  operation_id uuid not null,
  kind text not null check(kind in ('reach_waypoint','release_waypoint')),
  reached_evidence text null,
  request_fingerprint text not null check(request_fingerprint ~ '^[0-9A-F]{64}$'),
  command_fingerprint text not null check(command_fingerprint ~ '^[0-9A-F]{64}$'),
  completed_at timestamptz not null,
  retention_class text not null default 'sensitive_content' check(retention_class='sensitive_content'),
  unique(actor_user_account_id,operation_id),
  foreign key(source_conversation_id,waypoint_id)
    references content.waypoint(source_ai_interaction_session_id,waypoint_id),
  check((kind='reach_waypoint' and reached_evidence is not null
      and ai.solmind_conversation_text_valid(reached_evidence,1000,false))
    or (kind='release_waypoint' and reached_evidence is null))
);
alter table content.waypoint_post_end_closure enable row level security;
alter table content.waypoint_post_end_closure owner to postgres;
revoke all on content.waypoint_post_end_closure from public,anon,authenticated,service_role;
comment on table content.waypoint_post_end_closure is
  'One private append-only terminal fact on an owned current head after End. Original conversation, ending, Route and Waypoint history are never rewritten.';
create function content.solmind_waypoint_post_end_closure_immutable_v1() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'solmind_explorer_private_immutable'; end $$;
alter function content.solmind_waypoint_post_end_closure_immutable_v1() owner to postgres;
revoke all on function content.solmind_waypoint_post_end_closure_immutable_v1() from public,anon,authenticated,service_role;
create trigger waypoint_post_end_closure_immutable before update or delete on content.waypoint_post_end_closure
for each row execute function content.solmind_waypoint_post_end_closure_immutable_v1();

-- The only active-count definition. Guide suggestions, drafts, predecessors and
-- both ordinary and post-End terminal facts never occupy an active place.
create function ai.solmind_waypoint_active_count_v1(p_actor uuid)
returns bigint language sql stable security definer set search_path='' as $$
  select count(*) from content.waypoint w
  where w.chosen_by_explorer_user_account_id=p_actor and w.lifecycle_status='chosen' and w.released_at is null
    and not exists(select 1 from content.waypoint s where s.predecessor_waypoint_id=w.waypoint_id)
    and not exists(select 1 from content.waypoint_post_end_closure c where c.waypoint_id=w.waypoint_id)
$$;
alter function ai.solmind_waypoint_active_count_v1(uuid) owner to postgres;
revoke all on function ai.solmind_waypoint_active_count_v1(uuid) from public,anon,authenticated,service_role;

create function ai.solmind_waypoint_capacity_v1(p_actor uuid,p_conversation uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('activeCount',ai.solmind_waypoint_active_count_v1(p_actor),
    'activeLimit',p.active_limit,'historyRoom',(select count(*) from content.waypoint w
      where w.source_ai_interaction_session_id=p_conversation)<p.history_limit)
  from ai.solmind_waypoint_policy_v1() p
$$;
alter function ai.solmind_waypoint_capacity_v1(uuid,uuid) owner to postgres;
revoke all on function ai.solmind_waypoint_capacity_v1(uuid,uuid) from public,anon,authenticated,service_role;

create function ai.solmind_waypoint_insert_allowed_v1(p_actor uuid,p_conversation uuid,p_increases_active boolean)
returns boolean language sql stable security definer set search_path='' as $$
  select p_actor is not null and p_conversation is not null and p_increases_active is not null
    and (select count(*) from content.waypoint w where w.source_ai_interaction_session_id=p_conversation)<p.history_limit
    and (not p_increases_active or ai.solmind_waypoint_active_count_v1(p_actor)<p.active_limit)
  from ai.solmind_waypoint_policy_v1() p
$$;
alter function ai.solmind_waypoint_insert_allowed_v1(uuid,uuid,boolean) owner to postgres;
revoke all on function ai.solmind_waypoint_insert_allowed_v1(uuid,uuid,boolean) from public,anon,authenticated,service_role;

-- Reconstruct bounded display rows. Historical conversation state passes false:
-- its status is exactly the status recorded at End, not the later portfolio fact.
create function ai.solmind_waypoint_row_json_v1(p_waypoint uuid,p_effective boolean)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',w.waypoint_id,'sourceMessageId',w.source_message_id,'title',w.title,
    'createdAt',w.created_at,'isCurrent',not exists(select 1 from content.waypoint s where s.predecessor_waypoint_id=w.waypoint_id),
    'destination',w.destination,'meaning',w.why_it_matters,'arrivalSignal',w.arrival_signal,
    'status',case when c.kind='reach_waypoint' then 'reached' else w.lifecycle_status end,
    'reachedEvidence',case when c.kind='reach_waypoint' then c.reached_evidence else w.reached_evidence end,
    'reachedAt',case when c.kind='reach_waypoint' then c.completed_at else w.reached_at end)
    || case when w.released_at is null and c.kind is distinct from 'release_waypoint' then '{}'::jsonb
      else jsonb_build_object('release',jsonb_build_object('operationId',coalesce(c.operation_id,w.released_operation_id),
        'releasedAt',coalesce(c.completed_at,w.released_at))) end
    || case when w.predecessor_waypoint_id is null then '{}'::jsonb else jsonb_build_object('lifecycle',
      jsonb_build_object('predecessorWaypointId',w.predecessor_waypoint_id,'creationReason',w.creation_reason,
        'clarifications',coalesce((select jsonb_agg(jsonb_build_object('component',q.component,'questionKey',q.question_key,
          'answer',q.answer_text,'recordedAt',q.created_at) order by case q.component when 'destination' then 1 when 'meaning' then 2 else 3 end)
          from content.waypoint_clarification q where q.waypoint_id=w.waypoint_id),'[]'::jsonb))) end
  from content.waypoint w left join content.waypoint_post_end_closure c on c.waypoint_id=w.waypoint_id and p_effective
  where w.waypoint_id=p_waypoint
$$;
alter function ai.solmind_waypoint_row_json_v1(uuid,boolean) owner to postgres;
revoke all on function ai.solmind_waypoint_row_json_v1(uuid,boolean) from public,anon,authenticated,service_role;

-- Current authority and original provenance are separate checks. A historical
-- relationship may be ended/transferred; neither its Guide nor any current Guide
-- receives these rows. The existing conversation-history authority is unchanged.
create function ai.solmind_waypoint_original_owner_v1(p_actor uuid,p_conversation uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from ai.ai_interaction_session s
    join ai.explorer_conversation_state st on st.conversation_id=s.ai_interaction_session_id
    join core.explorer_profile e on e.explorer_profile_id=s.explorer_profile_id
    join core.guide_explorer_relationship r on r.guide_explorer_relationship_id=s.guide_explorer_relationship_id
    where s.ai_interaction_session_id=p_conversation and s.actor_user_account_id=p_actor
      and st.actor_user_account_id=p_actor and e.user_account_id=p_actor
      and r.explorer_profile_id=s.explorer_profile_id and r.practice_id=s.practice_id
      and s.actor_role_context='explorer' and s.session_type='explorer_reflection'
      and s.session_status in ('active','ended') and jsonb_typeof(s.metadata)='object')
$$;
alter function ai.solmind_waypoint_original_owner_v1(uuid,uuid) owner to postgres;
revoke all on function ai.solmind_waypoint_original_owner_v1(uuid,uuid) from public,anon,authenticated,service_role;

create function ai.solmind_waypoint_source_owned_v1(p_actor uuid,p_waypoint uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from content.waypoint w
    join ai.ai_interaction_session s on s.ai_interaction_session_id=w.source_ai_interaction_session_id
    join ai.ai_interaction_message m on m.ai_interaction_message_id=w.source_message_id
      and m.ai_interaction_session_id=s.ai_interaction_session_id
    where w.waypoint_id=p_waypoint and w.chosen_by_explorer_user_account_id=p_actor
      and w.guide_explorer_relationship_id=s.guide_explorer_relationship_id
      and ai.solmind_waypoint_original_owner_v1(p_actor,s.ai_interaction_session_id)
      and ((m.sender_type='user' and m.sender_user_account_id=p_actor and m.sender_role_context='explorer')
        or (m.sender_type='ai' and m.ai_role='solmind_virtual_guide' and m.sender_user_account_id is null)))
$$;
alter function ai.solmind_waypoint_source_owned_v1(uuid,uuid) owner to postgres;
revoke all on function ai.solmind_waypoint_source_owned_v1(uuid,uuid) from public,anon,authenticated,service_role;

create function ai.solmind_waypoint_page_v1(p_actor uuid,p_conversation uuid,p_offset integer,p_heads boolean)
returns jsonb language sql stable security definer set search_path='' as $$
  with page as (
    select w.*,row_number() over(order by
      case when p_heads and w.lifecycle_status='chosen' and w.released_at is null and c.waypoint_id is null then 0 else 1 end,
      w.created_at desc,w.waypoint_id) as ordinal
    from content.waypoint w left join content.waypoint_post_end_closure c on c.waypoint_id=w.waypoint_id
    where w.chosen_by_explorer_user_account_id=p_actor
      and (p_conversation is null or w.source_ai_interaction_session_id=p_conversation)
      and (not p_heads or not exists(select 1 from content.waypoint s where s.predecessor_waypoint_id=w.waypoint_id))
      and ai.solmind_waypoint_source_owned_v1(p_actor,w.waypoint_id)
    order by ordinal offset p_offset limit 21
  ) select jsonb_build_object('kind',case when p_heads then 'current_heads' else 'history' end,'limit',20,
    'items',coalesce((select jsonb_agg(ai.solmind_waypoint_row_json_v1(p.waypoint_id,true)
      ||jsonb_build_object('conversationId',p.source_ai_interaction_session_id) order by p.ordinal)
      from page p where p.ordinal<=p_offset+20),'[]'::jsonb),
    'hasMore',(select count(*)>20 from page),
    'nextOffset',case when (select count(*)>20 from page) then p_offset+20 else null end)
$$;
alter function ai.solmind_waypoint_page_v1(uuid,uuid,integer,boolean) owner to postgres;
revoke all on function ai.solmind_waypoint_page_v1(uuid,uuid,integer,boolean) from public,anon,authenticated,service_role;

create function public.solmind_read_explorer_waypoint_heads_v1(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_offset integer
) returns table(outcome text,waypoint_page jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; result jsonb;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_offset is null or p_offset<0 or p_offset>2147483627 then raise exception 'solmind_explorer_private_invalid_input'; end if;
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,null);
  result:=ai.solmind_waypoint_page_v1(p_actor_user_account_id,null,p_offset,true);
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'ok'::text,result;
end $$;
alter function public.solmind_read_explorer_waypoint_heads_v1(uuid,uuid,integer) owner to postgres;
revoke all on function public.solmind_read_explorer_waypoint_heads_v1(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.solmind_read_explorer_waypoint_heads_v1(uuid,uuid,integer) to service_role;

create function public.solmind_read_explorer_waypoint_history_v1(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_offset integer
) returns table(outcome text,waypoint_page jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; result jsonb;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_conversation_id is null or p_offset is null or p_offset<0 or p_offset>2147483627
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,null);
  if not ai.solmind_waypoint_original_owner_v1(p_actor_user_account_id,p_conversation_id)
    then raise exception 'solmind_explorer_private_denied'; end if;
  result:=ai.solmind_waypoint_page_v1(p_actor_user_account_id,p_conversation_id,p_offset,false);
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'ok'::text,result;
end $$;
alter function public.solmind_read_explorer_waypoint_history_v1(uuid,uuid,uuid,integer) owner to postgres;
revoke all on function public.solmind_read_explorer_waypoint_history_v1(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.solmind_read_explorer_waypoint_history_v1(uuid,uuid,uuid,integer) to service_role;

create function public.solmind_close_ended_explorer_waypoint_v1(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_waypoint_id uuid,p_operation_id uuid,
  p_command_fingerprint text,p_kind text,p_reached_evidence text
) returns table(outcome text,waypoint_page jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; w content.waypoint%rowtype; prior content.waypoint_post_end_closure%rowtype;
  s ai.ai_interaction_session%rowtype; policy jsonb; h text; ts timestamptz; result_outcome text:='ok';
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_waypoint_id is null or p_operation_id is null or p_kind is null or p_kind not in ('reach_waypoint','release_waypoint')
    or p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$'
    or (p_kind='reach_waypoint' and (p_reached_evidence is null or not ai.solmind_conversation_text_valid(p_reached_evidence,1000,false)))
    or (p_kind='release_waypoint' and p_reached_evidence is not null)
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,null);
  select x.* into w from content.waypoint x where x.waypoint_id=p_waypoint_id for update;
  if not found or not ai.solmind_waypoint_source_owned_v1(p_actor_user_account_id,p_waypoint_id)
    then raise exception 'solmind_explorer_private_denied'; end if;
  select x.* into s from ai.ai_interaction_session x where x.ai_interaction_session_id=w.source_ai_interaction_session_id for update;
  if not found or s.session_status is distinct from 'ended' or s.ended_at is null
    then raise exception 'solmind_explorer_private_denied'; end if;
  h:=methodology.hash_json(jsonb_build_array('explorer-waypoint-post-end-closure.v1',p_user_session_id,
    p_waypoint_id,p_kind,p_reached_evidence,p_command_fingerprint));
  select x.* into prior from content.waypoint_post_end_closure x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id for update;
  if found then
    if prior.waypoint_id is distinct from p_waypoint_id or prior.source_conversation_id is distinct from s.ai_interaction_session_id
      or prior.application_session_id is distinct from p_user_session_id or prior.kind is distinct from p_kind
      or prior.request_fingerprint is distinct from h or prior.command_fingerprint is distinct from p_command_fingerprint
      or prior.reached_evidence is distinct from p_reached_evidence then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    result_outcome:='exact_replay';
  else
    if exists(select 1 from ai.explorer_conversation_operation o where o.actor_user_account_id=p_actor_user_account_id and o.operation_id=p_operation_id)
      or exists(select 1 from content.waypoint_post_end_closure c where c.waypoint_id=p_waypoint_id)
      or exists(select 1 from content.waypoint x where x.predecessor_waypoint_id=p_waypoint_id)
      or w.lifecycle_status is distinct from 'chosen' or w.released_at is not null
      then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    if p_kind='reach_waypoint' then
      policy:=ai.solmind_private_policy_v3(s.ai_interaction_session_id);
      if policy->'known' is distinct from 'true'::jsonb or policy->'restrictedLevel' is distinct from 'null'::jsonb
        or policy->'adultReflectionStopped' is distinct from 'false'::jsonb then raise exception 'solmind_explorer_private_denied'; end if;
      -- An older clear conversation cannot bypass a current reflection hold.
      if exists(select 1 from ai.ai_interaction_session current_session
        cross join lateral (select ai.solmind_private_policy_v3(current_session.ai_interaction_session_id) value) current_policy
        where current_session.actor_user_account_id=p_actor_user_account_id
          and current_session.actor_role_context='explorer' and current_session.session_type='explorer_reflection'
          and current_session.session_status='active' and (current_policy.value->'known' is distinct from 'true'::jsonb
            or current_policy.value->'restrictedLevel' is distinct from 'null'::jsonb
            or current_policy.value->'adultReflectionStopped' is distinct from 'false'::jsonb))
        then raise exception 'solmind_explorer_private_denied'; end if;
    end if;
    ts:=clock_timestamp();
    insert into content.waypoint_post_end_closure(waypoint_id,source_conversation_id,actor_user_account_id,
      application_session_id,operation_id,kind,reached_evidence,request_fingerprint,command_fingerprint,completed_at)
      values(p_waypoint_id,s.ai_interaction_session_id,p_actor_user_account_id,p_user_session_id,p_operation_id,
        p_kind,p_reached_evidence,h,p_command_fingerprint,ts);
    insert into audit.audit_event(event_type,actor_user_account_id,actor_role_context,target_entity_type,target_entity_id,
      action,reason_code,event_summary,metadata,ip_address,user_agent,created_at)
      values(case p_kind when 'reach_waypoint' then 'waypoint_reached' else 'waypoint_released' end,
        p_actor_user_account_id,'explorer','waypoint',p_waypoint_id,
        case p_kind when 'reach_waypoint' then 'reach' else 'release' end,
        case p_kind when 'reach_waypoint' then 'explorer_reached_waypoint' else 'explorer_released_waypoint' end,
        'Explorer closed a private Waypoint after End.','{}',null,null,ts);
  end if;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
  return query select result_outcome,jsonb_build_object('kind','closure','limit',20,
    'items',jsonb_build_array(ai.solmind_waypoint_row_json_v1(p_waypoint_id,true)
      ||jsonb_build_object('conversationId',s.ai_interaction_session_id)),'hasMore',false,'nextOffset',null);
end $$;
alter function public.solmind_close_ended_explorer_waypoint_v1(uuid,uuid,uuid,uuid,text,text,text) owner to postgres;
revoke all on function public.solmind_close_ended_explorer_waypoint_v1(uuid,uuid,uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.solmind_close_ended_explorer_waypoint_v1(uuid,uuid,uuid,uuid,text,text,text) to service_role;

-- Existing insertion/state/context owners follow. Capacity gates, partial display
-- selection and compass-v6 change; the internal mutate and draft helper also take
-- the re-entrant account owner lock. Other behavior and settings are retained from
-- their latest definitions.
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
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
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
    if not ai.solmind_waypoint_insert_allowed_v1(p_actor_user_account_id,p_conversation_id,true) then
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
  if not ai.solmind_waypoint_insert_allowed_v1(p_actor_user_account_id,p_conversation_id,p_kind='revisit_waypoint') then
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

create or replace function ai.solmind_apply_waypoint_draft_response(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_request_fingerprint text,p_command_fingerprint text,p_draft_id uuid,p_response text,
  p_completed_at timestamptz,p_typed boolean
) returns boolean language plpgsql volatile security invoker set search_path='' as $$
declare st ai.explorer_conversation_state%rowtype; draft content.waypoint_draft%rowtype;
  waypoint_bytes bytea; new_waypoint_id uuid;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  select s.* into st from ai.explorer_conversation_state s where s.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id
    or st.pending_operation_id is not null or st.restricted_level is not null or st.adult_reflection_stopped
    or p_response is null or p_response not in ('right','close','not_it') then return false; end if;
  select d.* into draft from content.waypoint_draft d
    where d.source_ai_interaction_session_id=p_conversation_id and d.waypoint_draft_id=p_draft_id for update;
  if not found or draft.draft_status is distinct from 'proposed' then return false; end if;
  if (p_response='not_it' and (select count(*) from content.waypoint_draft d
      where d.source_ai_interaction_session_id=p_conversation_id and d.draft_status='rejected')>=24)
    or (p_response='right' and (not ai.solmind_waypoint_insert_allowed_v1(p_actor_user_account_id,p_conversation_id,true)
      or ai.solmind_waypoint_draft_text_valid(draft.title) is not true
      or ai.solmind_waypoint_draft_text_valid(draft.destination) is not true
      or ai.solmind_waypoint_draft_text_valid(draft.why_it_matters) is not true
      or ai.solmind_waypoint_draft_text_valid(draft.arrival_signal) is not true))
    then return false; end if;
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,
    kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,
    waypoint_suggestion_draft_id,waypoint_suggestion_response,waypoint_suggestion_typed)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,'respond_waypoint_draft',
      p_request_fingerprint,p_command_fingerprint,st.revision,'completed',p_completed_at,p_draft_id,p_response,p_typed);
  if p_response='right' then
    waypoint_bytes:=substring(extensions.digest(convert_to('explorer-waypoint-draft-confirm.v1|'||p_actor_user_account_id::text
      ||'|'||p_operation_id::text,'UTF8'),'sha256') from 1 for 16);
    waypoint_bytes:=set_byte(set_byte(waypoint_bytes,6,(get_byte(waypoint_bytes,6)&15)|80),8,(get_byte(waypoint_bytes,8)&63)|128);
    new_waypoint_id:=encode(waypoint_bytes,'hex')::uuid;
    insert into content.waypoint(waypoint_id,guide_explorer_relationship_id,source_ai_interaction_session_id,source_message_id,
      title,destination,why_it_matters,arrival_signal,lifecycle_status,chosen_by_explorer_user_account_id,chosen_at,
      suggested_by_actor_type,suggestion_draft_id,suggestion_message_id)
      values(new_waypoint_id,draft.guide_explorer_relationship_id,p_conversation_id,draft.source_message_id,
        draft.title,draft.destination,draft.why_it_matters,draft.arrival_signal,'chosen',p_actor_user_account_id,p_completed_at,
        'solmind_virtual_guide',p_draft_id,draft.suggestion_message_id);
  end if;
  if p_response in ('right','not_it') then
    update content.waypoint_draft set draft_status=case when p_response='right' then 'confirmed' else 'rejected' end
      where waypoint_draft_id=p_draft_id;
  end if;
  return true;
end $$;

create or replace function ai.solmind_conversation_state_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('version','explorer-conversation.v1','conversationId',p_id,
    'revision',coalesce(s.revision,0),'providerState','unavailable',
    'pendingTurn',s.pending_operation_id is not null,
    'turnedDownLimitReached',(select count(*)>=24 from ai.explorer_conversation_compass_item c
      where c.conversation_id=p_id and c.formation_status='rejected'),
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
      'label',c.label,'anchor',c.compass_anchor,'emphasis',c.relative_emphasis,'mergedIntoItemId',c.merged_into_item_id,'formation',case when c.formation_status='proposed' then 'forming' else 'saved' end)
      || case when c.formation_status='proposed' then jsonb_build_object('wordingMessageId',c.wording_message_id) else '{}'::jsonb end
      order by c.display_order) from ai.explorer_conversation_compass_item c where c.conversation_id=p_id and c.formation_status is distinct from 'rejected'),'[]'::jsonb),
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
    'waypointDraft',(select jsonb_build_object('id',d.waypoint_draft_id,'title',d.title,
      'destination',d.destination,'whyItMatters',d.why_it_matters,'arrivalSignal',d.arrival_signal,
      'suggestionMessageId',d.suggestion_message_id) from content.waypoint_draft d
      where d.source_ai_interaction_session_id=p_id and d.draft_status='proposed'),
    'waypointCapacity',case when s.actor_user_account_id is null then null
      else ai.solmind_waypoint_capacity_v1(s.actor_user_account_id,p_id) end,
    'waypointProjection',jsonb_build_object('kind','current_heads','limit',20,
      'totalHeads',(select count(*) from content.waypoint w where w.source_ai_interaction_session_id=p_id
        and not exists(select 1 from content.waypoint successor where successor.predecessor_waypoint_id=w.waypoint_id)),
      'hasMore',(select count(*)>20 from content.waypoint w where w.source_ai_interaction_session_id=p_id
        and not exists(select 1 from content.waypoint successor where successor.predecessor_waypoint_id=w.waypoint_id))),
    'waypoints',coalesce((select jsonb_agg(ai.solmind_waypoint_row_json_v1(w.waypoint_id,false)
      order by case when w.lifecycle_status='chosen' and w.released_at is null then 0 else 1 end,w.created_at desc,w.waypoint_id)
      from (select h.* from content.waypoint h where h.source_ai_interaction_session_id=p_id
        and not exists(select 1 from content.waypoint successor where successor.predecessor_waypoint_id=h.waypoint_id)
        order by case when h.lifecycle_status='chosen' and h.released_at is null then 0 else 1 end,h.created_at desc,h.waypoint_id
        limit 20) w),'[]'::jsonb))
  from (select 1) anchor left join ai.explorer_conversation_state s on s.conversation_id=p_id
    left join ai.ai_interaction_session session_row on session_row.ai_interaction_session_id=s.conversation_id
$$;

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
    ai.solmind_conversation_state_json(v_id)||jsonb_build_object('waypointCapacity',
      ai.solmind_waypoint_capacity_v1(p_actor_user_account_id,v_id)),a,ai.solmind_private_policy_v3(v_id);
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
  point_ids uuid[]; waypoint_ids uuid[]; draft_ids uuid[]; compass_drafts jsonb; policy jsonb; classification_only boolean;
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
      then 'wi007-v0.1+onboarding-fields-v2' else 'wi007-v0.1+onboarding-fields-v2+compass-v6' end)
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
      'anchor',c.compass_anchor,'emphasis',c.relative_emphasis)
      ||case when c.formation_status='proposed' then pg_catalog.jsonb_build_object('suggestedInPreviousReply',
        coalesce(c.wording_message_id=(select m.ai_interaction_message_id from ai.ai_interaction_message m
          where m.ai_interaction_session_id=p_conversation_id and m.sender_type='ai' and m.ai_role='solmind_virtual_guide'
          order by m.sequence_number desc limit 1),false)) else '{}'::jsonb end order by c.ord),'[]'::jsonb),
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
      order by case when w.lifecycle_status='chosen' and w.released_at is null then 0 else 1 end,w.created_at desc,w.waypoint_id),'[]'::jsonb),
    coalesce(pg_catalog.array_agg(w.waypoint_id order by case when w.lifecycle_status='chosen' and w.released_at is null then 0 else 1 end,w.created_at desc,w.waypoint_id),array[]::uuid[])
    into compass_waypoints,waypoint_ids
  from (select h.* from content.waypoint h where h.source_ai_interaction_session_id=p_conversation_id
    and not exists(select 1 from content.waypoint successor where successor.predecessor_waypoint_id=h.waypoint_id)
    order by case when h.lifecycle_status='chosen' and h.released_at is null then 0 else 1 end,h.created_at desc,h.waypoint_id
    limit 20) w;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',d.waypoint_draft_id,
      'title',ai.solmind_exclusion_normalize_v3(d.title),'destination',ai.solmind_exclusion_normalize_v3(d.destination),
      'whyItMatters',ai.solmind_exclusion_normalize_v3(d.why_it_matters),
      'arrivalSignal',ai.solmind_exclusion_normalize_v3(d.arrival_signal),
      'suggestedInPreviousReply',coalesce(d.suggestion_message_id=(select m.ai_interaction_message_id
        from ai.ai_interaction_message m where m.ai_interaction_session_id=p_conversation_id
          and m.sender_type='ai' and m.ai_role='solmind_virtual_guide'
        order by m.sequence_number desc limit 1),false))),'[]'::jsonb),
    coalesce(pg_catalog.array_agg(d.waypoint_draft_id),array[]::uuid[]) into compass_drafts,draft_ids
  from content.waypoint_draft d where d.source_ai_interaction_session_id=p_conversation_id and d.draft_status='proposed';
  if envelope->'compassContext' is null or (envelope->'compassContext')::jsonb is distinct from pg_catalog.jsonb_build_object(
      'version','explorer-compass-context.v6','points',compass_points,'priorityId',compass_priority,
      'attentionId',compass_attention,'recentRoute',compass_route,'waypoints',compass_waypoints,'drafts',compass_drafts)
    then return next; return; end if;
  expected_ids:=expected_ids||point_ids||waypoint_ids||draft_ids;
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
      and envelope->>'contractVersion'='wi007-v0.1+onboarding-fields-v2+compass-v6'),false)
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

comment on column content.waypoint.predecessor_waypoint_id is
  'One immutable same-conversation predecessor. Versions use the separate 200-row history guard; only chosen current heads occupy the Explorer active allowance.';

commit;
