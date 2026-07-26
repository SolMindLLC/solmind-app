-- PRJ01_F-WS06-WI008-S02D real multi-connection proofs.
-- Local ephemeral database only. Never run synthetic cleanup against hosted or
-- real-user data.

begin;
create extension if not exists dblink;
select plan(78);

create function pg_temp.s02d_wait_for_lock(
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

create temp table s02d_before as
select n.nspname || '.' || c.relname as relation_name,
       (
         xpath(
           '/row/c/text()',
           query_to_xml(
             pg_catalog.format(
               'select count(*) c from %I.%I',
               n.nspname,
               c.relname
             ),
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
             pg_catalog.format(
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
 where c.relkind in ('r', 'p')
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
  (select pg_catalog.count(*)::integer from s02d_before),
  '>',
  0,
  'before fingerprint covers application tables'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.explorer_invite
     where explorer_invite_id::text like 'a27d0031-%'
  ),
  0,
  'preflight finds no S02D invitation residue'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_account
     where user_account_id::text like 'a27d0031-%'
  ),
  0,
  'preflight finds no S02D identity residue'
);

select lives_ok(
  pg_catalog.format(
    $q$select dblink_connect(
      's02d_a',
      'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5'
    )$q$,
    pg_catalog.current_database()
  ),
  'connection A opens'
);
select lives_ok(
  pg_catalog.format(
    $q$select dblink_connect(
      's02d_b',
      'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5'
    )$q$,
    pg_catalog.current_database()
  ),
  'connection B opens'
);
select is(
  dblink_exec('s02d_a', 'set statement_timeout=''8s'''),
  'SET',
  'connection A statement timeout is bounded'
);
select is(
  dblink_exec('s02d_b', 'set statement_timeout=''8s'''),
  'SET',
  'connection B statement timeout is bounded'
);

create temp table s02d_pids (
  name text primary key,
  pid integer
) on commit drop;
insert into s02d_pids
select 'a', pid
  from dblink(
    's02d_a',
    'select pg_backend_pid()'
  ) result(pid integer)
union all
select 'b', pid
  from dblink(
    's02d_b',
    'select pg_backend_pid()'
  ) result(pid integer);

select is(
  (
    select pg_catalog.count(distinct pid)::integer
      from (
        select pg_backend_pid() as pid
        union all
        select pid from s02d_pids
      ) sessions
  ),
  3,
  'orchestrator and workers use three distinct sessions'
);

select lives_ok(
  $setup_call$
    select dblink_exec(
      's02d_a',
      $setup$
        insert into identity.user_account (
          user_account_id,
          display_name,
          account_status
        ) values
          (
            'a27d0031-0000-4000-8000-000000000101',
            'S02D Concurrency Guide One',
            'active'
          ),
          (
            'a27d0031-0000-4000-8000-000000000102',
            'S02D Concurrency Guide Two',
            'active'
          );

        insert into identity.user_role_assignment (
          user_role_assignment_id,
          user_account_id,
          role_code,
          role_status,
          granted_by_role_context
        ) values
          (
            'a27d0031-1000-4000-8000-000000000101',
            'a27d0031-0000-4000-8000-000000000101',
            'guide',
            'active',
            'system'
          ),
          (
            'a27d0031-1000-4000-8000-000000000102',
            'a27d0031-0000-4000-8000-000000000102',
            'guide',
            'active',
            'system'
          );

        insert into identity.user_session (
          user_session_id,
          user_account_id,
          active_role_context,
          created_at,
          expires_at,
          session_status
        ) values
          (
            'a27d0031-2000-4000-8000-000000000101',
            'a27d0031-0000-4000-8000-000000000101',
            'guide',
            now() - interval '1 minute',
            now() + interval '2 hours',
            'active'
          ),
          (
            'a27d0031-2000-4000-8000-000000000102',
            'a27d0031-0000-4000-8000-000000000102',
            'guide',
            now() - interval '1 minute',
            now() + interval '2 hours',
            'active'
          );

        insert into core.organization (
          organization_id,
          organization_name,
          approval_status,
          approved_by_user_account_id,
          approved_at,
          status
        ) values (
          'a27d0031-3000-4000-8000-000000000101',
          'S02D concurrency organization',
          'approved',
          'a27d0031-0000-4000-8000-000000000101',
          now() - interval '1 day',
          'active'
        );

        insert into core.practice (
          practice_id,
          organization_id,
          practice_name,
          approval_status,
          approved_by_user_account_id,
          approved_at,
          status
        ) values (
          'a27d0031-3100-4000-8000-000000000101',
          'a27d0031-3000-4000-8000-000000000101',
          'S02D concurrency practice',
          'approved',
          'a27d0031-0000-4000-8000-000000000101',
          now() - interval '1 day',
          'active'
        );

        insert into core.guide_profile (
          guide_profile_id,
          user_account_id,
          guide_display_name,
          setup_status,
          approved_by_user_account_id,
          approved_at,
          status
        ) values
          (
            'a27d0031-3200-4000-8000-000000000101',
            'a27d0031-0000-4000-8000-000000000101',
            'S02D Concurrency Guide One',
            'approved',
            'a27d0031-0000-4000-8000-000000000101',
            now() - interval '1 day',
            'active'
          ),
          (
            'a27d0031-3200-4000-8000-000000000102',
            'a27d0031-0000-4000-8000-000000000102',
            'S02D Concurrency Guide Two',
            'approved',
            'a27d0031-0000-4000-8000-000000000101',
            now() - interval '1 day',
            'active'
          );

        insert into core.practice_guide (
          practice_guide_id,
          practice_id,
          guide_profile_id,
          relationship_status,
          is_primary_for_mvp0,
          created_by_user_account_id
        ) values
          (
            'a27d0031-3300-4000-8000-000000000101',
            'a27d0031-3100-4000-8000-000000000101',
            'a27d0031-3200-4000-8000-000000000101',
            'active',
            true,
            'a27d0031-0000-4000-8000-000000000101'
          ),
          (
            'a27d0031-3300-4000-8000-000000000102',
            'a27d0031-3100-4000-8000-000000000101',
            'a27d0031-3200-4000-8000-000000000102',
            'active',
            true,
            'a27d0031-0000-4000-8000-000000000101'
          );

        insert into core.explorer_invite (
          explorer_invite_id,
          guide_profile_id,
          practice_id,
          invited_contact_value,
          normalized_contact_value,
          contact_method_type,
          invited_name,
          invite_status,
          expires_at
        ) values
          (
            'a27d0031-5000-4000-8000-000000000301',
            'a27d0031-3200-4000-8000-000000000101',
            'a27d0031-3100-4000-8000-000000000101',
            'replacement-race@synthetic.invalid',
            'replacement-race@synthetic.invalid',
            'email',
            'Replacement Initial',
            'created',
            now() + interval '1 hour'
          ),
          (
            'a27d0031-5000-4000-8000-000000000401',
            'a27d0031-3200-4000-8000-000000000101',
            'a27d0031-3100-4000-8000-000000000101',
            'revoke-first@synthetic.invalid',
            'revoke-first@synthetic.invalid',
            'email',
            'Revoke First Initial',
            'created',
            now() + interval '1 hour'
          ),
          (
            'a27d0031-5000-4000-8000-000000000501',
            'a27d0031-3200-4000-8000-000000000101',
            'a27d0031-3100-4000-8000-000000000101',
            'issue-first@synthetic.invalid',
            'issue-first@synthetic.invalid',
            'email',
            'Issue First Initial',
            'created',
            now() + interval '1 hour'
          ),
          (
            'a27d0031-5000-4000-8000-000000000601',
            'a27d0031-3200-4000-8000-000000000101',
            'a27d0031-3100-4000-8000-000000000101',
            'double-revoke@synthetic.invalid',
            'double-revoke@synthetic.invalid',
            'email',
            'Double Revoke',
            'created',
            now() + interval '1 hour'
          ),
          (
            'a27d0031-5000-4000-8000-000000000801',
            'a27d0031-3200-4000-8000-000000000101',
            'a27d0031-3100-4000-8000-000000000101',
            'revoke-timeout@synthetic.invalid',
            'revoke-timeout@synthetic.invalid',
            'email',
            'Revoke Timeout',
            'created',
            now() + interval '1 hour'
          );
      $setup$
    )
  $setup_call$,
  'concurrency fixture commits through A'
);
select is(
  dblink_exec('s02d_a', 'set role service_role'),
  'SET',
  'A assumes service_role'
);
select is(
  dblink_exec('s02d_b', 'set role service_role'),
  'SET',
  'B assumes service_role'
);

-- Exact-request race: first commit issues, second returns exact writeless
-- recovery after waiting on the shared invitation/contact/sibling domain.
select is(
  dblink_exec('s02d_a', 'begin'),
  'BEGIN',
  'A begins exact-request race'
);
create temp table s02d_retry_a as
select *
  from dblink(
    's02d_a',
    $call$
      select *
        from public.solmind_issue_explorer_invitation(
          'a27d0031-5000-4000-8000-000000000201',
          'a27d0031-0000-4000-8000-000000000101',
          'a27d0031-2000-4000-8000-000000000101',
          'a27d0031-3200-4000-8000-000000000101',
          'a27d0031-3100-4000-8000-000000000101',
          'email',
          'retry-race@synthetic.invalid',
          'retry-race@synthetic.invalid',
          'Retry Race'
        )
    $call$
  ) result(
    outcome text,
    explorer_invite_id uuid,
    expires_at timestamptz
  );
select is(
  (select outcome from s02d_retry_a),
  'issued',
  'A issues inside its open transaction'
);
select is(
  dblink_send_query(
    's02d_b',
    $call$
      select *
        from public.solmind_issue_explorer_invitation(
          'a27d0031-5000-4000-8000-000000000201',
          'a27d0031-0000-4000-8000-000000000101',
          'a27d0031-2000-4000-8000-000000000101',
          'a27d0031-3200-4000-8000-000000000101',
          'a27d0031-3100-4000-8000-000000000101',
          'email',
          'retry-race@synthetic.invalid',
          'retry-race@synthetic.invalid',
          'Retry Race'
        )
    $call$
  ),
  1,
  'B launches the exact same request asynchronously'
);
select ok(
  pg_temp.s02d_wait_for_lock(
    's02d_b',
    (select pid from s02d_pids where name = 'b')
  ),
  'B waits on the shared exact-request domain'
);
select is(
  dblink_exec('s02d_a', 'commit'),
  'COMMIT',
  'A commits exact-request winner'
);
create temp table s02d_retry_b as
select *
  from dblink_get_result('s02d_b') result(
    outcome text,
    explorer_invite_id uuid,
    expires_at timestamptz
  );
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('s02d_b') result(
        outcome text,
        explorer_invite_id uuid,
        expires_at timestamptz
      )
  ),
  0,
  'exact-request result stream is fully drained'
);
select is(
  (select outcome from s02d_retry_b),
  'existing',
  'B returns exact committed-response recovery'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id =
           'a27d0031-5000-4000-8000-000000000201'
       and event_type = 'explorer_invite_issued'
  ),
  1,
  'exact-request race writes one issuance audit'
);

-- P27D-R4: two Guides race the only normalized-contact slot.
select is(
  dblink_exec('s02d_a', 'begin'),
  'BEGIN',
  'A begins cross-Guide capacity race'
);
create temp table s02d_capacity_a as
select *
  from dblink(
    's02d_a',
    $call$
      select *
        from public.solmind_issue_explorer_invitation(
          'a27d0031-5000-4000-8000-000000000202',
          'a27d0031-0000-4000-8000-000000000101',
          'a27d0031-2000-4000-8000-000000000101',
          'a27d0031-3200-4000-8000-000000000101',
          'a27d0031-3100-4000-8000-000000000101',
          'email',
          'capacity-race@synthetic.invalid',
          'capacity-race@synthetic.invalid',
          'Capacity Race One'
        )
    $call$
  ) result(
    outcome text,
    explorer_invite_id uuid,
    expires_at timestamptz
  );
select is(
  (select outcome from s02d_capacity_a),
  'issued',
  'A occupies the sole contact slot'
);
select is(
  dblink_send_query(
    's02d_b',
    $call$
      select *
        from public.solmind_issue_explorer_invitation(
          'a27d0031-5000-4000-8000-000000000203',
          'a27d0031-0000-4000-8000-000000000102',
          'a27d0031-2000-4000-8000-000000000102',
          'a27d0031-3200-4000-8000-000000000102',
          'a27d0031-3100-4000-8000-000000000101',
          'email',
          'capacity-race@synthetic.invalid',
          'capacity-race@synthetic.invalid',
          'Capacity Race Two'
        )
    $call$
  ),
  1,
  'B launches competing Guide issuance'
);
select ok(
  pg_temp.s02d_wait_for_lock(
    's02d_b',
    (select pid from s02d_pids where name = 'b')
  ),
  'B waits on normalized-contact capacity serialization'
);
select is(
  dblink_exec('s02d_a', 'commit'),
  'COMMIT',
  'A commits the first slot claim'
);
select throws_ok(
  $drain_error$
    select *
      from dblink_get_result('s02d_b') result(
        outcome text,
        explorer_invite_id uuid,
        expires_at timestamptz
      )
  $drain_error$,
  'P0001',
  'solmind_explorer_issue_capacity_reached',
  'B receives the fixed writeless capacity denial'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('s02d_b') result(
        outcome text,
        explorer_invite_id uuid,
        expires_at timestamptz
      )
  ),
  0,
  'capacity-race error stream is fully drained'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.explorer_invite
     where normalized_contact_value =
           'capacity-race@synthetic.invalid'
       and invite_status in ('created', 'sent')
  ),
  1,
  'cross-Guide race never exceeds the configured cap'
);

-- P27D-R6: two serialized same-Guide replacements leave the later committed
-- replacement as the sole open survivor.
select is(
  dblink_exec('s02d_a', 'begin'),
  'BEGIN',
  'A begins same-Guide replacement race'
);
create temp table s02d_replace_a as
select *
  from dblink(
    's02d_a',
    $call$
      select *
        from public.solmind_issue_explorer_invitation(
          'a27d0031-5000-4000-8000-000000000302',
          'a27d0031-0000-4000-8000-000000000101',
          'a27d0031-2000-4000-8000-000000000101',
          'a27d0031-3200-4000-8000-000000000101',
          'a27d0031-3100-4000-8000-000000000101',
          'email',
          'replacement-race@synthetic.invalid',
          'replacement-race@synthetic.invalid',
          'Replacement A'
        )
    $call$
  ) result(
    outcome text,
    explorer_invite_id uuid,
    expires_at timestamptz
  );
select is(
  (select outcome from s02d_replace_a),
  'issued',
  'A creates the first replacement'
);
select is(
  dblink_send_query(
    's02d_b',
    $call$
      select *
        from public.solmind_issue_explorer_invitation(
          'a27d0031-5000-4000-8000-000000000303',
          'a27d0031-0000-4000-8000-000000000101',
          'a27d0031-2000-4000-8000-000000000101',
          'a27d0031-3200-4000-8000-000000000101',
          'a27d0031-3100-4000-8000-000000000101',
          'email',
          'replacement-race@synthetic.invalid',
          'replacement-race@synthetic.invalid',
          'Replacement B'
        )
    $call$
  ),
  1,
  'B launches the later replacement'
);
select ok(
  pg_temp.s02d_wait_for_lock(
    's02d_b',
    (select pid from s02d_pids where name = 'b')
  ),
  'B waits on the same Guide/contact/scope domain'
);
select is(
  dblink_exec('s02d_a', 'commit'),
  'COMMIT',
  'A commits the first replacement'
);
create temp table s02d_replace_b as
select *
  from dblink_get_result('s02d_b') result(
    outcome text,
    explorer_invite_id uuid,
    expires_at timestamptz
  );
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('s02d_b') result(
        outcome text,
        explorer_invite_id uuid,
        expires_at timestamptz
      )
  ),
  0,
  'replacement result stream is fully drained'
);
select is(
  (select outcome from s02d_replace_b),
  'issued',
  'B commits the later serialized replacement'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.explorer_invite
     where normalized_contact_value =
           'replacement-race@synthetic.invalid'
       and invite_status in ('created', 'sent')
  ),
  1,
  'replacement race leaves one open invitation'
);
select is(
  (
    select explorer_invite_id
      from core.explorer_invite
     where normalized_contact_value =
           'replacement-race@synthetic.invalid'
       and invite_status in ('created', 'sent')
  ),
  'a27d0031-5000-4000-8000-000000000303'::uuid,
  'later serialized replacement is the open survivor'
);

-- Explicit revocation commits first; the waiting reissuance sees the freed
-- slot and creates a fresh invitation.
select is(
  dblink_exec('s02d_a', 'begin'),
  'BEGIN',
  'A begins revocation-first race'
);
create temp table s02d_revoke_first_a as
select *
  from dblink(
    's02d_a',
    $call$
      select *
        from public.solmind_revoke_explorer_invitation(
          'a27d0031-5000-4000-8000-000000000401',
          'a27d0031-0000-4000-8000-000000000101',
          'a27d0031-2000-4000-8000-000000000101'
        )
    $call$
  ) result(
    outcome text,
    explorer_invite_id uuid,
    invite_status text,
    revoked_at timestamptz
  );
select is(
  (select outcome from s02d_revoke_first_a),
  'revoked',
  'A performs explicit revocation'
);
select is(
  dblink_send_query(
    's02d_b',
    $call$
      select *
        from public.solmind_issue_explorer_invitation(
          'a27d0031-5000-4000-8000-000000000402',
          'a27d0031-0000-4000-8000-000000000101',
          'a27d0031-2000-4000-8000-000000000101',
          'a27d0031-3200-4000-8000-000000000101',
          'a27d0031-3100-4000-8000-000000000101',
          'email',
          'revoke-first@synthetic.invalid',
          'revoke-first@synthetic.invalid',
          'After Revocation'
        )
    $call$
  ),
  1,
  'B launches reissuance behind revocation'
);
select ok(
  pg_temp.s02d_wait_for_lock(
    's02d_b',
    (select pid from s02d_pids where name = 'b')
  ),
  'reissuance waits on revocation-owned domain'
);
select is(
  dblink_exec('s02d_a', 'commit'),
  'COMMIT',
  'A commits explicit revocation'
);
create temp table s02d_revoke_first_b as
select *
  from dblink_get_result('s02d_b') result(
    outcome text,
    explorer_invite_id uuid,
    expires_at timestamptz
  );
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('s02d_b') result(
        outcome text,
        explorer_invite_id uuid,
        expires_at timestamptz
      )
  ),
  0,
  'revocation-first result stream is fully drained'
);
select is(
  (select outcome from s02d_revoke_first_b),
  'issued',
  'waiting reissuance succeeds after committed revocation'
);

-- Replacement issuance commits first; explicit revocation of the predecessor
-- then returns the writeless already-revoked terminal observation.
select is(
  dblink_exec('s02d_a', 'begin'),
  'BEGIN',
  'A begins issuance-first race'
);
create temp table s02d_issue_first_a as
select *
  from dblink(
    's02d_a',
    $call$
      select *
        from public.solmind_issue_explorer_invitation(
          'a27d0031-5000-4000-8000-000000000502',
          'a27d0031-0000-4000-8000-000000000101',
          'a27d0031-2000-4000-8000-000000000101',
          'a27d0031-3200-4000-8000-000000000101',
          'a27d0031-3100-4000-8000-000000000101',
          'email',
          'issue-first@synthetic.invalid',
          'issue-first@synthetic.invalid',
          'Issue First Replacement'
        )
    $call$
  ) result(
    outcome text,
    explorer_invite_id uuid,
    expires_at timestamptz
  );
select is(
  (select outcome from s02d_issue_first_a),
  'issued',
  'A creates replacement inside its open transaction'
);
select is(
  dblink_send_query(
    's02d_b',
    $call$
      select *
        from public.solmind_revoke_explorer_invitation(
          'a27d0031-5000-4000-8000-000000000501',
          'a27d0031-0000-4000-8000-000000000101',
          'a27d0031-2000-4000-8000-000000000101'
        )
    $call$
  ),
  1,
  'B launches explicit revocation of the predecessor'
);
select ok(
  pg_temp.s02d_wait_for_lock(
    's02d_b',
    (select pid from s02d_pids where name = 'b')
  ),
  'explicit revocation waits on issuance-owned domain'
);
select is(
  dblink_exec('s02d_a', 'commit'),
  'COMMIT',
  'A commits replacement issuance'
);
create temp table s02d_issue_first_b as
select *
  from dblink_get_result('s02d_b') result(
    outcome text,
    explorer_invite_id uuid,
    invite_status text,
    revoked_at timestamptz
  );
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('s02d_b') result(
        outcome text,
        explorer_invite_id uuid,
        invite_status text,
        revoked_at timestamptz
      )
  ),
  0,
  'issuance-first result stream is fully drained'
);
select is(
  (select outcome from s02d_issue_first_b),
  'already_revoked',
  'waiting predecessor revocation is writeless'
);
select is(
  (
    select invite_status
      from core.explorer_invite
     where explorer_invite_id =
           'a27d0031-5000-4000-8000-000000000502'
  ),
  'created',
  'issuance-first race preserves the replacement'
);

-- Two explicit revocations serialize; only the first changes state or audits.
select is(
  dblink_exec('s02d_a', 'begin'),
  'BEGIN',
  'A begins double-revocation race'
);
create temp table s02d_double_revoke_a as
select *
  from dblink(
    's02d_a',
    $call$
      select *
        from public.solmind_revoke_explorer_invitation(
          'a27d0031-5000-4000-8000-000000000601',
          'a27d0031-0000-4000-8000-000000000101',
          'a27d0031-2000-4000-8000-000000000101'
        )
    $call$
  ) result(
    outcome text,
    explorer_invite_id uuid,
    invite_status text,
    revoked_at timestamptz
  );
select is(
  (select outcome from s02d_double_revoke_a),
  'revoked',
  'A performs the sole revocation transition'
);
select is(
  dblink_send_query(
    's02d_b',
    $call$
      select *
        from public.solmind_revoke_explorer_invitation(
          'a27d0031-5000-4000-8000-000000000601',
          'a27d0031-0000-4000-8000-000000000101',
          'a27d0031-2000-4000-8000-000000000101'
        )
    $call$
  ),
  1,
  'B launches the same revocation asynchronously'
);
select ok(
  pg_temp.s02d_wait_for_lock(
    's02d_b',
    (select pid from s02d_pids where name = 'b')
  ),
  'second revocation waits on the first'
);
select is(
  dblink_exec('s02d_a', 'commit'),
  'COMMIT',
  'A commits the sole transition'
);
create temp table s02d_double_revoke_b as
select *
  from dblink_get_result('s02d_b') result(
    outcome text,
    explorer_invite_id uuid,
    invite_status text,
    revoked_at timestamptz
  );
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('s02d_b') result(
        outcome text,
        explorer_invite_id uuid,
        invite_status text,
        revoked_at timestamptz
      )
  ),
  0,
  'double-revocation result stream is fully drained'
);
select is(
  (select outcome from s02d_double_revoke_b),
  'already_revoked',
  'second revocation returns the terminal observation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id =
           'a27d0031-5000-4000-8000-000000000601'
       and event_type = 'invite_revoked'
       and reason_code = 'guide_revoked'
  ),
  1,
  'double-revocation race writes one revocation audit'
);

-- Forced lock-timeout coverage for issuance and revocation. A holds the exact
-- first canonical domain key as postgres; B must return the fixed protected
-- class and leave no state or audit residue.
select is(
  dblink_exec('s02d_a', 'reset role'),
  'RESET',
  'A returns to postgres for forced timeout'
);
select is(
  dblink_exec('s02d_a', 'begin'),
  'BEGIN',
  'A begins forced issuance-timeout schedule'
);
select lives_ok(
  $hold_issue_lock$
    select *
      from dblink(
        's02d_a',
        $lock$
          select true as locked
            from (
              select pg_catalog.pg_advisory_xact_lock(
                (
                  private.solmind_explorer_invitation_domain_lock_keys(
                    'a27d0031-5000-4000-8000-000000000701',
                    'a27d0031-3200-4000-8000-000000000101',
                    'a27d0031-3100-4000-8000-000000000101',
                    'email',
                    'issue-timeout@synthetic.invalid'
                  )
                )[1]
              )
            ) held
        $lock$
      ) result(locked boolean)
  $hold_issue_lock$,
  'A holds the first canonical issuance key'
);
select throws_ok(
  $timeout_call$
    select *
      from dblink(
        's02d_b',
        $call$
          select *
            from public.solmind_issue_explorer_invitation(
              'a27d0031-5000-4000-8000-000000000701',
              'a27d0031-0000-4000-8000-000000000101',
              'a27d0031-2000-4000-8000-000000000101',
              'a27d0031-3200-4000-8000-000000000101',
              'a27d0031-3100-4000-8000-000000000101',
              'email',
              'issue-timeout@synthetic.invalid',
              'issue-timeout@synthetic.invalid',
              null
            )
        $call$
      ) result(
        outcome text,
        explorer_invite_id uuid,
        expires_at timestamptz
      )
  $timeout_call$,
  'P0001',
  'solmind_explorer_issue_lock_unavailable',
  'forced issuance lock timeout returns the fixed class'
);
select is(
  dblink_exec('s02d_a', 'rollback'),
  'ROLLBACK',
  'A releases forced issuance lock'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.explorer_invite
     where explorer_invite_id =
           'a27d0031-5000-4000-8000-000000000701'
  ),
  0,
  'forced issuance timeout leaves no invitation'
);

select is(
  dblink_exec('s02d_a', 'begin'),
  'BEGIN',
  'A begins forced revocation-timeout schedule'
);
select lives_ok(
  $hold_revoke_lock$
    select *
      from dblink(
        's02d_a',
        $lock$
          select true as locked
            from (
              select pg_catalog.pg_advisory_xact_lock(
                (
                  private.solmind_explorer_invitation_domain_lock_keys(
                    'a27d0031-5000-4000-8000-000000000801',
                    'a27d0031-3200-4000-8000-000000000101',
                    'a27d0031-3100-4000-8000-000000000101',
                    'email',
                    'revoke-timeout@synthetic.invalid'
                  )
                )[1]
              )
            ) held
        $lock$
      ) result(locked boolean)
  $hold_revoke_lock$,
  'A holds the first canonical revocation key'
);
select throws_ok(
  $timeout_call$
    select *
      from dblink(
        's02d_b',
        $call$
          select *
            from public.solmind_revoke_explorer_invitation(
              'a27d0031-5000-4000-8000-000000000801',
              'a27d0031-0000-4000-8000-000000000101',
              'a27d0031-2000-4000-8000-000000000101'
            )
        $call$
      ) result(
        outcome text,
        explorer_invite_id uuid,
        invite_status text,
        revoked_at timestamptz
      )
  $timeout_call$,
  'P0001',
  'solmind_explorer_revoke_lock_unavailable',
  'forced revocation lock timeout returns the fixed class'
);
select is(
  dblink_exec('s02d_a', 'rollback'),
  'ROLLBACK',
  'A releases forced revocation lock'
);
select is(
  (
    select invite_status
      from core.explorer_invite
     where explorer_invite_id =
           'a27d0031-5000-4000-8000-000000000801'
  ),
  'created',
  'forced revocation timeout leaves target unchanged'
);

select is(
  dblink_exec('s02d_a', 'reset role'),
  'RESET',
  'A resets role before cleanup'
);
select is(
  dblink_exec('s02d_b', 'reset role'),
  'RESET',
  'B resets role before cleanup'
);
select lives_ok(
  $cleanup_call$
    select dblink_exec(
      's02d_a',
      $cleanup$
        delete from audit.audit_event
         where target_entity_id::text like 'a27d0031-%'
            or actor_user_account_id::text like 'a27d0031-%';
        delete from core.explorer_invite
         where explorer_invite_id::text like 'a27d0031-%';
        delete from core.practice_guide
         where practice_guide_id::text like 'a27d0031-%';
        delete from core.guide_profile
         where guide_profile_id::text like 'a27d0031-%';
        delete from core.practice
         where practice_id::text like 'a27d0031-%';
        delete from core.organization
         where organization_id::text like 'a27d0031-%';
        delete from identity.user_session
         where user_session_id::text like 'a27d0031-%';
        delete from identity.user_role_assignment
         where user_role_assignment_id::text like 'a27d0031-%';
        delete from identity.user_account
         where user_account_id::text like 'a27d0031-%';
      $cleanup$
    )
  $cleanup_call$,
  'targeted FK-safe cleanup commits through A'
);

select is(
  (
    select pg_catalog.count(*)::integer
      from core.explorer_invite
     where explorer_invite_id::text like 'a27d0031-%'
  ),
  0,
  'cleanup leaves no S02D invitation residue'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_account
     where user_account_id::text like 'a27d0031-%'
  ),
  0,
  'cleanup leaves no S02D identity residue'
);

create temp table s02d_after as
select n.nspname || '.' || c.relname as relation_name,
       (
         xpath(
           '/row/c/text()',
           query_to_xml(
             pg_catalog.format(
               'select count(*) c from %I.%I',
               n.nspname,
               c.relname
             ),
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
             pg_catalog.format(
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
 where c.relkind in ('r', 'p')
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

select is(
  (
    select pg_catalog.count(*)::integer
      from s02d_before before_rows
      full join s02d_after after_rows
        on after_rows.relation_name = before_rows.relation_name
     where before_rows.relation_name is null
        or after_rows.relation_name is null
        or before_rows.row_count <> after_rows.row_count
        or before_rows.row_fingerprint <> after_rows.row_fingerprint
  ),
  0,
  'cleanup restores every eight-schema table fingerprint'
);

select lives_ok(
  $$select dblink_disconnect('s02d_a')$$,
  'connection A closes'
);
select lives_ok(
  $$select dblink_disconnect('s02d_b')$$,
  'connection B closes'
);

select * from finish();
rollback;
