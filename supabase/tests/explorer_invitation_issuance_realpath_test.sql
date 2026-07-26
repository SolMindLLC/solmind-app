begin;
select plan(59);

insert into identity.user_account (
  user_account_id,
  display_name,
  account_status
) values
  (
    'a27d0030-0000-4000-8000-000000000101',
    'S02D Guide One',
    'active'
  ),
  (
    'a27d0030-0000-4000-8000-000000000102',
    'S02D Guide Two',
    'active'
  ),
  (
    'a27d0030-0000-4000-8000-000000000103',
    'S02D Unauthorized',
    'active'
  ),
  (
    'a27d0030-0000-4000-8000-000000000201',
    'S02D Existing Explorer',
    'active'
  );

insert into identity.user_role_assignment (
  user_role_assignment_id,
  user_account_id,
  role_code,
  role_status,
  granted_by_role_context
) values
  (
    'a27d0030-1000-4000-8000-000000000101',
    'a27d0030-0000-4000-8000-000000000101',
    'guide',
    'active',
    'system'
  ),
  (
    'a27d0030-1000-4000-8000-000000000102',
    'a27d0030-0000-4000-8000-000000000102',
    'guide',
    'active',
    'system'
  ),
  (
    'a27d0030-1000-4000-8000-000000000201',
    'a27d0030-0000-4000-8000-000000000201',
    'explorer',
    'active',
    'system'
  );

insert into identity.user_session (
  user_session_id,
  user_account_id,
  active_role_context,
  created_at,
  expires_at,
  session_status
) values
  (
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-0000-4000-8000-000000000101',
    'guide',
    pg_catalog.now() - interval '1 minute',
    pg_catalog.now() + interval '2 hours',
    'active'
  ),
  (
    'a27d0030-2000-4000-8000-000000000102',
    'a27d0030-0000-4000-8000-000000000102',
    'guide',
    pg_catalog.now() - interval '1 minute',
    pg_catalog.now() + interval '2 hours',
    'active'
  ),
  (
    'a27d0030-2000-4000-8000-000000000103',
    'a27d0030-0000-4000-8000-000000000103',
    'explorer',
    pg_catalog.now() - interval '1 minute',
    pg_catalog.now() + interval '2 hours',
    'active'
  );

insert into core.organization (
  organization_id,
  organization_name,
  approval_status,
  approved_by_user_account_id,
  approved_at,
  status
) values (
  'a27d0030-3000-4000-8000-000000000101',
  'S02D synthetic organization',
  'approved',
  'a27d0030-0000-4000-8000-000000000101',
  pg_catalog.now() - interval '1 day',
  'active'
);

insert into core.practice (
  practice_id,
  organization_id,
  practice_name,
  approval_status,
  approved_by_user_account_id,
  approved_at,
  status
) values
  (
    'a27d0030-3100-4000-8000-000000000101',
    'a27d0030-3000-4000-8000-000000000101',
    'S02D active practice',
    'approved',
    'a27d0030-0000-4000-8000-000000000101',
    pg_catalog.now() - interval '1 day',
    'active'
  ),
  (
    'a27d0030-3100-4000-8000-000000000102',
    'a27d0030-3000-4000-8000-000000000101',
    'S02D inactive practice',
    'approved',
    'a27d0030-0000-4000-8000-000000000101',
    pg_catalog.now() - interval '1 day',
    'inactive'
  );

insert into core.guide_profile (
  guide_profile_id,
  user_account_id,
  guide_display_name,
  setup_status,
  approved_by_user_account_id,
  approved_at,
  status
) values
  (
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-0000-4000-8000-000000000101',
    'S02D Guide One',
    'approved',
    'a27d0030-0000-4000-8000-000000000101',
    pg_catalog.now() - interval '1 day',
    'active'
  ),
  (
    'a27d0030-3200-4000-8000-000000000102',
    'a27d0030-0000-4000-8000-000000000102',
    'S02D Guide Two',
    'approved',
    'a27d0030-0000-4000-8000-000000000101',
    pg_catalog.now() - interval '1 day',
    'active'
  );

insert into core.practice_guide (
  practice_guide_id,
  practice_id,
  guide_profile_id,
  relationship_status,
  is_primary_for_mvp0,
  created_by_user_account_id
) values
  (
    'a27d0030-3300-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'active',
    true,
    'a27d0030-0000-4000-8000-000000000101'
  ),
  (
    'a27d0030-3300-4000-8000-000000000102',
    'a27d0030-3100-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000102',
    'active',
    true,
    'a27d0030-0000-4000-8000-000000000101'
  );

insert into identity.user_contact_method (
  user_contact_method_id,
  user_account_id,
  contact_method_type,
  contact_label,
  contact_value,
  normalized_contact_value,
  login_enabled,
  is_verified,
  status
) values (
  'a27d0030-4000-4000-8000-000000000201',
  'a27d0030-0000-4000-8000-000000000201',
  'email',
  'primary',
  'existing-explorer@synthetic.invalid',
  'existing-explorer@synthetic.invalid',
  true,
  true,
  'active'
);

insert into core.explorer_profile (
  explorer_profile_id,
  user_account_id,
  explorer_display_name,
  onboarding_status,
  status
) values (
  'a27d0030-4100-4000-8000-000000000201',
  'a27d0030-0000-4000-8000-000000000201',
  'S02D Existing Explorer',
  'active',
  'active'
);

set local role service_role;
create temporary table issue_result as
select *
  from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000101',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'fresh@synthetic.invalid',
    'fresh@synthetic.invalid',
    '  Fresh   Explorer  '
  );
reset role;

select is(
  (select outcome from issue_result),
  'issued',
  'fresh eligible issuance returns issued'
);
select is(
  (
    select explorer_invite_id
      from issue_result
  ),
  'a27d0030-5000-4000-8000-000000000101'::uuid,
  'fresh issuance returns the caller UUID'
);
select is(
  (
    select guide_profile_id
      from core.explorer_invite
     where explorer_invite_id =
           'a27d0030-5000-4000-8000-000000000101'
  ),
  'a27d0030-3200-4000-8000-000000000101'::uuid,
  'issued row records the exact Guide'
);
select is(
  (
    select practice_id
      from core.explorer_invite
     where explorer_invite_id =
           'a27d0030-5000-4000-8000-000000000101'
  ),
  'a27d0030-3100-4000-8000-000000000101'::uuid,
  'issued row records the exact Practice'
);
select is(
  (
    select invited_name
      from core.explorer_invite
     where explorer_invite_id =
           'a27d0030-5000-4000-8000-000000000101'
  ),
  'Fresh Explorer',
  'invited name is sanitized before storage'
);
select ok(
  (
    select expires_at
           between pg_catalog.now() + interval '23 hours 59 minutes'
               and pg_catalog.now() + interval '24 hours 1 minute'
      from core.explorer_invite
     where explorer_invite_id =
           'a27d0030-5000-4000-8000-000000000101'
  ),
  'issued row snapshots the 24-hour lifetime'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id =
           'a27d0030-5000-4000-8000-000000000101'
       and event_type = 'explorer_invite_issued'
       and action = 'issue'
       and reason_code = 'guide_issued'
       and actor_user_account_id =
           'a27d0030-0000-4000-8000-000000000101'
       and actor_role_context = 'guide'
       and target_entity_type = 'explorer_invite'
       and metadata = pg_catalog.jsonb_build_object(
         'contact_method_type',
         'email',
         'lifetime_hours',
         24
       )
  ),
  1,
  'fresh issuance writes the exact bounded Guide audit row'
);

create temporary table retry_result as
select *
  from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000101',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'fresh@synthetic.invalid',
    'fresh@synthetic.invalid',
    '  Fresh   Explorer  '
  );

select is(
  (select outcome from retry_result),
  'existing',
  'exact committed-response retry returns existing'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id =
           'a27d0030-5000-4000-8000-000000000101'
  ),
  1,
  'exact retry writes no additional audit row'
);
select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000101',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'changed@synthetic.invalid',
    'changed@synthetic.invalid',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_conflict',
  'same UUID with changed inputs denies'
);

create temporary table replacement_result as
select *
  from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000102',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'fresh@synthetic.invalid',
    'fresh@synthetic.invalid',
    'Replacement Explorer'
  );

select is(
  (select outcome from replacement_result),
  'issued',
  'same-Guide same-scope reissuance creates a replacement'
);
select is(
  (
    select invite_status
      from core.explorer_invite
     where explorer_invite_id =
           'a27d0030-5000-4000-8000-000000000101'
  ),
  'revoked',
  'replacement revokes the older same-scope invitation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.explorer_invite
     where guide_profile_id =
           'a27d0030-3200-4000-8000-000000000101'
       and practice_id =
           'a27d0030-3100-4000-8000-000000000101'
       and contact_method_type = 'email'
       and normalized_contact_value = 'fresh@synthetic.invalid'
       and invite_status in ('created', 'sent')
  ),
  1,
  'exactly one newest same-Guide invitation survives'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id =
           'a27d0030-5000-4000-8000-000000000101'
       and event_type = 'invite_revoked'
       and reason_code = 'superseded_by_reissuance'
       and actor_user_account_id =
           'a27d0030-0000-4000-8000-000000000101'
       and actor_role_context = 'guide'
  ),
  1,
  'replacement writes one exact Guide-attributed revocation audit'
);

select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000103',
    'a27d0030-0000-4000-8000-000000000102',
    'a27d0030-2000-4000-8000-000000000102',
    'a27d0030-3200-4000-8000-000000000102',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'fresh@synthetic.invalid',
    'fresh@synthetic.invalid',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_capacity_reached',
  'different Guide denies at normalized-contact capacity'
);
select is(
  (
    select invite_status
      from core.explorer_invite
     where explorer_invite_id =
           'a27d0030-5000-4000-8000-000000000102'
  ),
  'created',
  'capacity denial does not displace the existing Guide invitation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.explorer_invite
     where explorer_invite_id =
           'a27d0030-5000-4000-8000-000000000103'
  ),
  0,
  'capacity denial inserts nothing'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id =
           'a27d0030-5000-4000-8000-000000000103'
  ),
  0,
  'capacity denial writes no database audit'
);

create temporary table revoke_result as
select *
  from public.solmind_revoke_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000102',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101'
  );

select is(
  (select outcome from revoke_result),
  'revoked',
  'owned live invitation revocation returns revoked'
);
select is(
  (
    select invite_status
      from core.explorer_invite
     where explorer_invite_id =
           'a27d0030-5000-4000-8000-000000000102'
  ),
  'revoked',
  'owned live invitation is revoked'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id =
           'a27d0030-5000-4000-8000-000000000102'
       and event_type = 'invite_revoked'
       and reason_code = 'guide_revoked'
       and actor_user_account_id =
           'a27d0030-0000-4000-8000-000000000101'
       and actor_role_context = 'guide'
  ),
  1,
  'explicit revocation writes the exact Guide audit row'
);

create temporary table revoke_retry_result as
select *
  from public.solmind_revoke_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000102',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101'
  );
select is(
  (select outcome from revoke_retry_result),
  'already_revoked',
  'repeat revocation is a writeless terminal observation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id =
           'a27d0030-5000-4000-8000-000000000102'
  ),
  2,
  'repeat revocation adds no audit after issue and revoke'
);

insert into core.explorer_invite (
  explorer_invite_id,
  guide_profile_id,
  practice_id,
  invited_contact_value,
  normalized_contact_value,
  contact_method_type,
  invite_status,
  expires_at
) values
  (
    'a27d0030-5000-4000-8000-000000000104',
    'a27d0030-3200-4000-8000-000000000102',
    'a27d0030-3100-4000-8000-000000000101',
    'foreign@synthetic.invalid',
    'foreign@synthetic.invalid',
    'email',
    'created',
    pg_catalog.now() + interval '1 hour'
  ),
  (
    'a27d0030-5000-4000-8000-000000000105',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'elapsed@synthetic.invalid',
    'elapsed@synthetic.invalid',
    'email',
    'created',
    pg_catalog.now() - interval '1 second'
  );

select throws_ok(
  $$select * from public.solmind_revoke_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000104',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101'
  )$$,
  'P0001',
  'solmind_explorer_revoke_not_found',
  'foreign-owned target uses the value-free not-found class'
);
select is(
  (
    select invite_status
      from core.explorer_invite
     where explorer_invite_id =
           'a27d0030-5000-4000-8000-000000000104'
  ),
  'created',
  'foreign-target denial leaves state unchanged'
);

create temporary table expiry_result as
select *
  from public.solmind_revoke_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000105',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101'
  );
select is(
  (select outcome from expiry_result),
  'expired',
  'elapsed target materializes as expired'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id =
           'a27d0030-5000-4000-8000-000000000105'
       and event_type = 'invite_expired'
       and actor_user_account_id is null
       and actor_role_context = 'system'
  ),
  1,
  'expiry materialization writes one system audit row'
);

insert into core.guide_explorer_relationship (
  guide_explorer_relationship_id,
  guide_profile_id,
  explorer_profile_id,
  practice_id,
  relationship_status,
  started_at,
  created_by_user_account_id
) values (
  'a27d0030-4200-4000-8000-000000000201',
  'a27d0030-3200-4000-8000-000000000101',
  'a27d0030-4100-4000-8000-000000000201',
  'a27d0030-3100-4000-8000-000000000101',
  'active',
  pg_catalog.now() - interval '1 day',
  'a27d0030-0000-4000-8000-000000000101'
);

select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000106',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'existing-explorer@synthetic.invalid',
    'existing-explorer@synthetic.invalid',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_existing_relationship',
  'live same-Guide relationship denies a redundant invitation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.explorer_invite
     where explorer_invite_id =
           'a27d0030-5000-4000-8000-000000000106'
  ),
  0,
  'live-relationship denial writes no invitation'
);

update core.guide_explorer_relationship
   set relationship_status = 'ended',
       ended_at = pg_catalog.now()
 where guide_explorer_relationship_id =
       'a27d0030-4200-4000-8000-000000000201';

create temporary table reentry_result as
select *
  from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000107',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'existing-explorer@synthetic.invalid',
    'existing-explorer@synthetic.invalid',
    null
  );
select is(
  (select outcome from reentry_result),
  'issued',
  'ended history permits a fresh eligible re-entry invitation'
);

select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000108',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000102',
    'email',
    'ineligible@synthetic.invalid',
    'ineligible@synthetic.invalid',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_ineligible',
  'inactive Practice denies before invitation mutation'
);
select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000109',
    'a27d0030-0000-4000-8000-000000000103',
    'a27d0030-2000-4000-8000-000000000103',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'unauthorized@synthetic.invalid',
    'unauthorized@synthetic.invalid',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_unauthorized',
  'non-Guide session denies before scope disclosure'
);

savepoint inactive_guide_profile;
update core.guide_profile
   set status = 'inactive'
 where guide_profile_id = 'a27d0030-3200-4000-8000-000000000101';
select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000119',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'inactive-guide@synthetic.invalid',
    'inactive-guide@synthetic.invalid',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_ineligible',
  'inactive Guide profile denies issuance'
);
rollback to savepoint inactive_guide_profile;

savepoint suspended_guide_setup;
update core.guide_profile
   set setup_status = 'suspended'
 where guide_profile_id = 'a27d0030-3200-4000-8000-000000000101';
select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000120',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'suspended-guide@synthetic.invalid',
    'suspended-guide@synthetic.invalid',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_ineligible',
  'suspended Guide setup denies issuance'
);
rollback to savepoint suspended_guide_setup;

savepoint unapproved_practice;
update core.practice
   set approval_status = 'submitted'
 where practice_id = 'a27d0030-3100-4000-8000-000000000101';
select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000121',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'unapproved-practice@synthetic.invalid',
    'unapproved-practice@synthetic.invalid',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_ineligible',
  'unapproved Practice denies issuance'
);
rollback to savepoint unapproved_practice;

savepoint suspended_membership;
update core.practice_guide
   set relationship_status = 'suspended'
 where practice_id = 'a27d0030-3100-4000-8000-000000000101'
   and guide_profile_id = 'a27d0030-3200-4000-8000-000000000101';
select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000122',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'suspended-membership@synthetic.invalid',
    'suspended-membership@synthetic.invalid',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_ineligible',
  'suspended Practice membership denies issuance'
);
rollback to savepoint suspended_membership;

savepoint suspended_guide_account;
update identity.user_account
   set account_status = 'suspended'
 where user_account_id = 'a27d0030-0000-4000-8000-000000000101';
select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000123',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'suspended-account@synthetic.invalid',
    'suspended-account@synthetic.invalid',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_unauthorized',
  'suspended Guide account denies issuance'
);
rollback to savepoint suspended_guide_account;

savepoint revoked_guide_session;
update identity.user_session
   set session_status = 'revoked',
       ended_at = pg_catalog.now()
 where user_session_id = 'a27d0030-2000-4000-8000-000000000101';
select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000124',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'revoked-session@synthetic.invalid',
    'revoked-session@synthetic.invalid',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_unauthorized',
  'revoked Guide session denies issuance'
);
rollback to savepoint revoked_guide_session;

savepoint missing_lifetime_policy;
delete from core.invitation_lifetime_policy
 where invitation_role = 'explorer';
select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000110',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'missing-lifetime@synthetic.invalid',
    'missing-lifetime@synthetic.invalid',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_policy_unavailable',
  'missing lifetime policy denies'
);
rollback to savepoint missing_lifetime_policy;

savepoint missing_capacity_policy;
delete from core.explorer_engagement_capacity_policy
 where capacity_policy_name = 'open_invitation_maximum';
select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000111',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'missing-capacity@synthetic.invalid',
    'missing-capacity@synthetic.invalid',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_policy_unavailable',
  'missing capacity policy denies'
);
rollback to savepoint missing_capacity_policy;

savepoint malformed_lifetime_policy;
alter table core.invitation_lifetime_policy
  drop constraint invitation_lifetime_policy_bounds_check;
update core.invitation_lifetime_policy
   set minimum_hours = 2
 where invitation_role = 'explorer';
select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000125',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'malformed-lifetime@synthetic.invalid',
    'malformed-lifetime@synthetic.invalid',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_policy_unavailable',
  'malformed lifetime policy denies'
);
rollback to savepoint malformed_lifetime_policy;

savepoint duplicate_lifetime_policy;
alter table core.invitation_lifetime_policy
  drop constraint invitation_lifetime_policy_pkey;
insert into core.invitation_lifetime_policy (
  invitation_role,
  minimum_hours,
  active_hours,
  maximum_hours
) values (
  'explorer',
  1,
  24,
  168
);
select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000126',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'duplicate-lifetime@synthetic.invalid',
    'duplicate-lifetime@synthetic.invalid',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_policy_unavailable',
  'duplicate lifetime policy denies'
);
rollback to savepoint duplicate_lifetime_policy;

savepoint malformed_capacity_policy;
alter table core.explorer_engagement_capacity_policy
  drop constraint explorer_engagement_capacity_policy_bounds_check;
update core.explorer_engagement_capacity_policy
   set minimum_value = 2,
       active_value = 2
 where capacity_policy_name = 'open_invitation_maximum';
select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000127',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'malformed-capacity@synthetic.invalid',
    'malformed-capacity@synthetic.invalid',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_policy_unavailable',
  'malformed open-invitation capacity policy denies'
);
rollback to savepoint malformed_capacity_policy;

savepoint duplicate_capacity_policy;
alter table core.explorer_engagement_capacity_policy
  drop constraint explorer_engagement_capacity_policy_pkey;
insert into core.explorer_engagement_capacity_policy (
  capacity_policy_name,
  minimum_value,
  active_value,
  maximum_value
) values (
  'open_invitation_maximum',
  1,
  1,
  10
);
select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000128',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'duplicate-capacity@synthetic.invalid',
    'duplicate-capacity@synthetic.invalid',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_policy_unavailable',
  'duplicate open-invitation capacity policy denies'
);
rollback to savepoint duplicate_capacity_policy;

create function pg_temp.reject_s02d_audit()
returns trigger
language plpgsql
as $$
begin
  raise exception 's02d_induced_audit_failure';
end;
$$;
create trigger reject_s02d_audit
before insert on audit.audit_event
for each row execute function pg_temp.reject_s02d_audit();

insert into core.explorer_invite (
  explorer_invite_id,
  guide_profile_id,
  practice_id,
  invited_contact_value,
  normalized_contact_value,
  contact_method_type,
  invite_status,
  expires_at
) values (
  'a27d0030-5000-4000-8000-000000000112',
  'a27d0030-3200-4000-8000-000000000101',
  'a27d0030-3100-4000-8000-000000000101',
  'revoke-rollback@synthetic.invalid',
  'revoke-rollback@synthetic.invalid',
  'email',
  'created',
  pg_catalog.now() + interval '1 hour'
);

select throws_ok(
  $$select * from public.solmind_revoke_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000112',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101'
  )$$,
  'P0001',
  'solmind_explorer_revoke_integrity_failure',
  'revocation audit failure maps to one fixed integrity class'
);
select is(
  (
    select invite_status
      from core.explorer_invite
     where explorer_invite_id =
           'a27d0030-5000-4000-8000-000000000112'
  ),
  'created',
  'revocation audit failure rolls back the state transition'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id =
           'a27d0030-5000-4000-8000-000000000112'
  ),
  0,
  'revocation audit failure leaves no partial audit row'
);

select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000113',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'issue-rollback@synthetic.invalid',
    'issue-rollback@synthetic.invalid',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_integrity_failure',
  'issuance audit failure maps to one fixed integrity class'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.explorer_invite
     where explorer_invite_id =
           'a27d0030-5000-4000-8000-000000000113'
  ),
  0,
  'issuance audit failure rolls back invitation insertion'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id =
           'a27d0030-5000-4000-8000-000000000113'
  ),
  0,
  'issuance audit failure leaves no partial audit row'
);

insert into core.explorer_invite (
  explorer_invite_id,
  guide_profile_id,
  practice_id,
  invited_contact_value,
  normalized_contact_value,
  contact_method_type,
  invite_status,
  expires_at
) values
  (
    'a27d0030-5000-4000-8000-000000000114',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'expiry-issue-rollback@synthetic.invalid',
    'expiry-issue-rollback@synthetic.invalid',
    'email',
    'created',
    pg_catalog.now() - interval '1 minute'
  ),
  (
    'a27d0030-5000-4000-8000-000000000116',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'replacement-rollback@synthetic.invalid',
    'replacement-rollback@synthetic.invalid',
    'email',
    'created',
    pg_catalog.now() + interval '1 hour'
  ),
  (
    'a27d0030-5000-4000-8000-000000000118',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'expiry-revoke-rollback@synthetic.invalid',
    'expiry-revoke-rollback@synthetic.invalid',
    'email',
    'created',
    pg_catalog.now() - interval '1 minute'
  );

select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000115',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'expiry-issue-rollback@synthetic.invalid',
    'expiry-issue-rollback@synthetic.invalid',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_integrity_failure',
  'expiry-audit failure during issuance maps to the fixed integrity class'
);
select is(
  (
    select invite_status
      from core.explorer_invite
     where explorer_invite_id =
           'a27d0030-5000-4000-8000-000000000114'
  ),
  'created',
  'expiry-audit failure rolls back issuance-side expiry materialization'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.explorer_invite
     where explorer_invite_id =
           'a27d0030-5000-4000-8000-000000000115'
  ),
  0,
  'expiry-audit failure inserts no replacement invitation'
);

select throws_ok(
  $$select * from public.solmind_issue_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000117',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101',
    'a27d0030-3200-4000-8000-000000000101',
    'a27d0030-3100-4000-8000-000000000101',
    'email',
    'replacement-rollback@synthetic.invalid',
    'replacement-rollback@synthetic.invalid',
    null
  )$$,
  'P0001',
  'solmind_explorer_issue_integrity_failure',
  'replacement-audit failure maps to the fixed integrity class'
);
select is(
  (
    select invite_status
      from core.explorer_invite
     where explorer_invite_id =
           'a27d0030-5000-4000-8000-000000000116'
  ),
  'created',
  'replacement-audit failure restores the older open invitation'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from core.explorer_invite
     where explorer_invite_id =
           'a27d0030-5000-4000-8000-000000000117'
  ),
  0,
  'replacement-audit failure inserts no new invitation'
);

select throws_ok(
  $$select * from public.solmind_revoke_explorer_invitation(
    'a27d0030-5000-4000-8000-000000000118',
    'a27d0030-0000-4000-8000-000000000101',
    'a27d0030-2000-4000-8000-000000000101'
  )$$,
  'P0001',
  'solmind_explorer_revoke_integrity_failure',
  'expiry-audit failure during revocation maps to the fixed integrity class'
);
select is(
  (
    select invite_status
      from core.explorer_invite
     where explorer_invite_id =
           'a27d0030-5000-4000-8000-000000000118'
  ),
  'created',
  'expiry-audit failure rolls back revocation-side expiry materialization'
);
select is(
  (
    select pg_catalog.count(*)::integer
      from audit.audit_event
     where target_entity_id in (
       'a27d0030-5000-4000-8000-000000000114',
       'a27d0030-5000-4000-8000-000000000116',
       'a27d0030-5000-4000-8000-000000000118'
     )
  ),
  0,
  'all induced transition-audit failures leave no partial audit rows'
);

select * from finish();
rollback;
