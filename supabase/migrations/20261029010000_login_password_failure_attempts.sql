-- Card 9 item 15 review-only candidate: record confirmed Guide/Admin password
-- failures against the existing per-code failed-attempt budget. The trusted
-- server calls this only after the identity bridge returns credentials_refused.
-- No password, code, verifier, email, token or cookie is accepted or recorded.
-- Success/redemption/issuance/decoy semantics remain unchanged. No backfill,
-- table/policy grant, session, provider call or account-wide lockout is added.
begin;

create function public.solmind_record_login_password_failure(
  p_user_account_id uuid,
  p_verification_challenge_id uuid,
  p_role_context text
)
returns table(recorded boolean)
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '2000ms'
-- lock_timeout and the caller deadline are effective bounds; a function SET
-- statement_timeout does not bound the already-running invoking statement.
as $$
declare v_attempt_number integer;
begin
  if p_user_account_id is null or p_verification_challenge_id is null
    or p_role_context is null or p_role_context not in ('guide','admin') then
    raise exception 'solmind_password_failure_invalid_request';
  end if;

  -- The UPDATE serializes competing failures/redemption on this exact code.
  -- No eligible row means no increment/audit. A wrong password never sets used_at.
  update identity.verification_challenge challenge
     set failed_attempt_count = challenge.failed_attempt_count + 1,
         invalidated_at = case when challenge.failed_attempt_count + 1 >= 5
           then pg_catalog.clock_timestamp() else challenge.invalidated_at end
   where challenge.verification_challenge_id = p_verification_challenge_id
     and challenge.user_account_id = p_user_account_id
     and challenge.purpose = 'login'
     and challenge.used_at is null
     and challenge.invalidated_at is null
     and challenge.expires_at > pg_catalog.clock_timestamp()
     and challenge.failed_attempt_count < 5
     and challenge.code_hash is not null
     and exists (
       select 1 from identity.user_contact_method contact
       where contact.user_contact_method_id = challenge.user_contact_method_id
         and contact.user_account_id = p_user_account_id
         and contact.contact_method_type = 'email'
         and challenge.contact_method_type = 'email'
         and contact.normalized_contact_value = challenge.normalized_contact_value
         and contact.status = 'active' and contact.is_verified and contact.login_enabled
     )
     and exists (
       select 1 from identity.user_account account
       join identity.user_role_assignment assignment
         on assignment.user_account_id = account.user_account_id
       where account.user_account_id = p_user_account_id
         and account.account_status = 'active'
         and assignment.role_code = p_role_context
         and assignment.role_status = 'active' and assignment.revoked_at is null
     )
  returning challenge.failed_attempt_count into v_attempt_number;

  if not found then return query select false; return; end if;
  -- Paired persistence is atomic: an audit failure rolls the increment back.
  insert into audit.audit_event (
    event_type, actor_user_account_id, actor_role_context, target_entity_type,
    target_entity_id, action, reason_code, event_summary, metadata
  ) values (
    'verification_challenge_failed', null, 'system', 'verification_challenge',
    p_verification_challenge_id, 'deny', 'password_mismatch',
    'Verification challenge password attempt denied.',
    pg_catalog.jsonb_build_object('purpose','login','attempt_number',v_attempt_number)
  );
  return query select true;
end;
$$;

alter function public.solmind_record_login_password_failure(uuid,uuid,text) owner to postgres;
revoke all on function public.solmind_record_login_password_failure(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.solmind_record_login_password_failure(uuid,uuid,text) to service_role;
comment on function public.solmind_record_login_password_failure(uuid,uuid,text) is
  'Card 9 item 15: trusted-server-only confirmed wrong-password failure recording for an exact eligible owned login code and active Guide/Admin role. Uses the existing shared five-failure budget and fifth-failure invalidation, never redeems the code or alters issuance counters. Increment and content-free system audit are atomic. Missing/ineligible/terminal/wrong-owner rows return recorded=false without writes. Lost/late acknowledgement never authorizes retry; the caller cannot prove rollback.';

commit;
