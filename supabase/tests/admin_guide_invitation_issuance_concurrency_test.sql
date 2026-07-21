-- P27-C Admin-to-Guide issuance multi-connection proofs.
-- Local ephemeral database only. Never run synthetic cleanup against hosted or
-- real-user data.

begin;
create extension if not exists dblink;
select plan(137);

create function pg_temp.p27c_issue_wait_for_lock(
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

create temp table p27c_issue_before as
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
     'identity', 'core', 'audit', 'content', 'ai', 'methodology',
     'notification', 'scheduling'
   );

select cmp_ok(
  (select pg_catalog.count(*)::integer from p27c_issue_before),
  '>',
  0,
  'before fingerprint covers application tables'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_invite
     where guide_invite_id::text like 'a27c0031-%'
  ),
  0,
  'preflight finds no issuance invitation residue'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_account
     where user_account_id::text like 'a27c0031-%'
  ),
  0,
  'preflight finds no issuance identity residue'
);

select lives_ok(
  pg_catalog.format(
    $q$select dblink_connect(
      'p27c_issue_a',
      'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5'
    )$q$,
    pg_catalog.current_database()
  ),
  'connection A opens'
);
select lives_ok(
  pg_catalog.format(
    $q$select dblink_connect(
      'p27c_issue_b',
      'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5'
    )$q$,
    pg_catalog.current_database()
  ),
  'connection B opens'
);
select is(
  dblink_exec('p27c_issue_a', 'set statement_timeout=''8s'''),
  'SET',
  'connection A statement timeout is bounded'
);
select is(
  dblink_exec('p27c_issue_b', 'set statement_timeout=''8s'''),
  'SET',
  'connection B statement timeout is bounded'
);

create temp table p27c_issue_pids (
  name text primary key,
  pid integer
) on commit drop;
insert into p27c_issue_pids
select 'a', pid
  from dblink('p27c_issue_a', 'select pg_backend_pid()') result(pid integer)
union all
select 'b', pid
  from dblink('p27c_issue_b', 'select pg_backend_pid()') result(pid integer);
select is(
  (
    select pg_catalog.count(distinct pid)::integer
      from (
        select pg_backend_pid() as pid
        union all
        select pid from p27c_issue_pids
      ) sessions
  ),
  3,
  'orchestrator and workers use three sessions'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from (
        select database_name
          from dblink(
            'p27c_issue_a',
            'select current_database()::text'
          ) result(database_name text)
        union all
        select database_name
          from dblink(
            'p27c_issue_b',
            'select current_database()::text'
          ) result(database_name text)
      ) targets
     where targets.database_name = pg_catalog.current_database()
  ),
  2,
  'both workers target the database under test'
);

select lives_ok(
  $setup_call$
    select dblink_exec(
      'p27c_issue_a',
      $setup$
        insert into identity.user_account (
          user_account_id, display_name, account_status
        ) values
        (
          'a27c0031-0000-4000-8000-000000000001',
          'P27-C Issuance Concurrency Admin',
          'active'
        ),
        (
          'a27c0031-0000-4000-8000-000000000002',
          'I10 Existing Guide Lock Order',
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
          'a27c0031-0100-4000-8000-000000000001',
          'a27c0031-0000-4000-8000-000000000001',
          'admin',
          'active',
          'system'
        ),
        (
          'a27c0031-0100-4000-8000-000000000002',
          'a27c0031-0000-4000-8000-000000000002',
          'guide',
          'active',
          'system'
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
        ) values
        (
          'a27c0031-0300-4000-8000-000000000001',
          'a27c0031-0000-4000-8000-000000000002',
          'email',
          'primary',
          'i10-primary@synthetic.invalid',
          'i10-primary@synthetic.invalid',
          true,
          true,
          now(),
          'p27c_concurrency_fixture',
          'active'
        ),
        (
          'a27c0031-0300-4000-8000-000000000002',
          'a27c0031-0000-4000-8000-000000000002',
          'email',
          'alternate',
          'i10-secondary@synthetic.invalid',
          'i10-secondary@synthetic.invalid',
          true,
          true,
          now(),
          'p27c_concurrency_fixture',
          'active'
        );

        insert into core.guide_profile (
          guide_profile_id,
          user_account_id,
          guide_display_name,
          setup_status,
          status
        ) values (
          'a27c0031-0400-4000-8000-000000000001',
          'a27c0031-0000-4000-8000-000000000002',
          'I10 Existing Guide Lock Order',
          'profile_pending',
          'active'
        );

        insert into identity.user_session (
          user_session_id,
          user_account_id,
          active_role_context,
          created_at,
          expires_at,
          session_status
        ) values (
          'a27c0031-0200-4000-8000-000000000001',
          'a27c0031-0000-4000-8000-000000000001',
          'admin',
          now(),
          now() + interval '4 hours',
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
        ) values (
          'a27c0031-1100-4000-8000-000000000001',
          'acceptance-first@synthetic.invalid',
          'acceptance-first@synthetic.invalid',
          'email',
          'I3 Acceptance First Guide',
          'a27c0031-0000-4000-8000-000000000001',
          'created',
          clock_timestamp() + interval '24 hours'
        ), (
          'a27c0031-1100-4000-8000-000000000002',
          'issuance-first@synthetic.invalid',
          'issuance-first@synthetic.invalid',
          'email',
          'I4 Issuance First Guide',
          'a27c0031-0000-4000-8000-000000000001',
          'created',
          clock_timestamp() + interval '24 hours'
        ), (
          'a27c0031-1100-4000-8000-000000000003',
          'revoke-first-issuance@synthetic.invalid',
          'revoke-first-issuance@synthetic.invalid',
          'email',
          'I5 Revocation First',
          'a27c0031-0000-4000-8000-000000000001',
          'created',
          clock_timestamp() + interval '24 hours'
        ), (
          'a27c0031-1100-4000-8000-000000000004',
          'issuance-first-revoke@synthetic.invalid',
          'issuance-first-revoke@synthetic.invalid',
          'email',
          'I6 Issuance First',
          'a27c0031-0000-4000-8000-000000000001',
          'created',
          clock_timestamp() + interval '24 hours'
        ), (
          'a27c0031-1100-4000-8000-000000000005',
          'double-revoke@synthetic.invalid',
          'double-revoke@synthetic.invalid',
          'email',
          'I7 Double Revocation',
          'a27c0031-0000-4000-8000-000000000001',
          'created',
          clock_timestamp() + interval '24 hours'
        ), (
          'a27c0031-1100-4000-8000-000000000006',
          'accept-first-revoke@synthetic.invalid',
          'accept-first-revoke@synthetic.invalid',
          'email',
          'I8 Acceptance First Revocation',
          'a27c0031-0000-4000-8000-000000000001',
          'created',
          clock_timestamp() + interval '24 hours'
        ), (
          'a27c0031-1100-4000-8000-000000000007',
          'revoke-first-accept@synthetic.invalid',
          'revoke-first-accept@synthetic.invalid',
          'email',
          'I9 Revocation First Acceptance',
          'a27c0031-0000-4000-8000-000000000001',
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
        ) values (
          'a27c0031-2100-4000-8000-000000000001',
          null,
          null,
          'acceptance-first@synthetic.invalid',
          'email',
          'contact_verify',
          'email',
          clock_timestamp() + interval '10 minutes',
          clock_timestamp()
        ), (
          'a27c0031-2100-4000-8000-000000000002',
          null,
          null,
          'issuance-first@synthetic.invalid',
          'email',
          'contact_verify',
          'email',
          clock_timestamp() + interval '10 minutes',
          clock_timestamp()
        ), (
          'a27c0031-2100-4000-8000-000000000003',
          null,
          null,
          'accept-first-revoke@synthetic.invalid',
          'email',
          'contact_verify',
          'email',
          clock_timestamp() + interval '10 minutes',
          clock_timestamp()
        ), (
          'a27c0031-2100-4000-8000-000000000004',
          null,
          null,
          'revoke-first-accept@synthetic.invalid',
          'email',
          'contact_verify',
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
        ) values (
          'a27c0031-3100-4000-8000-000000000001',
          'a27c0031-1100-4000-8000-000000000001',
          'supabase',
          now(),
          now() + interval '24 hours',
          'security_log'
        ), (
          'a27c0031-3100-4000-8000-000000000002',
          'a27c0031-1100-4000-8000-000000000002',
          'supabase',
          now(),
          now() + interval '24 hours',
          'security_log'
        ), (
          'a27c0031-3100-4000-8000-000000000003',
          'a27c0031-1100-4000-8000-000000000006',
          'supabase',
          now(),
          now() + interval '24 hours',
          'security_log'
        ), (
          'a27c0031-3100-4000-8000-000000000004',
          'a27c0031-1100-4000-8000-000000000007',
          'supabase',
          now(),
          now() + interval '24 hours',
          'security_log'
        )
      $setup$
    )
  $setup_call$,
  'Admin concurrency fixture commits through A'
);
select is(
  dblink_exec('p27c_issue_a', 'set role service_role'),
  'SET',
  'A assumes service_role'
);
select is(
  dblink_exec('p27c_issue_b', 'set role service_role'),
  'SET',
  'B assumes service_role'
);

select is(
  dblink_exec('p27c_issue_a', 'begin'),
  'BEGIN',
  'A begins same-request race'
);
create temp table p27c_issue_a_first as
select *
  from dblink(
    'p27c_issue_a',
    $call$
      select *
        from public.solmind_issue_guide_invitation(
          'a27c0031-1000-4000-8000-000000000001',
          'a27c0031-0000-4000-8000-000000000001',
          'a27c0031-0200-4000-8000-000000000001',
          'email',
          'same-request@synthetic.invalid',
          'same-request@synthetic.invalid',
          'Same Request Guide'
        )
    $call$
  ) result(
    outcome text,
    guide_invite_id uuid,
    expires_at timestamptz
  );
select is(
  (select outcome from p27c_issue_a_first),
  'issued',
  'A issues the target inside its open transaction'
);
select is(
  dblink_send_query(
    'p27c_issue_b',
    $call$
      select *
        from public.solmind_issue_guide_invitation(
          'a27c0031-1000-4000-8000-000000000001',
          'a27c0031-0000-4000-8000-000000000001',
          'a27c0031-0200-4000-8000-000000000001',
          'email',
          'same-request@synthetic.invalid',
          'same-request@synthetic.invalid',
          'Same Request Guide'
        )
    $call$
  ),
  1,
  'B launches exact same request asynchronously'
);
select ok(
  pg_temp.p27c_issue_wait_for_lock(
    'p27c_issue_b',
    (select pid from p27c_issue_pids where name = 'b')
  ),
  'B waits on the shared issuance lock'
);
select is(
  dblink_exec('p27c_issue_a', 'commit'),
  'COMMIT',
  'A commits the issuance'
);
create temp table p27c_issue_b_retry as
select *
  from dblink_get_result('p27c_issue_b') result(
    outcome text,
    guide_invite_id uuid,
    expires_at timestamptz
  );
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('p27c_issue_b') result(
        outcome text,
        guide_invite_id uuid,
        expires_at timestamptz
      )
  ),
  0,
  'B asynchronous result stream is fully drained'
);
select is(
  (select outcome from p27c_issue_b_retry),
  'existing',
  'B returns exact committed-response recovery'
);
select is(
  (select guide_invite_id from p27c_issue_b_retry),
  (select guide_invite_id from p27c_issue_a_first),
  'same-request callers receive the same invitation'
);
select is(
  (select expires_at from p27c_issue_b_retry),
  (select expires_at from p27c_issue_a_first),
  'same-request callers receive the same expiry'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_invite
     where guide_invite_id = 'a27c0031-1000-4000-8000-000000000001'
  ),
  1,
  'same-request race commits one invitation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0031-1000-4000-8000-000000000001'
       and event_type = 'guide_invite_issued'
  ),
  1,
  'same-request race commits one issuance audit'
);

select is(
  dblink_exec('p27c_issue_a', 'begin'),
  'BEGIN',
  'A begins replacement race'
);
create temp table p27c_issue_a_replacement as
select *
  from dblink(
    'p27c_issue_a',
    $call$
      select *
        from public.solmind_issue_guide_invitation(
          'a27c0031-1000-4000-8000-000000000002',
          'a27c0031-0000-4000-8000-000000000001',
          'a27c0031-0200-4000-8000-000000000001',
          'email',
          'same-request@synthetic.invalid',
          'same-request@synthetic.invalid',
          'Replacement Two'
        )
    $call$
  ) result(
    outcome text,
    guide_invite_id uuid,
    expires_at timestamptz
  );
select is(
  (select outcome from p27c_issue_a_replacement),
  'issued',
  'A creates the first replacement inside its open transaction'
);
select is(
  dblink_send_query(
    'p27c_issue_b',
    $call$
      select *
        from public.solmind_issue_guide_invitation(
          'a27c0031-1000-4000-8000-000000000003',
          'a27c0031-0000-4000-8000-000000000001',
          'a27c0031-0200-4000-8000-000000000001',
          'email',
          'same-request@synthetic.invalid',
          'same-request@synthetic.invalid',
          'Replacement Three'
        )
    $call$
  ),
  1,
  'B launches the later replacement asynchronously'
);
select ok(
  pg_temp.p27c_issue_wait_for_lock(
    'p27c_issue_b',
    (select pid from p27c_issue_pids where name = 'b')
  ),
  'B waits on the shared replacement lock'
);
select is(
  dblink_exec('p27c_issue_a', 'commit'),
  'COMMIT',
  'A commits the first replacement'
);
create temp table p27c_issue_b_replacement as
select *
  from dblink_get_result('p27c_issue_b') result(
    outcome text,
    guide_invite_id uuid,
    expires_at timestamptz
  );
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('p27c_issue_b') result(
        outcome text,
        guide_invite_id uuid,
        expires_at timestamptz
      )
  ),
  0,
  'B replacement result stream is fully drained'
);
select is(
  (select outcome from p27c_issue_b_replacement),
  'issued',
  'B commits the later serialized replacement'
);
select is(
  (
    select invite_status
      from core.guide_invite
     where guide_invite_id = 'a27c0031-1000-4000-8000-000000000001'
  ),
  'revoked',
  'original invitation is revoked'
);
select is(
  (
    select invite_status
      from core.guide_invite
     where guide_invite_id = 'a27c0031-1000-4000-8000-000000000002'
  ),
  'revoked',
  'first replacement is revoked by the later replacement'
);
select is(
  (
    select invite_status
      from core.guide_invite
     where guide_invite_id = 'a27c0031-1000-4000-8000-000000000003'
  ),
  'created',
  'later replacement is the open invitation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_invite
     where normalized_contact_value = 'same-request@synthetic.invalid'
       and invite_status in ('created', 'sent')
  ),
  1,
  'replacement race leaves exactly one open invitation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id in (
       'a27c0031-1000-4000-8000-000000000001',
       'a27c0031-1000-4000-8000-000000000002'
     )
       and event_type = 'invite_revoked'
       and reason_code = 'superseded_by_reissuance'
  ),
  2,
  'replacement race writes one exact revocation audit per predecessor'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id in (
       'a27c0031-1000-4000-8000-000000000001',
       'a27c0031-1000-4000-8000-000000000002',
       'a27c0031-1000-4000-8000-000000000003'
     )
       and event_type = 'guide_invite_issued'
  ),
  3,
  'each distinct committed issuance has one issuance audit'
);

-- I3: Guide acceptance commits first. Replacement issuance waits on the
-- shared contact/sibling lock, then observes the newly committed Guide
-- identity and denies without invitation or audit growth.
select is(
  dblink_exec('p27c_issue_a', 'begin'),
  'BEGIN',
  'A begins acceptance-first cross-slice race'
);
create temp table p27c_issue_i3_accept as
select *
  from dblink(
    'p27c_issue_a',
    $call$
      select *
        from public.solmind_accept_guide_invitation(
          'a27c0031-1100-4000-8000-000000000001',
          'a27c0031-2100-4000-8000-000000000001',
          'a27c0031-3100-4000-8000-000000000001',
          'p27c-issue-acceptance-first',
          'acceptance-first@synthetic.invalid'
        )
    $call$
  ) result(
    outcome text,
    user_account_id uuid,
    guide_profile_id uuid
  );
select is(
  (select outcome from p27c_issue_i3_accept),
  'accepted',
  'A accepts the old target inside its open transaction'
);
select is(
  dblink_send_query(
    'p27c_issue_b',
    $call$
      select *
        from public.solmind_issue_guide_invitation(
          'a27c0031-1200-4000-8000-000000000001',
          'a27c0031-0000-4000-8000-000000000001',
          'a27c0031-0200-4000-8000-000000000001',
          'email',
          'acceptance-first@synthetic.invalid',
          'acceptance-first@synthetic.invalid',
          'I3 Replacement Guide'
        )
    $call$
  ),
  1,
  'B launches replacement issuance behind acceptance'
);
select ok(
  pg_temp.p27c_issue_wait_for_lock(
    'p27c_issue_b',
    (select pid from p27c_issue_pids where name = 'b')
  ),
  'replacement issuance waits on the acceptance-owned shared lock'
);
select is(
  dblink_exec('p27c_issue_a', 'commit'),
  'COMMIT',
  'A commits accepted history first'
);
select throws_ok(
  $drain_error$
    select *
      from dblink_get_result('p27c_issue_b') result(
        outcome text,
        guide_invite_id uuid,
        expires_at timestamptz
      )
  $drain_error$,
  'P0001',
  'solmind_guide_issue_existing_guide',
  'waiting replacement issuance denies after acceptance creates the Guide identity'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('p27c_issue_b') result(
        outcome text,
        guide_invite_id uuid,
        expires_at timestamptz
      )
  ),
  0,
  'acceptance-first issuance result stream is fully drained'
);
select is(
  (
    select invite_status
      from core.guide_invite
     where guide_invite_id = 'a27c0031-1100-4000-8000-000000000001'
  ),
  'accepted',
  'replacement issuance preserves accepted history'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_invite
     where guide_invite_id = 'a27c0031-1200-4000-8000-000000000001'
  ),
  0,
  'denied replacement issuance creates no new invitation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_invite
     where normalized_contact_value = 'acceptance-first@synthetic.invalid'
       and invite_status in ('created', 'sent')
  ),
  0,
  'acceptance-first race leaves no open Guide invitation for the contact'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_role_assignment assignment
      join identity.user_contact_method contact
        on contact.user_account_id = assignment.user_account_id
     where contact.normalized_contact_value =
       'acceptance-first@synthetic.invalid'
       and assignment.role_code = 'guide'
       and assignment.role_status = 'active'
  ),
  1,
  'the waiting issuer observes one committed active Guide identity'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.authorizing_evidence_consumption
     where verification_challenge_id =
       'a27c0031-2100-4000-8000-000000000001'
       and consumer_type = 'guide_invitation_acceptance'
  ),
  1,
  'acceptance-first race commits one Guide evidence consumption'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0031-1100-4000-8000-000000000001'
       and event_type = 'invite_accepted'
       and reason_code = 'invitation_accepted'
  ),
  1,
  'acceptance-first race writes one acceptance audit'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0031-1200-4000-8000-000000000001'
       and event_type = 'guide_invite_issued'
       and reason_code = 'admin_issued'
  ),
  0,
  'existing-Guide denial writes no replacement issuance audit'
);

-- I4: replacement issuance commits first. Acceptance observes the old target
-- as revoked after the shared lock releases and fails without provisioning or
-- consuming the evidence.
select is(
  dblink_exec('p27c_issue_a', 'begin'),
  'BEGIN',
  'A begins issuance-first cross-slice race'
);
create temp table p27c_issue_i4_replacement as
select *
  from dblink(
    'p27c_issue_a',
    $call$
      select *
        from public.solmind_issue_guide_invitation(
          'a27c0031-1200-4000-8000-000000000002',
          'a27c0031-0000-4000-8000-000000000001',
          'a27c0031-0200-4000-8000-000000000001',
          'email',
          'issuance-first@synthetic.invalid',
          'issuance-first@synthetic.invalid',
          'I4 Replacement Guide'
        )
    $call$
  ) result(
    outcome text,
    guide_invite_id uuid,
    expires_at timestamptz
  );
select is(
  (select outcome from p27c_issue_i4_replacement),
  'issued',
  'A issues the replacement inside its open transaction'
);
select is(
  dblink_send_query(
    'p27c_issue_b',
    $call$
      select *
        from public.solmind_accept_guide_invitation(
          'a27c0031-1100-4000-8000-000000000002',
          'a27c0031-2100-4000-8000-000000000002',
          'a27c0031-3100-4000-8000-000000000002',
          'p27c-issue-issuance-first',
          'issuance-first@synthetic.invalid'
        )
    $call$
  ),
  1,
  'B launches old-target acceptance behind issuance'
);
select ok(
  pg_temp.p27c_issue_wait_for_lock(
    'p27c_issue_b',
    (select pid from p27c_issue_pids where name = 'b')
  ),
  'old-target acceptance waits on the issuance-owned shared lock'
);
select is(
  dblink_exec('p27c_issue_a', 'commit'),
  'COMMIT',
  'A commits replacement issuance first'
);
select throws_ok(
  $drain_error$
    select *
      from dblink_get_result('p27c_issue_b') result(
        outcome text,
        user_account_id uuid,
        guide_profile_id uuid
      )
  $drain_error$,
  'P0001',
  'solmind_guide_accept_ineligible',
  'losing old-target acceptance receives the fixed ineligible outcome'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('p27c_issue_b') result(
        outcome text,
        user_account_id uuid,
        guide_profile_id uuid
      )
  ),
  0,
  'issuance-first acceptance result stream is fully drained'
);
select is(
  (
    select invite_status
      from core.guide_invite
     where guide_invite_id = 'a27c0031-1100-4000-8000-000000000002'
  ),
  'revoked',
  'issuance-first race revokes the old target'
);
select is(
  (
    select invite_status
      from core.guide_invite
     where guide_invite_id = 'a27c0031-1200-4000-8000-000000000002'
  ),
  'created',
  'issuance-first race leaves the replacement open'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_invite
     where normalized_contact_value = 'issuance-first@synthetic.invalid'
       and invite_status in ('created', 'sent')
  ),
  1,
  'issuance-first race leaves exactly one open invitation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.authorizing_evidence_consumption
     where verification_challenge_id =
       'a27c0031-2100-4000-8000-000000000002'
  ),
  0,
  'losing acceptance consumes no evidence'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.auth_provider_identity
     where provider_user_id = 'p27c-issue-issuance-first'
  ),
  0,
  'losing acceptance creates no provider binding'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_account
     where display_name = 'I4 Issuance First Guide'
  ),
  0,
  'losing acceptance creates no Guide account'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0031-1100-4000-8000-000000000002'
       and event_type = 'invite_accepted'
  ),
  0,
  'losing acceptance writes no acceptance audit'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0031-1100-4000-8000-000000000002'
       and event_type = 'invite_revoked'
       and reason_code = 'superseded_by_reissuance'
  ),
  1,
  'issuance-first race writes one exact revocation audit'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0031-1200-4000-8000-000000000002'
       and event_type = 'guide_invite_issued'
       and reason_code = 'admin_issued'
  ),
  1,
  'issuance-first race writes one replacement issuance audit'
);

-- I5: explicit Admin revocation commits first. Replacement issuance waits,
-- then creates one new invitation without rewriting the revoked target.
select is(
  dblink_exec('p27c_issue_a', 'begin'),
  'BEGIN',
  'A begins revocation-first reissuance race'
);
create temp table p27c_issue_i5_revoke as
select *
  from dblink(
    'p27c_issue_a',
    $call$
      select *
        from public.solmind_revoke_guide_invitation(
          'a27c0031-1100-4000-8000-000000000003',
          'a27c0031-0000-4000-8000-000000000001',
          'a27c0031-0200-4000-8000-000000000001'
        )
    $call$
  ) result(
    outcome text,
    guide_invite_id uuid,
    invite_status text,
    revoked_at timestamptz
  );
select is(
  (select outcome from p27c_issue_i5_revoke),
  'revoked',
  'A revokes the old target inside its open transaction'
);
select is(
  dblink_send_query(
    'p27c_issue_b',
    $call$
      select *
        from public.solmind_issue_guide_invitation(
          'a27c0031-1200-4000-8000-000000000003',
          'a27c0031-0000-4000-8000-000000000001',
          'a27c0031-0200-4000-8000-000000000001',
          'email',
          'revoke-first-issuance@synthetic.invalid',
          'revoke-first-issuance@synthetic.invalid',
          'I5 Replacement'
        )
    $call$
  ),
  1,
  'B launches reissuance behind explicit revocation'
);
select ok(
  pg_temp.p27c_issue_wait_for_lock(
    'p27c_issue_b',
    (select pid from p27c_issue_pids where name = 'b')
  ),
  'reissuance waits on the revocation-owned shared lock'
);
select is(
  dblink_exec('p27c_issue_a', 'commit'),
  'COMMIT',
  'A commits explicit revocation first'
);
create temp table p27c_issue_i5_reissue as
select *
  from dblink_get_result('p27c_issue_b') result(
    outcome text,
    guide_invite_id uuid,
    expires_at timestamptz
  );
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('p27c_issue_b') result(
        outcome text,
        guide_invite_id uuid,
        expires_at timestamptz
      )
  ),
  0,
  'revocation-first issuance result stream is fully drained'
);
select is(
  (select outcome from p27c_issue_i5_reissue),
  'issued',
  'waiting reissuance creates a new invitation after revocation'
);
select is(
  (
    select invite_status
      from core.guide_invite
     where guide_invite_id = 'a27c0031-1100-4000-8000-000000000003'
  ),
  'revoked',
  'revocation-first race preserves the old revoked target'
);
select is(
  (
    select invite_status
      from core.guide_invite
     where guide_invite_id = 'a27c0031-1200-4000-8000-000000000003'
  ),
  'created',
  'revocation-first race leaves the replacement open'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0031-1100-4000-8000-000000000003'
       and event_type = 'invite_revoked'
       and reason_code = 'admin_revoked'
  ),
  1,
  'revocation-first winner has one exact Admin audit'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0031-1200-4000-8000-000000000003'
       and event_type = 'guide_invite_issued'
       and reason_code = 'admin_issued'
  ),
  1,
  'revocation-first reissuance has one exact issuance audit'
);

-- I6: replacement issuance commits first. Explicit revocation waits and then
-- returns the already-revoked terminal observation without a second audit.
select is(
  dblink_exec('p27c_issue_a', 'begin'),
  'BEGIN',
  'A begins issuance-first explicit-revocation race'
);
create temp table p27c_issue_i6_reissue as
select *
  from dblink(
    'p27c_issue_a',
    $call$
      select *
        from public.solmind_issue_guide_invitation(
          'a27c0031-1200-4000-8000-000000000004',
          'a27c0031-0000-4000-8000-000000000001',
          'a27c0031-0200-4000-8000-000000000001',
          'email',
          'issuance-first-revoke@synthetic.invalid',
          'issuance-first-revoke@synthetic.invalid',
          'I6 Replacement'
        )
    $call$
  ) result(
    outcome text,
    guide_invite_id uuid,
    expires_at timestamptz
  );
select is(
  (select outcome from p27c_issue_i6_reissue),
  'issued',
  'A issues the replacement inside its open transaction'
);
select is(
  dblink_send_query(
    'p27c_issue_b',
    $call$
      select *
        from public.solmind_revoke_guide_invitation(
          'a27c0031-1100-4000-8000-000000000004',
          'a27c0031-0000-4000-8000-000000000001',
          'a27c0031-0200-4000-8000-000000000001'
        )
    $call$
  ),
  1,
  'B launches explicit revocation behind replacement issuance'
);
select ok(
  pg_temp.p27c_issue_wait_for_lock(
    'p27c_issue_b',
    (select pid from p27c_issue_pids where name = 'b')
  ),
  'explicit revocation waits on the issuance-owned shared lock'
);
select is(
  dblink_exec('p27c_issue_a', 'commit'),
  'COMMIT',
  'A commits replacement issuance first'
);
create temp table p27c_issue_i6_revoke as
select *
  from dblink_get_result('p27c_issue_b') result(
    outcome text,
    guide_invite_id uuid,
    invite_status text,
    revoked_at timestamptz
  );
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('p27c_issue_b') result(
        outcome text,
        guide_invite_id uuid,
        invite_status text,
        revoked_at timestamptz
      )
  ),
  0,
  'issuance-first revocation result stream is fully drained'
);
select is(
  (select outcome from p27c_issue_i6_revoke),
  'already_revoked',
  'waiting revocation observes the committed replacement revocation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0031-1100-4000-8000-000000000004'
       and event_type = 'invite_revoked'
       and reason_code = 'superseded_by_reissuance'
  ),
  1,
  'issuance-first winner has one replacement revocation audit'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0031-1100-4000-8000-000000000004'
       and event_type = 'invite_revoked'
       and reason_code = 'admin_revoked'
  ),
  0,
  'losing explicit revocation writes no second audit'
);
select is(
  (
    select invite_status
      from core.guide_invite
     where guide_invite_id = 'a27c0031-1200-4000-8000-000000000004'
  ),
  'created',
  'issuance-first race leaves the replacement open'
);

-- I7: two explicit revocations of the same target serialize. One changes
-- state and audits; the waiter observes the terminal state without writing.
select is(
  dblink_exec('p27c_issue_a', 'begin'),
  'BEGIN',
  'A begins double-revocation race'
);
create temp table p27c_issue_i7_first as
select *
  from dblink(
    'p27c_issue_a',
    $call$
      select *
        from public.solmind_revoke_guide_invitation(
          'a27c0031-1100-4000-8000-000000000005',
          'a27c0031-0000-4000-8000-000000000001',
          'a27c0031-0200-4000-8000-000000000001'
        )
    $call$
  ) result(
    outcome text,
    guide_invite_id uuid,
    invite_status text,
    revoked_at timestamptz
  );
select is(
  (select outcome from p27c_issue_i7_first),
  'revoked',
  'A performs the sole revocation transition'
);
select is(
  dblink_send_query(
    'p27c_issue_b',
    $call$
      select *
        from public.solmind_revoke_guide_invitation(
          'a27c0031-1100-4000-8000-000000000005',
          'a27c0031-0000-4000-8000-000000000001',
          'a27c0031-0200-4000-8000-000000000001'
        )
    $call$
  ),
  1,
  'B launches the same revocation behind A'
);
select ok(
  pg_temp.p27c_issue_wait_for_lock(
    'p27c_issue_b',
    (select pid from p27c_issue_pids where name = 'b')
  ),
  'second revocation waits on the first revocation shared lock'
);
select is(
  dblink_exec('p27c_issue_a', 'commit'),
  'COMMIT',
  'A commits the sole revocation transition'
);
create temp table p27c_issue_i7_second as
select *
  from dblink_get_result('p27c_issue_b') result(
    outcome text,
    guide_invite_id uuid,
    invite_status text,
    revoked_at timestamptz
  );
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('p27c_issue_b') result(
        outcome text,
        guide_invite_id uuid,
        invite_status text,
        revoked_at timestamptz
      )
  ),
  0,
  'double-revocation result stream is fully drained'
);
select is(
  (select outcome from p27c_issue_i7_second),
  'already_revoked',
  'second revocation returns the writeless terminal observation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0031-1100-4000-8000-000000000005'
       and event_type = 'invite_revoked'
       and reason_code = 'admin_revoked'
  ),
  1,
  'double-revocation race writes exactly one Admin revocation audit'
);

-- I8: Guide acceptance commits first. Explicit revocation waits and observes
-- accepted without overwriting acceptance or adding a revocation audit.
select is(
  dblink_exec('p27c_issue_a', 'begin'),
  'BEGIN',
  'A begins acceptance-first explicit-revocation race'
);
create temp table p27c_issue_i8_accept as
select *
  from dblink(
    'p27c_issue_a',
    $call$
      select *
        from public.solmind_accept_guide_invitation(
          'a27c0031-1100-4000-8000-000000000006',
          'a27c0031-2100-4000-8000-000000000003',
          'a27c0031-3100-4000-8000-000000000003',
          'p27c-issue-accept-first-revoke',
          'accept-first-revoke@synthetic.invalid'
        )
    $call$
  ) result(
    outcome text,
    user_account_id uuid,
    guide_profile_id uuid
  );
select is(
  (select outcome from p27c_issue_i8_accept),
  'accepted',
  'A accepts the target inside its open transaction'
);
select is(
  dblink_send_query(
    'p27c_issue_b',
    $call$
      select *
        from public.solmind_revoke_guide_invitation(
          'a27c0031-1100-4000-8000-000000000006',
          'a27c0031-0000-4000-8000-000000000001',
          'a27c0031-0200-4000-8000-000000000001'
        )
    $call$
  ),
  1,
  'B launches explicit revocation behind acceptance'
);
select ok(
  pg_temp.p27c_issue_wait_for_lock(
    'p27c_issue_b',
    (select pid from p27c_issue_pids where name = 'b')
  ),
  'explicit revocation waits on the acceptance-owned shared lock'
);
select is(
  dblink_exec('p27c_issue_a', 'commit'),
  'COMMIT',
  'A commits acceptance first'
);
create temp table p27c_issue_i8_revoke as
select *
  from dblink_get_result('p27c_issue_b') result(
    outcome text,
    guide_invite_id uuid,
    invite_status text,
    revoked_at timestamptz
  );
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('p27c_issue_b') result(
        outcome text,
        guide_invite_id uuid,
        invite_status text,
        revoked_at timestamptz
      )
  ),
  0,
  'acceptance-first revocation result stream is fully drained'
);
select is(
  (select outcome from p27c_issue_i8_revoke),
  'accepted',
  'waiting revocation returns the accepted terminal observation'
);
select is(
  (
    select invite_status
      from core.guide_invite
     where guide_invite_id = 'a27c0031-1100-4000-8000-000000000006'
  ),
  'accepted',
  'acceptance-first race preserves accepted state'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0031-1100-4000-8000-000000000006'
       and event_type = 'invite_accepted'
  ),
  1,
  'acceptance-first winner writes one acceptance audit'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0031-1100-4000-8000-000000000006'
       and event_type = 'invite_revoked'
       and reason_code = 'admin_revoked'
  ),
  0,
  'losing explicit revocation writes no audit'
);

-- I9: explicit revocation commits first. Guide acceptance waits and then
-- fails without consuming evidence, provisioning identity, or auditing.
select is(
  dblink_exec('p27c_issue_a', 'begin'),
  'BEGIN',
  'A begins revocation-first acceptance race'
);
create temp table p27c_issue_i9_revoke as
select *
  from dblink(
    'p27c_issue_a',
    $call$
      select *
        from public.solmind_revoke_guide_invitation(
          'a27c0031-1100-4000-8000-000000000007',
          'a27c0031-0000-4000-8000-000000000001',
          'a27c0031-0200-4000-8000-000000000001'
        )
    $call$
  ) result(
    outcome text,
    guide_invite_id uuid,
    invite_status text,
    revoked_at timestamptz
  );
select is(
  (select outcome from p27c_issue_i9_revoke),
  'revoked',
  'A revokes the target inside its open transaction'
);
select is(
  dblink_send_query(
    'p27c_issue_b',
    $call$
      select *
        from public.solmind_accept_guide_invitation(
          'a27c0031-1100-4000-8000-000000000007',
          'a27c0031-2100-4000-8000-000000000004',
          'a27c0031-3100-4000-8000-000000000004',
          'p27c-issue-revoke-first-accept',
          'revoke-first-accept@synthetic.invalid'
        )
    $call$
  ),
  1,
  'B launches Guide acceptance behind explicit revocation'
);
select ok(
  pg_temp.p27c_issue_wait_for_lock(
    'p27c_issue_b',
    (select pid from p27c_issue_pids where name = 'b')
  ),
  'Guide acceptance waits on the revocation-owned shared lock'
);
select is(
  dblink_exec('p27c_issue_a', 'commit'),
  'COMMIT',
  'A commits explicit revocation first'
);
select throws_ok(
  $drain_error$
    select *
      from dblink_get_result('p27c_issue_b') result(
        outcome text,
        user_account_id uuid,
        guide_profile_id uuid
      )
  $drain_error$,
  'P0001',
  'solmind_guide_accept_ineligible',
  'waiting acceptance receives the fixed ineligible outcome'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('p27c_issue_b') result(
        outcome text,
        user_account_id uuid,
        guide_profile_id uuid
      )
  ),
  0,
  'revocation-first acceptance result stream is fully drained'
);
select is(
  (
    select invite_status
      from core.guide_invite
     where guide_invite_id = 'a27c0031-1100-4000-8000-000000000007'
  ),
  'revoked',
  'revocation-first race preserves revoked state'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.authorizing_evidence_consumption
     where verification_challenge_id =
       'a27c0031-2100-4000-8000-000000000004'
  ),
  0,
  'losing acceptance consumes no evidence'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.auth_provider_identity
     where provider_user_id = 'p27c-issue-revoke-first-accept'
  ),
  0,
  'losing acceptance creates no provider binding'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_account
     where display_name = 'I9 Revocation First Acceptance'
  ),
  0,
  'losing acceptance creates no Guide account'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0031-1100-4000-8000-000000000007'
       and event_type = 'invite_revoked'
       and reason_code = 'admin_revoked'
  ),
  1,
  'revocation-first winner writes one exact Admin audit'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id = 'a27c0031-1100-4000-8000-000000000007'
       and event_type = 'invite_accepted'
  ),
  0,
  'losing acceptance writes no acceptance audit'
);

-- I10: an account row held before a different contact row on the same
-- existing Guide account makes issuance wait at the account lock. It never
-- acquires the contact first, so the acceptance account -> contact order has
-- no cross-contact cycle.
select is(
  dblink_exec('p27c_issue_a', 'reset role'),
  'RESET',
  'A returns to postgres for the account-lock-order schedule'
);
select is(
  dblink_exec('p27c_issue_a', 'begin'),
  'BEGIN',
  'A begins the account-lock-order schedule'
);
create temp table p27c_issue_i10_account_lock as
select *
  from dblink(
    'p27c_issue_a',
    $lock$
      select account.user_account_id
        from identity.user_account account
       where account.user_account_id =
         'a27c0031-0000-4000-8000-000000000002'
         for update
    $lock$
  ) result(user_account_id uuid);
select is(
  (select user_account_id from p27c_issue_i10_account_lock),
  'a27c0031-0000-4000-8000-000000000002'::uuid,
  'A holds the existing Guide account row before any contact row'
);
select is(
  dblink_send_query(
    'p27c_issue_b',
    $call$
      select *
        from public.solmind_issue_guide_invitation(
          'a27c0031-1000-4000-8000-000000000010',
          'a27c0031-0000-4000-8000-000000000001',
          'a27c0031-0200-4000-8000-000000000001',
          'email',
          'i10-secondary@synthetic.invalid',
          'i10-secondary@synthetic.invalid',
          'I10 Replacement Attempt'
        )
    $call$
  ),
  1,
  'B launches issuance to a different contact owned by the locked account'
);
select ok(
  pg_temp.p27c_issue_wait_for_lock(
    'p27c_issue_b',
    (select pid from p27c_issue_pids where name = 'b')
  ),
  'B waits on the account row before taking the target contact row'
);
select is(
  (
    select user_contact_method_id
      from dblink(
        'p27c_issue_a',
        $lock_contact$
          select contact.user_contact_method_id
            from identity.user_contact_method contact
           where contact.user_contact_method_id =
             'a27c0031-0300-4000-8000-000000000002'
             for update
        $lock_contact$
      ) result(user_contact_method_id uuid)
  ),
  'a27c0031-0300-4000-8000-000000000002'::uuid,
  'A can lock the target contact while B waits, proving B did not take contact first'
);
select is(
  dblink_exec('p27c_issue_a', 'commit'),
  'COMMIT',
  'A releases the existing Guide account row'
);
select throws_ok(
  $drain_error$
    select *
      from dblink_get_result('p27c_issue_b') result(
        outcome text,
        guide_invite_id uuid,
        expires_at timestamptz
      )
  $drain_error$,
  'P0001',
  'solmind_guide_issue_existing_guide',
  'waiting issuance denies the existing Guide after the account lock releases'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from dblink_get_result('p27c_issue_b') result(
        outcome text,
        guide_invite_id uuid,
        expires_at timestamptz
      )
  ),
  0,
  'account-lock-order asynchronous result stream is fully drained'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_invite invitation
     where invitation.guide_invite_id =
       'a27c0031-1000-4000-8000-000000000010'
  ),
  0,
  'account-lock-order denial creates no invitation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.target_entity_id =
       'a27c0031-1000-4000-8000-000000000010'
  ),
  0,
  'account-lock-order denial writes no audit event'
);

select is(
  dblink_exec('p27c_issue_a', 'reset role'),
  'RESET',
  'A returns to postgres for cleanup'
);
select is(
  dblink_exec('p27c_issue_b', 'reset role'),
  'RESET',
  'B returns to postgres for cleanup'
);
select lives_ok(
  $cleanup$
    select dblink_exec(
      'p27c_issue_a',
      $sql$
        delete from audit.audit_event
         where target_entity_id::text like 'a27c0031-%'
            or actor_user_account_id in (
              select provider_identity.user_account_id
                from identity.auth_provider_identity provider_identity
               where provider_identity.provider_user_id like 'p27c-issue-%'
            );
        delete from core.guide_profile
         where user_account_id in (
           select provider_identity.user_account_id
             from identity.auth_provider_identity provider_identity
            where provider_identity.provider_user_id like 'p27c-issue-%'
         )
            or user_account_id::text like 'a27c0031-%';
        delete from identity.user_role_assignment
         where user_account_id in (
           select provider_identity.user_account_id
             from identity.auth_provider_identity provider_identity
            where provider_identity.provider_user_id like 'p27c-issue-%'
         );
        delete from identity.authorizing_evidence_consumption
         where verification_challenge_id::text like 'a27c0031-%';
        delete from identity.auth_provider_identity
         where provider_user_id like 'p27c-issue-%';
        delete from identity.auth_provider_provisioning_reservation
         where provisioning_reservation_id::text like 'a27c0031-%';
        delete from core.guide_invite
         where guide_invite_id::text like 'a27c0031-%';
        delete from identity.verification_challenge
         where verification_challenge_id::text like 'a27c0031-%';
        delete from identity.user_contact_method
         where user_account_id in (
           select account.user_account_id
             from identity.user_account account
             where account.display_name in (
               'I3 Acceptance First Guide',
               'I8 Acceptance First Revocation',
               'I10 Existing Guide Lock Order'
             )
         );
        delete from identity.user_session
         where user_session_id::text like 'a27c0031-%';
        delete from identity.user_role_assignment
         where user_role_assignment_id::text like 'a27c0031-%';
        delete from identity.user_account
         where display_name in (
           'I3 Acceptance First Guide',
           'I8 Acceptance First Revocation'
         );
        delete from identity.user_account
         where user_account_id::text like 'a27c0031-%'
      $sql$
    )
  $cleanup$,
  'synthetic issuance fixtures clean up in FK-safe order'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.guide_invite
     where guide_invite_id::text like 'a27c0031-%'
  ),
  0,
  'cleanup removes every synthetic invitation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from identity.user_account
     where user_account_id::text like 'a27c0031-%'
  ),
  0,
  'cleanup removes every synthetic account'
);

create temp table p27c_issue_after as
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
     'identity', 'core', 'audit', 'content', 'ai', 'methodology',
     'notification', 'scheduling'
   );
select results_eq(
  $$select * from p27c_issue_after order by 1$$,
  $$select * from p27c_issue_before order by 1$$,
  'all application-table contents return exactly to baseline'
);
select lives_ok(
  $$select dblink_disconnect('p27c_issue_a')$$,
  'connection A disconnects'
);
select lives_ok(
  $$select dblink_disconnect('p27c_issue_b')$$,
  'connection B disconnects'
);

select * from finish();
rollback;
