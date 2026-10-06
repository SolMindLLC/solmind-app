-- PRJ01_V-WS05-WI022-S03 exact Guide relationship lookup required by the
-- server-side Suggested Waypoint request composition.
--
-- This is one closed service-role-only lookup. It does not authorize the
-- relationship, choose a role, or replace the app-layer active relationship
-- check. SECURITY DEFINER intentionally bypasses table RLS for this exact
-- four-column by-ID projection; the empty search_path, fixed object names,
-- closed grant, and application revalidation preserve the least-capability
-- boundary.

create function public.solmind_find_guide_explorer_relationship(
  p_guide_explorer_relationship_id uuid
)
returns table (
  guide_explorer_relationship_id uuid,
  guide_profile_id uuid,
  explorer_profile_id uuid,
  relationship_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select relationship.guide_explorer_relationship_id,
         relationship.guide_profile_id,
         relationship.explorer_profile_id,
         relationship.relationship_status
    from core.guide_explorer_relationship relationship
   where relationship.guide_explorer_relationship_id =
         p_guide_explorer_relationship_id;
$$;

alter function public.solmind_find_guide_explorer_relationship(uuid)
  owner to postgres;

revoke all on function
  public.solmind_find_guide_explorer_relationship(uuid)
  from public, anon, authenticated;

grant execute on function
  public.solmind_find_guide_explorer_relationship(uuid)
  to service_role;

comment on function public.solmind_find_guide_explorer_relationship(uuid) is
  'Exact service-role-only Guide relationship projection. SECURITY DEFINER deliberately uses the postgres owner bypass of non-forced RLS; applying FORCE ROW LEVEL SECURITY would break this lookup and requires a new AUTH-RLS decision. This function is not an authorization decision; the server app must revalidate Guide ownership and active status.';
