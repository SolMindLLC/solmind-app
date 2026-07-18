-- P27-B real-function concurrency proofs. Local ephemeral database only.
-- A hard SQL error can leave reserved synthetic rows. Recovery requires Paul's approval:
-- delete matching P27-B synthetic audit, reservation, consumption, session,
-- challenge, invitation, contact, role, and account rows in that FK-safe order.
-- Never run recovery cleanup against hosted or real-user data.

begin;
create extension if not exists dblink;
select plan(67);

create function pg_temp.p27b_wait_for_advisory_lock(
  p_connection text,
  p_pid integer
)
returns boolean
language plpgsql
as $$
begin
  for attempt in 1..40 loop
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
    perform pg_catalog.pg_sleep(0.10);
  end loop;
  return false;
end;
$$;

create function pg_temp.p27b_wait_for_any_lock(
  p_connection text,
  p_pid integer
)
returns boolean
language plpgsql
as $$
begin
  for attempt in 1..40 loop
    if dblink_is_busy(p_connection) = 1
       and exists (
         select 1
           from pg_catalog.pg_stat_activity
          where pid = p_pid
            and wait_event_type = 'Lock'
       ) then
      return true;
    end if;
    perform pg_catalog.pg_sleep(0.10);
  end loop;
  return false;
end;
$$;

create temp table p27b_counts_before as
select
  n.nspname || '.' || c.relname as relation_name,
  (
    xpath(
      '/row/c/text()',
      query_to_xml(
        format('select count(*) c from %I.%I', n.nspname, c.relname),
        false,
        true,
        ''
      )
    )
  )[1]::text::bigint as row_count,
  (
    xpath(
      '/row/fingerprint/text()',
      query_to_xml(
        format(
          'select md5(coalesce(string_agg(to_jsonb(t)::text, '','' order by to_jsonb(t)::text), '''')) fingerprint from %I.%I t',
          n.nspname,
          c.relname
        ),
        false,
        true,
        ''
      )
    )
  )[1]::text as row_fingerprint
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r','p')
  and n.nspname in (
    'identity',
    'core',
    'audit',
    'content',
    'ai',
    'methodology',
    'notification',
    'scheduling'
  );

select cmp_ok(
  (select count(*)::integer from p27b_counts_before),
  '>',
  0,
  'before snapshot is nonempty'
);
select is(
  (
    select count(*)::integer
      from core.guide_invite
     where guide_invite_id::text like 'def50027-7%'
  ),
  0,
  'preflight finds no P27-B concurrency invitation residue'
);
select is(
  (
    select count(*)::integer
      from identity.auth_provider_provisioning_reservation
     where guide_invite_id::text like 'def50027-7%'
  ),
  0,
  'preflight finds no P27-B concurrency reservation residue'
);
select is(
  (
    select count(*)::integer
      from identity.authorizing_evidence_consumption
     where verification_challenge_id::text like 'def50027-7%'
  ),
  0,
  'preflight finds no P27-B concurrency consumption residue'
);

select lives_ok(
  $$select dblink_connect(
    'p27b_a',
    'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres connect_timeout=5'
  )$$,
  'connection A opens'
);
select lives_ok(
  $$select dblink_connect(
    'p27b_b',
    'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres connect_timeout=5'
  )$$,
  'connection B opens'
);
select is(
  dblink_exec('p27b_a', 'set statement_timeout=''8s'''),
  'SET',
  'connection A timeout is bounded'
);
select is(
  dblink_exec('p27b_b', 'set statement_timeout=''8s'''),
  'SET',
  'connection B timeout is bounded'
);

create temp table p27b_pids (
  connection_name text primary key,
  pid integer
) on commit drop;
insert into p27b_pids
select 'a', pid
  from dblink('p27b_a', 'select pg_backend_pid()') result(pid integer)
union all
select 'b', pid
  from dblink('p27b_b', 'select pg_backend_pid()') result(pid integer);
select is(
  (
    select count(distinct pid)::integer
      from (
        select pg_backend_pid() as pid
        union all
        select pid from p27b_pids
      ) sessions
  ),
  3,
  'orchestrator and both dblink connections are distinct sessions'
);

select is(
  dblink_exec(
    'p27b_a',
    $setup$
      insert into identity.user_account (
        user_account_id,display_name,account_status
      ) values
        (
          'def50027-7000-4000-8000-000000000001',
          'P27-B concurrency Admin',
          'active'
        ),
        (
          'def50027-7000-4000-8000-000000000002',
          'P27-B concurrency existing account',
          'active'
        ),
        (
          'def50027-7000-4000-8000-000000000003',
          'P27-B concurrency session-first account',
          'active'
        );
      insert into identity.user_role_assignment (
        user_role_assignment_id,user_account_id,role_code,role_status
      ) values
        (
          'def50027-7100-4000-8000-000000000001',
          'def50027-7000-4000-8000-000000000001',
          'admin',
          'active'
        ),
        (
          'def50027-7100-4000-8000-000000000002',
          'def50027-7000-4000-8000-000000000002',
          'admin',
          'active'
        ),
        (
          'def50027-7100-4000-8000-000000000003',
          'def50027-7000-4000-8000-000000000003',
          'admin',
          'active'
        );
      insert into identity.user_contact_method (
        user_contact_method_id,user_account_id,contact_method_type,contact_label,
        contact_value,normalized_contact_value,login_enabled,is_verified,verified_at,status
      ) values
        (
          'def50027-7200-4000-8000-000000000001',
          'def50027-7000-4000-8000-000000000002',
          'email',
          'primary',
          'p27b-session-race@synthetic.invalid',
          'p27b-session-race@synthetic.invalid',
          true,
          true,
          clock_timestamp()-interval '1 hour',
          'active'
        ),
        (
          'def50027-7200-4000-8000-000000000002',
          'def50027-7000-4000-8000-000000000003',
          'email',
          'primary',
          'p27b-session-first@synthetic.invalid',
          'p27b-session-first@synthetic.invalid',
          true,
          true,
          clock_timestamp()-interval '1 hour',
          'active'
        );
      insert into identity.auth_provider_identity (
        auth_provider_identity_id,user_account_id,provider_name,
        provider_user_id,provider_email,status
      ) values
        (
          'def50027-7250-4000-8000-000000000001',
          'def50027-7000-4000-8000-000000000002',
          'supabase',
          'p27b-concurrency-provider-existing',
          'p27b-session-race@synthetic.invalid',
          'active'
        ),
        (
          'def50027-7250-4000-8000-000000000002',
          'def50027-7000-4000-8000-000000000003',
          'supabase',
          'p27b-concurrency-provider-session-first',
          'p27b-session-first@synthetic.invalid',
          'active'
        );
      insert into core.guide_invite (
        guide_invite_id,invited_contact_value,normalized_contact_value,
        contact_method_type,invited_by_user_account_id,invite_status,expires_at,sent_at
      ) values
        (
          'def50027-7300-4000-8000-000000000001',
          'p27b-prepare-race@synthetic.invalid',
          'p27b-prepare-race@synthetic.invalid',
          'email',
          'def50027-7000-4000-8000-000000000001',
          'sent',
          clock_timestamp()+interval '1 day',
          clock_timestamp()
        ),
        (
          'def50027-7300-4000-8000-000000000002',
          'p27b-session-race@synthetic.invalid',
          'p27b-session-race@synthetic.invalid',
          'email',
          'def50027-7000-4000-8000-000000000001',
          'sent',
          clock_timestamp()+interval '1 day',
          clock_timestamp()
        ),
        (
          'def50027-7300-4000-8000-000000000003',
          'p27b-session-first@synthetic.invalid',
          'p27b-session-first@synthetic.invalid',
          'email',
          'def50027-7000-4000-8000-000000000001',
          'sent',
          clock_timestamp()+interval '1 day',
          clock_timestamp()
        );
      insert into identity.verification_challenge (
        verification_challenge_id,user_account_id,user_contact_method_id,
        normalized_contact_value,contact_method_type,purpose,delivery_channel,
        code_hash,expires_at,used_at
      ) values
        (
          'def50027-7400-4000-8000-000000000001',
          null,
          null,
          'p27b-prepare-race@synthetic.invalid',
          'email',
          'contact_verify',
          'email',
          'svf1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          clock_timestamp()+interval '10 minutes',
          clock_timestamp()
        ),
        (
          'def50027-7400-4000-8000-000000000002',
          'def50027-7000-4000-8000-000000000002',
          'def50027-7200-4000-8000-000000000001',
          'p27b-session-race@synthetic.invalid',
          'email',
          'login',
          'email',
          'svf1:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          clock_timestamp()+interval '10 minutes',
          clock_timestamp()
        ),
        (
          'def50027-7400-4000-8000-000000000003',
          'def50027-7000-4000-8000-000000000003',
          'def50027-7200-4000-8000-000000000002',
          'p27b-session-first@synthetic.invalid',
          'email',
          'login',
          'email',
          'svf1:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
          clock_timestamp()+interval '10 minutes',
          clock_timestamp()
        )
    $setup$
  ),
  'INSERT 0 3',
  'owner commits the complete synthetic concurrency fixture'
);
select is(
  (
    select count(*)::integer
      from identity.verification_challenge
     where verification_challenge_id::text like 'def50027-74%'
  ),
  3,
  'orchestrator observes all three committed challenge fixtures'
);

select is(dblink_exec('p27b_a', 'set role service_role'), 'SET', 'A assumes service_role');
select is(dblink_exec('p27b_b', 'set role service_role'), 'SET', 'B assumes service_role');
select is(dblink_exec('p27b_a', 'begin'), 'BEGIN', 'A begins prepare-versus-prepare race');
create temp table p27b_a_prepare_first as
select *
  from dblink(
    'p27b_a',
    $query$
      select * from public.solmind_prepare_guide_invitation_acceptance(
        'def50027-7300-4000-8000-000000000001',
        'def50027-7400-4000-8000-000000000001',
        'p27b-prepare-race@synthetic.invalid'
      )
    $query$
  ) result(outcome text, provisioning_reservation_id uuid);
select is(
  (select outcome from p27b_a_prepare_first),
  'created',
  'A creates the first reservation while retaining the evidence lock'
);
select ok(
  dblink_send_query(
    'p27b_b',
    $query$
      select * from public.solmind_prepare_guide_invitation_acceptance(
        'def50027-7300-4000-8000-000000000001',
        'def50027-7400-4000-8000-000000000001',
        'p27b-prepare-race@synthetic.invalid'
      )
    $query$
  ) = 1,
  'B submits simultaneous exact preparation'
);
select ok(
  pg_temp.p27b_wait_for_advisory_lock(
    'p27b_b',
    (select pid from p27b_pids where connection_name = 'b')
  ),
  'B visibly waits on the shared evidence advisory lock'
);
select is(
  dblink_exec('p27b_a', 'commit'),
  'COMMIT',
  'A commits the first reservation and audit'
);
create temp table p27b_b_prepare_retry as
select *
  from dblink_get_result('p27b_b')
    result(outcome text, provisioning_reservation_id uuid);
select * from dblink_get_result('p27b_b')
  result(outcome text, provisioning_reservation_id uuid);
select is(
  (select outcome from p27b_b_prepare_retry),
  'existing',
  'B observes A commit and returns existing'
);
select is(
  (select provisioning_reservation_id from p27b_b_prepare_retry),
  (select provisioning_reservation_id from p27b_a_prepare_first),
  'concurrent exact preparation returns the same reservation UUID'
);
select is(
  (
    select count(*)::integer
      from identity.auth_provider_provisioning_reservation
     where guide_invite_id = 'def50027-7300-4000-8000-000000000001'
  ),
  1,
  'prepare-versus-prepare creates one reservation'
);
select is(
  (
    select count(*)::integer
      from audit.audit_event
     where target_entity_id = (
       select provisioning_reservation_id from p27b_a_prepare_first
     )
       and event_type = 'auth_provider_provisioning_reserved'
  ),
  1,
  'prepare-versus-prepare creates one reservation audit'
);
select is(
  (
    select count(*)::integer
      from identity.authorizing_evidence_consumption
     where verification_challenge_id = 'def50027-7400-4000-8000-000000000001'
  ),
  0,
  'prepare-versus-prepare consumes no authorizing evidence'
);

select is(
  dblink_exec('p27b_a', 'begin'),
  'BEGIN',
  'A begins the forced preparation lock-timeout schedule'
);
select is(
  dblink_exec(
    'p27b_a',
    $lock$
      do $body$
      begin
        perform pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtextextended(
            'solmind:authorizing-evidence:v1|def50027-7400-4000-8000-000000000001',
            0
          )
        );
      end;
      $body$
    $lock$
  ),
  'DO',
  'A holds the exact P27-B evidence advisory lock'
);
select throws_ok(
  $remote$
    select *
      from dblink(
        'p27b_b',
        $query$
          select * from public.solmind_prepare_guide_invitation_acceptance(
            'def50027-7300-4000-8000-000000000001',
            'def50027-7400-4000-8000-000000000001',
            'p27b-prepare-race@synthetic.invalid'
          )
        $query$
      ) result(outcome text, provisioning_reservation_id uuid)
  $remote$,
  'P0001',
  'solmind_invitation_prepare_lock_unavailable',
  'real evidence-lock contention maps to the fixed value-free lock error'
);
select is(
  (
    select count(*)::integer
      from identity.auth_provider_provisioning_reservation
     where guide_invite_id = 'def50027-7300-4000-8000-000000000001'
  ),
  1,
  'forced lock timeout creates no additional reservation'
);
select is(
  (
    select count(*)::integer
      from audit.audit_event
     where target_entity_id = (
       select provisioning_reservation_id from p27b_a_prepare_first
     )
       and event_type = 'auth_provider_provisioning_reserved'
  ),
  1,
  'forced lock timeout creates no additional reservation audit'
);
select is(
  (
    select count(*)::integer
      from identity.authorizing_evidence_consumption
     where verification_challenge_id = 'def50027-7400-4000-8000-000000000001'
  ),
  0,
  'forced lock timeout consumes no authorizing evidence'
);
select is(
  dblink_exec('p27b_a', 'rollback'),
  'ROLLBACK',
  'A releases the forced evidence lock'
);

select is(
  dblink_exec('p27b_a', 'begin'),
  'BEGIN',
  'A begins a transactionally consistent policy-read schedule'
);
create temp table p27b_a_policy_reader as
select *
  from dblink(
    'p27b_a',
    $query$
      select * from public.solmind_prepare_guide_invitation_acceptance(
        'def50027-7300-4000-8000-000000000001',
        'def50027-7400-4000-8000-000000000001',
        'p27b-prepare-race@synthetic.invalid'
      )
    $query$
  ) result(outcome text, provisioning_reservation_id uuid);
select is(
  (select outcome from p27b_a_policy_reader),
  'existing',
  'A exact retry reads one valid policy row while retaining its shared lock'
);
select is(
  dblink_exec('p27b_b', 'reset role'),
  'RESET',
  'B returns to owner for the synthetic policy update'
);
select ok(
  dblink_send_query(
    'p27b_b',
    $query$
      update identity.invitation_acceptance_freshness_policy
         set active_seconds = 301
       where policy_name = 'invitation_acceptance_evidence_freshness'
      returning active_seconds
    $query$
  ) = 1,
  'B submits a concurrent policy update'
);
select ok(
  pg_temp.p27b_wait_for_any_lock(
    'p27b_b',
    (select pid from p27b_pids where connection_name = 'b')
  ),
  'B visibly waits for the preparation policy reader'
);
select is(
  dblink_exec('p27b_a', 'commit'),
  'COMMIT',
  'A commits before the policy update proceeds'
);
select is(
  (
    select active_seconds
      from dblink_get_result('p27b_b')
        result(active_seconds integer)
  ),
  301,
  'B policy update proceeds only after A releases its shared policy lock'
);
select *
  from dblink_get_result('p27b_b')
    result(active_seconds integer);
select is(
  dblink_exec(
    'p27b_b',
    $query$
      update identity.invitation_acceptance_freshness_policy
         set active_seconds = 300
       where policy_name = 'invitation_acceptance_evidence_freshness'
    $query$
  ),
  'UPDATE 1',
  'B restores the exact initial active freshness value'
);
select is(
  dblink_exec('p27b_b', 'set role service_role'),
  'SET',
  'B restores service_role after the policy schedule'
);

select is(
  dblink_exec('p27b_a', 'begin'),
  'BEGIN',
  'A begins prepare-versus-session race'
);
create temp table p27b_a_prepare_session_race as
select *
  from dblink(
    'p27b_a',
    $query$
      select * from public.solmind_prepare_guide_invitation_acceptance(
        'def50027-7300-4000-8000-000000000002',
        'def50027-7400-4000-8000-000000000002',
        'p27b-session-race@synthetic.invalid'
      )
    $query$
  ) result(outcome text, provisioning_reservation_id uuid);
select is(
  (select outcome from p27b_a_prepare_session_race),
  'created',
  'A creates preparation while retaining the shared evidence lock'
);
select ok(
  dblink_send_query(
    'p27b_b',
    $query$
      select * from public.solmind_create_user_session(
        'def50027-7000-4000-8000-000000000002',
        'admin',
        'def50027-7400-4000-8000-000000000002',
        'login',
        300
      )
    $query$
  ) = 1,
  'B submits session consumption against the same evidence'
);
select ok(
  pg_temp.p27b_wait_for_advisory_lock(
    'p27b_b',
    (select pid from p27b_pids where connection_name = 'b')
  ),
  'session consumer visibly waits on the same evidence advisory lock'
);
select is(
  dblink_exec('p27b_a', 'commit'),
  'COMMIT',
  'A commits preparation before the session consumer proceeds'
);
create temp table p27b_b_session_result as
select *
  from dblink_get_result('p27b_b')
    result(outcome text, user_session_id uuid, expires_at timestamptz);
select * from dblink_get_result('p27b_b')
  result(outcome text, user_session_id uuid, expires_at timestamptz);
select is(
  (select outcome from p27b_b_session_result),
  'created',
  'session consumer proceeds after preparation and consumes the evidence once'
);
select is(
  (
    select count(*)::integer
      from identity.authorizing_evidence_consumption
     where verification_challenge_id = 'def50027-7400-4000-8000-000000000002'
       and consumer_type = 'user_session'
  ),
  1,
  'prepare-versus-session leaves one shared-consumption winner'
);
set local role service_role;
select throws_ok(
  $$select * from public.solmind_prepare_guide_invitation_acceptance(
    'def50027-7300-4000-8000-000000000002',
    'def50027-7400-4000-8000-000000000002',
    'p27b-session-race@synthetic.invalid'
  )$$,
  'P0001',
  'solmind_invitation_prepare_evidence_consumed',
  'later preparation retry denies after the session wins evidence consumption'
);
reset role;
select is(
  (
    select count(*)::integer
      from identity.auth_provider_provisioning_reservation
     where guide_invite_id = 'def50027-7300-4000-8000-000000000002'
  ),
  1,
  'session-winning schedule preserves one detectable immutable reservation'
);
select is(
  (
    select count(*)::integer
      from audit.audit_event
     where target_entity_id = (
       select provisioning_reservation_id from p27b_a_prepare_session_race
     )
       and event_type = 'auth_provider_provisioning_reserved'
  ),
  1,
  'session-winning schedule does not grow reservation audit on denied retry'
);

create temp table p27b_reservation_audit_before_session_first as
select count(*)::integer as audit_count
  from audit.audit_event
 where event_type = 'auth_provider_provisioning_reserved';

select is(
  dblink_exec('p27b_a', 'begin'),
  'BEGIN',
  'A begins the session-first evidence race'
);
create temp table p27b_a_session_first as
select *
  from dblink(
    'p27b_a',
    $query$
      select * from public.solmind_create_user_session(
        'def50027-7000-4000-8000-000000000003',
        'admin',
        'def50027-7400-4000-8000-000000000003',
        'login',
        300
      )
    $query$
  ) result(outcome text, user_session_id uuid, expires_at timestamptz);
select is(
  (select outcome from p27b_a_session_first),
  'created',
  'A creates the session while retaining the shared evidence lock'
);
select ok(
  dblink_send_query(
    'p27b_b',
    $query$
      select * from public.solmind_prepare_guide_invitation_acceptance(
        'def50027-7300-4000-8000-000000000003',
        'def50027-7400-4000-8000-000000000003',
        'p27b-session-first@synthetic.invalid'
      )
    $query$
  ) = 1,
  'B submits preparation against session-held evidence'
);
select ok(
  pg_temp.p27b_wait_for_advisory_lock(
    'p27b_b',
    (select pid from p27b_pids where connection_name = 'b')
  ),
  'preparation visibly waits on the session-held evidence advisory lock'
);
select is(
  dblink_exec('p27b_a', 'commit'),
  'COMMIT',
  'A commits evidence consumption before preparation proceeds'
);
select throws_ok(
  $remote$
    select *
      from dblink_get_result('p27b_b')
        result(outcome text, provisioning_reservation_id uuid)
  $remote$,
  'P0001',
  'solmind_invitation_prepare_evidence_consumed',
  'session-first schedule denies preparation after observing committed consumption'
);
select * from dblink_get_result('p27b_b')
  result(outcome text, provisioning_reservation_id uuid);
select is(
  (
    select count(*)::integer
      from identity.auth_provider_provisioning_reservation
     where guide_invite_id = 'def50027-7300-4000-8000-000000000003'
  ),
  0,
  'session-first schedule creates no reservation'
);
select is(
  (
    select count(*)::integer
      from audit.audit_event
     where event_type = 'auth_provider_provisioning_reserved'
  ),
  (
    select audit_count
      from p27b_reservation_audit_before_session_first
  ),
  'session-first schedule creates no reservation audit'
);
select is(
  (
    select count(*)::integer
      from identity.authorizing_evidence_consumption
     where verification_challenge_id = 'def50027-7400-4000-8000-000000000003'
       and consumer_type = 'user_session'
  ),
  1,
  'session-first schedule leaves exactly one committed evidence consumer'
);

select is(dblink_exec('p27b_a', 'reset role'), 'RESET', 'A returns to owner for cleanup');
select is(dblink_exec('p27b_b', 'reset role'), 'RESET', 'B returns to owner for cleanup');
select is(
  dblink_exec(
    'p27b_a',
    $cleanup$
      delete from audit.audit_event
       where target_entity_id in (
         select provisioning_reservation_id
           from identity.auth_provider_provisioning_reservation
          where guide_invite_id::text like 'def50027-73%'
       )
          or actor_user_account_id::text like 'def50027-7000-4000-8000-00000000000%';
      delete from identity.authorizing_evidence_consumption
       where verification_challenge_id::text like 'def50027-74%';
      delete from identity.user_session
       where user_account_id::text like 'def50027-7000-4000-8000-00000000000%';
      delete from identity.auth_provider_identity
       where user_account_id::text like 'def50027-7000-4000-8000-00000000000%';
      delete from identity.auth_provider_provisioning_reservation
       where guide_invite_id::text like 'def50027-73%';
      delete from identity.verification_challenge
       where verification_challenge_id::text like 'def50027-74%';
      delete from core.guide_invite
       where guide_invite_id::text like 'def50027-73%';
      delete from identity.user_contact_method
       where user_account_id::text like 'def50027-70%';
      delete from identity.user_role_assignment
       where user_account_id::text like 'def50027-70%';
      delete from identity.user_account
       where user_account_id::text like 'def50027-70%'
    $cleanup$
  ),
  'DELETE 3',
  'owner cleanup removes the complete synthetic fixture'
);

select is(
  (
    select count(*)::integer
      from core.guide_invite
     where guide_invite_id::text like 'def50027-7%'
  ),
  0,
  'no P27-B concurrency invitation residue remains'
);
select is(
  (
    select count(*)::integer
      from identity.auth_provider_provisioning_reservation
     where guide_invite_id::text like 'def50027-7%'
  ),
  0,
  'no P27-B concurrency reservation residue remains'
);
select is(
  (
    select count(*)::integer
      from identity.authorizing_evidence_consumption
     where verification_challenge_id::text like 'def50027-7%'
  ),
  0,
  'no P27-B concurrency consumption residue remains'
);

create temp table p27b_counts_after as
select
  n.nspname || '.' || c.relname as relation_name,
  (
    xpath(
      '/row/c/text()',
      query_to_xml(
        format('select count(*) c from %I.%I', n.nspname, c.relname),
        false,
        true,
        ''
      )
    )
  )[1]::text::bigint as row_count,
  (
    xpath(
      '/row/fingerprint/text()',
      query_to_xml(
        format(
          'select md5(coalesce(string_agg(to_jsonb(t)::text, '','' order by to_jsonb(t)::text), '''')) fingerprint from %I.%I t',
          n.nspname,
          c.relname
        ),
        false,
        true,
        ''
      )
    )
  )[1]::text as row_fingerprint
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r','p')
  and n.nspname in (
    'identity',
    'core',
    'audit',
    'content',
    'ai',
    'methodology',
    'notification',
    'scheduling'
  );
select results_eq(
  $$select relation_name,row_count,row_fingerprint
      from p27b_counts_after order by 1$$,
  $$select relation_name,row_count,row_fingerprint
      from p27b_counts_before order by 1$$,
  'all application-table contents return exactly to baseline'
);
select lives_ok(
  $$select dblink_disconnect('p27b_a')$$,
  'connection A disconnects'
);
select lives_ok(
  $$select dblink_disconnect('p27b_b')$$,
  'connection B disconnects'
);

select * from finish();
rollback;
