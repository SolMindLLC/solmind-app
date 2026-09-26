-- SolMind MVP0 Virtual Guide pre-dispatch evidence foundation.
-- Purpose:
--   - bind one logical Virtual Guide dispatch to one context snapshot and one
--     started model invocation before provider I/O;
--   - revalidate the current Explorer/session/relationship/consent authority;
--   - persist two closed, value-free Family E lifecycle events atomically; and
--   - make exact retry observable without authorizing a second provider call.
--
-- This migration intentionally creates no users, no permissive RLS policies,
-- no direct table grants, no real pilot data, no provider call, no credential
-- reader, no route, no message persistence, no safety runtime, no deployment,
-- and no real-user activation.

alter table ai.ai_context_snapshot
  add column if not exists actor_user_account_id uuid null
    references identity.user_account(user_account_id),
  add column if not exists explorer_profile_id uuid null
    references core.explorer_profile(explorer_profile_id),
  add column if not exists guide_explorer_relationship_id uuid null
    references core.guide_explorer_relationship(guide_explorer_relationship_id),
  add column if not exists authorization_version text null,
  add column if not exists active_required_consent_document_ids uuid[] null,
  add column if not exists context_source_ids uuid[] null,
  add column if not exists context_fingerprint_sha256 text null,
  add column if not exists evidence_contract_version text null;

alter table ai.ai_context_snapshot
  add constraint ai_context_snapshot_predispatch_evidence_shape_check
  check (
    (
      actor_user_account_id is null
      and explorer_profile_id is null
      and guide_explorer_relationship_id is null
      and authorization_version is null
      and active_required_consent_document_ids is null
      and context_source_ids is null
      and context_fingerprint_sha256 is null
      and evidence_contract_version is null
    )
    or
    (
      actor_user_account_id is not null
      and explorer_profile_id is not null
      and guide_explorer_relationship_id is not null
      and authorization_version is not null
      and authorization_version ~ '^AV1:[0-9A-F]{64}$'
      and active_required_consent_document_ids is not null
      and pg_catalog.cardinality(active_required_consent_document_ids)
        between 1 and 16
      and pg_catalog.array_position(active_required_consent_document_ids, null)
        is null
      and context_source_ids is not null
      and pg_catalog.cardinality(context_source_ids) between 1 and 256
      and pg_catalog.array_position(context_source_ids, null) is null
      and context_fingerprint_sha256 is not null
      and context_fingerprint_sha256 ~ '^[0-9A-F]{64}$'
      and evidence_contract_version is not null
      and evidence_contract_version =
        'virtual-guide-predispatch-evidence.v1'
    )
  ) not valid;

alter table ai.ai_context_snapshot
  validate constraint ai_context_snapshot_predispatch_evidence_shape_check;

create index if not exists ai_context_snapshot_explorer_created_idx
  on ai.ai_context_snapshot (explorer_profile_id, created_at desc)
  where explorer_profile_id is not null;

create index if not exists ai_context_snapshot_relationship_created_idx
  on ai.ai_context_snapshot (guide_explorer_relationship_id, created_at desc)
  where guide_explorer_relationship_id is not null;

alter table ai.ai_model_invocation
  add column if not exists logical_operation_id uuid null,
  add column if not exists ai_context_snapshot_id uuid null
    references ai.ai_context_snapshot(ai_context_snapshot_id),
  add column if not exists dispatch_contract_version text null;

alter table ai.ai_model_invocation
  add constraint ai_model_invocation_predispatch_evidence_shape_check
  check (
    (
      logical_operation_id is null
      and ai_context_snapshot_id is null
      and dispatch_contract_version is null
    )
    or
    (
      logical_operation_id is not null
      and ai_context_snapshot_id is not null
      and ai_interaction_session_id is not null
      and dispatch_contract_version =
        'virtual-guide-predispatch-evidence.v1'
    )
  ) not valid;

alter table ai.ai_model_invocation
  validate constraint ai_model_invocation_predispatch_evidence_shape_check;

create unique index if not exists ai_model_invocation_logical_operation_unique_idx
  on ai.ai_model_invocation (logical_operation_id)
  where logical_operation_id is not null;

create unique index if not exists ai_model_invocation_context_snapshot_unique_idx
  on ai.ai_model_invocation (ai_context_snapshot_id)
  where ai_context_snapshot_id is not null;

create function public.solmind_prepare_virtual_guide_predispatch(
  p_logical_operation_id uuid,
  p_ai_context_snapshot_id uuid,
  p_ai_model_invocation_id uuid,
  p_ai_interaction_session_id uuid,
  p_actor_user_account_id uuid,
  p_explorer_profile_id uuid,
  p_guide_explorer_relationship_id uuid,
  p_authorization_version text,
  p_active_required_consent_document_ids uuid[],
  p_context_source_ids uuid[],
  p_context_fingerprint_sha256 text
)
returns table (
  preparation_state text,
  prepared_context_snapshot_id uuid,
  prepared_model_invocation_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '2000ms'
as $$
declare
  v_contract_version constant text :=
    'virtual-guide-predispatch-evidence.v1';
  v_prompt_version constant text := 'virtual-guide-conversation.v1';
  v_provider_name constant text := 'openai';
  v_model_name constant text := 'gpt-5.6-luna';
  v_session ai.ai_interaction_session%rowtype;
  v_explorer core.explorer_profile%rowtype;
  v_relationship core.guide_explorer_relationship%rowtype;
  v_practice core.practice%rowtype;
  v_existing_invocation ai.ai_model_invocation%rowtype;
  v_existing_snapshot ai.ai_context_snapshot%rowtype;
  v_required_consent_ids uuid[];
  v_canonical_consent_ids uuid[];
  v_canonical_source_ids uuid[];
  v_expected_authorization_version text;
  v_now timestamptz;
  v_snapshot_audit_count bigint;
  v_invocation_audit_count bigint;
begin
  if p_logical_operation_id is null
     or p_ai_context_snapshot_id is null
     or p_ai_model_invocation_id is null
     or p_ai_interaction_session_id is null
     or p_actor_user_account_id is null
     or p_explorer_profile_id is null
     or p_guide_explorer_relationship_id is null
  then
    raise exception 'solmind_virtual_guide_predispatch_invalid_input';
  end if;

  if p_authorization_version is null
     or p_authorization_version !~ '^AV1:[0-9A-F]{64}$'
     or p_context_fingerprint_sha256 is null
     or p_context_fingerprint_sha256 !~ '^[0-9A-F]{64}$'
  then
    raise exception 'solmind_virtual_guide_predispatch_invalid_input';
  end if;

  if p_active_required_consent_document_ids is null
     or pg_catalog.cardinality(p_active_required_consent_document_ids)
          not between 1 and 16
     or pg_catalog.array_position(
          p_active_required_consent_document_ids,
          null
        ) is not null
     or p_context_source_ids is null
     or pg_catalog.cardinality(p_context_source_ids) not between 1 and 256
     or pg_catalog.array_position(p_context_source_ids, null) is not null
  then
    raise exception 'solmind_virtual_guide_predispatch_invalid_input';
  end if;

  select pg_catalog.array_agg(consent_id order by consent_id::text)
    into v_canonical_consent_ids
    from (
      select distinct consent_id
        from pg_catalog.unnest(
          p_active_required_consent_document_ids
        ) as consent_values(consent_id)
    ) canonical_consents;

  select pg_catalog.array_agg(source_id order by source_id::text)
    into v_canonical_source_ids
    from (
      select distinct source_id
        from pg_catalog.unnest(p_context_source_ids)
          as source_values(source_id)
    ) canonical_sources;

  if v_canonical_consent_ids is distinct from
       p_active_required_consent_document_ids
     or v_canonical_source_ids is distinct from p_context_source_ids
  then
    raise exception 'solmind_virtual_guide_predispatch_noncanonical_input';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'solmind:virtual-guide-predispatch:v1|'
      || p_logical_operation_id::text,
      0
    )
  );

  select session.*
    into v_session
    from ai.ai_interaction_session session
   where session.ai_interaction_session_id = p_ai_interaction_session_id
   for update;

  if not found
     or v_session.actor_user_account_id <> p_actor_user_account_id
     or v_session.actor_role_context <> 'explorer'
     or v_session.session_type not in (
       'explorer_reflection',
       'explorer_check_in',
       'explorer_waypoint'
     )
     or v_session.explorer_profile_id <> p_explorer_profile_id
     or v_session.guide_explorer_relationship_id <>
          p_guide_explorer_relationship_id
     or v_session.session_status <> 'active'
     or pg_catalog.jsonb_typeof(v_session.metadata) <> 'object'
     or (
       v_session.metadata ? 'restricted_mode'
       and case
         when pg_catalog.jsonb_typeof(
           v_session.metadata -> 'restricted_mode'
         ) = 'boolean'
         then (v_session.metadata ->> 'restricted_mode')::boolean
         else true
       end
     )
  then
    raise exception 'solmind_virtual_guide_predispatch_authority_denied';
  end if;

  perform account.user_account_id
    from identity.user_account account
    join identity.user_role_assignment assignment
      on assignment.user_account_id = account.user_account_id
     and assignment.role_code = 'explorer'
     and assignment.role_status = 'active'
   where account.user_account_id = p_actor_user_account_id
     and account.account_status = 'active'
   for share of account, assignment;

  if not found then
    raise exception 'solmind_virtual_guide_predispatch_authority_denied';
  end if;

  select explorer.*
    into v_explorer
    from core.explorer_profile explorer
   where explorer.explorer_profile_id = p_explorer_profile_id
   for update;

  if not found
     or v_explorer.user_account_id <> p_actor_user_account_id
     or v_explorer.status <> 'active'
     or v_explorer.onboarding_status <> 'active'
  then
    raise exception 'solmind_virtual_guide_predispatch_authority_denied';
  end if;

  select relationship.*
    into v_relationship
    from core.guide_explorer_relationship relationship
   where relationship.guide_explorer_relationship_id =
     p_guide_explorer_relationship_id
   for update;

  if not found
     or v_relationship.explorer_profile_id <> p_explorer_profile_id
     or v_relationship.relationship_status not in ('active', 'paused')
     or v_session.practice_id is distinct from v_relationship.practice_id
  then
    raise exception 'solmind_virtual_guide_predispatch_authority_denied';
  end if;

  select practice.*
    into v_practice
    from core.practice practice
   where practice.practice_id = v_relationship.practice_id
   for share;

  if not found
     or v_practice.status <> 'active'
     or v_practice.approval_status <> 'approved'
  then
    raise exception 'solmind_virtual_guide_predispatch_authority_denied';
  end if;

  lock table core.consent_document in share mode;

  select pg_catalog.array_agg(
           document.consent_document_id
           order by document.consent_document_id::text
         )
    into v_required_consent_ids
    from core.consent_document document
   where document.document_status = 'active'
     and document.is_required_for_explorer;

  if v_required_consent_ids is null
     or v_required_consent_ids is distinct from
          p_active_required_consent_document_ids
  then
    raise exception 'solmind_virtual_guide_predispatch_consent_denied';
  end if;

  perform record.consent_record_id
    from core.consent_record record
    join core.consent_document document
      on document.consent_document_id = record.consent_document_id
   where record.user_account_id = p_actor_user_account_id
     and record.role_context = 'explorer'
     and record.consent_document_id = any(v_required_consent_ids)
     and record.consent_type = document.consent_type
     and record.document_version = document.version_label
     and record.adult_affirmation is true
   order by record.consent_record_id
   for share of record;

  if exists (
    select 1
      from pg_catalog.unnest(v_required_consent_ids)
        as required_ids(consent_document_id)
      join core.consent_document document
        on document.consent_document_id = required_ids.consent_document_id
     where not exists (
       select 1
         from core.consent_record record
        where record.user_account_id = p_actor_user_account_id
          and record.role_context = 'explorer'
          and record.consent_document_id = document.consent_document_id
          and record.consent_type = document.consent_type
          and record.document_version = document.version_label
          and record.adult_affirmation is true
     )
  )
  then
    raise exception 'solmind_virtual_guide_predispatch_consent_denied';
  end if;

  v_expected_authorization_version :=
    'AV1:' || pg_catalog.upper(
      pg_catalog.encode(
        extensions.digest(
          pg_catalog.convert_to(
            'contract=' || v_contract_version
            || '|session=' || p_ai_interaction_session_id::text
            || '|account=' || p_actor_user_account_id::text
            || '|explorer=' || p_explorer_profile_id::text
            || '|relationship=' || p_guide_explorer_relationship_id::text
            || '|session_type=' || v_session.session_type
            || '|session_status=' || v_session.session_status
            || '|practice='
            || coalesce(v_session.practice_id::text, 'none')
            || '|practice_status=' || v_practice.status
            || '|practice_approval_status=' || v_practice.approval_status
            || '|restricted_mode=clear'
            || '|profile_status=' || v_explorer.status
            || '|onboarding_status=' || v_explorer.onboarding_status
            || '|relationship_status=' || v_relationship.relationship_status
            || '|required_consents='
            || pg_catalog.array_to_string(v_required_consent_ids, ','),
            'UTF8'
          ),
          'sha256'
        ),
        'hex'
      )
    );

  if p_authorization_version is distinct from
       v_expected_authorization_version
  then
    raise exception 'solmind_virtual_guide_predispatch_stale_authorization';
  end if;

  select invocation.*
    into v_existing_invocation
    from ai.ai_model_invocation invocation
   where invocation.logical_operation_id = p_logical_operation_id
   for update;

  if found then
    select snapshot.*
      into v_existing_snapshot
      from ai.ai_context_snapshot snapshot
     where snapshot.ai_context_snapshot_id =
       v_existing_invocation.ai_context_snapshot_id
     for update;

    if not found
       or v_existing_invocation.ai_model_invocation_id <>
            p_ai_model_invocation_id
       or v_existing_invocation.ai_interaction_session_id <>
            p_ai_interaction_session_id
       or v_existing_invocation.ai_context_snapshot_id <>
            p_ai_context_snapshot_id
       or v_existing_invocation.provider_name <> v_provider_name
       or v_existing_invocation.model_name <> v_model_name
       or v_existing_invocation.prompt_version <> v_prompt_version
       or v_existing_invocation.dispatch_contract_version <>
            v_contract_version
       or v_existing_snapshot.ai_interaction_session_id <>
            p_ai_interaction_session_id
       or v_existing_snapshot.actor_user_account_id <>
            p_actor_user_account_id
       or v_existing_snapshot.explorer_profile_id <> p_explorer_profile_id
       or v_existing_snapshot.guide_explorer_relationship_id <>
            p_guide_explorer_relationship_id
       or v_existing_snapshot.authorization_version <>
            p_authorization_version
       or v_existing_snapshot.active_required_consent_document_ids <>
            p_active_required_consent_document_ids
       or v_existing_snapshot.context_source_ids <> p_context_source_ids
       or v_existing_snapshot.context_fingerprint_sha256 <>
            p_context_fingerprint_sha256
       or v_existing_snapshot.prompt_version <> v_prompt_version
       or v_existing_snapshot.evidence_contract_version <>
            v_contract_version
    then
      raise exception 'solmind_virtual_guide_predispatch_operation_conflict';
    end if;

    select pg_catalog.count(*)
      into v_snapshot_audit_count
      from audit.audit_event event
     where event.event_type = 'ai_context_snapshot_created'
       and event.action = 'create'
       and event.actor_user_account_id = p_actor_user_account_id
       and event.actor_role_context = 'explorer'
       and event.target_entity_type = 'ai_context_snapshot'
       and event.target_entity_id = p_ai_context_snapshot_id
       and event.reason_code = 'pre_dispatch_snapshot_created'
       and event.event_summary =
         'Virtual Guide context snapshot created before provider dispatch.'
       and event.ip_address is null
       and event.user_agent is null
       and event.metadata = pg_catalog.jsonb_build_object(
         'contract_version', v_contract_version,
         'operation_id', p_logical_operation_id::text,
         'role_context', 'explorer',
         'session_id', p_ai_interaction_session_id::text
       );

    select pg_catalog.count(*)
      into v_invocation_audit_count
      from audit.audit_event event
     where event.event_type = 'ai_model_invocation_started'
       and event.action = 'start'
       and event.actor_user_account_id = p_actor_user_account_id
       and event.actor_role_context = 'explorer'
       and event.target_entity_type = 'ai_model_invocation'
       and event.target_entity_id = p_ai_model_invocation_id
       and event.reason_code = 'pre_dispatch_invocation_started'
       and event.event_summary =
         'Virtual Guide model invocation started before provider dispatch.'
       and event.ip_address is null
       and event.user_agent is null
       and event.metadata = pg_catalog.jsonb_build_object(
         'context_snapshot_id', p_ai_context_snapshot_id::text,
         'contract_version', v_contract_version,
         'model_name', v_model_name,
         'operation_id', p_logical_operation_id::text,
         'provider_name', v_provider_name,
         'request_status', 'started',
         'role_context', 'explorer',
         'session_id', p_ai_interaction_session_id::text
       );

    if v_snapshot_audit_count <> 1 or v_invocation_audit_count <> 1 then
      raise exception 'solmind_virtual_guide_predispatch_evidence_incomplete';
    end if;

    return query
    select
      'exact_retry'::text,
      p_ai_context_snapshot_id,
      p_ai_model_invocation_id;
    return;
  end if;

  v_now := pg_catalog.clock_timestamp();

  insert into ai.ai_context_snapshot (
    ai_context_snapshot_id,
    ai_interaction_session_id,
    prompt_version,
    actor_user_account_id,
    explorer_profile_id,
    guide_explorer_relationship_id,
    authorization_version,
    active_required_consent_document_ids,
    context_source_ids,
    context_fingerprint_sha256,
    evidence_contract_version,
    created_at
  ) values (
    p_ai_context_snapshot_id,
    p_ai_interaction_session_id,
    v_prompt_version,
    p_actor_user_account_id,
    p_explorer_profile_id,
    p_guide_explorer_relationship_id,
    p_authorization_version,
    p_active_required_consent_document_ids,
    p_context_source_ids,
    p_context_fingerprint_sha256,
    v_contract_version,
    v_now
  );

  insert into ai.ai_model_invocation (
    ai_model_invocation_id,
    ai_interaction_session_id,
    provider_name,
    model_name,
    prompt_version,
    request_status,
    started_at,
    logical_operation_id,
    ai_context_snapshot_id,
    dispatch_contract_version
  ) values (
    p_ai_model_invocation_id,
    p_ai_interaction_session_id,
    v_provider_name,
    v_model_name,
    v_prompt_version,
    'started',
    v_now,
    p_logical_operation_id,
    p_ai_context_snapshot_id,
    v_contract_version
  );

  insert into audit.audit_event (
    event_type,
    actor_user_account_id,
    actor_role_context,
    target_entity_type,
    target_entity_id,
    action,
    reason_code,
    event_summary,
    metadata
  ) values (
    'ai_context_snapshot_created',
    p_actor_user_account_id,
    'explorer',
    'ai_context_snapshot',
    p_ai_context_snapshot_id,
    'create',
    'pre_dispatch_snapshot_created',
    'Virtual Guide context snapshot created before provider dispatch.',
    pg_catalog.jsonb_build_object(
      'contract_version', v_contract_version,
      'operation_id', p_logical_operation_id::text,
      'role_context', 'explorer',
      'session_id', p_ai_interaction_session_id::text
    )
  );

  insert into audit.audit_event (
    event_type,
    actor_user_account_id,
    actor_role_context,
    target_entity_type,
    target_entity_id,
    action,
    reason_code,
    event_summary,
    metadata
  ) values (
    'ai_model_invocation_started',
    p_actor_user_account_id,
    'explorer',
    'ai_model_invocation',
    p_ai_model_invocation_id,
    'start',
    'pre_dispatch_invocation_started',
    'Virtual Guide model invocation started before provider dispatch.',
    pg_catalog.jsonb_build_object(
      'context_snapshot_id', p_ai_context_snapshot_id::text,
      'contract_version', v_contract_version,
      'model_name', v_model_name,
      'operation_id', p_logical_operation_id::text,
      'provider_name', v_provider_name,
      'request_status', 'started',
      'role_context', 'explorer',
      'session_id', p_ai_interaction_session_id::text
    )
  );

  return query
  select
    'created'::text,
    p_ai_context_snapshot_id,
    p_ai_model_invocation_id;
end;
$$;

revoke all on function public.solmind_prepare_virtual_guide_predispatch(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, uuid[], uuid[], text
) from public;

revoke execute on function public.solmind_prepare_virtual_guide_predispatch(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, uuid[], uuid[], text
) from anon, authenticated;

grant execute on function public.solmind_prepare_virtual_guide_predispatch(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, uuid[], uuid[], text
) to service_role;

comment on column ai.ai_context_snapshot.authorization_version is
  'Database-derived AV1 authorization proof for a Virtual Guide pre-dispatch snapshot. It contains no private content.';

comment on column ai.ai_context_snapshot.context_source_ids is
  'Canonical sorted unique IDs of the bounded source records represented by the snapshot. No source content is stored here.';

comment on column ai.ai_context_snapshot.context_fingerprint_sha256 is
  'SHA-256 of the exact authorized S03A context serialization. Sensitive provenance; never copy it into audit metadata or outward errors.';

comment on column ai.ai_model_invocation.logical_operation_id is
  'Server-generated idempotency owner for one intended provider dispatch.';

comment on column ai.ai_model_invocation.ai_context_snapshot_id is
  'The exact persisted pre-dispatch context snapshot bound to this invocation.';

comment on function public.solmind_prepare_virtual_guide_predispatch(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, uuid[], uuid[], text
) is
  'Service-role-only atomic Virtual Guide pre-dispatch gate. Revalidates current Explorer/session/relationship/consent authority, creates exactly one sensitive context snapshot and one started model invocation, and writes exact value-free Family E lifecycle evidence in the same transaction. Exact retry returns exact_retry and must never authorize a second provider call. It performs no provider I/O, message write, route, deployment, or real-user activation.';
