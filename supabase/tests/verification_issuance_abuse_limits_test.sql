-- Login step 2 / backlog item 59 / AUTH-RLS-DEC-037: abuse-limit proofs for
-- public.solmind_issue_verification_challenge. Local ephemeral database only. Rows use the reserved id prefix
-- 5a590059- and contacts under limits-*@synthetic.invalid; history rows are inserted directly with created_at in the
-- past to place them in or out of the rolling hour. Everything rolls back.
begin;
select plan(29);

-- History helper: n committed-looking issuances for a contact, the k-th at "minutes_ago[k]" minutes before now.
create function pg_temp.limits_history(p_contact text, p_minutes_ago int[], p_purpose text default 'login')
returns void language plpgsql as $$
declare m int; i int := 0;
begin
  foreach m in array p_minutes_ago loop
    i := i + 1;
    insert into identity.verification_challenge(
      verification_challenge_id, normalized_contact_value, contact_method_type, purpose, delivery_channel,
      code_hash, expires_at, created_at, invalidated_at)
    values (
      gen_random_uuid(), p_contact, 'email', p_purpose, 'email',
      'svf1:' || repeat('0', 64), now() - make_interval(mins => m) + interval '10 minutes',
      now() - make_interval(mins => m), now() - make_interval(mins => m) + interval '1 second');
  end loop;
end;
$$;

select has_index('identity', 'verification_challenge', 'verification_challenge_contact_created_idx',
  'contact-plus-creation-time index exists');

-- 1. Budget: five issuances in the last hour, the sixth is allowed, the seventh is denied without any write.
select pg_temp.limits_history('limits-a@synthetic.invalid', array[50, 40, 30, 20, 10]);
set local role service_role;
select is((select outcome from public.solmind_issue_verification_challenge('5a590059-0000-4000-8000-000000000001',
  'limits-a@synthetic.invalid','email','login','email','svf1:' || repeat('1', 64),null,null)),
  'issued', 'sixth issuance in the rolling hour is allowed');
select ok(pg_catalog.current_setting('transaction_timeout')::interval = interval '60 seconds',
  'the call bounds the rest of its transaction to 60 seconds (review #109b)');
select is((select outcome from public.solmind_issue_verification_challenge('5a590059-0000-4000-8000-000000000002',
  'limits-a@synthetic.invalid','email','login','email','svf1:' || repeat('2', 64),null,null)),
  'denied', 'seventh issuance in the rolling hour is denied');
reset role;
select is((select count(*)::int from identity.verification_challenge
  where verification_challenge_id = '5a590059-0000-4000-8000-000000000002'), 0, 'denial writes no challenge row');
select is((select count(*)::int from audit.audit_event
  where target_entity_id = '5a590059-0000-4000-8000-000000000002'), 0, 'denial writes no audit row');
select ok((select invalidated_at is null and used_at is null from identity.verification_challenge
  where verification_challenge_id = '5a590059-0000-4000-8000-000000000001'),
  'the allowed sixth challenge stays open after the denial (denial does not supersede)');

-- 2. Rolling boundary: rows older than an hour do not count.
select pg_temp.limits_history('limits-b@synthetic.invalid', array[75, 70, 65, 61, 5]);
set local role service_role;
select is((select outcome from public.solmind_issue_verification_challenge('5a590059-0000-4000-8000-000000000003',
  'limits-b@synthetic.invalid','email','login','email','svf1:' || repeat('3', 64),null,null)),
  'issued', 'rows older than one hour are outside the budget');
reset role;

-- 3. Lockout: rows 65, 64, 63, 62, 61 and 10 minutes ago. The row 10 minutes ago is the sixth within its own rolling
--    hour (70 to 10 minutes ago), so a 15-minute lockout runs until 5 minutes from now, although the current rolling
--    hour holds only that one row. The concurrency proof is in verification_issuance_abuse_limits_concurrency_test.sql.
select pg_temp.limits_history('limits-c@synthetic.invalid', array[65, 64, 63, 62, 61, 10]);
set local role service_role;
select is((select outcome from public.solmind_issue_verification_challenge('5a590059-0000-4000-8000-000000000004',
  'limits-c@synthetic.invalid','email','login','email','svf1:' || repeat('4', 64),null,null)),
  'denied', 'a sixth issuance 10 minutes ago starts a lockout that still denies');
reset role;
-- The denied attempt did not extend the lockout: no new row exists to restart it.
select is((select count(*)::int from identity.verification_challenge
  where normalized_contact_value = 'limits-c@synthetic.invalid'), 6, 'the denied attempt added no row (non-extending)');

-- 4. Lockout expiry: the sixth issuance was 16 minutes ago and fewer than six remain in the rolling hour.
select pg_temp.limits_history('limits-d@synthetic.invalid', array[70, 69, 68, 67, 66, 16]);
set local role service_role;
select is((select outcome from public.solmind_issue_verification_challenge('5a590059-0000-4000-8000-000000000005',
  'limits-d@synthetic.invalid','email','login','email','svf1:' || repeat('5', 64),null,null)),
  'issued', 'after 15 minutes the lockout ends when the rolling hour has room');
reset role;

-- 5. Lockout ended but the rolling hour is still full: still denied.
select pg_temp.limits_history('limits-e@synthetic.invalid', array[55, 50, 45, 40, 35, 20]);
set local role service_role;
select is((select outcome from public.solmind_issue_verification_challenge('5a590059-0000-4000-8000-000000000006',
  'limits-e@synthetic.invalid','email','login','email','svf1:' || repeat('6', 64),null,null)),
  'denied', 'the rolling-hour limit keeps denying after the lockout ends');
reset role;

-- 6. Cross-purpose: the budget counts all purposes together.
select pg_temp.limits_history('limits-f@synthetic.invalid', array[30, 25, 20], 'login');
select pg_temp.limits_history('limits-f@synthetic.invalid', array[29, 24, 19], 'contact_verify');
set local role service_role;
select is((select outcome from public.solmind_issue_verification_challenge('5a590059-0000-4000-8000-000000000007',
  'limits-f@synthetic.invalid','email','first_admin_setup','email','svf1:' || repeat('7', 64),null,null)),
  'denied', 'six issuances across purposes deny a seventh of any purpose');
reset role;

-- 7. Other contacts are unaffected.
set local role service_role;
select is((select outcome from public.solmind_issue_verification_challenge('5a590059-0000-4000-8000-000000000008',
  'limits-g@synthetic.invalid','email','login','email','svf1:' || repeat('8', 64),null,null)),
  'issued', 'a different contact has its own budget');
reset role;

-- 8. Rollback refunds: an issuance rolled back (induced audit failure) consumes no budget.
select pg_temp.limits_history('limits-h@synthetic.invalid', array[40, 30, 20, 10, 5]);
create function pg_temp.limits_reject_audit() returns trigger language plpgsql as
  $$begin raise exception 'limits_induced_audit_failure'; end$$;
create trigger limits_reject_audit before insert on audit.audit_event for each row
  execute function pg_temp.limits_reject_audit();
set local role service_role;
select throws_ok($$select * from public.solmind_issue_verification_challenge('5a590059-0000-4000-8000-000000000009',
  'limits-h@synthetic.invalid','email','login','email','svf1:' || repeat('9', 64),null,null)$$,
  'P0001', 'limits_induced_audit_failure', 'induced audit failure rolls the sixth issuance back');
reset role;
drop trigger limits_reject_audit on audit.audit_event;
set local role service_role;
select is((select outcome from public.solmind_issue_verification_challenge('5a590059-0000-4000-8000-000000000010',
  'limits-h@synthetic.invalid','email','login','email','svf1:' || repeat('a', 64),null,null)),
  'issued', 'the rolled-back attempt consumed no budget');
reset role;

-- 9. Privacy and closed outcomes.
select ok((select pg_catalog.obj_description(
    'public.solmind_issue_verification_challenge(uuid,text,text,text,text,text,uuid,uuid)'::regprocedure, 'pg_proc')
    like '%Returns issued or denied; denials write nothing.%'), 'the function documents its closed outcomes');
select is((select count(*)::int from audit.audit_event where to_jsonb(audit_event)::text like '%limits-%@synthetic.invalid%'),
  0, 'no audit row carries a contact value');

-- 10. Grants unchanged.
select ok(not has_function_privilege('anon', 'public.solmind_issue_verification_challenge(uuid,text,text,text,text,text,uuid,uuid)', 'execute'),
  'anon cannot execute');
select ok(not has_function_privilege('authenticated', 'public.solmind_issue_verification_challenge(uuid,text,text,text,text,text,uuid,uuid)', 'execute'),
  'authenticated cannot execute');
select ok(has_function_privilege('service_role', 'public.solmind_issue_verification_challenge(uuid,text,text,text,text,text,uuid,uuid)', 'execute'),
  'service_role can execute');
select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc
  where oid = 'public.solmind_issue_verification_challenge(uuid,text,text,text,text,text,uuid,uuid)'::regprocedure),
  'security definer with an empty search path');

-- 11. Redemption is unaffected by the lockout: contact limits-a is locked out (test 1), and its allowed sixth
--     challenge still redeems (solmind_redeem_verification_challenge(id, purpose, verifier), 20260712000000).
set local role service_role;
select is((select outcome from public.solmind_redeem_verification_challenge('5a590059-0000-4000-8000-000000000001',
  'login','svf1:' || repeat('1', 64))), 'redeemed', 'the issuance lockout never blocks redemption');
reset role;

-- 12. Time basis (review #109a): an issuance records the clock time after the contact lock, not the transaction start.
select pg_catalog.pg_sleep(1.1);
select is((select outcome from public.solmind_issue_verification_challenge(
  '5a590059-0000-4000-8000-000000000901', 'limits-clock@synthetic.invalid', 'email', 'login', 'email',
  'svf1:' || repeat('9', 64), null, null)), 'issued', 'an issuance one second into the transaction');
select ok((select created_at >= now() + interval '1 second' from identity.verification_challenge
  where verification_challenge_id = '5a590059-0000-4000-8000-000000000901'),
  'its created_at is the clock time, not the transaction start');
-- 13. Supersession time (review #109b): a second issuance for the same contact and purpose invalidates the first at
--     its own issuance time, never before the first was created.
select is((select outcome from public.solmind_issue_verification_challenge(
  '5a590059-0000-4000-8000-000000000911', 'limits-order@synthetic.invalid', 'email', 'login', 'email',
  'svf1:' || repeat('a', 64), null, null)), 'issued', 'a first issuance for the order check');
select is((select outcome from public.solmind_issue_verification_challenge(
  '5a590059-0000-4000-8000-000000000912', 'limits-order@synthetic.invalid', 'email', 'login', 'email',
  'svf1:' || repeat('b', 64), null, null)), 'issued', 'a second issuance for the same contact and purpose');
select ok((select f.created_at <= f.invalidated_at and f.invalidated_at = s.created_at
  from identity.verification_challenge f, identity.verification_challenge s
  where f.verification_challenge_id = '5a590059-0000-4000-8000-000000000911'
    and s.verification_challenge_id = '5a590059-0000-4000-8000-000000000912'),
  'the first is invalidated at the second''s issuance time, after its own creation');
-- 14. A transaction older than 10 seconds fails closed before any read (review #109a). Kept last: every call after it
-- would fail.
select pg_catalog.pg_sleep(10.1);
select throws_ok($q$select * from public.solmind_issue_verification_challenge(
  '5a590059-0000-4000-8000-000000000902', 'limits-stale@synthetic.invalid', 'email', 'login', 'email',
  'svf1:' || repeat('8', 64), null, null)$q$, 'P0001', 'solmind_issue_stale_transaction',
  'an issuance in a transaction begun over 10 seconds earlier fails closed');
select * from finish();
rollback;
