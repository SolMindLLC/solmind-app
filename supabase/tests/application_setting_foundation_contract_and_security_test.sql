begin;
select plan(36);

select has_table(
  'core',
  'application_setting',
  'protected application-setting table exists'
);
select ok(
  (
    select c.relrowsecurity and not c.relforcerowsecurity
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'core'
       and c.relname = 'application_setting'
  ),
  'application-setting RLS is enabled and not forced'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from pg_catalog.pg_policies
     where schemaname = 'core'
       and tablename = 'application_setting'
  ),
  0,
  'application-setting table has zero RLS policies'
);
select is(
  (select pg_catalog.count(*)::integer from core.application_setting),
  2,
  'exactly two closed MVP0 setting rows exist'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.application_setting
     where application_setting_id =
           'a30f0210-0000-4000-8000-000000000001'
       and setting_key =
           'explorer_shared_snapshot_sendability_days'
       and integer_value = 7
       and minimum_integer_value = 1
       and default_integer_value = 7
       and maximum_integer_value = 100
       and version = 1
       and last_operation_id is null
       and retention_class = 'core_business'
  ),
  1,
  'the Shared Snapshot row preserves its exact key, 1-100 bounds, default 7, and version'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.application_setting
     where application_setting_id =
           'a30f0220-0000-4000-8000-000000000001'
       and setting_key = 'suggested_waypoint_send_grace_seconds'
       and integer_value = 300
       and minimum_integer_value = 60
       and default_integer_value = 300
       and maximum_integer_value = 3600
       and version = 1
       and last_operation_id is null
       and retention_class = 'core_business'
  ),
  1,
  'the Suggested Waypoint send-grace row has exact 60-3600 bounds, default 300, and version'
);
select ok(
  not has_table_privilege(
    'service_role',
    'core.application_setting',
    'SELECT,INSERT,UPDATE,DELETE'
  ),
  'service_role has no direct application-setting table access'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'core.application_setting',
    'SELECT,INSERT,UPDATE,DELETE'
  ),
  'authenticated has no direct application-setting table access'
);
select ok(
  not has_table_privilege(
    'anon',
    'core.application_setting',
    'SELECT,INSERT,UPDATE,DELETE'
  ),
  'anon has no direct application-setting table access'
);

select has_function(
  'public',
  'solmind_read_application_setting_integer',
  array['text'],
  'fixed application-setting read function exists'
);
select volatility_is(
  'public',
  'solmind_read_application_setting_integer',
  array['text'],
  'stable',
  'read function is stable'
);
select ok(
  (
    select p.prosecdef
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_read_application_setting_integer'
  ),
  'read function is security definer'
);
select is(
  (
    select pg_catalog.pg_get_userbyid(p.proowner)
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_read_application_setting_integer'
  ),
  'postgres',
  'read function owner is postgres'
);
select ok(
  (
    select 'search_path=""' = any(p.proconfig)
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_read_application_setting_integer'
  ),
  'read function has an empty search path'
);
select is(
  (
    select pg_catalog.pg_get_function_result(p.oid)
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_read_application_setting_integer'
  ),
  'TABLE(setting_key text, integer_value integer, minimum_integer_value integer, default_integer_value integer, maximum_integer_value integer, version bigint)',
  'read function return shape is exact'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.solmind_read_application_setting_integer(text)',
    'EXECUTE'
  ),
  'service_role may execute the fixed read'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.solmind_read_application_setting_integer(text)',
    'EXECUTE'
  ),
  'authenticated may not execute the fixed read'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.solmind_read_application_setting_integer(text)',
    'EXECUTE'
  ),
  'anon may not execute the fixed read'
);

select has_function(
  'public',
  'solmind_set_application_setting_integer',
  array['text', 'integer', 'bigint', 'uuid', 'text', 'uuid', 'text'],
  'protected application-setting mutation function exists'
);
select volatility_is(
  'public',
  'solmind_set_application_setting_integer',
  array['text', 'integer', 'bigint', 'uuid', 'text', 'uuid', 'text'],
  'volatile',
  'mutation function is volatile'
);
select ok(
  (
    select p.prosecdef
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_set_application_setting_integer'
  ),
  'mutation function is security definer'
);
select is(
  (
    select pg_catalog.pg_get_userbyid(p.proowner)
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_set_application_setting_integer'
  ),
  'postgres',
  'mutation function owner is postgres'
);
select ok(
  (
    select 'search_path=""' = any(p.proconfig)
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_set_application_setting_integer'
  ),
  'mutation function has an empty search path'
);
select ok(
  (
    select 'lock_timeout=2000ms' = any(p.proconfig)
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_set_application_setting_integer'
  ),
  'mutation function has a bounded lock timeout'
);
select is(
  (
    select pg_catalog.pg_get_function_result(p.oid)
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_set_application_setting_integer'
  ),
  'TABLE(outcome text, setting_key text, integer_value integer, version bigint)',
  'mutation return shape is exact'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.solmind_set_application_setting_integer(text,integer,bigint,uuid,text,uuid,text)',
    'EXECUTE'
  ),
  'service_role may execute protected mutation'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.solmind_set_application_setting_integer(text,integer,bigint,uuid,text,uuid,text)',
    'EXECUTE'
  ),
  'authenticated may not execute protected mutation'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.solmind_set_application_setting_integer(text,integer,bigint,uuid,text,uuid,text)',
    'EXECUTE'
  ),
  'anon may not execute protected mutation'
);
select ok(
  exists (
    select 1
      from pg_catalog.pg_indexes
     where schemaname = 'audit'
       and indexname = 'audit_event_application_setting_operation_idx'
       and indexdef like 'CREATE UNIQUE INDEX%'
  ),
  'application-setting operation id is protected by a unique audit index'
);
select ok(
  pg_catalog.pg_get_functiondef(
    'public.solmind_set_application_setting_integer(text,integer,bigint,uuid,text,uuid,text)'::regprocedure
  ) not like '%EXECUTE %'
  and pg_catalog.pg_get_functiondef(
    'public.solmind_set_application_setting_integer(text,integer,bigint,uuid,text,uuid,text)'::regprocedure
  ) not like '%format(%',
  'mutation contains no dynamic SQL'
);
select ok(
  pg_catalog.obj_description(
    'public.solmind_set_application_setting_integer(text,integer,bigint,uuid,text,uuid,text)'::regprocedure,
    'pg_proc'
  ) like '%Paul approval%'
  and pg_catalog.obj_description(
    'public.solmind_set_application_setting_integer(text,integer,bigint,uuid,text,uuid,text)'::regprocedure,
    'pg_proc'
  ) like '%system-operations%',
  'mutation documents its external authority boundary'
);
select ok(
  not exists (
    select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_set_application_setting_integer'
       and pg_catalog.oidvectortypes(p.proargtypes) =
           'text, integer, bigint, uuid, text, text, text'
  ),
  'legacy free-form authority-reference signature does not exist'
);
select ok(
  pg_catalog.pg_get_functiondef(
    'public.solmind_set_application_setting_integer(text,integer,bigint,uuid,text,uuid,text)'::regprocedure
  ) not like '%p_change_reason%'
  and pg_catalog.pg_get_functiondef(
    'public.solmind_set_application_setting_integer(text,integer,bigint,uuid,text,uuid,text)'::regprocedure
  ) not like '%request_fingerprint%'
  and pg_catalog.pg_get_functiondef(
    'public.solmind_set_application_setting_integer(text,integer,bigint,uuid,text,uuid,text)'::regprocedure
  ) not like '%md5(%',
  'mutation accepts no free-form change reason and uses no digest surrogate'
);
select ok(
  pg_catalog.pg_get_functiondef(
    'public.solmind_set_application_setting_integer(text,integer,bigint,uuid,text,uuid,text)'::regprocedure
  ) like '%p_authority_reference_id uuid%'
  and pg_catalog.pg_get_functiondef(
    'public.solmind_set_application_setting_integer(text,integer,bigint,uuid,text,uuid,text)'::regprocedure
  ) like '%paul_approved_configuration_change%'
  and pg_catalog.pg_get_functiondef(
    'public.solmind_set_application_setting_integer(text,integer,bigint,uuid,text,uuid,text)'::regprocedure
  ) like '%runbook_configuration_change%',
  'audit context is one UUID reference plus closed authority and reason vocabularies'
);
select ok(
  pg_catalog.pg_get_functiondef(
    'public.solmind_set_application_setting_integer(text,integer,bigint,uuid,text,uuid,text)'::regprocedure
  ) like '%v_existing_audit.metadata = pg_catalog.jsonb_build_object(%'
  and pg_catalog.pg_get_functiondef(
    'public.solmind_set_application_setting_integer(text,integer,bigint,uuid,text,uuid,text)'::regprocedure
  ) like '%''authority_reference_id'', p_authority_reference_id::text%',
  'exact retry compares the complete typed seven-key metadata object'
);
select ok(
  pg_catalog.pg_get_functiondef(
    'public.solmind_set_application_setting_integer(text,integer,bigint,uuid,text,uuid,text)'::regprocedure
  ) like '%select ''unchanged''::text%'
  and pg_catalog.pg_get_functiondef(
    'public.solmind_set_application_setting_integer(text,integer,bigint,uuid,text,uuid,text)'::regprocedure
  ) like '%if v_setting.integer_value = p_integer_value%',
  'same-value semantics are explicit and writeless'
);

select * from finish();
rollback;
