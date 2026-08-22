-- Local ephemeral database only. This test commits reserved synthetic rows and
-- operations across dblink sessions, then restores the exact selected setting
-- and removes only its reserved identities and audit rows. Never run against
-- hosted or real-user data.

begin;
create extension if not exists dblink;
select plan(20);

create function pg_temp.s03_name_wait_for_lock(
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

create temp table s03_name_before as
select setting.*,
       (
         select pg_catalog.count(*)::integer
           from audit.audit_event event
          where event.event_type =
                'assistant_display_name_setting_changed'
            and event.metadata ->> 'operation_id' like
                'a30f0230-3100-%'
       ) as reserved_audit_count
  from core.assistant_display_name_setting setting
 where setting.assistant_display_name_setting_id =
       'a30f0230-0000-4000-8000-000000000001';

select is(
  (select pg_catalog.count(*)::integer from s03_name_before),
  1,
  'preflight captures the Explorer Virtual Guide setting'
);
select is(
  (select reserved_audit_count from s03_name_before),
  0,
  'preflight finds no reserved concurrency audit residue'
);

insert into identity.user_account (
  user_account_id, display_name, account_status
) values (
  'a30f0230-1100-4000-8000-000000000001',
  'Concurrency Admin',
  'active'
);
insert into identity.user_role_assignment (
  user_role_assignment_id, user_account_id, role_code, role_status
) values (
  'a30f0230-2100-4000-8000-000000000001',
  'a30f0230-1100-4000-8000-000000000001',
  'admin',
  'active'
);
commit;

begin;
select lives_ok(
  pg_catalog.format(
    $q$select dblink_connect(
      's03_name_a',
      'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5'
    )$q$,
    pg_catalog.current_database()
  ),
  'connection A opens'
);
select lives_ok(
  pg_catalog.format(
    $q$select dblink_connect(
      's03_name_b',
      'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5'
    )$q$,
    pg_catalog.current_database()
  ),
  'connection B opens'
);
select is(
  dblink_exec('s03_name_a', 'set statement_timeout=''8s'''),
  'SET',
  'connection A statement timeout is bounded'
);
select is(
  dblink_exec('s03_name_b', 'set statement_timeout=''8s'''),
  'SET',
  'connection B statement timeout is bounded'
);

create temp table s03_name_pids as
select 'a'::text as name, pid
  from dblink('s03_name_a', 'select pg_backend_pid()')
       result(pid integer)
union all
select 'b'::text as name, pid
  from dblink('s03_name_b', 'select pg_backend_pid()')
       result(pid integer);

select is(
  (select pg_catalog.count(distinct pid)::integer from s03_name_pids),
  2,
  'workers use distinct database sessions'
);
select is(
  dblink_exec('s03_name_a', 'begin'),
  'BEGIN',
  'connection A begins'
);
select is(
  dblink_exec('s03_name_b', 'begin'),
  'BEGIN',
  'connection B begins'
);

select dblink_exec(
  's03_name_b',
  $remote$
    create function pg_temp.s03_name_capture_conflict(
      p_display_name text,
      p_expected_version bigint
    )
    returns table(error_sqlstate text, error_message text)
    language plpgsql
    as $function$
    begin
      perform *
        from public.solmind_set_assistant_display_name_setting(
          'a30f0230-1100-4000-8000-000000000001',
          'explorer_virtual_guide_default_display_name',
          p_display_name,
          p_expected_version,
          'a30f0230-3100-4000-8000-000000000002'
        );
      return query select null::text, null::text;
    exception
      when others then
        return query select sqlstate::text, sqlerrm::text;
    end;
    $function$
  $remote$
);

create temp table s03_name_a_result as
select *
  from dblink(
    's03_name_a',
    pg_catalog.format(
      $call$
        select *
          from public.solmind_set_assistant_display_name_setting(
            'a30f0230-1100-4000-8000-000000000001',
            'explorer_virtual_guide_default_display_name',
            'Nivan Alpha',
            %s,
            'a30f0230-3100-4000-8000-000000000001'
          )
      $call$,
      (select version from s03_name_before)
    )
  ) result(
    outcome text,
    setting_key text,
    display_name text,
    version bigint,
    updated_at timestamptz
  );

select is(
  (select outcome from s03_name_a_result),
  'applied',
  'A applies inside its open transaction'
);
select is(
  dblink_send_query(
    's03_name_b',
    pg_catalog.format(
      $call$
        select *
          from pg_temp.s03_name_capture_conflict('Nivan Beta', %s)
      $call$,
      (select version from s03_name_before)
    )
  ),
  1,
  'B launches a competing stale-version request asynchronously'
);
select ok(
  pg_temp.s03_name_wait_for_lock(
    's03_name_b',
    (select pid from s03_name_pids where name = 'b')
  ),
  'B waits on the protected Explorer name row'
);
select is(
  dblink_exec('s03_name_a', 'commit'),
  'COMMIT',
  'A commits the first mutation'
);

create temp table s03_name_b_error as
select *
  from dblink_get_result('s03_name_b')
       result(error_sqlstate text, error_message text);
select *
  from dblink_get_result('s03_name_b')
       result(error_sqlstate text, error_message text);

select is(
  (select error_sqlstate from s03_name_b_error),
  'P0001',
  'B fails closed with the application exception SQLSTATE'
);
select is(
  (select error_message from s03_name_b_error),
  'solmind_assistant_display_name_version_conflict',
  'B fails closed after observing the committed newer version'
);
select is(
  dblink_exec('s03_name_b', 'rollback'),
  'ROLLBACK',
  'B rolls back its failed transaction'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where event_type = 'assistant_display_name_setting_changed'
       and metadata ->> 'operation_id' like 'a30f0230-3100-%'
  ),
  1,
  'only the winning mutation writes an audit row'
);
select is(
  (
    select version
      from core.assistant_display_name_setting
     where setting_key = 'explorer_virtual_guide_default_display_name'
  ),
  (select version + 1 from s03_name_before),
  'first commit advances the version exactly once'
);

select lives_ok(
  $cleanup$
    delete from audit.audit_event
     where event_type = 'assistant_display_name_setting_changed'
       and metadata ->> 'operation_id' like 'a30f0230-3100-%';

    update core.assistant_display_name_setting setting
       set display_name = before.display_name,
           version = before.version,
           last_operation_id = before.last_operation_id,
           updated_by_user_account_id = before.updated_by_user_account_id,
           created_at = before.created_at,
           updated_at = before.updated_at,
           retention_class = before.retention_class
      from s03_name_before before
     where setting.assistant_display_name_setting_id =
           before.assistant_display_name_setting_id;

    delete from identity.user_role_assignment
     where user_role_assignment_id =
           'a30f0230-2100-4000-8000-000000000001';
    delete from identity.user_account
     where user_account_id =
           'a30f0230-1100-4000-8000-000000000001';
  $cleanup$,
  'targeted local-only cleanup restores settings, identity, and audit rows'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where event_type = 'assistant_display_name_setting_changed'
       and metadata ->> 'operation_id' like 'a30f0230-3100-%'
  ),
  0,
  'reserved concurrency audit residue is zero'
);

select dblink_disconnect('s03_name_a');
select dblink_disconnect('s03_name_b');
select * from finish();
commit;
