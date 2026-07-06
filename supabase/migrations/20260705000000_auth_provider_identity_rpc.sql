-- SolMind MVP0 Auth/RLS Option B - enumerated privileged Admin/auth RPC foundation (single-function proof).
-- Source contract: execution/19_SolMind_MVP0_Auth_RLS_RPC_Function_Contract_v0_1.md (Section 8 function 1; Sections 7, 9, 14).
-- Banked decision: AUTH-RLS-DEC-026.
-- Scope:
--   - create public.solmind_find_auth_provider_identity(text, text), the first enumerated
--     server-only Admin/auth lookup function (single-function proof).
--   - apply least-privilege EXECUTE: revoke from PUBLIC, anon, authenticated; grant to service_role only.
--   - document the owner-bypass rationale and the FORCE ROW LEVEL SECURITY standing invariant.
-- This migration creates one privileged lookup function with a service_role-only EXECUTE grant.
-- It creates no tables, no RLS policies, no users, no seed or pilot data, no additional grants,
-- and no Data API schema-exposure change (identity/core stay hidden; exposed schemas remain
-- public, graphql_public).

create function public.solmind_find_auth_provider_identity(
  p_provider_name text,
  p_provider_user_id text
)
returns table (
  user_account_id uuid,
  provider_name text,
  provider_user_id text,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.user_account_id,
    t.provider_name,
    t.provider_user_id,
    t.status
  from identity.auth_provider_identity as t
  where t.status = 'active'
    and t.provider_name = p_provider_name
    and t.provider_user_id = p_provider_user_id;
$$;

revoke all on function public.solmind_find_auth_provider_identity(text, text) from public;
revoke execute on function public.solmind_find_auth_provider_identity(text, text) from anon, authenticated;
grant execute on function public.solmind_find_auth_provider_identity(text, text) to service_role;

comment on function public.solmind_find_auth_provider_identity(text, text) is
  'Privileged server-only Admin/auth lookup (AUTH-RLS-DEC-026). Reads identity.auth_provider_identity as owner (deliberate non-forced-RLS bypass); EXECUTE granted to service_role only; decides no authorization, which stays in the app guard layer. Applying FORCE ROW LEVEL SECURITY to identity.auth_provider_identity would silently break this function and requires a new AUTH-RLS decision first.';
