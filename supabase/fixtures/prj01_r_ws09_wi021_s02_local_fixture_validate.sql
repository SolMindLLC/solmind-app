\set ON_ERROR_STOP on

-- Read-only validation for the PRJ01_R-WS09-WI021-S02 local fixture.
-- This script writes nothing. It fails if the fixture is incomplete, expanded,
-- ambiguous, not obviously synthetic, or carries different behavior text.

do $fixture_validation$
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
    raise exception 'WI021-S02 validation expected exactly two fixture accounts';
  end if;

  if (
    select pg_catalog.count(*)
      from identity.user_account
     where metadata ->> 'fixture_id' = v_fixture_id
       and user_account_id in (
             '02102000-0000-4000-8000-000000000001',
             '02102000-0000-4000-8000-000000000002'
           )
       and display_name like 'SYNTHETIC%'
       and username in (
             'wi021.s02.guide@synthetic.invalid',
             'wi021.s02.explorer@synthetic.invalid'
           )
       and account_status = 'active'
       and metadata ->> 'fixture_scope' = 'local_development_test_only'
       and metadata ->> 'synthetic' = 'true'
  ) <> 2 then
    raise exception 'WI021-S02 validation rejected ambiguous, nondeterministic, or inactive fixture identities';
  end if;

  if (
    select pg_catalog.count(*)
      from identity.user_role_assignment
     where metadata ->> 'fixture_id' = v_fixture_id
  ) <> 2 or (
    select pg_catalog.count(*)
      from identity.user_role_assignment
     where metadata ->> 'fixture_id' = v_fixture_id
       and user_role_assignment_id =
           '02102000-1000-4000-8000-000000000001'
       and user_account_id = '02102000-0000-4000-8000-000000000001'
       and role_code = 'guide'
       and role_status = 'active'
  ) <> 1 or (
    select pg_catalog.count(*)
      from identity.user_role_assignment
     where metadata ->> 'fixture_id' = v_fixture_id
       and user_role_assignment_id =
           '02102000-1000-4000-8000-000000000002'
       and user_account_id = '02102000-0000-4000-8000-000000000002'
       and role_code = 'explorer'
       and role_status = 'active'
  ) <> 1 then
    raise exception 'WI021-S02 validation expected one active Guide role and one active Explorer role';
  end if;

  if (
    select pg_catalog.count(*)
      from core.guide_profile
     where metadata ->> 'fixture_id' = v_fixture_id
  ) <> 1 or (
    select pg_catalog.count(*)
      from core.guide_profile
     where guide_profile_id = '02102000-3000-4000-8000-000000000001'
       and user_account_id = '02102000-0000-4000-8000-000000000001'
       and metadata ->> 'fixture_id' = v_fixture_id
       and guide_display_name = 'SYNTHETIC WI021 S02 Guide'
       and solmind_virtual_guide_name = 'SYNTHETIC SolMind Virtual Guide'
       and status = 'active'
  ) <> 1 then
    raise exception 'WI021-S02 validation expected exactly one synthetic Guide profile';
  end if;

  if (
    select pg_catalog.count(*)
      from core.explorer_profile
     where metadata ->> 'fixture_id' = v_fixture_id
  ) <> 1 or (
    select pg_catalog.count(*)
      from core.explorer_profile
     where explorer_profile_id = '02102000-3000-4000-8000-000000000002'
       and user_account_id = '02102000-0000-4000-8000-000000000002'
       and metadata ->> 'fixture_id' = v_fixture_id
       and explorer_display_name = 'SYNTHETIC WI021 S02 Explorer'
       and status = 'active'
  ) <> 1 then
    raise exception 'WI021-S02 validation expected exactly one synthetic Explorer profile';
  end if;

  if (
    select pg_catalog.count(*)
      from core.organization
     where metadata ->> 'fixture_id' = v_fixture_id
  ) <> 1 or (
    select pg_catalog.count(*)
      from core.organization
     where organization_id = '02102000-2000-4000-8000-000000000001'
       and metadata ->> 'fixture_id' = v_fixture_id
  ) <> 1 or (
    select pg_catalog.count(*)
      from core.practice
     where metadata ->> 'fixture_id' = v_fixture_id
  ) <> 1 or (
    select pg_catalog.count(*)
      from core.practice
     where practice_id = '02102000-2100-4000-8000-000000000001'
       and organization_id = '02102000-2000-4000-8000-000000000001'
       and metadata ->> 'fixture_id' = v_fixture_id
  ) <> 1 then
    raise exception 'WI021-S02 validation expected one exact fixture organization and practice';
  end if;

  if (
    select pg_catalog.count(*)
      from core.practice_guide
     where metadata ->> 'fixture_id' = v_fixture_id
  ) <> 1 or (
    select pg_catalog.count(*)
      from core.practice_guide
     where practice_guide_id = '02102000-4000-4000-8000-000000000001'
       and practice_id = '02102000-2100-4000-8000-000000000001'
       and guide_profile_id = '02102000-3000-4000-8000-000000000001'
       and relationship_status = 'active'
       and is_primary_for_mvp0 = true
       and metadata ->> 'fixture_id' = v_fixture_id
  ) <> 1 then
    raise exception 'WI021-S02 validation expected one exact active Practice-Guide row';
  end if;

  if (
    select pg_catalog.count(*)
      from core.guide_explorer_relationship
     where metadata ->> 'fixture_id' = v_fixture_id
  ) <> 1 or (
    select pg_catalog.count(*)
      from core.guide_explorer_relationship
     where guide_explorer_relationship_id =
           '02102000-5000-4000-8000-000000000001'
       and guide_profile_id = '02102000-3000-4000-8000-000000000001'
       and explorer_profile_id = '02102000-3000-4000-8000-000000000002'
       and practice_id = '02102000-2100-4000-8000-000000000001'
       and relationship_status = 'active'
       and explorer_safe_guardrail = v_expected_guardrail
       and pg_catalog.char_length(explorer_safe_guardrail) <= 2000
       and explorer_safe_guardrail_updated_by_user_account_id =
           '02102000-0000-4000-8000-000000000001'
       and metadata ->> 'fixture_id' = v_fixture_id
  ) <> 1 then
    raise exception 'WI021-S02 validation expected one active relationship with the exact bounded behavior instructions';
  end if;
end;
$fixture_validation$;

select
  'PRJ01_R-WS09-WI021-S02 local fixture validation passed' as validation_result;
