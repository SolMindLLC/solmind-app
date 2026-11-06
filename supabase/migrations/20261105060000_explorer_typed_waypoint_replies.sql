-- Chat step S7b: clear typed answers to the immediately preceding Waypoint draft.
-- The app and this migration must reach the database together.
begin;

alter table ai.explorer_conversation_operation
  add column waypoint_suggestion_typed boolean not null default false,
  add constraint explorer_waypoint_suggestion_typed_shape check (
    not waypoint_suggestion_typed or kind='respond_waypoint_draft');
comment on column ai.explorer_conversation_operation.waypoint_suggestion_typed is
  'True only for a typed-answer receipt applied during ordinary settlement. The receipt stores only the draft id and answer, never forming wording.';

-- Both button replies and typed settlement use the exact stored-wording transition.
-- Callers own authority, policy, replay and the typed preceding-reply gate.
-- The receipt precedes the transition, as required by the immutable draft guard.
create function ai.solmind_apply_waypoint_draft_response(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_request_fingerprint text,p_command_fingerprint text,p_draft_id uuid,p_response text,
  p_completed_at timestamptz,p_typed boolean
) returns boolean language plpgsql volatile security invoker set search_path='' as $$
declare st ai.explorer_conversation_state%rowtype; draft content.waypoint_draft%rowtype;
  waypoint_bytes bytea; new_waypoint_id uuid;
begin
  select s.* into st from ai.explorer_conversation_state s where s.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id
    or st.pending_operation_id is not null or st.restricted_level is not null or st.adult_reflection_stopped
    or p_response is null or p_response not in ('right','close','not_it') then return false; end if;
  select d.* into draft from content.waypoint_draft d
    where d.source_ai_interaction_session_id=p_conversation_id and d.waypoint_draft_id=p_draft_id for update;
  if not found or draft.draft_status is distinct from 'proposed' then return false; end if;
  if (p_response='not_it' and (select count(*) from content.waypoint_draft d
      where d.source_ai_interaction_session_id=p_conversation_id and d.draft_status='rejected')>=24)
    or (p_response='right' and ((select count(*) from content.waypoint w
      where w.source_ai_interaction_session_id=p_conversation_id)>=20
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
alter function ai.solmind_apply_waypoint_draft_response(uuid,uuid,uuid,uuid,text,text,uuid,text,timestamptz,boolean) owner to postgres;
revoke all on function ai.solmind_apply_waypoint_draft_response(uuid,uuid,uuid,uuid,text,text,uuid,text,timestamptz,boolean) from public,anon,authenticated,service_role;

create or replace function public.solmind_respond_explorer_waypoint_draft_v1(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_expected_revision integer,p_command_fingerprint text,p_draft_id uuid,p_response text
) returns table(outcome text,conversation_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; st ai.explorer_conversation_state%rowtype; draft content.waypoint_draft%rowtype;
  op ai.explorer_conversation_operation%rowtype; h text; ts timestamptz;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_conversation_id is null or p_operation_id is null or p_expected_revision is null or p_expected_revision<0
    or p_draft_id is null or p_response is null or p_response not in ('right','close','not_it')
    or p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$'
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  h:=methodology.hash_json(jsonb_build_array('explorer-waypoint-draft-response.v1',p_user_session_id,p_conversation_id,
    p_expected_revision,p_draft_id,p_response,p_command_fingerprint));
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  select s.* into st from ai.explorer_conversation_state s where s.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id
    then raise exception 'solmind_explorer_private_denied'; end if;
  select o.* into op from ai.explorer_conversation_operation o
    where o.actor_user_account_id=p_actor_user_account_id and o.operation_id=p_operation_id for update;
  if found then
    if op.request_fingerprint is distinct from h or op.command_fingerprint is distinct from p_command_fingerprint
      or op.kind is distinct from 'respond_waypoint_draft' or op.conversation_id is distinct from p_conversation_id
      or op.application_session_id is distinct from p_user_session_id or op.status is distinct from 'completed'
      or op.waypoint_suggestion_draft_id is distinct from p_draft_id or op.waypoint_suggestion_response is distinct from p_response
      then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
    return query select 'exact_replay'::text,ai.solmind_conversation_state_json(p_conversation_id); return;
  end if;
  if ai.solmind_private_policy_v3(p_conversation_id)->'known' is distinct from 'true'::jsonb
    or st.restricted_level is not null or st.adult_reflection_stopped then raise exception 'solmind_explorer_private_denied'; end if;
  if st.revision<>p_expected_revision then return query select 'stale_revision'::text,null::jsonb; return; end if;
  if st.pending_operation_id is not null then return query select 'operation_conflict'::text,null::jsonb; return; end if;
  select d.* into draft from content.waypoint_draft d
    where d.source_ai_interaction_session_id=p_conversation_id and d.waypoint_draft_id=p_draft_id for update;
  if not found or draft.draft_status is distinct from 'proposed'
    then raise exception 'solmind_explorer_private_operation_conflict'; end if;
  ts:=clock_timestamp();
  if not ai.solmind_apply_waypoint_draft_response(p_actor_user_account_id,p_user_session_id,p_conversation_id,
    p_operation_id,h,p_command_fingerprint,p_draft_id,p_response,ts,false)
    then return query select 'operation_conflict'::text,null::jsonb; return; end if;
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id);
end $$;
alter function public.solmind_respond_explorer_waypoint_draft_v1(uuid,uuid,uuid,uuid,integer,text,uuid,text) owner to postgres;
revoke all on function public.solmind_respond_explorer_waypoint_draft_v1(uuid,uuid,uuid,uuid,integer,text,uuid,text) from public,anon,authenticated;
grant execute on function public.solmind_respond_explorer_waypoint_draft_v1(uuid,uuid,uuid,uuid,integer,text,uuid,text) to service_role;

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
      then 'wi007-v0.1+onboarding-fields-v2' else 'wi007-v0.1+onboarding-fields-v2+compass-v5' end)
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
      order by w.created_at,w.waypoint_id),'[]'::jsonb),
    coalesce(pg_catalog.array_agg(w.waypoint_id order by w.created_at,w.waypoint_id),array[]::uuid[])
    into compass_waypoints,waypoint_ids
  from content.waypoint w where w.source_ai_interaction_session_id=p_conversation_id
    and not exists(select 1 from content.waypoint successor where successor.predecessor_waypoint_id=w.waypoint_id);
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
      'version','explorer-compass-context.v5','points',compass_points,'priorityId',compass_priority,
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
      and envelope->>'contractVersion'='wi007-v0.1+onboarding-fields-v2+compass-v5'),false)
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


-- The retired 25-argument overload is replaced; a null typed response keeps replay bytes.
drop function public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb);
create function public.solmind_settle_explorer_conversation_turn_v4(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_status text,p_reply_message_id uuid,p_reply_kind text,p_reply_body text,
  p_model_level smallint,p_model_minor_indicated boolean,p_protocol_version text,p_request_mode text,
  p_configuration_fingerprint text,p_fallback_policy_version text,p_model_policy_version text,
  p_trusted_response_version text,p_resource_policy_version text,p_fallback_level smallint,
  p_fallback_minor_indicated boolean,p_delivery_interested boolean,p_attention_item_id uuid,p_choices jsonb,p_compass_suggestions jsonb default null,p_compass_responses jsonb default null,p_waypoint_suggestion jsonb default null,p_waypoint_response jsonb default null
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
      else jsonb_build_array('explorer-typed-waypoint-response.v1',p_waypoint_response) end);
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
        refined_ids:=array_append(refined_ids,suggestion_id);
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
alter function public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb) owner to postgres;
revoke all on function public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.solmind_settle_explorer_conversation_turn_v4(uuid,uuid,uuid,uuid,text,uuid,text,text,smallint,boolean,text,text,text,text,text,text,text,smallint,boolean,boolean,uuid,jsonb,jsonb,jsonb,jsonb,jsonb) to service_role;

-- Revision and revisit ask for the three existing components, never a title.
-- A drafted title (one that differs from the destination) is carried forward; a
-- form-created Waypoint's title is its destination, so it follows the new destination.
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
alter function public.solmind_confirm_explorer_waypoint_revision_v1(uuid,uuid,uuid,uuid,integer,text,text,uuid,jsonb) owner to postgres;
revoke all on function public.solmind_confirm_explorer_waypoint_revision_v1(uuid,uuid,uuid,uuid,integer,text,text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.solmind_confirm_explorer_waypoint_revision_v1(uuid,uuid,uuid,uuid,integer,text,text,uuid,jsonb) to service_role;
comment on function public.solmind_confirm_explorer_waypoint_revision_v1(uuid,uuid,uuid,uuid,integer,text,text,uuid,jsonb) is
  'One explicit Explorer confirmation after application-authored conversational questions. Changed answers create an immutable linked successor/source record; no direct summary edit, fabricated AI reply or copied Reached evidence.';

commit;
