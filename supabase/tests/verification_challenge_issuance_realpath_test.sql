begin;
select plan(34);

insert into identity.user_account(user_account_id,display_name,account_status) values
 ('def50003-0000-4000-8000-000000000001','DEF5-S3 Account One','active'),
 ('def50003-0000-4000-8000-000000000002','DEF5-S3 Account Two','active');
insert into identity.user_contact_method(user_contact_method_id,user_account_id,contact_method_type,contact_label,contact_value,normalized_contact_value,login_enabled,is_verified,verified_at,status) values
 ('def50003-1000-4000-8000-000000000001','def50003-0000-4000-8000-000000000001','email','primary','bound1@synthetic.invalid','bound1@synthetic.invalid',true,true,now(),'active'),
 ('def50003-1000-4000-8000-000000000002','def50003-0000-4000-8000-000000000001','email','alternate','pending1@synthetic.invalid','pending1@synthetic.invalid',false,false,null,'pending'),
 ('def50003-1000-4000-8000-000000000003','def50003-0000-4000-8000-000000000002','email','primary','bound2@synthetic.invalid','bound2@synthetic.invalid',true,true,now(),'active'),
 ('def50003-1000-4000-8000-000000000004','def50003-0000-4000-8000-000000000001','email','alternate','disabled@synthetic.invalid','disabled@synthetic.invalid',false,false,null,'disabled');
insert into identity.user_contact_method(user_contact_method_id,user_account_id,contact_method_type,contact_label,contact_value,normalized_contact_value,phone_type,sms_capable,login_enabled,is_verified,verified_at,status) values
 ('def50003-1000-4000-8000-000000000005','def50003-0000-4000-8000-000000000001','phone','primary','+15555550101','+15555550101','wireless',true,true,true,now(),'active');
insert into identity.verification_challenge(verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,contact_method_type,purpose,delivery_channel,code_hash,expires_at)
values('def50003-2000-4000-8000-000000000001','def50003-0000-4000-8000-000000000001','def50003-1000-4000-8000-000000000001','bound1@synthetic.invalid','email','login','email','svf1:1111111111111111111111111111111111111111111111111111111111111111',now()+interval '5 minutes');

create temp table def5_s3_untouched_before as
select n.nspname||'.'||c.relname relation_name,
       (xpath('/row/count/text()',query_to_xml(format('select count(*) from %I.%I',n.nspname,c.relname),false,true,'')))[1]::text::bigint row_count,
       (xpath('/row/fingerprint/text()',query_to_xml(format('select md5(coalesce(string_agg(to_jsonb(t)::text, '','' order by to_jsonb(t)::text), '''')) fingerprint from %I.%I t',n.nspname,c.relname),false,true,'')))[1]::text row_fingerprint
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind='r' and n.nspname in ('identity','core','audit','content','ai','methodology','notification','scheduling')
  and not (n.nspname='identity' and c.relname='verification_challenge')
  and not (n.nspname='audit' and c.relname='audit_event');

set local role service_role;
select is((select outcome from public.solmind_issue_verification_challenge('def50003-2000-4000-8000-000000000002','bound1@synthetic.invalid','email','login','email','svf1:2222222222222222222222222222222222222222222222222222222222222222','def50003-0000-4000-8000-000000000001','def50003-1000-4000-8000-000000000001')),'issued','bound login issuance succeeds');
reset role;

select ok((select row(user_account_id,user_contact_method_id,normalized_contact_value,contact_method_type,purpose,delivery_channel,code_hash,failed_attempt_count,resend_count,locked_until,used_at,invalidated_at) is not distinct from row('def50003-0000-4000-8000-000000000001'::uuid,'def50003-1000-4000-8000-000000000001'::uuid,'bound1@synthetic.invalid'::text,'email'::text,'login'::text,'email'::text,'svf1:2222222222222222222222222222222222222222222222222222222222222222'::text,0,0,null::timestamptz,null::timestamptz,null::timestamptz) from identity.verification_challenge where verification_challenge_id='def50003-2000-4000-8000-000000000002'),'inserted challenge fields and neutral counters are exact');
select ok((select expires_at between created_at+interval '9 minutes 59 seconds' and created_at+interval '10 minutes 1 second' from identity.verification_challenge where verification_challenge_id='def50003-2000-4000-8000-000000000002'),'database clock sets ten-minute expiry');
select ok((select invalidated_at is not null from identity.verification_challenge where verification_challenge_id='def50003-2000-4000-8000-000000000001'),'prior open challenge superseded');
select is((select count(*)::int from identity.verification_challenge where normalized_contact_value='bound1@synthetic.invalid' and purpose='login' and used_at is null and invalidated_at is null),1,'exactly one structurally open login row');
select is((select count(*)::int from audit.audit_event where target_entity_id='def50003-2000-4000-8000-000000000002'),1,'one issuance audit row');
select ok((select row(event_type,action,reason_code,event_summary,target_entity_type,target_entity_id,actor_user_account_id,actor_role_context,metadata,ip_address,user_agent) is not distinct from row('verification_challenge_issued'::text,'issue'::text,'challenge_issued'::text,'Verification challenge issued.'::text,'verification_challenge'::text,'def50003-2000-4000-8000-000000000002'::uuid,null::uuid,'system'::text,'{"purpose":"login"}'::jsonb,null::text,null::text) from audit.audit_event where target_entity_id='def50003-2000-4000-8000-000000000002'),'audit row is exact and bounded');

set local role service_role;
select is((select outcome from public.solmind_issue_verification_challenge('def50003-2000-4000-8000-000000000003','bound1@synthetic.invalid','email','login','email','svf1:3333333333333333333333333333333333333333333333333333333333333333','def50003-0000-4000-8000-000000000001','def50003-1000-4000-8000-000000000001')),'issued','sequential resend succeeds');
select is((select outcome from public.solmind_issue_verification_challenge('def50003-2000-4000-8000-000000000004','bound1@synthetic.invalid','email','password_reset','email','svf1:4444444444444444444444444444444444444444444444444444444444444444','def50003-0000-4000-8000-000000000001','def50003-1000-4000-8000-000000000001')),'issued','bound password reset succeeds');
select is((select outcome from public.solmind_issue_verification_challenge('def50003-2000-4000-8000-000000000005','pending1@synthetic.invalid','email','contact_verify','email','svf1:5555555555555555555555555555555555555555555555555555555555555555','def50003-0000-4000-8000-000000000001','def50003-1000-4000-8000-000000000002')),'issued','pending matching contact may be verified');
select throws_ok($$select * from public.solmind_issue_verification_challenge('def50003-2000-4000-8000-000000000006','pending1@synthetic.invalid','email','login','email','svf1:6666666666666666666666666666666666666666666666666666666666666666','def50003-0000-4000-8000-000000000001','def50003-1000-4000-8000-000000000002')$$,'P0001','solmind_issue_ineligible_contact','pending contact cannot log in');
select throws_ok($$select * from public.solmind_issue_verification_challenge('def50003-2000-4000-8000-000000000007','bound2@synthetic.invalid','email','login','email','svf1:7777777777777777777777777777777777777777777777777777777777777777','def50003-0000-4000-8000-000000000001','def50003-1000-4000-8000-000000000003')$$,'P0001','solmind_issue_invalid_binding','cross-account binding denied');
select throws_ok($$select * from public.solmind_issue_verification_challenge('def50003-2000-4000-8000-000000000008','disabled@synthetic.invalid','email','contact_verify','email','svf1:8888888888888888888888888888888888888888888888888888888888888888','def50003-0000-4000-8000-000000000001','def50003-1000-4000-8000-000000000004')$$,'P0001','solmind_issue_ineligible_contact','disabled contact cannot be verified');
select throws_ok($$select * from public.solmind_issue_verification_challenge('def50003-2000-4000-8000-000000000015','wrong@synthetic.invalid','email','login','email','svf1:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee','def50003-0000-4000-8000-000000000001','def50003-1000-4000-8000-000000000001')$$,'P0001','solmind_issue_invalid_binding','bound contact value mismatch denied');
select throws_ok($$select * from public.solmind_issue_verification_challenge('def50003-2000-4000-8000-000000000016','+15555550102','phone','login','sms','svf1:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff','def50003-0000-4000-8000-000000000001','def50003-1000-4000-8000-000000000001')$$,'P0001','solmind_issue_invalid_binding','bound contact type mismatch denied');
select is((select outcome from public.solmind_issue_verification_challenge('def50003-2000-4000-8000-000000000009','unbound-login@synthetic.invalid','email','login','email','svf1:9999999999999999999999999999999999999999999999999999999999999999',null,null)),'issued','unbound invite-driven login primitive succeeds');
select is((select outcome from public.solmind_issue_verification_challenge('def50003-2000-4000-8000-000000000010','unbound-verify@synthetic.invalid','email','contact_verify','email','svf1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',null,null)),'issued','unbound invite-driven contact verification primitive succeeds');
select is((select outcome from public.solmind_issue_verification_challenge('def50003-2000-4000-8000-000000000011','first-admin@synthetic.invalid','email','first_admin_setup','email','svf1:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',null,null)),'issued','unbound first-admin setup primitive succeeds');
select is((select outcome from public.solmind_issue_verification_challenge('def50003-2000-4000-8000-000000000014','+15555550101','phone','login','sms','svf1:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd','def50003-0000-4000-8000-000000000001','def50003-1000-4000-8000-000000000005')),'issued','bound SMS login issuance succeeds');
select throws_ok($$select * from public.solmind_issue_verification_challenge('def50003-2000-4000-8000-000000000012','role@synthetic.invalid','email','role_reentry','email','svf1:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',null,null)$$,'P0001','solmind_issue_invalid_binding','unbound role reentry denied');
reset role;

select ok((select invalidated_at is not null from identity.verification_challenge where verification_challenge_id='def50003-2000-4000-8000-000000000002'),'later resend supersedes prior successful issuance');
select is((select count(*)::int from identity.verification_challenge where normalized_contact_value='bound1@synthetic.invalid' and purpose='login' and used_at is null and invalidated_at is null),1,'one login row remains structurally open after resend');
select is((select count(*)::int from identity.verification_challenge where normalized_contact_value='bound1@synthetic.invalid' and purpose='password_reset' and used_at is null and invalidated_at is null),1,'different purpose remains independently open');
select ok((select invalidated_at is null from identity.verification_challenge where verification_challenge_id='def50003-2000-4000-8000-000000000003'),'password reset never cross-invalidates login');
select is((select count(*)::int from audit.audit_event where target_entity_id in ('def50003-2000-4000-8000-000000000002','def50003-2000-4000-8000-000000000003')),2,'each successful issuance writes one audit row');
select is((select count(*)::int from identity.verification_challenge where verification_challenge_id in ('def50003-2000-4000-8000-000000000006','def50003-2000-4000-8000-000000000007','def50003-2000-4000-8000-000000000008','def50003-2000-4000-8000-000000000012')),0,'rejected calls insert no challenge rows');
select is((select count(*)::int from audit.audit_event where target_entity_id between 'def50003-2000-4000-8000-000000000006'::uuid and 'def50003-2000-4000-8000-000000000008'::uuid),0,'rejected calls write no audit rows');
select ok((select failed_attempt_count=0 and resend_count=0 and locked_until is null from identity.verification_challenge where verification_challenge_id='def50003-2000-4000-8000-000000000009'),'unbound issuance also has neutral counters');
select ok((select contact_method_type='phone' and delivery_channel='sms' and user_contact_method_id='def50003-1000-4000-8000-000000000005' and failed_attempt_count=0 and resend_count=0 and locked_until is null from identity.verification_challenge where verification_challenge_id='def50003-2000-4000-8000-000000000014'),'bound SMS issuance stores exact channel binding and neutral counters');
select is((select count(*)::int from audit.audit_event where target_entity_id between 'def50003-2000-4000-8000-000000000002'::uuid and 'def50003-2000-4000-8000-000000000016'::uuid and (to_jsonb(audit_event)::text like '%synthetic.invalid%' or to_jsonb(audit_event)::text like '%svf1:%')),0,'audit rows contain neither contacts nor verifiers');

create function pg_temp.def5_s3_reject_audit() returns trigger language plpgsql as $$begin raise exception 'def5_s3_induced_audit_failure'; end$$;
create trigger def5_s3_reject_audit before insert on audit.audit_event for each row execute function pg_temp.def5_s3_reject_audit();
set local role service_role;
select throws_ok($$select * from public.solmind_issue_verification_challenge('def50003-2000-4000-8000-000000000013','rollback@synthetic.invalid','email','login','email','svf1:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',null,null)$$,'P0001','def5_s3_induced_audit_failure','audit failure propagates');
reset role;
select is((select count(*)::int from identity.verification_challenge where verification_challenge_id='def50003-2000-4000-8000-000000000013'),0,'audit failure rolls back insertion');
select is((select count(*)::int from audit.audit_event where target_entity_id='def50003-2000-4000-8000-000000000013'),0,'audit failure leaves no audit row');

create temp table def5_s3_untouched_after as
select n.nspname||'.'||c.relname relation_name,
       (xpath('/row/count/text()',query_to_xml(format('select count(*) from %I.%I',n.nspname,c.relname),false,true,'')))[1]::text::bigint row_count,
       (xpath('/row/fingerprint/text()',query_to_xml(format('select md5(coalesce(string_agg(to_jsonb(t)::text, '','' order by to_jsonb(t)::text), '''')) fingerprint from %I.%I t',n.nspname,c.relname),false,true,'')))[1]::text row_fingerprint
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind='r' and n.nspname in ('identity','core','audit','content','ai','methodology','notification','scheduling')
  and not (n.nspname='identity' and c.relname='verification_challenge')
  and not (n.nspname='audit' and c.relname='audit_event');
select results_eq($$select * from def5_s3_untouched_after order by 1$$,$$select * from def5_s3_untouched_before order by 1$$,'all non-owning application table contents remain identical');

select * from finish();
rollback;
