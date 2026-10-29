-- Card 9 item 17 focused proposal draft, UNRUN. Isolated synthetic SQL only.
-- Root must run migration/full applicable suite and two-connection contention
-- proof; this one-connection file does not establish concurrent settlement.
begin;
select plan(40);

create function pg_temp.login17_id(i integer) returns uuid language sql immutable as $$
  select ('17170000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid
$$;
insert into identity.user_account(user_account_id,display_name,account_status)
select pg_temp.login17_id(i),'Synthetic stable flow account '||i::text,'active'
from generate_series(1,6) s(i);
insert into identity.user_role_assignment(user_account_id,role_code,role_status)
select pg_temp.login17_id(i),case when i=2 then 'admin' when i=3 then 'explorer' else 'guide' end,'active'
from generate_series(1,6) s(i);
insert into identity.user_role_assignment(user_account_id,role_code,role_status)
values(pg_temp.login17_id(1),'admin','active');
insert into identity.user_contact_method(user_contact_method_id,user_account_id,
  contact_method_type,contact_label,contact_value,normalized_contact_value,is_verified,login_enabled,status)
select pg_temp.login17_id(100+i),pg_temp.login17_id(i),'email','primary',
  'login17-'||i::text||'@synthetic.invalid','login17-'||i::text||'@synthetic.invalid',true,true,'active'
from generate_series(1,6) s(i);
insert into identity.auth_provider_identity(user_account_id,provider_name,provider_user_id,provider_email,status)
select pg_temp.login17_id(i),'supabase',pg_temp.login17_id(200+i)::text,
  'login17-'||i::text||'@synthetic.invalid','active'
from generate_series(1,6) s(i);

create function pg_temp.login17_issue(p_number integer,p_account integer default 1,
  p_flow uuid default pg_temp.login17_id(9001),p_role text default 'guide')
returns text language sql as $$
  select outcome from public.solmind_issue_login_flow_verification_challenge(
    pg_temp.login17_id(1000+p_number),'login17-'||p_account::text||'@synthetic.invalid',
    'email','login','email','svf1:'||repeat('17',32),pg_temp.login17_id(p_account),
    pg_temp.login17_id(100+p_account),p_flow,p_role)
$$;

-- 1-4: the narrow stored shape and public capability boundary.
select has_column('identity','verification_challenge','login_flow_id','flow selector column exists');
select has_index('identity','verification_challenge','verification_challenge_login_flow_open_idx','one structurally open mapping per flow');
select ok(has_function_privilege('service_role',
  'public.solmind_issue_login_flow_verification_challenge(uuid,text,text,text,text,text,uuid,uuid,uuid,text)'::regprocedure,'EXECUTE')
  and not has_function_privilege('anon',
  'public.solmind_issue_login_flow_verification_challenge(uuid,text,text,text,text,text,uuid,uuid,uuid,text)'::regprocedure,'EXECUTE')
  and not has_function_privilege('authenticated',
  'public.solmind_issue_login_flow_verification_challenge(uuid,text,text,text,text,text,uuid,uuid,uuid,text)'::regprocedure,'EXECUTE'),
  'only service role can issue a bound login flow');
select ok(has_function_privilege('service_role','public.solmind_resolve_login_flow_challenge(uuid,uuid,uuid,text)'::regprocedure,'EXECUTE')
  and not has_function_privilege('anon','public.solmind_resolve_login_flow_challenge(uuid,uuid,uuid,text)'::regprocedure,'EXECUTE')
  and not has_function_privilege('authenticated','public.solmind_resolve_login_flow_challenge(uuid,uuid,uuid,text)'::regprocedure,'EXECUTE'),
  'only service role can resolve a private actual challenge');

set local role service_role;
-- 5-6: real issuance and closed one-row resolution.
select is(pg_temp.login17_issue(1),'issued','first real code binds the stable flow');
select results_eq($$select * from public.solmind_resolve_login_flow_challenge(
  pg_temp.login17_id(9001),pg_temp.login17_id(1),pg_temp.login17_id(101),'guide')$$,
  $$select 'found'::text,pg_temp.login17_id(1001)$$,'flow resolves exactly its actual code UUID');
reset role;
-- 7: ordinary lifetime/audit remain on the actual challenge, not an alias event.
select ok((select login_flow_id=pg_temp.login17_id(9001) and login_flow_role_context='guide'
    and expires_at=now()+interval '10 minutes' and used_at is null and failed_attempt_count=0
    from identity.verification_challenge where verification_challenge_id=pg_temp.login17_id(1001))
  and (select count(*)=1 and bool_and(event_type='verification_challenge_issued'
    and metadata='{"purpose":"login"}'::jsonb)
    from audit.audit_event where target_entity_id=pg_temp.login17_id(1001)),
  'mapping and existing actual-challenge audit commit together without changing expiry');

set local role service_role;
-- 8-9: a genuine resend advances the private candidate, not the public flow.
select is(pg_temp.login17_issue(2),'issued','ordinary resend really issues a newer code');
select results_eq($$select * from public.solmind_resolve_login_flow_challenge(
  pg_temp.login17_id(9001),pg_temp.login17_id(1),pg_temp.login17_id(101),'guide')$$,
  $$select 'found'::text,pg_temp.login17_id(1002)$$,'same flow now resolves the newer actual UUID');
reset role;
-- 10
select ok((select invalidated_at is not null and used_at is null
  from identity.verification_challenge where verification_challenge_id=pg_temp.login17_id(1001)),
  'successful resend supersedes the prior actual code');
set local role service_role;
-- 11-14: the current six-unused budget remains exact.
select results_eq($$select bool_and(pg_temp.login17_issue(i)='issued') from generate_series(3,6) s(i)$$,
  $$select true$$,'third through sixth unused issuances succeed in the same flow');
select is(pg_temp.login17_issue(7),'denied','seventh unused resend is still denied');
select is(pg_temp.login17_issue(8),'denied','another denied resend does not extend the budget');
select results_eq($$select * from public.solmind_resolve_login_flow_challenge(
  pg_temp.login17_id(9001),pg_temp.login17_id(1),pg_temp.login17_id(101),'guide')$$,
  $$select 'found'::text,pg_temp.login17_id(1006)$$,'denied seventh and eighth resends keep the sixth actual selector usable');
reset role;
-- 15
select ok((select count(*)=6 and count(*) filter(where used_at is null and invalidated_at is null)=1
    from identity.verification_challenge where login_flow_id=pg_temp.login17_id(9001))
  and (select count(*)=6 from audit.audit_event where target_entity_id in(
    select pg_temp.login17_id(1000+i) from generate_series(1,8) s(i)))
  and not exists(select 1 from identity.verification_challenge
    where verification_challenge_id in(pg_temp.login17_id(1007),pg_temp.login17_id(1008))),
  'denials add no challenge, mapping or audit and preserve one current sixth code');
set local role service_role;
-- 16-19: exactly one existing redemption, no candidate search or replay.
select is((select outcome from public.solmind_redeem_verification_challenge(
  pg_temp.login17_id(1006),'login','svf1:'||repeat('17',32))),'redeemed','sixth actual code can be redeemed after denied resends');
select is((select outcome from public.solmind_redeem_verification_challenge(
  pg_temp.login17_id(1006),'login','svf1:'||repeat('17',32))),'denied','the redeemed code cannot replay');
select results_eq($$select * from public.solmind_resolve_login_flow_challenge(
  pg_temp.login17_id(9001),pg_temp.login17_id(1),pg_temp.login17_id(101),'guide')$$,
  $$select 'not_found'::text,null::uuid$$,'a used current mapping resolves no candidate');
select is(pg_temp.login17_issue(7),'issued','completed code is excluded from the unchanged six-unused rule');

-- 20-24: immutable role/account/contact scope, regardless of current eligibility.
select is(pg_temp.login17_issue(9,1,pg_temp.login17_id(9001),'admin'),'denied',
  'same eligible account cannot rebind retained flow history to another role');
select is(pg_temp.login17_issue(41,4,pg_temp.login17_id(9001),'guide'),'denied',
  'another eligible account/contact cannot adopt a retained flow');
select results_eq($$select * from public.solmind_resolve_login_flow_challenge(
  pg_temp.login17_id(9001),pg_temp.login17_id(1),pg_temp.login17_id(104),'guide')$$,
  $$select 'not_found'::text,null::uuid$$,'foreign contact does not resolve');
select results_eq($$select * from public.solmind_resolve_login_flow_challenge(
  pg_temp.login17_id(9001),pg_temp.login17_id(1),pg_temp.login17_id(101),'admin')$$,
  $$select 'not_found'::text,null::uuid$$,'other eligible role does not resolve the Guide flow');
select results_eq($$select * from public.solmind_resolve_login_flow_challenge(
  pg_temp.login17_id(9999),pg_temp.login17_id(1),pg_temp.login17_id(101),'guide')$$,
  $$select 'not_found'::text,null::uuid$$,'unknown flow returns the same closed no-match shape');
reset role;
update identity.verification_challenge set expires_at=now()-interval '1 second'
where verification_challenge_id=pg_temp.login17_id(1007);
set local role service_role;
-- 25
select results_eq($$select * from public.solmind_resolve_login_flow_challenge(
  pg_temp.login17_id(9001),pg_temp.login17_id(1),pg_temp.login17_id(101),'guide')$$,
  $$select 'not_found'::text,null::uuid$$,'flow selection never extends ordinary code expiry');
reset role;
update identity.verification_challenge set expires_at=now()+interval '10 minutes',failed_attempt_count=5
where verification_challenge_id=pg_temp.login17_id(1007);
set local role service_role;
-- 26
select results_eq($$select * from public.solmind_resolve_login_flow_challenge(
  pg_temp.login17_id(9001),pg_temp.login17_id(1),pg_temp.login17_id(101),'guide')$$,
  $$select 'not_found'::text,null::uuid$$,'an exhausted code cannot be selected');
reset role;
update identity.verification_challenge set failed_attempt_count=0
where verification_challenge_id=pg_temp.login17_id(1007);
update identity.user_contact_method set login_enabled=false where user_contact_method_id=pg_temp.login17_id(101);
set local role service_role;
-- 27
select results_eq($$select * from public.solmind_resolve_login_flow_challenge(
  pg_temp.login17_id(9001),pg_temp.login17_id(1),pg_temp.login17_id(101),'guide')$$,
  $$select 'not_found'::text,null::uuid$$,'current account/contact eligibility is rechecked');
reset role;
update identity.user_contact_method set login_enabled=true where user_contact_method_id=pg_temp.login17_id(101);
-- 28-29
select throws_ok($$update identity.verification_challenge set login_flow_role_context='admin'
  where verification_challenge_id=pg_temp.login17_id(1007)$$,
  'P0001','solmind_login_flow_binding_immutable','assigned flow role history cannot be rewritten');
select throws_ok($$update identity.verification_challenge set user_contact_method_id=pg_temp.login17_id(104)
  where verification_challenge_id=pg_temp.login17_id(1007)$$,
  'P0001','solmind_login_flow_binding_immutable','assigned flow contact history cannot be rewritten');

set local role service_role;
-- 30-31: all three fixed roles use the same narrow protocol.
select is(pg_temp.login17_issue(21,2,pg_temp.login17_id(9002),'admin'),'issued','Admin flow binds its own actual code');
select is(pg_temp.login17_issue(31,3,pg_temp.login17_id(9003),'explorer'),'issued','Explorer flow binds its own actual code');
-- 32: the banked per-code password budget receives the actual ID, not the alias.
select results_eq($$select recorded from public.solmind_record_login_password_failure(
  pg_temp.login17_id(2),pg_temp.login17_id(1021),'admin')$$,$$select true$$,
  'wrong password records one failure on the resolved actual Admin code');
reset role;
-- 33
select ok((select failed_attempt_count=1 and used_at is null and login_flow_id=pg_temp.login17_id(9002)
    from identity.verification_challenge where verification_challenge_id=pg_temp.login17_id(1021)),
  'failure counter stays on the actual code and does not consume its flow');

set local role service_role;
-- 34
select is(pg_temp.login17_issue(50,5,pg_temp.login17_id(9005),'guide'),'issued','prepare an actual prior code for atomic rollback proof');
reset role;
create function pg_temp.login17_reject_audit() returns trigger language plpgsql as $$
begin
  if new.target_entity_id=pg_temp.login17_id(1051) then raise exception 'login17_induced_audit_failure'; end if;
  return new;
end $$;
create trigger login17_reject_audit before insert on audit.audit_event
for each row execute function pg_temp.login17_reject_audit();
set local role service_role;
-- 35
select throws_ok($$select pg_temp.login17_issue(51,5,pg_temp.login17_id(9005),'guide')$$,
  'P0001','login17_induced_audit_failure','audit failure propagates without a false issuance');
reset role;
drop trigger login17_reject_audit on audit.audit_event;
-- 36
select ok((select invalidated_at is null and used_at is null and login_flow_id=pg_temp.login17_id(9005)
    from identity.verification_challenge where verification_challenge_id=pg_temp.login17_id(1050))
  and not exists(select 1 from identity.verification_challenge where verification_challenge_id=pg_temp.login17_id(1051))
  and not exists(select 1 from audit.audit_event where target_entity_id=pg_temp.login17_id(1051)),
  'audit failure rolls back supersession, new challenge and mapping together');

create function pg_temp.login17_reject_mapping() returns trigger language plpgsql as $$
begin
  if new.verification_challenge_id=pg_temp.login17_id(1061) and new.login_flow_id is not null
    then raise exception 'login17_induced_mapping_failure'; end if;
  return new;
end $$;
create trigger login17_reject_mapping before update on identity.verification_challenge
for each row execute function pg_temp.login17_reject_mapping();
set local role service_role;
-- 37
select throws_ok($$select pg_temp.login17_issue(61,6,pg_temp.login17_id(9006),'guide')$$,
  'P0001','login17_induced_mapping_failure','mapping failure propagates after the original issuer');
reset role;
drop trigger login17_reject_mapping on identity.verification_challenge;
-- 38
select ok(not exists(select 1 from identity.verification_challenge where verification_challenge_id=pg_temp.login17_id(1061))
  and not exists(select 1 from audit.audit_event where target_entity_id=pg_temp.login17_id(1061)),
  'mapping failure rolls back the otherwise issued challenge and audit');
set local role service_role;
-- 39-40
select throws_ok($$select pg_temp.login17_issue(62,6,'00000000-0000-0000-0000-000000000000'::uuid,'guide')$$,
  'P0001','solmind_login_flow_invalid_request','known nil is not a valid new flow selector');
select throws_ok($$select * from public.solmind_resolve_login_flow_challenge(
  null,pg_temp.login17_id(1),pg_temp.login17_id(101),'guide')$$,
  'P0001','solmind_login_flow_invalid_request','malformed resolver arguments fail before data lookup');
reset role;

select * from finish();
rollback;
