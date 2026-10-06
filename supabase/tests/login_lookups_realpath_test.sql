-- Login step 6 sub-slice S6-5 real-path proofs for the dormant sign-in lookups
-- public.solmind_resolve_login_account and public.solmind_confirm_redeemed_login_challenge, on
-- synthetic accounts, with the real redemption and session functions. Calls run as service_role, except section 5's
-- endpoint and policy cases (through a helper the test owner runs, as it writes the fixture); fixtures: test owner.
-- Every comparison that involves an email, an account or contact UUID, or a provider id happens inside
-- SQL: pgTAP receives only a boolean and a fixed description, so a failure prints none of those values.
-- An exact-row check requires exactly one row and null-safe equality of every expected field.
-- Local ephemeral database only. Synthetic rows use the reserved id prefix 10650000- and contacts
-- under l65-*@synthetic.invalid. Everything rolls back.
begin;
select plan(78);

-- Whole-state fingerprint of every application table, to prove that the lookups write nothing.
create function pg_temp.l65_app_state() returns text language plpgsql as $$
declare
  v_table record;
  v_part text;
  v_all text := '';
begin
  for v_table in
    select n.nspname, c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r','p')
       and n.nspname in ('identity','core','audit','content','ai','methodology','notification','scheduling')
     order by n.nspname, c.relname
  loop
    execute format(
      'select md5(coalesce(string_agg(to_jsonb(t)::text, '','' order by to_jsonb(t)::text), '''')) from %I.%I t',
      v_table.nspname, v_table.relname
    ) into v_part;
    v_all := v_all || v_table.nspname || '.' || v_table.relname || '=' || v_part || ';';
  end loop;
  return md5(v_all);
end;
$$;

-- For the freshness endpoints: in one statement, set the fixture's use time relative to that statement's
-- own clock, then ask the confirmation, which reads the same statement clock, so each endpoint is exact.
-- Run by the test owner, because it changes the fixture row.
create function pg_temp.l65_confirm_with_use_time(p_challenge uuid, p_offset interval)
returns boolean language plpgsql as $$
declare
  v_confirmed boolean;
begin
  update identity.verification_challenge
     set used_at = pg_catalog.statement_timestamp() + p_offset
   where verification_challenge_id = p_challenge;
  if not found then
    raise exception 'l65 fixture missing';
  end if;
  select case
           when count(*) = 1 then bool_and(c.confirmed)
           else null::boolean
         end
    into v_confirmed
    from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001', p_challenge, 'login') c;
  return v_confirmed;
end;
$$;

insert into identity.user_account (user_account_id,display_name,account_status,username)
values
  ('10650000-1000-4000-8000-000000000001','L65 synthetic explorer one','active',null),
  ('10650000-1000-4000-8000-000000000002','L65 synthetic guide one','active',null),
  ('10650000-1000-4000-8000-000000000003','L65 synthetic admin and guide','active','L65-Admin-One'),
  ('10650000-1000-4000-8000-000000000004','L65 synthetic explorer whose state is changed','active',null),
  ('10650000-1000-4000-8000-000000000005','L65 synthetic explorer with no provider identity','active',null),
  ('10650000-1000-4000-8000-000000000006','L65 synthetic admin with two sign-in emails','active','l65-admin-two'),
  ('10650000-1000-4000-8000-000000000007','L65 synthetic guide with a username','active','l65-guide-user'),
  ('10650000-1000-4000-8000-000000000008','L65 synthetic deleted admin sharing a username','deleted','l65-admin-one'),
  ('10650000-1000-4000-8000-000000000009','L65 synthetic explorer two','active',null);
insert into identity.user_role_assignment (user_role_assignment_id,user_account_id,role_code,role_status)
values
  ('10650000-1100-4000-8000-000000000001','10650000-1000-4000-8000-000000000001','explorer','active'),
  ('10650000-1100-4000-8000-000000000002','10650000-1000-4000-8000-000000000002','guide','active'),
  ('10650000-1100-4000-8000-000000000003','10650000-1000-4000-8000-000000000003','admin','active'),
  ('10650000-1100-4000-8000-0000000000a3','10650000-1000-4000-8000-000000000003','guide','active'),
  ('10650000-1100-4000-8000-000000000004','10650000-1000-4000-8000-000000000004','explorer','active'),
  ('10650000-1100-4000-8000-000000000005','10650000-1000-4000-8000-000000000005','explorer','active'),
  ('10650000-1100-4000-8000-000000000006','10650000-1000-4000-8000-000000000006','admin','active'),
  ('10650000-1100-4000-8000-000000000007','10650000-1000-4000-8000-000000000007','guide','active'),
  ('10650000-1100-4000-8000-000000000008','10650000-1000-4000-8000-000000000008','admin','active'),
  ('10650000-1100-4000-8000-000000000009','10650000-1000-4000-8000-000000000009','explorer','active');
insert into identity.user_contact_method (
  user_contact_method_id,user_account_id,contact_method_type,contact_label,contact_value,
  normalized_contact_value,login_enabled,is_verified,status
) values
  ('10650000-1200-4000-8000-000000000001','10650000-1000-4000-8000-000000000001','email','primary','l65-e1@synthetic.invalid','l65-e1@synthetic.invalid',true,true,'active'),
  ('10650000-1200-4000-8000-000000000002','10650000-1000-4000-8000-000000000002','email','primary','l65-g1@synthetic.invalid','l65-g1@synthetic.invalid',true,true,'active'),
  ('10650000-1200-4000-8000-000000000003','10650000-1000-4000-8000-000000000003','email','primary','l65-a1@synthetic.invalid','l65-a1@synthetic.invalid',true,true,'active'),
  ('10650000-1200-4000-8000-000000000004','10650000-1000-4000-8000-000000000004','email','primary','l65-flip@synthetic.invalid','l65-flip@synthetic.invalid',true,true,'active'),
  ('10650000-1200-4000-8000-000000000005','10650000-1000-4000-8000-000000000005','email','primary','l65-e5@synthetic.invalid','l65-e5@synthetic.invalid',true,true,'active'),
  ('10650000-1200-4000-8000-000000000006','10650000-1000-4000-8000-000000000006','email','primary','l65-a6p@synthetic.invalid','l65-a6p@synthetic.invalid',true,true,'active'),
  ('10650000-1200-4000-8000-0000000000a6','10650000-1000-4000-8000-000000000006','email','alternate','l65-a6a@synthetic.invalid','l65-a6a@synthetic.invalid',true,true,'active'),
  ('10650000-1200-4000-8000-000000000007','10650000-1000-4000-8000-000000000007','email','primary','l65-g7@synthetic.invalid','l65-g7@synthetic.invalid',true,true,'active'),
  ('10650000-1200-4000-8000-000000000008','10650000-1000-4000-8000-000000000008','email','primary','l65-a8@synthetic.invalid','l65-a8@synthetic.invalid',true,true,'active'),
  ('10650000-1200-4000-8000-000000000009','10650000-1000-4000-8000-000000000009','email','primary','l65-e9@synthetic.invalid','l65-e9@synthetic.invalid',true,true,'active');
insert into identity.auth_provider_identity (
  auth_provider_identity_id,user_account_id,provider_name,provider_user_id,provider_email,status
) values
  ('10650000-1300-4000-8000-000000000001','10650000-1000-4000-8000-000000000001','supabase','l65-provider-01','l65-e1@synthetic.invalid','active'),
  ('10650000-1300-4000-8000-000000000002','10650000-1000-4000-8000-000000000002','supabase','l65-provider-02','l65-g1@synthetic.invalid','active'),
  ('10650000-1300-4000-8000-000000000003','10650000-1000-4000-8000-000000000003','supabase','l65-provider-03','l65-a1@synthetic.invalid','active'),
  ('10650000-1300-4000-8000-000000000004','10650000-1000-4000-8000-000000000004','supabase','l65-provider-04','l65-flip@synthetic.invalid','active'),
  ('10650000-1300-4000-8000-000000000006','10650000-1000-4000-8000-000000000006','supabase','l65-provider-06','l65-a6p@synthetic.invalid','active'),
  ('10650000-1300-4000-8000-000000000007','10650000-1000-4000-8000-000000000007','supabase','l65-provider-07','l65-g7@synthetic.invalid','active'),
  ('10650000-1300-4000-8000-000000000008','10650000-1000-4000-8000-000000000008','supabase','l65-provider-08','l65-a8@synthetic.invalid','active'),
  ('10650000-1300-4000-8000-000000000009','10650000-1000-4000-8000-000000000009','supabase','l65-provider-09','l65-e9@synthetic.invalid','active');

-- 1. The account lookup on eligible and ineligible accounts. Nothing it does changes any table.
create temp table l65_state_before_lookups as select pg_temp.l65_app_state() as fingerprint;

set local role service_role;
select ok(
  coalesce((select count(*) = 1
                   and bool_and(r.user_account_id is not distinct from '10650000-1000-4000-8000-000000000001'::uuid
                            and r.user_contact_method_id is not distinct from '10650000-1200-4000-8000-000000000001'::uuid
                            and r.normalized_contact_value is not distinct from 'l65-e1@synthetic.invalid'
                            and r.provider_user_id is not distinct from 'l65-provider-01')
              from public.solmind_resolve_login_account('l65-e1@synthetic.invalid','email','explorer') r), false),
  'an eligible Explorer email gives exactly one row: its account, sign-in contact, canonical email, and bound provider user id'
);
select ok(
  coalesce((select count(*) = 1
                   and bool_and(r.user_account_id is not distinct from '10650000-1000-4000-8000-000000000002'::uuid
                            and r.user_contact_method_id is not distinct from '10650000-1200-4000-8000-000000000002'::uuid
                            and r.normalized_contact_value is not distinct from 'l65-g1@synthetic.invalid'
                            and r.provider_user_id is not distinct from 'l65-provider-02')
              from public.solmind_resolve_login_account('l65-g1@synthetic.invalid','email','guide') r), false),
  'an eligible Guide email gives exactly its one row'
);
select ok(
  coalesce((select count(*) = 1
                   and bool_and(r.user_account_id is not distinct from '10650000-1000-4000-8000-000000000003'::uuid
                            and r.user_contact_method_id is not distinct from '10650000-1200-4000-8000-000000000003'::uuid
                            and r.normalized_contact_value is not distinct from 'l65-a1@synthetic.invalid'
                            and r.provider_user_id is not distinct from 'l65-provider-03')
              from public.solmind_resolve_login_account('l65-a1@synthetic.invalid','email','admin') r), false),
  'an eligible Admin email gives exactly its one row'
);
select ok(
  coalesce((select count(*) = 1
                   and bool_and(r.user_account_id is not distinct from '10650000-1000-4000-8000-000000000003'::uuid
                            and r.user_contact_method_id is not distinct from '10650000-1200-4000-8000-000000000003'::uuid
                            and r.normalized_contact_value is not distinct from 'l65-a1@synthetic.invalid'
                            and r.provider_user_id is not distinct from 'l65-provider-03')
              from public.solmind_resolve_login_account('l65-a1@synthetic.invalid','email','guide') r), false),
  'the same email for another active role of the same account gives the same row (one person, several roles)'
);
select ok(
  coalesce((select count(*) = 1
                   and bool_and(r.user_account_id is not distinct from '10650000-1000-4000-8000-000000000003'::uuid
                            and r.user_contact_method_id is not distinct from '10650000-1200-4000-8000-000000000003'::uuid
                            and r.normalized_contact_value is not distinct from 'l65-a1@synthetic.invalid'
                            and r.provider_user_id is not distinct from 'l65-provider-03')
              from public.solmind_resolve_login_account('l65-admin-one','username','admin') r), false),
  'the Admin username, stored in mixed case, gives the Admin''s one row with its sign-in email; the deleted account sharing the username is never matched'
);
select ok(
  coalesce((select count(*) = 1
                   and bool_and(r.user_account_id is not distinct from '10650000-1000-4000-8000-000000000006'::uuid
                            and r.user_contact_method_id is not distinct from '10650000-1200-4000-8000-000000000006'::uuid
                            and r.normalized_contact_value is not distinct from 'l65-a6p@synthetic.invalid'
                            and r.provider_user_id is not distinct from 'l65-provider-06')
              from public.solmind_resolve_login_account('l65-a6p@synthetic.invalid','email','admin') r), false),
  'with two sign-in emails, the primary email gives the row for that email''s contact'
);
select ok(
  coalesce((select count(*) = 1
                   and bool_and(r.user_account_id is not distinct from '10650000-1000-4000-8000-000000000006'::uuid
                            and r.user_contact_method_id is not distinct from '10650000-1200-4000-8000-0000000000a6'::uuid
                            and r.normalized_contact_value is not distinct from 'l65-a6a@synthetic.invalid'
                            and r.provider_user_id is not distinct from 'l65-provider-06')
              from public.solmind_resolve_login_account('l65-a6a@synthetic.invalid','email','admin') r), false),
  'with two sign-in emails, the alternate email gives the row for that email''s contact'
);
select is((select count(*)::int from public.solmind_resolve_login_account('l65-a1@synthetic.invalid','email','explorer')),0,'a role the account does not hold gives zero rows');
select is((select count(*)::int from public.solmind_resolve_login_account('l65-e1@synthetic.invalid','email','guide')),0,'an Explorer email asked for as a Guide gives zero rows');
select is((select count(*)::int from public.solmind_resolve_login_account('l65-e1@synthetic.invalid','email','admin')),0,'an Explorer email asked for as the Admin gives zero rows');
select is((select count(*)::int from public.solmind_resolve_login_account('l65-admin-two','username','admin')),0,'a username whose account has two sign-in emails is ambiguous and gives zero rows');
select is((select count(*)::int from public.solmind_resolve_login_account('l65-guide-user','username','admin')),0,'the username of an account with no active admin role gives zero rows');
select is((select count(*)::int from public.solmind_resolve_login_account('l65-a8@synthetic.invalid','email','admin')),0,'a deleted account gives zero rows');
select is((select count(*)::int from public.solmind_resolve_login_account('l65-e5@synthetic.invalid','email','explorer')),0,'an account with no bound provider identity gives zero rows');
reset role;

select is(
  pg_temp.l65_app_state(),
  (select fingerprint from l65_state_before_lookups),
  'the account lookups changed no row in any application table and wrote no audit row'
);

-- 2. One otherwise eligible Explorer, changed and restored: each ineligible state gives the same zero
--    rows, with no reason, and restoring it gives the row again. The account, role and provider states
--    are each changed alone. The schema's own check (a sign-in-enabled contact must be verified and
--    active) means the contact states are representative ineligible states, each with sign-in disabled,
--    not isolated tests of the verification and status predicates.
set local role service_role;
select is((select count(*)::int from public.solmind_resolve_login_account('l65-flip@synthetic.invalid','email','explorer')),1,'the changing Explorer starts eligible');
reset role;
update identity.user_account set account_status='suspended' where user_account_id='10650000-1000-4000-8000-000000000004';
set local role service_role;
select is((select count(*)::int from public.solmind_resolve_login_account('l65-flip@synthetic.invalid','email','explorer')),0,'a suspended account gives zero rows');
reset role;
update identity.user_account set account_status='locked' where user_account_id='10650000-1000-4000-8000-000000000004';
set local role service_role;
select is((select count(*)::int from public.solmind_resolve_login_account('l65-flip@synthetic.invalid','email','explorer')),0,'a locked account gives zero rows');
reset role;
update identity.user_account set account_status='pending' where user_account_id='10650000-1000-4000-8000-000000000004';
set local role service_role;
select is((select count(*)::int from public.solmind_resolve_login_account('l65-flip@synthetic.invalid','email','explorer')),0,'a pending account gives zero rows');
reset role;
update identity.user_account set account_status='inactive' where user_account_id='10650000-1000-4000-8000-000000000004';
set local role service_role;
select is((select count(*)::int from public.solmind_resolve_login_account('l65-flip@synthetic.invalid','email','explorer')),0,'an inactive account gives zero rows');
reset role;
update identity.user_account set account_status='deleted' where user_account_id='10650000-1000-4000-8000-000000000004';
set local role service_role;
select is((select count(*)::int from public.solmind_resolve_login_account('l65-flip@synthetic.invalid','email','explorer')),0,'a deleted account gives zero rows');
reset role;
update identity.user_account set account_status='active' where user_account_id='10650000-1000-4000-8000-000000000004';

update identity.user_role_assignment set role_status='suspended' where user_role_assignment_id='10650000-1100-4000-8000-000000000004';
set local role service_role;
select is((select count(*)::int from public.solmind_resolve_login_account('l65-flip@synthetic.invalid','email','explorer')),0,'a suspended role gives zero rows');
reset role;
update identity.user_role_assignment set role_status='revoked',revoked_at=clock_timestamp() where user_role_assignment_id='10650000-1100-4000-8000-000000000004';
set local role service_role;
select is((select count(*)::int from public.solmind_resolve_login_account('l65-flip@synthetic.invalid','email','explorer')),0,'a revoked role gives zero rows');
reset role;
update identity.user_role_assignment set role_status='active',revoked_at=clock_timestamp() where user_role_assignment_id='10650000-1100-4000-8000-000000000004';
set local role service_role;
select is((select count(*)::int from public.solmind_resolve_login_account('l65-flip@synthetic.invalid','email','explorer')),0,'an active role with a revocation time gives zero rows, as in session creation');
reset role;
update identity.user_role_assignment set role_status='active',revoked_at=null where user_role_assignment_id='10650000-1100-4000-8000-000000000004';

select throws_ok(
  $$update identity.user_contact_method set is_verified=false where user_contact_method_id='10650000-1200-4000-8000-000000000004'$$,
  '23514',
  'new row for relation "user_contact_method" violates check constraint "user_contact_method_login_requires_verified_active_check"',
  'the schema refuses a sign-in-enabled email that is unverified, so an unverified email is never sign-in enabled'
);
select throws_ok(
  $$update identity.user_contact_method set status='disabled' where user_contact_method_id='10650000-1200-4000-8000-000000000004'$$,
  '23514',
  'new row for relation "user_contact_method" violates check constraint "user_contact_method_login_requires_verified_active_check"',
  'the schema refuses a sign-in-enabled email that is not active, so an inactive email is never sign-in enabled'
);
update identity.user_contact_method set login_enabled=false where user_contact_method_id='10650000-1200-4000-8000-000000000004';
set local role service_role;
select is((select count(*)::int from public.solmind_resolve_login_account('l65-flip@synthetic.invalid','email','explorer')),0,'a verified, active email that is not sign-in enabled gives zero rows');
reset role;
update identity.user_contact_method set is_verified=false,status='pending' where user_contact_method_id='10650000-1200-4000-8000-000000000004';
set local role service_role;
select is((select count(*)::int from public.solmind_resolve_login_account('l65-flip@synthetic.invalid','email','explorer')),0,'a representative ineligible contact state, unverified and pending (and so not sign-in enabled), gives zero rows');
reset role;
update identity.user_contact_method set is_verified=true,status='disabled' where user_contact_method_id='10650000-1200-4000-8000-000000000004';
set local role service_role;
select is((select count(*)::int from public.solmind_resolve_login_account('l65-flip@synthetic.invalid','email','explorer')),0,'a representative ineligible contact state, disabled (and so not sign-in enabled), gives zero rows');
reset role;
update identity.user_contact_method set status='replaced' where user_contact_method_id='10650000-1200-4000-8000-000000000004';
set local role service_role;
select is((select count(*)::int from public.solmind_resolve_login_account('l65-flip@synthetic.invalid','email','explorer')),0,'a representative ineligible contact state, replaced (and so not sign-in enabled), gives zero rows');
reset role;
update identity.user_contact_method
   set contact_method_type='phone',phone_type='wireless',sms_capable=true,is_verified=true,login_enabled=true,status='active'
 where user_contact_method_id='10650000-1200-4000-8000-000000000004';
set local role service_role;
select is((select count(*)::int from public.solmind_resolve_login_account('l65-flip@synthetic.invalid','email','explorer')),0,'a sign-in-enabled contact that is not an email gives zero rows, even with the same value');
reset role;
update identity.user_contact_method
   set contact_method_type='email',phone_type=null,sms_capable=null,is_verified=true,login_enabled=true,status='active'
 where user_contact_method_id='10650000-1200-4000-8000-000000000004';

update identity.auth_provider_identity set status='replaced' where auth_provider_identity_id='10650000-1300-4000-8000-000000000004';
set local role service_role;
select is((select count(*)::int from public.solmind_resolve_login_account('l65-flip@synthetic.invalid','email','explorer')),0,'a replaced provider identity gives zero rows');
reset role;
update identity.auth_provider_identity set status='disabled' where auth_provider_identity_id='10650000-1300-4000-8000-000000000004';
set local role service_role;
select is((select count(*)::int from public.solmind_resolve_login_account('l65-flip@synthetic.invalid','email','explorer')),0,'a disabled provider identity gives zero rows');
reset role;
update identity.auth_provider_identity set status='active',provider_name='l65-other' where auth_provider_identity_id='10650000-1300-4000-8000-000000000004';
set local role service_role;
select is((select count(*)::int from public.solmind_resolve_login_account('l65-flip@synthetic.invalid','email','explorer')),0,'an active identity of another provider gives zero rows');
reset role;
update identity.auth_provider_identity set status='active',provider_name='supabase' where auth_provider_identity_id='10650000-1300-4000-8000-000000000004';

set local role service_role;
select ok(
  coalesce((select count(*) = 1
                   and bool_and(r.user_account_id is not distinct from '10650000-1000-4000-8000-000000000004'::uuid
                            and r.user_contact_method_id is not distinct from '10650000-1200-4000-8000-000000000004'::uuid
                            and r.normalized_contact_value is not distinct from 'l65-flip@synthetic.invalid'
                            and r.provider_user_id is not distinct from 'l65-provider-04')
              from public.solmind_resolve_login_account('l65-flip@synthetic.invalid','email','explorer') r), false),
  'with every condition restored, the changing Explorer gives its row again'
);
reset role;

-- The username path returns only an email the issuance function accepts: a stored email that fails its
-- canonical check gives zero rows, and restoring the canonical value restores the row.
update identity.user_contact_method set normalized_contact_value='L65-A1@synthetic.invalid' where user_contact_method_id='10650000-1200-4000-8000-000000000003';
set local role service_role;
select is((select count(*)::int from public.solmind_resolve_login_account('l65-admin-one','username','admin')),0,'on the username path, a stored email that is not lowercase gives zero rows');
reset role;
update identity.user_contact_method set normalized_contact_value='l65..a1@synthetic.invalid' where user_contact_method_id='10650000-1200-4000-8000-000000000003';
set local role service_role;
select is((select count(*)::int from public.solmind_resolve_login_account('l65-admin-one','username','admin')),0,'on the username path, a stored email with a double dot gives zero rows');
reset role;
update identity.user_contact_method set normalized_contact_value='l65-a1@synthetic.invalid' where user_contact_method_id='10650000-1200-4000-8000-000000000003';
set local role service_role;
select ok(
  coalesce((select count(*) = 1
                   and bool_and(r.user_account_id is not distinct from '10650000-1000-4000-8000-000000000003'::uuid
                            and r.user_contact_method_id is not distinct from '10650000-1200-4000-8000-000000000003'::uuid
                            and r.normalized_contact_value is not distinct from 'l65-a1@synthetic.invalid'
                            and r.provider_user_id is not distinct from 'l65-provider-03')
              from public.solmind_resolve_login_account('l65-admin-one','username','admin') r), false),
  'with the canonical stored email restored, the username gives the Admin''s row again'
);

-- 3. The full sign-in chain on synthetic data: the lookup's output binds the challenge, the real
--    redemption redeems it, and the confirmation confirms it.
create temp table l65_e1_lookup as
select * from public.solmind_resolve_login_account('l65-e1@synthetic.invalid','email','explorer');
reset role;

insert into identity.verification_challenge (
  verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,
  contact_method_type,purpose,delivery_channel,code_hash,expires_at
)
select '10650000-2000-4000-8000-000000000001',user_account_id,user_contact_method_id,normalized_contact_value,
       'email','login','email',
       'svf1:6565656565656565656565656565656565656565656565656565656565656565',now()+interval '10 minutes'
  from l65_e1_lookup;
insert into identity.verification_challenge (
  verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,
  contact_method_type,purpose,delivery_channel,code_hash,expires_at,used_at,invalidated_at
) values
  -- The second Explorer's own open login challenge.
  ('10650000-2000-4000-8000-000000000009','10650000-1000-4000-8000-000000000009','10650000-1200-4000-8000-000000000009',
   'l65-e9@synthetic.invalid','email','login','email',
   'svf1:0909090909090909090909090909090909090909090909090909090909090909',now()+interval '10 minutes',null,null),
  -- Used but invalidated.
  ('10650000-2000-4000-8000-000000000003','10650000-1000-4000-8000-000000000001','10650000-1200-4000-8000-000000000001',
   'l65-e1@synthetic.invalid','email','login','email',
   'svf1:0303030303030303030303030303030303030303030303030303030303030303',now()+interval '10 minutes',clock_timestamp(),clock_timestamp()),
  -- Used longer ago than the active freshness window.
  ('10650000-2000-4000-8000-000000000004','10650000-1000-4000-8000-000000000001','10650000-1200-4000-8000-000000000001',
   'l65-e1@synthetic.invalid','email','login','email',
   'svf1:0404040404040404040404040404040404040404040404040404040404040404',now()+interval '10 minutes',
   clock_timestamp()-make_interval(secs => (select active_seconds+30 from identity.session_creation_freshness_policy where policy_name='redeemed_evidence_freshness')),null),
  -- Used a day in the future.
  ('10650000-2000-4000-8000-000000000005','10650000-1000-4000-8000-000000000001','10650000-1200-4000-8000-000000000001',
   'l65-e1@synthetic.invalid','email','login','email',
   'svf1:0505050505050505050505050505050505050505050505050505050505050505',now()+interval '10 minutes',clock_timestamp()+interval '1 day',null),
  -- Used, but for another purpose.
  ('10650000-2000-4000-8000-000000000006','10650000-1000-4000-8000-000000000001','10650000-1200-4000-8000-000000000001',
   'l65-e1@synthetic.invalid','email','contact_verify','email',
   'svf1:0606060606060606060606060606060606060606060606060606060606060606',now()+interval '10 minutes',clock_timestamp(),null),
  -- Used, but bound to no account and no contact.
  ('10650000-2000-4000-8000-000000000007',null,null,
   'l65-pre@synthetic.invalid','email','login','email',
   'svf1:0707070707070707070707070707070707070707070707070707070707070707',now()+interval '10 minutes',clock_timestamp(),null),
  -- Used, bound to the account but to no contact.
  ('10650000-2000-4000-8000-000000000008','10650000-1000-4000-8000-000000000001',null,
   'l65-e1@synthetic.invalid','email','login','email',
   'svf1:0808080808080808080808080808080808080808080808080808080808080808',now()+interval '10 minutes',clock_timestamp(),null),
  -- Used for role re-entry.
  ('10650000-2000-4000-8000-00000000000a','10650000-1000-4000-8000-000000000001','10650000-1200-4000-8000-000000000001',
   'l65-e1@synthetic.invalid','email','role_reentry','email',
   'svf1:0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a',now()+interval '10 minutes',clock_timestamp(),null);

select ok(
  coalesce((select count(*) = 1
                   and bool_and(c.user_account_id is not distinct from l.user_account_id
                            and c.user_contact_method_id is not distinct from l.user_contact_method_id
                            and c.normalized_contact_value is not distinct from l.normalized_contact_value)
              from identity.verification_challenge c
              cross join l65_e1_lookup l
             where c.verification_challenge_id='10650000-2000-4000-8000-000000000001'), false),
  'fixture: the sign-in challenge is bound to exactly the account, contact, and email the lookup returned'
);

set local role service_role;
select results_eq(
  $$select confirmed from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000001','login')$$,
  $$values (false)$$,
  'before redemption, the account''s own challenge is not confirmed'
);
select results_eq(
  $$select outcome from public.solmind_redeem_verification_challenge('10650000-2000-4000-8000-000000000009','login','svf1:9090909090909090909090909090909090909090909090909090909090909090')$$,
  $$values ('denied'::text)$$,
  'fixture: a wrong code for the second Explorer''s challenge is denied by the real redemption function'
);
select results_eq(
  $$select outcome from public.solmind_redeem_verification_challenge('10650000-2000-4000-8000-000000000001','login','svf1:6565656565656565656565656565656565656565656565656565656565656565')$$,
  $$values ('redeemed'::text)$$,
  'the real redemption function redeems the account''s own challenge with the right code'
);
reset role;

create temp table l65_state_before_confirmations as select pg_temp.l65_app_state() as fingerprint;

set local role service_role;
select results_eq(
  $$select confirmed from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000001','login')$$,
  $$values (true)$$,
  'after redemption, the account''s own fresh login challenge is confirmed: true'
);
select results_eq(
  $$select confirmed from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000009','10650000-2000-4000-8000-000000000001','login')$$,
  $$values (false)$$,
  'one Explorer''s redeemed challenge with another Explorer''s account (the account typed at A4) is not confirmed'
);
select results_eq(
  $$select confirmed from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000001','role_reentry')$$,
  $$values (false)$$,
  'a redeemed login challenge expected as role re-entry is not confirmed'
);
select results_eq(
  $$select confirmed from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000009','10650000-2000-4000-8000-000000000009','login')$$,
  $$values (false)$$,
  'a challenge after a wrong code, never redeemed, is not confirmed'
);
select results_eq(
  $$select confirmed from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000009','login')$$,
  $$values (false)$$,
  'another account''s challenge is not confirmed'
);
select results_eq(
  $$select confirmed from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000003','login')$$,
  $$values (false)$$,
  'an invalidated challenge is not confirmed'
);
select results_eq(
  $$select confirmed from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000004','login')$$,
  $$values (false)$$,
  'a challenge used before the active freshness window is stale and not confirmed'
);
select results_eq(
  $$select confirmed from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000005','login')$$,
  $$values (false)$$,
  'a challenge whose use time is in the future is not confirmed'
);
select results_eq(
  $$select confirmed from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000006','login')$$,
  $$values (false)$$,
  'a used challenge of another purpose (contact_verify) is not confirmed as login'
);
select results_eq(
  $$select confirmed from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000007','login')$$,
  $$values (false)$$,
  'a used challenge bound to no account (null-bound) is not confirmed'
);
select results_eq(
  $$select confirmed from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000008','login')$$,
  $$values (false)$$,
  'a used challenge bound to the account but to no contact is not confirmed'
);
select results_eq(
  $$select confirmed from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-00000000000a','role_reentry')$$,
  $$values (true)$$,
  'a fresh used role re-entry challenge expected as role re-entry is confirmed'
);
select results_eq(
  $$select confirmed from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-00000000000a','login')$$,
  $$values (false)$$,
  'the same role re-entry challenge expected as login is not confirmed'
);
select results_eq(
  $$select confirmed from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-0000000000ff','login')$$,
  $$values (false)$$,
  'an unknown selector is not confirmed'
);
select results_eq(
  $$select count(*)::int,bool_and(confirmed is false)
      from (
        select * from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000009','10650000-2000-4000-8000-000000000001','login')
        union all select * from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000001','role_reentry')
        union all select * from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000009','10650000-2000-4000-8000-000000000009','login')
        union all select * from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000009','login')
        union all select * from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000003','login')
        union all select * from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000004','login')
        union all select * from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000005','login')
        union all select * from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000006','login')
        union all select * from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000007','login')
        union all select * from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000008','login')
        union all select * from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-00000000000a','login')
        union all select * from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-0000000000ff','login')
      ) refused$$,
  $$values (12,true)$$,
  'every refused state gives the same single result: exactly one false row each, with no reason'
);
reset role;

select is(
  pg_temp.l65_app_state(),
  (select fingerprint from l65_state_before_confirmations),
  'the confirmations changed no row in any application table and wrote no audit row'
);

-- 4. Session creation.
-- Selected evidence refusals agree with session creation; the fresh, unconsumed fixture is accepted. Confirmation alone does not establish session creatability.
set local role service_role;
select throws_ok(
  $$select * from public.solmind_create_user_session('10650000-1000-4000-8000-000000000009','explorer','10650000-2000-4000-8000-000000000001','login',300)$$,
  'P0001','solmind_session_ineligible_evidence',
  'the session function also refuses one Explorer''s redeemed challenge for another Explorer''s account'
);
select throws_ok(
  $$select * from public.solmind_create_user_session('10650000-1000-4000-8000-000000000001','explorer','10650000-2000-4000-8000-000000000003','login',300)$$,
  'P0001','solmind_session_ineligible_evidence',
  'the session function also refuses the invalidated challenge'
);
select throws_ok(
  $$select * from public.solmind_create_user_session('10650000-1000-4000-8000-000000000001','explorer','10650000-2000-4000-8000-000000000004','login',300)$$,
  'P0001','solmind_session_stale_evidence',
  'the session function also refuses the stale challenge'
);
select throws_ok(
  $$select * from public.solmind_create_user_session('10650000-1000-4000-8000-000000000001','explorer','10650000-2000-4000-8000-000000000005','login',300)$$,
  'P0001','solmind_session_stale_evidence',
  'the session function also refuses the challenge used in the future'
);
select throws_ok(
  $$select * from public.solmind_create_user_session('10650000-1000-4000-8000-000000000001','explorer','10650000-2000-4000-8000-000000000006','login',300)$$,
  'P0001','solmind_session_ineligible_evidence',
  'the session function also refuses the challenge of another purpose'
);
select throws_ok(
  $$select * from public.solmind_create_user_session('10650000-1000-4000-8000-000000000001','explorer','10650000-2000-4000-8000-000000000007','login',300)$$,
  'P0001','solmind_session_ineligible_evidence',
  'the session function also refuses the null-bound challenge'
);
select throws_ok(
  $$select * from public.solmind_create_user_session('10650000-1000-4000-8000-000000000001','explorer','10650000-2000-4000-8000-000000000008','login',300)$$,
  'P0001','solmind_session_ineligible_evidence',
  'the session function also refuses the challenge with no contact'
);
select results_eq(
  $$select outcome from public.solmind_create_user_session('10650000-1000-4000-8000-000000000001','explorer','10650000-2000-4000-8000-000000000001','login',300)$$,
  $$values ('created'::text)$$,
  'the real session function creates a session from the fresh, unconsumed challenge the confirmation confirmed'
);
select results_eq(
  $$select confirmed from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-000000000001','login')$$,
  $$values (true)$$,
  'the confirmation is not a consumption check: evidence a session has used still confirms, so the route''s own redeemed answer in the same request remains required'
);
reset role;

-- 5. Freshness: the near-boundary fixture is prepared just before its comparisons; the endpoints of the
--    window are exact (both are inside it); the window follows the protected, database-configurable
--    policy; and a missing policy confirms nothing.
insert into identity.verification_challenge (
  verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,
  contact_method_type,purpose,delivery_channel,code_hash,expires_at,used_at
) values
  ('10650000-2000-4000-8000-00000000000b','10650000-1000-4000-8000-000000000001','10650000-1200-4000-8000-000000000001',
   'l65-e1@synthetic.invalid','email','login','email',
   'svf1:0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b',now()+interval '10 minutes',
   clock_timestamp()-make_interval(secs => (select active_seconds-60 from identity.session_creation_freshness_policy where policy_name='redeemed_evidence_freshness')));
set local role service_role;
select results_eq(
  $$select confirmed from public.solmind_confirm_redeemed_login_challenge('10650000-1000-4000-8000-000000000001','10650000-2000-4000-8000-00000000000b','login')$$,
  $$values (true)$$,
  'a challenge used 60 seconds inside the active freshness window is confirmed'
);
reset role;
select ok(
  pg_temp.l65_confirm_with_use_time('10650000-2000-4000-8000-00000000000b',
    -make_interval(secs => (select active_seconds from identity.session_creation_freshness_policy where policy_name='redeemed_evidence_freshness'))) is true,
  'a challenge used exactly at the start of the active window is confirmed: the window includes its start'
);
select ok(
  pg_temp.l65_confirm_with_use_time('10650000-2000-4000-8000-00000000000b',
    -make_interval(secs => (select active_seconds from identity.session_creation_freshness_policy where policy_name='redeemed_evidence_freshness'))
    - interval '1 microsecond') is false,
  'a challenge used one microsecond before the window starts is not confirmed'
);
select ok(
  pg_temp.l65_confirm_with_use_time('10650000-2000-4000-8000-00000000000b', interval '0') is true,
  'a challenge used at the statement clock itself is confirmed: the window includes its end'
);
select ok(
  pg_temp.l65_confirm_with_use_time('10650000-2000-4000-8000-00000000000b', interval '1 microsecond') is false,
  'a challenge used one microsecond after the statement clock is not confirmed'
);

create temp table l65_policy_before as
select * from identity.session_creation_freshness_policy where policy_name='redeemed_evidence_freshness';
update identity.session_creation_freshness_policy set active_seconds=minimum_seconds where policy_name='redeemed_evidence_freshness';
select ok(
  pg_temp.l65_confirm_with_use_time('10650000-2000-4000-8000-00000000000b',
    -make_interval(secs => (select minimum_seconds+1 from l65_policy_before))) is false,
  'with the active freshness value shortened to the minimum, a challenge one second older than it is stale'
);
update identity.session_creation_freshness_policy
   set active_seconds=(select active_seconds from l65_policy_before)
 where policy_name='redeemed_evidence_freshness';
select ok(
  pg_temp.l65_confirm_with_use_time('10650000-2000-4000-8000-00000000000b',
    -make_interval(secs => (select minimum_seconds+1 from l65_policy_before))) is true,
  'with the active freshness value restored, the same use time is confirmed again'
);
delete from identity.session_creation_freshness_policy where policy_name='redeemed_evidence_freshness';
select ok(
  pg_temp.l65_confirm_with_use_time('10650000-2000-4000-8000-00000000000b', interval '0') is false,
  'with the freshness policy missing, nothing is confirmed: one false row, not an error'
);
insert into identity.session_creation_freshness_policy select * from l65_policy_before;
select ok(
  pg_temp.l65_confirm_with_use_time('10650000-2000-4000-8000-00000000000b', interval '0') is true,
  'with the freshness policy restored, the fresh challenge is confirmed again'
);

select is(
  (select count(*)::int from audit.audit_event
    where target_entity_id in (select verification_challenge_id from identity.verification_challenge where verification_challenge_id::text like '10650000-%')
      and event_type not in ('verification_challenge_redeemed','verification_challenge_failed')),
  0,
  'the only audit rows about these challenges are the real redemption function''s own'
);
select is(
  (select count(*)::int from audit.audit_event a
    where a.metadata::text like '%l65-%' or a.event_summary like '%l65-%'),
  0,
  'no audit row carries a synthetic contact value'
);

select * from finish();
rollback;
