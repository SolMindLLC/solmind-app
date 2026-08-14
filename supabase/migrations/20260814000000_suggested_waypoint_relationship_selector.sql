-- PRJ01_V-WS05-WI022-S03 Suggested Waypoint relationship selector.
--
-- This is a feature-specific active-relationship projection. It is not the
-- canonical Guide Explorer roster and intentionally exposes no Practice,
-- onboarding, appointment, Shared Snapshot, suggestion-count, contact, or
-- private Explorer data.

create index if not exists
  guide_explorer_relationship_suggested_waypoint_selector_idx
  on core.guide_explorer_relationship (
    guide_profile_id,
    relationship_status,
    created_at desc,
    guide_explorer_relationship_id desc
  );

create function public.solmind_list_guide_suggested_waypoint_relationships(
  p_actor_user_account_id uuid,
  p_page_size integer,
  p_cursor text default null
)
returns table (
  items jsonb,
  next_cursor text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_guide_profile_id uuid;
  v_guide_profile_count integer;
  v_cursor_text text;
  v_cursor_time timestamptz;
  v_cursor_id uuid;
begin
  if p_page_size not in (5, 10, 20, 50, 100) then
    raise exception
      'solmind_suggested_waypoint_relationship_selector_invalid_page_size';
  end if;

  select (pg_catalog.array_agg(
            guide.guide_profile_id order by guide.guide_profile_id
          ))[1],
         pg_catalog.count(distinct guide.guide_profile_id)::integer
    into v_guide_profile_id, v_guide_profile_count
    from core.guide_profile guide
    join identity.user_account account
      on account.user_account_id = guide.user_account_id
   where guide.user_account_id = p_actor_user_account_id
     and guide.status = 'active'
     and account.account_status = 'active'
     and exists (
       select 1
         from identity.user_role_assignment assignment
        where assignment.user_account_id = p_actor_user_account_id
          and assignment.role_code = 'guide'
          and assignment.role_status = 'active'
     );

  if v_guide_profile_count <> 1 or v_guide_profile_id is null then
    return query select '[]'::jsonb, null::text, 0::bigint;
    return;
  end if;

  if p_cursor is not null then
    begin
      v_cursor_text := pg_catalog.convert_from(
        pg_catalog.decode(p_cursor, 'base64'),
        'UTF8'
      );
      if
        pg_catalog.length(v_cursor_text) -
        pg_catalog.length(pg_catalog.replace(v_cursor_text, '|', '')) <> 1
      then
        raise exception 'invalid';
      end if;
      v_cursor_time :=
        pg_catalog.split_part(v_cursor_text, '|', 1)::timestamptz;
      v_cursor_id := pg_catalog.split_part(v_cursor_text, '|', 2)::uuid;
    exception when others then
      raise exception
        'solmind_suggested_waypoint_relationship_selector_invalid_cursor';
    end;

    if not exists (
      select 1
        from core.guide_explorer_relationship relationship
        join core.explorer_profile explorer
          on explorer.explorer_profile_id = relationship.explorer_profile_id
        join identity.user_account explorer_account
          on explorer_account.user_account_id = explorer.user_account_id
       where relationship.guide_explorer_relationship_id = v_cursor_id
         and relationship.guide_profile_id = v_guide_profile_id
         and relationship.relationship_status = 'active'
         and relationship.created_at = v_cursor_time
         and explorer.status = 'active'
         and explorer_account.account_status = 'active'
         and exists (
           select 1
             from identity.user_role_assignment assignment
            where assignment.user_account_id = explorer.user_account_id
              and assignment.role_code = 'explorer'
              and assignment.role_status = 'active'
         )
    ) then
      raise exception
        'solmind_suggested_waypoint_relationship_selector_invalid_cursor';
    end if;
  end if;

  return query
  with authorized as (
    select relationship.guide_explorer_relationship_id,
           explorer.explorer_display_name,
           relationship.created_at as relationship_created_at
      from core.guide_explorer_relationship relationship
      join core.explorer_profile explorer
        on explorer.explorer_profile_id = relationship.explorer_profile_id
      join identity.user_account explorer_account
        on explorer_account.user_account_id = explorer.user_account_id
     where relationship.guide_profile_id = v_guide_profile_id
       and relationship.relationship_status = 'active'
       and explorer.status = 'active'
       and explorer_account.account_status = 'active'
       and exists (
         select 1
           from identity.user_role_assignment assignment
          where assignment.user_account_id = explorer.user_account_id
            and assignment.role_code = 'explorer'
            and assignment.role_status = 'active'
       )
  ), page_plus_one as (
    select authorized.*
      from authorized
     where p_cursor is null
        or (
             authorized.relationship_created_at,
             authorized.guide_explorer_relationship_id
           ) < (v_cursor_time, v_cursor_id)
     order by authorized.relationship_created_at desc,
              authorized.guide_explorer_relationship_id desc
     limit p_page_size + 1
  ), page as (
    select page_plus_one.*
      from page_plus_one
     order by page_plus_one.relationship_created_at desc,
              page_plus_one.guide_explorer_relationship_id desc
     limit p_page_size
  ), last_row as (
    select page.relationship_created_at,
           page.guide_explorer_relationship_id
      from page
     order by page.relationship_created_at,
              page.guide_explorer_relationship_id
     limit 1
  )
  select coalesce(
           (
             select pg_catalog.jsonb_agg(
               pg_catalog.jsonb_build_object(
                 'guide_explorer_relationship_id',
                   page.guide_explorer_relationship_id,
                 'explorer_display_name', page.explorer_display_name,
                 'relationship_created_at', page.relationship_created_at
               ) order by page.relationship_created_at desc,
                          page.guide_explorer_relationship_id desc
             )
               from page
           ),
           '[]'::jsonb
         ),
         case
           when (select pg_catalog.count(*) from page_plus_one) > p_page_size
           then (
             select pg_catalog.encode(
               pg_catalog.convert_to(
                 last_row.relationship_created_at::text || '|' ||
                   last_row.guide_explorer_relationship_id::text,
                 'UTF8'
               ),
               'base64'
             )
               from last_row
           )
           else null::text
         end,
         (select pg_catalog.count(*)::bigint from authorized);
end;
$$;

alter function public.solmind_list_guide_suggested_waypoint_relationships(
  uuid, integer, text
) owner to postgres;

revoke all on function
  public.solmind_list_guide_suggested_waypoint_relationships(
    uuid, integer, text
  ) from public, anon, authenticated;

grant execute on function
  public.solmind_list_guide_suggested_waypoint_relationships(
    uuid, integer, text
  ) to service_role;

comment on function
  public.solmind_list_guide_suggested_waypoint_relationships(
    uuid, integer, text
  ) is
  'Feature-specific active relationship selector for Guide Suggested Waypoints; not the canonical Guide Explorer roster.';
