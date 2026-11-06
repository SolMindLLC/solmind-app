-- REV302b: Explorer-voice reply choices and verified ordinary-context tap marker.
-- Apply after 20261106000000_explorer_waypoint_active_limits.sql with the app's compass-v7 context.
-- Retain that migration's bounded head selection and all capacity, projection and owner-lock owners.
-- No table, grant, budget or count changes.
begin;

-- REV302: independently verify a claimed tap against the immediately preceding
-- saved message in this conversation. Matching uses UTF-8 bytes, never trimmed,
-- case-folded or normalized labels; duplicate matching labels are not a choice.
create function ai.solmind_immediate_reply_choice_v1(
  p_conversation_id uuid,p_body text,p_reply_choice boolean
) returns boolean language sql stable security invoker set search_path='' as $$
  select p_reply_choice is true and coalesce((
    select latest.sender_type='ai' and latest.ai_role='solmind_virtual_guide'
      and latest.sender_user_account_id is null and (
        select count(*)=1 from pg_catalog.jsonb_array_elements(
          case when pg_catalog.jsonb_typeof(latest.explorer_reply_choices)='array'
            then latest.explorer_reply_choices else '[]'::jsonb end) choice
        where pg_catalog.jsonb_typeof(choice->'label')='string'
          and pg_catalog.convert_to(choice->>'label','UTF8')=pg_catalog.convert_to(p_body,'UTF8'))
    from (select m.sender_type,m.ai_role,m.sender_user_account_id,m.explorer_reply_choices
      from ai.ai_interaction_message m where m.ai_interaction_session_id=p_conversation_id
      order by m.sequence_number desc limit 1) latest
  ),false)
$$;
alter function ai.solmind_immediate_reply_choice_v1(uuid,text,boolean) owner to postgres;
revoke all on function ai.solmind_immediate_reply_choice_v1(uuid,text,boolean) from public,anon,authenticated,service_role;

-- Replace the internal signatures with one optional claim; prior callers default
-- to false. Neither internal boundary is executable by an API role.
drop function ai.solmind_record_explorer_context_exclusion_v3(uuid,uuid,uuid,uuid,uuid,text,uuid[]);
drop function ai.solmind_inspect_explorer_context_v3(uuid,uuid,uuid,uuid,uuid,text,uuid[]);

create or replace function ai.solmind_inspect_explorer_context_v3(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_explorer_profile_id uuid,
  p_relationship_id uuid,p_conversation_id uuid,p_context_serialization text,p_context_source_ids uuid[],
  p_reply_choice boolean default false
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
  if p_reply_choice is null or pg_catalog.current_setting('transaction_isolation') is distinct from 'read committed'
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
      then 'wi007-v0.1+onboarding-fields-v2' else 'wi007-v0.1+onboarding-fields-v2+compass-v7' end)
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
      'version','explorer-compass-context.v7','points',compass_points,'priorityId',compass_priority,
      'attentionId',compass_attention,'recentRoute',compass_route,'waypoints',compass_waypoints,'drafts',compass_drafts,
      'immediateMessageIsReplyChoice',ai.solmind_immediate_reply_choice_v1(
        p_conversation_id,immediate->>'content',p_reply_choice))
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
alter function ai.solmind_inspect_explorer_context_v3(uuid,uuid,uuid,uuid,uuid,text,uuid[],boolean) owner to postgres;
revoke all on function ai.solmind_inspect_explorer_context_v3(uuid,uuid,uuid,uuid,uuid,text,uuid[],boolean) from public,anon,authenticated,service_role;

create function ai.solmind_record_explorer_context_exclusion_v3(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_explorer_profile_id uuid,
  p_relationship_id uuid,p_conversation_id uuid,p_context_serialization text,p_context_source_ids uuid[],
  p_reply_choice boolean default false
) returns table(outcome text,excluded_entity_type text,excluded_entity_id uuid,audit_event_id uuid)
language plpgsql volatile security invoker set search_path='' set lock_timeout='2000ms' as $$
declare inspected record; event_id uuid;
begin
  select * into inspected from ai.solmind_inspect_explorer_context_v3(p_actor_user_account_id,p_user_session_id,
    p_explorer_profile_id,p_relationship_id,p_conversation_id,p_context_serialization,p_context_source_ids,p_reply_choice);
  if not found or inspected.outcome is null or inspected.outcome not in ('clear','blocked','unavailable') then
    raise exception 'solmind_explorer_source_unavailable'; end if;
  if inspected.outcome<>'blocked' and (inspected.excluded_entity_type is not null or inspected.excluded_entity_id is not null)
    then raise exception 'solmind_explorer_source_unavailable'; end if;
  if inspected.outcome='blocked' then
    if inspected.excluded_entity_type is null or inspected.excluded_entity_type not in ('private_note','trigger_observation','summary_revision')
      or inspected.excluded_entity_id is null then raise exception 'solmind_explorer_source_unavailable'; end if;
    insert into audit.audit_event(event_type,actor_user_account_id,actor_role_context,target_entity_type,target_entity_id,
      action,reason_code,event_summary,metadata,ip_address,user_agent)
    values('explorer_context_exclusion_violation',null,'system','ai_interaction_session',p_conversation_id,
      'deny','excluded_source_detected','Explorer context dispatch blocked.',pg_catalog.jsonb_build_object(
        'ai_interaction_session_id',p_conversation_id::text,'excluded_entity_type',inspected.excluded_entity_type,
        'excluded_entity_id',inspected.excluded_entity_id::text,'assembly_path','explorer_conversation_context_v1'),null,null)
    returning audit.audit_event.audit_event_id into event_id;
  end if;
  -- Root returns this non-raising refusal so the required event can COMMIT.
  -- There is intentionally no retry/deduplication claim before a send exists.
  return query select inspected.outcome::text,inspected.excluded_entity_type::text,
    inspected.excluded_entity_id::uuid,event_id;
exception when others then
  -- An audit insert failure is a failure, not a successful committed denial.
  raise exception 'solmind_explorer_source_unavailable';
end $$;
alter function ai.solmind_record_explorer_context_exclusion_v3(uuid,uuid,uuid,uuid,uuid,text,uuid[],boolean) owner to postgres;
revoke all on function ai.solmind_record_explorer_context_exclusion_v3(uuid,uuid,uuid,uuid,uuid,text,uuid[],boolean) from public,anon,authenticated,service_role;

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
      and envelope->>'contractVersion'='wi007-v0.1+onboarding-fields-v2+compass-v7'),false)
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

-- The 38-argument prepare is the only active API capability. Its exact replay,
-- locks, policy checks, source-exclusion audit, final one-count gate and timeout
-- are the existing body; only the closed claim and its fingerprint are added.
drop function public.solmind_prepare_explorer_conversation_turn_v3(uuid,uuid,uuid,uuid,integer,uuid,uuid,uuid,text,text,text,uuid[],text,uuid,uuid,text,text,text,text,text,text,text,uuid,uuid,text,text,text,text,text,text,text,text,text,bigint,smallint,boolean,text);
create or replace function public.solmind_prepare_explorer_conversation_turn_v3(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,
  p_operation_id uuid,p_expected_revision integer,p_message_id uuid,p_snapshot_id uuid,p_invocation_id uuid,
  p_body text,p_context_serialization text,p_context_fingerprint_sha256 text,p_context_source_ids uuid[],
  p_authorization_version text,p_intake_response_set_id uuid,p_methodology_context_pack_version_id uuid,
  p_prompt_version text,p_policy_version text,p_behavior_version text,p_crisis_version text,
  p_role_version text,p_instruction_version text,p_command_fingerprint text,p_logical_operation_id uuid,
  p_methodology_context_pack_id uuid,p_methodology_content_sha256 text,p_methodology_authorization_version text,
  p_protocol_version text,p_request_mode text,p_configuration_fingerprint text,p_fallback_policy_version text,
  p_model_policy_version text,p_trusted_response_version text,p_resource_policy_version text,
  p_expected_safety_version bigint,p_fallback_level smallint,p_fallback_minor_indicated boolean,p_model_name text,
  p_reply_choice boolean default false
) returns table(outcome text,conversation_state jsonb,dispatch_permitted boolean,policy_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; e jsonb; st ai.explorer_conversation_state%rowtype; old_op ai.explorer_conversation_operation%rowtype;
  h text; h_legacy text; ids uuid[]; mode text; ctx json; inspected record; n integer; ts timestamptz; g jsonb;
  v_contract constant text:='virtual-guide-predispatch-evidence.v3';
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_reply_choice is null or p_user_session_id is null or p_conversation_id is null or p_operation_id is null or p_message_id is null
    or p_snapshot_id is null or p_invocation_id is null or p_logical_operation_id is null
    or p_expected_revision is null or p_expected_revision<0 or p_expected_safety_version is null or p_expected_safety_version<0
    or p_protocol_version is distinct from 'explorer-safety-reply.v2'
    or p_request_mode is null or p_request_mode not in ('classification_and_reply','classification_only')
    or p_fallback_level is null or p_fallback_level not between 0 and 4 or p_fallback_minor_indicated is null
    or p_model_name is null or not ai.solmind_openai_model_name_valid(p_model_name)
    or not ai.solmind_conversation_text_valid(p_body,8192,false)
    or p_configuration_fingerprint is null or p_configuration_fingerprint !~ '^[0-9A-F]{64}$'
    or p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$'
    or p_context_serialization is null or octet_length(p_context_serialization) not between 2 and 524288
    or p_context_fingerprint_sha256 is null or p_context_fingerprint_sha256 !~ '^[0-9A-F]{64}$'
    or p_authorization_version is null or p_authorization_version !~ '^AV3:[0-9A-F]{64}$'
    or p_context_fingerprint_sha256 is distinct from upper(encode(extensions.digest(convert_to(p_context_serialization,'UTF8'),'sha256'),'hex'))
    or p_intake_response_set_id is null or p_methodology_context_pack_id is null or p_methodology_context_pack_version_id is null
    or p_methodology_content_sha256 is null or p_methodology_content_sha256 !~ '^[0-9A-F]{64}$'
    or p_methodology_authorization_version is null or p_methodology_authorization_version !~ '^MV1:[0-9A-F]{64}$'
    or p_context_source_ids is null or cardinality(p_context_source_ids) not between 3 and 103
    or array_position(p_context_source_ids,null) is not null
    or exists(select 1 from unnest(array[p_prompt_version,p_policy_version,p_behavior_version,p_crisis_version,
      p_role_version,p_instruction_version,p_fallback_policy_version,p_model_policy_version,
      p_trusted_response_version,p_resource_policy_version]) as versions(version)
      where version is null or version !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$')
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  select array_agg(distinct x order by x) into ids from unnest(p_context_source_ids) as sources(x);
  if ids is distinct from p_context_source_ids or not(p_message_id=any(ids))
    or not(p_intake_response_set_id=any(ids)) or not(p_methodology_context_pack_version_id=any(ids))
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  h_legacy:=methodology.hash_json(jsonb_build_array(p_actor_user_account_id,p_user_session_id,p_conversation_id,
    p_operation_id,p_expected_revision,p_message_id,p_snapshot_id,p_invocation_id,p_body,p_context_fingerprint_sha256,ids,
    p_authorization_version,p_intake_response_set_id,p_methodology_context_pack_version_id,p_prompt_version,p_policy_version,
    p_behavior_version,p_crisis_version,p_role_version,p_instruction_version,p_command_fingerprint,p_logical_operation_id,
    p_methodology_context_pack_id,p_methodology_content_sha256,p_methodology_authorization_version,p_protocol_version,
    p_request_mode,p_configuration_fingerprint,p_fallback_policy_version,p_model_policy_version,p_trusted_response_version,
    p_resource_policy_version,p_expected_safety_version,p_fallback_level,p_fallback_minor_indicated));
  h:=methodology.hash_json(jsonb_build_array('explorer-model-binding.v1',h_legacy,p_model_name));
  -- Preserve false/absent replay identities; a claimed tap is part of exact intent,
  -- even if its label is stale or this turn is classification_only.
  if p_reply_choice then h:=methodology.hash_json(jsonb_build_array('explorer-reply-choice.v1',h,true)); end if;
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id
    then raise exception 'solmind_explorer_private_denied'; end if;
  select x.* into old_op from ai.explorer_conversation_operation x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id for update;
  if found then
    if old_op.kind is distinct from 'send' or old_op.conversation_id is distinct from p_conversation_id
      or old_op.application_session_id is distinct from p_user_session_id
      or (old_op.model_name is not null and old_op.model_name is distinct from p_model_name)
      or (old_op.model_name is null and (p_model_name is distinct from 'gpt-5.6-luna' or p_reply_choice))
      or old_op.request_fingerprint is distinct from (case when old_op.model_name is null then h_legacy else h end)
      or old_op.command_fingerprint is distinct from p_command_fingerprint
      or old_op.safety_protocol_version is distinct from p_protocol_version
      then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    -- Exact persisted request first: no current methodology/source collection or
    -- changed version enrichment, and never another dispatch permission.
    if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp()
      then raise exception 'solmind_explorer_private_denied'; end if;
    return query select 'exact_replay'::text,ai.solmind_conversation_state_json(p_conversation_id),false,
      ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  if st.revision is distinct from p_expected_revision or st.pending_operation_id is not null then
    return query select 'stale_revision'::text,null::jsonb,false,ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  if ai.solmind_private_policy_v3(p_conversation_id)->'known' is distinct from 'true'::jsonb
    then raise exception 'solmind_explorer_private_legacy_unknown'; end if;
  -- Product hard stops, early: a paused Send is refused before any observation or message is stored. The
  -- four hard-stop settings are taken first, in key order, before the clock is read for the check.
  perform s.setting_key from core.application_setting s
    where s.setting_key in ('explorer_ai_use_automatic_lifts_per_month','explorer_ai_use_automatic_lifts_per_week',
      'explorer_ai_use_individual_daily_call_limit','explorer_ai_use_shared_daily_calls_per_active_explorer')
    order by s.setting_key for share;
  g:=ai.solmind_explorer_ai_use_gate_v1(p_actor_user_account_id,p_conversation_id,clock_timestamp(),'check');
  if (g->>'allowed')::boolean is not true then
    return query select 'paused'::text,null::jsonb,false,ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  perform ai.solmind_store_private_observation_v3(p_conversation_id,p_user_session_id,p_logical_operation_id,
    p_command_fingerprint,p_fallback_policy_version,p_model_policy_version,p_fallback_level,p_fallback_minor_indicated,
    null,null,null);
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id;
  mode:=case when st.restricted_level is not null or st.adult_reflection_stopped or p_fallback_level>=3
    or p_fallback_minor_indicated then 'classification_only' else 'classification_and_reply' end;
  if st.safety_version is distinct from p_expected_safety_version or p_request_mode is distinct from mode then
    return query select 'stale_policy'::text,null::jsonb,false,ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  if a->>'authorizationVersion' is distinct from p_authorization_version
    or (a->'onboarding'->>'responseId')::uuid is distinct from p_intake_response_set_id
    then raise exception 'solmind_explorer_private_denied'; end if;
  e:=methodology.resolve_effective(p_methodology_context_pack_id,(a->>'guideId')::uuid);
  if (e->>'versionId')::uuid is distinct from p_methodology_context_pack_version_id
    or e->>'contentSha256' is distinct from p_methodology_content_sha256
    or e->>'methodologyAuthorizationVersion' is distinct from p_methodology_authorization_version
    or not methodology.serialized_methodology_valid(p_context_serialization,p_methodology_context_pack_version_id,e->>'contentMarkdown')
    then raise exception 'solmind_explorer_private_denied'; end if;
  ctx:=p_context_serialization::json;
  if ctx->'immediateExplorerMessage'->>'messageId' is distinct from p_message_id::text
    or ctx->'immediateExplorerMessage'->>'content' is distinct from p_body
    or ctx->'globalPolicy'->>'version' is distinct from p_policy_version
    or ctx->'roleBehavior'->>'version' is distinct from p_behavior_version
    or ctx->'crisisBehavior'->>'version' is distinct from p_crisis_version
    then raise exception 'solmind_explorer_private_denied'; end if;
  -- The source owner locks all covered tables NOWAIT before its fresh scan.
  -- Its blocked audit MUST survive: return rather than throw after that row.
  select x.* into inspected from ai.solmind_record_explorer_context_exclusion_v3(
    p_actor_user_account_id,p_user_session_id,(a->>'explorerId')::uuid,(a->>'relationshipId')::uuid,
    p_conversation_id,p_context_serialization,ids,p_reply_choice) x;
  if not found or inspected.outcome is null or inspected.outcome not in ('clear','blocked','unavailable')
    then raise exception 'solmind_explorer_private_unavailable'; end if;
  if inspected.outcome<>'clear' then
    return query select inspected.outcome::text,null::jsonb,false,null::jsonb; return;
  end if;
  select count(*)::integer into n from ai.ai_interaction_message m where m.ai_interaction_session_id=p_conversation_id;
  if n>98 then return query select 'unavailable'::text,null::jsonb,false,null::jsonb; return; end if;
  -- Product hard stops, final: the four hard-stop settings (already held since the early check), then the
  -- one shared lock, and only then read the clock, so after any wait the day, the count and this Send's
  -- saved times all come from one moment. Each Send prepared here counts once; a stop reached by this
  -- Send is recorded with it.
  perform s.setting_key from core.application_setting s
    where s.setting_key in ('explorer_ai_use_automatic_lifts_per_month','explorer_ai_use_automatic_lifts_per_week',
      'explorer_ai_use_individual_daily_call_limit','explorer_ai_use_shared_daily_calls_per_active_explorer')
    order by s.setting_key for share;
  perform pg_advisory_xact_lock(hashtextextended('solmind:explorer-ai-use-shared:v1',0));
  ts:=clock_timestamp();
  g:=ai.solmind_explorer_ai_use_gate_v1(p_actor_user_account_id,p_conversation_id,ts,'final');
  if (g->>'allowed')::boolean is not true then
    return query select 'paused'::text,null::jsonb,false,ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
    sender_type,sender_user_account_id,sender_role_context,content_text,created_at)
    values(p_message_id,p_conversation_id,n+1,'user',p_actor_user_account_id,'explorer',p_body,ts);
  insert into ai.ai_context_snapshot(ai_context_snapshot_id,ai_interaction_session_id,ai_interaction_message_id,
    prompt_version,methodology_context_pack_version_id,actor_user_account_id,explorer_profile_id,
    guide_explorer_relationship_id,authorization_version,active_required_consent_document_ids,context_source_ids,
    context_fingerprint_sha256,evidence_contract_version,application_session_id,immediate_message_id,
    organization_id,practice_id,solmind_policy_version,ai_behavior_version,crisis_policy_version,
    role_policy_version,instruction_version,intake_response_set_id,related_prior_session_ids,created_at,
    explorer_safety_protocol_version,explorer_safety_request_mode,explorer_configuration_fingerprint,
    fallback_policy_version,model_policy_version,trusted_response_version,resource_policy_version)
    values(p_snapshot_id,p_conversation_id,p_message_id,p_prompt_version,p_methodology_context_pack_version_id,
      p_actor_user_account_id,(a->>'explorerId')::uuid,(a->>'relationshipId')::uuid,p_authorization_version,
      array(select jsonb_array_elements_text(a->'requiredConsentDocumentIds')::uuid),ids,
      p_context_fingerprint_sha256,v_contract,p_user_session_id,p_message_id,(a->>'organizationId')::uuid,
      (a->>'practiceId')::uuid,p_policy_version,p_behavior_version,p_crisis_version,p_role_version,p_instruction_version,
      p_intake_response_set_id,array[]::uuid[],ts,p_protocol_version,p_request_mode,p_configuration_fingerprint,
      p_fallback_policy_version,p_model_policy_version,p_trusted_response_version,p_resource_policy_version);
  insert into ai.ai_model_invocation(ai_model_invocation_id,ai_interaction_session_id,provider_name,model_name,
    prompt_version,logical_operation_id,ai_context_snapshot_id,dispatch_contract_version,started_at)
    values(p_invocation_id,p_conversation_id,'openai',p_model_name,p_prompt_version,p_logical_operation_id,p_snapshot_id,v_contract,ts);
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
    conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,message_id,snapshot_id,invocation_id,
    logical_operation_id,safety_protocol_version,safety_request_mode,configuration_fingerprint,fallback_observation_fingerprint,
    fallback_policy_version,model_policy_version,trusted_response_version,resource_policy_version,model_name,created_at)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,'send',h,p_command_fingerprint,
      p_expected_revision,'started',p_message_id,p_snapshot_id,p_invocation_id,p_logical_operation_id,
      p_protocol_version,p_request_mode,p_configuration_fingerprint,
      methodology.hash_json(jsonb_build_array('explorer-fallback-observation.v1',p_user_session_id,p_conversation_id,
        p_logical_operation_id,p_command_fingerprint,p_configuration_fingerprint,p_fallback_policy_version,
        p_model_policy_version,p_fallback_level,p_fallback_minor_indicated)),p_fallback_policy_version,
      p_model_policy_version,p_trusted_response_version,p_resource_policy_version,p_model_name,ts);
  insert into methodology.explorer_methodology_binding(ai_context_snapshot_id,methodology_context_pack_id,
    methodology_context_pack_version_id,content_sha256,methodology_authorization_version,created_at)
    values(p_snapshot_id,p_methodology_context_pack_id,p_methodology_context_pack_version_id,p_methodology_content_sha256,
      p_methodology_authorization_version,ts);
  perform ai.solmind_store_private_observation_v3(p_conversation_id,p_user_session_id,p_logical_operation_id,
    p_command_fingerprint,p_fallback_policy_version,p_model_policy_version,p_fallback_level,p_fallback_minor_indicated,
    p_invocation_id,null,null);
  insert into audit.audit_event(event_type,actor_user_account_id,actor_role_context,target_entity_type,
    target_entity_id,action,reason_code,event_summary,metadata)
    values('ai_context_snapshot_created',p_actor_user_account_id,'explorer','ai_context_snapshot',p_snapshot_id,
      'create','pre_dispatch_snapshot_created','Virtual Guide context snapshot created before provider dispatch.',
      jsonb_build_object('contract_version',v_contract,'operation_id',p_logical_operation_id::text,
        'role_context','explorer','session_id',p_conversation_id::text)),
    ('ai_model_invocation_started',p_actor_user_account_id,'explorer','ai_model_invocation',p_invocation_id,
      'start','pre_dispatch_invocation_started','Virtual Guide model invocation started before provider dispatch.',
      jsonb_build_object('context_snapshot_id',p_snapshot_id::text,'contract_version',v_contract,
        'model_name',p_model_name,'operation_id',p_logical_operation_id::text,'provider_name','openai',
        'request_status','started','role_context','explorer','session_id',p_conversation_id::text));
  update ai.explorer_conversation_state set revision=revision+1,pending_operation_id=p_operation_id
    where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp()
    then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id),true,
    ai.solmind_private_policy_v3(p_conversation_id);
end $$;
alter function public.solmind_prepare_explorer_conversation_turn_v3(uuid,uuid,uuid,uuid,integer,uuid,uuid,uuid,text,text,text,uuid[],text,uuid,uuid,text,text,text,text,text,text,text,uuid,uuid,text,text,text,text,text,text,text,text,text,bigint,smallint,boolean,text,boolean) owner to postgres;
revoke all on function public.solmind_prepare_explorer_conversation_turn_v3(uuid,uuid,uuid,uuid,integer,uuid,uuid,uuid,text,text,text,uuid[],text,uuid,uuid,text,text,text,text,text,text,text,uuid,uuid,text,text,text,text,text,text,text,text,text,bigint,smallint,boolean,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.solmind_prepare_explorer_conversation_turn_v3(uuid,uuid,uuid,uuid,integer,uuid,uuid,uuid,text,text,text,uuid[],text,uuid,uuid,text,text,text,text,text,text,text,uuid,uuid,text,text,text,text,text,text,text,text,text,bigint,smallint,boolean,text,boolean) to service_role;

commit;
