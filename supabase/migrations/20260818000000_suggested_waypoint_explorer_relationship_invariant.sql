-- PRJ01_V-WS05-WI022-S03 forward-only Explorer Suggested Waypoint list
-- relationship-invariant correction.
--
-- A successful empty page now means exactly one authorized active Guide
-- relationship with no delivered suggestions. Zero or multiple active Guide
-- relationships, and any derived authorization failure, raise the same fixed
-- value-free exception. The application maps only this exact function/error
-- pair to its existing privacy-safe unavailable result.

create or replace function public.solmind_list_explorer_suggested_waypoints(
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
  v_relationship_ids uuid[];
  v_relationship_id uuid;
  v_cursor_text text;
  v_cursor_time timestamptz;
  v_cursor_id uuid;
begin
  if p_page_size not in (5, 10, 20, 50, 100) then
    raise exception 'solmind_suggested_waypoint_invalid_page_size';
  end if;

  select pg_catalog.array_agg(
           relationship.guide_explorer_relationship_id
           order by relationship.guide_explorer_relationship_id
         )
    into v_relationship_ids
    from core.guide_explorer_relationship relationship
    join core.explorer_profile explorer
      on explorer.explorer_profile_id = relationship.explorer_profile_id
   where explorer.user_account_id = p_actor_user_account_id
     and relationship.relationship_status = 'active';
  if coalesce(pg_catalog.array_length(v_relationship_ids, 1), 0) <> 1
  then
    raise exception
      'solmind_suggested_waypoint_explorer_relationship_unavailable';
  end if;
  v_relationship_id := v_relationship_ids[1];
  if not content.solmind_suggested_waypoint_explorer_authorized(
    p_actor_user_account_id,
    v_relationship_id
  ) then
    raise exception
      'solmind_suggested_waypoint_explorer_relationship_unavailable';
  end if;

  if p_cursor is not null then
    begin
      v_cursor_text := pg_catalog.convert_from(
        pg_catalog.decode(p_cursor, 'base64'),
        'UTF8'
      );
      v_cursor_time := pg_catalog.split_part(v_cursor_text, '|', 1)::timestamptz;
      v_cursor_id := pg_catalog.split_part(v_cursor_text, '|', 2)::uuid;
      if pg_catalog.split_part(v_cursor_text, '|', 3) <> '' then
        raise exception 'invalid';
      end if;
    exception when others then
      raise exception 'solmind_suggested_waypoint_invalid_cursor';
    end;
    if not exists (
      select 1
        from content.suggested_waypoint owner_row
        join content.suggested_waypoint_version version
          on version.suggested_waypoint_version_id =
             owner_row.current_version_id
       where owner_row.suggested_waypoint_id = v_cursor_id
         and owner_row.guide_explorer_relationship_id = v_relationship_id
         and owner_row.authoring_mode = 'delivered'
         and version.delivered_at = v_cursor_time
    ) then
      raise exception 'solmind_suggested_waypoint_invalid_cursor';
    end if;
  end if;

  return query
  with authorized as (
    select owner_row.suggested_waypoint_id,
           version.suggested_waypoint_version_id as current_version_id,
           version.destination as destination_preview,
           version.delivered_at as received_at,
           (read_state.suggested_waypoint_version_id is not null) as read,
           (receipt.suggested_waypoint_version_id is not null) as
             receipt_acknowledged,
           receipt.acknowledged_at,
           'open'::text as channel_category
      from content.suggested_waypoint owner_row
      join content.suggested_waypoint_version version
        on version.suggested_waypoint_version_id = owner_row.current_version_id
      left join content.suggested_waypoint_explorer_read_state read_state
        on read_state.suggested_waypoint_version_id = owner_row.current_version_id
       and read_state.explorer_profile_id = owner_row.explorer_profile_id
      left join content.suggested_waypoint_receipt receipt
        on receipt.suggested_waypoint_version_id = owner_row.current_version_id
       and receipt.explorer_profile_id = owner_row.explorer_profile_id
     where owner_row.guide_explorer_relationship_id = v_relationship_id
       and owner_row.authoring_mode = 'delivered'
  ), page_plus_one as (
    select authorized.*
      from authorized
     where p_cursor is null
        or (authorized.received_at, authorized.suggested_waypoint_id) <
           (v_cursor_time, v_cursor_id)
     order by authorized.received_at desc,
              authorized.suggested_waypoint_id desc
     limit p_page_size + 1
  ), page as (
    select page_plus_one.*
      from page_plus_one
     order by page_plus_one.received_at desc,
              page_plus_one.suggested_waypoint_id desc
     limit p_page_size
  ), last_row as (
    select page.received_at, page.suggested_waypoint_id
      from page
     order by page.received_at, page.suggested_waypoint_id
     limit 1
  )
  select coalesce(
           (
             select pg_catalog.jsonb_agg(
               pg_catalog.jsonb_build_object(
                 'suggested_waypoint_id', page.suggested_waypoint_id,
                 'current_version_id', page.current_version_id,
                 'destination_preview', page.destination_preview,
                 'received_at', page.received_at,
                 'read', page.read,
                 'receipt_acknowledged', page.receipt_acknowledged,
                 'acknowledged_at', page.acknowledged_at,
                 'channel_category', page.channel_category
               ) order by page.received_at desc,
                          page.suggested_waypoint_id desc
             ) from page
           ),
           '[]'::jsonb
         ),
         case when (select pg_catalog.count(*) from page_plus_one) > p_page_size
           then (
             select pg_catalog.encode(
               pg_catalog.convert_to(
                 last_row.received_at::text || '|' ||
                   last_row.suggested_waypoint_id::text,
                 'UTF8'
               ),
               'base64'
             ) from last_row
           )
           else null::text
         end,
         (select pg_catalog.count(*)::bigint from authorized);
end;
$$;

alter function public.solmind_list_explorer_suggested_waypoints(
  uuid, integer, text
) owner to postgres;
revoke all on function public.solmind_list_explorer_suggested_waypoints(
  uuid, integer, text
) from public, anon, authenticated;
grant execute on function public.solmind_list_explorer_suggested_waypoints(
  uuid, integer, text
) to service_role;
