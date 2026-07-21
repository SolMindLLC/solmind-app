-- SolMind MVP0 P27-C: dormant Guide invitation acceptance.
-- Banked migration. Its database-only primitives remain dormant until a
-- separately approved caller and runtime path are implemented.
--
-- Purpose:
--   - add a protected initial-display-name sanitizer;
--   - add a protected common Guide identity-provisioning helper;
--   - add the dormant service-role-only Guide acceptance entry;
--   - structurally enforce one open Guide invitation per normalized contact.
--
-- This migration performs no provider IO and creates no route, caller, cookie,
-- session, consent, Practice membership, Explorer relationship, delivery,
-- cloud action, deployment, or real-user activation.

begin;

create schema if not exists private;
alter schema private owner to postgres;
revoke all on schema private from public, anon, authenticated, service_role;

create type private.solmind_invited_identity_result as (
  user_account_id uuid,
  account_created boolean,
  user_contact_method_id uuid,
  contact_created boolean,
  auth_provider_identity_id uuid,
  provider_identity_created boolean,
  user_role_assignment_id uuid,
  role_created boolean,
  profile_id uuid,
  profile_created boolean
);

revoke all on type private.solmind_invited_identity_result
  from public, anon, authenticated, service_role;

create function private.solmind_sanitize_invited_display_name(
  p_source text,
  p_role_code text
)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_value text := coalesce(p_source, '');
  v_codepoint integer;
begin
  if p_role_code not in ('guide', 'explorer') then
    raise exception 'solmind_invited_identity_invalid_role';
  end if;

  -- Convert the reviewed whitespace set to ordinary spaces before collapsing.
  foreach v_codepoint in array array[
    9, 10, 11, 12, 13,
    160, 5760,
    8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202,
    8232, 8233, 8239, 8287, 12288
  ] loop
    v_value := pg_catalog.replace(v_value, pg_catalog.chr(v_codepoint), ' ');
  end loop;

  -- Remove C0/C1 controls except the whitespace characters normalized above.
  foreach v_codepoint in array array[
    1, 2, 3, 4, 5, 6, 7, 8,
    14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
    127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140,
    141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154,
    155, 156, 157, 158, 159
  ] loop
    v_value := pg_catalog.replace(v_value, pg_catalog.chr(v_codepoint), '');
  end loop;

  -- Remove the exact reviewed zero-width and directional-format set.
  foreach v_codepoint in array array[
    173, 847, 1564, 4447, 4448, 6158,
    8203, 8204, 8205, 8206, 8207,
    8234, 8235, 8236, 8237, 8238,
    8288, 8289, 8290, 8291, 8292, 8293, 8294, 8295,
    8296, 8297, 8298, 8299, 8300, 8301, 8302, 8303,
    65279
  ] loop
    v_value := pg_catalog.replace(v_value, pg_catalog.chr(v_codepoint), '');
  end loop;

  v_value := pg_catalog.btrim(
    pg_catalog.regexp_replace(v_value, ' +', ' ', 'g')
  );
  v_value := pg_catalog.substr(v_value, 1, 120);

  if v_value = '' then
    if p_role_code = 'guide' then
      return 'New Guide';
    end if;
    return 'New Explorer';
  end if;

  return v_value;
end;
$$;

alter function private.solmind_sanitize_invited_display_name(text, text)
  owner to postgres;
revoke all on function private.solmind_sanitize_invited_display_name(text, text)
  from public, anon, authenticated, service_role;

comment on function private.solmind_sanitize_invited_display_name(text, text) is
  'Protected P27-C sanitizer for invitation-derived initial display names. It normalizes a reviewed whitespace set, removes exact control/zero-width/directional format code points, collapses spaces, truncates to 120 Unicode code points, and supplies a neutral role-specific fallback. It is not app-callable.';

create function private.solmind_provision_invited_guide_identity(
  p_existing_user_account_id uuid,
  p_existing_user_contact_method_id uuid,
  p_contact_method_type text,
  p_contact_value text,
  p_normalized_contact_value text,
  p_provider_user_id text,
  p_normalized_provider_email text,
  p_provisioning_reservation_id uuid,
  p_display_name text
)
returns private.solmind_invited_identity_result
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_result private.solmind_invited_identity_result;
  v_account identity.user_account%rowtype;
  v_contact identity.user_contact_method%rowtype;
  v_provider identity.auth_provider_identity%rowtype;
  v_role identity.user_role_assignment%rowtype;
  v_profile core.guide_profile%rowtype;
  v_count integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_contact_method_type not in ('email', 'phone')
     or p_contact_value is null
     or p_normalized_contact_value is null
     or p_provider_user_id is null
     or p_normalized_provider_email is null
     or p_provisioning_reservation_id is null
     or p_display_name is null
     or p_display_name = ''
     or pg_catalog.char_length(p_display_name) > 120 then
    raise exception 'solmind_invited_identity_invalid_request';
  end if;

  if (p_existing_user_account_id is null)
       <> (p_existing_user_contact_method_id is null) then
    raise exception 'solmind_invited_identity_conflict';
  end if;

  if p_existing_user_account_id is null then
    if p_contact_method_type <> 'email'
       or p_normalized_contact_value <> p_normalized_provider_email then
      raise exception 'solmind_invited_identity_ineligible';
    end if;

    perform contact.user_contact_method_id
      from identity.user_contact_method contact
     where (
       contact.contact_method_type = p_contact_method_type
       and contact.normalized_contact_value = p_normalized_contact_value
     ) or (
       contact.contact_method_type = 'email'
       and contact.normalized_contact_value = p_normalized_provider_email
     )
     order by contact.user_contact_method_id
       for update;

    perform provider_identity.auth_provider_identity_id
      from identity.auth_provider_identity provider_identity
     where provider_identity.provider_name = 'supabase'
       and (
         provider_identity.provider_user_id = p_provider_user_id
         or provider_identity.provider_email = p_normalized_provider_email
         or provider_identity.provisioning_reservation_id = p_provisioning_reservation_id
       )
     order by provider_identity.auth_provider_identity_id
       for update;

    if exists (
      select 1
        from identity.user_contact_method contact
       where (
         contact.contact_method_type = p_contact_method_type
         and contact.normalized_contact_value = p_normalized_contact_value
       ) or (
         contact.contact_method_type = 'email'
         and contact.normalized_contact_value = p_normalized_provider_email
       )
    ) or exists (
      select 1
        from identity.auth_provider_identity provider_identity
       where provider_identity.provider_name = 'supabase'
         and (
           provider_identity.provider_user_id = p_provider_user_id
           or provider_identity.provider_email = p_normalized_provider_email
           or provider_identity.provisioning_reservation_id = p_provisioning_reservation_id
         )
    ) then
      raise exception 'solmind_invited_identity_conflict';
    end if;

    v_result.user_account_id := pg_catalog.gen_random_uuid();
    v_result.user_contact_method_id := pg_catalog.gen_random_uuid();
    v_result.auth_provider_identity_id := pg_catalog.gen_random_uuid();
    v_result.user_role_assignment_id := pg_catalog.gen_random_uuid();
    v_result.profile_id := pg_catalog.gen_random_uuid();

    insert into identity.user_account (
      user_account_id,
      display_name,
      account_status,
      created_at,
      metadata
    ) values (
      v_result.user_account_id,
      p_display_name,
      'active',
      v_now,
      '{}'::jsonb
    );
    v_result.account_created := true;

    insert into identity.user_contact_method (
      user_contact_method_id,
      user_account_id,
      contact_method_type,
      contact_label,
      contact_value,
      normalized_contact_value,
      phone_type,
      sms_capable,
      login_enabled,
      is_verified,
      verified_at,
      verification_method,
      status,
      created_at,
      metadata
    ) values (
      v_result.user_contact_method_id,
      v_result.user_account_id,
      p_contact_method_type,
      'primary',
      p_contact_value,
      p_normalized_contact_value,
      null,
      null,
      true,
      true,
      v_now,
      'invitation_acceptance',
      'active',
      v_now,
      '{}'::jsonb
    );
    v_result.contact_created := true;

    insert into identity.auth_provider_identity (
      auth_provider_identity_id,
      user_account_id,
      provider_name,
      provider_user_id,
      provider_email,
      linked_at,
      status,
      metadata,
      provisioning_reservation_id
    ) values (
      v_result.auth_provider_identity_id,
      v_result.user_account_id,
      'supabase',
      p_provider_user_id,
      p_normalized_provider_email,
      v_now,
      'active',
      '{}'::jsonb,
      p_provisioning_reservation_id
    );
    v_result.provider_identity_created := true;

    insert into identity.user_role_assignment (
      user_role_assignment_id,
      user_account_id,
      role_code,
      role_status,
      granted_by_user_account_id,
      granted_by_role_context,
      granted_at,
      metadata
    ) values (
      v_result.user_role_assignment_id,
      v_result.user_account_id,
      'guide',
      'active',
      null,
      'system',
      v_now,
      '{}'::jsonb
    );
    v_result.role_created := true;

    insert into core.guide_profile (
      guide_profile_id,
      user_account_id,
      guide_display_name,
      setup_status,
      created_at,
      status,
      metadata,
      retention_class
    ) values (
      v_result.profile_id,
      v_result.user_account_id,
      p_display_name,
      'profile_pending',
      v_now,
      'active',
      '{}'::jsonb,
      'core_business'
    );
    v_result.profile_created := true;

    return v_result;
  end if;

  select account.*
    into v_account
    from identity.user_account account
   where account.user_account_id = p_existing_user_account_id
     for update;
  if not found or v_account.account_status <> 'active' then
    raise exception 'solmind_invited_identity_ineligible';
  end if;

  perform contact.user_contact_method_id
    from identity.user_contact_method contact
   where contact.user_account_id = p_existing_user_account_id
      or (
        contact.contact_method_type = p_contact_method_type
        and contact.normalized_contact_value = p_normalized_contact_value
      )
      or (
        contact.contact_method_type = 'email'
        and contact.normalized_contact_value = p_normalized_provider_email
      )
   order by contact.user_contact_method_id
     for update;

  select pg_catalog.count(*)::integer
    into v_count
    from identity.user_contact_method contact
   where contact.user_contact_method_id = p_existing_user_contact_method_id;
  if v_count <> 1 then
    raise exception 'solmind_invited_identity_ineligible';
  end if;

  select contact.*
    into v_contact
    from identity.user_contact_method contact
   where contact.user_contact_method_id = p_existing_user_contact_method_id;
  if v_contact.user_account_id <> p_existing_user_account_id
     or v_contact.contact_method_type <> p_contact_method_type
     or v_contact.normalized_contact_value <> p_normalized_contact_value
     or v_contact.status <> 'active'
     or not v_contact.is_verified
     or not v_contact.login_enabled then
    raise exception 'solmind_invited_identity_ineligible';
  end if;

  if p_contact_method_type = 'phone' then
    select pg_catalog.count(*)::integer
      into v_count
      from identity.user_contact_method contact
     where contact.user_account_id = p_existing_user_account_id
       and contact.contact_method_type = 'email'
       and contact.normalized_contact_value = p_normalized_provider_email
       and contact.status = 'active'
       and contact.is_verified
       and contact.login_enabled;
    if v_count <> 1 then
      raise exception 'solmind_invited_identity_ineligible';
    end if;
  end if;

  perform provider_identity.auth_provider_identity_id
    from identity.auth_provider_identity provider_identity
   where provider_identity.user_account_id = p_existing_user_account_id
      or (
        provider_identity.provider_name = 'supabase'
        and provider_identity.provider_user_id = p_provider_user_id
      )
      or (
        provider_identity.provider_name = 'supabase'
        and provider_identity.provider_email = p_normalized_provider_email
      )
      or provider_identity.provisioning_reservation_id = p_provisioning_reservation_id
   order by provider_identity.auth_provider_identity_id
     for update;

  select pg_catalog.count(*)::integer
    into v_count
    from identity.auth_provider_identity provider_identity
   where provider_identity.user_account_id = p_existing_user_account_id
     and provider_identity.provider_name = 'supabase';
  if v_count <> 1 then
    raise exception 'solmind_invited_identity_conflict';
  end if;

  select provider_identity.*
    into v_provider
    from identity.auth_provider_identity provider_identity
   where provider_identity.user_account_id = p_existing_user_account_id
     and provider_identity.provider_name = 'supabase';
  if v_provider.provider_user_id <> p_provider_user_id
     or v_provider.provider_email is distinct from p_normalized_provider_email
     or v_provider.status <> 'active'
     or v_provider.provisioning_reservation_id is not null
        and v_provider.provisioning_reservation_id <> p_provisioning_reservation_id
     or exists (
       select 1
         from identity.auth_provider_identity provider_identity
        where provider_identity.provider_name = 'supabase'
          and (
            provider_identity.provider_user_id = p_provider_user_id
            or provider_identity.provider_email = p_normalized_provider_email
            or provider_identity.provisioning_reservation_id = p_provisioning_reservation_id
          )
          and provider_identity.user_account_id <> p_existing_user_account_id
     ) then
    raise exception 'solmind_invited_identity_conflict';
  end if;

  perform assignment.user_role_assignment_id
    from identity.user_role_assignment assignment
   where assignment.user_account_id = p_existing_user_account_id
     and assignment.role_code = 'guide'
   order by assignment.user_role_assignment_id
     for update;

  perform profile.guide_profile_id
    from core.guide_profile profile
   where profile.user_account_id = p_existing_user_account_id
   order by profile.guide_profile_id
     for update;

  select pg_catalog.count(*)::integer
    into v_count
    from identity.user_role_assignment assignment
   where assignment.user_account_id = p_existing_user_account_id
     and assignment.role_code = 'guide';

  if v_count = 0 then
    if exists (
      select 1
        from core.guide_profile profile
       where profile.user_account_id = p_existing_user_account_id
    ) then
      raise exception 'solmind_invited_identity_conflict';
    end if;

    v_result.user_role_assignment_id := pg_catalog.gen_random_uuid();
    v_result.profile_id := pg_catalog.gen_random_uuid();

    insert into identity.user_role_assignment (
      user_role_assignment_id,
      user_account_id,
      role_code,
      role_status,
      granted_by_user_account_id,
      granted_by_role_context,
      granted_at,
      metadata
    ) values (
      v_result.user_role_assignment_id,
      p_existing_user_account_id,
      'guide',
      'active',
      null,
      'system',
      v_now,
      '{}'::jsonb
    );
    v_result.role_created := true;

    insert into core.guide_profile (
      guide_profile_id,
      user_account_id,
      guide_display_name,
      setup_status,
      created_at,
      status,
      metadata,
      retention_class
    ) values (
      v_result.profile_id,
      p_existing_user_account_id,
      p_display_name,
      'profile_pending',
      v_now,
      'active',
      '{}'::jsonb,
      'core_business'
    );
    v_result.profile_created := true;
  elsif v_count = 1 then
    select assignment.*
      into v_role
      from identity.user_role_assignment assignment
     where assignment.user_account_id = p_existing_user_account_id
       and assignment.role_code = 'guide';

    select pg_catalog.count(*)::integer
      into v_count
      from core.guide_profile profile
     where profile.user_account_id = p_existing_user_account_id;
    if v_count <> 1 then
      raise exception 'solmind_invited_identity_conflict';
    end if;

    select profile.*
      into v_profile
      from core.guide_profile profile
     where profile.user_account_id = p_existing_user_account_id;

    if v_role.role_status <> 'active'
       or v_profile.status <> 'active'
       or v_profile.setup_status not in (
         'profile_pending', 'submitted', 'approved', 'changes_requested'
       ) then
      raise exception 'solmind_invited_identity_ineligible';
    end if;

    v_result.user_role_assignment_id := v_role.user_role_assignment_id;
    v_result.profile_id := v_profile.guide_profile_id;
    v_result.role_created := false;
    v_result.profile_created := false;
  else
    raise exception 'solmind_invited_identity_conflict';
  end if;

  v_result.user_account_id := v_account.user_account_id;
  v_result.account_created := false;
  v_result.user_contact_method_id := v_contact.user_contact_method_id;
  v_result.contact_created := false;
  v_result.auth_provider_identity_id := v_provider.auth_provider_identity_id;
  v_result.provider_identity_created := false;

  return v_result;
end;
$$;

alter function private.solmind_provision_invited_guide_identity(
  uuid, uuid, text, text, text, text, text, uuid, text
) owner to postgres;
revoke all on function private.solmind_provision_invited_guide_identity(
  uuid, uuid, text, text, text, text, text, uuid, text
) from public, anon, authenticated, service_role;

comment on function private.solmind_provision_invited_guide_identity(
  uuid, uuid, text, text, text, text, text, uuid, text
) is
  'Protected P27-C common identity helper for the Guide entry. It creates or exactly validates account, contact, Supabase binding, Guide role, and Guide profile invariants and reports per-entity inserts. It never reads or mutates invitations/evidence, writes audit, creates sessions/relationships/consent, or performs provider IO. It is not app-callable.';

-- Hold the invitation table against writes while the duplicate preflight and
-- structural backstop are established. Existing conflicts fail closed; this
-- migration never chooses a winner or mutates invitation history.
lock table core.guide_invite in share mode;

do $$
begin
  if exists (
    select 1
      from core.guide_invite invitation
     where invitation.invite_status in ('created', 'sent')
     group by invitation.contact_method_type, invitation.normalized_contact_value
    having pg_catalog.count(*) > 1
  ) then
    raise exception 'solmind_guide_invite_open_cardinality_preflight_failed';
  end if;
end;
$$;

create unique index guide_invite_one_open_contact_idx
  on core.guide_invite (contact_method_type, normalized_contact_value)
  where invite_status in ('created', 'sent');

create function private.solmind_guide_invitation_domain_lock_keys(
  p_guide_invite_id uuid,
  p_contact_method_type text,
  p_normalized_contact_value text
)
returns bigint[]
language sql
immutable
security invoker
set search_path = ''
as $$
  select pg_catalog.array_agg(keys.lock_key order by keys.lock_key)
    from (
      select distinct pg_catalog.hashtextextended(material.lock_material, 0)
        as lock_key
        from (
          values
            (
              'solmind:authorizing-domain:invitation:v1|'
              || 'role=5:guide|invite=36:' || p_guide_invite_id::text
            ),
            (
              'solmind:authorizing-domain:contact:v1|'
              || 'type=' || pg_catalog.octet_length(p_contact_method_type)::text
              || ':' || p_contact_method_type
              || '|value='
              || pg_catalog.octet_length(p_normalized_contact_value)::text
              || ':' || p_normalized_contact_value
            ),
            (
              'solmind:authorizing-domain:invitation-sibling:v1|'
              || 'role=5:guide'
              || '|type=' || pg_catalog.octet_length(p_contact_method_type)::text
              || ':' || p_contact_method_type
              || '|value='
              || pg_catalog.octet_length(p_normalized_contact_value)::text
              || ':' || p_normalized_contact_value
            )
        ) material(lock_material)
    ) keys
$$;

alter function private.solmind_guide_invitation_domain_lock_keys(
  uuid, text, text
) owner to postgres;

revoke all on function private.solmind_guide_invitation_domain_lock_keys(
  uuid, text, text
) from public, anon, authenticated, service_role;

comment on function private.solmind_guide_invitation_domain_lock_keys(
  uuid, text, text
) is
  'Canonical Guide invitation, contact, and sibling advisory-lock keys shared by issuance and acceptance. Returns exactly one sorted, de-duplicated array and owns no authorization, row locking, state change, audit, evidence, provider, session, or cookie behavior.';

create function public.solmind_accept_guide_invitation(
  p_guide_invite_id uuid,
  p_verification_challenge_id uuid,
  p_provisioning_reservation_id uuid,
  p_provider_user_id text,
  p_normalized_provider_email text
)
returns table (outcome text, user_account_id uuid, guide_profile_id uuid)
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
  v_consumption identity.authorizing_evidence_consumption%rowtype;
  v_identity private.solmind_invited_identity_result;
  v_recovery_account identity.user_account%rowtype;
  v_recovery_provider identity.auth_provider_identity%rowtype;
  v_recovery_contact identity.user_contact_method%rowtype;
  v_recovery_role identity.user_role_assignment%rowtype;
  v_recovery_profile core.guide_profile%rowtype;
  v_revoked_invite_id uuid;
  v_evidence_lock_key bigint;
  v_domain_lock_keys bigint[];
  v_domain_lock_key bigint;
  v_now timestamptz;
  v_display_name text;
  v_policy_count integer;
  v_minimum_seconds integer;
  v_active_seconds integer;
  v_maximum_seconds integer;
  v_recovery_count integer;
  v_consumption_found boolean := false;
begin
  begin
    if p_guide_invite_id is null
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
      raise exception 'solmind_guide_accept_invalid_request';
    end if;

    select invitation.*
      into v_candidate_invite
      from core.guide_invite invitation
     where invitation.guide_invite_id = p_guide_invite_id;
    if not found then
      raise exception 'solmind_guide_accept_ineligible';
    end if;

    select challenge.*
      into v_candidate_challenge
      from identity.verification_challenge challenge
     where challenge.verification_challenge_id = p_verification_challenge_id;
    if not found then
      raise exception 'solmind_guide_accept_ineligible';
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
              private.solmind_guide_invitation_domain_lock_keys(
                p_guide_invite_id,
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
      raise exception 'solmind_guide_accept_conflict';
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
       or v_reservation.guide_invite_id <> p_guide_invite_id
       or v_reservation.explorer_invite_id is not null
       or v_reservation.provider_name <> 'supabase'
       or v_reservation.created_at is null
       or v_reservation.expires_at <> v_reservation.created_at + interval '24 hours'
       or v_reservation.retention_class <> 'security_log' then
      raise exception 'solmind_guide_accept_conflict';
    end if;

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
      raise exception 'solmind_guide_accept_conflict';
    end if;

    v_now := pg_catalog.clock_timestamp();

    -- Exact committed-response recovery is checked before freshness. It remains
    -- fully writeless and requires the original evidence ownership plus every
    -- current account/contact/provider/role/profile invariant.
    if v_invite.invite_status = 'accepted' then
      if not v_consumption_found
         or v_consumption.consumer_type <> 'guide_invitation_acceptance'
         or v_consumption.consumer_record_id <> p_guide_invite_id
         or v_invite.accepted_by_user_account_id is null
         or v_invite.accepted_at is null
         or v_challenge.used_at is null
         or v_challenge.invalidated_at is not null
         or v_challenge.contact_method_type <> v_invite.contact_method_type
         or v_challenge.normalized_contact_value <> v_invite.normalized_contact_value
         or v_challenge.user_account_id is not null
            and v_challenge.user_account_id <> v_invite.accepted_by_user_account_id then
        raise exception 'solmind_guide_accept_ineligible';
      end if;

      select account.*
        into v_recovery_account
        from identity.user_account account
       where account.user_account_id = v_invite.accepted_by_user_account_id
         for share;
      if not found or v_recovery_account.account_status <> 'active' then
        raise exception 'solmind_guide_accept_ineligible';
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
        raise exception 'solmind_guide_accept_conflict';
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
        raise exception 'solmind_guide_accept_ineligible';
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
          raise exception 'solmind_guide_accept_ineligible';
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
        raise exception 'solmind_guide_accept_conflict';
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
        raise exception 'solmind_guide_accept_conflict';
      end if;

      perform assignment.user_role_assignment_id
        from identity.user_role_assignment assignment
       where assignment.user_account_id = v_invite.accepted_by_user_account_id
         and assignment.role_code = 'guide'
       order by assignment.user_role_assignment_id
         for share;

      select pg_catalog.count(*)::integer
        into v_recovery_count
        from identity.user_role_assignment assignment
       where assignment.user_account_id = v_invite.accepted_by_user_account_id
         and assignment.role_code = 'guide';
      if v_recovery_count <> 1 then
        raise exception 'solmind_guide_accept_conflict';
      end if;

      select assignment.*
        into v_recovery_role
        from identity.user_role_assignment assignment
       where assignment.user_account_id = v_invite.accepted_by_user_account_id
         and assignment.role_code = 'guide'
         and assignment.role_status = 'active'
         for share;
      if not found then
        raise exception 'solmind_guide_accept_ineligible';
      end if;

      perform profile.guide_profile_id
        from core.guide_profile profile
       where profile.user_account_id = v_invite.accepted_by_user_account_id
       order by profile.guide_profile_id
         for share;

      select pg_catalog.count(*)::integer
        into v_recovery_count
        from core.guide_profile profile
       where profile.user_account_id = v_invite.accepted_by_user_account_id;
      if v_recovery_count <> 1 then
        raise exception 'solmind_guide_accept_conflict';
      end if;

      select profile.*
        into v_recovery_profile
        from core.guide_profile profile
       where profile.user_account_id = v_invite.accepted_by_user_account_id
         and profile.status = 'active'
         and profile.setup_status in (
           'profile_pending', 'submitted', 'approved', 'changes_requested'
         )
         for share;
      if not found then
        raise exception 'solmind_guide_accept_ineligible';
      end if;

      return query
        select 'existing'::text,
               v_invite.accepted_by_user_account_id,
               v_recovery_profile.guide_profile_id;
      return;
    end if;

    if v_consumption_found then
      raise exception 'solmind_guide_accept_evidence_consumed';
    end if;

    if v_invite.invite_status not in ('created', 'sent')
       or v_invite.expires_at <= v_now
       or v_invite.accepted_by_user_account_id is not null
       or v_invite.accepted_at is not null
       or v_invite.revoked_at is not null then
      raise exception 'solmind_guide_accept_ineligible';
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
      raise exception 'solmind_guide_accept_ineligible';
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
      raise exception 'solmind_guide_accept_policy_unavailable';
    end if;

    if v_challenge.used_at > v_now
       or v_challenge.used_at < v_now - pg_catalog.make_interval(secs => v_active_seconds) then
      raise exception 'solmind_guide_accept_stale_evidence';
    end if;

    if v_invite.contact_method_type = 'email'
       and p_normalized_provider_email <> v_invite.normalized_contact_value then
      raise exception 'solmind_guide_accept_ineligible';
    end if;

    v_display_name := private.solmind_sanitize_invited_display_name(
      v_invite.invited_name,
      'guide'
    );

    begin
      v_identity := private.solmind_provision_invited_guide_identity(
        v_challenge.user_account_id,
        v_challenge.user_contact_method_id,
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
        raise exception 'solmind_guide_accept_lock_unavailable';
      when others then
        if sqlerrm = 'solmind_invited_identity_ineligible' then
          raise exception 'solmind_guide_accept_ineligible';
        end if;
        if sqlerrm = 'solmind_invited_identity_conflict' then
          raise exception 'solmind_guide_accept_conflict';
        end if;
        raise exception 'solmind_guide_accept_integrity_failure';
    end;

    insert into identity.authorizing_evidence_consumption (
      verification_challenge_id,
      consumer_type,
      consumer_record_id,
      consumed_at,
      retention_class
    ) values (
      p_verification_challenge_id,
      'guide_invitation_acceptance',
      p_guide_invite_id,
      v_now,
      'security_log'
    );

    update core.guide_invite invitation
       set invite_status = 'accepted',
           accepted_by_user_account_id = v_identity.user_account_id,
           accepted_at = v_now
     where invitation.guide_invite_id = p_guide_invite_id;

    if v_identity.account_created then
      insert into audit.audit_event (
        event_type, actor_user_account_id, actor_role_context,
        target_entity_type, target_entity_id, action, reason_code,
        event_summary, metadata
      ) values (
        'account_provisioned', v_identity.user_account_id, 'guide',
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
        'contact_method_changed', v_identity.user_account_id, 'guide',
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
        'auth_provider_identity_bound', v_identity.user_account_id, 'guide',
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
        'role_assignment_changed', v_identity.user_account_id, 'guide',
        'user_role_assignment', v_identity.user_role_assignment_id, 'grant',
        'invitation_accepted', 'Role assignment granted from invitation.',
        pg_catalog.jsonb_build_object('role_code', 'guide')
      );
    end if;

    if v_identity.profile_created then
      insert into audit.audit_event (
        event_type, actor_user_account_id, actor_role_context,
        target_entity_type, target_entity_id, action, reason_code,
        event_summary, metadata
      ) values (
        'profile_created', v_identity.user_account_id, 'guide',
        'guide_profile', v_identity.profile_id, 'create',
        'invitation_accepted', 'Profile created from invitation.',
        pg_catalog.jsonb_build_object('profile_type', 'guide')
      );
    end if;

    insert into audit.audit_event (
      event_type, actor_user_account_id, actor_role_context,
      target_entity_type, target_entity_id, action, reason_code,
      event_summary, metadata
    ) values (
      'invite_accepted', v_identity.user_account_id, 'guide',
      'guide_invite', p_guide_invite_id, 'accept',
      'invitation_accepted', 'Invitation accepted.', '{}'::jsonb
    );

    for v_revoked_invite_id in
      update core.guide_invite invitation
         set invite_status = 'revoked',
             revoked_at = v_now
       where invitation.guide_invite_id <> p_guide_invite_id
         and invitation.contact_method_type = v_invite.contact_method_type
         and invitation.normalized_contact_value = v_invite.normalized_contact_value
         and invitation.invite_status in ('created', 'sent')
      returning invitation.guide_invite_id
    loop
      insert into audit.audit_event (
        event_type, actor_user_account_id, actor_role_context,
        target_entity_type, target_entity_id, action, reason_code,
        event_summary, metadata
      ) values (
        'invite_revoked', null, 'system',
        'guide_invite', v_revoked_invite_id, 'revoke',
        'superseded_by_acceptance',
        'Sibling invitation revoked after acceptance.',
        '{}'::jsonb
      );
    end loop;
  exception
    when lock_not_available or query_canceled or deadlock_detected or serialization_failure then
      raise exception 'solmind_guide_accept_lock_unavailable';
    when unique_violation or foreign_key_violation or check_violation or not_null_violation then
      raise exception 'solmind_guide_accept_integrity_failure';
    when others then
      if sqlerrm = any (
        array[
          'solmind_guide_accept_invalid_request',
          'solmind_guide_accept_ineligible',
          'solmind_guide_accept_evidence_consumed',
          'solmind_guide_accept_stale_evidence',
          'solmind_guide_accept_policy_unavailable',
          'solmind_guide_accept_conflict',
          'solmind_guide_accept_integrity_failure',
          'solmind_guide_accept_lock_unavailable'
        ]::text[]
      ) then
        raise;
      end if;
      raise exception 'solmind_guide_accept_integrity_failure';
  end;

  return query
    select 'accepted'::text, v_identity.user_account_id, v_identity.profile_id;
end;
$$;

alter function public.solmind_accept_guide_invitation(
  uuid, uuid, uuid, text, text
) owner to postgres;
revoke all on function public.solmind_accept_guide_invitation(
  uuid, uuid, uuid, text, text
) from public;
revoke execute on function public.solmind_accept_guide_invitation(
  uuid, uuid, uuid, text, text
) from anon, authenticated;
grant execute on function public.solmind_accept_guide_invitation(
  uuid, uuid, uuid, text, text
) to service_role;

comment on function public.solmind_accept_guide_invitation(
  uuid, uuid, uuid, text, text
) is
  'Dormant P27-C Guide invitation acceptance. It cross-checks committed P27-B preparation and a server-verified Supabase result; consumes shared evidence; creates or exactly validates account/contact/provider/Guide role/profile state; accepts one invitation; defensively revokes open siblings; and embeds exact Family B audit rows in one transaction. Exact committed-response recovery is writeless. EXECUTE is service_role-only. No provider IO, route, caller, cookie, session, consent, Practice membership, Explorer relationship, cloud action, deployment, or real-user activation is included.';

commit;
