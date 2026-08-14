begin;
select plan(12);

select has_function(
  'public',
  'solmind_list_guide_suggested_waypoint_relationships',
  array['uuid', 'integer', 'text'],
  'feature-specific Suggested Waypoint relationship selector exists'
);

select function_returns(
  'public',
  'solmind_list_guide_suggested_waypoint_relationships',
  array['uuid', 'integer', 'text'],
  'setof record',
  'selector returns a typed table envelope'
);

select is(
  (
    select pg_catalog.pg_get_function_result(proc.oid)
      from pg_catalog.pg_proc proc
      join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
     where namespace.nspname = 'public'
       and proc.proname = 'solmind_list_guide_suggested_waypoint_relationships'
  ),
  'TABLE(items jsonb, next_cursor text, total_count bigint)',
  'selector envelope exposes only items, next cursor, and total count'
);

select is(
  (
    select proc.provolatile
      from pg_catalog.pg_proc proc
      join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
     where namespace.nspname = 'public'
       and proc.proname = 'solmind_list_guide_suggested_waypoint_relationships'
  ),
  's'::"char",
  'selector is stable'
);

select ok(
  (
    select proc.prosecdef
      from pg_catalog.pg_proc proc
      join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
     where namespace.nspname = 'public'
       and proc.proname = 'solmind_list_guide_suggested_waypoint_relationships'
  ),
  'selector is security definer'
);

select is(
  (
    select role.rolname
      from pg_catalog.pg_proc proc
      join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
      join pg_catalog.pg_roles role on role.oid = proc.proowner
     where namespace.nspname = 'public'
       and proc.proname = 'solmind_list_guide_suggested_waypoint_relationships'
  ),
  'postgres',
  'selector owner is postgres'
);

select is(
  (
    select proc.proconfig
      from pg_catalog.pg_proc proc
      join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
     where namespace.nspname = 'public'
       and proc.proname = 'solmind_list_guide_suggested_waypoint_relationships'
  ),
  array['search_path=""'],
  'selector fixes an empty search path'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.solmind_list_guide_suggested_waypoint_relationships(uuid,integer,text)',
    'EXECUTE'
  ),
  'service_role may execute the selector'
);

select is(
  (
    select pg_catalog.count(*)::integer
      from (values ('public'), ('anon'), ('authenticated')) as denied(role_name)
     where has_function_privilege(
       denied.role_name,
       'public.solmind_list_guide_suggested_waypoint_relationships(uuid,integer,text)',
       'EXECUTE'
     )
  ),
  0,
  'public, anon, and authenticated cannot execute the selector'
);

select has_index(
  'core',
  'guide_explorer_relationship',
  'guide_explorer_relationship_suggested_waypoint_selector_idx',
  'selector owns a purpose-built filter and keyset index'
);

select matches(
  (
    select pg_catalog.pg_get_indexdef(index_record.indexrelid)
      from pg_catalog.pg_index index_record
      join pg_catalog.pg_class index_class on index_class.oid = index_record.indexrelid
      join pg_catalog.pg_namespace namespace on namespace.oid = index_class.relnamespace
     where namespace.nspname = 'core'
       and index_class.relname = 'guide_explorer_relationship_suggested_waypoint_selector_idx'
  ),
  'guide_profile_id, relationship_status, created_at DESC, guide_explorer_relationship_id DESC',
  'index columns exactly match authorization, lifecycle, and keyset order'
);

select matches(
  obj_description(
    'public.solmind_list_guide_suggested_waypoint_relationships(uuid,integer,text)'::regprocedure,
    'pg_proc'
  ),
  'not the canonical Guide Explorer roster',
  'database owner records the non-roster boundary'
);

select * from finish();
rollback;
