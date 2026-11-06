-- Lane 7 two-connection account-lock contention proof. Executor only: isolated
-- local database with dblink installed/available. No synthetic users, sessions,
-- conversations or committed content are needed, so one-active remains intact.
-- This proves actual concurrent owner-lock exclusion for the insertion/closure
-- owners. Full authority/capacity behavior is tested in active_limits_test.sql.
-- The second connections use the same local test connection as the other
-- concurrency suites in this folder.
begin;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
set local search_path=public,extensions,pg_catalog,pg_temp;
set local statement_timeout='30s';
select plan(15);

select lives_ok(format($q$select dblink_connect('waypoint_limits_a',
  'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5')$q$,
  current_database()),
  'connection A opens');
select lives_ok(format($q$select dblink_connect('waypoint_limits_b',
  'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5')$q$,
  current_database()),
  'connection B opens separately');
select ok((select a.pid<>b.pid from dblink('waypoint_limits_a','select pg_backend_pid()') a(pid integer)
  cross join dblink('waypoint_limits_b','select pg_backend_pid()') b(pid integer)),
  'the contenders are distinct PostgreSQL backend connections');
select is(dblink_exec('waypoint_limits_a','begin isolation level read committed'),'BEGIN','A begins the owner transaction');
select lives_ok($q$select * from dblink('waypoint_limits_a',
  $remote$select ai.solmind_private_owner_lock_v3('f47c0000-0000-4000-8000-000000000001')$remote$) held(result text)$q$,
  'A holds the real private account transaction lock');
select is(dblink_exec('waypoint_limits_b',$remote$
  create function pg_temp.waypoint_try(command text) returns text language plpgsql as $body$
  begin execute command; return 'unexpected_success';
  exception when others then return sqlerrm; end $body$
$remote$),'CREATE FUNCTION','B installs a local value-free exception capture');

-- A remains open while every independent B statement actually attempts the
-- same account lock. The try-lock must refuse promptly, before input/auth reads.
select is((select result from dblink('waypoint_limits_b',$remote$select pg_temp.waypoint_try(
  $$select * from public.solmind_mutate_explorer_conversation(
    'f47c0000-0000-4000-8000-000000000001',null,null,null,null,null,null)$$)$remote$) r(result text)),
  'solmind_explorer_private_unavailable','manual confirmation cannot pass a concurrent owner lock');
select is((select result from dblink('waypoint_limits_b',$remote$select pg_temp.waypoint_try(
  $$select * from public.solmind_confirm_explorer_waypoint_revision_v1(
    'f47c0000-0000-4000-8000-000000000001',null,null,null,null,null,null,null,null)$$)$remote$) r(result text)),
  'solmind_explorer_private_unavailable','revision and revisit cannot pass a concurrent owner lock');
select is((select result from dblink('waypoint_limits_b',$remote$select pg_temp.waypoint_try(
  $$select * from public.solmind_respond_explorer_waypoint_draft_v1(
    'f47c0000-0000-4000-8000-000000000001',null,null,null,null,null,null,null)$$)$remote$) r(result text)),
  'solmind_explorer_private_unavailable','draft confirmation cannot pass a concurrent owner lock');
select is((select result from dblink('waypoint_limits_b',$remote$select pg_temp.waypoint_try(
  $$select * from public.solmind_settle_explorer_conversation_turn_v4(
    'f47c0000-0000-4000-8000-000000000001',null,null,null,null,null,null,null,
    null::smallint,null,null,null,null,null,null,null,null,null::smallint,null,null,null,null)$$)$remote$) r(result text)),
  'solmind_explorer_private_unavailable','typed confirmation settlement cannot pass a concurrent owner lock');
select is((select result from dblink('waypoint_limits_b',$remote$select pg_temp.waypoint_try(
  $$select * from public.solmind_close_ended_explorer_waypoint_v1(
    'f47c0000-0000-4000-8000-000000000001',null,null,null,null,null,null)$$)$remote$) r(result text)),
  'solmind_explorer_private_unavailable','competing post-End terminal choices share the exact owner lock');
select lives_ok($q$select * from dblink('waypoint_limits_b',
  $remote$select ai.solmind_private_owner_lock_v3('f47c0000-0000-4000-8000-000000000002')$remote$) held(result text)$q$,
  'an unrelated Explorer account is not blocked by A');
select is(dblink_exec('waypoint_limits_a','rollback'),'ROLLBACK','A releases its account transaction lock without writes');
select lives_ok($q$select * from dblink('waypoint_limits_b',
  $remote$select ai.solmind_private_owner_lock_v3('f47c0000-0000-4000-8000-000000000001')$remote$) held(result text)$q$,
  'B can take the same owner lock only after A ends');
select ok(dblink_disconnect('waypoint_limits_a')='OK' and dblink_disconnect('waypoint_limits_b')='OK',
  'both real connections close');
select * from finish();
rollback;
