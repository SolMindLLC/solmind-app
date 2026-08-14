-- PRJ01_V-WS05-WI022-S02: dormant Suggested Waypoint persistence and
-- security foundation. This migration adds no application caller, browser
-- transport, hosted scheduler, provider, deployment, or real-user path.

begin;

-- Generalize the protected application-setting singleton into an exact,
-- closed two-key family while preserving the existing Shared Snapshot row.
alter table core.application_setting
  drop constraint application_setting_singleton_id_check,
  drop constraint application_setting_key_check,
  drop constraint application_setting_integer_bounds_check;

alter table core.application_setting
  add constraint application_setting_closed_identity_key_check
    check (
      (
        application_setting_id =
          'a30f0210-0000-4000-8000-000000000001'::uuid
        and setting_key = 'explorer_shared_snapshot_sendability_days'
      )
      or
      (
        application_setting_id =
          'a30f0220-0000-4000-8000-000000000001'::uuid
        and setting_key = 'suggested_waypoint_send_grace_seconds'
      )
    ),
  add constraint application_setting_closed_integer_bounds_check
    check (
      (
        setting_key = 'explorer_shared_snapshot_sendability_days'
        and minimum_integer_value = 1
        and default_integer_value = 7
        and maximum_integer_value = 100
      )
      or
      (
        setting_key = 'suggested_waypoint_send_grace_seconds'
        and minimum_integer_value = 60
        and default_integer_value = 300
        and maximum_integer_value = 3600
      )
    );

alter table core.application_setting
  add constraint application_setting_integer_within_selected_bounds_check
    check (integer_value between minimum_integer_value and maximum_integer_value);

insert into core.application_setting (
  application_setting_id,
  setting_key,
  integer_value,
  minimum_integer_value,
  default_integer_value,
  maximum_integer_value,
  version,
  retention_class
) values (
  'a30f0220-0000-4000-8000-000000000001',
  'suggested_waypoint_send_grace_seconds',
  300,
  60,
  300,
  3600,
  1,
  'core_business'
);

comment on table core.application_setting is
  'Protected closed two-key MVP0 application-setting family. It stores only the Explorer Shared Snapshot sendability window and the Suggested Waypoint send-grace policy. RLS is enabled with zero policies; direct access is revoked from app roles and service_role; the fixed read and audited mutation functions remain the only runtime data paths.';

create or replace function public.solmind_read_application_setting_integer(
  p_setting_key text
)
returns table (
  setting_key text,
  integer_value integer,
  minimum_integer_value integer,
  default_integer_value integer,
  maximum_integer_value integer,
  version bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_setting_key is null
     or p_setting_key not in (
       'explorer_shared_snapshot_sendability_days',
       'suggested_waypoint_send_grace_seconds'
     )
  then
    raise exception 'solmind_application_setting_not_allowed';
  end if;

  return query
  select setting.setting_key,
         setting.integer_value,
         setting.minimum_integer_value,
         setting.default_integer_value,
         setting.maximum_integer_value,
         setting.version
    from core.application_setting setting
   where setting.setting_key = p_setting_key;

  if not found then
    raise exception 'solmind_application_setting_not_found';
  end if;
end;
$$;

alter function public.solmind_read_application_setting_integer(text)
  owner to postgres;

revoke all on function
  public.solmind_read_application_setting_integer(text)
  from public, anon, authenticated;

grant execute on function
  public.solmind_read_application_setting_integer(text)
  to service_role;

comment on function public.solmind_read_application_setting_integer(text) is
  'Server-only closed-allowlist integer setting read for exactly explorer_shared_snapshot_sendability_days and suggested_waypoint_send_grace_seconds. It returns only bounded value metadata and version, owns no authorization decision, and is executable only by service_role.';

create or replace function public.solmind_set_application_setting_integer(
  p_setting_key text,
  p_integer_value integer,
  p_expected_version bigint,
  p_operation_id uuid,
  p_authority_basis text,
  p_authority_reference_id uuid,
  p_reason_code text
)
returns table (
  outcome text,
  setting_key text,
  integer_value integer,
  version bigint
)
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '2000ms'
as $$
declare
  v_setting core.application_setting%rowtype;
  v_existing_audit audit.audit_event%rowtype;
begin
  if p_setting_key is null
     or p_setting_key not in (
       'explorer_shared_snapshot_sendability_days',
       'suggested_waypoint_send_grace_seconds'
     )
  then
    raise exception 'solmind_application_setting_not_allowed';
  end if;

  if p_expected_version is null or p_expected_version < 1
     or p_operation_id is null
  then
    raise exception 'solmind_application_setting_invalid_request';
  end if;

  if p_authority_basis is null
     or p_authority_basis not in (
       'paul_approved',
       'system_operations_runbook'
     )
  then
    raise exception 'solmind_application_setting_invalid_authority';
  end if;

  if p_authority_reference_id is null then
    raise exception 'solmind_application_setting_invalid_audit_context';
  end if;

  if p_reason_code is null
     or (
       p_authority_basis = 'paul_approved'
       and p_reason_code <> 'paul_approved_configuration_change'
     )
     or (
       p_authority_basis = 'system_operations_runbook'
       and p_reason_code <> 'runbook_configuration_change'
     )
  then
    raise exception 'solmind_application_setting_invalid_reason';
  end if;

  select setting.*
    into v_setting
    from core.application_setting setting
   where setting.setting_key = p_setting_key
   for update;

  if not found then
    raise exception 'solmind_application_setting_not_found';
  end if;

  if p_integer_value is null
     or p_integer_value < v_setting.minimum_integer_value
     or p_integer_value > v_setting.maximum_integer_value
  then
    raise exception 'solmind_application_setting_invalid_value';
  end if;

  select event.*
    into v_existing_audit
    from audit.audit_event event
   where event.event_type = 'application_setting_changed'
     and event.metadata ->> 'operation_id' = p_operation_id::text;

  if found then
    if v_existing_audit.action = 'update'
       and v_existing_audit.actor_user_account_id is null
       and v_existing_audit.actor_role_context = 'system'
       and v_existing_audit.target_entity_type = 'application_setting'
       and v_existing_audit.target_entity_id =
           v_setting.application_setting_id
       and v_existing_audit.reason_code = p_reason_code
       and v_existing_audit.event_summary =
           'Protected application setting changed through the system-operations function.'
       and v_existing_audit.metadata = pg_catalog.jsonb_build_object(
         'setting_key', p_setting_key,
         'integer_value', p_integer_value,
         'expected_version', p_expected_version,
         'version', p_expected_version + 1,
         'operation_id', p_operation_id::text,
         'authority_basis', p_authority_basis,
         'authority_reference_id', p_authority_reference_id::text
       )
       and v_setting.last_operation_id = p_operation_id
       and v_setting.integer_value = p_integer_value
       and v_setting.version = p_expected_version + 1
    then
      return query
      select 'already_applied'::text,
             v_setting.setting_key,
             v_setting.integer_value,
             v_setting.version;
      return;
    end if;

    raise exception 'solmind_application_setting_operation_conflict';
  end if;

  if v_setting.version <> p_expected_version then
    raise exception 'solmind_application_setting_version_conflict';
  end if;

  if v_setting.integer_value = p_integer_value then
    return query
    select 'unchanged'::text,
           v_setting.setting_key,
           v_setting.integer_value,
           v_setting.version;
    return;
  end if;

  update core.application_setting setting
     set integer_value = p_integer_value,
         version = setting.version + 1,
         last_operation_id = p_operation_id,
         updated_at = pg_catalog.now()
   where setting.application_setting_id = v_setting.application_setting_id;

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
    'application_setting_changed',
    null,
    'system',
    'application_setting',
    v_setting.application_setting_id,
    'update',
    p_reason_code,
    'Protected application setting changed through the system-operations function.',
    pg_catalog.jsonb_build_object(
      'setting_key', v_setting.setting_key,
      'integer_value', p_integer_value,
      'expected_version', p_expected_version,
      'version', v_setting.version + 1,
      'operation_id', p_operation_id::text,
      'authority_basis', p_authority_basis,
      'authority_reference_id', p_authority_reference_id::text
    )
  );

  return query
  select 'applied'::text,
         v_setting.setting_key,
         p_integer_value,
         v_setting.version + 1;
exception
  when lock_not_available then
    raise exception 'solmind_application_setting_lock_unavailable';
end;
$$;

alter function public.solmind_set_application_setting_integer(
  text, integer, bigint, uuid, text, uuid, text
) owner to postgres;

revoke all on function
  public.solmind_set_application_setting_integer(
    text, integer, bigint, uuid, text, uuid, text
  )
  from public, anon, authenticated;

grant execute on function
  public.solmind_set_application_setting_integer(
    text, integer, bigint, uuid, text, uuid, text
  )
  to service_role;

comment on function public.solmind_set_application_setting_integer(
  text, integer, bigint, uuid, text, uuid, text
) is
  'Service-role-only audited system-operations mutation for the closed two-key protected setting family. The caller must hold exact Paul approval or authorized system-operations runbook authority. The function resolves the fixed row first, validates against that row bounds, serializes by expected version, preserves exact typed retry and writeless same-value semantics, and writes one same-transaction Family F audit row for an actual change.';

create table core.guide_suggested_waypoint_preference (
  guide_profile_id uuid primary key
    references core.guide_profile(guide_profile_id),
  send_grace_seconds integer not null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retention_class text not null default 'core_business',

  constraint guide_suggested_waypoint_preference_bounds_check
    check (send_grace_seconds between 60 and 3600),
  constraint guide_suggested_waypoint_preference_version_check
    check (version >= 1),
  constraint guide_suggested_waypoint_preference_timestamp_check
    check (updated_at >= created_at),
  constraint guide_suggested_waypoint_preference_retention_check
    check (retention_class = 'core_business')
);

create table content.suggested_waypoint (
  suggested_waypoint_id uuid primary key,
  guide_explorer_relationship_id uuid not null
    references core.guide_explorer_relationship(guide_explorer_relationship_id),
  guide_profile_id uuid not null references core.guide_profile(guide_profile_id),
  explorer_profile_id uuid not null references core.explorer_profile(explorer_profile_id),
  created_by_guide_user_account_id uuid not null
    references identity.user_account(user_account_id),
  authoring_mode text not null default 'draft',
  authoring_revision bigint not null default 1,
  current_version_id uuid null,
  last_operation_id uuid not null,
  audit_correlation_id uuid not null,
  created_at timestamptz not null default now(),
  state_changed_at timestamptz not null default now(),
  retention_class text not null default 'sensitive_content',

  constraint suggested_waypoint_authoring_mode_check
    check (authoring_mode in ('draft', 'pending', 'delivered')),
  constraint suggested_waypoint_authoring_revision_check
    check (authoring_revision >= 1),
  constraint suggested_waypoint_current_version_check
    check (
      (authoring_mode in ('draft', 'pending') and current_version_id is null)
      or (authoring_mode = 'delivered' and current_version_id is not null)
    ),
  constraint suggested_waypoint_retention_check
    check (retention_class = 'sensitive_content'),
  constraint suggested_waypoint_identity_unique
    unique (
      suggested_waypoint_id,
      guide_explorer_relationship_id,
      guide_profile_id,
      explorer_profile_id
    )
);

create table content.suggested_waypoint_guide_draft (
  suggested_waypoint_id uuid primary key,
  guide_explorer_relationship_id uuid not null,
  guide_profile_id uuid not null,
  explorer_profile_id uuid not null,
  destination text not null,
  why text not null,
  arrival_signals jsonb not null,
  authoring_revision bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retention_class text not null default 'sensitive_content',

  constraint suggested_waypoint_guide_draft_owner_fk
    foreign key (
      suggested_waypoint_id,
      guide_explorer_relationship_id,
      guide_profile_id,
      explorer_profile_id
    ) references content.suggested_waypoint (
      suggested_waypoint_id,
      guide_explorer_relationship_id,
      guide_profile_id,
      explorer_profile_id
    ),
  constraint suggested_waypoint_guide_draft_revision_check
    check (authoring_revision >= 1),
  constraint suggested_waypoint_guide_draft_signals_check
    check (pg_catalog.jsonb_typeof(arrival_signals) = 'array'),
  constraint suggested_waypoint_guide_draft_timestamp_check
    check (updated_at >= created_at),
  constraint suggested_waypoint_guide_draft_retention_check
    check (retention_class = 'sensitive_content')
);

create table content.suggested_waypoint_pending_outbound (
  suggested_waypoint_id uuid primary key,
  pending_version_id uuid not null unique,
  guide_explorer_relationship_id uuid not null,
  guide_profile_id uuid not null,
  explorer_profile_id uuid not null,
  destination text not null,
  why text not null,
  arrival_signals jsonb not null,
  authoring_revision bigint not null,
  schedule_operation_id uuid not null unique,
  policy_key text not null,
  policy_version bigint not null,
  effective_seconds integer not null,
  scheduled_at timestamptz not null,
  deadline_at timestamptz not null,
  audit_correlation_id uuid not null,
  retention_class text not null default 'sensitive_content',

  constraint suggested_waypoint_pending_owner_fk
    foreign key (
      suggested_waypoint_id,
      guide_explorer_relationship_id,
      guide_profile_id,
      explorer_profile_id
    ) references content.suggested_waypoint (
      suggested_waypoint_id,
      guide_explorer_relationship_id,
      guide_profile_id,
      explorer_profile_id
    ),
  constraint suggested_waypoint_pending_revision_check
    check (authoring_revision >= 1),
  constraint suggested_waypoint_pending_signals_check
    check (pg_catalog.jsonb_typeof(arrival_signals) = 'array'),
  constraint suggested_waypoint_pending_policy_check
    check (
      policy_key = 'suggested_waypoint_send_grace_seconds'
      and policy_version >= 1
      and effective_seconds between 60 and 3600
    ),
  constraint suggested_waypoint_pending_deadline_check
    check (deadline_at > scheduled_at),
  constraint suggested_waypoint_pending_retention_check
    check (retention_class = 'sensitive_content')
);

create table content.suggested_waypoint_version (
  suggested_waypoint_version_id uuid primary key,
  suggested_waypoint_id uuid not null,
  guide_explorer_relationship_id uuid not null,
  guide_profile_id uuid not null,
  explorer_profile_id uuid not null,
  version_number bigint not null,
  predecessor_version_id uuid null,
  destination text not null,
  why text not null,
  arrival_signals jsonb not null,
  delivered_at timestamptz not null,
  delivery_operation_id uuid not null unique,
  audit_correlation_id uuid not null,
  retention_class text not null default 'sensitive_content',

  constraint suggested_waypoint_version_owner_fk
    foreign key (
      suggested_waypoint_id,
      guide_explorer_relationship_id,
      guide_profile_id,
      explorer_profile_id
    ) references content.suggested_waypoint (
      suggested_waypoint_id,
      guide_explorer_relationship_id,
      guide_profile_id,
      explorer_profile_id
    ),
  constraint suggested_waypoint_version_number_check
    check (version_number >= 1),
  constraint suggested_waypoint_version_signals_check
    check (pg_catalog.jsonb_typeof(arrival_signals) = 'array'),
  constraint suggested_waypoint_version_retention_check
    check (retention_class = 'sensitive_content'),
  constraint suggested_waypoint_version_identity_unique
    unique (
      suggested_waypoint_version_id,
      suggested_waypoint_id,
      guide_explorer_relationship_id,
      explorer_profile_id
    ),
  constraint suggested_waypoint_version_suggestion_unique
    unique (suggested_waypoint_version_id, suggested_waypoint_id),
  constraint suggested_waypoint_version_number_unique
    unique (suggested_waypoint_id, version_number),
  constraint suggested_waypoint_version_predecessor_fk
    foreign key (predecessor_version_id, suggested_waypoint_id)
    references content.suggested_waypoint_version (
      suggested_waypoint_version_id,
      suggested_waypoint_id
    )
);

create unique index suggested_waypoint_version_initial_unique_idx
  on content.suggested_waypoint_version (suggested_waypoint_id)
  where predecessor_version_id is null;

create unique index suggested_waypoint_version_one_child_idx
  on content.suggested_waypoint_version (
    suggested_waypoint_id,
    predecessor_version_id
  )
  where predecessor_version_id is not null;

alter table content.suggested_waypoint
  add constraint suggested_waypoint_current_version_fk
  foreign key (current_version_id, suggested_waypoint_id)
  references content.suggested_waypoint_version (
    suggested_waypoint_version_id,
    suggested_waypoint_id
  );

create table content.suggested_waypoint_explorer_read_state (
  suggested_waypoint_version_id uuid not null,
  suggested_waypoint_id uuid not null,
  guide_explorer_relationship_id uuid not null,
  explorer_profile_id uuid not null,
  read_at timestamptz not null,
  read_operation_id uuid not null unique,
  retention_class text not null default 'sensitive_content',

  primary key (suggested_waypoint_version_id, explorer_profile_id),
  constraint suggested_waypoint_read_version_fk
    foreign key (
      suggested_waypoint_version_id,
      suggested_waypoint_id,
      guide_explorer_relationship_id,
      explorer_profile_id
    ) references content.suggested_waypoint_version (
      suggested_waypoint_version_id,
      suggested_waypoint_id,
      guide_explorer_relationship_id,
      explorer_profile_id
    ),
  constraint suggested_waypoint_read_retention_check
    check (retention_class = 'sensitive_content')
);

create table content.suggested_waypoint_receipt (
  suggested_waypoint_version_id uuid not null,
  suggested_waypoint_id uuid not null,
  guide_explorer_relationship_id uuid not null,
  explorer_profile_id uuid not null,
  acknowledged_at timestamptz not null,
  acknowledgement_operation_id uuid not null unique,
  retention_class text not null default 'sensitive_content',

  primary key (suggested_waypoint_version_id, explorer_profile_id),
  constraint suggested_waypoint_receipt_version_fk
    foreign key (
      suggested_waypoint_version_id,
      suggested_waypoint_id,
      guide_explorer_relationship_id,
      explorer_profile_id
    ) references content.suggested_waypoint_version (
      suggested_waypoint_version_id,
      suggested_waypoint_id,
      guide_explorer_relationship_id,
      explorer_profile_id
    ),
  constraint suggested_waypoint_receipt_retention_check
    check (retention_class = 'sensitive_content')
);

create table content.suggested_waypoint_operation_result (
  operation_id uuid primary key,
  actor_user_account_id uuid null,
  actor_class text not null,
  command_kind text not null,
  guide_explorer_relationship_id uuid not null,
  suggested_waypoint_id uuid not null,
  request_sha256 text not null,
  outcome_code text not null,
  authoring_revision bigint null,
  current_version_id uuid null,
  committed_at timestamptz not null,
  draft_saved_at timestamptz null,
  pending_version_id uuid null,
  deadline_at timestamptz null,
  policy_key text null,
  policy_version bigint null,
  effective_seconds integer null,
  draft_restored_at timestamptz null,
  delivered_version_id uuid null,
  delivered_at timestamptz null,
  read_at timestamptz null,
  acknowledged_version_id uuid null,
  acknowledged_at timestamptz null,
  retention_class text not null default 'security_log',

  constraint suggested_waypoint_operation_actor_class_check
    check (actor_class in ('human', 'system_worker')),
  constraint suggested_waypoint_operation_actor_check
    check (
      (actor_class = 'human' and actor_user_account_id is not null)
      or (actor_class = 'system_worker' and actor_user_account_id is null)
    ),
  constraint suggested_waypoint_operation_command_check
    check (
      command_kind in (
        'save_draft',
        'schedule_send',
        'pull_back',
        'deliver',
        'mark_read',
        'acknowledge_receipt'
      )
    ),
  constraint suggested_waypoint_operation_digest_check
    check (request_sha256 ~ '^[0-9a-f]{64}$'),
  constraint suggested_waypoint_operation_outcome_check
    check (outcome_code = 'applied'),
  constraint suggested_waypoint_operation_retention_check
    check (retention_class = 'security_log')
);

create index suggested_waypoint_relationship_state_idx
  on content.suggested_waypoint (
    guide_explorer_relationship_id,
    authoring_mode,
    state_changed_at desc,
    suggested_waypoint_id desc
  );

create index suggested_waypoint_explorer_delivery_idx
  on content.suggested_waypoint_version (
    explorer_profile_id,
    delivered_at desc,
    suggested_waypoint_id desc
  );

create index suggested_waypoint_pending_deadline_idx
  on content.suggested_waypoint_pending_outbound (
    deadline_at,
    suggested_waypoint_id
  );

alter table core.guide_suggested_waypoint_preference enable row level security;
alter table content.suggested_waypoint enable row level security;
alter table content.suggested_waypoint_guide_draft enable row level security;
alter table content.suggested_waypoint_pending_outbound enable row level security;
alter table content.suggested_waypoint_version enable row level security;
alter table content.suggested_waypoint_explorer_read_state enable row level security;
alter table content.suggested_waypoint_receipt enable row level security;
alter table content.suggested_waypoint_operation_result enable row level security;

revoke all on table core.guide_suggested_waypoint_preference
  from public, anon, authenticated, service_role;
revoke all on table content.suggested_waypoint
  from public, anon, authenticated, service_role;
revoke all on table content.suggested_waypoint_guide_draft
  from public, anon, authenticated, service_role;
revoke all on table content.suggested_waypoint_pending_outbound
  from public, anon, authenticated, service_role;
revoke all on table content.suggested_waypoint_version
  from public, anon, authenticated, service_role;
revoke all on table content.suggested_waypoint_explorer_read_state
  from public, anon, authenticated, service_role;
revoke all on table content.suggested_waypoint_receipt
  from public, anon, authenticated, service_role;
revoke all on table content.suggested_waypoint_operation_result
  from public, anon, authenticated, service_role;

comment on table content.suggested_waypoint is
  'Dormant relationship-scoped Suggested Waypoint identity and lifecycle pointer. It stores no suggestion text and has no application caller in S02.';
comment on table content.suggested_waypoint_guide_draft is
  'Guide-only mutable initial Suggested Waypoint draft. No Explorer projection may read this owner.';
comment on table content.suggested_waypoint_pending_outbound is
  'Guide-only locked outbound Suggested Waypoint payload with frozen send-grace policy and authoritative deadline.';
comment on table content.suggested_waypoint_version is
  'Immutable delivered Suggested Waypoint content and linear predecessor lineage.';
comment on table content.suggested_waypoint_explorer_read_state is
  'Explorer-private exact-version read state. It is omitted from Guide, routine Admin, audit, and AI-context projections.';
comment on table content.suggested_waypoint_receipt is
  'Explicit deliberately shared exact-version receipt acknowledgement.';
comment on table content.suggested_waypoint_operation_result is
  'Content-free canonical request SHA-256 and exact typed applied result for globally unique operation replay.';

create function content.solmind_normalize_suggested_waypoint_text(
  p_value text,
  p_minimum_length integer,
  p_maximum_length integer
)
returns text
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_value text;
  v_index integer;
  v_codepoint integer;
begin
  v_value := pg_catalog.btrim(
    normalize(
      pg_catalog.replace(
        pg_catalog.replace(p_value, E'\r\n', E'\n'),
        E'\r',
        E'\n'
      ),
      NFC
    )
  );

  if pg_catalog.char_length(v_value) < p_minimum_length
     or pg_catalog.char_length(v_value) > p_maximum_length
  then
    raise exception 'solmind_suggested_waypoint_invalid_content';
  end if;

  for v_index in 1..pg_catalog.char_length(v_value) loop
    v_codepoint := pg_catalog.ascii(pg_catalog.substr(v_value, v_index, 1));
    if v_codepoint = 0
       or v_codepoint between 1 and 8
       or v_codepoint between 11 and 12
       or v_codepoint between 14 and 31
       or v_codepoint between 127 and 159
    then
      raise exception 'solmind_suggested_waypoint_invalid_content';
    end if;
  end loop;

  return v_value;
end;
$$;

alter function content.solmind_normalize_suggested_waypoint_text(
  text, integer, integer
) owner to postgres;

revoke all on function content.solmind_normalize_suggested_waypoint_text(
  text, integer, integer
) from public, anon, authenticated, service_role;

create function content.solmind_normalize_suggested_waypoint_signals(
  p_arrival_signals jsonb
)
returns jsonb
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_count integer;
  v_item jsonb;
  v_signal text;
  v_seen text[] := array[]::text[];
  v_result jsonb := '[]'::jsonb;
begin
  if pg_catalog.jsonb_typeof(p_arrival_signals) <> 'array' then
    raise exception 'solmind_suggested_waypoint_invalid_arrival_signals';
  end if;

  v_count := pg_catalog.jsonb_array_length(p_arrival_signals);
  if v_count < 1 or v_count > 8 then
    raise exception 'solmind_suggested_waypoint_invalid_arrival_signals';
  end if;

  for v_item in
    select item.value
      from pg_catalog.jsonb_array_elements(p_arrival_signals) item(value)
  loop
    if pg_catalog.jsonb_typeof(v_item) <> 'string' then
      raise exception 'solmind_suggested_waypoint_invalid_arrival_signals';
    end if;

    v_signal := content.solmind_normalize_suggested_waypoint_text(
      v_item #>> '{}',
      1,
      240
    );

    if v_signal = any(v_seen) then
      raise exception 'solmind_suggested_waypoint_duplicate_arrival_signal';
    end if;

    v_seen := pg_catalog.array_append(v_seen, v_signal);
    v_result := v_result || pg_catalog.jsonb_build_array(v_signal);
  end loop;

  return v_result;
end;
$$;

alter function content.solmind_normalize_suggested_waypoint_signals(jsonb)
  owner to postgres;

revoke all on function
  content.solmind_normalize_suggested_waypoint_signals(jsonb)
  from public, anon, authenticated, service_role;

create function content.solmind_suggested_waypoint_content_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.destination is distinct from
       content.solmind_normalize_suggested_waypoint_text(
         new.destination, 1, 160
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

create trigger suggested_waypoint_guide_draft_content_guard
before insert or update of destination, why, arrival_signals
on content.suggested_waypoint_guide_draft
for each row execute function content.solmind_suggested_waypoint_content_guard();

create trigger suggested_waypoint_pending_content_guard
before insert or update of destination, why, arrival_signals
on content.suggested_waypoint_pending_outbound
for each row execute function content.solmind_suggested_waypoint_content_guard();

create trigger suggested_waypoint_version_content_guard
before insert or update of destination, why, arrival_signals
on content.suggested_waypoint_version
for each row execute function content.solmind_suggested_waypoint_content_guard();

create function content.solmind_suggested_waypoint_state_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suggested_waypoint_id uuid;
  v_mode text;
  v_revision bigint;
  v_draft_count integer;
  v_pending_count integer;
  v_revision_mismatch integer;
begin
  if tg_op = 'DELETE' then
    v_suggested_waypoint_id := old.suggested_waypoint_id;
  else
    v_suggested_waypoint_id := new.suggested_waypoint_id;
  end if;

  select owner_row.authoring_mode, owner_row.authoring_revision
    into v_mode, v_revision
    from content.suggested_waypoint owner_row
   where owner_row.suggested_waypoint_id = v_suggested_waypoint_id;
  if not found then
    return null;
  end if;

  select pg_catalog.count(*)::integer,
         pg_catalog.count(*) filter (
           where draft.authoring_revision <> v_revision
         )::integer
    into v_draft_count, v_revision_mismatch
    from content.suggested_waypoint_guide_draft draft
   where draft.suggested_waypoint_id = v_suggested_waypoint_id;
  select pg_catalog.count(*)::integer,
         v_revision_mismatch + pg_catalog.count(*) filter (
           where pending.authoring_revision <> v_revision
         )::integer
    into v_pending_count, v_revision_mismatch
    from content.suggested_waypoint_pending_outbound pending
   where pending.suggested_waypoint_id = v_suggested_waypoint_id;

  if v_revision_mismatch <> 0
     or (v_mode = 'draft' and (v_draft_count <> 1 or v_pending_count <> 0))
     or (v_mode = 'pending' and (v_draft_count <> 0 or v_pending_count <> 1))
     or (v_mode = 'delivered' and (v_draft_count <> 0 or v_pending_count <> 0))
  then
    raise exception 'solmind_suggested_waypoint_state_inconsistent';
  end if;
  return null;
end;
$$;

alter function content.solmind_suggested_waypoint_state_guard()
  owner to postgres;
revoke all on function content.solmind_suggested_waypoint_state_guard()
  from public, anon, authenticated, service_role;

create constraint trigger suggested_waypoint_owner_state_guard
after insert or update or delete on content.suggested_waypoint
deferrable initially deferred
for each row execute function content.solmind_suggested_waypoint_state_guard();

create constraint trigger suggested_waypoint_draft_state_guard
after insert or update or delete on content.suggested_waypoint_guide_draft
deferrable initially deferred
for each row execute function content.solmind_suggested_waypoint_state_guard();

create constraint trigger suggested_waypoint_pending_state_guard
after insert or update or delete on content.suggested_waypoint_pending_outbound
deferrable initially deferred
for each row execute function content.solmind_suggested_waypoint_state_guard();

create function content.solmind_suggested_waypoint_request_sha256(
  p_request jsonb
)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select pg_catalog.encode(
           extensions.digest(
             pg_catalog.convert_to(p_request::text, 'UTF8'),
             'sha256'
           ),
           'hex'
         );
$$;

alter function content.solmind_suggested_waypoint_request_sha256(jsonb)
  owner to postgres;

revoke all on function
  content.solmind_suggested_waypoint_request_sha256(jsonb)
  from public, anon, authenticated, service_role;

create function content.solmind_suggested_waypoint_guide_authorized(
  p_actor_user_account_id uuid,
  p_guide_explorer_relationship_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
      from core.guide_explorer_relationship relationship
      join core.guide_profile guide
        on guide.guide_profile_id = relationship.guide_profile_id
      join identity.user_account account
        on account.user_account_id = guide.user_account_id
     where relationship.guide_explorer_relationship_id =
           p_guide_explorer_relationship_id
       and relationship.relationship_status = 'active'
       and guide.user_account_id = p_actor_user_account_id
       and guide.status = 'active'
       and account.account_status = 'active'
       and exists (
         select 1
           from identity.user_role_assignment assignment
          where assignment.user_account_id = p_actor_user_account_id
            and assignment.role_code = 'guide'
            and assignment.role_status = 'active'
       )
  );
$$;

alter function content.solmind_suggested_waypoint_guide_authorized(uuid, uuid)
  owner to postgres;
revoke all on function
  content.solmind_suggested_waypoint_guide_authorized(uuid, uuid)
  from public, anon, authenticated, service_role;

create function content.solmind_suggested_waypoint_explorer_authorized(
  p_actor_user_account_id uuid,
  p_guide_explorer_relationship_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
      from core.guide_explorer_relationship relationship
      join core.explorer_profile explorer
        on explorer.explorer_profile_id = relationship.explorer_profile_id
      join identity.user_account account
        on account.user_account_id = explorer.user_account_id
     where relationship.guide_explorer_relationship_id =
           p_guide_explorer_relationship_id
       and relationship.relationship_status = 'active'
       and explorer.user_account_id = p_actor_user_account_id
       and explorer.status = 'active'
       and account.account_status = 'active'
       and exists (
         select 1
           from identity.user_role_assignment assignment
          where assignment.user_account_id = p_actor_user_account_id
            and assignment.role_code = 'explorer'
            and assignment.role_status = 'active'
       )
  );
$$;

alter function content.solmind_suggested_waypoint_explorer_authorized(uuid, uuid)
  owner to postgres;
revoke all on function
  content.solmind_suggested_waypoint_explorer_authorized(uuid, uuid)
  from public, anon, authenticated, service_role;

create function content.solmind_suggested_waypoint_relationship_active(
  p_guide_explorer_relationship_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
      from core.guide_explorer_relationship relationship
      join core.guide_profile guide
        on guide.guide_profile_id = relationship.guide_profile_id
      join core.explorer_profile explorer
        on explorer.explorer_profile_id = relationship.explorer_profile_id
      join identity.user_account guide_account
        on guide_account.user_account_id = guide.user_account_id
      join identity.user_account explorer_account
        on explorer_account.user_account_id = explorer.user_account_id
     where relationship.guide_explorer_relationship_id =
           p_guide_explorer_relationship_id
       and relationship.relationship_status = 'active'
       and guide.status = 'active'
       and explorer.status = 'active'
       and guide_account.account_status = 'active'
       and explorer_account.account_status = 'active'
       and exists (
         select 1
           from identity.user_role_assignment assignment
          where assignment.user_account_id = guide.user_account_id
            and assignment.role_code = 'guide'
            and assignment.role_status = 'active'
       )
       and exists (
         select 1
           from identity.user_role_assignment assignment
          where assignment.user_account_id = explorer.user_account_id
            and assignment.role_code = 'explorer'
            and assignment.role_status = 'active'
       )
  );
$$;

alter function content.solmind_suggested_waypoint_relationship_active(uuid)
  owner to postgres;
revoke all on function
  content.solmind_suggested_waypoint_relationship_active(uuid)
  from public, anon, authenticated, service_role;

create function content.solmind_suggested_waypoint_admin_authorized(
  p_actor_user_account_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
      from identity.user_account account
     where account.user_account_id = p_actor_user_account_id
       and account.account_status = 'active'
       and exists (
         select 1
           from identity.user_role_assignment assignment
          where assignment.user_account_id = p_actor_user_account_id
            and assignment.role_code = 'admin'
            and assignment.role_status = 'active'
       )
  );
$$;

alter function content.solmind_suggested_waypoint_admin_authorized(uuid)
  owner to postgres;
revoke all on function
  content.solmind_suggested_waypoint_admin_authorized(uuid)
  from public, anon, authenticated, service_role;

create function content.solmind_suggested_waypoint_identity_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
       select 1
         from core.guide_explorer_relationship relationship
        where relationship.guide_explorer_relationship_id =
              new.guide_explorer_relationship_id
          and relationship.guide_profile_id = new.guide_profile_id
          and relationship.explorer_profile_id = new.explorer_profile_id
     )
  then
    raise exception 'solmind_suggested_waypoint_identity_mismatch';
  end if;
  return new;
end;
$$;

alter function content.solmind_suggested_waypoint_identity_guard()
  owner to postgres;
revoke all on function content.solmind_suggested_waypoint_identity_guard()
  from public, anon, authenticated, service_role;

create trigger suggested_waypoint_identity_guard
before insert or update of
  guide_explorer_relationship_id,
  guide_profile_id,
  explorer_profile_id
on content.suggested_waypoint
for each row execute function content.solmind_suggested_waypoint_identity_guard();

create function content.solmind_block_suggested_waypoint_immutable_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'solmind_suggested_waypoint_immutable';
end;
$$;

alter function content.solmind_block_suggested_waypoint_immutable_change()
  owner to postgres;
revoke all on function
  content.solmind_block_suggested_waypoint_immutable_change()
  from public, anon, authenticated, service_role;

create trigger suggested_waypoint_version_immutable
before update or delete on content.suggested_waypoint_version
for each row execute function
  content.solmind_block_suggested_waypoint_immutable_change();

create trigger suggested_waypoint_read_state_immutable
before update or delete on content.suggested_waypoint_explorer_read_state
for each row execute function
  content.solmind_block_suggested_waypoint_immutable_change();

create trigger suggested_waypoint_receipt_immutable
before update or delete on content.suggested_waypoint_receipt
for each row execute function
  content.solmind_block_suggested_waypoint_immutable_change();

create trigger suggested_waypoint_operation_result_immutable
before update or delete on content.suggested_waypoint_operation_result
for each row execute function
  content.solmind_block_suggested_waypoint_immutable_change();

create function content.solmind_record_suggested_waypoint_audit(
  p_event_type text,
  p_action text,
  p_actor_role_context text,
  p_actor_user_account_id uuid,
  p_suggested_waypoint_id uuid,
  p_metadata jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_expected_action text;
  v_expected_role text;
  v_summary text;
  v_key text;
  v_allowed_keys text[] := array[
    'operationId',
    'relationshipId',
    'suggestedWaypointId',
    'versionId',
    'policyKey',
    'policyVersion',
    'deadlineAt',
    'workerOperationId',
    'correlationId',
    'outcome'
  ];
begin
  case p_event_type
    when 'suggested_waypoint_draft_saved' then
      v_expected_action := 'save';
      v_expected_role := 'guide';
      v_summary := 'Suggested Waypoint draft saved.';
    when 'suggested_waypoint_send_scheduled' then
      v_expected_action := 'schedule';
      v_expected_role := 'guide';
      v_summary := 'Suggested Waypoint send scheduled.';
    when 'suggested_waypoint_send_pulled_back' then
      v_expected_action := 'pull_back';
      v_expected_role := 'guide';
      v_summary := 'Suggested Waypoint send pulled back.';
    when 'suggested_waypoint_version_delivered' then
      v_expected_action := 'deliver';
      v_expected_role := 'system';
      v_summary := 'Suggested Waypoint version delivered.';
    when 'suggested_waypoint_receipt_acknowledged' then
      v_expected_action := 'acknowledge';
      v_expected_role := 'explorer';
      v_summary := 'Suggested Waypoint receipt acknowledged.';
    else
      raise exception 'solmind_suggested_waypoint_audit_event_invalid';
  end case;

  if p_action is distinct from v_expected_action
     or p_actor_role_context is distinct from v_expected_role
     or (v_expected_role = 'system' and p_actor_user_account_id is not null)
     or (v_expected_role <> 'system' and p_actor_user_account_id is null)
     or p_suggested_waypoint_id is null
     or p_metadata is null
     or pg_catalog.jsonb_typeof(p_metadata) <> 'object'
     or pg_catalog.length(p_metadata::text) > 2048
  then
    raise exception 'solmind_suggested_waypoint_audit_invalid';
  end if;

  for v_key in
    select key_name
      from pg_catalog.jsonb_object_keys(p_metadata) as keys(key_name)
  loop
    if not (v_key = any(v_allowed_keys))
       or pg_catalog.jsonb_typeof(p_metadata -> v_key) <> 'string'
       or pg_catalog.length(p_metadata ->> v_key) > 128
    then
      raise exception 'solmind_suggested_waypoint_audit_metadata_invalid';
    end if;
  end loop;

  insert into audit.audit_event (
    event_type,
    actor_user_account_id,
    actor_role_context,
    target_entity_type,
    target_entity_id,
    action,
    reason_code,
    event_summary,
    ip_address,
    user_agent,
    metadata
  ) values (
    p_event_type,
    p_actor_user_account_id,
    p_actor_role_context,
    'suggested_waypoint',
    p_suggested_waypoint_id,
    p_action,
    'applied',
    v_summary,
    null,
    null,
    p_metadata
  );
end;
$$;

alter function content.solmind_record_suggested_waypoint_audit(
  text, text, text, uuid, uuid, jsonb
) owner to postgres;
revoke all on function content.solmind_record_suggested_waypoint_audit(
  text, text, text, uuid, uuid, jsonb
) from public, anon, authenticated, service_role;

create function public.solmind_save_suggested_waypoint_draft(
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

  v_destination := content.solmind_normalize_suggested_waypoint_text(
    p_destination, 1, 160
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

create function public.solmind_schedule_suggested_waypoint_send(
  p_actor_user_account_id uuid,
  p_operation_id uuid,
  p_suggested_waypoint_id uuid,
  p_suggested_waypoint_version_id uuid,
  p_expected_revision bigint
)
returns table (
  outcome_code text,
  operation_id uuid,
  suggested_waypoint_id uuid,
  authoring_revision bigint,
  current_version_id uuid,
  committed_at timestamptz,
  pending_version_id uuid,
  deadline_at timestamptz,
  policy_key text,
  policy_version bigint,
  effective_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing content.suggested_waypoint_operation_result%rowtype;
  v_owner content.suggested_waypoint%rowtype;
  v_draft content.suggested_waypoint_guide_draft%rowtype;
  v_setting core.application_setting%rowtype;
  v_effective_seconds integer;
  v_digest text;
  v_now timestamptz := pg_catalog.transaction_timestamp();
  v_deadline timestamptz;
begin
  if p_actor_user_account_id is null
     or p_operation_id is null
     or p_suggested_waypoint_id is null
     or p_suggested_waypoint_version_id is null
     or p_expected_revision is null
     or p_expected_revision < 1
  then
    raise exception 'solmind_suggested_waypoint_invalid_request';
  end if;

  v_digest := content.solmind_suggested_waypoint_request_sha256(
    pg_catalog.jsonb_build_object(
      'actorClass', 'human',
      'actorUserAccountId', p_actor_user_account_id,
      'commandKind', 'schedule_send',
      'expectedRevision', p_expected_revision,
      'pendingVersionId', p_suggested_waypoint_version_id,
      'suggestedWaypointId', p_suggested_waypoint_id
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
       and v_existing.command_kind = 'schedule_send'
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
        v_existing.pending_version_id,
        v_existing.deadline_at,
        v_existing.policy_key,
        v_existing.policy_version,
        v_existing.effective_seconds;
    elsif v_existing.actor_user_account_id is distinct from
          p_actor_user_account_id then
      return query select
        'relationship_unavailable'::text,
        p_operation_id,
        null::uuid,
        null::bigint,
        null::uuid,
        null::timestamptz,
        null::uuid,
        null::timestamptz,
        null::text,
        null::bigint,
        null::integer;
    else
      return query select
        'operation_conflict'::text,
        p_operation_id,
        p_suggested_waypoint_id,
        null::bigint,
        null::uuid,
        null::timestamptz,
        null::uuid,
        null::timestamptz,
        null::text,
        null::bigint,
        null::integer;
    end if;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_suggested_waypoint_id::text, 0)
  );
  select * into v_owner
    from content.suggested_waypoint owner_row
   where owner_row.suggested_waypoint_id = p_suggested_waypoint_id
   for update;

  if not found
     or not content.solmind_suggested_waypoint_guide_authorized(
       p_actor_user_account_id,
       v_owner.guide_explorer_relationship_id
     )
  then
    return query select
      'relationship_unavailable'::text,
      p_operation_id,
      null::uuid,
      null::bigint,
      null::uuid,
      null::timestamptz,
      null::uuid,
      null::timestamptz,
      null::text,
      null::bigint,
      null::integer;
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
      null::uuid,
      null::timestamptz,
      null::text,
      null::bigint,
      null::integer;
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
      null::uuid,
      null::timestamptz,
      null::text,
      null::bigint,
      null::integer;
    return;
  end if;

  select * into v_draft
    from content.suggested_waypoint_guide_draft draft
   where draft.suggested_waypoint_id = p_suggested_waypoint_id
     and draft.authoring_revision = p_expected_revision
   for update;
  if not found then
    return query select
      'invalid_transition'::text,
      p_operation_id,
      p_suggested_waypoint_id,
      v_owner.authoring_revision,
      null::uuid,
      null::timestamptz,
      null::uuid,
      null::timestamptz,
      null::text,
      null::bigint,
      null::integer;
    return;
  end if;

  select * into v_setting
    from core.application_setting setting
   where setting.setting_key = 'suggested_waypoint_send_grace_seconds'
   for share;
  if not found then
    return query select
      'policy_unavailable'::text,
      p_operation_id,
      p_suggested_waypoint_id,
      v_owner.authoring_revision,
      null::uuid,
      null::timestamptz,
      null::uuid,
      null::timestamptz,
      null::text,
      null::bigint,
      null::integer;
    return;
  end if;

  select coalesce(
           preference.send_grace_seconds,
           v_setting.integer_value
         )
    into v_effective_seconds
    from (select 1) singleton
    left join core.guide_suggested_waypoint_preference preference
      on preference.guide_profile_id = v_owner.guide_profile_id;

  if v_effective_seconds not between
       v_setting.minimum_integer_value and v_setting.maximum_integer_value
  then
    return query select
      'policy_unavailable'::text,
      p_operation_id,
      p_suggested_waypoint_id,
      v_owner.authoring_revision,
      null::uuid,
      null::timestamptz,
      null::uuid,
      null::timestamptz,
      null::text,
      null::bigint,
      null::integer;
    return;
  end if;

  v_deadline := v_now + pg_catalog.make_interval(secs => v_effective_seconds);
  insert into content.suggested_waypoint_pending_outbound (
    suggested_waypoint_id,
    pending_version_id,
    guide_explorer_relationship_id,
    guide_profile_id,
    explorer_profile_id,
    destination,
    why,
    arrival_signals,
    authoring_revision,
    schedule_operation_id,
    policy_key,
    policy_version,
    effective_seconds,
    scheduled_at,
    deadline_at,
    audit_correlation_id
  ) values (
    p_suggested_waypoint_id,
    p_suggested_waypoint_version_id,
    v_owner.guide_explorer_relationship_id,
    v_owner.guide_profile_id,
    v_owner.explorer_profile_id,
    v_draft.destination,
    v_draft.why,
    v_draft.arrival_signals,
    v_draft.authoring_revision,
    p_operation_id,
    v_setting.setting_key,
    v_setting.version,
    v_effective_seconds,
    v_now,
    v_deadline,
    v_owner.audit_correlation_id
  );

  delete from content.suggested_waypoint_guide_draft draft
   where draft.suggested_waypoint_id = p_suggested_waypoint_id;
  update content.suggested_waypoint owner_row
     set authoring_mode = 'pending',
         last_operation_id = p_operation_id,
         state_changed_at = v_now
   where owner_row.suggested_waypoint_id = p_suggested_waypoint_id;

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
    committed_at,
    pending_version_id,
    deadline_at,
    policy_key,
    policy_version,
    effective_seconds
  ) values (
    p_operation_id,
    p_actor_user_account_id,
    'human',
    'schedule_send',
    v_owner.guide_explorer_relationship_id,
    p_suggested_waypoint_id,
    v_digest,
    'applied',
    v_owner.authoring_revision,
    v_now,
    p_suggested_waypoint_version_id,
    v_deadline,
    v_setting.setting_key,
    v_setting.version,
    v_effective_seconds
  );

  perform content.solmind_record_suggested_waypoint_audit(
    'suggested_waypoint_send_scheduled',
    'schedule',
    'guide',
    p_actor_user_account_id,
    p_suggested_waypoint_id,
    pg_catalog.jsonb_build_object(
      'operationId', p_operation_id::text,
      'relationshipId', v_owner.guide_explorer_relationship_id::text,
      'suggestedWaypointId', p_suggested_waypoint_id::text,
      'versionId', p_suggested_waypoint_version_id::text,
      'policyKey', v_setting.setting_key,
      'policyVersion', v_setting.version::text,
      'deadlineAt', v_deadline::text,
      'correlationId', v_owner.audit_correlation_id::text,
      'outcome', 'applied'
    )
  );

  return query select
    'applied'::text,
    p_operation_id,
    p_suggested_waypoint_id,
    v_owner.authoring_revision,
    null::uuid,
    v_now,
    p_suggested_waypoint_version_id,
    v_deadline,
    v_setting.setting_key,
    v_setting.version,
    v_effective_seconds;
end;
$$;

alter function public.solmind_schedule_suggested_waypoint_send(
  uuid, uuid, uuid, uuid, bigint
) owner to postgres;
revoke all on function public.solmind_schedule_suggested_waypoint_send(
  uuid, uuid, uuid, uuid, bigint
) from public, anon, authenticated;
grant execute on function public.solmind_schedule_suggested_waypoint_send(
  uuid, uuid, uuid, uuid, bigint
) to service_role;

create function public.solmind_pull_back_suggested_waypoint(
  p_actor_user_account_id uuid,
  p_operation_id uuid,
  p_suggested_waypoint_id uuid,
  p_expected_revision bigint,
  p_expected_pending_version_id uuid
)
returns table (
  outcome_code text,
  operation_id uuid,
  suggested_waypoint_id uuid,
  authoring_revision bigint,
  current_version_id uuid,
  committed_at timestamptz,
  draft_restored_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing content.suggested_waypoint_operation_result%rowtype;
  v_owner content.suggested_waypoint%rowtype;
  v_pending content.suggested_waypoint_pending_outbound%rowtype;
  v_digest text;
  v_now timestamptz := pg_catalog.transaction_timestamp();
  v_revision bigint;
begin
  if p_actor_user_account_id is null
     or p_operation_id is null
     or p_suggested_waypoint_id is null
     or p_expected_revision is null
     or p_expected_revision < 1
     or p_expected_pending_version_id is null
  then
    raise exception 'solmind_suggested_waypoint_invalid_request';
  end if;

  v_digest := content.solmind_suggested_waypoint_request_sha256(
    pg_catalog.jsonb_build_object(
      'actorClass', 'human',
      'actorUserAccountId', p_actor_user_account_id,
      'commandKind', 'pull_back',
      'expectedPendingVersionId', p_expected_pending_version_id,
      'expectedRevision', p_expected_revision,
      'suggestedWaypointId', p_suggested_waypoint_id
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
       and v_existing.command_kind = 'pull_back'
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
        v_existing.draft_restored_at;
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_suggested_waypoint_id::text, 0)
  );
  select * into v_owner
    from content.suggested_waypoint owner_row
   where owner_row.suggested_waypoint_id = p_suggested_waypoint_id
   for update;
  if not found
     or not content.solmind_suggested_waypoint_guide_authorized(
       p_actor_user_account_id,
       v_owner.guide_explorer_relationship_id
     )
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

  select * into v_pending
    from content.suggested_waypoint_pending_outbound pending
   where pending.suggested_waypoint_id = p_suggested_waypoint_id
   for update;
  if v_owner.authoring_mode <> 'pending'
     or not found
     or v_pending.pending_version_id <> p_expected_pending_version_id
  then
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
  if v_now >= v_pending.deadline_at then
    return query select
      'too_late'::text,
      p_operation_id,
      p_suggested_waypoint_id,
      v_owner.authoring_revision,
      v_owner.current_version_id,
      null::timestamptz,
      null::timestamptz;
    return;
  end if;

  v_revision := v_owner.authoring_revision + 1;
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
    v_owner.guide_explorer_relationship_id,
    v_owner.guide_profile_id,
    v_owner.explorer_profile_id,
    v_pending.destination,
    v_pending.why,
    v_pending.arrival_signals,
    v_revision,
    v_now,
    v_now
  );
  delete from content.suggested_waypoint_pending_outbound pending
   where pending.suggested_waypoint_id = p_suggested_waypoint_id;
  update content.suggested_waypoint owner_row
     set authoring_mode = 'draft',
         authoring_revision = v_revision,
         last_operation_id = p_operation_id,
         state_changed_at = v_now
   where owner_row.suggested_waypoint_id = p_suggested_waypoint_id;

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
    draft_restored_at
  ) values (
    p_operation_id,
    p_actor_user_account_id,
    'human',
    'pull_back',
    v_owner.guide_explorer_relationship_id,
    p_suggested_waypoint_id,
    v_digest,
    'applied',
    v_revision,
    null,
    v_now,
    v_now
  );
  perform content.solmind_record_suggested_waypoint_audit(
    'suggested_waypoint_send_pulled_back',
    'pull_back',
    'guide',
    p_actor_user_account_id,
    p_suggested_waypoint_id,
    pg_catalog.jsonb_build_object(
      'operationId', p_operation_id::text,
      'relationshipId', v_owner.guide_explorer_relationship_id::text,
      'suggestedWaypointId', p_suggested_waypoint_id::text,
      'versionId', p_expected_pending_version_id::text,
      'correlationId', v_owner.audit_correlation_id::text,
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

alter function public.solmind_pull_back_suggested_waypoint(
  uuid, uuid, uuid, bigint, uuid
) owner to postgres;
revoke all on function public.solmind_pull_back_suggested_waypoint(
  uuid, uuid, uuid, bigint, uuid
) from public, anon, authenticated;
grant execute on function public.solmind_pull_back_suggested_waypoint(
  uuid, uuid, uuid, bigint, uuid
) to service_role;

create function public.solmind_deliver_suggested_waypoint(
  p_operation_id uuid,
  p_suggested_waypoint_id uuid,
  p_expected_pending_version_id uuid
)
returns table (
  outcome_code text,
  operation_id uuid,
  suggested_waypoint_id uuid,
  authoring_revision bigint,
  current_version_id uuid,
  committed_at timestamptz,
  delivered_version_id uuid,
  delivered_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing content.suggested_waypoint_operation_result%rowtype;
  v_owner content.suggested_waypoint%rowtype;
  v_pending content.suggested_waypoint_pending_outbound%rowtype;
  v_digest text;
  v_now timestamptz := pg_catalog.transaction_timestamp();
begin
  if p_operation_id is null
     or p_suggested_waypoint_id is null
     or p_expected_pending_version_id is null
  then
    raise exception 'solmind_suggested_waypoint_invalid_request';
  end if;

  v_digest := content.solmind_suggested_waypoint_request_sha256(
    pg_catalog.jsonb_build_object(
      'actorClass', 'system_worker',
      'commandKind', 'deliver',
      'expectedPendingVersionId', p_expected_pending_version_id,
      'suggestedWaypointId', p_suggested_waypoint_id
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_operation_id::text, 0)
  );
  select * into v_existing
    from content.suggested_waypoint_operation_result result
   where result.operation_id = p_operation_id;
  if found then
    if v_existing.actor_user_account_id is null
       and v_existing.actor_class = 'system_worker'
       and v_existing.command_kind = 'deliver'
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
        v_existing.delivered_version_id,
        v_existing.delivered_at;
    else
      return query select
        'operation_conflict'::text,
        p_operation_id,
        p_suggested_waypoint_id,
        null::bigint,
        null::uuid,
        null::timestamptz,
        null::uuid,
        null::timestamptz;
    end if;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_suggested_waypoint_id::text, 0)
  );
  select * into v_owner
    from content.suggested_waypoint owner_row
   where owner_row.suggested_waypoint_id = p_suggested_waypoint_id
   for update;
  if not found
     or not content.solmind_suggested_waypoint_relationship_active(
       v_owner.guide_explorer_relationship_id
     )
  then
    return query select
      'relationship_unavailable'::text,
      p_operation_id,
      null::uuid,
      null::bigint,
      null::uuid,
      null::timestamptz,
      null::uuid,
      null::timestamptz;
    return;
  end if;

  select * into v_pending
    from content.suggested_waypoint_pending_outbound pending
   where pending.suggested_waypoint_id = p_suggested_waypoint_id
   for update;
  if v_owner.authoring_mode <> 'pending'
     or not found
     or v_pending.pending_version_id <> p_expected_pending_version_id
  then
    return query select
      'invalid_transition'::text,
      p_operation_id,
      p_suggested_waypoint_id,
      v_owner.authoring_revision,
      v_owner.current_version_id,
      null::timestamptz,
      null::uuid,
      null::timestamptz;
    return;
  end if;
  if v_now < v_pending.deadline_at then
    return query select
      'too_late'::text,
      p_operation_id,
      p_suggested_waypoint_id,
      v_owner.authoring_revision,
      v_owner.current_version_id,
      null::timestamptz,
      null::uuid,
      null::timestamptz;
    return;
  end if;

  insert into content.suggested_waypoint_version (
    suggested_waypoint_version_id,
    suggested_waypoint_id,
    guide_explorer_relationship_id,
    guide_profile_id,
    explorer_profile_id,
    version_number,
    predecessor_version_id,
    destination,
    why,
    arrival_signals,
    delivered_at,
    delivery_operation_id,
    audit_correlation_id
  ) values (
    v_pending.pending_version_id,
    p_suggested_waypoint_id,
    v_owner.guide_explorer_relationship_id,
    v_owner.guide_profile_id,
    v_owner.explorer_profile_id,
    1,
    null,
    v_pending.destination,
    v_pending.why,
    v_pending.arrival_signals,
    v_now,
    p_operation_id,
    v_owner.audit_correlation_id
  );
  delete from content.suggested_waypoint_pending_outbound pending
   where pending.suggested_waypoint_id = p_suggested_waypoint_id;
  update content.suggested_waypoint owner_row
     set authoring_mode = 'delivered',
         current_version_id = v_pending.pending_version_id,
         last_operation_id = p_operation_id,
         state_changed_at = v_now
   where owner_row.suggested_waypoint_id = p_suggested_waypoint_id;

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
    delivered_version_id,
    delivered_at
  ) values (
    p_operation_id,
    null,
    'system_worker',
    'deliver',
    v_owner.guide_explorer_relationship_id,
    p_suggested_waypoint_id,
    v_digest,
    'applied',
    v_owner.authoring_revision,
    v_pending.pending_version_id,
    v_now,
    v_pending.pending_version_id,
    v_now
  );
  perform content.solmind_record_suggested_waypoint_audit(
    'suggested_waypoint_version_delivered',
    'deliver',
    'system',
    null,
    p_suggested_waypoint_id,
    pg_catalog.jsonb_build_object(
      'operationId', p_operation_id::text,
      'relationshipId', v_owner.guide_explorer_relationship_id::text,
      'suggestedWaypointId', p_suggested_waypoint_id::text,
      'versionId', v_pending.pending_version_id::text,
      'policyKey', v_pending.policy_key,
      'policyVersion', v_pending.policy_version::text,
      'workerOperationId', p_operation_id::text,
      'correlationId', v_owner.audit_correlation_id::text,
      'outcome', 'applied'
    )
  );
  return query select
    'applied'::text,
    p_operation_id,
    p_suggested_waypoint_id,
    v_owner.authoring_revision,
    v_pending.pending_version_id,
    v_now,
    v_pending.pending_version_id,
    v_now;
end;
$$;

alter function public.solmind_deliver_suggested_waypoint(uuid, uuid, uuid)
  owner to postgres;
revoke all on function public.solmind_deliver_suggested_waypoint(
  uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.solmind_deliver_suggested_waypoint(
  uuid, uuid, uuid
) to service_role;

create function public.solmind_mark_suggested_waypoint_read(
  p_actor_user_account_id uuid,
  p_operation_id uuid,
  p_suggested_waypoint_id uuid,
  p_version_id uuid
)
returns table (
  outcome_code text,
  operation_id uuid,
  suggested_waypoint_id uuid,
  authoring_revision bigint,
  current_version_id uuid,
  committed_at timestamptz,
  read_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing content.suggested_waypoint_operation_result%rowtype;
  v_owner content.suggested_waypoint%rowtype;
  v_digest text;
  v_now timestamptz := pg_catalog.transaction_timestamp();
begin
  if p_actor_user_account_id is null
     or p_operation_id is null
     or p_suggested_waypoint_id is null
     or p_version_id is null
  then
    raise exception 'solmind_suggested_waypoint_invalid_request';
  end if;
  v_digest := content.solmind_suggested_waypoint_request_sha256(
    pg_catalog.jsonb_build_object(
      'actorClass', 'human',
      'actorUserAccountId', p_actor_user_account_id,
      'commandKind', 'mark_read',
      'suggestedWaypointId', p_suggested_waypoint_id,
      'versionId', p_version_id
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
       and v_existing.command_kind = 'mark_read'
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
        v_existing.read_at;
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

  select * into v_owner
    from content.suggested_waypoint owner_row
   where owner_row.suggested_waypoint_id = p_suggested_waypoint_id
   for update;
  if not found
     or not content.solmind_suggested_waypoint_explorer_authorized(
       p_actor_user_account_id,
       v_owner.guide_explorer_relationship_id
     )
     or v_owner.authoring_mode <> 'delivered'
     or v_owner.current_version_id <> p_version_id
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
  if exists (
    select 1
      from content.suggested_waypoint_explorer_read_state read_state
     where read_state.suggested_waypoint_version_id = p_version_id
       and read_state.explorer_profile_id = v_owner.explorer_profile_id
  ) then
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

  insert into content.suggested_waypoint_explorer_read_state (
    suggested_waypoint_version_id,
    suggested_waypoint_id,
    guide_explorer_relationship_id,
    explorer_profile_id,
    read_at,
    read_operation_id
  ) values (
    p_version_id,
    p_suggested_waypoint_id,
    v_owner.guide_explorer_relationship_id,
    v_owner.explorer_profile_id,
    v_now,
    p_operation_id
  );
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
    read_at
  ) values (
    p_operation_id,
    p_actor_user_account_id,
    'human',
    'mark_read',
    v_owner.guide_explorer_relationship_id,
    p_suggested_waypoint_id,
    v_digest,
    'applied',
    v_owner.authoring_revision,
    v_owner.current_version_id,
    v_now,
    v_now
  );
  return query select
    'applied'::text,
    p_operation_id,
    p_suggested_waypoint_id,
    v_owner.authoring_revision,
    v_owner.current_version_id,
    v_now,
    v_now;
end;
$$;

alter function public.solmind_mark_suggested_waypoint_read(
  uuid, uuid, uuid, uuid
) owner to postgres;
revoke all on function public.solmind_mark_suggested_waypoint_read(
  uuid, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.solmind_mark_suggested_waypoint_read(
  uuid, uuid, uuid, uuid
) to service_role;

create function public.solmind_acknowledge_suggested_waypoint_receipt(
  p_actor_user_account_id uuid,
  p_operation_id uuid,
  p_suggested_waypoint_id uuid,
  p_expected_current_version_id uuid
)
returns table (
  outcome_code text,
  operation_id uuid,
  suggested_waypoint_id uuid,
  authoring_revision bigint,
  current_version_id uuid,
  committed_at timestamptz,
  acknowledged_version_id uuid,
  acknowledged_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing content.suggested_waypoint_operation_result%rowtype;
  v_owner content.suggested_waypoint%rowtype;
  v_digest text;
  v_now timestamptz := pg_catalog.transaction_timestamp();
begin
  if p_actor_user_account_id is null
     or p_operation_id is null
     or p_suggested_waypoint_id is null
     or p_expected_current_version_id is null
  then
    raise exception 'solmind_suggested_waypoint_invalid_request';
  end if;
  v_digest := content.solmind_suggested_waypoint_request_sha256(
    pg_catalog.jsonb_build_object(
      'actorClass', 'human',
      'actorUserAccountId', p_actor_user_account_id,
      'commandKind', 'acknowledge_receipt',
      'expectedCurrentVersionId', p_expected_current_version_id,
      'suggestedWaypointId', p_suggested_waypoint_id
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
       and v_existing.command_kind = 'acknowledge_receipt'
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
        v_existing.acknowledged_version_id,
        v_existing.acknowledged_at;
    elsif v_existing.actor_user_account_id is distinct from
          p_actor_user_account_id then
      return query select
        'relationship_unavailable'::text,
        p_operation_id,
        null::uuid,
        null::bigint,
        null::uuid,
        null::timestamptz,
        null::uuid,
        null::timestamptz;
    else
      return query select
        'operation_conflict'::text,
        p_operation_id,
        p_suggested_waypoint_id,
        null::bigint,
        null::uuid,
        null::timestamptz,
        null::uuid,
        null::timestamptz;
    end if;
    return;
  end if;

  select * into v_owner
    from content.suggested_waypoint owner_row
   where owner_row.suggested_waypoint_id = p_suggested_waypoint_id
   for update;
  if not found
     or not content.solmind_suggested_waypoint_explorer_authorized(
       p_actor_user_account_id,
       v_owner.guide_explorer_relationship_id
     )
     or v_owner.authoring_mode <> 'delivered'
  then
    return query select
      'relationship_unavailable'::text,
      p_operation_id,
      null::uuid,
      null::bigint,
      null::uuid,
      null::timestamptz,
      null::uuid,
      null::timestamptz;
    return;
  end if;
  if v_owner.current_version_id <> p_expected_current_version_id then
    return query select
      'stale'::text,
      p_operation_id,
      p_suggested_waypoint_id,
      v_owner.authoring_revision,
      v_owner.current_version_id,
      null::timestamptz,
      null::uuid,
      null::timestamptz;
    return;
  end if;
  if exists (
    select 1
      from content.suggested_waypoint_receipt receipt
     where receipt.suggested_waypoint_version_id =
           p_expected_current_version_id
       and receipt.explorer_profile_id = v_owner.explorer_profile_id
  ) then
    return query select
      'invalid_transition'::text,
      p_operation_id,
      p_suggested_waypoint_id,
      v_owner.authoring_revision,
      v_owner.current_version_id,
      null::timestamptz,
      null::uuid,
      null::timestamptz;
    return;
  end if;

  insert into content.suggested_waypoint_receipt (
    suggested_waypoint_version_id,
    suggested_waypoint_id,
    guide_explorer_relationship_id,
    explorer_profile_id,
    acknowledged_at,
    acknowledgement_operation_id
  ) values (
    p_expected_current_version_id,
    p_suggested_waypoint_id,
    v_owner.guide_explorer_relationship_id,
    v_owner.explorer_profile_id,
    v_now,
    p_operation_id
  );
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
    acknowledged_version_id,
    acknowledged_at
  ) values (
    p_operation_id,
    p_actor_user_account_id,
    'human',
    'acknowledge_receipt',
    v_owner.guide_explorer_relationship_id,
    p_suggested_waypoint_id,
    v_digest,
    'applied',
    v_owner.authoring_revision,
    v_owner.current_version_id,
    v_now,
    p_expected_current_version_id,
    v_now
  );
  perform content.solmind_record_suggested_waypoint_audit(
    'suggested_waypoint_receipt_acknowledged',
    'acknowledge',
    'explorer',
    p_actor_user_account_id,
    p_suggested_waypoint_id,
    pg_catalog.jsonb_build_object(
      'operationId', p_operation_id::text,
      'relationshipId', v_owner.guide_explorer_relationship_id::text,
      'suggestedWaypointId', p_suggested_waypoint_id::text,
      'versionId', p_expected_current_version_id::text,
      'correlationId', v_owner.audit_correlation_id::text,
      'outcome', 'applied'
    )
  );
  return query select
    'applied'::text,
    p_operation_id,
    p_suggested_waypoint_id,
    v_owner.authoring_revision,
    v_owner.current_version_id,
    v_now,
    p_expected_current_version_id,
    v_now;
end;
$$;

alter function public.solmind_acknowledge_suggested_waypoint_receipt(
  uuid, uuid, uuid, uuid
) owner to postgres;
revoke all on function public.solmind_acknowledge_suggested_waypoint_receipt(
  uuid, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.solmind_acknowledge_suggested_waypoint_receipt(
  uuid, uuid, uuid, uuid
) to service_role;

create function public.solmind_list_guide_suggested_waypoints(
  p_actor_user_account_id uuid,
  p_guide_explorer_relationship_id uuid,
  p_page_size integer,
  p_cursor text default null
)
returns table (
  items jsonb,
  next_cursor text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cursor_text text;
  v_cursor_time timestamptz;
  v_cursor_id uuid;
begin
  if p_page_size not in (5, 10, 20, 50, 100) then
    raise exception 'solmind_suggested_waypoint_invalid_page_size';
  end if;
  if not content.solmind_suggested_waypoint_guide_authorized(
    p_actor_user_account_id,
    p_guide_explorer_relationship_id
  ) then
    return query select '[]'::jsonb, null::text, 0::bigint;
    return;
  end if;

  if p_cursor is not null then
    begin
      v_cursor_text := pg_catalog.convert_from(
        pg_catalog.decode(p_cursor, 'base64'),
        'UTF8'
      );
      v_cursor_time := pg_catalog.split_part(v_cursor_text, '|', 1)::timestamptz;
      v_cursor_id := pg_catalog.split_part(v_cursor_text, '|', 2)::uuid;
      if pg_catalog.split_part(v_cursor_text, '|', 3) <> '' then
        raise exception 'invalid';
      end if;
    exception when others then
      raise exception 'solmind_suggested_waypoint_invalid_cursor';
    end;
    if not exists (
      select 1
        from content.suggested_waypoint owner_row
       where owner_row.suggested_waypoint_id = v_cursor_id
         and owner_row.guide_explorer_relationship_id =
             p_guide_explorer_relationship_id
         and owner_row.state_changed_at = v_cursor_time
    ) then
      raise exception 'solmind_suggested_waypoint_invalid_cursor';
    end if;
  end if;

  return query
  with authorized as (
    select owner_row.suggested_waypoint_id,
           owner_row.authoring_mode,
           owner_row.authoring_revision,
           coalesce(
             draft.destination,
             pending.destination,
             version.destination
           ) as destination_preview,
           pending.deadline_at as pending_deadline_at,
           (
             pending.deadline_at is not null
             and pg_catalog.transaction_timestamp() < pending.deadline_at
           ) as pull_back_available,
           case
             when owner_row.authoring_mode = 'draft' then 'not_delivered'
             when owner_row.authoring_mode = 'pending' then 'pending'
             else 'open'
           end as channel_category,
           owner_row.current_version_id,
           version.delivered_at,
           receipt.suggested_waypoint_version_id as acknowledged_version_id,
           receipt.acknowledged_at,
           owner_row.state_changed_at
      from content.suggested_waypoint owner_row
      left join content.suggested_waypoint_guide_draft draft
        on draft.suggested_waypoint_id = owner_row.suggested_waypoint_id
      left join content.suggested_waypoint_pending_outbound pending
        on pending.suggested_waypoint_id = owner_row.suggested_waypoint_id
      left join content.suggested_waypoint_version version
        on version.suggested_waypoint_version_id = owner_row.current_version_id
      left join content.suggested_waypoint_receipt receipt
        on receipt.suggested_waypoint_version_id = owner_row.current_version_id
       and receipt.explorer_profile_id = owner_row.explorer_profile_id
     where owner_row.guide_explorer_relationship_id =
           p_guide_explorer_relationship_id
  ), page_plus_one as (
    select authorized.*
      from authorized
     where p_cursor is null
        or (authorized.state_changed_at, authorized.suggested_waypoint_id) <
           (v_cursor_time, v_cursor_id)
     order by authorized.state_changed_at desc,
              authorized.suggested_waypoint_id desc
     limit p_page_size + 1
  ), page as (
    select page_plus_one.*
      from page_plus_one
     order by page_plus_one.state_changed_at desc,
              page_plus_one.suggested_waypoint_id desc
     limit p_page_size
  ), last_row as (
    select page.state_changed_at, page.suggested_waypoint_id
      from page
     order by page.state_changed_at,
              page.suggested_waypoint_id
     limit 1
  )
  select coalesce(
           (
             select pg_catalog.jsonb_agg(
               pg_catalog.jsonb_build_object(
                 'suggested_waypoint_id', page.suggested_waypoint_id,
                 'authoring_mode', page.authoring_mode,
                 'authoring_revision', page.authoring_revision,
                 'destination_preview', page.destination_preview,
                 'pending_deadline_at', page.pending_deadline_at,
                 'pull_back_available', page.pull_back_available,
                 'channel_category', page.channel_category,
                 'current_version_id', page.current_version_id,
                 'delivered_at', page.delivered_at,
                 'acknowledged_version_id', page.acknowledged_version_id,
                 'acknowledged_at', page.acknowledged_at
               ) order by page.state_changed_at desc,
                          page.suggested_waypoint_id desc
             ) from page
           ),
           '[]'::jsonb
         ),
         case when (select pg_catalog.count(*) from page_plus_one) > p_page_size
           then (
             select pg_catalog.encode(
               pg_catalog.convert_to(
                 last_row.state_changed_at::text || '|' ||
                   last_row.suggested_waypoint_id::text,
                 'UTF8'
               ),
               'base64'
             ) from last_row
           )
           else null::text
         end,
         (select pg_catalog.count(*)::bigint from authorized);
end;
$$;

alter function public.solmind_list_guide_suggested_waypoints(
  uuid, uuid, integer, text
) owner to postgres;
revoke all on function public.solmind_list_guide_suggested_waypoints(
  uuid, uuid, integer, text
) from public, anon, authenticated;
grant execute on function public.solmind_list_guide_suggested_waypoints(
  uuid, uuid, integer, text
) to service_role;

create function public.solmind_get_guide_suggested_waypoint(
  p_actor_user_account_id uuid,
  p_guide_explorer_relationship_id uuid,
  p_suggested_waypoint_id uuid
)
returns table (
  suggested_waypoint_id uuid,
  authoring_mode text,
  authoring_revision bigint,
  destination_preview text,
  pending_deadline_at timestamptz,
  pull_back_available boolean,
  channel_category text,
  current_version_id uuid,
  delivered_at timestamptz,
  acknowledged_version_id uuid,
  acknowledged_at timestamptz,
  draft_or_pending_destination text,
  draft_or_pending_why text,
  draft_or_pending_arrival_signals jsonb,
  delivered_destination text,
  delivered_why text,
  delivered_arrival_signals jsonb,
  policy_key text,
  policy_version bigint,
  effective_seconds integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not content.solmind_suggested_waypoint_guide_authorized(
    p_actor_user_account_id,
    p_guide_explorer_relationship_id
  ) then
    return;
  end if;
  return query
  select owner_row.suggested_waypoint_id,
         owner_row.authoring_mode,
         owner_row.authoring_revision,
         coalesce(
           draft.destination,
           pending.destination,
           version.destination
         ),
         pending.deadline_at,
         (
           pending.deadline_at is not null
           and pg_catalog.transaction_timestamp() < pending.deadline_at
         ),
         case
           when owner_row.authoring_mode = 'draft' then 'not_delivered'
           when owner_row.authoring_mode = 'pending' then 'pending'
           else 'open'
         end,
         owner_row.current_version_id,
         version.delivered_at,
         receipt.suggested_waypoint_version_id,
         receipt.acknowledged_at,
         coalesce(draft.destination, pending.destination),
         coalesce(draft.why, pending.why),
         coalesce(draft.arrival_signals, pending.arrival_signals),
         version.destination,
         version.why,
         version.arrival_signals,
         pending.policy_key,
         pending.policy_version,
         pending.effective_seconds
    from content.suggested_waypoint owner_row
    left join content.suggested_waypoint_guide_draft draft
      on draft.suggested_waypoint_id = owner_row.suggested_waypoint_id
    left join content.suggested_waypoint_pending_outbound pending
      on pending.suggested_waypoint_id = owner_row.suggested_waypoint_id
    left join content.suggested_waypoint_version version
      on version.suggested_waypoint_version_id = owner_row.current_version_id
    left join content.suggested_waypoint_receipt receipt
      on receipt.suggested_waypoint_version_id = owner_row.current_version_id
     and receipt.explorer_profile_id = owner_row.explorer_profile_id
   where owner_row.guide_explorer_relationship_id =
         p_guide_explorer_relationship_id
     and owner_row.suggested_waypoint_id = p_suggested_waypoint_id;
end;
$$;

alter function public.solmind_get_guide_suggested_waypoint(uuid, uuid, uuid)
  owner to postgres;
revoke all on function public.solmind_get_guide_suggested_waypoint(
  uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.solmind_get_guide_suggested_waypoint(
  uuid, uuid, uuid
) to service_role;

create function public.solmind_list_explorer_suggested_waypoints(
  p_actor_user_account_id uuid,
  p_page_size integer,
  p_cursor text default null
)
returns table (
  items jsonb,
  next_cursor text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_relationship_ids uuid[];
  v_relationship_id uuid;
  v_cursor_text text;
  v_cursor_time timestamptz;
  v_cursor_id uuid;
begin
  if p_page_size not in (5, 10, 20, 50, 100) then
    raise exception 'solmind_suggested_waypoint_invalid_page_size';
  end if;

  select pg_catalog.array_agg(
           relationship.guide_explorer_relationship_id
           order by relationship.guide_explorer_relationship_id
         )
    into v_relationship_ids
    from core.guide_explorer_relationship relationship
    join core.explorer_profile explorer
      on explorer.explorer_profile_id = relationship.explorer_profile_id
   where explorer.user_account_id = p_actor_user_account_id
     and relationship.relationship_status = 'active';
  if coalesce(pg_catalog.array_length(v_relationship_ids, 1), 0) <> 1
  then
    return query select '[]'::jsonb, null::text, 0::bigint;
    return;
  end if;
  v_relationship_id := v_relationship_ids[1];
  if not content.solmind_suggested_waypoint_explorer_authorized(
    p_actor_user_account_id,
    v_relationship_id
  ) then
    return query select '[]'::jsonb, null::text, 0::bigint;
    return;
  end if;

  if p_cursor is not null then
    begin
      v_cursor_text := pg_catalog.convert_from(
        pg_catalog.decode(p_cursor, 'base64'),
        'UTF8'
      );
      v_cursor_time := pg_catalog.split_part(v_cursor_text, '|', 1)::timestamptz;
      v_cursor_id := pg_catalog.split_part(v_cursor_text, '|', 2)::uuid;
      if pg_catalog.split_part(v_cursor_text, '|', 3) <> '' then
        raise exception 'invalid';
      end if;
    exception when others then
      raise exception 'solmind_suggested_waypoint_invalid_cursor';
    end;
    if not exists (
      select 1
        from content.suggested_waypoint owner_row
        join content.suggested_waypoint_version version
          on version.suggested_waypoint_version_id =
             owner_row.current_version_id
       where owner_row.suggested_waypoint_id = v_cursor_id
         and owner_row.guide_explorer_relationship_id = v_relationship_id
         and owner_row.authoring_mode = 'delivered'
         and version.delivered_at = v_cursor_time
    ) then
      raise exception 'solmind_suggested_waypoint_invalid_cursor';
    end if;
  end if;

  return query
  with authorized as (
    select owner_row.suggested_waypoint_id,
           version.suggested_waypoint_version_id as current_version_id,
           version.destination as destination_preview,
           version.delivered_at as received_at,
           (read_state.suggested_waypoint_version_id is not null) as read,
           (receipt.suggested_waypoint_version_id is not null) as
             receipt_acknowledged,
           receipt.acknowledged_at,
           'open'::text as channel_category
      from content.suggested_waypoint owner_row
      join content.suggested_waypoint_version version
        on version.suggested_waypoint_version_id = owner_row.current_version_id
      left join content.suggested_waypoint_explorer_read_state read_state
        on read_state.suggested_waypoint_version_id = owner_row.current_version_id
       and read_state.explorer_profile_id = owner_row.explorer_profile_id
      left join content.suggested_waypoint_receipt receipt
        on receipt.suggested_waypoint_version_id = owner_row.current_version_id
       and receipt.explorer_profile_id = owner_row.explorer_profile_id
     where owner_row.guide_explorer_relationship_id = v_relationship_id
       and owner_row.authoring_mode = 'delivered'
  ), page_plus_one as (
    select authorized.*
      from authorized
     where p_cursor is null
        or (authorized.received_at, authorized.suggested_waypoint_id) <
           (v_cursor_time, v_cursor_id)
     order by authorized.received_at desc,
              authorized.suggested_waypoint_id desc
     limit p_page_size + 1
  ), page as (
    select page_plus_one.*
      from page_plus_one
     order by page_plus_one.received_at desc,
              page_plus_one.suggested_waypoint_id desc
     limit p_page_size
  ), last_row as (
    select page.received_at, page.suggested_waypoint_id
      from page
     order by page.received_at, page.suggested_waypoint_id
     limit 1
  )
  select coalesce(
           (
             select pg_catalog.jsonb_agg(
               pg_catalog.jsonb_build_object(
                 'suggested_waypoint_id', page.suggested_waypoint_id,
                 'current_version_id', page.current_version_id,
                 'destination_preview', page.destination_preview,
                 'received_at', page.received_at,
                 'read', page.read,
                 'receipt_acknowledged', page.receipt_acknowledged,
                 'acknowledged_at', page.acknowledged_at,
                 'channel_category', page.channel_category
               ) order by page.received_at desc,
                          page.suggested_waypoint_id desc
             ) from page
           ),
           '[]'::jsonb
         ),
         case when (select pg_catalog.count(*) from page_plus_one) > p_page_size
           then (
             select pg_catalog.encode(
               pg_catalog.convert_to(
                 last_row.received_at::text || '|' ||
                   last_row.suggested_waypoint_id::text,
                 'UTF8'
               ),
               'base64'
             ) from last_row
           )
           else null::text
         end,
         (select pg_catalog.count(*)::bigint from authorized);
end;
$$;

alter function public.solmind_list_explorer_suggested_waypoints(
  uuid, integer, text
) owner to postgres;
revoke all on function public.solmind_list_explorer_suggested_waypoints(
  uuid, integer, text
) from public, anon, authenticated;
grant execute on function public.solmind_list_explorer_suggested_waypoints(
  uuid, integer, text
) to service_role;

create function public.solmind_get_explorer_suggested_waypoint(
  p_actor_user_account_id uuid,
  p_suggested_waypoint_id uuid
)
returns table (
  suggested_waypoint_id uuid,
  current_version_id uuid,
  destination text,
  why text,
  arrival_signals jsonb,
  received_at timestamptz,
  read boolean,
  read_at timestamptz,
  receipt_acknowledged boolean,
  acknowledged_at timestamptz,
  channel_category text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner content.suggested_waypoint%rowtype;
begin
  select * into v_owner
    from content.suggested_waypoint owner_row
   where owner_row.suggested_waypoint_id = p_suggested_waypoint_id
     and owner_row.authoring_mode = 'delivered';
  if not found
     or not content.solmind_suggested_waypoint_explorer_authorized(
       p_actor_user_account_id,
       v_owner.guide_explorer_relationship_id
     )
  then
    return;
  end if;
  return query
  select v_owner.suggested_waypoint_id,
         version.suggested_waypoint_version_id,
         version.destination,
         version.why,
         version.arrival_signals,
         version.delivered_at,
         (read_state.suggested_waypoint_version_id is not null),
         read_state.read_at,
         (receipt.suggested_waypoint_version_id is not null),
         receipt.acknowledged_at,
         'open'::text
    from content.suggested_waypoint_version version
    left join content.suggested_waypoint_explorer_read_state read_state
      on read_state.suggested_waypoint_version_id =
         version.suggested_waypoint_version_id
     and read_state.explorer_profile_id = v_owner.explorer_profile_id
    left join content.suggested_waypoint_receipt receipt
      on receipt.suggested_waypoint_version_id =
         version.suggested_waypoint_version_id
     and receipt.explorer_profile_id = v_owner.explorer_profile_id
   where version.suggested_waypoint_version_id = v_owner.current_version_id;
end;
$$;

alter function public.solmind_get_explorer_suggested_waypoint(uuid, uuid)
  owner to postgres;
revoke all on function public.solmind_get_explorer_suggested_waypoint(
  uuid, uuid
) from public, anon, authenticated;
grant execute on function public.solmind_get_explorer_suggested_waypoint(
  uuid, uuid
) to service_role;

create function public.solmind_get_admin_suggested_waypoint_operational_state(
  p_actor_user_account_id uuid,
  p_suggested_waypoint_id uuid
)
returns table (
  suggested_waypoint_id uuid,
  guide_explorer_relationship_id uuid,
  current_version_id uuid,
  pending_version_id uuid,
  policy_key text,
  policy_version bigint,
  worker_operation_id uuid,
  audit_correlation_id uuid,
  lifecycle_category text,
  outcome_code text,
  state_changed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not content.solmind_suggested_waypoint_admin_authorized(
    p_actor_user_account_id
  ) then
    return;
  end if;
  return query
  select owner_row.suggested_waypoint_id,
         owner_row.guide_explorer_relationship_id,
         owner_row.current_version_id,
         pending.pending_version_id,
         pending.policy_key,
         pending.policy_version,
         version.delivery_operation_id,
         owner_row.audit_correlation_id,
         owner_row.authoring_mode,
         operation.outcome_code,
         owner_row.state_changed_at
    from content.suggested_waypoint owner_row
    left join content.suggested_waypoint_pending_outbound pending
      on pending.suggested_waypoint_id = owner_row.suggested_waypoint_id
    left join content.suggested_waypoint_version version
      on version.suggested_waypoint_version_id = owner_row.current_version_id
    left join content.suggested_waypoint_operation_result operation
      on operation.operation_id = owner_row.last_operation_id
   where owner_row.suggested_waypoint_id = p_suggested_waypoint_id;
end;
$$;

alter function public.solmind_get_admin_suggested_waypoint_operational_state(
  uuid, uuid
) owner to postgres;
revoke all on function public.solmind_get_admin_suggested_waypoint_operational_state(
  uuid, uuid
) from public, anon, authenticated;
grant execute on function public.solmind_get_admin_suggested_waypoint_operational_state(
  uuid, uuid
) to service_role;

comment on function public.solmind_get_admin_suggested_waypoint_operational_state(
  uuid, uuid
) is 'Dormant S02 routine Admin operational projection. It exposes no suggestion content, read/open activity, receipt fact, or private Explorer behavior.';

commit;
