-- SolMind MVP0 PRJ01_F-WS06-WI008-S02D: dormant Guide-to-Explorer
-- invitation issuance, same-Guide replacement, and revocation.
-- This migration adds no acceptance function, caller, route, delivery, provider
-- IO, cookie, session creation, consent, RLS policy, browser grant, cloud
-- action, deployment, or real-user activation.

begin;

create function public.solmind_issue_explorer_invitation(
  p_explorer_invite_id uuid,
  p_guide_user_account_id uuid,
  p_guide_user_session_id uuid,
  p_guide_profile_id uuid,
  p_practice_id uuid,
  p_contact_method_type text,
  p_invited_contact_value text,
  p_normalized_contact_value text,
  p_invited_name text
)
returns table (
  outcome text,
  explorer_invite_id uuid,
  expires_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '2000ms'
as $$
declare
  v_account identity.user_account%rowtype;
  v_session identity.user_session%rowtype;
  v_role identity.user_role_assignment%rowtype;
  v_guide_profile core.guide_profile%rowtype;
  v_practice core.practice%rowtype;
  v_practice_guide core.practice_guide%rowtype;
  v_existing core.explorer_invite%rowtype;
  v_candidate core.explorer_invite%rowtype;
  v_lifetime_policy_count integer;
  v_lifetime_minimum_hours integer;
  v_lifetime_active_hours integer;
  v_lifetime_maximum_hours integer;
  v_capacity_policy_count integer;
  v_capacity_minimum integer;
  v_capacity_active integer;
  v_capacity_maximum integer;
  v_open_invitation_count integer;
  v_now timestamptz;
  v_expires_at timestamptz;
  v_sanitized_name text;
  v_domain_lock_keys bigint[];
  v_domain_lock_key bigint;
  v_revoked_invite_id uuid;
  v_expired_invite_id uuid;
  v_matching_contact_count integer;
  v_candidate_user_account_ids uuid[];
  v_locked_user_account_ids uuid[];
  v_candidate_explorer_profile_ids uuid[];
begin
  begin
    if p_explorer_invite_id is null
       or p_guide_user_account_id is null
       or p_guide_user_session_id is null
       or p_guide_profile_id is null
       or p_practice_id is null then
      raise exception 'solmind_explorer_issue_invalid_request';
    end if;

    if p_contact_method_type is null
       or pg_catalog.octet_length(p_contact_method_type) > 5
       or p_contact_method_type not in ('email', 'phone') then
      raise exception 'solmind_explorer_issue_invalid_contact';
    end if;

    if p_invited_contact_value is null
       or p_invited_contact_value <> pg_catalog.btrim(p_invited_contact_value)
       or pg_catalog.octet_length(p_invited_contact_value) < 3
       or pg_catalog.octet_length(p_invited_contact_value) > 320
       or p_invited_contact_value ~ '[[:cntrl:]]' then
      raise exception 'solmind_explorer_issue_invalid_contact';
    end if;

    if p_normalized_contact_value is null
       or p_normalized_contact_value <> pg_catalog.btrim(p_normalized_contact_value)
       or pg_catalog.octet_length(p_normalized_contact_value) < 3
       or pg_catalog.octet_length(p_normalized_contact_value) > 320 then
      raise exception 'solmind_explorer_issue_invalid_contact';
    end if;

    if p_contact_method_type = 'email' and not (
      pg_catalog.char_length(p_normalized_contact_value) between 3 and 254
      and p_normalized_contact_value = pg_catalog.lower(p_normalized_contact_value)
      and p_normalized_contact_value ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+$'
      and p_normalized_contact_value !~ '\.\.'
    ) then
      raise exception 'solmind_explorer_issue_invalid_contact';
    end if;

    if p_contact_method_type = 'phone' and (
      p_normalized_contact_value !~ '^\+[1-9][0-9]{7,14}$'
      or p_invited_contact_value <> p_normalized_contact_value
    ) then
      raise exception 'solmind_explorer_issue_invalid_contact';
    end if;

    if p_invited_name is not null
       and pg_catalog.octet_length(p_invited_name) > 512 then
      raise exception 'solmind_explorer_issue_invalid_name';
    end if;

    v_sanitized_name := case
      when p_invited_name is null then null
      else private.solmind_sanitize_invited_display_name(
        p_invited_name,
        'explorer'
      )
    end;

    v_domain_lock_keys :=
      private.solmind_explorer_invitation_domain_lock_keys(
        p_explorer_invite_id,
        p_guide_profile_id,
        p_practice_id,
        p_contact_method_type,
        p_normalized_contact_value
      );

    foreach v_domain_lock_key in array v_domain_lock_keys loop
      perform pg_catalog.pg_advisory_xact_lock(v_domain_lock_key);
    end loop;

    select account.*
      into v_account
      from identity.user_account account
     where account.user_account_id = p_guide_user_account_id
       for share;
    if not found or v_account.account_status <> 'active' then
      raise exception 'solmind_explorer_issue_unauthorized';
    end if;

    select session_row.*
      into v_session
      from identity.user_session session_row
     where session_row.user_session_id = p_guide_user_session_id
       for share;
    if not found
       or v_session.user_account_id <> p_guide_user_account_id
       or v_session.active_role_context <> 'guide'
       or v_session.session_status <> 'active'
       or v_session.ended_at is not null
       or v_session.expires_at <= pg_catalog.clock_timestamp() then
      raise exception 'solmind_explorer_issue_unauthorized';
    end if;

    select assignment.*
      into v_role
      from identity.user_role_assignment assignment
     where assignment.user_account_id = p_guide_user_account_id
       and assignment.role_code = 'guide'
       and assignment.role_status = 'active'
       for share;
    if not found then
      raise exception 'solmind_explorer_issue_unauthorized';
    end if;

    select profile.*
      into v_guide_profile
      from core.guide_profile profile
     where profile.guide_profile_id = p_guide_profile_id
       for share;
    if not found
       or v_guide_profile.user_account_id <> p_guide_user_account_id
       or v_guide_profile.status <> 'active'
       or v_guide_profile.setup_status <> 'approved' then
      raise exception 'solmind_explorer_issue_ineligible';
    end if;

    select practice.*
      into v_practice
      from core.practice practice
     where practice.practice_id = p_practice_id
       for share;
    if not found
       or v_practice.status <> 'active'
       or v_practice.approval_status <> 'approved' then
      raise exception 'solmind_explorer_issue_ineligible';
    end if;

    select membership.*
      into v_practice_guide
      from core.practice_guide membership
     where membership.practice_id = p_practice_id
       and membership.guide_profile_id = p_guide_profile_id
       and membership.relationship_status = 'active'
       for share;
    if not found then
      raise exception 'solmind_explorer_issue_ineligible';
    end if;

    -- Candidate owners are discovered without row locks. Accounts are then
    -- locked in UUID order before contact rows and the mapping is revalidated.
    -- This preserves the banked account -> contact -> profile -> relationship
    -- partial order without adding a late account advisory key.
    select pg_catalog.array_agg(
             distinct contact.user_account_id
             order by contact.user_account_id
           )
      into v_candidate_user_account_ids
      from identity.user_contact_method contact
     where contact.contact_method_type = p_contact_method_type
       and contact.normalized_contact_value = p_normalized_contact_value;

    perform account.user_account_id
      from identity.user_account account
     where account.user_account_id = any (v_candidate_user_account_ids)
     order by account.user_account_id
       for share;

    perform contact.user_contact_method_id
      from identity.user_contact_method contact
     where contact.contact_method_type = p_contact_method_type
       and contact.normalized_contact_value = p_normalized_contact_value
     order by contact.user_contact_method_id
       for share;

    select pg_catalog.count(*)::integer,
           pg_catalog.array_agg(
             distinct contact.user_account_id
             order by contact.user_account_id
           )
      into v_matching_contact_count, v_locked_user_account_ids
      from identity.user_contact_method contact
     where contact.contact_method_type = p_contact_method_type
       and contact.normalized_contact_value = p_normalized_contact_value;

    if v_locked_user_account_ids is distinct from v_candidate_user_account_ids
       or v_matching_contact_count > 1 then
      raise exception 'solmind_explorer_issue_conflict';
    end if;

    if exists (
      select 1
        from identity.user_contact_method contact
        join identity.user_account account
          on account.user_account_id = contact.user_account_id
       where contact.contact_method_type = p_contact_method_type
         and contact.normalized_contact_value = p_normalized_contact_value
         and account.account_status <> 'active'
    ) then
      raise exception 'solmind_explorer_issue_conflict';
    end if;

    perform profile.explorer_profile_id
      from core.explorer_profile profile
     where profile.user_account_id = any (v_locked_user_account_ids)
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

    if exists (
      select 1
        from core.guide_explorer_relationship relationship
       where relationship.guide_profile_id = p_guide_profile_id
         and relationship.explorer_profile_id =
             any (v_candidate_explorer_profile_ids)
         and relationship.relationship_status in (
           'invited',
           'intake_pending',
           'active',
           'paused'
         )
    ) then
      raise exception 'solmind_explorer_issue_existing_relationship';
    end if;

    perform policy.invitation_role
      from core.invitation_lifetime_policy policy
     where policy.invitation_role = 'explorer'
       for share;

    select pg_catalog.count(*)::integer,
           pg_catalog.min(policy.minimum_hours),
           pg_catalog.min(policy.active_hours),
           pg_catalog.min(policy.maximum_hours)
      into
        v_lifetime_policy_count,
        v_lifetime_minimum_hours,
        v_lifetime_active_hours,
        v_lifetime_maximum_hours
      from core.invitation_lifetime_policy policy
     where policy.invitation_role = 'explorer';

    if v_lifetime_policy_count <> 1
       or v_lifetime_minimum_hours <> 1
       or v_lifetime_maximum_hours <> 168
       or v_lifetime_active_hours < v_lifetime_minimum_hours
       or v_lifetime_active_hours > v_lifetime_maximum_hours then
      raise exception 'solmind_explorer_issue_policy_unavailable';
    end if;

    perform policy.capacity_policy_name
      from core.explorer_engagement_capacity_policy policy
     where policy.capacity_policy_name = 'open_invitation_maximum'
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
     where policy.capacity_policy_name = 'open_invitation_maximum';

    if v_capacity_policy_count <> 1
       or v_capacity_minimum <> 1
       or v_capacity_maximum <> 10
       or v_capacity_active < v_capacity_minimum
       or v_capacity_active > v_capacity_maximum then
      raise exception 'solmind_explorer_issue_policy_unavailable';
    end if;

    perform invitation.explorer_invite_id
      from core.explorer_invite invitation
     where invitation.contact_method_type = p_contact_method_type
       and invitation.normalized_contact_value = p_normalized_contact_value
     order by invitation.explorer_invite_id
       for update;

    select invitation.*
      into v_existing
      from core.explorer_invite invitation
     where invitation.explorer_invite_id = p_explorer_invite_id;

    v_now := pg_catalog.clock_timestamp();

    -- Exact committed-response recovery is checked before any expiry,
    -- replacement, or audit write so it remains fully writeless.
    if v_existing.explorer_invite_id is not null then
      select invitation.*
        into v_candidate
        from core.explorer_invite invitation
       where invitation.explorer_invite_id = p_explorer_invite_id;

      if v_candidate.guide_profile_id = p_guide_profile_id
         and v_candidate.practice_id = p_practice_id
         and v_candidate.contact_method_type = p_contact_method_type
         and v_candidate.invited_contact_value = p_invited_contact_value
         and v_candidate.normalized_contact_value =
             p_normalized_contact_value
         and v_candidate.invited_name is not distinct from v_sanitized_name
         and v_candidate.invite_status in ('created', 'sent')
         and v_candidate.expires_at > v_now then
        return query
          select 'existing'::text,
                 v_candidate.explorer_invite_id,
                 v_candidate.expires_at;
        return;
      end if;

      raise exception 'solmind_explorer_issue_conflict';
    end if;

    for v_expired_invite_id in
      update core.explorer_invite invitation
         set invite_status = 'expired'
       where invitation.contact_method_type = p_contact_method_type
         and invitation.normalized_contact_value =
             p_normalized_contact_value
         and invitation.invite_status in ('created', 'sent')
         and invitation.expires_at <= v_now
      returning invitation.explorer_invite_id
    loop
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
        'invite_expired',
        null,
        'system',
        'explorer_invite',
        v_expired_invite_id,
        'expire',
        'invitation_expired',
        'Invitation materialized as expired.',
        '{}'::jsonb
      );
    end loop;

    for v_revoked_invite_id in
      update core.explorer_invite invitation
         set invite_status = 'revoked',
             revoked_at = v_now
       where invitation.guide_profile_id = p_guide_profile_id
         and invitation.practice_id = p_practice_id
         and invitation.contact_method_type = p_contact_method_type
         and invitation.normalized_contact_value =
             p_normalized_contact_value
         and invitation.invite_status in ('created', 'sent')
      returning invitation.explorer_invite_id
    loop
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
        'invite_revoked',
        p_guide_user_account_id,
        'guide',
        'explorer_invite',
        v_revoked_invite_id,
        'revoke',
        'superseded_by_reissuance',
        'Invitation superseded by replacement issuance.',
        '{}'::jsonb
      );
    end loop;

    select pg_catalog.count(*)::integer
      into v_open_invitation_count
      from core.explorer_invite invitation
     where invitation.contact_method_type = p_contact_method_type
       and invitation.normalized_contact_value = p_normalized_contact_value
       and invitation.invite_status in ('created', 'sent')
       and invitation.expires_at > v_now;

    if v_open_invitation_count >= v_capacity_active then
      raise exception 'solmind_explorer_issue_capacity_reached';
    end if;

    v_expires_at :=
      v_now + pg_catalog.make_interval(hours => v_lifetime_active_hours);

    insert into core.explorer_invite (
      explorer_invite_id,
      guide_profile_id,
      practice_id,
      invited_contact_value,
      normalized_contact_value,
      contact_method_type,
      invited_name,
      invite_status,
      expires_at,
      created_at,
      metadata,
      retention_class
    ) values (
      p_explorer_invite_id,
      p_guide_profile_id,
      p_practice_id,
      p_invited_contact_value,
      p_normalized_contact_value,
      p_contact_method_type,
      v_sanitized_name,
      'created',
      v_expires_at,
      v_now,
      '{}'::jsonb,
      'core_business'
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
      'explorer_invite_issued',
      p_guide_user_account_id,
      'guide',
      'explorer_invite',
      p_explorer_invite_id,
      'issue',
      'guide_issued',
      'Explorer invitation issued.',
      pg_catalog.jsonb_build_object(
        'contact_method_type',
        p_contact_method_type,
        'lifetime_hours',
        v_lifetime_active_hours
      )
    );
  exception
    when lock_not_available
      or query_canceled
      or deadlock_detected
      or serialization_failure then
      raise exception 'solmind_explorer_issue_lock_unavailable';
    when unique_violation
      or foreign_key_violation
      or check_violation
      or not_null_violation then
      raise exception 'solmind_explorer_issue_integrity_failure';
    when others then
      if sqlerrm = any (
        array[
          'solmind_explorer_issue_invalid_request',
          'solmind_explorer_issue_invalid_contact',
          'solmind_explorer_issue_invalid_name',
          'solmind_explorer_issue_unauthorized',
          'solmind_explorer_issue_ineligible',
          'solmind_explorer_issue_existing_relationship',
          'solmind_explorer_issue_capacity_reached',
          'solmind_explorer_issue_policy_unavailable',
          'solmind_explorer_issue_conflict',
          'solmind_explorer_issue_integrity_failure',
          'solmind_explorer_issue_lock_unavailable'
        ]::text[]
      ) then
        raise;
      end if;
      raise exception 'solmind_explorer_issue_integrity_failure';
  end;

  return query
    select
      'issued'::text,
      p_explorer_invite_id,
      v_expires_at;
end;
$$;

alter function public.solmind_issue_explorer_invitation(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text
) owner to postgres;

revoke all on function public.solmind_issue_explorer_invitation(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text
) from public;

revoke execute on function public.solmind_issue_explorer_invitation(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text
) from anon, authenticated;

grant execute on function public.solmind_issue_explorer_invitation(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text
) to service_role;

comment on function public.solmind_issue_explorer_invitation(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text
) is
  'Dormant PRJ01_F-WS06-WI008-S02D Guide-to-Explorer invitation issuance. It requires an active approved Guide, active Guide role/session, active approved Practice, and active Practice membership; serializes normalized-contact capacity with the canonical Explorer domain; materializes expiry; atomically replaces only an older same-Guide/same-Practice/same-contact invitation; denies cross-Guide capacity without displacement; snapshots protected lifetime policy; and writes exact transactional audit. It performs no acceptance, delivery, provider IO, route, cookie, consent, cloud action, deployment, or real-user activation.';

create function public.solmind_revoke_explorer_invitation(
  p_explorer_invite_id uuid,
  p_guide_user_account_id uuid,
  p_guide_user_session_id uuid
)
returns table (
  outcome text,
  explorer_invite_id uuid,
  invite_status text,
  revoked_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '2000ms'
as $$
declare
  v_candidate core.explorer_invite%rowtype;
  v_target core.explorer_invite%rowtype;
  v_account identity.user_account%rowtype;
  v_session identity.user_session%rowtype;
  v_role identity.user_role_assignment%rowtype;
  v_guide_profile core.guide_profile%rowtype;
  v_practice core.practice%rowtype;
  v_practice_guide core.practice_guide%rowtype;
  v_domain_lock_keys bigint[];
  v_domain_lock_key bigint;
  v_now timestamptz;
begin
  begin
    if p_explorer_invite_id is null
       or p_guide_user_account_id is null
       or p_guide_user_session_id is null then
      raise exception 'solmind_explorer_revoke_invalid_request';
    end if;

    -- The preliminary read is selector-only. Existing targets use the exact
    -- shared invitation/contact/sibling domain. A missing selector still takes
    -- the canonical Explorer invitation-ID key so a racing insertion cannot
    -- be mistaken for a stable not-found observation.
    select invitation.*
      into v_candidate
      from core.explorer_invite invitation
     where invitation.explorer_invite_id = p_explorer_invite_id;

    if found then
      v_domain_lock_keys :=
        private.solmind_explorer_invitation_domain_lock_keys(
          p_explorer_invite_id,
          v_candidate.guide_profile_id,
          v_candidate.practice_id,
          v_candidate.contact_method_type,
          v_candidate.normalized_contact_value
        );
    else
      v_domain_lock_keys := array[
        pg_catalog.hashtextextended(
          'solmind:authorizing-domain:invitation:v1|'
          || 'role=8:explorer|invite=36:'
          || p_explorer_invite_id::text,
          0
        )
      ]::bigint[];
    end if;

    foreach v_domain_lock_key in array v_domain_lock_keys loop
      perform pg_catalog.pg_advisory_xact_lock(v_domain_lock_key);
    end loop;

    select account.*
      into v_account
      from identity.user_account account
     where account.user_account_id = p_guide_user_account_id
       for share;
    if not found or v_account.account_status <> 'active' then
      raise exception 'solmind_explorer_revoke_unauthorized';
    end if;

    select session_row.*
      into v_session
      from identity.user_session session_row
     where session_row.user_session_id = p_guide_user_session_id
       for share;
    if not found
       or v_session.user_account_id <> p_guide_user_account_id
       or v_session.active_role_context <> 'guide'
       or v_session.session_status <> 'active'
       or v_session.ended_at is not null
       or v_session.expires_at <= pg_catalog.clock_timestamp() then
      raise exception 'solmind_explorer_revoke_unauthorized';
    end if;

    select assignment.*
      into v_role
      from identity.user_role_assignment assignment
     where assignment.user_account_id = p_guide_user_account_id
       and assignment.role_code = 'guide'
       and assignment.role_status = 'active'
       for share;
    if not found then
      raise exception 'solmind_explorer_revoke_unauthorized';
    end if;

    if v_candidate.explorer_invite_id is null then
      if exists (
        select 1
          from core.explorer_invite invitation
         where invitation.explorer_invite_id = p_explorer_invite_id
      ) then
        raise exception 'solmind_explorer_revoke_conflict';
      end if;
      raise exception 'solmind_explorer_revoke_not_found';
    end if;

    select profile.*
      into v_guide_profile
      from core.guide_profile profile
     where profile.guide_profile_id = v_candidate.guide_profile_id
       for share;
    if not found
       or v_guide_profile.user_account_id <> p_guide_user_account_id
       or v_guide_profile.status <> 'active'
       or v_guide_profile.setup_status <> 'approved' then
      raise exception 'solmind_explorer_revoke_not_found';
    end if;

    select practice.*
      into v_practice
      from core.practice practice
     where practice.practice_id = v_candidate.practice_id
       for share;
    if not found
       or v_practice.status <> 'active'
       or v_practice.approval_status <> 'approved' then
      raise exception 'solmind_explorer_revoke_unauthorized';
    end if;

    select membership.*
      into v_practice_guide
      from core.practice_guide membership
     where membership.practice_id = v_candidate.practice_id
       and membership.guide_profile_id = v_candidate.guide_profile_id
       and membership.relationship_status = 'active'
       for share;
    if not found then
      raise exception 'solmind_explorer_revoke_unauthorized';
    end if;

    perform invitation.explorer_invite_id
      from core.explorer_invite invitation
     where invitation.contact_method_type = v_candidate.contact_method_type
       and invitation.normalized_contact_value =
           v_candidate.normalized_contact_value
     order by invitation.explorer_invite_id
       for update;

    select invitation.*
      into v_target
      from core.explorer_invite invitation
     where invitation.explorer_invite_id = p_explorer_invite_id;
    if not found
       or v_target.guide_profile_id <> v_candidate.guide_profile_id
       or v_target.practice_id <> v_candidate.practice_id
       or v_target.contact_method_type <> v_candidate.contact_method_type
       or v_target.normalized_contact_value <>
           v_candidate.normalized_contact_value then
      raise exception 'solmind_explorer_revoke_conflict';
    end if;

    v_now := pg_catalog.clock_timestamp();

    if v_target.invite_status in ('created', 'sent')
       and v_target.expires_at <= v_now then
      update core.explorer_invite invitation
         set invite_status = 'expired'
       where invitation.explorer_invite_id = p_explorer_invite_id;

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
        'invite_expired',
        null,
        'system',
        'explorer_invite',
        p_explorer_invite_id,
        'expire',
        'invitation_expired',
        'Invitation materialized as expired.',
        '{}'::jsonb
      );

      return query
        select
          'expired'::text,
          p_explorer_invite_id,
          'expired'::text,
          null::timestamptz;
      return;
    end if;

    if v_target.invite_status in ('created', 'sent') then
      update core.explorer_invite invitation
         set invite_status = 'revoked',
             revoked_at = v_now
       where invitation.explorer_invite_id = p_explorer_invite_id;

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
        'invite_revoked',
        p_guide_user_account_id,
        'guide',
        'explorer_invite',
        p_explorer_invite_id,
        'revoke',
        'guide_revoked',
        'Explorer invitation revoked by Guide.',
        '{}'::jsonb
      );

      return query
        select
          'revoked'::text,
          p_explorer_invite_id,
          'revoked'::text,
          v_now;
      return;
    end if;

    if v_target.invite_status = 'revoked' then
      return query
        select
          'already_revoked'::text,
          p_explorer_invite_id,
          v_target.invite_status,
          v_target.revoked_at;
      return;
    end if;

    if v_target.invite_status = 'accepted' then
      return query
        select
          'accepted'::text,
          p_explorer_invite_id,
          v_target.invite_status,
          null::timestamptz;
      return;
    end if;

    if v_target.invite_status = 'expired' then
      return query
        select
          'expired'::text,
          p_explorer_invite_id,
          v_target.invite_status,
          null::timestamptz;
      return;
    end if;

    if v_target.invite_status = 'failed' then
      return query
        select
          'failed'::text,
          p_explorer_invite_id,
          v_target.invite_status,
          null::timestamptz;
      return;
    end if;

    raise exception 'solmind_explorer_revoke_conflict';
  exception
    when lock_not_available
      or query_canceled
      or deadlock_detected
      or serialization_failure then
      raise exception 'solmind_explorer_revoke_lock_unavailable';
    when unique_violation
      or foreign_key_violation
      or check_violation
      or not_null_violation then
      raise exception 'solmind_explorer_revoke_integrity_failure';
    when others then
      if sqlerrm = any (
        array[
          'solmind_explorer_revoke_invalid_request',
          'solmind_explorer_revoke_unauthorized',
          'solmind_explorer_revoke_not_found',
          'solmind_explorer_revoke_conflict',
          'solmind_explorer_revoke_integrity_failure',
          'solmind_explorer_revoke_lock_unavailable'
        ]::text[]
      ) then
        raise;
      end if;
      raise exception 'solmind_explorer_revoke_integrity_failure';
  end;
end;
$$;

alter function public.solmind_revoke_explorer_invitation(
  uuid,
  uuid,
  uuid
) owner to postgres;

revoke all on function public.solmind_revoke_explorer_invitation(
  uuid,
  uuid,
  uuid
) from public;

revoke execute on function public.solmind_revoke_explorer_invitation(
  uuid,
  uuid,
  uuid
) from anon, authenticated;

grant execute on function public.solmind_revoke_explorer_invitation(
  uuid,
  uuid,
  uuid
) to service_role;

comment on function public.solmind_revoke_explorer_invitation(
  uuid,
  uuid,
  uuid
) is
  'Dormant PRJ01_F-WS06-WI008-S02D Guide-owned Explorer-invitation revocation. It requires an active Guide account, active Guide role/session, an owned approved active Guide profile, an approved active Practice, and active Practice membership; uses the canonical Explorer invitation domain before row locks; revokes one exact owned open invitation with one transactional Guide audit; materializes exact expiry; and returns writeless terminal observations. Foreign or absent targets share one value-free not-found class. It deletes nothing and performs no acceptance, delivery, provider IO, route, cookie, consent, cloud action, deployment, or real-user activation.';

commit;
