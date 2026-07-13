-- SolMind MVP0 DEF5-S2: dormant verification-challenge redemption CAS.
-- Purpose:
--   - atomically redeem one eligible challenge or record one eligible wrong attempt;
--   - insert the paired Family B audit row in the same transaction;
--   - expose one bounded service-role-only RPC returning redeemed or denied.
-- Creates no users, pilot data, tables, policies, table/schema grants, issuance path,
-- sessions, routes, cookies, dependencies, or Data API schema-exposure change.

create function public.solmind_redeem_verification_challenge(
  p_verification_challenge_id uuid,
  p_purpose text,
  p_verifier text
)
returns table (outcome text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row_count integer;
  v_matches boolean;
  v_purpose text;
  v_attempt_number integer;
begin
  if p_verification_challenge_id is null then
    raise exception 'solmind_redeem_invalid_selector';
  end if;
  if p_purpose is null or p_purpose not in
    ('login', 'password_reset', 'contact_verify', 'first_admin_setup', 'role_reentry') then
    raise exception 'solmind_redeem_invalid_purpose';
  end if;
  if p_verifier is null or p_verifier !~ '^svf1:[0-9a-f]{64}$' then
    raise exception 'solmind_redeem_invalid_verifier_format';
  end if;

  with changed as (
    update identity.verification_challenge challenge
       set used_at = case when challenge.code_hash = p_verifier then pg_catalog.now() else challenge.used_at end,
           failed_attempt_count = case when challenge.code_hash = p_verifier
                                       then challenge.failed_attempt_count
                                       else challenge.failed_attempt_count + 1 end,
           invalidated_at = case when challenge.code_hash <> p_verifier
                                      and challenge.failed_attempt_count + 1 >= 5
                                 then pg_catalog.now() else challenge.invalidated_at end
     where challenge.verification_challenge_id = p_verification_challenge_id
       and challenge.purpose = p_purpose
       and challenge.used_at is null
       and challenge.invalidated_at is null
       and challenge.expires_at > pg_catalog.now()
       and challenge.failed_attempt_count < 5
       and challenge.code_hash is not null
    returning challenge.code_hash = p_verifier as matches,
              challenge.purpose as purpose,
              challenge.failed_attempt_count as attempt_number
  )
  select pg_catalog.count(*)::integer,
         pg_catalog.bool_or(changed.matches),
         pg_catalog.min(changed.purpose),
         pg_catalog.max(changed.attempt_number)
    into v_row_count, v_matches, v_purpose, v_attempt_number
    from changed;

  if v_row_count > 1 then
    raise exception 'solmind_redeem_cardinality_violation';
  end if;

  if v_row_count = 0 then
    return query select 'denied'::text;
    return;
  end if;

  if v_matches then
    insert into audit.audit_event (
      event_type, actor_user_account_id, actor_role_context, target_entity_type,
      target_entity_id, action, reason_code, event_summary, metadata
    ) values (
      'verification_challenge_redeemed', null, 'system', 'verification_challenge',
      p_verification_challenge_id, 'redeem', 'challenge_redeemed',
      'Verification challenge redeemed.',
      pg_catalog.jsonb_build_object('purpose', v_purpose)
    );
    return query select 'redeemed'::text;
  else
    insert into audit.audit_event (
      event_type, actor_user_account_id, actor_role_context, target_entity_type,
      target_entity_id, action, reason_code, event_summary, metadata
    ) values (
      'verification_challenge_failed', null, 'system', 'verification_challenge',
      p_verification_challenge_id, 'deny', 'code_mismatch',
      'Verification challenge attempt denied.',
      pg_catalog.jsonb_build_object('purpose', v_purpose, 'attempt_number', v_attempt_number)
    );
    return query select 'denied'::text;
  end if;
end;
$$;

revoke all on function public.solmind_redeem_verification_challenge(uuid, text, text) from public;
revoke execute on function public.solmind_redeem_verification_challenge(uuid, text, text) from anon, authenticated;
grant execute on function public.solmind_redeem_verification_challenge(uuid, text, text) to service_role;

comment on function public.solmind_redeem_verification_challenge(uuid, text, text) is
  'DEF5-S2 dormant server-only redemption CAS. Owner-bypasses non-forced RLS solely to update one eligible identity.verification_challenge row and insert its paired Family B audit row; EXECUTE is service_role-only. code_hash stores the complete 69-character svf1 verifier (prefix plus lowercase hex HMAC); the function compares byte-exact text equality and never receives plaintext or pepper. Non-constant-time equality is accepted at this internal HMAC boundary. No eligible row writes nothing and returns denied. Eligible wrong verifiers commit their guarded increment/audit and return denied without raising. FORCE RLS on either touched table would break this function and requires a new decision.';
