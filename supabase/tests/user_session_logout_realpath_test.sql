-- Login step 6a real-path, audit, rollback, error-sanitization, and session-chronology proofs
-- for public.solmind_logout_user_session. Sessions are created by the real
-- public.solmind_create_user_session from directly inserted account-bound redeemed evidence.
-- Local ephemeral database only. Synthetic rows use the reserved id prefix 106a0000- and
-- contacts under l6a-*@synthetic.invalid. Everything rolls back.
begin;
select plan(64);

-- Whole-state fingerprint of every session row and every audit row.
create function pg_temp.l6a_state() returns text language sql as $$
  select md5(
    coalesce((select string_agg(to_jsonb(s)::text, ',' order by to_jsonb(s)::text) from identity.user_session s), '')
    || '|' ||
    coalesce((select string_agg(to_jsonb(a)::text, ',' order by to_jsonb(a)::text) from audit.audit_event a), '')
  )
$$;

-- Calls the logout writer and returns how it failed, as the caller would see it. OTHERS does
-- not cover assert_failure, so it has its own handler; an escaped assertion would be seen.
create function pg_temp.l6a_capture(p_account uuid, p_session uuid)
returns table (error_code text, error_message text, error_detail text, error_hint text, error_context text)
language plpgsql as $$
declare
  v_code text;
  v_message text;
  v_detail text;
  v_hint text;
  v_context text;
begin
  begin
    perform * from public.solmind_logout_user_session(p_account, p_session);
    return query select 'no_error'::text, ''::text, ''::text, ''::text, ''::text;
    return;
  exception
    when assert_failure then
      get stacked diagnostics
        v_code = returned_sqlstate,
        v_message = message_text,
        v_detail = pg_exception_detail,
        v_hint = pg_exception_hint,
        v_context = pg_exception_context;
    when others then
      get stacked diagnostics
        v_code = returned_sqlstate,
        v_message = message_text,
        v_detail = pg_exception_detail,
        v_hint = pg_exception_hint,
        v_context = pg_exception_context;
  end;
  return query select v_code, coalesce(v_message, ''), coalesce(v_detail, ''), coalesce(v_hint, ''), coalesce(v_context, '');
end;
$$;

insert into identity.user_account (user_account_id,display_name,account_status)
values
  ('106a0000-1000-4000-8000-000000000001','L6A synthetic admin and guide','active'),
  ('106a0000-1000-4000-8000-000000000002','L6A synthetic guide peer','active'),
  ('106a0000-1000-4000-8000-000000000003','L6A synthetic admin later suspended','active'),
  ('106a0000-1000-4000-8000-000000000004','L6A synthetic explorer','active'),
  ('106a0000-1000-4000-8000-000000000005','L6A synthetic bystander guide','active'),
  ('106a0000-1000-4000-8000-000000000006','L6A synthetic admin whose role is later suspended','active');
insert into identity.user_role_assignment (user_role_assignment_id,user_account_id,role_code,role_status)
values
  ('106a0000-1100-4000-8000-000000000001','106a0000-1000-4000-8000-000000000001','admin','active'),
  ('106a0000-1100-4000-8000-000000000002','106a0000-1000-4000-8000-000000000001','guide','active'),
  ('106a0000-1100-4000-8000-000000000003','106a0000-1000-4000-8000-000000000002','guide','active'),
  ('106a0000-1100-4000-8000-000000000004','106a0000-1000-4000-8000-000000000003','admin','active'),
  ('106a0000-1100-4000-8000-000000000005','106a0000-1000-4000-8000-000000000004','explorer','active'),
  ('106a0000-1100-4000-8000-000000000006','106a0000-1000-4000-8000-000000000005','guide','active'),
  ('106a0000-1100-4000-8000-000000000007','106a0000-1000-4000-8000-000000000006','admin','active');
insert into identity.user_contact_method (
  user_contact_method_id,user_account_id,contact_method_type,contact_label,contact_value,
  normalized_contact_value,login_enabled,is_verified,status
) values
  ('106a0000-1200-4000-8000-000000000001','106a0000-1000-4000-8000-000000000001','email','primary','l6a-a1@synthetic.invalid','l6a-a1@synthetic.invalid',true,true,'active'),
  ('106a0000-1200-4000-8000-000000000002','106a0000-1000-4000-8000-000000000002','email','primary','l6a-a2@synthetic.invalid','l6a-a2@synthetic.invalid',true,true,'active'),
  ('106a0000-1200-4000-8000-000000000003','106a0000-1000-4000-8000-000000000003','email','primary','l6a-a3@synthetic.invalid','l6a-a3@synthetic.invalid',true,true,'active'),
  ('106a0000-1200-4000-8000-000000000004','106a0000-1000-4000-8000-000000000004','email','primary','l6a-a4@synthetic.invalid','l6a-a4@synthetic.invalid',true,true,'active'),
  ('106a0000-1200-4000-8000-000000000005','106a0000-1000-4000-8000-000000000005','email','primary','l6a-a5@synthetic.invalid','l6a-a5@synthetic.invalid',true,true,'active'),
  ('106a0000-1200-4000-8000-000000000006','106a0000-1000-4000-8000-000000000006','email','primary','l6a-a6@synthetic.invalid','l6a-a6@synthetic.invalid',true,true,'active');

-- 0. A bystander account's active session exists before any logout and is never touched.
insert into identity.verification_challenge (
  verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,
  contact_method_type,purpose,delivery_channel,code_hash,expires_at,used_at
) values (
  '106a0000-2000-4000-8000-000000000050','106a0000-1000-4000-8000-000000000005',
  '106a0000-1200-4000-8000-000000000005','l6a-a5@synthetic.invalid','email','login','email',
  'svf1:5050505050505050505050505050505050505050505050505050505050505050',now()+interval '10 minutes',clock_timestamp()
);
set local role service_role;
create temp table l6a_sb as
select * from public.solmind_create_user_session(
  '106a0000-1000-4000-8000-000000000005','guide',
  '106a0000-2000-4000-8000-000000000050','login',3600
);
reset role;
select is((select outcome from l6a_sb),'created','fixture: a bystander account holds an active session before any logout');
create temp table l6a_sb_before as
select * from identity.user_session where user_session_id=(select user_session_id from l6a_sb);

-- 1. Ended: the account's active session is changed to logged_out with one audit row.
insert into identity.verification_challenge (
  verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,
  contact_method_type,purpose,delivery_channel,code_hash,expires_at,used_at
) values (
  '106a0000-2000-4000-8000-000000000001','106a0000-1000-4000-8000-000000000001',
  '106a0000-1200-4000-8000-000000000001','l6a-a1@synthetic.invalid','email','login','email',
  'svf1:1111111111111111111111111111111111111111111111111111111111111111',now()+interval '10 minutes',clock_timestamp()
);
set local role service_role;
create temp table l6a_s1 as
select * from public.solmind_create_user_session(
  '106a0000-1000-4000-8000-000000000001','admin',
  '106a0000-2000-4000-8000-000000000001','login',300
);
reset role;
select is((select outcome from l6a_s1),'created','fixture: the real session function creates the first admin session');

create temp table l6a_s1_before as
select * from identity.user_session where user_session_id=(select user_session_id from l6a_s1);
create temp table l6a_audit_count_before as
select count(*)::int as n from audit.audit_event;
create temp table l6a_other_sessions_before as
select count(*)::int as n,
       md5(coalesce(string_agg(to_jsonb(s)::text, ',' order by to_jsonb(s)::text), '')) as fingerprint
  from identity.user_session s
 where s.user_session_id <> (select user_session_id from l6a_s1);
create temp table l6a_other_audit_before as
select count(*)::int as n,
       md5(coalesce(string_agg(to_jsonb(a)::text, ',' order by to_jsonb(a)::text), '')) as fingerprint
  from audit.audit_event a;
create temp table l6a_tables_before as
select n.nspname||'.'||c.relname relation_name,
       (xpath('/row/fingerprint/text()',query_to_xml(format('select md5(coalesce(string_agg(to_jsonb(t)::text, '','' order by to_jsonb(t)::text), '''')) fingerprint from %I.%I t',n.nspname,c.relname),false,true,'')))[1]::text row_fingerprint
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p')
  and n.nspname in ('identity','core','audit','content','ai','methodology','notification','scheduling')
  and n.nspname||'.'||c.relname not in ('identity.user_session','audit.audit_event');
select ok(
  (select n>=1 from l6a_other_sessions_before)
  and exists (select 1 from identity.user_session where user_session_id=(select user_session_id from l6a_sb) and session_status='active'),
  'the unaffected-session set is not empty: it holds at least the bystander''s active session'
);
select ok((select n>=2 from l6a_other_audit_before),'the earlier audit rows are not empty: they hold at least the two creation rows');

set local role service_role;
create temp table l6a_logout_s1 as
select * from public.solmind_logout_user_session(
  '106a0000-1000-4000-8000-000000000001',(select user_session_id from l6a_s1)
);
reset role;
select is((select count(*)::int from l6a_logout_s1),1,'logout returns exactly one row');
select is((select outcome from l6a_logout_s1),'ended','logout of the account''s active session reports ended');
select results_eq(
  $$select session_status,ended_at is not null from identity.user_session where user_session_id=(select user_session_id from l6a_s1)$$,
  $$select 'logged_out'::text,true$$,
  'the presented session is logged_out with ended_at set'
);
select ok(
  (select ended_at>=created_at and ended_at<expires_at from identity.user_session where user_session_id=(select user_session_id from l6a_s1)),
  'ended_at falls inside the session''s own life'
);
select results_eq(
  $$select user_account_id,active_role_context,created_at,expires_at,last_activity_at,verification_challenge_id,ip_address,user_agent,metadata
      from identity.user_session where user_session_id=(select user_session_id from l6a_s1)$$,
  $$select user_account_id,active_role_context,created_at,expires_at,last_activity_at,verification_challenge_id,ip_address,user_agent,metadata
      from l6a_s1_before$$,
  'logout changes only the status and ended_at of the presented session'
);
select is((select count(*)::int from audit.audit_event)-(select n from l6a_audit_count_before),1,'logout writes exactly one audit row');
select results_eq(
  $$select event_type,action,reason_code,actor_user_account_id,actor_role_context,target_entity_type,target_entity_id,event_summary,metadata,ip_address,user_agent
      from audit.audit_event
     where target_entity_id=(select user_session_id from l6a_s1)
       and event_type='session_logged_out'$$,
  $$select 'session_logged_out'::text,'end'::text,'user_logout'::text,
           '106a0000-1000-4000-8000-000000000001'::uuid,'admin'::text,'user_session'::text,
           user_session_id,'User session ended by logout.'::text,'{}'::jsonb,null::text,null::text
      from l6a_s1$$,
  'the logout audit row is exact: account and the session''s own role, session target, fixed summary, empty metadata'
);
select results_eq(
  $$select count(*)::int,md5(coalesce(string_agg(to_jsonb(s)::text, ',' order by to_jsonb(s)::text), ''))
      from identity.user_session s where s.user_session_id <> (select user_session_id from l6a_s1)$$,
  $$select n,fingerprint from l6a_other_sessions_before$$,
  'no other session row changes'
);
select results_eq(
  $$select count(*)::int,md5(coalesce(string_agg(to_jsonb(a)::text, ',' order by to_jsonb(a)::text), ''))
      from audit.audit_event a
     where not (a.event_type='session_logged_out' and a.target_entity_id=(select user_session_id from l6a_s1))$$,
  $$select n,fingerprint from l6a_other_audit_before$$,
  'every earlier audit row is unchanged'
);
create temp table l6a_tables_after as
select n.nspname||'.'||c.relname relation_name,
       (xpath('/row/fingerprint/text()',query_to_xml(format('select md5(coalesce(string_agg(to_jsonb(t)::text, '','' order by to_jsonb(t)::text), '''')) fingerprint from %I.%I t',n.nspname,c.relname),false,true,'')))[1]::text row_fingerprint
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p')
  and n.nspname in ('identity','core','audit','content','ai','methodology','notification','scheduling')
  and n.nspname||'.'||c.relname not in ('identity.user_session','audit.audit_event');
select results_eq(
  $$select relation_name,row_fingerprint from l6a_tables_after order by 1$$,
  $$select relation_name,row_fingerprint from l6a_tables_before order by 1$$,
  'logout writes nothing to any other application table, including evidence and its consumption'
);

-- 2. Already ended: a repeated logout changes nothing and writes no row.
create temp table l6a_state_before_repeat as select pg_temp.l6a_state() as s;
set local role service_role;
select results_eq(
  $$select outcome from public.solmind_logout_user_session('106a0000-1000-4000-8000-000000000001',(select user_session_id from l6a_s1))$$,
  $$select 'already_ended'::text$$,
  'a repeated logout reports already_ended'
);
reset role;
select is(pg_temp.l6a_state(),(select s from l6a_state_before_repeat),'a repeated logout leaves every session row and every audit row exactly as they were');

-- 3. A logged-out session cannot be reopened, and older evidence cannot follow it
--    (the deferred DEF5-S4 terminal greatest-history and exact-retry fixtures).
set local role service_role;
select throws_ok(
  $$select * from public.solmind_create_user_session('106a0000-1000-4000-8000-000000000001','admin','106a0000-2000-4000-8000-000000000001','login',300)$$,
  'P0001','solmind_session_conflicting_retry',
  'an exact creation retry cannot reopen a logged-out session'
);
reset role;
insert into identity.verification_challenge (
  verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,
  contact_method_type,purpose,delivery_channel,code_hash,expires_at,used_at
) values (
  '106a0000-2000-4000-8000-000000000000','106a0000-1000-4000-8000-000000000001',
  '106a0000-1200-4000-8000-000000000001','l6a-a1@synthetic.invalid','email','role_reentry','email',
  'svf1:0000000000000000000000000000000000000000000000000000000000000000',now()+interval '10 minutes',clock_timestamp()
);
update identity.verification_challenge
   set used_at = (
     select used_at - interval '1 millisecond'
       from identity.verification_challenge
      where verification_challenge_id='106a0000-2000-4000-8000-000000000001'
   )
 where verification_challenge_id='106a0000-2000-4000-8000-000000000000';
set local role service_role;
select throws_ok(
  $$select * from public.solmind_create_user_session('106a0000-1000-4000-8000-000000000001','admin','106a0000-2000-4000-8000-000000000000','role_reentry',300)$$,
  'P0001','solmind_session_older_evidence',
  'fresh but older never-sessionized evidence cannot create a session after the newer session was logged out'
);
reset role;
select is((select count(*)::int from identity.user_session where verification_challenge_id='106a0000-2000-4000-8000-000000000000'),0,'the older evidence creates no session');
select is((select count(*)::int from audit.audit_event where actor_user_account_id='106a0000-1000-4000-8000-000000000001' and event_type='session_created'),1,'the older-evidence denial writes no creation row');

-- 4. A new login after logout supersedes nothing.
insert into identity.verification_challenge (
  verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,
  contact_method_type,purpose,delivery_channel,code_hash,expires_at,used_at
) values (
  '106a0000-2000-4000-8000-000000000002','106a0000-1000-4000-8000-000000000001',
  '106a0000-1200-4000-8000-000000000001','l6a-a1@synthetic.invalid','email','login','email',
  'svf1:2222222222222222222222222222222222222222222222222222222222222222',now()+interval '10 minutes',clock_timestamp()
);
set local role service_role;
create temp table l6a_s2 as
select * from public.solmind_create_user_session(
  '106a0000-1000-4000-8000-000000000001','admin',
  '106a0000-2000-4000-8000-000000000002','login',300
);
reset role;
select is((select outcome from l6a_s2),'created','a new login after logout creates a session');
select is((select count(*)::int from audit.audit_event where actor_user_account_id='106a0000-1000-4000-8000-000000000001' and event_type='session_superseded'),0,'the new login supersedes nothing, because logout left no active session');

-- 5. A stale browser presenting the logged-out session never ends the newer one.
create temp table l6a_state_before_stale as select pg_temp.l6a_state() as s;
set local role service_role;
select results_eq(
  $$select outcome from public.solmind_logout_user_session('106a0000-1000-4000-8000-000000000001',(select user_session_id from l6a_s1))$$,
  $$select 'already_ended'::text$$,
  'a stale browser presenting the logged-out session reports already_ended'
);
reset role;
select is(pg_temp.l6a_state(),(select s from l6a_state_before_stale),'the stale logout leaves every session row, the account''s newer active one included, and every audit row exactly as they were');

-- 6. A superseded session reports already_ended and stays revoked.
insert into identity.verification_challenge (
  verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,
  contact_method_type,purpose,delivery_channel,code_hash,expires_at,used_at
) values (
  '106a0000-2000-4000-8000-000000000003','106a0000-1000-4000-8000-000000000001',
  '106a0000-1200-4000-8000-000000000001','l6a-a1@synthetic.invalid','email','role_reentry','email',
  'svf1:3333333333333333333333333333333333333333333333333333333333333333',now()+interval '10 minutes',clock_timestamp()
);
set local role service_role;
create temp table l6a_s3 as
select * from public.solmind_create_user_session(
  '106a0000-1000-4000-8000-000000000001','guide',
  '106a0000-2000-4000-8000-000000000003','role_reentry',300
);
reset role;
select is((select outcome from l6a_s3),'created','fixture: a newer guide-role login supersedes the admin session');
select results_eq(
  $$select session_status from identity.user_session where user_session_id=(select user_session_id from l6a_s2)$$,
  $$select 'revoked'::text$$,
  'fixture: the superseded session is revoked'
);
create temp table l6a_state_before_superseded as select pg_temp.l6a_state() as s;
set local role service_role;
select results_eq(
  $$select outcome from public.solmind_logout_user_session('106a0000-1000-4000-8000-000000000001',(select user_session_id from l6a_s2))$$,
  $$select 'already_ended'::text$$,
  'a superseded session reports already_ended'
);
reset role;
select is(pg_temp.l6a_state(),(select s from l6a_state_before_superseded),'the superseded session stays revoked, the newer session is unchanged, and no row is written');

-- 7. Another account's session and unknown sessions are never ended, through one path.
insert into identity.verification_challenge (
  verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,
  contact_method_type,purpose,delivery_channel,code_hash,expires_at,used_at
) values (
  '106a0000-2000-4000-8000-000000000004','106a0000-1000-4000-8000-000000000002',
  '106a0000-1200-4000-8000-000000000002','l6a-a2@synthetic.invalid','email','login','email',
  'svf1:4444444444444444444444444444444444444444444444444444444444444444',now()+interval '10 minutes',clock_timestamp()
);
set local role service_role;
create temp table l6a_s4 as
select * from public.solmind_create_user_session(
  '106a0000-1000-4000-8000-000000000002','guide',
  '106a0000-2000-4000-8000-000000000004','login',300
);
reset role;
select is((select outcome from l6a_s4),'created','fixture: the peer account has its own active session');
create temp table l6a_state_before_cross as select pg_temp.l6a_state() as s;
set local role service_role;
select throws_ok(
  $$select * from public.solmind_logout_user_session('106a0000-1000-4000-8000-000000000001',(select user_session_id from l6a_s4))$$,
  'P0001','solmind_logout_unknown_session',
  'an account presenting another account''s active session fails closed'
);
select throws_ok(
  $$select * from public.solmind_logout_user_session('106a0000-1000-4000-8000-000000000002',(select user_session_id from l6a_s3))$$,
  'P0001','solmind_logout_unknown_session',
  'the reverse cross-account presentation fails closed the same way'
);
select throws_ok(
  $$select * from public.solmind_logout_user_session('106a0000-1000-4000-8000-000000000001','106a0000-5000-4000-8000-000000000009')$$,
  'P0001','solmind_logout_unknown_session',
  'an unknown session UUID takes the same path with the same identifier'
);
select throws_ok(
  $$select * from public.solmind_logout_user_session('106a0000-1000-4000-8000-000000000099',(select user_session_id from l6a_s3))$$,
  'P0001','solmind_logout_unknown_session',
  'an unknown account presenting a real session takes the same path'
);
reset role;
select is(pg_temp.l6a_state(),(select s from l6a_state_before_cross),'cross-account and unknown attempts change no session and write no audit row');

-- 8. A time-expired session reports already_ended without a write
--    (and the deferred DEF5-S4 expired-session exact-retry and chronology fixtures).
insert into identity.verification_challenge (
  verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,
  contact_method_type,purpose,delivery_channel,code_hash,expires_at,used_at
) values (
  '106a0000-2000-4000-8000-000000000005','106a0000-1000-4000-8000-000000000002',
  '106a0000-1200-4000-8000-000000000002','l6a-a2@synthetic.invalid','email','login','email',
  'svf1:5555555555555555555555555555555555555555555555555555555555555555',now()+interval '10 minutes',clock_timestamp()
);
set local role service_role;
create temp table l6a_s5 as
select * from public.solmind_create_user_session(
  '106a0000-1000-4000-8000-000000000002','guide',
  '106a0000-2000-4000-8000-000000000005','login',1
);
reset role;
select is((select outcome from l6a_s5),'created','fixture: a one-second session supersedes the peer''s first session');
do $$ begin perform pg_catalog.pg_sleep(1.2); end $$;
select ok((select expires_at<clock_timestamp() from identity.user_session where user_session_id=(select user_session_id from l6a_s5)),'fixture: the one-second session is now past its expiry');
create temp table l6a_state_before_expired as select pg_temp.l6a_state() as s;
set local role service_role;
select results_eq(
  $$select outcome from public.solmind_logout_user_session('106a0000-1000-4000-8000-000000000002',(select user_session_id from l6a_s5))$$,
  $$select 'already_ended'::text$$,
  'a session past its expiry reports already_ended'
);
reset role;
select is(pg_temp.l6a_state(),(select s from l6a_state_before_expired),'logout of an expired session changes no session row and writes no audit row');
set local role service_role;
select throws_ok(
  $$select * from public.solmind_create_user_session('106a0000-1000-4000-8000-000000000002','guide','106a0000-2000-4000-8000-000000000005','login',1)$$,
  'P0001','solmind_session_conflicting_retry',
  'an exact creation retry of a time-expired session is denied'
);
reset role;
insert into identity.verification_challenge (
  verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,
  contact_method_type,purpose,delivery_channel,code_hash,expires_at,used_at
) values (
  '106a0000-2000-4000-8000-000000000006','106a0000-1000-4000-8000-000000000002',
  '106a0000-1200-4000-8000-000000000002','l6a-a2@synthetic.invalid','email','role_reentry','email',
  'svf1:6666666666666666666666666666666666666666666666666666666666666666',now()+interval '10 minutes',clock_timestamp()
);
update identity.verification_challenge
   set used_at = (
     select used_at - interval '1 millisecond'
       from identity.verification_challenge
      where verification_challenge_id='106a0000-2000-4000-8000-000000000005'
   )
 where verification_challenge_id='106a0000-2000-4000-8000-000000000006';
set local role service_role;
select throws_ok(
  $$select * from public.solmind_create_user_session('106a0000-1000-4000-8000-000000000002','guide','106a0000-2000-4000-8000-000000000006','role_reentry',300)$$,
  'P0001','solmind_session_older_evidence',
  'fresh but older never-sessionized evidence cannot create a session after a newer time-expired session'
);
reset role;
select is((select count(*)::int from identity.user_session where verification_challenge_id='106a0000-2000-4000-8000-000000000006'),0,'the older evidence creates no session');

-- 9. Logout does not require the account or the role to stay active: ending a session
--    only removes access.
insert into identity.verification_challenge (
  verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,
  contact_method_type,purpose,delivery_channel,code_hash,expires_at,used_at
) values
  ('106a0000-2000-4000-8000-000000000008','106a0000-1000-4000-8000-000000000003',
   '106a0000-1200-4000-8000-000000000003','l6a-a3@synthetic.invalid','email','login','email',
   'svf1:8888888888888888888888888888888888888888888888888888888888888888',now()+interval '10 minutes',clock_timestamp()),
  ('106a0000-2000-4000-8000-000000000010','106a0000-1000-4000-8000-000000000006',
   '106a0000-1200-4000-8000-000000000006','l6a-a6@synthetic.invalid','email','login','email',
   'svf1:1010101010101010101010101010101010101010101010101010101010101010',now()+interval '10 minutes',clock_timestamp());
set local role service_role;
create temp table l6a_s8 as
select * from public.solmind_create_user_session(
  '106a0000-1000-4000-8000-000000000003','admin',
  '106a0000-2000-4000-8000-000000000008','login',300
);
create temp table l6a_s10 as
select * from public.solmind_create_user_session(
  '106a0000-1000-4000-8000-000000000006','admin',
  '106a0000-2000-4000-8000-000000000010','login',300
);
reset role;
select is((select outcome from l6a_s8),'created','fixture: a third account has an active admin session');
select is((select outcome from l6a_s10),'created','fixture: a fourth account has an active admin session');
update identity.user_account
   set account_status='suspended'
 where user_account_id='106a0000-1000-4000-8000-000000000003';
update identity.user_role_assignment
   set role_status='suspended'
 where user_role_assignment_id='106a0000-1100-4000-8000-000000000007';
set local role service_role;
select results_eq(
  $$select outcome from public.solmind_logout_user_session('106a0000-1000-4000-8000-000000000003',(select user_session_id from l6a_s8))$$,
  $$select 'ended'::text$$,
  'a suspended account''s active session still ends'
);
select results_eq(
  $$select outcome from public.solmind_logout_user_session('106a0000-1000-4000-8000-000000000006',(select user_session_id from l6a_s10))$$,
  $$select 'ended'::text$$,
  'an active session whose role is now suspended still ends'
);
reset role;
select results_eq(
  $$select session_status from identity.user_session where user_session_id in ((select user_session_id from l6a_s8),(select user_session_id from l6a_s10))$$,
  $$select 'logged_out'::text union all select 'logged_out'::text$$,
  'both sessions are logged_out'
);
select results_eq(
  $$select actor_user_account_id,actor_role_context from audit.audit_event
     where event_type='session_logged_out'
       and target_entity_id in ((select user_session_id from l6a_s8),(select user_session_id from l6a_s10))
     order by 1$$,
  $$select * from (values('106a0000-1000-4000-8000-000000000003'::uuid,'admin'::text),('106a0000-1000-4000-8000-000000000006'::uuid,'admin'::text)) as expected(a,r) order by 1$$,
  'each has its one row, attributed to the account and the session''s own role'
);

-- 10. Same transaction, and no diagnostic leaves the function: a failure before or after the
--     audit row, or in the state change, or an assertion failure, leaves neither the change nor
--     the row, and the caller sees only a fixed identifier, never the failure's own message,
--     detail or hint.
insert into identity.verification_challenge (
  verification_challenge_id,user_account_id,user_contact_method_id,normalized_contact_value,
  contact_method_type,purpose,delivery_channel,code_hash,expires_at,used_at
) values (
  '106a0000-2000-4000-8000-000000000009','106a0000-1000-4000-8000-000000000004',
  '106a0000-1200-4000-8000-000000000004','l6a-a4@synthetic.invalid','email','login','email',
  'svf1:9999999999999999999999999999999999999999999999999999999999999999',now()+interval '10 minutes',clock_timestamp()
);
set local role service_role;
create temp table l6a_s9 as
select * from public.solmind_create_user_session(
  '106a0000-1000-4000-8000-000000000004','explorer',
  '106a0000-2000-4000-8000-000000000009','login',300
);
reset role;
select is((select outcome from l6a_s9),'created','fixture: an explorer account has an active session');
create temp table l6a_state_before_failures as select pg_temp.l6a_state() as s;

create function pg_temp.l6a_reject_audit() returns trigger language plpgsql as $$
begin
  raise exception 'l6a-secret-audit-message %', new.target_entity_id
    using detail = 'l6a-secret-audit-detail', hint = 'l6a-secret-audit-hint';
end
$$;
create function pg_temp.l6a_reject_session_update() returns trigger language plpgsql as $$
begin
  raise exception 'l6a-secret-update-message %', old.user_session_id
    using detail = 'l6a-secret-update-detail', hint = 'l6a-secret-update-hint';
end
$$;
create function pg_temp.l6a_reject_session_check() returns trigger language plpgsql as $$
begin
  raise exception using errcode = 'check_violation', message = 'l6a-secret-check-message ' || old.user_session_id::text,
    detail = 'l6a-secret-check-detail', hint = 'l6a-secret-check-hint';
end
$$;
create function pg_temp.l6a_reject_audit_assert() returns trigger language plpgsql as $$
begin
  raise exception using errcode = 'assert_failure', message = 'l6a-secret-assert-message ' || new.target_entity_id::text,
    detail = 'l6a-secret-assert-detail', hint = 'l6a-secret-assert-hint';
end
$$;

create trigger l6a_reject_audit_before before insert on audit.audit_event for each row execute function pg_temp.l6a_reject_audit();
set local role service_role;
create temp table l6a_failure_before_audit as
select * from pg_temp.l6a_capture('106a0000-1000-4000-8000-000000000004',(select user_session_id from l6a_s9));
reset role;
drop trigger l6a_reject_audit_before on audit.audit_event;

create trigger l6a_reject_audit_after after insert on audit.audit_event for each row execute function pg_temp.l6a_reject_audit();
set local role service_role;
create temp table l6a_failure_after_audit as
select * from pg_temp.l6a_capture('106a0000-1000-4000-8000-000000000004',(select user_session_id from l6a_s9));
reset role;
drop trigger l6a_reject_audit_after on audit.audit_event;

create trigger l6a_reject_session_update before update on identity.user_session for each row execute function pg_temp.l6a_reject_session_update();
set local role service_role;
create temp table l6a_failure_update as
select * from pg_temp.l6a_capture('106a0000-1000-4000-8000-000000000004',(select user_session_id from l6a_s9));
reset role;
drop trigger l6a_reject_session_update on identity.user_session;

create trigger l6a_reject_session_check before update on identity.user_session for each row execute function pg_temp.l6a_reject_session_check();
set local role service_role;
create temp table l6a_failure_check as
select * from pg_temp.l6a_capture('106a0000-1000-4000-8000-000000000004',(select user_session_id from l6a_s9));
reset role;
drop trigger l6a_reject_session_check on identity.user_session;

create trigger l6a_reject_audit_assert before insert on audit.audit_event for each row execute function pg_temp.l6a_reject_audit_assert();
set local role service_role;
create temp table l6a_failure_assert as
select * from pg_temp.l6a_capture('106a0000-1000-4000-8000-000000000004',(select user_session_id from l6a_s9));
reset role;
drop trigger l6a_reject_audit_assert on audit.audit_event;

select results_eq(
  $$select error_code,error_message,error_detail,error_hint from l6a_failure_before_audit$$,
  $$select 'P0001'::text,'solmind_logout_failed'::text,''::text,''::text$$,
  'a failed audit insertion reaches the caller only as solmind_logout_failed, with no detail or hint'
);
select results_eq(
  $$select error_code,error_message,error_detail,error_hint from l6a_failure_after_audit$$,
  $$select 'P0001'::text,'solmind_logout_failed'::text,''::text,''::text$$,
  'a failure raised after the audit row is inserted reaches the caller only as solmind_logout_failed'
);
select results_eq(
  $$select error_code,error_message,error_detail,error_hint from l6a_failure_update$$,
  $$select 'P0001'::text,'solmind_logout_failed'::text,''::text,''::text$$,
  'a failed state change reaches the caller only as solmind_logout_failed'
);
select results_eq(
  $$select error_code,error_message,error_detail,error_hint from l6a_failure_check$$,
  $$select 'P0001'::text,'solmind_logout_integrity_failure'::text,''::text,''::text$$,
  'an integrity failure in the state change reaches the caller only as solmind_logout_integrity_failure'
);
select results_eq(
  $$select error_code,error_message,error_detail,error_hint from l6a_failure_assert$$,
  $$select 'P0001'::text,'solmind_logout_failed'::text,''::text,''::text$$,
  'an assertion failure (P0004) during the audit insert reaches the caller only as solmind_logout_failed, with no detail or hint'
);
select is(
  (select count(*)::int from (
     select error_message||error_detail||error_hint||error_context as t from l6a_failure_before_audit
     union all select error_message||error_detail||error_hint||error_context from l6a_failure_after_audit
     union all select error_message||error_detail||error_hint||error_context from l6a_failure_update
     union all select error_message||error_detail||error_hint||error_context from l6a_failure_check
     union all select error_message||error_detail||error_hint||error_context from l6a_failure_assert
   ) failures
   where t like '%l6a-secret%' or t like '%' || (select user_session_id::text from l6a_s9) || '%'),
  0,
  'no failure message, detail, hint, or context carries the underlying text or the session UUID'
);
select is(pg_temp.l6a_state(),(select s from l6a_state_before_failures),'all five failures leave every session row and every audit row exactly as they were');

set local role service_role;
select results_eq(
  $$select outcome from public.solmind_logout_user_session('106a0000-1000-4000-8000-000000000004',(select user_session_id from l6a_s9))$$,
  $$select 'ended'::text$$,
  'after the induced failures are removed, the same logout ends the session'
);
reset role;
select results_eq(
  $$select actor_user_account_id,actor_role_context,target_entity_id from audit.audit_event where event_type='session_logged_out' and target_entity_id=(select user_session_id from l6a_s9)$$,
  $$select '106a0000-1000-4000-8000-000000000004'::uuid,'explorer'::text,user_session_id from l6a_s9$$,
  'the explorer logout row carries the explorer role of the ended session'
);

-- 11. The role on the row is the ended session's own role.
set local role service_role;
select results_eq(
  $$select outcome from public.solmind_logout_user_session('106a0000-1000-4000-8000-000000000001',(select user_session_id from l6a_s3))$$,
  $$select 'ended'::text$$,
  'the account''s guide-role session ends'
);
reset role;
select results_eq(
  $$select actor_user_account_id,actor_role_context from audit.audit_event where event_type='session_logged_out' and target_entity_id=(select user_session_id from l6a_s3)$$,
  $$select '106a0000-1000-4000-8000-000000000001'::uuid,'guide'::text$$,
  'the row for a guide-role session of an admin-and-guide account names guide'
);

-- 12. Cardinality, shape, privacy, and the untouched bystander.
select results_eq(
  $$select target_entity_id,actor_role_context from audit.audit_event
     where event_type='session_logged_out' and actor_user_account_id::text like '106a0000-%'
     order by 1$$,
  $$select user_session_id,role from (
      select user_session_id,'admin'::text as role from l6a_s1
      union all select user_session_id,'guide'::text from l6a_s3
      union all select user_session_id,'admin'::text from l6a_s8
      union all select user_session_id,'explorer'::text from l6a_s9
      union all select user_session_id,'admin'::text from l6a_s10
    ) expected order by 1$$,
  'exactly one logout row exists for each of the five ended sessions and none for any other'
);
select is(
  (select count(*)::int from audit.audit_event
    where event_type='session_logged_out'
      and actor_user_account_id::text like '106a0000-%'
      and (action<>'end' or reason_code<>'user_logout' or target_entity_type<>'user_session'
           or event_summary<>'User session ended by logout.' or metadata<>'{}'::jsonb
           or ip_address is not null or user_agent is not null)),
  0,
  'every logout row has the exact fixed shape'
);
select is(
  (select count(*)::int from audit.audit_event
    where event_type='session_logged_out'
      and (to_jsonb(audit_event)::text like '%synthetic.invalid%'
           or to_jsonb(audit_event)::text like '%svf1:%'
           or to_jsonb(audit_event)::text like '%106a0000-2000-%')),
  0,
  'logout rows carry no contact value, verifier, or challenge UUID'
);
select results_eq(
  $$select * from identity.user_session where user_session_id=(select user_session_id from l6a_sb)$$,
  $$select * from l6a_sb_before$$,
  'the bystander''s active session is exactly as it was before the first logout'
);
select results_eq(
  $$select session_status,count(*)::int from identity.user_session where user_account_id::text like '106a0000-%' group by session_status order by session_status$$,
  $$select * from (values('active'::text,2),('logged_out'::text,5),('revoked'::text,2)) as expected(session_status,row_count)$$,
  'the final session states are exactly as the steps above made them (the bystander and the expired one-second session keep their stored active status)'
);

select * from finish();
rollback;
