-- DEF5-S3 real-function concurrency proofs. Local ephemeral database only.
-- A hard SQL error can leave reserved synthetic rows. Recovery requires Paul's approval:
-- delete from audit.audit_event where target_entity_id::text like 'def50003-%';
-- delete from identity.verification_challenge where verification_challenge_id::text like 'def50003-%';
-- Never run that cleanup against hosted or real-user data.

begin;
create extension if not exists dblink;
select plan(36);

create function pg_temp.def5_s3_wait_for_lock(p_connection text,p_pid integer)
returns boolean language plpgsql as $$
begin
  for attempt in 1..30 loop
    if dblink_is_busy(p_connection)=1 and exists(select 1 from pg_catalog.pg_stat_activity where pid=p_pid and wait_event_type='Lock') then return true; end if;
    perform pg_catalog.pg_sleep(0.10);
  end loop;
  return false;
end;
$$;

create temp table def5_s3_counts_before as
select n.nspname||'.'||c.relname relation_name,
       (xpath('/row/c/text()',query_to_xml(format('select count(*) c from %I.%I',n.nspname,c.relname),false,true,'')))[1]::text::bigint row_count,
       (xpath('/row/fingerprint/text()',query_to_xml(format('select md5(coalesce(string_agg(to_jsonb(t)::text, '','' order by to_jsonb(t)::text), '''')) fingerprint from %I.%I t',n.nspname,c.relname),false,true,'')))[1]::text row_fingerprint
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p') and n.nspname in ('identity','core','audit','content','ai','methodology','notification','scheduling');
select cmp_ok((select count(*)::int from def5_s3_counts_before),'>',0,'before snapshot is nonempty');
select is((select count(*)::int from identity.verification_challenge where verification_challenge_id::text like 'def50003-%'),0,'preflight finds no challenge residue');
select is((select count(*)::int from audit.audit_event where target_entity_id::text like 'def50003-%'),0,'preflight finds no audit residue');

select lives_ok(
  pg_catalog.format($q$select dblink_connect('def5_s3_a','host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5')$q$, pg_catalog.current_database()),
  'connection A opens to the same database'
);
select lives_ok(
  pg_catalog.format($q$select dblink_connect('def5_s3_b','host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5')$q$, pg_catalog.current_database()),
  'connection B opens to the same database'
);
select is(dblink_exec('def5_s3_a','set statement_timeout=''5s'''),'SET','A timeout bounded');
select is(dblink_exec('def5_s3_b','set statement_timeout=''5s'''),'SET','B timeout bounded');
create temp table def5_s3_pids(name text primary key,pid int) on commit drop;
insert into def5_s3_pids select 'a',pid from dblink('def5_s3_a','select pg_backend_pid()')x(pid int)
union all select 'b',pid from dblink('def5_s3_b','select pg_backend_pid()')x(pid int);
select is((select count(distinct pid)::int from (select pg_backend_pid() pid union all select pid from def5_s3_pids)s),3,'three distinct sessions');
select is((select count(*)::int from (select remote_database from dblink('def5_s3_a','select current_database()::text') x(remote_database text) union all select remote_database from dblink('def5_s3_b','select current_database()::text') x(remote_database text)) s where remote_database=pg_catalog.current_database()),2,'both remote sessions target the database under test');
select is(dblink_exec('def5_s3_a','set role service_role'),'SET','A assumes service_role');
select is(dblink_exec('def5_s3_b','set role service_role'),'SET','B assumes service_role');
select is((select effective_user from dblink('def5_s3_a','select current_user::text') x(effective_user text)),'service_role','A effective role is service_role');
select is((select effective_user from dblink('def5_s3_b','select current_user::text') x(effective_user text)),'service_role','B effective role is service_role');

select is(dblink_exec('def5_s3_a','begin'),'BEGIN','A begins same-pair issuance race');
select is((select outcome from dblink('def5_s3_a',$q$select * from public.solmind_issue_verification_challenge('def50003-3000-4000-8000-000000000021','race@synthetic.invalid','email','login','email','svf1:1111111111111111111111111111111111111111111111111111111111111111',null,null)$q$)x(outcome text)),'issued','A issues while holding advisory lock');
select ok(dblink_send_query('def5_s3_b',$q$select * from public.solmind_issue_verification_challenge('def50003-3000-4000-8000-000000000022','race@synthetic.invalid','email','login','email','svf1:2222222222222222222222222222222222222222222222222222222222222222',null,null)$q$)=1,'B submits competing same-pair issuance');
select ok(pg_temp.def5_s3_wait_for_lock('def5_s3_b',(select pid from def5_s3_pids where name='b')),'B visibly waits on the advisory lock');
select is(dblink_exec('def5_s3_a','commit'),'COMMIT','A commits first issuance');
select is((select outcome from dblink_get_result('def5_s3_b')x(outcome text)),'issued','B also succeeds after serialization');
select * from dblink_get_result('def5_s3_b')x(outcome text);
select ok((select invalidated_at is not null from identity.verification_challenge where verification_challenge_id='def50003-3000-4000-8000-000000000021'),'later successful issuance supersedes A');
select ok((select invalidated_at is null and used_at is null from identity.verification_challenge where verification_challenge_id='def50003-3000-4000-8000-000000000022'),'B is the final open row');
select is((select count(*)::int from identity.verification_challenge where normalized_contact_value='race@synthetic.invalid' and purpose='login' and used_at is null and invalidated_at is null),1,'same pair has exactly one structurally open row');
select is((select count(*)::int from audit.audit_event where target_entity_id in ('def50003-3000-4000-8000-000000000021','def50003-3000-4000-8000-000000000022')),2,'both successful calls have exact audit rows');
select ok((select bool_and(failed_attempt_count=0 and resend_count=0 and locked_until is null) from identity.verification_challenge where verification_challenge_id in ('def50003-3000-4000-8000-000000000021','def50003-3000-4000-8000-000000000022')),'both successful calls initialize neutral counters');

select is(dblink_exec('def5_s3_a','begin'),'BEGIN','A begins different-pair proof');
select is((select outcome from dblink('def5_s3_a',$q$select * from public.solmind_issue_verification_challenge('def50003-3000-4000-8000-000000000023','pair-a@synthetic.invalid','email','login','email','svf1:3333333333333333333333333333333333333333333333333333333333333333',null,null)$q$)x(outcome text)),'issued','A issues pair A while retaining its transaction lock');
select is((select outcome from dblink('def5_s3_b',$q$select * from public.solmind_issue_verification_challenge('def50003-3000-4000-8000-000000000024','pair-b@synthetic.invalid','email','login','email','svf1:4444444444444444444444444444444444444444444444444444444444444444',null,null)$q$)x(outcome text)),'issued','different pair completes without cross-write');
select is(dblink_exec('def5_s3_a','rollback'),'ROLLBACK','A rolls back pair A proof');
select ok((select invalidated_at is null from identity.verification_challenge where verification_challenge_id='def50003-3000-4000-8000-000000000024'),'pair B remains independently open');
select is((select count(*)::int from identity.verification_challenge where verification_challenge_id='def50003-3000-4000-8000-000000000023'),0,'rolled-back pair A leaves no row');

select is(dblink_exec('def5_s3_a','reset role; delete from audit.audit_event where target_entity_id::text like ''def50003-%''; delete from identity.verification_challenge where verification_challenge_id::text like ''def50003-%'''),'DELETE 3','owner cleanup removes three committed challenges after audit rows');
select is((select count(*)::int from identity.verification_challenge where verification_challenge_id::text like 'def50003-%'),0,'no challenge residue remains');
select is((select count(*)::int from audit.audit_event where target_entity_id::text like 'def50003-%'),0,'no audit residue remains');
create temp table def5_s3_counts_after as
select n.nspname||'.'||c.relname relation_name,
       (xpath('/row/c/text()',query_to_xml(format('select count(*) c from %I.%I',n.nspname,c.relname),false,true,'')))[1]::text::bigint row_count,
       (xpath('/row/fingerprint/text()',query_to_xml(format('select md5(coalesce(string_agg(to_jsonb(t)::text, '','' order by to_jsonb(t)::text), '''')) fingerprint from %I.%I t',n.nspname,c.relname),false,true,'')))[1]::text row_fingerprint
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p') and n.nspname in ('identity','core','audit','content','ai','methodology','notification','scheduling');
select results_eq($$select relation_name,row_count,row_fingerprint from def5_s3_counts_after order by 1$$,$$select relation_name,row_count,row_fingerprint from def5_s3_counts_before order by 1$$,'all application-table contents return exactly to baseline');
select lives_ok($$select dblink_disconnect('def5_s3_a')$$,'A disconnects');
select lives_ok($$select dblink_disconnect('def5_s3_b')$$,'B disconnects');

select * from finish();
rollback;
