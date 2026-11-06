-- 2026-11-06: Paul's approved early-test notice (decision queue 09:07:10 CST).
-- Account-bound agreement is separate from required product consent. The switch
-- starts off; this migration neither enables early tests nor waives pilot checks.
begin;

-- A typed protected application-setting singleton, following the integer and
-- assistant-display-name owners without widening their closed read/write keys.
create table core.explorer_early_test_notice_setting (
  application_setting_id uuid primary key
    default 'a30f0260-0000-4000-8000-000000000001'::uuid,
  setting_key text not null unique default 'explorer_early_test_notice',
  enabled boolean not null default false,
  notice_version text not null default 'early-test-notice-2026-11-06',
  version bigint not null default 1,
  last_operation_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint explorer_early_test_notice_setting_identity_check check (
    application_setting_id = 'a30f0260-0000-4000-8000-000000000001'::uuid
    and setting_key = 'explorer_early_test_notice'
  ),
  constraint explorer_early_test_notice_setting_notice_version_check check (
    notice_version ~ '^[a-z0-9][a-z0-9.-]{0,127}$'
  ),
  constraint explorer_early_test_notice_setting_version_check check (version >= 1),
  constraint explorer_early_test_notice_setting_time_check check (updated_at >= created_at)
);
alter table core.explorer_early_test_notice_setting enable row level security;
revoke all on table core.explorer_early_test_notice_setting
  from public, anon, authenticated, service_role;
insert into core.explorer_early_test_notice_setting default values;

create table identity.explorer_early_test_notice_agreement (
  agreement_id uuid primary key default gen_random_uuid(),
  user_account_id uuid not null references identity.user_account(user_account_id) on delete cascade,
  notice_version text not null,
  agreed_at timestamptz not null default clock_timestamp(),
  adult_affirmation boolean not null,
  constraint explorer_early_test_notice_agreement_account_version_key
    unique (user_account_id, notice_version),
  constraint explorer_early_test_notice_agreement_version_check check (
    notice_version ~ '^[a-z0-9][a-z0-9.-]{0,127}$'
  ),
  constraint explorer_early_test_notice_agreement_adult_check check (adult_affirmation is true)
);
alter table identity.explorer_early_test_notice_agreement enable row level security;
revoke all on table identity.explorer_early_test_notice_agreement
  from public, anon, authenticated, service_role;

create function identity.solmind_guard_early_test_notice_agreement_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- The FK cascade runs only after the account row has been deleted. Direct
  -- agreement deletion while its account exists remains forbidden.
  if TG_OP = 'DELETE' then
    if not exists (
      select 1 from identity.user_account a where a.user_account_id = OLD.user_account_id
    ) then return OLD; end if;
  end if;
  raise exception 'solmind_early_test_notice_agreement_immutable';
end $$;
create trigger explorer_early_test_notice_agreement_immutable
  before update or delete on identity.explorer_early_test_notice_agreement
  for each row execute function identity.solmind_guard_early_test_notice_agreement_v1();
create trigger explorer_early_test_notice_agreement_no_truncate
  before truncate on identity.explorer_early_test_notice_agreement
  for each statement execute function identity.solmind_guard_early_test_notice_agreement_v1();

-- Only these new audit families are protected by this trigger. Existing event
-- contracts and the closed generic audit writer remain unchanged.
create function audit.solmind_guard_early_test_notice_audit_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if OLD.event_type in (
      'explorer_early_test_notice_agreed', 'explorer_early_test_notice_setting_changed'
    ) or (TG_OP = 'UPDATE' and NEW.event_type in (
      'explorer_early_test_notice_agreed', 'explorer_early_test_notice_setting_changed'
    )) then raise exception 'solmind_early_test_notice_audit_immutable'; end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end $$;
create trigger explorer_early_test_notice_audit_immutable
  before update or delete on audit.audit_event
  for each row execute function audit.solmind_guard_early_test_notice_audit_v1();
create unique index explorer_early_test_notice_agreement_audit_idx
  on audit.audit_event (target_entity_id)
  where event_type = 'explorer_early_test_notice_agreed';
create unique index explorer_early_test_notice_setting_operation_idx
  on audit.audit_event ((metadata ->> 'operation_id'))
  where event_type = 'explorer_early_test_notice_setting_changed';

-- The server supplies an already authenticated actor and exact bound application
-- session. Mirror the Explorer RPC account/role and exact-session binding, with
-- no extra account-wide session cardinality rule at this notice-only boundary.
-- Every feature keeps its own existing authority and session checks.
-- No profile, onboarding or conversation data is read by the notice boundary.
create function identity.solmind_require_early_test_notice_explorer_v1(
  p_actor_user_account_id uuid, p_user_session_id uuid
) returns timestamptz
language plpgsql volatile security definer
set search_path = '' set lock_timeout = '2000ms' as $$
declare v_session identity.user_session%rowtype;
begin
  if current_setting('transaction_isolation') is distinct from 'read committed'
    or p_actor_user_account_id is null or p_user_session_id is null
  then raise exception 'solmind_early_test_notice_denied'; end if;
  perform a.user_account_id
    from identity.user_account a
    join identity.user_role_assignment r on r.user_account_id = a.user_account_id
      and r.role_code = 'explorer' and r.role_status = 'active'
      and r.revoked_at is null and r.granted_at <= clock_timestamp()
   where a.user_account_id = p_actor_user_account_id and a.account_status = 'active'
   for share of a, r;
  if not found then raise exception 'solmind_early_test_notice_denied'; end if;
  select s.* into v_session from identity.user_session s
   where s.user_session_id = p_user_session_id
     and s.user_account_id = p_actor_user_account_id
     and s.active_role_context = 'explorer' for share;
  if not found or v_session.user_account_id is distinct from p_actor_user_account_id
    or v_session.active_role_context is distinct from 'explorer'
    or v_session.session_status is distinct from 'active'
    or v_session.ended_at is not null or v_session.created_at > clock_timestamp()
    or v_session.expires_at <= clock_timestamp()
  then raise exception 'solmind_early_test_notice_denied'; end if;
  return v_session.expires_at;
end $$;

create function public.solmind_read_explorer_early_test_notice_setting_v1()
returns table (enabled boolean, notice_version text, version bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  return query select s.enabled, s.notice_version, s.version
    from core.explorer_early_test_notice_setting s
   where s.setting_key = 'explorer_early_test_notice';
  if not found then raise exception 'solmind_early_test_notice_unavailable'; end if;
end $$;

create function public.solmind_read_explorer_early_test_notice_v1(
  p_actor_user_account_id uuid, p_user_session_id uuid
) returns table (enabled boolean, notice_version text, agreed boolean)
language plpgsql volatile security definer
set search_path = '' set lock_timeout = '2000ms' as $$
declare v_setting core.explorer_early_test_notice_setting%rowtype;
  v_expires_at timestamptz;
begin
  v_expires_at := identity.solmind_require_early_test_notice_explorer_v1(
    p_actor_user_account_id, p_user_session_id);
  select s.* into v_setting from core.explorer_early_test_notice_setting s
   where s.setting_key = 'explorer_early_test_notice' for share;
  if not found then raise exception 'solmind_early_test_notice_unavailable'; end if;
  if v_expires_at <= clock_timestamp() then
    raise exception 'solmind_early_test_notice_denied'; end if;
  return query select v_setting.enabled, v_setting.notice_version, exists (
    select 1 from identity.explorer_early_test_notice_agreement a
     where a.user_account_id = p_actor_user_account_id
       and a.notice_version = v_setting.notice_version and a.adult_affirmation is true
  );
exception when lock_not_available then
  raise exception 'solmind_early_test_notice_unavailable';
end $$;

create function public.solmind_agree_explorer_early_test_notice_v1(
  p_actor_user_account_id uuid, p_user_session_id uuid,
  p_notice_version text, p_adult_affirmation boolean
) returns table (enabled boolean, notice_version text, agreed boolean)
language plpgsql volatile security definer
set search_path = '' set lock_timeout = '2000ms' as $$
declare v_setting core.explorer_early_test_notice_setting%rowtype;
  v_expires_at timestamptz; v_agreement_id uuid; v_agreed_at timestamptz;
begin
  if p_notice_version is null or p_notice_version !~ '^[a-z0-9][a-z0-9.-]{0,127}$'
    or p_adult_affirmation is distinct from true
  then raise exception 'solmind_early_test_notice_invalid_input'; end if;
  v_expires_at := identity.solmind_require_early_test_notice_explorer_v1(
    p_actor_user_account_id, p_user_session_id);
  select s.* into v_setting from core.explorer_early_test_notice_setting s
   where s.setting_key = 'explorer_early_test_notice' for share;
  if not found or v_setting.enabled is distinct from true
    or v_setting.notice_version is distinct from p_notice_version
  then raise exception 'solmind_early_test_notice_unavailable'; end if;
  if v_expires_at <= clock_timestamp() then
    raise exception 'solmind_early_test_notice_denied'; end if;
  v_agreed_at := clock_timestamp();
  insert into identity.explorer_early_test_notice_agreement (
    user_account_id, notice_version, agreed_at, adult_affirmation
  ) values (p_actor_user_account_id, p_notice_version, v_agreed_at, true)
  on conflict on constraint explorer_early_test_notice_agreement_account_version_key
    do nothing
  returning agreement_id into v_agreement_id;
  if v_agreement_id is not null then
    -- The agreement and its one content-free audit event commit together.
    insert into audit.audit_event (
      event_type, actor_user_account_id, actor_role_context, target_entity_type,
      target_entity_id, action, reason_code, event_summary, created_at, metadata
    ) values (
      'explorer_early_test_notice_agreed', p_actor_user_account_id, 'explorer',
      'explorer_early_test_notice_agreement', v_agreement_id, 'agree',
      'explorer_confirmed_early_test_notice',
      'Explorer agreed to the early-test notice and affirmed adulthood.',
      v_agreed_at, jsonb_build_object('notice_version', p_notice_version, 'adult_affirmation', true)
    );
  end if;
  -- A response lost after commit can repeat this exact agreement without a
  -- second row, timestamp update, audit event, provider call or product consent.
  if v_expires_at <= clock_timestamp() then
    raise exception 'solmind_early_test_notice_denied'; end if;
  return query select v_setting.enabled, v_setting.notice_version, true;
exception when lock_not_available then
  raise exception 'solmind_early_test_notice_unavailable';
end $$;

-- Operator-only switch, following protected application-setting authority,
-- expected-version serialization and exact writeless retry. No Admin UI or
-- routine-role setting capability is added.
create function public.solmind_set_explorer_early_test_notice_setting_v1(
  p_enabled boolean, p_notice_version text, p_expected_version bigint,
  p_operation_id uuid, p_authority_basis text, p_authority_reference_id uuid,
  p_reason_code text
) returns table (outcome text, enabled boolean, notice_version text, version bigint)
language plpgsql volatile security definer
set search_path = '' set lock_timeout = '2000ms' as $$
declare v_setting core.explorer_early_test_notice_setting%rowtype;
  v_audit audit.audit_event%rowtype; v_metadata jsonb;
begin
  if p_enabled is null or p_notice_version is null
    or p_notice_version !~ '^[a-z0-9][a-z0-9.-]{0,127}$'
    or p_expected_version is null or p_expected_version < 1
    or p_expected_version = 9223372036854775807 or p_operation_id is null
  then raise exception 'solmind_early_test_notice_invalid_input'; end if;
  if p_authority_reference_id is null or p_authority_basis is null
    or p_authority_basis not in ('paul_approved', 'system_operations_runbook')
    or p_reason_code is distinct from (case p_authority_basis
      when 'paul_approved' then 'paul_approved_configuration_change'
      when 'system_operations_runbook' then 'runbook_configuration_change' end)
  then raise exception 'solmind_early_test_notice_invalid_authority'; end if;
  select s.* into v_setting from core.explorer_early_test_notice_setting s
   where s.setting_key = 'explorer_early_test_notice' for update;
  if not found then raise exception 'solmind_early_test_notice_unavailable'; end if;
  v_metadata := jsonb_build_object(
    'setting_key', v_setting.setting_key, 'enabled', p_enabled,
    'notice_version', p_notice_version, 'expected_version', p_expected_version,
    'version', p_expected_version + 1, 'operation_id', p_operation_id::text,
    'authority_basis', p_authority_basis, 'authority_reference_id', p_authority_reference_id::text
  );
  select e.* into v_audit from audit.audit_event e
   where e.event_type = 'explorer_early_test_notice_setting_changed'
     and e.metadata ->> 'operation_id' = p_operation_id::text;
  if found then
    if v_audit.actor_user_account_id is null and v_audit.actor_role_context = 'system'
      and v_audit.target_entity_type = 'explorer_early_test_notice_setting'
      and v_audit.target_entity_id = v_setting.application_setting_id
      and v_audit.action = 'update' and v_audit.reason_code = p_reason_code
      and v_audit.event_summary = 'Protected early-test notice setting changed through the system-operations function.'
      and v_audit.metadata = v_metadata and v_setting.last_operation_id = p_operation_id
      and v_setting.enabled = p_enabled and v_setting.notice_version = p_notice_version
      and v_setting.version = p_expected_version + 1
    then
      return query select 'already_applied'::text, v_setting.enabled,
        v_setting.notice_version, v_setting.version;
      return;
    end if;
    raise exception 'solmind_early_test_notice_operation_conflict';
  end if;
  if v_setting.version <> p_expected_version then
    raise exception 'solmind_early_test_notice_version_conflict'; end if;
  if v_setting.enabled = p_enabled and v_setting.notice_version = p_notice_version then
    return query select 'unchanged'::text, v_setting.enabled,
      v_setting.notice_version, v_setting.version;
    return;
  end if;
  update core.explorer_early_test_notice_setting s
     set enabled = p_enabled, notice_version = p_notice_version,
       version = s.version + 1, last_operation_id = p_operation_id,
       updated_at = clock_timestamp()
   where s.application_setting_id = v_setting.application_setting_id;
  insert into audit.audit_event (
    event_type, actor_user_account_id, actor_role_context, target_entity_type,
    target_entity_id, action, reason_code, event_summary, metadata
  ) values (
    'explorer_early_test_notice_setting_changed', null, 'system',
    'explorer_early_test_notice_setting', v_setting.application_setting_id,
    'update', p_reason_code,
    'Protected early-test notice setting changed through the system-operations function.',
    v_metadata
  );
  return query select 'applied'::text, p_enabled, p_notice_version, p_expected_version + 1;
exception when lock_not_available then
  raise exception 'solmind_early_test_notice_unavailable';
end $$;

alter function identity.solmind_guard_early_test_notice_agreement_v1() owner to postgres;
alter function audit.solmind_guard_early_test_notice_audit_v1() owner to postgres;
alter function identity.solmind_require_early_test_notice_explorer_v1(uuid,uuid) owner to postgres;
alter function public.solmind_read_explorer_early_test_notice_setting_v1() owner to postgres;
alter function public.solmind_read_explorer_early_test_notice_v1(uuid,uuid) owner to postgres;
alter function public.solmind_agree_explorer_early_test_notice_v1(uuid,uuid,text,boolean) owner to postgres;
alter function public.solmind_set_explorer_early_test_notice_setting_v1(boolean,text,bigint,uuid,text,uuid,text) owner to postgres;

revoke all on function identity.solmind_guard_early_test_notice_agreement_v1(),
  audit.solmind_guard_early_test_notice_audit_v1(),
  identity.solmind_require_early_test_notice_explorer_v1(uuid,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.solmind_read_explorer_early_test_notice_setting_v1(),
  public.solmind_read_explorer_early_test_notice_v1(uuid,uuid),
  public.solmind_agree_explorer_early_test_notice_v1(uuid,uuid,text,boolean),
  public.solmind_set_explorer_early_test_notice_setting_v1(boolean,text,bigint,uuid,text,uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.solmind_read_explorer_early_test_notice_setting_v1(),
  public.solmind_read_explorer_early_test_notice_v1(uuid,uuid),
  public.solmind_agree_explorer_early_test_notice_v1(uuid,uuid,text,boolean),
  public.solmind_set_explorer_early_test_notice_setting_v1(boolean,text,bigint,uuid,text,uuid,text)
  to service_role;

comment on table core.explorer_early_test_notice_setting is
  'Protected typed application setting; off by default. Zero RLS policies and no direct app or service-role table grants. Only the fixed service-role reader and audited operator writer access the switch. Unsupported or unreadable configuration must fail closed in the app.';
comment on table identity.explorer_early_test_notice_agreement is
  'Append-only early-test notice agreement per Explorer account and notice version, with database time and true adult affirmation; removed only by account-deletion cascade. Existing account references and retention rules remain in force. No conversation content, product consent replacement, direct app/service-role access, Guide read or Admin read. The actor-bound service-role status reader exposes only the current account current-version boolean.';
comment on function public.solmind_set_explorer_early_test_notice_setting_v1(boolean,text,bigint,uuid,text,uuid,text) is
  'Operator-only setting mutation: requires prior Paul approval or separately authorized operations-runbook authority, with a UUID reference and exact reason. The service-role caller establishes that authority; this function adds no routine Admin, Guide, Explorer or browser setting access.';

commit;
