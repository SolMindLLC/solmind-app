-- Local ephemeral database only. This test commits reserved synthetic fixture
-- rows so two dblink sessions can contend on one logical operation. It removes
-- only its reserved rows before finishing. Never run against hosted or real-user
-- data. If execution aborts after fixture commit, perform an approved idle local
-- database reset before another run.

create extension if not exists dblink;

do $preflight$
begin
  if exists (
    select 1
      from identity.user_account
     where user_account_id in (
       '92000000-0000-4000-8000-000000000001',
       '92000000-0000-4000-8000-000000000002',
       '92000000-0000-4000-8000-000000000003'
     )
  )
  or exists (
    select 1
      from ai.ai_model_invocation
     where logical_operation_id =
       '92000000-0000-4000-8000-000000000061'
  )
  then
    raise exception 'solmind_virtual_guide_predispatch_concurrency_residue';
  end if;
end;
$preflight$;

begin;

insert into identity.user_account (
  user_account_id,
  display_name,
  account_status
) values
  ('92000000-0000-4000-8000-000000000001', 'Concurrency Explorer', 'active'),
  ('92000000-0000-4000-8000-000000000002', 'Concurrency Guide', 'active'),
  ('92000000-0000-4000-8000-000000000003', 'Concurrency Admin', 'active');

insert into identity.user_role_assignment (
  user_role_assignment_id,
  user_account_id,
  role_code,
  role_status
) values
  (
    '92000000-0000-4000-8000-000000000011',
    '92000000-0000-4000-8000-000000000001',
    'explorer',
    'active'
  ),
  (
    '92000000-0000-4000-8000-000000000012',
    '92000000-0000-4000-8000-000000000002',
    'guide',
    'active'
  ),
  (
    '92000000-0000-4000-8000-000000000013',
    '92000000-0000-4000-8000-000000000003',
    'admin',
    'active'
  );

insert into core.organization (
  organization_id,
  organization_name,
  approval_status,
  approved_by_user_account_id,
  approved_at
) values (
  '92000000-0000-4000-8000-000000000021',
  'Concurrency Test Organization',
  'approved',
  '92000000-0000-4000-8000-000000000003',
  pg_catalog.now()
);

insert into core.practice (
  practice_id,
  organization_id,
  practice_name,
  approval_status,
  approved_by_user_account_id,
  approved_at
) values (
  '92000000-0000-4000-8000-000000000022',
  '92000000-0000-4000-8000-000000000021',
  'Concurrency Test Practice',
  'approved',
  '92000000-0000-4000-8000-000000000003',
  pg_catalog.now()
);

insert into core.guide_profile (
  guide_profile_id,
  user_account_id,
  guide_display_name,
  setup_status,
  approved_by_user_account_id,
  approved_at,
  status
) values (
  '92000000-0000-4000-8000-000000000023',
  '92000000-0000-4000-8000-000000000002',
  'Concurrency Guide',
  'approved',
  '92000000-0000-4000-8000-000000000003',
  pg_catalog.now(),
  'active'
);

insert into core.explorer_profile (
  explorer_profile_id,
  user_account_id,
  explorer_display_name,
  onboarding_status,
  status
) values (
  '92000000-0000-4000-8000-000000000024',
  '92000000-0000-4000-8000-000000000001',
  'Concurrency Explorer',
  'active',
  'active'
);

insert into core.guide_explorer_relationship (
  guide_explorer_relationship_id,
  guide_profile_id,
  explorer_profile_id,
  practice_id,
  relationship_status,
  started_at
) values (
  '92000000-0000-4000-8000-000000000025',
  '92000000-0000-4000-8000-000000000023',
  '92000000-0000-4000-8000-000000000024',
  '92000000-0000-4000-8000-000000000022',
  'active',
  pg_catalog.now()
);

insert into core.consent_document (
  consent_document_id,
  consent_type,
  version_number,
  version_label,
  title,
  body_markdown,
  document_status,
  is_required_for_explorer,
  effective_at,
  created_by_user_account_id
) values
  (
    '92000000-0000-4000-8000-000000000031',
    'user_agreement',
    9201,
    'predispatch-concurrency-9201',
    'Concurrency User Agreement',
    'Synthetic concurrency agreement.',
    'active',
    true,
    pg_catalog.now(),
    '92000000-0000-4000-8000-000000000003'
  ),
  (
    '92000000-0000-4000-8000-000000000032',
    'ai_disclosure',
    9201,
    'predispatch-concurrency-9201',
    'Concurrency AI Disclosure',
    'Synthetic concurrency disclosure.',
    'active',
    true,
    pg_catalog.now(),
    '92000000-0000-4000-8000-000000000003'
  );

insert into core.consent_record (
  consent_record_id,
  user_account_id,
  role_context,
  consent_type,
  document_version,
  consent_document_id,
  adult_affirmation
) values
  (
    '92000000-0000-4000-8000-000000000041',
    '92000000-0000-4000-8000-000000000001',
    'explorer',
    'user_agreement',
    'predispatch-concurrency-9201',
    '92000000-0000-4000-8000-000000000031',
    true
  ),
  (
    '92000000-0000-4000-8000-000000000042',
    '92000000-0000-4000-8000-000000000001',
    'explorer',
    'ai_disclosure',
    'predispatch-concurrency-9201',
    '92000000-0000-4000-8000-000000000032',
    true
  );

insert into ai.ai_interaction_session (
  ai_interaction_session_id,
  session_type,
  session_status,
  actor_user_account_id,
  actor_role_context,
  explorer_profile_id,
  guide_explorer_relationship_id,
  practice_id,
  metadata
) values (
  '92000000-0000-4000-8000-000000000051',
  'explorer_waypoint',
  'active',
  '92000000-0000-4000-8000-000000000001',
  'explorer',
  '92000000-0000-4000-8000-000000000024',
  '92000000-0000-4000-8000-000000000025',
  '92000000-0000-4000-8000-000000000022',
  '{"restricted_mode": false}'::jsonb
);

create table if not exists pg_temp.virtual_guide_concurrency_fixture (
  logical_operation_id uuid not null,
  context_snapshot_id uuid not null,
  model_invocation_id uuid not null,
  session_id uuid not null,
  actor_account_id uuid not null,
  explorer_profile_id uuid not null,
  relationship_id uuid not null,
  required_consent_ids uuid[] not null,
  source_ids uuid[] not null,
  context_fingerprint text not null,
  authorization_version text not null
);

insert into pg_temp.virtual_guide_concurrency_fixture
select
  '92000000-0000-4000-8000-000000000061'::uuid,
  '92000000-0000-4000-8000-000000000062'::uuid,
  '92000000-0000-4000-8000-000000000063'::uuid,
  '92000000-0000-4000-8000-000000000051'::uuid,
  '92000000-0000-4000-8000-000000000001'::uuid,
  '92000000-0000-4000-8000-000000000024'::uuid,
  '92000000-0000-4000-8000-000000000025'::uuid,
  array[
    '92000000-0000-4000-8000-000000000031'::uuid,
    '92000000-0000-4000-8000-000000000032'::uuid
  ],
  array[
    '92000000-0000-4000-8000-000000000071'::uuid,
    '92000000-0000-4000-8000-000000000072'::uuid
  ],
  pg_catalog.repeat('C', 64),
  'AV1:' || pg_catalog.upper(
    pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(
          'contract=virtual-guide-predispatch-evidence.v1'
          || '|session=92000000-0000-4000-8000-000000000051'
          || '|account=92000000-0000-4000-8000-000000000001'
          || '|explorer=92000000-0000-4000-8000-000000000024'
          || '|relationship=92000000-0000-4000-8000-000000000025'
          || '|session_type=explorer_waypoint'
          || '|session_status=active'
          || '|practice=92000000-0000-4000-8000-000000000022'
          || '|practice_status=active'
          || '|practice_approval_status=approved'
          || '|restricted_mode=clear'
          || '|profile_status=active'
          || '|onboarding_status=active'
          || '|relationship_status=active'
          || '|required_consents='
          || '92000000-0000-4000-8000-000000000031,'
          || '92000000-0000-4000-8000-000000000032',
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    )
  );

commit;

begin;
select plan(21);

create function pg_temp.virtual_guide_wait_for_lock(
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
       )
    then
      return true;
    end if;
    perform pg_catalog.pg_sleep(0.025);
  end loop;
  return false;
end;
$$;

select is(
  (
    select pg_catalog.count(*)::integer
      from ai.ai_model_invocation
     where logical_operation_id =
       '92000000-0000-4000-8000-000000000061'
  ),
  0,
  'preflight finds no reserved invocation residue'
);

select lives_ok(
  pg_catalog.format(
    $q$select dblink_connect(
      's03d_predispatch_a',
      'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5'
    )$q$,
    pg_catalog.current_database()
  ),
  'connection A opens'
);
select lives_ok(
  pg_catalog.format(
    $q$select dblink_connect(
      's03d_predispatch_b',
      'host=host.docker.internal port=54322 dbname=%s user=postgres password=postgres connect_timeout=5'
    )$q$,
    pg_catalog.current_database()
  ),
  'connection B opens'
);
select is(
  dblink_exec('s03d_predispatch_a', 'set statement_timeout=''8s'''),
  'SET',
  'connection A statement timeout is bounded'
);
select is(
  dblink_exec('s03d_predispatch_b', 'set statement_timeout=''8s'''),
  'SET',
  'connection B statement timeout is bounded'
);
select is(
  dblink_exec('s03d_predispatch_a', 'set role service_role'),
  'SET',
  'connection A uses only the service-role entry point'
);
select is(
  dblink_exec('s03d_predispatch_b', 'set role service_role'),
  'SET',
  'connection B uses only the service-role entry point'
);

create temp table virtual_guide_concurrency_pids as
select 'a'::text as name, pid
  from dblink('s03d_predispatch_a', 'select pg_backend_pid()')
       result(pid integer)
union all
select 'b'::text as name, pid
  from dblink('s03d_predispatch_b', 'select pg_backend_pid()')
       result(pid integer);

select is(
  (select pg_catalog.count(distinct pid)::integer
     from virtual_guide_concurrency_pids),
  2,
  'workers use distinct database sessions'
);
select is(
  dblink_exec('s03d_predispatch_a', 'begin'),
  'BEGIN',
  'connection A begins'
);
select is(
  dblink_exec('s03d_predispatch_b', 'begin'),
  'BEGIN',
  'connection B begins'
);

create temp table virtual_guide_a_result as
select result.*
  from pg_temp.virtual_guide_concurrency_fixture fixture
  cross join lateral dblink(
    's03d_predispatch_a',
    pg_catalog.format(
      $call$
        select *
          from public.solmind_prepare_virtual_guide_predispatch(
            %L::uuid, %L::uuid, %L::uuid, %L::uuid, %L::uuid, %L::uuid,
            %L::uuid, %L::text, %L::uuid[], %L::uuid[], %L::text
          )
      $call$,
      fixture.logical_operation_id,
      fixture.context_snapshot_id,
      fixture.model_invocation_id,
      fixture.session_id,
      fixture.actor_account_id,
      fixture.explorer_profile_id,
      fixture.relationship_id,
      fixture.authorization_version,
      fixture.required_consent_ids,
      fixture.source_ids,
      fixture.context_fingerprint
    )
  ) result(
    preparation_state text,
    prepared_context_snapshot_id uuid,
    prepared_model_invocation_id uuid
  );

select is(
  (select preparation_state from virtual_guide_a_result),
  'created',
  'A creates the one pre-dispatch evidence set inside its open transaction'
);

select is(
  dblink_send_query(
    's03d_predispatch_b',
    (
      select pg_catalog.format(
        $call$
          select *
            from public.solmind_prepare_virtual_guide_predispatch(
              %L::uuid, %L::uuid, %L::uuid, %L::uuid, %L::uuid, %L::uuid,
              %L::uuid, %L::text, %L::uuid[], %L::uuid[], %L::text
            )
        $call$,
        fixture.logical_operation_id,
        fixture.context_snapshot_id,
        fixture.model_invocation_id,
        fixture.session_id,
        fixture.actor_account_id,
        fixture.explorer_profile_id,
        fixture.relationship_id,
        fixture.authorization_version,
        fixture.required_consent_ids,
        fixture.source_ids,
        fixture.context_fingerprint
      )
        from pg_temp.virtual_guide_concurrency_fixture fixture
    )
  ),
  1,
  'B launches the same logical operation asynchronously'
);
select ok(
  pg_temp.virtual_guide_wait_for_lock(
    's03d_predispatch_b',
    (
      select pid
        from virtual_guide_concurrency_pids
       where name = 'b'
    )
  ),
  'B waits on the operation-scoped advisory lock'
);
select is(
  dblink_exec('s03d_predispatch_a', 'commit'),
  'COMMIT',
  'A commits the winning evidence transaction'
);

create temp table virtual_guide_b_result as
select *
  from dblink_get_result('s03d_predispatch_b')
       result(
         preparation_state text,
         prepared_context_snapshot_id uuid,
         prepared_model_invocation_id uuid
       );

select *
  from dblink_get_result('s03d_predispatch_b')
       result(
         preparation_state text,
         prepared_context_snapshot_id uuid,
         prepared_model_invocation_id uuid
       );

select is(
  (select preparation_state from virtual_guide_b_result),
  'exact_retry',
  'B observes the committed evidence and receives a no-dispatch exact retry'
);
select is(
  dblink_exec('s03d_predispatch_b', 'commit'),
  'COMMIT',
  'B commits its writeless exact-retry transaction'
);

select is(
  (
    select pg_catalog.count(*)::integer
      from ai.ai_context_snapshot
     where ai_context_snapshot_id =
       '92000000-0000-4000-8000-000000000062'
  ),
  1,
  'the simultaneous calls retain exactly one context snapshot'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from ai.ai_model_invocation
     where logical_operation_id =
       '92000000-0000-4000-8000-000000000061'
  ),
  1,
  'the simultaneous calls retain exactly one model invocation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id in (
       '92000000-0000-4000-8000-000000000062'::uuid,
       '92000000-0000-4000-8000-000000000063'::uuid
     )
       and event_type in (
         'ai_context_snapshot_created',
         'ai_model_invocation_started'
       )
  ),
  2,
  'the simultaneous calls retain exactly the two required Family E rows'
);

select lives_ok(
  $cleanup$
    delete from audit.audit_event
     where target_entity_id in (
       '92000000-0000-4000-8000-000000000062'::uuid,
       '92000000-0000-4000-8000-000000000063'::uuid
     );
    delete from ai.ai_model_invocation
     where logical_operation_id =
       '92000000-0000-4000-8000-000000000061';
    delete from ai.ai_context_snapshot
     where ai_context_snapshot_id =
       '92000000-0000-4000-8000-000000000062';
    delete from ai.ai_interaction_session
     where ai_interaction_session_id =
       '92000000-0000-4000-8000-000000000051';
    delete from core.consent_record
     where consent_record_id in (
       '92000000-0000-4000-8000-000000000041'::uuid,
       '92000000-0000-4000-8000-000000000042'::uuid
     );
    delete from core.consent_document
     where consent_document_id in (
       '92000000-0000-4000-8000-000000000031'::uuid,
       '92000000-0000-4000-8000-000000000032'::uuid
     );
    delete from core.guide_explorer_relationship
     where guide_explorer_relationship_id =
       '92000000-0000-4000-8000-000000000025';
    delete from core.explorer_profile
     where explorer_profile_id =
       '92000000-0000-4000-8000-000000000024';
    delete from core.guide_profile
     where guide_profile_id =
       '92000000-0000-4000-8000-000000000023';
    delete from core.practice
     where practice_id =
       '92000000-0000-4000-8000-000000000022';
    delete from core.organization
     where organization_id =
       '92000000-0000-4000-8000-000000000021';
    delete from identity.user_role_assignment
     where user_role_assignment_id in (
       '92000000-0000-4000-8000-000000000011'::uuid,
       '92000000-0000-4000-8000-000000000012'::uuid,
       '92000000-0000-4000-8000-000000000013'::uuid
     );
    delete from identity.user_account
     where user_account_id in (
       '92000000-0000-4000-8000-000000000001'::uuid,
       '92000000-0000-4000-8000-000000000002'::uuid,
       '92000000-0000-4000-8000-000000000003'::uuid
     );
  $cleanup$,
  'targeted cleanup removes only the reserved concurrency fixture'
);
select is(
  (
    select
      (select pg_catalog.count(*)
         from identity.user_account
        where user_account_id::text like '92000000-%')
      +
      (select pg_catalog.count(*)
         from ai.ai_model_invocation
        where logical_operation_id =
          '92000000-0000-4000-8000-000000000061')
      +
      (select pg_catalog.count(*)
         from audit.audit_event
        where target_entity_id in (
          '92000000-0000-4000-8000-000000000062'::uuid,
          '92000000-0000-4000-8000-000000000063'::uuid
        ))
  )::integer,
  0,
  'reserved concurrency identity has zero residue'
);

select dblink_disconnect('s03d_predispatch_a');
select dblink_disconnect('s03d_predispatch_b');
select * from finish();
commit;
