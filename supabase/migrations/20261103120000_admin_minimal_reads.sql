-- PRJ01_R-WS03-WI014 minimal functional Admin screens: four Admin read functions, read only.
-- Paul's decisions (decision queue 2026-11-03): 11:23:03 and 11:52:57 (keep the Admin screens minimal, only
-- as needed for testing; they may be thrown away), 11:56:14 ("Yes, build it": Dashboard, Guides and
-- Explorers, AI use and pauses, Settings; reuse the existing Admin sign-in and server checks) and 12:19:09
-- (activity by sign-ins only: never conversation content, message dates or message counts; AI costs are a
-- future sprint). Each function rechecks that the server-derived actor is an active account with an active
-- admin role, as public.solmind_read_admin_assistant_display_name_settings does, and raises the one closed
-- error solmind_admin_required otherwise.
-- "Paused now" is the AI-use gate's own decision (revised 2026-11-03 after review REV219): the reads call
-- ai.solmind_explorer_ai_use_gate_v1 in 'read' mode, which writes nothing and takes no lock, at now() with no
-- conversation, for every account with a non-deleted Explorer profile. The Dashboard count and the AI-use
-- list use its individual decision (paused by the account's own daily limit), which includes a pause that
-- no stop row records, for example after the limit was lowered: a Send is normally refused at the pause read
-- before any stop is recorded (revised 2026-11-03 after review REV219b), so there is no stop to lift; that
-- pause ends at midnight, Chicago time, or when the limit is raised above the account's counted Sends that
-- day. The People read uses the gate's whole decision: paused by the
-- Explorer's own limit, or only by today's shared pause. The AI-use list also keeps one row per recorded
-- unlifted individual stop that the gate counts as a pause (every one except a first stop of a day while the
-- account is in crisis or urgent handling, which the gate treats as no pause because the next Send lifts it
-- automatically), and today's shared stop. The lift and the setting change reuse the existing service-role
-- writers unchanged.
-- No table, grant on a table, change to an existing function, write, or message, conversation, session-title
-- or AI-session column is added.
begin;

-- Dashboard counts: Guides and Explorers (profiles not deleted), Explorers with a non-deleted Explorer
-- profile who signed in during the last 7 days (from their Explorer sign-in sessions;
-- identity.user_account.last_login_at is never written), and the accounts with a non-deleted Explorer
-- profile that the AI-use gate pauses now by their own daily limit (the shared stop is shown on the AI-use
-- read).
create function public.solmind_read_admin_overview_v1(p_actor_user_account_id uuid)
returns table(guide_count integer,explorer_count integer,explorers_signed_in_last_7_days integer,
  accounts_paused_now integer)
language plpgsql stable security definer set search_path='' as $$
begin
  if p_actor_user_account_id is null or not exists(select 1 from identity.user_account a
      where a.user_account_id=p_actor_user_account_id and a.account_status='active'
        and exists(select 1 from identity.user_role_assignment r where r.user_account_id=a.user_account_id
          and r.role_code='admin' and r.role_status='active'))
    then raise exception 'solmind_admin_required'; end if;
  return query select
    (select count(*)::integer from core.guide_profile g where g.status<>'deleted'),
    (select count(*)::integer from core.explorer_profile e where e.status<>'deleted'),
    (select count(distinct s.user_account_id)::integer from identity.user_session s
      where s.active_role_context='explorer' and s.created_at>=now()-interval '7 days'
        and exists(select 1 from core.explorer_profile e where e.user_account_id=s.user_account_id
          and e.status<>'deleted')),
    (select count(*)::integer from core.explorer_profile e where e.status<>'deleted'
      and (ai.solmind_explorer_ai_use_gate_v1(e.user_account_id,null,now(),'read')->>'individual')='review');
end $$;

-- Guides and Explorers: one row per Guide and Explorer relationship, and one row for a Guide with none.
-- Names, the relationship status, the Explorer's last sign-in (Explorer sign-in sessions only) and the
-- AI-use gate's whole decision for the Explorer now: own_limit (paused by their own daily limit, whether or
-- not today's shared pause also applies), shared (only today's shared pause applies) or none.
-- guide_profile_id only groups the rows on the server.
create function public.solmind_read_admin_people_v1(p_actor_user_account_id uuid)
returns table(guide_profile_id uuid,guide_name text,explorer_name text,relationship_status text,
  explorer_last_sign_in_at timestamptz,explorer_pause text)
language plpgsql stable security definer set search_path='' as $$
begin
  if p_actor_user_account_id is null or not exists(select 1 from identity.user_account a
      where a.user_account_id=p_actor_user_account_id and a.account_status='active'
        and exists(select 1 from identity.user_role_assignment r where r.user_account_id=a.user_account_id
          and r.role_code='admin' and r.role_status='active'))
    then raise exception 'solmind_admin_required'; end if;
  return query
  select g.guide_profile_id,g.guide_display_name,e.explorer_display_name,
    case when e.explorer_profile_id is null then null else r.relationship_status end,
    (select max(s.created_at) from identity.user_session s
      where e.explorer_profile_id is not null and s.user_account_id=e.user_account_id
        and s.active_role_context='explorer'),
    case when e.explorer_profile_id is null then null else
      (select case when q.decision->>'individual'='review' then 'own_limit'
          when (q.decision->>'shared')::boolean then 'shared' else 'none' end
        from (select ai.solmind_explorer_ai_use_gate_v1(e.user_account_id,null,now(),'read') as decision) q) end
  from core.guide_profile g
  left join (core.guide_explorer_relationship r
    join core.explorer_profile e on e.explorer_profile_id=r.explorer_profile_id and e.status<>'deleted')
    on r.guide_profile_id=g.guide_profile_id
  where g.status<>'deleted'
  order by g.guide_display_name,g.guide_profile_id,e.explorer_display_name,r.guide_explorer_relationship_id;
end $$;

-- AI use and pauses: the pauses in force now. One row per recorded unlifted individual stop that the gate
-- counts as a pause (stop_kind individual), with the Explorer's name, the stop, its day, when it was reached,
-- that day's total, the limit and whether the account was in crisis or urgent handling when the stop was
-- reached (a status only). One row for each account with a non-deleted Explorer profile that the gate pauses
-- by its own daily limit but that has no such row (stop_kind individual_unrecorded: no stop, no reached time
-- and no crisis status, so nothing to lift; a Send is normally refused at the pause read before any stop is
-- recorded, and the pause ends at midnight, Chicago time, or when the limit is raised above today's counted
-- Sends; the day is today, the total is today's counted Sends and the limit is the current setting). Plus
-- today's shared stop, if any (no name and no crisis status). Never conversation words, a conversation
-- reference, or safety or crisis counts.
create function public.solmind_read_admin_ai_use_pauses_v1(p_actor_user_account_id uuid)
returns table(stop_id uuid,stop_kind text,explorer_name text,stop_day date,reached_at timestamptz,
  day_total integer,limit_value bigint,account_in_crisis boolean)
language plpgsql stable security definer set search_path='' as $$
declare v_today date; v_start timestamptz; v_next timestamptz; v_limit integer;
begin
  if p_actor_user_account_id is null or not exists(select 1 from identity.user_account a
      where a.user_account_id=p_actor_user_account_id and a.account_status='active'
        and exists(select 1 from identity.user_role_assignment r where r.user_account_id=a.user_account_id
          and r.role_code='admin' and r.role_status='active'))
    then raise exception 'solmind_admin_required'; end if;
  select d.stop_day,d.day_start,d.next_day_start into v_today,v_start,v_next from ai.solmind_explorer_ai_use_day_v1(now()) d;
  select s.integer_value into v_limit from core.application_setting s
    where s.setting_key='explorer_ai_use_individual_daily_call_limit';
  return query
  select p.stop_id,p.stop_kind,p.explorer_name,p.stop_day,p.reached_at,p.day_total,p.limit_value,p.account_in_crisis
  from (
    select x.stop_id,x.stop_kind,
      case when x.stop_kind='individual' then coalesce(
        (select e.explorer_display_name from core.explorer_profile e
          where e.user_account_id=x.actor_user_account_id and e.status<>'deleted'
          order by e.created_at,e.explorer_profile_id limit 1),
        (select a.display_name from identity.user_account a where a.user_account_id=x.actor_user_account_id)) end
        as explorer_name,
      x.stop_day,x.reached_at,x.day_total,x.limit_value,x.account_in_crisis,
      case when x.stop_kind='shared' then 3 else 1 end as sort_group,null::text as sort_name,null::uuid as sort_id
    from ai.explorer_ai_use_stop x
    where (x.stop_kind='individual' and x.lifted_at is null
        and not (x.day_stop_number=1 and exists(select 1 from ai.explorer_conversation_state c
          where c.actor_user_account_id=x.actor_user_account_id and c.restricted_level is not null)))
      or (x.stop_kind='shared' and x.stop_day=v_today)
    union all
    select null::uuid,'individual_unrecorded'::text,e.explorer_display_name,v_today,null::timestamptz,
      (select count(*)::integer from ai.explorer_conversation_operation o
        where o.actor_user_account_id=e.user_account_id and o.kind='send' and o.created_at>=v_start
          and o.created_at<v_next),
      v_limit::bigint,null::boolean,2,e.explorer_display_name,e.explorer_profile_id
    from core.explorer_profile e
    where e.status<>'deleted'
      and not exists(select 1 from ai.explorer_ai_use_stop x
        where x.stop_kind='individual' and x.actor_user_account_id=e.user_account_id and x.lifted_at is null
          and not (x.day_stop_number=1 and exists(select 1 from ai.explorer_conversation_state c
            where c.actor_user_account_id=x.actor_user_account_id and c.restricted_level is not null)))
      and (ai.solmind_explorer_ai_use_gate_v1(e.user_account_id,null,now(),'read')->>'individual')='review'
  ) p
  order by p.sort_group,p.reached_at,p.sort_name,p.sort_id,p.stop_id;
end $$;

-- Settings: the six protected settings with their value, range, default and version (the version is the
-- expected version a change through public.solmind_set_application_setting_integer must pass).
create function public.solmind_read_admin_application_settings_v1(p_actor_user_account_id uuid)
returns table(setting_key text,integer_value integer,minimum_integer_value integer,default_integer_value integer,
  maximum_integer_value integer,version bigint)
language plpgsql stable security definer set search_path='' as $$
begin
  if p_actor_user_account_id is null or not exists(select 1 from identity.user_account a
      where a.user_account_id=p_actor_user_account_id and a.account_status='active'
        and exists(select 1 from identity.user_role_assignment r where r.user_account_id=a.user_account_id
          and r.role_code='admin' and r.role_status='active'))
    then raise exception 'solmind_admin_required'; end if;
  return query
  select s.setting_key,s.integer_value,s.minimum_integer_value,s.default_integer_value,s.maximum_integer_value,s.version
    from core.application_setting s
   order by s.setting_key;
end $$;

alter function public.solmind_read_admin_overview_v1(uuid) owner to postgres;
alter function public.solmind_read_admin_people_v1(uuid) owner to postgres;
alter function public.solmind_read_admin_ai_use_pauses_v1(uuid) owner to postgres;
alter function public.solmind_read_admin_application_settings_v1(uuid) owner to postgres;
revoke all on function public.solmind_read_admin_overview_v1(uuid) from public,anon,authenticated,service_role;
revoke all on function public.solmind_read_admin_people_v1(uuid) from public,anon,authenticated,service_role;
revoke all on function public.solmind_read_admin_ai_use_pauses_v1(uuid) from public,anon,authenticated,service_role;
revoke all on function public.solmind_read_admin_application_settings_v1(uuid) from public,anon,authenticated,service_role;
grant execute on function public.solmind_read_admin_overview_v1(uuid) to service_role;
grant execute on function public.solmind_read_admin_people_v1(uuid) to service_role;
grant execute on function public.solmind_read_admin_ai_use_pauses_v1(uuid) to service_role;
grant execute on function public.solmind_read_admin_application_settings_v1(uuid) to service_role;
comment on function public.solmind_read_admin_overview_v1(uuid) is
  'Server-only Admin Dashboard read (minimal Admin screens, decision queue 2026-11-03 11:56:14 and 12:19:09). Rechecks the server-derived actor as an active Admin, else solmind_admin_required. One row: Guides and Explorers (profiles not deleted), Explorers with a non-deleted profile who signed in during the last 7 days (Explorer sign-in sessions only), and the accounts with a non-deleted Explorer profile that ai.solmind_explorer_ai_use_gate_v1, called in read mode, pauses now by their own daily limit, including a pause no stop row records. No message, conversation or AI-session data.';
comment on function public.solmind_read_admin_people_v1(uuid) is
  'Server-only Admin read of each Guide and their Explorers (minimal Admin screens, decision queue 2026-11-03 11:56:14 and 12:19:09: sign-ins only). Rechecks the server-derived actor as an active Admin, else solmind_admin_required. Names, relationship status, the Explorer''s last sign-in time and the whole decision of ai.solmind_explorer_ai_use_gate_v1, called in read mode: own_limit, shared (only today''s shared pause) or none; never conversation content, message dates or message counts.';
comment on function public.solmind_read_admin_ai_use_pauses_v1(uuid) is
  'Server-only Admin read of the AI-use pauses in force now (minimal Admin screens, decision queue 2026-11-03 11:56:14). Rechecks the server-derived actor as an active Admin, else solmind_admin_required. Each recorded unlifted individual stop that ai.solmind_explorer_ai_use_gate_v1 counts as a pause (a crisis account''s first stop of a day is no pause), with the Explorer''s name, stop, day, time, day total, limit and the crisis or urgent status recorded at the stop; an individual_unrecorded row, with no stop, time or crisis status, for each Explorer the gate, called in read mode, pauses by their own limit with no such stop (no stop to lift: a Send is normally refused before any stop is recorded, so the pause ends at midnight, Chicago time, or when the limit is raised above that day''s calls); and today''s shared stop. Never conversation words, a conversation reference, or safety or crisis counts.';
comment on function public.solmind_read_admin_application_settings_v1(uuid) is
  'Server-only Admin read of the six protected application settings (minimal Admin screens, decision queue 2026-11-03 11:56:14). Rechecks the server-derived actor as an active Admin, else solmind_admin_required. Key, value, minimum, default, maximum and version; changes still go through public.solmind_set_application_setting_integer.';

commit;
