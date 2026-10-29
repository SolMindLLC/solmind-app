-- SolMind private active-conversation Waypoint conversational confirmation.
-- Explicit application-authored questions and exact Explorer answers create a
-- confirmed successor. No model/AI message, automatic quote, provider/context
-- source, sharing, deletion, slot release or ended-conversation reactivation.
begin;

alter table content.waypoint
  add column predecessor_waypoint_id uuid null,
  add column creation_reason text null,
  add constraint waypoint_predecessor_reason_check check (
    (predecessor_waypoint_id is null and creation_reason is null)
    or (predecessor_waypoint_id is not null and creation_reason is not null and creation_reason in ('revision','revisit')
      and predecessor_waypoint_id<>waypoint_id)
  ),
  add constraint waypoint_conversation_identity_unique unique(source_ai_interaction_session_id,waypoint_id),
  add constraint waypoint_predecessor_same_conversation_fkey foreign key(source_ai_interaction_session_id,predecessor_waypoint_id)
    references content.waypoint(source_ai_interaction_session_id,waypoint_id),
  add constraint waypoint_one_confirmed_successor_unique unique(predecessor_waypoint_id);
comment on column content.waypoint.predecessor_waypoint_id is
  'One immutable same-conversation predecessor. All versions count toward the retained twenty-row bound; no sibling current versions or prior-history overwrite.';
comment on column content.waypoint.creation_reason is
  'revision replaces a current chosen head; revisit starts a new chosen lifecycle after a released or Reached head, without copying earlier Reached/release facts.';

create table content.waypoint_clarification (
  waypoint_id uuid not null references content.waypoint(waypoint_id),
  component text not null check(component in ('destination','meaning','arrivalSignal')),
  question_key text not null,
  answer_text text not null,
  source_actor_user_account_id uuid not null references identity.user_account(user_account_id),
  created_at timestamptz not null,
  retention_class text not null default 'sensitive_content' check(retention_class='sensitive_content'),
  primary key(waypoint_id,component),
  check(question_key='waypoint.'||component||'.v1'),
  check(ai.solmind_conversation_text_valid(answer_text,1000,false) and answer_text=btrim(answer_text,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'))
);
alter table content.waypoint_clarification enable row level security;
revoke all on content.waypoint_clarification from public,anon,authenticated,service_role;
comment on table content.waypoint_clarification is
  'Immutable application-question/Explorer-answer confirmation source per changed component; not an AI conversation message, exact quotation, automatic interpretation or model-context source. Original whole-message origin stays separate.';
create function content.solmind_waypoint_clarification_immutable_v1() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'solmind_explorer_private_immutable'; end $$;
alter function content.solmind_waypoint_clarification_immutable_v1() owner to postgres;
revoke all on function content.solmind_waypoint_clarification_immutable_v1() from public,anon,authenticated,service_role;
create trigger waypoint_clarification_immutable before update or delete on content.waypoint_clarification
for each row execute function content.solmind_waypoint_clarification_immutable_v1();

alter table ai.explorer_conversation_operation
  drop constraint explorer_conversation_operation_kind_check,
  add constraint explorer_conversation_operation_kind_check check(kind in ('send','add_compass','confirm_priority','set_attention',
    'confirm_waypoint','confirm_reached','confirm_compass_arrangement','end_conversation','confirm_compass_category',
    'release_waypoint','revise_waypoint','revisit_waypoint'));

create or replace function content.solmind_waypoint_history_guard_v1() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'solmind_explorer_private_immutable'; end if;
  if to_jsonb(new)=to_jsonb(old) then return new; end if;
  if (to_jsonb(new)-array['lifecycle_status','reached_by_explorer_user_account_id','reached_at','reached_evidence',
      'released_at','released_by_user_account_id','released_operation_id']) is distinct from
    (to_jsonb(old)-array['lifecycle_status','reached_by_explorer_user_account_id','reached_at','reached_evidence',
      'released_at','released_by_user_account_id','released_operation_id'])
    or old.lifecycle_status is distinct from 'chosen' or old.released_at is not null
    or exists(select 1 from content.waypoint successor where successor.predecessor_waypoint_id=old.waypoint_id)
    then raise exception 'solmind_explorer_private_immutable'; end if;
  if new.released_at is not null then
    if new.lifecycle_status is distinct from old.lifecycle_status
      or (new.reached_by_explorer_user_account_id,new.reached_at,new.reached_evidence) is distinct from
         (old.reached_by_explorer_user_account_id,old.reached_at,old.reached_evidence)
      or new.released_by_user_account_id is distinct from old.chosen_by_explorer_user_account_id
      or not exists(select 1 from ai.explorer_conversation_operation o
        where o.actor_user_account_id=new.released_by_user_account_id and o.operation_id=new.released_operation_id
          and o.conversation_id=new.source_ai_interaction_session_id and o.kind='release_waypoint'
          and o.status='completed' and o.completed_at=new.released_at)
      then raise exception 'solmind_explorer_private_immutable'; end if;
  elsif new.lifecycle_status is distinct from 'reached'
    or new.reached_by_explorer_user_account_id is distinct from old.chosen_by_explorer_user_account_id
    or new.reached_at is null or not ai.solmind_conversation_text_valid(new.reached_evidence,1000,false)
    or (new.released_at,new.released_by_user_account_id,new.released_operation_id) is distinct from
       (old.released_at,old.released_by_user_account_id,old.released_operation_id)
    then raise exception 'solmind_explorer_private_immutable';
  end if;
  return new;
end $$;

create or replace function ai.solmind_private_operation_guard_v3() returns trigger
language plpgsql set search_path='' as $$
begin
  -- Route facts are insert-only. Legacy rows cannot be enriched into history.
  if old.compass_route_kind is not null or old.kind in ('end_conversation','confirm_compass_category','release_waypoint','revise_waypoint','revisit_waypoint') then
    raise exception 'solmind_explorer_private_immutable';
  end if;
  if tg_op='UPDATE' and (new.compass_route_kind,new.compass_route_item_id,new.compass_route_label,new.compass_arrangement,new.ending_directions_text,new.ending_route_revision,new.compass_category_change)
    is distinct from (old.compass_route_kind,old.compass_route_item_id,old.compass_route_label,old.compass_arrangement,old.ending_directions_text,old.ending_route_revision,old.compass_category_change) then
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
      'label',c.label,'anchor',c.compass_anchor,'emphasis',c.relative_emphasis,'mergedIntoItemId',c.merged_into_item_id) order by c.display_order) from ai.explorer_conversation_compass_item c where c.conversation_id=p_id),'[]'::jsonb),
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
        'label',o.compass_route_label,'recordedAt',o.completed_at) end order by o.initial_revision,o.operation_id)
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

create function public.solmind_confirm_explorer_waypoint_revision_v1(
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
  if (select count(*) from content.waypoint x where x.source_ai_interaction_session_id=p_conversation_id)>=20 then
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
    values(p_operation_id,w.guide_explorer_relationship_id,p_conversation_id,w.source_message_id,new_destination,
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
alter function public.solmind_confirm_explorer_waypoint_revision_v1(uuid,uuid,uuid,uuid,integer,text,text,uuid,jsonb) owner to postgres;
revoke all on function public.solmind_confirm_explorer_waypoint_revision_v1(uuid,uuid,uuid,uuid,integer,text,text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.solmind_confirm_explorer_waypoint_revision_v1(uuid,uuid,uuid,uuid,integer,text,text,uuid,jsonb) to service_role;
comment on function public.solmind_confirm_explorer_waypoint_revision_v1(uuid,uuid,uuid,uuid,integer,text,text,uuid,jsonb) is
  'One explicit Explorer confirmation after application-authored conversational questions. Changed answers create an immutable linked successor/source record; no direct summary edit, fabricated AI reply or copied Reached evidence.';

commit;
