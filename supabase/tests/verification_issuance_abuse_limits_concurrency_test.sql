-- Login step 2 / AUTH-RLS-DEC-037: the contact-wide lock serializes issuance across purposes, so two concurrent
-- requests for one contact at five used cannot both commit. A timeout on the contact lock maps to the fixed
-- lock-unavailable error, and a repeatable-read or serializable transaction (which could count from a stale snapshot)
-- fails closed (review #109a). Refused requests run as single committed statements and are shown to write nothing; a
-- longer existing transaction timeout is refused; and the server ends a transaction that stays open past the 60-second
-- bound an issuance sets (review #109b). Local ephemeral database only; modeled on
-- verification_challenge_issuance_concurrency_test.sql (same dblink connection method and cleanup rule).
-- A hard SQL error can leave reserved rows. Recovery requires Paul's approval:
-- delete from audit.audit_event where target_entity_id::text like '5a590059-%';
-- delete from identity.verification_challenge where normalized_contact_value like 'limits-race%@synthetic.invalid';
begin;
create extension if not exists dblink;
select plan(42);

create function pg_temp.limits_wait_for_lock(p_connection text, p_pid integer)
returns boolean language plpgsql as $$
begin
  for attempt in 1..30 loop
    if dblink_is_busy(p_connection) = 1 and exists (select 1 from pg_catalog.pg_stat_activity
      where pid = p_pid and wait_event_type = 'Lock') then return true; end if;
    perform pg_catalog.pg_sleep(0.10);
  end loop;
  return false;
end;
$$;

select lives_ok(pg_catalog.format($q$select dblink_connect('limits_a','host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5')$q$, pg_catalog.current_database()), 'connection A opens');
select lives_ok(pg_catalog.format($q$select dblink_connect('limits_b','host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5')$q$, pg_catalog.current_database()), 'connection B opens');
create temp table limits_pids(name text primary key, pid int) on commit drop;
insert into limits_pids select 'b', pid from dblink('limits_b', 'select pg_backend_pid()') x(pid int);

-- Five committed prior issuances for the race contact, in two purposes (committed through A so B can see them).
select is(dblink_exec('limits_a', $q$insert into identity.verification_challenge(normalized_contact_value, contact_method_type,
  purpose, delivery_channel, code_hash, expires_at, created_at, invalidated_at)
  select 'limits-race@synthetic.invalid', 'email', p, 'email', 'svf1:' || repeat('0', 64),
         now() - make_interval(mins => m) + interval '10 minutes', now() - make_interval(mins => m),
         now() - make_interval(mins => m) + interval '1 second'
    from (values ('login', 50), ('login', 40), ('contact_verify', 30), ('contact_verify', 20), ('login', 10)) v(p, m)$q$),
  'INSERT 0 5', 'five committed prior issuances in the rolling hour');

select is(dblink_exec('limits_a', 'set role service_role'), 'SET', 'A assumes service_role');
select is(dblink_exec('limits_b', 'set role service_role'), 'SET', 'B assumes service_role');
select is(dblink_exec('limits_a', 'begin'), 'BEGIN', 'A begins');
select is((select outcome from dblink('limits_a', $q$select * from public.solmind_issue_verification_challenge(
  '5a590059-0000-4000-8000-000000000101','limits-race@synthetic.invalid','email','login','email',
  'svf1:' || repeat('b', 64),null,null)$q$) x(outcome text)), 'issued', 'A takes the sixth slot while holding the contact lock');
select ok(dblink_send_query('limits_b', $q$select * from public.solmind_issue_verification_challenge(
  '5a590059-0000-4000-8000-000000000102','limits-race@synthetic.invalid','email','contact_verify','email',
  'svf1:' || repeat('c', 64),null,null)$q$) = 1, 'B submits a different purpose for the same contact');
select ok(pg_temp.limits_wait_for_lock('limits_b', (select pid from limits_pids where name = 'b')),
  'B waits on the contact-wide lock, not only the pair lock');
select is(dblink_exec('limits_a', 'commit'), 'COMMIT', 'A commits the sixth issuance');
select is((select outcome from dblink_get_result('limits_b') x(outcome text)), 'denied',
  'B is denied after A commits: the budget is shared across purposes');
select * from dblink_get_result('limits_b') x(outcome text);
select is((select count(*)::int from identity.verification_challenge
  where verification_challenge_id = '5a590059-0000-4000-8000-000000000102'), 0, 'B wrote no challenge row');

-- A timeout on the contact lock: A holds it for a second contact; B asks for that contact in another purpose.
select is(dblink_exec('limits_a', 'begin'), 'BEGIN', 'A begins a second transaction');
select is((select outcome from dblink('limits_a', $q$select * from public.solmind_issue_verification_challenge(
  '5a590059-0000-4000-8000-000000000103','limits-race-hold@synthetic.invalid','email','login','email',
  'svf1:' || repeat('d', 64),null,null)$q$) x(outcome text)), 'issued', 'A issues for a second contact and keeps its contact lock');
select ok(dblink_send_query('limits_b', $q$select * from public.solmind_issue_verification_challenge(
  '5a590059-0000-4000-8000-000000000104','limits-race-hold@synthetic.invalid','email','contact_verify','email',
  'svf1:' || repeat('e', 64),null,null)$q$) = 1, 'B asks for the held contact in another purpose');
select * from dblink_get_result('limits_b', false) x(outcome text);
select ok(dblink_error_message('limits_b') ~ '^ERROR:\s+solmind_issue_lock_unavailable(\n|$)',
  'the contact-lock timeout maps to the fixed lock-unavailable error');
select * from dblink_get_result('limits_b', false) x(outcome text);
select is((select count(*)::int from identity.verification_challenge where verification_challenge_id = '5a590059-0000-4000-8000-000000000104')
  + (select count(*)::int from audit.audit_event where target_entity_id = '5a590059-0000-4000-8000-000000000104'), 0,
  'the timed-out request, a single committed statement, wrote no challenge or audit row');
select is(dblink_exec('limits_a', 'rollback'), 'ROLLBACK', 'A rolls its second issuance back');

-- Repeatable read and serializable fail closed before counting, so no stale snapshot can miss a committed issuance.
-- Each request is a single statement that would commit anything it wrote.
select is(dblink_exec('limits_b', 'set session characteristics as transaction isolation level repeatable read'), 'SET',
  'B makes repeatable read its default');
select ok(dblink_send_query('limits_b', $q$select * from public.solmind_issue_verification_challenge(
  '5a590059-0000-4000-8000-000000000105','limits-race-iso@synthetic.invalid','email','login','email',
  'svf1:' || repeat('f', 64),null,null)$q$) = 1, 'B asks under repeatable read');
select * from dblink_get_result('limits_b', false) x(outcome text);
select ok(dblink_error_message('limits_b') ~ '^ERROR:\s+solmind_issue_unsupported_isolation(\n|$)',
  'repeatable read fails closed with the fixed isolation error');
select * from dblink_get_result('limits_b', false) x(outcome text);
select is((select count(*)::int from identity.verification_challenge where verification_challenge_id = '5a590059-0000-4000-8000-000000000105')
  + (select count(*)::int from audit.audit_event where target_entity_id = '5a590059-0000-4000-8000-000000000105'), 0,
  'the repeatable-read request wrote no challenge or audit row');
select is(dblink_exec('limits_b', 'set session characteristics as transaction isolation level serializable'), 'SET',
  'B makes serializable its default');
select ok(dblink_send_query('limits_b', $q$select * from public.solmind_issue_verification_challenge(
  '5a590059-0000-4000-8000-000000000106','limits-race-iso@synthetic.invalid','email','login','email',
  'svf1:' || repeat('f', 64),null,null)$q$) = 1, 'B asks under serializable');
select * from dblink_get_result('limits_b', false) x(outcome text);
select ok(dblink_error_message('limits_b') ~ '^ERROR:\s+solmind_issue_unsupported_isolation(\n|$)',
  'serializable fails closed with the fixed isolation error');
select * from dblink_get_result('limits_b', false) x(outcome text);
select is((select count(*)::int from identity.verification_challenge where verification_challenge_id = '5a590059-0000-4000-8000-000000000106')
  + (select count(*)::int from audit.audit_event where target_entity_id = '5a590059-0000-4000-8000-000000000106'), 0,
  'the serializable request wrote no challenge or audit row');
select is(dblink_exec('limits_b', 'set session characteristics as transaction isolation level read committed'), 'SET',
  'B returns to read committed');

-- A longer existing transaction timeout (review #109b) is refused before any read, and writes nothing.
select is(dblink_exec('limits_b', $q$set transaction_timeout = '2min'$q$), 'SET', 'B sets a two-minute transaction timeout');
select ok(dblink_send_query('limits_b', $q$select * from public.solmind_issue_verification_challenge(
  '5a590059-0000-4000-8000-000000000107','limits-race-long@synthetic.invalid','email','login','email',
  'svf1:' || repeat('a', 64),null,null)$q$) = 1, 'B asks with the longer timeout');
select * from dblink_get_result('limits_b', false) x(outcome text);
select ok(dblink_error_message('limits_b') ~ '^ERROR:\s+solmind_issue_unbounded_transaction(\n|$)',
  'a longer existing transaction timeout fails closed with the fixed error');
select * from dblink_get_result('limits_b', false) x(outcome text);
select is((select count(*)::int from identity.verification_challenge where verification_challenge_id = '5a590059-0000-4000-8000-000000000107')
  + (select count(*)::int from audit.audit_event where target_entity_id = '5a590059-0000-4000-8000-000000000107'), 0,
  'the refused request wrote no challenge or audit row');
select is(dblink_exec('limits_b', 'reset transaction_timeout'), 'RESET', 'B resets its timeout');

select is(dblink_exec('limits_a', $q$reset role; delete from audit.audit_event where target_entity_id::text like '5a590059-%';
  delete from identity.verification_challenge where normalized_contact_value = 'limits-race@synthetic.invalid'$q$),
  'DELETE 6', 'owner cleanup removes the six committed rows');
select is((select count(*)::int from identity.verification_challenge
  where normalized_contact_value = 'limits-race@synthetic.invalid'), 0, 'no residue remains');

-- The commit bound (review #109b): C issues in an open transaction, then stays idle past 60 seconds. The bound
-- outlasts the function, and the server ends C's session, so the issuance can never commit. A and B hold no open
-- transaction here, and this session never calls the function, so only C is affected.
select lives_ok(pg_catalog.format($q$select dblink_connect('limits_c','host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5')$q$, pg_catalog.current_database()), 'connection C opens');
insert into limits_pids select 'c', pid from dblink('limits_c', 'select pg_backend_pid()') x(pid int);
select is(dblink_exec('limits_c', 'set role service_role'), 'SET', 'C assumes service_role');
select is(dblink_exec('limits_c', 'begin'), 'BEGIN', 'C begins');
select is((select outcome from dblink('limits_c', $q$select * from public.solmind_issue_verification_challenge(
  '5a590059-0000-4000-8000-000000000108','limits-race-bound@synthetic.invalid','email','login','email',
  'svf1:' || repeat('c', 64),null,null)$q$) x(outcome text)), 'issued', 'C issues and keeps its transaction open');
select is((select v from dblink('limits_c', $q$select pg_catalog.current_setting('transaction_timeout')$q$) x(v text))::interval,
  interval '60 seconds', 'the 60-second bound outlasts the function in C''s transaction');
select pg_catalog.pg_sleep(63);
select ok(not exists (select 1 from pg_catalog.pg_stat_activity where pid = (select pid from limits_pids where name = 'c')),
  'the server ended C''s session once its transaction outlived the bound');
select isnt(dblink_exec('limits_c', 'commit', false), 'COMMIT', 'C cannot commit its issuance afterwards');
select is((select count(*)::int from identity.verification_challenge where verification_challenge_id = '5a590059-0000-4000-8000-000000000108')
  + (select count(*)::int from audit.audit_event where target_entity_id = '5a590059-0000-4000-8000-000000000108'), 0,
  'the ended transaction left no challenge or audit row');
select dblink_disconnect('limits_c');

select * from finish();
rollback;
