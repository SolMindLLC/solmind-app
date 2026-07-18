-- SolMind MVP0 P27-B: invitation-acceptance preparation boundary.
-- Purpose:
--   - add the protected invitation-acceptance evidence-freshness policy;
--   - add one immutable provider-provisioning reservation per invitation;
--   - harden provider-identity correlation and active cardinality;
--   - add dormant Guide and Explorer preparation functions that commit before provider IO;
--   - embed one exact Family B reservation audit row on first creation.
--
-- This migration performs no provider IO, account/contact/role/profile/relationship
-- provisioning, evidence consumption, invitation mutation, session creation, route,
-- caller, cookie, RLS policy, Data API exposure, cloud action, or real-user activation.

begin;

create table identity.invitation_acceptance_freshness_policy (
  policy_name text primary key,
  minimum_seconds integer not null,
  active_seconds integer not null,
  maximum_seconds integer not null,
  retention_class text not null default 'security_log',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint invitation_acceptance_freshness_policy_name_check
    check (policy_name = 'invitation_acceptance_evidence_freshness'),
  constraint invitation_acceptance_freshness_policy_values_check
    check (
      minimum_seconds > 0
      and minimum_seconds <= active_seconds
      and active_seconds <= maximum_seconds
    ),
  constraint invitation_acceptance_freshness_policy_retention_class_check
    check (retention_class = 'security_log'),
  constraint invitation_acceptance_freshness_policy_timestamps_check
    check (updated_at >= created_at)
);

alter table identity.invitation_acceptance_freshness_policy enable row level security;

revoke all on table identity.invitation_acceptance_freshness_policy
  from public, anon, authenticated, service_role;

insert into identity.invitation_acceptance_freshness_policy (
  policy_name,
  minimum_seconds,
  active_seconds,
  maximum_seconds
) values (
  'invitation_acceptance_evidence_freshness',
  60,
  300,
  600
);

comment on table identity.invitation_acceptance_freshness_policy is
  'Protected P27-B evidence-freshness policy for new invitation-acceptance preparation. The fixed 60/300/600 initial values may later be changed only through a separately approved restricted audited operation. No app role has direct table access.';

create table identity.auth_provider_provisioning_reservation (
  provisioning_reservation_id uuid primary key default gen_random_uuid(),
  guide_invite_id uuid null,
  explorer_invite_id uuid null,
  provider_name text not null default 'supabase',
  created_at timestamptz not null,
  expires_at timestamptz not null,
  retention_class text not null default 'security_log',

  constraint auth_provider_provisioning_reservation_guide_invite_fk
    foreign key (guide_invite_id)
    references core.guide_invite(guide_invite_id)
    on update restrict
    on delete restrict,
  constraint auth_provider_provisioning_reservation_explorer_invite_fk
    foreign key (explorer_invite_id)
    references core.explorer_invite(explorer_invite_id)
    on update restrict
    on delete restrict,
  constraint auth_provider_provisioning_reservation_invite_xor_check
    check ((guide_invite_id is null) <> (explorer_invite_id is null)),
  constraint auth_provider_provisioning_reservation_provider_name_check
    check (provider_name = 'supabase'),
  constraint auth_provider_provisioning_reservation_horizon_check
    check (expires_at = created_at + interval '24 hours'),
  constraint auth_provider_provisioning_reservation_retention_class_check
    check (retention_class = 'security_log')
);

alter table identity.auth_provider_provisioning_reservation enable row level security;

revoke all on table identity.auth_provider_provisioning_reservation
  from public, anon, authenticated, service_role;

create unique index auth_provider_provisioning_reservation_guide_invite_idx
  on identity.auth_provider_provisioning_reservation (guide_invite_id)
  where guide_invite_id is not null;

create unique index auth_provider_provisioning_reservation_explorer_invite_idx
  on identity.auth_provider_provisioning_reservation (explorer_invite_id)
  where explorer_invite_id is not null;

comment on table identity.auth_provider_provisioning_reservation is
  'Immutable P27-B provider-correlation reservation. Its UUID is the protected provider correlation value. The 24-hour expires_at value marks an overdue reconciliation candidate only and never authorizes provider IO, acceptance, cleanup, or deletion.';
comment on column identity.auth_provider_provisioning_reservation.provisioning_reservation_id is
  'Database-generated provider correlation UUID. It is not an invitation bearer token and must remain out of outward errors and operational telemetry.';
comment on column identity.auth_provider_provisioning_reservation.expires_at is
  'Operational reconciliation horizon only. Expiry is not acceptance authority and does not authorize automatic cleanup.';

-- Fail before adding the one-active-per-account/provider backstop if historical
-- data already violates it. Hold a SHARE lock across the preflight and index
-- creation so a concurrent provider-identity write cannot race the check. The
-- error is fixed and value-free.
lock table identity.auth_provider_identity in share mode;

do $$
begin
  if exists (
    select 1
      from identity.auth_provider_identity provider_identity
     where provider_identity.status = 'active'
     group by provider_identity.user_account_id, provider_identity.provider_name
    having pg_catalog.count(*) > 1
  ) then
    raise exception 'solmind_provider_identity_active_cardinality_preflight_failed';
  end if;
end;
$$;

alter table identity.auth_provider_identity
  add column provisioning_reservation_id uuid null;

alter table identity.auth_provider_identity
  add constraint auth_provider_identity_provisioning_reservation_fk
  foreign key (provisioning_reservation_id)
  references identity.auth_provider_provisioning_reservation(provisioning_reservation_id)
  on update restrict
  on delete restrict;

create unique index auth_provider_identity_provisioning_reservation_idx
  on identity.auth_provider_identity (provisioning_reservation_id)
  where provisioning_reservation_id is not null;

create unique index auth_provider_identity_one_active_account_provider_idx
  on identity.auth_provider_identity (user_account_id, provider_name)
  where status = 'active';

revoke all on table identity.auth_provider_identity
  from public, anon, authenticated, service_role;

comment on column identity.auth_provider_identity.provisioning_reservation_id is
  'Nullable exact correlation to the P27-B provider-provisioning reservation. At most one provider-identity row may reference one reservation.';

create function public.solmind_prepare_guide_invitation_acceptance(
  p_guide_invite_id uuid,
  p_verification_challenge_id uuid,
  p_normalized_provider_email text
)
returns table (outcome text, provisioning_reservation_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '2000ms'
as $$
declare
  v_candidate_invite core.guide_invite%rowtype;
  v_candidate_challenge identity.verification_challenge%rowtype;
  v_invite core.guide_invite%rowtype;
  v_challenge identity.verification_challenge%rowtype;
  v_reservation identity.auth_provider_provisioning_reservation%rowtype;
  v_account identity.user_account%rowtype;
  v_contact identity.user_contact_method%rowtype;
  v_evidence_lock_key bigint;
  v_domain_lock_keys bigint[];
  v_domain_lock_key bigint;
  v_now timestamptz;
  v_policy_count integer;
  v_minimum_seconds integer;
  v_active_seconds integer;
  v_maximum_seconds integer;
  v_matching_contact_count integer;
  v_target_provider_count integer;
  v_target_active_provider_count integer;
  v_conflicting_provider_count integer;
  v_target_provider_email text;
  v_existing_reservation boolean := false;
  v_new_reservation_id uuid;
begin
  begin
    if p_guide_invite_id is null
     or p_verification_challenge_id is null
     or p_normalized_provider_email is null
     or pg_catalog.octet_length(p_normalized_provider_email) < 3
     or pg_catalog.octet_length(p_normalized_provider_email) > 320
     or p_normalized_provider_email <> pg_catalog.btrim(p_normalized_provider_email)
     or p_normalized_provider_email <> pg_catalog.lower(p_normalized_provider_email) then
    raise exception 'solmind_invitation_prepare_invalid_request';
  end if;

  select invitation.*
    into v_candidate_invite
    from core.guide_invite invitation
   where invitation.guide_invite_id = p_guide_invite_id;
  if not found then
    raise exception 'solmind_invitation_prepare_ineligible';
  end if;

  select challenge.*
    into v_candidate_challenge
    from identity.verification_challenge challenge
   where challenge.verification_challenge_id = p_verification_challenge_id;
  if not found then
    raise exception 'solmind_invitation_prepare_ineligible';
  end if;

  v_evidence_lock_key := pg_catalog.hashtextextended(
    'solmind:authorizing-evidence:v1|' || p_verification_challenge_id::text,
    0
  );

  select pg_catalog.array_agg(keys.lock_key order by keys.lock_key)
    into v_domain_lock_keys
    from (
      select distinct pg_catalog.hashtextextended(material.lock_material, 0) as lock_key
        from (
          values
            (
              'solmind:authorizing-domain:invitation:v1|'
              || 'role=5:guide|invite=36:' || p_guide_invite_id::text
            ),
            (
              'solmind:authorizing-domain:contact:v1|'
              || 'type=' || pg_catalog.octet_length(v_candidate_invite.contact_method_type)::text
              || ':' || v_candidate_invite.contact_method_type
              || '|value=' || pg_catalog.octet_length(v_candidate_invite.normalized_contact_value)::text
              || ':' || v_candidate_invite.normalized_contact_value
            ),
            (
              'solmind:authorizing-domain:invitation-sibling:v1|'
              || 'role=5:guide'
              || '|type=' || pg_catalog.octet_length(v_candidate_invite.contact_method_type)::text
              || ':' || v_candidate_invite.contact_method_type
              || '|value=' || pg_catalog.octet_length(v_candidate_invite.normalized_contact_value)::text
              || ':' || v_candidate_invite.normalized_contact_value
            ),
            (
              'solmind:authorizing-domain:provider-email:v1|'
              || 'provider=8:supabase'
              || '|email=' || pg_catalog.octet_length(p_normalized_provider_email)::text
              || ':' || p_normalized_provider_email
            ),
            (
              case
                when v_candidate_challenge.user_account_id is null then null
                else 'solmind:authorizing-domain:account:v1|'
                     || v_candidate_challenge.user_account_id::text
              end
            )
        ) material(lock_material)
       where material.lock_material is not null
    ) keys;

    perform pg_catalog.pg_advisory_xact_lock(v_evidence_lock_key);

    select challenge.*
      into v_challenge
      from identity.verification_challenge challenge
     where challenge.verification_challenge_id = p_verification_challenge_id
       for update;
    if not found then
      raise exception 'solmind_invitation_prepare_ineligible';
    end if;

    if v_challenge.user_account_id is distinct from v_candidate_challenge.user_account_id
       or v_challenge.user_contact_method_id is distinct from v_candidate_challenge.user_contact_method_id
       or v_challenge.normalized_contact_value <> v_candidate_challenge.normalized_contact_value
       or v_challenge.contact_method_type <> v_candidate_challenge.contact_method_type
       or v_challenge.purpose <> v_candidate_challenge.purpose then
      raise exception 'solmind_invitation_prepare_conflict';
    end if;

    perform 1
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id = p_verification_challenge_id
       for update;
    if found then
      raise exception 'solmind_invitation_prepare_evidence_consumed';
    end if;

    foreach v_domain_lock_key in array v_domain_lock_keys loop
      perform pg_catalog.pg_advisory_xact_lock(v_domain_lock_key);
    end loop;

    v_now := pg_catalog.clock_timestamp();

    select reservation.*
      into v_reservation
      from identity.auth_provider_provisioning_reservation reservation
     where reservation.guide_invite_id = p_guide_invite_id
       for update;
    v_existing_reservation := found;

    perform invitation.guide_invite_id
      from core.guide_invite invitation
     where invitation.contact_method_type = v_candidate_invite.contact_method_type
       and invitation.normalized_contact_value = v_candidate_invite.normalized_contact_value
     order by invitation.guide_invite_id
       for update;

    select invitation.*
      into v_invite
      from core.guide_invite invitation
     where invitation.guide_invite_id = p_guide_invite_id;
    if not found
       or v_invite.contact_method_type <> v_candidate_invite.contact_method_type
       or v_invite.normalized_contact_value <> v_candidate_invite.normalized_contact_value then
      raise exception 'solmind_invitation_prepare_conflict';
    end if;

    if v_challenge.user_account_id is not null then
      select account.*
        into v_account
        from identity.user_account account
       where account.user_account_id = v_challenge.user_account_id
         for share;
      if not found then
        raise exception 'solmind_invitation_prepare_ineligible';
      end if;
    end if;

    perform contact.user_contact_method_id
      from identity.user_contact_method contact
     where (
       contact.contact_method_type = v_invite.contact_method_type
       and contact.normalized_contact_value = v_invite.normalized_contact_value
     ) or (
       contact.contact_method_type = 'email'
       and contact.normalized_contact_value = p_normalized_provider_email
     )
     order by contact.user_contact_method_id
       for share;

    if v_challenge.user_contact_method_id is not null then
      select contact.*
        into v_contact
        from identity.user_contact_method contact
       where contact.user_contact_method_id = v_challenge.user_contact_method_id;
      if not found then
        raise exception 'solmind_invitation_prepare_ineligible';
      end if;
    end if;

    perform provider_identity.auth_provider_identity_id
      from identity.auth_provider_identity provider_identity
     where provider_identity.provider_name = 'supabase'
       and (
         provider_identity.user_account_id = v_challenge.user_account_id
         or provider_identity.provider_email = p_normalized_provider_email
       )
     order by provider_identity.auth_provider_identity_id
       for share;

    if v_invite.invite_status not in ('created', 'sent')
       or v_invite.expires_at <= v_now
       or v_invite.accepted_by_user_account_id is not null
       or v_invite.accepted_at is not null
       or v_invite.revoked_at is not null then
      raise exception 'solmind_invitation_prepare_ineligible';
    end if;

    if v_challenge.used_at is null
       or v_challenge.invalidated_at is not null
       or v_challenge.purpose not in ('contact_verify', 'login')
       or v_challenge.contact_method_type <> v_invite.contact_method_type
       or v_challenge.normalized_contact_value <> v_invite.normalized_contact_value
       or (
         v_challenge.user_account_id is null
         and v_challenge.user_contact_method_id is not null
       )
       or (
         v_challenge.user_account_id is not null
         and v_challenge.user_contact_method_id is null
       )
       or (
         v_challenge.purpose = 'login'
         and v_challenge.user_account_id is null
       ) then
      raise exception 'solmind_invitation_prepare_ineligible';
    end if;

    perform 1
      from identity.invitation_acceptance_freshness_policy policy
     where policy.policy_name = 'invitation_acceptance_evidence_freshness'
       for share;

    select pg_catalog.count(*)::integer,
           pg_catalog.min(policy.minimum_seconds),
           pg_catalog.min(policy.active_seconds),
           pg_catalog.min(policy.maximum_seconds)
      into v_policy_count, v_minimum_seconds, v_active_seconds, v_maximum_seconds
      from identity.invitation_acceptance_freshness_policy policy
     where policy.policy_name = 'invitation_acceptance_evidence_freshness';

    if v_policy_count <> 1
       or v_minimum_seconds is null
       or v_active_seconds is null
       or v_maximum_seconds is null
       or v_minimum_seconds <= 0
       or v_minimum_seconds > v_active_seconds
       or v_active_seconds > v_maximum_seconds then
      raise exception 'solmind_invitation_prepare_policy_unavailable';
    end if;

    if v_challenge.used_at > v_now
       or v_challenge.used_at < v_now - pg_catalog.make_interval(secs => v_active_seconds) then
      raise exception 'solmind_invitation_prepare_stale_evidence';
    end if;

    if v_challenge.user_account_id is null then
      if v_invite.contact_method_type <> 'email'
         or p_normalized_provider_email <> v_invite.normalized_contact_value then
        raise exception 'solmind_invitation_prepare_ineligible';
      end if;

      select pg_catalog.count(*)::integer
        into v_matching_contact_count
        from identity.user_contact_method contact
       where contact.contact_method_type = v_invite.contact_method_type
         and contact.normalized_contact_value = v_invite.normalized_contact_value
         and contact.status = 'active'
         and contact.is_verified
         and contact.login_enabled;

      select pg_catalog.count(*)::integer
        into v_conflicting_provider_count
        from identity.auth_provider_identity provider_identity
       where provider_identity.provider_name = 'supabase'
         and provider_identity.provider_email = p_normalized_provider_email;

      if v_matching_contact_count <> 0 or v_conflicting_provider_count <> 0 then
        raise exception 'solmind_invitation_prepare_conflict';
      end if;
    else
      if v_account.account_status <> 'active'
         or v_contact.user_account_id <> v_challenge.user_account_id
         or v_contact.contact_method_type <> v_invite.contact_method_type
         or v_contact.normalized_contact_value <> v_invite.normalized_contact_value
         or v_contact.status <> 'active'
         or not v_contact.is_verified
         or not v_contact.login_enabled then
        raise exception 'solmind_invitation_prepare_ineligible';
      end if;

      select pg_catalog.count(*)::integer,
             pg_catalog.count(*) filter (where provider_identity.status = 'active')::integer,
             pg_catalog.min(provider_identity.provider_email)
               filter (where provider_identity.status = 'active')
        into v_target_provider_count,
             v_target_active_provider_count,
             v_target_provider_email
        from identity.auth_provider_identity provider_identity
       where provider_identity.user_account_id = v_challenge.user_account_id
         and provider_identity.provider_name = 'supabase';

      select pg_catalog.count(*)::integer
        into v_conflicting_provider_count
        from identity.auth_provider_identity provider_identity
       where provider_identity.provider_name = 'supabase'
         and provider_identity.provider_email = p_normalized_provider_email
         and provider_identity.user_account_id <> v_challenge.user_account_id;

      if v_target_provider_count <> v_target_active_provider_count
         or v_target_active_provider_count <> 1
         or v_conflicting_provider_count <> 0
         or v_target_provider_email is distinct from p_normalized_provider_email then
        raise exception 'solmind_invitation_prepare_conflict';
      end if;

      if v_invite.contact_method_type = 'email' then
        if p_normalized_provider_email <> v_invite.normalized_contact_value then
          raise exception 'solmind_invitation_prepare_ineligible';
        end if;
      else
        select pg_catalog.count(*)::integer
          into v_matching_contact_count
          from identity.user_contact_method contact
         where contact.user_account_id = v_challenge.user_account_id
           and contact.contact_method_type = 'email'
           and contact.normalized_contact_value = p_normalized_provider_email
           and contact.status = 'active'
           and contact.is_verified
           and contact.login_enabled;

        if v_matching_contact_count <> 1
           or v_target_active_provider_count <> 1 then
          raise exception 'solmind_invitation_prepare_ineligible';
        end if;
      end if;
    end if;

    if v_existing_reservation then
      if v_reservation.provider_name <> 'supabase'
         or v_reservation.guide_invite_id <> p_guide_invite_id
         or v_reservation.explorer_invite_id is not null
         or v_reservation.created_at is null
         or v_reservation.expires_at <> v_reservation.created_at + interval '24 hours'
         or v_reservation.retention_class <> 'security_log' then
        raise exception 'solmind_invitation_prepare_integrity_failure';
      end if;

      return query
        select 'existing'::text, v_reservation.provisioning_reservation_id;
      return;
    end if;

    v_new_reservation_id := pg_catalog.gen_random_uuid();

    insert into identity.auth_provider_provisioning_reservation (
      provisioning_reservation_id,
      guide_invite_id,
      provider_name,
      created_at,
      expires_at,
      retention_class
    ) values (
      v_new_reservation_id,
      p_guide_invite_id,
      'supabase',
      v_now,
      v_now + interval '24 hours',
      'security_log'
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
      'auth_provider_provisioning_reserved',
      null,
      'system',
      'auth_provider_provisioning_reservation',
      v_new_reservation_id,
      'reserve',
      'invitation_acceptance_preflight',
      'Auth provider provisioning reserved for invitation acceptance.',
      pg_catalog.jsonb_build_object(
        'provider_name', 'supabase',
        'role_code', 'guide'
      )
    );
  exception
    when lock_not_available or query_canceled or deadlock_detected or serialization_failure then
      raise exception 'solmind_invitation_prepare_lock_unavailable';
    when unique_violation or foreign_key_violation or check_violation or not_null_violation then
      raise exception 'solmind_invitation_prepare_integrity_failure';
    when others then
      if sqlerrm = any (
        array[
          'solmind_invitation_prepare_invalid_request',
          'solmind_invitation_prepare_ineligible',
          'solmind_invitation_prepare_evidence_consumed',
          'solmind_invitation_prepare_stale_evidence',
          'solmind_invitation_prepare_policy_unavailable',
          'solmind_invitation_prepare_conflict',
          'solmind_invitation_prepare_integrity_failure',
          'solmind_invitation_prepare_lock_unavailable'
        ]::text[]
      ) then
        raise;
      end if;
      raise exception 'solmind_invitation_prepare_integrity_failure';
  end;

  return query select 'created'::text, v_new_reservation_id;
end;
$$;

alter function public.solmind_prepare_guide_invitation_acceptance(uuid, uuid, text)
  owner to postgres;

revoke all on function public.solmind_prepare_guide_invitation_acceptance(uuid, uuid, text)
  from public;
revoke execute on function public.solmind_prepare_guide_invitation_acceptance(uuid, uuid, text)
  from anon, authenticated;
grant execute on function public.solmind_prepare_guide_invitation_acceptance(uuid, uuid, text)
  to service_role;

comment on function public.solmind_prepare_guide_invitation_acceptance(uuid, uuid, text) is
  'Dormant P27-B Guide invitation preparation. It proves a fresh unconsumed matching challenge and eligible invitation under evidence-first sorted-domain locking, then creates or exactly recovers one immutable Supabase provider-provisioning reservation. First creation embeds one exact Family B audit row. It performs no provider IO, evidence consumption, invitation mutation, provisioning, session creation, route, caller, cloud action, or real-user activation.';

create function public.solmind_prepare_explorer_invitation_acceptance(
  p_explorer_invite_id uuid,
  p_verification_challenge_id uuid,
  p_normalized_provider_email text
)
returns table (outcome text, provisioning_reservation_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '2000ms'
as $$
declare
  v_candidate_invite core.explorer_invite%rowtype;
  v_candidate_challenge identity.verification_challenge%rowtype;
  v_invite core.explorer_invite%rowtype;
  v_challenge identity.verification_challenge%rowtype;
  v_reservation identity.auth_provider_provisioning_reservation%rowtype;
  v_account identity.user_account%rowtype;
  v_contact identity.user_contact_method%rowtype;
  v_evidence_lock_key bigint;
  v_domain_lock_keys bigint[];
  v_domain_lock_key bigint;
  v_now timestamptz;
  v_policy_count integer;
  v_minimum_seconds integer;
  v_active_seconds integer;
  v_maximum_seconds integer;
  v_matching_contact_count integer;
  v_target_provider_count integer;
  v_target_active_provider_count integer;
  v_conflicting_provider_count integer;
  v_target_provider_email text;
  v_existing_reservation boolean := false;
  v_new_reservation_id uuid;
  v_dummy integer;
begin
  begin
    if p_explorer_invite_id is null
     or p_verification_challenge_id is null
     or p_normalized_provider_email is null
     or pg_catalog.octet_length(p_normalized_provider_email) < 3
     or pg_catalog.octet_length(p_normalized_provider_email) > 320
     or p_normalized_provider_email <> pg_catalog.btrim(p_normalized_provider_email)
     or p_normalized_provider_email <> pg_catalog.lower(p_normalized_provider_email) then
    raise exception 'solmind_invitation_prepare_invalid_request';
  end if;

  select invitation.*
    into v_candidate_invite
    from core.explorer_invite invitation
   where invitation.explorer_invite_id = p_explorer_invite_id;
  if not found then
    raise exception 'solmind_invitation_prepare_ineligible';
  end if;

  select challenge.*
    into v_candidate_challenge
    from identity.verification_challenge challenge
   where challenge.verification_challenge_id = p_verification_challenge_id;
  if not found then
    raise exception 'solmind_invitation_prepare_ineligible';
  end if;

  v_evidence_lock_key := pg_catalog.hashtextextended(
    'solmind:authorizing-evidence:v1|' || p_verification_challenge_id::text,
    0
  );

  select pg_catalog.array_agg(keys.lock_key order by keys.lock_key)
    into v_domain_lock_keys
    from (
      select distinct pg_catalog.hashtextextended(material.lock_material, 0) as lock_key
        from (
          values
            (
              'solmind:authorizing-domain:invitation:v1|'
              || 'role=8:explorer|invite=36:' || p_explorer_invite_id::text
            ),
            (
              'solmind:authorizing-domain:contact:v1|'
              || 'type=' || pg_catalog.octet_length(v_candidate_invite.contact_method_type)::text
              || ':' || v_candidate_invite.contact_method_type
              || '|value=' || pg_catalog.octet_length(v_candidate_invite.normalized_contact_value)::text
              || ':' || v_candidate_invite.normalized_contact_value
            ),
            (
              'solmind:authorizing-domain:invitation-sibling:v1|'
              || 'role=8:explorer'
              || '|guide=36:' || v_candidate_invite.guide_profile_id::text
              || '|practice=36:' || v_candidate_invite.practice_id::text
              || '|type=' || pg_catalog.octet_length(v_candidate_invite.contact_method_type)::text
              || ':' || v_candidate_invite.contact_method_type
              || '|value=' || pg_catalog.octet_length(v_candidate_invite.normalized_contact_value)::text
              || ':' || v_candidate_invite.normalized_contact_value
            ),
            (
              'solmind:authorizing-domain:provider-email:v1|'
              || 'provider=8:supabase'
              || '|email=' || pg_catalog.octet_length(p_normalized_provider_email)::text
              || ':' || p_normalized_provider_email
            ),
            (
              case
                when v_candidate_challenge.user_account_id is null then null
                else 'solmind:authorizing-domain:account:v1|'
                     || v_candidate_challenge.user_account_id::text
              end
            )
        ) material(lock_material)
       where material.lock_material is not null
    ) keys;

    perform pg_catalog.pg_advisory_xact_lock(v_evidence_lock_key);

    select challenge.*
      into v_challenge
      from identity.verification_challenge challenge
     where challenge.verification_challenge_id = p_verification_challenge_id
       for update;
    if not found then
      raise exception 'solmind_invitation_prepare_ineligible';
    end if;

    if v_challenge.user_account_id is distinct from v_candidate_challenge.user_account_id
       or v_challenge.user_contact_method_id is distinct from v_candidate_challenge.user_contact_method_id
       or v_challenge.normalized_contact_value <> v_candidate_challenge.normalized_contact_value
       or v_challenge.contact_method_type <> v_candidate_challenge.contact_method_type
       or v_challenge.purpose <> v_candidate_challenge.purpose then
      raise exception 'solmind_invitation_prepare_conflict';
    end if;

    perform 1
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id = p_verification_challenge_id
       for update;
    if found then
      raise exception 'solmind_invitation_prepare_evidence_consumed';
    end if;

    foreach v_domain_lock_key in array v_domain_lock_keys loop
      perform pg_catalog.pg_advisory_xact_lock(v_domain_lock_key);
    end loop;

    v_now := pg_catalog.clock_timestamp();

    select reservation.*
      into v_reservation
      from identity.auth_provider_provisioning_reservation reservation
     where reservation.explorer_invite_id = p_explorer_invite_id
       for update;
    v_existing_reservation := found;

    perform invitation.explorer_invite_id
      from core.explorer_invite invitation
     where invitation.guide_profile_id = v_candidate_invite.guide_profile_id
       and invitation.practice_id = v_candidate_invite.practice_id
       and invitation.contact_method_type = v_candidate_invite.contact_method_type
       and invitation.normalized_contact_value = v_candidate_invite.normalized_contact_value
     order by invitation.explorer_invite_id
       for update;

    select invitation.*
      into v_invite
      from core.explorer_invite invitation
     where invitation.explorer_invite_id = p_explorer_invite_id;
    if not found
       or v_invite.guide_profile_id <> v_candidate_invite.guide_profile_id
       or v_invite.practice_id <> v_candidate_invite.practice_id
       or v_invite.contact_method_type <> v_candidate_invite.contact_method_type
       or v_invite.normalized_contact_value <> v_candidate_invite.normalized_contact_value then
      raise exception 'solmind_invitation_prepare_conflict';
    end if;

    if v_challenge.user_account_id is not null then
      select account.*
        into v_account
        from identity.user_account account
       where account.user_account_id = v_challenge.user_account_id
         for share;
      if not found then
        raise exception 'solmind_invitation_prepare_ineligible';
      end if;
    end if;

    perform contact.user_contact_method_id
      from identity.user_contact_method contact
     where (
       contact.contact_method_type = v_invite.contact_method_type
       and contact.normalized_contact_value = v_invite.normalized_contact_value
     ) or (
       contact.contact_method_type = 'email'
       and contact.normalized_contact_value = p_normalized_provider_email
     )
     order by contact.user_contact_method_id
       for share;

    if v_challenge.user_contact_method_id is not null then
      select contact.*
        into v_contact
        from identity.user_contact_method contact
       where contact.user_contact_method_id = v_challenge.user_contact_method_id;
      if not found then
        raise exception 'solmind_invitation_prepare_ineligible';
      end if;
    end if;

    perform provider_identity.auth_provider_identity_id
      from identity.auth_provider_identity provider_identity
     where provider_identity.provider_name = 'supabase'
       and (
         provider_identity.user_account_id = v_challenge.user_account_id
         or provider_identity.provider_email = p_normalized_provider_email
       )
     order by provider_identity.auth_provider_identity_id
       for share;

    select 1
      into v_dummy
      from core.guide_profile guide_profile
     where guide_profile.guide_profile_id = v_invite.guide_profile_id
       and guide_profile.status = 'active'
       and guide_profile.setup_status = 'approved'
       for share;
    if not found then
      raise exception 'solmind_invitation_prepare_ineligible';
    end if;

    select 1
      into v_dummy
      from core.practice practice
     where practice.practice_id = v_invite.practice_id
       and practice.status = 'active'
       and practice.approval_status = 'approved'
       for share;
    if not found then
      raise exception 'solmind_invitation_prepare_ineligible';
    end if;

    select 1
      into v_dummy
      from core.practice_guide practice_guide
     where practice_guide.practice_id = v_invite.practice_id
       and practice_guide.guide_profile_id = v_invite.guide_profile_id
       and practice_guide.relationship_status = 'active'
       for share;
    if not found then
      raise exception 'solmind_invitation_prepare_ineligible';
    end if;

    if v_invite.invite_status not in ('created', 'sent')
       or v_invite.expires_at <= v_now
       or v_invite.accepted_by_user_account_id is not null
       or v_invite.accepted_at is not null
       or v_invite.revoked_at is not null then
      raise exception 'solmind_invitation_prepare_ineligible';
    end if;

    if v_challenge.used_at is null
       or v_challenge.invalidated_at is not null
       or v_challenge.purpose not in ('contact_verify', 'login')
       or v_challenge.contact_method_type <> v_invite.contact_method_type
       or v_challenge.normalized_contact_value <> v_invite.normalized_contact_value
       or (
         v_challenge.user_account_id is null
         and v_challenge.user_contact_method_id is not null
       )
       or (
         v_challenge.user_account_id is not null
         and v_challenge.user_contact_method_id is null
       )
       or (
         v_challenge.purpose = 'login'
         and v_challenge.user_account_id is null
       ) then
      raise exception 'solmind_invitation_prepare_ineligible';
    end if;

    perform 1
      from identity.invitation_acceptance_freshness_policy policy
     where policy.policy_name = 'invitation_acceptance_evidence_freshness'
       for share;

    select pg_catalog.count(*)::integer,
           pg_catalog.min(policy.minimum_seconds),
           pg_catalog.min(policy.active_seconds),
           pg_catalog.min(policy.maximum_seconds)
      into v_policy_count, v_minimum_seconds, v_active_seconds, v_maximum_seconds
      from identity.invitation_acceptance_freshness_policy policy
     where policy.policy_name = 'invitation_acceptance_evidence_freshness';

    if v_policy_count <> 1
       or v_minimum_seconds is null
       or v_active_seconds is null
       or v_maximum_seconds is null
       or v_minimum_seconds <= 0
       or v_minimum_seconds > v_active_seconds
       or v_active_seconds > v_maximum_seconds then
      raise exception 'solmind_invitation_prepare_policy_unavailable';
    end if;

    if v_challenge.used_at > v_now
       or v_challenge.used_at < v_now - pg_catalog.make_interval(secs => v_active_seconds) then
      raise exception 'solmind_invitation_prepare_stale_evidence';
    end if;

    if v_challenge.user_account_id is null then
      if v_invite.contact_method_type <> 'email'
         or p_normalized_provider_email <> v_invite.normalized_contact_value then
        raise exception 'solmind_invitation_prepare_ineligible';
      end if;

      select pg_catalog.count(*)::integer
        into v_matching_contact_count
        from identity.user_contact_method contact
       where contact.contact_method_type = v_invite.contact_method_type
         and contact.normalized_contact_value = v_invite.normalized_contact_value
         and contact.status = 'active'
         and contact.is_verified
         and contact.login_enabled;

      select pg_catalog.count(*)::integer
        into v_conflicting_provider_count
        from identity.auth_provider_identity provider_identity
       where provider_identity.provider_name = 'supabase'
         and provider_identity.provider_email = p_normalized_provider_email;

      if v_matching_contact_count <> 0 or v_conflicting_provider_count <> 0 then
        raise exception 'solmind_invitation_prepare_conflict';
      end if;
    else
      if v_account.account_status <> 'active'
         or v_contact.user_account_id <> v_challenge.user_account_id
         or v_contact.contact_method_type <> v_invite.contact_method_type
         or v_contact.normalized_contact_value <> v_invite.normalized_contact_value
         or v_contact.status <> 'active'
         or not v_contact.is_verified
         or not v_contact.login_enabled then
        raise exception 'solmind_invitation_prepare_ineligible';
      end if;

      select pg_catalog.count(*)::integer,
             pg_catalog.count(*) filter (where provider_identity.status = 'active')::integer,
             pg_catalog.min(provider_identity.provider_email)
               filter (where provider_identity.status = 'active')
        into v_target_provider_count,
             v_target_active_provider_count,
             v_target_provider_email
        from identity.auth_provider_identity provider_identity
       where provider_identity.user_account_id = v_challenge.user_account_id
         and provider_identity.provider_name = 'supabase';

      select pg_catalog.count(*)::integer
        into v_conflicting_provider_count
        from identity.auth_provider_identity provider_identity
       where provider_identity.provider_name = 'supabase'
         and provider_identity.provider_email = p_normalized_provider_email
         and provider_identity.user_account_id <> v_challenge.user_account_id;

      if v_target_provider_count <> v_target_active_provider_count
         or v_target_active_provider_count <> 1
         or v_conflicting_provider_count <> 0
         or v_target_provider_email is distinct from p_normalized_provider_email then
        raise exception 'solmind_invitation_prepare_conflict';
      end if;

      if v_invite.contact_method_type = 'email' then
        if p_normalized_provider_email <> v_invite.normalized_contact_value then
          raise exception 'solmind_invitation_prepare_ineligible';
        end if;
      else
        select pg_catalog.count(*)::integer
          into v_matching_contact_count
          from identity.user_contact_method contact
         where contact.user_account_id = v_challenge.user_account_id
           and contact.contact_method_type = 'email'
           and contact.normalized_contact_value = p_normalized_provider_email
           and contact.status = 'active'
           and contact.is_verified
           and contact.login_enabled;

        if v_matching_contact_count <> 1
           or v_target_active_provider_count <> 1 then
          raise exception 'solmind_invitation_prepare_ineligible';
        end if;
      end if;
    end if;

    if v_existing_reservation then
      if v_reservation.provider_name <> 'supabase'
         or v_reservation.explorer_invite_id <> p_explorer_invite_id
         or v_reservation.guide_invite_id is not null
         or v_reservation.created_at is null
         or v_reservation.expires_at <> v_reservation.created_at + interval '24 hours'
         or v_reservation.retention_class <> 'security_log' then
        raise exception 'solmind_invitation_prepare_integrity_failure';
      end if;

      return query
        select 'existing'::text, v_reservation.provisioning_reservation_id;
      return;
    end if;

    v_new_reservation_id := pg_catalog.gen_random_uuid();

    insert into identity.auth_provider_provisioning_reservation (
      provisioning_reservation_id,
      explorer_invite_id,
      provider_name,
      created_at,
      expires_at,
      retention_class
    ) values (
      v_new_reservation_id,
      p_explorer_invite_id,
      'supabase',
      v_now,
      v_now + interval '24 hours',
      'security_log'
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
      'auth_provider_provisioning_reserved',
      null,
      'system',
      'auth_provider_provisioning_reservation',
      v_new_reservation_id,
      'reserve',
      'invitation_acceptance_preflight',
      'Auth provider provisioning reserved for invitation acceptance.',
      pg_catalog.jsonb_build_object(
        'provider_name', 'supabase',
        'role_code', 'explorer'
      )
    );
  exception
    when lock_not_available or query_canceled or deadlock_detected or serialization_failure then
      raise exception 'solmind_invitation_prepare_lock_unavailable';
    when unique_violation or foreign_key_violation or check_violation or not_null_violation then
      raise exception 'solmind_invitation_prepare_integrity_failure';
    when others then
      if sqlerrm = any (
        array[
          'solmind_invitation_prepare_invalid_request',
          'solmind_invitation_prepare_ineligible',
          'solmind_invitation_prepare_evidence_consumed',
          'solmind_invitation_prepare_stale_evidence',
          'solmind_invitation_prepare_policy_unavailable',
          'solmind_invitation_prepare_conflict',
          'solmind_invitation_prepare_integrity_failure',
          'solmind_invitation_prepare_lock_unavailable'
        ]::text[]
      ) then
        raise;
      end if;
      raise exception 'solmind_invitation_prepare_integrity_failure';
  end;

  return query select 'created'::text, v_new_reservation_id;
end;
$$;

alter function public.solmind_prepare_explorer_invitation_acceptance(uuid, uuid, text)
  owner to postgres;

revoke all on function public.solmind_prepare_explorer_invitation_acceptance(uuid, uuid, text)
  from public;
revoke execute on function public.solmind_prepare_explorer_invitation_acceptance(uuid, uuid, text)
  from anon, authenticated;
grant execute on function public.solmind_prepare_explorer_invitation_acceptance(uuid, uuid, text)
  to service_role;

comment on function public.solmind_prepare_explorer_invitation_acceptance(uuid, uuid, text) is
  'Dormant P27-B Explorer invitation preparation. It proves a fresh unconsumed matching challenge, eligible approved Guide/practice scope, and eligible invitation under evidence-first sorted-domain locking, then creates or exactly recovers one immutable Supabase provider-provisioning reservation. First creation embeds one exact Family B audit row. It performs no provider IO, evidence consumption, invitation mutation, provisioning, relationship creation, session creation, route, caller, cloud action, or real-user activation.';

commit;
