begin;
select plan(31);

create temp table s02_sw_tables(table_schema text, table_name text) on commit drop;
insert into s02_sw_tables values
  ('core', 'guide_suggested_waypoint_preference'),
  ('content', 'suggested_waypoint'),
  ('content', 'suggested_waypoint_guide_draft'),
  ('content', 'suggested_waypoint_pending_outbound'),
  ('content', 'suggested_waypoint_version'),
  ('content', 'suggested_waypoint_explorer_read_state'),
  ('content', 'suggested_waypoint_receipt'),
  ('content', 'suggested_waypoint_operation_result');

select is(
  (
    select pg_catalog.count(*)::integer
      from s02_sw_tables expected
      join pg_catalog.pg_namespace namespace
        on namespace.nspname = expected.table_schema
      join pg_catalog.pg_class relation
        on relation.relnamespace = namespace.oid
       and relation.relname = expected.table_name
       and relation.relkind = 'r'
  ),
  8,
  'all eight distinct Suggested Waypoint owners exist'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from s02_sw_tables expected
      join pg_catalog.pg_namespace namespace
        on namespace.nspname = expected.table_schema
      join pg_catalog.pg_class relation
        on relation.relnamespace = namespace.oid
       and relation.relname = expected.table_name
     where relation.relrowsecurity and not relation.relforcerowsecurity
  ),
  8,
  'all eight owners enable non-forced RLS'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from pg_catalog.pg_policies policy
      join s02_sw_tables expected
        on expected.table_schema = policy.schemaname
       and expected.table_name = policy.tablename
  ),
  0,
  'all eight owners have zero RLS policies'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from s02_sw_tables expected
     where has_table_privilege(
       'service_role',
       pg_catalog.format('%I.%I', expected.table_schema, expected.table_name),
       'SELECT,INSERT,UPDATE,DELETE'
     )
  ),
  0,
  'service_role has no direct Suggested Waypoint owner privileges'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from s02_sw_tables expected
     where has_table_privilege(
       'authenticated',
       pg_catalog.format('%I.%I', expected.table_schema, expected.table_name),
       'SELECT,INSERT,UPDATE,DELETE'
     )
  ),
  0,
  'authenticated has no direct Suggested Waypoint owner privileges'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from s02_sw_tables expected
     where has_table_privilege(
       'anon',
       pg_catalog.format('%I.%I', expected.table_schema, expected.table_name),
       'SELECT,INSERT,UPDATE,DELETE'
     )
  ),
  0,
  'anon has no direct Suggested Waypoint owner privileges'
);

select is(
  (select pg_catalog.count(*)::integer from core.application_setting),
  2,
  'the protected application-setting family remains exactly two closed rows'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.application_setting setting
     where setting.setting_key = 'suggested_waypoint_send_grace_seconds'
       and setting.integer_value = 300
       and setting.minimum_integer_value = 60
       and setting.default_integer_value = 300
       and setting.maximum_integer_value = 3600
       and setting.version = 1
  ),
  1,
  'send-grace policy is exactly 60/300/3600 at version one'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.application_setting setting
     where setting.setting_key =
           'explorer_shared_snapshot_sendability_days'
       and setting.integer_value = 7
       and setting.minimum_integer_value = 1
       and setting.default_integer_value = 7
       and setting.maximum_integer_value = 100
       and setting.version = 1
  ),
  1,
  'the pre-existing Shared Snapshot policy is unchanged'
);

create temp table s02_sw_functions(
  function_name text,
  identity_arguments text,
  expected_volatility "char"
) on commit drop;
insert into s02_sw_functions values
  ('solmind_save_suggested_waypoint_draft',
   'uuid, uuid, uuid, uuid, bigint, text, text, jsonb', 'v'),
  ('solmind_schedule_suggested_waypoint_send',
   'uuid, uuid, uuid, uuid, bigint', 'v'),
  ('solmind_pull_back_suggested_waypoint',
   'uuid, uuid, uuid, bigint, uuid', 'v'),
  ('solmind_deliver_suggested_waypoint', 'uuid, uuid, uuid', 'v'),
  ('solmind_mark_suggested_waypoint_read', 'uuid, uuid, uuid, uuid', 'v'),
  ('solmind_acknowledge_suggested_waypoint_receipt',
   'uuid, uuid, uuid, uuid', 'v'),
  ('solmind_list_guide_suggested_waypoints',
   'uuid, uuid, integer, text', 's'),
  ('solmind_get_guide_suggested_waypoint', 'uuid, uuid, uuid', 's'),
  ('solmind_list_explorer_suggested_waypoints', 'uuid, integer, text', 's'),
  ('solmind_get_explorer_suggested_waypoint', 'uuid, uuid', 's'),
  ('solmind_get_admin_suggested_waypoint_operational_state',
   'uuid, uuid', 's');

select is(
  (
    select pg_catalog.count(*)::integer
      from s02_sw_functions expected
      join pg_catalog.pg_proc function_record
        on function_record.proname = expected.function_name
      join pg_catalog.pg_namespace namespace
        on namespace.oid = function_record.pronamespace
       and namespace.nspname = 'public'
     where pg_catalog.oidvectortypes(function_record.proargtypes) =
           expected.identity_arguments
  ),
  11,
  'the exact closed eleven-function public catalog exists'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from s02_sw_functions expected
      join pg_catalog.pg_proc function_record
        on function_record.proname = expected.function_name
      join pg_catalog.pg_namespace namespace
        on namespace.oid = function_record.pronamespace
       and namespace.nspname = 'public'
     where function_record.prosecdef
  ),
  11,
  'all eleven public functions are security definer'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from s02_sw_functions expected
      join pg_catalog.pg_proc function_record
        on function_record.proname = expected.function_name
      join pg_catalog.pg_namespace namespace
        on namespace.oid = function_record.pronamespace
       and namespace.nspname = 'public'
     where pg_catalog.pg_get_userbyid(function_record.proowner) = 'postgres'
  ),
  11,
  'all eleven public functions are owned by postgres'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from s02_sw_functions expected
      join pg_catalog.pg_proc function_record
        on function_record.proname = expected.function_name
      join pg_catalog.pg_namespace namespace
        on namespace.oid = function_record.pronamespace
       and namespace.nspname = 'public'
     where 'search_path=""' = any(function_record.proconfig)
  ),
  11,
  'all eleven public functions have an empty search path'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from s02_sw_functions expected
      join pg_catalog.pg_proc function_record
        on function_record.proname = expected.function_name
      join pg_catalog.pg_namespace namespace
        on namespace.oid = function_record.pronamespace
       and namespace.nspname = 'public'
     where function_record.provolatile = expected.expected_volatility
  ),
  11,
  'commands are volatile and role queries are stable'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from s02_sw_functions expected
      join pg_catalog.pg_proc function_record
        on function_record.proname = expected.function_name
      join pg_catalog.pg_namespace namespace
        on namespace.oid = function_record.pronamespace
       and namespace.nspname = 'public'
     where has_function_privilege(
       'service_role',
       function_record.oid,
       'EXECUTE'
     )
  ),
  11,
  'service_role alone receives the complete runtime function catalog'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from s02_sw_functions expected
      join pg_catalog.pg_proc function_record
        on function_record.proname = expected.function_name
      join pg_catalog.pg_namespace namespace
        on namespace.oid = function_record.pronamespace
       and namespace.nspname = 'public'
     where has_function_privilege(
       'authenticated',
       function_record.oid,
       'EXECUTE'
     )
  ),
  0,
  'authenticated cannot execute any Suggested Waypoint runtime function'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from s02_sw_functions expected
      join pg_catalog.pg_proc function_record
        on function_record.proname = expected.function_name
      join pg_catalog.pg_namespace namespace
        on namespace.oid = function_record.pronamespace
       and namespace.nspname = 'public'
     where has_function_privilege('anon', function_record.oid, 'EXECUTE')
  ),
  0,
  'anon cannot execute any Suggested Waypoint runtime function'
);

select is(
  (
    select pg_catalog.count(*)::integer
      from pg_catalog.pg_trigger trigger_record
      join pg_catalog.pg_class relation
        on relation.oid = trigger_record.tgrelid
      join pg_catalog.pg_namespace namespace
        on namespace.oid = relation.relnamespace
     where not trigger_record.tgisinternal
       and trigger_record.tgname in (
         'suggested_waypoint_version_immutable',
         'suggested_waypoint_read_state_immutable',
         'suggested_waypoint_receipt_immutable',
         'suggested_waypoint_operation_result_immutable'
       )
  ),
  4,
  'immutable delivered, private-state, receipt, and replay owners are guarded'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from pg_catalog.pg_trigger trigger_record
     where not trigger_record.tgisinternal
       and trigger_record.tgname in (
         'suggested_waypoint_guide_draft_content_guard',
         'suggested_waypoint_pending_content_guard',
         'suggested_waypoint_version_content_guard'
       )
  ),
  3,
  'all three content owners enforce normalization and bounded content'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from pg_catalog.pg_trigger trigger_record
     where not trigger_record.tgisinternal
       and trigger_record.tgname = 'suggested_waypoint_identity_guard'
  ),
  1,
  'stable owner identity is guarded against relationship mismatch'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from pg_catalog.pg_trigger trigger_record
     where not trigger_record.tgisinternal
       and trigger_record.tgname in (
         'suggested_waypoint_owner_state_guard',
         'suggested_waypoint_draft_state_guard',
         'suggested_waypoint_pending_state_guard'
       )
       and trigger_record.tgdeferrable
       and trigger_record.tginitdeferred
  ),
  3,
  'deferred guards enforce exactly one mode-appropriate mutable owner'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from pg_catalog.pg_proc function_record
      join pg_catalog.pg_namespace namespace
        on namespace.oid = function_record.pronamespace
     where namespace.nspname = 'content'
       and function_record.proname = 'solmind_suggested_waypoint_state_guard'
       and function_record.prosecdef
       and pg_catalog.pg_get_userbyid(function_record.proowner) = 'postgres'
       and 'search_path=""' = any(function_record.proconfig)
  ),
  1,
  'deferred state guard is a postgres-owned security definer with an empty search path'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from pg_catalog.pg_constraint constraint_record
     where constraint_record.conname in (
       'suggested_waypoint_version_number_unique',
       'suggested_waypoint_version_predecessor_fk',
       'suggested_waypoint_pending_deadline_check',
       'suggested_waypoint_operation_digest_check',
       'suggested_waypoint_operation_command_check',
       'suggested_waypoint_operation_actor_check'
     )
  ),
  6,
  'linear version, deadline, digest, command, and actor constraints exist'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from pg_catalog.pg_indexes index_record
     where index_record.schemaname = 'content'
       and index_record.indexname in (
         'suggested_waypoint_version_initial_unique_idx',
         'suggested_waypoint_version_one_child_idx',
         'suggested_waypoint_pending_deadline_idx'
       )
  ),
  3,
  'initial version, one-child lineage, and worker-deadline indexes exist'
);

select is(
  (
    select pg_catalog.pg_get_function_result(function_record.oid)
      from pg_catalog.pg_proc function_record
      join pg_catalog.pg_namespace namespace
        on namespace.oid = function_record.pronamespace
     where namespace.nspname = 'public'
       and function_record.proname =
           'solmind_save_suggested_waypoint_draft'
  ),
  'TABLE(outcome_code text, operation_id uuid, suggested_waypoint_id uuid, authoring_revision bigint, current_version_id uuid, committed_at timestamp with time zone, draft_saved_at timestamp with time zone)',
  'save-draft typed result shape is exact'
);
select is(
  (
    select pg_catalog.pg_get_function_result(function_record.oid)
      from pg_catalog.pg_proc function_record
      join pg_catalog.pg_namespace namespace
        on namespace.oid = function_record.pronamespace
     where namespace.nspname = 'public'
       and function_record.proname =
           'solmind_schedule_suggested_waypoint_send'
  ),
  'TABLE(outcome_code text, operation_id uuid, suggested_waypoint_id uuid, authoring_revision bigint, current_version_id uuid, committed_at timestamp with time zone, pending_version_id uuid, deadline_at timestamp with time zone, policy_key text, policy_version bigint, effective_seconds integer)',
  'schedule-send typed result shape is exact'
);
select is(
  (
    select pg_catalog.pg_get_function_result(function_record.oid)
      from pg_catalog.pg_proc function_record
      join pg_catalog.pg_namespace namespace
        on namespace.oid = function_record.pronamespace
     where namespace.nspname = 'public'
       and function_record.proname =
           'solmind_list_explorer_suggested_waypoints'
  ),
  'TABLE(items jsonb, next_cursor text, total_count bigint)',
  'Explorer list envelope shape is exact'
);
select is(
  (
    select pg_catalog.pg_get_function_result(function_record.oid)
      from pg_catalog.pg_proc function_record
      join pg_catalog.pg_namespace namespace
        on namespace.oid = function_record.pronamespace
     where namespace.nspname = 'public'
       and function_record.proname =
           'solmind_get_admin_suggested_waypoint_operational_state'
  ),
  'TABLE(suggested_waypoint_id uuid, guide_explorer_relationship_id uuid, current_version_id uuid, pending_version_id uuid, policy_key text, policy_version bigint, worker_operation_id uuid, audit_correlation_id uuid, lifecycle_category text, outcome_code text, state_changed_at timestamp with time zone)',
  'routine Admin projection is operational and value-free by shape'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from pg_catalog.pg_proc function_record
      join pg_catalog.pg_namespace namespace
        on namespace.oid = function_record.pronamespace
     where namespace.nspname = 'content'
       and function_record.proname like
           'solmind_%suggested_waypoint%'
       and has_function_privilege(
         'service_role', function_record.oid, 'EXECUTE'
       )
  ),
  0,
  'service_role cannot execute protected content-schema helpers directly'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.event_type like 'suggested_waypoint_%'
  ),
  0,
  'migration creates no synthetic Suggested Waypoint audit event'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from content.suggested_waypoint
  ),
  0,
  'migration creates no Suggested Waypoint or real-user row'
);

select * from finish();
rollback;
