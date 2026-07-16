-- SolMind MVP0 DEF5-S3: dormant verification-challenge issuance primitive.
-- This function performs no delivery IO, invite authorization, runtime rate control,
-- session creation, route wiring, provider call, or real-user activation.

-- Supabase CLI 2.109.1 no longer supplies the transaction context that the
-- top-level LOCK TABLE requires. Keep the migration replay-safe by owning the
-- transaction boundary explicitly; runtime function semantics are unchanged.
begin;

lock table identity.verification_challenge in share mode;

do $$
begin
  if exists (
    select 1
      from identity.verification_challenge
     where used_at is null and invalidated_at is null
     group by normalized_contact_value, purpose
    having pg_catalog.count(*) > 1
  ) then
    raise exception 'solmind_issue_existing_open_duplicate';
  end if;
end;
$$;

create unique index verification_challenge_one_structurally_open_idx
  on identity.verification_challenge (normalized_contact_value, purpose)
  where used_at is null and invalidated_at is null;

create function public.solmind_issue_verification_challenge(
  p_verification_challenge_id uuid,
  p_normalized_contact_value text,
  p_contact_method_type text,
  p_purpose text,
  p_delivery_channel text,
  p_verifier text,
  p_user_account_id uuid,
  p_user_contact_method_id uuid
)
returns table (outcome text)
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '2000ms'
as $$
declare
  v_contact identity.user_contact_method%rowtype;
  v_superseded_count integer;
  v_lock_material text;
begin
  if p_verification_challenge_id is null then
    raise exception 'solmind_issue_invalid_selector';
  end if;
  if p_purpose is null or pg_catalog.octet_length(p_purpose) > 17 then
    raise exception 'solmind_issue_invalid_purpose';
  end if;
  if p_purpose not in
    ('login', 'password_reset', 'contact_verify', 'first_admin_setup', 'role_reentry') then
    raise exception 'solmind_issue_invalid_purpose';
  end if;
  if p_contact_method_type is null or pg_catalog.octet_length(p_contact_method_type) > 5 then
    raise exception 'solmind_issue_invalid_contact_type';
  end if;
  if p_contact_method_type not in ('email', 'phone') then
    raise exception 'solmind_issue_invalid_contact_type';
  end if;
  if p_delivery_channel is null or pg_catalog.octet_length(p_delivery_channel) > 5 then
    raise exception 'solmind_issue_invalid_delivery_channel';
  end if;
  if (p_contact_method_type = 'email' and p_delivery_channel <> 'email')
     or (p_contact_method_type = 'phone' and p_delivery_channel <> 'sms') then
    raise exception 'solmind_issue_invalid_delivery_channel';
  end if;
  if p_verifier is null or pg_catalog.octet_length(p_verifier) <> 69 then
    raise exception 'solmind_issue_invalid_verifier_format';
  end if;
  if p_verifier !~ '^svf1:[0-9a-f]{64}$' then
    raise exception 'solmind_issue_invalid_verifier_format';
  end if;
  if p_normalized_contact_value is null
     or pg_catalog.octet_length(p_normalized_contact_value) > 254 then
    raise exception 'solmind_issue_invalid_contact';
  end if;
  if p_contact_method_type = 'email' and not (
    pg_catalog.char_length(p_normalized_contact_value) between 3 and 254
    and p_normalized_contact_value = pg_catalog.lower(p_normalized_contact_value)
    and p_normalized_contact_value ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+$'
    and p_normalized_contact_value !~ '\.\.'
  ) then
    raise exception 'solmind_issue_invalid_contact';
  end if;
  if p_contact_method_type = 'phone' and
     p_normalized_contact_value !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'solmind_issue_invalid_contact';
  end if;

  begin
    if (p_user_account_id is null) <> (p_user_contact_method_id is null) then
      raise exception 'solmind_issue_invalid_binding';
    end if;
    if p_user_account_id is null then
      if p_purpose not in ('first_admin_setup', 'login', 'contact_verify') then
        raise exception 'solmind_issue_invalid_binding';
      end if;
    else
      select *
        into v_contact
        from identity.user_contact_method
       where user_contact_method_id = p_user_contact_method_id
         for share;
      if not found
         or v_contact.user_account_id <> p_user_account_id
         or v_contact.contact_method_type <> p_contact_method_type
         or v_contact.normalized_contact_value <> p_normalized_contact_value then
        raise exception 'solmind_issue_invalid_binding';
      end if;
      if p_purpose in ('login', 'password_reset', 'role_reentry') and not (
        v_contact.status = 'active'
        and v_contact.is_verified
        and v_contact.login_enabled
        and (v_contact.contact_method_type <> 'phone' or v_contact.sms_capable)
      ) then
        raise exception 'solmind_issue_ineligible_contact';
      end if;
      if p_purpose in ('contact_verify', 'first_admin_setup')
         and v_contact.status not in ('pending', 'active') then
        raise exception 'solmind_issue_ineligible_contact';
      end if;
    end if;

    v_lock_material := 'solmind:def5-s3:issue:v1|'
      || pg_catalog.char_length(p_normalized_contact_value)::text || ':'
      || p_normalized_contact_value || '|'
      || pg_catalog.char_length(p_purpose)::text || ':' || p_purpose;

    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_lock_material, 0));

    update identity.verification_challenge
       set invalidated_at = pg_catalog.now()
     where normalized_contact_value = p_normalized_contact_value
       and purpose = p_purpose
       and used_at is null
       and invalidated_at is null;
    get diagnostics v_superseded_count = row_count;
    if v_superseded_count > 1 then
      raise exception 'solmind_issue_open_cardinality_violation';
    end if;

    insert into identity.verification_challenge (
      verification_challenge_id, user_account_id, user_contact_method_id,
      normalized_contact_value, contact_method_type, purpose, delivery_channel,
      code_hash, expires_at, failed_attempt_count, resend_count, locked_until
    ) values (
      p_verification_challenge_id, p_user_account_id, p_user_contact_method_id,
      p_normalized_contact_value, p_contact_method_type, p_purpose, p_delivery_channel,
      p_verifier, pg_catalog.now() + interval '10 minutes', 0, 0, null
    );

    insert into audit.audit_event (
      event_type, actor_user_account_id, actor_role_context, target_entity_type,
      target_entity_id, action, reason_code, event_summary, metadata
    ) values (
      'verification_challenge_issued', null, 'system', 'verification_challenge',
      p_verification_challenge_id, 'issue', 'challenge_issued',
      'Verification challenge issued.',
      pg_catalog.jsonb_build_object('purpose', p_purpose)
    );
  exception
    when lock_not_available or query_canceled or deadlock_detected or serialization_failure then
      raise exception 'solmind_issue_lock_unavailable';
    when unique_violation or foreign_key_violation or check_violation or not_null_violation then
      raise exception 'solmind_issue_integrity_failure';
  end;

  return query select 'issued'::text;
end;
$$;

alter function public.solmind_issue_verification_challenge(uuid, text, text, text, text, text, uuid, uuid)
  owner to postgres;

revoke all on function public.solmind_issue_verification_challenge(uuid, text, text, text, text, text, uuid, uuid) from public;
revoke execute on function public.solmind_issue_verification_challenge(uuid, text, text, text, text, text, uuid, uuid) from anon, authenticated;
grant execute on function public.solmind_issue_verification_challenge(uuid, text, text, text, text, text, uuid, uuid) to service_role;

comment on function public.solmind_issue_verification_challenge(uuid, text, text, text, text, text, uuid, uuid) is
  'DEF5-S3 dormant server-only challenge issuance. The caller owns canonical normalization, invite/bootstrap eligibility, code/UUID generation, and post-commit delivery. Both account/contact UUIDs must be null or both present; both-null is limited to first_admin_setup, invite-driven pre-account login, and invite-driven pre-account contact_verify, but this function cannot prove invite eligibility. Neutral counters are per-row initialization only and provide no resend-rate or lockout protection. No runtime caller or real-user path may use this function until the separately reviewed race-safe abuse-control gate passes.';

commit;
