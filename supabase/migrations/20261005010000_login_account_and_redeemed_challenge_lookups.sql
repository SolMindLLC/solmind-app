-- SolMind MVP0 login step 6 sub-slice S6-5: dormant sign-in lookups.
-- Source plan: solmind-sprints/PRJ01-SPR001/Validation_Workspaces/Login_Step6_Main_Slice_Plan_2026-10-05_0112_R03.md
-- (G2 and G7), whose two lookups Paul accepted at the 2026-10-05 evening meeting (decision 2: "the
-- identifier lookup (email, and the Admin username) and the redeemed-account confirmation"), under the
-- step 6 go-ahead of execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md
-- (accepted as AUTH-RLS-DEC-043).
-- Purpose:
--   - public.solmind_resolve_login_account: from a typed identifier (a canonical email, or the Admin
--     username for the Admin only) and the role the route's login path fixes, return the one eligible
--     account with its login-enabled verified email contact, that contact's stored email (only when it
--     passes the issuance function's canonical email check, on either path), and the bound Supabase
--     provider user id; or zero rows. Every ineligible, unknown or ambiguous state gives the same zero
--     rows, with no reason, so the route can give one acknowledgment for every identifier;
--   - public.solmind_confirm_redeemed_login_challenge: after the route's own redemption of the exact
--     selector returned redeemed, and before the Explorer bridge, confirm that this challenge is the
--     server-derived account's own, of the expected purpose, used, not invalidated and fresh. It always
--     returns exactly one row: true, or false for every other state, with no reason.
-- Where each stored-state predicate comes from:
--   - the contact (email, active, verified, login-enabled): the login-purpose contact check of
--     public.solmind_issue_verification_challenge (20260929010000_verification_issuance_abuse_limits.sql);
--   - the contact's stored email: that function's canonical email check (the 254-byte bound, 3 to 254
--     characters, already lowercase, the same pattern, no '..'), so either path returns only an email the
--     issuance function accepts;
--   - the account (active) and the role (active, revoked_at null): public.solmind_create_user_session
--     (20260718000000_authorizing_evidence_consumption.sql);
--   - exactly one active 'supabase' provider identity: the bound provider_user_id that the identity bridge
--     asserts (AUTH-RLS-DEC-035); ambiguity denies (AUTH-RLS-DEC-005), here as zero rows;
--   - the evidence (bound to the account with a non-null contact, the expected purpose, used, not
--     invalidated, fresh under identity.session_creation_freshness_policy with the same comparison):
--     public.solmind_create_user_session's evidence and freshness checks (AUTH-RLS-DEC-039);
-- How a typed identifier is checked:
--   - an email: the email check of public.solmind_issue_verification_challenge, exactly (the 254-byte
--     bound first);
--   - a username: only what the schema already requires of a username (not blank, as
--     user_account_username_not_blank_check has it), and already lowercase, so that it compares with
--     lower(username), the expression of the unique username index. No other username form is imposed.
-- The confirmation reads one challenge by its exact selector only: it is not a newest-open lookup
-- (AUTH-RLS-DEC-031), and redemption stays unchanged (AUTH-RLS-DEC-038). The account lookup reads no
-- challenge at all.
-- Both functions are plpgsql, STABLE (so neither can write), SECURITY DEFINER owned by postgres, with an
-- empty search_path and schema-qualified reads. A malformed argument raises one fixed value-free
-- identifier that depends only on the argument, never on stored data; there is no exception handler, so
-- nothing else is caught or rewritten.
-- EXECUTE is granted to service_role only: anon and authenticated execution is denied, and service-role
-- RPC execution through the Data API (PostgREST serves the public schema) stays available, as for the
-- other dormant login functions.
-- Adds no table, column, index, policy, table/schema grant, write, audit row, caller, route, cookie,
-- provider action, cloud path, deployment, or real-user flow.

begin;

create function public.solmind_resolve_login_account(
  p_normalized_login_identifier text,
  p_login_identifier_type text,
  p_requested_role_context text
)
returns table (
  user_account_id uuid,
  user_contact_method_id uuid,
  normalized_contact_value text,
  provider_user_id text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Arguments are checked in order; the type and role are bounded before their list checks, and an
  -- email is bounded before any pattern work, as the issuance function does. A failure here depends
  -- only on the argument, never on stored data.
  if p_normalized_login_identifier is null then
    raise exception 'solmind_login_lookup_invalid_identifier';
  end if;
  if p_login_identifier_type is null
     or pg_catalog.octet_length(p_login_identifier_type) > 8
     or p_login_identifier_type not in ('email', 'username') then
    raise exception 'solmind_login_lookup_invalid_identifier_type';
  end if;
  if p_requested_role_context is null
     or pg_catalog.octet_length(p_requested_role_context) > 8
     or p_requested_role_context not in ('admin', 'guide', 'explorer') then
    raise exception 'solmind_login_lookup_invalid_role';
  end if;
  -- The username is the Admin's only (A3A, "Email, or the Admin username").
  if p_login_identifier_type = 'username' and p_requested_role_context <> 'admin' then
    raise exception 'solmind_login_lookup_invalid_identifier_type';
  end if;
  -- An email: the issuance function's own email check, exactly, with its 254-byte bound first.
  if p_login_identifier_type = 'email' and (
    pg_catalog.octet_length(p_normalized_login_identifier) > 254
    or not (
      pg_catalog.char_length(p_normalized_login_identifier) between 3 and 254
      and p_normalized_login_identifier = pg_catalog.lower(p_normalized_login_identifier)
      and p_normalized_login_identifier ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+$'
      and p_normalized_login_identifier !~ '\.\.'
    )
  ) then
    raise exception 'solmind_login_lookup_invalid_identifier';
  end if;
  -- A username: only what the schema already requires of a username (not blank, as
  -- user_account_username_not_blank_check has it), and already lowercase, so that it compares with
  -- lower(username), the expression of the unique username index. No other form is imposed.
  if p_login_identifier_type = 'username' and not (
    pg_catalog.length(pg_catalog.btrim(p_normalized_login_identifier)) > 0
    and p_normalized_login_identifier = pg_catalog.lower(p_normalized_login_identifier)
  ) then
    raise exception 'solmind_login_lookup_invalid_identifier';
  end if;

  -- One eligible candidate, or zero rows. Every other count (none, or an ambiguity such as two
  -- sign-in emails on the username path or two active provider identities) gives the same zero rows.
  return query
    with candidate as (
      select account.user_account_id,
             contact.user_contact_method_id,
             contact.normalized_contact_value,
             provider_identity.provider_user_id
        from identity.user_account account
        join identity.user_contact_method contact
          on contact.user_account_id = account.user_account_id
        join identity.auth_provider_identity provider_identity
          on provider_identity.user_account_id = account.user_account_id
       where account.account_status = 'active'
         and (
           (p_login_identifier_type = 'email'
            and contact.normalized_contact_value = p_normalized_login_identifier)
           or
           (p_login_identifier_type = 'username'
            and pg_catalog.lower(account.username) = p_normalized_login_identifier)
         )
         and contact.contact_method_type = 'email'
         and contact.status = 'active'
         and contact.is_verified
         and contact.login_enabled
         -- The stored email must pass the issuance function's canonical email check, so that neither
         -- path returns an email the issuance function would refuse.
         and pg_catalog.octet_length(contact.normalized_contact_value) <= 254
         and pg_catalog.char_length(contact.normalized_contact_value) between 3 and 254
         and contact.normalized_contact_value = pg_catalog.lower(contact.normalized_contact_value)
         and contact.normalized_contact_value ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+$'
         and contact.normalized_contact_value !~ '\.\.'
         and provider_identity.provider_name = 'supabase'
         and provider_identity.status = 'active'
         and exists (
           select 1
             from identity.user_role_assignment assignment
            where assignment.user_account_id = account.user_account_id
              and assignment.role_code = p_requested_role_context
              and assignment.role_status = 'active'
              and assignment.revoked_at is null
         )
    )
    select candidate.user_account_id,
           candidate.user_contact_method_id,
           candidate.normalized_contact_value,
           candidate.provider_user_id
      from candidate
     where (select pg_catalog.count(*) from candidate) = 1;
end;
$$;

alter function public.solmind_resolve_login_account(text, text, text)
  owner to postgres;

revoke all on function public.solmind_resolve_login_account(text, text, text)
  from public;
revoke execute on function public.solmind_resolve_login_account(text, text, text)
  from anon, authenticated;
grant execute on function public.solmind_resolve_login_account(text, text, text)
  to service_role;

comment on function public.solmind_resolve_login_account(text, text, text) is
  'Login step 6 sub-slice S6-5 dormant server-only sign-in account lookup (plan G2; Paul''s 2026-10-05 decision 2; AUTH-RLS-DEC-043). Given a typed identifier (a canonical email, or the Admin username, lowercase, for the admin role only) and the role the route fixes, it returns the one active account with an active role assignment for that role, its active, verified, login-enabled email contact whose stored email passes the issuance function''s canonical email check, that email, and its one active supabase provider user id; or zero rows for every ineligible, unknown or ambiguous state, with no reason. A malformed argument raises one fixed value-free identifier; a username is checked only for what the schema requires (not blank) and lowercase form. STABLE, so it cannot write; it reads no verification challenge. Reads identity tables as owner (deliberate non-forced-RLS bypass); EXECUTE is service_role-only: anon and authenticated execution is denied, and service-role RPC execution stays available. Applying FORCE ROW LEVEL SECURITY to a table it reads would silently break it and requires a new AUTH-RLS decision first. No route, caller, cookie, provider action, cloud path, or real-user path is authorized.';

create function public.solmind_confirm_redeemed_login_challenge(
  p_user_account_id uuid,
  p_verification_challenge_id uuid,
  p_expected_purpose text
)
returns table (confirmed boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
begin
  if p_user_account_id is null then
    raise exception 'solmind_login_confirm_invalid_account';
  end if;
  if p_verification_challenge_id is null then
    raise exception 'solmind_login_confirm_invalid_challenge';
  end if;
  if p_expected_purpose is null
     or pg_catalog.octet_length(p_expected_purpose) > 12
     or p_expected_purpose not in ('login', 'role_reentry') then
    raise exception 'solmind_login_confirm_invalid_purpose';
  end if;

  -- The freshness clock: the start of the calling statement, so a long caller transaction cannot make
  -- old evidence look fresh. The session function applies its own later clock again.
  v_now := pg_catalog.statement_timestamp();

  -- Exactly one row. True only when the exact selector's challenge is the account's own, with a contact,
  -- of the expected purpose, used, not invalidated, and fresh under a valid protected freshness policy
  -- (the session function's comparison). Every other state, a missing policy included, is false.
  return query
    select exists (
      select 1
        from identity.verification_challenge challenge
        join identity.session_creation_freshness_policy policy
          on policy.policy_name = 'redeemed_evidence_freshness'
       where challenge.verification_challenge_id = p_verification_challenge_id
         and challenge.user_account_id = p_user_account_id
         and challenge.user_contact_method_id is not null
         and challenge.purpose = p_expected_purpose
         and challenge.used_at is not null
         and challenge.invalidated_at is null
         and policy.minimum_seconds > 0
         and policy.minimum_seconds <= policy.active_seconds
         and policy.active_seconds <= policy.maximum_seconds
         and challenge.used_at <= v_now
         and challenge.used_at >= v_now - pg_catalog.make_interval(secs => policy.active_seconds)
    );
end;
$$;

alter function public.solmind_confirm_redeemed_login_challenge(uuid, uuid, text)
  owner to postgres;

revoke all on function public.solmind_confirm_redeemed_login_challenge(uuid, uuid, text)
  from public;
revoke execute on function public.solmind_confirm_redeemed_login_challenge(uuid, uuid, text)
  from anon, authenticated;
grant execute on function public.solmind_confirm_redeemed_login_challenge(uuid, uuid, text)
  to service_role;

comment on function public.solmind_confirm_redeemed_login_challenge(uuid, uuid, text) is
  'Login step 6 sub-slice S6-5 dormant server-only redeemed-challenge confirmation (plan G7; Paul''s 2026-10-05 decision 2; AUTH-RLS-DEC-043). Given the server-derived account, the exact selector the route has just redeemed, and the expected purpose (login or role_reentry), it returns exactly one row: confirmed true only when that challenge is bound to that account with a contact, has that purpose, is used, is not invalidated, and is fresh under identity.session_creation_freshness_policy with the session function''s comparison; false for every other state, with no reason. A malformed argument raises one fixed value-free identifier. STABLE, so it cannot write; it reads one challenge by its exact selector and is not a newest-open lookup (AUTH-RLS-DEC-031). The route requires redeemed and then true before any Supabase session is made. Reads identity tables as owner (deliberate non-forced-RLS bypass); EXECUTE is service_role-only: anon and authenticated execution is denied, and service-role RPC execution stays available. Applying FORCE ROW LEVEL SECURITY to a table it reads would silently break it and requires a new AUTH-RLS decision first. No route, caller, cookie, provider action, cloud path, or real-user path is authorized.';

commit;
