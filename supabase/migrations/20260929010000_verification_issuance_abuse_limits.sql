-- SolMind MVP0 login step 2: verification abuse limits (backlog item 59; AUTH-RLS-DEC-037).
-- Purpose:
--   - race-safe abuse limits inside the existing dormant issuance transaction: a contact-wide lock before the banked
--     pair lock, a rolling-hour budget of six committed issuances per normalized contact across all purposes, a
--     non-extending 15-minute lockout after the sixth, and writeless 'denied' outcomes;
--   - a contact-plus-creation-time index for the bounded reads;
--   - time and isolation (review #109a): each issuance records the clock time read after the contact lock as
--     created_at, so issuance times follow the lock order and cannot be backdated by an old transaction; the function
--     fails closed unless the transaction is READ COMMITTED (so the count after the lock sees every committed
--     issuance) and began at most 10 seconds earlier. The contact lock is held until the transaction ends, so no other
--     issuance for the contact can run until this one commits or rolls back;
--   - the commit bound (review #109b): each call sets transaction_timeout to 60 seconds for the rest of its
--     transaction (PostgreSQL 17), so the server ends and rolls back a transaction that outlives it; a caller whose
--     transaction already has a longer timeout is refused. An issuance is therefore committed or gone within 70 seconds
--     of its transaction's start. Supersession records the same post-lock issuance time as invalidated_at.
--
-- Redemption is unchanged. Retention must keep challenge rows younger than 75 minutes.
-- This migration intentionally creates no tables, no users, no policies, no new grants (the function keeps its
-- service_role-only grant), no real pilot data, no caller, route, delivery, provider or real-user activation.

begin;

create index verification_challenge_contact_created_idx
  on identity.verification_challenge (normalized_contact_value, created_at);

create or replace function public.solmind_issue_verification_challenge(
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
  v_contact_lock_material text;
  v_now timestamptz;
  v_recent_count integer;
  v_lockout_active boolean;
  v_timeout interval;
begin
  -- AUTH-RLS-DEC-037 enforcement preconditions (review #109a): fixed value-free errors, before any read.
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'solmind_issue_unsupported_isolation';
  end if;
  if pg_catalog.clock_timestamp() - pg_catalog.now() > interval '10 seconds' then
    raise exception 'solmind_issue_stale_transaction';
  end if;
  -- The commit bound (review #109b): the server ends this transaction, rolling it back, if it outlives 60 seconds from
  -- here. The setting is local to the transaction and outlasts this function. A shorter existing timeout is kept.
  v_timeout := pg_catalog.current_setting('transaction_timeout')::interval;
  if v_timeout = interval '0' then
    perform pg_catalog.set_config('transaction_timeout', '60s', true);
  elsif v_timeout > interval '60 seconds' then
    raise exception 'solmind_issue_unbounded_transaction';
  end if;
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

    -- AUTH-RLS-DEC-037: a domain-separated contact-wide lock, taken before the banked pair lock (fixed order).
    v_contact_lock_material := 'solmind:item59:issue-contact:v1|'
      || pg_catalog.char_length(p_normalized_contact_value)::text || ':'
      || p_normalized_contact_value;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_contact_lock_material, 0));
    -- The issuance time: read after the contact lock, so it follows the lock (and commit) order.
    v_now := pg_catalog.clock_timestamp();

    -- Rolling-hour budget: committed issuances for this contact across all purposes.
    select pg_catalog.count(*)::integer
      into v_recent_count
      from identity.verification_challenge c
     where c.normalized_contact_value = p_normalized_contact_value
       and c.created_at > v_now - interval '1 hour';

    -- Non-extending lockout: an issuance in the last 15 minutes was the sixth within its own rolling hour.
    select exists (
      select 1
        from identity.verification_challenge s
       where s.normalized_contact_value = p_normalized_contact_value
         and s.created_at > v_now - interval '15 minutes'
         and (
           select pg_catalog.count(*)
             from identity.verification_challenge w
            where w.normalized_contact_value = p_normalized_contact_value
              and w.created_at > s.created_at - interval '1 hour'
              and w.created_at <= s.created_at
         ) >= 6
    ) into v_lockout_active;

    -- Writeless denial: no challenge row, no audit row, one fixed value-free outcome.
    if v_recent_count >= 6 or v_lockout_active then
      return query select 'denied'::text;
      return;
    end if;

    v_lock_material := 'solmind:def5-s3:issue:v1|'
      || pg_catalog.char_length(p_normalized_contact_value)::text || ':'
      || p_normalized_contact_value || '|'
      || pg_catalog.char_length(p_purpose)::text || ':' || p_purpose;

    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_lock_material, 0));

    update identity.verification_challenge
       set invalidated_at = v_now
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
      code_hash, expires_at, failed_attempt_count, resend_count, locked_until, created_at
    ) values (
      p_verification_challenge_id, p_user_account_id, p_user_contact_method_id,
      p_normalized_contact_value, p_contact_method_type, p_purpose, p_delivery_channel,
      p_verifier, pg_catalog.now() + interval '10 minutes', 0, 0, null, v_now
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
  'DEF5-S3 dormant server-only challenge issuance with AUTH-RLS-DEC-037 abuse limits: at most six committed issuances per normalized contact in a rolling hour across all purposes, and a non-extending 15-minute lockout after the sixth. Returns issued or denied; denials write nothing. Each issuance records the clock time after the contact lock as created_at. It requires a READ COMMITTED transaction begun at most 10 seconds earlier, and otherwise fails closed (solmind_issue_unsupported_isolation, solmind_issue_stale_transaction). It sets transaction_timeout to 60 seconds for the rest of the calling transaction, so the server ends a transaction that outlives it, and refuses a transaction whose timeout is already longer (solmind_issue_unbounded_transaction). Callers make each call in its own short transaction and must not change transaction_timeout afterwards. The caller owns canonical normalization, invite/bootstrap eligibility, code/UUID generation, post-commit delivery and the generic outward response. Both account/contact UUIDs must be null or both present; both-null is limited to first_admin_setup, invite-driven pre-account login, and invite-driven pre-account contact_verify, but this function cannot prove invite eligibility. resend_count and locked_until are dormant compatibility fields. No runtime caller or real-user path may use this function until separately gated.';

commit;
