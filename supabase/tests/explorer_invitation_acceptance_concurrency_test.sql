-- S02E real-function concurrency proofs. Local ephemeral database only.
-- A hard SQL error can leave reserved synthetic rows. Recovery requires
-- Paul's explicit approval and must use only the exact synthetic namespace
-- below. Never run recovery cleanup against hosted or real-user data.

begin;
create extension if not exists pgtap;
create extension if not exists dblink;
select plan(88);

create function pg_temp.s02e_wait_for_advisory_lock(
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

create function pg_temp.s02e_wait_for_any_lock(
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
      from core.explorer_invite invitation
     where invitation.explorer_invite_id::text like 'a27ec027-%'
  ),
  0,
  'preflight finds no S02E concurrency invitation residue'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.verification_challenge challenge
     where challenge.verification_challenge_id::text like 'a27ec027-%'
  ),
  0,
  'preflight finds no S02E concurrency challenge residue'
);

select lives_ok(
  $$select dblink_connect(
    's02e_a',
    'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres connect_timeout=5'
  )$$,
  'connection A opens'
);
select lives_ok(
  $$select dblink_connect(
    's02e_b',
    'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres connect_timeout=5'
  )$$,
  'connection B opens'
);
select is(
  dblink_exec('s02e_a', 'set statement_timeout=''8s'''),
  'SET',
  'connection A statement timeout is bounded'
);
select is(
  dblink_exec('s02e_b', 'set statement_timeout=''8s'''),
  'SET',
  'connection B statement timeout is bounded'
);

create temporary table s02e_pids (
  connection_name text primary key,
  pid integer
) on commit drop;
insert into s02e_pids
select 'a', pid
  from dblink('s02e_a', 'select pg_backend_pid()') result(pid integer)
union all
select 'b', pid
  from dblink('s02e_b', 'select pg_backend_pid()') result(pid integer);
select is(
  (
    select pg_catalog.count(distinct pid)::integer
      from (
        select pg_backend_pid() as pid
        union all
        select pid from s02e_pids
      ) sessions
  ),
  3,
  'orchestrator and both dblink workers are distinct sessions'
);

select lives_ok(
  $setup_call$
    select dblink_exec(
      's02e_a',
      $setup$
        insert into identity.user_account (
          user_account_id, display_name, account_status
        ) values
          (
            'a27ec027-0000-4000-8000-000000000001',
            'S02E concurrency Admin',
            'active'
          ),
          (
            'a27ec027-0000-4000-8000-000000000101',
            'S02E concurrency Guide',
            'active'
          ),
          (
            'a27ec027-0000-4000-8000-000000000202',
            'S02E concurrency Session First Explorer',
            'active'
          ),
          (
            'a27ec027-0000-4000-8000-000000000203',
            'S02E concurrency Acceptance First Explorer',
            'active'
          ),
          (
            'a27ec027-0000-4000-8000-000000000204',
            'S02E concurrency Helper Lock Explorer',
            'active'
          );

        insert into identity.user_role_assignment (
          user_role_assignment_id, user_account_id, role_code, role_status,
          granted_by_role_context
        ) values
          (
            'a27ec027-1000-4000-8000-000000000001',
            'a27ec027-0000-4000-8000-000000000001',
            'admin', 'active', 'system'
          ),
          (
            'a27ec027-1000-4000-8000-000000000101',
            'a27ec027-0000-4000-8000-000000000101',
            'guide', 'active', 'system'
          ),
          (
            'a27ec027-1000-4000-8000-000000000202',
            'a27ec027-0000-4000-8000-000000000202',
            'explorer', 'active', 'system'
          ),
          (
            'a27ec027-1000-4000-8000-000000000203',
            'a27ec027-0000-4000-8000-000000000203',
            'explorer', 'active', 'system'
          ),
          (
            'a27ec027-1000-4000-8000-000000000204',
            'a27ec027-0000-4000-8000-000000000204',
            'explorer', 'active', 'system'
          );

        insert into identity.user_contact_method (
          user_contact_method_id, user_account_id, contact_method_type,
          contact_label, contact_value, normalized_contact_value,
          login_enabled, is_verified, verified_at, status
        ) values
          (
            'a27ec027-2000-4000-8000-000000000202',
            'a27ec027-0000-4000-8000-000000000202',
            'email', 'primary',
            's02e-session-first@synthetic.invalid',
            's02e-session-first@synthetic.invalid',
            true, true, now() - interval '1 hour', 'active'
          ),
          (
            'a27ec027-2000-4000-8000-000000000203',
            'a27ec027-0000-4000-8000-000000000203',
            'email', 'primary',
            's02e-acceptance-first@synthetic.invalid',
            's02e-acceptance-first@synthetic.invalid',
            true, true, now() - interval '1 hour', 'active'
          ),
          (
            'a27ec027-2000-4000-8000-000000000204',
            'a27ec027-0000-4000-8000-000000000204',
            'email', 'primary',
            's02e-helper-lock@synthetic.invalid',
            's02e-helper-lock@synthetic.invalid',
            true, true, now() - interval '1 hour', 'active'
          );

        insert into identity.auth_provider_identity (
          auth_provider_identity_id, user_account_id, provider_name,
          provider_user_id, provider_email, status
        ) values
          (
            'a27ec027-2100-4000-8000-000000000202',
            'a27ec027-0000-4000-8000-000000000202',
            'supabase', 's02e-concurrency-session-first',
            's02e-session-first@synthetic.invalid', 'active'
          ),
          (
            'a27ec027-2100-4000-8000-000000000203',
            'a27ec027-0000-4000-8000-000000000203',
            'supabase', 's02e-concurrency-acceptance-first',
            's02e-acceptance-first@synthetic.invalid', 'active'
          ),
          (
            'a27ec027-2100-4000-8000-000000000204',
            'a27ec027-0000-4000-8000-000000000204',
            'supabase', 's02e-concurrency-helper-lock',
            's02e-helper-lock@synthetic.invalid', 'active'
          );

        insert into core.organization (
          organization_id, organization_name, approval_status,
          approved_by_user_account_id, approved_at, status
        ) values (
          'a27ec027-3000-4000-8000-000000000001',
          'S02E concurrency organization',
          'approved',
          'a27ec027-0000-4000-8000-000000000001',
          now() - interval '1 day',
          'active'
        );

        insert into core.practice (
          practice_id, organization_id, practice_name, approval_status,
          approved_by_user_account_id, approved_at, status
        ) values (
          'a27ec027-3100-4000-8000-000000000001',
          'a27ec027-3000-4000-8000-000000000001',
          'S02E concurrency practice',
          'approved',
          'a27ec027-0000-4000-8000-000000000001',
          now() - interval '1 day',
          'active'
        );

        insert into core.guide_profile (
          guide_profile_id, user_account_id, guide_display_name, setup_status,
          approved_by_user_account_id, approved_at, status
        ) values (
          'a27ec027-3200-4000-8000-000000000101',
          'a27ec027-0000-4000-8000-000000000101',
          'S02E concurrency Guide',
          'approved',
          'a27ec027-0000-4000-8000-000000000001',
          now() - interval '1 day',
          'active'
        );

        insert into core.practice_guide (
          practice_guide_id, practice_id, guide_profile_id,
          relationship_status, is_primary_for_mvp0,
          created_by_user_account_id
        ) values (
          'a27ec027-3300-4000-8000-000000000101',
          'a27ec027-3100-4000-8000-000000000001',
          'a27ec027-3200-4000-8000-000000000101',
          'active',
          true,
          'a27ec027-0000-4000-8000-000000000001'
        );

        insert into core.explorer_profile (
          explorer_profile_id, user_account_id, explorer_display_name,
          onboarding_status, status
        ) values
          (
            'a27ec027-3400-4000-8000-000000000202',
            'a27ec027-0000-4000-8000-000000000202',
            'S02E concurrency Session First Explorer',
            'active', 'active'
          ),
          (
            'a27ec027-3400-4000-8000-000000000203',
            'a27ec027-0000-4000-8000-000000000203',
            'S02E concurrency Acceptance First Explorer',
            'active', 'active'
          ),
          (
            'a27ec027-3400-4000-8000-000000000204',
            'a27ec027-0000-4000-8000-000000000204',
            'S02E concurrency Helper Lock Explorer',
            'active', 'active'
          );

        insert into core.explorer_invite (
          explorer_invite_id, guide_profile_id, practice_id,
          invited_contact_value, normalized_contact_value,
          contact_method_type, invited_name, invite_status, expires_at
        ) values
          (
            'a27ec027-5000-4000-8000-000000000001',
            'a27ec027-3200-4000-8000-000000000101',
            'a27ec027-3100-4000-8000-000000000001',
            's02e-race@synthetic.invalid',
            's02e-race@synthetic.invalid',
            'email', 'S02E concurrency Race Explorer',
            'created', now() + interval '1 day'
          ),
          (
            'a27ec027-5000-4000-8000-000000000002',
            'a27ec027-3200-4000-8000-000000000101',
            'a27ec027-3100-4000-8000-000000000001',
            's02e-session-first@synthetic.invalid',
            's02e-session-first@synthetic.invalid',
            'email', 'S02E concurrency Session First Explorer',
            'created', now() + interval '1 day'
          ),
          (
            'a27ec027-5000-4000-8000-000000000003',
            'a27ec027-3200-4000-8000-000000000101',
            'a27ec027-3100-4000-8000-000000000001',
            's02e-acceptance-first@synthetic.invalid',
            's02e-acceptance-first@synthetic.invalid',
            'email', 'S02E concurrency Acceptance First Explorer',
            'created', now() + interval '1 day'
          ),
          (
            'a27ec027-5000-4000-8000-000000000004',
            'a27ec027-3200-4000-8000-000000000101',
            'a27ec027-3100-4000-8000-000000000001',
            's02e-accept-prepare@synthetic.invalid',
            's02e-accept-prepare@synthetic.invalid',
            'email', 'S02E concurrency Accept Prepare',
            'created', now() + interval '1 day'
          ),
          (
            'a27ec027-5000-4000-8000-000000000005',
            'a27ec027-3200-4000-8000-000000000101',
            'a27ec027-3100-4000-8000-000000000001',
            's02e-prepare-accept@synthetic.invalid',
            's02e-prepare-accept@synthetic.invalid',
            'email', 'S02E concurrency Prepare Accept',
            'created', now() + interval '1 day'
          ),
          (
            'a27ec027-5000-4000-8000-000000000006',
            'a27ec027-3200-4000-8000-000000000101',
            'a27ec027-3100-4000-8000-000000000001',
            's02e-timeout@synthetic.invalid',
            's02e-timeout@synthetic.invalid',
            'email', 'S02E concurrency Timeout Explorer',
            'created', now() + interval '1 day'
          ),
          (
            'a27ec027-5000-4000-8000-000000000007',
            'a27ec027-3200-4000-8000-000000000101',
            'a27ec027-3100-4000-8000-000000000001',
            's02e-helper-lock@synthetic.invalid',
            's02e-helper-lock@synthetic.invalid',
            'email', 'S02E concurrency Helper Lock Explorer',
            'created', now() + interval '1 day'
          );

        insert into identity.verification_challenge (
          verification_challenge_id, user_account_id,
          user_contact_method_id, normalized_contact_value,
          contact_method_type, purpose, delivery_channel,
          code_hash, expires_at, used_at
        ) values
          (
            'a27ec027-6000-4000-8000-000000000001',
            null, null, 's02e-race@synthetic.invalid',
            'email', 'contact_verify', 'email',
            'svf1:0101010101010101010101010101010101010101010101010101010101010101',
            now() + interval '10 minutes', now()
          ),
          (
            'a27ec027-6000-4000-8000-000000000002',
            'a27ec027-0000-4000-8000-000000000202',
            'a27ec027-2000-4000-8000-000000000202',
            's02e-session-first@synthetic.invalid',
            'email', 'login', 'email',
            'svf1:0202020202020202020202020202020202020202020202020202020202020202',
            now() + interval '10 minutes', now()
          ),
          (
            'a27ec027-6000-4000-8000-000000000003',
            'a27ec027-0000-4000-8000-000000000203',
            'a27ec027-2000-4000-8000-000000000203',
            's02e-acceptance-first@synthetic.invalid',
            'email', 'login', 'email',
            'svf1:0303030303030303030303030303030303030303030303030303030303030303',
            now() + interval '10 minutes', now()
          ),
          (
            'a27ec027-6000-4000-8000-000000000004',
            null, null, 's02e-accept-prepare@synthetic.invalid',
            'email', 'contact_verify', 'email',
            'svf1:0404040404040404040404040404040404040404040404040404040404040404',
            now() + interval '10 minutes', now()
          ),
          (
            'a27ec027-6000-4000-8000-000000000005',
            null, null, 's02e-prepare-accept@synthetic.invalid',
            'email', 'contact_verify', 'email',
            'svf1:0505050505050505050505050505050505050505050505050505050505050505',
            now() + interval '10 minutes', now()
          ),
          (
            'a27ec027-6000-4000-8000-000000000006',
            null, null, 's02e-timeout@synthetic.invalid',
            'email', 'contact_verify', 'email',
            'svf1:0606060606060606060606060606060606060606060606060606060606060606',
            now() + interval '10 minutes', now()
          ),
          (
            'a27ec027-6000-4000-8000-000000000007',
            'a27ec027-0000-4000-8000-000000000204',
            'a27ec027-2000-4000-8000-000000000204',
            's02e-helper-lock@synthetic.invalid',
            'email', 'login', 'email',
            'svf1:0707070707070707070707070707070707070707070707070707070707070707',
            now() + interval '10 minutes', now()
          );

        insert into identity.auth_provider_provisioning_reservation (
          provisioning_reservation_id, explorer_invite_id, provider_name,
          created_at, expires_at, retention_class
        ) values
          (
            'a27ec027-7000-4000-8000-000000000001',
            'a27ec027-5000-4000-8000-000000000001',
            'supabase', now(), now() + interval '24 hours', 'security_log'
          ),
          (
            'a27ec027-7000-4000-8000-000000000002',
            'a27ec027-5000-4000-8000-000000000002',
            'supabase', now(), now() + interval '24 hours', 'security_log'
          ),
          (
            'a27ec027-7000-4000-8000-000000000003',
            'a27ec027-5000-4000-8000-000000000003',
            'supabase', now(), now() + interval '24 hours', 'security_log'
          ),
          (
            'a27ec027-7000-4000-8000-000000000004',
            'a27ec027-5000-4000-8000-000000000004',
            'supabase', now(), now() + interval '24 hours', 'security_log'
          ),
          (
            'a27ec027-7000-4000-8000-000000000005',
            'a27ec027-5000-4000-8000-000000000005',
            'supabase', now(), now() + interval '24 hours', 'security_log'
          ),
          (
            'a27ec027-7000-4000-8000-000000000006',
            'a27ec027-5000-4000-8000-000000000006',
            'supabase', now(), now() + interval '24 hours', 'security_log'
          ),
          (
            'a27ec027-7000-4000-8000-000000000007',
            'a27ec027-5000-4000-8000-000000000007',
            'supabase', now(), now() + interval '24 hours', 'security_log'
          )
      $setup$
    )
  $setup_call$,
  'synthetic concurrency fixtures commit through connection A'
);

select is(
  dblink_exec('s02e_a', 'set role service_role'),
  'SET',
  'connection A assumes service_role'
);
select is(
  dblink_exec('s02e_b', 'set role service_role'),
  'SET',
  'connection B assumes service_role'
);

-- P27D-R1: two exact calls serialize; the first accepts and the second returns
-- committed-response recovery.
select is(dblink_exec('s02e_a', 'begin'), 'BEGIN', 'A begins same-target race');
create temporary table s02e_a_accept as
select *
  from dblink(
    's02e_a',
    $query$
      select * from public.solmind_accept_explorer_invitation(
        'a27ec027-5000-4000-8000-000000000001',
        'a27ec027-6000-4000-8000-000000000001',
        'a27ec027-7000-4000-8000-000000000001',
        's02e-concurrency-race',
        's02e-race@synthetic.invalid'
      )
    $query$
  ) result(
    outcome text, user_account_id uuid, explorer_profile_id uuid,
    guide_explorer_relationship_id uuid
  );
select is(
  (select outcome from s02e_a_accept),
  'accepted',
  'A completes first-time Explorer acceptance in its open transaction'
);
select is(
  dblink_send_query(
    's02e_b',
    $query$
      select * from public.solmind_accept_explorer_invitation(
        'a27ec027-5000-4000-8000-000000000001',
        'a27ec027-6000-4000-8000-000000000001',
        'a27ec027-7000-4000-8000-000000000001',
        's02e-concurrency-race',
        's02e-race@synthetic.invalid'
      )
    $query$
  ),
  1,
  'B launches the exact same acceptance asynchronously'
);
select ok(
  pg_temp.s02e_wait_for_advisory_lock(
    's02e_b',
    (select pid from s02e_pids where connection_name = 'b')
  ),
  'B waits on the shared evidence advisory lock'
);
select is(
  dblink_exec('s02e_a', 'commit'),
  'COMMIT',
  'A commits the winning acceptance'
);
create temporary table s02e_b_recovery as
select *
  from dblink_get_result('s02e_b')
    result(
      outcome text, user_account_id uuid, explorer_profile_id uuid,
      guide_explorer_relationship_id uuid
    );
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('s02e_b')
        result(
          outcome text, user_account_id uuid, explorer_profile_id uuid,
          guide_explorer_relationship_id uuid
        )
  ),
  0,
  'B asynchronous result stream is fully drained'
);
select is(
  (select outcome from s02e_b_recovery),
  'existing',
  'B returns exact committed-response recovery'
);
select is(
  (select user_account_id from s02e_b_recovery),
  (select user_account_id from s02e_a_accept),
  'both callers receive the same account'
);
select is(
  (select guide_explorer_relationship_id from s02e_b_recovery),
  (select guide_explorer_relationship_id from s02e_a_accept),
  'both callers receive the same relationship'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id =
       'a27ec027-6000-4000-8000-000000000001'
       and consumption.consumer_type = 'explorer_invitation_acceptance'
  ),
  1,
  'same-target race commits one Explorer evidence consumption'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_explorer_relationship relationship
     where relationship.created_from_invite_id =
       'a27ec027-5000-4000-8000-000000000001'
  ),
  1,
  'same-target race commits one relationship'
);

-- Session creation commits the evidence first; Explorer acceptance loses.
select is(
  dblink_exec('s02e_a', 'begin'),
  'BEGIN',
  'A begins session-first evidence race'
);
create temporary table s02e_a_session as
select *
  from dblink(
    's02e_a',
    $query$
      select * from public.solmind_create_user_session(
        'a27ec027-0000-4000-8000-000000000202',
        'explorer',
        'a27ec027-6000-4000-8000-000000000002',
        'login',
        900
      )
    $query$
  ) result(outcome text, user_session_id uuid, expires_at timestamptz);
select is(
  (select outcome from s02e_a_session),
  'created',
  'A creates the competing Explorer session inside its transaction'
);
select is(
  dblink_send_query(
    's02e_b',
    $query$
      select * from public.solmind_accept_explorer_invitation(
        'a27ec027-5000-4000-8000-000000000002',
        'a27ec027-6000-4000-8000-000000000002',
        'a27ec027-7000-4000-8000-000000000002',
        's02e-concurrency-session-first',
        's02e-session-first@synthetic.invalid'
      )
    $query$
  ),
  1,
  'B launches Explorer acceptance against the same evidence'
);
select ok(
  pg_temp.s02e_wait_for_advisory_lock(
    's02e_b',
    (select pid from s02e_pids where connection_name = 'b')
  ),
  'Explorer acceptance waits on the session-owned evidence lock'
);
select is(
  dblink_exec('s02e_a', 'commit'),
  'COMMIT',
  'A commits the winning session consumer'
);
select throws_ok(
  $drain_error$
    select *
      from dblink_get_result('s02e_b')
        result(
          outcome text, user_account_id uuid, explorer_profile_id uuid,
          guide_explorer_relationship_id uuid
        )
  $drain_error$,
  'P0001',
  'solmind_explorer_accept_evidence_consumed',
  'losing Explorer acceptance receives the consumed-evidence error'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('s02e_b')
        result(
          outcome text, user_account_id uuid, explorer_profile_id uuid,
          guide_explorer_relationship_id uuid
        )
  ),
  0,
  'failed asynchronous acceptance result stream is fully drained'
);
select is(
  (
    select consumption.consumer_type
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id =
       'a27ec027-6000-4000-8000-000000000002'
  ),
  'user_session',
  'shared evidence backstop records the session as winner'
);
select is(
  (
    select invitation.invite_status
      from core.explorer_invite invitation
     where invitation.explorer_invite_id =
       'a27ec027-5000-4000-8000-000000000002'
  ),
  'created',
  'losing acceptance leaves the invitation open'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_explorer_relationship relationship
     where relationship.created_from_invite_id =
       'a27ec027-5000-4000-8000-000000000002'
  ),
  0,
  'losing acceptance creates no relationship'
);

-- Explorer acceptance commits first; session creation loses.
select is(
  dblink_exec('s02e_a', 'begin'),
  'BEGIN',
  'A begins acceptance-first session race'
);
create temporary table s02e_a_accept_first as
select *
  from dblink(
    's02e_a',
    $query$
      select * from public.solmind_accept_explorer_invitation(
        'a27ec027-5000-4000-8000-000000000003',
        'a27ec027-6000-4000-8000-000000000003',
        'a27ec027-7000-4000-8000-000000000003',
        's02e-concurrency-acceptance-first',
        's02e-acceptance-first@synthetic.invalid'
      )
    $query$
  ) result(
    outcome text, user_account_id uuid, explorer_profile_id uuid,
    guide_explorer_relationship_id uuid
  );
select is(
  (select outcome from s02e_a_accept_first),
  'accepted',
  'A accepts the Explorer invitation inside its transaction'
);
select is(
  dblink_send_query(
    's02e_b',
    $query$
      select * from public.solmind_create_user_session(
        'a27ec027-0000-4000-8000-000000000203',
        'explorer',
        'a27ec027-6000-4000-8000-000000000003',
        'login',
        900
      )
    $query$
  ),
  1,
  'B launches session creation against the same evidence'
);
select ok(
  pg_temp.s02e_wait_for_advisory_lock(
    's02e_b',
    (select pid from s02e_pids where connection_name = 'b')
  ),
  'session creation waits on the acceptance-owned evidence lock'
);
select is(
  dblink_exec('s02e_a', 'commit'),
  'COMMIT',
  'A commits the winning Explorer acceptance'
);
select throws_ok(
  $drain_error$
    select *
      from dblink_get_result('s02e_b')
        result(outcome text, user_session_id uuid, expires_at timestamptz)
  $drain_error$,
  'P0001',
  'solmind_session_evidence_consumed',
  'losing session receives the banked consumed-evidence error'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('s02e_b')
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
       'a27ec027-6000-4000-8000-000000000003'
  ),
  'explorer_invitation_acceptance',
  'shared evidence backstop records Explorer acceptance as winner'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_session session
     where session.user_account_id =
       'a27ec027-0000-4000-8000-000000000203'
  ),
  0,
  'losing session creation writes no session'
);
select is(
  (
    select invitation.invite_status
      from core.explorer_invite invitation
     where invitation.explorer_invite_id =
       'a27ec027-5000-4000-8000-000000000003'
  ),
  'accepted',
  'winning Explorer invitation is accepted'
);

-- Acceptance commits first; concurrent preparation loses on consumption.
select is(
  dblink_exec('s02e_a', 'begin'),
  'BEGIN',
  'A begins acceptance-versus-preparation race'
);
create temporary table s02e_a_accept_prepare as
select *
  from dblink(
    's02e_a',
    $query$
      select * from public.solmind_accept_explorer_invitation(
        'a27ec027-5000-4000-8000-000000000004',
        'a27ec027-6000-4000-8000-000000000004',
        'a27ec027-7000-4000-8000-000000000004',
        's02e-concurrency-accept-prepare',
        's02e-accept-prepare@synthetic.invalid'
      )
    $query$
  ) result(
    outcome text, user_account_id uuid, explorer_profile_id uuid,
    guide_explorer_relationship_id uuid
  );
select is(
  (select outcome from s02e_a_accept_prepare),
  'accepted',
  'A accepts before preparation inside its open transaction'
);
select is(
  dblink_send_query(
    's02e_b',
    $query$
      select * from public.solmind_prepare_explorer_invitation_acceptance(
        'a27ec027-5000-4000-8000-000000000004',
        'a27ec027-6000-4000-8000-000000000004',
        's02e-accept-prepare@synthetic.invalid'
      )
    $query$
  ),
  1,
  'B launches preparation against acceptance-owned evidence'
);
select ok(
  pg_temp.s02e_wait_for_advisory_lock(
    's02e_b',
    (select pid from s02e_pids where connection_name = 'b')
  ),
  'preparation waits on the acceptance-owned evidence lock'
);
select is(
  dblink_exec('s02e_a', 'commit'),
  'COMMIT',
  'A commits the winning acceptance'
);
select throws_ok(
  $drain_error$
    select *
      from dblink_get_result('s02e_b')
        result(outcome text, provisioning_reservation_id uuid)
  $drain_error$,
  'P0001',
  'solmind_invitation_prepare_evidence_consumed',
  'losing preparation receives the consumed-evidence error'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('s02e_b')
        result(outcome text, provisioning_reservation_id uuid)
  ),
  0,
  'failed asynchronous preparation result stream is fully drained'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.auth_provider_provisioning_reservation reservation
     where reservation.explorer_invite_id =
       'a27ec027-5000-4000-8000-000000000004'
  ),
  1,
  'losing preparation creates no duplicate reservation'
);

-- Existing-reservation preparation holds the shared protocol first;
-- acceptance then succeeds using that exact reservation.
select is(
  dblink_exec('s02e_a', 'begin'),
  'BEGIN',
  'A begins preparation-first race'
);
create temporary table s02e_a_prepare_first as
select *
  from dblink(
    's02e_a',
    $query$
      select * from public.solmind_prepare_explorer_invitation_acceptance(
        'a27ec027-5000-4000-8000-000000000005',
        'a27ec027-6000-4000-8000-000000000005',
        's02e-prepare-accept@synthetic.invalid'
      )
    $query$
  ) result(outcome text, provisioning_reservation_id uuid);
select is(
  (select outcome from s02e_a_prepare_first),
  'existing',
  'A returns the existing reservation inside its open transaction'
);
select is(
  (select provisioning_reservation_id from s02e_a_prepare_first),
  'a27ec027-7000-4000-8000-000000000005'::uuid,
  'preparation returns the exact fixture reservation'
);
select is(
  dblink_send_query(
    's02e_b',
    $query$
      select * from public.solmind_accept_explorer_invitation(
        'a27ec027-5000-4000-8000-000000000005',
        'a27ec027-6000-4000-8000-000000000005',
        'a27ec027-7000-4000-8000-000000000005',
        's02e-concurrency-prepare-accept',
        's02e-prepare-accept@synthetic.invalid'
      )
    $query$
  ),
  1,
  'B launches acceptance behind the preparation transaction'
);
select ok(
  pg_temp.s02e_wait_for_advisory_lock(
    's02e_b',
    (select pid from s02e_pids where connection_name = 'b')
  ),
  'acceptance waits on the preparation-owned evidence lock'
);
select is(
  dblink_exec('s02e_a', 'commit'),
  'COMMIT',
  'A commits the writeless existing-reservation result'
);
create temporary table s02e_b_prepare_accept as
select *
  from dblink_get_result('s02e_b')
    result(
      outcome text, user_account_id uuid, explorer_profile_id uuid,
      guide_explorer_relationship_id uuid
    );
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('s02e_b')
        result(
          outcome text, user_account_id uuid, explorer_profile_id uuid,
          guide_explorer_relationship_id uuid
        )
  ),
  0,
  'preparation-first asynchronous acceptance result is fully drained'
);
select is(
  (select outcome from s02e_b_prepare_accept),
  'accepted',
  'waiting Explorer acceptance succeeds after preparation commits'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.auth_provider_provisioning_reservation reservation
     where reservation.explorer_invite_id =
       'a27ec027-5000-4000-8000-000000000005'
  ),
  1,
  'preparation-first race preserves one reservation'
);
select is(
  (
    select invitation.invite_status
      from core.explorer_invite invitation
     where invitation.explorer_invite_id =
       'a27ec027-5000-4000-8000-000000000005'
  ),
  'accepted',
  'preparation-first race accepts the invitation'
);

-- Held evidence lock maps to the fixed value-free timeout.
select is(
  dblink_exec('s02e_a', 'begin'),
  'BEGIN',
  'A begins forced evidence-lock timeout schedule'
);
select is(
  dblink_exec(
    's02e_a',
    $lock$
      do $body$
      begin
        perform pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtextextended(
            'solmind:authorizing-evidence:v1|a27ec027-6000-4000-8000-000000000006',
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
        's02e_b',
        $query$
          select * from public.solmind_accept_explorer_invitation(
            'a27ec027-5000-4000-8000-000000000006',
            'a27ec027-6000-4000-8000-000000000006',
            'a27ec027-7000-4000-8000-000000000006',
            's02e-concurrency-timeout',
            's02e-timeout@synthetic.invalid'
          )
        $query$
      ) result(
        outcome text, user_account_id uuid, explorer_profile_id uuid,
        guide_explorer_relationship_id uuid
      )
  $remote$,
  'P0001',
  'solmind_explorer_accept_lock_unavailable',
  'real evidence contention maps to the fixed lock error'
);
select is(
  (
    select invitation.invite_status
      from core.explorer_invite invitation
     where invitation.explorer_invite_id =
       'a27ec027-5000-4000-8000-000000000006'
  ),
  'created',
  'evidence-lock timeout leaves the invitation unchanged'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id =
       'a27ec027-6000-4000-8000-000000000006'
  ),
  0,
  'evidence-lock timeout consumes no evidence'
);
select is(
  dblink_exec('s02e_a', 'rollback'),
  'ROLLBACK',
  'A releases the forced evidence lock'
);

-- Provider-row contention proves helper-window lock timeout and caller
-- cancellation retain the public transient lock classification.
select is(
  dblink_exec('s02e_a', 'reset role'),
  'RESET',
  'A returns to postgres for helper-lock schedule'
);
select is(
  dblink_exec('s02e_a', 'begin'),
  'BEGIN',
  'A begins helper provider-lock schedule'
);
create temporary table s02e_helper_provider_lock as
select *
  from dblink(
    's02e_a',
    $lock$
      select provider_identity.auth_provider_identity_id
        from identity.auth_provider_identity provider_identity
       where provider_identity.auth_provider_identity_id =
         'a27ec027-2100-4000-8000-000000000204'
         for update
    $lock$
  ) result(auth_provider_identity_id uuid);
select is(
  (select auth_provider_identity_id from s02e_helper_provider_lock),
  'a27ec027-2100-4000-8000-000000000204'::uuid,
  'A holds the provider row reached inside the shared helper'
);
select throws_ok(
  $remote$
    select *
      from dblink(
        's02e_b',
        $query$
          select * from public.solmind_accept_explorer_invitation(
            'a27ec027-5000-4000-8000-000000000007',
            'a27ec027-6000-4000-8000-000000000007',
            'a27ec027-7000-4000-8000-000000000007',
            's02e-concurrency-helper-lock',
            's02e-helper-lock@synthetic.invalid'
          )
        $query$
      ) result(
        outcome text, user_account_id uuid, explorer_profile_id uuid,
        guide_explorer_relationship_id uuid
      )
  $remote$,
  'P0001',
  'solmind_explorer_accept_lock_unavailable',
  'helper provider-row contention maps to the fixed lock error'
);
select is(
  dblink_exec('s02e_b', 'set statement_timeout=''1500ms'''),
  'SET',
  'B uses caller timeout shorter than the helper lock timeout'
);
select is(
  dblink_send_query(
    's02e_b',
    $query$
      select * from public.solmind_accept_explorer_invitation(
        'a27ec027-5000-4000-8000-000000000007',
        'a27ec027-6000-4000-8000-000000000007',
        'a27ec027-7000-4000-8000-000000000007',
        's02e-concurrency-helper-lock',
        's02e-helper-lock@synthetic.invalid'
      )
    $query$
  ),
  1,
  'B launches caller-cancellation helper-window schedule'
);
select ok(
  pg_temp.s02e_wait_for_any_lock(
    's02e_b',
    (select pid from s02e_pids where connection_name = 'b')
  ),
  'B reaches a helper-owned row lock before caller cancellation'
);
select throws_ok(
  $drain_error$
    select *
      from dblink_get_result('s02e_b')
        result(
          outcome text, user_account_id uuid, explorer_profile_id uuid,
          guide_explorer_relationship_id uuid
        )
  $drain_error$,
  'P0001',
  'solmind_explorer_accept_lock_unavailable',
  'helper-window cancellation preserves the fixed transient lock error'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('s02e_b')
        result(
          outcome text, user_account_id uuid, explorer_profile_id uuid,
          guide_explorer_relationship_id uuid
        )
  ),
  0,
  'failed caller-cancellation result stream is fully drained'
);
select is(
  dblink_exec('s02e_b', 'set statement_timeout=''8s'''),
  'SET',
  'B restores the bounded suite timeout'
);
select is(
  (
    select invitation.invite_status
      from core.explorer_invite invitation
     where invitation.explorer_invite_id =
       'a27ec027-5000-4000-8000-000000000007'
  ),
  'created',
  'helper-lock failures leave the invitation unchanged'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.authorizing_evidence_consumption consumption
     where consumption.verification_challenge_id =
       'a27ec027-6000-4000-8000-000000000007'
  ),
  0,
  'helper-lock failures consume no evidence'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_explorer_relationship relationship
     where relationship.created_from_invite_id =
       'a27ec027-5000-4000-8000-000000000007'
  ),
  0,
  'helper-lock failures create no relationship'
);
select is(
  dblink_exec('s02e_a', 'rollback'),
  'ROLLBACK',
  'A releases the helper-owned provider row'
);

select is(
  dblink_exec('s02e_a', 'reset role'),
  'RESET',
  'A remains postgres for synthetic cleanup'
);
select is(
  dblink_exec('s02e_b', 'reset role'),
  'RESET',
  'B returns to postgres for disconnect'
);

create temporary table s02e_cleanup_account_ids as
select account.user_account_id
  from identity.user_account account
 where account.display_name like 'S02E concurrency%';

select lives_ok(
  $cleanup_call$
    select dblink_exec(
      's02e_a',
      $cleanup$
        delete from audit.audit_event event
         where event.actor_user_account_id in (
                 select account.user_account_id
                   from identity.user_account account
                  where account.display_name like 'S02E concurrency%'
               )
            or event.target_entity_id::text like 'a27ec027-%';

        delete from identity.authorizing_evidence_consumption consumption
         where consumption.verification_challenge_id::text like 'a27ec027-%';
        delete from core.guide_explorer_relationship relationship
         where relationship.created_from_invite_id::text like 'a27ec027-%';
        delete from identity.user_session session
         where session.user_account_id in (
                 select account.user_account_id
                   from identity.user_account account
                  where account.display_name like 'S02E concurrency%'
               );
        delete from core.explorer_profile profile
         where profile.user_account_id in (
                 select account.user_account_id
                   from identity.user_account account
                  where account.display_name like 'S02E concurrency%'
               );
        delete from identity.user_role_assignment assignment
         where assignment.user_account_id in (
                 select account.user_account_id
                   from identity.user_account account
                  where account.display_name like 'S02E concurrency%'
               );
        delete from identity.auth_provider_identity provider_identity
         where provider_identity.user_account_id in (
                 select account.user_account_id
                   from identity.user_account account
                  where account.display_name like 'S02E concurrency%'
               )
            or provider_identity.provider_user_id like 's02e-concurrency-%';
        delete from identity.verification_challenge challenge
         where challenge.verification_challenge_id::text like 'a27ec027-%';
        delete from identity.user_contact_method contact
         where contact.user_account_id in (
                 select account.user_account_id
                   from identity.user_account account
                  where account.display_name like 'S02E concurrency%'
               );
        delete from identity.auth_provider_provisioning_reservation reservation
         where reservation.provisioning_reservation_id::text like 'a27ec027-%';
        delete from core.explorer_invite invitation
         where invitation.explorer_invite_id::text like 'a27ec027-%';
        delete from core.practice_guide practice_guide
         where practice_guide.practice_guide_id::text like 'a27ec027-%';
        delete from core.guide_profile guide_profile
         where guide_profile.guide_profile_id::text like 'a27ec027-%';
        delete from core.practice practice
         where practice.practice_id::text like 'a27ec027-%';
        delete from core.organization organization
         where organization.organization_id::text like 'a27ec027-%';
        delete from identity.user_account account
         where account.display_name like 'S02E concurrency%'
      $cleanup$
    )
  $cleanup_call$,
  'synthetic concurrency fixtures are removed through connection A'
);

select is(
  (
    select pg_catalog.count(*)::integer
      from core.explorer_invite invitation
     where invitation.explorer_invite_id::text like 'a27ec027-%'
  ),
  0,
  'cleanup removes every synthetic invitation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.verification_challenge challenge
     where challenge.verification_challenge_id::text like 'a27ec027-%'
  ),
  0,
  'cleanup removes every synthetic challenge'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.auth_provider_identity provider_identity
     where provider_identity.provider_user_id like 's02e-concurrency-%'
  ),
  0,
  'cleanup removes every synthetic provider binding'
);
select is(
  (
    select pg_catalog.sum(residue_count)::integer
      from (
        select pg_catalog.count(*)::integer as residue_count
          from audit.audit_event event
         where event.actor_user_account_id in (
                 select user_account_id from s02e_cleanup_account_ids
               )
            or event.target_entity_id::text like 'a27ec027-%'
        union all
        select pg_catalog.count(*)::integer
          from identity.authorizing_evidence_consumption consumption
         where consumption.verification_challenge_id::text like 'a27ec027-%'
        union all
        select pg_catalog.count(*)::integer
          from core.guide_explorer_relationship relationship
         where relationship.created_from_invite_id::text like 'a27ec027-%'
        union all
        select pg_catalog.count(*)::integer
          from identity.user_session session
         where session.user_account_id in (
                 select user_account_id from s02e_cleanup_account_ids
               )
        union all
        select pg_catalog.count(*)::integer
          from core.explorer_profile profile
         where profile.user_account_id in (
                 select user_account_id from s02e_cleanup_account_ids
               )
        union all
        select pg_catalog.count(*)::integer
          from identity.user_role_assignment assignment
         where assignment.user_account_id in (
                 select user_account_id from s02e_cleanup_account_ids
               )
        union all
        select pg_catalog.count(*)::integer
          from identity.auth_provider_identity provider_identity
         where provider_identity.user_account_id in (
                 select user_account_id from s02e_cleanup_account_ids
               )
            or provider_identity.provider_user_id like 's02e-concurrency-%'
        union all
        select pg_catalog.count(*)::integer
          from identity.user_contact_method contact
         where contact.user_account_id in (
                 select user_account_id from s02e_cleanup_account_ids
               )
        union all
        select pg_catalog.count(*)::integer
          from identity.auth_provider_provisioning_reservation reservation
         where reservation.provisioning_reservation_id::text like 'a27ec027-%'
        union all
        select pg_catalog.count(*)::integer
          from core.explorer_invite invitation
         where invitation.explorer_invite_id::text like 'a27ec027-%'
        union all
        select pg_catalog.count(*)::integer
          from identity.verification_challenge challenge
         where challenge.verification_challenge_id::text like 'a27ec027-%'
        union all
        select pg_catalog.count(*)::integer
          from core.practice_guide practice_guide
         where practice_guide.practice_guide_id::text like 'a27ec027-%'
        union all
        select pg_catalog.count(*)::integer
          from core.guide_profile guide_profile
         where guide_profile.guide_profile_id::text like 'a27ec027-%'
        union all
        select pg_catalog.count(*)::integer
          from core.practice practice
         where practice.practice_id::text like 'a27ec027-%'
        union all
        select pg_catalog.count(*)::integer
          from core.organization organization
         where organization.organization_id::text like 'a27ec027-%'
        union all
        select pg_catalog.count(*)::integer
          from identity.user_account account
         where account.user_account_id in (
                 select user_account_id from s02e_cleanup_account_ids
               )
            or account.display_name like 'S02E concurrency%'
      ) residue
  ),
  0,
  'cleanup leaves no row in the complete synthetic concurrency fingerprint'
);
select lives_ok(
  $$select dblink_disconnect('s02e_a')$$,
  'connection A disconnects'
);
select lives_ok(
  $$select dblink_disconnect('s02e_b')$$,
  'connection B disconnects'
);

select * from finish();
rollback;
