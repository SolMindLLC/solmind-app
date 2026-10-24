-- SolMind MVP0 private Explorer conversation composition.
-- Initial review-only proposal: no provider I/O, users, seed, permissive policies,
-- browser/table grants, deployment or real-user activation. Root owns execution.
-- Existing v1 evidence is retained unchanged. New v2 rows are immutable.
begin;

create table ai.explorer_conversation_state (
  conversation_id uuid primary key references ai.ai_interaction_session(ai_interaction_session_id),
  actor_user_account_id uuid not null references identity.user_account(user_account_id),
  revision integer not null default 0 check (revision >= 0),
  pending_operation_id uuid null,
  priority_id uuid null,
  attention_id uuid null,
  created_at timestamptz not null default clock_timestamp(),
  retention_class text not null default 'sensitive_content' check (retention_class = 'sensitive_content')
);
create table ai.explorer_conversation_operation (
  actor_user_account_id uuid not null references identity.user_account(user_account_id),
  operation_id uuid not null,
  application_session_id uuid not null references identity.user_session(user_session_id),
  conversation_id uuid not null references ai.explorer_conversation_state(conversation_id),
  kind text not null check (kind in ('send','add_compass','confirm_priority','set_attention','confirm_waypoint','confirm_reached')),
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9A-F]{64}$'),
  command_fingerprint text not null check (command_fingerprint ~ '^[0-9A-F]{64}$'),
  initial_revision integer not null check (initial_revision >= 0),
  status text not null check (status in ('started','completed','failed','canceled')),
  message_id uuid null references ai.ai_interaction_message(ai_interaction_message_id),
  snapshot_id uuid null references ai.ai_context_snapshot(ai_context_snapshot_id),
  invocation_id uuid null references ai.ai_model_invocation(ai_model_invocation_id),
  logical_operation_id uuid null,
  reply_message_id uuid null references ai.ai_interaction_message(ai_interaction_message_id),
  terminal_fingerprint text null check (terminal_fingerprint is null or terminal_fingerprint ~ '^[0-9A-F]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz null,
  retention_class text not null default 'sensitive_content' check (retention_class = 'sensitive_content'),
  primary key (actor_user_account_id, operation_id),
  check ((status = 'started' and completed_at is null) or (status <> 'started' and completed_at is not null)),
  check ((kind = 'send' and message_id is not null and snapshot_id is not null and invocation_id is not null and logical_operation_id is not null)
    or (kind <> 'send' and message_id is null and snapshot_id is null and invocation_id is null and logical_operation_id is null))
);
create unique index explorer_conversation_one_pending_turn_idx
  on ai.explorer_conversation_operation(conversation_id) where status = 'started';
create table ai.explorer_conversation_compass_item (
  item_id uuid primary key,
  conversation_id uuid not null references ai.explorer_conversation_state(conversation_id),
  source_message_id uuid not null references ai.ai_interaction_message(ai_interaction_message_id),
  label text not null check (char_length(btrim(label)) between 1 and 160),
  display_order integer not null check (display_order between 1 and 8),
  created_at timestamptz not null default clock_timestamp(),
  retention_class text not null default 'sensitive_content' check (retention_class = 'sensitive_content'),
  unique(conversation_id, display_order),
  unique(conversation_id, item_id)
);
alter table ai.explorer_conversation_state
  add foreign key (actor_user_account_id,pending_operation_id)
    references ai.explorer_conversation_operation(actor_user_account_id,operation_id),
  add foreign key (conversation_id,priority_id)
    references ai.explorer_conversation_compass_item(conversation_id,item_id),
  add foreign key (conversation_id,attention_id)
    references ai.explorer_conversation_compass_item(conversation_id,item_id);
create table content.waypoint (
  waypoint_id uuid primary key,
  guide_explorer_relationship_id uuid not null references core.guide_explorer_relationship(guide_explorer_relationship_id),
  source_ai_interaction_session_id uuid not null references ai.explorer_conversation_state(conversation_id),
  source_message_id uuid not null references ai.ai_interaction_message(ai_interaction_message_id),
  title text not null,
  destination text not null check (char_length(btrim(destination)) between 1 and 1000),
  why_it_matters text not null check (char_length(btrim(why_it_matters)) between 1 and 1000),
  arrival_signal text not null check (char_length(btrim(arrival_signal)) between 1 and 1000),
  lifecycle_status text not null check (lifecycle_status in ('chosen','reached')),
  chosen_by_explorer_user_account_id uuid not null references identity.user_account(user_account_id),
  chosen_at timestamptz not null,
  reached_by_explorer_user_account_id uuid null references identity.user_account(user_account_id),
  reached_at timestamptz null,
  reached_evidence text null check (reached_evidence is null or char_length(btrim(reached_evidence)) between 1 and 1000),
  visibility text not null default 'explorer_private' check (visibility = 'explorer_private'),
  created_at timestamptz not null default clock_timestamp(),
  retention_class text not null default 'sensitive_content' check (retention_class = 'sensitive_content'),
  check ((lifecycle_status = 'chosen' and reached_at is null and reached_by_explorer_user_account_id is null and reached_evidence is null)
    or (lifecycle_status = 'reached' and reached_at is not null and reached_by_explorer_user_account_id is not null and reached_evidence is not null))
);
alter table ai.explorer_conversation_state enable row level security;
alter table ai.explorer_conversation_operation enable row level security;
alter table ai.explorer_conversation_compass_item enable row level security;
alter table content.waypoint enable row level security;
revoke all on ai.explorer_conversation_state, ai.explorer_conversation_operation,
  ai.explorer_conversation_compass_item, content.waypoint from public, anon, authenticated, service_role;

-- Successor fields contain provenance/versions, not raw prompts or a JSON state dump.
alter table ai.ai_context_snapshot
  add column application_session_id uuid null references identity.user_session(user_session_id),
  add column immediate_message_id uuid null references ai.ai_interaction_message(ai_interaction_message_id),
  add column organization_id uuid null references core.organization(organization_id),
  add column practice_id uuid null references core.practice(practice_id),
  add column solmind_policy_version text null,
  add column ai_behavior_version text null,
  add column crisis_policy_version text null,
  add column role_policy_version text null,
  add column instruction_version text null,
  add column intake_response_set_id uuid null references core.intake_response_set(intake_response_set_id),
  add column related_prior_session_ids uuid[] null;
alter table ai.ai_context_snapshot drop constraint ai_context_snapshot_predispatch_evidence_shape_check;
alter table ai.ai_context_snapshot add constraint ai_context_snapshot_predispatch_evidence_shape_check check (
  (actor_user_account_id is null and explorer_profile_id is null and guide_explorer_relationship_id is null
   and authorization_version is null and active_required_consent_document_ids is null
   and context_source_ids is null and context_fingerprint_sha256 is null and evidence_contract_version is null)
  or
  (actor_user_account_id is not null and explorer_profile_id is not null and guide_explorer_relationship_id is not null
   and authorization_version is not null and active_required_consent_document_ids is not null
   and cardinality(active_required_consent_document_ids) between 1 and 16
   and array_position(active_required_consent_document_ids,null) is null
   and context_source_ids is not null and cardinality(context_source_ids) between 1 and 256
   and array_position(context_source_ids,null) is null
   and context_fingerprint_sha256 is not null and context_fingerprint_sha256 ~ '^[0-9A-F]{64}$'
   and evidence_contract_version is not null
   and (
     (evidence_contract_version = 'virtual-guide-predispatch-evidence.v1' and authorization_version ~ '^AV1:[0-9A-F]{64}$')
     or
     (evidence_contract_version = 'virtual-guide-predispatch-evidence.v2' and authorization_version ~ '^AV2:[0-9A-F]{64}$'
      and application_session_id is not null and immediate_message_id is not null
      and organization_id is not null and practice_id is not null
      and methodology_context_pack_version_id is not null and intake_response_set_id is not null
      and solmind_policy_version is not null and ai_behavior_version is not null
      and crisis_policy_version is not null and role_policy_version is not null and instruction_version is not null
      and related_prior_session_ids is not null and cardinality(related_prior_session_ids) = 0
      and related_summary_revision_ids = '[]'::jsonb and related_reflection_ids = '[]'::jsonb
      and related_waypoint_ids = '[]'::jsonb and related_goal_focus_area_ids = '[]'::jsonb
      and related_trigger_observation_ids = '[]'::jsonb)
   ))
);
alter table ai.ai_model_invocation drop constraint ai_model_invocation_predispatch_evidence_shape_check;
alter table ai.ai_context_snapshot add constraint ai_context_snapshot_successor_columns_check check (
  evidence_contract_version is not distinct from 'virtual-guide-predispatch-evidence.v2'
  or (application_session_id is null and immediate_message_id is null and organization_id is null
    and practice_id is null and solmind_policy_version is null and ai_behavior_version is null
    and crisis_policy_version is null and role_policy_version is null and instruction_version is null
    and intake_response_set_id is null and related_prior_session_ids is null)
);
alter table ai.ai_model_invocation add constraint ai_model_invocation_predispatch_evidence_shape_check check (
  (logical_operation_id is null and ai_context_snapshot_id is null and dispatch_contract_version is null)
  or
  (logical_operation_id is not null and ai_context_snapshot_id is not null and ai_interaction_session_id is not null
   and dispatch_contract_version is not null
   and dispatch_contract_version in ('virtual-guide-predispatch-evidence.v1','virtual-guide-predispatch-evidence.v2'))
);

create function ai.solmind_conversation_snapshot_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.evidence_contract_version = 'virtual-guide-predispatch-evidence.v2'
    or (tg_op = 'UPDATE' and old.evidence_contract_version = 'virtual-guide-predispatch-evidence.v1'
      and new.evidence_contract_version is distinct from old.evidence_contract_version) then
    raise exception 'solmind_explorer_conversation_snapshot_immutable';
  end if;
  if tg_op = 'UPDATE' then return new; end if;
  return old;
end $$;
create trigger explorer_conversation_snapshot_immutable
before update or delete on ai.ai_context_snapshot
for each row execute function ai.solmind_conversation_snapshot_immutable();

create function ai.solmind_conversation_text_valid(p_text text,p_limit integer,p_single_line boolean)
returns boolean language sql immutable set search_path = '' as $$
  select p_text is not null and char_length(btrim(p_text)) between 1 and p_limit
    and p_text !~ U&'[\0001-\0008\000B\000C\000E-\001F\007F-\009F]'
    and (not p_single_line or (p_text !~ '[[:cntrl:]]'
      and position(U&'\2028' in p_text) = 0 and position(U&'\2029' in p_text) = 0))
$$;

-- Lock order: operation advisory (command caller), AI session, account/role,
-- application session, Explorer, bound/other relationships, Practice,
-- Organization, consent definitions/records, intake, retained invocation/snapshot.
-- READ COMMITTED is mandatory; a browser selection never supplies authority.
create function ai.solmind_conversation_authority(
  p_actor uuid,p_app_session uuid,p_conversation uuid
) returns jsonb language plpgsql volatile security definer
set search_path = '' set lock_timeout = '2000ms' as $$
declare
  s ai.ai_interaction_session%rowtype;
  e core.explorer_profile%rowtype;
  r core.guide_explorer_relationship%rowtype;
  p core.practice%rowtype;
  o core.organization%rowtype;
  u identity.user_session%rowtype;
  i core.intake_response_set%rowtype;
  ids uuid[]; docs jsonb; answers jsonb; authority jsonb;
begin
  if current_setting('transaction_isolation') is distinct from 'read committed'
    or p_actor is null or p_app_session is null then
    raise exception 'solmind_explorer_conversation_denied';
  end if;
  if p_conversation is not null then
    select x.* into s from ai.ai_interaction_session x
      where x.ai_interaction_session_id=p_conversation for update;
    if not found or s.actor_user_account_id is distinct from p_actor
      or s.actor_role_context is distinct from 'explorer' or s.session_status is distinct from 'active'
      or s.session_type is distinct from 'explorer_reflection'
      or jsonb_typeof(s.metadata) is distinct from 'object'
      or (s.metadata ? 'restricted_mode' and s.metadata->'restricted_mode' is distinct from 'false'::jsonb)
    then raise exception 'solmind_explorer_conversation_denied'; end if;
  end if;
  perform a.user_account_id from identity.user_account a
    join identity.user_role_assignment ra on ra.user_account_id=a.user_account_id
      and ra.role_code='explorer' and ra.role_status='active'
      and ra.revoked_at is null and ra.granted_at<=clock_timestamp()
    where a.user_account_id=p_actor and a.account_status='active' for share of a,ra;
  if not found then raise exception 'solmind_explorer_conversation_denied'; end if;
  select x.* into u from identity.user_session x
    where x.user_session_id=p_app_session for share;
  if not found or u.user_account_id is distinct from p_actor
    or u.active_role_context is distinct from 'explorer' or u.session_status is distinct from 'active'
    or u.ended_at is not null or u.expires_at <= clock_timestamp()
    or (select count(*) from identity.user_session x where x.user_account_id=p_actor and x.session_status='active') <> 1
  then raise exception 'solmind_explorer_conversation_denied'; end if;
  select x.* into e from core.explorer_profile x
    where x.user_account_id=p_actor and x.status='active' for update;
  if not found or e.onboarding_status is distinct from 'active' then
    raise exception 'solmind_explorer_conversation_denied'; end if;
  if p_conversation is not null and s.explorer_profile_id is distinct from e.explorer_profile_id then
    raise exception 'solmind_explorer_conversation_denied'; end if;
  if p_conversation is not null and exists(select 1 from ai.ai_interaction_message m
    where m.ai_interaction_session_id=p_conversation and (
      (m.sender_type='user' and m.sender_user_account_id=p_actor and m.sender_role_context='explorer')
      or (m.sender_type='ai' and m.ai_role='solmind_virtual_guide' and m.sender_user_account_id is null)
    ) is not true) then raise exception 'solmind_explorer_conversation_denied'; end if;
  select x.* into r from core.guide_explorer_relationship x
    where x.explorer_profile_id=e.explorer_profile_id and x.relationship_status in ('active','paused')
    order by x.guide_explorer_relationship_id limit 1 for update;
  if not found then raise exception 'solmind_explorer_conversation_denied'; end if;
  perform x.guide_explorer_relationship_id from core.guide_explorer_relationship x
    where x.explorer_profile_id=e.explorer_profile_id order by x.guide_explorer_relationship_id for share;
  if exists(select 1 from core.guide_explorer_relationship x where x.explorer_profile_id=e.explorer_profile_id
      and x.guide_explorer_relationship_id<>r.guide_explorer_relationship_id
      and (x.relationship_status is null or x.relationship_status not in ('ended','transferred')))
    or (p_conversation is not null and
      (s.guide_explorer_relationship_id is distinct from r.guide_explorer_relationship_id
       or s.practice_id is distinct from r.practice_id))
  then raise exception 'solmind_explorer_conversation_denied'; end if;
  select x.* into p from core.practice x where x.practice_id=r.practice_id for share;
  if not found or p.status is distinct from 'active' or p.approval_status is distinct from 'approved'
    then raise exception 'solmind_explorer_conversation_denied'; end if;
  select x.* into o from core.organization x where x.organization_id=p.organization_id for share;
  if not found or o.status is distinct from 'active' or o.approval_status is distinct from 'approved'
    then raise exception 'solmind_explorer_conversation_denied'; end if;
  lock table core.consent_document in share mode;
  select array_agg(d.consent_document_id order by d.consent_document_id::text),
    jsonb_agg(jsonb_build_array(d.consent_document_id,d.version_label,d.consent_type) order by d.consent_document_id::text)
    into ids,docs from core.consent_document d
    where d.document_status='active' and d.is_required_for_explorer is true;
  if ids is null or cardinality(ids) not between 1 and 16 then
    raise exception 'solmind_explorer_conversation_denied'; end if;
  perform cr.consent_record_id from core.consent_record cr join core.consent_document d
    on d.consent_document_id=cr.consent_document_id
    where cr.user_account_id=p_actor and cr.role_context='explorer' and cr.consent_document_id=any(ids)
      and cr.consent_type=d.consent_type and cr.document_version=d.version_label and cr.adult_affirmation is true
    order by cr.consent_record_id for share of cr;
  if exists(select 1 from core.consent_document d where d.consent_document_id=any(ids)
    and not exists(select 1 from core.consent_record cr where cr.user_account_id=p_actor
      and cr.role_context='explorer' and cr.consent_document_id=d.consent_document_id
      and cr.consent_type=d.consent_type and cr.document_version=d.version_label and cr.adult_affirmation is true))
  then raise exception 'solmind_explorer_conversation_denied'; end if;
  select x.* into i from core.intake_response_set x
    where x.guide_explorer_relationship_id=r.guide_explorer_relationship_id and x.intake_status='completed'
    order by x.completed_at desc,x.intake_response_set_id desc limit 1 for share;
  if not found or i.completed_at is null or i.completed_at>clock_timestamp()
    or jsonb_typeof(i.response_json) is distinct from 'object'
  then raise exception 'solmind_explorer_conversation_denied'; end if;
  if exists(select 1 from jsonb_object_keys(i.response_json) as keys(key)
      where key not in ('supportNow','usefulOutcome','supportStyle','guideContext','communicationPreference','doNotEmphasize'))
    or exists(select 1 from unnest(array['supportNow','usefulOutcome','supportStyle']) k
      where jsonb_typeof(i.response_json->k) is distinct from 'string'
        or not ai.solmind_conversation_text_valid(i.response_json->>k,8192,false))
    or exists(select 1 from jsonb_each(i.response_json) kv
      where jsonb_typeof(kv.value) is distinct from 'string' or char_length(kv.value#>>'{}')>8192)
  then raise exception 'solmind_explorer_conversation_denied'; end if;
  answers:=jsonb_build_object('supportNow',i.response_json->>'supportNow','usefulOutcome',i.response_json->>'usefulOutcome',
    'supportStyle',i.response_json->>'supportStyle','guideContext',coalesce(i.response_json->>'guideContext',''),
    'communicationPreference',coalesce(i.response_json->>'communicationPreference',''),
    'doNotEmphasize',coalesce(i.response_json->>'doNotEmphasize',''));
  authority:=jsonb_build_object('accountId',p_actor,'explorerId',e.explorer_profile_id,
    'relationshipId',r.guide_explorer_relationship_id,'guideId',r.guide_profile_id,
    'relationshipStatus',r.relationship_status,'practiceId',p.practice_id,'organizationId',o.organization_id,
    'applicationSessionId',p_app_session,'applicationSessionExpiresAt',u.expires_at,
    'onboardingStatus','active','adultAffirmation',true,
    'onboarding',jsonb_build_object('responseId',i.intake_response_set_id,'answers',answers),
    'requiredConsentDocumentIds',to_jsonb(ids));
  return authority || jsonb_build_object('authorizationVersion','AV2:'||upper(encode(extensions.digest(
    convert_to((authority||jsonb_build_object('requiredConsentVersions',docs))::text,'UTF8'),'sha256'),'hex')));
end $$;

create function ai.solmind_conversation_state_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('version','explorer-conversation.v1','conversationId',p_id,
    'revision',coalesce(s.revision,0),'providerState','unavailable',
    'pendingTurn',s.pending_operation_id is not null,
    'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.ai_interaction_message_id,
      'role',case when m.sender_type='user' then 'explorer' else 'virtualGuide' end,
      'body',m.content_text,'createdAt',m.created_at) order by m.sequence_number)
      from ai.ai_interaction_message m where m.ai_interaction_session_id=p_id and m.sender_type in ('user','ai')),'[]'::jsonb),
    'compassItems',coalesce((select jsonb_agg(jsonb_build_object('id',c.item_id,'sourceMessageId',c.source_message_id,
      'label',c.label) order by c.display_order) from ai.explorer_conversation_compass_item c where c.conversation_id=p_id),'[]'::jsonb),
    'priorityId',s.priority_id,'attentionId',s.attention_id,
    'waypoints',coalesce((select jsonb_agg(jsonb_build_object('id',w.waypoint_id,'sourceMessageId',w.source_message_id,
      'destination',w.destination,'meaning',w.why_it_matters,'arrivalSignal',w.arrival_signal,
      'status',w.lifecycle_status) order by w.created_at,w.waypoint_id)
      from content.waypoint w where w.source_ai_interaction_session_id=p_id),'[]'::jsonb))
  from (select 1) anchor left join ai.explorer_conversation_state s on s.conversation_id=p_id
$$;

create function public.solmind_read_explorer_conversation(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid default null,
  p_operation_id uuid default null,p_command_fingerprint text default null
) returns table(outcome text,conversation_state jsonb,authority_context jsonb)
language plpgsql volatile security definer set search_path = '' set lock_timeout = '2000ms' as $$
declare v_id uuid; a jsonb; op ai.explorer_conversation_operation%rowtype;
  replay boolean := false; selection_conflict boolean := false;
begin
  if (p_operation_id is null) is distinct from (p_command_fingerprint is null)
    or (p_command_fingerprint is not null and p_command_fingerprint !~ '^[0-9A-F]{64}$')
  then raise exception 'solmind_explorer_conversation_invalid_input'; end if;
  v_id:=p_conversation_id;
  if p_operation_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('solmind:explorer-conversation:v2|'||p_actor_user_account_id::text||'|'||p_operation_id::text,0));
    select x.* into op from ai.explorer_conversation_operation x
      where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id;
    replay:=found;
    if replay then
      selection_conflict:=p_conversation_id is not null and p_conversation_id is distinct from op.conversation_id;
      v_id:=op.conversation_id;
    end if;
  end if;
  if v_id is null then
    select s.conversation_id into v_id from ai.explorer_conversation_state s
      join ai.ai_interaction_session x on x.ai_interaction_session_id=s.conversation_id
      where s.actor_user_account_id=p_actor_user_account_id and x.session_status='active'
      order by s.created_at desc,s.conversation_id desc limit 1;
  elsif not exists(select 1 from ai.explorer_conversation_state x where x.conversation_id=v_id
      and x.actor_user_account_id=p_actor_user_account_id) then
    raise exception 'solmind_explorer_conversation_denied';
  end if;
  a:=ai.solmind_conversation_authority(p_actor_user_account_id,p_user_session_id,v_id);
  if replay then
    select x.* into op from ai.explorer_conversation_operation x
      where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id for update;
    if not found or selection_conflict or op.application_session_id is distinct from p_user_session_id
      or op.command_fingerprint is distinct from p_command_fingerprint
    then raise exception 'solmind_explorer_conversation_operation_conflict'; end if;
  end if;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then
    raise exception 'solmind_explorer_conversation_denied'; end if;
  return query select case when replay then 'exact_replay' else 'ok' end,
    ai.solmind_conversation_state_json(v_id),a;
end $$;

create function public.solmind_prepare_explorer_conversation_turn(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,
  p_operation_id uuid,p_expected_revision integer,p_message_id uuid,p_snapshot_id uuid,p_invocation_id uuid,
  p_body text,p_context_serialization text,p_context_fingerprint_sha256 text,p_context_source_ids uuid[],
  p_authorization_version text,p_intake_response_set_id uuid,p_methodology_context_pack_version_id uuid,
  p_prompt_version text,p_policy_version text,p_behavior_version text,p_crisis_version text,
  p_role_version text,p_instruction_version text,p_command_fingerprint text,p_logical_operation_id uuid
) returns table(outcome text,conversation_state jsonb,dispatch_permitted boolean)
language plpgsql volatile security definer set search_path = '' set lock_timeout = '2000ms' as $$
declare
  a jsonb; h text; old_op ai.explorer_conversation_operation%rowtype;
  st ai.explorer_conversation_state%rowtype; exists_state boolean; n integer; ts timestamptz;
  ids uuid[]; v_contract constant text := 'virtual-guide-predispatch-evidence.v2';
begin
  if p_conversation_id is null or p_operation_id is null or p_message_id is null or p_snapshot_id is null
    or p_invocation_id is null or p_logical_operation_id is null or p_expected_revision is null or p_expected_revision<0
    or not ai.solmind_conversation_text_valid(p_body,8192,false)
    or p_context_serialization is null or octet_length(p_context_serialization) not between 2 and 524288
    or p_context_fingerprint_sha256 is null or p_context_fingerprint_sha256 !~ '^[0-9A-F]{64}$'
    or p_context_fingerprint_sha256 is distinct from upper(encode(extensions.digest(convert_to(p_context_serialization,'UTF8'),'sha256'),'hex'))
    or p_intake_response_set_id is null or p_methodology_context_pack_version_id is null
    or p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$'
    or p_context_source_ids is null or cardinality(p_context_source_ids) not between 3 and 103
    or array_position(p_context_source_ids,null) is not null
    or exists(select 1 from unnest(array[p_prompt_version,p_policy_version,p_behavior_version,
      p_crisis_version,p_role_version,p_instruction_version]) as versions(version)
      where version is null or version !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$')
  then raise exception 'solmind_explorer_conversation_invalid_input'; end if;
  select array_agg(distinct x order by x) into ids from unnest(p_context_source_ids) as sources(x);
  if ids is distinct from p_context_source_ids or not(p_message_id=any(ids))
    or not(p_intake_response_set_id=any(ids)) or not(p_methodology_context_pack_version_id=any(ids))
  then raise exception 'solmind_explorer_conversation_invalid_input'; end if;
  perform pg_advisory_xact_lock(hashtextextended('solmind:explorer-conversation:v2|'||p_actor_user_account_id::text||'|'||p_operation_id::text,0));
  select exists(select 1 from ai.explorer_conversation_state s where s.conversation_id=p_conversation_id)
    into exists_state;
  a:=ai.solmind_conversation_authority(p_actor_user_account_id,p_user_session_id,
    case when exists_state then p_conversation_id else null end);
  if a->>'authorizationVersion' is distinct from p_authorization_version
    or (a->'onboarding'->>'responseId')::uuid is distinct from p_intake_response_set_id
  then raise exception 'solmind_explorer_conversation_denied'; end if;
  if exists(select 1 from unnest(ids) as sources(x)
    where x<>p_message_id and x<>p_intake_response_set_id and x<>p_methodology_context_pack_version_id
      and not exists(select 1 from ai.ai_interaction_message m where m.ai_interaction_message_id=x
        and m.ai_interaction_session_id=p_conversation_id and m.sender_type in ('user','ai')))
  then raise exception 'solmind_explorer_conversation_denied'; end if;
  h:=upper(encode(extensions.digest(convert_to(jsonb_build_array(p_user_session_id,p_conversation_id,
    p_expected_revision,p_message_id,p_snapshot_id,p_invocation_id,p_body,p_context_fingerprint_sha256,ids,
    p_authorization_version,p_intake_response_set_id,p_methodology_context_pack_version_id,
    p_prompt_version,p_policy_version,p_behavior_version,p_crisis_version,p_role_version,p_instruction_version,p_command_fingerprint,p_logical_operation_id)::text,
    'UTF8'),'sha256'),'hex'));
  select x.* into old_op from ai.explorer_conversation_operation x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id for update;
  if found then
    if old_op.request_fingerprint is distinct from h or old_op.command_fingerprint is distinct from p_command_fingerprint
      or old_op.kind is distinct from 'send'
      or old_op.conversation_id is distinct from p_conversation_id then
      raise exception 'solmind_explorer_conversation_operation_conflict'; end if;
    return query select 'exact_replay'::text,ai.solmind_conversation_state_json(p_conversation_id),false;
    return;
  end if;
  if not exists_state then
    -- Authority holds the Explorer row lock. A second tab may have read the
    -- empty state before another tab committed its first turn; do not create
    -- a second active conversation or dispatch from that stale empty read.
    if exists(select 1 from ai.explorer_conversation_state s
      join ai.ai_interaction_session x on x.ai_interaction_session_id=s.conversation_id
      where s.actor_user_account_id=p_actor_user_account_id and x.session_status='active') then
      return query select 'stale_revision'::text,null::jsonb,false; return;
    end if;
    if p_expected_revision<>0 then
      return query select 'stale_revision'::text,null::jsonb,false; return; end if;
    ts:=clock_timestamp();
    insert into ai.ai_interaction_session(ai_interaction_session_id,session_type,actor_user_account_id,
      actor_role_context,guide_profile_id,explorer_profile_id,guide_explorer_relationship_id,practice_id,
      started_at,last_activity_at)
    values(p_conversation_id,'explorer_reflection',p_actor_user_account_id,'explorer',(a->>'guideId')::uuid,
      (a->>'explorerId')::uuid,(a->>'relationshipId')::uuid,(a->>'practiceId')::uuid,ts,ts);
    insert into ai.explorer_conversation_state(conversation_id,actor_user_account_id)
      values(p_conversation_id,p_actor_user_account_id);
  end if;
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id for update;
  if st.actor_user_account_id is distinct from p_actor_user_account_id then
    raise exception 'solmind_explorer_conversation_denied'; end if;
  if st.revision<>p_expected_revision then
    return query select 'stale_revision'::text,null::jsonb,false; return; end if;
  if st.pending_operation_id is not null then
    return query select 'unavailable'::text,null::jsonb,false; return; end if;
  select count(*)::integer into n from ai.ai_interaction_message m where m.ai_interaction_session_id=p_conversation_id;
  if n>98 then return query select 'unavailable'::text,null::jsonb,false; return; end if;
  ts:=clock_timestamp();
  insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
    sender_type,sender_user_account_id,sender_role_context,content_text,created_at)
    values(p_message_id,p_conversation_id,n+1,'user',p_actor_user_account_id,'explorer',p_body,ts);
  insert into ai.ai_context_snapshot(ai_context_snapshot_id,ai_interaction_session_id,ai_interaction_message_id,
    prompt_version,methodology_context_pack_version_id,actor_user_account_id,explorer_profile_id,
    guide_explorer_relationship_id,authorization_version,active_required_consent_document_ids,context_source_ids,
    context_fingerprint_sha256,evidence_contract_version,application_session_id,immediate_message_id,
    organization_id,practice_id,solmind_policy_version,ai_behavior_version,crisis_policy_version,
    role_policy_version,instruction_version,intake_response_set_id,related_prior_session_ids,created_at)
    values(p_snapshot_id,p_conversation_id,p_message_id,p_prompt_version,p_methodology_context_pack_version_id,
      p_actor_user_account_id,(a->>'explorerId')::uuid,(a->>'relationshipId')::uuid,p_authorization_version,
      array(select jsonb_array_elements_text(a->'requiredConsentDocumentIds')::uuid),ids,
      p_context_fingerprint_sha256,v_contract,p_user_session_id,p_message_id,(a->>'organizationId')::uuid,
      (a->>'practiceId')::uuid,p_policy_version,p_behavior_version,p_crisis_version,p_role_version,
      p_instruction_version,p_intake_response_set_id,array[]::uuid[],ts);
  insert into ai.ai_model_invocation(ai_model_invocation_id,ai_interaction_session_id,provider_name,model_name,
    prompt_version,logical_operation_id,ai_context_snapshot_id,dispatch_contract_version,started_at)
    values(p_invocation_id,p_conversation_id,'openai','gpt-5.6-luna',p_prompt_version,p_logical_operation_id,p_snapshot_id,v_contract,ts);
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
    conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,message_id,snapshot_id,invocation_id,logical_operation_id)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,'send',h,p_command_fingerprint,
      p_expected_revision,'started',p_message_id,p_snapshot_id,p_invocation_id,p_logical_operation_id);
  insert into audit.audit_event(event_type,actor_user_account_id,actor_role_context,target_entity_type,
    target_entity_id,action,reason_code,event_summary,metadata)
    values('ai_context_snapshot_created',p_actor_user_account_id,'explorer','ai_context_snapshot',p_snapshot_id,
      'create','pre_dispatch_snapshot_created','Virtual Guide context snapshot created before provider dispatch.',
      jsonb_build_object('contract_version',v_contract,'operation_id',p_logical_operation_id::text,
        'role_context','explorer','session_id',p_conversation_id::text)),
    ('ai_model_invocation_started',p_actor_user_account_id,'explorer','ai_model_invocation',p_invocation_id,
      'start','pre_dispatch_invocation_started','Virtual Guide model invocation started before provider dispatch.',
      jsonb_build_object('context_snapshot_id',p_snapshot_id::text,'contract_version',v_contract,
        'model_name','gpt-5.6-luna','operation_id',p_logical_operation_id::text,'provider_name','openai',
        'request_status','started','role_context','explorer','session_id',p_conversation_id::text));
  update ai.explorer_conversation_state set revision=revision+1,pending_operation_id=p_operation_id
    where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then
    raise exception 'solmind_explorer_conversation_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id),true;
end $$;

create function public.solmind_complete_explorer_conversation_turn(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_status text,p_reply_message_id uuid,p_reply_body text
) returns table(outcome text,conversation_state jsonb)
language plpgsql volatile security definer set search_path = '' set lock_timeout = '2000ms' as $$
declare a jsonb; op ai.explorer_conversation_operation%rowtype; st ai.explorer_conversation_state%rowtype;
  h text; n integer; ts timestamptz;
begin
  if p_conversation_id is null or p_operation_id is null or p_status is null
    or p_status not in ('completed','failed','canceled')
    or (p_status='completed' and (p_reply_message_id is null or not ai.solmind_conversation_text_valid(p_reply_body,8192,false)))
    or (p_status<>'completed' and (p_reply_message_id is not null or p_reply_body is not null))
  then raise exception 'solmind_explorer_conversation_invalid_input'; end if;
  perform pg_advisory_xact_lock(hashtextextended('solmind:explorer-conversation:v2|'||p_actor_user_account_id::text||'|'||p_operation_id::text,0));
  if p_status='completed' then
    a:=ai.solmind_conversation_authority(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  else
    -- Internal, value-free settlement of a previously authorized operation is
    -- still necessary after its browser session ends. This path cannot append
    -- a reply, return private state, dispatch or authorize a new browser action.
    perform s.ai_interaction_session_id from ai.ai_interaction_session s
      where s.ai_interaction_session_id=p_conversation_id and s.actor_user_account_id=p_actor_user_account_id
        and s.actor_role_context='explorer' and s.session_type='explorer_reflection' for update;
    if not found then raise exception 'solmind_explorer_conversation_denied'; end if;
    perform u.user_session_id from identity.user_session u where u.user_session_id=p_user_session_id
      and u.user_account_id=p_actor_user_account_id and u.active_role_context='explorer' for share;
    if not found then raise exception 'solmind_explorer_conversation_denied'; end if;
  end if;
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id then
    raise exception 'solmind_explorer_conversation_denied'; end if;
  select x.* into op from ai.explorer_conversation_operation x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id for update;
  if not found or op.kind is distinct from 'send' or op.conversation_id is distinct from p_conversation_id
    or op.application_session_id is distinct from p_user_session_id then
    raise exception 'solmind_explorer_conversation_denied'; end if;
  h:=upper(encode(extensions.digest(convert_to(jsonb_build_array(p_status,p_reply_message_id,p_reply_body)::text,'UTF8'),'sha256'),'hex'));
  if op.status is distinct from 'started' then
    if op.terminal_fingerprint is distinct from h then
      raise exception 'solmind_explorer_conversation_operation_conflict'; end if;
    return query select 'exact_replay'::text,
      case when p_status='completed' then ai.solmind_conversation_state_json(p_conversation_id) else null::jsonb end; return;
  end if;
  if st.pending_operation_id is distinct from p_operation_id then
    raise exception 'solmind_explorer_conversation_operation_conflict'; end if;
  perform v.ai_model_invocation_id from ai.ai_model_invocation v
    where v.ai_model_invocation_id=op.invocation_id and v.request_status='started'
      and v.ai_interaction_session_id=p_conversation_id and v.ai_context_snapshot_id=op.snapshot_id
      and v.logical_operation_id=op.logical_operation_id
      and v.dispatch_contract_version='virtual-guide-predispatch-evidence.v2' for update;
  if not found then raise exception 'solmind_explorer_conversation_unavailable'; end if;
  ts:=clock_timestamp();
  if p_status='completed' then
    select count(*)::integer into n from ai.ai_interaction_message m where m.ai_interaction_session_id=p_conversation_id;
    if n>=100 then raise exception 'solmind_explorer_conversation_unavailable'; end if;
    insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
      sender_type,ai_role,content_text,created_at)
      values(p_reply_message_id,p_conversation_id,n+1,'ai','solmind_virtual_guide',p_reply_body,ts);
  end if;
  update ai.ai_model_invocation set request_status=p_status,completed_at=ts,
    ai_interaction_message_id=p_reply_message_id,
    error_summary=case when p_status='failed' then 'provider_unavailable' else null end
    where ai_model_invocation_id=op.invocation_id;
  update ai.explorer_conversation_operation set status=p_status,completed_at=ts,
    terminal_fingerprint=h,reply_message_id=p_reply_message_id
    where actor_user_account_id=p_actor_user_account_id and operation_id=p_operation_id;
  update ai.explorer_conversation_state set revision=revision+1,pending_operation_id=null where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if p_status='completed' and (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then
    raise exception 'solmind_explorer_conversation_denied'; end if;
  return query select 'ok'::text,
    case when p_status='completed' then ai.solmind_conversation_state_json(p_conversation_id) else null::jsonb end;
end $$;

create function public.solmind_mutate_explorer_conversation(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_expected_revision integer,p_kind text,p_command_fingerprint text,p_source_message_id uuid default null,p_item_id uuid default null,
  p_waypoint_id uuid default null,p_label text default null,p_destination text default null,
  p_meaning text default null,p_arrival_signal text default null,p_evidence text default null
) returns table(outcome text,conversation_state jsonb)
language plpgsql volatile security definer set search_path = '' set lock_timeout = '2000ms' as $$
declare a jsonb; h text; op ai.explorer_conversation_operation%rowtype;
  st ai.explorer_conversation_state%rowtype; n integer; ts timestamptz;
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
    if n>=8 then return query select 'unavailable'::text,null::jsonb; return; end if;
    insert into ai.explorer_conversation_compass_item(item_id,conversation_id,source_message_id,label,display_order)
      values(p_operation_id,p_conversation_id,p_source_message_id,p_label,n+1);
  elsif p_kind in ('confirm_priority','set_attention') then
    if not exists(select 1 from ai.explorer_conversation_compass_item c where c.item_id=p_item_id and c.conversation_id=p_conversation_id)
      then raise exception 'solmind_explorer_conversation_denied'; end if;
    if p_kind='confirm_priority' then update ai.explorer_conversation_state set priority_id=p_item_id where conversation_id=p_conversation_id;
    else update ai.explorer_conversation_state set attention_id=p_item_id where conversation_id=p_conversation_id; end if;
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
    conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,completed_at)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,p_kind,h,p_command_fingerprint,p_expected_revision,'completed',ts);
  update ai.explorer_conversation_state set revision=revision+1 where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp() then
    raise exception 'solmind_explorer_conversation_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id);
end $$;

-- Internal helpers have no callable application role. Only exact public RPCs are exposed.
do $privileges$
declare f record;
begin
  for f in select p.oid::regprocedure as signature,n.nspname as schema_name
    from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='ai' and p.proname in ('solmind_conversation_snapshot_immutable',
      'solmind_conversation_text_valid','solmind_conversation_authority','solmind_conversation_state_json'))
      or (n.nspname='public' and p.proname in ('solmind_read_explorer_conversation',
        'solmind_prepare_explorer_conversation_turn','solmind_complete_explorer_conversation_turn',
        'solmind_mutate_explorer_conversation'))
  loop
    execute pg_catalog.format('alter function %s owner to postgres',f.signature);
    execute pg_catalog.format('revoke all on function %s from public, anon, authenticated, service_role',f.signature);
    if f.schema_name='public' then
      execute pg_catalog.format('grant execute on function %s to service_role',f.signature);
    end if;
  end loop;
end $privileges$;
comment on table content.waypoint is 'Explorer-private confirmed destination, chosen only by explicit Explorer confirmation. Reached requires explicit arrival evidence. No sharing path.';
comment on function public.solmind_read_explorer_conversation(uuid,uuid,uuid,uuid,text) is 'Closed service-role private Explorer state, authenticated exact-command replay preflight and whitelisted server-only authority. Browser selectors are never authority.';
commit;
