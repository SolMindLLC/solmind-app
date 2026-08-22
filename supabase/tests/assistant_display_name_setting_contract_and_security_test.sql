begin;
select plan(43);

select has_table(
  'core',
  'assistant_display_name_setting',
  'protected assistant display-name setting table exists'
);
select ok(
  (
    select c.relrowsecurity and not c.relforcerowsecurity
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'core'
       and c.relname = 'assistant_display_name_setting'
  ),
  'assistant display-name setting RLS is enabled and not forced'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from pg_catalog.pg_policies
     where schemaname = 'core'
       and tablename = 'assistant_display_name_setting'
  ),
  0,
  'assistant display-name setting has zero RLS policies'
);
select is(
  (select pg_catalog.count(*)::integer
     from core.assistant_display_name_setting),
  2,
  'exactly two closed assistant display-name rows exist'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.assistant_display_name_setting
     where assistant_display_name_setting_id =
           'a30f0230-0000-4000-8000-000000000001'
       and setting_key =
           'explorer_virtual_guide_default_display_name'
       and display_name = 'Nivan'
       and version = 1
       and last_operation_id is null
       and updated_by_user_account_id is null
       and retention_class = 'core_business'
  ),
  1,
  'Explorer Virtual Guide default is the exact Nivan seed row'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.assistant_display_name_setting
     where assistant_display_name_setting_id =
           'a30f0230-0000-4000-8000-000000000002'
       and setting_key = 'guide_assistant_default_display_name'
       and display_name = 'Solomon'
       and version = 1
       and last_operation_id is null
       and updated_by_user_account_id is null
       and retention_class = 'core_business'
  ),
  1,
  'Guide Assistant default is the exact Solomon seed row'
);

select ok(
  not has_table_privilege(
    'service_role',
    'core.assistant_display_name_setting',
    'SELECT,INSERT,UPDATE,DELETE'
  ),
  'service_role has no direct assistant-name table access'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'core.assistant_display_name_setting',
    'SELECT,INSERT,UPDATE,DELETE'
  ),
  'authenticated has no direct assistant-name table access'
);
select ok(
  not has_table_privilege(
    'anon',
    'core.assistant_display_name_setting',
    'SELECT,INSERT,UPDATE,DELETE'
  ),
  'anon has no direct assistant-name table access'
);

select has_function(
  'core', 'assistant_display_name_is_valid', array['text'],
  'closed assistant display-name validator exists'
);
select volatility_is(
  'core', 'assistant_display_name_is_valid', array['text'],
  'immutable', 'display-name validator is immutable'
);
select ok(
  not has_function_privilege(
    'service_role',
    'core.assistant_display_name_is_valid(text)',
    'EXECUTE'
  ),
  'service_role cannot invoke the internal validator directly'
);

select has_function(
  'public', 'solmind_read_explorer_virtual_guide_default_display_name',
  array[]::text[], 'Explorer role-safe reader exists'
);
select has_function(
  'public', 'solmind_read_guide_assistant_default_display_name',
  array[]::text[], 'Guide role-safe reader exists'
);
select has_function(
  'public', 'solmind_read_admin_assistant_display_name_settings',
  array['uuid'], 'Admin settings reader exists'
);
select has_function(
  'public', 'solmind_set_assistant_display_name_setting',
  array['uuid', 'text', 'text', 'bigint', 'uuid'],
  'active-Admin mutation exists'
);

select volatility_is(
  'public', 'solmind_read_explorer_virtual_guide_default_display_name',
  array[]::text[], 'stable', 'Explorer reader is stable'
);
select volatility_is(
  'public', 'solmind_read_guide_assistant_default_display_name',
  array[]::text[], 'stable', 'Guide reader is stable'
);
select volatility_is(
  'public', 'solmind_read_admin_assistant_display_name_settings',
  array['uuid'], 'stable', 'Admin reader is stable'
);
select volatility_is(
  'public', 'solmind_set_assistant_display_name_setting',
  array['uuid', 'text', 'text', 'bigint', 'uuid'],
  'volatile', 'Admin mutation is volatile'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.solmind_read_explorer_virtual_guide_default_display_name()',
    'EXECUTE'
  ),
  'service_role may execute the Explorer reader'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.solmind_read_guide_assistant_default_display_name()',
    'EXECUTE'
  ),
  'service_role may execute the Guide reader'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.solmind_read_admin_assistant_display_name_settings(uuid)',
    'EXECUTE'
  ),
  'service_role may execute the Admin reader'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.solmind_set_assistant_display_name_setting(uuid,text,text,bigint,uuid)',
    'EXECUTE'
  ),
  'service_role may execute the Admin mutation'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.solmind_read_explorer_virtual_guide_default_display_name()',
    'EXECUTE'
  ),
  'authenticated cannot execute the Explorer reader directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.solmind_read_guide_assistant_default_display_name()',
    'EXECUTE'
  ),
  'authenticated cannot execute the Guide reader directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.solmind_read_admin_assistant_display_name_settings(uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute the Admin reader directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.solmind_set_assistant_display_name_setting(uuid,text,text,bigint,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute the Admin mutation directly'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.solmind_read_explorer_virtual_guide_default_display_name()',
    'EXECUTE'
  ),
  'anon cannot execute the Explorer reader'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.solmind_read_guide_assistant_default_display_name()',
    'EXECUTE'
  ),
  'anon cannot execute the Guide reader'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.solmind_read_admin_assistant_display_name_settings(uuid)',
    'EXECUTE'
  ),
  'anon cannot execute the Admin reader'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.solmind_set_assistant_display_name_setting(uuid,text,text,bigint,uuid)',
    'EXECUTE'
  ),
  'anon cannot execute the Admin mutation'
);

select ok(
  (
    select p.prosecdef
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_set_assistant_display_name_setting'
  ),
  'Admin mutation is security definer'
);
select is(
  (
    select pg_catalog.pg_get_userbyid(p.proowner)
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_set_assistant_display_name_setting'
  ),
  'postgres',
  'Admin mutation owner is postgres'
);
select ok(
  (
    select 'search_path=""' = any(p.proconfig)
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_set_assistant_display_name_setting'
  ),
  'Admin mutation has an empty search path'
);
select ok(
  (
    select 'lock_timeout=2000ms' = any(p.proconfig)
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_set_assistant_display_name_setting'
  ),
  'Admin mutation has a bounded lock timeout'
);
select is(
  (
    select pg_catalog.pg_get_function_result(p.oid)
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'solmind_set_assistant_display_name_setting'
  ),
  'TABLE(outcome text, setting_key text, display_name text, version bigint, updated_at timestamp with time zone)',
  'Admin mutation return shape is exact'
);
select ok(
  exists (
    select 1
      from pg_catalog.pg_indexes
     where schemaname = 'audit'
       and indexname =
           'audit_event_assistant_display_name_setting_operation_idx'
       and indexdef like 'CREATE UNIQUE INDEX%'
  ),
  'assistant-name operation id is protected by a unique audit index'
);
select ok(
  pg_catalog.pg_get_functiondef(
    'public.solmind_set_assistant_display_name_setting(uuid,text,text,bigint,uuid)'::regprocedure
  ) not like '%EXECUTE %'
  and pg_catalog.pg_get_functiondef(
    'public.solmind_set_assistant_display_name_setting(uuid,text,text,bigint,uuid)'::regprocedure
  ) not like '%format(%',
  'Admin mutation contains no dynamic SQL'
);
select ok(
  pg_catalog.pg_get_functiondef(
    'public.solmind_read_explorer_virtual_guide_default_display_name()'::regprocedure
  ) not like '%guide_assistant_default_display_name%',
  'Explorer reader cannot select the Guide Assistant key'
);
select ok(
  pg_catalog.pg_get_functiondef(
    'public.solmind_read_guide_assistant_default_display_name()'::regprocedure
  ) not like '%explorer_virtual_guide_default_display_name%',
  'Guide reader cannot select the Explorer Virtual Guide key'
);
select ok(
  pg_catalog.pg_get_functiondef(
    'public.solmind_set_assistant_display_name_setting(uuid,text,text,bigint,uuid)'::regprocedure
  ) not like '%p_actor_role%'
  and pg_catalog.pg_get_functiondef(
    'public.solmind_set_assistant_display_name_setting(uuid,text,text,bigint,uuid)'::regprocedure
  ) not like '%p_reason%'
  and pg_catalog.pg_get_functiondef(
    'public.solmind_set_assistant_display_name_setting(uuid,text,text,bigint,uuid)'::regprocedure
  ) not like '%request_fingerprint%'
  and pg_catalog.pg_get_functiondef(
    'public.solmind_set_assistant_display_name_setting(uuid,text,text,bigint,uuid)'::regprocedure
  ) not like '%md5(%',
  'mutation accepts no caller role or free-form reason and uses no digest surrogate'
);
select ok(
  pg_catalog.obj_description(
    'public.solmind_set_assistant_display_name_setting(uuid,text,text,bigint,uuid)'::regprocedure,
    'pg_proc'
  ) like '%display-name value is deliberately absent from audit metadata%',
  'mutation documents value-free audit metadata'
);

select * from finish();
rollback;
