-- SolMind MVP0 DEF5-S4: dormant user-session creation primitive.
-- Purpose:
--   - create or exactly recover one account-bound SolMind session from committed redemption evidence;
--   - atomically revoke a prior active account session and write exact Family B audit rows;
--   - add protected redeemed-evidence freshness policy and structural uniqueness backstops.
-- Creates no users, pilot data, policies, table/schema grants, caller, route, cookie,
-- provider action, invitation/provisioning path, Guide assignment, or Data API exposure.

begin;

create table identity.session_creation_freshness_policy (
  policy_name text not null default 'redeemed_evidence_freshness',
  minimum_seconds integer not null,
  active_seconds integer not null,
  maximum_seconds integer not null,
  retention_class text not null default 'security_log',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint session_creation_freshness_policy_name_check
    check (policy_name = 'redeemed_evidence_freshness'),
  constraint session_creation_freshness_policy_values_check
    check (
      minimum_seconds > 0
      and minimum_seconds <= active_seconds
      and active_seconds <= maximum_seconds
    ),
  constraint session_creation_freshness_policy_retention_class_check
    check (retention_class = 'security_log')
);

alter table identity.session_creation_freshness_policy enable row level security;

insert into identity.session_creation_freshness_policy (
  minimum_seconds,
  active_seconds,
  maximum_seconds
) values (60, 300, 600);

comment on table identity.session_creation_freshness_policy is
  'Protected singleton-by-contract DEF5-S4 redeemed-evidence freshness policy. It is off the Data API and has no app-role table grants. The session function requires exactly one valid row and fails closed otherwise. A later separately gated restricted audited administrative operation will own policy changes.';

lock table identity.user_session in share mode;

do $$
begin
  if exists (
    select 1
      from identity.user_session
     where session_status = 'active'
     group by user_account_id
    having pg_catalog.count(*) > 1
  ) then
    raise exception 'solmind_session_existing_active_duplicate';
  end if;

  if exists (
    select 1
      from identity.user_session
     where verification_challenge_id is not null
     group by verification_challenge_id
    having pg_catalog.count(*) > 1
  ) then
    raise exception 'solmind_session_existing_challenge_duplicate';
  end if;
end;
$$;

create unique index user_session_one_active_per_account_idx
  on identity.user_session (user_account_id)
  where session_status = 'active';

create unique index user_session_one_per_challenge_idx
  on identity.user_session (verification_challenge_id)
  where verification_challenge_id is not null;

create function public.solmind_create_user_session(
  p_user_account_id uuid,
  p_active_role_context text,
  p_verification_challenge_id uuid,
  p_expected_purpose text,
  p_requested_duration_seconds integer
)
returns table (outcome text, user_session_id uuid, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '2000ms'
as $$
declare
  v_now timestamptz;
  v_account_lock_material text;
  v_challenge identity.verification_challenge%rowtype;
  v_existing_session identity.user_session%rowtype;
  v_policy_count integer;
  v_minimum_seconds integer;
  v_active_seconds integer;
  v_maximum_seconds integer;
  v_active_valid_count integer;
  v_superseded_count integer;
  v_superseded_session_id uuid;
  v_new_session_id uuid;
  v_new_expires_at timestamptz;
  v_dummy integer;
begin
  if p_user_account_id is null then
    raise exception 'solmind_session_invalid_account';
  end if;
  if p_active_role_context is null
     or pg_catalog.octet_length(p_active_role_context) > 8
     or p_active_role_context not in ('admin', 'guide', 'explorer') then
    raise exception 'solmind_session_invalid_role';
  end if;
  if p_verification_challenge_id is null then
    raise exception 'solmind_session_invalid_challenge';
  end if;
  if p_expected_purpose is null
     or pg_catalog.octet_length(p_expected_purpose) > 12
     or p_expected_purpose not in ('login', 'role_reentry') then
    raise exception 'solmind_session_invalid_purpose';
  end if;
  if p_requested_duration_seconds is null
     or p_requested_duration_seconds < 1
     or p_requested_duration_seconds > 3600 then
    raise exception 'solmind_session_invalid_duration';
  end if;

  v_account_lock_material := 'solmind:def5-s4:session-account:v1|'
    || p_user_account_id::text;

  begin
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_account_lock_material, 0)
    );

    -- Capture the database clock once after serialization. A contending invocation
    -- must evaluate freshness and expiry against the time at which it owns the
    -- account mutation boundary, not against a pre-wait timestamp.
    v_now := pg_catalog.clock_timestamp();

    select 1
      into v_dummy
      from identity.user_account account
     where account.user_account_id = p_user_account_id
       and account.account_status = 'active'
       for share;
    if not found then
      raise exception 'solmind_session_ineligible_account';
    end if;

    select 1
      into v_dummy
      from identity.user_role_assignment assignment
     where assignment.user_account_id = p_user_account_id
       and assignment.role_code = p_active_role_context
       and assignment.role_status = 'active'
       and assignment.revoked_at is null
     for share;
    if not found then
      raise exception 'solmind_session_ineligible_role';
    end if;

    select challenge.*
      into v_challenge
      from identity.verification_challenge challenge
     where challenge.verification_challenge_id = p_verification_challenge_id
       for update;
    if not found then
      raise exception 'solmind_session_ineligible_evidence';
    end if;

    select session.*
      into v_existing_session
      from identity.user_session session
     where session.verification_challenge_id = p_verification_challenge_id
       for update;

    if found then
      select pg_catalog.count(*)::integer
        into v_active_valid_count
        from identity.user_session session
       where session.user_account_id = p_user_account_id
         and session.session_status = 'active'
         and session.expires_at > v_now;

      if v_challenge.user_account_id = p_user_account_id
         and v_challenge.purpose = p_expected_purpose
         and v_challenge.used_at is not null
         and v_challenge.invalidated_at is null
         and v_existing_session.user_account_id = p_user_account_id
         and v_existing_session.active_role_context = p_active_role_context
         and v_existing_session.session_status = 'active'
         and v_existing_session.expires_at > v_now
         and v_active_valid_count = 1 then
        return query
          select 'existing'::text,
                 v_existing_session.user_session_id,
                 v_existing_session.expires_at;
        return;
      end if;

      raise exception 'solmind_session_conflicting_retry';
    end if;

    if v_challenge.user_account_id is distinct from p_user_account_id
       or v_challenge.user_contact_method_id is null
       or v_challenge.purpose <> p_expected_purpose
       or v_challenge.purpose not in ('login', 'role_reentry')
       or v_challenge.used_at is null
       or v_challenge.invalidated_at is not null then
      raise exception 'solmind_session_ineligible_evidence';
    end if;

    select pg_catalog.count(*)::integer,
           pg_catalog.min(policy.minimum_seconds),
           pg_catalog.min(policy.active_seconds),
           pg_catalog.min(policy.maximum_seconds)
      into v_policy_count, v_minimum_seconds, v_active_seconds, v_maximum_seconds
      from identity.session_creation_freshness_policy policy
     where policy.policy_name = 'redeemed_evidence_freshness';

    if v_policy_count <> 1
       or v_minimum_seconds is null
       or v_active_seconds is null
       or v_maximum_seconds is null
       or v_minimum_seconds <= 0
       or v_minimum_seconds > v_active_seconds
       or v_active_seconds > v_maximum_seconds then
      raise exception 'solmind_session_policy_unavailable';
    end if;

    if v_challenge.used_at > v_now
       or v_challenge.used_at < v_now - pg_catalog.make_interval(secs => v_active_seconds) then
      raise exception 'solmind_session_stale_evidence';
    end if;

    with changed as (
      update identity.user_session session
         set session_status = 'revoked',
             ended_at = v_now
       where session.user_account_id = p_user_account_id
         and session.session_status = 'active'
      returning session.user_session_id
    )
    select pg_catalog.count(*)::integer,
           pg_catalog.min(changed.user_session_id::text)::uuid
      into v_superseded_count, v_superseded_session_id
      from changed;

    if v_superseded_count > 1 then
      raise exception 'solmind_session_active_cardinality_violation';
    end if;

    v_new_session_id := pg_catalog.gen_random_uuid();
    v_new_expires_at := v_now + pg_catalog.make_interval(secs => p_requested_duration_seconds);

    insert into identity.user_session (
      user_session_id,
      user_account_id,
      active_role_context,
      created_at,
      expires_at,
      session_status,
      verification_challenge_id
    ) values (
      v_new_session_id,
      p_user_account_id,
      p_active_role_context,
      v_now,
      v_new_expires_at,
      'active',
      p_verification_challenge_id
    );

    if v_superseded_count = 1 then
      insert into audit.audit_event (
        event_type, actor_user_account_id, actor_role_context, target_entity_type,
        target_entity_id, action, reason_code, event_summary, metadata
      ) values (
        'session_superseded', p_user_account_id, p_active_role_context, 'user_session',
        v_superseded_session_id, 'revoke', 'superseded_by_new_login',
        'User session superseded by a newer login.',
        pg_catalog.jsonb_build_object('new_role_context', p_active_role_context)
      );
    end if;

    insert into audit.audit_event (
      event_type, actor_user_account_id, actor_role_context, target_entity_type,
      target_entity_id, action, reason_code, event_summary, metadata
    ) values (
      'session_created', p_user_account_id, p_active_role_context, 'user_session',
      v_new_session_id, 'create', 'login_success',
      'User session created after successful verification.',
      pg_catalog.jsonb_build_object('purpose', p_expected_purpose)
    );
  exception
    when lock_not_available or query_canceled or deadlock_detected or serialization_failure then
      raise exception 'solmind_session_lock_unavailable';
    when unique_violation or foreign_key_violation or check_violation or not_null_violation then
      raise exception 'solmind_session_integrity_failure';
  end;

  return query select 'created'::text, v_new_session_id, v_new_expires_at;
end;
$$;

alter function public.solmind_create_user_session(uuid, text, uuid, text, integer)
  owner to postgres;

revoke all on function public.solmind_create_user_session(uuid, text, uuid, text, integer) from public;
revoke execute on function public.solmind_create_user_session(uuid, text, uuid, text, integer) from anon, authenticated;
grant execute on function public.solmind_create_user_session(uuid, text, uuid, text, integer) to service_role;

comment on function public.solmind_create_user_session(uuid, text, uuid, text, integer) is
  'DEF5-S4 dormant server-only session creation. It consumes committed account-bound login or role_reentry redemption evidence, generates the session UUID and expiry from one database clock, enforces protected freshness for new creation, permits only exact writeless response-loss recovery, atomically revokes one prior active account session, and embeds exact Family B audit rows. EXECUTE is service_role-only. No runtime caller, cookie writer, provider action, invitation/provisioning path, Guide assignment, cloud path, or real-user path is authorized.';

commit;
