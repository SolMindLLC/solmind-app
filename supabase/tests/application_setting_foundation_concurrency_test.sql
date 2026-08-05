-- Local ephemeral database only. This test commits reserved synthetic
-- operations across dblink sessions, then restores the exact singleton state
-- and deletes only its reserved audit rows. Never run against hosted or
-- real-user data.
-- If execution aborts after a dblink commit, the absolute-baseline S02 and
-- audit suites will fail until the cleanup block below is run manually or an
-- idle local database is reset under solmind-app/AGENTS.md.

begin;
create extension if not exists dblink;
select plan(20);

create function pg_temp.s02_setting_wait_for_lock(
  p_connection text,
  p_pid integer
)
returns boolean
language plpgsql
as $$
begin
  for attempt in 1..40 loop
    if dblink_is_busy(p_connection) = 1
       and exists (
         select 1
           from pg_catalog.pg_stat_activity
          where pid = p_pid
            and wait_event_type = 'Lock'
       )
    then
      return true;
    end if;
    perform pg_catalog.pg_sleep(0.10);
  end loop;
  return false;
end;
$$;

create temp table s02_setting_before as
select setting.*,
       (
         select pg_catalog.count(*)::integer
           from audit.audit_event event
          where event.event_type = 'application_setting_changed'
            and event.metadata ->> 'operation_id' like
                'a30f0210-2000-%'
       ) as reserved_audit_count
  from core.application_setting setting
 where setting.application_setting_id =
       'a30f0210-0000-4000-8000-000000000001';

select is(
  (select pg_catalog.count(*)::integer from s02_setting_before),
  1,
  'preflight captures the singleton setting'
);
select is(
  (select reserved_audit_count from s02_setting_before),
  0,
  'preflight finds no reserved concurrency audit residue'
);

select lives_ok(
  pg_catalog.format(
    $q$select dblink_connect(
      's02_setting_a',
      'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5'
    )$q$,
    pg_catalog.current_database()
  ),
  'connection A opens'
);
select lives_ok(
  pg_catalog.format(
    $q$select dblink_connect(
      's02_setting_b',
      'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5'
    )$q$,
    pg_catalog.current_database()
  ),
  'connection B opens'
);
select is(
  dblink_exec('s02_setting_a', 'set statement_timeout=''8s'''),
  'SET',
  'connection A statement timeout is bounded'
);
select is(
  dblink_exec('s02_setting_b', 'set statement_timeout=''8s'''),
  'SET',
  'connection B statement timeout is bounded'
);

create temp table s02_setting_pids as
select 'a'::text as name, pid
  from dblink('s02_setting_a', 'select pg_backend_pid()')
       result(pid integer)
union all
select 'b'::text as name, pid
  from dblink('s02_setting_b', 'select pg_backend_pid()')
       result(pid integer);

select is(
  (select pg_catalog.count(distinct pid)::integer
     from s02_setting_pids),
  2,
  'workers use distinct database sessions'
);
select is(
  dblink_exec('s02_setting_a', 'begin'),
  'BEGIN',
  'connection A begins'
);
select is(
  dblink_exec('s02_setting_b', 'begin'),
  'BEGIN',
  'connection B begins'
);
select dblink_exec(
  's02_setting_b',
  $remote$
    create function pg_temp.s02_setting_capture_conflict(
      p_integer_value integer,
      p_expected_version bigint
    )
    returns table(
      error_sqlstate text,
      error_message text
    )
    language plpgsql
    as $function$
    begin
      perform *
        from public.solmind_set_application_setting_integer(
          'explorer_shared_snapshot_sendability_days',
          p_integer_value,
          p_expected_version,
          'a30f0210-2000-4000-8000-000000000002',
          'system_operations_runbook',
          'a30f0210-4000-4000-8000-000000000002',
          'runbook_configuration_change'
        );

      return query
      select null::text, null::text;
    exception
      when others then
        return query
        select sqlstate::text, sqlerrm::text;
    end;
    $function$
  $remote$
);

create temp table s02_setting_a_result as
select *
  from dblink(
    's02_setting_a',
    pg_catalog.format(
      $call$
        select *
          from public.solmind_set_application_setting_integer(
            'explorer_shared_snapshot_sendability_days',
            %s,
            %s,
            'a30f0210-2000-4000-8000-000000000001',
            'paul_approved',
            'a30f0210-4000-4000-8000-000000000001',
            'paul_approved_configuration_change'
          )
      $call$,
      case
        when (select integer_value from s02_setting_before) = 100
          then 99
        else (select integer_value + 1 from s02_setting_before)
      end,
      (select version from s02_setting_before)
    )
  ) result(
    outcome text,
    setting_key text,
    integer_value integer,
    version bigint
  );

select is(
  (select outcome from s02_setting_a_result),
  'applied',
  'A applies inside its open transaction'
);
select is(
  dblink_send_query(
    's02_setting_b',
    pg_catalog.format(
      $call$
        select *
          from pg_temp.s02_setting_capture_conflict(
            %s,
            %s
          )
      $call$,
      case
        when (select integer_value from s02_setting_before) = 1
          then 2
        else (select integer_value - 1 from s02_setting_before)
      end,
      (select version from s02_setting_before)
    )
  ),
  1,
  'B launches a competing stale-version request asynchronously'
);
select ok(
  pg_temp.s02_setting_wait_for_lock(
    's02_setting_b',
    (select pid from s02_setting_pids where name = 'b')
  ),
  'B waits on the protected singleton row'
);
select is(
  dblink_exec('s02_setting_a', 'commit'),
  'COMMIT',
  'A commits the first mutation'
);
create temp table s02_setting_b_error as
select *
  from dblink_get_result('s02_setting_b')
       result(
         error_sqlstate text,
         error_message text
       );

-- Drain the asynchronous query's terminal result before issuing another
-- command on connection B. A single SELECT was sent, so this second read is
-- expected to return no rows and releases the connection for rollback.
select *
  from dblink_get_result('s02_setting_b')
       result(
         error_sqlstate text,
         error_message text
       );

select is(
  (select error_sqlstate from s02_setting_b_error),
  'P0001',
  'B fails closed with the application exception SQLSTATE'
);
select is(
  (select error_message from s02_setting_b_error),
  'solmind_application_setting_version_conflict',
  'B fails closed after observing the committed newer version'
);
select is(
  dblink_exec('s02_setting_b', 'rollback'),
  'ROLLBACK',
  'B rolls back its failed transaction'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where event_type = 'application_setting_changed'
       and metadata ->> 'operation_id' like 'a30f0210-2000-%'
  ),
  1,
  'only the winning mutation writes an audit row'
);
select is(
  (
    select version
      from core.application_setting
  ),
  (select version + 1 from s02_setting_before),
  'first commit advances the version exactly once'
);

select lives_ok(
  $cleanup$
    update core.application_setting setting
       set integer_value = before.integer_value,
           minimum_integer_value = before.minimum_integer_value,
           default_integer_value = before.default_integer_value,
           maximum_integer_value = before.maximum_integer_value,
           version = before.version,
           last_operation_id = before.last_operation_id,
           created_at = before.created_at,
           updated_at = before.updated_at,
           retention_class = before.retention_class
      from s02_setting_before before
     where setting.application_setting_id =
           before.application_setting_id;

    delete from audit.audit_event
     where event_type = 'application_setting_changed'
       and metadata ->> 'operation_id' like 'a30f0210-2000-%';
  $cleanup$,
  'targeted local-only cleanup restores the singleton and audit rows'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where event_type = 'application_setting_changed'
       and metadata ->> 'operation_id' like 'a30f0210-2000-%'
  ),
  0,
  'reserved concurrency audit residue is zero'
);

select dblink_disconnect('s02_setting_a');
select dblink_disconnect('s02_setting_b');
select * from finish();
commit;
