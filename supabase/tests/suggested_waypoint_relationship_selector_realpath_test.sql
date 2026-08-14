-- Local ephemeral database only. All synthetic rows are transaction-scoped.
begin;
select plan(20);

insert into identity.user_account (
  user_account_id, display_name, username, account_status
) values
  ('a3140000-1000-4000-8000-000000000001', 'Selector Guide', 'selector_guide', 'active'),
  ('a3140000-1000-4000-8000-000000000002', 'Other Guide', 'selector_other_guide', 'active'),
  ('a3140000-1000-4000-8000-000000000101', 'Explorer 1', 'selector_explorer_1', 'active'),
  ('a3140000-1000-4000-8000-000000000102', 'Explorer 2', 'selector_explorer_2', 'active'),
  ('a3140000-1000-4000-8000-000000000103', 'Explorer 3', 'selector_explorer_3', 'active'),
  ('a3140000-1000-4000-8000-000000000104', 'Explorer 4', 'selector_explorer_4', 'active'),
  ('a3140000-1000-4000-8000-000000000105', 'Explorer 5', 'selector_explorer_5', 'active'),
  ('a3140000-1000-4000-8000-000000000106', 'Explorer 6', 'selector_explorer_6', 'active'),
  ('a3140000-1000-4000-8000-000000000107', 'Inactive Explorer', 'selector_explorer_7', 'inactive'),
  ('a3140000-1000-4000-8000-000000000108', 'Paused Explorer', 'selector_explorer_8', 'active'),
  ('a3140000-1000-4000-8000-000000000109', 'Other Explorer', 'selector_explorer_9', 'active');

insert into identity.user_role_assignment (
  user_role_assignment_id, user_account_id, role_code, role_status
) values
  ('a3140000-1050-4000-8000-000000000001', 'a3140000-1000-4000-8000-000000000001', 'guide', 'active'),
  ('a3140000-1050-4000-8000-000000000002', 'a3140000-1000-4000-8000-000000000002', 'guide', 'active'),
  ('a3140000-1050-4000-8000-000000000101', 'a3140000-1000-4000-8000-000000000101', 'explorer', 'active'),
  ('a3140000-1050-4000-8000-000000000102', 'a3140000-1000-4000-8000-000000000102', 'explorer', 'active'),
  ('a3140000-1050-4000-8000-000000000103', 'a3140000-1000-4000-8000-000000000103', 'explorer', 'active'),
  ('a3140000-1050-4000-8000-000000000104', 'a3140000-1000-4000-8000-000000000104', 'explorer', 'active'),
  ('a3140000-1050-4000-8000-000000000105', 'a3140000-1000-4000-8000-000000000105', 'explorer', 'active'),
  ('a3140000-1050-4000-8000-000000000106', 'a3140000-1000-4000-8000-000000000106', 'explorer', 'active'),
  ('a3140000-1050-4000-8000-000000000107', 'a3140000-1000-4000-8000-000000000107', 'explorer', 'active'),
  ('a3140000-1050-4000-8000-000000000108', 'a3140000-1000-4000-8000-000000000108', 'explorer', 'active'),
  ('a3140000-1050-4000-8000-000000000109', 'a3140000-1000-4000-8000-000000000109', 'explorer', 'active');

insert into core.organization (organization_id, organization_name)
values ('a3140000-1100-4000-8000-000000000001', 'Selector Organization');
insert into core.practice (practice_id, organization_id, practice_name)
values (
  'a3140000-1200-4000-8000-000000000001',
  'a3140000-1100-4000-8000-000000000001',
  'Selector Practice'
);

insert into core.guide_profile (
  guide_profile_id, user_account_id, guide_display_name
) values
  ('a3140000-1300-4000-8000-000000000001', 'a3140000-1000-4000-8000-000000000001', 'Morgan'),
  ('a3140000-1300-4000-8000-000000000002', 'a3140000-1000-4000-8000-000000000002', 'Taylor');

insert into core.explorer_profile (
  explorer_profile_id, user_account_id, explorer_display_name, onboarding_status
) values
  ('a3140000-1400-4000-8000-000000000101', 'a3140000-1000-4000-8000-000000000101', 'Avery', 'active'),
  ('a3140000-1400-4000-8000-000000000102', 'a3140000-1000-4000-8000-000000000102', 'Blair', 'active'),
  ('a3140000-1400-4000-8000-000000000103', 'a3140000-1000-4000-8000-000000000103', 'Casey', 'active'),
  ('a3140000-1400-4000-8000-000000000104', 'a3140000-1000-4000-8000-000000000104', 'Devon', 'active'),
  ('a3140000-1400-4000-8000-000000000105', 'a3140000-1000-4000-8000-000000000105', 'Emery', 'active'),
  ('a3140000-1400-4000-8000-000000000106', 'a3140000-1000-4000-8000-000000000106', 'Finley', 'active'),
  ('a3140000-1400-4000-8000-000000000107', 'a3140000-1000-4000-8000-000000000107', 'Gray', 'active'),
  ('a3140000-1400-4000-8000-000000000108', 'a3140000-1000-4000-8000-000000000108', 'Harper', 'active'),
  ('a3140000-1400-4000-8000-000000000109', 'a3140000-1000-4000-8000-000000000109', 'Indigo', 'active');

insert into core.guide_explorer_relationship (
  guide_explorer_relationship_id,
  guide_profile_id,
  explorer_profile_id,
  practice_id,
  relationship_status,
  started_at,
  created_at
) values
  ('a3140000-1500-4000-8000-000000000101', 'a3140000-1300-4000-8000-000000000001', 'a3140000-1400-4000-8000-000000000101', 'a3140000-1200-4000-8000-000000000001', 'active', '2026-08-01T00:00:00Z', '2026-08-14T10:00:00Z'),
  ('a3140000-1500-4000-8000-000000000102', 'a3140000-1300-4000-8000-000000000001', 'a3140000-1400-4000-8000-000000000102', 'a3140000-1200-4000-8000-000000000001', 'active', '2026-08-01T00:00:00Z', '2026-08-14T10:00:00Z'),
  ('a3140000-1500-4000-8000-000000000103', 'a3140000-1300-4000-8000-000000000001', 'a3140000-1400-4000-8000-000000000103', 'a3140000-1200-4000-8000-000000000001', 'active', '2026-08-01T00:00:00Z', '2026-08-13T10:00:00Z'),
  ('a3140000-1500-4000-8000-000000000104', 'a3140000-1300-4000-8000-000000000001', 'a3140000-1400-4000-8000-000000000104', 'a3140000-1200-4000-8000-000000000001', 'active', '2026-08-01T00:00:00Z', '2026-08-12T10:00:00Z'),
  ('a3140000-1500-4000-8000-000000000105', 'a3140000-1300-4000-8000-000000000001', 'a3140000-1400-4000-8000-000000000105', 'a3140000-1200-4000-8000-000000000001', 'active', '2026-08-01T00:00:00Z', '2026-08-11T10:00:00Z'),
  ('a3140000-1500-4000-8000-000000000106', 'a3140000-1300-4000-8000-000000000001', 'a3140000-1400-4000-8000-000000000106', 'a3140000-1200-4000-8000-000000000001', 'active', '2026-08-01T00:00:00Z', '2026-08-10T10:00:00Z'),
  ('a3140000-1500-4000-8000-000000000107', 'a3140000-1300-4000-8000-000000000001', 'a3140000-1400-4000-8000-000000000107', 'a3140000-1200-4000-8000-000000000001', 'active', '2026-08-01T00:00:00Z', '2026-08-09T10:00:00Z'),
  ('a3140000-1500-4000-8000-000000000108', 'a3140000-1300-4000-8000-000000000001', 'a3140000-1400-4000-8000-000000000108', 'a3140000-1200-4000-8000-000000000001', 'paused', null, '2026-08-08T10:00:00Z'),
  ('a3140000-1500-4000-8000-000000000109', 'a3140000-1300-4000-8000-000000000002', 'a3140000-1400-4000-8000-000000000109', 'a3140000-1200-4000-8000-000000000001', 'active', '2026-08-01T00:00:00Z', '2026-08-07T10:00:00Z');

set local role service_role;

create temp table selector_page_one as
select * from public.solmind_list_guide_suggested_waypoint_relationships(
  'a3140000-1000-4000-8000-000000000001', 5, null
);

select is((select total_count from selector_page_one), 6::bigint,
          'selector counts only own actionable active relationships');
select is(pg_catalog.jsonb_array_length((select items from selector_page_one)), 5,
          'selector returns the requested first page');
select isnt((select next_cursor from selector_page_one), null::text,
            'selector returns an opaque continuation cursor');
select is((select items->0->>'guide_explorer_relationship_id' from selector_page_one),
          'a3140000-1500-4000-8000-000000000102',
          'same-time rows use descending relationship UUID as tie-breaker');
select is((select items->0->>'explorer_display_name' from selector_page_one),
          'Blair', 'selector exposes the authorized Explorer display name');
select is(
  (
    select pg_catalog.count(*)::integer
      from pg_catalog.jsonb_object_keys(
        (select items->0 from selector_page_one)
      ) as keys
  ),
  3,
  'selector item exposes exactly three keys'
);

create temp table selector_page_two as
select * from public.solmind_list_guide_suggested_waypoint_relationships(
  'a3140000-1000-4000-8000-000000000001',
  5,
  (select next_cursor from selector_page_one)
);
select is(pg_catalog.jsonb_array_length((select items from selector_page_two)), 1,
          'terminal page contains the remaining relationship exactly once');
select is((select next_cursor from selector_page_two), null::text,
          'terminal page has no continuation cursor');
select is((select total_count from selector_page_two), 6::bigint,
          'total count remains stable across pages');

select is(
  (
    select pg_catalog.count(distinct item->>'guide_explorer_relationship_id')::integer
      from (
        select pg_catalog.jsonb_array_elements((select items from selector_page_one)) item
        union all
        select pg_catalog.jsonb_array_elements((select items from selector_page_two)) item
      ) combined
  ),
  6,
  'keyset pages have no duplicate or omitted authorized relationship'
);

create temp table selector_unauthorized as
select * from public.solmind_list_guide_suggested_waypoint_relationships(
  'a3140000-1000-4000-8000-000000000101', 5, null
);
select is((select total_count from selector_unauthorized), 0::bigint,
          'non-Guide actor receives an empty result');
select is((select items from selector_unauthorized), '[]'::jsonb,
          'non-Guide actor learns no relationship fact');

select throws_ok(
  $$ select * from public.solmind_list_guide_suggested_waypoint_relationships(
       'a3140000-1000-4000-8000-000000000001', 25, null
     ) $$,
  'P0001',
  'solmind_suggested_waypoint_relationship_selector_invalid_page_size',
  'invalid page size fails closed'
);
select throws_ok(
  $$ select * from public.solmind_list_guide_suggested_waypoint_relationships(
       'a3140000-1000-4000-8000-000000000001', 5, 'not-a-cursor'
     ) $$,
  'P0001',
  'solmind_suggested_waypoint_relationship_selector_invalid_cursor',
  'malformed cursor fails closed'
);
select throws_ok(
  $$
    select * from public.solmind_list_guide_suggested_waypoint_relationships(
      'a3140000-1000-4000-8000-000000000001',
      5,
      pg_catalog.encode(
        pg_catalog.convert_to(
          '2026-08-14 10:00:00+00|a3140000-1500-4000-8000-000000000102|',
          'UTF8'
        ),
        'base64'
      )
    )
  $$,
  'P0001',
  'solmind_suggested_waypoint_relationship_selector_invalid_cursor',
  'cursor with an extra delimiter fails closed'
);

select throws_ok(
  $$
    select * from public.solmind_list_guide_suggested_waypoint_relationships(
      'a3140000-1000-4000-8000-000000000001',
      5,
      pg_catalog.encode(
        pg_catalog.convert_to(
          '2026-08-07 10:00:00+00|a3140000-1500-4000-8000-000000000109',
          'UTF8'
        ),
        'base64'
      )
    )
  $$,
  'P0001',
  'solmind_suggested_waypoint_relationship_selector_invalid_cursor',
  'cursor from another Guide fails closed'
);

select throws_ok(
  $$
    select * from public.solmind_list_guide_suggested_waypoint_relationships(
      'a3140000-1000-4000-8000-000000000001',
      5,
      pg_catalog.encode(
        pg_catalog.convert_to(
          '2026-08-08 10:00:00+00|a3140000-1500-4000-8000-000000000108',
          'UTF8'
        ),
        'base64'
      )
    )
  $$,
  'P0001',
  'solmind_suggested_waypoint_relationship_selector_invalid_cursor',
  'paused relationship cursor fails closed'
);

select is(
  (
    select pg_catalog.count(*)::integer
      from pg_catalog.jsonb_array_elements((select items from selector_page_one)) item
     where item ?| array[
       'practice_id', 'explorer_user_account_id', 'profile_notes',
       'suggestion_count', 'appointment_count', 'explorer_safe_guardrail'
     ]
  ),
  0,
  'selector exposes no roster, contact, Practice, suggestion, or private fields'
);

reset role;

select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.event_type like 'suggested_waypoint_%'
  ),
  0,
  'selector reads create no Suggested Waypoint audit event'
);

select is(
  (
    select pg_catalog.count(*)::integer
      from content.suggested_waypoint owner_row
  ),
  0,
  'selector reads create no Suggested Waypoint content'
);

select * from finish();
rollback;
