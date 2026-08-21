begin;

drop function public.solmind_get_guide_suggested_waypoint(uuid, uuid, uuid);

create function public.solmind_get_guide_suggested_waypoint(
  p_actor_user_account_id uuid,
  p_guide_explorer_relationship_id uuid,
  p_suggested_waypoint_id uuid
)
returns table (
  suggested_waypoint_id uuid,
  authoring_mode text,
  authoring_revision bigint,
  destination_preview text,
  pending_deadline_at timestamptz,
  pull_back_available boolean,
  channel_category text,
  current_version_id uuid,
  pending_version_id uuid,
  delivered_at timestamptz,
  acknowledged_version_id uuid,
  acknowledged_at timestamptz,
  draft_or_pending_destination text,
  draft_or_pending_why text,
  draft_or_pending_arrival_signals jsonb,
  delivered_destination text,
  delivered_why text,
  delivered_arrival_signals jsonb,
  policy_key text,
  policy_version bigint,
  effective_seconds integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not content.solmind_suggested_waypoint_guide_authorized(
    p_actor_user_account_id,
    p_guide_explorer_relationship_id
  ) then
    return;
  end if;
  return query
  select owner_row.suggested_waypoint_id,
         owner_row.authoring_mode,
         owner_row.authoring_revision,
         coalesce(
           draft.destination,
           pending.destination,
           version.destination
         ),
         pending.deadline_at,
         (
           pending.deadline_at is not null
           and pg_catalog.transaction_timestamp() < pending.deadline_at
         ),
         case
           when owner_row.authoring_mode = 'draft' then 'not_delivered'
           when owner_row.authoring_mode = 'pending' then 'pending'
           else 'open'
         end,
         owner_row.current_version_id,
         pending.pending_version_id,
         version.delivered_at,
         receipt.suggested_waypoint_version_id,
         receipt.acknowledged_at,
         coalesce(draft.destination, pending.destination),
         coalesce(draft.why, pending.why),
         coalesce(draft.arrival_signals, pending.arrival_signals),
         version.destination,
         version.why,
         version.arrival_signals,
         pending.policy_key,
         pending.policy_version,
         pending.effective_seconds
    from content.suggested_waypoint owner_row
    left join content.suggested_waypoint_guide_draft draft
      on draft.suggested_waypoint_id = owner_row.suggested_waypoint_id
    left join content.suggested_waypoint_pending_outbound pending
      on pending.suggested_waypoint_id = owner_row.suggested_waypoint_id
    left join content.suggested_waypoint_version version
      on version.suggested_waypoint_version_id = owner_row.current_version_id
    left join content.suggested_waypoint_receipt receipt
      on receipt.suggested_waypoint_version_id = owner_row.current_version_id
     and receipt.explorer_profile_id = owner_row.explorer_profile_id
   where owner_row.guide_explorer_relationship_id =
         p_guide_explorer_relationship_id
     and owner_row.suggested_waypoint_id = p_suggested_waypoint_id;
end;
$$;

alter function public.solmind_get_guide_suggested_waypoint(uuid, uuid, uuid)
  owner to postgres;
revoke all on function public.solmind_get_guide_suggested_waypoint(
  uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.solmind_get_guide_suggested_waypoint(
  uuid, uuid, uuid
) to service_role;

comment on function public.solmind_get_guide_suggested_waypoint(
  uuid, uuid, uuid
) is 'Guide-only Suggested Waypoint detail, including the opaque pending version selector needed for an exact Pull Back request.';

commit;
