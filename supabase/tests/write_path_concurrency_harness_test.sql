-- SolMind MVP0 DEF5-S1: reusable multi-connection concurrency harness foundation.
-- Source contract: execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md
--   Sections 7.2, 11, and 12.
-- Run with: supabase test db  (local stack only; never cloud).
--
-- Scope of THIS file:
--   - prove that pgTAP can orchestrate two genuine additional PostgreSQL sessions;
--   - prove deterministic one-winner compare-and-set behavior under row-lock contention;
--   - prove a guarded failed-attempt increment does not lose concurrent updates or
--     bypass its ceiling;
--   - prove teardown leaves no scratch schema and changes no SolMind application rows.
--
-- No migration installs dblink or creates the scratch objects. CREATE EXTENSION is
-- transaction-scoped, and every scratch object is created/dropped by dblink sessions.
-- The drop-if-exists preamble makes a rerun self-healing after an interrupted prior run.

begin;

create extension if not exists dblink;

select plan(26);

-- Snapshot exact application-table row counts before the harness touches its isolated
-- scratch schema. This is a no-unintended-write proof, not an estimate from statistics.
create temp table solmind_app_row_counts_before (
  relation_name text primary key,
  row_count bigint not null
) on commit drop;

do $snapshot$
declare
  target record;
  exact_count bigint;
begin
  for target in
    select n.nspname as schema_name, c.relname as table_name
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r', 'p')
       and n.nspname in (
         'identity', 'core', 'audit', 'content', 'ai',
         'methodology', 'notification', 'scheduling'
       )
     order by n.nspname, c.relname
  loop
    execute format('select count(*) from %I.%I', target.schema_name, target.table_name)
       into exact_count;
    insert into solmind_app_row_counts_before(relation_name, row_count)
    values (format('%I.%I', target.schema_name, target.table_name), exact_count);
  end loop;
end
$snapshot$;

select cmp_ok(
  (select count(*)::integer from solmind_app_row_counts_before),
  '>',
  0,
  'application-table snapshot is nonempty and cannot pass vacuously'
);

-- The published host port forces password authentication. The in-container localhost
-- route uses trust authentication and PostgreSQL correctly rejects it for non-superuser
-- dblink callers even when a password appears in the connection string.
select lives_ok(
  $$select dblink_connect(
    'def5_s1_a',
    'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres'
  )$$,
  'connection A opens through the password-authenticated local database port'
);

select lives_ok(
  $$select dblink_connect(
    'def5_s1_b',
    'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres'
  )$$,
  'connection B opens through the password-authenticated local database port'
);

create temp table def5_s1_backend_pids (
  connection_name text primary key,
  backend_pid integer not null
) on commit drop;

insert into def5_s1_backend_pids
select 'a', backend_pid
  from dblink('def5_s1_a', 'select pg_backend_pid()') as remote(backend_pid integer)
union all
select 'b', backend_pid
  from dblink('def5_s1_b', 'select pg_backend_pid()') as remote(backend_pid integer);

select is(
  (select count(distinct backend_pid)::integer
     from (
       select pg_backend_pid() as backend_pid
       union all
       select backend_pid from def5_s1_backend_pids
     ) all_backends),
  3,
  'orchestrator, connection A, and connection B are three distinct database sessions'
);

select is(
  dblink_exec('def5_s1_a', 'set statement_timeout = ''5s'''),
  'SET',
  'connection A has a bounded statement timeout'
);

select is(
  dblink_exec('def5_s1_b', 'set statement_timeout = ''5s'''),
  'SET',
  'connection B has a bounded statement timeout'
);

-- Self-healing preamble and isolated fixture creation. These commands commit in the
-- remote session; nothing is installed by a migration or written to a product schema.
select lives_ok(
  $$select dblink_exec(
    'def5_s1_a',
    'drop schema if exists solmind_test_scratch cascade'
  )$$,
  'scratch-schema preamble removes residue from an interrupted prior run'
);

select lives_ok(
  $$select dblink_exec(
    'def5_s1_a',
    'create schema solmind_test_scratch;
     create table solmind_test_scratch.race_probe (
       probe_id integer primary key,
       state text not null,
       failed_attempt_count integer not null,
       invalidated boolean not null
     );
     insert into solmind_test_scratch.race_probe
       (probe_id, state, failed_attempt_count, invalidated)
     values (1, ''eligible'', 3, false)'
  )$$,
  'isolated scratch fixture is created outside every product schema'
);

-- Proof 1: connection A wins a compare-and-set and keeps the row lock open.
select is(dblink_exec('def5_s1_a', 'begin'), 'BEGIN', 'connection A begins CAS transaction');

select is(
  dblink_exec(
    'def5_s1_a',
    'update solmind_test_scratch.race_probe
        set state = ''used''
      where probe_id = 1 and state = ''eligible'''
  ),
  'UPDATE 1',
  'connection A wins the one-row compare-and-set'
);

select ok(
  dblink_send_query(
    'def5_s1_b',
    'with changed as (
       update solmind_test_scratch.race_probe
          set state = ''used''
        where probe_id = 1 and state = ''eligible''
       returning 1
     )
     select count(*)::integer as winner_count from changed'
  ) = 1,
  'connection B submits the competing compare-and-set asynchronously'
);

select pg_sleep(0.10);

select ok(
  dblink_is_busy('def5_s1_b') = 1
  and exists (
    select 1
      from pg_catalog.pg_stat_activity activity
     where activity.pid = (
       select backend_pid from def5_s1_backend_pids where connection_name = 'b'
     )
       and activity.wait_event_type = 'Lock'
  ),
  'connection B is genuinely blocked on connection A row-lock contention'
);

select is(dblink_exec('def5_s1_a', 'commit'), 'COMMIT', 'connection A commits the CAS winner');

select is(
  (select winner_count
     from dblink_get_result('def5_s1_b') as result(winner_count integer)),
  0,
  'connection B resumes and reports zero eligible rows'
);

-- libpq exposes a final empty result after an asynchronous query. Drain it before
-- reusing connection B; this emits no TAP assertion and returns no rows.
select *
  from dblink_get_result('def5_s1_b') as drained(winner_count integer);

-- Proof 2: start at three failures; two concurrent guarded increments must finish at
-- five and invalidate the row. The second update must see the first committed value.
select is(
  dblink_exec(
    'def5_s1_a',
    'update solmind_test_scratch.race_probe
        set failed_attempt_count = 3, invalidated = false
      where probe_id = 1'
  ),
  'UPDATE 1',
  'failed-attempt fixture resets to one below the two-update ceiling path'
);

select is(dblink_exec('def5_s1_a', 'begin'), 'BEGIN', 'connection A begins increment transaction');

select is(
  dblink_exec(
    'def5_s1_a',
    'update solmind_test_scratch.race_probe
        set failed_attempt_count = failed_attempt_count + 1,
            invalidated = (failed_attempt_count + 1 >= 5)
      where probe_id = 1 and failed_attempt_count < 5'
  ),
  'UPDATE 1',
  'connection A performs the first guarded increment'
);

select ok(
  dblink_send_query(
    'def5_s1_b',
    'with changed as (
       update solmind_test_scratch.race_probe
          set failed_attempt_count = failed_attempt_count + 1,
              invalidated = (failed_attempt_count + 1 >= 5)
        where probe_id = 1 and failed_attempt_count < 5
       returning failed_attempt_count, invalidated
     )
     select failed_attempt_count, invalidated from changed'
  ) = 1,
  'connection B submits the concurrent guarded increment asynchronously'
);

select pg_sleep(0.10);

select ok(
  dblink_is_busy('def5_s1_b') = 1
  and exists (
    select 1
      from pg_catalog.pg_stat_activity activity
     where activity.pid = (
       select backend_pid from def5_s1_backend_pids where connection_name = 'b'
     )
       and activity.wait_event_type = 'Lock'
  ),
  'connection B guarded increment is genuinely blocked on the row lock'
);

select is(dblink_exec('def5_s1_a', 'commit'), 'COMMIT', 'connection A commits its increment');

select results_eq(
  $$select failed_attempt_count, invalidated
      from dblink_get_result('def5_s1_b')
        as result(failed_attempt_count integer, invalidated boolean)$$,
  $$values (5, true)$$,
  'connection B observes the committed increment, reaches the ceiling, and invalidates'
);

-- Teardown and residue proofs.
select lives_ok(
  $$select dblink_exec('def5_s1_a', 'drop schema solmind_test_scratch cascade')$$,
  'scratch schema is dropped through a remote session'
);

select ok(
  not exists (
    select 1 from pg_catalog.pg_namespace where nspname = 'solmind_test_scratch'
  ),
  'scratch schema leaves no database residue'
);

select lives_ok(
  $$select dblink_disconnect('def5_s1_a')$$,
  'connection A disconnects cleanly'
);

select lives_ok(
  $$select dblink_disconnect('def5_s1_b')$$,
  'connection B disconnects cleanly'
);

create temp table solmind_app_row_counts_after (
  relation_name text primary key,
  row_count bigint not null
) on commit drop;

do $snapshot$
declare
  target record;
  exact_count bigint;
begin
  for target in
    select n.nspname as schema_name, c.relname as table_name
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r', 'p')
       and n.nspname in (
         'identity', 'core', 'audit', 'content', 'ai',
         'methodology', 'notification', 'scheduling'
       )
     order by n.nspname, c.relname
  loop
    execute format('select count(*) from %I.%I', target.schema_name, target.table_name)
       into exact_count;
    insert into solmind_app_row_counts_after(relation_name, row_count)
    values (format('%I.%I', target.schema_name, target.table_name), exact_count);
  end loop;
end
$snapshot$;

select results_eq(
  $$select relation_name, row_count from solmind_app_row_counts_after order by relation_name$$,
  $$select relation_name, row_count from solmind_app_row_counts_before order by relation_name$$,
  'the harness changes no row count in any SolMind application table'
);

select * from finish();

rollback;
