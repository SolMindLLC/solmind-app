begin;

create function content.solmind_normalize_suggested_waypoint_destination(
  p_value text
)
returns text
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_value text;
begin
  v_value := content.solmind_normalize_suggested_waypoint_text(
    p_value,
    1,
    160
  );

  if pg_catalog.strpos(v_value, E'\n') > 0
     or pg_catalog.strpos(v_value, pg_catalog.chr(8232)) > 0
     or pg_catalog.strpos(v_value, pg_catalog.chr(8233)) > 0
  then
    raise exception 'solmind_suggested_waypoint_invalid_content';
  end if;

  return v_value;
end;
$$;

alter function content.solmind_normalize_suggested_waypoint_destination(text)
  owner to postgres;
revoke all on function
  content.solmind_normalize_suggested_waypoint_destination(text)
  from public, anon, authenticated, service_role;
comment on function
  content.solmind_normalize_suggested_waypoint_destination(text)
  is 'Protected destination-specific single-line normalization for Suggested Waypoint content.';

do $$
begin
  if exists (
    select 1
      from content.suggested_waypoint_guide_draft draft
     where pg_catalog.strpos(draft.destination, E'\n') > 0
        or pg_catalog.strpos(draft.destination, pg_catalog.chr(8232)) > 0
        or pg_catalog.strpos(draft.destination, pg_catalog.chr(8233)) > 0
    union all
    select 1
      from content.suggested_waypoint_pending_outbound pending
     where pg_catalog.strpos(pending.destination, E'\n') > 0
        or pg_catalog.strpos(pending.destination, pg_catalog.chr(8232)) > 0
        or pg_catalog.strpos(pending.destination, pg_catalog.chr(8233)) > 0
    union all
    select 1
      from content.suggested_waypoint_version version
     where pg_catalog.strpos(version.destination, E'\n') > 0
        or pg_catalog.strpos(version.destination, pg_catalog.chr(8232)) > 0
        or pg_catalog.strpos(version.destination, pg_catalog.chr(8233)) > 0
  ) then
    raise exception 'solmind_suggested_waypoint_existing_invalid_destination';
  end if;
end;
$$;

create or replace function content.solmind_suggested_waypoint_content_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.destination is distinct from
       content.solmind_normalize_suggested_waypoint_destination(
         new.destination
       )
     or new.why is distinct from
       content.solmind_normalize_suggested_waypoint_text(new.why, 1, 1000)
     or new.arrival_signals is distinct from
       content.solmind_normalize_suggested_waypoint_signals(
         new.arrival_signals
       )
  then
    raise exception 'solmind_suggested_waypoint_content_not_normalized';
  end if;
  return new;
end;
$$;

alter function content.solmind_suggested_waypoint_content_guard()
  owner to postgres;
revoke all on function content.solmind_suggested_waypoint_content_guard()
  from public, anon, authenticated, service_role;

create or replace function public.solmind_save_suggested_waypoint_draft(
  p_actor_user_account_id uuid,
  p_operation_id uuid,
  p_guide_explorer_relationship_id uuid,
  p_suggested_waypoint_id uuid,
  p_expected_revision bigint,
  p_destination text,
  p_why text,
  p_arrival_signals jsonb
)
returns table (
  outcome_code text,
  operation_id uuid,
  suggested_waypoint_id uuid,
  authoring_revision bigint,
  current_version_id uuid,
  committed_at timestamptz,
  draft_saved_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing content.suggested_waypoint_operation_result%rowtype;
  v_owner content.suggested_waypoint%rowtype;
  v_relationship core.guide_explorer_relationship%rowtype;
  v_destination text;
  v_why text;
  v_signals jsonb;
  v_digest text;
  v_now timestamptz := pg_catalog.transaction_timestamp();
  v_revision bigint;
  v_correlation uuid;
begin
  if p_actor_user_account_id is null
     or p_operation_id is null
     or p_guide_explorer_relationship_id is null
     or p_suggested_waypoint_id is null
     or p_expected_revision is null
     or p_expected_revision < 0
  then
    raise exception 'solmind_suggested_waypoint_invalid_request';
  end if;

  v_destination := content.solmind_normalize_suggested_waypoint_destination(
    p_destination
  );
  v_why := content.solmind_normalize_suggested_waypoint_text(p_why, 1, 1000);
  v_signals := content.solmind_normalize_suggested_waypoint_signals(
    p_arrival_signals
  );
  v_digest := content.solmind_suggested_waypoint_request_sha256(
    pg_catalog.jsonb_build_object(
      'actorClass', 'human',
      'actorUserAccountId', p_actor_user_account_id,
      'arrivalSignals', v_signals,
      'commandKind', 'save_draft',
      'destination', v_destination,
      'expectedRevision', p_expected_revision,
      'relationshipId', p_guide_explorer_relationship_id,
      'suggestedWaypointId', p_suggested_waypoint_id,
      'why', v_why
    )
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_operation_id::text, 0)
  );
  select * into v_existing
    from content.suggested_waypoint_operation_result result
   where result.operation_id = p_operation_id;

  if found then
    if v_existing.actor_user_account_id = p_actor_user_account_id
       and v_existing.actor_class = 'human'
       and v_existing.command_kind = 'save_draft'
       and v_existing.guide_explorer_relationship_id =
           p_guide_explorer_relationship_id
       and v_existing.suggested_waypoint_id = p_suggested_waypoint_id
       and v_existing.request_sha256 = v_digest
    then
      return query select
        'idempotent'::text,
        p_operation_id,
        p_suggested_waypoint_id,
        v_existing.authoring_revision,
        v_existing.current_version_id,
        v_existing.committed_at,
        v_existing.draft_saved_at;
    elsif v_existing.actor_user_account_id is distinct from
          p_actor_user_account_id then
      return query select
        'relationship_unavailable'::text,
        p_operation_id,
        null::uuid,
        null::bigint,
        null::uuid,
        null::timestamptz,
        null::timestamptz;
    else
      return query select
        'operation_conflict'::text,
        p_operation_id,
        p_suggested_waypoint_id,
        null::bigint,
        null::uuid,
        null::timestamptz,
        null::timestamptz;
    end if;
    return;
  end if;

  if not content.solmind_suggested_waypoint_guide_authorized(
    p_actor_user_account_id,
    p_guide_explorer_relationship_id
  ) then
    return query select
      'relationship_unavailable'::text,
      p_operation_id,
      null::uuid,
      null::bigint,
      null::uuid,
      null::timestamptz,
      null::timestamptz;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_suggested_waypoint_id::text, 0)
  );
  select * into v_relationship
    from core.guide_explorer_relationship relationship
   where relationship.guide_explorer_relationship_id =
         p_guide_explorer_relationship_id;
  select * into v_owner
    from content.suggested_waypoint owner_row
   where owner_row.suggested_waypoint_id = p_suggested_waypoint_id
   for update;

  if p_expected_revision = 0 then
    if found then
      if v_owner.guide_explorer_relationship_id <>
         p_guide_explorer_relationship_id
      then
        return query select
          'relationship_unavailable'::text,
          p_operation_id,
          null::uuid,
          null::bigint,
          null::uuid,
          null::timestamptz,
          null::timestamptz;
        return;
      end if;
      return query select
        'stale'::text,
        p_operation_id,
        p_suggested_waypoint_id,
        v_owner.authoring_revision,
        v_owner.current_version_id,
        null::timestamptz,
        null::timestamptz;
      return;
    end if;

    v_revision := 1;
    v_correlation := pg_catalog.gen_random_uuid();
    insert into content.suggested_waypoint (
      suggested_waypoint_id,
      guide_explorer_relationship_id,
      guide_profile_id,
      explorer_profile_id,
      created_by_guide_user_account_id,
      authoring_mode,
      authoring_revision,
      current_version_id,
      last_operation_id,
      audit_correlation_id,
      created_at,
      state_changed_at
    ) values (
      p_suggested_waypoint_id,
      p_guide_explorer_relationship_id,
      v_relationship.guide_profile_id,
      v_relationship.explorer_profile_id,
      p_actor_user_account_id,
      'draft',
      v_revision,
      null,
      p_operation_id,
      v_correlation,
      v_now,
      v_now
    );
  else
    if not found
       or v_owner.guide_explorer_relationship_id <>
          p_guide_explorer_relationship_id
    then
      return query select
        'relationship_unavailable'::text,
        p_operation_id,
        null::uuid,
        null::bigint,
        null::uuid,
        null::timestamptz,
        null::timestamptz;
      return;
    end if;

    if v_owner.authoring_mode <> 'draft' then
      return query select
        'invalid_transition'::text,
        p_operation_id,
        p_suggested_waypoint_id,
        v_owner.authoring_revision,
        v_owner.current_version_id,
        null::timestamptz,
        null::timestamptz;
      return;
    end if;

    if v_owner.authoring_revision <> p_expected_revision then
      return query select
        'stale'::text,
        p_operation_id,
        p_suggested_waypoint_id,
        v_owner.authoring_revision,
        v_owner.current_version_id,
        null::timestamptz,
        null::timestamptz;
      return;
    end if;

    v_revision := v_owner.authoring_revision + 1;
    v_correlation := v_owner.audit_correlation_id;
    update content.suggested_waypoint owner_row
       set authoring_revision = v_revision,
           last_operation_id = p_operation_id,
           state_changed_at = v_now
     where owner_row.suggested_waypoint_id = p_suggested_waypoint_id;
  end if;

  insert into content.suggested_waypoint_guide_draft (
    suggested_waypoint_id,
    guide_explorer_relationship_id,
    guide_profile_id,
    explorer_profile_id,
    destination,
    why,
    arrival_signals,
    authoring_revision,
    created_at,
    updated_at
  ) values (
    p_suggested_waypoint_id,
    p_guide_explorer_relationship_id,
    v_relationship.guide_profile_id,
    v_relationship.explorer_profile_id,
    v_destination,
    v_why,
    v_signals,
    v_revision,
    v_now,
    v_now
  ) on conflict on constraint suggested_waypoint_guide_draft_pkey do update
    set destination = excluded.destination,
        why = excluded.why,
        arrival_signals = excluded.arrival_signals,
        authoring_revision = excluded.authoring_revision,
        updated_at = excluded.updated_at;

  insert into content.suggested_waypoint_operation_result (
    operation_id,
    actor_user_account_id,
    actor_class,
    command_kind,
    guide_explorer_relationship_id,
    suggested_waypoint_id,
    request_sha256,
    outcome_code,
    authoring_revision,
    current_version_id,
    committed_at,
    draft_saved_at
  ) values (
    p_operation_id,
    p_actor_user_account_id,
    'human',
    'save_draft',
    p_guide_explorer_relationship_id,
    p_suggested_waypoint_id,
    v_digest,
    'applied',
    v_revision,
    null,
    v_now,
    v_now
  );

  perform content.solmind_record_suggested_waypoint_audit(
    'suggested_waypoint_draft_saved',
    'save',
    'guide',
    p_actor_user_account_id,
    p_suggested_waypoint_id,
    pg_catalog.jsonb_build_object(
      'operationId', p_operation_id::text,
      'relationshipId', p_guide_explorer_relationship_id::text,
      'suggestedWaypointId', p_suggested_waypoint_id::text,
      'correlationId', v_correlation::text,
      'outcome', 'applied'
    )
  );

  return query select
    'applied'::text,
    p_operation_id,
    p_suggested_waypoint_id,
    v_revision,
    null::uuid,
    v_now,
    v_now;
end;
$$;

alter function public.solmind_save_suggested_waypoint_draft(
  uuid, uuid, uuid, uuid, bigint, text, text, jsonb
) owner to postgres;
revoke all on function public.solmind_save_suggested_waypoint_draft(
  uuid, uuid, uuid, uuid, bigint, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.solmind_save_suggested_waypoint_draft(
  uuid, uuid, uuid, uuid, bigint, text, text, jsonb
) to service_role;

comment on function public.solmind_save_suggested_waypoint_draft(
  uuid, uuid, uuid, uuid, bigint, text, text, jsonb
) is 'Dormant S02 Guide command. Creates or atomically revises one bounded relationship-scoped initial Suggested Waypoint draft.';

commit;
