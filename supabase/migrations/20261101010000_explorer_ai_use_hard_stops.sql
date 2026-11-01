-- PRJ01_R-WS09-WI021 product-limits slice 2a: database hard stops for Explorer AI use.
-- Paul's decisions (decision queue): 2026-10-31 12:45:13, 12:54:01, 13:00:54, 13:02:50, 13:03:49, 14:17:30,
-- and 2026-11-01 00:32:35 to 01:07:27 and 12:00:53 to 13:26:32. Local databases only (00:32:35). Each Send
-- prepared to go to the AI counts once (00:36:15); the day is the America/Chicago calendar day (00:37:30).
-- The individual stop (500 a day) pauses that Explorer until Paul lifts it (00:42:50); a same-day lift gives
-- a fresh individual allowance (00:57:31). An account in crisis or urgent handling (any of its conversations
-- at restricted level 3 or 4) gets one automatic lift of its first stop of a day; a second stop that day is
-- treated as likely misuse and waits for Paul (12:27:07). An account not in crisis gets an automatic lift of
-- its first stop of a day within two settings, 1 a week and 2 a month to start (13:20:16, 13:22:56); a
-- crisis message at a first-stop pause can give the account crisis status (13:24:41). The shared stop (300
-- per active Explorer, with the active Explorers counted at the day's first counted Send) pauses everyone
-- and lifts at midnight (00:47:23, 00:58:42, 12:00:53). Stop records hold the Question 8 facts (01:00:16)
-- plus whether the account was in crisis or urgent handling and how a lift was made (12:27:07: the status
-- is not private, its cause is); they never hold conversation words, a conversation reference, or safety or
-- crisis counts. No provider call, user, policy, backfill, browser grant, scheduler or app caller is added.
begin;

-- Settings: four more keys in the closed protected family. Existing rows, bounds and functions are unchanged
-- except the writer's allowlist. The reader keeps its two keys (no caller needs the new ones).
alter table core.application_setting
  drop constraint application_setting_closed_identity_key_check,
  drop constraint application_setting_closed_integer_bounds_check;
alter table core.application_setting
  add constraint application_setting_closed_identity_key_check
    check (
      (application_setting_id='a30f0210-0000-4000-8000-000000000001'::uuid
        and setting_key='explorer_shared_snapshot_sendability_days')
      or (application_setting_id='a30f0220-0000-4000-8000-000000000001'::uuid
        and setting_key='suggested_waypoint_send_grace_seconds')
      or (application_setting_id='a30f0230-0000-4000-8000-000000000001'::uuid
        and setting_key='explorer_ai_use_individual_daily_call_limit')
      or (application_setting_id='a30f0240-0000-4000-8000-000000000001'::uuid
        and setting_key='explorer_ai_use_shared_daily_calls_per_active_explorer')
      or (application_setting_id='a30f0250-0000-4000-8000-000000000001'::uuid
        and setting_key='explorer_ai_use_automatic_lifts_per_week')
      or (application_setting_id='a30f0260-0000-4000-8000-000000000001'::uuid
        and setting_key='explorer_ai_use_automatic_lifts_per_month')
    ),
  add constraint application_setting_closed_integer_bounds_check
    check (
      (setting_key='explorer_shared_snapshot_sendability_days'
        and minimum_integer_value=1 and default_integer_value=7 and maximum_integer_value=100)
      or (setting_key='suggested_waypoint_send_grace_seconds'
        and minimum_integer_value=60 and default_integer_value=300 and maximum_integer_value=3600)
      or (setting_key='explorer_ai_use_individual_daily_call_limit'
        and minimum_integer_value=1 and default_integer_value=500 and maximum_integer_value=2000)
      or (setting_key='explorer_ai_use_shared_daily_calls_per_active_explorer'
        and minimum_integer_value=1 and default_integer_value=300 and maximum_integer_value=2000)
      or (setting_key='explorer_ai_use_automatic_lifts_per_week'
        and minimum_integer_value=0 and default_integer_value=1 and maximum_integer_value=7)
      or (setting_key='explorer_ai_use_automatic_lifts_per_month'
        and minimum_integer_value=0 and default_integer_value=2 and maximum_integer_value=30)
    );
insert into core.application_setting(application_setting_id,setting_key,integer_value,minimum_integer_value,
  default_integer_value,maximum_integer_value,version,retention_class) values
  ('a30f0230-0000-4000-8000-000000000001','explorer_ai_use_individual_daily_call_limit',500,1,500,2000,1,'core_business'),
  ('a30f0240-0000-4000-8000-000000000001','explorer_ai_use_shared_daily_calls_per_active_explorer',300,1,300,2000,1,'core_business'),
  ('a30f0250-0000-4000-8000-000000000001','explorer_ai_use_automatic_lifts_per_week',1,0,1,7,1,'core_business'),
  ('a30f0260-0000-4000-8000-000000000001','explorer_ai_use_automatic_lifts_per_month',2,0,2,30,1,'core_business');
comment on table core.application_setting is
  'Protected closed six-key MVP0 application-setting family: the Explorer Shared Snapshot sendability window, the Suggested Waypoint send-grace policy, the individual daily AI-call stop, the shared daily AI calls per active Explorer, and the automatic lifts per week and per month for an account not in crisis. RLS is enabled with zero policies; direct access is revoked from app roles and service_role; the fixed read and audited mutation functions remain the only runtime data paths.';

create or replace function public.solmind_set_application_setting_integer(
  p_setting_key text,
  p_integer_value integer,
  p_expected_version bigint,
  p_operation_id uuid,
  p_authority_basis text,
  p_authority_reference_id uuid,
  p_reason_code text
)
returns table (
  outcome text,
  setting_key text,
  integer_value integer,
  version bigint
)
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '2000ms'
as $$
declare
  v_setting core.application_setting%rowtype;
  v_existing_audit audit.audit_event%rowtype;
begin
  if p_setting_key is null
     or p_setting_key not in (
       'explorer_shared_snapshot_sendability_days',
       'suggested_waypoint_send_grace_seconds',
       'explorer_ai_use_individual_daily_call_limit',
       'explorer_ai_use_shared_daily_calls_per_active_explorer',
       'explorer_ai_use_automatic_lifts_per_week',
       'explorer_ai_use_automatic_lifts_per_month'
     )
  then
    raise exception 'solmind_application_setting_not_allowed';
  end if;

  if p_expected_version is null or p_expected_version < 1
     or p_operation_id is null
  then
    raise exception 'solmind_application_setting_invalid_request';
  end if;

  if p_authority_basis is null
     or p_authority_basis not in (
       'paul_approved',
       'system_operations_runbook'
     )
  then
    raise exception 'solmind_application_setting_invalid_authority';
  end if;

  if p_authority_reference_id is null then
    raise exception 'solmind_application_setting_invalid_audit_context';
  end if;

  if p_reason_code is null
     or (
       p_authority_basis = 'paul_approved'
       and p_reason_code <> 'paul_approved_configuration_change'
     )
     or (
       p_authority_basis = 'system_operations_runbook'
       and p_reason_code <> 'runbook_configuration_change'
     )
  then
    raise exception 'solmind_application_setting_invalid_reason';
  end if;

  select setting.*
    into v_setting
    from core.application_setting setting
   where setting.setting_key = p_setting_key
   for update;

  if not found then
    raise exception 'solmind_application_setting_not_found';
  end if;

  if p_integer_value is null
     or p_integer_value < v_setting.minimum_integer_value
     or p_integer_value > v_setting.maximum_integer_value
  then
    raise exception 'solmind_application_setting_invalid_value';
  end if;

  select event.*
    into v_existing_audit
    from audit.audit_event event
   where event.event_type = 'application_setting_changed'
     and event.metadata ->> 'operation_id' = p_operation_id::text;

  if found then
    if v_existing_audit.action = 'update'
       and v_existing_audit.actor_user_account_id is null
       and v_existing_audit.actor_role_context = 'system'
       and v_existing_audit.target_entity_type = 'application_setting'
       and v_existing_audit.target_entity_id =
           v_setting.application_setting_id
       and v_existing_audit.reason_code = p_reason_code
       and v_existing_audit.event_summary =
           'Protected application setting changed through the system-operations function.'
       and v_existing_audit.metadata = pg_catalog.jsonb_build_object(
         'setting_key', p_setting_key,
         'integer_value', p_integer_value,
         'expected_version', p_expected_version,
         'version', p_expected_version + 1,
         'operation_id', p_operation_id::text,
         'authority_basis', p_authority_basis,
         'authority_reference_id', p_authority_reference_id::text
       )
       and v_setting.last_operation_id = p_operation_id
       and v_setting.integer_value = p_integer_value
       and v_setting.version = p_expected_version + 1
    then
      return query
      select 'already_applied'::text,
             v_setting.setting_key,
             v_setting.integer_value,
             v_setting.version;
      return;
    end if;

    raise exception 'solmind_application_setting_operation_conflict';
  end if;

  if v_setting.version <> p_expected_version then
    raise exception 'solmind_application_setting_version_conflict';
  end if;

  if v_setting.integer_value = p_integer_value then
    return query
    select 'unchanged'::text,
           v_setting.setting_key,
           v_setting.integer_value,
           v_setting.version;
    return;
  end if;

  -- Product hard stops (decision queue 2026-11-01 00:58:42 and 12:00:53): a change to the shared allowance
  -- takes effect at the next Chicago midnight. Under the same lock the final count takes, first keep the
  -- value in force before this change for today, if today has none yet. The active Explorers are not
  -- counted here: they are counted at the day's first counted Send. The day comes from the clock at this
  -- moment, so a change made after midnight never applies to that day.
  if v_setting.setting_key = 'explorer_ai_use_shared_daily_calls_per_active_explorer' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('solmind:explorer-ai-use-shared:v1', 0));
    insert into ai.explorer_ai_use_shared_day (stop_day, calls_per_active_explorer, setting_version)
    select day_now.stop_day, v_setting.integer_value, v_setting.version
      from ai.solmind_explorer_ai_use_day_v1(pg_catalog.clock_timestamp()) day_now
    on conflict (stop_day) do nothing;
  end if;

  update core.application_setting setting
     set integer_value = p_integer_value,
         version = setting.version + 1,
         last_operation_id = p_operation_id,
         updated_at = pg_catalog.now()
   where setting.application_setting_id = v_setting.application_setting_id;

  insert into audit.audit_event (
    event_type,
    actor_user_account_id,
    actor_role_context,
    target_entity_type,
    target_entity_id,
    action,
    reason_code,
    event_summary,
    metadata
  ) values (
    'application_setting_changed',
    null,
    'system',
    'application_setting',
    v_setting.application_setting_id,
    'update',
    p_reason_code,
    'Protected application setting changed through the system-operations function.',
    pg_catalog.jsonb_build_object(
      'setting_key', v_setting.setting_key,
      'integer_value', p_integer_value,
      'expected_version', p_expected_version,
      'version', v_setting.version + 1,
      'operation_id', p_operation_id::text,
      'authority_basis', p_authority_basis,
      'authority_reference_id', p_authority_reference_id::text
    )
  );

  return query
  select 'applied'::text,
         v_setting.setting_key,
         p_integer_value,
         v_setting.version + 1;
exception
  when lock_not_available then
    raise exception 'solmind_application_setting_lock_unavailable';
end;
$$;

alter function public.solmind_set_application_setting_integer(text,integer,bigint,uuid,text,uuid,text) owner to postgres;
revoke all on function public.solmind_set_application_setting_integer(text,integer,bigint,uuid,text,uuid,text)
  from public,anon,authenticated;
grant execute on function public.solmind_set_application_setting_integer(text,integer,bigint,uuid,text,uuid,text) to service_role;
comment on function public.solmind_set_application_setting_integer(text,integer,bigint,uuid,text,uuid,text) is
  'Service-role-only audited system-operations mutation for the closed six-key protected setting family. The caller must hold exact Paul approval or authorized system-operations runbook authority. The function resolves the fixed row first, validates against that row bounds, serializes by expected version, preserves exact typed retry and writeless same-value semantics, and writes one same-transaction Family F audit row for an actual change.';

-- Counting reads the existing Send operations. These indexes keep the per-Explorer and per-day counts bounded.
create index explorer_conversation_operation_send_actor_created_idx
  on ai.explorer_conversation_operation(actor_user_account_id,created_at) where kind='send';
create index explorer_conversation_operation_send_created_idx
  on ai.explorer_conversation_operation(created_at) where kind='send';

-- The shared allowance for one Chicago day. The per-Explorer value is kept when the day first needs it (the
-- day's first counted Send, or a change to the shared setting that day); the active Explorers are counted
-- once, at the day's first counted Send (decision queue 12:00:53), so the sending Explorer always counts.
create table ai.explorer_ai_use_shared_day (
  stop_day date primary key,
  active_explorer_count integer null check (active_explorer_count>=1),
  calls_per_active_explorer integer not null check (calls_per_active_explorer between 1 and 2000),
  setting_version bigint not null check (setting_version>=1),
  threshold bigint null check (threshold>=1),
  counted_at timestamptz null,
  created_at timestamptz not null default clock_timestamp(),
  retention_class text not null default 'security_log' check (retention_class='security_log'),
  check ((active_explorer_count is null and threshold is null and counted_at is null)
    or (active_explorer_count is not null and counted_at is not null
      and threshold=active_explorer_count::bigint*calls_per_active_explorer))
);

-- One row each time a hard stop is reached: the Admin review flag and, for an individual stop, the pause.
-- day_stop_number is 1 for an account's first individual stop of a day; only that stop may be lifted
-- automatically: always while the account is in crisis or urgent handling (decision queue 12:27:07), and
-- otherwise within the weekly and monthly automatic-lift settings (13:20:16, 13:22:56).
create table ai.explorer_ai_use_stop (
  stop_id uuid primary key default gen_random_uuid(),
  stop_kind text not null check (stop_kind in ('individual','shared')),
  actor_user_account_id uuid null references identity.user_account(user_account_id),
  stop_day date not null,
  day_stop_number integer null check (day_stop_number>=1),
  reached_at timestamptz not null,
  day_total integer not null check (day_total>=0),
  limit_value bigint not null check (limit_value>=0),
  account_in_crisis boolean null,
  lifted_at timestamptz null,
  lift_authority_basis text null
    check (lift_authority_basis is null or lift_authority_basis in ('paul_approved','automatic_crisis','automatic_allowance')),
  lift_authority_reference_id uuid null,
  lift_operation_id uuid null unique,
  created_at timestamptz not null default clock_timestamp(),
  retention_class text not null default 'security_log' check (retention_class='security_log'),
  check ((stop_kind='individual' and actor_user_account_id is not null and day_stop_number is not null
      and account_in_crisis is not null)
    or (stop_kind='shared' and actor_user_account_id is null and day_stop_number is null and account_in_crisis is null)),
  check ((lifted_at is null and lift_authority_basis is null and lift_authority_reference_id is null and lift_operation_id is null)
    or (stop_kind='individual' and lifted_at is not null and lifted_at>=reached_at
      and ((lift_authority_basis='paul_approved' and lift_authority_reference_id is not null and lift_operation_id is not null)
        or (lift_authority_basis in ('automatic_crisis','automatic_allowance') and lift_authority_reference_id is null
          and lift_operation_id is null and day_stop_number=1))))
);
create unique index explorer_ai_use_one_shared_stop_per_day_idx
  on ai.explorer_ai_use_stop(stop_day) where stop_kind='shared';
create unique index explorer_ai_use_one_unlifted_individual_stop_per_day_idx
  on ai.explorer_ai_use_stop(actor_user_account_id,stop_day) where stop_kind='individual' and lifted_at is null;
create unique index explorer_ai_use_individual_stop_number_idx
  on ai.explorer_ai_use_stop(actor_user_account_id,stop_day,day_stop_number) where stop_kind='individual';
create unique index explorer_ai_use_one_automatic_lift_per_day_idx
  on ai.explorer_ai_use_stop(actor_user_account_id,stop_day)
  where lift_authority_basis in ('automatic_crisis','automatic_allowance');
create index explorer_ai_use_individual_stop_actor_idx
  on ai.explorer_ai_use_stop(actor_user_account_id,reached_at) where stop_kind='individual';

alter table ai.explorer_ai_use_shared_day enable row level security;
alter table ai.explorer_ai_use_stop enable row level security;
revoke all on ai.explorer_ai_use_shared_day from public,anon,authenticated,service_role;
revoke all on ai.explorer_ai_use_stop from public,anon,authenticated,service_role;
comment on table ai.explorer_ai_use_shared_day is
  'Shared daily AI-call allowance per America/Chicago day: the per-Explorer setting kept when the day first needs it, and the active Explorers counted once at the day''s first counted Send. Immutable except that one-time count. RLS on, zero policies, no API role access.';
comment on table ai.explorer_ai_use_stop is
  'Hard-stop records (Admin review flags). Holds the account, stop, its number that day, day, time, day total, limit, whether the account was in crisis or urgent handling when the stop was reached, and the lift facts (on Paul''s word, or automatic for a first stop of a day: always for a crisis account, within the weekly and monthly settings otherwise). Never conversation words, a conversation reference, or safety or crisis counts. Only the lift fields may be set, once. RLS on, zero policies, no API role access.';

create function ai.solmind_explorer_ai_use_immutable_v1() returns trigger language plpgsql set search_path='' as $$
begin
  -- Only a stop record's lift fields may be set, once, and only a shared day's count may be filled, once.
  -- Nested so each table's branch reads only its own fields.
  if tg_table_name='explorer_ai_use_stop' and tg_op='UPDATE' then
    if old.lifted_at is null and new.lifted_at is not null
      and (new.stop_id,new.stop_kind,new.actor_user_account_id,new.stop_day,new.day_stop_number,new.reached_at,
        new.day_total,new.limit_value,new.account_in_crisis,new.created_at,new.retention_class)
        is not distinct from (old.stop_id,old.stop_kind,old.actor_user_account_id,old.stop_day,old.day_stop_number,
        old.reached_at,old.day_total,old.limit_value,old.account_in_crisis,old.created_at,old.retention_class)
      then return new; end if;
  elsif tg_table_name='explorer_ai_use_shared_day' and tg_op='UPDATE' then
    if old.active_explorer_count is null and new.active_explorer_count is not null
      and (new.stop_day,new.calls_per_active_explorer,new.setting_version,new.created_at,new.retention_class)
        is not distinct from (old.stop_day,old.calls_per_active_explorer,old.setting_version,old.created_at,
        old.retention_class)
      then return new; end if;
  end if;
  raise exception 'solmind_explorer_ai_use_immutable';
end $$;
create trigger explorer_ai_use_stop_immutable before update or delete on ai.explorer_ai_use_stop
  for each row execute function ai.solmind_explorer_ai_use_immutable_v1();
create trigger explorer_ai_use_shared_day_immutable before update or delete on ai.explorer_ai_use_shared_day
  for each row execute function ai.solmind_explorer_ai_use_immutable_v1();

-- The America/Chicago calendar day of a moment, with its exact start and the next day's start (23 to 25 hours).
create function ai.solmind_explorer_ai_use_day_v1(p_ts timestamptz)
returns table(stop_day date,day_start timestamptz,next_day_start timestamptz)
language sql stable strict set search_path='' as $$
  select x.d,(x.d::timestamp at time zone 'America/Chicago'),((x.d+1)::timestamp at time zone 'America/Chicago')
    from (select (p_ts at time zone 'America/Chicago')::date as d) x
$$;

-- Active Explorers for the shared budget (decision queue 00:58:42): active account, active Explorer role,
-- finished sign-up, and an active or paused Guide relationship, signed in or not, paused by a limit or not.
create function ai.solmind_explorer_ai_use_active_explorers_v1(p_ts timestamptz)
returns integer language sql stable strict set search_path='' as $$
  select count(*)::integer from identity.user_account a
   where a.account_status='active'
     and exists(select 1 from identity.user_role_assignment ra where ra.user_account_id=a.user_account_id
       and ra.role_code='explorer' and ra.role_status='active' and ra.revoked_at is null and ra.granted_at<=p_ts)
     and exists(select 1 from core.explorer_profile e where e.user_account_id=a.user_account_id
       and e.status='active' and e.onboarding_status='active'
       and exists(select 1 from core.guide_explorer_relationship r where r.explorer_profile_id=e.explorer_profile_id
         and r.relationship_status in ('active','paused')))
$$;

-- Which automatic lift, if any, a newly reached individual stop gets (decision queue 12:27:07, 13:20:16,
-- 13:22:56): only an account's first stop of a day; a crisis account always; an account not in crisis only
-- while it has had fewer than the per-week setting of such lifts in the last 7 Chicago days (today and the
-- six before) and fewer than the per-month setting in the last 30. Paul's own lifts and crisis lifts do not
-- count toward those limits. Reads only; prepare holds the settings when it counts a Send.
create function ai.solmind_explorer_ai_use_automatic_kind_v1(p_actor uuid,p_day date,p_crisis boolean,p_number integer)
returns text language plpgsql stable set search_path='' as $$
declare v_week integer; v_month integer;
begin
  if p_actor is null or p_day is null or p_crisis is null or p_number is null
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  if p_number<>1 then return null; end if;
  if p_crisis then return 'automatic_crisis'; end if;
  select s.integer_value into v_week from core.application_setting s where s.setting_key='explorer_ai_use_automatic_lifts_per_week';
  select s.integer_value into v_month from core.application_setting s where s.setting_key='explorer_ai_use_automatic_lifts_per_month';
  if v_week is null or v_month is null then raise exception 'solmind_explorer_private_unavailable'; end if;
  if (select count(*) from ai.explorer_ai_use_stop x where x.actor_user_account_id=p_actor
        and x.lift_authority_basis='automatic_allowance' and x.stop_day>p_day-7 and x.stop_day<=p_day)<v_week
    and (select count(*) from ai.explorer_ai_use_stop x where x.actor_user_account_id=p_actor
        and x.lift_authority_basis='automatic_allowance' and x.stop_day>p_day-30 and x.stop_day<=p_day)<v_month
    then return 'automatic_allowance'; end if;
  return null;
end $$;

-- The one decision point for both hard stops. Callers hold the Explorer's owner lock.
-- p_mode 'read' writes nothing; 'check' records a stop that is already reached but not yet recorded, and an
-- automatic lift that is due; 'final' also serializes the shared count, keeps the day's shared allowance,
-- counts its active Explorers once, and records a stop reached by the Send about to be counted.
-- Returns {allowed, individual: none|review, shared, crisis, automatic_if_crisis}. crisis (the account is in
-- crisis or urgent handling) is for the Explorer's own screen and the stop records only; automatic_if_crisis
-- says the only pause is a first stop of its day, which a crisis account would have lifted automatically.
create function ai.solmind_explorer_ai_use_gate_v1(p_actor uuid,p_conversation uuid,p_ts timestamptz,p_mode text)
returns jsonb language plpgsql volatile set search_path='' as $$
declare d record; v_limit integer; v_since timestamptz; c_since integer:=0; c_day integer:=0; n_today integer:=0;
  v_open ai.explorer_ai_use_stop%rowtype; v_individual text:='none'; v_shared boolean:=false; v_crisis boolean;
  v_if_crisis boolean:=true; v_n integer; v_kind text;
  v_day ai.explorer_ai_use_shared_day%rowtype; c_all bigint:=0; v_per integer; v_per_version bigint; v_allowed boolean;
begin
  if p_actor is null or p_ts is null or p_mode is null or p_mode not in ('read','check','final')
    or (p_conversation is null and p_mode<>'read')
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  select x.* into d from ai.solmind_explorer_ai_use_day_v1(p_ts) x;
  if p_mode='read' then
    select s.integer_value into v_limit from core.application_setting s
      where s.setting_key='explorer_ai_use_individual_daily_call_limit';
  else
    select s.integer_value into v_limit from core.application_setting s
      where s.setting_key='explorer_ai_use_individual_daily_call_limit' for share;
  end if;
  if v_limit is null then raise exception 'solmind_explorer_private_unavailable'; end if;
  -- The account is in crisis or urgent handling when any of its conversations is at restricted level 3 or 4;
  -- the level never decreases (decision queue 12:27:07).
  v_crisis:=exists(select 1 from ai.explorer_conversation_state c
    where c.actor_user_account_id=p_actor and c.restricted_level is not null);
  -- Individual: an unlifted stop pauses the account until Paul lifts it. The account's first stop of a day is
  -- lifted automatically, once, while the account is in crisis or urgent handling, including when the
  -- crisis began after the stop was reached. A second stop that day is treated as likely misuse and always
  -- waits for Paul (decision queue 12:27:07).
  for v_open in select x.* from ai.explorer_ai_use_stop x
    where x.stop_kind='individual' and x.actor_user_account_id=p_actor and x.lifted_at is null
    order by x.reached_at,x.stop_id
  loop
    if v_open.day_stop_number<>1 then
      v_individual:='review'; v_if_crisis:=false;
    elsif not v_crisis then
      v_individual:='review';
    elsif p_mode<>'read' then
      update ai.explorer_ai_use_stop set lifted_at=p_ts,lift_authority_basis='automatic_crisis'
        where stop_id=v_open.stop_id and lifted_at is null;
    end if;
  end loop;
  if v_individual='none' then
    -- After a stop reached today is lifted (on Paul's word or automatically), only Sends made after that
    -- stop count toward the next one: a fresh allowance (decision 00:57:31). A paused account makes no
    -- counted Send between a stop and its lift, so this is the same as counting from the lift. Lifting a stop
    -- from an earlier day never restarts today's count. Here every stop reached today is lifted, or (read
    -- mode) about to be lifted automatically.
    select max(x.reached_at),count(*)::integer into v_since,n_today from ai.explorer_ai_use_stop x
      where x.stop_kind='individual' and x.actor_user_account_id=p_actor and x.stop_day=d.stop_day;
    select count(*)::integer into c_day from ai.explorer_conversation_operation o
      where o.actor_user_account_id=p_actor and o.kind='send' and o.created_at>=d.day_start and o.created_at<d.next_day_start;
    select count(*)::integer into c_since from ai.explorer_conversation_operation o
      where o.actor_user_account_id=p_actor and o.kind='send' and o.created_at>=d.day_start and o.created_at<d.next_day_start
        and (v_since is null or o.created_at>v_since);
    if c_since>=v_limit then
      -- Already at the stop but not recorded yet (for example, the limit was lowered): record it now.
      v_n:=n_today+1;
      v_kind:=ai.solmind_explorer_ai_use_automatic_kind_v1(p_actor,d.stop_day,v_crisis,v_n);
      if v_kind is not null then
        if p_mode<>'read' then
          insert into ai.explorer_ai_use_stop(stop_kind,actor_user_account_id,stop_day,day_stop_number,reached_at,
            day_total,limit_value,account_in_crisis,lifted_at,lift_authority_basis)
            values('individual',p_actor,d.stop_day,1,p_ts,c_day,v_limit,v_crisis,p_ts,v_kind);
          n_today:=v_n;
        end if;
        c_since:=0;
      else
        v_individual:='review'; v_if_crisis:=(v_n=1);
        if p_mode<>'read' then
          insert into ai.explorer_ai_use_stop(stop_kind,actor_user_account_id,stop_day,day_stop_number,reached_at,
            day_total,limit_value,account_in_crisis) values('individual',p_actor,d.stop_day,v_n,p_ts,c_day,v_limit,v_crisis);
        end if;
      end if;
    end if;
  end if;
  -- Shared: serialized only at the final count (prepare takes the lock before reading the clock; taking it
  -- again here is a no-op). The per-Explorer value is kept when the day first needs it; a change to the
  -- setting during a day first keeps that day's value from before the change (the setting writer), so the
  -- change takes effect at the next Chicago midnight (decision queue 00:58:42). The active Explorers are
  -- counted once, at the day's first counted Send (decision queue 12:00:53).
  if p_mode='final' then
    perform pg_advisory_xact_lock(hashtextextended('solmind:explorer-ai-use-shared:v1',0));
    select x.* into v_day from ai.explorer_ai_use_shared_day x where x.stop_day=d.stop_day;
    if not found then
      select s.integer_value,s.version into v_per,v_per_version from core.application_setting s
        where s.setting_key='explorer_ai_use_shared_daily_calls_per_active_explorer' for share;
      if v_per is null then raise exception 'solmind_explorer_private_unavailable'; end if;
      insert into ai.explorer_ai_use_shared_day(stop_day,active_explorer_count,calls_per_active_explorer,setting_version,
        threshold,counted_at)
        select d.stop_day,k.n,v_per,v_per_version,k.n::bigint*v_per,p_ts
          from (select ai.solmind_explorer_ai_use_active_explorers_v1(p_ts) as n) k
        on conflict (stop_day) do nothing;
      select x.* into v_day from ai.explorer_ai_use_shared_day x where x.stop_day=d.stop_day;
      if not found then raise exception 'solmind_explorer_private_unavailable'; end if;
    end if;
    if v_day.active_explorer_count is null then
      update ai.explorer_ai_use_shared_day x set active_explorer_count=k.n,
          threshold=k.n::bigint*x.calls_per_active_explorer,counted_at=p_ts
        from (select ai.solmind_explorer_ai_use_active_explorers_v1(p_ts) as n) k
        where x.stop_day=d.stop_day and x.active_explorer_count is null;
      select x.* into v_day from ai.explorer_ai_use_shared_day x where x.stop_day=d.stop_day;
      if v_day.threshold is null then raise exception 'solmind_explorer_private_unavailable'; end if;
    end if;
  else
    select x.* into v_day from ai.explorer_ai_use_shared_day x where x.stop_day=d.stop_day;
  end if;
  if exists(select 1 from ai.explorer_ai_use_stop x where x.stop_kind='shared' and x.stop_day=d.stop_day) then
    v_shared:=true;
  elsif v_day.threshold is not null then
    select count(*) into c_all from ai.explorer_conversation_operation o
      where o.kind='send' and o.created_at>=d.day_start and o.created_at<d.next_day_start;
    if c_all>=v_day.threshold then
      v_shared:=true;
      if p_mode<>'read' then
        insert into ai.explorer_ai_use_stop(stop_kind,stop_day,reached_at,day_total,limit_value)
          values('shared',d.stop_day,p_ts,c_all::integer,v_day.threshold) on conflict do nothing;
      end if;
    end if;
  end if;
  v_allowed:=v_individual='none' and not v_shared;
  -- The Send about to be counted reaches a stop: record it now, in the same transaction as the count. A first
  -- stop of the day that gets an automatic lift is recorded already lifted, so the account never sees a pause.
  if p_mode='final' and v_allowed then
    if c_since+1>=v_limit then
      v_n:=n_today+1;
      v_kind:=ai.solmind_explorer_ai_use_automatic_kind_v1(p_actor,d.stop_day,v_crisis,v_n);
      if v_kind is not null then
        insert into ai.explorer_ai_use_stop(stop_kind,actor_user_account_id,stop_day,day_stop_number,reached_at,
          day_total,limit_value,account_in_crisis,lifted_at,lift_authority_basis)
          values('individual',p_actor,d.stop_day,1,p_ts,c_day+1,v_limit,v_crisis,p_ts,v_kind);
      else
        insert into ai.explorer_ai_use_stop(stop_kind,actor_user_account_id,stop_day,day_stop_number,reached_at,
          day_total,limit_value,account_in_crisis) values('individual',p_actor,d.stop_day,v_n,p_ts,c_day+1,v_limit,v_crisis);
      end if;
    end if;
    if c_all+1>=v_day.threshold then
      insert into ai.explorer_ai_use_stop(stop_kind,stop_day,reached_at,day_total,limit_value)
        values('shared',d.stop_day,p_ts,(c_all+1)::integer,v_day.threshold) on conflict do nothing;
    end if;
  end if;
  return jsonb_build_object('allowed',v_allowed,'individual',v_individual,'shared',v_shared,'crisis',v_crisis,
    'automatic_if_crisis',v_individual='review' and v_if_crisis and not v_crisis);
end $$;

-- Observe step (same signature and return shape): a paused Send is refused before any observation,
-- except a message with crisis or urgent signs at a first stop that the automatic lift would cover.
create or replace function public.solmind_observe_explorer_conversation_fallback_v3(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,p_operation_id uuid,
  p_logical_operation_id uuid,p_expected_revision integer,p_command_fingerprint text,p_protocol_version text,
  p_fallback_policy_version text,p_model_policy_version text,p_configuration_fingerprint text,
  p_fallback_level smallint,p_fallback_minor_indicated boolean
) returns table(outcome text,policy_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; st ai.explorer_conversation_state%rowtype; op ai.explorer_conversation_operation%rowtype;
  g jsonb; v_stored boolean:=false;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_conversation_id is null or p_operation_id is null or p_logical_operation_id is null
    or p_expected_revision is null or p_expected_revision<0
    or p_protocol_version is distinct from 'explorer-safety-reply.v1'
    or p_configuration_fingerprint is null or p_configuration_fingerprint !~ '^[0-9A-F]{64}$'
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id
    or ai.solmind_private_policy_v3(p_conversation_id)->'known' is distinct from 'true'::jsonb
    then raise exception 'solmind_explorer_private_legacy_unknown'; end if;
  select x.* into op from ai.explorer_conversation_operation x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id for update;
  if found then
    if op.kind is distinct from 'send' or op.application_session_id is distinct from p_user_session_id
      or op.conversation_id is distinct from p_conversation_id or op.command_fingerprint is distinct from p_command_fingerprint
      or op.logical_operation_id is distinct from p_logical_operation_id
      then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    return query select 'exact_replay'::text,ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  if st.revision is distinct from p_expected_revision or st.pending_operation_id is not null then
    return query select 'stale_revision'::text,ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  -- The observation store's own input checks, first, so a malformed request is still refused as before.
  if p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$'
    or p_fallback_level is null or p_fallback_level not between 0 and 4 or p_fallback_minor_indicated is null
    or p_fallback_policy_version is null or p_fallback_policy_version !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    or p_model_policy_version is null or p_model_policy_version !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  -- Product hard stops: a paused Send is refused before any observation is stored, with one exception
  -- (decision queue, question 3 part 1): when the only pause is a first stop of its day that a crisis
  -- account would have lifted automatically, and the phrase check finds crisis or urgent signs (level 3
  -- or 4) in this message, its observation is stored first. That gives the account crisis status, and the
  -- check is made again, so the automatic lift applies. The four hard-stop settings are taken first, in
  -- key order, so any wait for them happens before the clock is read for the check.
  perform s.setting_key from core.application_setting s
    where s.setting_key in ('explorer_ai_use_automatic_lifts_per_month','explorer_ai_use_automatic_lifts_per_week',
      'explorer_ai_use_individual_daily_call_limit','explorer_ai_use_shared_daily_calls_per_active_explorer')
    order by s.setting_key for share;
  g:=ai.solmind_explorer_ai_use_gate_v1(p_actor_user_account_id,p_conversation_id,clock_timestamp(),'check');
  if (g->>'allowed')::boolean is not true and p_fallback_level>=3
    and (g->>'automatic_if_crisis')::boolean and not (g->>'shared')::boolean then
    perform ai.solmind_store_private_observation_v3(p_conversation_id,p_user_session_id,p_logical_operation_id,
      p_command_fingerprint,p_fallback_policy_version,p_model_policy_version,p_fallback_level,p_fallback_minor_indicated,
      null,null,null);
    v_stored:=true;
    g:=ai.solmind_explorer_ai_use_gate_v1(p_actor_user_account_id,p_conversation_id,clock_timestamp(),'check');
  end if;
  if (g->>'allowed')::boolean is not true then
    return query select 'paused'::text,ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  if not v_stored then
    perform ai.solmind_store_private_observation_v3(p_conversation_id,p_user_session_id,p_logical_operation_id,
      p_command_fingerprint,p_fallback_policy_version,p_model_policy_version,p_fallback_level,p_fallback_minor_indicated,
      null,null,null);
  end if;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp()
    then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'ok'::text,ai.solmind_private_policy_v3(p_conversation_id);
end $$;

-- Prepare step (the 37-argument overload only; same return shape): early and final hard-stop gates.
create or replace function public.solmind_prepare_explorer_conversation_turn_v3(
  p_actor_user_account_id uuid,p_user_session_id uuid,p_conversation_id uuid,
  p_operation_id uuid,p_expected_revision integer,p_message_id uuid,p_snapshot_id uuid,p_invocation_id uuid,
  p_body text,p_context_serialization text,p_context_fingerprint_sha256 text,p_context_source_ids uuid[],
  p_authorization_version text,p_intake_response_set_id uuid,p_methodology_context_pack_version_id uuid,
  p_prompt_version text,p_policy_version text,p_behavior_version text,p_crisis_version text,
  p_role_version text,p_instruction_version text,p_command_fingerprint text,p_logical_operation_id uuid,
  p_methodology_context_pack_id uuid,p_methodology_content_sha256 text,p_methodology_authorization_version text,
  p_protocol_version text,p_request_mode text,p_configuration_fingerprint text,p_fallback_policy_version text,
  p_model_policy_version text,p_trusted_response_version text,p_resource_policy_version text,
  p_expected_safety_version bigint,p_fallback_level smallint,p_fallback_minor_indicated boolean,p_model_name text
) returns table(outcome text,conversation_state jsonb,dispatch_permitted boolean,policy_state jsonb)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare a jsonb; e jsonb; st ai.explorer_conversation_state%rowtype; old_op ai.explorer_conversation_operation%rowtype;
  h text; h_legacy text; ids uuid[]; mode text; ctx json; inspected record; n integer; ts timestamptz; g jsonb;
  v_contract constant text:='virtual-guide-predispatch-evidence.v3';
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  if p_user_session_id is null or p_conversation_id is null or p_operation_id is null or p_message_id is null
    or p_snapshot_id is null or p_invocation_id is null or p_logical_operation_id is null
    or p_expected_revision is null or p_expected_revision<0 or p_expected_safety_version is null or p_expected_safety_version<0
    or p_protocol_version is distinct from 'explorer-safety-reply.v1'
    or p_request_mode is null or p_request_mode not in ('classification_and_reply','classification_only')
    or p_fallback_level is null or p_fallback_level not between 0 and 4 or p_fallback_minor_indicated is null
    or p_model_name is null or not ai.solmind_openai_model_name_valid(p_model_name)
    or not ai.solmind_conversation_text_valid(p_body,8192,false)
    or p_configuration_fingerprint is null or p_configuration_fingerprint !~ '^[0-9A-F]{64}$'
    or p_command_fingerprint is null or p_command_fingerprint !~ '^[0-9A-F]{64}$'
    or p_context_serialization is null or octet_length(p_context_serialization) not between 2 and 524288
    or p_context_fingerprint_sha256 is null or p_context_fingerprint_sha256 !~ '^[0-9A-F]{64}$'
    or p_authorization_version is null or p_authorization_version !~ '^AV3:[0-9A-F]{64}$'
    or p_context_fingerprint_sha256 is distinct from upper(encode(extensions.digest(convert_to(p_context_serialization,'UTF8'),'sha256'),'hex'))
    or p_intake_response_set_id is null or p_methodology_context_pack_id is null or p_methodology_context_pack_version_id is null
    or p_methodology_content_sha256 is null or p_methodology_content_sha256 !~ '^[0-9A-F]{64}$'
    or p_methodology_authorization_version is null or p_methodology_authorization_version !~ '^MV1:[0-9A-F]{64}$'
    or p_context_source_ids is null or cardinality(p_context_source_ids) not between 3 and 103
    or array_position(p_context_source_ids,null) is not null
    or exists(select 1 from unnest(array[p_prompt_version,p_policy_version,p_behavior_version,p_crisis_version,
      p_role_version,p_instruction_version,p_fallback_policy_version,p_model_policy_version,
      p_trusted_response_version,p_resource_policy_version]) as versions(version)
      where version is null or version !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$')
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  select array_agg(distinct x order by x) into ids from unnest(p_context_source_ids) as sources(x);
  if ids is distinct from p_context_source_ids or not(p_message_id=any(ids))
    or not(p_intake_response_set_id=any(ids)) or not(p_methodology_context_pack_version_id=any(ids))
    then raise exception 'solmind_explorer_private_invalid_input'; end if;
  h_legacy:=methodology.hash_json(jsonb_build_array(p_actor_user_account_id,p_user_session_id,p_conversation_id,
    p_operation_id,p_expected_revision,p_message_id,p_snapshot_id,p_invocation_id,p_body,p_context_fingerprint_sha256,ids,
    p_authorization_version,p_intake_response_set_id,p_methodology_context_pack_version_id,p_prompt_version,p_policy_version,
    p_behavior_version,p_crisis_version,p_role_version,p_instruction_version,p_command_fingerprint,p_logical_operation_id,
    p_methodology_context_pack_id,p_methodology_content_sha256,p_methodology_authorization_version,p_protocol_version,
    p_request_mode,p_configuration_fingerprint,p_fallback_policy_version,p_model_policy_version,p_trusted_response_version,
    p_resource_policy_version,p_expected_safety_version,p_fallback_level,p_fallback_minor_indicated));
  h:=methodology.hash_json(jsonb_build_array('explorer-model-binding.v1',h_legacy,p_model_name));
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,p_conversation_id);
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id for update;
  if not found or st.actor_user_account_id is distinct from p_actor_user_account_id
    then raise exception 'solmind_explorer_private_denied'; end if;
  select x.* into old_op from ai.explorer_conversation_operation x
    where x.actor_user_account_id=p_actor_user_account_id and x.operation_id=p_operation_id for update;
  if found then
    if old_op.kind is distinct from 'send' or old_op.conversation_id is distinct from p_conversation_id
      or old_op.application_session_id is distinct from p_user_session_id
      or (old_op.model_name is not null and old_op.model_name is distinct from p_model_name)
      or (old_op.model_name is null and p_model_name is distinct from 'gpt-5.6-luna')
      or old_op.request_fingerprint is distinct from (case when old_op.model_name is null then h_legacy else h end)
      or old_op.command_fingerprint is distinct from p_command_fingerprint
      or old_op.safety_protocol_version is distinct from p_protocol_version
      then raise exception 'solmind_explorer_private_operation_conflict'; end if;
    -- Exact persisted request first: no current methodology/source collection or
    -- changed version enrichment, and never another dispatch permission.
    if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp()
      then raise exception 'solmind_explorer_private_denied'; end if;
    return query select 'exact_replay'::text,ai.solmind_conversation_state_json(p_conversation_id),false,
      ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  if st.revision is distinct from p_expected_revision or st.pending_operation_id is not null then
    return query select 'stale_revision'::text,null::jsonb,false,ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  if ai.solmind_private_policy_v3(p_conversation_id)->'known' is distinct from 'true'::jsonb
    then raise exception 'solmind_explorer_private_legacy_unknown'; end if;
  -- Product hard stops, early: a paused Send is refused before any observation or message is stored. The
  -- four hard-stop settings are taken first, in key order, before the clock is read for the check.
  perform s.setting_key from core.application_setting s
    where s.setting_key in ('explorer_ai_use_automatic_lifts_per_month','explorer_ai_use_automatic_lifts_per_week',
      'explorer_ai_use_individual_daily_call_limit','explorer_ai_use_shared_daily_calls_per_active_explorer')
    order by s.setting_key for share;
  g:=ai.solmind_explorer_ai_use_gate_v1(p_actor_user_account_id,p_conversation_id,clock_timestamp(),'check');
  if (g->>'allowed')::boolean is not true then
    return query select 'paused'::text,null::jsonb,false,ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  perform ai.solmind_store_private_observation_v3(p_conversation_id,p_user_session_id,p_logical_operation_id,
    p_command_fingerprint,p_fallback_policy_version,p_model_policy_version,p_fallback_level,p_fallback_minor_indicated,
    null,null,null);
  select x.* into st from ai.explorer_conversation_state x where x.conversation_id=p_conversation_id;
  mode:=case when st.restricted_level is not null or st.adult_reflection_stopped or p_fallback_level>=3
    or p_fallback_minor_indicated then 'classification_only' else 'classification_and_reply' end;
  if st.safety_version is distinct from p_expected_safety_version or p_request_mode is distinct from mode then
    return query select 'stale_policy'::text,null::jsonb,false,ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  if a->>'authorizationVersion' is distinct from p_authorization_version
    or (a->'onboarding'->>'responseId')::uuid is distinct from p_intake_response_set_id
    then raise exception 'solmind_explorer_private_denied'; end if;
  e:=methodology.resolve_effective(p_methodology_context_pack_id,(a->>'guideId')::uuid);
  if (e->>'versionId')::uuid is distinct from p_methodology_context_pack_version_id
    or e->>'contentSha256' is distinct from p_methodology_content_sha256
    or e->>'methodologyAuthorizationVersion' is distinct from p_methodology_authorization_version
    or not methodology.serialized_methodology_valid(p_context_serialization,p_methodology_context_pack_version_id,e->>'contentMarkdown')
    then raise exception 'solmind_explorer_private_denied'; end if;
  ctx:=p_context_serialization::json;
  if ctx->'immediateExplorerMessage'->>'messageId' is distinct from p_message_id::text
    or ctx->'immediateExplorerMessage'->>'content' is distinct from p_body
    or ctx->'globalPolicy'->>'version' is distinct from p_policy_version
    or ctx->'roleBehavior'->>'version' is distinct from p_behavior_version
    or ctx->'crisisBehavior'->>'version' is distinct from p_crisis_version
    then raise exception 'solmind_explorer_private_denied'; end if;
  -- The source owner locks all covered tables NOWAIT before its fresh scan.
  -- Its blocked audit MUST survive: return rather than throw after that row.
  select x.* into inspected from ai.solmind_record_explorer_context_exclusion_v3(
    p_actor_user_account_id,p_user_session_id,(a->>'explorerId')::uuid,(a->>'relationshipId')::uuid,
    p_conversation_id,p_context_serialization,ids) x;
  if not found or inspected.outcome is null or inspected.outcome not in ('clear','blocked','unavailable')
    then raise exception 'solmind_explorer_private_unavailable'; end if;
  if inspected.outcome<>'clear' then
    return query select inspected.outcome::text,null::jsonb,false,null::jsonb; return;
  end if;
  select count(*)::integer into n from ai.ai_interaction_message m where m.ai_interaction_session_id=p_conversation_id;
  if n>98 then return query select 'unavailable'::text,null::jsonb,false,null::jsonb; return; end if;
  -- Product hard stops, final: the four hard-stop settings (already held since the early check), then the
  -- one shared lock, and only then read the clock, so after any wait the day, the count and this Send's
  -- saved times all come from one moment. Each Send prepared here counts once; a stop reached by this
  -- Send is recorded with it.
  perform s.setting_key from core.application_setting s
    where s.setting_key in ('explorer_ai_use_automatic_lifts_per_month','explorer_ai_use_automatic_lifts_per_week',
      'explorer_ai_use_individual_daily_call_limit','explorer_ai_use_shared_daily_calls_per_active_explorer')
    order by s.setting_key for share;
  perform pg_advisory_xact_lock(hashtextextended('solmind:explorer-ai-use-shared:v1',0));
  ts:=clock_timestamp();
  g:=ai.solmind_explorer_ai_use_gate_v1(p_actor_user_account_id,p_conversation_id,ts,'final');
  if (g->>'allowed')::boolean is not true then
    return query select 'paused'::text,null::jsonb,false,ai.solmind_private_policy_v3(p_conversation_id); return;
  end if;
  insert into ai.ai_interaction_message(ai_interaction_message_id,ai_interaction_session_id,sequence_number,
    sender_type,sender_user_account_id,sender_role_context,content_text,created_at)
    values(p_message_id,p_conversation_id,n+1,'user',p_actor_user_account_id,'explorer',p_body,ts);
  insert into ai.ai_context_snapshot(ai_context_snapshot_id,ai_interaction_session_id,ai_interaction_message_id,
    prompt_version,methodology_context_pack_version_id,actor_user_account_id,explorer_profile_id,
    guide_explorer_relationship_id,authorization_version,active_required_consent_document_ids,context_source_ids,
    context_fingerprint_sha256,evidence_contract_version,application_session_id,immediate_message_id,
    organization_id,practice_id,solmind_policy_version,ai_behavior_version,crisis_policy_version,
    role_policy_version,instruction_version,intake_response_set_id,related_prior_session_ids,created_at,
    explorer_safety_protocol_version,explorer_safety_request_mode,explorer_configuration_fingerprint,
    fallback_policy_version,model_policy_version,trusted_response_version,resource_policy_version)
    values(p_snapshot_id,p_conversation_id,p_message_id,p_prompt_version,p_methodology_context_pack_version_id,
      p_actor_user_account_id,(a->>'explorerId')::uuid,(a->>'relationshipId')::uuid,p_authorization_version,
      array(select jsonb_array_elements_text(a->'requiredConsentDocumentIds')::uuid),ids,
      p_context_fingerprint_sha256,v_contract,p_user_session_id,p_message_id,(a->>'organizationId')::uuid,
      (a->>'practiceId')::uuid,p_policy_version,p_behavior_version,p_crisis_version,p_role_version,p_instruction_version,
      p_intake_response_set_id,array[]::uuid[],ts,p_protocol_version,p_request_mode,p_configuration_fingerprint,
      p_fallback_policy_version,p_model_policy_version,p_trusted_response_version,p_resource_policy_version);
  insert into ai.ai_model_invocation(ai_model_invocation_id,ai_interaction_session_id,provider_name,model_name,
    prompt_version,logical_operation_id,ai_context_snapshot_id,dispatch_contract_version,started_at)
    values(p_invocation_id,p_conversation_id,'openai',p_model_name,p_prompt_version,p_logical_operation_id,p_snapshot_id,v_contract,ts);
  insert into ai.explorer_conversation_operation(actor_user_account_id,operation_id,application_session_id,
    conversation_id,kind,request_fingerprint,command_fingerprint,initial_revision,status,message_id,snapshot_id,invocation_id,
    logical_operation_id,safety_protocol_version,safety_request_mode,configuration_fingerprint,fallback_observation_fingerprint,
    fallback_policy_version,model_policy_version,trusted_response_version,resource_policy_version,model_name,created_at)
    values(p_actor_user_account_id,p_operation_id,p_user_session_id,p_conversation_id,'send',h,p_command_fingerprint,
      p_expected_revision,'started',p_message_id,p_snapshot_id,p_invocation_id,p_logical_operation_id,
      p_protocol_version,p_request_mode,p_configuration_fingerprint,
      methodology.hash_json(jsonb_build_array('explorer-fallback-observation.v1',p_user_session_id,p_conversation_id,
        p_logical_operation_id,p_command_fingerprint,p_configuration_fingerprint,p_fallback_policy_version,
        p_model_policy_version,p_fallback_level,p_fallback_minor_indicated)),p_fallback_policy_version,
      p_model_policy_version,p_trusted_response_version,p_resource_policy_version,p_model_name,ts);
  insert into methodology.explorer_methodology_binding(ai_context_snapshot_id,methodology_context_pack_id,
    methodology_context_pack_version_id,content_sha256,methodology_authorization_version,created_at)
    values(p_snapshot_id,p_methodology_context_pack_id,p_methodology_context_pack_version_id,p_methodology_content_sha256,
      p_methodology_authorization_version,ts);
  perform ai.solmind_store_private_observation_v3(p_conversation_id,p_user_session_id,p_logical_operation_id,
    p_command_fingerprint,p_fallback_policy_version,p_model_policy_version,p_fallback_level,p_fallback_minor_indicated,
    p_invocation_id,null,null);
  insert into audit.audit_event(event_type,actor_user_account_id,actor_role_context,target_entity_type,
    target_entity_id,action,reason_code,event_summary,metadata)
    values('ai_context_snapshot_created',p_actor_user_account_id,'explorer','ai_context_snapshot',p_snapshot_id,
      'create','pre_dispatch_snapshot_created','Virtual Guide context snapshot created before provider dispatch.',
      jsonb_build_object('contract_version',v_contract,'operation_id',p_logical_operation_id::text,
        'role_context','explorer','session_id',p_conversation_id::text)),
    ('ai_model_invocation_started',p_actor_user_account_id,'explorer','ai_model_invocation',p_invocation_id,
      'start','pre_dispatch_invocation_started','Virtual Guide model invocation started before provider dispatch.',
      jsonb_build_object('context_snapshot_id',p_snapshot_id::text,'contract_version',v_contract,
        'model_name',p_model_name,'operation_id',p_logical_operation_id::text,'provider_name','openai',
        'request_status','started','role_context','explorer','session_id',p_conversation_id::text));
  update ai.explorer_conversation_state set revision=revision+1,pending_operation_id=p_operation_id
    where conversation_id=p_conversation_id;
  update ai.ai_interaction_session set last_activity_at=ts where ai_interaction_session_id=p_conversation_id;
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp()
    then raise exception 'solmind_explorer_private_denied'; end if;
  return query select 'ok'::text,ai.solmind_conversation_state_json(p_conversation_id),true,
    ai.solmind_private_policy_v3(p_conversation_id);
end $$;

-- The pause the Explorer's screen should show: individual (waits for Paul's lift), shared (lifts at midnight)
-- or individual_and_shared (sending resumes only once both are over; decision 13:26:32). crisis says the Explorer's
-- current conversation is already in crisis or urgent handling, so the screen shows the crisis pause notice
-- (decision queue 00:39:51) with that pause's true restart condition (12:27:07). Writes nothing: a first
-- stop that a crisis account would have lifted automatically is reported as no pause, because the
-- Explorer's next Send lifts it.
create function public.solmind_read_explorer_ai_use_pause_v1(p_actor_user_account_id uuid,p_user_session_id uuid)
returns table(outcome text,notice_kind text,crisis boolean,adults_only boolean)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare ids uuid[]; v_id uuid; a jsonb; g jsonb; st ai.explorer_conversation_state%rowtype; k text;
  v_restricted boolean:=false; v_adult boolean:=false;
begin
  perform ai.solmind_private_owner_lock_v3(p_actor_user_account_id);
  select array_agg(s.ai_interaction_session_id order by s.ai_interaction_session_id) into ids
    from ai.ai_interaction_session s where s.actor_user_account_id=p_actor_user_account_id
      and s.actor_role_context='explorer' and s.session_type='explorer_reflection' and s.session_status='active';
  if coalesce(cardinality(ids),0)>1 then raise exception 'solmind_explorer_private_unavailable'; end if;
  v_id:=ids[1];
  if v_id is not null and not exists(select 1 from ai.explorer_conversation_state x
    where x.conversation_id=v_id and x.actor_user_account_id=p_actor_user_account_id)
    then raise exception 'solmind_explorer_private_unavailable'; end if;
  a:=ai.solmind_private_owned_authority_v3(p_actor_user_account_id,p_user_session_id,v_id);
  if (a->>'applicationSessionExpiresAt')::timestamptz<=clock_timestamp()
    then raise exception 'solmind_explorer_private_denied'; end if;
  if v_id is not null then
    select x.* into st from ai.explorer_conversation_state x where x.conversation_id=v_id;
    v_restricted:=st.restricted_level is not null;
    v_adult:=coalesce(st.adult_reflection_stopped,false);
  end if;
  g:=ai.solmind_explorer_ai_use_gate_v1(p_actor_user_account_id,v_id,clock_timestamp(),'read');
  k:=case when g->>'individual'='review' and (g->>'shared')::boolean then 'individual_and_shared'
    when g->>'individual'='review' then 'individual' when (g->>'shared')::boolean then 'shared' end;
  return query select 'ok'::text,k,(k is not null and v_restricted),(k is not null and v_adult);
end $$;

-- The Executor's lift, carried out only on Paul's word (decision queue 00:54:23). It records no actor
-- account, role 'system' and authority 'paul_approved' with the reference id of Paul's recorded word.
-- A stop already lifted automatically returns lifted_automatically and changes nothing. Lifting a stop
-- from an earlier day does not restart today's count; only a lift of a stop reached today does.
create function public.solmind_lift_explorer_ai_use_pause_v1(p_stop_id uuid,p_authority_reference_id uuid,p_operation_id uuid)
returns table(outcome text)
language plpgsql volatile security definer set search_path='' set lock_timeout='2000ms' set statement_timeout='5000ms' as $$
declare x ai.explorer_ai_use_stop%rowtype; ts timestamptz;
begin
  if p_stop_id is null or p_authority_reference_id is null or p_operation_id is null
    then raise exception 'solmind_explorer_ai_use_invalid_input'; end if;
  select s.* into x from ai.explorer_ai_use_stop s where s.stop_id=p_stop_id for update;
  if not found or x.stop_kind<>'individual' then raise exception 'solmind_explorer_ai_use_not_found'; end if;
  if x.lifted_at is not null then
    if x.lift_authority_basis in ('automatic_crisis','automatic_allowance') then
      return query select 'lifted_automatically'::text; return; end if;
    if x.lift_operation_id=p_operation_id and x.lift_authority_reference_id=p_authority_reference_id then
      return query select 'already_lifted'::text; return; end if;
    raise exception 'solmind_explorer_ai_use_operation_conflict';
  end if;
  if exists(select 1 from ai.explorer_ai_use_stop s where s.lift_operation_id=p_operation_id)
    then raise exception 'solmind_explorer_ai_use_operation_conflict'; end if;
  ts:=clock_timestamp();
  update ai.explorer_ai_use_stop set lifted_at=ts,lift_authority_basis='paul_approved',
    lift_authority_reference_id=p_authority_reference_id,lift_operation_id=p_operation_id where stop_id=p_stop_id;
  insert into audit.audit_event(event_type,actor_user_account_id,actor_role_context,target_entity_type,target_entity_id,
    action,reason_code,event_summary,metadata)
    values('explorer_ai_use_pause_lifted',null,'system','explorer_ai_use_stop',p_stop_id,'lift','paul_approved_pause_lift',
      'Explorer AI-use pause lifted through the system-operations function on Paul''s word.',
      jsonb_build_object('authority_basis','paul_approved','authority_reference_id',p_authority_reference_id::text,
        'operation_id',p_operation_id::text));
  return query select 'lifted'::text;
exception
  when lock_not_available then raise exception 'solmind_explorer_ai_use_lock_unavailable';
  when unique_violation then raise exception 'solmind_explorer_ai_use_operation_conflict';
end $$;

-- The Executor's report of the stop records (Admin review flags): the Question 8 facts (decision 01:00:16)
-- plus the stop's number that day, whether the account was in crisis or urgent handling when it was
-- reached, and how a lift was made: paul, automatic_crisis or automatic_allowance (decisions 12:27:07 and
-- 13:20:16; the crisis status is not private, its cause is), with when each lift was made (01:00:16). The time
-- of a crisis lift made after the stop shows about when the account entered crisis handling (a status fact, never
-- the words or the cause). An open stop is one with no lift time. From a day,
-- the report lists the stops reached since then and every stop still open or lifted since then. Never conversation words, a conversation reference, or safety or crisis counts.
create function public.solmind_report_explorer_ai_use_v1(p_from_day date)
returns table(stop_id uuid,stop_kind text,actor_user_account_id uuid,stop_day date,day_stop_number integer,
  reached_at timestamptz,day_total integer,limit_value bigint,account_in_crisis boolean,lifted_at timestamptz,
  lifted_day date,lift_kind text,lifted_on_pauls_word boolean)
language sql stable security definer set search_path='' as $$
  select x.stop_id,x.stop_kind,x.actor_user_account_id,x.stop_day,x.day_stop_number,x.reached_at,x.day_total,
    x.limit_value,x.account_in_crisis,
    x.lifted_at,
    (x.lifted_at at time zone 'America/Chicago')::date,
    case x.lift_authority_basis when 'paul_approved' then 'paul' else x.lift_authority_basis end,
    x.lift_authority_basis is not distinct from 'paul_approved'
  from ai.explorer_ai_use_stop x
  where p_from_day is null or x.stop_day>=p_from_day or x.lifted_at is null
    or x.lifted_at>=(p_from_day::timestamp at time zone 'America/Chicago')
  order by x.reached_at,x.stop_id
$$;

-- The Executor's daily summary, so an unusual number of crisis lifts stands out (decision 12:27:07): for
-- each America/Chicago day, the individual stops reached, how many of them were reached while the account
-- was in crisis or urgent handling, the second-or-later stops (likely misuse), the automatic crisis lifts
-- made that day, the automatic lifts of accounts not in crisis (weekly and monthly limits), and whether
-- the shared stop was reached. Counts only; no account or conversation detail.
create function public.solmind_report_explorer_ai_use_days_v1(p_from_day date)
returns table(report_day date,individual_stops integer,stops_in_crisis integer,repeat_stops integer,
  automatic_crisis_lifts integer,automatic_allowance_lifts integer,shared_stop_reached boolean)
language sql stable security definer set search_path='' as $$
  with days as (
    select x.stop_day as day from ai.explorer_ai_use_stop x
    union
    select (x.lifted_at at time zone 'America/Chicago')::date from ai.explorer_ai_use_stop x
      where x.lift_authority_basis='automatic_crisis')
  select y.day,
    (select count(*)::integer from ai.explorer_ai_use_stop x where x.stop_kind='individual' and x.stop_day=y.day),
    (select count(*)::integer from ai.explorer_ai_use_stop x
      where x.stop_kind='individual' and x.stop_day=y.day and x.account_in_crisis),
    (select count(*)::integer from ai.explorer_ai_use_stop x
      where x.stop_kind='individual' and x.stop_day=y.day and x.day_stop_number>1),
    (select count(*)::integer from ai.explorer_ai_use_stop x where x.lift_authority_basis='automatic_crisis'
      and (x.lifted_at at time zone 'America/Chicago')::date=y.day),
    (select count(*)::integer from ai.explorer_ai_use_stop x where x.lift_authority_basis='automatic_allowance'
      and (x.lifted_at at time zone 'America/Chicago')::date=y.day),
    exists(select 1 from ai.explorer_ai_use_stop x where x.stop_kind='shared' and x.stop_day=y.day)
  from days y
  where p_from_day is null or y.day>=p_from_day
  order by y.day
$$;

alter function ai.solmind_explorer_ai_use_immutable_v1() owner to postgres;
alter function ai.solmind_explorer_ai_use_day_v1(timestamptz) owner to postgres;
alter function ai.solmind_explorer_ai_use_active_explorers_v1(timestamptz) owner to postgres;
alter function ai.solmind_explorer_ai_use_automatic_kind_v1(uuid,date,boolean,integer) owner to postgres;
alter function ai.solmind_explorer_ai_use_gate_v1(uuid,uuid,timestamptz,text) owner to postgres;
revoke all on function ai.solmind_explorer_ai_use_immutable_v1() from public,anon,authenticated,service_role;
revoke all on function ai.solmind_explorer_ai_use_day_v1(timestamptz) from public,anon,authenticated,service_role;
revoke all on function ai.solmind_explorer_ai_use_active_explorers_v1(timestamptz) from public,anon,authenticated,service_role;
revoke all on function ai.solmind_explorer_ai_use_automatic_kind_v1(uuid,date,boolean,integer) from public,anon,authenticated,service_role;
revoke all on function ai.solmind_explorer_ai_use_gate_v1(uuid,uuid,timestamptz,text) from public,anon,authenticated,service_role;
alter function public.solmind_read_explorer_ai_use_pause_v1(uuid,uuid) owner to postgres;
alter function public.solmind_lift_explorer_ai_use_pause_v1(uuid,uuid,uuid) owner to postgres;
alter function public.solmind_report_explorer_ai_use_v1(date) owner to postgres;
alter function public.solmind_report_explorer_ai_use_days_v1(date) owner to postgres;
revoke all on function public.solmind_read_explorer_ai_use_pause_v1(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.solmind_lift_explorer_ai_use_pause_v1(uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.solmind_report_explorer_ai_use_v1(date) from public,anon,authenticated,service_role;
revoke all on function public.solmind_report_explorer_ai_use_days_v1(date) from public,anon,authenticated,service_role;
grant execute on function public.solmind_read_explorer_ai_use_pause_v1(uuid,uuid) to service_role;
grant execute on function public.solmind_lift_explorer_ai_use_pause_v1(uuid,uuid,uuid) to service_role;
grant execute on function public.solmind_report_explorer_ai_use_v1(date) to service_role;
grant execute on function public.solmind_report_explorer_ai_use_days_v1(date) to service_role;
comment on function public.solmind_read_explorer_ai_use_pause_v1(uuid,uuid) is
  'Server-only read of the hard-stop pause for the signed-in Explorer: outcome ok, notice_kind null (no pause)|individual|shared|individual_and_shared, crisis (the current conversation is in crisis or urgent handling, for the crisis pause notice), adults_only. Same owner lock and owned authority as the v3 read. Writes nothing; returns no counts or conversation reference. crisis and adults_only are private facts for that Explorer''s own screen: never log them or pass them to operational signals.';
comment on function public.solmind_lift_explorer_ai_use_pause_v1(uuid,uuid,uuid) is
  'Service-role-only lift of one individual hard-stop pause, carried out by the Executor only on Paul''s recorded word. Records lifted_at, authority paul_approved and its reference id once, with one content-free system audit row; exact retry returns already_lifted; a stop already lifted automatically returns lifted_automatically.';
comment on function public.solmind_report_explorer_ai_use_v1(date) is
  'Service-role-only report of hard-stop records: account, stop, its number that day, day, time, day total, limit, whether the account was in crisis or urgent handling when the stop was reached, and when and how it was lifted (paul, automatic_crisis or automatic_allowance), with its Chicago day; an open stop has no lift time. From a day, it also lists stops still open or lifted since then. Crisis status is reported as a status only (decision queue 2026-11-01 12:27:07); never conversation words, a conversation reference, or safety or crisis counts.';
comment on function public.solmind_report_explorer_ai_use_days_v1(date) is
  'Service-role-only daily summary of hard-stop records per America/Chicago day: individual stops, stops reached in crisis or urgent handling, second-or-later stops, automatic crisis lifts and automatic lifts of accounts not in crisis made that day, and whether the shared stop was reached. Counts only.';

-- The existing observe and prepare grants are kept by create or replace with the same signatures.
commit;
