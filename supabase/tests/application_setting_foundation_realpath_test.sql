begin;
select plan(36);

set local role service_role;

select is(
  (
    select integer_value
      from public.solmind_read_application_setting_integer(
        'explorer_shared_snapshot_sendability_days'
      )
  ),
  7,
  'service-role fixed read returns the default 7-day value'
);
select throws_ok(
  $$
    select *
      from public.solmind_read_application_setting_integer('another_key')
  $$,
  'P0001',
  'solmind_application_setting_not_allowed',
  'unknown read key fails closed'
);
select throws_ok(
  $$ select * from core.application_setting $$,
  '42501',
  null,
  'service_role cannot read the table directly'
);
select throws_ok(
  $$
    insert into audit.audit_event (
      event_type,
      actor_role_context,
      action,
      event_summary,
      metadata
    ) values (
      'application_setting_changed',
      'system',
      'update',
      'Caller-supplied summary.',
      '{"unknown_key":"free-form text"}'::jsonb
    )
  $$,
  '42501',
  null,
  'service_role cannot bypass the function with unknown or free-form metadata'
);

create temp table s02_setting_same_value as
select *
  from public.solmind_set_application_setting_integer(
    'explorer_shared_snapshot_sendability_days',
    7,
    1,
    'a30f0210-1000-4000-8000-000000000000',
    'paul_approved',
    'a30f0210-3000-4000-8000-000000000000',
    'paul_approved_configuration_change'
  );

select is(
  (select outcome from s02_setting_same_value),
  'unchanged',
  'same-value request reports unchanged'
);

reset role;

select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where event_type = 'application_setting_changed'
       and metadata ->> 'operation_id' =
           'a30f0210-1000-4000-8000-000000000000'
  ),
  0,
  'same-value request writes no audit row'
);
select is(
  (
    select version
      from core.application_setting
     where setting_key =
           'explorer_shared_snapshot_sendability_days'
  ),
  1::bigint,
  'same-value request does not advance the version'
);

set local role service_role;

create temp table s02_setting_apply as
select *
  from public.solmind_set_application_setting_integer(
    'explorer_shared_snapshot_sendability_days',
    8,
    1,
    'a30f0210-1000-4000-8000-000000000001',
    'paul_approved',
    'a30f0210-3000-4000-8000-000000000001',
    'paul_approved_configuration_change'
  );

select is(
  (select outcome from s02_setting_apply),
  'applied',
  'valid protected mutation applies'
);
select is(
  (select integer_value from s02_setting_apply),
  8,
  'valid protected mutation returns the new value'
);
select is(
  (select version from s02_setting_apply),
  2::bigint,
  'valid protected mutation advances the version once'
);

reset role;

select is(
  (
    select integer_value
      from core.application_setting
     where setting_key =
           'explorer_shared_snapshot_sendability_days'
  ),
  8,
  'selected Shared Snapshot row stores the new value'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where event_type = 'application_setting_changed'
       and metadata ->> 'operation_id' =
           'a30f0210-1000-4000-8000-000000000001'
  ),
  1,
  'mutation writes exactly one audit event'
);
select is(
  (
    select metadata ->> 'authority_basis'
      from audit.audit_event
     where event_type = 'application_setting_changed'
       and metadata ->> 'operation_id' =
           'a30f0210-1000-4000-8000-000000000001'
  ),
  'paul_approved',
  'audit records the exact authority basis'
);
select is(
  (
    select metadata ->> 'authority_reference_id'
      from audit.audit_event
     where event_type = 'application_setting_changed'
       and metadata ->> 'operation_id' =
           'a30f0210-1000-4000-8000-000000000001'
  ),
  'a30f0210-3000-4000-8000-000000000001',
  'audit records the UUID authority reference'
);
select is(
  (
    select (
             select pg_catalog.count(*)::integer
               from pg_catalog.jsonb_object_keys(event.metadata)
           )
      from audit.audit_event event
     where event.event_type = 'application_setting_changed'
       and event.metadata ->> 'operation_id' =
           'a30f0210-1000-4000-8000-000000000001'
  ),
  7,
  'audit metadata has exactly the seven allowed typed or closed keys'
);

set local role service_role;

select is(
  (
    select outcome
      from public.solmind_set_application_setting_integer(
        'explorer_shared_snapshot_sendability_days',
        8,
        1,
        'a30f0210-1000-4000-8000-000000000001',
        'paul_approved',
        'a30f0210-3000-4000-8000-000000000001',
        'paul_approved_configuration_change'
      )
  ),
  'already_applied',
  'exact typed-field retry is writeless and reports already applied'
);
select throws_ok(
  $$
    select *
      from public.solmind_set_application_setting_integer(
        'explorer_shared_snapshot_sendability_days',
        9,
        2,
        null,
        'paul_approved',
        'a30f0210-3000-4000-8000-000000000009',
        'paul_approved_configuration_change'
      )
  $$,
  'P0001',
  'solmind_application_setting_invalid_request',
  'null operation id fails closed as an invalid request'
);
select throws_ok(
  $$
    select *
      from public.solmind_set_application_setting_integer(
        'explorer_shared_snapshot_sendability_days',
        9,
        2,
        'a30f0210-1000-4000-8000-000000000010',
        'paul_approved',
        null,
        'paul_approved_configuration_change'
      )
  $$,
  'P0001',
  'solmind_application_setting_invalid_audit_context',
  'null authority reference fails closed'
);
select throws_ok(
  $$
    select *
      from public.solmind_set_application_setting_integer(
        'explorer_shared_snapshot_sendability_days',
        9,
        2,
        'a30f0210-1000-4000-8000-000000000011',
        'paul_approved',
        'a30f0210-3000-4000-8000-000000000011',
        'runbook_configuration_change'
      )
  $$,
  'P0001',
  'solmind_application_setting_invalid_reason',
  'Paul authority cannot use the operations-runbook reason'
);
select throws_ok(
  $$
    select *
      from public.solmind_set_application_setting_integer(
        'explorer_shared_snapshot_sendability_days',
        9,
        2,
        'a30f0210-1000-4000-8000-000000000012',
        'system_operations_runbook',
        'a30f0210-3000-4000-8000-000000000012',
        'paul_approved_configuration_change'
      )
  $$,
  'P0001',
  'solmind_application_setting_invalid_reason',
  'operations-runbook authority cannot use the Paul-approved reason'
);
select throws_ok(
  $$
    select *
      from public.solmind_set_application_setting_integer(
        'explorer_shared_snapshot_sendability_days',
        9,
        1,
        'a30f0210-1000-4000-8000-000000000001',
        'paul_approved',
        'a30f0210-3000-4000-8000-000000000001',
        'paul_approved_configuration_change'
      )
  $$,
  'P0001',
  'solmind_application_setting_operation_conflict',
  'mismatched operation-id reuse fails closed'
);
select throws_ok(
  $$
    select *
      from public.solmind_set_application_setting_integer(
        'explorer_shared_snapshot_sendability_days',
        8,
        1,
        'a30f0210-1000-4000-8000-000000000001',
        'paul_approved',
        'a30f0210-3000-4000-8000-000000000099',
        'paul_approved_configuration_change'
      )
  $$,
  'P0001',
  'solmind_application_setting_operation_conflict',
  'one-field authority-reference change on operation-id reuse fails closed'
);
select throws_ok(
  $$
    select *
      from public.solmind_set_application_setting_integer(
        'explorer_shared_snapshot_sendability_days',
        8,
        1,
        'a30f0210-1000-4000-8000-000000000001',
        'system_operations_runbook',
        'a30f0210-3000-4000-8000-000000000001',
        'runbook_configuration_change'
      )
  $$,
  'P0001',
  'solmind_application_setting_operation_conflict',
  'different closed authority context on operation-id reuse fails closed'
);
select throws_ok(
  $$
    select *
      from public.solmind_set_application_setting_integer(
        'explorer_shared_snapshot_sendability_days',
        9,
        1,
        'a30f0210-1000-4000-8000-000000000002',
        'paul_approved',
        'a30f0210-3000-4000-8000-000000000002',
        'paul_approved_configuration_change'
      )
  $$,
  'P0001',
  'solmind_application_setting_version_conflict',
  'stale expected version fails closed'
);
select throws_ok(
  $$
    select *
      from public.solmind_set_application_setting_integer(
        'explorer_shared_snapshot_sendability_days',
        0,
        2,
        'a30f0210-1000-4000-8000-000000000003',
        'paul_approved',
        'a30f0210-3000-4000-8000-000000000003',
        'paul_approved_configuration_change'
      )
  $$,
  'P0001',
  'solmind_application_setting_invalid_value',
  'zero-day mutation fails closed'
);
select throws_ok(
  $$
    select *
      from public.solmind_set_application_setting_integer(
        'explorer_shared_snapshot_sendability_days',
        101,
        2,
        'a30f0210-1000-4000-8000-000000000004',
        'paul_approved',
        'a30f0210-3000-4000-8000-000000000004',
        'paul_approved_configuration_change'
      )
  $$,
  'P0001',
  'solmind_application_setting_invalid_value',
  '101-day mutation fails closed'
);
select throws_ok(
  $$
    select *
      from public.solmind_set_application_setting_integer(
        'explorer_shared_snapshot_sendability_days',
        9,
        2,
        'a30f0210-1000-4000-8000-000000000005',
        'admin',
        'a30f0210-3000-4000-8000-000000000005',
        'paul_approved_configuration_change'
      )
  $$,
  'P0001',
  'solmind_application_setting_invalid_authority',
  'routine Admin authority token is excluded'
);
select throws_ok(
  $$
    select *
      from public.solmind_set_application_setting_integer(
        'explorer_shared_snapshot_sendability_days',
        9,
        2,
        'a30f0210-1000-4000-8000-000000000007',
        'paul_approved',
        'a30f0210-3000-4000-8000-000000000007',
        'because Paul said this would be useful'
      )
  $$,
  'P0001',
  'solmind_application_setting_invalid_reason',
  'free-form reason text fails closed'
);
select throws_ok(
  $$
    select *
      from public.solmind_set_application_setting_integer(
        'unknown',
        9,
        2,
        'a30f0210-1000-4000-8000-000000000006',
        'system_operations_runbook',
        'a30f0210-3000-4000-8000-000000000006',
        'runbook_configuration_change'
      )
  $$,
  'P0001',
  'solmind_application_setting_not_allowed',
  'unknown mutation key fails closed'
);

reset role;

create function pg_temp.s02_reject_application_setting_audit()
returns trigger
language plpgsql
as $$
begin
  if new.event_type = 'application_setting_changed' then
    raise exception 'solmind_test_application_setting_audit_failure';
  end if;
  return new;
end;
$$;

create trigger s02_reject_application_setting_audit
before insert on audit.audit_event
for each row
execute function pg_temp.s02_reject_application_setting_audit();

set local role service_role;

select throws_ok(
  $$
    select *
      from public.solmind_set_application_setting_integer(
        'explorer_shared_snapshot_sendability_days',
        9,
        2,
        'a30f0210-1000-4000-8000-000000000008',
        'system_operations_runbook',
        'a30f0210-3000-4000-8000-000000000008',
        'runbook_configuration_change'
      )
  $$,
  'P0001',
  'solmind_test_application_setting_audit_failure',
  'audit insertion failure propagates through the mutation'
);

reset role;

drop trigger s02_reject_application_setting_audit on audit.audit_event;

select is(
  (
    select integer_value::text || ':' || version::text
      from core.application_setting
     where setting_key = 'explorer_shared_snapshot_sendability_days'
  ),
  '8:2',
  'audit insertion failure rolls back the setting update'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where event_type = 'application_setting_changed'
       and metadata ->> 'operation_id' =
           'a30f0210-1000-4000-8000-000000000008'
  ),
  0,
  'audit insertion failure commits no audit residue'
);

select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where event_type = 'application_setting_changed'
       and metadata ->> 'operation_id' like 'a30f0210-1000-%'
  ),
  1,
  'retry and failed requests add no audit rows'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.application_setting
     where integer_value = 8
       and version = 2
       and last_operation_id =
           'a30f0210-1000-4000-8000-000000000001'
  ),
  1,
  'retry and failed requests leave the successful state unchanged'
);
select is(
  (
    select actor_user_account_id
      from audit.audit_event
     where event_type = 'application_setting_changed'
       and metadata ->> 'operation_id' =
           'a30f0210-1000-4000-8000-000000000001'
  ),
  null::uuid,
  'system operation audit uses a null human actor'
);
select is(
  (
    select actor_role_context || ':' || action || ':' || reason_code
      from audit.audit_event
     where event_type = 'application_setting_changed'
       and metadata ->> 'operation_id' =
           'a30f0210-1000-4000-8000-000000000001'
  ),
  'system:update:paul_approved_configuration_change',
  'audit vocabulary is exact'
);

select * from finish();
rollback;
