-- P27-C real-function concurrency proofs. Local ephemeral database only.
-- A hard SQL error can leave reserved synthetic rows. Recovery requires Paul's
-- explicit approval and must use the narrow synthetic UUID/contact namespace
-- below. Never run recovery cleanup against hosted or real-user data.

begin;
create extension if not exists dblink;
select plan(102);

create function pg_temp.p27c_wait_for_advisory_lock(
  p_connection text,
  p_pid integer
)
returns boolean
language plpgsql
as $$
begin
  for attempt in 1..30 loop
    if dblink_is_busy(p_connection) = 1
       and exists (
         select 1
           from pg_catalog.pg_stat_activity
          where pid = p_pid
            and wait_event_type = 'Lock'
            and wait_event = 'advisory'
       ) then
      return true;
    end if;
    perform pg_catalog.pg_sleep(0.05);
  end loop;
  return false;
end;
$$;

create function pg_temp.p27c_wait_for_any_lock(
  p_connection text,
  p_pid integer
)
returns boolean
language plpgsql
as $$
begin
  for attempt in 1..20 loop
    if dblink_is_busy(p_connection) = 1
       and exists (
         select 1
           from pg_catalog.pg_stat_activity
          where pid = p_pid
            and wait_event_type = 'Lock'
       ) then
      return true;
    end if;
    perform pg_catalog.pg_sleep(0.05);
  end loop;
  return false;
end;
$$;

select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_invite invitation
     where invitation.guide_invite_id::text like '270cc027-%'
  ),
  0,
  'preflight finds no P27-C concurrency invitation residue'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.verification_challenge challenge
     where challenge.verification_challenge_id::text like '270cc027-%'
  ),
  0,
  'preflight finds no P27-C concurrency challenge residue'
);

select lives_ok(
  $$select dblink_connect(
    'p27c_a',
    'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres connect_timeout=5'
  )$$,
  'connection A opens'
);
select lives_ok(
  $$select dblink_connect(
    'p27c_b',
    'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres connect_timeout=5'
  )$$,
  'connection B opens'
);
select is(
  dblink_exec('p27c_a', 'set statement_timeout=''8s'''),
  'SET',
  'connection A statement timeout is bounded'
);
select is(
  dblink_exec('p27c_b', 'set statement_timeout=''8s'''),
  'SET',
  'connection B statement timeout is bounded'
);

create temporary table p27c_pids (
  connection_name text primary key,
  pid integer
) on commit drop;
insert into p27c_pids
select 'a', pid
  from dblink('p27c_a', 'select pg_backend_pid()') result(pid integer)
union all
select 'b', pid
  from dblink('p27c_b', 'select pg_backend_pid()') result(pid integer);
select is(
  (
    select pg_catalog.count(distinct pid)::integer
      from (
        select pg_backend_pid() as pid
        union all
        select pid from p27c_pids
      ) sessions
  ),
  3,
  'orchestrator and both dblink workers are distinct sessions'
);

select lives_ok(
  $setup_call$
    select dblink_exec(
      'p27c_a',
      $setup$
        insert into identity.user_account (
          user_account_id, display_name, account_status
        ) values
        (
          '270cc027-0000-4000-8000-000000000001',
          'P27-C concurrency Admin',
          'active'
        ),
        (
          '270cc027-0000-4000-8000-000000000002',
          'P27-C Session Account',
          'active'
        ),
        (
          '270cc027-0000-4000-8000-000000000003',
          'P27-C Acceptance Account',
          'active'
        ),
        (
          '270cc027-0000-4000-8000-000000000004',
          'P27-C Helper Timeout Account',
          'active'
        );

        insert into identity.user_role_assignment (
          user_role_assignment_id,
          user_account_id,
          role_code,
          role_status
        ) values (
          '270cc027-0100-4000-8000-000000000002',
          '270cc027-0000-4000-8000-000000000002',
          'explorer',
          'active'
        ), (
          '270cc027-0100-4000-8000-000000000003',
          '270cc027-0000-4000-8000-000000000003',
          'explorer',
          'active'
        ), (
          '270cc027-0100-4000-8000-000000000004',
          '270cc027-0000-4000-8000-000000000004',
          'explorer',
          'active'
        );

        insert into identity.user_contact_method (
          user_contact_method_id,
          user_account_id,
          contact_method_type,
          contact_label,
          contact_value,
          normalized_contact_value,
          login_enabled,
          is_verified,
          verified_at,
          verification_method,
          status
        ) values (
          '270cc027-0200-4000-8000-000000000002',
          '270cc027-0000-4000-8000-000000000002',
          'email',
          'primary',
          'p27c-session@synthetic.invalid',
          'p27c-session@synthetic.invalid',
          true,
          true,
          now(),
          'p27c_concurrency_fixture',
          'active'
        ), (
          '270cc027-0200-4000-8000-000000000003',
          '270cc027-0000-4000-8000-000000000003',
          'email',
          'primary',
          'p27c-acceptance@synthetic.invalid',
          'p27c-acceptance@synthetic.invalid',
          true,
          true,
          now(),
          'p27c_concurrency_fixture',
          'active'
        ), (
          '270cc027-0200-4000-8000-000000000004',
          '270cc027-0000-4000-8000-000000000004',
          'email',
          'primary',
          'p27c-helper-timeout@synthetic.invalid',
          'p27c-helper-timeout@synthetic.invalid',
          true,
          true,
          now(),
          'p27c_concurrency_fixture',
          'active'
        );

        insert into identity.auth_provider_identity (
          auth_provider_identity_id,
          user_account_id,
          provider_name,
          provider_user_id,
          provider_email,
          status
        ) values (
          '270cc027-0300-4000-8000-000000000002',
          '270cc027-0000-4000-8000-000000000002',
          'supabase',
          'p27c-provider-session',
          'p27c-session@synthetic.invalid',
          'active'
        ), (
          '270cc027-0300-4000-8000-000000000003',
          '270cc027-0000-4000-8000-000000000003',
          'supabase',
          'p27c-provider-acceptance',
          'p27c-acceptance@synthetic.invalid',
          'active'
        ), (
          '270cc027-0300-4000-8000-000000000004',
          '270cc027-0000-4000-8000-000000000004',
          'supabase',
          'p27c-provider-helper-timeout',
          'p27c-helper-timeout@synthetic.invalid',
          'active'
        );

        insert into core.guide_invite (
          guide_invite_id,
          invited_contact_value,
          normalized_contact_value,
          contact_method_type,
          invited_name,
          invited_by_user_account_id,
          invite_status,
          expires_at
        ) values
        (
          '270cc027-1000-4000-8000-000000000001',
          'p27c-race-1@synthetic.invalid',
          'p27c-race-1@synthetic.invalid',
          'email',
          'P27-C Race Guide',
          '270cc027-0000-4000-8000-000000000001',
          'created',
          clock_timestamp() + interval '24 hours'
        ),
        (
          '270cc027-1000-4000-8000-000000000002',
          'p27c-timeout@synthetic.invalid',
          'p27c-timeout@synthetic.invalid',
          'email',
          'P27-C Timeout Guide',
          '270cc027-0000-4000-8000-000000000001',
          'created',
          clock_timestamp() + interval '24 hours'
        ),
        (
          '270cc027-1000-4000-8000-000000000003',
          'p27c-session@synthetic.invalid',
          'p27c-session@synthetic.invalid',
          'email',
          'P27-C Session Guide',
          '270cc027-0000-4000-8000-000000000001',
          'created',
          clock_timestamp() + interval '24 hours'
        ),
        (
          '270cc027-1000-4000-8000-000000000004',
          'p27c-acceptance@synthetic.invalid',
          'p27c-acceptance@synthetic.invalid',
          'email',
          'P27-C Acceptance Guide',
          '270cc027-0000-4000-8000-000000000001',
          'created',
          clock_timestamp() + interval '24 hours'
        ),
        (
          '270cc027-1000-4000-8000-000000000005',
          'p27c-prepare@synthetic.invalid',
          'p27c-prepare@synthetic.invalid',
          'email',
          'P27-C Preparation Guide',
          '270cc027-0000-4000-8000-000000000001',
          'created',
          clock_timestamp() + interval '24 hours'
        ),
        (
          '270cc027-1000-4000-8000-000000000006',
          'p27c-prepare-first@synthetic.invalid',
          'p27c-prepare-first@synthetic.invalid',
          'email',
          'P27-C Preparation First Guide',
          '270cc027-0000-4000-8000-000000000001',
          'created',
          clock_timestamp() + interval '24 hours'
        ),
        (
          '270cc027-1000-4000-8000-000000000007',
          'p27c-helper-timeout@synthetic.invalid',
          'p27c-helper-timeout@synthetic.invalid',
          'email',
          'P27-C Helper Timeout Guide',
          '270cc027-0000-4000-8000-000000000001',
          'created',
          clock_timestamp() + interval '24 hours'
        );

        insert into identity.verification_challenge (
          verification_challenge_id,
          user_account_id,
          user_contact_method_id,
          normalized_contact_value,
          contact_method_type,
          purpose,
          delivery_channel,
          expires_at,
          used_at
        ) values
        (
          '270cc027-2000-4000-8000-000000000001',
          null,
          null,
          'p27c-race-1@synthetic.invalid',
          'email',
          'contact_verify',
          'email',
          clock_timestamp() + interval '10 minutes',
          clock_timestamp()
        ),
        (
          '270cc027-2000-4000-8000-000000000002',
          null,
          null,
          'p27c-timeout@synthetic.invalid',
          'email',
          'contact_verify',
          'email',
          clock_timestamp() + interval '10 minutes',
          clock_timestamp()
        ),
        (
          '270cc027-2000-4000-8000-000000000003',
          '270cc027-0000-4000-8000-000000000002',
          '270cc027-0200-4000-8000-000000000002',
          'p27c-session@synthetic.invalid',
          'email',
          'login',
          'email',
          clock_timestamp() + interval '10 minutes',
          clock_timestamp()
        ),
        (
          '270cc027-2000-4000-8000-000000000004',
          '270cc027-0000-4000-8000-000000000003',
          '270cc027-0200-4000-8000-000000000003',
          'p27c-acceptance@synthetic.invalid',
          'email',
          'login',
          'email',
          clock_timestamp() + interval '10 minutes',
          clock_timestamp()
        ),
        (
          '270cc027-2000-4000-8000-000000000005',
          null,
          null,
          'p27c-prepare@synthetic.invalid',
          'email',
          'contact_verify',
          'email',
          clock_timestamp() + interval '10 minutes',
          clock_timestamp()
        ),
        (
          '270cc027-2000-4000-8000-000000000006',
          null,
          null,
          'p27c-prepare-first@synthetic.invalid',
          'email',
          'contact_verify',
          'email',
          clock_timestamp() + interval '10 minutes',
          clock_timestamp()
        ),
        (
          '270cc027-2000-4000-8000-000000000007',
          '270cc027-0000-4000-8000-000000000004',
          '270cc027-0200-4000-8000-000000000004',
          'p27c-helper-timeout@synthetic.invalid',
          'email',
          'login',
          'email',
          clock_timestamp() + interval '10 minutes',
          clock_timestamp()
        );

        insert into identity.auth_provider_provisioning_reservation (
          provisioning_reservation_id,
          guide_invite_id,
          provider_name,
          created_at,
          expires_at,
          retention_class
        ) values
        (
          '270cc027-3000-4000-8000-000000000001',
          '270cc027-1000-4000-8000-000000000001',
          'supabase',
          now(),
          now() + interval '24 hours',
          'security_log'
        ),
        (
          '270cc027-3000-4000-8000-000000000002',
          '270cc027-1000-4000-8000-000000000002',
          'supabase',
          now(),
          now() + interval '24 hours',
          'security_log'
        ),
        (
          '270cc027-3000-4000-8000-000000000003',
          '270cc027-1000-4000-8000-000000000003',
          'supabase',
          now(),
          now() + interval '24 hours',
          'security_log'
        ),
        (
          '270cc027-3000-4000-8000-000000000004',
          '270cc027-1000-4000-8000-000000000004',
          'supabase',
          now(),
          now() + interval '24 hours',
          'security_log'
        ),
        (
          '270cc027-3000-4000-8000-000000000005',
          '270cc027-1000-4000-8000-000000000005',
          'supabase',
          now(),
          now() + interval '24 hours',
          'security_log'
        ),
        (
          '270cc027-3000-4000-8000-000000000006',
          '270cc027-1000-4000-8000-000000000006',
          'supabase',
          now(),
          now() + interval '24 hours',
          'security_log'
        ),
        (
          '270cc027-3000-4000-8000-000000000007',
          '270cc027-1000-4000-8000-000000000007',
          'supabase',
          now(),
          now() + interval '24 hours',
          'security_log'
        )
      $setup$
    )
  $setup_call$,
  'synthetic concurrency fixtures commit through connection A'
);

select is(
  dblink_exec('p27c_a', 'set role service_role'),
  'SET',
  'connection A assumes service_role'
);
select is(
  dblink_exec('p27c_b', 'set role service_role'),
  'SET',
  'connection B assumes service_role'
);

-- C1: two calls for the same target/evidence serialize. The first commits
-- acceptance; the second returns exact writeless recovery.
select is(
  dblink_exec('p27c_a', 'begin'),
  'BEGIN',
  'A begins same-target race'
);
create temporary table p27c_a_accept as
select *
  from dblink(
    'p27c_a',
    $query$
      select *
        from public.solmind_accept_guide_invitation(
          '270cc027-1000-4000-8000-000000000001',
          '270cc027-2000-4000-8000-000000000001',
          '270cc027-3000-4000-8000-000000000001',
          'p27c-provider-race-1',
          'p27c-race-1@synthetic.invalid'
        )
    $query$
  ) result(outcome text, user_account_id uuid, guide_profile_id uuid);
select is(
  (select outcome from p27c_a_accept),
  'accepted',
  'A completes first-time acceptance inside its open transaction'
);
select is(
  dblink_send_query(
    'p27c_b',
    $query$
      select *
        from public.solmind_accept_guide_invitation(
          '270cc027-1000-4000-8000-000000000001',
          '270cc027-2000-4000-8000-000000000001',
          '270cc027-3000-4000-8000-000000000001',
          'p27c-provider-race-1',
          'p27c-race-1@synthetic.invalid'
        )
    $query$
  ),
  1,
  'B launches the same acceptance asynchronously'
);
select ok(
  pg_temp.p27c_wait_for_advisory_lock(
    'p27c_b',
    (select pid from p27c_pids where connection_name = 'b')
  ),
  'B waits on the shared evidence advisory lock'
);
select is(
  dblink_exec('p27c_a', 'commit'),
  'COMMIT',
  'A commits the winning acceptance'
);
create temporary table p27c_b_recovery as
select *
  from dblink_get_result('p27c_b')
    result(outcome text, user_account_id uuid, guide_profile_id uuid);
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('p27c_b')
        result(outcome text, user_account_id uuid, guide_profile_id uuid)
  ),
  0,
  'B asynchronous result stream is fully drained'
);
select is(
  (select outcome from p27c_b_recovery),
  'existing',
  'B returns exact committed-response recovery'
);
select is(
  (select user_account_id from p27c_b_recovery),
  (select user_account_id from p27c_a_accept),
  'both callers receive the same account'
);
select is(
  (select guide_profile_id from p27c_b_recovery),
  (select guide_profile_id from p27c_a_accept),
  'both callers receive the same Guide profile'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id =
       '270cc027-2000-4000-8000-000000000001'
       and consumption.consumer_type = 'guide_invitation_acceptance'
       and consumption.consumer_record_id =
         '270cc027-1000-4000-8000-000000000001'
  ),
  1,
  'same-target race commits one Guide evidence consumption'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.auth_provider_identity provider_identity
     where provider_identity.provider_name = 'supabase'
       and provider_identity.provider_user_id = 'p27c-provider-race-1'
       and provider_identity.status = 'active'
  ),
  1,
  'same-target race commits one provider binding'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.actor_user_account_id =
       (select user_account_id from p27c_a_accept)
       and event.reason_code = 'invitation_accepted'
  ),
  6,
  'same-target race writes the first-time audit set exactly once'
);

-- C5: the banked session creator and Guide acceptance compete through the
-- same P27-A evidence lock/backstop. This schedule commits the session first.
select is(
  dblink_exec('p27c_a', 'begin'),
  'BEGIN',
  'A begins session-versus-Guide-acceptance race'
);
create temporary table p27c_a_session as
select *
  from dblink(
    'p27c_a',
    $query$
      select *
        from public.solmind_create_user_session(
          '270cc027-0000-4000-8000-000000000002',
          'explorer',
          '270cc027-2000-4000-8000-000000000003',
          'login',
          900
        )
    $query$
  ) result(outcome text, user_session_id uuid, expires_at timestamptz);
select is(
  (select outcome from p27c_a_session),
  'created',
  'A creates the competing Explorer session inside its open transaction'
);
select is(
  dblink_send_query(
    'p27c_b',
    $query$
      select *
        from public.solmind_accept_guide_invitation(
          '270cc027-1000-4000-8000-000000000003',
          '270cc027-2000-4000-8000-000000000003',
          '270cc027-3000-4000-8000-000000000003',
          'p27c-provider-session',
          'p27c-session@synthetic.invalid'
        )
    $query$
  ),
  1,
  'B launches Guide acceptance against the same evidence'
);
select ok(
  pg_temp.p27c_wait_for_advisory_lock(
    'p27c_b',
    (select pid from p27c_pids where connection_name = 'b')
  ),
  'Guide acceptance waits on the session-owned evidence lock'
);
select is(
  dblink_exec('p27c_a', 'commit'),
  'COMMIT',
  'A commits the winning session consumer'
);
select throws_ok(
  $drain_error$
    select *
      from dblink_get_result('p27c_b')
        result(outcome text, user_account_id uuid, guide_profile_id uuid)
  $drain_error$,
  'P0001',
  'solmind_guide_accept_evidence_consumed',
  'losing Guide acceptance receives the fixed consumed-evidence error'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('p27c_b')
        result(outcome text, user_account_id uuid, guide_profile_id uuid)
  ),
  0,
  'failed asynchronous Guide-acceptance result stream is fully drained'
);
select is(
  (
    select consumption.consumer_type
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id =
       '270cc027-2000-4000-8000-000000000003'
  ),
  'user_session',
  'shared evidence backstop records the session as the winner'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_session session
     where session.user_session_id =
       (select user_session_id from p27c_a_session)
       and session.session_status = 'active'
  ),
  1,
  'winning session exists exactly once'
);
select is(
  (
    select invitation.invite_status
      from core.guide_invite invitation
     where invitation.guide_invite_id =
       '270cc027-1000-4000-8000-000000000003'
  ),
  'created',
  'losing Guide acceptance leaves its invitation open'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_profile profile
     where profile.user_account_id =
       '270cc027-0000-4000-8000-000000000002'
  ),
  0,
  'losing Guide acceptance creates no Guide profile'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.target_entity_id =
       '270cc027-1000-4000-8000-000000000003'
       and event.event_type = 'invite_accepted'
  ),
  0,
  'losing Guide acceptance writes no invitation audit'
);

-- C5 reverse schedule: Guide acceptance commits the shared evidence first.
-- The banked session creator then observes the Guide consumption and fails
-- without creating a session.
select is(
  dblink_exec('p27c_a', 'begin'),
  'BEGIN',
  'A begins Guide-acceptance-versus-session race'
);
create temporary table p27c_a_guide_accept as
select *
  from dblink(
    'p27c_a',
    $query$
      select *
        from public.solmind_accept_guide_invitation(
          '270cc027-1000-4000-8000-000000000004',
          '270cc027-2000-4000-8000-000000000004',
          '270cc027-3000-4000-8000-000000000004',
          'p27c-provider-acceptance',
          'p27c-acceptance@synthetic.invalid'
        )
    $query$
  ) result(outcome text, user_account_id uuid, guide_profile_id uuid);
select is(
  (select outcome from p27c_a_guide_accept),
  'accepted',
  'A accepts the Guide invitation inside its open transaction'
);
select is(
  dblink_send_query(
    'p27c_b',
    $query$
      select *
        from public.solmind_create_user_session(
          '270cc027-0000-4000-8000-000000000003',
          'guide',
          '270cc027-2000-4000-8000-000000000004',
          'login',
          900
        )
    $query$
  ),
  1,
  'B launches session creation against the same evidence'
);
select ok(
  pg_temp.p27c_wait_for_advisory_lock(
    'p27c_b',
    (select pid from p27c_pids where connection_name = 'b')
  ),
  'session creation waits on the Guide-acceptance evidence lock'
);
select is(
  dblink_exec('p27c_a', 'commit'),
  'COMMIT',
  'A commits the winning Guide acceptance'
);
select throws_ok(
  $drain_error$
    select *
      from dblink_get_result('p27c_b')
        result(outcome text, user_session_id uuid, expires_at timestamptz)
  $drain_error$,
  'P0001',
  'solmind_session_evidence_consumed',
  'losing session creation receives the banked consumed-evidence error'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('p27c_b')
        result(outcome text, user_session_id uuid, expires_at timestamptz)
  ),
  0,
  'failed asynchronous session result stream is fully drained'
);
select is(
  (
    select consumption.consumer_type
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id =
       '270cc027-2000-4000-8000-000000000004'
  ),
  'guide_invitation_acceptance',
  'shared evidence backstop records Guide acceptance as the winner'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_session session
     where session.user_account_id =
       '270cc027-0000-4000-8000-000000000003'
  ),
  0,
  'losing session creation writes no session'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_role_assignment assignment
     where assignment.user_account_id =
       '270cc027-0000-4000-8000-000000000003'
       and assignment.role_code = 'guide'
       and assignment.role_status = 'active'
       and assignment.revoked_at is null
  ),
  1,
  'winning acceptance adds one active Guide role'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_profile profile
     where profile.user_account_id =
       '270cc027-0000-4000-8000-000000000003'
  ),
  1,
  'winning acceptance adds one Guide profile'
);
select is(
  (
    select invitation.invite_status
      from core.guide_invite invitation
     where invitation.guide_invite_id =
       '270cc027-1000-4000-8000-000000000004'
  ),
  'accepted',
  'winning Guide invitation is accepted'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.actor_user_account_id =
       '270cc027-0000-4000-8000-000000000003'
       and event.reason_code = 'invitation_accepted'
  ),
  3,
  'existing-identity Guide acceptance writes its exact three-row audit set'
);

-- C6: P27-B preparation and P27-C acceptance share the same evidence-first
-- protocol. Acceptance commits first; a concurrent preparation retry waits,
-- then fails on the durable P27-A consumption backstop.
select is(
  dblink_exec('p27c_a', 'begin'),
  'BEGIN',
  'A begins acceptance-versus-preparation race'
);
create temporary table p27c_a_prepare_race_accept as
select *
  from dblink(
    'p27c_a',
    $query$
      select *
        from public.solmind_accept_guide_invitation(
          '270cc027-1000-4000-8000-000000000005',
          '270cc027-2000-4000-8000-000000000005',
          '270cc027-3000-4000-8000-000000000005',
          'p27c-provider-prepare',
          'p27c-prepare@synthetic.invalid'
        )
    $query$
  ) result(outcome text, user_account_id uuid, guide_profile_id uuid);
select is(
  (select outcome from p27c_a_prepare_race_accept),
  'accepted',
  'A accepts the invitation inside its open transaction'
);
select is(
  dblink_send_query(
    'p27c_b',
    $query$
      select *
        from public.solmind_prepare_guide_invitation_acceptance(
          '270cc027-1000-4000-8000-000000000005',
          '270cc027-2000-4000-8000-000000000005',
          'p27c-prepare@synthetic.invalid'
        )
    $query$
  ),
  1,
  'B launches P27-B preparation against the same evidence'
);
select ok(
  pg_temp.p27c_wait_for_advisory_lock(
    'p27c_b',
    (select pid from p27c_pids where connection_name = 'b')
  ),
  'preparation waits on the acceptance-owned evidence lock'
);
select is(
  dblink_exec('p27c_a', 'commit'),
  'COMMIT',
  'A commits the winning Guide acceptance'
);
select throws_ok(
  $drain_error$
    select *
      from dblink_get_result('p27c_b')
        result(outcome text, provisioning_reservation_id uuid)
  $drain_error$,
  'P0001',
  'solmind_invitation_prepare_evidence_consumed',
  'losing preparation receives the banked consumed-evidence error'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('p27c_b')
        result(outcome text, provisioning_reservation_id uuid)
  ),
  0,
  'failed asynchronous preparation result stream is fully drained'
);
select is(
  (
    select consumption.consumer_type
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id =
       '270cc027-2000-4000-8000-000000000005'
  ),
  'guide_invitation_acceptance',
  'shared evidence backstop records acceptance as the winner'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.auth_provider_provisioning_reservation reservation
     where reservation.guide_invite_id =
       '270cc027-1000-4000-8000-000000000005'
  ),
  1,
  'losing preparation creates no duplicate reservation'
);
select is(
  (
    select invitation.invite_status
      from core.guide_invite invitation
     where invitation.guide_invite_id =
       '270cc027-1000-4000-8000-000000000005'
  ),
  'accepted',
  'acceptance-versus-preparation winner leaves the invitation accepted'
);

-- C6 reverse schedule: P27-B returns the already-existing reservation first.
-- P27-C waits, then consumes the evidence and accepts using that exact
-- reservation without reservation or audit growth.
select is(
  dblink_exec('p27c_a', 'begin'),
  'BEGIN',
  'A begins preparation-first race'
);
create temporary table p27c_a_prepare_first as
select *
  from dblink(
    'p27c_a',
    $query$
      select *
        from public.solmind_prepare_guide_invitation_acceptance(
          '270cc027-1000-4000-8000-000000000006',
          '270cc027-2000-4000-8000-000000000006',
          'p27c-prepare-first@synthetic.invalid'
        )
    $query$
  ) result(outcome text, provisioning_reservation_id uuid);
select is(
  (select outcome from p27c_a_prepare_first),
  'existing',
  'A returns the existing P27-B reservation inside its open transaction'
);
select is(
  (select provisioning_reservation_id from p27c_a_prepare_first),
  '270cc027-3000-4000-8000-000000000006'::uuid,
  'P27-B returns the exact fixture reservation'
);
select is(
  dblink_send_query(
    'p27c_b',
    $query$
      select *
        from public.solmind_accept_guide_invitation(
          '270cc027-1000-4000-8000-000000000006',
          '270cc027-2000-4000-8000-000000000006',
          '270cc027-3000-4000-8000-000000000006',
          'p27c-provider-prepare-first',
          'p27c-prepare-first@synthetic.invalid'
        )
    $query$
  ),
  1,
  'B launches acceptance behind the preparation transaction'
);
select ok(
  pg_temp.p27c_wait_for_advisory_lock(
    'p27c_b',
    (select pid from p27c_pids where connection_name = 'b')
  ),
  'acceptance waits on the preparation-owned evidence lock'
);
select is(
  dblink_exec('p27c_a', 'commit'),
  'COMMIT',
  'A commits the writeless existing-reservation result'
);
create temporary table p27c_b_prepare_first_accept as
select *
  from dblink_get_result('p27c_b')
    result(outcome text, user_account_id uuid, guide_profile_id uuid);
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('p27c_b')
        result(outcome text, user_account_id uuid, guide_profile_id uuid)
  ),
  0,
  'preparation-first asynchronous acceptance result is fully drained'
);
select is(
  (select outcome from p27c_b_prepare_first_accept),
  'accepted',
  'waiting Guide acceptance succeeds after preparation commits'
);
select is(
  (
    select consumption.consumer_type
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id =
       '270cc027-2000-4000-8000-000000000006'
  ),
  'guide_invitation_acceptance',
  'preparation-first race ends with Guide acceptance consuming the evidence'
);
select is(
  (
    select invitation.invite_status
      from core.guide_invite invitation
     where invitation.guide_invite_id =
       '270cc027-1000-4000-8000-000000000006'
  ),
  'accepted',
  'preparation-first race accepts the target invitation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.auth_provider_provisioning_reservation reservation
     where reservation.guide_invite_id =
       '270cc027-1000-4000-8000-000000000006'
       and reservation.provisioning_reservation_id =
         '270cc027-3000-4000-8000-000000000006'
  ),
  1,
  'preparation-first race preserves exactly one reservation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.target_entity_id =
       '270cc027-3000-4000-8000-000000000006'
       and event.event_type = 'auth_provider_provisioning_reserved'
  ),
  0,
  'existing-reservation preparation writes no new reservation audit'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.auth_provider_identity provider_identity
     where provider_identity.provider_user_id =
       'p27c-provider-prepare-first'
       and provider_identity.status = 'active'
  ),
  1,
  'waiting acceptance creates one active provider binding'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.actor_user_account_id =
       (select user_account_id from p27c_b_prepare_first_accept)
       and event.reason_code = 'invitation_accepted'
  ),
  6,
  'preparation-first race writes the first-time acceptance audit set once'
);

-- C7: a held evidence lock maps to the fixed value-free timeout and leaves the
-- second fixture unchanged.
select is(
  dblink_exec('p27c_a', 'begin'),
  'BEGIN',
  'A begins forced evidence-lock timeout schedule'
);
select is(
  dblink_exec(
    'p27c_a',
    $lock$
      do $body$
      begin
        perform pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtextextended(
            'solmind:authorizing-evidence:v1|270cc027-2000-4000-8000-000000000002',
            0
          )
        );
      end;
      $body$
    $lock$
  ),
  'DO',
  'A holds the exact timeout-fixture evidence lock'
);
select throws_ok(
  $remote$
    select *
      from dblink(
        'p27c_b',
        $query$
          select *
            from public.solmind_accept_guide_invitation(
              '270cc027-1000-4000-8000-000000000002',
              '270cc027-2000-4000-8000-000000000002',
              '270cc027-3000-4000-8000-000000000002',
              'p27c-provider-timeout',
              'p27c-timeout@synthetic.invalid'
            )
        $query$
      ) result(outcome text, user_account_id uuid, guide_profile_id uuid)
  $remote$,
  'P0001',
  'solmind_guide_accept_lock_unavailable',
  'real evidence contention maps to the fixed lock error'
);
select is(
  (
    select invitation.invite_status
      from core.guide_invite invitation
     where invitation.guide_invite_id =
       '270cc027-1000-4000-8000-000000000002'
  ),
  'created',
  'lock timeout leaves the invitation unchanged'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id =
       '270cc027-2000-4000-8000-000000000002'
  ),
  0,
  'lock timeout consumes no evidence'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.auth_provider_identity provider_identity
     where provider_identity.provider_user_id = 'p27c-provider-timeout'
  ),
  0,
  'lock timeout creates no provider binding'
);
select is(
  dblink_exec('p27c_a', 'rollback'),
  'ROLLBACK',
  'A releases the forced evidence lock'
);

-- F2: a helper-owned account-row lock timeout must retain the public transient
-- lock classification instead of being remapped to an integrity failure.
select is(
  dblink_exec('p27c_a', 'reset role'),
  'RESET',
  'A returns to postgres for the helper-lock timeout schedule'
);
select is(
  dblink_exec('p27c_a', 'begin'),
  'BEGIN',
  'A begins the helper-lock timeout schedule'
);
create temp table p27c_helper_timeout_account_lock as
select *
  from dblink(
    'p27c_a',
    $lock$
      select account.user_account_id
        from identity.user_account account
       where account.user_account_id =
         '270cc027-0000-4000-8000-000000000004'
         for update
    $lock$
  ) result(user_account_id uuid);
select is(
  (select user_account_id from p27c_helper_timeout_account_lock),
  '270cc027-0000-4000-8000-000000000004'::uuid,
  'A holds the exact existing-account row used by the acceptance helper'
);
select throws_ok(
  $remote$
    select *
      from dblink(
        'p27c_b',
        $query$
          select *
            from public.solmind_accept_guide_invitation(
              '270cc027-1000-4000-8000-000000000007',
              '270cc027-2000-4000-8000-000000000007',
              '270cc027-3000-4000-8000-000000000007',
              'p27c-provider-helper-timeout',
              'p27c-helper-timeout@synthetic.invalid'
            )
        $query$
      ) result(outcome text, user_account_id uuid, guide_profile_id uuid)
  $remote$,
  'P0001',
  'solmind_guide_accept_lock_unavailable',
  'helper-owned account contention preserves the fixed transient lock error'
);

-- F3: the same held helper-owned row with a caller-owned statement timeout
-- must be caught as query_canceled inside the protected helper window.
select is(
  dblink_exec('p27c_b', 'set statement_timeout=''1500ms'''),
  'SET',
  'B uses a caller-owned timeout shorter than the helper lock timeout'
);
select is(
  dblink_send_query(
    'p27c_b',
    $query$
      select *
        from public.solmind_accept_guide_invitation(
          '270cc027-1000-4000-8000-000000000007',
          '270cc027-2000-4000-8000-000000000007',
          '270cc027-3000-4000-8000-000000000007',
          'p27c-provider-helper-timeout',
          'p27c-helper-timeout@synthetic.invalid'
        )
    $query$
  ),
  1,
  'B launches the caller-cancellation helper-window schedule'
);
select ok(
  pg_temp.p27c_wait_for_any_lock(
    'p27c_b',
    (select pid from p27c_pids where connection_name = 'b')
  ),
  'B reaches a helper-owned row lock before caller cancellation'
);
select throws_ok(
  $drain_error$
    select *
      from dblink_get_result('p27c_b')
        result(outcome text, user_account_id uuid, guide_profile_id uuid)
  $drain_error$,
  'P0001',
  'solmind_guide_accept_lock_unavailable',
  'helper-window query cancellation preserves the fixed transient lock error'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('p27c_b')
        result(outcome text, user_account_id uuid, guide_profile_id uuid)
  ),
  0,
  'failed caller-cancellation result stream is fully drained'
);
select is(
  dblink_exec('p27c_b', 'set statement_timeout=''8s'''),
  'SET',
  'B restores the bounded concurrency-suite statement timeout'
);
select is(
  (
    select invitation.invite_status
      from core.guide_invite invitation
     where invitation.guide_invite_id =
       '270cc027-1000-4000-8000-000000000007'
  ),
  'created',
  'helper-lock timeout leaves the invitation unchanged'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id =
       '270cc027-2000-4000-8000-000000000007'
  ),
  0,
  'helper-lock timeout consumes no evidence'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_role_assignment assignment
     where assignment.user_account_id =
       '270cc027-0000-4000-8000-000000000004'
       and assignment.role_code = 'guide'
  ),
  0,
  'helper-lock timeout creates no Guide role'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_profile profile
     where profile.user_account_id =
       '270cc027-0000-4000-8000-000000000004'
  ),
  0,
  'helper-lock timeout creates no Guide profile'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.target_entity_id =
       '270cc027-1000-4000-8000-000000000007'
  ),
  0,
  'helper-lock timeout writes no invitation audit'
);
select is(
  dblink_exec('p27c_a', 'rollback'),
  'ROLLBACK',
  'A releases the helper-owned account row'
);

select is(
  dblink_exec('p27c_a', 'reset role'),
  'RESET',
  'A returns to postgres for synthetic cleanup'
);
select is(
  dblink_exec('p27c_b', 'reset role'),
  'RESET',
  'B returns to postgres for disconnect'
);
select lives_ok(
  $cleanup_call$
    select dblink_exec(
      'p27c_a',
      $cleanup$
        delete from audit.audit_event
         where actor_user_account_id in (
           select provider_identity.user_account_id
             from identity.auth_provider_identity provider_identity
            where provider_identity.provider_user_id like 'p27c-provider-%'
         )
            or target_entity_id in (
              '270cc027-1000-4000-8000-000000000001'::uuid,
              '270cc027-1000-4000-8000-000000000002'::uuid,
              '270cc027-1000-4000-8000-000000000003'::uuid,
               '270cc027-1000-4000-8000-000000000004'::uuid,
               '270cc027-1000-4000-8000-000000000005'::uuid,
               '270cc027-1000-4000-8000-000000000006'::uuid,
               '270cc027-1000-4000-8000-000000000007'::uuid
            );
        delete from identity.user_session
         where user_account_id = '270cc027-0000-4000-8000-000000000002';
        delete from core.guide_profile
         where user_account_id in (
           select provider_identity.user_account_id
             from identity.auth_provider_identity provider_identity
            where provider_identity.provider_user_id like 'p27c-provider-%'
         );
        delete from identity.user_role_assignment
         where user_account_id in (
           select provider_identity.user_account_id
             from identity.auth_provider_identity provider_identity
            where provider_identity.provider_user_id like 'p27c-provider-%'
         );
        delete from identity.authorizing_evidence_consumption
         where verification_challenge_id::text like '270cc027-%';
        delete from identity.auth_provider_identity
         where provider_user_id like 'p27c-provider-%';
        delete from identity.auth_provider_provisioning_reservation
         where guide_invite_id::text like '270cc027-%';
        delete from core.guide_invite
         where guide_invite_id::text like '270cc027-%';
        delete from identity.verification_challenge
         where verification_challenge_id::text like '270cc027-%';
        delete from identity.user_contact_method
         where user_account_id in (
           select account.user_account_id
            from identity.user_account account
            where account.display_name in (
              'P27-C Race Guide',
              'P27-C Preparation Guide',
               'P27-C Preparation First Guide',
               'P27-C Session Account',
               'P27-C Acceptance Account',
               'P27-C Helper Timeout Account'
            )
         );
        delete from identity.user_account
         where display_name in (
           'P27-C Race Guide',
           'P27-C Timeout Guide',
           'P27-C Session Account',
            'P27-C Acceptance Account',
            'P27-C Helper Timeout Account',
            'P27-C Preparation Guide',
           'P27-C Preparation First Guide'
         );
        delete from identity.user_account
         where user_account_id = '270cc027-0000-4000-8000-000000000001'
      $cleanup$
    )
  $cleanup_call$,
  'synthetic concurrency fixtures clean up in FK-safe order'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_invite invitation
     where invitation.guide_invite_id::text like '270cc027-%'
  ),
  0,
  'cleanup removes every synthetic invitation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.verification_challenge challenge
     where challenge.verification_challenge_id::text like '270cc027-%'
  ),
  0,
  'cleanup removes every synthetic challenge'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.auth_provider_identity provider_identity
     where provider_identity.provider_user_id like 'p27c-provider-%'
  ),
  0,
  'cleanup removes every synthetic provider binding'
);
select lives_ok(
  $$select dblink_disconnect('p27c_a')$$,
  'connection A disconnects'
);
select lives_ok(
  $$select dblink_disconnect('p27c_b')$$,
  'connection B disconnects'
);

select * from finish();
rollback;
