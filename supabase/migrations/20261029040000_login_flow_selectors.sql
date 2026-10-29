-- SolMind MVP0 Card 9 item 17: stable private login-flow selectors.
-- Purpose:
--   - retain one public flow selector across actual and denied unused resends;
--   - bind only an issued row, atomically with the unchanged issuance function;
--   - resolve one current owned eligible challenge, never search by a code.
-- Proposal only, unrun. Existing rows remain null; no backfill or data seed.
-- Adds two nullable columns, two indexes, an immutable-binding guard and two
-- service-role RPC grants. No table, policy, table/schema grant, secret, provider,
-- session, cleanup or real-user activation. Existing security_log retention stays.

begin;

alter table identity.verification_challenge
  add column login_flow_id uuid null,
  add column login_flow_role_context text null,
  add constraint verification_challenge_login_flow_binding_check check (
    (login_flow_id is null and login_flow_role_context is null)
    or
    (login_flow_id is not null and login_flow_id <> '00000000-0000-0000-0000-000000000000'::uuid
      and login_flow_role_context is not null
      and login_flow_role_context in ('explorer','guide','admin')
      and purpose = 'login' and contact_method_type = 'email' and delivery_channel = 'email'
      and user_account_id is not null and user_contact_method_id is not null)
  );

create index verification_challenge_login_flow_history_idx
  on identity.verification_challenge(login_flow_id)
  where login_flow_id is not null;
create unique index verification_challenge_login_flow_open_idx
  on identity.verification_challenge(login_flow_id)
  where login_flow_id is not null and used_at is null and invalidated_at is null;

comment on column identity.verification_challenge.login_flow_id is
  'Opaque in-memory browser flow selection, not a factor or session. Private actual challenge UUID still binds the verifier. Null legacy rows are unchanged. Assigned only after issuance within its transaction; historic binding is immutable. Only an ordinary eligible current challenge resolves; no independent credential expiry or retention class is added.';
comment on column identity.verification_challenge.login_flow_role_context is
  'Fixed login route role for the immutable account/contact/flow binding; never request-selected authorization. Both flow columns are null or both present on an account/contact-bound email login row.';

create function identity.solmind_guard_login_flow_binding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.login_flow_id is not null and (
    new.login_flow_id is distinct from old.login_flow_id
    or new.login_flow_role_context is distinct from old.login_flow_role_context
    or new.verification_challenge_id is distinct from old.verification_challenge_id
    or new.user_account_id is distinct from old.user_account_id
    or new.user_contact_method_id is distinct from old.user_contact_method_id
    or new.normalized_contact_value is distinct from old.normalized_contact_value
    or new.contact_method_type is distinct from old.contact_method_type
    or new.delivery_channel is distinct from old.delivery_channel
    or new.purpose is distinct from old.purpose
  ) then
    raise exception 'solmind_login_flow_binding_immutable';
  end if;
  return new;
end;
$$;
alter function identity.solmind_guard_login_flow_binding() owner to postgres;
revoke all on function identity.solmind_guard_login_flow_binding() from public,anon,authenticated,service_role;
create trigger verification_challenge_login_flow_binding_guard
before update on identity.verification_challenge
for each row execute function identity.solmind_guard_login_flow_binding();

create function public.solmind_issue_login_flow_verification_challenge(
  p_verification_challenge_id uuid,
  p_normalized_contact_value text,
  p_contact_method_type text,
  p_purpose text,
  p_delivery_channel text,
  p_verifier text,
  p_user_account_id uuid,
  p_user_contact_method_id uuid,
  p_login_flow_id uuid,
  p_login_flow_role_context text
)
returns table(outcome text)
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '2000ms'
as $$
declare
  v_timeout interval;
  v_outcome text;
  v_count integer;
begin
  if p_verification_challenge_id is null or p_login_flow_id is null
    or p_login_flow_id = '00000000-0000-0000-0000-000000000000'::uuid
    or p_user_account_id is null or p_user_contact_method_id is null
    or p_login_flow_role_context is null
    or pg_catalog.octet_length(p_login_flow_role_context) > 8
    or p_login_flow_role_context not in ('explorer','guide','admin')
    or p_purpose is distinct from 'login' or p_contact_method_type is distinct from 'email'
    or p_delivery_channel is distinct from 'email'
    or p_normalized_contact_value is null or p_verifier is null then
    raise exception 'solmind_login_flow_invalid_request';
  end if;
  -- The original issuer also checks these. Apply its transaction/lock boundary
  -- before the new flow lock, not only after waiting for it.
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'solmind_issue_unsupported_isolation';
  end if;
  if pg_catalog.clock_timestamp() - pg_catalog.now() > interval '10 seconds' then
    raise exception 'solmind_issue_stale_transaction';
  end if;
  v_timeout := pg_catalog.current_setting('transaction_timeout')::interval;
  if v_timeout = interval '0' then
    perform pg_catalog.set_config('transaction_timeout','60s',true);
  elsif v_timeout > interval '60 seconds' then
    raise exception 'solmind_issue_unbounded_transaction';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'solmind:login-flow:v1|' || p_login_flow_id::text,0));

  -- Same public alias never moves to another fixed role/account/contact. This
  -- includes used, expired and invalidated history, under the same flow lock.
  if exists (
    select 1 from identity.verification_challenge previous
    where previous.login_flow_id = p_login_flow_id
      and (previous.login_flow_role_context is distinct from p_login_flow_role_context
        or previous.user_account_id is distinct from p_user_account_id
        or previous.user_contact_method_id is distinct from p_user_contact_method_id
        or previous.normalized_contact_value is distinct from p_normalized_contact_value)
  ) then
    return query select 'denied'::text;
    return;
  end if;

  -- Reuse the current one-account eligibility policy, including active provider
  -- binding, fixed role and exact contact. Admin username has already resolved
  -- to this canonical email in the server composition.
  if not exists (
    select 1 from public.solmind_resolve_login_account(
      p_normalized_contact_value,'email',p_login_flow_role_context) eligible
    where eligible.user_account_id = p_user_account_id
      and eligible.user_contact_method_id = p_user_contact_method_id
      and eligible.normalized_contact_value = p_normalized_contact_value
  ) then
    return query select 'denied'::text;
    return;
  end if;

  -- Exactly one existing issuer call. Its contact/purpose lock order, six-unused
  -- limit, non-extending lockout, supersession, audit and ten-minute code expiry
  -- remain unchanged. A denied call has no mapping/challenge/audit write.
  select pg_catalog.count(*)::integer,pg_catalog.min(issued.outcome)
    into v_count,v_outcome
    from public.solmind_issue_verification_challenge(
      p_verification_challenge_id,p_normalized_contact_value,p_contact_method_type,
      p_purpose,p_delivery_channel,p_verifier,p_user_account_id,p_user_contact_method_id) issued;
  if v_count <> 1 or v_outcome is null or v_outcome not in ('issued','denied') then
    raise exception 'solmind_login_flow_issuance_shape';
  end if;
  if v_outcome = 'denied' then
    return query select 'denied'::text;
    return;
  end if;

  update identity.verification_challenge challenge
     set login_flow_id = p_login_flow_id,
         login_flow_role_context = p_login_flow_role_context
   where challenge.verification_challenge_id = p_verification_challenge_id
     and challenge.user_account_id = p_user_account_id
     and challenge.user_contact_method_id = p_user_contact_method_id
     and challenge.normalized_contact_value = p_normalized_contact_value
     and challenge.purpose = 'login' and challenge.contact_method_type = 'email'
     and challenge.delivery_channel = 'email' and challenge.code_hash = p_verifier
     and challenge.login_flow_id is null and challenge.login_flow_role_context is null
     and challenge.used_at is null and challenge.invalidated_at is null;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'solmind_login_flow_mapping_failed'; end if;
  -- Any mapping/constraint/audit failure propagates and rolls back the enclosing
  -- issuance transaction. The caller still cannot infer rollback from timeout.
  return query select 'issued'::text;
end;
$$;

create function public.solmind_resolve_login_flow_challenge(
  p_login_flow_id uuid,
  p_user_account_id uuid,
  p_user_contact_method_id uuid,
  p_role_context text
)
returns table(outcome text,verification_challenge_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_now timestamptz;
begin
  if p_login_flow_id is null
    or p_login_flow_id = '00000000-0000-0000-0000-000000000000'::uuid
    or p_user_account_id is null or p_user_contact_method_id is null
    or p_role_context is null or pg_catalog.octet_length(p_role_context) > 8
    or p_role_context not in ('explorer','guide','admin') then
    raise exception 'solmind_login_flow_invalid_request';
  end if;
  v_now := pg_catalog.clock_timestamp();
  return query
    with candidate as (
      select challenge.verification_challenge_id
      from identity.verification_challenge challenge
      cross join lateral public.solmind_resolve_login_account(
        challenge.normalized_contact_value,'email',p_role_context) eligible
      where challenge.login_flow_id = p_login_flow_id
        and challenge.login_flow_role_context = p_role_context
        and challenge.user_account_id = p_user_account_id
        and challenge.user_contact_method_id = p_user_contact_method_id
        and eligible.user_account_id = p_user_account_id
        and eligible.user_contact_method_id = p_user_contact_method_id
        and eligible.normalized_contact_value = challenge.normalized_contact_value
        and challenge.purpose = 'login' and challenge.contact_method_type = 'email'
        and challenge.delivery_channel = 'email'
        and challenge.used_at is null and challenge.invalidated_at is null
        and challenge.expires_at > v_now and challenge.failed_attempt_count < 5
        and challenge.code_hash is not null
    )
    select case when pg_catalog.count(*) = 1 then 'found' else 'not_found' end::text,
      case when pg_catalog.count(*) = 1
        then pg_catalog.min(candidate.verification_challenge_id::text)::uuid else null::uuid end
    from candidate;
end;
$$;

alter function public.solmind_issue_login_flow_verification_challenge(uuid,text,text,text,text,text,uuid,uuid,uuid,text) owner to postgres;
revoke all on function public.solmind_issue_login_flow_verification_challenge(uuid,text,text,text,text,text,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.solmind_issue_login_flow_verification_challenge(uuid,text,text,text,text,text,uuid,uuid,uuid,text) to service_role;
alter function public.solmind_resolve_login_flow_challenge(uuid,uuid,uuid,text) owner to postgres;
revoke all on function public.solmind_resolve_login_flow_challenge(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.solmind_resolve_login_flow_challenge(uuid,uuid,uuid,text) to service_role;

comment on function public.solmind_issue_login_flow_verification_challenge(uuid,text,text,text,text,text,uuid,uuid,uuid,text) is
  'Trusted login-only email wrapper: fixed role/account/contact bound stable flow selector; new actual challenge UUID still binds its verifier. Takes flow lock before the unchanged issuer contact/purpose locks, reuses existing account eligibility, calls issuer once, maps issued row before commit. Six-unused/lockout/expiry/audit behavior unchanged. Denied issuance or foreign historical binding writes no challenge, mapping or audit. Mapping failure rolls the issuance transaction back; lost acknowledgement proves no rollback and grants no retry. No public account/issuance signal or direct browser capability.';
comment on function public.solmind_resolve_login_flow_challenge(uuid,uuid,uuid,text) is
  'Non-consuming trusted login-flow resolution: exactly one closed found/private-challenge-ID or not_found/null row for the fixed role and server-derived account/contact. Reuses current eligible-account policy and requires one ordinary unused/uninvalidated/unexpired/under-five-attempt login challenge. No code input, newest-account search, fallback, redemption, password, session, audit or provider action. Subsequent exact redemption/confirmation/session gates remain authoritative; a racing resend may refuse without automatic re-resolution.';

commit;
