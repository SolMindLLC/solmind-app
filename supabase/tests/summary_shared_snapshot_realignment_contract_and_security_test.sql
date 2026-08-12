begin;
select plan(56);

select has_table('content', 'summary_section', 'summary-section table exists');
select has_table('content', 'summary_publication', 'summary-publication table exists');
select has_table('content', 'private_summary_draft', 'private-summary-draft table exists');
select has_table('content', 'private_summary_draft_item', 'private-summary-draft-item table exists');
select has_table('content', 'shared_snapshot', 'shared-snapshot table exists');
select has_table('content', 'shared_snapshot_item', 'shared-snapshot-item table exists');

select ok(
  (select c.relrowsecurity from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'content' and c.relname = 'summary_section'),
  'summary-section RLS is enabled'
);
select ok(
  (select c.relrowsecurity from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'content' and c.relname = 'summary_publication'),
  'summary-publication RLS is enabled'
);
select ok(
  (select c.relrowsecurity from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'content' and c.relname = 'private_summary_draft'),
  'private-summary-draft RLS is enabled'
);
select ok(
  (select c.relrowsecurity from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'content' and c.relname = 'private_summary_draft_item'),
  'private-summary-draft-item RLS is enabled'
);
select ok(
  (select c.relrowsecurity from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'content' and c.relname = 'shared_snapshot'),
  'shared-snapshot RLS is enabled'
);
select ok(
  (select c.relrowsecurity from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'content' and c.relname = 'shared_snapshot_item'),
  'shared-snapshot-item RLS is enabled'
);

select is((select pg_catalog.count(*)::integer from pg_catalog.pg_policies where schemaname = 'content' and tablename = 'summary_section'), 0, 'summary-section has zero policies');
select is((select pg_catalog.count(*)::integer from pg_catalog.pg_policies where schemaname = 'content' and tablename = 'summary_publication'), 0, 'summary-publication has zero policies');
select is((select pg_catalog.count(*)::integer from pg_catalog.pg_policies where schemaname = 'content' and tablename = 'private_summary_draft'), 0, 'private-summary-draft has zero policies');
select is((select pg_catalog.count(*)::integer from pg_catalog.pg_policies where schemaname = 'content' and tablename = 'private_summary_draft_item'), 0, 'private-summary-draft-item has zero policies');
select is((select pg_catalog.count(*)::integer from pg_catalog.pg_policies where schemaname = 'content' and tablename = 'shared_snapshot'), 0, 'shared-snapshot has zero policies');
select is((select pg_catalog.count(*)::integer from pg_catalog.pg_policies where schemaname = 'content' and tablename = 'shared_snapshot_item'), 0, 'shared-snapshot-item has zero policies');

select has_column('content', 'summary', 'current_revision_id', 'summary has current revision identity');
select has_column('content', 'summary', 'created_from_ai_interaction_session_id', 'summary has AI-session provenance');
select has_column('content', 'summary', 'created_from_appointment_id', 'summary has appointment provenance');
select hasnt_column('content', 'summary', 'visibility', 'container visibility was removed');
select has_column('content', 'summary', 'version', 'summary has concurrency version');

select has_column('content', 'summary_revision', 'content_markdown', 'revision has canonical content field');
select has_column('content', 'summary_revision', 'created_by_role_context', 'revision has actor role context');
select has_column('content', 'summary_revision', 'previous_revision_id', 'revision has predecessor identity');
select has_column('content', 'summary_revision', 'ai_change_summary', 'revision has AI change summary');
select hasnt_column('content', 'summary_revision', 'summary_text', 'stale summary-text field was removed');

select col_has_check('content', 'summary_section', 'section_type', 'summary-section type is constrained');
select col_has_check('content', 'summary_section', 'visibility', 'summary-section visibility is constrained');
select col_has_check('content', 'summary_publication', 'publication_status', 'publication status is constrained');
select col_has_check('content', 'private_summary_draft', 'draft_status', 'private-draft status is constrained');
select col_has_check('content', 'shared_snapshot', 'lineage_type', 'snapshot lineage is constrained');

select has_function('public', 'solmind_publish_summary_to_explorer', array['uuid','uuid','uuid','uuid','bigint','uuid'], 'publish function exists');
select has_function('public', 'solmind_unpublish_summary_from_explorer', array['uuid','uuid','bigint','uuid'], 'unpublish function exists');
select has_function('public', 'solmind_confirm_shared_snapshot', array['uuid','uuid','bigint','text','uuid','uuid'], 'snapshot-confirm function exists');
select has_function('public', 'solmind_check_summary_visibility_integrity', array['uuid','uuid'], 'visibility-integrity check exists');

select ok(has_function_privilege('service_role', 'public.solmind_publish_summary_to_explorer(uuid,uuid,uuid,uuid,bigint,uuid)', 'EXECUTE'), 'service role may publish');
select ok(has_function_privilege('service_role', 'public.solmind_unpublish_summary_from_explorer(uuid,uuid,bigint,uuid)', 'EXECUTE'), 'service role may unpublish');
select ok(has_function_privilege('service_role', 'public.solmind_confirm_shared_snapshot(uuid,uuid,bigint,text,uuid,uuid)', 'EXECUTE'), 'service role may confirm exact snapshots');
select ok(has_function_privilege('service_role', 'public.solmind_check_summary_visibility_integrity(uuid,uuid)', 'EXECUTE'), 'service role may run the fail-closed visibility check');

select ok(not has_function_privilege('anon', 'public.solmind_publish_summary_to_explorer(uuid,uuid,uuid,uuid,bigint,uuid)', 'EXECUTE'), 'anonymous may not publish');
select ok(not has_function_privilege('anon', 'public.solmind_unpublish_summary_from_explorer(uuid,uuid,bigint,uuid)', 'EXECUTE'), 'anonymous may not unpublish');
select ok(not has_function_privilege('anon', 'public.solmind_confirm_shared_snapshot(uuid,uuid,bigint,text,uuid,uuid)', 'EXECUTE'), 'anonymous may not confirm snapshots');
select ok(not has_function_privilege('anon', 'public.solmind_check_summary_visibility_integrity(uuid,uuid)', 'EXECUTE'), 'anonymous may not run the visibility check');

select ok(
  not has_table_privilege('authenticated', 'content.private_summary_draft', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'content.shared_snapshot', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'content.summary_publication', 'SELECT,INSERT,UPDATE,DELETE'),
  'authenticated has no direct content-table path'
);
select ok(
  not has_table_privilege('service_role', 'content.private_summary_draft', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('service_role', 'content.shared_snapshot', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('service_role', 'content.summary_publication', 'SELECT,INSERT,UPDATE,DELETE'),
  'service role has no direct content-table path'
);

select has_view('reporting', 'vw_explorer_published_summary_timeline', 'authoritative publication view exists');
select ok(
  (
    select 'security_invoker=true' = any(view_row.reloptions)
      from pg_catalog.pg_class view_row
      join pg_catalog.pg_namespace namespace
        on namespace.oid = view_row.relnamespace
     where namespace.nspname = 'reporting'
       and view_row.relname = 'vw_explorer_published_summary_timeline'
  ),
  'authoritative publication view uses invoker security'
);
select ok(not has_table_privilege('service_role', 'reporting.vw_explorer_published_summary_timeline', 'SELECT'), 'dormant publication view is ungranted');

select ok(
  not exists (
    select 1
      from pg_catalog.pg_constraint constraint_row
     where pg_catalog.pg_get_constraintdef(constraint_row.oid) ilike '%suggested_waypoint%'
       and constraint_row.connamespace = 'content'::regnamespace
  ),
  'Suggested Waypoint identity is absent from Summary and Snapshot constraints'
);

select has_trigger('content', 'summary_revision', 'summary_revision_content_immutable_trigger', 'revision immutability trigger exists');
select has_trigger('content', 'summary_section', 'summary_section_content_immutable_trigger', 'section immutability trigger exists');
select has_trigger('content', 'shared_snapshot', 'shared_snapshot_immutable_trigger', 'snapshot immutability trigger exists');
select has_trigger('content', 'shared_snapshot_item', 'shared_snapshot_item_immutable_trigger', 'snapshot-item immutability trigger exists');

select is(
  (
    select pg_catalog.count(*)::integer
      from pg_catalog.pg_proc procedure
      join pg_catalog.pg_namespace namespace
        on namespace.oid = procedure.pronamespace
     where namespace.nspname = 'public'
       and procedure.proname in (
         'solmind_publish_summary_to_explorer',
         'solmind_unpublish_summary_from_explorer',
         'solmind_confirm_shared_snapshot',
         'solmind_check_summary_visibility_integrity'
       )
       and procedure.prosecdef
       and 'search_path=""' = any(procedure.proconfig)
       and 'lock_timeout=2s' = any(procedure.proconfig)
  ),
  4,
  'all three mutations and the integrity check are bounded security definers with empty search paths'
);

select * from finish();
rollback;
