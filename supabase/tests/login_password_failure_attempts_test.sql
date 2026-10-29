-- Review-only, unrun. Synthetic direct functional proof for Card 9 item 15.
-- Root runs only in its disposable isolated SQL target; transaction rolls back.
begin;
select plan(16);

create function pg_temp.login15_id(i integer) returns uuid language sql immutable as $$
  select ('15150000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid
$$;
-- Distinct synthetic accounts/primary contacts preserve the real schema's
-- one-active-label and one-structurally-open-challenge constraints.
insert into identity.user_account(user_account_id,display_name,account_status)
select pg_temp.login15_id(i),'Synthetic password-count account '||i::text,'active' from generate_series(1,14) s(i);
insert into identity.user_role_assignment(user_account_id,role_code,role_status)
select pg_temp.login15_id(i),case when i=2 then 'admin' else 'guide' end,'active' from generate_series(1,14) s(i);
insert into identity.user_contact_method(user_contact_method_id,user_account_id,contact_method_type,
  contact_label,contact_value,normalized_contact_value,is_verified,login_enabled,status)
select pg_temp.login15_id(100+i),pg_temp.login15_id(i),'email','primary',
  'login15-'||i::text||'@synthetic.invalid','login15-'||i::text||'@synthetic.invalid',true,true,'active'
from generate_series(1,14) s(i);
insert into identity.verification_challenge(verification_challenge_id,user_account_id,user_contact_method_id,
  normalized_contact_value,contact_method_type,purpose,delivery_channel,code_hash,expires_at,
  used_at,invalidated_at,failed_attempt_count)
select pg_temp.login15_id(200+i),pg_temp.login15_id(i),pg_temp.login15_id(case when i=8 then 102 else 100+i end),
  'login15-'||i::text||'@synthetic.invalid','email',case when i=7 then 'contact_verify' else 'login' end,'email',
  case when i=9 then null else 'svf1:'||repeat('15',32) end,
  case when i=4 then now()-interval '1 minute' else now()+interval '10 minutes' end,
  case when i=3 then now() else null end,case when i=5 then now() else null end,case when i=6 then 5 else 0 end
from generate_series(1,14) s(i);

create temp table login15_refused_before as
select verification_challenge_id,failed_attempt_count,used_at,invalidated_at
from identity.verification_challenge
where verification_challenge_id in (select pg_temp.login15_id(200+i) from unnest(array[3,4,5,6,7,8,9,10,14]) i);

set local role service_role;
select results_eq($$select recorded from public.solmind_record_login_password_failure(pg_temp.login15_id(1),pg_temp.login15_id(201),'guide')$$,$$select true$$,'Guide confirmed wrong password records one failure');
reset role;
select ok((select failed_attempt_count=1 and used_at is null and invalidated_at is null and resend_count=0
  and code_hash='svf1:'||repeat('15',32) from identity.verification_challenge where verification_challenge_id=pg_temp.login15_id(201))
  and (select count(*)=1 and bool_and(event_type='verification_challenge_failed' and action='deny' and reason_code='password_mismatch'
    and actor_user_account_id is null and actor_role_context='system' and target_entity_type='verification_challenge'
    and metadata='{"purpose":"login","attempt_number":1}'::jsonb and ip_address is null and user_agent is null)
    from audit.audit_event where target_entity_id=pg_temp.login15_id(201)),
  'counter and credential-free system audit commit together without using the code');
set local role service_role;
select results_eq($$select recorded from public.solmind_record_login_password_failure(pg_temp.login15_id(2),pg_temp.login15_id(202),'admin')$$,$$select true$$,'Admin uses the same per-code recorder');

-- Four actual wrong-code redemptions, then a wrong password: one shared budget.
do $$ begin
  for i in 1..4 loop
    perform public.solmind_redeem_verification_challenge(pg_temp.login15_id(211),'login','svf1:'||repeat('00',32));
  end loop;
end $$;
select results_eq($$select recorded from public.solmind_record_login_password_failure(pg_temp.login15_id(11),pg_temp.login15_id(211),'guide')$$,$$select true$$,'wrong password is the fifth combined failure');
reset role;
select ok((select failed_attempt_count=5 and invalidated_at is not null and used_at is null
    from identity.verification_challenge where verification_challenge_id=pg_temp.login15_id(211))
  and (select count(*)=5 and count(*) filter(where reason_code='code_mismatch')=4
    and count(*) filter(where reason_code='password_mismatch')=1
    and max((metadata->>'attempt_number')::integer)=5
    from audit.audit_event where target_entity_id=pg_temp.login15_id(211)),
  'fifth combined failure invalidates the exact code with coherent audit numbering');
set local role service_role;
select results_eq($$select recorded from public.solmind_record_login_password_failure(pg_temp.login15_id(11),pg_temp.login15_id(211),'guide')$$,$$select false$$,'exhausted code cannot increment or audit again');
select results_eq($$select recorded from public.solmind_record_login_password_failure(pg_temp.login15_id(1),pg_temp.login15_id(999),'guide')$$,$$select false$$,'wholly missing challenge has no recorded attempt');
select results_eq($$select bool_and(not r.recorded) from unnest(array[3,4,5,6,7,8,9,10,14]) i
  cross join lateral public.solmind_record_login_password_failure(pg_temp.login15_id(case when i=14 then 2 else i end),
    pg_temp.login15_id(200+i),case when i in (10,14) then 'admin' else 'guide' end) r$$,$$select true$$,
  'used expired invalidated exhausted non-login cross-contact missing-verifier wrong-role and wrong-owner codes refuse');
reset role;
select ok(not exists(
    (select verification_challenge_id,failed_attempt_count,used_at,invalidated_at from identity.verification_challenge
      where verification_challenge_id in (select verification_challenge_id from login15_refused_before)
     except select * from login15_refused_before)
    union all
    (select * from login15_refused_before except select verification_challenge_id,failed_attempt_count,used_at,invalidated_at
      from identity.verification_challenge where verification_challenge_id in (select verification_challenge_id from login15_refused_before)))
  and not exists(select 1 from audit.audit_event where target_entity_id in (select verification_challenge_id from login15_refused_before)),
  'ineligible failure reports leave every scoped counter and audit unchanged');

set local role service_role;
select results_eq($$select recorded from public.solmind_record_login_password_failure(pg_temp.login15_id(13),pg_temp.login15_id(213),'guide')$$,$$select true$$,'one wrong password leaves room for a later correct login');
select results_eq($$select outcome from public.solmind_redeem_verification_challenge(pg_temp.login15_id(213),'login','svf1:'||repeat('15',32))$$,$$select 'redeemed'::text$$,'correct redemption remains successful after a wrong password');
reset role;
select ok((select failed_attempt_count=1 and used_at is not null and invalidated_at is null
    from identity.verification_challenge where verification_challenge_id=pg_temp.login15_id(213))
  and (select count(*)=2 and count(*) filter(where event_type='verification_challenge_redeemed')=1
    from audit.audit_event where target_entity_id=pg_temp.login15_id(213)),
  'successful redemption preserves failure count and its ordinary success audit');

create function pg_temp.login15_reject_audit() returns trigger language plpgsql as $$
begin raise exception 'login15_induced_audit_failure'; end $$;
create trigger login15_reject_audit before insert on audit.audit_event
for each row execute function pg_temp.login15_reject_audit();
set local role service_role;
select throws_ok($$select * from public.solmind_record_login_password_failure(pg_temp.login15_id(12),pg_temp.login15_id(212),'guide')$$,
  'P0001','login15_induced_audit_failure','audit failure propagates without a fake recorded acknowledgement');
reset role;
select ok((select failed_attempt_count=0 and used_at is null and invalidated_at is null
    from identity.verification_challenge where verification_challenge_id=pg_temp.login15_id(212))
  and not exists(select 1 from audit.audit_event where target_entity_id=pg_temp.login15_id(212)),
  'audit failure rolls back the paired failed-attempt update');
set local role service_role;
select throws_ok($$select * from public.solmind_record_login_password_failure(pg_temp.login15_id(1),pg_temp.login15_id(201),'explorer')$$,
  'P0001','solmind_password_failure_invalid_request','Explorer role is outside this narrow capability');
reset role;
select ok(has_function_privilege('service_role','public.solmind_record_login_password_failure(uuid,uuid,text)'::regprocedure,'EXECUTE')
  and not has_function_privilege('anon','public.solmind_record_login_password_failure(uuid,uuid,text)'::regprocedure,'EXECUTE')
  and not has_function_privilege('authenticated','public.solmind_record_login_password_failure(uuid,uuid,text)'::regprocedure,'EXECUTE'),
  'only service role receives this public RPC capability');

select * from finish();
rollback;
