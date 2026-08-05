\set ON_ERROR_STOP on

-- PRJ01_R-WS09-WI021-S02 dedicated local development/test fixture.
--
-- Purpose:
--   - create exactly one obviously synthetic Guide;
--   - create exactly one obviously synthetic Explorer;
--   - create exactly one active Guide-Explorer relationship; and
--   - attach bounded, Explorer-safe Virtual Guide behavior instructions.
--
-- Local development/test use only. This file is intentionally outside
-- supabase/migrations and is not referenced by supabase/seed.sql.
--
-- Run as the local PostgreSQL owner after the repository migrations have
-- established the banked schema. ON_ERROR_STOP plus the transaction boundary
-- makes setup fail closed: any error leaves none of this fixture committed.

begin;

do $fixture_preflight$
declare
  v_collision_count integer;
begin
  if pg_catalog.to_regclass('identity.user_account') is null
     or pg_catalog.to_regclass('identity.user_role_assignment') is null
     or pg_catalog.to_regclass('core.organization') is null
     or pg_catalog.to_regclass('core.practice') is null
     or pg_catalog.to_regclass('core.guide_profile') is null
     or pg_catalog.to_regclass('core.explorer_profile') is null
     or pg_catalog.to_regclass('core.practice_guide') is null
     or pg_catalog.to_regclass('core.guide_explorer_relationship') is null then
    raise exception
      'WI021-S02 fixture requires the already-banked identity/core schema';
  end if;

  if not exists (
    select 1
      from identity.role_type
     where role_code = 'guide'
  ) or not exists (
    select 1
      from identity.role_type
     where role_code = 'explorer'
  ) then
    raise exception
      'WI021-S02 fixture requires the banked guide and explorer role types';
  end if;

  select pg_catalog.count(*)::integer
    into v_collision_count
    from (
      select 1
        from identity.user_account
       where user_account_id in (
               '02102000-0000-4000-8000-000000000001',
               '02102000-0000-4000-8000-000000000002'
             )
          or pg_catalog.lower(username) in (
               'wi021.s02.guide@synthetic.invalid',
               'wi021.s02.explorer@synthetic.invalid'
             )
          or metadata ->> 'fixture_id' = 'PRJ01_R-WS09-WI021-S02'
      union all
      select 1
        from identity.user_role_assignment
       where user_role_assignment_id in (
               '02102000-1000-4000-8000-000000000001',
               '02102000-1000-4000-8000-000000000002'
             )
          or metadata ->> 'fixture_id' = 'PRJ01_R-WS09-WI021-S02'
      union all
      select 1
        from core.organization
       where organization_id = '02102000-2000-4000-8000-000000000001'
          or metadata ->> 'fixture_id' = 'PRJ01_R-WS09-WI021-S02'
      union all
      select 1
        from core.practice
       where practice_id = '02102000-2100-4000-8000-000000000001'
          or metadata ->> 'fixture_id' = 'PRJ01_R-WS09-WI021-S02'
      union all
      select 1
        from core.guide_profile
       where guide_profile_id = '02102000-3000-4000-8000-000000000001'
          or metadata ->> 'fixture_id' = 'PRJ01_R-WS09-WI021-S02'
      union all
      select 1
        from core.explorer_profile
       where explorer_profile_id = '02102000-3000-4000-8000-000000000002'
          or metadata ->> 'fixture_id' = 'PRJ01_R-WS09-WI021-S02'
      union all
      select 1
        from core.practice_guide
       where practice_guide_id = '02102000-4000-4000-8000-000000000001'
          or metadata ->> 'fixture_id' = 'PRJ01_R-WS09-WI021-S02'
      union all
      select 1
        from core.guide_explorer_relationship
       where guide_explorer_relationship_id =
             '02102000-5000-4000-8000-000000000001'
          or metadata ->> 'fixture_id' = 'PRJ01_R-WS09-WI021-S02'
    ) collision;

  if v_collision_count <> 0 then
    raise exception
      'WI021-S02 fixture preflight found % deterministic-ID, username, or fixture-tag collision(s); run the reviewed cleanup and inspect the result before retrying',
      v_collision_count;
  end if;
end;
$fixture_preflight$;

insert into identity.user_account (
  user_account_id,
  display_name,
  username,
  account_status,
  created_at,
  metadata
) values
  (
    '02102000-0000-4000-8000-000000000001',
    'SYNTHETIC WI021 S02 Guide',
    'wi021.s02.guide@synthetic.invalid',
    'active',
    '2026-01-01 00:00:00+00',
    '{"fixture_id":"PRJ01_R-WS09-WI021-S02","fixture_scope":"local_development_test_only","synthetic":true}'::jsonb
  ),
  (
    '02102000-0000-4000-8000-000000000002',
    'SYNTHETIC WI021 S02 Explorer',
    'wi021.s02.explorer@synthetic.invalid',
    'active',
    '2026-01-01 00:00:00+00',
    '{"fixture_id":"PRJ01_R-WS09-WI021-S02","fixture_scope":"local_development_test_only","synthetic":true}'::jsonb
  );

insert into identity.user_role_assignment (
  user_role_assignment_id,
  user_account_id,
  role_code,
  role_status,
  granted_by_role_context,
  granted_at,
  metadata
) values
  (
    '02102000-1000-4000-8000-000000000001',
    '02102000-0000-4000-8000-000000000001',
    'guide',
    'active',
    'system',
    '2026-01-01 00:00:00+00',
    '{"fixture_id":"PRJ01_R-WS09-WI021-S02","fixture_scope":"local_development_test_only","synthetic":true}'::jsonb
  ),
  (
    '02102000-1000-4000-8000-000000000002',
    '02102000-0000-4000-8000-000000000002',
    'explorer',
    'active',
    'system',
    '2026-01-01 00:00:00+00',
    '{"fixture_id":"PRJ01_R-WS09-WI021-S02","fixture_scope":"local_development_test_only","synthetic":true}'::jsonb
  );

insert into core.organization (
  organization_id,
  organization_name,
  description,
  is_self,
  approval_status,
  status,
  created_at,
  created_by_user_account_id,
  metadata
) values (
  '02102000-2000-4000-8000-000000000001',
  'SYNTHETIC WI021 S02 Local Organization',
  'Local development/test fixture only.',
  true,
  'draft',
  'active',
  '2026-01-01 00:00:00+00',
  '02102000-0000-4000-8000-000000000001',
  '{"fixture_id":"PRJ01_R-WS09-WI021-S02","fixture_scope":"local_development_test_only","synthetic":true}'::jsonb
);

insert into core.practice (
  practice_id,
  organization_id,
  practice_name,
  description,
  is_self,
  same_as_organization,
  approval_status,
  status,
  created_at,
  created_by_user_account_id,
  metadata
) values (
  '02102000-2100-4000-8000-000000000001',
  '02102000-2000-4000-8000-000000000001',
  'SYNTHETIC WI021 S02 Local Practice',
  'Local development/test fixture only.',
  true,
  true,
  'draft',
  'active',
  '2026-01-01 00:00:00+00',
  '02102000-0000-4000-8000-000000000001',
  '{"fixture_id":"PRJ01_R-WS09-WI021-S02","fixture_scope":"local_development_test_only","synthetic":true}'::jsonb
);

insert into core.guide_profile (
  guide_profile_id,
  user_account_id,
  guide_display_name,
  bio,
  style_notes,
  setup_status,
  solmind_virtual_guide_name,
  created_at,
  status,
  metadata
) values (
  '02102000-3000-4000-8000-000000000001',
  '02102000-0000-4000-8000-000000000001',
  'SYNTHETIC WI021 S02 Guide',
  'Obviously synthetic local fixture Guide. Not a real person.',
  'Local fixture only. No clinical, crisis-response, or real-user authority.',
  'profile_pending',
  'SYNTHETIC SolMind Virtual Guide',
  '2026-01-01 00:00:00+00',
  'active',
  '{"fixture_id":"PRJ01_R-WS09-WI021-S02","fixture_scope":"local_development_test_only","synthetic":true}'::jsonb
);

insert into core.explorer_profile (
  explorer_profile_id,
  user_account_id,
  explorer_display_name,
  onboarding_status,
  preferred_contact_channel,
  profile_notes,
  created_at,
  status,
  metadata
) values (
  '02102000-3000-4000-8000-000000000002',
  '02102000-0000-4000-8000-000000000002',
  'SYNTHETIC WI021 S02 Explorer',
  'intake_pending',
  'in_app',
  'Obviously synthetic local fixture Explorer. Not a real person.',
  '2026-01-01 00:00:00+00',
  'active',
  '{"fixture_id":"PRJ01_R-WS09-WI021-S02","fixture_scope":"local_development_test_only","synthetic":true}'::jsonb
);

insert into core.practice_guide (
  practice_guide_id,
  practice_id,
  guide_profile_id,
  relationship_status,
  is_primary_for_mvp0,
  created_at,
  created_by_user_account_id,
  metadata
) values (
  '02102000-4000-4000-8000-000000000001',
  '02102000-2100-4000-8000-000000000001',
  '02102000-3000-4000-8000-000000000001',
  'active',
  true,
  '2026-01-01 00:00:00+00',
  '02102000-0000-4000-8000-000000000001',
  '{"fixture_id":"PRJ01_R-WS09-WI021-S02","fixture_scope":"local_development_test_only","synthetic":true}'::jsonb
);

insert into core.guide_explorer_relationship (
  guide_explorer_relationship_id,
  guide_profile_id,
  explorer_profile_id,
  practice_id,
  relationship_status,
  started_at,
  explorer_safe_guardrail,
  explorer_safe_guardrail_updated_at,
  explorer_safe_guardrail_updated_by_user_account_id,
  created_at,
  created_by_user_account_id,
  metadata
) values (
  '02102000-5000-4000-8000-000000000001',
  '02102000-3000-4000-8000-000000000001',
  '02102000-3000-4000-8000-000000000002',
  '02102000-2100-4000-8000-000000000001',
  'active',
  '2026-01-01 00:00:00+00',
  'LOCAL SYNTHETIC FIXTURE ONLY. Be warm, reflective, and non-directive. Ask one question at a time. Do not diagnose, prescribe, claim human monitoring, or imply emergency response. Encourage real-world help for urgent concerns.',
  '2026-01-01 00:00:00+00',
  '02102000-0000-4000-8000-000000000001',
  '2026-01-01 00:00:00+00',
  '02102000-0000-4000-8000-000000000001',
  '{"fixture_id":"PRJ01_R-WS09-WI021-S02","fixture_scope":"local_development_test_only","synthetic":true}'::jsonb
);

do $fixture_post_setup_validation$
declare
  v_fixture_id constant text := 'PRJ01_R-WS09-WI021-S02';
  v_expected_guardrail constant text :=
    'LOCAL SYNTHETIC FIXTURE ONLY. Be warm, reflective, and non-directive. Ask one question at a time. Do not diagnose, prescribe, claim human monitoring, or imply emergency response. Encourage real-world help for urgent concerns.';
begin
  if (
    select pg_catalog.count(*)
      from identity.user_account
     where metadata ->> 'fixture_id' = v_fixture_id
  ) <> 2 then
    raise exception 'WI021-S02 setup validation expected exactly two fixture accounts';
  end if;

  if (
    select pg_catalog.count(*)
      from identity.user_account
     where metadata ->> 'fixture_id' = v_fixture_id
       and display_name like 'SYNTHETIC%'
       and username like '%@synthetic.invalid'
       and account_status = 'active'
  ) <> 2 then
    raise exception 'WI021-S02 setup validation rejected ambiguous or inactive fixture identities';
  end if;

  if (
    select pg_catalog.count(*)
      from identity.user_role_assignment assignment
      join identity.user_account account
        on account.user_account_id = assignment.user_account_id
     where assignment.metadata ->> 'fixture_id' = v_fixture_id
       and account.metadata ->> 'fixture_id' = v_fixture_id
       and assignment.role_status = 'active'
       and assignment.role_code in ('guide', 'explorer')
  ) <> 2 or (
    select pg_catalog.count(*)
      from identity.user_role_assignment
     where metadata ->> 'fixture_id' = v_fixture_id
       and role_code = 'guide'
  ) <> 1 or (
    select pg_catalog.count(*)
      from identity.user_role_assignment
     where metadata ->> 'fixture_id' = v_fixture_id
       and role_code = 'explorer'
  ) <> 1 then
    raise exception 'WI021-S02 setup validation expected one active Guide role and one active Explorer role';
  end if;

  if (
    select pg_catalog.count(*)
      from core.guide_profile
     where metadata ->> 'fixture_id' = v_fixture_id
       and guide_profile_id = '02102000-3000-4000-8000-000000000001'
       and user_account_id = '02102000-0000-4000-8000-000000000001'
       and guide_display_name like 'SYNTHETIC%'
       and solmind_virtual_guide_name = 'SYNTHETIC SolMind Virtual Guide'
       and status = 'active'
  ) <> 1 then
    raise exception 'WI021-S02 setup validation expected exactly one synthetic Guide profile';
  end if;

  if (
    select pg_catalog.count(*)
      from core.explorer_profile
     where metadata ->> 'fixture_id' = v_fixture_id
       and explorer_profile_id = '02102000-3000-4000-8000-000000000002'
       and user_account_id = '02102000-0000-4000-8000-000000000002'
       and explorer_display_name like 'SYNTHETIC%'
       and status = 'active'
  ) <> 1 then
    raise exception 'WI021-S02 setup validation expected exactly one synthetic Explorer profile';
  end if;

  if (
    select pg_catalog.count(*)
      from core.organization
     where metadata ->> 'fixture_id' = v_fixture_id
       and organization_id = '02102000-2000-4000-8000-000000000001'
  ) <> 1 or (
    select pg_catalog.count(*)
      from core.practice
     where metadata ->> 'fixture_id' = v_fixture_id
       and practice_id = '02102000-2100-4000-8000-000000000001'
  ) <> 1 or (
    select pg_catalog.count(*)
      from core.practice_guide
     where metadata ->> 'fixture_id' = v_fixture_id
       and practice_guide_id = '02102000-4000-4000-8000-000000000001'
       and relationship_status = 'active'
  ) <> 1 then
    raise exception 'WI021-S02 setup validation expected one fixture organization, practice, and active Practice-Guide row';
  end if;

  if (
    select pg_catalog.count(*)
      from core.guide_explorer_relationship
     where metadata ->> 'fixture_id' = v_fixture_id
       and guide_explorer_relationship_id =
           '02102000-5000-4000-8000-000000000001'
       and guide_profile_id = '02102000-3000-4000-8000-000000000001'
       and explorer_profile_id = '02102000-3000-4000-8000-000000000002'
       and practice_id = '02102000-2100-4000-8000-000000000001'
       and relationship_status = 'active'
       and explorer_safe_guardrail = v_expected_guardrail
       and pg_catalog.char_length(explorer_safe_guardrail) <= 2000
  ) <> 1 then
    raise exception 'WI021-S02 setup validation expected one active relationship with the exact bounded behavior instructions';
  end if;
end;
$fixture_post_setup_validation$;

commit;
