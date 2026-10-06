-- Login step 6a real-function concurrency proofs for public.solmind_logout_user_session.
-- Local ephemeral database only. Two dblink connections commit synthetic rows with the
-- reserved id prefix 106a0000-3 and remove them before the end.
-- A hard SQL error can leave reserved synthetic rows. Recovery requires Paul's approval:
-- delete from audit.audit_event where actor_user_account_id::text like '106a0000-%';
-- delete from identity.authorizing_evidence_consumption where verification_challenge_id::text like '106a0000-%';
-- delete from identity.user_session where user_account_id::text like '106a0000-%';
-- delete from identity.verification_challenge where verification_challenge_id::text like '106a0000-%';
-- delete from identity.user_contact_method where user_account_id::text like '106a0000-%';
-- delete from identity.user_role_assignment where user_account_id::text like '106a0000-%';
-- delete from identity.user_account where user_account_id::text like '106a0000-%';
-- Never run that cleanup against hosted or real-user data.

begin;
create extension if not exists dblink;
select plan(93);

create function pg_temp.l6a_wait_for_lock(p_connection text, p_pid integer, p_events text[])
returns boolean language plpgsql as $$
begin
  for attempt in 1..40 loop
    if dblink_is_busy(p_connection) = 1 and exists (
      select 1
        from pg_catalog.pg_stat_activity
       where pid = p_pid
         and wait_event_type = 'Lock'
         and wait_event = any(p_events)
    ) then return true; end if;
    perform pg_catalog.pg_sleep(0.10);
  end loop;
  return false;
end;
$$;

create temp table l6a_counts_before as
select n.nspname||'.'||c.relname relation_name,
       (xpath('/row/c/text()',query_to_xml(format('select count(*) c from %I.%I',n.nspname,c.relname),false,true,'')))[1]::text::bigint row_count,
       (xpath('/row/fingerprint/text()',query_to_xml(format('select md5(coalesce(string_agg(to_jsonb(t)::text, '','' order by to_jsonb(t)::text), '''')) fingerprint from %I.%I t',n.nspname,c.relname),false,true,'')))[1]::text row_fingerprint
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p') and n.nspname in ('identity','core','audit','content','ai','methodology','notification','scheduling');
select cmp_ok((select count(*)::int from l6a_counts_before),'>',0,'before snapshot is nonempty');

select is((select count(*)::int from identity.user_account where user_account_id::text like '106a0000-%'),0,'preflight finds no account residue');
select is((select count(*)::int from identity.user_session where user_account_id::text like '106a0000-%'),0,'preflight finds no session residue');
select is((select count(*)::int from identity.verification_challenge where verification_challenge_id::text like '106a0000-%'),0,'preflight finds no evidence residue');
select is((select count(*)::int from audit.audit_event where actor_user_account_id::text like '106a0000-%'),0,'preflight finds no audit residue');

select lives_ok($$select dblink_connect('l6a_a','host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres connect_timeout=5')$$,'connection A opens');
select lives_ok($$select dblink_connect('l6a_b','host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres connect_timeout=5')$$,'connection B opens');
select is(dblink_exec('l6a_a','set statement_timeout=''7s'''),'SET','A timeout bounded');
select is(dblink_exec('l6a_b','set statement_timeout=''7s'''),'SET','B timeout bounded');

create temp table l6a_pids(name text primary key,pid int) on commit drop;
insert into l6a_pids select 'a',pid from dblink('l6a_a','select pg_backend_pid()') x(pid int)
union all select 'b',pid from dblink('l6a_b','select pg_backend_pid()') x(pid int);
select is((select count(distinct pid)::int from (select pg_backend_pid() pid union all select pid from l6a_pids)s),3,'three distinct sessions');

select is(dblink_exec('l6a_a',$q$
  insert into identity.user_account (user_account_id,display_name,account_status)
  values ('106a0000-3000-4000-8000-000000000001','L6A concurrency account','active');
  insert into identity.user_role_assignment (user_role_assignment_id,user_account_id,role_code,role_status)
  values ('106a0000-3100-4000-8000-000000000001','106a0000-3000-4000-8000-000000000001','admin','active');
  insert into identity.user_contact_method (
    user_contact_method_id,user_account_id,contact_method_type,contact_label,contact_value,
    normalized_contact_value,login_enabled,is_verified,status
  ) values (
    '106a0000-3200-4000-8000-000000000001','106a0000-3000-4000-8000-000000000001',
    'email','primary','l6a-race@synthetic.invalid','l6a-race@synthetic.invalid',true,true,'active'
  );
  insert into identity.verification_challenge (
    verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,
    contact_method_type,purpose,delivery_channel,code_hash,expires_at,used_at
  ) values
    ('106a0000-3300-4000-8000-000000000001','106a0000-3000-4000-8000-000000000001','106a0000-3200-4000-8000-000000000001','l6a-race@synthetic.invalid','email','login','email','svf1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',now()+interval '10 minutes',clock_timestamp()-interval '70 seconds'),
    ('106a0000-3300-4000-8000-000000000002','106a0000-3000-4000-8000-000000000001','106a0000-3200-4000-8000-000000000001','l6a-race@synthetic.invalid','email','login','email','svf1:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',now()+interval '10 minutes',clock_timestamp()-interval '60 seconds'),
    ('106a0000-3300-4000-8000-000000000003','106a0000-3000-4000-8000-000000000001','106a0000-3200-4000-8000-000000000001','l6a-race@synthetic.invalid','email','login','email','svf1:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',now()+interval '10 minutes',clock_timestamp()-interval '50 seconds'),
    ('106a0000-3300-4000-8000-000000000004','106a0000-3000-4000-8000-000000000001','106a0000-3200-4000-8000-000000000001','l6a-race@synthetic.invalid','email','login','email','svf1:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',now()+interval '10 minutes',clock_timestamp()-interval '40 seconds'),
    ('106a0000-3300-4000-8000-000000000005','106a0000-3000-4000-8000-000000000001','106a0000-3200-4000-8000-000000000001','l6a-race@synthetic.invalid','email','login','email','svf1:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',now()+interval '10 minutes',clock_timestamp()-interval '30 seconds'),
    ('106a0000-3300-4000-8000-000000000006','106a0000-3000-4000-8000-000000000001','106a0000-3200-4000-8000-000000000001','l6a-race@synthetic.invalid','email','login','email','svf1:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',now()+interval '10 minutes',clock_timestamp()-interval '20 seconds'),
    ('106a0000-3300-4000-8000-000000000007','106a0000-3000-4000-8000-000000000001','106a0000-3200-4000-8000-000000000001','l6a-race@synthetic.invalid','email','login','email','svf1:abababababababababababababababababababababababababababababababab',now()+interval '10 minutes',clock_timestamp()-interval '10 seconds')
$q$),'INSERT 0 7','owner commits the complete synthetic fixture');
select is((select count(*)::int from identity.verification_challenge where verification_challenge_id::text like '106a0000-3300-%'),7,'orchestrator sees the committed evidence fixtures');

select is(dblink_exec('l6a_a','set role service_role'),'SET','A assumes service_role');
select is(dblink_exec('l6a_b','set role service_role'),'SET','B assumes service_role');
create temp table l6a_s1 as
select * from dblink('l6a_a',$q$
  select * from public.solmind_create_user_session(
    '106a0000-3000-4000-8000-000000000001','admin',
    '106a0000-3300-4000-8000-000000000001','login',300)
$q$) x(outcome text,user_session_id uuid,expires_at timestamptz);
select is((select outcome from l6a_s1),'created','fixture: A creates and commits the first session');

-- Race 1: two logouts of the same session end it once and audit once.
select is(dblink_exec('l6a_a','begin'),'BEGIN','A begins the first logout');
create temp table l6a_a_logout as
select * from dblink('l6a_a',format($q$
  select * from public.solmind_logout_user_session('106a0000-3000-4000-8000-000000000001',%L)
$q$,(select user_session_id from l6a_s1))) x(outcome text);
select is((select outcome from l6a_a_logout),'ended','A ends the session while holding the account lock');
select ok(dblink_send_query('l6a_b',format($q$
  select * from public.solmind_logout_user_session('106a0000-3000-4000-8000-000000000001',%L)
$q$,(select user_session_id from l6a_s1)))=1,'B submits a simultaneous logout of the same session');
select ok(pg_temp.l6a_wait_for_lock('l6a_b',(select pid from l6a_pids where name='b'),array['advisory']),'B visibly waits on the shared account advisory lock');
select is(dblink_exec('l6a_a','commit'),'COMMIT','A commits the logout');
create temp table l6a_b_logout as
select * from dblink_get_result('l6a_b') x(outcome text);
select * from dblink_get_result('l6a_b') x(outcome text);
select is((select outcome from l6a_b_logout),'already_ended','B sees A''s commit after the lock and reports already_ended');
select results_eq(
  $$select session_status from identity.user_session where user_session_id=(select user_session_id from l6a_s1)$$,
  $$select 'logged_out'::text$$,
  'the doubly presented session is logged_out once'
);
select is((select count(*)::int from audit.audit_event where event_type='session_logged_out' and target_entity_id=(select user_session_id from l6a_s1)),1,'concurrent logouts write exactly one logout row');

-- Race 2: a newer login commits first; the stale logout waits and never ends the newer session.
create temp table l6a_s2 as
select * from dblink('l6a_a',$q$
  select * from public.solmind_create_user_session(
    '106a0000-3000-4000-8000-000000000001','admin',
    '106a0000-3300-4000-8000-000000000002','login',300)
$q$) x(outcome text,user_session_id uuid,expires_at timestamptz);
select is((select outcome from l6a_s2),'created','fixture: A commits a second session after the logout');
select is(dblink_exec('l6a_a','begin'),'BEGIN','A begins a newer login');
create temp table l6a_s3 as
select * from dblink('l6a_a',$q$
  select * from public.solmind_create_user_session(
    '106a0000-3000-4000-8000-000000000001','admin',
    '106a0000-3300-4000-8000-000000000003','login',300)
$q$) x(outcome text,user_session_id uuid,expires_at timestamptz);
select is((select outcome from l6a_s3),'created','A creates the newer session while holding the account lock');
select ok(dblink_send_query('l6a_b',format($q$
  select * from public.solmind_logout_user_session('106a0000-3000-4000-8000-000000000001',%L)
$q$,(select user_session_id from l6a_s2)))=1,'B submits a logout of the session the newer login is superseding');
select ok(pg_temp.l6a_wait_for_lock('l6a_b',(select pid from l6a_pids where name='b'),array['advisory']),'the logout visibly waits on the account lock held by the login');
select is(dblink_exec('l6a_a','commit'),'COMMIT','A commits the newer login');
create temp table l6a_b_stale as
select * from dblink_get_result('l6a_b') x(outcome text);
select * from dblink_get_result('l6a_b') x(outcome text);
select is((select outcome from l6a_b_stale),'already_ended','the stale logout reports already_ended');
select results_eq(
  $$select session_status from identity.user_session where user_session_id in ((select user_session_id from l6a_s2),(select user_session_id from l6a_s3)) order by session_status$$,
  $$select * from (values('active'::text),('revoked'::text)) as expected(session_status)$$,
  'the superseded session stays revoked and the newer session stays active'
);
select is(
  (select user_session_id from identity.user_session where user_account_id='106a0000-3000-4000-8000-000000000001' and session_status='active'),
  (select user_session_id from l6a_s3),
  'the newer session is the account''s active session'
);
select is((select count(*)::int from audit.audit_event where event_type='session_logged_out' and target_entity_id in ((select user_session_id from l6a_s2),(select user_session_id from l6a_s3))),0,'the stale logout writes no logout row');

-- Race 3: a logout commits first; the newer login waits and then supersedes nothing.
select is(dblink_exec('l6a_a','begin'),'BEGIN','A begins a logout of the active session');
create temp table l6a_a_logout_s3 as
select * from dblink('l6a_a',format($q$
  select * from public.solmind_logout_user_session('106a0000-3000-4000-8000-000000000001',%L)
$q$,(select user_session_id from l6a_s3))) x(outcome text);
select is((select outcome from l6a_a_logout_s3),'ended','A ends the active session while holding the account lock');
select ok(dblink_send_query('l6a_b',$q$
  select * from public.solmind_create_user_session(
    '106a0000-3000-4000-8000-000000000001','admin',
    '106a0000-3300-4000-8000-000000000004','login',300)
$q$)=1,'B submits a newer login during the logout');
select ok(pg_temp.l6a_wait_for_lock('l6a_b',(select pid from l6a_pids where name='b'),array['advisory']),'the login visibly waits on the account lock held by the logout');
select is(dblink_exec('l6a_a','commit'),'COMMIT','A commits the logout');
create temp table l6a_s4 as
select * from dblink_get_result('l6a_b') x(outcome text,user_session_id uuid,expires_at timestamptz);
select * from dblink_get_result('l6a_b') x(outcome text,user_session_id uuid,expires_at timestamptz);
select is((select outcome from l6a_s4),'created','B creates the newer session after the logout commits');
select results_eq(
  $$select session_status from identity.user_session where user_session_id=(select user_session_id from l6a_s3)$$,
  $$select 'logged_out'::text$$,
  'the logged-out session stays logged_out'
);
select is(
  (select user_session_id from identity.user_session where user_account_id='106a0000-3000-4000-8000-000000000001' and session_status='active'),
  (select user_session_id from l6a_s4),
  'the newer login is the only active session and was never ended'
);
select is((select count(*)::int from audit.audit_event where event_type='session_superseded' and target_entity_id=(select user_session_id from l6a_s3)),0,'the newer login supersedes nothing, because the logout committed first');

-- Race 4: the session reaches its expiry while the logout waits on the account lock.
create temp table l6a_s5 as
select * from dblink('l6a_a',$q$
  select * from public.solmind_create_user_session(
    '106a0000-3000-4000-8000-000000000001','admin',
    '106a0000-3300-4000-8000-000000000005','login',300)
$q$) x(outcome text,user_session_id uuid,expires_at timestamptz);
select is((select outcome from l6a_s5),'created','fixture: A commits a fresh session for the account-lock expiry race');
select is(dblink_exec('l6a_a','reset role'),'RESET','A returns to owner to hold the locks');
select is(dblink_exec('l6a_a','begin'),'BEGIN','A begins holding the account lock');
select is(dblink_exec('l6a_a',$q$
  do $d$
  begin
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('solmind:authorizing-domain:account:v1|106a0000-3000-4000-8000-000000000001', 0));
  end
  $d$
$q$),'DO','A holds the shared account-domain lock in its open transaction');
select is(dblink_exec('l6a_a',format($q$
  update identity.user_session set expires_at = clock_timestamp() + interval '600 milliseconds'
   where user_session_id = %L
$q$,(select user_session_id from l6a_s5))),'UPDATE 1','A sets the session to expire 600 ms from now, uncommitted');
-- The fixture's intended complete row, read through the holding connection, which sees its own
-- uncommitted change; and the account's audit rows before the logout.
create temp table l6a_s5_intended as
select * from dblink('l6a_a',format($q$
  select user_session_id,user_account_id,active_role_context,created_at,expires_at,ended_at,last_activity_at,session_status,verification_challenge_id,ip_address,user_agent,metadata
    from identity.user_session where user_session_id = %L
$q$,(select user_session_id from l6a_s5))) x(user_session_id uuid,user_account_id uuid,active_role_context text,created_at timestamptz,expires_at timestamptz,ended_at timestamptz,last_activity_at timestamptz,session_status text,verification_challenge_id uuid,ip_address text,user_agent text,metadata jsonb);
create temp table l6a_audit_before_s5 as
select count(*)::int as n,md5(coalesce(string_agg(to_jsonb(a)::text, ',' order by to_jsonb(a)::text), '')) as fingerprint
  from audit.audit_event a where a.actor_user_account_id='106a0000-3000-4000-8000-000000000001';
select ok(dblink_send_query('l6a_b',format($q$
  select * from public.solmind_logout_user_session('106a0000-3000-4000-8000-000000000001',%L)
$q$,(select user_session_id from l6a_s5)))=1,'B submits a logout of the session');
select ok(pg_temp.l6a_wait_for_lock('l6a_b',(select pid from l6a_pids where name='b'),array['advisory']),'B visibly waits on the account lock');
select ok(clock_timestamp()<(select expires_at from l6a_s5_intended),'B was already waiting on the account lock before the session''s new expiry');
do $$ begin perform pg_catalog.pg_sleep(1.0); end $$;
select is(dblink_exec('l6a_a','commit'),'COMMIT','A commits after the new expiry has passed');
create temp table l6a_b_expired_account as
select * from dblink_get_result('l6a_b') x(outcome text);
select * from dblink_get_result('l6a_b') x(outcome text);
select is((select outcome from l6a_b_expired_account),'already_ended','a session that expires while the logout waits on the account lock reports already_ended');
select results_eq(
  $$select user_session_id,user_account_id,active_role_context,created_at,expires_at,ended_at,last_activity_at,session_status,verification_challenge_id,ip_address,user_agent,metadata from identity.user_session where user_session_id=(select user_session_id from l6a_s5)$$,
  $$select user_session_id,user_account_id,active_role_context,created_at,expires_at,ended_at,last_activity_at,session_status,verification_challenge_id,ip_address,user_agent,metadata from l6a_s5_intended$$,
  'the logout leaves the complete row, expires_at included, exactly as the fixture set it'
);
select ok((select expires_at<clock_timestamp() from identity.user_session where user_session_id=(select user_session_id from l6a_s5)),'the session is past its new expiry');
select results_eq(
  $$select count(*)::int,md5(coalesce(string_agg(to_jsonb(a)::text, ',' order by to_jsonb(a)::text), '')) from audit.audit_event a where a.actor_user_account_id='106a0000-3000-4000-8000-000000000001'$$,
  $$select n,fingerprint from l6a_audit_before_s5$$,
  'the account''s audit rows are exactly as they were before the account-lock race: no row'
);

-- Race 5: the session reaches its expiry while the logout waits on the presented row's lock.
select is(dblink_exec('l6a_a','set role service_role'),'SET','A assumes service_role again');
create temp table l6a_s6 as
select * from dblink('l6a_a',$q$
  select * from public.solmind_create_user_session(
    '106a0000-3000-4000-8000-000000000001','admin',
    '106a0000-3300-4000-8000-000000000006','login',300)
$q$) x(outcome text,user_session_id uuid,expires_at timestamptz);
select is((select outcome from l6a_s6),'created','fixture: A commits a fresh session for the row-lock expiry race');
select is(dblink_exec('l6a_a','reset role'),'RESET','A returns to owner to hold the row lock');
select is(dblink_exec('l6a_a','begin'),'BEGIN','A begins holding only the presented row''s lock');
select is(dblink_exec('l6a_a',format($q$
  update identity.user_session set expires_at = clock_timestamp() + interval '600 milliseconds'
   where user_session_id = %L
$q$,(select user_session_id from l6a_s6))),'UPDATE 1','A sets the session to expire 600 ms from now, uncommitted, holding its row lock');
-- The fixture's intended complete row, read through the holding connection, which sees its own
-- uncommitted change; and the account's audit rows before the logout.
create temp table l6a_s6_intended as
select * from dblink('l6a_a',format($q$
  select user_session_id,user_account_id,active_role_context,created_at,expires_at,ended_at,last_activity_at,session_status,verification_challenge_id,ip_address,user_agent,metadata
    from identity.user_session where user_session_id = %L
$q$,(select user_session_id from l6a_s6))) x(user_session_id uuid,user_account_id uuid,active_role_context text,created_at timestamptz,expires_at timestamptz,ended_at timestamptz,last_activity_at timestamptz,session_status text,verification_challenge_id uuid,ip_address text,user_agent text,metadata jsonb);
create temp table l6a_audit_before_s6 as
select count(*)::int as n,md5(coalesce(string_agg(to_jsonb(a)::text, ',' order by to_jsonb(a)::text), '')) as fingerprint
  from audit.audit_event a where a.actor_user_account_id='106a0000-3000-4000-8000-000000000001';
select ok(dblink_send_query('l6a_b',format($q$
  select * from public.solmind_logout_user_session('106a0000-3000-4000-8000-000000000001',%L)
$q$,(select user_session_id from l6a_s6)))=1,'B submits a logout of the session');
select ok(pg_temp.l6a_wait_for_lock('l6a_b',(select pid from l6a_pids where name='b'),array['transactionid','tuple']),'B holds the account lock and visibly waits on the row lock');
select ok(clock_timestamp()<(select expires_at from l6a_s6_intended),'B was already waiting on the row lock before the session''s new expiry');
do $$ begin perform pg_catalog.pg_sleep(1.0); end $$;
select is(dblink_exec('l6a_a','commit'),'COMMIT','A commits after the new expiry has passed');
create temp table l6a_b_expired_row as
select * from dblink_get_result('l6a_b') x(outcome text);
select * from dblink_get_result('l6a_b') x(outcome text);
select is((select outcome from l6a_b_expired_row),'already_ended','a session that expires while the logout waits on the row lock reports already_ended');
select results_eq(
  $$select user_session_id,user_account_id,active_role_context,created_at,expires_at,ended_at,last_activity_at,session_status,verification_challenge_id,ip_address,user_agent,metadata from identity.user_session where user_session_id=(select user_session_id from l6a_s6)$$,
  $$select user_session_id,user_account_id,active_role_context,created_at,expires_at,ended_at,last_activity_at,session_status,verification_challenge_id,ip_address,user_agent,metadata from l6a_s6_intended$$,
  'the logout leaves the complete row, expires_at included, exactly as the fixture set it'
);
select ok((select expires_at<clock_timestamp() from identity.user_session where user_session_id=(select user_session_id from l6a_s6)),'the session is past its new expiry');
select results_eq(
  $$select count(*)::int,md5(coalesce(string_agg(to_jsonb(a)::text, ',' order by to_jsonb(a)::text), '')) from audit.audit_event a where a.actor_user_account_id='106a0000-3000-4000-8000-000000000001'$$,
  $$select n,fingerprint from l6a_audit_before_s6$$,
  'the account''s audit rows are exactly as they were before the row-lock race: no row'
);

-- Race 6: a row lock held past the 2-second lock timeout fails closed with the fixed identifier.
select is(dblink_exec('l6a_a','set role service_role'),'SET','A assumes service_role for the last fixture');
create temp table l6a_s7 as
select * from dblink('l6a_a',$q$
  select * from public.solmind_create_user_session(
    '106a0000-3000-4000-8000-000000000001','admin',
    '106a0000-3300-4000-8000-000000000007','login',300)
$q$) x(outcome text,user_session_id uuid,expires_at timestamptz);
select is((select outcome from l6a_s7),'created','fixture: A commits a fresh session for the lock-timeout case');
select is(dblink_exec('l6a_a','reset role'),'RESET','A returns to owner to hold the row lock');
select is(dblink_exec('l6a_a','begin'),'BEGIN','A begins holding the presented row''s lock');
select is(dblink_exec('l6a_a',format($q$
  do $d$
  begin
    perform 1 from identity.user_session where user_session_id = %L for update;
  end
  $d$
$q$,(select user_session_id from l6a_s7))),'DO','A locks the presented row in its open transaction');
-- The fixture's intended complete row, read through the holding connection, which sees its own
-- uncommitted change; and the account's audit rows before the logout.
create temp table l6a_s7_intended as
select * from dblink('l6a_a',format($q$
  select user_session_id,user_account_id,active_role_context,created_at,expires_at,ended_at,last_activity_at,session_status,verification_challenge_id,ip_address,user_agent,metadata
    from identity.user_session where user_session_id = %L
$q$,(select user_session_id from l6a_s7))) x(user_session_id uuid,user_account_id uuid,active_role_context text,created_at timestamptz,expires_at timestamptz,ended_at timestamptz,last_activity_at timestamptz,session_status text,verification_challenge_id uuid,ip_address text,user_agent text,metadata jsonb);
create temp table l6a_audit_before_s7 as
select count(*)::int as n,md5(coalesce(string_agg(to_jsonb(a)::text, ',' order by to_jsonb(a)::text), '')) as fingerprint
  from audit.audit_event a where a.actor_user_account_id='106a0000-3000-4000-8000-000000000001';
select ok(dblink_send_query('l6a_b',format($q$
  select * from public.solmind_logout_user_session('106a0000-3000-4000-8000-000000000001',%L)
$q$,(select user_session_id from l6a_s7)))=1,'B submits a logout of the locked session');
select ok(pg_temp.l6a_wait_for_lock('l6a_b',(select pid from l6a_pids where name='b'),array['transactionid','tuple']),'B visibly waits on the row lock');
create temp table l6a_b_timeout as
select * from dblink_get_result('l6a_b', false) x(outcome text);
create temp table l6a_b_timeout_error as
select dblink_error_message('l6a_b') as message;
select * from dblink_get_result('l6a_b', false) x(outcome text);
select is(dblink_exec('l6a_a','commit'),'COMMIT','A releases the row lock');
select is((select count(*)::int from l6a_b_timeout),0,'the timed-out logout returns no outcome');
select ok(
  (select message like '%solmind_logout_lock_unavailable%'
      and message not ilike '%lock timeout%'
      and message not ilike '%canceling statement%'
     from l6a_b_timeout_error),
  'the lock timeout reaches the caller only as solmind_logout_lock_unavailable'
);
select results_eq(
  $$select user_session_id,user_account_id,active_role_context,created_at,expires_at,ended_at,last_activity_at,session_status,verification_challenge_id,ip_address,user_agent,metadata from identity.user_session where user_session_id=(select user_session_id from l6a_s7)$$,
  $$select user_session_id,user_account_id,active_role_context,created_at,expires_at,ended_at,last_activity_at,session_status,verification_challenge_id,ip_address,user_agent,metadata from l6a_s7_intended$$,
  'the timed-out logout leaves the complete row exactly as it was'
);
select results_eq(
  $$select count(*)::int,md5(coalesce(string_agg(to_jsonb(a)::text, ',' order by to_jsonb(a)::text), '')) from audit.audit_event a where a.actor_user_account_id='106a0000-3000-4000-8000-000000000001'$$,
  $$select n,fingerprint from l6a_audit_before_s7$$,
  'the timed-out logout writes no audit row: the account''s audit rows are unchanged'
);

-- Final cardinality across the six races.
select results_eq(
  $$select session_status,count(*)::int from identity.user_session where user_account_id='106a0000-3000-4000-8000-000000000001' group by session_status order by session_status$$,
  $$select * from (values('active'::text,1),('logged_out'::text,2),('revoked'::text,4)) as expected(session_status,row_count)$$,
  'terminal states are deterministic after the races'
);
select results_eq(
  $$select event_type,count(*)::int from audit.audit_event where actor_user_account_id='106a0000-3000-4000-8000-000000000001' group by event_type order by event_type$$,
  $$select * from (values('session_created'::text,7),('session_logged_out'::text,2),('session_superseded'::text,4)) as expected(event_type,row_count)$$,
  'the races write exact creation, supersession, and logout audit cardinality'
);

select is(dblink_exec('l6a_a','reset role'),'RESET','A returns to owner for cleanup');
select is(dblink_exec('l6a_b','reset role'),'RESET','B returns to owner for cleanup');
select is(dblink_exec('l6a_a',$q$
  delete from audit.audit_event where actor_user_account_id='106a0000-3000-4000-8000-000000000001';
  delete from identity.authorizing_evidence_consumption where verification_challenge_id::text like '106a0000-3300-%';
  delete from identity.user_session where user_account_id='106a0000-3000-4000-8000-000000000001';
  delete from identity.verification_challenge where verification_challenge_id::text like '106a0000-3300-%';
  delete from identity.user_contact_method where user_account_id='106a0000-3000-4000-8000-000000000001';
  delete from identity.user_role_assignment where user_account_id='106a0000-3000-4000-8000-000000000001';
  delete from identity.user_account where user_account_id='106a0000-3000-4000-8000-000000000001'
$q$),'DELETE 1','owner cleanup removes the complete synthetic fixture');

select is((select count(*)::int from identity.user_account where user_account_id::text like '106a0000-%'),0,'no account residue remains');
select is((select count(*)::int from identity.user_session where user_account_id::text like '106a0000-%'),0,'no session residue remains');
select is((select count(*)::int from identity.verification_challenge where verification_challenge_id::text like '106a0000-%'),0,'no evidence residue remains');
select is((select count(*)::int from identity.authorizing_evidence_consumption where verification_challenge_id::text like '106a0000-%'),0,'no shared-consumption residue remains');
select is((select count(*)::int from audit.audit_event where actor_user_account_id::text like '106a0000-%'),0,'no audit residue remains');
create temp table l6a_counts_after as
select n.nspname||'.'||c.relname relation_name,
       (xpath('/row/c/text()',query_to_xml(format('select count(*) c from %I.%I',n.nspname,c.relname),false,true,'')))[1]::text::bigint row_count,
       (xpath('/row/fingerprint/text()',query_to_xml(format('select md5(coalesce(string_agg(to_jsonb(t)::text, '','' order by to_jsonb(t)::text), '''')) fingerprint from %I.%I t',n.nspname,c.relname),false,true,'')))[1]::text row_fingerprint
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p') and n.nspname in ('identity','core','audit','content','ai','methodology','notification','scheduling');
select results_eq($$select relation_name,row_count,row_fingerprint from l6a_counts_after order by 1$$,$$select relation_name,row_count,row_fingerprint from l6a_counts_before order by 1$$,'all application-table row contents return exactly to baseline');
select lives_ok($$select dblink_disconnect('l6a_a')$$,'A disconnects');
select lives_ok($$select dblink_disconnect('l6a_b')$$,'B disconnects');

select * from finish();
rollback;
