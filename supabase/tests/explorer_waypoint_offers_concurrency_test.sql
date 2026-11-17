-- Step 1 owner-lock overlap proof, authored for the Executor's owned test DB.
-- This follows explorer_waypoint_active_limits_concurrency_test.sql: independent
-- dblink backends contend on the real owner lock before validation or writes.
-- No committed fixture or user content is needed. Result and replay effects are
-- asserted through real commands in explorer_waypoint_offers_test.sql.
begin;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
set local search_path=public,extensions,pg_catalog,pg_temp;
set local statement_timeout='30s';
select plan(15);

select lives_ok(format($q$select dblink_connect('offers_settlement',
  'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5')$q$,current_database()),
  'settlement contender opens a separate connection');
select lives_ok(format($q$select dblink_connect('offers_button',
  'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5')$q$,current_database()),
  'button contender opens a separate connection');
select ok((select a.pid<>b.pid from dblink('offers_settlement','select pg_backend_pid()') a(pid integer)
  cross join dblink('offers_button','select pg_backend_pid()') b(pid integer)),
  'the contenders are different PostgreSQL backends');
select is(dblink_exec('offers_button',$remote$
  create function pg_temp.offer_try(command text) returns text language plpgsql as $body$
  begin execute command; return 'unexpected_success'; exception when others then return sqlerrm; end $body$
$remote$),'CREATE FUNCTION','button backend captures only the closed refusal code');
select is(dblink_exec('offers_settlement',$remote$
  create function pg_temp.offer_try(command text) returns text language plpgsql as $body$
  begin execute command; return 'unexpected_success'; exception when others then return sqlerrm; end $body$
$remote$),'CREATE FUNCTION','settlement backend captures only the closed refusal code');
select is(dblink_exec('offers_settlement','begin isolation level read committed'),'BEGIN','settlement transaction begins');
select lives_ok($q$select * from dblink('offers_settlement',
  $remote$select ai.solmind_private_owner_lock_v3('f47f1000-0000-4000-8000-000000000001')$remote$) held(result text)$q$,
  'settlement holds the exact owner transaction lock');
select is((select result from dblink('offers_button',$remote$select pg_temp.offer_try(
  $$select * from public.solmind_respond_explorer_waypoint_offer_v1(
    'f47f1000-0000-4000-8000-000000000001',null,null,null,null,null,null,null)$$)$remote$) r(result text)),
  'solmind_explorer_private_unavailable','concurrent button answer cannot pass a settlement owner lock');
select lives_ok($q$select * from dblink('offers_button',
  $remote$select ai.solmind_private_owner_lock_v3('f47f1000-0000-4000-8000-000000000002')$remote$) held(result text)$q$,
  'an unrelated Explorer is not blocked');
select is(dblink_exec('offers_settlement','rollback'),'ROLLBACK','settlement releases its lock without writes');
select is(dblink_exec('offers_button','begin isolation level read committed'),'BEGIN','button transaction begins');
select lives_ok($q$select * from dblink('offers_button',
  $remote$select ai.solmind_private_owner_lock_v3('f47f1000-0000-4000-8000-000000000001')$remote$) held(result text)$q$,
  'button takes the same owner transaction lock after settlement ends');
select is((select result from dblink('offers_settlement',$remote$select pg_temp.offer_try(
  $$select * from public.solmind_settle_explorer_conversation_turn_v4(
    'f47f1000-0000-4000-8000-000000000001',null,null,null,null,null,null,null,null::smallint,
    null,null,null,null,null,null,null,null,null::smallint,null,null,null,null,
    p_waypoint_offer=>null,p_waypoint_offer_response=>null,p_waypoint_offer_drop=>null)$$)$remote$) r(result text)),
  'solmind_explorer_private_unavailable','concurrent typed-answer settlement cannot pass a button owner lock');
select is(dblink_exec('offers_button','rollback'),'ROLLBACK','button releases its lock without writes');
select ok(dblink_disconnect('offers_settlement')='OK' and dblink_disconnect('offers_button')='OK',
  'both independent backends disconnect');
select * from finish();
rollback;
