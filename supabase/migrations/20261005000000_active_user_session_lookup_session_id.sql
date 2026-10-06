-- SolMind MVP0 login step 6 sub-slice S6-3: the active-session lookup also returns the session UUID.
-- Source contracts: execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md
-- Sections 8 and 19, as Paul corrected them on 2026-10-05; execution/19_SolMind_MVP0_Auth_RLS_RPC_Function_Contract_v0_1.md
-- Sections 7, 8 (function 3) and 9 (AUTH-RLS-DEC-026).
-- Replaces the definition of public.solmind_find_active_user_sessions(uuid) created by
-- 20260705001000_admin_auth_rpc_lookup_functions.sql.
-- Purpose:
--   - each returned row also carries user_session_id, so that the per-request check of contract 25
--     Section 8 can compare the account's selected session with the session-binding cookie (a later
--     slice; nothing in this migration compares anything);
--   - everything else stays as banked: the one uuid argument; LANGUAGE sql, STABLE, SECURITY DEFINER
--     owned by postgres, an empty search_path; one schema-qualified SELECT of identity.user_session with
--     only the account and session_status = 'active' predicates; no expiry pre-filter, LIMIT, ORDER BY,
--     or exception handler, so every active-status session of the account is returned and expiry and
--     ambiguity stay visible to the app; it raises nothing of its own, and an absent or null account
--     returns no rows;
--   - the same grants: all privileges revoked from PUBLIC, EXECUTE revoked from anon and authenticated,
--     EXECUTE granted to service_role.
-- PostgreSQL cannot replace a function whose return columns change, so the function is dropped and
-- created again in one transaction; that resets its privileges, so the full grant block is repeated
-- against the signature (contract 19 Section 7).
-- The session UUID grants nothing on its own: it is compared only after a valid Supabase session for
-- the same account (contract 25 Section 8), and it stays out of logs, errors and evidence (Section 14).
-- Adds no table, column, index, policy, table or schema grant, write, caller, route, cookie, provider
-- action, cloud path, deployment, or real-user flow. The app's existing callers read only the four
-- columns they name, so they ignore the added column.

begin;

drop function public.solmind_find_active_user_sessions(uuid);

create function public.solmind_find_active_user_sessions(
  p_user_account_id uuid
)
returns table (
  user_session_id uuid,
  user_account_id uuid,
  active_role_context text,
  session_status text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.user_session_id,
    t.user_account_id,
    t.active_role_context,
    t.session_status,
    t.expires_at
  from identity.user_session as t
  where t.session_status = 'active'
    and t.user_account_id = p_user_account_id;
$$;

alter function public.solmind_find_active_user_sessions(uuid)
  owner to postgres;

revoke all on function public.solmind_find_active_user_sessions(uuid) from public;
revoke execute on function public.solmind_find_active_user_sessions(uuid) from anon, authenticated;
grant execute on function public.solmind_find_active_user_sessions(uuid) to service_role;

comment on function public.solmind_find_active_user_sessions(uuid) is
  'Privileged server-only Admin/auth lookup (AUTH-RLS-DEC-026). Reads identity.user_session as owner (deliberate non-forced-RLS bypass); EXECUTE granted to service_role only; decides no authorization, which stays in the app guard layer. Returns all active sessions (no LIMIT, no expiry pre-filter) so ambiguity stays visible to the app. Each row carries its user_session_id (login step 6 sub-slice S6-3) so the per-request check can compare the selected session with the session-binding cookie; the UUID grants nothing on its own. Applying FORCE ROW LEVEL SECURITY to identity.user_session would silently break this function and requires a new AUTH-RLS decision first.';

commit;
