-- SolMind MVP0 PRJ01_F-WS06-WI008-S02E:
-- dormant Explorer invitation acceptance.
--
-- This migration:
--   - replaces only the banked Explorer preparation function to add the
--     approved writeless, non-authoritative current-relationship capacity
--     pre-check; and
--   - adds one dormant service-role-only Explorer acceptance function.
--
-- It adds no caller, route, provider IO, delivery, cookie, session, consent,
-- capacity-policy writer, RLS policy, cloud action, deployment, production
-- action, or real-user activation.

begin;

create or replace function public.solmind_prepare_explorer_invitation_acceptance(
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
  v_capacity_policy_count integer;
  v_capacity_minimum integer;
  v_capacity_active integer;
  v_capacity_maximum integer;
  v_current_relationship_count integer;
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

    perform policy.capacity_policy_name
      from core.explorer_engagement_capacity_policy policy
     where policy.capacity_policy_name = 'current_guide_relationship_maximum'
       for share;

    select pg_catalog.count(*)::integer,
           pg_catalog.min(policy.minimum_value),
           pg_catalog.min(policy.active_value),
           pg_catalog.min(policy.maximum_value)
      into
        v_capacity_policy_count,
        v_capacity_minimum,
        v_capacity_active,
        v_capacity_maximum
      from core.explorer_engagement_capacity_policy policy
     where policy.capacity_policy_name = 'current_guide_relationship_maximum';

    if v_capacity_policy_count <> 1
       or v_capacity_minimum <> 1
       or v_capacity_maximum <> 10
       or v_capacity_active < v_capacity_minimum
       or v_capacity_active > v_capacity_maximum then
      raise exception 'solmind_invitation_prepare_policy_unavailable';
    end if;

    if v_challenge.user_account_id is not null then
      perform profile.explorer_profile_id
        from core.explorer_profile profile
       where profile.user_account_id = v_challenge.user_account_id
         and profile.status <> 'deleted'
       order by profile.explorer_profile_id
         for share;

      perform relationship.guide_explorer_relationship_id
        from core.guide_explorer_relationship relationship
        join core.explorer_profile profile
          on profile.explorer_profile_id = relationship.explorer_profile_id
       where profile.user_account_id = v_challenge.user_account_id
         and profile.status <> 'deleted'
       order by relationship.guide_explorer_relationship_id
         for share;

      select pg_catalog.count(*)::integer
        into v_current_relationship_count
        from core.guide_explorer_relationship relationship
        join core.explorer_profile profile
          on profile.explorer_profile_id = relationship.explorer_profile_id
       where profile.user_account_id = v_challenge.user_account_id
         and profile.status <> 'deleted'
         and relationship.relationship_status in (
           'invited', 'intake_pending', 'active', 'paused'
         );

      if v_current_relationship_count >= v_capacity_active then
        raise exception 'solmind_invitation_prepare_ineligible';
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
  'Dormant P27-B Explorer invitation preparation. It proves a fresh unconsumed matching challenge, eligible approved Guide/practice scope, eligible invitation, eligible provider identity state, and a non-authoritative current-relationship capacity pre-check under evidence-first sorted-domain locking, then creates or exactly recovers one immutable Supabase provider-provisioning reservation. Capacity denial is writeless and generic; capacity-policy failure is fail-closed. First reservation creation embeds one exact Family B audit row. It performs no provider IO, evidence consumption, invitation mutation, provisioning, relationship creation, session creation, route, caller, cloud action, or real-user activation.';

create function public.solmind_accept_explorer_invitation(
  p_explorer_invite_id uuid,
  p_verification_challenge_id uuid,
  p_provisioning_reservation_id uuid,
  p_provider_user_id text,
  p_normalized_provider_email text
)
returns table (
  outcome text,
  user_account_id uuid,
  explorer_profile_id uuid,
  guide_explorer_relationship_id uuid
)
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
  v_consumption identity.authorizing_evidence_consumption%rowtype;
  v_identity private.solmind_invited_identity_result;
  v_recovery_account identity.user_account%rowtype;
  v_recovery_provider identity.auth_provider_identity%rowtype;
  v_recovery_contact identity.user_contact_method%rowtype;
  v_recovery_role identity.user_role_assignment%rowtype;
  v_recovery_profile core.explorer_profile%rowtype;
  v_recovery_relationship core.guide_explorer_relationship%rowtype;
  v_evidence_lock_key bigint;
  v_domain_lock_keys bigint[];
  v_domain_lock_key bigint;
  v_now timestamptz;
  v_display_name text;
  v_policy_count integer;
  v_minimum_seconds integer;
  v_active_seconds integer;
  v_maximum_seconds integer;
  v_capacity_policy_count integer;
  v_capacity_minimum integer;
  v_capacity_active integer;
  v_capacity_maximum integer;
  v_recovery_count integer;
  v_matching_contact_count integer;
  v_current_relationship_count integer;
  v_candidate_user_account_ids uuid[];
  v_locked_user_account_ids uuid[];
  v_candidate_explorer_profile_ids uuid[];
  v_relationship_id uuid;
  v_revoked_invite_id uuid;
  v_consumption_found boolean := false;
begin
  begin
    if p_explorer_invite_id is null
       or p_verification_challenge_id is null
       or p_provisioning_reservation_id is null
       or p_provider_user_id is null
       or pg_catalog.octet_length(p_provider_user_id) < 1
       or pg_catalog.octet_length(p_provider_user_id) > 256
       or p_provider_user_id <> pg_catalog.btrim(p_provider_user_id)
       or p_normalized_provider_email is null
       or pg_catalog.octet_length(p_normalized_provider_email) < 3
       or pg_catalog.octet_length(p_normalized_provider_email) > 320
       or p_normalized_provider_email <> pg_catalog.btrim(p_normalized_provider_email)
       or p_normalized_provider_email <> pg_catalog.lower(p_normalized_provider_email) then
      raise exception 'solmind_explorer_accept_invalid_request';
    end if;

    select invitation.*
      into v_candidate_invite
      from core.explorer_invite invitation
     where invitation.explorer_invite_id = p_explorer_invite_id;
    if not found then
      raise exception 'solmind_explorer_accept_ineligible';
    end if;

    select challenge.*
      into v_candidate_challenge
      from identity.verification_challenge challenge
     where challenge.verification_challenge_id = p_verification_challenge_id;
    if not found then
      raise exception 'solmind_explorer_accept_ineligible';
    end if;

    v_evidence_lock_key := pg_catalog.hashtextextended(
      'solmind:authorizing-evidence:v1|' || p_verification_challenge_id::text,
      0
    );

    select pg_catalog.array_agg(keys.lock_key order by keys.lock_key)
      into v_domain_lock_keys
      from (
        select distinct lock_sources.lock_key
          from (
            select pg_catalog.unnest(
              private.solmind_explorer_invitation_domain_lock_keys(
                p_explorer_invite_id,
                v_candidate_invite.guide_profile_id,
                v_candidate_invite.practice_id,
                v_candidate_invite.contact_method_type,
                v_candidate_invite.normalized_contact_value
              )
            ) as lock_key
            union all
            select pg_catalog.hashtextextended(material.lock_material, 0)
              from (
                values
                  (
                    'solmind:authorizing-domain:provider-email:v1|'
                    || 'provider=8:supabase'
                    || '|email=' || pg_catalog.octet_length(p_normalized_provider_email)::text
                    || ':' || p_normalized_provider_email
                  ),
                  (
                    'solmind:authorizing-domain:provider-user:v1|'
                    || 'provider=8:supabase'
                    || '|user=' || pg_catalog.octet_length(p_provider_user_id)::text
                    || ':' || p_provider_user_id
                  ),
                  (
                    'solmind:authorizing-domain:provider-reservation:v1|'
                    || p_provisioning_reservation_id::text
                  ),
                  (
                    case
                      when coalesce(
                        v_candidate_challenge.user_account_id,
                        v_candidate_invite.accepted_by_user_account_id
                      ) is null then null
                      else 'solmind:authorizing-domain:account:v1|'
                           || coalesce(
                                v_candidate_challenge.user_account_id,
                                v_candidate_invite.accepted_by_user_account_id
                              )::text
                    end
                  )
              ) material(lock_material)
             where material.lock_material is not null
          ) lock_sources
      ) keys;

    perform pg_catalog.pg_advisory_xact_lock(v_evidence_lock_key);

    select challenge.*
      into v_challenge
      from identity.verification_challenge challenge
     where challenge.verification_challenge_id = p_verification_challenge_id
       for update;
    if not found
       or v_challenge.user_account_id is distinct from v_candidate_challenge.user_account_id
       or v_challenge.user_contact_method_id is distinct from v_candidate_challenge.user_contact_method_id
       or v_challenge.contact_method_type <> v_candidate_challenge.contact_method_type
       or v_challenge.normalized_contact_value <> v_candidate_challenge.normalized_contact_value
       or v_challenge.purpose <> v_candidate_challenge.purpose then
      raise exception 'solmind_explorer_accept_conflict';
    end if;

    select consumption.*
      into v_consumption
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id = p_verification_challenge_id
       for update;
    v_consumption_found := found;

    foreach v_domain_lock_key in array v_domain_lock_keys loop
      perform pg_catalog.pg_advisory_xact_lock(v_domain_lock_key);
    end loop;

    select reservation.*
      into v_reservation
      from identity.auth_provider_provisioning_reservation reservation
     where reservation.provisioning_reservation_id = p_provisioning_reservation_id
       for update;
    if not found
       or v_reservation.explorer_invite_id <> p_explorer_invite_id
       or v_reservation.guide_invite_id is not null
       or v_reservation.provider_name <> 'supabase'
       or v_reservation.created_at is null
       or v_reservation.expires_at <> v_reservation.created_at + interval '24 hours'
       or v_reservation.retention_class <> 'security_log' then
      raise exception 'solmind_explorer_accept_conflict';
    end if;

    perform invitation.explorer_invite_id
      from core.explorer_invite invitation
     where invitation.contact_method_type = v_candidate_invite.contact_method_type
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
      raise exception 'solmind_explorer_accept_conflict';
    end if;

    v_now := pg_catalog.clock_timestamp();

    -- Exact committed-response recovery is writeless and precedes freshness.
    if v_invite.invite_status = 'accepted' then
      if not v_consumption_found
         or v_consumption.consumer_type <> 'explorer_invitation_acceptance'
         or v_consumption.consumer_record_id <> p_explorer_invite_id
         or v_invite.accepted_by_user_account_id is null
         or v_invite.accepted_at is null
         or v_challenge.used_at is null
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
         )
         or (
           v_challenge.user_account_id is not null
           and v_challenge.user_account_id <> v_invite.accepted_by_user_account_id
         )
         or (
           v_invite.contact_method_type = 'email'
           and p_normalized_provider_email <>
               v_invite.normalized_contact_value
         ) then
        raise exception 'solmind_explorer_accept_ineligible';
      end if;

      select account.*
        into v_recovery_account
        from identity.user_account account
       where account.user_account_id = v_invite.accepted_by_user_account_id
         for share;
      if not found or v_recovery_account.account_status <> 'active' then
        raise exception 'solmind_explorer_accept_ineligible';
      end if;

      perform contact.user_contact_method_id
        from identity.user_contact_method contact
       where contact.user_account_id = v_invite.accepted_by_user_account_id
       order by contact.user_contact_method_id
         for share;

      select pg_catalog.count(*)::integer
        into v_recovery_count
        from identity.user_contact_method contact
       where contact.user_account_id = v_invite.accepted_by_user_account_id
         and contact.contact_method_type = v_invite.contact_method_type
         and contact.normalized_contact_value = v_invite.normalized_contact_value;
      if v_recovery_count <> 1 then
        raise exception 'solmind_explorer_accept_conflict';
      end if;

      select contact.*
        into v_recovery_contact
        from identity.user_contact_method contact
       where contact.user_account_id = v_invite.accepted_by_user_account_id
         and contact.contact_method_type = v_invite.contact_method_type
         and contact.normalized_contact_value = v_invite.normalized_contact_value
         and contact.status = 'active'
         and contact.is_verified
         and contact.login_enabled
         for share;
      if not found then
        raise exception 'solmind_explorer_accept_ineligible';
      end if;

      if v_invite.contact_method_type = 'phone' then
        select pg_catalog.count(*)::integer
          into v_recovery_count
          from identity.user_contact_method contact
         where contact.user_account_id = v_invite.accepted_by_user_account_id
           and contact.contact_method_type = 'email'
           and contact.normalized_contact_value = p_normalized_provider_email
           and contact.status = 'active'
           and contact.is_verified
           and contact.login_enabled;
        if v_recovery_count <> 1 then
          raise exception 'solmind_explorer_accept_ineligible';
        end if;
      end if;

      perform provider_identity.auth_provider_identity_id
        from identity.auth_provider_identity provider_identity
       where provider_identity.user_account_id = v_invite.accepted_by_user_account_id
         and provider_identity.provider_name = 'supabase'
       order by provider_identity.auth_provider_identity_id
         for share;

      select pg_catalog.count(*)::integer
        into v_recovery_count
        from identity.auth_provider_identity provider_identity
       where provider_identity.user_account_id = v_invite.accepted_by_user_account_id
         and provider_identity.provider_name = 'supabase';
      if v_recovery_count <> 1 then
        raise exception 'solmind_explorer_accept_conflict';
      end if;

      select provider_identity.*
        into v_recovery_provider
        from identity.auth_provider_identity provider_identity
       where provider_identity.user_account_id = v_invite.accepted_by_user_account_id
         and provider_identity.provider_name = 'supabase'
         and provider_identity.provider_user_id = p_provider_user_id
         and provider_identity.provider_email = p_normalized_provider_email
         and provider_identity.status = 'active'
         for share;
      if not found
         or (
           v_recovery_provider.provisioning_reservation_id is not null
           and v_recovery_provider.provisioning_reservation_id <>
             p_provisioning_reservation_id
         ) then
        raise exception 'solmind_explorer_accept_conflict';
      end if;

      perform assignment.user_role_assignment_id
        from identity.user_role_assignment assignment
       where assignment.user_account_id = v_invite.accepted_by_user_account_id
         and assignment.role_code = 'explorer'
       order by assignment.user_role_assignment_id
         for share;

      select pg_catalog.count(*)::integer
        into v_recovery_count
        from identity.user_role_assignment assignment
       where assignment.user_account_id = v_invite.accepted_by_user_account_id
         and assignment.role_code = 'explorer';
      if v_recovery_count <> 1 then
        raise exception 'solmind_explorer_accept_conflict';
      end if;

      select assignment.*
        into v_recovery_role
        from identity.user_role_assignment assignment
       where assignment.user_account_id = v_invite.accepted_by_user_account_id
         and assignment.role_code = 'explorer'
         and assignment.role_status = 'active'
         for share;
      if not found then
        raise exception 'solmind_explorer_accept_ineligible';
      end if;

      perform profile.explorer_profile_id
        from core.explorer_profile profile
       where profile.user_account_id = v_invite.accepted_by_user_account_id
         and profile.status <> 'deleted'
       order by profile.explorer_profile_id
         for share;

      select pg_catalog.count(*)::integer
        into v_recovery_count
        from core.explorer_profile profile
       where profile.user_account_id = v_invite.accepted_by_user_account_id
         and profile.status <> 'deleted';
      if v_recovery_count <> 1 then
        raise exception 'solmind_explorer_accept_conflict';
      end if;

      select profile.*
        into v_recovery_profile
        from core.explorer_profile profile
       where profile.user_account_id = v_invite.accepted_by_user_account_id
         and profile.status = 'active'
         and profile.onboarding_status in (
           'invited', 'contact_verified', 'consent_pending',
           'intake_pending', 'active'
         )
         for share;
      if not found then
        raise exception 'solmind_explorer_accept_ineligible';
      end if;

      perform relationship.guide_explorer_relationship_id
        from core.guide_explorer_relationship relationship
       where relationship.created_from_invite_id = p_explorer_invite_id
       order by relationship.guide_explorer_relationship_id
         for share;

      select pg_catalog.count(*)::integer
        into v_recovery_count
        from core.guide_explorer_relationship relationship
       where relationship.created_from_invite_id = p_explorer_invite_id;
      if v_recovery_count <> 1 then
        raise exception 'solmind_explorer_accept_conflict';
      end if;

      select relationship.*
        into v_recovery_relationship
        from core.guide_explorer_relationship relationship
       where relationship.created_from_invite_id = p_explorer_invite_id
         for share;
      if v_recovery_relationship.guide_profile_id <> v_invite.guide_profile_id
         or v_recovery_relationship.practice_id <> v_invite.practice_id
         or v_recovery_relationship.explorer_profile_id <>
           v_recovery_profile.explorer_profile_id
         or v_recovery_relationship.created_by_user_account_id <>
           v_invite.accepted_by_user_account_id
         or v_recovery_relationship.retention_class <> 'core_business'
         or v_recovery_relationship.relationship_status not in (
           'intake_pending', 'active', 'paused'
         ) then
        raise exception 'solmind_explorer_accept_ineligible';
      end if;

      return query
        select 'existing'::text,
               v_invite.accepted_by_user_account_id,
               v_recovery_profile.explorer_profile_id,
               v_recovery_relationship.guide_explorer_relationship_id;
      return;
    end if;

    if v_consumption_found then
      raise exception 'solmind_explorer_accept_evidence_consumed';
    end if;

    if v_invite.invite_status not in ('created', 'sent')
       or v_invite.expires_at <= v_now
       or v_invite.accepted_by_user_account_id is not null
       or v_invite.accepted_at is not null
       or v_invite.revoked_at is not null then
      raise exception 'solmind_explorer_accept_ineligible';
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
      raise exception 'solmind_explorer_accept_ineligible';
    end if;

    perform 1
      from core.guide_profile guide_profile
     where guide_profile.guide_profile_id = v_invite.guide_profile_id
       and guide_profile.status = 'active'
       and guide_profile.setup_status = 'approved'
       for share;
    if not found then
      raise exception 'solmind_explorer_accept_ineligible';
    end if;

    perform 1
      from core.practice practice
     where practice.practice_id = v_invite.practice_id
       and practice.status = 'active'
       and practice.approval_status = 'approved'
       for share;
    if not found then
      raise exception 'solmind_explorer_accept_ineligible';
    end if;

    perform 1
      from core.practice_guide practice_guide
     where practice_guide.practice_id = v_invite.practice_id
       and practice_guide.guide_profile_id = v_invite.guide_profile_id
       and practice_guide.relationship_status = 'active'
       for share;
    if not found then
      raise exception 'solmind_explorer_accept_ineligible';
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
      raise exception 'solmind_explorer_accept_policy_unavailable';
    end if;

    if v_challenge.used_at > v_now
       or v_challenge.used_at <
          v_now - pg_catalog.make_interval(secs => v_active_seconds) then
      raise exception 'solmind_explorer_accept_stale_evidence';
    end if;

    if v_invite.contact_method_type = 'email'
       and p_normalized_provider_email <> v_invite.normalized_contact_value then
      raise exception 'solmind_explorer_accept_ineligible';
    end if;

    perform policy.capacity_policy_name
      from core.explorer_engagement_capacity_policy policy
     where policy.capacity_policy_name = 'current_guide_relationship_maximum'
       for share;

    select pg_catalog.count(*)::integer,
           pg_catalog.min(policy.minimum_value),
           pg_catalog.min(policy.active_value),
           pg_catalog.min(policy.maximum_value)
      into
        v_capacity_policy_count,
        v_capacity_minimum,
        v_capacity_active,
        v_capacity_maximum
      from core.explorer_engagement_capacity_policy policy
     where policy.capacity_policy_name = 'current_guide_relationship_maximum';

    if v_capacity_policy_count <> 1
       or v_capacity_minimum <> 1
       or v_capacity_maximum <> 10
       or v_capacity_active < v_capacity_minimum
       or v_capacity_active > v_capacity_maximum then
      raise exception 'solmind_explorer_accept_policy_unavailable';
    end if;

    select pg_catalog.array_agg(
             distinct candidates.user_account_id
             order by candidates.user_account_id
           )
      into v_candidate_user_account_ids
      from (
        select contact.user_account_id
          from identity.user_contact_method contact
         where contact.contact_method_type = v_invite.contact_method_type
           and contact.normalized_contact_value =
               v_invite.normalized_contact_value
        union
        select v_challenge.user_account_id
         where v_challenge.user_account_id is not null
      ) candidates;

    perform account.user_account_id
      from identity.user_account account
     where account.user_account_id = any (v_candidate_user_account_ids)
     order by account.user_account_id
       for share;

    perform contact.user_contact_method_id
      from identity.user_contact_method contact
     where contact.contact_method_type = v_invite.contact_method_type
       and contact.normalized_contact_value = v_invite.normalized_contact_value
     order by contact.user_contact_method_id
       for share;

    select pg_catalog.count(*)::integer
      into v_matching_contact_count
      from identity.user_contact_method contact
     where contact.contact_method_type = v_invite.contact_method_type
       and contact.normalized_contact_value = v_invite.normalized_contact_value;

    select pg_catalog.array_agg(
             distinct candidates.user_account_id
             order by candidates.user_account_id
           )
      into v_locked_user_account_ids
      from (
        select contact.user_account_id
          from identity.user_contact_method contact
         where contact.contact_method_type = v_invite.contact_method_type
           and contact.normalized_contact_value =
               v_invite.normalized_contact_value
        union
        select v_challenge.user_account_id
         where v_challenge.user_account_id is not null
      ) candidates;

    if v_locked_user_account_ids is distinct from v_candidate_user_account_ids
       or v_matching_contact_count > 1 then
      raise exception 'solmind_explorer_accept_conflict';
    end if;

    perform profile.explorer_profile_id
      from core.explorer_profile profile
     where profile.user_account_id = any (v_locked_user_account_ids)
       and profile.status <> 'deleted'
     order by profile.explorer_profile_id
       for share;

    select pg_catalog.array_agg(
             profile.explorer_profile_id
             order by profile.explorer_profile_id
           )
      into v_candidate_explorer_profile_ids
      from core.explorer_profile profile
     where profile.user_account_id = any (v_locked_user_account_ids)
       and profile.status <> 'deleted';

    perform relationship.guide_explorer_relationship_id
      from core.guide_explorer_relationship relationship
     where relationship.explorer_profile_id =
           any (v_candidate_explorer_profile_ids)
     order by relationship.guide_explorer_relationship_id
       for share;

    if v_challenge.user_account_id is not null then
      if exists (
        select 1
          from core.guide_explorer_relationship relationship
          join core.explorer_profile profile
            on profile.explorer_profile_id = relationship.explorer_profile_id
         where profile.user_account_id = v_challenge.user_account_id
           and profile.status <> 'deleted'
           and relationship.guide_profile_id = v_invite.guide_profile_id
           and relationship.relationship_status in (
             'invited', 'intake_pending', 'active', 'paused'
           )
      ) then
        raise exception 'solmind_explorer_accept_conflict';
      end if;

      select pg_catalog.count(*)::integer
        into v_current_relationship_count
        from core.guide_explorer_relationship relationship
        join core.explorer_profile profile
          on profile.explorer_profile_id = relationship.explorer_profile_id
       where profile.user_account_id = v_challenge.user_account_id
         and profile.status <> 'deleted'
         and relationship.relationship_status in (
           'invited', 'intake_pending', 'active', 'paused'
         );

      if v_current_relationship_count >= v_capacity_active then
        raise exception 'solmind_explorer_accept_capacity_reached';
      end if;
    end if;

    v_display_name := private.solmind_sanitize_invited_display_name(
      v_invite.invited_name,
      'explorer'
    );

    begin
      v_identity := private.solmind_provision_invited_identity(
        v_challenge.user_account_id,
        v_challenge.user_contact_method_id,
        'explorer',
        v_invite.contact_method_type,
        v_invite.invited_contact_value,
        v_invite.normalized_contact_value,
        p_provider_user_id,
        p_normalized_provider_email,
        p_provisioning_reservation_id,
        v_display_name
      );
    exception
      when lock_not_available or query_canceled or deadlock_detected or serialization_failure then
        raise exception 'solmind_explorer_accept_lock_unavailable';
      when others then
        if sqlerrm = 'solmind_invited_identity_ineligible' then
          raise exception 'solmind_explorer_accept_ineligible';
        end if;
        if sqlerrm = 'solmind_invited_identity_conflict' then
          raise exception 'solmind_explorer_accept_conflict';
        end if;
        raise exception 'solmind_explorer_accept_integrity_failure';
    end;

    insert into identity.authorizing_evidence_consumption (
      verification_challenge_id,
      consumer_type,
      consumer_record_id,
      consumed_at,
      retention_class
    ) values (
      p_verification_challenge_id,
      'explorer_invitation_acceptance',
      p_explorer_invite_id,
      v_now,
      'security_log'
    );

    update core.explorer_invite invitation
       set invite_status = 'accepted',
           accepted_by_user_account_id = v_identity.user_account_id,
           accepted_at = v_now
     where invitation.explorer_invite_id = p_explorer_invite_id;

    v_relationship_id := pg_catalog.gen_random_uuid();

    insert into core.guide_explorer_relationship (
      guide_explorer_relationship_id,
      guide_profile_id,
      explorer_profile_id,
      practice_id,
      relationship_status,
      started_at,
      ended_at,
      created_from_invite_id,
      explorer_safe_guardrail,
      explorer_safe_guardrail_updated_at,
      explorer_safe_guardrail_updated_by_user_account_id,
      created_at,
      created_by_user_account_id,
      metadata,
      retention_class
    ) values (
      v_relationship_id,
      v_invite.guide_profile_id,
      v_identity.profile_id,
      v_invite.practice_id,
      'intake_pending',
      null,
      null,
      p_explorer_invite_id,
      null,
      null,
      null,
      v_now,
      v_identity.user_account_id,
      '{}'::jsonb,
      'core_business'
    );

    if v_identity.account_created then
      insert into audit.audit_event (
        event_type, actor_user_account_id, actor_role_context,
        target_entity_type, target_entity_id, action, reason_code,
        event_summary, metadata
      ) values (
        'account_provisioned', v_identity.user_account_id, 'explorer',
        'user_account', v_identity.user_account_id, 'create',
        'invitation_accepted', 'Account provisioned from invitation.',
        '{}'::jsonb
      );
    end if;

    if v_identity.contact_created then
      insert into audit.audit_event (
        event_type, actor_user_account_id, actor_role_context,
        target_entity_type, target_entity_id, action, reason_code,
        event_summary, metadata
      ) values (
        'contact_method_changed', v_identity.user_account_id, 'explorer',
        'user_contact_method', v_identity.user_contact_method_id, 'activate',
        'invitation_accepted', 'Contact method activated from invitation.',
        pg_catalog.jsonb_build_object(
          'contact_method_type', v_invite.contact_method_type
        )
      );
    end if;

    if v_identity.provider_identity_created then
      insert into audit.audit_event (
        event_type, actor_user_account_id, actor_role_context,
        target_entity_type, target_entity_id, action, reason_code,
        event_summary, metadata
      ) values (
        'auth_provider_identity_bound', v_identity.user_account_id, 'explorer',
        'auth_provider_identity', v_identity.auth_provider_identity_id, 'bind',
        'invitation_accepted', 'Provider identity bound from invitation.',
        pg_catalog.jsonb_build_object('provider_name', 'supabase')
      );
    end if;

    if v_identity.role_created then
      insert into audit.audit_event (
        event_type, actor_user_account_id, actor_role_context,
        target_entity_type, target_entity_id, action, reason_code,
        event_summary, metadata
      ) values (
        'role_assignment_changed', v_identity.user_account_id, 'explorer',
        'user_role_assignment', v_identity.user_role_assignment_id, 'grant',
        'invitation_accepted', 'Role assignment granted from invitation.',
        pg_catalog.jsonb_build_object('role_code', 'explorer')
      );
    end if;

    if v_identity.profile_created then
      insert into audit.audit_event (
        event_type, actor_user_account_id, actor_role_context,
        target_entity_type, target_entity_id, action, reason_code,
        event_summary, metadata
      ) values (
        'profile_created', v_identity.user_account_id, 'explorer',
        'explorer_profile', v_identity.profile_id, 'create',
        'invitation_accepted', 'Profile created from invitation.',
        pg_catalog.jsonb_build_object('profile_type', 'explorer')
      );
    end if;

    if v_identity.profile_onboarding_changed then
      insert into audit.audit_event (
        event_type, actor_user_account_id, actor_role_context,
        target_entity_type, target_entity_id, action, reason_code,
        event_summary, metadata
      ) values (
        'profile_onboarding_changed', v_identity.user_account_id, 'explorer',
        'explorer_profile', v_identity.profile_id, 'update',
        'invitation_accepted',
        'Explorer onboarding status updated after invitation acceptance.',
        '{}'::jsonb
      );
    end if;

    insert into audit.audit_event (
      event_type, actor_user_account_id, actor_role_context,
      target_entity_type, target_entity_id, action, reason_code,
      event_summary, metadata
    ) values (
      'invite_accepted', v_identity.user_account_id, 'explorer',
      'explorer_invite', p_explorer_invite_id, 'accept',
      'invitation_accepted', 'Invitation accepted.', '{}'::jsonb
    );

    insert into audit.audit_event (
      event_type, actor_user_account_id, actor_role_context,
      target_entity_type, target_entity_id, action, reason_code,
      event_summary, metadata
    ) values (
      'guide_explorer_relationship_created',
      v_identity.user_account_id,
      'explorer',
      'guide_explorer_relationship',
      v_relationship_id,
      'create',
      'invitation_accepted',
      'Guide-Explorer relationship created from invitation.',
      '{}'::jsonb
    );

    for v_revoked_invite_id in
      update core.explorer_invite invitation
         set invite_status = 'revoked',
             revoked_at = v_now
       where invitation.explorer_invite_id <> p_explorer_invite_id
         and invitation.guide_profile_id = v_invite.guide_profile_id
         and invitation.practice_id = v_invite.practice_id
         and invitation.contact_method_type = v_invite.contact_method_type
         and invitation.normalized_contact_value =
             v_invite.normalized_contact_value
         and invitation.invite_status in ('created', 'sent')
      returning invitation.explorer_invite_id
    loop
      insert into audit.audit_event (
        event_type, actor_user_account_id, actor_role_context,
        target_entity_type, target_entity_id, action, reason_code,
        event_summary, metadata
      ) values (
        'invite_revoked', null, 'system',
        'explorer_invite', v_revoked_invite_id, 'revoke',
        'superseded_by_acceptance',
        'Sibling invitation revoked after acceptance.',
        '{}'::jsonb
      );
    end loop;
  exception
    when lock_not_available or query_canceled or deadlock_detected or serialization_failure then
      raise exception 'solmind_explorer_accept_lock_unavailable';
    when unique_violation or foreign_key_violation or check_violation or not_null_violation then
      raise exception 'solmind_explorer_accept_integrity_failure';
    when others then
      if sqlerrm = any (
        array[
          'solmind_explorer_accept_invalid_request',
          'solmind_explorer_accept_ineligible',
          'solmind_explorer_accept_evidence_consumed',
          'solmind_explorer_accept_stale_evidence',
          'solmind_explorer_accept_policy_unavailable',
          'solmind_explorer_accept_capacity_reached',
          'solmind_explorer_accept_conflict',
          'solmind_explorer_accept_integrity_failure',
          'solmind_explorer_accept_lock_unavailable'
        ]::text[]
      ) then
        raise;
      end if;
      raise exception 'solmind_explorer_accept_integrity_failure';
  end;

  return query
    select 'accepted'::text,
           v_identity.user_account_id,
           v_identity.profile_id,
           v_relationship_id;
end;
$$;

alter function public.solmind_accept_explorer_invitation(
  uuid, uuid, uuid, text, text
) owner to postgres;
revoke all on function public.solmind_accept_explorer_invitation(
  uuid, uuid, uuid, text, text
) from public;
revoke execute on function public.solmind_accept_explorer_invitation(
  uuid, uuid, uuid, text, text
) from anon, authenticated;
grant execute on function public.solmind_accept_explorer_invitation(
  uuid, uuid, uuid, text, text
) to service_role;

comment on function public.solmind_accept_explorer_invitation(
  uuid, uuid, uuid, text, text
) is
  'Dormant PRJ01_F-WS06-WI008-S02E Explorer invitation acceptance. It cross-checks committed preparation and a server-verified Supabase result; consumes shared evidence once; creates or exactly validates account, contact, provider, Explorer role, and Explorer profile state; performs a first-commit-wins current-Guide capacity recheck; creates exactly one intake-pending Guide-Explorer relationship with invitation provenance; accepts one invitation; revokes only open same-Guide, same-Practice, same-contact siblings; and embeds exact Family B audit rows in one transaction. Exact committed-response recovery and every denial are writeless. EXECUTE is service_role-only. No provider IO, route, caller, cookie, session, consent, capacity-policy writer, cloud action, deployment, or real-user activation is included.';

commit;
