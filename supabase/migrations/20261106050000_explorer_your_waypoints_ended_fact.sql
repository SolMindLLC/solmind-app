-- The private Your Waypoints section (execution/07 item 43): each current-head page row says whether its own source
-- conversation has ended, so a Waypoint from an ended conversation in an earlier Guide relationship can be told apart
-- from one in the open conversation (the ended-conversation list covers only the current relationship). The fact is
-- read from the row's own source session, the same test the post-End closure applies (status ended with an end time).
-- History pages and closure results are unchanged. Signature, owner, settings and privileges are unchanged.
begin;

create or replace function ai.solmind_waypoint_page_v1(p_actor uuid,p_conversation uuid,p_offset integer,p_heads boolean)
returns jsonb language sql stable security definer set search_path='' as $$
  with page as (
    select w.*,row_number() over(order by
      case when p_heads and w.lifecycle_status='chosen' and w.released_at is null and c.waypoint_id is null then 0 else 1 end,
      w.created_at desc,w.waypoint_id) as ordinal
    from content.waypoint w left join content.waypoint_post_end_closure c on c.waypoint_id=w.waypoint_id
    where w.chosen_by_explorer_user_account_id=p_actor
      and (p_conversation is null or w.source_ai_interaction_session_id=p_conversation)
      and (not p_heads or not exists(select 1 from content.waypoint s where s.predecessor_waypoint_id=w.waypoint_id))
      and ai.solmind_waypoint_source_owned_v1(p_actor,w.waypoint_id)
    order by ordinal offset p_offset limit 21
  ) select jsonb_build_object('kind',case when p_heads then 'current_heads' else 'history' end,'limit',20,
    'items',coalesce((select jsonb_agg(ai.solmind_waypoint_row_json_v1(p.waypoint_id,true)
      ||jsonb_build_object('conversationId',p.source_ai_interaction_session_id)
      ||case when p_heads then jsonb_build_object('conversationEnded',exists(select 1 from ai.ai_interaction_session s
        where s.ai_interaction_session_id=p.source_ai_interaction_session_id and s.session_status='ended'
          and s.ended_at is not null)) else '{}'::jsonb end order by p.ordinal)
      from page p where p.ordinal<=p_offset+20),'[]'::jsonb),
    'hasMore',(select count(*)>20 from page),
    'nextOffset',case when (select count(*)>20 from page) then p_offset+20 else null end)
$$;
alter function ai.solmind_waypoint_page_v1(uuid,uuid,integer,boolean) owner to postgres;
revoke all on function ai.solmind_waypoint_page_v1(uuid,uuid,integer,boolean) from public,anon,authenticated,service_role;

commit;
