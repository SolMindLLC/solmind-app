-- Local ephemeral database only. All synthetic rows are transaction-scoped.
begin;
select plan(61);

create function pg_temp.s02_fail_reserved_audit()
returns trigger
language plpgsql
as $$
begin
  if new.metadata ->> 'operation_id' in (
       'a3100210-3060-4000-8000-000000000001',
       'a3100210-4360-4000-8000-000000000001'
     )
  then
    raise exception 's02_forced_audit_failure';
  end if;
  return new;
end;
$$;

create trigger s02_fail_reserved_audit_trigger
before insert on audit.audit_event
for each row execute function pg_temp.s02_fail_reserved_audit();

insert into identity.user_account (
  user_account_id,
  display_name,
  username,
  account_status
) values
  (
    'a3100210-1000-4000-8000-000000000001',
    'S02 Summary Guide',
    's02_summary_guide',
    'active'
  ),
  (
    'a3100210-1000-4000-8000-000000000002',
    'S02 Summary Explorer',
    's02_summary_explorer',
    'active'
  );

insert into identity.user_role_assignment (
  user_role_assignment_id,
  user_account_id,
  role_code,
  role_status
) values
  (
    'a3100210-1050-4000-8000-000000000001',
    'a3100210-1000-4000-8000-000000000001',
    'guide',
    'active'
  ),
  (
    'a3100210-1050-4000-8000-000000000002',
    'a3100210-1000-4000-8000-000000000002',
    'explorer',
    'active'
  );

insert into core.organization (
  organization_id,
  organization_name
) values (
  'a3100210-1100-4000-8000-000000000001',
  'S02 Summary Organization'
);

insert into core.practice (
  practice_id,
  organization_id,
  practice_name
) values (
  'a3100210-1200-4000-8000-000000000001',
  'a3100210-1100-4000-8000-000000000001',
  'S02 Summary Practice'
);

insert into core.guide_profile (
  guide_profile_id,
  user_account_id,
  guide_display_name
) values (
  'a3100210-1300-4000-8000-000000000001',
  'a3100210-1000-4000-8000-000000000001',
  'Morgan'
);

insert into core.explorer_profile (
  explorer_profile_id,
  user_account_id,
  explorer_display_name,
  onboarding_status
) values (
  'a3100210-1400-4000-8000-000000000001',
  'a3100210-1000-4000-8000-000000000002',
  'Avery',
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
  'a3100210-1500-4000-8000-000000000001',
  'a3100210-1300-4000-8000-000000000001',
  'a3100210-1400-4000-8000-000000000001',
  'a3100210-1200-4000-8000-000000000001',
  'active',
  now() - interval '1 day'
);

insert into content.summary (
  summary_id,
  guide_explorer_relationship_id,
  summary_type,
  summary_status,
  created_by_actor_type,
  created_by_user_account_id
) values (
  'a3100210-2000-4000-8000-000000000001',
  'a3100210-1500-4000-8000-000000000001',
  'explorer_facing_summary',
  'approved',
  'guide',
  'a3100210-1000-4000-8000-000000000001'
);

select throws_ok(
  $$
    insert into content.summary (
      guide_explorer_relationship_id,
      summary_type,
      created_by_actor_type,
      created_by_user_account_id
    ) values (
      'a3100210-1500-4000-8000-000000000001',
      'suggested_waypoint',
      'guide',
      'a3100210-1000-4000-8000-000000000001'
    )
  $$,
  '23514',
  null,
  'Suggested Waypoint identity is rejected as a Summary type'
);

insert into content.summary_revision (
  summary_revision_id,
  summary_id,
  revision_number,
  content_markdown,
  revision_status,
  created_by_actor_type,
  created_by_user_account_id,
  created_by_role_context
) values (
  'a3100210-2100-4000-8000-000000000001',
  'a3100210-2000-4000-8000-000000000001',
  1,
  'Explorer-facing text. Guide-only context is separate.',
  'guide_approved',
  'guide',
  'a3100210-1000-4000-8000-000000000001',
  'guide'
);

update content.summary
   set current_revision_id =
       'a3100210-2100-4000-8000-000000000001'
 where summary_id = 'a3100210-2000-4000-8000-000000000001';

insert into content.summary_section (
  summary_section_id,
  summary_revision_id,
  section_type,
  section_title,
  content_markdown,
  visibility,
  display_order
) values
  (
    'a3100210-2200-4000-8000-000000000001',
    'a3100210-2100-4000-8000-000000000001',
    'explorer_facing',
    'Shared progress',
    'Avery protected one evening for recovery.',
    'explorer_publishable',
    1
  ),
  (
    'a3100210-2200-4000-8000-000000000002',
    'a3100210-2100-4000-8000-000000000001',
    'guide_only',
    'Guide context',
    'This sensitive context must never cross the boundary.',
    'guide_only',
    2
  );

select throws_ok(
  $$
    insert into content.summary_section (
      summary_revision_id,
      section_type,
      section_title,
      content_markdown,
      visibility,
      display_order
    ) values (
      'a3100210-2100-4000-8000-000000000001',
      'sensitive_observation',
      'Invalid visibility',
      'Sensitive content may never be Explorer-publishable.',
      'explorer_publishable',
      3
    )
  $$,
  '23514',
  null,
  'sensitive sections cannot enter an Explorer-publishable state'
);

select throws_ok(
  $$
    update content.summary_revision
       set content_markdown = 'Attempted in-place rewrite.'
     where summary_revision_id =
           'a3100210-2100-4000-8000-000000000001'
  $$,
  'P0001',
  'solmind_summary_revision_content_immutable',
  'Summary revision content cannot be rewritten in place'
);

set local role service_role;

create temp table s02_publish_result as
select *
  from public.solmind_publish_summary_to_explorer(
    'a3100210-2000-4000-8000-000000000001',
    'a3100210-2100-4000-8000-000000000001',
    'a3100210-1400-4000-8000-000000000001',
    'a3100210-1000-4000-8000-000000000001',
    1,
    'a3100210-3000-4000-8000-000000000001'
  );

select is((select outcome from s02_publish_result), 'published', 'Guide publishes the approved current revision');
select is((select summary_version from s02_publish_result), 2::bigint, 'publication advances the Summary version once');

reset role;

select is((select pg_catalog.count(*)::integer from content.summary_publication where publication_status = 'published'), 1, 'one authoritative publication exists');
select is((select pg_catalog.count(*)::integer from reporting.vw_explorer_published_summary_timeline), 1, 'exactly one Explorer-facing section is visible');
select is((select section_title from reporting.vw_explorer_published_summary_timeline), 'Shared progress', 'the eligible section crosses the boundary');
select is((select pg_catalog.count(*)::integer from reporting.vw_explorer_published_summary_timeline where content_markdown like '%sensitive%'), 0, 'Guide-only sensitive content does not cross');
select is((select revision_status from content.summary_revision where summary_revision_id = 'a3100210-2100-4000-8000-000000000001'), 'published_to_explorer', 'revision label is synchronized');
select is((select visibility from content.summary_section where summary_section_id = 'a3100210-2200-4000-8000-000000000001'), 'published_to_explorer', 'Explorer-facing section label is synchronized');
select is((select visibility from content.summary_section where summary_section_id = 'a3100210-2200-4000-8000-000000000002'), 'guide_only', 'Guide-only section remains guide only');
select is((select pg_catalog.count(*)::integer from audit.audit_event where event_type = 'summary_publication_changed' and action = 'publish'), 1, 'publish writes one content-free audit event');

update content.summary_revision
   set revision_status = 'guide_approved'
 where summary_revision_id = 'a3100210-2100-4000-8000-000000000001';

set local role service_role;

select is(
  public.solmind_check_summary_visibility_integrity(
    'a3100210-2000-4000-8000-000000000001',
    'a3100210-3050-4000-8000-000000000001'
  ),
  false,
  'visibility-integrity check fails closed on a revision-label mismatch'
);

reset role;

select is((select pg_catalog.count(*)::integer from reporting.vw_explorer_published_summary_timeline), 0, 'authoritative view hides a mismatched publication');
select is((select pg_catalog.count(*)::integer from audit.audit_event where event_type = 'visibility_state_mismatch' and target_entity_id = 'a3100210-2000-4000-8000-000000000001'), 1, 'mismatch writes one content-free integrity event');

set local role service_role;

select is(
  public.solmind_check_summary_visibility_integrity(
    'a3100210-2000-4000-8000-000000000001',
    'a3100210-3050-4000-8000-000000000001'
  ),
  false,
  'exact mismatch-check retry preserves the fail-closed result'
);

reset role;

select is((select pg_catalog.count(*)::integer from audit.audit_event where event_type = 'visibility_state_mismatch' and target_entity_id = 'a3100210-2000-4000-8000-000000000001'), 1, 'exact mismatch-check retry does not duplicate audit');

update content.summary_revision
   set revision_status = 'published_to_explorer'
 where summary_revision_id = 'a3100210-2100-4000-8000-000000000001';

set local role service_role;

select is(
  (
    select outcome
      from public.solmind_publish_summary_to_explorer(
        'a3100210-2000-4000-8000-000000000001',
        'a3100210-2100-4000-8000-000000000001',
        'a3100210-1400-4000-8000-000000000001',
        'a3100210-1000-4000-8000-000000000001',
        1,
        'a3100210-3000-4000-8000-000000000001'
      )
  ),
  'already_published',
  'exact publication retry is writeless'
);

select throws_ok(
  $$
    select *
      from public.solmind_publish_summary_to_explorer(
        'a3100210-2000-4000-8000-000000000001',
        'a3100210-2100-4000-8000-000000000001',
        'a3100210-1400-4000-8000-000000000001',
        'a3100210-1000-4000-8000-000000000001',
        1,
        'a3100210-3000-4000-8000-000000000099'
      )
  $$,
  'P0001',
  'solmind_summary_publish_stale_version',
  'stale publication attempt fails closed'
);

create temp table s02_unpublish_result as
select *
  from public.solmind_unpublish_summary_from_explorer(
    (select summary_publication_id from s02_publish_result),
    'a3100210-1000-4000-8000-000000000001',
    2,
    'a3100210-3000-4000-8000-000000000002'
  );

select is((select outcome from s02_unpublish_result), 'unpublished', 'Guide unpublishes through the protected path');
select is((select summary_version from s02_unpublish_result), 3::bigint, 'unpublish advances the Summary version once');

reset role;

select is((select pg_catalog.count(*)::integer from reporting.vw_explorer_published_summary_timeline), 0, 'unpublish immediately removes Explorer visibility');
select is((select pg_catalog.count(*)::integer from content.summary_publication), 1, 'unpublish preserves publication history');
select is((select publication_status from content.summary_publication), 'unpublished', 'publication history records unpublish');
select is((select revision_status from content.summary_revision where summary_revision_id = 'a3100210-2100-4000-8000-000000000001'), 'guide_approved', 'unpublish restores the synchronized revision label');
select is((select visibility from content.summary_section where summary_section_id = 'a3100210-2200-4000-8000-000000000001'), 'explorer_publishable', 'unpublish restores the synchronized section label');

set local role service_role;

select throws_ok(
  $$
    select *
      from public.solmind_publish_summary_to_explorer(
        'a3100210-2000-4000-8000-000000000001',
        'a3100210-2100-4000-8000-000000000001',
        'a3100210-1400-4000-8000-000000000001',
        'a3100210-1000-4000-8000-000000000001',
        3,
        'a3100210-3060-4000-8000-000000000001'
      )
  $$,
  'P0001',
  's02_forced_audit_failure',
  'publication rolls back when its audit event cannot persist'
);

reset role;

select is((select pg_catalog.count(*)::integer from content.summary_publication where publication_status = 'published'), 0, 'audit failure leaves no active publication');
select is((select version from content.summary where summary_id = 'a3100210-2000-4000-8000-000000000001'), 3::bigint, 'audit failure does not advance the Summary version');
select is((select revision_status from content.summary_revision where summary_revision_id = 'a3100210-2100-4000-8000-000000000001'), 'guide_approved', 'audit failure preserves the revision label');
select is((select visibility from content.summary_section where summary_section_id = 'a3100210-2200-4000-8000-000000000001'), 'explorer_publishable', 'audit failure preserves the section label');

insert into content.private_summary_draft (
  private_summary_draft_id,
  guide_explorer_relationship_id,
  explorer_profile_id,
  source_waypoint_id,
  waypoint_reached_at,
  sendability_days_applied,
  sendable_until
) values (
  'a3100210-4000-4000-8000-000000000001',
  'a3100210-1500-4000-8000-000000000001',
  'a3100210-1400-4000-8000-000000000001',
  'a3100210-4100-4000-8000-000000000001',
  date_trunc('second', now()),
  7,
  date_trunc('second', now()) + interval '7 days'
);

insert into content.private_summary_draft_item (
  private_summary_draft_item_id,
  private_summary_draft_id,
  item_type,
  source_type,
  source_entity_id,
  content_markdown,
  selection_state,
  display_order
) values
  (
    'a3100210-4200-4000-8000-000000000001',
    'a3100210-4000-4000-8000-000000000001',
    'main_point',
    'waypoint',
    'a3100210-4100-4000-8000-000000000001',
    'Protect one evening each week for recovery.',
    'included',
    1
  ),
  (
    'a3100210-4200-4000-8000-000000000002',
    'a3100210-4000-4000-8000-000000000001',
    'quote',
    'explorer_authored',
    null,
    'This excluded private quote must never cross.',
    'excluded',
    2
  );

set local role service_role;

create temp table s02_snapshot_result as
select *
  from public.solmind_confirm_shared_snapshot(
    'a3100210-4000-4000-8000-000000000001',
    'a3100210-1000-4000-8000-000000000002',
    1,
    'original',
    null,
    'a3100210-4300-4000-8000-000000000001'
  );

select is((select outcome from s02_snapshot_result), 'confirmed', 'Explorer confirms the fresh exact review');
select is((select draft_version from s02_snapshot_result), 2::bigint, 'confirmation advances the private draft version once');

reset role;

select is((select pg_catalog.count(*)::integer from content.shared_snapshot), 1, 'one immutable Shared Snapshot exists');
select is((select pg_catalog.count(*)::integer from content.shared_snapshot_item), 1, 'only one included item was copied');
select is((select content_markdown from content.shared_snapshot_item), 'Protect one evening each week for recovery.', 'the exact included content was copied');
select is((select pg_catalog.count(*)::integer from content.shared_snapshot_item where content_markdown like '%excluded%'), 0, 'excluded private content was not persisted to Guide-visible owners');
select is((select pg_catalog.length(snapshot_sha256) from content.shared_snapshot), 64, 'snapshot has a 64-character digest');
select is((select draft_status from content.private_summary_draft where private_summary_draft_id = 'a3100210-4000-4000-8000-000000000001'), 'confirmed', 'private draft records terminal confirmation');
select is((select pg_catalog.count(*)::integer from audit.audit_event where event_type = 'shared_snapshot_confirmed'), 1, 'confirmation writes one content-free audit event');

set local role service_role;

select is(
  (
    select outcome
      from public.solmind_confirm_shared_snapshot(
        'a3100210-4000-4000-8000-000000000001',
        'a3100210-1000-4000-8000-000000000002',
        1,
        'original',
        null,
        'a3100210-4300-4000-8000-000000000001'
      )
  ),
  'already_confirmed',
  'exact Snapshot confirmation retry is writeless'
);

select throws_ok(
  $$
    update content.shared_snapshot
       set confirmed_at = now()
     where shared_snapshot_id =
           'a3100210-4300-4000-8000-000000000001'
  $$,
  '42501',
  null,
  'service role has no direct Snapshot mutation path'
);

reset role;

insert into content.private_summary_draft (
  private_summary_draft_id,
  guide_explorer_relationship_id,
  explorer_profile_id,
  waypoint_reached_at,
  sendability_days_applied,
  sendable_until
) values
  (
    'a3100210-4000-4000-8000-000000000004',
    'a3100210-1500-4000-8000-000000000001',
    'a3100210-1400-4000-8000-000000000001',
    date_trunc('second', now()),
    7,
    date_trunc('second', now()) + interval '7 days'
  ),
  (
    'a3100210-4000-4000-8000-000000000005',
    'a3100210-1500-4000-8000-000000000001',
    'a3100210-1400-4000-8000-000000000001',
    date_trunc('second', now()),
    7,
    date_trunc('second', now()) + interval '7 days'
  );

insert into content.private_summary_draft_item (
  private_summary_draft_item_id,
  private_summary_draft_id,
  item_type,
  source_type,
  content_markdown,
  selection_state,
  display_order
) values
  (
    'a3100210-4200-4000-8000-000000000004',
    'a3100210-4000-4000-8000-000000000004',
    'supporting_detail',
    'explorer_authored',
    'A later clarification is separately confirmed.',
    'included',
    1
  ),
  (
    'a3100210-4200-4000-8000-000000000005',
    'a3100210-4000-4000-8000-000000000005',
    'main_point',
    'explorer_authored',
    'A replacement preserves the original Snapshot.',
    'included',
    1
  );

set local role service_role;

create temp table s02_addendum_result as
select *
  from public.solmind_confirm_shared_snapshot(
    'a3100210-4000-4000-8000-000000000004',
    'a3100210-1000-4000-8000-000000000002',
    1,
    'addendum',
    (select shared_snapshot_id from s02_snapshot_result),
    'a3100210-4300-4000-8000-000000000004'
  );

select is((select outcome from s02_addendum_result), 'confirmed', 'Explorer confirms an addendum separately');

create temp table s02_replacement_result as
select *
  from public.solmind_confirm_shared_snapshot(
    'a3100210-4000-4000-8000-000000000005',
    'a3100210-1000-4000-8000-000000000002',
    1,
    'replacement',
    (select shared_snapshot_id from s02_snapshot_result),
    'a3100210-4300-4000-8000-000000000005'
  );

select is((select outcome from s02_replacement_result), 'confirmed', 'Explorer confirms a replacement separately');

reset role;

select is((select lineage_type from content.shared_snapshot where shared_snapshot_id = (select shared_snapshot_id from s02_addendum_result)), 'addendum', 'addendum lineage is explicit');
select is((select predecessor_shared_snapshot_id from content.shared_snapshot where shared_snapshot_id = (select shared_snapshot_id from s02_addendum_result)), (select shared_snapshot_id from s02_snapshot_result), 'addendum preserves the original predecessor');
select is((select lineage_type from content.shared_snapshot where shared_snapshot_id = (select shared_snapshot_id from s02_replacement_result)), 'replacement', 'replacement lineage is explicit');
select is((select pg_catalog.count(*)::integer from content.shared_snapshot where shared_snapshot_id in ((select shared_snapshot_id from s02_snapshot_result), (select shared_snapshot_id from s02_addendum_result), (select shared_snapshot_id from s02_replacement_result))), 3, 'original, addendum, and replacement all remain preserved');

select throws_ok(
  $$
    update content.shared_snapshot
       set confirmed_at = now()
     where source_private_summary_draft_id =
           'a3100210-4000-4000-8000-000000000001'
  $$,
  'P0001',
  'solmind_shared_snapshot_update_forbidden',
  'even the owner cannot rewrite a confirmed Snapshot'
);

insert into content.private_summary_draft (
  private_summary_draft_id,
  guide_explorer_relationship_id,
  explorer_profile_id,
  waypoint_reached_at,
  sendability_days_applied,
  sendable_until,
  draft_status
) values (
  'a3100210-4000-4000-8000-000000000002',
  'a3100210-1500-4000-8000-000000000001',
  'a3100210-1400-4000-8000-000000000001',
  date_trunc('second', now()),
  7,
  date_trunc('second', now()) + interval '7 days',
  'not_ready'
);

select is((select pg_catalog.count(*)::integer from content.shared_snapshot where source_private_summary_draft_id = 'a3100210-4000-4000-8000-000000000002'), 0, 'Not ready to share creates no Shared Snapshot');
select is((select pg_catalog.count(*)::integer from content.summary_publication), 1, 'Not ready creates no additional Guide-publication record');

insert into content.private_summary_draft (
  private_summary_draft_id,
  guide_explorer_relationship_id,
  explorer_profile_id,
  waypoint_reached_at,
  sendability_days_applied,
  sendable_until
) values (
  'a3100210-4000-4000-8000-000000000006',
  'a3100210-1500-4000-8000-000000000001',
  'a3100210-1400-4000-8000-000000000001',
  date_trunc('second', now()),
  7,
  date_trunc('second', now()) + interval '7 days'
);

insert into content.private_summary_draft_item (
  private_summary_draft_item_id,
  private_summary_draft_id,
  item_type,
  source_type,
  content_markdown,
  selection_state,
  display_order
) values (
  'a3100210-4200-4000-8000-000000000006',
  'a3100210-4000-4000-8000-000000000006',
  'main_point',
  'explorer_authored',
  'This attempted Snapshot must roll back with its audit failure.',
  'included',
  1
);

set local role service_role;

select throws_ok(
  $$
    select *
      from public.solmind_confirm_shared_snapshot(
        'a3100210-4000-4000-8000-000000000006',
        'a3100210-1000-4000-8000-000000000002',
        1,
        'original',
        null,
        'a3100210-4360-4000-8000-000000000001'
      )
  $$,
  'P0001',
  's02_forced_audit_failure',
  'Snapshot confirmation rolls back when its audit event cannot persist'
);

reset role;

select is((select pg_catalog.count(*)::integer from content.shared_snapshot where source_private_summary_draft_id = 'a3100210-4000-4000-8000-000000000006'), 0, 'audit failure leaves no partial Snapshot');
select is((select draft_status from content.private_summary_draft where private_summary_draft_id = 'a3100210-4000-4000-8000-000000000006'), 'reviewable', 'audit failure preserves the private-draft state');
select is((select version from content.private_summary_draft where private_summary_draft_id = 'a3100210-4000-4000-8000-000000000006'), 1::bigint, 'audit failure preserves the private-draft version');
select is((select pg_catalog.count(*)::integer from audit.audit_event where metadata ->> 'operation_id' = 'a3100210-4360-4000-8000-000000000001'), 0, 'failed confirmation leaves no audit residue');

insert into content.private_summary_draft (
  private_summary_draft_id,
  guide_explorer_relationship_id,
  explorer_profile_id,
  waypoint_reached_at,
  sendability_days_applied,
  sendable_until
) values (
  'a3100210-4000-4000-8000-000000000003',
  'a3100210-1500-4000-8000-000000000001',
  'a3100210-1400-4000-8000-000000000001',
  date_trunc('second', now()) - interval '8 days',
  7,
  date_trunc('second', now()) - interval '1 day'
);

insert into content.private_summary_draft_item (
  private_summary_draft_item_id,
  private_summary_draft_id,
  item_type,
  source_type,
  content_markdown,
  selection_state,
  display_order
) values (
  'a3100210-4200-4000-8000-000000000003',
  'a3100210-4000-4000-8000-000000000003',
  'main_point',
  'explorer_authored',
  'Expired content stays private and cannot be sent as-is.',
  'included',
  1
);

set local role service_role;

create temp table s02_expired_result as
select *
  from public.solmind_confirm_shared_snapshot(
    'a3100210-4000-4000-8000-000000000003',
    'a3100210-1000-4000-8000-000000000002',
    1,
    'original',
    null,
    'a3100210-4300-4000-8000-000000000003'
  );

select is((select outcome from s02_expired_result), 'expired_not_sent', 'server time closes an expired unshared opportunity');

reset role;

select is((select draft_status from content.private_summary_draft where private_summary_draft_id = 'a3100210-4000-4000-8000-000000000003'), 'expired_not_sent', 'expired disposition is terminal and retained');
select is((select pg_catalog.count(*)::integer from content.shared_snapshot where source_private_summary_draft_id = 'a3100210-4000-4000-8000-000000000003'), 0, 'expired unshared draft creates no Snapshot');
select is((select pg_catalog.count(*)::integer from content.shared_snapshot where source_private_summary_draft_id = 'a3100210-4000-4000-8000-000000000001'), 1, 'Snapshot confirmed before expiry remains preserved');

select * from finish();
rollback;
