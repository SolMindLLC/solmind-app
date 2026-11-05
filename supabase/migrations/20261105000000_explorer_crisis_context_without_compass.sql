-- Paul's decision, 2026-11-04 17:14:51 CST, point (d): crisis classification
-- omits the saved Compass and Waypoint section and its exclusive source ids.
-- Prepare applies fallback observations under its existing state lock before
-- this inspector runs. Ordinary context and historical replay stay unchanged.

begin;

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
      then 'wi007-v0.1+onboarding-fields-v2' else 'wi007-v0.1+onboarding-fields-v2+compass-v1' end)
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
      'label',ai.solmind_exclusion_normalize_v3(c.label),'order',c.ord-1,'formation','saved',
      'anchor',c.compass_anchor,'emphasis',c.relative_emphasis) order by c.ord),'[]'::jsonb),
    coalesce(pg_catalog.array_agg(c.item_id order by c.ord),array[]::uuid[])
    into compass_points,point_ids
  from (select x.*,pg_catalog.row_number() over(order by x.display_order) as ord
    from ai.explorer_conversation_compass_item x
    where x.conversation_id=p_conversation_id and x.merged_into_item_id is null) c;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('kind',r.compass_route_kind,
      'pointId',r.compass_route_item_id,'label',ai.solmind_exclusion_normalize_v3(r.current_label),
      'actor',case when r.kind='follow_attention' then 'virtual_guide' else 'explorer' end,
      'awaitingReply',r.kind='set_attention'
        and r.operation_id=(select last_move.operation_id from ai.explorer_conversation_operation last_move
          where last_move.conversation_id=p_conversation_id and last_move.compass_route_kind='attention_changed'
          order by last_move.initial_revision desc,last_move.operation_id desc limit 1)
        and not exists(select 1 from ai.ai_interaction_message reply where reply.ai_interaction_session_id=p_conversation_id
          and reply.sender_type='ai' and reply.created_at>=r.completed_at))
      order by r.initial_revision,r.operation_id),'[]'::jsonb)
    into compass_route
  from (select o.kind,o.completed_at,o.compass_route_kind,o.compass_route_item_id,c.label as current_label,o.initial_revision,o.operation_id
    from ai.explorer_conversation_operation o
    join ai.explorer_conversation_compass_item c on c.conversation_id=o.conversation_id
      and c.item_id=o.compass_route_item_id and c.merged_into_item_id is null
    where o.conversation_id=p_conversation_id and o.compass_route_kind='attention_changed'
    order by o.initial_revision desc,o.operation_id desc limit 5) r;
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
      'version','explorer-compass-context.v1','points',compass_points,'priorityId',compass_priority,
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

alter function ai.solmind_inspect_explorer_context_v3(uuid,uuid,uuid,uuid,uuid,text,uuid[]) owner to postgres;
revoke all on function ai.solmind_inspect_explorer_context_v3(uuid,uuid,uuid,uuid,uuid,text,uuid[]) from public,anon,authenticated,service_role;

commit;
