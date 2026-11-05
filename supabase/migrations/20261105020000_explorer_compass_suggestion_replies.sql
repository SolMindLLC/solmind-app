-- Chat step S6a: explicit Explorer answers to current forming Compass wording.
-- This capability performs no Send, provider dispatch or counted AI use.
begin;

alter table ai.explorer_conversation_operation
  add column compass_suggestion_item_id uuid null,
  add column compass_suggestion_response text null,
  add constraint explorer_compass_suggestion_item_fkey foreign key(conversation_id,compass_suggestion_item_id)
    references ai.explorer_conversation_compass_item(conversation_id,item_id),
  add constraint explorer_compass_suggestion_response_shape check (
    (kind='respond_compass_suggestion' and compass_suggestion_item_id is not null
      and compass_suggestion_response is not null and compass_suggestion_response in ('right','close','not_it')
      and status='completed' and reply_message_id is null and compass_route_kind is null)
    or (kind<>'respond_compass_suggestion' and compass_suggestion_item_id is null and compass_suggestion_response is null)),
  drop constraint explorer_conversation_operation_kind_check,
  add constraint explorer_conversation_operation_kind_check check(kind in ('send','add_compass','confirm_priority','set_attention',
    'confirm_waypoint','confirm_reached','confirm_compass_arrangement','end_conversation','confirm_compass_category',
    'release_waypoint','revise_waypoint','revisit_waypoint','follow_attention','confirm_compass_point','reject_compass_point',
    'respond_compass_suggestion'));
comment on column ai.explorer_conversation_operation.compass_suggestion_response is
  'Immutable explicit Explorer answer to the item at initial_revision. No forming-wording snapshot, message or provider invocation.';

create function ai.solmind_compass_suggestion_reply_guard() returns trigger
language plpgsql set search_path='' as $$
begin
  raise exception 'solmind_explorer_private_immutable';
end $$;
alter function ai.solmind_compass_suggestion_reply_guard() owner to postgres;
revoke all on function ai.solmind_compass_suggestion_reply_guard() from public,anon,authenticated,service_role;
create trigger explorer_compass_suggestion_reply_guard before update or delete on ai.explorer_conversation_operation
  for each row when (old.kind='respond_compass_suggestion') execute function ai.solmind_compass_suggestion_reply_guard();

-- Keep the original source for saved-source review. Only a forming point carries
-- its latest wording reply, which locates its reply row in the transcript.
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


create function public.solmind_respond_explorer_compass_suggestion_v1(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_expected_revision integer,p_command_fingerprint text,p_item_id uuid,p_response text
) returns table(outcome text,conversation_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; st ai.explorer_conversation_state%rowtype; point ai.explorer_conversation_compass_item%rowtype;
  op ai.explorer_conversation_operation%rowtype; origin ai.explorer_conversation_operation%rowtype;
  h text; ts timestamptz; follow_hash text; follow_bytes bytea; follow_id uuid;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_conversation_id is null or p_operation_id is null or p_expected_revision is null or p_expected_revision<0
    or p_item_id is null or p_response is null or p_response not in ('right','close','not_it')
    or p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$'
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  h:=methodology.hash_json(jsonb_build_array('explorer-compass-suggestion-response.v1',p_user_session_id,p_conversation_id,
    p_expected_revision,p_item_id,p_response,p_command_fingerprint));
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  select s.* into st from ai.explorer_conversation_state s where s.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id
    then raise exception 'solmind_explorer_private_denied'; end if;
  select o.* into op from ai.explorer_conversation_operation o
    where o.actor_user_account_id=p_actor_user_account_id and o.operation_id=p_operation_id for update;
  if found then
    if op.request_fingerprint is distinct from h or op.command_fingerprint is distinct from p_command_fingerprint
      or op.kind is distinct from 'respond_compass_suggestion' or op.conversation_id is distinct from p_conversation_id
      or op.application_session_id is distinct from p_user_session_id or op.status is distinct from 'completed'
      or op.compass_suggestion_item_id is distinct from p_item_id or op.compass_suggestion_response is distinct from p_response
      then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
    return query select 'exact_replay'::text,ai.solmind_conversation_state_json(p_conversation_id); return;
  end if;
  if ai.solmind_private_policy_v3(p_conversation_id)->'known' is distinct from 'true'::jsonb
    or st.restricted_level is not null or st.adult_reflection_stopped then raise exception 'solmind_explorer_private_denied'; end if;
  if st.revision<>p_expected_revision then return query select 'stale_revision'::text,null::jsonb; return; end if;
  -- These pre-write refusals are definite conflicts, never an uncertain reply.
  if st.pending_operation_id is not null then return query select 'operation_conflict'::text,null::jsonb; return; end if;
  select c.* into point from ai.explorer_conversation_compass_item c
    where c.conversation_id=p_conversation_id and c.item_id=p_item_id for update;
  if not found or point.formation_status is distinct from 'proposed' or point.merged_into_item_id is not null
    or point.wording_message_id is null or point.compass_anchor is not null or point.relative_emphasis is not null
    or st.priority_id=p_item_id then raise exception 'solmind_explorer_private_operation_conflict'; end if;
  if p_response='not_it' and (select count(*) from ai.explorer_conversation_compass_item c
    where c.conversation_id=p_conversation_id and c.formation_status='rejected')>=24
    then return query select 'operation_conflict'::text,null::jsonb; return; end if;
  ts:=clock_timestamp();
  -- The S5 private resolver's transition is repeated here so this operation's
  -- replay identity uses only the revision and answer, never mutable wording.
  -- The locked revision pins the point's exact stored label and latest reply.
  if p_response in ('right','not_it') then
    update ai.explorer_conversation_compass_item
      set formation_status=case when p_response='right' then 'confirmed' else 'rejected' end
      where conversation_id=p_conversation_id and item_id=p_item_id;
  end if;
  if p_response='right' then
    for origin in select o.* from ai.explorer_conversation_operation o
      where o.actor_user_account_id=p_actor_user_account_id
        and o.conversation_id=p_conversation_id and o.status='completed'
        and o.followed_attention_item_id=p_item_id
        and ((o.kind='send' and o.reply_message_id is not null and o.safety_protocol_version='explorer-safety-reply.v2')
          or (o.kind='set_attention' and o.compass_route_kind is null and o.origin_operation_id is null))
        and not exists(select 1 from ai.explorer_conversation_operation followed
          where followed.actor_user_account_id=p_actor_user_account_id and followed.origin_operation_id=o.operation_id)
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
  if st.attention_id=p_item_id and p_response='not_it' then
    update ai.explorer_conversation_state set attention_id=null where conversation_id=p_conversation_id;
  end if;
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,conversation_id,
    kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at,compass_suggestion_item_id,compass_suggestion_response)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,'respond_compass_suggestion',h,
      p_command_fingerprint,p_expected_revision,'completed',ts,p_item_id,p_response);
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id);
end $$;
alter function public.solmind_respond_explorer_compass_suggestion_v1(uuid,uuid,uuid,uuid,integer,text,uuid,text) owner to postgres;
revoke all on function public.solmind_respond_explorer_compass_suggestion_v1(uuid,uuid,uuid,uuid,integer,text,uuid,text) from public,anon,authenticated;
grant execute on function public.solmind_respond_explorer_compass_suggestion_v1(uuid,uuid,uuid,uuid,integer,text,uuid,text) to service_role;

commit;
