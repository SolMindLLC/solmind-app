-- SolMind MVP0 P27-C companion: dormant Admin-to-Guide invitation issuance.
-- This migration adds no route, delivery, provider IO, cookie, session creation,
-- RLS policy, browser grant, cloud action, or real-user activation.

begin;

create table core.invitation_lifetime_policy (
  invitation_role text primary key,
  minimum_hours integer not null,
  active_hours integer not null,
  maximum_hours integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retention_class text not null default 'security_log',

  constraint invitation_lifetime_policy_role_check
    check (invitation_role in ('guide', 'explorer')),

  constraint invitation_lifetime_policy_values_check
    check (
      minimum_hours between 1 and 168
      and maximum_hours between 1 and 168
      and minimum_hours <= active_hours
      and active_hours <= maximum_hours
    ),

  constraint invitation_lifetime_policy_bounds_check
    check (minimum_hours = 1 and maximum_hours = 168),

  constraint invitation_lifetime_policy_retention_check
    check (retention_class = 'security_log'),

  constraint invitation_lifetime_policy_timestamps_check
    check (updated_at >= created_at)
);

alter table core.invitation_lifetime_policy enable row level security;

revoke all on table core.invitation_lifetime_policy
  from public, anon, authenticated, service_role;

insert into core.invitation_lifetime_policy (
  invitation_role,
  minimum_hours,
  active_hours,
  maximum_hours
) values
  ('guide', 1, 24, 168),
  ('explorer', 1, 24, 168);

comment on table core.invitation_lifetime_policy is
  'Protected P27 invitation-lifetime policy. Each issued invitation snapshots the active lifetime. No app role has direct table access. A later separately approved restricted audited Admin operation owns policy changes.';

create function public.solmind_issue_guide_invitation(
  p_guide_invite_id uuid,
  p_admin_user_account_id uuid,
  p_admin_user_session_id uuid,
  p_contact_method_type text,
  p_invited_contact_value text,
  p_normalized_contact_value text,
  p_invited_name text
)
returns table (
  outcome text,
  guide_invite_id uuid,
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
  v_existing core.guide_invite%rowtype;
  v_candidate core.guide_invite%rowtype;
  v_policy_count integer;
  v_minimum_hours integer;
  v_active_hours integer;
  v_maximum_hours integer;
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
begin
  begin
    if p_guide_invite_id is null
       or p_admin_user_account_id is null
       or p_admin_user_session_id is null then
      raise exception 'solmind_guide_issue_invalid_request';
    end if;

    if p_contact_method_type is null
       or pg_catalog.octet_length(p_contact_method_type) > 5
       or p_contact_method_type not in ('email', 'phone') then
      raise exception 'solmind_guide_issue_invalid_contact';
    end if;

    if p_invited_contact_value is null
       or p_invited_contact_value <> pg_catalog.btrim(p_invited_contact_value)
       or pg_catalog.octet_length(p_invited_contact_value) < 3
       or pg_catalog.octet_length(p_invited_contact_value) > 320
       or p_invited_contact_value ~ '[[:cntrl:]]' then
      raise exception 'solmind_guide_issue_invalid_contact';
    end if;

    if p_normalized_contact_value is null
       or p_normalized_contact_value <> pg_catalog.btrim(p_normalized_contact_value)
       or pg_catalog.octet_length(p_normalized_contact_value) < 3
       or pg_catalog.octet_length(p_normalized_contact_value) > 320 then
      raise exception 'solmind_guide_issue_invalid_contact';
    end if;

    if p_contact_method_type = 'email' and not (
      pg_catalog.char_length(p_normalized_contact_value) between 3 and 254
      and p_normalized_contact_value = pg_catalog.lower(p_normalized_contact_value)
      and p_normalized_contact_value ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+$'
      and p_normalized_contact_value !~ '\.\.'
    ) then
      raise exception 'solmind_guide_issue_invalid_contact';
    end if;

    if p_contact_method_type = 'phone' and (
      p_normalized_contact_value !~ '^\+[1-9][0-9]{7,14}$'
      or p_invited_contact_value <> p_normalized_contact_value
    ) then
      raise exception 'solmind_guide_issue_invalid_contact';
    end if;

    if p_invited_name is not null
       and pg_catalog.octet_length(p_invited_name) > 512 then
      raise exception 'solmind_guide_issue_invalid_name';
    end if;

    v_sanitized_name := case
      when p_invited_name is null then null
      else private.solmind_sanitize_invited_display_name(p_invited_name, 'guide')
    end;

    v_domain_lock_keys :=
      private.solmind_guide_invitation_domain_lock_keys(
        p_guide_invite_id,
        p_contact_method_type,
        p_normalized_contact_value
      );

    foreach v_domain_lock_key in array v_domain_lock_keys loop
      perform pg_catalog.pg_advisory_xact_lock(v_domain_lock_key);
    end loop;

    select account.*
      into v_account
      from identity.user_account account
     where account.user_account_id = p_admin_user_account_id
       for share;
    if not found or v_account.account_status <> 'active' then
      raise exception 'solmind_guide_issue_unauthorized';
    end if;

    select session_row.*
      into v_session
      from identity.user_session session_row
     where session_row.user_session_id = p_admin_user_session_id
       for share;
    if not found
       or v_session.user_account_id <> p_admin_user_account_id
       or v_session.active_role_context <> 'admin'
       or v_session.session_status <> 'active'
       or v_session.ended_at is not null
       or v_session.expires_at <= pg_catalog.clock_timestamp() then
      raise exception 'solmind_guide_issue_unauthorized';
    end if;

    select assignment.*
      into v_role
      from identity.user_role_assignment assignment
     where assignment.user_account_id = p_admin_user_account_id
       and assignment.role_code = 'admin'
       and assignment.role_status = 'active'
       for share;
    if not found then
      raise exception 'solmind_guide_issue_unauthorized';
    end if;

    -- Identity eligibility is evaluated after the shared contact-domain
    -- advisory locks and Admin proof, but before any invitation state or audit
    -- mutation. Candidate owner accounts are discovered without a row lock,
    -- then account rows are locked before contact rows. The contact-to-owner
    -- mapping is revalidated after both lock classes are held. This preserves
    -- the universal account -> contact -> provider -> role -> profile row-lock
    -- order used by Guide acceptance and prevents a cross-contact,
    -- same-account deadlock. States are intentionally not filtered:
    -- onboarding cannot reactivate or remediate an existing Guide identity.
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

    if v_locked_user_account_ids is distinct from v_candidate_user_account_ids then
      raise exception 'solmind_guide_issue_conflict';
    end if;

    if v_matching_contact_count > 1 then
      raise exception 'solmind_guide_issue_existing_guide';
    end if;

    perform assignment.user_role_assignment_id
      from identity.user_role_assignment assignment
     where assignment.user_account_id = any (v_locked_user_account_ids)
       and assignment.role_code = 'guide'
     order by assignment.user_role_assignment_id
       for share;

    perform profile.guide_profile_id
      from core.guide_profile profile
     where profile.user_account_id = any (v_locked_user_account_ids)
     order by profile.guide_profile_id
       for share;

    if exists (
      select 1
        from identity.user_contact_method contact
        join identity.user_account account
          on account.user_account_id = contact.user_account_id
       where contact.contact_method_type = p_contact_method_type
         and contact.normalized_contact_value = p_normalized_contact_value
         and (
           account.account_status <> 'active'
           or not exists (
             select 1
               from identity.user_role_assignment any_assignment
              where any_assignment.user_account_id = account.user_account_id
           )
           or exists (
             select 1
               from identity.user_role_assignment guide_assignment
              where guide_assignment.user_account_id = account.user_account_id
                and guide_assignment.role_code = 'guide'
           )
           or exists (
             select 1
               from core.guide_profile guide_profile
              where guide_profile.user_account_id = account.user_account_id
           )
         )
    ) then
      raise exception 'solmind_guide_issue_existing_guide';
    end if;

    select pg_catalog.count(*)::integer,
           pg_catalog.min(policy.minimum_hours),
           pg_catalog.min(policy.active_hours),
           pg_catalog.min(policy.maximum_hours)
      into v_policy_count, v_minimum_hours, v_active_hours, v_maximum_hours
      from core.invitation_lifetime_policy policy
     where policy.invitation_role = 'guide';

    if v_policy_count <> 1
       or v_minimum_hours <> 1
       or v_maximum_hours <> 168
       or v_active_hours < v_minimum_hours
       or v_active_hours > v_maximum_hours then
      raise exception 'solmind_guide_issue_policy_unavailable';
    end if;

    perform policy.invitation_role
      from core.invitation_lifetime_policy policy
     where policy.invitation_role = 'guide'
       for share;

    perform invitation.guide_invite_id
      from core.guide_invite invitation
     where invitation.contact_method_type = p_contact_method_type
       and invitation.normalized_contact_value = p_normalized_contact_value
     order by invitation.guide_invite_id
       for update;

    select invitation.*
      into v_existing
      from core.guide_invite invitation
     where invitation.guide_invite_id = p_guide_invite_id;

    if exists (
      select 1
        from core.guide_invite invitation
       where invitation.contact_method_type = p_contact_method_type
         and invitation.normalized_contact_value = p_normalized_contact_value
         and (
           invitation.invite_status = 'accepted'
           or invitation.accepted_by_user_account_id is not null
           or invitation.accepted_at is not null
         )
    ) then
      raise exception 'solmind_guide_issue_existing_guide';
    end if;

    v_now := pg_catalog.clock_timestamp();

    for v_expired_invite_id in
      update core.guide_invite invitation
         set invite_status = 'expired'
       where invitation.contact_method_type = p_contact_method_type
         and invitation.normalized_contact_value = p_normalized_contact_value
         and invitation.invite_status in ('created', 'sent')
         and invitation.expires_at <= v_now
      returning invitation.guide_invite_id
    loop
      insert into audit.audit_event (
        event_type, actor_user_account_id, actor_role_context,
        target_entity_type, target_entity_id, action, reason_code,
        event_summary, metadata
      ) values (
        'invite_expired', null, 'system',
        'guide_invite', v_expired_invite_id, 'expire',
        'invitation_expired',
        'Invitation materialized as expired.',
        '{}'::jsonb
      );
    end loop;

    if v_existing.guide_invite_id is not null then
      select invitation.*
        into v_candidate
        from core.guide_invite invitation
       where invitation.guide_invite_id = p_guide_invite_id;

      if v_candidate.invited_by_user_account_id = p_admin_user_account_id
         and v_candidate.contact_method_type = p_contact_method_type
         and v_candidate.invited_contact_value = p_invited_contact_value
         and v_candidate.normalized_contact_value = p_normalized_contact_value
         and v_candidate.invited_name is not distinct from v_sanitized_name
         and v_candidate.invite_status in ('created', 'sent')
         and v_candidate.expires_at > v_now then
        return query
          select 'existing'::text,
                 v_candidate.guide_invite_id,
                 v_candidate.expires_at;
        return;
      end if;

      raise exception 'solmind_guide_issue_conflict';
    end if;

    for v_revoked_invite_id in
      update core.guide_invite invitation
         set invite_status = 'revoked',
             revoked_at = v_now
       where invitation.contact_method_type = p_contact_method_type
         and invitation.normalized_contact_value = p_normalized_contact_value
         and invitation.invite_status in ('created', 'sent')
      returning invitation.guide_invite_id
    loop
      insert into audit.audit_event (
        event_type, actor_user_account_id, actor_role_context,
        target_entity_type, target_entity_id, action, reason_code,
        event_summary, metadata
      ) values (
        'invite_revoked', p_admin_user_account_id, 'admin',
        'guide_invite', v_revoked_invite_id, 'revoke',
        'superseded_by_reissuance',
        'Invitation superseded by replacement issuance.',
        '{}'::jsonb
      );
    end loop;

    v_expires_at := v_now + pg_catalog.make_interval(hours => v_active_hours);

    insert into core.guide_invite (
      guide_invite_id,
      invited_contact_value,
      normalized_contact_value,
      contact_method_type,
      invited_name,
      invited_by_user_account_id,
      invite_status,
      expires_at,
      created_at,
      metadata,
      retention_class
    ) values (
      p_guide_invite_id,
      p_invited_contact_value,
      p_normalized_contact_value,
      p_contact_method_type,
      v_sanitized_name,
      p_admin_user_account_id,
      'created',
      v_expires_at,
      v_now,
      '{}'::jsonb,
      'core_business'
    );

    insert into audit.audit_event (
      event_type, actor_user_account_id, actor_role_context,
      target_entity_type, target_entity_id, action, reason_code,
      event_summary, metadata
    ) values (
      'guide_invite_issued', p_admin_user_account_id, 'admin',
      'guide_invite', p_guide_invite_id, 'issue',
      'admin_issued',
      'Guide invitation issued.',
      pg_catalog.jsonb_build_object(
        'contact_method_type', p_contact_method_type,
        'lifetime_hours', v_active_hours
      )
    );
  exception
    when lock_not_available or query_canceled or deadlock_detected or serialization_failure then
      raise exception 'solmind_guide_issue_lock_unavailable';
    when unique_violation or foreign_key_violation or check_violation or not_null_violation then
      raise exception 'solmind_guide_issue_integrity_failure';
    when others then
      if sqlerrm = any (
        array[
          'solmind_guide_issue_invalid_request',
          'solmind_guide_issue_invalid_contact',
          'solmind_guide_issue_invalid_name',
          'solmind_guide_issue_unauthorized',
          'solmind_guide_issue_existing_guide',
          'solmind_guide_issue_policy_unavailable',
          'solmind_guide_issue_conflict',
          'solmind_guide_issue_integrity_failure',
          'solmind_guide_issue_lock_unavailable'
        ]::text[]
      ) then
        raise;
      end if;
      raise exception 'solmind_guide_issue_integrity_failure';
  end;

  return query
    select 'issued'::text, p_guide_invite_id, v_expires_at;
end;
$$;

alter function public.solmind_issue_guide_invitation(
  uuid, uuid, uuid, text, text, text, text
) owner to postgres;

revoke all on function public.solmind_issue_guide_invitation(
  uuid, uuid, uuid, text, text, text, text
) from public;

revoke execute on function public.solmind_issue_guide_invitation(
  uuid, uuid, uuid, text, text, text, text
) from anon, authenticated;

grant execute on function public.solmind_issue_guide_invitation(
  uuid, uuid, uuid, text, text, text, text
) to service_role;

comment on function public.solmind_issue_guide_invitation(
  uuid, uuid, uuid, text, text, text, text
) is
  'Dormant P27-C Admin-to-Guide invitation issuance. Requires an active Admin account, active Admin role, and active Admin session. It denies every existing Guide identity or accepted-onboarding state under deterministic locks, serializes replacement with Guide acceptance and revocation, snapshots protected lifetime policy, materializes expiry, revokes prior open invitations, and writes exact audit in one transaction. It performs no delivery, provider IO, route, cookie, or real-user activation.';

create function public.solmind_revoke_guide_invitation(
  p_guide_invite_id uuid,
  p_admin_user_account_id uuid,
  p_admin_user_session_id uuid
)
returns table (
  outcome text,
  guide_invite_id uuid,
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
  v_candidate core.guide_invite%rowtype;
  v_target core.guide_invite%rowtype;
  v_account identity.user_account%rowtype;
  v_session identity.user_session%rowtype;
  v_role identity.user_role_assignment%rowtype;
  v_domain_lock_keys bigint[];
  v_domain_lock_key bigint;
  v_now timestamptz;
begin
  begin
    if p_guide_invite_id is null
       or p_admin_user_account_id is null
       or p_admin_user_session_id is null then
      raise exception 'solmind_guide_revoke_invalid_request';
    end if;

    -- This preliminary read is selector-only. Existing targets use the exact
    -- shared invitation/contact/sibling domain. A missing selector still takes
    -- the canonical invitation-ID advisory key so a racing insertion cannot be
    -- mistaken for a stable not-found observation.
    select invitation.*
      into v_candidate
      from core.guide_invite invitation
     where invitation.guide_invite_id = p_guide_invite_id;

    if found then
      v_domain_lock_keys :=
        private.solmind_guide_invitation_domain_lock_keys(
          p_guide_invite_id,
          v_candidate.contact_method_type,
          v_candidate.normalized_contact_value
        );
    else
      v_domain_lock_keys := array[
        pg_catalog.hashtextextended(
          'solmind:authorizing-domain:invitation:v1|'
          || 'role=5:guide|invite=36:' || p_guide_invite_id::text,
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
     where account.user_account_id = p_admin_user_account_id
       for share;
    if not found or v_account.account_status <> 'active' then
      raise exception 'solmind_guide_revoke_unauthorized';
    end if;

    select session_row.*
      into v_session
      from identity.user_session session_row
     where session_row.user_session_id = p_admin_user_session_id
       for share;
    if not found
       or v_session.user_account_id <> p_admin_user_account_id
       or v_session.active_role_context <> 'admin'
       or v_session.session_status <> 'active'
       or v_session.ended_at is not null
       or v_session.expires_at <= pg_catalog.clock_timestamp() then
      raise exception 'solmind_guide_revoke_unauthorized';
    end if;

    select assignment.*
      into v_role
      from identity.user_role_assignment assignment
     where assignment.user_account_id = p_admin_user_account_id
       and assignment.role_code = 'admin'
       and assignment.role_status = 'active'
       for share;
    if not found then
      raise exception 'solmind_guide_revoke_unauthorized';
    end if;

    if v_candidate.guide_invite_id is null then
      if exists (
        select 1
          from core.guide_invite invitation
         where invitation.guide_invite_id = p_guide_invite_id
      ) then
        raise exception 'solmind_guide_revoke_conflict';
      end if;
      raise exception 'solmind_guide_revoke_not_found';
    end if;

    perform invitation.guide_invite_id
      from core.guide_invite invitation
     where invitation.contact_method_type = v_candidate.contact_method_type
       and invitation.normalized_contact_value =
         v_candidate.normalized_contact_value
     order by invitation.guide_invite_id
       for update;

    select invitation.*
      into v_target
      from core.guide_invite invitation
     where invitation.guide_invite_id = p_guide_invite_id;
    if not found
       or v_target.contact_method_type <> v_candidate.contact_method_type
       or v_target.normalized_contact_value <>
         v_candidate.normalized_contact_value then
      raise exception 'solmind_guide_revoke_conflict';
    end if;

    v_now := pg_catalog.clock_timestamp();

    if v_target.invite_status in ('created', 'sent')
       and v_target.expires_at <= v_now then
      update core.guide_invite invitation
         set invite_status = 'expired'
       where invitation.guide_invite_id = p_guide_invite_id;

      insert into audit.audit_event (
        event_type, actor_user_account_id, actor_role_context,
        target_entity_type, target_entity_id, action, reason_code,
        event_summary, metadata
      ) values (
        'invite_expired', null, 'system',
        'guide_invite', p_guide_invite_id, 'expire',
        'invitation_expired',
        'Invitation materialized as expired.',
        '{}'::jsonb
      );

      return query
        select 'expired'::text,
               p_guide_invite_id,
               'expired'::text,
               null::timestamptz;
      return;
    end if;

    if v_target.invite_status in ('created', 'sent') then
      update core.guide_invite invitation
         set invite_status = 'revoked',
             revoked_at = v_now
       where invitation.guide_invite_id = p_guide_invite_id;

      insert into audit.audit_event (
        event_type, actor_user_account_id, actor_role_context,
        target_entity_type, target_entity_id, action, reason_code,
        event_summary, metadata
      ) values (
        'invite_revoked', p_admin_user_account_id, 'admin',
        'guide_invite', p_guide_invite_id, 'revoke',
        'admin_revoked',
        'Guide invitation revoked by Admin.',
        '{}'::jsonb
      );

      return query
        select 'revoked'::text,
               p_guide_invite_id,
               'revoked'::text,
               v_now;
      return;
    end if;

    if v_target.invite_status = 'revoked' then
      return query
        select 'already_revoked'::text,
               p_guide_invite_id,
               v_target.invite_status,
               v_target.revoked_at;
      return;
    end if;

    if v_target.invite_status = 'accepted' then
      return query
        select 'accepted'::text,
               p_guide_invite_id,
               v_target.invite_status,
               null::timestamptz;
      return;
    end if;

    if v_target.invite_status = 'expired' then
      return query
        select 'expired'::text,
               p_guide_invite_id,
               v_target.invite_status,
               null::timestamptz;
      return;
    end if;

    if v_target.invite_status = 'failed' then
      return query
        select 'failed'::text,
               p_guide_invite_id,
               v_target.invite_status,
               null::timestamptz;
      return;
    end if;

    raise exception 'solmind_guide_revoke_conflict';
  exception
    when lock_not_available or query_canceled or deadlock_detected or serialization_failure then
      raise exception 'solmind_guide_revoke_lock_unavailable';
    when unique_violation or foreign_key_violation or check_violation or not_null_violation then
      raise exception 'solmind_guide_revoke_integrity_failure';
    when others then
      if sqlerrm = any (
        array[
          'solmind_guide_revoke_invalid_request',
          'solmind_guide_revoke_unauthorized',
          'solmind_guide_revoke_not_found',
          'solmind_guide_revoke_conflict',
          'solmind_guide_revoke_integrity_failure',
          'solmind_guide_revoke_lock_unavailable'
        ]::text[]
      ) then
        raise;
      end if;
      raise exception 'solmind_guide_revoke_integrity_failure';
  end;
end;
$$;

alter function public.solmind_revoke_guide_invitation(
  uuid, uuid, uuid
) owner to postgres;

revoke all on function public.solmind_revoke_guide_invitation(
  uuid, uuid, uuid
) from public;

revoke execute on function public.solmind_revoke_guide_invitation(
  uuid, uuid, uuid
) from anon, authenticated;

grant execute on function public.solmind_revoke_guide_invitation(
  uuid, uuid, uuid
) to service_role;

comment on function public.solmind_revoke_guide_invitation(
  uuid, uuid, uuid
) is
  'Dormant P27-C Admin Guide-invitation revocation. Requires an active Admin account, active Admin role, and owned active Admin session; uses the canonical shared invitation domain before row locks; revokes one exact open invitation with one transactional Admin audit; materializes exact expiry; and returns writeless terminal observations for accepted, expired, failed, or already-revoked targets. It deletes nothing and performs no delivery, provider IO, route, cookie, Guide-account governance, cloud action, or real-user activation.';

commit;
