-- SolMind MVP0 login step 6a: dormant user-session logout writer.
-- Source contract: execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md
-- Section 9 (accepted as AUTH-RLS-DEC-043); audit vocabulary in
-- execution/22_SolMind_MVP0_Auth_RLS_Audit_Persistence_Contract_v0_1.md Sections 8.1 and 10.
-- Purpose:
--   - given the server-derived account and the presented session UUID, change that session to
--     logged_out with ended_at only when it is the account's active, unexpired session;
--   - write exactly one Family B session_logged_out audit row in the same transaction;
--   - decide expiry with one database clock read after the account lock and the presented
--     row's lock are both held;
--   - report ended or already_ended, and fail closed with a fixed value-free identifier
--     otherwise: every error raised while its body runs leaves as one fixed identifier, with
--     no underlying message, detail or hint (errors outside the body, such as a refused call,
--     a malformed argument or a terminated session, are outside this promise);
--   - never end, read for change, or audit any session other than the one presented.
-- EXECUTE is granted to service_role only: anon and authenticated execution is denied, and
-- service-role RPC execution through the Data API (PostgREST serves the public schema) stays
-- available, as for public.solmind_create_user_session.
-- Adds no table, index, policy, table/schema grant, evidence read, caller, route, cookie,
-- Supabase sign-out, provider action, cloud path, deployment, or real-user flow.

begin;

create function public.solmind_logout_user_session(
  p_user_account_id uuid,
  p_user_session_id uuid
)
returns table (outcome text)
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '2000ms'
as $$
declare
  v_now timestamptz;
  v_account_lock_key bigint;
  v_session identity.user_session%rowtype;
  v_changed_count integer;
  v_outcome text;
begin
  if p_user_account_id is null then
    raise exception 'solmind_logout_invalid_account';
  end if;
  if p_user_session_id is null then
    raise exception 'solmind_logout_invalid_session';
  end if;

  -- The same shared account-domain key that session creation takes after its evidence key.
  -- Logout holds no evidence key and takes only this one key, so it cannot invert the
  -- evidence-first order. It serializes logout with login supersession for the account.
  v_account_lock_key := pg_catalog.hashtextextended(
    'solmind:authorizing-domain:account:v1|' || p_user_account_id::text,
    0
  );

  -- Every failure raised inside this block leaves the function as one fixed identifier
  -- chosen by its handlers, and nothing of the underlying error is passed on. OTHERS does
  -- not cover assert_failure (nor query_canceled), so both are named. The function's own
  -- outcomes are only recorded here and acted on after the block.
  begin
    perform pg_catalog.pg_advisory_xact_lock(v_account_lock_key);

    -- Only the presented session of this account is read. An unknown session UUID and
    -- another account's session take one path, with one identifier and no write.
    select session.*
      into v_session
      from identity.user_session session
     where session.user_session_id = p_user_session_id
       and session.user_account_id = p_user_account_id
       for update;

    if not found then
      v_outcome := 'unknown_session';
    else
      -- The single decision clock, read once both locks are held, so a session that
      -- reaches its expiry while this call waits for either lock is not ended.
      v_now := pg_catalog.clock_timestamp();

      -- Revoked, logged_out, expired, or active but past its expiry: not the account's
      -- active session. A repeated or stale logout changes nothing and writes no row.
      if v_session.session_status <> 'active'
         or v_session.expires_at <= v_now then
        v_outcome := 'already_ended';
      else
        update identity.user_session session
           set session_status = 'logged_out',
               ended_at = v_now
         where session.user_session_id = p_user_session_id
           and session.user_account_id = p_user_account_id
           and session.session_status = 'active';
        get diagnostics v_changed_count = row_count;

        if v_changed_count = 1 then
          insert into audit.audit_event (
            event_type, actor_user_account_id, actor_role_context, target_entity_type,
            target_entity_id, action, reason_code, event_summary, metadata
          ) values (
            'session_logged_out', p_user_account_id, v_session.active_role_context, 'user_session',
            p_user_session_id, 'end', 'user_logout',
            'User session ended by logout.',
            '{}'::jsonb
          );
          v_outcome := 'ended';
        else
          v_outcome := 'cardinality_violation';
        end if;
      end if;
    end if;
  exception
    when lock_not_available or query_canceled or deadlock_detected or serialization_failure then
      raise exception 'solmind_logout_lock_unavailable';
    when unique_violation or foreign_key_violation or check_violation or not_null_violation then
      raise exception 'solmind_logout_integrity_failure';
    when assert_failure then
      raise exception 'solmind_logout_failed';
    when others then
      raise exception 'solmind_logout_failed';
  end;

  if v_outcome = 'unknown_session' then
    raise exception 'solmind_logout_unknown_session';
  elsif v_outcome = 'cardinality_violation' then
    raise exception 'solmind_logout_cardinality_violation';
  elsif v_outcome in ('ended', 'already_ended') then
    return query select v_outcome;
  else
    raise exception 'solmind_logout_failed';
  end if;
end;
$$;

alter function public.solmind_logout_user_session(uuid, uuid)
  owner to postgres;

revoke all on function public.solmind_logout_user_session(uuid, uuid)
  from public;
revoke execute on function public.solmind_logout_user_session(uuid, uuid)
  from anon, authenticated;
grant execute on function public.solmind_logout_user_session(uuid, uuid)
  to service_role;

comment on function public.solmind_logout_user_session(uuid, uuid) is
  'Login step 6a dormant server-only logout writer. Given the server-derived account and the presented session UUID, it takes the shared account-domain lock and the presented row''s lock, reads one database clock, changes that session to logged_out with that ended_at only when it is the account''s active unexpired session, and embeds exactly one Family B session_logged_out row in the same transaction. A non-active session of the account returns already_ended without a write; an unknown or other-account session fails closed without a write; every other error raised while its body runs leaves as one fixed value-free identifier. It never changes another session and reads no evidence. EXECUTE is service_role-only: anon and authenticated execution is denied, and service-role RPC execution stays available. No route, caller, cookie, Supabase sign-out, provider action, cloud path, or real-user path is authorized.';

commit;
