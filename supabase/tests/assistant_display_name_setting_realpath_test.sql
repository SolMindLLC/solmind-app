begin;
select plan(33);

insert into identity.user_account (
  user_account_id, display_name, account_status
) values
  ('a30f0230-1000-4000-8000-000000000001', 'Active Admin', 'active'),
  ('a30f0230-1000-4000-8000-000000000002', 'Explorer Only', 'active'),
  ('a30f0230-1000-4000-8000-000000000003', 'Inactive Admin', 'inactive');

insert into identity.user_role_assignment (
  user_role_assignment_id, user_account_id, role_code, role_status
) values
  (
    'a30f0230-2000-4000-8000-000000000001',
    'a30f0230-1000-4000-8000-000000000001',
    'admin', 'active'
  ),
  (
    'a30f0230-2000-4000-8000-000000000002',
    'a30f0230-1000-4000-8000-000000000002',
    'explorer', 'active'
  ),
  (
    'a30f0230-2000-4000-8000-000000000003',
    'a30f0230-1000-4000-8000-000000000003',
    'admin', 'active'
  );

select is(
  (select display_name
     from public.solmind_read_explorer_virtual_guide_default_display_name()),
  'Nivan',
  'Explorer role-safe reader returns only Nivan'
);
select is(
  (select display_name
     from public.solmind_read_guide_assistant_default_display_name()),
  'Solomon',
  'Guide role-safe reader returns only Solomon'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from public.solmind_read_admin_assistant_display_name_settings(
        'a30f0230-1000-4000-8000-000000000001'
      )
  ),
  2,
  'active Admin reads exactly both protected rows'
);
select is(
  (
    select pg_catalog.string_agg(setting_key || '=' || display_name, ','
                                 order by setting_key)
      from public.solmind_read_admin_assistant_display_name_settings(
        'a30f0230-1000-4000-8000-000000000001'
      )
  ),
  'explorer_virtual_guide_default_display_name=Nivan,guide_assistant_default_display_name=Solomon',
  'Admin reader returns the exact closed key/value pair'
);

select throws_ok(
  $$
    select *
      from public.solmind_read_admin_assistant_display_name_settings(
        'a30f0230-1000-4000-8000-000000000002'
      )
  $$,
  'solmind_assistant_display_name_admin_required',
  'non-Admin cannot read protected Admin setting metadata'
);
select throws_ok(
  $$
    select *
      from public.solmind_read_admin_assistant_display_name_settings(
        'a30f0230-1000-4000-8000-000000000003'
      )
  $$,
  'solmind_assistant_display_name_admin_required',
  'inactive Admin cannot read protected Admin setting metadata'
);

create temp table s03_name_result as
select *
  from public.solmind_set_assistant_display_name_setting(
    'a30f0230-1000-4000-8000-000000000001',
    'explorer_virtual_guide_default_display_name',
    'Nivan Light',
    1,
    'a30f0230-3000-4000-8000-000000000001'
  );

select is(
  (select outcome from s03_name_result),
  'applied',
  'active Admin changes the Explorer default'
);
select is(
  (select display_name || ':' || version::text from s03_name_result),
  'Nivan Light:2',
  'change returns the exact value and incremented version'
);
select is(
  (
    select display_name || ':' || version::text || ':' ||
           (updated_by_user_account_id =
            'a30f0230-1000-4000-8000-000000000001')::text
      from core.assistant_display_name_setting
     where setting_key = 'explorer_virtual_guide_default_display_name'
  ),
  'Nivan Light:2:true',
  'row records the changed value, version, and actual Admin actor'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where event_type = 'assistant_display_name_setting_changed'
       and actor_user_account_id =
           'a30f0230-1000-4000-8000-000000000001'
       and actor_role_context = 'admin'
       and target_entity_type = 'assistant_display_name_setting'
       and reason_code = 'admin_assistant_display_name_changed'
  ),
  1,
  'actual Admin change writes one same-transaction audit event'
);
select is(
  (
    select metadata
      from audit.audit_event
     where event_type = 'assistant_display_name_setting_changed'
       and metadata ->> 'operation_id' =
           'a30f0230-3000-4000-8000-000000000001'
  ),
  pg_catalog.jsonb_build_object(
    'setting_key', 'explorer_virtual_guide_default_display_name',
    'expected_version', 1,
    'version', 2,
    'operation_id', 'a30f0230-3000-4000-8000-000000000001'
  ),
  'audit metadata is exact and omits the display-name value'
);

select is(
  (
    select outcome
      from public.solmind_set_assistant_display_name_setting(
        'a30f0230-1000-4000-8000-000000000001',
        'explorer_virtual_guide_default_display_name',
        'Nivan Light', 1,
        'a30f0230-3000-4000-8000-000000000001'
      )
  ),
  'already_applied',
  'exact operation retry is writeless and deterministic'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where event_type = 'assistant_display_name_setting_changed'
       and metadata ->> 'operation_id' =
           'a30f0230-3000-4000-8000-000000000001'
  ),
  1,
  'exact retry does not duplicate the audit event'
);
select throws_ok(
  $$
    select *
      from public.solmind_set_assistant_display_name_setting(
        'a30f0230-1000-4000-8000-000000000001',
        'explorer_virtual_guide_default_display_name',
        'Different Retry', 1,
        'a30f0230-3000-4000-8000-000000000001'
      )
  $$,
  'solmind_assistant_display_name_operation_conflict',
  'same operation with different value is rejected'
);
select throws_ok(
  $$
    select *
      from public.solmind_set_assistant_display_name_setting(
        'a30f0230-1000-4000-8000-000000000001',
        'guide_assistant_default_display_name',
        'Solomon', 1,
        'a30f0230-3000-4000-8000-000000000001'
      )
  $$,
  'solmind_assistant_display_name_operation_conflict',
  'same operation cannot cross setting rows'
);
select throws_ok(
  $$
    select *
      from public.solmind_set_assistant_display_name_setting(
        'a30f0230-1000-4000-8000-000000000001',
        'explorer_virtual_guide_default_display_name',
        'Nivan Again', 1,
        'a30f0230-3000-4000-8000-000000000002'
      )
  $$,
  'solmind_assistant_display_name_version_conflict',
  'stale expected version is rejected'
);

select is(
  (
    select outcome
      from public.solmind_set_assistant_display_name_setting(
        'a30f0230-1000-4000-8000-000000000001',
        'guide_assistant_default_display_name',
        'Solomon', 1,
        'a30f0230-3000-4000-8000-000000000003'
      )
  ),
  'unchanged',
  'same-value request is a writeless unchanged result'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where event_type = 'assistant_display_name_setting_changed'
       and metadata ->> 'operation_id' =
           'a30f0230-3000-4000-8000-000000000003'
  ),
  0,
  'same-value request writes no audit event'
);

select throws_ok(
  $$
    select *
      from public.solmind_set_assistant_display_name_setting(
        'a30f0230-1000-4000-8000-000000000002',
        'guide_assistant_default_display_name',
        'Guide Name', 1,
        'a30f0230-3000-4000-8000-000000000004'
      )
  $$,
  'solmind_assistant_display_name_admin_required',
  'active non-Admin cannot mutate a default'
);
select throws_ok(
  $$
    select *
      from public.solmind_set_assistant_display_name_setting(
        'a30f0230-1000-4000-8000-000000000003',
        'guide_assistant_default_display_name',
        'Guide Name', 1,
        'a30f0230-3000-4000-8000-000000000005'
      )
  $$,
  'solmind_assistant_display_name_admin_required',
  'inactive Admin cannot mutate a default'
);
select throws_ok(
  $$
    select *
      from public.solmind_set_assistant_display_name_setting(
        'a30f0230-1000-4000-8000-000000000001',
        'unknown_name_setting',
        'Name', 1,
        'a30f0230-3000-4000-8000-000000000006'
      )
  $$,
  'solmind_assistant_display_name_setting_not_allowed',
  'unknown setting key is rejected with fixed error'
);

select throws_ok(
  $$
    select *
      from public.solmind_set_assistant_display_name_setting(
        'a30f0230-1000-4000-8000-000000000001',
        'guide_assistant_default_display_name',
        ' Leading', 1,
        'a30f0230-3000-4000-8000-000000000007'
      )
  $$,
  'solmind_assistant_display_name_invalid_value',
  'leading whitespace is rejected'
);
select throws_ok(
  $$
    select *
      from public.solmind_set_assistant_display_name_setting(
        'a30f0230-1000-4000-8000-000000000001',
        'guide_assistant_default_display_name',
        E'Line\nBreak', 1,
        'a30f0230-3000-4000-8000-000000000008'
      )
  $$,
  'solmind_assistant_display_name_invalid_value',
  'line feed is rejected'
);
select throws_ok(
  $$
    select *
      from public.solmind_set_assistant_display_name_setting(
        'a30f0230-1000-4000-8000-000000000001',
        'guide_assistant_default_display_name',
        'Line' || chr(8232) || 'Break', 1,
        'a30f0230-3000-4000-8000-000000000009'
      )
  $$,
  'solmind_assistant_display_name_invalid_value',
  'Unicode line separator is rejected'
);
select throws_ok(
  $$
    select *
      from public.solmind_set_assistant_display_name_setting(
        'a30f0230-1000-4000-8000-000000000001',
        'guide_assistant_default_display_name',
        'Bi' || chr(8238) || 'di', 1,
        'a30f0230-3000-4000-8000-000000000010'
      )
  $$,
  'solmind_assistant_display_name_invalid_value',
  'bidi override is rejected'
);
select throws_ok(
  $$
    select *
      from public.solmind_set_assistant_display_name_setting(
        'a30f0230-1000-4000-8000-000000000001',
        'guide_assistant_default_display_name',
        repeat('a', 41), 1,
        'a30f0230-3000-4000-8000-000000000011'
      )
  $$,
  'solmind_assistant_display_name_invalid_value',
  '41-character value is rejected'
);
select lives_ok(
  $$
    select *
      from public.solmind_set_assistant_display_name_setting(
        'a30f0230-1000-4000-8000-000000000001',
        'guide_assistant_default_display_name',
        repeat('a', 40), 1,
        'a30f0230-3000-4000-8000-000000000012'
      )
  $$,
  'exact 40-character boundary is accepted'
);

select is(
  (select display_name
     from public.solmind_read_explorer_virtual_guide_default_display_name()),
  'Nivan Light',
  'Explorer reader remains isolated after Guide setting change'
);
select is(
  (select display_name
     from public.solmind_read_guide_assistant_default_display_name()),
  repeat('a', 40),
  'Guide reader returns only the updated Guide setting'
);

create function pg_temp.s03_reject_assistant_name_audit()
returns trigger
language plpgsql
as $$
begin
  if new.event_type = 'assistant_display_name_setting_changed' then
    raise exception 'solmind_test_assistant_name_audit_failure';
  end if;
  return new;
end;
$$;

create trigger s03_reject_assistant_name_audit
before insert on audit.audit_event
for each row execute function pg_temp.s03_reject_assistant_name_audit();

select throws_ok(
  $$
    select *
      from public.solmind_set_assistant_display_name_setting(
        'a30f0230-1000-4000-8000-000000000001',
        'guide_assistant_default_display_name',
        'Rollback Name', 2,
        'a30f0230-3000-4000-8000-000000000013'
      )
  $$,
  'solmind_test_assistant_name_audit_failure',
  'audit failure rejects the mutation'
);
select is(
  (
    select display_name || ':' || version::text
      from core.assistant_display_name_setting
     where setting_key = 'guide_assistant_default_display_name'
  ),
  repeat('a', 40) || ':2',
  'audit failure rolls back the setting update'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where event_type = 'assistant_display_name_setting_changed'
       and metadata ->> 'operation_id' =
           'a30f0230-3000-4000-8000-000000000013'
  ),
  0,
  'audit failure leaves no partial audit row'
);

drop trigger s03_reject_assistant_name_audit on audit.audit_event;

set local role authenticated;
select throws_ok(
  $$ select * from core.assistant_display_name_setting $$,
  '42501',
  'permission denied for schema core',
  'authenticated cannot read the protected table directly'
);
reset role;

select * from finish();
rollback;
