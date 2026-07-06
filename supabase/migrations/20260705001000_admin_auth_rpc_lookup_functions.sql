-- SolMind MVP0 Auth/RLS Option B - enumerated privileged Admin/auth RPC foundation (functions 2-6).
-- Source contract: execution/19_SolMind_MVP0_Auth_RLS_RPC_Function_Contract_v0_1.md (Section 8 functions 2-6; Sections 7, 9, 14).
-- Banked decision: AUTH-RLS-DEC-026.
-- Depends on: 20260705000000_auth_provider_identity_rpc.sql (function 1, single-function proof).
-- Scope:
--   - create the remaining five enumerated server-only Admin/auth lookup functions:
--       public.solmind_find_user_account(uuid)
--       public.solmind_find_active_user_sessions(uuid)
--       public.solmind_find_active_role_assignment(uuid, text)
--       public.solmind_find_guide_profile(uuid)
--       public.solmind_find_explorer_profile(uuid)
--   - apply least-privilege EXECUTE per function: revoke from PUBLIC, anon, authenticated; grant to service_role only.
--   - document the owner-bypass rationale and the FORCE ROW LEVEL SECURITY standing invariant per function.
-- This migration creates five privileged lookup functions with service_role-only EXECUTE grants.
-- It creates no tables, no RLS policies, no users, no seed or pilot data, no additional grants,
-- and no Data API schema-exposure change (identity/core stay hidden; exposed schemas remain
-- public, graphql_public). It deliberately does NOT create a Guide-Explorer relationship
-- function (AUTH-RLS-DEF-018).

-- Function 2: account record by id. No status predicate; the TypeScript derivation checks
-- account_status exactly. Primary-key lookup returns at most one row.
create function public.solmind_find_user_account(
  p_user_account_id uuid
)
returns table (
  user_account_id uuid,
  account_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.user_account_id,
    t.account_status
  from identity.user_account as t
  where t.user_account_id = p_user_account_id;
$$;

revoke all on function public.solmind_find_user_account(uuid) from public;
revoke execute on function public.solmind_find_user_account(uuid) from anon, authenticated;
grant execute on function public.solmind_find_user_account(uuid) to service_role;

comment on function public.solmind_find_user_account(uuid) is
  'Privileged server-only Admin/auth lookup (AUTH-RLS-DEC-026). Reads identity.user_account as owner (deliberate non-forced-RLS bypass); EXECUTE granted to service_role only; decides no authorization, which stays in the app guard layer. Applying FORCE ROW LEVEL SECURITY to identity.user_account would silently break this function and requires a new AUTH-RLS decision first.';

-- Function 3: all active-status sessions for the account. Ambiguity is kept visible: no unique
-- active index exists by design, so all active sessions are returned and the TypeScript session
-- rule applies expiration-wins and denies when more than one valid-active session survives.
-- No LIMIT and no ORDER BY.
create function public.solmind_find_active_user_sessions(
  p_user_account_id uuid
)
returns table (
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
    t.user_account_id,
    t.active_role_context,
    t.session_status,
    t.expires_at
  from identity.user_session as t
  where t.session_status = 'active'
    and t.user_account_id = p_user_account_id;
$$;

revoke all on function public.solmind_find_active_user_sessions(uuid) from public;
revoke execute on function public.solmind_find_active_user_sessions(uuid) from anon, authenticated;
grant execute on function public.solmind_find_active_user_sessions(uuid) to service_role;

comment on function public.solmind_find_active_user_sessions(uuid) is
  'Privileged server-only Admin/auth lookup (AUTH-RLS-DEC-026). Reads identity.user_session as owner (deliberate non-forced-RLS bypass); EXECUTE granted to service_role only; decides no authorization, which stays in the app guard layer. Returns all active sessions (no LIMIT, no expiry pre-filter) so ambiguity stays visible to the app. Applying FORCE ROW LEVEL SECURITY to identity.user_session would silently break this function and requires a new AUTH-RLS decision first.';

-- Function 4: active role assignment matching the session role context. DB partial unique index
-- guarantees at most one active assignment per account and role.
create function public.solmind_find_active_role_assignment(
  p_user_account_id uuid,
  p_role_code text
)
returns table (
  user_account_id uuid,
  role_code text,
  role_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.user_account_id,
    t.role_code,
    t.role_status
  from identity.user_role_assignment as t
  where t.role_status = 'active'
    and t.user_account_id = p_user_account_id
    and t.role_code = p_role_code;
$$;

revoke all on function public.solmind_find_active_role_assignment(uuid, text) from public;
revoke execute on function public.solmind_find_active_role_assignment(uuid, text) from anon, authenticated;
grant execute on function public.solmind_find_active_role_assignment(uuid, text) to service_role;

comment on function public.solmind_find_active_role_assignment(uuid, text) is
  'Privileged server-only Admin/auth lookup (AUTH-RLS-DEC-026). Reads identity.user_role_assignment as owner (deliberate non-forced-RLS bypass); EXECUTE granted to service_role only; decides no authorization, which stays in the app guard layer. Applying FORCE ROW LEVEL SECURITY to identity.user_role_assignment would silently break this function and requires a new AUTH-RLS decision first.';

-- Function 5: optional active guide profile by account. A null profile is not a deny on /admin.
-- At most one non-deleted profile per account (partial unique index).
create function public.solmind_find_guide_profile(
  p_user_account_id uuid
)
returns table (
  guide_profile_id uuid,
  user_account_id uuid,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.guide_profile_id,
    t.user_account_id,
    t.status
  from core.guide_profile as t
  where t.status = 'active'
    and t.user_account_id = p_user_account_id;
$$;

revoke all on function public.solmind_find_guide_profile(uuid) from public;
revoke execute on function public.solmind_find_guide_profile(uuid) from anon, authenticated;
grant execute on function public.solmind_find_guide_profile(uuid) to service_role;

comment on function public.solmind_find_guide_profile(uuid) is
  'Privileged server-only Admin/auth lookup (AUTH-RLS-DEC-026). Reads core.guide_profile as owner (deliberate non-forced-RLS bypass); EXECUTE granted to service_role only; decides no authorization, which stays in the app guard layer. Applying FORCE ROW LEVEL SECURITY to core.guide_profile would silently break this function and requires a new AUTH-RLS decision first.';

-- Function 6: optional active explorer profile by account. A null profile is not a deny on /admin.
-- At most one non-deleted profile per account (partial unique index).
create function public.solmind_find_explorer_profile(
  p_user_account_id uuid
)
returns table (
  explorer_profile_id uuid,
  user_account_id uuid,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.explorer_profile_id,
    t.user_account_id,
    t.status
  from core.explorer_profile as t
  where t.status = 'active'
    and t.user_account_id = p_user_account_id;
$$;

revoke all on function public.solmind_find_explorer_profile(uuid) from public;
revoke execute on function public.solmind_find_explorer_profile(uuid) from anon, authenticated;
grant execute on function public.solmind_find_explorer_profile(uuid) to service_role;

comment on function public.solmind_find_explorer_profile(uuid) is
  'Privileged server-only Admin/auth lookup (AUTH-RLS-DEC-026). Reads core.explorer_profile as owner (deliberate non-forced-RLS bypass); EXECUTE granted to service_role only; decides no authorization, which stays in the app guard layer. Applying FORCE ROW LEVEL SECURITY to core.explorer_profile would silently break this function and requires a new AUTH-RLS decision first.';
