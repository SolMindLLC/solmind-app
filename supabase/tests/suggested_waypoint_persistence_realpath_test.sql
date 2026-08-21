-- Local ephemeral database only. All synthetic rows are transaction-scoped.
begin;
select plan(71);

insert into identity.user_account (
  user_account_id,
  display_name,
  username,
  account_status
) values
  ('a3220210-1000-4000-8000-000000000001', 'S02 SW Guide',
   's02_sw_guide', 'active'),
  ('a3220210-1000-4000-8000-000000000002', 'S02 SW Explorer',
   's02_sw_explorer', 'active'),
  ('a3220210-1000-4000-8000-000000000003', 'S02 SW Admin',
   's02_sw_admin', 'active'),
  ('a3220210-1000-4000-8000-000000000004', 'S02 SW Explorer Two',
   's02_sw_explorer_two', 'active'),
  ('a3220210-1000-4000-8000-000000000005', 'S02 SW Guide Two',
   's02_sw_guide_two', 'active');

insert into identity.user_role_assignment (
  user_role_assignment_id,
  user_account_id,
  role_code,
  role_status
) values
  ('a3220210-1050-4000-8000-000000000001',
   'a3220210-1000-4000-8000-000000000001', 'guide', 'active'),
  ('a3220210-1050-4000-8000-000000000002',
   'a3220210-1000-4000-8000-000000000002', 'explorer', 'active'),
  ('a3220210-1050-4000-8000-000000000003',
   'a3220210-1000-4000-8000-000000000003', 'admin', 'active'),
  ('a3220210-1050-4000-8000-000000000004',
   'a3220210-1000-4000-8000-000000000004', 'explorer', 'active'),
  ('a3220210-1050-4000-8000-000000000005',
   'a3220210-1000-4000-8000-000000000005', 'guide', 'active');

insert into core.organization (organization_id, organization_name)
values ('a3220210-1100-4000-8000-000000000001',
        'S02 Suggested Waypoint Organization');
insert into core.practice (practice_id, organization_id, practice_name)
values ('a3220210-1200-4000-8000-000000000001',
        'a3220210-1100-4000-8000-000000000001',
        'S02 Suggested Waypoint Practice');
insert into core.guide_profile (
  guide_profile_id, user_account_id, guide_display_name
) values
  (
    'a3220210-1300-4000-8000-000000000001',
    'a3220210-1000-4000-8000-000000000001',
    'Morgan'
  ),
  (
    'a3220210-1300-4000-8000-000000000002',
    'a3220210-1000-4000-8000-000000000005',
    'Taylor'
  );
insert into core.explorer_profile (
  explorer_profile_id, user_account_id, explorer_display_name, onboarding_status
) values
  (
    'a3220210-1400-4000-8000-000000000001',
    'a3220210-1000-4000-8000-000000000002',
    'Avery',
    'active'
  ),
  (
    'a3220210-1400-4000-8000-000000000002',
    'a3220210-1000-4000-8000-000000000004',
    'Jordan',
    'active'
  );
insert into core.guide_explorer_relationship (
  guide_explorer_relationship_id,
  guide_profile_id,
  explorer_profile_id,
  practice_id,
  relationship_status,
  started_at
) values
  (
    'a3220210-1500-4000-8000-000000000001',
    'a3220210-1300-4000-8000-000000000001',
    'a3220210-1400-4000-8000-000000000001',
    'a3220210-1200-4000-8000-000000000001',
    'active',
    now() - interval '1 day'
  ),
  (
    'a3220210-1500-4000-8000-000000000002',
    'a3220210-1300-4000-8000-000000000001',
    'a3220210-1400-4000-8000-000000000002',
    'a3220210-1200-4000-8000-000000000001',
    'active',
    now() - interval '1 day'
  ),
  (
    'a3220210-1500-4000-8000-000000000003',
    'a3220210-1300-4000-8000-000000000002',
    'a3220210-1400-4000-8000-000000000002',
    'a3220210-1200-4000-8000-000000000001',
    'paused',
    now() - interval '2 days'
  );

set local role service_role;

create temp table s02_sw_explorer_legitimate_empty as
select *
  from public.solmind_list_explorer_suggested_waypoints(
    'a3220210-1000-4000-8000-000000000004', 5, null
  );
select is(
  (select total_count from s02_sw_explorer_legitimate_empty),
  0::bigint,
  'one authorized active relationship with no delivery remains a successful empty inbox'
);

reset role;
update core.guide_explorer_relationship
   set relationship_status = 'paused'
 where guide_explorer_relationship_id =
       'a3220210-1500-4000-8000-000000000002';
set local role service_role;
select throws_ok(
  $$
    select *
      from public.solmind_list_explorer_suggested_waypoints(
        'a3220210-1000-4000-8000-000000000004', 5, null
      )
  $$,
  'P0001',
  'solmind_suggested_waypoint_explorer_relationship_unavailable',
  'a paused-only relationship is unavailable rather than an empty inbox'
);

reset role;
update core.guide_explorer_relationship
   set relationship_status = 'ended', ended_at = pg_catalog.now()
 where guide_explorer_relationship_id =
       'a3220210-1500-4000-8000-000000000002';
set local role service_role;
select throws_ok(
  $$
    select *
      from public.solmind_list_explorer_suggested_waypoints(
        'a3220210-1000-4000-8000-000000000004', 5, null
      )
  $$,
  'P0001',
  'solmind_suggested_waypoint_explorer_relationship_unavailable',
  'an ended-only relationship is unavailable rather than an empty inbox'
);

reset role;
update core.guide_explorer_relationship
   set relationship_status = 'transferred'
 where guide_explorer_relationship_id =
       'a3220210-1500-4000-8000-000000000002';
set local role service_role;
select throws_ok(
  $$
    select *
      from public.solmind_list_explorer_suggested_waypoints(
        'a3220210-1000-4000-8000-000000000004', 5, null
      )
  $$,
  'P0001',
  'solmind_suggested_waypoint_explorer_relationship_unavailable',
  'a transferred-only relationship is unavailable rather than an empty inbox'
);

reset role;
update core.guide_explorer_relationship
   set relationship_status = 'active', ended_at = null
 where guide_explorer_relationship_id =
       'a3220210-1500-4000-8000-000000000002';
update core.guide_explorer_relationship
   set relationship_status = 'active'
 where guide_explorer_relationship_id =
       'a3220210-1500-4000-8000-000000000003';
set local role service_role;
select throws_ok(
  $$
    select *
      from public.solmind_list_explorer_suggested_waypoints(
        'a3220210-1000-4000-8000-000000000004', 5, null
      )
  $$,
  'P0001',
  'solmind_suggested_waypoint_explorer_relationship_unavailable',
  'multiple active relationships are unavailable without revealing their count'
);
reset role;
update core.guide_explorer_relationship
   set relationship_status = 'paused'
 where guide_explorer_relationship_id =
       'a3220210-1500-4000-8000-000000000003';
set local role service_role;

select throws_ok(
  $$
    select *
      from public.solmind_list_explorer_suggested_waypoints(
        'a3220210-1000-4000-8000-000000000003', 5, null
      )
  $$,
  'P0001',
  'solmind_suggested_waypoint_explorer_relationship_unavailable',
  'an actor with no Explorer relationship receives the same value-free denial'
);

reset role;
update identity.user_account
   set account_status = 'suspended'
 where user_account_id = 'a3220210-1000-4000-8000-000000000004';
set local role service_role;
select throws_ok(
  $$
    select *
      from public.solmind_list_explorer_suggested_waypoints(
        'a3220210-1000-4000-8000-000000000004', 5, null
      )
  $$,
  'P0001',
  'solmind_suggested_waypoint_explorer_relationship_unavailable',
  'derived Explorer authorization failure receives the same value-free denial'
);
reset role;
update identity.user_account
   set account_status = 'active'
 where user_account_id = 'a3220210-1000-4000-8000-000000000004';
set local role service_role;

select throws_ok(
  $$ select * from content.suggested_waypoint $$,
  '42501',
  null,
  'service_role cannot read stable owner directly'
);
select throws_ok(
  $$ select * from content.suggested_waypoint_guide_draft $$,
  '42501',
  null,
  'service_role cannot read Guide draft owner directly'
);
select throws_ok(
  $$
    select *
      from public.solmind_save_suggested_waypoint_draft(
        'a3220210-1000-4000-8000-000000000001',
        'a3220210-2000-4000-8000-000000000099',
        'a3220210-1500-4000-8000-000000000001',
        'a3220210-3000-4000-8000-000000000099',
        0,
        E'Bad\u0001 text',
        'Why',
        '["Signal"]'::jsonb
      )
  $$,
  'P0001',
  'solmind_suggested_waypoint_invalid_content',
  'C0 content fails before storage'
);
select throws_ok(
  $$
    select *
      from public.solmind_save_suggested_waypoint_draft(
        'a3220210-1000-4000-8000-000000000001',
        'a3220210-2000-4000-8000-000000000091',
        'a3220210-1500-4000-8000-000000000001',
        'a3220210-3000-4000-8000-000000000091',
        0,
        E'Line one\nLine two',
        'Why',
        '["Signal"]'::jsonb
      )
  $$,
  'P0001',
  'solmind_suggested_waypoint_invalid_content',
  'save-draft rejects an LF destination before storage'
);
select throws_ok(
  $$
    select *
      from public.solmind_save_suggested_waypoint_draft(
        'a3220210-1000-4000-8000-000000000001',
        'a3220210-2000-4000-8000-000000000092',
        'a3220210-1500-4000-8000-000000000001',
        'a3220210-3000-4000-8000-000000000092',
        0,
        'Line one' || pg_catalog.chr(8232) || 'Line two',
        'Why',
        '["Signal"]'::jsonb
      )
  $$,
  'P0001',
  'solmind_suggested_waypoint_invalid_content',
  'save-draft rejects a Unicode line-separator destination'
);
select throws_ok(
  $$
    select *
      from public.solmind_save_suggested_waypoint_draft(
        'a3220210-1000-4000-8000-000000000001',
        'a3220210-2000-4000-8000-000000000093',
        'a3220210-1500-4000-8000-000000000001',
        'a3220210-3000-4000-8000-000000000093',
        0,
        'Line one' || pg_catalog.chr(8233) || 'Line two',
        'Why',
        '["Signal"]'::jsonb
      )
  $$,
  'P0001',
  'solmind_suggested_waypoint_invalid_content',
  'save-draft rejects a Unicode paragraph-separator destination'
);

create temp table s02_sw_save as
select *
  from public.solmind_save_suggested_waypoint_draft(
    'a3220210-1000-4000-8000-000000000001',
    'a3220210-2000-4000-8000-000000000001',
    'a3220210-1500-4000-8000-000000000001',
    'a3220210-3000-4000-8000-000000000001',
    0,
    '  Protect one evening each week for recovery  ',
    E'Create room for recovery.\r\nKeep the choice with Avery.',
    '["One evening stays unscheduled","No extra pressure elsewhere"]'::jsonb
  );
select is((select outcome_code from s02_sw_save), 'applied',
          'assigned Guide creates a bounded draft');
select is((select authoring_revision from s02_sw_save), 1::bigint,
          'create returns authoring revision one');

create temp table s02_sw_replay as
select *
  from public.solmind_save_suggested_waypoint_draft(
    'a3220210-1000-4000-8000-000000000001',
    'a3220210-2000-4000-8000-000000000001',
    'a3220210-1500-4000-8000-000000000001',
    'a3220210-3000-4000-8000-000000000001',
    0,
    'Protect one evening each week for recovery',
    E'Create room for recovery.\nKeep the choice with Avery.',
    '["One evening stays unscheduled","No extra pressure elsewhere"]'::jsonb
  );
select is((select outcome_code from s02_sw_replay), 'idempotent',
          'exact normalized replay is idempotent');
select is((select committed_at from s02_sw_replay),
          (select committed_at from s02_sw_save),
          'exact replay returns original committed time');

create temp table s02_sw_foreign_actor_replay as
select *
  from public.solmind_save_suggested_waypoint_draft(
    'a3220210-1000-4000-8000-000000000002',
    'a3220210-2000-4000-8000-000000000001',
    'a3220210-1500-4000-8000-000000000001',
    'a3220210-3000-4000-8000-000000000001',
    0,
    'Protect one evening each week for recovery',
    E'Create room for recovery.\nKeep the choice with Avery.',
    '["One evening stays unscheduled","No extra pressure elsewhere"]'::jsonb
  );
select is((select outcome_code from s02_sw_foreign_actor_replay),
          'relationship_unavailable',
          'foreign actor replay receives the same opaque denial');
select is((select suggested_waypoint_id from s02_sw_foreign_actor_replay),
          null::uuid,
          'foreign actor replay reveals no suggestion identity');

create temp table s02_sw_cross_relationship_probe as
select *
  from public.solmind_save_suggested_waypoint_draft(
    'a3220210-1000-4000-8000-000000000001',
    'a3220210-2000-4000-8000-000000000004',
    'a3220210-1500-4000-8000-000000000002',
    'a3220210-3000-4000-8000-000000000001',
    0,
    'Opaque cross-relationship target',
    'Must not reveal the existing relationship state',
    '["No disclosure"]'::jsonb
  );
select is((select outcome_code from s02_sw_cross_relationship_probe),
          'relationship_unavailable',
          'authorized Guide cannot probe a suggestion through another relationship');
select is((select suggested_waypoint_id from s02_sw_cross_relationship_probe),
          null::uuid,
          'cross-relationship denial reveals no suggestion identity');

create temp table s02_sw_conflict as
select *
  from public.solmind_save_suggested_waypoint_draft(
    'a3220210-1000-4000-8000-000000000001',
    'a3220210-2000-4000-8000-000000000001',
    'a3220210-1500-4000-8000-000000000001',
    'a3220210-3000-4000-8000-000000000001',
    0,
    'Protect one evening each week for recovery',
    'Changed payload',
    '["One evening stays unscheduled"]'::jsonb
  );
select is((select outcome_code from s02_sw_conflict), 'operation_conflict',
          'changed payload under the same operation identity conflicts');

create temp table s02_sw_wrong_guide as
select *
  from public.solmind_save_suggested_waypoint_draft(
    'a3220210-1000-4000-8000-000000000002',
    'a3220210-2000-4000-8000-000000000002',
    'a3220210-1500-4000-8000-000000000001',
    'a3220210-3000-4000-8000-000000000002',
    0,
    'Opaque target',
    'Must not save',
    '["No write"]'::jsonb
  );
select is((select outcome_code from s02_sw_wrong_guide),
          'relationship_unavailable',
          'wrong-role actor receives opaque relationship unavailable');
select is((select suggested_waypoint_id from s02_sw_wrong_guide), null::uuid,
          'opaque denial reveals no suggestion identity');

create temp table s02_sw_guide_draft_detail as
select *
  from public.solmind_get_guide_suggested_waypoint(
    'a3220210-1000-4000-8000-000000000001',
    'a3220210-1500-4000-8000-000000000001',
    'a3220210-3000-4000-8000-000000000001'
  );
select is((select authoring_mode from s02_sw_guide_draft_detail), 'draft',
          'Guide detail projects the initial draft mode');
select is((select draft_or_pending_destination from s02_sw_guide_draft_detail),
          'Protect one evening each week for recovery',
          'Guide detail returns normalized Guide-owned draft content');
reset role;
select throws_ok(
  $$
    update content.suggested_waypoint_guide_draft
       set destination = E'Bypass\nattempt'
     where suggested_waypoint_id =
           'a3220210-3000-4000-8000-000000000001'
  $$,
  'P0001',
  'solmind_suggested_waypoint_invalid_content',
  'content trigger rejects a privileged multiline destination bypass'
);
set local role service_role;

create temp table s02_sw_pagination_saves as
select *
  from public.solmind_save_suggested_waypoint_draft(
    'a3220210-1000-4000-8000-000000000001',
    'a3220210-2000-4000-8000-000000000401',
    'a3220210-1500-4000-8000-000000000001',
    'a3220210-3000-4000-8000-000000000301',
    0, 'Pagination draft one', 'Tie-safe cursor proof', '["One"]'::jsonb
  )
union all
select *
  from public.solmind_save_suggested_waypoint_draft(
    'a3220210-1000-4000-8000-000000000001',
    'a3220210-2000-4000-8000-000000000402',
    'a3220210-1500-4000-8000-000000000001',
    'a3220210-3000-4000-8000-000000000302',
    0, 'Pagination draft two', 'Tie-safe cursor proof', '["Two"]'::jsonb
  )
union all
select *
  from public.solmind_save_suggested_waypoint_draft(
    'a3220210-1000-4000-8000-000000000001',
    'a3220210-2000-4000-8000-000000000403',
    'a3220210-1500-4000-8000-000000000001',
    'a3220210-3000-4000-8000-000000000303',
    0, 'Pagination draft three', 'Tie-safe cursor proof', '["Three"]'::jsonb
  )
union all
select *
  from public.solmind_save_suggested_waypoint_draft(
    'a3220210-1000-4000-8000-000000000001',
    'a3220210-2000-4000-8000-000000000404',
    'a3220210-1500-4000-8000-000000000001',
    'a3220210-3000-4000-8000-000000000304',
    0, 'Pagination draft four', 'Tie-safe cursor proof', '["Four"]'::jsonb
  )
union all
select *
  from public.solmind_save_suggested_waypoint_draft(
    'a3220210-1000-4000-8000-000000000001',
    'a3220210-2000-4000-8000-000000000405',
    'a3220210-1500-4000-8000-000000000001',
    'a3220210-3000-4000-8000-000000000305',
    0, 'Pagination draft five', 'Tie-safe cursor proof', '["Five"]'::jsonb
  );
select is((select pg_catalog.count(*)::integer
             from s02_sw_pagination_saves
            where outcome_code = 'applied'),
          5,
          'five same-timestamp Guide drafts establish a pagination boundary');

create temp table s02_sw_guide_page_one as
select *
  from public.solmind_list_guide_suggested_waypoints(
    'a3220210-1000-4000-8000-000000000001',
    'a3220210-1500-4000-8000-000000000001', 5, null
  );
select is(pg_catalog.jsonb_array_length((select items from s02_sw_guide_page_one)),
          5,
          'Guide first page honors the five-item bound');
select is((select total_count from s02_sw_guide_page_one), 6::bigint,
          'Guide pagination reports the full relationship-scoped count');
select isnt((select next_cursor from s02_sw_guide_page_one), null::text,
            'Guide first page returns an opaque continuation cursor');

create temp table s02_sw_guide_page_two as
select *
  from public.solmind_list_guide_suggested_waypoints(
    'a3220210-1000-4000-8000-000000000001',
    'a3220210-1500-4000-8000-000000000001',
    5,
    (select next_cursor from s02_sw_guide_page_one)
  );
select is(pg_catalog.jsonb_array_length((select items from s02_sw_guide_page_two)),
          1,
          'Guide second page returns the remaining equal-timestamp item');
select is((select total_count from s02_sw_guide_page_two), 6::bigint,
          'Guide second page preserves the full authorized count');
select is((select next_cursor from s02_sw_guide_page_two), null::text,
          'Guide terminal page has no continuation cursor');
select is(
  (
    select pg_catalog.count(distinct item ->> 'suggested_waypoint_id')::integer
      from (
        select pg_catalog.jsonb_array_elements(items) as item
          from s02_sw_guide_page_one
        union all
        select pg_catalog.jsonb_array_elements(items) as item
          from s02_sw_guide_page_two
      ) combined
  ),
  6,
  'Guide cursor pages contain every item exactly once'
);
select throws_ok(
  $$
    select *
      from public.solmind_list_guide_suggested_waypoints(
        'a3220210-1000-4000-8000-000000000001',
        'a3220210-1500-4000-8000-000000000001', 5, 'not-a-cursor'
      )
  $$,
  'P0001',
  'solmind_suggested_waypoint_invalid_cursor',
  'Guide malformed cursor fails closed'
);
select throws_ok(
  $$
    select *
      from public.solmind_list_explorer_suggested_waypoints(
        'a3220210-1000-4000-8000-000000000002', 7, null
      )
  $$,
  'P0001',
  'solmind_suggested_waypoint_invalid_page_size',
  'Explorer list rejects an unsupported page size'
);

create temp table s02_sw_schedule_one as
select *
  from public.solmind_schedule_suggested_waypoint_send(
    'a3220210-1000-4000-8000-000000000001',
    'a3220210-2100-4000-8000-000000000001',
    'a3220210-3000-4000-8000-000000000001',
    'a3220210-3100-4000-8000-000000000001',
    1
  );
select is((select outcome_code from s02_sw_schedule_one), 'applied',
          'Guide schedules the exact draft');
select is((select effective_seconds from s02_sw_schedule_one), 300,
          'schedule freezes the protected 300-second default');
select is((select policy_version from s02_sw_schedule_one), 1::bigint,
          'schedule freezes the policy version');

create temp table s02_sw_early_delivery as
select *
  from public.solmind_deliver_suggested_waypoint(
    'a3220210-2300-4000-8000-000000000099',
    'a3220210-3000-4000-8000-000000000001',
    'a3220210-3100-4000-8000-000000000001'
  );
select is((select outcome_code from s02_sw_early_delivery), 'too_late',
          'worker cannot deliver before the authoritative deadline');

create temp table s02_sw_schedule_while_pending as
select *
  from public.solmind_schedule_suggested_waypoint_send(
    'a3220210-1000-4000-8000-000000000001',
    'a3220210-2100-4000-8000-000000000099',
    'a3220210-3000-4000-8000-000000000001',
    'a3220210-3100-4000-8000-000000000099',
    1
  );
select is((select outcome_code from s02_sw_schedule_while_pending),
          'invalid_transition',
          'Guide cannot schedule a second version while one is pending');

create temp table s02_sw_explorer_before_delivery as
select *
  from public.solmind_list_explorer_suggested_waypoints(
    'a3220210-1000-4000-8000-000000000002', 5, null
  );
select is((select total_count from s02_sw_explorer_before_delivery), 0::bigint,
          'Explorer sees nothing during Guide grace');

create temp table s02_sw_pull_back as
select *
  from public.solmind_pull_back_suggested_waypoint(
    'a3220210-1000-4000-8000-000000000001',
    'a3220210-2200-4000-8000-000000000001',
    'a3220210-3000-4000-8000-000000000001',
    1,
    'a3220210-3100-4000-8000-000000000001'
  );
select is((select outcome_code from s02_sw_pull_back), 'applied',
          'Guide Pull Back applies before the authoritative deadline');
select is((select authoring_revision from s02_sw_pull_back), 2::bigint,
          'Pull Back restores bytes into a new draft revision');

create temp table s02_sw_save_two as
select *
  from public.solmind_save_suggested_waypoint_draft(
    'a3220210-1000-4000-8000-000000000001',
    'a3220210-2000-4000-8000-000000000003',
    'a3220210-1500-4000-8000-000000000001',
    'a3220210-3000-4000-8000-000000000001',
    2,
    'Protect one evening each week for recovery',
    'Create room for rest while Avery keeps the choice.',
    '["One evening stays unscheduled","No extra pressure elsewhere"]'::jsonb
  );
select is((select outcome_code from s02_sw_save_two), 'applied',
          'Guide revises the restored draft');
select is((select authoring_revision from s02_sw_save_two), 3::bigint,
          'atomic draft revision advances exactly once');

create temp table s02_sw_schedule_two as
select *
  from public.solmind_schedule_suggested_waypoint_send(
    'a3220210-1000-4000-8000-000000000001',
    'a3220210-2100-4000-8000-000000000002',
    'a3220210-3000-4000-8000-000000000001',
    'a3220210-3100-4000-8000-000000000002',
    3
  );
select is((select outcome_code from s02_sw_schedule_two), 'applied',
          'revised draft can be scheduled once');

reset role;
update content.suggested_waypoint_pending_outbound
   set scheduled_at = scheduled_at - interval '10 minutes',
       deadline_at = deadline_at - interval '10 minutes'
 where suggested_waypoint_id = 'a3220210-3000-4000-8000-000000000001';
set local role service_role;

create temp table s02_sw_delivery as
select *
  from public.solmind_deliver_suggested_waypoint(
    'a3220210-2300-4000-8000-000000000001',
    'a3220210-3000-4000-8000-000000000001',
    'a3220210-3100-4000-8000-000000000002'
  );
select is((select outcome_code from s02_sw_delivery), 'applied',
          'worker delivers at or after the authoritative deadline');
select is((select delivered_version_id from s02_sw_delivery),
          'a3220210-3100-4000-8000-000000000002'::uuid,
          'delivery returns the exact immutable version identity');

create temp table s02_sw_explorer_list as
select *
  from public.solmind_list_explorer_suggested_waypoints(
    'a3220210-1000-4000-8000-000000000002', 5, null
  );
select is((select total_count from s02_sw_explorer_list), 1::bigint,
          'Explorer list receives the committed delivered suggestion');
select is((select items -> 0 ->> 'read' from s02_sw_explorer_list), 'false',
          'Explorer list initially reports private unread state');
select ok(not ((select items -> 0 from s02_sw_explorer_list) ? 'policy_key'),
          'Explorer envelope exposes no pending-policy top-level field');

create temp table s02_sw_read as
select *
  from public.solmind_mark_suggested_waypoint_read(
    'a3220210-1000-4000-8000-000000000002',
    'a3220210-2400-4000-8000-000000000001',
    'a3220210-3000-4000-8000-000000000001',
    'a3220210-3100-4000-8000-000000000002'
  );
select is((select outcome_code from s02_sw_read), 'applied',
          'Explorer records private read state');

create temp table s02_sw_guide_after_read as
select *
  from public.solmind_list_guide_suggested_waypoints(
    'a3220210-1000-4000-8000-000000000001',
    'a3220210-1500-4000-8000-000000000001', 5, null
  );
select ok(not ((select items -> 0 from s02_sw_guide_after_read) ? 'read'),
          'Guide projection structurally omits Explorer read state');

create temp table s02_sw_acknowledge as
select *
  from public.solmind_acknowledge_suggested_waypoint_receipt(
    'a3220210-1000-4000-8000-000000000002',
    'a3220210-2500-4000-8000-000000000001',
    'a3220210-3000-4000-8000-000000000001',
    'a3220210-3100-4000-8000-000000000002'
  );
select is((select outcome_code from s02_sw_acknowledge), 'applied',
          'Explorer explicitly acknowledges the exact delivered version');
select is((select acknowledged_version_id from s02_sw_acknowledge),
          'a3220210-3100-4000-8000-000000000002'::uuid,
          'receipt is bound to the exact current version');

create temp table s02_sw_explorer_detail as
select *
  from public.solmind_get_explorer_suggested_waypoint(
    'a3220210-1000-4000-8000-000000000002',
    'a3220210-3000-4000-8000-000000000001'
  );
select is((select read from s02_sw_explorer_detail), true,
          'Explorer detail returns own private read state');
select is((select receipt_acknowledged from s02_sw_explorer_detail), true,
          'Explorer detail returns own explicit receipt state');

create temp table s02_sw_guide_after_ack as
select *
  from public.solmind_get_guide_suggested_waypoint(
    'a3220210-1000-4000-8000-000000000001',
    'a3220210-1500-4000-8000-000000000001',
    'a3220210-3000-4000-8000-000000000001'
  );
select is((select acknowledged_version_id from s02_sw_guide_after_ack),
          'a3220210-3100-4000-8000-000000000002'::uuid,
          'Guide sees the deliberately shared exact-version receipt');
select isnt((select acknowledged_at from s02_sw_guide_after_ack),
            null::timestamptz,
            'Guide sees the dated acknowledgement');

create temp table s02_sw_admin_state as
select *
  from public.solmind_get_admin_suggested_waypoint_operational_state(
    'a3220210-1000-4000-8000-000000000003',
    'a3220210-3000-4000-8000-000000000001'
  );
select is((select lifecycle_category from s02_sw_admin_state), 'delivered',
          'routine Admin sees only operational lifecycle state');
select is((select outcome_code from s02_sw_admin_state), 'applied',
          'routine Admin sees bounded operational outcome');

reset role;
create function content.s02_sw_force_audit_failure_test()
returns trigger
language plpgsql
as $$
begin
  if new.event_type = 'suggested_waypoint_draft_saved' then
    raise exception 's02_sw_injected_audit_failure';
  end if;
  return new;
end;
$$;
create trigger s02_sw_force_audit_failure
before insert on audit.audit_event
for each row execute function content.s02_sw_force_audit_failure_test();

set local role service_role;
select throws_ok(
  $$
    select *
      from public.solmind_save_suggested_waypoint_draft(
        'a3220210-1000-4000-8000-000000000001',
        'a3220210-2000-4000-8000-000000000499',
        'a3220210-1500-4000-8000-000000000001',
        'a3220210-3000-4000-8000-000000000399',
        0,
        'Audit failure probe',
        'This write must be fully atomic',
        '["No partial state"]'::jsonb
      )
  $$,
  'P0001',
  's02_sw_injected_audit_failure',
  'audit failure aborts the entire Suggested Waypoint command'
);
reset role;
drop trigger s02_sw_force_audit_failure on audit.audit_event;
drop function content.s02_sw_force_audit_failure_test();

select is(
  (
    select pg_catalog.count(*)::integer
      from content.suggested_waypoint owner_row
     where owner_row.suggested_waypoint_id =
           'a3220210-3000-4000-8000-000000000399'
  ),
  0,
  'audit failure leaves no stable owner row'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from content.suggested_waypoint_guide_draft draft
     where draft.suggested_waypoint_id =
           'a3220210-3000-4000-8000-000000000399'
  ),
  0,
  'audit failure leaves no Guide draft content'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from content.suggested_waypoint_operation_result result
     where result.operation_id = 'a3220210-2000-4000-8000-000000000499'
  ),
  0,
  'audit failure leaves no replay result'
);

select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.target_entity_id =
           'a3220210-3000-4000-8000-000000000001'
       and event.event_type like 'suggested_waypoint_%'
  ),
  7,
  'seven applied shared lifecycle transitions write exactly seven audit facts'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.target_entity_id =
           'a3220210-3000-4000-8000-000000000001'
       and (
         event.metadata::text like '%Protect one evening%'
         or event.metadata::text like '%Create room for rest%'
       )
  ),
  0,
  'audit metadata contains no suggestion content'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event event
     where event.target_entity_id =
           'a3220210-3000-4000-8000-000000000001'
       and event.event_type = 'suggested_waypoint_read'
  ),
  0,
  'Explorer-private read state creates no audit event'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from content.suggested_waypoint_operation_result result
     where result.suggested_waypoint_id =
           'a3220210-3000-4000-8000-000000000001'
  ),
  8,
  'only eight applied operations persist protected replay proof'
);

select * from finish();
rollback;
