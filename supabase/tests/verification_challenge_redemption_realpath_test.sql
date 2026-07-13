begin;
select plan(35);

insert into identity.verification_challenge
  (verification_challenge_id, normalized_contact_value, contact_method_type, purpose, delivery_channel, code_hash, expires_at)
values
  ('00000000-0000-4000-8000-000000000001','def5s2-1@synthetic.invalid','email','login','email','svf1:ecab5e52743c2befef754a1568a90e466dac2777d43c18162914acca44e8960d',now()+interval '10 minutes'),
  ('def50002-0000-4000-8000-000000000002','def5s2-2@synthetic.invalid','email','login','email','svf1:bb15436feb0032227097e230da2da8e2b7c38942d717251e49d33ed0fb2ee1ab',now()+interval '10 minutes'),
  ('def50002-0000-4000-8000-000000000003','def5s2-3@synthetic.invalid','email','login','email','svf1:b97b516093ca5525aeca549cf60dfd39af7e4e021e576a7e07735a25957a385c',now()-interval '1 minute');
insert into identity.verification_challenge
  (verification_challenge_id, normalized_contact_value, contact_method_type, purpose, delivery_channel, code_hash, expires_at)
values ('def50002-0000-4000-8000-000000000004','def5s2-4@synthetic.invalid','email','login','email','svf1:3fec55f0880cb60ec6aebcb59aa3c15fb0bea2c807eebc8ce69b7011ae556fb2',now()+interval '10 minutes');
insert into identity.verification_challenge
  (verification_challenge_id, normalized_contact_value, contact_method_type, purpose, delivery_channel, code_hash, expires_at)
values ('def50002-0000-4000-8000-000000000005','def5s2-5@synthetic.invalid','email','login','email','svf1:cb27b087979f0cee98d0ddeccb6c1fbf4a8c610fa6c849794f9eab36fc2f44ce',now()+interval '10 minutes');
insert into identity.verification_challenge
  (verification_challenge_id, normalized_contact_value, contact_method_type, purpose, delivery_channel, code_hash, expires_at, failed_attempt_count, invalidated_at)
values
 ('def50002-0000-4000-8000-000000000006','def5s2-6@synthetic.invalid','email','login','email','svf1:5995a5c5c5318bd0e4277b125dfd4b79562271dd3bb5adf399c5f909d9bccfc6',now()+interval '10 minutes',0,null),
 ('def50002-0000-4000-8000-000000000007','def5s2-7@synthetic.invalid','email','login','email','svf1:0c0be58004c8707d3a476372b757e1d2f13119927d4e73a7e370d6e0447ed875',now()+interval '10 minutes',5,now());
insert into identity.verification_challenge
  (verification_challenge_id, normalized_contact_value, contact_method_type, purpose, delivery_channel, code_hash, expires_at, failed_attempt_count, invalidated_at, locked_until)
values
 ('def50002-0000-4000-8000-000000000008','def5s2-8@synthetic.invalid','email','login','email','svf1:3e61b9f7dbb274eb7f52952ccf0a9acb53ef40778806fdbbceee3743e7a2dc7d',now()+interval '10 minutes',0,null,now()+interval '5 minutes'),
 ('def50002-0000-4000-8000-000000000009','def5s2-9@synthetic.invalid','email','login','email',null,now()+interval '10 minutes',0,null,null),
 ('def50002-0000-4000-8000-000000000010','def5s2-10@synthetic.invalid','email','login','email','svf1:4ddf6bfd164a8ab1a13954f4894d1b03011fde6bc686256304dbfd5b35f30e93',now()+interval '10 minutes',5,null,null),
 ('def50002-0000-4000-8000-000000000013','def5s2-13@synthetic.invalid','email','login','email','svf1:739843cef1230fd6225042629e6ebb1a906f16eace3458e8fdf35c5704ea75c4',now()+interval '10 minutes',2,now(),null);

set local role service_role;
select results_eq($$select * from public.solmind_redeem_verification_challenge('00000000-0000-4000-8000-000000000001','login','svf1:ecab5e52743c2befef754a1568a90e466dac2777d43c18162914acca44e8960d')$$,$$values ('redeemed'::text)$$,'matching frozen KAT redeems');
select results_eq($$select * from public.solmind_redeem_verification_challenge('00000000-0000-4000-8000-000000000001','login','svf1:ecab5e52743c2befef754a1568a90e466dac2777d43c18162914acca44e8960d')$$,$$values ('denied'::text)$$,'replay denied');
select results_eq($$select * from public.solmind_redeem_verification_challenge('def50002-0000-4000-8000-000000000002','login','svf1:0000000000000000000000000000000000000000000000000000000000000000')$$,$$values ('denied'::text)$$,'wrong verifier denied normally');
select results_eq($$select * from public.solmind_redeem_verification_challenge('def50002-0000-4000-8000-000000000003','login','svf1:b97b516093ca5525aeca549cf60dfd39af7e4e021e576a7e07735a25957a385c')$$,$$values ('denied'::text)$$,'authentic matching verifier is denied after expiry');
select results_eq($$select * from public.solmind_redeem_verification_challenge('def50002-0000-4000-8000-000000009999','login','svf1:ecab5e52743c2befef754a1568a90e466dac2777d43c18162914acca44e8960d')$$,$$values ('denied'::text)$$,'unknown selector denied');
select results_eq($$select * from public.solmind_redeem_verification_challenge('def50002-0000-4000-8000-000000000002','password_reset','svf1:ecab5e52743c2befef754a1568a90e466dac2777d43c18162914acca44e8960d')$$,$$values ('denied'::text)$$,'purpose mismatch denied');
select results_eq($$select * from public.solmind_redeem_verification_challenge('def50002-0000-4000-8000-000000000006','login','svf1:ecab5e52743c2befef754a1568a90e466dac2777d43c18162914acca44e8960d')$$,$$values ('denied'::text)$$,'cross-challenge verifier denied');
select results_eq($$select * from public.solmind_redeem_verification_challenge('def50002-0000-4000-8000-000000000007','login','svf1:3333333333333333333333333333333333333333333333333333333333333333')$$,$$values ('denied'::text)$$,'over-ceiling invalidated row denied');
select results_eq($$select * from public.solmind_redeem_verification_challenge('def50002-0000-4000-8000-000000000008','login','svf1:3e61b9f7dbb274eb7f52952ccf0a9acb53ef40778806fdbbceee3743e7a2dc7d')$$,$$values ('redeemed'::text)$$,'locked_until is deliberately not a redemption predicate');
select results_eq($$select * from public.solmind_redeem_verification_challenge('def50002-0000-4000-8000-000000000009','login','svf1:7d3351a71593df185d079465467c6fb4b4fa9a8c1b3a5b32a64812c5261c7057')$$,$$values ('denied'::text)$$,'null stored verifier denied');
select results_eq($$select * from public.solmind_redeem_verification_challenge('def50002-0000-4000-8000-000000000010','login','svf1:4ddf6bfd164a8ab1a13954f4894d1b03011fde6bc686256304dbfd5b35f30e93')$$,$$values ('denied'::text)$$,'attempt ceiling independently denies without invalidated_at');
select results_eq($$select * from public.solmind_redeem_verification_challenge('def50002-0000-4000-8000-000000000013','login','svf1:739843cef1230fd6225042629e6ebb1a906f16eace3458e8fdf35c5704ea75c4')$$,$$values ('denied'::text)$$,'invalidated_at independently denies below ceiling');
reset role;

select ok((select used_at is not null from identity.verification_challenge where verification_challenge_id='00000000-0000-4000-8000-000000000001'), 'success stamps used_at');
select is((select failed_attempt_count from identity.verification_challenge where verification_challenge_id='def50002-0000-4000-8000-000000000002'),1,'wrong verifier increments once');
select is((select count(*)::int from audit.audit_event where target_entity_id='00000000-0000-4000-8000-000000000001'),1,'success writes one audit row');
select results_eq($$select event_type,action,reason_code,event_summary,target_entity_type,target_entity_id,actor_user_account_id,actor_role_context,metadata,ip_address,user_agent from audit.audit_event where target_entity_id='00000000-0000-4000-8000-000000000001'$$,$$values('verification_challenge_redeemed'::text,'redeem'::text,'challenge_redeemed'::text,'Verification challenge redeemed.'::text,'verification_challenge'::text,'00000000-0000-4000-8000-000000000001'::uuid,null::uuid,'system'::text,'{"purpose":"login"}'::jsonb,null::text,null::text)$$,'success audit row exact');
select is((select count(*)::int from audit.audit_event where target_entity_id='def50002-0000-4000-8000-000000000002'),1,'wrong verifier writes one audit row');
select results_eq($$select event_type,action,reason_code,event_summary,target_entity_type,target_entity_id,actor_user_account_id,actor_role_context,metadata,ip_address,user_agent from audit.audit_event where target_entity_id='def50002-0000-4000-8000-000000000002'$$,$$values('verification_challenge_failed'::text,'deny'::text,'code_mismatch'::text,'Verification challenge attempt denied.'::text,'verification_challenge'::text,'def50002-0000-4000-8000-000000000002'::uuid,null::uuid,'system'::text,'{"purpose":"login","attempt_number":1}'::jsonb,null::text,null::text)$$,'wrong-verifier audit row exact');
select is((select count(*)::int from audit.audit_event where target_entity_id='def50002-0000-4000-8000-000000000003'),0,'expired request writes no audit row');
select is((select count(*)::int from audit.audit_event where target_entity_id='def50002-0000-4000-8000-000000009999'),0,'unknown selector writes no audit row');
select is((select failed_attempt_count from identity.verification_challenge where verification_challenge_id='def50002-0000-4000-8000-000000000002'),1,'purpose mismatch does not change prior count');
select is((select failed_attempt_count from identity.verification_challenge where verification_challenge_id='def50002-0000-4000-8000-000000000006'),1,'cross-challenge verifier is one eligible wrong attempt');
select is((select count(*)::int from audit.audit_event where target_entity_id='def50002-0000-4000-8000-000000000007'),0,'over-ceiling request writes no audit row');
select is((select failed_attempt_count from identity.verification_challenge where verification_challenge_id='def50002-0000-4000-8000-000000000009'),0,'null verifier row is unchanged');
select is((select count(*)::int from audit.audit_event where target_entity_id='def50002-0000-4000-8000-000000000009'),0,'null verifier row writes no audit');
select is((select count(*)::int from audit.audit_event where target_entity_id in ('def50002-0000-4000-8000-000000000010','def50002-0000-4000-8000-000000000013')),0,'ceiling and invalidated rows write no audit');
select is((select count(*)::int from audit.audit_event where target_entity_id in ('00000000-0000-4000-8000-000000000001','def50002-0000-4000-8000-000000000002') and (to_jsonb(audit_event)::text like '%synthetic.invalid%' or to_jsonb(audit_event)::text like '%svf1:%' or to_jsonb(audit_event)::text like '%ecab5e52743c%')),0,'both audit paths exclude contact and verifier sentinels');
select is((select failed_attempt_count from identity.verification_challenge where verification_challenge_id='00000000-0000-4000-8000-000000000001'),0,'replay does not increment winner');

create function pg_temp.def5_s2_reject_audit() returns trigger language plpgsql as $$begin raise exception 'def5_s2_induced_audit_failure'; end$$;
create trigger def5_s2_reject_audit before insert on audit.audit_event for each row execute function pg_temp.def5_s2_reject_audit();
select throws_ok($$select * from public.solmind_redeem_verification_challenge('def50002-0000-4000-8000-000000000004','login','svf1:0000000000000000000000000000000000000000000000000000000000000000')$$,'P0001','def5_s2_induced_audit_failure','audit failure propagates');
select is((select failed_attempt_count from identity.verification_challenge where verification_challenge_id='def50002-0000-4000-8000-000000000004'),0,'audit failure rolls back wrong-attempt increment');
select ok((select used_at is null and invalidated_at is null from identity.verification_challenge where verification_challenge_id='def50002-0000-4000-8000-000000000004'),'audit failure leaves challenge state unchanged');
select throws_ok($$select * from public.solmind_redeem_verification_challenge('def50002-0000-4000-8000-000000000005','login','svf1:cb27b087979f0cee98d0ddeccb6c1fbf4a8c610fa6c849794f9eab36fc2f44ce')$$,'P0001','def5_s2_induced_audit_failure','success-path audit failure propagates');
select ok((select used_at is null from identity.verification_challenge where verification_challenge_id='def50002-0000-4000-8000-000000000005'),'success-path audit failure rolls back used_at');
select is((select failed_attempt_count from identity.verification_challenge where verification_challenge_id='def50002-0000-4000-8000-000000000005'),0,'success-path audit failure does not increment failed attempts');
select is((select count(*)::int from audit.audit_event where target_entity_id='def50002-0000-4000-8000-000000000005'),0,'success-path audit failure leaves no audit row');

select * from finish();
rollback;
