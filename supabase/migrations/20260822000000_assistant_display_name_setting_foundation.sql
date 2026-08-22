-- PRJ01_V-WS05-WI022-S03: protected assistant display-name setting foundation.
-- This migration owns only the two Admin-managed product defaults and their
-- server-only database boundaries. It adds no route, browser surface, user
-- override, provider call, deployment, cloud action, or real-user effect.

begin;

create function core.assistant_display_name_is_valid(
  p_display_name text
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select pg_catalog.length(p_display_name) between 1 and 40
     and p_display_name = pg_catalog.btrim(p_display_name)
     and p_display_name !~ '[[:cntrl:]]'
     and pg_catalog.strpos(p_display_name, pg_catalog.chr(8232)) = 0
     and pg_catalog.strpos(p_display_name, pg_catalog.chr(8233)) = 0
     and pg_catalog.strpos(p_display_name, pg_catalog.chr(8234)) = 0
     and pg_catalog.strpos(p_display_name, pg_catalog.chr(8235)) = 0
     and pg_catalog.strpos(p_display_name, pg_catalog.chr(8236)) = 0
     and pg_catalog.strpos(p_display_name, pg_catalog.chr(8237)) = 0
     and pg_catalog.strpos(p_display_name, pg_catalog.chr(8238)) = 0
     and pg_catalog.strpos(p_display_name, pg_catalog.chr(8294)) = 0
     and pg_catalog.strpos(p_display_name, pg_catalog.chr(8295)) = 0
     and pg_catalog.strpos(p_display_name, pg_catalog.chr(8296)) = 0
     and pg_catalog.strpos(p_display_name, pg_catalog.chr(8297)) = 0;
$$;

alter function core.assistant_display_name_is_valid(text)
  owner to postgres;
revoke all on function
  core.assistant_display_name_is_valid(text)
  from public, anon, authenticated, service_role;

comment on function core.assistant_display_name_is_valid(text) is
  'Closed display-name validator: 1-40 trimmed Unicode characters, single line, with control, line-separator, and bidi embedding/override/isolate characters rejected. It is an internal table/function invariant and is not executable by application roles.';

create table core.assistant_display_name_setting (
  assistant_display_name_setting_id uuid primary key,
  setting_key text not null unique,
  display_name text not null,
  version bigint not null default 1,
  last_operation_id uuid null,
  updated_by_user_account_id uuid null
    references identity.user_account(user_account_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retention_class text not null default 'core_business',

  constraint assistant_display_name_setting_closed_identity_key_check
    check (
      (
        assistant_display_name_setting_id =
          'a30f0230-0000-4000-8000-000000000001'::uuid
        and setting_key = 'explorer_virtual_guide_default_display_name'
      )
      or
      (
        assistant_display_name_setting_id =
          'a30f0230-0000-4000-8000-000000000002'::uuid
        and setting_key = 'guide_assistant_default_display_name'
      )
    ),

  constraint assistant_display_name_setting_value_check
    check (core.assistant_display_name_is_valid(display_name)),

  constraint assistant_display_name_setting_version_check
    check (version >= 1),

  constraint assistant_display_name_setting_timestamps_check
    check (updated_at >= created_at),

  constraint assistant_display_name_setting_retention_check
    check (retention_class = 'core_business')
);

alter table core.assistant_display_name_setting enable row level security;

revoke all on table core.assistant_display_name_setting
  from public, anon, authenticated, service_role;

insert into core.assistant_display_name_setting (
  assistant_display_name_setting_id,
  setting_key,
  display_name
) values
  (
    'a30f0230-0000-4000-8000-000000000001',
    'explorer_virtual_guide_default_display_name',
    'Nivan'
  ),
  (
    'a30f0230-0000-4000-8000-000000000002',
    'guide_assistant_default_display_name',
    'Solomon'
  );

comment on table core.assistant_display_name_setting is
  'Protected closed two-key text-setting family for the Admin-managed Explorer Virtual Guide and Human Guide Assistant product-default display names. Direct table access is revoked, RLS has zero permissive policies, and only the fixed service-role functions in this migration may read or mutate rows.';

create function public.solmind_read_explorer_virtual_guide_default_display_name()
returns table (
  display_name text,
  version bigint,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select setting.display_name,
         setting.version,
         setting.updated_at
    from core.assistant_display_name_setting setting
   where setting.assistant_display_name_setting_id =
         'a30f0230-0000-4000-8000-000000000001'::uuid
     and setting.setting_key =
         'explorer_virtual_guide_default_display_name';

  if not found then
    raise exception 'solmind_assistant_display_name_unavailable';
  end if;
end;
$$;

alter function
  public.solmind_read_explorer_virtual_guide_default_display_name()
  owner to postgres;
revoke all on function
  public.solmind_read_explorer_virtual_guide_default_display_name()
  from public, anon, authenticated, service_role;
grant execute on function
  public.solmind_read_explorer_virtual_guide_default_display_name()
  to service_role;

comment on function
  public.solmind_read_explorer_virtual_guide_default_display_name() is
  'Server-only role-safe reader for only the Explorer-facing Virtual Guide product-default display name. It returns no Guide Assistant name and raises one value-free unavailable error when its fixed row is absent.';

create function public.solmind_read_guide_assistant_default_display_name()
returns table (
  display_name text,
  version bigint,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select setting.display_name,
         setting.version,
         setting.updated_at
    from core.assistant_display_name_setting setting
   where setting.assistant_display_name_setting_id =
         'a30f0230-0000-4000-8000-000000000002'::uuid
     and setting.setting_key = 'guide_assistant_default_display_name';

  if not found then
    raise exception 'solmind_assistant_display_name_unavailable';
  end if;
end;
$$;

alter function public.solmind_read_guide_assistant_default_display_name()
  owner to postgres;
revoke all on function
  public.solmind_read_guide_assistant_default_display_name()
  from public, anon, authenticated, service_role;
grant execute on function
  public.solmind_read_guide_assistant_default_display_name()
  to service_role;

comment on function
  public.solmind_read_guide_assistant_default_display_name() is
  'Server-only role-safe reader for only the Human Guide-facing Guide Assistant product-default display name. It returns no Explorer Virtual Guide name and raises one value-free unavailable error when its fixed row is absent.';

create function public.solmind_read_admin_assistant_display_name_settings(
  p_actor_user_account_id uuid
)
returns table (
  setting_key text,
  display_name text,
  version bigint,
  updated_at timestamptz,
  updated_by_user_account_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_actor_user_account_id is null
     or not exists (
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
     )
  then
    raise exception 'solmind_assistant_display_name_admin_required';
  end if;

  return query
  select setting.setting_key,
         setting.display_name,
         setting.version,
         setting.updated_at,
         setting.updated_by_user_account_id
    from core.assistant_display_name_setting setting
   order by setting.setting_key;

  if not found then
    raise exception 'solmind_assistant_display_name_unavailable';
  end if;
end;
$$;

alter function
  public.solmind_read_admin_assistant_display_name_settings(uuid)
  owner to postgres;
revoke all on function
  public.solmind_read_admin_assistant_display_name_settings(uuid)
  from public, anon, authenticated, service_role;
grant execute on function
  public.solmind_read_admin_assistant_display_name_settings(uuid)
  to service_role;

comment on function
  public.solmind_read_admin_assistant_display_name_settings(uuid) is
  'Server-only Admin settings reader. It rechecks the supplied server-derived account as an active Admin and returns exactly the two product-default names with version and update metadata. Browser callers and application roles receive no direct function or table access.';

create unique index audit_event_assistant_display_name_setting_operation_idx
  on audit.audit_event ((metadata ->> 'operation_id'))
  where event_type = 'assistant_display_name_setting_changed'
    and metadata ? 'operation_id';

create function public.solmind_set_assistant_display_name_setting(
  p_actor_user_account_id uuid,
  p_setting_key text,
  p_display_name text,
  p_expected_version bigint,
  p_operation_id uuid
)
returns table (
  outcome text,
  setting_key text,
  display_name text,
  version bigint,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '2000ms'
as $$
declare
  v_setting core.assistant_display_name_setting%rowtype;
  v_existing_audit audit.audit_event%rowtype;
  v_actor_user_account_id uuid;
begin
  if p_actor_user_account_id is null
     or p_expected_version is null
     or p_expected_version < 1
     or p_operation_id is null
  then
    raise exception 'solmind_assistant_display_name_invalid_request';
  end if;

  select account.user_account_id
    into v_actor_user_account_id
    from identity.user_account account
   where account.user_account_id = p_actor_user_account_id
     and account.account_status = 'active'
   for share;

  if not found
     or not exists (
       select 1
         from identity.user_role_assignment assignment
        where assignment.user_account_id = p_actor_user_account_id
          and assignment.role_code = 'admin'
          and assignment.role_status = 'active'
        for share
     )
  then
    raise exception 'solmind_assistant_display_name_admin_required';
  end if;

  if p_setting_key is null
     or p_setting_key not in (
       'explorer_virtual_guide_default_display_name',
       'guide_assistant_default_display_name'
     )
  then
    raise exception 'solmind_assistant_display_name_setting_not_allowed';
  end if;

  if p_display_name is null
     or not core.assistant_display_name_is_valid(p_display_name)
  then
    raise exception 'solmind_assistant_display_name_invalid_value';
  end if;

  select setting.*
    into v_setting
    from core.assistant_display_name_setting setting
   where setting.setting_key = p_setting_key
   for update;

  if not found then
    raise exception 'solmind_assistant_display_name_unavailable';
  end if;

  select event.*
    into v_existing_audit
    from audit.audit_event event
   where event.event_type = 'assistant_display_name_setting_changed'
     and event.metadata ->> 'operation_id' = p_operation_id::text;

  if found then
    if v_existing_audit.action = 'update'
       and v_existing_audit.actor_user_account_id = p_actor_user_account_id
       and v_existing_audit.actor_role_context = 'admin'
       and v_existing_audit.target_entity_type =
           'assistant_display_name_setting'
       and v_existing_audit.target_entity_id =
           v_setting.assistant_display_name_setting_id
       and v_existing_audit.reason_code =
           'admin_assistant_display_name_changed'
       and v_existing_audit.event_summary =
           'Admin changed a protected assistant display-name setting.'
       and v_existing_audit.metadata = pg_catalog.jsonb_build_object(
         'setting_key', p_setting_key,
         'expected_version', p_expected_version,
         'version', p_expected_version + 1,
         'operation_id', p_operation_id::text
       )
       and v_setting.last_operation_id = p_operation_id
       and v_setting.display_name = p_display_name
       and v_setting.version = p_expected_version + 1
       and v_setting.updated_by_user_account_id = p_actor_user_account_id
    then
      return query
      select 'already_applied'::text,
             v_setting.setting_key,
             v_setting.display_name,
             v_setting.version,
             v_setting.updated_at;
      return;
    end if;

    raise exception 'solmind_assistant_display_name_operation_conflict';
  end if;

  if v_setting.version <> p_expected_version then
    raise exception 'solmind_assistant_display_name_version_conflict';
  end if;

  if v_setting.display_name = p_display_name then
    return query
    select 'unchanged'::text,
           v_setting.setting_key,
           v_setting.display_name,
           v_setting.version,
           v_setting.updated_at;
    return;
  end if;

  update core.assistant_display_name_setting setting
     set display_name = p_display_name,
         version = setting.version + 1,
         last_operation_id = p_operation_id,
         updated_by_user_account_id = p_actor_user_account_id,
         updated_at = pg_catalog.now()
   where setting.assistant_display_name_setting_id =
         v_setting.assistant_display_name_setting_id
  returning setting.updated_at into v_setting.updated_at;

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
    'assistant_display_name_setting_changed',
    p_actor_user_account_id,
    'admin',
    'assistant_display_name_setting',
    v_setting.assistant_display_name_setting_id,
    'update',
    'admin_assistant_display_name_changed',
    'Admin changed a protected assistant display-name setting.',
    pg_catalog.jsonb_build_object(
      'setting_key', v_setting.setting_key,
      'expected_version', p_expected_version,
      'version', v_setting.version + 1,
      'operation_id', p_operation_id::text
    )
  );

  return query
  select 'applied'::text,
         v_setting.setting_key,
         p_display_name,
         v_setting.version + 1,
         v_setting.updated_at;
exception
  when lock_not_available then
    raise exception 'solmind_assistant_display_name_lock_unavailable';
end;
$$;

alter function public.solmind_set_assistant_display_name_setting(
  uuid, text, text, bigint, uuid
) owner to postgres;
revoke all on function public.solmind_set_assistant_display_name_setting(
  uuid, text, text, bigint, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.solmind_set_assistant_display_name_setting(
  uuid, text, text, bigint, uuid
) to service_role;

comment on function public.solmind_set_assistant_display_name_setting(
  uuid, text, text, bigint, uuid
) is
  'Service-role-only active-Admin mutation for the closed two-key assistant display-name setting family. The browser does not supply actor or role: an authenticated server owner derives the account id and this function rechecks and locks active account/Admin-role evidence in the same transaction. It validates 1-40 character single-line values, serializes the fixed row, applies first-commit-wins expected-version behavior, preserves exact typed retry and writeless same-value semantics, and records one same-transaction audit event with the actual Admin actor. The display-name value is deliberately absent from audit metadata.';

commit;
