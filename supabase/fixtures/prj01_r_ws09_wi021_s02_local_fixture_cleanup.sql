\set ON_ERROR_STOP on

-- Fail-closed cleanup for the PRJ01_R-WS09-WI021-S02 local fixture.
--
-- The cleanup owns only the exact deterministic fixture identifiers below.
-- It refuses to delete a target whose fixture tag differs and refuses to hide
-- unexpected rows that claim the same fixture tag. Any error rolls back every
-- delete. The final in-transaction check proves zero known fixture residue
-- before the cleanup can commit.

begin;

do $fixture_cleanup_preflight$
declare
  v_fixture_id constant text := 'PRJ01_R-WS09-WI021-S02';
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
      'WI021-S02 cleanup requires the already-banked identity/core schema';
  end if;

  if exists (
    select 1
      from identity.user_account
     where user_account_id in (
             '02102000-0000-4000-8000-000000000001',
             '02102000-0000-4000-8000-000000000002'
           )
       and metadata ->> 'fixture_id' is distinct from v_fixture_id
  ) or exists (
    select 1
      from identity.user_role_assignment
     where user_role_assignment_id in (
             '02102000-1000-4000-8000-000000000001',
             '02102000-1000-4000-8000-000000000002'
           )
       and metadata ->> 'fixture_id' is distinct from v_fixture_id
  ) or exists (
    select 1
      from core.organization
     where organization_id = '02102000-2000-4000-8000-000000000001'
       and metadata ->> 'fixture_id' is distinct from v_fixture_id
  ) or exists (
    select 1
      from core.practice
     where practice_id = '02102000-2100-4000-8000-000000000001'
       and metadata ->> 'fixture_id' is distinct from v_fixture_id
  ) or exists (
    select 1
      from core.guide_profile
     where guide_profile_id = '02102000-3000-4000-8000-000000000001'
       and metadata ->> 'fixture_id' is distinct from v_fixture_id
  ) or exists (
    select 1
      from core.explorer_profile
     where explorer_profile_id = '02102000-3000-4000-8000-000000000002'
       and metadata ->> 'fixture_id' is distinct from v_fixture_id
  ) or exists (
    select 1
      from core.practice_guide
     where practice_guide_id = '02102000-4000-4000-8000-000000000001'
       and metadata ->> 'fixture_id' is distinct from v_fixture_id
  ) or exists (
    select 1
      from core.guide_explorer_relationship
     where guide_explorer_relationship_id =
           '02102000-5000-4000-8000-000000000001'
       and metadata ->> 'fixture_id' is distinct from v_fixture_id
  ) then
    raise exception
      'WI021-S02 cleanup refused a deterministic target whose fixture tag differs';
  end if;

  if exists (
    select 1
      from identity.user_account
     where metadata ->> 'fixture_id' = v_fixture_id
       and user_account_id not in (
             '02102000-0000-4000-8000-000000000001',
             '02102000-0000-4000-8000-000000000002'
           )
  ) or exists (
    select 1
      from identity.user_role_assignment
     where metadata ->> 'fixture_id' = v_fixture_id
       and user_role_assignment_id not in (
             '02102000-1000-4000-8000-000000000001',
             '02102000-1000-4000-8000-000000000002'
           )
  ) or exists (
    select 1
      from core.organization
     where metadata ->> 'fixture_id' = v_fixture_id
       and organization_id <> '02102000-2000-4000-8000-000000000001'
  ) or exists (
    select 1
      from core.practice
     where metadata ->> 'fixture_id' = v_fixture_id
       and practice_id <> '02102000-2100-4000-8000-000000000001'
  ) or exists (
    select 1
      from core.guide_profile
     where metadata ->> 'fixture_id' = v_fixture_id
       and guide_profile_id <> '02102000-3000-4000-8000-000000000001'
  ) or exists (
    select 1
      from core.explorer_profile
     where metadata ->> 'fixture_id' = v_fixture_id
       and explorer_profile_id <> '02102000-3000-4000-8000-000000000002'
  ) or exists (
    select 1
      from core.practice_guide
     where metadata ->> 'fixture_id' = v_fixture_id
       and practice_guide_id <> '02102000-4000-4000-8000-000000000001'
  ) or exists (
    select 1
      from core.guide_explorer_relationship
     where metadata ->> 'fixture_id' = v_fixture_id
       and guide_explorer_relationship_id <>
           '02102000-5000-4000-8000-000000000001'
  ) then
    raise exception
      'WI021-S02 cleanup refused unexpected rows carrying the fixture tag';
  end if;

  if exists (
    select 1
      from identity.user_account
     where pg_catalog.lower(username) in (
             'wi021.s02.guide@synthetic.invalid',
             'wi021.s02.explorer@synthetic.invalid'
           )
       and user_account_id not in (
             '02102000-0000-4000-8000-000000000001',
             '02102000-0000-4000-8000-000000000002'
           )
  ) then
    raise exception
      'WI021-S02 cleanup refused a synthetic fixture username on an unexpected account';
  end if;
end;
$fixture_cleanup_preflight$;

delete from core.guide_explorer_relationship
 where guide_explorer_relationship_id =
       '02102000-5000-4000-8000-000000000001';

delete from core.practice_guide
 where practice_guide_id = '02102000-4000-4000-8000-000000000001';

delete from core.explorer_profile
 where explorer_profile_id = '02102000-3000-4000-8000-000000000002';

delete from core.guide_profile
 where guide_profile_id = '02102000-3000-4000-8000-000000000001';

delete from core.practice
 where practice_id = '02102000-2100-4000-8000-000000000001';

delete from core.organization
 where organization_id = '02102000-2000-4000-8000-000000000001';

delete from identity.user_role_assignment
 where user_role_assignment_id in (
         '02102000-1000-4000-8000-000000000001',
         '02102000-1000-4000-8000-000000000002'
       );

delete from identity.user_account
 where user_account_id in (
         '02102000-0000-4000-8000-000000000001',
         '02102000-0000-4000-8000-000000000002'
       );

do $fixture_zero_residue_validation$
declare
  v_fixture_id constant text := 'PRJ01_R-WS09-WI021-S02';
  v_residue_count integer;
begin
  select pg_catalog.count(*)::integer
    into v_residue_count
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
          or metadata ->> 'fixture_id' = v_fixture_id
      union all
      select 1
        from identity.user_role_assignment
       where user_role_assignment_id in (
               '02102000-1000-4000-8000-000000000001',
               '02102000-1000-4000-8000-000000000002'
             )
          or metadata ->> 'fixture_id' = v_fixture_id
      union all
      select 1
        from core.organization
       where organization_id = '02102000-2000-4000-8000-000000000001'
          or metadata ->> 'fixture_id' = v_fixture_id
      union all
      select 1
        from core.practice
       where practice_id = '02102000-2100-4000-8000-000000000001'
          or metadata ->> 'fixture_id' = v_fixture_id
      union all
      select 1
        from core.guide_profile
       where guide_profile_id = '02102000-3000-4000-8000-000000000001'
          or metadata ->> 'fixture_id' = v_fixture_id
      union all
      select 1
        from core.explorer_profile
       where explorer_profile_id = '02102000-3000-4000-8000-000000000002'
          or metadata ->> 'fixture_id' = v_fixture_id
      union all
      select 1
        from core.practice_guide
       where practice_guide_id = '02102000-4000-4000-8000-000000000001'
          or metadata ->> 'fixture_id' = v_fixture_id
      union all
      select 1
        from core.guide_explorer_relationship
       where guide_explorer_relationship_id =
             '02102000-5000-4000-8000-000000000001'
          or metadata ->> 'fixture_id' = v_fixture_id
    ) residue;

  if v_residue_count <> 0 then
    raise exception
      'WI021-S02 cleanup zero-residue validation found % residual row(s)',
      v_residue_count;
  end if;
end;
$fixture_zero_residue_validation$;

commit;

select
  'PRJ01_R-WS09-WI021-S02 local fixture cleanup passed with zero residue'
  as cleanup_result;
