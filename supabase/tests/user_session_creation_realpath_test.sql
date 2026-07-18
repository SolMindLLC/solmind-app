begin;
select plan(65);

insert into identity.user_account (user_account_id,display_name,account_status)
values
  ('def50004-1000-4000-8000-000000000001','DEF5-S4 synthetic admin','active'),
  ('def50004-1000-4000-8000-000000000002','DEF5-S4 synthetic inactive','suspended'),
  ('def50004-1000-4000-8000-000000000003','DEF5-S4 synthetic active peer','active');
insert into identity.user_role_assignment (user_role_assignment_id,user_account_id,role_code,role_status)
values
  ('def50004-1100-4000-8000-000000000001','def50004-1000-4000-8000-000000000001','admin','active'),
  ('def50004-1100-4000-8000-000000000002','def50004-1000-4000-8000-000000000001','guide','suspended'),
  ('def50004-1100-4000-8000-000000000003','def50004-1000-4000-8000-000000000003','admin','active');
insert into identity.user_contact_method (
  user_contact_method_id,user_account_id,contact_method_type,contact_label,contact_value,
  normalized_contact_value,login_enabled,is_verified,status
) values
(
  'def50004-1200-4000-8000-000000000001','def50004-1000-4000-8000-000000000001',
  'email','primary','def5s4-admin@synthetic.invalid','def5s4-admin@synthetic.invalid',true,true,'active'
),
(
  'def50004-1200-4000-8000-000000000003','def50004-1000-4000-8000-000000000003',
  'email','primary','def5s4-peer@synthetic.invalid','def5s4-peer@synthetic.invalid',true,true,'active'
);

set local role service_role;
select results_eq(
  $$select * from public.solmind_issue_verification_challenge(
    'def50004-2000-4000-8000-000000000001','def5s4-admin@synthetic.invalid','email','login','email',
    'svf1:1111111111111111111111111111111111111111111111111111111111111111',
    'def50004-1000-4000-8000-000000000001','def50004-1200-4000-8000-000000000001')$$,
  $$select 'issued'::text$$,
  'real issuance function creates the first account-bound challenge'
);
select results_eq(
  $$select * from public.solmind_redeem_verification_challenge(
    'def50004-2000-4000-8000-000000000001','login',
    'svf1:1111111111111111111111111111111111111111111111111111111111111111')$$,
  $$select 'redeemed'::text$$,
  'real redemption function commits first evidence'
);
create temp table def5_s4_first_result as
select * from public.solmind_create_user_session(
  'def50004-1000-4000-8000-000000000001','admin',
  'def50004-2000-4000-8000-000000000001','login',1
);
reset role;
select is((select outcome from def5_s4_first_result),'created','fresh evidence creates a session');
select ok((select user_session_id is not null from def5_s4_first_result),'database returns a generated session UUID');
select results_eq(
  $$select expires_at-created_at from identity.user_session where user_session_id=(select user_session_id from def5_s4_first_result)$$,
  $$select interval '1 second'$$,
  'database computes the exact minimum-duration expiry from its captured clock'
);
select results_eq(
  $$select session_status,active_role_context,verification_challenge_id from identity.user_session where user_session_id=(select user_session_id from def5_s4_first_result)$$,
  $$select 'active'::text,'admin'::text,'def50004-2000-4000-8000-000000000001'::uuid$$,
  'created session is active and bound to role and challenge'
);
select is((select count(*)::int from audit.audit_event where target_entity_id=(select user_session_id from def5_s4_first_result)),1,'first creation writes one session audit row');
select results_eq(
  $$select event_type,action,reason_code,actor_user_account_id,actor_role_context,target_entity_type,metadata from audit.audit_event where target_entity_id=(select user_session_id from def5_s4_first_result)$$,
  $$select 'session_created'::text,'create'::text,'login_success'::text,'def50004-1000-4000-8000-000000000001'::uuid,'admin'::text,'user_session'::text,'{"purpose":"login"}'::jsonb$$,
  'first creation audit row is exact'
);
select is(
  (select count(*)::int from identity.authorizing_evidence_consumption where verification_challenge_id='def50004-2000-4000-8000-000000000001'),
  1,
  'first creation consumes the challenge exactly once in the shared backstop'
);
select results_eq(
  $$select consumer_type,consumer_record_id,consumed_at,retention_class
      from identity.authorizing_evidence_consumption
     where verification_challenge_id='def50004-2000-4000-8000-000000000001'$$,
  $$select 'user_session'::text,user_session_id,created_at,'security_log'::text
      from identity.user_session
     where user_session_id=(select user_session_id from def5_s4_first_result)$$,
  'first session and shared consumption use the same record and database clock'
);

set local role service_role;
create temp table def5_s4_retry_result as
select * from public.solmind_create_user_session(
  'def50004-1000-4000-8000-000000000001','admin',
  'def50004-2000-4000-8000-000000000001','login',1
);
reset role;
select is((select outcome from def5_s4_retry_result),'existing','exact response-loss retry returns existing');
select is((select user_session_id from def5_s4_retry_result),(select user_session_id from def5_s4_first_result),'exact retry returns the same UUID');
select is((select count(*)::int from audit.audit_event where target_entity_id=(select user_session_id from def5_s4_first_result)),1,'exact retry writes no audit row');
select is(
  (select count(*)::int from identity.authorizing_evidence_consumption where verification_challenge_id='def50004-2000-4000-8000-000000000001'),
  1,
  'exact retry does not consume evidence again'
);

update identity.verification_challenge
   set used_at = clock_timestamp()-interval '10 minutes'
 where verification_challenge_id='def50004-2000-4000-8000-000000000001';
set local role service_role;
select results_eq(
  $$select outcome,user_session_id from public.solmind_create_user_session(
    'def50004-1000-4000-8000-000000000001','admin',
    'def50004-2000-4000-8000-000000000001','login',1)$$,
  $$select 'existing'::text,user_session_id from def5_s4_first_result$$,
  'exact retry remains available after evidence freshness expires'
);

select results_eq(
  $$select * from public.solmind_issue_verification_challenge(
    'def50004-2000-4000-8000-000000000008','def5s4-admin@synthetic.invalid','email','role_reentry','email',
    'svf1:8888888888888888888888888888888888888888888888888888888888888888',
    'def50004-1000-4000-8000-000000000001','def50004-1200-4000-8000-000000000001')$$,
  $$select 'issued'::text$$,
  'real issuance creates delayed older evidence that will never mint its own session'
);
select results_eq(
  $$select * from public.solmind_redeem_verification_challenge(
    'def50004-2000-4000-8000-000000000008','role_reentry',
    'svf1:8888888888888888888888888888888888888888888888888888888888888888')$$,
  $$select 'redeemed'::text$$,
  'real redemption commits delayed older evidence without creating a session'
);

select results_eq(
  $$select * from public.solmind_issue_verification_challenge(
    'def50004-2000-4000-8000-000000000002','def5s4-admin@synthetic.invalid','email','role_reentry','email',
    'svf1:2222222222222222222222222222222222222222222222222222222222222222',
    'def50004-1000-4000-8000-000000000001','def50004-1200-4000-8000-000000000001')$$,
  $$select 'issued'::text$$,
  'real issuance creates replacement evidence'
);
select results_eq(
  $$select * from public.solmind_redeem_verification_challenge(
    'def50004-2000-4000-8000-000000000002','role_reentry',
    'svf1:2222222222222222222222222222222222222222222222222222222222222222')$$,
  $$select 'redeemed'::text$$,
  'real redemption commits replacement evidence'
);
create temp table def5_s4_second_result as
select * from public.solmind_create_user_session(
  'def50004-1000-4000-8000-000000000001','admin',
  'def50004-2000-4000-8000-000000000002','role_reentry',3600
);
reset role;
update identity.verification_challenge
   set used_at = (
     select used_at - interval '1 millisecond'
       from identity.verification_challenge
      where verification_challenge_id='def50004-2000-4000-8000-000000000002'
   )
 where verification_challenge_id='def50004-2000-4000-8000-000000000008';
select is((select outcome from def5_s4_second_result),'created','newer evidence creates a replacement session');
select ok((select user_session_id<>(select user_session_id from def5_s4_first_result) from def5_s4_second_result),'replacement receives a new database UUID');
select results_eq(
  $$select expires_at-created_at from identity.user_session where user_session_id=(select user_session_id from def5_s4_second_result)$$,
  $$select interval '1 hour'$$,
  'database computes the exact maximum-duration expiry from its captured clock'
);
select results_eq(
  $$select session_status,ended_at is not null from identity.user_session where user_session_id=(select user_session_id from def5_s4_first_result)$$,
  $$select 'revoked'::text,true$$,
  'replacement revokes and ends the old session'
);
select is((select count(*)::int from identity.user_session where user_account_id='def50004-1000-4000-8000-000000000001' and session_status='active'),1,'exactly one active account session remains');
select is((select count(*)::int from audit.audit_event where target_entity_id in ((select user_session_id from def5_s4_first_result),(select user_session_id from def5_s4_second_result)) and event_type in ('session_created','session_superseded')),3,'replacement yields one supersession and one additional creation audit');
select is(
  (select count(*)::int
     from identity.authorizing_evidence_consumption consumption
     join identity.verification_challenge challenge using (verification_challenge_id)
    where challenge.user_account_id='def50004-1000-4000-8000-000000000001'
      and consumption.consumer_type='user_session'),
  2,
  'replacement preserves the first consumption and inserts exactly one new consumption'
);
select results_eq(
  $$select event_type,action,reason_code,actor_user_account_id,actor_role_context,target_entity_type,target_entity_id,metadata
      from audit.audit_event
     where event_type='session_superseded'
       and target_entity_id=(select user_session_id from def5_s4_first_result)$$,
  $$select 'session_superseded'::text,'revoke'::text,'superseded_by_new_login'::text,
           'def50004-1000-4000-8000-000000000001'::uuid,'admin'::text,'user_session'::text,
           user_session_id,'{"new_role_context":"admin"}'::jsonb
      from def5_s4_first_result$$,
  'replacement supersession audit row is exact'
);
select results_eq(
  $$select * from public.solmind_issue_verification_challenge(
    'def50004-2000-4000-8000-000000000000','def5s4-admin@synthetic.invalid','email','role_reentry','email',
    'svf1:9999999999999999999999999999999999999999999999999999999999999999',
    'def50004-1000-4000-8000-000000000001','def50004-1200-4000-8000-000000000001')$$,
  $$select 'issued'::text$$,
  'real issuance creates evidence for the equal-timestamp ordering case'
);
select results_eq(
  $$select * from public.solmind_redeem_verification_challenge(
    'def50004-2000-4000-8000-000000000000','role_reentry',
    'svf1:9999999999999999999999999999999999999999999999999999999999999999')$$,
  $$select 'redeemed'::text$$,
  'real redemption commits evidence for the equal-timestamp ordering case'
);
update identity.verification_challenge
   set used_at = (
     select used_at
       from identity.verification_challenge
      where verification_challenge_id='def50004-2000-4000-8000-000000000002'
   )
 where verification_challenge_id='def50004-2000-4000-8000-000000000000';
set local role service_role;
select throws_ok(
  $$select * from public.solmind_create_user_session(
    'def50004-1000-4000-8000-000000000001','admin',
    'def50004-2000-4000-8000-000000000008','role_reentry',300)$$,
  'P0001','solmind_session_older_evidence',
  'never-sessionized older evidence cannot supersede a session created from newer evidence'
);
select throws_ok(
  $$select * from public.solmind_create_user_session(
    'def50004-1000-4000-8000-000000000001','admin',
    'def50004-2000-4000-8000-000000000000','role_reentry',300)$$,
  'P0001','solmind_session_older_evidence',
  'equal-timestamp evidence with the lower challenge UUID loses the deterministic database tie-break'
);
select throws_ok(
  $$select * from public.solmind_create_user_session(
    'def50004-1000-4000-8000-000000000001','admin',
    'def50004-2000-4000-8000-000000000001','login',300)$$,
  'P0001','solmind_session_conflicting_retry','older challenge cannot recover a superseded session'
);
reset role;
select is(
  (select user_session_id from identity.user_session where user_account_id='def50004-1000-4000-8000-000000000001' and session_status='active'),
  (select user_session_id from def5_s4_second_result),
  'older-evidence denial preserves the newer active session'
);
select is(
  (select count(*)::int from audit.audit_event where target_entity_id in ((select user_session_id from def5_s4_first_result),(select user_session_id from def5_s4_second_result)) and event_type in ('session_created','session_superseded')),
  3,
  'older-evidence denial writes no session audit row'
);
select is(
  (select count(*)::int
     from identity.authorizing_evidence_consumption consumption
     join identity.verification_challenge challenge using (verification_challenge_id)
    where challenge.user_account_id='def50004-1000-4000-8000-000000000001'),
  2,
  'older-evidence denials write no shared consumption'
);

set local role service_role;
select results_eq(
  $$select * from public.solmind_issue_verification_challenge(
    'def50004-2000-4000-8000-000000000010','def5s4-peer@synthetic.invalid','email','login','email',
    'svf1:1010101010101010101010101010101010101010101010101010101010101010',
    'def50004-1000-4000-8000-000000000003','def50004-1200-4000-8000-000000000003')$$,
  $$select 'issued'::text$$,
  'real issuance creates the lower-UUID side of the inverse equal-time control'
);
select results_eq(
  $$select * from public.solmind_redeem_verification_challenge(
    'def50004-2000-4000-8000-000000000010','login',
    'svf1:1010101010101010101010101010101010101010101010101010101010101010')$$,
  $$select 'redeemed'::text$$,
  'real redemption commits the lower-UUID equal-time control evidence'
);
create temp table def5_s4_equal_lower_result as
select * from public.solmind_create_user_session(
  'def50004-1000-4000-8000-000000000003','admin',
  'def50004-2000-4000-8000-000000000010','login',300
);
reset role;
select is((select outcome from def5_s4_equal_lower_result),'created','lower UUID creates the peer account first session');

set local role service_role;
select results_eq(
  $$select * from public.solmind_issue_verification_challenge(
    'def50004-2000-4000-8000-000000000011','def5s4-peer@synthetic.invalid','email','login','email',
    'svf1:1110111011101110111011101110111011101110111011101110111011101110',
    'def50004-1000-4000-8000-000000000003','def50004-1200-4000-8000-000000000003')$$,
  $$select 'issued'::text$$,
  'real issuance creates the higher-UUID side of the inverse equal-time control'
);
select results_eq(
  $$select * from public.solmind_redeem_verification_challenge(
    'def50004-2000-4000-8000-000000000011','login',
    'svf1:1110111011101110111011101110111011101110111011101110111011101110')$$,
  $$select 'redeemed'::text$$,
  'real redemption commits the higher-UUID equal-time control evidence'
);
reset role;
update identity.verification_challenge
   set used_at = (
     select used_at
       from identity.verification_challenge
      where verification_challenge_id='def50004-2000-4000-8000-000000000010'
   )
 where verification_challenge_id='def50004-2000-4000-8000-000000000011';
set local role service_role;
create temp table def5_s4_equal_higher_result as
select * from public.solmind_create_user_session(
  'def50004-1000-4000-8000-000000000003','admin',
  'def50004-2000-4000-8000-000000000011','login',300
);
reset role;
select is((select outcome from def5_s4_equal_higher_result),'created','higher UUID legitimately wins the inverse equal-time control');
select is(
  (select verification_challenge_id from identity.user_session where user_account_id='def50004-1000-4000-8000-000000000003' and session_status='active'),
  'def50004-2000-4000-8000-000000000011'::uuid,
  'equal-time terminal winner is the higher database challenge UUID'
);
select results_eq(
  $$select session_status from identity.user_session where user_session_id=(select user_session_id from def5_s4_equal_lower_result)$$,
  $$select 'revoked'::text$$,
  'higher equal-time UUID atomically revokes the lower equal-time session'
);
select is(
  (select count(*)::int
     from identity.authorizing_evidence_consumption consumption
     join identity.verification_challenge challenge using (verification_challenge_id)
    where challenge.user_account_id='def50004-1000-4000-8000-000000000003'),
  2,
  'both legitimate peer-account sessions retain one shared consumption each'
);

insert into identity.verification_challenge (
  verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,
  contact_method_type,purpose,delivery_channel,code_hash,expires_at,used_at
) values
  ('def50004-2000-4000-8000-000000000003','def50004-1000-4000-8000-000000000001','def50004-1200-4000-8000-000000000001','def5s4-admin@synthetic.invalid','email','login','email','svf1:3333333333333333333333333333333333333333333333333333333333333333',now()+interval '10 minutes',clock_timestamp()-interval '301 seconds'),
  ('def50004-2000-4000-8000-000000000004',null,null,'preaccount@synthetic.invalid','email','login','email','svf1:4444444444444444444444444444444444444444444444444444444444444444',now()+interval '10 minutes',clock_timestamp()),
  ('def50004-2000-4000-8000-000000000005','def50004-1000-4000-8000-000000000001','def50004-1200-4000-8000-000000000001','def5s4-admin@synthetic.invalid','email','contact_verify','email','svf1:5555555555555555555555555555555555555555555555555555555555555555',now()+interval '10 minutes',clock_timestamp()),
  ('def50004-2000-4000-8000-000000000006','def50004-1000-4000-8000-000000000002',null,'inactive@synthetic.invalid','email','login','email','svf1:6666666666666666666666666666666666666666666666666666666666666666',now()+interval '10 minutes',clock_timestamp());

set local role service_role;
select throws_ok($$select * from public.solmind_create_user_session('def50004-1000-4000-8000-000000000001','admin','def50004-2000-4000-8000-000000000003','login',300)$$,'P0001','solmind_session_stale_evidence','stale evidence fails closed for new creation');
select throws_ok($$select * from public.solmind_create_user_session('def50004-1000-4000-8000-000000000003','admin','def50004-2000-4000-8000-000000000003','login',300)$$,'P0001','solmind_session_ineligible_evidence','evidence bound to one active account cannot mint a session for another active eligible account');
select throws_ok($$select * from public.solmind_create_user_session('def50004-1000-4000-8000-000000000001','admin','def50004-2000-4000-8000-000000000004','login',300)$$,'P0001','solmind_session_ineligible_evidence','pre-account evidence fails closed');
select throws_ok($$select * from public.solmind_create_user_session('def50004-1000-4000-8000-000000000001','admin','def50004-2000-4000-8000-000000000005','contact_verify',300)$$,'P0001','solmind_session_invalid_purpose','provisioning purpose is rejected before evidence lookup');
select throws_ok($$select * from public.solmind_create_user_session('def50004-1000-4000-8000-000000000002','admin','def50004-2000-4000-8000-000000000006','login',300)$$,'P0001','solmind_session_ineligible_account','inactive account fails closed');
select throws_ok($$select * from public.solmind_create_user_session('def50004-1000-4000-8000-000000000001','guide','def50004-2000-4000-8000-000000000003','login',300)$$,'P0001','solmind_session_ineligible_role','inactive selected role fails closed');
reset role;

delete from identity.session_creation_freshness_policy;
set local role service_role;
select throws_ok($$select * from public.solmind_create_user_session('def50004-1000-4000-8000-000000000001','admin','def50004-2000-4000-8000-000000000003','login',300)$$,'P0001','solmind_session_policy_unavailable','missing policy fails closed');
reset role;
alter table identity.session_creation_freshness_policy
  drop constraint session_creation_freshness_policy_pkey;
insert into identity.session_creation_freshness_policy (minimum_seconds,active_seconds,maximum_seconds) values (60,300,600),(60,300,600);
set local role service_role;
select throws_ok($$select * from public.solmind_create_user_session('def50004-1000-4000-8000-000000000001','admin','def50004-2000-4000-8000-000000000003','login',300)$$,'P0001','solmind_session_policy_unavailable','duplicate policy fails closed');
reset role;
delete from identity.session_creation_freshness_policy;
insert into identity.session_creation_freshness_policy (minimum_seconds,active_seconds,maximum_seconds) values (60,300,600);
alter table identity.session_creation_freshness_policy
  add constraint session_creation_freshness_policy_pkey primary key (policy_name);

insert into identity.verification_challenge (
  verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,
  contact_method_type,purpose,delivery_channel,code_hash,expires_at,used_at
) values (
  'def50004-2000-4000-8000-000000000007','def50004-1000-4000-8000-000000000001',
  'def50004-1200-4000-8000-000000000001','def5s4-admin@synthetic.invalid','email','login','email',
  'svf1:7777777777777777777777777777777777777777777777777777777777777777',now()+interval '10 minutes',clock_timestamp()
);
create function pg_temp.def5_s4_reject_audit() returns trigger language plpgsql as $$begin raise exception 'def5_s4_induced_audit_failure'; end$$;
create trigger def5_s4_reject_audit before insert on audit.audit_event for each row execute function pg_temp.def5_s4_reject_audit();
set local role service_role;
select throws_ok($$select * from public.solmind_create_user_session('def50004-1000-4000-8000-000000000001','admin','def50004-2000-4000-8000-000000000007','login',300)$$,'P0001','def5_s4_induced_audit_failure','audit failure propagates');
reset role;
select is((select count(*)::int from identity.user_session where verification_challenge_id='def50004-2000-4000-8000-000000000007'),0,'audit failure rolls back new session');
select is((select count(*)::int from identity.authorizing_evidence_consumption where verification_challenge_id='def50004-2000-4000-8000-000000000007'),0,'audit failure rolls back shared consumption');
select is((select user_session_id from identity.user_session where user_account_id='def50004-1000-4000-8000-000000000001' and session_status='active'),(select user_session_id from def5_s4_second_result),'audit failure rolls back supersession');
select is((select count(*)::int from audit.audit_event where target_entity_id='def50004-2000-4000-8000-000000000007'),0,'audit failure leaves no session audit row');

insert into identity.verification_challenge (
  verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,
  contact_method_type,purpose,delivery_channel,code_hash,expires_at,used_at
) values (
  'def50004-2000-4000-8000-000000000012','def50004-1000-4000-8000-000000000001',
  'def50004-1200-4000-8000-000000000001','def5s4-admin@synthetic.invalid','email','login','email',
  'svf1:1212121212121212121212121212121212121212121212121212121212121212',
  now()+interval '10 minutes',clock_timestamp()
);
insert into identity.authorizing_evidence_consumption (
  verification_challenge_id,consumer_type,consumer_record_id,consumed_at
) values (
  'def50004-2000-4000-8000-000000000012',
  'guide_invitation_acceptance',
  'def50004-2900-4000-8000-000000000012',
  clock_timestamp()
);
set local role service_role;
select throws_ok(
  $$select * from public.solmind_create_user_session(
    'def50004-1000-4000-8000-000000000001','admin',
    'def50004-2000-4000-8000-000000000012','login',300)$$,
  'P0001','solmind_session_evidence_consumed',
  'evidence already consumed by a different authorizing family cannot mint a session'
);
reset role;
select is(
  (select count(*)::int from identity.user_session where verification_challenge_id='def50004-2000-4000-8000-000000000012'),
  0,
  'cross-consumer replay denial creates no session'
);
select results_eq(
  $$select consumer_type,consumer_record_id
      from identity.authorizing_evidence_consumption
     where verification_challenge_id='def50004-2000-4000-8000-000000000012'$$,
  $$select 'guide_invitation_acceptance'::text,'def50004-2900-4000-8000-000000000012'::uuid$$,
  'cross-consumer replay denial preserves the winning consumption exactly'
);
select is(
  (select count(*)::int from audit.audit_event where target_entity_id='def50004-2000-4000-8000-000000000012'),
  0,
  'cross-consumer replay denial writes no session audit'
);

delete from identity.authorizing_evidence_consumption
 where verification_challenge_id='def50004-2000-4000-8000-000000000002';
set local role service_role;
select throws_ok(
  $$select * from public.solmind_create_user_session(
    'def50004-1000-4000-8000-000000000001','admin',
    'def50004-2000-4000-8000-000000000002','role_reentry',3600)$$,
  'P0001','solmind_session_consumption_integrity_failure',
  'exact retry fails closed when the matching shared consumption is missing'
);
reset role;
select lives_ok(
  $$insert into identity.authorizing_evidence_consumption (
      verification_challenge_id,consumer_type,consumer_record_id,consumed_at
    )
    select verification_challenge_id,'user_session',user_session_id,created_at
      from identity.user_session
     where user_session_id=(select user_session_id from def5_s4_second_result)$$,
  'test restores the exact matching shared consumption'
);
set local role service_role;
select results_eq(
  $$select outcome,user_session_id from public.solmind_create_user_session(
    'def50004-1000-4000-8000-000000000001','admin',
    'def50004-2000-4000-8000-000000000002','role_reentry',3600)$$,
  $$select 'existing'::text,user_session_id from def5_s4_second_result$$,
  'restored exact consumption permits the original writeless recovery'
);
reset role;

select is((select count(*)::int from audit.audit_event where event_type in ('session_created','session_superseded') and (to_jsonb(audit_event)::text like '%synthetic.invalid%' or to_jsonb(audit_event)::text like '%svf1:%')),0,'session audit rows exclude contact and verifier sentinels');

select * from finish();
rollback;
