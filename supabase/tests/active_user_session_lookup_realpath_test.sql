-- Login step 6 sub-slice S6-3 real-path proofs for public.solmind_find_active_user_sessions after
-- migration 20261005000000_active_user_session_lookup_session_id.sql: each returned row carries the
-- session's own UUID, the one the session-creation function returned, and the lookup otherwise
-- behaves as banked (only active-status rows of the one account, expiry not pre-filtered, no row for
-- an absent or null account, nothing written).
-- Sessions are created by the real public.solmind_create_user_session from directly inserted
-- account-bound redeemed evidence, and ended by the real public.solmind_logout_user_session; rows
-- with a status or expiry that the creation function never writes are inserted directly.
-- Every lookup runs as service_role, the only role that may execute it; the results are checked
-- afterwards as the test owner.
-- Session UUIDs, and rows or fingerprints that contain them, are compared only inside SQL and handed
-- to ok() as one boolean, so a failing assertion prints no session UUID (contract 25 Sections 14 and
-- 15 item 11). Row sets are compared both ways with EXCEPT ALL, which keeps values and multiplicities.
-- Local ephemeral database only. Synthetic rows use the reserved id prefix 10630000- and contacts
-- under l63-*@synthetic.invalid. Everything rolls back.
begin;
select plan(26);

-- Whole-state fingerprint of every session row and every audit row.
create function pg_temp.l63_state() returns text language sql as $$
  select md5(
    coalesce((select string_agg(to_jsonb(s)::text, ',' order by to_jsonb(s)::text) from identity.user_session s), '')
    || '|' ||
    coalesce((select string_agg(to_jsonb(a)::text, ',' order by to_jsonb(a)::text) from audit.audit_event a), '')
  )
$$;

insert into identity.user_account (user_account_id,display_name,account_status)
values
  ('10630000-1000-4000-8000-000000000001','L63 synthetic admin and guide','active'),
  ('10630000-1000-4000-8000-000000000002','L63 synthetic bystander guide','active'),
  ('10630000-1000-4000-8000-000000000003','L63 synthetic ended sessions','active'),
  ('10630000-1000-4000-8000-000000000004','L63 synthetic expired active session','active');
insert into identity.user_role_assignment (user_role_assignment_id,user_account_id,role_code,role_status)
values
  ('10630000-1100-4000-8000-000000000001','10630000-1000-4000-8000-000000000001','admin','active'),
  ('10630000-1100-4000-8000-000000000002','10630000-1000-4000-8000-000000000001','guide','active'),
  ('10630000-1100-4000-8000-000000000003','10630000-1000-4000-8000-000000000002','guide','active');
insert into identity.user_contact_method (
  user_contact_method_id,user_account_id,contact_method_type,contact_label,contact_value,
  normalized_contact_value,login_enabled,is_verified,status
) values
  ('10630000-1200-4000-8000-000000000001','10630000-1000-4000-8000-000000000001','email','primary','l63-a1@synthetic.invalid','l63-a1@synthetic.invalid',true,true,'active'),
  ('10630000-1200-4000-8000-000000000002','10630000-1000-4000-8000-000000000002','email','primary','l63-a2@synthetic.invalid','l63-a2@synthetic.invalid',true,true,'active');

-- 1. The lookup returns the session UUID that the creation function returned.
insert into identity.verification_challenge (
  verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,
  contact_method_type,purpose,delivery_channel,code_hash,expires_at,used_at
) values (
  '10630000-2000-4000-8000-000000000001','10630000-1000-4000-8000-000000000001',
  '10630000-1200-4000-8000-000000000001','l63-a1@synthetic.invalid','email','login','email',
  'svf1:1111111111111111111111111111111111111111111111111111111111111111',now()+interval '10 minutes',clock_timestamp()
);
set local role service_role;
create temp table l63_s1 as
select * from public.solmind_create_user_session(
  '10630000-1000-4000-8000-000000000001','admin',
  '10630000-2000-4000-8000-000000000001','login',300
);
create temp table l63_l1 as
select * from public.solmind_find_active_user_sessions('10630000-1000-4000-8000-000000000001');
reset role;
select is((select outcome from l63_s1),'created','fixture: the real session function creates an admin session');
select is((select count(*)::int from l63_l1),1,'the lookup returns the account''s one active session');
select ok(
  (select user_session_id from l63_l1) =
  (select user_session_id from l63_s1),
  'the lookup returns the session UUID that the creation function returned'
);
select is((select expires_at from l63_l1),(select expires_at from l63_s1),'the lookup returns the expiry that the creation function returned');
select ok(
  not exists (
    (select user_session_id,user_account_id,active_role_context,session_status,expires_at from l63_l1
     except all
     select user_session_id,user_account_id,active_role_context,session_status,expires_at
       from identity.user_session where user_session_id=(select user_session_id from l63_s1))
    union all
    (select user_session_id,user_account_id,active_role_context,session_status,expires_at
       from identity.user_session where user_session_id=(select user_session_id from l63_s1)
     except all
     select user_session_id,user_account_id,active_role_context,session_status,expires_at from l63_l1)
  ),
  'every returned column equals the stored session row'
);
select results_eq(
  $$select user_account_id,active_role_context,session_status from l63_l1$$,
  $$select '10630000-1000-4000-8000-000000000001'::uuid,'admin'::text,'active'::text$$,
  'the banked columns keep their values: the account, the session''s own role, and active'
);

-- 2. The row as the Data API serializes it: the banked keys keep their names, and every value is a
--    JSON string, which the app's row reader requires; the added key is one more string.
select is(
  (select array_agg(k order by k) from l63_l1 r cross join lateral jsonb_object_keys(to_jsonb(r)) k),
  array['active_role_context','expires_at','session_status','user_account_id','user_session_id']::text[],
  'a returned row carries exactly the four banked keys plus user_session_id'
);
select ok(
  (select bool_and(jsonb_typeof(e.v)='string') from l63_l1 r cross join lateral jsonb_each(to_jsonb(r)) as e(k,v)),
  'every returned value serializes as a JSON string'
);

-- 3. A bystander account's session never appears in another account's lookup.
insert into identity.verification_challenge (
  verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,
  contact_method_type,purpose,delivery_channel,code_hash,expires_at,used_at
) values (
  '10630000-2000-4000-8000-000000000050','10630000-1000-4000-8000-000000000002',
  '10630000-1200-4000-8000-000000000002','l63-a2@synthetic.invalid','email','login','email',
  'svf1:5050505050505050505050505050505050505050505050505050505050505050',now()+interval '10 minutes',clock_timestamp()
);
set local role service_role;
create temp table l63_sb as
select * from public.solmind_create_user_session(
  '10630000-1000-4000-8000-000000000002','guide',
  '10630000-2000-4000-8000-000000000050','login',3600
);
create temp table l63_la as
select * from public.solmind_find_active_user_sessions('10630000-1000-4000-8000-000000000001');
create temp table l63_lb as
select * from public.solmind_find_active_user_sessions('10630000-1000-4000-8000-000000000002');
reset role;
select is((select outcome from l63_sb),'created','fixture: a bystander account holds its own active session');
select ok(
  not exists (
    (select user_session_id from l63_la
     except all
     select user_session_id from l63_s1)
    union all
    (select user_session_id from l63_s1
     except all
     select user_session_id from l63_la)
  ),
  'the account''s lookup returns only its own session'
);
select ok(
  not exists (
    (select user_session_id,user_account_id from l63_lb
     except all
     select user_session_id,'10630000-1000-4000-8000-000000000002'::uuid from l63_sb)
    union all
    (select user_session_id,'10630000-1000-4000-8000-000000000002'::uuid from l63_sb
     except all
     select user_session_id,user_account_id from l63_lb)
  ),
  'the bystander''s lookup returns only the bystander''s session UUID'
);

-- 4. A newer login in the same role supersedes the first session: the lookup returns only the newer
--    UUID, so the UUID a stale browser still holds no longer matches.
insert into identity.verification_challenge (
  verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,
  contact_method_type,purpose,delivery_channel,code_hash,expires_at,used_at
) values (
  '10630000-2000-4000-8000-000000000002','10630000-1000-4000-8000-000000000001',
  '10630000-1200-4000-8000-000000000001','l63-a1@synthetic.invalid','email','login','email',
  'svf1:2222222222222222222222222222222222222222222222222222222222222222',now()+interval '10 minutes',clock_timestamp()
);
set local role service_role;
create temp table l63_s2 as
select * from public.solmind_create_user_session(
  '10630000-1000-4000-8000-000000000001','admin',
  '10630000-2000-4000-8000-000000000002','login',300
);
create temp table l63_l2 as
select * from public.solmind_find_active_user_sessions('10630000-1000-4000-8000-000000000001');
reset role;
select is((select outcome from l63_s2),'created','fixture: a newer admin login of the same account is created');
select is(
  (select session_status from identity.user_session where user_session_id=(select user_session_id from l63_s1)),
  'revoked',
  'fixture: the first session is superseded'
);
select ok(
  not exists (
    (select user_session_id from l63_l2
     except all
     select user_session_id from l63_s2)
    union all
    (select user_session_id from l63_s2
     except all
     select user_session_id from l63_l2)
  ),
  'after a same-role supersession the lookup returns only the newer session''s UUID'
);
select ok(
  not exists (select 1 from l63_l2 where user_session_id=(select user_session_id from l63_s1)),
  'the superseded session''s UUID, which a stale browser would still present, is not returned'
);

-- 5. A newer login in another role supersedes it too: the lookup returns the new UUID with its role.
insert into identity.verification_challenge (
  verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,
  contact_method_type,purpose,delivery_channel,code_hash,expires_at,used_at
) values (
  '10630000-2000-4000-8000-000000000003','10630000-1000-4000-8000-000000000001',
  '10630000-1200-4000-8000-000000000001','l63-a1@synthetic.invalid','email','role_reentry','email',
  'svf1:3333333333333333333333333333333333333333333333333333333333333333',now()+interval '10 minutes',clock_timestamp()
);
set local role service_role;
create temp table l63_s3 as
select * from public.solmind_create_user_session(
  '10630000-1000-4000-8000-000000000001','guide',
  '10630000-2000-4000-8000-000000000003','role_reentry',300
);
create temp table l63_l3 as
select * from public.solmind_find_active_user_sessions('10630000-1000-4000-8000-000000000001');
reset role;
select is((select outcome from l63_s3),'created','fixture: a newer guide-role login supersedes the admin session');
select ok(
  not exists (
    (select user_session_id,active_role_context from l63_l3
     except all
     select user_session_id,'guide'::text from l63_s3)
    union all
    (select user_session_id,'guide'::text from l63_s3
     except all
     select user_session_id,active_role_context from l63_l3)
  ),
  'after a role change the lookup returns only the newer session''s UUID, with its own role'
);

-- 6. After logout the account has no active session, so the lookup returns no row.
set local role service_role;
create temp table l63_out as
select * from public.solmind_logout_user_session(
  '10630000-1000-4000-8000-000000000001',(select user_session_id from l63_s3)
);
create temp table l63_l4 as
select * from public.solmind_find_active_user_sessions('10630000-1000-4000-8000-000000000001');
reset role;
select is((select outcome from l63_out),'ended','fixture: the logout writer ends the guide session');
select is((select count(*)::int from l63_l4),0,'after logout the lookup returns no row for the account');

-- 7. Only active-status rows are returned, and an active row past its expiry is still returned, with
--    its own UUID, so the app's selection rule sees the expiry and denies.
insert into identity.user_session (
  user_session_id,user_account_id,active_role_context,created_at,expires_at,ended_at,session_status
) values
  ('10630000-3000-4000-8000-000000000001','10630000-1000-4000-8000-000000000003','guide',
   now()-interval '2 hours',now()-interval '1 hour',now()-interval '1 hour','expired'),
  ('10630000-3000-4000-8000-000000000002','10630000-1000-4000-8000-000000000003','guide',
   now()-interval '2 hours',now()+interval '1 hour',now()-interval '90 minutes','logged_out'),
  ('10630000-3000-4000-8000-000000000003','10630000-1000-4000-8000-000000000003','guide',
   now()-interval '2 hours',now()+interval '1 hour',now()-interval '100 minutes','revoked'),
  ('10630000-3000-4000-8000-000000000004','10630000-1000-4000-8000-000000000004','admin',
   now()-interval '2 hours',now()-interval '1 hour',null,'active');
set local role service_role;
create temp table l63_l5 as
select * from public.solmind_find_active_user_sessions('10630000-1000-4000-8000-000000000003');
create temp table l63_l6 as
select * from public.solmind_find_active_user_sessions('10630000-1000-4000-8000-000000000004');
reset role;
select is((select count(*)::int from l63_l5),0,'expired, logged_out, and revoked sessions are not returned');
select ok(
  not exists (
    (select user_session_id,session_status from l63_l6
     except all
     select '10630000-3000-4000-8000-000000000004'::uuid,'active'::text)
    union all
    (select '10630000-3000-4000-8000-000000000004'::uuid,'active'::text
     except all
     select user_session_id,session_status from l63_l6)
  ),
  'an active-status session past its expiry is still returned, with its own UUID (no expiry pre-filter)'
);
select ok(
  (select expires_at<clock_timestamp() from l63_l6),
  'the returned session is already past its expiry, leaving the deny to the app'
);

-- 8. An absent account and a null account return no row, with no error.
set local role service_role;
create temp table l63_l7 as
select * from public.solmind_find_active_user_sessions('10630000-1000-4000-8000-0000000000ff');
create temp table l63_l8 as
select * from public.solmind_find_active_user_sessions(null);
reset role;
select is((select count(*)::int from l63_l7),0,'an account that does not exist returns no row');
select is((select count(*)::int from l63_l8),0,'a null account returns no row and raises nothing');

-- 9. The lookup writes nothing.
create temp table l63_state_before as select pg_temp.l63_state() as s;
set local role service_role;
create temp table l63_l9 as
select * from public.solmind_find_active_user_sessions('10630000-1000-4000-8000-000000000001')
union all
select * from public.solmind_find_active_user_sessions('10630000-1000-4000-8000-000000000002')
union all
select * from public.solmind_find_active_user_sessions('10630000-1000-4000-8000-000000000003')
union all
select * from public.solmind_find_active_user_sessions('10630000-1000-4000-8000-000000000004');
reset role;
select ok(
  pg_temp.l63_state() = (select s from l63_state_before),
  'calling the lookup changes no session row and writes no audit row'
);

-- 10. The bystander's session is untouched throughout.
select results_eq(
  $$select session_status from identity.user_session where user_session_id=(select user_session_id from l63_sb)$$,
  $$select 'active'::text$$,
  'the bystander''s session stays active throughout'
);

select * from finish();
rollback;
