-- Local ephemeral database only. This suite commits reserved synthetic rows so
-- independent dblink sessions can exercise real locks, then removes only those
-- identities. Never run against hosted or real-user data.

begin;
select plan(81);

create extension if not exists dblink;
create function pg_temp.s02_sw_wait_for_lock(
  p_connection text,
  p_pid integer
)
returns boolean
language plpgsql
as $$
begin
  for attempt in 1..50 loop
    if dblink_is_busy(p_connection) = 1
       and exists (
         select 1
           from pg_catalog.pg_stat_activity activity
          where activity.pid = p_pid
            and activity.wait_event_type = 'Lock'
       )
    then
      return true;
    end if;
    perform pg_catalog.pg_sleep(0.10);
  end loop;
  return false;
end;
$$;

insert into identity.user_account (
  user_account_id, display_name, username, account_status
) values
  ('a3220220-1000-4000-8000-000000000001', 'S02 SW Race Guide',
   's02_sw_race_guide', 'active'),
  ('a3220220-1000-4000-8000-000000000002', 'S02 SW Race Explorer',
   's02_sw_race_explorer', 'active');
insert into identity.user_role_assignment (
  user_role_assignment_id, user_account_id, role_code, role_status
) values
  ('a3220220-1050-4000-8000-000000000001',
   'a3220220-1000-4000-8000-000000000001', 'guide', 'active'),
  ('a3220220-1050-4000-8000-000000000002',
   'a3220220-1000-4000-8000-000000000002', 'explorer', 'active');
insert into core.organization (organization_id, organization_name)
values ('a3220220-1100-4000-8000-000000000001',
        'S02 Suggested Waypoint Race Organization');
insert into core.practice (practice_id, organization_id, practice_name)
values ('a3220220-1200-4000-8000-000000000001',
        'a3220220-1100-4000-8000-000000000001',
        'S02 Suggested Waypoint Race Practice');
insert into core.guide_profile (
  guide_profile_id, user_account_id, guide_display_name
) values (
  'a3220220-1300-4000-8000-000000000001',
  'a3220220-1000-4000-8000-000000000001', 'Morgan Race'
);
insert into core.explorer_profile (
  explorer_profile_id, user_account_id, explorer_display_name, onboarding_status
) values (
  'a3220220-1400-4000-8000-000000000001',
  'a3220220-1000-4000-8000-000000000002', 'Avery Race', 'active'
);
insert into core.guide_explorer_relationship (
  guide_explorer_relationship_id,
  guide_profile_id,
  explorer_profile_id,
  practice_id,
  relationship_status,
  started_at
) values (
  'a3220220-1500-4000-8000-000000000001',
  'a3220220-1300-4000-8000-000000000001',
  'a3220220-1400-4000-8000-000000000001',
  'a3220220-1200-4000-8000-000000000001',
  'active',
  now() - interval '1 day'
);
commit;

select lives_ok(
  pg_catalog.format(
    $q$select dblink_connect(
      's02_sw_a',
      'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5'
    )$q$,
    pg_catalog.current_database()
  ),
  'connection A opens'
);
select lives_ok(
  pg_catalog.format(
    $q$select dblink_connect(
      's02_sw_b',
      'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5'
    )$q$,
    pg_catalog.current_database()
  ),
  'connection B opens'
);
select is(dblink_exec('s02_sw_a', 'set statement_timeout=''10s'''), 'SET',
          'connection A timeout is bounded');
select is(dblink_exec('s02_sw_b', 'set statement_timeout=''10s'''), 'SET',
          'connection B timeout is bounded');
select is(dblink_exec('s02_sw_a', 'set role service_role'), 'SET',
          'connection A uses the service-only boundary');
select is(dblink_exec('s02_sw_b', 'set role service_role'), 'SET',
          'connection B uses the service-only boundary');

create temp table s02_sw_race_pids as
select 'a'::text as name, pid
  from dblink('s02_sw_a', 'select pg_backend_pid()') result(pid integer)
union all
select 'b'::text as name, pid
  from dblink('s02_sw_b', 'select pg_backend_pid()') result(pid integer);
select is(
  (select pg_catalog.count(distinct pid)::integer from s02_sw_race_pids),
  2,
  'race workers use distinct database sessions'
);

select is(dblink_exec('s02_sw_a', 'begin'), 'BEGIN',
          'create winner begins');
create temp table s02_sw_create_winner as
select *
  from dblink(
    's02_sw_a',
    $remote$
      select outcome_code
        from public.solmind_save_suggested_waypoint_draft(
          'a3220220-1000-4000-8000-000000000001',
          'a3220220-2000-4000-8000-000000000001',
          'a3220220-1500-4000-8000-000000000001',
          'a3220220-3000-4000-8000-000000000001',
          0,
          'Protect one evening each week for recovery',
          'Race-safe draft creation',
          '["One evening stays unscheduled"]'::jsonb
        )
    $remote$
  ) result(outcome_code text);
select is((select outcome_code from s02_sw_create_winner), 'applied',
          'first expected-revision create applies');
select is(dblink_exec('s02_sw_b', 'begin'), 'BEGIN',
          'competing create begins');
select is(
  dblink_send_query(
    's02_sw_b',
    $remote$
      select outcome_code
        from public.solmind_save_suggested_waypoint_draft(
          'a3220220-1000-4000-8000-000000000001',
          'a3220220-2000-4000-8000-000000000001',
          'a3220220-1500-4000-8000-000000000001',
          'a3220220-3000-4000-8000-000000000001',
          0,
          'Protect one evening each week for recovery',
          'Race-safe draft creation',
          '["One evening stays unscheduled"]'::jsonb
        )
    $remote$
  ),
  1,
  'competing create is sent asynchronously'
);
select ok(
  pg_temp.s02_sw_wait_for_lock(
    's02_sw_b',
    (select pid from s02_sw_race_pids where name = 'b')
  ),
  'competing create waits on the serialized suggestion identity'
);
select is(dblink_exec('s02_sw_a', 'commit'), 'COMMIT',
          'create winner commits');
create temp table s02_sw_create_loser as
select * from dblink_get_result('s02_sw_b') result(outcome_code text);
do $$
begin
  perform * from dblink_get_result('s02_sw_b') result(outcome_code text);
end;
$$;
select is((select outcome_code from s02_sw_create_loser), 'idempotent',
          'concurrent identical operation replay returns the committed result');
select is(dblink_exec('s02_sw_b', 'commit'), 'COMMIT',
          'competing create closes without a write');

select is(dblink_exec('s02_sw_a', 'begin'), 'BEGIN',
          'revision winner begins');
create temp table s02_sw_revision_winner as
select *
  from dblink(
    's02_sw_a',
    $remote$
      select outcome_code
        from public.solmind_save_suggested_waypoint_draft(
          'a3220220-1000-4000-8000-000000000001',
          'a3220220-2000-4000-8000-000000000002',
          'a3220220-1500-4000-8000-000000000001',
          'a3220220-3000-4000-8000-000000000001',
          1,
          'Protect one evening each week for recovery',
          'Race-safe revision winner',
          '["One evening stays unscheduled"]'::jsonb
        )
    $remote$
  ) result(outcome_code text);
select is((select outcome_code from s02_sw_revision_winner), 'applied',
          'first expected-revision update applies');
select is(dblink_exec('s02_sw_b', 'begin'), 'BEGIN',
          'competing revision begins');
select is(
  dblink_send_query(
    's02_sw_b',
    $remote$
      select outcome_code
        from public.solmind_save_suggested_waypoint_draft(
          'a3220220-1000-4000-8000-000000000001',
          'a3220220-2000-4000-8000-000000000003',
          'a3220220-1500-4000-8000-000000000001',
          'a3220220-3000-4000-8000-000000000001',
          1,
          'Protect one evening each week for recovery',
          'Competing stale revision',
          '["One evening stays unscheduled"]'::jsonb
        )
    $remote$
  ),
  1,
  'competing revision is sent asynchronously'
);
select ok(
  pg_temp.s02_sw_wait_for_lock(
    's02_sw_b',
    (select pid from s02_sw_race_pids where name = 'b')
  ),
  'competing revision waits on the serialized suggestion identity'
);
select is(dblink_exec('s02_sw_a', 'commit'), 'COMMIT',
          'revision winner commits');
create temp table s02_sw_revision_loser as
select * from dblink_get_result('s02_sw_b') result(outcome_code text);
do $$
begin
  perform * from dblink_get_result('s02_sw_b') result(outcome_code text);
end;
$$;
select is((select outcome_code from s02_sw_revision_loser), 'stale',
          'competing expected revision returns stale after the winner');
select is(dblink_exec('s02_sw_b', 'commit'), 'COMMIT',
          'competing revision closes without a write');

select is(dblink_exec('s02_sw_a', 'begin'), 'BEGIN',
          'changed-payload replay winner begins');
create temp table s02_sw_conflict_winner as
select *
  from dblink(
    's02_sw_a',
    $remote$
      select outcome_code
        from public.solmind_save_suggested_waypoint_draft(
          'a3220220-1000-4000-8000-000000000001',
          'a3220220-2000-4000-8000-000000000004',
          'a3220220-1500-4000-8000-000000000001',
          'a3220220-3000-4000-8000-000000000001',
          2,
          'Protect one evening each week for recovery',
          'Committed operation payload',
          '["One evening stays unscheduled"]'::jsonb
        )
    $remote$
  ) result(outcome_code text);
select is((select outcome_code from s02_sw_conflict_winner), 'applied',
          'changed-payload replay winner applies');
select is(dblink_exec('s02_sw_b', 'begin'), 'BEGIN',
          'changed-payload replay contender begins');
select is(
  dblink_send_query(
    's02_sw_b',
    $remote$
      select outcome_code
        from public.solmind_save_suggested_waypoint_draft(
          'a3220220-1000-4000-8000-000000000001',
          'a3220220-2000-4000-8000-000000000004',
          'a3220220-1500-4000-8000-000000000001',
          'a3220220-3000-4000-8000-000000000001',
          2,
          'Protect one evening each week for recovery',
          'Different operation payload',
          '["One evening stays unscheduled"]'::jsonb
        )
    $remote$
  ),
  1,
  'changed-payload replay is sent asynchronously'
);
select ok(
  pg_temp.s02_sw_wait_for_lock(
    's02_sw_b',
    (select pid from s02_sw_race_pids where name = 'b')
  ),
  'changed-payload replay waits on the operation identity'
);
select is(dblink_exec('s02_sw_a', 'commit'), 'COMMIT',
          'changed-payload replay winner commits');
create temp table s02_sw_conflict_loser as
select * from dblink_get_result('s02_sw_b') result(outcome_code text);
do $$
begin
  perform * from dblink_get_result('s02_sw_b') result(outcome_code text);
end;
$$;
select is((select outcome_code from s02_sw_conflict_loser),
          'operation_conflict',
          'concurrent changed payload under one operation identity conflicts');
select is(dblink_exec('s02_sw_b', 'commit'), 'COMMIT',
          'changed-payload contender closes without a write');

select is(dblink_exec('s02_sw_a', 'begin'), 'BEGIN',
          'schedule transaction begins');
create temp table s02_sw_schedule as
select *
  from dblink(
    's02_sw_a',
    $remote$
      select outcome_code
        from public.solmind_schedule_suggested_waypoint_send(
          'a3220220-1000-4000-8000-000000000001',
          'a3220220-2100-4000-8000-000000000001',
          'a3220220-3000-4000-8000-000000000001',
          'a3220220-3100-4000-8000-000000000001',
          3
        )
    $remote$
  ) result(outcome_code text);
select is((select outcome_code from s02_sw_schedule), 'applied',
          'one pending outbound transition is scheduled');
select is(dblink_exec('s02_sw_a', 'commit'), 'COMMIT',
          'pending transition commits');

begin;
update content.suggested_waypoint_pending_outbound
   set deadline_at = pg_catalog.clock_timestamp() + interval '5 seconds'
 where suggested_waypoint_id = 'a3220220-3000-4000-8000-000000000001';
commit;

select is(dblink_exec('s02_sw_a', 'begin'), 'BEGIN',
          'Pull Back winner begins before deadline');
create temp table s02_sw_pull_winner as
select *
  from dblink(
    's02_sw_a',
    $remote$
      select outcome_code
        from public.solmind_pull_back_suggested_waypoint(
          'a3220220-1000-4000-8000-000000000001',
          'a3220220-2200-4000-8000-000000000001',
          'a3220220-3000-4000-8000-000000000001',
          3,
          'a3220220-3100-4000-8000-000000000001'
        )
    $remote$
  ) result(outcome_code text);
select is((select outcome_code from s02_sw_pull_winner), 'applied',
          'Pull Back applies before the deadline and holds the owner lock');
select pg_catalog.pg_sleep(5.10);
select is(dblink_exec('s02_sw_b', 'begin'), 'BEGIN',
          'delivery contender begins after deadline');
select is(
  dblink_send_query(
    's02_sw_b',
    $remote$
      select outcome_code
        from public.solmind_deliver_suggested_waypoint(
          'a3220220-2300-4000-8000-000000000001',
          'a3220220-3000-4000-8000-000000000001',
          'a3220220-3100-4000-8000-000000000001'
        )
    $remote$
  ),
  1,
  'delivery contender is sent asynchronously'
);
select ok(
  pg_temp.s02_sw_wait_for_lock(
    's02_sw_b',
    (select pid from s02_sw_race_pids where name = 'b')
  ),
  'delivery contender waits behind the Pull Back transition'
);
select is(dblink_exec('s02_sw_a', 'commit'), 'COMMIT',
          'Pull Back winner commits');
create temp table s02_sw_delivery_loser as
select * from dblink_get_result('s02_sw_b') result(outcome_code text);
do $$
begin
  perform * from dblink_get_result('s02_sw_b') result(outcome_code text);
end;
$$;
select is((select outcome_code from s02_sw_delivery_loser),
          'invalid_transition',
          'blocked delivery observes consumed pending state and writes nothing');
select is(dblink_exec('s02_sw_b', 'commit'), 'COMMIT',
          'delivery contender closes without a delivery');

select is(
  (
    select pg_catalog.count(*)::integer
      from content.suggested_waypoint_pending_outbound
     where suggested_waypoint_id = 'a3220220-3000-4000-8000-000000000001'
  ),
  0,
  'Pull Back versus delivery race leaves no pending transition'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from content.suggested_waypoint_version
     where suggested_waypoint_id = 'a3220220-3000-4000-8000-000000000001'
  ),
  0,
  'losing delivery creates no immutable version'
);

select is(dblink_exec('s02_sw_a', 'begin'), 'BEGIN',
          'second schedule transaction begins');
create temp table s02_sw_schedule_delivery_wins as
select *
  from dblink(
    's02_sw_a',
    $remote$
      select outcome_code
        from public.solmind_schedule_suggested_waypoint_send(
          'a3220220-1000-4000-8000-000000000001',
          'a3220220-2100-4000-8000-000000000002',
          'a3220220-3000-4000-8000-000000000001',
          'a3220220-3100-4000-8000-000000000002',
          4
        )
    $remote$
  ) result(outcome_code text);
select is((select outcome_code from s02_sw_schedule_delivery_wins), 'applied',
          'restored draft is scheduled for the delivery-wins race');
select is(dblink_exec('s02_sw_a', 'commit'), 'COMMIT',
          'second pending transition commits');

begin;
update content.suggested_waypoint_pending_outbound
   set scheduled_at = pg_catalog.clock_timestamp() - interval '10 minutes',
       deadline_at = pg_catalog.clock_timestamp() - interval '5 minutes'
 where suggested_waypoint_id = 'a3220220-3000-4000-8000-000000000001';
commit;

select is(dblink_exec('s02_sw_a', 'begin'), 'BEGIN',
          'delivery winner begins after deadline');
create temp table s02_sw_delivery_winner as
select *
  from dblink(
    's02_sw_a',
    $remote$
      select outcome_code
        from public.solmind_deliver_suggested_waypoint(
          'a3220220-2300-4000-8000-000000000002',
          'a3220220-3000-4000-8000-000000000001',
          'a3220220-3100-4000-8000-000000000002'
        )
    $remote$
  ) result(outcome_code text);
select is((select outcome_code from s02_sw_delivery_winner), 'applied',
          'delivery applies at or after the frozen deadline');
select is(dblink_exec('s02_sw_b', 'begin'), 'BEGIN',
          'Pull Back contender begins after delivery holds the owner lock');
select is(
  dblink_send_query(
    's02_sw_b',
    $remote$
      select outcome_code
        from public.solmind_pull_back_suggested_waypoint(
          'a3220220-1000-4000-8000-000000000001',
          'a3220220-2200-4000-8000-000000000002',
          'a3220220-3000-4000-8000-000000000001',
          4,
          'a3220220-3100-4000-8000-000000000002'
        )
    $remote$
  ),
  1,
  'Pull Back contender is sent asynchronously'
);
select ok(
  pg_temp.s02_sw_wait_for_lock(
    's02_sw_b',
    (select pid from s02_sw_race_pids where name = 'b')
  ),
  'Pull Back contender waits behind committed delivery'
);
select is(dblink_exec('s02_sw_a', 'commit'), 'COMMIT',
          'delivery winner commits');
create temp table s02_sw_pull_loser as
select * from dblink_get_result('s02_sw_b') result(outcome_code text);
do $$
begin
  perform * from dblink_get_result('s02_sw_b') result(outcome_code text);
end;
$$;
select is((select outcome_code from s02_sw_pull_loser),
          'invalid_transition',
          'blocked Pull Back observes the delivered state and writes nothing');
select is(dblink_exec('s02_sw_b', 'commit'), 'COMMIT',
          'Pull Back contender closes without a write');
select is(
  (
    select pg_catalog.count(*)::integer
      from content.suggested_waypoint_pending_outbound
     where suggested_waypoint_id = 'a3220220-3000-4000-8000-000000000001'
  ),
  0,
  'delivery-wins race leaves no pending transition'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from content.suggested_waypoint_version
     where suggested_waypoint_id = 'a3220220-3000-4000-8000-000000000001'
  ),
  1,
  'delivery-wins race creates exactly one immutable version'
);

select is(dblink_exec('s02_sw_a', 'begin'), 'BEGIN',
          'read winner begins');
create temp table s02_sw_read_winner as
select *
  from dblink(
    's02_sw_a',
    $remote$
      select outcome_code
        from public.solmind_mark_suggested_waypoint_read(
          'a3220220-1000-4000-8000-000000000002',
          'a3220220-2400-4000-8000-000000000001',
          'a3220220-3000-4000-8000-000000000001',
          'a3220220-3100-4000-8000-000000000002'
        )
    $remote$
  ) result(outcome_code text);
select is((select outcome_code from s02_sw_read_winner), 'applied',
          'first private read applies and holds the owner lock');
select is(dblink_exec('s02_sw_b', 'begin'), 'BEGIN',
          'competing private read begins');
select is(
  dblink_send_query(
    's02_sw_b',
    $remote$
      select outcome_code
        from public.solmind_mark_suggested_waypoint_read(
          'a3220220-1000-4000-8000-000000000002',
          'a3220220-2400-4000-8000-000000000002',
          'a3220220-3000-4000-8000-000000000001',
          'a3220220-3100-4000-8000-000000000002'
        )
    $remote$
  ),
  1,
  'competing private read is sent asynchronously'
);
select ok(
  pg_temp.s02_sw_wait_for_lock(
    's02_sw_b',
    (select pid from s02_sw_race_pids where name = 'b')
  ),
  'competing private read waits instead of racing the read-state insert'
);
select is(dblink_exec('s02_sw_a', 'commit'), 'COMMIT',
          'read winner commits');
create temp table s02_sw_read_loser as
select * from dblink_get_result('s02_sw_b') result(outcome_code text);
do $$
begin
  perform * from dblink_get_result('s02_sw_b') result(outcome_code text);
end;
$$;
select is((select outcome_code from s02_sw_read_loser),
          'invalid_transition',
          'competing private read returns a typed outcome without a raw error');
select is(dblink_exec('s02_sw_b', 'commit'), 'COMMIT',
          'competing private read closes without a write');
select is(
  (
    select pg_catalog.count(*)::integer
      from content.suggested_waypoint_explorer_read_state
     where suggested_waypoint_id = 'a3220220-3000-4000-8000-000000000001'
  ),
  1,
  'concurrent private reads create exactly one read-state row'
);

select is(dblink_exec('s02_sw_a', 'begin'), 'BEGIN',
          'receipt winner begins');
create temp table s02_sw_receipt_winner as
select *
  from dblink(
    's02_sw_a',
    $remote$
      select outcome_code
        from public.solmind_acknowledge_suggested_waypoint_receipt(
          'a3220220-1000-4000-8000-000000000002',
          'a3220220-2500-4000-8000-000000000001',
          'a3220220-3000-4000-8000-000000000001',
          'a3220220-3100-4000-8000-000000000002'
        )
    $remote$
  ) result(outcome_code text);
select is((select outcome_code from s02_sw_receipt_winner), 'applied',
          'first receipt acknowledgement applies and holds the owner lock');
select is(dblink_exec('s02_sw_b', 'begin'), 'BEGIN',
          'competing receipt acknowledgement begins');
select is(
  dblink_send_query(
    's02_sw_b',
    $remote$
      select outcome_code
        from public.solmind_acknowledge_suggested_waypoint_receipt(
          'a3220220-1000-4000-8000-000000000002',
          'a3220220-2500-4000-8000-000000000002',
          'a3220220-3000-4000-8000-000000000001',
          'a3220220-3100-4000-8000-000000000002'
        )
    $remote$
  ),
  1,
  'competing receipt acknowledgement is sent asynchronously'
);
select ok(
  pg_temp.s02_sw_wait_for_lock(
    's02_sw_b',
    (select pid from s02_sw_race_pids where name = 'b')
  ),
  'competing receipt acknowledgement waits on the owner row'
);
select is(dblink_exec('s02_sw_a', 'commit'), 'COMMIT',
          'receipt winner commits');
create temp table s02_sw_receipt_loser as
select * from dblink_get_result('s02_sw_b') result(outcome_code text);
do $$
begin
  perform * from dblink_get_result('s02_sw_b') result(outcome_code text);
end;
$$;
select is((select outcome_code from s02_sw_receipt_loser),
          'invalid_transition',
          'competing receipt acknowledgement returns a typed outcome');
select is(dblink_exec('s02_sw_b', 'commit'), 'COMMIT',
          'competing receipt acknowledgement closes without a write');
select is(
  (
    select pg_catalog.count(*)::integer
      from content.suggested_waypoint_receipt
     where suggested_waypoint_id = 'a3220220-3000-4000-8000-000000000001'
  ),
  1,
  'concurrent acknowledgements create exactly one receipt row'
);

select is(dblink_exec('s02_sw_a', 'reset role'), 'RESET',
          'state-guard probe restores the migration owner role');
select throws_ok(
  $$
    select dblink_exec(
      's02_sw_a',
      $remote$
        insert into content.suggested_waypoint (
          suggested_waypoint_id,
          guide_explorer_relationship_id,
          guide_profile_id,
          explorer_profile_id,
          created_by_guide_user_account_id,
          authoring_mode,
          authoring_revision,
          last_operation_id,
          audit_correlation_id
        ) values (
          'a3220220-3000-4000-8000-000000000399',
          'a3220220-1500-4000-8000-000000000001',
          'a3220220-1300-4000-8000-000000000001',
          'a3220220-1400-4000-8000-000000000001',
          'a3220220-1000-4000-8000-000000000001',
          'draft',
          1,
          'a3220220-2000-4000-8000-000000000399',
          'a3220220-2600-4000-8000-000000000399'
        )
      $remote$
    )
  $$,
  'P0001',
  null,
  'deferred state guard rejects an owner committed without its draft'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from content.suggested_waypoint owner_row
     where owner_row.suggested_waypoint_id =
           'a3220220-3000-4000-8000-000000000399'
  ),
  0,
  'rejected inconsistent owner leaves no committed residue'
);

select is(dblink_disconnect('s02_sw_a'), 'OK',
          'connection A closes');
select is(dblink_disconnect('s02_sw_b'), 'OK',
          'connection B closes');

-- Cleanup exact reserved identities. Immutable proof triggers are disabled only
-- for this local infrastructure test's explicit committed-fixture teardown.
begin;
alter table content.suggested_waypoint_operation_result disable trigger user;
alter table content.suggested_waypoint_receipt disable trigger user;
alter table content.suggested_waypoint_explorer_read_state disable trigger user;
alter table content.suggested_waypoint_version disable trigger user;
delete from audit.audit_event
 where target_entity_id = 'a3220220-3000-4000-8000-000000000001';
delete from content.suggested_waypoint_operation_result
 where suggested_waypoint_id = 'a3220220-3000-4000-8000-000000000001';
delete from content.suggested_waypoint_receipt
 where suggested_waypoint_id = 'a3220220-3000-4000-8000-000000000001';
delete from content.suggested_waypoint_explorer_read_state
 where suggested_waypoint_id = 'a3220220-3000-4000-8000-000000000001';
delete from content.suggested_waypoint_pending_outbound
 where suggested_waypoint_id = 'a3220220-3000-4000-8000-000000000001';
delete from content.suggested_waypoint_guide_draft
 where suggested_waypoint_id = 'a3220220-3000-4000-8000-000000000001';
update content.suggested_waypoint
   set authoring_mode = 'draft',
       current_version_id = null
 where suggested_waypoint_id = 'a3220220-3000-4000-8000-000000000001';
delete from content.suggested_waypoint_version
 where suggested_waypoint_id = 'a3220220-3000-4000-8000-000000000001';
delete from content.suggested_waypoint
 where suggested_waypoint_id in (
   'a3220220-3000-4000-8000-000000000001',
   'a3220220-3000-4000-8000-000000000399'
 );
alter table content.suggested_waypoint_operation_result enable trigger user;
alter table content.suggested_waypoint_receipt enable trigger user;
alter table content.suggested_waypoint_explorer_read_state enable trigger user;
alter table content.suggested_waypoint_version enable trigger user;
delete from core.guide_explorer_relationship
 where guide_explorer_relationship_id =
       'a3220220-1500-4000-8000-000000000001';
delete from core.explorer_profile
 where explorer_profile_id = 'a3220220-1400-4000-8000-000000000001';
delete from core.guide_profile
 where guide_profile_id = 'a3220220-1300-4000-8000-000000000001';
delete from core.practice
 where practice_id = 'a3220220-1200-4000-8000-000000000001';
delete from core.organization
 where organization_id = 'a3220220-1100-4000-8000-000000000001';
delete from identity.user_role_assignment
 where user_account_id in (
   'a3220220-1000-4000-8000-000000000001',
   'a3220220-1000-4000-8000-000000000002'
 );
delete from identity.user_account
 where user_account_id in (
   'a3220220-1000-4000-8000-000000000001',
   'a3220220-1000-4000-8000-000000000002'
 );

select is(
  (
    select pg_catalog.count(*)::integer
      from content.suggested_waypoint
     where suggested_waypoint_id in (
       'a3220220-3000-4000-8000-000000000001',
       'a3220220-3000-4000-8000-000000000399'
     )
  ),
  0,
  'reserved concurrent fixture is removed'
);
select * from finish();
commit;
