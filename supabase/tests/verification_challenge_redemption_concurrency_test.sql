-- DEF5-S2 real-function concurrency proofs. Local ephemeral database only.
-- A hard SQL error can leave reserved synthetic rows. Recovery requires Paul's approval:
-- delete from audit.audit_event where target_entity_id::text like 'def50002-%';
-- delete from identity.verification_challenge where verification_challenge_id::text like 'def50002-%';
-- Never run that cleanup against hosted or real-user data.

begin;
create extension if not exists dblink;
select plan(38);

create function pg_temp.def5_s2_wait_for_lock(p_connection text, p_pid integer)
returns boolean language plpgsql as $$
begin
  for attempt in 1..30 loop
    if dblink_is_busy(p_connection) = 1 and exists (
      select 1 from pg_catalog.pg_stat_activity
       where pid = p_pid and wait_event_type = 'Lock'
    ) then return true; end if;
    perform pg_catalog.pg_sleep(0.10);
  end loop;
  return false;
end;
$$;

create temp table def5_s2_counts_before as
select n.nspname||'.'||c.relname relation_name,
       (xpath('/row/c/text()',query_to_xml(format('select count(*) c from %I.%I',n.nspname,c.relname),false,true,'')))[1]::text::bigint row_count,
       (xpath('/row/fingerprint/text()',query_to_xml(format('select md5(coalesce(string_agg(to_jsonb(t)::text, '','' order by to_jsonb(t)::text), '''')) fingerprint from %I.%I t',n.nspname,c.relname),false,true,'')))[1]::text row_fingerprint
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p') and n.nspname in ('identity','core','audit','content','ai','methodology','notification','scheduling');
select cmp_ok((select count(*)::int from def5_s2_counts_before),'>',0,'before snapshot is nonempty');

select is((select count(*)::int from identity.verification_challenge where verification_challenge_id::text like 'def50002-%'),0,'preflight finds no challenge residue');
select is((select count(*)::int from audit.audit_event where target_entity_id::text like 'def50002-%'),0,'preflight finds no audit residue');

select lives_ok($$select dblink_connect('def5_s2_a','host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres connect_timeout=5')$$,'connection A opens');
select lives_ok($$select dblink_connect('def5_s2_b','host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres connect_timeout=5')$$,'connection B opens');
select is(dblink_exec('def5_s2_a','set statement_timeout=''5s'''),'SET','A timeout bounded');
select is(dblink_exec('def5_s2_b','set statement_timeout=''5s'''),'SET','B timeout bounded');

create temp table def5_s2_pids(name text primary key,pid int) on commit drop;
insert into def5_s2_pids select 'a',pid from dblink('def5_s2_a','select pg_backend_pid()') x(pid int)
union all select 'b',pid from dblink('def5_s2_b','select pg_backend_pid()') x(pid int);
select is((select count(distinct pid)::int from (select pg_backend_pid() pid union all select pid from def5_s2_pids)s),3,'three distinct sessions');

select is(dblink_exec('def5_s2_a',$q$
 insert into identity.verification_challenge
 (verification_challenge_id,normalized_contact_value,contact_method_type,purpose,delivery_channel,code_hash,expires_at,failed_attempt_count)
 values
 ('def50002-0000-4000-8000-000000000011','def5s2-concurrency-11@synthetic.invalid','email','login','email','svf1:e39645b1799ff11ab0b89a4bb8b2f4406e3544daa199f620787426f8594efe5b',now()+interval '10 minutes',0),
 ('def50002-0000-4000-8000-000000000012','def5s2-concurrency-12@synthetic.invalid','email','login','email','svf1:335886b5e346e6a203197eff5c0fcd1e32228dfab30592892647937e052553bf',now()+interval '10 minutes',3)
$q$),'INSERT 0 2','owner commits two fixtures');
select is((select count(*)::int from identity.verification_challenge where verification_challenge_id::text like 'def50002-%'),2,'orchestrator sees committed fixtures in same database');
select is(dblink_exec('def5_s2_a','set role service_role'),'SET','A assumes service_role');
select is(dblink_exec('def5_s2_b','set role service_role'),'SET','B assumes service_role');
select is((select effective_role from dblink('def5_s2_a','select current_user::text') x(effective_role text)),'service_role','A effective role is service_role');
select is((select effective_role from dblink('def5_s2_b','select current_user::text') x(effective_role text)),'service_role','B effective role is service_role');

select is(dblink_exec('def5_s2_a','begin'),'BEGIN','A begins redemption race');
select is((select outcome from dblink('def5_s2_a',$q$select * from public.solmind_redeem_verification_challenge('def50002-0000-4000-8000-000000000011','login','svf1:e39645b1799ff11ab0b89a4bb8b2f4406e3544daa199f620787426f8594efe5b')$q$)x(outcome text)),'redeemed','A redeems while holding lock');
select ok(dblink_send_query('def5_s2_b',$q$select * from public.solmind_redeem_verification_challenge('def50002-0000-4000-8000-000000000011','login','svf1:e39645b1799ff11ab0b89a4bb8b2f4406e3544daa199f620787426f8594efe5b')$q$)=1,'B submits competing redemption');
select ok(pg_temp.def5_s2_wait_for_lock('def5_s2_b',(select pid from def5_s2_pids where name='b')),'B observed waiting on row lock within bounded poll');
select is(dblink_exec('def5_s2_a','commit'),'COMMIT','A commits redemption');
select is((select outcome from dblink_get_result('def5_s2_b')x(outcome text)),'denied','B loses and denies');
select * from dblink_get_result('def5_s2_b') x(outcome text);
select is((select failed_attempt_count from identity.verification_challenge where verification_challenge_id='def50002-0000-4000-8000-000000000011'),0,'loser does not increment');
select is((select count(*)::int from audit.audit_event where target_entity_id='def50002-0000-4000-8000-000000000011'),1,'double redemption writes one audit row');

select is(dblink_exec('def5_s2_a','begin'),'BEGIN','A begins wrong-guess race');
select is((select outcome from dblink('def5_s2_a',$q$select * from public.solmind_redeem_verification_challenge('def50002-0000-4000-8000-000000000012','login','svf1:5f839b3aae9fb0c546a7d134dd75b6212597188fbfaf9f4e33b477755ec17053')$q$)x(outcome text)),'denied','A authentic wrong-code verifier commits only after transaction');
select ok(dblink_send_query('def5_s2_b',$q$select * from public.solmind_redeem_verification_challenge('def50002-0000-4000-8000-000000000012','login','svf1:31d912fea9193d0f9e01dd402904936a2a3148e4aa20031858b4c01f20defb06')$q$)=1,'B submits concurrent authentic wrong-code verifier');
select ok(pg_temp.def5_s2_wait_for_lock('def5_s2_b',(select pid from def5_s2_pids where name='b')),'wrong guess contention observed within bounded poll');
select is(dblink_exec('def5_s2_a','commit'),'COMMIT','A commits increment');
select is((select outcome from dblink_get_result('def5_s2_b')x(outcome text)),'denied','B commits second increment');
select * from dblink_get_result('def5_s2_b') x(outcome text);
select is((select failed_attempt_count from identity.verification_challenge where verification_challenge_id='def50002-0000-4000-8000-000000000012'),5,'two wrong guesses reach five');
select ok((select invalidated_at is not null from identity.verification_challenge where verification_challenge_id='def50002-0000-4000-8000-000000000012'),'fifth wrong guess invalidates');
select results_eq($$select (metadata->>'attempt_number')::int from audit.audit_event where target_entity_id='def50002-0000-4000-8000-000000000012' order by 1$$,$$select unnest(array[4,5])$$,'audit attempts are exactly four and five');
select is((select outcome from dblink('def5_s2_a',$q$select * from public.solmind_redeem_verification_challenge('def50002-0000-4000-8000-000000000012','login','svf1:335886b5e346e6a203197eff5c0fcd1e32228dfab30592892647937e052553bf')$q$) x(outcome text)),'denied','correct verifier remains denied after invalidation through service_role');

select is(dblink_exec('def5_s2_a','reset role; delete from audit.audit_event where target_entity_id::text like ''def50002-%''; delete from identity.verification_challenge where verification_challenge_id::text like ''def50002-%'''),'DELETE 2','owner cleanup removes challenges after audit rows');
select is((select count(*)::int from identity.verification_challenge where verification_challenge_id::text like 'def50002-%'),0,'no challenge residue remains');
select is((select count(*)::int from audit.audit_event where target_entity_id::text like 'def50002-%'),0,'no audit residue remains');
create temp table def5_s2_counts_after as
select n.nspname||'.'||c.relname relation_name,
       (xpath('/row/c/text()',query_to_xml(format('select count(*) c from %I.%I',n.nspname,c.relname),false,true,'')))[1]::text::bigint row_count,
       (xpath('/row/fingerprint/text()',query_to_xml(format('select md5(coalesce(string_agg(to_jsonb(t)::text, '','' order by to_jsonb(t)::text), '''')) fingerprint from %I.%I t',n.nspname,c.relname),false,true,'')))[1]::text row_fingerprint
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p') and n.nspname in ('identity','core','audit','content','ai','methodology','notification','scheduling');
select results_eq($$select relation_name,row_count,row_fingerprint from def5_s2_counts_after order by 1$$,$$select relation_name,row_count,row_fingerprint from def5_s2_counts_before order by 1$$,'all application-table row contents return exactly to baseline');
select lives_ok($$select dblink_disconnect('def5_s2_a')$$,'A disconnects');
select lives_ok($$select dblink_disconnect('def5_s2_b')$$,'B disconnects');

select * from finish();
rollback;
