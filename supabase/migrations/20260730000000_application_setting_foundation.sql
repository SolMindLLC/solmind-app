-- PRJ01_R-WS09-WI021-S02: protected global application-setting foundation.
-- This migration owns only the Explorer Shared Snapshot sendability window.
-- It adds no Explorer persistence, synthetic fixture, route, browser access,
-- Guide/Admin UI, provider call, deployment, cloud action, or real-user effect.

begin;

create table core.application_setting (
  application_setting_id uuid primary key,
  setting_key text not null unique,
  integer_value integer not null default 7,
  minimum_integer_value integer not null default 1,
  default_integer_value integer not null default 7,
  maximum_integer_value integer not null default 100,
  version bigint not null default 1,
  last_operation_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retention_class text not null default 'core_business',

  constraint application_setting_singleton_id_check
    check (
      application_setting_id =
        'a30f0210-0000-4000-8000-000000000001'::uuid
    ),

  constraint application_setting_key_check
    check (
      setting_key = 'explorer_shared_snapshot_sendability_days'
    ),

  constraint application_setting_integer_bounds_check
    check (
      minimum_integer_value = 1
      and default_integer_value = 7
      and maximum_integer_value = 100
      and integer_value between minimum_integer_value and maximum_integer_value
    ),

  constraint application_setting_version_check
    check (version >= 1),

  constraint application_setting_timestamps_check
    check (updated_at >= created_at),

  constraint application_setting_retention_check
    check (retention_class = 'core_business')
);

alter table core.application_setting enable row level security;

revoke all on table core.application_setting
  from public, anon, authenticated, service_role;

insert into core.application_setting (
  application_setting_id,
  setting_key,
  integer_value
) values (
  'a30f0210-0000-4000-8000-000000000001',
  'explorer_shared_snapshot_sendability_days',
  7
);

comment on table core.application_setting is
  'Protected singleton MVP0 application setting. The only row stores the 1-100 day Explorer Shared Snapshot sendability window, default 7. RLS is enabled with zero policies and direct table access is revoked from app roles and service_role. Read and mutation are available only through the two fixed service-role functions in this migration.';

create function public.solmind_read_application_setting_integer(
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
  if p_setting_key is distinct from
       'explorer_shared_snapshot_sendability_days'
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
   where setting.application_setting_id =
         'a30f0210-0000-4000-8000-000000000001'::uuid
     and setting.setting_key =
         'explorer_shared_snapshot_sendability_days';

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
  'Server-only closed-allowlist integer setting read. Accepts only explorer_shared_snapshot_sendability_days, returns only its bounded value/metadata/version, owns no authorization decision, and is executable only by service_role. No app role receives direct table access.';

create unique index audit_event_application_setting_operation_idx
  on audit.audit_event ((metadata ->> 'operation_id'))
  where event_type = 'application_setting_changed'
    and metadata ? 'operation_id';

create function public.solmind_set_application_setting_integer(
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
  if p_setting_key is distinct from
       'explorer_shared_snapshot_sendability_days'
  then
    raise exception 'solmind_application_setting_not_allowed';
  end if;

  if p_integer_value is null or p_integer_value < 1
     or p_integer_value > 100
  then
    raise exception 'solmind_application_setting_invalid_value';
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

  if p_authority_reference_id is null
  then
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
   where setting.application_setting_id =
         'a30f0210-0000-4000-8000-000000000001'::uuid
     and setting.setting_key =
         'explorer_shared_snapshot_sendability_days'
     for update;

  if not found then
    raise exception 'solmind_application_setting_not_found';
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
  'Service-role-only audited system-operations mutation for the single Explorer Shared Snapshot sendability setting. The caller must already hold exact Paul approval or separately authorized system-operations runbook authority and must supply a UUID authority reference plus the matching closed reason code. The function accepts only the fixed key and 1-100 value, serializes the singleton row, applies optimistic expected-version first-commit-wins behavior, returns unchanged without a write when the requested value already equals the protected value, supports only an exact typed-field writeless retry of an applied operation, and writes one same-transaction system/null-actor audit row for an actual change. It grants no routine Admin, Guide, SolMind Guide Assistant, Explorer, browser, or direct-table path.';

commit;
