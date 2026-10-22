-- Guide/Admin R04 ownership: synthetic stored relations and real redemption.
-- Run only in a separately verified local test DB; coherent integration receipts own actual results.
-- All fixture/setup writes are outside the ownership-read snapshot intervals.
-- Every pgTAP assertion receives booleans or closed outcomes, never row contents.
-- Each challenge has a distinct synthetic normalized value to satisfy the real
-- one-structurally-open-per-contact/purpose index without weakening constraints.
-- The positive redeemable control's value also matches its active bound contact.
begin;
select plan(27);

create function pg_temp.l69_read_state() returns jsonb language sql as $$
  select jsonb_build_object(
    'challenges', (select coalesce(jsonb_agg(to_jsonb(c) order by c.verification_challenge_id),'[]'::jsonb) from identity.verification_challenge c),
    'audit', (select coalesce(jsonb_agg(to_jsonb(a) order by a.audit_event_id),'[]'::jsonb) from audit.audit_event a),
    'contacts', (select coalesce(jsonb_agg(to_jsonb(c) order by c.user_contact_method_id),'[]'::jsonb) from identity.user_contact_method c),
    'accounts', (select coalesce(jsonb_agg(to_jsonb(a) order by a.user_account_id),'[]'::jsonb) from identity.user_account a)
  );
$$;

insert into identity.user_account(user_account_id,display_name,account_status) values
  ('10690000-1000-4000-8000-000000000001','Ownership synthetic account one','active'),
  ('10690000-1000-4000-8000-000000000002','Ownership synthetic account two','active');
insert into identity.user_contact_method(user_contact_method_id,user_account_id,contact_method_type,contact_label,contact_value,normalized_contact_value,is_verified,login_enabled,status) values
  ('10690000-1100-4000-8000-000000000001','10690000-1000-4000-8000-000000000001','email','primary','l69-owner-1@synthetic.invalid','l69-owner-1@synthetic.invalid',true,true,'active'),
  ('10690000-1100-4000-8000-000000000002','10690000-1000-4000-8000-000000000002','email','primary','l69-owner-11@synthetic.invalid','l69-owner-11@synthetic.invalid',true,true,'active');

-- Direct fixtures intentionally include states that the sanctioned issuer would
-- refuse, particularly U1's cross-account contact. Independent FKs permit it.
insert into identity.verification_challenge(verification_challenge_id,user_account_id,user_contact_method_id,
  normalized_contact_value,contact_method_type,purpose,delivery_channel,code_hash,expires_at,used_at,invalidated_at,failed_attempt_count)
select ('10690000-2000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
  case when i in (7,10) then null::uuid when i=11 then '10690000-1000-4000-8000-000000000002'::uuid else '10690000-1000-4000-8000-000000000001'::uuid end,
  case when i in (8,10) then null::uuid when i in (9,11) then '10690000-1100-4000-8000-000000000002'::uuid else '10690000-1100-4000-8000-000000000001'::uuid end,
  'l69-owner-'||i::text||'@synthetic.invalid','email',case when i=6 then 'contact_verify' else 'login' end,'email',
  case when i=12 then null else 'svf1:'||repeat('69',32) end,
  case when i=3 then now()-interval '1 minute' else now()+interval '10 minutes' end,
  case when i=2 then now() else null end,case when i=4 then now() else null end,case when i=5 then 5 else 0 end
from generate_series(1,12) s(i);

create temp table l69_before_read as select pg_temp.l69_read_state() as snapshot;
set local role service_role;
select results_eq($$select owned from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001','10690000-2000-4000-8000-000000000001','login')$$,$$select true$$,'valid exact ownership returns one true row');
select results_eq($$select owned from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000002','10690000-2000-4000-8000-000000000001','login')$$,$$select false$$,'same selector with other account is not owned');
select results_eq($$select owned from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000099','10690000-2000-4000-8000-000000000001','login')$$,$$select false$$,'missing account cannot own an existing selector');
select results_eq($$select owned from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001','10690000-2000-4000-8000-000000000099','login')$$,$$select false$$,'missing selector is not replaced by an owned open challenge');
select results_eq($$select owned from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001','10690000-2000-4000-8000-000000000006','login')$$,$$select false$$,'stored non-login purpose is not owned as login');
select results_eq($$select owned from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001','10690000-2000-4000-8000-000000000007','login')$$,$$select false$$,'null account binding is not owned');
select results_eq($$select owned from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001','10690000-2000-4000-8000-000000000008','login')$$,$$select false$$,'null contact binding is not owned');
select results_eq($$select owned from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001','10690000-2000-4000-8000-000000000009','login')$$,$$select false$$,'U1 challenge account matches but its contact belongs to another account');
select results_eq($$select owned from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000002','10690000-2000-4000-8000-000000000009','login')$$,$$select false$$,'U1 contact account alone cannot override the challenge account');
select results_eq($$select owned from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001','10690000-2000-4000-8000-000000000010','login')$$,$$select false$$,'fully unbound challenge is not owned');
select results_eq($$select owned from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000002','10690000-2000-4000-8000-000000000011','login')$$,$$select true$$,'other account with its own exact challenge remains a positive control');
select results_eq($$select owned from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001','10690000-2000-4000-8000-000000000002','login')$$,$$select true$$,'used challenge can still be owned');
select results_eq($$select owned from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001','10690000-2000-4000-8000-000000000003','login')$$,$$select true$$,'expired challenge can still be owned');
select results_eq($$select owned from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001','10690000-2000-4000-8000-000000000004','login')$$,$$select true$$,'invalidated challenge can still be owned');
select results_eq($$select owned from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001','10690000-2000-4000-8000-000000000005','login')$$,$$select true$$,'exhausted challenge can still be owned');
select results_eq($$select owned from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001','10690000-2000-4000-8000-000000000012','login')$$,$$select true$$,'ownership does not read or require a verifier');
reset role;
select ok(pg_temp.l69_read_state() is not distinct from (select snapshot from l69_before_read),'all ownership reads leave complete challenge/account/contact rows and every audit event unchanged');

-- Eligibility belongs elsewhere: no role/provider rows were created at all.
-- Change only eligibility, then establish a new read-only baseline.
update identity.user_account set account_status='inactive' where user_account_id='10690000-1000-4000-8000-000000000001';
update identity.user_contact_method set login_enabled=false,is_verified=false,status='disabled' where user_contact_method_id='10690000-1100-4000-8000-000000000001';
create temp table l69_before_ineligible_read as select pg_temp.l69_read_state() as snapshot;
set local role service_role;
select results_eq($$select owned from public.solmind_check_login_challenge_owner('10690000-1000-4000-8000-000000000001','10690000-2000-4000-8000-000000000001','login')$$,$$select true$$,'ownership does not duplicate account or contact eligibility');
reset role;
select ok(pg_temp.l69_read_state() is not distinct from (select snapshot from l69_before_ineligible_read),'eligibility-independent ownership read also writes nothing');
update identity.user_account set account_status='active' where user_account_id='10690000-1000-4000-8000-000000000001';
update identity.user_contact_method set login_enabled=true,is_verified=true,status='active' where user_contact_method_id='10690000-1100-4000-8000-000000000001';

-- Real redemption is outside the ownership nonmutation baseline. Terminal
-- challenges cannot redeem despite the positive ownership answers above.
create temp table l69_before_denied_redemptions as select pg_temp.l69_read_state() as snapshot;
set local role service_role;
select results_eq($$select outcome from public.solmind_redeem_verification_challenge('10690000-2000-4000-8000-000000000002','login','svf1:'||repeat('69',32))$$,$$select 'denied'::text$$,'owned used challenge cannot redeem');
select results_eq($$select outcome from public.solmind_redeem_verification_challenge('10690000-2000-4000-8000-000000000003','login','svf1:'||repeat('69',32))$$,$$select 'denied'::text$$,'owned expired challenge cannot redeem');
select results_eq($$select outcome from public.solmind_redeem_verification_challenge('10690000-2000-4000-8000-000000000004','login','svf1:'||repeat('69',32))$$,$$select 'denied'::text$$,'owned invalidated challenge cannot redeem');
select results_eq($$select outcome from public.solmind_redeem_verification_challenge('10690000-2000-4000-8000-000000000005','login','svf1:'||repeat('69',32))$$,$$select 'denied'::text$$,'owned exhausted challenge cannot redeem');
select results_eq($$select outcome from public.solmind_redeem_verification_challenge('10690000-2000-4000-8000-000000000012','login','svf1:'||repeat('69',32))$$,$$select 'denied'::text$$,'owned verifier-free challenge cannot redeem');
reset role;
select ok(pg_temp.l69_read_state() is not distinct from (select snapshot from l69_before_denied_redemptions),'ineligible real redemptions also changed no row or audit event');
set local role service_role;
select results_eq($$select outcome from public.solmind_redeem_verification_challenge('10690000-2000-4000-8000-000000000001','login','svf1:'||repeat('69',32))$$,$$select 'redeemed'::text$$,'genuine valid control still redeems after ownership reads');
reset role;
select ok((select used_at is not null and invalidated_at is null and failed_attempt_count=0 from identity.verification_challenge where verification_challenge_id='10690000-2000-4000-8000-000000000001')
  and (select count(*)=1 from audit.audit_event where target_entity_id='10690000-2000-4000-8000-000000000001' and event_type='verification_challenge_redeemed'),'only later successful redemption establishes its use and paired audit');

select * from finish();
rollback;
