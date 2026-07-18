-- SolMind MVP0 P27-A: shared authorizing-evidence consumption.
-- Purpose:
--   - add one structural cross-operation backstop for authorizing evidence;
--   - backfill every existing session-linked challenge with its historical session clock;
--   - harden the session freshness policy to a structural singleton;
--   - replace the dormant session primitive so it consumes shared evidence atomically;
--   - change session locking to the evidence-first/shared-domain order required by P25/P26.
-- Creates no invitation acceptance, account/profile/relationship provisioning, route,
-- caller, cookie, provider action, consent, policy, Data API exposure, cloud path,
-- deployment, or real-user flow.

begin;

create table identity.authorizing_evidence_consumption (
  verification_challenge_id uuid primary key
    references identity.verification_challenge(verification_challenge_id)
    on update restrict
    on delete restrict,
  consumer_type text not null,
  consumer_record_id uuid not null,
  consumed_at timestamptz not null,
  retention_class text not null default 'security_log',

  constraint authorizing_evidence_consumption_consumer_type_check
    check (
      consumer_type in (
        'user_session',
        'guide_invitation_acceptance',
        'explorer_invitation_acceptance'
      )
    ),
  constraint authorizing_evidence_consumption_retention_class_check
    check (retention_class = 'security_log'),
  constraint authorizing_evidence_consumption_consumer_record_unique
    unique (consumer_type, consumer_record_id)
);

alter table identity.authorizing_evidence_consumption enable row level security;

revoke all on table identity.authorizing_evidence_consumption
  from public, anon, authenticated, service_role;

comment on table identity.authorizing_evidence_consumption is
  'Protected P27-A cross-operation replay backstop. One redeemed verification challenge may authorize exactly one enumerated consumer. It has no app-role table grant, policy, generic writer, free-form metadata, or Data API exposure.';
comment on column identity.authorizing_evidence_consumption.consumer_record_id is
  'UUID of the owning enumerated consumer record. The owning function proves the type-specific relationship; this intentionally is not a polymorphic foreign key.';
comment on column identity.authorizing_evidence_consumption.consumed_at is
  'Database clock of the owning operation. Historical session backfill uses user_session.created_at and never invents migration time.';

-- Prevent session writes while the historical representation is validated and
-- backfilled. SHARE conflicts with INSERT/UPDATE/DELETE while allowing reads.
lock table identity.user_session in share mode;

do $$
declare
  v_expected_count bigint;
  v_inserted_count bigint;
begin
  if exists (
    select 1
      from identity.user_session session
     where session.verification_challenge_id is not null
     group by session.verification_challenge_id
    having pg_catalog.count(*) <> 1
  ) then
    raise exception 'solmind_evidence_backfill_duplicate_session_challenge';
  end if;

  if exists (
    select 1
      from identity.user_session session
      left join identity.verification_challenge challenge
        on challenge.verification_challenge_id = session.verification_challenge_id
     where session.verification_challenge_id is not null
       and (
         challenge.verification_challenge_id is null
         or challenge.used_at is null
       )
  ) then
    raise exception 'solmind_evidence_backfill_invalid_session_challenge';
  end if;

  select pg_catalog.count(*)
    into v_expected_count
    from identity.user_session session
   where session.verification_challenge_id is not null;

  insert into identity.authorizing_evidence_consumption (
    verification_challenge_id,
    consumer_type,
    consumer_record_id,
    consumed_at
  )
  select session.verification_challenge_id,
         'user_session',
         session.user_session_id,
         session.created_at
    from identity.user_session session
   where session.verification_challenge_id is not null
   order by session.verification_challenge_id;

  get diagnostics v_inserted_count = row_count;

  if v_inserted_count <> v_expected_count then
    raise exception 'solmind_evidence_backfill_cardinality_mismatch';
  end if;

  if (
    select pg_catalog.count(*)
      from identity.authorizing_evidence_consumption consumption
     where consumption.consumer_type = 'user_session'
  ) <> v_expected_count then
    raise exception 'solmind_evidence_backfill_terminal_mismatch';
  end if;
end;
$$;

-- The banked session function already fails closed on duplicate policy rows.
-- P27-A turns that contract-only singleton into a structural fixed-name key.
do $$
begin
  if (
    select pg_catalog.count(*)
      from identity.session_creation_freshness_policy policy
     where policy.policy_name = 'redeemed_evidence_freshness'
  ) <> 1
     or (
       select pg_catalog.count(*)
         from identity.session_creation_freshness_policy
     ) <> 1 then
    raise exception 'solmind_session_policy_preflight_failed';
  end if;
end;
$$;

alter table identity.session_creation_freshness_policy
  add constraint session_creation_freshness_policy_pkey
  primary key (policy_name);

create or replace function public.solmind_create_user_session(
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
  v_evidence_lock_key bigint;
  v_account_lock_key bigint;
  v_challenge identity.verification_challenge%rowtype;
  v_existing_session identity.user_session%rowtype;
  v_existing_consumption identity.authorizing_evidence_consumption%rowtype;
  v_policy_count integer;
  v_minimum_seconds integer;
  v_active_seconds integer;
  v_maximum_seconds integer;
  v_active_valid_count integer;
  v_latest_session_evidence_used_at timestamptz;
  v_latest_session_evidence_challenge_id uuid;
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

  -- The evidence lock is always first for every sanctioned authorizing consumer.
  -- Domain-separated hashtextextended returns the signed bigint accepted by
  -- pg_advisory_xact_lock.
  v_evidence_lock_key := pg_catalog.hashtextextended(
    'solmind:authorizing-evidence:v1|' || p_verification_challenge_id::text,
    0
  );
  v_account_lock_key := pg_catalog.hashtextextended(
    'solmind:authorizing-domain:account:v1|' || p_user_account_id::text,
    0
  );

  begin
    perform pg_catalog.pg_advisory_xact_lock(v_evidence_lock_key);

    select challenge.*
      into v_challenge
      from identity.verification_challenge challenge
     where challenge.verification_challenge_id = p_verification_challenge_id
       for update;
    if not found then
      raise exception 'solmind_session_ineligible_evidence';
    end if;

    -- This session operation has one remaining domain key. Future consumers with
    -- multiple remaining keys must sort and de-duplicate the signed bigint set
    -- before acquisition; no consumer may acquire an earlier-class key later.
    perform pg_catalog.pg_advisory_xact_lock(v_account_lock_key);

    -- Capture the database clock once after all operation-level serialization.
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

    select session.*
      into v_existing_session
      from identity.user_session session
     where session.verification_challenge_id = p_verification_challenge_id
       for update;

    select consumption.*
      into v_existing_consumption
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id = p_verification_challenge_id
       for update;

    if v_existing_session.user_session_id is not null then
      if v_existing_consumption.verification_challenge_id is null
         or v_existing_consumption.consumer_type <> 'user_session'
         or v_existing_consumption.consumer_record_id <> v_existing_session.user_session_id
         or v_existing_consumption.consumed_at <> v_existing_session.created_at then
        raise exception 'solmind_session_consumption_integrity_failure';
      end if;

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

    if v_existing_consumption.verification_challenge_id is not null then
      raise exception 'solmind_session_evidence_consumed';
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

    select previous_challenge.used_at,
           previous_challenge.verification_challenge_id
      into v_latest_session_evidence_used_at,
           v_latest_session_evidence_challenge_id
      from identity.user_session previous_session
      join identity.verification_challenge previous_challenge
        on previous_challenge.verification_challenge_id = previous_session.verification_challenge_id
     where previous_session.user_account_id = p_user_account_id
       and previous_challenge.used_at is not null
     order by previous_challenge.used_at desc,
              previous_challenge.verification_challenge_id desc
     limit 1
       for share of previous_session, previous_challenge;

    if v_latest_session_evidence_used_at is not null
       and (
         v_challenge.used_at < v_latest_session_evidence_used_at
         or (
           v_challenge.used_at = v_latest_session_evidence_used_at
           and v_challenge.verification_challenge_id <= v_latest_session_evidence_challenge_id
         )
       ) then
      raise exception 'solmind_session_older_evidence';
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

    insert into identity.authorizing_evidence_consumption (
      verification_challenge_id,
      consumer_type,
      consumer_record_id,
      consumed_at
    ) values (
      p_verification_challenge_id,
      'user_session',
      v_new_session_id,
      v_now
    );

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

revoke all on function public.solmind_create_user_session(uuid, text, uuid, text, integer)
  from public;
revoke execute on function public.solmind_create_user_session(uuid, text, uuid, text, integer)
  from anon, authenticated;
grant execute on function public.solmind_create_user_session(uuid, text, uuid, text, integer)
  to service_role;

comment on function public.solmind_create_user_session(uuid, text, uuid, text, integer) is
  'P27-A dormant server-only session creation. It consumes committed account-bound login or role_reentry evidence through the shared cross-operation backstop, uses evidence-first then shared account-domain locking, generates the session UUID and database-clock expiry, enforces protected freshness and chronology for new creation, permits only exact writeless recovery with matching consumption integrity, atomically revokes one prior active session, and embeds exact Family B audit rows. EXECUTE is service_role-only. No invitation acceptance, route, caller, cookie, provider action, consent, cloud path, or real-user path is authorized.';

commit;
