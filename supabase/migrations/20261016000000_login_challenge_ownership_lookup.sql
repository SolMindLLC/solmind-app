-- SolMind MVP0 Guide/Admin sign-in R04: dormant, non-consuming ownership read.
-- Purpose: test one exact login selector's account/contact ownership before
-- password authentication. R04 review U1 requires the explicit contact/account
-- join: the schema's two independent foreign keys do not enforce that binding.
-- This is not eligibility, a factor check, redemption, freshness or a reservation.
-- Used/expired/invalidated/exhausted challenges can remain owned. Existing atomic
-- redemption, provider identity, redeemed confirmation and session checks stay.
-- Creates one function and its service_role EXECUTE grant only: no tables,
-- indexes, policies, table/schema grants, writes, audit, users, routes or provider
-- activation. Reads as postgres under the existing non-forced-RLS posture.

begin;

create function public.solmind_check_login_challenge_owner(
  p_user_account_id uuid,
  p_verification_challenge_id uuid,
  p_expected_purpose text
)
returns table (owned boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user_account_id is null then
    raise exception 'solmind_login_owner_invalid_account';
  end if;
  if p_verification_challenge_id is null then
    raise exception 'solmind_login_owner_invalid_challenge';
  end if;
  if p_expected_purpose is null
     or pg_catalog.octet_length(p_expected_purpose) <> 5
     or p_expected_purpose <> 'login' then
    raise exception 'solmind_login_owner_invalid_purpose';
  end if;

  return query
    select exists (
      select 1
        from identity.verification_challenge challenge
        join identity.user_contact_method contact
          on contact.user_contact_method_id = challenge.user_contact_method_id
       where challenge.verification_challenge_id = p_verification_challenge_id
         and challenge.user_account_id = p_user_account_id
         and challenge.purpose = p_expected_purpose
         and contact.user_account_id = p_user_account_id
    );
end;
$$;

alter function public.solmind_check_login_challenge_owner(uuid, uuid, text)
  owner to postgres;
revoke all on function public.solmind_check_login_challenge_owner(uuid, uuid, text)
  from public;
revoke execute on function public.solmind_check_login_challenge_owner(uuid, uuid, text)
  from anon, authenticated;
grant execute on function public.solmind_check_login_challenge_owner(uuid, uuid, text)
  to service_role;

comment on function public.solmind_check_login_challenge_owner(uuid, uuid, text) is
  'Guide/Admin R04 dormant service_role-only exact login-challenge ownership read. Returns one owned boolean for valid arguments; null/unsupported arguments raise fixed value-free errors. Requires exact selector, account, login purpose and a bound contact belonging to that account (R04 review U1). STABLE SECURITY DEFINER owned by postgres, empty search_path, schema-qualified reads and existing non-forced-RLS owner posture. Does not check eligibility, verifier, used/expiry/invalidation/attempt state, reserve or mutate anything. Ownership alone authorizes no password/code success, session, provider action or route; atomic redemption, identity assertion, redeemed same-account confirmation and session revalidation remain required.';

commit;
