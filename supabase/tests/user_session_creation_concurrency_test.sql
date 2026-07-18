-- DEF5-S4 real-function concurrency proofs. Local ephemeral database only.
-- A hard SQL error can leave reserved synthetic rows. Recovery requires Paul's approval:
-- delete from audit.audit_event where target_entity_id::text like 'def50004-%' or actor_user_account_id::text like 'def50004-%';
-- delete from identity.authorizing_evidence_consumption where verification_challenge_id::text like 'def50004-%';
-- delete from identity.user_session where user_account_id::text like 'def50004-%';
-- delete from identity.verification_challenge where verification_challenge_id::text like 'def50004-%';
-- delete from identity.user_contact_method where user_account_id::text like 'def50004-%';
-- delete from identity.user_role_assignment where user_account_id::text like 'def50004-%';
-- delete from identity.user_account where user_account_id::text like 'def50004-%';
-- Never run that cleanup against hosted or real-user data.

begin;
create extension if not exists dblink;
select plan(56);

create function pg_temp.def5_s4_wait_for_lock(p_connection text, p_pid integer)
returns boolean language plpgsql as $$
begin
  for attempt in 1..40 loop
    if dblink_is_busy(p_connection) = 1 and exists (
      select 1
        from pg_catalog.pg_stat_activity
       where pid = p_pid
         and wait_event_type = 'Lock'
         and wait_event = 'advisory'
    ) then return true; end if;
    perform pg_catalog.pg_sleep(0.10);
  end loop;
  return false;
end;
$$;

create temp table def5_s4_counts_before as
select n.nspname||'.'||c.relname relation_name,
       (xpath('/row/c/text()',query_to_xml(format('select count(*) c from %I.%I',n.nspname,c.relname),false,true,'')))[1]::text::bigint row_count,
       (xpath('/row/fingerprint/text()',query_to_xml(format('select md5(coalesce(string_agg(to_jsonb(t)::text, '','' order by to_jsonb(t)::text), '''')) fingerprint from %I.%I t',n.nspname,c.relname),false,true,'')))[1]::text row_fingerprint
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p') and n.nspname in ('identity','core','audit','content','ai','methodology','notification','scheduling');
select cmp_ok((select count(*)::int from def5_s4_counts_before),'>',0,'before snapshot is nonempty');

select is((select count(*)::int from identity.user_account where user_account_id::text like 'def50004-%'),0,'preflight finds no account residue');
select is((select count(*)::int from identity.user_session where user_account_id::text like 'def50004-%'),0,'preflight finds no session residue');
select is((select count(*)::int from identity.authorizing_evidence_consumption where verification_challenge_id::text like 'def50004-%'),0,'preflight finds no shared-consumption residue');
select is((select count(*)::int from audit.audit_event where actor_user_account_id::text like 'def50004-%'),0,'preflight finds no session audit residue');

select lives_ok($$select dblink_connect('def5_s4_a','host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres connect_timeout=5')$$,'connection A opens');
select lives_ok($$select dblink_connect('def5_s4_b','host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres connect_timeout=5')$$,'connection B opens');
select is(dblink_exec('def5_s4_a','set statement_timeout=''7s'''),'SET','A timeout bounded');
select is(dblink_exec('def5_s4_b','set statement_timeout=''7s'''),'SET','B timeout bounded');

create temp table def5_s4_pids(name text primary key,pid int) on commit drop;
insert into def5_s4_pids select 'a',pid from dblink('def5_s4_a','select pg_backend_pid()') x(pid int)
union all select 'b',pid from dblink('def5_s4_b','select pg_backend_pid()') x(pid int);
select is((select count(distinct pid)::int from (select pg_backend_pid() pid union all select pid from def5_s4_pids)s),3,'three distinct sessions');

select is(dblink_exec('def5_s4_a',$q$
  insert into identity.user_account (user_account_id,display_name,account_status)
  values ('def50004-3000-4000-8000-000000000001','DEF5-S4 concurrency account','active');
  insert into identity.user_role_assignment (user_role_assignment_id,user_account_id,role_code,role_status)
  values ('def50004-3100-4000-8000-000000000001','def50004-3000-4000-8000-000000000001','admin','active');
  insert into identity.user_contact_method (
    user_contact_method_id,user_account_id,contact_method_type,contact_label,contact_value,
    normalized_contact_value,login_enabled,is_verified,status
  ) values (
    'def50004-3200-4000-8000-000000000001','def50004-3000-4000-8000-000000000001',
    'email','primary','def5s4-race@synthetic.invalid','def5s4-race@synthetic.invalid',true,true,'active'
  );
  insert into identity.verification_challenge (
    verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,
    contact_method_type,purpose,delivery_channel,code_hash,expires_at,used_at
  ) values
    ('def50004-3300-4000-8000-000000000001','def50004-3000-4000-8000-000000000001','def50004-3200-4000-8000-000000000001','def5s4-race@synthetic.invalid','email','login','email','svf1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',now()+interval '10 minutes',clock_timestamp()-interval '180 seconds'),
    ('def50004-3300-4000-8000-000000000002','def50004-3000-4000-8000-000000000001','def50004-3200-4000-8000-000000000001','def5s4-race@synthetic.invalid','email','login','email','svf1:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',now()+interval '10 minutes',clock_timestamp()-interval '170 seconds'),
    ('def50004-3300-4000-8000-000000000003','def50004-3000-4000-8000-000000000001','def50004-3200-4000-8000-000000000001','def5s4-race@synthetic.invalid','email','login','email','svf1:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',now()+interval '10 minutes',clock_timestamp()-interval '160 seconds'),
    ('def50004-3300-4000-8000-000000000004','def50004-3000-4000-8000-000000000001','def50004-3200-4000-8000-000000000001','def5s4-race@synthetic.invalid','email','login','email','svf1:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',now()+interval '10 minutes',clock_timestamp()-interval '120 seconds'),
    ('def50004-3300-4000-8000-000000000005','def50004-3000-4000-8000-000000000001','def50004-3200-4000-8000-000000000001','def5s4-race@synthetic.invalid','email','login','email','svf1:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',now()+interval '10 minutes',clock_timestamp()-interval '165 seconds')
$q$),'INSERT 0 5','owner commits complete synthetic fixture');
select is((select count(*)::int from identity.verification_challenge where verification_challenge_id::text like 'def50004-3300-%'),5,'orchestrator sees committed evidence fixtures');

select is(dblink_exec('def5_s4_a','set role service_role'),'SET','A assumes service_role');
select is(dblink_exec('def5_s4_b','set role service_role'),'SET','B assumes service_role');
select is(dblink_exec('def5_s4_a','begin'),'BEGIN','A begins exact-retry race');
create temp table def5_s4_a_first as
select * from dblink('def5_s4_a',$q$
  select * from public.solmind_create_user_session(
    'def50004-3000-4000-8000-000000000001','admin',
    'def50004-3300-4000-8000-000000000001','login',300)
$q$) x(outcome text,user_session_id uuid,expires_at timestamptz);
select is((select outcome from def5_s4_a_first),'created','A creates while retaining account lock');
select ok(dblink_send_query('def5_s4_b',$q$
  select * from public.solmind_create_user_session(
    'def50004-3000-4000-8000-000000000001','admin',
    'def50004-3300-4000-8000-000000000001','login',300)
$q$)=1,'B submits simultaneous exact retry');
select ok(pg_temp.def5_s4_wait_for_lock('def5_s4_b',(select pid from def5_s4_pids where name='b')),'B visibly waits on the shared evidence advisory lock');
select is(dblink_exec('def5_s4_a','commit'),'COMMIT','A commits first creation');
create temp table def5_s4_b_retry as
select * from dblink_get_result('def5_s4_b') x(outcome text,user_session_id uuid,expires_at timestamptz);
select * from dblink_get_result('def5_s4_b') x(outcome text,user_session_id uuid,expires_at timestamptz);
select is((select outcome from def5_s4_b_retry),'existing','B sees A commit after the lock and returns existing');
select is((select user_session_id from def5_s4_b_retry),(select user_session_id from def5_s4_a_first),'simultaneous exact retry returns the same UUID');
select is((select count(*)::int from identity.user_session where user_account_id='def50004-3000-4000-8000-000000000001'),1,'exact-retry race creates one session');
select is((select count(*)::int from identity.authorizing_evidence_consumption where verification_challenge_id='def50004-3300-4000-8000-000000000001'),1,'exact-retry race inserts one shared consumption');
select is((select count(*)::int from audit.audit_event where actor_user_account_id='def50004-3000-4000-8000-000000000001' and event_type='session_created'),1,'exact-retry race writes one creation audit');

select is(dblink_exec('def5_s4_a','begin'),'BEGIN','A begins competing-login race');
create temp table def5_s4_a_second as
select * from dblink('def5_s4_a',$q$
  select * from public.solmind_create_user_session(
    'def50004-3000-4000-8000-000000000001','admin',
    'def50004-3300-4000-8000-000000000002','login',300)
$q$) x(outcome text,user_session_id uuid,expires_at timestamptz);
select is((select outcome from def5_s4_a_second),'created','A creates the next login while retaining account lock');
select ok(dblink_send_query('def5_s4_b',$q$
  select * from public.solmind_create_user_session(
    'def50004-3000-4000-8000-000000000001','admin',
    'def50004-3300-4000-8000-000000000003','login',300)
$q$)=1,'B submits a competing newer login');
select ok(pg_temp.def5_s4_wait_for_lock('def5_s4_b',(select pid from def5_s4_pids where name='b')),'competing login visibly waits on account lock');
select is(dblink_exec('def5_s4_a','commit'),'COMMIT','A commits intermediate replacement');
create temp table def5_s4_b_third as
select * from dblink_get_result('def5_s4_b') x(outcome text,user_session_id uuid,expires_at timestamptz);
select * from dblink_get_result('def5_s4_b') x(outcome text,user_session_id uuid,expires_at timestamptz);
select is((select outcome from def5_s4_b_third),'created','B sees A commit and creates the newest login');
select is((select count(*)::int from identity.user_session where user_account_id='def50004-3000-4000-8000-000000000001' and session_status='active'),1,'competing logins leave one active session');
select is((select user_session_id from identity.user_session where user_account_id='def50004-3000-4000-8000-000000000001' and session_status='active'),(select user_session_id from def5_s4_b_third),'last serialized login is active');
select results_eq(
  $$select session_status,count(*)::int from identity.user_session where user_account_id='def50004-3000-4000-8000-000000000001' group by session_status order by session_status$$,
  $$select * from (values('active'::text,1),('revoked'::text,2)) as expected(session_status,row_count)$$,
  'terminal states are deterministic after competing logins'
);
select results_eq(
  $$select event_type,count(*)::int from audit.audit_event where actor_user_account_id='def50004-3000-4000-8000-000000000001' and event_type in ('session_created','session_superseded') group by event_type order by event_type$$,
  $$select * from (values('session_created'::text,3),('session_superseded'::text,2)) as expected(event_type,row_count)$$,
  'concurrent sequence writes exact creation and supersession audit cardinality'
);
select is(
  (select count(*)::int from identity.authorizing_evidence_consumption where verification_challenge_id::text like 'def50004-3300-%'),
  3,
  'concurrent sequence records exactly one shared consumption per created session'
);

set local role service_role;
select throws_ok(
  $$select * from public.solmind_create_user_session(
    'def50004-3000-4000-8000-000000000001','admin',
    'def50004-3300-4000-8000-000000000005','login',300)$$,
  'P0001','solmind_session_older_evidence',
  'delayed never-sessionized evidence loses to the newer session created by the competing connection'
);
reset role;
select is(
  (select user_session_id from identity.user_session where user_account_id='def50004-3000-4000-8000-000000000001' and session_status='active'),
  (select user_session_id from def5_s4_b_third),
  'delayed older evidence preserves the concurrently selected active session'
);
select results_eq(
  $$select event_type,count(*)::int from audit.audit_event where actor_user_account_id='def50004-3000-4000-8000-000000000001' and event_type in ('session_created','session_superseded') group by event_type order by event_type$$,
  $$select * from (values('session_created'::text,3),('session_superseded'::text,2)) as expected(event_type,row_count)$$,
  'delayed older-evidence denial writes no session audit row'
);
select is(
  (select count(*)::int from identity.authorizing_evidence_consumption where verification_challenge_id::text like 'def50004-3300-%'),
  3,
  'delayed older-evidence denial writes no shared consumption'
);

select is(dblink_exec('def5_s4_a','reset role'),'RESET','A returns to owner for policy-race setup');
select is(dblink_exec('def5_s4_a','begin'),'BEGIN','A begins concurrent policy change');
select is(dblink_exec('def5_s4_a',$q$
  update identity.session_creation_freshness_policy
     set active_seconds=60,
         updated_at=clock_timestamp()
   where policy_name='redeemed_evidence_freshness'
$q$),'UPDATE 1','A holds an uncommitted policy change');
create temp table def5_s4_b_policy_snapshot as
select * from dblink('def5_s4_b',$q$
  select * from public.solmind_create_user_session(
    'def50004-3000-4000-8000-000000000001','admin',
    'def50004-3300-4000-8000-000000000004','login',300)
$q$) x(outcome text,user_session_id uuid,expires_at timestamptz);
select is((select outcome from def5_s4_b_policy_snapshot),'created','one invocation uses the prior committed policy snapshot during a concurrent change');
select is(
  (select count(*)::int from identity.authorizing_evidence_consumption where verification_challenge_id::text like 'def50004-3300-%'),
  4,
  'policy-snapshot success adds exactly one shared consumption'
);
select is(dblink_exec('def5_s4_a','commit'),'COMMIT','A commits the concurrent policy change after the invocation');
select is(dblink_exec('def5_s4_a',$q$
  update identity.session_creation_freshness_policy
     set active_seconds=300,
         updated_at=created_at
   where policy_name='redeemed_evidence_freshness'
$q$),'UPDATE 1','owner restores the canonical active freshness value');

select is(dblink_exec('def5_s4_a','reset role'),'RESET','A returns to owner for cleanup');
select is(dblink_exec('def5_s4_b','reset role'),'RESET','B returns to owner for cleanup');
select is(dblink_exec('def5_s4_a',$q$
  delete from audit.audit_event where actor_user_account_id='def50004-3000-4000-8000-000000000001';
  delete from identity.authorizing_evidence_consumption where verification_challenge_id::text like 'def50004-3300-%';
  delete from identity.user_session where user_account_id='def50004-3000-4000-8000-000000000001';
  delete from identity.verification_challenge where verification_challenge_id::text like 'def50004-3300-%';
  delete from identity.user_contact_method where user_account_id='def50004-3000-4000-8000-000000000001';
  delete from identity.user_role_assignment where user_account_id='def50004-3000-4000-8000-000000000001';
  delete from identity.user_account where user_account_id='def50004-3000-4000-8000-000000000001'
$q$),'DELETE 1','owner cleanup removes complete synthetic fixture');

select is((select count(*)::int from identity.user_account where user_account_id::text like 'def50004-%'),0,'no account residue remains');
select is((select count(*)::int from identity.user_session where user_account_id::text like 'def50004-%'),0,'no session residue remains');
select is((select count(*)::int from identity.authorizing_evidence_consumption where verification_challenge_id::text like 'def50004-%'),0,'no shared-consumption residue remains');
select is((select count(*)::int from audit.audit_event where actor_user_account_id::text like 'def50004-%'),0,'no session audit residue remains');
create temp table def5_s4_counts_after as
select n.nspname||'.'||c.relname relation_name,
       (xpath('/row/c/text()',query_to_xml(format('select count(*) c from %I.%I',n.nspname,c.relname),false,true,'')))[1]::text::bigint row_count,
       (xpath('/row/fingerprint/text()',query_to_xml(format('select md5(coalesce(string_agg(to_jsonb(t)::text, '','' order by to_jsonb(t)::text), '''')) fingerprint from %I.%I t',n.nspname,c.relname),false,true,'')))[1]::text row_fingerprint
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p') and n.nspname in ('identity','core','audit','content','ai','methodology','notification','scheduling');
select results_eq($$select relation_name,row_count,row_fingerprint from def5_s4_counts_after order by 1$$,$$select relation_name,row_count,row_fingerprint from def5_s4_counts_before order by 1$$,'all application-table row contents return exactly to baseline');
select lives_ok($$select dblink_disconnect('def5_s4_a')$$,'A disconnects');
select lives_ok($$select dblink_disconnect('def5_s4_b')$$,'B disconnects');

select * from finish();
rollback;
